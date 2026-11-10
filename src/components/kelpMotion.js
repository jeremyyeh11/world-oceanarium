import { Box3, Vector3 } from 'three'
import { SURFACE_PLANE_Y } from '../utils/waterSurfaceGeometry.js'

const SOLVER_PASSES = 6
const STEM_LINKS = 16
const CURRENT_WAVE_NUMBER = 0.17 // Radians per WU, about one bend cycle per 37 WU of stipe.

function point(rest, anchor = null) {
  return { rest, anchor, position: anchor ? anchor.position.clone().add(rest) : rest.clone(), previous: null }
}

export function makeKelp(root, height, random) {
  const stalk = []
  const blades = []
  const points = []
  const links = []
  const step = height / STEM_LINKS
  const phase = random() * Math.PI * 2
  const lean = new Vector3(Math.cos(phase), 0, Math.sin(phase)).multiplyScalar(height * 0.085)
  const crossLean = new Vector3(-Math.sin(phase), 0, Math.cos(phase)).multiplyScalar(height * 0.07)
  for (let i = 0; i <= STEM_LINKS; i += 1) {
    const t = i / STEM_LINKS
    const rest = root.clone().addScaledVector(lean, t * t)
    rest.addScaledVector(crossLean, Math.sin(t * Math.PI * 2) * t)
    rest.y += step * i
    const joint = point(rest)
    stalk.push(joint.position)
    if (i > 0) {
      const parent = points[i - 1]
      links.push({ a: parent, b: joint, length: rest.distanceTo(parent.rest), aWeight: i === 1 ? 0 : 0.5 })
    }
    points.push(joint)
  }

  // More blades near the light. Each pair of free points shares its root with the stipe.
  let azimuth = phase
  for (const fraction of [0.25, 0.375, 0.5, 0.625, 0.625, 0.75, 0.75, 0.875, 0.875, 1, 1]) {
    const anchor = points[Math.round(fraction * STEM_LINKS)]
    azimuth += 2.39996 + random() * 0.5
    const length = (2.7 + random() * 2.6) * (0.68 + 0.32 * fraction)
    const direction = new Vector3(Math.cos(azimuth), 0.25 + random() * 0.45, Math.sin(azimuth)).normalize()
    const middle = point(direction.clone().multiplyScalar(length / 2), anchor)
    const endRest = direction.multiplyScalar(length)
    endRest.y -= length * 0.19
    const tip = point(endRest, anchor)
    points.push(middle, tip)
    links.push(
      { a: anchor, b: middle, length: length / 2, aWeight: 0.1 },
      { a: middle, b: tip, length: length / 2, aWeight: 0.5 },
    )
    blades.push({
      points: [anchor.position, middle.position, tip.position],
      across: new Vector3(-Math.sin(azimuth), 0, Math.cos(azimuth)),
      width: 0.58 + random() * 0.63,
      shade: 0.75 + random() * 0.44,
    })
  }

  for (const joint of points) joint.previous = joint.position.clone()
  const plant = { stalk, blades, points, links, root, height, phase, bounds: new Box3(), step: 0, elapsed: 0, nearby: [] }
  updateBounds(plant)
  return plant
}

function updateBounds(plant) {
  plant.bounds.makeEmpty()
  for (const { position } of plant.points) plant.bounds.expandByPoint(position)
  plant.bounds.expandByScalar(1)
}

const normal = new Vector3()
const velocity = new Vector3()
const offset = new Vector3()

function repel(point, { position: center, axis, halfLength, radius }) {
  const { position, previous } = point
  normal.subVectors(position, center)
  if (axis) {
    const along = Math.max(-halfLength, Math.min(halfLength, normal.dot(axis)))
    normal.addScaledVector(axis, -along)
  }
  const distanceSq = normal.lengthSq()
  if (distanceSq >= radius * radius) return
  const distance = Math.sqrt(distanceSq)
  if (distance > 1e-6) normal.multiplyScalar(1 / distance)
  else if (!axis) normal.set(1, 0, 0)
  else if (Math.abs(axis.y) < 0.9) normal.set(-axis.z, 0, axis.x).normalize()
  else normal.set(0, axis.z, -axis.y).normalize()
  velocity.subVectors(position, previous)
  velocity.addScaledVector(normal, -Math.min(0, velocity.dot(normal)))
  position.addScaledVector(normal, radius - distance)
  previous.copy(position).addScaledVector(velocity, -0.55)
}

export function advanceKelp(plant, time, dt, colliders) {
  const { root, height, phase, points, links, nearby, bounds } = plant
  nearby.length = 0
  for (const collider of colliders) {
    if (bounds.distanceToPoint(collider.position) <= collider.radius + collider.halfLength) nearby.push(collider)
  }
  const damping = Math.exp(-4.2 * dt) * (plant.step ? dt / plant.step : 1)
  const dtSq = dt * dt
  const swellPhase = time * 0.87 + root.x * 0.07 + root.z * 0.04
  const bendPhase = time * 0.96 + phase
  const plantSurge = 2.4 + Math.sin(time * 1.31 + phase) * 0.9
  plant.step = dt

  for (let i = 1; i < points.length; i += 1) {
    const { position, previous, rest, anchor } = points[i]
    const rise = (anchor?.rest.y ?? rest.y) - root.y
    const t = rise / height
    // The bed shares the slow swell. A shorter spatial wave bends sections of the same
    // stipe in different directions as it travels from the holdfast towards the tip.
    const swell = swellPhase - t * 1.8
    const bend = bendPhase - rise * CURRENT_WAVE_NUMBER
    const surge = plantSurge + Math.sin(swell) * 3.2
    offset.copy(rest)
    if (anchor) offset.add(anchor.position)
    offset.sub(position).multiplyScalar(anchor ? 3.6 : 0.74)
    offset.x += surge * (0.25 + t) + Math.sin(bend) * (1.0 + t * 2.8)
    if (anchor) offset.x += Math.sin(time * 2.7 + phase + i) * 2.1
    offset.z += Math.sin(swell * 0.72 + phase) * (anchor ? 2.8 : 1.6) + Math.cos(bend) * (0.8 + t * 2.2)
    offset.y += anchor ? Math.cos(time * 2.2 + phase + i * 0.8) * 2.8 : 2.1
    velocity.subVectors(position, previous).multiplyScalar(damping)
    previous.copy(position)
    position.add(velocity).addScaledVector(offset, dtSq)
  }

  // Project contact first so the length solves carry the push along the plant. The last
  // projection gives contact priority when a collider and a pinned root disagree.
  for (let pass = 0; pass <= SOLVER_PASSES; pass += 1) {
    for (let i = 1; i < points.length; i += 1) {
      const joint = points[i]
      for (const collider of nearby) repel(joint, collider)
      if (joint.position.y > SURFACE_PLANE_Y - 0.12) {
        joint.position.y = SURFACE_PLANE_Y - 0.12
        joint.previous.y = Math.max(joint.previous.y, joint.position.y)
      }
    }
    if (pass === SOLVER_PASSES) break
    for (const { a, b, length, aWeight } of links) {
      offset.subVectors(b.position, a.position)
      const distance = offset.length()
      if (distance < 1e-6) continue
      offset.multiplyScalar((distance - length) / distance)
      a.position.addScaledVector(offset, aWeight)
      b.position.addScaledVector(offset, aWeight - 1)
    }
  }
  updateBounds(plant)
}
