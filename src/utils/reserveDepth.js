import { DEPTH_ZONE_BY_ID } from './speciesLookup.js'

// A reserve's depth range in metres: its own `depthMeters` in TANKS, else its depth
// zone's range. The descent's scale, ticks and readout, and the selector card's label,
// all come from here, so a new reserve only has to declare its range.
export function reserveDepthRange(tank) {
  if (Array.isArray(tank?.depthMeters) && tank.depthMeters.length === 2) return tank.depthMeters
  return DEPTH_ZONE_BY_ID.get(tank?.depthZone)?.depthRangeMeters ?? [0, 200]
}

export function reserveDepthLabel(tank) {
  const zone = DEPTH_ZONE_BY_ID.get(tank?.depthZone)
  const [top, bottom] = reserveDepthRange(tank)
  return zone ? `${zone.shortLabel} · ${top}–${bottom} m` : `${top}–${bottom} m`
}

// Round-number ticks for a range: the smallest step from the list that gives at most five
// intervals (0–30 m → every 10 m, 0–200 m → every 50 m). Both ends are always marked; an
// interior tick closer than 40% of a step to the bottom is dropped so labels never touch.
// Each tick is { meters, at } with `at` the 0–1 position down the line.
const TICK_STEPS = [1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000]

export function depthTicks([top, bottom]) {
  const span = Math.max(1, bottom - top)
  const step = TICK_STEPS.find(candidate => span / candidate <= 5) ?? TICK_STEPS.at(-1)
  const ticks = [top]
  for (let meters = Math.ceil((top + 1) / step) * step; meters < bottom; meters += step) {
    if (bottom - meters >= step * 0.4) ticks.push(meters)
  }
  ticks.push(bottom)
  return ticks.map(meters => ({ meters, at: (meters - top) / span }))
}
