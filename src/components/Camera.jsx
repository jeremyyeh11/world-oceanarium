import { useThree, useFrame } from '@react-three/fiber'
import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { SURFACE_PLANE_Y } from './WaterSurface'
import { FLOOR_Y } from './Environment'

const CAMERA_LIMITS = {
  ocean: { min: -50, max: 3 },
  'tropical-river': { min: -11, max: 3 },
}

const DEFAULT_CAMERA_SETTINGS = {
  y: -3.35,
  z: 10,
  // Ease the resting up-pitch (was +0.35 / ~20° up, which pinned creatures to the
  // bottom edge) so animals can swim into the top half while the surface band and god
  // rays still crown the very top of frame. Softened further (−1.5 → −2.1, ~10.5° →
  // ~7° up) so the horizontal water ceiling stops filling the upper frame — the plane's
  // screen share is set by pitch, not focal length, so lowering pitch (not narrowing
  // fov) is what actually shrinks the distant surface. Camera position is unchanged so
  // the scale read from where the camera sits is preserved.
  lookY: -2.1,
  fov: 61,
}

const DEFAULT_CAMERA_Z = DEFAULT_CAMERA_SETTINGS.z
const DEFAULT_CAMERA_Y = DEFAULT_CAMERA_SETTINGS.y
const DEFAULT_CAMERA_LOOK_Y = DEFAULT_CAMERA_SETTINGS.lookY
const DEFAULT_CAMERA_FOV = DEFAULT_CAMERA_SETTINGS.fov
const FOLLOW_FOV_DAMPING = 3.4
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
// Keep the camera this far above the biome floor so it never dips under the terrain and
// exposes the underside of the world. This is the only positional guard the orbit needs now
// that horizontal edges/floor/background all fade cleanly.
const FOLLOW_FLOOR_CLEARANCE = 1.6

export default function Camera({ biome = 'ocean', focusTarget = null, focusCenterBoneName = null, followOrbit = { yaw: 0, pitch: 0 }, followDistance = 3.2, followScreenOffset = 0, cameraSettings = DEFAULT_CAMERA_SETTINGS, onDefaultCameraSettledChange = null, onFollowCameraClip = null }) {
  const { camera } = useThree()
  const focusBoneRef = useRef(null)
  const focusBoneTargetRef = useRef(null)
  const focusBoneNameRef = useRef(null)
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
  const minFollowCameraY = (FLOOR_Y[biome] ?? -20) + FOLLOW_FLOOR_CLEARANCE

  const setDefaultCameraSettled = (settled) => {
    if (defaultCameraSettled.current === settled) return
    defaultCameraSettled.current = settled
    onDefaultCameraSettledChange?.(settled)
  }

  // Resolve (and cache) the named body-center bone within the focused creature so the
  // camera can aim at its mass center. Re-resolves only when the target or name changes.
  const resolveFocusBone = (target, name) => {
    if (!target || !name) return null
    if (focusBoneRef.current && focusBoneTargetRef.current === target && focusBoneNameRef.current === name) {
      return focusBoneRef.current
    }
    // three.js sanitizes glТF node names (drops '.', ':' etc. — "spine.001" becomes
    // "spine001"), so try the given name first, then the sanitized form.
    const bone = target.getObjectByName(name)
      ?? target.getObjectByName(name.replace(/[\s.:/[\]]/g, ''))
      ?? null
    focusBoneRef.current = bone
    focusBoneTargetRef.current = target
    focusBoneNameRef.current = name
    return bone
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

      // Prefer the species' body-center bone as the aim point (mass center) over the AABB
      // center, which skews toward tails/fins on elongated creatures. Radius still comes
      // from the full bounding box so framing/zoom behaviour is unchanged.
      const focusBone = resolveFocusBone(focusTarget, focusCenterBoneName)
      if (focusBone) focusBone.getWorldPosition(focusPosition)

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

      // Pure fixed-distance orbit: the camera sits at focus + offset and is only clamped in Y
      // (below the surface, above the seabed). The old X/Z bounds pinned the camera whenever a
      // creature drifted near the edge of its volume, which made dragging to that side feel dead
      // and the orbit lurch — the world now fades cleanly at every angle, so those bounds are gone.
      desiredCameraPosition.copy(framedFocus).add(followOffset)
      desiredCameraPosition.y = THREE.MathUtils.clamp(desiredCameraPosition.y, minFollowCameraY, MAX_FOLLOW_CAMERA_Y)
      camera.position.x = THREE.MathUtils.damp(camera.position.x, desiredCameraPosition.x, FOLLOW_POSITION_DAMPING, delta)
      camera.position.y = THREE.MathUtils.damp(camera.position.y, desiredCameraPosition.y, FOLLOW_POSITION_DAMPING, delta)
      camera.position.z = THREE.MathUtils.damp(camera.position.z, desiredCameraPosition.z, FOLLOW_POSITION_DAMPING, delta)
      camera.position.y = THREE.MathUtils.clamp(camera.position.y, minFollowCameraY, MAX_FOLLOW_CAMERA_Y)

      const actualFocusDistance = Math.max(0.1, camera.position.distanceTo(framedFocus))
      // Constant follow FOV. Distance to the creature is controlled only by scroll/pinch, so
      // orbiting is a pure rotation at a fixed distance. (Previously the camera auto-widened
      // FOV whenever a position clamp cut it short of the requested distance, which made the
      // orbit feel like it lurched toward and away from the animal.)
      const targetFov = DEFAULT_CAMERA_FOV
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
