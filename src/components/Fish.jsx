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

const tangent = new THREE.Vector3()
const lookTarget = new THREE.Vector3()
const up = new THREE.Vector3(0, 1, 0)
const nextPoint = new THREE.Vector3()
const horizontalForward = new THREE.Vector3()
const pitchedForward = new THREE.Vector3()
const bankQuaternion = new THREE.Quaternion()

function hashString(value) {
  let hash = 2166136261
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
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

function makePathGeometry(path) {
  return new THREE.BufferGeometry().setFromPoints(path.getPoints(120))
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
      material.transparent = true
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

export default function Fish({ creature, selected = false, debug = false, onClick }) {
  const ref = useRef()
  const modelRootRef = useRef()
  const swim = useMemo(() => resolveSwimProfile(creature), [creature])
  const model = useMemo(() => resolveModel(creature), [creature])
  const pathSeed = useRef(hashString(creature.id ?? creature.species ?? 'fish'))
  const progress = useRef(0)
  const previousTangent = useRef(new THREE.Vector3())
  const animationCooldown = useRef(0)
  const animationHoldUntil = useRef(0)
  const velocity = useRef(0)
  const actionSpeedUntil = useRef(0)
  const actionSpeedTarget = useRef(0)
  const nextBurstAt = useRef(0)
  const animationRef = useRef('idle')
  const [animation, setAnimation] = useState('idle')
  const [path, setPath] = useState(() => makeSwimPath(creature, swim, pathSeed.current))
  const pathRef = useRef(path)
  const pathLengthRef = useRef(path.getLength())
  const splineGeometry = useMemo(() => makePathGeometry(path), [path])
  const motion = useMemo(() => {
    const rand = mulberry32(hashString(`${creature.id ?? creature.species}-motion`))
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
  }, [creature, swim])

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
    const activePath = pathRef.current
    const pathLength = Math.max(0.001, pathLengthRef.current)
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

    progress.current += delta * velocity.current / pathLength

    if (progress.current >= 1) {
      const endPoint = activePath.getPointAt(1)
      const endTangent = activePath.getTangentAt(1).normalize()

      pathSeed.current = Math.imul(pathSeed.current ^ 0x9E3779B9, 1664525) >>> 0
      const nextPath = makeSwimPath(creature, swim, pathSeed.current, endPoint, endTangent)
      pathRef.current = nextPath
      pathLengthRef.current = nextPath.getLength()
      setPath(nextPath)
      progress.current = 0
    }

    const t = THREE.MathUtils.clamp(progress.current, 0, 1)
    const currentPath = pathRef.current
    const position = currentPath.getPointAt(t)
    currentPath.getPointAt(Math.min(t + 0.006, 1), nextPoint)

    fish.position.copy(position)
    fish.position.y += Math.sin(clock.getElapsedTime() * 1.7 + motion.bobPhase) * motion.bobAmount

    const fade = depthFadeFromScreenZ(fish.position.z)
    fish.traverse(child => {
      if (!child.isMesh) return
      const materials = Array.isArray(child.material) ? child.material : [child.material]
      materials.filter(Boolean).forEach(material => {
        material.transparent = true
        material.opacity = fade
        if ('envMapIntensity' in material) material.envMapIntensity = THREE.MathUtils.lerp(0.25, 0.95, fade)
      })
    })

    tangent.subVectors(nextPoint, position).normalize()
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
      lookTarget.copy(fish.position).add(pitchedForward)
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

  return (
    <group>
      {debug && (
        <line geometry={splineGeometry} raycast={() => null}>
          <lineBasicMaterial color="#7df9ff" transparent opacity={0.55} depthWrite={false} />
        </line>
      )}
      <group
        ref={ref}
        scale={[size * focusScale, size * focusScale, size * focusScale]}
        onClick={(e) => { e.stopPropagation(); onClick(creature, ref) }}
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
