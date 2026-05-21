import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

const GOD_RAY_DIAGNOSTIC_WIREFRAME = false
const GOD_RAY_LEFT_ANGLE = -Math.PI / 12
const GOD_RAY_SURFACE_START_Y = 15

const BASIC_VERTEX = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const RAY_FRAGMENT = /* glsl */ `
  uniform float uTime;
  uniform float uSeed;
  uniform float uStrength;
  uniform float uFadeLength;
  varying vec2 vUv;

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(91.7, 271.3))) * 43758.5453123);
  }

  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
      mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
      u.y
    );
  }

  void main() {
    // Keep rays strongest near the visible water surface and fade them deeper.
    float fromSurface = vUv.y;
    float depthFade = pow(fromSurface, 0.55);
    float halfWidth = mix(0.08, 0.28, depthFade);
    float feather = mix(0.26, 0.52, 1.0 - depthFade);
    float topInfluence = pow(fromSurface, 1.35);
    float wobbleSpeed = 0.035 + fract(uSeed * 0.317) * 0.040;
    float centerLine = 0.5
      + sin(uTime * wobbleSpeed + uSeed * 1.73) * 0.026 * topInfluence
      + sin(uTime * (wobbleSpeed * 0.57) + uSeed * 0.91) * 0.014 * topInfluence;
    float widthPulse = 1.0 + sin(uTime * (wobbleSpeed * 0.82) + uSeed * 2.11) * 0.045 * topInfluence;
    float center = 1.0 - smoothstep(halfWidth * widthPulse, halfWidth * widthPulse + feather, abs(vUv.x - centerLine));
    float sideFade = smoothstep(0.0, 0.24, vUv.x) * smoothstep(1.0, 0.76, vUv.x);
    float surfaceFade = smoothstep(0.0, 0.16, fromSurface);
    float fadeStart = 1.0 - uFadeLength;
    float lengthFade = smoothstep(fadeStart, min(0.98, fadeStart + 0.24), fromSurface);
    float vertical = depthFade * surfaceFade * lengthFade;
    vec2 driftUv = vec2(vUv.x * 1.35 + uSeed + uTime * 0.018, vUv.y * 2.4 - uTime * 0.075);
    float shimmer = 0.76 + noise(driftUv) * 0.24;
    float breath = mix(
      0.96 + sin(uTime * 0.040 + uSeed * 1.43) * 0.04,
      0.88 + sin(uTime * 0.068 + uSeed * 1.17) * 0.12,
      topInfluence
    );
    float alpha = center * sideFade * vertical * shimmer * breath * uStrength * 0.28;
    gl_FragColor = vec4(0.34, 0.70, 0.90, alpha);
  }
`

const SURFACE_FRAGMENT = /* glsl */ `
  uniform float uTime;
  varying vec2 vUv;

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
  }

  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
      mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
      u.y
    );
  }

  float fbm(vec2 p) {
    float value = 0.0;
    float amp = 0.56;
    for (int i = 0; i < 4; i++) {
      value += amp * noise(p);
      p = mat2(1.72, -0.86, 0.86, 1.72) * p + 7.1;
      amp *= 0.5;
    }
    return value;
  }

  void main() {
    vec2 uv = vUv;
    vec2 waveUv = uv * vec2(5.2, 2.2);
    float broad = fbm(waveUv + vec2(uTime * 0.055, uTime * 0.010));
    float streak = fbm(uv * vec2(16.0, 4.6) + vec2(-uTime * 0.12, uTime * 0.03));
    float foam = smoothstep(0.62, 0.86, broad + streak * 0.34);
    float glint = smoothstep(0.72, 0.94, streak) * smoothstep(0.18, 0.92, uv.x);
    float bandMask = smoothstep(0.0, 0.16, uv.y) * smoothstep(1.0, 0.28, uv.y);
    float topGlow = smoothstep(1.0, 0.46, uv.y);

    vec3 cyan = vec3(0.20, 0.78, 0.92);
    vec3 foamColor = vec3(0.82, 1.0, 0.96);
    vec3 color = mix(cyan, foamColor, foam * 0.82 + glint * 0.55);
    float alpha = (0.12 + foam * 0.28 + glint * 0.18) * bandMask * topGlow;
    gl_FragColor = vec4(color, alpha);
  }
`

function LightRay({ x, surfaceY = GOD_RAY_SURFACE_START_Y, z, width, height, rotation, strength, seed, fadeLength }) {
  const material = useRef()
  const centerY = surfaceY - Math.cos(rotation) * height * 0.5
  const uniforms = useMemo(() => ({
    uTime: { value: 0 },
    uSeed: { value: seed },
    uStrength: { value: GOD_RAY_DIAGNOSTIC_WIREFRAME ? 1.05 : strength },
    uFadeLength: { value: fadeLength },
  }), [seed, strength, fadeLength])

  useFrame(({ clock }) => {
    if (!material.current) return
    material.current.uniforms.uTime.value = clock.getElapsedTime()
  })

  return (
    <group position={[x, centerY, z]} rotation={[0, 0, rotation]}>
      <mesh raycast={() => null}>
        <planeGeometry args={[width, height, 8, 8]} />
        <shaderMaterial
          ref={material}
          uniforms={uniforms}
          vertexShader={BASIC_VERTEX}
          fragmentShader={RAY_FRAGMENT}
          transparent
          depthWrite={false}
          depthTest
          blending={THREE.NormalBlending}
          side={THREE.DoubleSide}
        />
      </mesh>
      {GOD_RAY_DIAGNOSTIC_WIREFRAME && (
        <mesh raycast={() => null}>
          <planeGeometry args={[width, height, 8, 8]} />
          <meshBasicMaterial
            color="#8eeeff"
            transparent
            opacity={0.20}
            depthWrite={false}
            depthTest
            blending={THREE.NormalBlending}
            side={THREE.DoubleSide}
            wireframe
          />
        </mesh>
      )}
    </group>
  )
}

function LightRays() {
  const rays = useMemo(() => [
    [-11.4, GOD_RAY_SURFACE_START_Y, -4.8, 3.2, 18.5, GOD_RAY_LEFT_ANGLE, 0.22, 1.1, 0.78],
    [-6.6, GOD_RAY_SURFACE_START_Y, -2.6, 5.2, 20.0, GOD_RAY_LEFT_ANGLE, 0.18, 3.6, 0.94],
    [-1.8, GOD_RAY_SURFACE_START_Y, -5.8, 2.8, 21.0, GOD_RAY_LEFT_ANGLE, 0.20, 7.4, 0.66],
    [3.4, GOD_RAY_SURFACE_START_Y, -3.6, 4.6, 19.5, GOD_RAY_LEFT_ANGLE, 0.17, 11.9, 0.86],
    [8.2, GOD_RAY_SURFACE_START_Y, -6.6, 2.3, 20.8, GOD_RAY_LEFT_ANGLE, 0.20, 16.2, 0.58],
    [-3.9, GOD_RAY_SURFACE_START_Y, -9.2, 1.8, 22.0, GOD_RAY_LEFT_ANGLE, 0.15, 21.7, 0.72],
    [5.8, GOD_RAY_SURFACE_START_Y, -11.4, 1.4, 22.6, GOD_RAY_LEFT_ANGLE, 0.13, 27.3, 0.50],
    [-14.8, GOD_RAY_SURFACE_START_Y, -8.2, 1.7, 19.8, GOD_RAY_LEFT_ANGLE, 0.12, 31.6, 0.62],
    [-8.8, GOD_RAY_SURFACE_START_Y, -12.8, 1.2, 23.2, GOD_RAY_LEFT_ANGLE, 0.10, 36.4, 0.54],
    [-0.2, GOD_RAY_SURFACE_START_Y, -15.2, 1.0, 24.0, GOD_RAY_LEFT_ANGLE, 0.09, 42.1, 0.48],
    [10.6, GOD_RAY_SURFACE_START_Y, -8.8, 1.6, 20.6, GOD_RAY_LEFT_ANGLE, 0.12, 47.8, 0.68],
    [13.8, GOD_RAY_SURFACE_START_Y, -13.6, 1.1, 23.6, GOD_RAY_LEFT_ANGLE, 0.09, 53.2, 0.52],
  ], [])

  return rays.map(([x, surfaceY, z, width, height, rotation, strength, seed, fadeLength]) => (
    <LightRay key={seed} x={x} surfaceY={surfaceY} z={z} width={width} height={height} rotation={rotation} strength={strength} seed={seed} fadeLength={fadeLength} />
  ))
}

function SurfaceFoam() {
  const material = useRef()
  const uniforms = useMemo(() => ({ uTime: { value: 0 } }), [])

  useFrame(({ clock }) => {
    if (material.current) material.current.uniforms.uTime.value = clock.getElapsedTime()
  })

  return (
    <mesh position={[0, 3.72, 5.35]} raycast={() => null}>
      <planeGeometry args={[27.5, 2.25, 1, 1]} />
      <shaderMaterial
        ref={material}
        uniforms={uniforms}
        vertexShader={BASIC_VERTEX}
        fragmentShader={SURFACE_FRAGMENT}
        transparent
        depthWrite={false}
        depthTest={false}
        blending={THREE.AdditiveBlending}
      />
    </mesh>
  )
}

export default function UnderwaterFX({ biome = 'ocean' }) {
  if (biome !== 'ocean') return null

  return (
    <group>
      <LightRays />
      {/* Surface shimmer now lives in WaterSurface; keep this disabled to avoid a duplicate mid-screen horizon band. */}
    </group>
  )
}
