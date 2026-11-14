// The event layer (docs/audio-redesign.md §4.2, §4.3, "Phase 2 status"): one-shot life
// sounds on top of the bed, so a reserve never sounds like a loop.
//
// - One self-rescheduling setTimeout drives everything; nothing runs per frame.
// - Each reserve's `events.rates` (src/audio/ambienceProfiles.js) gives events per minute
//   per archetype. Gaps are exponential (Poisson), floored by the archetype's min gap.
//   Rate changes (time of day, setEventActivity) use thinning: candidates are drawn at the
//   highest rate the ramp can reach and each is kept with probability rate(now) / ceiling,
//   so a ramp is followed smoothly without re-drawing on every change.
// - Call and response: a grunt or knock is answered 45% of the time 0.5–3 s later from a
//   different pan and pitch, a reply is answered again 20% of the time, never more than
//   3 calls in a chain.
// - Each event sits at a random virtual distance (2–25 m, weighted toward far) that sets
//   its lowpass and gain (plan §4.5, before the spatial voice pool of Phase 3).
// - A clip pool (src/audio/clipManifest.js) plays when it has decoded buffers; otherwise
//   the archetype's procedural synth voice plays, so the layer is audible today.
// - Skipped while muted, while the context is not running and while the page is hidden:
//   candidates that fall due then are dropped, never queued, so nothing bursts on return.
import { AMBIENCE_PROFILES, EVENT_ARCHETYPES } from './ambienceProfiles'
import { EVENT_CLIPS } from './clipManifest'
import { loadClip } from './clipLoader'
import {
  centsToRate,
  clamp,
  pickWithoutRepeat,
  randomGainJitter,
  randomSpread,
  startJitterSeconds,
} from './voiceVariation'

const FLAT_Q_DB = -3.01
const MAX_EVENT_VOICES = 6
const TICK_MIN_MS = 25
// The longest the timer sleeps, so a time-of-day change or a rate-0 reserve still ticks.
const TICK_MAX_MS = 5000
const IDLE_POLL_MS = 1000
const DAY_PHASE_RECHECK_MS = 60000
// Call and response, indexed by the chain position of the call being answered.
const REPLY_CHANCE = [0, 0.45, 0.2]
const REPLY_MAX_CHAIN = 3
const REPLY_DELAY_MIN_MS = 500
const REPLY_DELAY_RANGE_MS = 2500
// A reply sits 200–500 cents above or below its call, on the other side of the image.
const REPLY_PITCH_MIN_CENTS = 200
const REPLY_PITCH_RANGE_CENTS = 300
const REPLY_PITCH_LIMIT_CENTS = 700
const REPLY_PAN_MIN = 0.15
// Virtual distance: d = 2 + 23·√u metres (density rising with distance, mean ≈ 17 m).
const DISTANCE_MIN_M = 2
const DISTANCE_RANGE_M = 23
// D_oct = fogFar / 4 once Phase 3 wires the fog; fixed at 8 m until then.
const DISTANCE_OCTAVE_M = 8
const DISTANCE_GAIN_HALVING_M = 16
const DISTANCE_LOWPASS_BASE_HZ = 9000
const DISTANCE_LOWPASS_MIN_HZ = 250
const DISTANCE_LOWPASS_MAX_HZ = 16000
const EVENT_PAN_MAX = 0.5
const EVENT_PITCH_JITTER_CENTS = 50
// Time of day from the visitor's clock: dawn and dusk choruses, a quieter night.
const DAWN_HOURS = [5, 8]
const DUSK_HOURS = [17, 20]
const CHORUS_RATE_SCALE = 1.6
const NIGHT_RATE_SCALE = 0.8
const ACTIVITY_MAX = 4
// Synth voice envelope peaks, before the distance gain (2^(−d/16), ≈0.5 at the mean
// distance). Set against an offline render (loudest 50 ms RMS of 15 draws each, relative
// to the Reefs bed noise layer's RMS on the bed bus, about −42 dBFS): grunt about 0 dB
// median / +5 dB loudest, knock −3 / 0, thup −2 / 0, bloop and bubble about −12 / −7
// (above the bed's 420 Hz lowpass, so they still read), click about −23 / −12 (in the
// 2–5 kHz band, where only the crackle sits).
const SYNTH_LEVEL = {
  grunt: 0.04,
  knock: 0.07,
  thup: 0.05,
  click: 0.3,
  bloop: 0.03,
  bubble: 0.024,
}
const NOISE_BUFFER_SECONDS = 1

function createFilter(context, type, frequency, q = FLAT_Q_DB) {
  const filter = context.createBiquadFilter()
  filter.type = type
  filter.frequency.value = frequency
  filter.Q.value = q
  return filter
}

function createWhiteNoiseBuffer(context, seconds) {
  const buffer = context.createBuffer(1, Math.floor(context.sampleRate * seconds), context.sampleRate)
  const data = buffer.getChannelData(0)
  for (let index = 0; index < data.length; index += 1) data[index] = Math.random() * 2 - 1
  return buffer
}

export function dayPhaseRateScale(date = new Date()) {
  const hour = date.getHours()
  if ((hour >= DAWN_HOURS[0] && hour < DAWN_HOURS[1]) || (hour >= DUSK_HOURS[0] && hour < DUSK_HOURS[1])) {
    return CHORUS_RATE_SCALE
  }
  if (hour >= DUSK_HOURS[1] || hour < DAWN_HOURS[0]) return NIGHT_RATE_SCALE
  return 1
}

// Activity: a smoothed multiplier on every event rate (1 = normal). Phase 4's predator
// hush drives it down and lets it recover; it is module state so any caller can set it.
const activity = { from: 1, to: 1, startMs: 0, durationMs: 0 }
let liveScheduler = null

function activityAt(nowMs) {
  if (activity.durationMs <= 0 || nowMs >= activity.startMs + activity.durationMs) return activity.to
  const t = Math.max(0, (nowMs - activity.startMs) / activity.durationMs)
  return activity.from + (activity.to - activity.from) * t * t * (3 - 2 * t)
}

// Ramp the event activity to `multiplier` (0–4, 1 = normal) over `rampSeconds` along a
// smoothstep, starting from wherever the current ramp is.
export function setEventActivity(multiplier = 1, rampSeconds = 0) {
  const now = performance.now()
  activity.from = activityAt(now)
  activity.to = Number.isFinite(multiplier) ? clamp(multiplier, 0, ACTIVITY_MAX) : 1
  activity.startMs = now
  activity.durationMs = Math.max(0, (Number(rampSeconds) || 0) * 1000)
  liveScheduler?.resample(now)
}

export function getEventActivity() {
  return activityAt(performance.now())
}

// Voice bookkeeping: every source registers here, and the last one to end disconnects
// every node of the voice and frees its slot.
function addSource(voice, source) {
  voice.pending += 1
  voice.nodes.push(source)
  source.onended = voice.onSourceEnded
}

function addNode(voice, node) {
  voice.nodes.push(node)
  return node
}

// Grunt: a swim-bladder call. Triangle or sine at 50–300 Hz with a fast downward glide
// (×1.4 → ×1 in 30 ms, then down to ×0.78), a short band-passed noise burst at the onset,
// 80–250 ms, through a body lowpass at 5× the pitch (500–1500 Hz).
function playGrunt(context, voice, input, t0, f0, noiseBuffer) {
  const peak = SYNTH_LEVEL.grunt
  const duration = 0.08 + Math.random() * 0.17
  const body = addNode(voice, createFilter(context, 'lowpass', clamp(f0 * 5, 500, 1500), 1))
  body.connect(input)

  const osc = context.createOscillator()
  const env = addNode(voice, context.createGain())
  osc.type = Math.random() < 0.5 ? 'triangle' : 'sine'
  osc.frequency.setValueAtTime(f0 * 1.4, t0)
  osc.frequency.exponentialRampToValueAtTime(f0, t0 + 0.03)
  osc.frequency.exponentialRampToValueAtTime(f0 * 0.78, t0 + duration)
  env.gain.setValueAtTime(0.0001, t0)
  env.gain.exponentialRampToValueAtTime(peak, t0 + 0.012)
  env.gain.exponentialRampToValueAtTime(peak * 0.55, t0 + duration * 0.6)
  env.gain.exponentialRampToValueAtTime(0.0001, t0 + duration)
  osc.connect(env)
  env.connect(body)
  addSource(voice, osc)
  osc.start(t0)
  osc.stop(t0 + duration + 0.02)

  const noise = context.createBufferSource()
  const band = addNode(voice, createFilter(context, 'bandpass', clamp(f0 * 3, 200, 900), 1))
  const noiseEnv = addNode(voice, context.createGain())
  noise.buffer = noiseBuffer
  noiseEnv.gain.setValueAtTime(0.0001, t0)
  noiseEnv.gain.exponentialRampToValueAtTime(peak * 0.5, t0 + 0.004)
  noiseEnv.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.03)
  noise.connect(band)
  band.connect(noiseEnv)
  noiseEnv.connect(body)
  addSource(voice, noise)
  noise.start(t0, Math.random() * (NOISE_BUFFER_SECONDS - 0.1), 0.04)
}

// Knock: 1–3 short low thumps (sine at 80–180 Hz, dropping from ×1.5 in 15 ms, 2 ms
// attack, gone in `decay` s) 90–160 ms apart, each a little lower and quieter, with a
// lowpassed noise tick on each hit. A thup is a single, lower, longer knock.
function playKnock(context, voice, input, t0, f0, noiseBuffer, { hits, decay, peak }) {
  const osc = context.createOscillator()
  const env = addNode(voice, context.createGain())
  const tick = context.createBufferSource()
  const tickFilter = addNode(voice, createFilter(context, 'lowpass', 900))
  const tickEnv = addNode(voice, context.createGain())
  osc.type = 'sine'
  env.gain.setValueAtTime(0.0001, t0)
  tickEnv.gain.setValueAtTime(0.0001, t0)

  let hitAt = t0
  for (let hit = 0; hit < hits; hit += 1) {
    if (hit > 0) hitAt += 0.09 + Math.random() * 0.07
    const frequency = f0 * (1 - 0.04 * hit)
    const level = peak * 0.8 ** hit
    osc.frequency.setValueAtTime(frequency * 1.5, hitAt)
    osc.frequency.exponentialRampToValueAtTime(frequency, hitAt + 0.015)
    env.gain.setValueAtTime(0.0001, hitAt)
    env.gain.exponentialRampToValueAtTime(level, hitAt + 0.002)
    env.gain.exponentialRampToValueAtTime(0.0001, hitAt + decay)
    tickEnv.gain.setValueAtTime(0.0001, hitAt)
    tickEnv.gain.exponentialRampToValueAtTime(level * 0.35, hitAt + 0.001)
    tickEnv.gain.exponentialRampToValueAtTime(0.0001, hitAt + 0.012)
  }
  const endAt = hitAt + decay + 0.02

  osc.connect(env)
  env.connect(input)
  addSource(voice, osc)
  osc.start(t0)
  osc.stop(endAt)

  tick.buffer = noiseBuffer
  tick.connect(tickFilter)
  tickFilter.connect(tickEnv)
  tickEnv.connect(input)
  addSource(voice, tick)
  tick.start(t0, Math.random() * (NOISE_BUFFER_SECONDS - 0.5), endAt - t0)
}

// Click: a band-passed noise impulse at 2–5 kHz (Q 2.5), 5–15 ms.
function playClick(context, voice, input, t0, f0, noiseBuffer) {
  const peak = SYNTH_LEVEL.click
  const duration = 0.005 + Math.random() * 0.01
  const noise = context.createBufferSource()
  const band = addNode(voice, createFilter(context, 'bandpass', f0, 2.5))
  const env = addNode(voice, context.createGain())
  noise.buffer = noiseBuffer
  env.gain.setValueAtTime(0.0001, t0)
  env.gain.exponentialRampToValueAtTime(peak, t0 + 0.0008)
  env.gain.exponentialRampToValueAtTime(0.0001, t0 + duration)
  noise.connect(band)
  band.connect(env)
  env.connect(input)
  addSource(voice, noise)
  noise.start(t0, Math.random() * (NOISE_BUFFER_SECONDS - 0.1), duration + 0.01)
}

// Bloop: one bubble. A sine sweeping up from f0 (300–500 Hz) to 2.4–3.2× (at most
// 1400 Hz) over 40–120 ms, 2 ms attack and an exponential decay.
function playBloop(context, voice, input, t0, f0, peak) {
  const duration = 0.04 + Math.random() * 0.08
  const osc = context.createOscillator()
  const env = addNode(voice, context.createGain())
  osc.type = 'sine'
  osc.frequency.setValueAtTime(f0, t0)
  osc.frequency.exponentialRampToValueAtTime(Math.min(1400, f0 * (2.4 + Math.random() * 0.8)), t0 + duration)
  env.gain.setValueAtTime(0.0001, t0)
  env.gain.exponentialRampToValueAtTime(peak, t0 + 0.002)
  env.gain.exponentialRampToValueAtTime(0.0001, t0 + duration)
  osc.connect(env)
  env.connect(input)
  addSource(voice, osc)
  osc.start(t0)
  osc.stop(t0 + duration + 0.01)
}

// Bubble: a quick rising cluster of 3–8 bloops, 25–90 ms apart, each 5–15% higher.
function playBubble(context, voice, input, t0, f0) {
  const count = 3 + Math.floor(Math.random() * 6)
  let at = t0
  let frequency = f0
  for (let index = 0; index < count; index += 1) {
    playBloop(context, voice, input, at, frequency, SYNTH_LEVEL.bubble * (0.6 + 0.4 * Math.random()))
    at += 0.025 + Math.random() * 0.065
    frequency *= 1.05 + Math.random() * 0.1
  }
}

// Synth voices by archetype: `base` picks a call's pitch, `range` clamps it after the
// per-voice cents (replies shift it by 200–500 cents).
const SYNTH_VOICES = {
  grunt: {
    base: () => 60 * 2 ** (Math.random() * 2.2),
    range: [50, 300],
    play: (context, voice, input, t0, f0, noise) => playGrunt(context, voice, input, t0, f0, noise),
  },
  knock: {
    base: () => 80 + Math.random() * 100,
    range: [80, 180],
    play: (context, voice, input, t0, f0, noise) => {
      const roll = Math.random()
      const hits = roll < 0.45 ? 1 : roll < 0.8 ? 2 : 3
      playKnock(context, voice, input, t0, f0, noise, { hits, decay: 0.08, peak: SYNTH_LEVEL.knock })
    },
  },
  thup: {
    base: () => 55 + Math.random() * 55,
    range: [50, 120],
    play: (context, voice, input, t0, f0, noise) => playKnock(context, voice, input, t0, f0, noise, { hits: 1, decay: 0.18, peak: SYNTH_LEVEL.thup }),
  },
  click: {
    base: () => 2000 * 2 ** (Math.random() * 1.32),
    range: [2000, 5000],
    play: (context, voice, input, t0, f0, noise) => playClick(context, voice, input, t0, f0, noise),
  },
  bloop: {
    base: () => 300 + Math.random() * 200,
    range: [300, 500],
    play: (context, voice, input, t0, f0) => playBloop(context, voice, input, t0, f0, SYNTH_LEVEL.bloop),
  },
  bubble: {
    base: () => 300 + Math.random() * 150,
    range: [300, 500],
    play: (context, voice, input, t0, f0) => playBubble(context, voice, input, t0, f0),
  },
}

function replyPan(callPan) {
  const side = callPan > 0 ? -1 : callPan < 0 ? 1 : (Math.random() < 0.5 ? -1 : 1)
  return side * (REPLY_PAN_MIN + Math.random() * (EVENT_PAN_MAX - REPLY_PAN_MIN))
}

export function createEventScheduler(context, output, { canPlay }) {
  const noiseBuffer = createWhiteNoiseBuffer(context, NOISE_BUFFER_SECONDS)
  const nextAt = {}
  const rateUsed = {}
  const lastAt = {}
  const replies = []
  const clipCache = new Map()
  const clipPools = {}
  const stats = {
    fired: {},
    replies: 0,
    capped: 0,
    thinned: 0,
    dropped: 0,
    activeVoices: 0,
    peakVoices: 0,
    voicesStarted: 0,
    voicesFinished: 0,
    oscillators: 0,
    clipVoices: 0,
  }
  let currentProfileId = null
  let archetypes = []
  let rates = {}
  let tint = 1
  let timer = null
  let voices = 0
  let dayScale = dayPhaseRateScale()
  let dayCheckedAt = performance.now()
  let disposed = false

  const minGapMs = archetype => (EVENT_ARCHETYPES[archetype]?.minGapSeconds ?? 0) * 1000

  // Rate before activity: the profile's rate, times the chorus scale for fish calls.
  const baseRate = archetype => {
    const rate = rates[archetype] ?? 0
    return EVENT_ARCHETYPES[archetype]?.fishCall ? rate * dayScale : rate
  }

  // Draw the next candidate at the highest rate the current activity ramp can reach,
  // never before the archetype's min gap since its last event.
  function sampleNext(archetype, now) {
    const ceiling = baseRate(archetype) * Math.max(activityAt(now), activity.to)
    rateUsed[archetype] = ceiling
    if (!(ceiling > 0)) {
      nextAt[archetype] = Infinity
      return
    }
    const gapMs = -Math.log(1 - Math.random()) * 60000 / ceiling
    nextAt[archetype] = Math.max((lastAt[archetype] ?? -Infinity) + minGapMs(archetype), now + gapMs)
  }

  // Exponential gaps are memoryless, so re-drawing every pending candidate is exact.
  function resample(now = performance.now()) {
    for (let index = 0; index < archetypes.length; index += 1) sampleNext(archetypes[index], now)
    arm(now)
  }

  function loadPool(archetype) {
    const sources = EVENT_CLIPS[archetype]
    if (clipPools[archetype] || !sources?.length) return
    const pool = { buffers: [], last: -1 }
    clipPools[archetype] = pool
    Promise.all(sources.map(src => loadClip(context, clipCache, src, undefined, 'Event clip')))
      .then(buffers => {
        pool.buffers = buffers.filter(Boolean)
      })
      .catch(error => console.warn(`Event clips failed to load: ${archetype}`, error))
  }

  function playVoice(archetype, call) {
    const synth = SYNTH_VOICES[archetype]
    if (!synth) return null
    if (voices >= MAX_EVENT_VOICES) {
      stats.capped += 1
      return null
    }

    const distance = DISTANCE_MIN_M + DISTANCE_RANGE_M * Math.sqrt(Math.random())
    const pan = call ? replyPan(call.pan) : randomSpread(EVENT_PAN_MAX)
    let cents = randomSpread(EVENT_PITCH_JITTER_CENTS)
    if (call) {
      // Shift toward the side of the voice's range with room, so the synth clamp cannot
      // pull the reply back onto the call's pitch.
      const shift = REPLY_PITCH_MIN_CENTS + Math.random() * REPLY_PITCH_RANGE_CENTS
      const callFrequency = call.baseFrequency * centsToRate(call.cents)
      const roomUp = 1200 * Math.log2(synth.range[1] / callFrequency)
      const roomDown = 1200 * Math.log2(callFrequency / synth.range[0])
      let direction = Math.random() < 0.5 ? -1 : 1
      if ((direction > 0 ? roomUp : roomDown) < shift) direction = roomUp >= roomDown ? 1 : -1
      cents = clamp(call.cents + direction * shift, -REPLY_PITCH_LIMIT_CENTS, REPLY_PITCH_LIMIT_CENTS)
    }
    const baseFrequency = call ? call.baseFrequency : synth.base()
    const t0 = context.currentTime + startJitterSeconds()
    const cutoff = clamp(DISTANCE_LOWPASS_BASE_HZ * 2 ** (-distance / DISTANCE_OCTAVE_M) * tint, DISTANCE_LOWPASS_MIN_HZ, DISTANCE_LOWPASS_MAX_HZ)
    const level = 2 ** (-distance / DISTANCE_GAIN_HALVING_M) * randomGainJitter()

    const voice = { nodes: [], pending: 0, onSourceEnded: null, pan, cents, baseFrequency }
    voice.onSourceEnded = () => {
      voice.pending -= 1
      if (voice.pending > 0) return
      for (let index = 0; index < voice.nodes.length; index += 1) {
        try {
          voice.nodes[index].disconnect()
        } catch {
          // Already disconnected.
        }
      }
      voice.nodes.length = 0
      voices -= 1
      stats.activeVoices = voices
      stats.voicesFinished += 1
    }

    // Distance lowpass → gain → narrow pan → event bus.
    const lowpass = addNode(voice, createFilter(context, 'lowpass', cutoff))
    const gain = addNode(voice, context.createGain())
    gain.gain.value = level
    lowpass.connect(gain)
    const panner = typeof context.createStereoPanner === 'function' ? context.createStereoPanner() : null
    if (panner) {
      panner.pan.value = pan
      addNode(voice, panner)
      gain.connect(panner)
      panner.connect(output)
    } else {
      gain.connect(output)
    }

    voices += 1
    const pool = clipPools[archetype]
    try {
      if (pool?.buffers.length) {
        pool.last = pickWithoutRepeat(pool.buffers.length, pool.last)
        const source = context.createBufferSource()
        source.buffer = pool.buffers[pool.last]
        source.playbackRate.value = centsToRate(cents)
        source.connect(lowpass)
        addSource(voice, source)
        source.start(t0)
        stats.clipVoices += 1
      } else {
        const frequency = clamp(baseFrequency * centsToRate(cents), synth.range[0], synth.range[1])
        synth.play(context, voice, lowpass, t0, frequency, noiseBuffer)
      }
    } catch (error) {
      // Sources already started still end and release the voice; with none, release it here.
      console.warn(`Event voice failed: ${archetype}`, error)
      if (voice.pending === 0) {
        voice.pending = 1
        voice.onSourceEnded()
      }
      return null
    }

    stats.activeVoices = voices
    stats.peakVoices = Math.max(stats.peakVoices, voices)
    stats.voicesStarted += 1
    for (let index = 0; index < voice.nodes.length; index += 1) {
      const node = voice.nodes[index]
      if (typeof node.start === 'function' && 'frequency' in node) stats.oscillators += 1
    }
    return voice
  }

  function fire(archetype, depth, call, now) {
    lastAt[archetype] = now
    const voice = playVoice(archetype, call)
    if (!voice) return
    stats.fired[archetype] = (stats.fired[archetype] ?? 0) + 1
    if (depth > 1) stats.replies += 1
    if (!EVENT_ARCHETYPES[archetype]?.answers || depth >= REPLY_MAX_CHAIN) return
    if (Math.random() >= REPLY_CHANCE[depth] * Math.min(1, activityAt(now))) return
    replies.push({
      atMs: now + REPLY_DELAY_MIN_MS + Math.random() * REPLY_DELAY_RANGE_MS,
      archetype,
      depth: depth + 1,
      pan: voice.pan,
      cents: voice.cents,
      baseFrequency: voice.baseFrequency,
    })
  }

  function arm(now) {
    if (disposed) return
    let earliest = Infinity
    for (let index = 0; index < archetypes.length; index += 1) earliest = Math.min(earliest, nextAt[archetypes[index]])
    for (let index = 0; index < replies.length; index += 1) earliest = Math.min(earliest, replies[index].atMs)
    const delay = clamp(earliest - now, TICK_MIN_MS, TICK_MAX_MS)
    if (timer) window.clearTimeout(timer)
    timer = window.setTimeout(tick, delay)
  }

  function tick() {
    timer = null
    if (disposed) return
    const now = performance.now()

    if (!canPlay()) {
      // Muted, suspended or hidden: drop whatever falls due rather than queueing it.
      stats.dropped += replies.length
      replies.length = 0
      for (let index = 0; index < archetypes.length; index += 1) {
        if (nextAt[archetypes[index]] <= now) {
          stats.dropped += 1
          sampleNext(archetypes[index], now)
        }
      }
      timer = window.setTimeout(tick, IDLE_POLL_MS)
      return
    }

    // Re-arm even if a voice throws, so one bad event cannot silence the layer for good.
    try {
      fireDue(now)
    } catch (error) {
      console.warn('Event scheduler tick failed', error)
    }
    arm(now)
  }

  function fireDue(now) {
    if (now - dayCheckedAt >= DAY_PHASE_RECHECK_MS) {
      dayCheckedAt = now
      const nextScale = dayPhaseRateScale()
      if (nextScale !== dayScale) {
        dayScale = nextScale
        for (let index = 0; index < archetypes.length; index += 1) sampleNext(archetypes[index], now)
      }
    }

    for (let index = 0; index < replies.length;) {
      const reply = replies[index]
      if (reply.atMs > now) {
        index += 1
        continue
      }
      replies.splice(index, 1)
      fire(reply.archetype, reply.depth, reply, now)
    }

    const level = activityAt(now)
    for (let index = 0; index < archetypes.length; index += 1) {
      const archetype = archetypes[index]
      if (nextAt[archetype] > now) continue
      const ceiling = rateUsed[archetype]
      const keep = ceiling > 0 ? baseRate(archetype) * level / ceiling : 0
      const clear = now >= (lastAt[archetype] ?? -Infinity) + minGapMs(archetype)
      if (clear && Math.random() < keep) fire(archetype, 1, null, now)
      else stats.thinned += 1
      sampleNext(archetype, now)
    }
  }

  // Follow a reserve: new rates from now; replies still pending from the old reserve are
  // dropped, voices already sounding finish on their own.
  function setProfile(profileId) {
    if (profileId === currentProfileId) return
    currentProfileId = profileId
    const events = AMBIENCE_PROFILES[profileId]?.events
    rates = events?.rates ?? {}
    tint = events?.tint ?? 1
    archetypes = Object.keys(rates).filter(archetype => SYNTH_VOICES[archetype])
    replies.length = 0
    archetypes.forEach(loadPool)
    for (const key of Object.keys(nextAt)) {
      if (!rates[key]) delete nextAt[key]
    }
    resample(performance.now())
  }

  // Play one event now (Phase 4 hooks and checks), with its distance, pan and pitch drawn
  // as usual. Returns false when the voice cap is full or the archetype is unknown.
  function trigger(archetype) {
    if (disposed || !canPlay()) return false
    return Boolean(playVoice(archetype, null))
  }

  function dispose() {
    disposed = true
    if (timer) window.clearTimeout(timer)
    timer = null
    replies.length = 0
    if (liveScheduler === scheduler) liveScheduler = null
  }

  const scheduler = { setProfile, resample, trigger, dispose, stats }
  liveScheduler = scheduler
  return scheduler
}
