import { useEffect, useRef, useState } from 'react'
import { APP_VERSION } from '../version'
import DiveDescent from './DiveDescent'

// The descent holds at least this long, so a warm first reserve still reads as a dive.
const MIN_DESCENT_MS = 1600
// The diver reaches the bottom and the floor flares before the gate clears.
const ARRIVE_MS = 650
// Must match landing-gate-clear in crt.css.
const CLEAR_MS = 700
const CLEAR_REDUCED_MS = 200
// Never strand anyone on the descent: past this the gate opens onto the selector
// whatever the first reserve is doing (it keeps loading underneath).
const DESCENT_SAFETY_MS = 15000

function prefersReducedMotion() {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
}

// The gate is fully opaque: nothing behind it shows until it clears. Dive in swaps the
// card straight for the descent (DiveDescent), which runs while the first reserve warms
// underneath (`descent`: its { progress, stage, loaded, total },
// utils/environmentProgress.js); the gate clears onto the reserve selector once that
// reserve has rendered.
//
// Phases: idle → descending → clearing → gone.
export default function LandingGate({ speciesCount, progress = 0, ready = false, descent = null, zone = null, onDive, onEnter }) {
  const [phase, setPhase] = useState('idle')
  const [held, setHeld] = useState(false)
  const [forced, setForced] = useState(false)
  const timers = useRef([])
  const enterRef = useRef(null)
  const diving = phase !== 'idle'

  const later = (fn, ms) => { timers.current.push(window.setTimeout(fn, ms)) }

  useEffect(() => {
    enterRef.current?.focus()
    const pending = timers.current
    return () => pending.forEach(timer => window.clearTimeout(timer))
  }, [])

  const startDive = () => {
    if (diving || !ready) return
    // The click is the user gesture; audio has to start here, not when the gate clears.
    onDive?.()
    setPhase('descending')
    later(() => setHeld(true), MIN_DESCENT_MS)
    later(() => setForced(true), DESCENT_SAFETY_MS)
  }

  const descentDone = descent?.stage === 'ready' || descent?.stage === 'error'
  const arrived = diving && held && (descentDone || forced)

  useEffect(() => {
    if (phase !== 'descending' || !arrived) return
    const reduced = prefersReducedMotion()
    later(() => {
      setPhase('clearing')
      later(() => {
        setPhase('gone')
        onEnter?.()
      }, reduced ? CLEAR_REDUCED_MS : CLEAR_MS)
    }, reduced ? 0 : ARRIVE_MS)
  }, [phase, arrived, onEnter])

  // Enter/Space already fire the button; this catches the impatient-keypress case
  // where focus has drifted off it. It bypasses the button entirely, so the `ready`
  // guard has to live inside startDive rather than only on `disabled`.
  useEffect(() => {
    const enterOnKey = (event) => {
      if (event.key !== 'Enter' && event.key !== ' ' && event.key !== 'Escape') return
      if (event.target instanceof HTMLButtonElement) return
      event.preventDefault()
      startDive()
    }

    window.addEventListener('keydown', enterOnKey)
    return () => window.removeEventListener('keydown', enterOnKey)
  })

  if (phase === 'gone') return null

  if (phase === 'descending' || phase === 'clearing') {
    let readout = `Charting the reserves · ${descent?.loaded ?? 0} / ${descent?.total ?? 0} files`
    if (descent?.stage === 'building') readout = 'Lighting the water…'
    if (arrived) readout = 'Arrived'
    const [top, bottom] = zone?.depthRangeMeters ?? [0, 200]
    return (
      <div className={`landing-gate is-descending${phase === 'clearing' ? ' is-clearing' : ''}`} role="status" aria-live="polite">
        <DiveDescent
          eyebrow="Live feed · descending"
          title="Into the blue"
          tagline={zone ? `${zone.shortLabel} · ${top}–${bottom} m` : null}
          progress={descent?.progress ?? 0}
          readout={readout}
          maxDepthMeters={bottom}
          arrived={arrived}
          label="Descending to the reserves"
        />
      </div>
    )
  }

  return (
    <div
      className="landing-gate"
      role="dialog"
      aria-modal="true"
      aria-labelledby="landing-title"
    >

      {/* No crt-banded here — the fixed .crt-screen film already bands this, and
          doubling it would both muddy the panel and drag the lines down mid-dive. */}
      <div className="landing-card crt-panel">
        <p className="landing-eyebrow">Live feed · {APP_VERSION}</p>
        {/* The mark is a mask, not an <img>, so it takes the CRT foam tint and the
            same convergence split as the title instead of shipping its own white. */}
        <div className="landing-mark" aria-hidden="true" />
        <h1 id="landing-title" className="landing-title">World<br />Oceanarium</h1>
        <p className="landing-tagline">just keep swimming</p>

        {/* Doubles as the load bar: the hairline was already here, so filling it
            adds no layout and nothing to dismiss once loading is done.

            Loader progress arrives in steps, one jump per asset, so binding the
            fill straight to it would read as a stutter of hard snaps. The easing
            is a CSS transition rather than a JS lerp: it needs no animation
            frames, which matters because requestAnimationFrame is paused in a
            hidden tab — a bar driven by rAF would sit at 0% for anyone who opens
            the page in the background and comes back to it.

            The value is a unitless 0–1 scale rather than a percentage because the
            fill is drawn with transform: scaleX, which the compositor animates off
            the main thread. See the .landing-rule::after rule for why that matters
            during a load. */}
        <div
          style={{ '--load-scale': progress / 100 }}
          className={`landing-rule${ready ? ' is-loaded' : ' is-loading'}`}
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(progress)}
          aria-label="Charting the reserves"
        />

        <div className="landing-readout">
          <span>{ready ? <><b>{speciesCount}</b> species</> : 'Charting the reserves…'}</span>
          <span>Tap a creature to follow it</span>
        </div>

        <button
          ref={enterRef}
          type="button"
          className="crt-button crt-button--lumen landing-enter"
          onClick={startDive}
          disabled={!ready}
        >
          {ready ? '▼ Dive in ▼' : 'Charting…'}
        </button>

      </div>
    </div>
  )
}
