import assert from 'node:assert/strict'
import { SPECIES } from '../src/data/species.js'
import { advanceFoilFlap, createFoilFlapState } from '../src/utils/foilFlap.js'
import { mulberry32 } from '../src/components/fishSwim.js'

const TAU = Math.PI * 2
const config = SPECIES.find(species => species.id === 'chelonia-mydas').model.proceduralAnimation

// Runs one turtle's clock for `seconds` at 60 fps and reports how it spent the time.
function run({ seconds = 600, speed01 = 0.3, burst01 = 0, seed = 7 } = {}) {
  const rand = mulberry32(seed)
  const state = createFoilFlapState(config, rand)
  let glideFrames = 0
  let frames = 0
  let glides = 0
  let wasGliding = state.gliding
  const holds = []
  for (let t = 0; t < seconds; t += 1 / 60) {
    const before = state.clock
    advanceFoilFlap(state, config, 1 / 60, { speed01, burst01, rand })
    assert.ok(state.clock >= before, 'the clock never runs backwards')
    if (state.gliding) glideFrames += 1
    if (state.gliding && wasGliding) assert.equal(state.clock, before, 'the clock holds through a glide')
    if (state.gliding && !wasGliding) {
      glides += 1
      holds.push(state.clock)
    }
    wasGliding = state.gliding
    frames += 1
  }
  return { glideShare: glideFrames / frames, glides, holds, minutes: seconds / 60 }
}

{
  // Every glide holds at the bottom of a downstroke, so the next group starts with the recovery.
  const { holds } = run()
  assert.ok(holds.length > 20)
  for (const clock of holds) {
    const fraction = (clock / TAU) % 1
    assert.ok(Math.abs(fraction - config.downFraction) < 1e-6, `glide held at ${fraction.toFixed(3)} of the beat`)
  }
}

{
  // Review gate: at cruise it glides for at least a third of the time, and glides more slowly
  // than it strokes when it drifts.
  const cruise = run({ speed01: 0.3 })
  const idle = run({ speed01: 0 })
  const fast = run({ speed01: 0.9 })
  assert.ok(cruise.glideShare >= 1 / 3, `cruise glide share ${cruise.glideShare.toFixed(2)}`)
  assert.ok(idle.glideShare > cruise.glideShare, 'idle drift glides more than cruise')
  assert.ok(fast.glideShare < cruise.glideShare, 'a fast swim glides less than cruise')
  console.log(`foil-flap glide share: idle ${idle.glideShare.toFixed(2)}, cruise ${cruise.glideShare.toFixed(2)}, fast ${fast.glideShare.toFixed(2)}`)
}

{
  // A burst strokes on with no glide.
  assert.equal(run({ seconds: 60, burst01: 1 }).glides, 0)
}

{
  // Two turtles start out of step.
  const a = createFoilFlapState(config, mulberry32(1))
  const b = createFoilFlapState(config, mulberry32(2))
  assert.notEqual(a.clock, b.clock)
}

console.log('foil-flap clock tests passed')
