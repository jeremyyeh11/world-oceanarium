import { useThree, useFrame } from '@react-three/fiber'
import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { SURFACE_PLANE_DEPTH, SURFACE_PLANE_WIDTH, SURFACE_PLANE_X, SURFACE_PLANE_Y, SURFACE_PLANE_Z } from './WaterSurface'

export const CAMERA_LIMITS = {
  ocean: { min: -50, max: 3 },
  'tropical-river': { min: -11, max: 3 },
}

const DEFAULT_CAMERA_SETTINGS = {
  y: -3.35,
  z: 10,
  lookY: 0.35,
  fov: 61,
}

const DEFAULT_CAMERA_Z = DEFAULT_CAMERA_SETTINGS.z
const DEFAULT_CAMERA_Y = DEFAULT_CAMERA_SETTINGS.y
const DEFAULT_CAMERA_LOOK_Y = DEFAULT_CAMERA_SETTINGS.lookY
const DEFAULT_CAMERA_FOV = DEFAULT_CAMERA_SETTINGS.fov
const MAX_FOLLOW_CAMERA_FOV = 76
const FOLLOW_FOV_DAMPING = 3.4
const FOLLOW_FRAME_MARGIN = 1.32
const FOLLOW_HEIGHT = 0.85
const FOLLOW_SURFACE_CLEARANCE = 0.35
const FOLLOW_TARGET_DAMPING = 2.8
const FOLLOW_LOOK_DAMPING = 3.2
const FOLLOW_POSITION_DAMPING = 4.0
const FOLLOW_CAMERA_CLIP_RADIUS_FRACTION = 0.72
const FOLLOW_CAMERA_CLIP_GRACE_SECONDS = 0.18
const FOLLOW_CAMERA_CLIP_COOLDOWN_SECONDS = 1.0
const DEFAULT_POSITION_DAMPING = 4.0
const DEFAULT_CAMERA_SETTLED_POSITION_EPSILON = 0.06
const DEFAULT_CAMERA_SETTLED_LOOK_EPSILON = 0.08
const focusPosition = new THREE.Vector3()
const lookTarget = new THREE.Vector3()
const defaultLookTarget = new THREE.Vector3()
const defaultCameraPosition = new THREE.Vector3()
const framedFocus = new THREE.Vector3()
const initialFollowLookTarget = new THREE.Vector3()
const currentCameraForward = new THREE.Vector3()
const followOffset = new THREE.Vector3()
const followRight = new THREE.Vector3()
const desiredCameraPosition = new THREE.Vector3()
const focusBounds = new THREE.Box3()
const focusSphere = new THREE.Sphere()
const yawQuaternion = new THREE.Quaternion()
const pitchQuaternion = new THREE.Quaternion()

const MAX_FOLLOW_CAMERA_Y = SURFACE_PLANE_Y - FOLLOW_SURFACE_CLEARANCE
const FOLLOW_SURFACE_XZ_CLEARANCE = 1.25
const MIN_FOLLOW_CAMERA_X = SURFACE_PLANE_X - SURFACE_PLANE_WIDTH * 0.5 + FOLLOW_SURFACE_XZ_CLEARANCE
const MAX_FOLLOW_CAMERA_X = SURFACE_PLANE_X + SURFACE_PLANE_WIDTH * 0.5 - FOLLOW_SURFACE_XZ_CLEARANCE
const MIN_FOLLOW_CAMERA_Z = SURFACE_PLANE_Z - SURFACE_PLANE_DEPTH * 0.5 + FOLLOW_SURFACE_XZ_CLEARANCE
const MAX_FOLLOW_CAMERA_Z = SURFACE_PLANE_Z + SURFACE_PLANE_DEPTH * 0.5 - FOLLOW_SURFACE_XZ_CLEARANCE

export default function Camera({ biome = 'ocean', focusTarget = null, followOrbit = { yaw: 0, pitch: 0 }, followDistance = 3.2, followScreenOffset = 0, cameraSettings = DEFAULT_CAMERA_SETTINGS, onDefaultCameraSettledChange = null, onFollowCameraClip = null }) {
  const { camera } = useThree()
  const smoothedFocus = useRef(new THREE.Vector3())
  const smoothedLookTarget = useRef(new THREE.Vector3())
  const smoothedDefaultLookTarget = useRef(new THREE.Vector3())
  const hasSmoothedFocus = useRef(false)
  const hasSmoothedLookTarget = useRef(false)
  const hasSmoothedDefaultLookTarget = useRef(false)
  const previousFocusTarget = useRef(null)
  const defaultCameraSettled = useRef(true)
  const cameraClipStartedAt = useRef(null)
  const lastCameraClipExitAt = useRef(-Infinity)
  const limits = CAMERA_LIMITS[biome] ?? CAMERA_LIMITS.ocean

  const setDefaultCameraSettled = (settled) => {
    if (defaultCameraSettled.current === settled) return
    defaultCameraSettled.current = settled
    onDefaultCameraSettledChange?.(settled)
  }

  useEffect(() => {
    camera.position.set(0, cameraSettings.y, cameraSettings.z)
  }, [camera, biome, cameraSettings.y, cameraSettings.z])

  useFrame(({ clock }, delta) => {
    const now = clock.getElapsedTime()
    if (focusTarget) {
      setDefaultCameraSettled(false)
      focusBounds.setFromObject(focusTarget)
      let focusRadius = 0
      if (!focusBounds.isEmpty()) {
        focusBounds.getCenter(focusPosition)
        focusBounds.getBoundingSphere(focusSphere)
        focusRadius = Math.max(0, focusSphere.radius)
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

      const baseHalfFov = THREE.MathUtils.degToRad(DEFAULT_CAMERA_FOV) * 0.5
      const aspect = Math.max(0.1, camera.aspect ?? 1)
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
      desiredCameraPosition.x = THREE.MathUtils.clamp(desiredCameraPosition.x, MIN_FOLLOW_CAMERA_X, MAX_FOLLOW_CAMERA_X)
      desiredCameraPosition.y = Math.min(desiredCameraPosition.y, MAX_FOLLOW_CAMERA_Y)
      desiredCameraPosition.z = THREE.MathUtils.clamp(desiredCameraPosition.z, MIN_FOLLOW_CAMERA_Z, MAX_FOLLOW_CAMERA_Z)
      camera.position.x = THREE.MathUtils.damp(camera.position.x, desiredCameraPosition.x, FOLLOW_POSITION_DAMPING, delta)
      camera.position.y = THREE.MathUtils.damp(camera.position.y, desiredCameraPosition.y, FOLLOW_POSITION_DAMPING, delta)
      camera.position.z = THREE.MathUtils.damp(camera.position.z, desiredCameraPosition.z, FOLLOW_POSITION_DAMPING, delta)
      camera.position.x = THREE.MathUtils.clamp(camera.position.x, MIN_FOLLOW_CAMERA_X, MAX_FOLLOW_CAMERA_X)
      camera.position.y = Math.min(camera.position.y, MAX_FOLLOW_CAMERA_Y)
      camera.position.z = THREE.MathUtils.clamp(camera.position.z, MIN_FOLLOW_CAMERA_Z, MAX_FOLLOW_CAMERA_Z)

      const actualFocusDistance = Math.max(0.1, camera.position.distanceTo(framedFocus))
      const clampedShortOfRequestedDistance = activeFollowDistance - actualFocusDistance > focusRadius * 0.25
      const requiredVerticalHalfFov = focusRadius > 0 && clampedShortOfRequestedDistance ? Math.atan((focusRadius * FOLLOW_FRAME_MARGIN) / actualFocusDistance) : baseHalfFov
      const requiredHorizontalHalfFov = focusRadius > 0 && clampedShortOfRequestedDistance ? Math.atan((focusRadius * FOLLOW_FRAME_MARGIN) / (actualFocusDistance * aspect)) : baseHalfFov
      const targetFov = THREE.MathUtils.clamp(
        THREE.MathUtils.radToDeg(Math.max(baseHalfFov, requiredVerticalHalfFov, requiredHorizontalHalfFov) * 2),
        DEFAULT_CAMERA_FOV,
        MAX_FOLLOW_CAMERA_FOV,
      )
      const nextFov = THREE.MathUtils.damp(camera.fov, targetFov, FOLLOW_FOV_DAMPING, delta)
      if (Math.abs(nextFov - camera.fov) > 0.01) {
        camera.fov = nextFov
        camera.updateProjectionMatrix()
      }

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

      const clipPlaneReached = focusRadius > 0
        && actualFocusDistance - focusRadius * FOLLOW_CAMERA_CLIP_RADIUS_FRACTION <= Math.max(camera.near + 0.12, 0.22)
      if (clipPlaneReached) {
        if (cameraClipStartedAt.current === null) cameraClipStartedAt.current = now
        const clipHeld = now - cameraClipStartedAt.current >= FOLLOW_CAMERA_CLIP_GRACE_SECONDS
        const cooldownElapsed = now - lastCameraClipExitAt.current >= FOLLOW_CAMERA_CLIP_COOLDOWN_SECONDS
        if (clipHeld && cooldownElapsed) {
          lastCameraClipExitAt.current = now
          onFollowCameraClip?.()
        }
      } else {
        cameraClipStartedAt.current = null
      }
      return
    }

    cameraClipStartedAt.current = null
    previousFocusTarget.current = null
    hasSmoothedFocus.current = false
    hasSmoothedLookTarget.current = false
    const targetDefaultFov = Number.isFinite(cameraSettings.fov) ? cameraSettings.fov : DEFAULT_CAMERA_FOV
    const targetDefaultY = Number.isFinite(cameraSettings.y) ? cameraSettings.y : DEFAULT_CAMERA_Y
    const targetDefaultZ = Number.isFinite(cameraSettings.z) ? cameraSettings.z : DEFAULT_CAMERA_Z
    const targetDefaultLookY = Number.isFinite(cameraSettings.lookY) ? cameraSettings.lookY : DEFAULT_CAMERA_LOOK_Y
    const nextDefaultFov = THREE.MathUtils.damp(camera.fov, targetDefaultFov, FOLLOW_FOV_DAMPING, delta)
    if (Math.abs(nextDefaultFov - camera.fov) > 0.01) {
      camera.fov = nextDefaultFov
      camera.updateProjectionMatrix()
    }
    camera.position.x = THREE.MathUtils.damp(camera.position.x, 0, DEFAULT_POSITION_DAMPING, delta)
    camera.position.y = THREE.MathUtils.damp(camera.position.y, targetDefaultY, DEFAULT_POSITION_DAMPING, delta)
    camera.position.z = THREE.MathUtils.damp(camera.position.z, targetDefaultZ, DEFAULT_POSITION_DAMPING, delta)
    defaultLookTarget.set(camera.position.x, targetDefaultLookY, 0)
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
    defaultCameraPosition.set(0, targetDefaultY, targetDefaultZ)
    setDefaultCameraSettled(
      camera.position.distanceTo(defaultCameraPosition) <= DEFAULT_CAMERA_SETTLED_POSITION_EPSILON
      && smoothedDefaultLookTarget.current.distanceTo(defaultLookTarget) <= DEFAULT_CAMERA_SETTLED_LOOK_EPSILON,
    )
  })

  return null
}
