import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

const BUBBLE_COUNT = 24
const SPREAD_X = 18
const MIN_Y = -7.5
const MAX_Y = 5
const SPREAD_Z = 7
const MIN_LIFETIME = 2.1
const MAX_LIFETIME = 3.8

const VERTEX_SHADER = /* glsl */ `
  attribute float aBaseSize;
  attribute float aLifeScale;
  uniform float uSizeScale;
  varying float vAlpha;

  void main() {
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mvPosition;

    float perspective = 42.0 / max(1.0, -mvPosition.z);
    gl_PointSize = aBaseSize * uSizeScale * aLifeScale * perspective;
    vAlpha = smoothstep(0.0, 0.18, aLifeScale);
  }
`

const FRAGMENT_SHADER = /* glsl */ `
  uniform float uOpacityScale;
  varying float vAlpha;

  void main() {
    vec2 uv = gl_PointCoord - 0.5;
    float dist = length(uv);
    float shell = smoothstep(0.5, 0.34, dist);
    float rim = smoothstep(0.34, 0.48, dist) * 0.45;
    float highlight = smoothstep(0.13, 0.0, length(uv - vec2(-0.16, 0.15))) * 0.55;
    float alpha = (shell * 0.18 + rim + highlight) * vAlpha * 0.34 * uOpacityScale;

    if (dist > 0.5 || alpha < 0.01) discard;
    gl_FragColor = vec4(0.74, 0.94, 1.0, alpha);
  }
`

function randomRange(min, max) {
  return min + Math.random() * (max - min)
}

function lifeCurve(age01) {
  // Requested curve: 5y = ln(-x + 1) + 4, with x as normalized lifetime.
  // Clamp x before 1.0 so the logarithmic tail fades out cleanly instead of going -Infinity.
  const x = Math.min(age01, 0.982)
  return Math.max(0, (Math.log(1 - x) + 4) / 5)
}

function respawn(index, positions, baseSizes, lifeScales, ages, lifetimes, velocities, initial = false) {
  const j = index * 3
  positions[j] = randomRange(-SPREAD_X / 2, SPREAD_X / 2)
  positions[j + 1] = initial ? randomRange(MIN_Y, MAX_Y) : MIN_Y + randomRange(-1.2, 0.8)
  positions[j + 2] = randomRange(-SPREAD_Z / 2, SPREAD_Z / 2)
  baseSizes[index] = randomRange(1.2, 2.6)
  lifetimes[index] = randomRange(MIN_LIFETIME, MAX_LIFETIME)
  ages[index] = initial ? randomRange(0, lifetimes[index] * 0.82) : 0
  lifeScales[index] = initial ? lifeCurve(ages[index] / lifetimes[index]) : 0
  velocities[index] = randomRange(0.85, 1.85)
}

export default function OceanBubbles({ count = BUBBLE_COUNT, depthTest = true, opacityScale = 1, renderOrder = 0, sizeScale = 1 }) {
  const pointsRef = useRef()
  const state = useRef(null)

  const attributes = useMemo(() => {
    const positions = new Float32Array(count * 3)
    const baseSizes = new Float32Array(count)
    const lifeScales = new Float32Array(count)
    const ages = new Float32Array(count)
    const lifetimes = new Float32Array(count)
    const velocities = new Float32Array(count)

    for (let i = 0; i < count; i += 1) {
      respawn(i, positions, baseSizes, lifeScales, ages, lifetimes, velocities, true)
    }

    state.current = { ages, lifetimes, velocities }
    return { positions, baseSizes, lifeScales }
  }, [count])

  useFrame(({ clock }, delta) => {
    const points = pointsRef.current
    if (!points || !state.current) return

    const posAttr = points.geometry.attributes.position
    const scaleAttr = points.geometry.attributes.aLifeScale
    const pos = posAttr.array
    const lifeScales = scaleAttr.array
    const { ages, lifetimes, velocities } = state.current
    const t = clock.getElapsedTime()

    for (let i = 0; i < count; i += 1) {
      ages[i] += delta

      if (ages[i] < 0) {
        lifeScales[i] = 0
        continue
      }

      const normalizedAge = ages[i] / lifetimes[i]
      if (normalizedAge >= 1 || pos[i * 3 + 1] > MAX_Y) {
        respawn(i, pos, points.geometry.attributes.aBaseSize.array, lifeScales, ages, lifetimes, velocities)
        continue
      }

      const j = i * 3
      pos[j + 1] += velocities[i] * delta
      pos[j] += Math.sin(t * 0.7 + i * 1.71) * delta * 0.045
      pos[j + 2] += Math.cos(t * 0.5 + i * 2.13) * delta * 0.035
      lifeScales[i] = lifeCurve(normalizedAge)
    }

    posAttr.needsUpdate = true
    scaleAttr.needsUpdate = true
  })

  return (
    <points ref={pointsRef} frustumCulled={false} renderOrder={renderOrder}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[attributes.positions, 3]} />
        <bufferAttribute attach="attributes-aBaseSize" args={[attributes.baseSizes, 1]} />
        <bufferAttribute attach="attributes-aLifeScale" args={[attributes.lifeScales, 1]} />
      </bufferGeometry>
      <shaderMaterial
        vertexShader={VERTEX_SHADER}
        fragmentShader={FRAGMENT_SHADER}
        uniforms={{
          uOpacityScale: { value: opacityScale },
          uSizeScale: { value: sizeScale },
        }}
        transparent
        depthWrite={false}
        depthTest={depthTest}
        blending={THREE.AdditiveBlending}
      />
    </points>
  )
}
