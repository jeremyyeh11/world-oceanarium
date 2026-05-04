import { Canvas } from '@react-three/fiber'
import { useState } from 'react'
import Camera from './Camera'
import Biome from './Biome'
import WaterSurface from './WaterSurface'
import InfoCard from './InfoCard'

export default function TankView({ biome, creatures, onBack }) {
  const [selectedCreature, setSelectedCreature] = useState(null)
  const [focusedFishRef, setFocusedFishRef] = useState(null)
  const [scrollY, setScrollY] = useState(1)

  const focusCreature = (creature, fishRef) => {
    setSelectedCreature(creature)
    setFocusedFishRef(fishRef)
  }

  const releaseFocus = () => {
    setSelectedCreature(null)
    setFocusedFishRef(null)
  }

  return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative' }}>
      <Canvas camera={{ fov: 60, near: 0.1, far: 200 }} onPointerMissed={releaseFocus}>
        <color attach="background" args={[biome.id === 'tropical-river' ? '#0a2818' : '#061a2e']} />
        <fog attach="fog" args={[biome.id === 'tropical-river' ? '#0a2818' : '#061a2e', 25, 80]} />
        <ambientLight intensity={biome.id === 'tropical-river' ? 0.5 : 0.4} />
        <directionalLight position={[5, 10, 5]} intensity={biome.id === 'tropical-river' ? 0.7 : 0.8} color={biome.id === 'tropical-river' ? '#c4e8a0' : '#7ecfff'} />
        <pointLight position={[0, 5, 5]} intensity={0.3} color={biome.id === 'tropical-river' ? '#80cc60' : '#00aaff'} />
        <Camera biome={biome.id} focusTarget={focusedFishRef?.current ?? null} onScrollChange={setScrollY} />
        <Biome
          key={biome.id}
          name={biome.id}
          creatures={creatures}
          selectedCreatureId={selectedCreature?.id}
          onCreatureClick={focusCreature}
        />
        <WaterSurface biome={biome.id} />
      </Canvas>

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

      <DepthIndicator scrollY={scrollY} />

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

function DepthIndicator({ scrollY }) {
  const thumbTop = `${(1 - scrollY) * 80 + 10}%`
  return (
    <div style={{ position: 'absolute', right: '4rem', top: '10%', height: '80%', width: 4, background: 'rgba(255,255,255,0.1)', borderRadius: 2 }}>
      <div style={{ position: 'absolute', left: -3, width: 10, height: 10, borderRadius: '50%', background: 'rgba(255,255,255,0.6)', top: thumbTop, transform: 'translateY(-50%)', transition: 'top 0.1s ease' }} />
      <div style={{ position: 'absolute', top: '-1.2rem', right: '-0.5rem', color: 'rgba(255,255,255,0.3)', fontSize: '0.65rem', fontFamily: 'system-ui' }}>↑</div>
      <div style={{ position: 'absolute', bottom: '-1.2rem', right: '-0.5rem', color: 'rgba(255,255,255,0.3)', fontSize: '0.65rem', fontFamily: 'system-ui' }}>↓</div>
    </div>
  )
}
