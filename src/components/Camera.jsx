import { useThree, useFrame } from '@react-three/fiber'
import { useEffect, useRef } from 'react'
import * as THREE from 'three'

export const CAMERA_LIMITS = {
  ocean: { min: -50, max: 3 },
  'tropical-river': { min: -11, max: 3 },
}

const DEFAULT_CAMERA_Z = 12
const FOLLOW_HEIGHT = 0.85
const FOLLOW_TARGET_LERP = 0.075
const focusPosition = new THREE.Vector3()
const lookTarget = new THREE.Vector3()
const followForward = new THREE.Vector3(0, 0, -1)
const followOffset = new THREE.Vector3()
const followRight = new THREE.Vector3()
const yawQuaternion = new THREE.Quaternion()
const pitchQuaternion = new THREE.Quaternion()

export default function Camera({ biome = 'ocean', focusTarget = null, followOrbit = { yaw: 0, pitch: 0 }, followDistance = 3.2 }) {
  const { camera } = useThree()
  const smoothedFocus = useRef(new THREE.Vector3())
  const hasSmoothedFocus = useRef(false)
  const limits = CAMERA_LIMITS[biome] ?? CAMERA_LIMITS.ocean

  useEffect(() => {
    camera.position.set(0, 0, DEFAULT_CAMERA_Z)
  }, [camera, biome])

  useFrame(() => {
    if (focusTarget) {
      focusTarget.getWorldPosition(focusPosition)
      const clampedY = THREE.MathUtils.clamp(focusPosition.y, limits.min, limits.max)
      focusPosition.y = clampedY

      if (!hasSmoothedFocus.current) {
        smoothedFocus.current.copy(focusPosition)
        hasSmoothedFocus.current = true
      } else {
        smoothedFocus.current.lerp(focusPosition, FOLLOW_TARGET_LERP)
      }

      followOffset.set(0, FOLLOW_HEIGHT, followDistance)

      yawQuaternion.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, followOrbit.yaw)
      followOffset.applyQuaternion(yawQuaternion)

      followRight.crossVectors(THREE.Object3D.DEFAULT_UP, followOffset).normalize()
      pitchQuaternion.setFromAxisAngle(followRight, followOrbit.pitch)
      followOffset.applyQuaternion(pitchQuaternion)

      camera.position.x = THREE.MathUtils.lerp(camera.position.x, smoothedFocus.current.x + followOffset.x, 0.12)
      camera.position.y = THREE.MathUtils.lerp(camera.position.y, smoothedFocus.current.y + followOffset.y, 0.12)
      camera.position.z = THREE.MathUtils.lerp(camera.position.z, smoothedFocus.current.z + followOffset.z, 0.12)

      lookTarget.copy(smoothedFocus.current)
      lookTarget.addScaledVector(followForward, 0.7)
      camera.lookAt(lookTarget)
      return
    }

    hasSmoothedFocus.current = false
    camera.position.x = THREE.MathUtils.lerp(camera.position.x, 0, 0.08)
    camera.position.y = THREE.MathUtils.lerp(camera.position.y, 0, 0.06)
    camera.position.z = THREE.MathUtils.lerp(camera.position.z, DEFAULT_CAMERA_Z, 0.07)
    camera.lookAt(camera.position.x, camera.position.y, 0)
  })

  return null
}
