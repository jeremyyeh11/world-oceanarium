import { useThree, useFrame } from '@react-three/fiber'
import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { SURFACE_PLANE_Y } from './WaterSurface'
import { floorHeightAt } from './Environment'
import { pushOutOfRocks } from './rockObstacles'

// Diver camera: a free camera swum with WASD (or two fingers on a phone) and aimed by
// dragging. Everything an input asks for passes through two exponential stages before it
// reaches the camera, so a step in input comes out as an S-curve: the camera eases into a
// swim, carries a little drift after the key is let go, and eases to a stop. Look works the
// same way, so a fast flick of the mouse still lands as a slow pan.
//
// Speeds follow the tank's scale (1 WU = 25 cm): a cruise of 2 WU/s is a calm 0.5 m/s fin
// pace, and the boost is a steady 1.25 m/s, never a dash.
const SWIM_SPEED = 2
const SWIM_BOOST = 2.5
// Damping rates of the two move stages and the two look stages. Two equal stages of rate k
// reach ~90% of a step in about 3.9 / k seconds: ~1.6 s for a swim, ~0.9 s for a look.
const MOVE_DAMPING = 2.4
const LOOK_DAMPING = 4.4
const MOUSE_LOOK_SPEED = 0.0032
const TOUCH_LOOK_SPEED = 0.0042
// Two-finger touch: dragging the pair strafes/rises, spreading it swims forward. Each pixel
// adds this much velocity (WU/s) to the first stage, so a gesture reads as a push that the
// water then carries and slows.
const TOUCH_PAN_IMPULSE = 0.02
const TOUCH_PINCH_IMPULSE = 0.035
const WHEEL_IMPULSE = 0.006
const MAX_PITCH = THREE.MathUtils.degToRad(80)
const MAX_FRAME_DELTA = 0.1
const SURFACE_CLEARANCE = 0.35
const FLOOR_CLEARANCE = 1.0
// Body length handed to pushOutOfRocks: its pad works out to about 1 WU, like the follow cam.
const ROCK_CLEARANCE_LENGTH = 2
// Past the swim volume the world fades into fog; the diver may reach it but not leave it.
const HORIZONTAL_LIMITS = { minX: -60, maxX: 60, minZ: -70, maxZ: 30 }
const FOV_DAMPING = 3.4

const KEY_BINDINGS = {
  KeyW: ['forward', 1], ArrowUp: ['forward', 1],
  KeyS: ['forward', -1], ArrowDown: ['forward', -1],
  KeyD: ['right', 1], ArrowRight: ['right', 1],
  KeyA: ['right', -1], ArrowLeft: ['right', -1],
  KeyE: ['up', 1], Space: ['up', 1],
  KeyQ: ['up', -1], KeyC: ['up', -1],
}

const lookEuler = new THREE.Euler(0, 0, 0, 'YXZ')
const forward = new THREE.Vector3()
const right = new THREE.Vector3()
const desiredVelocity = new THREE.Vector3()
const clampedPosition = new THREE.Vector3()

function isTypingTarget(target) {
  if (!target) return false
  const tag = target.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable
}

function dampVector(current, target, lambda, delta) {
  current.x = THREE.MathUtils.damp(current.x, target.x, lambda, delta)
  current.y = THREE.MathUtils.damp(current.y, target.y, lambda, delta)
  current.z = THREE.MathUtils.damp(current.z, target.z, lambda, delta)
}

// Drops the part of `velocity` that drives into a surface with outward `normal`.
function stopIntoSurface(velocity, normal) {
  const into = velocity.dot(normal)
  if (into < 0) velocity.addScaledVector(normal, -into)
}

function touchCentroidAndSpread(points) {
  let x = 0
  let y = 0
  for (const point of points.values()) {
    x += point.x
    y += point.y
  }
  x /= points.size
  y /= points.size
  const [a, b] = points.values()
  return { x, y, spread: a && b ? Math.hypot(a.x - b.x, a.y - b.y) : 0 }
}

export default function DiverCamera({ active = false, biome = 'ocean', landscape = null, fov = 61 }) {
  const camera = useThree(state => state.camera)
  const domElement = useThree(state => state.gl.domElement)
  const state = useRef(null)

  // Input lives in a ref: the frame loop reads it, the listeners write it, nothing re-renders.
  const input = useRef({
    keys: new Map(),
    boost: false,
    lookTargetYaw: 0,
    lookTargetPitch: 0,
    impulse: new THREE.Vector3(),
    pointers: new Map(),
    mouseLook: null,
    pinch: null,
  })

  useEffect(() => {
    if (!active) {
      state.current = null
      return undefined
    }

    const current = input.current
    current.keys.clear()
    current.boost = false
    current.impulse.set(0, 0, 0)
    current.pointers.clear()
    current.mouseLook = null
    current.pinch = null

    const onKeyDown = (event) => {
      if (event.ctrlKey || event.metaKey || event.altKey || isTypingTarget(event.target)) return
      if (event.key === 'Shift') current.boost = true
      const binding = KEY_BINDINGS[event.code]
      if (!binding) return
      event.preventDefault()
      current.keys.set(event.code, binding)
    }

    const onKeyUp = (event) => {
      if (event.key === 'Shift') current.boost = false
      current.keys.delete(event.code)
    }

    const releaseAll = () => {
      current.keys.clear()
      current.boost = false
      current.mouseLook = null
      current.pinch = null
      current.pointers.clear()
    }

    const addLook = (deltaX, deltaY, speed) => {
      current.lookTargetYaw -= deltaX * speed
      current.lookTargetPitch = THREE.MathUtils.clamp(current.lookTargetPitch - deltaY * speed, -MAX_PITCH, MAX_PITCH)
    }

    const onPointerDown = (event) => {
      if (event.pointerType === 'mouse') {
        if (event.button !== 0) return
        current.mouseLook = { pointerId: event.pointerId, x: event.clientX, y: event.clientY }
      } else {
        current.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY })
        current.pinch = current.pointers.size >= 2 ? touchCentroidAndSpread(current.pointers) : null
      }
      try {
        domElement.setPointerCapture(event.pointerId)
      } catch {
        // Capture keeps a drag alive past the canvas edge; looking still works without it.
      }
    }

    const onPointerMove = (event) => {
      const mouse = current.mouseLook
      if (mouse && mouse.pointerId === event.pointerId) {
        // Mouse looks the way it moves, like a first-person camera.
        addLook(event.clientX - mouse.x, event.clientY - mouse.y, MOUSE_LOOK_SPEED)
        mouse.x = event.clientX
        mouse.y = event.clientY
        return
      }

      const point = current.pointers.get(event.pointerId)
      if (!point) return
      if (current.pointers.size === 1) {
        // One finger grabs the view, like dragging a photo sphere.
        addLook(point.x - event.clientX, point.y - event.clientY, TOUCH_LOOK_SPEED)
        point.x = event.clientX
        point.y = event.clientY
        return
      }

      point.x = event.clientX
      point.y = event.clientY
      const next = touchCentroidAndSpread(current.pointers)
      if (current.pinch) {
        // Stored in camera space (x right, y up, z back) and turned into the world in the frame.
        current.impulse.x -= (next.x - current.pinch.x) * TOUCH_PAN_IMPULSE
        current.impulse.y += (next.y - current.pinch.y) * TOUCH_PAN_IMPULSE
        current.impulse.z -= (next.spread - current.pinch.spread) * TOUCH_PINCH_IMPULSE
      }
      current.pinch = next
    }

    const onPointerUp = (event) => {
      if (current.mouseLook?.pointerId === event.pointerId) current.mouseLook = null
      current.pointers.delete(event.pointerId)
      current.pinch = current.pointers.size >= 2 ? touchCentroidAndSpread(current.pointers) : null
      try {
        if (domElement.hasPointerCapture(event.pointerId)) domElement.releasePointerCapture(event.pointerId)
      } catch {
        // Ignore stale pointer-capture cleanup.
      }
    }

    const onWheel = (event) => {
      event.preventDefault()
      const deltaY = event.deltaMode === 1 ? event.deltaY * 16 : event.deltaY
      current.impulse.z += deltaY * WHEEL_IMPULSE
    }

    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    window.addEventListener('blur', releaseAll)
    domElement.addEventListener('pointerdown', onPointerDown)
    domElement.addEventListener('pointermove', onPointerMove)
    domElement.addEventListener('pointerup', onPointerUp)
    domElement.addEventListener('pointercancel', onPointerUp)
    domElement.addEventListener('wheel', onWheel, { passive: false })

    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('blur', releaseAll)
      domElement.removeEventListener('pointerdown', onPointerDown)
      domElement.removeEventListener('pointermove', onPointerMove)
      domElement.removeEventListener('pointerup', onPointerUp)
      domElement.removeEventListener('pointercancel', onPointerUp)
      domElement.removeEventListener('wheel', onWheel)
      releaseAll()
    }
  }, [active, domElement])

  useFrame((_, frameDelta) => {
    if (!active) return
    const delta = Math.min(frameDelta, MAX_FRAME_DELTA)
    const current = input.current

    // Start from wherever the resting or follow camera left off, so entering is seamless.
    if (!state.current) {
      lookEuler.setFromQuaternion(camera.quaternion, 'YXZ')
      const pitch = THREE.MathUtils.clamp(lookEuler.x, -MAX_PITCH, MAX_PITCH)
      current.lookTargetYaw = lookEuler.y
      current.lookTargetPitch = pitch
      state.current = {
        yawLead: lookEuler.y,
        pitchLead: pitch,
        yaw: lookEuler.y,
        pitch,
        velocityLead: new THREE.Vector3(),
        velocity: new THREE.Vector3(),
      }
    }
    const diver = state.current

    diver.yawLead = THREE.MathUtils.damp(diver.yawLead, current.lookTargetYaw, LOOK_DAMPING, delta)
    diver.pitchLead = THREE.MathUtils.damp(diver.pitchLead, current.lookTargetPitch, LOOK_DAMPING, delta)
    diver.yaw = THREE.MathUtils.damp(diver.yaw, diver.yawLead, LOOK_DAMPING, delta)
    diver.pitch = THREE.MathUtils.damp(diver.pitch, diver.pitchLead, LOOK_DAMPING, delta)
    lookEuler.set(diver.pitch, diver.yaw, 0, 'YXZ')
    camera.quaternion.setFromEuler(lookEuler)

    // W swims where the camera looks, pitch included, the way a diver swims.
    camera.getWorldDirection(forward)
    right.set(Math.cos(diver.yaw), 0, -Math.sin(diver.yaw))

    let moveForward = 0
    let moveRight = 0
    let moveUp = 0
    for (const [axis, sign] of current.keys.values()) {
      if (axis === 'forward') moveForward += sign
      else if (axis === 'right') moveRight += sign
      else moveUp += sign
    }
    desiredVelocity.set(0, 0, 0)
      .addScaledVector(forward, moveForward)
      .addScaledVector(right, moveRight)
    desiredVelocity.y += moveUp
    if (desiredVelocity.lengthSq() > 1) desiredVelocity.normalize()
    desiredVelocity.multiplyScalar(SWIM_SPEED * (current.boost ? SWIM_BOOST : 1))

    // Touch and wheel pushes land on the first stage, so they ease in like a key press.
    if (current.impulse.lengthSq() > 0) {
      diver.velocityLead
        .addScaledVector(right, current.impulse.x)
        .addScaledVector(forward, -current.impulse.z)
      diver.velocityLead.y += current.impulse.y
      current.impulse.set(0, 0, 0)
    }

    dampVector(diver.velocityLead, desiredVelocity, MOVE_DAMPING, delta)
    dampVector(diver.velocity, diver.velocityLead, MOVE_DAMPING, delta)
    camera.position.addScaledVector(diver.velocity, delta)

    // Stay in the water: under the surface, over the sand, out of the rocks, inside the fog.
    clampedPosition.copy(camera.position)
    clampedPosition.x = THREE.MathUtils.clamp(clampedPosition.x, HORIZONTAL_LIMITS.minX, HORIZONTAL_LIMITS.maxX)
    clampedPosition.z = THREE.MathUtils.clamp(clampedPosition.z, HORIZONTAL_LIMITS.minZ, HORIZONTAL_LIMITS.maxZ)
    const minY = floorHeightAt(biome, landscape, clampedPosition.x, clampedPosition.z) + FLOOR_CLEARANCE
    clampedPosition.y = THREE.MathUtils.clamp(clampedPosition.y, minY, SURFACE_PLANE_Y - SURFACE_CLEARANCE)
    if (clampedPosition.x !== camera.position.x) diver.velocity.x = diver.velocityLead.x = 0
    if (clampedPosition.z !== camera.position.z) diver.velocity.z = diver.velocityLead.z = 0
    if (clampedPosition.y !== camera.position.y) diver.velocity.y = diver.velocityLead.y = 0
    const rockNormal = pushOutOfRocks(clampedPosition, ROCK_CLEARANCE_LENGTH)
    if (rockNormal) {
      stopIntoSurface(diver.velocity, rockNormal)
      stopIntoSurface(diver.velocityLead, rockNormal)
    }
    camera.position.copy(clampedPosition)

    const nextFov = THREE.MathUtils.damp(camera.fov, fov, FOV_DAMPING, delta)
    if (Math.abs(nextFov - camera.fov) > 0.01) {
      camera.fov = nextFov
      camera.updateProjectionMatrix()
    }
  })

  return null
}
