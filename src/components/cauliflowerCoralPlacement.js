import * as THREE from 'three'
import { sandHeight, seededRandom } from '../data/landscapes'
import { boundsOf, rockCaster } from './coralPlacement'
import { inTable } from './seaFanPlacement'
import { inMound } from './brainCoralPlacement'

// Cauliflower corals (Pocillopora meandrina; a landscape's `cauliflowerCorals`, landscapes.js),
// placed once the table corals, the sea fans and the brain corals are, against the rocks as drawn,
// on the same bommies (Jeremy wants every coral form on the same rocks as one cluster,
// 2026-10-20). They go in before the staghorn, which keeps clear of them (staghornPlacement.js
// `avoid`, inBush), as the brain corals do.
//
// A cauliflower coral is a small, tough bush, commonly 20 to 40 cm across, commonest on wave-swept
// reef crests and upper slopes (NMFS 2019 status review). Jeremy (2026-11-01): on the bommies'
// tops and upper shoulders only, never on the sand, singly or in loose twos and threes rather than
// patches, 2 to 4 a bommie. So each group picks a ledge (a face pointing mostly up) in the upper
// part of its bommie, the side facing the resting camera most often, and its colonies stand on
// ledges within GROUP_RADIUS of it. A colony leans a little with its ledge and is sunk to its neck:
// some of Jeremy's colonies stand on a short stalk below their head, which is buried in the rock.
// It is kept only if its foot is held up all round (rock under most of its rim), its head stays out
// of the rock (a little contact reads as grown onto it), out of every table (plate and stalk), the
// sea fans, the brain corals and the other bushes, and under water. A spot that clashes tries the
// colony smaller (SHRINKS) before giving up.

const UP = new THREE.Vector3(0, 1, 0)
const DOWN = new THREE.Vector3(0, -1, 0)
const ATTEMPTS_PER_COLONY = 80
// Least share of up in a ledge a colony may stand on (about 45° from level at most).
const MIN_LEDGE_UP = 0.7
// Lowest a colony stands on its bommie: this share of the way from the rock's foot to its top.
const UPPER_SHARE = 0.45
// How far a colony leans with its ledge (share of the ledge's tilt), and its largest lean (17°).
const LEAN_SHARE = 0.5
const MAX_LEAN = 0.3
// The neck is the lowest height at which the colony is NECK_SHARE of its full reach across: the
// foot of its head. The colony is sunk to NECK_BURY of its neck, and at least SINK of its height.
const NECK_SHARE = 0.5
const NECK_BURY = 0.85
const SINK = 0.04
// Points on the head tested against the rock, tables, fans, brain corals and other bushes, and how
// many may touch the rock.
const SAMPLE_COUNT = 32
const INSIDE_ALLOWED = 3
// Points round the rim at the ground line, and how many must have rock just under them.
const RIM_POINTS = 8
const RIM_SUPPORTED = 6
// How far under the rim support is looked for, in WU (5 cm).
const RIM_DEPTH = 0.2
// A group's colonies stand within this many WU (40 cm) of its first, and a group of 1, 2 or 3 is
// picked with these weights.
const GROUP_RADIUS = 1.6
const GROUP_WEIGHTS = [0.4, 0.35, 0.25]
// The sizes a spot tries, as shares of the colony drawn for it, biggest first.
const SHRINKS = [1, 0.75]
// Least distance between two colonies' feet, in shares of their summed radii: a loose group, each
// colony its own bush.
const SPACING = 0.9
const YIELD_EVERY = 20

// Colony facts of a kit model from its _lo mesh (model metres, the object origin of the source
// model at (0, 0, 0): the foot, where the colony meets the rock; +Y up): its height, its reach
// about the origin, its neck (the foot of its head, NECK_SHARE), the radius there, and points
// spread over the head above the neck.
export function measureBush(geometry) {
  geometry.computeBoundingBox()
  const height = geometry.boundingBox.max.y
  const position = geometry.attributes.position
  let radius = 0
  for (let i = 0; i < position.count; i++) {
    if (position.getY(i) >= 0) radius = Math.max(radius, Math.hypot(position.getX(i), position.getZ(i)))
  }
  let neck = height
  for (let i = 0; i < position.count; i++) {
    const y = position.getY(i)
    if (y >= 0 && y < neck && Math.hypot(position.getX(i), position.getZ(i)) >= radius * NECK_SHARE) neck = y
  }
  const ground = Math.max(neck * NECK_BURY, height * SINK)
  let footRadius = 0
  const head = []
  for (let i = 0; i < position.count; i++) {
    const y = position.getY(i)
    const r = Math.hypot(position.getX(i), position.getZ(i))
    if (Math.abs(y - ground) < height * 0.08) footRadius = Math.max(footRadius, r)
    if (y > ground + height * 0.1) head.push(i)
  }
  const samples = []
  for (let k = 0; k < SAMPLE_COUNT && head.length; k++) samples.push(new THREE.Vector3().fromBufferAttribute(position, head[Math.floor(k * head.length / SAMPLE_COUNT)]))
  return { height, radius, ground, footRadius: footRadius || radius * 0.5, samples }
}

// Whether a point is in a placed colony, or within a few cm plus `extra` WU of it, for the corals
// placed after the cauliflower corals (staghornPlacement.js). A bush has the brain coral's fields
// (base, height, reach), so its test is the brain coral's half ellipsoid.
export function inBush(bushes, point, extra = 0) {
  return inMound(bushes, point, extra)
}

// Placed cauliflower corals: [{ model, matrix, site, base, reach, height, centre, top, obstacle }],
// with `site` the index of the cluster it grows in, `base` its foot at the ground line, `centre`
// the middle of its head and `obstacle` a piece box for rockObstacles.js. A generator, like
// placeCorals: it yields every few candidate spots and returns the colonies when done. clusters are
// coralClusters' (the bommies the tables crown); tables the placed tables; measures are measureBush
// per kit model; view is the resting camera. `avoid(point, extra)`, if given, says whether a point
// (with `extra` WU round it) is taken by a coral placed before the cauliflower corals other than
// the tables (the sea fans and the brain corals).
export function* placeCauliflowerCorals(landscape, clusters, tables, measures, view, avoid = null) {
  const config = landscape.cauliflowerCorals
  const plates = tables.map(table => table.plate)
  const tableFeet = tables.map(table => ({ plate: table.plate, foot: new THREE.Vector3().setFromMatrixPosition(table.matrix) }))
  const placed = []
  const origin = new THREE.Vector3()
  const point = new THREE.Vector3()
  const lean = new THREE.Vector3()
  const axis = new THREE.Vector3()
  for (const [site, cluster] of clusters.entries()) {
    const rocks = rockCaster(cluster.geometries)
    const bounds = boundsOf(cluster.geometries)
    const centre = bounds.getCenter(new THREE.Vector3())
    const size = bounds.getSize(new THREE.Vector3())
    const floor = bounds.min.y + size.y * UPPER_SHARE
    const rand = seededRandom(config.seed * 7919 + cluster.seed)
    const pick = ([min, max]) => min + rand() * (max - min)
    const facing = view ? Math.atan2(view.z - centre.z, view.x - centre.x) : Math.PI / 2
    // Whether a colony placed by `matrix` (the ground line at `ground`) is clear: its head out of
    // the tables, the corals placed before it, the other bushes, the sand and (bar a few points)
    // the rock; and its foot held up all round, rock just under most of its rim.
    const fits = (shape, matrix) => {
      let inside = 0
      for (const sample of shape.samples) {
        point.copy(sample).applyMatrix4(matrix)
        if (inTable(tableFeet, plates, point) || avoid?.(point) || inMound(placed, point)) return false
        if (point.y < sandHeight(landscape, point.x, point.z)) return false
        if (rocks.inside(point) && ++inside > INSIDE_ALLOWED) return false
      }
      let supported = 0
      for (let k = 0; k < RIM_POINTS; k++) {
        const a = k * Math.PI * 2 / RIM_POINTS
        point.set(Math.cos(a) * shape.footRadius * 0.85, shape.ground, Math.sin(a) * shape.footRadius * 0.85).applyMatrix4(matrix)
        point.y -= RIM_DEPTH
        if (rocks.inside(point)) supported++
      }
      return supported >= RIM_SUPPORTED
    }
    // A ledge in the upper part of the bommie straight under (x, z), or null.
    const ledgeAt = (x, z) => {
      origin.set(x, bounds.max.y + 2, z)
      const hit = rocks.nearest(origin, DOWN, bounds.max.y + 2 - floor)
      if (!hit || hit.point.y < floor || hit.normal.y < MIN_LEDGE_UP) return null
      return { y: hit.point.y, normal: hit.normal.clone().normalize() }
    }
    // The spot's biggest colony that fits at (x, z) on `ledge`, or null.
    const colonyAt = (x, z, ledge) => {
      const model = Math.floor(rand() * measures.length)
      const shape = measures[model]
      const diameter = pick(config.diameter)
      lean.copy(UP).lerp(ledge.normal, LEAN_SHARE).normalize()
      const tilt = Math.min(lean.angleTo(UP), MAX_LEAN)
      axis.crossVectors(UP, lean)
      const rotation = new THREE.Quaternion()
      if (axis.lengthSq() > 1e-8) rotation.setFromAxisAngle(axis.normalize(), tilt)
      rotation.multiply(new THREE.Quaternion().setFromAxisAngle(UP, rand() * Math.PI * 2))
      for (const shrink of SHRINKS) {
        const scale = diameter * shrink / (2 * shape.radius)
        const height = (shape.height - shape.ground) * scale
        const reach = shape.radius * scale
        const base = new THREE.Vector3(x, ledge.y, z)
        if (base.y + height > landscape.maxTop) continue
        if (placed.some(other => Math.abs(other.base.y - base.y) < Math.max(other.height, height)
          && Math.hypot(other.base.x - base.x, other.base.z - base.z) < (other.reach + reach) * SPACING)) continue
        // The model's ground line on the ledge: its stalk below that is in the rock.
        const position = new THREE.Vector3(0, -shape.ground * scale, 0).applyQuaternion(rotation).add(base)
        const matrix = new THREE.Matrix4().compose(position, rotation, new THREE.Vector3(scale, scale, scale))
        if (!fits(shape, matrix)) continue
        return {
          model,
          matrix,
          site,
          base,
          reach,
          height,
          centre: new THREE.Vector3(base.x, base.y + height / 2, base.z),
          top: base.y + height,
          // The colony as an obstacle box: its head, a little inside its full spread.
          obstacle: { x: base.x, z: base.z, y: base.y, height, width: reach * 1.8, depth: reach * 1.8, yaw: 0 },
        }
      }
      return null
    }
    const count = Math.round(pick(config.perCluster))
    let kept = 0
    for (let attempt = 0; attempt < count * ATTEMPTS_PER_COLONY && kept < count; attempt++) {
      if (attempt % YIELD_EVERY === YIELD_EVERY - 1) yield
      // Most often on the side facing the camera, anywhere from the top to the upper shoulders.
      const angle = facing + (rand() * 2 - 1) * (rand() < 0.7 ? 1.2 : Math.PI)
      const out = Math.sqrt(rand()) * 0.85
      const x = centre.x + Math.cos(angle) * out * size.x / 2
      const z = centre.z + Math.sin(angle) * out * size.z / 2
      const ledge = ledgeAt(x, z)
      if (!ledge) continue
      const first = colonyAt(x, z, ledge)
      if (!first) continue
      placed.push(first)
      kept++
      // The rest of its group, close by.
      const roll = rand()
      const groupSize = roll < GROUP_WEIGHTS[0] ? 1 : roll < GROUP_WEIGHTS[0] + GROUP_WEIGHTS[1] ? 2 : 3
      for (let member = 1, tries = 0; member < groupSize && kept < count && tries < groupSize * 12; tries++) {
        const a = rand() * Math.PI * 2
        const r = first.reach * 1.2 + rand() * GROUP_RADIUS
        const mx = first.base.x + Math.cos(a) * r
        const mz = first.base.z + Math.sin(a) * r
        const near = ledgeAt(mx, mz)
        if (!near) continue
        const colony = colonyAt(mx, mz, near)
        if (!colony) continue
        placed.push(colony)
        kept++
        member++
      }
    }
  }
  return placed
}
