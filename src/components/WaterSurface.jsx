import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'

const COLORS = {
  ocean: '#1a90d0',
  'tropical-river': '#2a8050',
}

export default function WaterSurface({ biome = 'ocean' }) {
  const ref = useRef()
  useFrame(({ clock }) => {
    if (ref.current) ref.current.material.opacity = 0.32 + Math.sin(clock.getElapsedTime() * 0.7) * 0.04
  })
  return (
    <mesh ref={ref} rotation={[-Math.PI / 2, 0, 0]} position={[60, 3.5, 0]}>
      <planeGeometry args={[240, 30]} />
      <meshStandardMaterial color={COLORS[biome] ?? '#1a90d0'} transparent opacity={0.32} />
    </mesh>
  )
}
