import { useCallback, useEffect, useMemo } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { useEnvironment } from '@react-three/drei'
import * as THREE from 'three'
import { hashString } from '../utils/hash'

const SURFACE_WAVE_GLSL = /* glsl */ `
  uniform float uSurfaceTime;
  uniform vec2 uSurfaceSeed;

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
    vec2 samplePosition = basePosition.xy;

    addSurfaceWave(displaced, tangentX, tangentY, samplePosition, vec2(1.0, 0.22), 22.0, 0.24, 0.34, 0.54, dot(uSurfaceSeed, vec2(0.071, 0.043)));
    addSurfaceWave(displaced, tangentX, tangentY, samplePosition, vec2(-0.38, 1.0), 13.0, 0.14, 0.28, 0.76, dot(uSurfaceSeed, vec2(-0.037, 0.083)));
    addSurfaceWave(displaced, tangentX, tangentY, samplePosition, vec2(0.72, -1.0), 12.0, 0.075, 0.22, 1.08, dot(uSurfaceSeed, vec2(0.113, -0.029)));

    SurfaceWave wave;
    wave.position = displaced;
    wave.normal = normalize(cross(tangentX, tangentY));
    return wave;
  }
`

const SURFACE_ENVIRONMENT = `${import.meta.env.BASE_URL}hdr/qwantani-puresky-1k.hdr`
const SURFACE_PROGRAM_KEY = () => 'world-oceanarium-physical-gerstner-water-v2'

export const SURFACE_PLANE_Y = 4.6
export const SURFACE_PLANE_X = 0
export const SURFACE_PLANE_Z = -4
export const SURFACE_PLANE_WIDTH = 600
export const SURFACE_PLANE_DEPTH = 600

const SURFACE_PLANE_POSITION = [SURFACE_PLANE_X, SURFACE_PLANE_Y, SURFACE_PLANE_Z]
const SURFACE_PLANE_ROTATION = [-Math.PI / 2, 0, 0]
// ~26k vertices. The 600 WU overscan pushes every geometric edge beyond the
// camera range, while 160 subdivisions keep the shortest 12 WU ripple smooth.
const SURFACE_PLANE_SEGMENTS = [160, 160]
const SURFACE_PLANE_SIZE = [SURFACE_PLANE_WIDTH, SURFACE_PLANE_DEPTH, ...SURFACE_PLANE_SEGMENTS]

function seedOffset(seed) {
  const h = hashString(`tank-surface:${seed}`)
  return [(h & 0xffff) / 0xffff * 100, ((h >>> 16) & 0xffff) / 0xffff * 100]
}

export default function WaterSurface({ seed = 0 }) {
  const gl = useThree(state => state.gl)
  const environment = useEnvironment({ files: SURFACE_ENVIRONMENT })
  const uniforms = useMemo(() => ({
    uSurfaceTime: { value: 0 },
    uSurfaceSeed: { value: new THREE.Vector2() },
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
       float surfaceDistanceFade = 1.0 - smoothstep(55.0, 180.0, length(vViewPosition));
       float surfaceFacing = abs(dot(normalize(normal), normalize(vViewPosition)));
       float surfaceGrazingFade = smoothstep(0.22, 0.55, surfaceFacing);
       gl_FragColor.a *= surfaceDistanceFade * surfaceGrazingFade;`,
    )
  }, [uniforms])

  useFrame(({ clock }) => {
    uniforms.uSurfaceTime.value = clock.getElapsedTime()
  })

  return (
    <mesh position={SURFACE_PLANE_POSITION} rotation={SURFACE_PLANE_ROTATION} raycast={() => null}>
      <planeGeometry args={SURFACE_PLANE_SIZE} />
      <meshPhysicalMaterial
        color="#4f78a8"
        roughness={0.32}
        metalness={0}
        transmission={0.88}
        thickness={0.08}
        ior={1.333}
        attenuationColor="#3f709a"
        attenuationDistance={80}
        specularIntensity={0.92}
        specularColor="#d5e8f7"
        clearcoat={0.06}
        clearcoatRoughness={0.3}
        envMap={environment}
        envMapIntensity={0.65}
        transparent
        depthWrite={false}
        side={THREE.DoubleSide}
        onBeforeCompile={prepareMaterial}
        customProgramCacheKey={SURFACE_PROGRAM_KEY}
      />
    </mesh>
  )
}
