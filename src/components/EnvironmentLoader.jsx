import { useEffect, useRef, useState } from 'react'
import { DEPTH_ZONES } from '../data/species'
import { useSceneReady } from '../hooks/useSceneReady'

const DEPTH_ZONE_BY_ID = new Map(DEPTH_ZONES.map(zone => [zone.id, zone]))

// A cached revisit can be ready in a few hundred ms; holding the card this long keeps
// it reading as a descent rather than a flash.
const MIN_HOLD_MS = 1300
// Must match environment-loader-clear in environments.css.
const CLEAR_MS = 700
const CLEAR_REDUCED_MS = 200

function prefersReducedMotion() {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
}

/**
 * Covers the tank while its scene streams in and warms up, then clears to reveal it.
 * Mounted fresh (keyed) for every visit, so useSceneReady measures this tank's load
 * and not the one before it.
 */
export default function EnvironmentLoader({ tank, creaturesLoading, onDone }) {
  const { progress, ready } = useSceneReady(creaturesLoading)
  const [held, setHeld] = useState(false)
  const [clearing, setClearing] = useState(false)
  const doneTimer = useRef(null)

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
  const percent = ready ? 100 : Math.round(progress)

  return (
    <div
      className={`environment-loader${clearing ? ' is-clearing' : ''}`}
      role="status"
      aria-live="polite"
      aria-busy={!ready}
    >
      <div className="environment-loader-card">
        <p className="environment-loader-eyebrow">Descending{zone ? ` · ${zone.shortLabel}` : ''}</p>
        <h2 className="environment-loader-title">{tank?.name}</h2>
        {tank?.tagline && <p className="environment-loader-tagline">{tank.tagline}</p>}
        <div
          style={{ '--load-scale': percent / 100 }}
          className={`landing-rule${ready ? ' is-loaded' : ' is-loading'}`}
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={percent}
          aria-label={`Loading ${tank?.name ?? 'the tank'}`}
        />
        <p className="environment-loader-readout">{ready ? 'Tank ready' : `Filling the tank · ${percent}%`}</p>
      </div>
    </div>
  )
}
