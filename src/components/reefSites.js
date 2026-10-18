import * as THREE from 'three'
import { MeshBVH, acceleratedRaycast } from 'three-mesh-bvh'

// Reef sites: spots on the real rock surfaces where reef fish hover, peck and shelter (see
// docs/reef-behavior.md). Landscape publishes the placed geometry of every rock a reef fish can
// reach once the rock kit has loaded, and clears it on unmount; with none published every query
// fails at once and reef fish simply roam.
//
// rockObstacles.js steers fish round an ellipsoid fitted to each rock's box. That is close
// enough to keep a body clear, but a peck has to land on the rock as drawn, so sites are found
// by raycasting the drawn geometry instead. Rays only run when a fish picks a site or a peck
// spot, never every frame, and at most one site search runs per frame across the tank. Each rock
// carries a bounding-volume tree (three-mesh-bvh): without it a shelter search, twenty-odd rays
// each testing every triangle of the rocks they pass, took up to 26 ms.

// Front faces only: a ray starting inside a rock passes out through it rather than hitting it.
const SURFACE_MATERIAL = new THREE.MeshBasicMaterial()
// Ring of directions for the room-to-turn and enclosure checks (unit, horizontal).
const RING = Array.from({ length: 8 }, (_, k) => new THREE.Vector3(Math.cos(k * Math.PI / 4), 0, Math.sin(k * Math.PI / 4)))
const UP = new THREE.Vector3(0, 1, 0)
const DOWN = new THREE.Vector3(0, -1, 0)
// Overhead directions for enclosure: straight up and two tilted up-and-out, so a ledge above
// counts toward a nook.
const OVERHEAD = [UP, new THREE.Vector3(0.6, 0.8, 0), new THREE.Vector3(-0.6, 0.8, 0)]
// One site search per this many ms (about a frame), however many fish want one.
const SEARCH_WINDOW_MS = 12
// Where the fish lines up, in entry distances out from the rest point: the full distance, else
// nearer, else further out (past the padded plate over a fish hiding under a table).
const ENTRY_SHARES = [1, 0.6, 1.6]

let surfaces = null
let lastSearchAt = -Infinity

const raycaster = new THREE.Raycaster()
// Only the nearest hit on each rock is wanted.
raycaster.firstHitOnly = true
const intersections = []
const aim = new THREE.Vector3()
const half = new THREE.Vector3()
const origin = new THREE.Vector3()
const rayDirection = new THREE.Vector3()
const facePoint = new THREE.Vector3()
const faceNormal = new THREE.Vector3()
const rest = new THREE.Vector3()
const entry = new THREE.Vector3()
const outward = new THREE.Vector3()
const segment = new THREE.Vector3()
const candidates = []

// Two surface sets share the queries: the tank's rocks (Landscape, as the rock kit loads) and its
// table corals (once their placement finishes, see coralPlacement.js). Every ray meets both, since
// a coral plate is as solid as rock; a site search can ask for one kind (`query.kind`). Each mesh
// keeps its kind, and a coral its plate (`metas`), so searches can aim under or at the plate.
let rockSet = null
let coralSet = null

function surfaceMesh(geometry) {
  if (!geometry.boundingBox) geometry.computeBoundingBox()
  if (!geometry.boundingSphere) geometry.computeBoundingSphere()
  if (!geometry.boundsTree) geometry.boundsTree = new MeshBVH(geometry)
  const mesh = new THREE.Mesh(geometry, SURFACE_MATERIAL)
  mesh.raycast = acceleratedRaycast
  mesh.updateMatrixWorld(true)
  return mesh
}

function rebuildSurfaces() {
  if (!rockSet) {
    surfaces = null
    return
  }
  const corals = coralSet?.meshes ?? []
  const meshes = [...rockSet.meshes, ...corals]
  surfaces = {
    meshes,
    boxes: meshes.map(mesh => mesh.geometry.boundingBox),
    kinds: meshes.map((_, i) => (i < rockSet.meshes.length ? 'rock' : 'coral')),
    metas: [...rockSet.meshes.map(() => null), ...(coralSet?.metas ?? [])],
    viewpoint: rockSet.viewpoint,
  }
}

// geometries: world-space BufferGeometries, one per reachable rock (Landscape owns and frees them).
// view: the tank's resting camera ({ x, y, z, lookX, lookY, lookZ }, Camera.jsx settings), so
// fish can favour the reef the visitor actually sees (pickViewHome, `viewBias` below).
export function setReefSurfaces(geometries, view = null) {
  let viewpoint = null
  if (view) {
    const position = new THREE.Vector3(view.x ?? 0, view.y ?? 0, view.z ?? 0)
    const target = new THREE.Vector3(view.lookX ?? position.x, view.lookY ?? position.y, view.lookZ ?? 0)
    viewpoint = { position, forward: target.sub(position).normalize() }
  }
  rockSet = { meshes: geometries.map(surfaceMesh), viewpoint }
  rebuildSurfaces()
  return rockSet
}

// geometries: world-space BufferGeometries, one per reachable table coral. metas, one per
// geometry: { centre (Vector3, the plate's centre), underside, top (y of the plate's underside
// and top), radius, foot (Vector3, the stalk's foot) }.
export function setCoralSurfaces(geometries, metas) {
  coralSet = { meshes: geometries.map(surfaceMesh), metas }
  rebuildSurfaces()
  return coralSet
}

export function clearCoralSurfaces(owner) {
  if (coralSet !== owner) return
  coralSet = null
  rebuildSurfaces()
}

export function hasCoralSurfaces() {
  return surfaces !== null && (coralSet?.meshes.length ?? 0) > 0
}

// A random point in the middle of the resting view, 18 to 58 WU out and within 15% of the
// distance to either side (a 375 px phone sees about ±18% at 42°), low among the reef:
// somewhere for a reef fish to make its home where it will be seen. Returns null without a view.
export function pickViewHome(out, rand) {
  const viewpoint = surfaces?.viewpoint
  if (!viewpoint) return null
  const distance = 18 + rand() * 40
  segment.crossVectors(viewpoint.forward, UP)
  if (segment.lengthSq() < 1e-6) segment.set(1, 0, 0)
  segment.normalize()
  out.copy(viewpoint.position)
    .addScaledVector(viewpoint.forward, distance)
    .addScaledVector(segment, (rand() * 2 - 1) * distance * 0.15)
  out.y = -18 + rand() * 6
  return out
}

export function clearReefSurfaces(owner) {
  if (rockSet !== owner) return
  rockSet = null
  rebuildSurfaces()
}

export function hasReefSurfaces() {
  return surfaces !== null && surfaces.meshes.length > 0
}

// First rock surface along a ray (unit `direction`) within `far`: writes the hit point and its
// face normal and returns the distance, or -1 for a miss.
export function castReefRay(from, direction, far, outPoint = null, outNormal = null) {
  if (!surfaces) return -1
  raycaster.set(from, direction)
  raycaster.near = 0
  raycaster.far = far
  intersections.length = 0
  raycaster.intersectObjects(surfaces.meshes, false, intersections)
  const hit = intersections[0]
  if (!hit) return -1
  if (outPoint) outPoint.copy(hit.point)
  if (outNormal) outNormal.copy(hit.face.normal)
  return hit.distance
}

// Whether the straight line between two points misses every rock.
export function reefSegmentClear(from, to) {
  segment.subVectors(to, from)
  const length = segment.length()
  if (length < 1e-4) return true
  segment.divideScalar(length)
  return castReefRay(from, segment, length) < 0
}

// Share of rays from `point` that meet rock within `reach`: 0 in open water, toward 1 tucked in a
// nook under a ledge. The face itself (behind `normal`) is not counted.
function enclosureAt(point, normal, reach) {
  let hits = 0
  let total = 0
  for (const direction of RING) {
    if (direction.dot(normal) < -0.6) continue
    total += 1
    if (castReefRay(point, direction, reach) >= 0) hits += 1
  }
  for (const direction of OVERHEAD) {
    total += 1
    if (castReefRay(point, direction, reach) >= 0) hits += 1
  }
  return total > 0 ? hits / total : 0
}

// Room for the body round `point`: no rock within `clearance` sideways (bar the face it is
// resting on) or a little less above and below.
function roomToTurn(point, normal, clearance) {
  for (const direction of RING) {
    if (direction.dot(normal) < -0.6) continue
    if (castReefRay(point, direction, clearance) >= 0) return false
  }
  if (castReefRay(point, UP, clearance * 0.6) >= 0) return false
  if (castReefRay(point, DOWN, clearance * 0.6) >= 0) return false
  return true
}

function boxDistance(box, point) {
  const dx = Math.max(box.min.x - point.x, 0, point.x - box.max.x)
  const dy = Math.max(box.min.y - point.y, 0, point.y - box.max.y)
  const dz = Math.max(box.min.z - point.z, 0, point.z - box.max.z)
  return Math.hypot(dx, dy, dz)
}

/**
 * Find a reef site for one fish. Returns `out` filled in, `null` if no site was found, or
 * `false` if another fish already searched this frame (try again next frame).
 *
 * out: { point, normal, rest, entry } (Vector3s, filled in) and `enclosure` (0..1).
 * query:
 *   region      { xMin, xMax, yMin, yMax, zMin, zMax }: the box of the fish's swim volume
 *   contains    (point) => bool: exact test against the swim volume
 *   reachable   (point) => bool: the fish can swim to it (outside every padded steering shape);
 *               an entry point it cannot reach leaves it circling short of the site
 *   near, radius   prefer rocks within `radius` of `near` (its home), falling back to any
 *   from        where the fish is: most tries aim at the side of the rock facing it
 *   rand        seeded random
 *   standoff    centre's distance from the face at rest (WU)
 *   clearance   free room needed round the rest point (WU)
 *   entryDistance  how far out from the rest point the fish lines up before settling in (WU)
 *   normalY     [min, max] of the face normal's y: which faces suit (sides, gentle tops, undersides)
 *   minEnclosure   only nooks at least this enclosed; the most enclosed of the tries wins
 *   enclosureReach  how far the enclosure rays look (WU)
 *   force       search even if another fish already did this frame (spawning)
 *   viewBias    share of tries that come at the rock from the resting camera's side and keep
 *               only a rest point the camera can see (0 = ignore the view)
 *   kind        'rock' or 'coral': only surfaces of that kind (default: any)
 *   aim         at a coral: 'under' aims the ray below its plate, at the stalk or the rock behind
 *               it (hiding under the table, or between two tiers), 'rim' at the plate's edge
 *   requireCover  keep only rest points with a surface straight overhead within enclosureReach
 */
export function findReefSite(out, query) {
  if (!hasReefSurfaces()) return null
  // `force` skips the once-a-frame limit: placing the reef fish at their rocks as the tank opens.
  if (!query.force) {
    const clock = performance.now()
    if (clock - lastSearchAt < SEARCH_WINDOW_MS) return false
    lastSearchAt = clock
  }

  const { region, contains, reachable, near, radius, from, rand, standoff, clearance, entryDistance, normalY } = query
  const viewpoint = surfaces.viewpoint
  const viewBias = viewpoint ? query.viewBias ?? 0 : 0
  const minEnclosure = query.minEnclosure ?? 0
  const attempts = query.attempts ?? 8
  const { boxes, kinds, metas } = surfaces
  const kind = query.kind ?? null
  // Rocks that reach into the swim volume, near home if any are.
  candidates.length = 0
  for (let pass = 0; pass < 2 && candidates.length === 0; pass++) {
    for (let i = 0; i < boxes.length; i++) {
      if (kind && kinds[i] !== kind) continue
      const box = boxes[i]
      const reach = entryDistance + standoff
      if (box.max.x < region.xMin - reach || box.min.x > region.xMax + reach) continue
      if (box.max.z < region.zMin - reach || box.min.z > region.zMax + reach) continue
      if (box.max.y < region.yMin - standoff || box.min.y > region.yMax) continue
      if (pass === 0 && near && boxDistance(box, near) > radius) continue
      candidates.push(i)
    }
  }
  if (candidates.length === 0) return null

  let found = false
  let bestEnclosure = -1
  for (let attempt = 0; attempt < attempts; attempt++) {
    // The nearest of three rocks drawn at random, so most sites are a short swim away.
    let index = candidates[Math.floor(rand() * candidates.length)]
    if (from) {
      for (let draw = 0; draw < 2; draw++) {
        const other = candidates[Math.floor(rand() * candidates.length)]
        if (boxDistance(boxes[other], from) < boxDistance(boxes[index], from)) index = other
      }
    }
    const box = boxes[index]
    const plate = metas[index]
    box.getCenter(aim)
    box.getSize(half).multiplyScalar(0.5)
    // Aim at the rock inside the height band the fish can reach. Most tries go at the side
    // facing the fish (`from`), so the site is a short swim away on its own side of the rock;
    // the rest come at it from anywhere. At a coral, under its plate (from the foot to just
    // below the underside, at the stalk) or at the plate's rim.
    let yLow = Math.max(box.min.y, region.yMin)
    let yHigh = Math.min(box.max.y, region.yMax)
    if (plate && query.aim === 'under') {
      yHigh = Math.min(yHigh, plate.underside - 0.15)
      aim.x = plate.foot.x
      aim.z = plate.foot.z
      half.set(plate.radius * 0.3, half.y, plate.radius * 0.3)
    } else if (plate && query.aim === 'rim') {
      yLow = Math.max(yLow, plate.underside - 0.1)
      yHigh = Math.min(yHigh, plate.top + 0.1)
      aim.x = plate.centre.x
      aim.z = plate.centre.z
    }
    if (yHigh <= yLow) continue
    let angle = rand() * Math.PI * 2
    // Some tries face the camera: aim at the rock's side toward it, and see the site from it.
    const fromView = viewBias > 0 && rand() < viewBias
    // Under a table the ray keeps aiming at the stalk; only its approach turns toward the viewer.
    const keepAim = plate && query.aim === 'under'
    if (fromView) {
      if (!keepAim) {
        aim.x = THREE.MathUtils.clamp(viewpoint.position.x, box.min.x, box.max.x)
        aim.z = THREE.MathUtils.clamp(viewpoint.position.z, box.min.z, box.max.z)
      }
      angle = Math.atan2(viewpoint.position.z - aim.z, viewpoint.position.x - aim.x) + (rand() * 2 - 1) * Math.PI / 4
    } else if (from && rand() < 0.75) {
      if (!keepAim) {
        aim.x = THREE.MathUtils.clamp(from.x, box.min.x, box.max.x)
        aim.z = THREE.MathUtils.clamp(from.z, box.min.z, box.max.z)
      }
      angle = Math.atan2(from.z - aim.z, from.x - aim.x) + (rand() * 2 - 1) * Math.PI / 3
    }
    aim.x += (rand() * 2 - 1) * half.x * 0.5
    aim.z += (rand() * 2 - 1) * half.z * 0.5
    aim.y = yLow + rand() * (yHigh - yLow)
    rayDirection.set(Math.cos(angle), (rand() * 2 - 1) * 0.3, Math.sin(angle)).normalize()
    const lead = Math.max(half.x, half.z) + entryDistance + standoff
    origin.copy(aim).addScaledVector(rayDirection, lead)
    rayDirection.negate()
    if (castReefRay(origin, rayDirection, lead + Math.max(half.x, half.z), facePoint, faceNormal) < 0) continue
    // Square-on faces only, of the kind asked for.
    if (faceNormal.dot(rayDirection) > -0.35) continue
    if (faceNormal.y < normalY[0] || faceNormal.y > normalY[1]) continue
    rest.copy(facePoint).addScaledVector(faceNormal, standoff)
    if (!contains(rest)) continue
    // Nothing between the rest point and the face, and nothing closer behind it.
    rayDirection.copy(faceNormal).negate()
    const back = castReefRay(rest, rayDirection, standoff + 0.6)
    if (back < 0 || Math.abs(back - standoff) > 0.3) continue
    if (!roomToTurn(rest, faceNormal, clearance)) continue
    if (fromView) {
      segment.subVectors(rest, viewpoint.position)
      const sight = segment.length()
      segment.divideScalar(sight)
      if (castReefRay(viewpoint.position, segment, sight - 0.3) >= 0) continue
    }
    // Line up level with the face, out from the rest point, and come straight in.
    outward.set(faceNormal.x, 0, faceNormal.z)
    if (outward.lengthSq() < 0.04) continue
    outward.normalize()
    let entryOk = false
    for (const share of ENTRY_SHARES) {
      entry.copy(rest).addScaledVector(outward, entryDistance * share)
      if (!contains(entry)) continue
      if (reachable && !reachable(entry)) continue
      if (castReefRay(rest, outward, entryDistance * share) >= 0) continue
      entryOk = true
      break
    }
    if (!entryOk) continue
    // Hiding under a table: something (the plate) straight overhead.
    if (query.requireCover && castReefRay(rest, UP, query.enclosureReach ?? clearance * 4) < 0) continue
    const enclosure = minEnclosure > 0 ? enclosureAt(rest, faceNormal, query.enclosureReach ?? clearance * 4) : 0
    if (enclosure < minEnclosure || enclosure <= bestEnclosure) continue
    bestEnclosure = enclosure
    out.point.copy(facePoint)
    out.normal.copy(faceNormal)
    out.rest.copy(rest)
    out.entry.copy(entry)
    out.enclosure = enclosure
    found = true
    // Any good face will do for a hover or a peck; a shelter keeps looking for a deeper nook.
    if (minEnclosure <= 0) break
  }
  return found ? out : null
}
