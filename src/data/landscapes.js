// Fixed set dressing for tanks that carry a `landscape` key (see TANKS in species.js).
//
// The layout is identical on every load. Hero pieces are placed by hand in `rocks`; the
// rings, floor scatter and rubble are generated, but each from a fixed seed, so they are
// just as stable. Nothing here reads the tank-visit seed.
//
// Units are world units (1 WU = 25 cm). Fish do not avoid rocks yet, so every piece
// stays out of the swim volume of every species in the tank. For The Reefs that volume is
// x ±56, z -40 to -15, y -14 to 2.8 (the Mola and its followers), plus the triggerfish's
// shallower box reaching forward to z -8.3. The Mola's 13 WU body reaches about 6.6 WU past
// its centre. That leaves four zones, checked against each piece's rotated footprint
// (`clearance` below; `pieceZone` names a piece's zone):
//   back: front face at z <= -47, any height
//   side: inner face at |x| >= 63, any height
//   foreground: footprint at z >= -7.5 (between the swim volume and the glass, and behind
//     the camera at z 10), any height
//   floor: anywhere, top below y -20 (under the Mola's deepest fin)
//
// Layers, front to back in the default view: foreground pieces, low mounds on the floor,
// the hand-placed back canyon (z -47 to -64), then rings B and C fading into the fog. The
// rings also wrap the sides and the space behind the camera, so a follow cam looking any
// way sees reef at the edge of the water instead of bare sand.
//
// The phone frame is narrow (about ±16 WU wide at z -50, ±3 WU at z 0), so the back walls
// start close to the centre to frame open blue between them on a 375 px screen, and the
// foreground pieces nearest the centre poke into the phone's bottom corners. The outer
// pieces fill the sides for wide screens.
//
// Prototype: each piece renders as a procedural placeholder rock (Landscape.jsx) until the
// modelled GLBs land. `kind` names the model it stands in for: bommie, boulder, wall, cliff.

export const LANDSCAPES = {
  reefs: {
    // Two metres below the Mola's 14 WU dive floor, so its fins clear the sand.
    floorY: -22,
    floorColor: '#a39c80',
    // Height of the low sand ripples, in WU.
    floorRelief: 0.5,
    // Rock tops stay this far below the water surface (y 4.6).
    maxTop: 3.5,
    // The free zones around the swim volume (see the header). The rings' near stretch runs
    // behind the camera (z 10) at ringFront, so it never blocks the default view.
    clearance: { side: 63, back: -47, front: -7.5, floorTop: -20, ringFront: 12 },
    // [kind, x, z, width, height, depth, yaw (rad), seed]. x/z sit the piece's base centre
    // on the sand; width/height/depth are its bounding box in WU.
    rocks: [
      // Back left canyon wall
      ['bommie', -9, -52, 7, 15, 7, 0.4, 11],
      ['wall', -19, -54, 16, 17, 9, 0.3, 12],
      ['wall', -27, -53, 12, 13, 7, 0.5, 15],
      ['wall', -34, -62, 22, 21, 10, -0.2, 13],
      ['wall', -48, -56, 20, 18, 10, 0.3, 16],
      ['bommie', -60, -70, 12, 24, 10, 0, 17],
      // Tall cliffs at the edges: the inner pair frames the phone, the outer pair wide screens.
      ['cliff', -17, -55, 9, 24, 9, 0.2, 18],
      ['cliff', -50, -58, 14, 26.5, 11, 0.25, 19],
      ['boulder', -13, -50, 4.5, 3.5, 4, 1.1, 14],
      // Back right canyon wall
      ['bommie', 10, -52.5, 8, 12, 7, -0.5, 21],
      ['wall', 19, -56, 18, 19, 10, -0.3, 22],
      ['wall', 27, -54, 12, 11, 7, -0.4, 25],
      ['wall', 36, -64, 24, 23, 11, 0.15, 23],
      ['wall', 49, -58, 22, 20, 10, -0.2, 26],
      ['bommie', 61, -72, 12, 25, 10, 0, 27],
      ['cliff', 17, -56, 9, 25, 9, -0.2, 28],
      ['cliff', 51, -59, 14, 26.5, 11, -0.25, 29],
      ['boulder', 6.5, -49.5, 3.5, 2.6, 3.2, 0.2, 24],
      // Far ridge, seen through the gap between the walls
      ['wall', -2, -76, 34, 11, 12, 0.05, 31],
      // Foreground left: reef rising in front of the swim volume, framing the glass
      ['wall', -9, -3, 10, 18, 6, 0.2, 51],
      ['bommie', -3, 1, 5, 18, 5, 0.5, 52],
      // Foreground cliff framing the left edge of a wide screen, rising almost to the surface.
      ['cliff', -15.5, -1, 9, 26, 9, -0.3, 53],
      // Foreground right
      ['wall', 10, -3, 11, 18.5, 6, -0.25, 61],
      ['bommie', 3.2, 1.5, 4.5, 17, 4.5, -0.4, 62],
      ['cliff', 14, -0.5, 10, 25, 8, 0.35, 63],
      // Low boulders and mounds under the swim volume (tops below y -20). The mounds at
      // z -34 to -44 are the middle layer of the default view, between the foreground and
      // the back canyon.
      ['boulder', -14, -12, 3.5, 1.6, 3, 0.7, 41],
      ['boulder', 10, -6, 3, 1.4, 2.6, 2.1, 42],
      ['boulder', 2, -18, 4, 1.8, 3.5, 0.3, 43],
      ['boulder', -6, 0, 2.5, 1.2, 2.2, 1.6, 44],
      ['boulder', 20, -20, 4, 1.5, 3, 2.7, 45],
      ['boulder', -9, -30, 4, 1.8, 3.4, 1.2, 46],
      ['boulder', 13, -36, 3.6, 1.7, 3, 0.5, 47],
      ['boulder', -22, -37, 9, 1.6, 6, 0.4, 48],
      ['boulder', 27, -42, 10, 1.5, 6, -0.3, 49],
      ['boulder', -1, -44, 7, 1.5, 5, 1.0, 50],
      ['boulder', 40, -34, 8, 1.5, 5, 0.8, 54],
      ['boulder', -40, -41, 9, 1.5, 6, -0.6, 55],
    ],
    // Rings of rock around the swim volume, each walked along a rectangle `offset` WU
    // outside the clearance (further when a piece is too wide for it), from the back
    // round the sides to behind the camera. `back: false` skips the back stretch, which
    // the hand-placed canyon covers; `gap` keeps open water in the middle of the back.
    rings: [
      { seed: 701, count: 30, offset: [3, 9], width: [8, 15], height: [16, 26], kinds: ['cliff', 'wall', 'bommie'], back: false },
      { seed: 702, count: 28, offset: [16, 26], width: [12, 20], height: [18, 27], kinds: ['cliff', 'wall'], gap: 12 },
      { seed: 703, count: 24, offset: [34, 46], width: [16, 26], height: [20, 28], kinds: ['cliff', 'wall'] },
    ],
    // Low boulders over the whole seabed, so a follow cam looking down never finds bare sand.
    scatter: { seed: 801, count: 60, xMin: -100, xMax: 100, zMin: -100, zMax: 60, width: [2, 6], height: [0.8, 1.8] },
    // Rubble chunks, 10–30 cm each, one instanced draw.
    rubble: { count: 800, seed: 4127, xMin: -110, xMax: 110, zMin: -110, zMax: 60, sizeMin: 0.4, sizeMax: 1.2 },
  },
}

export function landscapeForTank(tank) {
  return tank?.landscape ? LANDSCAPES[tank.landscape] ?? null : null
}

// Smooth low sand ripples. Seabed vertices and every placed piece sample the same function,
// so rocks sit on the sand rather than on a guessed flat height.
export function sandHeight(landscape, x, z) {
  const relief = landscape.floorRelief ?? 0
  const ripple = Math.sin(x * 0.11 + z * 0.04) * 0.6 + Math.sin(z * 0.17 - x * 0.05 + 1.3) * 0.4
  const swell = Math.sin(x * 0.031 + 0.7) * Math.sin(z * 0.027 + 2.1)
  return landscape.floorY + relief * (ripple * 0.6 + swell)
}

export function seededRandom(seed) {
  let a = seed >>> 0
  return function rand() {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// How far a piece's flattened base sinks into the sand so no gap shows.
function pieceSink(height) {
  return Math.min(1.2, height * 0.08) + 0.1
}

// Half extents of a piece's footprint once yawed.
function footprint(width, depth, yaw) {
  const c = Math.abs(Math.cos(yaw))
  const s = Math.abs(Math.sin(yaw))
  return { hx: (width * c + depth * s) / 2, hz: (width * s + depth * c) / 2 }
}

// Lowest sand height under a piece's footprint, so no edge of its base floats.
function baseHeight(landscape, x, z, width, depth) {
  const hx = width * 0.5
  const hz = depth * 0.5
  return Math.min(
    sandHeight(landscape, x, z),
    sandHeight(landscape, x - hx, z), sandHeight(landscape, x + hx, z),
    sandHeight(landscape, x, z - hz), sandHeight(landscape, x, z + hz),
  )
}

function ringPieces(landscape, ring) {
  const { side, back, ringFront } = landscape.clearance
  const rand = seededRandom(ring.seed)
  const pick = ([min, max]) => min + rand() * (max - min)
  const pieces = []
  for (let i = 0; i < ring.count; i++) {
    const kind = ring.kinds[Math.floor(rand() * ring.kinds.length)]
    const width = pick(ring.width)
    const depth = width * (0.55 + rand() * 0.4)
    const height = pick(ring.height)
    const yaw = rand() * Math.PI * 2
    // Any yaw fits inside this radius, so the piece clears the zone edge at every angle.
    const reach = Math.hypot(width, depth) / 2 + 0.5
    const out = Math.max(pick(ring.offset), reach)
    const x0 = side + out
    const zBack = back - out
    const zFront = ringFront + out
    const stretches = [2 * x0, zFront - zBack, 2 * x0, zFront - zBack]
    const perimeter = stretches.reduce((sum, length) => sum + length, 0)
    let t = ((i + 0.5 + (rand() - 0.5) * 0.7) / ring.count) * perimeter
    let x
    let z
    let onBack = false
    if (t < stretches[0]) { x = -x0 + t; z = zBack; onBack = true }
    else if ((t -= stretches[0]) < stretches[1]) { x = x0; z = zBack + t }
    else if ((t -= stretches[1]) < stretches[2]) { x = x0 - t; z = zFront }
    else { t -= stretches[2]; x = -x0; z = zFront - t }
    if (onBack && (ring.back === false || Math.abs(x) < (ring.gap ?? 0))) continue
    pieces.push([kind, x, z, width, height, depth, yaw, ring.seed * 100 + i])
  }
  return pieces
}

function scatterPieces(landscape, scatter) {
  const rand = seededRandom(scatter.seed)
  const pick = ([min, max]) => min + rand() * (max - min)
  const pieces = []
  for (let i = 0; i < scatter.count; i++) {
    const x = scatter.xMin + rand() * (scatter.xMax - scatter.xMin)
    const z = scatter.zMin + rand() * (scatter.zMax - scatter.zMin)
    const width = pick(scatter.width)
    pieces.push(['boulder', x, z, width, pick(scatter.height), width * (0.6 + rand() * 0.35), rand() * Math.PI * 2, scatter.seed * 100 + i])
  }
  return pieces
}

// Which free zone a piece sits in, or 'clash' if it would reach into the swim volume.
export function pieceZone(landscape, piece) {
  const { side, back, front, floorTop } = landscape.clearance
  const { x, z, top, hx, hz } = piece
  if (z + hz <= back) return 'back'
  if (Math.abs(x) - hx >= side) return 'side'
  if (z - hz >= front) return 'foreground'
  if (top < floorTop) return 'floor'
  return 'clash'
}

// Every piece, placed: base on the sand, height capped so its top stays under the surface
// (and under the floor-zone limit when that is the only zone it fits). Pieces that would
// still reach the swim volume are dropped, so the generated parts can never clash.
export function landscapePieces(landscape) {
  const raw = [
    ...landscape.rocks,
    ...(landscape.rings ?? []).flatMap(ring => ringPieces(landscape, ring)),
    ...(landscape.scatter ? scatterPieces(landscape, landscape.scatter) : []),
  ]
  const pieces = []
  for (const [kind, x, z, width, rawHeight, depth, yaw, seed] of raw) {
    const base = baseHeight(landscape, x, z, width, depth)
    const { hx, hz } = footprint(width, depth, yaw)
    const openZone = z + hz <= landscape.clearance.back || Math.abs(x) - hx >= landscape.clearance.side || z - hz >= landscape.clearance.front
    const topLimit = openZone ? landscape.maxTop : landscape.clearance.floorTop - 0.05
    let height = rawHeight
    if (base - pieceSink(height) + height > topLimit) height = topLimit - base + pieceSink(height)
    const y = base - pieceSink(height)
    const piece = { kind, x, y, z, width, height, depth, yaw, seed, hx, hz, top: y + height }
    if (pieceZone(landscape, piece) === 'clash') continue
    pieces.push(piece)
  }
  return pieces
}
