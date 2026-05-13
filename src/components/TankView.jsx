import { Canvas } from '@react-three/fiber'
import { useState } from 'react'
import Camera from './Camera'
import Biome from './Biome'
import WaterSurface from './WaterSurface'
import InfoCard from './InfoCard'
import FX from './FX'

export default function TankView({ biome, creatures, onBack }) {
  const [selectedCreature, setSelectedCreature] = useState(null)
  const [focusedFishRef, setFocusedFishRef] = useState(null)
  const zoomActive = Boolean(selectedCreature)

  const focusCreature = (creature, fishRef) => {
    setSelectedCreature(creature)
    setFocusedFishRef(fishRef)
  }

  const releaseFocus = () => {
    setSelectedCreature(null)
    setFocusedFishRef(null)
  }

  return (
    <div className="tank-viewport">
      <div className="tank-stage">
        <Canvas camera={{ fov: 60, near: 0.1, far: 200 }} onPointerMissed={releaseFocus}>
          <color attach="background" args={[biome.id === 'tropical-river' ? '#06251d' : '#041c2b']} />
          <fogExp2 attach="fog" args={[biome.id === 'tropical-river' ? '#11b889' : '#08a9bf', biome.id === 'tropical-river' ? 0.085 : 0.055]} />
          <ambientLight intensity={biome.id === 'tropical-river' ? 0.45 : 0.36} color={biome.id === 'tropical-river' ? '#73ffd0' : '#78f7ff'} />
          <directionalLight position={[-4, 8, 5]} intensity={biome.id === 'tropical-river' ? 1.05 : 0.95} color={biome.id === 'tropical-river' ? '#b8ffd0' : '#9ffcff'} />
          <pointLight position={[0, 2, 5]} intensity={0.42} color={biome.id === 'tropical-river' ? '#7cffba' : '#35f5ff'} />
          <Camera biome={biome.id} focusTarget={focusedFishRef?.current ?? null} />
          <Biome
            key={biome.id}
            name={biome.id}
            creatures={creatures}
            selectedCreatureId={selectedCreature?.id}
            zoomActive={zoomActive}
            onCreatureClick={focusCreature}
          />
          <WaterSurface biome={biome.id} />
          <FX biome={biome.id} />
        </Canvas>
      </div>

      {biome.id === 'tropical-river' && <TropicalRiverReferenceLayer />}

      <button onClick={onBack} aria-label="Back to biome menu" style={{
        position: 'absolute', top: '1.25rem', left: '1.25rem', background: 'rgba(0,10,30,0.65)',
        border: '1px solid rgba(255,255,255,0.12)', color: '#fff', fontSize: '1rem', width: 44, height: 44,
        borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(6px)',
      }}>←</button>

      <div style={{
        position: 'absolute', top: '1.5rem', left: '50%', transform: 'translateX(-50%)',
        color: 'rgba(255,255,255,0.7)', fontFamily: 'system-ui, sans-serif',
        fontSize: '0.85rem', letterSpacing: '0.15em', textTransform: 'uppercase', pointerEvents: 'none',
      }}>{biome.name}</div>

      {selectedCreature && <FocusHint />}
      {selectedCreature && <InfoCard creature={selectedCreature} onClose={releaseFocus} />}
    </div>
  )
}

function TropicalRiverReferenceLayer() {
  const markers = [
    ['12%', '62%', '-14deg'], ['34%', '70%', '9deg'], ['58%', '58%', '-5deg'], ['78%', '77%', '15deg'],
  ]

  return (
    <div className="river-reference-layer" aria-hidden="true">
      <div className="river-map-title">TROPICAL RIVER</div>
      <svg className="river-bank-svg" viewBox="0 0 100 100" preserveAspectRatio="none">
        <path d="M0 0 H100 V54 L91 59 L82 55 L73 63 L62 57 L53 64 L44 58 L35 62 L27 55 L18 60 L9 54 L0 58 Z" />
      </svg>
      <div className="river-water" />
      <div className="river-contours" />
      <div className="river-vignette" />
      {markers.map(([left, top, rotate], i) => (
        <span key={i} className="river-marker" style={{ left, top, transform: `rotate(${rotate})` }} />
      ))}
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
