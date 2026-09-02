import { useEffect, useRef, useState } from 'react'
import { APP_VERSION } from '../version'

// Must match the landing-card-dive / landing-gate-clear durations in crt.css so the
// gate unmounts on the frame the animation lands, not before it.
const DIVE_MS = 1150
const DIVE_REDUCED_MS = 260

// Read on the way down, not on the way in — these only become visible once the
// card starts sinking, so they double as the depth cue for the dive.
const DEPTH_TICKS = [
  '── 0m · surface',
  '10m · the light still reaches ──',
  '── 40m · colour starts to drain',
  '80m · open water ──',
]

function prefersReducedMotion() {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
}

export default function LandingGate({ speciesCount, progress = 0, ready = false, onEnter }) {
  const [diving, setDiving] = useState(false)
  const [dismissed, setDismissed] = useState(false)
  const diveTimer = useRef(null)
  const enterRef = useRef(null)

  useEffect(() => {
    enterRef.current?.focus()
    return () => {
      if (diveTimer.current) window.clearTimeout(diveTimer.current)
    }
  }, [])

  const startDive = () => {
    if (diving || !ready) return
    setDiving(true)
    diveTimer.current = window.setTimeout(() => {
      setDismissed(true)
      onEnter?.()
    }, prefersReducedMotion() ? DIVE_REDUCED_MS : DIVE_MS)
  }

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

  if (dismissed) return null

  return (
    <div
      className={`landing-gate${diving ? ' is-diving' : ''}`}
      role="dialog"
      aria-modal="true"
      aria-labelledby="landing-title"
    >
      <div className="landing-depth-ticks" aria-hidden="true">
        {DEPTH_TICKS.map(tick => <span key={tick}>{tick}</span>)}
      </div>

      {/* No crt-banded here — the fixed .crt-screen film already bands this, and
          doubling it would both muddy the panel and drag the lines down mid-dive. */}
      <div className="landing-card crt-panel">
        <p className="landing-eyebrow">Live feed · {APP_VERSION}</p>
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
          aria-label="Loading the tank"
        />

        <div className="landing-readout">
          <span>{ready ? <><b>{speciesCount}</b> species</> : 'Filling the tank…'}</span>
          <span>Tap a creature to follow it</span>
        </div>

        <button
          ref={enterRef}
          type="button"
          className="crt-button crt-button--lumen landing-enter"
          onClick={startDive}
          disabled={!ready || diving}
        >
          {ready ? '▼ Dive in ▼' : 'Filling…'}
        </button>

        {/* Only occupies space during the dive — there is nothing worth saying
            here before the viewer commits. */}
        {diving && <p className="landing-footnote">descending…</p>}
      </div>
    </div>
  )
}
