import { useThree, useFrame } from '@react-three/fiber'
import { useEffect, useRef } from 'react'
import * as THREE from 'three'

export const MIN_Y = -50
export const MAX_Y = 3
const CAMERA_Z = 12

export default function Camera({ biomeIndex, biomeSpacing, onScrollChange }) {
  const { camera } = useThree()
  const targetX = useRef(0)
  const targetY = useRef(0)
  const isDragging = useRef(false)
  const lastY = useRef(0)

  useEffect(() => { camera.position.set(0, 0, CAMERA_Z) }, [camera])
  useEffect(() => { targetX.current = biomeIndex * biomeSpacing }, [biomeIndex, biomeSpacing])

  const reportScroll = (y) => onScrollChange?.((y - MIN_Y) / (MAX_Y - MIN_Y))

  useEffect(() => {
    const onMouseDown = (e) => { isDragging.current = true; lastY.current = e.clientY }
    const onMouseMove = (e) => {
      if (!isDragging.current) return
      const delta = (e.clientY - lastY.current) * 0.08
      lastY.current = e.clientY
      targetY.current = THREE.MathUtils.clamp(targetY.current + delta, MIN_Y, MAX_Y)
      reportScroll(targetY.current)
    }
    const onMouseUp = () => { isDragging.current = false }
    const onWheel = (e) => {
      targetY.current = THREE.MathUtils.clamp(targetY.current - e.deltaY * 0.03, MIN_Y, MAX_Y)
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
  }, [])

  useFrame(() => {
    camera.position.x = THREE.MathUtils.lerp(camera.position.x, targetX.current, 0.08)
    camera.position.y = THREE.MathUtils.lerp(camera.position.y, targetY.current, 0.06)
    camera.lookAt(camera.position.x, camera.position.y, 0)
  })

  return null
}
