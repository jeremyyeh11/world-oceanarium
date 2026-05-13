import { useState } from 'react'
import Landing from './components/Landing'
import BiomeMenu from './components/BiomeMenu'
import TankView from './components/TankView'
import { BIOMES } from './data/species'
import { useCreatures } from './hooks/useCreatures'

const DEFAULT_BIOME_ID = 'ocean'
const ACTIVE_BIOMES = BIOMES.filter(biome => biome.id === DEFAULT_BIOME_ID)

export default function App() {
  const [screen, setScreen] = useState('landing')
  const [activeBiome, setActiveBiome] = useState(DEFAULT_BIOME_ID)
  const { creatures } = useCreatures()

  const enterSite = () => {
    setActiveBiome(DEFAULT_BIOME_ID)
    setScreen('tank')
  }
  const selectBiome = (biomeId) => {
    setActiveBiome(biomeId)
    setScreen('tank')
  }
  const backToLanding = () => {
    setActiveBiome(DEFAULT_BIOME_ID)
    setScreen('landing')
  }

  if (screen === 'landing') return <Landing onEnter={enterSite} />

  // Kept intact for future multi-tank work, but hidden while Ocean is the only active tank.
  if (screen === 'menu') return <BiomeMenu biomes={ACTIVE_BIOMES} onSelect={selectBiome} />

  if (screen === 'tank' && activeBiome) {
    const biome = ACTIVE_BIOMES.find(b => b.id === activeBiome) ?? ACTIVE_BIOMES[0]
    return <TankView biome={biome} creatures={creatures} onBack={backToLanding} />
  }

  return null
}
