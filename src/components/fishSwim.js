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
const PROJECTED_SCREEN_HALF_X_SCALE = Math.tan(THREE.MathUtils.degToRad(TANK_CAMERA_FOV_DEG) * 0.5)
  * TANK_CAMERA_ASPECT
  * SCREEN_X_SAFE_FRACTION
  * GLOBAL_X_DESTINATION_RANGE_SCALE
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
const SOLO_AGENT_BOUNDARY_TRUE_ARC_ALIGNMENT = -0.25
const SOLO_AGENT_BOUNDARY_CONTACT_INWARD_BIAS = 0.08
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

// Soft side, front and back walls for schools, as verticalBoundRepulsion is for the top and
// bottom: within `margin` of a wall a fish is steered away, quadratically harder toward it, up to
// SOFT_WALL_STRENGTH at it. The side walls follow the camera's view, so their half-width is read
// at the fish's own depth. Writes the push (x and z; y is 0) into `out`.
export function horizontalBoundRepulsion(out, position, bounds, margin) {
  out.set(0, 0, 0)
  if (!(margin > 0)) return out
  const halfX = projectedScreenHalfXAtZ(position.z)
  const k = projectedScreenSideKAtZ(position.z)
  const sideNormalLength = Math.hypot(1, k)
  const intoRight = THREE.MathUtils.clamp(1 - ((halfX - position.x) / sideNormalLength) / margin, 0, 1)
  const intoLeft = THREE.MathUtils.clamp(1 - ((halfX + position.x) / sideNormalLength) / margin, 0, 1)
  const intoFront = THREE.MathUtils.clamp((position.z - (bounds.zMax - margin)) / margin, 0, 1)
  const intoBack = THREE.MathUtils.clamp((bounds.zMin + margin - position.z) / margin, 0, 1)
  if (intoRight > 0) {
    setSideBoundaryOutwardNormal(agentBoundaryNormal, 1, position.z)
    out.addScaledVector(agentBoundaryNormal, -(intoRight * intoRight) * SOFT_WALL_STRENGTH)
  }
  if (intoLeft > 0) {
    setSideBoundaryOutwardNormal(agentBoundaryNormal, -1, position.z)
    out.addScaledVector(agentBoundaryNormal, -(intoLeft * intoLeft) * SOFT_WALL_STRENGTH)
  }
  out.z = (intoBack * intoBack - intoFront * intoFront) * SOFT_WALL_STRENGTH
    + out.z
  return out
}

// A school member pressed against a side, front or back wall slides along it: the part of its
// heading pointing into the wall is removed, as glideAlongCeiling does at the top. clampToSwimBounds
// holds the position on the wall but left the heading aimed into it, and boid alignment spread
// that heading through the school: in review, all 95 sardines of a school sat on the front wall
// for 12 s and then folded into its corner with a side wall, a vertical line seen from the camera.
// Heading straight into a wall (nothing left along it), the fish turns along the wall toward the
// middle of the tank. Returns whether it changed the heading.
export function glideAlongWalls(direction, position, bounds) {
  const contacts = swimBoundaryContactMask(position, bounds) & SWIM_BOUNDARY_CONTACT_HORIZONTAL
  if (!contacts) return false
  const changed = applyBoundaryContactRecovery(direction, position, contacts, 0)
  if (!changed) return false
  if (direction.x * direction.x + direction.z * direction.z < 0.0001) {
    // Nothing remains in the horizontal plane. A single-wall hit takes the tangent toward the
    // tank middle; a corner takes the diagonal back into the feasible volume.
    if (contacts & (SWIM_BOUNDARY_CONTACT_LEFT | SWIM_BOUNDARY_CONTACT_RIGHT)) {
      const middleZ = (bounds.zMin + bounds.zMax) / 2
      direction.z = middleZ === position.z ? 1 : Math.sign(middleZ - position.z)
    }
    if (contacts & (SWIM_BOUNDARY_CONTACT_BACK | SWIM_BOUNDARY_CONTACT_FRONT)) {
      direction.x = position.x === 0 ? 1 : -Math.sign(position.x)
    }
  }
  direction.normalize()
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

// Ordinary cruising keeps the long-established normalized-lerp turn feel. Only an active
// boundary recovery takes the true-angle path when the target is mostly behind the fish; this
// avoids the lerp singularity that can hold an exactly astern target at zero visible turn until
// it flips. `side` is deterministic per fish and matters only at the exact 180-degree tie.
export function turnDirectionTowardWithBoundaryRecovery(current, target, maxAngle, recovering, side = 1) {
  if (recovering && current.dot(target) < SOLO_AGENT_BOUNDARY_TRUE_ARC_ALIGNMENT) {
    yawToward(current, target, maxAngle, side)
    pitchToward(current, target, maxAngle)
    return current
  }
  return rotateDirectionToward(current, target, maxAngle)
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

  if (species?.family === 'Echeneidae') {
    // Long, low, slightly flattened; sizes a remora's tap target, stand-in or supplied model.
    return {
      length: swim.bodyLengthWU,
      height: swim.bodyLengthWU * 0.13,
      thickness: swim.bodyLengthWU * 0.15,
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

  if (species?.family === 'Echeneidae') {
    // Generous tap target: the body is a thin sliver at tank distance.
    const dims = placeholderDimensions(species, swim)
    return [dims.length * 1.05, Math.max(0.3, dims.height * 2), Math.max(0.3, dims.thickness * 2)]
  }

  return [0.72, 0.28, 0.22]
}

function projectedScreenHalfXAtZ(z) {
  const distanceFromCamera = Math.max(0.5, TANK_CAMERA_Z - z)
  return Math.max(1.5, distanceFromCamera * PROJECTED_SCREEN_HALF_X_SCALE)
}

// The visible side bounds are frustum planes, not fixed-X slabs. `k` is the positive Z
// component of either plane's outward normal before normalization: as a fish comes toward the
// camera (+Z), the legal half-width narrows by k WU per Z WU. The minimum-width/camera-distance
// floors make the plane flat outside the shipping swim volume, so report zero there.
function projectedScreenSideKAtZ(z) {
  const distanceFromCamera = Math.max(0.5, TANK_CAMERA_Z - z)
  const rawHalfX = distanceFromCamera * PROJECTED_SCREEN_HALF_X_SCALE
  return TANK_CAMERA_Z - z > 0.5 && rawHalfX > 1.5
    ? PROJECTED_SCREEN_HALF_X_SCALE
    : 0
}

function setSideBoundaryOutwardNormal(out, side, z) {
  const k = projectedScreenSideKAtZ(z)
  const inverseLength = 1 / Math.hypot(1, k)
  return out.set(side * inverseLength, 0, k * inverseLength)
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

export const SWIM_BOUNDARY_CONTACT_LEFT = 1 << 0
export const SWIM_BOUNDARY_CONTACT_RIGHT = 1 << 1
export const SWIM_BOUNDARY_CONTACT_BACK = 1 << 2
export const SWIM_BOUNDARY_CONTACT_FRONT = 1 << 3
export const SWIM_BOUNDARY_CONTACT_FLOOR = 1 << 4
export const SWIM_BOUNDARY_CONTACT_CEILING = 1 << 5
const SWIM_BOUNDARY_CONTACT_HORIZONTAL = SWIM_BOUNDARY_CONTACT_LEFT
  | SWIM_BOUNDARY_CONTACT_RIGHT
  | SWIM_BOUNDARY_CONTACT_BACK
  | SWIM_BOUNDARY_CONTACT_FRONT
const SWIM_BOUNDARY_CONTACT_EPSILON = 0.0001

export function swimBoundaryContactMask(point, bounds, epsilon = SWIM_BOUNDARY_CONTACT_EPSILON) {
  const halfX = projectedScreenHalfXAtZ(point.z)
  let contacts = 0
  if (point.x <= -halfX + epsilon) contacts |= SWIM_BOUNDARY_CONTACT_LEFT
  if (point.x >= halfX - epsilon) contacts |= SWIM_BOUNDARY_CONTACT_RIGHT
  if (point.z <= bounds.zMin + epsilon) contacts |= SWIM_BOUNDARY_CONTACT_BACK
  if (point.z >= bounds.zMax - epsilon) contacts |= SWIM_BOUNDARY_CONTACT_FRONT
  if (point.y <= bounds.yMin + epsilon) contacts |= SWIM_BOUNDARY_CONTACT_FLOOR
  if (point.y >= bounds.yMax - epsilon) contacts |= SWIM_BOUNDARY_CONTACT_CEILING
  return contacts
}

function clampSwimPoint(point, bounds) {
  point.z = THREE.MathUtils.clamp(point.z, bounds.zMin, bounds.zMax)
  const halfX = projectedScreenHalfXAtZ(point.z)
  point.x = THREE.MathUtils.clamp(point.x, -halfX, halfX)
  point.y = THREE.MathUtils.clamp(point.y, bounds.yMin, bounds.yMax)
}

export function clampToSwimBounds(point, bounds) {
  clampSwimPoint(point, bounds)
  return point
}

// Same positional clamp, with a numeric contact mask for the runtime steering feedback loop.
// Returning a scalar keeps the per-frame path allocation-free while preserving the chained
// point-returning API above for target generation and existing callers.
export function clampToSwimBoundsWithContacts(point, bounds) {
  clampSwimPoint(point, bounds)
  return swimBoundaryContactMask(point, bounds)
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
  const k = projectedScreenSideKAtZ(position.z)
  let best = Infinity
  const towardRight = forward.x + k * forward.z
  if (towardRight > 1e-4) {
    const t = (halfX - position.x) / towardRight
    if (t >= 0) best = t
  }
  const towardLeft = -forward.x + k * forward.z
  if (towardLeft > 1e-4) {
    const t = (halfX + position.x) / towardLeft
    if (t >= 0 && t < best) best = t
  }
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

// Clips a heading into the feasible half-space of every active wall. A single contact removes
// only its outward component. At a corner the side and depth normals are not orthogonal, so
// sequential projections can make an earlier wall outward again; instead move once along the
// normalized sum of all inward normals far enough to satisfy every plane. Scalar/unrolled on the
// hot path: no arrays, callbacks or temporary vectors.
function applyBoundaryContactRecovery(direction, position, contacts, inwardBias) {
  if (!contacts) return false
  const k = projectedScreenSideKAtZ(position.z)
  const sideInverseLength = 1 / Math.hypot(1, k)
  const sideZ = k * sideInverseLength
  let sumX = 0
  let sumY = 0
  let sumZ = 0
  let contactCount = 0
  let hasOutward = false

  if (contacts & SWIM_BOUNDARY_CONTACT_LEFT) {
    sumX -= sideInverseLength
    sumZ += sideZ
    contactCount += 1
    if (-direction.x * sideInverseLength + direction.z * sideZ > 1e-9) hasOutward = true
  }
  if (contacts & SWIM_BOUNDARY_CONTACT_RIGHT) {
    sumX += sideInverseLength
    sumZ += sideZ
    contactCount += 1
    if (direction.x * sideInverseLength + direction.z * sideZ > 1e-9) hasOutward = true
  }
  if (contacts & SWIM_BOUNDARY_CONTACT_BACK) {
    sumZ -= 1
    contactCount += 1
    if (-direction.z > 1e-9) hasOutward = true
  }
  if (contacts & SWIM_BOUNDARY_CONTACT_FRONT) {
    sumZ += 1
    contactCount += 1
    if (direction.z > 1e-9) hasOutward = true
  }
  if (contacts & SWIM_BOUNDARY_CONTACT_FLOOR) {
    sumY -= 1
    contactCount += 1
    if (-direction.y > 1e-9) hasOutward = true
  }
  if (contacts & SWIM_BOUNDARY_CONTACT_CEILING) {
    sumY += 1
    contactCount += 1
    if (direction.y > 1e-9) hasOutward = true
  }
  if (!hasOutward) return false

  if (contactCount === 1) {
    const outward = direction.x * sumX + direction.y * sumY + direction.z * sumZ
    direction.x -= (outward + inwardBias) * sumX
    direction.y -= (outward + inwardBias) * sumY
    direction.z -= (outward + inwardBias) * sumZ
    if (direction.lengthSq() > 1e-12) direction.normalize()
    return true
  }

  const sumLength = Math.hypot(sumX, sumY, sumZ)
  if (sumLength < 1e-9) return false
  const inwardX = -sumX / sumLength
  const inwardY = -sumY / sumLength
  const inwardZ = -sumZ / sumLength
  let requiredDistance = 0
  let outward
  let inwardRate

  if (contacts & SWIM_BOUNDARY_CONTACT_LEFT) {
    outward = -direction.x * sideInverseLength + direction.z * sideZ
    inwardRate = -(-inwardX * sideInverseLength + inwardZ * sideZ)
    if (outward > 0 && inwardRate > 1e-9) requiredDistance = Math.max(requiredDistance, outward / inwardRate)
  }
  if (contacts & SWIM_BOUNDARY_CONTACT_RIGHT) {
    outward = direction.x * sideInverseLength + direction.z * sideZ
    inwardRate = -(inwardX * sideInverseLength + inwardZ * sideZ)
    if (outward > 0 && inwardRate > 1e-9) requiredDistance = Math.max(requiredDistance, outward / inwardRate)
  }
  if (contacts & SWIM_BOUNDARY_CONTACT_BACK) {
    outward = -direction.z
    inwardRate = inwardZ
    if (outward > 0 && inwardRate > 1e-9) requiredDistance = Math.max(requiredDistance, outward / inwardRate)
  }
  if (contacts & SWIM_BOUNDARY_CONTACT_FRONT) {
    outward = direction.z
    inwardRate = -inwardZ
    if (outward > 0 && inwardRate > 1e-9) requiredDistance = Math.max(requiredDistance, outward / inwardRate)
  }
  if (contacts & SWIM_BOUNDARY_CONTACT_FLOOR) {
    outward = -direction.y
    inwardRate = inwardY
    if (outward > 0 && inwardRate > 1e-9) requiredDistance = Math.max(requiredDistance, outward / inwardRate)
  }
  if (contacts & SWIM_BOUNDARY_CONTACT_CEILING) {
    outward = direction.y
    inwardRate = -inwardY
    if (outward > 0 && inwardRate > 1e-9) requiredDistance = Math.max(requiredDistance, outward / inwardRate)
  }

  const recoveryDistance = requiredDistance + inwardBias
  direction.x += inwardX * recoveryDistance
  direction.y += inwardY * recoveryDistance
  direction.z += inwardZ * recoveryDistance
  if (direction.lengthSq() > 1e-12) direction.normalize()
  return true
}

export function shapeDirectionForBoundaryContacts(direction, position, bounds, contacts = 0) {
  const activeContacts = contacts | swimBoundaryContactMask(position, bounds)
  return applyBoundaryContactRecovery(
    direction,
    position,
    activeContacts,
    SOLO_AGENT_BOUNDARY_CONTACT_INWARD_BIAS,
  )
}

function softenDirectionNearBoundary(direction, normal, distance, threshold) {
  if (distance >= threshold) return false
  const outward = direction.dot(normal)
  if (outward <= 0) return false
  const proximity = THREE.MathUtils.clamp(1 - distance / threshold, 0, 1)
  direction.addScaledVector(normal, -outward * proximity)
  return true
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

  let changed = shapeDirectionForBoundaryContacts(out, position, bounds)
  const threshold = Math.max(0.42, bodyLength * AGENT_BOUNDARY_TANGENT_DISTANCE_BODY_LENGTHS)
  const halfX = projectedScreenHalfXAtZ(position.z)
  const sideNormalLength = Math.hypot(1, projectedScreenSideKAtZ(position.z))

  // Two fixed passes let simultaneous near-wall constraints settle without arrays or a dynamic
  // solver. Exact contacts already use the active-set correction above, so corners are guaranteed
  // feasible; this is only the smooth run-up before contact.
  for (let pass = 0; pass < 2; pass += 1) {
    setSideBoundaryOutwardNormal(agentBoundaryNormal, -1, position.z)
    changed = softenDirectionNearBoundary(
      out,
      agentBoundaryNormal,
      (halfX + position.x) / sideNormalLength,
      threshold,
    ) || changed
    setSideBoundaryOutwardNormal(agentBoundaryNormal, 1, position.z)
    changed = softenDirectionNearBoundary(
      out,
      agentBoundaryNormal,
      (halfX - position.x) / sideNormalLength,
      threshold,
    ) || changed
    agentBoundaryNormal.set(0, 0, -1)
    changed = softenDirectionNearBoundary(out, agentBoundaryNormal, position.z - bounds.zMin, threshold) || changed
    agentBoundaryNormal.set(0, 0, 1)
    changed = softenDirectionNearBoundary(out, agentBoundaryNormal, bounds.zMax - position.z, threshold) || changed
    agentBoundaryNormal.set(0, -1, 0)
    changed = softenDirectionNearBoundary(out, agentBoundaryNormal, position.y - bounds.yMin, threshold) || changed
    agentBoundaryNormal.set(0, 1, 0)
    changed = softenDirectionNearBoundary(out, agentBoundaryNormal, bounds.yMax - position.y, threshold) || changed
  }

  if (changed) {
    if (out.lengthSq() < 0.0001) out.copy(forward)
    if (out.lengthSq() < 0.0001) out.set(0, 0, -1)
    out.normalize()
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

// The furthest any slot sits from the school's centre across the ground plane, whichever way the
// school heads: its lateral and longitudinal spreads combined. Used like the vertical extent, to
// keep the goal and the formation off the side, front and back walls.
export function schoolFormationHorizontalHalfExtent(school, creature) {
  if (!school) return 0
  return schoolFormationRadius(school, creature) * Math.hypot(1, SCHOOL_LONGITUDINAL_SPREAD) + 0.045
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
  const rideHostId = FISH_REGISTRY.get(creature.id)?.rideHostId ?? null

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
    // A remora and the host it is riding (or closing on) ignore each other: the rider has to
    // reach contact, and the host must not shoulder aside the fish clamped to its belly.
    if (id === rideHostId || other.rideHostId === creature.id) return
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
export function updateFishRegistry(fish, creature, swim, school = null, forward = null, speed = 0, rideHostId = null) {
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
    entry.rideHostId = rideHostId
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
      rideHostId,
      // Rendered pose, published only by ride hosts, which also overwrite `speed` with their actual travel speed (see updateFishRegistryPose).
      hasPose: false,
      quaternion: new THREE.Quaternion(),
      opacity: 1,
      // Live caudal-wave state, published only by ride hosts (see updateFishRegistryPose).
      wave: null,
    })
  }
  if (boidParams.menace > 0) THREAT_ENTRIES.set(creature.id, FISH_REGISTRY.get(creature.id))
  else THREAT_ENTRIES.delete(creature.id)
}

/**
 * Publish a ride host's final rendered pose for this frame: model-frame orientation (forward
 * -Z, up +Y, right +X, bank and roll included), actual travel speed, and fade opacity. Hosts
 * run their frame before everyone else, so riders read this frame's pose, not the last one.
 * `wave` is the host's live caudal-wave state ({ phase, speed01, turn, burst }), held by
 * reference: its renderer updates it every frame and clamped riders follow it.
 */
export function updateFishRegistryPose(creatureId, quaternion, speed = 0, opacity = 1, wave = null) {
  const entry = FISH_REGISTRY.get(creatureId)
  if (!entry) return
  entry.quaternion.copy(quaternion)
  entry.speed = Number.isFinite(speed) ? speed : 0
  entry.opacity = opacity
  entry.wave = wave
  entry.hasPose = true
}

/**
 * The caudal-vertex wave's sideways offset at `tail01` (0 at the nose, 1 at the tail) and its
 * rate of change along the body per unit of `tail01`, both in the model's source units, for
 * parts moved on the CPU (independent fins, clamped riders). Mirrors proceduralFishCurve in the
 * Fish.jsx shader; keep the two in step.
 */
export function caudalLateralCurve(out, tail01, config, phase, speed01, turn, burst) {
  const flexStart = config.flexStart ?? 0.18
  const flexRange = Math.max(0.0001, (config.flexFull ?? 0.82) - flexStart)
  const flexT = THREE.MathUtils.clamp((tail01 - flexStart) / flexRange, 0, 1)
  const flex = flexT * flexT * (3 - 2 * flexT)
  const dFlex = flexT > 0 && flexT < 1 ? (6 * flexT * (1 - flexT)) / flexRange : 0
  const waveTravel = config.waveTravel ?? 5.2
  const wavePhase = phase - tail01 * waveTravel
  const wave = Math.sin(wavePhase)
  const dWave = -Math.cos(wavePhase) * waveTravel
  const stroke = (config.amplitude ?? 0.16) * THREE.MathUtils.lerp(0.42, 1, speed01) * (1 + burst * (config.burstAmplitude ?? 0.55))
  const turnStrength = config.turnStrength ?? 0.22
  out.offset = wave * stroke * flex + turn * turnStrength * flex * flex
  out.slope = stroke * (dWave * flex + wave * dFlex) + turn * turnStrength * 2 * flex * dFlex
  return out
}

// --- Ride hosts and hitchhikers (remoras) --------------------------------------------------
//
// A hitchhiker clamps its dorsal suction disc to one of a host's anchor points and is carried.
// Host species declare where riders may sit (`rideHost.anchors`) and which kinds of host they
// are (`rideHost.groups`, e.g. 'shark'); rider species declare which kinds they ride and how
// readily (`hitchhiker.hosts`, group -> 0..1). Matching is by group, so a new host species is
// ridden by every remora that rides its kind without any rider-side edit.
//
// Anchors are in host body lengths, measured from the host's model root in the model frame
// (+X right, +Y up, +Z toward the tail). `normal` is the outward surface normal there; the
// rider's back (its disc) faces the host along it.
//
// While clamped, a rider does not run the steer -> boids -> integrate pipeline at all: its
// pose is the host's pose composed with the anchor, the same way the Mola sun-bask hold owns
// its position outright. Approaching a host is ordinary steering toward a moving target — but
// never through the host: `rideHost.body` is a clearance ellipsoid around the host's body, the
// rider swings around it to a staging point just outside its anchor, and only then slides in
// along the surface normal.

const RIDE_SLOTS = new Map()
const rideHostProfiles = new WeakMap()
const hitchhikerProfiles = new WeakMap()
// Root-to-disc-top height: matches DISC_TOP in scripts/build-remora-placeholders.mjs, so the
// stand-in's disc sits exactly on the host's skin. Set per species from a supplied model.
const RIDE_DEFAULT_DORSAL_CLEARANCE_BODY_LENGTHS = 0.058
// How far below the disc top the rider's back sits at its rear contact point (0.2 body
// lengths behind its root): the stand-in's back there is at 0.037 against a 0.058 disc top.
const RIDE_DEFAULT_CONTACT_DROP_BODY_LENGTHS = 0.021
// Laying a rider along the skin (rideAnchorFit): the rear contact point sits this far behind
// its root, and the tilt never exceeds this, whatever an odd rail sample says.
const RIDE_FIT_CONTACT_BEHIND_ROOT = 0.2
const RIDE_FIT_MAX_TILT = THREE.MathUtils.degToRad(25)
// Fitting a rider to the skin: a gap under the disc costs this much more than the same gap
// along the rest of the body, and the tilt is found to within (0.618^steps) of the range.
const RIDE_FIT_DISC_WEIGHT = 2
const RIDE_FIT_GOLDEN = (Math.sqrt(5) - 1) / 2
const RIDE_FIT_SEARCH_STEPS = 40
const RIDE_FIT_MEAN_SAMPLES = 40
// A clamped rider bends its rear body onto the skin: from this far along it (0 nose .. 1 tail,
// behind the disc and pectoral fins) toward its own up, as (t - start)^2, at most this much at
// the tail (rider body lengths). The fit picks how much, with the tilt.
export const RIDE_BEND_START = 0.3
const RIDE_BEND_MAX_BODY_LENGTHS = 0.15
const RIDE_FIT_BEND_STEPS = 30

/** How much of the tail bend a point `tail01` along a rider takes (0 ahead of the bend). */
export function rideBendProfile(tail01) {
  const t = THREE.MathUtils.clamp((tail01 - RIDE_BEND_START) / (1 - RIDE_BEND_START), 0, 1)
  return t * t
}
// Rail samples at or below this (host body lengths) mean "no skin here" (past the snout,
// off a thin fin) and do not constrain the rider.
const RIDE_RAIL_NO_SKIN = -0.2
const RIDE_DEFAULT_DISC_AHEAD_BODY_LENGTHS = 0.26
const RIDE_DEFAULT_SECONDS = [45, 110]
const RIDE_DEFAULT_FREE_SECONDS = [15, 35]
const RIDE_FIRST_DECISION_SECONDS = [3, 10]
const RIDE_RETRY_SECONDS = [6, 14]
const RIDE_LATCH_SECONDS = 1.1
export const RIDE_RELEASE_SECONDS = 1.4
// Latching starts once the rider reaches its staging point, which sits outside the host's
// clearance ellipsoid on the anchor's normal; the latch then slides it in along that normal.
const RIDE_LATCH_DISTANCE_BODY_LENGTHS = 0.35
const RIDE_LATCH_DISTANCE_MIN = 0.5
// Clearance around the host body, as a fraction of the rider's length (its half-depth plus
// a little), and how far past the clearance surface the staging point sits.
const RIDE_CLEARANCE_MARGIN_BODY_LENGTHS = 0.2
const RIDE_STAGING_EXTRA_BODY_LENGTHS = 0.15
// Swinging around the body: waypoints sit this far out on the normalized clearance ellipsoid
// and at most this far around it from the rider, so the path orbits instead of cutting across.
const RIDE_AVOID_RADIUS = 1.25
const RIDE_AVOID_STEP = THREE.MathUtils.degToRad(45)
const RIDE_DEFAULT_BODY = { center: [0, 0, 0], radii: [0.1, 0.1, 0.5] }
// Give up on a host the rider cannot catch: time allowed scales with the distance it had to
// cover at burst speed, so a remora does not chase a cruising mako around the tank forever.
const RIDE_APPROACH_TIMEOUT_SCALE = 3
// Escorting: a remora with no room on a host, or one that has just let go of it, may swim
// with the host instead of roaming off: shadowing it below and beside its belly the way
// remoras follow a shark, until a spot opens or it loses interest. It holds a loose station
// in the clearance ellipsoid's normalized space: `ALONG` along the body (-1 nose .. 1 tail),
// `ANGLE` round it (0 = the host's right, -90 degrees = straight below), `RADIUS` out from
// the body (1 = the clearance surface), each drifting slowly by its `DRIFT` so it never
// settles into a formation.
const RIDE_ESCORT_CHANCE = 0.7
const RIDE_ESCORT_AFTER_RELEASE_CHANCE = 0.5
const RIDE_ESCORT_SECONDS = [25, 60]
const RIDE_ESCORT_RECHECK_SECONDS = [4, 8]
const RIDE_ESCORT_RANGE_BODY_LENGTHS = 3
const RIDE_ESCORT_ALONG = [-0.45, 0.4]
const RIDE_ESCORT_ALONG_DRIFT = 0.12
const RIDE_ESCORT_ANGLE = [THREE.MathUtils.degToRad(-165), THREE.MathUtils.degToRad(-15)]
const RIDE_ESCORT_ANGLE_DRIFT = THREE.MathUtils.degToRad(18)
const RIDE_ESCORT_RADIUS = [1.25, 1.9]
const RIDE_ESCORT_RADIUS_DRIFT = 0.15
const RIDE_ESCORT_DRIFT_RATE = [0.12, 0.3]
// Loose following: the host's velocity plus a closing velocity toward the station that grows
// with the distance, so an escort lags on a turn and drifts back rather than snapping in.
const RIDE_ESCORT_CLOSING_GAIN = 0.45
const RIDE_ESCORT_BURST_SCALE = 1.1
const rideEscortLocal = new THREE.Vector3()
const RIDE_APPROACH_TIMEOUT_RANGE = [12, 30]
// Docking: once within this normalized radius of the host's clearance ellipsoid (or this
// close to its staging point) a remora moves in the host's frame at a relative speed that
// closes the remaining distance (per second, from a slow creep), turning to face the host's
// way, and gives up if it has not reached its spot in RIDE_DOCK_SECONDS.
const RIDE_DOCK_RADIUS = 1.6
const RIDE_DOCK_DISTANCE_MIN = 3
const RIDE_DOCK_DISTANCE_BODY_LENGTHS = 1.2
const RIDE_DOCK_SECONDS = 12
const RIDE_DOCK_GAIN = 1
const RIDE_DOCK_MIN_SPEED = 0.8
const RIDE_DOCK_TURN_RESPONSE = 2.5
const RIDE_IDENTITY = new THREE.Quaternion()
// Closing speed relative to the host: proportional to the remaining distance (per second),
// never below a slow creep, never above 1.2x burst.
const RIDE_APPROACH_CLOSING_GAIN = 0.8
const RIDE_APPROACH_CLOSING_MIN = 0.6
const RIDE_APPROACH_BURST_SCALE = 1.2
// Releasing, a remora swims forward off the disc and peels away from the host's surface.
const RIDE_RELEASE_PEEL = 0.35
// A rider never sits above the water: it lets go before a host (a basking Mola rolled onto
// its side) would lift it out, and never picks an anchor that is already up there.
const RIDE_SURFACE_CLEARANCE_MIN = 0.35
const RIDE_SURFACE_CLEARANCE_BODY_LENGTHS = 0.12
const rideLocalOffset = new THREE.Vector3()
const rideSearchPosition = new THREE.Vector3()
const rideSearchQuaternion = new THREE.Quaternion()
const rideInverseQuaternion = new THREE.Quaternion()
const rideHostForward = new THREE.Vector3()
const rideLocalRider = new THREE.Vector3()
const rideLocalStaging = new THREE.Vector3()
const rideLocalWaypoint = new THREE.Vector3()
const rideNormalizedA = new THREE.Vector3()
const rideNormalizedB = new THREE.Vector3()
const rideNormalizedC = new THREE.Vector3()
const rideAxis = new THREE.Vector3()
const rideDesiredVelocity = new THREE.Vector3()
// A host carries riders up to this much of its own length laid end to end: a 4.2 m mako takes
// three 1.1 m sharksuckers, or about ten white suckerfish. `rideHost.loadRatio` overrides it.
const RIDE_LOAD_RATIO = 0.8
// Riders on one host keep clear of each other: each is a capsule along its body this wide
// (rider body lengths, pectoral fins included).
const RIDE_RIDER_RADIUS_BODY_LENGTHS = 0.06
// The nearest spot wins, give or take this much, so riders spread over a host instead of all
// queuing for the same few spots.
const RIDE_CHOICE_JITTER = 0.35
const rideSegmentA0 = new THREE.Vector3()
const rideSegmentA1 = new THREE.Vector3()
const rideSegmentB0 = new THREE.Vector3()
const rideSegmentB1 = new THREE.Vector3()
const rideSegmentD1 = new THREE.Vector3()
const rideSegmentD2 = new THREE.Vector3()
const rideSegmentR = new THREE.Vector3()
const rideSegmentQ = new THREE.Vector3()
const rideWaveCurve = { offset: 0, slope: 0 }
const rideWaveYaw = new THREE.Quaternion()
const rideWaveDisc = new THREE.Vector3()
const rideLatchTarget = new THREE.Quaternion()
const RIDE_MODEL_FORWARD = new THREE.Vector3(0, 0, -1)
const RIDE_LOCAL_UP = new THREE.Vector3(0, 1, 0)

export function rideHostProfile(species) {
  const config = species?.rideHost
  if (!config?.anchors?.length || !config.groups?.length) return null
  let profile = rideHostProfiles.get(species)
  if (profile) return profile
  // A host with a caudal wave carries its riders with it (rideFollowHostWave). `waveSpan` is the
  // body's nose and tail along Z (host body lengths); the wave is in the model's source units,
  // so `perBodyLength` converts it. Only the plain frame is supported: source Z to the tail,
  // lateral X, no model rotation.
  const procedural = species.model?.proceduralAnimation
  const waveSpan = Array.isArray(config.waveSpan) ? config.waveSpan : null
  const wave = waveSpan && procedural?.type === 'caudal-vertex' && procedural.tailAtMaxZ
    && (procedural.sourceAxis ?? 'z') === 'z' && (procedural.lateralAxis ?? 'x') === 'x'
    && !(species.model.rotation ?? []).some(Boolean)
    ? {
      config: procedural,
      perBodyLength: (species.model.scale ?? 1) / species.swim.bodyLengthWU,
      span: waveSpan[1] - waveSpan[0],
    }
    : null
  const anchors = config.anchors.map((anchor, index) => {
    const at = new THREE.Vector3().fromArray(anchor.at)
    const normal = new THREE.Vector3().fromArray(anchor.normal).normalize()
    // Rider frame on this anchor: its up (dorsal disc) faces into the host, its tail points
    // along the host's tail as far as the surface allows.
    const riderUp = normal.clone().negate()
    const riderBack = new THREE.Vector3(0, 0, 1).addScaledVector(riderUp, -riderUp.z)
    if (riderBack.lengthSq() < 1e-6) riderBack.set(0, 1, 0)
    riderBack.normalize()
    const riderRight = new THREE.Vector3().crossVectors(riderUp, riderBack)
    const quaternion = new THREE.Quaternion().setFromRotationMatrix(
      new THREE.Matrix4().makeBasis(riderRight, riderUp, riderBack),
    )
    // Skin height along the normal at steps along riderBack (scripts/fit-ride-anchors.mjs).
    const rail = Array.isArray(anchor.rail) && anchor.rail.length > 1
      ? [...anchor.rail].sort((a, b) => a[0] - b[0])
      : null
    // Where along the host's wave the disc sits (0 nose .. 1 tail).
    const tail01 = waveSpan ? THREE.MathUtils.clamp((at.z - waveSpan[0]) / (waveSpan[1] - waveSpan[0]), 0, 1) : 0
    return { index, name: anchor.name ?? `anchor-${index}`, at, normal, riderBack, quaternion, rail, fits: new Map(), tail01, wave }
  })
  const body = config.body ?? RIDE_DEFAULT_BODY
  profile = {
    groups: [...config.groups],
    anchors,
    loadRatio: config.loadRatio ?? RIDE_LOAD_RATIO,
    wave,
    // Clearance ellipsoid in host body lengths, model frame, like the anchors.
    body: {
      center: new THREE.Vector3().fromArray(body.center),
      radii: new THREE.Vector3().fromArray(body.radii),
    },
  }
  rideHostProfiles.set(species, profile)
  return profile
}

// Host-local point (WU) -> the clearance ellipsoid's normalized space, where the inflated
// body surface is the unit sphere. `margin` inflates every radius by the rider's clearance.
function rideBodyNormalized(out, localPoint, hostProfile, hostBodyLength, margin) {
  const { center, radii } = hostProfile.body
  return out.set(
    (localPoint.x - center.x * hostBodyLength) / (radii.x * hostBodyLength + margin),
    (localPoint.y - center.y * hostBodyLength) / (radii.y * hostBodyLength + margin),
    (localPoint.z - center.z * hostBodyLength) / (radii.z * hostBodyLength + margin),
  )
}

function rideBodyDenormalized(out, normalized, hostProfile, hostBodyLength, margin) {
  const { center, radii } = hostProfile.body
  return out.set(
    normalized.x * (radii.x * hostBodyLength + margin) + center.x * hostBodyLength,
    normalized.y * (radii.y * hostBodyLength + margin) + center.y * hostBodyLength,
    normalized.z * (radii.z * hostBodyLength + margin) + center.z * hostBodyLength,
  )
}

function rideClearanceMargin(riderBodyLength) {
  return riderBodyLength * RIDE_CLEARANCE_MARGIN_BODY_LENGTHS
}

/**
 * Host-local staging point for `anchor`: out along the anchor's normal from where the rider
 * will sit, just past the host's clearance ellipsoid. Arriving here, the rider is beside its
 * spot and outside the body, so the final slide in cannot cross the host.
 */
export function rideStagingLocal(out, hostProfile, anchor, hostBodyLength, riderBodyLength, hitch) {
  rideAnchorLocalOffset(out, anchor, hostBodyLength, riderBodyLength, hitch)
  const margin = rideClearanceMargin(riderBodyLength)
  // Solve |b + s·a| = 1 in normalized space for the exit distance s along the normal.
  const b = rideBodyNormalized(rideNormalizedA, out, hostProfile, hostBodyLength, margin)
  const { radii } = hostProfile.body
  const a = rideNormalizedB.set(
    anchor.normal.x / (radii.x * hostBodyLength + margin),
    anchor.normal.y / (radii.y * hostBodyLength + margin),
    anchor.normal.z / (radii.z * hostBodyLength + margin),
  )
  const aa = a.dot(a)
  const ab = a.dot(b)
  const bb = b.dot(b)
  const discriminant = ab * ab - aa * (bb - 1)
  const exit = bb < 1 && discriminant > 0 ? (-ab + Math.sqrt(discriminant)) / aa : 0
  return out.addScaledVector(anchor.normal, Math.max(0, exit) + riderBodyLength * RIDE_STAGING_EXTRA_BODY_LENGTHS)
}

// Does the segment p -> t (normalized space) pass through the unit sphere?
function rideSegmentHitsBody(p, t) {
  const d = rideNormalizedC.subVectors(t, p)
  const dd = d.dot(d)
  const along = dd > 1e-9 ? THREE.MathUtils.clamp(-p.dot(d) / dd, 0, 1) : 0
  return rideAxis.copy(p).addScaledVector(d, along).lengthSq() < 1
}

/**
 * Where a rider at `riderLocal` should head next to reach `stagingLocal` without passing
 * through the host (all host-local WU). Inside the clearance it backs straight out; with the
 * host in the way it swings around the body — sideways, over the tail or nose, never across
 * the dorsal or anal fins' plane when it can help it — in steps of RIDE_AVOID_STEP.
 */
export function rideApproachWaypoint(out, hostProfile, hostBodyLength, riderBodyLength, riderLocal, stagingLocal) {
  const margin = rideClearanceMargin(riderBodyLength)
  const p = rideBodyNormalized(rideNormalizedA, riderLocal, hostProfile, hostBodyLength, margin)
  const t = rideBodyNormalized(rideNormalizedB, stagingLocal, hostProfile, hostBodyLength, margin)
  const pLength = p.length()
  if (pLength < 1) {
    // Too close: leave the clearance the shortest way before going anywhere else.
    if (pLength < 1e-4) p.copy(t)
    p.normalize().multiplyScalar(RIDE_AVOID_RADIUS)
    return rideBodyDenormalized(out, p, hostProfile, hostBodyLength, margin)
  }
  if (!rideSegmentHitsBody(p, t)) return out.copy(stagingLocal)

  const from = p.divideScalar(pLength)
  const to = t.normalize()
  const angle = from.angleTo(to)
  rideAxis.crossVectors(from, to)
  if (angle > THREE.MathUtils.degToRad(170) || rideAxis.lengthSq() < 1e-8) {
    // Straight across the body: go round horizontally (about the host's up axis) and behind
    // it, over the tail — where a remora catches up with a host — rather than over the top.
    rideAxis.copy(RIDE_LOCAL_UP)
    if (Math.abs(from.dot(RIDE_LOCAL_UP)) > 0.95) rideAxis.set(1, 0, 0)
    const tailwardZ = rideNormalizedC.copy(from).applyAxisAngle(rideAxis, RIDE_AVOID_STEP).z
    if (tailwardZ < from.z) rideAxis.negate()
  }
  rideAxis.normalize()
  from.applyAxisAngle(rideAxis, Math.min(angle, RIDE_AVOID_STEP)).multiplyScalar(RIDE_AVOID_RADIUS)
  return rideBodyDenormalized(out, from, hostProfile, hostBodyLength, margin)
}

export function hitchhikerProfile(species) {
  const config = species?.hitchhiker
  if (!config?.hosts) return null
  let profile = hitchhikerProfiles.get(species)
  if (profile) return profile
  profile = {
    hosts: { ...config.hosts },
    rideSeconds: config.rideSeconds ?? RIDE_DEFAULT_SECONDS,
    freeSeconds: config.freeSeconds ?? RIDE_DEFAULT_FREE_SECONDS,
    dorsalClearanceBodyLengths: config.dorsalClearanceBodyLengths ?? RIDE_DEFAULT_DORSAL_CLEARANCE_BODY_LENGTHS,
    discAheadBodyLengths: config.discAheadBodyLengths ?? RIDE_DEFAULT_DISC_AHEAD_BODY_LENGTHS,
    contactDropBodyLengths: config.contactDropBodyLengths ?? RIDE_DEFAULT_CONTACT_DROP_BODY_LENGTHS,
    // Measured top line of a supplied model (scripts/fit-rider-model.mjs): `[behind, drop]`
    // pairs in rider body lengths, `behind` measured back from the disc, `drop` below the
    // disc-top line (negative where a fin lobe stands proud of it). Replaces the straight
    // back the stand-ins are fitted with.
    backProfile: Array.isArray(config.backProfile) && config.backProfile.length > 1
      ? [...config.backProfile].sort((a, b) => a[0] - b[0])
      : null,
  }
  profile.backProfileKey = profile.backProfile ? profile.backProfile.flat().join(',') : 'straight'
  hitchhikerProfiles.set(species, profile)
  return profile
}

/** How readily `hitch` takes a host of `hostProfile`'s kind: the best matching group, 0..1. */
export function rideHostWeight(hitch, hostProfile) {
  let weight = 0
  for (const group of hostProfile.groups) weight = Math.max(weight, hitch.hosts[group] ?? 0)
  return weight
}

/**
 * Hold `anchorIndex` on `hostId` for `riderId`. The rider's length and profile are kept with
 * the slot, so later riders can check the host's load and keep clear of it.
 */
export function claimRideSlot(hostId, anchorIndex, riderId, riderLength = 0, hitch = null) {
  let slots = RIDE_SLOTS.get(hostId)
  if (!slots) {
    slots = new Map()
    RIDE_SLOTS.set(hostId, slots)
  }
  const occupant = slots.get(anchorIndex)
  if (occupant && occupant.riderId !== riderId) return false
  slots.set(anchorIndex, { riderId, riderLength, hitch })
  return true
}

export function rideSlotOccupant(hostId, anchorIndex) {
  return RIDE_SLOTS.get(hostId)?.get(anchorIndex)?.riderId ?? null
}

/** Total length of the riders holding spots on `hostId`, leaving out `exceptRiderId`. */
export function rideHostLoad(hostId, exceptRiderId = null) {
  let load = 0
  RIDE_SLOTS.get(hostId)?.forEach(occupant => {
    if (occupant.riderId !== exceptRiderId) load += occupant.riderLength
  })
  return load
}

// Host-local line a rider clamped to `anchor` lies along, head to tail (WU).
function rideRiderSegment(outHead, outTail, anchor, hostBodyLength, riderBodyLength, hitch) {
  const fit = rideAnchorFit(anchor, riderBodyLength / hostBodyLength, hitch)
  rideAnchorLocalOffset(outHead, anchor, hostBodyLength, riderBodyLength, hitch)
  outTail.copy(outHead).addScaledVector(fit.back, 0.5 * riderBodyLength)
  outHead.addScaledVector(fit.back, -0.5 * riderBodyLength)
}

// Closest distance between segments p1-q1 and p2-q2.
function segmentDistance(p1, q1, p2, q2) {
  const d1 = rideSegmentD1.subVectors(q1, p1)
  const d2 = rideSegmentD2.subVectors(q2, p2)
  const r = rideSegmentR.subVectors(p1, p2)
  const a = d1.dot(d1)
  const e = d2.dot(d2)
  const f = d2.dot(r)
  let s = 0
  let t = 0
  if (a <= 1e-9 && e <= 1e-9) return r.length()
  if (a <= 1e-9) {
    t = THREE.MathUtils.clamp(f / e, 0, 1)
  } else {
    const c = d1.dot(r)
    if (e <= 1e-9) {
      s = THREE.MathUtils.clamp(-c / a, 0, 1)
    } else {
      const b = d1.dot(d2)
      const denom = a * e - b * b
      s = denom > 1e-9 ? THREE.MathUtils.clamp((b * f - c * e) / denom, 0, 1) : 0
      t = (b * s + f) / e
      if (t < 0) {
        t = 0
        s = THREE.MathUtils.clamp(-c / a, 0, 1)
      } else if (t > 1) {
        t = 1
        s = THREE.MathUtils.clamp((b - c) / a, 0, 1)
      }
    }
  }
  return rideSegmentQ.copy(p1).addScaledVector(d1, s).sub(r.copy(p2).addScaledVector(d2, t)).length()
}

/**
 * Can a rider of this length clamp to `anchor` without touching the riders already on the
 * host? Each rider is a capsule along its body, RIDE_RIDER_RADIUS_BODY_LENGTHS wide.
 */
export function rideSpotClear(hostId, hostProfile, anchor, hostBodyLength, riderId, riderBodyLength, hitch) {
  const slots = RIDE_SLOTS.get(hostId)
  if (!slots) return true
  rideRiderSegment(rideSegmentA0, rideSegmentA1, anchor, hostBodyLength, riderBodyLength, hitch)
  for (const [anchorIndex, occupant] of slots) {
    if (occupant.riderId === riderId || !occupant.hitch || !hostProfile.anchors[anchorIndex]) continue
    rideRiderSegment(rideSegmentB0, rideSegmentB1, hostProfile.anchors[anchorIndex], hostBodyLength, occupant.riderLength, occupant.hitch)
    const clearance = RIDE_RIDER_RADIUS_BODY_LENGTHS * (riderBodyLength + occupant.riderLength)
    if (segmentDistance(rideSegmentA0, rideSegmentA1, rideSegmentB0, rideSegmentB1) < clearance) return false
  }
  return true
}

/** Free every slot `riderId` holds. Runs on release and when the rider unmounts. */
export function releaseRideSlots(riderId) {
  RIDE_SLOTS.forEach((slots, hostId) => {
    slots.forEach((occupant, anchorIndex) => {
      if (occupant.riderId === riderId) slots.delete(anchorIndex)
    })
    if (slots.size === 0) RIDE_SLOTS.delete(hostId)
  })
}

function rideSurfaceLimitY(riderBodyLength) {
  return SURFACE_PLANE_Y - Math.max(RIDE_SURFACE_CLEARANCE_MIN, riderBodyLength * RIDE_SURFACE_CLEARANCE_BODY_LENGTHS)
}

/**
 * World pose of a rider clamped to `anchor` on `host` (a registry entry with a published
 * pose). The disc sits on the host surface, so the rider's root stands off along the surface
 * normal by its dorsal clearance and trails back from the disc toward its own tail. `blend`
 * below 1 eases from a host-relative start pose captured at latch, so the rider settles onto
 * the host while being carried by it rather than snapping into place.
 */
export function rideAnchorPose(outPosition, outQuaternion, host, anchor, riderBodyLength, hitch, blend = 1, fromLocalPosition = null, fromLocalQuaternion = null) {
  const fit = rideAnchorFit(anchor, riderBodyLength / host.bodyLength, hitch)
  rideAnchorLocalOffset(rideLocalOffset, anchor, host.bodyLength, riderBodyLength, hitch)
  outQuaternion.copy(fit.quaternion)
  if (anchor.wave && host.wave) rideFollowHostWave(rideLocalOffset, outQuaternion, anchor, host)
  if (blend < 1 && fromLocalPosition && fromLocalQuaternion) {
    rideLocalOffset.lerpVectors(fromLocalPosition, rideLocalOffset, blend)
    // Blend toward a copy: slerpQuaternions copies its first argument into `this` before it
    // reads the second, so passing outQuaternion as both target and output held the rider at
    // its docking rotation for the whole latch and snapped it round at the end.
    rideLatchTarget.copy(outQuaternion)
    outQuaternion.slerpQuaternions(fromLocalQuaternion, rideLatchTarget, blend)
  }
  outPosition.copy(rideLocalOffset).applyQuaternion(host.quaternion).add(host.position)
  outQuaternion.premultiply(host.quaternion)
  return outPosition
}

/**
 * Carry a clamped rider with the host's body wave at its spot: sideways by the wave's offset
 * where its disc sits, and turned about the disc with the body's local slope, so the rider moves
 * with the skin instead of the skin sliding under it. Host-local, in place.
 */
export function rideFollowHostWave(localPosition, localQuaternion, anchor, host) {
  const { config, perBodyLength, span } = anchor.wave
  const wave = host.wave
  caudalLateralCurve(rideWaveCurve, anchor.tail01, config, wave.phase, wave.speed01, wave.turn, wave.burst)
  // Source units -> WU along the body, and per tail01 -> per WU along it.
  const slope = (rideWaveCurve.slope * perBodyLength) / span
  rideWaveYaw.setFromAxisAngle(RIDE_LOCAL_UP, Math.atan(slope))
  rideWaveDisc.copy(anchor.at).multiplyScalar(host.bodyLength)
  localPosition.sub(rideWaveDisc).applyQuaternion(rideWaveYaw).add(rideWaveDisc)
  localPosition.x += rideWaveCurve.offset * perBodyLength * host.bodyLength
  localQuaternion.premultiply(rideWaveYaw)
}

/** Host-local position (WU) of a rider's root clamped to `anchor`. */
export function rideAnchorLocalOffset(out, anchor, hostBodyLength, riderBodyLength, hitch) {
  const fit = rideAnchorFit(anchor, riderBodyLength / hostBodyLength, hitch)
  // Disc on the skin (lifted only as far as the fit needs), root below it along the rider's
  // own (tilted) up axis and back from it along its tilted back.
  return out.copy(anchor.at).multiplyScalar(hostBodyLength)
    .addScaledVector(anchor.normal, fit.lift * hostBodyLength)
    .addScaledVector(fit.up, -hitch.dorsalClearanceBodyLengths * riderBodyLength)
    .addScaledVector(fit.back, hitch.discAheadBodyLengths * riderBodyLength)
}

function rideRailAt(rail, s) {
  if (s <= rail[0][0]) return rail[0][1]
  for (let i = 1; i < rail.length; i += 1) {
    if (s <= rail[i][0]) {
      const [s0, h0] = rail[i - 1]
      const [s1, h1] = rail[i]
      return h0 + ((h1 - h0) * (s - s0)) / (s1 - s0)
    }
  }
  return rail.at(-1)[1]
}

/**
 * Lay a rider along the host's skin instead of along the host's axis. A rigid rider touching
 * at its disc drifts off a surface that curves away behind it (a mako's belly and flanks do),
 * and a spot sampled anywhere on a mesh can bulge or dip under it too. So of every tilt along
 * the anchor's rail, the fit takes the one whose pose lies closest to the skin on average,
 * each tilt lifted just enough that no part of the rider cuts in. Lifting the disc off the
 * skin counts extra (RIDE_FIT_DISC_WEIGHT), so a rider stays on its disc when it can.
 * `riderRatio` is rider length over host length. Cached per anchor and rider shape.
 *
 * The rider's top line is its measured `backProfile` (a supplied model, whose fin lobes can
 * stand proud of the line from disc to tail), or for a stand-in a straight back that tapers
 * to `contactDropBodyLengths` below the disc top 0.2 body lengths behind the root.
 *
 * Returns the tilted rider axes in the host frame (`up`, `back`), its host-local rotation
 * (`quaternion`), the lift off the skin at the disc (host body lengths), and the tilt slope.
 */
export function rideAnchorFit(anchor, riderRatio, hitch) {
  const key = `${riderRatio.toFixed(4)}:${hitch.discAheadBodyLengths}:${hitch.contactDropBodyLengths}:${hitch.backProfileKey}`
  let fit = anchor.fits.get(key)
  if (fit) return fit
  let slope = 0
  let lift = 0
  let bend = 0
  if (anchor.rail) {
    const root = hitch.discAheadBodyLengths * riderRatio
    const contact = root + RIDE_FIT_CONTACT_BEHIND_ROOT * riderRatio
    const head = root - 0.5 * riderRatio
    const tail = root + 0.5 * riderRatio
    const profile = hitch.backProfile ?? null
    const contactDrop = hitch.contactDropBodyLengths * riderRatio
    const dropAt = profile
      ? s => rideRailAt(profile, s / riderRatio) * riderRatio
      : s => (s <= 0 ? 0 : contactDrop * Math.min(1, s / contact))
    // How much of the tail bend reaches `s` (host body lengths back from the disc).
    const bendAt = s => rideBendProfile((s - head) / riderRatio)
    // Skin and back are both piecewise linear, and the bend only curves the back toward the
    // skin (the gap is concave between breakpoints), so the rider cuts in first at a rail
    // sample, a kink in the back (disc, contact, a profile sample), or an end of the rider.
    // Checking exactly those is exact, where even sampling can miss. Each is kept as (s,
    // skin - drop, bend share): the height the rider's line must reach there, and how much a
    // bend lowers it.
    const stations = []
    const addStation = s => {
      if (s < head || s > tail) return
      const height = rideRailAt(anchor.rail, s)
      if (height > RIDE_RAIL_NO_SKIN) stations.push(s, height - dropAt(s), bendAt(s))
    }
    for (const s of [head, tail, 0, contact]) addStation(s)
    for (const [s] of anchor.rail) addStation(s)
    if (profile) for (const [behind] of profile) addStation(behind * riderRatio)
    const liftFor = (tilt, tailBend) => {
      let needed = 0
      for (let i = 0; i < stations.length; i += 3) {
        needed = Math.max(needed, stations[i + 1] - tilt * stations[i] + tailBend * stations[i + 2])
      }
      return needed
    }
    // The mean gap along the rider, where there is skin under it, is lift + tilt * (the mean
    // position of that skin) - bend * (the mean bend share there) plus a constant, so this is
    // its cost. It is convex in tilt and bend together (a max of planes plus a plane), so a
    // golden-section search over the bend, each with one over the tilt, finds the best pose.
    let skinSum = 0
    let bendSum = 0
    let skinCount = 0
    for (let i = 0; i <= RIDE_FIT_MEAN_SAMPLES; i += 1) {
      const s = head + ((tail - head) * i) / RIDE_FIT_MEAN_SAMPLES
      if (rideRailAt(anchor.rail, s) > RIDE_RAIL_NO_SKIN) {
        skinSum += s
        bendSum += bendAt(s)
        skinCount += 1
      }
    }
    const skinMean = skinCount > 0 ? skinSum / skinCount : root
    const bendMean = skinCount > 0 ? bendSum / skinCount : 0
    const maxTilt = Math.tan(RIDE_FIT_MAX_TILT)
    const bestTilt = tailBend => {
      const cost = tilt => (1 + RIDE_FIT_DISC_WEIGHT) * liftFor(tilt, tailBend) + tilt * skinMean
      let low = -maxTilt
      let high = maxTilt
      for (let i = 0; i < RIDE_FIT_SEARCH_STEPS; i += 1) {
        const a = high - (high - low) * RIDE_FIT_GOLDEN
        const b = low + (high - low) * RIDE_FIT_GOLDEN
        if (cost(a) <= cost(b)) high = b
        else low = a
      }
      const tilt = (low + high) / 2
      return { tilt, cost: cost(tilt) - tailBend * bendMean }
    }
    let low = 0
    let high = RIDE_BEND_MAX_BODY_LENGTHS * riderRatio
    for (let i = 0; i < RIDE_FIT_BEND_STEPS; i += 1) {
      const a = high - (high - low) * RIDE_FIT_GOLDEN
      const b = low + (high - low) * RIDE_FIT_GOLDEN
      if (bestTilt(a).cost <= bestTilt(b).cost) high = b
      else low = a
    }
    bend = (low + high) / 2
    slope = bestTilt(bend).tilt
    lift = liftFor(slope, bend)
  }
  const angle = Math.atan(slope)
  const axis = new THREE.Vector3().crossVectors(anchor.riderBack, anchor.normal).normalize()
  const tilt = new THREE.Quaternion().setFromAxisAngle(axis, angle)
  fit = {
    slope,
    lift,
    // How far the rider's tail bends onto the skin (host body lengths), along rideBendProfile.
    bend,
    back: anchor.riderBack.clone().applyQuaternion(tilt),
    up: anchor.normal.clone().negate().applyQuaternion(tilt),
    quaternion: tilt.clone().multiply(anchor.quaternion),
  }
  anchor.fits.set(key, fit)
  return fit
}

/** Express a world pose in `host`'s frame (the inverse of the composition above). */
export function rideHostLocalPose(outPosition, outQuaternion, host, worldPosition, worldQuaternion) {
  rideInverseQuaternion.copy(host.quaternion).invert()
  outPosition.subVectors(worldPosition, host.position).applyQuaternion(rideInverseQuaternion)
  outQuaternion.copy(rideInverseQuaternion).multiply(worldQuaternion)
  return outPosition
}

/**
 * Pick the host and free anchor this rider should head for, or null. A host is full once its
 * riders, laid end to end, would pass `loadRatio` of its length; a spot is free only if this
 * rider would clear the riders already there. Candidates are scored by distance over
 * preference, give or take RIDE_CHOICE_JITTER, then the winner is accepted with probability
 * equal to its preference, so an occasional host (a white remora on a shark) is taken only
 * occasionally.
 */
export function findRideHost(rider, riderPosition, riderBodyLength, hitch, rand) {
  const surfaceLimitY = rideSurfaceLimitY(riderBodyLength)
  let best = null
  FISH_REGISTRY.forEach((entry, hostId) => {
    if (hostId === rider.id || entry.biome !== rider.biome || !entry.hasPose || entry.opacity < 0.99) return
    const hostProfile = rideHostProfile(resolveSpecies(entry))
    if (!hostProfile) return
    const weight = rideHostWeight(hitch, hostProfile)
    if (weight <= 0) return
    if (rideHostLoad(hostId, rider.id) + riderBodyLength > entry.bodyLength * hostProfile.loadRatio) return
    for (const anchor of hostProfile.anchors) {
      const occupant = rideSlotOccupant(hostId, anchor.index)
      if (occupant != null && occupant !== rider.id) continue
      rideAnchorPose(rideSearchPosition, rideSearchQuaternion, entry, anchor, riderBodyLength, hitch)
      if (rideSearchPosition.y > surfaceLimitY) continue
      if (!rideSpotClear(hostId, hostProfile, anchor, entry.bodyLength, rider.id, riderBodyLength, hitch)) continue
      const distance = rideSearchPosition.distanceTo(riderPosition)
      const score = (distance / weight) * (1 + RIDE_CHOICE_JITTER * rand())
      if (!best || score < best.score) best = { hostId, anchorIndex: anchor.index, weight, distance, score }
    }
  })
  if (!best || rand() >= best.weight) return null
  return best
}

/**
 * Hard stop: push a rider that is closing on or escorting its host back out to the host's clearance
 * surface. Steering alone cannot promise this — a fast remora's turn radius is wider than
 * the orbit round a shark, and the host turns into it — so, like the swim-bounds clamp, the
 * position is corrected after integration. The push is radial in the clearance ellipsoid's
 * normalized space, so a remora under the belly is moved down, one beside it outward.
 * Returns whether it moved the rider.
 */
export function keepRiderClearOfHost(position, ride, riderBodyLength) {
  if ((ride.stage !== 'approach' && ride.stage !== 'escort') || ride.hostId == null) return false
  const host = FISH_REGISTRY.get(ride.hostId)
  const hostProfile = host?.hasPose ? rideHostProfile(resolveSpecies(host)) : null
  if (!hostProfile) return false
  rideInverseQuaternion.copy(host.quaternion).invert()
  rideLocalRider.subVectors(position, host.position).applyQuaternion(rideInverseQuaternion)
  if (!rideProjectOutOfBody(rideLocalRider, hostProfile, host.bodyLength, riderBodyLength)) return false
  position.copy(rideLocalRider).applyQuaternion(host.quaternion).add(host.position)
  return true
}

// Host-local version: move `localPoint` (WU) out to the clearance surface if it is inside.
function rideProjectOutOfBody(localPoint, hostProfile, hostBodyLength, riderBodyLength) {
  const margin = rideClearanceMargin(riderBodyLength)
  const normalized = rideBodyNormalized(rideNormalizedA, localPoint, hostProfile, hostBodyLength, margin)
  const radius = normalized.length()
  if (radius >= 1) return false
  if (radius < 1e-4) normalized.set(0, -1, 0)
  else normalized.divideScalar(radius)
  rideBodyDenormalized(localPoint, normalized, hostProfile, hostBodyLength, margin)
  return true
}

export function createRideState() {
  return {
    // 'free' | 'escort' | 'approach' | 'dock' | 'latch' | 'attached' | 'release'
    stage: 'free',
    hostId: null,
    anchorIndex: -1,
    stageStartedAt: 0,
    stageUntil: 0,
    nextDecisionAt: null,
    fromLocalPosition: new THREE.Vector3(),
    fromLocalQuaternion: new THREE.Quaternion(),
    releaseQuaternion: new THREE.Quaternion(),
    // Per-step outputs.
    ownsPose: false,
    approaching: false,
    position: new THREE.Vector3(),
    quaternion: new THREE.Quaternion(),
    forward: new THREE.Vector3(0, 0, -1),
    target: new THREE.Vector3(),
    targetSpeed: 0,
    // Speed the tail should read as while the ride owns the pose: the host's pace plus the
    // docking swim while docking, a slow idle while clamped.
    swimSpeed: 0,
    opacity: 1,
    releaseBlend: 1,
    justReleased: false,
    releaseDirection: new THREE.Vector3(0, 0, -1),
    releaseSpeed: 0,
    // How far the rider's tail bends onto its host this frame (WU; 0 unless clamped, easing in
    // over the latch and out over the release), and where it was when it let go.
    hug: 0,
    releaseHug: 0,
    // Docking pose in the host's frame, and the clock of the last step.
    dockLocalPosition: new THREE.Vector3(),
    dockLocalQuaternion: new THREE.Quaternion(),
    lastStepAt: null,
    // The host last ridden, and an escort's loose station round its host (see escortStation).
    lastHostId: null,
    escort: { along: 0, angle: 0, radius: 1.5, rates: [0.2, 0.2, 0.2], phases: [0, 0, 0] },
  }
}

/** Forget any host (a slot that could not be re-claimed on remount, or a host that is gone). */
export function resetRideState(ride) {
  ride.stage = 'free'
  ride.hostId = null
  ride.anchorIndex = -1
  ride.ownsPose = false
  ride.approaching = false
  ride.releaseBlend = 1
  ride.justReleased = false
  ride.opacity = 1
  ride.hug = 0
  ride.releaseHug = 0
}

function freeRide(ride, riderId, now, rand, pause) {
  releaseRideSlots(riderId)
  ride.stage = 'free'
  ride.hostId = null
  ride.anchorIndex = -1
  ride.nextDecisionAt = now + randomRangeFromPair(rand, pause, RIDE_RETRY_SECONDS)
}

function beginRideRelease(ride, riderId, host, anchor, now, rand, hitch) {
  ride.lastHostId = ride.hostId
  ride.releaseHug = ride.hug
  ride.releaseQuaternion.copy(ride.quaternion)
  ride.releaseDirection.copy(ride.forward)
  if (host && anchor) {
    // Swim forward off the disc, peeling away from the host's surface.
    rideSearchPosition.copy(anchor.normal).applyQuaternion(host.quaternion)
    ride.releaseDirection.addScaledVector(rideSearchPosition, RIDE_RELEASE_PEEL).normalize()
  }
  ride.releaseSpeed = host?.speed ?? 0
  ride.justReleased = true
  ride.releaseBlend = 0
  freeRide(ride, riderId, now, rand, hitch.freeSeconds)
  ride.stage = 'release'
  ride.stageStartedAt = now
}

/**
 * The nearest host this rider would ride, visible and within RIDE_ESCORT_RANGE_BODY_LENGTHS
 * of its own length, regardless of room on it: the host to escort when it cannot ride.
 */
export function findEscortHost(rider, riderPosition, hitch, preferHostId = null) {
  let best = null
  FISH_REGISTRY.forEach((entry, hostId) => {
    if (hostId === rider.id || entry.biome !== rider.biome || !entry.hasPose || entry.opacity < 0.99) return
    const hostProfile = rideHostProfile(resolveSpecies(entry))
    if (!hostProfile) return
    const weight = rideHostWeight(hitch, hostProfile)
    if (weight <= 0) return
    const distance = entry.position.distanceTo(riderPosition)
    if (distance > entry.bodyLength * RIDE_ESCORT_RANGE_BODY_LENGTHS) return
    const score = hostId === preferHostId ? -1 : distance / weight
    if (!best || score < best.score) best = { hostId, weight, score }
  })
  return best
}

// A free rider holds no slot, so there is nothing to release here.
function beginEscort(ride, hostId, now, rand) {
  ride.stage = 'escort'
  ride.hostId = hostId
  ride.anchorIndex = -1
  ride.stageStartedAt = now
  ride.stageUntil = now + randomRangeFromPair(rand, RIDE_ESCORT_SECONDS)
  ride.nextDecisionAt = now + randomRangeFromPair(rand, RIDE_ESCORT_RECHECK_SECONDS)
  const station = ride.escort
  station.along = randomRangeFromPair(rand, RIDE_ESCORT_ALONG)
  station.angle = randomRangeFromPair(rand, RIDE_ESCORT_ANGLE)
  station.radius = randomRangeFromPair(rand, RIDE_ESCORT_RADIUS)
  for (let i = 0; i < 3; i += 1) {
    station.rates[i] = randomRangeFromPair(rand, RIDE_ESCORT_DRIFT_RATE)
    station.phases[i] = rand() * Math.PI * 2
  }
}

/**
 * Host-local position (WU) of an escort's station at time `now`: its along / angle / radius,
 * each drifting slowly, placed in the host's clearance ellipsoid so it is always outside the
 * body. Pure, so the same station can be checked from tests.
 */
export function escortStation(out, station, hostProfile, hostBodyLength, riderBodyLength, now) {
  const along = THREE.MathUtils.clamp(station.along + RIDE_ESCORT_ALONG_DRIFT * Math.sin(now * station.rates[0] + station.phases[0]), -0.9, 0.9)
  const angle = station.angle + RIDE_ESCORT_ANGLE_DRIFT * Math.sin(now * station.rates[1] + station.phases[1])
  const radius = Math.max(1.1, station.radius + RIDE_ESCORT_RADIUS_DRIFT * Math.sin(now * station.rates[2] + station.phases[2]))
  const around = Math.sqrt(1 - along * along)
  rideNormalizedA.set(Math.cos(angle) * around, Math.sin(angle) * around, along).multiplyScalar(radius)
  return rideBodyDenormalized(out, rideNormalizedA, hostProfile, hostBodyLength, rideClearanceMargin(riderBodyLength))
}

function smootherstep01(t) {
  const x = THREE.MathUtils.clamp(t, 0, 1)
  return x * x * x * (x * (x * 6 - 15) + 10)
}

/**
 * Advance one rider by one frame. `position`/`worldQuaternion` are the rider's current pose
 * (model frame); `speeds` its idle and burst speeds in WU/s. Afterwards `ride.ownsPose` says
 * whether this frame's pose is `ride.position`/`ride.quaternion` outright (latching or
 * clamped), and `ride.approaching` says to steer at `ride.target` at `ride.targetSpeed`.
 */
export function advanceRide(ride, rider, hitch, riderBodyLength, now, position, worldQuaternion, speeds, rand) {
  ride.ownsPose = false
  ride.approaching = false
  ride.opacity = 1
  ride.hug = 0
  if (ride.nextDecisionAt === null) ride.nextDecisionAt = now + randomRangeFromPair(rand, RIDE_FIRST_DECISION_SECONDS)
  const dt = ride.lastStepAt === null ? 0 : THREE.MathUtils.clamp(now - ride.lastStepAt, 0, 0.1)
  ride.lastStepAt = now

  const host = ride.hostId != null ? FISH_REGISTRY.get(ride.hostId) : null
  const hostProfile = host?.hasPose ? rideHostProfile(resolveSpecies(host)) : null
  const anchor = hostProfile?.anchors[ride.anchorIndex] ?? null
  const riding = ride.stage === 'approach' || ride.stage === 'dock' || ride.stage === 'latch' || ride.stage === 'attached'

  if (riding && !anchor) {
    // The host left the tank (or died). A rider on or beside it unrolls from where it was;
    // one still swimming in just carries on.
    if (ride.stage === 'approach') freeRide(ride, rider.id, now, rand, RIDE_RETRY_SECONDS)
    else beginRideRelease(ride, rider.id, null, null, now, rand, hitch)
    return ride
  }

  if (ride.stage === 'release') {
    ride.releaseBlend = smootherstep01((now - ride.stageStartedAt) / RIDE_RELEASE_SECONDS)
    // The body straightens as the remora swims off its disc.
    ride.hug = ride.releaseHug * (1 - ride.releaseBlend)
    if (ride.releaseBlend >= 1) {
      ride.stage = 'free'
      // Often it stays with the host it just left, for its spell off the disc.
      const stay = ride.lastHostId != null ? findEscortHost(rider, position, hitch, ride.lastHostId) : null
      if (stay?.hostId === ride.lastHostId && rand() < RIDE_ESCORT_AFTER_RELEASE_CHANCE) {
        beginEscort(ride, stay.hostId, now, rand)
        ride.stageUntil = now + randomRangeFromPair(rand, hitch.freeSeconds, RIDE_DEFAULT_FREE_SECONDS)
        ride.nextDecisionAt = ride.stageUntil
        // Newly chosen: step the escort from next frame, once the host lookup is fresh.
        return ride
      }
    }
  }

  if (ride.stage === 'escort') {
    const escortHost = host?.hasPose && host.opacity >= 0.99 ? host : null
    const escortProfile = escortHost ? hostProfile : null
    if (!escortProfile || now >= ride.stageUntil) {
      // Lost interest, or the host is gone or fading: swim off on its own for a while.
      ride.stage = 'free'
      ride.hostId = null
      ride.nextDecisionAt = now + randomRangeFromPair(rand, RIDE_RETRY_SECONDS)
      return ride
    }
    if (now >= ride.nextDecisionAt) {
      // A spot may have opened: go for it (on this host or a nearer one).
      const choice = findRideHost(rider, position, riderBodyLength, hitch, rand)
      if (choice && claimRideSlot(choice.hostId, choice.anchorIndex, rider.id, riderBodyLength, hitch)) {
        ride.stage = 'approach'
        ride.hostId = choice.hostId
        ride.anchorIndex = choice.anchorIndex
        ride.stageStartedAt = now
        ride.stageUntil = now + THREE.MathUtils.clamp(
          (choice.distance / Math.max(0.1, speeds.burst)) * RIDE_APPROACH_TIMEOUT_SCALE,
          RIDE_APPROACH_TIMEOUT_RANGE[0],
          RIDE_APPROACH_TIMEOUT_RANGE[1],
        )
        return ride
      }
      ride.nextDecisionAt = now + randomRangeFromPair(rand, RIDE_ESCORT_RECHECK_SECONDS)
    }
    // Follow loosely: match the host's velocity plus a closing velocity toward the station.
    escortStation(rideEscortLocal, ride.escort, escortProfile, escortHost.bodyLength, riderBodyLength, now)
    ride.target.copy(rideEscortLocal).applyQuaternion(escortHost.quaternion).add(escortHost.position)
    ride.target.y = Math.min(ride.target.y, rideSurfaceLimitY(riderBodyLength))
    rideHostForward.subVectors(ride.target, position)
    const stationDistance = rideHostForward.length()
    if (stationDistance > 1e-4) rideHostForward.divideScalar(stationDistance)
    const maxSpeed = speeds.burst * RIDE_ESCORT_BURST_SCALE
    const closing = Math.min(stationDistance * RIDE_ESCORT_CLOSING_GAIN, maxSpeed)
    rideDesiredVelocity.copy(escortHost.forward).multiplyScalar(escortHost.speed ?? 0).addScaledVector(rideHostForward, closing)
    const desiredSpeed = rideDesiredVelocity.length()
    ride.targetSpeed = THREE.MathUtils.clamp(desiredSpeed, speeds.idle * 0.5, maxSpeed)
    if (desiredSpeed > 1e-4) rideDesiredVelocity.divideScalar(desiredSpeed)
    else rideDesiredVelocity.copy(escortHost.forward)
    ride.target.copy(position).addScaledVector(rideDesiredVelocity, Math.max(1, riderBodyLength))
    ride.approaching = true
    return ride
  }

  if (ride.stage === 'free' && now >= ride.nextDecisionAt) {
    const choice = findRideHost(rider, position, riderBodyLength, hitch, rand)
    if (choice && claimRideSlot(choice.hostId, choice.anchorIndex, rider.id, riderBodyLength, hitch)) {
      ride.stage = 'approach'
      ride.hostId = choice.hostId
      ride.anchorIndex = choice.anchorIndex
      ride.stageStartedAt = now
      ride.stageUntil = now + THREE.MathUtils.clamp(
        (choice.distance / Math.max(0.1, speeds.burst)) * RIDE_APPROACH_TIMEOUT_SCALE,
        RIDE_APPROACH_TIMEOUT_RANGE[0],
        RIDE_APPROACH_TIMEOUT_RANGE[1],
      )
      // Newly chosen: step the approach from next frame, once the host lookup is fresh.
      return ride
    }
    // No room (or no luck): often it shadows the host anyway, waiting for a spot.
    const escort = findEscortHost(rider, position, hitch)
    if (escort && rand() < RIDE_ESCORT_CHANCE * escort.weight) {
      beginEscort(ride, escort.hostId, now, rand)
      return ride
    }
    ride.nextDecisionAt = now + randomRangeFromPair(rand, RIDE_RETRY_SECONDS)
    return ride
  }

  if (ride.stage === 'approach') {
    rideAnchorPose(ride.position, ride.quaternion, host, anchor, riderBodyLength, hitch)
    if (ride.position.y > rideSurfaceLimitY(riderBodyLength) || now > ride.stageUntil) {
      freeRide(ride, rider.id, now, rand, RIDE_RETRY_SECONDS)
      return ride
    }
    // Head for the staging point beside the anchor, swinging round the host's body on the way.
    rideStagingLocal(rideLocalStaging, hostProfile, anchor, host.bodyLength, riderBodyLength, hitch)
    rideInverseQuaternion.copy(host.quaternion).invert()
    rideLocalRider.subVectors(position, host.position).applyQuaternion(rideInverseQuaternion)
    const distance = rideLocalRider.distanceTo(rideLocalStaging)
    const margin = rideClearanceMargin(riderBodyLength)
    const bodyRadius = rideBodyNormalized(rideNormalizedA, rideLocalRider, hostProfile, host.bodyLength, margin).length()
    if (bodyRadius <= RIDE_DOCK_RADIUS || distance <= Math.max(RIDE_DOCK_DISTANCE_MIN, riderBodyLength * RIDE_DOCK_DISTANCE_BODY_LENGTHS)) {
      // Close in: from here on the remora moves in the host's frame (see 'dock').
      rideHostLocalPose(ride.dockLocalPosition, ride.dockLocalQuaternion, host, position, worldQuaternion)
      ride.stage = 'dock'
      ride.stageStartedAt = now
      ride.stageUntil = now + RIDE_DOCK_SECONDS
    } else {
      rideApproachWaypoint(rideLocalWaypoint, hostProfile, host.bodyLength, riderBodyLength, rideLocalRider, rideLocalStaging)
      // Match the host's velocity plus a closing velocity toward the waypoint, so relative to
      // the host the remora closes in a straight line — and one that has got ahead of its spot
      // eases off and lets the host catch up instead of racing on.
      const maxSpeed = speeds.burst * RIDE_APPROACH_BURST_SCALE
      ride.target.copy(rideLocalWaypoint).applyQuaternion(host.quaternion).add(host.position)
      rideHostForward.subVectors(ride.target, position)
      const waypointDistance = rideHostForward.length()
      if (waypointDistance > 1e-4) rideHostForward.divideScalar(waypointDistance)
      const closing = Math.min(waypointDistance * RIDE_APPROACH_CLOSING_GAIN + RIDE_APPROACH_CLOSING_MIN, maxSpeed)
      rideDesiredVelocity.copy(host.forward).multiplyScalar(host.speed ?? 0).addScaledVector(rideHostForward, closing)
      const desiredSpeed = rideDesiredVelocity.length()
      ride.targetSpeed = THREE.MathUtils.clamp(desiredSpeed, speeds.idle * 0.5, maxSpeed)
      // Steer at a point a body length out along that velocity.
      if (desiredSpeed > 1e-4) rideDesiredVelocity.divideScalar(desiredSpeed)
      else rideDesiredVelocity.copy(rideHostForward)
      ride.target.copy(position).addScaledVector(rideDesiredVelocity, Math.max(1, riderBodyLength))
      ride.approaching = true
      return ride
    }
  }

  if (ride.stage === 'dock') {
    // Beside the host, the remora swims in the host's own frame: along the swing-round path
    // to its staging point, turning to face the host's way, carried with it. Steering through
    // the free-swimming integrator cannot hold a path this tight round a turning shark; this
    // can, and it can never cross the body.
    const local = ride.dockLocalPosition
    rideStagingLocal(rideLocalStaging, hostProfile, anchor, host.bodyLength, riderBodyLength, hitch)
    const toStaging = local.distanceTo(rideLocalStaging)
    if (now > ride.stageUntil || ride.position.y > rideSurfaceLimitY(riderBodyLength)) {
      beginRideRelease(ride, rider.id, host, null, now, rand, hitch)
      return ride
    }
    if (toStaging <= Math.max(RIDE_LATCH_DISTANCE_MIN, riderBodyLength * RIDE_LATCH_DISTANCE_BODY_LENGTHS)) {
      ride.fromLocalPosition.copy(local)
      ride.fromLocalQuaternion.copy(ride.dockLocalQuaternion)
      ride.stage = 'latch'
      ride.stageStartedAt = now
    } else {
      rideApproachWaypoint(rideLocalWaypoint, hostProfile, host.bodyLength, riderBodyLength, local, rideLocalStaging)
      const toWaypoint = rideLocalWaypoint.sub(local)
      const waypointDistance = toWaypoint.length()
      const relativeSpeed = THREE.MathUtils.clamp(
        toStaging * RIDE_DOCK_GAIN + RIDE_DOCK_MIN_SPEED,
        RIDE_DOCK_MIN_SPEED,
        Math.max(RIDE_DOCK_MIN_SPEED, speeds.burst),
      )
      if (waypointDistance > 1e-6) local.addScaledVector(toWaypoint, Math.min(1, (relativeSpeed * dt) / waypointDistance))
      rideProjectOutOfBody(local, hostProfile, host.bodyLength, riderBodyLength)
      ride.dockLocalQuaternion.slerp(RIDE_IDENTITY, 1 - Math.exp(-dt * RIDE_DOCK_TURN_RESPONSE))
      ride.position.copy(local).applyQuaternion(host.quaternion).add(host.position)
      ride.quaternion.copy(host.quaternion).multiply(ride.dockLocalQuaternion)
      ride.forward.copy(RIDE_MODEL_FORWARD).applyQuaternion(ride.quaternion)
      ride.swimSpeed = (host.speed ?? 0) + relativeSpeed
      ride.ownsPose = true
      ride.opacity = host.opacity ?? 1
      return ride
    }
  }

  if (ride.stage === 'latch') {
    const blend = smootherstep01((now - ride.stageStartedAt) / RIDE_LATCH_SECONDS)
    rideAnchorPose(ride.position, ride.quaternion, host, anchor, riderBodyLength, hitch, blend, ride.fromLocalPosition, ride.fromLocalQuaternion)
    ride.hug = rideAnchorFit(anchor, riderBodyLength / host.bodyLength, hitch).bend * host.bodyLength * blend
    if (blend >= 1) {
      ride.stage = 'attached'
      ride.stageStartedAt = now
      ride.stageUntil = now + randomRangeFromPair(rand, hitch.rideSeconds, RIDE_DEFAULT_SECONDS)
    }
  } else if (ride.stage === 'attached') {
    rideAnchorPose(ride.position, ride.quaternion, host, anchor, riderBodyLength, hitch)
    ride.hug = rideAnchorFit(anchor, riderBodyLength / host.bodyLength, hitch).bend * host.bodyLength
  }

  if (ride.stage === 'latch' || ride.stage === 'attached') {
    ride.forward.copy(RIDE_MODEL_FORWARD).applyQuaternion(ride.quaternion)
    // Hold on through a host's fade-out and snap back (the Mola's deep-exit recovery) rather
    // than letting go out in the dark beyond the tank's rear wall.
    const rideOver = now >= ride.stageUntil && (host.opacity ?? 1) >= 0.99
    if (ride.stage === 'attached' && (rideOver || ride.position.y > rideSurfaceLimitY(riderBodyLength))) {
      beginRideRelease(ride, rider.id, host, anchor, now, rand, hitch)
      return ride
    }
    ride.ownsPose = true
    ride.opacity = host.opacity ?? 1
  }
  return ride
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
