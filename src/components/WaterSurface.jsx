import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

const SURFACE_VERTEX = /* glsl */ `
  varying vec2 vUv;

  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
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
    float amp = 0.58;
    for (int i = 0; i < 4; i++) {
      value += amp * noise(p);
      p = mat2(1.68, -0.74, 0.74, 1.68) * p + 5.3;
      amp *= 0.52;
    }
    return value;
  }

  void main() {
    vec2 uv = vUv;

    // Stretch noise horizontally so the ceiling reads as broken shimmer streaks,
    // not broad cloud blobs. Two offset bands slide against each other cheaply.
    vec2 bandUvA = uv * vec2(78.0, 15.6) + vec2(uTime * 0.045, uTime * 0.010);
    vec2 bandUvB = uv * vec2(174.0, 25.2) + vec2(-uTime * 0.085, uTime * 0.026);
    float bandsA = fbm(bandUvA);
    float bandsB = noise(bandUvB);
    float fine = noise(uv * vec2(354.0, 48.0) + vec2(uTime * 0.16, -uTime * 0.035));

    float longBreaks = smoothstep(0.38, 0.82, bandsA);
    float thinStreaks = smoothstep(0.46, 0.98, bandsB + bandsA * 0.18);
    float pinGlints = smoothstep(0.58, 1.08, fine + bandsB * 0.26);
    float shimmer = longBreaks * 0.42 + thinStreaks * 0.54 + pinGlints * 0.22;

    // Stronger lower dissolve keeps the bottom edge from becoming a horizon band.
    float farEdge = smoothstep(0.05, 0.20, uv.y);
    float bottomFade = 1.0 - smoothstep(0.34, 0.68, uv.y);
    float sideFade = smoothstep(0.0, 0.08, uv.x) * smoothstep(1.0, 0.08, 1.0 - uv.x);
    float streakMask = farEdge * bottomFade * sideFade;

    vec3 deepCyan = vec3(0.02, 0.26, 0.40);
    vec3 brightCyan = vec3(0.18, 0.82, 1.0);
    vec3 whiteGlint = vec3(0.92, 1.0, 0.96);
    vec3 color = mix(deepCyan, brightCyan, clamp(longBreaks * 0.36 + thinStreaks * 0.54, 0.0, 1.0));
    color = mix(color, whiteGlint, pinGlints * 0.42);

    float alpha = (0.03 + shimmer * 0.14 + pinGlints * 0.05) * streakMask;
    gl_FragColor = vec4(color, alpha);
  }
`

const SURFACE_PLANE_POSITION = [0, 4.6, -4]
const SURFACE_PLANE_ROTATION = [-Math.PI / 2, 0, 0]
const SURFACE_PLANE_SIZE = [70, 32, 1, 1]

export default function WaterSurface() {
  const material = useRef()
  const uniforms = useMemo(() => ({ uTime: { value: 0 } }), [])

  useFrame(({ clock }) => {
    if (material.current) material.current.uniforms.uTime.value = clock.getElapsedTime()
  })

  return (
    <group>
      <mesh position={SURFACE_PLANE_POSITION} rotation={SURFACE_PLANE_ROTATION} raycast={() => null}>
        <planeGeometry args={SURFACE_PLANE_SIZE} />
        <shaderMaterial
          ref={material}
          uniforms={uniforms}
          vertexShader={SURFACE_VERTEX}
          fragmentShader={SURFACE_FRAGMENT}
          transparent
          depthWrite={false}
          depthTest={false}
          blending={THREE.AdditiveBlending}
          side={THREE.DoubleSide}
        />
      </mesh>
      <mesh position={SURFACE_PLANE_POSITION} rotation={SURFACE_PLANE_ROTATION} raycast={() => null}>
        <planeGeometry args={SURFACE_PLANE_SIZE} />
        <meshBasicMaterial
          color="#7ff4ff"
          transparent
          opacity={0.88}
          wireframe
          depthWrite={false}
          depthTest={false}
        />
      </mesh>
    </group>
  )
}
