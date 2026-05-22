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

const MAX_FOLLOW_ORBIT = Math.PI / 6
const FOLLOW_ORBIT_DRAG_SPEED = 0.006
const DEFAULT_FOLLOW_DISTANCE = 3.2
const MIN_FOLLOW_DISTANCE = 1.35
const MAX_FOLLOW_DISTANCE = 8.5
const FOLLOW_WHEEL_ZOOM_SPEED = 0.0016
const FOLLOW_PINCH_ZOOM_SPEED = 0.012
const PAN_DRAG_THRESHOLD_PX = 5
const DEBUG_TOGGLE_EVENT = 'world-oceanarium-toggle-debug'
const SEARCH_FOCUS_EVENT = 'world-oceanarium-focus-creature'
const DEBUG_VIEW_MODES = [
  { id: 'all', icon: '◎', label: 'View all' },
  { id: 'focused', icon: '◉', label: 'Focused' },
  { id: 'none', icon: '○', label: 'None' },
]
const DEBUG_LAYER_BUTTONS = [
  { id: 'direction', icon: '↗', label: 'Show direction' },
  { id: 'name', icon: '#', label: 'Show name' },
  { id: 'lod', icon: 'L', label: 'Show LOD colors' },
]
const FPS_SAMPLE_MS = 1000
const DEPTH_ZONE_BY_ID = new Map(DEPTH_ZONES.map(zone => [zone.id, zone]))

function summarizeRenderLoad(creatures, biomeId) {
  const visibleCreatures = creatures.filter(creature => creature.alive && creature.biome === biomeId)
  const sardines = visibleCreatures.filter(creature => creature.species === 'Spotted Sardinella')
  return {
    visibleCreatures: visibleCreatures.length,
    sardines: sardines.length,
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

function clampFollowDistance(distance) {
  return Math.max(MIN_FOLLOW_DISTANCE, Math.min(MAX_FOLLOW_DISTANCE, distance))
}

function eventStartedInInfoCard(event) {
  return event.target instanceof Element && Boolean(event.target.closest('.info-card'))
}

function isMobileInputSurface() {
  return window.matchMedia?.('(hover: none), (pointer: coarse), (max-width: 768px)').matches ?? false
}

export default function TankView({ biome, creatures, creatureDataSource = 'unknown', creatureDataError = null, tankVisitSeed = 0, screenshotMode = false, onBack }) {
  const [selectedCreature, setSelectedCreature] = useState(null)
  const [focusedFishRef, setFocusedFishRef] = useState(null)
  const [debugMode, setDebugMode] = useState(false)
  const [debugView, setDebugView] = useState('none')
  const [debugLayers, setDebugLayers] = useState({ direction: true, name: true, lod: false })
  const [stagePan, setStagePan] = useState(0)
  const [stagePanning, setStagePanning] = useState(false)
  const [followOrbit, setFollowOrbit] = useState({ yaw: 0, pitch: 0 })
  const [followDistance, setFollowDistance] = useState(DEFAULT_FOLLOW_DISTANCE)
  const [followScreenOffset, setFollowScreenOffset] = useState(0)
  const [panLimits, setPanLimits] = useState(() => ({ enabled: false, maxPan: 0 }))
  const [performanceStats, setPerformanceStats] = useState({ fps: null })
  const performanceStatsRef = useRef({ fps: null })
  const audioLevels = useAudioLevels(debugMode)
  const dragRef = useRef(null)
  const touchPointsRef = useRef(new Map())
  const focusChangeAtRef = useRef(0)
  const fishRefsByCreatureId = useRef(new Map())
  const zoomActive = Boolean(selectedCreature)
  const visibleDebugVisuals = debugMode
  const visibleDebugPanel = debugMode && !screenshotMode
  const defaultDepthZone = DEPTH_ZONE_BY_ID.get(biome?.defaultDepthZone)
  const renderLoad = summarizeRenderLoad(creatures, biome?.id)

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
        setFollowScreenOffset(isMobileInputSurface() ? Math.min(0.4, cardHeight / Math.max(1, window.innerHeight)) : 0)
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
    focusChangeAtRef.current = performance.now()
    setSelectedCreature(creature)
    setFocusedFishRef(fishRef)
    setFollowOrbit({ yaw: 0, pitch: 0 })
  }

  const registerCreatureRef = (creature, fishRef) => {
    if (!creature?.id || !fishRef) return
    fishRefsByCreatureId.current.set(String(creature.id), fishRef)
  }

  const releaseFocus = () => {
    focusChangeAtRef.current = performance.now()
    touchPointsRef.current.clear()
    setSelectedCreature(null)
    setFocusedFishRef(null)
    setFollowOrbit({ yaw: 0, pitch: 0 })
    setFollowDistance(DEFAULT_FOLLOW_DISTANCE)
  }

  const adjustFollowDistance = (delta) => {
    setFollowDistance(current => clampFollowDistance(current + delta))
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
        const instanceDebug = window.__WO_SARDINE_INSTANCE_DEBUG
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
    const normalizedDelta = event.deltaMode === 1 ? event.deltaY * 16 : event.deltaY
    adjustFollowDistance(normalizedDelta * FOLLOW_WHEEL_ZOOM_SPEED * followDistance)
  }

  const startStageDrag = (event) => {
    if (event.button !== 0) return

    if (selectedCreature && event.pointerType === 'touch') {
      event.preventDefault()
      touchPointsRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY })
      if (touchPointsRef.current.size >= 2) {
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
        startOrbit: followOrbit,
        startFocusChangeAt: focusChangeAtRef.current,
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
      const pinchDistance = getTouchDistance(touchPointsRef.current)
      if (!pinchDistance || !drag.startDistance) return
      const pinchDelta = drag.startDistance - pinchDistance
      setFollowDistance(clampFollowDistance(drag.startFollowDistance + pinchDelta * FOLLOW_PINCH_ZOOM_SPEED))
      return
    }

    if (drag.pointerId !== event.pointerId) return

    if (drag.mode === 'orbit' || drag.mode === 'orbit-pending') {
      const deltaX = event.clientX - drag.startX
      const deltaY = event.clientY - drag.startY
      const moved = Math.hypot(deltaX, deltaY) > 5
      if (!moved && drag.mode === 'orbit-pending') return
      drag.mode = 'orbit'
      drag.moved = true
      setFollowOrbit({
        yaw: Math.max(-MAX_FOLLOW_ORBIT, Math.min(MAX_FOLLOW_ORBIT, drag.startOrbit.yaw - deltaX * FOLLOW_ORBIT_DRAG_SPEED)),
        pitch: Math.max(-MAX_FOLLOW_ORBIT, Math.min(MAX_FOLLOW_ORBIT, drag.startOrbit.pitch - deltaY * FOLLOW_ORBIT_DRAG_SPEED)),
      })
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
      setStagePanning(false)
      if (touchPointsRef.current.size < 2) dragRef.current = null
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
      if (drag.mode === 'orbit') {
        setFollowOrbit({ yaw: 0, pitch: 0 })
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
      className={`tank-viewport${panLimits.enabled ? ' can-pan' : ''}${stagePanning ? ' is-panning' : ''}${zoomActive ? ' is-following-fish' : ''}${screenshotMode ? ' is-screenshot-mode' : ''}`}
      style={{ '--stage-pan-x': `${stagePan}px` }}
    >
      <div
        className="tank-stage"
        onPointerDown={startStageDrag}
        onPointerMove={moveStageDrag}
        onPointerUp={endStageDrag}
        onPointerCancel={endStageDrag}
        onWheel={zoomFollowWithWheel}
      >
        <Canvas camera={{ fov: 60, near: 0.1, far: 200 }} onPointerMissed={zoomActive ? undefined : releaseFocus}>
          <SceneLighting biome={biome.id} />
          <Camera biome={biome.id} focusTarget={focusedFishRef?.current ?? null} followOrbit={followOrbit} followDistance={followDistance} followScreenOffset={followScreenOffset} />
          <Biome
            key={biome.id}
            name={biome.id}
            creatures={creatures}
            tankVisitSeed={tankVisitSeed}
            selectedCreatureId={selectedCreature?.id}
            zoomActive={zoomActive}
            hideSelectionSilhouette={screenshotMode}
            debug={visibleDebugVisuals}
            debugView={debugView}
            debugLayers={debugLayers}
            debugLodView={visibleDebugVisuals && Boolean(debugLayers.lod)}
            onCreatureClick={focusCreature}
            onCreatureReady={registerCreatureRef}
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

      {!screenshotMode && !zoomActive && <button onClick={onBack} aria-label="Back to biome menu" className="tank-back-button">←</button>}

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
          audioLevels={audioLevels}
          performanceStats={performanceStats}
          renderLoad={renderLoad}
          onDebugViewChange={setDebugView}
          onDebugLayerToggle={toggleDebugLayer}
        />
      )}

      {!screenshotMode && selectedCreature && <FocusHint />}
      {!screenshotMode && selectedCreature && (
        <InfoCard creature={selectedCreature} onClose={releaseFocus}>
          {visibleDebugPanel && (
            <DebugPanel
              className="debug-panel--inline"
              creatureDataSource={creatureDataSource}
              creatureDataError={creatureDataError}
              creatureCount={creatures.length}
              debugView={debugView}
              debugLayers={debugLayers}
              audioLevels={audioLevels}
              performanceStats={performanceStats}
              renderLoad={renderLoad}
              onDebugViewChange={setDebugView}
              onDebugLayerToggle={toggleDebugLayer}
            />
          )}
        </InfoCard>
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
  audioLevels,
  performanceStats,
  renderLoad,
  onDebugViewChange,
  onDebugLayerToggle,
}) {
  const sardineCount = clampDebugCount(renderLoad?.sardines)
  const lod1Drawn = clampDebugCount(performanceStats?.lod1Drawn)
  const lod1Candidates = Math.max(lod1Drawn, clampDebugCount(performanceStats?.lod1Candidates))
  const lod2Drawn = clampDebugCount(performanceStats?.instancedDrawn)
  const lod2Candidates = Math.max(lod2Drawn, clampDebugCount(performanceStats?.sardineCandidates))
  const lod0Candidates = clampDebugCount(performanceStats?.lod0Candidates) || Math.max(0, sardineCount - lod1Candidates - lod2Candidates)
  const lod0Drawn = Math.min(lod0Candidates, clampDebugCount(performanceStats?.lod0Drawn))
  const frustumCandidates = clampDebugCount(performanceStats?.frustumCandidates)
  const frustumCulled = Math.min(frustumCandidates, clampDebugCount(performanceStats?.frustumCulled))

  return (
    <div className={`debug-panel ${className}`}>
      <div>Data: {creatureDataSource}</div>
      <div>Creatures: {creatureCount}</div>
      <div>Visible: {renderLoad?.visibleCreatures ?? '—'} · Sardines: {renderLoad?.sardines ?? '—'}</div>
      <div>FPS: {Number.isFinite(performanceStats?.fps) ? performanceStats.fps : '—'}</div>
      <div>LOD0: {lod0Drawn}/{lod0Candidates}</div>
      <div>LOD1: {lod1Drawn}/{lod1Candidates}</div>
      <div>LOD2: {lod2Drawn}/{lod2Candidates}</div>
      <div>Frustum: {frustumCulled}/{frustumCandidates}</div>
      <div className="debug-panel-row">
        <span className="debug-panel-label">Debug</span>
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
      <div className="debug-panel-row debug-panel-row--wrap">
        {DEBUG_LAYER_BUTTONS.map(layer => (
          <button
            key={layer.id}
            type="button"
            title={layer.label}
            aria-label={`Toggle ${layer.label}`}
            aria-pressed={debugLayers[layer.id]}
            className="debug-panel-button"
            onClick={() => onDebugLayerToggle(layer.id)}
          >
            {layer.icon}
          </button>
        ))}
      </div>
      <AudioDebugMeters levels={audioLevels} />
      {creatureDataError && (
        <div className="debug-panel-error">
          {creatureDataError.code ? `${creatureDataError.code}: ` : ''}{creatureDataError.message ?? String(creatureDataError)}
        </div>
      )}
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
