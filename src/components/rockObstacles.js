import * as THREE from 'three'

// Rock obstacles for fish steering: every placed landscape rock (src/data/landscapes.js) as an
// ellipsoid fitted to its box, in a static grid over x/z. Environment publishes the active
// tank's rocks on mount and clears them on unmount; with none published (The Open Sea) every
// query returns at once.
//
// Fish use it at three points of the unified pipeline (Fish.jsx):
//   steer  — steerAroundRocks probes ahead along the heading and bends the desired heading
//            along the rocks' surfaces and away from them, returning an urgency that raises the
//            turn rate (the same idea as boundaryAvoidanceTurnStep for the swim walls)
//   clamp  — pushOutOfRocks moves a fish that still ended up inside a rock (plus a body pad)
//            back to the surface and returns the surface normal so its heading can slide; at
//            a pinch between two rocks it slides the fish along both faces or holds it instead
//            (pinchedLastPush tells the caller)
//   target — nudgeOutOfRocks moves a roaming, school or bask target out of any rock
//
// The ellipsoid is inscribed in the piece's box, which every kit rock fills or (when shrunk
// to fit) undershoots, so the proxy is close to the rock without hugging its facets. Pads
// scale with body length, so the 3.3 m sunfish keeps its whole body clear, not just its centre.

const GRID_CELL = 12
// Floats per obstacle: centre x, y, z; radii x, y, z (piece axes); cos and sin of its yaw.
const STRIDE = 8
// pushOutOfRocks: how far inside a pad (as deepestHit measures it) still counts as on its
// surface, and the cosine past which two faces it is pushed off in turn make a wedge.
const OVERLAP_CLEAR = 0.002
const WEDGE_DOT = -0.25
// steerAroundRocks: where along its reach the probe looks for a rock ahead.
const PROBE_STEPS = [0.2, 0.45, 0.7, 1]
const NO_PROBE_STEPS = []
// The probe feels a rock across a band about this wide (radians, as seen from the fish) around
// its padded outline: from nothing just outside to full strength just inside.
const PROBE_FEEL_ANGLE = 0.15
// Within this share of a pad's padded half-height of its middle, the fish counts as on neither
// side of it, and the probe's push off it is level (see feltHit).
const SIDE_BAND = 0.25
// The probe's push off a pad has at least this much of its padded half-height in its vertical
// part (toward the fish's side): in a thin table's middle the gradient is level, and the bend
// slid the fish along its own heading, up or down through the table. A tall rock's push stays
// nearly level there.
const SIDE_FLOOR = 0.5
// The push off a rock the fish is brushing comes on over this much depth (as summedHit measures it).
const TOUCH_ONSET = 0.1

let field = null
// Set by pushOutOfRocks, read back with pinchedLastPush.
let pinched = false

const local = new THREE.Vector3()
const probe = new THREE.Vector3()
const gradient = new THREE.Vector3()
const other = new THREE.Vector3()
const step = new THREE.Vector3()
const crease = new THREE.Vector3()
const normal = new THREE.Vector3()
const tangent = new THREE.Vector3()
const avoid = new THREE.Vector3()
const UP = new THREE.Vector3(0, 1, 0)

function cellKey(cx, cz) {
  return cx * 73856093 ^ cz * 19349663
}

// Two sources share the field: the tank's rocks (Environment, from the seeded layout, before
// the first frame) and extra obstacles that only exist once a model has loaded, such as the
// table corals and staghorn thickets (Landscape.jsx, placed against the drawn rocks). Any of
// them can change or clear without the others; the field is rebuilt from all of them.
let rocks = null
const extras = new Set()

function buildField() {
  if (!rocks) {
    field = null
    return
  }
  const { region, floorTop, maxPad } = rocks.options
  const kept = [...rocks.pieces, ...[...extras].flatMap(extra => extra.pieces)].filter(piece => piece.y + piece.height > floorTop
    && piece.x + piece.width > region.xMin && piece.x - piece.width < region.xMax
    && piece.z + piece.depth > region.zMin && piece.z - piece.depth < region.zMax)
  const data = new Float32Array(kept.length * STRIDE)
  const grid = new Map()
  kept.forEach((piece, i) => {
    const o = i * STRIDE
    data[o] = piece.x
    data[o + 1] = piece.y + piece.height / 2
    data[o + 2] = piece.z
    data[o + 3] = piece.width / 2
    data[o + 4] = piece.height / 2
    data[o + 5] = piece.depth / 2
    data[o + 6] = Math.cos(piece.yaw)
    data[o + 7] = Math.sin(piece.yaw)
    // Register in every cell its padded footprint touches.
    const r = Math.max(piece.width, piece.depth) / 2 + maxPad
    for (let cx = Math.floor((piece.x - r) / GRID_CELL); cx <= Math.floor((piece.x + r) / GRID_CELL); cx++) {
      for (let cz = Math.floor((piece.z - r) / GRID_CELL); cz <= Math.floor((piece.z + r) / GRID_CELL); cz++) {
        const key = cellKey(cx, cz)
        if (!grid.has(key)) grid.set(key, [])
        grid.get(key).push(i)
      }
    }
  })
  field = { data, grid, count: kept.length, maxPad }
}

// pieces: placed landscape pieces ({ x, y, z, width, height, depth, yaw }). `options.region`
// and `options.floorTop` keep only rocks a fish can come near (anything below `floorTop` or
// outside `region` is skipped); `options.maxPad` is the largest body pad.
export function setRockObstacles(pieces, options) {
  rocks = { pieces, options }
  buildField()
  return rocks
}

export function clearRockObstacles(owner) {
  if (rocks !== owner) return
  rocks = null
  buildField()
}

// Extra obstacles in the same piece form, filtered with the rocks' options. Each call adds a
// set, cleared on its own by the owner it returns.
export function setExtraObstacles(pieces) {
  const owner = { pieces }
  extras.add(owner)
  buildField()
  return owner
}

export function clearExtraObstacles(owner) {
  if (!extras.delete(owner)) return
  buildField()
}

// The sand as an obstacle too (a landscape's dunes and hills rise above its mean level, and The
// Reefs' reef fish swim low enough to meet them at the front). Environment publishes the sand
// height function and the highest it gets anywhere a fish swims (`top`), so fish well clear of
// the sand never pay for a lookup.
let seabed = null

export function setSeabed(height, top) {
  seabed = { height, top }
  return seabed
}

export function clearSeabed(owner) {
  if (seabed === owner) seabed = null
}

// Sand height under a point, or -Infinity with no landscape.
export function seabedHeightAt(x, z) {
  return seabed ? seabed.height(x, z) : -Infinity
}

// Clamp: keeps `position` at least `pad` above the sand. Returns whether it lifted it.
export function liftAboveSeabed(position, pad) {
  if (!seabed || position.y > seabed.top + pad) return false
  const floor = seabed.height(position.x, position.z) + pad
  if (position.y >= floor) return false
  position.y = floor
  return true
}

export function hasRockObstacles() {
  return field !== null && field.count > 0
}

// Deepest padded rock containing `point`: writes its outward surface normal to `outNormal` and
// the point radially projected onto its padded surface to `outSurface`, and returns how far
// inside it is (0..1, 1 at the centre). Returns 0 when the point is clear.
//
// Above `floorY` (the bottom of the fish's swim volume) the surface point never drops below it:
// where the radial one would, the point moves out level instead, across the rock's section at
// its own height, and the normal is that section's (level) normal.
function deepestHit(point, pad, outNormal, outSurface, floorY = -Infinity) {
  const indices = field.grid.get(cellKey(Math.floor(point.x / GRID_CELL), Math.floor(point.z / GRID_CELL)))
  if (!indices) return 0
  const { data } = field
  let best = 0
  let bestIndex = -1
  for (const i of indices) {
    const o = i * STRIDE
    const rx = data[o + 3] + pad
    const ry = data[o + 4] + pad
    const rz = data[o + 5] + pad
    const dx = point.x - data[o]
    const dy = point.y - data[o + 1]
    const dz = point.z - data[o + 2]
    // Into the piece's yawed frame (inverse of rotateY(yaw)).
    const c = data[o + 6]
    const s = data[o + 7]
    const lx = c * dx - s * dz
    const lz = s * dx + c * dz
    const f = Math.sqrt((lx / rx) ** 2 + (dy / ry) ** 2 + (lz / rz) ** 2)
    if (f >= 1) continue
    const depth = 1 - f
    if (depth <= best) continue
    best = depth
    bestIndex = i
  }
  if (bestIndex < 0 || (!outNormal && !outSurface)) return best
  const o = bestIndex * STRIDE
  const rx = data[o + 3] + pad
  const ry = data[o + 4] + pad
  const rz = data[o + 5] + pad
  const dx = point.x - data[o]
  const dy = point.y - data[o + 1]
  const dz = point.z - data[o + 2]
  const c = data[o + 6]
  const s = data[o + 7]
  const lx = c * dx - s * dz
  const lz = s * dx + c * dz
  const f = 1 - best
  // Level push: the section at this height is an ellipse; scale the point's offset from the
  // rock's axis out onto it. Not for a point on the axis itself (no level way out).
  const across = (lx / rx) ** 2 + (lz / rz) ** 2
  const level = data[o + 1] + dy / Math.max(f, 1e-3) < floorY && point.y >= floorY - 1e-3 && across > 1e-6
  // Gradient of the ellipsoid in its frame, back to world.
  local.set(lx / (rx * rx), level ? 0 : dy / (ry * ry), lz / (rz * rz))
  if (outNormal) {
    outNormal.set(c * local.x + s * local.z, local.y, -s * local.x + c * local.z)
    if (outNormal.lengthSq() < 1e-9) outNormal.set(0, 1, 0)
    outNormal.normalize()
  }
  if (outSurface) {
    if (level) {
      const k = Math.sqrt(Math.max(0, 1 - (dy / ry) ** 2) / across)
      outSurface.set(data[o] + dx * k, point.y, data[o + 2] + dz * k)
    } else {
      const k = 1 / Math.max(f, 1e-3)
      outSurface.set(data[o] + dx * k, data[o + 1] + dy * k, data[o + 2] + dz * k)
    }
  }
  return best
}

// Like deepestHit, for steering: where pads overlap (rocks closer together than the body's
// pads), the normal is the depth-weighted sum of every pad containing `point`, not the deepest
// one's alone. In the overlap the deepest flips from one rock to the other as the heading
// swings, and a fish bent toward each in turn, its heading flicking every frame; the sum points
// out of the gap. With one pad it is that pad's normal.
function summedHit(point, pad, outNormal) {
  const indices = field.grid.get(cellKey(Math.floor(point.x / GRID_CELL), Math.floor(point.z / GRID_CELL)))
  if (!indices) return 0
  const { data } = field
  let best = 0
  outNormal.set(0, 0, 0)
  for (const i of indices) {
    const o = i * STRIDE
    const rx = data[o + 3] + pad
    const ry = data[o + 4] + pad
    const rz = data[o + 5] + pad
    const dx = point.x - data[o]
    const dy = point.y - data[o + 1]
    const dz = point.z - data[o + 2]
    const c = data[o + 6]
    const s = data[o + 7]
    const lx = c * dx - s * dz
    const lz = s * dx + c * dz
    const f = Math.sqrt((lx / rx) ** 2 + (dy / ry) ** 2 + (lz / rz) ** 2)
    if (f >= 1) continue
    const depth = 1 - f
    if (depth > best) best = depth
    local.set(lx / (rx * rx), dy / (ry * ry), lz / (rz * rz))
    gradient.set(c * local.x + s * local.z, local.y, -s * local.x + c * local.z)
    const length = gradient.length()
    if (length > 1e-9) outNormal.addScaledVector(gradient, depth / length)
  }
  if (best > 0) {
    if (outNormal.lengthSq() < 1e-9) outNormal.set(0, 1, 0)
    outNormal.normalize()
  }
  return best
}

// Like summedHit, for the probe ahead, but continuous: a pad counts from `band` WU outside its
// padded surface, ramping to full strength `band` inside, so the bend fades to nothing at a
// rock's outline instead of switching on the frame the probe crosses it. Each pad's normal is
// weighted by its ramp, and its vertical part points to the fish's side of the pad's middle
// (`from`), not the probe's: across a thin coral table's middle the probe's own side flips
// between up and down every frame it crosses. Returns the strongest ramp (0 clear, up to 1) and
// writes the summed direction (not normalized) to `outNormal`; `feltDepth` is how far inside the
// deepest pad the point is (as deepestHit measures it, 0 when outside all).
let feltDepth = 0
function feltHit(point, pad, band, from, outNormal) {
  outNormal.set(0, 0, 0)
  feltDepth = 0
  const indices = field.grid.get(cellKey(Math.floor(point.x / GRID_CELL), Math.floor(point.z / GRID_CELL)))
  if (!indices) return 0
  const { data } = field
  let strongest = 0
  for (const i of indices) {
    const o = i * STRIDE
    const rx = data[o + 3] + pad
    const ry = data[o + 4] + pad
    const rz = data[o + 5] + pad
    const dx = point.x - data[o]
    const dy = point.y - data[o + 1]
    const dz = point.z - data[o + 2]
    const c = data[o + 6]
    const s = data[o + 7]
    const lx = c * dx - s * dz
    const lz = s * dx + c * dz
    const f = Math.sqrt((lx / rx) ** 2 + (dy / ry) ** 2 + (lz / rz) ** 2)
    // How far outside the padded surface (negative inside), along the line from its middle.
    const distance = Math.sqrt(dx * dx + dy * dy + dz * dz)
    const outside = f > 1e-6 ? distance - distance / f : -Math.min(rx, ry, rz)
    if (outside >= band) continue
    const ramp = Math.min(1, (band - outside) / (2 * band))
    if (ramp > strongest) strongest = ramp
    if (1 - f > feltDepth) feltDepth = 1 - f
    const side = THREE.MathUtils.clamp((from.y - data[o + 1]) / (SIDE_BAND * ry), -1, 1)
    local.set(lx / (rx * rx), Math.max(Math.abs(dy), SIDE_FLOOR * ry) / (ry * ry) * side, lz / (rz * rz))
    gradient.set(c * local.x + s * local.z, local.y, -s * local.x + c * local.z)
    if (gradient.lengthSq() < 1e-12) gradient.set(from.x - data[o], 0, from.z - data[o + 2])
    const length = gradient.length()
    if (length > 1e-9) outNormal.addScaledVector(gradient, ramp / length)
  }
  return strongest
}

export function rockPad(bodyLength) {
  return bodyLength * 0.35 + 0.3
}

// Bends `desired` (unit, edited in place) around the rocks ahead along `forward`. Probes out to
// a few body lengths or about a second and a half of travel; the nearer and deeper the probe
// meets a rock, the stronger the turn. The probe feels each rock gradually across its outline
// (feltHit): a bend that switched on in full as the probe touched the padding and off as it
// left made a fish skimming a rock flick its heading 2° to 5° every frame, the probe tip landing
// in and out of the padding on alternate frames. Returns the urgency (0 clear, up to 1) for the
// turn-rate boost.
//
// `lookAhead` false skips the probe and keeps only the push off rocks it is brushing: for a fish
// held at a pinch (pushOutOfRocks), which is not going anywhere, and whose probe, ahead into the
// gap, would only slide it on along the gap.
export function steerAroundRocks(desired, position, forward, bodyLength, speed, lookAhead = true) {
  if (!hasRockObstacles()) return 0
  const pad = rockPad(bodyLength)
  const reach = Math.max(bodyLength * 3, speed * 1.5, 3) + pad
  // SHIVER-DIAG: the old probe for the A/B
  if (globalThis.__shiverFix === false) {
    let u = 0
    for (const t of lookAhead ? PROBE_STEPS : NO_PROBE_STEPS) {
      probe.copy(position).addScaledVector(forward, reach * t)
      const depth = summedHit(probe, pad, normal)
      if (depth <= 0) continue
      tangent.copy(forward).addScaledVector(normal, -forward.dot(normal))
      if (tangent.lengthSq() < 0.04) {
        tangent.crossVectors(UP, normal)
        if (tangent.dot(desired) < 0) tangent.negate()
      }
      tangent.normalize()
      u = Math.min(1, (1 - t) * 0.8 + depth * 0.6 + 0.2)
      avoid.copy(tangent).addScaledVector(normal, 0.6).multiplyScalar(2.5 * u)
      desired.add(avoid)
      break
    }
    const touchingOld = summedHit(position, pad * 1.25, normal)
    if (touchingOld > 0) {
      desired.addScaledVector(normal, 1.5 * touchingOld + 0.5)
      u = Math.max(u, 0.6)
    }
    if (desired.lengthSq() > 1e-6) desired.normalize()
    return u
  }
  let urgency = 0
  let weight = 0
  avoid.set(0, 0, 0)
  for (const t of lookAhead ? PROBE_STEPS : NO_PROBE_STEPS) {
    probe.copy(position).addScaledVector(forward, reach * t)
    const strength = feltHit(probe, pad, PROBE_FEEL_ANGLE * reach * t / 2, position, normal)
    if (strength <= 0 || normal.lengthSq() < 1e-12) continue
    normal.normalize()
    // Slide along the surface: drop the into-rock part of the heading. Head-on, pick the
    // side the desired heading already leans to, or turn right by default.
    tangent.copy(forward).addScaledVector(normal, -forward.dot(normal))
    if (tangent.lengthSq() < 0.04) {
      tangent.crossVectors(UP, normal)
      if (tangent.dot(desired) < 0) tangent.negate()
    }
    tangent.normalize()
    const stepUrgency = Math.min(1, strength * ((1 - t) * 0.8 + 0.2) + feltDepth * 0.6)
    // Every point that feels a rock bends the heading, weighted so the most urgent leads: taking
    // only the nearest, the bend jumped as the nearest hit moved from one point to the next.
    const w = stepUrgency * stepUrgency
    avoid.addScaledVector(tangent, w).addScaledVector(normal, 0.6 * w)
    weight += w
    urgency = Math.max(urgency, stepUrgency)
  }
  if (weight > 0) desired.addScaledVector(avoid, 2.5 * urgency / weight)
  // Already brushing a rock: push straight off it as well, coming on over the first of the padding.
  const touching = summedHit(position, pad * 1.25, normal)
  if (touching > 0) {
    const onset = Math.min(1, touching / TOUCH_ONSET)
    desired.addScaledVector(normal, 1.5 * touching + 0.5 * onset)
    urgency = Math.max(urgency, 0.6 * onset)
  }
  if (desired.lengthSq() > 1e-6) desired.normalize()
  return urgency
}

// Clamp: moves `position` out to the padded surface of any rock it is inside. Returns the
// outward normal (shared vector, valid until the next call) or null when clear or held.
//
// `from` is where the fish started the frame, `floorY` the bottom of its swim volume and
// `lastNormal` the face it was last pushed off (null when that was a while ago): at a pinch the
// fish slides on from `from`, or is held there (see below).
export function pushOutOfRocks(position, bodyLength, from = null, floorY = -Infinity, lastNormal = null) {
  pinched = false
  if (!hasRockObstacles()) return null
  const pad = rockPad(bodyLength)
  const depth = deepestHit(position, pad, normal, probe, floorY)
  if (depth <= 0) return null
  // A wedge: pushed off a face turned more than about 105° from the one it was pushed off last.
  const wedged = lastNormal !== null && normal.dot(lastNormal) < WEDGE_DOT
  if (!wedged && deepestHit(probe, pad, null, null) <= OVERLAP_CLEAR) {
    position.copy(probe)
    return normal
  }
  // A pinch: two pads overlap here (rocks closer together than the body needs, as at the foot
  // of the front bommies at The Reefs), so out of one is into the other, or they meet in a
  // wedge, so out of one face is into the other next frame. Pushed out of each in turn, the fish
  // flicked between the two every frame, and its heading, slid along each face in turn, was
  // held where it pointed. Instead it takes only the part of its step that goes into neither
  // face (along the crease between them, where it goes into both), so it slides along a gap or
  // out of one where it can, and stays where it started the frame where it cannot; its heading
  // is left to its own steering. A fish that started inside (just off a reef site in a nook) is
  // still pushed out of the deeper pad a frame at a time, its heading sliding along that face,
  // as before: left alone, it pressed on into the padding and came out in bigger jumps.
  if (from && deepestHit(from, pad, null, null) <= OVERLAP_CLEAR) {
    pinched = true
    // The other face: the second pad's at the pushed point, or in a wedge the last one.
    if (wedged) other.copy(lastNormal)
    else deepestHit(probe, pad, other, null)
    step.subVectors(position, from)
    const intoFirst = step.dot(normal)
    if (intoFirst < 0) step.addScaledVector(normal, -intoFirst)
    const intoOther = step.dot(other)
    if (intoOther < 0) {
      crease.crossVectors(normal, other)
      if (crease.lengthSq() > 1e-6) step.projectOnVector(crease)
      else step.addScaledVector(other, -intoOther)
    }
    probe.copy(from).add(step)
    if (probe.y < floorY) probe.y = floorY
    position.copy(deepestHit(probe, pad, null, null) <= OVERLAP_CLEAR ? probe : from)
    return null
  }
  position.copy(probe)
  return normal
}

// Whether the last pushOutOfRocks call met a pinch (and slid the fish on from `from`, or held it
// there).
export function pinchedLastPush() {
  return pinched
}

// Targets: whether a candidate falls inside a rock (padded generously for the body).
export function insideRock(point, bodyLength) {
  if (!hasRockObstacles()) return false
  return deepestHit(point, rockPad(bodyLength) * 1.5, normal, null) > 0
}

// Targets: moves `target` just outside any rock it falls in (padded for the body).
export function nudgeOutOfRocks(target, bodyLength) {
  if (!hasRockObstacles()) return target
  const pad = rockPad(bodyLength) * 1.5
  for (let i = 0; i < 3; i++) {
    const depth = deepestHit(target, pad, normal, probe)
    if (depth <= 0) break
    target.copy(probe).addScaledVector(normal, 0.5)
  }
  return target
}
