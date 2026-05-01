import { useRef, useEffect } from 'react'
import { Html } from '@react-three/drei'
import * as THREE from 'three'

function noise(x, z) {
  const n = Math.sin(x * 127.1 + z * 311.7) * 43758.5453
  return (n - Math.floor(n)) * 2 - 1
}

const FLOOR_Y = { ocean: -52, reef: -15, lake: -20, river: -12 }
const FLOOR_COLORS = { ocean: '#0e1f33', reef: '#1e3d2f', lake: '#1a2e1c', river: '#2e2710' }

// Ocean depth zones — y positions map to real-world depth zones
const OCEAN_ZONES = [
  { name: 'Epipelagic',     sub: 'Sunlight Zone · 0–200 m',       y:  1.5, color: '#a8d8ea' },
  { name: 'Mesopelagic',    sub: 'Twilight Zone · 200–1,000 m',   y: -10,  color: '#5b8db8' },
  { name: 'Bathypelagic',   sub: 'Midnight Zone · 1,000–4,000 m', y: -22,  color: '#2d5480' },
  { name: 'Abyssalpelagic', sub: 'Abyssal Zone · 4,000–6,000 m',  y: -36,  color: '#1a3a5c' },
  { name: 'Hadalpelagic',   sub: 'Hadal Zone · 6,000 m+',         y: -47,  color: '#0d1f33' },
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

function OceanZoneLabels() {
  return (
    <>
      {OCEAN_ZONES.map((zone) => (
        <Html key={zone.name} position={[-6.5, zone.y, 0]} style={{ pointerEvents: 'none' }}>
          <div style={{
            color: zone.color,
            fontFamily: 'system-ui, sans-serif',
            fontSize: '11px',
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            whiteSpace: 'nowrap',
            textShadow: '0 1px 4px rgba(0,0,0,0.8)',
            borderLeft: `2px solid ${zone.color}`,
            paddingLeft: '6px',
            opacity: 0.75,
          }}>
            <div style={{ fontWeight: 600 }}>{zone.name}</div>
            <div style={{ opacity: 0.7, fontSize: '10px', marginTop: '1px' }}>{zone.sub}</div>
          </div>
        </Html>
      ))}
    </>
  )
}

export default function Environment({ biome }) {
  return (
    <group>
      <NoiseFloor biome={biome} />
      {biome === 'ocean' && <OceanZoneLabels />}
    </group>
  )
}
