import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { hashString } from '../utils/hash'

const SURFACE_VERTEX = /* glsl */ `
  varying vec2 vUv;

  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const SURFACE_FRAGMENT = /* glsl */ `
  uniform float uTime;
  uniform vec2 uSeed;
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
    // uSeed offsets the noise domain per tank so each tank's caustics read as a
    // different stretch of water. Screen-position fades below still use raw uv.
    vec2 patternUv = vec2(uv.x * 3.0, uv.y) + uSeed;

    // Large Perlin mask makes the fake caustics occasional: bright streaks
    // appear mostly in mask-active regions, while inactive regions stay darker.
    float largePerlin = perlinNoise(patternUv * vec2(12.8, 5.8) + vec2(uTime * 0.036, -uTime * 0.020));
    float occasionMask = smoothstep(0.46, 0.64, largePerlin);

    // Stretch noise horizontally so the ceiling reads as broken shimmer streaks,
    // not broad cloud blobs. Two offset bands slide against each other cheaply.
    vec2 bandUvA = patternUv * vec2(78.0, 15.6) + vec2(uTime * 0.090, uTime * 0.020);
    vec2 bandUvB = patternUv * vec2(174.0, 25.2) + vec2(-uTime * 0.170, uTime * 0.052);
    float bandsA = fbm(bandUvA);
    float bandsB = noise(bandUvB);
    float fine = noise(patternUv * vec2(354.0, 48.0) + vec2(uTime * 0.320, -uTime * 0.070));

    // Cross-panned interference layer: two different procedural noise fields
    // slide in opposing directions, then multiply into a sharper caustic mask.
    // This mask drives the main color lerp so the surface reads less like one
    // blob texture and more like moving water interference.
    float crossNoiseA = noise(patternUv * vec2(96.0, 21.0) + vec2(uTime * 0.140, -uTime * 0.036));
    float crossNoiseB = noise(patternUv * vec2(41.0, 33.0) + vec2(-uTime * 0.104, uTime * 0.068));
    float interference = crossNoiseA * crossNoiseB;
    float causticLerp = smoothstep(0.16, 0.58, interference);

    float longBreaks = smoothstep(0.38, 0.82, bandsA);
    float thinStreaks = smoothstep(0.46, 0.98, bandsB + bandsA * 0.18);
    float pinGlints = smoothstep(0.58, 1.08, fine + bandsB * 0.26);
    float maskDim = mix(0.34, 1.0, occasionMask);
    // Sparse glints sit on top of the approved shimmer. Strong domain warp
    // bends the line field so it breaks into uneven patches instead of straight
    // uniform bands.
    float glintWarp = fbm(patternUv * vec2(7.4, 3.2) + vec2(uTime * 0.020, -uTime * 0.014));
    float glintBreaker = noise(patternUv * vec2(18.0, 4.6) + vec2(-uTime * 0.075, uTime * 0.026));
    float glintWarpB = fbm(patternUv * vec2(13.0, 6.8) + vec2(-uTime * 0.035, uTime * 0.022));
    vec2 glintUv = patternUv + vec2((glintWarp - 0.5) * 0.165 + (glintBreaker - 0.5) * 0.055, (glintWarpB - 0.5) * 0.130 + (glintBreaker - 0.5) * 0.070);
    float bendPhase = (glintWarp - 0.5) * 6.2 + (glintWarpB - 0.5) * 4.6 + (glintBreaker - 0.5) * 2.4;
    float glintA = sin(glintUv.x * 82.0 + glintUv.y * 17.0 + bendPhase + uTime * 0.42) * 0.5 + 0.5;
    float glintB = sin(glintUv.x * -37.0 + glintUv.y * 31.0 - bendPhase * 0.62 - uTime * 0.27) * 0.5 + 0.5;
    float glintDepth = smoothstep(0.015, 0.090, uv.y) * (1.0 - smoothstep(0.36, 0.62, uv.y));
    float glintPatches = smoothstep(0.64, 0.88, glintA) * smoothstep(0.36, 0.80, glintB + glintBreaker * 0.28);
    float surfaceGlints = glintPatches * glintDepth * smoothstep(0.38, 0.72, largePerlin);

    float maskedCaustic = causticLerp * maskDim;
    float maskedStreaks = thinStreaks * mix(0.38, 1.0, occasionMask);
    float maskedGlints = pinGlints * mix(0.18, 1.0, occasionMask);
    float shimmer = longBreaks * 0.12 + maskedStreaks * 0.50 + maskedCaustic * 0.58 + maskedGlints * 0.24 + surfaceGlints * 0.62;


    // Stronger lower dissolve keeps the bottom edge from becoming a horizon band.
    // Raised the far-edge onset (0.05→0.13) so the most distant strip of the ceiling
    // dissolves earlier, pulling the visible shimmer band nearer and stopping the far
    // surface from reading as a heavy slab across the top of frame.
    float farEdge = smoothstep(0.13, 0.28, uv.y);
    float bottomFade = 1.0 - smoothstep(0.34, 0.68, uv.y);
    float sideFade = smoothstep(0.0, 0.08, uv.x) * smoothstep(1.0, 0.08, 1.0 - uv.x);
    float streakMask = farEdge * bottomFade * sideFade;

    vec3 deepCyan = vec3(0.01, 0.19, 0.30);
    vec3 brightCyan = vec3(0.22, 0.92, 1.0);
    vec3 whiteGlint = vec3(0.98, 1.0, 0.96);
    vec3 darkWater = vec3(0.0, 0.035, 0.065);
    vec3 color = mix(darkWater, deepCyan, 0.18 + occasionMask * 0.62);
    color = mix(color, brightCyan, clamp(maskedCaustic * 0.90 + maskedStreaks * 0.48, 0.0, 1.0));
    color = mix(color, whiteGlint, maskedGlints * 0.42 + maskedCaustic * 0.18 + surfaceGlints * 0.68);
    color *= 0.8;

    float alpha = (0.035 + occasionMask * 0.09 + shimmer * 0.17 + maskedGlints * 0.055 + surfaceGlints * 0.185) * streakMask;
    gl_FragColor = vec4(color, alpha);
  }
`

export const SURFACE_PLANE_Y = 4.6
export const SURFACE_PLANE_X = 0
export const SURFACE_PLANE_Z = -4
export const SURFACE_PLANE_WIDTH = 210
export const SURFACE_PLANE_DEPTH = 32

const SURFACE_PLANE_POSITION = [SURFACE_PLANE_X, SURFACE_PLANE_Y, SURFACE_PLANE_Z]
const SURFACE_PLANE_ROTATION = [-Math.PI / 2, 0, 0]
const SURFACE_PLANE_SIZE = [SURFACE_PLANE_WIDTH, SURFACE_PLANE_DEPTH, 1, 1]

function seedOffset(seed) {
  const h = hashString(`tank-surface:${seed}`)
  return [(h & 0xffff) / 0xffff * 100, ((h >>> 16) & 0xffff) / 0xffff * 100]
}

export default function WaterSurface({ seed = 0 }) {
  const material = useRef()
  const uniforms = useMemo(() => ({ uTime: { value: 0 }, uSeed: { value: new THREE.Vector2() } }), [])

  useEffect(() => {
    const [x, y] = seedOffset(seed)
    uniforms.uSeed.value.set(x, y)
  }, [seed, uniforms])

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
