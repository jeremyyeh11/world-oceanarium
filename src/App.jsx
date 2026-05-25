import { useEffect, useRef, useState } from 'react'
import TankView from './components/TankView'
import SearchControl from './components/SearchControl'
import { BIOMES } from './data/species'
import { useCreatures } from './hooks/useCreatures'
import { triggerUiClickSound, useOceanAudio } from './hooks/useOceanAudio'
import { APP_VERSION_LABEL } from './version'

const DEFAULT_BIOME_ID = 'ocean'
const ACTIVE_BIOMES = BIOMES.filter(biome => biome.id === DEFAULT_BIOME_ID)
const DEBUG_TAP_WINDOW_MS = 1200
const DEBUG_REQUIRED_TAPS = 3
const DEBUG_TOGGLE_EVENT = 'world-oceanarium-toggle-debug'
const AUDIO_FOREGROUND_RESUME_DELAYS_MS = [0, 120, 500, 1200]
const AUDIO_SESSION_RECOVERY_MS = 2500
const SCREENSHOT_EXIT_HOLD_MS = 900
const SCREENSHOT_EXIT_MOVE_TOLERANCE = 12

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
  const [screen] = useState('tank')
  const [activeBiome] = useState(DEFAULT_BIOME_ID)
  const [tankVisitSeed] = useState(() => createTankVisitSeed())
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [fullscreenSupported, setFullscreenSupported] = useState(false)
  const [screenshotMode, setScreenshotMode] = useState(false)
  const [screenshotHelpVisible, setScreenshotHelpVisible] = useState(false)
  const [topMenuOpen, setTopMenuOpen] = useState(false)
  const { muted: audioMuted, supported: audioSupported, startAudio, pauseAudio, stopAudio, toggleMuted: toggleAudioMuted } = useOceanAudio()
  const debugTapCount = useRef(0)
  const debugTapTimer = useRef(null)
  const screenshotExitHold = useRef(null)
  const topControlsRef = useRef(null)
  const audioResumeTimers = useRef([])
  const audioNeedsGestureResume = useRef(false)
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

  useEffect(() => {
    if (!topMenuOpen) return undefined

    const closeMenu = (event) => {
      if (topControlsRef.current?.contains(event.target)) return
      setTopMenuOpen(false)
    }

    const closeMenuOnEscape = (event) => {
      if (event.key !== 'Escape') return
      setTopMenuOpen(false)
    }

    window.addEventListener('pointerdown', closeMenu, { capture: true })
    window.addEventListener('keydown', closeMenuOnEscape)

    return () => {
      window.removeEventListener('pointerdown', closeMenu, { capture: true })
      window.removeEventListener('keydown', closeMenuOnEscape)
    }
  }, [topMenuOpen])

  useEffect(() => {
    if (screen !== 'tank' || screenshotMode) setTopMenuOpen(false)
  }, [screen, screenshotMode])

  useEffect(() => {
    const playButtonSfx = (event) => {
      const button = event.target?.closest?.('button')
      if (!button || button.disabled || button.classList.contains('app-version-footnote')) return
      window.setTimeout(() => triggerUiClickSound({ type: 'click' }), 0)
    }

    document.addEventListener('click', playButtonSfx)
    return () => document.removeEventListener('click', playButtonSfx)
  }, [])

  useEffect(() => {
    if (screen !== 'tank') return undefined

    const clearAudioResumeTimers = () => {
      audioResumeTimers.current.forEach(timer => window.clearTimeout(timer))
      audioResumeTimers.current = []
    }

    const pauseWhenBackgrounded = () => {
      clearAudioResumeTimers()
      audioNeedsGestureResume.current = true
      pauseAudio()
    }

    const resumeWhenForegrounded = () => {
      if (document.visibilityState === 'hidden' || audioMuted) return
      clearAudioResumeTimers()
      AUDIO_FOREGROUND_RESUME_DELAYS_MS.forEach(delay => {
        const timer = window.setTimeout(() => {
          if (document.visibilityState === 'hidden' || audioMuted) return
          startAudio()
        }, delay)
        audioResumeTimers.current.push(timer)
      })
    }

    const resumeOnNextGesture = () => {
      if (!audioNeedsGestureResume.current || document.visibilityState === 'hidden' || audioMuted) return
      audioNeedsGestureResume.current = false
      clearAudioResumeTimers()
      startAudio()
    }

    const syncVisibilityAudio = () => {
      if (document.visibilityState === 'hidden') {
        pauseWhenBackgrounded()
        return
      }

      resumeWhenForegrounded()
    }

    document.addEventListener('visibilitychange', syncVisibilityAudio)
    window.addEventListener('pagehide', pauseWhenBackgrounded)
    window.addEventListener('blur', pauseWhenBackgrounded)
    window.addEventListener('pageshow', resumeWhenForegrounded)
    window.addEventListener('focus', resumeWhenForegrounded)
    window.addEventListener('pointerdown', resumeOnNextGesture, { capture: true })
    window.addEventListener('touchstart', resumeOnNextGesture, { capture: true, passive: true })
    window.addEventListener('keydown', resumeOnNextGesture, { capture: true })

    const audioSession = navigator?.audioSession
    const recoverInterruptedAudio = () => {
      if (document.visibilityState === 'hidden' || audioMuted) return
      const state = audioSession?.state
      if (state && state !== 'active') {
        startAudio()
      }
    }
    audioSession?.addEventListener?.('statechange', recoverInterruptedAudio)
    if (audioSession && 'onstatechange' in audioSession) {
      audioSession.onstatechange = recoverInterruptedAudio
    }
    const audioSessionRecoveryTimer = window.setInterval(recoverInterruptedAudio, AUDIO_SESSION_RECOVERY_MS)

    return () => {
      clearAudioResumeTimers()
      audioNeedsGestureResume.current = false
      window.clearInterval(audioSessionRecoveryTimer)
      audioSession?.removeEventListener?.('statechange', recoverInterruptedAudio)
      if (audioSession?.onstatechange === recoverInterruptedAudio) {
        audioSession.onstatechange = null
      }
      document.removeEventListener('visibilitychange', syncVisibilityAudio)
      window.removeEventListener('pagehide', pauseWhenBackgrounded)
      window.removeEventListener('blur', pauseWhenBackgrounded)
      window.removeEventListener('pageshow', resumeWhenForegrounded)
      window.removeEventListener('focus', resumeWhenForegrounded)
      window.removeEventListener('pointerdown', resumeOnNextGesture, { capture: true })
      window.removeEventListener('touchstart', resumeOnNextGesture, { capture: true })
      window.removeEventListener('keydown', resumeOnNextGesture, { capture: true })
    }
  }, [audioMuted, pauseAudio, screen, startAudio, stopAudio])

  useEffect(() => {
    if (!screenshotMode) return undefined

    const clearExitHold = () => {
      if (!screenshotExitHold.current) return
      window.clearTimeout(screenshotExitHold.current.timer)
      screenshotExitHold.current = null
    }

    const exitScreenshotMode = () => {
      clearExitHold()
      setScreenshotMode(false)
      setScreenshotHelpVisible(false)
    }

    const exitOnEscape = (event) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      exitScreenshotMode()
    }

    const startExitHold = (event) => {
      if (event.pointerType === 'mouse') return
      clearExitHold()
      const startX = event.clientX
      const startY = event.clientY
      const pointerId = event.pointerId
      const timer = window.setTimeout(exitScreenshotMode, SCREENSHOT_EXIT_HOLD_MS)
      screenshotExitHold.current = { timer, pointerId, startX, startY }
    }

    const moveExitHold = (event) => {
      const hold = screenshotExitHold.current
      if (!hold || hold.pointerId !== event.pointerId) return
      if (Math.hypot(event.clientX - hold.startX, event.clientY - hold.startY) > SCREENSHOT_EXIT_MOVE_TOLERANCE) {
        clearExitHold()
      }
    }

    const endExitHold = (event) => {
      const hold = screenshotExitHold.current
      if (!hold || hold.pointerId !== event.pointerId) return
      clearExitHold()
    }

    window.addEventListener('keydown', exitOnEscape)
    window.addEventListener('pointerdown', startExitHold, { capture: true })
    window.addEventListener('pointermove', moveExitHold, { capture: true })
    window.addEventListener('pointerup', endExitHold, { capture: true })
    window.addEventListener('pointercancel', endExitHold, { capture: true })

    return () => {
      clearExitHold()
      window.removeEventListener('keydown', exitOnEscape)
      window.removeEventListener('pointerdown', startExitHold, { capture: true })
      window.removeEventListener('pointermove', moveExitHold, { capture: true })
      window.removeEventListener('pointerup', endExitHold, { capture: true })
      window.removeEventListener('pointercancel', endExitHold, { capture: true })
    }
  }, [screenshotMode])

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

  const enterScreenshotMode = () => {
    setTopMenuOpen(false)
    setScreenshotMode(true)
    setScreenshotHelpVisible(true)
  }

  const toggleTopMenu = () => {
    setTopMenuOpen(current => !current)
  }

  let page = null

  if (screen === 'tank' && activeBiome) {
    const biome = ACTIVE_BIOMES.find(b => b.id === activeBiome) ?? ACTIVE_BIOMES[0]
    page = <TankView biome={biome} creatures={creatureData.creatures} creatureDataSource={creatureData.source} creatureDataError={creatureData.error} tankVisitSeed={tankVisitSeed} screenshotMode={screenshotMode} />
  }

  return (
    <>
      {page}
      {!screenshotMode && (
        <div className={`top-controls${topMenuOpen ? ' is-open' : ''}`} ref={topControlsRef}>
          {screen === 'tank' && <SearchControl creatures={creatureData.creatures} active />}
          {screen === 'tank' && (
            <button
              className="top-menu-toggle"
              type="button"
              aria-label={topMenuOpen ? 'Close controls menu' : 'Open controls menu'}
              aria-expanded={topMenuOpen}
              onClick={toggleTopMenu}
            >
              <svg className="top-control-icon" aria-hidden="true" viewBox="0 0 24 24">
                <path d="M5 7h14" />
                <path d="M5 12h14" />
                <path d="M5 17h14" />
              </svg>
            </button>
          )}
          {screen === 'tank' && (
            <div className="top-controls-menu" role="menu" aria-label="Tank controls" aria-hidden={!topMenuOpen}>
              <button
                className="screenshot-toggle"
                type="button"
                role="menuitem"
                aria-label="Enter screenshot mode"
                onClick={enterScreenshotMode}
              >
                <svg className="top-control-icon" aria-hidden="true" viewBox="0 0 24 24">
                  <path d="M4 8.5h3.2l1.2-2h7.2l1.2 2H20v9.5H4V8.5Z" />
                  <path d="M12 11a3.1 3.1 0 1 0 0 6.2 3.1 3.1 0 0 0 0-6.2Z" />
                </svg>
              </button>
              <button
                className={`audio-toggle${audioMuted ? '' : ' is-active'}`}
                type="button"
                role="menuitem"
                aria-label={audioMuted ? 'Unmute audio' : 'Mute audio'}
                aria-pressed={!audioMuted}
                title={audioSupported ? undefined : 'Audio unavailable'}
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
                  role="menuitem"
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
          )}
        </div>
      )}
      {screenshotHelpVisible && (
        <div className="screenshot-help" role="dialog" aria-modal="true" aria-labelledby="screenshot-help-title">
          <div className="screenshot-help-card">
            <div id="screenshot-help-title" className="screenshot-help-title">Screenshot mode</div>
            <div className="screenshot-help-copy screenshot-help-copy--desktop">Press Esc to exit</div>
            <div className="screenshot-help-copy screenshot-help-copy--mobile">Long-press anywhere to exit</div>
            <button className="screenshot-help-button" type="button" onClick={() => setScreenshotHelpVisible(false)}>
              OK
            </button>
          </div>
        </div>
      )}
      {!screenshotMode && (
        <button
          className="app-version-footnote"
          type="button"
          aria-label="Tap three times to toggle debug mode"
          onPointerUp={handleDebugTap}
          onContextMenu={(event) => event.preventDefault()}
        >
          {APP_VERSION_LABEL}
        </button>
      )}
    </>
  )
}
