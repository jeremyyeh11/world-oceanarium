import * as THREE from 'three'
import { sandHeight, seededRandom } from '../data/landscapes'
import { boundsOf, rockCaster } from './coralPlacement'
import { inTable } from './seaFanPlacement'

// Brain corals (Platygyra daedalea; a landscape's `brainCorals`, landscapes.js), placed once the
// table corals (coralPlacement.js) and the sea fans (seaFanPlacement.js) are, against the rocks
// as drawn, on the same bommies: Jeremy wants every coral form on the same rocks as one cluster
// (2026-10-20). They go in before the staghorn, which keeps clear of them (staghornPlacement.js
// `avoid`, inMound): a boulder needs a broad, level patch of rock, which the staghorn's 40-odd
// colonies a bommie would otherwise take.
//
// A brain coral is a massive colony: a solid dome or boulder, commonly a metre or more across
// (SeaLifeBase), the understory coral of Acropora patch reefs (SeaLifeBase, Ref. 102838). So each
// colony here sits on a ledge (a face pointing mostly up) on its bommie's top and shoulders, or on
// the sand at its foot, the bigger ones at the foot, the side facing the resting camera most
// often. It leans a little with the face it sits on, its base sunk a few centimetres. It is kept
// only if its base is held up all round (rock or sand under most of its rim: no boulder hangs off
// a ledge's edge), its dome stays out of the rock and sand (a little contact reads as grown onto
// it), out of every table (plate and stalk), the sea fans and the other brain corals, and under
// water. A spot that clashes tries the colony smaller (SHRINKS) before giving up: the tables
// crown the bommies' tops and spread over their feet, and at full size only 6 colonies found room
// on The Reefs (a stand-in kit, 2026-10-29); with the smaller sizes, 23 to 26.

const UP = new THREE.Vector3(0, 1, 0)
const DOWN = new THREE.Vector3(0, -1, 0)
const ATTEMPTS_PER_COLONY = 100
// Least share of up in a ledge a colony may sit on (about 50° from level at most).
const MIN_LEDGE_UP = 0.65
// How far a colony leans with its ledge (share of the ledge's tilt), and its largest lean (17°).
const LEAN_SHARE = 0.5
const MAX_LEAN = 0.3
// The base sinks this share of the colony's height into the rock or sand.
const SINK = 0.06
// Points on the dome tested against the rock, sand, tables, fans and other colonies, and how many
// may touch the rock or the sand. Points below BASE_SHARE of its height are its base.
const SAMPLE_COUNT = 32
const BASE_SHARE = 0.15
const INSIDE_ALLOWED = 3
const SAND_ALLOWED = 3
// Points round the rim of the base, and how many must have rock or sand just under them.
const RIM_POINTS = 8
const RIM_SUPPORTED = 6
// How far under the rim support is looked for, in WU (5 cm).
const RIM_DEPTH = 0.2
// A colony on the sand stands within this many WU (1 m) of its rock's foot.
const SAND_REACH = 4
// The sizes a spot tries, as shares of the colony drawn for it, biggest first.
const SHRINKS = [1, 0.75, 0.55]
// Least distance between two colonies' bases, in shares of their summed radii.
const SPACING = 0.95
// Water kept round a colony by the corals placed after it (inMound), in WU (5 cm).
const MOUND_CLEAR = 0.2
const YIELD_EVERY = 20

// Colony facts of a kit model from its _lo mesh (model metres, base at the origin, the
// object origin in the source model): height, horizontal reach about the base, the base's own
// radius, and points spread over the dome above its base.
export function measureMound(geometry) {
  geometry.computeBoundingBox()
  const height = geometry.boundingBox.max.y
  const position = geometry.attributes.position
  let radius = 0
  let footRadius = 0
  const above = []
  for (let i = 0; i < position.count; i++) {
    const y = position.getY(i)
    const r = Math.hypot(position.getX(i), position.getZ(i))
    radius = Math.max(radius, r)
    if (y < height * 0.1) footRadius = Math.max(footRadius, r)
    if (y > height * BASE_SHARE) above.push(i)
  }
  const samples = []
  for (let k = 0; k < SAMPLE_COUNT && above.length; k++) samples.push(new THREE.Vector3().fromBufferAttribute(position, above[Math.floor(k * above.length / SAMPLE_COUNT)]))
  return { height, radius, footRadius: footRadius || radius * 0.8, samples }
}

// Whether a point is in a placed colony's dome, or within MOUND_CLEAR plus `extra` WU of it, for
// the corals placed after the brain corals (staghornPlacement.js). The dome is taken as the half
// ellipsoid over its base, upright (a colony leans at most MAX_LEAN).
export function inMound(mounds, point, extra = 0) {
  for (const mound of mounds) {
    const margin = MOUND_CLEAR + extra
    const dy = point.y - mound.base.y
    if (dy < -margin || dy > mound.height + margin) continue
    const across = Math.hypot(point.x - mound.base.x, point.z - mound.base.z) / (mound.reach + margin)
    const up = Math.max(dy, 0) / (mound.height + margin)
    if (across * across + up * up < 1) return true
  }
  return false
}

// Placed brain corals: [{ model, matrix, site, base, reach, height, centre, top, obstacle }], with
// `site` the index of the cluster it grows in, `centre` the middle of its base and `obstacle` a
// piece box for rockObstacles.js. A generator, like placeCorals: it yields every few candidate
// spots and returns the colonies when done. clusters are coralClusters' (the bommies the tables
// crown); tables the placed tables; measures are measureMound per kit model; view is the resting
// camera. `avoid(point, extra)`, if given, says whether a point (with `extra` WU round it) is
// taken by a coral placed before the brain corals other than the tables (the sea fans, inFan).
export function* placeBrainCorals(landscape, clusters, tables, measures, view, avoid = null) {
  const config = landscape.brainCorals
  const plates = tables.map(table => table.plate)
  const tableFeet = tables.map(table => ({ plate: table.plate, foot: new THREE.Vector3().setFromMatrixPosition(table.matrix) }))
  const placed = []
  const origin = new THREE.Vector3()
  const point = new THREE.Vector3()
  const inward = new THREE.Vector3()
  const lean = new THREE.Vector3()
  const axis = new THREE.Vector3()
  for (const [site, cluster] of clusters.entries()) {
    const rocks = rockCaster(cluster.geometries)
    const bounds = boundsOf(cluster.geometries)
    const centre = bounds.getCenter(new THREE.Vector3())
    const size = bounds.getSize(new THREE.Vector3())
    const rand = seededRandom(config.seed * 7919 + cluster.seed)
    const pick = ([min, max]) => min + rand() * (max - min)
    const facing = view ? Math.atan2(view.z - centre.z, view.x - centre.x) : Math.PI / 2
    // Whether a colony placed by `matrix` is clear: its dome out of the tables, the corals placed
    // before it, the other colonies, and (bar a few points) the rock and sand; and its base held
    // up all round, rock or sand just under most of its rim.
    const fits = (shape, matrix) => {
      let inside = 0
      let sand = 0
      for (const sample of shape.samples) {
        point.copy(sample).applyMatrix4(matrix)
        if (inTable(tableFeet, plates, point) || avoid?.(point) || inMound(placed, point)) return false
        if (point.y < sandHeight(landscape, point.x, point.z) && ++sand > SAND_ALLOWED) return false
        if (rocks.inside(point) && ++inside > INSIDE_ALLOWED) return false
      }
      let supported = 0
      for (let k = 0; k < RIM_POINTS; k++) {
        const a = k * Math.PI * 2 / RIM_POINTS
        point.set(Math.cos(a) * shape.footRadius * 0.85, 0, Math.sin(a) * shape.footRadius * 0.85).applyMatrix4(matrix)
        point.y -= RIM_DEPTH
        if (point.y < sandHeight(landscape, point.x, point.z) || rocks.inside(point)) supported++
      }
      return supported >= RIM_SUPPORTED
    }
    const count = Math.round(pick(config.perCluster))
    let kept = 0
    for (let attempt = 0; attempt < count * ATTEMPTS_PER_COLONY && kept < count; attempt++) {
      if (attempt % YIELD_EVERY === YIELD_EVERY - 1) yield
      // Most often on the side facing the camera; footShare of them at the rock's foot.
      const angle = facing + (rand() * 2 - 1) * (rand() < 0.7 ? 1.2 : Math.PI)
      const atFoot = rand() < config.footShare
      const reach = atFoot ? 0.85 + rand() * 0.4 : rand() * 0.8
      origin.set(centre.x + Math.cos(angle) * reach * size.x / 2, bounds.max.y + 2, centre.z + Math.sin(angle) * reach * size.z / 2)
      const sandY = sandHeight(landscape, origin.x, origin.z)
      const hit = rocks.nearest(origin, DOWN, bounds.max.y + 2 - sandY + 1)
      let y
      let normal = UP
      if (hit && hit.point.y > sandY) {
        if (hit.normal.y < MIN_LEDGE_UP) continue
        y = hit.point.y
        normal = hit.normal.normalize()
      } else {
        // On the sand only right at the rock's foot.
        inward.set(centre.x - origin.x, 0, centre.z - origin.z).normalize()
        if (!rocks.nearest(point.set(origin.x, sandY + 0.5, origin.z), inward, SAND_REACH)) continue
        y = sandY
      }
      const model = Math.floor(rand() * measures.length)
      const shape = measures[model]
      // The big boulders at the foot, smaller ones up on the ledges.
      const diameter = pick(config.diameter) * (atFoot ? 1 : config.ledgeScale)
      // Leaning with the ledge, a share of its tilt, within MAX_LEAN.
      lean.copy(UP).lerp(normal, LEAN_SHARE).normalize()
      const tilt = Math.min(lean.angleTo(UP), MAX_LEAN)
      axis.crossVectors(UP, lean)
      const rotation = new THREE.Quaternion()
      if (axis.lengthSq() > 1e-8) rotation.setFromAxisAngle(axis.normalize(), tilt)
      rotation.multiply(new THREE.Quaternion().setFromAxisAngle(UP, rand() * Math.PI * 2))
      // The spot's biggest colony that fits: a smaller one often fits under a table's plate or
      // between its stalks where a big one does not (it is the understory of Acropora reefs).
      let fit = null
      for (const shrink of SHRINKS) {
        const scale = diameter * shrink / (2 * shape.radius)
        const height = shape.height * scale
        const colonyReach = shape.radius * scale
        const base = new THREE.Vector3(origin.x, y - height * SINK, origin.z)
        if (base.y + height > landscape.maxTop) continue
        if (placed.some(other => Math.abs(other.base.y - base.y) < Math.max(other.height, height)
          && Math.hypot(other.base.x - base.x, other.base.z - base.z) < (other.reach + colonyReach) * SPACING)) continue
        const matrix = new THREE.Matrix4().compose(base, rotation, new THREE.Vector3(scale, scale, scale))
        if (fits(shape, matrix)) {
          fit = { matrix, base, height, colonyReach }
          break
        }
      }
      if (!fit) continue
      const { matrix, base, height, colonyReach } = fit
      placed.push({
        model,
        matrix,
        site,
        base,
        reach: colonyReach,
        height,
        centre: new THREE.Vector3(base.x, base.y + height / 2, base.z),
        top: base.y + height,
        // The colony as an obstacle box: its dome, a little inside its full spread.
        obstacle: { x: base.x, z: base.z, y: base.y, height, width: colonyReach * 1.8, depth: colonyReach * 1.8, yaw: 0 },
      })
      kept++
    }
  }
  return placed
}
