import * as THREE from 'three'
import { sandHeight, seededRandom } from '../data/landscapes'
import { boundsOf, rockCaster } from './coralPlacement'

// Staghorn coral (a landscape's `staghorn`, landscapes.js), placed once the table corals are
// (coralPlacement.js), against the rocks as drawn, on the same bommies as the tables.
//
// Jeremy (2026-10-20), after thickets on their own at rock feet looked "so sad and separate":
// staghorn and tables together, so each cluster reads as one bommie, as in his photos of
// staghorn fields with tables standing among them and of a staghorn thicket crowning a rock;
// and "same colour ones should cluster together, not a random scatter". Staghorn spreads by
// broken branches that root where they land, so a patch is one clone and one colour.
//
// So each table cluster also gets a few staghorn patches, each one colour, neighbouring patches
// in different colours: some on the rock's top and shoulders among the tables, some at its
// foot, spilling onto the sand, the side facing the resting camera most often. A patch's
// colonies stand on a ledge (a face pointing mostly up) or the sand near its centre, the big
// ones in its middle and smaller ones toward its edge. A colony is kept only if its branches
// stay out of the rock (a few tips may touch), the sand and every table's plate, stand a little
// apart from the colonies already placed (they interlock, as in a real thicket), and stay under
// water.

const DOWN = new THREE.Vector3(0, -1, 0)
const ATTEMPTS_PER_COLONY = 40
const ATTEMPTS_PER_PATCH = 40
// Largest tilt off upright (about 9°).
const MAX_TILT = 0.15
// Branch points tested against the rock, sand and plates, and how many may touch the rock or
// dip into the sand (on a slope a low branch tip does).
const SAMPLE_COUNT = 24
const INSIDE_ALLOWED = 3
const SAND_ALLOWED = 3
// The lowest share of a colony's height, its base, may sit in the sand.
const BASE_SHARE = 0.2
// Least distance between two colonies' bases, in shares of their summed branch spreads: under
// a quarter, so neighbours' branches interlock as in a real thicket.
const SPACING = 0.22
// Water kept between a colony's branches and a table's plate, in WU (5 cm).
const PLATE_CLEAR = 0.2
// A patch on the sand stands within this many WU of its rock's foot.
const SAND_REACH = 2.5
// A patch's colonies stand within this many WU (1 m) of its centre's height: a patch on a ledge
// does not run down a wall to the sand.
const PATCH_RISE = 4
// Share of a patch's colonies from the kit's big models.
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

// Whether a point is in a table's plate, or within PLATE_CLEAR of it. plates: the placed tables'
// `plate`s (coralPlacement.js placeCorals).
export function inPlate(plates, point) {
  for (const plate of plates) {
    if (Math.abs(point.y - plate.y) > plate.thickness / 2 + PLATE_CLEAR) continue
    if (Math.hypot(point.x - plate.x, point.z - plate.z) < plate.radius + PLATE_CLEAR) return true
  }
  return false
}

// Placed staghorn colonies: [{ model, matrix, site, patch, centre, obstacle }], with `site` the
// index of the cluster it grows in, `patch` the index of its patch over the whole landscape (a
// patch is one thicket to the reef fish, Landscape.jsx thicketReefSurfaces) and `obstacle` a
// piece box for rockObstacles.js. A generator, like
// placeCorals: it yields every few candidate spots and returns the colonies when done.
// clusters are coralClusters' (the bommies the tables crown); tables the placed tables;
// measures are measureColony per kit model; view is the resting camera. `avoid`, if given, says
// whether a point is taken by a coral placed before the staghorn (the sea fans, seaFanPlacement.js
// inFan).
export function* placeStaghorn(landscape, clusters, tables, measures, view, avoid = null) {
  const config = landscape.staghorn
  const { kit } = config
  const plates = tables.map(table => table.plate)
  const placed = []
  let patchIds = 0
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
    // A patch for about every `tablesPerPatch` tables, within `patches`; colours in a shuffled
    // order, so neighbouring patches differ.
    const patchCount = THREE.MathUtils.clamp(Math.round(cluster.count / config.tablesPerPatch), config.patches[0], config.patches[1])
    const order = kit.colours.map((_, i) => i)
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1))
      ;[order[i], order[j]] = [order[j], order[i]]
    }
    const patches = []
    for (let attempt = 0; attempt < patchCount * ATTEMPTS_PER_PATCH && patches.length < patchCount; attempt++) {
      if (attempt % YIELD_EVERY === YIELD_EVERY - 1) yield
      const radius = pick(config.patchRadius)
      // Most often on the side facing the camera; about a third at the rock's foot.
      const angle = facing + (rand() * 2 - 1) * (rand() < 0.7 ? 1.2 : Math.PI)
      const atFoot = rand() < config.footShare
      const reach = atFoot ? 0.85 + rand() * 0.35 : rand() * 0.8
      origin.set(centre.x + Math.cos(angle) * reach * size.x / 2, bounds.max.y + 2, centre.z + Math.sin(angle) * reach * size.z / 2)
      const sandY = sandHeight(landscape, origin.x, origin.z)
      const hit = rocks.nearest(origin, DOWN, bounds.max.y + 2 - sandY + 1)
      let y
      if (hit && hit.point.y > sandY) {
        if (hit.normal.y < 0.55) continue
        y = hit.point.y
      } else {
        // On the sand only right at the rock's foot.
        inward.set(centre.x - origin.x, 0, centre.z - origin.z).normalize()
        if (!rocks.nearest(point.set(origin.x, sandY + 0.5, origin.z), inward, SAND_REACH)) continue
        y = sandY
      }
      const at = new THREE.Vector3(origin.x, y, origin.z)
      if (patches.some(other => Math.hypot(other.at.x - at.x, other.at.z - at.z) < (other.radius + radius) * 0.8 && Math.abs(other.at.y - y) < PATCH_RISE)) continue
      patches.push({ at, radius, colour: order[patches.length % order.length], id: patchIds++ })
    }

    for (const patch of patches) {
      const count = Math.round(pick(config.perPatch))
      // The big colonies first, in the patch's middle, then small ones round and between them.
      const bigCount = Math.round(count * BIG_SHARE)
      let kept = 0
      for (let attempt = 0; attempt < count * ATTEMPTS_PER_COLONY && kept < count; attempt++) {
        if (attempt % YIELD_EVERY === YIELD_EVERY - 1) yield
        // (Small ones take over if the big ones run out of room.)
        const big = kept < bigCount && attempt < count * ATTEMPTS_PER_COLONY * 0.4
        const a = rand() * Math.PI * 2
        const edge = Math.sqrt(rand()) * (big ? 0.6 : 1)
        origin.set(patch.at.x + Math.cos(a) * edge * patch.radius, bounds.max.y + 2, patch.at.z + Math.sin(a) * edge * patch.radius)
        const sandY = sandHeight(landscape, origin.x, origin.z)
        const hit = rocks.nearest(origin, DOWN, bounds.max.y + 2 - sandY + 1)
        let baseY = sandY
        if (hit && hit.point.y > sandY) {
          // A ledge, not a wall or an overhang's underside.
          if (hit.normal.y < 0.45) continue
          baseY = hit.point.y
        }
        if (Math.abs(baseY - patch.at.y) > PATCH_RISE) continue
        const model = kit.colours[patch.colour][big ? 0 : 1]
        const shape = measures[model]
        // Smaller toward the patch's edge.
        const scale = pick(config.scale) * (1.1 - 0.35 * edge)
        const sink = shape.height * scale * (0.06 + rand() * 0.08)
        const yaw = rand() * Math.PI * 2
        const rotation = new THREE.Quaternion().setFromEuler(new THREE.Euler((rand() * 2 - 1) * MAX_TILT, yaw, (rand() * 2 - 1) * MAX_TILT, 'YXZ'))
        const base = new THREE.Vector3(origin.x, baseY - sink, origin.z)
        const reach = shape.radius * scale
        const height = shape.height * scale
        if (placed.some(other => other.site === site
          && Math.abs(other.base.y - base.y) < height
          && Math.hypot(other.base.x - base.x, other.base.z - base.z) < (other.reach + reach) * SPACING)) continue
        if (base.y + height > landscape.maxTop) continue
        const matrix = new THREE.Matrix4().compose(base, rotation, new THREE.Vector3(scale, scale, scale))
        let inside = 0
        let sand = 0
        let clash = false
        for (const sample of shape.samples) {
          point.copy(sample).applyMatrix4(matrix)
          if (inPlate(plates, point) || avoid?.(point) || (point.y < sandHeight(landscape, point.x, point.z) && ++sand > SAND_ALLOWED)) {
            clash = true
            break
          }
          if (rocks.inside(point) && ++inside > INSIDE_ALLOWED) break
        }
        if (clash || inside > INSIDE_ALLOWED) continue
        // The base too: not inside a table's plate (a colony standing on one).
        if (inPlate(plates, base) || avoid?.(base)) continue
        placed.push({
          model,
          matrix,
          site,
          patch: patch.id,
          base,
          reach,
          centre: new THREE.Vector3(base.x, base.y + height / 2, base.z),
          // The colony as an obstacle box: its branches, a little inside their full spread.
          obstacle: { x: base.x, z: base.z, y: base.y, height, width: reach * 1.6, depth: reach * 1.6, yaw: 0 },
        })
        kept++
      }
    }
  }
  return placed
}
