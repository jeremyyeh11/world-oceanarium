// foil-flap-vertex's beat clock (docs/procedural/foil-flap.md): a turtle strokes in short groups
// and glides between them. The clock is in radians, one beat per 2π, with the top of the stroke
// at whole beats and the bottom at `downFraction` of each. A group ends at the bottom of its last
// downstroke, where the clock holds while the flippers ease into the swept-back glide pose; the
// next group starts with the recovery from there. The tank (Fish.jsx) and the Atlas specimen run
// the same machine, so both move through the same path.

const TAU = Math.PI * 2

function pick(rand, range, fallback) {
  const [min, max] = Array.isArray(range) ? range : [fallback, fallback]
  return min + rand() * (max - min)
}

// `rand` is the creature's own seeded stream (mulberry32), drawn from only at group and glide
// boundaries. The clock starts somewhere inside a group, so a reserve's turtles never sync.
export function createFoilFlapState(config, rand) {
  const strokes = Math.max(1, Math.round(pick(rand, config.strokesPerGroup, 2)))
  const clock = rand() * TAU * strokes
  const downFraction = config.downFraction ?? 0.38
  return {
    clock,
    nextGlideAt: TAU * (strokes - 1 + downFraction),
    gliding: false,
    glideLeft: 0,
    glide: 0,
    thrust: 0,
    speedScale: 1,
  }
}

// One frame. speed01 and burst01 are the shared runtime drivers; beatRate a stable per-creature
// cadence. Faster swimming adds strokes to a group and shortens glides; a burst strokes on with no
// glide; a resting turtle mostly glides. `glide` eases toward 1 while gliding and back to 0 after,
// over about half a beat (glideResponse). Returns the state.
export function advanceFoilFlap(state, config, delta, { speed01 = 0, burst01 = 0, beatRate = 1, resting = false, rand } = {}) {
  const dt = Math.max(0, delta)
  const previousClock = state.clock
  if (resting) {
    state.gliding = true
    // Ease into the glide from this pose; never jump the clock to another phase.
    state.glideLeft = Math.max(state.glideLeft, dt + 0.1)
  }
  if (state.gliding) {
    state.glideLeft -= dt
    // A burst or a hard push cuts the glide short.
    if (state.glideLeft <= 0 || burst01 > 0.15) {
      state.gliding = false
      const strokes = Math.max(1, Math.round(pick(rand, config.strokesPerGroup, 2) + speed01 * (config.speedExtraStrokes ?? 2)))
      state.nextGlideAt = TAU * (Math.floor(state.clock / TAU) + strokes + (config.downFraction ?? 0.38))
    }
  } else {
    const rate = (config.waveSpeed ?? 3.4) * beatRate * (
      1
      + speed01 * (config.speedFrequencyBoost ?? 0.3)
      + burst01 * (config.burstFrequencyBoost ?? 0.4)
    )
    // While bursting, push the glide back a beat at a time so it never comes.
    if (burst01 > 0.15) state.nextGlideAt = Math.max(state.nextGlideAt, state.clock + TAU)
    state.clock += dt * rate
    if (state.clock >= state.nextGlideAt) {
      state.clock = state.nextGlideAt
      state.gliding = true
      // Idle drift glides longest, cruise less, a fast swim hardly at all.
      const speedScale = 1.5 - speed01 * (config.speedGlideCut ?? 1.1)
      state.glideLeft = pick(rand, config.glideSeconds, 2) * Math.max(0.2, speedScale)
    }
  }
  const target = state.gliding ? 1 : 0
  state.glide += (target - state.glide) * (1 - Math.exp(-(config.glideResponse ?? 3) * dt))
  // One impulse at mid-downstroke, followed by continuous drag through recovery/glide.
  // Integrate the decay on either side of the crossing, so 30/60/120 Hz agree.
  const decay = config.strokeDecay ?? 1.1
  state.thrust *= Math.exp(-decay * dt)
  if (!resting && state.clock > previousClock) {
    const impulsePhase = (config.downFraction ?? 0.38) * 0.5
    const first = Math.floor(previousClock / TAU - impulsePhase) + 1
    const last = Math.floor(state.clock / TAU - impulsePhase)
    for (let beat = first; beat <= last; beat += 1) {
      const remaining = dt * (state.clock - TAU * (beat + impulsePhase)) / (state.clock - previousClock)
      state.thrust += (config.strokeImpulse ?? 0) * Math.exp(-decay * remaining)
    }
  }
  state.speedScale = (config.glideSpeedScale ?? 1) + state.thrust
  return state
}
