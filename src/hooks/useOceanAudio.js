import { useCallback, useEffect, useRef, useState } from 'react'
import { AMBIENCE_PROFILES, ambienceProfileIdFor } from '../audio/ambienceProfiles'
import { loadAudioBuffer, loadClip } from '../audio/clipLoader'
import { bedLayersFor, FISH_SFX_URLS, UI_SFX_URLS } from '../audio/clipManifest'
import { createEventScheduler } from '../audio/eventScheduler'
import { centsToRate, fishVoiceCents, pickWithoutRepeat, randomGainCut, randomSpread, startJitterSeconds } from '../audio/voiceVariation'

const AUDIO_VOLUME_EVENT = 'world-oceanarium-audio-volume'
const FISH_SWIM_SFX_EVENT = 'world-oceanarium-fish-swim-sfx'
const UI_CLICK_SFX_EVENT = 'world-oceanarium-ui-click-sfx'
const LEVEL_FLOOR_DB = -72
const LEVEL_FRAME_MS = 100
let audioLevelSubscribers = 0
const DEBUG_AUDIO_UI_SAMPLE_MS = 1000
const AUDIO_UI_DB_STEP = 2
const MOBILE_MASTER_TARGET_GAIN = 2.0 // Jeremy requested roughly 2x overall loudness on mobile.
const DESKTOP_MASTER_TARGET_GAIN = MOBILE_MASTER_TARGET_GAIN * 0.5
const AMBIENT_VOLUME = 0.18
const SFX_VOLUME = 1.0
const AUDIO_FADE_SECONDS = 0.45
const AUDIO_SUSPEND_AFTER_FADE_MS = 560
const FOLLOW_MODE_SFX_BOOST = 4.5
// Global throttle on swim SFX. Ambient (non-followed) swim sounds are occasional
// texture, so keep a long gap; the followed creature stays responsive on a short gap.
const SFX_AMBIENT_MIN_GAP_SECONDS = 1.15
const SFX_FOLLOW_MIN_GAP_SECONDS = 0.3
const UI_SFX_MIN_GAP_SECONDS = 0.035
// Bus layout (docs/audio-redesign.md §5): beds → bedBus → worldBus → master, fish SFX →
// worldBus, UI → uiBus → master (dry of anything habitat-specific). The underwater tint
// used to be one 1600 Hz lowpass on the master; it now lives in each chain, and the master
// keeps only a 12 kHz guard. The SFX and UI tints copy the old master filter exactly, so
// swims and clicks sound as before.
const MASTER_LOWPASS_HZ = 12000
// Everything heard "in the water" (beds, fish swims, events) shares one underwater lowpass
// on the world bus, two flat biquads in series (24 dB/oct), so the whole mix sounds muffled
// the way sound does underwater (Jeremy, v0.51.0-dev_4). UI clicks skip it and keep their
// own 1600 Hz tint.
const UNDERWATER_LOWPASS_HZ = 1200
const LEGACY_TINT_HZ = 1600
const LEGACY_TINT_Q = 0.36
// Lowpass/highpass Q is in dB for BiquadFilterNode: -3.01 dB is a flat (Butterworth) knee.
const FLAT_Q_DB = -3.01
// Bed crossfade on a tank switch; the old chain is stopped and disconnected once it is silent.
const BED_CROSSFADE_SECONDS = 2
const BED_RETIRE_AFTER_MS = BED_CROSSFADE_SECONDS * 1000 + 250
const BED_FILE_FADE_IN_SECONDS = 1.5
// Beds never loop audibly: a slow random walk on each bed's level (±2 dB) and filters
// (±0.3 octave), retargeted every 3–5 s with setTargetAtTime by one timeout scheduler
// (nothing per frame). The walk is pulled gently back toward the profile's value.
const BED_DRIFT_MIN_MS = 3000
const BED_DRIFT_RANGE_MS = 2000
const BED_DRIFT_GAIN_DB = 2
const BED_DRIFT_GAIN_STEP_DB = 0.8
const BED_DRIFT_OCTAVES = 0.3
const BED_DRIFT_OCTAVE_STEP = 0.12
const BED_DRIFT_PULL = 0.85
const BED_DRIFT_TAU_MIN_SECONDS = 1.2
const BED_DRIFT_TAU_RANGE_SECONDS = 1.2
// Swell events are scheduled this far ahead of the scheduler, so a late tick never leaves a gap.
const BED_SWELL_HORIZON_SECONDS = 7
const BED_RUMBLE_LOWPASS_HZ = 90
// Two crackle loops of mismatched length (one per side), so the L/R pattern never lines up.
const CRACKLE_LOOP_SECONDS = [7.3, 9.7]
const CRACKLE_SNAP_MIN_SECONDS = 0.0004
const CRACKLE_SNAP_RANGE_SECONDS = 0.0012
const BED_FILE_FORMATS = ['webm', 'm4a']
// The event layer (src/audio/eventScheduler.js) → eventBus → worldBus. Its synth voices
// set their own levels; this is the one knob for the whole layer.
const EVENT_BUS_GAIN = 1
// Fish swim SFX keep a smaller random spread than events, so each fish's stable voice
// bias (±40 cents, fishVoiceCents) stays audible.
const FISH_SFX_PITCH_JITTER_CENTS = 30
// The older MP3s (fish-sfx/, ui-sfx/), listed in src/audio/clipCatalog.json and loaded at
// the first gesture as before.
const FISH_SFX_ASSETS = FISH_SFX_URLS
const UI_SFX_ASSETS = UI_SFX_URLS

function createAudioContext() {
  const AudioContextClass = window.AudioContext ?? window.webkitAudioContext
  if (!AudioContextClass) return null
  try {
    return new AudioContextClass({ latencyHint: 'interactive' })
  } catch {
    // Older iOS Safari builds can reject constructor options even when
    // webkitAudioContext itself is available.
    return new AudioContextClass()
  }
}

function setAudioSessionType(type) {
  const audioSession = navigator?.audioSession
  if (!audioSession || typeof audioSession !== 'object' || !('type' in audioSession)) return false

  try {
    audioSession.type = type
    return audioSession.type === type
  } catch {
    return false
  }
}

function requestMediaPlaybackSession() {
  // iOS Safari can route generic Web Audio like UI/ringer audio. Playback mode
  // asks the browser to treat the tank soundscape like music/video media instead.
  return setAudioSessionType('playback')
}

function releaseMediaPlaybackSession() {
  // When the tank is hidden/backgrounded, do not keep claiming a playback
  // session. This avoids Safari showing Oceanarium as active media and lets
  // other music own the phone audio session.
  return setAudioSessionType('ambient') || setAudioSessionType('auto')
}

function getMasterTargetGain() {
  if (typeof window === 'undefined') return DESKTOP_MASTER_TARGET_GAIN

  const coarsePointer = window.matchMedia?.('(pointer: coarse)')?.matches ?? false
  const touchCapable = navigator.maxTouchPoints > 0
  return coarsePointer || touchCapable ? MOBILE_MASTER_TARGET_GAIN : DESKTOP_MASTER_TARGET_GAIN
}

function unlockAudioContext(context) {
  if (!context) return Promise.resolve(false)

  const playSilentPulse = () => {
    const buffer = context.createBuffer(1, 1, context.sampleRate)
    const source = context.createBufferSource()
    const gain = context.createGain()
    source.buffer = buffer
    gain.gain.value = 0.000001
    source.connect(gain)
    gain.connect(context.destination)
    source.start(0)
  }

  try {
    // iOS Safari is most reliable when a source node is started during the
    // actual touch event, not only when resume() is requested.
    playSilentPulse()
  } catch {
    // Unlock pulse is best-effort.
  }

  if (context.state === 'running') return Promise.resolve(true)

  return Promise.resolve(context.resume?.())
    .then(() => {
      try {
        playSilentPulse()
      } catch {
        // Best-effort second pulse after resume.
      }
      return context.state === 'running'
    })
    .catch(() => false)
}

function createNoiseBuffer(context, seconds = 8) {
  const sampleRate = context.sampleRate
  const buffer = context.createBuffer(1, sampleRate * seconds, sampleRate)
  const data = buffer.getChannelData(0)
  let drift = 0

  for (let index = 0; index < data.length; index += 1) {
    drift = drift * 0.985 + (Math.random() * 2 - 1) * 0.015
    const fine = (Math.random() * 2 - 1) * 0.08
    data[index] = drift + fine
  }

  return buffer
}

function dbFromAnalyser(analyser, scratch) {
  if (!analyser || !scratch) return LEVEL_FLOOR_DB
  analyser.getFloatTimeDomainData(scratch)

  let sum = 0
  for (let index = 0; index < scratch.length; index += 1) {
    const sample = scratch[index]
    sum += sample * sample
  }

  const rms = Math.sqrt(sum / scratch.length)
  if (!Number.isFinite(rms) || rms <= 0.000001) return LEVEL_FLOOR_DB
  return Math.max(LEVEL_FLOOR_DB, Math.min(0, 20 * Math.log10(rms)))
}

function connectAnalyser(context, input, output) {
  const analyser = context.createAnalyser()
  analyser.fftSize = 1024
  analyser.smoothingTimeConstant = 0.82
  input.connect(analyser)
  analyser.connect(output)
  return analyser
}

function createFilter(context, type, frequency, q = FLAT_Q_DB) {
  const filter = context.createBiquadFilter()
  filter.type = type
  filter.frequency.value = frequency
  filter.Q.value = q
  return filter
}

function createGain(context, value) {
  const gain = context.createGain()
  gain.gain.value = value
  return gain
}

// Older Safari has no StereoPannerNode; those builds play the layer centred.
function createPan(context, pan) {
  if (!pan || typeof context.createStereoPanner !== 'function') return null
  const panner = context.createStereoPanner()
  panner.pan.value = pan
  return panner
}

function suspendAudioContext(context) {
  try {
    Promise.resolve(context?.suspend?.()).catch(() => {})
  } catch {
    // Suspend is best-effort; the master is already faded out.
  }
}

// Snapping-shrimp-like crackle: sparse broadband clicks with Poisson gaps, mostly faint,
// now and then a near one. Rendered once per profile and side, then looped.
function createCrackleBuffer(context, density, seconds) {
  const sampleRate = context.sampleRate
  const buffer = context.createBuffer(1, Math.floor(sampleRate * seconds), sampleRate)
  const data = buffer.getChannelData(0)
  const nextGap = () => -Math.log(1 - Math.random()) / density

  for (let time = nextGap(); time < seconds; time += nextGap()) {
    const start = Math.floor(time * sampleRate)
    const length = Math.max(1, Math.floor(sampleRate * (CRACKLE_SNAP_MIN_SECONDS + Math.random() * CRACKLE_SNAP_RANGE_SECONDS)))
    const amplitude = (0.15 + 0.85 * Math.random() ** 4) * (Math.random() < 0.5 ? -1 : 1)
    for (let index = 0; index < length && start + index < data.length; index += 1) {
      data[start + index] += amplitude * (Math.random() * 2 - 1) * Math.exp(-5 * index / length)
    }
  }

  return buffer
}

function crackleBuffersFor(context, graph, profileId, density) {
  let buffers = graph.crackleBuffers.get(profileId)
  if (!buffers) {
    buffers = CRACKLE_LOOP_SECONDS.map(seconds => createCrackleBuffer(context, density, seconds))
    graph.crackleBuffers.set(profileId, buffers)
  }
  return buffers
}

// Recorded bed layers: Opus (WebM) first, AAC (m4a) when the fetch or decode fails.
// canPlayType is not trusted (iOS). Decoded buffers are cached for the session; a clip
// missing in both formats resolves to null once and is skipped from then on.
function loadBedFile(context, graph, src) {
  return loadClip(context, graph.bedFiles, src, BED_FILE_FORMATS, 'Ambience bed layer')
}

// `loop` = [start, end] in seconds loops only that region: the recorded beds hold the loop
// plus ~85 ms of codec padding at each end, and looping the whole file would click.
// Without it (or with points the decoded buffer cannot hold) the whole buffer loops.
function startLoopingSource(context, buffer, loop = null) {
  const source = context.createBufferSource()
  source.buffer = buffer
  source.loop = true
  let start = 0
  let length = buffer.duration
  if (loop && loop[0] >= 0 && loop[1] > loop[0] && loop[1] <= buffer.duration + 0.001) {
    source.loopStart = loop[0]
    source.loopEnd = Math.min(loop[1], buffer.duration)
    start = source.loopStart
    length = source.loopEnd - source.loopStart
  }
  // A random start offset inside the loop, so a revisit never begins on the same bar.
  source.start(context.currentTime, start + Math.random() * length)
  return source
}

function addDrift(chain, param, kind) {
  chain.drift.push({
    param,
    kind,
    base: param.value,
    offset: 0,
    range: kind === 'db' ? BED_DRIFT_GAIN_DB : BED_DRIFT_OCTAVES,
    step: kind === 'db' ? BED_DRIFT_GAIN_STEP_DB : BED_DRIFT_OCTAVE_STEP,
  })
}

// Once all of a reserve's recorded layers have started, the synth layers they stand in for
// drop to the profile's `withFiles` gains over the same fade, with their drift base.
function applyWithFilesMix(context, chain) {
  if (chain.withFilesApplied) return
  chain.withFilesApplied = true
  const withFiles = chain.profile.withFiles ?? {}
  const now = context.currentTime
  Object.entries(chain.synthGains).forEach(([layer, param]) => {
    const target = withFiles[layer]
    if (!Number.isFinite(target)) return
    param.cancelScheduledValues(now)
    param.setValueAtTime(param.value, now)
    param.linearRampToValueAtTime(target, now + BED_FILE_FADE_IN_SECONDS)
    const drift = chain.drift.find(entry => entry.param === param)
    if (drift) {
      drift.base = target
      drift.startsAt = now + BED_FILE_FADE_IN_SECONDS
    }
  })
}

function addBedFileLayer(context, chain, file, buffer) {
  if (chain.retired || !buffer) return
  const source = startLoopingSource(context, buffer, file.loop)
  const gain = createGain(context, 0.0001)
  const pan = createPan(context, file.pan)
  const now = context.currentTime
  const level = file.gain ?? 1

  gain.gain.setValueAtTime(0.0001, now)
  gain.gain.linearRampToValueAtTime(level, now + BED_FILE_FADE_IN_SECONDS)
  source.connect(gain)
  if (pan) {
    gain.connect(pan)
    pan.connect(chain.mix)
  } else {
    gain.connect(chain.mix)
  }
  chain.sources.push(source)
  chain.nodes.push(source, gain, ...(pan ? [pan] : []))
  // Drift starts from the target level, once the fade-in has finished.
  chain.drift.push({
    param: gain.gain,
    kind: 'db',
    base: level,
    offset: 0,
    range: BED_DRIFT_GAIN_DB,
    step: BED_DRIFT_GAIN_STEP_DB,
    startsAt: now + BED_FILE_FADE_IN_SECONDS,
  })
}

// One reserve's bed: noise, rumble and optional crackle and recorded layers →
// mix (swell) → tint → level (profile gain, drifting) → fade (crossfade) → bedBus.
function buildBedChain(context, graph, profileId) {
  const profile = AMBIENCE_PROFILES[profileId]
  const chain = {
    profileId,
    profile,
    sources: [],
    nodes: [],
    drift: [],
    synthGains: {},
    withFilesApplied: false,
    swellNextAt: 0,
    retired: false,
  }

  const fade = createGain(context, 0)
  const level = createGain(context, profile.gain)
  const tint = createFilter(context, 'lowpass', profile.tint)
  const mix = createGain(context, 1)
  chain.fade = fade
  chain.mix = mix
  mix.connect(tint)
  tint.connect(level)
  level.connect(fade)
  fade.connect(graph.bedBus)
  chain.nodes.push(fade, level, tint, mix)
  addDrift(chain, level.gain, 'db')
  addDrift(chain, tint.frequency, 'octave')

  const noise = startLoopingSource(context, graph.noiseBuffer)
  const noiseLowpass = createFilter(context, 'lowpass', profile.noise.lowpass, profile.noise.q)
  const noiseGain = createGain(context, profile.noise.gain)
  noise.connect(noiseLowpass)
  noiseLowpass.connect(noiseGain)
  noiseGain.connect(mix)
  chain.sources.push(noise)
  chain.nodes.push(noise, noiseLowpass, noiseGain)
  chain.synthGains.noise = noiseGain.gain
  addDrift(chain, noiseLowpass.frequency, 'octave')

  const rumble = context.createOscillator()
  const rumbleFilter = createFilter(context, 'lowpass', BED_RUMBLE_LOWPASS_HZ, 0.7)
  const rumbleGain = createGain(context, profile.rumble.gain)
  rumble.type = 'sine'
  rumble.frequency.value = profile.rumble.frequency
  rumble.connect(rumbleFilter)
  rumbleFilter.connect(rumbleGain)
  rumbleGain.connect(mix)
  rumble.start()
  chain.sources.push(rumble)
  chain.nodes.push(rumble, rumbleFilter, rumbleGain)
  chain.synthGains.rumble = rumbleGain.gain

  const crackle = profile.crackle
  if (crackle) {
    const highpass = createFilter(context, 'highpass', crackle.highpass)
    const lowpass = createFilter(context, 'lowpass', crackle.lowpass)
    const crackleGain = createGain(context, crackle.gain)
    highpass.connect(lowpass)
    lowpass.connect(crackleGain)
    crackleGain.connect(mix)
    chain.nodes.push(highpass, lowpass, crackleGain)
    crackleBuffersFor(context, graph, profileId, crackle.density).forEach((buffer, side) => {
      const source = startLoopingSource(context, buffer)
      const pan = createPan(context, (side === 0 ? -1 : 1) * crackle.width)
      if (pan) {
        source.connect(pan)
        pan.connect(highpass)
      } else {
        source.connect(highpass)
      }
      chain.sources.push(source)
      chain.nodes.push(source, ...(pan ? [pan] : []))
    })
    addDrift(chain, crackleGain.gain, 'db')
    chain.synthGains.crackle = crackleGain.gain
  }

  // Recorded layers (the catalog's beds for this profile, mixed by its `files`), fetched
  // the first time the reserve is entered and cached; each fades in once it has decoded.
  // A file that fails resolves to null and is skipped: the synth layers above play on.
  // The synth layers are lowered to `withFiles` only once every recording has started, so
  // a partial failure (say both shrimp beds) keeps the full synth bed under the layers
  // that did load, instead of a thinned one.
  const layerLoads = bedLayersFor(profileId).map(file => loadBedFile(context, graph, file.src)
    .then(buffer => {
      if (!buffer || chain.retired) return false
      addBedFileLayer(context, chain, file, buffer)
      return true
    })
    .catch(error => {
      console.warn(`Ambience bed layer failed to start: ${file.src}`, error)
      return false
    }))
  if (layerLoads.length) {
    Promise.all(layerLoads).then(started => {
      if (!chain.retired && started.every(Boolean)) applyWithFilesMix(context, chain)
    })
  }

  return chain
}

function retireBedChain(chain) {
  if (chain.retired) return
  chain.retired = true
  chain.sources.forEach(source => {
    try {
      source.stop()
    } catch {
      // Already stopped.
    }
  })
  chain.nodes.forEach(node => {
    try {
      node.disconnect()
    } catch {
      // Already disconnected.
    }
  })
  chain.sources.length = 0
  chain.nodes.length = 0
  chain.drift.length = 0
}

// Swell: one crest per period, each with its own length and depth, on the bed's mix gain.
function scheduleBedSwell(context, chain) {
  const swell = chain.profile.swell
  if (!swell?.rate || !swell.depth) return
  const now = context.currentTime
  const param = chain.mix.gain
  if (chain.swellNextAt < now) chain.swellNextAt = now

  while (chain.swellNextAt < now + BED_SWELL_HORIZON_SECONDS) {
    const period = (1 / swell.rate) * (0.7 + Math.random() * 0.6)
    const depth = Math.min(0.8, swell.depth * (0.6 + Math.random() * 0.8))
    const crestAt = chain.swellNextAt
    param.setTargetAtTime(1 + depth, crestAt, period * 0.16)
    param.setTargetAtTime(1 - depth, crestAt + period * 0.5, period * 0.16)
    chain.swellNextAt = crestAt + period
  }
}

function driftBedChain(context, chain) {
  const now = context.currentTime
  for (let index = 0; index < chain.drift.length; index += 1) {
    const target = chain.drift[index]
    if (target.startsAt > now) continue
    target.offset = Math.max(-target.range, Math.min(target.range,
      target.offset * BED_DRIFT_PULL + (Math.random() * 2 - 1) * target.step))
    const value = target.kind === 'db'
      ? target.base * 10 ** (target.offset / 20)
      : target.base * 2 ** target.offset
    target.param.setTargetAtTime(value, now, BED_DRIFT_TAU_MIN_SECONDS + Math.random() * BED_DRIFT_TAU_RANGE_SECONDS)
  }
  scheduleBedSwell(context, chain)
}

// Crossfade to the profile's bed. While the context is not running nothing is audible,
// so the swap is immediate. A chain caught mid-fade fades out from where it is.
const CROSSFADE_CURVE_POINTS = 32

// Gain curve from `from` to `to` along a quarter sine (rising) or cosine (falling).
function equalPowerCurve(from, to) {
  const curve = new Float32Array(CROSSFADE_CURVE_POINTS)
  for (let i = 0; i < CROSSFADE_CURVE_POINTS; i += 1) {
    const t = i / (CROSSFADE_CURVE_POINTS - 1)
    const shape = to > from ? Math.sin(t * Math.PI / 2) : Math.cos(t * Math.PI / 2)
    curve[i] = to > from ? from + (to - from) * shape : to + (from - to) * shape
  }
  return curve
}

function switchBedProfile(context, graph, profileId) {
  const current = graph.bed
  if (current?.profileId === profileId) return

  const next = buildBedChain(context, graph, profileId)
  graph.bed = next
  scheduleBedSwell(context, next)

  if (!current || context.state !== 'running') {
    next.fade.gain.value = 1
    if (current) retireBedChain(current)
    return
  }

  // Equal-power curves: the two beds are uncorrelated, so a linear crossfade would dip
  // about 3 dB at its midpoint.
  const now = context.currentTime
  next.fade.gain.cancelScheduledValues(now)
  next.fade.gain.setValueCurveAtTime(equalPowerCurve(0, 1), now, BED_CROSSFADE_SECONDS)
  const fading = current.fade.gain
  const from = fading.value
  fading.cancelScheduledValues(now)
  fading.setValueCurveAtTime(equalPowerCurve(from, 0), now, BED_CROSSFADE_SECONDS)

  const timer = window.setTimeout(() => {
    graph.retiringBeds.delete(timer)
    retireBedChain(current)
  }, BED_RETIRE_AFTER_MS)
  graph.retiringBeds.set(timer, current)
}

function buildAudioGraph(context, profileId) {
  const masterGain = createGain(context, 0)
  const worldBus = createGain(context, 1)
  const bedBus = createGain(context, AMBIENT_VOLUME)
  const sfxGain = createGain(context, SFX_VOLUME)
  const uiBus = createGain(context, 1)
  const eventBus = createGain(context, EVENT_BUS_GAIN)
  const sfxTint = createFilter(context, 'lowpass', LEGACY_TINT_HZ, LEGACY_TINT_Q)
  const uiTint = createFilter(context, 'lowpass', LEGACY_TINT_HZ, LEGACY_TINT_Q)
  const outputLowpass = createFilter(context, 'lowpass', MASTER_LOWPASS_HZ)

  const overallAnalyser = connectAnalyser(context, masterGain, outputLowpass)
  outputLowpass.connect(context.destination)
  const underwaterLowpass = createFilter(context, 'lowpass', UNDERWATER_LOWPASS_HZ, FLAT_Q_DB)
  const underwaterLowpassSlope = createFilter(context, 'lowpass', UNDERWATER_LOWPASS_HZ, FLAT_Q_DB)
  worldBus.connect(underwaterLowpass)
  underwaterLowpass.connect(underwaterLowpassSlope)
  underwaterLowpassSlope.connect(masterGain)
  const ambientAnalyser = connectAnalyser(context, bedBus, worldBus)
  const sfxAnalyser = connectAnalyser(context, sfxGain, sfxTint)
  sfxTint.connect(worldBus)
  eventBus.connect(worldBus)
  uiBus.connect(uiTint)
  uiTint.connect(masterGain)

  const graph = {
    masterGain,
    worldBus,
    bedBus,
    sfxGain,
    eventBus,
    events: null,
    uiBus,
    overallAnalyser,
    ambientAnalyser,
    sfxAnalyser,
    scratchOverall: new Float32Array(overallAnalyser.fftSize),
    scratchAmbient: new Float32Array(ambientAnalyser.fftSize),
    scratchSfx: new Float32Array(sfxAnalyser.fftSize),
    noiseBuffer: createNoiseBuffer(context),
    crackleBuffers: new Map(),
    bedFiles: new Map(),
    bed: null,
    retiringBeds: new Map(),
    lastSfxAt: 0,
  }
  switchBedProfile(context, graph, profileId)
  return graph
}

function closeAudioGraph(graph) {
  graph.events?.dispose()
  graph.events = null
  graph.retiringBeds.forEach((chain, timer) => {
    window.clearTimeout(timer)
    retireBedChain(chain)
  })
  graph.retiringBeds.clear()
  if (graph.bed) retireBedChain(graph.bed)
  graph.bed = null
}

function emitAudioLevels(levels) {
  window.dispatchEvent(new CustomEvent(AUDIO_VOLUME_EVENT, { detail: levels }))
}

async function loadFishSfxAssets(context) {
  const entries = await Promise.all(Object.entries(FISH_SFX_ASSETS).map(async ([type, urls]) => {
    const buffers = await Promise.all(urls.map(url => loadAudioBuffer(context, url)))
    return [type, buffers]
  }))
  return Object.fromEntries(entries)
}

async function loadUiSfxAssets(context) {
  const entries = await Promise.all(Object.entries(UI_SFX_ASSETS).map(async ([type, urls]) => {
    const buffers = await Promise.all(urls.map(url => loadAudioBuffer(context, url)))
    return [type, buffers]
  }))
  return Object.fromEntries(entries)
}

// Any clip of the pool except the one this pool played last (docs/audio-redesign.md §4.3).
function chooseSfxBuffer(graph, type) {
  const buffers = graph.fishSfxBuffers?.[type]
  if (!buffers?.length) return null
  const lastIndex = graph.fishSfxLastIndex ?? (graph.fishSfxLastIndex = {})
  lastIndex[type] = pickWithoutRepeat(buffers.length, lastIndex[type] ?? -1)
  return buffers[lastIndex[type]]
}

// The fish's own pitch (stable seed bias plus size offset, fishVoiceCents) with a small
// random spread on top.
function fishSfxRate(detail) {
  return centsToRate(fishVoiceCents(detail.creatureId, detail.bodyLengthMeters) + randomSpread(FISH_SFX_PITCH_JITTER_CENTS))
}

function disconnectNodes(nodes) {
  for (const node of nodes) {
    try {
      node.disconnect()
    } catch {
      // Already disconnected.
    }
  }
}

function playFishAssetSfx(context, graph, type, intensity, detail) {
  const buffer = chooseSfxBuffer(graph, type)
  if (!buffer) return false

  const now = context.currentTime + startJitterSeconds()
  const rate = fishSfxRate(detail)
  const playSeconds = buffer.duration / rate
  const source = context.createBufferSource()
  const filter = context.createBiquadFilter()
  const gain = context.createGain()
  const activeSfx = graph.activeSfx ?? new Set()
  graph.activeSfx = activeSfx
  const sfxNodes = { source, filter, gain }
  activeSfx.add(sfxNodes)

  source.buffer = buffer
  source.playbackRate.value = rate
  filter.type = 'lowpass'
  filter.frequency.value = detail.followMode ? 1800 : 1200
  filter.Q.value = 0.42

  const assetGain = (type === 'burst' ? 1.0 : 0.78) * intensity * (detail.followMode ? 1.35 : 0.72) * randomGainCut()
  gain.gain.setValueAtTime(0.0001, now)
  gain.gain.exponentialRampToValueAtTime(assetGain, now + 0.018)
  gain.gain.setTargetAtTime(assetGain * 0.92, now + 0.08, 0.22)
  gain.gain.setTargetAtTime(0.0001, now + Math.max(0.12, playSeconds - 0.16), 0.08)

  source.connect(filter)
  filter.connect(gain)
  gain.connect(graph.sfxGain)
  source.start(now)
  source.onended = () => {
    activeSfx.delete(sfxNodes)
    disconnectNodes([source, filter, gain])
  }
  return true
}

function playFishSwimSfx(context, graph, detail = {}) {
  if (!context || !graph) return

  const now = context.currentTime
  const minGap = detail.followMode ? SFX_FOLLOW_MIN_GAP_SECONDS : SFX_AMBIENT_MIN_GAP_SECONDS
  if (now - (graph.lastSfxAt ?? 0) < minGap) return
  graph.lastSfxAt = now

  const type = detail.type === 'burst' ? 'burst' : 'turn'
  const intensity = Math.max(0.25, Math.min(1, detail.intensity ?? 0.55))
  if (playFishAssetSfx(context, graph, type, intensity, detail)) return
  playFishSynthSfx(context, graph, type, intensity * randomGainCut(), detail)
}

// Synthesised fallback while the clips are loading or missing: the same per-fish pitch,
// gain spread and start jitter as the clips.
function playFishSynthSfx(context, graph, type, intensity, detail) {
  const now = context.currentTime + startJitterSeconds()
  const rate = fishSfxRate(detail)
  const focusBoost = detail.followMode ? FOLLOW_MODE_SFX_BOOST : 1
  const duration = detail.followMode
    ? (type === 'burst' ? 0.62 : 0.46)
    : (type === 'burst' ? 0.38 : 0.28)
  const noise = context.createBufferSource()
  const filter = context.createBiquadFilter()
  const gain = context.createGain()
  const tone = context.createOscillator()
  const toneGain = context.createGain()
  const activeSfx = graph.activeSfx ?? new Set()
  graph.activeSfx = activeSfx
  const sfxNodes = { noise, filter, gain, tone, toneGain }
  activeSfx.add(sfxNodes)

  noise.buffer = createNoiseBuffer(context, 0.35)
  filter.type = 'lowpass'
  filter.frequency.setValueAtTime(type === 'burst' ? 430 : 340, now)
  filter.frequency.exponentialRampToValueAtTime(type === 'burst' ? 180 : 140, now + duration)
  filter.Q.value = type === 'burst' ? 0.74 : 0.62

  const noisePeak = (type === 'burst' ? 0.16 : 0.09) * intensity * focusBoost
  gain.gain.setValueAtTime(0.0001, now)
  gain.gain.exponentialRampToValueAtTime(noisePeak, now + 0.018)
  gain.gain.linearRampToValueAtTime(noisePeak * 0.55, now + duration * 0.56)
  gain.gain.exponentialRampToValueAtTime(0.0001, now + duration)

  const tonePeak = (type === 'burst' ? 0.025 : 0.014) * intensity * focusBoost
  tone.type = 'sine'
  tone.frequency.setValueAtTime((type === 'burst' ? 210 : 150) * rate, now)
  tone.frequency.exponentialRampToValueAtTime((type === 'burst' ? 82 : 70) * rate, now + duration * 0.75)
  toneGain.gain.setValueAtTime(0.0001, now)
  toneGain.gain.exponentialRampToValueAtTime(tonePeak, now + 0.025)
  toneGain.gain.linearRampToValueAtTime(tonePeak * 0.45, now + duration * 0.5)
  toneGain.gain.exponentialRampToValueAtTime(0.0001, now + duration)

  noise.connect(filter)
  filter.connect(gain)
  gain.connect(graph.sfxGain)
  tone.connect(toneGain)
  toneGain.connect(graph.sfxGain)

  noise.start(now)
  tone.start(now)
  noise.stop(now + duration + 0.12)
  tone.stop(now + duration + 0.12)
  noise.onended = () => {
    activeSfx.delete(sfxNodes)
    disconnectNodes([noise, filter, gain, tone, toneGain])
  }
}


function chooseUiSfxBuffer(graph, type = 'click') {
  const buffers = graph.uiSfxBuffers?.[type] ?? graph.uiSfxBuffers?.click
  if (!buffers?.length) return null

  const previousIndex = graph.uiSfxIndex ?? -1
  if (buffers.length === 1) {
    graph.uiSfxIndex = 0
    return buffers[0]
  }

  const randomIndex = Math.floor(Math.random() * (buffers.length - 1))
  graph.uiSfxIndex = randomIndex >= previousIndex ? randomIndex + 1 : randomIndex
  return buffers[graph.uiSfxIndex]
}

function playUiClickSfx(context, graph, detail = {}) {
  if (!context || !graph) return

  const now = context.currentTime
  if (now - (graph.lastUiSfxAt ?? 0) < UI_SFX_MIN_GAP_SECONDS) return
  graph.lastUiSfxAt = now

  const buffer = chooseUiSfxBuffer(graph, detail.type)
  const activeSfx = graph.activeSfx ?? new Set()
  graph.activeSfx = activeSfx

  if (buffer) {
    const source = context.createBufferSource()
    const filter = context.createBiquadFilter()
    const gain = context.createGain()
    const sfxNodes = { source, filter, gain }
    activeSfx.add(sfxNodes)

    source.buffer = buffer
    source.playbackRate.value = 1
    filter.type = 'lowpass'
    filter.frequency.value = 2400
    filter.Q.value = 0.34

    const peak = detail.variant === 'confirm' ? 0.18 : 0.135
    gain.gain.setValueAtTime(0.0001, now)
    gain.gain.exponentialRampToValueAtTime(peak, now + 0.012)
    gain.gain.setTargetAtTime(0.0001, now + 0.075, 0.035)

    source.connect(filter)
    filter.connect(gain)
    gain.connect(graph.uiBus)
    source.start(now)
    source.onended = () => activeSfx.delete(sfxNodes)
    return
  }

  const oscillator = context.createOscillator()
  const gain = context.createGain()
  const sfxNodes = { oscillator, gain }
  activeSfx.add(sfxNodes)

  oscillator.type = 'triangle'
  oscillator.frequency.setValueAtTime(520, now)
  oscillator.frequency.exponentialRampToValueAtTime(250, now + 0.07)
  gain.gain.setValueAtTime(0.0001, now)
  gain.gain.exponentialRampToValueAtTime(0.025, now + 0.01)
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.09)
  oscillator.connect(gain)
  gain.connect(graph.uiBus)
  oscillator.start(now)
  oscillator.stop(now + 0.11)
  oscillator.onended = () => activeSfx.delete(sfxNodes)
}

export function triggerFishSwimSound(detail) {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent(FISH_SWIM_SFX_EVENT, { detail }))
}

export function triggerUiClickSound(detail = {}) {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent(UI_CLICK_SFX_EVENT, { detail }))
}

// `tankId` is the tank being viewed (null on the landing gate and the selector); its
// ambience profile (src/audio/ambienceProfiles.js) picks the bed, crossfaded on a switch.
export function useOceanAudio(tankId = null) {
  const audioRef = useRef(null)
  const levelTimerRef = useRef(null)
  const suspendTimerRef = useRef(null)
  const driftTimerRef = useRef(null)
  const profileIdRef = useRef(ambienceProfileIdFor(tankId))
  const mutedRef = useRef(false)
  const startedRef = useRef(false)
  const [muted, setMuted] = useState(false)
  const [started, setStarted] = useState(false)
  const [supported, setSupported] = useState(true)

  const stopLevelMeter = useCallback(() => {
    if (!levelTimerRef.current) return
    window.clearInterval(levelTimerRef.current)
    levelTimerRef.current = null
  }, [])

  const startLevelMeter = useCallback(() => {
    if (levelTimerRef.current) return

    levelTimerRef.current = window.setInterval(() => {
      // No analyser scans while the optional Audio diagnostic section is closed.
      if (audioLevelSubscribers === 0) return
      const graph = audioRef.current?.graph
      if (!graph || mutedRef.current) {
        emitAudioLevels({ overallDb: LEVEL_FLOOR_DB, ambientDb: LEVEL_FLOOR_DB, sfxDb: LEVEL_FLOOR_DB, muted: mutedRef.current })
        return
      }

      emitAudioLevels({
        overallDb: dbFromAnalyser(graph.overallAnalyser, graph.scratchOverall),
        ambientDb: dbFromAnalyser(graph.ambientAnalyser, graph.scratchAmbient),
        sfxDb: dbFromAnalyser(graph.sfxAnalyser, graph.scratchSfx),
        muted: false,
      })
    }, LEVEL_FRAME_MS)
  }, [])

  const stopBedDrift = useCallback(() => {
    if (!driftTimerRef.current) return
    window.clearTimeout(driftTimerRef.current)
    driftTimerRef.current = null
  }, [])

  // One timeout scheduler for every bed's drift and swell: a few param retargets every
  // 3–5 s, skipped while the context is suspended (its clock is stopped anyway).
  const startBedDrift = useCallback(() => {
    if (driftTimerRef.current) return

    const tick = () => {
      driftTimerRef.current = window.setTimeout(tick, BED_DRIFT_MIN_MS + Math.random() * BED_DRIFT_RANGE_MS)
      const audio = audioRef.current
      if (!audio?.graph.bed || audio.context.state !== 'running') return
      driftBedChain(audio.context, audio.graph.bed)
    }
    driftTimerRef.current = window.setTimeout(tick, BED_DRIFT_MIN_MS)
  }, [])

  const ensureAudio = useCallback(() => {
    if (typeof window === 'undefined') return null
    if (audioRef.current) return audioRef.current

    const usesMediaPlaybackSession = requestMediaPlaybackSession()
    const context = createAudioContext()
    if (!context) {
      setSupported(false)
      return null
    }

    const graph = buildAudioGraph(context, profileIdRef.current)
    audioRef.current = { context, graph, usesMediaPlaybackSession }
    // Events follow the viewed reserve; nothing is scheduled while muted, stopped,
    // suspended or hidden (src/audio/eventScheduler.js).
    graph.events = createEventScheduler(context, graph.eventBus, {
      canPlay: () => startedRef.current && !mutedRef.current && context.state === 'running' &&
        document.visibilityState !== 'hidden',
    })
    graph.events.setProfile(profileIdRef.current)
    if (import.meta.env.DEV) globalThis.__oceanAudioEvents = graph.events
    loadFishSfxAssets(context)
      .then(buffers => {
        graph.fishSfxBuffers = buffers
      })
      .catch(error => {
        console.warn('Fish SFX assets unavailable; using synthesized fallback', error)
      })
    loadUiSfxAssets(context)
      .then(buffers => {
        graph.uiSfxBuffers = buffers
      })
      .catch(error => {
        console.warn('UI SFX assets unavailable; using synthesized fallback', error)
      })
    startLevelMeter()
    startBedDrift()
    return audioRef.current
  }, [startBedDrift, startLevelMeter])

  const clearSuspendTimer = useCallback(() => {
    if (!suspendTimerRef.current) return
    window.clearTimeout(suspendTimerRef.current)
    suspendTimerRef.current = null
  }, [])

  const setMasterMuted = useCallback((nextMuted, fadeSeconds = AUDIO_FADE_SECONDS) => {
    const graph = audioRef.current?.graph
    if (!graph) return

    const now = audioRef.current.context.currentTime
    graph.masterGain.gain.cancelScheduledValues(now)
    graph.masterGain.gain.setValueAtTime(graph.masterGain.gain.value, now)
    graph.masterGain.gain.setTargetAtTime(nextMuted ? 0.0001 : getMasterTargetGain(), now, Math.max(0.01, fadeSeconds / 4))
  }, [])

  const startAudio = useCallback(() => {
    requestMediaPlaybackSession()
    const audio = ensureAudio()
    if (!audio) return false

    clearSuspendTimer()
    const markStarted = () => {
      mutedRef.current = false
      startedRef.current = true
      setStarted(true)
      setMuted(false)
      setMasterMuted(false)
    }

    unlockAudioContext(audio.context).then(unlocked => {
      if (unlocked || audio.context.state === 'running') markStarted()
    })

    if (audio.context.state === 'running') markStarted()
    else {
      mutedRef.current = false
      setMuted(false)
      setMasterMuted(false)
    }
    return true
  }, [clearSuspendTimer, ensureAudio, setMasterMuted])

  const stopAudio = useCallback(() => {
    const audio = audioRef.current
    if (!audio) return

    clearSuspendTimer()
    startedRef.current = false
    setStarted(false)
    setMasterMuted(true)
    releaseMediaPlaybackSession()
    suspendTimerRef.current = window.setTimeout(() => {
      suspendTimerRef.current = null
      suspendAudioContext(audio.context)
    }, AUDIO_SUSPEND_AFTER_FADE_MS)
  }, [clearSuspendTimer, setMasterMuted])

  // Fade out. With `suspend` (page hidden or being left) the context is also suspended
  // once the fade has finished, so a backgrounded tab costs no audio thread; startAudio
  // resumes it. A plain pause (window blur) only fades, and leaves a pending suspend alone,
  // so a blur that follows visibilitychange cannot cancel it.
  const pauseAudio = useCallback(({ suspend = false } = {}) => {
    const audio = audioRef.current
    if (!audio) return

    setMasterMuted(true)
    releaseMediaPlaybackSession()
    if (!suspend) return

    clearSuspendTimer()
    suspendTimerRef.current = window.setTimeout(() => {
      suspendTimerRef.current = null
      // A frozen page (bfcache, iOS app switch) runs this overdue timer as it comes back;
      // suspending then would leave a visible page silent until a later retry.
      if (document.visibilityState !== 'hidden') return
      suspendAudioContext(audio.context)
    }, AUDIO_SUSPEND_AFTER_FADE_MS)
  }, [clearSuspendTimer, setMasterMuted])

  const toggleMuted = useCallback(() => {
    requestMediaPlaybackSession()
    const audio = ensureAudio()
    if (!audio) return

    clearSuspendTimer()

    if (!startedRef.current) {
      const markStarted = () => {
        startedRef.current = true
        setStarted(true)
        mutedRef.current = false
        setMuted(false)
        setMasterMuted(false)
      }

      unlockAudioContext(audio.context).then(unlocked => {
        if (unlocked || audio.context.state === 'running') markStarted()
      })

      if (audio.context.state === 'running') markStarted()
      else {
        mutedRef.current = false
        setMuted(false)
        setMasterMuted(false)
      }
      return
    }

    unlockAudioContext(audio.context)

    setMuted(current => {
      const nextMuted = !current
      mutedRef.current = nextMuted
      setMasterMuted(nextMuted)
      return nextMuted
    })
  }, [clearSuspendTimer, ensureAudio, setMasterMuted])

  useEffect(() => {
    mutedRef.current = muted
    setMasterMuted(muted)
  }, [muted, setMasterMuted])

  useEffect(() => {
    const profileId = ambienceProfileIdFor(tankId)
    profileIdRef.current = profileId
    const audio = audioRef.current
    if (!audio) return
    switchBedProfile(audio.context, audio.graph, profileId)
    audio.graph.events?.setProfile(profileId)
  }, [tankId])

  useEffect(() => {
    const playSfx = (event) => {
      if (mutedRef.current) return
      const audio = audioRef.current
      if (!audio || audio.context.state !== 'running') return
      playFishSwimSfx(audio.context, audio.graph, event.detail)
    }

    window.addEventListener(FISH_SWIM_SFX_EVENT, playSfx)
    return () => window.removeEventListener(FISH_SWIM_SFX_EVENT, playSfx)
  }, [])

  useEffect(() => {
    const playSfx = (event) => {
      if (mutedRef.current) return
      const audio = audioRef.current
      if (!audio || audio.context.state !== 'running') return
      playUiClickSfx(audio.context, audio.graph, event.detail)
    }

    window.addEventListener(UI_CLICK_SFX_EVENT, playSfx)
    return () => window.removeEventListener(UI_CLICK_SFX_EVENT, playSfx)
  }, [])

  useEffect(() => () => {
    clearSuspendTimer()
    stopLevelMeter()
    stopBedDrift()
    const audio = audioRef.current
    if (!audio) return
    startedRef.current = false
    setStarted(false)
    closeAudioGraph(audio.graph)
    // Clear the ref so a remount (StrictMode, Fast Refresh) builds a fresh context rather
    // than reusing, and closing again, this closed one.
    audioRef.current = null
    audio.context.close?.()?.catch?.(() => {})
  }, [clearSuspendTimer, stopBedDrift, stopLevelMeter])

  return { muted, started, supported, startAudio, pauseAudio, stopAudio, toggleMuted }
}

export function useAudioLevels(active) {
  const [levels, setLevels] = useState({ overallDb: LEVEL_FLOOR_DB, ambientDb: LEVEL_FLOOR_DB, sfxDb: LEVEL_FLOOR_DB, muted: true })
  const lastUiUpdateAt = useRef(0)
  const lastUiLevels = useRef(levels)

  useEffect(() => {
    if (!active) return undefined

    const updateLevels = (event) => {
      const now = performance.now()
      if (now - lastUiUpdateAt.current < DEBUG_AUDIO_UI_SAMPLE_MS) return

      const nextLevels = normalizeAudioUiLevels(event.detail)
      if (areAudioUiLevelsEqual(lastUiLevels.current, nextLevels)) return

      lastUiUpdateAt.current = now
      lastUiLevels.current = nextLevels
      setLevels(nextLevels)
    }

    audioLevelSubscribers += 1
    lastUiUpdateAt.current = -Infinity
    window.addEventListener(AUDIO_VOLUME_EVENT, updateLevels)
    return () => {
      audioLevelSubscribers -= 1
      window.removeEventListener(AUDIO_VOLUME_EVENT, updateLevels)
    }
  }, [active])

  return levels
}

function normalizeAudioUiLevels(levels) {
  return {
    overallDb: roundAudioUiDb(levels?.overallDb),
    ambientDb: roundAudioUiDb(levels?.ambientDb),
    sfxDb: roundAudioUiDb(levels?.sfxDb),
    muted: Boolean(levels?.muted),
  }
}

function roundAudioUiDb(value) {
  if (!Number.isFinite(value)) return LEVEL_FLOOR_DB
  return Math.max(LEVEL_FLOOR_DB, Math.round(value / AUDIO_UI_DB_STEP) * AUDIO_UI_DB_STEP)
}

function areAudioUiLevelsEqual(left, right) {
  return left?.overallDb === right?.overallDb &&
    left?.ambientDb === right?.ambientDb &&
    left?.sfxDb === right?.sfxDb &&
    left?.muted === right?.muted
}

export { LEVEL_FLOOR_DB }
