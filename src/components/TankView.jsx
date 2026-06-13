import { Canvas } from '@react-three/fiber'
import { useEffect, useRef, useState } from 'react'
import Camera from './Camera'
import Biome from './Biome'
import WaterSurface from './WaterSurface'
import SceneLighting from './SceneLighting'
import UnderwaterFX from './UnderwaterFX'
import InfoCard from './InfoCard'
import { getSardineFrustumStats, getSardineInstances, getSardineLod1Instances, getSardineLod0Stats, SARDINE_INSTANCE_DISTANCE, SARDINE_LOD1_DISTANCE, SARDINE_TANK_INSTANCE_DISTANCE, SARDINE_TANK_LOD1_DISTANCE } from './sardineInstanceRegistry'
import { DEPTH_ZONES } from '../data/species'
import { LEVEL_FLOOR_DB, useAudioLevels } from '../hooks/useOceanAudio'
import { creatureBodyLengthWU, isMolaCreature, resolveSpecies } from '../utils/speciesLookup'
import { APP_VERSION_LABEL, APP_VERSION_SHORT_LABEL } from '../version'
import { DEBUG_TOGGLE_EVENT, SARDINE_INSTANCE_DEBUG_GLOBAL } from '../utils/debugIdentifiers'

const MAX_FOLLOW_ORBIT_YAW = Math.PI / 5
const MAX_FOLLOW_ORBIT_PITCH = Math.PI / 6
const FOLLOW_ORBIT_DRAG_SPEED = 0.006
const DEFAULT_FOLLOW_DISTANCE = 3.2
const MIN_FOLLOW_DISTANCE = 1.35
const MOLA_MIN_FOLLOW_BODY_LENGTHS = 1.05
const MAX_FOLLOW_DISTANCE = 18
const LARGE_CREATURE_FOLLOW_BODY_LENGTHS = 1.9
const LARGE_CREATURE_MAX_FOLLOW_BODY_LENGTHS = 4.0
const FOLLOW_WHEEL_ZOOM_SPEED = 0.0016
const FOLLOW_PINCH_ZOOM_SPEED = 0.012
const PAN_DRAG_THRESHOLD_PX = 5
const FOLLOW_ORBIT_SELECTION_SUPPRESS_MS = 280
const FOLLOW_ZOOM_SELECTION_SUPPRESS_MS = 360
const FOLLOW_TOUCH_GESTURE_RESET_MS = 90
const SEARCH_FOCUS_EVENT = 'world-oceanarium-focus-creature'
const RECOVERY_NOTICE_DURATION_MS = 4200

const clampFollowOrbit = ({ yaw, pitch }) => ({
  yaw: Math.max(-MAX_FOLLOW_ORBIT_YAW, Math.min(MAX_FOLLOW_ORBIT_YAW, yaw)),
  pitch: Math.max(-MAX_FOLLOW_ORBIT_PITCH, Math.min(MAX_FOLLOW_ORBIT_PITCH, pitch)),
})
const DEBUG_VIEW_MODES = [
  { id: 'all', icon: '◎', label: 'View all' },
  { id: 'focused', icon: '◉', label: 'Selected creature' },
]
const DEBUG_LAYER_BUTTONS = [
  { id: 'direction', icon: '↗', label: 'Show direction' },
  { id: 'name', icon: '#', label: 'Show name' },
  { id: 'lod', icon: 'L', label: 'Show LOD colors' },
  { id: 'bones', icon: 'B', label: 'Show curve-deform bones' },
]
const DEBUG_SIMULATION_SPEEDS = [1, 4, 10]
const FPS_SAMPLE_MS = 1000
const DEPTH_ZONE_BY_ID = new Map(DEPTH_ZONES.map(zone => [zone.id, zone]))

function creatureDisplayName(creature) {
  const customName = creature?.customName?.trim()
  if (customName) return customName
  return resolveSpecies(creature)?.name ?? creature?.species ?? 'This fish'
}

function summarizeRenderLoad(creatures, biomeId) {
  const visibleCreatures = creatures.filter(creature => creature.alive && creature.biome === biomeId)
  return {
    visibleCreatures: visibleCreatures.length,
  }
}

function getPanLimits() {
  const viewportWidth = window.innerWidth
  const viewportHeight = window.innerHeight
  const stageWidth = Math.max(viewportWidth, viewportHeight * 16 / 9)
  const croppedRatio = Math.max(0, stageWidth - viewportWidth) / stageWidth
  const enabled = croppedRatio > 0.3
  return { enabled, maxPan: enabled ? (stageWidth - viewportWidth) / 2 : 0 }
}

function getTouchDistance(points) {
  const values = [...points.values()]
  if (values.length < 2) return 0
  return Math.hypot(values[0].x - values[1].x, values[0].y - values[1].y)
}

function creatureBodyLength(creature) {
  const species = resolveSpecies(creature)
  return creatureBodyLengthWU(creature, species?.swim?.bodyLengthWU)
}

function maxFollowDistanceForCreature(creature) {
  const bodyLength = creatureBodyLength(creature)
  return Math.max(MAX_FOLLOW_DISTANCE, bodyLength * LARGE_CREATURE_MAX_FOLLOW_BODY_LENGTHS)
}

function minFollowDistanceForCreature(creature) {
  const bodyLength = creatureBodyLength(creature)
  return isMolaCreature(creature)
    ? Math.max(MIN_FOLLOW_DISTANCE, bodyLength * MOLA_MIN_FOLLOW_BODY_LENGTHS)
    : MIN_FOLLOW_DISTANCE
}

function clampFollowDistance(distance, creature = null) {
  return Math.max(minFollowDistanceForCreature(creature), Math.min(maxFollowDistanceForCreature(creature), distance))
}

function defaultFollowDistanceForCreature(creature) {
  const bodyLength = creatureBodyLength(creature)
  return clampFollowDistance(Math.max(DEFAULT_FOLLOW_DISTANCE, bodyLength * LARGE_CREATURE_FOLLOW_BODY_LENGTHS), creature)
}

function eventStartedInInfoCard(event) {
  return event.target instanceof Element && Boolean(event.target.closest('.info-card'))
}

function isMobileInputSurface() {
  return window.matchMedia?.('(hover: none), (pointer: coarse), (max-width: 768px)').matches ?? false
}

export default function TankView({ biome, creatures, creatureDataSource = 'unknown', creatureDataError = null, tankVisitSeed = 0, screenshotMode = false, onBack, onOpenEncyclopedia }) {
  const [selectedCreature, setSelectedCreature] = useState(null)
  const [focusedFishRef, setFocusedFishRef] = useState(null)
  const [debugMode, setDebugMode] = useState(false)
  const [debugView, setDebugView] = useState('focused')
  const [debugLayers, setDebugLayers] = useState({ direction: true, name: true, lod: false, bones: true })
  const [debugSimulationSpeed, setDebugSimulationSpeed] = useState(1)
  const [stagePan, setStagePan] = useState(0)
  const [stagePanning, setStagePanning] = useState(false)
  const [followOrbit, setFollowOrbit] = useState({ yaw: 0, pitch: 0 })
  const [followDistance, setFollowDistance] = useState(DEFAULT_FOLLOW_DISTANCE)
  const [followScreenOffset, setFollowScreenOffset] = useState(0)
  const [debugSunBaskRequestId, setDebugSunBaskRequestId] = useState(0)
  const [defaultCameraSettled, setDefaultCameraSettled] = useState(true)
  const [panLimits, setPanLimits] = useState(() => ({ enabled: false, maxPan: 0 }))
  const [performanceStats, setPerformanceStats] = useState({ fps: null })
  const [recoveryNotice, setRecoveryNotice] = useState(null)
  const performanceStatsRef = useRef({ fps: null })
  const audioLevels = useAudioLevels(debugMode)
  const dragRef = useRef(null)
  const touchPointsRef = useRef(new Map())
  const focusChangeAtRef = useRef(0)
  const suppressCreatureFocusUntilRef = useRef(0)
  const fishRefsByCreatureId = useRef(new Map())
  const zoomActive = Boolean(selectedCreature)
  const visibleDebugVisuals = debugMode
  const visibleDebugPanel = debugMode && !screenshotMode
  const boneDebugAvailable = debugView !== 'all'
  const activeDebugLayers = boneDebugAvailable ? debugLayers : { ...debugLayers, bones: false }
  const defaultDepthZone = DEPTH_ZONE_BY_ID.get(biome?.defaultDepthZone)
  const renderLoad = summarizeRenderLoad(creatures, biome?.id)
  const canQueueDebugSunBask = debugMode && zoomActive && selectedCreature && isMolaCreature(selectedCreature)

  const queueDebugSunBask = () => {
    if (!canQueueDebugSunBask) return
    setDebugSunBaskRequestId(current => current + 1)
  }


  const toggleDebugMode = () => {
    setDebugMode(current => !current)
  }

  useEffect(() => {
    const updatePanLimits = () => {
      const nextLimits = getPanLimits()
      setPanLimits(nextLimits)
      setStagePan(current => nextLimits.enabled
        ? Math.max(-nextLimits.maxPan, Math.min(nextLimits.maxPan, current))
        : 0)
    }

    updatePanLimits()
    window.addEventListener('resize', updatePanLimits)
    return () => window.removeEventListener('resize', updatePanLimits)
  }, [])

  useEffect(() => {
    const toggleDebugOnShortcut = (event) => {
      if (!(event.ctrlKey || event.metaKey) || !event.shiftKey || event.key.toLowerCase() !== 'd') return
      event.preventDefault()
      toggleDebugMode()
    }

    window.addEventListener('keydown', toggleDebugOnShortcut)
    return () => window.removeEventListener('keydown', toggleDebugOnShortcut)
  }, [debugMode])

  useEffect(() => {
    const queueSunBaskOnShortcut = (event) => {
      const isSunBaskShortcut = (event.ctrlKey || event.metaKey) && event.shiftKey && (event.code === 'KeyX' || event.key?.toLowerCase() === 'x')
      if (!isSunBaskShortcut) return
      if (!debugMode || !selectedCreature || !isMolaCreature(selectedCreature)) return
      event.preventDefault()
      setDebugSunBaskRequestId(current => current + 1)
    }

    window.addEventListener('keydown', queueSunBaskOnShortcut)
    return () => window.removeEventListener('keydown', queueSunBaskOnShortcut)
  }, [debugMode, selectedCreature])

  useEffect(() => {
    window.addEventListener(DEBUG_TOGGLE_EVENT, toggleDebugMode)
    return () => window.removeEventListener(DEBUG_TOGGLE_EVENT, toggleDebugMode)
  }, [debugMode])

  useEffect(() => {
    if (!selectedCreature) return undefined

    const closeOnEscape = (event) => {
      if (event.key === 'Escape') releaseFocus()
    }

    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [selectedCreature])

  useEffect(() => {
    if (!selectedCreature) return undefined

    const blockViewportScroll = (event) => {
      if (eventStartedInInfoCard(event)) return
      event.preventDefault()
    }

    const blockMobileWheelZoom = (event) => {
      if (!isMobileInputSurface() || eventStartedInInfoCard(event)) return
      event.preventDefault()
      event.stopPropagation()
    }

    window.addEventListener('touchmove', blockViewportScroll, { capture: true, passive: false })
    window.addEventListener('wheel', blockMobileWheelZoom, { capture: true, passive: false })

    return () => {
      window.removeEventListener('touchmove', blockViewportScroll, true)
      window.removeEventListener('wheel', blockMobileWheelZoom, true)
    }
  }, [selectedCreature])

  useEffect(() => {
    if (!selectedCreature) {
      document.documentElement.style.removeProperty('--mobile-follow-card-height')
      setFollowScreenOffset(0)
      return undefined
    }

    let observer = null
    let frameId = 0

    const updateCardHeight = () => {
      const card = document.querySelector('.tank-viewport.is-following-fish .info-card')
      if (!card) return

      const syncHeight = () => {
        const cardHeight = card.getBoundingClientRect().height
        document.documentElement.style.setProperty('--mobile-follow-card-height', `${cardHeight}px`)
        // Follow mode should keep the creature centered in the actual screen.
        // The card height is still exposed for UI layout, but it no longer
        // biases the camera framing on phone-sized viewports.
        setFollowScreenOffset(0)
      }

      syncHeight()
      observer?.disconnect()
      observer = new ResizeObserver(syncHeight)
      observer.observe(card)
    }

    frameId = window.requestAnimationFrame(updateCardHeight)
    window.addEventListener('resize', updateCardHeight)

    return () => {
      window.cancelAnimationFrame(frameId)
      window.removeEventListener('resize', updateCardHeight)
      observer?.disconnect()
      document.documentElement.style.removeProperty('--mobile-follow-card-height')
    }
  }, [selectedCreature, debugMode])

  useEffect(() => {
    if (!visibleDebugPanel) {
      document.documentElement.style.removeProperty('--floating-debug-panel-height')
      return undefined
    }

    let observer = null
    let frameId = 0

    const updateDebugPanelHeight = () => {
      const panel = document.querySelector('.tank-viewport .debug-panel--floating')
      if (!panel) return

      const syncHeight = () => {
        document.documentElement.style.setProperty('--floating-debug-panel-height', `${panel.getBoundingClientRect().height}px`)
      }

      syncHeight()
      observer?.disconnect()
      observer = new ResizeObserver(syncHeight)
      observer.observe(panel)
    }

    frameId = window.requestAnimationFrame(updateDebugPanelHeight)
    window.addEventListener('resize', updateDebugPanelHeight)

    return () => {
      window.cancelAnimationFrame(frameId)
      window.removeEventListener('resize', updateDebugPanelHeight)
      observer?.disconnect()
      document.documentElement.style.removeProperty('--floating-debug-panel-height')
    }
  }, [visibleDebugPanel])

  useEffect(() => {
    if (!selectedCreature || !panLimits.enabled) return undefined

    let frameId = 0
    const centerStage = () => {
      setStagePan(current => {
        if (Math.abs(current) < 0.5) return 0
        return current + (0 - current) * 0.12
      })
      frameId = window.requestAnimationFrame(centerStage)
    }

    frameId = window.requestAnimationFrame(centerStage)
    return () => window.cancelAnimationFrame(frameId)
  }, [selectedCreature, panLimits.enabled])

  const focusCreature = (creature, fishRef) => {
    dragRef.current = null
    touchPointsRef.current.clear()
    const sameCreatureFocused = selectedCreature && String(selectedCreature.id) === String(creature?.id)
    if (sameCreatureFocused) {
      setSelectedCreature(creature)
      setFocusedFishRef(fishRef)
      setStagePan(0)
      return
    }

    focusChangeAtRef.current = performance.now()
    setSelectedCreature(creature)
    setFocusedFishRef(fishRef)
    setStagePan(0)
    setFollowOrbit({ yaw: 0, pitch: 0 })
    setFollowDistance(defaultFollowDistanceForCreature(creature))
  }

  const selectCreatureFromPointer = (creature, fishRef) => {
    if (performance.now() < suppressCreatureFocusUntilRef.current) return
    focusCreature(creature, fishRef)
  }

  const registerCreatureRef = (creature, fishRef) => {
    if (!creature?.id || !fishRef) return
    fishRefsByCreatureId.current.set(String(creature.id), fishRef)
  }

  const releaseFocus = () => {
    focusChangeAtRef.current = performance.now()
    touchPointsRef.current.clear()
    dragRef.current = null
    setStagePanning(false)
    setSelectedCreature(null)
    setFocusedFishRef(null)
    setFollowOrbit({ yaw: 0, pitch: 0 })
    setFollowDistance(DEFAULT_FOLLOW_DISTANCE)
  }

  const releaseFocusForRuntimeRecovery = (creature) => {
    const name = creatureDisplayName(creature)
    setRecoveryNotice({ id: `${creature?.id ?? name}-${performance.now()}`, text: `${name} will be back in a bit!` })
    releaseFocus()
  }

  const releaseFollowForCameraClip = () => {
    if (!selectedCreature || !isMolaCreature(selectedCreature)) return
    releaseFocusForRuntimeRecovery(selectedCreature)
  }

  useEffect(() => {
    if (!recoveryNotice) return undefined
    const timeout = window.setTimeout(() => setRecoveryNotice(null), RECOVERY_NOTICE_DURATION_MS)
    return () => window.clearTimeout(timeout)
  }, [recoveryNotice])

  const adjustFollowDistance = (delta) => {
    setFollowDistance(current => clampFollowDistance(current + delta, selectedCreature))
  }

  const suppressCreatureFocusFor = (durationMs) => {
    suppressCreatureFocusUntilRef.current = Math.max(suppressCreatureFocusUntilRef.current, performance.now() + durationMs)
  }

  const resetFollowTouchGestureSoon = () => {
    window.setTimeout(() => {
      if (touchPointsRef.current.size > 0) return
      if (dragRef.current?.mode === 'pinch') dragRef.current = null
    }, FOLLOW_TOUCH_GESTURE_RESET_MS)
  }

  const toggleDebugLayer = (layerId) => {
    setDebugLayers(current => ({ ...current, [layerId]: !current[layerId] }))
  }

  useEffect(() => {
    if (!visibleDebugVisuals) {
      const resetStats = { fps: null }
      performanceStatsRef.current = resetStats
      setPerformanceStats(resetStats)
      return undefined
    }

    let frameId = 0
    let frameCount = 0
    let sampleStartedAt = performance.now()

    const sampleFps = (now) => {
      frameCount += 1
      const elapsed = now - sampleStartedAt
      if (elapsed >= FPS_SAMPLE_MS) {
        const instanceDebug = window[SARDINE_INSTANCE_DEBUG_GLOBAL]
        const instancingMode = instanceDebug?.mode ?? 'off'
        const lod1Drawn = Number.isFinite(instanceDebug?.lod1Total) ? instanceDebug.lod1Total : 0
        const lod2Drawn = Number.isFinite(instanceDebug?.lod2Total) ? instanceDebug.lod2Total : (Number.isFinite(instanceDebug?.total) ? instanceDebug.total : 0)
        const lod0Stats = getSardineLod0Stats()
        const frustumStats = getSardineFrustumStats()
        const nextStats = {
          fps: Math.round((frameCount * 1000) / elapsed),
          sardineCandidates: getSardineInstances().size,
          lod1Candidates: getSardineLod1Instances().size,
          lod1Drawn,
          instancedDrawn: lod2Drawn,
          lod0Drawn: lod0Stats.drawn,
          lod0Candidates: lod0Stats.candidates,
          frustumCulled: frustumStats.culled,
          frustumCandidates: frustumStats.candidates,
          instancingMode,
          instancingDistance: selectedCreature ? SARDINE_INSTANCE_DISTANCE : SARDINE_TANK_INSTANCE_DISTANCE,
          lod1Distance: selectedCreature ? SARDINE_LOD1_DISTANCE : SARDINE_TANK_LOD1_DISTANCE,
        }
        if (!arePerformanceStatsEqual(performanceStatsRef.current, nextStats)) {
          performanceStatsRef.current = nextStats
          setPerformanceStats(nextStats)
        }
        frameCount = 0
        sampleStartedAt = now
      }
      frameId = window.requestAnimationFrame(sampleFps)
    }

    frameId = window.requestAnimationFrame(sampleFps)
    return () => window.cancelAnimationFrame(frameId)
  }, [visibleDebugVisuals, selectedCreature])

  useEffect(() => {
    const focusFromSearch = (event) => {
      const creatureId = String(event.detail?.creatureId ?? '')
      if (!creatureId) return
      const creature = creatures.find(candidate => String(candidate.id) === creatureId)
      const fishRef = fishRefsByCreatureId.current.get(creatureId)
      if (!creature || !fishRef) return
      focusCreature(creature, fishRef)
    }

    window.addEventListener(SEARCH_FOCUS_EVENT, focusFromSearch)
    return () => window.removeEventListener(SEARCH_FOCUS_EVENT, focusFromSearch)
  }, [creatures])

  const zoomFollowWithWheel = (event) => {
    if (!selectedCreature) return
    event.preventDefault()
    suppressCreatureFocusFor(FOLLOW_ZOOM_SELECTION_SUPPRESS_MS)
    const normalizedDelta = event.deltaMode === 1 ? event.deltaY * 16 : event.deltaY
    adjustFollowDistance(normalizedDelta * FOLLOW_WHEEL_ZOOM_SPEED * followDistance)
  }

  const startStageDrag = (event) => {
    if (event.button !== 0) return

    if (selectedCreature && event.pointerType === 'touch') {
      event.preventDefault()
      touchPointsRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY })
      if (touchPointsRef.current.size >= 2) {
        suppressCreatureFocusFor(FOLLOW_ZOOM_SELECTION_SUPPRESS_MS)
        dragRef.current = {
          mode: 'pinch',
          startDistance: getTouchDistance(touchPointsRef.current),
          startFollowDistance: followDistance,
        }
        return
      }
    }

    if (selectedCreature) {
      dragRef.current = {
        mode: 'orbit-pending',
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        lastX: event.clientX,
        lastY: event.clientY,
        startFocusChangeAt: focusChangeAtRef.current,
        target: event.currentTarget,
        captured: false,
      }
      return
    }

    if (!panLimits.enabled) return
    dragRef.current = {
      mode: 'pan-pending',
      pointerId: event.pointerId,
      startX: event.clientX,
      startPan: stagePan,
      target: event.currentTarget,
    }
  }

  const moveStageDrag = (event) => {
    if (selectedCreature && event.pointerType === 'touch') event.preventDefault()

    if (event.pointerType === 'touch' && touchPointsRef.current.has(event.pointerId)) {
      touchPointsRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY })
    }

    const drag = dragRef.current
    if (!drag) return

    if (drag.mode === 'pinch') {
      event.preventDefault()
      suppressCreatureFocusFor(FOLLOW_ZOOM_SELECTION_SUPPRESS_MS)
      const pinchDistance = getTouchDistance(touchPointsRef.current)
      if (!pinchDistance || !drag.startDistance) return
      const pinchDelta = drag.startDistance - pinchDistance
      setFollowDistance(clampFollowDistance(drag.startFollowDistance + pinchDelta * FOLLOW_PINCH_ZOOM_SPEED, selectedCreature))
      return
    }

    if (drag.pointerId !== event.pointerId) return

    if (drag.mode === 'orbit' || drag.mode === 'orbit-pending') {
      const totalDeltaX = event.clientX - drag.startX
      const totalDeltaY = event.clientY - drag.startY
      const moved = Math.hypot(totalDeltaX, totalDeltaY) > 5
      if (!moved && drag.mode === 'orbit-pending') return

      const lastX = drag.lastX ?? drag.startX
      const lastY = drag.lastY ?? drag.startY
      const deltaX = event.clientX - lastX
      const deltaY = event.clientY - lastY
      drag.lastX = event.clientX
      drag.lastY = event.clientY
      drag.mode = 'orbit'
      drag.moved = true
      if (!drag.captured) {
        try {
          drag.target?.setPointerCapture?.(event.pointerId)
          drag.captured = true
        } catch {
          // Pointer capture is a guard, not a dependency; orbit still works without it.
        }
      }
      suppressCreatureFocusFor(FOLLOW_ORBIT_SELECTION_SUPPRESS_MS)
      setFollowOrbit(current => clampFollowOrbit({
        yaw: current.yaw - deltaX * FOLLOW_ORBIT_DRAG_SPEED,
        pitch: current.pitch - deltaY * FOLLOW_ORBIT_DRAG_SPEED,
      }))
      return
    }

    const nextPan = drag.startPan + event.clientX - drag.startX
    if (drag.mode === 'pan-pending') {
      const moved = Math.abs(event.clientX - drag.startX) > PAN_DRAG_THRESHOLD_PX
      if (!moved) return
      drag.mode = 'pan'
      setStagePanning(true)
      try {
        drag.target?.setPointerCapture?.(event.pointerId)
      } catch {
        // Pointer may already be released by the browser; panning can still continue for this event.
      }
    }
    setStagePan(Math.max(-panLimits.maxPan, Math.min(panLimits.maxPan, nextPan)))
  }

  const endStageDrag = (event) => {
    if (selectedCreature && event.pointerType === 'touch') event.preventDefault()
    if (event.pointerType === 'touch') touchPointsRef.current.delete(event.pointerId)

    if (dragRef.current?.mode === 'pinch') {
      suppressCreatureFocusFor(FOLLOW_ZOOM_SELECTION_SUPPRESS_MS)
      setStagePanning(false)
      if (touchPointsRef.current.size < 2) {
        dragRef.current = null
        resetFollowTouchGestureSoon()
      }
      return
    }

    if (dragRef.current?.pointerId !== event.pointerId) return
    if (dragRef.current.mode === 'pan' || dragRef.current.mode === 'pan-pending') {
      const drag = dragRef.current
      dragRef.current = null
      setStagePanning(false)
      try {
        if (drag.target?.hasPointerCapture?.(event.pointerId)) {
          drag.target.releasePointerCapture(event.pointerId)
        }
      } catch {
        // Ignore stale pointer-capture cleanup.
      }
      return
    }
    if (dragRef.current.mode === 'orbit' || dragRef.current.mode === 'orbit-pending') {
      setStagePanning(false)
      const drag = dragRef.current
      dragRef.current = null
      try {
        if (drag.target?.hasPointerCapture?.(event.pointerId)) {
          drag.target.releasePointerCapture(event.pointerId)
        }
      } catch {
        // Ignore stale pointer-capture cleanup.
      }
      if (drag.mode === 'orbit') {
        suppressCreatureFocusFor(FOLLOW_ORBIT_SELECTION_SUPPRESS_MS)
        return
      }
      window.setTimeout(() => {
        if (focusChangeAtRef.current === drag.startFocusChangeAt) releaseFocus()
      }, 0)
      return
    }
    dragRef.current = null
    setStagePanning(false)
  }

  return (
    <div
      className={`tank-viewport${panLimits.enabled ? ' can-pan' : ''}${stagePanning ? ' is-panning' : ''}${zoomActive ? ' is-following-fish' : ''}${visibleDebugPanel ? ' has-debug-panel' : ''}${screenshotMode ? ' is-screenshot-mode' : ''}`}
      style={{ '--stage-pan-x': `${stagePan}px` }}
    >
      <div
        className="tank-stage"
        onPointerDown={startStageDrag}
        onPointerMove={moveStageDrag}
        onPointerUpCapture={endStageDrag}
        onPointerCancelCapture={endStageDrag}
        onWheel={zoomFollowWithWheel}
      >
        <Canvas camera={{ fov: 61, near: 0.1, far: 200 }} onPointerMissed={zoomActive ? undefined : releaseFocus}>
          <SceneLighting biome={biome.id} />
          <Camera
            biome={biome.id}
            focusTarget={focusedFishRef?.current ?? null}
            followOrbit={followOrbit}
            followDistance={followDistance}
            followScreenOffset={followScreenOffset}
            onDefaultCameraSettledChange={setDefaultCameraSettled}
            onFollowCameraClip={releaseFollowForCameraClip}
          />
          <Biome
            key={biome.id}
            name={biome.id}
            creatures={creatures}
            tankVisitSeed={tankVisitSeed}
            selectedCreatureId={selectedCreature?.id}
            zoomActive={zoomActive}
            debugSunBaskRequestId={debugSunBaskRequestId}
            soloRuntimeRecoveryEnabled={!zoomActive && defaultCameraSettled}
            hideSelectionSilhouette={screenshotMode}
            debug={visibleDebugVisuals}
            debugView={debugView}
            debugLayers={activeDebugLayers}
            debugLodView={visibleDebugVisuals && Boolean(activeDebugLayers.lod)}
            debugStatsEnabled={visibleDebugVisuals}
            debugSimulationSpeed={visibleDebugVisuals ? debugSimulationSpeed : 1}
            onCreatureClick={selectCreatureFromPointer}
            onCreatureReady={registerCreatureRef}
            onRuntimeRecoveryNeeded={releaseFocusForRuntimeRecovery}
          />
          <WaterSurface biome={biome.id} />
          <UnderwaterFX biome={biome.id} />
        </Canvas>
      </div>

      <div className="tank-top-exposure" aria-hidden="true" />

      {screenshotMode && (
        <svg className="screenshot-grain" aria-hidden="true" focusable="false">
          <filter id="screenshot-film-grain" x="0" y="0" width="100%" height="100%">
            <feTurbulence type="fractalNoise" baseFrequency="0.72" numOctaves="4" seed="17" stitchTiles="no" />
            <feColorMatrix type="saturate" values="0" />
          </filter>
          <rect width="100%" height="100%" filter="url(#screenshot-film-grain)" />
        </svg>
      )}

      {!screenshotMode && !zoomActive && onBack && <button onClick={onBack} aria-label="Back to biome menu" className="tank-back-button">←</button>}

      {!screenshotMode && (
        <div style={{
          position: 'absolute', top: '1.5rem', left: '50%', transform: 'translateX(-50%)',
          color: 'rgba(255,255,255,0.7)', fontFamily: 'system-ui, sans-serif', textAlign: 'center',
          pointerEvents: 'none',
        }}>
          <div style={{ fontSize: '0.85rem', letterSpacing: '0.15em', textTransform: 'uppercase' }}>{biome.name}</div>
          {defaultDepthZone && (
            <div className="tank-zone-label" style={{ marginTop: '0.34rem', color: 'rgba(185,225,255,0.46)', fontSize: '0.52rem', letterSpacing: '0.13em', textTransform: 'uppercase' }}>
              {defaultDepthZone.label}
            </div>
          )}
        </div>
      )}

      {visibleDebugPanel && (
        <DebugPanel
          className="debug-panel--floating"
          creatureDataSource={creatureDataSource}
          creatureDataError={creatureDataError}
          creatureCount={creatures.length}
          debugView={debugView}
          debugLayers={debugLayers}
          boneDebugAvailable={boneDebugAvailable}
          debugSimulationSpeed={debugSimulationSpeed}
          audioLevels={audioLevels}
          performanceStats={performanceStats}
          renderLoad={renderLoad}
          canQueueSunBask={canQueueDebugSunBask}
          onDebugViewChange={setDebugView}
          onDebugLayerToggle={toggleDebugLayer}
          onDebugSimulationSpeedChange={setDebugSimulationSpeed}
          onQueueSunBask={queueDebugSunBask}
        />
      )}

      {!screenshotMode && selectedCreature && <FocusHint />}
      {recoveryNotice && (
        <div key={recoveryNotice.id} className="runtime-recovery-notice" role="status" aria-live="polite">
          {recoveryNotice.text}
        </div>
      )}
      {!screenshotMode && selectedCreature && (
        <InfoCard creature={selectedCreature} onClose={releaseFocus} onOpenEncyclopedia={onOpenEncyclopedia} />
      )}
    </div>
  )
}

function clampDebugCount(value) {
  return Number.isFinite(value) ? Math.max(0, Math.round(value)) : 0
}

function arePerformanceStatsEqual(left, right) {
  return left?.fps === right?.fps &&
    left?.sardineCandidates === right?.sardineCandidates &&
    left?.lod1Candidates === right?.lod1Candidates &&
    left?.lod1Drawn === right?.lod1Drawn &&
    left?.instancedDrawn === right?.instancedDrawn &&
    left?.lod0Drawn === right?.lod0Drawn &&
    left?.lod0Candidates === right?.lod0Candidates &&
    left?.frustumCulled === right?.frustumCulled &&
    left?.frustumCandidates === right?.frustumCandidates &&
    left?.instancingMode === right?.instancingMode &&
    left?.instancingDistance === right?.instancingDistance &&
    left?.lod1Distance === right?.lod1Distance
}

function DebugPanel({
  className = '',
  creatureDataSource,
  creatureDataError,
  creatureCount,
  debugView,
  debugLayers,
  boneDebugAvailable = true,
  debugSimulationSpeed = 1,
  audioLevels,
  performanceStats,
  renderLoad,
  canQueueSunBask = false,
  onDebugViewChange,
  onDebugLayerToggle,
  onDebugSimulationSpeedChange,
  onQueueSunBask,
}) {
  const visibleCreatureCount = clampDebugCount(renderLoad?.visibleCreatures)
  const lod1Drawn = clampDebugCount(performanceStats?.lod1Drawn)
  const lod1Candidates = Math.max(lod1Drawn, clampDebugCount(performanceStats?.lod1Candidates))
  const lod2Drawn = clampDebugCount(performanceStats?.instancedDrawn)
  const lod2Candidates = Math.max(lod2Drawn, clampDebugCount(performanceStats?.sardineCandidates))
  const lod0Candidates = Math.max(0, visibleCreatureCount - lod1Candidates - lod2Candidates)
  const frustumCandidates = Math.max(visibleCreatureCount, clampDebugCount(performanceStats?.frustumCandidates))
  const frustumCulled = Math.min(frustumCandidates, clampDebugCount(performanceStats?.frustumCulled))
  const lod0Drawn = Math.max(0, lod0Candidates - frustumCulled)
  const debugVersionTapCount = useRef(0)
  const debugVersionTapTimer = useRef(null)

  const resetDebugVersionTaps = () => {
    debugVersionTapCount.current = 0
    if (!debugVersionTapTimer.current) return
    window.clearTimeout(debugVersionTapTimer.current)
    debugVersionTapTimer.current = null
  }

  const handleDebugVersionTap = (event) => {
    event.stopPropagation()
    if (debugVersionTapTimer.current) {
      window.clearTimeout(debugVersionTapTimer.current)
    }

    debugVersionTapCount.current += 1

    if (debugVersionTapCount.current >= 3) {
      resetDebugVersionTaps()
      window.dispatchEvent(new CustomEvent(DEBUG_TOGGLE_EVENT))
      return
    }

    debugVersionTapTimer.current = window.setTimeout(resetDebugVersionTaps, 1200)
  }

  const fpsLabel = Number.isFinite(performanceStats?.fps) ? performanceStats.fps : '—'

  return (
    <div className={`debug-panel ${className}`}>
      <div className="debug-mobile-readout" aria-label="Compact mobile debug readout">
        <div className="debug-mobile-stat"><span>C</span><strong>{visibleCreatureCount}/{creatureCount}</strong></div>
        <div className="debug-mobile-stat"><span>LOD</span><strong>{lod0Drawn}/{lod1Drawn}/{lod2Drawn}</strong></div>
        <div className="debug-mobile-stat"><span>F</span><strong>{frustumCulled}/{frustumCandidates}</strong></div>
        <div className="debug-mobile-stat"><span>FPS</span><strong>{fpsLabel}</strong></div>
        <button
          className="debug-mobile-version"
          type="button"
          aria-label="Tap three times to disable debug mode"
          onPointerUp={handleDebugVersionTap}
          onContextMenu={(event) => event.preventDefault()}
        >
          <span className="version-label-full">{APP_VERSION_LABEL}</span>
          <span className="version-label-short">{APP_VERSION_SHORT_LABEL}</span>
        </button>
      </div>
      <div className="debug-panel-section debug-panel-section--runtime" aria-label="Runtime stats">
        <div className="debug-panel-stat"><span aria-hidden="true">◷</span><span className="debug-panel-label">FPS</span><strong>{fpsLabel}</strong></div>
        <div className="debug-panel-stat"><span aria-hidden="true">◆</span><span className="debug-panel-label">Data</span><strong>{creatureDataSource}</strong></div>
      </div>
      <div className="debug-panel-section debug-panel-section--load" aria-label="Creature render load">
        <div className="debug-load-column">
          <div className="debug-panel-label">Creatures</div>
          <strong>{visibleCreatureCount}/{creatureCount}</strong>
        </div>
        <div className="debug-load-column debug-load-column--lod">
          <div className="debug-panel-label">LOD</div>
          <div className="debug-load-stack">
            <div className="debug-panel-stat"><span className="debug-panel-label">LOD 0</span><strong>{lod0Drawn}/{lod0Candidates}</strong></div>
            <div className="debug-panel-stat"><span className="debug-panel-label">LOD 1</span><strong>{lod1Drawn}/{lod1Candidates}</strong></div>
            <div className="debug-panel-stat"><span className="debug-panel-label">LOD 2</span><strong>{lod2Drawn}/{lod2Candidates}</strong></div>
          </div>
        </div>
        <div className="debug-load-column">
          <div className="debug-panel-label">Frustum</div>
          <strong>{frustumCulled}/{frustumCandidates}</strong>
        </div>
      </div>
      <div className="debug-panel-section debug-panel-section--controls" aria-label="Debug controls">
        <div className="debug-panel-row">
          <span className="debug-panel-label">View</span>
          {DEBUG_VIEW_MODES.map(mode => (
            <button
              key={mode.id}
              type="button"
              title={mode.label}
              aria-label={`Debug ${mode.label}`}
              aria-pressed={debugView === mode.id}
              className="debug-panel-button"
              onClick={() => onDebugViewChange(mode.id)}
            >
              {mode.icon}
            </button>
          ))}
        </div>
        <div className="debug-panel-row">
          <span className="debug-panel-label">Overlay</span>
          {DEBUG_LAYER_BUTTONS.map(layer => {
            const disabled = layer.id === 'bones' && !boneDebugAvailable
            return (
              <button
                key={layer.id}
                type="button"
                title={disabled ? 'Bone overlay is only available for selected creature view' : layer.label}
                aria-label={`Toggle ${layer.label}`}
                aria-pressed={disabled ? false : debugLayers[layer.id]}
                className="debug-panel-button"
                disabled={disabled}
                onClick={() => {
                  if (!disabled) onDebugLayerToggle(layer.id)
                }}
              >
                {layer.icon}
              </button>
            )
          })}
        </div>
        <div className="debug-panel-row">
          <span className="debug-panel-label">Sim</span>
          {DEBUG_SIMULATION_SPEEDS.map(speed => (
            <button
              key={speed}
              type="button"
              title={`Simulation speed ${speed}x`}
              aria-label={`Simulation speed ${speed}x`}
              aria-pressed={debugSimulationSpeed === speed}
              className="debug-panel-button"
              onClick={() => onDebugSimulationSpeedChange(speed)}
            >
              {speed}x
            </button>
          ))}
        </div>
        <button
          type="button"
          title={canQueueSunBask ? 'Queue Mola sun-bask' : 'Follow Mola in debug mode to queue sun-bask'}
          aria-label="Queue Mola sun-bask"
          className="debug-panel-button debug-panel-button--wide"
          disabled={!canQueueSunBask}
          onClick={onQueueSunBask}
        >
          ☀ bask
        </button>
      </div>
      <AudioDebugMeters levels={audioLevels} />
      {creatureDataError && (
        <div className="debug-panel-error">
          {creatureDataError.code ? `${creatureDataError.code}: ` : ''}{creatureDataError.message ?? String(creatureDataError)}
        </div>
      )}
      <div className="debug-panel-section debug-panel-section--identity" aria-label="Build version">
        <button
          className="debug-panel-version"
          type="button"
          aria-label="Tap three times to disable debug mode"
          onPointerUp={handleDebugVersionTap}
          onContextMenu={(event) => event.preventDefault()}
        >
          <span className="version-label-full">{APP_VERSION_LABEL}</span>
          <span className="version-label-short">{APP_VERSION_SHORT_LABEL}</span>
        </button>
      </div>
    </div>
  )
}


function clamp01(value) {
  return Math.max(0, Math.min(1, value))
}

function formatDb(value) {
  if (!Number.isFinite(value) || value <= LEVEL_FLOOR_DB + 0.5) return '-∞ dB'
  return `${Math.round(value)} dB`
}

function meterLevel(value) {
  if (!Number.isFinite(value)) return 0
  return clamp01((value - LEVEL_FLOOR_DB) / Math.abs(LEVEL_FLOOR_DB))
}

function AudioDebugMeters({ levels }) {
  const rows = [
    { id: 'overall', label: 'Overall', value: levels.overallDb },
    { id: 'ambient', label: 'Ambient', value: levels.ambientDb },
    { id: 'sfx', label: 'SFX', value: levels.sfxDb },
  ]

  return (
    <div className="audio-debug-meters" aria-label="Audio volume debug meters">
      <div className="audio-debug-heading">Audio dB{levels.muted ? ' · muted' : ''}</div>
      {rows.map(row => (
        <div className="audio-debug-row" key={row.id}>
          <span className="audio-debug-label">{row.label}</span>
          <div className="audio-debug-track" aria-hidden="true">
            <span className="audio-debug-fill" style={{ transform: `scaleX(${meterLevel(row.value)})` }} />
          </div>
          <span className="audio-debug-value">{formatDb(row.value)}</span>
        </div>
      ))}
    </div>
  )
}

function FocusHint() {
  return (
    <div className="focus-hint" style={{
      position: 'absolute', top: '4.8rem', left: '50%', transform: 'translateX(-50%)',
      color: 'rgba(230,245,255,0.55)', fontFamily: 'system-ui, sans-serif', fontSize: '0.56rem',
      letterSpacing: '0.075em', textTransform: 'uppercase', pointerEvents: 'none',
      background: 'rgba(0,10,30,0.35)', border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: 999, padding: '0.38rem 0.85rem', backdropFilter: 'blur(6px)',
      width: 'min(82vw, 25rem)', textAlign: 'center',
    }}>
      <span className="focus-hint-title">Following fish</span>
      <span className="focus-hint-controls focus-hint-controls-desktop">scroll to zoom · drag to orbit</span>
      <span className="focus-hint-controls focus-hint-controls-mobile">pinch to zoom · drag to orbit</span>
    </div>
  )
}
