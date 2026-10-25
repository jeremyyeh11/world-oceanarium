import * as THREE from 'three'
import { MeshBVH } from 'three-mesh-bvh'
import { sandHeight, seededRandom } from '../data/landscapes'
import { boundsOf, rockCaster } from './coralPlacement'
import { inPlate } from './staghornPlacement'

// Giant sea fans (a landscape's `seaFans`, landscapes.js), placed once the table corals are
// (coralPlacement.js): on the same bommies, as Jeremy wants every coral form on the same rocks
// as one cluster (2026-10-20), and a few more scattered singly over the reef's other rocks (he
// found the first fans "very little ... scattered", 2026-10-26). They go in before the staghorn,
// which then keeps clear of them (staghornPlacement.js, inFan): the staghorn crowds a bommie's
// tops and feet with 40-odd colonies, and placed after it a fan found room on almost none.
//
// A sea fan grows from a holdfast cemented to rock (Brihatee et al. 2025: consolidated rock on
// steep slopes), on tops, slopes and walls alike: Jeremy (2026-10-26) "these corals should grow on
// rocks ... they can grow along rock faces, no need to always be upward facing". Its flat lattice
// stands broadside to the current so the polyps sieve the most water (SeaLifeBase, after Goh &
// Chou 1996). So each fan here starts from a point on a rock face hit by a ray from outside, any
// face but an overhang's underside; it grows out along the face's normal tipped up toward the
// light (a fan on a wall leans out and up, one on a top stands upright), its face turned toward
// the current within `facingJitter`. A fan is kept only if its holdfast is buried in the rock (no
// fan floats), its lattice and branches stay out of every rock, the sand, every table (plate and
// stalk) and every other fan, it stays under water, and the resting camera sees at least
// `minVisible` of nine points on its face: without that the first fans mostly stood behind
// their bommies or the foreground rocks.

const UP = new THREE.Vector3(0, 1, 0)
const ATTEMPTS_PER_FAN = 120
// How far a fan on a wall is tipped up from the wall's normal: its growth direction is the
// normal plus this much of straight up.
const GROW_UP = 0.9
// Faces pointing further down than this (an overhang's underside) take no holdfast.
const MIN_FACE_UP = -0.25
// Points of the fan tested against the rock, sand, tables and fans: a grid over its face and
// points along its branches. Points within this share of its height of the holdfast (by distance:
// a lobe of lattice hanging below the holdfast is not excused) may touch the
// rock it grows from.
const GRID = 13
const BRANCH_SAMPLES = 24
const BASE_SHARE = 0.12
// The ways a fan may stand at a spot, tried in turn: [turn from the current about its growth
// direction, how far it is tipped up from the rock face's normal (GROW_UP first)].
const VARIANTS = [[0, GROW_UP], [0.6, GROW_UP], [-0.6, GROW_UP], [1.2, GROW_UP], [-1.2, GROW_UP], [0, 0.35], [0.9, 0.35], [-0.9, 0.35]]
// The holdfast sinks this share of the fan's height into the rock, along the face's normal.
const SINK = 0.04
// Water kept either side of a fan's lattice by other corals (inFan), in WU, on top of its sway.
const FAN_CLEAR = 0.4
// Water kept between a fan and a table's stalk, in WU.
const STALK_CLEAR = 0.4
const YIELD_EVERY = 20
// Points on a fan's face tested for sight from the resting camera, as shares of its width
// (across its middle) and height.
const SIGHT_POINTS = [-0.3, 0, 0.3].flatMap(x => [0.3, 0.55, 0.8].map(y => [x, y]))
// The resting camera's frame, half-angles' tangents: 42° tall, 16:9 wide (REEFS_VIEW).
const FRAME_TAN_Y = Math.tan(THREE.MathUtils.degToRad(21))
const FRAME_TAN_X = FRAME_TAN_Y * 16 / 9

// Fan facts of a kit model (model metres, holdfast at the origin, lattice in the XY plane):
// height, the farthest point from the holdfast (its rim), the lattice's extent along x, and
// test points: a GRID × GRID grid over the face (kept where the model has a vertex nearby, so a
// trimmed outline's empty corners are not tested) and points spread over the rest.
// parts: [{ geometry, masked }], masked for the lattice cut out by its texture.
export function measureFan(parts) {
  let height = 0
  let reach = 0
  let minX = Infinity
  let maxX = -Infinity
  const lattice = []
  const branches = []
  for (const { geometry, masked } of parts) {
    const position = geometry.attributes.position
    for (let i = 0; i < position.count; i++) {
      const point = new THREE.Vector3().fromBufferAttribute(position, i)
      height = Math.max(height, point.y)
      reach = Math.max(reach, point.length())
      minX = Math.min(minX, point.x)
      maxX = Math.max(maxX, point.x)
      ;(masked ? lattice : branches).push(point)
    }
  }
  const width = maxX - minX
  const cell = Math.max(width, height) / GRID
  const samples = []
  for (let i = 0; i <= GRID; i++) {
    for (let j = 0; j <= GRID; j++) {
      const x = minX + width * i / GRID
      const y = height * j / GRID
      let nearest = null
      let best = cell
      for (const point of lattice) {
        const d = Math.hypot(point.x - x, point.y - y)
        if (d < best) { best = d; nearest = point }
      }
      if (nearest) samples.push(new THREE.Vector3(x, y, nearest.z))
    }
  }
  for (let k = 0; k < BRANCH_SAMPLES && branches.length; k++) samples.push(branches[Math.floor(k * branches.length / BRANCH_SAMPLES)])
  return { height, reach, minX, maxX, width, samples }
}

// Whether a point is in a placed fan's lattice, or within its clearance (FAN_CLEAR and its
// sway) plus `extra` WU of it, for the corals placed after the fans (staghornPlacement.js).
const local = new THREE.Vector3()
export function inFan(fans, point, extra = 0) {
  for (const fan of fans) {
    const reach = fan.reach + fan.clear + extra
    if (Math.abs(point.x - fan.base.x) > reach || Math.abs(point.z - fan.base.z) > reach || Math.abs(point.y - fan.base.y) > reach) continue
    local.copy(point).applyMatrix4(fan.inverse)
    const margin = (fan.clear + extra) / fan.scale
    if (Math.abs(local.z) < margin && local.y > -margin && local.y < fan.shape.height + margin
      && local.x > fan.shape.minX - margin && local.x < fan.shape.maxX + margin) return true
  }
  return false
}

// Whether a point is in a table's plate or near its stalk (from its foot up to its plate).
function inTable(tables, plates, point) {
  if (inPlate(plates, point)) return true
  for (const table of tables) {
    const { plate } = table
    const foot = table.foot
    if (point.y < foot.y - 0.5 || point.y > plate.y) continue
    if (Math.hypot(point.x - foot.x, point.z - foot.z) < plate.radius * 0.2 + STALK_CLEAR) return true
  }
  return false
}

// How many of a fan's SIGHT_POINTS the resting camera sees: in frame and with no rock between.
function pointsSeen(shape, matrix, sight, scratch) {
  const { eye, forward, right, up, rocks } = sight
  let seen = 0
  for (const [x, y] of SIGHT_POINTS) {
    scratch.set((shape.minX + shape.maxX) / 2 + x * shape.width, y * shape.height, 0).applyMatrix4(matrix).sub(eye)
    const depth = scratch.dot(forward)
    if (depth <= 0 || Math.abs(scratch.dot(right)) > depth * FRAME_TAN_X || Math.abs(scratch.dot(up)) > depth * FRAME_TAN_Y) continue
    const distance = scratch.length()
    if (!rocks.nearest(eye, scratch.normalize(), distance - 0.3)) seen++
  }
  return seen
}

// The sites fans grow on: each coral cluster (`perCluster` fans), then up to `scatter.rocks` of
// the reef's other coral-host rocks (`scatter.perRock` fans each) at least `scatter.spacing` WU
// from every cluster and each other, within `scatter.maxDistance` of the resting camera and in
// front of it. coralRocks: Map of rock → its drawn world-space geometries (Landscape.jsx).
function fanSites(config, clusters, coralRocks, view, rand) {
  const sites = clusters.map(cluster => ({ geometries: cluster.geometries, seed: cluster.seed, count: config.perCluster }))
  const scatter = config.scatter
  if (!scatter || !coralRocks || !view) return sites
  const eye = new THREE.Vector3(view.x ?? 0, view.y ?? 0, view.z ?? 0)
  const forward = new THREE.Vector3(view.lookX ?? eye.x, eye.y, view.lookZ ?? 0).sub(eye).setY(0).normalize()
  const used = new Set(clusters.flatMap(cluster => cluster.roots ?? []))
  const taken = clusters.map(cluster => boundsOf(cluster.geometries).getCenter(new THREE.Vector3()))
  const candidates = []
  for (const [root, geometries] of coralRocks) {
    if (used.has(root)) continue
    const centre = boundsOf(geometries).getCenter(new THREE.Vector3())
    const toRock = centre.clone().sub(eye).setY(0)
    const distance = toRock.length()
    if (distance > scatter.maxDistance || toRock.normalize().dot(forward) < Math.cos(0.7)) continue
    candidates.push({ root, geometries, centre })
  }
  for (let i = candidates.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[candidates[i], candidates[j]] = [candidates[j], candidates[i]]
  }
  for (const candidate of candidates) {
    if (sites.length - clusters.length >= scatter.rocks) break
    if (taken.some(other => Math.hypot(other.x - candidate.centre.x, other.z - candidate.centre.z) < scatter.spacing)) continue
    taken.push(candidate.centre)
    sites.push({ geometries: candidate.geometries, seed: scatter.seed * 7919 + candidate.root, count: scatter.perRock })
  }
  return sites
}

// Placed sea fans: [{ model, matrix, inverse, scale, shape, site, base, height, reach, width,
// normal, phase, clear, obstacle }], with `site` the index of the site it grows on, `normal` its
// face (the way it swings), `phase` its sway's phase and `obstacle` a piece box for
// rockObstacles.js. A generator, like placeCorals: it yields every few candidate spots and
// returns the fans when done. clusters are coralClusters'; tables the placed tables; measures
// are measureFan per kit model; view is the resting camera; sightRocks every drawn rock (the
// landscape's merged chunks: the rock and sight tests); coralRocks the coral-host rocks
// (Landscape.jsx) for the scattered fans.
export function* placeSeaFans(landscape, clusters, tables, measures, view, sightRocks, coralRocks = null) {
  const config = landscape.seaFans
  const plates = tables.map(table => table.plate)
  const tableFeet = tables.map(table => ({ plate: table.plate, foot: new THREE.Vector3().setFromMatrixPosition(table.matrix) }))
  const current = new THREE.Vector3(config.current[0], 0, config.current[1]).normalize()
  // A BVH tree per rock chunk, one a slice (each takes a few ms), kept on the chunk for the session.
  for (const geometry of sightRocks) {
    if (geometry.boundsTree) continue
    geometry.boundsTree = new MeshBVH(geometry)
    yield
  }
  const allRocks = rockCaster(sightRocks)
  let sight = null
  if (view) {
    const eye = new THREE.Vector3(view.x ?? 0, view.y ?? 0, view.z ?? 0)
    const forward = new THREE.Vector3(view.lookX ?? eye.x, view.lookY ?? eye.y, view.lookZ ?? 0).sub(eye).normalize()
    const right = new THREE.Vector3().crossVectors(forward, UP).normalize()
    sight = { eye, forward, right, up: new THREE.Vector3().crossVectors(right, forward), rocks: allRocks }
  }
  const sites = fanSites(config, clusters, coralRocks, view, seededRandom(config.seed * 31 + 7))
  const placed = []
  const origin = new THREE.Vector3()
  const direction = new THREE.Vector3()
  const point = new THREE.Vector3()
  const grow = new THREE.Vector3()
  const face = new THREE.Vector3()
  const side = new THREE.Vector3()
  const basis = new THREE.Matrix4()
  for (const [site, { geometries, seed, count: countRange }] of sites.entries()) {
    const rocks = rockCaster(geometries)
    const bounds = boundsOf(geometries)
    const centre = bounds.getCenter(new THREE.Vector3())
    const size = bounds.getSize(new THREE.Vector3())
    const out = Math.max(size.x, size.y, size.z)
    const rand = seededRandom(config.seed * 7919 + seed)
    const pick = ([min, max]) => min + rand() * (max - min)
    const facing = view ? Math.atan2(view.z - centre.z, view.x - centre.x) : Math.PI / 2
    const count = Math.round(pick(countRange))
    let kept = 0
    for (let attempt = 0; attempt < count * ATTEMPTS_PER_FAN && kept < count; attempt++) {
      if (attempt % YIELD_EVERY === YIELD_EVERY - 1) yield
      // A ray in at the rock from outside: all round it, more often from the camera's side, from
      // level to steeply above, aimed at a point inside its bounds.
      const azimuth = facing + (rand() * 2 - 1) * (rand() < 0.6 ? 1.6 : Math.PI)
      const elevation = -0.1 + rand() * 1.2
      direction.set(Math.cos(azimuth) * Math.cos(elevation), Math.sin(elevation), Math.sin(azimuth) * Math.cos(elevation))
      point.set(centre.x + (rand() - 0.5) * size.x * 0.6, bounds.min.y + size.y * (0.15 + rand() * 0.85), centre.z + (rand() - 0.5) * size.z * 0.6)
      origin.copy(point).addScaledVector(direction, out * 1.5)
      const hit = rocks.nearest(origin, direction.negate(), out * 3)
      if (!hit || hit.normal.dot(direction) > 0 || hit.normal.y < MIN_FACE_UP) continue
      if (hit.point.y < sandHeight(landscape, hit.point.x, hit.point.z) + 0.2) continue
      const normal = hit.normal.normalize()
      const height = pick(config.height) * (site < clusters.length ? 1 : 0.85)
      const model = Math.floor(rand() * measures.length)
      const shape = measures[model]
      const scale = height / shape.height
      const base = hit.point.clone().addScaledVector(normal, -height * SINK)
      // Buried at the holdfast: nothing floats.
      if (!allRocks.inside(base)) continue
      if (placed.some(other => other.base.distanceTo(base) < (other.width + shape.width * scale) * 0.3)) continue
      // Out along the face, tipped up; the face broadside to the current, turned a little. If
      // that runs the lattice into the rock it grows from (most often: it spans along the rock
      // face), the same spot tries the fan turned further from the current, then tipped further
      // out from the face, before it gives up.
      const turn = (rand() * 2 - 1) * config.facingJitter
      let matrix = null
      let top = -Infinity
      for (const [spin, tip] of VARIANTS) {
        grow.copy(normal).addScaledVector(UP, tip).normalize()
        face.copy(current).applyAxisAngle(UP, turn + spin)
        face.addScaledVector(grow, -face.dot(grow))
        if (face.length() < 0.4) continue
        face.normalize()
        side.crossVectors(grow, face)
        basis.makeBasis(side, grow, face)
        const candidate = new THREE.Matrix4().compose(base, new THREE.Quaternion().setFromRotationMatrix(basis), new THREE.Vector3(scale, scale, scale))
        let clash = false
        top = -Infinity
        for (const sample of shape.samples) {
          point.copy(sample).applyMatrix4(candidate)
          top = Math.max(top, point.y)
          if (point.y < sandHeight(landscape, point.x, point.z) || inTable(tableFeet, plates, point) || inFan(placed, point)
            || (sample.length() > shape.height * BASE_SHARE && allRocks.inside(point))) {
            clash = true
            break
          }
        }
        if (clash || top > landscape.maxTop) continue
        if (sight && pointsSeen(shape, candidate, sight, point) < config.minVisible) continue
        matrix = candidate
        break
      }
      if (!matrix) continue
      // The obstacle box: the fan's extent across and along its face's horizontal heading.
      const yaw = Math.atan2(face.x, face.z)
      const across = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw))
      const along = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw))
      let minA = Infinity, maxA = -Infinity, minB = Infinity, maxB = -Infinity, minY = Infinity
      for (const sample of shape.samples) {
        point.copy(sample).applyMatrix4(matrix)
        minA = Math.min(minA, point.dot(across)); maxA = Math.max(maxA, point.dot(across))
        minB = Math.min(minB, point.dot(along)); maxB = Math.max(maxB, point.dot(along))
        minY = Math.min(minY, point.y)
      }
      const middle = across.clone().multiplyScalar((minA + maxA) / 2).addScaledVector(along, (minB + maxB) / 2)
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
        normal: face.clone(),
        // Along the current, so the surge passes through the reef as a wave, plus a little jitter.
        phase: base.dot(current) * 0.35 + rand() * 0.8,
        // Water other corals keep from the lattice: FAN_CLEAR and the rim's swing.
        clear: FAN_CLEAR + config.sway.bend * height,
        obstacle: {
          x: middle.x, z: middle.z, y: minY, height: top - minY,
          width: (maxA - minA) * 0.9, depth: Math.max(maxB - minB, 0.6), yaw,
        },
      })
      kept++
    }
  }
  return placed
}
