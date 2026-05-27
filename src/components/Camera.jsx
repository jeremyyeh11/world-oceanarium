import { useThree, useFrame } from '@react-three/fiber'
import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { SURFACE_PLANE_Y } from './WaterSurface'

export const CAMERA_LIMITS = {
  ocean: { min: -50, max: 3 },
  'tropical-river': { min: -11, max: 3 },
}

const DEFAULT_CAMERA_Z = 12
const FOLLOW_HEIGHT = 0.85
const FOLLOW_SURFACE_CLEARANCE = 0.35
const FOLLOW_TARGET_DAMPING = 2.8
const FOLLOW_LOOK_DAMPING = 3.2
const FOLLOW_POSITION_DAMPING = 4.0
const DEFAULT_POSITION_DAMPING = 4.0
const focusPosition = new THREE.Vector3()
const lookTarget = new THREE.Vector3()
const defaultLookTarget = new THREE.Vector3()
const framedFocus = new THREE.Vector3()
const initialFollowLookTarget = new THREE.Vector3()
const currentCameraForward = new THREE.Vector3()
const followOffset = new THREE.Vector3()
const followRight = new THREE.Vector3()
const desiredCameraPosition = new THREE.Vector3()
const focusBounds = new THREE.Box3()
const yawQuaternion = new THREE.Quaternion()
const pitchQuaternion = new THREE.Quaternion()

const MAX_FOLLOW_CAMERA_Y = SURFACE_PLANE_Y - FOLLOW_SURFACE_CLEARANCE

export default function Camera({ biome = 'ocean', focusTarget = null, followOrbit = { yaw: 0, pitch: 0 }, followDistance = 3.2, followScreenOffset = 0 }) {
  const { camera } = useThree()
  const smoothedFocus = useRef(new THREE.Vector3())
  const smoothedLookTarget = useRef(new THREE.Vector3())
  const smoothedDefaultLookTarget = useRef(new THREE.Vector3())
  const hasSmoothedFocus = useRef(false)
  const hasSmoothedLookTarget = useRef(false)
  const hasSmoothedDefaultLookTarget = useRef(false)
  const previousFocusTarget = useRef(null)
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

      if (previousFocusTarget.current !== focusTarget) {
        previousFocusTarget.current = focusTarget
        hasSmoothedFocus.current = false
        hasSmoothedLookTarget.current = false
      }
      hasSmoothedDefaultLookTarget.current = false

      if (!hasSmoothedFocus.current) {
        followOffset.set(0, FOLLOW_HEIGHT, followDistance)
        yawQuaternion.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, followOrbit.yaw)
        followOffset.applyQuaternion(yawQuaternion)
        followRight.crossVectors(THREE.Object3D.DEFAULT_UP, followOffset).normalize()
        pitchQuaternion.setFromAxisAngle(followRight, followOrbit.pitch)
        followOffset.applyQuaternion(pitchQuaternion)

        const followFramingShift = THREE.MathUtils.clamp(followScreenOffset, 0, 0.4) * 0.5
        const visibleHeightAtFocus = 2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) * 0.5) * followDistance
        initialFollowLookTarget.copy(camera.position).sub(followOffset).addScaledVector(THREE.Object3D.DEFAULT_UP, visibleHeightAtFocus * followFramingShift)
        initialFollowLookTarget.y = THREE.MathUtils.clamp(initialFollowLookTarget.y, limits.min, limits.max)
        smoothedFocus.current.copy(initialFollowLookTarget)
        hasSmoothedFocus.current = true
      }

      smoothedFocus.current.x = THREE.MathUtils.damp(smoothedFocus.current.x, focusPosition.x, FOLLOW_TARGET_DAMPING, delta)
      smoothedFocus.current.y = THREE.MathUtils.damp(smoothedFocus.current.y, focusPosition.y, FOLLOW_TARGET_DAMPING, delta)
      smoothedFocus.current.z = THREE.MathUtils.damp(smoothedFocus.current.z, focusPosition.z, FOLLOW_TARGET_DAMPING, delta)

      const activeFollowDistance = followDistance

      followOffset.set(0, FOLLOW_HEIGHT, activeFollowDistance)

      yawQuaternion.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, followOrbit.yaw)
      followOffset.applyQuaternion(yawQuaternion)

      followRight.crossVectors(THREE.Object3D.DEFAULT_UP, followOffset).normalize()
      pitchQuaternion.setFromAxisAngle(followRight, followOrbit.pitch)
      followOffset.applyQuaternion(pitchQuaternion)

      const followFramingShift = THREE.MathUtils.clamp(followScreenOffset, 0, 0.4) * 0.5
      const visibleHeightAtFocus = 2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) * 0.5) * activeFollowDistance
      framedFocus.copy(smoothedFocus.current).addScaledVector(THREE.Object3D.DEFAULT_UP, -visibleHeightAtFocus * followFramingShift)

      desiredCameraPosition.copy(framedFocus).add(followOffset)
      desiredCameraPosition.y = Math.min(desiredCameraPosition.y, MAX_FOLLOW_CAMERA_Y)
      camera.position.x = THREE.MathUtils.damp(camera.position.x, desiredCameraPosition.x, FOLLOW_POSITION_DAMPING, delta)
      camera.position.y = THREE.MathUtils.damp(camera.position.y, desiredCameraPosition.y, FOLLOW_POSITION_DAMPING, delta)
      camera.position.z = THREE.MathUtils.damp(camera.position.z, desiredCameraPosition.z, FOLLOW_POSITION_DAMPING, delta)
      camera.position.y = Math.min(camera.position.y, MAX_FOLLOW_CAMERA_Y)

      if (!hasSmoothedLookTarget.current) {
        camera.getWorldDirection(currentCameraForward)
        const initialLookDistance = Math.max(1, camera.position.distanceTo(framedFocus))
        smoothedLookTarget.current.copy(camera.position).addScaledVector(currentCameraForward, initialLookDistance)
        hasSmoothedLookTarget.current = true
      }

      smoothedLookTarget.current.x = THREE.MathUtils.damp(smoothedLookTarget.current.x, framedFocus.x, FOLLOW_LOOK_DAMPING, delta)
      smoothedLookTarget.current.y = THREE.MathUtils.damp(smoothedLookTarget.current.y, framedFocus.y, FOLLOW_LOOK_DAMPING, delta)
      smoothedLookTarget.current.z = THREE.MathUtils.damp(smoothedLookTarget.current.z, framedFocus.z, FOLLOW_LOOK_DAMPING, delta)

      lookTarget.copy(smoothedLookTarget.current)
      camera.lookAt(lookTarget)
      return
    }

    previousFocusTarget.current = null
    hasSmoothedFocus.current = false
    hasSmoothedLookTarget.current = false
    camera.position.x = THREE.MathUtils.damp(camera.position.x, 0, DEFAULT_POSITION_DAMPING, delta)
    camera.position.y = THREE.MathUtils.damp(camera.position.y, 0, DEFAULT_POSITION_DAMPING, delta)
    camera.position.z = THREE.MathUtils.damp(camera.position.z, DEFAULT_CAMERA_Z, DEFAULT_POSITION_DAMPING, delta)
    defaultLookTarget.set(camera.position.x, camera.position.y, 0)
    if (!hasSmoothedDefaultLookTarget.current) {
      camera.getWorldDirection(currentCameraForward)
      const initialLookDistance = Math.max(1, camera.position.distanceTo(defaultLookTarget))
      smoothedDefaultLookTarget.current.copy(camera.position).addScaledVector(currentCameraForward, initialLookDistance)
      hasSmoothedDefaultLookTarget.current = true
    }
    smoothedDefaultLookTarget.current.x = THREE.MathUtils.damp(smoothedDefaultLookTarget.current.x, defaultLookTarget.x, FOLLOW_LOOK_DAMPING, delta)
    smoothedDefaultLookTarget.current.y = THREE.MathUtils.damp(smoothedDefaultLookTarget.current.y, defaultLookTarget.y, FOLLOW_LOOK_DAMPING, delta)
    smoothedDefaultLookTarget.current.z = THREE.MathUtils.damp(smoothedDefaultLookTarget.current.z, defaultLookTarget.z, FOLLOW_LOOK_DAMPING, delta)
    camera.lookAt(smoothedDefaultLookTarget.current)
  })

  return null
}
