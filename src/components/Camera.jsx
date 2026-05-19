import { useThree, useFrame } from '@react-three/fiber'
import { useEffect, useRef } from 'react'
import * as THREE from 'three'

export const CAMERA_LIMITS = {
  ocean: { min: -50, max: 3 },
  'tropical-river': { min: -11, max: 3 },
}

const DEFAULT_CAMERA_Z = 12
const FOLLOW_HEIGHT = 0.85
const FOLLOW_TARGET_DAMPING = 4.8
const FOLLOW_POSITION_DAMPING = 6.2
const DEFAULT_POSITION_DAMPING = 4.0
const focusPosition = new THREE.Vector3()
const lookTarget = new THREE.Vector3()
const framedFocus = new THREE.Vector3()
const followOffset = new THREE.Vector3()
const followRight = new THREE.Vector3()
const desiredCameraPosition = new THREE.Vector3()
const focusBounds = new THREE.Box3()
const yawQuaternion = new THREE.Quaternion()
const pitchQuaternion = new THREE.Quaternion()

export default function Camera({ biome = 'ocean', focusTarget = null, followOrbit = { yaw: 0, pitch: 0 }, followDistance = 3.2, followScreenOffset = 0 }) {
  const { camera } = useThree()
  const smoothedFocus = useRef(new THREE.Vector3())
  const hasSmoothedFocus = useRef(false)
  const limits = CAMERA_LIMITS[biome] ?? CAMERA_LIMITS.ocean

  useEffect(() => {
    camera.position.set(0, 0, DEFAULT_CAMERA_Z)
  }, [camera, biome])

  useFrame((_, delta) => {
    if (focusTarget) {
      focusBounds.setFromObject(focusTarget)
      if (!focusBounds.isEmpty()) {
        focusBounds.getCenter(focusPosition)
      } else {
        focusTarget.getWorldPosition(focusPosition)
      }

      focusPosition.y = THREE.MathUtils.clamp(focusPosition.y, limits.min, limits.max)

      if (!hasSmoothedFocus.current) {
        smoothedFocus.current.copy(focusPosition)
        hasSmoothedFocus.current = true
      } else {
        smoothedFocus.current.x = THREE.MathUtils.damp(smoothedFocus.current.x, focusPosition.x, FOLLOW_TARGET_DAMPING, delta)
        smoothedFocus.current.y = THREE.MathUtils.damp(smoothedFocus.current.y, focusPosition.y, FOLLOW_TARGET_DAMPING, delta)
        smoothedFocus.current.z = THREE.MathUtils.damp(smoothedFocus.current.z, focusPosition.z, FOLLOW_TARGET_DAMPING, delta)
      }

      followOffset.set(0, FOLLOW_HEIGHT, followDistance)

      yawQuaternion.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, followOrbit.yaw)
      followOffset.applyQuaternion(yawQuaternion)

      followRight.crossVectors(THREE.Object3D.DEFAULT_UP, followOffset).normalize()
      pitchQuaternion.setFromAxisAngle(followRight, followOrbit.pitch)
      followOffset.applyQuaternion(pitchQuaternion)

      const followFramingShift = THREE.MathUtils.clamp(followScreenOffset, 0, 0.4) * 0.5
      const visibleHeightAtFocus = 2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) * 0.5) * followDistance
      framedFocus.copy(smoothedFocus.current).addScaledVector(THREE.Object3D.DEFAULT_UP, -visibleHeightAtFocus * followFramingShift)

      desiredCameraPosition.copy(framedFocus).add(followOffset)
      camera.position.x = THREE.MathUtils.damp(camera.position.x, desiredCameraPosition.x, FOLLOW_POSITION_DAMPING, delta)
      camera.position.y = THREE.MathUtils.damp(camera.position.y, desiredCameraPosition.y, FOLLOW_POSITION_DAMPING, delta)
      camera.position.z = THREE.MathUtils.damp(camera.position.z, desiredCameraPosition.z, FOLLOW_POSITION_DAMPING, delta)

      lookTarget.copy(framedFocus)
      camera.lookAt(lookTarget)
      return
    }

    hasSmoothedFocus.current = false
    camera.position.x = THREE.MathUtils.damp(camera.position.x, 0, DEFAULT_POSITION_DAMPING, delta)
    camera.position.y = THREE.MathUtils.damp(camera.position.y, 0, DEFAULT_POSITION_DAMPING, delta)
    camera.position.z = THREE.MathUtils.damp(camera.position.z, DEFAULT_CAMERA_Z, DEFAULT_POSITION_DAMPING, delta)
    camera.lookAt(camera.position.x, camera.position.y, 0)
  })

  return null
}
