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

    // Large Perlin mask makes the fake caustics occasional: bright streaks
    // appear mostly in mask-active regions, while inactive regions stay darker.
    float largePerlin = perlinNoise(uv * vec2(12.8, 5.8) + vec2(uTime * 0.036, -uTime * 0.020));
    float occasionMask = smoothstep(0.46, 0.64, largePerlin);

    // Stretch noise horizontally so the ceiling reads as broken shimmer streaks,
    // not broad cloud blobs. Two offset bands slide against each other cheaply.
    vec2 bandUvA = uv * vec2(78.0, 15.6) + vec2(uTime * 0.090, uTime * 0.020);
    vec2 bandUvB = uv * vec2(174.0, 25.2) + vec2(-uTime * 0.170, uTime * 0.052);
    float bandsA = fbm(bandUvA);
    float bandsB = noise(bandUvB);
    float fine = noise(uv * vec2(354.0, 48.0) + vec2(uTime * 0.320, -uTime * 0.070));

    // Cross-panned interference layer: two different procedural noise fields
    // slide in opposing directions, then multiply into a sharper caustic mask.
    // This mask drives the main color lerp so the surface reads less like one
    // blob texture and more like moving water interference.
    float crossNoiseA = noise(uv * vec2(96.0, 21.0) + vec2(uTime * 0.140, -uTime * 0.036));
    float crossNoiseB = noise(uv * vec2(41.0, 33.0) + vec2(-uTime * 0.104, uTime * 0.068));
    float interference = crossNoiseA * crossNoiseB;
    float causticLerp = smoothstep(0.16, 0.58, interference);

    float longBreaks = smoothstep(0.38, 0.82, bandsA);
    float thinStreaks = smoothstep(0.46, 0.98, bandsB + bandsA * 0.18);
    float pinGlints = smoothstep(0.58, 1.08, fine + bandsB * 0.26);
    float maskDim = mix(0.34, 1.0, occasionMask);
    float maskedCaustic = causticLerp * maskDim;
    float maskedStreaks = thinStreaks * mix(0.38, 1.0, occasionMask);
    float maskedGlints = pinGlints * mix(0.18, 1.0, occasionMask);
    float shimmer = longBreaks * 0.12 + maskedStreaks * 0.50 + maskedCaustic * 0.58 + maskedGlints * 0.24;

    // Soft surface-shadow bands: slow dark ripple occlusion under the bright ceiling.
    // This makes the source water feel less uniformly lit without adding geometry.
    float shadowNoiseA = fbm(uv * vec2(12.0, 4.2) + vec2(-uTime * 0.044, uTime * 0.018));
    float shadowNoiseB = noise(uv * vec2(28.0, 7.4) + vec2(uTime * 0.072, -uTime * 0.026));
    float shadowBands = smoothstep(0.48, 0.76, shadowNoiseA * 0.72 + shadowNoiseB * 0.36);
    float shadowMask = shadowBands * smoothstep(0.0, 0.18, uv.y) * (1.0 - smoothstep(0.58, 0.94, uv.y));

    // Stronger lower dissolve keeps the bottom edge from becoming a horizon band.
    float farEdge = smoothstep(0.05, 0.20, uv.y);
    float bottomFade = 1.0 - smoothstep(0.34, 0.68, uv.y);
    float sideFade = smoothstep(0.0, 0.08, uv.x) * smoothstep(1.0, 0.08, 1.0 - uv.x);
    float streakMask = farEdge * bottomFade * sideFade;

    vec3 deepCyan = vec3(0.01, 0.19, 0.30);
    vec3 brightCyan = vec3(0.22, 0.92, 1.0);
    vec3 whiteGlint = vec3(0.98, 1.0, 0.96);
    vec3 darkWater = vec3(0.0, 0.035, 0.065);
    vec3 color = mix(darkWater, deepCyan, 0.18 + occasionMask * 0.62);
    color = mix(color, brightCyan, clamp(maskedCaustic * 0.90 + maskedStreaks * 0.48, 0.0, 1.0));
    color = mix(color, whiteGlint, maskedGlints * 0.42 + maskedCaustic * 0.18);
    color *= mix(1.0, 0.62, shadowMask);
    color *= 0.8;

    float alpha = (0.035 + occasionMask * 0.09 + shimmer * 0.17 + maskedGlints * 0.055) * streakMask * mix(1.0, 0.74, shadowMask);
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
          depthTest
          blending={THREE.NormalBlending}
          side={THREE.DoubleSide}
        />
      </mesh>
    </group>
  )
}
