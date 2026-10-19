import * as THREE from 'three'
import { sandHeight, seededRandom } from '../data/landscapes'
import { boundsOf, rockCaster } from './coralPlacement'

// Staghorn coral thickets (a landscape's `staghorn`, landscapes.js), placed once when the kit
// loads, against the rocks as drawn, like the table corals (coralPlacement.js).
//
// Staghorn grows in thickets: branches break off in storms, take root where they land, and grow
// into new colonies beside the old, so one thicket is mostly one clone and one colour. Jeremy
// chose (2026-10-20) thickets on the sand and low ledges at the foot of a few rocks, between the
// table clusters, which leave those rocks' crowns to the tables. So a thicket hugs one side of
// its rock, the side facing the resting camera most often: a band along the rock's foot, its
// biggest colonies in the middle and smaller ones toward its edges, each standing on the sand
// or on a ledge low on the rock. A colony is kept only if its branches stay out of the rock (a
// few tips may touch) and the sand, stand a little apart from the colonies already placed (they
// interlock, as in a real thicket), and stay under water.

const DOWN = new THREE.Vector3(0, -1, 0)
const ATTEMPTS_PER_COLONY = 40
// Largest tilt off upright (about 9°).
const MAX_TILT = 0.15
// Branch points tested against the rock and sand, and how many may touch the rock.
const SAMPLE_COUNT = 24
const INSIDE_ALLOWED = 3
// The lowest share of a colony's height, its base, may sit in the sand.
const BASE_SHARE = 0.2
// Least distance between two colonies' bases, in shares of their summed branch spreads: a
// third, so neighbours' branches interlock as in a real thicket.
const SPACING = 0.33
// A colony on a ledge only if the ledge is this low on its rock (share of the rock's height).
const LOW_LEDGE = 0.3
// Share of a thicket's colonies from the kit's big models.
const BIG_SHARE = 0.4
const YIELD_EVERY = 20

// Colony facts of a kit model from its distant mesh (model metres, base at the origin): height,
// horizontal radius about the base, and points spread over its branches.
export function measureColony(geometry) {
  geometry.computeBoundingBox()
  const height = geometry.boundingBox.max.y
  const position = geometry.attributes.position
  let radius = 0
  for (let i = 0; i < position.count; i++) radius = Math.max(radius, Math.hypot(position.getX(i), position.getZ(i)))
  // Every n-th vertex above the base, branch tips (the highest and widest) weighing most.
  const above = []
  for (let i = 0; i < position.count; i++) if (position.getY(i) > height * BASE_SHARE) above.push(i)
  above.sort((a, b) => (position.getY(b) + Math.hypot(position.getX(b), position.getZ(b)))
    - (position.getY(a) + Math.hypot(position.getX(a), position.getZ(a))))
  const samples = []
  for (let k = 0; k < SAMPLE_COUNT; k++) {
    // Half from the outermost fifth, half spread over the rest.
    const i = k < SAMPLE_COUNT / 2
      ? above[Math.floor(k * above.length / (SAMPLE_COUNT * 2.5))]
      : above[Math.floor((k - SAMPLE_COUNT / 2) * above.length / (SAMPLE_COUNT / 2))]
    samples.push(new THREE.Vector3().fromBufferAttribute(position, i))
  }
  return { height, radius, samples }
}

// The rocks to grow thickets at: up to `thickets` rocks standing `minHeight` WU out of the sand, within
// `maxDistance` WU of the resting camera and in front of it, at least `spacing` WU apart and
// `tableClear` WU clear of every rock the table corals crown (tableRoots), nearer rocks and
// rocks in view likelier. rocks: Map of bottom-piece seed → that rock's drawn geometries.
export function thicketSites(landscape, rocks, view, tableRoots) {
  const config = landscape.staghorn
  const camera = new THREE.Vector3(view?.x ?? 0, view?.y ?? 0, view?.z ?? 0)
  const forward = new THREE.Vector3(view?.lookX ?? camera.x, view?.lookY ?? camera.y, view?.lookZ ?? 0).sub(camera).normalize()
  const toRock = new THREE.Vector3()
  const tables = [...tableRoots].filter(root => rocks.has(root)).map(root => boundsOf(rocks.get(root)).expandByScalar(config.tableClear))
  const rand = seededRandom(config.seed)
  const candidates = []
  for (const root of [...rocks.keys()].sort((a, b) => a - b)) {
    // One draw per rock whether or not it is used, so adding a rock elsewhere keeps the rest.
    const draw = rand()
    if (tableRoots.has(root)) continue
    const bounds = boundsOf(rocks.get(root))
    const centre = bounds.getCenter(new THREE.Vector3())
    const distance = camera.distanceTo(centre)
    // Standing that high out of the sand: a boulder sunk to a pebble is no rock to grow by.
    if (bounds.max.y - sandHeight(landscape, centre.x, centre.z) < config.minHeight) continue
    if (distance > config.maxDistance) continue
    if (tables.some(box => box.intersectsBox(bounds))) continue
    const off = toRock.subVectors(centre, camera).normalize().angleTo(forward)
    if (off > 1.3) continue
    candidates.push({ root, bounds, centre, order: draw + 0.8 * distance / config.maxDistance + (off < 0.6 ? 0 : 0.6) })
  }
  candidates.sort((a, b) => a.order - b.order)
  const sites = []
  for (const candidate of candidates) {
    if (sites.length >= config.thickets) break
    if (sites.some(other => Math.hypot(other.centre.x - candidate.centre.x, other.centre.z - candidate.centre.z) < config.spacing)) continue
    sites.push(candidate)
  }
  // Each thicket's colonies are checked against every rock near it, not just its own.
  return sites.map(({ root, bounds, centre }) => {
    const reach = bounds.clone().expandByScalar(config.radius[1] * 2)
    const near = [...rocks.entries()].filter(([, geometries]) => boundsOf(geometries).intersectsBox(reach)).flatMap(([, geometries]) => geometries)
    return { root, bounds, centre, geometries: rocks.get(root), near, seed: config.seed * 7919 + root }
  })
}

// Placed staghorn colonies: [{ model, matrix, centre, obstacle }], with `obstacle` a piece box
// for rockObstacles.js. A generator, like placeCorals: it yields every few candidate spots and
// returns the colonies when done. measures are measureColony per kit model; view is the
// resting camera the thickets face.
export function* placeThickets(landscape, sites, measures, view) {
  const config = landscape.staghorn
  const { kit } = config
  const placed = []
  const origin = new THREE.Vector3()
  const point = new THREE.Vector3()
  const inward = new THREE.Vector3()
  for (const site of sites) {
    const own = rockCaster(site.geometries)
    const near = rockCaster(site.near)
    const { bounds, centre } = site
    const size = bounds.getSize(new THREE.Vector3())
    const rand = seededRandom(site.seed)
    const pick = ([min, max]) => min + rand() * (max - min)
    // The rock's foot on the side facing the camera, give or take: a ray in from outside, low
    // over the sand.
    const facing = view ? Math.atan2(view.z - centre.z, view.x - centre.x) : Math.PI / 2
    let foot = null
    let outward = 0
    for (let tries = 0; tries < 8 && !foot; tries++) {
      outward = facing + (rand() * 2 - 1) * 1.0
      inward.set(-Math.cos(outward), 0, -Math.sin(outward))
      origin.set(centre.x - inward.x * (size.x + size.z), 0, centre.z - inward.z * (size.x + size.z))
      // A low boulder can stand under 1 WU above the sand: aim at its lower half.
      const sandY = sandHeight(landscape, origin.x, origin.z)
      origin.y = sandY + THREE.MathUtils.clamp((bounds.max.y - sandY) * 0.4, 0.2, 1)
      foot = own.nearest(origin, inward, (size.x + size.z) * 2)
    }
    if (!foot) continue
    // The thicket: a band along the rock's foot, `radius` long either way and 0.7 of that deep,
    // standing out from the face so most of it is on the sand.
    const radius = pick(config.radius)
    const depth = radius * 0.7
    const along = new THREE.Vector3(-Math.sin(outward), 0, Math.cos(outward))
    const out = new THREE.Vector3(Math.cos(outward), 0, Math.sin(outward))
    const middle = foot.point.clone().addScaledVector(out, depth * 0.7)
    // Mostly one colour (one clone), a few of another drifted in.
    const colours = kit.colours
    const main = Math.floor(rand() * colours.length)
    const count = Math.round(pick(config.count))
    // The big colonies first, in the band's middle, then small ones round and between them.
    const bigCount = Math.round(count * BIG_SHARE)
    let kept = 0
    for (let attempt = 0; attempt < count * ATTEMPTS_PER_COLONY && kept < count; attempt++) {
      if (attempt % YIELD_EVERY === YIELD_EVERY - 1) yield
      // A point in the band, denser toward its middle.
      // (Small ones take over if the big ones run out of room.)
      const big = kept < bigCount && attempt < count * ATTEMPTS_PER_COLONY * 0.4
      const a = rand() * Math.PI * 2
      const r = Math.sqrt(rand()) * (big ? 0.6 : 1)
      const s = Math.cos(a) * r
      const t = Math.sin(a) * r
      origin.copy(middle).addScaledVector(along, s * radius).addScaledVector(out, t * depth)
      const sandY = sandHeight(landscape, origin.x, origin.z)
      origin.y = bounds.max.y + 2
      const hit = near.nearest(origin, DOWN, bounds.max.y + 2 - sandY + 1)
      let baseY = sandY
      if (hit && hit.point.y > sandY) {
        // On a ledge low on the rock, or not at all (a wall or the rock's top).
        if (hit.normal.y < 0.6 || hit.point.y - bounds.min.y > size.y * LOW_LEDGE) continue
        baseY = hit.point.y
      }
      // Smaller toward the band's edges.
      const edge = Math.hypot(s, t)
      const colour = rand() < config.mainShare ? main : Math.floor(rand() * colours.length)
      const model = colours[colour][big ? 0 : 1]
      const shape = measures[model]
      const scale = pick(config.scale) * (1.1 - 0.35 * edge)
      const sink = shape.height * scale * (0.06 + rand() * 0.08)
      const yaw = rand() * Math.PI * 2
      const rotation = new THREE.Quaternion().setFromEuler(new THREE.Euler((rand() * 2 - 1) * MAX_TILT, yaw, (rand() * 2 - 1) * MAX_TILT, 'YXZ'))
      const base = new THREE.Vector3(origin.x, baseY - sink, origin.z)
      const reach = shape.radius * scale
      if (placed.some(other => other.site === site.root
        && Math.hypot(other.base.x - base.x, other.base.z - base.z) < (other.reach + reach) * SPACING)) continue
      if (base.y + shape.height * scale > landscape.maxTop) continue
      const matrix = new THREE.Matrix4().compose(base, rotation, new THREE.Vector3(scale, scale, scale))
      let inside = 0
      let buried = false
      for (const sample of shape.samples) {
        point.copy(sample).applyMatrix4(matrix)
        if (point.y < sandHeight(landscape, point.x, point.z) + 0.1) {
          buried = true
          break
        }
        if (near.inside(point) && ++inside > INSIDE_ALLOWED) break
      }
      if (buried || inside > INSIDE_ALLOWED) continue
      const height = shape.height * scale
      placed.push({
        model,
        matrix,
        site: site.root,
        base,
        reach,
        centre: new THREE.Vector3(base.x, base.y + height / 2, base.z),
        // The colony as an obstacle box: its branches, a little inside their full spread.
        obstacle: { x: base.x, z: base.z, y: base.y, height, width: reach * 1.6, depth: reach * 1.6, yaw: 0 },
      })
      kept++
    }
  }
  return placed
}
