import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { Text, useAnimations, useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { clone } from 'three/examples/jsm/utils/SkeletonUtils.js'
import { SPECIES, WORLD_UNIT_METERS } from '../data/species'
import { triggerFishSwimSound } from '../hooks/useOceanAudio'

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
const MIN_LARGE_CREATURE_PITCH = THREE.MathUtils.degToRad(7)
const SMALL_CREATURE_TURN_RATE = THREE.MathUtils.degToRad(220)
const LARGE_CREATURE_TURN_RATE = THREE.MathUtils.degToRad(42)
const MAX_PATH_Y_GRADIENT = 0.2
const PATH_VERTICAL_TRAVERSAL_BIAS = 0.82
const PATH_VERTICAL_TRAVERSAL_JITTER = 0.16
const MAX_MODEL_BANK = THREE.MathUtils.degToRad(5)
const SNAP_TURN_THRESHOLD = 0.014
const BURST_STRAIGHT_THRESHOLD = 0.004
const FISH_SFX_MIN_INTERVAL = 0.75
const SCHOOL_SFX_LEADER_ONLY = true
const SELECTED_OUTLINE_COLOR = '#57c7e8'
const LEADER_OUTLINE_COLOR = '#80ff72'
const SELECTED_OUTLINE_OPACITY = 0.18
const LEADER_OUTLINE_OPACITY = 0.16
const SCHOOL_SPACING = 0.58
const SCHOOL_FORMATION_RADIUS_SCALE = 0.55
const SCHOOL_VERTICAL_SPREAD = 0.92
const SCHOOL_LONGITUDINAL_SPREAD = 0.55
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5))
const SCHOOL_DRIFT = 0.10
const PERSONAL_SPEED_SCALE = [0.94, 1.08]
const PERSONAL_CATCHUP_SCALE = [0.90, 1.15]
const ORGANIC_NOISE_AMPLITUDE = 0.055
const ORGANIC_NOISE_RESPONSE = 1.15
const ORGANIC_NOISE_INTERVAL = [1.8, 3.8]
const DEBUG_FORWARD_SPEED_SCALE = 0.625
const DEBUG_FORWARD_MIN_LENGTH = 0.11
const DEBUG_LABEL_SCALE = 0.0525
const LOD_DEBUG_LABEL_SCALE = 0.0575
const DEBUG_LABEL_FONT = '/fonts/DejaVuSansMono.ttf'
const SCHOOL_PHASE_WINDOW = 0.07
const SCHOOL_FOLLOW_LOOKAHEAD_BODY_LENGTHS = 2.5
const SOLO_FOLLOW_LOOKAHEAD_BODY_LENGTHS = 1.5
const SOLO_FOLLOW_LOOKAHEAD_MIN = 0.35
const PATH_EDGE_PADDING = 0.75
const PATH_VERTICAL_PADDING = 0.16
const FISH_SEPARATION_PADDING = 0.18
const DENSE_SCHOOL_MIN_COUNT = 12
const DENSE_SCHOOL_RADIUS_SCALE = 0.58
const DENSE_SCHOOL_PADDING_SCALE = 0.2
const AVOIDANCE_SMOOTHING = 3.4
const AVOIDANCE_MAX_WEIGHT = 0.28
const DENSE_SCHOOL_MAX_AVOIDANCE_ANGLE = THREE.MathUtils.degToRad(28)
const DEFAULT_MAX_AVOIDANCE_ANGLE = THREE.MathUtils.degToRad(62)
const LOD_FADE_SECONDS = 0.42
const LOD_HYSTERESIS = 1.25

const tangent = new THREE.Vector3()
const lookTarget = new THREE.Vector3()
const up = new THREE.Vector3(0, 1, 0)
const nextPoint = new THREE.Vector3()
const schoolBasePosition = new THREE.Vector3()
const schoolTargetTangent = new THREE.Vector3()
const schoolLateral = new THREE.Vector3()
const schoolFollowDirection = new THREE.Vector3()
const debugForwardStart = new THREE.Vector3()
const debugForwardEnd = new THREE.Vector3()
const horizontalForward = new THREE.Vector3()
const pitchedForward = new THREE.Vector3()
const rawVisualForward = new THREE.Vector3()
const splineVisualTangent = new THREE.Vector3()
const bankQuaternion = new THREE.Quaternion()
const separationDelta = new THREE.Vector3()
const SCHOOL_STATES = new Map()
const FISH_REGISTRY = new Map()

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

  return {
    bodyLengthWU: speciesSwim.bodyLengthWU ?? DEFAULT_SWIM.bodyLengthWU,
    visualTimeScale: speciesSwim.visualTimeScale ?? DEFAULT_SWIM.visualTimeScale,
    idleBLPerSec: speciesSwim.idleBLPerSec ?? DEFAULT_SWIM.idleBLPerSec,
    idleDriftBLPerSec: speciesSwim.idleDriftBLPerSec ?? DEFAULT_SWIM.idleDriftBLPerSec,
    snapBLPerSec: speciesSwim.snapBLPerSec ?? DEFAULT_SWIM.snapBLPerSec,
    burstBLPerSec: speciesSwim.burstBLPerSec ?? DEFAULT_SWIM.burstBLPerSec,
    burstInterval: speciesSwim.burstInterval ?? DEFAULT_SWIM.burstInterval,
    speedMultiplier: speciesSwim.speedMultiplier ?? DEFAULT_SWIM.speedMultiplier,
    erraticness: speciesSwim.erraticness ?? DEFAULT_SWIM.erraticness,
    turnRadius: speciesSwim.turnRadius ?? DEFAULT_SWIM.turnRadius,
  }
}

function resolveModel(creature) {
  const species = resolveSpecies(creature)
  return species?.model ?? null
}

function resolveModelLods(model) {
  if (!model) return []
  if (!Array.isArray(model.lods) || model.lods.length === 0) return [model]
  return model.lods.map(lod => ({ ...model, ...lod }))
}

function resolveLodIndex(modelLods, distance, activeIndex = 0, selected = false) {
  if (selected || modelLods.length <= 1) return 0
  const active = modelLods[activeIndex]
  if (active?.maxDistance && distance <= active.maxDistance + LOD_HYSTERESIS) return activeIndex
  if (activeIndex > 0) {
    const previous = modelLods[activeIndex - 1]
    if (previous?.maxDistance && distance < previous.maxDistance - LOD_HYSTERESIS) return activeIndex - 1
  }

  const nextIndex = modelLods.findIndex(lod => !lod.maxDistance || distance <= lod.maxDistance)
  return nextIndex === -1 ? modelLods.length - 1 : nextIndex
}

function creatureBodyLength(creature, swim) {
  return swim.bodyLengthWU * (creature.size ?? 1)
}

function largeCreatureFactor(creature, swim) {
  return THREE.MathUtils.clamp((creatureBodyLength(creature, swim) - 1.0) / 6.5, 0, 1)
}

function effectiveTurnRadius(creature, swim) {
  return THREE.MathUtils.clamp(swim.turnRadius + largeCreatureFactor(creature, swim) * 0.32, 0, 1)
}

function verticalPathScale(creature, swim) {
  return THREE.MathUtils.lerp(1, 0.32, largeCreatureFactor(creature, swim))
}

function maxVisualPitch(creature, swim) {
  return THREE.MathUtils.lerp(MAX_MODEL_PITCH, MIN_LARGE_CREATURE_PITCH, largeCreatureFactor(creature, swim))
}

function turnRateForCreature(creature, swim) {
  return THREE.MathUtils.lerp(SMALL_CREATURE_TURN_RATE, LARGE_CREATURE_TURN_RATE, largeCreatureFactor(creature, swim))
}

function rotateDirectionToward(current, target, maxAngle) {
  if (current.lengthSq() < 0.000001) return current.copy(target)
  const angle = current.angleTo(target)
  if (angle <= maxAngle) return current.copy(target)
  const alpha = maxAngle / Math.max(0.000001, angle)
  return current.lerp(target, alpha).normalize()
}

function clampedVisualPitch(direction, pitchLimit) {
  const horizontal = Math.max(0.0001, Math.hypot(direction.x, direction.z))
  const gradientLimit = Math.atan(MAX_PATH_Y_GRADIENT)
  const limit = Math.min(pitchLimit, gradientLimit)
  return THREE.MathUtils.clamp(Math.atan2(direction.y, horizontal), -limit, limit)
}

function setForwardWithPitch(out, horizontalDirection, pitch) {
  out
    .copy(horizontalDirection)
    .multiplyScalar(Math.cos(pitch))
    .addScaledVector(up, Math.sin(pitch))
    .normalize()
  return out
}

function enforceForwardPitchLimit(direction, pitchLimit) {
  horizontalForward.set(direction.x, 0, direction.z)
  if (horizontalForward.lengthSq() < 0.0001) horizontalForward.set(0, 0, -1)
  horizontalForward.normalize()
  return setForwardWithPitch(direction, horizontalForward, clampedVisualPitch(direction, pitchLimit))
}

function debugForwardOffset(creature, swim, model) {
  if (model?.debugForwardOrigin === 'head') return 0
  if (Number.isFinite(model?.debugForwardOffsetWU)) return model.debugForwardOffsetWU
  const size = creature.size ?? 1
  if (!model) return 0.35 * size
  return creatureBodyLength(creature, swim) * 0.42
}

function swimBounds(depthZone, swim = DEFAULT_SWIM, size = 1) {
  const [rawYMin, rawYMax] = DEPTH_Y[depthZone] ?? DEPTH_Y.epipelagic
  const bodyLength = swim.bodyLengthWU * size
  const bodyMargin = Math.max(PATH_EDGE_PADDING, Math.min(2.2, bodyLength * 0.35))
  const verticalMargin = Math.min((rawYMax - rawYMin) * 0.16, Math.max(PATH_VERTICAL_PADDING, Math.min(0.58, bodyLength * 0.16)))
  return {
    x: Math.max(1.5, SWIM_BOX.x - bodyMargin),
    z: Math.max(1.5, SWIM_BOX.z - bodyMargin),
    yMin: rawYMin + verticalMargin,
    yMax: rawYMax - verticalMargin,
  }
}

function clampToSwimBox(point, yMin, yMax, xLimit = SWIM_BOX.x - PATH_EDGE_PADDING, zLimit = SWIM_BOX.z - PATH_EDGE_PADDING) {
  point.x = THREE.MathUtils.clamp(point.x, -xLimit, xLimit)
  point.y = THREE.MathUtils.clamp(point.y, yMin, yMax)
  point.z = THREE.MathUtils.clamp(point.z, -zLimit, zLimit)
  return point
}

function limitPathYGradient(points, bounds, maxGradient = MAX_PATH_Y_GRADIENT) {
  for (let i = 1; i < points.length; i += 1) {
    const prev = points[i - 1]
    const point = points[i]
    const horizontalDistance = Math.max(0.001, Math.hypot(point.x - prev.x, point.z - prev.z))
    const maxDeltaY = horizontalDistance * maxGradient
    point.y = THREE.MathUtils.clamp(
      point.y,
      Math.max(bounds.yMin, prev.y - maxDeltaY),
      Math.min(bounds.yMax, prev.y + maxDeltaY),
    )
  }
  return points
}

function clampFishPosition(point, creature, swim) {
  const bounds = swimBounds(creature.depthZone, swim, creature.size ?? 1)
  return clampToSwimBox(point, bounds.yMin, bounds.yMax, bounds.x, bounds.z)
}

function traversalY(rand, bounds, swim, index = 0, verticalScale = 1, rangeFloor = 0.42) {
  const midY = (bounds.yMin + bounds.yMax) / 2
  const halfY = (bounds.yMax - bounds.yMin) / 2
  const verticalRange = THREE.MathUtils.clamp(
    THREE.MathUtils.lerp(rangeFloor, 1.0, swim.erraticness) * verticalScale,
    0,
    1,
  )
  const direction = index % 2 === 0 ? -1 : 1
  const bandCenter = midY + direction * halfY * verticalRange * PATH_VERTICAL_TRAVERSAL_BIAS
  const jitter = halfY * verticalRange * PATH_VERTICAL_TRAVERSAL_JITTER
  return THREE.MathUtils.clamp(bandCenter + randomRange(rand, -jitter, jitter), bounds.yMin, bounds.yMax)
}

function randomPoint(rand, bounds, swim, index = 0, verticalScale = 1) {
  const side = index % 2 === 0 ? -1 : 1
  const laneJitter = bounds.x * 0.12

  return new THREE.Vector3(
    side * bounds.x * 0.72 + randomRange(rand, -laneJitter, laneJitter),
    traversalY(rand, bounds, swim, index, verticalScale, 0.52),
    randomRange(rand, -bounds.z, bounds.z),
  )
}

function makeSwimPath(creature, swim, seed = hashString(creature.id ?? creature.species ?? 'fish'), start = null, exitTangent = null) {
  const rand = mulberry32(seed)
  const bounds = swimBounds(creature.depthZone, swim, creature.size ?? 1)
  const turnRadius = effectiveTurnRadius(creature, swim)
  const verticalScale = verticalPathScale(creature, swim)
  const pointCount = Math.round(THREE.MathUtils.lerp(8, 4, turnRadius))
  const points = []

  if (start && exitTangent) {
    points.push(start.clone())

    const leadDistance = THREE.MathUtils.lerp(1.8, 7.2, turnRadius) * THREE.MathUtils.lerp(1, 1.45, largeCreatureFactor(creature, swim)) * randomRange(rand, 0.86, 1.12)
    const lead = start.clone().add(exitTangent.clone().normalize().multiplyScalar(leadDistance))
    const verticalKick = THREE.MathUtils.lerp(0.12, 0.85, swim.erraticness) * verticalScale
    lead.y += randomRange(rand, -verticalKick, verticalKick)
    lead.z += randomRange(rand, -0.55, 0.55)
    points.push(clampToSwimBox(lead, bounds.yMin, bounds.yMax, bounds.x, bounds.z))

    for (let i = 2; i < pointCount; i += 1) points.push(randomPoint(rand, bounds, swim, i, verticalScale))
  } else {
    for (let i = 0; i < pointCount; i += 1) points.push(randomPoint(rand, bounds, swim, i, verticalScale))
  }

  limitPathYGradient(points, bounds)
  const tension = THREE.MathUtils.lerp(0.32, 0.78, turnRadius)
  return new THREE.CatmullRomCurve3(points, false, 'catmullrom', tension)
}

function rotatedSchoolPoint(rand, bounds, swim, index, pointCount, verticalScale, rotation, weavePhase) {
  const normalized = pointCount <= 1 ? 0 : index / (pointCount - 1)
  const side = index % 2 === 0 ? -1 : 1
  const depthSide = Math.floor(index / 2) % 2 === 0 ? -1 : 1
  const weave = Math.sin(normalized * Math.PI * 2.35 + weavePhase) * bounds.z * 0.26
  const localX = side * bounds.x * randomRange(rand, 0.54, 0.82) + randomRange(rand, -bounds.x * 0.14, bounds.x * 0.14)
  const localZ = depthSide * bounds.z * randomRange(rand, 0.36, 0.74) + weave + randomRange(rand, -bounds.z * 0.18, bounds.z * 0.18)
  const cos = Math.cos(rotation)
  const sin = Math.sin(rotation)

  return clampToSwimBox(new THREE.Vector3(
    localX * cos - localZ * sin,
    traversalY(rand, bounds, swim, index, verticalScale, 0.62),
    localX * sin + localZ * cos,
  ), bounds.yMin, bounds.yMax, bounds.x, bounds.z)
}

function makeSchoolPath(creature, swim, seed = hashString(creature.species ?? 'school'), start = null, exitTangent = null) {
  const rand = mulberry32(seed)
  const bounds = swimBounds(creature.depthZone, swim, creature.size ?? 1)
  const turnRadius = effectiveTurnRadius(creature, swim)
  const pointCount = Math.round(THREE.MathUtils.lerp(8, 5, turnRadius))
  const verticalScale = verticalPathScale(creature, swim)
  const rotation = randomRange(rand, -Math.PI, Math.PI)
  const weavePhase = randomRange(rand, 0, Math.PI * 2)
  const points = []

  if (start && exitTangent) {
    points.push(start.clone())
    const leadDistance = THREE.MathUtils.lerp(2.4, 7.0, turnRadius) * THREE.MathUtils.lerp(1, 1.35, largeCreatureFactor(creature, swim)) * randomRange(rand, 0.9, 1.15)
    const lead = start.clone().add(exitTangent.clone().normalize().multiplyScalar(leadDistance))
    lead.y = THREE.MathUtils.lerp(lead.y, traversalY(rand, bounds, swim, 1, verticalScale, 0.62), 0.58)
    lead.z += randomRange(rand, -0.7, 0.7)
    points.push(clampToSwimBox(lead, bounds.yMin, bounds.yMax, bounds.x, bounds.z))
  }

  for (let i = points.length; i < pointCount; i += 1) {
    points.push(rotatedSchoolPoint(rand, bounds, swim, i, pointCount, verticalScale, rotation, weavePhase))
  }

  limitPathYGradient(points, bounds)
  const tension = THREE.MathUtils.lerp(0.42, 0.76, turnRadius)
  return new THREE.CatmullRomCurve3(points, false, 'catmullrom', tension)
}

function schoolFormationOffset(school, creature) {
  if (!school) return null
  const rand = mulberry32(hashString(`${school.id}:${creature.id}:formation`))
  const count = Math.max(1, school.count)
  const indexRadius = Math.sqrt((school.index + 0.5) / count)
  const schoolRadius = SCHOOL_SPACING * Math.sqrt(count) * SCHOOL_FORMATION_RADIUS_SCALE
  const angle = school.index * GOLDEN_ANGLE + randomRange(rand, -0.14, 0.14)
  const isLeader = school.index === 0
  const longitudinal = isLeader
    ? schoolRadius * SCHOOL_LONGITUDINAL_SPREAD * 0.52
    : (
      Math.sin(school.index * GOLDEN_ANGLE * 0.73) * 0.55 + randomRange(rand, -0.45, 0.45)
    ) * schoolRadius * SCHOOL_LONGITUDINAL_SPREAD
  const phaseRank = isLeader ? 1 : (count - 1 - school.index) / count

  return {
    phase: phaseRank * SCHOOL_PHASE_WINDOW + randomRange(rand, -0.006, 0.006),
    lateral: Math.cos(angle) * schoolRadius * indexRadius + randomRange(rand, -0.045, 0.045),
    vertical: Math.sin(angle) * schoolRadius * indexRadius * SCHOOL_VERTICAL_SPREAD + randomRange(rand, -0.045, 0.045),
    longitudinal,
    driftPhase: randomRange(rand, 0, Math.PI * 2),
    driftSpeed: randomRange(rand, 0.75, 1.25),
  }
}

function currentSchoolDrift(schoolOffset, now) {
  if (!schoolOffset) return 0
  return Math.sin(now * schoolOffset.driftSpeed + schoolOffset.driftPhase) * SCHOOL_DRIFT
}

function offsetFromSchoolPoint(target, path, t, schoolOffset, now, organicNoise = null) {
  path.getPointAt(t, target)
  path.getTangentAt(t, schoolTargetTangent).normalize()

  schoolLateral.set(schoolTargetTangent.z, 0, -schoolTargetTangent.x)
  if (schoolLateral.lengthSq() < 0.0001) schoolLateral.set(1, 0, 0)
  schoolLateral.normalize()

  const drift = currentSchoolDrift(schoolOffset, now)
  target
    .addScaledVector(schoolLateral, schoolOffset.lateral + drift + (organicNoise?.lateral ?? 0))
    .addScaledVector(up, schoolOffset.vertical + (organicNoise?.vertical ?? 0))
    .addScaledVector(schoolTargetTangent, schoolOffset.longitudinal + (organicNoise?.longitudinal ?? 0))

  return target
}

function followLookaheadDistance(creature, swim, isSchooling) {
  const bodyLength = swim.bodyLengthWU * (creature.size ?? 1)
  if (isSchooling) return bodyLength * SCHOOL_FOLLOW_LOOKAHEAD_BODY_LENGTHS

  return Math.max(
    bodyLength * SOLO_FOLLOW_LOOKAHEAD_BODY_LENGTHS,
    SOLO_FOLLOW_LOOKAHEAD_MIN,
  )
}

function fishCollisionRadius(creature, swim, school = null) {
  const baseRadius = Math.max(0.24, swim.bodyLengthWU * (creature.size ?? 1) * 0.42)
  return school?.count >= DENSE_SCHOOL_MIN_COUNT ? baseRadius * DENSE_SCHOOL_RADIUS_SCALE : baseRadius
}

function separationPaddingForPair(school, other) {
  if (school?.id && other.schoolId === school.id && school.count >= DENSE_SCHOOL_MIN_COUNT) {
    return FISH_SEPARATION_PADDING * DENSE_SCHOOL_PADDING_SCALE
  }
  return FISH_SEPARATION_PADDING
}

function avoidanceWeightForPair(creature, swim, school, other) {
  const bodyScale = THREE.MathUtils.clamp(swim.bodyLengthWU * (creature.size ?? 1), 0.35, 1.8)
  const sameSchool = school?.id && other.schoolId === school.id
  if (!sameSchool) return bodyScale

  const density = 1 / Math.sqrt(Math.max(1, school.count))
  const denseScale = school.count >= DENSE_SCHOOL_MIN_COUNT ? 0.34 : 0.75
  return bodyScale * density * denseScale
}

function computeSoftAvoidance(out, fish, creature, swim, school = null) {
  const radius = fishCollisionRadius(creature, swim, school)
  out.set(0, 0, 0)

  FISH_REGISTRY.forEach((other, id) => {
    if (id === creature.id || other.biome !== creature.biome) return
    separationDelta.subVectors(fish.position, other.position)
    separationDelta.y *= 0.35
    const distanceSq = separationDelta.lengthSq()
    const pairPadding = separationPaddingForPair(school, other)
    const minDistance = radius + other.radius + pairPadding
    if (distanceSq >= minDistance * minDistance) return

    if (distanceSq < 0.000001) {
      const fallback = hashString(`${creature.id}:${id}:separate`) % 6283 / 1000
      separationDelta.set(Math.cos(fallback), 0, Math.sin(fallback))
    } else {
      separationDelta.normalize()
    }

    const distance = Math.sqrt(Math.max(distanceSq, 0.000001))
    const overlap = THREE.MathUtils.clamp((minDistance - distance) / minDistance, 0, 1)
    const easedOverlap = overlap * overlap
    out.addScaledVector(separationDelta, easedOverlap * avoidanceWeightForPair(creature, swim, school, other))
  })

  out.clampLength(0, AVOIDANCE_MAX_WEIGHT)
  return out
}

function limitAvoidanceAngle(out, followDirection, maxAngle) {
  if (out.lengthSq() < 0.000001) return out.copy(followDirection)
  out.normalize()
  const angle = followDirection.angleTo(out)
  if (angle > maxAngle) out.lerpVectors(followDirection, out, maxAngle / angle).normalize()
  return out
}

function updateFishRegistry(fish, creature, swim, school = null) {
  const radius = fishCollisionRadius(creature, swim, school)
  clampFishPosition(fish.position, creature, swim)
  const entry = FISH_REGISTRY.get(creature.id)
  if (entry) {
    entry.position.copy(fish.position)
    entry.radius = radius
    entry.biome = creature.biome
    entry.schoolId = school?.id ?? null
  } else {
    FISH_REGISTRY.set(creature.id, {
      position: fish.position.clone(),
      radius,
      biome: creature.biome,
      schoolId: school?.id ?? null,
    })
  }
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
    const clonedMaterials = list.map(material => {
      if (!material) return material
      const cloneMaterial = material.clone()
      cloneMaterial.transparent = false
      cloneMaterial.opacity = 1
      cloneMaterial.depthWrite = true
      cloneMaterial.roughness = cloneMaterial.roughness ?? 0.5
      materials.push(cloneMaterial)
      return cloneMaterial
    })
    child.material = Array.isArray(child.material) ? clonedMaterials : clonedMaterials[0]
  })
  return materials
}

function setModelMaterialOpacity(materials, opacity) {
  const visible = opacity > 0.001
  materials.forEach(material => {
    material.visible = visible
    material.opacity = opacity
    material.transparent = opacity < 0.999
    material.depthWrite = opacity >= 0.999
    material.needsUpdate = true
  })
}

function animationVariationForCreature(creature) {
  const rand = mulberry32(hashString(`${creature.id ?? creature.species}:animation-variation`))
  const baseSpeed = randomRange(rand, 0.88, 1.14)
  const idleSpeed = baseSpeed * randomRange(rand, 0.92, 1.08)
  const actionSpeed = baseSpeed * randomRange(rand, 0.94, 1.1)

  return {
    startOffset: randomRange(rand, 0, 1),
    speeds: {
      idle: idleSpeed,
      burst: actionSpeed * randomRange(rand, 1.04, 1.16),
      snap_left: actionSpeed * randomRange(rand, 0.96, 1.12),
      snap_right: actionSpeed * randomRange(rand, 0.96, 1.12),
      default: baseSpeed,
    },
  }
}

function applyOutlineMaterialSettings(object, color, opacity) {
  object.traverse(child => {
    if (!child.isMesh) return
    child.castShadow = false
    child.receiveShadow = false
    child.raycast = () => null
    child.material = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity,
      side: THREE.BackSide,
      depthTest: true,
      depthWrite: false,
      blending: THREE.NormalBlending,
      toneMapped: false,
    })
  })
}

function playModelAction(actions, activeActionRef, animation, animationVariation) {
  const nextAction = actions[animation] ?? actions.idle ?? Object.values(actions)[0]
  if (!nextAction || activeActionRef.current === nextAction) return

  const speed = animationVariation?.speeds?.[animation] ?? animationVariation?.speeds?.default ?? 1
  const offset = animationVariation?.startOffset ?? 0

  nextAction.reset()
  nextAction.enabled = true
  nextAction.setEffectiveWeight(1)
  nextAction.setEffectiveTimeScale(speed)

  if (animation === 'idle') {
    nextAction.setLoop(THREE.LoopRepeat, Infinity)
    nextAction.time = (nextAction.getClip()?.duration ?? 0) * offset
  } else {
    nextAction.setLoop(THREE.LoopOnce, 1)
    nextAction.clampWhenFinished = true
    nextAction.time = 0
  }

  const previousAction = activeActionRef.current
  nextAction.play()
  if (previousAction) nextAction.crossFadeFrom(previousAction, 0.12, false)

  activeActionRef.current = nextAction
}

function FishModel({ model, animation = 'idle', animationVariation, opacityRef = null }) {
  const gltf = useGLTF(model.path)
  const object = useMemo(() => clone(gltf.scene), [gltf.scene])
  const { actions } = useAnimations(gltf.animations, object)
  const activeActionRef = useRef(null)
  const materialsRef = useRef([])
  const currentOpacityRef = useRef(null)

  useLayoutEffect(() => {
    materialsRef.current = applyModelMaterialSettings(object)
    setModelMaterialOpacity(materialsRef.current, opacityRef?.current ?? 1)
    currentOpacityRef.current = null
  }, [object, opacityRef])

  useFrame(() => {
    const opacity = opacityRef?.current ?? 1
    if (Math.abs((currentOpacityRef.current ?? -1) - opacity) < 0.01) return
    currentOpacityRef.current = opacity
    setModelMaterialOpacity(materialsRef.current, opacity)
  })

  useEffect(() => {
    playModelAction(actions, activeActionRef, animation, animationVariation)
  }, [actions, animation, animationVariation])

  return (
    <primitive
      object={object}
      scale={model.scale ?? 1}
      rotation={model.rotation ?? [0, 0, 0]}
      position={model.position ?? [0, 0, 0]}
    />
  )
}

function FishModelOutline({ model, animation = 'idle', animationVariation, color, opacity = 0.24 }) {
  const gltf = useGLTF(model.path)
  const object = useMemo(() => clone(gltf.scene), [gltf.scene])
  const { actions } = useAnimations(gltf.animations, object)
  const activeActionRef = useRef(null)

  useEffect(() => {
    applyOutlineMaterialSettings(object, color, opacity)
  }, [object, color, opacity])

  useEffect(() => {
    playModelAction(actions, activeActionRef, animation, animationVariation)
  }, [actions, animation, animationVariation])

  return (
    <primitive
      object={object}
      scale={(model.scale ?? 1) * 1.08}
      rotation={model.rotation ?? [0, 0, 0]}
      position={model.position ?? [0, 0, 0]}
    />
  )
}

export default function Fish({ creature, selected = false, hideSelectionSilhouette = false, debug = false, debugLayers = null, school = null, onClick, onReady }) {
  const ref = useRef()
  const modelRootRef = useRef()
  const forwardLineRef = useRef()
  const speedLabelRef = useRef()
  const driftLabelRef = useRef()
  const lodLabelRef = useRef()
  const leaderLabelRef = useRef()
  const followTargetMarkerRef = useRef()
  const swim = useMemo(() => resolveSwimProfile(creature), [creature])
  const model = useMemo(() => resolveModel(creature), [creature])
  const modelLods = useMemo(() => resolveModelLods(model), [model])
  const [lodState, setLodState] = useState({ active: 0, previous: null, startedAt: 0 })
  const activeLodOpacityRef = useRef(1)
  const previousLodOpacityRef = useRef(0)
  const lodDistanceRef = useRef(0)
  const animationVariation = useMemo(() => animationVariationForCreature(creature), [creature])
  const schoolOffset = useMemo(() => schoolFormationOffset(school, creature), [school, creature])
  const isSchooling = Boolean(schoolOffset)
  const size = creature.size ?? 1
  const organicMotion = useMemo(() => {
    const rand = mulberry32(hashString(`${school?.id ?? 'solo'}:${creature.id ?? creature.species}:organic-motion`))
    return {
      speedScale: isSchooling ? randomRange(rand, PERSONAL_SPEED_SCALE[0], PERSONAL_SPEED_SCALE[1]) : 1,
      catchupScale: isSchooling ? randomRange(rand, PERSONAL_CATCHUP_SCALE[0], PERSONAL_CATCHUP_SCALE[1]) : 1,
      noiseSeed: Math.floor(randomRange(rand, 1, 0xFFFFFFFF)) >>> 0,
    }
  }, [creature, isSchooling, school?.id])
  const isSchoolLeader = isSchooling && school.index === 0
  const schoolState = useMemo(() => (isSchooling ? getSchoolState(school, creature, swim) : null), [isSchooling, school, creature, swim])
  const pathSeed = useRef((hashString(creature.id ?? creature.species ?? 'fish') ^ randomSeed()) >>> 0)
  const progress = useRef(0)
  const followTarget = useRef(new THREE.Vector3())
  const rawAvoidance = useRef(new THREE.Vector3())
  const smoothedAvoidance = useRef(new THREE.Vector3())
  const desiredDirection = useRef(new THREE.Vector3())
  const labelPosition = useRef(new THREE.Vector3())
  const previousPosition = useRef(new THREE.Vector3())
  const hasFollowPosition = useRef(false)
  const previousTangent = useRef(new THREE.Vector3())
  const visualForward = useRef(new THREE.Vector3())
  const hasVisualForward = useRef(false)
  const animationCooldown = useRef(0)
  const animationHoldUntil = useRef(0)
  const velocity = useRef(0)
  const actionSpeedUntil = useRef(0)
  const actionSpeedTarget = useRef(0)
  const nextBurstAt = useRef(0)
  const lastSwimSfxAt = useRef(0)
  const organicRand = useRef(mulberry32(organicMotion.noiseSeed))
  const organicNoise = useRef({
    lateral: 0,
    vertical: 0,
    longitudinal: 0,
    targetLateral: 0,
    targetVertical: 0,
    targetLongitudinal: 0,
    nextAt: 0,
  })
  const animationRef = useRef('idle')
  const [animation, setAnimation] = useState('idle')
  const [path, setPath] = useState(() => (schoolState?.path ?? makeSwimPath(creature, swim, pathSeed.current)))
  const pathRef = useRef(schoolState?.path ?? path)
  const pathLengthRef = useRef(schoolState?.pathLength ?? path.getLength())
  const splineGeometry = useMemo(() => makePathGeometry(path), [path])
  const forwardDebugGeometry = useMemo(() => makeDebugLineGeometry(), [])
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
    onReady?.(creature, ref)
  }, [creature, onReady])

  useEffect(() => {
    return () => FISH_REGISTRY.delete(creature.id)
  }, [creature.id])

  useEffect(() => {
    organicRand.current = mulberry32(organicMotion.noiseSeed)
    organicNoise.current = {
      lateral: 0,
      vertical: 0,
      longitudinal: 0,
      targetLateral: 0,
      targetVertical: 0,
      targetLongitudinal: 0,
      nextAt: 0,
    }
  }, [organicMotion.noiseSeed])

  useEffect(() => {
    if (!isSchoolLeader || !school?.id) return undefined
    return () => {
      if (SCHOOL_STATES.get(school.id) === schoolState) SCHOOL_STATES.delete(school.id)
    }
  }, [isSchoolLeader, school?.id, schoolState])

  useEffect(() => {
    velocity.current = motion.idleSpeed
    nextBurstAt.current = motion.burstPhase + motion.burstInterval
    rawAvoidance.current.set(0, 0, 0)
    smoothedAvoidance.current.set(0, 0, 0)
    hasVisualForward.current = false
  }, [motion])

  const playAnimation = (name) => {
    if (animationRef.current === name) return
    animationRef.current = name
    setAnimation(name)
  }

  const playSwimSfx = (type, intensity, now) => {
    if (SCHOOL_SFX_LEADER_ONLY && isSchooling && !isSchoolLeader && !selected) return
    if (now - lastSwimSfxAt.current < FISH_SFX_MIN_INTERVAL) return
    lastSwimSfxAt.current = now
    triggerFishSwimSound({
      type,
      intensity,
      creatureId: creature.id,
      followMode: selected,
      schooling: isSchooling,
    })
  }

  useFrame(({ clock, camera }, delta) => {
    const fish = ref.current
    if (!fish) return

    const now = clock.getElapsedTime()
    if (modelLods.length > 1) {
      const distance = camera.position.distanceTo(fish.position)
      lodDistanceRef.current = distance
      const targetLod = resolveLodIndex(modelLods, distance, lodState.active, selected)
      if (targetLod !== lodState.active) {
        activeLodOpacityRef.current = 0
        previousLodOpacityRef.current = 1
        setLodState({ active: targetLod, previous: lodState.active, startedAt: now })
      } else if (lodState.previous !== null) {
        const alpha = THREE.MathUtils.clamp((now - lodState.startedAt) / LOD_FADE_SECONDS, 0, 1)
        activeLodOpacityRef.current = alpha
        previousLodOpacityRef.current = 1 - alpha
        if (alpha >= 1) setLodState({ active: lodState.active, previous: null, startedAt: now })
      } else {
        activeLodOpacityRef.current = 1
        previousLodOpacityRef.current = 0
      }
    } else {
      activeLodOpacityRef.current = 1
      previousLodOpacityRef.current = 0
      lodDistanceRef.current = camera.position.distanceTo(fish.position)
    }

    if (isSchooling) {
      const noise = organicNoise.current
      const rand = organicRand.current
      if (now >= noise.nextAt) {
        noise.targetLateral = randomRange(rand, -ORGANIC_NOISE_AMPLITUDE, ORGANIC_NOISE_AMPLITUDE)
        noise.targetVertical = randomRange(rand, -ORGANIC_NOISE_AMPLITUDE * 0.55, ORGANIC_NOISE_AMPLITUDE * 0.55)
        noise.targetLongitudinal = randomRange(rand, -ORGANIC_NOISE_AMPLITUDE * 0.75, ORGANIC_NOISE_AMPLITUDE * 0.75)
        noise.nextAt = now + randomRange(rand, ORGANIC_NOISE_INTERVAL[0], ORGANIC_NOISE_INTERVAL[1])
      }
      const noiseAlpha = 1 - Math.exp(-delta * ORGANIC_NOISE_RESPONSE)
      noise.lateral = THREE.MathUtils.lerp(noise.lateral, noise.targetLateral, noiseAlpha)
      noise.vertical = THREE.MathUtils.lerp(noise.vertical, noise.targetVertical, noiseAlpha)
      noise.longitudinal = THREE.MathUtils.lerp(noise.longitudinal, noise.targetLongitudinal, noiseAlpha)
    }

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
      ? offsetFromSchoolPoint(schoolBasePosition, currentPath, t, schoolOffset, now, organicNoise.current)
      : currentPath.getPointAt(t)
    currentPath.getPointAt(Math.min(t + 0.006, 1), nextPoint)
    tangent.subVectors(nextPoint, currentPath.getPointAt(t)).normalize()

    const followDistance = followLookaheadDistance(creature, swim, isSchooling)
    const followTargetT = THREE.MathUtils.clamp(t + followDistance / pathLength, 0, 1)
    if (isSchooling) {
      offsetFromSchoolPoint(followTarget.current, currentPath, followTargetT, schoolOffset, now, organicNoise.current)
    } else {
      currentPath.getPointAt(followTargetT, followTarget.current)
      followTarget.current.y += Math.sin(clock.getElapsedTime() * 1.7 + motion.bobPhase) * motion.bobAmount
    }

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
        computeSoftAvoidance(rawAvoidance.current, fish, creature, swim, school)
        smoothedAvoidance.current.lerp(rawAvoidance.current, 1 - Math.exp(-delta * AVOIDANCE_SMOOTHING))
        desiredDirection.current.copy(schoolFollowDirection).add(smoothedAvoidance.current)
        limitAvoidanceAngle(
          desiredDirection.current,
          schoolFollowDirection,
          school?.count >= DENSE_SCHOOL_MIN_COUNT ? DENSE_SCHOOL_MAX_AVOIDANCE_ANGLE : DEFAULT_MAX_AVOIDANCE_ANGLE,
        )

        const catchup = THREE.MathUtils.clamp(
          targetDistance / Math.max(0.001, followDistance) * organicMotion.catchupScale,
          0.50,
          1.82,
        )
        fish.position.addScaledVector(
          desiredDirection.current,
          Math.min(targetDistance, velocity.current * organicMotion.speedScale * catchup * delta),
        )
        tangent.subVectors(fish.position, previousPosition.current)
        if (tangent.lengthSq() > 0.000001) {
          tangent.normalize()
        } else {
          tangent.copy(desiredDirection.current)
        }
      }
    }

    updateFishRegistry(fish, creature, swim, school)

    const fade = depthFadeFromScreenZ(fish.position.z)
    fish.traverse(child => {
      if (!child.isMesh) return
      const materials = Array.isArray(child.material) ? child.material : [child.material]
      materials.filter(Boolean).forEach(material => {
        if (model) {
          if ('envMapIntensity' in material) material.envMapIntensity = THREE.MathUtils.lerp(0.45, 0.95, fade)
          return
        }

        material.transparent = false
        material.opacity = 1
        if ('envMapIntensity' in material) material.envMapIntensity = THREE.MathUtils.lerp(0.25, 0.95, fade)
      })
    })

    const pitchLimit = maxVisualPitch(creature, swim)
    horizontalForward.set(tangent.x, 0, tangent.z)
    if (horizontalForward.lengthSq() < 0.0001) horizontalForward.set(0, 0, -1)
    horizontalForward.normalize()

    currentPath.getTangentAt(t, splineVisualTangent).normalize()
    setForwardWithPitch(rawVisualForward, horizontalForward, clampedVisualPitch(splineVisualTangent, pitchLimit))

    if (!hasVisualForward.current) {
      visualForward.current.copy(rawVisualForward)
      hasVisualForward.current = true
    } else {
      rotateDirectionToward(
        visualForward.current,
        rawVisualForward,
        turnRateForCreature(creature, swim) * delta,
      )
      enforceForwardPitchLimit(visualForward.current, pitchLimit)
    }
    pitchedForward.copy(visualForward.current)

    if (debug) {
      const showVectors = debugLayers?.vectors ?? true
      const showNumbers = debugLayers?.numbers ?? true
      const effectiveDebugVelocity = velocity.current * organicMotion.speedScale
      const debugVectorLength = DEBUG_FORWARD_MIN_LENGTH + effectiveDebugVelocity * DEBUG_FORWARD_SPEED_SCALE
      const drift = currentSchoolDrift(schoolOffset, now)
      debugForwardStart.copy(fish.position).addScaledVector(pitchedForward, debugForwardOffset(creature, swim, model))
      debugForwardEnd.copy(debugForwardStart).addScaledVector(pitchedForward, debugVectorLength)
      updateDebugLine(forwardLineRef, debugForwardStart, debugForwardEnd)
      if (forwardLineRef.current) forwardLineRef.current.visible = showVectors
      if (followTargetMarkerRef.current) {
        followTargetMarkerRef.current.position.copy(followTarget.current)
        followTargetMarkerRef.current.visible = showVectors
      }
      if (speedLabelRef.current) {
        speedLabelRef.current.position.copy(debugForwardEnd).addScaledVector(up, 0.14)
        speedLabelRef.current.text = `${effectiveDebugVelocity.toFixed(2)} wu/s`
        speedLabelRef.current.lookAt(camera.position)
        speedLabelRef.current.visible = showNumbers
      }
      if (driftLabelRef.current) {
        labelPosition.current.copy(followTarget.current).addScaledVector(up, 0.10 + size * 0.04)
        driftLabelRef.current.position.copy(labelPosition.current)
        driftLabelRef.current.text = `drift ${drift >= 0 ? '+' : ''}${drift.toFixed(2)}`
        driftLabelRef.current.lookAt(camera.position)
        driftLabelRef.current.visible = showNumbers
      }
      if (leaderLabelRef.current) {
        leaderLabelRef.current.position.copy(fish.position).addScaledVector(up, creatureBodyLength(creature, swim) * 0.24 + 0.10)
        leaderLabelRef.current.lookAt(camera.position)
        leaderLabelRef.current.visible = isSchoolLeader && showNumbers
      }
      if (lodLabelRef.current) {
        lodLabelRef.current.position.copy(fish.position).addScaledVector(up, creatureBodyLength(creature, swim) * 0.36 + 0.18)
        lodLabelRef.current.text = `LOD ${lodState.active} · ${lodDistanceRef.current.toFixed(1)}`
        lodLabelRef.current.lookAt(camera.position)
        lodLabelRef.current.visible = Boolean(debugLayers?.lod)
      }
    }

    if (model) {
      fish.up.copy(up)
      lookTarget.copy(fish.position).addScaledVector(pitchedForward, -1)
      fish.lookAt(lookTarget)
    } else {
      lookTarget.copy(fish.position).add(pitchedForward)
      fish.lookAt(lookTarget)
      fish.rotateY(Math.PI / 2)
    }

    const pitch = THREE.MathUtils.clamp(pitchedForward.y * 0.55, -0.22, 0.22)
    if (!model) fish.rotateZ(pitch)
    fish.up.lerp(up, 0.18)

    if (model) {
      let turn = 0
      if (previousTangent.current.lengthSq() > 0) {
        turn = previousTangent.current.x * pitchedForward.z - previousTangent.current.z * pitchedForward.x
      }
      if (previousTangent.current.lengthSq() > 0 && now > animationCooldown.current && now > animationHoldUntil.current) {
        if (turn > SNAP_TURN_THRESHOLD) {
          playAnimation('snap_left')
          playSwimSfx('turn', THREE.MathUtils.clamp(Math.abs(turn) * 24, 0.34, 0.82), now)
          actionSpeedUntil.current = now + 0.34
          actionSpeedTarget.current = motion.snapSpeed
          animationHoldUntil.current = now + 0.32
          animationCooldown.current = now + 0.7
        } else if (turn < -SNAP_TURN_THRESHOLD) {
          playAnimation('snap_right')
          playSwimSfx('turn', THREE.MathUtils.clamp(Math.abs(turn) * 24, 0.34, 0.82), now)
          actionSpeedUntil.current = now + 0.34
          actionSpeedTarget.current = motion.snapSpeed
          animationHoldUntil.current = now + 0.32
          animationCooldown.current = now + 0.7
        } else if (Math.abs(turn) < BURST_STRAIGHT_THRESHOLD && now > nextBurstAt.current) {
          playAnimation('burst')
          playSwimSfx('burst', THREE.MathUtils.clamp(motion.burstSpeed / Math.max(0.001, motion.idleSpeed) * 0.18, 0.42, 1), now)
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

      previousTangent.current.copy(pitchedForward)
    }
  })

  const focusScale = selected ? 1.08 : 1
  const debugTargetScale = THREE.MathUtils.clamp(Math.sqrt(size) * 0.72, 0.62, 1.7)
  const showSelectedOutline = selected && !hideSelectionSilhouette
  const outlineColor = showSelectedOutline ? SELECTED_OUTLINE_COLOR : (debug && isSchoolLeader ? LEADER_OUTLINE_COLOR : null)
  const outlineOpacity = showSelectedOutline ? SELECTED_OUTLINE_OPACITY : LEADER_OUTLINE_OPACITY

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
          {(debugLayers?.spline ?? true) && (!isSchooling || isSchoolLeader) && (
            <line geometry={splineGeometry} raycast={() => null}>
              <lineBasicMaterial color="#7df9ff" transparent opacity={0.55} depthWrite={false} />
            </line>
          )}
          <line ref={forwardLineRef} geometry={forwardDebugGeometry} raycast={() => null}>
            <lineBasicMaterial color="#ff4fd8" transparent opacity={0.95} depthTest={false} depthWrite={false} />
          </line>
          <mesh ref={followTargetMarkerRef} scale={debugTargetScale} raycast={() => null}>
            <sphereGeometry args={[0.055, 8, 8]} />
            <meshBasicMaterial color="#ffd166" transparent opacity={0.9} depthWrite={false} />
          </mesh>
          <Text
            ref={speedLabelRef}
            fontSize={DEBUG_LABEL_SCALE}
            font={DEBUG_LABEL_FONT}
            color="#ff8fe7"
            anchorX="center"
            anchorY="middle"
            depthTest={false}
            raycast={() => null}
          >
            0.00 wu/s
          </Text>
          <Text
            ref={driftLabelRef}
            fontSize={DEBUG_LABEL_SCALE}
            font={DEBUG_LABEL_FONT}
            color="#f7ff9a"
            anchorX="center"
            anchorY="middle"
            depthTest={false}
            raycast={() => null}
          >
            drift +0.00
          </Text>
          {isSchoolLeader && (
            <Text
              ref={leaderLabelRef}
              fontSize={DEBUG_LABEL_SCALE * 1.05}
              font={DEBUG_LABEL_FONT}
              color="#80ff72"
              anchorX="center"
              anchorY="middle"
              depthTest={false}
              raycast={() => null}
            >
              leader
            </Text>
          )}
          <Text
            ref={lodLabelRef}
            fontSize={LOD_DEBUG_LABEL_SCALE}
            font={DEBUG_LABEL_FONT}
            color="#7df9ff"
            anchorX="center"
            anchorY="middle"
            depthTest={false}
            raycast={() => null}
          >
            LOD 0 · 0.0
          </Text>
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
            <>
              {outlineColor && (
                <FishModelOutline
                  model={model}
                  animation={animation}
                  animationVariation={animationVariation}
                  color={outlineColor}
                  opacity={outlineOpacity}
                />
              )}
              {lodState.previous !== null && modelLods[lodState.previous] && (
                <FishModel
                  key={`previous-lod-${lodState.previous}`}
                  model={modelLods[lodState.previous]}
                  animation={animation}
                  animationVariation={animationVariation}
                  opacityRef={previousLodOpacityRef}
                />
              )}
              <FishModel
                key={`active-lod-${lodState.active}`}
                model={modelLods[lodState.active] ?? model}
                animation={animation}
                animationVariation={animationVariation}
                opacityRef={activeLodOpacityRef}
              />
            </>
          ) : (
            <>
              {outlineColor && (
                <mesh scale={1.1} raycast={() => null}>
                  <boxGeometry args={[0.7, 0.28, 0.18]} />
                  <meshBasicMaterial color={outlineColor} transparent opacity={outlineOpacity} side={THREE.BackSide} depthWrite={false} toneMapped={false} />
                </mesh>
              )}
              <mesh>
                <boxGeometry args={[0.7, 0.28, 0.18]} />
                <meshStandardMaterial
                  color="#7ab8c0"
                  roughness={0.42}
                  metalness={0.02}
                  envMapIntensity={0.85}
                />
              </mesh>
            </>
          )}
        </group>
      </group>
    </group>
  )
}

useGLTF.preload('/models/fish/sardine/sardine.glb')
useGLTF.preload('/models/fish/sardine/sardine-lod1.glb')
useGLTF.preload('/models/fish/sardine/sardine-lod2.glb')
