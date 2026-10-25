import * as THREE from 'three'
import { MeshBVH } from 'three-mesh-bvh'
import { sandHeight, seededRandom } from '../data/landscapes'
import { boundsOf, rockCaster } from './coralPlacement'
import { inPlate } from './staghornPlacement'

// Giant sea fans (a landscape's `seaFans`, landscapes.js), placed once the table corals are
// (coralPlacement.js), on the same bommies: Jeremy wants every coral form on the same rocks as
// one cluster (2026-10-20), not each form on rocks of its own. They go in before the staghorn,
// which then keeps clear of them (staghornPlacement.js, inFan): the staghorn crowds a bommie's
// tops and feet with 40-odd colonies, and placed after it a fan found room on almost none.
//
// A sea fan grows upright from a holdfast on rock (or sand by the rock) on reef slopes swept by
// strong tidal currents (SeaLifeBase, after Goh & Chou 1996), its flat lattice broadside to the
// current so the polyps sieve the most water. So each fan here stands on a ledge or gentle slope
// of the bommie, or the sand at its foot, upright with a slight lean, its face turned within
// `facingJitter` of the landscape's current. A fan is kept only if its lattice stays out of the
// rock (a few points may touch), the sand and every table's plate, stays under water, stands
// clear of the bommie's other fans, and can be seen from the resting camera: at least
// `minVisible` of nine points spread over its face in frame and not behind any rock. Without
// that, Jeremy's first fans (2026-10-26) mostly stood behind their bommies or the foreground
// rocks, and a phone's resting view saw almost none.

const DOWN = new THREE.Vector3(0, -1, 0)
const UP = new THREE.Vector3(0, 1, 0)
const ATTEMPTS_PER_FAN = 120
// Largest lean off upright, about 7°.
const MAX_LEAN = 0.12
// Points of the fan tested against the rock and sand, and how many may touch the rock or dip
// into the sand (a holdfast on a slope has its lowest branches near the rock).
const SAMPLE_COUNT = 40
const INSIDE_ALLOWED = 2
const SAND_ALLOWED = 2
// Ledges this steep or gentler (a face pointing at least this much up) take a holdfast.
const MIN_LEDGE_UP = 0.35
// A fan on the sand stands this many WU out from where a level ray met its rock's foot.
const SAND_REACH = [0.3, 2]
// Least distance between two fans' holdfasts, in shares of their summed half widths.
const SPACING = 1.1
// The holdfast sinks this share of the fan's height into the rock or sand.
const SINK = 0.02
// Water kept either side of a fan's lattice by other corals (inFan), in WU, on top of its sway.
const FAN_CLEAR = 0.4
const YIELD_EVERY = 20
// Points on a fan's face tested for sight from the resting camera, as shares of its width
// (across its middle) and height.
const SIGHT_POINTS = [-0.3, 0, 0.3].flatMap(x => [0.3, 0.55, 0.8].map(y => [x, y]))
// The resting camera's frame, half-angles' tangents: 42° tall, 16:9 wide (REEFS_VIEW).
const FRAME_TAN_Y = Math.tan(THREE.MathUtils.degToRad(21))
const FRAME_TAN_X = FRAME_TAN_Y * 16 / 9

// How many of a fan's SIGHT_POINTS the resting camera sees: in frame and with no rock between.
function pointsSeen(fan, matrix, sight, scratch) {
  if (!sight) return SIGHT_POINTS.length
  const { eye, forward, right, up, rocks } = sight
  let seen = 0
  for (const [x, y] of SIGHT_POINTS) {
    scratch.set((fan.minX + fan.maxX) / 2 + x * fan.width, y * fan.height, 0).applyMatrix4(matrix).sub(eye)
    const depth = scratch.dot(forward)
    if (depth <= 0 || Math.abs(scratch.dot(right)) > depth * FRAME_TAN_X || Math.abs(scratch.dot(up)) > depth * FRAME_TAN_Y) continue
    const distance = scratch.length()
    if (!rocks.nearest(eye, scratch.normalize(), distance - 0.3)) seen++
  }
  return seen
}

// Fan facts of a kit model (model metres, holdfast at the origin, lattice in the XY plane):
// height, the farthest point from the holdfast (its rim), the lattice's extent along x, and
// points spread over it, the rim's weighing most.
export function measureFan(geometries) {
  let height = 0
  let reach = 0
  let minX = Infinity
  let maxX = -Infinity
  const points = []
  for (const geometry of geometries) {
    const position = geometry.attributes.position
    for (let i = 0; i < position.count; i++) {
      const x = position.getX(i)
      const y = position.getY(i)
      const z = position.getZ(i)
      height = Math.max(height, y)
      reach = Math.max(reach, Math.hypot(x, y, z))
      minX = Math.min(minX, x)
      maxX = Math.max(maxX, x)
      points.push(new THREE.Vector3(x, y, z))
    }
  }
  // Farthest from the holdfast first; half the samples from the outer fifth, half over the rest.
  points.sort((a, b) => b.length() - a.length())
  const samples = []
  for (let k = 0; k < SAMPLE_COUNT; k++) {
    const i = k < SAMPLE_COUNT / 2
      ? Math.floor(k * points.length / (SAMPLE_COUNT * 2.5))
      : Math.floor((k - SAMPLE_COUNT / 2) * points.length / (SAMPLE_COUNT / 2))
    samples.push(points[i])
  }
  return { height, reach, minX, maxX, width: maxX - minX, samples }
}

// Whether a point is in a placed fan's lattice, or within FAN_CLEAR of it plus its sway, for the
// corals placed after the fans (staghornPlacement.js).
const local = new THREE.Vector3()
export function inFan(fans, point) {
  for (const fan of fans) {
    if (Math.abs(point.x - fan.base.x) > fan.reach + fan.clear || Math.abs(point.z - fan.base.z) > fan.reach + fan.clear) continue
    local.copy(point).applyMatrix4(fan.inverse)
    const margin = fan.clear / fan.scale
    if (Math.abs(local.z) < margin && local.y > -margin && local.y < fan.shape.height + margin
      && local.x > fan.shape.minX - margin && local.x < fan.shape.maxX + margin) return true
  }
  return false
}

// Placed sea fans: [{ model, matrix, site, base, height, reach, width, normal, phase, obstacle, ... }],
// with `site` the index of the cluster it grows in, `normal` its face (the way it swings),
// `phase` its sway's phase and `obstacle` a piece box for rockObstacles.js. A generator, like
// placeCorals: it yields every few candidate spots and returns the fans when done.
// clusters are coralClusters'; tables the placed tables; measures are measureFan per kit model;
// view is the resting camera; sightRocks every drawn rock (the landscape's merged chunks), for
// the sight test.
export function* placeSeaFans(landscape, clusters, tables, measures, view, sightRocks = null) {
  const config = landscape.seaFans
  const plates = tables.map(table => table.plate)
  let sight = null
  if (view && sightRocks?.length) {
    // A BVH tree per chunk, one a slice (each takes a few ms), kept on the chunk for the session.
    for (const geometry of sightRocks) {
      if (geometry.boundsTree) continue
      geometry.boundsTree = new MeshBVH(geometry)
      yield
    }
    const eye = new THREE.Vector3(view.x ?? 0, view.y ?? 0, view.z ?? 0)
    const forward = new THREE.Vector3(view.lookX ?? eye.x, view.lookY ?? eye.y, view.lookZ ?? 0).sub(eye).normalize()
    const right = new THREE.Vector3().crossVectors(forward, UP).normalize()
    sight = { eye, forward, right, up: new THREE.Vector3().crossVectors(right, forward), rocks: rockCaster(sightRocks) }
  }
  const current = new THREE.Vector3(config.current[0], 0, config.current[1]).normalize()
  const placed = []
  const origin = new THREE.Vector3()
  const point = new THREE.Vector3()
  const inward = new THREE.Vector3()
  for (const [site, cluster] of clusters.entries()) {
    const rocks = rockCaster(cluster.geometries)
    const bounds = boundsOf(cluster.geometries)
    const centre = bounds.getCenter(new THREE.Vector3())
    const size = bounds.getSize(new THREE.Vector3())
    const rand = seededRandom(config.seed * 7919 + cluster.seed)
    const pick = ([min, max]) => min + rand() * (max - min)
    const facing = view ? Math.atan2(view.z - centre.z, view.x - centre.x) : Math.PI / 2
    const count = Math.round(pick(config.perCluster))
    let kept = 0
    for (let attempt = 0; attempt < count * ATTEMPTS_PER_FAN && kept < count; attempt++) {
      if (attempt % YIELD_EVERY === YIELD_EVERY - 1) yield
      // All round the bommie, a little more often on the side facing the camera.
      const angle = facing + (rand() * 2 - 1) * (rand() < 0.5 ? 1.6 : Math.PI)
      let baseY
      if (rand() < config.footShare) {
        // At the foot: a level ray in from outside finds the rock, and the holdfast goes on the
        // sand a little out from where it met it, not under an overhang.
        const out = Math.max(size.x, size.z)
        origin.set(centre.x + Math.cos(angle) * out, 0, centre.z + Math.sin(angle) * out)
        origin.y = sandHeight(landscape, origin.x, origin.z) + 0.6
        inward.set(centre.x - origin.x, 0, centre.z - origin.z).normalize()
        const foot = rocks.nearest(origin, inward, out * 1.5)
        if (!foot) continue
        origin.copy(foot.point).addScaledVector(inward, -pick(SAND_REACH))
        baseY = sandHeight(landscape, origin.x, origin.z)
        if (rocks.nearest(point.set(origin.x, baseY + 0.3, origin.z), UP, 30)) continue
      } else {
        // On a ledge or gentle slope of the bommie's top and shoulders.
        const edge = 0.3 + rand() * 0.65
        origin.set(centre.x + Math.cos(angle) * edge * size.x / 2, bounds.max.y + 2, centre.z + Math.sin(angle) * edge * size.z / 2)
        const sandY = sandHeight(landscape, origin.x, origin.z)
        const hit = rocks.nearest(origin, DOWN, bounds.max.y + 2 - sandY + 1)
        if (!hit || hit.point.y <= sandY || hit.normal.y < MIN_LEDGE_UP) continue
        baseY = hit.point.y
      }
      // The biggest fans low, on the sand and the lower ledges; small ones higher up.
      const low = THREE.MathUtils.clamp((bounds.max.y - baseY) / Math.max(size.y, 1), 0, 1)
      const height = THREE.MathUtils.lerp(config.height[0], config.height[1], THREE.MathUtils.clamp(low * 0.7 + rand() * 0.5, 0, 1))
      const model = Math.floor(rand() * measures.length)
      const shape = measures[model]
      const scale = height / shape.height
      // Face turned within facingJitter of the current; the lattice is two-sided, so either way.
      const turn = (rand() * 2 - 1) * config.facingJitter
      const normal = current.clone().applyAxisAngle(UP, turn)
      const yaw = Math.atan2(normal.x, normal.z)
      const rotation = new THREE.Quaternion().setFromEuler(new THREE.Euler((rand() * 2 - 1) * MAX_LEAN, yaw, (rand() * 2 - 1) * MAX_LEAN * 0.5, 'YXZ'))
      const base = new THREE.Vector3(origin.x, baseY - height * SINK, origin.z)
      if (base.y + height > landscape.maxTop) continue
      const halfWidth = shape.width * scale / 2
      if (placed.some(other => other.site === site
        && Math.hypot(other.base.x - base.x, other.base.z - base.z) < (other.width / 2 + halfWidth) * SPACING)) continue
      const matrix = new THREE.Matrix4().compose(base, rotation, new THREE.Vector3(scale, scale, scale))
      let inside = 0
      let sand = 0
      let clash = false
      for (const sample of shape.samples) {
        point.copy(sample).applyMatrix4(matrix)
        if (inPlate(plates, point) || (point.y < sandHeight(landscape, point.x, point.z) && ++sand > SAND_ALLOWED)) {
          clash = true
          break
        }
        if (rocks.inside(point) && ++inside > INSIDE_ALLOWED) break
      }
      if (clash || inside > INSIDE_ALLOWED) continue
      if (pointsSeen(shape, matrix, sight, point) < config.minVisible) continue
      // The lattice's middle along its width, for the obstacle box.
      const middle = new THREE.Vector3((shape.minX + shape.maxX) / 2, 0, 0).applyMatrix4(matrix)
      placed.push({
        model,
        matrix,
        inverse: matrix.clone().invert(),
        scale,
        shape,
        site,
        base,
        height,
        reach: shape.reach * scale,
        width: shape.width * scale,
        normal,
        // Along the current, so the surge passes through the reef as a wave, plus a little jitter.
        phase: base.dot(current) * 0.35 + rand() * 0.8,
        // Water other corals keep from the lattice: FAN_CLEAR and the rim's swing.
        clear: FAN_CLEAR + config.sway.bend * height,
        // The fan as an obstacle box: the lattice's width and height, thin across it.
        obstacle: { x: middle.x, z: middle.z, y: base.y, height, width: shape.width * scale * 0.9, depth: 0.6, yaw },
      })
      kept++
    }
  }
  return placed
}
