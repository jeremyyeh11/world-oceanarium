import { useEffect, useRef, useState } from 'react'
import { APP_VERSION } from '../version'
import DiveDescent from './DiveDescent'
import { reserveDepthLabel, reserveDepthRange } from '../utils/reserveDepth'

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
// utils/environmentProgress.js; `reserve`: that reserve, for its depth range); the gate clears onto the reserve selector once that
// reserve has rendered.
//
// Phases: idle → descending → clearing → gone.
export default function LandingGate({ speciesCount, descent = null, reserve = null, onDive, onEnter }) {
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
    if (diving) return
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
  // where focus has drifted off it. It bypasses the button entirely, so the
  // once-only guard lives inside startDive.
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
    return (
      <div className={`landing-gate is-descending${phase === 'clearing' ? ' is-clearing' : ''}`} role="status" aria-live="polite">
        <DiveDescent
          eyebrow="Live feed · descending"
          title="Into the blue"
          tagline={reserve ? reserveDepthLabel(reserve) : null}
          progress={descent?.progress ?? 0}
          readout={readout}
          depthRange={reserveDepthRange(reserve)}
          scenery={reserve?.descent ?? null}
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

        {/* Just the hairline now: the landing loads nothing the viewer waits on. All
            loading is the descent's, after Dive in. */}
        <div className="landing-rule" aria-hidden="true" />

        <div className="landing-readout">
          {/* The count arrives with the creature fetch; a blank line holds its place. */}
          <span>{speciesCount > 0 ? <><b>{speciesCount}</b> species</> : '\u00a0'}</span>
          <span>Tap a creature to follow it</span>
        </div>

        <button
          ref={enterRef}
          type="button"
          className="crt-button crt-button--lumen landing-enter"
          onClick={startDive}
        >
          ▼ Dive in ▼
        </button>

      </div>
    </div>
  )
}
