// Fixed set dressing for tanks that carry a `landscape` key (see TANKS in species.js).
//
// The layout is identical on every load. Hero pieces are placed by hand in `rocks`; the
// outcrops, floor scatter and rubble are generated, but each from a fixed seed, so they are
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
// the hand-placed back canyon (z -47 to -64), then outcrops fading into the fog. Outcrops
// also fill the sides and the space behind the camera, so a follow cam looking any way sees
// reef at the edge of the water instead of bare sand. They are scattered clusters (one main
// rock with smaller ones leaning on it) at uneven spacing and heights, so no line or ring
// shows.
//
// The phone frame is narrow (about ±16 WU wide at z -50, ±3 WU at z 0), so the back walls
// start close to the centre to frame open blue between them on a 375 px screen, and the
// foreground pieces nearest the centre poke into the phone's bottom corners. The outer
// pieces fill the sides for wide screens.
//
// Rocks are kitbashed from a small kit of modelled rocks (`kit`): each piece picks one rock
// by its seed, spins and tilts it, and stretches it non-uniformly into its own box, so a
// handful of models gives endless different shapes. `kind` only biases which rocks fit a
// slot: tall ones for cliffs and bommies, wide ones for walls, small ones for boulders.

// Jeremy's limestone boulders (`_blender models/landscape/limestone boulders.glb`), cut down
// to three detail levels per rock with the textures resized to 1024 px. rockN_hi is the
// close-up mesh (at most 3000 triangles), rockN_lo the distant one (about 600; 120 for the
// small rocks) and rockN_rubble a 40-triangle chunk of the three small rocks.
const LIMESTONE_KIT = {
  path: '/models/landscape/limestone-boulders.glb',
  textures: {
    color: '/models/landscape/limestone-color.jpg',
    normal: '/models/landscape/limestone-normal.jpg',
    roughness: '/models/landscape/limestone-roughness.jpg',
  },
  // UVs are re-projected per piece after it is stretched, so the texture repeats every
  // textureTileWU on every rock whatever its scale.
  textureTileWU: 6,
  // Pieces whose centre is within this distance of the default camera use the _hi meshes.
  hiDetailDistance: 30,
  // The baked landscape is split into square chunks this many WU wide, so the frustum culls
  // whatever is behind or beside the camera instead of drawing every rock every frame.
  chunkWU: 60,
  // Rock indices (0–8) each kind draws from. 1 and 2 are tall, 3, 4 and 8 wide, 5–7 small.
  variants: {
    cliff: [1, 2, 0],
    bommie: [2, 0, 1, 7],
    wall: [3, 4, 8, 0],
    boulder: [5, 6, 7, 0, 3],
    talus: [5, 6, 7, 5, 6, 7, 5, 6, 7, 0],
    rubble: [5, 6, 7],
  },
  // Largest tilt off upright, in radians; rubble tumbles freely.
  tilt: { cliff: 0.12, bommie: 0.2, wall: 0.18, boulder: 0.45, talus: 0.5 },
  // Most uneven stretch allowed per kind: no axis scales more than this many times another.
  // Beyond it rocks read as stretched spikes or squashed pancakes; tall kinds get a little
  // more so the edge cliffs keep their height.
  maxStretch: { cliff: 2.6, bommie: 2.3, wall: 2, boulder: 2, talus: 2 },
}

// The Reefs' resting camera (Camera.jsx cameraSettings), shared with its tank in species.js
// so the rock detail levels measure distance from the same viewpoint. Back and down from the
// default (z 10, y -3.35) and pitched up about 7° (was 3.4°), zoomed about 1.35× (47°,
// was 61°): the reef rises around and above the viewer instead of being looked across.
export const REEFS_VIEW = { fov: 47, y: -6, z: 14, lookY: -4.3 }

export const LANDSCAPES = {
  reefs: {
    view: REEFS_VIEW,
    kit: LIMESTONE_KIT,
    // The sand's mean level. With floorRelief the highest dune crest is floorY + 2.18 ×
    // floorRelief = -20.4, just under the Mola's lowest fin (y -20 at its 14 WU dive floor);
    // troughs reach -27.6.
    floorY: -24,
    floorColor: '#a39c80',
    // Scale of the sand's dunes, hummocks and ripples (see sandHeight), in WU.
    floorRelief: 1.65,
    // Large sand hills on top of that grain, rising only outside the basin the fish swim
    // over: zero inside the swim clearance (x ±63, z -47 to -7.5), ramping up over `ramp`
    // WU beyond it to as much as `height` WU (2.5 m), so the basin floor stays below the
    // Mola's fins while dunes climb toward the reef walls and in front of the glass.
    hills: { height: 10, ramp: 32 },
    // Rock tops stay under the water surface (y 4.6): each piece gets its own limit between
    // maxTop - topJitter and maxTop, so tall pieces never line up into a flat skyline.
    maxTop: 3.5,
    topJitter: 7,
    // A share of the tall generated or unfixed pieces (raw height at least minHeight) break the
    // surface instead: they are raised to a top between top - jitter and top. The camera sits
    // only 2 m under the surface, so a rock capped below it never climbs past the middle of
    // the screen; at y 14 a canyon cliff reaches the top quarter.
    pierce: { share: 0.25, minHeight: 14, top: 14, jitter: 5 },
    // Talus aprons around pieces at least minHeight tall (see talusFor): buttress and boulder
    // counts per piece.
    talus: { minHeight: 14, buttress: [0, 1], boulders: [1, 3] },
    // The free zones around the swim volume (see the header). Only hand-placed pieces use
    // the foreground zone in front of the camera (z 14); a generated piece there must stand
    // behind the camera, at outcropFront and beyond, so it never blocks the default view.
    clearance: { side: 63, back: -47, front: -7.5, floorTop: -20, outcropFront: 16 },
    // [kind, x, z, width, height, depth, yaw (rad), seed, options?]. x/z sit the piece's base
    // centre on the sand; width/height/depth are its bounding box in WU. options.top fixes
    // the piece's top (y), growing or capping it, to hold the composition.
    rocks: [
      // The back canyon, deliberately uneven: the left side stands nearer and taller, the
      // right further back and lower with a smaller spire beside it, so the two framing
      // cliffs never mirror each other. The inner pair (x -10.5 and 15) frames a 375 px
      // phone's zoomed view (about ±13 WU wide at z -55); the outer pair (x -36 and 41)
      // frames a wide screen's (about ±52 WU).
      // Left
      ['cliff', -10.5, -53.5, 12, 24, 10, 0.2, 18, { top: 14 }],
      ['bommie', -18, -52, 7, 15, 7, 0.4, 11],
      ['wall', -21, -56, 16, 17, 9, 0.3, 12],
      ['wall', -28, -54, 12, 13, 7, 0.5, 15],
      ['cliff', -36, -57, 15, 26.5, 12, 0.25, 19, { top: 13 }],
      ['wall', -34, -64, 22, 21, 10, -0.2, 13],
      ['wall', -50, -58, 20, 18, 10, 0.3, 16],
      ['bommie', -60, -70, 12, 24, 10, 0, 17],
      // Right
      ['cliff', 15, -63, 14, 25, 11, -0.2, 28, { top: 8 }],
      ['cliff', 8.5, -57, 7, 18, 6, 0.6, 32, { top: -1 }],
      ['bommie', 21, -52, 8, 12, 7, -0.5, 21],
      ['wall', 24, -59, 18, 19, 10, -0.3, 22],
      ['wall', 30, -54, 12, 11, 7, -0.4, 25],
      ['cliff', 41, -67, 16, 26.5, 12, -0.25, 29, { top: 10 }],
      ['wall', 36, -72, 24, 23, 11, 0.15, 23],
      ['wall', 52, -60, 22, 20, 10, -0.2, 26],
      ['bommie', 61, -74, 12, 25, 10, 0, 27],
      // Off-centre rocks in the gap, at different depths and heights, so the canyon is not an
      // empty symmetric valley: a mid bommie left of centre, a low wide rock right of it, and
      // a faint spire and ridge further back.
      ['bommie', -3, -63, 8, 14, 7, 0.9, 33, { top: -7 }],
      ['wall', 4.5, -50, 9, 4, 6, 0.3, 34],
      ['cliff', 1.5, -88, 6, 20, 6, -0.4, 35, { top: 2 }],
      ['wall', 9, -80, 26, 15, 13, 0.05, 31],
      ['boulder', -13, -49.5, 4.5, 3.5, 4, 1.1, 14],
      ['boulder', 11, -49.5, 3.5, 2.6, 3.2, 0.2, 24],
      // Foreground, between the swim volume and the glass, also uneven: a tall cliff at a
      // wide screen's left edge, a lower wall at its right.
      ['wall', -9, -3, 10, 18, 6, 0.2, 51],
      ['bommie', -3, 1, 5, 18, 5, 0.5, 52],
      ['cliff', -11, -1, 9, 26, 9, -0.3, 53],
      ['wall', 10, -3, 11, 18.5, 6, -0.25, 61],
      ['bommie', 3.2, 1.5, 4.5, 17, 4.5, -0.4, 62],
      ['wall', 12.5, -2.5, 9, 14, 7, 0.35, 63],
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
    // Outcrops: clusters scattered over the area around the swim volume, out to `outer`.
    // `gap` keeps open water behind the back canyon's centre (|x| < gap.x, z > gap.z) for the
    // phone's view down the middle. Main rock heights are drawn from three bands (low mound,
    // mid, tall spire) so neighbours differ.
    outcrops: {
      seed: 901,
      count: 40,
      outer: { x: 125, back: -125, front: 75 },
      gap: { x: 12, z: -72 },
      heights: [[0.3, 6, 12], [0.4, 12, 20], [0.3, 22, 36]],
      width: [8, 18],
      satellites: [1, 3],
      kinds: ['cliff', 'wall', 'bommie', 'wall'],
    },
    // Low boulders over the whole seabed, so a follow cam looking down never finds bare sand.
    scatter: { seed: 801, count: 60, xMin: -100, xMax: 100, zMin: -100, zMax: 60, width: [2, 6], height: [0.8, 1.8] },
    // Rubble chunks, 10–30 cm each.
    rubble: { count: 600, seed: 4127, xMin: -110, xMax: 110, zMin: -110, zMax: 60, sizeMin: 0.4, sizeMax: 1.2 },
  },
}

export function landscapeForTank(tank) {
  return tank?.landscape ? LANDSCAPES[tank.landscape] ?? null : null
}

// The sand's grain: a broad swell (wavelength about 200 WU), dunes (40–60 WU), hummocks
// (about 18 WU) and fine ripples (6 WU), in [-1, 1]. It peaks at SAND_PEAK × floorRelief
// above floorY, which keeps the basin under the swim volume below y -20.
const SAND_PEAK = 0.6 + 1 + 0.5 + 0.08
export function sandGrain(x, z) {
  const dunes = Math.sin(x * 0.11 + z * 0.04) * 0.6 + Math.sin(z * 0.17 - x * 0.05 + 1.3) * 0.4
  const swell = Math.sin(x * 0.031 + 0.7) * Math.sin(z * 0.027 + 2.1)
  const hummocks = Math.sin(x * 0.35 + z * 0.12 + 0.4) * Math.sin(z * 0.29 - x * 0.08 + 2.2)
  const ripples = Math.sin(x * 0.95 + z * 0.42)
  return (dunes * 0.6 + swell + hummocks * 0.5 + ripples * 0.08) / SAND_PEAK
}

// The large hills (see `hills` above): zero inside the swim clearance, rising outside it.
function sandHills(landscape, x, z) {
  const { hills, clearance } = landscape
  if (!hills) return 0
  const dx = Math.max(Math.abs(x) - clearance.side, 0)
  const dz = Math.max(clearance.back - z, z - clearance.front, 0)
  const t = Math.min(Math.hypot(dx, dz) / hills.ramp, 1)
  const ramp = t * t * (3 - 2 * t)
  // Uneven crests, wavelengths of about 70–230 WU, so the hills read as separate dunes.
  const shape = 0.5 + 0.5 * (Math.sin(x * 0.043 + 1.1) * Math.sin(z * 0.051 + 0.3) * 0.6 + Math.sin((x + z) * 0.027 + 2) * 0.4)
  return ramp * hills.height * (0.3 + 0.7 * shape)
}

// Sand height at a point. Seabed vertices, every placed piece and the follow camera's floor
// guard sample the same function, so rocks sit on the sand and the camera stays above it.
export function sandHeight(landscape, x, z) {
  return landscape.floorY + (landscape.floorRelief ?? 0) * SAND_PEAK * sandGrain(x, z) + sandHills(landscape, x, z)
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

// How far a piece's base sinks into the sand so no gap shows. The kit rocks have uneven
// undersides, so a low, wide piece needs a good share of its height buried.
function pieceSink(height) {
  return Math.min(3, height * 0.15) + 0.2
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

function outcropPieces(landscape, outcrops) {
  const { side, back, outcropFront } = landscape.clearance
  const { outer, gap } = outcrops
  const rand = seededRandom(outcrops.seed)
  const pick = ([min, max]) => min + rand() * (max - min)
  const pickHeight = () => {
    let r = rand()
    for (const [share, min, max] of outcrops.heights) {
      if (r < share) return min + rand() * (max - min)
      r -= share
    }
    const [, min, max] = outcrops.heights[outcrops.heights.length - 1]
    return min + rand() * (max - min)
  }
  const pieces = []
  let placed = 0
  // Rejection-sample cluster centres: outside the swim clearance (with a margin), inside the
  // outer bound, and out of the back gap. Capped attempts keep this deterministic and finite.
  for (let attempt = 0; placed < outcrops.count && attempt < outcrops.count * 40; attempt++) {
    const cx = (rand() * 2 - 1) * outer.x
    const cz = outer.back + rand() * (outer.front - outer.back)
    const inside = Math.abs(cx) < side + 4 && cz > back - 4 && cz < outcropFront + 6
    const inGap = Math.abs(cx) < gap.x && cz > gap.z && cz < back
    if (inside || inGap) continue
    const seedBase = outcrops.seed * 1000 + placed * 10
    const mainWidth = pick(outcrops.width)
    const mainHeight = pickHeight()
    const mainYaw = rand() * Math.PI * 2
    const kind = outcrops.kinds[Math.floor(rand() * outcrops.kinds.length)]
    pieces.push([kind, cx, cz, mainWidth, mainHeight, mainWidth * (0.55 + rand() * 0.4), mainYaw, seedBase])
    const satellites = Math.round(pick(outcrops.satellites))
    for (let i = 1; i <= satellites; i++) {
      const angle = rand() * Math.PI * 2
      const distance = mainWidth * (0.45 + rand() * 0.45)
      const width = mainWidth * (0.3 + rand() * 0.45)
      const height = mainHeight * (0.25 + rand() * 0.5)
      const satKind = height < 6 ? 'boulder' : rand() < 0.5 ? 'bommie' : 'wall'
      pieces.push([satKind, cx + Math.cos(angle) * distance, cz + Math.sin(angle) * distance, width, height, width * (0.6 + rand() * 0.35), rand() * Math.PI * 2, seedBase + i])
    }
    placed++
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
// (at a per-piece limit, see topJitter) and under the floor-zone limit when that is the only
// zone it fits. Pieces that would still reach the swim volume are dropped, and so are
// generated pieces in front of the camera, so the generated parts can never clash.
export function landscapePieces(landscape) {
  const generated = [
    ...(landscape.outcrops ? outcropPieces(landscape, landscape.outcrops) : []),
    ...(landscape.scatter ? scatterPieces(landscape, landscape.scatter) : []),
  ]
  const pieces = []
  const place = (rock, isGenerated) => {
    const piece = placePiece(landscape, rock, isGenerated)
    if (piece) pieces.push(piece)
    return piece
  }
  const parents = [
    ...landscape.rocks.map(rock => place(rock, false)),
    ...generated.map(rock => place(rock, true)),
  ].filter(Boolean)
  if (landscape.talus) {
    for (const parent of parents) {
      if (parent.height < landscape.talus.minHeight || parent.kind === 'boulder') continue
      talusFor(landscape, parent).forEach(rock => place(rock, true))
    }
  }
  return pieces
}

function placePiece(landscape, [kind, x, z, width, rawHeight, depth, yaw, seed, options], isGenerated) {
  const { clearance, pierce } = landscape
  const base = baseHeight(landscape, x, z, width, depth)
  const { hx, hz } = footprint(width, depth, yaw)
  const openZone = z + hz <= clearance.back || Math.abs(x) - hx >= clearance.side || z - hz >= clearance.front
  // Only back and side pieces break the surface: one in front of the glass would wall off
  // the view.
  const farZone = z + hz <= clearance.back || Math.abs(x) - hx >= clearance.side
  const pick = seededRandom(seed)
  const jitter = pick()
  // A hand-placed piece may fix its top (options.top) to hold the composition.
  const fixedTop = options?.top !== undefined && (farZone || options.top <= landscape.maxTop) ? options.top : null
  const pierces = fixedTop === null && farZone && pierce && rawHeight >= pierce.minHeight && pick() < pierce.share
  const topLimit = !openZone
    ? clearance.floorTop - 0.05
    : fixedTop ?? (pierces
      ? pierce.top - jitter * pierce.jitter
      : landscape.maxTop - jitter * (landscape.topJitter ?? 0))
  let height = rawHeight
  // A fixed-top or piercing piece grows to its target; every other piece is only capped.
  if (fixedTop !== null || pierces || base - pieceSink(height) + height > topLimit) height = topLimit - base + pieceSink(height)
  // A floor-zone piece on a dune crest can be capped down to nothing.
  if (height < 0.4) return null
  const y = base - pieceSink(height)
  const piece = { kind, x, y, z, width, height, depth, yaw, seed, hx, hz, top: y + height }
  const zone = pieceZone(landscape, piece)
  if (zone === 'clash') return null
  if (isGenerated && zone === 'foreground' && z - hz < clearance.outcropFront) return null
  return piece
}

// The step from seabed to cliff: around each tall piece, one or two buttress rocks about half
// its height leaning on it, then a few boulders around those (the rubble does the rest).
// Each talus rock goes through the same zone checks, so where the apron would reach the
// swim volume it is capped to the floor zone or dropped.
function talusFor(landscape, parent) {
  const { talus } = landscape
  const rand = seededRandom((parent.seed * 2246822519 + 7) >>> 0)
  const pick = ([min, max]) => min + rand() * (max - min)
  const reach = Math.max(parent.hx, parent.hz)
  const parentSize = Math.min(parent.width, parent.depth)
  const rocks = []
  const tiers = [
    // count, distance (× reach), width (× parent size), height (× parent height)
    { count: talus.buttress, distance: [0.55, 0.85], width: [0.35, 0.6], height: [0.3, 0.6] },
    { count: talus.boulders, distance: [0.9, 1.5], width: [0.15, 0.35], height: [0.08, 0.25] },
  ]
  let k = 0
  for (const tier of tiers) {
    const count = Math.round(pick(tier.count))
    for (let i = 0; i < count; i++, k++) {
      const angle = rand() * Math.PI * 2
      const distance = reach * pick(tier.distance)
      const width = Math.max(1.2, parentSize * pick(tier.width))
      const height = Math.max(0.8, parent.height * pick(tier.height))
      rocks.push(['talus', parent.x + Math.cos(angle) * distance, parent.z + Math.sin(angle) * distance, width, height, width * (0.6 + rand() * 0.4), rand() * Math.PI * 2, 5000000 + parent.seed * 10 + k])
    }
  }
  return rocks
}

// Rubble chunks on the sand: floor-level and tiny, so no zone check is needed.
export function rubblePieces(landscape) {
  const { count, seed, xMin, xMax, zMin, zMax, sizeMin, sizeMax } = landscape.rubble
  const rand = seededRandom(seed + 1)
  const pieces = []
  for (let i = 0; i < count; i++) {
    const x = xMin + rand() * (xMax - xMin)
    const z = zMin + rand() * (zMax - zMin)
    const size = sizeMin + rand() * (sizeMax - sizeMin)
    const width = size * (0.8 + rand() * 0.5)
    const height = size * (0.45 + rand() * 0.35)
    const depth = size * (0.8 + rand() * 0.5)
    pieces.push({ kind: 'rubble', x, y: sandHeight(landscape, x, z) - height * 0.25, z, width, height, depth, yaw: rand() * Math.PI * 2, seed: seed * 10000 + i })
  }
  return pieces
}
