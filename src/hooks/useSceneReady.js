import { useEffect, useRef, useState } from 'react'
import { useProgress } from '@react-three/drei'

// How long the loader queue must stay quiet before we believe it is finished.
// drei's `useProgress` reports `active: false` the moment the queue drains, which
// happens between batches as well as at the end, so a bare `!active` check would
// declare the scene ready mid-load.
const SETTLE_MS = 300

// Absolute backstop. This is not an "enter early" affordance — it exists so a
// dead network or a permanently pending request cannot strand someone on the gate
// with a disabled button and no way forward. Long enough that a working
// connection will never reach it.
const SAFETY_TIMEOUT_MS = 15000

// A revisit to a tank whose assets are all cached may never touch the loader queue,
// so "nothing has started yet" stops meaning "still waiting" after this long. Fresh
// loads start within the first render commit, well inside it.
const CACHED_GRACE_MS = 900

/**
 * Decides when the tank is worth entering.
 *
 * Two independent things have to finish: the asset queue (GLBs + the HDR, tracked
 * through THREE.DefaultLoadingManager) and the Supabase creature fetch. They are
 * unrelated, so both are required.
 *
 * `useProgress` is a plain zustand store, not an r3f context consumer, so this
 * runs happily outside the <Canvas>.
 */
export function useSceneReady(creaturesLoading) {
  const { active, progress, loaded, errors } = useProgress()
  const [assetsSettled, setAssetsSettled] = useState(false)
  const [timedOut, setTimedOut] = useState(false)
  const [graceOver, setGraceOver] = useState(false)
  const startedRef = useRef(false)
  // The loader store is global and outlives this hook, so a load from an earlier tank
  // visit must not count as this one starting.
  const baselineLoadedRef = useRef(loaded)
  const baselineErrorsRef = useRef(errors.length)

  // A warm cache can resolve everything between renders, so `active` may never be
  // observed true. Treat any load completed since mount as evidence the queue ran.
  if (active || loaded > baselineLoadedRef.current || graceOver) startedRef.current = true

  useEffect(() => {
    const timer = window.setTimeout(() => setGraceOver(true), CACHED_GRACE_MS)
    return () => window.clearTimeout(timer)
  }, [])

  useEffect(() => {
    if (active) {
      setAssetsSettled(false)
      return undefined
    }
    const timer = window.setTimeout(() => setAssetsSettled(true), SETTLE_MS)
    return () => window.clearTimeout(timer)
  }, [active])

  useEffect(() => {
    const timer = window.setTimeout(() => setTimedOut(true), SAFETY_TIMEOUT_MS)
    return () => window.clearTimeout(timer)
  }, [])

  // A failed asset must not lock the gate — the scene renders without it, which is
  // strictly better than a button that never enables.
  const failed = errors.length > baselineErrorsRef.current

  return {
    progress: startedRef.current ? progress : 0,
    ready: (assetsSettled && startedRef.current && !creaturesLoading) || failed || timedOut,
  }
}
