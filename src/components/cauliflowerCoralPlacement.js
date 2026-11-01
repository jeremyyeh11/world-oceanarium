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
//
// The tops are mostly under the table plates, so from the resting camera hardly any colony showed
// (1 of 13 in frame). Jeremy (2026-11-01): put some on the front as well, if not add more. A pass
// that tried spots on each bommie's camera side and kept those the camera saw (`dev_4`) still
// showed none on his screen. So the front colonies now start from the camera: rays through the
// lower part of the resting frame, and a colony on the first rock ledge a ray meets (any drawn
// rock, FRONT_RANGE away), which is in view by construction; it is still kept only if the camera
// sees most of its head (SIGHT_POINTS: no rock or table plate between).

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
const SPACING = 1
// Candidate rays a front colony gets; the part of the resting frame they go through (share of the
// half width; lowest and highest share of the half height, so mostly the lower part, where the
// rock is); and how near and far from the camera a front colony stands, in WU.
const FRONT_ATTEMPTS = 120
const FRONT_FRAME = [0.92, -0.92, 0.4]
const FRONT_RANGE = [6, 60]
// Points on a front colony's head tested for sight from the resting camera (shares of its reach
// across the view and of its height up), and how many must be seen.
const SIGHT_POINTS = [[-0.5, 0.5], [0, 0.85], [0.5, 0.5]]
const MIN_SEEN = 2
// The resting camera's half frame (fov 42, 16:9), a little inside its edges.
const FRAME_TAN_Y = Math.tan(THREE.MathUtils.degToRad(19))
const FRAME_TAN_X = FRAME_TAN_Y * 16 / 9
// How far from a colony a table plate between it and the camera is looked for, in WU, and the step.
const PLATE_LOOK = 14
const PLATE_STEP = 0.5
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
// with `site` the index of the cluster it grows in (a front colony off every cluster has its own,
// from clusters.length up), `base` its foot at the ground line, `centre` the middle of its head and
// `obstacle` a piece box for rockObstacles.js. A generator, like placeCorals: it yields every few
// candidate spots and returns the colonies when done. clusters are coralClusters' (the bommies the
// tables crown); tables the placed tables; measures are measureBush per kit model; view is the
// resting camera. `avoid(point, extra)`, if given, says whether a point (with `extra` WU round it)
// is taken by a coral placed before the cauliflower corals other than the tables (the sea fans and
// the brain corals). sightRocks, if given with a view, are every drawn rock (the landscape's merged
// chunks), for the front colonies; without them there are none.
export function* placeCauliflowerCorals(landscape, clusters, tables, measures, view, avoid = null, sightRocks = null) {
  const config = landscape.cauliflowerCorals
  const plates = tables.map(table => table.plate)
  const tableFeet = tables.map(table => ({ plate: table.plate, foot: new THREE.Vector3().setFromMatrixPosition(table.matrix) }))
  const placed = []
  const origin = new THREE.Vector3()
  const point = new THREE.Vector3()
  const lean = new THREE.Vector3()
  const axis = new THREE.Vector3()
  const toEye = new THREE.Vector3()
  let sight = null
  if (view && sightRocks?.length && config.front) {
    const eye = new THREE.Vector3(view.x ?? 0, view.y ?? 0, view.z ?? 0)
    const forward = new THREE.Vector3(view.lookX ?? eye.x, view.lookY ?? eye.y, view.lookZ ?? 0).sub(eye).normalize()
    const right = new THREE.Vector3().crossVectors(forward, UP).normalize()
    sight = { eye, forward, right, up: new THREE.Vector3().crossVectors(right, forward), rocks: rockCaster(sightRocks) }
  }
  // Whether `target` is in the resting camera's frame.
  const inFrame = target => {
    toEye.copy(target).sub(sight.eye)
    const depth = toEye.dot(sight.forward)
    return depth > 0 && Math.abs(toEye.dot(sight.right)) <= depth * FRAME_TAN_X && Math.abs(toEye.dot(sight.up)) <= depth * FRAME_TAN_Y
  }
  // How many of a colony's SIGHT_POINTS the resting camera sees: in frame, no rock between, and no
  // table plate within PLATE_LOOK of the colony on the way.
  const seen = colony => {
    let count = 0
    for (const [across, up] of SIGHT_POINTS) {
      point.copy(colony.base).addScaledVector(sight.right, across * colony.reach)
      point.y += up * colony.height
      if (!inFrame(point)) continue
      toEye.copy(sight.eye).sub(point)
      const distance = toEye.length()
      toEye.divideScalar(distance)
      if (sight.rocks.nearest(point, toEye, distance - 0.3)) continue
      let blocked = false
      for (let d = PLATE_STEP; d < Math.min(PLATE_LOOK, distance) && !blocked; d += PLATE_STEP) {
        blocked = inTable(tableFeet, plates, origin.copy(point).addScaledVector(toEye, d))
      }
      if (!blocked) count++
    }
    return count
  }
  // Whether a colony placed by `matrix` (the ground line at `ground`) on `rocks` is clear: its head
  // out of the tables, the corals placed before it, the other bushes, the sand and (bar a few
  // points) the rock; and its foot held up all round, rock just under most of its rim.
  const fits = (rocks, shape, matrix) => {
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
  // The spot's biggest colony that fits on `rocks` at (x, z) on `ledge`, or null.
  const colonyAt = (rocks, rand, site, x, z, ledge) => {
    const model = Math.floor(rand() * measures.length)
    const shape = measures[model]
    const diameter = config.diameter[0] + rand() * (config.diameter[1] - config.diameter[0])
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
      if (!fits(rocks, shape, matrix)) continue
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
  const clusterBounds = clusters.map(cluster => boundsOf(cluster.geometries))
  for (const [site, cluster] of clusters.entries()) {
    const rocks = rockCaster(cluster.geometries)
    const bounds = clusterBounds[site]
    const centre = bounds.getCenter(new THREE.Vector3())
    const size = bounds.getSize(new THREE.Vector3())
    const floor = bounds.min.y + size.y * UPPER_SHARE
    const rand = seededRandom(config.seed * 7919 + cluster.seed)
    const facing = view ? Math.atan2(view.z - centre.z, view.x - centre.x) : Math.PI / 2
    // A ledge in the upper part of the bommie straight under (x, z), or null.
    const ledgeAt = (x, z) => {
      origin.set(x, bounds.max.y + 2, z)
      const hit = rocks.nearest(origin, DOWN, bounds.max.y + 2 - floor)
      if (!hit || hit.point.y < floor || hit.normal.y < MIN_LEDGE_UP) return null
      return { y: hit.point.y, normal: hit.normal.clone().normalize() }
    }
    const count = Math.round(config.perCluster[0] + rand() * (config.perCluster[1] - config.perCluster[0]))
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
      const first = colonyAt(rocks, rand, site, x, z, ledge)
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
        const colony = colonyAt(rocks, rand, site, mx, mz, near)
        if (!colony) continue
        placed.push(colony)
        kept++
        member++
      }
    }
  }
  if (!sight) return placed
  // Then the front: `front` colonies on the first ledges the resting camera's rays meet.
  const rand = seededRandom(config.seed * 31 + 3)
  const front = Math.round(config.front[0] + rand() * (config.front[1] - config.front[0]))
  const direction = new THREE.Vector3()
  for (let attempt = 0, shown = 0; attempt < front * FRONT_ATTEMPTS && shown < front; attempt++) {
    if (attempt % YIELD_EVERY === YIELD_EVERY - 1) yield
    const across = (rand() * 2 - 1) * FRONT_FRAME[0]
    const up = FRONT_FRAME[1] + rand() * (FRONT_FRAME[2] - FRONT_FRAME[1])
    direction.copy(sight.forward).addScaledVector(sight.right, across * FRAME_TAN_X).addScaledVector(sight.up, up * FRAME_TAN_Y).normalize()
    const hit = sight.rocks.nearest(sight.eye, direction, FRONT_RANGE[1])
    if (!hit || hit.distance < FRONT_RANGE[0] || hit.normal.y < MIN_LEDGE_UP || hit.normal.dot(direction) > 0) continue
    // One thicket with the bommie it stands on, for the reef fish, or one of its own.
    let site = clusters.length + shown
    for (const [i, bounds] of clusterBounds.entries()) if (bounds.distanceToPoint(hit.point) < 1) site = i
    const ledge = { y: hit.point.y, normal: hit.normal.clone().normalize() }
    const colony = colonyAt(sight.rocks, rand, site, hit.point.x, hit.point.z, ledge)
    if (!colony || seen(colony) < MIN_SEEN) continue
    placed.push(colony)
    shown++
  }
  return placed
}
