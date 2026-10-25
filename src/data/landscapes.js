// Fixed set dressing for tanks that carry a `landscape` key (see TANKS in species.js).
//
// The layout is identical on every load. Hero pieces are placed by hand in `rocks`; the
// outcrops, floor scatter and rubble are generated, but each from a fixed seed, so they are
// just as stable. Nothing here reads the tank-visit seed.
//
// Units are world units (1 WU = 25 cm). Fish steer round rocks (rockObstacles.js), but only the
// hand-placed pieces flagged `inSwim` stand in the swim volume on purpose (the near massif and
// the mid-ground outcrop); every other piece stays out of it. For The Reefs that volume is
// x ±56, z -40 to -15, y -14 to 2.8 (the Mola and its followers); the reef fish reach further,
// down to y -19 and back to z -52 (REEF_BOUNDS in species.js), to get at the rocks. The Mola's
// 13 WU body reaches about 6.6 WU past its centre. That leaves four zones, checked against each piece's rotated footprint
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
    // Stack tiers: the wide rocks, laid whichever way fits a low, wide box best.
    ledge: [4, 8, 3, 0],
    talus: [5, 6, 7, 5, 6, 7, 5, 6, 7, 0],
    rubble: [5, 6, 7],
  },
  // Largest tilt off upright, in radians; rubble tumbles freely.
  tilt: { cliff: 0.12, bommie: 0.2, wall: 0.18, boulder: 0.45, talus: 0.5, ledge: 0.15 },
  // Most uneven stretch allowed per kind: no axis scales more than this many times another.
  // Beyond it rocks read as stretched spikes or squashed pancakes; tall kinds get a little
  // more so the edge cliffs keep their height.
  maxStretch: { cliff: 2.6, bommie: 2.3, wall: 2, boulder: 2, talus: 2, ledge: 2.4 },
}

// Jeremy's table corals (Acropora hyacinthus, `_blender models/acropora hyacinthus.glb`, 2026-10-19),
// baked by scripts/build-coral-kit.py: coralN_hi (3000 triangles; 1400 for the small one) carries
// the full model's colour and bristly surface in coralN-color/-normal.jpg, coralN_lo (700; 300)
// shares them. In metres, origin at the foot of the stalk. 0: the cream 2.5 m table with a
// raised tier, 1: the pink 2.2 m table on a far off-centre stalk, 2: a small 0.7 m table.
const TABLE_CORAL_KIT = {
  path: '/models/landscape/table-corals.glb',
  models: ['coral0', 'coral1', 'coral2'].map(name => ({
    name,
    color: `/models/landscape/${name}-color.jpg`,
    normal: `/models/landscape/${name}-normal.jpg`,
  })),
  // Plates narrower than this many WU use the small model (2); wider ones the two big tables.
  smallBelowWU: 3,
  // Corals within this distance of the resting camera use the _hi meshes, then _lo out to
  // loDetailDistance, and _far (160 triangles; 60 for the small one) beyond. Only the
  // foreground rocks (from about 25 WU out) are close enough for _hi; a metre-wide plate at
  // 40 WU spans about 60 px, plenty for _lo's 700 triangles.
  hiDetailDistance: 30,
  loDetailDistance: 60,
  // Merged in square chunks this many WU wide (per model), so off-screen ones are culled.
  chunkWU: 60,
}

// Jeremy's staghorn corals (Acropora muricata, `_blender models/acropora muricata.glb`,
// 2026-10-20), baked by scripts/build-staghorn-kit.py: two colonies per colour, a big one and a
// small one, each with _hi (2200 to 4000 triangles), _lo (1000-1800), _far (350-600) and _min
// (160-300) meshes sharing its colour's maps. In metres, origin at the middle of the base. 0: orange-brown, 1.1 m tall; 1:
// orange-brown, 0.65 m; 2: cream, a low spreading 1.1 m colony; 3: cream, 0.35 m; 4: blue,
// 0.55 m; 5: blue, 0.45 m.
const STAGHORN_KIT = {
  path: '/models/landscape/staghorn-corals.glb',
  // The two colonies of a colour share one colour and one normal map (2048 px for orange and
  // cream, 1536 for blue; normals 1024), about the source photos' 7-11 texels per cm.
  models: ['orange', 'orange', 'cream', 'cream', 'blue', 'blue'].map((colour, i) => ({
    name: `staghorn${i}`,
    color: `/models/landscape/staghorn-${colour}-color.jpg`,
    normal: `/models/landscape/staghorn-${colour}-normal.jpg`,
  })),
  // The kit's models by colour, [big, small].
  colours: [[0, 1], [2, 3], [4, 5]],
  // Unlike the tables, each bommie's staghorn switches level by the live camera's distance to it
  // (Landscape.jsx staghornLods): _hi within hiDetailDistance, _lo to loDetailDistance, _far to
  // farDetailDistance and _min beyond. A bommie's _hi meshes are only built while the camera is
  // within hiBuildDistance of it and freed beyond hiDropDistance (StaghornBommie); until then its
  // close-up level is _lo.
  hiDetailDistance: 22,
  loDetailDistance: 50,
  farDetailDistance: 75,
  hiBuildDistance: 28,
  hiDropDistance: 45,
  // Two-sided: a thin branch seen edge-on at _lo or _far can show its inside.
  doubleSided: true,
}

// Jeremy's giant sea fans (Annella mollis, `_blender models/annella mollis.glb`, 2026-10-26),
// normalised by scripts/build-sea-fan-kit.py: fan0, fan1, ... each in metres with its holdfast at
// the origin and its lattice in the XY plane, with the GLB's own photo materials (the lattice cut
// out by its texture's alpha, WebP). 0: orange, 1.0 m; 1: yellow, 0.94 m wide, a lobe hanging
// below its holdfast; 2: pink, 0.86 m. The model contract is docs/procedural/coral-sway.md.
const SEA_FAN_KIT = {
  path: '/models/landscape/sea-fans.glb',
  // Merged in square chunks this many WU wide (per material), so off-screen ones are culled.
  chunkWU: 60,
}

// How the sea fans sway (utils/coralSway.js), in the tank and in the Atlas: one swing back and
// forth every `period` s (the surge), the rim swinging `bend` of the fan's height either way,
// with a faster `flutter` toward the rim.
export const SEA_FAN_SWAY = { period: 7, bend: 0.05, flutter: 0.25 }

// The Reefs' resting camera (Camera.jsx cameraSettings), shared with its tank in species.js
// so the rock detail levels measure distance from the same viewpoint. Back and down from the
// default (z 10, y -3.35), zoomed about 1.5× (42°, was 61°): the reef rises around and above
// the viewer instead of being looked across. Since v0.29.0-dev_10 it is the pose Jeremy framed
// in the diver camera ("ok yea do it"): back and to the right of the foreground rocks, at
// x 12, y -9.8, z 25.2, turned 9.5° left. Since v0.31.1-dev_1 it is pitched 1.6° down (looking
// at x 7.8, y -10.5 on the z 0 plane; was 5.4° up, y -7.4, which left the outcrop about 70% of
// the way down the frame): Jeremy asked for the central outcrop "around the center/slightly
// below the center of the screen", and it now sits about 53% down on desktop and a 375 px phone.
// The foreground rocks frame the bottom (the turn centres even a phone on the outcrop, at
// x 2.9), and the canyon columns stand behind. The pitch does not change which rocks get corals.
// The nearest rock is a scatter boulder 3.6 WU behind and below the camera.
export const REEFS_VIEW = { fov: 42, x: 12, y: -9.8, z: 25.2, lookX: 7.8, lookY: -10.5 }

// The Shallows' resting camera: low over the sand (4 WU up) and tilted about 22° up, so the
// devil ray school passes overhead against the bright surface and shows its wings, not its
// edge, with the sand along the bottom of the frame. At eye level (y -20, 15° up) the rays
// read edge-on, as lines. A window wider than 16:9 widens the view up to 21:9 (TankView.jsx
// StageWindow) rather than cropping the frame's top and bottom, which lost the sand (Jeremy,
// 2026-10-25); the animals' swim wedges are sized to stay outside a 21:9 frame.
export const SHALLOWS_VIEW = { fov: 58, x: 0, y: -24, z: 24, lookX: 0, lookY: -14.3, maxStageAspect: 21 / 9 }

export const LANDSCAPES = {
  reefs: {
    view: REEFS_VIEW,
    kit: LIMESTONE_KIT,
    // The sand's mean level. With floorRelief the highest dune crest is floorY + 2.18 ×
    // floorRelief = -20.4, just under the Mola's lowest fin (y -20 at its 14 WU dive floor);
    // troughs reach -27.6.
    floorY: -24,
    // Pale sand, so it reads bright against the dark rock as in Jeremy's colour references
    // (2026-10-18); was #a39c80.
    floorColor: '#c4bea2',
    // Painted rock light and shadow (Landscape.jsx applyRockShade), after the same references:
    // dark rock under bright water, sunlit tops and dark undersides. The bases are only lightly
    // darkened (low 0.6, was 0.35): the deep shadow comes with distance (heightFog in species.js).
    // `warm` tints the sunlit tops toward ochre near the surface, a stand-in for the colour
    // corals will bring against the blue.
    rockShade: {
      tone: 0.66, top: 1.2, underside: 0.25, low: 0.6, lowY: -24, highY: -6,
      warm: { color: [1.18, 1.02, 0.78], strength: 0.5, yLow: -18, yHigh: 0 },
    },
    // Sunlight caustics on rock tops and sand (utils/caustics.js), projected in world space and
    // slanted along the sun (the key light comes from the upper left, x -8 y 12 z 8). Kept
    // subtle (Jeremy: "dont over do this"): cells about 1.5 WU (37 cm) across, a slow drift,
    // under half strength by the sand, and gone beyond 60 WU.
    caustics: {
      strength: 0.9,
      scale: 12,
      speed: 0.02,
      color: [1.0, 0.97, 0.88],
      slant: [0.4, -0.4],
      depth: [-24, 0, 0.6],
      fade: [25, 60],
    },
    // Scale of the sand's dunes, hummocks and ripples (see sandHeight), in WU.
    floorRelief: 1.65,
    // Large sand hills on top of that grain, rising only outside the basin the fish swim
    // over: zero inside the swim clearance (x ±63, z -47 to -7.5), ramping up over `ramp`
    // WU beyond it to as much as `height` WU (2.5 m), so the basin floor stays below the
    // Mola's fins while dunes climb toward the reef walls and in front of the glass.
    hills: { height: 10, ramp: 32 },
    // A massif behind the swim clearance, highest on the right and falling away to the left,
    // so from the resting camera the reef forms a triangle (Jeremy: "do it on the right side,
    // slope towards the left"). From the back line (z -47) the sand climbs over `length` WU
    // to `height` WU at the right (x >= xHigh), down to lowShare of it at the left (x <= xLow).
    // Steep because fog hides everything past about 90 WU from the camera.
    mountain: { height: 26, length: 36, xLow: -45, xHigh: 45, lowShare: 0.2 },
    // The sand never rises above this, 4.6 WU (1.15 m) under the water surface (y 4.6).
    sandMax: 0,
    // Rows of terrace stacks on the slope, front to back: [z, count, stack height range].
    // The first row leaves the central valley open (|x| < gap).
    terraces: {
      seed: 1201,
      xSpan: 72,
      // Stacks about as tall as they are wide, so each tier is a chunky boulder mass (about
      // half as tall as wide) rather than a flat slab.
      rows: [
        { z: -55, count: 9, height: [8, 12], gap: 15 },
        { z: -64, count: 10, height: [9, 13], gap: 8 },
        { z: -73, count: 10, height: [9, 14] },
        { z: -83, count: 9, height: [10, 15] },
      ],
      width: [10, 17],
      depth: [9, 13],
    },
    // Rock tops stay under the water surface (y 4.6): each piece gets its own limit between
    // maxTop - topJitter and maxTop, so tall pieces never line up into a flat skyline.
    maxTop: 3.5,
    topJitter: 7,
    // A share of the tall generated or unfixed pieces (raw height at least minHeight) may
    // break the surface, raised to a top between top - jitter and top. Off (share 0) since
    // dev_10: random surface-breakers made a forest of columns (Jeremy: "looks too much like
    // zhangjiajie"); only the central valley's fixed-top cliffs (options.top) rise that far.
    pierce: { share: 0, minHeight: 14, top: 14, jitter: 5 },
    // Talus aprons around pieces at least minHeight tall (see talusFor): buttress and boulder
    // counts per piece.
    talus: { minHeight: 14, buttress: [0, 1], boulders: [1, 3] },
    // The free zones around the swim volume (see the header). Only hand-placed pieces use
    // the foreground zone in front of the camera (z 14); a generated piece there must stand
    // behind the camera, at outcropFront and beyond, so it never blocks the default view.
    clearance: { side: 63, back: -47, front: -7.5, floorTop: -20, outcropFront: 16 },
    // Rocks the reef fish can reach (their swim volume, REEF_BOUNDS in species.js, plus a few
    // WU of standoff): kept whole for their site raycasts (src/components/reefSites.js).
    reefReach: { xMin: -64, xMax: 64, yMin: -21, yMax: 4, zMin: -58, zMax: 10 },
    // [kind, x, z, width, height, depth, yaw (rad), seed, options?]. x/z sit the piece's base
    // centre on the sand; width/height/depth are its bounding box in WU. options.top fixes
    // the piece's top (y), growing or capping it, to hold the composition.
    rocks: [
      // The back canyon, deliberately uneven: the left framing cliff stands nearer and
      // lower, the right one further back and taller with a spire beside it, leading up the
      // massif behind it, so the two never mirror each other and the reef reads as a
      // triangle rising to the right. Only the central valley stands in columns: the inner
      // cliffs (x -10.5 and 15) frame a 375 px phone's zoomed view (about ±13 WU wide at
      // z -55). Everything beyond them builds up in horizontal stacks of ledges, including
      // the outer pair (x -37 and 42) that frames a wide screen (about ±52 WU).
      // Left
      ['cliff', -10.5, -53.5, 12, 24, 10, 0.2, 18, { top: 7 }],
      ['bommie', -18, -52, 7, 15, 7, 0.4, 11],
      ['stack', -22, -57, 18, 14, 10, 0.3, 12],
      ['stack', -29, -55, 14, 10, 8, 0.5, 15],
      ['stack', -37, -59, 20, 14, 12, 0.25, 19],
      ['stack', -36, -67, 24, 16, 12, -0.2, 13],
      ['stack', -52, -60, 22, 14, 11, 0.3, 16],
      ['stack', -62, -73, 22, 18, 12, 0, 17, { tiers: 3 }],
      // Right
      ['cliff', 15, -63, 14, 25, 11, -0.2, 28, { top: 13 }],
      ['cliff', 8.5, -57, 7, 18, 6, 0.6, 32, { top: 3 }],
      ['stack', 21, -54, 11, 9, 8, -0.5, 21],
      ['stack', 25, -61, 20, 15, 11, -0.3, 22],
      ['stack', 31, -56, 14, 9, 8, -0.4, 25],
      ['stack', 42, -69, 24, 20, 13, -0.25, 29, { tiers: 3 }],
      ['stack', 38, -76, 26, 17, 12, 0.15, 23],
      ['stack', 53, -63, 22, 14, 11, -0.2, 26],
      // Off-centre rocks in the gap, at different depths and heights, so the canyon is not an
      // empty symmetric valley: a mid bommie left of centre, a low wide rock right of it, and
      // a faint spire and ridge further back.
      ['bommie', -3, -63, 8, 14, 7, 0.9, 33, { top: -7 }],
      ['wall', 4.5, -50, 9, 4, 6, 0.3, 34],
      ['cliff', 1.5, -88, 6, 20, 6, -0.4, 35, { top: 2 }],
      ['stack', 9, -81, 28, 13, 14, 0.05, 31],
      ['boulder', -13, -49.5, 4.5, 3.5, 4, 1.1, 14],
      ['boulder', 11, -49.5, 3.5, 2.6, 3.2, 0.2, 24],
      // Foreground, between the swim volume and the glass: low on the left, and on the right
      // a run of stacks stepping up toward the screen's right edge, nearly to the surface,
      // the near half of the triangle the massif behind completes.
      ['wall', -9, -3, 10, 10, 6, 0.2, 51],
      ['bommie', -3, 1, 5, 12, 5, 0.5, 52],
      ['stack', -12, 0.5, 12, 11, 9, -0.3, 53],
      // Capped since the view dropped to y -9 (dev_3), where it rose mid-frame as a column; it
      // pokes up from the bottom edge again.
      ['bommie', 3.2, 1.5, 4.5, 14, 4.5, -0.4, 62, { top: -12 }],
      ['stack', 6, -1.5, 8, 9, 7, 0.3, 61, { tiers: 2 }],
      ['stack', 10.5, 0, 10, 14, 8, -0.2, 63],
      ['stack', 15.5, 0.5, 12, 20, 9, 0.2, 64, { tiers: 3 }],
      ['stack', 21.5, -0.5, 12, 26, 9, -0.3, 65, { tiers: 3 }],
      // The near half of the massif, inside the swim volume (inSwim: fish steer around it):
      // stacks stepping up toward the right and back, from low mounds at x 14 to near the
      // surface at x 53, leaving the centre open. With the massif behind the canyon this
      // makes the triangle rising to the right in the default view.
      ['stack', 14, -36, 10, 7, 9, 0.4, 71, { inSwim: true, tiers: 2 }],
      ['stack', 22, -27, 11, 8, 10, 0.3, 73, { inSwim: true, tiers: 2 }],
      ['stack', 22, -42, 12, 11, 11, -0.2, 72, { inSwim: true }],
      ['stack', 31, -36, 14, 15, 12, 0.1, 74, { inSwim: true, tiers: 3 }],
      ['stack', 34, -22, 12, 11, 10, -0.4, 75, { inSwim: true }],
      ['stack', 41, -43, 16, 20, 13, -0.2, 76, { inSwim: true, tiers: 3 }],
      ['stack', 45, -29, 15, 18, 13, 0.3, 77, { inSwim: true, tiers: 3 }],
      ['stack', 53, -38, 16, 24, 14, 0.1, 78, { inSwim: true, tiers: 3 }],
      ['stack', 55, -22, 14, 20, 12, -0.3, 79, { inSwim: true, tiers: 3 }],
      // A low outcrop in the middle ground, inside the swim volume, where the phone's narrow
      // frame (about ±9 WU at z -30) sees the reef fish at the rock. Two horizontal stacks
      // stepping up to the right like the rest of the reef, their tops well below the eye
      // line so the open blue down the middle stays clear.
      ['stack', 2.5, -29, 16, 19, 11, 0.35, 81, { inSwim: true, tiers: 3 }],
      ['stack', -7, -23.5, 8, 10, 7, -0.5, 82, { inSwim: true, tiers: 2 }],
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
    // Outcrops: clusters scattered over the area around the swim volume, out to `outer`, each
    // a stack of ledges with smaller rocks leaning on it.
    // `gap` keeps open water behind the back canyon's centre (|x| < gap.x, z > gap.z) for the
    // phone's view down the middle. Stack heights are drawn from three bands (low mound, mid,
    // tall) so neighbours differ.
    outcrops: {
      seed: 901,
      count: 30,
      outer: { x: 125, back: -125, front: 75 },
      gap: { x: 12, z: -72 },
      skipBack: 70,
      heights: [[0.4, 5, 10], [0.4, 10, 16], [0.2, 16, 22]],
      width: [7, 24],
      satellites: [1, 3],
    },
    // Low boulders over the whole seabed, so a follow cam looking down never finds bare sand.
    scatter: { seed: 801, count: 60, xMin: -100, xMax: 100, zMin: -100, zMax: 60, width: [2, 6], height: [0.8, 1.8] },
    // Rubble chunks, 10–30 cm each.
    rubble: { count: 450, seed: 4127, xMin: -110, xMax: 110, zMin: -110, zMax: 60, sizeMin: 0.4, sizeMax: 1.2 },
    // Table corals (src/components/coralPlacement.js), after Jeremy's references (2026-10-19):
    // a bommie crowned with tables, thin plates of many sizes in overlapping tiers, the biggest
    // low and spreading out over the sand, the smallest on top on visible stalks. He found
    // corals on most rocks "very sparse" and asked for "denser clusters but less number of
    // clusters everywhere": a few rocks each get a full crown, the rest stay bare.
    // Each cluster covers the rocks with the `hosts` seeds (from `rocks` above); `count` is its
    // number of tables, `width` the plate width range in WU, `wallShare` the share of its
    // shoulder tables growing out of a wall, and `frontBias` the share on the side facing the
    // resting camera. Widths run 1.6 to 10 WU, 40 cm to 2.5 m: adult tables average about 1.5 m
    // across (147 ± 49 cm, tagged colonies in the Philippines), young ones of 20 to 60 cm make
    // up most of a reef's tables, and the largest reach several metres (SeaLifeBase). The kit's
    // biggest model is a 2.5 m table.
    corals: {
      kit: TABLE_CORAL_KIT,
      clusters: [
        // The mid-ground outcrop, mid-frame on a phone.
        { hosts: [81, 82], count: 26, seed: 6101, width: [1.6, 10], wallShare: 0.25, frontBias: 0.75 },
      ],
      // Then up to `clusters` more, each on a stack, bommie, wall or boulder at least
      // minHeight WU tall (1 m), wide for its height (a crown needs a top), whose top reaches minTop, within maxDistance WU of the resting
      // camera (fog hides the rest) and at least `spacing` WU (5 m) from every other cluster,
      // nearer rocks a little likelier. A rock gets one table per areaPerCoral WU² of its
      // footprint, within `count`.
      scatter: {
        seed: 6203, clusters: 14, spacing: 20, minHeight: 4, minTop: -21, maxDistance: 95,
        areaPerCoral: 6, count: [10, 26], width: [1.6, 10], wallShare: 0.25, frontBias: 0.7,
      },
    },
    // Staghorn (src/components/staghornPlacement.js) on the same bommies as the tables, so each
    // cluster reads as one: Jeremy (2026-10-20) found thickets on their own "so sad and
    // separate", and wants "same colour ones" to "cluster together". Each table cluster gets a
    // patch for about every `tablesPerPatch` tables, within `patches`, each one colour; about
    // footShare of them at the rock's foot, the rest on its top and shoulders among the tables.
    // A patch is `patchRadius` WU across either way and holds `perPatch` colonies. `scale` is WU
    // per kit metre: 4 is the scanned colonies' own size (35 cm to 1.1 m); up to 1.5 times that,
    // as staghorn colonies commonly grow a metre or two across.
    staghorn: {
      kit: STAGHORN_KIT,
      seed: 7301, tablesPerPatch: 4, patches: [3, 6], footShare: 0.35,
      patchRadius: [2, 3.2], perPatch: [12, 18], scale: [3.6, 6],
    },
    // Giant sea fans (src/components/seaFanPlacement.js) on the same bommies, placed after the
    // tables and clear of them, and before the staghorn, which keeps clear of them (placed after
    // it, a fan found room on almost no bommie): `perCluster` fans a bommie, `height` in WU (75 cm
    // to 1.9 m: colonies are mostly 76 to 150 cm, Brihatee et al. 2025, and reach 2 m), the big
    // ones low. A fan grows broadside to the current; `current` (x, z) is set along the resting
    // camera's line of sight, so the fans face the visitor, each within `facingJitter` radians.
    // `sway` is SEA_FAN_SWAY. About footShare of the fans stand on the sand at the bommie's foot.
    // A fan needs `minVisible` of 9 points on its face seen from the resting camera.
    seaFans: {
      kit: SEA_FAN_KIT,
      seed: 8411, perCluster: [1, 3], height: [3, 7.5],
      current: [0.16, 1], facingJitter: 0.35, footShare: 0.5, minVisible: 6,
      sway: SEA_FAN_SWAY,
    },
  },
  // The Shallows (Jeremy, 2026-10-23): a bright, shallow Sea of Cortez sand bay where Munk's
  // devil rays school. Mostly open on purpose, so the school is the subject: pale rippled sand,
  // strong caustics, and a few dark volcanic boulders kept to the left. The limestone kit,
  // shaded dark, stands in for basalt.
  shallows: {
    view: SHALLOWS_VIEW,
    kit: LIMESTONE_KIT,
    // 32.6 WU (8 m) under the surface at y 4.6; about 9 m in the troughs.
    floorY: -28,
    floorColor: '#e6dcb2',
    floorRelief: 1.2,
    rockShade: {
      tone: 0.34, top: 0.9, underside: 0.2, low: 0.55, lowY: -28, highY: -18,
    },
    // Shallow water throws bright, busy caustics on the sand.
    caustics: {
      strength: 1.25,
      scale: 10,
      speed: 0.025,
      color: [1.0, 0.98, 0.9],
      slant: [0.4, -0.4],
      depth: [-28, 0, 0.75],
      fade: [30, 80],
      // The same light on the animals (Fish.jsx, Biome.jsx), overriding the keys above: the same
      // world-space net, so it slides over a ray as it swims through it rather than riding on
      // its skin, on upward-facing skin only. Subtle, and only near the surface: none below
      // y -10, full at y 2 (the rays swim y -16 to 1). Jeremy, 2026-10-24, after a photo of a
      // devil ray netted in light just under the surface.
      // The light is added in proportion to the skin's own colour, and a devil ray's back is
      // dark, so it needs far more strength than the pale sand to show (0.8 was invisible).
      // A large, slow net (dev_5, Jeremy: "larger and slower so it slides less"): a ray
      // swimming 0.7 m/s crosses a 5 WU net's cells about every second, which read as busy
      // across a whole school; at 11 WU (about three cells over a ray's back) and less than
      // half the sand's drift it passes over each ray about twice as slowly.
      fish: {
        strength: 2.6,
        scale: 11,
        speed: 0.01,
        depth: [-10, 2, 0],
        fade: [30, 90],
      },
    },
    sandMax: -6,
    maxTop: -14,
    topJitter: 3,
    // Nothing here is generated, so the zones only keep the hand-placed rocks honest.
    clearance: { side: 70, back: -80, front: 12, floorTop: -24, outcropFront: 16 },
    // [kind, x, z, width, height, depth, yaw (rad), seed]. One low cluster on the left, below the
    // rays' swim volume (their floor is y -20), and two stragglers further back.
    rocks: [
      ['boulder', -24, -14, 7, 4.5, 6, 0.4, 901],
      ['boulder', -29, -19, 5, 3.2, 4.5, 1.3, 902],
      ['boulder', -19, -9, 3.5, 2.2, 3, 2.2, 903],
      ['boulder', -31, -10, 3, 1.8, 2.6, 0.7, 904],
      ['boulder', -40, -34, 8, 5, 7, -0.3, 905],
      ['boulder', -12, -46, 4, 2.4, 3.5, 0.9, 906],
    ],
    // Pebbles of the same rock around the cluster.
    rubble: { count: 40, seed: 9131, xMin: -42, xMax: -12, zMin: -30, zMax: 0, sizeMin: 0.4, sizeMax: 1.1 },
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

// How much of the massif's height stands at this x: lowShare on the left, all of it on the
// right. Terraces use it too, so their stacks grow with the slope.
export function massifShare(landscape, x) {
  const { mountain } = landscape
  if (!mountain) return 0
  const t = Math.min(Math.max((x - mountain.xLow) / (mountain.xHigh - mountain.xLow), 0), 1)
  return mountain.lowShare + (1 - mountain.lowShare) * t * t * (3 - 2 * t)
}

// The massif behind the swim clearance (see `mountain` above).
function sandMountain(landscape, z, x) {
  const { mountain, clearance } = landscape
  if (!mountain || z >= clearance.back) return 0
  const t = Math.min((clearance.back - z) / mountain.length, 1)
  return mountain.height * t * t * (3 - 2 * t) * massifShare(landscape, x) * (0.88 + 0.12 * Math.sin(x * 0.07 + z * 0.05))
}

// Sand height at a point. Seabed vertices, every placed piece and the follow camera's floor
// guard sample the same function, so rocks sit on the sand and the camera stays above it.
export function sandHeight(landscape, x, z) {
  const height = landscape.floorY + (landscape.floorRelief ?? 0) * SAND_PEAK * sandGrain(x, z) + sandHills(landscape, x, z) + sandMountain(landscape, z, x)
  return Math.min(height, landscape.sandMax ?? Infinity)
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

// How far a piece's base sinks into the sand so no gap shows. The kit rocks have curved,
// uneven undersides: laid flat, a wide rock touches the sand at one point and its edges lift,
// so low, wide kinds bury a larger share of their height than tall ones.
const SINK_SHARE = { ledge: 0.35, talus: 0.3, boulder: 0.25 }
function pieceSink(height, kind) {
  return Math.min(4, height * (SINK_SHARE[kind] ?? 0.15)) + 0.2
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
    // The terraces own the slope behind the canyon.
    const onSlope = outcrops.skipBack && cz < back && Math.abs(cx) < outcrops.skipBack
    if (inside || inGap || onSlope) continue
    const seedBase = outcrops.seed * 1000 + placed * 10
    const mainHeight = pickHeight()
    // Width follows height, so a low stack is a mound of boulders rather than a flat slab.
    const mainWidth = Math.min(outcrops.width[1], Math.max(outcrops.width[0], mainHeight * (1.1 + rand() * 0.7)))
    const mainYaw = rand() * Math.PI * 2
    // The main rock is a stack of ledges; its leaning satellites keep the kit's other shapes.
    pieces.push(['stack', cx, cz, mainWidth, mainHeight, mainWidth * (0.55 + rand() * 0.4), mainYaw, seedBase])
    const satellites = Math.round(pick(outcrops.satellites))
    for (let i = 1; i <= satellites; i++) {
      const angle = rand() * Math.PI * 2
      const distance = mainWidth * (0.45 + rand() * 0.45)
      const width = mainWidth * (0.3 + rand() * 0.45)
      // Never taller than wide: leaning rocks stay blocky, not columns.
      const height = Math.min(mainHeight * (0.25 + rand() * 0.5), width * 0.9)
      const satKind = height < 6 ? 'boulder' : rand() < 0.5 ? 'bommie' : 'wall'
      pieces.push([satKind, cx + Math.cos(angle) * distance, cz + Math.sin(angle) * distance, width, height, width * (0.6 + rand() * 0.35), rand() * Math.PI * 2, seedBase + i])
    }
    placed++
  }
  return pieces
}

// Terrace rows: stacks spread across each row with uneven spacing and depth, so the slope
// reads as layered rock rather than a wall.
function terracePieces(landscape, terraces) {
  const rand = seededRandom(terraces.seed)
  const pick = ([min, max]) => min + rand() * (max - min)
  const pieces = []
  terraces.rows.forEach((row, r) => {
    const step = (2 * terraces.xSpan) / row.count
    for (let i = 0; i < row.count; i++) {
      const x = -terraces.xSpan + step * (i + 0.5) + (rand() - 0.5) * step * 0.6
      if (row.gap && Math.abs(x) < row.gap) continue
      const z = row.z + (rand() - 0.5) * 6
      // Stacks grow with the massif: taller toward the right, where the slope is highest.
      const grow = 0.6 + 0.8 * massifShare(landscape, x)
      const width = pick(terraces.width) * (0.8 + 0.4 * massifShare(landscape, x))
      pieces.push(['stack', x, z, width, pick(row.height) * grow, pick(terraces.depth), (rand() - 0.5) * 0.8, terraces.seed * 1000 + r * 50 + i])
    }
  })
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
    ...(landscape.terraces ? terracePieces(landscape, landscape.terraces) : []),
    ...(landscape.outcrops ? outcropPieces(landscape, landscape.outcrops) : []),
    ...(landscape.scatter ? scatterPieces(landscape, landscape.scatter) : []),
  ]
  const pieces = []
  const place = (rock, isGenerated) => {
    if (rock[0] === 'stack') return placeStack(rock, isGenerated)
    const piece = placePiece(landscape, rock, isGenerated)
    if (piece) pieces.push(piece)
    return piece
  }
  // A stack: 2–3 wide, low ledge tiers, each smaller one set off-centre and resting on the
  // one below, so outcrops and canyon walls build up in horizontal layers instead of
  // standing as columns. Returns the bottom tier, which takes the talus.
  const placeStack = ([, x, z, width, height, depth, yaw, seed, options], isGenerated) => {
    const rand = seededRandom((seed * 747796405 + 1) >>> 0)
    const tiers = options?.tiers ?? 2 + Math.floor(rand() * 2)
    const shares = [0.5, 0.35, 0.25].slice(0, tiers)
    const total = shares.reduce((sum, share) => sum + share, 0)
    let below = null
    let bottom = null
    for (let i = 0; i < tiers; i++) {
      // Each tier well inside the one below, so none overhangs a lower rock that was shrunk
      // to fit its box and reads as a plate hanging in the water.
      const scale = [1, 0.62, 0.4][i]
      const tierWidth = width * scale * (0.9 + rand() * 0.2)
      const tierDepth = depth * scale * (0.9 + rand() * 0.2)
      // Tiers overlap by half their height, so the parts add up to the stack height.
      const tierHeight = height * (shares[i] / total) * (i === 0 ? 1 : 1.5)
      const angle = rand() * Math.PI * 2
      const shift = i === 0 ? 0 : width * (0.04 + rand() * 0.08)
      const tierX = (below?.x ?? x) + Math.cos(angle) * shift
      const tierZ = (below?.z ?? z) + Math.sin(angle) * shift
      const tierYaw = yaw + (rand() - 0.5) * 0.8
      // Each tier sinks half its height into the one below; Landscape.jsx then drops it
      // onto the lower rock's real top, which sits below its box when the rock was shrunk
      // to fit, so no tier hangs in the water.
      const tierOptions = below
        ? { baseY: below.top - tierHeight * 0.5, sink: 0, inSwim: options?.inSwim }
        : options?.inSwim ? { inSwim: true } : undefined
      const piece = placePiece(landscape, ['ledge', tierX, tierZ, tierWidth, tierHeight, tierDepth, tierYaw, seed * 10 + i, tierOptions], isGenerated)
      if (!piece) break
      if (below) piece.restsOn = below.seed
      pieces.push(piece)
      bottom ??= piece
      below = piece
    }
    return bottom
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
  // A stacked tier rests on the tier below (options.baseY) instead of the sand.
  const base = options?.baseY ?? baseHeight(landscape, x, z, width, depth)
  const sinkOf = height => options?.sink ?? pieceSink(height, kind)
  const { hx, hz } = footprint(width, depth, yaw)
  const openZone = z + hz <= clearance.back || Math.abs(x) - hx >= clearance.side || z - hz >= clearance.front || Boolean(options?.inSwim)
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
  if (fixedTop !== null || pierces || base - sinkOf(height) + height > topLimit) height = topLimit - base + sinkOf(height)
  // A floor-zone piece on a dune crest can be capped down to nothing.
  if (height < 0.4) return null
  const y = base - sinkOf(height)
  const piece = { kind, x, y, z, width, height, depth, yaw, seed, hx, hz, top: y + height }
  const zone = pieceZone(landscape, piece)
  // Pieces flagged inSwim stand in the swim volume on purpose: fish steer around them
  // (src/components/rockObstacles.js).
  if (zone === 'clash' && !options?.inSwim) return null
  if (options?.inSwim) piece.inSwim = true
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
      // At most about as tall as wide, so a tall cliff's apron steps down instead of
      // sprouting columns of its own.
      const height = Math.min(Math.max(0.8, parent.height * pick(tier.height)), width * 1.1)
      rocks.push(['talus', parent.x + Math.cos(angle) * distance, parent.z + Math.sin(angle) * distance, width, height, width * (0.6 + rand() * 0.4), rand() * Math.PI * 2, 5000000 + parent.seed * 10 + k, parent.inSwim ? { inSwim: true } : undefined])
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
