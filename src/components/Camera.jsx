import { useThree, useFrame } from '@react-three/fiber'
import { useEffect, useRef } from 'react'
import * as THREE from 'three'

export const CAMERA_LIMITS = {
  ocean: { min: -50, max: 3 },
  'tropical-river': { min: -11, max: 3 },
}

const DEFAULT_CAMERA_Z = 12
const FOCUS_CAMERA_Z = 5.8
const focusPosition = new THREE.Vector3()
const lookTarget = new THREE.Vector3()

export default function Camera({ biome = 'ocean', focusTarget = null, onScrollChange }) {
  const { camera } = useThree()
  const targetY = useRef(0)
  const isDragging = useRef(false)
  const lastY = useRef(0)
  const limits = CAMERA_LIMITS[biome] ?? CAMERA_LIMITS.ocean

  useEffect(() => {
    camera.position.set(0, 0, DEFAULT_CAMERA_Z)
    targetY.current = 0
    onScrollChange?.(1)
  }, [camera, biome, onScrollChange])

  const reportScroll = (y) => onScrollChange?.((y - limits.min) / (limits.max - limits.min))

  useEffect(() => {
    const onMouseDown = (e) => { isDragging.current = true; lastY.current = e.clientY }
    const onMouseMove = (e) => {
      if (!isDragging.current || focusTarget) return
      const delta = (e.clientY - lastY.current) * 0.08
      lastY.current = e.clientY
      targetY.current = THREE.MathUtils.clamp(targetY.current + delta, limits.min, limits.max)
      reportScroll(targetY.current)
    }
    const onMouseUp = () => { isDragging.current = false }
    const onWheel = (e) => {
      if (focusTarget) return
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
  }, [focusTarget, limits.min, limits.max])

  useFrame(() => {
    if (focusTarget) {
      focusTarget.getWorldPosition(focusPosition)
      const clampedY = THREE.MathUtils.clamp(focusPosition.y, limits.min, limits.max)
      targetY.current = clampedY
      reportScroll(clampedY)

      camera.position.x = THREE.MathUtils.lerp(camera.position.x, focusPosition.x, 0.075)
      camera.position.y = THREE.MathUtils.lerp(camera.position.y, clampedY, 0.075)
      camera.position.z = THREE.MathUtils.lerp(camera.position.z, FOCUS_CAMERA_Z, 0.07)

      lookTarget.set(focusPosition.x, clampedY, focusPosition.z)
      camera.lookAt(lookTarget)
      return
    }

    camera.position.x = THREE.MathUtils.lerp(camera.position.x, 0, 0.08)
    camera.position.y = THREE.MathUtils.lerp(camera.position.y, targetY.current, 0.06)
    camera.position.z = THREE.MathUtils.lerp(camera.position.z, DEFAULT_CAMERA_Z, 0.07)
    camera.lookAt(camera.position.x, camera.position.y, 0)
  })

  return null
}
