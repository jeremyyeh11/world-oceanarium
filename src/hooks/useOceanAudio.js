import { useCallback, useEffect, useRef, useState } from 'react'

const AUDIO_VOLUME_EVENT = 'world-oceanarium-audio-volume'
const FISH_SWIM_SFX_EVENT = 'world-oceanarium-fish-swim-sfx'
const LEVEL_FLOOR_DB = -72
const LEVEL_FRAME_MS = 100
const MOBILE_MASTER_TARGET_GAIN = 2.0 // Jeremy requested roughly 2x overall loudness on mobile.
const DESKTOP_MASTER_TARGET_GAIN = MOBILE_MASTER_TARGET_GAIN * 0.5
const AMBIENT_VOLUME = 0.18
const SFX_VOLUME = 1.0
const AUDIO_FADE_SECONDS = 0.45
const AUDIO_SUSPEND_AFTER_FADE_MS = 560
const FOLLOW_MODE_SFX_BOOST = 4.5
const SFX_MIN_GAP_SECONDS = 0.09
const FISH_SFX_ASSETS = {
  turn: [
    '/audio/fish-sfx/fish-small-movement-01.mp3',
    '/audio/fish-sfx/fish-small-movement-02.mp3',
    '/audio/fish-sfx/fish-small-movement-03.mp3',
  ],
  burst: [
    '/audio/fish-sfx/fish-big-movement-01.mp3',
    '/audio/fish-sfx/fish-big-movement-02.mp3',
  ],
}

function hashString(value) {
  let hash = 2166136261
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

function createAudioContext() {
  const AudioContextClass = window.AudioContext ?? window.webkitAudioContext
  if (!AudioContextClass) return null
  return new AudioContextClass({ latencyHint: 'interactive' })
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
  if (!context) return

  try {
    const buffer = context.createBuffer(1, 1, context.sampleRate)
    const source = context.createBufferSource()
    source.buffer = buffer
    source.connect(context.destination)
    source.start(0)
  } catch {
    // Unlock pulse is best-effort for iOS Safari.
  }

  if (context.state !== 'running') {
    context.resume?.()
  }
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

function buildAudioGraph(context) {
  const masterGain = context.createGain()
  const ambientGain = context.createGain()
  const sfxGain = context.createGain()
  const noiseGain = context.createGain()
  const rumbleGain = context.createGain()
  const shimmerGain = context.createGain()
  const lowpass = context.createBiquadFilter()
  const rumbleFilter = context.createBiquadFilter()
  const outputLowpass = context.createBiquadFilter()
  const noiseSource = context.createBufferSource()
  const rumble = context.createOscillator()
  const shimmer = context.createOscillator()

  masterGain.gain.value = 0
  ambientGain.gain.value = AMBIENT_VOLUME
  sfxGain.gain.value = SFX_VOLUME
  noiseGain.gain.value = 0.95
  rumbleGain.gain.value = 0.055
  shimmerGain.gain.value = 0.02

  lowpass.type = 'lowpass'
  lowpass.frequency.value = 360
  lowpass.Q.value = 0.46

  rumbleFilter.type = 'lowpass'
  rumbleFilter.frequency.value = 90
  rumbleFilter.Q.value = 0.7

  outputLowpass.type = 'lowpass'
  outputLowpass.frequency.value = 1600
  outputLowpass.Q.value = 0.36

  rumble.type = 'sine'
  rumble.frequency.value = 42
  shimmer.type = 'sine'
  shimmer.frequency.value = 0.18

  noiseSource.buffer = createNoiseBuffer(context)
  noiseSource.loop = true

  noiseSource.connect(lowpass)
  lowpass.connect(noiseGain)
  noiseGain.connect(ambientGain)

  rumble.connect(rumbleFilter)
  rumbleFilter.connect(rumbleGain)
  rumbleGain.connect(ambientGain)

  shimmer.connect(shimmerGain)
  shimmerGain.connect(ambientGain.gain)

  const overallAnalyser = connectAnalyser(context, masterGain, outputLowpass)
  outputLowpass.connect(context.destination)
  const ambientAnalyser = connectAnalyser(context, ambientGain, masterGain)
  const sfxAnalyser = connectAnalyser(context, sfxGain, masterGain)

  noiseSource.start()
  rumble.start()
  shimmer.start()

  return {
    masterGain,
    ambientGain,
    sfxGain,
    overallAnalyser,
    ambientAnalyser,
    sfxAnalyser,
    scratchOverall: new Float32Array(overallAnalyser.fftSize),
    scratchAmbient: new Float32Array(ambientAnalyser.fftSize),
    scratchSfx: new Float32Array(sfxAnalyser.fftSize),
    nodes: [noiseSource, rumble, shimmer],
    lastSfxAt: 0,
  }
}

function emitAudioLevels(levels) {
  window.dispatchEvent(new CustomEvent(AUDIO_VOLUME_EVENT, { detail: levels }))
}

async function loadAudioBuffer(context, url) {
  const response = await window.fetch(url)
  if (!response.ok) throw new Error(`Audio asset failed to load: ${url}`)
  const arrayBuffer = await response.arrayBuffer()
  return context.decodeAudioData(arrayBuffer)
}

async function loadFishSfxAssets(context) {
  const entries = await Promise.all(Object.entries(FISH_SFX_ASSETS).map(async ([type, urls]) => {
    const buffers = await Promise.all(urls.map(url => loadAudioBuffer(context, url)))
    return [type, buffers]
  }))
  return Object.fromEntries(entries)
}

function chooseSfxBuffer(graph, type, detail) {
  const buffers = graph.fishSfxBuffers?.[type]
  if (!buffers?.length) return null
  const seed = `${detail.creatureId ?? 'fish'}:${detail.type ?? type}:${detail.followMode ? 'follow' : 'normal'}`
  return buffers[hashString(seed) % buffers.length]
}

function playFishAssetSfx(context, graph, type, intensity, detail) {
  const buffer = chooseSfxBuffer(graph, type, detail)
  if (!buffer) return false

  const now = context.currentTime
  const source = context.createBufferSource()
  const filter = context.createBiquadFilter()
  const gain = context.createGain()
  const activeSfx = graph.activeSfx ?? new Set()
  graph.activeSfx = activeSfx
  const sfxNodes = { source, filter, gain }
  activeSfx.add(sfxNodes)

  source.buffer = buffer
  filter.type = 'lowpass'
  filter.frequency.value = detail.followMode ? 1800 : 1200
  filter.Q.value = 0.42

  const assetGain = (type === 'burst' ? 1.0 : 0.78) * intensity * (detail.followMode ? 1.35 : 0.72)
  gain.gain.setValueAtTime(0.0001, now)
  gain.gain.exponentialRampToValueAtTime(assetGain, now + 0.018)
  gain.gain.setTargetAtTime(assetGain * 0.92, now + 0.08, 0.22)
  gain.gain.setTargetAtTime(0.0001, now + Math.max(0.12, buffer.duration - 0.16), 0.08)

  source.connect(filter)
  filter.connect(gain)
  gain.connect(graph.sfxGain)
  source.start(now)
  source.onended = () => activeSfx.delete(sfxNodes)
  return true
}

function playFishSwimSfx(context, graph, detail = {}) {
  if (!context || !graph) return

  const now = context.currentTime
  if (now - (graph.lastSfxAt ?? 0) < SFX_MIN_GAP_SECONDS) return
  graph.lastSfxAt = now

  const type = detail.type === 'burst' ? 'burst' : 'turn'
  const intensity = Math.max(0.25, Math.min(1, detail.intensity ?? 0.55))
  if (playFishAssetSfx(context, graph, type, intensity, detail)) return

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
  tone.frequency.setValueAtTime(type === 'burst' ? 210 : 150, now)
  tone.frequency.exponentialRampToValueAtTime(type === 'burst' ? 82 : 70, now + duration * 0.75)
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
  noise.onended = () => activeSfx.delete(sfxNodes)
}

export function triggerFishSwimSound(detail) {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent(FISH_SWIM_SFX_EVENT, { detail }))
}

export function useOceanAudio() {
  const audioRef = useRef(null)
  const levelTimerRef = useRef(null)
  const suspendTimerRef = useRef(null)
  const mutedRef = useRef(false)
  const [muted, setMuted] = useState(false)
  const [supported, setSupported] = useState(true)

  const stopLevelMeter = useCallback(() => {
    if (!levelTimerRef.current) return
    window.clearInterval(levelTimerRef.current)
    levelTimerRef.current = null
  }, [])

  const startLevelMeter = useCallback(() => {
    if (levelTimerRef.current) return

    levelTimerRef.current = window.setInterval(() => {
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

  const ensureAudio = useCallback(() => {
    if (typeof window === 'undefined') return null
    if (audioRef.current) return audioRef.current

    const usesMediaPlaybackSession = requestMediaPlaybackSession()
    const context = createAudioContext()
    if (!context) {
      setSupported(false)
      return null
    }

    const graph = buildAudioGraph(context)
    audioRef.current = { context, graph, usesMediaPlaybackSession }
    loadFishSfxAssets(context)
      .then(buffers => {
        graph.fishSfxBuffers = buffers
      })
      .catch(error => {
        console.warn('Fish SFX assets unavailable; using synthesized fallback', error)
      })
    startLevelMeter()
    return audioRef.current
  }, [startLevelMeter])

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
    unlockAudioContext(audio.context)

    mutedRef.current = false
    setMuted(false)
    setMasterMuted(false)
    return true
  }, [clearSuspendTimer, ensureAudio, setMasterMuted])

  const stopAudio = useCallback(() => {
    const audio = audioRef.current
    if (!audio) return

    clearSuspendTimer()
    setMasterMuted(true)
    releaseMediaPlaybackSession()
    suspendTimerRef.current = window.setTimeout(() => {
      suspendTimerRef.current = null
      audio.context.suspend?.()
    }, AUDIO_SUSPEND_AFTER_FADE_MS)
  }, [clearSuspendTimer, setMasterMuted])

  const pauseAudio = useCallback(() => {
    if (!audioRef.current) return

    clearSuspendTimer()
    setMasterMuted(true)
    releaseMediaPlaybackSession()
  }, [clearSuspendTimer, setMasterMuted])

  const toggleMuted = useCallback(() => {
    requestMediaPlaybackSession()
    const audio = ensureAudio()
    if (!audio) return

    clearSuspendTimer()
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
    const playSfx = (event) => {
      if (mutedRef.current) return
      const audio = audioRef.current
      if (!audio || audio.context.state !== 'running') return
      playFishSwimSfx(audio.context, audio.graph, event.detail)
    }

    window.addEventListener(FISH_SWIM_SFX_EVENT, playSfx)
    return () => window.removeEventListener(FISH_SWIM_SFX_EVENT, playSfx)
  }, [])

  useEffect(() => () => {
    clearSuspendTimer()
    stopLevelMeter()
    const audio = audioRef.current
    if (!audio) return
    audio.graph.nodes.forEach(node => {
      try {
        node.stop()
      } catch {
        // Already stopped.
      }
    })
    audio.context.close?.()
  }, [clearSuspendTimer, stopLevelMeter])

  return { muted, supported, startAudio, pauseAudio, stopAudio, toggleMuted }
}

export function useAudioLevels(active) {
  const [levels, setLevels] = useState({ overallDb: LEVEL_FLOOR_DB, ambientDb: LEVEL_FLOOR_DB, sfxDb: LEVEL_FLOOR_DB, muted: true })

  useEffect(() => {
    if (!active) return undefined

    const updateLevels = (event) => {
      setLevels(event.detail)
    }

    window.addEventListener(AUDIO_VOLUME_EVENT, updateLevels)
    return () => window.removeEventListener(AUDIO_VOLUME_EVENT, updateLevels)
  }, [active])

  return levels
}

export { LEVEL_FLOOR_DB }
