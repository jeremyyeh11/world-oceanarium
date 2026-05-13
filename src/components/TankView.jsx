import { Canvas } from '@react-three/fiber'
import { useEffect, useRef, useState } from 'react'
import Camera from './Camera'
import Biome from './Biome'
import WaterSurface from './WaterSurface'
import SceneLighting from './SceneLighting'
import InfoCard from './InfoCard'

function getPanLimits() {
  const viewportWidth = window.innerWidth
  const viewportHeight = window.innerHeight
  const stageWidth = Math.max(viewportWidth, viewportHeight * 16 / 9)
  const croppedRatio = Math.max(0, stageWidth - viewportWidth) / stageWidth
  const enabled = croppedRatio > 0.3
  return { enabled, maxPan: enabled ? (stageWidth - viewportWidth) / 2 : 0 }
}

export default function TankView({ biome, creatures, onBack }) {
  const [selectedCreature, setSelectedCreature] = useState(null)
  const [focusedFishRef, setFocusedFishRef] = useState(null)
  const [debugMode, setDebugMode] = useState(false)
  const [stagePan, setStagePan] = useState(0)
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

  const focusCreature = (creature, fishRef) => {
    setSelectedCreature(creature)
    setFocusedFishRef(fishRef)
  }

  const releaseFocus = () => {
    setSelectedCreature(null)
    setFocusedFishRef(null)
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
    if (!panLimits.enabled || event.button !== 0) return
    dragRef.current = { pointerId: event.pointerId, startX: event.clientX, startPan: stagePan }
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const moveStageDrag = (event) => {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== event.pointerId) return
    const nextPan = drag.startPan + event.clientX - drag.startX
    setStagePan(Math.max(-panLimits.maxPan, Math.min(panLimits.maxPan, nextPan)))
  }

  const endStageDrag = (event) => {
    if (dragRef.current?.pointerId === event.pointerId) dragRef.current = null
  }

  return (
    <div className={`tank-viewport${panLimits.enabled ? ' can-pan' : ''}`}>
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
          <Camera biome={biome.id} focusTarget={focusedFishRef?.current ?? null} />
          <Biome
            key={biome.id}
            name={biome.id}
            creatures={creatures}
            selectedCreatureId={selectedCreature?.id}
            zoomActive={zoomActive}
            debug={debugMode}
            onCreatureClick={focusCreature}
          />
          <WaterSurface biome={biome.id} />
        </Canvas>
      </div>

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
          <div style={{ marginTop: '0.35rem', color: 'rgba(185,225,255,0.46)', fontSize: '0.68rem', letterSpacing: '0.18em', textTransform: 'uppercase' }}>
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

      {selectedCreature && <FocusHint />}
      {selectedCreature && <InfoCard creature={selectedCreature} onClose={releaseFocus} />}
    </div>
  )
}

function FocusHint() {
  return (
    <div style={{
      position: 'absolute', top: '4rem', left: '50%', transform: 'translateX(-50%)',
      color: 'rgba(230,245,255,0.55)', fontFamily: 'system-ui, sans-serif', fontSize: '0.72rem',
      letterSpacing: '0.08em', textTransform: 'uppercase', pointerEvents: 'none',
      background: 'rgba(0,10,30,0.35)', border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: 999, padding: '0.45rem 0.7rem', backdropFilter: 'blur(6px)',
    }}>
      Following fish · click water or close card to release
    </div>
  )
}
