import { useRef, useEffect } from 'react'
import * as THREE from 'three'

function noise(x, z) {
  const n = Math.sin(x * 127.1 + z * 311.7) * 43758.5453
  return (n - Math.floor(n)) * 2 - 1
}

const FLOOR_Y = { ocean: -52, 'tropical-river': -12, lake: -20 }
const FLOOR_COLORS = { ocean: '#0e1f33', 'tropical-river': '#1a2e14', lake: '#1a2e1c' }

function NoiseFloor({ biome }) {
  const ref = useRef()
  const floorY = FLOOR_Y[biome] ?? -20

  useEffect(() => {
    if (!ref.current) return
    const pos = ref.current.geometry.attributes.position
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i)
      const y = pos.getY(i)
      const bump = noise(x * 0.2, y * 0.2) * 1.2 + noise(x * 0.6, y * 0.6) * 0.4
      pos.setZ(i, -bump)
    }
    pos.needsUpdate = true
    ref.current.geometry.computeVertexNormals()
  }, [])

  return (
    <mesh ref={ref} rotation={[Math.PI / 2, 0, 0]} position={[0, floorY, 0]}>
      <planeGeometry args={[120, 40, 60, 30]} />
      <meshStandardMaterial color={FLOOR_COLORS[biome] ?? '#0e1f33'} roughness={0.92} envMapIntensity={0.28} side={THREE.DoubleSide} />
    </mesh>
  )
}

function RiverVegetation() {
  const plants = [
    [-7, -10.2, -2.4, 2.3], [-5.4, -10.4, 1.8, 3.1], [-3.2, -10.8, -1.1, 1.8],
    [-1.2, -10.5, 2.5, 2.6], [1.4, -10.7, -2.1, 2.2], [3.6, -10.3, 0.8, 3.5],
    [5.8, -10.6, -1.7, 2.0], [7.1, -10.4, 2.2, 2.8],
  ]
  return plants.map(([x, y, z, h], i) => (
    <mesh key={i} position={[x, y + h / 2, z]}>
      <cylinderGeometry args={[0.06, 0.16, h, 6]} />
      <meshStandardMaterial color={i % 2 ? '#2f7d3f' : '#1f5f32'} roughness={0.58} envMapIntensity={0.45} />
    </mesh>
  ))
}

export default function Environment({ biome }) {
  return (
    <group>
      <NoiseFloor biome={biome} />
      {biome === 'tropical-river' && <RiverVegetation />}
    </group>
  )
}
