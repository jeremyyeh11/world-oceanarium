import { useState } from 'react'
import Landing from './components/Landing'
import BiomeMenu from './components/BiomeMenu'
import TankView from './components/TankView'
import { BIOMES } from './data/species'
import { useCreatures } from './hooks/useCreatures'

export default function App() {
  const [screen, setScreen] = useState('landing')
  const [activeBiome, setActiveBiome] = useState(null)
  const { creatures } = useCreatures()

  const enterSite = () => setScreen('menu')
  const selectBiome = (biomeId) => {
    setActiveBiome(biomeId)
    setScreen('tank')
  }
  const backToMenu = () => {
    setActiveBiome(null)
    setScreen('menu')
  }

  if (screen === 'landing') return <Landing onEnter={enterSite} />

  if (screen === 'menu') return <BiomeMenu biomes={BIOMES} onSelect={selectBiome} />

  if (screen === 'tank' && activeBiome) {
    const biome = BIOMES.find(b => b.id === activeBiome)
    return <TankView biome={biome} creatures={creatures} onBack={backToMenu} />
  }

  return null
}
