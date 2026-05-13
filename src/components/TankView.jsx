import { Canvas } from '@react-three/fiber'
import { useState } from 'react'
import Camera from './Camera'
import Biome from './Biome'
import WaterSurface from './WaterSurface'
import SceneLighting from './SceneLighting'
import InfoCard from './InfoCard'

export default function TankView({ biome, creatures, onBack }) {
  const [selectedCreature, setSelectedCreature] = useState(null)
  const [focusedFishRef, setFocusedFishRef] = useState(null)
  const [debugMode, setDebugMode] = useState(false)
  const zoomActive = Boolean(selectedCreature)

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

  return (
    <div className="tank-viewport">
      <div className="tank-stage">
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
