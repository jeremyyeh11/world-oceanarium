import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

const GOD_RAY_DIAGNOSTIC_WIREFRAME = true
const GOD_RAY_LEFT_ANGLE = -Math.PI / 12

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
    // Plane UV top is visually inverted in the current camera/stage setup, so the
    // ray source is vUv.y = 0. Keep rays brightest above the screen and fade down.
    float fromSource = 1.0 - vUv.y;
    float halfWidth = mix(0.28, 0.72, fromSource);
    float feather = mix(0.72, 1.05, vUv.y);
    float center = 1.0 - smoothstep(halfWidth, halfWidth + feather, abs(vUv.x - 0.5));
    float sideFade = smoothstep(0.0, 0.24, vUv.x) * smoothstep(1.0, 0.76, vUv.x);
    float topFade = smoothstep(0.0, 0.26, fromSource);
    float bottomFade = smoothstep(1.0, 0.28, vUv.y);
    float vertical = pow(fromSource, 3.15) * topFade * bottomFade;
    float shimmer = 0.78 + noise(vec2(vUv.x * 1.35 + uSeed, vUv.y * 2.4 - uTime * 0.06)) * 0.16;
    float alpha = center * sideFade * vertical * shimmer * uStrength * 0.18;
    gl_FragColor = vec4(0.32, 0.62, 0.78, alpha);
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

function LightRay({ x, y = 4.9, z, width, height, rotation, strength, seed }) {
  const material = useRef()
  const uniforms = useMemo(() => ({
    uTime: { value: 0 },
    uSeed: { value: seed },
    uStrength: { value: GOD_RAY_DIAGNOSTIC_WIREFRAME ? 0.85 : strength },
  }), [seed, strength])

  useFrame(({ clock }) => {
    if (!material.current) return
    material.current.uniforms.uTime.value = clock.getElapsedTime()
  })

  return (
    <mesh position={[x, y, z]} rotation={[0, 0, rotation]} raycast={() => null}>
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
        wireframe={GOD_RAY_DIAGNOSTIC_WIREFRAME}
      />
    </mesh>
  )
}

function LightRays() {
  const rays = useMemo(() => [
    [-7.6, 4.9, -8.4, 9.8, 26.0, GOD_RAY_LEFT_ANGLE, 0.020, 1.1],
    [3.2, 4.85, -8.8, 10.8, 27.5, GOD_RAY_LEFT_ANGLE, 0.018, 7.4],
  ], [])

  return rays.map(([x, y, z, width, height, rotation, strength, seed]) => (
    <LightRay key={seed} x={x} y={y} z={z} width={width} height={height} rotation={rotation} strength={strength} seed={seed} />
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
