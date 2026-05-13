import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

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
    // Plane UV top is visually inverted in the current camera/stage setup, so the
    // ray source is vUv.y = 0. Keep rays brightest above the screen and fade down.
    float fromSource = 1.0 - vUv.y;
    float halfWidth = mix(0.20, 0.56, fromSource);
    float feather = mix(0.30, 0.52, vUv.y);
    float center = 1.0 - smoothstep(halfWidth, halfWidth + feather, abs(vUv.x - 0.5));
    float topFade = smoothstep(0.02, 0.18, fromSource);
    float bottomFade = smoothstep(1.0, 0.46, vUv.y);
    float vertical = pow(fromSource, 2.35) * topFade * bottomFade;
    float shimmer = 0.76 + noise(vec2(vUv.x * 2.0 + uSeed, vUv.y * 4.0 - uTime * 0.18)) * 0.22;
    float alpha = center * vertical * shimmer * uStrength * 0.58;
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
    material.current.uniforms.uTime.value = clock.getElapsedTime()
  })

  return (
    <mesh position={[x, 4.8, z]} rotation={[0, 0, rotation]} raycast={() => null}>
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
    [-9.2, -3.8, 5.8, 25.5, -0.18, 0.036, 1.1],
    [-5.8, 1.8, 4.8, 23.5, 0.11, 0.026, 2.7],
    [-2.2, -1.2, 6.4, 27.0, -0.08, 0.034, 4.3],
    [1.2, 3.2, 5.1, 24.5, 0.16, 0.025, 5.9],
    [4.7, -4.2, 6.0, 25.5, -0.14, 0.030, 7.4],
    [8.4, 1.0, 5.4, 23.8, 0.09, 0.023, 8.6],
  ], [])

  return rays.map(([x, z, width, height, rotation, strength, seed]) => (
    <LightRay key={seed} x={x} z={z} width={width} height={height} rotation={rotation} strength={strength} seed={seed} />
  ))
}

export default function UnderwaterFX({ biome = 'ocean' }) {
  if (biome !== 'ocean') return null

  return <LightRays />
}
