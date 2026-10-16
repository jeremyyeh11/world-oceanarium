import * as THREE from 'three'

// Rock obstacles for fish steering: every placed landscape rock (src/data/landscapes.js) as an
// ellipsoid fitted to its box, in a static grid over x/z. Environment publishes the active
// tank's rocks on mount and clears them on unmount; with none published (The Open Sea) every
// query returns at once.
//
// Fish use it at three points of the unified pipeline (Fish.jsx):
//   steer  — steerAroundRocks probes ahead along the heading and bends the desired heading
//            along the rock's surface and away from it, returning an urgency that raises the
//            turn rate (the same idea as boundaryAvoidanceTurnStep for the swim walls)
//   clamp  — pushOutOfRocks moves a fish that still ended up inside a rock (plus a body pad)
//            back to the surface and returns the surface normal so its heading can slide
//   target — nudgeOutOfRocks moves a roaming, school or bask target out of any rock
//
// The ellipsoid is inscribed in the piece's box, which every kit rock fills or (when shrunk
// to fit) undershoots, so the proxy is close to the rock without hugging its facets. Pads
// scale with body length, so the 3.3 m sunfish keeps its whole body clear, not just its centre.

const GRID_CELL = 12
// Floats per obstacle: centre x, y, z; radii x, y, z (piece axes); cos and sin of its yaw.
const STRIDE = 8

let field = null

const local = new THREE.Vector3()
const probe = new THREE.Vector3()
const normal = new THREE.Vector3()
const tangent = new THREE.Vector3()
const avoid = new THREE.Vector3()
const UP = new THREE.Vector3(0, 1, 0)

function cellKey(cx, cz) {
  return cx * 73856093 ^ cz * 19349663
}

// pieces: placed landscape pieces ({ x, y, z, width, height, depth, yaw }). `reach` keeps only
// rocks a fish can come near (anything below `floorTop` or outside `region` is skipped).
export function setRockObstacles(pieces, { region, floorTop, maxPad }) {
  const kept = pieces.filter(piece => piece.y + piece.height > floorTop
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
  return field
}

export function clearRockObstacles(owner) {
  if (field === owner) field = null
}

export function hasRockObstacles() {
  return field !== null && field.count > 0
}

// Deepest padded rock containing `point`: writes its outward surface normal to `outNormal` and
// the point radially projected onto its padded surface to `outSurface`, and returns how far
// inside it is (0..1, 1 at the centre). Returns 0 when the point is clear.
function deepestHit(point, pad, outNormal, outSurface) {
  const indices = field.grid.get(cellKey(Math.floor(point.x / GRID_CELL), Math.floor(point.z / GRID_CELL)))
  if (!indices) return 0
  const { data } = field
  let best = 0
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
    // Gradient of the ellipsoid in its frame, back to world.
    local.set(lx / (rx * rx), dy / (ry * ry), lz / (rz * rz))
    outNormal.set(c * local.x + s * local.z, local.y, -s * local.x + c * local.z)
    if (outNormal.lengthSq() < 1e-9) outNormal.set(0, 1, 0)
    outNormal.normalize()
    if (outSurface) {
      const k = 1 / Math.max(f, 1e-3)
      outSurface.set(data[o] + dx * k, data[o + 1] + dy * k, data[o + 2] + dz * k)
    }
  }
  return best
}

export function rockPad(bodyLength) {
  return bodyLength * 0.35 + 0.3
}

// Bends `desired` (unit, edited in place) around the first rock ahead along `forward`. Probes
// out to a few body lengths or about a second and a half of travel; the nearer the hit, the
// stronger the turn. Returns the urgency (0 clear, up to 1) for the turn-rate boost.
export function steerAroundRocks(desired, position, forward, bodyLength, speed) {
  if (!hasRockObstacles()) return 0
  const pad = rockPad(bodyLength)
  const reach = Math.max(bodyLength * 3, speed * 1.5, 3) + pad
  let urgency = 0
  for (const t of [0.2, 0.45, 0.7, 1]) {
    probe.copy(position).addScaledVector(forward, reach * t)
    const depth = deepestHit(probe, pad, normal, null)
    if (depth <= 0) continue
    // Slide along the surface: drop the into-rock part of the heading. Head-on, pick the
    // side the desired heading already leans to, or turn right by default.
    tangent.copy(forward).addScaledVector(normal, -forward.dot(normal))
    if (tangent.lengthSq() < 0.04) {
      tangent.crossVectors(UP, normal)
      if (tangent.dot(desired) < 0) tangent.negate()
    }
    tangent.normalize()
    urgency = Math.min(1, (1 - t) * 0.8 + depth * 0.6 + 0.2)
    avoid.copy(tangent).addScaledVector(normal, 0.6).multiplyScalar(2.5 * urgency)
    desired.add(avoid)
    break
  }
  // Already brushing a rock: push straight off it as well.
  const touching = deepestHit(position, pad * 1.25, normal, null)
  if (touching > 0) {
    desired.addScaledVector(normal, 1.5 * touching + 0.5)
    urgency = Math.max(urgency, 0.6)
  }
  if (desired.lengthSq() > 1e-6) desired.normalize()
  return urgency
}

// Clamp: moves `position` out to the padded surface of any rock it is inside. Returns the
// outward normal (shared vector, valid until the next call) or null when clear.
export function pushOutOfRocks(position, bodyLength) {
  if (!hasRockObstacles()) return null
  const pad = rockPad(bodyLength)
  const depth = deepestHit(position, pad, normal, probe)
  if (depth <= 0) return null
  position.copy(probe)
  return normal
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
