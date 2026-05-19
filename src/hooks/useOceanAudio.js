import { useCallback, useEffect, useRef, useState } from 'react'

const AUDIO_VOLUME_EVENT = 'world-oceanarium-audio-volume'
const FISH_SWIM_SFX_EVENT = 'world-oceanarium-fish-swim-sfx'
const LEVEL_FLOOR_DB = -72
const LEVEL_FRAME_MS = 100
const MASTER_TARGET_GAIN = 0.5 // -6 dB trim; mobile speakers need more headroom than desktop.
const AMBIENT_VOLUME = 0.24
const SFX_VOLUME = 0.62
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
  return new AudioContextClass()
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
  lowpass.frequency.value = 720
  lowpass.Q.value = 0.42

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

  const assetGain = (type === 'burst' ? 0.82 : 0.58) * intensity * (detail.followMode ? 1.25 : 0.58)
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

  const ensureAudio = useCallback(async () => {
    if (typeof window === 'undefined') return null
    if (audioRef.current) return audioRef.current

    const context = createAudioContext()
    if (!context) {
      setSupported(false)
      return null
    }

    const graph = buildAudioGraph(context)
    audioRef.current = { context, graph }
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

  const setMasterMuted = useCallback((nextMuted) => {
    const graph = audioRef.current?.graph
    if (!graph) return

    const now = audioRef.current.context.currentTime
    graph.masterGain.gain.cancelScheduledValues(now)
    graph.masterGain.gain.setTargetAtTime(nextMuted ? 0 : MASTER_TARGET_GAIN, now, 0.08)
  }, [])

  const startAudio = useCallback(async () => {
    const audio = await ensureAudio()
    if (!audio) return false

    if (audio.context.state === 'suspended') {
      await audio.context.resume()
    }

    mutedRef.current = false
    setMuted(false)
    setMasterMuted(false)
    return true
  }, [ensureAudio, setMasterMuted])

  const stopAudio = useCallback(() => {
    const audio = audioRef.current
    if (!audio) return

    setMasterMuted(true)
    audio.context.suspend?.()
  }, [setMasterMuted])

  const toggleMuted = useCallback(async () => {
    const audio = await ensureAudio()
    if (!audio) return

    if (audio.context.state === 'suspended') {
      await audio.context.resume()
    }

    setMuted(current => {
      const nextMuted = !current
      mutedRef.current = nextMuted
      setMasterMuted(nextMuted)
      return nextMuted
    })
  }, [ensureAudio, setMasterMuted])

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
  }, [stopLevelMeter])

  return { muted, supported, startAudio, stopAudio, toggleMuted }
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
