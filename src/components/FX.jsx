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
  uniform vec3 uColor;
  uniform float uAlpha;
  varying vec2 vUv;

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
  }

  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(hash(i + vec2(0.0, 0.0)), hash(i + vec2(1.0, 0.0)), u.x),
      mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
      u.y
    );
  }

  float fbm(vec2 p) {
    float v = 0.0;
    float a = 0.5;
    for (int i = 0; i < 5; i++) {
      v += a * noise(p);
      p = mat2(1.62, -1.18, 1.18, 1.62) * p + 13.7;
      a *= 0.52;
    }
    return v;
  }

  void main() {
    vec2 uv = vUv;
    vec2 driftA = vec2(uTime * 0.055, -uTime * 0.03);
    vec2 driftB = vec2(-uTime * 0.035, uTime * 0.045);

    float n1 = fbm(uv * vec2(8.0, 5.5) + driftA);
    float n2 = fbm(uv * vec2(14.0, 9.0) + driftB);
    float web = abs(sin((n1 - n2) * 18.0 + uv.y * 8.0 + uTime * 0.9));
    float lines = smoothstep(0.80, 0.985, web);
    float shimmer = smoothstep(0.58, 1.0, n1) * 0.28;
    float surfaceFalloff = smoothstep(1.0, 0.10, uv.y);
    float edgeFade = smoothstep(0.0, 0.12, uv.x) * smoothstep(1.0, 0.88, uv.x);

    float alpha = (lines + shimmer) * surfaceFalloff * edgeFade * uAlpha;
    gl_FragColor = vec4(uColor * (0.65 + lines * 0.9), alpha);
  }
`

const SHAFT_FRAGMENT = /* glsl */ `
  uniform float uTime;
  uniform vec3 uColor;
  uniform float uAlpha;
  varying vec2 vUv;

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(41.3, 289.1))) * 19837.231);
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
    float center = 1.0 - smoothstep(0.0, 0.48, abs(vUv.x - 0.5));
    float vertical = smoothstep(0.0, 0.18, vUv.y) * smoothstep(1.0, 0.18, vUv.y);
    float pulse = 0.76 + noise(vec2(vUv.x * 2.0 + uTime * 0.08, uTime * 0.035)) * 0.34;
    float alpha = center * vertical * pulse * uAlpha;
    gl_FragColor = vec4(uColor, alpha);
  }
`

function makeUniforms(color, alpha) {
  return {
    uTime: { value: 0 },
    uColor: { value: new THREE.Color(color) },
    uAlpha: { value: alpha },
  }
}

function CausticPlane({ biome }) {
  const material = useRef()
  const color = biome === 'tropical-river' ? '#75ffd0' : '#58f3ff'
  const uniforms = useMemo(() => makeUniforms(color, biome === 'tropical-river' ? 0.26 : 0.34), [color, biome])

  useFrame(({ clock }) => {
    if (material.current) material.current.uniforms.uTime.value = clock.getElapsedTime()
  })

  return (
    <mesh position={[0, -3.5, 1.4]} raycast={() => null}>
      <planeGeometry args={[24, 18, 1, 1]} />
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

function LightShaft({ x, y, z, width, height, rotation, alpha, color }) {
  const material = useRef()
  const uniforms = useMemo(() => makeUniforms(color, alpha), [color, alpha])

  useFrame(({ clock }) => {
    if (material.current) material.current.uniforms.uTime.value = clock.getElapsedTime()
  })

  return (
    <mesh position={[x, y, z]} rotation={[0, 0, rotation]} raycast={() => null}>
      <planeGeometry args={[width, height, 1, 1]} />
      <shaderMaterial
        ref={material}
        uniforms={uniforms}
        vertexShader={CAUSTIC_VERTEX}
        fragmentShader={SHAFT_FRAGMENT}
        transparent
        depthWrite={false}
        depthTest={false}
        blending={THREE.AdditiveBlending}
      />
    </mesh>
  )
}

export default function FX({ biome = 'ocean' }) {
  const color = biome === 'tropical-river' ? '#78ffd1' : '#62f7ff'
  const shafts = biome === 'tropical-river'
    ? [
        [-5.8, -2.4, 0.9, 4.4, 12, -0.28, 0.09],
        [0.2, -3.3, 1.0, 5.2, 14, 0.18, 0.08],
        [5.6, -2.7, 0.8, 4.0, 11, 0.34, 0.07],
      ]
    : [
        [-6.8, -8.0, 0.9, 5.6, 24, -0.24, 0.105],
        [-0.8, -10.5, 1.0, 6.8, 28, 0.12, 0.095],
        [6.2, -8.6, 0.8, 5.4, 24, 0.30, 0.08],
      ]

  return (
    <group>
      <CausticPlane biome={biome} />
      {shafts.map(([x, y, z, width, height, rotation, alpha], i) => (
        <LightShaft key={i} x={x} y={y} z={z} width={width} height={height} rotation={rotation} alpha={alpha} color={color} />
      ))}
    </group>
  )
}
