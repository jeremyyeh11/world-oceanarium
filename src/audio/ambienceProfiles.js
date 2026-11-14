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
//   files   — the mix of the recorded bed layers, by clip id: { gain, pan }. Which clips
//             a reserve's bed plays comes from src/audio/clipCatalog.json (`use`
//             `bed:<profile id>`, wired in src/audio/clipUses.js), never from here; this
//             only sets their level and pan (src/audio/clipManifest.js `bedLayersFor`).
//             Each file loops between the catalog's `loop` points from a random start
//             inside the loop, and fades in once it has decoded (WebM/Opus, then m4a).
//             Beds are all -20 LUFS integrated, so these gains are the balance.
//   withFiles — the synthesised layers' gains once a recorded layer is playing
//             ({ noise, rumble, crackle }, each optional): the synth parts the
//             recordings duplicate are lowered or removed, and ramp there as the first
//             recorded layer fades in. Until then (or if every file fails to load) the
//             bed plays its full synth layers, so a missing file never thins it.
//
// Levels stay close to the pre-redesign bed (noise 0.95 + rumble 0.055 into 0.18, which
// `default` reproduces): the noise layer's loudness hardly moves with its lowpass, so the
// reserves differ in colour and movement, not volume. Crackle gains were set against a
// simulated render: reef crackle sits about 20 dB under the noise layer (RMS), shallows
// about 33 dB under.
//
// Recorded layers (v0.51.0-dev_3) were mixed against an offline render of this chain
// (30 s, no drift or swell, approximate K-weighting, on the bed bus): each bed's total
// stays within 0.4 LU of its synth-only dev_2 bed (Open Sea −38.9 → −39.3, Reefs −38.3 →
// −38.3, Shallows −38.8 → −38.7), and no recording louder than the synth noise layer it
// shares the bed with (Korcula and the surf within 1 LU of it, the rest 3–8 LU under;
// per layer in docs/audio-redesign.md, "Recorded clips"). In the Reefs the real shrimp replace the procedural
// crackle (withFiles crackle 0) and the two shrimp beds sit apart (±0.6); Gray's Reef and
// Hvar are heavily limited in the build, so they stay the lowest. Never heard.
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
    files: {},
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
    // Korcula open water, dark under the 1100 Hz tint; the rumble stays as it was, the
    // noise drops to make room.
    files: {
      'open-water-korcula': { gain: 0.38, pan: 0 },
    },
    withFiles: { noise: 0.6 },
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
    // Two shrimp beds panned apart and the Gray's Reef chorus centred replace the
    // procedural crackle; noise and rumble stay, a little lower, as glue. Hvar and Gray's
    // Reef are heavily limited, so they sit lowest.
    files: {
      'reef-shrimp-hvar': { gain: 0.19, pan: -0.6 },
      'reef-shrimp-aberwrach': { gain: 0.3, pan: 0.6 },
      'reef-soundscape-grays': { gain: 0.3, pan: 0 },
    },
    withFiles: { noise: 0.7, rumble: 0.045, crackle: 0 },
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
    // Surf wash and a bubble trickle over a lower noise layer; the faint crackle stays.
    files: {
      'shallows-surf': { gain: 0.3, pan: 0 },
      'shallows-bubble-flow': { gain: 0.2, pan: 0 },
    },
    withFiles: { noise: 0.6 },
    // Sparse clicks, bubble fizz over the seagrass and a rare grunt.
    events: { tint: 1.15, rates: { grunt: 0.5, click: 3, bubble: 2, bloop: 3 } },
  },
}

export function ambienceProfileIdFor(tankId) {
  return tankId && AMBIENCE_PROFILES[tankId] ? tankId : DEFAULT_AMBIENCE_PROFILE_ID
}
