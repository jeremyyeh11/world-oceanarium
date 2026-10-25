import { useCallback, useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { useEnvironment } from '@react-three/drei'
import * as THREE from 'three'
import { hashString } from '../utils/hash'
import { SURFACE_PLANE_Y, SURFACE_PLANE_X, SURFACE_PLANE_Z, SURFACE_PLANE_WIDTH, SURFACE_PLANE_DEPTH } from '../utils/waterSurfaceGeometry'

const SURFACE_WAVE_GLSL = /* glsl */ `
  uniform float uSurfaceTime;
  uniform vec2 uSurfaceSeed;
  // How far the plane has been moved to stay centred on the camera, in its own xy: the waves are
  // sampled where they are in the world, so they don't travel with the plane.
  uniform vec2 uSurfaceOffset;

  const float SURFACE_TAU = 6.28318530718;

  struct SurfaceWave {
    vec3 position;
    vec3 normal;
  };

  void addSurfaceWave(
    inout vec3 displaced,
    inout vec3 tangentX,
    inout vec3 tangentY,
    vec2 samplePosition,
    vec2 direction,
    float wavelength,
    float amplitude,
    float steepness,
    float speed,
    float phaseOffset
  ) {
    vec2 waveDirection = normalize(direction);
    float frequency = SURFACE_TAU / wavelength;
    float phase = frequency * dot(waveDirection, samplePosition) + uSurfaceTime * speed + phaseOffset;
    float waveSin = sin(phase);
    float waveCos = cos(phase);
    float horizontal = steepness * amplitude;
    float derivative = horizontal * frequency * waveSin;
    float verticalDerivative = amplitude * frequency * waveCos;

    displaced.xy += waveDirection * horizontal * waveCos;
    displaced.z += amplitude * waveSin;

    tangentX += vec3(
      -derivative * waveDirection.x * waveDirection.x,
      -derivative * waveDirection.x * waveDirection.y,
      verticalDerivative * waveDirection.x
    );
    tangentY += vec3(
      -derivative * waveDirection.x * waveDirection.y,
      -derivative * waveDirection.y * waveDirection.y,
      verticalDerivative * waveDirection.y
    );
  }

  SurfaceWave getSurfaceWave(vec3 basePosition) {
    vec3 displaced = basePosition;
    vec3 tangentX = vec3(1.0, 0.0, 0.0);
    vec3 tangentY = vec3(0.0, 1.0, 0.0);
    vec2 samplePosition = basePosition.xy + uSurfaceOffset;

    // Three crossed scales. Each pair uses an incommensurate wavelength,
    // direction, and speed so no single sinusoid owns the reflected pattern.
    addSurfaceWave(displaced, tangentX, tangentY, samplePosition, vec2(1.0, 0.37), 22.0, 0.035, 0.20, 0.31, dot(uSurfaceSeed, vec2(0.071, 0.043)));
    addSurfaceWave(displaced, tangentX, tangentY, samplePosition, vec2(-0.43, 1.0), 15.0, 0.029, 0.19, 0.44, dot(uSurfaceSeed, vec2(-0.037, 0.083)));

    addSurfaceWave(displaced, tangentX, tangentY, samplePosition, vec2(0.18, -1.0), 9.0, 0.020, 0.17, 0.68, dot(uSurfaceSeed, vec2(0.113, -0.029)));
    addSurfaceWave(displaced, tangentX, tangentY, samplePosition, vec2(-1.0, -0.61), 6.5, 0.016, 0.15, 0.86, dot(uSurfaceSeed, vec2(0.052, 0.127)));

    addSurfaceWave(displaced, tangentX, tangentY, samplePosition, vec2(0.78, 1.0), 5.2, 0.011, 0.12, 1.05, dot(uSurfaceSeed, vec2(-0.097, 0.061)));
    addSurfaceWave(displaced, tangentX, tangentY, samplePosition, vec2(-0.73, 0.26), 4.5, 0.008, 0.10, 1.22, dot(uSurfaceSeed, vec2(0.139, -0.047)));

    SurfaceWave wave;
    wave.position = displaced;
    wave.normal = normalize(cross(tangentX, tangentY));
    return wave;
  }
`

const SURFACE_ENVIRONMENT = `${import.meta.env.BASE_URL}hdr/qwantani-puresky-1k.hdr`
const SURFACE_PROGRAM_KEY = () => 'world-oceanarium-physical-gerstner-water-v8'

// Defined in `../utils/waterSurfaceGeometry` so `.js` modules and the Node test
// runner can read them without importing this renderer component. Re-exported
// here so existing importers keep working.
export { SURFACE_PLANE_Y, SURFACE_PLANE_X, SURFACE_PLANE_Z, SURFACE_PLANE_WIDTH, SURFACE_PLANE_DEPTH }

const SURFACE_PLANE_POSITION = [SURFACE_PLANE_X, SURFACE_PLANE_Y, SURFACE_PLANE_Z]
const SURFACE_PLANE_ROTATION = [-Math.PI / 2, 0, 0]
// ~66k vertices. Distance fade removes the 320 WU plane before its geometric
// edge, while 256 subdivisions support the tight 3.7 WU reflection spectrum.
const SURFACE_PLANE_SEGMENTS = [256, 256]
const SURFACE_PLANE_SIZE = [SURFACE_PLANE_WIDTH, SURFACE_PLANE_DEPTH, ...SURFACE_PLANE_SEGMENTS]
// The plane follows the camera across the ground plane, in whole grid steps so its vertices stay
// on the same world lattice (no shimmer), and the shader samples the waves at their fixed world
// place (uSurfaceOffset). Its edge is then always half its width from the camera, past the 120 WU
// fade. Fixed at the tank's centre, a follow camera out with The Shallows' wide-roaming rays and
// manta came within reach of the edge and showed it as a line (Jeremy, 2026-10-25).
const SURFACE_GRID_STEP_X = SURFACE_PLANE_WIDTH / SURFACE_PLANE_SEGMENTS[0]
const SURFACE_GRID_STEP_Z = SURFACE_PLANE_DEPTH / SURFACE_PLANE_SEGMENTS[1]

function seedOffset(seed) {
  const h = hashString(`tank-surface:${seed}`)
  return [(h & 0xffff) / 0xffff * 100, ((h >>> 16) & 0xffff) / 0xffff * 100]
}

// The surface's own tint, seen from below. A tank can override both (its `lighting.surfaceColor`
// and `lighting.surfaceAttenuationColor`): The Reefs' shallow water is turquoise, not slate blue.
const DEFAULT_SURFACE_COLOR = '#4f78a8'
const DEFAULT_SURFACE_ATTENUATION_COLOR = '#3f709a'

export default function WaterSurface({ seed = 0, color = DEFAULT_SURFACE_COLOR, attenuationColor = DEFAULT_SURFACE_ATTENUATION_COLOR }) {
  const gl = useThree(state => state.gl)
  const environment = useEnvironment({ files: SURFACE_ENVIRONMENT })
  const meshRef = useRef(null)
  const uniforms = useMemo(() => ({
    uSurfaceTime: { value: 0 },
    uSurfaceSeed: { value: new THREE.Vector2() },
    uSurfaceOffset: { value: new THREE.Vector2() },
  }), [])

  useEffect(() => {
    const [x, y] = seedOffset(seed)
    uniforms.uSurfaceSeed.value.set(x, y)
  }, [seed, uniforms])

  useEffect(() => {
    // MeshPhysicalMaterial transmission renders the opaque scene once into a
    // refraction target. Half resolution is visually invisible through the
    // rough, moving water but quarters that target's fragment cost on phones.
    const previousScale = gl.transmissionResolutionScale
    gl.transmissionResolutionScale = 0.5
    return () => { gl.transmissionResolutionScale = previousScale }
  }, [gl])

  const prepareMaterial = useCallback((shader) => {
    shader.uniforms.uSurfaceTime = uniforms.uSurfaceTime
    shader.uniforms.uSurfaceSeed = uniforms.uSurfaceSeed
    shader.uniforms.uSurfaceOffset = uniforms.uSurfaceOffset
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\n${SURFACE_WAVE_GLSL}`)
      .replace(
        '#include <beginnormal_vertex>',
        '#include <beginnormal_vertex>\nSurfaceWave surfaceWave = getSurfaceWave(position);\nobjectNormal = surfaceWave.normal;',
      )
      .replace('#include <begin_vertex>', 'vec3 transformed = surfaceWave.position;')
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <opaque_fragment>',
      `#include <opaque_fragment>
       // At grazing angles an infinite plane resolves into a hard horizon line.
       // Fade by true camera distance before that limit, leaving nearby overhead
       // water fully physical while dissolving the distant surface into the fog.
       float surfaceDistanceFade = 1.0 - smoothstep(45.0, 120.0, length(vViewPosition));
       float surfaceFacing = abs(dot(normalize(normal), normalize(vViewPosition)));
       float surfaceGrazingFade = smoothstep(0.16, 0.44, surfaceFacing);
       gl_FragColor.a *= surfaceDistanceFade * surfaceGrazingFade;`,
    )
  }, [uniforms])

  useFrame(({ clock, camera }) => {
    uniforms.uSurfaceTime.value = clock.getElapsedTime()
    const mesh = meshRef.current
    if (!mesh) return
    const dx = Math.round((camera.position.x - SURFACE_PLANE_X) / SURFACE_GRID_STEP_X) * SURFACE_GRID_STEP_X
    const dz = Math.round((camera.position.z - SURFACE_PLANE_Z) / SURFACE_GRID_STEP_Z) * SURFACE_GRID_STEP_Z
    mesh.position.set(SURFACE_PLANE_X + dx, SURFACE_PLANE_Y, SURFACE_PLANE_Z + dz)
    // The plane is turned flat (rotation x -90°): its local y runs along world -z.
    uniforms.uSurfaceOffset.value.set(dx, -dz)
  })

  return (
    <mesh ref={meshRef} position={SURFACE_PLANE_POSITION} rotation={SURFACE_PLANE_ROTATION} raycast={() => null}>
      <planeGeometry args={SURFACE_PLANE_SIZE} />
      <meshPhysicalMaterial
        color={color}
        roughness={0.26}
        metalness={0}
        transmission={0.88}
        thickness={0.08}
        ior={1.333}
        attenuationColor={attenuationColor}
        attenuationDistance={80}
        specularIntensity={0.92}
        specularColor="#d5e8f7"
        clearcoat={0.06}
        clearcoatRoughness={0.28}
        envMap={environment}
        envMapIntensity={8.0}
        transparent
        depthWrite={false}
        side={THREE.DoubleSide}
        onBeforeCompile={prepareMaterial}
        customProgramCacheKey={SURFACE_PROGRAM_KEY}
      />
    </mesh>
  )
}
