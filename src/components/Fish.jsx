import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'

const DEPTH_Y = {
  epipelagic: [0, 2.5],
  mesopelagic: [-11, -10],
  bathypelagic: [-23, -22],
  abyssalpelagic: [-37, -36],
  hadalpelagic: [-48, -47],
  shallow: [1, 3],
  mid: [-3, -1],
  deep: [-6, -4],
  benthic: [-9, -7],
}

export default function Fish({ creature, onClick }) {
  const ref = useRef()
  const o = useRef(Math.random() * Math.PI * 2)
  const spd = useRef(0.3 + Math.random() * 0.4)
  const [yMin, yMax] = DEPTH_Y[creature.depthZone] ?? [0, 2.5]
  const baseY = useRef(yMin + Math.random() * (yMax - yMin))
  const baseX = useRef((Math.random() - 0.5) * 8)

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime()
    if (!ref.current) return
    ref.current.position.x = baseX.current + Math.sin(t * spd.current + o.current) * 3.5
    ref.current.position.y = baseY.current + Math.sin(t * 0.35 + o.current) * 0.3
    ref.current.position.z = Math.sin(t * 0.18 + o.current) * 2.5
    const dx = Math.cos(t * spd.current + o.current)
    ref.current.rotation.y = dx > 0 ? 0 : Math.PI
  })

  const size = creature.traits?.size ?? 1
  return (
    <mesh ref={ref} scale={[size, size, size]} onClick={(e) => { e.stopPropagation(); onClick() }}>
      <boxGeometry args={[0.7, 0.28, 0.18]} />
      <meshStandardMaterial color={creature.color ?? '#7ab8c0'} />
    </mesh>
  )
}
