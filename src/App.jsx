import { useRef, useState } from 'react'
import Landing from './components/Landing'
import BiomeMenu from './components/BiomeMenu'
import TankView from './components/TankView'
import { BIOMES } from './data/species'
import { useCreatures } from './hooks/useCreatures'
import { APP_VERSION_LABEL } from './version'

const DEFAULT_BIOME_ID = 'ocean'
const ACTIVE_BIOMES = BIOMES.filter(biome => biome.id === DEFAULT_BIOME_ID)
const DEBUG_LONG_PRESS_MS = 900
const DEBUG_TOGGLE_EVENT = 'world-oceanarium-toggle-debug'

export default function App() {
  const [screen, setScreen] = useState('landing')
  const [activeBiome, setActiveBiome] = useState(DEFAULT_BIOME_ID)
  const debugPressTimer = useRef(null)
  const creatureData = useCreatures()

  const clearDebugPressTimer = () => {
    if (!debugPressTimer.current) return
    window.clearTimeout(debugPressTimer.current)
    debugPressTimer.current = null
  }

  const startDebugLongPress = () => {
    clearDebugPressTimer()
    debugPressTimer.current = window.setTimeout(() => {
      debugPressTimer.current = null
      window.dispatchEvent(new CustomEvent(DEBUG_TOGGLE_EVENT))
    }, DEBUG_LONG_PRESS_MS)
  }

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

  let page = null

  if (screen === 'landing') {
    page = <Landing onEnter={enterSite} />
  } else if (screen === 'menu') {
    // Kept intact for future multi-tank work, but hidden while Ocean is the only active tank.
    page = <BiomeMenu biomes={ACTIVE_BIOMES} onSelect={selectBiome} />
  } else if (screen === 'tank' && activeBiome) {
    const biome = ACTIVE_BIOMES.find(b => b.id === activeBiome) ?? ACTIVE_BIOMES[0]
    page = <TankView biome={biome} creatures={creatureData.creatures} creatureDataSource={creatureData.source} creatureDataError={creatureData.error} onBack={backToLanding} />
  }

  return (
    <>
      {page}
      <button
        className="app-version-footnote"
        type="button"
        aria-label="Hold to toggle debug mode"
        onPointerDown={startDebugLongPress}
        onPointerUp={clearDebugPressTimer}
        onPointerCancel={clearDebugPressTimer}
        onPointerLeave={clearDebugPressTimer}
        onContextMenu={(event) => event.preventDefault()}
      >
        {APP_VERSION_LABEL}
      </button>
    </>
  )
}
