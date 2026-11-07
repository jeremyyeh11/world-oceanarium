import { Box3, Vector3 } from 'three'
import { SURFACE_PLANE_Y } from '../utils/waterSurfaceGeometry.js'

const SOLVER_PASSES = 6
const STEM_LINKS = 8

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
  for (let i = 0; i <= STEM_LINKS; i += 1) {
    const t = i / STEM_LINKS
    const rest = root.clone().addScaledVector(lean, t * t)
    rest.y += step * i
    const joint = point(rest)
    stalk.push(joint.position)
    if (i > 0) {
      links.push({ a: points[i - 1], b: joint, length: step, aWeight: i === 1 ? 0 : 0.5 })
    }
    points.push(joint)
  }

  // More blades near the light. Each pair of free points shares its root with the stipe.
  let azimuth = phase
  for (const index of [2, 3, 4, 5, 5, 6, 6, 7, 7, 8, 8]) {
    const anchor = points[index]
    azimuth += 2.39996 + random() * 0.5
    const length = (2.7 + random() * 2.6) * (0.68 + 0.32 * index / STEM_LINKS)
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
  plant.step = dt

  for (let i = 1; i < points.length; i += 1) {
    const { position, previous, rest, anchor } = points[i]
    const t = Math.max(0, Math.min(1, (position.y - root.y) / height))
    // Long swell is shared across the bed, with a travelling phase up each stipe.
    const swell = time * 0.87 + root.x * 0.07 + root.z * 0.04 - t * 1.8
    const surge = 2.4 + Math.sin(swell) * 3.8 + Math.sin(time * 1.31 + phase) * 0.9
    offset.copy(rest)
    if (anchor) offset.add(anchor.position)
    offset.sub(position).multiplyScalar(anchor ? 3.6 : 0.88)
    offset.x += surge * (0.25 + t) + (anchor ? Math.sin(time * 2.7 + phase + i) * 2.1 : 0)
    offset.z += Math.sin(swell * 0.72 + phase) * (anchor ? 2.8 : 1.6)
    offset.y += anchor ? Math.cos(time * 2.2 + phase + i * 0.8) * 2.8 : 3.2
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
