import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { Text, useAnimations, useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { clone } from 'three/examples/jsm/utils/SkeletonUtils.js'
import { SPECIES, WORLD_UNIT_METERS } from '../data/species'
import { triggerFishSwimSound } from '../hooks/useOceanAudio'
import { removeSardineFrustumEntry, removeSardineInstance, removeSardineLod1Instance, removeSardineLod0Entry, SARDINE_INSTANCE_DISTANCE, SARDINE_LOD1_DISTANCE, SARDINE_TANK_INSTANCE_DISTANCE, SARDINE_TANK_LOD1_DISTANCE, updateSardineFrustumEntry, updateSardineInstance, updateSardineLod1Instance, updateSardineLod0Entry } from './sardineInstanceRegistry'
import { SURFACE_PLANE_Y } from './WaterSurface'

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
  z: 7.4,
}
const TANK_CAMERA_Z = 12
const TANK_CAMERA_FOV_DEG = 60
const TANK_CAMERA_ASPECT = 16 / 9
const SCREEN_X_SAFE_FRACTION = 0.78
const GLOBAL_X_DESTINATION_RANGE_SCALE = 0.9

const SPECIES_BY_NAME = new Map(SPECIES.map(species => [species.name, species]))
const SARDINE_MATERIAL_ROUGHNESS = 0.2
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
const DEFAULT_BURST_ACTION_DURATION = 0.5
const DEFAULT_TURN_ACTION_DURATION = 0.34
const DEFAULT_DRIFT_INTERVAL = [18, 30]
const DEFAULT_DRIFT_DURATION = [7, 12]
const DEFAULT_MOVESET = {
  cruise: 'idle',
  drift: 'idle',
  turnLeft: 'snap_left',
  turnRight: 'snap_right',
  burst: 'burst',
}
const FISH_SFX_MIN_INTERVAL = 0.75
const SCHOOL_SFX_LEADER_ONLY = true
const GLOBAL_ANIMATION_TIME_SCALE = 2
const SELECTED_OUTLINE_COLOR = '#57c7e8'
const LEADER_OUTLINE_COLOR = '#80ff72'
const LOD0_DEBUG_COLOR = '#00ff28'
const SELECTED_RIM_INTENSITY = 1.65
const LEADER_RIM_INTENSITY = 0.8
const RIM_POWER = 3.1
const FISH_LIGHT_MASK_DIAGNOSTIC = true
const SARDINE_INSTANCE_HYSTERESIS = 0.65
const SARDINE_VIEW_CULL_MARGIN_NDC = 1.28
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
const DEBUG_NAME_LABEL_SCALE = 0.034
const DEBUG_AGENT_LABEL_SCALE = 0.045
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
const SOLO_AGENT_ARC_MIN_SPEED_SCALE = 0.36
const SOLO_AGENT_ARC_ALIGNMENT_START = -0.55
const SOLO_AGENT_ARC_ALIGNMENT_FULL = 0.58
const SOLO_AGENT_WIDE_TARGET_CHANCE = 0.68
const SOLO_AGENT_DESIRED_DIRECTION_RESPONSE = 1.8
const SOLO_AGENT_TANGENT_TURN_RATE = THREE.MathUtils.degToRad(155)
const SOLO_AGENT_TANGENT_CATCHUP_RATE = THREE.MathUtils.degToRad(260)
const SOLO_AGENT_TANGENT_CATCHUP_ALIGNMENT = 0.72
const SOLO_AGENT_PATH_REBUILD_EPSILON = 0.015
const SOLO_AGENT_TARGET_ATTEMPTS = 16
const SOLO_AGENT_MIN_TARGET_BODY_LENGTHS = 3.0
const SOLO_AGENT_CURVE_BUILD_ATTEMPTS = 8
const SOLO_AGENT_CURVE_SAMPLE_COUNT = 56
const SOLO_AGENT_CURVE_MAX_SAMPLE_DELTA = THREE.MathUtils.degToRad(3)
const SOLO_AGENT_CURVE_MAX_TOTAL_TURN = THREE.MathUtils.degToRad(165)
const SOLO_AGENT_CURVE_MAX_OPPOSITE_TURN = THREE.MathUtils.degToRad(7)
const SOLO_AGENT_CURVE_PLANE_TWIST_EPSILON = THREE.MathUtils.degToRad(0.25)
const SOLO_AGENT_CURVE_MAX_START_TANGENT_ERROR = THREE.MathUtils.degToRad(0.5)
const SOLO_AGENT_CURVE_MIN_RADIUS_BODY_LENGTHS = 1.2
const SOLO_AGENT_CURVE_TWIST_EPSILON = THREE.MathUtils.degToRad(0.35)
const SOLO_AGENT_CURVE_LEAD_BODY_LENGTHS = [1.1, 2.4]
const SOLO_AGENT_CURVE_MIN_LEAD_SCALE = 0.24
const SOLO_AGENT_CURVE_MAX_LEAD_SCALE = 0.52
const SOLO_AGENT_MAX_TANGENT_DELTA = THREE.MathUtils.degToRad(8)
const SOLO_AGENT_CURVE_MIN_SPEED_SCALE = 0.46
const SOLO_AGENT_RETARGET_PROGRESS = 0.82
const SOLO_AGENT_RETARGET_COOLDOWN = [2.8, 5.2]
const SOLO_AGENT_STEERING_MAX_TURN_RATE = THREE.MathUtils.degToRad(10.5)
const SOLO_AGENT_STEERING_REACHED_BODY_LENGTHS = 0.95
const SOLO_AGENT_STEERING_DEBUG_STEPS = 72
const SOLO_AGENT_STEERING_DEBUG_STEP_BODY_LENGTHS = 0.18
const SOLO_AGENT_RUNTIME_OVERSHOOT_BODY_LENGTHS = 0.55
const SOLO_AGENT_RUNTIME_OVERSHOOT_MIN = 2.0
const SOLO_AGENT_RUNTIME_OVERSHOOT_MAX = 5.5
const MOLA_RUNTIME_OVERSHOOT_XZ_BODY_LENGTHS = 1.75
const MOLA_RUNTIME_OVERSHOOT_XZ_MIN = 9.0
const MOLA_RUNTIME_OVERSHOOT_XZ_MAX = 18.0
const SOLO_AGENT_RUNTIME_RECOVERY_AFTER_FOLLOW_DELAY = 1.0
const MOLA_DEEP_ZONE_Z_MAX = -10
const MOLA_FRONT_EXCURSION_CHANCE = 0.24
const MOLA_FRONT_TARGET_COUNT = [1, 2]
const MOLA_DEEP_TARGET_COUNT = [4, 7]
const MOLA_SUN_BASK_CHANCE = 0.16
const MOLA_SUN_BASK_COOLDOWN = 75
const MOLA_SUN_BASK_DURATION = 30
const MOLA_SUN_BASK_APPROACH_Z = [-6, 0]
const MOLA_SUN_BASK_EXIT_BODY_LENGTHS = 3.0
const MOLA_SUN_BASK_ROLL_DURATION = 6
const MOLA_SUN_BASK_EXIT_ROLL_DURATION = 5
const MOLA_SUN_BASK_DRIFT_AMPLITUDE = 0.08
const MOLA_SURFACE_CENTER_CLEARANCE_BODY_LENGTHS = 0.24
const MOLA_SURFACE_CENTER_CLEARANCE_MIN = 1.35
const MOLA_SURFACE_CENTER_CLEARANCE_MAX = 2.45
const SOLO_AGENT_RETRY_COOLDOWN = 1.2
const SOLO_AGENT_AVOIDANCE_OFFSET_BODY_LENGTHS = 0.42
const AGENT_FORWARD_DESTINATION_MAX_ANGLE = Math.PI / 2
const AGENT_BEHAVIOR_RETRY_COOLDOWN = 1.2
const AGENT_BOUNDARY_TANGENT_MAX_ANGLE = THREE.MathUtils.degToRad(15)
const AGENT_BOUNDARY_TANGENT_MAX_NORMAL_COMPONENT = Math.sin(AGENT_BOUNDARY_TANGENT_MAX_ANGLE)
const AGENT_BOUNDARY_TANGENT_DISTANCE_BODY_LENGTHS = 0.72
const AGENT_BOUNDARY_GLIDE_LENGTH_BODY_LENGTHS = 2.35
const AGENT_BOUNDARY_GLIDE_INWARD_BODY_LENGTHS = 0.24
const AGENT_BOUNDARY_GLIDE_MAX_TOTAL_TURN = THREE.MathUtils.degToRad(95)


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
const agentMoveDirection = new THREE.Vector3()
const agentForwardFlat = new THREE.Vector3()
const targetDesiredDirection = new THREE.Vector3()
const agentPathPoint = new THREE.Vector3()
const agentPathLookaheadPoint = new THREE.Vector3()
const agentPathTangent = new THREE.Vector3()
const agentPathOffset = new THREE.Vector3()
const agentCandidateTarget = new THREE.Vector3()
const agentBestTarget = new THREE.Vector3()
const agentCurveControlA = new THREE.Vector3()
const agentCurveControlB = new THREE.Vector3()
const agentCurveEndForward = new THREE.Vector3()
const agentCurveStartForward = new THREE.Vector3()
const agentCurvePrevTangent = new THREE.Vector3()
const agentCurveNextTangent = new THREE.Vector3()
const agentCurvePrevPoint = new THREE.Vector3()
const agentCurveNextPoint = new THREE.Vector3()
const agentContinuationForward = new THREE.Vector3()
const agentContinuationCenter = new THREE.Vector3()
const agentContinuationDirection = new THREE.Vector3()
const agentRecoverySide = new THREE.Vector3()
const agentRecoveryRadial = new THREE.Vector3()
const agentRecoveryEndRadial = new THREE.Vector3()
const agentRecoveryEndForward = new THREE.Vector3()
const agentRecoveryEnd = new THREE.Vector3()
const agentDestinationDirection = new THREE.Vector3()
const agentBoundaryNormal = new THREE.Vector3()
const agentBoundaryPlaneTangent = new THREE.Vector3()
const agentBoundaryInward = new THREE.Vector3()
const agentBoundaryGlideMid = new THREE.Vector3()
const agentBoundaryGlideEnd = new THREE.Vector3()
const agentRuntimeClamp = new THREE.Vector3()
const agentBaskExitTarget = new THREE.Vector3()
const bankQuaternion = new THREE.Quaternion()
const tempScale = new THREE.Vector3()
const cullProjection = new THREE.Vector3()
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
  const speciesSwim = species?.swim ?? {}

  return {
    ...DEFAULT_SWIM,
    ...speciesSwim,
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
    driftInterval: speciesSwim.driftInterval ?? DEFAULT_DRIFT_INTERVAL,
    driftDuration: speciesSwim.driftDuration ?? DEFAULT_DRIFT_DURATION,
    burstActionDuration: speciesSwim.burstActionDuration ?? DEFAULT_BURST_ACTION_DURATION,
    turnActionDuration: speciesSwim.turnActionDuration ?? DEFAULT_TURN_ACTION_DURATION,
    turnTriggerThreshold: speciesSwim.turnTriggerThreshold ?? SNAP_TURN_THRESHOLD,
  }
}

function resolveModel(creature) {
  const species = resolveSpecies(creature)
  return species?.model ?? null
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
  if (!model) return creatureBodyLength(creature, swim) * 0.52
  return creatureBodyLength(creature, swim) * 0.42
}

function placeholderDimensions(species, swim) {
  if (species?.placeholder?.type === 'mola-mola') {
    return {
      length: swim.bodyLengthWU,
      height: swim.bodyLengthWU * 0.68,
      thickness: swim.bodyLengthWU * 0.16,
    }
  }

  return {
    length: 0.7,
    height: 0.28,
    thickness: 0.18,
  }
}

function interactionProxyDimensions(species, swim) {
  if (species?.placeholder?.type === 'mola-mola') {
    const dims = placeholderDimensions(species, swim)
    return [dims.length * 1.04, dims.height * 1.02, Math.max(0.32, dims.thickness * 1.25)]
  }

  return [0.72, 0.28, 0.22]
}

function projectedScreenHalfXAtZ(z) {
  const distanceFromCamera = Math.max(0.5, TANK_CAMERA_Z - z)
  const visibleHalfX = Math.tan(THREE.MathUtils.degToRad(TANK_CAMERA_FOV_DEG) * 0.5) * TANK_CAMERA_ASPECT * distanceFromCamera
  return Math.max(1.5, visibleHalfX * SCREEN_X_SAFE_FRACTION * GLOBAL_X_DESTINATION_RANGE_SCALE)
}

function swimXRangeAtZ(bounds, z) {
  const halfX = projectedScreenHalfXAtZ(z)
  return { xMin: -halfX, xMax: halfX }
}

function randomXInSwimBoundsAtZ(rand, bounds, z, minT = 0, maxT = 1) {
  const xRangeAtZ = swimXRangeAtZ(bounds, z)
  return THREE.MathUtils.lerp(xRangeAtZ.xMin, xRangeAtZ.xMax, randomRange(rand, minT, maxT))
}

function swimBounds(depthZone, swim = DEFAULT_SWIM, size = 1) {
  const [rawYMin, rawYMax] = DEPTH_Y[depthZone] ?? DEPTH_Y.epipelagic
  const boundsBodyLengthWU = swim.boundsBodyLengthWU ?? swim.bodyLengthWU
  const boundsSize = swim.boundsUseSpeciesSize === false ? 1 : size
  const bodyLength = boundsBodyLengthWU * boundsSize
  const movementScale = swim.movementBoundsScale ?? 1
  const bodyMargin = Math.max(PATH_EDGE_PADDING, Math.min(2.2, bodyLength * 0.35))
  const verticalMargin = Math.min((rawYMax - rawYMin) * 0.16, Math.max(PATH_VERTICAL_PADDING, Math.min(0.58, bodyLength * 0.16)))
  const zBase = Math.max(1.5, SWIM_BOX.z * movementScale - bodyMargin) * (swim.boundsScaleZ ?? 1)
  const zMin = swim.boundsZMin ?? -zBase
  const zMax = swim.boundsZMax ?? zBase
  const yMin = swim.boundsYMin ?? rawYMin + verticalMargin
  const yMax = swim.boundsYMax ?? rawYMax - verticalMargin
  const nearX = projectedScreenHalfXAtZ(zMax)
  const farX = projectedScreenHalfXAtZ(zMin)
  const x = Math.max(nearX, farX)
  return {
    x,
    z: Math.max(Math.abs(zMin), Math.abs(zMax)),
    xMin: -x,
    xMax: x,
    zMin,
    zMax,
    yMin,
    yMax,
  }
}

function pointInsideSwimBounds(point, bounds) {
  const { xMin, xMax } = swimXRangeAtZ(bounds, point.z)
  return point.x >= xMin
    && point.x <= xMax
    && point.y >= bounds.yMin
    && point.y <= bounds.yMax
    && point.z >= bounds.zMin
    && point.z <= bounds.zMax
}

function clampToSwimBounds(point, bounds) {
  point.z = THREE.MathUtils.clamp(point.z, bounds.zMin, bounds.zMax)
  const { xMin, xMax } = swimXRangeAtZ(bounds, point.z)
  point.x = THREE.MathUtils.clamp(point.x, xMin, xMax)
  point.y = THREE.MathUtils.clamp(point.y, bounds.yMin, bounds.yMax)
  return point
}

function clampToSoloAgentRuntimeEnvelope(point, bounds, bodyLength, creature) {
  const verticalMargin = THREE.MathUtils.clamp(
    bodyLength * SOLO_AGENT_RUNTIME_OVERSHOOT_BODY_LENGTHS,
    SOLO_AGENT_RUNTIME_OVERSHOOT_MIN,
    SOLO_AGENT_RUNTIME_OVERSHOOT_MAX,
  )
  const horizontalMargin = isMolaCreature(creature)
    ? THREE.MathUtils.clamp(
      bodyLength * MOLA_RUNTIME_OVERSHOOT_XZ_BODY_LENGTHS,
      MOLA_RUNTIME_OVERSHOOT_XZ_MIN,
      MOLA_RUNTIME_OVERSHOOT_XZ_MAX,
    )
    : verticalMargin
  agentRuntimeClamp.copy(point)
  agentRuntimeClamp.z = THREE.MathUtils.clamp(agentRuntimeClamp.z, bounds.zMin - horizontalMargin, bounds.zMax + horizontalMargin)
  const { xMin, xMax } = swimXRangeAtZ(bounds, agentRuntimeClamp.z)
  agentRuntimeClamp.x = THREE.MathUtils.clamp(agentRuntimeClamp.x, xMin - horizontalMargin, xMax + horizontalMargin)
  agentRuntimeClamp.y = THREE.MathUtils.clamp(agentRuntimeClamp.y, bounds.yMin - verticalMargin, bounds.yMax + verticalMargin)
  const clamped = agentRuntimeClamp.distanceToSquared(point) > 0.000001
  if (clamped) point.copy(agentRuntimeClamp)
  return clamped
}



function nearestSwimBoundaryNormal(out, point, bounds, bodyLength) {
  const xRangeAtZ = swimXRangeAtZ(bounds, point.z)
  const threshold = Math.max(0.42, bodyLength * AGENT_BOUNDARY_TANGENT_DISTANCE_BODY_LENGTHS)
  const candidates = [
    { distance: point.x - xRangeAtZ.xMin, normal: [-1, 0, 0] },
    { distance: xRangeAtZ.xMax - point.x, normal: [1, 0, 0] },
    { distance: point.z - bounds.zMin, normal: [0, 0, -1] },
    { distance: bounds.zMax - point.z, normal: [0, 0, 1] },
    { distance: point.y - bounds.yMin, normal: [0, -1, 0] },
    { distance: bounds.yMax - point.y, normal: [0, 1, 0] },
  ]

  let closest = null
  for (const candidate of candidates) {
    if (!closest || candidate.distance < closest.distance) closest = candidate
  }

  if (!closest || closest.distance > threshold) {
    out.set(0, 0, 0)
    return 0
  }

  out.set(closest.normal[0], closest.normal[1], closest.normal[2])
  return THREE.MathUtils.clamp(1 - closest.distance / threshold, 0, 1)
}

function projectTangentToBoundaryPlane(out, tangent, normal, fallbackForward) {
  out.copy(tangent).addScaledVector(normal, -tangent.dot(normal))
  if (out.lengthSq() < 0.0001 && fallbackForward) {
    out.copy(fallbackForward).addScaledVector(normal, -fallbackForward.dot(normal))
  }
  if (out.lengthSq() < 0.0001) {
    if (Math.abs(normal.x) > 0.5) out.set(0, 0, fallbackForward?.z >= 0 ? 1 : -1)
    else if (Math.abs(normal.z) > 0.5) out.set(fallbackForward?.x >= 0 ? 1 : -1, 0, 0)
    else out.set(fallbackForward?.x || 1, 0, fallbackForward?.z || 0)
  }
  return out.normalize()
}

function shapeBoundaryEndpointTangent(tangent, target, bounds, bodyLength, fallbackForward) {
  const proximity = nearestSwimBoundaryNormal(agentBoundaryNormal, target, bounds, bodyLength)
  if (proximity <= 0) return tangent.normalize()

  projectTangentToBoundaryPlane(agentBoundaryPlaneTangent, tangent, agentBoundaryNormal, fallbackForward)
  const blend = THREE.MathUtils.lerp(0.45, 1, proximity)
  tangent.lerp(agentBoundaryPlaneTangent, blend)
  if (tangent.lengthSq() < 0.0001) tangent.copy(agentBoundaryPlaneTangent)
  tangent.normalize()

  if (Math.abs(tangent.dot(agentBoundaryNormal)) > AGENT_BOUNDARY_TANGENT_MAX_NORMAL_COMPONENT) {
    tangent.copy(agentBoundaryPlaneTangent)
  }

  return tangent.normalize()
}

function soloAgentEndpointTangentMeetsBoundaryPlane(path, target, bounds, bodyLength) {
  const proximity = nearestSwimBoundaryNormal(agentBoundaryNormal, target, bounds, bodyLength)
  if (proximity <= 0) return true
  path.getTangentAt(1, agentCurveEndForward)
  if (agentCurveEndForward.lengthSq() < 0.0001) return false
  agentCurveEndForward.normalize()
  return Math.abs(agentCurveEndForward.dot(agentBoundaryNormal)) <= AGENT_BOUNDARY_TANGENT_MAX_NORMAL_COMPONENT
}

function destinationInForwardCone(destination, position, forward, maxAngle = AGENT_FORWARD_DESTINATION_MAX_ANGLE) {
  agentDestinationDirection.subVectors(destination, position)
  if (agentDestinationDirection.lengthSq() < 0.0001) return false
  agentDestinationDirection.normalize()
  return forward.angleTo(agentDestinationDirection) <= maxAngle
}

function pickSoloAgentDestination(out, creature, swim, rand, from, forward) {
  const bounds = swimBounds(creature.depthZone, swim, creature.size ?? 1)
  const bodyLength = creatureBodyLength(creature, swim)
  const minDistance = Math.max(1.2, bodyLength * SOLO_AGENT_MIN_TARGET_BODY_LENGTHS)
  const targetYMax = isMolaCreature(creature) ? molaSurfaceCenterYMax(creature, swim, bounds) : bounds.yMax

  for (let attempt = 0; attempt < SOLO_AGENT_TARGET_ATTEMPTS; attempt += 1) {
    const wideTarget = from && rand() < SOLO_AGENT_WIDE_TARGET_CHANCE
    const zMid = (bounds.zMin + bounds.zMax) / 2
    const zRange = bounds.zMax - bounds.zMin
    const targetLeft = !from ? rand() < 0.5 : from.x >= 0
    const targetBack = !from ? rand() < 0.5 : from.z >= zMid
    const targetZ = wideTarget
      ? randomRange(rand, targetBack ? bounds.zMin : bounds.zMax - zRange * 0.52, targetBack ? bounds.zMin + zRange * 0.52 : bounds.zMax)
      : randomRange(rand, bounds.zMin, bounds.zMax)
    const targetX = wideTarget
      ? randomXInSwimBoundsAtZ(rand, bounds, targetZ, targetLeft ? 0 : 0.58, targetLeft ? 0.42 : 1)
      : randomXInSwimBoundsAtZ(rand, bounds, targetZ)
    out.set(targetX, randomRange(rand, bounds.yMin, targetYMax), targetZ)
    if (from && out.distanceTo(from) < minDistance) continue
    if (from && forward && !destinationInForwardCone(out, from, forward)) continue
    return out
  }

  return null
}

function pickSoloAgentSteeringDestination(out, creature, swim, rand, from, forward, depthMode = 'any') {
  const bounds = swimBounds(creature.depthZone, swim, creature.size ?? 1)
  const bodyLength = creatureBodyLength(creature, swim)
  const minDistance = Math.max(1.2, bodyLength * SOLO_AGENT_MIN_TARGET_BODY_LENGTHS)
  const modeZMin = depthMode === 'front' ? Math.max(bounds.zMin, MOLA_DEEP_ZONE_Z_MAX) : bounds.zMin
  const modeZMax = depthMode === 'deep' ? Math.min(bounds.zMax, MOLA_DEEP_ZONE_Z_MAX) : bounds.zMax
  const zMin = Math.min(modeZMin, modeZMax)
  const zMax = Math.max(modeZMin, modeZMax)
  const targetYMax = isMolaCreature(creature) ? molaSurfaceCenterYMax(creature, swim, bounds) : bounds.yMax

  for (let attempt = 0; attempt < SOLO_AGENT_TARGET_ATTEMPTS; attempt += 1) {
    const wideTarget = from && rand() < SOLO_AGENT_WIDE_TARGET_CHANCE
    const zRange = zMax - zMin
    const zMid = (zMin + zMax) / 2
    const targetLeft = !from ? rand() < 0.5 : from.x >= 0
    const targetBack = !from ? rand() < 0.5 : from.z >= zMid
    const targetZ = wideTarget && zRange > 0.001
      ? randomRange(rand, targetBack ? zMin : zMax - zRange * 0.52, targetBack ? zMin + zRange * 0.52 : zMax)
      : randomRange(rand, zMin, zMax)
    const targetX = wideTarget
      ? randomXInSwimBoundsAtZ(rand, bounds, targetZ, targetLeft ? 0 : 0.58, targetLeft ? 0.42 : 1)
      : randomXInSwimBoundsAtZ(rand, bounds, targetZ)
    out.set(targetX, randomRange(rand, bounds.yMin, targetYMax), targetZ)
    if (from && out.distanceTo(from) < minDistance) continue
    if (from && forward && !destinationInForwardCone(out, from, forward)) continue
    return out
  }

  const fallback = pickSoloAgentTarget(out, creature, swim, rand, from)
  if (fallback) out.z = THREE.MathUtils.clamp(out.z, zMin, zMax)
  return fallback
}

function isMolaCreature(creature) {
  return creature.species === 'mola-alexandrini' || creature.species === 'mola-mola'
}

function molaSurfaceCenterYMax(creature, swim, bounds) {
  if (!isMolaCreature(creature)) return bounds.yMax
  const bodyLength = creatureBodyLength(creature, swim)
  const clearance = THREE.MathUtils.clamp(
    bodyLength * MOLA_SURFACE_CENTER_CLEARANCE_BODY_LENGTHS,
    MOLA_SURFACE_CENTER_CLEARANCE_MIN,
    MOLA_SURFACE_CENTER_CLEARANCE_MAX,
  )
  return Math.min(bounds.yMax, SURFACE_PLANE_Y - clearance)
}

function clampToMolaSurfaceCeiling(point, creature, swim, bounds, direction = null) {
  if (!isMolaCreature(creature)) return false
  const maxY = molaSurfaceCenterYMax(creature, swim, bounds)
  if (point.y <= maxY) return false
  point.y = maxY
  if (direction && direction.y > 0) {
    direction.y = 0
    if (direction.lengthSq() > 0.0001) direction.normalize()
  }
  return true
}

function pickMolaSunBaskTarget(out, creature, swim, rand, from, forward) {
  const bounds = swimBounds(creature.depthZone, swim, creature.size ?? 1)
  const bodyLength = creatureBodyLength(creature, swim)
  const minDistance = Math.max(1.2, bodyLength * 1.4)
  const zMin = Math.max(bounds.zMin, MOLA_SUN_BASK_APPROACH_Z[0])
  const zMax = Math.min(bounds.zMax, MOLA_SUN_BASK_APPROACH_Z[1])

  for (let attempt = 0; attempt < SOLO_AGENT_TARGET_ATTEMPTS; attempt += 1) {
    const targetZ = randomRange(rand, Math.min(zMin, zMax), Math.max(zMin, zMax))
    const targetX = randomXInSwimBoundsAtZ(rand, bounds, targetZ, 0.18, 0.82)
    out.set(targetX, molaSurfaceCenterYMax(creature, swim, bounds), targetZ)
    if (from && out.distanceTo(from) < minDistance) continue
    if (from && forward && !destinationInForwardCone(out, from, forward)) continue
    return out
  }

  return null
}

function pickMolaSunBaskExitTarget(out, creature, swim, from, forward) {
  const bounds = swimBounds(creature.depthZone, swim, creature.size ?? 1)
  const bodyLength = creatureBodyLength(creature, swim)
  out.copy(from)
    .addScaledVector(forward, Math.max(1.2, bodyLength * MOLA_SUN_BASK_EXIT_BODY_LENGTHS))
  out.y = THREE.MathUtils.lerp(bounds.yMax, bounds.yMin, 0.42)
  out.z = Math.min(out.z - bodyLength * 0.75, MOLA_DEEP_ZONE_Z_MAX)
  clampToSwimBounds(out, bounds)
  return out
}

function shapeSoloAgentSteeringDesired(out, position, target, forward, creature, swim) {
  const bounds = swimBounds(creature.depthZone, swim, creature.size ?? 1)
  const bodyLength = creatureBodyLength(creature, swim)
  out.subVectors(target, position)
  if (out.lengthSq() < 0.0001) out.copy(forward)
  if (out.lengthSq() < 0.0001) out.set(0, 0, -1)
  out.normalize()

  const proximity = nearestSwimBoundaryNormal(agentBoundaryNormal, position, bounds, bodyLength)
  if (proximity > 0) {
    projectTangentToBoundaryPlane(agentBoundaryPlaneTangent, out, agentBoundaryNormal, forward)
    out.lerp(agentBoundaryPlaneTangent, THREE.MathUtils.lerp(0.35, 0.92, proximity))
    if (out.lengthSq() < 0.0001) out.copy(agentBoundaryPlaneTangent)
    out.normalize()

    if (!pointInsideSwimBounds(position, bounds)) {
      agentBoundaryInward.copy(agentBoundaryNormal).multiplyScalar(-1)
      out.lerp(agentBoundaryInward, 0.18).normalize()
    }
  }

  return out
}

function makeSoloAgentSteeringDebugPath(creature, swim, start, startForward, target) {
  const bodyLength = creatureBodyLength(creature, swim)
  const stepDistance = Math.max(0.28, bodyLength * SOLO_AGENT_STEERING_DEBUG_STEP_BODY_LENGTHS)
  const turnStep = SOLO_AGENT_STEERING_MAX_TURN_RATE * (stepDistance / Math.max(0.1, bodyLength * 0.08))
  const points = [start.clone()]
  agentPathPoint.copy(start)
  agentPathTangent.copy(startForward)
  if (agentPathTangent.lengthSq() < 0.0001) agentPathTangent.set(0, 0, -1)
  agentPathTangent.normalize()

  for (let i = 0; i < SOLO_AGENT_STEERING_DEBUG_STEPS; i += 1) {
    shapeSoloAgentSteeringDesired(agentMoveDirection, agentPathPoint, target, agentPathTangent, creature, swim)
    rotateDirectionToward(agentPathTangent, agentMoveDirection, turnStep)
    agentPathPoint.addScaledVector(agentPathTangent, stepDistance)
    points.push(agentPathPoint.clone())
    if (agentPathPoint.distanceTo(target) <= Math.max(0.7, bodyLength * SOLO_AGENT_STEERING_REACHED_BODY_LENGTHS)) break
  }

  const path = new THREE.CatmullRomCurve3(points, false, 'centripetal')
  path.userData = { steeringDebug: true, curvatureAccepted: true }
  return path
}

function pickSoloAgentTarget(out, creature, swim, rand, from = null) {
  const bounds = swimBounds(creature.depthZone, swim, creature.size ?? 1)
  const bodyLength = creatureBodyLength(creature, swim)
  const minDistance = Math.max(1.2, bodyLength * SOLO_AGENT_MIN_TARGET_BODY_LENGTHS)

  for (let attempt = 0; attempt < SOLO_AGENT_TARGET_ATTEMPTS; attempt += 1) {
    const wideTarget = from && rand() < SOLO_AGENT_WIDE_TARGET_CHANCE
    const zMid = (bounds.zMin + bounds.zMax) / 2
    const zRange = bounds.zMax - bounds.zMin
    const targetLeft = !from ? rand() < 0.5 : from.x >= 0
    const targetBack = !from ? rand() < 0.5 : from.z >= zMid
    const targetZ = wideTarget
      ? randomRange(rand, targetBack ? bounds.zMin : bounds.zMax - zRange * 0.52, targetBack ? bounds.zMin + zRange * 0.52 : bounds.zMax)
      : randomRange(rand, bounds.zMin, bounds.zMax)
    const targetX = wideTarget
      ? randomXInSwimBoundsAtZ(rand, bounds, targetZ, targetLeft ? 0 : 0.58, targetLeft ? 0.42 : 1)
      : randomXInSwimBoundsAtZ(rand, bounds, targetZ)
    out.set(
      targetX,
      randomRange(rand, bounds.yMin, bounds.yMax),
      targetZ,
    )
    if (!from || out.distanceTo(from) >= minDistance) return out
  }

  if (from) {
    out.subVectors(out, from)
    if (out.lengthSq() < 0.0001) out.set(1, 0, 0)
    out.normalize().multiplyScalar(minDistance).add(from)
    clampToSwimBounds(out, bounds)
  }

  return out
}

function pickSoloAgentContinuationTarget(out, creature, swim, rand, from, startForward) {
  const bounds = swimBounds(creature.depthZone, swim, creature.size ?? 1)
  const bodyLength = creatureBodyLength(creature, swim)
  const minDistance = Math.max(1.2, bodyLength * SOLO_AGENT_MIN_TARGET_BODY_LENGTHS)

  agentContinuationForward.copy(startForward)
  if (agentContinuationForward.lengthSq() < 0.0001) agentContinuationForward.set(0, 0, -1)
  agentContinuationForward.normalize()

  agentContinuationCenter.set(
    (bounds.xMin + bounds.xMax) * 0.5,
    THREE.MathUtils.clamp(from.y, bounds.yMin, bounds.yMax),
    (bounds.zMin + bounds.zMax) * 0.5,
  ).sub(from)
  if (agentContinuationCenter.lengthSq() < 0.0001) agentContinuationCenter.copy(agentContinuationForward)
  agentContinuationCenter.normalize()

  for (let attempt = 0; attempt < SOLO_AGENT_TARGET_ATTEMPTS; attempt += 1) {
    const centerBlend = THREE.MathUtils.clamp(attempt / Math.max(1, SOLO_AGENT_TARGET_ATTEMPTS - 1), 0, 1) * 0.78
    agentContinuationDirection.copy(agentContinuationForward).lerp(agentContinuationCenter, centerBlend).normalize()
    const distance = bodyLength * randomRange(rand, 3.2, 6.2)
    out.copy(from).addScaledVector(agentContinuationDirection, distance)
    out.y += randomRange(rand, -bodyLength * 0.18, bodyLength * 0.18)
    clampToSwimBounds(out, bounds)
    if (out.distanceTo(from) >= minDistance) return out
  }

  out.copy(from).addScaledVector(agentContinuationCenter, minDistance)
  return clampToSwimBounds(out, bounds)
}


function makeSoloAgentBoundaryGlidePath(creature, swim, start, startForward) {
  const bounds = swimBounds(creature.depthZone, swim, creature.size ?? 1)
  const bodyLength = creatureBodyLength(creature, swim)
  const proximity = nearestSwimBoundaryNormal(agentBoundaryNormal, start, bounds, bodyLength)
  if (proximity <= 0) return null

  agentContinuationForward.copy(startForward)
  if (agentContinuationForward.lengthSq() < 0.0001) agentContinuationForward.set(0, 0, -1)
  agentContinuationForward.normalize()

  projectTangentToBoundaryPlane(agentBoundaryPlaneTangent, agentContinuationForward, agentBoundaryNormal, agentContinuationForward)
  agentBoundaryInward.copy(agentBoundaryNormal).multiplyScalar(-1)
  const glideDistance = Math.max(1.8, bodyLength * AGENT_BOUNDARY_GLIDE_LENGTH_BODY_LENGTHS)
  const inwardBias = Math.max(0.12, bodyLength * AGENT_BOUNDARY_GLIDE_INWARD_BODY_LENGTHS)
  agentBoundaryGlideMid.copy(start)
    .addScaledVector(agentBoundaryPlaneTangent, glideDistance * 0.55)
    .addScaledVector(agentBoundaryInward, inwardBias * 0.12)
  agentBoundaryGlideEnd.copy(start)
    .addScaledVector(agentBoundaryPlaneTangent, glideDistance)
    .addScaledVector(agentBoundaryInward, inwardBias)

  clampToSwimBounds(agentBoundaryGlideMid, bounds)
  clampToSwimBounds(agentBoundaryGlideEnd, bounds)
  if (agentBoundaryGlideEnd.distanceTo(start) < Math.max(0.8, bodyLength * 0.45)) return null

  agentRecoveryEndForward.copy(agentBoundaryPlaneTangent)

  const midTangent = agentBoundaryPlaneTangent.clone()
  const points = [start.clone(), agentBoundaryGlideMid.clone(), agentBoundaryGlideEnd.clone()]
  const tangents = [agentContinuationForward.clone(), midTangent, agentRecoveryEndForward.clone()]
  const path = new THREE.CurvePath()
  for (let i = 0; i < points.length - 1; i += 1) {
    const segmentStart = points[i]
    const segmentEnd = points[i + 1]
    const segmentLength = Math.max(0.001, segmentStart.distanceTo(segmentEnd))
    const handleLength = Math.min(segmentLength * 0.32, bodyLength * 1.25)
    agentCurveControlA.copy(segmentStart).addScaledVector(tangents[i], handleLength)
    agentCurveControlB.copy(segmentEnd).addScaledVector(tangents[i + 1], -handleLength)
    path.add(new THREE.CubicBezierCurve3(
      segmentStart.clone(),
      agentCurveControlA.clone(),
      agentCurveControlB.clone(),
      segmentEnd.clone(),
    ))
  }

  const minTurnRadius = Math.max(1.5, bodyLength * SOLO_AGENT_CURVE_MIN_RADIUS_BODY_LENGTHS)
  const measure = measureSoloAgentCurve(path, agentContinuationForward, minTurnRadius, AGENT_BOUNDARY_GLIDE_MAX_TOTAL_TURN)
  path.userData = {
    ...(path.userData ?? {}),
    maxSampleTangentDelta: measure.maxDelta,
    minTurnRadius: measure.minRadius,
    startTangentDelta: measure.startTangentDelta,
    totalTurn: measure.totalTurn,
    hasTangentReversal: measure.hasTangentReversal,
    hasAxisTangentReversal: measure.hasAxisTangentReversal,
    curvatureAccepted: measure.accepted,
    fallbackReason: 'boundary-glide',
  }
  return path
}

function makeSoloAgentRecoveryArc(creature, swim, start, startForward) {
  const bounds = swimBounds(creature.depthZone, swim, creature.size ?? 1)
  const bodyLength = creatureBodyLength(creature, swim)
  const minTurnRadius = Math.max(1.5, bodyLength * SOLO_AGENT_CURVE_MIN_RADIUS_BODY_LENGTHS)
  const radius = minTurnRadius * 1.25
  const handleScale = 4 / 3

  agentContinuationForward.copy(startForward)
  if (agentContinuationForward.lengthSq() < 0.0001) agentContinuationForward.set(0, 0, -1)
  agentContinuationForward.normalize()

  agentRecoverySide.set(-agentContinuationForward.z, 0, agentContinuationForward.x)
  if (agentRecoverySide.lengthSq() < 0.0001) agentRecoverySide.set(1, 0, 0)
  agentRecoverySide.normalize()

  let bestPath = null
  let bestMeasure = null
  let bestScore = Infinity
  for (const turnSign of [-1, 1]) {
    for (let angleDeg = 28; angleDeg <= 145; angleDeg += 7) {
      const angle = THREE.MathUtils.degToRad(angleDeg) * turnSign
      agentCurveControlA.copy(start).addScaledVector(agentContinuationForward, radius * handleScale * Math.tan(Math.abs(angle) / 4))
      agentRecoveryRadial.copy(agentRecoverySide).multiplyScalar(turnSign * radius)
      agentRecoveryEndRadial.copy(agentRecoveryRadial).applyAxisAngle(up, angle)
      agentRecoveryEnd.copy(start).sub(agentRecoveryRadial).add(agentRecoveryEndRadial)
      agentRecoveryEnd.y = THREE.MathUtils.clamp(start.y, bounds.yMin, bounds.yMax)
      if (!pointInsideSwimBounds(agentRecoveryEnd, bounds)) continue

      agentRecoveryEndForward.copy(agentContinuationForward).applyAxisAngle(up, angle).normalize()
      agentCurveControlB.copy(agentRecoveryEnd).addScaledVector(
        agentRecoveryEndForward,
        -radius * handleScale * Math.tan(Math.abs(angle) / 4),
      )
      const path = new THREE.CubicBezierCurve3(
        start.clone(),
        agentCurveControlA.clone(),
        agentCurveControlB.clone(),
        agentRecoveryEnd.clone(),
      )
      const measure = measureSoloAgentCurve(path, agentContinuationForward, minTurnRadius)
      path.userData = {
        ...(path.userData ?? {}),
        maxSampleTangentDelta: measure.maxDelta,
        minTurnRadius: measure.minRadius,
        startTangentDelta: measure.startTangentDelta,
        hasTangentReversal: measure.hasTangentReversal,
        hasAxisTangentReversal: measure.hasAxisTangentReversal,
        totalTurn: measure.totalTurn,
        curvatureAccepted: measure.accepted,
        fallbackReason: 'endpoint-recovery-arc',
      }
      if (measure.score < bestScore) {
        bestScore = measure.score
        bestMeasure = measure
        bestPath = path
      }
      if (measure.accepted) return path
    }
  }

  if (bestPath && bestMeasure) {
    bestPath.userData = {
      ...(bestPath.userData ?? {}),
      curvatureAccepted: false,
    }
  }
  return bestPath
}

function makeSoloAgentForwardFallbackPath(creature, swim, start, startForward) {
  const bounds = swimBounds(creature.depthZone, swim, creature.size ?? 1)
  const bodyLength = creatureBodyLength(creature, swim)
  agentContinuationForward.copy(startForward)
  if (agentContinuationForward.lengthSq() < 0.0001) agentContinuationForward.set(0, 0, -1)
  agentContinuationForward.normalize()

  agentRecoveryEnd.copy(start).addScaledVector(agentContinuationForward, Math.max(2.4, bodyLength * 1.1))
  agentRecoveryEnd.y = THREE.MathUtils.clamp(agentRecoveryEnd.y, bounds.yMin, bounds.yMax)
  if (!pointInsideSwimBounds(agentRecoveryEnd, bounds)) {
    const center = agentRecoveryRadial.set(0, THREE.MathUtils.clamp(start.y, bounds.yMin, bounds.yMax), (bounds.zMin + bounds.zMax) * 0.5)
    agentContinuationForward.subVectors(center, start)
    if (agentContinuationForward.lengthSq() < 0.0001) agentContinuationForward.set(0, 0, -1)
    agentContinuationForward.normalize()
    agentRecoveryEnd.copy(start).addScaledVector(agentContinuationForward, Math.max(2.4, bodyLength * 1.1))
    clampToSwimBounds(agentRecoveryEnd, bounds)
  }

  const path = new THREE.LineCurve3(start.clone(), agentRecoveryEnd.clone())
  path.userData = {
    ...(path.userData ?? {}),
    curvatureAccepted: true,
    fallbackReason: 'forward-fallback',
    minTurnRadius: Infinity,
    maxSampleTangentDelta: 0,
    startTangentDelta: 0,
    hasTangentReversal: false,
  }
  return path
}

function soloAgentPathMeetsEndpointGate(path, creature, swim) {
  const bodyLength = creatureBodyLength(creature, swim)
  const minTurnRadius = Math.max(1.5, bodyLength * SOLO_AGENT_CURVE_MIN_RADIUS_BODY_LENGTHS)
  return (path?.userData?.startTangentDelta ?? Infinity) <= SOLO_AGENT_CURVE_MAX_START_TANGENT_ERROR
    && (path?.userData?.minTurnRadius ?? 0) >= minTurnRadius
    && path?.userData?.boundaryTangentAccepted !== false
    && !path?.userData?.hasTangentReversal
    && !path?.userData?.hasAxisTangentReversal
}

function measureSoloAgentCurve(path, expectedStartTangent, minTurnRadius, maxTotalTurn = SOLO_AGENT_CURVE_MAX_TOTAL_TURN) {
  let maxDelta = 0
  let minRadius = Infinity
  let totalTurn = 0
  let positiveTurn = 0
  let negativeTurn = 0
  let xzPositiveTurn = 0
  let xzNegativeTurn = 0
  let xyPositiveTurn = 0
  let xyNegativeTurn = 0
  let yzPositiveTurn = 0
  let yzNegativeTurn = 0
  let hasPrevious = false
  let turnSign = 0
  let hasTangentReversal = false
  let hasAxisTangentReversal = false

  path.getTangentAt(0, agentCurveNextTangent).normalize()
  const startTangentDelta = expectedStartTangent.lengthSq() > 0.0001
    ? agentCurveNextTangent.angleTo(expectedStartTangent)
    : 0

  for (let i = 0; i <= SOLO_AGENT_CURVE_SAMPLE_COUNT; i += 1) {
    const sampleT = i / SOLO_AGENT_CURVE_SAMPLE_COUNT
    path.getTangentAt(sampleT, agentCurveNextTangent)
    if (agentCurveNextTangent.lengthSq() < 0.0001) continue
    agentCurveNextTangent.normalize()
    path.getPointAt(sampleT, agentCurveNextPoint)

    if (hasPrevious) {
      const tangentDelta = agentCurvePrevTangent.angleTo(agentCurveNextTangent)
      const segmentLength = Math.max(0.001, agentCurvePrevPoint.distanceTo(agentCurveNextPoint))
      const radius = tangentDelta > 0.0001 ? segmentLength / tangentDelta : Infinity
      const signedTurn = agentCurvePrevTangent.x * agentCurveNextTangent.z - agentCurvePrevTangent.z * agentCurveNextTangent.x
      const signedTurnXY = agentCurvePrevTangent.x * agentCurveNextTangent.y - agentCurvePrevTangent.y * agentCurveNextTangent.x
      const signedTurnYZ = agentCurvePrevTangent.y * agentCurveNextTangent.z - agentCurvePrevTangent.z * agentCurveNextTangent.y
      if (tangentDelta > SOLO_AGENT_CURVE_TWIST_EPSILON && Math.abs(signedTurn) > 0.0001) {
        const sampleSign = Math.sign(signedTurn)
        const signedDelta = tangentDelta * sampleSign
        if (signedDelta > 0) positiveTurn += signedDelta
        else negativeTurn += -signedDelta
        if (turnSign === 0) turnSign = sampleSign
        else if (sampleSign !== turnSign) hasTangentReversal = true
      }
      if (tangentDelta > SOLO_AGENT_CURVE_PLANE_TWIST_EPSILON) {
        if (Math.abs(signedTurn) > 0.0001) {
          if (signedTurn > 0) xzPositiveTurn += tangentDelta
          else xzNegativeTurn += tangentDelta
        }
        if (Math.abs(signedTurnXY) > 0.0001) {
          if (signedTurnXY > 0) xyPositiveTurn += tangentDelta
          else xyNegativeTurn += tangentDelta
        }
        if (Math.abs(signedTurnYZ) > 0.0001) {
          if (signedTurnYZ > 0) yzPositiveTurn += tangentDelta
          else yzNegativeTurn += tangentDelta
        }
      }
      if (positiveTurn > SOLO_AGENT_CURVE_MAX_OPPOSITE_TURN && negativeTurn > SOLO_AGENT_CURVE_MAX_OPPOSITE_TURN) {
        hasTangentReversal = true
      }
      if (
        (xzPositiveTurn > SOLO_AGENT_CURVE_MAX_OPPOSITE_TURN && xzNegativeTurn > SOLO_AGENT_CURVE_MAX_OPPOSITE_TURN)
        || (xyPositiveTurn > SOLO_AGENT_CURVE_MAX_OPPOSITE_TURN && xyNegativeTurn > SOLO_AGENT_CURVE_MAX_OPPOSITE_TURN)
        || (yzPositiveTurn > SOLO_AGENT_CURVE_MAX_OPPOSITE_TURN && yzNegativeTurn > SOLO_AGENT_CURVE_MAX_OPPOSITE_TURN)
      ) {
        hasAxisTangentReversal = true
      }
      totalTurn += tangentDelta
      maxDelta = Math.max(maxDelta, tangentDelta)
      minRadius = Math.min(minRadius, radius)
    }

    agentCurvePrevTangent.copy(agentCurveNextTangent)
    agentCurvePrevPoint.copy(agentCurveNextPoint)
    hasPrevious = true
  }

  const radiusShortfall = minTurnRadius / Math.max(0.001, minRadius)
  const totalTurnOverflow = Math.max(0, totalTurn - maxTotalTurn)
  return {
    maxDelta,
    minRadius,
    startTangentDelta,
    totalTurn,
    positiveTurn,
    negativeTurn,
    xzPositiveTurn,
    xzNegativeTurn,
    xyPositiveTurn,
    xyNegativeTurn,
    yzPositiveTurn,
    yzNegativeTurn,
    hasTangentReversal,
    hasAxisTangentReversal,
    accepted: startTangentDelta <= SOLO_AGENT_CURVE_MAX_START_TANGENT_ERROR
      && maxDelta <= SOLO_AGENT_CURVE_MAX_SAMPLE_DELTA
      && minRadius >= minTurnRadius
      && totalTurn <= maxTotalTurn
      && !hasTangentReversal
      && !hasAxisTangentReversal,
    score: startTangentDelta * 120
      + maxDelta * 20
      + totalTurn * 1.8
      + totalTurnOverflow * 140
      + radiusShortfall
      + (hasTangentReversal ? 1000 : 0)
      + (hasAxisTangentReversal ? 1000 : 0),
  }
}

function makeSoloAgentBezier(creature, swim, start, startForward, target, rand, leadScale = 1) {
  const bodyLength = creatureBodyLength(creature, swim)
  const bounds = swimBounds(creature.depthZone, swim, creature.size ?? 1)
  const distance = Math.max(0.001, start.distanceTo(target))

  agentCurveStartForward.copy(startForward)
  if (agentCurveStartForward.lengthSq() < 0.0001) agentCurveStartForward.subVectors(target, start)
  if (agentCurveStartForward.lengthSq() < 0.0001) agentCurveStartForward.set(0, 0, -1)
  agentCurveStartForward.normalize()

  agentCurveEndForward.subVectors(target, start)
  if (agentCurveEndForward.lengthSq() < 0.0001) agentCurveEndForward.copy(agentCurveStartForward)
  else agentCurveEndForward.normalize()

  const alignment = THREE.MathUtils.clamp(agentCurveStartForward.dot(agentCurveEndForward), -1, 1)
  if (alignment < 0.35) {
    agentCurveEndForward.lerp(agentCurveStartForward, THREE.MathUtils.lerp(0.72, 0.22, (alignment + 1) / 1.35)).normalize()
  }
  shapeBoundaryEndpointTangent(agentCurveEndForward, target, bounds, bodyLength, agentCurveStartForward)

  agentRecoverySide.set(-agentCurveStartForward.z, 0, agentCurveStartForward.x)
  if (agentRecoverySide.lengthSq() < 0.0001) agentRecoverySide.set(1, 0, 0)
  agentRecoverySide.normalize()
  const targetSide = Math.sign(agentRecoverySide.dot(agentCurveEndForward)) || (rand() < 0.5 ? -1 : 1)
  const lateralOffset = distance * THREE.MathUtils.clamp((1 - alignment) * 0.16, 0.035, 0.24) * targetSide

  const points = [
    start.clone(),
    start.clone().addScaledVector(agentCurveStartForward, distance * 0.24),
    start.clone().lerp(target, 0.52).addScaledVector(agentRecoverySide, lateralOffset),
    target.clone().addScaledVector(agentCurveEndForward, -distance * 0.22),
    target.clone(),
  ]
  points[1].y = THREE.MathUtils.lerp(start.y, target.y, 0.18)
  points[2].y = THREE.MathUtils.lerp(start.y, target.y, 0.52)
  points[3].y = THREE.MathUtils.lerp(start.y, target.y, 0.82)

  const tangents = points.map((point, index) => {
    if (index === 0) return agentCurveStartForward.clone()
    if (index === points.length - 1) return agentCurveEndForward.clone()
    const prev = points[index - 1]
    const next = points[index + 1]
    const tangentAtPoint = next.clone().sub(prev)
    if (tangentAtPoint.lengthSq() < 0.0001) tangentAtPoint.copy(agentCurveStartForward)
    return tangentAtPoint.normalize()
  })

  const path = new THREE.CurvePath()
  for (let i = 0; i < points.length - 1; i += 1) {
    const segmentStart = points[i]
    const segmentEnd = points[i + 1]
    const segmentLength = Math.max(0.001, segmentStart.distanceTo(segmentEnd))
    const handleLength = Math.min(
      segmentLength * THREE.MathUtils.lerp(0.20, 0.32, THREE.MathUtils.clamp(leadScale, 0, 1.4)),
      bodyLength * 1.15,
    )
    agentCurveControlA.copy(segmentStart).addScaledVector(tangents[i], handleLength)
    agentCurveControlB.copy(segmentEnd).addScaledVector(tangents[i + 1], -handleLength)
    path.add(new THREE.CubicBezierCurve3(
      segmentStart.clone(),
      agentCurveControlA.clone(),
      agentCurveControlB.clone(),
      segmentEnd.clone(),
    ))
  }

  path.userData = {
    ...(path.userData ?? {}),
    segmentCount: points.length - 1,
  }
  return path
}

function makeSoloAgentPath(creature, swim, start, startForward, target, rand) {
  const bodyLength = creatureBodyLength(creature, swim)
  const bounds = swimBounds(creature.depthZone, swim, creature.size ?? 1)
  const minTurnRadius = Math.max(1.5, bodyLength * SOLO_AGENT_CURVE_MIN_RADIUS_BODY_LENGTHS)
  agentCurveStartForward.copy(startForward)
  if (agentCurveStartForward.lengthSq() < 0.0001) agentCurveStartForward.subVectors(target, start)
  if (agentCurveStartForward.lengthSq() < 0.0001) agentCurveStartForward.set(0, 0, -1)
  agentCurveStartForward.normalize()

  let bestPath = null
  let bestMeasure = null
  let bestScore = Infinity

  for (let attempt = 0; attempt < SOLO_AGENT_CURVE_BUILD_ATTEMPTS; attempt += 1) {
    const leadScale = 0.72 + attempt * 0.04
    const path = makeSoloAgentBezier(creature, swim, start, agentCurveStartForward, target, rand, leadScale)
    const measure = measureSoloAgentCurve(path, agentCurveStartForward, minTurnRadius)
    const boundaryTangentAccepted = soloAgentEndpointTangentMeetsBoundaryPlane(path, target, bounds, bodyLength)
    const accepted = measure.accepted && boundaryTangentAccepted
    path.userData = {
      ...(path.userData ?? {}),
      maxSampleTangentDelta: measure.maxDelta,
      minTurnRadius: measure.minRadius,
      startTangentDelta: measure.startTangentDelta,
      hasTangentReversal: measure.hasTangentReversal,
      hasAxisTangentReversal: measure.hasAxisTangentReversal,
      totalTurn: measure.totalTurn,
      boundaryTangentAccepted,
      curvatureAccepted: accepted,
    }
    const score = measure.score + (boundaryTangentAccepted ? 0 : 800)
    if (score < bestScore) {
      bestScore = score
      bestMeasure = measure
      bestPath = path
    }
    if (accepted) return path
  }

  if (bestPath && bestMeasure) {
    bestPath.userData = {
      ...(bestPath.userData ?? {}),
      curvatureAccepted: false,
      fallbackReason: 'rejected-min-radius',
    }
  }
  return bestPath
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
  const z = randomRange(rand, bounds.zMin, bounds.zMax)
  const xRangeAtZ = swimXRangeAtZ(bounds, z)
  const xRange = xRangeAtZ.xMax - xRangeAtZ.xMin
  const laneJitter = xRange * 0.06
  const laneX = side < 0
    ? THREE.MathUtils.lerp(xRangeAtZ.xMin, xRangeAtZ.xMax, 0.14)
    : THREE.MathUtils.lerp(xRangeAtZ.xMin, xRangeAtZ.xMax, 0.86)

  return new THREE.Vector3(
    laneX + randomRange(rand, -laneJitter, laneJitter),
    traversalY(rand, bounds, swim, index, verticalScale, 0.52),
    z,
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
    points.push(clampToSwimBounds(lead, bounds))

    for (let i = 2; i < pointCount; i += 1) points.push(randomPoint(rand, bounds, swim, i, verticalScale))
  } else {
    for (let i = 0; i < pointCount; i += 1) points.push(randomPoint(rand, bounds, swim, i, verticalScale))
  }

  limitPathYGradient(points, bounds)
  const tension = THREE.MathUtils.lerp(0.32, 0.78, turnRadius)
  return new THREE.CatmullRomCurve3(points, false, 'catmullrom', tension)
}

function rotatedSchoolPoint(rand, bounds, swim, index, pointCount, verticalScale, rotation, weavePhase, pattern = {}) {
  const sideIndex = index + (pattern.laneFlip ?? 0)
  const depthIndex = Math.floor(index / 2) + (pattern.depthFlip ?? 0)
  const yIndex = index + (pattern.yFlip ?? 0)
  const side = sideIndex % 2 === 0 ? -1 : 1
  const depthSide = depthIndex % 2 === 0 ? -1 : 1
  const normalized = pointCount <= 1 ? 0 : index / (pointCount - 1)
  const zRange = bounds.zMax - bounds.zMin
  const hasExplicitBounds = ['boundsZMin', 'boundsZMax', 'boundsYMin', 'boundsYMax'].some(key => Number.isFinite(swim[key]))

  if (hasExplicitBounds) {
    const laneT = side < 0
      ? randomRange(rand, 0.04, 0.22)
      : randomRange(rand, 0.78, 0.96)
    const depthT = depthSide < 0
      ? randomRange(rand, 0.04, 0.30)
      : randomRange(rand, 0.70, 0.96)
    const weave = Math.sin(normalized * Math.PI * 2.35 + weavePhase) * zRange * 0.08

    const z = THREE.MathUtils.lerp(bounds.zMin, bounds.zMax, depthT) + weave
    return clampToSwimBounds(new THREE.Vector3(
      randomXInSwimBoundsAtZ(rand, bounds, z, laneT, laneT),
      traversalY(rand, bounds, swim, yIndex, verticalScale, 0.62),
      z,
    ), bounds)
  }

  const weave = Math.sin(normalized * Math.PI * 2.35 + weavePhase) * bounds.z * 0.26
  const localX = side * bounds.x * randomRange(rand, 0.54, 0.82) + randomRange(rand, -bounds.x * 0.14, bounds.x * 0.14)
  const localZ = depthSide * bounds.z * randomRange(rand, 0.36, 0.74) + weave + randomRange(rand, -bounds.z * 0.18, bounds.z * 0.18)
  const cos = Math.cos(rotation)
  const sin = Math.sin(rotation)

  return clampToSwimBounds(new THREE.Vector3(
    localX * cos - localZ * sin,
    traversalY(rand, bounds, swim, yIndex, verticalScale, 0.62),
    localX * sin + localZ * cos,
  ), bounds)
}

function makeSchoolPath(creature, swim, seed = hashString(creature.species ?? 'school'), start = null, exitTangent = null) {
  const rand = mulberry32(seed)
  const bounds = swimBounds(creature.depthZone, swim, creature.size ?? 1)
  const turnRadius = effectiveTurnRadius(creature, swim)
  const pointCount = Math.round(THREE.MathUtils.lerp(8, 5, turnRadius))
  const verticalScale = verticalPathScale(creature, swim)
  const rotation = randomRange(rand, -Math.PI, Math.PI)
  const weavePhase = randomRange(rand, 0, Math.PI * 2)
  const pattern = {
    laneFlip: rand() < 0.5 ? 0 : 1,
    depthFlip: rand() < 0.5 ? 0 : 1,
    yFlip: rand() < 0.5 ? 0 : 1,
  }
  const points = []

  if (start && exitTangent) {
    points.push(start.clone())
    const leadDistance = THREE.MathUtils.lerp(2.4, 7.0, turnRadius) * THREE.MathUtils.lerp(1, 1.35, largeCreatureFactor(creature, swim)) * randomRange(rand, 0.9, 1.15)
    const lead = start.clone().add(exitTangent.clone().normalize().multiplyScalar(leadDistance))
    lead.y = THREE.MathUtils.lerp(lead.y, traversalY(rand, bounds, swim, 1, verticalScale, 0.62), 0.58)
    lead.z += randomRange(rand, -0.7, 0.7)
    points.push(clampToSwimBounds(lead, bounds))
  }

  for (let i = points.length; i < pointCount; i += 1) {
    points.push(rotatedSchoolPoint(rand, bounds, swim, i, pointCount, verticalScale, rotation, weavePhase, pattern))
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
  const bodyLength = swim.bodyLengthWU * (creature.size ?? 1)
  const bodyScale = THREE.MathUtils.clamp(bodyLength, 0.35, 1.8)
  const sameSchool = school?.id && other.schoolId === school.id
  const otherBodyLength = other.bodyLength ?? other.radius * 2
  const sizeRatio = otherBodyLength / Math.max(0.001, bodyLength)
  const sizeYieldBias = sizeRatio >= 1
    ? THREE.MathUtils.lerp(1, 2.2, THREE.MathUtils.clamp(sizeRatio - 1, 0, 1))
    : THREE.MathUtils.clamp(sizeRatio ** 1.5, 0.08, 1)

  // TODO(species-dominance): add a species hierarchy override so specific timid
  // species can yield to dominant species regardless of raw body size.
  if (!sameSchool) return bodyScale * sizeYieldBias

  const density = 1 / Math.sqrt(Math.max(1, school.count))
  const denseScale = school.count >= DENSE_SCHOOL_MIN_COUNT ? 0.34 : 0.75
  return bodyScale * density * denseScale * sizeYieldBias
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
  const entry = FISH_REGISTRY.get(creature.id)
  if (entry) {
    entry.position.copy(fish.position)
    entry.radius = radius
    entry.bodyLength = swim.bodyLengthWU * (creature.size ?? 1)
    entry.species = creature.species
    entry.biome = creature.biome
    entry.schoolId = school?.id ?? null
  } else {
    FISH_REGISTRY.set(creature.id, {
      position: fish.position.clone(),
      radius,
      bodyLength: swim.bodyLengthWU * (creature.size ?? 1),
      species: creature.species,
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

function applyFresnelRim(material, color, intensity, power = RIM_POWER) {
  const rimColor = new THREE.Color(color)
  const rimKey = `${rimColor.getHexString()}:${intensity}:${power}`

  material.onBeforeCompile = (shader) => {
    shader.uniforms.uRimColor = { value: rimColor }
    shader.uniforms.uRimIntensity = { value: intensity }
    shader.uniforms.uRimPower = { value: power }
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
uniform vec3 uRimColor;
uniform float uRimIntensity;
uniform float uRimPower;`
      )
      .replace(
        '#include <dithering_fragment>',
        `float rimAmount = pow(1.0 - abs(dot(normalize(normal), normalize(vViewPosition))), uRimPower);
gl_FragColor.rgb += uRimColor * rimAmount * uRimIntensity;
#include <dithering_fragment>`
      )
  }
  material.customProgramCacheKey = () => `fresnel-rim:${rimKey}`
  material.needsUpdate = true
}

function applyFishLightMaskDiagnostic(material, rim = null) {
  if (!FISH_LIGHT_MASK_DIAGNOSTIC && !rim) return
  const rimColor = rim ? new THREE.Color(rim.color) : new THREE.Color('#000000')
  const rimIntensity = rim?.intensity ?? 0
  const rimPower = rim?.power ?? RIM_POWER
  const rimKey = rim ? `${rimColor.getHexString()}:${rimIntensity}:${rimPower}` : 'none'
  const maskUniforms = { uTime: { value: 0 } }

  material.onBeforeCompile = (shader) => {
    shader.uniforms.uFishLightMaskTime = maskUniforms.uTime
    shader.uniforms.uRimColor = { value: rimColor }
    shader.uniforms.uRimIntensity = { value: rimIntensity }
    shader.uniforms.uRimPower = { value: rimPower }
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
varying vec3 vFishWorldPosition;`
      )
      .replace(
        '#include <worldpos_vertex>',
        `#include <worldpos_vertex>
vec4 fishWorldPosition = vec4(transformed, 1.0);
#ifdef USE_INSTANCING
fishWorldPosition = instanceMatrix * fishWorldPosition;
#endif
fishWorldPosition = modelMatrix * fishWorldPosition;
vFishWorldPosition = fishWorldPosition.xyz;`
      )
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
uniform float uFishLightMaskTime;
uniform vec3 uRimColor;
uniform float uRimIntensity;
uniform float uRimPower;
varying vec3 vFishWorldPosition;`
      )
      .replace(
        '#include <dithering_fragment>',
        `${FISH_LIGHT_MASK_DIAGNOSTIC ? `vec3 maskPos = vFishWorldPosition;
float stripeA = sin(maskPos.x * 1.75 + maskPos.y * 0.85 + maskPos.z * 1.10 + uFishLightMaskTime * 0.46);
float stripeB = sin(maskPos.x * -0.95 + maskPos.z * 2.15 - uFishLightMaskTime * 0.34);
float lightMask = smoothstep(0.06, 0.46, stripeA + stripeB * 0.28);
float shadowMask = smoothstep(0.08, 0.50, -stripeA + stripeB * 0.16);
float topWeight = smoothstep(-8.0, 3.0, maskPos.y);
float lightFactor = mix(0.68, 1.04, lightMask) * mix(0.82, 1.0, shadowMask);
gl_FragColor.rgb *= mix(1.0, lightFactor, 0.80 * topWeight);` : ''}
float rimAmount = pow(1.0 - abs(dot(normalize(normal), normalize(vViewPosition))), uRimPower);
gl_FragColor.rgb += uRimColor * rimAmount * uRimIntensity;
#include <dithering_fragment>`
      )
  }
  material.customProgramCacheKey = () => `fish-light-mask-diagnostic:${FISH_LIGHT_MASK_DIAGNOSTIC ? 'on' : 'off'}:${rimKey}`
  material.userData.fishLightMaskUniforms = maskUniforms
  material.needsUpdate = true
}

function applyModelMaterialSettings(root, rim = null, lodDebugColor = null) {
  const materials = []
  root.traverse(child => {
    if (!child.isMesh) return
    child.castShadow = false
    child.receiveShadow = false
    const list = Array.isArray(child.material) ? child.material : [child.material]
    const clonedMaterials = list.map(material => {
      if (!material) return material
      const nextMaterial = material.clone()
      nextMaterial.transparent = false
      nextMaterial.opacity = 1
      nextMaterial.depthWrite = true
      nextMaterial.roughness = nextMaterial.roughness ?? 0.5
      if (nextMaterial.name?.toLowerCase() === 'sardine') nextMaterial.roughness = SARDINE_MATERIAL_ROUGHNESS
      if (lodDebugColor && nextMaterial.color) nextMaterial.color.set(lodDebugColor)
      if (lodDebugColor && nextMaterial.emissive) {
        nextMaterial.emissive.set(lodDebugColor)
        nextMaterial.emissiveIntensity = 0.32
      }
      applyFishLightMaskDiagnostic(nextMaterial, rim)
      materials.push(nextMaterial)
      return nextMaterial
    })
    child.material = Array.isArray(child.material) ? clonedMaterials : clonedMaterials[0]
  })
  return materials
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
      slow_cruise: idleSpeed,
      idle_drift: idleSpeed * randomRange(rand, 0.82, 0.96),
      burst: actionSpeed * randomRange(rand, 0.98, 1.08),
      snap_left: actionSpeed * randomRange(rand, 0.96, 1.12),
      snap_right: actionSpeed * randomRange(rand, 0.96, 1.12),
      bank_l: actionSpeed * randomRange(rand, 0.96, 1.06),
      bank_r: actionSpeed * randomRange(rand, 0.96, 1.06),
      default: baseSpeed,
    },
  }
}

function resolveMoveAnimation(model, move) {
  return model?.moveset?.[move] ?? DEFAULT_MOVESET[move] ?? move
}

function resolveModelAnimation(model, animation) {
  return model?.animationMap?.[animation] ?? animation
}

function shouldLoopModelAnimation(model, animation, resolvedAnimation) {
  if (animation === 'idle') return true
  return model?.loopAnimations?.includes(resolvedAnimation) ?? false
}

function modelFadeDuration(model, fallback = 0.18) {
  return model?.animationFadeDuration ?? fallback
}

function modelAnimationSpeed(animationVariation, animation, resolvedAnimation) {
  const speed = animationVariation?.speeds?.[resolvedAnimation]
    ?? animationVariation?.speeds?.[animation]
    ?? animationVariation?.speeds?.default
    ?? 1
  return speed * GLOBAL_ANIMATION_TIME_SCALE
}

function configureModelAction(action, model, animation, resolvedAnimation, speed, offset) {
  action.enabled = true
  action.userData ??= {}
  action.userData.baseTimeScale = speed
  action.setEffectiveTimeScale(speed)

  if (shouldLoopModelAnimation(model, animation, resolvedAnimation)) {
    action.setLoop(THREE.LoopRepeat, Infinity)
    action.clampWhenFinished = false
    action.time = (action.getClip()?.duration ?? 0) * offset
  } else {
    action.setLoop(THREE.LoopOnce, 1)
    action.clampWhenFinished = true
    action.time = 0
  }
}

function playModelAction(actions, activeActionRef, model, animation, animationVariation) {
  const resolvedAnimation = resolveModelAnimation(model, animation)
  const nextAction = actions[resolvedAnimation] ?? actions[animation] ?? actions.idle ?? Object.values(actions)[0]
  if (!nextAction || activeActionRef.current === nextAction) return

  const speed = modelAnimationSpeed(animationVariation, animation, resolvedAnimation)
  const offset = animationVariation?.startOffset ?? 0

  nextAction.reset()
  nextAction.setEffectiveWeight(1)
  configureModelAction(nextAction, model, animation, resolvedAnimation, speed, offset)

  const previousAction = activeActionRef.current
  nextAction.play()
  if (previousAction) nextAction.crossFadeFrom(previousAction, modelFadeDuration(model, 0.12), false)

  activeActionRef.current = nextAction
}

function layeredAnimationClips(gltfAnimations, model) {
  // Keep the authored clips intact. The Mola clips are exported without root
  // displacement, so normal layered actions are safer than runtime additive
  // conversion and still let slow_cruise continue underneath overlays.
  if (!model?.layeredAnimations) return gltfAnimations
  return gltfAnimations
}

function playLayeredModelAction(actions, activeActionRef, model, animation, animationVariation) {
  const baseAnimation = model.layeredBaseAnimation ?? resolveMoveAnimation(model, 'cruise')
  const baseAction = actions[baseAnimation]
  const offset = animationVariation?.startOffset ?? 0

  if (baseAction && !baseAction.isRunning()) {
    const speed = modelAnimationSpeed(animationVariation, baseAnimation, baseAnimation)
    baseAction.reset()
    baseAction.setEffectiveWeight(model.layeredBaseWeight ?? 1)
    configureModelAction(baseAction, model, baseAnimation, baseAnimation, speed, offset)
    baseAction.play()
  }

  const resolvedAnimation = resolveModelAnimation(model, animation)
  if (resolvedAnimation === baseAnimation) {
    const previousOverlay = activeActionRef.current
    if (previousOverlay) previousOverlay.fadeOut(modelFadeDuration(model))
    activeActionRef.current = null
    return
  }

  const nextAction = actions[resolvedAnimation] ?? actions[animation]
  if (!nextAction || activeActionRef.current === nextAction) return

  const previousOverlay = activeActionRef.current
  const speed = modelAnimationSpeed(animationVariation, animation, resolvedAnimation)
  nextAction.reset()
  nextAction.setEffectiveWeight(model.layeredOverlayWeight ?? 1)
  configureModelAction(nextAction, model, animation, resolvedAnimation, speed, offset)
  nextAction.play()
  nextAction.fadeIn(modelFadeDuration(model))
  if (previousOverlay) previousOverlay.fadeOut(modelFadeDuration(model))
  activeActionRef.current = nextAction
}

function MolaMolaPlaceholder({ species, swim, rimColor = null, rimIntensity = 0 }) {
  const dims = placeholderDimensions(species, swim)
  const bodyColor = species?.placeholder?.bodyColor ?? '#8fb8bc'
  const finColor = species?.placeholder?.finColor ?? '#6f9fa4'
  const rim = rimColor ?? '#000000'

  return (
    <group raycast={() => null}>
      {rimColor && (
        <mesh scale={[dims.length * 1.04, dims.height * 1.04, dims.thickness * 1.08]}>
          <sphereGeometry args={[0.5, 36, 18]} />
          <meshBasicMaterial color={rim} transparent opacity={0.34} depthWrite={false} depthTest side={THREE.BackSide} />
        </mesh>
      )}
      <mesh scale={[dims.length, dims.height, dims.thickness]}>
        <sphereGeometry args={[0.5, 48, 24]} />
        <meshStandardMaterial color={bodyColor} roughness={0.46} metalness={0.02} envMapIntensity={0.9} />
      </mesh>
      <mesh position={[dims.length * -0.08, dims.height * 0.48, 0]} rotation={[0, 0, Math.PI]} scale={[dims.length * 0.08, dims.height * 0.34, dims.thickness * 0.58]}>
        <coneGeometry args={[1, 1, 3]} />
        <meshStandardMaterial color={finColor} roughness={0.56} metalness={0.01} envMapIntensity={0.75} />
      </mesh>
      <mesh position={[dims.length * -0.08, dims.height * -0.48, 0]} scale={[dims.length * 0.08, dims.height * 0.34, dims.thickness * 0.58]}>
        <coneGeometry args={[1, 1, 3]} />
        <meshStandardMaterial color={finColor} roughness={0.56} metalness={0.01} envMapIntensity={0.75} />
      </mesh>
      <mesh position={[dims.length * -0.50, 0, 0]} rotation={[0, 0, Math.PI / 2]} scale={[dims.thickness * 0.45, dims.height * 0.22, dims.thickness * 0.36]}>
        <coneGeometry args={[1, 1, 3]} />
        <meshStandardMaterial color={finColor} roughness={0.58} metalness={0.01} envMapIntensity={0.7} />
      </mesh>
    </group>
  )
}

function FishModel({ model, animation = 'idle', animationVariation, animationSpeedScaleRef = null, rim = null, lodDebugColor = null }) {
  const gltf = useGLTF(model.path)
  const object = useMemo(() => clone(gltf.scene), [gltf.scene])
  const animations = useMemo(() => layeredAnimationClips(gltf.animations, model), [gltf.animations, model])
  const { actions } = useAnimations(animations, object)
  const activeActionRef = useRef(null)
  const materialsRef = useRef([])

  useEffect(() => {
    materialsRef.current = applyModelMaterialSettings(object, rim, lodDebugColor)
  }, [object, rim, lodDebugColor])

  useFrame(({ clock }) => {
    const elapsed = clock.getElapsedTime()
    const activeAction = activeActionRef.current
    if (activeAction) {
      const baseTimeScale = activeAction.userData?.baseTimeScale ?? 1
      activeAction.setEffectiveTimeScale(baseTimeScale * (animationSpeedScaleRef?.current ?? 1))
    }
    materialsRef.current.forEach(material => {
      const uniforms = material?.userData?.fishLightMaskUniforms
      if (uniforms) uniforms.uTime.value = elapsed
    })
  })

  useEffect(() => {
    if (model?.layeredAnimations) {
      playLayeredModelAction(actions, activeActionRef, model, animation, animationVariation)
      return
    }
    playModelAction(actions, activeActionRef, model, animation, animationVariation)
  }, [actions, model, animation, animationVariation])

  return (
    <primitive
      object={object}
      scale={model.scale ?? 1}
      rotation={model.rotation ?? [0, 0, 0]}
      position={model.position ?? [0, 0, 0]}
    />
  )
}

export default function Fish({ creature, selected = false, zoomActive = false, debugSunBaskRequestId = 0, hideSelectionSilhouette = false, debug = false, debugLayers = null, debugLodView = false, school = null, onClick, onReady }) {
  const ref = useRef()
  const modelRootRef = useRef()
  const forwardLineRef = useRef()
  const speedLabelRef = useRef()
  const driftLabelRef = useRef()
  const agentLabelRef = useRef()
  const nameLabelRef = useRef()
  const followTargetMarkerRef = useRef()
  const swim = useMemo(() => resolveSwimProfile(creature), [creature])
  const species = useMemo(() => resolveSpecies(creature), [creature])
  const model = useMemo(() => resolveModel(creature), [creature])
  const canInstanceSardine = model?.path?.includes('/sardine/') && creature.species === 'Spotted Sardinella'
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
  const isSoloAgent = Boolean(species && species.schooling === false && !isSchooling)
  const showAgentDebug = isSoloAgent
  const schoolState = useMemo(() => (isSchooling ? getSchoolState(school, creature, swim) : null), [isSchooling, school, creature, swim])
  const pathSeed = useRef((hashString(creature.id ?? creature.species ?? 'fish') ^ randomSeed()) >>> 0)
  const progress = useRef(0)
  const followTarget = useRef(new THREE.Vector3())
  const agentTarget = useRef(new THREE.Vector3())
  const agentPath = useRef(null)
  const agentPathProgress = useRef(0)
  const agentPathLength = useRef(1)
  const agentPathExitTangent = useRef(new THREE.Vector3())
  const agentRand = useRef(mulberry32(hashString(`${creature.id ?? creature.species}:solo-agent`)))
  const agentHasTarget = useRef(false)
  const nextAgentRetargetAt = useRef(0)
  const agentStatus = useRef('cruise')
  const agentBehavior = useRef(null)
  const agentBehaviorStartedAt = useRef(0)
  const agentBehaviorDistance = useRef(0)
  const agentDepthMode = useRef('deep')
  const agentDepthTargetsRemaining = useRef(0)
  const lastSunBaskAt = useRef(-Infinity)
  const sunBaskQueued = useRef(false)
  const queuedSunBaskRequestId = useRef(0)
  const wasZoomActive = useRef(false)
  const runtimeRecoveryResumeAt = useRef(0)
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
  const nextDriftAt = useRef(0)
  const driftUntil = useRef(0)
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
  const animationRef = useRef(resolveMoveAnimation(model, 'cruise'))
  const animationSpeedScaleRef = useRef(1)
  const [animation, setAnimation] = useState(() => resolveMoveAnimation(model, 'cruise'))
  const [instancedSardineLod, setInstancedSardineLod] = useState(null)
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
      driftSpeed: randomRangeFromPair(rand, swim.idleDriftBLPerSec, DEFAULT_SWIM.idleDriftBLPerSec) * velocityScale,
      burstInterval: randomRangeFromPair(rand, swim.burstInterval, DEFAULT_SWIM.burstInterval),
      driftInterval: randomRangeFromPair(rand, swim.driftInterval, DEFAULT_DRIFT_INTERVAL),
      driftDuration: randomRangeFromPair(rand, swim.driftDuration, DEFAULT_DRIFT_DURATION),
      burstActionDuration: swim.burstActionDuration ?? DEFAULT_BURST_ACTION_DURATION,
      turnActionDuration: swim.turnActionDuration ?? DEFAULT_TURN_ACTION_DURATION,
      turnTriggerThreshold: swim.turnTriggerThreshold ?? SNAP_TURN_THRESHOLD,
      burstPhase: randomRange(rand, 0, 3.5),
      driftPhase: randomRange(rand, 5, 11),
      bobPhase: randomRange(rand, 0, Math.PI * 2),
      bobAmount: randomRange(rand, 0.035, 0.11) * THREE.MathUtils.lerp(0.45, 1.35, swim.erraticness),
      metersPerWU: WORLD_UNIT_METERS,
    }
  }, [creature, swim, isSchooling, school?.id])
  const instancedEntry = useMemo(() => {
    const rand = mulberry32(hashString(`${creature.id}:sardine-instance`))
    return {
      matrix: new THREE.Matrix4(),
      position: new THREE.Vector3(),
      quaternion: new THREE.Quaternion(),
      scale: 1,
      variant: Math.floor(randomRange(rand, 0, 4)),
      tint: randomRange(rand, 0.92, 1.08),
    }
  }, [creature.id])

  useEffect(() => {
    onReady?.(creature, ref)
  }, [creature, onReady])

  useEffect(() => {
    if (!debugSunBaskRequestId || debugSunBaskRequestId === queuedSunBaskRequestId.current) return
    queuedSunBaskRequestId.current = debugSunBaskRequestId
    if (!debug || !selected || !zoomActive || !isMolaCreature(creature)) return
    sunBaskQueued.current = true
  }, [creature, debug, debugSunBaskRequestId, selected, zoomActive])

  useEffect(() => {
    return () => FISH_REGISTRY.delete(creature.id)
  }, [creature.id])

  useEffect(() => {
    return () => {
      removeSardineLod1Instance(creature.id)
      removeSardineInstance(creature.id)
      removeSardineLod0Entry(creature.id)
      removeSardineFrustumEntry(creature.id)
    }
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
    agentRand.current = mulberry32(hashString(`${creature.id ?? creature.species}:solo-agent`))
    agentPath.current = null
    agentPathProgress.current = 0
    agentPathLength.current = 1
    agentPathExitTangent.current.set(0, 0, 0)
    agentHasTarget.current = false
    nextAgentRetargetAt.current = 0
    agentStatus.current = 'cruise'
    agentBehavior.current = null
    agentBehaviorStartedAt.current = 0
    agentBehaviorDistance.current = 0
    agentDepthMode.current = 'deep'
    agentDepthTargetsRemaining.current = 0
    lastSunBaskAt.current = -Infinity
    sunBaskQueued.current = false
    queuedSunBaskRequestId.current = 0
  }, [creature.id, creature.species])

  useEffect(() => {
    if (!isSchoolLeader || !school?.id) return undefined
    return () => {
      if (SCHOOL_STATES.get(school.id) === schoolState) SCHOOL_STATES.delete(school.id)
    }
  }, [isSchoolLeader, school?.id, schoolState])

  useEffect(() => {
    velocity.current = motion.idleSpeed
    nextBurstAt.current = motion.burstPhase + motion.burstInterval
    nextDriftAt.current = motion.driftPhase
    driftUntil.current = 0
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
    if (zoomActive) {
      runtimeRecoveryResumeAt.current = Infinity
    } else if (wasZoomActive.current) {
      runtimeRecoveryResumeAt.current = now + SOLO_AGENT_RUNTIME_RECOVERY_AFTER_FOLLOW_DELAY
    }
    wasZoomActive.current = zoomActive

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
    const driftMove = resolveMoveAnimation(model, 'drift')
    const hasDriftMove = Boolean(model?.moveset?.drift && driftMove !== resolveMoveAnimation(model, 'cruise'))
    const isActionMoveActive = now < actionSpeedUntil.current
    const isDrifting = hasDriftMove && !isActionMoveActive && now < driftUntil.current
    const targetVelocity = isActionMoveActive ? actionSpeedTarget.current : (isDrifting ? motion.driftSpeed : idleVelocity)
    const velocityResponse = isActionMoveActive ? 8 : (isDrifting ? 1.2 : 2.4)

    velocity.current = THREE.MathUtils.lerp(
      velocity.current,
      targetVelocity,
      1 - Math.exp(-delta * velocityResponse),
    )

    if (isSchooling) {
      if (isSchoolLeader) schoolState.progress += delta * velocity.current / pathLength
    } else if (!isSoloAgent) {
      progress.current += delta * velocity.current / pathLength
    }

    const pathProgress = isSchooling ? schoolState.progress : progress.current
    const shouldAdvanceSchoolPath = isSchooling && isSchoolLeader && pathProgress >= 1 - SCHOOL_PHASE_WINDOW
    if ((!isSchooling && !isSoloAgent && progress.current >= 1) || shouldAdvanceSchoolPath) {
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
    let position = isSchooling
      ? offsetFromSchoolPoint(schoolBasePosition, currentPath, t, schoolOffset, now, organicNoise.current)
      : currentPath.getPointAt(t)
    currentPath.getPointAt(Math.min(t + 0.006, 1), nextPoint)
    tangent.subVectors(nextPoint, currentPath.getPointAt(t)).normalize()

    const followDistance = followLookaheadDistance(creature, swim, isSchooling)
    const followTargetT = THREE.MathUtils.clamp(t + followDistance / pathLength, 0, 1)
    if (isSchooling) {
      offsetFromSchoolPoint(followTarget.current, currentPath, followTargetT, schoolOffset, now, organicNoise.current)
    } else if (isSoloAgent) {
      position = hasFollowPosition.current ? fish.position : position
      const currentForward = desiredDirection.current.lengthSq() > 0.0001
        ? desiredDirection.current
        : (hasVisualForward.current ? visualForward.current : tangent)
      if (currentForward.lengthSq() < 0.0001) currentForward.set(0, 0, -1)
      currentForward.normalize()

      const bodyLength = creatureBodyLength(creature, swim)
      const reachedDistance = Math.max(0.7, bodyLength * SOLO_AGENT_STEERING_REACHED_BODY_LENGTHS)
      const targetDistance = agentHasTarget.current ? position.distanceTo(agentTarget.current) : Infinity
      if (agentBehavior.current && targetDistance <= reachedDistance) {
        if (agentBehavior.current.type === 'sun-bask' && agentBehavior.current.stage === 'approach') {
          agentBehavior.current = {
            ...agentBehavior.current,
            stage: 'hold',
            stageStartedAt: now,
            holdUntil: now + MOLA_SUN_BASK_DURATION,
          }
          agentHasTarget.current = false
          agentBehaviorDistance.current = 0
          driftUntil.current = 0
          animationHoldUntil.current = now + MOLA_SUN_BASK_DURATION
          animationCooldown.current = now + MOLA_SUN_BASK_DURATION
          playAnimation(resolveMoveAnimation(model, agentBehavior.current.side < 0 ? 'sunBaskLeft' : 'sunBaskRight'))
        } else if (agentBehavior.current.type === 'sun-bask' && agentBehavior.current.stage === 'exit') {
          agentBehavior.current = null
          agentHasTarget.current = false
          agentBehaviorDistance.current = 0
          nextAgentRetargetAt.current = now + randomRange(agentRand.current, 0.15, 0.55)
        } else {
          agentBehavior.current = null
          agentHasTarget.current = false
          agentBehaviorDistance.current = 0
          nextAgentRetargetAt.current = now + randomRange(agentRand.current, 0.15, 0.55)
        }
      }

      if (!agentBehavior.current && now >= nextAgentRetargetAt.current) {
        const usesDepthResidency = isMolaCreature(creature)
        const forceSunBask = usesDepthResidency && sunBaskQueued.current
        const canSunBask = usesDepthResidency
          && (forceSunBask || (now - lastSunBaskAt.current >= MOLA_SUN_BASK_COOLDOWN
            && agentRand.current() < MOLA_SUN_BASK_CHANCE))
        const sunBaskDestination = canSunBask
          ? pickMolaSunBaskTarget(agentCandidateTarget, creature, swim, agentRand.current, position, currentForward)
          : null

        if (sunBaskDestination) {
          const side = agentRand.current() < 0.5 ? -1 : 1
          agentBehavior.current = { type: 'sun-bask', stage: 'approach', side, stageStartedAt: now, holdUntil: 0 }
          sunBaskQueued.current = false
          agentBehaviorStartedAt.current = now
          agentBehaviorDistance.current = 0
          lastSunBaskAt.current = now
          agentTarget.current.copy(sunBaskDestination)
          agentHasTarget.current = true
          agentDepthMode.current = 'front'
          agentDepthTargetsRemaining.current = 0
          agentPath.current = makeSoloAgentSteeringDebugPath(creature, swim, position, currentForward, agentTarget.current)
          agentPathProgress.current = 0
          agentPathLength.current = Math.max(0.001, agentPath.current.getLength())
          pathRef.current = agentPath.current
          pathLengthRef.current = agentPathLength.current
          setPath(agentPath.current)
        } else {
          if (usesDepthResidency && agentDepthTargetsRemaining.current <= 0) {
            const nextMode = agentDepthMode.current === 'deep' && agentRand.current() < MOLA_FRONT_EXCURSION_CHANCE ? 'front' : 'deep'
            agentDepthMode.current = nextMode
            agentDepthTargetsRemaining.current = Math.floor(randomRange(
              agentRand.current,
              nextMode === 'front' ? MOLA_FRONT_TARGET_COUNT[0] : MOLA_DEEP_TARGET_COUNT[0],
              (nextMode === 'front' ? MOLA_FRONT_TARGET_COUNT[1] : MOLA_DEEP_TARGET_COUNT[1]) + 1,
            ))
          }
          const destination = pickSoloAgentSteeringDestination(
            agentCandidateTarget,
            creature,
            swim,
            agentRand.current,
            position,
            currentForward,
            usesDepthResidency ? agentDepthMode.current : 'any',
          )
          if (destination) {
            if (usesDepthResidency) agentDepthTargetsRemaining.current = Math.max(0, agentDepthTargetsRemaining.current - 1)
            agentBehavior.current = { type: 'steer', completion: 'arrival' }
            agentBehaviorStartedAt.current = now
            agentBehaviorDistance.current = 0
            agentTarget.current.copy(destination)
            agentHasTarget.current = true
            agentPath.current = makeSoloAgentSteeringDebugPath(creature, swim, position, currentForward, agentTarget.current)
            agentPathProgress.current = 0
            agentPathLength.current = Math.max(0.001, agentPath.current.getLength())
            pathRef.current = agentPath.current
            pathLengthRef.current = agentPathLength.current
            setPath(agentPath.current)
          } else {
            agentBehavior.current = null
            agentHasTarget.current = false
            nextAgentRetargetAt.current = now + AGENT_BEHAVIOR_RETRY_COOLDOWN
          }
        }
      }

      if (agentBehavior.current?.type === 'sun-bask' && agentBehavior.current.stage === 'hold' && now >= agentBehavior.current.holdUntil) {
        pickMolaSunBaskExitTarget(agentBaskExitTarget, creature, swim, fish.position, currentForward)
        agentTarget.current.copy(agentBaskExitTarget)
        agentHasTarget.current = true
        agentBehavior.current = {
          ...agentBehavior.current,
          stage: 'exit',
          stageStartedAt: now,
        }
        agentBehaviorDistance.current = 0
        animationHoldUntil.current = now + MOLA_SUN_BASK_EXIT_ROLL_DURATION
        animationCooldown.current = now + MOLA_SUN_BASK_EXIT_ROLL_DURATION
        agentPath.current = makeSoloAgentSteeringDebugPath(creature, swim, position, currentForward, agentTarget.current)
        agentPathProgress.current = 0
        agentPathLength.current = Math.max(0.001, agentPath.current.getLength())
        pathRef.current = agentPath.current
        pathLengthRef.current = agentPathLength.current
        setPath(agentPath.current)
      }

      if (agentHasTarget.current) {
        followTarget.current.copy(fish.position).addScaledVector(currentForward, followDistance)
      }
    } else {
      currentPath.getPointAt(followTargetT, followTarget.current)
      followTarget.current.y += Math.sin(clock.getElapsedTime() * 1.7 + motion.bobPhase) * motion.bobAmount
    }

    if (!hasFollowPosition.current) {
      fish.position.copy(position)
      previousPosition.current.copy(fish.position)
      hasFollowPosition.current = true
    } else if (isSoloAgent) {
      previousPosition.current.copy(fish.position)
      tangent.copy(desiredDirection.current.lengthSq() > 0.0001 ? desiredDirection.current : (hasVisualForward.current ? visualForward.current : tangent))
      if (tangent.lengthSq() < 0.0001) tangent.set(0, 0, -1)
      tangent.normalize()

      const sunBaskHolding = agentBehavior.current?.type === 'sun-bask' && agentBehavior.current.stage === 'hold'
      if (sunBaskHolding) {
        desiredDirection.current.copy(tangent)
        agentMoveDirection.copy(tangent)
        const driftPhase = (now - agentBehavior.current.stageStartedAt) * 0.45 + motion.bobPhase
        fish.position.x += Math.sin(driftPhase) * MOLA_SUN_BASK_DRIFT_AMPLITUDE * delta
        fish.position.z += Math.cos(driftPhase * 0.73) * MOLA_SUN_BASK_DRIFT_AMPLITUDE * delta
        const bounds = swimBounds(creature.depthZone, swim, creature.size ?? 1)
        velocity.current = THREE.MathUtils.damp(velocity.current, 0, 1.4, delta)
        fish.position.y = THREE.MathUtils.damp(fish.position.y, molaSurfaceCenterYMax(creature, swim, bounds), 1.2, delta)
        clampToMolaSurfaceCeiling(fish.position, creature, swim, bounds, agentMoveDirection)
        agentBehaviorDistance.current = 0
      } else {
        if (agentHasTarget.current) {
          shapeSoloAgentSteeringDesired(agentMoveDirection, fish.position, agentTarget.current, tangent, creature, swim)
          rotateDirectionToward(tangent, agentMoveDirection, SOLO_AGENT_STEERING_MAX_TURN_RATE * delta)
        }

        desiredDirection.current.copy(tangent)
        agentMoveDirection.copy(tangent)
        const soloAgentSpeed = Number.isFinite(velocity.current) && velocity.current > 0 ? velocity.current : motion.idleSpeed
        const movementScale = soloAgentSpeed * organicMotion.speedScale * delta
        fish.position.addScaledVector(agentMoveDirection, movementScale)
        const bounds = swimBounds(creature.depthZone, swim, creature.size ?? 1)
        clampToMolaSurfaceCeiling(fish.position, creature, swim, bounds, agentMoveDirection)
        const runtimeRecoveryEnabled = !zoomActive && now >= runtimeRecoveryResumeAt.current
        if (runtimeRecoveryEnabled && clampToSoloAgentRuntimeEnvelope(fish.position, bounds, bodyLength, creature)) {
          agentRuntimeClamp.copy(fish.position)
          clampToSwimBounds(agentRuntimeClamp, bounds)
          agentMoveDirection.subVectors(agentRuntimeClamp, fish.position)
          if (agentMoveDirection.lengthSq() > 0.0001) desiredDirection.current.copy(agentMoveDirection.normalize())
          agentBehavior.current = null
          agentHasTarget.current = false
          agentBehaviorDistance.current = 0
          nextAgentRetargetAt.current = now
        }
        agentBehaviorDistance.current += movementScale
      }
      followTarget.current.copy(fish.position).addScaledVector(agentMoveDirection, followDistance)
      tangent.subVectors(fish.position, previousPosition.current)
      if (tangent.lengthSq() > 0.000001) tangent.normalize()
      else tangent.copy(agentMoveDirection)
    } else {
      previousPosition.current.copy(fish.position)
      schoolFollowDirection.subVectors(followTarget.current, fish.position)
      const targetDistance = schoolFollowDirection.length()
      if (targetDistance > 0.0001) {
        schoolFollowDirection.normalize()
        computeSoftAvoidance(rawAvoidance.current, fish, creature, swim, school)
        smoothedAvoidance.current.lerp(rawAvoidance.current, 1 - Math.exp(-delta * AVOIDANCE_SMOOTHING))
        targetDesiredDirection.copy(schoolFollowDirection).add(smoothedAvoidance.current)
        limitAvoidanceAngle(
          targetDesiredDirection,
          schoolFollowDirection,
          school?.count >= DENSE_SCHOOL_MIN_COUNT ? DENSE_SCHOOL_MAX_AVOIDANCE_ANGLE : DEFAULT_MAX_AVOIDANCE_ANGLE,
        )
        if (targetDesiredDirection.lengthSq() > 0.0001) targetDesiredDirection.normalize()
        desiredDirection.current.copy(targetDesiredDirection)

        const catchup = THREE.MathUtils.clamp(
          targetDistance / Math.max(0.001, followDistance) * organicMotion.catchupScale,
          0.50,
          1.82,
        )
        const movementScale = velocity.current * organicMotion.speedScale * catchup * delta
        agentMoveDirection.copy(desiredDirection.current)
        fish.position.addScaledVector(
          agentMoveDirection,
          Math.min(targetDistance, movementScale),
        )
        tangent.subVectors(fish.position, previousPosition.current)
        if (tangent.lengthSq() > 0.000001) {
          tangent.normalize()
        } else {
          tangent.copy(desiredDirection.current)
        }
      }
    }

    if (showAgentDebug) {
      const behavior = agentBehavior.current
      agentStatus.current = behavior?.type === 'sun-bask'
        ? `sun-bask ${behavior.stage}`
        : (behavior?.type ? `${behavior.type}${sunBaskQueued.current ? ' + queued sun-bask' : ''}` : (sunBaskQueued.current ? 'queued sun-bask' : 'choose-behavior'))
    }

    updateFishRegistry(fish, creature, swim, school)

    const fade = depthFadeFromScreenZ(fish.position.z)
    fish.traverse(child => {
      if (!child.isMesh || child.userData?.interactionProxy) return
      const materials = Array.isArray(child.material) ? child.material : [child.material]
      materials.filter(Boolean).forEach(material => {
        if (model) {
          material.transparent = false
          material.opacity = 1
          if ('envMapIntensity' in material) material.envMapIntensity = THREE.MathUtils.lerp(0.45, 0.95, fade)
          return
        }

        material.transparent = false
        material.opacity = 1
        if ('envMapIntensity' in material) material.envMapIntensity = THREE.MathUtils.lerp(0.25, 0.95, fade)
      })
    })

    const pitchLimit = maxVisualPitch(creature, swim)
    if (isSoloAgent && desiredDirection.current.lengthSq() > 0.0001) {
      horizontalForward.set(desiredDirection.current.x, 0, desiredDirection.current.z)
    } else {
      horizontalForward.set(tangent.x, 0, tangent.z)
    }
    if (horizontalForward.lengthSq() < 0.0001) horizontalForward.set(0, 0, -1)
    horizontalForward.normalize()

    if (showAgentDebug) {
      splineVisualTangent.subVectors(followTarget.current, fish.position)
      if (splineVisualTangent.lengthSq() < 0.0001) splineVisualTangent.copy(tangent)
      else splineVisualTangent.normalize()
    } else {
      currentPath.getTangentAt(t, splineVisualTangent).normalize()
    }
    setForwardWithPitch(rawVisualForward, horizontalForward, clampedVisualPitch(splineVisualTangent, pitchLimit))

    if (!hasVisualForward.current) {
      visualForward.current.copy(rawVisualForward)
      hasVisualForward.current = true
    } else {
      const visualAlignment = visualForward.current.dot(rawVisualForward)
      const visualTurnRate = isSoloAgent
        ? (visualAlignment < SOLO_AGENT_TANGENT_CATCHUP_ALIGNMENT
          ? SOLO_AGENT_TANGENT_CATCHUP_RATE
          : SOLO_AGENT_TANGENT_TURN_RATE)
        : turnRateForCreature(creature, swim)
      rotateDirectionToward(
        visualForward.current,
        rawVisualForward,
        visualTurnRate * delta,
      )
      enforceForwardPitchLimit(visualForward.current, pitchLimit)
    }
    pitchedForward.copy(visualForward.current)

    if (debug) {
      const showDirection = debugLayers?.direction ?? true
      const showName = debugLayers?.name ?? true
      const effectiveDebugVelocity = velocity.current * organicMotion.speedScale
      const effectiveDebugSpeedMeters = effectiveDebugVelocity * WORLD_UNIT_METERS
      const debugVectorLength = DEBUG_FORWARD_MIN_LENGTH + effectiveDebugVelocity * DEBUG_FORWARD_SPEED_SCALE
      const drift = currentSchoolDrift(schoolOffset, now)
      debugForwardStart.copy(fish.position).addScaledVector(pitchedForward, debugForwardOffset(creature, swim, model))
      debugForwardEnd.copy(debugForwardStart).addScaledVector(pitchedForward, debugVectorLength)
      updateDebugLine(forwardLineRef, debugForwardStart, debugForwardEnd)
      if (forwardLineRef.current) forwardLineRef.current.visible = showDirection && !showAgentDebug
      if (followTargetMarkerRef.current) {
        followTargetMarkerRef.current.position.copy(followTarget.current)
        followTargetMarkerRef.current.visible = showDirection && !showAgentDebug
      }
      if (speedLabelRef.current) {
        speedLabelRef.current.position.copy(debugForwardEnd).addScaledVector(up, 0.14)
        speedLabelRef.current.text = `${effectiveDebugSpeedMeters.toFixed(2)} m/s`
        speedLabelRef.current.lookAt(camera.position)
        speedLabelRef.current.visible = showDirection && !showAgentDebug
      }
      if (driftLabelRef.current) {
        labelPosition.current.copy(followTarget.current).addScaledVector(up, 0.10 + size * 0.04)
        driftLabelRef.current.position.copy(labelPosition.current)
        driftLabelRef.current.text = `drift ${drift >= 0 ? '+' : ''}${drift.toFixed(2)}`
        driftLabelRef.current.lookAt(camera.position)
        driftLabelRef.current.visible = showDirection && !showAgentDebug
      }
      if (agentLabelRef.current) {
        const bodyLength = creatureBodyLength(creature, swim)
        const status = agentStatus.current
        const commonName = species?.name ?? creature.species ?? 'Unknown'
        const scientificName = species?.scientificName ?? '—'
        labelPosition.current.copy(fish.position).addScaledVector(up, bodyLength * 0.46 + 0.28)
        agentLabelRef.current.position.copy(labelPosition.current)
        const currentAnimation = animationRef.current ?? '—'
        agentLabelRef.current.text = `id ${creature.id ?? '?'}\n${commonName}\n${scientificName}\nspeed ${effectiveDebugSpeedMeters.toFixed(2)} m/s\nbehavior ${status}\nanimation ${currentAnimation}`
        agentLabelRef.current.lookAt(camera.position)
        agentLabelRef.current.visible = showDirection && showAgentDebug
      }
      if (nameLabelRef.current) {
        nameLabelRef.current.position.copy(fish.position).addScaledVector(up, creatureBodyLength(creature, swim) * 0.16 + 0.045)
        nameLabelRef.current.lookAt(camera.position)
        nameLabelRef.current.visible = showName && !showAgentDebug
      }
    }

    if (model) {
      fish.up.copy(up)
      lookTarget.copy(fish.position).addScaledVector(pitchedForward, -1)
      fish.lookAt(lookTarget)
      if (agentBehavior.current?.type === 'sun-bask') {
        const behavior = agentBehavior.current
        const stageElapsed = Math.max(0, now - (behavior.stageStartedAt ?? agentBehaviorStartedAt.current))
        const rollAlpha = behavior.stage === 'approach'
          ? THREE.MathUtils.clamp(stageElapsed / MOLA_SUN_BASK_ROLL_DURATION, 0, 1)
          : (behavior.stage === 'exit'
            ? 1 - THREE.MathUtils.clamp(stageElapsed / MOLA_SUN_BASK_EXIT_ROLL_DURATION, 0, 1)
            : 1)
        bankQuaternion.setFromAxisAngle(pitchedForward, (behavior.side ?? 1) * Math.PI * 0.5 * rollAlpha)
        fish.quaternion.premultiply(bankQuaternion)
      }
    } else {
      lookTarget.copy(fish.position).add(pitchedForward)
      fish.lookAt(lookTarget)
      fish.rotateY(Math.PI / 2)
    }

    const pitch = THREE.MathUtils.clamp(pitchedForward.y * 0.55, -0.22, 0.22)
    if (!model) fish.rotateZ(pitch)
    fish.up.lerp(up, 0.18)

    if (canInstanceSardine && typeof window !== 'undefined') {
      const stats = window.__WO_SARDINE_DEBUG ?? { frames: 0, samples: [] }
      stats.frames += 1
      if (stats.samples.length < 12 || selected) {
        const projected = fish.position.clone().project(camera)
        const meshDetails = []
        if (selected) {
          fish.traverse(child => {
            if (!child.isMesh) return
            const material = Array.isArray(child.material) ? child.material[0] : child.material
            meshDetails.push({
              name: child.name,
              visible: child.visible,
              proxy: Boolean(child.userData?.interactionProxy),
              opacity: material?.opacity,
              transparent: material?.transparent,
              geometry: child.geometry?.attributes?.position?.count,
              scale: [Number(child.scale.x.toFixed(3)), Number(child.scale.y.toFixed(3)), Number(child.scale.z.toFixed(3))],
            })
          })
        }
        const sample = {
          id: creature.id,
          selected,
          debug,
          instancedSardineLod,
          renderModel: Boolean(renderModel),
          position: [Number(fish.position.x.toFixed(2)), Number(fish.position.y.toFixed(2)), Number(fish.position.z.toFixed(2))],
          camera: [Number(camera.position.x.toFixed(2)), Number(camera.position.y.toFixed(2)), Number(camera.position.z.toFixed(2))],
          ndc: [Number(projected.x.toFixed(2)), Number(projected.y.toFixed(2)), Number(projected.z.toFixed(2))],
          distanceToCamera: Number(camera.position.distanceTo(fish.position).toFixed(2)),
          children: fish.children.length,
          meshDetails,
        }
        const index = stats.samples.findIndex(item => String(item.id) === String(creature.id))
        if (index >= 0) stats.samples[index] = sample
        else stats.samples.push(sample)
      }
      window.__WO_SARDINE_DEBUG = stats
    }

    const forceDetailedForDebug = debug && !debugLodView
    if (canInstanceSardine && !selected && !forceDetailedForDebug) {
      const distanceToCamera = camera.position.distanceTo(fish.position)
      const lod2Distance = zoomActive ? SARDINE_INSTANCE_DISTANCE : SARDINE_TANK_INSTANCE_DISTANCE
      const lod1Distance = zoomActive ? SARDINE_LOD1_DISTANCE : SARDINE_TANK_LOD1_DISTANCE
      const nextInstancedLod = (() => {
        if (instancedSardineLod === 'lod2') {
          if (distanceToCamera > lod2Distance - SARDINE_INSTANCE_HYSTERESIS) return 'lod2'
        } else if (distanceToCamera > lod2Distance + SARDINE_INSTANCE_HYSTERESIS) {
          return 'lod2'
        }

        if (instancedSardineLod === 'lod1') {
          if (distanceToCamera > lod1Distance - SARDINE_INSTANCE_HYSTERESIS) return 'lod1'
        } else if (distanceToCamera > lod1Distance + SARDINE_INSTANCE_HYSTERESIS) {
          return 'lod1'
        }

        return null
      })()
      cullProjection.copy(fish.position).project(camera)
      const offscreenCulled = (
        cullProjection.z < -1 ||
        cullProjection.z > 1 ||
        Math.abs(cullProjection.x) > SARDINE_VIEW_CULL_MARGIN_NDC ||
        Math.abs(cullProjection.y) > SARDINE_VIEW_CULL_MARGIN_NDC
      )
      if (modelRootRef.current) modelRootRef.current.visible = !offscreenCulled
      updateSardineFrustumEntry(creature.id, {
        candidate: true,
        culled: offscreenCulled,
      })
      updateSardineLod0Entry(creature.id, {
        candidate: !nextInstancedLod,
        drawn: !nextInstancedLod && !offscreenCulled,
      })
      if (nextInstancedLod !== instancedSardineLod) setInstancedSardineLod(nextInstancedLod)
      if (nextInstancedLod && !offscreenCulled) {
        instancedEntry.position.copy(fish.position)
        instancedEntry.quaternion.copy(fish.quaternion).normalize()
        instancedEntry.scale = size
        instancedEntry.matrix.compose(
          fish.position,
          instancedEntry.quaternion,
          tempScale.set(size, size, size),
        )
        if (nextInstancedLod === 'lod1') {
          updateSardineLod1Instance(creature.id, instancedEntry)
          removeSardineInstance(creature.id)
        } else {
          updateSardineInstance(creature.id, instancedEntry)
          removeSardineLod1Instance(creature.id)
        }
      } else {
        removeSardineLod1Instance(creature.id)
        removeSardineInstance(creature.id)
      }
    } else {
      if (modelRootRef.current) modelRootRef.current.visible = true
      removeSardineLod0Entry(creature.id)
      removeSardineFrustumEntry(creature.id)
      if (instancedSardineLod) setInstancedSardineLod(null)
      removeSardineLod1Instance(creature.id)
      removeSardineInstance(creature.id)
    }

    if (model) {
      const animationForward = isSoloAgent && agentPath.current && agentPathTangent.lengthSq() > 0
        ? agentPathTangent
        : pitchedForward
      let turn = 0
      if (previousTangent.current.lengthSq() > 0) {
        turn = previousTangent.current.z * animationForward.x - previousTangent.current.x * animationForward.z
      }
      if (previousTangent.current.lengthSq() > 0 && now > animationCooldown.current && now > animationHoldUntil.current) {
        if (turn > motion.turnTriggerThreshold) {
          const turnDuration = motion.turnActionDuration
          playAnimation(resolveMoveAnimation(model, 'turnLeft'))
          playSwimSfx('turn', THREE.MathUtils.clamp(Math.abs(turn) * 34, 0.34, 0.88), now)
          actionSpeedUntil.current = now + turnDuration
          actionSpeedTarget.current = motion.snapSpeed
          animationHoldUntil.current = now + turnDuration
          animationCooldown.current = now + Math.max(0.7, turnDuration * 0.72)
          driftUntil.current = 0
        } else if (turn < -motion.turnTriggerThreshold) {
          const turnDuration = motion.turnActionDuration
          playAnimation(resolveMoveAnimation(model, 'turnRight'))
          playSwimSfx('turn', THREE.MathUtils.clamp(Math.abs(turn) * 34, 0.34, 0.88), now)
          actionSpeedUntil.current = now + turnDuration
          actionSpeedTarget.current = motion.snapSpeed
          animationHoldUntil.current = now + turnDuration
          animationCooldown.current = now + Math.max(0.7, turnDuration * 0.72)
          driftUntil.current = 0
        } else if (Math.abs(turn) < BURST_STRAIGHT_THRESHOLD && now > nextBurstAt.current) {
          const burstDuration = motion.burstActionDuration
          playAnimation(resolveMoveAnimation(model, 'burst'))
          playSwimSfx('burst', THREE.MathUtils.clamp(motion.burstSpeed / Math.max(0.001, motion.idleSpeed) * 0.18, 0.42, 1), now)
          actionSpeedUntil.current = now + burstDuration
          actionSpeedTarget.current = motion.burstSpeed
          animationHoldUntil.current = now + burstDuration
          animationCooldown.current = now + Math.max(1.0, burstDuration * 0.65)
          nextBurstAt.current = now + motion.burstInterval
          driftUntil.current = 0
        }
      } else if (now > animationHoldUntil.current) {
        if (hasDriftMove) {
          if (now >= nextDriftAt.current) {
            driftUntil.current = now + motion.driftDuration
            nextDriftAt.current = driftUntil.current + motion.driftInterval
          }
          playAnimation(now < driftUntil.current ? driftMove : resolveMoveAnimation(model, 'cruise'))
        } else {
          playAnimation(resolveMoveAnimation(model, 'cruise'))
        }
      }

      const activeAnimation = animationRef.current
      if (activeAnimation === resolveMoveAnimation(model, 'burst')) {
        animationSpeedScaleRef.current = THREE.MathUtils.clamp(velocity.current / Math.max(0.001, motion.burstSpeed), 0.72, 1.18)
      } else if (activeAnimation === resolveMoveAnimation(model, 'cruise')) {
        animationSpeedScaleRef.current = THREE.MathUtils.clamp(velocity.current / Math.max(0.001, motion.idleSpeed), 0.62, 1.32)
      } else if (activeAnimation === driftMove) {
        animationSpeedScaleRef.current = THREE.MathUtils.clamp(velocity.current / Math.max(0.001, motion.idleSpeed), 0.28, 0.62)
      } else {
        animationSpeedScaleRef.current = 1
      }

      const bank = THREE.MathUtils.clamp(turn * 4, -MAX_MODEL_BANK, MAX_MODEL_BANK)
      bankQuaternion.setFromAxisAngle(pitchedForward, -bank)
      fish.quaternion.premultiply(bankQuaternion)

      previousTangent.current.copy(animationForward)
    }
  })

  const focusScale = 1
  const bodyLength = creatureBodyLength(creature, swim)
  const debugTargetScale = THREE.MathUtils.clamp(Math.sqrt(size) * 0.72, 0.62, 1.7)
  const agentDebugLabelScale = THREE.MathUtils.clamp(bodyLength * 0.024, DEBUG_AGENT_LABEL_SCALE, 0.22)
  const showSelectedOutline = selected && debug && !hideSelectionSilhouette
  const renderModel = model && !instancedSardineLod
  const renderMolaPlaceholder = !model && species?.placeholder?.type === 'mola-mola'
  const proxyDimensions = interactionProxyDimensions(species, swim)
  const lodDebugColor = debugLodView && renderModel && canInstanceSardine ? LOD0_DEBUG_COLOR : null
  const rimColor = showSelectedOutline ? SELECTED_OUTLINE_COLOR : (debug && isSchoolLeader ? LEADER_OUTLINE_COLOR : null)
  const rimIntensity = showSelectedOutline ? SELECTED_RIM_INTENSITY : LEADER_RIM_INTENSITY
  const fresnelRim = useMemo(() => (
    rimColor ? { color: rimColor, intensity: rimIntensity, power: RIM_POWER } : null
  ), [rimColor, rimIntensity])

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
          {(debugLayers?.direction ?? true) && (!isSchooling || isSchoolLeader || showAgentDebug) && (
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
            0.00 m/s
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
          {showAgentDebug && (
            <Text
              ref={agentLabelRef}
              fontSize={agentDebugLabelScale}
              font={DEBUG_LABEL_FONT}
              color="#9af7ff"
              anchorX="center"
              anchorY="middle"
              depthTest={false}
              renderOrder={20}
              raycast={() => null}
            >
              agent cruise-wander
            </Text>
          )}
          <Text
            ref={nameLabelRef}
            fontSize={DEBUG_NAME_LABEL_SCALE}
            font={DEBUG_LABEL_FONT}
            color="#d6f7ff"
            anchorX="center"
            anchorY="middle"
            depthTest={false}
            raycast={() => null}
          >
            {`${creature.id ?? '?'} · ${creature.species ?? 'unknown'}${species?.scientificName ? `\n${species.scientificName}` : ''}`}
          </Text>
        </>
      )}
      <group
        ref={ref}
        scale={[size * focusScale, size * focusScale, size * focusScale]}
        onPointerUp={handleSelect}
        onClick={handleSelect}
      >
        <mesh userData={{ interactionProxy: true }}>
          <boxGeometry args={proxyDimensions} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} color="#000000" />
        </mesh>
        <group ref={modelRootRef}>
          {renderModel ? (
            <FishModel
              key={`${model.path}:${lodDebugColor ?? 'normal'}:${rimColor ?? 'none'}`}
              model={model}
              animation={animation}
              animationVariation={animationVariation}
              animationSpeedScaleRef={animationSpeedScaleRef}
              rim={fresnelRim}
              lodDebugColor={lodDebugColor}
            />
          ) : renderMolaPlaceholder ? (
            <MolaMolaPlaceholder
              species={species}
              swim={swim}
              rimColor={rimColor}
              rimIntensity={rimIntensity}
            />
          ) : !model ? (
            <>
              {rimColor && (
                <mesh scale={1.02} raycast={() => null}>
                  <boxGeometry args={[0.7, 0.28, 0.18]} />
                  <meshStandardMaterial color="#7ab8c0" emissive={rimColor} emissiveIntensity={rimIntensity} roughness={0.42} metalness={0.02} />
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
          ) : null}
        </group>
      </group>
    </group>
  )
}

useGLTF.preload('/models/fish/sardine/sardine.glb')
useGLTF.preload('/models/fish/mola-alexandrini/mola-alexandrini.glb')
