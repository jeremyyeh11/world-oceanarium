import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

const CAUSTIC_VERTEX = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const CAUSTIC_FRAGMENT = /* glsl */ `
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
    float amp = 0.55;
    for (int i = 0; i < 4; i++) {
      value += amp * noise(p);
      p = mat2(1.58, -1.06, 1.06, 1.58) * p + 5.7;
      amp *= 0.52;
    }
    return value;
  }

  void main() {
    vec2 uv = vUv;
    vec2 driftA = vec2(uTime * 0.035, -uTime * 0.022);
    vec2 driftB = vec2(-uTime * 0.018, uTime * 0.031);
    float a = fbm(uv * vec2(8.0, 5.2) + driftA);
    float b = fbm(uv * vec2(10.0, 6.4) + driftB);
    float web = abs(fract((a + b) * 6.3) - 0.5);
    float line = smoothstep(0.105, 0.015, web);
    float surfaceMask = smoothstep(0.15, 0.95, uv.y);
    float centerMask = smoothstep(0.0, 0.28, uv.x) * smoothstep(1.0, 0.72, uv.x);
    float alpha = line * surfaceMask * centerMask * 0.115;
    gl_FragColor = vec4(0.58, 0.90, 1.0, alpha);
  }
`

const RAY_VERTEX = /* glsl */ `
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
    float horizontal = smoothstep(0.0, 0.42, vUv.x) * smoothstep(1.0, 0.58, vUv.x);
    float vertical = pow(1.0 - vUv.y, 1.55);
    float shimmer = 0.72 + noise(vec2(vUv.x * 2.5 + uSeed, vUv.y * 5.0 - uTime * 0.28)) * 0.34;
    float alpha = horizontal * vertical * shimmer * uStrength;
    gl_FragColor = vec4(0.62, 0.86, 1.0, alpha);
  }
`

function LightRay({ x, z, width, height, rotation, strength, seed }) {
  const material = useRef()
  const uniforms = useMemo(() => ({
    uTime: { value: 0 },
    uSeed: { value: seed },
    uStrength: { value: strength },
  }), [seed, strength])

  useFrame(({ clock }) => {
    if (!material.current) return
    const time = clock.getElapsedTime()
    material.current.uniforms.uTime.value = time
  })

  return (
    <mesh position={[x, -4.4, z]} rotation={[0, 0, rotation]} raycast={() => null}>
      <planeGeometry args={[width, height, 1, 1]} />
      <shaderMaterial
        ref={material}
        uniforms={uniforms}
        vertexShader={RAY_VERTEX}
        fragmentShader={RAY_FRAGMENT}
        transparent
        depthWrite={false}
        depthTest={false}
        blending={THREE.AdditiveBlending}
        side={THREE.DoubleSide}
      />
    </mesh>
  )
}

function LightRays() {
  const rays = useMemo(() => [
    [-8.0, -3.8, 2.3, 18.5, -0.18, 0.060, 1.1],
    [-5.4, 1.8, 1.7, 16.0, 0.11, 0.044, 2.7],
    [-2.4, -1.2, 2.6, 20.0, -0.08, 0.056, 4.3],
    [0.4, 3.2, 1.8, 17.0, 0.16, 0.040, 5.9],
    [3.3, -4.2, 2.4, 18.0, -0.14, 0.050, 7.4],
    [6.8, 1.0, 2.1, 16.5, 0.09, 0.038, 8.6],
  ], [])

  return rays.map(([x, z, width, height, rotation, strength, seed]) => (
    <LightRay key={seed} x={x} z={z} width={width} height={height} rotation={rotation} strength={strength} seed={seed} />
  ))
}

function CausticsOverlay() {
  const material = useRef()
  const uniforms = useMemo(() => ({ uTime: { value: 0 } }), [])

  useFrame(({ clock }) => {
    if (material.current) material.current.uniforms.uTime.value = clock.getElapsedTime()
  })

  return (
    <mesh position={[0, 0, 5.2]} raycast={() => null}>
      <planeGeometry args={[26, 14.6, 1, 1]} />
      <shaderMaterial
        ref={material}
        uniforms={uniforms}
        vertexShader={CAUSTIC_VERTEX}
        fragmentShader={CAUSTIC_FRAGMENT}
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
      <CausticsOverlay />
    </group>
  )
}
