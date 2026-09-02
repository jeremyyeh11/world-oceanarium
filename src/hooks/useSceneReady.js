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
  const startedRef = useRef(false)

  // A warm cache can resolve everything between renders, so `active` may never be
  // observed true. Treat any completed load as evidence the queue ran.
  if (active || loaded > 0) startedRef.current = true

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
  const failed = errors.length > 0

  return {
    progress: startedRef.current ? progress : 0,
    ready: (assetsSettled && startedRef.current && !creaturesLoading) || failed || timedOut,
  }
}
