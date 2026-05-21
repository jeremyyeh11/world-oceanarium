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

  vec2 perlinGradient(vec2 p) {
    float angle = hash(p) * 6.28318530718;
    return vec2(cos(angle), sin(angle));
  }

  float perlinNoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);

    float a = dot(perlinGradient(i + vec2(0.0, 0.0)), f - vec2(0.0, 0.0));
    float b = dot(perlinGradient(i + vec2(1.0, 0.0)), f - vec2(1.0, 0.0));
    float c = dot(perlinGradient(i + vec2(0.0, 1.0)), f - vec2(0.0, 1.0));
    float d = dot(perlinGradient(i + vec2(1.0, 1.0)), f - vec2(1.0, 1.0));

    return mix(mix(a, b, u.x), mix(c, d, u.x), u.y) * 0.5 + 0.5;
  }

  void main() {
    vec2 uv = vUv;

    // Diagnostic only: show the large Perlin mask in obvious green/black
    // before using it to make the caustics more occasional in the next pass.
    float largePerlin = perlinNoise(uv * vec2(6.4, 2.9) + vec2(uTime * 0.018, -uTime * 0.010));
    float mask = smoothstep(0.44, 0.60, largePerlin);
    float softAlpha = 0.82;
    vec3 maskColor = mix(vec3(0.0, 0.0, 0.0), vec3(0.0, 1.0, 0.12), mask);
    gl_FragColor = vec4(maskColor, softAlpha);
    return;

    // Stretch noise horizontally so the ceiling reads as broken shimmer streaks,
    // not broad cloud blobs. Two offset bands slide against each other cheaply.
    vec2 bandUvA = uv * vec2(78.0, 15.6) + vec2(uTime * 0.045, uTime * 0.010);
    vec2 bandUvB = uv * vec2(174.0, 25.2) + vec2(-uTime * 0.085, uTime * 0.026);
    float bandsA = fbm(bandUvA);
    float bandsB = noise(bandUvB);
    float fine = noise(uv * vec2(354.0, 48.0) + vec2(uTime * 0.16, -uTime * 0.035));

    // Cross-panned interference layer: two different procedural noise fields
    // slide in opposing directions, then multiply into a sharper caustic mask.
    // This mask drives the main color lerp so the surface reads less like one
    // blob texture and more like moving water interference.
    float crossNoiseA = noise(uv * vec2(96.0, 21.0) + vec2(uTime * 0.070, -uTime * 0.018));
    float crossNoiseB = noise(uv * vec2(41.0, 33.0) + vec2(-uTime * 0.052, uTime * 0.034));
    float interference = crossNoiseA * crossNoiseB;
    float causticLerp = smoothstep(0.16, 0.58, interference);

    float longBreaks = smoothstep(0.38, 0.82, bandsA);
    float thinStreaks = smoothstep(0.46, 0.98, bandsB + bandsA * 0.18);
    float pinGlints = smoothstep(0.58, 1.08, fine + bandsB * 0.26);
    float shimmer = longBreaks * 0.32 + thinStreaks * 0.42 + causticLerp * 0.40 + pinGlints * 0.18;

    // Stronger lower dissolve keeps the bottom edge from becoming a horizon band.
    float farEdge = smoothstep(0.05, 0.20, uv.y);
    float bottomFade = 1.0 - smoothstep(0.34, 0.68, uv.y);
    float sideFade = smoothstep(0.0, 0.08, uv.x) * smoothstep(1.0, 0.08, 1.0 - uv.x);
    float streakMask = farEdge * bottomFade * sideFade;

    vec3 deepCyan = vec3(0.02, 0.26, 0.40);
    vec3 brightCyan = vec3(0.18, 0.82, 1.0);
    vec3 whiteGlint = vec3(0.92, 1.0, 0.96);
    vec3 color = mix(deepCyan, brightCyan, causticLerp);
    color = mix(color, brightCyan, clamp(longBreaks * 0.18 + thinStreaks * 0.32, 0.0, 1.0));
    color = mix(color, whiteGlint, pinGlints * 0.34 + causticLerp * 0.12);

    float alpha = (0.025 + shimmer * 0.13 + pinGlints * 0.04) * streakMask;
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
          blending={THREE.NormalBlending}
          side={THREE.DoubleSide}
        />
      </mesh>
    </group>
  )
}
