import * as THREE from 'three'
import { sandHeight, seededRandom } from '../data/landscapes'
import { boundsOf, rockCaster } from './coralPlacement'
import { inTable } from './seaFanPlacement'

// Leather corals (Sarcophyton glaucum; a landscape's `leatherCorals`, landscapes.js): toadstools of
// a smooth stalk under a wide folded cap, placed once the tables, sea fans, brain corals and
// cauliflower corals are, on the same bommies, and before the staghorn, which keeps clear of them
// (staghornPlacement.js `avoid`, inToadstool). The last coral for now (Jeremy, 2026-11-01): the
// bommies stay full, with room for every coral.
//
// A coral of calm reef flats, lagoons and the lower flanks of reefs, also in turbid water (Benayahu
// & Loya 1986, SeaLifeBase), so here each bommie gets a few on its low ledges, at its foot and on
// the rubble beside it, leaving the exposed tops to the tables, staghorn and cauliflower: one patch
// of one colour (`colour`, landscapes.js LEATHER_CORAL_KIT) a bommie, its colonies a loose group,
// most often on the side facing the resting camera. A colony stands upright, leant a little with
// its ledge, its stalk sunk a few centimetres. It is kept only if its stalk's foot is held up all
// round (no toadstool hangs off a ledge), its stalk and cap stay out of the rock and sand, out of
// every table (plate and stalk), the corals placed before it and the other toadstools, and under
// water. A spot that clashes tries the colony smaller (SHRINKS) before giving up.
//
// It sways in the surge like the sea fans (utils/coralSway.js, docs/procedural/coral-sway.md):
// along the landscape's current, `phase` from its position along it, so a fan and a toadstool side
// by side lean together.

const UP = new THREE.Vector3(0, 1, 0)
const DOWN = new THREE.Vector3(0, -1, 0)
const ATTEMPTS_PER_COLONY = 80
// Least share of up in a ledge a colony may stand on (about 45° from level at most).
const MIN_LEDGE_UP = 0.7
// How far a colony leans with its ledge (share of its tilt), and its largest lean (9°): a toadstool
// grows up toward the light whatever it stands on.
const LEAN_SHARE = 0.4
const MAX_LEAN = 0.15
// The stalk's foot sinks this share of the colony's height into the rock or sand.
const SINK = 0.04
// Points spread over the colony above its foot, tested against the rock, sand, tables, the corals
// placed before it and the other toadstools; how many may touch the rock or sand. Points below
// BASE_SHARE of its height are its foot. The cap (CAP_SHARE and up) may touch nothing.
const SAMPLE_COUNT = 40
const BASE_SHARE = 0.12
const CAP_SHARE = 0.5
const INSIDE_ALLOWED = 2
// Points round the stalk's foot, and how many must have rock or sand just under them.
const RIM_POINTS = 8
const RIM_SUPPORTED = 7
// How far under the foot support is looked for, in WU (5 cm).
const RIM_DEPTH = 0.2
// A colony on the sand stands within this many WU (1.5 m) of its rock's foot.
const SAND_REACH = 6
// The sizes a spot tries, as shares of the colony drawn for it, biggest first.
const SHRINKS = [1, 0.8, 0.6]
// Least distance between two colonies' stalks, in shares of their summed cap reaches: caps may
// overlap a little in plan where heights differ, as in a real patch.
const SPACING = 0.8
// Water kept round a colony by the corals placed after it (inToadstool), in WU (5 cm).
const TOADSTOOL_CLEAR = 0.2
const YIELD_EVERY = 20

// Colony facts of a kit model from its parts' geometries (model metres, the holdfast at (0, 0, 0),
// +Y up): height, the cap's reach about the holdfast, the stalk's foot radius, and points spread
// over the colony above its foot.
export function measureToadstool(geometries) {
  let height = 0
  for (const geometry of geometries) {
    geometry.computeBoundingBox()
    height = Math.max(height, geometry.boundingBox.max.y)
  }
  let reach = 0
  let footRadius = 0
  const above = []
  for (const geometry of geometries) {
    const position = geometry.attributes.position
    for (let i = 0; i < position.count; i++) {
      const y = position.getY(i)
      const r = Math.hypot(position.getX(i), position.getZ(i))
      reach = Math.max(reach, r)
      if (y < height * 0.08) footRadius = Math.max(footRadius, r)
      if (y > height * BASE_SHARE) above.push(new THREE.Vector3(position.getX(i), y, position.getZ(i)))
    }
  }
  // Spread by height so the cap and the stalk both get points.
  above.sort((a, b) => a.y - b.y)
  const samples = []
  for (let k = 0; k < SAMPLE_COUNT && above.length; k++) samples.push(above[Math.floor((k + 0.5) * above.length / SAMPLE_COUNT)])
  return { height, reach, footRadius: footRadius || reach * 0.3, samples }
}

// Whether a point is under a placed colony's cap or in its stalk, or within TOADSTOOL_CLEAR plus
// `extra` WU of it, for the corals placed after the leather corals (staghornPlacement.js): the
// colony is taken as an upright cylinder of its cap's reach, from its foot to its top, plus the
// cap's swing.
export function inToadstool(toadstools, point, extra = 0) {
  for (const toadstool of toadstools) {
    const margin = TOADSTOOL_CLEAR + toadstool.swing + extra
    const dy = point.y - toadstool.base.y
    if (dy < -margin || dy > toadstool.height + margin) continue
    if (Math.hypot(point.x - toadstool.base.x, point.z - toadstool.base.z) < toadstool.reach + margin) return true
  }
  return false
}

// Placed leather corals: [{ model, matrix, site, base, reach, height, centre, top, phase, swing,
// obstacle }], with `site` the index of the cluster it grows in, `phase` its sway's, `swing` its
// cap's sway either way in WU and `obstacle` a piece box for rockObstacles.js. A generator, like
// placeCorals: it yields every few candidate spots and returns the colonies when done. clusters are
// coralClusters' (the bommies the tables crown); tables the placed tables; measures are
// measureToadstool per kit model; view is the resting camera. `avoid(point, extra)`, if given, says
// whether a point is taken by a coral placed before the leather corals other than the tables.
export function* placeLeatherCorals(landscape, clusters, tables, measures, view, avoid = null) {
  const config = landscape.leatherCorals
  const { kit, sway } = config
  const plates = tables.map(table => table.plate)
  const tableFeet = tables.map(table => ({ plate: table.plate, foot: new THREE.Vector3().setFromMatrixPosition(table.matrix) }))
  const current = new THREE.Vector3(config.current[0], 0, config.current[1]).normalize()
  // The kit's colours, and the models of each.
  const colours = [...new Set(kit.models.flatMap(model => model.colours))]
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
    // This bommie's patch: one colour, its colonies within patchSpread radians round the rock.
    const colour = colours[Math.floor(rand() * colours.length)]
    const models = kit.models.map((model, i) => (model.colours.includes(colour) ? i : -1)).filter(i => i >= 0)
    const patchAngle = facing + (rand() * 2 - 1) * (rand() < 0.7 ? 1 : Math.PI)
    // The highest a colony may stand on the rock: the low ledges only.
    const ledgeTop = bounds.min.y + size.y * config.lowShare
    const ownColonies = []
    // Whether a colony placed by `matrix` (its foot at `base`) is clear: its stalk and cap out of
    // the tables, the corals placed before it, the other colonies and (bar a few stalk points) the
    // rock and sand; and its foot held up all round.
    const fits = (shape, matrix, base, colony) => {
      let inside = 0
      for (const sample of shape.samples) {
        point.copy(sample).applyMatrix4(matrix)
        if (inTable(tableFeet, plates, point) || avoid?.(point) || inToadstool(placed, point)) return false
        const cap = sample.y > shape.height * CAP_SHARE
        if (point.y < sandHeight(landscape, point.x, point.z) || rocks.inside(point)) {
          if (cap || ++inside > INSIDE_ALLOWED) return false
        }
      }
      let supported = 0
      for (let k = 0; k < RIM_POINTS; k++) {
        const a = k * Math.PI * 2 / RIM_POINTS
        point.set(Math.cos(a) * shape.footRadius * 0.85, 0, Math.sin(a) * shape.footRadius * 0.85).applyMatrix4(matrix)
        point.y -= RIM_DEPTH
        if (point.y < sandHeight(landscape, point.x, point.z) || rocks.inside(point)) supported++
      }
      return supported >= RIM_SUPPORTED && base.y + colony.height <= landscape.maxTop
    }
    const count = Math.round(pick(config.perCluster))
    for (let attempt = 0; attempt < count * ATTEMPTS_PER_COLONY && ownColonies.length < count; attempt++) {
      if (attempt % YIELD_EVERY === YIELD_EVERY - 1) yield
      // Round the patch's side of the rock; footShare of them on the sand or rubble at its foot.
      const angle = patchAngle + (rand() * 2 - 1) * config.patchSpread
      const atFoot = rand() < config.footShare
      const reach = atFoot ? 0.85 + rand() * 0.4 : 0.4 + rand() * 0.6
      origin.set(centre.x + Math.cos(angle) * reach * size.x / 2, bounds.max.y + 2, centre.z + Math.sin(angle) * reach * size.z / 2)
      const sandY = sandHeight(landscape, origin.x, origin.z)
      const hit = rocks.nearest(origin, DOWN, bounds.max.y + 2 - sandY + 1)
      let y
      let normal = UP
      if (hit && hit.point.y > sandY) {
        if (hit.normal.y < MIN_LEDGE_UP || hit.point.y > ledgeTop) continue
        y = hit.point.y
        normal = hit.normal.normalize()
      } else {
        // On the sand only right at the rock's foot.
        inward.set(centre.x - origin.x, 0, centre.z - origin.z).normalize()
        if (!rocks.nearest(point.set(origin.x, sandY + 0.5, origin.z), inward, SAND_REACH)) continue
        y = sandY
      }
      const model = models[Math.floor(rand() * models.length)]
      const shape = measures[model]
      const drawn = pick(config.height)
      lean.copy(UP).lerp(normal, LEAN_SHARE).normalize()
      const tilt = Math.min(lean.angleTo(UP), MAX_LEAN)
      axis.crossVectors(UP, lean)
      const rotation = new THREE.Quaternion()
      if (axis.lengthSq() > 1e-8) rotation.setFromAxisAngle(axis.normalize(), tilt)
      rotation.multiply(new THREE.Quaternion().setFromAxisAngle(UP, rand() * Math.PI * 2))
      let fit = null
      for (const shrink of SHRINKS) {
        const scale = drawn * shrink / shape.height
        const colony = { height: shape.height * scale, reach: shape.reach * scale }
        const base = new THREE.Vector3(origin.x, y - colony.height * SINK, origin.z)
        if (placed.some(other => Math.abs(other.base.y - base.y) < Math.max(other.height, colony.height)
          && Math.hypot(other.base.x - base.x, other.base.z - base.z) < (other.reach + colony.reach) * SPACING)) continue
        const matrix = new THREE.Matrix4().compose(base, rotation, new THREE.Vector3(scale, scale, scale))
        if (fits(shape, matrix, base, colony)) {
          fit = { matrix, base, ...colony }
          break
        }
      }
      if (!fit) continue
      const { matrix, base, height, reach: colonyReach } = fit
      const colony = {
        model,
        matrix,
        site,
        base,
        reach: colonyReach,
        height,
        centre: new THREE.Vector3(base.x, base.y + height / 2, base.z),
        top: base.y + height,
        // Along the current, so the surge passes through the reef as a wave, plus a little jitter.
        phase: base.dot(current) * 0.35 + rand() * 0.8,
        swing: sway.bend * height,
        // The colony as an obstacle box: its cap, a little inside its full spread, down to its foot.
        obstacle: { x: base.x, z: base.z, y: base.y, height, width: colonyReach * 1.6, depth: colonyReach * 1.6, yaw: 0 },
      }
      placed.push(colony)
      ownColonies.push(colony)
    }
  }
  return placed
}
