import { useCallback, useEffect, useRef, useState } from 'react'

const AUDIO_VOLUME_EVENT = 'world-oceanarium-audio-volume'
const FISH_SWIM_SFX_EVENT = 'world-oceanarium-fish-swim-sfx'
const LEVEL_FLOOR_DB = -72
const LEVEL_FRAME_MS = 100
const MASTER_TARGET_GAIN = 0.316 // -10 dB trim.
const AMBIENT_VOLUME = 0.16
const SFX_VOLUME = 0.34
const FOLLOW_MODE_SFX_BOOST = 4.5
const SFX_MIN_GAP_SECONDS = 0.09

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
  shimmerGain.gain.value = 0.012

  lowpass.type = 'lowpass'
  lowpass.frequency.value = 320
  lowpass.Q.value = 0.48

  rumbleFilter.type = 'lowpass'
  rumbleFilter.frequency.value = 90
  rumbleFilter.Q.value = 0.7

  outputLowpass.type = 'lowpass'
  outputLowpass.frequency.value = 620
  outputLowpass.Q.value = 0.42

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

function playFishSwimSfx(context, graph, detail = {}) {
  if (!context || !graph) return

  const now = context.currentTime
  if (now - (graph.lastSfxAt ?? 0) < SFX_MIN_GAP_SECONDS) return
  graph.lastSfxAt = now

  const type = detail.type === 'burst' ? 'burst' : 'turn'
  const intensity = Math.max(0.25, Math.min(1, detail.intensity ?? 0.55))
  const focusBoost = detail.followMode ? FOLLOW_MODE_SFX_BOOST : 1
  const duration = type === 'burst' ? 0.24 : 0.16
  const noise = context.createBufferSource()
  const filter = context.createBiquadFilter()
  const gain = context.createGain()
  const tone = context.createOscillator()
  const toneGain = context.createGain()

  noise.buffer = createNoiseBuffer(context, 0.35)
  filter.type = 'lowpass'
  filter.frequency.setValueAtTime(type === 'burst' ? 430 : 340, now)
  filter.frequency.exponentialRampToValueAtTime(type === 'burst' ? 180 : 140, now + duration)
  filter.Q.value = type === 'burst' ? 0.74 : 0.62

  gain.gain.setValueAtTime(0.0001, now)
  gain.gain.exponentialRampToValueAtTime((type === 'burst' ? 0.16 : 0.09) * intensity * focusBoost, now + 0.018)
  gain.gain.exponentialRampToValueAtTime(0.0001, now + duration)

  tone.type = 'sine'
  tone.frequency.setValueAtTime(type === 'burst' ? 210 : 150, now)
  tone.frequency.exponentialRampToValueAtTime(type === 'burst' ? 82 : 70, now + duration * 0.75)
  toneGain.gain.setValueAtTime(0.0001, now)
  toneGain.gain.exponentialRampToValueAtTime((type === 'burst' ? 0.025 : 0.014) * intensity * focusBoost, now + 0.025)
  toneGain.gain.exponentialRampToValueAtTime(0.0001, now + duration)

  noise.connect(filter)
  filter.connect(gain)
  gain.connect(graph.sfxGain)
  tone.connect(toneGain)
  toneGain.connect(graph.sfxGain)

  noise.start(now)
  tone.start(now)
  noise.stop(now + duration + 0.04)
  tone.stop(now + duration + 0.04)
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

  return { muted, supported, startAudio, toggleMuted }
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
