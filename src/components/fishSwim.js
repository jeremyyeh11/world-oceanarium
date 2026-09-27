/**
 * Fish movement: swim bounds, boundary avoidance, solo-agent steering, the Mola
 * sun-bask targeting, and the boid/schooling maths.
 *
 * Extracted from `Fish.jsx` (see issue #12). Everything here is a pure function
 * over its arguments — no React, no r3f, no rendering — which is why this file is
 * `.js` rather than `.jsx`: plain Node can import it, so `tests/fishSwim.test.mjs`
 * can exercise movement without a renderer.
 *
 * The two scratch vectors below are deliberately module-private copies rather than
 * imports from `Fish.jsx`. They exist to avoid per-frame allocation, so they are
 * mutated in place; sharing one across both modules would let two writers collide
 * within a frame and corrupt a heading with no error to show for it.
 */
import * as THREE from 'three'
import { SURFACE_PLANE_Y } from '../utils/waterSurfaceGeometry.js'
import { creatureBodyLengthWU, isMolaCreature, resolveSpecies } from '../utils/speciesLookup.js'
import { creatureRepulsesOthers } from '../utils/creatureMoments.js'
import { hashString } from '../utils/hash.js'

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
export const SWIM_BOX = {
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
export const DEFAULT_SWIM = {
  bodyLengthWU: 1,
  visualTimeScale: 0.45,
  idleBLPerSec: [1.0, 1.5],
  idleDriftBLPerSec: [0.18, 0.35],
  snapBLPerSec: [3.0, 5.0],
  burstBLPerSec: [5.0, 8.0],
  burstInterval: [5.5, 9.5],
  speedMultiplier: 1,
  erraticness: 0.35,
}
const MAX_MODEL_PITCH = THREE.MathUtils.degToRad(15)
const MIN_LARGE_CREATURE_PITCH = THREE.MathUtils.degToRad(7)
const SMALL_CREATURE_TURN_RATE = THREE.MathUtils.degToRad(220)
const LARGE_CREATURE_TURN_RATE = THREE.MathUtils.degToRad(42)
const MAX_PATH_Y_GRADIENT = 0.2
export const SNAP_TURN_THRESHOLD = 0.014
export const DEFAULT_BURST_ACTION_DURATION = 0.5
export const DEFAULT_TURN_ACTION_DURATION = 0.34
export const DEFAULT_DRIFT_INTERVAL = [18, 30]
export const DEFAULT_DRIFT_DURATION = [7, 12]
const SCHOOL_SPACING = 0.58
const SCHOOL_FORMATION_RADIUS_SCALE = 0.55
const SCHOOL_VERTICAL_SPREAD = 0.92
const SCHOOL_LONGITUDINAL_SPREAD = 0.55
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5))
// Turn radius as a multiple of body length. Heading rotates no faster than a fish
// arcing forward on this radius (angular rate = speed / radius), so creatures swim
// through their turns instead of pivoting or strafing. >=1 arcs; <1 would allow a
// future spin-in-place creature.
const DEFAULT_TURN_RADIUS_BODY_LENGTHS = 2.5
const SCHOOL_FOLLOW_LOOKAHEAD_BODY_LENGTHS = 2.5
const SOLO_FOLLOW_LOOKAHEAD_BODY_LENGTHS = 1.5
const SOLO_FOLLOW_LOOKAHEAD_MIN = 0.35
const PATH_EDGE_PADDING = 0.75
const PATH_VERTICAL_PADDING = 0.16
const FISH_SEPARATION_PADDING = 0.18
const DENSE_SCHOOL_MIN_COUNT = 12
const DENSE_SCHOOL_RADIUS_SCALE = 0.58
const DENSE_SCHOOL_PADDING_SCALE = 0.2
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
// Species reaction hierarchy: a neighbor's `menace` and the observer's `wariness`
// combine into a threat-avoidance push sensed at a wider radius than collision
// separation. Prey flee the mako; nobody minds the mola.
const BOID_THREAT_PERCEPTION_SCALE = 1.9
const BOID_THREAT_WEIGHT = 0.62
const BOID_DEFAULT_MENACE = 0.25
const BOID_DEFAULT_WARINESS = 0.35
// menace × wariness below this is ignored: the mako shrugs off a mahi, nobody minds the mola.
const BOID_THREAT_MIN_PAIR = 0.06
// Evade, not flee (Nature of Code ch. 5, pursue/evade): prey steer away from the closest the
// threat will come over this horizon, not from where it is now. A fish beside a passing shark
// then escapes sideways off its path instead of fleeing ahead of it down the same line, and a
// shark bearing down is avoided before it arrives. A shark swimming away is no less of a threat
// than a stationary one: the closest point of its path is where it is now.
const BOID_THREAT_LOOKAHEAD_SECONDS = 1.0
// A big predator is seen from farther away. Each fish's own threat radius scales with its own
// size and is capped (~6–8 WU), which let a sardine or a mahi sit untroubled less than half a
// mako's 16.7 WU length from it. So the radius toward a threat is at least this many of the
// threat's own body lengths. Only the mako is long enough for this to change anything today.
const BOID_THREAT_BODY_LENGTH_REACH = 1.0
export const BOID_MAX_DEBUG_NEIGHBORS = 12
const SOLO_AGENT_WIDE_TARGET_CHANCE = 0.68
const SOLO_AGENT_TARGET_ATTEMPTS = 16
const SOLO_AGENT_MIN_TARGET_BODY_LENGTHS = 3.0
const SOLO_AGENT_TARGET_VERTICAL_BODY_LENGTHS_DEFAULT = 0.32
const SOLO_AGENT_TARGET_VERTICAL_BODY_LENGTHS_MIN = 0.05
const SOLO_AGENT_TARGET_VERTICAL_BODY_LENGTHS_MAX = 1.4
const SOLO_AGENT_STEERING_REACHED_BODY_LENGTHS = 0.95
const MOLA_STEERING_REACHED_BODY_LENGTHS = 0.32
const MOLA_STEERING_REACHED_MAX = 3.0
// Predictive boundary avoidance (all creatures). A fast swimmer's open-water turn radius is
// far wider than the tank, so at speed it reaches a wall before its gentle arc can redirect
// and gets pinned against the clamp (reads as strafing backward). To prevent that, when the
// fish is heading at a wall within a look-ahead distance, its allowed per-frame turn tightens
// toward BOUNDARY_MIN_TURN_RADIUS so it can carve away in time. The look-ahead is a fixed
// multiple of that minimum radius' quarter-arc run-up, and both scale with body length so the
// effect is size-agnostic. Open water is untouched, so wide banking arcs survive everywhere
// but the edges.
const SOLO_AGENT_BOUNDARY_MIN_TURN_BODY_LENGTHS = 0.7
const SOLO_AGENT_BOUNDARY_LOOKAHEAD_ARC_SCALE = 1.35
// How far past the rear (negative-Z) swim wall the mola may drift before the fade-out
// recovery kicks in. The rear stays soft — a blown deep U-turn exits into the dark and fades
// out instead of sliding along a wall the mola cannot out-turn.
const MOLA_DEEP_EXIT_Z_MARGIN_BODY_LENGTHS = 1.75
const MOLA_DEEP_EXIT_Z_MARGIN_MIN = 9.0
const MOLA_DEEP_EXIT_Z_MARGIN_MAX = 18.0
const MOLA_DEEP_ZONE_Z_MAX = -10
export const MOLA_SUN_BASK_APPROACH_Z = [-6, 0]
const MOLA_SUN_BASK_EXIT_BODY_LENGTHS = 3.0
const MOLA_SURFACE_CENTER_CLEARANCE_BODY_LENGTHS = 0.50
const MOLA_SURFACE_CENTER_CLEARANCE_MIN = 3.6
const MOLA_SURFACE_CENTER_CLEARANCE_MAX = 4.85
const MOLA_SUN_BASK_SURFACE_CENTER_CLEARANCE_BODY_LENGTHS = 0.12
const MOLA_SUN_BASK_SURFACE_CENTER_CLEARANCE_MIN = 0.85
const MOLA_SUN_BASK_SURFACE_CENTER_CLEARANCE_MAX = 1.25
const AGENT_FORWARD_DESTINATION_MAX_ANGLE = Math.PI / 2
const AGENT_BOUNDARY_TANGENT_DISTANCE_BODY_LENGTHS = 0.72
const agentContinuationForward = new THREE.Vector3()
const agentContinuationCenter = new THREE.Vector3()
const agentContinuationDirection = new THREE.Vector3()
const agentDestinationDirection = new THREE.Vector3()
const agentBoundaryNormal = new THREE.Vector3()
const agentBoundaryPlaneTangent = new THREE.Vector3()
const agentBoundaryInward = new THREE.Vector3()
const separationDelta = new THREE.Vector3()
const boidDelta = new THREE.Vector3()
const boidAlignment = new THREE.Vector3()
const boidCenter = new THREE.Vector3()
const boidCohesion = new THREE.Vector3()
const boidThreat = new THREE.Vector3()
const boidThreatPath = new THREE.Vector3()
// Ids of the threats pushing the fish being decided, for the debug overlay's 'avoid' relation.
const boidAvoidIds = new Set()
// Reused candidate buffer for nearest-N neighbor selection so a decision tick does
// not allocate. Entries are { id, other, distanceSq } records borrowed from
// boidNeighborPool, refilled and re-sorted each tick.
const boidNeighborScratch = []
const boidNeighborPool = []
const byDistanceSq = (a, b) => a.distanceSq - b.distanceSq
const SCHOOL_STATES = new Map()
const FISH_REGISTRY = new Map()
// The registry entries with any menace at all — a handful (the mako and the mahi) against ~275
// sardines — so the per-frame threat check reads these instead of scanning every fish.
const THREAT_ENTRIES = new Map()
const threatLevelOffset = new THREE.Vector3()

// Module-private scratch. `Fish.jsx` keeps its own vectors of the same names.
const up = new THREE.Vector3(0, 1, 0)
const horizontalForward = new THREE.Vector3()

// --- school alarm ------------------------------------------------------------------------
// When one fish startles, alarm spreads through its school as a wave that outruns the predator —
// the wave of agitation real schools show — instead of every fish reacting only to what it can
// see. A startle drops an alarm event where the fish is; each member's alarm is then the strongest
// event that has reached it: the front travels at SCHOOL_ALARM_WAVE_SPEED, weakens linearly to
// nothing at SCHOOL_ALARM_REACH, and fades with SCHOOL_ALARM_FADE_SECONDS once it arrives. Events
// carry their own age, advanced once a frame by the school leader, because each fish's clock
// starts when it mounts and two members' `now` can disagree by seconds.
const SCHOOL_ALARM_WAVE_SPEED = 15 // WU/s, ~3× a cruising mako (~4.7 WU/s)
const SCHOOL_ALARM_REACH = 12 // WU; wider than the 180-sardine school
const SCHOOL_ALARM_FADE_SECONDS = 2.2
const SCHOOL_ALARM_MAX_EVENTS = 12
// A startle this close to a live event that is this young adds nothing new: a mako pass startles
// dozens of neighbours within a fraction of a second.
const SCHOOL_ALARM_MERGE_DISTANCE = 1.5
const SCHOOL_ALARM_MERGE_SECONDS = 0.3
// Past this age an event has reached its full reach and faded to under 5%.
const SCHOOL_ALARM_LIFETIME = SCHOOL_ALARM_REACH / SCHOOL_ALARM_WAVE_SPEED + SCHOOL_ALARM_FADE_SECONDS * 3

/** A member startled at `position`: start an alarm wave through its school. */
export function raiseSchoolAlarm(schoolState, position) {
  const events = schoolState.alarms ??= []
  for (let i = 0; i < events.length; i += 1) {
    const event = events[i]
    if (event.age < SCHOOL_ALARM_MERGE_SECONDS && event.position.distanceTo(position) < SCHOOL_ALARM_MERGE_DISTANCE) return
  }
  if (events.length >= SCHOOL_ALARM_MAX_EVENTS) events.shift()
  events.push({ position: position.clone(), age: 0 })
}

/** Age the school's alarm events by `delta` and drop the spent ones. Called once a frame by the leader. */
export function advanceSchoolAlarms(schoolState, delta) {
  const events = schoolState.alarms
  if (!events?.length) return
  let kept = 0
  for (let i = 0; i < events.length; i += 1) {
    const event = events[i]
    event.age += delta
    if (event.age < SCHOOL_ALARM_LIFETIME) events[kept++] = event
  }
  events.length = kept
}

/** How alarmed a member at `position` is, 0..1: the strongest alarm wave that has reached it. */
export function schoolAlarmAt(schoolState, position) {
  const events = schoolState?.alarms
  if (!events?.length) return 0
  let alarm = 0
  for (let i = 0; i < events.length; i += 1) {
    const event = events[i]
    const distance = event.position.distanceTo(position)
    if (distance >= SCHOOL_ALARM_REACH) continue
    const sinceArrival = event.age - distance / SCHOOL_ALARM_WAVE_SPEED
    if (sinceArrival < 0) continue
    alarm = Math.max(alarm, (1 - distance / SCHOOL_ALARM_REACH) * Math.exp(-sinceArrival / SCHOOL_ALARM_FADE_SECONDS))
  }
  return alarm
}

export function getSchoolState(school, creature, swim) {
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
      // Live alarm waves (see raiseSchoolAlarm), each { position, age }.
      alarms: [],
    }
    SCHOOL_STATES.set(key, state)
  }
  return state
}

export function mulberry32(seed) {
  return function rand() {
    let t = seed += 0x6D2B79F5
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function randomRange(rand, min, max) {
  return min + rand() * (max - min)
}

export function randomRangeFromPair(rand, pair, fallback) {
  const [min, max] = Array.isArray(pair) ? pair : fallback
  return randomRange(rand, min, max)
}

export function resolveSwimProfile(creature) {
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
    // Use the post-steering travel vector directly for species whose long bodies make
    // a smoothed render heading read as a pivot detached from their actual arc.
    visualHeadingFollowsMotion: speciesSwim.visualHeadingFollowsMotion ?? false,
    // Most fish may enter a low-travel drift beat. Obligate ram-ventilating pelagic
    // swimmers can opt out so their idle state remains a continuous forward patrol.
    driftEnabled: speciesSwim.driftEnabled ?? true,
    driftInterval: speciesSwim.driftInterval ?? DEFAULT_DRIFT_INTERVAL,
    driftDuration: speciesSwim.driftDuration ?? DEFAULT_DRIFT_DURATION,
    burstActionDuration: speciesSwim.burstActionDuration ?? DEFAULT_BURST_ACTION_DURATION,
    turnActionDuration: speciesSwim.turnActionDuration ?? DEFAULT_TURN_ACTION_DURATION,
    turnTriggerThreshold: speciesSwim.turnTriggerThreshold ?? SNAP_TURN_THRESHOLD,
    schoolMaxAvoidanceAngleDegrees: speciesSwim.schoolMaxAvoidanceAngleDegrees,
    schoolDirectionResponse: speciesSwim.schoolDirectionResponse,
    soloTargetVerticalBodyLengths: speciesSwim.soloTargetVerticalBodyLengths,
  }
}

export function resolveModel(creature, variantKey = null) {
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

export function creatureBodyLength(creature, swim) {
  return creatureBodyLengthWU(creature, swim.bodyLengthWU)
}

function largeCreatureFactor(creature, swim) {
  return THREE.MathUtils.clamp((creatureBodyLength(creature, swim) - 1.0) / 6.5, 0, 1)
}

export function maxVisualPitch(creature, swim) {
  // Per-species override for surface cruisers that should glide near-level: without it a
  // faster fish traverses the vertical waviness of its path quickly enough to keep pitching
  // toward the generic limit, which — with the follow-cam holding it centred — reads as the
  // fish hovering in place nosing up and down.
  if (Number.isFinite(swim.maxVisualPitchDegrees)) return THREE.MathUtils.degToRad(swim.maxVisualPitchDegrees)
  return THREE.MathUtils.lerp(MAX_MODEL_PITCH, MIN_LARGE_CREATURE_PITCH, largeCreatureFactor(creature, swim))
}

export function turnRateForCreature(creature, swim) {
  return THREE.MathUtils.lerp(SMALL_CREATURE_TURN_RATE, LARGE_CREATURE_TURN_RATE, largeCreatureFactor(creature, swim))
}

// Maximum heading change this frame if the creature turns on an arc of radius
// (turnRadiusBodyLengths * bodyLength) while moving forward at `speed` (WU/s).
// ω = v / r, so faster fish and tighter radii turn quicker, but never pivot.
export function maxTurnRadiansForSpeed(swim, bodyLength, speed, delta) {
  const bodyLengths = Math.max(0.05, swim.turnRadiusBodyLengths ?? DEFAULT_TURN_RADIUS_BODY_LENGTHS)
  const radius = Math.max(0.05, bodyLengths * bodyLength)
  return (Math.max(0, speed) / radius) * Math.max(0, delta)
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

export function rotateDirectionToward(current, target, maxAngle) {
  if (current.lengthSq() < 0.000001) return current.copy(target)
  const angle = current.angleTo(target)
  if (angle <= maxAngle) return current.copy(target)
  const alpha = maxAngle / Math.max(0.000001, angle)
  return current.lerp(target, alpha).normalize()
}

// Turns `current` about the world vertical toward `target`'s heading by at most `maxAngle`, at a
// true angular rate, keeping `current`'s pitch. rotateDirectionToward lerps, which is fine for
// the small corrections of normal swimming but barely moves toward a target behind the fish and
// then flips past the halfway point; an escape U-turn has to carve round instead. A target dead
// astern has no shorter way round, so `side` (+1 or -1, the sign of the yaw) picks one.
export function yawToward(current, target, maxAngle, side = 1) {
  const horizontal = Math.hypot(current.x, current.z)
  if (horizontal < 0.000001 || Math.hypot(target.x, target.z) < 0.000001) return current
  let turn = Math.atan2(target.x, target.z) - Math.atan2(current.x, current.z)
  if (turn > Math.PI) turn -= Math.PI * 2
  else if (turn < -Math.PI) turn += Math.PI * 2
  if (Math.PI - Math.abs(turn) < 0.001) turn = Math.PI * (side < 0 ? -1 : 1)
  const yaw = Math.atan2(current.x, current.z) + THREE.MathUtils.clamp(turn, -maxAngle, maxAngle)
  current.x = Math.sin(yaw) * horizontal
  current.z = Math.cos(yaw) * horizontal
  return current
}

// Soft vertical walls (Nature of Code ch. 5, walls): within `margin` of the top or bottom bound a
// fish is steered away, quadratically harder toward the bound, up to SOFT_WALL_STRENGTH at it. The
// result is added to the vertical part of a desired heading (roughly unit length), so at the bound
// it outweighs anything pulling the fish on into it. Meeting a bound only as a clamp stopped fish
// dead in a flat layer against it; a push turns them away before they get there.
const SOFT_WALL_STRENGTH = 1.2

export function verticalBoundRepulsion(y, bounds, margin) {
  if (!(margin > 0)) return 0
  const intoTop = THREE.MathUtils.clamp((y - (bounds.yMax - margin)) / margin, 0, 1)
  const intoBottom = THREE.MathUtils.clamp((bounds.yMin + margin - y) / margin, 0, 1)
  return (intoBottom * intoBottom - intoTop * intoTop) * SOFT_WALL_STRENGTH
}

// The top bound stays hard — past it is the water surface — so a fish pressed against it levels
// off and glides along it: the part of its heading pointing up is removed. clampToSwimBounds holds
// the position but left the heading pitched into the bound, and boid alignment then spread that
// pitch through the school, which once pinned all 180 sardines flat against the ceiling pointing
// ~30° up. The bottom bound needs no such rule: the soft wall turns fish away well before it.
// Returns whether it flattened.
export function glideAlongCeiling(direction, position, bounds) {
  if (position.y < bounds.yMax - 0.0001 || direction.y <= 0) return false
  direction.y = 0
  if (direction.lengthSq() < 0.000001) direction.set(0, 0, -1)
  else direction.normalize()
  return true
}

// The vertical half of the escape turn: tilts unit `current` toward `target`'s pitch by at most
// `maxAngle`, keeping its heading. Paired with yawToward so an escape turns at exactly its own
// rate; running the ordinary rotateDirectionToward after yawToward added a second turn step on
// top and made the arc far tighter than its radius.
export function pitchToward(current, target, maxAngle) {
  const horizontal = Math.hypot(current.x, current.z)
  if (horizontal < 0.000001) return current
  const pitch = Math.atan2(current.y, horizontal)
  const targetPitch = Math.atan2(target.y, Math.hypot(target.x, target.z))
  const next = pitch + THREE.MathUtils.clamp(targetPitch - pitch, -maxAngle, maxAngle)
  const scale = Math.cos(next) / horizontal
  current.x *= scale
  current.z *= scale
  current.y = Math.sin(next)
  return current
}

function clampedVisualPitch(direction, pitchLimit) {
  const horizontal = Math.max(0.0001, Math.hypot(direction.x, direction.z))
  const gradientLimit = Math.atan(MAX_PATH_Y_GRADIENT)
  const limit = Math.min(pitchLimit, gradientLimit)
  return THREE.MathUtils.clamp(Math.atan2(direction.y, horizontal), -limit, limit)
}

export function setForwardWithPitch(out, horizontalDirection, pitch) {
  out
    .copy(horizontalDirection)
    .multiplyScalar(Math.cos(pitch))
    .addScaledVector(up, Math.sin(pitch))
    .normalize()
  return out
}

export function enforceForwardPitchLimit(direction, pitchLimit) {
  horizontalForward.set(direction.x, 0, direction.z)
  if (horizontalForward.lengthSq() < 0.0001) horizontalForward.set(0, 0, -1)
  horizontalForward.normalize()
  return setForwardWithPitch(direction, horizontalForward, clampedVisualPitch(direction, pitchLimit))
}

export function debugForwardOffset(creature, swim, model) {
  if (Number.isFinite(model?.debugForwardOffsetWU)) return model.debugForwardOffsetWU
  const bodyLength = creatureBodyLength(creature, swim)
  if (Number.isFinite(model?.debugForwardOffsetRatio)) return bodyLength * model.debugForwardOffsetRatio
  if (model?.debugForwardOrigin === 'head') return bodyLength * 0.46
  if (!model) return creatureBodyLength(creature, swim) * 0.52
  return bodyLength * 0.42
}

export function placeholderDimensions(species, swim) {
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

export function interactionProxyDimensions(species, swim) {
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

// The x range is symmetric about the centre line, so per-frame callers read the half-width
// directly (projectedScreenHalfXAtZ) instead of allocating a { xMin, xMax } pair each call.
export function swimXRangeAtZ(bounds, z) {
  const halfX = projectedScreenHalfXAtZ(z)
  return { xMin: -halfX, xMax: halfX }
}

function randomXInSwimBoundsAtZ(rand, bounds, z, minT = 0, maxT = 1) {
  const halfX = projectedScreenHalfXAtZ(z)
  return THREE.MathUtils.lerp(-halfX, halfX, randomRange(rand, minT, maxT))
}

// Bounds depend only on the depth zone, the swim profile, and the size, all fixed for a given
// fish, but they were rebuilt as a fresh object several times per fish per frame. Each swim
// profile remembers the last bounds it produced; a fish always asks with the same arguments,
// so after its first frame this is a lookup. Frozen, because every caller shares the object.
const swimBoundsCache = new WeakMap()

export function swimBounds(depthZone, swim = DEFAULT_SWIM, size = 1) {
  const cached = swimBoundsCache.get(swim)
  if (cached && cached.depthZone === depthZone && cached.size === size) return cached.bounds
  const bounds = Object.freeze(computeSwimBounds(depthZone, swim, size))
  swimBoundsCache.set(swim, { depthZone, size, bounds })
  return bounds
}

function computeSwimBounds(depthZone, swim, size) {
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
  const halfX = projectedScreenHalfXAtZ(point.z)
  return point.x >= -halfX
    && point.x <= halfX
    && point.y >= bounds.yMin
    && point.y <= bounds.yMax
    && point.z >= bounds.zMin
    && point.z <= bounds.zMax
}

export function clampToSwimBounds(point, bounds) {
  point.z = THREE.MathUtils.clamp(point.z, bounds.zMin, bounds.zMax)
  const halfX = projectedScreenHalfXAtZ(point.z)
  point.x = THREE.MathUtils.clamp(point.x, -halfX, halfX)
  point.y = THREE.MathUtils.clamp(point.y, bounds.yMin, bounds.yMax)
  return point
}

export function isMolaDeepZExit(point, bounds, bodyLength) {
  const zMargin = THREE.MathUtils.clamp(
    bodyLength * MOLA_DEEP_EXIT_Z_MARGIN_BODY_LENGTHS,
    MOLA_DEEP_EXIT_Z_MARGIN_MIN,
    MOLA_DEEP_EXIT_Z_MARGIN_MAX,
  )
  return point.z < bounds.zMin - zMargin
}

// Smallest positive distance from `position` travelling along `forward` before it crosses a
// swim-bounds wall. Infinity when the heading is not aimed at any wall. Because it is a
// ray-to-box time, a fish skimming parallel to a wall reads as "far" even when hugging it —
// only a heading actually aimed at a wall returns a short distance.
function distanceToSwimBoundaryAhead(position, forward, bounds) {
  const halfX = projectedScreenHalfXAtZ(position.z)
  let best = rayToSlab(Infinity, forward.x, position.x, -halfX, halfX)
  best = rayToSlab(best, forward.y, position.y, bounds.yMin, bounds.yMax)
  return rayToSlab(best, forward.z, position.z, bounds.zMin, bounds.zMax)
}

// One axis of the ray-to-box test: the distance along `comp` to the wall it is heading for,
// kept if it beats `best`. Scalar arguments only, so a per-frame call allocates nothing.
function rayToSlab(best, comp, pos, lo, hi) {
  if (comp > 1e-4) {
    const t = (hi - pos) / comp
    if (t >= 0 && t < best) return t
  } else if (comp < -1e-4) {
    const t = (lo - pos) / comp
    if (t >= 0 && t < best) return t
  }
  return best
}

// Per-frame heading-turn cap for a solo agent, tightened as it bears down on a wall so it can
// bank away before overshooting the runtime envelope. Away from walls (or skimming parallel to
// one) it returns `baseStep` unchanged, preserving the wide open-water arc; as the aimed-at
// wall closes inside the look-ahead the effective radius eases from the open-water radius
// toward a tight minimum, raising the cap so the fish can complete the turn in the room it has.
export function boundaryAvoidanceTurnStep(baseStep, position, forward, bounds, swim, bodyLength, speed, delta) {
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

// Walls in a fixed order (-x, +x, -z, +z, -y, +y); on a tie the earlier wall wins, as it did
// when this scanned an array of candidates. Unrolled so a per-frame call allocates nothing.
function nearestSwimBoundaryNormal(out, point, bounds, bodyLength) {
  const halfX = projectedScreenHalfXAtZ(point.z)
  const threshold = Math.max(0.42, bodyLength * AGENT_BOUNDARY_TANGENT_DISTANCE_BODY_LENGTHS)
  let distance = point.x + halfX
  let nx = -1, ny = 0, nz = 0
  let d = halfX - point.x
  if (d < distance) { distance = d; nx = 1; ny = 0; nz = 0 }
  d = point.z - bounds.zMin
  if (d < distance) { distance = d; nx = 0; ny = 0; nz = -1 }
  d = bounds.zMax - point.z
  if (d < distance) { distance = d; nx = 0; ny = 0; nz = 1 }
  d = point.y - bounds.yMin
  if (d < distance) { distance = d; nx = 0; ny = -1; nz = 0 }
  d = bounds.yMax - point.y
  if (d < distance) { distance = d; nx = 0; ny = 1; nz = 0 }

  if (distance > threshold) {
    out.set(0, 0, 0)
    return 0
  }

  out.set(nx, ny, nz)
  return THREE.MathUtils.clamp(1 - distance / threshold, 0, 1)
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

function destinationInForwardCone(destination, position, forward, maxAngle = AGENT_FORWARD_DESTINATION_MAX_ANGLE) {
  agentDestinationDirection.subVectors(destination, position)
  if (agentDestinationDirection.lengthSq() < 0.0001) return false
  agentDestinationDirection.normalize()
  return forward.angleTo(agentDestinationDirection) <= maxAngle
}

export function pickSoloAgentSteeringDestination(out, creature, swim, rand, from, forward, depthMode = 'any') {
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

export function molaSunBaskSurfaceCenterYMax(creature, swim, bounds) {
  if (!isMolaCreature(creature)) return bounds.yMax
  const bodyLength = creatureBodyLength(creature, swim)
  const clearance = THREE.MathUtils.clamp(
    bodyLength * MOLA_SUN_BASK_SURFACE_CENTER_CLEARANCE_BODY_LENGTHS,
    MOLA_SUN_BASK_SURFACE_CENTER_CLEARANCE_MIN,
    MOLA_SUN_BASK_SURFACE_CENTER_CLEARANCE_MAX,
  )
  return Math.min(bounds.yMax, SURFACE_PLANE_Y - clearance)
}

export function clampToMolaSurfaceCeiling(point, creature, swim, bounds, direction = null, yMaxOverride = null) {
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
export function clampToSurfaceCeiling(point, direction, ceilingY) {
  if (point.y <= ceilingY) return false
  point.y = ceilingY
  if (direction && direction.y > 0) {
    direction.y = 0
    if (direction.lengthSq() > 0.0001) direction.normalize()
  }
  return true
}

export function soloAgentReachedDistance(creature, bodyLength) {
  if (!isMolaCreature(creature)) return Math.max(0.7, bodyLength * SOLO_AGENT_STEERING_REACHED_BODY_LENGTHS)
  return Math.max(1.4, Math.min(MOLA_STEERING_REACHED_MAX, bodyLength * MOLA_STEERING_REACHED_BODY_LENGTHS))
}

export function pickMolaSunBaskTarget(out, creature, swim, rand, from, forward) {
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

export function pickMolaSunBaskExitTarget(out, creature, swim, from, forward) {
  const bounds = swimBounds(creature.depthZone, swim, creature.size ?? 1)
  const bodyLength = creatureBodyLength(creature, swim)
  out.copy(from)
    .addScaledVector(forward, Math.max(1.2, bodyLength * MOLA_SUN_BASK_EXIT_BODY_LENGTHS))
  out.y = THREE.MathUtils.lerp(bounds.yMax, bounds.yMin, 0.42)
  out.z = Math.min(out.z - bodyLength * 0.75, MOLA_DEEP_ZONE_Z_MAX)
  clampToSwimBounds(out, bounds)
  return out
}

export function shapeSoloAgentSteeringDesired(out, position, target, forward, creature, swim) {
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

export function pickSoloAgentTarget(out, creature, swim, rand, from = null) {
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

export function pickSoloAgentContinuationTarget(out, creature, swim, rand, from, startForward) {
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


function schoolFormationRadius(school, creature) {
  const spacingScale = resolveSpecies(creature)?.swim?.schoolSpacingScale ?? 1
  return SCHOOL_SPACING * spacingScale * Math.sqrt(Math.max(1, school.count)) * SCHOOL_FORMATION_RADIUS_SCALE
}

// The furthest any slot from schoolFormationOffset sits above or below the school's centre. The
// leader keeps the school's goal at least this far inside the vertical bounds: a goal near the top
// otherwise put the upper half of the formation past yMax, where the clamp flattened it into a sheet
// (112 of 180 sardines, seen in review).
export function schoolFormationVerticalHalfExtent(school, creature) {
  if (!school) return 0
  return schoolFormationRadius(school, creature) * SCHOOL_VERTICAL_SPREAD + 0.045
}

export function schoolFormationOffset(school, creature) {
  if (!school) return null
  const rand = mulberry32(hashString(`${school.id}:${creature.id}:formation`))
  const count = Math.max(1, school.count)
  const indexRadius = Math.sqrt((school.index + 0.5) / count)
  const schoolRadius = schoolFormationRadius(school, creature)
  const angle = school.index * GOLDEN_ANGLE + randomRange(rand, -0.14, 0.14)
  const isLeader = school.index === 0
  const longitudinal = isLeader
    ? schoolRadius * SCHOOL_LONGITUDINAL_SPREAD * 0.52
    : (
      Math.sin(school.index * GOLDEN_ANGLE * 0.73) * 0.55 + randomRange(rand, -0.45, 0.45)
    ) * schoolRadius * SCHOOL_LONGITUDINAL_SPREAD
  return {
    lateral: Math.cos(angle) * schoolRadius * indexRadius + randomRange(rand, -0.045, 0.045),
    vertical: Math.sin(angle) * schoolRadius * indexRadius * SCHOOL_VERTICAL_SPREAD + randomRange(rand, -0.045, 0.045),
    longitudinal,
  }
}

export function followLookaheadDistance(creature, swim, isSchooling) {
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

// Boid parameters depend only on the swim profile and the species, yet were rebuilt for every
// fish on every frame by updateFishRegistry. Cached per swim profile like swimBounds.
const boidParamsCache = new WeakMap()

function boidParamsForCreature(creature, swim) {
  const cached = boidParamsCache.get(swim)
  if (cached && cached.species === creature.species) return cached.params
  const params = Object.freeze(buildBoidParams(creature, swim))
  boidParamsCache.set(swim, { species: creature.species, params })
  return params
}

function buildBoidParams(creature, swim) {
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

// The radius within which `other` alarms a fish whose own threat radius is `ownThreatRadius`.
function threatRadiusToward(other, ownThreatRadius) {
  return Math.max(ownThreatRadius, (other.bodyLength ?? 0) * BOID_THREAT_BODY_LENGTH_REACH)
}

function boidPerceptionRadius(creature, swim, params) {
  const bodyLength = swim.bodyLengthWU * (creature.size ?? 1)
  const spacingScale = resolveSpecies(creature)?.swim?.schoolSpacingScale ?? 1
  return THREE.MathUtils.clamp(
    bodyLength * params.perceptionBodyLengths * Math.sqrt(Math.max(0.45, spacingScale)),
    params.perceptionMin,
    params.perceptionMax,
  )
}

// Fills `out` with the offset to `position` from the closest point of `other`'s path over the
// threat lookahead, in the same vertically-squashed metric as neighbor distances. The path runs
// from where `other` is along its heading at its registered speed, so a threat with no speed is
// just its position. Returns false when there is no direction to push along.
function closestThreatApproach(out, position, other) {
  out.subVectors(position, other.position)
  out.y *= 0.55
  const travel = (other.speed ?? 0) * BOID_THREAT_LOOKAHEAD_SECONDS
  if (travel > 0 && other.forward?.lengthSq?.() > 0.000001) {
    boidThreatPath.copy(other.forward).normalize().multiplyScalar(travel)
    boidThreatPath.y *= 0.55
    const pathLengthSq = boidThreatPath.lengthSq()
    const t = pathLengthSq > 0.000001
      ? THREE.MathUtils.clamp(out.dot(boidThreatPath) / pathLengthSq, 0, 1)
      : 0
    if (t > 0) {
      out.addScaledVector(boidThreatPath, -t)
      // Dead on the path, neither side is nearer; break the tie to one fixed side. Kept
      // near-zero length so proximity still reads as "on the path".
      if (out.lengthSq() <= 0.000001) out.set(-boidThreatPath.z, 0, boidThreatPath.x).setLength(0.01)
    }
  }
  return out.lengthSq() > 0.000001
}

// Nearest-N neighbor selection: gather everything inside the perception radius, sort by
// distance, and only treat the nearest N as school/collision neighbors. This stabilizes who a
// fish reacts to from tick to tick, which is what kills the jitter — alignment/cohesion targets
// stop flickering frame to frame. Threats are read separately, straight from THREAT_ENTRIES, and
// applied however many neighbors there are, so a shark is never missed. They reach far past the
// perception radius (toward a mako, its own length), and gathering the whole school out to that
// radius had a sardine sorting ~140 neighbors per decision to find the one shark.
export function computeBoidSteering(out, fish, creature, swim, school = null, followDirection = null, debugState = null) {
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
  const perceptionRadius = boidPerceptionRadius(creature, swim, params)
  const perceptionRadiusSq = perceptionRadius * perceptionRadius
  const threatRadius = perceptionRadius * BOID_THREAT_PERCEPTION_SCALE
  const forward = followDirection?.lengthSq?.() > 0.0001 ? followDirection : null
  if (debugState) debugState.perceptionRadius = perceptionRadius

  // Phase 1 — threat avoidance: a push away from the closest point of each menacing fish's path
  // over the lookahead (its current position when it is not moving).
  boidThreat.set(0, 0, 0)
  boidAvoidIds.clear()
  THREAT_ENTRIES.forEach((other, id) => {
    if (id === creature.id || other.biome !== creature.biome) return
    const threatPair = other.menace * params.wariness
    if (threatPair <= BOID_THREAT_MIN_PAIR) return
    boidDelta.subVectors(fish.position, other.position)
    boidDelta.y *= 0.55
    if (boidDelta.lengthSq() < 0.000001 || !closestThreatApproach(boidDelta, fish.position, other)) return
    const proximity = THREE.MathUtils.clamp(1 - boidDelta.length() / threatRadiusToward(other, threatRadius), 0, 1)
    if (proximity <= 0) return
    boidDelta.normalize()
    boidThreat.addScaledVector(boidDelta, threatPair * proximity * proximity * BOID_THREAT_WEIGHT)
    boidAvoidIds.add(id)
  })

  // Phase 2 — gather social candidates within the perception radius, then sort nearest-first.
  // Threats inside it are gathered too: a nearby mahi still takes a neighbor slot and is still
  // separated from. Candidate records come from a pool that only grows, so a decision allocates
  // none.
  boidNeighborScratch.length = 0
  let pooled = 0
  FISH_REGISTRY.forEach((other, id) => {
    if (id === creature.id || other.biome !== creature.biome) return
    boidDelta.subVectors(fish.position, other.position)
    boidDelta.y *= 0.55
    const distanceSq = boidDelta.lengthSq()
    if (distanceSq < 0.000001 || distanceSq > perceptionRadiusSq) return
    let candidate = boidNeighborPool[pooled]
    if (!candidate) {
      candidate = { id: null, other: null, distanceSq: 0 }
      boidNeighborPool[pooled] = candidate
    }
    pooled += 1
    candidate.id = id
    candidate.other = other
    candidate.distanceSq = distanceSq
    boidNeighborScratch.push(candidate)
  })
  boidNeighborScratch.sort(byDistanceSq)

  let neighborCount = 0
  let socialWeightTotal = 0
  boidAlignment.set(0, 0, 0)
  boidCenter.set(0, 0, 0)
  separationDelta.set(0, 0, 0)

  for (let i = 0; i < boidNeighborScratch.length && neighborCount < params.neighborCap; i += 1) {
    const { id: otherId, other, distanceSq } = boidNeighborScratch[i]
    const distance = Math.sqrt(Math.max(distanceSq, 0.000001))
    let relation = 'neutral'
    let socialWeight = 0
    // A threat that also took a neighbor slot is drawn once, as a neighbor to avoid.
    if (boidAvoidIds.delete(otherId)) relation = 'avoid'

    {
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
    }
  }
  // Threats pushing this fish that were not among its neighbors still show in the debug overlay.
  if (debugState) boidAvoidIds.forEach(id => recordDebugNeighbor(debugState, id, FISH_REGISTRY.get(id), 'avoid', 0))

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

// How alarming the worst threat near `position` is right now: the same menace × wariness ×
// proximity² that scales the threat push, taken as a max rather than a sum, so a sardine beside
// a charging mako reads ~0.8 and one near a mahi at most ~0.34. The boid steering that reacts to
// threats is only re-decided every 1–2.6 s; this reads just THREAT_ENTRIES, so it is cheap
// enough to run every frame and catch a threat between decisions. `escapeOut`, when given, gets
// the unit direction away from the worst threat's path — the way a startled fish should flee.
export function threatLevelAt(position, creature, swim, escapeOut = null) {
  if (THREAT_ENTRIES.size === 0) return 0
  const params = boidParamsForCreature(creature, swim)
  if (params.wariness <= 0) return 0
  const threatRadius = boidPerceptionRadius(creature, swim, params) * BOID_THREAT_PERCEPTION_SCALE
  let level = 0
  THREAT_ENTRIES.forEach((other, id) => {
    if (id === creature.id || other.biome !== creature.biome) return
    const threatPair = other.menace * params.wariness
    if (threatPair <= BOID_THREAT_MIN_PAIR || threatPair <= level) return
    if (!closestThreatApproach(threatLevelOffset, position, other)) return
    const proximity = THREE.MathUtils.clamp(1 - threatLevelOffset.length() / threatRadiusToward(other, threatRadius), 0, 1)
    const candidate = threatPair * proximity * proximity
    if (candidate > level) {
      level = candidate
      if (escapeOut) escapeOut.copy(threatLevelOffset).normalize()
    }
  })
  return level
}

// `speed` is world units per second along `forward`, so other fish can predict where this one
// is heading. 0 (the default) means "treat it as stationary".
export function updateFishRegistry(fish, creature, swim, school = null, forward = null, speed = 0) {
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
    entry.speed = speed
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
      speed,
    })
  }
  if (boidParams.menace > 0) THREAT_ENTRIES.set(creature.id, FISH_REGISTRY.get(creature.id))
  else THREAT_ENTRIES.delete(creature.id)
}

// `SCHOOL_STATES`, `FISH_REGISTRY` and `THREAT_ENTRIES` stay private to this module. `Fish.jsx`
// only ever cleans up or reads, so it gets these four accessors instead of the Maps.

/** Drop a school's shared state on unmount, but only if it is still the live one. */
export function releaseSchoolState(schoolId, schoolState) {
  if (SCHOOL_STATES.get(schoolId) === schoolState) SCHOOL_STATES.delete(schoolId)
}

/** Drop a fish from the neighbour registry on unmount. */
export function unregisterFish(creatureId) {
  FISH_REGISTRY.delete(creatureId)
  THREAT_ENTRIES.delete(creatureId)
}

/** Walk every registered fish. Used by the debug overlay. */
export function forEachFish(fn) {
  FISH_REGISTRY.forEach(fn)
}

/** Read one registered fish, or undefined if it has unmounted. */
export function getFishEntry(creatureId) {
  return FISH_REGISTRY.get(creatureId)
}
