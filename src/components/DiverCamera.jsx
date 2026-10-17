import { useThree, useFrame } from '@react-three/fiber'
import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { SURFACE_PLANE_Y } from './WaterSurface'
import { floorHeightAt } from './Environment'
import { pushOutOfRocks } from './rockObstacles'
import { forEachFish, getFishEntry } from './fishSwim'

// Diver camera: a free camera swum with WASD (or two fingers on a phone) and aimed with the
// mouse (pointer lock: no cursor, no drag) or a finger drag. Everything an input asks for
// passes through two exponential stages before it reaches the camera, so a step in input
// comes out as an S-curve: the camera eases into a swim, carries a little drift after the
// key is let go, and eases to a stop. Look works the same way, so a fast flick of the mouse
// still lands as a slow pan.
//
// Speeds follow the tank's scale (1 WU = 25 cm): a cruise of 2.2 WU/s is an unhurried
// 0.55 m/s fin pace, and the boost is a steady 1.4 m/s, never a dash.
const SWIM_SPEED = 2.2
const SWIM_BOOST = 2.5
// Damping rates of the two move stages and the two look stages. Two equal stages of rate k
// reach ~90% of a step in about 3.9 / k seconds: ~1.6 s for a swim, ~0.9 s for a look.
const MOVE_DAMPING = 2.4
const LOOK_DAMPING = 4.4
// Radians per pixel of locked-mouse movement: about 1,900 px of mouse travel per full turn.
const MOUSE_LOOK_SPEED = 0.0014
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
// Tracking (desktop): holding the right button stops the mouse turning the view and moves an
// aim cursor over it instead, starting from the middle. The fish under the cursor is framed and
// the point on it marked; a left click while holding locks onto that point, and a left click
// detaches. The point is found by raycasting that one fish's meshes along the cursor's ray (or,
// on a miss, its nearest vertex to the ray) and is kept in the fish's own frame, so it stays on
// the same part of the body through every turn, pitch and bank (the swimming wave is drawn on
// the GPU, so a point on the tail follows the body but not the wave's sway). A sardine drawn by
// the instanced layer has no meshes of its own and is tracked by its centre.
// While locked, the look target follows the point and passes through the same two look stages
// as the mouse, so the camera trails it by the same ~0.9 s a mouse flick takes to land.
// A fish counts as under the crosshair when its body (half its length either side of its
// centre) comes within TARGET_CONE of the view axis; the current pick wins ties by
// TARGET_STICKINESS so a crowded school does not flicker between fish.
// Reach of the pick, out to where The Reefs' thinner fog still shows a large fish; a locked
// fish is let go a little further out.
const TARGET_RANGE = 80
const TRACK_RANGE = 110
const TARGET_CONE = THREE.MathUtils.degToRad(7)
const TARGET_STICKINESS = THREE.MathUtils.degToRad(1.5)
const RETICLE_MIN_PX = 34
const RETICLE_MAX_SCREEN = 0.7
const RETICLE_BODY_PAD = 1.2
const POINT_RETICLE_PX = 18
const CURSOR_PX = 22

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
const toFish = new THREE.Vector3()
const projected = new THREE.Vector3()
const trackedPoint = new THREE.Vector3()
const aimNdc = new THREE.Vector2()
const vertexWorld = new THREE.Vector3()
const aimRaycaster = new THREE.Raycaster()
const aimHits = []

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

function wrapAngle(angle) {
  return Math.atan2(Math.sin(angle), Math.cos(angle))
}

// The nearest drawn-mesh hit of the aim ray (aimRaycaster, already set) on one fish, or null.
function rayHitOnFish(fish) {
  fish.updateWorldMatrix(true, true)
  aimHits.length = 0
  aimRaycaster.intersectObject(fish, true, aimHits)
  // The hidden tap-target box surrounds the body; only a hit on a drawn mesh counts.
  let found = null
  for (const hit of aimHits) {
    if (!isBodyMesh(hit.object)) continue
    found = hit
    break
  }
  aimHits.length = 0
  return found
}

// What the aim cursor is over, written to `current`: the fish whose drawn body the ray hits
// first, and the hit point in that fish's own frame. Every fish near the ray is tested, so a
// remora riding a shark loses to the shark's flank when the cursor is on the flank. When the
// ray hits no body, the fish closest to it within TARGET_CONE is taken (the current pick wins
// ties by TARGET_STICKINESS), with its nearest vertex to the ray as the point.
function pickAimedFish(current) {
  const ray = aimRaycaster.ray
  let hitId = null
  let hitDistance = Infinity
  let nearId = null
  let nearScore = Infinity
  forEachFish((entry, id) => {
    toFish.subVectors(entry.position, ray.origin)
    const distance = toFish.length()
    if (distance < 0.5 || distance > TARGET_RANGE) return
    const cos = toFish.dot(ray.direction) / distance
    if (cos <= 0) return
    const offAxis = Math.acos(Math.min(1, cos))
    const bodyAngle = Math.atan((entry.bodyLength ?? 1) * 0.5 / distance)
    const miss = Math.max(0, offAxis - bodyAngle)
    if (miss > TARGET_CONE) return
    if (miss === 0 && entry.object) {
      const hit = rayHitOnFish(entry.object)
      if (hit && hit.distance < hitDistance) {
        hitDistance = hit.distance
        hitId = id
        trackedPoint.copy(hit.point)
      }
    }
    let score = miss + distance * 0.0015
    if (id === current.candidateId) score -= TARGET_STICKINESS
    if (score < nearScore) {
      nearScore = score
      nearId = id
    }
  })

  if (hitId != null) {
    current.candidateId = hitId
    current.aimHasPoint = true
    getFishEntry(hitId).object.worldToLocal(current.aimLocal.copy(trackedPoint))
    return
  }
  current.candidateId = nearId
  const fish = nearId != null ? getFishEntry(nearId)?.object : null
  current.aimHasPoint = Boolean(fish && nearestVertexToRay(fish, ray, trackedPoint))
  if (current.aimHasPoint) fish.worldToLocal(current.aimLocal.copy(trackedPoint))
}

function isBodyMesh(object) {
  return object.isMesh && !object.isInstancedMesh && !object.userData?.interactionProxy
}

// The vertex of a fish's meshes nearest the aim ray, in world space. A miss happens on thin fins
// and on the tail, whose drawn shape the GPU swimming wave moves off the rest geometry the ray
// tests, so the nearest vertex stands in for the part the cursor is over.
function nearestVertexToRay(fish, ray, out) {
  let bestDistanceSq = Infinity
  fish.traverse(child => {
    if (!isBodyMesh(child)) return
    const positions = child.geometry?.attributes?.position
    if (!positions) return
    for (let index = 0; index < positions.count; index += 1) {
      vertexWorld.fromBufferAttribute(positions, index).applyMatrix4(child.matrixWorld)
      const distanceSq = ray.distanceSqToPoint(vertexWorld)
      if (distanceSq < bestDistanceSq) {
        bestDistanceSq = distanceSq
        out.copy(vertexWorld)
      }
    }
  })
  return bestDistanceSq < Infinity
}

// World position of what a fish entry is tracked by: the stored body point, else its centre.
function trackedWorldPoint(entry, local, out) {
  if (local && entry.object) {
    entry.object.updateWorldMatrix(true, false)
    return entry.object.localToWorld(out.copy(local))
  }
  return out.copy(entry.position)
}

function placeReticle(element, camera, size, worldPoint, side) {
  projected.copy(worldPoint).project(camera)
  if (projected.z >= 1) return false
  const x = (projected.x + 1) * 0.5 * size.width
  const y = (1 - projected.y) * 0.5 * size.height
  element.style.width = `${side}px`
  element.style.height = `${side}px`
  element.style.transform = `translate3d(${x - side / 2}px, ${y - side / 2}px, 0)`
  return true
}

function setReticleMode(slot, mode) {
  if (mode === slot.mode) return
  slot.mode = mode
  slot.element.hidden = mode === 'hidden'
  slot.element.className = `diver-reticle diver-reticle--${slot.kind} is-${mode}`
}

// Draws the tracking marks while the right button is held: the aim cursor, a frame round the
// fish under it, and a small square on the point that is (or would be) tracked. Written
// straight to the DOM from the frame loop, so holding the button never re-renders React.
function updateReticle(reticleState, current, camera, size) {
  if (!reticleState) return
  const { cursor, frame, point } = reticleState
  let cursorMode = 'hidden'
  let frameMode = 'hidden'
  let pointMode = 'hidden'

  if (current.aiming) {
    const tracking = current.trackId != null
    const shownId = tracking ? current.trackId : current.candidateId
    const entry = shownId != null ? getFishEntry(shownId) : null
    cursorMode = 'aim'
    cursor.element.style.transform = `translate3d(${current.aimX - CURSOR_PX / 2}px, ${current.aimY - CURSOR_PX / 2}px, 0)`
    if (entry) {
      const distance = Math.max(0.01, camera.position.distanceTo(entry.position))
      const viewHeight = 2 * distance * Math.tan(THREE.MathUtils.degToRad(camera.fov) * 0.5)
      const bodyPx = ((entry.bodyLength ?? 1) * RETICLE_BODY_PAD / viewHeight) * size.height
      const frameSide = THREE.MathUtils.clamp(bodyPx, RETICLE_MIN_PX, Math.min(size.width, size.height) * RETICLE_MAX_SCREEN)
      if (placeReticle(frame.element, camera, size, entry.position, frameSide)) frameMode = tracking ? 'context' : 'candidate'
      const local = tracking ? (current.trackHasPoint ? current.trackLocal : null) : (current.aimHasPoint ? current.aimLocal : null)
      trackedWorldPoint(entry, local, trackedPoint)
      if (placeReticle(point.element, camera, size, trackedPoint, POINT_RETICLE_PX)) pointMode = tracking ? 'locked' : 'aim'
    }
  }

  setReticleMode(cursor, cursorMode)
  setReticleMode(frame, frameMode)
  setReticleMode(point, pointMode)
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

export default function DiverCamera({ active = false, biome = 'ocean', landscape = null, fov = 61, onExit = null }) {
  const camera = useThree(state => state.camera)
  const domElement = useThree(state => state.gl.domElement)
  const state = useRef(null)
  const onExitRef = useRef(onExit)
  onExitRef.current = onExit

  // Input lives in a ref: the frame loop reads it, the listeners write it, nothing re-renders.
  const input = useRef({
    keys: new Map(),
    boost: false,
    lookTargetYaw: 0,
    lookTargetPitch: 0,
    impulse: new THREE.Vector3(),
    pointers: new Map(),
    pinch: null,
    aiming: false,
    // Aim cursor in canvas pixels; null until the frame loop centres it on a fresh press.
    aimX: null,
    aimY: null,
    candidateId: null,
    // The point under the cursor on the candidate, in its frame (valid when aimHasPoint).
    aimLocal: new THREE.Vector3(),
    aimHasPoint: false,
    trackId: null,
    // The locked point, in the tracked fish's frame (its centre when trackHasPoint is false).
    trackLocal: new THREE.Vector3(),
    trackHasPoint: false,
  })
  const reticle = useRef(null)

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
    current.pinch = null
    current.aiming = false
    current.candidateId = null
    current.aimHasPoint = false
    current.trackId = null
    current.trackHasPoint = false

    // The tracking marks sit over the canvas, in the wrapper react-three-fiber gives it.
    const makeReticle = (kind) => {
      const element = document.createElement('div')
      element.setAttribute('aria-hidden', 'true')
      element.hidden = true
      domElement.parentElement?.appendChild(element)
      return { kind, element, mode: '' }
    }
    reticle.current = { frame: makeReticle('frame'), point: makeReticle('point'), cursor: makeReticle('cursor') }

    // A mouse looks through pointer lock: the cursor hides and plain movement turns the view.
    // Entering from the menu is a click, so the lock usually takes at once; if the browser
    // refuses it, the next click on the scene asks again.
    const finePointer = window.matchMedia?.('(pointer: fine)').matches ?? false
    const isLocked = () => document.pointerLockElement === domElement
    // Where the lock is refused (an embedded frame, a strict browser), plain mouse movement
    // over the scene still looks; the cursor just stops at the window edge.
    let lockRefused = false
    const onPointerLockError = () => {
      lockRefused = true
    }
    const requestLock = () => {
      if (!finePointer || isLocked() || !domElement.requestPointerLock) return
      try {
        Promise.resolve(domElement.requestPointerLock()).catch(() => {})
      } catch {
        // Unsupported or refused; the next click on the scene tries again.
      }
    }

    // The browser spends Esc on releasing the lock and never passes the key on, so a release
    // while the page still has focus is the Esc. A release from switching away is not:
    // the diver stays, and a click picks the lock back up.
    const onPointerLockChange = () => {
      if (isLocked()) return
      if (document.visibilityState === 'visible' && document.hasFocus()) onExitRef.current?.()
    }

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
      current.pinch = null
      current.pointers.clear()
      current.aiming = false
    }

    const addLook = (deltaX, deltaY, speed) => {
      // A tracked fish owns the view; detach to look around again.
      if (current.trackId != null) return
      current.lookTargetYaw -= deltaX * speed
      current.lookTargetPitch = THREE.MathUtils.clamp(current.lookTargetPitch - deltaY * speed, -MAX_PITCH, MAX_PITCH)
    }

    const onPointerDown = (event) => {
      if (event.pointerType === 'mouse') {
        requestLock()
        return
      }
      current.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY })
      current.pinch = current.pointers.size >= 2 ? touchCentroidAndSpread(current.pointers) : null
      try {
        domElement.setPointerCapture(event.pointerId)
      } catch {
        // Capture keeps a drag alive past the canvas edge; looking still works without it.
      }
    }

    const onPointerMove = (event) => {
      if (event.pointerType === 'mouse') {
        if (!isLocked() && !lockRefused) return
        // Aiming moves the cursor, one pixel per pixel; clamped to the canvas in the frame loop.
        if (current.aiming) {
          if (current.aimX != null) {
            current.aimX += event.movementX
            current.aimY += event.movementY
          }
          return
        }
        // Mouse looks the way it moves, like a first-person camera.
        addLook(event.movementX, event.movementY, MOUSE_LOOK_SPEED)
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

    // Buttons come from mouse events: a press while another button is held fires only a
    // pointermove under Pointer Events, so right-hold plus left click never reaches pointerdown.
    const onMouseDown = (event) => {
      if (event.button === 2) {
        event.preventDefault()
        current.aiming = true
        current.aimX = null
        current.aimY = null
        return
      }
      if (event.button !== 0) return
      // The click that takes the pointer lock is not a confirm.
      if (!isLocked() && !lockRefused) return
      if (current.trackId != null) {
        current.trackId = null
      } else if (current.aiming && current.candidateId != null) {
        // Lock exactly what the marks showed on the last frame.
        current.trackId = current.candidateId
        current.trackHasPoint = current.aimHasPoint
        current.trackLocal.copy(current.aimLocal)
      }
    }

    const onMouseUp = (event) => {
      if (event.button === 2) current.aiming = false
    }

    const onContextMenu = (event) => {
      event.preventDefault()
    }

    const onPointerUp = (event) => {
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
    domElement.addEventListener('mousedown', onMouseDown)
    window.addEventListener('mouseup', onMouseUp)
    domElement.addEventListener('contextmenu', onContextMenu)
    document.addEventListener('pointerlockchange', onPointerLockChange)
    document.addEventListener('pointerlockerror', onPointerLockError)
    requestLock()

    return () => {
      // Listener first, so releasing the lock on the way out is not read as an Esc.
      document.removeEventListener('pointerlockchange', onPointerLockChange)
      document.removeEventListener('pointerlockerror', onPointerLockError)
      if (isLocked()) document.exitPointerLock?.()
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('blur', releaseAll)
      domElement.removeEventListener('pointerdown', onPointerDown)
      domElement.removeEventListener('pointermove', onPointerMove)
      domElement.removeEventListener('pointerup', onPointerUp)
      domElement.removeEventListener('pointercancel', onPointerUp)
      domElement.removeEventListener('wheel', onWheel)
      domElement.removeEventListener('mousedown', onMouseDown)
      window.removeEventListener('mouseup', onMouseUp)
      domElement.removeEventListener('contextmenu', onContextMenu)
      releaseAll()
      current.trackId = null
      current.candidateId = null
      reticle.current.frame.element.remove()
      reticle.current.point.element.remove()
      reticle.current.cursor.element.remove()
      reticle.current = null
    }
  }, [active, domElement])

  useFrame((frameState, frameDelta) => {
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

    // Damped track: aim the look target at the fish and let the look stages supply the lag.
    if (current.trackId != null) {
      const tracked = getFishEntry(current.trackId)
      if (tracked) {
        trackedWorldPoint(tracked, current.trackHasPoint ? current.trackLocal : null, trackedPoint)
        toFish.subVectors(trackedPoint, camera.position)
      }
      const distance = tracked ? toFish.length() : 0
      if (!tracked || distance > TRACK_RANGE) {
        current.trackId = null
      } else if (distance > 0.01) {
        const yaw = Math.atan2(-toFish.x, -toFish.z)
        const pitch = Math.atan2(toFish.y, Math.hypot(toFish.x, toFish.z))
        current.lookTargetYaw += wrapAngle(yaw - current.lookTargetYaw)
        current.lookTargetPitch = THREE.MathUtils.clamp(pitch, -MAX_PITCH, MAX_PITCH)
      }
    }

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

    // The marks and the aim ray read this frame's pose, not the one the last render left.
    camera.updateMatrixWorld()
    const { width, height } = frameState.size
    if (current.aiming) {
      if (current.aimX == null) {
        current.aimX = width / 2
        current.aimY = height / 2
      }
      current.aimX = THREE.MathUtils.clamp(current.aimX, 0, width)
      current.aimY = THREE.MathUtils.clamp(current.aimY, 0, height)
    }
    if (current.aiming && current.trackId == null) {
      aimNdc.set((current.aimX / width) * 2 - 1, 1 - (current.aimY / height) * 2)
      aimRaycaster.setFromCamera(aimNdc, camera)
      aimRaycaster.far = TARGET_RANGE
      pickAimedFish(current)
    } else if (!current.aiming) {
      current.candidateId = null
      current.aimHasPoint = false
    }
    updateReticle(reticle.current, current, camera, frameState.size)
  })

  return null
}
