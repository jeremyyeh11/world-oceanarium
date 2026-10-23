import { useEffect, useRef, useState } from 'react'
import { DEPTH_ZONES } from '../data/species'
import { attentionOrder } from '../utils/attentionOrder'

const DEPTH_ZONE_BY_ID = new Map(DEPTH_ZONES.map(zone => [zone.id, zone]))

// Must match the environment-card-pick duration in environments.css, so the chosen
// card finishes lighting up before the loader takes over.
const PICK_MS = 420
const PICK_REDUCED_MS = 0

function prefersReducedMotion() {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
}

// The tank's own water, as a swatch: its art-directed background stops when it has
// them, else the biome colour fading to the void. Gives each card a sense of the
// place without loading a single asset.
function swatchFor(tank, biome) {
  const stops = tank.lighting?.backgroundStops
  if (stops?.length) {
    return `linear-gradient(180deg, ${stops.map(([at, color]) => `${color} ${Math.round(at * 100)}%`).join(', ')})`
  }
  const base = tank.lighting?.envHorizon ?? biome?.color ?? '#0e4a7a'
  return `linear-gradient(180deg, ${base} 0%, #061a2c 70%, #02060d 100%)`
}

function depthLabel(tank) {
  const zone = DEPTH_ZONE_BY_ID.get(tank.depthZone)
  if (!zone) return null
  const [top, bottom] = zone.depthRangeMeters
  return `${zone.shortLabel} · ${top}–${bottom} m`
}

export default function EnvironmentSelector({ tanks, biomesById, speciesCountByTank, initialTankId = null, onRank, onSelect }) {
  const [pickedId, setPickedId] = useState(null)
  const pickTimer = useRef(null)
  const listRef = useRef(null)

  // Focus lands on the last tank visited (or the first), so a keyboard viewer coming
  // back up can dive straight back in, or arrow to the next one.
  useEffect(() => {
    const target = listRef.current?.querySelector(`[data-tank-id="${initialTankId}"]`)
      ?? listRef.current?.querySelector('.environment-card')
    target?.focus({ preventScroll: true })
    return () => {
      if (pickTimer.current) window.clearTimeout(pickTimer.current)
    }
  }, [initialTankId])

  // Rank the tanks by where viewers look first in the grid as it is laid out now (one
  // column on a phone, more on desktop), most likely first. App loads and prefetches in
  // this order through the environment loader. Re-ranked when the column count changes.
  useEffect(() => {
    const list = listRef.current
    if (!list) return undefined
    let lastKey = ''
    const rank = () => {
      const columns = getComputedStyle(list).gridTemplateColumns.split(' ').filter(Boolean).length
      const ranked = attentionOrder(tanks.length, columns).map(index => tanks[index].id)
      const key = ranked.join('|')
      if (key === lastKey) return
      lastKey = key
      onRank?.(ranked)
    }
    rank()
    const observer = new ResizeObserver(rank)
    observer.observe(list)
    return () => observer.disconnect()
  }, [tanks, onRank])

  const pick = (tankId) => {
    if (pickedId) return
    setPickedId(tankId)
    pickTimer.current = window.setTimeout(() => onSelect?.(tankId), prefersReducedMotion() ? PICK_REDUCED_MS : PICK_MS)
  }

  const moveFocus = (event) => {
    const keys = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 }
    const step = keys[event.key]
    if (!step) return
    const cards = [...(listRef.current?.querySelectorAll('.environment-card') ?? [])]
    const index = cards.indexOf(document.activeElement)
    if (index < 0) return
    event.preventDefault()
    cards[(index + step + cards.length) % cards.length].focus()
  }

  return (
    <div className={`environment-selector${pickedId ? ' is-picking' : ''}`} role="region" aria-labelledby="environment-selector-title">
      <div className="environment-selector-inner">
        <header className="environment-selector-header">
          <p className="environment-selector-eyebrow">Live feed · {tanks.length} tanks</p>
          <h1 id="environment-selector-title" className="environment-selector-title">Choose a tank</h1>
        </header>

        <div className="environment-list" ref={listRef} onKeyDown={moveFocus}>
          {tanks.map((tank, index) => {
            const count = speciesCountByTank.get(tank.id) ?? 0
            const depth = depthLabel(tank)
            return (
              <button
                key={tank.id}
                type="button"
                data-tank-id={tank.id}
                className={`environment-card crt-panel${pickedId === tank.id ? ' is-picked' : ''}`}
                style={{ '--environment-swatch': swatchFor(tank, biomesById.get(tank.biome)) }}
                disabled={Boolean(pickedId)}
                onClick={() => pick(tank.id)}
              >
                <span className="environment-card-swatch" aria-hidden="true" />
                <span className="environment-card-body">
                  <span className="environment-card-meta">
                    <span className="environment-card-index">{String(index + 1).padStart(2, '0')}</span>
                    {depth && <span className="environment-card-depth">{depth}</span>}
                  </span>
                  <span className="environment-card-name">{tank.name}</span>
                  {tank.tagline && <span className="environment-card-tagline">{tank.tagline}</span>}
                  {tank.description && <span className="environment-card-description">{tank.description}</span>}
                  <span className="environment-card-footer">
                    <span><b>{count}</b> species</span>
                    <span className="environment-card-cta" aria-hidden="true">Dive ▼</span>
                  </span>
                </span>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
