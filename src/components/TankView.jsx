import { Canvas } from '@react-three/fiber'
import { useEffect, useRef, useState } from 'react'
import Camera from './Camera'
import Biome from './Biome'
import WaterSurface from './WaterSurface'
import SceneLighting from './SceneLighting'
import UnderwaterFX from './UnderwaterFX'
import InfoCard from './InfoCard'
import { DEPTH_ZONES } from '../data/species'

const MAX_FOLLOW_ORBIT = Math.PI / 6
const FOLLOW_ORBIT_DRAG_SPEED = 0.006
const DEFAULT_FOLLOW_DISTANCE = 3.2
const MIN_FOLLOW_DISTANCE = 1.35
const MAX_FOLLOW_DISTANCE = 8.5
const FOLLOW_WHEEL_ZOOM_SPEED = 0.0016
const FOLLOW_PINCH_ZOOM_SPEED = 0.012
const DEBUG_TOGGLE_EVENT = 'world-oceanarium-toggle-debug'
const SEARCH_FOCUS_EVENT = 'world-oceanarium-focus-creature'
const DEBUG_VIEW_MODES = [
  { id: 'all', icon: '◎', label: 'View all' },
  { id: 'focused', icon: '◉', label: 'Focused' },
  { id: 'none', icon: '○', label: 'None' },
]
const DEBUG_LAYER_BUTTONS = [
  { id: 'spline', icon: '〰', label: 'Spline' },
  { id: 'numbers', icon: '#', label: 'Numbers' },
  { id: 'vectors', icon: '↗', label: 'Vectors' },
]
const DEPTH_ZONE_BY_ID = new Map(DEPTH_ZONES.map(zone => [zone.id, zone]))

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

export default function TankView({ biome, creatures, creatureDataSource = 'unknown', creatureDataError = null, tankVisitSeed = 0, onBack }) {
  const [selectedCreature, setSelectedCreature] = useState(null)
  const [focusedFishRef, setFocusedFishRef] = useState(null)
  const [debugMode, setDebugMode] = useState(false)
  const [debugView, setDebugView] = useState('all')
  const [debugLayers, setDebugLayers] = useState({ spline: true, numbers: true, vectors: true })
  const [stagePan, setStagePan] = useState(0)
  const [followOrbit, setFollowOrbit] = useState({ yaw: 0, pitch: 0 })
  const [followDistance, setFollowDistance] = useState(DEFAULT_FOLLOW_DISTANCE)
  const [panLimits, setPanLimits] = useState(() => ({ enabled: false, maxPan: 0 }))
  const dragRef = useRef(null)
  const touchPointsRef = useRef(new Map())
  const focusChangeAtRef = useRef(0)
  const fishRefsByCreatureId = useRef(new Map())
  const zoomActive = Boolean(selectedCreature)
  const defaultDepthZone = DEPTH_ZONE_BY_ID.get(biome?.defaultDepthZone)

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
    dragRef.current = { mode: 'pan', pointerId: event.pointerId, startX: event.clientX, startPan: stagePan }
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const moveStageDrag = (event) => {
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
    setStagePan(Math.max(-panLimits.maxPan, Math.min(panLimits.maxPan, nextPan)))
  }

  const endStageDrag = (event) => {
    if (event.pointerType === 'touch') touchPointsRef.current.delete(event.pointerId)

    if (dragRef.current?.mode === 'pinch') {
      if (touchPointsRef.current.size < 2) dragRef.current = null
      return
    }

    if (dragRef.current?.pointerId !== event.pointerId) return
    if (dragRef.current.mode === 'orbit' || dragRef.current.mode === 'orbit-pending') {
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
  }

  return (
    <div className={`tank-viewport${panLimits.enabled ? ' can-pan' : ''}${zoomActive ? ' is-following-fish' : ''}`}>
      <div
        className="tank-stage"
        style={{ '--stage-pan-x': `${stagePan}px` }}
        onPointerDown={startStageDrag}
        onPointerMove={moveStageDrag}
        onPointerUp={endStageDrag}
        onPointerCancel={endStageDrag}
        onWheel={zoomFollowWithWheel}
      >
        <Canvas camera={{ fov: 60, near: 0.1, far: 200 }} onPointerMissed={zoomActive ? undefined : releaseFocus}>
          <SceneLighting biome={biome.id} />
          <Camera biome={biome.id} focusTarget={focusedFishRef?.current ?? null} followOrbit={followOrbit} followDistance={followDistance} />
          <Biome
            key={biome.id}
            name={biome.id}
            creatures={creatures}
            tankVisitSeed={tankVisitSeed}
            selectedCreatureId={selectedCreature?.id}
            zoomActive={zoomActive}
            debug={debugMode}
            debugView={debugView}
            debugLayers={debugLayers}
            onCreatureClick={focusCreature}
            onCreatureReady={registerCreatureRef}
          />
          {!zoomActive && <WaterSurface biome={biome.id} />}
          {!zoomActive && <UnderwaterFX biome={biome.id} />}
        </Canvas>
      </div>

      <div className="tank-top-exposure" aria-hidden="true" />

      <button onClick={onBack} aria-label="Back to biome menu" className="tank-back-button">←</button>

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

      {debugMode && (
        <div style={{
          position: 'absolute', left: '1rem', bottom: '4.25rem', zIndex: 55,
          padding: '0.5rem 0.65rem', borderRadius: 10,
          border: '1px solid rgba(125,249,255,0.22)',
          background: 'rgba(0,13,28,0.58)', color: 'rgba(220,245,255,0.72)',
          font: '0.68rem/1.35 ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
          letterSpacing: '0.04em', textTransform: 'uppercase', backdropFilter: 'blur(8px)',
          pointerEvents: 'auto',
        }}>
          <div>Data: {creatureDataSource}</div>
          <div>Creatures: {creatures.length}</div>
          <div style={{ marginTop: '0.42rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <span style={{ opacity: 0.7 }}>Debug</span>
            {DEBUG_VIEW_MODES.map(mode => (
              <button
                key={mode.id}
                type="button"
                title={mode.label}
                aria-label={`Debug ${mode.label}`}
                aria-pressed={debugView === mode.id}
                onClick={() => setDebugView(mode.id)}
                style={{
                  width: 26,
                  height: 24,
                  borderRadius: 999,
                  border: debugView === mode.id ? '1px solid rgba(125,249,255,0.72)' : '1px solid rgba(125,249,255,0.18)',
                  background: debugView === mode.id ? 'rgba(0,60,78,0.7)' : 'rgba(0,18,32,0.46)',
                  color: debugView === mode.id ? 'rgba(245,255,255,0.96)' : 'rgba(220,245,255,0.62)',
                  cursor: 'pointer',
                  lineHeight: 1,
                }}
              >
                {mode.icon}
              </button>
            ))}
          </div>
          <div style={{ marginTop: '0.42rem', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.32rem' }}>
            {DEBUG_LAYER_BUTTONS.map(layer => (
              <button
                key={layer.id}
                type="button"
                title={layer.label}
                aria-label={`Toggle ${layer.label}`}
                aria-pressed={debugLayers[layer.id]}
                onClick={() => toggleDebugLayer(layer.id)}
                style={{
                  width: 26,
                  height: 24,
                  borderRadius: 999,
                  border: debugLayers[layer.id] ? '1px solid rgba(125,249,255,0.64)' : '1px solid rgba(125,249,255,0.16)',
                  background: debugLayers[layer.id] ? 'rgba(0,60,78,0.62)' : 'rgba(0,18,32,0.38)',
                  color: debugLayers[layer.id] ? 'rgba(245,255,255,0.92)' : 'rgba(220,245,255,0.48)',
                  cursor: 'pointer',
                  font: '0.74rem/1 ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                  lineHeight: 1,
                  padding: 0,
                }}
              >
                {layer.icon}
              </button>
            ))}
          </div>
          {creatureDataError && (
            <div style={{ maxWidth: 280, whiteSpace: 'normal', textTransform: 'none', color: 'rgba(255,205,205,0.8)' }}>
              {creatureDataError.code ? `${creatureDataError.code}: ` : ''}{creatureDataError.message ?? String(creatureDataError)}
            </div>
          )}
        </div>
      )}

      {selectedCreature && <FocusHint />}
      {selectedCreature && <InfoCard creature={selectedCreature} onClose={releaseFocus} />}
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
