import { useEffect, useRef, useState } from 'react'
import { DEPTH_ZONES } from '../data/species'
import { useEnvironmentLoading } from '../hooks/useEnvironmentLoading'

const DEPTH_ZONE_BY_ID = new Map(DEPTH_ZONES.map(zone => [zone.id, zone]))

// A warm tank can be ready in a few hundred ms; holding the card this long keeps it
// reading as a descent rather than a flash.
const MIN_HOLD_MS = 1300
// Must match environment-loader-clear in environments.css.
const CLEAR_MS = 700
const CLEAR_REDUCED_MS = 200
// Source files are most of the wait on a cold load, but not all of it: once they are in,
// the scene still builds (rock merges, coral placement) and its shaders compile before
// the first frame. The bar gives files this share and holds the rest for the build, so
// it does not sit at 100% while the tank is still being put together.
const FILES_SHARE = 0.85

function prefersReducedMotion() {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
}

/**
 * Covers the tank while the environment loader fetches its files and the scene builds,
 * then clears once the loader has acknowledged this tank's first rendered frame
 * (`phase: 'ready'`, docs/environment-loading.md). Mounted fresh (keyed) per visit.
 */
export default function EnvironmentLoader({ tank, onDone, onRetry, onBack }) {
  const state = useEnvironmentLoading()
  const [held, setHeld] = useState(false)
  const [clearing, setClearing] = useState(false)
  const doneTimer = useRef(null)

  const env = state.environments[tank?.id]
  const isTarget = state.requestedId === tank?.id
  const ready = isTarget && state.phase === 'ready' && state.activeId === tank?.id
  const failed = isTarget && state.phase === 'error'
  const building = isTarget && (state.phase === 'assets-ready' || state.phase === 'activating')

  useEffect(() => {
    const timer = window.setTimeout(() => setHeld(true), MIN_HOLD_MS)
    return () => window.clearTimeout(timer)
  }, [])

  useEffect(() => {
    if (!ready || !held || clearing) return
    setClearing(true)
    doneTimer.current = window.setTimeout(() => onDone?.(), prefersReducedMotion() ? CLEAR_REDUCED_MS : CLEAR_MS)
  }, [ready, held, clearing, onDone])

  useEffect(() => () => {
    if (doneTimer.current) window.clearTimeout(doneTimer.current)
  }, [])

  const zone = DEPTH_ZONE_BY_ID.get(tank?.depthZone)
  const fileShare = (env?.progress ?? 0) * FILES_SHARE
  const scale = ready ? 1 : building ? FILES_SHARE + (1 - FILES_SHARE) * 0.5 : fileShare
  const percent = Math.round(scale * 100)

  let readout = `Fetching · ${env?.loaded ?? 0} / ${env?.total ?? 0} files`
  if (building) readout = 'Building the tank…'
  if (ready) readout = 'Tank ready'

  return (
    <div
      className={`environment-loader${clearing ? ' is-clearing' : ''}`}
      role="status"
      aria-live="polite"
      aria-busy={!ready && !failed}
    >
      <div className="environment-loader-card">
        <p className="environment-loader-eyebrow">{failed ? 'Signal lost' : `Descending${zone ? ` · ${zone.shortLabel}` : ''}`}</p>
        <h2 className="environment-loader-title">{tank?.name}</h2>
        {tank?.tagline && <p className="environment-loader-tagline">{tank.tagline}</p>}
        <div
          style={{ '--load-scale': scale }}
          className={`landing-rule${ready ? ' is-loaded' : ' is-loading'}`}
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={percent}
          aria-label={`Loading ${tank?.name ?? 'the tank'}`}
        />
        {failed ? (
          <>
            <p className="environment-loader-readout">{state.error ?? 'The tank failed to load.'}</p>
            <div className="environment-loader-actions">
              <button type="button" className="crt-button crt-button--lumen" onClick={onRetry}>Retry</button>
              <button type="button" className="crt-button" onClick={onBack}>Tanks</button>
            </div>
          </>
        ) : (
          <p className="environment-loader-readout">{readout}</p>
        )}
      </div>
    </div>
  )
}
