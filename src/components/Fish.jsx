import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { useAnimations, useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { clone } from 'three/examples/jsm/utils/SkeletonUtils.js'
import { SPECIES } from '../data/species'

const DEPTH_Y = {
  epipelagic: [-2.2, 3.0],
  mesopelagic: [-15, -8],
  bathypelagic: [-27, -20],
  abyssalpelagic: [-40, -34],
  hadalpelagic: [-50, -45],
  shallow: [1, 3],
  mid: [-4, -1],
  deep: [-8, -4],
  benthic: [-10, -7],
}

const SWIM_BOX = {
  x: 8.0,
  z: 7.4,
}

const SPECIES_BY_NAME = new Map(SPECIES.map(species => [species.name, species]))
const WORLD_UNIT_METERS = 0.25
const DEFAULT_SWIM = {
  bodyLengthWU: 1,
  visualTimeScale: 0.45,
  idleBLPerSec: [1.0, 1.5],
  idleDriftBLPerSec: [0.18, 0.35],
  snapBLPerSec: [3.0, 5.0],
  burstBLPerSec: [5.0, 8.0],
  burstInterval: [5.5, 9.5],
  speedMultiplier: 1,
  erraticness: 0.35,
  turnRadius: 0.65,
}
const MAX_MODEL_PITCH = THREE.MathUtils.degToRad(15)
const MAX_MODEL_BANK = THREE.MathUtils.degToRad(5)
const SNAP_TURN_THRESHOLD = 0.014
const BURST_STRAIGHT_THRESHOLD = 0.004
const SCHOOL_SPACING = 0.46
const SCHOOL_DRIFT = 0.08
const SCHOOL_PHASE_WINDOW = 0.07
const SCHOOL_FOLLOW_LOOKAHEAD_BODY_LENGTHS = 2.5

const tangent = new THREE.Vector3()
const lookTarget = new THREE.Vector3()
const up = new THREE.Vector3(0, 1, 0)
const nextPoint = new THREE.Vector3()
const schoolBasePosition = new THREE.Vector3()
const schoolTargetTangent = new THREE.Vector3()
const schoolLateral = new THREE.Vector3()
const schoolFollowDirection = new THREE.Vector3()
const debugForwardEnd = new THREE.Vector3()
const horizontalForward = new THREE.Vector3()
const pitchedForward = new THREE.Vector3()
const bankQuaternion = new THREE.Quaternion()
const SCHOOL_STATES = new Map()

function getSchoolState(school, creature, swim) {
  const key = school.id
  let state = SCHOOL_STATES.get(key)
  if (!state) {
    const seed = hashString(key)
    const path = makeSchoolPath(creature, swim, seed)
    state = {
      seed,
      path,
      pathLength: path.getLength(),
      progress: 0,
      version: 0,
    }
    SCHOOL_STATES.set(key, state)
  }
  return state
}

function hashString(value) {
  let hash = 2166136261
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

function randomSeed() {
  if (globalThis.crypto?.getRandomValues) {
    const values = new Uint32Array(1)
    globalThis.crypto.getRandomValues(values)
    return values[0]
  }

  return Math.floor(Math.random() * 0xFFFFFFFF) >>> 0
}

function mulberry32(seed) {
  return function rand() {
    let t = seed += 0x6D2B79F5
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function randomRange(rand, min, max) {
  return min + rand() * (max - min)
}

function randomRangeFromPair(rand, pair, fallback) {
  const [min, max] = Array.isArray(pair) ? pair : fallback
  return randomRange(rand, min, max)
}

function resolveSpecies(creature) {
  return SPECIES_BY_NAME.get(creature.species)
}

function resolveSwimProfile(creature) {
  const species = resolveSpecies(creature)
  const speciesSwim = species?.swim ?? DEFAULT_SWIM
  const traits = creature.traits ?? {}

  return {
    bodyLengthWU: traits.bodyLengthWU ?? speciesSwim.bodyLengthWU ?? DEFAULT_SWIM.bodyLengthWU,
    visualTimeScale: traits.visualTimeScale ?? speciesSwim.visualTimeScale ?? DEFAULT_SWIM.visualTimeScale,
    idleBLPerSec: traits.idleBLPerSec ?? speciesSwim.idleBLPerSec ?? DEFAULT_SWIM.idleBLPerSec,
    idleDriftBLPerSec: traits.idleDriftBLPerSec ?? speciesSwim.idleDriftBLPerSec ?? DEFAULT_SWIM.idleDriftBLPerSec,
    snapBLPerSec: traits.snapBLPerSec ?? speciesSwim.snapBLPerSec ?? DEFAULT_SWIM.snapBLPerSec,
    burstBLPerSec: traits.burstBLPerSec ?? speciesSwim.burstBLPerSec ?? DEFAULT_SWIM.burstBLPerSec,
    burstInterval: traits.burstInterval ?? speciesSwim.burstInterval ?? DEFAULT_SWIM.burstInterval,
    speedMultiplier: traits.swimSpeedMultiplier ?? speciesSwim.speedMultiplier ?? DEFAULT_SWIM.speedMultiplier,
    erraticness: traits.swimErraticness ?? speciesSwim.erraticness ?? DEFAULT_SWIM.erraticness,
    turnRadius: traits.turnRadius ?? speciesSwim.turnRadius ?? DEFAULT_SWIM.turnRadius,
  }
}

function resolveModel(creature) {
  const species = resolveSpecies(creature)
  return species?.model ?? null
}

function clampToSwimBox(point, yMin, yMax) {
  point.x = THREE.MathUtils.clamp(point.x, -SWIM_BOX.x, SWIM_BOX.x)
  point.y = THREE.MathUtils.clamp(point.y, yMin, yMax)
  point.z = THREE.MathUtils.clamp(point.z, -SWIM_BOX.z, SWIM_BOX.z)
  return point
}

function randomPoint(rand, yMin, yMax, swim, index = 0) {
  const midY = (yMin + yMax) / 2
  const halfY = (yMax - yMin) / 2
  const verticalRange = THREE.MathUtils.lerp(0.16, 1.0, swim.erraticness)
  const edgeBias = index % 2 === 0 ? -0.55 : 0.55

  return new THREE.Vector3(
    randomRange(rand, -SWIM_BOX.x * 0.82, SWIM_BOX.x * 0.82) + edgeBias,
    midY + randomRange(rand, -halfY * verticalRange, halfY * verticalRange),
    randomRange(rand, -SWIM_BOX.z, SWIM_BOX.z),
  )
}

function makeSwimPath(creature, swim, seed = hashString(creature.id ?? creature.species ?? 'fish'), start = null, exitTangent = null) {
  const rand = mulberry32(seed)
  const [yMin, yMax] = DEPTH_Y[creature.depthZone] ?? DEPTH_Y.epipelagic
  const pointCount = Math.round(THREE.MathUtils.lerp(8, 5, swim.turnRadius))
  const points = []

  if (start && exitTangent) {
    points.push(start.clone())

    const leadDistance = THREE.MathUtils.lerp(1.8, 5.8, swim.turnRadius) * randomRange(rand, 0.86, 1.12)
    const lead = start.clone().add(exitTangent.clone().normalize().multiplyScalar(leadDistance))
    const verticalKick = THREE.MathUtils.lerp(0.12, 0.85, swim.erraticness)
    lead.y += randomRange(rand, -verticalKick, verticalKick)
    lead.z += randomRange(rand, -0.55, 0.55)
    points.push(clampToSwimBox(lead, yMin, yMax))

    for (let i = 2; i < pointCount; i += 1) points.push(randomPoint(rand, yMin, yMax, swim, i))
  } else {
    for (let i = 0; i < pointCount; i += 1) points.push(randomPoint(rand, yMin, yMax, swim, i))
  }

  const tension = THREE.MathUtils.lerp(0.32, 0.74, swim.turnRadius)
  return new THREE.CatmullRomCurve3(points, false, 'catmullrom', tension)
}

function makeSchoolPath(creature, swim, seed = hashString(creature.species ?? 'school'), start = null, exitTangent = null) {
  const rand = mulberry32(seed)
  const [yMin, yMax] = DEPTH_Y[creature.depthZone] ?? DEPTH_Y.epipelagic
  const midY = (yMin + yMax) / 2
  const halfY = (yMax - yMin) / 2
  const pointCount = 7
  const verticalRange = THREE.MathUtils.lerp(0.18, 0.55, swim.erraticness)
  const points = []

  if (start && exitTangent) {
    points.push(start.clone())
    const leadDistance = THREE.MathUtils.lerp(2.4, 6.2, swim.turnRadius) * randomRange(rand, 0.9, 1.15)
    const lead = start.clone().add(exitTangent.clone().normalize().multiplyScalar(leadDistance))
    lead.y += randomRange(rand, -halfY * verticalRange * 0.38, halfY * verticalRange * 0.38)
    lead.z += randomRange(rand, -0.7, 0.7)
    points.push(clampToSwimBox(lead, yMin, yMax))
  }

  for (let i = points.length; i < pointCount; i += 1) {
    const sweep = i / Math.max(1, pointCount - 1)
    const sideBias = i % 2 === 0 ? -0.42 : 0.42
    points.push(new THREE.Vector3(
      THREE.MathUtils.lerp(-SWIM_BOX.x * 0.72, SWIM_BOX.x * 0.72, sweep) + randomRange(rand, -1.2, 1.2) + sideBias,
      midY + randomRange(rand, -halfY * verticalRange, halfY * verticalRange),
      randomRange(rand, -SWIM_BOX.z * 0.78, SWIM_BOX.z * 0.78),
    ))
  }

  const tension = THREE.MathUtils.lerp(0.42, 0.7, swim.turnRadius)
  return new THREE.CatmullRomCurve3(points, false, 'catmullrom', tension)
}

function schoolFormationOffset(school, creature) {
  if (!school) return null
  const rand = mulberry32(hashString(`${school.id}:${creature.id}:formation`))
  const rank = school.index - (school.count - 1) / 2
  const row = Math.floor(Math.abs(rank) / 2)
  const side = rank === 0 ? 0 : Math.sign(rank)

  return {
    phase: (school.index / school.count) * SCHOOL_PHASE_WINDOW + randomRange(rand, -0.006, 0.006),
    lateral: side * (SCHOOL_SPACING + row * 0.18) + randomRange(rand, -0.08, 0.08),
    vertical: randomRange(rand, -0.18, 0.18),
    trailing: row * 0.12 + randomRange(rand, -0.05, 0.08),
    driftPhase: randomRange(rand, 0, Math.PI * 2),
    driftSpeed: randomRange(rand, 0.75, 1.25),
  }
}

function offsetFromSchoolPoint(target, path, t, schoolOffset, now) {
  path.getPointAt(t, target)
  path.getTangentAt(t, schoolTargetTangent).normalize()

  schoolLateral.set(schoolTargetTangent.z, 0, -schoolTargetTangent.x)
  if (schoolLateral.lengthSq() < 0.0001) schoolLateral.set(1, 0, 0)
  schoolLateral.normalize()

  const drift = Math.sin(now * schoolOffset.driftSpeed + schoolOffset.driftPhase) * SCHOOL_DRIFT
  target
    .addScaledVector(schoolLateral, schoolOffset.lateral + drift)
    .addScaledVector(up, schoolOffset.vertical)
    .addScaledVector(schoolTargetTangent, -schoolOffset.trailing)

  return target
}

function makePathGeometry(path) {
  return new THREE.BufferGeometry().setFromPoints(path.getPoints(120))
}

function makeDebugLineGeometry() {
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 0, 0, 0], 3))
  return geometry
}

function updateDebugLine(lineRef, start, end) {
  const geometry = lineRef.current?.geometry
  const positions = geometry?.attributes?.position
  if (!positions) return

  positions.setXYZ(0, start.x, start.y, start.z)
  positions.setXYZ(1, end.x, end.y, end.z)
  positions.needsUpdate = true
  geometry.computeBoundingSphere()
}

function depthFadeFromScreenZ(z) {
  const normalized = THREE.MathUtils.clamp((z + SWIM_BOX.z) / (SWIM_BOX.z * 2), 0, 1)
  return THREE.MathUtils.lerp(0.22, 1.0, normalized ** 1.65)
}

function applyModelMaterialSettings(root) {
  const materials = []
  root.traverse(child => {
    if (!child.isMesh) return
    child.castShadow = false
    child.receiveShadow = false
    const list = Array.isArray(child.material) ? child.material : [child.material]
    list.filter(Boolean).forEach(material => {
      material.transparent = false
      material.opacity = 1
      material.depthWrite = true
      material.roughness = material.roughness ?? 0.5
      materials.push(material)
    })
  })
  return materials
}

function FishModel({ model, animation = 'idle' }) {
  const gltf = useGLTF(model.path)
  const object = useMemo(() => clone(gltf.scene), [gltf.scene])
  const { actions } = useAnimations(gltf.animations, object)
  const activeActionRef = useRef(null)

  useEffect(() => {
    applyModelMaterialSettings(object)
  }, [object])

  useEffect(() => {
    const nextAction = actions[animation] ?? actions.idle ?? Object.values(actions)[0]
    if (!nextAction || activeActionRef.current === nextAction) return

    nextAction.reset()
    nextAction.enabled = true
    nextAction.setEffectiveWeight(1)
    nextAction.setEffectiveTimeScale(1)

    if (animation === 'idle') {
      nextAction.setLoop(THREE.LoopRepeat, Infinity)
    } else {
      nextAction.setLoop(THREE.LoopOnce, 1)
      nextAction.clampWhenFinished = true
    }

    const previousAction = activeActionRef.current
    nextAction.play()
    if (previousAction) nextAction.crossFadeFrom(previousAction, 0.12, false)

    activeActionRef.current = nextAction
  }, [actions, animation])

  return (
    <primitive
      object={object}
      scale={model.scale ?? 1}
      rotation={model.rotation ?? [0, 0, 0]}
      position={model.position ?? [0, 0, 0]}
    />
  )
}

export default function Fish({ creature, selected = false, debug = false, school = null, onClick }) {
  const ref = useRef()
  const modelRootRef = useRef()
  const forwardLineRef = useRef()
  const followLineRef = useRef()
  const followTargetMarkerRef = useRef()
  const swim = useMemo(() => resolveSwimProfile(creature), [creature])
  const model = useMemo(() => resolveModel(creature), [creature])
  const schoolOffset = useMemo(() => schoolFormationOffset(school, creature), [school, creature])
  const isSchooling = Boolean(schoolOffset)
  const isSchoolLeader = isSchooling && school.index === 0
  const schoolState = useMemo(() => (isSchooling ? getSchoolState(school, creature, swim) : null), [isSchooling, school, creature, swim])
  const pathSeed = useRef((hashString(creature.id ?? creature.species ?? 'fish') ^ randomSeed()) >>> 0)
  const progress = useRef(0)
  const followTarget = useRef(new THREE.Vector3())
  const previousPosition = useRef(new THREE.Vector3())
  const hasFollowPosition = useRef(false)
  const previousTangent = useRef(new THREE.Vector3())
  const animationCooldown = useRef(0)
  const animationHoldUntil = useRef(0)
  const velocity = useRef(0)
  const actionSpeedUntil = useRef(0)
  const actionSpeedTarget = useRef(0)
  const nextBurstAt = useRef(0)
  const animationRef = useRef('idle')
  const [animation, setAnimation] = useState('idle')
  const [path, setPath] = useState(() => (schoolState?.path ?? makeSwimPath(creature, swim, pathSeed.current)))
  const pathRef = useRef(schoolState?.path ?? path)
  const pathLengthRef = useRef(schoolState?.pathLength ?? path.getLength())
  const splineGeometry = useMemo(() => makePathGeometry(path), [path])
  const forwardDebugGeometry = useMemo(() => makeDebugLineGeometry(), [])
  const followDebugGeometry = useMemo(() => makeDebugLineGeometry(), [])
  const motion = useMemo(() => {
    const rand = mulberry32(hashString(`${isSchooling ? school.id : (creature.id ?? creature.species)}-motion`))
    const velocityScale = swim.bodyLengthWU * swim.visualTimeScale * swim.speedMultiplier
    return {
      idleSpeed: randomRangeFromPair(rand, swim.idleBLPerSec, DEFAULT_SWIM.idleBLPerSec) * velocityScale,
      idleDrift: randomRangeFromPair(rand, swim.idleDriftBLPerSec, DEFAULT_SWIM.idleDriftBLPerSec) * velocityScale,
      idlePeriod: randomRange(rand, 4.5, 8.5),
      snapSpeed: randomRangeFromPair(rand, swim.snapBLPerSec, DEFAULT_SWIM.snapBLPerSec) * velocityScale,
      burstSpeed: randomRangeFromPair(rand, swim.burstBLPerSec, DEFAULT_SWIM.burstBLPerSec) * velocityScale,
      burstInterval: randomRangeFromPair(rand, swim.burstInterval, DEFAULT_SWIM.burstInterval),
      burstPhase: randomRange(rand, 0, 3.5),
      bobPhase: randomRange(rand, 0, Math.PI * 2),
      bobAmount: randomRange(rand, 0.035, 0.11) * THREE.MathUtils.lerp(0.45, 1.35, swim.erraticness),
      metersPerWU: WORLD_UNIT_METERS,
    }
  }, [creature, swim, isSchooling, school?.id])

  useEffect(() => {
    if (!isSchoolLeader || !school?.id) return undefined
    return () => {
      if (SCHOOL_STATES.get(school.id) === schoolState) SCHOOL_STATES.delete(school.id)
    }
  }, [isSchoolLeader, school?.id, schoolState])

  useEffect(() => {
    velocity.current = motion.idleSpeed
    nextBurstAt.current = motion.burstPhase + motion.burstInterval
  }, [motion])

  const playAnimation = (name) => {
    if (animationRef.current === name) return
    animationRef.current = name
    setAnimation(name)
  }

  useFrame(({ clock }, delta) => {
    const fish = ref.current
    if (!fish) return

    const now = clock.getElapsedTime()
    const activePath = schoolState?.path ?? pathRef.current
    const pathLength = Math.max(0.001, schoolState?.pathLength ?? pathLengthRef.current)
    const idleVelocity = Math.max(
      0.08,
      motion.idleSpeed + Math.sin(now / motion.idlePeriod + motion.bobPhase) * motion.idleDrift,
    )
    const targetVelocity = now < actionSpeedUntil.current ? actionSpeedTarget.current : idleVelocity
    const velocityResponse = now < actionSpeedUntil.current ? 8 : 2.4

    velocity.current = THREE.MathUtils.lerp(
      velocity.current,
      targetVelocity,
      1 - Math.exp(-delta * velocityResponse),
    )

    if (isSchooling) {
      if (isSchoolLeader) schoolState.progress += delta * velocity.current / pathLength
    } else {
      progress.current += delta * velocity.current / pathLength
    }

    const pathProgress = isSchooling ? schoolState.progress : progress.current
    const shouldAdvanceSchoolPath = isSchooling && isSchoolLeader && pathProgress >= 1 - SCHOOL_PHASE_WINDOW
    if ((!isSchooling && progress.current >= 1) || shouldAdvanceSchoolPath) {
      const endPoint = activePath.getPointAt(1)
      const endTangent = activePath.getTangentAt(1).normalize()

      if (isSchooling) {
        schoolState.seed = Math.imul(schoolState.seed ^ 0x9E3779B9, 1664525) >>> 0
        const nextPath = makeSchoolPath(creature, swim, schoolState.seed, endPoint, endTangent)
        schoolState.path = nextPath
        schoolState.pathLength = nextPath.getLength()
        schoolState.progress = 0
        schoolState.version += 1
        pathRef.current = nextPath
        pathLengthRef.current = schoolState.pathLength
        setPath(nextPath)
      } else {
        pathSeed.current = Math.imul(pathSeed.current ^ 0x9E3779B9, 1664525) >>> 0
        const nextPath = makeSwimPath(creature, swim, pathSeed.current, endPoint, endTangent)
        pathRef.current = nextPath
        pathLengthRef.current = nextPath.getLength()
        setPath(nextPath)
        progress.current = 0
      }
    }

    if (isSchooling && schoolState.path !== pathRef.current) {
      pathRef.current = schoolState.path
      pathLengthRef.current = schoolState.pathLength
      setPath(schoolState.path)
    }

    const t = THREE.MathUtils.clamp((isSchooling ? schoolState.progress : progress.current) + (schoolOffset?.phase ?? 0), 0, 1)
    const currentPath = pathRef.current
    const position = isSchooling
      ? offsetFromSchoolPoint(schoolBasePosition, currentPath, t, schoolOffset, now)
      : currentPath.getPointAt(t)
    currentPath.getPointAt(Math.min(t + 0.006, 1), nextPoint)
    tangent.subVectors(nextPoint, currentPath.getPointAt(t)).normalize()

    if (isSchooling) {
      const followDistance = swim.bodyLengthWU * (creature.size ?? 1) * SCHOOL_FOLLOW_LOOKAHEAD_BODY_LENGTHS
      const followTargetT = THREE.MathUtils.clamp(t + followDistance / pathLength, 0, 1)
      offsetFromSchoolPoint(followTarget.current, currentPath, followTargetT, schoolOffset, now)

      if (!hasFollowPosition.current) {
        fish.position.copy(position)
        previousPosition.current.copy(fish.position)
        hasFollowPosition.current = true
      } else {
        previousPosition.current.copy(fish.position)
        schoolFollowDirection.subVectors(followTarget.current, fish.position)
        const targetDistance = schoolFollowDirection.length()
        if (targetDistance > 0.0001) {
          schoolFollowDirection.normalize()
          const catchup = THREE.MathUtils.clamp(targetDistance / Math.max(0.001, followDistance), 0.55, 1.65)
          fish.position.addScaledVector(schoolFollowDirection, Math.min(targetDistance, velocity.current * catchup * delta))
          tangent.subVectors(fish.position, previousPosition.current)
          if (tangent.lengthSq() > 0.000001) {
            tangent.normalize()
          } else {
            tangent.copy(schoolFollowDirection)
          }
        }
      }
    } else {
      fish.position.copy(position)
      fish.position.y += Math.sin(clock.getElapsedTime() * 1.7 + motion.bobPhase) * motion.bobAmount
    }

    if (debug) {
      debugForwardEnd.copy(fish.position).addScaledVector(tangent, 1.2)
      updateDebugLine(forwardLineRef, fish.position, debugForwardEnd)
      updateDebugLine(followLineRef, fish.position, followTarget.current)
      if (followTargetMarkerRef.current) followTargetMarkerRef.current.position.copy(followTarget.current)
    }

    const fade = depthFadeFromScreenZ(fish.position.z)
    fish.traverse(child => {
      if (!child.isMesh) return
      const materials = Array.isArray(child.material) ? child.material : [child.material]
      materials.filter(Boolean).forEach(material => {
        if (model) {
          material.transparent = false
          material.opacity = 1
          if ('envMapIntensity' in material) material.envMapIntensity = THREE.MathUtils.lerp(0.45, 0.95, fade)
          return
        }

        material.transparent = true
        material.opacity = fade
        if ('envMapIntensity' in material) material.envMapIntensity = THREE.MathUtils.lerp(0.25, 0.95, fade)
      })
    })

    if (model) {
      horizontalForward.set(tangent.x, 0, tangent.z)
      if (horizontalForward.lengthSq() < 0.0001) horizontalForward.set(0, 0, -1)
      horizontalForward.normalize()

      const modelPitch = THREE.MathUtils.clamp(
        Math.atan2(tangent.y, Math.max(0.0001, Math.hypot(tangent.x, tangent.z))),
        -MAX_MODEL_PITCH,
        MAX_MODEL_PITCH,
      )
      pitchedForward
        .copy(horizontalForward)
        .multiplyScalar(Math.cos(modelPitch))
        .addScaledVector(up, Math.sin(modelPitch))
        .normalize()

      fish.up.copy(up)
      lookTarget.copy(fish.position).addScaledVector(pitchedForward, -1)
      fish.lookAt(lookTarget)
    } else {
      lookTarget.copy(fish.position).add(tangent)
      fish.lookAt(lookTarget)
      fish.rotateY(Math.PI / 2)
    }

    const pitch = THREE.MathUtils.clamp(tangent.y * 0.55, -0.32, 0.32)
    if (!model) fish.rotateZ(pitch)
    fish.up.lerp(up, 0.18)

    if (model) {
      let turn = 0
      if (previousTangent.current.lengthSq() > 0) {
        turn = previousTangent.current.x * tangent.z - previousTangent.current.z * tangent.x
      }
      if (previousTangent.current.lengthSq() > 0 && now > animationCooldown.current && now > animationHoldUntil.current) {
        if (turn > SNAP_TURN_THRESHOLD) {
          playAnimation('snap_left')
          actionSpeedUntil.current = now + 0.34
          actionSpeedTarget.current = motion.snapSpeed
          animationHoldUntil.current = now + 0.32
          animationCooldown.current = now + 0.7
        } else if (turn < -SNAP_TURN_THRESHOLD) {
          playAnimation('snap_right')
          actionSpeedUntil.current = now + 0.34
          actionSpeedTarget.current = motion.snapSpeed
          animationHoldUntil.current = now + 0.32
          animationCooldown.current = now + 0.7
        } else if (Math.abs(turn) < BURST_STRAIGHT_THRESHOLD && now > nextBurstAt.current) {
          playAnimation('burst')
          actionSpeedUntil.current = now + 0.5
          actionSpeedTarget.current = motion.burstSpeed
          animationHoldUntil.current = now + 0.46
          animationCooldown.current = now + 1.0
          nextBurstAt.current = now + motion.burstInterval
        }
      } else if (now > animationHoldUntil.current) {
        playAnimation('idle')
      }

      const bank = THREE.MathUtils.clamp(turn * 4, -MAX_MODEL_BANK, MAX_MODEL_BANK)
      bankQuaternion.setFromAxisAngle(pitchedForward, -bank)
      fish.quaternion.premultiply(bankQuaternion)

      previousTangent.current.copy(tangent)
    }
  })

  const size = creature.size ?? 1
  const focusScale = selected ? 1.08 : 1

  const handleSelect = (event) => {
    event.stopPropagation()
    event.nativeEvent?.stopImmediatePropagation?.()
    event.nativeEvent?.preventDefault?.()
    if (event.delta > 8) return
    onClick(creature, ref)
  }

  return (
    <group>
      {debug && (
        <>
          {(!isSchooling || isSchoolLeader) && (
            <line geometry={splineGeometry} raycast={() => null}>
              <lineBasicMaterial color="#7df9ff" transparent opacity={0.55} depthWrite={false} />
            </line>
          )}
          <line ref={forwardLineRef} geometry={forwardDebugGeometry} raycast={() => null}>
            <lineBasicMaterial color="#ff4fd8" transparent opacity={0.95} depthWrite={false} />
          </line>
          {isSchooling && (
            <>
              <line ref={followLineRef} geometry={followDebugGeometry} raycast={() => null}>
                <lineBasicMaterial color="#ffd166" transparent opacity={0.85} depthWrite={false} />
              </line>
              <mesh ref={followTargetMarkerRef} raycast={() => null}>
                <sphereGeometry args={[0.08, 8, 8]} />
                <meshBasicMaterial color="#ffd166" transparent opacity={0.9} depthWrite={false} />
              </mesh>
            </>
          )}
        </>
      )}
      <group
        ref={ref}
        scale={[size * focusScale, size * focusScale, size * focusScale]}
        onPointerUp={handleSelect}
        onClick={handleSelect}
      >
        <group ref={modelRootRef}>
          {model ? (
            <FishModel model={model} animation={animation} />
          ) : (
            <mesh>
              <boxGeometry args={[0.7, 0.28, 0.18]} />
              <meshStandardMaterial
                color={creature.color ?? '#7ab8c0'}
                roughness={0.42}
                metalness={0.02}
                envMapIntensity={0.85}
                transparent
                opacity={1}
              />
            </mesh>
          )}
        </group>
      </group>
    </group>
  )
}

useGLTF.preload('/models/fish/sardine/sardine.glb')
