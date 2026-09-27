import assert from 'node:assert/strict'
import * as THREE from 'three'
import {
  SWIM_BOX,
  boundaryAvoidanceTurnStep,
  clampToSwimBounds,
  computeBoidSteering,
  creatureBodyLength,
  forEachFish,
  getFishEntry,
  mulberry32,
  pitchToward,
  randomRange,
  randomRangeFromPair,
  resolveSwimProfile,
  rotateDirectionToward,
  schoolFormationOffset,
  schoolFormationVerticalHalfExtent,
  soloAgentReachedDistance,
  swimBounds,
  swimXRangeAtZ,
  threatLevelAt,
  unregisterFish,
  updateFishRegistry,
  yawToward,
} from '../src/components/fishSwim.js'

// Movement had no test coverage while it lived in Fish.jsx, because Node cannot import
// .jsx. These pin the behaviour that the extraction had to preserve.

const sardine = { id: 'test-sardine', species: 'amblygaster-sirm', biome: 'ocean', size: 1 }
const mako = { id: 'test-mako', species: 'isurus-oxyrinchus', biome: 'ocean', size: 1 }
const mola = { id: 'test-mola', species: 'mola-alexandrini', biome: 'ocean', size: 1 }

const sardineSwim = resolveSwimProfile(sardine)
const makoSwim = resolveSwimProfile(mako)

// --- swim profiles resolve off real species data -----------------------------------

assert.equal(sardineSwim.bodyLengthWU, 1.08, 'sardine swim profile carries the species body length')
assert.equal(makoSwim.bodyLengthWU, 17.8, 'mako swim profile carries the corrected 4.45 m body length')
assert.equal(resolveSwimProfile({ species: 'not-a-species' }).bodyLengthWU, 1, 'unknown species falls back to the default profile')
assert.equal(creatureBodyLength({ ...sardine, size: 0.5 }, sardineSwim), 0.54, 'body length scales with individual size')

// --- swim bounds -------------------------------------------------------------------

const bounds = swimBounds('epipelagic', sardineSwim, 1)

assert.ok(bounds.yMin < bounds.yMax, 'vertical bounds are ordered')
assert.ok(bounds.zMin < bounds.zMax, 'depth bounds are ordered')
assert.equal(bounds.xMin, -bounds.x, 'x bounds are symmetric about the centre line')
assert.equal(bounds.xMax, bounds.x, 'x bounds are symmetric about the centre line')

// The swim box is pushed away from the camera, so the whole z range sits behind it.
assert.ok(bounds.zMax < 0, 'the swim volume sits behind the camera plane')
assert.ok(bounds.zMin < bounds.zMax, 'near edge is nearer than the far edge')

// The volume is a frustum, not a box: it is wider at the near plane than at the far one.
const nearX = swimXRangeAtZ(bounds, bounds.zMax).xMax
const farX = swimXRangeAtZ(bounds, bounds.zMin).xMax
assert.ok(farX > nearX, 'the volume widens with distance from the camera, matching the camera frustum')
assert.equal(bounds.x, Math.max(nearX, farX), 'bounds.x is the widest half-width in the volume')

// Concrete widths, so a change to the tank camera's FOV, aspect, or safe fraction has to
// be a deliberate edit here rather than a silent reshaping of where every fish may swim.
assert.ok(Math.abs(swimXRangeAtZ(bounds, -15).xMax - 29.181592) < 1e-5, 'half-width at z=-15 is unchanged')
assert.ok(Math.abs(swimXRangeAtZ(bounds, 0).xMax - 12.969596) < 1e-5, 'half-width at the camera plane is unchanged')

// A big fish earns a larger margin off every derived wall. Tested on synthetic profiles
// because every shipped species overrides boundsYMin/boundsZMin/boundsZMax outright, which
// would mask the derivation this is checking.
const smallDerived = swimBounds('epipelagic', { bodyLengthWU: 1 }, 1)
const largeDerived = swimBounds('epipelagic', { bodyLengthWU: 18 }, 1)
assert.ok(largeDerived.yMin > smallDerived.yMin, 'a larger fish is held further off the floor')
assert.ok(largeDerived.yMax < smallDerived.yMax, 'a larger fish is held further off the ceiling')
assert.ok(largeDerived.zMax < smallDerived.zMax, 'a larger fish is held further off the near wall')
assert.ok(largeDerived.zMin > smallDerived.zMin, 'a larger fish is held further off the far wall')

// The shipped species do override those walls, and the override has to win.
const makoBounds = swimBounds('epipelagic', makoSwim, 1)
assert.equal(makoBounds.yMin, -14, 'the mako uses its own floor rather than the derived one')
assert.ok(makoBounds.yMax < bounds.yMax, 'the ceiling stays derived, so the larger mako sits further below it')

// Species overrides win over the derived values.
const overridden = swimBounds('epipelagic', { ...sardineSwim, boundsYMin: -1, boundsYMax: 1 }, 1)
assert.equal(overridden.yMin, -1, 'boundsYMin override is used verbatim')
assert.equal(overridden.yMax, 1, 'boundsYMax override is used verbatim')

// An unknown depth zone falls back to the epipelagic band rather than throwing.
assert.deepEqual(
  swimBounds('not-a-zone', sardineSwim, 1),
  swimBounds('epipelagic', sardineSwim, 1),
  'an unknown depth zone falls back to epipelagic',
)

// --- clamping ----------------------------------------------------------------------

const outside = new THREE.Vector3(9999, 9999, 9999)
clampToSwimBounds(outside, bounds)
assert.ok(outside.y <= bounds.yMax && outside.y >= bounds.yMin, 'clamped point lands inside the vertical band')
assert.ok(outside.z <= bounds.zMax && outside.z >= bounds.zMin, 'clamped point lands inside the depth band')
assert.ok(outside.x <= swimXRangeAtZ(bounds, outside.z).xMax, 'clamped point lands inside the width at its own depth')

const alreadyInside = new THREE.Vector3(0, (bounds.yMin + bounds.yMax) / 2, (bounds.zMin + bounds.zMax) / 2)
const before = alreadyInside.clone()
clampToSwimBounds(alreadyInside, bounds)
assert.deepEqual(
  [alreadyInside.x, alreadyInside.y, alreadyInside.z],
  [before.x, before.y, before.z],
  'a point already inside the volume is left untouched',
)

// x is clamped against the width at the clamped z, not the widest point in the volume.
// Regression guard: clamping x first would let a fish sit outside the near-plane frustum.
const nearPlane = new THREE.Vector3(bounds.x, 0, bounds.zMax + 5000)
clampToSwimBounds(nearPlane, bounds)
assert.ok(nearPlane.x <= swimXRangeAtZ(bounds, nearPlane.z).xMax + 1e-9, 'x is clamped against the width at its final depth')

// --- boundary avoidance ------------------------------------------------------------

const bodyLength = creatureBodyLength(sardine, sardineSwim)
// A per-frame heading step small enough that the avoidance tightening can exceed it;
// a large open-water step already covers the arc and is returned unchanged.
const baseStep = 0.005
const midY = (bounds.yMin + bounds.yMax) / 2
const openWater = new THREE.Vector3(0, midY, (bounds.zMin + bounds.zMax) / 2)

// Aimed along a wall rather than at it: nothing to avoid, so the base turn cap stands.
assert.equal(
  boundaryAvoidanceTurnStep(baseStep, openWater, new THREE.Vector3(1, 0, 0).normalize(), bounds, sardineSwim, bodyLength, 2, 1 / 60),
  baseStep,
  'skimming parallel to a wall leaves the open-water turn cap unchanged',
)

// Nose against the ceiling, pointed straight at it: the cap has to open up.
const atCeiling = new THREE.Vector3(0, bounds.yMax - 0.01, (bounds.zMin + bounds.zMax) / 2)
const tightened = boundaryAvoidanceTurnStep(baseStep, atCeiling, new THREE.Vector3(0, 1, 0), bounds, sardineSwim, bodyLength, 2, 1 / 60)
assert.ok(tightened > baseStep, 'bearing down on a wall raises the per-frame turn cap')

// The tightening is monotonic in urgency: closer to the wall never turns slower.
const halfWay = new THREE.Vector3(0, midY + (bounds.yMax - midY) * 0.5, (bounds.zMin + bounds.zMax) / 2)
const halfWayStep = boundaryAvoidanceTurnStep(baseStep, halfWay, new THREE.Vector3(0, 1, 0), bounds, sardineSwim, bodyLength, 2, 1 / 60)
assert.ok(tightened >= halfWayStep, 'the turn cap never eases as the wall gets closer')

// It is a cap, never a floor: a zero-speed fish cannot be forced to turn.
assert.equal(
  boundaryAvoidanceTurnStep(baseStep, atCeiling, new THREE.Vector3(0, 1, 0), bounds, sardineSwim, bodyLength, 0, 1 / 60),
  baseStep,
  'a stationary fish keeps the base turn cap',
)

// --- reached-distance thresholds ---------------------------------------------------

assert.ok(
  soloAgentReachedDistance(mola, 9.6) < soloAgentReachedDistance({ ...sardine }, 9.6),
  'Mola uses a tighter arrival threshold than a normal fish of the same length',
)
assert.ok(soloAgentReachedDistance(mola, 9.6) <= 3.0, 'Mola arrival threshold is capped')
assert.ok(soloAgentReachedDistance(sardine, 0.1) >= 0.7, 'arrival threshold has a floor for very small fish')

// --- seeded randomness is deterministic --------------------------------------------

const a = mulberry32(1234)
const b = mulberry32(1234)
assert.equal(randomRange(a, 0, 1), randomRange(b, 0, 1), 'the same seed yields the same sequence')
assert.notEqual(randomRange(mulberry32(1), 0, 1), randomRange(mulberry32(2), 0, 1), 'different seeds diverge')

const paired = randomRangeFromPair(mulberry32(7), [5, 5], [0, 0])
assert.equal(paired, 5, 'a degenerate pair returns its single value')
assert.equal(randomRangeFromPair(mulberry32(7), null, [3, 3]), 3, 'a missing pair falls back')

// --- boid steering ------------------------------------------------------------------

// The registry is module state shared by every fish, so each case cleans up after itself.
function withRegistry(entries, fn) {
  for (const [creature, swim, position] of entries) {
    const host = { position: new THREE.Vector3(position.x, position.y, position.z) }
    updateFishRegistry(host, creature, swim, null, new THREE.Vector3(0, 0, -1))
  }
  try {
    return fn()
  } finally {
    const ids = []
    forEachFish((_entry, id) => ids.push(id))
    ids.forEach(unregisterFish)
  }
}

const steering = new THREE.Vector3()
const self = { position: new THREE.Vector3(0, 0, -15) }

// With nobody else in the tank there is nothing to steer around.
withRegistry([], () => {
  computeBoidSteering(steering, self, sardine, sardineSwim)
  assert.equal(steering.lengthSq(), 0, 'a lone fish gets no boid steering')
})

// Very close in from +x: separation wins and pushes the fish back along -x.
withRegistry([[{ ...sardine, id: 'neighbour' }, sardineSwim, { x: 0.05, y: 0, z: -15 }]], () => {
  computeBoidSteering(steering, self, sardine, sardineSwim)
  assert.ok(steering.lengthSq() > 0, 'a close neighbour produces steering')
  assert.ok(steering.x < 0, 'separation pushes away from a neighbour crowding in from +x')
})

// Loosely spaced in from +x: cohesion wins and pulls the fish toward the group instead.
// The sign flip between these two cases is the whole point of the separation/cohesion
// balance — a regression that lost it would leave a school either clumping or scattering.
withRegistry([[{ ...sardine, id: 'neighbour' }, sardineSwim, { x: 1.0, y: 0, z: -15 }]], () => {
  computeBoidSteering(steering, self, sardine, sardineSwim)
  assert.ok(steering.x > 0, 'cohesion pulls toward a neighbour holding a comfortable distance')
})

// A neighbour in a different biome is invisible, however close it is.
withRegistry([[{ ...sardine, id: 'other-biome', biome: 'reef' }, sardineSwim, { x: 0.35, y: 0, z: -15 }]], () => {
  computeBoidSteering(steering, self, sardine, sardineSwim)
  assert.equal(steering.lengthSq(), 0, 'neighbours in another biome are ignored')
})

// A neighbour far outside the perception radius is ignored.
withRegistry([[{ ...sardine, id: 'distant' }, sardineSwim, { x: 400, y: 0, z: -15 }]], () => {
  computeBoidSteering(steering, self, sardine, sardineSwim)
  assert.equal(steering.lengthSq(), 0, 'a neighbour beyond the threat radius produces no steering')
})

// Steering saturates rather than accumulating — this is what keeps a dense school from
// snapping a fish across the tank in one frame. 275 of the tank's sardines are real, so
// this bound is load-bearing, not theoretical.
function crowdSteering(count) {
  return withRegistry(
    Array.from({ length: count }, (_, i) => [
      { ...sardine, id: `crowd-${i}` },
      sardineSwim,
      { x: 0.2 + i * 0.01, y: (i % 5) * 0.05, z: -15 + (i % 7) * 0.05 },
    ]),
    () => {
      const out = new THREE.Vector3()
      computeBoidSteering(out, self, sardine, sardineSwim)
      return out.length()
    },
  )
}

const crowd40 = crowdSteering(40)
const crowd120 = crowdSteering(120)
// 0.7 is the sardine's own boids.maxWeight, not a global ceiling.
assert.ok(crowd40 <= sardineSwim.boids.maxWeight + 1e-9, 'boid steering stays within the species maxWeight in a dense school')
assert.equal(crowd120, crowd40, 'steering saturates: tripling the crowd does not increase it')

// Every shipped species overrides its boid weights, so the module-level defaults are only
// reachable through a profile with no `boids` block. Without this, a regression in the
// fallback weights would go unnoticed until a new species shipped without a tuned config.
const defaultSwim = { bodyLengthWU: 1.08 }
const defaultFish = { id: 'default-self', species: 'amblygaster-sirm', biome: 'ocean', size: 1 }

function defaultSteeringAt(distance) {
  return withRegistry([[{ ...defaultFish, id: 'd-0' }, defaultSwim, { x: distance, y: 0, z: -15 }]], () => {
    const out = new THREE.Vector3()
    computeBoidSteering(out, self, defaultFish, defaultSwim)
    return out.clone()
  })
}

// Both of these are sign flips rather than magnitude pins, so they survive retuning but
// still fail if a default weight is lost. Each distance is chosen to sit clear of the
// maxWeight clamp, where any weight would produce the same saturated answer.
const defaultClose = defaultSteeringAt(0.25)
assert.ok(defaultClose.x < 0, 'default separation weight wins at close range')
assert.ok(defaultClose.length() <= 0.34 + 1e-9, 'default steering respects the default maxWeight')

const defaultLoose = defaultSteeringAt(1.0)
assert.ok(defaultLoose.x > 0, 'default cohesion weight wins at a comfortable distance')

// Pressed on all sides, the default profile saturates at exactly the default maxWeight.
const defaultCrowd = withRegistry(
  Array.from({ length: 8 }, (_, i) => [
    { ...defaultFish, id: `dc-${i}` },
    defaultSwim,
    { x: 0.05 + i * 0.015, y: (i % 3) * 0.03, z: -15 + (i % 4) * 0.02 },
  ]),
  () => {
    const out = new THREE.Vector3()
    computeBoidSteering(out, self, defaultFish, defaultSwim)
    return out.length()
  },
)
assert.ok(Math.abs(defaultCrowd - 0.34) < 1e-9, 'default steering saturates at the default maxWeight of 0.34')

// Alignment: a neighbour's heading has to change the answer. With the alignment weight
// lost, these two cases — same neighbour, same distance, opposite headings — collapse
// to the same steering.
function steeringForNeighbourHeading(forward) {
  return withRegistry([], () => {
    updateFishRegistry(
      { position: new THREE.Vector3(1.0, 0, -15) },
      { ...defaultFish, id: 'aligned' },
      defaultSwim,
      null,
      new THREE.Vector3(...forward),
    )
    const out = new THREE.Vector3()
    computeBoidSteering(out, self, defaultFish, defaultSwim)
    return out.clone()
  })
}
const withNeighbourHeadingPlusX = steeringForNeighbourHeading([1, 0, 0])
const withNeighbourHeadingMinusX = steeringForNeighbourHeading([-1, 0, 0])
assert.ok(
  Math.abs(withNeighbourHeadingPlusX.x - withNeighbourHeadingMinusX.x) > 0.05,
  'a neighbour\'s heading changes the steering, so alignment is actually applied',
)
assert.ok(withNeighbourHeadingPlusX.x > withNeighbourHeadingMinusX.x, 'alignment steers toward the neighbour\'s heading')

// --- threat evasion -------------------------------------------------------------------

// Prey evade the mako's path over the next second, not just where it is now. Every case sits
// the mako beyond the sardine's perception radius (~3.7 WU) so collision separation, which is
// still radial from its centre, stays out of the answer and only the threat push is measured.
function steeringFromMako([x, y, z], forward, speed) {
  return withRegistry([], () => {
    updateFishRegistry({ position: new THREE.Vector3(x, y, z) }, { ...mako, id: 'threat' }, makoSwim, null, new THREE.Vector3(...forward), speed)
    const out = new THREE.Vector3()
    computeBoidSteering(out, self, sardine, sardineSwim)
    return out.clone()
  })
}

// Passing 0.8 WU to one side: a stationary mako pushes the sardine ahead along its line; a
// moving one pushes it straight off its path, and harder, because the path comes that close.
const passingStill = steeringFromMako([-5, 0, -15.8], [1, 0, 0], 0)
const passingMoving = steeringFromMako([-5, 0, -15.8], [1, 0, 0], 6)
assert.ok(passingStill.x > Math.abs(passingStill.z), 'a stationary threat pushes radially, mostly along its line')
assert.ok(Math.abs(passingMoving.x) < 1e-9 && passingMoving.z > 0, 'a moving threat pushes the sardine sideways off its path')
assert.ok(passingMoving.length() > passingStill.length() * 1.5, 'a path that will pass close is a stronger threat than where the mako is now')

// Out of range now, but in range within the lookahead: only the moving mako is noticed. The
// range toward a mako is its own body length (17.8 WU here), not the sardine's ~7 WU.
assert.equal(steeringFromMako([-21, 0, -15.5], [1, 0, 0], 0).lengthSq(), 0, 'a stationary threat beyond the radius is ignored')
assert.ok(steeringFromMako([-21, 0, -15.5], [1, 0, 0], 6).x > 0, 'an approaching threat is avoided before it arrives')

// Swimming away, the closest point of the path is where the mako is now: no better, no worse.
assert.deepEqual(
  steeringFromMako([-5, 0, -15], [-1, 0, 0], 6).toArray(),
  steeringFromMako([-5, 0, -15], [-1, 0, 0], 0).toArray(),
  'a threat swimming away is treated exactly as a stationary one',
)

// Dead ahead of a charging mako neither side is nearer; the sardine still breaks sideways at
// full strength instead of freezing on a zero-length push.
const deadOn = steeringFromMako([-5, 0, -15], [1, 0, 0], 6)
assert.ok(Math.abs(deadOn.x) < 1e-9 && Math.abs(deadOn.z) > 0.4, 'dead on the path the sardine breaks sideways, hard')

// threatLevelAt is the per-frame startle check. Fish.jsx startles a fish into a burst at 0.25.
function threatLevelFromMako([x, y, z], forward, speed) {
  return withRegistry([], () => {
    updateFishRegistry({ position: new THREE.Vector3(x, y, z) }, { ...mako, id: 'threat' }, makoSwim, null, new THREE.Vector3(...forward), speed)
    return threatLevelAt(self.position, sardine, sardineSwim)
  })
}
const chargingLevel = threatLevelFromMako([-5, 0, -15], [1, 0, 0], 6)
const idleLevel = threatLevelFromMako([-12, 0, -15], [1, 0, 0], 0)
assert.ok(chargingLevel > 0.75, 'a sardine dead ahead of a charging mako is at near-maximum alarm')
assert.ok(idleLevel > 0 && idleLevel < 0.1, 'a mako idling 12 WU away is noticed but far below a startle')
assert.equal(threatLevelFromMako([-21, 0, -15.5], [1, 0, 0], 0), 0, 'a stationary mako beyond the threat radius raises no alarm')

// Detection range scales with the predator: the mako idling 12 WU away (above) is noticed, well
// past the sardine's own ~7 WU threat radius, but a small predator at the same distance is not.
assert.equal(
  withRegistry([[{ id: 'far-mahi', species: 'coryphaena-hippurus', biome: 'ocean', size: 0.4 }, resolveSwimProfile({ species: 'coryphaena-hippurus' }), { x: -12, y: 0, z: -15 }]], () =>
    threatLevelAt(self.position, sardine, sardineSwim)),
  0,
  'a mahi 12 WU away goes unnoticed where a mako would not',
)

// The escape direction a startled fish dashes along points off the threat's path, not ahead of it.
const escapeFromPassing = withRegistry([], () => {
  updateFishRegistry({ position: new THREE.Vector3(-5, 0, -15.8) }, { ...mako, id: 'threat' }, makoSwim, null, new THREE.Vector3(1, 0, 0), 6)
  const escape = new THREE.Vector3()
  threatLevelAt(self.position, sardine, sardineSwim, escape)
  return escape
})
assert.ok(Math.abs(escapeFromPassing.length() - 1) < 1e-9, 'the escape direction is a unit vector')
assert.ok(Math.abs(escapeFromPassing.x) < 1e-9 && escapeFromPassing.z > 0.99, 'a sardine beside a passing mako escapes straight off its path')

// Only fish with menace count: a packed school around the sardine is no threat to it.
assert.equal(
  withRegistry(
    Array.from({ length: 30 }, (_, i) => [{ ...sardine, id: `calm-${i}` }, sardineSwim, { x: 0.2 + i * 0.05, y: 0, z: -15 }]),
    () => threatLevelAt(self.position, sardine, sardineSwim),
  ),
  0,
  'a crowd of sardines is no threat to a sardine',
)

// The hierarchy holds: nothing in the tank alarms the mako.
assert.equal(
  withRegistry([[{ id: 'mahi', species: 'coryphaena-hippurus', biome: 'ocean', size: 1 }, resolveSwimProfile({ species: 'coryphaena-hippurus' }), { x: 1, y: 0, z: -15 }]], () =>
    threatLevelAt(self.position, mako, makoSwim)),
  0,
  'a mahi alongside the mako does not alarm it',
)

// Unregistering a threat removes it from the per-frame check too, not just from the registry.
withRegistry([], () => {
  updateFishRegistry({ position: new THREE.Vector3(-5, 0, -15) }, { ...mako, id: 'leaving' }, makoSwim, null, new THREE.Vector3(1, 0, 0), 6)
  assert.ok(threatLevelAt(self.position, sardine, sardineSwim) > 0.75, 'the charging mako alarms the sardine')
  unregisterFish('leaving')
  assert.equal(threatLevelAt(self.position, sardine, sardineSwim), 0, 'once it unmounts it alarms nobody')
})

// --- escape arc turning -----------------------------------------------------------------

// A startled fish carves its U-turn with yawToward. The ordinary rotateDirectionToward lerps, so
// aimed dead astern it does not turn at all on the first step (it only flips past halfway) —
// which is exactly the snap the escape arc replaces.
const astern = new THREE.Vector3(0, 0, -1)
assert.equal(rotateDirectionToward(new THREE.Vector3(0, 0, 1), astern, 0.3).x, 0, 'the lerping turn stalls on a target dead astern')

const uTurn = new THREE.Vector3(0, 0, 1)
let uTurnSteps = 0
while (uTurn.angleTo(astern) > 1e-9 && uTurnSteps < 50) {
  const before = uTurn.clone()
  yawToward(uTurn, astern, 0.3, 1)
  uTurnSteps += 1
  if (uTurn.angleTo(astern) > 1e-9) assert.ok(Math.abs(before.angleTo(uTurn) - 0.3) < 1e-9, 'every step of the U-turn sweeps the full allowed angle')
}
assert.equal(uTurnSteps, Math.ceil(Math.PI / 0.3), 'a U-turn takes exactly as many steps as its angle allows, with no stall')
assert.ok(yawToward(new THREE.Vector3(0, 0, 1), astern, 0.3, 1).x > 0, 'side +1 turns dead astern one way')
assert.ok(yawToward(new THREE.Vector3(0, 0, 1), astern, 0.3, -1).x < 0, 'side -1 turns it the other')
assert.ok(yawToward(new THREE.Vector3(0, 0, 1), new THREE.Vector3(-1, 0, -0.2), 0.3, 1).x < 0, 'off dead astern it takes the shorter way whatever the side')
// Headings either side of the -z axis are 20° apart the short way but 340° the long way. The
// side hint points the long way here, and must not win over the shorter turn.
const acrossSeam = new THREE.Vector3(Math.sin(THREE.MathUtils.degToRad(170)), 0, Math.cos(THREE.MathUtils.degToRad(170)))
const acrossSeamTarget = new THREE.Vector3(-acrossSeam.x, 0, acrossSeam.z)
const acrossSeamBefore = acrossSeam.angleTo(acrossSeamTarget)
yawToward(acrossSeam, acrossSeamTarget, 0.1, -1)
assert.ok(Math.abs(acrossSeamBefore - acrossSeam.angleTo(acrossSeamTarget) - 0.1) < 1e-9, 'a turn across the -z axis goes the short way round')

// pitchToward is the vertical half: heading unchanged, tilt stepped by at most the allowed angle.
const tilting = pitchToward(new THREE.Vector3(1, 0, 0), new THREE.Vector3(1, 1, 0), 0.2)
assert.ok(Math.abs(Math.atan2(tilting.y, Math.hypot(tilting.x, tilting.z)) - 0.2) < 1e-12, 'pitch steps by the allowed angle')
assert.ok(Math.abs(tilting.z) < 1e-12 && tilting.x > 0, 'and the heading stays put')
assert.ok(Math.abs(tilting.length() - 1) < 1e-12, 'and the direction stays a unit vector')
assert.ok(Math.abs(pitchToward(new THREE.Vector3(1, 0, 0), new THREE.Vector3(1, 0.05, 0), 0.2).y - Math.sin(Math.atan2(0.05, 1))) < 1e-12, 'a pitch within reach is matched exactly')

// Together they turn an escape at exactly its own rate: one yaw step, no second step on top.
const arcStep = new THREE.Vector3(0, 0, 1)
yawToward(arcStep, new THREE.Vector3(1, 0, 0), 0.1, 1)
pitchToward(arcStep, new THREE.Vector3(1, 0, 0), 0.1)
assert.ok(Math.abs(arcStep.angleTo(new THREE.Vector3(0, 0, 1)) - 0.1) < 1e-12, 'an escape step turns by exactly its allowed angle')

const pitched = yawToward(new THREE.Vector3(0, 0.3, 1).normalize(), new THREE.Vector3(1, 0, 0), 0.5, 1)
assert.ok(Math.abs(pitched.y - new THREE.Vector3(0, 0.3, 1).normalize().y) < 1e-12, 'the arc turns heading only, leaving pitch for the ordinary step')
assert.ok(Math.abs(pitched.length() - 1) < 1e-12, 'and keeps the direction a unit vector')

// --- school formation fits its bounds -------------------------------------------------------

// The leader keeps the school's goal this far from the vertical bounds, so it must reach every
// member's slot — a slot past it is a fish flattened against yMax. It should also be tight, or
// the school is kept needlessly out of the top and bottom of its band.
for (const count of [2, 95, 180, 275]) {
  const school = { id: `fit-${count}`, count, index: 0 }
  let highest = 0
  for (let index = 0; index < count; index += 1) {
    const slot = schoolFormationOffset({ ...school, index }, { ...sardine, id: `fit-${count}-${index}` })
    highest = Math.max(highest, Math.abs(slot.vertical))
  }
  const extent = schoolFormationVerticalHalfExtent(school, sardine)
  assert.ok(highest <= extent + 1e-9, `every slot of a ${count}-fish school sits within its vertical half-extent`)
  // A pair fills two slots and never reaches the formation's full height; a real school does.
  if (count >= 95) assert.ok(extent - highest < 0.25, `and the half-extent of a ${count}-fish school is not loose`)
}
assert.ok(Math.abs(schoolFormationVerticalHalfExtent({ id: 's', count: 180 }, sardine) - 3.98) < 0.01, 'the 180-sardine school reaches ~3.98 WU above and below its centre')

// --- registry accessors -------------------------------------------------------------

withRegistry([[sardine, sardineSwim, { x: 1, y: 2, z: -15 }]], () => {
  const entry = getFishEntry(sardine.id)
  assert.ok(entry, 'a registered fish is readable by id')
  assert.equal(entry.species, 'amblygaster-sirm', 'the entry carries its species')
  assert.equal(entry.biome, 'ocean', 'the entry carries its biome')
  assert.equal(entry.schoolId, null, 'an unschooled fish has no school id')
  assert.equal(entry.speed, 0, 'a fish registered without a speed reads as stationary')
  // Every frame after the first updates the existing entry, so speed must be refreshed there
  // too — otherwise it stays at its first-frame 0 and evasion silently never happens.
  updateFishRegistry({ position: new THREE.Vector3(1, 2, -15) }, sardine, sardineSwim, null, new THREE.Vector3(0, 0, -1), 1.5)
  assert.equal(getFishEntry(sardine.id).speed, 1.5, 'an existing entry picks up its new speed')
})
assert.equal(getFishEntry(sardine.id), undefined, 'an unregistered fish reads back as undefined')

// --- per-frame allocation caches ------------------------------------------------------

// swimBounds is called several times per fish per frame, so each swim profile keeps the last
// bounds it produced. Same arguments -> the same shared object; it must be frozen so no caller
// can corrupt another fish's bounds, and different arguments must not return stale bounds.
const cachedBounds = swimBounds('epipelagic', sardineSwim, 0.8)
assert.equal(swimBounds('epipelagic', sardineSwim, 0.8), cachedBounds, 'repeat calls reuse one bounds object')
assert.ok(Object.isFrozen(cachedBounds), 'shared bounds are frozen')
const otherZone = swimBounds('mesopelagic', sardineSwim, 0.8)
assert.notEqual(otherZone, cachedBounds, 'a different depth zone is not served from the cache')
assert.ok(otherZone.yMax < cachedBounds.yMax, 'and really is the deeper band')
assert.deepEqual(
  swimBounds('epipelagic', { ...sardineSwim }, 0.8),
  swimBounds('epipelagic', sardineSwim, 0.8),
  'a fresh profile with the same values computes the same bounds',
)

// Boid params are cached per swim profile too, keyed by species so a profile object shared
// across species (as tests do) can never hand one species another's menace.
withRegistry([], () => {
  const sharedSwim = { bodyLengthWU: 2 }
  updateFishRegistry({ position: new THREE.Vector3() }, { ...mako, id: 'p1' }, sharedSwim)
  updateFishRegistry({ position: new THREE.Vector3(5, 0, 0) }, { ...sardine, id: 'p2' }, sharedSwim)
  assert.equal(getFishEntry('p1').repulser, true, 'the mako is a repulser')
  assert.equal(getFishEntry('p2').repulser, false, 'the sardine is not, even through the same profile')
  assert.equal(getFishEntry('p1').repulsionScale, 2.2, 'the mako gets the repulser scale')
  assert.equal(getFishEntry('p2').repulsionScale, 1, 'the sardine does not inherit it from the cache')
})

// --- module constants still shared with Fish.jsx -------------------------------------

assert.equal(SWIM_BOX.z, 7.4, 'the swim box depth is unchanged by the extraction')

console.log('fish swim tests passed')
