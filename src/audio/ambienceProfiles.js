// Per-reserve ambience beds (docs/audio-redesign.md §2, §4). useOceanAudio builds one
// synthesised bed from the profile of the tank being viewed and crossfades to the next
// profile on a switch. `default` plays on the landing gate and the tank selector.
//
// Every bed is the same three synthesised layers, tuned per reserve, plus optional
// recorded layers:
//   noise   — 8 s brown-noise loop through a lowpass (`lowpass` Hz, Q in dB)
//   rumble  — sine at `frequency` Hz through a 90 Hz lowpass
//   crackle — snapping-shrimp-like snaps: sparse random clicks at `density` per second
//             (Poisson gaps, mostly faint, now and then a near one), through `highpass`
//             and `lowpass`, as two decorrelated mono loops panned to ±`width`.
//             null = none.
//   swell   — slow push and pull on the whole bed: one crest about every 1/`rate` s,
//             each with its own length (±30%) and depth (±40% of `depth`), so it never
//             reads as a sine LFO
//   tint    — the bed's underwater lowpass (Hz). It replaces the old 1600 Hz master
//             lowpass for the bed; raise it only where the bed has content up there
//             (crackle, recorded layers)
//   gain    — the whole bed, on top of the shared bed bus (AMBIENT_VOLUME)
//   files   — recorded loops to layer in when they exist: { src, gain, pan }, with
//             `src` the public path without extension (`/audio/beds/reef-crackle-a`).
//             The loader tries `${src}.webm` (Opus) then `${src}.m4a`. Empty until the
//             clips in docs/audio-redesign.md §3 are collected.
//
// Levels stay close to the pre-redesign bed (noise 0.95 + rumble 0.055 into 0.18, which
// `default` reproduces): the noise layer's loudness hardly moves with its lowpass, so the
// reserves differ in colour and movement, not volume. Crackle gains were set against a
// simulated render: reef crackle sits about 20 dB under the noise layer (RMS), shallows
// about 33 dB under.
//
// A Kelp Forest reserve (when it lands): surge-led swell (rate ~0.08, depth ~0.3) and a
// softer, lower crackle (highpass ~2000, lowpass ~5000), events tint ~0.85.
//
// events — the one-shot layer on top of the bed (src/audio/eventScheduler.js):
//   rates — mean events per minute for each archetype in EVENT_ARCHETYPES. Gaps are
//           exponential (a Poisson process), never shorter than the archetype's min gap,
//           and replies (call and response) come on top of these rates. Archetypes left
//           out never play in that reserve.
//   tint  — habitat tint on the virtual-distance lowpass (plan §4.5: shallows 1.15,
//           reef 1.0, kelp 0.85): fc = clamp(9000 · 2^(−d/8) · tint, 250, 16000).

export const DEFAULT_AMBIENCE_PROFILE_ID = 'default'

// One-shot archetypes. `minGapSeconds` floors the gap between two spontaneous events of
// the archetype; `fishCall` follows the time-of-day chorus (dawn and dusk ×1.6, night
// ×0.8); `answers` lets an event start a call-and-response chain.
export const EVENT_ARCHETYPES = {
  grunt: { minGapSeconds: 2.5, fishCall: true, answers: true },
  knock: { minGapSeconds: 3, fishCall: true, answers: true },
  thup: { minGapSeconds: 12, fishCall: true, answers: false },
  click: { minGapSeconds: 0.6, fishCall: true, answers: false },
  bubble: { minGapSeconds: 6, fishCall: false, answers: false },
  bloop: { minGapSeconds: 1.5, fishCall: false, answers: false },
}

export const AMBIENCE_PROFILES = {
  // The pre-redesign bed, unchanged in colour: landing gate and tank selector.
  default: {
    noise: { lowpass: 360, q: 0.46, gain: 0.95 },
    rumble: { frequency: 42, gain: 0.055 },
    crackle: null,
    swell: { rate: 0.18, depth: 0.11 },
    tint: 1600,
    gain: 1,
    files: [],
    // Very sparse bubbles under the landing gate and selector.
    events: { tint: 1, rates: { bubble: 0.5 } },
  },
  // Blue water: dark, low and sparse. A lower, slightly stronger rumble and a long,
  // shallow swell; nothing above the tint.
  'open-sea': {
    noise: { lowpass: 240, q: 0.46, gain: 0.9 },
    rumble: { frequency: 34, gain: 0.07 },
    crackle: null,
    swell: { rate: 0.06, depth: 0.07 },
    tint: 1100,
    gain: 0.95,
    files: [],
    // Near silent: a rare low thup (tuna-like) and the odd bubble.
    events: { tint: 0.9, rates: { thup: 0.6, bubble: 0.4, bloop: 0.3 } },
  },
  // A healthy reef crackles: dense snaps over a mid bed.
  'the-reefs': {
    noise: { lowpass: 420, q: 0.46, gain: 0.9 },
    rumble: { frequency: 44, gain: 0.05 },
    crackle: { density: 14, highpass: 2300, lowpass: 7500, gain: 0.9, width: 0.7 },
    swell: { rate: 0.14, depth: 0.1 },
    tint: 6500,
    gain: 1,
    files: [],
    // Most life: grunts and knocks that answer each other, clicks and bubbles.
    events: { tint: 1, rates: { grunt: 4, knock: 2.5, click: 6, bubble: 1, bloop: 2 } },
  },
  // A sunlit sand bay: brighter, with a stronger slow swell and only faint crackle.
  'the-shallows': {
    noise: { lowpass: 560, q: 0.46, gain: 0.88 },
    rumble: { frequency: 50, gain: 0.04 },
    crackle: { density: 4, highpass: 2500, lowpass: 6000, gain: 0.6, width: 0.5 },
    swell: { rate: 0.09, depth: 0.26 },
    tint: 4200,
    gain: 1,
    files: [],
    // Sparse clicks, bubble fizz over the seagrass and a rare grunt.
    events: { tint: 1.15, rates: { grunt: 0.5, click: 3, bubble: 2, bloop: 3 } },
  },
}

export function ambienceProfileIdFor(tankId) {
  return tankId && AMBIENCE_PROFILES[tankId] ? tankId : DEFAULT_AMBIENCE_PROFILE_ID
}
