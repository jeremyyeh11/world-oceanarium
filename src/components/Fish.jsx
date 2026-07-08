import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { Billboard, Text, useAnimations, useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { clone } from 'three/examples/jsm/utils/SkeletonUtils.js'
import { WORLD_UNIT_METERS } from '../data/species'
import { triggerFishSwimSound } from '../hooks/useOceanAudio'
import { removeSardineFrustumEntry, removeSardineInstance, removeSardineLod1Instance, removeSardineLod0Entry, SARDINE_INSTANCE_DISTANCE, SARDINE_LOD1_DISTANCE, SARDINE_TANK_INSTANCE_DISTANCE, SARDINE_TANK_LOD1_DISTANCE, updateSardineFrustumEntry, updateSardineInstance, updateSardineLod1Instance, updateSardineLod0Entry } from './sardineInstanceRegistry'
import { SURFACE_PLANE_Y } from './WaterSurface'
import { creatureBodyLengthWU, isMolaCreature, resolveSpecies } from '../utils/speciesLookup'
import { creatureRepulsesOthers, lerpRepulserDrift, resolveRepulserDriftVector } from '../utils/creatureMoments'
import { hashString } from '../utils/hash'
import { SARDINE_MATERIAL_ROUGHNESS } from '../utils/sardineMaterials'
import { SARDINE_DEBUG_GLOBAL } from '../utils/debugIdentifiers'

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
const SWIM_BOUNDARY_Z_OFFSET_FROM_CAMERA = -15
const TANK_CAMERA_Z = 12
const TANK_CAMERA_FOV_DEG = 60
const TANK_CAMERA_ASPECT = 16 / 9
const SCREEN_X_SAFE_FRACTION = 0.78
// Widened ~1.5x (0.9 -> 1.35) so the left/right swim volume extends past the visible
// frame. Fish deliberately swim off-screen to the sides, which hides hard-reset
// u-turns at the boundary and declutters the tank when it is crowded.
const GLOBAL_X_DESTINATION_RANGE_SCALE = 1.35

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
const PATH_VERTICAL_TRAVERSAL_BIAS = 0.9
const PATH_VERTICAL_TRAVERSAL_JITTER = 0.22
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
const GLOBAL_ANIMATION_TIME_SCALE = 1
const SELECTED_OUTLINE_COLOR = '#57c7e8'
const LEADER_OUTLINE_COLOR = '#80ff72'
const LOD0_DEBUG_COLOR = '#00ff28'
const SELECTED_RIM_INTENSITY = 1.65
const LEADER_RIM_INTENSITY = 0.8
const RIM_POWER = 3.1
const FISH_LIGHT_MASK_ENABLED = true
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
const DEBUG_NAME_LABEL_SCALE = 0.045
const DEBUG_AGENT_LABEL_SCALE = 0.045
// Multiplies camera distance to keep world-space debug labels a near-constant on-screen
// size (see nameLabel update). Tuned so a mid-tank creature reads at ~1x.
const DEBUG_LABEL_DISTANCE_SCALE = 0.09
const DEBUG_BOID_VECTOR_SCALE = 5.0
const SPLINE_MOVEMENT_ENABLED = false
// Schools travel toward a real destination (the shared school path's far exit, via its
// intermediate waypoints) instead of hovering in place — boids only adjust the local
// formation on top. Position stays boid-driven, so this is a soft destination, not the
// old rigid path-lock (which is still gated behind SPLINE_MOVEMENT_ENABLED).
const SCHOOL_TRAVEL_ENABLED = true
// Turn radius as a multiple of body length. Heading rotates no faster than a fish
// arcing forward on this radius (angular rate = speed / radius), so creatures swim
// through their turns instead of pivoting or strafing. >=1 arcs; <1 would allow a
// future spin-in-place creature.
const DEFAULT_TURN_RADIUS_BODY_LENGTHS = 2.5
// Ceiling on a single simulation step (before the debug speed multiplier). On a smooth
// display rawDelta is ~0.016s so this never engages; it only caps genuine hitches / very
// low frame rates, where an unbounded step would let a fast swimmer leap clear across its
// boundary envelope in one frame (tunnelling) and get snapped back. Capping the step makes
// slow frames dilate time slightly instead of teleporting — invisible in an ambient tank.
const MAX_SIMULATION_RAW_DELTA = 0.05
const DEBUG_LABEL_FONT = '/fonts/DejaVuSansMono.ttf'
const SCHOOL_PHASE_WINDOW = 0.07
const SCHOOL_PATH_CONTINUATION_BODY_LENGTHS = 2.35
const SCHOOL_PATH_MIN_FIRST_TURN_BODY_LENGTHS = 1.55
const VISUAL_PITCH_RESPONSE = 4.8
// Fade the swim pitch toward level as forward speed drops below a fraction of the fish's own
// cruise speed. Without this, a fish coasting to a near-stop (a drift beat, or settling onto a
// reached follow-target) has its tiny horizontal travel swamped by the vertical bob, and
// atan2 snaps the nose to the full pitch limit — it looks parked and staring up and down.
// Referencing each fish's own idle speed keeps genuine dives (mako, mola) pitching normally,
// since those happen at speed.
const PITCH_FADE_SPEED_FRACTION_LO = 0.1
const PITCH_FADE_SPEED_FRACTION_HI = 0.45
const SUN_BASK_ANIMATION_NAMES = new Set(['sun_bask_l', 'sun_bask_r'])
const MOLA_SUN_BASK_ANIMATION_FADE_DURATION = 3.5
const MOLA_SUN_BASK_ANIMATION_ENTRY_FADE_DURATION = 0.55
const MOLA_SUN_BASK_ANIMATION_SPEED_SCALE = 0.5
const SCHOOL_FOLLOW_LOOKAHEAD_BODY_LENGTHS = 2.5
const SOLO_FOLLOW_LOOKAHEAD_BODY_LENGTHS = 1.5
const SOLO_FOLLOW_LOOKAHEAD_MIN = 0.35
// A school travels toward a shared roaming goal (pure boids alone just mill in place). The
// leader picks a new (forward-biased) goal once the group is within SCHOOL_GOAL_REACHED of it.
const SCHOOL_GOAL_REACHED_BODY_LENGTHS = 3.0
const SCHOOL_GOAL_REACHED_MIN = 2.0
// The shared migration direction is low-pass filtered so goal re-picks (which nudge the goal
// laterally) can't accumulate into a constant slow turn — the school holds straight glides and
// only swings when the goal genuinely shifts. Time constant in 1/seconds. Kept moderate: too low
// lags the direction behind actual travel and the school's headings spread (coherence drops).
const SCHOOL_MIGRATION_SMOOTH = 1.6
// School steering blends a shared migration urge (travel along goal - centroid) with a pull
// toward this member's formation slot (its designed place in the travel frame). The slot pull
// gives the school a stable 3D shape so it holds width instead of collapsing to single-file —
// a plain "seek the goal point" funnels every fish into a conga line. Boid separation/threat
// then ride on top for anti-overlap and predator avoidance.
const SCHOOL_MIGRATION_WEIGHT = 0.6
const SCHOOL_FORMATION_WEIGHT = 0.65
const PATH_EDGE_PADDING = 0.75
const PATH_VERTICAL_PADDING = 0.16
const FISH_SEPARATION_PADDING = 0.18
const DENSE_SCHOOL_MIN_COUNT = 12
const DENSE_SCHOOL_RADIUS_SCALE = 0.58
const DENSE_SCHOOL_PADDING_SCALE = 0.2
const BOID_STEERING_SMOOTHING = 3.4
const BOID_NEIGHBOR_CAP = 12
const BOID_PERCEPTION_MIN = 0.95
const BOID_PERCEPTION_BODY_LENGTHS = 3.15
const BOID_PERCEPTION_MAX = 4.2
const BOID_SEPARATION_WEIGHT = 0.34
const BOID_ALIGNMENT_WEIGHT = 0.18
const BOID_COHESION_WEIGHT = 0.12
const BOID_MAX_WEIGHT = 0.34
const BOID_SAME_GROUP_SOCIAL_WEIGHT = 1
const BOID_SAME_SPECIES_SOCIAL_WEIGHT = 0.28
// A fish commits to a boid steering decision and holds it for roughly one
// animation cycle, then re-decides. This stops the per-frame re-evaluation that
// made fish jitter and flip direction several times a second.
const BOID_DECISION_MIN_INTERVAL = 1.0
const BOID_DECISION_MAX_INTERVAL = 2.6
const BOID_DECISION_JITTER = 0.3
// Species reaction hierarchy: a neighbor's `menace` and the observer's `wariness`
// combine into a threat-avoidance push sensed at a wider radius than collision
// separation. Prey flee the mako; nobody minds the mola.
const BOID_THREAT_PERCEPTION_SCALE = 1.9
const BOID_THREAT_WEIGHT = 0.62
const BOID_DEFAULT_MENACE = 0.25
const BOID_DEFAULT_WARINESS = 0.35
const BOID_MAX_DEBUG_NEIGHBORS = 12
const REPULSER_DRIFT_INNER_RADIUS = 5.8
const REPULSER_DRIFT_OUTER_RADIUS = 17
const REPULSER_DRIFT_MAX = 2.2
const REPULSER_DRIFT_RESPONSE = 1.65
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
const SOLO_AGENT_STEERING_TURN_RATE_MIN = 6
const SOLO_AGENT_STEERING_TURN_RATE_MAX = 52
const SOLO_AGENT_TARGET_VERTICAL_BODY_LENGTHS_DEFAULT = 0.32
const SOLO_AGENT_TARGET_VERTICAL_BODY_LENGTHS_MIN = 0.05
const SOLO_AGENT_TARGET_VERTICAL_BODY_LENGTHS_MAX = 1.4
const SOLO_AGENT_STEERING_REACHED_BODY_LENGTHS = 0.95
const MOLA_STEERING_REACHED_BODY_LENGTHS = 0.32
const MOLA_STEERING_REACHED_MAX = 3.0
const SOLO_AGENT_STEERING_DEBUG_STEPS = 72
const SOLO_AGENT_STEERING_DEBUG_STEP_BODY_LENGTHS = 0.18
const SOLO_AGENT_RUNTIME_OVERSHOOT_BODY_LENGTHS = 0.55
const SOLO_AGENT_RUNTIME_OVERSHOOT_MIN = 2.0
const SOLO_AGENT_RUNTIME_OVERSHOOT_MAX = 5.5
// Non-mola solo agents (the mako) get a hard surface ceiling this far below the water plane, so
// their tall runtime-overshoot envelope can't carry them up through the surface. Tuned to keep
// the mako's body visibly submerged while still leaving a little headroom above its swim bounds.
const SOLO_AGENT_SURFACE_CLEARANCE = 2.0
// Predictive boundary avoidance for fast solo swimmers (the mako). Its open-water turn
// radius is far wider than the tank, so at speed it reaches a wall before its gentle arc
// can redirect, overshoots the runtime envelope, and gets snapped back inward (reads as
// strafing backward). To prevent that, when the fish is heading at a wall within a
// look-ahead distance, its allowed per-frame turn tightens toward BOUNDARY_MIN_TURN_RADIUS
// so it can carve away in time. The look-ahead is a fixed multiple of that minimum radius'
// quarter-arc run-up, and both scale with body length so the effect is size-agnostic. Open
// water is untouched, so the mako keeps its wide banking arcs everywhere but the edges.
const SOLO_AGENT_BOUNDARY_MIN_TURN_BODY_LENGTHS = 0.7
const SOLO_AGENT_BOUNDARY_LOOKAHEAD_ARC_SCALE = 1.35
const MOLA_RUNTIME_OVERSHOOT_XZ_BODY_LENGTHS = 1.75
const MOLA_RUNTIME_OVERSHOOT_XZ_MIN = 9.0
const MOLA_RUNTIME_OVERSHOOT_XZ_MAX = 18.0
const MOLA_RUNTIME_OVERSHOOT_POSITIVE_Z_BODY_LENGTHS = 3.0
const MOLA_RUNTIME_OVERSHOOT_POSITIVE_Z_MIN = 18.0
const MOLA_RUNTIME_OVERSHOOT_POSITIVE_Z_MAX = 30.0
const MOLA_RUNTIME_RECOVERY_FADE_OUT_DURATION = 8
const MOLA_RUNTIME_RECOVERY_FADE_IN_DURATION = 3.5
const MOLA_DEEP_ZONE_Z_MAX = -10
const MOLA_FRONT_EXCURSION_CHANCE = 0.24
const MOLA_FRONT_TARGET_COUNT = [1, 2]
const MOLA_DEEP_TARGET_COUNT = [4, 7]
const MOLA_SUN_BASK_CHANCE = 0.16
const MOLA_SUN_BASK_COOLDOWN = 75
const MOLA_SUN_BASK_DURATION = 60
const MOLA_SUN_BASK_APPROACH_Z = [-6, 0]
const MOLA_SUN_BASK_EXIT_BODY_LENGTHS = 3.0
const MOLA_SUN_BASK_EXIT_ROLL_DURATION = 10
const MOLA_SUN_BASK_REACHED_BODY_LENGTHS = 0.08
const MOLA_SUN_BASK_REACHED_MAX = 0.75
const MOLA_SUN_BASK_APPROACH_MIN_SPEED_SCALE = 0.22
const MOLA_SUN_BASK_APPROACH_DECEL_START = 0.45
const MOLA_SUN_BASK_ROLL_PROGRESS_START = 0.62
const MOLA_SUN_BASK_APPROACH_MAX_ROLL_ALPHA = 0.92
const MOLA_SUN_BASK_HOLD_ROLL_COMPLETE_DURATION = 5
const MOLA_SUN_BASK_HOLD_COAST_DURATION = 1.2
const MOLA_SUN_BASK_EXIT_SPEED_RAMP_DURATION = 2.5
const MOLA_SUN_BASK_DRIFT_ROLL_AMPLITUDE = THREE.MathUtils.degToRad(4)
const MOLA_SUN_BASK_DRIFT_YAW_AMPLITUDE = THREE.MathUtils.degToRad(3)
const MOLA_SUN_BASK_DRIFT_INTRO_DURATION = 4
const MOLA_SUN_BASK_LOOK_AT_ENTER_BLEND_DURATION = 1.5
const MOLA_SUN_BASK_LOOK_AT_EXIT_BLEND_DURATION = 6
const MOLA_BEHAVIOR_LOOK_AT_RESPONSE = 2.2
const MOLA_BEHAVIOR_LOOK_AT_TRANSITION_RESPONSE = 1.15
const MOLA_BEHAVIOR_LOOK_AT_TRANSITION_DURATION = 1.5
const MOLA_SUN_BASK_DRIFT_XZ_AMPLITUDE = 0.09
const MOLA_SUN_BASK_DRIFT_Y_AMPLITUDE = 0.035
const MOLA_SURFACE_CENTER_CLEARANCE_BODY_LENGTHS = 0.50
const MOLA_SURFACE_CENTER_CLEARANCE_MIN = 3.6
const MOLA_SURFACE_CENTER_CLEARANCE_MAX = 4.85
const MOLA_SUN_BASK_SURFACE_CENTER_CLEARANCE_BODY_LENGTHS = 0.12
const MOLA_SUN_BASK_SURFACE_CENTER_CLEARANCE_MIN = 0.85
const MOLA_SUN_BASK_SURFACE_CENTER_CLEARANCE_MAX = 1.25
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
const frameMove = new THREE.Vector3()
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
const curveDeformAxisX = new THREE.Vector3(1, 0, 0)
const curveDeformAxisY = new THREE.Vector3(0, 1, 0)
const curveDeformAxisZ = new THREE.Vector3(0, 0, 1)
const agentBoundaryInward = new THREE.Vector3()
const agentBoundaryGlideMid = new THREE.Vector3()
const agentBoundaryGlideEnd = new THREE.Vector3()
const agentRuntimeClamp = new THREE.Vector3()
const agentRuntimeEnvelopeProbe = new THREE.Vector3()
const agentBaskExitTarget = new THREE.Vector3()
const targetLookQuaternion = new THREE.Quaternion()
const bankQuaternion = new THREE.Quaternion()
const tempScale = new THREE.Vector3()
const cullProjection = new THREE.Vector3()
const separationDelta = new THREE.Vector3()
const boidDelta = new THREE.Vector3()
const boidAlignment = new THREE.Vector3()
const boidCenter = new THREE.Vector3()
const boidCohesion = new THREE.Vector3()
const boidThreat = new THREE.Vector3()
const debugBoidVectorEnd = new THREE.Vector3()
const debugNeighborStart = new THREE.Vector3()
const debugNeighborEnd = new THREE.Vector3()
const debugNeighborHeadingEnd = new THREE.Vector3()
const BOID_RELATION_COLORS = {
  follow: new THREE.Color('#80ff72'),
  avoid: new THREE.Color('#ff5a36'),
  neutral: new THREE.Color('#9aa7b2'),
}
// Reused candidate buffer for nearest-N neighbor selection so a decision tick does
// not allocate. Entries are { id, other, distanceSq } and are re-sorted each tick.
const boidNeighborScratch = []
const SCHOOL_STATES = new Map()
const FISH_REGISTRY = new Map()

function getSchoolState(school, creature, swim) {
  const key = school.id
  let state = SCHOOL_STATES.get(key)
  if (!state) {
    const seed = hashString(key)
    const rand = mulberry32(seed)
    const bounds = swimBounds(creature.depthZone, swim, creature.size ?? 1)
    // Seeded spawn centre and first roaming goal. The whole school shares these; members
    // spread around them via their formation offset and boid separation/cohesion.
    const centerZ = randomRange(rand, bounds.zMin, bounds.zMax)
    const center = new THREE.Vector3(
      randomXInSwimBoundsAtZ(rand, bounds, centerZ),
      randomRange(rand, bounds.yMin, bounds.yMax),
      centerZ,
    )
    const goal = pickSoloAgentTarget(new THREE.Vector3(), creature, swim, rand, center)
    state = {
      seed,
      rand,
      center,
      goal,
      // Live school centroid and the shared migration direction (goal - centroid), both
      // maintained by the leader each frame. Members migrate along the shared direction so
      // they travel parallel and fan into a cloud instead of funnelling toward one point.
      centroid: center.clone(),
      migrationDir: new THREE.Vector3(),
    }
    SCHOOL_STATES.set(key, state)
  }
  return state
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
    schoolMaxAvoidanceAngleDegrees: speciesSwim.schoolMaxAvoidanceAngleDegrees,
    schoolDirectionResponse: speciesSwim.schoolDirectionResponse,
    soloSteeringTurnRateDegrees: speciesSwim.soloSteeringTurnRateDegrees,
    soloTargetVerticalBodyLengths: speciesSwim.soloTargetVerticalBodyLengths,
  }
}

function resolveModel(creature, variantKey = null) {
  const species = resolveSpecies(creature)
  const baseModel = species?.model ?? null
  const variant = variantKey ? baseModel?.sexVariants?.[variantKey] : null
  if (!variant) return baseModel
  return {
    ...baseModel,
    ...variant,
    sexVariant: variantKey,
    sexVariants: baseModel.sexVariants,
  }
}

function creatureBodyLength(creature, swim) {
  return creatureBodyLengthWU(creature, swim.bodyLengthWU)
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
  // Per-species override for surface cruisers that should glide near-level: without it a
  // faster fish traverses the vertical waviness of its path quickly enough to keep pitching
  // toward the generic limit, which — with the follow-cam holding it centred — reads as the
  // fish hovering in place nosing up and down.
  if (Number.isFinite(swim.maxVisualPitchDegrees)) return THREE.MathUtils.degToRad(swim.maxVisualPitchDegrees)
  return THREE.MathUtils.lerp(MAX_MODEL_PITCH, MIN_LARGE_CREATURE_PITCH, largeCreatureFactor(creature, swim))
}

function turnRateForCreature(creature, swim) {
  return THREE.MathUtils.lerp(SMALL_CREATURE_TURN_RATE, LARGE_CREATURE_TURN_RATE, largeCreatureFactor(creature, swim))
}

// Maximum heading change this frame if the creature turns on an arc of radius
// (turnRadiusBodyLengths * bodyLength) while moving forward at `speed` (WU/s).
// ω = v / r, so faster fish and tighter radii turn quicker, but never pivot.
function maxTurnRadiansForSpeed(swim, bodyLength, speed, delta) {
  const bodyLengths = Math.max(0.05, swim.turnRadiusBodyLengths ?? DEFAULT_TURN_RADIUS_BODY_LENGTHS)
  const radius = Math.max(0.05, bodyLengths * bodyLength)
  return (Math.max(0, speed) / radius) * Math.max(0, delta)
}

function soloAgentSteeringTurnRate(swim) {
  if (!Number.isFinite(swim.soloSteeringTurnRateDegrees)) return SOLO_AGENT_STEERING_MAX_TURN_RATE
  return THREE.MathUtils.degToRad(THREE.MathUtils.clamp(
    swim.soloSteeringTurnRateDegrees,
    SOLO_AGENT_STEERING_TURN_RATE_MIN,
    SOLO_AGENT_STEERING_TURN_RATE_MAX,
  ))
}

function soloAgentTargetVerticalRange(from, bounds, targetYMax, bodyLength, swim) {
  if (!from) return [bounds.yMin, targetYMax]
  const bodyLengths = THREE.MathUtils.clamp(
    Number.isFinite(swim.soloTargetVerticalBodyLengths)
      ? swim.soloTargetVerticalBodyLengths
      : SOLO_AGENT_TARGET_VERTICAL_BODY_LENGTHS_DEFAULT,
    SOLO_AGENT_TARGET_VERTICAL_BODY_LENGTHS_MIN,
    SOLO_AGENT_TARGET_VERTICAL_BODY_LENGTHS_MAX,
  )
  const verticalStep = Math.max(0.18, bodyLength * bodyLengths)
  const yMin = Math.max(bounds.yMin, from.y - verticalStep)
  const yMax = Math.min(targetYMax, from.y + verticalStep)
  if (yMax < yMin) return [bounds.yMin, targetYMax]
  return [yMin, yMax]
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
  if (Number.isFinite(model?.debugForwardOffsetWU)) return model.debugForwardOffsetWU
  const bodyLength = creatureBodyLength(creature, swim)
  if (Number.isFinite(model?.debugForwardOffsetRatio)) return bodyLength * model.debugForwardOffsetRatio
  if (model?.debugForwardOrigin === 'head') return bodyLength * 0.46
  if (!model) return creatureBodyLength(creature, swim) * 0.52
  return bodyLength * 0.42
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
  const zMin = (swim.boundsZMin ?? -zBase) + SWIM_BOUNDARY_Z_OFFSET_FROM_CAMERA
  const zMax = (swim.boundsZMax ?? zBase) + SWIM_BOUNDARY_Z_OFFSET_FROM_CAMERA
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

function soloAgentRuntimeMargins(bodyLength, creature) {
  const verticalMargin = THREE.MathUtils.clamp(
    bodyLength * SOLO_AGENT_RUNTIME_OVERSHOOT_BODY_LENGTHS,
    SOLO_AGENT_RUNTIME_OVERSHOOT_MIN,
    SOLO_AGENT_RUNTIME_OVERSHOOT_MAX,
  )
  if (!isMolaCreature(creature)) {
    return {
      verticalMargin,
      xMargin: verticalMargin,
      zMinMargin: verticalMargin,
      zMaxMargin: verticalMargin,
    }
  }

  const xzMargin = THREE.MathUtils.clamp(
    bodyLength * MOLA_RUNTIME_OVERSHOOT_XZ_BODY_LENGTHS,
    MOLA_RUNTIME_OVERSHOOT_XZ_MIN,
    MOLA_RUNTIME_OVERSHOOT_XZ_MAX,
  )
  const positiveZMargin = THREE.MathUtils.clamp(
    bodyLength * MOLA_RUNTIME_OVERSHOOT_POSITIVE_Z_BODY_LENGTHS,
    MOLA_RUNTIME_OVERSHOOT_POSITIVE_Z_MIN,
    MOLA_RUNTIME_OVERSHOOT_POSITIVE_Z_MAX,
  )

  return {
    verticalMargin,
    xMargin: xzMargin,
    zMinMargin: xzMargin,
    zMaxMargin: positiveZMargin,
  }
}

function isNegativeZRuntimeEnvelopeExit(point, bounds, bodyLength, creature) {
  const { zMinMargin } = soloAgentRuntimeMargins(bodyLength, creature)
  return point.z < bounds.zMin - zMinMargin
}

function clampToSoloAgentRuntimeEnvelope(point, bounds, bodyLength, creature) {
  const { verticalMargin, xMargin, zMinMargin, zMaxMargin } = soloAgentRuntimeMargins(bodyLength, creature)
  agentRuntimeClamp.copy(point)
  agentRuntimeClamp.z = THREE.MathUtils.clamp(agentRuntimeClamp.z, bounds.zMin - zMinMargin, bounds.zMax + zMaxMargin)
  const { xMin, xMax } = swimXRangeAtZ(bounds, agentRuntimeClamp.z)
  agentRuntimeClamp.x = THREE.MathUtils.clamp(agentRuntimeClamp.x, xMin - xMargin, xMax + xMargin)
  agentRuntimeClamp.y = THREE.MathUtils.clamp(agentRuntimeClamp.y, bounds.yMin - verticalMargin, bounds.yMax + verticalMargin)
  const clamped = agentRuntimeClamp.distanceToSquared(point) > 0.000001
  if (clamped) point.copy(agentRuntimeClamp)
  return clamped
}



// Smallest positive distance from `position` travelling along `forward` before it crosses a
// swim-bounds wall. Infinity when the heading is not aimed at any wall. Because it is a
// ray-to-box time, a fish skimming parallel to a wall reads as "far" even when hugging it —
// only a heading actually aimed at a wall returns a short distance.
function distanceToSwimBoundaryAhead(position, forward, bounds) {
  let best = Infinity
  const { xMin, xMax } = swimXRangeAtZ(bounds, position.z)
  const axes = [
    [forward.x, position.x, xMin, xMax],
    [forward.y, position.y, bounds.yMin, bounds.yMax],
    [forward.z, position.z, bounds.zMin, bounds.zMax],
  ]
  for (const [comp, pos, lo, hi] of axes) {
    if (comp > 1e-4) {
      const t = (hi - pos) / comp
      if (t >= 0 && t < best) best = t
    } else if (comp < -1e-4) {
      const t = (lo - pos) / comp
      if (t >= 0 && t < best) best = t
    }
  }
  return best
}

// Per-frame heading-turn cap for a solo agent, tightened as it bears down on a wall so it can
// bank away before overshooting the runtime envelope. Away from walls (or skimming parallel to
// one) it returns `baseStep` unchanged, preserving the wide open-water arc; as the aimed-at
// wall closes inside the look-ahead the effective radius eases from the open-water radius
// toward a tight minimum, raising the cap so the fish can complete the turn in the room it has.
function boundaryAvoidanceTurnStep(baseStep, position, forward, bounds, swim, bodyLength, speed, delta) {
  const minRadius = Math.max(0.4, bodyLength * SOLO_AGENT_BOUNDARY_MIN_TURN_BODY_LENGTHS)
  const lookAhead = minRadius * (Math.PI / 2) * SOLO_AGENT_BOUNDARY_LOOKAHEAD_ARC_SCALE
  const hitDistance = distanceToSwimBoundaryAhead(position, forward, bounds)
  if (!(hitDistance < lookAhead)) return baseStep
  const urgency = THREE.MathUtils.clamp(1 - hitDistance / lookAhead, 0, 1)
  const openRadius = Math.max(minRadius, (swim.turnRadiusBodyLengths ?? DEFAULT_TURN_RADIUS_BODY_LENGTHS) * bodyLength)
  const effectiveRadius = THREE.MathUtils.lerp(openRadius, minRadius, urgency)
  const tightenedStep = (Math.max(0, speed) / effectiveRadius) * Math.max(0, delta)
  return Math.max(baseStep, tightenedStep)
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
  const [targetYMin, limitedTargetYMax] = soloAgentTargetVerticalRange(from, bounds, targetYMax, bodyLength, swim)

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
    out.set(targetX, randomRange(rand, targetYMin, limitedTargetYMax), targetZ)
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
  const [targetYMin, limitedTargetYMax] = soloAgentTargetVerticalRange(from, bounds, targetYMax, bodyLength, swim)

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
    out.set(targetX, randomRange(rand, targetYMin, limitedTargetYMax), targetZ)
    if (from && out.distanceTo(from) < minDistance) continue
    if (from && forward && !destinationInForwardCone(out, from, forward)) continue
    return out
  }

  const fallback = pickSoloAgentTarget(out, creature, swim, rand, from)
  if (fallback) out.z = THREE.MathUtils.clamp(out.z, zMin, zMax)
  return fallback
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

function molaSunBaskSurfaceCenterYMax(creature, swim, bounds) {
  if (!isMolaCreature(creature)) return bounds.yMax
  const bodyLength = creatureBodyLength(creature, swim)
  const clearance = THREE.MathUtils.clamp(
    bodyLength * MOLA_SUN_BASK_SURFACE_CENTER_CLEARANCE_BODY_LENGTHS,
    MOLA_SUN_BASK_SURFACE_CENTER_CLEARANCE_MIN,
    MOLA_SUN_BASK_SURFACE_CENTER_CLEARANCE_MAX,
  )
  return Math.min(bounds.yMax, SURFACE_PLANE_Y - clearance)
}

function clampToMolaSurfaceCeiling(point, creature, swim, bounds, direction = null, yMaxOverride = null) {
  if (!isMolaCreature(creature)) return false
  const maxY = Number.isFinite(yMaxOverride) ? yMaxOverride : molaSurfaceCenterYMax(creature, swim, bounds)
  if (point.y <= maxY) return false
  point.y = maxY
  if (direction && direction.y > 0) {
    direction.y = 0
    if (direction.lengthSq() > 0.0001) direction.normalize()
  }
  return true
}

// Generic surface ceiling for non-mola solo agents (the mako): keep the body below the water
// plane and flatten any upward heading so it glides along the ceiling instead of hovering with
// its nose pushing up through the surface.
function clampToSurfaceCeiling(point, direction, ceilingY) {
  if (point.y <= ceilingY) return false
  point.y = ceilingY
  if (direction && direction.y > 0) {
    direction.y = 0
    if (direction.lengthSq() > 0.0001) direction.normalize()
  }
  return true
}

function soloAgentReachedDistance(creature, bodyLength) {
  if (!isMolaCreature(creature)) return Math.max(0.7, bodyLength * SOLO_AGENT_STEERING_REACHED_BODY_LENGTHS)
  return Math.max(1.4, Math.min(MOLA_STEERING_REACHED_MAX, bodyLength * MOLA_STEERING_REACHED_BODY_LENGTHS))
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
    out.set(targetX, molaSunBaskSurfaceCenterYMax(creature, swim, bounds), targetZ)
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

  if (isMolaCreature(creature)) return out

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
  const turnStep = soloAgentSteeringTurnRate(swim) * (stepDistance / Math.max(0.1, bodyLength * 0.08))
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
  const hasContinuation = Boolean(start && exitTangent)

  if (hasContinuation) {
    points.push(start.clone())
    schoolTargetTangent.copy(exitTangent)
    if (schoolTargetTangent.lengthSq() < 0.0001) schoolTargetTangent.set(0, 0, -1)
    schoolTargetTangent.normalize()

    const bodyLength = creatureBodyLength(creature, swim)
    const firstTurnDistance = Math.max(
      bodyLength * SCHOOL_PATH_MIN_FIRST_TURN_BODY_LENGTHS,
      THREE.MathUtils.lerp(1.35, 3.6, turnRadius),
    )
    const leadDistance = Math.max(
      firstTurnDistance + bodyLength * 0.4,
      bodyLength * SCHOOL_PATH_CONTINUATION_BODY_LENGTHS * THREE.MathUtils.lerp(0.9, 1.28, turnRadius),
    ) * randomRange(rand, 0.94, 1.08)
    const lead = start.clone().addScaledVector(schoolTargetTangent, leadDistance)
    points.push(clampToSwimBounds(lead, bounds))

    const minTurnPointDistance = firstTurnDistance + bodyLength * 0.65
    let firstTurnPoint = null
    for (let attempt = 0; attempt < 6; attempt += 1) {
      const candidate = rotatedSchoolPoint(rand, bounds, swim, points.length, pointCount, verticalScale, rotation, weavePhase, pattern)
      if (candidate.distanceTo(start) >= minTurnPointDistance) {
        firstTurnPoint = candidate
        break
      }
    }
    if (!firstTurnPoint) {
      firstTurnPoint = start.clone().addScaledVector(schoolTargetTangent, minTurnPointDistance)
      firstTurnPoint.y = traversalY(rand, bounds, swim, 2, verticalScale, 0.62)
      clampToSwimBounds(firstTurnPoint, bounds)
    }
    points.push(firstTurnPoint)
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
  const spacingScale = resolveSpecies(creature)?.swim?.schoolSpacingScale ?? 1
  const schoolRadius = SCHOOL_SPACING * spacingScale * Math.sqrt(count) * SCHOOL_FORMATION_RADIUS_SCALE
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

function boidParamsForCreature(creature, swim) {
  const config = swim.boids ?? {}
  return {
    neighborCap: Math.max(0, Math.floor(config.neighborCap ?? BOID_NEIGHBOR_CAP)),
    perceptionBodyLengths: config.perceptionBodyLengths ?? BOID_PERCEPTION_BODY_LENGTHS,
    perceptionMin: config.perceptionMin ?? BOID_PERCEPTION_MIN,
    perceptionMax: config.perceptionMax ?? BOID_PERCEPTION_MAX,
    separationWeight: config.separationWeight ?? BOID_SEPARATION_WEIGHT,
    alignmentWeight: config.alignmentWeight ?? BOID_ALIGNMENT_WEIGHT,
    cohesionWeight: config.cohesionWeight ?? BOID_COHESION_WEIGHT,
    maxWeight: config.maxWeight ?? BOID_MAX_WEIGHT,
    selfAvoidanceScale: config.selfAvoidanceScale ?? 1,
    repulsionScale: config.repulsionScale ?? (creatureRepulsesOthers(resolveSpecies(creature)) ? 2.2 : 1),
    // How threatening this species reads to others, and how strongly it reacts to
    // threatening neighbors. Prey want high wariness; the mako wants high menace.
    menace: config.menace ?? BOID_DEFAULT_MENACE,
    wariness: config.wariness ?? BOID_DEFAULT_WARINESS,
  }
}

function boidSocialWeight(school, creature, other) {
  if (school?.id && other.schoolId === school.id) return BOID_SAME_GROUP_SOCIAL_WEIGHT
  if (other.species === creature.species) return BOID_SAME_SPECIES_SOCIAL_WEIGHT
  return 0
}

function recordDebugNeighbor(debugState, id, other, relation, socialWeight) {
  if (!debugState || debugState.neighborActive >= BOID_MAX_DEBUG_NEIGHBORS) return
  const slot = debugState.neighbors[debugState.neighborActive]
  slot.id = id
  slot.pos.copy(other.position)
  if (other.forward?.lengthSq?.() > 0.0001) slot.forward.copy(other.forward)
  else slot.forward.set(0, 0, -1)
  slot.relation = relation
  slot.socialWeight = socialWeight
  debugState.neighborActive += 1
}

// Nearest-N neighbor selection: gather everything inside the (wider) threat radius,
// sort by distance, and only treat the nearest N as school/collision neighbors. This
// stabilizes who a fish reacts to from tick to tick, which is what kills the jitter —
// alignment/cohesion targets stop flickering frame to frame. Threat avoidance is
// applied to any menacing neighbor in range, capped or not, so a shark is never missed.
function computeBoidSteering(out, fish, creature, swim, school = null, followDirection = null, debugState = null) {
  out.set(0, 0, 0)
  if (debugState) {
    debugState.separation.set(0, 0, 0)
    debugState.alignment.set(0, 0, 0)
    debugState.cohesion.set(0, 0, 0)
    debugState.threat.set(0, 0, 0)
    debugState.result.set(0, 0, 0)
    debugState.neighborCount = 0
    debugState.neighborActive = 0
    debugState.socialWeightTotal = 0
    debugState.perceptionRadius = 0
  }
  const params = boidParamsForCreature(creature, swim)
  if (params.neighborCap <= 0 || params.maxWeight <= 0) return out

  const radius = fishCollisionRadius(creature, swim, school)
  const bodyLength = swim.bodyLengthWU * (creature.size ?? 1)
  const spacingScale = resolveSpecies(creature)?.swim?.schoolSpacingScale ?? 1
  const perceptionRadius = THREE.MathUtils.clamp(
    bodyLength * params.perceptionBodyLengths * Math.sqrt(Math.max(0.45, spacingScale)),
    params.perceptionMin,
    params.perceptionMax,
  )
  const perceptionRadiusSq = perceptionRadius * perceptionRadius
  const threatRadius = perceptionRadius * BOID_THREAT_PERCEPTION_SCALE
  const threatRadiusSq = threatRadius * threatRadius
  const forward = followDirection?.lengthSq?.() > 0.0001 ? followDirection : null
  if (debugState) debugState.perceptionRadius = perceptionRadius

  // Phase 1 — gather candidates within the widest (threat) radius, then sort nearest-first.
  boidNeighborScratch.length = 0
  FISH_REGISTRY.forEach((other, id) => {
    if (id === creature.id || other.biome !== creature.biome) return
    boidDelta.subVectors(fish.position, other.position)
    boidDelta.y *= 0.55
    const distanceSq = boidDelta.lengthSq()
    if (distanceSq < 0.000001 || distanceSq > threatRadiusSq) return
    boidNeighborScratch.push({ id, other, distanceSq })
  })
  boidNeighborScratch.sort((a, b) => a.distanceSq - b.distanceSq)

  let neighborCount = 0
  let socialWeightTotal = 0
  boidAlignment.set(0, 0, 0)
  boidCenter.set(0, 0, 0)
  separationDelta.set(0, 0, 0)
  boidThreat.set(0, 0, 0)

  for (let i = 0; i < boidNeighborScratch.length; i += 1) {
    const { id: otherId, other, distanceSq } = boidNeighborScratch[i]
    const distance = Math.sqrt(Math.max(distanceSq, 0.000001))
    const withinPerception = distanceSq <= perceptionRadiusSq
    const canUseSocial = withinPerception && neighborCount < params.neighborCap
    let relation = 'neutral'
    let socialWeight = 0

    // Threat avoidance — a wide-radius push away from menacing neighbors.
    const threatPair = (other.menace ?? BOID_DEFAULT_MENACE) * params.wariness
    if (threatPair > 0.06) {
      const proximity = THREE.MathUtils.clamp(1 - distance / threatRadius, 0, 1)
      boidDelta.subVectors(fish.position, other.position)
      boidDelta.y *= 0.55
      if (boidDelta.lengthSq() > 0.000001) {
        boidDelta.normalize()
        boidThreat.addScaledVector(boidDelta, threatPair * proximity * proximity * BOID_THREAT_WEIGHT)
        relation = 'avoid'
      }
    }

    if (canUseSocial) {
      const sameSchool = school?.id && other.schoolId === school.id
      const pairPadding = separationPaddingForPair(school, other)
      const minDistance = radius + other.radius + pairPadding
      if (distanceSq < minDistance * minDistance) {
        const overlap = THREE.MathUtils.clamp((minDistance - distance) / minDistance, 0, 1)
        const otherBodyLength = other.bodyLength ?? other.radius * 2
        const sizeRatio = otherBodyLength / Math.max(0.001, bodyLength)
        const sizeYieldBias = sizeRatio >= 1
          ? THREE.MathUtils.lerp(1, 2.2, THREE.MathUtils.clamp(sizeRatio - 1, 0, 1))
          : THREE.MathUtils.clamp(sizeRatio ** 1.5, 0.08, 1)
        const densityScale = sameSchool ? 1 / Math.sqrt(Math.max(1, school.count)) : 1
        const denseScale = sameSchool && school.count >= DENSE_SCHOOL_MIN_COUNT ? 0.34 : 1
        const repulsionScale = other.repulsionScale ?? 1
        boidDelta.subVectors(fish.position, other.position)
        boidDelta.y *= 0.55
        boidDelta.normalize()
        separationDelta.addScaledVector(
          boidDelta,
          overlap * overlap * params.separationWeight * sizeYieldBias * densityScale * denseScale * repulsionScale * params.selfAvoidanceScale,
        )
      }

      socialWeight = boidSocialWeight(school, creature, other)
      if (socialWeight > 0) {
        if (other.forward?.lengthSq?.() > 0.0001) boidAlignment.addScaledVector(other.forward, socialWeight)
        boidCenter.addScaledVector(other.position, socialWeight)
        socialWeightTotal += socialWeight
        if (relation !== 'avoid') relation = 'follow'
      }
      neighborCount += 1
      recordDebugNeighbor(debugState, otherId, other, relation, socialWeight)
    } else if (relation === 'avoid') {
      recordDebugNeighbor(debugState, otherId, other, relation, socialWeight)
    }
  }

  out.add(separationDelta)
  out.add(boidThreat)
  if (debugState) {
    debugState.separation.copy(separationDelta)
    debugState.threat.copy(boidThreat)
    debugState.neighborCount = neighborCount
    debugState.socialWeightTotal = socialWeightTotal
  }

  if (socialWeightTotal > 0) {
    if (boidAlignment.lengthSq() > 0.0001) {
      boidAlignment.normalize()
      if (forward) boidAlignment.sub(forward).clampLength(0, params.alignmentWeight)
      else boidAlignment.multiplyScalar(params.alignmentWeight)
      if (debugState) debugState.alignment.copy(boidAlignment)
      out.add(boidAlignment)
    }

    boidCenter.multiplyScalar(1 / socialWeightTotal)
    boidCohesion.subVectors(boidCenter, fish.position)
    boidCohesion.y *= 0.45
    if (boidCohesion.lengthSq() > 0.0001) {
      boidCohesion.normalize().multiplyScalar(params.cohesionWeight)
      if (debugState) debugState.cohesion.copy(boidCohesion)
      out.add(boidCohesion)
    }
  }

  out.clampLength(0, params.maxWeight)
  if (debugState) debugState.result.copy(out)
  return out
}

function limitAvoidanceAngle(out, followDirection, maxAngle) {
  if (out.lengthSq() < 0.000001) return out.copy(followDirection)
  out.normalize()
  const angle = followDirection.angleTo(out)
  if (angle > maxAngle) out.lerpVectors(followDirection, out, maxAngle / angle).normalize()
  return out
}

function updateFishRegistry(fish, creature, swim, school = null, forward = null) {
  const radius = fishCollisionRadius(creature, swim, school)
  const species = resolveSpecies(creature)
  const repulser = creatureRepulsesOthers(species)
  const boidParams = boidParamsForCreature(creature, swim)
  const entry = FISH_REGISTRY.get(creature.id)
  const registryForward = forward?.lengthSq?.() > 0.0001 ? forward : null
  if (entry) {
    entry.position.copy(fish.position)
    if (registryForward) entry.forward.copy(registryForward)
    else entry.forward.set(0, 0, -1)
    entry.radius = radius
    entry.bodyLength = swim.bodyLengthWU * (creature.size ?? 1)
    entry.species = creature.species
    entry.biome = creature.biome
    entry.schoolId = school?.id ?? null
    entry.repulsionScale = boidParams.repulsionScale
    entry.repulser = repulser
    entry.menace = boidParams.menace
  } else {
    FISH_REGISTRY.set(creature.id, {
      position: fish.position.clone(),
      forward: registryForward ? registryForward.clone() : new THREE.Vector3(0, 0, -1),
      radius,
      bodyLength: swim.bodyLengthWU * (creature.size ?? 1),
      species: creature.species,
      biome: creature.biome,
      schoolId: school?.id ?? null,
      repulsionScale: boidParams.repulsionScale,
      repulser,
      menace: boidParams.menace,
    })
  }
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

function updateDebugVectorLine(lineRef, start, vector, scale = 1) {
  debugBoidVectorEnd.copy(start).addScaledVector(vector, scale)
  updateDebugLine(lineRef, start, debugBoidVectorEnd)
}

function depthFadeFromScreenZ(z) {
  const normalized = THREE.MathUtils.clamp((z + SWIM_BOX.z) / (SWIM_BOX.z * 2), 0, 1)
  return THREE.MathUtils.lerp(0.22, 1.0, normalized ** 1.65)
}

function applyFishLightMask(material, rim = null) {
  if (!FISH_LIGHT_MASK_ENABLED && !rim) return
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
varying vec3 vFishWorldPosition;
float fishMaskHash(vec3 p) {
  p = fract(p * 0.3183099 + vec3(0.17, 0.31, 0.47));
  p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}
float fishMaskNoise(vec3 p) {
  vec3 i = floor(p);
  vec3 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(mix(fishMaskHash(i + vec3(0.0, 0.0, 0.0)), fishMaskHash(i + vec3(1.0, 0.0, 0.0)), f.x),
        mix(fishMaskHash(i + vec3(0.0, 1.0, 0.0)), fishMaskHash(i + vec3(1.0, 1.0, 0.0)), f.x), f.y),
    mix(mix(fishMaskHash(i + vec3(0.0, 0.0, 1.0)), fishMaskHash(i + vec3(1.0, 0.0, 1.0)), f.x),
        mix(fishMaskHash(i + vec3(0.0, 1.0, 1.0)), fishMaskHash(i + vec3(1.0, 1.0, 1.0)), f.x), f.y),
    f.z
  );
}
float fishMaskFbm(vec3 p) {
  float value = 0.0;
  float amplitude = 0.5;
  for (int i = 0; i < 3; i++) {
    value += fishMaskNoise(p) * amplitude;
    p = p * 2.03 + vec3(7.1, 3.7, 5.3);
    amplitude *= 0.5;
  }
  return value;
}`
      )
      .replace(
        '#include <dithering_fragment>',
        `${FISH_LIGHT_MASK_ENABLED ? `vec3 maskPos = vFishWorldPosition;
float t = uFishLightMaskTime;
vec3 warpedPos = maskPos;
warpedPos.x += (fishMaskFbm(maskPos * vec3(0.18, 0.28, 0.16) + vec3(t * 0.018, -t * 0.010, 1.7)) - 0.5) * 4.8;
warpedPos.y += (fishMaskFbm(maskPos * vec3(0.14, 0.22, 0.20) + vec3(3.1, t * 0.014, -t * 0.012)) - 0.5) * 2.6;
warpedPos.z += (fishMaskFbm(maskPos * vec3(0.20, 0.14, 0.18) + vec3(-t * 0.012, 2.4, t * 0.016)) - 0.5) * 4.2;
float broad = fishMaskFbm(warpedPos * vec3(0.34, 0.24, 0.30) + vec3(t * 0.020, 0.0, -t * 0.015));
float mottled = fishMaskFbm(warpedPos * vec3(0.88, 0.52, 0.74) + vec3(4.2, -t * 0.025, t * 0.018));
float softStripeA = sin(warpedPos.x * 0.62 + warpedPos.y * 0.38 + warpedPos.z * 0.42 + t * 0.18);
float softStripeB = sin(warpedPos.x * -0.34 + warpedPos.y * 0.46 + warpedPos.z * 0.72 - t * 0.13);
float brokenLight = broad * 0.58 + mottled * 0.32 + (softStripeA + softStripeB) * 0.05 + 0.05;
float topWeight = smoothstep(-8.0, 3.0, maskPos.y);
float lightFactor = mix(0.82, 1.08, smoothstep(0.22, 0.82, brokenLight));
gl_FragColor.rgb *= mix(1.0, lightFactor, 0.58 * topWeight);` : ''}
float rimAmount = pow(1.0 - abs(dot(normalize(normal), normalize(vViewPosition))), uRimPower);
gl_FragColor.rgb += uRimColor * rimAmount * uRimIntensity;
#include <dithering_fragment>`
      )
  }
  material.customProgramCacheKey = () => `fish-light-mask:${FISH_LIGHT_MASK_ENABLED ? 'on' : 'off'}:${rimKey}`
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
      applyFishLightMask(nextMaterial, rim)
      materials.push(nextMaterial)
      return nextMaterial
    })
    child.material = Array.isArray(child.material) ? clonedMaterials : clonedMaterials[0]
  })
  return materials
}

function animationVariationForCreature(creature) {
  const rand = mulberry32(hashString(`${creature.id ?? creature.species}:animation-variation`))
  const baseSpeed = randomRange(rand, 0.9, 1.1)

  return {
    startOffset: randomRange(rand, 0, 1),
    speeds: {
      idle: baseSpeed,
      slow_cruise: baseSpeed,
      idle_drift: baseSpeed,
      burst: baseSpeed,
      snap_left: baseSpeed,
      snap_right: baseSpeed,
      bank_l: baseSpeed,
      bank_r: baseSpeed,
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

function modelAnimationSpeed(model, animationVariation, animation, resolvedAnimation) {
  const modelTimeScale = Number.isFinite(model?.animationTimeScale) ? model.animationTimeScale : 1
  const speed = animationVariation?.speeds?.[resolvedAnimation]
    ?? animationVariation?.speeds?.[animation]
    ?? animationVariation?.speeds?.default
    ?? 1
  return speed * modelTimeScale * GLOBAL_ANIMATION_TIME_SCALE
}

function modelActionAnimationDuration(model, animation, fallback) {
  const resolvedAnimation = resolveModelAnimation(model, animation)
  const duration = model?.actionAnimationDurations?.[resolvedAnimation]
    ?? model?.actionAnimationDurations?.[animation]
  return Number.isFinite(duration) && duration > 0 ? duration : fallback
}

// How long a fish holds a boid decision before re-deciding: about one cycle of its
// current swim clip (so a movement decision lasts as long as the animation driving it),
// clamped and per-fish jittered so a school does not re-decide in lockstep.
function boidDecisionInterval(model, animation, jitterUnit) {
  const clip = modelActionAnimationDuration(model, animation, 1.4)
  const base = THREE.MathUtils.clamp(clip, BOID_DECISION_MIN_INTERVAL, BOID_DECISION_MAX_INTERVAL)
  return base * (1 + (jitterUnit - 0.5) * 2 * BOID_DECISION_JITTER)
}

function modelActionMovementDelay(model, animation, fallback = 0) {
  const resolvedAnimation = resolveModelAnimation(model, animation)
  const delay = model?.actionMovementDelayOverrides?.[resolvedAnimation]
    ?? model?.actionMovementDelayOverrides?.[animation]
  return Number.isFinite(delay) && delay >= 0 ? delay : fallback
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

  const speed = modelAnimationSpeed(model, animationVariation, animation, resolvedAnimation)
  const offset = animationVariation?.startOffset ?? 0

  nextAction.reset()
  nextAction.setEffectiveWeight(1)
  configureModelAction(nextAction, model, animation, resolvedAnimation, speed, offset)

  const previousAction = activeActionRef.current
  nextAction.play()
  if (previousAction) nextAction.crossFadeFrom(previousAction, modelFadeDuration(model, 0.12), false)

  activeActionRef.current = nextAction
}

function isSunBaskAnimationName(name) {
  return SUN_BASK_ANIMATION_NAMES.has(name)
}

function sunBaskAnimationFadeDuration(model, animation, resolvedAnimation) {
  if (isSunBaskAnimationName(animation) || isSunBaskAnimationName(resolvedAnimation)) {
    return modelFadeDuration(model, MOLA_SUN_BASK_ANIMATION_FADE_DURATION)
  }
  return modelFadeDuration(model)
}

function layeredAnimationClips(gltfAnimations, model) {
  // Keep authored clips intact. Sun-bask playback is isolated at action time so
  // the complete authored bask clip plays alone, with no cruise base or overlay
  // surgery that can introduce partial-rig conflicts.
  return gltfAnimations
}

function playLayeredModelAction(actions, activeActionRef, model, animation, animationVariation) {
  const baseAnimation = model.layeredBaseAnimation ?? resolveMoveAnimation(model, 'cruise')
  const baseAction = actions[baseAnimation]
  const offset = animationVariation?.startOffset ?? 0
  const resolvedAnimation = resolveModelAnimation(model, animation)

  if (isSunBaskAnimationName(animation) || isSunBaskAnimationName(resolvedAnimation)) {
    const sunBaskAction = actions[resolvedAnimation] ?? actions[animation]
    if (!sunBaskAction || activeActionRef.current === sunBaskAction) return

    const entryFadeDuration = modelFadeDuration(model, MOLA_SUN_BASK_ANIMATION_ENTRY_FADE_DURATION)
    const previousActions = Object.values(actions).filter(action => (
      action && action !== sunBaskAction && action.isRunning()
    ))
    const shouldEaseEntry = entryFadeDuration > 0 && previousActions.length > 0
    Object.values(actions).forEach(action => {
      if (!action || action === sunBaskAction) return
      if (shouldEaseEntry && action.isRunning()) action.fadeOut(entryFadeDuration)
      else action.stop()
    })

    const speed = modelAnimationSpeed(model, animationVariation, animation, resolvedAnimation) * MOLA_SUN_BASK_ANIMATION_SPEED_SCALE
    sunBaskAction.reset()
    sunBaskAction.setEffectiveWeight(1)
    configureModelAction(sunBaskAction, model, animation, resolvedAnimation, speed, 0)
    sunBaskAction.play()
    if (shouldEaseEntry) {
      sunBaskAction.fadeIn(entryFadeDuration)
      globalThis.setTimeout?.(() => {
        if (!sunBaskAction.isRunning()) return
        previousActions.forEach(action => action.stop())
      }, entryFadeDuration * 1000 + 50)
    }
    activeActionRef.current = sunBaskAction
    return
  }

  const previousOverlay = activeActionRef.current
  const previousWasSunBask = previousOverlay
    && previousOverlay !== baseAction
    && isSunBaskAnimationName(previousOverlay.getClip?.()?.name)
  const sunBaskExitFadeDuration = modelFadeDuration(model, MOLA_SUN_BASK_ANIMATION_ENTRY_FADE_DURATION)

  if (baseAction && !baseAction.isRunning()) {
    const speed = modelAnimationSpeed(model, animationVariation, baseAnimation, baseAnimation)
    baseAction.reset()
    baseAction.setEffectiveWeight(model.layeredBaseWeight ?? 1)
    configureModelAction(baseAction, model, baseAnimation, baseAnimation, speed, offset)
    baseAction.play()
    if (previousWasSunBask) baseAction.fadeIn(sunBaskExitFadeDuration)
  }

  if (resolvedAnimation === baseAnimation) {
    if (previousOverlay && previousOverlay !== baseAction) previousOverlay.fadeOut(previousWasSunBask ? sunBaskExitFadeDuration : modelFadeDuration(model))
    activeActionRef.current = null
    return
  }

  const nextAction = actions[resolvedAnimation] ?? actions[animation]
  if (!nextAction || activeActionRef.current === nextAction) return

  const speed = modelAnimationSpeed(model, animationVariation, animation, resolvedAnimation)
  nextAction.reset()
  nextAction.setEffectiveWeight(model.layeredOverlayWeight ?? 1)
  configureModelAction(nextAction, model, animation, resolvedAnimation, speed, offset)
  nextAction.play()
  nextAction.fadeIn(sunBaskAnimationFadeDuration(model, animation, resolvedAnimation))
  if (previousOverlay) previousOverlay.fadeOut(sunBaskAnimationFadeDuration(model, animation, resolvedAnimation))
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

function collectCurveDeformBones(object, model) {
  const names = model?.curveDeform?.bones
  if (!Array.isArray(names) || names.length === 0) return []
  const objectsByNormalizedName = new Map()
  object.traverse(child => {
    if (!child?.name) return
    objectsByNormalizedName.set(normalizeCurveDeformBoneName(child.name), child)
  })
  const found = []
  names.forEach(name => {
    const bone = object.getObjectByName(name) ?? objectsByNormalizedName.get(normalizeCurveDeformBoneName(name))
    if (bone?.isBone) found.push(bone)
  })
  return found
}

function normalizeCurveDeformBoneName(name) {
  return String(name).toLowerCase().replace(/[^a-z0-9]/g, '')
}

function curveDeformAxis(config) {
  if (config?.axis === 'x') return curveDeformAxisX
  if (config?.axis === 'y') return curveDeformAxisY
  return curveDeformAxisZ
}

function curveDeformMaxAngle(config) {
  const degrees = Number.isFinite(config?.maxAngleDegrees) ? config.maxAngleDegrees : 0
  return THREE.MathUtils.degToRad(THREE.MathUtils.clamp(degrees, 0, 24))
}

function ensureCurveDeformState(state, count) {
  for (let index = state.previousAdditives.length; index < count; index += 1) {
    state.previousAdditives.push(new THREE.Quaternion())
    state.postAdditiveQuaternions.push(new THREE.Quaternion())
    state.hasPreviousAdditive.push(false)
  }
  state.previousAdditives.length = count
  state.postAdditiveQuaternions.length = count
  state.hasPreviousAdditive.length = count
}

function removePreviousCurveDeformAdditive(bone, state, index, scratchQuat) {
  if (!state.hasPreviousAdditive[index]) return
  const postAdditive = state.postAdditiveQuaternions[index]
  if (bone.quaternion.angleTo(postAdditive) > 0.0001) {
    state.hasPreviousAdditive[index] = false
    return
  }
  scratchQuat.copy(state.previousAdditives[index]).invert()
  bone.quaternion.multiply(scratchQuat)
  state.hasPreviousAdditive[index] = false
}

function collectModelBones(object) {
  const bones = []
  object.traverse(child => {
    if (child?.isBone) bones.push(child)
  })
  return bones
}

function BoneDebugOverlay({ object, bones, modelScale = 1, parentScale = 1 }) {
  const markerRefs = useRef([])
  const labelRefs = useRef([])
  const scratchWorldPositionRef = useRef(new THREE.Vector3())
  const localPositions = useMemo(
    () => bones.map(() => new THREE.Vector3()),
    [bones],
  )
  const boneIndices = useMemo(() => new Map(bones.map((bone, index) => [bone.uuid, index])), [bones])
  const boneSegments = useMemo(() => {
    const segments = []
    bones.forEach((bone, index) => {
      const parentIndex = bone.parent?.isBone ? boneIndices.get(bone.parent.uuid) : undefined
      if (Number.isInteger(parentIndex)) segments.push([parentIndex, index])
    })
    return segments
  }, [bones, boneIndices])
  const lineGeometry = useMemo(() => {
    const geometry = new THREE.BufferGeometry()
    const pointCount = Math.max(2, boneSegments.length * 2)
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(pointCount * 3), 3))
    return geometry
  }, [boneSegments.length])
  const markerScale = THREE.MathUtils.clamp(0.055 / Math.max(0.001, modelScale), 0.035, 0.12)
  const labelScale = DEBUG_NAME_LABEL_SCALE / Math.max(0.001, modelScale * parentScale)

  useFrame(() => {
    if (!object || bones.length === 0) return
    object.updateWorldMatrix(true, true)
    const scratch = scratchWorldPositionRef.current
    bones.forEach((bone, index) => {
      bone.getWorldPosition(scratch)
      localPositions[index].copy(scratch)
      object.worldToLocal(localPositions[index])
      const marker = markerRefs.current[index]
      if (marker) marker.position.copy(localPositions[index])
      const label = labelRefs.current[index]
      if (label) label.position.copy(localPositions[index]).addScalar(markerScale * 1.15)
    })
    const positionAttribute = lineGeometry.getAttribute('position')
    let cursor = 0
    boneSegments.forEach(([startIndex, endIndex]) => {
      const start = localPositions[startIndex]
      const end = localPositions[endIndex]
      positionAttribute.setXYZ(cursor, start.x, start.y, start.z)
      positionAttribute.setXYZ(cursor + 1, end.x, end.y, end.z)
      cursor += 2
    })
    while (cursor < positionAttribute.count) {
      const fallback = localPositions[0] ?? scratch.set(0, 0, 0)
      positionAttribute.setXYZ(cursor, fallback.x, fallback.y, fallback.z)
      cursor += 1
    }
    positionAttribute.needsUpdate = true
    lineGeometry.computeBoundingSphere()
  })

  if (bones.length === 0) return null

  return (
    <group raycast={() => null}>
      <lineSegments geometry={lineGeometry} raycast={() => null} renderOrder={45}>
        <lineBasicMaterial color="#35f7ff" transparent opacity={0.92} depthTest={false} depthWrite={false} />
      </lineSegments>
      {bones.map((bone, index) => (
        <group key={`${bone.uuid}:${index}`}>
          <mesh
            ref={element => { markerRefs.current[index] = element }}
            scale={markerScale}
            raycast={() => null}
            renderOrder={46}
          >
            <sphereGeometry args={[1, 8, 8]} />
            <meshBasicMaterial color={bone.parent?.isBone ? '#35f7ff' : '#ffec6a'} transparent opacity={0.9} depthTest={false} depthWrite={false} />
          </mesh>
          <Billboard
            ref={element => { labelRefs.current[index] = element }}
            follow
            raycast={() => null}
            renderOrder={80}
          >
            <Text
              fontSize={labelScale}
              font={DEBUG_LABEL_FONT}
              fontWeight="normal"
              color="#eaffff"
              anchorX="left"
              anchorY="middle"
              depthTest={false}
              depthWrite={false}
              renderOrder={81}
              material-depthTest={false}
              material-depthWrite={false}
              material-transparent
              material-toneMapped={false}
              raycast={() => null}
            >
              {bone.name}
            </Text>
          </Billboard>
        </group>
      ))}
    </group>
  )
}

function FishModel({ model, animation = 'idle', animationVariation, animationSpeedScaleRef = null, curveDeformInputRef = null, debugSimulationSpeed = 1, debugCurveBones = false, debugParentScale = 1, rim = null, lodDebugColor = null }) {
  const gltf = useGLTF(model.path)
  const object = useMemo(() => clone(gltf.scene), [gltf.scene])
  const animations = useMemo(() => layeredAnimationClips(gltf.animations, model), [gltf.animations, model])
  const curveDeformBones = useMemo(() => collectCurveDeformBones(object, model), [object, model])
  const debugBones = useMemo(() => collectModelBones(object), [object])
  const { actions } = useAnimations(animations, object)
  const activeActionRef = useRef(null)
  const materialsRef = useRef([])
  const curveDeformTurnRef = useRef(0)
  const curveDeformQuatRef = useRef(new THREE.Quaternion())
  const curveDeformScratchQuatRef = useRef(new THREE.Quaternion())
  const curveDeformStateRef = useRef({
    previousAdditives: [],
    postAdditiveQuaternions: [],
    hasPreviousAdditive: [],
  })

  useEffect(() => {
    materialsRef.current = applyModelMaterialSettings(object, rim, lodDebugColor)
  }, [object, rim, lodDebugColor])

  useFrame(({ clock }, rawDelta) => {
    const elapsed = clock.getElapsedTime()
    const activeAction = activeActionRef.current
    const simulationSpeed = THREE.MathUtils.clamp(
      Number.isFinite(debugSimulationSpeed) ? debugSimulationSpeed : 1,
      1,
      10,
    )
    if (activeAction) {
      const baseTimeScale = activeAction.userData?.baseTimeScale ?? 1
      const runtimeAnimationScale = model?.lockAnimationPlayback ? 1 : (animationSpeedScaleRef?.current ?? 1)
      const debugAnimationScale = model?.lockAnimationPlayback ? 1 : simulationSpeed
      activeAction.setEffectiveTimeScale(baseTimeScale * runtimeAnimationScale * debugAnimationScale)
    }
    const curveConfig = model?.curveDeform
    if (curveConfig && curveDeformBones.length > 0) {
      const curveState = curveDeformStateRef.current
      ensureCurveDeformState(curveState, curveDeformBones.length)
      const scratchQuat = curveDeformScratchQuatRef.current
      const input = curveDeformInputRef?.current ?? {}
      const strength = Number.isFinite(curveConfig.strength) ? curveConfig.strength : 0
      const maxAngle = curveDeformMaxAngle(curveConfig)
      const response = Number.isFinite(curveConfig.response) ? Math.max(0.01, curveConfig.response) : 5
      const targetTurn = THREE.MathUtils.clamp(input.turn ?? 0, -1, 1)
      curveDeformTurnRef.current = THREE.MathUtils.damp(
        curveDeformTurnRef.current,
        targetTurn,
        response,
        rawDelta * simulationSpeed,
      )
      const burstBoost = 1 + (Number.isFinite(curveConfig.burstBoost) ? curveConfig.burstBoost : 0) * THREE.MathUtils.clamp(input.burst01 ?? 0, 0, 1)
      const speedBoost = 1 + (Number.isFinite(curveConfig.speedBoost) ? curveConfig.speedBoost : 0) * THREE.MathUtils.clamp(input.speed01 ?? 0, 0, 1)
      // Optionally ease the turn bend back toward straight as actual forward speed drops,
      // so a fish crawling out of a turn straightens its tail before swimming on instead
      // of holding a full sideways bend while barely moving.
      const speedEase = curveConfig.easeStraightenBySpeed
        ? THREE.MathUtils.lerp(
          Number.isFinite(curveConfig.straightenFloor) ? curveConfig.straightenFloor : 0.12,
          1,
          THREE.MathUtils.clamp(input.speedEase01 ?? 1, 0, 1),
        )
        : 1
      const baseAngle = THREE.MathUtils.clamp(
        curveDeformTurnRef.current * strength * burstBoost * speedBoost * speedEase * maxAngle,
        -maxAngle,
        maxAngle,
      )
      const idleSwayAngle = THREE.MathUtils.degToRad(THREE.MathUtils.clamp(
        Number.isFinite(curveConfig.idleSwayDegrees) ? curveConfig.idleSwayDegrees : 0,
        0,
        10,
      ))
      const idleSwaySpeed = Number.isFinite(curveConfig.idleSwaySpeed) ? Math.max(0.01, curveConfig.idleSwaySpeed) : 1.35
      const idleSwayPhaseOffset = Number.isFinite(curveConfig.idleSwayPhaseOffset) ? curveConfig.idleSwayPhaseOffset : 1.15
      const idleSwaySpeedBoost = 1 + (Number.isFinite(curveConfig.idleSwaySpeedBoost) ? curveConfig.idleSwaySpeedBoost : 0) * THREE.MathUtils.clamp(input.speed01 ?? 0, 0, 1)
      const tailBias = Number.isFinite(curveConfig.tailBias) ? Math.max(0.1, curveConfig.tailBias) : 1
      const baseWeight = Number.isFinite(curveConfig.baseWeight)
        ? THREE.MathUtils.clamp(curveConfig.baseWeight, 0, 1)
        : 0
      const chainMultiplier = Number.isFinite(curveConfig.chainMultiplier)
        ? THREE.MathUtils.clamp(curveConfig.chainMultiplier, 0.5, 1.5)
        : 1
      const phase = elapsed * 1.35 + (input.phase ?? 0)
      const idleSwayPhase = elapsed * idleSwaySpeed + (input.phase ?? 0)
      const bendAxis = curveDeformAxis(curveConfig)
      curveDeformBones.forEach((bone, index) => {
        removePreviousCurveDeformAdditive(bone, curveState, index, scratchQuat)
        const ratio = curveDeformBones.length <= 1 ? 1 : index / (curveDeformBones.length - 1)
        const chainWeight = Math.pow(chainMultiplier, index)
        const tailWeight = THREE.MathUtils.lerp(baseWeight, 1, Math.pow(ratio, tailBias)) * chainWeight
        const followThrough = Math.sin(phase - ratio * 1.15) * 0.24 * Math.abs(baseAngle)
        const idleSway = Math.sin(idleSwayPhase - ratio * idleSwayPhaseOffset) * idleSwayAngle * idleSwaySpeedBoost * tailWeight
        // Clamp only the STATIC turn bend to the configured max (tailWeight /
        // chainMultiplier^index can otherwise overshoot into a kink). Follow-through and
        // idle sway stay additive on top so the tail keeps waving (swimming) through a
        // sustained turn instead of freezing at the clamp.
        const staticBend = THREE.MathUtils.clamp(baseAngle * tailWeight, -maxAngle, maxAngle)
        curveDeformQuatRef.current.setFromAxisAngle(bendAxis, staticBend + followThrough + idleSway)
        bone.quaternion.multiply(curveDeformQuatRef.current)
        curveState.previousAdditives[index].copy(curveDeformQuatRef.current)
        curveState.postAdditiveQuaternions[index].copy(bone.quaternion)
        curveState.hasPreviousAdditive[index] = true
      })
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
    <group
      scale={model.scale ?? 1}
      rotation={model.rotation ?? [0, 0, 0]}
      position={model.position ?? [0, 0, 0]}
    >
      <primitive object={object} />
      {debugCurveBones && debugBones.length > 0 && (
        <BoneDebugOverlay object={object} bones={debugBones} modelScale={model.scale ?? 1} parentScale={debugParentScale} />
      )}
    </group>
  )
}

export default function Fish({ creature, selected = false, zoomActive = false, debugSunBaskRequestId = 0, soloRuntimeRecoveryEnabled = true, hideSelectionSilhouette = false, debug = false, debugLayers = null, debugLodView = false, debugSimulationSpeed = 1, school = null, modelVariantKey = null, onClick, onReady, onRuntimeRecoveryNeeded }) {
  const ref = useRef()
  const modelRootRef = useRef()
  const forwardLineRef = useRef()
  const boidSeparationLineRef = useRef()
  const boidAlignmentLineRef = useRef()
  const boidCohesionLineRef = useRef()
  const boidThreatLineRef = useRef()
  const boidResultLineRef = useRef()
  const boidLabelRef = useRef()
  // Per-neighbor debug lines: a connector fish->neighbor (colored by relation) and a
  // short tick showing the neighbor's own heading. Fixed pools so nothing allocates.
  const boidNeighborLineRefs = useRef([])
  const boidNeighborHeadingRefs = useRef([])
  const speedLabelRef = useRef()
  const agentLabelRef = useRef()
  const nameLabelRef = useRef()
  const swim = useMemo(() => resolveSwimProfile(creature), [creature])
  const species = useMemo(() => resolveSpecies(creature), [creature])
  const model = useMemo(() => resolveModel(creature, modelVariantKey), [creature, modelVariantKey])
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
  const lastFollowRecoveryExitAt = useRef(-Infinity)
  const runtimeRecoveryFade = useRef({ phase: 'idle', startedAt: 0 })
  const simulationTime = useRef(null)
  const rawBoidSteering = useRef(new THREE.Vector3())
  const smoothedBoidSteering = useRef(new THREE.Vector3())
  // Boid decisions are committed and held for ~one animation cycle, then re-decided.
  // Between ticks the committed vector is eased in, so heading changes are smooth and
  // infrequent instead of recomputed every frame.
  const committedBoidSteering = useRef(new THREE.Vector3())
  const boidDecisionNextAt = useRef(0)
  const boidDecisionJitter = useRef(Math.random())
  const boidDebugState = useRef({
    separation: new THREE.Vector3(),
    alignment: new THREE.Vector3(),
    cohesion: new THREE.Vector3(),
    threat: new THREE.Vector3(),
    result: new THREE.Vector3(),
    neighborCount: 0,
    socialWeightTotal: 0,
    perceptionRadius: 0,
    neighborActive: 0,
    neighbors: Array.from({ length: BOID_MAX_DEBUG_NEIGHBORS }, () => ({
      id: null,
      pos: new THREE.Vector3(),
      forward: new THREE.Vector3(0, 0, -1),
      relation: 'neutral',
      socialWeight: 0,
    })),
  })
  const repulserDrift = useRef(new THREE.Vector3())
  const desiredDirection = useRef(new THREE.Vector3())
  const labelPosition = useRef(new THREE.Vector3())
  const previousPosition = useRef(new THREE.Vector3())
  const hasFollowPosition = useRef(false)
  const previousTangent = useRef(new THREE.Vector3())
  const visualForward = useRef(new THREE.Vector3())
  const visualPitch = useRef(0)
  const hasVisualForward = useRef(false)
  const baseLookQuaternion = useRef(new THREE.Quaternion())
  const hasBaseLookQuaternion = useRef(false)
  const lookBehaviorKey = useRef('')
  const lookBehaviorTransitionStartedAt = useRef(-Infinity)
  const animationCooldown = useRef(0)
  const animationHoldUntil = useRef(0)
  const velocity = useRef(0)
  const actionSpeedStartAt = useRef(0)
  const actionSpeedUntil = useRef(0)
  const actionSpeedTarget = useRef(0)
  const curveDeformTurnIntent = useRef(0)
  // Smoothed ratio of actual forward travel to intended cruise speed. Drops when a
  // fish is throttled (e.g. crawling out of a turn), used to ease the curve-deform
  // bend back toward straight before forward swimming resumes.
  const curveDeformSpeedEase = useRef(1)
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
  const curveDeformInputRef = useRef({ turn: 0, speed01: 0, speedEase01: 1, burst01: 0, phase: 0 })
  const [animation, setAnimation] = useState(() => resolveMoveAnimation(model, 'cruise'))
  const [instancedSardineLod, setInstancedSardineLod] = useState(null)
  const [path, setPath] = useState(() => (schoolState?.path ?? makeSwimPath(creature, swim, pathSeed.current)))
  const pathRef = useRef(schoolState?.path ?? path)
  const pathLengthRef = useRef(schoolState?.pathLength ?? path.getLength())
  const forwardDebugGeometry = useMemo(() => makeDebugLineGeometry(), [])
  const boidSeparationGeometry = useMemo(() => makeDebugLineGeometry(), [])
  const boidAlignmentGeometry = useMemo(() => makeDebugLineGeometry(), [])
  const boidCohesionGeometry = useMemo(() => makeDebugLineGeometry(), [])
  const boidThreatGeometry = useMemo(() => makeDebugLineGeometry(), [])
  const boidResultGeometry = useMemo(() => makeDebugLineGeometry(), [])
  const boidNeighborGeometries = useMemo(
    () => Array.from({ length: BOID_MAX_DEBUG_NEIGHBORS }, () => makeDebugLineGeometry()),
    [],
  )
  const boidNeighborHeadingGeometries = useMemo(
    () => Array.from({ length: BOID_MAX_DEBUG_NEIGHBORS }, () => makeDebugLineGeometry()),
    [],
  )
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
    if (!debug || !selected || !zoomActive || !isMolaCreature(creature)) return
    queuedSunBaskRequestId.current = debugSunBaskRequestId
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
    runtimeRecoveryFade.current = { phase: 'idle', startedAt: 0 }
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
    rawBoidSteering.current.set(0, 0, 0)
    smoothedBoidSteering.current.set(0, 0, 0)
    committedBoidSteering.current.set(0, 0, 0)
    boidDecisionNextAt.current = 0
    boidDebugState.current.separation.set(0, 0, 0)
    boidDebugState.current.alignment.set(0, 0, 0)
    boidDebugState.current.cohesion.set(0, 0, 0)
    boidDebugState.current.threat.set(0, 0, 0)
    boidDebugState.current.result.set(0, 0, 0)
    boidDebugState.current.neighborCount = 0
    boidDebugState.current.neighborActive = 0
    boidDebugState.current.socialWeightTotal = 0
    repulserDrift.current.set(0, 0, 0)
    hasVisualForward.current = false
    hasBaseLookQuaternion.current = false
    lookBehaviorKey.current = ''
    lookBehaviorTransitionStartedAt.current = -Infinity
    curveDeformInputRef.current.phase = motion.bobPhase
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

  useFrame(({ clock, camera }, rawDelta) => {
    const fish = ref.current
    if (!fish) return

    const rawNow = clock.getElapsedTime()
    const simulationSpeed = THREE.MathUtils.clamp(
      Number.isFinite(debugSimulationSpeed) ? debugSimulationSpeed : 1,
      1,
      10,
    )
    const delta = Math.min(rawDelta, MAX_SIMULATION_RAW_DELTA) * simulationSpeed
    if (simulationTime.current === null) simulationTime.current = rawNow
    simulationTime.current += delta
    const now = simulationTime.current

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
    const isActionMoveActive = now >= actionSpeedStartAt.current && now < actionSpeedUntil.current
    const isDrifting = hasDriftMove && !isActionMoveActive && now < driftUntil.current
    const targetVelocity = isActionMoveActive ? actionSpeedTarget.current : (isDrifting ? motion.driftSpeed : idleVelocity)
    const velocityResponse = isActionMoveActive ? 8 : (isDrifting ? 1.2 : 2.4)

    velocity.current = THREE.MathUtils.lerp(
      velocity.current,
      targetVelocity,
      1 - Math.exp(-delta * velocityResponse),
    )

    // Legacy spline advance for non-schooling, non-agent fish (gated off by default).
    // Schooling fish no longer use a spline at all — they steer toward the shared boid goal.
    if (SPLINE_MOVEMENT_ENABLED && !isSchooling && !isSoloAgent) {
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
    }

    const currentPath = pathRef.current
    curveDeformTurnIntent.current = 0
    const t = isSchooling ? 0 : THREE.MathUtils.clamp(progress.current, 0, 1)
    let position
    if (isSchooling) {
      // Boids: the fish owns its own position. Seed the first frame from the school's spawn
      // centre plus this member's formation offset, then track fish.position thereafter.
      if (hasFollowPosition.current) {
        position = fish.position
      } else {
        position = schoolBasePosition.copy(schoolState.center)
        position.x += schoolOffset.lateral
        position.y += schoolOffset.vertical
        position.z += schoolOffset.longitudinal
        clampToSwimBounds(position, swimBounds(creature.depthZone, swim, creature.size ?? 1))
      }
      // Heading estimate for steering/boids until the movement step recomputes the tangent.
      if (desiredDirection.current.lengthSq() > 0.0001) tangent.copy(desiredDirection.current)
      else if (hasVisualForward.current) tangent.copy(visualForward.current)
      else tangent.set(0, 0, -1)
      if (tangent.lengthSq() > 0.000001) tangent.normalize()
      else tangent.set(0, 0, -1)
    } else {
      position = currentPath.getPointAt(t)
      currentPath.getPointAt(Math.min(t + 0.006, 1), nextPoint)
      tangent.subVectors(nextPoint, currentPath.getPointAt(t))
      if (tangent.lengthSq() > 0.000001) tangent.normalize()
    }

    const followDistance = followLookaheadDistance(creature, swim, isSchooling)
    const followTargetT = THREE.MathUtils.clamp(t + followDistance / pathLength, 0, 1)
    if (isSchooling) {
      // Every member steers toward the SAME shared goal. Spread is emergent from boid
      // separation/cohesion, not from offsetting each fish's target (which strung them into a
      // conga line and held a permanent yaw offset that cocked the tails).
      followTarget.current.copy(schoolState.goal)
    } else if (isSoloAgent) {
      position = hasFollowPosition.current ? fish.position : position
      const currentForward = desiredDirection.current.lengthSq() > 0.0001
        ? desiredDirection.current
        : (hasVisualForward.current ? visualForward.current : tangent)
      if (currentForward.lengthSq() < 0.0001) currentForward.set(0, 0, -1)
      currentForward.normalize()

      const bodyLength = creatureBodyLength(creature, swim)
      const reachedDistance = agentBehavior.current?.type === 'sun-bask' && agentBehavior.current.stage === 'approach'
        ? Math.min(bodyLength * MOLA_SUN_BASK_REACHED_BODY_LENGTHS, MOLA_SUN_BASK_REACHED_MAX)
        : soloAgentReachedDistance(creature, bodyLength)
      const targetDistance = agentHasTarget.current ? position.distanceTo(agentTarget.current) : Infinity
      if (agentBehavior.current && targetDistance <= reachedDistance) {
        if (agentBehavior.current.type === 'sun-bask' && agentBehavior.current.stage === 'approach') {
          const plannedDistance = Math.max(0.001, agentBehavior.current.approachDistance ?? 0)
          const distanceProgress = plannedDistance > 0.001
            ? 1 - (targetDistance / plannedDistance)
            : 1
          const progress = THREE.MathUtils.clamp(distanceProgress, 0, 1)
          const delayedProgress = THREE.MathUtils.clamp(
            (progress - MOLA_SUN_BASK_ROLL_PROGRESS_START) / Math.max(0.001, 1 - MOLA_SUN_BASK_ROLL_PROGRESS_START),
            0,
            1,
          )
          const easedRoll = delayedProgress * delayedProgress * delayedProgress * (delayedProgress * (delayedProgress * 6 - 15) + 10)
          const holdStartRollAlpha = easedRoll * MOLA_SUN_BASK_APPROACH_MAX_ROLL_ALPHA
          agentBehavior.current = {
            ...agentBehavior.current,
            stage: 'hold',
            stageStartedAt: now,
            holdUntil: now + MOLA_SUN_BASK_DURATION,
            holdStartRollAlpha,
            holdForward: (hasVisualForward.current ? visualForward.current : currentForward).clone().normalize(),
          }
          agentHasTarget.current = false
          agentBehaviorDistance.current = 0
          driftUntil.current = 0
          animationHoldUntil.current = now + MOLA_SUN_BASK_DURATION
          animationCooldown.current = now + MOLA_SUN_BASK_DURATION
          playAnimation(resolveMoveAnimation(model, agentBehavior.current.side < 0 ? 'sunBaskLeft' : 'sunBaskRight'))
        } else if (agentBehavior.current.type === 'sun-bask' && agentBehavior.current.stage === 'exit') {
          const exitElapsed = Math.max(0, now - (agentBehavior.current.stageStartedAt ?? agentBehaviorStartedAt.current))
          if (exitElapsed >= MOLA_SUN_BASK_EXIT_ROLL_DURATION) {
            agentBehavior.current = null
            agentHasTarget.current = false
            agentBehaviorDistance.current = 0
            nextAgentRetargetAt.current = now + randomRange(agentRand.current, 0.15, 0.55)
          } else {
            agentBehavior.current = {
              ...agentBehavior.current,
              exitArrivedAt: agentBehavior.current.exitArrivedAt ?? now,
            }
            agentHasTarget.current = false
            agentBehaviorDistance.current = 0
          }
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
          const approachDistance = Math.max(0.001, position.distanceTo(sunBaskDestination))
          agentBehavior.current = { type: 'sun-bask', stage: 'approach', side, stageStartedAt: now, holdUntil: 0, approachDistance }
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

      if (agentBehavior.current?.type === 'sun-bask' && agentBehavior.current.stage === 'exit') {
        const exitElapsed = Math.max(0, now - (agentBehavior.current.stageStartedAt ?? agentBehaviorStartedAt.current))
        if (exitElapsed >= MOLA_SUN_BASK_EXIT_ROLL_DURATION && !agentHasTarget.current) {
          agentBehavior.current = null
          agentBehaviorDistance.current = 0
          nextAgentRetargetAt.current = now + randomRange(agentRand.current, 0.15, 0.55)
        }
      }

      if (agentBehavior.current?.type === 'sun-bask' && agentBehavior.current.stage === 'hold' && now >= agentBehavior.current.holdUntil) {
        pickMolaSunBaskExitTarget(agentBaskExitTarget, creature, swim, fish.position, currentForward)
        agentTarget.current.copy(agentBaskExitTarget)
        agentHasTarget.current = true
        const driftElapsed = Math.max(0, now - (agentBehavior.current.stageStartedAt ?? agentBehaviorStartedAt.current))
        const exitStartYawDrift = Math.sin(driftElapsed * 0.19 + motion.bobPhase * 1.7) * MOLA_SUN_BASK_DRIFT_YAW_AMPLITUDE
        const exitStartRollDrift = Math.sin(driftElapsed * 0.27 + motion.bobPhase * 2.3 + 1.1) * MOLA_SUN_BASK_DRIFT_ROLL_AMPLITUDE
        agentBehavior.current = {
          ...agentBehavior.current,
          stage: 'exit',
          stageStartedAt: now,
          exitStartRollAlpha: 1,
          exitStartYawDrift,
          exitStartRollDrift,
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
        const driftElapsed = now - agentBehavior.current.stageStartedAt
        const driftPhase = driftElapsed * 0.45 + motion.bobPhase
        const driftIntroAlpha = THREE.MathUtils.smoothstep(driftElapsed, 0, MOLA_SUN_BASK_DRIFT_INTRO_DURATION)
        const coastAlpha = 1 - THREE.MathUtils.smoothstep(driftElapsed, 0, MOLA_SUN_BASK_HOLD_COAST_DURATION)
        if (coastAlpha > 0.001 && velocity.current > 0.001) {
          fish.position.addScaledVector(agentMoveDirection, velocity.current * coastAlpha * organicMotion.speedScale * delta)
        }
        fish.position.x += Math.sin(driftPhase) * MOLA_SUN_BASK_DRIFT_XZ_AMPLITUDE * driftIntroAlpha * delta
        fish.position.z += Math.cos(driftPhase * 0.73) * MOLA_SUN_BASK_DRIFT_XZ_AMPLITUDE * driftIntroAlpha * delta
        const bounds = swimBounds(creature.depthZone, swim, creature.size ?? 1)
        velocity.current = THREE.MathUtils.damp(velocity.current, 0, 1.4, delta)
        const driftY = Math.sin(driftPhase * 0.57 + 1.7) * MOLA_SUN_BASK_DRIFT_Y_AMPLITUDE * driftIntroAlpha
        fish.position.y = THREE.MathUtils.damp(fish.position.y, molaSunBaskSurfaceCenterYMax(creature, swim, bounds) + driftY, 1.2, delta)
        clampToMolaSurfaceCeiling(fish.position, creature, swim, bounds, agentMoveDirection, molaSunBaskSurfaceCenterYMax(creature, swim, bounds))
        agentBehaviorDistance.current = 0
      } else {
        // Cap solo-agent heading changes to a forward arc of body-length turn radius,
        // so large solo swimmers (mako) bank through turns instead of pivoting on the spot.
        const soloForwardSpeed = (Number.isFinite(velocity.current) && velocity.current > 0 ? velocity.current : motion.idleSpeed) * organicMotion.speedScale
        const bounds = swimBounds(creature.depthZone, swim, creature.size ?? 1)
        let soloTurnRadiusStep = maxTurnRadiansForSpeed(swim, bodyLength, soloForwardSpeed, delta)
        // Let the mako tighten its arc as it bears down on a wall so it carves away instead of
        // overshooting the envelope and getting snapped back. The mola keeps its own boundary
        // and surface handling untouched.
        if (!isMolaCreature(creature)) {
          soloTurnRadiusStep = boundaryAvoidanceTurnStep(soloTurnRadiusStep, fish.position, tangent, bounds, swim, bodyLength, soloForwardSpeed, delta)
        }
        if (agentHasTarget.current) {
          shapeSoloAgentSteeringDesired(agentMoveDirection, fish.position, agentTarget.current, tangent, creature, swim)
          // Turn purely on the body-length arc radius at the current swim speed. The old
          // fixed-degrees cap turned slower than the radius implied, which meant an even
          // wider effective radius than configured — so the shark swept along tank
          // boundaries instead of completing a forward arc.
          rotateDirectionToward(tangent, agentMoveDirection, soloTurnRadiusStep)
        }

        // Authored behaviors (e.g. the mola sun-bask approach/exit) own the steering
        // outright — boid forces are suppressed so they never nudge the animation off
        // its path. The bask hold stage above already bypasses boids entirely.
        const authoredBehaviorActive = agentBehavior.current?.type === 'sun-bask'
        if (!authoredBehaviorActive) {
          if (now >= boidDecisionNextAt.current) {
            computeBoidSteering(committedBoidSteering.current, fish, creature, swim, school, tangent, boidDebugState.current)
            boidDecisionNextAt.current = now + boidDecisionInterval(model, animationRef.current, boidDecisionJitter.current)
          }
          smoothedBoidSteering.current.lerp(committedBoidSteering.current, 1 - Math.exp(-delta * BOID_STEERING_SMOOTHING))
          if (smoothedBoidSteering.current.lengthSq() > 0.000001) {
            targetDesiredDirection.copy(tangent).add(smoothedBoidSteering.current)
            if (targetDesiredDirection.lengthSq() > 0.0001) {
              rotateDirectionToward(tangent, targetDesiredDirection.normalize(), soloTurnRadiusStep)
            }
          }
        } else {
          // Keep the committed vector decaying so it does not snap back in when the
          // authored behavior ends.
          smoothedBoidSteering.current.multiplyScalar(Math.exp(-delta * BOID_STEERING_SMOOTHING))
        }

        desiredDirection.current.copy(tangent)
        agentMoveDirection.copy(tangent)
        const soloAgentSpeed = Number.isFinite(velocity.current) && velocity.current > 0 ? velocity.current : motion.idleSpeed
        const sunBaskApproaching = agentBehavior.current?.type === 'sun-bask' && agentBehavior.current.stage === 'approach'
        let approachSpeedScale = 1
        if (sunBaskApproaching) {
          const plannedDistance = Math.max(0.001, agentBehavior.current.approachDistance ?? 0)
          const remainingDistance = agentHasTarget.current ? fish.position.distanceTo(agentTarget.current) : 0
          const progressToBask = THREE.MathUtils.clamp(1 - (remainingDistance / plannedDistance), 0, 1)
          const decelAlpha = THREE.MathUtils.clamp(
            (progressToBask - MOLA_SUN_BASK_APPROACH_DECEL_START) / Math.max(0.001, 1 - MOLA_SUN_BASK_APPROACH_DECEL_START),
            0,
            1,
          )
          const easedDecel = decelAlpha * decelAlpha * (3 - 2 * decelAlpha)
          approachSpeedScale = THREE.MathUtils.lerp(1, MOLA_SUN_BASK_APPROACH_MIN_SPEED_SCALE, easedDecel)
        } else if (agentBehavior.current?.type === 'sun-bask' && agentBehavior.current.stage === 'exit') {
          const exitElapsed = Math.max(0, now - (agentBehavior.current.stageStartedAt ?? agentBehaviorStartedAt.current))
          approachSpeedScale = THREE.MathUtils.smoothstep(exitElapsed, 0, MOLA_SUN_BASK_EXIT_SPEED_RAMP_DURATION)
        }
        const movementScale = soloAgentSpeed * approachSpeedScale * organicMotion.speedScale * delta
        fish.position.addScaledVector(agentMoveDirection, movementScale)
        const surfaceYMax = agentBehavior.current?.type === 'sun-bask'
          ? molaSunBaskSurfaceCenterYMax(creature, swim, bounds)
          : null
        clampToMolaSurfaceCeiling(fish.position, creature, swim, bounds, agentMoveDirection, surfaceYMax)
        if (!isMolaCreature(creature)) {
          // Mako: gentle boundary handling applied every frame — even while the follow cam is on
          // it. Surface ceiling + a plain clamp back into the runtime envelope, letting steering
          // and boundary-avoidance carve the heading away over the next frames. Because this keeps
          // the mako inside its envelope continuously (no teleport, no snap-retarget), the follow
          // cam no longer needs to be kicked out when it reaches an edge.
          clampToSurfaceCeiling(fish.position, agentMoveDirection, SURFACE_PLANE_Y - SOLO_AGENT_SURFACE_CLEARANCE)
          clampToSoloAgentRuntimeEnvelope(fish.position, bounds, bodyLength, creature)
        }
        const recoveryNeeded = clampToSoloAgentRuntimeEnvelope(agentRuntimeEnvelopeProbe.copy(fish.position), bounds, bodyLength, creature)
        // Only the mola's recovery is disruptive enough (snap-back / negative-Z fade-out) to
        // warrant dropping the follow cam. The mako is handled gently above and stays trackable,
        // so following it no longer gets interrupted with a "back in a bit" every time it roams
        // to an envelope edge.
        if (isMolaCreature(creature) && zoomActive && selected && recoveryNeeded && now - lastFollowRecoveryExitAt.current > 1.0) {
          lastFollowRecoveryExitAt.current = now
          onRuntimeRecoveryNeeded?.(creature)
        }
        const runtimeRecoveryEnabled = !zoomActive && soloRuntimeRecoveryEnabled
        const fadeState = runtimeRecoveryFade.current
        const molaFadeOutReady = runtimeRecoveryEnabled
          && isMolaCreature(creature)
          && fadeState.phase === 'fade-out'
          && now - fadeState.startedAt >= MOLA_RUNTIME_RECOVERY_FADE_OUT_DURATION
        if (molaFadeOutReady) {
          agentRuntimeClamp.copy(fish.position)
          clampToSwimBounds(agentRuntimeClamp, bounds)
          agentMoveDirection.subVectors(agentRuntimeClamp, fish.position)
          if (agentMoveDirection.lengthSq() > 0.0001) desiredDirection.current.copy(agentMoveDirection.normalize())
          fish.position.copy(agentRuntimeClamp)
          agentBehavior.current = null
          agentHasTarget.current = false
          agentBehaviorDistance.current = 0
          nextAgentRetargetAt.current = now
          runtimeRecoveryFade.current = { phase: 'fade-in', startedAt: now }
        } else if (runtimeRecoveryEnabled && recoveryNeeded) {
          const negativeZRecoveryNeeded = isNegativeZRuntimeEnvelopeExit(fish.position, bounds, bodyLength, creature)
          if (isMolaCreature(creature) && negativeZRecoveryNeeded) {
            if (fadeState.phase !== 'fade-out' && fadeState.phase !== 'fade-in') {
              runtimeRecoveryFade.current = { phase: 'fade-out', startedAt: now }
            }
          } else {
            // Mola snap-and-retarget recovery — its authored surface/depth behaviour relies on
            // being reset to the envelope edge here. (The mako is clamped gently every frame
            // above, so it never reaches this branch.)
            agentRuntimeClamp.copy(fish.position)
            clampToSoloAgentRuntimeEnvelope(agentRuntimeClamp, bounds, bodyLength, creature)
            fish.position.copy(agentRuntimeClamp)
            agentBehavior.current = null
            agentHasTarget.current = false
            agentBehaviorDistance.current = 0
            nextAgentRetargetAt.current = now
            runtimeRecoveryFade.current = { phase: 'idle', startedAt: 0 }
          }
        }
        agentBehaviorDistance.current += movementScale
      }
      followTarget.current.copy(fish.position).addScaledVector(agentMoveDirection, followDistance)
      tangent.subVectors(fish.position, previousPosition.current)
      if (tangent.lengthSq() > 0.000001) tangent.normalize()
      else tangent.copy(agentMoveDirection)
    } else {
      // --- Boids schooling movement ---
      // No spline, no follow-target distance cap. Steer toward the shared roaming goal
      // (already biased by this member's formation offset in followTarget), blended with
      // first-class boid forces, capped to a body-length turn arc, then integrate velocity
      // freely — so the target can never pin the fish in place the way the old spline
      // endpoint did.
      previousPosition.current.copy(fish.position)
      const schoolBounds = swimBounds(creature.depthZone, swim, creature.size ?? 1)

      // Leader maintains the shared school centroid + migration direction, and advances the
      // goal once the group's centroid reaches it.
      if (isSchoolLeader) {
        let cx = 0, cy = 0, cz = 0, cn = 0
        FISH_REGISTRY.forEach(entry => {
          if (entry.schoolId === school.id) { cx += entry.position.x; cy += entry.position.y; cz += entry.position.z; cn += 1 }
        })
        if (cn > 0) schoolState.centroid.set(cx / cn, cy / cn, cz / cn)
        const reached = Math.max(bodyLength * SCHOOL_GOAL_REACHED_BODY_LENGTHS, SCHOOL_GOAL_REACHED_MIN)
        if (schoolState.centroid.distanceTo(schoolState.goal) <= reached) {
          const heading = desiredDirection.current.lengthSq() > 0.0001 ? desiredDirection.current : tangent
          pickSoloAgentContinuationTarget(schoolState.goal, creature, swim, schoolState.rand, schoolState.centroid, heading)
          // Inset the goal from the walls so a wide-turning school (big fish, tight bounds)
          // banks away early instead of driving into a boundary it can't out-turn and thrashing.
          const gm = Math.min(bodyLength * 2, (schoolBounds.zMax - schoolBounds.zMin) * 0.28)
          schoolState.goal.x = THREE.MathUtils.clamp(schoolState.goal.x, schoolBounds.xMin + gm, schoolBounds.xMax - gm)
          schoolState.goal.y = THREE.MathUtils.clamp(schoolState.goal.y, schoolBounds.yMin + gm * 0.5, schoolBounds.yMax - gm * 0.5)
          schoolState.goal.z = THREE.MathUtils.clamp(schoolState.goal.z, schoolBounds.zMin + gm, schoolBounds.zMax - gm)
        }
        // Shared direction (goal - centroid), identical for every member, low-pass filtered so
        // frame-to-frame goal jitter doesn't accumulate into a constant turn.
        nextPoint.subVectors(schoolState.goal, schoolState.centroid)
        if (nextPoint.lengthSq() > 1e-6) {
          nextPoint.normalize()
          if (schoolState.migrationDir.lengthSq() < 1e-6) schoolState.migrationDir.copy(nextPoint)
          else schoolState.migrationDir.lerp(nextPoint, 1 - Math.exp(-delta * SCHOOL_MIGRATION_SMOOTH))
          if (schoolState.migrationDir.lengthSq() > 1e-6) schoolState.migrationDir.normalize()
          else schoolState.migrationDir.copy(nextPoint)
        } else if (schoolState.migrationDir.lengthSq() < 1e-6) {
          schoolState.migrationDir.set(0, 0, -1)
        }
      }

      // Shared migration direction (leader-computed) — parallel travel, never a funnel.
      schoolFollowDirection.copy(schoolState.migrationDir)
      if (schoolFollowDirection.lengthSq() < 1e-6) {
        schoolFollowDirection.subVectors(schoolState.goal, fish.position)
        if (schoolFollowDirection.lengthSq() > 1e-6) schoolFollowDirection.normalize()
        else schoolFollowDirection.set(0, 0, -1)
      }
      // This member's formation slot, placed in the travel frame around the school centroid
      // (right = perpendicular to heading in XZ, up = world Y). Anchoring the shape here means
      // a single-file line is no longer an equilibrium, so the ball keeps its width.
      const hx = schoolFollowDirection.x, hz = schoolFollowDirection.z
      schoolBasePosition.copy(schoolState.centroid)
      schoolBasePosition.x += hz * schoolOffset.lateral + hx * schoolOffset.longitudinal
      schoolBasePosition.z += -hx * schoolOffset.lateral + hz * schoolOffset.longitudinal
      schoolBasePosition.y += schoolOffset.vertical
      // Desired heading = migration urge + pull toward the formation slot. The slot pull is
      // scaled down for tiny schools: with only a couple of members the slots sit right beside
      // the centroid, so a strong pull makes the pair orbit their slots (a constant curve that
      // cocks the tail). A pair instead just travels parallel on the shared migration + boid
      // separation; big schools get the full formation shaping.
      const formationWeight = SCHOOL_FORMATION_WEIGHT * THREE.MathUtils.clamp((school.count - 2) / 6, 0.1, 1)
      agentMoveDirection.copy(schoolFollowDirection).multiplyScalar(SCHOOL_MIGRATION_WEIGHT)
      targetDesiredDirection.subVectors(schoolBasePosition, fish.position)
      if (targetDesiredDirection.lengthSq() > 1e-6) {
        agentMoveDirection.addScaledVector(targetDesiredDirection.normalize(), formationWeight)
      }
      if (agentMoveDirection.lengthSq() < 1e-6) agentMoveDirection.copy(schoolFollowDirection)
      agentMoveDirection.normalize()
      // Boundary shaping via a projected lookahead point.
      followTarget.current.copy(fish.position).addScaledVector(agentMoveDirection, bodyLength * 6)
      shapeSoloAgentSteeringDesired(agentMoveDirection, fish.position, followTarget.current, tangent, creature, swim)

      // Boid forces as a first-class steering input (separation / alignment / cohesion / threat).
      if (now >= boidDecisionNextAt.current) {
        computeBoidSteering(committedBoidSteering.current, fish, creature, swim, school, agentMoveDirection, boidDebugState.current)
        boidDecisionNextAt.current = now + boidDecisionInterval(model, animationRef.current, boidDecisionJitter.current)
      }
      smoothedBoidSteering.current.lerp(committedBoidSteering.current, 1 - Math.exp(-delta * BOID_STEERING_SMOOTHING))
      // agentMoveDirection is already the migration+formation heading (unit); add boid forces
      // (separation/threat) on top for anti-overlap and predator avoidance.
      targetDesiredDirection.copy(agentMoveDirection).add(smoothedBoidSteering.current)
      if (targetDesiredDirection.lengthSq() > 0.0001) targetDesiredDirection.normalize()
      else targetDesiredDirection.copy(agentMoveDirection)

      if (desiredDirection.current.lengthSq() < 0.0001) desiredDirection.current.copy(targetDesiredDirection)

      // Spine bend intent: signed yaw between current and desired heading.
      const turnIntentScale = Number.isFinite(model?.curveDeform?.turnIntentScale)
        ? model.curveDeform.turnIntentScale
        : 0
      if (turnIntentScale > 0) {
        const turnIntent = desiredDirection.current.z * targetDesiredDirection.x - desiredDirection.current.x * targetDesiredDirection.z
        curveDeformTurnIntent.current = THREE.MathUtils.clamp(turnIntent * turnIntentScale, -1, 1)
      }

      // Turn no faster than a body-length arc allows at the current speed; tighten near walls.
      const forwardSpeed = velocity.current * organicMotion.speedScale
      let turnStep = maxTurnRadiansForSpeed(swim, bodyLength, forwardSpeed, delta)
      turnStep = boundaryAvoidanceTurnStep(turnStep, fish.position, desiredDirection.current, schoolBounds, swim, bodyLength, forwardSpeed, delta)
      rotateDirectionToward(desiredDirection.current, targetDesiredDirection, turnStep)

      // Integrate velocity along the heading — no follow-target distance cap.
      const movementScale = velocity.current * organicMotion.speedScale * delta
      agentMoveDirection.copy(desiredDirection.current)
      fish.position.addScaledVector(agentMoveDirection, movementScale)
      clampToSwimBounds(fish.position, schoolBounds)

      tangent.subVectors(fish.position, previousPosition.current)
      if (tangent.lengthSq() > 0.000001) tangent.normalize()
      else tangent.copy(desiredDirection.current)
    }

    if (showAgentDebug) {
      const behavior = agentBehavior.current
      agentStatus.current = behavior?.type === 'sun-bask'
        ? `sun-bask ${behavior.stage}`
        : (behavior?.type ?? 'choose-behavior')
    }

    updateFishRegistry(fish, creature, swim, school, desiredDirection.current)

    let runtimeRecoveryOpacity = 1
    let recoveryFadeState = runtimeRecoveryFade.current
    if (recoveryFadeState.phase === 'fade-out' && now - recoveryFadeState.startedAt >= MOLA_RUNTIME_RECOVERY_FADE_OUT_DURATION + 0.25) {
      runtimeRecoveryFade.current = { phase: 'fade-in', startedAt: now }
      recoveryFadeState = runtimeRecoveryFade.current
    }
    if (recoveryFadeState.phase === 'fade-out') {
      runtimeRecoveryOpacity = 1 - THREE.MathUtils.smoothstep(
        now - recoveryFadeState.startedAt,
        0,
        MOLA_RUNTIME_RECOVERY_FADE_OUT_DURATION,
      )
    } else if (recoveryFadeState.phase === 'fade-in') {
      runtimeRecoveryOpacity = THREE.MathUtils.smoothstep(
        now - recoveryFadeState.startedAt,
        0,
        MOLA_RUNTIME_RECOVERY_FADE_IN_DURATION,
      )
      if (now - recoveryFadeState.startedAt >= MOLA_RUNTIME_RECOVERY_FADE_IN_DURATION) {
        runtimeRecoveryFade.current = { phase: 'idle', startedAt: 0 }
        runtimeRecoveryOpacity = 1
      }
    }

    const fade = depthFadeFromScreenZ(fish.position.z)
    fish.traverse(child => {
      if (!child.isMesh || child.userData?.interactionProxy) return
      const materials = Array.isArray(child.material) ? child.material : [child.material]
      materials.filter(Boolean).forEach(material => {
        if (model) {
          material.transparent = runtimeRecoveryOpacity < 0.999
          material.opacity = runtimeRecoveryOpacity
          if ('depthWrite' in material) material.depthWrite = runtimeRecoveryOpacity >= 0.999
          if ('envMapIntensity' in material) material.envMapIntensity = THREE.MathUtils.lerp(0.45, 0.95, fade)
          return
        }

        material.transparent = runtimeRecoveryOpacity < 0.999
        material.opacity = runtimeRecoveryOpacity
        if ('depthWrite' in material) material.depthWrite = runtimeRecoveryOpacity >= 0.999
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

    if (showAgentDebug || !SPLINE_MOVEMENT_ENABLED) {
      splineVisualTangent.subVectors(followTarget.current, fish.position)
      if (splineVisualTangent.lengthSq() < 0.0001) splineVisualTangent.copy(tangent)
      else splineVisualTangent.normalize()
    } else {
      currentPath.getTangentAt(t, splineVisualTangent).normalize()
    }
    // Pitch reflects ACTUAL vertical travel this frame, not the direction to the target.
    // A creature genuinely swimming up/down to a higher/lower destination pitches into it,
    // but one hovering along the XZ plane (e.g. blocked under the surface, or a target it
    // is not vertically closing on) stays level — no swim-bladder-dysfunction look.
    frameMove.subVectors(fish.position, previousPosition.current)
    const frameHorizontalMove = Math.hypot(frameMove.x, frameMove.z)
    // Weight pitch by how fast the fish is actually swimming forward relative to its own cruise
    // speed, so a near-stopped fish stays level instead of pitching on residual vertical bob.
    const horizontalSpeed = frameHorizontalMove / Math.max(delta, 1e-4)
    const pitchSpeedReference = Math.max(1e-3, motion.idleSpeed)
    const pitchSpeedWeight = THREE.MathUtils.smoothstep(
      horizontalSpeed,
      pitchSpeedReference * PITCH_FADE_SPEED_FRACTION_LO,
      pitchSpeedReference * PITCH_FADE_SPEED_FRACTION_HI,
    )
    const targetVisualPitch = pitchSpeedWeight * ((frameHorizontalMove > 1e-4 || Math.abs(frameMove.y) > 1e-4)
      ? THREE.MathUtils.clamp(Math.atan2(frameMove.y, Math.max(frameHorizontalMove, 1e-4)), -pitchLimit, pitchLimit)
      : 0)
    if (!hasVisualForward.current) {
      visualPitch.current = targetVisualPitch
    } else {
      visualPitch.current = THREE.MathUtils.damp(
        visualPitch.current,
        targetVisualPitch,
        VISUAL_PITCH_RESPONSE,
        delta,
      )
    }
    setForwardWithPitch(rawVisualForward, horizontalForward, visualPitch.current)

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
    if (agentBehavior.current?.type === 'sun-bask'
      && (agentBehavior.current.stage === 'hold' || agentBehavior.current.stage === 'exit')
      && agentBehavior.current.holdForward?.lengthSq?.() > 0.0001) {
      const behavior = agentBehavior.current
      const stageElapsed = Math.max(0, now - (behavior.stageStartedAt ?? agentBehaviorStartedAt.current))
      const freezeAlpha = behavior.stage === 'hold'
        ? THREE.MathUtils.smoothstep(stageElapsed, 0, MOLA_SUN_BASK_LOOK_AT_ENTER_BLEND_DURATION)
        : 1 - THREE.MathUtils.smoothstep(stageElapsed, 0, MOLA_SUN_BASK_LOOK_AT_EXIT_BLEND_DURATION)
      pitchedForward.lerpVectors(visualForward.current, behavior.holdForward, freezeAlpha).normalize()
      visualForward.current.copy(pitchedForward)
    }

    if (debug) {
      const showDirection = debugLayers?.direction ?? true
      const showName = debugLayers?.name ?? true
      const effectiveDebugVelocity = velocity.current * organicMotion.speedScale
      const effectiveDebugSpeedMeters = effectiveDebugVelocity * WORLD_UNIT_METERS
      const debugVectorLength = DEBUG_FORWARD_MIN_LENGTH + effectiveDebugVelocity * DEBUG_FORWARD_SPEED_SCALE
      debugForwardStart.copy(fish.position).addScaledVector(pitchedForward, debugForwardOffset(creature, swim, model))
      debugForwardEnd.copy(debugForwardStart).addScaledVector(pitchedForward, debugVectorLength)
      updateDebugLine(forwardLineRef, debugForwardStart, debugForwardEnd)
      if (forwardLineRef.current) forwardLineRef.current.visible = showDirection && !showAgentDebug
      const showBoidDebug = showDirection && (selected || showAgentDebug)
      const boidDebug = boidDebugState.current
      updateDebugVectorLine(boidSeparationLineRef, debugForwardStart, boidDebug.separation, DEBUG_BOID_VECTOR_SCALE)
      updateDebugVectorLine(boidAlignmentLineRef, debugForwardStart, boidDebug.alignment, DEBUG_BOID_VECTOR_SCALE)
      updateDebugVectorLine(boidCohesionLineRef, debugForwardStart, boidDebug.cohesion, DEBUG_BOID_VECTOR_SCALE)
      updateDebugVectorLine(boidThreatLineRef, debugForwardStart, boidDebug.threat, DEBUG_BOID_VECTOR_SCALE)
      updateDebugVectorLine(boidResultLineRef, debugForwardStart, smoothedBoidSteering.current, DEBUG_BOID_VECTOR_SCALE)
      if (boidSeparationLineRef.current) boidSeparationLineRef.current.visible = showBoidDebug && boidDebug.separation.lengthSq() > 0.000001
      if (boidAlignmentLineRef.current) boidAlignmentLineRef.current.visible = showBoidDebug && boidDebug.alignment.lengthSq() > 0.000001
      if (boidCohesionLineRef.current) boidCohesionLineRef.current.visible = showBoidDebug && boidDebug.cohesion.lengthSq() > 0.000001
      if (boidThreatLineRef.current) boidThreatLineRef.current.visible = showBoidDebug && boidDebug.threat.lengthSq() > 0.000001
      if (boidResultLineRef.current) boidResultLineRef.current.visible = showBoidDebug && smoothedBoidSteering.current.lengthSq() > 0.000001

      // Neighbor connectors (colored by relation) + heading ticks, tracking live positions.
      // Only drawn for the focused fish (selected or agent-debug) so one individual's
      // perception is legible instead of every sampled fish webbing the whole school.
      const showNeighborWeb = showBoidDebug && (selected || showAgentDebug)
      const headingTickLength = Math.max(0.35, bodyLength * 0.9)
      for (let n = 0; n < BOID_MAX_DEBUG_NEIGHBORS; n += 1) {
        const connector = boidNeighborLineRefs.current[n]
        const headingTick = boidNeighborHeadingRefs.current[n]
        const active = showNeighborWeb && n < boidDebug.neighborActive
        if (connector) {
          if (active) {
            const slot = boidDebug.neighbors[n]
            const live = FISH_REGISTRY.get(slot.id)
            debugNeighborEnd.copy(live?.position ?? slot.pos)
            updateDebugLine({ current: connector }, debugForwardStart, debugNeighborEnd)
            const color = BOID_RELATION_COLORS[slot.relation] ?? BOID_RELATION_COLORS.neutral
            if (connector.material?.color) connector.material.color.copy(color)
            if (headingTick) {
              debugNeighborStart.copy(debugNeighborEnd)
              debugNeighborHeadingEnd.copy(debugNeighborStart).addScaledVector(live?.forward ?? slot.forward, headingTickLength)
              updateDebugLine({ current: headingTick }, debugNeighborStart, debugNeighborHeadingEnd)
              headingTick.visible = true
            }
          } else if (headingTick) {
            headingTick.visible = false
          }
          connector.visible = active
        }
      }
      if (boidLabelRef.current) {
        boidLabelRef.current.position.copy(debugForwardStart).addScaledVector(up, 0.30 + size * 0.06)
        boidLabelRef.current.text = `boid n${boidDebug.neighborCount} social ${boidDebug.socialWeightTotal.toFixed(1)}\nsep ${boidDebug.separation.length().toFixed(2)} align ${boidDebug.alignment.length().toFixed(2)} coh ${boidDebug.cohesion.length().toFixed(2)} threat ${boidDebug.threat.length().toFixed(2)} out ${smoothedBoidSteering.current.length().toFixed(2)}`
        boidLabelRef.current.lookAt(camera.position)
        boidLabelRef.current.visible = showBoidDebug
      }
      if (speedLabelRef.current) {
        speedLabelRef.current.position.copy(debugForwardEnd).addScaledVector(up, 0.14)
        speedLabelRef.current.text = `${effectiveDebugSpeedMeters.toFixed(2)} m/s`
        speedLabelRef.current.lookAt(camera.position)
        speedLabelRef.current.visible = showDirection && !showAgentDebug
      }
      if (agentLabelRef.current) {
        const bodyLength = creatureBodyLength(creature, swim)
        const status = agentStatus.current
        const displayName = creature.customName?.trim() || species?.name || creature.species || 'Unknown'
        const scientificName = species?.scientificName ?? '—'
        labelPosition.current.copy(fish.position).addScaledVector(up, bodyLength * 0.46 + 0.28)
        agentLabelRef.current.position.copy(labelPosition.current)
        const currentAnimation = animationRef.current ?? '—'
        const queuedAction = sunBaskQueued.current ? 'sun-bask' : 'none'
        agentLabelRef.current.text = `${creature.id ?? '?'} • ${displayName}\n${scientificName}\nspeed ${effectiveDebugSpeedMeters.toFixed(2)} m/s\n${status} • ${currentAnimation}\nqueue ${queuedAction}`
        agentLabelRef.current.lookAt(camera.position)
        agentLabelRef.current.visible = showDirection && showAgentDebug
      }
      if (nameLabelRef.current) {
        nameLabelRef.current.position.copy(fish.position).addScaledVector(up, creatureBodyLength(creature, swim) * 0.16 + 0.045)
        nameLabelRef.current.lookAt(camera.position)
        // World-space text shrinks with distance, so far-off labels became unreadable.
        // Scale ~linearly with camera distance to hold a roughly constant on-screen size,
        // clamped so it neither vanishes far away nor overwhelms up close.
        const nameLabelDistance = fish.position.distanceTo(camera.position)
        nameLabelRef.current.scale.setScalar(THREE.MathUtils.clamp(nameLabelDistance * DEBUG_LABEL_DISTANCE_SCALE, 0.85, 3.2))
        nameLabelRef.current.visible = showName && !showAgentDebug
      }
    }

    if (model) {
      const smoothMolaLookAt = isSoloAgent && isMolaCreature(creature)
      const currentLookBehaviorKey = smoothMolaLookAt
        ? `${agentBehavior.current?.type ?? 'idle'}:${agentBehavior.current?.stage ?? agentBehavior.current?.completion ?? 'none'}`
        : ''
      if (currentLookBehaviorKey !== lookBehaviorKey.current) {
        lookBehaviorKey.current = currentLookBehaviorKey
        lookBehaviorTransitionStartedAt.current = now
      }

      fish.up.copy(up)
      lookTarget.copy(fish.position).addScaledVector(pitchedForward, -1)
      fish.lookAt(lookTarget)
      targetLookQuaternion.copy(fish.quaternion)
      if (!hasBaseLookQuaternion.current) {
        baseLookQuaternion.current.copy(targetLookQuaternion)
        hasBaseLookQuaternion.current = true
      } else if (smoothMolaLookAt) {
        const transitionElapsed = now - lookBehaviorTransitionStartedAt.current
        const transitionAlpha = 1 - THREE.MathUtils.smoothstep(
          transitionElapsed,
          0,
          MOLA_BEHAVIOR_LOOK_AT_TRANSITION_DURATION,
        )
        const lookResponse = THREE.MathUtils.lerp(
          MOLA_BEHAVIOR_LOOK_AT_RESPONSE,
          MOLA_BEHAVIOR_LOOK_AT_TRANSITION_RESPONSE,
          transitionAlpha,
        )
        baseLookQuaternion.current.slerp(targetLookQuaternion, 1 - Math.exp(-delta * lookResponse))
      } else {
        baseLookQuaternion.current.copy(targetLookQuaternion)
      }
      fish.quaternion.copy(baseLookQuaternion.current)
      if (agentBehavior.current?.type === 'sun-bask') {
        const behavior = agentBehavior.current
        const stageElapsed = Math.max(0, now - (behavior.stageStartedAt ?? agentBehaviorStartedAt.current))
        const rollAlpha = behavior.stage === 'approach'
          ? (() => {
              const plannedDistance = Math.max(0.001, behavior.approachDistance ?? 0)
              const remainingDistance = agentHasTarget.current ? fish.position.distanceTo(agentTarget.current) : 0
              const distanceProgress = plannedDistance > 0.001
                ? 1 - (remainingDistance / plannedDistance)
                : agentBehaviorDistance.current / Math.max(0.001, agentBehaviorDistance.current + remainingDistance)
              const progress = THREE.MathUtils.clamp(distanceProgress, 0, 1)
              const delayedProgress = THREE.MathUtils.clamp(
                (progress - MOLA_SUN_BASK_ROLL_PROGRESS_START) / Math.max(0.001, 1 - MOLA_SUN_BASK_ROLL_PROGRESS_START),
                0,
                1,
              )
              const easedProgress = delayedProgress * delayedProgress * delayedProgress * (delayedProgress * (delayedProgress * 6 - 15) + 10)
              return easedProgress * MOLA_SUN_BASK_APPROACH_MAX_ROLL_ALPHA
            })()
          : (behavior.stage === 'hold'
            ? (() => {
                const completionAlpha = THREE.MathUtils.clamp(stageElapsed / MOLA_SUN_BASK_HOLD_ROLL_COMPLETE_DURATION, 0, 1)
                const easedCompletion = completionAlpha * completionAlpha * (3 - 2 * completionAlpha)
                return THREE.MathUtils.lerp(behavior.holdStartRollAlpha ?? MOLA_SUN_BASK_APPROACH_MAX_ROLL_ALPHA, 1, easedCompletion)
              })()
            : (behavior.stage === 'exit'
              ? (() => {
                  const exitAlpha = THREE.MathUtils.clamp(stageElapsed / MOLA_SUN_BASK_EXIT_ROLL_DURATION, 0, 1)
                  const easedExit = exitAlpha * exitAlpha * (3 - 2 * exitAlpha)
                  return THREE.MathUtils.lerp(behavior.exitStartRollAlpha ?? 1, 0, easedExit)
                })()
              : 0))
        bankQuaternion.setFromAxisAngle(pitchedForward, (behavior.side ?? 1) * Math.PI * 0.5 * rollAlpha)
        fish.quaternion.premultiply(bankQuaternion)
        if (behavior.stage === 'hold' || behavior.stage === 'exit') {
          const driftElapsed = Math.max(0, now - (behavior.stageStartedAt ?? agentBehaviorStartedAt.current))
          const driftIntroAlpha = behavior.stage === 'hold'
            ? THREE.MathUtils.smoothstep(driftElapsed, 0, MOLA_SUN_BASK_DRIFT_INTRO_DURATION)
            : 1
          const driftFade = behavior.stage === 'exit'
            ? 1 - THREE.MathUtils.clamp(stageElapsed / MOLA_SUN_BASK_EXIT_ROLL_DURATION, 0, 1)
            : driftIntroAlpha
          const yawDrift = behavior.stage === 'exit'
            ? (behavior.exitStartYawDrift ?? 0) * driftFade
            : Math.sin(driftElapsed * 0.19 + motion.bobPhase * 1.7) * MOLA_SUN_BASK_DRIFT_YAW_AMPLITUDE * driftFade
          const rollDrift = behavior.stage === 'exit'
            ? (behavior.exitStartRollDrift ?? 0) * driftFade
            : Math.sin(driftElapsed * 0.27 + motion.bobPhase * 2.3 + 1.1) * MOLA_SUN_BASK_DRIFT_ROLL_AMPLITUDE * driftFade
          bankQuaternion.setFromAxisAngle(up, yawDrift)
          fish.quaternion.premultiply(bankQuaternion)
          bankQuaternion.setFromAxisAngle(pitchedForward, rollDrift)
          fish.quaternion.premultiply(bankQuaternion)
        }
      }
    } else {
      lookTarget.copy(fish.position).add(pitchedForward)
      fish.lookAt(lookTarget)
      fish.rotateY(Math.PI / 2)
    }

    const pitch = THREE.MathUtils.clamp(pitchedForward.y * 0.55, -0.22, 0.22)
    if (!model) fish.rotateZ(pitch)
    fish.up.lerp(up, 0.18)

    if (debug && canInstanceSardine && typeof window !== 'undefined') {
      const stats = window[SARDINE_DEBUG_GLOBAL] ?? { frames: 0, samples: [] }
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
      window[SARDINE_DEBUG_GLOBAL] = stats
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
      const animationForward = pitchedForward
      let turn = 0
      if (previousTangent.current.lengthSq() > 0) {
        turn = previousTangent.current.z * animationForward.x - previousTangent.current.x * animationForward.z
      }
      if (previousTangent.current.lengthSq() > 0 && now > animationCooldown.current && now > animationHoldUntil.current) {
        let triggeredAction = false
        if (turn > motion.turnTriggerThreshold) {
          const turnDuration = motion.turnActionDuration
          const turnAnimation = resolveMoveAnimation(model, 'turnLeft')
          const turnAnimationDuration = modelActionAnimationDuration(model, turnAnimation, turnDuration)
          playAnimation(turnAnimation)
          playSwimSfx('turn', THREE.MathUtils.clamp(Math.abs(turn) * 34, 0.34, 0.88), now)
          actionSpeedStartAt.current = now
          actionSpeedUntil.current = now + turnDuration
          actionSpeedTarget.current = motion.snapSpeed
          animationHoldUntil.current = now + turnAnimationDuration
          animationCooldown.current = now + Math.max(0.7, turnAnimationDuration * 0.72)
          driftUntil.current = 0
          triggeredAction = true
        } else if (turn < -motion.turnTriggerThreshold) {
          const turnDuration = motion.turnActionDuration
          const turnAnimation = resolveMoveAnimation(model, 'turnRight')
          const turnAnimationDuration = modelActionAnimationDuration(model, turnAnimation, turnDuration)
          playAnimation(turnAnimation)
          playSwimSfx('turn', THREE.MathUtils.clamp(Math.abs(turn) * 34, 0.34, 0.88), now)
          actionSpeedStartAt.current = now
          actionSpeedUntil.current = now + turnDuration
          actionSpeedTarget.current = motion.snapSpeed
          animationHoldUntil.current = now + turnAnimationDuration
          animationCooldown.current = now + Math.max(0.7, turnAnimationDuration * 0.72)
          driftUntil.current = 0
          triggeredAction = true
        } else if (Math.abs(turn) < BURST_STRAIGHT_THRESHOLD && now > nextBurstAt.current) {
          const burstDuration = motion.burstActionDuration
          const burstAnimation = resolveMoveAnimation(model, 'burst')
          const burstAnimationDuration = modelActionAnimationDuration(model, burstAnimation, burstDuration)
          const burstMovementDelay = modelActionMovementDelay(model, burstAnimation)
          playAnimation(burstAnimation)
          playSwimSfx('burst', THREE.MathUtils.clamp(motion.burstSpeed / Math.max(0.001, motion.idleSpeed) * 0.18, 0.42, 1), now)
          actionSpeedStartAt.current = now + burstMovementDelay
          actionSpeedUntil.current = actionSpeedStartAt.current + burstDuration
          actionSpeedTarget.current = motion.burstSpeed
          animationHoldUntil.current = now + burstAnimationDuration
          animationCooldown.current = now + Math.max(1.0, burstAnimationDuration * 0.65)
          nextBurstAt.current = now + motion.burstInterval
          driftUntil.current = 0
          triggeredAction = true
        }

        if (!triggeredAction) {
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

      curveDeformInputRef.current.turn = THREE.MathUtils.clamp(turn * 10.5 + curveDeformTurnIntent.current, -1, 1)
      curveDeformInputRef.current.speed01 = THREE.MathUtils.clamp(velocity.current / Math.max(0.001, motion.burstSpeed), 0, 1)
      // Actual forward travel this frame vs the intended cruise rate. Movement is
      // clamped to the follow-target distance, so a fish crawling out of a turn reads
      // slow here even though velocity.current still says "cruise". Curve-deform uses
      // this to straighten the tail before the fish resumes swimming forward.
      const actualForwardSpeed = frameMove.length() / Math.max(1e-4, delta)
      const cruiseSpeedRef = Math.max(1e-3, motion.idleSpeed * organicMotion.speedScale)
      curveDeformSpeedEase.current = THREE.MathUtils.damp(
        curveDeformSpeedEase.current,
        THREE.MathUtils.clamp(actualForwardSpeed / cruiseSpeedRef, 0, 1),
        6,
        delta,
      )
      curveDeformInputRef.current.speedEase01 = curveDeformSpeedEase.current
      curveDeformInputRef.current.burst01 = activeAnimation === resolveMoveAnimation(model, 'burst')
        ? THREE.MathUtils.clamp((animationHoldUntil.current - now) / Math.max(0.001, modelActionAnimationDuration(model, activeAnimation, motion.burstActionDuration)), 0, 1)
        : 0

      const suppressProceduralBank = agentBehavior.current?.type === 'sun-bask'
      const bank = suppressProceduralBank ? 0 : THREE.MathUtils.clamp(turn * 4, -MAX_MODEL_BANK, MAX_MODEL_BANK)
      bankQuaternion.setFromAxisAngle(pitchedForward, -bank)
      fish.quaternion.premultiply(bankQuaternion)

      previousTangent.current.copy(animationForward)
    }
  })

  const focusScale = 1
  const bodyLength = creatureBodyLength(creature, swim)
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
          <line ref={forwardLineRef} geometry={forwardDebugGeometry} raycast={() => null}>
            <lineBasicMaterial color="#ff4fd8" transparent opacity={0.95} depthTest={false} depthWrite={false} />
          </line>
          <line ref={boidSeparationLineRef} geometry={boidSeparationGeometry} raycast={() => null}>
            <lineBasicMaterial color="#ff5a36" transparent opacity={0.95} depthTest={false} depthWrite={false} />
          </line>
          <line ref={boidAlignmentLineRef} geometry={boidAlignmentGeometry} raycast={() => null}>
            <lineBasicMaterial color="#80ff72" transparent opacity={0.95} depthTest={false} depthWrite={false} />
          </line>
          <line ref={boidCohesionLineRef} geometry={boidCohesionGeometry} raycast={() => null}>
            <lineBasicMaterial color="#ffd166" transparent opacity={0.95} depthTest={false} depthWrite={false} />
          </line>
          <line ref={boidThreatLineRef} geometry={boidThreatGeometry} raycast={() => null}>
            <lineBasicMaterial color="#ff2fa0" transparent opacity={0.95} depthTest={false} depthWrite={false} />
          </line>
          <line ref={boidResultLineRef} geometry={boidResultGeometry} raycast={() => null}>
            <lineBasicMaterial color="#ffffff" transparent opacity={0.95} depthTest={false} depthWrite={false} />
          </line>
          {boidNeighborGeometries.map((geometry, n) => (
            <line
              key={`boid-neighbor-${n}`}
              ref={el => { boidNeighborLineRefs.current[n] = el }}
              geometry={geometry}
              visible={false}
              raycast={() => null}
            >
              <lineBasicMaterial color="#9aa7b2" transparent opacity={0.7} depthTest={false} depthWrite={false} />
            </line>
          ))}
          {boidNeighborHeadingGeometries.map((geometry, n) => (
            <line
              key={`boid-neighbor-heading-${n}`}
              ref={el => { boidNeighborHeadingRefs.current[n] = el }}
              geometry={geometry}
              visible={false}
              raycast={() => null}
            >
              <lineBasicMaterial color="#7df9ff" transparent opacity={0.9} depthTest={false} depthWrite={false} />
            </line>
          ))}
          <Text
            ref={boidLabelRef}
            fontSize={DEBUG_LABEL_SCALE}
            font={DEBUG_LABEL_FONT}
            color="#ffffff"
            anchorX="center"
            anchorY="middle"
            depthTest={false}
            renderOrder={22}
            raycast={() => null}
          >
            boid n0
          </Text>
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
              curveDeformInputRef={curveDeformInputRef}
              debugSimulationSpeed={debugSimulationSpeed}
              debugCurveBones={debug && selected && Boolean(debugLayers?.bones)}
              debugParentScale={size * focusScale}
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
useGLTF.preload('/models/fish/mahi-mahi/mahi-mahi_male.glb')
useGLTF.preload('/models/fish/mahi-mahi/mahi-mahi_female.glb')
