import { useEffect, useRef, useState } from 'react'
import Landing from './components/Landing'
import BiomeMenu from './components/BiomeMenu'
import TankView from './components/TankView'
import SearchControl from './components/SearchControl'
import { BIOMES } from './data/species'
import { useCreatures } from './hooks/useCreatures'
import { useOceanAudio } from './hooks/useOceanAudio'
import { APP_VERSION_LABEL } from './version'

const DEFAULT_BIOME_ID = 'ocean'
const ACTIVE_BIOMES = BIOMES.filter(biome => biome.id === DEFAULT_BIOME_ID)
const DEBUG_TAP_WINDOW_MS = 1200
const DEBUG_REQUIRED_TAPS = 3
const DEBUG_TOGGLE_EVENT = 'world-oceanarium-toggle-debug'

function fullscreenElement() {
  return document.fullscreenElement ?? document.webkitFullscreenElement ?? null
}

function requestAppFullscreen() {
  const target = document.documentElement
  const request = target.requestFullscreen ?? target.webkitRequestFullscreen
  if (!request) return Promise.resolve(false)
  return Promise.resolve(request.call(target)).then(() => true)
}

function exitAppFullscreen() {
  const exit = document.exitFullscreen ?? document.webkitExitFullscreen
  if (!exit) return Promise.resolve(false)
  return Promise.resolve(exit.call(document)).then(() => true)
}

function createTankVisitSeed() {
  if (globalThis.crypto?.getRandomValues) {
    const values = new Uint32Array(1)
    globalThis.crypto.getRandomValues(values)
    return values[0]
  }

  return Math.floor(Math.random() * 0xFFFFFFFF) >>> 0
}

export default function App() {
  const [screen, setScreen] = useState('landing')
  const [activeBiome, setActiveBiome] = useState(DEFAULT_BIOME_ID)
  const [tankVisitSeed, setTankVisitSeed] = useState(() => createTankVisitSeed())
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [fullscreenSupported, setFullscreenSupported] = useState(false)
  const { muted: audioMuted, supported: audioSupported, toggleMuted: toggleAudioMuted } = useOceanAudio()
  const debugTapCount = useRef(0)
  const debugTapTimer = useRef(null)
  const creatureData = useCreatures()

  useEffect(() => {
    const syncFullscreen = () => setIsFullscreen(Boolean(fullscreenElement()))
    setFullscreenSupported(Boolean(document.documentElement.requestFullscreen ?? document.documentElement.webkitRequestFullscreen))
    syncFullscreen()
    document.addEventListener('fullscreenchange', syncFullscreen)
    document.addEventListener('webkitfullscreenchange', syncFullscreen)
    return () => {
      document.removeEventListener('fullscreenchange', syncFullscreen)
      document.removeEventListener('webkitfullscreenchange', syncFullscreen)
    }
  }, [])

  const toggleFullscreen = async () => {
    try {
      if (fullscreenElement()) {
        await exitAppFullscreen()
      } else {
        await requestAppFullscreen()
      }
    } catch (error) {
      console.warn('Fullscreen request failed', error)
    }
  }

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
    setTankVisitSeed(createTankVisitSeed())
    setScreen('tank')
  }
  const selectBiome = (biomeId) => {
    setActiveBiome(biomeId)
    setTankVisitSeed(createTankVisitSeed())
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
    page = <TankView biome={biome} creatures={creatureData.creatures} creatureDataSource={creatureData.source} creatureDataError={creatureData.error} tankVisitSeed={tankVisitSeed} onBack={backToLanding} />
  }

  return (
    <>
      {page}
      <div className="top-controls">
        {screen === 'tank' && <SearchControl creatures={creatureData.creatures} active />}
        <button
          className={`audio-toggle${audioMuted ? '' : ' is-active'}`}
          type="button"
          aria-label={audioMuted ? 'Unmute ambient underwater audio' : 'Mute ambient underwater audio'}
          aria-pressed={!audioMuted}
          title={audioSupported ? 'Ambient underwater audio' : 'Audio unavailable'}
          disabled={!audioSupported}
          onClick={toggleAudioMuted}
        >
          <svg className="top-control-icon" aria-hidden="true" viewBox="0 0 24 24">
            {audioMuted ? (
              <>
                <path d="M4 10v4h3.5L13 19V5L7.5 10H4Z" />
                <path d="m17 9 4 6m0-6-4 6" />
              </>
            ) : (
              <>
                <path d="M4 10v4h3.5L13 19V5L7.5 10H4Z" />
                <path d="M16.5 8.5a5 5 0 0 1 0 7M18.8 6.2a8.2 8.2 0 0 1 0 11.6" />
              </>
            )}
          </svg>
        </button>
        {fullscreenSupported && (
          <button
            className={`fullscreen-toggle${isFullscreen ? ' is-active' : ''}`}
            type="button"
            aria-label={isFullscreen ? 'Exit full screen' : 'Enter full screen'}
            aria-pressed={isFullscreen}
            onClick={toggleFullscreen}
          >
            <svg className="top-control-icon" aria-hidden="true" viewBox="0 0 24 24">
              {isFullscreen ? (
                <>
                  <path d="M9 4v5H4" />
                  <path d="m4 9 5-5" />
                  <path d="M15 20v-5h5" />
                  <path d="m20 15-5 5" />
                </>
              ) : (
                <>
                  <path d="M4 9V4h5" />
                  <path d="m4 4 6 6" />
                  <path d="M20 15v5h-5" />
                  <path d="m20 20-6-6" />
                </>
              )}
            </svg>
          </button>
        )}
      </div>
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
