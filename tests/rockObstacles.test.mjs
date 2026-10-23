import assert from 'node:assert/strict'
import * as THREE from 'three'
import {
  clearRockObstacles,
  pinchedLastPush,
  pushOutOfRocks,
  rockBendSide,
  rockPad,
  setRockObstacles,
  steerAroundRocks,
} from '../src/components/rockObstacles.js'

const OPTIONS = { region: { xMin: -100, xMax: 100, zMin: -100, zMax: 100 }, floorTop: -100, maxPad: 8 }
const FLOOR_Y = -19

// The two foreground bommies at The Reefs (pieces 43 and 47 of the built field): their padded
// shapes overlap at the swim floor for a body of about 2 WU.
const bommies = setRockObstacles([
  { x: -3, y: -24.78, z: 1, width: 5, height: 12, depth: 5, yaw: 0.5 },
  { x: 3.2, y: -22.48, z: 1.5, width: 4.5, height: 10.94, depth: 4.5, yaw: -0.4 },
], OPTIONS)

// A clown triggerfish swimming along the floor, nose into the gap, a frame at a time (at
// 1.8 WU/s). Before, the clamp flicked it between the two pads every frame; now it slides on
// along their faces or stops, never jumping, never through the floor, never flicking.
{
  const bodyLength = 1.976
  const position = new THREE.Vector3(0.4, FLOOR_Y, -1.6)
  const from = new THREE.Vector3()
  const lastNormal = new THREE.Vector3()
  let hasLastNormal = false
  let lastDx = 0
  let reversals = 0
  let pinches = 0
  let maxStep = 0
  for (let frame = 0; frame < 240; frame++) {
    from.copy(position)
    position.z += 0.03
    position.y = Math.max(position.y, FLOOR_Y)
    const normal = pushOutOfRocks(position, bodyLength, from, FLOOR_Y, hasLastNormal ? lastNormal : null)
    if (normal) {
      lastNormal.copy(normal)
      hasLastNormal = true
    }
    if (pinchedLastPush()) pinches += 1
    maxStep = Math.max(maxStep, position.distanceTo(from))
    const dx = position.x - from.x
    if (Math.abs(dx) > 1e-4 && Math.abs(lastDx) > 1e-4 && Math.sign(dx) !== Math.sign(lastDx)) reversals += 1
    if (Math.abs(dx) > 1e-4) lastDx = dx
    assert.ok(position.y >= FLOOR_Y - 1e-9, `frame ${frame}: never pushed through the swim floor (y ${position.y})`)
  }
  assert.ok(pinches > 0, 'the gap between the bommies is a pinch for a triggerfish')
  assert.ok(maxStep <= 0.03 + 1e-6, `no frame moves it further than its own step (largest ${maxStep.toFixed(4)})`)
  assert.ok(reversals <= 2, `it does not flick side to side in the gap (${reversals} reversals)`)
  assert.equal(pushOutOfRocks(position.clone(), bodyLength, position, FLOOR_Y, null), null, 'it ends clear of both rocks')
}

// Level push at the floor: a point on the floor inside a rock whose middle is above the floor is
// pushed out sideways, at its own height, with a level normal; above the floor it goes radially.
{
  const bodyLength = 1
  const point = new THREE.Vector3(3.2 - 2.6, FLOOR_Y, 1.5)
  const normal = pushOutOfRocks(point, bodyLength, null, FLOOR_Y)
  assert.ok(normal, 'the point was inside the bommie')
  assert.equal(point.y, FLOOR_Y, 'pushed out level, not down through the floor')
  assert.ok(Math.abs(normal.y) < 1e-9, 'the normal at the floor is level')
  assert.equal(pinchedLastPush(), false, 'one rock alone is no pinch')

  const free = new THREE.Vector3(3.2 - 2.6, -17.01, 1.5)
  const freeNormal = pushOutOfRocks(free, bodyLength, null, FLOOR_Y)
  const pad = rockPad(bodyLength)
  assert.ok(freeNormal, 'inside at mid-height too')
  assert.ok(Math.abs(free.x - (3.2 - 2.25 - pad)) < 1e-6, 'at mid-height it goes straight out to the padded surface')
}

// Back from a reef site between the bommies: a fish that starts inside both pads swims slowly out
// of the gap while the clamp eases in (1.5 s at 60 fps), its correction capped at its step plus
// the return speed, as Fish.jsx does. Pushed out of the deeper pad, it landed inside the other and
// flicked between them 0.1 to 0.2 WU a frame; out along the pads' summed normal it does not.
{
  const bodyLength = 1.976
  const returnStep = 1.2 / 60
  for (const start of [[0.35, -18.2, 0.9], [0.1, -17.5, 1.3], [0.6, -18.9, 0.5]]) {
    for (const dz of [-0.02, 0.02]) {
      const position = new THREE.Vector3(...start)
      const from = new THREE.Vector3()
      const unclamped = new THREE.Vector3()
      const lastMove = new THREE.Vector3()
      let blend = 0
      let flicks = 0
      for (let frame = 0; frame < 240; frame++) {
        from.copy(position)
        position.z += dz
        unclamped.copy(position)
        const maxStep = unclamped.distanceTo(from) + returnStep
        pushOutOfRocks(position, bodyLength, from, FLOOR_Y, null, maxStep)
        position.lerpVectors(unclamped, position, blend)
        const correction = position.distanceTo(unclamped)
        if (correction > maxStep) position.lerpVectors(unclamped, position, maxStep / correction)
        blend = Math.min(1, blend + 1 / 90)
        const move = position.clone().sub(unclamped)
        if (move.length() > 0.005 && lastMove.length() > 0.005 && move.dot(lastMove) < -0.5 * move.length() * lastMove.length()) flicks += 1
        lastMove.copy(move)
        assert.ok(position.distanceTo(from) <= 0.02 + maxStep + 1e-6, `frame ${frame}: no jump out of the pads (${position.distanceTo(from).toFixed(3)} WU)`)
        assert.ok(position.y >= FLOOR_Y - 1e-9, `frame ${frame}: never through the swim floor`)
      }
      assert.ok(flicks <= 2, `it does not flick between the two rocks on the way out (${flicks} flicks)`)
      assert.equal(pushOutOfRocks(position.clone(), bodyLength, null, FLOOR_Y, null), null, 'it is out of both pads within 4 s')
    }
  }
}

clearRockObstacles(bommies)

// The probe: a rock ahead bends the heading, unless the fish is at a pinch (lookAhead false),
// where only rocks it is brushing push it.
{
  const rock = setRockObstacles([{ x: 0, y: -5, z: -6, width: 4, height: 10, depth: 4, yaw: 0 }], OPTIONS)
  const position = new THREE.Vector3(0.3, 0, 0)
  const forward = new THREE.Vector3(0, 0, -1)
  const ahead = forward.clone()
  assert.ok(steerAroundRocks(ahead, position, forward, 1, 1) > 0, 'a rock ahead raises the urgency')
  assert.ok(ahead.distanceTo(forward) > 0.01, 'and bends the heading')
  const held = forward.clone()
  assert.equal(steerAroundRocks(held, position, forward, 1, 1, false), 0, 'without the probe, a rock ahead does nothing')
  assert.ok(held.distanceTo(forward) < 1e-9, 'and the heading is left alone')
  clearRockObstacles(rock)
}

// The probe feels a rock gradually: swinging the heading across a rock's outline a twentieth of a
// degree at a time never changes the urgency or the bend by more than a sliver. Before, the bend
// came on in full the frame the probe touched the padding (urgency 0 to 0.2 or more).
{
  const rock = setRockObstacles([{ x: 0, y: -5, z: -6, width: 4, height: 10, depth: 4, yaw: 0.3 }], OPTIONS)
  const position = new THREE.Vector3(0, 0, -0.5)
  let last = null
  let lastBend = null
  let felt = false
  let largestJump = 0
  let largestBend = 0
  for (let deg = 5; deg <= 40; deg += 0.05) {
    const angle = THREE.MathUtils.degToRad(deg)
    const forward = new THREE.Vector3(Math.sin(angle), 0, -Math.cos(angle))
    const desired = forward.clone()
    const urgency = steerAroundRocks(desired, position, forward, 0.4, 1.2)
    if (urgency > 0) felt = true
    if (last !== null) {
      largestJump = Math.max(largestJump, Math.abs(urgency - last))
      largestBend = Math.max(largestBend, desired.distanceTo(lastBend))
    }
    last = urgency
    lastBend = desired.clone()
  }
  assert.ok(felt, 'the rock is felt somewhere in the sweep')
  assert.ok(largestJump < 0.02, `urgency changes smoothly with the heading (largest step ${largestJump.toFixed(3)})`)
  assert.ok(largestBend < 0.05, `and so does the bent heading (largest step ${largestBend.toFixed(3)})`)
  clearRockObstacles(rock)
}

// A young angelfish swimming past a rock with a smaller one beside it, a frame at a time, with
// Fish.jsx's bend smoothing (ROCK_AVOID_RISE / FALL) and turn cap. Before, its probe tip sat on
// the edge of both pads and landed in one, then the other, every frame: the bend's normal flipped
// up and down and the heading shivered (95 flips over these 17 runs). Now it does not.
{
  const pieces = [
    { x: 0, y: -5, z: -6, width: 4, height: 10, depth: 4, yaw: 0.3 },
    { x: 2.6, y: -2.2, z: -6, width: 1.2, height: 1, depth: 1.2, yaw: 0 },
  ]
  const rocks = setRockObstacles(pieces, OPTIONS)
  const bodyLength = 0.4
  const speed = 1.2
  const delta = 1 / 60
  let flips = 0
  for (let i = -8; i <= 8; i++) {
    const position = new THREE.Vector3(i * 0.25 + 1, -1, 2)
    const goal = new THREE.Vector3(3.5, -1.5, -14)
    const heading = goal.clone().sub(position).normalize()
    const smoothed = new THREE.Vector3()
    let smoothedUrgency = 0
    let lastAxis = null
    for (let frame = 0; frame < 600; frame++) {
      const base = goal.clone().sub(position).normalize()
      const desired = base.clone()
      const raw = steerAroundRocks(desired, position, heading, bodyLength, speed)
      const alpha = 1 - Math.exp(-delta * (raw >= smoothedUrgency ? 10 : 2.5))
      smoothed.lerp(desired.sub(base), alpha)
      smoothedUrgency += (raw - smoothedUrgency) * alpha
      const target = base.add(smoothed).normalize()
      const cap = speed / bodyLength * delta * (1 + 2 * smoothedUrgency)
      const before = heading.clone()
      const angle = heading.angleTo(target)
      if (angle <= cap) heading.copy(target)
      else heading.lerp(target, cap / angle).normalize()
      const axis = before.cross(heading)
      if (axis.length() > Math.sin(THREE.MathUtils.degToRad(2))) {
        if (lastAxis && lastAxis.dot(axis) < 0) flips += 1
        lastAxis = axis
      } else lastAxis = null
      position.addScaledVector(heading, speed * delta)
    }
  }
  assert.ok(flips <= 2, `no shiver past the two rocks (${flips} heading flips)`)
  clearRockObstacles(rocks)
}

// Fish nosing into the crease of a V of two rocks, their destination straight past it, a frame at
// a time with Fish.jsx's bend smoothing, turn cap and side memory (ROCK_SIDE_MEMORY_SECONDS).
// Which way round was a coin toss each frame, and the heading's own step tipped it: 84 to 171
// flips a run. Keeping to the side they are going round, they go round one rock.
{
  const pieces = [
    { x: -1.6, y: -6, z: -6, width: 3, height: 10, depth: 3, yaw: 0.6 },
    { x: 1.6, y: -6, z: -6, width: 3, height: 10, depth: 3, yaw: -0.6 },
  ]
  const rocks = setRockObstacles(pieces, OPTIONS)
  const delta = 1 / 60
  const goal = new THREE.Vector3(0, -1, -16)
  let flips = 0
  for (const bodyLength of [0.4, 1]) {
    for (const x of [-0.15, 0, 0.15]) {
      const speed = bodyLength * 3
      const position = new THREE.Vector3(x, -1, 4)
      const heading = goal.clone().sub(position).normalize()
      const smoothed = new THREE.Vector3()
      let smoothedUrgency = 0
      let side = 0
      let sideAt = -Infinity
      let lastSign = 0
      let frame = 0
      for (; frame < 1800 && position.distanceTo(goal) > 1; frame++) {
        const now = frame * delta
        const base = goal.clone().sub(position).normalize()
        const desired = base.clone()
        const raw = steerAroundRocks(desired, position, heading, bodyLength, speed, true, now - sideAt < 0.5 ? side : 0)
        if (rockBendSide() !== 0) {
          side = rockBendSide()
          sideAt = now
        }
        const alpha = 1 - Math.exp(-delta * (raw >= smoothedUrgency ? 10 : 2.5))
        smoothed.lerp(desired.sub(base), alpha)
        smoothedUrgency += (raw - smoothedUrgency) * alpha
        const target = base.add(smoothed).normalize()
        const cap = speed / bodyLength * delta * (1 + 2 * smoothedUrgency)
        const before = Math.atan2(heading.x, heading.z)
        const angle = heading.angleTo(target)
        if (angle <= cap) heading.copy(target)
        else heading.lerp(target, cap / angle).normalize()
        const turn = Math.atan2(Math.sin(Math.atan2(heading.x, heading.z) - before), Math.cos(Math.atan2(heading.x, heading.z) - before))
        if (Math.abs(turn) > THREE.MathUtils.degToRad(2)) {
          if (lastSign && Math.sign(turn) !== lastSign) flips += 1
          lastSign = Math.sign(turn)
        }
        position.addScaledVector(heading, speed * delta)
      }
      assert.ok(position.distanceTo(goal) <= 1, `a ${bodyLength} WU fish from x ${x} gets round the V`)
    }
  }
  assert.ok(flips <= 3, `no shiver in the crease (${flips} heading flips over 6 runs)`)
  clearRockObstacles(rocks)
}

// A thin coral table: the probe's push off it goes to the fish's side of the table's middle, not
// the probe's. A fish above it, heading down through it, pulls up; one below, heading up, dips.
{
  const table = setRockObstacles([{ x: 0, y: -0.15, z: -3, width: 3, height: 0.3, depth: 3, yaw: 0 }], OPTIONS)
  const above = new THREE.Vector3(0, 0.5, 1)
  const down = new THREE.Vector3(0, -0.35, -1).normalize()
  const fromAbove = down.clone()
  assert.ok(steerAroundRocks(fromAbove, above, down, 0.4, 1) > 0, 'the table is felt from above')
  assert.ok(fromAbove.y > down.y + 0.05, `from above it bends up (${down.y.toFixed(2)} to ${fromAbove.y.toFixed(2)})`)
  const below = new THREE.Vector3(0, -0.8, 1)
  const up = new THREE.Vector3(0, 0.35, -1).normalize()
  const fromBelow = up.clone()
  assert.ok(steerAroundRocks(fromBelow, below, up, 0.4, 1) > 0, 'and from below')
  assert.ok(fromBelow.y < up.y - 0.05, `from below it bends down (${up.y.toFixed(2)} to ${fromBelow.y.toFixed(2)})`)
  clearRockObstacles(table)
}

console.log('rock obstacle tests passed')
