import { useEffect, useRef, useState } from 'react'
import { depthTicks } from '../utils/reserveDepth'
import PixelSprite from './PixelSprite'

// A freediver going head-first down a guideline: the vertical progress bar for every
// descent (the landing dive and each reserve's loading screen). The line above the
// diver is lit, the line below is dark water; the diver's depth is the progress.
//
// The diver is pixel art on a 15 × 24 grid, drawn as runs of cells so it stays crisp at
// any integer scale (`--descent-px`). Head down, arms out, fins up, seen from the front
// as a freediver goes down a line: legs apart at the calves, hips, a narrower waist,
// shoulders wider than the hips, one lit row across the face for the mask.
// Rows are [y, [x0, x1], ...] with x0..x1 inclusive.
const DIVER_BODY = [
  [3, [6, 6], [8, 8]], [4, [6, 6], [8, 8]], [5, [6, 6], [8, 8]],
  [6, [5, 6], [8, 9]], [7, [5, 6], [8, 9]], [8, [5, 6], [8, 9]], [9, [5, 6], [8, 9]],
  [10, [5, 9]], [11, [5, 9]],
  [12, [6, 8]], [13, [6, 8]],
  [14, [5, 9]], [15, [5, 9]], [16, [5, 9]],
  [17, [4, 10]],
  [18, [3, 3], [7, 7], [11, 11]],
  [19, [2, 2], [6, 8], [12, 12]],
  [20, [1, 1], [13, 13]],
  [21, [1, 1], [6, 8], [13, 13]],
  [22, [7, 7]],
]
// A flutter kick in two frames, swapped in steps: one blade reaches up while the other
// draws back, then they trade.
const FINS_LEFT_UP = [[0, [4, 6]], [1, [4, 6], [8, 10]], [2, [5, 6], [8, 9]]]
const FINS_RIGHT_UP = [[0, [8, 10]], [1, [4, 6], [8, 10]], [2, [5, 6], [8, 9]]]
// The mask: the lit row across the face (the head's middle row).
const DIVER_MASK = [[20, [6, 8]]]

// Marine snow drifting up past the diver, which is what makes the diver read as the
// thing moving. Fixed positions so it is the same every visit.
const SNOW = [
  [8, 62, 0, 11], [17, 88, 3.2, 14], [26, 71, 6.1, 12], [33, 95, 1.4, 16], [41, 66, 8.3, 13],
  [58, 84, 2.2, 15], [64, 69, 5.4, 11], [72, 92, 7.7, 14], [79, 75, 0.8, 12], [87, 98, 4.6, 17],
  [93, 64, 9.1, 13], [12, 99, 10.4, 15], [49, 79, 11.2, 12], [68, 61, 12.6, 16],
]

// Matches the diver's 1200 ms transform transition in descent.css, so the depth label
// and the passed ticks count down with the diver instead of jumping ahead of it.
const TRAVEL_MS = 1200
const easeOut = t => 1 - (1 - t) ** 3

// The depth the diver is drawn at right now, tweened toward `target` over TRAVEL_MS.
// rAF pauses in a hidden tab; the label then catches up on return, which is fine for
// a readout (the diver itself moves by CSS transition either way).
function useTravelledDepth(target) {
  const [shown, setShown] = useState(0)
  const shownRef = useRef(0)
  useEffect(() => {
    const from = shownRef.current
    if (from === target) return undefined
    const start = performance.now()
    let frame = 0
    const step = (now) => {
      const t = Math.min(1, (now - start) / TRAVEL_MS)
      shownRef.current = from + (target - from) * easeOut(t)
      setShown(shownRef.current)
      if (t < 1) frame = window.requestAnimationFrame(step)
    }
    frame = window.requestAnimationFrame(step)
    return () => window.cancelAnimationFrame(frame)
  }, [target])
  return shown
}

function cells(rows) {
  return rows.flatMap(([y, ...runs]) => runs.map(([x0, x1]) => (
    <rect key={`${y}:${x0}`} x={x0} y={y} width={x1 - x0 + 1} height={1} />
  )))
}

// `scenery` is the reserve's `descent` block from TANKS (docs/tank-design.md, Descent
// scenery): `signature` species and habitat `scenery` pieces, each { sprite, depth, side,
// flip? }. `depth` is metres within the range, or 'floor' to stand on the seabed. They are
// standees: placed, never moving down the screen, dark until the diver reaches their depth.
export default function DiveDescent({ eyebrow, title, tagline, progress = 0, readout, depthRange = [0, 200], scenery = null, arrived = false, failed = false, label = 'Loading', children = null }) {
  // The diver never climbs back up: loader progress can step back when a request is
  // superseded or retried, and a rising diver reads as something going wrong.
  const deepest = useRef(0)
  deepest.current = Math.max(deepest.current, Math.min(1, Math.max(0, progress)))
  // Every dive starts at the surface: the first frame draws the diver at 0 m and the
  // next one hands it the real depth, so the transition carries it down from the top
  // even when most of the load was done before Dive in.
  const [entered, setEntered] = useState(false)
  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setEntered(true))
    return () => window.cancelAnimationFrame(frame)
  }, [])
  const depth = !entered ? 0 : arrived ? 1 : deepest.current
  const travelled = useTravelledDepth(depth)
  const [top, bottom] = depthRange
  const meters = Math.round(top + travelled * (bottom - top))
  const ticks = depthTicks(depthRange)
  const span = Math.max(1, bottom - top)
  const standees = [
    ...(scenery?.scenery ?? []).map(item => ({ ...item, kind: 'habitat' })),
    ...(scenery?.signature ?? []).map(item => ({ ...item, kind: 'species' })),
  ]
  // Seabed pieces line up outward from the line on each side, in list order.
  const floorSlots = { left: 0, right: 0 }
  const placed = standees.map(item => {
    const floor = item.depth === 'floor'
    const side = item.side === 'left' ? 'left' : 'right'
    const at = floor ? 1 : Math.min(1, Math.max(0, (item.depth - top) / span))
    const slot = floor ? floorSlots[side]++ : 0
    return { ...item, side, floor, at, slot }
  })

  return (
    <div className={`descent${arrived ? ' is-arrived' : ''}${failed ? ' is-failed' : ''}`}>
      <div className="descent-light" aria-hidden="true" />
      <div className="descent-snow" aria-hidden="true">
        {SNOW.map(([left, top, delay, duration]) => (
          <i key={`${left}:${top}`} style={{ left: `${left}%`, top: `${top}%`, animationDelay: `-${delay}s`, animationDuration: `${duration}s` }} />
        ))}
      </div>

      <header className="descent-header">
        {eyebrow && <p className="descent-eyebrow">{eyebrow}</p>}
        {title && <h2 className="descent-title">{title}</h2>}
        {tagline && <p className="descent-tagline">{tagline}</p>}
      </header>

      <div
        className="descent-shaft"
        style={{ '--descent': depth }}
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(depth * 100)}
        aria-valuetext={`${meters} metres`}
        aria-label={label}
      >
        <span className="descent-surface" aria-hidden="true" />
        <span className="descent-line" aria-hidden="true" />
        <span className="descent-line-lit" aria-hidden="true" />
        <ol className="descent-ticks" aria-hidden="true">
          {ticks.map(({ meters: mark, at }) => (
            <li key={mark} className={travelled >= at - 0.001 ? 'is-passed' : undefined} style={{ '--at': at }}>
              {mark} m
            </li>
          ))}
        </ol>
        {placed.length > 0 && (
          <div className="descent-standees" aria-hidden="true">
            {placed.map(({ sprite, side, flip, floor, at, slot, kind }, index) => (
              <div
                key={`${sprite}:${index}`}
                className={`descent-standee is-${side} is-${kind}${floor ? ' is-floor' : ''}${travelled >= at - 0.02 ? ' is-lit' : ''}`}
                style={{ '--at': at, '--slot': slot }}
              >
                <PixelSprite name={sprite} flip={flip} />
              </div>
            ))}
          </div>
        )}
        <div className="descent-diver" aria-hidden="true">
          <span className="descent-depth">{meters} m</span>
          <svg className="descent-sprite" viewBox="0 0 15 24" shapeRendering="crispEdges">
            <g className="descent-sprite-body">{cells(DIVER_BODY)}</g>
            <g className="descent-fin descent-fin--glide">{cells(FINS_LEFT_UP)}</g>
            <g className="descent-fin descent-fin--kick">{cells(FINS_RIGHT_UP)}</g>
            <g className="descent-sprite-mask">{cells(DIVER_MASK)}</g>
          </svg>
          <span className="descent-bubbles"><i /><i /><i /></span>
        </div>
        <span className="descent-floor" aria-hidden="true" />
      </div>

      {readout && <p className="descent-readout">{readout}</p>}
      {children}
    </div>
  )
}
