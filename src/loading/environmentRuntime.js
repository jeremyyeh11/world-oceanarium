import { createEnvironmentLoader } from './environmentLoader.js'
import { ENVIRONMENT_MANIFESTS } from './environmentManifest.js'
import { loadEnvironmentAsset } from './environmentAssetAdapter.js'

function scheduleIdle(work) {
  let cancelled = false
  let handle
  const schedule = () => {
    if ('requestIdleCallback' in window) handle = window.requestIdleCallback(deadline => {
      if (cancelled) return
      if (document.hidden || deadline.timeRemaining() < 4) { schedule(); return }
      work()
    })
    else handle = window.setTimeout(() => {
      if (cancelled) return
      if (document.hidden) { schedule(); return }
      work()
    }, 750)
  }
  schedule()
  return () => {
    cancelled = true
    if ('cancelIdleCallback' in window) window.cancelIdleCallback(handle)
    else window.clearTimeout(handle)
  }
}

export const environmentLoader = createEnvironmentLoader({
  environments: ENVIRONMENT_MANIFESTS, loadAsset: loadEnvironmentAsset, scheduleIdle,
})

let quietAfter = 0
// Cheap pressure hint, not an FPS governor. Stop NEW speculative tasks on slow frames.
// Already-running fetch/decode cannot always be interrupted without wasting shared work.
export function reportEnvironmentFrame(delta) {
  const time = performance.now()
  if (delta > 0.04) quietAfter = time + 1500
  environmentLoader.setBackgroundEnabled(!document.hidden && time > quietAfter && !navigator.connection?.saveData)
}

// HMR must not leave duplicate loading queues or source resources behind.
if (import.meta.hot) import.meta.hot.dispose(() => environmentLoader.dispose())
