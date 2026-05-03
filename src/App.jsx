import { Canvas } from '@react-three/fiber'
import { useState } from 'react'
import Camera from './components/Camera'
import Biome from './components/Biome'
import WaterSurface from './components/WaterSurface'
import UI from './components/UI'
import InfoCard from './components/InfoCard'
import { useCreatures } from './hooks/useCreatures'

const BIOMES = ['ocean', 'reef']

export default function App() {
  const [biomeIndex, setBiomeIndex] = useState(0)
  const [selectedCreature, setSelectedCreature] = useState(null)
  const [transitioning, setTransitioning] = useState(false)
  const [scrollY, setScrollY] = useState(1)
  const { creatures } = useCreatures()

  const changeBiome = (delta) => {
    const next = ((biomeIndex + delta) % BIOMES.length + BIOMES.length) % BIOMES.length
    setTransitioning(true)
    setTimeout(() => {
      setBiomeIndex(next)
      setSelectedCreature(null)
      setTimeout(() => setTransitioning(false), 200)
    }, 150)
  }

  return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative' }}>
      <div style={{
        width: '100%', height: '100%',
        filter: transitioning ? 'blur(8px)' : 'none',
        transition: 'filter 0.15s ease',
      }}>
        <Canvas camera={{ fov: 60, near: 0.1, far: 200 }}>
          <color attach="background" args={['#061a2e']} />
          <fog attach="fog" args={['#061a2e', 25, 80]} />
          <ambientLight intensity={0.4} />
          <directionalLight position={[5, 10, 5]} intensity={0.8} color="#7ecfff" />
          <pointLight position={[0, 5, 5]} intensity={0.3} color="#00aaff" />

          <Camera biomeIndex={biomeIndex} biomeSpacing={0} onScrollChange={setScrollY} />

          <Biome
            key={BIOMES[biomeIndex]}
            name={BIOMES[biomeIndex]}
            creatures={creatures}
            onCreatureClick={setSelectedCreature}
          />

          <WaterSurface />
        </Canvas>
      </div>

      <UI
        biomeIndex={biomeIndex}
        biomeCount={BIOMES.length}
        biomeNames={BIOMES}
        scrollY={scrollY}
        onPrev={() => changeBiome(-1)}
        onNext={() => changeBiome(1)}
      />

      {selectedCreature && (
        <InfoCard creature={selectedCreature} onClose={() => setSelectedCreature(null)} />
      )}
    </div>
  )
}
