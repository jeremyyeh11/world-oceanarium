import { useThree, useFrame } from '@react-three/fiber'
import { useEffect } from 'react'
import * as THREE from 'three'

export const CAMERA_LIMITS = {
  ocean: { min: -50, max: 3 },
  'tropical-river': { min: -11, max: 3 },
}

const DEFAULT_CAMERA_Z = 12
const FOCUS_CAMERA_Z = 5.8
const focusPosition = new THREE.Vector3()
const lookTarget = new THREE.Vector3()

export default function Camera({ biome = 'ocean', focusTarget = null }) {
  const { camera } = useThree()
  const limits = CAMERA_LIMITS[biome] ?? CAMERA_LIMITS.ocean

  useEffect(() => {
    camera.position.set(0, 0, DEFAULT_CAMERA_Z)
  }, [camera, biome])

  useFrame(() => {
    if (focusTarget) {
      focusTarget.getWorldPosition(focusPosition)
      const clampedY = THREE.MathUtils.clamp(focusPosition.y, limits.min, limits.max)

      camera.position.x = THREE.MathUtils.lerp(camera.position.x, focusPosition.x, 0.075)
      camera.position.y = THREE.MathUtils.lerp(camera.position.y, clampedY, 0.075)
      camera.position.z = THREE.MathUtils.lerp(camera.position.z, FOCUS_CAMERA_Z, 0.07)

      lookTarget.set(focusPosition.x, clampedY, focusPosition.z)
      camera.lookAt(lookTarget)
      return
    }

    camera.position.x = THREE.MathUtils.lerp(camera.position.x, 0, 0.08)
    camera.position.y = THREE.MathUtils.lerp(camera.position.y, 0, 0.06)
    camera.position.z = THREE.MathUtils.lerp(camera.position.z, DEFAULT_CAMERA_Z, 0.07)
    camera.lookAt(camera.position.x, camera.position.y, 0)
  })

  return null
}
