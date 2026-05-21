import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

function createCheckerTexture() {
  const canvas = document.createElement('canvas')
  canvas.width = 256
  canvas.height = 256
  const ctx = canvas.getContext('2d')
  const size = 32

  for (let y = 0; y < canvas.height; y += size) {
    for (let x = 0; x < canvas.width; x += size) {
      const light = ((x / size) + (y / size)) % 2 === 0
      ctx.fillStyle = light ? 'rgba(208, 255, 255, 0.92)' : 'rgba(20, 122, 184, 0.88)'
      ctx.fillRect(x, y, size, size)
    }
  }

  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.wrapS = THREE.RepeatWrapping
  texture.wrapT = THREE.RepeatWrapping
  texture.repeat.set(18, 3)
  texture.needsUpdate = true
  return texture
}

export default function WaterSurface() {
  const ref = useRef()
  const checkerTexture = useMemo(() => createCheckerTexture(), [])

  useFrame(({ clock }) => {
    if (!ref.current) return
    ref.current.material.opacity = 0.46 + Math.sin(clock.getElapsedTime() * 0.7) * 0.05
    checkerTexture.offset.x = (clock.getElapsedTime() * 0.018) % 1
  })

  return (
    <mesh ref={ref} rotation={[-Math.PI / 2, 0, 0]} position={[60, 3.5, 0]} raycast={() => null}>
      <planeGeometry args={[240, 30]} />
      <meshBasicMaterial map={checkerTexture} transparent opacity={0.46} depthWrite={false} side={THREE.DoubleSide} />
    </mesh>
  )
}
