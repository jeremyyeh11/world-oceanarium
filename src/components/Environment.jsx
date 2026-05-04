import { useRef, useEffect } from 'react'
import { Html } from '@react-three/drei'
import * as THREE from 'three'

function noise(x, z) {
  const n = Math.sin(x * 127.1 + z * 311.7) * 43758.5453
  return (n - Math.floor(n)) * 2 - 1
}

const FLOOR_Y = { ocean: -52, 'tropical-river': -12, lake: -20 }
const FLOOR_COLORS = { ocean: '#0e1f33', 'tropical-river': '#1a2e14', lake: '#1a2e1c' }

const OCEAN_ZONES = [
  { name: 'Epipelagic', sub: 'Sunlight Zone · 0–200 m', y: 1.5, color: '#a8d8ea' },
  { name: 'Mesopelagic', sub: 'Twilight Zone · 200–1,000 m', y: -10, color: '#5b8db8' },
  { name: 'Bathypelagic', sub: 'Midnight Zone · 1,000–4,000 m', y: -22, color: '#2d5480' },
  { name: 'Abyssalpelagic', sub: 'Abyssal Zone · 4,000–6,000 m', y: -36, color: '#1a3a5c' },
  { name: 'Hadalpelagic', sub: 'Hadal Zone · 6,000 m+', y: -47, color: '#0d1f33' },
]

const RIVER_ZONES = [
  { name: 'Surface', sub: 'Shallow bank · 0–0.5 m', y: 2, color: '#8dd4a0' },
  { name: 'Mid-water', sub: 'Flowing channel · 0.5–2 m', y: -2, color: '#4a9a60' },
  { name: 'Deep', sub: 'Pool bottom · 2–4 m', y: -6, color: '#2a5a35' },
  { name: 'Benthic', sub: 'Riverbed · 4 m+', y: -10, color: '#1a3a20' },
]

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
      <meshStandardMaterial color={FLOOR_COLORS[biome] ?? '#0e1f33'} roughness={1} side={THREE.DoubleSide} />
    </mesh>
  )
}

function ZoneLabels({ zones, x = -6.5 }) {
  return zones.map(zone => (
    <Html key={zone.name} position={[x, zone.y, 0]} style={{ pointerEvents: 'none' }}>
      <div style={{ color: zone.color, fontFamily: 'system-ui, sans-serif', fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase', whiteSpace: 'nowrap', textShadow: '0 1px 4px rgba(0,0,0,0.8)', borderLeft: `2px solid ${zone.color}`, paddingLeft: 6, opacity: 0.75 }}>
        <div style={{ fontWeight: 600 }}>{zone.name}</div>
        <div style={{ opacity: 0.7, fontSize: 10, marginTop: 1 }}>{zone.sub}</div>
      </div>
    </Html>
  ))
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
      <meshStandardMaterial color={i % 2 ? '#2f7d3f' : '#1f5f32'} />
    </mesh>
  ))
}

export default function Environment({ biome }) {
  return (
    <group>
      <NoiseFloor biome={biome} />
      {biome === 'ocean' && <ZoneLabels zones={OCEAN_ZONES} />}
      {biome === 'tropical-river' && <ZoneLabels zones={RIVER_ZONES} x={-5.5} />}
      {biome === 'tropical-river' && <RiverVegetation />}
    </group>
  )
}
