import assert from 'node:assert/strict'
import * as THREE from 'three'
import {
  clearRockObstacles,
  pinchedLastPush,
  pushOutOfRocks,
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

console.log('rock obstacle tests passed')
