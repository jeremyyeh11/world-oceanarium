import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import Camera from './Camera'
import DiverCamera from './DiverCamera'
import Biome from './Biome'
import DebugPanel, { DebugDataStatus, DebugReadout } from './DebugPanel'
import PerformanceDiagnostics from './PerformanceDiagnostics'
import { clearedDebugLayers, reservePopulation } from '../utils/debugMenu'
import WaterSurface from './WaterSurface'
import SceneLighting from './SceneLighting'
import UnderwaterFX from './UnderwaterFX'
import InfoCard from './InfoCard'
import { creatureBodyLengthWU, isMolaCreature, resolveSpecies } from '../utils/speciesLookup'
import { landscapeForTank } from '../data/landscapes'
import { DEBUG_TOGGLE_EVENT } from '../utils/debugIdentifiers'
import { useEnvironmentLoading } from '../hooks/useEnvironmentLoading'
import { environmentLoader, reportEnvironmentFrame, reportRenderingPaused, reportRenderingResumed } from '../loading/environmentRuntime'
import { compileEnvironmentScene } from '../loading/compileEnvironmentScene'

// Full turn-around: yaw can swing all the way behind the creature (±180°) — this is the
// "flexibility" the follow cam gains. Pitch stays modest (±30°): at large follow distances
// even a small pitch swings the camera far vertically, and too much tips it into the surface
// ceiling or down past the seabed edge, which is what breaks immersion. Distant floor/haze is
// faded by the enlarged seabed + scene fog rather than shown as a hard edge.
const MAX_FOLLOW_ORBIT_YAW = Math.PI
const MAX_FOLLOW_ORBIT_PITCH = Math.PI / 6
const FOLLOW_ORBIT_DRAG_SPEED = 0.006
const DEFAULT_FOLLOW_DISTANCE = 3.2
const MIN_FOLLOW_DISTANCE = 0.95
const MOLA_MIN_FOLLOW_BODY_LENGTHS = 1.05
const MAX_FOLLOW_DISTANCE = 18
const LARGE_CREATURE_FOLLOW_BODY_LENGTHS = 1.9
// Cap how far the camera can pull back from big creatures. At 4× body length the camera
// roamed far enough that orbiting swung it into the surface/seabed edges; 2.6× keeps it in
// the fogged near-field around the animal while still framing the whole body.
const LARGE_CREATURE_MAX_FOLLOW_BODY_LENGTHS = 2.6
const FOLLOW_WHEEL_ZOOM_SPEED = 0.0016
const FOLLOW_PINCH_ZOOM_SPEED = 0.012
const PAN_DRAG_THRESHOLD_PX = 5
const FOLLOW_ORBIT_SELECTION_SUPPRESS_MS = 280
const FOLLOW_ZOOM_SELECTION_SUPPRESS_MS = 360
const FOLLOW_TOUCH_GESTURE_RESET_MS = 90
const SEARCH_FOCUS_EVENT = 'world-oceanarium-focus-creature'
const RECOVERY_NOTICE_DURATION_MS = 4200
// Matches Camera.jsx's resting FOV for tanks that do not set their own.
const DIVER_DEFAULT_FOV = 61

const clampFollowOrbit = ({ yaw, pitch }) => ({
  yaw: Math.max(-MAX_FOLLOW_ORBIT_YAW, Math.min(MAX_FOLLOW_ORBIT_YAW, yaw)),
  pitch: Math.max(-MAX_FOLLOW_ORBIT_PITCH, Math.min(MAX_FOLLOW_ORBIT_PITCH, pitch)),
})

// Prepares shader variants for the mounted scene. Uploads/first draw can still cost
// time; only the subsequent submitted frame acknowledges readiness.
//
// This replaces drei's <Preload all>, which does the same compile but then also
// renders the scene six times through a CubeCamera to warm environment
// reflections. With ~281 fish that pass dominated the cost, and this scene does
// not need it: the environment map is a CanvasTexture built in SceneLighting and
// the water's HDR is loaded directly, neither of which the cube pass feeds.
//
// Temporarily unhiding is kept from drei's approach — gl.compile only walks what
// is visible, and the sardine LOD system hides culled fish, which are exactly the
// ones that would otherwise stutter on first appearance.
function WarmScene({ environmentId, assetsReady }) {
  const gl = useThree(state => state.gl)
  const scene = useThree(state => state.scene)
  const camera = useThree(state => state.camera)
  const compiled = useRef(false)
  const frame = useRef(null)
  const pressureElapsed = useRef(0)

  useLayoutEffect(() => {
    if (!assetsReady) return undefined
    compiled.current = false
    try {
      compileEnvironmentScene(gl, scene, camera)
      compiled.current = true
    } catch (error) {
      environmentLoader.failActivation(environmentId, error)
    }
    return () => { compiled.current = false; if (frame.current !== null) cancelAnimationFrame(frame.current) }
  }, [gl, scene, camera, environmentId, assetsReady])

  useFrame((_, delta) => {
    pressureElapsed.current += delta
    if (delta > 0.04 || pressureElapsed.current > 0.25) {
      reportEnvironmentFrame(delta)
      pressureElapsed.current = 0
    }
    if (!compiled.current) return
    compiled.current = false
    // This callback runs before R3F draws. Wait until the following RAF to acknowledge
    // an actual submitted frame, not merely a completed download/React render.
    frame.current = requestAnimationFrame(() => environmentLoader.markRendered(environmentId))
  })

  return null
}

// Paused, the canvas renders nothing (frameloop 'never') but its clock keeps running, so
// the first frame back would carry the whole pause as its delta. Reading the clock on
// resume restarts it. Fish clamp their delta anyway; this covers everything else that
// integrates over it.
function ResumeClock({ paused }) {
  const clock = useThree(state => state.clock)
  useEffect(() => {
    if (!paused) clock.getDelta()
  }, [clock, paused])
  return null
}

// The stage is a 16:9 frame at least as large as the screen (.tank-stage in index.css),
// panned sideways on a portrait phone. Rendering all of it drew the whole panorama every
// frame for the quarter of it on screen, so the canvas covers only the screen and the
// camera renders the matching window of the full frame (`setViewOffset`): the same
// picture and framing at about a quarter of the fragments on a portrait phone. Runs
// before everything else in the frame so this frame's projection already has it.
//
// A tank can let the frame widen with the window up to `camera.maxStageAspect` (The Shallows:
// 21:9) instead of cropping its top and bottom: there the camera looks up from the sand, and a
// wider window cropped the sand away (Jeremy, 2026-10-25). Wider than that it crops again.
const STAGE_ASPECT = 16 / 9

function StageWindow({ panRef, maxAspect = STAGE_ASPECT }) {
  const camera = useThree(state => state.camera)
  const size = useThree(state => state.size)
  useFrame(() => {
    const { width, height } = size
    if (!width || !height) return
    const aspect = Math.min(Math.max(width / height, STAGE_ASPECT), Math.max(STAGE_ASPECT, maxAspect))
    const fullWidth = Math.max(width, height * aspect)
    const fullHeight = fullWidth / aspect
    const offsetX = (fullWidth - width) / 2 - panRef.current
    const offsetY = (fullHeight - height) / 2
    const view = camera.view
    // r3f resets the aspect to the canvas's own on resize; put the full frame's back.
    if (camera.aspect === aspect && view?.enabled && view.fullWidth === fullWidth
      && view.fullHeight === fullHeight && view.offsetX === offsetX && view.offsetY === offsetY
      && view.width === width && view.height === height) return
    camera.aspect = aspect
    camera.setViewOffset(fullWidth, fullHeight, offsetX, offsetY, width, height)
  }, -1)
  return null
}

function creatureDisplayName(creature) {
  const customName = creature?.customName?.trim()
  if (customName) return customName
  return resolveSpecies(creature)?.name ?? creature?.species ?? 'This fish'
}

function getPanLimits() {
  const viewportWidth = window.innerWidth
  const viewportHeight = window.innerHeight
  const stageWidth = Math.max(viewportWidth, viewportHeight * 16 / 9)
  const croppedRatio = Math.max(0, stageWidth - viewportWidth) / stageWidth
  const enabled = croppedRatio > 0.3
  return { enabled, maxPan: enabled ? (stageWidth - viewportWidth) / 2 : 0 }
}

function getTouchDistance(points) {
  const values = [...points.values()]
  if (values.length < 2) return 0
  return Math.hypot(values[0].x - values[1].x, values[0].y - values[1].y)
}

function creatureBodyLength(creature) {
  const species = resolveSpecies(creature)
  return creatureBodyLengthWU(creature, species?.swim?.bodyLengthWU)
}

function maxFollowDistanceForCreature(creature) {
  const bodyLength = creatureBodyLength(creature)
  return Math.max(MAX_FOLLOW_DISTANCE, bodyLength * LARGE_CREATURE_MAX_FOLLOW_BODY_LENGTHS)
}

function minFollowDistanceForCreature(creature) {
  const bodyLength = creatureBodyLength(creature)
  return isMolaCreature(creature)
    ? Math.max(MIN_FOLLOW_DISTANCE, bodyLength * MOLA_MIN_FOLLOW_BODY_LENGTHS)
    : MIN_FOLLOW_DISTANCE
}

function clampFollowDistance(distance, creature = null) {
  return Math.max(minFollowDistanceForCreature(creature), Math.min(maxFollowDistanceForCreature(creature), distance))
}

function defaultFollowDistanceForCreature(creature) {
  const bodyLength = creatureBodyLength(creature)
  return clampFollowDistance(Math.max(DEFAULT_FOLLOW_DISTANCE, bodyLength * LARGE_CREATURE_FOLLOW_BODY_LENGTHS), creature)
}

// The Atlas and the sources/changelog modals open over a followed fish without
// releasing it, so the follow-mode scroll block has to let their own scrollers through.
const SCROLLABLE_PANEL_SELECTOR = '.info-card, .encyclopedia-page, .sources-modal, .debug-panel'

function eventStartedInScrollablePanel(event) {
  return event.target instanceof Element && Boolean(event.target.closest(SCROLLABLE_PANEL_SELECTOR))
}

function isMobileInputSurface() {
  return window.matchMedia?.('(hover: none), (pointer: coarse), (max-width: 768px)').matches ?? false
}

export default function TankView({ biome, tank = null, creatures, creatureDataLoading = false, creatureDataSource = 'unknown', creatureDataError = null, tankVisitSeed = 0, hidden = false, paused = false, screenshotMode = false, diverMode = false, onExitDiverMode = null, onBack, onOpenEncyclopedia }) {
  const environmentLoading = useEnvironmentLoading()
  const [selectedCreature, setSelectedCreature] = useState(null)
  const [focusedFishRef, setFocusedFishRef] = useState(null)
  const [debugMode, setDebugMode] = useState(false)
  const [debugView, setDebugView] = useState('focused')
  const [debugLayers, setDebugLayers] = useState(() => ({ ...clearedDebugLayers(), heading: true, name: true, lod: false }))
  const [debugSection, setDebugSection] = useState('creature')
  const [debugSimulationSpeed, setDebugSimulationSpeed] = useState(1)

  const [stagePan, setStagePan] = useState(0)
  // Read by StageWindow in the frame loop; set during render so it changes in the same
  // commit as the --stage-pan-x the canvas is positioned by.
  const stagePanRef = useRef(0)
  stagePanRef.current = stagePan
  const [stagePanning, setStagePanning] = useState(false)
  const [followOrbit, setFollowOrbit] = useState({ yaw: 0, pitch: 0 })
  const [followDistance, setFollowDistance] = useState(DEFAULT_FOLLOW_DISTANCE)
  const [followScreenOffset, setFollowScreenOffset] = useState(0)
  const [debugSunBaskRequestId, setDebugSunBaskRequestId] = useState(0)
  const [defaultCameraSettled, setDefaultCameraSettled] = useState(true)
  const [panLimits, setPanLimits] = useState(() => ({ enabled: false, maxPan: 0 }))
  const [performanceStats, setPerformanceStats] = useState({ fps: null })
  const [recoveryNotice, setRecoveryNotice] = useState(null)
  const diagnosticsActive = debugMode && !hidden && !paused && !screenshotMode
  const dragRef = useRef(null)
  const touchPointsRef = useRef(new Map())
  const focusChangeAtRef = useRef(0)
  const suppressCreatureFocusUntilRef = useRef(0)
  const fishRefsByCreatureId = useRef(new Map())
  const zoomActive = Boolean(selectedCreature)
  const visibleDebugVisuals = debugMode && !hidden && !screenshotMode
  const visibleDebugPanel = visibleDebugVisuals
  const population = useMemo(() => reservePopulation(creatures, tank, biome?.id), [creatures, tank, biome?.id])
  const canQueueDebugSunBask = debugMode && zoomActive && selectedCreature && isMolaCreature(selectedCreature)
  const selectedModel = selectedCreature ? resolveSpecies(selectedCreature)?.model ?? null : null
  // Static assets declare root aim explicitly. `proceduralAnimation` can also describe a
  // future rigged procedural model, whose valid follow bone must continue to win.
  const followMeshOrigin = selectedModel?.followAim === 'root'

  const queueDebugSunBask = () => {
    if (!canQueueDebugSunBask) return
    setDebugSunBaskRequestId(current => current + 1)
  }


  const resetDebug = useCallback(() => {
    setDebugLayers({ ...clearedDebugLayers(), lod: false })
    setDebugView('focused')
    setDebugSimulationSpeed(1)
    setDebugSection(null)
  }, [])

  const toggleDebugMode = useCallback(() => {
    // Leaving debug cannot leave a hidden quality/simulation override behind.
    if (debugMode) resetDebug()
    setDebugMode(current => !current)
  }, [debugMode, resetDebug])

  useEffect(() => {
    const updatePanLimits = () => {
      const nextLimits = getPanLimits()
      setPanLimits(nextLimits)
      setStagePan(current => nextLimits.enabled
        ? Math.max(-nextLimits.maxPan, Math.min(nextLimits.maxPan, current))
        : 0)
    }

    updatePanLimits()
    window.addEventListener('resize', updatePanLimits)
    return () => window.removeEventListener('resize', updatePanLimits)
  }, [])

  useEffect(() => {
    if (hidden) return undefined
    const toggleDebugOnShortcut = (event) => {
      if (!(event.ctrlKey || event.metaKey) || !event.shiftKey || event.key.toLowerCase() !== 'd') return
      event.preventDefault()
      toggleDebugMode()
    }

    window.addEventListener('keydown', toggleDebugOnShortcut)
    return () => window.removeEventListener('keydown', toggleDebugOnShortcut)
  }, [toggleDebugMode, hidden])

  useEffect(() => {
    if (hidden) return undefined
    const queueSunBaskOnShortcut = (event) => {
      const isSunBaskShortcut = (event.ctrlKey || event.metaKey) && event.shiftKey && (event.code === 'KeyX' || event.key?.toLowerCase() === 'x')
      if (!isSunBaskShortcut) return
      if (!debugMode || !selectedCreature || !isMolaCreature(selectedCreature)) return
      event.preventDefault()
      setDebugSunBaskRequestId(current => current + 1)
    }

    window.addEventListener('keydown', queueSunBaskOnShortcut)
    return () => window.removeEventListener('keydown', queueSunBaskOnShortcut)
  }, [debugMode, selectedCreature, hidden])

  useEffect(() => {
    if (hidden) return undefined
    window.addEventListener(DEBUG_TOGGLE_EVENT, toggleDebugMode)
    return () => window.removeEventListener(DEBUG_TOGGLE_EVENT, toggleDebugMode)
  }, [toggleDebugMode, hidden])

  useEffect(() => {
    if (!selectedCreature) return undefined

    const closeOnEscape = (event) => {
      if (event.key === 'Escape') releaseFocus()
    }

    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [selectedCreature])

  useEffect(() => {
    if (!selectedCreature) return undefined

    const blockViewportScroll = (event) => {
      if (eventStartedInScrollablePanel(event)) return
      event.preventDefault()
    }

    const blockMobileWheelZoom = (event) => {
      if (!isMobileInputSurface() || eventStartedInScrollablePanel(event)) return
      event.preventDefault()
      event.stopPropagation()
    }

    window.addEventListener('touchmove', blockViewportScroll, { capture: true, passive: false })
    window.addEventListener('wheel', blockMobileWheelZoom, { capture: true, passive: false })

    return () => {
      window.removeEventListener('touchmove', blockViewportScroll, true)
      window.removeEventListener('wheel', blockMobileWheelZoom, true)
    }
  }, [selectedCreature])

  useEffect(() => {
    if (!selectedCreature) {
      document.documentElement.style.removeProperty('--mobile-follow-card-height')
      setFollowScreenOffset(0)
      return undefined
    }

    let observer = null
    let frameId = 0

    const updateCardHeight = () => {
      const card = document.querySelector('.tank-viewport.is-following-fish .info-card')
      if (!card) return

      const syncHeight = () => {
        const cardHeight = card.getBoundingClientRect().height
        document.documentElement.style.setProperty('--mobile-follow-card-height', `${cardHeight}px`)
        // Follow mode should keep the creature centered in the actual screen.
        // The card height is still exposed for UI layout, but it no longer
        // biases the camera framing on phone-sized viewports.
        setFollowScreenOffset(0)
      }

      syncHeight()
      observer?.disconnect()
      observer = new ResizeObserver(syncHeight)
      observer.observe(card)
    }

    frameId = window.requestAnimationFrame(updateCardHeight)
    window.addEventListener('resize', updateCardHeight)

    return () => {
      window.cancelAnimationFrame(frameId)
      window.removeEventListener('resize', updateCardHeight)
      observer?.disconnect()
      document.documentElement.style.removeProperty('--mobile-follow-card-height')
    }
  }, [selectedCreature, debugMode])

  useEffect(() => {
    if (!visibleDebugPanel) {
      document.documentElement.style.removeProperty('--floating-debug-panel-height')
      return undefined
    }

    let observer = null
    let frameId = 0

    const updateDebugPanelHeight = () => {
      const panel = document.querySelector('.tank-viewport .debug-panel--floating')
      if (!panel) return

      const syncHeight = () => {
        document.documentElement.style.setProperty('--floating-debug-panel-height', `${panel.getBoundingClientRect().height}px`)
      }

      syncHeight()
      observer?.disconnect()
      observer = new ResizeObserver(syncHeight)
      observer.observe(panel)
    }

    frameId = window.requestAnimationFrame(updateDebugPanelHeight)
    window.addEventListener('resize', updateDebugPanelHeight)

    return () => {
      window.cancelAnimationFrame(frameId)
      window.removeEventListener('resize', updateDebugPanelHeight)
      observer?.disconnect()
      document.documentElement.style.removeProperty('--floating-debug-panel-height')
    }
  }, [visibleDebugPanel])

  useEffect(() => {
    if (!selectedCreature || !panLimits.enabled) return undefined

    let frameId = 0
    const centerStage = () => {
      setStagePan(current => {
        if (Math.abs(current) < 0.5) return 0
        return current + (0 - current) * 0.12
      })
      frameId = window.requestAnimationFrame(centerStage)
    }

    frameId = window.requestAnimationFrame(centerStage)
    return () => window.cancelAnimationFrame(frameId)
  }, [selectedCreature, panLimits.enabled])

  const focusCreature = (creature, fishRef) => {
    dragRef.current = null
    touchPointsRef.current.clear()
    const sameCreatureFocused = selectedCreature && String(selectedCreature.id) === String(creature?.id)
    if (sameCreatureFocused) {
      setSelectedCreature(creature)
      setFocusedFishRef(fishRef)
      setStagePan(0)
      return
    }

    focusChangeAtRef.current = performance.now()
    setSelectedCreature(creature)
    setFocusedFishRef(fishRef)
    setStagePan(0)
    setFollowOrbit({ yaw: 0, pitch: 0 })
    setFollowDistance(defaultFollowDistanceForCreature(creature))
  }

  const selectCreatureFromPointer = (creature, fishRef) => {
    // The diver camera's drags are looks, never picks.
    if (diverMode) return
    if (performance.now() < suppressCreatureFocusUntilRef.current) return
    focusCreature(creature, fishRef)
  }

  const registerCreatureRef = (creature, fishRef) => {
    if (!creature?.id || !fishRef) return
    fishRefsByCreatureId.current.set(String(creature.id), fishRef)
  }

  const releaseFocus = () => {
    focusChangeAtRef.current = performance.now()
    touchPointsRef.current.clear()
    dragRef.current = null
    setStagePanning(false)
    setSelectedCreature(null)
    setFocusedFishRef(null)
    setFollowOrbit({ yaw: 0, pitch: 0 })
    setFollowDistance(DEFAULT_FOLLOW_DISTANCE)
  }

  // Switching tanks drops any followed creature so the new tank opens at its resting camera
  // (the previous creature's ref belongs to the unmounting tank anyway).
  useEffect(() => {
    releaseFocus()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tank?.id])

  // The diver starts from the current view, so drop any followed fish and centre the stage
  // (the phone's sideways pan would otherwise offset the whole free-cam frame).
  useEffect(() => {
    if (!diverMode) return
    releaseFocus()
    setStagePan(0)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [diverMode])

  const releaseFocusForRuntimeRecovery = (creature) => {
    const name = creatureDisplayName(creature)
    setRecoveryNotice({ id: `${creature?.id ?? name}-${performance.now()}`, text: `${name} will be back in a bit!` })
    releaseFocus()
  }

  const releaseFollowForCameraClip = () => {
    if (!selectedCreature || !isMolaCreature(selectedCreature)) return
    releaseFocusForRuntimeRecovery(selectedCreature)
  }

  useEffect(() => {
    if (!recoveryNotice) return undefined
    const timeout = window.setTimeout(() => setRecoveryNotice(null), RECOVERY_NOTICE_DURATION_MS)
    return () => window.clearTimeout(timeout)
  }, [recoveryNotice])

  const adjustFollowDistance = (delta) => {
    setFollowDistance(current => clampFollowDistance(current + delta, selectedCreature))
  }

  const suppressCreatureFocusFor = (durationMs) => {
    suppressCreatureFocusUntilRef.current = Math.max(suppressCreatureFocusUntilRef.current, performance.now() + durationMs)
  }

  const resetFollowTouchGestureSoon = () => {
    window.setTimeout(() => {
      if (touchPointsRef.current.size > 0) return
      if (dragRef.current?.mode === 'pinch') dragRef.current = null
    }, FOLLOW_TOUCH_GESTURE_RESET_MS)
  }

  const toggleDebugLayer = (layerId) => {
    setDebugLayers(current => ({ ...current, [layerId]: !current[layerId] }))
  }


  useEffect(() => {
    if (hidden) return undefined
    const focusFromSearch = (event) => {
      const creatureId = String(event.detail?.creatureId ?? '')
      if (!creatureId) return
      const creature = creatures.find(candidate => String(candidate.id) === creatureId)
      const fishRef = fishRefsByCreatureId.current.get(creatureId)
      if (!creature || !fishRef) return
      focusCreature(creature, fishRef)
    }

    window.addEventListener(SEARCH_FOCUS_EVENT, focusFromSearch)
    return () => window.removeEventListener(SEARCH_FOCUS_EVENT, focusFromSearch)
  }, [creatures, hidden])

  // While paused nothing renders, so speculation is held back only by a hidden page or
  // Save-Data (environmentRuntime.reportRenderingPaused), re-checked as the page's
  // visibility changes.
  useEffect(() => {
    if (!paused) return undefined
    reportRenderingPaused()
    document.addEventListener('visibilitychange', reportRenderingPaused)
    return () => {
      document.removeEventListener('visibilitychange', reportRenderingPaused)
      reportRenderingResumed()
    }
  }, [paused])

  // A hidden tank is behind the selector or the loader. Following a fish there would keep
  // its scroll blocking and follow-card layout (body:has(.is-following-fish) rules) active
  // over them, so the follow ends on the way out, as Esc would end it.
  useEffect(() => {
    if (hidden && selectedCreature) releaseFocus()
  }, [hidden, selectedCreature])

  const zoomFollowWithWheel = (event) => {
    if (!selectedCreature) return
    event.preventDefault()
    suppressCreatureFocusFor(FOLLOW_ZOOM_SELECTION_SUPPRESS_MS)
    const normalizedDelta = event.deltaMode === 1 ? event.deltaY * 16 : event.deltaY
    adjustFollowDistance(normalizedDelta * FOLLOW_WHEEL_ZOOM_SPEED * followDistance)
  }

  const startStageDrag = (event) => {
    if (diverMode) return
    if (event.button !== 0) return

    if (selectedCreature && event.pointerType === 'touch') {
      event.preventDefault()
      touchPointsRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY })
      if (touchPointsRef.current.size >= 2) {
        suppressCreatureFocusFor(FOLLOW_ZOOM_SELECTION_SUPPRESS_MS)
        dragRef.current = {
          mode: 'pinch',
          startDistance: getTouchDistance(touchPointsRef.current),
          startFollowDistance: followDistance,
        }
        return
      }
    }

    if (selectedCreature) {
      dragRef.current = {
        mode: 'orbit-pending',
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        lastX: event.clientX,
        lastY: event.clientY,
        startFocusChangeAt: focusChangeAtRef.current,
        target: event.currentTarget,
        captured: false,
      }
      return
    }

    if (!panLimits.enabled) return
    dragRef.current = {
      mode: 'pan-pending',
      pointerId: event.pointerId,
      startX: event.clientX,
      startPan: stagePan,
      target: event.currentTarget,
    }
  }

  const moveStageDrag = (event) => {
    if (diverMode) return
    if (selectedCreature && event.pointerType === 'touch') event.preventDefault()

    if (event.pointerType === 'touch' && touchPointsRef.current.has(event.pointerId)) {
      touchPointsRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY })
    }

    const drag = dragRef.current
    if (!drag) return

    if (drag.mode === 'pinch') {
      event.preventDefault()
      suppressCreatureFocusFor(FOLLOW_ZOOM_SELECTION_SUPPRESS_MS)
      const pinchDistance = getTouchDistance(touchPointsRef.current)
      if (!pinchDistance || !drag.startDistance) return
      const pinchDelta = drag.startDistance - pinchDistance
      setFollowDistance(clampFollowDistance(drag.startFollowDistance + pinchDelta * FOLLOW_PINCH_ZOOM_SPEED, selectedCreature))
      return
    }

    if (drag.pointerId !== event.pointerId) return

    if (drag.mode === 'orbit' || drag.mode === 'orbit-pending') {
      const totalDeltaX = event.clientX - drag.startX
      const totalDeltaY = event.clientY - drag.startY
      const moved = Math.hypot(totalDeltaX, totalDeltaY) > 5
      if (!moved && drag.mode === 'orbit-pending') return

      const lastX = drag.lastX ?? drag.startX
      const lastY = drag.lastY ?? drag.startY
      const deltaX = event.clientX - lastX
      const deltaY = event.clientY - lastY
      drag.lastX = event.clientX
      drag.lastY = event.clientY
      drag.mode = 'orbit'
      drag.moved = true
      if (!drag.captured) {
        try {
          drag.target?.setPointerCapture?.(event.pointerId)
          drag.captured = true
        } catch {
          // Pointer capture is a guard, not a dependency; orbit still works without it.
        }
      }
      suppressCreatureFocusFor(FOLLOW_ORBIT_SELECTION_SUPPRESS_MS)
      setFollowOrbit(current => clampFollowOrbit({
        yaw: current.yaw - deltaX * FOLLOW_ORBIT_DRAG_SPEED,
        pitch: current.pitch - deltaY * FOLLOW_ORBIT_DRAG_SPEED,
      }))
      return
    }

    const nextPan = drag.startPan + event.clientX - drag.startX
    if (drag.mode === 'pan-pending') {
      const moved = Math.abs(event.clientX - drag.startX) > PAN_DRAG_THRESHOLD_PX
      if (!moved) return
      drag.mode = 'pan'
      setStagePanning(true)
      try {
        drag.target?.setPointerCapture?.(event.pointerId)
      } catch {
        // Pointer may already be released by the browser; panning can still continue for this event.
      }
    }
    setStagePan(Math.max(-panLimits.maxPan, Math.min(panLimits.maxPan, nextPan)))
  }

  const endStageDrag = (event) => {
    if (selectedCreature && event.pointerType === 'touch') event.preventDefault()
    if (event.pointerType === 'touch') touchPointsRef.current.delete(event.pointerId)

    if (dragRef.current?.mode === 'pinch') {
      suppressCreatureFocusFor(FOLLOW_ZOOM_SELECTION_SUPPRESS_MS)
      setStagePanning(false)
      if (touchPointsRef.current.size < 2) {
        dragRef.current = null
        resetFollowTouchGestureSoon()
      }
      return
    }

    if (dragRef.current?.pointerId !== event.pointerId) return
    if (dragRef.current.mode === 'pan' || dragRef.current.mode === 'pan-pending') {
      const drag = dragRef.current
      dragRef.current = null
      setStagePanning(false)
      try {
        if (drag.target?.hasPointerCapture?.(event.pointerId)) {
          drag.target.releasePointerCapture(event.pointerId)
        }
      } catch {
        // Ignore stale pointer-capture cleanup.
      }
      return
    }
    if (dragRef.current.mode === 'orbit' || dragRef.current.mode === 'orbit-pending') {
      setStagePanning(false)
      const drag = dragRef.current
      dragRef.current = null
      try {
        if (drag.target?.hasPointerCapture?.(event.pointerId)) {
          drag.target.releasePointerCapture(event.pointerId)
        }
      } catch {
        // Ignore stale pointer-capture cleanup.
      }
      if (drag.mode === 'orbit') {
        suppressCreatureFocusFor(FOLLOW_ORBIT_SELECTION_SUPPRESS_MS)
        return
      }
      window.setTimeout(() => {
        if (focusChangeAtRef.current === drag.startFocusChangeAt) releaseFocus()
      }, 0)
      return
    }
    dragRef.current = null
    setStagePanning(false)
  }

  return (
    <div
      className={`tank-viewport${hidden ? ' is-hidden' : ''}${panLimits.enabled ? ' can-pan' : ''}${stagePanning ? ' is-panning' : ''}${zoomActive ? ' is-following-fish' : ''}${visibleDebugPanel ? ' has-debug-panel' : ''}${screenshotMode ? ' is-screenshot-mode' : ''}${diverMode ? ' is-diver-mode' : ''}`}
      style={{ '--stage-pan-x': `${stagePan}px` }}
    >
      <div
        className="tank-stage"
        onPointerDown={startStageDrag}
        onPointerMove={moveStageDrag}
        onPointerUpCapture={endStageDrag}
        onPointerCancelCapture={endStageDrag}
        onWheel={zoomFollowWithWheel}
      >
        {/* dpr is capped rather than left at r3f's [1, 2] default. This scene is
            fragment-bound — the water's transmission pass re-renders the opaque
            scene, and the surface, god rays and suspended particles all overdraw —
            so cost tracks pixel count almost linearly. At the [1, 2] default a
            DPR-3 phone renders 4x the fragments of 1x for detail that the CRT
            scanline film on top largely eats anyway. 1.5 matches the cap the
            encyclopedia canvas already uses. */}
        {/* Paused (hidden and its first frame already rendered), nothing renders or
            simulates, and the WebGL context with its compiled shaders and uploaded
            textures survives for the next visit. A hidden tank still warming keeps
            rendering until the loader acknowledges its first frame. */}
        {/* The canvas covers the screen, not the whole stage (StageWindow); .tank-canvas
            in index.css counters the stage's pan so it stays put. Unset here so r3f's
            inline position and size give way to that rule. */}
        <Canvas className="tank-canvas" style={{ position: undefined, width: undefined, height: undefined }} camera={{ fov: 61, near: 0.1, far: 200 }} dpr={[1, 1.5]} frameloop={paused ? 'never' : 'always'} onPointerMissed={zoomActive ? undefined : releaseFocus}>
          <ResumeClock paused={paused} />
          {diagnosticsActive && debugSection === 'performance' && <PerformanceDiagnostics onSample={setPerformanceStats} />}
          <StageWindow panRef={stagePanRef} maxAspect={tank?.camera?.maxStageAspect} />
          <SceneLighting biome={biome.id} seed={tank?.seed ?? 0} paletteOverrides={tank?.lighting ?? null} />
          <Camera
            biome={biome.id}
            landscape={landscapeForTank(tank)}
            cameraSettings={tank?.camera}
            focusTarget={focusedFishRef?.current ?? null}
            focusCenterBoneName={selectedModel?.followBone ?? null}
            focusMeshOrigin={followMeshOrigin}
            followOrbit={followOrbit}
            followDistance={followDistance}
            followScreenOffset={followScreenOffset}
            onDefaultCameraSettledChange={setDefaultCameraSettled}
            onFollowCameraClip={releaseFollowForCameraClip}
            diverActive={diverMode}
          />
          <DiverCamera
            active={diverMode}
            biome={biome.id}
            landscape={landscapeForTank(tank)}
            fov={Number.isFinite(tank?.camera?.fov) ? tank.camera.fov : DIVER_DEFAULT_FOV}
            onExit={onExitDiverMode}
          />
          {/* Do not mount source consumers until the selected manifest has succeeded.
              This also keeps a failed initial fetch out of the Canvas error boundary;
              the UI can retry through requestEnvironment without losing the app root. */}
          {environmentLoading.environments[tank?.id]?.assetsReady && <Biome
            key={tank?.id ?? biome.id}
            name={biome.id}
            tank={tank}
            creatures={creatures}
            tankVisitSeed={tankVisitSeed}
            selectedCreatureId={selectedCreature?.id}
            zoomActive={zoomActive || diverMode}
            debugSunBaskRequestId={debugSunBaskRequestId}
            soloRuntimeRecoveryEnabled={!zoomActive && defaultCameraSettled}
            hideSelectionSilhouette={screenshotMode}
            debug={visibleDebugVisuals}
            debugView={debugView}
            debugLayers={debugLayers}
            debugLodView={visibleDebugVisuals && Boolean(debugLayers.lod)}
            debugInspectorEnabled={diagnosticsActive}
            debugSimulationSpeed={visibleDebugVisuals ? debugSimulationSpeed : 1}
            onCreatureClick={selectCreatureFromPointer}
            onCreatureReady={registerCreatureRef}
            onRuntimeRecoveryNeeded={releaseFocusForRuntimeRecovery}
          />}
          <WaterSurface
            biome={biome.id}
            seed={tank?.seed ?? 0}
            color={tank?.lighting?.surfaceColor}
            attenuationColor={tank?.lighting?.surfaceAttenuationColor}
          />
          {/* A tank can turn the light shafts off (`lighting.godRays: false`, The Reefs). */}
          <UnderwaterFX biome={biome.id} showGodRays={!zoomActive && defaultCameraSettled && tank?.lighting?.godRays !== false} />
          {/* Shader preparation belongs to this mounted renderer; decoded assets alone
              are not first-frame readiness. Hidden objects are included. Fish/coral
              construction and texture uploads may still hitch on a cold mobile GPU.
              Keep `warm-` distinct from Biome's key to avoid sibling-key collisions. */}
          <WarmScene key={`warm-${tank?.id ?? biome.id}`} environmentId={tank?.id ?? biome.id}
            assetsReady={Boolean(environmentLoading.environments[tank?.id]?.assetsReady)
              && environmentLoading.requestedId === tank?.id
              && ['assets-ready', 'activating'].includes(environmentLoading.phase)
              && environmentLoading.environments[tank?.id]?.sceneTasks === 0 && !creatureDataLoading} />
        </Canvas>
      </div>

      <div className="tank-top-exposure" aria-hidden="true" />
      <div className="tank-depth-absorption" aria-hidden="true" />

      {screenshotMode && (
        <svg className="screenshot-grain" aria-hidden="true" focusable="false">
          <filter id="screenshot-film-grain" x="0" y="0" width="100%" height="100%">
            {/* stitchTiles takes "stitch" | "noStitch"; the previous "no" was invalid and
                threw on every load, silently falling back to this same default. */}
            <feTurbulence type="fractalNoise" baseFrequency="0.72" numOctaves="4" seed="17" stitchTiles="noStitch" />
            <feColorMatrix type="saturate" values="0" />
          </filter>
          <rect width="100%" height="100%" filter="url(#screenshot-film-grain)" />
        </svg>
      )}

      {!screenshotMode && !zoomActive && onBack && <button onClick={onBack} aria-label="Back to biome menu" className="tank-back-button">←</button>}


      {visibleDebugPanel && <>
        <DebugDataStatus loading={creatureDataLoading} source={creatureDataSource} totalCount={creatures.length} population={population} error={creatureDataError} />
        <DebugReadout key={selectedCreature?.id ?? 'none'} selectedCreature={selectedCreature} fishRef={focusedFishRef} performanceStats={performanceStats} showPerformance={debugSection === 'performance'} />
      </>}
      {visibleDebugPanel && (
        <DebugPanel
          population={population}
          section={debugSection}
          onSectionChange={setDebugSection}
          debugView={debugView}
          debugLayers={debugLayers}
          debugSimulationSpeed={debugSimulationSpeed}
          environmentLoading={environmentLoading}
          canQueueSunBask={canQueueDebugSunBask}
          onDebugViewChange={setDebugView}
          onDebugLayerToggle={toggleDebugLayer}
          onDebugSimulationSpeedChange={setDebugSimulationSpeed}
          onQueueSunBask={queueDebugSunBask}
          onReset={resetDebug}
          onExit={toggleDebugMode}
        />
      )}

      {!screenshotMode && !visibleDebugPanel && selectedCreature && <FocusHint />}
      {!screenshotMode && diverMode && <DiverHint />}
      {recoveryNotice && (
        <div key={recoveryNotice.id} className="runtime-recovery-notice" role="status" aria-live="polite">
          {recoveryNotice.text}
        </div>
      )}
      {!screenshotMode && !visibleDebugPanel && selectedCreature && (
        <InfoCard creature={selectedCreature} onClose={releaseFocus} onOpenEncyclopedia={onOpenEncyclopedia} />
      )}
    </div>
  )
}


function FocusHint() {
  return (
    // Styling lives in styles/crt.css so the readout can share the CRT tokens;
    // only the stacking order stays here, since it has to clear the
    // screen-space water overlays (.tank-top-exposure / .tank-depth-absorption, z 4).
    <div className="focus-hint" style={{ zIndex: 30 }}>
      <span className="focus-hint-title">Following fish</span>
      <span className="focus-hint-controls focus-hint-controls-desktop">scroll to zoom · drag to orbit</span>
      <span className="focus-hint-controls focus-hint-controls-mobile">pinch to zoom · drag to orbit</span>
    </div>
  )
}

// Fades itself out (index.css) so a held free-cam frame is clean, but stays mounted, so the
// keys are a glance away again on the next entry.
function DiverHint() {
  return (
    <div className="focus-hint diver-hint" style={{ zIndex: 30 }}>
      <span className="focus-hint-title">Diver camera</span>
      <span className="focus-hint-controls focus-hint-controls-desktop">WASD swim · Q/E sink/rise · shift faster · mouse to look · hold right to aim, click to track · esc to exit</span>
      <span className="focus-hint-controls focus-hint-controls-mobile">drag to look · two fingers to drift · spread to swim</span>
    </div>
  )
}
