import { useRef, useState } from 'react'
import Landing from './components/Landing'
import BiomeMenu from './components/BiomeMenu'
import TankView from './components/TankView'
import { BIOMES } from './data/species'
import { useCreatures } from './hooks/useCreatures'
import { APP_VERSION_LABEL } from './version'

const DEFAULT_BIOME_ID = 'ocean'
const ACTIVE_BIOMES = BIOMES.filter(biome => biome.id === DEFAULT_BIOME_ID)
const DEBUG_TAP_WINDOW_MS = 1200
const DEBUG_REQUIRED_TAPS = 3
const DEBUG_TOGGLE_EVENT = 'world-oceanarium-toggle-debug'

export default function App() {
  const [screen, setScreen] = useState('landing')
  const [activeBiome, setActiveBiome] = useState(DEFAULT_BIOME_ID)
  const debugTapCount = useRef(0)
  const debugTapTimer = useRef(null)
  const creatureData = useCreatures()

  const resetDebugTaps = () => {
    debugTapCount.current = 0
    if (!debugTapTimer.current) return
    window.clearTimeout(debugTapTimer.current)
    debugTapTimer.current = null
  }

  const handleDebugTap = () => {
    if (debugTapTimer.current) {
      window.clearTimeout(debugTapTimer.current)
    }

    debugTapCount.current += 1

    if (debugTapCount.current >= DEBUG_REQUIRED_TAPS) {
      resetDebugTaps()
      window.dispatchEvent(new CustomEvent(DEBUG_TOGGLE_EVENT))
      return
    }

    debugTapTimer.current = window.setTimeout(resetDebugTaps, DEBUG_TAP_WINDOW_MS)
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
        aria-label="Tap three times to toggle debug mode"
        onPointerUp={handleDebugTap}
        onContextMenu={(event) => event.preventDefault()}
      >
        {APP_VERSION_LABEL}
      </button>
    </>
  )
}
