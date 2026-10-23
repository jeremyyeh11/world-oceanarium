import { useEffect, useRef, useState } from 'react'
import { DEPTH_ZONES } from '../data/species'
import { useEnvironmentLoading } from '../hooks/useEnvironmentLoading'
import { environmentProgress } from '../utils/environmentProgress'
import { reserveDepthRange } from '../utils/reserveDepth'
import DiveDescent from './DiveDescent'

const DEPTH_ZONE_BY_ID = new Map(DEPTH_ZONES.map(zone => [zone.id, zone]))

// A warm reserve can be ready in a few hundred ms; holding the descent this long keeps
// it reading as a dive rather than a flash.
const MIN_HOLD_MS = 1300
// The diver reaches the bottom and the floor flares before the screen clears.
const ARRIVE_MS = 650
// Must match environment-loader-clear in environments.css.
const CLEAR_MS = 700
const CLEAR_REDUCED_MS = 200

function prefersReducedMotion() {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
}

/**
 * Covers the reserve while the environment loader fetches its files and the scene
 * builds, then clears once the loader has acknowledged this reserve's first rendered
 * frame (`phase: 'ready'`, docs/environment-loading.md). Mounted fresh (keyed) per visit.
 */
export default function EnvironmentLoader({ tank, onDone, onRetry, onBack }) {
  const state = useEnvironmentLoading()
  const [held, setHeld] = useState(false)
  const [clearing, setClearing] = useState(false)
  const timers = useRef([])

  const { stage, progress, loaded, total } = environmentProgress(state, tank?.id)
  const ready = stage === 'ready'
  const failed = stage === 'error'

  useEffect(() => {
    const timer = window.setTimeout(() => setHeld(true), MIN_HOLD_MS)
    return () => window.clearTimeout(timer)
  }, [])

  useEffect(() => {
    if (!ready || !held || clearing) return
    const reduced = prefersReducedMotion()
    timers.current.push(window.setTimeout(() => {
      setClearing(true)
      timers.current.push(window.setTimeout(() => onDone?.(), reduced ? CLEAR_REDUCED_MS : CLEAR_MS))
    }, reduced ? 0 : ARRIVE_MS))
  }, [ready, held, clearing, onDone])

  useEffect(() => () => timers.current.forEach(timer => window.clearTimeout(timer)), [])

  const zone = DEPTH_ZONE_BY_ID.get(tank?.depthZone)
  let readout = `Fetching · ${loaded} / ${total} files`
  if (stage === 'building') readout = 'Building the reserve…'
  if (ready) readout = 'Arrived'
  if (failed) readout = state.error ?? 'The reserve failed to load.'

  return (
    <div
      className={`environment-loader${clearing ? ' is-clearing' : ''}`}
      role="status"
      aria-live="polite"
      aria-busy={!ready && !failed}
    >
      <DiveDescent
        eyebrow={failed ? 'Signal lost' : `Descending${zone ? ` · ${zone.shortLabel}` : ''}`}
        title={tank?.name}
        tagline={tank?.tagline}
        progress={progress}
        readout={readout}
        depthRange={reserveDepthRange(tank)}
        scenery={tank?.descent ?? null}
        arrived={ready && held}
        failed={failed}
        label={`Loading ${tank?.name ?? 'the reserve'}`}
      >
        {failed && (
          <div className="environment-loader-actions">
            <button type="button" className="crt-button crt-button--lumen" onClick={onRetry}>Retry</button>
            <button type="button" className="crt-button" onClick={onBack}>Reserves</button>
          </div>
        )}
      </DiveDescent>
    </div>
  )
}
