import { useEffect, useState } from 'react'

// Existing landing gate only. New switch/progress UI is deliberately not implemented.
// Global THREE.DefaultLoadingManager cannot distinguish active from speculative loads;
// use the selected manifest plus its submitted first frame instead.
export function useSceneReady(creaturesLoading, environmentState) {
  const [timedOut, setTimedOut] = useState(false)
  useEffect(() => {
    const timer = window.setTimeout(() => setTimedOut(true), 15000)
    return () => window.clearTimeout(timer)
  }, [])
  const selected = environmentState.environments[environmentState.requestedId]
  return {
    progress: (selected?.progress ?? 0) * 100,
    ready: (!creaturesLoading && environmentState.phase === 'ready') || environmentState.phase === 'error' || timedOut,
  }
}
