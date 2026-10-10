import assert from 'node:assert/strict'
import * as THREE from 'three'
import {
  advanceRide,
  caudalLateralCurve,
  claimRideSlot,
  computeBoidSteering,
  createRideState,
  escortStation,
  findEscortHost,
  findRideHost,
  forEachFish,
  hitchhikerProfile,
  keepRiderClearOfHost,
  mulberry32,
  releaseRideSlots,
  resolveSwimProfile,
  rideAnchorPose,
  rideBendProfile,
  RIDE_BEND_START,
  rideAnchorFit,
  rideApproachWaypoint,
  rideHostLocalPose,
  rideFollowHostWave,
  rideHostLoad,
  rideHostProfile,
  rideSpotClear,
  rideStagingLocal,
  rideHostWeight,
  rideSlotOccupant,
  unregisterFish,
  updateFishRegistry,
  updateFishRegistryPose,
} from '../src/components/fishSwim.js'
import { SPECIES, TANKS } from '../src/data/species.js'
import { SURFACE_PLANE_Y } from '../src/utils/waterSurfaceGeometry.js'

// Remoras riding hosts: the anchor maths, slot bookkeeping, host choice, and the
// approach -> latch -> attached -> release state machine, driven without a renderer.

const speciesById = new Map(SPECIES.map(species => [species.id, species]))
const makoSpecies = speciesById.get('isurus-oxyrinchus')
const molaSpecies = speciesById.get('mola-alexandrini')
const sharksuckerSpecies = speciesById.get('echeneis-naucrates')
const EPS = 1e-6

function near(a, b, message, eps = EPS) {
  assert.ok(Math.abs(a - b) <= eps, `${message} (got ${a}, expected ${b})`)
}

function nearVector(a, b, message, eps = EPS) {
  assert.ok(a.distanceTo(b) <= eps, `${message} (got ${a.toArray()}, expected ${b.toArray()})`)
}

function clearRegistry() {
  const ids = []
  forEachFish((_entry, id) => ids.push(id))
  ids.forEach(unregisterFish)
}

// A host registered the way Fish.jsx does it: movement entry, then the rendered pose.
function registerHost(creature, position, quaternion = new THREE.Quaternion(), speed = 0, opacity = 1) {
  const swim = resolveSwimProfile(creature)
  updateFishRegistry({ position }, creature, swim, null, new THREE.Vector3(0, 0, -1).applyQuaternion(quaternion))
  updateFishRegistryPose(creature.id, quaternion, speed, opacity)
}

// --- profiles --------------------------------------------------------------------------

const makoHost = rideHostProfile(makoSpecies)
const molaHost = rideHostProfile(molaSpecies)
assert.ok(makoHost, 'the mako is a ride host')
assert.ok(molaHost, 'the Mola is a ride host')
// Spots are sampled over each host's mesh by face normal (scripts/fit-ride-anchors.mjs):
// many of them, on both flanks and the belly, and not mirror images of each other.
for (const [hostName, host, from, to] of [['mako', makoHost, 0.12, 0.5], ['mola', molaHost, 0.15, 0.7]]) {
  assert.ok(host.anchors.length >= 12, `the ${hostName} offers a spread of spots (${host.anchors.length})`)
  assert.ok(host.anchors.some(a => a.normal.x > 0.5) && host.anchors.some(a => a.normal.x < -0.5), `the ${hostName} has spots on both flanks`)
  assert.ok(host.anchors.some(a => a.normal.y < -0.5), `the ${hostName} has spots underneath`)
  assert.ok(host.anchors.every(a => a.normal.y <= 0.35), `no ${hostName} spot faces up`)
  const mirrored = host.anchors.filter(a => host.anchors.some(b => b !== a && Math.hypot(a.at.x + b.at.x, a.at.y - b.at.y, a.at.z - b.at.z) < 0.01))
  assert.ok(mirrored.length <= host.anchors.length / 4, `the ${hostName} spots are uneven, not mirrored (${mirrored.length} mirrored)`)
  if (host.wave) assert.ok(host.anchors.every(a => a.tail01 >= from - 0.01 && a.tail01 <= to + 0.01), `every ${hostName} spot is ${from}-${to} along the body`)
}
assert.ok(makoHost.wave, 'the mako carries its riders with its caudal wave')
assert.equal(molaHost.wave, null, 'the Mola has no caudal wave to follow')
assert.equal(rideHostProfile(makoSpecies), makoHost, 'host profiles are cached per species')
assert.equal(rideHostProfile(speciesById.get('amblygaster-sirm')), null, 'a sardine is not a host')
assert.equal(hitchhikerProfile(makoSpecies), null, 'the mako does not ride anything')

const weightOn = (riderId, hostProfile) => rideHostWeight(hitchhikerProfile(speciesById.get(riderId)), hostProfile)
assert.equal(weightOn('echeneis-naucrates', makoHost), 1, 'a sharksucker takes a shark readily')
assert.equal(weightOn('remora-remora', makoHost), 1, 'the common remora takes a shark readily')
assert.equal(weightOn('remora-australis', makoHost), 0, 'the whalesucker never rides a shark')
assert.equal(weightOn('remora-albescens', makoHost), 0.3, 'the white suckerfish rides a shark only occasionally')
assert.equal(weightOn('remora-brachyptera', molaHost), 0.7, 'the spearfish remora rides a sunfish')
assert.equal(weightOn('echeneis-naucrates', molaHost), 0.5, 'group matching takes the best group: a Mola is a large fish')

// Every remora is the right kind of creature for the ride path: a solo agent with a host list.
for (const species of SPECIES.filter(s => s.family === 'Echeneidae')) {
  assert.equal(species.schooling, false, `${species.id} runs the solo-agent path it rides from`)
  assert.ok(hitchhikerProfile(species), `${species.id} has a hitchhiker profile`)
  if (species.model.path.endsWith('_placeholder.glb')) {
    assert.equal(species.placeholder?.type, 'remora', `${species.id} renders a remora placeholder until its model lands`)
  } else {
    // A supplied model is measured, not assumed: its top line replaces the stand-in's straight back.
    assert.ok(hitchhikerProfile(species).backProfile?.length > 1, `${species.id} carries its measured back profile`)
  }
}

// --- anchor frames -----------------------------------------------------------------------

const riderUpOf = q => new THREE.Vector3(0, 1, 0).applyQuaternion(q)
const riderForwardOf = q => new THREE.Vector3(0, 0, -1).applyQuaternion(q)
const riderRightOf = q => new THREE.Vector3(1, 0, 0).applyQuaternion(q)

for (const [hostName, host] of [['mako', makoHost], ['mola', molaHost]]) {
  for (const anchor of host.anchors) {
    const q = anchor.quaternion
    near(q.length(), 1, `${hostName} ${anchor.name}: anchor rotation is a unit quaternion`)
    near(riderUpOf(q).dot(anchor.normal), -1, `${hostName} ${anchor.name}: the rider's back (disc) faces into the host`)
    assert.ok(riderForwardOf(q).z < -0.9, `${hostName} ${anchor.name}: the rider faces the host's way`)
    // A reflection would still pass the two checks above; a proper rotation keeps handedness.
    near(riderRightOf(q).clone().cross(riderUpOf(q)).dot(riderForwardOf(q).negate()), 1, `${hostName} ${anchor.name}: the rider frame is right-handed`)
  }
}

// Named spots are gone (they are generated); pick them by which way they face.
const mostBy = (host, score) => host.anchors.reduce((best, anchor) => (score(anchor) > score(best) ? anchor : best))
const belly = mostBy(makoHost, anchor => -anchor.normal.y)
const flankRight = mostBy(makoHost, anchor => anchor.normal.x)
const flankLeft = mostBy(makoHost, anchor => -anchor.normal.x)
const throat = mostBy(makoHost, anchor => (anchor.normal.y < -0.5 ? -anchor.at.z : -Infinity))
assert.ok(riderUpOf(belly.quaternion).y > 0.95, 'under the belly, a remora rides upright')
assert.ok(riderUpOf(flankRight.quaternion).x < -0.9, 'on the right flank, a remora lies on its side with its back to the shark')

// --- pose composition --------------------------------------------------------------------

const riderLength = 4.4
const hitch = hitchhikerProfile(sharksuckerSpecies)
const hostAtOrigin = { position: new THREE.Vector3(), quaternion: new THREE.Quaternion(), bodyLength: 17.8 }
const pose = new THREE.Vector3()
const poseQuaternion = new THREE.Quaternion()

rideAnchorPose(pose, poseQuaternion, hostAtOrigin, belly, riderLength, hitch)
const bellySurface = belly.at.clone().multiplyScalar(17.8)
const bellyFit = rideAnchorFit(belly, riderLength / 17.8, hitch)
// The disc: back up the rider's own axes from its root to the top of its head.
const discPoint = pose.clone()
  .addScaledVector(bellyFit.up, hitch.dorsalClearanceBodyLengths * riderLength)
  .addScaledVector(bellyFit.back, -hitch.discAheadBodyLengths * riderLength)
nearVector(discPoint, bellySurface.clone().addScaledVector(belly.normal, bellyFit.lift * 17.8), 'the disc sits on the skin, lifted only by the fit')
assert.ok(bellyFit.lift >= 0 && bellyFit.lift * 17.8 < 0.1, 'the fit lifts the disc at most a hair off the skin')
assert.ok(pose.clone().sub(bellySurface).dot(belly.normal) > 0, 'the rider is outside the host, not inside it')
assert.ok(pose.z > bellySurface.z, 'the rider body trails toward the host tail from its disc')
assert.ok(poseQuaternion.angleTo(bellyFit.quaternion) < EPS, 'the rider takes the fitted (tilted) orientation')

// The same anchor on a host that is somewhere else, facing somewhere else.
const turnedHost = {
  position: new THREE.Vector3(5, -3, -12),
  quaternion: new THREE.Quaternion().setFromEuler(new THREE.Euler(0.2, Math.PI / 2, 0.3)),
  bodyLength: 17.8,
}
const turnedPose = new THREE.Vector3()
const turnedQuaternion = new THREE.Quaternion()
rideAnchorPose(turnedPose, turnedQuaternion, turnedHost, flankRight, riderLength, hitch)
const localPose = new THREE.Vector3()
const localQuaternion = new THREE.Quaternion()
rideAnchorPose(localPose, localQuaternion, hostAtOrigin, flankRight, riderLength, hitch)
nearVector(turnedPose, localPose.clone().applyQuaternion(turnedHost.quaternion).add(turnedHost.position), 'the anchor moves and turns with its host')
assert.ok(turnedQuaternion.angleTo(turnedHost.quaternion.clone().multiply(rideAnchorFit(flankRight, riderLength / 17.8, hitch).quaternion)) < EPS, 'the rider turns, pitches, and rolls with its host')

// Host-local capture is the exact inverse, so a latch that starts on the anchor stays on it.
const backLocal = new THREE.Vector3()
const backLocalQuaternion = new THREE.Quaternion()
rideHostLocalPose(backLocal, backLocalQuaternion, turnedHost, turnedPose, turnedQuaternion)
nearVector(backLocal, localPose, 'world -> host-local recovers the anchor offset')
assert.ok(backLocalQuaternion.angleTo(rideAnchorFit(flankRight, riderLength / 17.8, hitch).quaternion) < EPS, 'world -> host-local recovers the anchor rotation')

// Latch blending runs from the captured start pose (blend 0) to the anchor (blend 1).
const fromLocal = new THREE.Vector3(3, 1, -2)
const fromLocalQuaternion = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), 0.8)
const startPose = new THREE.Vector3()
const startQuaternion = new THREE.Quaternion()
rideAnchorPose(startPose, startQuaternion, turnedHost, flankRight, riderLength, hitch, 0, fromLocal, fromLocalQuaternion)
nearVector(startPose, fromLocal.clone().applyQuaternion(turnedHost.quaternion).add(turnedHost.position), 'blend 0 is the captured start pose')
rideAnchorPose(startPose, startQuaternion, turnedHost, flankRight, riderLength, hitch, 1, fromLocal, fromLocalQuaternion)
nearVector(startPose, turnedPose, 'blend 1 is the anchor pose')
// And in between it turns as it slides, not all at once at the end (a slerp that aliased its
// target to its output once held the start rotation and snapped round at blend 1).
for (const blend of [0.25, 0.5, 0.75]) {
  rideAnchorPose(startPose, startQuaternion, turnedHost, flankRight, riderLength, hitch, blend, fromLocal, fromLocalQuaternion)
  const expected = turnedHost.quaternion.clone().multiply(
    fromLocalQuaternion.clone().slerp(rideAnchorFit(flankRight, riderLength / 17.8, hitch).quaternion, blend),
  )
  assert.ok(startQuaternion.angleTo(expected) < 1e-6, `at blend ${blend} the rider has turned that far toward the anchor`)
}

// --- lying on the skin -------------------------------------------------------------------

// Every remora that rides a host, on every spot of it, at its largest size: its back must
// never cut into the skin along its whole length, must rest on it (no gap left that it could
// close by settling), and must fit at least as well as the simplest rider that cannot cut in
// (untilted, lifted clear), by the fit's own measure: mean gap along the body, with a gap under
// the disc counting three times (RIDE_FIT_DISC_WEIGHT 2, on top of its share of the mean).
// Checked against each spot's measured skin rail.
function railAt(rail, s) {
  if (s <= rail[0][0]) return rail[0][1]
  for (let i = 1; i < rail.length; i += 1) {
    if (s <= rail[i][0]) return rail[i - 1][1] + ((rail[i][1] - rail[i - 1][1]) * (s - rail[i - 1][0])) / (rail[i][0] - rail[i - 1][0])
  }
  return rail.at(-1)[1]
}
let worstDiscLift = 0
const rearGaps = new Map()
for (const [hostName, hostSpecies] of [['mako', makoSpecies], ['mola', molaSpecies]]) {
  const hostProfile = rideHostProfile(hostSpecies)
  const hostLength = hostSpecies.swim.bodyLengthWU
  for (const riderSpecies of SPECIES.filter(s => hitchhikerProfile(s)?.attaches && rideHostWeight(hitchhikerProfile(s), hostProfile) > 0)) {
    const rider = hitchhikerProfile(riderSpecies)
    const ratio = riderSpecies.swim.bodyLengthWU / hostLength
    for (const anchor of hostProfile.anchors) {
      const fit = rideAnchorFit(anchor, ratio, rider)
      const root = rider.discAheadBodyLengths * ratio
      const contact = root + 0.2 * ratio
      const head = root - 0.5 * ratio
      const tail = root + 0.5 * ratio
      // A supplied model's measured top line, or the stand-ins' straight back that tapers to the
      // contact point; and how much of the tail bend reaches each point.
      const drop = rider.backProfile
        ? s => railAt(rider.backProfile, s / ratio) * ratio
        : s => (s <= 0 ? 0 : rider.contactDropBodyLengths * ratio * Math.min(1, s / contact))
      const bendAt = s => {
        const t = Math.min(1, Math.max(0, ((s - head) / ratio - RIDE_BEND_START) / (1 - RIDE_BEND_START)))
        return t * t
      }
      const hasSkin = s => railAt(anchor.rail, s) > -0.2
      // Evenly spaced samples for the mean; those plus every breakpoint of the skin and the back
      // for cuts, which would otherwise hide between samples.
      const even = []
      for (let s = head; s <= tail + 1e-9; s += ratio / 40) if (hasSkin(s)) even.push(s)
      const stations = [...even]
      for (const [s] of anchor.rail) if (s > head && s < tail && hasSkin(s)) stations.push(s)
      for (const [behind] of rider.backProfile ?? []) if (behind * ratio > head && behind * ratio < tail && hasSkin(behind * ratio)) stations.push(behind * ratio)
      const gapAt = (lift, slope, bend, s) => lift + slope * s + drop(s) - bend * bendAt(s) - railAt(anchor.rail, s)
      const cost = (lift, slope, bend) => even.reduce((sum, s) => sum + gapAt(lift, slope, bend, s), 0) / even.length + 2 * lift
      const liftFor = (slope, bend) => Math.max(0, ...stations.map(s => railAt(anchor.rail, s) - drop(s) - slope * s + bend * bendAt(s)))
      const label = `${riderSpecies.name} on the ${hostName}'s ${anchor.name}`
      const worstCut = Math.min(...stations.map(s => gapAt(fit.lift, fit.slope, fit.bend, s)))
      assert.ok(worstCut > -1e-9, `${label}: its back never cuts into the skin, bent or not`)
      assert.ok(worstCut * hostLength < 0.005, `${label}: it rests on the skin (closest point ${(worstCut * hostLength).toFixed(3)} WU off)`)
      assert.ok(fit.bend >= 0 && fit.bend <= 0.15 * ratio + 1e-9, `${label}: it bends toward the host, at most 15% of its length`)
      const fitted = cost(fit.lift, fit.slope, fit.bend)
      assert.ok(fitted <= cost(liftFor(0, 0), 0, 0) + 1e-6, `${label}: it fits at least as well as a straight, untilted rider`)
      // And better than any nearby tilt or bend, each lifted clear: the fit is the best pose,
      // not just a good one. (The mean here is sampled, the fit's exact, so allow a hair.)
      for (const dt of [-0.05, -0.02, 0.02, 0.05]) {
        const tilt = fit.slope + dt
        if (Math.abs(tilt) > Math.tan(THREE.MathUtils.degToRad(25))) continue
        assert.ok(fitted <= cost(liftFor(tilt, fit.bend), tilt, fit.bend) + 2e-4, `${label}: no nearby tilt fits better (${dt})`)
      }
      for (const scale of [0, 0.5, 0.8]) {
        const bend = fit.bend * scale
        assert.ok(fitted <= cost(liftFor(fit.slope, bend), fit.slope, bend) + 2e-4, `${label}: bending less fits no better (${scale})`)
      }
      worstDiscLift = Math.max(worstDiscLift, fit.lift * hostLength)
      if (hostName === 'mako') {
        // Its tail end: the closest it comes to the skin over the last tenth of its length.
        const tailEnd = []
        for (let t = 0.9; t <= 1 + 1e-9; t += 0.01) if (hasSkin(head + t * ratio)) tailEnd.push(gapAt(fit.lift, fit.slope, fit.bend, head + t * ratio))
        if (!rearGaps.has(riderSpecies.id)) rearGaps.set(riderSpecies.id, [])
        if (tailEnd.length) rearGaps.get(riderSpecies.id).push(Math.min(...tailEnd) * hostLength)
      }
    }
  }
}
// The disc stays on or near the skin everywhere: the fit only lifts it where the skin under
// the rider's body rises above it.
assert.ok(worstDiscLift < 0.15, `no rider's disc is lifted far off the skin (worst ${worstDiscLift.toFixed(3)} WU)`)
// Bending onto the skin is what brings a rigid rider's rear back to a curved host: bent, a
// full-size sharksucker's tail reaches the mako's skin on most spots. (The top of its tail
// stalk still sits lower than its head: that is its shape, not a gap.)
{
  const gaps = rearGaps.get('echeneis-naucrates')
  const touching = gaps.filter(gap => gap < 0.02).length
  assert.ok(touching >= gaps.length * 0.7, `a clamped sharksucker's tail reaches the mako's skin on most spots (${touching} of ${gaps.length})`)
}
// The bend starts behind the disc and pectorals, and is full at the tail.
assert.equal(rideBendProfile(0.1), 0, 'the head and disc do not bend')
assert.equal(rideBendProfile(RIDE_BEND_START), 0, 'the bend starts smoothly')
near(rideBendProfile(1), 1, 'and is full at the tail')

// --- slots -------------------------------------------------------------------------------

assert.equal(claimRideSlot('host-a', 0, 'rider-1'), true, 'a free slot can be claimed')
assert.equal(claimRideSlot('host-a', 0, 'rider-1'), true, 'the holder can re-claim its own slot (remount)')
assert.equal(claimRideSlot('host-a', 0, 'rider-2'), false, 'an occupied slot cannot be taken')
assert.equal(rideSlotOccupant('host-a', 0), 'rider-1', 'the occupant is recorded')
assert.equal(claimRideSlot('host-a', 1, 'rider-2'), true, 'another anchor on the same host is independent')
releaseRideSlots('rider-1')
assert.equal(rideSlotOccupant('host-a', 0), null, 'releasing frees the slot')
assert.equal(rideSlotOccupant('host-a', 1), 'rider-2', 'releasing one rider leaves the others')
releaseRideSlots('rider-2')

// --- choosing a host -----------------------------------------------------------------------

const mako = { id: 'mako-1', species: 'isurus-oxyrinchus', biome: 'ocean', size: 1 }
const sharksucker = { id: 'sucker-1', species: 'echeneis-naucrates', biome: 'ocean', size: 1 }
const whalesucker = { id: 'whale-1', species: 'remora-australis', biome: 'ocean', size: 1 }
const whiteSucker = { id: 'white-1', species: 'remora-albescens', biome: 'ocean', size: 1 }
const always = () => 0
const never = () => 0.999999

try {
  registerHost(mako, new THREE.Vector3(0, -2, -12))
  const riderAt = new THREE.Vector3(4, -3, -14)

  const choice = findRideHost(sharksucker, riderAt, riderLength, hitch, always)
  assert.ok(choice, 'a sharksucker near a mako picks it')
  assert.equal(choice.hostId, 'mako-1', 'it picks the mako')
  // Nearest free anchor wins, give or take a little: from +x, never the far flank.
  assert.ok(makoHost.anchors[choice.anchorIndex].normal.x > -0.5, 'it picks a near anchor, not the far flank')

  assert.equal(findRideHost(whalesucker, riderAt, 3.04, hitchhikerProfile(speciesById.get('remora-australis')), always), null, 'a whalesucker ignores the mako')
  assert.equal(findRideHost(whiteSucker, riderAt, 1.2, hitchhikerProfile(speciesById.get('remora-albescens')), never), null, 'an occasional host is declined on an unlucky roll')
  assert.ok(findRideHost(whiteSucker, riderAt, 1.2, hitchhikerProfile(speciesById.get('remora-albescens')), always), 'and taken on a lucky one')

  // Occupied anchors are skipped; with all four taken there is no ride.
  claimRideSlot('mako-1', choice.anchorIndex, 'someone-else')
  const second = findRideHost(sharksucker, riderAt, riderLength, hitch, always)
  assert.ok(second && second.anchorIndex !== choice.anchorIndex, 'a taken anchor is skipped for the next free one')
  makoHost.anchors.forEach(anchor => claimRideSlot('mako-1', anchor.index, 'someone-else'))
  assert.equal(findRideHost(sharksucker, riderAt, riderLength, hitch, always), null, 'a fully ridden host has no room')
  releaseRideSlots('someone-else')

  // Capacity: riders laid end to end may cover 80% of the host (14.24 WU of a 17.8 WU mako).
  // Three full-size sharksuckers fill it; a fourth has no room, a small remora still does.
  const whiteHitch = hitchhikerProfile(speciesById.get('remora-albescens'))
  for (const [index, anchor] of [flankLeft, flankRight, throat].entries()) claimRideSlot('mako-1', anchor.index, `big-${index}`, 4.4, hitch)
  near(rideHostLoad('mako-1'), 13.2, 'the host carries the riders it holds spots for')
  near(rideHostLoad('mako-1', 'big-0'), 8.8, 'a rider does not count against itself')
  assert.equal(findRideHost(sharksucker, riderAt, riderLength, hitch, always), null, 'a full-size sharksucker does not fit on a loaded host')
  assert.ok(findRideHost(whiteSucker, riderAt, 1.0, whiteHitch, always), 'a small remora still does')
  for (const index of [0, 1, 2]) releaseRideSlots(`big-${index}`)

  // Spacing: a spot is free only if its rider would clear the riders already there.
  const neighbour = makoHost.anchors
    .filter(anchor => anchor !== flankRight && anchor.normal.dot(flankRight.normal) > 0.9)
    .reduce((best, anchor) => (anchor.at.distanceTo(flankRight.at) < best.at.distanceTo(flankRight.at) ? anchor : best))
  claimRideSlot('mako-1', flankRight.index, 'occupant', riderLength, hitch)
  assert.equal(rideSpotClear('mako-1', makoHost, neighbour, 17.8, 'sucker-1', riderLength, hitch), false, 'a spot beside a rider on the same flank is not free')
  assert.equal(rideSpotClear('mako-1', makoHost, flankLeft, 17.8, 'sucker-1', riderLength, hitch), true, 'a spot on the far flank is')
  assert.equal(rideSpotClear('mako-1', makoHost, neighbour, 17.8, 'occupant', riderLength, hitch), true, 'a rider never blocks itself')
  // And host choice honours it: a sharksucker right beside the occupied spot does not take
  // the spot next to it, however near.
  const besideNeighbour = neighbour.at.clone().multiplyScalar(17.8).addScaledVector(neighbour.normal, 1).add(new THREE.Vector3(0, -2, -12))
  const beside = findRideHost(sharksucker, besideNeighbour, riderLength, hitch, always)
  assert.ok(beside && beside.anchorIndex !== neighbour.index, 'host choice skips a spot too close to a rider')
  assert.ok(rideSpotClear('mako-1', makoHost, makoHost.anchors[beside.anchorIndex], 17.8, 'sucker-1', riderLength, hitch), 'and picks one that is clear')
  releaseRideSlots('occupant')

  // A host fading out (the Mola deep-exit recovery) is not a candidate.
  updateFishRegistryPose('mako-1', new THREE.Quaternion(), 0, 0.5)
  assert.equal(findRideHost(sharksucker, riderAt, riderLength, hitch, always), null, 'a fading host is not chosen')
  updateFishRegistryPose('mako-1', new THREE.Quaternion(), 0, 1)

  // Nobody is picked onto an anchor above the water.
  registerHost(mako, new THREE.Vector3(0, SURFACE_PLANE_Y + 3, -12))
  assert.equal(findRideHost(sharksucker, riderAt, riderLength, hitch, always), null, 'anchors above the surface are never chosen')
} finally {
  clearRegistry()
  releaseRideSlots('sucker-1')
}

// --- riding the host's wave --------------------------------------------------------------

// The CPU curve and its slope agree: the slope is the offset's rate of change along the body.
{
  const config = makoSpecies.model.proceduralAnimation
  for (const tail01 of [0.15, 0.3, 0.45, 0.7]) {
    const at = caudalLateralCurve({}, tail01, config, 0.9, 0.6, 0.4, 0.2)
    const ahead = caudalLateralCurve({}, tail01 + 1e-5, config, 0.9, 0.6, 0.4, 0.2)
    const behind = caudalLateralCurve({}, tail01 - 1e-5, config, 0.9, 0.6, 0.4, 0.2)
    near(at.slope, (ahead.offset - behind.offset) / 2e-5, `the wave's slope at ${tail01} matches its offset`, 1e-4)
  }
  assert.equal(caudalLateralCurve({}, 0.05, config, 0.9, 1, 1, 1).offset, 0, 'nothing moves ahead of the wave start')
}

// A clamped rider moves with the body under its disc: its disc shifts by the wave's offset
// there and it turns with the body's slope; with no wave published nothing changes.
{
  const host = { position: new THREE.Vector3(), quaternion: new THREE.Quaternion(), bodyLength: 17.8, wave: null }
  const spot = mostBy(makoHost, anchor => anchor.tail01)
  const disc = spot.at.clone().multiplyScalar(17.8)
  const stillQuaternion = new THREE.Quaternion()
  host.wave = { phase: 1.1, speed01: 1, turn: 0, burst: 0 }
  const moved = disc.clone()
  const movedQuaternion = new THREE.Quaternion()
  rideFollowHostWave(moved, movedQuaternion, spot, host)
  const curve = caudalLateralCurve({}, spot.tail01, makoSpecies.model.proceduralAnimation, 1.1, 1, 0, 0)
  // A host at its species length: source units x model.scale = WU.
  const shift = curve.offset * makoSpecies.model.scale
  assert.ok(Math.abs(shift) > 0.05, `the wave moves the furthest-back spot visibly (${shift.toFixed(3)} WU)`)
  nearVector(moved, disc.clone().add(new THREE.Vector3(shift, 0, 0)), 'the disc moves sideways with the skin under it')
  const slope = (curve.slope * makoSpecies.model.scale) / ((makoSpecies.rideHost.waveSpan[1] - makoSpecies.rideHost.waveSpan[0]) * 17.8)
  near(movedQuaternion.angleTo(stillQuaternion), Math.abs(Math.atan(slope)), 'the rider turns with the body there')
  // The way the body turns: toward the side the skin moves to further back.
  const tailward = new THREE.Vector3(0, 0, 1).applyQuaternion(movedQuaternion)
  near(tailward.x, Math.sin(Math.atan(slope)), 'the rider turns the way the body bends')
  const pose = new THREE.Vector3()
  const poseQuaternion = new THREE.Quaternion()
  host.wave = null
  rideAnchorPose(pose, poseQuaternion, host, spot, riderLength, hitch)
  const posedQuaternion = poseQuaternion.clone()
  host.wave = { phase: 1.1, speed01: 1, turn: 0, burst: 0 }
  rideAnchorPose(pose, poseQuaternion, host, spot, riderLength, hitch)
  near(poseQuaternion.angleTo(posedQuaternion), Math.abs(Math.atan(slope)), 'a clamped rider follows the wave')
  assert.equal(molaHost.anchors[0].wave, null, 'a Mola spot has no wave to follow')
}

// --- rider and host ignore each other in boids ----------------------------------------------

try {
  const sharksuckerSwim = resolveSwimProfile(sharksucker)
  const riderFish = { position: new THREE.Vector3(0, -3.3, -12) }
  registerHost(mako, new THREE.Vector3(0, -2, -12))
  const out = new THREE.Vector3()

  updateFishRegistry(riderFish, sharksucker, sharksuckerSwim, null, new THREE.Vector3(0, 0, -1))
  computeBoidSteering(out, riderFish, sharksucker, sharksuckerSwim)
  assert.ok(out.lengthSq() > 0, 'a free sharksucker pressed against the mako is pushed off it')

  updateFishRegistry(riderFish, sharksucker, sharksuckerSwim, null, new THREE.Vector3(0, 0, -1), 0, 'mako-1')
  computeBoidSteering(out, riderFish, sharksucker, sharksuckerSwim)
  assert.equal(out.lengthSq(), 0, 'riding the mako, it ignores the mako')
  const makoSwim = resolveSwimProfile(mako)
  computeBoidSteering(out, { position: new THREE.Vector3(0, -2, -12) }, mako, makoSwim)
  assert.equal(out.lengthSq(), 0, 'and the mako ignores the remora riding it')
} finally {
  clearRegistry()
}

// --- the ride, end to end ------------------------------------------------------------------

// The mako cruises straight ahead (-Z) at 3 WU/s. The remora starts off to one side and moves
// the way Fish.jsx moves it: toward the intercept target while approaching, onto the anchor
// pose while it owns its pose.
function simulateRide({ hostSpeed = 3, seconds = 180, onStep = null } = {}) {
  const ride = createRideState()
  const rand = mulberry32(42)
  const riderPosition = new THREE.Vector3(6, -4, -10)
  const riderQuaternion = new THREE.Quaternion()
  const hostPosition = new THREE.Vector3(0, -2, -10)
  const speeds = { idle: 1.6, burst: 6.9 }
  const dt = 1 / 60
  const log = []
  // onStep may set `world.hostGone` to take the mako out of the tank (it unmounts).
  const world = { hostGone: false, hostOpacity: 1 }
  for (let now = 0; now < seconds; now += dt) {
    hostPosition.z -= hostSpeed * dt
    if (world.hostGone) unregisterFish('mako-1')
    else registerHost(mako, hostPosition, new THREE.Quaternion(), hostSpeed, world.hostOpacity)
    advanceRide(ride, sharksucker, hitch, riderLength, now, riderPosition, riderQuaternion, speeds, rand)
    if (ride.ownsPose) {
      riderPosition.copy(ride.position)
      riderQuaternion.copy(ride.quaternion)
    } else if (ride.approaching) {
      const toTarget = ride.target.clone().sub(riderPosition)
      const step = Math.min(toTarget.length(), ride.targetSpeed * dt)
      if (toTarget.lengthSq() > 0) riderPosition.addScaledVector(toTarget.normalize(), step)
    }
    log.push({ now, stage: ride.stage, ownsPose: ride.ownsPose, justReleased: ride.justReleased, hug: ride.hug, anchorIndex: ride.anchorIndex })
    if (onStep?.(ride, now, hostPosition, world) === false) break
    ride.justReleased = false
  }
  return { ride, log }
}

try {
  const { log } = simulateRide()
  const stages = new Set(log.map(step => step.stage))
  for (const stage of ['free', 'approach', 'dock', 'latch', 'attached', 'release']) {
    assert.ok(stages.has(stage), `the ride passes through '${stage}'`)
  }
  const firstApproach = log.findIndex(step => step.stage === 'approach')
  const firstAttached = log.findIndex(step => step.stage === 'attached')
  const firstRelease = log.findIndex(step => step.stage === 'release')
  assert.ok(firstApproach > 0 && log[firstApproach].now >= 3, 'the first host decision waits a few seconds after spawn')
  assert.ok(firstApproach < firstAttached && firstAttached < firstRelease, 'approach, then attach, then release')
  assert.ok(log[firstAttached].now - log[firstApproach].now < 12, 'a sharksucker catches a cruising mako')
  const attachedFor = log[firstRelease].now - log[firstAttached].now
  assert.ok(attachedFor >= hitch.rideSeconds[0] - 0.05 && attachedFor <= hitch.rideSeconds[1] + 0.05, 'it rides for its species\' ride duration')
  assert.ok(log[firstRelease].justReleased, 'letting go is flagged once, for the release kick')
  assert.ok(log.slice(firstAttached, firstRelease).every(step => step.ownsPose), 'while attached, the ride owns the pose every frame')
  // The bend onto the skin: none while swimming in, easing in over the latch, the fit's bend
  // while attached, easing out as it lets go, none once free.
  const spotFit = rideAnchorFit(makoHost.anchors[log[firstAttached].anchorIndex], riderLength / 17.8, hitch)
  assert.ok(spotFit.bend > 0, 'its spot calls for a bend')
  assert.ok(log.slice(0, firstApproach).every(step => step.hug === 0), 'a free remora is straight')
  const latching = log.slice(firstApproach, firstAttached).filter(step => step.stage === 'latch')
  assert.ok(latching.length > 2 && latching[0].hug < 0.05 * latching.at(-1).hug && latching.at(-1).hug > 0.9 * spotFit.bend * 17.8, 'the bend eases in over the latch')
  assert.ok(log.slice(firstAttached, firstRelease).every(step => Math.abs(step.hug - spotFit.bend * 17.8) < 1e-9), 'attached, it holds the fit\'s bend')
  const releasing = log.filter(step => step.stage === 'release')
  assert.ok(releasing.length > 2 && releasing.at(-1).hug < releasing[0].hug, 'the bend eases out as it lets go')
  const afterRelease = log.slice(firstRelease).find(step => step.stage === 'free' || step.stage === 'escort')
  assert.ok(afterRelease && afterRelease.hug === 0, 'and it swims off straight')
} finally {
  clearRegistry()
  releaseRideSlots('sucker-1')
}

// Clamped means clamped: the rider's offset from the host root holds while the host moves.
try {
  let offset = null
  let checked = 0
  simulateRide({
    onStep(ride, _now, hostPosition) {
      if (ride.stage !== 'attached') return true
      const current = ride.position.clone().sub(hostPosition)
      if (offset) nearVector(current, offset, 'an attached remora keeps its place on the host', 1e-9)
      offset = current
      checked += 1
      return checked < 120
    },
  })
  assert.equal(checked, 120, 'the attached check actually ran')
} finally {
  clearRegistry()
  releaseRideSlots('sucker-1')
}

// Letting go: slot freed, carried at the host's speed, heading on with a peel off the surface.
try {
  let released = null
  simulateRide({
    onStep(ride) {
      if (!ride.justReleased) return true
      released = {
        occupant: rideSlotOccupant('mako-1', ride.anchorIndex),
        hostId: ride.hostId,
        speed: ride.releaseSpeed,
        direction: ride.releaseDirection.clone(),
      }
      return false
    },
  })
  assert.ok(released, 'the remora let go within the simulation')
  assert.equal(released.hostId, null, 'after letting go it has no host')
  assert.equal(released.occupant, null, 'its anchor is free for the next rider')
  near(released.speed, 3, 'it leaves at the host\'s speed', 1e-6)
  assert.ok(released.direction.z < -0.8, 'it swims on the host\'s heading')
} finally {
  clearRegistry()
  releaseRideSlots('sucker-1')
}

// A host fading out (the Mola deep-exit recovery) keeps its rider past the ride's end, and
// the rider fades with it; once the host is back, the rider lets go as normal.
try {
  let attachedAt = null
  let heldPastEnd = false
  let fadedWithHost = false
  let releasedAfterFade = false
  simulateRide({
    onStep(ride, now, _hostPosition, world) {
      if (ride.stage === 'attached' && attachedAt === null) {
        attachedAt = now
        world.hostOpacity = 0.4
      }
      if (attachedAt === null) return true
      if (ride.stage === 'attached' && ride.opacity === 0.4) fadedWithHost = true
      if (now > attachedAt + hitch.rideSeconds[1] + 5 && world.hostOpacity < 1) {
        heldPastEnd = ride.stage === 'attached'
        world.hostOpacity = 1
      }
      if (world.hostOpacity === 1 && ride.justReleased) {
        releasedAfterFade = true
        return false
      }
      return true
    },
    seconds: 240,
  })
  assert.ok(fadedWithHost, 'a clamped remora takes its host\'s fade opacity')
  assert.ok(heldPastEnd, 'it holds on past its ride time while the host is faded out')
  assert.ok(releasedAfterFade, 'and lets go once the host is visible again')
} finally {
  clearRegistry()
  releaseRideSlots('sucker-1')
}

// A host too fast to catch is given up on, and its anchor is freed.
try {
  const { ride, log } = simulateRide({ hostSpeed: 40, seconds: 45 })
  assert.ok(log.some(step => step.stage === 'approach'), 'the remora tries for the fast host')
  assert.ok(!log.some(step => step.stage === 'attached'), 'but never catches it')
  const approachSpans = log.filter(step => step.stage === 'approach').length / 60
  assert.ok(approachSpans < 45, 'the approach times out rather than chasing forever')
  if (ride.stage === 'free') assert.equal(rideSlotOccupant('mako-1', ride.anchorIndex), null, 'a given-up anchor is freed')
} finally {
  clearRegistry()
  releaseRideSlots('sucker-1')
}

// The host leaving the tank mid-ride: the remora lets go instead of freezing on a stale pose.
try {
  let lostAt = null
  const { log } = simulateRide({
    onStep(ride, now, _hostPosition, world) {
      if (lostAt === null && ride.stage === 'attached') {
        world.hostGone = true
        lostAt = now
      }
      return !(lostAt !== null && now > lostAt + 2)
    },
  })
  assert.ok(lostAt !== null, 'the host was removed mid-ride')
  const afterLoss = log.filter(step => step.now > lostAt)
  assert.ok(afterLoss.length > 0 && afterLoss.every(step => !step.ownsPose), 'the remora stops following a host that is gone')
  assert.ok(afterLoss.some(step => step.stage === 'release'), 'it unrolls off the missing host rather than snapping upright')
  assert.ok(afterLoss.at(-1).stage === 'free', 'and ends up swimming free')
} finally {
  clearRegistry()
  releaseRideSlots('sucker-1')
}

// --- no clipping through the host on the way in ----------------------------------------------

// Normalized radius of a host-local point against the host's *uninflated* body ellipsoid:
// below 1 means inside the body volume.
function bodyRadius(localPoint, hostProfile, hostBodyLength, margin = 0) {
  const { center, radii } = hostProfile.body
  return Math.hypot(
    (localPoint.x - center.x * hostBodyLength) / (radii.x * hostBodyLength + margin),
    (localPoint.y - center.y * hostBodyLength) / (radii.y * hostBodyLength + margin),
    (localPoint.z - center.z * hostBodyLength) / (radii.z * hostBodyLength + margin),
  )
}
// The rider's clearance around the body: 0.2 of its own length (RIDE_CLEARANCE_MARGIN_BODY_LENGTHS).
const riderMargin = riderLength * 0.2

// Start the remora somewhere awkward relative to a stationary (or cruising) mako, leave it
// exactly one anchor, and walk it along its steering target the way Fish.jsx does. Returns
// the closest it came to the body's interior while approaching, and whether it made it on.
function approachFrom(startLocal, target, hostSpeed = 0) {
  const ride = createRideState()
  ride.nextDecisionAt = 0
  const rand = mulberry32(7)
  const hostPosition = new THREE.Vector3(0, -2, -12)
  const riderPosition = startLocal.clone().add(hostPosition)
  const riderQuaternion = new THREE.Quaternion()
  const speeds = { idle: 1.6, burst: 6.9 }
  const hostBodyLength = 17.8
  const keep = target.index
  makoHost.anchors.forEach(anchor => { if (anchor.index !== keep) claimRideSlot('mako-1', anchor.index, 'blocker') })
  let closest = Infinity
  let closestClearance = Infinity
  let attached = false
  const stagesSeen = new Set()
  const dt = 1 / 60
  for (let now = 0; now < 40 && !attached; now += dt) {
    hostPosition.z -= hostSpeed * dt
    registerHost(mako, hostPosition, new THREE.Quaternion(), hostSpeed)
    advanceRide(ride, sharksucker, hitch, riderLength, now, riderPosition, riderQuaternion, speeds, rand)
    if (ride.ownsPose) {
      riderPosition.copy(ride.position)
      riderQuaternion.copy(ride.quaternion)
    } else if (ride.approaching) {
      const toTarget = ride.target.clone().sub(riderPosition)
      const step = Math.min(toTarget.length(), ride.targetSpeed * dt)
      if (toTarget.lengthSq() > 0) riderPosition.addScaledVector(toTarget.normalize(), step)
      keepRiderClearOfHost(riderPosition, ride, riderLength)
    }
    // Swimming in (steered) and docking (moved in the host's frame) must both stay out.
    if (ride.stage === 'approach' || ride.stage === 'dock') {
      const local = riderPosition.clone().sub(hostPosition)
      closest = Math.min(closest, bodyRadius(local, makoHost, hostBodyLength))
      closestClearance = Math.min(closestClearance, bodyRadius(local, makoHost, hostBodyLength, riderMargin))
      stagesSeen.add(ride.stage)
    }
    attached = ride.stage === 'attached'
  }
  releaseRideSlots('blocker')
  releaseRideSlots('sucker-1')
  clearRegistry()
  return { closest, closestClearance, attached, docked: stagesSeen.has('dock'), anchor: ride.anchorIndex === keep }
}

// The waypoint itself: with the body between rider and staging point, the next waypoint is a
// step round the outside, not the staging point through the body. Without this the remora
// still stays out (the back-out rule catches it) but zig-zags along the body instead of
// swimming round it.
{
  const hostBodyLength = 17.8
  const aboveLocal = new THREE.Vector3(0, 8, 1)
  const stagingBelow = rideStagingLocal(new THREE.Vector3(), makoHost, belly, hostBodyLength, riderLength, hitch)
  const waypoint = rideApproachWaypoint(new THREE.Vector3(), makoHost, hostBodyLength, riderLength, aboveLocal, stagingBelow)
  assert.ok(waypoint.distanceTo(stagingBelow) > 1, 'with the body in the way, it does not aim straight at the staging point')
  assert.ok(bodyRadius(waypoint, makoHost, hostBodyLength, riderMargin) > 1.2, 'the waypoint is out past the clearance')
  assert.ok(Math.abs(waypoint.x) > 1 || Math.abs(waypoint.z - 3) > 3, 'it swings round the side or an end, not through the middle')
  const clearLocal = new THREE.Vector3(0, -8, 1)
  const direct = rideApproachWaypoint(new THREE.Vector3(), makoHost, hostBodyLength, riderLength, clearLocal, stagingBelow)
  nearVector(direct, stagingBelow, 'with a clear line, it heads straight for the staging point')
  assert.ok(bodyRadius(stagingBelow, makoHost, hostBodyLength, riderMargin) > 1, 'the staging point is outside the clearance')
}

// The hard stop behind the steering: an approaching remora found inside the host's clearance
// (a turning shark swept into it) is put back on the clearance surface, on the side it was on.
try {
  registerHost(mako, new THREE.Vector3(0, -2, -12))
  const ride = createRideState()
  ride.stage = 'approach'
  ride.hostId = 'mako-1'
  const hostBodyLength = 17.8
  const inside = new THREE.Vector3(0, -2.6, -12 + 1)
  assert.ok(bodyRadius(inside.clone().sub(new THREE.Vector3(0, -2, -12)), makoHost, hostBodyLength) < 1, 'test point starts inside the body')
  assert.equal(keepRiderClearOfHost(inside, ride, riderLength), true, 'a remora inside the host is moved')
  near(bodyRadius(inside.clone().sub(new THREE.Vector3(0, -2, -12)), makoHost, hostBodyLength, riderMargin), 1, 'onto the clearance surface', 1e-6)
  assert.ok(inside.y < -2, 'on the side it was on (below the belly)')
  const outside = new THREE.Vector3(0, -9, -12)
  assert.equal(keepRiderClearOfHost(outside, ride, riderLength), false, 'a remora already clear is left alone')
  ride.stage = 'free'
  const alsoInside = new THREE.Vector3(0, -2.6, -11)
  assert.equal(keepRiderClearOfHost(alsoInside, ride, riderLength), false, 'only an approaching remora is pushed (a released one leaves on its own)')
} finally {
  clearRegistry()
}

const APPROACHES = [
  ['from directly above, to the belly', new THREE.Vector3(0, 8, 1), belly],
  ['from the far side, to the right flank', new THREE.Vector3(-8, -0.2, -2), flankRight],
  ['from ahead of the snout, to the belly', new THREE.Vector3(0, -0.5, -14), belly],
  ['from behind the tail, to the throat', new THREE.Vector3(0, 0.5, 16), throat],
  ['from below the far flank, to the left flank', new THREE.Vector3(6, -6, 4), flankLeft],
]
for (const [label, start, target] of APPROACHES) {
  for (const hostSpeed of [0, 3]) {
    const { closest, closestClearance, attached, docked, anchor } = approachFrom(start, target, hostSpeed)
    assert.ok(anchor, `${label} (host ${hostSpeed} WU/s): it goes for the one free anchor`)
    assert.ok(attached, `${label} (host ${hostSpeed} WU/s): it gets on`)
    assert.ok(docked, `${label} (host ${hostSpeed} WU/s): it docks in the host's frame before latching`)
    assert.ok(closest >= 1, `${label} (host ${hostSpeed} WU/s): its approach never enters the body (closest ${closest.toFixed(3)})`)
    // Around a still host it swings round outside its own clearance too, rather than
    // grazing along the body; a cruising host can close on it a little.
    if (hostSpeed === 0) {
      assert.ok(closestClearance >= 0.97, `${label}: it keeps its clearance from a still host (closest ${closestClearance.toFixed(3)})`)
    }
  }
}

// --- escorting: following a host loosely ---------------------------------------------------

// A station is always outside the body, below or beside it, whatever its drift.
{
  const stationRand = mulberry32(11)
  for (let i = 0; i < 200; i += 1) {
    const station = {
      along: -0.45 + stationRand() * 0.85,
      angle: THREE.MathUtils.degToRad(-165 + stationRand() * 150),
      radius: 1.25 + stationRand() * 0.65,
      rates: [0.2, 0.25, 0.3],
      phases: [stationRand() * 6, stationRand() * 6, stationRand() * 6],
    }
    const local = escortStation(new THREE.Vector3(), station, makoHost, 17.8, riderLength, stationRand() * 100)
    assert.ok(bodyRadius(local, makoHost, 17.8, riderMargin) >= 1.05, 'an escort station is outside the host and its clearance')
    assert.ok(local.y < makoHost.body.center.y * 17.8 + 0.2 * makoHost.body.radii.y * 17.8, 'an escort station is below or beside the body, not on top')
  }
}

const escortSpeeds = { idle: 1.6, burst: 6.9 }
function freeRider() {
  const ride = createRideState()
  ride.nextDecisionAt = 0
  return ride
}

try {
  registerHost(mako, new THREE.Vector3(0, -2, -12))
  const riderAt = new THREE.Vector3(3, -5, -10)
  assert.equal(findEscortHost(sharksucker, riderAt, hitch)?.hostId, 'mako-1', 'a nearby host is one to escort')
  assert.equal(findEscortHost(sharksucker, new THREE.Vector3(0, -2, -200), hitch), null, 'a host far away is not')
  assert.equal(findEscortHost(whalesucker, riderAt, hitchhikerProfile(speciesById.get('remora-australis'))), null, 'nor one it would never ride')

  // With the host full, a remora that wants a ride shadows it instead of roaming off.
  for (const [index, anchor] of [flankLeft, flankRight, throat].entries()) claimRideSlot('mako-1', anchor.index, `big-${index}`, 4.4, hitch)
  const ride = freeRider()
  advanceRide(ride, sharksucker, hitch, riderLength, 0, riderAt, new THREE.Quaternion(), escortSpeeds, always)
  assert.equal(ride.stage, 'escort', 'with no room, it escorts the host')
  assert.equal(ride.hostId, 'mako-1', 'the host it wanted')
  assert.equal(ride.anchorIndex, -1, 'holding no spot')
  assert.equal(rideSlotOccupant('mako-1', -1), null, 'and claiming none')
  const unlucky = freeRider()
  advanceRide(unlucky, sharksucker, hitch, riderLength, 0, riderAt, new THREE.Quaternion(), escortSpeeds, never)
  assert.equal(unlucky.stage, 'free', 'on an unlucky roll it roams off instead')

  // The stations escorts pick for themselves: outside the body, below or beside it.
  for (let seed = 1; seed <= 40; seed += 1) {
    const picked = freeRider()
    const pickRand = mulberry32(seed)
    const roll = () => (pickRand() < 0.5 ? 0 : pickRand())
    advanceRide(picked, sharksucker, hitch, riderLength, 0, riderAt, new THREE.Quaternion(), escortSpeeds, roll)
    if (picked.stage !== 'escort') continue
    for (const now of [0, 7, 19, 41]) {
      const local = escortStation(new THREE.Vector3(), picked.escort, makoHost, 17.8, riderLength, now)
      assert.ok(bodyRadius(local, makoHost, 17.8, riderMargin) >= 1.05, `seed ${seed}: its station is outside the host and its clearance`)
      assert.ok(local.y < makoHost.body.center.y * 17.8 + 0.2 * makoHost.body.radii.y * 17.8, `seed ${seed}: its station is below or beside the body, not on top`)
    }
  }

  // The hard stop covers escorts too: one found inside the host is put back outside.
  const inside = new THREE.Vector3(0, -2.6, -11)
  assert.equal(keepRiderClearOfHost(inside, ride, riderLength), true, 'an escort inside the host is moved')
  assert.ok(bodyRadius(inside.clone().sub(new THREE.Vector3(0, -2, -12)), makoHost, 17.8, riderMargin) >= 1 - 1e-6, 'onto the clearance surface')

  // Following a cruising mako for 30 s: it keeps up, stays near, and never enters the body.
  ride.stageUntil = 1000
  ride.nextDecisionAt = 1000
  const hostPosition = new THREE.Vector3(0, -2, -12)
  const riderPosition = riderAt.clone()
  const dt = 1 / 60
  let closest = Infinity
  let farthest = 0
  let stationErrorSum = 0
  let stationErrorCount = 0
  for (let now = 0; now < 30; now += dt) {
    hostPosition.z -= 3 * dt
    registerHost(mako, hostPosition, new THREE.Quaternion(), 3)
    advanceRide(ride, sharksucker, hitch, riderLength, now, riderPosition, new THREE.Quaternion(), escortSpeeds, always)
    assert.ok(ride.approaching && ride.stage === 'escort', 'it steers while escorting')
    const toTarget = ride.target.clone().sub(riderPosition)
    if (toTarget.lengthSq() > 0) riderPosition.addScaledVector(toTarget.normalize(), Math.min(toTarget.length(), ride.targetSpeed * dt))
    keepRiderClearOfHost(riderPosition, ride, riderLength)
    const local = riderPosition.clone().sub(hostPosition)
    closest = Math.min(closest, bodyRadius(local, makoHost, 17.8))
    if (now > 10) {
      farthest = Math.max(farthest, local.length())
      stationErrorSum += local.distanceTo(escortStation(new THREE.Vector3(), ride.escort, makoHost, 17.8, riderLength, now))
      stationErrorCount += 1
    }
  }
  assert.ok(closest >= 1, `an escort never enters the body (closest ${closest.toFixed(3)})`)
  assert.ok(farthest < 17.8, `after settling it keeps within a body length of the host (farthest ${farthest.toFixed(1)} WU)`)
  const stationError = stationErrorSum / stationErrorCount
  assert.ok(stationError < 2.5, `it keeps pace with the host near its drifting station (mean ${stationError.toFixed(2)} WU off)`)

  // A spot opens: at its next look it goes for it.
  releaseRideSlots('big-2')
  ride.nextDecisionAt = 30
  advanceRide(ride, sharksucker, hitch, riderLength, 30, riderPosition, new THREE.Quaternion(), escortSpeeds, always)
  assert.equal(ride.stage, 'approach', 'when a spot opens, the escort goes for it')
  assert.equal(ride.hostId, 'mako-1', 'on the host it was shadowing')
  releaseRideSlots('sucker-1')
  claimRideSlot('mako-1', throat.index, 'big-2', 4.4, hitch)
  registerHost(mako, new THREE.Vector3(0, -2, -12))

  // It gives up after its spell, or at once when the host fades.
  const bored = freeRider()
  advanceRide(bored, sharksucker, hitch, riderLength, 0, riderAt, new THREE.Quaternion(), escortSpeeds, always)
  assert.equal(bored.stage, 'escort', 'escorting again')
  advanceRide(bored, sharksucker, hitch, riderLength, bored.stageUntil + 0.01, riderAt, new THREE.Quaternion(), escortSpeeds, always)
  assert.equal(bored.stage, 'free', 'after its spell it swims off')
  assert.equal(bored.hostId, null, 'leaving the host')
  const faded = freeRider()
  advanceRide(faded, sharksucker, hitch, riderLength, 0, riderAt, new THREE.Quaternion(), escortSpeeds, always)
  updateFishRegistryPose('mako-1', new THREE.Quaternion(), 0, 0.5)
  advanceRide(faded, sharksucker, hitch, riderLength, 0.1, riderAt, new THREE.Quaternion(), escortSpeeds, always)
  assert.equal(faded.stage, 'free', 'a fading host is not escorted')
  updateFishRegistryPose('mako-1', new THREE.Quaternion(), 0, 1)
  for (const index of [0, 1]) releaseRideSlots(`big-${index}`)

  // Letting go, it often stays with the host it just left.
  const leaving = freeRider()
  leaving.stage = 'release'
  leaving.stageStartedAt = 0
  leaving.lastHostId = 'mako-1'
  leaving.nextDecisionAt = 100 // a real release waits out its spell off the disc
  advanceRide(leaving, sharksucker, hitch, riderLength, 2, riderAt, new THREE.Quaternion(), escortSpeeds, always)
  assert.equal(leaving.stage, 'escort', 'after letting go it can stay with its host')
  assert.equal(leaving.hostId, 'mako-1', 'the one it left')
  assert.ok(leaving.nextDecisionAt >= leaving.stageUntil, 'and does not look for a ride again until its spell off the disc is over')
  const leavingUnlucky = freeRider()
  leavingUnlucky.stage = 'release'
  leavingUnlucky.stageStartedAt = 0
  leavingUnlucky.lastHostId = 'mako-1'
  leavingUnlucky.nextDecisionAt = 100 // a real release waits out its spell off the disc
  advanceRide(leavingUnlucky, sharksucker, hitch, riderLength, 2, riderAt, new THREE.Quaternion(), escortSpeeds, never)
  assert.equal(leavingUnlucky.stage, 'free', 'or it swims off')
} finally {
  clearRegistry()
  releaseRideSlots('sucker-1')
  for (const index of [0, 1, 2]) releaseRideSlots(`big-${index}`)
}

// --- followers: escort for good, never attach ----------------------------------------------

// The pilot fish runs the escort path only (`attaches: false`): it finds its host anywhere in
// the tank, holds stations round its front half, drifts to a new one when a spell ends instead
// of leaving, and never claims a spot.
{
  const pilotSpecies = speciesById.get('naucrates-ductor')
  const pilotHitch = hitchhikerProfile(pilotSpecies)
  const pilotLength = pilotSpecies.swim.bodyLengthWU
  const pilotMargin = pilotLength * 0.2
  const pilot = { id: 'pilot-1', species: 'naucrates-ductor', biome: 'ocean', size: 1 }
  const mola = { id: 'mola-1', species: 'mola-alexandrini', biome: 'ocean', size: 1 }
  const pilotSpeeds = { idle: 0.65 * pilotLength, burst: 2.2 * pilotLength }
  assert.ok(pilotHitch, 'the pilot fish follows hosts')
  assert.equal(pilotHitch.attaches, false, 'but never attaches to one')
  assert.equal(pilotSpecies.schooling, false, 'it runs the solo-agent path the escort steering lives on')
  assert.equal(rideHostWeight(pilotHitch, molaHost), 1, 'it takes the Mola readily')
  try {
    const hostPosition = new THREE.Vector3(0, -4, -12)
    registerHost(mola, hostPosition)
    let molaLength = 0
    forEachFish((entry, id) => { if (id === 'mola-1') molaLength = entry.bodyLength })
    assert.ok(molaLength > 10, 'the Mola is registered at its size')
    const far = new THREE.Vector3(0, -4, -12 - molaLength * 6)
    assert.equal(findRideHost(pilot, far, pilotLength, pilotHitch, always), null, 'it never looks for a spot')
    assert.equal(findEscortHost(pilot, far, pilotHitch)?.hostId, 'mola-1', 'it finds its host from across the tank')

    // Its stations sit round the front half of the host and never over the top.
    for (let seed = 1; seed <= 40; seed += 1) {
      const picked = freeRider()
      advanceRide(picked, pilot, pilotHitch, pilotLength, 0, far, new THREE.Quaternion(), pilotSpeeds, mulberry32(seed))
      assert.equal(picked.stage, 'escort', `seed ${seed}: it starts following`)
      assert.equal(picked.anchorIndex, -1, `seed ${seed}: holding no spot`)
      for (const now of [0, 9, 23, 51]) {
        const local = escortStation(new THREE.Vector3(), picked.escort, molaHost, molaLength, pilotLength, now)
        assert.ok(bodyRadius(local, molaHost, molaLength, pilotMargin) >= 1.05, `seed ${seed}: its station is outside the host and its clearance`)
        assert.ok(local.z < molaHost.body.center.z * molaLength + 0.2 * molaHost.body.radii.z * molaLength, `seed ${seed}: its station is round the front half`)
        // In the clearance ellipsoid's normalized space: at most 35 + 18 degrees (drift) above the side.
        const up = (local.y - molaHost.body.center.y * molaLength) / (molaHost.body.radii.y * molaLength + pilotMargin)
        const side = Math.abs(local.x - molaHost.body.center.x * molaLength) / (molaHost.body.radii.x * molaLength + pilotMargin)
        assert.ok(Math.atan2(up, side) <= THREE.MathUtils.degToRad(53.5), `seed ${seed}: its station is not over the top`)
      }
    }

    // Following a cruising Mola for 60 s from across the tank: it catches up, keeps near its
    // station, never enters the body, and (with no chance to break off) never stops following.
    const loyalHitch = { ...pilotHitch, escort: { ...pilotHitch.escort, leaveChance: 0 } }
    const ride = freeRider()
    const position = far.clone()
    const dt = 1 / 60
    let closest = Infinity
    let farthest = 0
    let restations = 0
    let lastUntil = null
    for (let now = 0; now < 120; now += dt) {
      hostPosition.z -= 0.9 * dt
      registerHost(mola, hostPosition, new THREE.Quaternion(), 0.9)
      advanceRide(ride, pilot, loyalHitch, pilotLength, now, position, new THREE.Quaternion(), pilotSpeeds, mulberry32(Math.floor(now * 60)))
      assert.notEqual(ride.stage, 'approach', 'it never goes for a spot')
      assert.equal(ride.ownsPose, false, 'it is never carried')
      if (ride.stage !== 'escort') continue
      if (lastUntil !== null && ride.stageUntil !== lastUntil) restations += 1
      lastUntil = ride.stageUntil
      const toTarget = ride.target.clone().sub(position)
      if (toTarget.lengthSq() > 0) position.addScaledVector(toTarget.normalize(), Math.min(toTarget.length(), ride.targetSpeed * dt))
      keepRiderClearOfHost(position, ride, pilotLength)
      const local = position.clone().sub(hostPosition)
      closest = Math.min(closest, bodyRadius(local, molaHost, molaLength))
      if (now > 60) farthest = Math.max(farthest, local.length())
    }
    assert.equal(ride.stage, 'escort', 'still following after two minutes')
    assert.equal(ride.hostId, 'mola-1', 'the same host')
    assert.ok(restations >= 1, `it drifts to a new station when a spell ends (${restations})`)
    assert.ok(closest >= 1, `it never enters the body (closest ${closest.toFixed(3)})`)
    assert.ok(farthest < molaLength, `after catching up it stays within a body length of the host (farthest ${farthest.toFixed(1)} WU)`)

    // Escorting, it eases down to its own floor rather than half its quicker free cruise.
    assert.ok(pilotHitch.escort.minSpeedBLPerSec < pilotSpecies.swim.idleBLPerSec[0], 'pacing the host is slower than roaming')

    // When a spell ends it sometimes breaks off to roam for `freeSeconds`, then comes back.
    assert.ok(pilotHitch.escort.leaveChance > 0 && pilotHitch.escort.leaveChance < 1, 'it sometimes roams, sometimes stays')
    const roamer = freeRider()
    advanceRide(roamer, pilot, pilotHitch, pilotLength, 0, position, new THREE.Quaternion(), pilotSpeeds, always)
    assert.equal(roamer.stage, 'escort', 'a roamer starts out following')
    const spellEnd = roamer.stageUntil
    advanceRide(roamer, pilot, pilotHitch, pilotLength, spellEnd, position, new THREE.Quaternion(), pilotSpeeds, () => 0)
    assert.equal(roamer.stage, 'free', 'at the end of a spell it can break off')
    assert.equal(roamer.hostId, null, 'following nothing')
    const away = roamer.nextDecisionAt - spellEnd
    assert.ok(away >= pilotHitch.freeSeconds[0] && away <= pilotHitch.freeSeconds[1], `it roams for its free spell (${away.toFixed(1)} s)`)
    advanceRide(roamer, pilot, pilotHitch, pilotLength, spellEnd + away / 2, position, new THREE.Quaternion(), pilotSpeeds, () => 0)
    assert.equal(roamer.stage, 'free', 'it does not rejoin mid-roam')
    advanceRide(roamer, pilot, pilotHitch, pilotLength, roamer.nextDecisionAt, position, new THREE.Quaternion(), pilotSpeeds, () => 0)
    assert.equal(roamer.stage, 'escort', 'then rejoins its host')
    const stayer = freeRider()
    advanceRide(stayer, pilot, pilotHitch, pilotLength, 0, position, new THREE.Quaternion(), pilotSpeeds, always)
    advanceRide(stayer, pilot, pilotHitch, pilotLength, stayer.stageUntil, position, new THREE.Quaternion(), pilotSpeeds, () => 0.99)
    assert.equal(stayer.stage, 'escort', 'or it stays and drifts to a new station')

    // A fading host is let go, and picked up again once it is back.
    updateFishRegistryPose('mola-1', new THREE.Quaternion(), 0, 0.5)
    advanceRide(ride, pilot, pilotHitch, pilotLength, 200, position, new THREE.Quaternion(), pilotSpeeds, always)
    assert.equal(ride.stage, 'free', 'a fading host is not followed')
    updateFishRegistryPose('mola-1', new THREE.Quaternion(), 0, 1)
    advanceRide(ride, pilot, pilotHitch, pilotLength, ride.nextDecisionAt, position, new THREE.Quaternion(), pilotSpeeds, always)
    assert.equal(ride.stage, 'escort', 'and rejoined when it is back')
  } finally {
    clearRegistry()
  }
}

// --- tanks -------------------------------------------------------------------------------

// Every rider placed in a tank either has a host there or is a documented exception waiting
// for its host species to arrive. A new tank member with no host fails here until it is
// either given one or added to this list on purpose.
const WAITING_FOR_HOSTS = new Set(['remora-australis'])
for (const tank of TANKS) {
  const hosts = tank.species.map(id => rideHostProfile(speciesById.get(id))).filter(Boolean)
  for (const id of tank.species) {
    const rider = hitchhikerProfile(speciesById.get(id))
    if (!rider) continue
    const best = Math.max(0, ...hosts.map(host => rideHostWeight(rider, host)))
    if (WAITING_FOR_HOSTS.has(id)) assert.equal(best, 0, `${id} is listed as waiting but already has a host in ${tank.id}`)
    else assert.ok(best > 0, `${id} has something to ride in ${tank.id}`)
  }
}

console.log('fish ride tests passed')
