import { useThree, useFrame } from '@react-three/fiber'
import { useEffect, useRef } from 'react'
import * as THREE from 'three'

export const CAMERA_LIMITS = {
  ocean: { min: -50, max: 3 },
  'tropical-river': { min: -11, max: 3 },
}

const CAMERA_Z = 12

export default function Camera({ biome = 'ocean', onScrollChange }) {
  const { camera } = useThree()
  const targetY = useRef(0)
  const isDragging = useRef(false)
  const lastY = useRef(0)
  const limits = CAMERA_LIMITS[biome] ?? CAMERA_LIMITS.ocean

  useEffect(() => {
    camera.position.set(0, 0, CAMERA_Z)
    targetY.current = 0
    onScrollChange?.(1)
  }, [camera, biome, onScrollChange])

  const reportScroll = (y) => onScrollChange?.((y - limits.min) / (limits.max - limits.min))

  useEffect(() => {
    const onMouseDown = (e) => { isDragging.current = true; lastY.current = e.clientY }
    const onMouseMove = (e) => {
      if (!isDragging.current) return
      const delta = (e.clientY - lastY.current) * 0.08
      lastY.current = e.clientY
      targetY.current = THREE.MathUtils.clamp(targetY.current + delta, limits.min, limits.max)
      reportScroll(targetY.current)
    }
    const onMouseUp = () => { isDragging.current = false }
    const onWheel = (e) => {
      targetY.current = THREE.MathUtils.clamp(targetY.current - e.deltaY * 0.03, limits.min, limits.max)
      reportScroll(targetY.current)
    }
    window.addEventListener('mousedown', onMouseDown)
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
    window.addEventListener('wheel', onWheel, { passive: true })
    return () => {
      window.removeEventListener('mousedown', onMouseDown)
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
      window.removeEventListener('wheel', onWheel)
    }
  }, [limits.min, limits.max])

  useFrame(() => {
    camera.position.x = THREE.MathUtils.lerp(camera.position.x, 0, 0.08)
    camera.position.y = THREE.MathUtils.lerp(camera.position.y, targetY.current, 0.06)
    camera.lookAt(camera.position.x, camera.position.y, 0)
  })

  return null
}
