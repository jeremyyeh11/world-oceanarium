import * as THREE from 'three'
import { castReefRay, findReefSite, hasCoralSurfaces, hasReefSurfaces, pickViewHome, reefSegmentClear } from './reefSites.js'
import { insideRock } from './rockObstacles.js'

// Reef behaviour for reef-associated species (a `reef` block in species.js; see
// docs/reef-behavior.md). A reef fish keeps a home on the rocks and spends most of its time
// there, in four modes:
//   patrol   cruise past a rock face and on (no stop)
//   hover    settle a body length or so off a face and hang there, turning slowly
//   peck     settle nose-close to a face, ease in for a nibble and back out once or twice, hang
//            about the spot a little, and move on
//   shelter  tuck into the most enclosed nook it can find, turn to face out, and wait
//
// Travel to a site runs on the unified steer → boids → turn-cap → integrate → clamp pipeline,
// to an entry point lined up a couple of body lengths off the face. The last stretch and the
// time at the rock are authored (like the Mola's sun-bask hold): the behaviour owns position and
// facing, because the rock proxies' padding (rockObstacles.js) would never let a nose reach the
// rock, and pecks back away from the face, which the forward-only integrator cannot do. Sites
// come from raycasts of the drawn rocks (reefSites.js), so the clear room is checked against the
// real surface.

const REEF_DEFAULTS = {
  // Share of a free fish's decisions that go to the reef rather than open water.
  affinity: 0.7,
  modes: { patrol: 0.4, hover: 0.3, peck: 0.2, shelter: 0.1 },
  // Sites are picked near home first; now and then the fish moves home to a rock anywhere.
  homeRadiusBodyLengths: 10,
  newHomeChance: 0.12,
  hoverSeconds: [4, 10],
  shelterSeconds: [10, 22],
  // A gentle nibble, not a strike (Jeremy, 2026-10-19: "it actually looks too sharp ... it can just
  // be a gentle peck, not multiple violent pecks"). Was 2–5 pecks of a 0.28 s dart, 0.16 s bite and
  // 0.16 s snap back, 0.4–1.1 s apart.
  // Then "in out, hover around, move on" (Jeremy, 2026-10-19): one or two pecks at the same spot,
  // facing it steadily, and a spell hanging about before leaving.
  pecks: [1, 2],
  peckRestSeconds: [1.2, 3.0],
  afterPeckHoverSeconds: [2, 5],
  lungeSeconds: 0.6,
  biteSeconds: 0.35,
  recoilSeconds: 0.7,
  // The models are recentred mid-length, so the snout is half a body length ahead of the origin.
  noseBodyLengths: 0.5,
  // Snout clearance from the face between pecks (was 0.32), and how much further back than that
  // it eases after a peck (was 0.12).
  peckGapBodyLengths: 0.18,
  recoilBodyLengths: 0.03,
  hoverStandoffBodyLengths: [1.0, 1.6],
  patrolStandoffBodyLengths: [1.4, 2.6],
  // Turning on the spot, on its fins.
  turnDegreesPerSecond: 150,
  // After a startle, the chance its next move is to shelter.
  startleShelterChance: 0.5,
  // Where there are table corals (landscapes.js `corals`), the share of each mode's visits that
  // go to one instead of to rock (Jeremy, 2026-10-19: "build fish behavior to interact with the
  // corals, hide underneath, within, peck at it"). A coral shelter hides under a table's plate, or
  // between two stacked plates; a peck or hover is at a plate's rim. A coral search that finds
  // nothing falls back to rock, which a thin, ragged rim often makes happen: measured over 90 s
  // (138 visits), these shares gave 62% of shelters at coral but only 12–19% of hovers, patrols
  // and pecks, hence the higher shares for those.
  coral: { patrol: 0.35, hover: 0.5, peck: 0.6, shelter: 0.6 },
}
// A shelter under a coral table counts as enclosed with less around it than a rock nook: the
// plate overhead is what hides the fish (the search keeps only spots with cover straight above).
const CORAL_SHELTER_MIN_ENCLOSURE = 0.25

// Snout clearance from the face once tucked into a shelter, before it turns to face out.
const SHELTER_GAP_BODY_LENGTHS = 0.15
// Free room round a rest point, sideways and (a little less) above and below: enough to turn
// on the spot.
const CLEARANCE_BODY_LENGTHS = 0.55
// Where the fish lines up off the face before settling in.
const ENTRY_BODY_LENGTHS = 2.2
const ENTRY_MIN = 1.5
// Settling starts within this many entry distances of the rest point, once the way is clear.
const SETTLE_START_ENTRIES = 1.6
const SETTLE_CHECK_INTERVAL = 0.25
// Travelling, it must close at least this many body lengths on the entry point every so many
// seconds, or it gives the site up.
const TRAVEL_PROGRESS_SECONDS = 3
const TRAVEL_PROGRESS_BODY_LENGTHS = 0.5
// Faces by normal y: sides and gentle tops for hovering and pecking, undersides too for shelter.
const FACE_NORMAL_Y = { patrol: [-0.3, 0.7], hover: [-0.25, 0.55], peck: [-0.25, 0.55], shelter: [-0.7, 0.55] }
const SHELTER_MIN_ENCLOSURE = 0.35
// Empty searches retried (one a frame) before the decision goes to open water instead.
const SEARCH_RETRIES = 2
// The visitor's reef: a new home goes to the middle of the resting view this often (else round
// where the fish is), and this share of site searches comes at a rock from the camera's side and
// keeps only a spot it can see (reefSites.js). Since dev_10's wider, deeper volume, homes spread
// over the whole reef and the fish at a rock were in sight 3–4% of the time.
const VIEW_HOME_SHARE = 0.6
const VIEW_SITE_BIAS = 0.5
// How steeply the fish may tilt at the rock: grazing a sloped face, nose down.
const MAX_REEF_PITCH = THREE.MathUtils.degToRad(35)
const LEAVE_MAX_SECONDS = 5
// Seconds for the rock proxies' clamp to come back to full strength after the fish leaves a
// rock, so it eases off the face instead of being shoved out of the padding in one frame.
export const REEF_CLAMP_RECOVERY_SECONDS = 1.5

const UP = new THREE.Vector3(0, 1, 0)
const scratch = new THREE.Vector3()
const scratchB = new THREE.Vector3()
const goal = new THREE.Vector3()
const basisA = new THREE.Vector3()
const basisB = new THREE.Vector3()
const probeFrom = new THREE.Vector3()
const probeDirection = new THREE.Vector3()
const hitPoint = new THREE.Vector3()
const hitNormal = new THREE.Vector3()
const homeQuery = new THREE.Vector3()

export function reefProfile(species) {
  const config = species?.reef
  if (!config) return null
  const settings = typeof config === 'object' ? config : {}
  const modes = { ...REEF_DEFAULTS.modes, ...(settings.modes ?? {}) }
  const total = Object.values(modes).reduce((sum, weight) => sum + Math.max(0, weight), 0) || 1
  for (const key of Object.keys(modes)) modes[key] = Math.max(0, modes[key]) / total
  const coral = { ...REEF_DEFAULTS.coral, ...(settings.coral ?? {}) }
  return { ...REEF_DEFAULTS, ...settings, modes, coral }
}

export function createReefState() {
  return {
    // null | 'patrol' | 'hover' | 'peck' | 'shelter'
    mode: null,
    // 'idle' | 'travel' | 'settle' | 'hold' | 'peck' | 'leave' | 'done'
    stage: 'idle',
    site: { point: new THREE.Vector3(), normal: new THREE.Vector3(), rest: new THREE.Vector3(), entry: new THREE.Vector3(), enclosure: 0 },
    home: new THREE.Vector3(),
    hasHome: false,
    facing: new THREE.Vector3(0, 0, -1),
    faceIn: new THREE.Vector3(),
    outward: new THREE.Vector3(),
    entryDistance: 0,
    stageStartedAt: 0,
    until: 0,
    travelUntil: 0,
    nextClearCheckAt: 0,
    progressCheckAt: 0,
    progressDistance: Infinity,
    // Settle curve (Hermite from the fish's pose at the start to the rest point).
    from: new THREE.Vector3(),
    fromTangent: new THREE.Vector3(),
    settleSeconds: 1,
    settleLead: 0,
    // Pecking.
    pecksLeft: 0,
    peckPhase: 'rest',
    phaseStartedAt: 0,
    phaseUntil: 0,
    peckRest: new THREE.Vector3(),
    peckContact: new THREE.Vector3(),
    peckNormal: new THREE.Vector3(),
    peckFrom: new THREE.Vector3(),
    recoilTo: new THREE.Vector3(),
    // Leaving.
    leaveDirection: new THREE.Vector3(),
    leaveStart: new THREE.Vector3(),
    leaveSpeed: 0,
    urgent: false,
    // Per-frame output: the swimming effort the tail and fins read as speed (WU/s).
    effort: 0,
    // Where a hold hangs: the rest point for a hover or shelter, a little further out after pecking.
    holdAnchor: new THREE.Vector3(),
    wanderPhase: Math.random() * Math.PI * 2,
    // Rock-proxy clamp strength (0..1): 0 at the rock, easing back to 1 after leaving.
    clampBlend: 0,
    shelterQueued: false,
    // The mode to search again next frame (the search was busy, or a shelter fell back to a hover),
    // and how many searches in a row have come up empty.
    retryMode: null,
    failedSearches: 0,
    // 'rock' or 'coral': what the current site is on, and what the retried search must ask for
    // (null = choose again).
    siteKind: 'rock',
    retryKind: null,
  }
}

export function resetReefState(reef) {
  reef.mode = null
  reef.stage = 'idle'
  reef.retryMode = null
  reef.retryKind = null
}

/** Whether the behaviour owns the fish's position and facing this frame. */
export function reefOwnsPose(reef) {
  return reef.stage === 'settle' || reef.stage === 'hold' || reef.stage === 'peck' || reef.stage === 'leave'
}

function randomIn(rand, pair) {
  return pair[0] + rand() * (pair[1] - pair[0])
}

function pickMode(profile, rand) {
  let roll = rand()
  for (const [mode, weight] of Object.entries(profile.modes)) {
    if (roll < weight) return mode
    roll -= weight
  }
  return 'patrol'
}

function clampPitch(direction, maxPitch) {
  const horizontal = Math.hypot(direction.x, direction.z)
  const pitch = Math.atan2(direction.y, horizontal)
  if (Math.abs(pitch) <= maxPitch) return direction
  const limited = Math.sign(pitch) * maxPitch
  if (horizontal < 1e-5) direction.set(0, Math.sin(limited), -Math.cos(limited))
  else direction.set(direction.x / horizontal * Math.cos(limited), Math.sin(limited), direction.z / horizontal * Math.cos(limited))
  return direction
}

function rotateToward(current, target, maxAngle) {
  const dot = THREE.MathUtils.clamp(current.dot(target), -1, 1)
  const angle = Math.acos(dot)
  if (angle <= maxAngle || angle < 1e-5) {
    current.copy(target)
    return angle
  }
  if (dot < -0.9999) {
    // Dead astern: swing round through a horizontal side.
    scratch.set(-current.z, 0, current.x)
    if (scratch.lengthSq() < 1e-6) scratch.set(1, 0, 0)
    scratch.normalize()
    current.applyAxisAngle(UP, maxAngle)
    return angle
  }
  scratch.crossVectors(current, target).normalize()
  current.applyAxisAngle(scratch, maxAngle).normalize()
  return angle
}

/**
 * Choose and start a reef behaviour. ctx: { bodyLength, region, contains, position, rand, now,
 * cruiseSpeed, home (optional Vector3: a pair follower stays by its mate) }. Returns 'started',
 * 'busy' (another fish searched this frame: try again next frame) or 'none'.
 */
export function startReefBehavior(reef, profile, ctx) {
  if (!hasReefSurfaces()) return 'none'
  const { bodyLength, rand } = ctx
  const mode = reef.retryMode ?? (reef.shelterQueued ? 'shelter' : pickMode(profile, rand))
  reef.retryMode = null
  // On rock or on a table coral (`profile.coral`, the share of this mode's visits).
  const kind = reef.retryKind ?? (hasCoralSurfaces() && rand() < (profile.coral[mode] ?? 0) ? 'coral' : 'rock')
  reef.retryKind = null
  const onCoral = kind === 'coral'
  const nose = profile.noseBodyLengths * bodyLength
  const standoff = mode === 'peck'
    ? nose + profile.peckGapBodyLengths * bodyLength
    : mode === 'shelter'
      ? nose + SHELTER_GAP_BODY_LENGTHS * bodyLength
      : mode === 'hover'
        ? randomIn(rand, profile.hoverStandoffBodyLengths) * bodyLength
        : randomIn(rand, profile.patrolStandoffBodyLengths) * bodyLength
  const entryDistance = Math.max(ENTRY_MIN, ENTRY_BODY_LENGTHS * bodyLength)
  // Near home, or anywhere (round where it is now) when it has none yet or moves house.
  const roaming = !ctx.home && (!reef.hasHome || rand() < profile.newHomeChance)
  const near = ctx.home ?? (roaming
    ? ((rand() < VIEW_HOME_SHARE && pickViewHome(homeQuery, rand)) || homeQuery.copy(ctx.position))
    : reef.home)
  const radius = profile.homeRadiusBodyLengths * bodyLength * (roaming ? 2 : 1)
  const found = findReefSite(reef.site, {
    force: ctx.force,
    region: ctx.region,
    contains: ctx.contains,
    // The steering keeps a fish outside the rocks' and tables' padded shapes, so a line-up point
    // inside one is never reached (measured 2026-10-19: 10 of 13 such trips were given up).
    reachable: point => !insideRock(point, bodyLength),
    near,
    radius,
    from: ctx.position,
    rand,
    standoff,
    clearance: CLEARANCE_BODY_LENGTHS * bodyLength,
    entryDistance,
    normalY: FACE_NORMAL_Y[mode],
    minEnclosure: mode === 'shelter' ? (onCoral ? CORAL_SHELTER_MIN_ENCLOSURE : SHELTER_MIN_ENCLOSURE) : 0,
    enclosureReach: Math.max(1.5, 2.5 * bodyLength),
    // A coral's rim is a narrow target: more tries before falling back to rock.
    attempts: mode === 'shelter' ? 10 : onCoral ? 12 : 8,
    viewBias: VIEW_SITE_BIAS,
    kind,
    // Under a coral's plate to hide (or between two tiers), at its rim otherwise.
    aim: onCoral ? (mode === 'shelter' ? 'under' : 'rim') : undefined,
    requireCover: onCoral && mode === 'shelter',
  })
  if (found === false) {
    reef.retryMode = mode
    reef.retryKind = kind
    return 'busy'
  }
  if (!found && onCoral) {
    // No coral spot near enough: the same move on rock, searched next frame.
    reef.retryMode = mode
    reef.retryKind = 'rock'
    return 'busy'
  }
  if (!found) {
    if (mode === 'shelter') {
      // No nook near enough (the rocks have few that fit a larger fish): hang off a face
      // instead, searched next frame.
      reef.shelterQueued = false
      reef.retryMode = 'hover'
      return 'busy'
    }
    // Unlucky tries: search again on the next frames before giving the decision to open water.
    if (reef.failedSearches < SEARCH_RETRIES) {
      reef.failedSearches += 1
      reef.retryMode = mode
      return 'busy'
    }
    reef.failedSearches = 0
    return 'none'
  }
  reef.failedSearches = 0
  if (mode === 'shelter') reef.shelterQueued = false
  if (roaming && !ctx.home) {
    reef.home.copy(reef.site.point)
    reef.hasHome = true
  }
  reef.mode = mode
  reef.siteKind = kind
  reef.stage = 'travel'
  reef.entryDistance = entryDistance
  reef.faceIn.copy(reef.site.normal).negate()
  clampPitch(reef.faceIn, MAX_REEF_PITCH).normalize()
  reef.outward.set(reef.site.normal.x, 0, reef.site.normal.z).normalize()
  reef.stageStartedAt = ctx.now
  const distance = ctx.position.distanceTo(reef.site.entry)
  reef.travelUntil = ctx.now + THREE.MathUtils.clamp(distance / Math.max(0.05, ctx.cruiseSpeed) * 2 + 8, 10, 45)
  reef.nextClearCheckAt = ctx.now
  reef.progressDistance = distance
  reef.progressCheckAt = ctx.now + TRAVEL_PROGRESS_SECONDS
  return 'started'
}

/**
 * Place a reef fish as the tank opens, already about its business instead of scattered through
 * open water: at a rock near `ctx.position` (its spawn point), hovering, pecking or sheltering in
 * the species' own mix, part-way through the visit so the tank does not move off in step. With
 * chance 1 - affinity it starts a few body lengths off the rock instead, swimming past it.
 * Same ctx as startReefBehavior. Returns false (spawn it the ordinary way) if no site was found.
 * On success `position` is moved to the start point and `reef.facing` set.
 */
export function spawnReefBehavior(reef, profile, ctx, position) {
  const { rand, now, bodyLength } = ctx
  const atRock = rand() < profile.affinity
  // A patrol has nothing to be mid-way through: those start as hovers.
  let mode = pickMode(profile, rand)
  if (atRock && mode === 'patrol') mode = 'hover'
  if (!atRock) mode = 'patrol'
  reef.retryMode = mode
  let result = 'busy'
  // Spawn searches skip the frame limit; a shelter that finds no nook falls back to a hover.
  for (let tries = 0; tries < 4 && result === 'busy'; tries++) result = startReefBehavior(reef, profile, { ...ctx, force: true })
  if (result !== 'started') {
    resetReefState(reef)
    return false
  }
  if (reef.mode === 'patrol') {
    // Off the face, already on its way past.
    position.copy(reef.site.entry)
    reef.facing.copy(reef.outward).applyAxisAngle(UP, (rand() < 0.5 ? -1 : 1) * Math.PI / 2)
    return true
  }
  position.copy(reef.site.rest)
  reef.facing.copy(reef.mode === 'shelter' ? reef.outward : reef.faceIn)
  finishSettle(reef, profile, bodyLength, rand, now)
  // Part-way through: hold time left anywhere in its span, and a peck run already under way.
  reef.until = now + (reef.until - now) * (0.35 + 0.65 * rand())
  if (reef.stage === 'peck') reef.phaseUntil = now + rand() * profile.peckRestSeconds[1]
  return true
}

/**
 * Travel stage (the unified pipeline steers to `reef.site.entry`). Returns 'travel', 'settle'
 * (the way in is clear: call beginReefSettle), 'done' (a patrol passed its face) or 'abandon'.
 */
export function stepReefTravel(reef, position, now, reachedDistance, bodyLength) {
  if (now > reef.travelUntil) return 'abandon'
  const toEntry = position.distanceTo(reef.site.entry)
  // Pinned on the way (another rock between, or circling a point it cannot turn into): give up.
  if (now >= reef.progressCheckAt) {
    if (toEntry > reef.progressDistance - TRAVEL_PROGRESS_BODY_LENGTHS * bodyLength) return 'abandon'
    reef.progressDistance = toEntry
    reef.progressCheckAt = now + TRAVEL_PROGRESS_SECONDS
  }
  if (reef.mode === 'patrol') return toEntry <= reachedDistance ? 'done' : 'travel'
  const toRest = position.distanceTo(reef.site.rest)
  if (toRest > reef.entryDistance * SETTLE_START_ENTRIES && toEntry > reachedDistance) return 'travel'
  if (now < reef.nextClearCheckAt) return 'travel'
  reef.nextClearCheckAt = now + SETTLE_CHECK_INTERVAL
  if (reefSegmentClear(position, reef.site.rest)) return 'settle'
  // At the entry point and still blocked: the site was a bad pick.
  return toEntry <= reachedDistance ? 'abandon' : 'travel'
}

export function beginReefSettle(reef, position, forward, speed, bodyLength, now) {
  reef.stage = 'settle'
  reef.stageStartedAt = now
  reef.from.copy(position)
  reef.fromTangent.copy(forward).normalize()
  reef.facing.copy(forward).normalize()
  const distance = position.distanceTo(reef.site.rest)
  reef.settleSeconds = THREE.MathUtils.clamp(1.5 * distance / Math.max(speed, 0.3 * bodyLength), 0.8, 6)
  // The start tangent keeps the fish's own heading, never longer than the chord, so the curve
  // does not bulge off the cleared line toward neighbouring rock.
  reef.settleLead = Math.min(distance, speed * reef.settleSeconds)
}

function beginReefLeave(reef, position, rand, now, urgent) {
  reef.stage = 'leave'
  reef.stageStartedAt = now
  reef.urgent = urgent
  reef.leaveSpeed = 0
  reef.leaveStart.copy(position)
  // Out from the face and off to one side.
  const side = rand() < 0.5 ? -1 : 1
  reef.leaveDirection.copy(reef.outward).applyAxisAngle(UP, side * THREE.MathUtils.degToRad(25 + rand() * 45))
}

/** Whether it is tucked in a shelter, where a threat does not startle it. */
export function reefSheltered(reef) {
  return reef.mode === 'shelter' && reef.stage === 'hold'
}

/**
 * Startled: it may make for a shelter next. Travelling, it drops the site (the caller clears its
 * target); at the rock, it breaks off and turns away fast.
 */
export function reefStartled(reef, position, rand, now, profile) {
  if (reefSheltered(reef)) return
  if (rand() < profile.startleShelterChance) reef.shelterQueued = true
  if (!reefOwnsPose(reef)) {
    if (reef.stage === 'travel') resetReefState(reef)
    return
  }
  if (reef.stage !== 'leave') beginReefLeave(reef, position, rand, now, true)
  else reef.urgent = true
}

// Next peck spot: almost the same place, a touch along the face, found on the drawn rock. The
// fish keeps facing the site the whole visit (along its normal), so the rock's small facets never
// swing its heading; a facet normal used to re-aim it up to ~40° between pecks.
function choosePeckSpot(reef, profile, bodyLength, rand, first) {
  const nose = profile.noseBodyLengths * bodyLength
  const gap = profile.peckGapBodyLengths * bodyLength
  const normal = reef.site.normal
  reef.peckNormal.copy(normal)
  if (first) {
    reef.peckRest.copy(reef.site.rest)
    reef.peckContact.copy(reef.site.point).addScaledVector(normal, nose + 0.02)
    return
  }
  basisA.crossVectors(UP, normal)
  if (basisA.lengthSq() < 1e-4) basisA.set(1, 0, 0)
  basisA.normalize()
  basisB.crossVectors(normal, basisA).normalize()
  probeFrom.copy(reef.site.point)
    .addScaledVector(basisA, (rand() * 2 - 1) * 0.1 * bodyLength)
    .addScaledVector(basisB, (rand() * 2 - 1) * 0.06 * bodyLength)
    .addScaledVector(normal, nose + gap + 0.3 * bodyLength)
  probeDirection.copy(normal).negate()
  const far = nose + gap + 0.9 * bodyLength
  if (castReefRay(probeFrom, probeDirection, far, hitPoint, hitNormal) < 0) return
  if (hitNormal.dot(normal) < 0.6) return
  scratchB.copy(hitPoint).addScaledVector(normal, nose + gap)
  if (scratchB.distanceTo(reef.peckRest) > 0.3 * bodyLength) return
  reef.peckRest.copy(scratchB)
  reef.peckContact.copy(hitPoint).addScaledVector(normal, nose + 0.02)
}

function finishSettle(reef, profile, bodyLength, rand, now) {
  reef.stageStartedAt = now
  if (reef.mode === 'peck') {
    reef.stage = 'peck'
    reef.pecksLeft = Math.round(randomIn(rand, profile.pecks))
    choosePeckSpot(reef, profile, bodyLength, rand, true)
    reef.peckPhase = 'rest'
    reef.phaseStartedAt = now
    reef.phaseUntil = now + randomIn(rand, profile.peckRestSeconds)
  } else {
    reef.stage = 'hold'
    reef.holdAnchor.copy(reef.site.rest)
    reef.until = now + randomIn(rand, reef.mode === 'shelter' ? profile.shelterSeconds : profile.hoverSeconds)
  }
}

/**
 * Step an owned stage (settle, hold, peck, leave): moves `position` and turns `reef.facing`, and
 * sets `reef.effort` (the speed the tail and fins read). Ends with `reef.stage === 'done'`.
 * speeds: { idle, snap } in WU/s.
 */
export function stepReefOwned(reef, profile, position, delta, now, speeds, bodyLength, rand) {
  const turnStep = THREE.MathUtils.degToRad(profile.turnDegreesPerSecond) * delta

  if (reef.stage === 'settle') {
    const T = reef.settleSeconds
    const u = THREE.MathUtils.clamp((now - reef.stageStartedAt) / T, 0, 1)
    const u2 = u * u
    const u3 = u2 * u
    const P0 = reef.from
    const P1 = reef.site.rest
    const m0 = reef.settleLead
    const m1 = P0.distanceTo(P1) * 0.25
    // Hermite position and its derivative.
    position.copy(P0).multiplyScalar(2 * u3 - 3 * u2 + 1)
      .addScaledVector(reef.fromTangent, (u3 - 2 * u2 + u) * m0)
      .addScaledVector(P1, -2 * u3 + 3 * u2)
      .addScaledVector(reef.faceIn, (u3 - u2) * m1)
    goal.copy(P0).multiplyScalar(6 * u2 - 6 * u)
      .addScaledVector(reef.fromTangent, (3 * u2 - 4 * u + 1) * m0)
      .addScaledVector(P1, -6 * u2 + 6 * u)
      .addScaledVector(reef.faceIn, (3 * u2 - 2 * u) * m1)
    const pathSpeed = goal.length() / T
    if (pathSpeed > 1e-3) goal.normalize()
    else goal.copy(reef.faceIn)
    // The body follows the path, coming round to face the rock by the end.
    goal.lerp(reef.faceIn, THREE.MathUtils.smoothstep(u, 0.55, 1)).normalize()
    clampPitch(goal, MAX_REEF_PITCH)
    rotateToward(reef.facing, goal, turnStep * 2)
    reef.effort = Math.max(pathSpeed, speeds.idle * 0.25)
    if (u >= 1) finishSettle(reef, profile, bodyLength, rand, now)
    return
  }

  if (reef.stage === 'hold') {
    const t = now - reef.stageStartedAt
    // Hanging about: a slow bob and drift round the anchor, the heading wandering only a little
    // (±14°, was ±34°, which read as wiggling side to side). The drift and wander ease in over
    // the first 1.5 s, so the hold starts from where the fish already is and faces.
    const wander = THREE.MathUtils.smoothstep(t, 0, 1.5)
    goal.copy(reef.holdAnchor)
    goal.y += Math.sin(t * 0.9 + reef.wanderPhase) * 0.04 * bodyLength * wander
    scratch.crossVectors(UP, reef.outward)
    goal.addScaledVector(scratch, Math.sin(t * 0.31 + reef.wanderPhase * 1.3) * 0.12 * bodyLength * wander)
    position.lerp(goal, 1 - Math.exp(-delta * 2))
    // Hovering it looks into the reef; sheltering it turns round to face out of the nook.
    if (reef.mode === 'shelter') goal.copy(reef.outward).applyAxisAngle(UP, Math.sin(t * 0.19 + reef.wanderPhase) * 0.2 * wander)
    else goal.copy(reef.faceIn).applyAxisAngle(UP, Math.sin(t * 0.17 + reef.wanderPhase) * 0.25 * wander)
    clampPitch(goal.normalize(), MAX_REEF_PITCH)
    const remaining = rotateToward(reef.facing, goal, turnStep)
    const turning = THREE.MathUtils.clamp(remaining / Math.max(1e-4, turnStep), 0, 1)
    reef.effort = speeds.idle * (0.2 + 0.6 * turning)
    if (now >= reef.until) beginReefLeave(reef, position, rand, now, false)
    return
  }

  if (reef.stage === 'peck') {
    const elapsed = now - reef.phaseStartedAt
    const phase = reef.peckPhase
    rotateToward(reef.facing, reef.faceIn, turnStep)
    if (phase === 'rest') {
      position.lerp(reef.peckRest, 1 - Math.exp(-delta * 5))
      reef.effort = speeds.idle * 0.3
      if (now >= reef.phaseUntil) {
        if (reef.pecksLeft <= 0) {
          // Done: hang about a little further off the spot, then move on.
          reef.stage = 'hold'
          reef.stageStartedAt = now
          reef.holdAnchor.copy(reef.site.rest).addScaledVector(reef.site.normal, 0.35 * bodyLength)
          reef.until = now + randomIn(rand, profile.afterPeckHoverSeconds)
          return
        }
        reef.peckPhase = 'lunge'
        reef.phaseStartedAt = now
        reef.phaseUntil = now + profile.lungeSeconds
        reef.peckFrom.copy(position)
      }
    } else if (phase === 'lunge') {
      const u = THREE.MathUtils.clamp(elapsed / profile.lungeSeconds, 0, 1)
      position.lerpVectors(reef.peckFrom, reef.peckContact, u * u * (3 - 2 * u))
      reef.effort = speeds.idle * 0.6
      if (u >= 1) {
        reef.peckPhase = 'bite'
        reef.phaseStartedAt = now
      }
    } else if (phase === 'bite') {
      position.copy(reef.peckContact)
      reef.effort = speeds.idle * 0.3
      if (elapsed >= profile.biteSeconds) {
        reef.peckPhase = 'recoil'
        reef.phaseStartedAt = now
        reef.recoilTo.copy(reef.peckRest).addScaledVector(reef.peckNormal, profile.recoilBodyLengths * bodyLength)
      }
    } else if (phase === 'recoil') {
      // Back off the rock, easing in and out like the approach.
      const u = THREE.MathUtils.clamp(elapsed / profile.recoilSeconds, 0, 1)
      position.lerpVectors(reef.peckContact, reef.recoilTo, u * u * (3 - 2 * u))
      reef.effort = speeds.idle * 0.5
      if (u >= 1) {
        reef.pecksLeft -= 1
        choosePeckSpot(reef, profile, bodyLength, rand, false)
        reef.peckPhase = 'rest'
        reef.phaseStartedAt = now
        reef.phaseUntil = now + randomIn(rand, profile.peckRestSeconds)
      }
    }
    return
  }

  if (reef.stage === 'leave') {
    const rate = reef.urgent ? 2.5 : 1
    rotateToward(reef.facing, reef.leaveDirection, turnStep * rate)
    const outness = reef.facing.dot(reef.outward)
    const cruise = reef.urgent ? speeds.snap : speeds.idle
    if (outness < 0.25) {
      // Still facing the rock: back off it a little while turning round.
      position.addScaledVector(reef.outward, 0.08 * bodyLength * delta)
      reef.leaveSpeed = 0
      reef.effort = speeds.idle * 0.5
    } else {
      reef.leaveSpeed = Math.min(cruise, reef.leaveSpeed + cruise * delta * 1.5)
      position.addScaledVector(reef.facing, reef.leaveSpeed * delta)
      reef.effort = Math.max(reef.leaveSpeed, speeds.idle * 0.5)
    }
    const aligned = reef.facing.dot(reef.leaveDirection) > 0.97
    if ((aligned && position.distanceTo(reef.leaveStart) > 0.9 * bodyLength) || now - reef.stageStartedAt > LEAVE_MAX_SECONDS) {
      reef.stage = 'done'
    }
  }
}
