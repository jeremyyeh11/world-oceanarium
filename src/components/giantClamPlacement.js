import * as THREE from 'three'
import { sandHeight, seededRandom } from '../data/landscapes'
import { boundsOf, rockCaster } from './coralPlacement'
import { inTable } from './seaFanPlacement'

// Giant clams (Tridacna gigas; a landscape's `giantClams`, landscapes.js), placed once the tables,
// sea fans, brain, cauliflower and leather corals are, and before the staghorn, which keeps clear of
// them (staghornPlacement.js `avoid`, inClam). Not a coral: a clam lies free on the sand, and never
// moves once grown (IUCN: free-living on sand or hard reef in clear water). Jeremy (2026-11-01):
// four clams of 60 cm to 1.2 m, on the open sand at the bommies' feet in the front half of the
// basin, one near the middle of a 375 px phone's view; static.
//
// So each clam lies on the sand just off a bommie's foot (within SAND_REACH of its rock, but not
// against it), no two on one bommie and at least `spacing` WU apart: wild clams are scattered and
// now rare (most surviving groups under ten). Only the bommies whose middle is in front of `zMin`
// take one. The first is placed where the resting camera sees it, by any rock (Jeremy,
// 2026-11-02: the sand at the coral bommies' feet is hidden from that camera): within `phoneWidth`
// of the middle of its frame across, failing that anywhere in the desktop frame (`viewWidth`),
// with no rock or coral between the camera and its gape, a line the corals placed after it keep
// clear too (`sight`, inClam). A clam lies level on the sand, leant
// with it a little, its underside sunk a few centimetres, turned so its fluted side (the shell's
// length, the model's X) is mostly broadside to the resting camera. It is kept only if its underside
// rests on the sand all round (none of it floats over a dip), and its shell and mantle stay out of
// the rock (bar a few points in rubble), the tables, the corals placed before it and the other
// clams, and under water. A spot that clashes tries the clam smaller (SHRINKS) before giving up.

const UP = new THREE.Vector3(0, 1, 0)
const ATTEMPTS_PER_CLAM = 160
// How far a clam leans with the sand (share of its slope), and its largest lean (6°).
const LEAN_SHARE = 0.6
const MAX_LEAN = 0.1
// The underside sinks this share of the clam's height into the sand.
const SINK = 0.03
// Points spread over the clam above its underside, tested against the rock, sand, tables, the
// corals placed before it and the other clams; how many may touch the rock (rubble) or the sand.
// Points below BASE_SHARE of its height are its underside.
const SAMPLE_COUNT = 48
const BASE_SHARE = 0.12
const INSIDE_ALLOWED = 3
const SAND_ALLOWED = 2
// Points round the underside's outline, and how far over the sand any of them may be, in WU (3 cm).
const RIM_POINTS = 10
const RIM_FLOAT = 0.12
// A clam lies within this many WU of its rock's foot (2.5 m), and at least NEAR WU (25 cm) off it.
const SAND_REACH = 10
const NEAR = 1
// How far the clam's long side may turn from broadside to the camera, in radians (about 40°).
const FACING_JITTER = 0.7
// The sizes a spot tries, as shares of the clam drawn for it, biggest first.
const SHRINKS = [1, 0.85, 0.7]
// Water kept round a clam by the corals placed after it (inClam), in WU (5 cm).
const CLAM_CLEAR = 0.2
// The clam in view keeps its line of sight to the resting camera open all the way, this many WU
// round (40 cm), tested every SIGHT_STEP WU: nothing placed before it may stand there, and the
// corals placed after it keep out (inClam), so no table or staghorn thicket grows in front of it.
const SIGHT_RADIUS = 1.6
const SIGHT_STEP = 0.75
// The rock test along that line starts this many WU (75 cm) out from the gape: the rubble chunks
// beside a clam (10 to 30 cm) would otherwise block every line, and cannot hide a clam this size.
const SIGHT_SKIP = 3
// How low and how high in the frame the phone-view clam's middle may sit, as shares of half the
// frame's height below and above its centre.
const FRAME_LOW = 0.75
const FRAME_HIGH = 0.4
// The tank's stage (TankView.jsx): the resting camera draws a 16:9 frame, which a portrait phone
// crops to its middle (a 375 by 812 px phone shows 0.26 of its half-width either way).
const STAGE_ASPECT = 16 / 9
// Spots for a clam in view: how many of the camera's rays are tried, how far along each the sand
// is looked for (WU) and in what steps, and how many level rays look for the rock's foot round it.
const VIEW_ATTEMPTS = 2400
const VIEW_DISTANCE = 110
const VIEW_STEP = 0.5
const FOOT_RAYS = 8
// A clam by no bommie in particular: its own rock test is the drawn rocks' (fits, allRocks).
const NO_ROCK = { inside: () => false }
const YIELD_EVERY = 20

// Clam facts of the kit model from its parts' geometries (model metres, the rest point at
// (0, 0, 0), +Y up, the shell's length along X): length, width, height, the underside's outline
// (half-length and half-width at the ground) and points spread over the clam above its underside.
export function measureClam(geometries) {
  const box = new THREE.Box3()
  for (const geometry of geometries) {
    geometry.computeBoundingBox()
    box.union(geometry.boundingBox)
  }
  const height = box.max.y
  const above = []
  let footX = 0
  let footZ = 0
  for (const geometry of geometries) {
    const position = geometry.attributes.position
    for (let i = 0; i < position.count; i++) {
      const y = position.getY(i)
      if (y < height * BASE_SHARE) {
        footX = Math.max(footX, Math.abs(position.getX(i)))
        footZ = Math.max(footZ, Math.abs(position.getZ(i)))
      } else {
        above.push(new THREE.Vector3(position.getX(i), y, position.getZ(i)))
      }
    }
  }
  // Spread along the shell's length so both ends and the middle get points.
  above.sort((a, b) => a.x - b.x || a.y - b.y)
  const samples = []
  for (let k = 0; k < SAMPLE_COUNT && above.length; k++) samples.push(above[Math.floor((k + 0.5) * above.length / SAMPLE_COUNT)])
  return {
    length: box.max.x - box.min.x,
    width: box.max.z - box.min.z,
    height,
    footX: footX || (box.max.x - box.min.x) * 0.35,
    footZ: footZ || (box.max.z - box.min.z) * 0.3,
    samples,
  }
}

// Whether a point is in a placed clam, or within CLAM_CLEAR plus `extra` WU of it, or in the
// phone-view clam's line of sight, for the corals placed after the clams (staghornPlacement.js):
// the clam is taken as an upright elliptic cylinder round its shell, from its underside to its gape;
// the line of sight as a tube SIGHT_RADIUS round, from its gape toward the camera (`sight`).
export function inClam(clams, point, extra = 0) {
  for (const clam of clams) {
    const margin = CLAM_CLEAR + extra
    if (clam.sight) {
      const { from, direction, length } = clam.sight
      const t = Math.min(Math.max((point.x - from.x) * direction.x + (point.y - from.y) * direction.y + (point.z - from.z) * direction.z, 0), length)
      if (Math.hypot(point.x - from.x - direction.x * t, point.y - from.y - direction.y * t, point.z - from.z - direction.z * t) < SIGHT_RADIUS + extra) return true
    }
    const dy = point.y - clam.base.y
    if (dy < -margin || dy > clam.height + margin) continue
    const dx = point.x - clam.base.x
    const dz = point.z - clam.base.z
    const along = (dx * clam.axis.x + dz * clam.axis.z) / (clam.length / 2 + margin)
    const across = (dz * clam.axis.x - dx * clam.axis.z) / (clam.width / 2 + margin)
    if (along * along + across * across < 1) return true
  }
  return false
}

// The sand's up at (x, z): its normal, from the slope either way over a 50 cm step.
function sandNormal(landscape, x, z, target) {
  const step = 1
  const dx = sandHeight(landscape, x + step, z) - sandHeight(landscape, x - step, z)
  const dz = sandHeight(landscape, x, z + step) - sandHeight(landscape, x, z - step)
  return target.set(-dx, 2 * step, -dz).normalize()
}

// Placed giant clams: [{ model, matrix, site, base, axis, length, width, height, centre, top,
// reach, sight, obstacle }], with `site` the index of the cluster it lies by, `axis` its shell's
// length as a level unit vector, `sight` the phone-view clam's open line of sight (null for the
// others) and `obstacle` a piece box for rockObstacles.js. A generator, like
// placeCorals: it yields every few candidate spots and returns the clams when done. clusters are
// coralClusters' (the bommies the tables crown); tables the placed tables; measures are
// measureClam per kit model; view is the resting camera. `avoid(point, extra)`, if given, says
// whether a point is taken by a coral placed before the clams other than the tables; sightRocks,
// if given, are every drawn rock (the landscape's merged chunks), for the clam's own clearance
// (boulders and rubble off the bommie) and the phone-view clam's line of sight.
export function* placeGiantClams(landscape, clusters, tables, measures, view, avoid = null, sightRocks = null) {
  const config = landscape.giantClams
  const plates = tables.map(table => table.plate)
  const tableFeet = tables.map(table => ({ plate: table.plate, foot: new THREE.Vector3().setFromMatrixPosition(table.matrix) }))
  const rand = seededRandom(config.seed)
  const pick = ([min, max]) => min + rand() * (max - min)
  const allRocks = sightRocks?.length ? rockCaster(sightRocks) : null
  const eye = new THREE.Vector3(view?.x ?? 0, view?.y ?? 0, view?.z ?? 0)
  // The resting camera as the tank draws it (a 16:9 stage), for where a clam lands in its frame.
  const camera = new THREE.PerspectiveCamera(view?.fov ?? 42, STAGE_ASPECT, 0.1, 1000)
  camera.position.copy(eye)
  camera.lookAt(view?.lookX ?? eye.x, view?.lookY ?? eye.y, view?.lookZ ?? 0)
  camera.updateMatrixWorld()
  const placed = []
  const point = new THREE.Vector3()
  const origin = new THREE.Vector3()
  const inward = new THREE.Vector3()
  const normal = new THREE.Vector3()
  const lean = new THREE.Vector3()
  const leanAxis = new THREE.Vector3()
  const toClam = new THREE.Vector3()
  const ray = new THREE.Vector3()
  // The bommies in the front half, each with its rocks, nearest the camera first.
  const sites = clusters
    .map((cluster, site) => {
      const bounds = boundsOf(cluster.geometries)
      return { site, cluster, bounds, centre: bounds.getCenter(new THREE.Vector3()), size: bounds.getSize(new THREE.Vector3()) }
    })
    .filter(entry => entry.centre.z >= config.zMin)
    .sort((a, b) => a.centre.distanceToSquared(eye) - b.centre.distanceToSquared(eye))
  const used = new Set()

  // Whether a clam placed by `matrix` is clear: its shell and mantle out of the rock (bar a few
  // points), the sand, the tables, the corals placed before it and the other clams; its underside
  // resting on the sand all round.
  const fits = (shape, matrix, rocks) => {
    let inside = 0
    let sand = 0
    for (const sample of shape.samples) {
      point.copy(sample).applyMatrix4(matrix)
      if (inTable(tableFeet, plates, point) || avoid?.(point) || inClam(placed, point)) return false
      if (point.y < sandHeight(landscape, point.x, point.z) && ++sand > SAND_ALLOWED) return false
      // Never into its bommie; a few points may touch the rubble and boulders round it.
      if (rocks.inside(point)) return false
      if (allRocks?.inside(point) && ++inside > INSIDE_ALLOWED) return false
    }
    for (let k = 0; k < RIM_POINTS; k++) {
      const a = k * Math.PI * 2 / RIM_POINTS
      point.set(Math.cos(a) * shape.footX * 0.9, 0, Math.sin(a) * shape.footZ * 0.9).applyMatrix4(matrix)
      if (point.y - sandHeight(landscape, point.x, point.z) > RIM_FLOAT) return false
    }
    return true
  }
  // The clam's line of sight if the resting camera sees its gape: its middle within `width` of the
  // frame's middle across (shares of its half-width) and clear of the frame's bottom edge (the
  // foreground rocks frame it there), no rock between, and the whole line clear of the tables and
  // the corals placed before it ({ from, direction, length }); else null.
  const viewSight = (base, height, width) => {
    const ndc = toClam.set(base.x, base.y + height / 2, base.z).project(camera)
    if (Math.abs(ndc.x) > width || ndc.y < -FRAME_LOW || ndc.y > FRAME_HIGH || ndc.z > 1) return null
    const from = new THREE.Vector3(base.x, base.y + height * 0.8, base.z)
    ray.copy(eye).sub(from)
    const far = ray.length()
    const direction = ray.clone().normalize()
    if (allRocks?.nearest(ray.copy(from).addScaledVector(direction, SIGHT_SKIP), direction, far - SIGHT_SKIP - 0.5)) return null
    const length = far - SIGHT_SKIP
    for (let t = SIGHT_STEP; t <= length; t += SIGHT_STEP) {
      point.copy(from).addScaledVector(direction, t)
      if (inTable(tableFeet, plates, point) || avoid?.(point)) return null
    }
    return { from, direction, length }
  }

  // Lays one clam at `origin` on the sand (at sandY), by the rock `rocks` stands for (`site` its
  // cluster, or -1), drawing its size, lean and turn; with `width`, only where the resting camera
  // sees it (viewSight). True once placed.
  const lay = (origin, sandY, site, rocks, width) => {
    const model = Math.floor(rand() * measures.length)
    const shape = measures[model]
    const drawn = pick(config.length)
    // Leaning with the sand a little; turned broadside to the camera, within FACING_JITTER.
    sandNormal(landscape, origin.x, origin.z, normal)
    lean.copy(UP).lerp(normal, LEAN_SHARE).normalize()
    const tilt = Math.min(lean.angleTo(UP), MAX_LEAN)
    leanAxis.crossVectors(UP, lean)
    const rotation = new THREE.Quaternion()
    if (leanAxis.lengthSq() > 1e-8) rotation.setFromAxisAngle(leanAxis.normalize(), tilt)
    // The shell's length (local X) across the line to the camera, either way round: turning by
    // the camera's bearing (atan2(x, z)) takes X to (cos, 0, -sin), square to that line.
    const toEye = Math.atan2(eye.x - origin.x, eye.z - origin.z)
    const yaw = toEye + (rand() * 2 - 1) * FACING_JITTER + (rand() < 0.5 ? Math.PI : 0)
    rotation.multiply(new THREE.Quaternion().setFromAxisAngle(UP, yaw))
    for (const shrink of SHRINKS) {
      // Never under the smallest length asked for.
      if (drawn * shrink < config.length[0]) break
      const scale = drawn * shrink / shape.length
      const clam = { length: shape.length * scale, width: shape.width * scale, height: shape.height * scale }
      const base = new THREE.Vector3(origin.x, sandY - clam.height * SINK, origin.z)
      if (base.y + clam.height > landscape.maxTop) continue
      if (placed.some(other => Math.hypot(other.base.x - base.x, other.base.z - base.z) < config.spacing)) continue
      const seen = width ? viewSight(base, clam.height, width) : null
      if (width && !seen) continue
      const matrix = new THREE.Matrix4().compose(base, rotation, new THREE.Vector3(scale, scale, scale))
      if (!fits(shape, matrix, rocks)) continue
      const axis = new THREE.Vector3(1, 0, 0).applyQuaternion(rotation).setY(0).normalize()
      placed.push({
        model,
        matrix,
        site,
        base,
        axis,
        ...clam,
        reach: clam.length / 2,
        centre: new THREE.Vector3(base.x, base.y + clam.height / 2, base.z),
        top: base.y + clam.height,
        sight: seen,
        // The clam as an obstacle box: its shell, a little inside its full spread, turned with it
        // (rockObstacles.js: width along the yawed x).
        obstacle: { x: base.x, z: base.z, y: base.y, height: clam.height, width: clam.length * 0.9, depth: clam.width * 0.9, yaw: Math.atan2(-axis.z, axis.x) },
      })
      used.add(site)
      return true
    }
    return false
  }

  // Tries to lay one clam by this bommie, round it, most often on the side facing the camera:
  // true once placed, false when its attempts run out. Yields every few attempts.
  function* tryClam(entry) {
    const { cluster, centre, size } = entry
    const rocks = rockCaster(cluster.geometries)
    const facing = Math.atan2(eye.z - centre.z, eye.x - centre.x)
    for (let attempt = 0; attempt < ATTEMPTS_PER_CLAM; attempt++) {
      if (attempt % YIELD_EVERY === YIELD_EVERY - 1) yield
      const angle = facing + (rand() * 2 - 1) * (rand() < 0.75 ? 1.1 : Math.PI)
      const reach = 1 + rand() * 0.5
      origin.set(centre.x + Math.cos(angle) * reach * size.x / 2, 0, centre.z + Math.sin(angle) * reach * size.z / 2)
      const sandY = sandHeight(landscape, origin.x, origin.z)
      // Open sand: no rock over it, the bommie's foot within SAND_REACH but not right against it.
      if (rocks.inside(point.set(origin.x, sandY + 0.3, origin.z)) || allRocks?.inside(point)) continue
      inward.set(centre.x - origin.x, 0, centre.z - origin.z).normalize()
      const foot = rocks.nearest(point.set(origin.x, sandY + 0.5, origin.z), inward, SAND_REACH)
      if (!foot || foot.point.distanceTo(point) < NEAR) continue
      if (lay(origin, sandY, entry.site, rocks, null)) return true
    }
    return false
  }

  // Tries to lay one clam the resting camera sees, by any rock (Jeremy, 2026-11-02: the sand at the
  // coral bommies' feet is hidden from it): spots are the sand the camera's rays meet inside `width`
  // of the frame's half-width and clear of its bottom edge, with no rock before them, on open sand
  // in front of zMin with a rock's foot within SAND_REACH round it but not right against it. True
  // once placed. Yields every few attempts.
  function* tryInView(width) {
    for (let attempt = 0; attempt < VIEW_ATTEMPTS; attempt++) {
      if (attempt % YIELD_EVERY === YIELD_EVERY - 1) yield
      const x = (rand() * 2 - 1) * width
      // The lower half of the frame: the upper half looks over the sand into open water.
      const y = -FRAME_LOW + rand() * FRAME_LOW
      const direction = new THREE.Vector3(x, y, 0.5).unproject(camera).sub(eye).normalize()
      if (direction.y > -0.02) continue
      // Down the ray to the sand, then a few halvings to pin where it meets it.
      let near = 0
      let far = 0
      for (let t = VIEW_STEP; t <= VIEW_DISTANCE; t += VIEW_STEP) {
        point.copy(eye).addScaledVector(direction, t)
        if (point.y <= sandHeight(landscape, point.x, point.z)) { near = t - VIEW_STEP; far = t; break }
      }
      if (!far) continue
      for (let k = 0; k < 6; k++) {
        const t = (near + far) / 2
        point.copy(eye).addScaledVector(direction, t)
        if (point.y <= sandHeight(landscape, point.x, point.z)) far = t
        else near = t
      }
      if (allRocks?.nearest(eye, direction, far - 0.5)) continue
      origin.copy(eye).addScaledVector(direction, far).setY(0)
      if (origin.z < config.zMin) continue
      const sandY = sandHeight(landscape, origin.x, origin.z)
      if (allRocks?.inside(point.set(origin.x, sandY + 0.3, origin.z))) continue
      // By a rock: the nearest rock face round it, level, just over the sand.
      let foot = Infinity
      for (let k = 0; k < FOOT_RAYS; k++) {
        const a = k * Math.PI * 2 / FOOT_RAYS
        const hit = allRocks?.nearest(point.set(origin.x, sandY + 0.5, origin.z), ray.set(Math.cos(a), 0, Math.sin(a)), SAND_REACH)
        if (hit) foot = Math.min(foot, hit.point.distanceTo(point))
      }
      if (foot < NEAR || foot === Infinity) continue
      if (lay(origin, sandY, -1, NO_ROCK, width)) return true
    }
    return false
  }

  // The phone-view clam first; failing that, one in the desktop frame (`viewWidth`), so the resting
  // view always shows a clam; then the rest, by the front bommies.
  for (const width of [config.phoneWidth, config.viewWidth]) {
    if (yield* tryInView(width)) break
  }
  for (const entry of sites) {
    if (placed.length >= config.count) break
    if (used.has(entry.site)) continue
    yield* tryClam(entry)
  }
  return placed
}
