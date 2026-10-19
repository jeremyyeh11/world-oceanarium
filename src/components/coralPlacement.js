import * as THREE from 'three'
import { MeshBVH, acceleratedRaycast } from 'three-mesh-bvh'
import { sandHeight, seededRandom } from '../data/landscapes'

// Table corals on the reef rocks (a landscape's `corals`, landscapes.js), placed once when the
// coral kit loads, against the rocks as drawn rather than their boxes, so no coral floats or
// cuts through a ledge.
//
// Corals come in dense clusters, each crowning one rock (a stack with its tiers and talus), with
// open rock and sand between them (Jeremy, 2026-10-19: "denser clusters but less number of
// clusters", after his photo of a bommie crowned with tables). The landscape's hand-placed
// clusters come first, then a few more spread over the reef (coralClusters). Each cluster is
// built like the photo, in three passes: a few big tables low round the rock's foot, on a low
// ledge or the sand beside it, spreading out over the sand; small tables on its top on visible
// stalks; then the rest up its shoulders, on ledges or growing out of its walls.
//
// A table grows where a ray finds rock: cast straight down onto a ledge (a face pointing mostly
// up) or the sand at the rock's foot, with the stalk sunk a little into it; or cast in toward
// the rock onto a wall, with the plate standing out of the face and the stalk running back into
// the rock. Each is turned so it overhangs away from the rock. A candidate is kept only if its
// plate stays out of the rock (a little contact reads as growing from it), clears every plate
// already placed, above or below, with a gap fish can see through, and stays under water.

const BOTH_SIDES = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide })
const UP = new THREE.Vector3(0, 1, 0)
const DOWN = new THREE.Vector3(0, -1, 0)
// Largest tilt off level (about 5°): the plates in the references are nearly flat.
const MAX_TILT = 0.09
const ATTEMPTS_PER_CORAL = 60
// The plate is the part of a model above this share of its height.
const PLATE_FROM = 0.6
// Plate points tested against the rock, and how many of them may sit inside it.
const SAMPLE_COUNT = 32
const INSIDE_ALLOWED = 6
// Big tables on the sand stand within this many WU of the rock's foot.
const SAND_REACH = 2
// How far a wall coral's plate centre stands out from the face, in plate radii.
const WALL_STANDOFF = 0.35
// Least clear water between two plates that overlap from above, in WU (20 cm): tiers in the
// references nearly touch.
const PLATE_GAP = 0.8
// Candidate spots tried between yields (placeCorals is a generator).
const YIELD_EVERY = 20
// A cluster's passes, as in the photo: shares of its tables, and plate widths as shares of the
// rock's narrower width. The foot's big tables spread well past the rock; the top's are small.
const PASSES = [
  { mode: 'foot', share: 0.2, width: [0.5, 0.8] },
  { mode: 'top', share: 0.3, width: [0.15, 0.32] },
  { mode: 'fill', share: 0.5, width: [0.2, 0.45] },
]

// Rock kinds corals grow on (a stack's tiers are ledges); rubble and talus only join the rock
// they lean on, and a boulder hosts a cluster only if it is tall enough (scatter.minHeight). Not
// the canyon's columns (cliffs): a table on a column reads as a mushroom on a post, and Jeremy
// wants the reef read as horizontal stacks, not columns.
const HOST_KINDS = new Set(['ledge', 'bommie', 'wall', 'boulder'])
// Only a rock at least this wide for its height (narrower side over height) takes tables on its
// top or hosts a scattered cluster, for the same reason: the slim foreground bommies (about
// 0.4) stay bare, the stepped mid-ground outcrop (0.58) gets its crown.
const TOP_MIN_SPREAD = 0.45
// Rocks outside this half-angle of the resting view are picked for clusters later than those in
// it, so most clusters land where the visitor looks; rocks beyond FRONT_HALF_ANGLE (beside or
// behind the camera) get none.
const VIEW_HALF_ANGLE = 0.6
const FRONT_HALF_ANGLE = 1.3
const TALUS_SEED = 5000000

// The rock a placed piece belongs to, by the seed of its bottom piece: a stack tier follows
// `restsOn` down to the bottom tier, and a talus rock (seed 5000000 + parent × 10 + k, see
// landscapePieces) joins the rock it leans on. bySeed maps seeds to placed pieces.
export function coralRockOf(piece, bySeed) {
  let root = piece
  if (root.seed >= TALUS_SEED && root.kind === 'talus') root = bySeed.get(Math.floor((root.seed - TALUS_SEED) / 10)) ?? root
  while (root.restsOn !== undefined && bySeed.has(root.restsOn)) root = bySeed.get(root.restsOn)
  return HOST_KINDS.has(root.kind) ? root.seed : null
}

export function boundsOf(geometries) {
  const bounds = new THREE.Box3()
  for (const geometry of geometries) {
    geometry.computeBoundingBox()
    bounds.union(geometry.boundingBox)
  }
  return bounds
}

// The clusters to place: the landscape's hand-placed ones (`clusters`, by the seeds in its
// `rocks` list), then up to `scatter.clusters` more, each on a rock at least `minHeight` WU tall
// and wide for its height, whose top reaches `minTop`, within `maxDistance` of the resting camera
// and at least `spacing` WU from every other cluster, in front of the resting camera, nearer
// rocks and rocks in its view likelier. rocks: Map of bottom-piece seed →
// the drawn world-space geometries of that rock. view: the resting camera. Each cluster carries
// the `roots` of the rocks it crowns, which staghorn thickets keep clear of.
export function coralClusters(landscape, rocks, view) {
  const { clusters = [], scatter } = landscape.corals
  const camera = new THREE.Vector3(view?.x ?? 0, view?.y ?? 0, view?.z ?? 0)
  const forward = new THREE.Vector3(view?.lookX ?? camera.x, view?.lookY ?? camera.y, view?.lookZ ?? 0).sub(camera).normalize()
  const toRock = new THREE.Vector3()
  const used = new Set()
  const centres = []
  const resolved = []
  for (const cluster of clusters) {
    // A hand-placed stack's bottom tier is its seed × 10.
    const roots = [...rocks.keys()].filter(root => cluster.hosts.some(seed => root === seed || root === seed * 10))
    roots.forEach(root => used.add(root))
    const geometries = roots.flatMap(root => rocks.get(root))
    if (!geometries.length) continue
    centres.push(boundsOf(geometries).getCenter(new THREE.Vector3()))
    resolved.push({ ...cluster, roots, geometries })
  }
  if (!scatter) return resolved
  const rand = seededRandom(scatter.seed)
  const candidates = []
  for (const root of [...rocks.keys()].sort((a, b) => a - b)) {
    // One draw per rock whether or not it is used, so adding a rock elsewhere keeps the rest.
    const draw = rand()
    if (used.has(root)) continue
    const bounds = boundsOf(rocks.get(root))
    const centre = bounds.getCenter(new THREE.Vector3())
    const size = bounds.getSize(new THREE.Vector3())
    const distance = camera.distanceTo(centre)
    if (size.y < scatter.minHeight || bounds.max.y < scatter.minTop || distance > scatter.maxDistance) continue
    // A crown needs a top: only rocks wide for their height, like the photo's bommie, not the
    // tall stacks, whose tables could only cling to their walls.
    if (Math.min(size.x, size.z) < size.y * TOP_MIN_SPREAD) continue
    const off = toRock.subVectors(centre, camera).normalize().angleTo(forward)
    if (off > FRONT_HALF_ANGLE) continue
    const inView = off < VIEW_HALF_ANGLE
    candidates.push({ root, centre, size, order: draw + 0.8 * distance / scatter.maxDistance + (inView ? 0 : 0.6) })
  }
  candidates.sort((a, b) => a.order - b.order)
  let added = 0
  for (const { root, centre, size } of candidates) {
    if (added >= scatter.clusters) break
    if (centres.some(other => Math.hypot(other.x - centre.x, other.z - centre.z) < scatter.spacing)) continue
    centres.push(centre)
    added++
    // More tables on a bigger rock.
    const count = THREE.MathUtils.clamp(Math.round(size.x * size.z / scatter.areaPerCoral), scatter.count[0], scatter.count[1])
    resolved.push({ ...scatter, count, seed: scatter.seed * 7919 + root, roots: [root], geometries: rocks.get(root) })
  }
  return resolved
}

// Plate facts of a kit model from its close-up mesh (model metres, foot of the stalk at the
// origin): height, the plate's centre (x, z) and radius, and points spread over it.
export function measureCoral(geometry) {
  geometry.computeBoundingBox()
  const height = geometry.boundingBox.max.y
  const position = geometry.attributes.position
  const plate = []
  for (let i = 0; i < position.count; i++) {
    if (position.getY(i) >= height * PLATE_FROM) plate.push(i)
  }
  let cx = 0
  let cz = 0
  for (const i of plate) {
    cx += position.getX(i)
    cz += position.getZ(i)
  }
  cx /= plate.length
  cz /= plate.length
  let radius = 0
  for (const i of plate) radius = Math.max(radius, Math.hypot(position.getX(i) - cx, position.getZ(i) - cz))
  // Rim points weigh most (where a plate meets a ledge), so take the outer half first.
  const byDistance = [...plate].sort((a, b) =>
    Math.hypot(position.getX(b) - cx, position.getZ(b) - cz) - Math.hypot(position.getX(a) - cx, position.getZ(a) - cz))
  const outer = byDistance.slice(0, Math.ceil(byDistance.length / 2))
  const picks = []
  for (let k = 0; k < SAMPLE_COUNT * 0.75; k++) picks.push(outer[Math.floor(k * outer.length / (SAMPLE_COUNT * 0.75))])
  for (let k = 0; k < SAMPLE_COUNT * 0.25; k++) picks.push(byDistance[Math.floor(k * byDistance.length / (SAMPLE_COUNT * 0.25))])
  const samples = picks.map(i => new THREE.Vector3().fromBufferAttribute(position, i))
  return { height, centre: new THREE.Vector3(cx, 0, cz), radius, samples }
}

// Ray casts against one cluster's rocks, both faces, with the hit face's outward normal.
export function rockCaster(geometries) {
  const meshes = geometries.map(geometry => {
    if (!geometry.boundsTree) geometry.boundsTree = new MeshBVH(geometry)
    const mesh = new THREE.Mesh(geometry, BOTH_SIDES)
    mesh.raycast = acceleratedRaycast
    mesh.updateMatrixWorld(true)
    return mesh
  })
  const raycaster = new THREE.Raycaster()
  // Nearest hit per rock.
  raycaster.firstHitOnly = true
  const hits = []
  const cast = (origin, direction, far) => {
    raycaster.set(origin, direction)
    raycaster.far = far
    hits.length = 0
    raycaster.intersectObjects(meshes, false, hits)
    return hits
  }
  return {
    // Nearest surface along the ray: { point, normal } or null.
    nearest(origin, direction, far) {
      let best = null
      for (const hit of cast(origin, direction, far)) if (!best || hit.distance < best.distance) best = hit
      return best && { point: best.point.clone(), normal: best.face.normal.clone() }
    },
    // Inside a rock when the first face above the point, on any rock, faces up: the ray is
    // leaving that rock through its top.
    inside(point) {
      return cast(point, UP, 200).some(hit => hit.face.normal.y > 0)
    },
  }
}

// Placed corals for a landscape: [{ model, matrix, plate: { x, y, z, radius }, obstacle }],
// with `obstacle` a piece box for rockObstacles.js. A generator: it yields every few candidate
// spots so the caller can spread the work over frames, and returns the corals when done.
// clusters come from coralClusters; measures are measureCoral per kit model; view is the
// resting camera the clusters face.
export function* placeCorals(landscape, clusters, measures, view) {
  const { kit } = landscape.corals
  const placed = []
  const origin = new THREE.Vector3()
  const yawTurn = new THREE.Quaternion()
  const tilt = new THREE.Quaternion()
  const offset = new THREE.Vector3()
  const point = new THREE.Vector3()
  const inward = new THREE.Vector3()
  for (const cluster of clusters) {
    const rocks = rockCaster(cluster.geometries)
    const bounds = boundsOf(cluster.geometries)
    const centre = bounds.getCenter(new THREE.Vector3())
    const size = bounds.getSize(new THREE.Vector3())
    const rand = seededRandom(cluster.seed)
    const [minWidth, maxWidth] = cluster.width
    // The rock's narrower width, which the plate widths are shares of.
    const across = Math.min(size.x, size.z)
    // The side of the rock facing the resting camera.
    const facing = view ? Math.atan2(view.z - centre.z, view.x - centre.x) : Math.PI / 2
    const narrow = across < size.y * TOP_MIN_SPREAD
    for (const pass of PASSES) {
      const count = pass.mode === 'top' && narrow ? 0
        : pass.mode === 'fill' ? cluster.count - Math.round(cluster.count * PASSES[0].share) - (narrow ? 0 : Math.round(cluster.count * PASSES[1].share))
          : Math.max(1, Math.round(cluster.count * pass.share))
      let kept = 0
      for (let attempt = 0; attempt < count * ATTEMPTS_PER_CORAL && kept < count; attempt++) {
        if (attempt % YIELD_EVERY === YIELD_EVERY - 1) yield
        // Most often on the side facing the camera.
        const angle = facing + (rand() * 2 - 1) * (rand() < cluster.frontBias ? 1.1 : Math.PI)
        const onWall = pass.mode === 'fill' && rand() < cluster.wallShare
        let footY
        let hit = null
        let wall = null
        if (onWall) {
          const y = bounds.min.y + (0.15 + rand() * 0.8) * size.y
          inward.set(-Math.cos(angle), 0, -Math.sin(angle))
          origin.set(centre.x - inward.x * (size.x / 2 + 6), y, centre.z - inward.z * (size.z / 2 + 6))
          wall = rocks.nearest(origin, inward, size.x + size.z + 12)
          // A face that is mostly upright, facing out.
          if (!wall || Math.abs(wall.normal.y) > 0.7 || Math.hypot(wall.normal.x, wall.normal.z) < 0.5) continue
          footY = wall.point.y
        } else {
          // The foot's tables round the rock's edge, the top's near its middle, the rest between.
          const reach = pass.mode === 'foot' ? 0.8 + rand() * 0.4 : pass.mode === 'top' ? rand() * 0.55 : 0.3 + rand() * 0.6
          origin.set(centre.x + Math.cos(angle) * reach * size.x / 2, bounds.max.y + 2, centre.z + Math.sin(angle) * reach * size.z / 2)
          hit = rocks.nearest(origin, DOWN, size.y + 4)
          const sandY = sandHeight(landscape, origin.x, origin.z)
          if (hit) {
            // A ledge, not a wall or an overhang's underside.
            if (hit.normal.y < (pass.mode === 'top' ? 0.6 : 0.5) || hit.point.y < sandY) continue
            footY = hit.point.y
          } else {
            // Only the foot's big tables stand on the sand, and only right at the rock's foot
            // (rock within SAND_REACH, looking inward), never out on open sand.
            if (pass.mode !== 'foot') continue
            inward.set(centre.x - origin.x, 0, centre.z - origin.z).normalize()
            if (!rocks.nearest(point.set(origin.x, sandY + 1, origin.z), inward, SAND_REACH)) continue
            footY = sandY
          }
        }
        const rise = THREE.MathUtils.clamp((footY - bounds.min.y) / size.y, 0, 1)
        if (pass.mode === 'foot' && rise > 0.45) continue
        if (pass.mode === 'top' && rise < 0.65) continue
        // Nor on the top of a narrow rock from a ledge ray.
        if (narrow && hit && rise > 0.8) continue
        const [low, high] = pass.width
        const wanted = THREE.MathUtils.clamp(across * (low + rand() * (high - low)), minWidth, maxWidth)
        // Turn the plate's offset from its stalk to point away from the rock (or straight out
        // of the wall), so it overhangs outward; a little play either way.
        const outward = wall ? Math.atan2(wall.normal.z, wall.normal.x) : Math.atan2(origin.z - centre.z, origin.x - centre.x)
        const play = (rand() * 2 - 1) * 0.5
        const bigModel = rand() < 0.5 ? 0 : 1
        tilt.setFromEuler(new THREE.Euler((rand() * 2 - 1) * MAX_TILT, 0, (rand() * 2 - 1) * MAX_TILT))
        // Tables on top show their stalks; the rest sink deeper into their ledge or the sand.
        const sink = pass.mode === 'top' ? 0.06 + rand() * 0.06 : 0.12 + rand() * 0.08
        // A ledge is often narrower than the plate wanted there: try it smaller before giving up.
        for (const shrink of [1, 0.8, 0.65]) {
          const width = wanted * shrink
          if (width < minWidth * 0.8) break
          const model = width < kit.smallBelowWU ? 2 : bigModel
          const shape = measures[model]
          const scale = width / (2 * shape.radius)
          yawTurn.setFromAxisAngle(UP, Math.atan2(shape.centre.z, shape.centre.x) - outward + play)
          const rotation = tilt.clone().multiply(yawTurn)
          offset.copy(shape.centre).applyQuaternion(yawTurn).multiplyScalar(scale)
          const foot = new THREE.Vector3()
          if (wall) {
            // Out of a wall: the plate's centre a third of its radius out from the face, its top
            // level with the hit, and the stalk running down into the rock behind it, so only
            // the plate shows. Kept only if the stalk's foot and middle are inside the rock.
            inward.set(wall.normal.x, 0, wall.normal.z).normalize()
            foot.copy(wall.point).addScaledVector(inward, shape.radius * scale * WALL_STANDOFF).sub(offset)
            foot.y = footY - shape.height * scale
            if (!rocks.inside(foot)) continue
            if (!rocks.inside(point.copy(foot).setY(foot.y + shape.height * scale * 0.45))) continue
          } else {
            foot.set(origin.x, footY - shape.height * scale * sink, origin.z)
          }
          const matrix = new THREE.Matrix4().compose(foot, rotation, new THREE.Vector3(scale, scale, scale))
          const plate = {
            x: foot.x + offset.x,
            y: foot.y + shape.height * scale * 0.8,
            z: foot.z + offset.z,
            radius: shape.radius * scale,
            thickness: shape.height * scale * (1 - PLATE_FROM),
          }
          // Clear of every plate already placed: plates that overlap from above need a gap.
          const clash = placed.some(other => {
            const apart = Math.hypot(plate.x - other.plate.x, plate.z - other.plate.z)
            if (apart > (plate.radius + other.plate.radius) * 0.95) return false
            return Math.abs(plate.y - other.plate.y) < (plate.thickness + other.plate.thickness) / 2 + PLATE_GAP
          })
          if (clash) continue
          // The plate out of the rock (a little contact reads as growing from it) and the sand.
          let inside = 0
          let buried = false
          for (const sample of shape.samples) {
            point.copy(sample).applyMatrix4(matrix)
            if (point.y < sandHeight(landscape, point.x, point.z) + 0.2) {
              buried = true
              break
            }
            if (rocks.inside(point) && ++inside > INSIDE_ALLOWED) break
          }
          if (buried || inside > INSIDE_ALLOWED) continue
          // Under water, below the rock tops' limit.
          if (plate.y + plate.thickness / 2 > landscape.maxTop) continue

          placed.push({
            model,
            matrix,
            plate,
            // The plate as an obstacle box (its ellipsoid), from its underside to its top.
            obstacle: {
              x: plate.x, z: plate.z, y: plate.y - plate.thickness, height: plate.thickness * 1.5,
              width: plate.radius * 2, depth: plate.radius * 2, yaw: 0,
            },
          })
          kept++
          break
        }
      }
    }
  }
  return placed
}
