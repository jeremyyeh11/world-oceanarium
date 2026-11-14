// Per-voice variation (docs/audio-redesign.md §4.3), shared by the event layer and the
// fish swim SFX: no immediate repeat of a sample, a random pitch and gain spread, a small
// start jitter, and for fish a stable per-creature pitch bias plus a size offset.
import { hashString } from '../utils/hash'

export const START_JITTER_MIN_SECONDS = 0.005
export const START_JITTER_RANGE_SECONDS = 0.015
export const GAIN_JITTER_DB = 3
// Each fish keeps its own voice: hashString(creatureId) biases its pitch within ±40 cents,
// so the same angelfish always sounds like itself, without locking it to one sample.
const FISH_SEED_BIAS_CENTS = 40
// Bigger is lower: −150 cents per doubling of body length from 0.4 m, clamped to
// −300…+100 cents (a 27 cm sardinella about +85, a 1 m grouper about −200, anything
// from about 1.6 m up −300).
const FISH_SIZE_REFERENCE_METERS = 0.4
const FISH_SIZE_CENTS_PER_DOUBLING = -150
const FISH_SIZE_CENTS_MIN = -300
const FISH_SIZE_CENTS_MAX = 100

export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value))
}

// A uniform index in [0, count) that is never `previous` (when count > 1).
export function pickWithoutRepeat(count, previous = -1) {
  if (count <= 1) return 0
  if (previous < 0 || previous >= count) return Math.floor(Math.random() * count)
  const index = Math.floor(Math.random() * (count - 1))
  return index >= previous ? index + 1 : index
}

export function randomSpread(range) {
  return (Math.random() * 2 - 1) * range
}

export function centsToRate(cents) {
  return 2 ** (cents / 1200)
}

export function dbToGain(db) {
  return 10 ** (db / 20)
}

export function randomGainJitter() {
  return dbToGain(randomSpread(GAIN_JITTER_DB))
}

// Cut-only variant for sounds already near full scale (fish swims): −3…0 dB.
export function randomGainCut() {
  return dbToGain(-Math.random() * GAIN_JITTER_DB)
}

export function startJitterSeconds() {
  return START_JITTER_MIN_SECONDS + Math.random() * START_JITTER_RANGE_SECONDS
}

export function fishVoiceCents(creatureId, bodyLengthMeters) {
  const seed = hashString(String(creatureId ?? 'fish'))
  const bias = ((seed % 2001) / 1000 - 1) * FISH_SEED_BIAS_CENTS
  if (!(bodyLengthMeters > 0)) return bias
  const size = clamp(
    FISH_SIZE_CENTS_PER_DOUBLING * Math.log2(bodyLengthMeters / FISH_SIZE_REFERENCE_METERS),
    FISH_SIZE_CENTS_MIN,
    FISH_SIZE_CENTS_MAX,
  )
  return bias + size
}
