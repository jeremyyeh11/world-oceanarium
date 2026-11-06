import * as THREE from 'three'
import { clampToSwimBounds } from './fishSwim.js'
import { SURFACE_PLANE_Y } from '../utils/waterSurfaceGeometry.js'

// Authored targets only: every stage still travels through Fish's ordinary steering,
// turn cap, integrator and clamps. Times use the paused tank's simulation clock.
export function createTurtleSurfacingState() {
  return { stage: 'cruise', nextAt: null, startedAt: 0, until: 0, diveY: 0, target: new THREE.Vector3() }
}

export function turtleSurfaceCeiling(config, bodyLength) {
  return SURFACE_PLANE_Y - config.clearanceBodyLengths * bodyLength
}

function between(rand, range) {
  return range[0] + rand() * (range[1] - range[0])
}

export function advanceTurtleSurfacing(state, config, now, position, forward, bodyLength, bounds, rand) {
  if (state.nextAt === null) state.nextAt = now + between(rand, config.interval)
  const ceiling = turtleSurfaceCeiling(config, bodyLength)
  if (state.stage === 'cruise' && now >= state.nextAt) {
    state.stage = 'rise'
    state.startedAt = now
    state.diveY = between(rand, config.cruiseY)
  }
  if (state.stage === 'rise' && position.y >= ceiling - bodyLength * 0.04) {
    state.stage = 'breathe'
    state.until = now + between(rand, config.duration)
  }
  if ((state.stage === 'breathe' && now >= state.until)
    || (state.stage === 'rise' && now - state.startedAt >= config.maxRiseSeconds)) state.stage = 'dive'
  if (state.stage === 'dive' && position.y <= config.cruiseY[1]) {
    state.stage = 'cruise'
    state.nextAt = now + between(rand, config.interval)
  }
  if (state.stage === 'cruise') return false

  // Look ahead along the heading; horizontal walls bend it back through the normal pipeline.
  const horizontal = Math.hypot(forward.x, forward.z) || 1
  state.target.set(
    position.x + forward.x / horizontal * bodyLength * 6,
    position.y,
    position.z + forward.z / horizontal * bodyLength * 6,
  )
  clampToSwimBounds(state.target, bounds)
  state.target.y = state.stage === 'dive' ? state.diveY : ceiling + bodyLength * 0.2
  return true
}
