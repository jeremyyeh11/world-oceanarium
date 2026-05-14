import { Canvas } from '@react-three/fiber'
import { useEffect, useRef, useState } from 'react'
import Camera from './Camera'
import Biome from './Biome'
import WaterSurface from './WaterSurface'
import SceneLighting from './SceneLighting'
import UnderwaterFX from './UnderwaterFX'
import InfoCard from './InfoCard'

const MAX_FOLLOW_ORBIT = Math.PI / 6
const FOLLOW_ORBIT_DRAG_SPEED = 0.006

function getPanLimits() {
  const viewportWidth = window.innerWidth
  const viewportHeight = window.innerHeight
  const stageWidth = Math.max(viewportWidth, viewportHeight * 16 / 9)
  const croppedRatio = Math.max(0, stageWidth - viewportWidth) / stageWidth
  const enabled = croppedRatio > 0.3
  return { enabled, maxPan: enabled ? (stageWidth - viewportWidth) / 2 : 0 }
}

export default function TankView({ biome, creatures, creatureDataSource = 'unknown', creatureDataError = null, onBack }) {
  const [selectedCreature, setSelectedCreature] = useState(null)
  const [focusedFishRef, setFocusedFishRef] = useState(null)
  const [debugMode, setDebugMode] = useState(false)
  const [stagePan, setStagePan] = useState(0)
  const [followOrbit, setFollowOrbit] = useState({ yaw: 0, pitch: 0 })
  const [panLimits, setPanLimits] = useState(() => ({ enabled: false, maxPan: 0 }))
  const dragRef = useRef(null)
  const zoomActive = Boolean(selectedCreature)

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
    if (!selectedCreature) return undefined

    const closeOnEscape = (event) => {
      if (event.key === 'Escape') releaseFocus()
    }

    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [selectedCreature])

  const focusCreature = (creature, fishRef) => {
    setSelectedCreature(creature)
    setFocusedFishRef(fishRef)
    setFollowOrbit({ yaw: 0, pitch: 0 })
  }

  const releaseFocus = () => {
    setSelectedCreature(null)
    setFocusedFishRef(null)
    setFollowOrbit({ yaw: 0, pitch: 0 })
  }

  const toggleDebugMode = () => {
    if (debugMode) {
      setDebugMode(false)
      return
    }

    const passcode = window.prompt('Enter debug passcode')
    if (passcode === '5373') setDebugMode(true)
  }

  const startStageDrag = (event) => {
    if (event.button !== 0) return

    if (selectedCreature) {
      dragRef.current = {
        mode: 'orbit',
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        startOrbit: followOrbit,
      }
      event.currentTarget.setPointerCapture(event.pointerId)
      return
    }

    if (!panLimits.enabled) return
    dragRef.current = { mode: 'pan', pointerId: event.pointerId, startX: event.clientX, startPan: stagePan }
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const moveStageDrag = (event) => {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== event.pointerId) return

    if (drag.mode === 'orbit') {
      const deltaX = event.clientX - drag.startX
      const deltaY = event.clientY - drag.startY
      drag.moved = drag.moved || Math.hypot(deltaX, deltaY) > 5
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
    if (dragRef.current?.pointerId !== event.pointerId) return
    if (dragRef.current.mode === 'orbit') {
      const shouldReleaseFocus = !dragRef.current.moved
      setFollowOrbit({ yaw: 0, pitch: 0 })
      dragRef.current = null
      if (shouldReleaseFocus) releaseFocus()
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
      >
        <Canvas camera={{ fov: 60, near: 0.1, far: 200 }} onPointerMissed={releaseFocus}>
          <SceneLighting biome={biome.id} />
          <Camera biome={biome.id} focusTarget={focusedFishRef?.current ?? null} followOrbit={followOrbit} />
          <Biome
            key={biome.id}
            name={biome.id}
            creatures={creatures}
            selectedCreatureId={selectedCreature?.id}
            zoomActive={zoomActive}
            debug={debugMode}
            onCreatureClick={focusCreature}
          />
          {!zoomActive && <WaterSurface biome={biome.id} />}
          {!zoomActive && <UnderwaterFX biome={biome.id} />}
        </Canvas>
      </div>

      <div className="tank-top-exposure" aria-hidden="true" />

      <button onClick={onBack} aria-label="Back to biome menu" style={{
        position: 'absolute', top: '1.25rem', left: '1.25rem', background: 'rgba(0,10,30,0.65)',
        border: '1px solid rgba(255,255,255,0.12)', color: '#fff', fontSize: '1rem', width: 44, height: 44,
        borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(6px)',
      }}>←</button>

      <div style={{
        position: 'absolute', top: '1.5rem', left: '50%', transform: 'translateX(-50%)',
        color: 'rgba(255,255,255,0.7)', fontFamily: 'system-ui, sans-serif', textAlign: 'center',
        pointerEvents: 'none',
      }}>
        <div style={{ fontSize: '0.85rem', letterSpacing: '0.15em', textTransform: 'uppercase' }}>{biome.name}</div>
        {biome.id === 'ocean' && (
          <div style={{ marginTop: '0.5rem', color: 'rgba(185,225,255,0.46)', fontSize: '0.68rem', letterSpacing: '0.18em', textTransform: 'uppercase' }}>
            Sunlight Zone
          </div>
        )}
      </div>

      <button
        className={`debug-mode-button${debugMode ? ' is-active' : ''}`}
        onClick={toggleDebugMode}
        aria-pressed={debugMode}
      >
        {debugMode ? 'Debug Mode On' : 'Debug Mode'}
      </button>

      {debugMode && (
        <div style={{
          position: 'absolute', right: '1rem', bottom: '4.25rem', zIndex: 55,
          padding: '0.5rem 0.65rem', borderRadius: 10,
          border: '1px solid rgba(125,249,255,0.22)',
          background: 'rgba(0,13,28,0.58)', color: 'rgba(220,245,255,0.72)',
          font: '0.68rem/1.35 ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
          letterSpacing: '0.04em', textTransform: 'uppercase', backdropFilter: 'blur(8px)',
          pointerEvents: 'none',
        }}>
          <div>Data: {creatureDataSource}</div>
          <div>Creatures: {creatures.length}</div>
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
    <div style={{
      position: 'absolute', top: '4.8rem', left: '50%', transform: 'translateX(-50%)',
      color: 'rgba(230,245,255,0.55)', fontFamily: 'system-ui, sans-serif', fontSize: '0.72rem',
      letterSpacing: '0.08em', textTransform: 'uppercase', pointerEvents: 'none',
      background: 'rgba(0,10,30,0.35)', border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: 999, padding: '0.45rem 0.7rem', backdropFilter: 'blur(6px)',
    }}>
      Following fish
    </div>
  )
}
