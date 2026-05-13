import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

const BUBBLE_COUNT = 140
const SPREAD_X = 22
const MIN_Y = -52
const MAX_Y = 5
const SPREAD_Z = 9

function randomRange(min, max) {
  return min + Math.random() * (max - min)
}

export default function OceanBubbles() {
  const pointsRef = useRef()
  const velocities = useRef(null)

  const { positions, sizes } = useMemo(() => {
    const p = new Float32Array(BUBBLE_COUNT * 3)
    const s = new Float32Array(BUBBLE_COUNT)
    const v = new Float32Array(BUBBLE_COUNT)

    for (let i = 0; i < BUBBLE_COUNT; i += 1) {
      const j = i * 3
      p[j] = randomRange(-SPREAD_X / 2, SPREAD_X / 2)
      p[j + 1] = randomRange(MIN_Y, MAX_Y)
      p[j + 2] = randomRange(-SPREAD_Z / 2, SPREAD_Z / 2)
      s[i] = randomRange(0.045, 0.16)
      v[i] = randomRange(0.45, 1.25)
    }

    velocities.current = v
    return { positions: p, sizes: s }
  }, [])

  useFrame(({ clock }, delta) => {
    const points = pointsRef.current
    if (!points || !velocities.current) return

    const pos = points.geometry.attributes.position.array
    const t = clock.getElapsedTime()

    for (let i = 0; i < BUBBLE_COUNT; i += 1) {
      const j = i * 3
      pos[j + 1] += velocities.current[i] * delta
      pos[j] += Math.sin(t * 0.8 + i * 1.71) * delta * 0.08
      pos[j + 2] += Math.cos(t * 0.55 + i * 2.13) * delta * 0.05

      if (pos[j + 1] > MAX_Y) {
        pos[j] = randomRange(-SPREAD_X / 2, SPREAD_X / 2)
        pos[j + 1] = MIN_Y + randomRange(-3, 2)
        pos[j + 2] = randomRange(-SPREAD_Z / 2, SPREAD_Z / 2)
      }
    }

    points.geometry.attributes.position.needsUpdate = true
  })

  return (
    <points ref={pointsRef} frustumCulled={false}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        <bufferAttribute attach="attributes-size" args={[sizes, 1]} />
      </bufferGeometry>
      <pointsMaterial
        color="#b7f1ff"
        size={0.09}
        sizeAttenuation
        transparent
        opacity={0.52}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  )
}
