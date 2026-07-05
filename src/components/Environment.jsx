import { useRef, useEffect, useMemo } from 'react'
import * as THREE from 'three'

// Radial alpha fade so the seabed's outer rim dissolves to nothing instead of ending in a
// hard edge/horizon line when the follow cam looks toward it. The plane's local xy spans
// ±180 (360 wide); fade the outer band to transparent so the background shows through
// seamlessly. depthWrite stays on — nothing renders below the floor.
function makeFloorMaterial(color) {
  const material = new THREE.MeshStandardMaterial({
    color, roughness: 0.92, envMapIntensity: 0.28, side: THREE.DoubleSide, transparent: true, depthWrite: true,
  })
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying float vFloorRadial;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvFloorRadial = length(position.xy) / 180.0;')
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying float vFloorRadial;')
      .replace('#include <dithering_fragment>', '#include <dithering_fragment>\ngl_FragColor.a *= 1.0 - smoothstep(0.5, 0.94, vFloorRadial);')
  }
  return material
}

function noise(x, z) {
  const n = Math.sin(x * 127.1 + z * 311.7) * 43758.5453
  return (n - Math.floor(n)) * 2 - 1
}

export const FLOOR_Y = { ocean: -52, 'tropical-river': -12, lake: -20 }
const FLOOR_COLORS = { ocean: '#0e1f33', 'tropical-river': '#1a2e14', lake: '#1a2e1c' }

function NoiseFloor({ biome }) {
  const ref = useRef()
  const floorY = FLOOR_Y[biome] ?? -20
  const material = useMemo(() => makeFloorMaterial(FLOOR_COLORS[biome] ?? '#0e1f33'), [biome])

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
    // Oversized seabed: the extra span pushes the plane's edges far out into the distance
    // fog so orbiting the follow cam never reveals a hard rim — the floor reads as fading
    // into the horizon. The visible near-floor is unchanged (it sits well below the swim
    // zone and is already fog-dimmed), so this only affects grazing/low orbit angles.
    <mesh ref={ref} rotation={[Math.PI / 2, 0, 0]} position={[0, floorY, 0]} material={material}>
      <planeGeometry args={[360, 360, 96, 96]} />
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
