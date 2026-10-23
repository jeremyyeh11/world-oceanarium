import assert from 'node:assert/strict'
import { TANKS } from '../src/data/species.js'
import { depthTicks, reserveDepthLabel, reserveDepthRange } from '../src/utils/reserveDepth.js'

const marks = range => depthTicks(range).map(tick => tick.meters)

// Round steps, both ends always marked.
assert.deepEqual(marks([0, 30]), [0, 10, 20, 30])
assert.deepEqual(marks([0, 200]), [0, 50, 100, 150, 200])
assert.deepEqual(marks([0, 8]), [0, 2, 4, 6, 8])
assert.deepEqual(marks([200, 1000]), [200, 400, 600, 800, 1000])
// An interior tick crowding the bottom is dropped.
assert.deepEqual(marks([0, 21]), [0, 5, 10, 15, 21])
// Positions run 0 to 1 down the line.
const ticks = depthTicks([0, 30])
assert.equal(ticks[0].at, 0)
assert.equal(ticks.at(-1).at, 1)
assert.ok(ticks.every((tick, i) => i === 0 || tick.at > ticks[i - 1].at))

// A reserve's own range wins; without one, its zone's range.
assert.deepEqual(reserveDepthRange({ depthMeters: [0, 30], depthZone: 'epipelagic' }), [0, 30])
assert.deepEqual(reserveDepthRange({ depthZone: 'mesopelagic' }), [200, 1000])
assert.equal(reserveDepthLabel({ depthMeters: [0, 30], depthZone: 'epipelagic' }), 'Sunlight Zone · 0–30 m')

// Every shipped reserve declares a sane range inside its zone's.
for (const tank of TANKS) {
  const [top, bottom] = reserveDepthRange(tank)
  assert.ok(Array.isArray(tank.depthMeters), `${tank.id} has no depthMeters`)
  assert.ok(top >= 0 && bottom > top, `${tank.id} depth range ${top}–${bottom}`)
}

console.log('reserve depth tests passed')
