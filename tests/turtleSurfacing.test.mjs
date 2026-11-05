import assert from 'node:assert/strict'
import * as THREE from 'three'
import { SPECIES } from '../src/data/species.js'
import { getFishRuntime, pruneFishRuntime } from '../src/components/fishRuntimeStore.js'
import { advanceTurtleSurfacing, createTurtleSurfacingState, turtleSurfaceCeiling } from '../src/components/turtleSurfacing.js'
import { clampToSurfaceCeiling, clampToSwimBounds, maxTurnRadiansForSpeed, mulberry32, pitchToward, shapeSoloAgentSteeringDesired, swimBounds, yawToward } from '../src/components/fishSwim.js'

const species = SPECIES.find(item => item.id === 'chelonia-mydas')
const swim = species.swim
const config = swim.surfacing
const creature = { id: 'turtle-test', species: species.id, size: 0.78, depthZone: 'epipelagic' }
const length = swim.bodyLengthWU * creature.size
const bounds = swimBounds(creature.depthZone, swim, creature.size)
const steeringBounds = { ...bounds, yMax: 4.6 + swim.bodyLengthWU * 3 }
const ceiling = turtleSurfaceCeiling(config, length)

// Exercise ascent, a whole breath and descent with the runtime's capped turns and
// integration. A timer must never start its breath while still down by the sand.
for (const fps of [30, 60, 120]) {
  const rand = mulberry32(7)
  const state = createTurtleSurfacingState()
  const position = new THREE.Vector3(0, -22, -35)
  const forward = new THREE.Vector3(1, 0, 0)
  const desired = new THREE.Vector3()
  state.nextAt = 0
  let sawBreathe = false
  let breatheStarted = null
  let returned = false
  for (let frame = 0; frame < 180 * fps; frame += 1) {
    const now = frame / fps
    const active = advanceTurtleSurfacing(state, config, now, position, forward, length, bounds, rand)
    if (!active) { returned = true; break }
    if (state.stage === 'breathe') {
      if (!sawBreathe) breatheStarted = now
      sawBreathe = true
      assert.ok(position.y > ceiling - 0.15, 'breath starts at the surface')
    }
    if (state.stage === 'dive' && sawBreathe) assert.ok(now - breatheStarted >= config.duration[0], 'a full breath before diving')
    shapeSoloAgentSteeringDesired(desired, position, state.target, forward, creature, swim, steeringBounds)
    const speed = length * 0.3 * (state.stage === 'breathe' ? config.speedScale : 1)
    const step = maxTurnRadiansForSpeed(swim, length, speed, 1 / fps)
    yawToward(forward, desired, step)
    pitchToward(forward, desired, step)
    position.addScaledVector(forward, speed / fps)
    clampToSwimBounds(position, bounds)
    clampToSurfaceCeiling(position, forward, ceiling)
    assert.ok(position.y <= ceiling + 1e-9, 'body center stays under the surface')
  }
  assert.ok(sawBreathe, `${fps} Hz: completes the ascent`)
  assert.ok(returned, `${fps} Hz: returns to low cruising`)
  assert.ok(position.y <= config.cruiseY[1])
  assert.ok(state.nextAt >= config.interval[0], 'a new interval follows the return')
}

// A failed ascent gives up into a descent; a reserve switch retains the timer and
// shared foil clock rather than starting another visit or reseeding the pose.
{
  const state = createTurtleSurfacingState()
  state.stage = 'rise'
  state.nextAt = 0
  advanceTurtleSurfacing(state, config, config.maxRiseSeconds + 1, new THREE.Vector3(0, -5, -30), new THREE.Vector3(1, 0, 0), length, bounds, () => 0.5)
  assert.equal(state.stage, 'dive')
  const entry = getFishRuntime(creature.id)
  entry.surfacing = { state }
  entry.foilFlap = { state: { clock: 42, glide: 0.8 } }
  assert.equal(getFishRuntime(creature.id).surfacing.state, state)
  assert.equal(getFishRuntime(creature.id).foilFlap.state.clock, 42)
  pruneFishRuntime(new Set())
}

console.log('turtle surfacing tests passed (30/60/120 Hz)')
