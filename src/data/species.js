import { RIDE_ANCHORS } from './rideAnchors.js'
import { REEFS_VIEW, SHALLOWS_VIEW } from './landscapes.js'

export const WORLD_UNIT_METERS = 0.25

export const DEPTH_ZONES = [
  {
    id: 'epipelagic',
    name: 'Epipelagic',
    label: 'Epipelagic · Sunlight Zone',
    shortLabel: 'Sunlight Zone',
    depthRangeMeters: [0, 200],
  },
  {
    id: 'mesopelagic',
    name: 'Mesopelagic',
    label: 'Mesopelagic · Twilight Zone',
    shortLabel: 'Twilight Zone',
    depthRangeMeters: [200, 1000],
  },
  {
    id: 'bathypelagic',
    name: 'Bathypelagic',
    label: 'Bathypelagic · Midnight Zone',
    shortLabel: 'Midnight Zone',
    depthRangeMeters: [1000, 4000],
  },
]

export const BIOMES = [
  {
    id: 'tropical-river',
    name: 'Tropical River',
    tagline: 'Warm currents and lush overgrowth',
    color: '#2a6e3f',
    accent: '#5dd97a',
    icon: '🌿',
    description: 'Slow-moving tropical rivers winding through dense rainforest.',
  },
  {
    id: 'ocean',
    name: 'Pelagic Ocean',
    tagline: 'Open water from sunlight to midnight',
    color: '#0e4a7a',
    accent: '#4db8ff',
    icon: '🌊',
    description: 'Open-water ocean habitat organized by depth zones, from epipelagic sunlight to the dark pelagic depths.',
    zones: ['epipelagic', 'mesopelagic', 'bathypelagic'],
    defaultDepthZone: 'epipelagic',
  },
]

// Motion rhythm on each species — describes how the animal moves, independent of
// trophic role. Used to keep tanks coherent (see TANKS below).
//   'drift'  — slow, gelatinous, current-borne
//   'cruise' — steady glides, broad turns, occasional bursts
//   'sprint' — fast darting / schooling flicker
//
// A tank is a curated assemblage, not "everything in a biome". It borrows a biome
// for its environment (water, light, bubbles are keyed on biome id) but lists its
// cast explicitly. Drifters and fast swimmers must not share a tank — see the
// coherence guard in utils/speciesLookup.js.
export const TANKS = [
  {
    id: 'open-sea',
    name: 'The Open Sea',
    tagline: 'A blue-water pursuit',
    // One or two lines shown under the tank name above the switcher.
    description: 'Fast open-ocean hunters and their bait, from flickering sardinella to the cruising mako, with a young whale shark gliding through.',
    biome: 'ocean',
    depthZone: 'epipelagic',
    // The reserve's depth range in metres: the scale of its loading descent and the depth
    // on its selector card (utils/reserveDepth.js). Without it the zone's range is used.
    // Open water: the whole sunlight zone.
    depthMeters: [0, 200],
    // The selector card's preview: a 16:7 still of the reserve, framed on its hero animal
    // (docs/tank-design.md, New reserve checklist). The whale shark with its remoras.
    cardImage: '/reserves/open-sea.webp',
    // The loading descent's standees (docs/tank-design.md, Descent scenery). Open water has
    // no seabed, so nothing stands on the floor. Zigzag down the line: a mahi-mahi pair near
    // the surface on the right (they keep to the top 85 m), a sardinella school balled up on
    // the left below them, and the whale shark deeper on the right, heading for the line.
    descent: {
      signature: [
        { sprite: 'mahi-mahi-male', species: 'coryphaena-hippurus', depth: 20, side: 'right' },
        { sprite: 'mahi-mahi-female', species: 'coryphaena-hippurus', depth: 20, side: 'right', dx: 6, dy: 11, distance: 0.25 },
        { sprite: 'sardine', species: 'amblygaster-sirm', depth: 55, side: 'left', flip: true },
        { sprite: 'sardine', species: 'amblygaster-sirm', depth: 55, side: 'left', flip: true, dx: 12, dy: -5 },
        { sprite: 'sardine', species: 'amblygaster-sirm', depth: 55, side: 'left', flip: true, dx: 6, dy: 4 },
        { sprite: 'sardine', species: 'amblygaster-sirm', depth: 55, side: 'left', flip: true, dx: 19, dy: 1, distance: 0.2 },
        { sprite: 'sardine', species: 'amblygaster-sirm', depth: 55, side: 'left', flip: true, dx: 15, dy: 9, distance: 0.3 },
        { sprite: 'sardine', species: 'amblygaster-sirm', depth: 55, side: 'left', flip: true, dx: 25, dy: -7, distance: 0.4 },
        { sprite: 'sardine', species: 'amblygaster-sirm', depth: 55, side: 'left', flip: true, dx: 2, dy: -10, distance: 0.35 },
        { sprite: 'sardine', species: 'amblygaster-sirm', depth: 55, side: 'left', flip: true, dx: 27, dy: 6, distance: 0.5 },
        { sprite: 'sardine', species: 'amblygaster-sirm', depth: 55, side: 'left', flip: true, dx: 21, dy: 14, distance: 0.55 },
        { sprite: 'whale-shark', species: 'rhincodon-typus', depth: 125, side: 'right' },
      ],
    },
    // seed varies the surface caustics + background mottle so each tank has a
    // distinct-but-stable sky/surface signature (see SceneLighting / WaterSurface).
    seed: 137,
    species: [
      'amblygaster-sirm',
      'coryphaena-hippurus',
      'isurus-oxyrinchus',
      // Juveniles only (see the species entry).
      'rhincodon-typus',
      // Remoras. The sharksuckers and the common remora ride the mako; the white suckerfish,
      // marlinsucker, and slender suckerfish only occasionally; the whalesucker swims free
      // until a whale or dolphin joins the tank.
      'echeneis-naucrates',
      'echeneis-neucratoides',
      'remora-remora',
      'remora-albescens',
      'remora-australis',
      'remora-osteochir',
      'phtheirichthys-lineatus',
    ],
  },
  {
    // Formerly The Drift.
    id: 'the-reefs',
    name: 'The Reefs',
    tagline: 'Reef fish among the rocks',
    description: 'A sheltered reef where angelfish, bannerfish and triggerfish keep house, and a giant sunfish comes in from the blue to be cleaned.',
    biome: 'ocean',
    depthZone: 'epipelagic',
    // A shallow sunlit reef, rounded to 10 m (Jeremy, 2026-10-23). The scene as drawn agrees:
    // sand at y -24 under the surface at y 4.6 is 28.6 WU, about 7 m (8 m in the troughs).
    depthMeters: [0, 10],
    // The selector card's preview: the giant sunfish over the reef with the pilot fish.
    cardImage: '/reserves/the-reefs.webp',
    // The loading descent's standees (docs/tank-design.md, Descent scenery): pixel cut-outs
    // around the guideline, placed by depth (m, or 'floor'), lit as the diver passes.
    // Composed, not scattered: the signature species zigzag down the line (bannerfish left,
    // angelfish right, a few butterflyfish left again), and the line ends in a coral garden
    // on both sides of where the diver lands, the larger mass on the left. Sprites face
    // left; `flip` turns one to face the line from the left.
    descent: {
      signature: [
        { sprite: 'bannerfish', species: 'heniochus-acuminatus', depth: 3, side: 'left', flip: true },
        { sprite: 'emperor-angelfish', species: 'pomacanthus-imperator', depth: 5.5, side: 'right' },
        // A loose trio, set back a little.
        { sprite: 'raccoon-butterflyfish', species: 'chaetodon-lunula', depth: 8, side: 'left', flip: true, distance: 0.3 },
        { sprite: 'raccoon-butterflyfish', species: 'chaetodon-lunula', depth: 8, side: 'left', flip: true, dx: 13, dy: -6, distance: 0.4 },
        { sprite: 'raccoon-butterflyfish', species: 'chaetodon-lunula', depth: 8, side: 'left', flip: true, dx: 7, dy: 6, distance: 0.45 },
      ],
      scenery: [
        { sprite: 'table-coral', depth: 'floor', side: 'left' },
        { sprite: 'staghorn-blue', depth: 'floor', side: 'left', dx: -3, distance: 0.25 },
        { sprite: 'staghorn-orange', depth: 'floor', side: 'right' },
        { sprite: 'table-coral', depth: 'floor', side: 'right', dx: -2, distance: 0.35 },
      ],
    },
    seed: 953,
    // Optional per-tank lighting overrides merged over the biome palette — a cheap
    // way to art-direct a tank's mood beyond the procedural seed variation.
    // Shallow reef water (Jeremy, 2026-10-18: "the waters should be shallower and maybe the
    // colours are brighter and less foggy", then colour references). The references share a
    // deep, saturated blue that darkens with distance and depth, bright only up by the surface;
    // an all-over bright cyan (dev_4) read flat ("not a big fan of the super bright cyan blue").
    // Fog is thinner than the open sea (0.032) so the reef reads further off. The value contrast
    // is in the rock (landscapes.js rockShade).
    lighting: {
      envTop: '#a9daf2',
      envHorizon: '#2a78b8',
      envDeep: '#061f3d',
      fog: '#14588f',
      hemiSky: '#b6dcf5',
      // Dark fill from below, so undersides sink into shadow.
      hemiGround: '#061a2c',
      key: '#fff0d4',
      fill: '#1f6aa6',
      density: 0.016,
      exposure: 1.06,
      // Cyan overhead, through blue at the horizon, to deep blue straight down (not black:
      // Jeremy, "the dark also = more deep blue rather than black"). The resting
      // view only sees from about 27° above the horizon (0.35 down the gradient) to 15° below it
      // (0.58), so the cyan reaches well down and the steps sit inside that band.
      backgroundStops: [
        [0, '#8edbf2'],
        [0.3, '#47bde0'],
        [0.4, '#2a90c6'],
        [0.5, '#17609b'],
        [0.6, '#11478a'],
        [0.75, '#0d3876'],
        [1, '#0a2c60'],
      ],
      // The water's colour by height (utils/heightFog.js; Jeremy: "closer to the sea bed =
      // darker. closer to surface = more cyan"): distant rock and fish near the sand fade into
      // deep blue, those up by the surface into cyan, from the sand's mean level to the surface;
      // and what lies far off by the sand is lit at half strength. The darkness gathers with
      // distance and the foreground stays lit ("accentuate this darkness in the background and
      // keep the foreground lighter").
      heightFog: { low: '#0b3070', high: '#43b6d8', yLow: -24, yHigh: 4.6, strength: 1, seabedLight: 0.5 },
      backgroundBeamAlpha: 0.1,
      // The underside of the surface (WaterSurface.jsx), cyan to match the top of the gradient.
      surfaceColor: '#6cc6e2',
      surfaceAttenuationColor: '#45a6cc',
      // No light shafts (UnderwaterFX.jsx god rays): Jeremy, 2026-10-18, "idw the fake sun beams".
      godRays: false,
    },
    // Fixed seabed and rocks from src/data/landscapes.js. Tanks without one keep the
    // biome's open-water floor.
    landscape: 'reefs',
    // Optional resting-camera overrides (Camera.jsx DEFAULT_CAMERA_SETTINGS: fov, y, z, lookY).
    // The Reefs' view (landscapes.js REEFS_VIEW) is zoomed about 1.5×, lower, further back
    // and pitched up: fish and rocks read larger, which suits the smaller reef life and corals
    // to come. Follow mode keeps its own framing.
    camera: REEFS_VIEW,
    // The spearfish remora rides the Mola; it is recorded on ocean sunfishes as well as billfish.
    // Pilot fish follow the Mola without attaching; bannerfish and emperor angelfish do now and
    // then, as cleaners. The clown triggerfish keeps to itself.
    species: ['mola-alexandrini', 'remora-brachyptera', 'naucrates-ductor', 'heniochus-acuminatus', 'pomacanthus-imperator', 'balistoides-conspicillum', 'plectropomus-areolatus', 'chaetodon-lunula', 'crassilabrus-undulatus'],
    // Species that live in the tank as part of its landscape rather than as creature rows: the
    // table corals placed on the rocks (landscapes.js `corals`). They count toward the tank's
    // species (the landing card) like the fish do.
    landscapeSpecies: ['acropora-hyacinthus', 'acropora-muricata'],
  },
  {
    // Jeremy, 2026-10-23: a schooling ray in a reserve of its own, so the open sea and the reef
    // keep their own casts. No species repeats from another reserve.
    id: 'the-shallows',
    name: 'The Shallows',
    tagline: 'Devil rays over a sunlit bay',
    description: "A bright sand bay in the Sea of Cortez where Munk's devil rays gather in their hundreds, flying together just under the surface.",
    biome: 'ocean',
    depthZone: 'epipelagic',
    // A shallow bay: the sand is drawn at y -28 under the surface at y 4.6, 32.6 WU or about 8 m
    // (9 m in the troughs), rounded to 10 m. The rays live at 0–15 m (FishBase).
    depthMeters: [0, 10],
    // The selector card's preview: the devil ray school against the surface.
    cardImage: '/reserves/the-shallows.webp',
    // The loading descent's standees (docs/tank-design.md, Descent scenery): the devil rays as
    // one school just under the surface on the left, a straggler pair lower on the right. No
    // seabed pieces: scenery is living things only, and the bay has no coral.
    descent: {
      signature: [
        { sprite: 'devil-ray', species: 'mobula-munkiana', depth: 2.5, side: 'left', flip: true },
        { sprite: 'devil-ray', species: 'mobula-munkiana', depth: 2.5, side: 'left', flip: true, dx: 16, dy: -6, distance: 0.25 },
        { sprite: 'devil-ray', species: 'mobula-munkiana', depth: 2.5, side: 'left', flip: true, dx: 10, dy: 9, distance: 0.35 },
        { sprite: 'devil-ray', species: 'mobula-munkiana', depth: 2.5, side: 'left', flip: true, dx: 28, dy: 2, distance: 0.5 },
        { sprite: 'devil-ray', species: 'mobula-munkiana', depth: 6, side: 'right' },
        { sprite: 'devil-ray', species: 'mobula-munkiana', depth: 6, side: 'right', dx: 14, dy: 6, distance: 0.3 },
      ],
    },
    seed: 517,
    // Bright, shallow, greener water than The Reefs (Jeremy approved the direction, 2026-10-23):
    // the Sea of Cortez is plankton-rich, so the blue leans to green-turquoise, pale near the
    // surface and deepening only toward the sand. Light shafts stay on.
    lighting: {
      envTop: '#c6ece4',
      envHorizon: '#3c9c98',
      envDeep: '#14525a',
      fog: '#4a9e98',
      hemiSky: '#cdeee6',
      hemiGround: '#6a8a76',
      key: '#fff3dc',
      fill: '#3f8f94',
      density: 0.013,
      exposure: 1.1,
      backgroundStops: [
        [0, '#d2f1ea'],
        [0.25, '#8fd6cb'],
        [0.4, '#5bb8b0'],
        [0.5, '#3c9c98'],
        [0.65, '#2b7f80'],
        [0.8, '#1f666c'],
        [1, '#174f58'],
      ],
      heightFog: { low: '#4a9a94', high: '#9ee0d4', yLow: -28, yHigh: 4.6, strength: 0.8, seabedLight: 1 },
      backgroundBeamAlpha: 0.18,
      surfaceColor: '#b2e8dd',
      surfaceAttenuationColor: '#7ccfc2',
    },
    landscape: 'shallows',
    camera: SHALLOWS_VIEW,
    species: ['mobula-munkiana'],
  },
]

export const DEFAULT_TANK_ID = 'open-sea'

// Shared free-swimming profile for the remoras (Echeneidae). Off a host they are steady,
// agile swimmers, not sprinters; they never hover (they need water moving over the gills),
// and they read a shark as a ride, not a threat — hence near-zero wariness. Riding itself is
// the `hitchhiker` block on each species; see the ride section of fishSwim.js.
const REMORA_SWIM = {
  visualTimeScale: 0.6,
  driftEnabled: false,
  idleBLPerSec: [0.55, 0.85],
  idleDriftBLPerSec: [0.08, 0.16],
  snapBLPerSec: [0.9, 1.3],
  burstBLPerSec: [1.8, 2.6],
  burstInterval: [9.0, 16.0],
  burstActionDuration: 0.9,
  turnActionDuration: 0.6,
  erraticness: 0.12,
  turnRadiusBodyLengths: 1.2,
  speedMultiplier: 1.0,
  boundsUseSpeciesSize: false,
  boids: {
    neighborCap: 4,
    perceptionBodyLengths: 2.0,
    separationWeight: 0.2,
    alignmentWeight: 0,
    cohesionWeight: 0,
    maxWeight: 0.2,
    menace: 0.08,
    wariness: 0.05,
  },
}
// Riders share their host's swim volume, so every anchor on it stays reachable.
const OPEN_SEA_RIDER_BOUNDS = { movementBoundsScale: 1.22, boundsYMin: -14, boundsZMin: -26, boundsZMax: 4 }
const DRIFT_RIDER_BOUNDS = { movementBoundsScale: 1.35, boundsYMin: -14, boundsZMin: -25, boundsZMax: 0 }
// Reef fish reach down, back and forward to the rocks of The Reefs (landscapes.js): to y -19,
// above the basin's highest dune crest (-20.5), back to z -52, the canyon's front faces, and
// forward to z +8, among and in front of the foreground rocks (since dev_10, with the camera back
// at z 25: Jeremy,
// "can we have the fish swim closer also? so they also hang around the foreground rocks ... u may
// jsut expand the swim boundary. im okay with them swimming off screen also"). A box ±58 WU wide
// (boundsHalfX) rather than the shared wedge that narrows toward the old camera at z 12 (±13 at
// z 0, ±7.6 at z 5), so the foreground rocks on the right are in reach too; it spans the near
// massif on the right. Out to z +8 the faces of the foreground rocks that look toward the camera
// are in reach too. The sand climbs above the y -19 floor from z +2 (to -18.1 at z +6); fish are
// kept above it (rockObstacles.js liftAboveSeabed), so the floor follows the dunes there. A
// superset of the Mola's volume, so a cleaner following it still reaches every station.
const REEF_BOUNDS = { movementBoundsScale: 1.35, boundsYMin: -19, boundsZMin: -37, boundsZMax: 23, boundsHalfX: 58 }
// The humphead wrasse's labriform swim, shared by Jeremy's male and female models: the
// bannerfish's tuning (a stiff body that cruises on its pectorals and keeps its tail for bursts),
// slower for a 1 to 1.5 m fish. `amplitude` is in source units, so each model sets its own.
const HUMPHEAD_WRASSE_SWIM = {
  type: 'caudal-vertex',
  sourceAxis: 'z',
  lateralAxis: 'x',
  tailAtMaxZ: true,
  waveSpeed: 2.0,
  waveTravel: 3.0,
  flexStart: 0.5,
  flexFull: 0.9,
  turnStrength: 0.6,
  burstAmplitude: 1.1,
  response: 6,
  speedFrequencyBoost: 0.3,
  burstFrequencyBoost: 0.3,
  // Its pectorals are the engine at cruise, so they row harder than the grouper's.
  pectoralFinFlutter: 0.4,
  pelvicFinFlutter: 0.06,
}
// Length–weight for the slender echeneid body, fitted to the two published maxima:
// Echeneis naucrates 2.3 kg at 110 cm and Remora remora 1.1 kg at 86.4 cm (both ≈0.0017).
const REMORA_MASS = { coefficient: 0.0017, exponent: 3 }
// Stand-in model until the real GLBs land: generated by scripts/build-remora-placeholders.mjs
// to the same asset contract (unit length along Z, nose -Z, up +Y, origin mid-body, one body
// mesh) and animated through the real caudal-vertex wave. Swapping in a supplied model is a
// path/scale/mesh-name edit here plus a verifier target.
const REMORA_CAUDAL = {
  type: 'caudal-vertex',
  bodyMeshNames: ['remora-placeholder'],
  sourceAxis: 'z',
  lateralAxis: 'x',
  tailAtMaxZ: true,
  // Unit-length source, so amplitude is a fraction of body length (sardinella ≈0.036,
  // mahi ≈0.043 on the same measure).
  amplitude: 0.07,
  // A slow beat and a long wave: one gentle bend travelling down the body, not an eel's S
  // (4.4 and 4.6 read as snakes in Jeremy's review, 2026-09-28).
  waveSpeed: 3.0,
  waveTravel: 3.2,
  // The wave starts just ahead of the pectoral fins (0.18 of the length), so head and body
  // read as one piece; the disc rides the nearly still front.
  flexStart: 0.14,
  flexFull: 0.86,
  turnStrength: 0.03,
  burstAmplitude: 0.8,
  response: 8,
  speedFrequencyBoost: 0.4,
  burstFrequencyBoost: 0.3,
}
// Whale shark stroke, in the supplied model's source units (99.87 nose to tail tip), so the adult
// and juvenile scales share it. Slower and lazier than the mako's lamnid beat: a broad sweep of
// the tall tail with the front half nearly still, the wave starting behind the pectorals.
const WHALE_SHARK_CAUDAL = {
  type: 'caudal-vertex',
  bodyMeshNames: ['whaleshark'],
  sourceAxis: 'z',
  lateralAxis: 'x',
  tailAtMaxZ: true,
  // 0.035 body lengths, the mako's 0.03 a touch broader.
  amplitude: 3.5,
  waveSpeed: 1.4,
  waveTravel: 6.0,
  flexStart: 0.22,
  flexFull: 0.88,
  // The mako's 0.0144 body lengths of turn bend.
  turnStrength: 1.45,
  burstAmplitude: 0.5,
  response: 3.5,
  speedFrequencyBoost: 0.25,
  burstFrequencyBoost: 0.15,
  // Stiff shark pectorals: they trim and barely move.
  pectoralFinFlutter: 0.04,
}
function remoraPlaceholderModel(id, bodyLengthWU) {
  return {
    path: `/models/fish/${id}/${id}_placeholder.glb`,
    // Source length is 1, so the scale is the body length in WU.
    scale: bodyLengthWU,
    followAim: 'root',
    moveset: {
      cruise: 'procedural_cruise',
      drift: 'procedural_drift',
      turnLeft: 'procedural_turn_left',
      turnRight: 'procedural_turn_right',
      burst: 'procedural_burst',
    },
    proceduralAnimation: REMORA_CAUDAL,
    debugForwardOrigin: 'head',
    debugForwardOffsetRatio: 0.5,
  }
}

export const SPECIES = [
  {
    id: 'amblygaster-sirm',
    legacyIds: ['sardine'],
    name: 'Spotted Sardinella',
    scientificName: 'Amblygaster sirm',
    family: 'Dorosomatidae',
    alternateNames: ['Northern pilchard', 'Spotted pilchard', 'Spotted sardine', 'Trenched sardine'],
    biome: 'ocean',
    depthZone: 'epipelagic',
    schooling: true,
    repulser: false,
    aggressive: false,
    predator: false,
    tempo: 'sprint',
    conservationStatus: {
      system: 'IUCN Red List',
      code: 'LC',
      label: 'Least Concern',
    },
    atlasDetails: {
      commonDiet: 'Plankton, copepods, larvae.',
      foundIn: 'Indo-West Pacific coastal waters and lagoons.',
      maxLengthLabel: 'Standard length',
      sexualDimorphism: 'N/A',
      lifeSpan: 'Up to 8 years',
      maturityAge: '1 year (estimated)',
      social: {
        schoolSize: 'More than 1000',
        groupingBehaviour: 'Pelagic schooling fish in coastal waters and lagoons. Juveniles found closer inshore.',
        reproduction: 'Communal broadcast spawning. No pair bonding.',
      },
      averages: {
        maleSizeMeters: 0.20,
        femaleSizeMeters: 0.22,
        maleWeightKg: 0.05,
        femaleWeightKg: 0.07,
        maleLifeExpectancyYears: 8,
        femaleLifeExpectancyYears: 8,
      },
      lifecycle: {
        sexualMaturityYears: '1 year (estimated)',
        sexualSterilityYears: 'None known',
        offspringPerMatingEvent: '11,600 to 43,200 eggs',
      },
    },
    atlasSummary: {
      biome: 'Ocean',
      zone: 'Sunlight',
      diet: 'Copepods + larvae',
      social: 'Schooling',
    },
    description: 'A small, fast-schooling Indo-West Pacific sardinella with a slender silver body and a row of gold-to-dark flank spots. It lives in coastal waters and lagoons, feeding mostly on plankton, and reads in the reserve as a quick flicker of many bodies rather than a lone specimen.',
    atlasThumbnail: '/atlas/amblygaster-sirm-thumbnail.png',
    adultLengthRangeMeters: [0.15, 0.27],
    maxBodyLengthMeters: 0.27,
    swim: {
      // World Oceanarium scale: 1 WU = 25 cm. A. sirm maximum standard length ≈27 cm = 1.08 WU.
      bodyLengthWU: 1.08,
      // Keeps biologically grounded BL/s ratios readable in the aquarium camera.
      visualTimeScale: 0.35,
      idleBLPerSec: [1.0, 1.8],
      idleDriftBLPerSec: [0.18, 0.35],
      snapBLPerSec: [3.0, 5.0],
      burstBLPerSec: [5.0, 8.0],
      burstInterval: [5.5, 9.5],
      erraticness: 0.24,
      // Turn radius in body lengths — nimble bait, but still arcs forward through turns.
      turnRadiusBodyLengths: 2.0,
      // Bait balls range through the upper column; deepened for vertical spread.
      boundsYMin: -10,
      // Up to just under the water surface (SURFACE_PLANE_Y 4.6), where bait balls really do end up.
      // The epipelagic band stopped them at 2.83, an invisible ceiling 1.8 WU below the surface
      // that a school driven upward flattened against.
      boundsYMax: 3.9,
      boundsZMin: -15,
      boundsZMax: 8,
      boids: {
        // Nearest six, not fourteen: studies of schooling fish find a fish's one or two nearest
        // neighbours dominate how it moves (Katz et al. 2011), so averaging over fourteen blurred
        // the local interactions a school is made of.
        neighborCap: 6,
        perceptionBodyLengths: 3.4,
        // Boids-only model: strong alignment keeps the bait ball heading generally one way,
        // moderate cohesion + lighter separation keep it a tight-but-not-packed cloud (sparser
        // than the old spline ball, denser than a loose scatter). The formation slot supplies
        // the 3D shape so separation no longer needs to be cranked up to avoid a conga line.
        separationWeight: 0.30,
        alignmentWeight: 0.38,
        cohesionWeight: 0.20,
        maxWeight: 0.70,
        // Harmless bait, but very skittish — flees anything menacing (the mako most of all).
        menace: 0,
        wariness: 0.85,
      },
    },
    // Normalized individual size maps to roughly 15–27 cm standard length for Amblygaster sirm.
    sizeRange: [0.55, 1.0],
    mass: {
      // Length-weight estimate: grams = coefficient * bodyLengthCm^exponent.
      coefficient: 0.006,
      exponent: 3,
    },
    model: {
      path: '/models/fish/sardine/sardine_static.glb',
      scale: 0.42,
      // Rig-free static mesh: follow the moving Fish root, never an AABB center or bone.
      followAim: 'root',
      moveset: {
        cruise: 'procedural_cruise',
        drift: 'procedural_drift',
        turnLeft: 'procedural_turn_left',
        turnRight: 'procedural_turn_right',
        burst: 'procedural_burst',
      },
      proceduralAnimation: {
        type: 'caudal-vertex',
        sourceAxis: 'x',
        lateralAxis: 'z',
        tailAtMaxZ: false,
        amplitude: 0.065,
        waveSpeed: 5.2,
        waveTravel: 5.6,
        flexStart: 0.15,
        flexFull: 0.82,
        turnStrength: 0.04,
        burstAmplitude: 0.9,
        response: 11,
        speedFrequencyBoost: 0.5,
        burstFrequencyBoost: 0.42,
      },
    },
  },
  {
    id: 'coryphaena-hippurus',
    legacyIds: ['mahi-mahi', 'mahimahi', 'dolphinfish', 'dorado'],
    name: 'Mahi-mahi',
    scientificName: 'Coryphaena hippurus',
    family: 'Coryphaenidae',
    alternateNames: ['Common dolphinfish', 'Dorado'],
    biome: 'ocean',
    depthZone: 'epipelagic',
    // Adults travel alone or in loose male–female pairs, so they roam as solo agents and Biome
    // pairs them (advancePairFollow), rather than schooling. A long body (up to 8.4 WU) in a
    // narrow upper-column box: his station stays nearer her than the default.
    schooling: false,
    pairBonded: { stationBodyLengths: [0.5, 1.2] },
    repulser: false,
    aggressive: false,
    predator: true,
    tempo: 'cruise',
    conservationStatus: {
      system: 'IUCN Red List',
      code: 'LC',
      label: 'Least Concern',
    },
    atlasDetails: {
      commonDiet: 'Small fish, squid, crustaceans.',
      foundIn: 'Warm tropical and subtropical open ocean, often near floating cover.',
      sexualDimorphism: 'Males develop the tall blunt forehead/head profile; females keep a lower, more rounded head profile.',
      lifeSpan: 'Up to 4 years',
      maturityAge: '4 to 5 months',
      social: {
        schoolSize: '1 to 2',
        groupingBehaviour: 'Adults travel alone or in pairs, with occasional small loose groups near floating debris and weedlines. Juveniles may school in open water.',
        reproduction: 'Broadcast spawning in pairs or small groups in warm open water above 21°C. Multiple spawning events per season, around every 2 days; extended year-round season in the tropics.',
      },
      averages: {
        maleSizeMeters: 0.91,
        femaleSizeMeters: 0.91,
        maleWeightKg: 20,
        femaleWeightKg: 14,
        maleLifeExpectancyYears: 4,
        femaleLifeExpectancyYears: 4,
      },
      lifecycle: {
        sexualMaturityYears: '4 to 5 months',
        sexualSterilityYears: 'Reproductive until death',
        offspringPerMatingEvent: '80,000 to 1,000,000 eggs',
      },
    },
    atlasSummary: {
      biome: 'Ocean',
      zone: 'Sunlight',
      diet: 'Fish + squid',
      social: 'Solo / pairs',
    },
    atlasThumbnail: '/atlas/coryphaena-hippurus-thumbnail.png',
    description: 'A fast, flashing open-ocean hunter with a long dorsal fin, forked tail, and electric blue-green body that can flare brighter when excited. Adult Mahi-mahi cruise warm surface waters alone or in pairs, often gathering around floating cover before breaking into quick prey-chasing runs; juveniles may form larger schools.',
    adultLengthRangeMeters: [0.91, 2.1],
    maxBodyLengthMeters: 2.1,
    swim: {
      // World Oceanarium scale: 1 WU = 25 cm. Size 1.0 now maps to Jeremy's 2.1 m max body length.
      bodyLengthWU: 8.4,
      // Adult Mahi-mahi roam as loose pairs (`pairBonded`), not a school. The school keys
      // below only apply if it is ever made to school again; `schoolSpacingScale` also widens
      // its boid perception.
      schoolMaxSize: 2,
      schoolSpacingScale: 5.2,
      schoolMaxAvoidanceAngleDegrees: 18,
      schoolDirectionResponse: 3.2,
      // Raised from 0.48: mahi are fast open-water cruisers in reality and should
      // visibly outpace bait/drifters, not match their speed.
      visualTimeScale: 0.75,
      // Glide near-level. At the faster cruise speed the mahi tracks the vertical waviness of
      // its path eagerly enough to bob its nose up and down toward the generic ~13° limit;
      // with the follow-cam centring it, that pitch bob was the only apparent motion and read
      // as the fish hovering in place staring up and down. Cap it to a gentle glide.
      maxVisualPitchDegrees: 6,
      // The rendered heading must be the actual forward-moving pair trajectory, not a
      // faster visual smoothing pass that can make the long body pivot on its own.
      visualHeadingFollowsMotion: true,
      idleBLPerSec: [0.35, 0.55],
      idleDriftBLPerSec: [0.05, 0.10],
      snapBLPerSec: [0.52, 0.76],
      burstBLPerSec: [1.05, 1.35],
      burstInterval: [8.0, 14.0],
      driftInterval: [10.0, 18.0],
      driftDuration: [3.0, 5.5],
      burstActionDuration: 1.6,
      turnActionDuration: 1.05,
      // Raised so gentle sustained arcs keep swimming on the looping idle clip (tail
      // waving) and bank via curve-deform, rather than firing the long non-looping
      // snap clip that froze the body in a C-curl. Only sharp turns trigger the snap.
      turnTriggerThreshold: 0.3,
      erraticness: 0.08,
      // Cruiser turns, but sized to the mahi's confined upper-column bounds. The old 2.8 gave a
      // ~20 WU turn radius in a ~27 WU-wide box, so a pair that reached a wall/corner could not
      // out-turn it and just orbited in place (a constant curve that cocked the tails). 1.3 keeps
      // a broad, committed arc that still fits the box, so the mahi carves away and straightens.
      turnRadiusBodyLengths: 1.3,
      speedMultiplier: 1.0,
      movementBoundsScale: 1.18,
      boundsUseSpeciesSize: false,
      // Surface-associated (often near floating cover) — stays in the upper column.
      boundsYMin: -7,
      boundsZMin: -23,
      boundsZMax: 4,
      boids: {
        neighborCap: 1,
        perceptionBodyLengths: 2.1,
        separationWeight: 0.18,
        alignmentWeight: 0.05,
        cohesionWeight: 0.025,
        maxWeight: 0.18,
        // A capable mid predator: mildly menacing to bait, moderately wary of the mako.
        menace: 0.4,
        wariness: 0.5,
      },
    },
    // Normalized individual size maps directly to the 0–1 share of the 2.1 m max; DB rows use a truncated normal distribution centered near the 0.91 m average.
    sizeRange: [0, 1],
    mass: {
      // Broad length-weight placeholder tuned for readable card weights until curated fishery data lands.
      coefficient: 0.005,
      exponent: 3,
    },
    model: {
      // Base/fallback model, used only when a creature's sex matches no sexVariant
      // below. It points at the male static mesh rather than a rigged one so the
      // deprecated mahi-mahi_male.glb could be dropped: both variants are static
      // now, so nothing else referenced it.
      path: '/models/fish/mahi-mahi/mahi-mahi_male_static_parts.glb',
      sexVariants: {
        male: {
          path: '/models/fish/mahi-mahi/mahi-mahi_male_static_parts.glb',
          // Static, rig-free asset supplied for the procedural test. Longitudinal
          // influence derives from local Z bounds; no authored mask or skin weight.
          proceduralAnimation: {
            type: 'caudal-vertex',
            bodyMeshNames: ['mahi-combined'],
            sourceAxis: 'z',
            lateralAxis: 'x',
            tailAtMaxZ: true,
            amplitude: 0.42,
            waveSpeed: 2.6,
            // Mahi is a smaller, fast carangiform swimmer: hold the front firm and
            // confine the stroke to a compact rear-body C/flick instead of a shark S.
            waveTravel: 3.5,
            flexStart: 0.24,
            flexFull: 0.82,
            turnStrength: 0.32,
            burstAmplitude: 0.8,
            response: 7.5,
            speedFrequencyBoost: 0.32,
            burstFrequencyBoost: 0.24,
            pectoralFinFlutter: 0.13,
            pelvicFinFlutter: 0.075,
          },
        },
        female: {
          path: '/models/fish/mahi-mahi/mahi-mahi_female_static_parts.glb',
          proceduralAnimation: {
            type: 'caudal-vertex',
            bodyMeshNames: ['mahi-female'],
            sourceAxis: 'z',
            lateralAxis: 'x',
            tailAtMaxZ: true,
            amplitude: 0.4,
            waveSpeed: 2.55,
            // Keep the female's compact tail-led stroke matched to the male, without
            // giving this smaller pelagic fish the mako's long S silhouette.
            waveTravel: 3.5,
            flexStart: 0.24,
            flexFull: 0.82,
            turnStrength: 0.3,
            burstAmplitude: 0.78,
            response: 7.5,
            speedFrequencyBoost: 0.32,
            burstFrequencyBoost: 0.24,
            pectoralFinFlutter: 0.13,
            pelvicFinFlutter: 0.075,
          },
        },
      },
      // Source GLB is ~9.79 units nose-to-tail; scale maps size 1.0 to the 2.1 m / 8.4 WU max.
      scale: 0.858,
      // Both sex variants are rig-free static meshes; aim follow at the moving Fish root.
      // Keep the legacy name for compatibility with a future rigged variant, where it wins.
      followAim: 'root',
      followBone: 'spine001',
      moveset: {
        cruise: 'procedural_cruise',
        drift: 'procedural_drift',
        turnLeft: 'procedural_turn_left',
        turnRight: 'procedural_turn_right',
        burst: 'procedural_burst',
      },
      // Matches the male variant's config. This has to stay in step with the base
      // `path` above: it previously drove a bone chain (`spine.003`..`spine.007`),
      // which only worked because the base pointed at the rigged mahi-mahi_male.glb.
      // The static meshes carry no bones, so a bone-driven config here would leave
      // any creature that fell through to the base rendering completely still.
      proceduralAnimation: {
        type: 'caudal-vertex',
        bodyMeshNames: ['mahi-combined'],
        sourceAxis: 'z',
        lateralAxis: 'x',
        tailAtMaxZ: true,
        amplitude: 0.42,
        waveSpeed: 2.6,
        waveTravel: 3.5,
        flexStart: 0.24,
        flexFull: 0.82,
        turnStrength: 0.32,
        burstAmplitude: 0.8,
        response: 7.5,
        speedFrequencyBoost: 0.32,
        burstFrequencyBoost: 0.24,
        pectoralFinFlutter: 0.13,
        pelvicFinFlutter: 0.075,
      },
      debugForwardOrigin: 'head',
      // GLB origin sits near mid-body; nose is at +4.55 / 9.79 of the source length.
      debugForwardOffsetRatio: 0.465,
    },
  },
  {
    id: 'isurus-oxyrinchus',
    legacyIds: ['shortfin-mako', 'short-fin-mako', 'mako-shark'],
    name: 'Shortfin Mako Shark',
    scientificName: 'Isurus oxyrinchus',
    family: 'Lamnidae',
    alternateNames: ['Shortfin mako', 'Blue pointer', 'Bonito shark'],
    biome: 'ocean',
    depthZone: 'epipelagic',
    schooling: false,
    repulser: true,
    aggressive: false,
    predator: true,
    tempo: 'cruise',
    conservationStatus: {
      system: 'IUCN Red List',
      code: 'EN',
      label: 'Endangered',
    },
    atlasDetails: {
      commonDiet: 'Fish, squid, other fast pelagic prey.',
      foundIn: 'Temperate and tropical open ocean, from surface waters into deeper offshore zones.',
      sexualDimorphism: 'Females grow larger than males.',
      lifeSpan: 'Up to 32 years',
      maturityAge: 'Males 7 to 9 years; females 18 to 21 years',
      social: {
        schoolSize: 1,
        groupingBehaviour: 'Mostly solitary open-ocean predator, occasionally near prey concentrations.',
        reproduction: 'Internal fertilization with live young; embryos develop in the uterus and feed on unfertilized eggs. No parental care after birth.',
      },
      averages: {
        maleSizeMeters: 2.0,
        femaleSizeMeters: 2.8,
        maleWeightKg: 60,
        femaleWeightKg: 140,
        maleLifeExpectancyYears: 29,
        femaleLifeExpectancyYears: 32,
      },
      lifecycle: {
        sexualMaturityYears: 'Males 7 to 9 years; females 18 to 21 years',
        sexualSterilityYears: 'None known',
        offspringPerMatingEvent: '4 to 25 pups',
      },
    },
    atlasSummary: {
      biome: 'Ocean',
      zone: 'Sunlight',
      diet: 'Fish + squid',
      social: 'Solitary',
    },
    description: 'A lean, metallic-blue lamnid built for fast open-water pursuit. The shortfin mako should read as a committed pelagic hunter: long glides, rare sharp acceleration, and broad turns that carry its body through the water rather than twitching like a small schooling fish.',
    atlasThumbnail: '/atlas/isurus-oxyrinchus-thumbnail.png',
    adultLengthRangeMeters: [2.0, 4.45],
    maxBodyLengthMeters: 4.45,
    swim: {
      // World Oceanarium scale: 1 WU = 25 cm. Review max maps 4.45 m to 17.8 WU.
      bodyLengthWU: 17.8,
      // Raised from 0.38 to 0.95 (~2.5×) so the mako clearly leads the tank at roughly the
      // real mako-vs-mahi cruise ratio (~1.5×). This speed used to make it overshoot the
      // solo-agent boundary envelope on U-turns and get snapped back inward (reading as
      // strafing backward); it is now held cleanly by the predictive boundary-avoidance
      // steering in Fish.jsx (boundaryAvoidanceTurnStep), so it keeps its wide banking
      // turns in open water and simply carves tighter as it nears a wall.
      visualTimeScale: 0.95,
      // The shark's visual nose/heading must stay welded to its turn-capped patrol arc.
      // Do not visually rotate it ahead of its body translation near walls or on U-turns.
      visualHeadingFollowsMotion: true,
      // Mako never settles into a hover/drift beat: it continually patrols forward,
      // with only a small speed-breathing variation around its 20%-faster cruise.
      driftEnabled: false,
      idleBLPerSec: [0.24, 0.36],
      idleDriftBLPerSec: [0.036, 0.066],
      snapBLPerSec: [0.288, 0.432],
      burstBLPerSec: [0.528, 0.792],
      burstInterval: [18.0, 30.0],
      burstActionDuration: 4.8,
      turnActionDuration: 3.2,
      turnTriggerThreshold: 0.042,
      erraticness: 0.018,
      // Apex pelagic shark: long glides and wide banking turns, never a pivot. Sized to the
      // tightened bounds below (the old 2.6 gave a ~41 WU radius that could not out-turn the
      // envelope and overshot into hard clamps at the tank edges); 1.7 keeps a broad, committed
      // arc that still fits so the mako carves away cleanly instead of snapping back.
      turnRadiusBodyLengths: 1.7,
      speedMultiplier: 1.0,
      // Pulled in from 1.48 / z -36 so the mako stays a visible presence in the main tank instead
      // of roaming far off-screen most of the time; still the widest-ranging fish in the tank.
      movementBoundsScale: 1.22,
      soloTargetVerticalBodyLengths: 0.18,
      boundsUseSpeciesSize: false,
      // Ranges from the surface into deeper offshore water — deep diver.
      boundsYMin: -14,
      boundsZMin: -26,
      boundsZMax: 4,
      boids: {
        // Apex solo hunter: sees few neighbors, is unbothered by others, but reads as
        // maximally menacing so nearly everything else steers away from it.
        neighborCap: 3,
        perceptionBodyLengths: 1.4,
        separationWeight: 0.05,
        alignmentWeight: 0,
        cohesionWeight: 0,
        maxWeight: 0.06,
        selfAvoidanceScale: 0.1,
        menace: 0.95,
        wariness: 0.08,
      },
    },
    // Where remoras ride. Measured off shortfinmako003 in the runtime model frame (+X right,
    // +Y up, +Z tail; the root sits ~30% back from the snout) and divided by 17.8 WU. All four
    // anchors sit in the front third, ahead of where the caudal wave starts to swing the body
    // (flexStart 0.18 of the mesh length), so a clamped remora sways less than 0.05 WU against it.
    rideHost: {
      groups: ['shark', 'large-fish'],
      // Attach points sampled over shortfinmako003's faces by their normals and fitted to its
      // skin (scripts/fit-ride-anchors.mjs -> src/data/rideAnchors.js): belly and flanks from
      // 12% to 50% of the length, as uneven as the mesh, clear of the pectoral fins. `rail` is
      // the skin's height along each normal; riders are laid along it (rideAnchorFit).
      anchors: RIDE_ANCHORS['isurus-oxyrinchus'].anchors,
      waveSpan: RIDE_ANCHORS['isurus-oxyrinchus'].waveSpan,
      // Clearance ellipsoid riders route around: centre (0, -0.1, 3.0) WU, radii (2.2, 1.9,
      // 8.8) WU — the body and pectoral fins from snout to caudal peduncle.
      body: { center: [0, -0.0056, 0.1685], radii: [0.1236, 0.1067, 0.4944] },
    },
    // Review spread maps individuals to roughly 2.9–4.45 m while the Atlas shows the species maximum.
    sizeRange: [0.65, 1.0],
    mass: {
      // Broad length-weight placeholder until curated shark body-condition data lands.
      coefficient: 0.004,
      exponent: 3,
    },
    model: {
      path: '/models/fish/isurus-oxyrinchus/isurus-oxyrinchus_static_parts.glb',
      // Source GLB is ~40.18 units nose-to-tail; scale maps size 1.0 to 4.45 m / 17.8 WU.
      scale: 0.443,
      // Rig-free static mesh: follow the moving Fish root, never an AABB center or bone.
      followAim: 'root',
      moveset: {
        cruise: 'procedural_cruise',
        drift: 'procedural_drift',
        turnLeft: 'procedural_turn_left',
        turnRight: 'procedural_turn_right',
        burst: 'procedural_burst',
      },
      proceduralAnimation: {
        type: 'caudal-vertex',
        bodyMeshNames: ['shortfinmako003'],
        // The teeth are a second material split; they move with the jaw under them.
        followBodyMeshNames: ['shortfinmako003_1'],
        sourceAxis: 'z',
        lateralAxis: 'x',
        tailAtMaxZ: true,
        amplitude: 1.2,
        // Large lamnid power: a strong travelling phase runs from the pectorals into a
        // counter-curving tail. The wave starts ahead of the pectoral roots (0.25 of the
        // length) so the body reads as one piece from the head back, rather than a stiff
        // front and a waving tail, while the head itself stays on intent.
        waveSpeed: 2.4,
        waveTravel: 7.4,
        flexStart: 0.1,
        flexFull: 0.86,
        turnStrength: 0.58,
        burstAmplitude: 0.82,
        response: 4.8,
        speedFrequencyBoost: 0.28,
        burstFrequencyBoost: 0.22,
        // Pelvic fins are welded into shortfinmako003 in the supplied replacement
        // GLB, so they ride the same continuous body wave and cannot detach.
        pectoralFinFlutter: 0.06,
      },
      debugForwardOrigin: 'head',
      // The origin sits 28.02 source units from the tail tip over the ~40.18 span, so the nose is
      // 12.16 ahead of it: 0.303. (This read 0.697, measured from the tail end, which started the
      // debug vectors ~6.7 WU past the snout.) A live mesh check agrees: at 16.68 WU the snout is
      // 4.9 WU ahead of the origin and the tail tip 11.6 WU behind.
      debugForwardOffsetRatio: 0.303,
    },
  },
  {
    id: 'mola-alexandrini',
    legacyIds: ['mola-mola'],
    legacyNames: ['Ocean Sunfish', 'Bumphead Sunfish'],
    name: 'Giant Sunfish',
    scientificName: 'Mola alexandrini',
    family: 'Molidae',
    alternateNames: ["Bumphead sunfish", "Bump-head sunfish", "Ramsay's sunfish", 'Southern ocean sunfish', 'Southern sunfish', 'Short sunfish'],
    biome: 'ocean',
    depthZone: 'epipelagic',
    schooling: false,
    repulser: true,
    aggressive: false,
    predator: false,
    tempo: 'drift',
    conservationStatus: {
      system: 'IUCN Red List',
      code: 'NE',
      label: 'Not Evaluated',
    },
    atlasDetails: {
      commonDiet: 'Jellyfish, salps, soft-bodied prey.',
      foundIn: 'Open ocean outside polar regions.',
      sexualDimorphism: 'N/A',
      lifeSpan: 'About 21 years (estimated)',
      maturityAge: 'About 7 years, at about 1.5 m (estimated)',
      social: {
        schoolSize: 1,
        groupingBehaviour: 'Adults are reported to travel mainly alone or in pairs, and sometimes in groups. Juveniles loosely school for predator protection, dispersing at maturity.',
        reproduction: 'Broadcast spawning in open water; adults briefly aggregate to spawn. No parental care.',
      },
      averages: {
        // No age study for this species; life expectancy is the FishLife estimate (see lifecycle).
        maleSizeMeters: 2.5,
        femaleSizeMeters: 3.3,
        maleWeightKg: 1000,
        femaleWeightKg: 2300,
        maleLifeExpectancyYears: 'About 21 years (estimated)',
        femaleLifeExpectancyYears: 'About 21 years (estimated)',
      },
      lifecycle: {
        // Ages are FishLife estimates (Thorson et al. 2017) for the genus Mola, which rest mostly on the
        // ocean sunfish's data (tmax 21 years, maturity 6.8 years at 151 cm); no age study of this
        // species.
        // No fecundity study for this species (the ocean sunfish, Mola mola, carries about 300 million
        // eggs).
        sexualMaturityYears: 'About 7 years, at about 1.5 m (estimated)',
        sexualSterilityYears: 'None known',
        offspringPerMatingEvent: 'Unknown',
      },
    },
    atlasSummary: {
      biome: 'Ocean',
      zone: 'Sunlight',
      diet: 'Soft-bodied prey',
      social: 'Solitary',
    },
    description: 'The giant sunfish rows its tall dorsal and anal fins together, usually traveling alone through open water after maturity. Also known as the bumphead sunfish and Ramsay\'s sunfish, it can briefly aggregate to broadcast spawn before returning to solitary cruising, deep soft-bodied prey hunts, and sideways surface basking.',
    adultLengthRangeMeters: [1.6, 3.3],
    maxBodyLengthMeters: 3.3,
    atlasThumbnail: '/atlas/mola-alexandrini-thumbnail.png',
    swim: {
      // World Oceanarium scale: 1 WU = 25 cm. Adults render at their factual size:
      // Mola alexandrini reaches ~3.3 m total length = 13.2 WU (matches the Atlas female average).
      bodyLengthWU: 13.2,
      visualTimeScale: 1.0,
      idleBLPerSec: [0.0624, 0.1104],
      idleDriftBLPerSec: [0.010, 0.020],
      snapBLPerSec: [0.085, 0.12],
      burstBLPerSec: [0.15, 0.2175],
      burstInterval: [13.0, 20.0],
      driftInterval: [20.0, 34.0],
      driftDuration: [7.0, 12.0],
      burstActionDuration: 10.0,
      turnActionDuration: 10.0,
      turnTriggerThreshold: 0.0045,
      erraticness: 0.055,
      // Slow gelatinous drifter: gentle, wide turns.
      turnRadiusBodyLengths: 2.0,
      speedMultiplier: 1.0,
      movementBoundsScale: 1.35,
      boundsBodyLengthWU: 1.08,
      boundsUseSpeciesSize: false,
      // Basks at the surface but also makes deep dives — full-column diver.
      boundsYMin: -14,
      boundsZMin: -25,
      boundsZMax: 0,
      boids: {
        neighborCap: 4,
        perceptionBodyLengths: 1.25,
        separationWeight: 0.05,
        alignmentWeight: 0,
        cohesionWeight: 0,
        maxWeight: 0.05,
        selfAvoidanceScale: 0.04,
        repulsionScale: 2.8,
        // A gentle giant: harmless, so nobody flees it, and it barely reacts to anything.
        menace: 0.03,
        wariness: 0.12,
      },
    },
    // Where remoras ride: the flanks, clear of the rowing dorsal/anal fin roots and the
    // pectorals. Measured off mesh 10001003 in the runtime model frame and divided by the
    // 13.2 WU body length. The Mola body is rigid, so a clamped rider cannot drift off it.
    rideHost: {
      groups: ['sunfish', 'large-fish'],
      // Sampled over 10001003's faces like the mako's, from 15% to 70% of the length, skipping
      // every face its motion mask paints as a flapping fin.
      anchors: RIDE_ANCHORS['mola-alexandrini'].anchors,
      waveSpan: RIDE_ANCHORS['mola-alexandrini'].waveSpan,
      // Clearance ellipsoid riders route around: centre (0, 0, -0.1) WU, radii (1.5, 3.4,
      // 5.4) WU — the disc of the body, not the tall dorsal and anal fins, which riders pass
      // by going round the nose or tail rather than over the top.
      body: { center: [0, 0, -0.0076], radii: [0.1136, 0.2576, 0.4091] },
    },
    // Normalized individual size maps to roughly 248–330 cm total length (male average → female maximum).
    sizeRange: [0.75, 1.0],
    mass: {
      // Broad placeholder estimate until curated species/body-condition data lands.
      coefficient: 0.018,
      exponent: 3,
    },
    model: {
      path: '/models/fish/mola-alexandrini/mola-alexandrini.glb',
      // Jeremy's static GLB retains the established world bounds and +Z swim-forward
      // orientation, while color_1 encodes dorsal/anal/clavus/pectoral motion masks.
      rotation: [0, 0, 0],
      scale: 0.638,
      // Rig-free static mesh: follow the moving Fish root, never an AABB center or bone.
      followAim: 'root',
      moveset: {
        cruise: 'procedural_cruise',
        drift: 'procedural_drift',
        turnLeft: 'procedural_turn_left',
        turnRight: 'procedural_turn_right',
        burst: 'procedural_burst',
        sunBaskLeft: 'procedural_sun_bask_left',
        sunBaskRight: 'procedural_sun_bask_right',
      },
      proceduralAnimation: {
        type: 'mola-mask-vertex',
        bodyMeshNames: ['10001003'],
        // COLOR_0 remains white material data. Blender exported the painted mask as
        // COLOR_1, exposed by Three as color_1: R dorsal, G anal, B clavus, RGB-grey pectorals.
        maskAttribute: 'color_1',
        // Very slow, deliberate sculling: let the heavy disc settle between strokes.
        waveSpeed: 0.46,
        // Both fins rotate around the forward raw-X axis from their individual
        // mask-derived roots, so their tips trace arcs instead of translating.
        finRotationRadians: 0.30,
        dorsalRootYZ: [0, -0.08716],
        analRootYZ: [0, 0.14121],
        // Preserve the artist's uninterrupted soft mask ramp; the shader uses
        // gentler zero-slope quintic easing at each rigid root. Dorsal/anal de-sync.
        dorsalPhaseOffset: 0,
        analPhaseOffset: 1.08,
        analPhaseRate: 0.91,
        pectoralAmplitude: 0.014,
        clavusAmplitude: 0.016,
        turnStrength: 0.012,
        burstAmplitude: 0.38,
        response: 3.2,
        speedFrequencyBoost: 0.10,
        burstFrequencyBoost: 0.08,
        // Only during the existing passive drift state: a subtle, slow settling roll.
        idleDriftRollRadians: 0.035,
        idleDriftRollFrequency: 0.18,
      },
    },
    placeholder: {
      type: 'mola-mola',
      bodyColor: '#8fb8bc',
      finColor: '#6f9fa4',
    },
  },
  // --- Remoras (Echeneidae) ------------------------------------------------------------------
  // Facts from FishBase species summaries unless noted. No supplied models yet: each renders a
  // generated stand-in (remoraPlaceholderModel) until its GLB lands. `hitchhiker.hosts` weights come
  // from each species' documented host range (1 = its usual host, lower = recorded but
  // occasional); host groups are declared by host species in `rideHost.groups`.
  {
    id: 'echeneis-naucrates',
    name: 'Live Sharksucker',
    scientificName: 'Echeneis naucrates',
    family: 'Echeneidae',
    alternateNames: ['Sharksucker', 'Suckerfish'],
    // Jeremy's close-up capture from the tank (2026-09-28): the head reads at tile size.
    atlasThumbnail: '/atlas/echeneis-naucrates-thumbnail.png',
    // With its fins hanging down, the fish's centre sits ~56% of the way down the photo; showing
    // a band from lower in it centres the fish in the wide tile (Jeremy's review, mobile).
    atlasThumbnailPosition: '50% 72%',
    biome: 'ocean',
    depthZone: 'epipelagic',
    schooling: false,
    repulser: false,
    aggressive: false,
    predator: false,
    tempo: 'cruise',
    conservationStatus: {
      system: 'IUCN Red List',
      code: 'LC',
      label: 'Least Concern',
    },
    atlasDetails: {
      commonDiet: 'Small fishes, host scraps, host parasites.',
      foundIn: 'Tropical and warm-temperate seas worldwide except the eastern Pacific, inshore to offshore, 1 to 85 m.',
      sexualDimorphism: 'Unknown',
      lifeSpan: 'Unknown',
      maturityAge: 'Unknown',
      social: {
        schoolSize: 'N/A',
        groupingBehaviour: 'Rides sharks, rays, large bony fishes, sea turtles, whales, dolphins, and even ships, but is often found swimming free in shallow inshore water. Juveniles act as cleaners for parrotfishes.',
        reproduction: 'Unknown',
      },
      averages: {
        // Bachman et al. 2018 (J. Fish Biol., eastern Gulf of Mexico): mean asymptotic standard length
        // 47.7 cm for males and 60.3 cm for females. Weights from FishBase's length–weight (a 0.00263,
        // b 3.17, total length; SL about 0.87 TL). No maximum age published.
        maleSizeMeters: 0.48,
        femaleSizeMeters: 0.6,
        maleWeightKg: 0.86,
        femaleWeightKg: 1.8,
        maleLifeExpectancyYears: 'Unknown',
        femaleLifeExpectancyYears: 'Unknown',
      },
      lifecycle: {
        // Bachman et al. 2018: a batch spawner, 39.5 eggs per gram of body weight per batch, so about
        // 70,000 for a 1.8 kg female; spawns in late summer.
        sexualMaturityYears: 'Unknown',
        sexualSterilityYears: 'None known',
        offspringPerMatingEvent: 'About 70,000 eggs per batch',
      },
    },
    atlasSummary: {
      biome: 'Ocean',
      zone: 'Sunlight',
      diet: 'Scraps + parasites',
      social: 'Hitchhiker',
    },
    description: 'The largest remora, reaching 1.1 m. Its first dorsal fin has become an oval suction disc on top of the head, a dark, white-edged stripe runs along each flank, and the lower jaw juts well past the upper. It takes almost any large ride — sharks, rays, turtles, whales, even ships — yet is often found swimming free inshore, so it should read as a rider that comes and goes: long stretches clamped under the mako, then a spell on its own.',
    adultLengthRangeMeters: [0.66, 1.1],
    maxBodyLengthMeters: 1.1,
    swim: {
      ...REMORA_SWIM,
      ...OPEN_SEA_RIDER_BOUNDS,
      // 1 WU = 25 cm: 1.1 m maximum total length = 4.4 WU.
      bodyLengthWU: 4.4,
    },
    // Individuals span roughly the 66 cm common length to the 1.1 m maximum.
    sizeRange: [0.6, 1.0],
    mass: REMORA_MASS,
    hitchhiker: {
      hosts: { shark: 1, ray: 0.8, turtle: 0.8, cetacean: 0.5, 'large-fish': 0.5 },
      rideSeconds: [40, 100],
      freeSeconds: [20, 45],
      // Measured off the supplied model by scripts/fit-rider-model.mjs. The front lobes of the
      // second dorsal fin and the upper caudal lobe stand ~4.5 cm proud of the line from the
      // disc to the tail, so the rider pivots on its disc until they clear the host's skin.
      discAheadBodyLengths: 0.3522,
      dorsalClearanceBodyLengths: 0.0371,
      backProfile: [[-0.1453, 0.0382], [-0.1253, 0.0352], [-0.1153, 0.0226], [-0.1053, 0.0182], [-0.0653, 0.0093], [-0.0153, 0.0038], [0.0447, 0.0001], [0.0947, 0.0017], [0.1047, 0.0025], [0.1147, 0.0048], [0.1447, 0.0053], [0.2347, -0.0005], [0.3247, -0.0021], [0.3347, -0.006], [0.3647, -0.021], [0.3947, -0.0332], [0.4147, -0.0397], [0.4247, -0.0418], [0.4347, -0.04], [0.4447, -0.0359], [0.4647, -0.0213], [0.4847, -0.0119], [0.5347, 0.0051], [0.5447, 0.0073], [0.6747, 0.0273], [0.7147, 0.0302], [0.7547, 0.024], [0.7747, 0.0068], [0.8047, -0.0256], [0.8247, -0.0363], [0.8347, -0.036], [0.8447, 0.0026]],
    },
    model: {
      path: '/models/fish/echeneis-naucrates/echeneis-naucrates.glb',
      // Source length 6.6014 -> 4.4 WU. The supplied origin sits 31% back from the snout and
      // off the midline; `position` recentres the root mid-length on the body axis, the frame
      // the ride fit and the stand-ins use (scripts/fit-rider-model.mjs).
      scale: 0.6665,
      position: [-0.093, -0.0572, -0.8437],
      followAim: 'root',
      moveset: {
        cruise: 'procedural_cruise',
        drift: 'procedural_drift',
        turnLeft: 'procedural_turn_left',
        turnRight: 'procedural_turn_right',
        burst: 'procedural_burst',
      },
      proceduralAnimation: {
        ...REMORA_CAUDAL,
        // GLTFLoader splits the body mesh by material: `_1` is the body (dorsal, anal, and
        // caudal fins welded in), `_2` the suction disc, which moves with the head under it.
        bodyMeshNames: ['live_sharksucker_1'],
        followBodyMeshNames: ['live_sharksucker_2'],
        // The stand-ins' stroke, 0.07 and 0.03 body lengths, in this model's source units.
        amplitude: 0.462,
        turnStrength: 0.198,
        // Separate pectoral and pelvic fins, both ahead of flexStart.
        pectoralFinFlutter: 0.09,
        pelvicFinFlutter: 0.05,
      },
      debugForwardOrigin: 'head',
      debugForwardOffsetRatio: 0.5,
    },
  },
  {
    id: 'echeneis-neucratoides',
    name: 'Whitefin Sharksucker',
    scientificName: 'Echeneis neucratoides',
    family: 'Echeneidae',
    alternateNames: [],
    // Jeremy's tank capture (2026-10-09): a full side-on body under the host's fins.
    atlasThumbnail: '/atlas/echeneis-neucratoides-thumbnail.png',
    biome: 'ocean',
    depthZone: 'epipelagic',
    schooling: false,
    repulser: false,
    aggressive: false,
    predator: false,
    tempo: 'cruise',
    conservationStatus: {
      system: 'IUCN Red List',
      code: 'DD',
      label: 'Data Deficient',
    },
    atlasDetails: {
      commonDiet: 'Host scraps, host parasites.',
      foundIn: 'Western Atlantic, Massachusetts to northern South America including the Gulf of Mexico; reefs and offshore.',
      sexualDimorphism: 'Unknown',
      lifeSpan: 'Unknown',
      maturityAge: 'Unknown',
      social: {
        schoolSize: 'N/A',
        groupingBehaviour: 'Travels attached to large fishes, sharks, rays, sea turtles, dolphins, whales, and ships, or swims free over shallow coral reefs.',
        reproduction: 'Unknown',
      },
      averages: {
        // FishBase common length (total length); no sex-specific data.
        // Weight from FishBase's length–weight (a 0.00263, b 3.17) at the common length. No age data.
        maleSizeMeters: 0.5,
        femaleSizeMeters: 0.5,
        maleWeightKg: 0.64,
        femaleWeightKg: 0.64,
        maleLifeExpectancyYears: 'Unknown',
        femaleLifeExpectancyYears: 'Unknown',
      },
      lifecycle: {
        sexualMaturityYears: 'Unknown',
        sexualSterilityYears: 'None known',
        offspringPerMatingEvent: 'Unknown',
      },
    },
    atlasSummary: {
      biome: 'Ocean',
      zone: 'Sunlight',
      diet: 'Scraps + parasites',
      social: 'Hitchhiker',
    },
    description: 'The western Atlantic cousin of the live sharksucker, smaller at up to 75 cm. It is told apart by the broad white tips of its dorsal, anal, and tail fins, and by a suction disc with fewer plates — 18 to 22 lamellae against the live sharksucker\'s 23 to 28. It rides large fishes, sharks, rays, turtles, and whales, or swims free over shallow reefs.',
    adultLengthRangeMeters: [0.5, 0.75],
    maxBodyLengthMeters: 0.75,
    swim: {
      ...REMORA_SWIM,
      ...OPEN_SEA_RIDER_BOUNDS,
      // 75 cm maximum total length = 3.0 WU.
      bodyLengthWU: 3.0,
    },
    sizeRange: [0.67, 1.0],
    mass: REMORA_MASS,
    hitchhiker: {
      hosts: { shark: 1, ray: 0.8, turtle: 0.8, cetacean: 0.5, 'large-fish': 0.5 },
      rideSeconds: [40, 100],
      freeSeconds: [20, 45],
      // Measured from the supplied GLB by scripts/fit-rider-model.mjs. The disc is 35% of
      // the body length ahead of the recentered root; the profile keeps the whitefin's raised
      // dorsal/caudal lobes clear while the disc remains seated on the host skin.
      discAheadBodyLengths: 0.3504,
      dorsalClearanceBodyLengths: 0.0497,
      backProfile: [[-0.1471, 0.0241], [-0.1371, 0.0224], [-0.1271, 0.0228], [-0.1171, 0.0196], [-0.0971, 0.0152], [-0.0871, 0.0117], [-0.0371, 0.0051], [-0.0071, 0.0033], [0.0729, 0.0002], [0.0829, 0.0001], [0.0929, 0.0012], [0.1829, 0.0001], [0.2829, 0.0032], [0.3829, 0.008], [0.5029, -0.0067], [0.5129, -0.0039], [0.5529, 0.0109], [0.6029, 0.0231], [0.6429, 0.0313], [0.7129, 0.041], [0.7229, 0.0436], [0.7329, 0.0442], [0.7429, 0.0408], [0.7529, 0.0346], [0.7929, -0.0024], [0.8029, -0.01], [0.8129, -0.0162], [0.8229, -0.0217], [0.8329, -0.0255], [0.8429, -0.0233]],
    },
    model: {
      path: '/models/fish/echeneis-neucratoides/echeneis-neucratoides.glb',
      // Supplied source body length is fitted by scripts/fit-rider-model.mjs.
      // The root is recentred on the body axis so host skin fitting uses the same frame
      // as the generated remora stand-ins.
      scale: 0.5463,
      position: [0, -0.008, -0.734],
      followAim: 'root',
      moveset: {
        cruise: 'procedural_cruise',
        drift: 'procedural_drift',
        turnLeft: 'procedural_turn_left',
        turnRight: 'procedural_turn_right',
        burst: 'procedural_burst',
      },
      proceduralAnimation: {
        ...REMORA_CAUDAL,
        // The supplied GLB is rig-free. Its main body carries the long dorsal, anal,
        // and caudal surfaces; the second material split is the rigid suction disc.
        bodyMeshNames: ['e_neucratoides_(2)'],
        followBodyMeshNames: ['e_neucratoides_(2)_1'],
        // Keep the front rigid and give the smaller whitefin a compact rear stroke.
        amplitude: 0.385,
        turnStrength: 0.165,
        pectoralFinFlutter: 0.08,
        pelvicFinFlutter: 0.04,
      },
      debugForwardOrigin: 'head',
      debugForwardOffsetRatio: 0.5,
    },
  },
  {
    id: 'remora-remora',
    name: 'Common Remora',
    scientificName: 'Remora remora',
    family: 'Echeneidae',
    alternateNames: ['Shark sucker', 'Remora'],
    biome: 'ocean',
    depthZone: 'epipelagic',
    schooling: false,
    repulser: false,
    aggressive: false,
    predator: false,
    tempo: 'cruise',
    conservationStatus: {
      system: 'IUCN Red List',
      code: 'LC',
      label: 'Least Concern',
    },
    atlasDetails: {
      commonDiet: 'Parasitic copepods, host scraps, plankton.',
      foundIn: 'Warm seas worldwide, 0 to 200 m.',
      sexualDimorphism: 'Unknown',
      lifeSpan: 'Unknown',
      maturityAge: 'Unknown',
      social: {
        schoolSize: 'N/A',
        groupingBehaviour: 'Usually rides sharks, but also other large fishes, sea turtles, whales, dolphins, and ships. Only sometimes found swimming free.',
        reproduction: 'Mating pairs may share one host. Spawning is poorly known.',
      },
      averages: {
        // FishBase common length (total length); no sex-specific data.
        // Weight from FishBase's length–weight (a 0.00263, b 3.17) at the common length. No age data.
        maleSizeMeters: 0.4,
        femaleSizeMeters: 0.4,
        maleWeightKg: 0.32,
        femaleWeightKg: 0.32,
        maleLifeExpectancyYears: 'Unknown',
        femaleLifeExpectancyYears: 'Unknown',
      },
      lifecycle: {
        sexualMaturityYears: 'Unknown',
        sexualSterilityYears: 'None known',
        offspringPerMatingEvent: 'Unknown',
      },
    },
    atlasSummary: {
      biome: 'Ocean',
      zone: 'Sunlight',
      diet: 'Copepods + scraps',
      social: 'Hitchhiker',
    },
    description: 'The classic shark rider. Most stay under 40 cm, though the largest reach 86 cm, and the body is brown, black, or grey. It picks parasitic copepods off its host and takes scraps and plankton, and is only sometimes found swimming free — so in the reserve it should spend long stretches clamped to the mako and short ones on its own.',
    adultLengthRangeMeters: [0.4, 0.864],
    maxBodyLengthMeters: 0.864,
    swim: {
      ...REMORA_SWIM,
      ...OPEN_SEA_RIDER_BOUNDS,
      // 86.4 cm maximum total length = 3.456 WU.
      bodyLengthWU: 3.456,
    },
    sizeRange: [0.46, 1.0],
    mass: REMORA_MASS,
    hitchhiker: {
      hosts: { shark: 1, turtle: 0.5, cetacean: 0.4, 'large-fish': 0.4 },
      rideSeconds: [80, 180],
      freeSeconds: [10, 25],
      discAheadBodyLengths: 0.29,
    },
    model: remoraPlaceholderModel('remora-remora', 3.456),
    // Out of the Atlas until its model lands: it still renders a generated stand-in.
    hiddenInAtlas: true,
    placeholder: { type: 'remora', bodyColor: '#5a4b3f', discLength: 0.32 },
  },
  {
    id: 'remora-albescens',
    name: 'White Suckerfish',
    scientificName: 'Remora albescens',
    family: 'Echeneidae',
    alternateNames: ['White remora'],
    biome: 'ocean',
    depthZone: 'epipelagic',
    schooling: false,
    repulser: false,
    aggressive: false,
    predator: false,
    tempo: 'cruise',
    conservationStatus: {
      system: 'IUCN Red List',
      code: 'LC',
      label: 'Least Concern',
    },
    atlasDetails: {
      commonDiet: 'Unknown; barely any parasitic copepods.',
      foundIn: 'Warm seas worldwide, oceanic, to 200 m.',
      maxLengthLabel: 'Standard length',
      sexualDimorphism: 'Unknown',
      lifeSpan: 'Unknown',
      maturityAge: 'Unknown',
      social: {
        schoolSize: 'N/A',
        groupingBehaviour: 'Host-specific on manta rays, often inside the host\'s mouth and gill chambers. Occasionally attaches to sharks and black marlin; rarely found free.',
        reproduction: 'Unknown',
      },
      averages: {
        // No measured average, so FishBase's Life-history tool estimate: L_opt, the length at which an
        // unfished cohort is heaviest (Froese & Binohlan 2000, from the maximum length):
        // 19.3 cm SL from 30 cm SL = 21.7 cm TL (SL 0.890 TL). It runs about 30% over the measured
        // common lengths of the other remoras, so real fish may be smaller. Weight from FishBase's
        // length–weight (a 0.00263, b 3.17). No age data.
        maleSizeMeters: 0.22,
        femaleSizeMeters: 0.22,
        maleWeightKg: 0.05,
        femaleWeightKg: 0.05,
        maleLifeExpectancyYears: 'Unknown',
        femaleLifeExpectancyYears: 'Unknown',
      },
      lifecycle: {
        sexualMaturityYears: 'Unknown',
        sexualSterilityYears: 'None known',
        offspringPerMatingEvent: 'Unknown',
      },
    },
    atlasSummary: {
      biome: 'Ocean',
      zone: 'Sunlight',
      diet: 'Unknown',
      social: 'Hitchhiker',
    },
    description: 'The smallest remora, whitish to light grey and up to 30 cm. It is host-specific on manta rays and slips into their mouths and gill chambers more often than any other remora. It only occasionally attaches to sharks or black marlin and is rarely found swimming free.',
    maxBodyLengthMeters: 0.3,
    swim: {
      ...REMORA_SWIM,
      ...OPEN_SEA_RIDER_BOUNDS,
      // 30 cm maximum standard length = 1.2 WU, just above the 1.08 WU tank floor.
      bodyLengthWU: 1.2,
    },
    // Held near the maximum so individuals do not fall far below the tank's 27 cm floor.
    sizeRange: [0.8, 1.0],
    mass: REMORA_MASS,
    hitchhiker: {
      // Manta rays are its host; sharks and black marlin only occasionally.
      hosts: { ray: 1, shark: 0.3, billfish: 0.3 },
      rideSeconds: [120, 240],
      freeSeconds: [8, 18],
      // Its disc is 34–40% of standard length, starting just behind the snout.
      discAheadBodyLengths: 0.285,
    },
    model: remoraPlaceholderModel('remora-albescens', 1.2),
    // Out of the Atlas until its model lands: it still renders a generated stand-in.
    hiddenInAtlas: true,
    placeholder: { type: 'remora', bodyColor: '#cfd6d8', discLength: 0.33 },
  },
  {
    id: 'remora-australis',
    name: 'Whalesucker',
    scientificName: 'Remora australis',
    family: 'Echeneidae',
    alternateNames: [],
    biome: 'ocean',
    depthZone: 'epipelagic',
    schooling: false,
    repulser: false,
    aggressive: false,
    predator: false,
    tempo: 'cruise',
    conservationStatus: {
      system: 'IUCN Red List',
      code: 'LC',
      label: 'Least Concern',
    },
    atlasDetails: {
      commonDiet: 'Host parasites, sloughed skin, host faeces.',
      foundIn: 'Tropical and warm seas worldwide, oceanic, 1 to 50 m.',
      sexualDimorphism: 'Unknown',
      lifeSpan: 'Unknown',
      maturityAge: 'Unknown',
      social: {
        schoolSize: 'N/A',
        groupingBehaviour: 'Attaches only to whales and dolphins. On spinner dolphins, usually no more than three ride one host, on its flanks or belly.',
        reproduction: 'Unknown',
      },
      averages: {
        // No measured average, so FishBase's Life-history tool estimate: L_opt, the length at which an
        // unfished cohort is heaviest (Froese & Binohlan 2000, from the maximum length):
        // 50.2 cm TL from 76 cm. It runs about 30% over the measured common lengths of the other
        // remoras, so real fish may be smaller. Weight from FishBase's length–weight (a 0.00263,
        // b 3.17). No age data.
        maleSizeMeters: 0.5,
        femaleSizeMeters: 0.5,
        maleWeightKg: 0.65,
        femaleWeightKg: 0.65,
        maleLifeExpectancyYears: 'Unknown',
        femaleLifeExpectancyYears: 'Unknown',
      },
      lifecycle: {
        sexualMaturityYears: 'Unknown',
        sexualSterilityYears: 'None known',
        offspringPerMatingEvent: 'Unknown',
      },
    },
    atlasSummary: {
      biome: 'Ocean',
      zone: 'Sunlight',
      diet: 'Parasites + skin',
      social: 'Hitchhiker',
    },
    description: 'A remora that rides nothing but marine mammals — whales and dolphins, including spinner dolphins, where it clamps to the flanks or belly. Its suction disc is unusually large, about half its body length, and it is uniformly brown to grey. It eats parasites and sloughed skin, and forages on its hosts\' faeces and vomit.',
    maxBodyLengthMeters: 0.76,
    swim: {
      ...REMORA_SWIM,
      ...OPEN_SEA_RIDER_BOUNDS,
      // 76 cm maximum total length = 3.04 WU.
      bodyLengthWU: 3.04,
    },
    sizeRange: [0.6, 1.0],
    mass: REMORA_MASS,
    hitchhiker: {
      hosts: { cetacean: 1 },
      rideSeconds: [150, 300],
      freeSeconds: [8, 18],
      // The disc runs about half the body (47–59% of standard length), so its centre sits
      // further back than on any other remora.
      discAheadBodyLengths: 0.225,
    },
    model: remoraPlaceholderModel('remora-australis', 3.04),
    // Out of the Atlas until its model lands: it still renders a generated stand-in.
    hiddenInAtlas: true,
    placeholder: { type: 'remora', bodyColor: '#6b5a48', discLength: 0.45 },
  },
  {
    id: 'remora-brachyptera',
    name: 'Spearfish Remora',
    scientificName: 'Remora brachyptera',
    family: 'Echeneidae',
    alternateNames: [],
    biome: 'ocean',
    depthZone: 'epipelagic',
    schooling: false,
    repulser: false,
    aggressive: false,
    predator: false,
    tempo: 'cruise',
    conservationStatus: {
      system: 'IUCN Red List',
      code: 'LC',
      label: 'Least Concern',
    },
    atlasDetails: {
      commonDiet: 'Parasitic copepods from its host.',
      foundIn: 'Tropical and warm-temperate seas worldwide, oceanic.',
      sexualDimorphism: 'Unknown',
      lifeSpan: 'Unknown',
      maturityAge: 'Unknown',
      social: {
        schoolSize: 'N/A',
        groupingBehaviour: 'Rides billfishes and swordfish, on the body and inside the gill chamber; also recorded on ocean sunfishes, blue sharks, and loggerhead turtles. Capable of short bursts of independent swimming.',
        reproduction: 'Unknown',
      },
      averages: {
        // FishBase common length (total length); no sex-specific data.
        // Weight from FishBase's length–weight (a 0.00263, b 3.17) at the common length. No age data.
        maleSizeMeters: 0.25,
        femaleSizeMeters: 0.25,
        maleWeightKg: 0.07,
        femaleWeightKg: 0.07,
        maleLifeExpectancyYears: 'Unknown',
        femaleLifeExpectancyYears: 'Unknown',
      },
      lifecycle: {
        sexualMaturityYears: 'Unknown',
        sexualSterilityYears: 'None known',
        offspringPerMatingEvent: 'Unknown',
      },
    },
    atlasSummary: {
      biome: 'Ocean',
      zone: 'Sunlight',
      diet: 'Copepods',
      social: 'Hitchhiker',
    },
    description: 'A slim, pale remora — whitish to pale blue in life — that rides marlins, sailfish, and swordfish, and is also recorded on ocean sunfishes. Juveniles often shelter inside the host\'s gill chamber. It can shift about its host\'s body and manage short bursts of independent swimming, so it should read as a fish that barely leaves its ride.',
    adultLengthRangeMeters: [0.25, 0.5],
    maxBodyLengthMeters: 0.5,
    swim: {
      ...REMORA_SWIM,
      ...DRIFT_RIDER_BOUNDS,
      // 50 cm maximum total length = 2.0 WU.
      bodyLengthWU: 2.0,
    },
    // Skewed above the 25 cm common length so individuals stay clear of the 27 cm tank floor.
    sizeRange: [0.6, 1.0],
    mass: REMORA_MASS,
    hitchhiker: {
      // Billfishes are its usual hosts. Sunfish (Mola), blue shark, and loggerhead records:
      // Gulf of Tehuantepec first record, Hidrobiológica 2022,
      // https://www.scielo.org.mx/scielo.php?pid=S0188-88972022000100071&script=sci_arttext
      hosts: { billfish: 1, sunfish: 0.7, shark: 0.25, turtle: 0.25 },
      rideSeconds: [90, 200],
      freeSeconds: [6, 14],
      discAheadBodyLengths: 0.3,
    },
    model: remoraPlaceholderModel('remora-brachyptera', 2.0),
    // Out of the Atlas until its model lands: it still renders a generated stand-in.
    hiddenInAtlas: true,
    placeholder: { type: 'remora', bodyColor: '#b9cad6', discLength: 0.3 },
  },
  {
    id: 'remora-osteochir',
    name: 'Marlinsucker',
    scientificName: 'Remora osteochir',
    family: 'Echeneidae',
    alternateNames: ['Marlin sucker'],
    biome: 'ocean',
    depthZone: 'epipelagic',
    schooling: false,
    repulser: false,
    aggressive: false,
    predator: false,
    tempo: 'cruise',
    conservationStatus: {
      system: 'IUCN Red List',
      code: 'LC',
      label: 'Least Concern',
    },
    atlasDetails: {
      commonDiet: 'Unknown',
      foundIn: 'Subtropical waters of every ocean, oceanic, to 200 m.',
      maxLengthLabel: 'Standard length',
      sexualDimorphism: 'Unknown',
      lifeSpan: 'Unknown',
      maturityAge: 'Unknown; females mature at about 14 cm',
      social: {
        schoolSize: 'N/A',
        groupingBehaviour: 'Strongly prefers marlins and sailfish, riding on the body or inside the gill chamber; occasionally clings to other large fishes.',
        reproduction: 'Egg-laying, with distinct pairing during breeding. Mature pairs are often found together on a single host.',
      },
      averages: {
        // Battaglia et al. 2016 (J. Mar. Biol. Assoc. UK 96:639, Mediterranean, 236 fish): both sexes
        // grow alike to a mean asymptotic 27.4 cm TL. Weight from FishBase's length–weight (a 0.00263,
        // b 3.17). No maximum age published.
        maleSizeMeters: 0.27,
        femaleSizeMeters: 0.27,
        maleWeightKg: 0.09,
        femaleWeightKg: 0.09,
        maleLifeExpectancyYears: 'Unknown',
        femaleLifeExpectancyYears: 'Unknown',
      },
      lifecycle: {
        // FishBase: females mature at 13.9 cm SL (Ligurian Sea, 1996–2001); 8,100 to 30,000 eggs
        // (Hawaii, May–June 1979).
        sexualMaturityYears: 'Unknown; females mature at about 14 cm',
        sexualSterilityYears: 'None known',
        offspringPerMatingEvent: '8,100 to 30,000 eggs',
      },
    },
    atlasSummary: {
      biome: 'Ocean',
      zone: 'Sunlight',
      diet: 'Unknown',
      social: 'Hitchhiker',
    },
    description: 'A small oceanic remora, up to 40 cm, with a strong preference for marlins and sailfish. It rides on the body or inside the gill chamber and only occasionally clings to other large fishes. It matures at about 14 cm, and mature pairs are often found together on one host.',
    maxBodyLengthMeters: 0.4,
    swim: {
      ...REMORA_SWIM,
      ...OPEN_SEA_RIDER_BOUNDS,
      // 40 cm maximum standard length = 1.6 WU.
      bodyLengthWU: 1.6,
    },
    sizeRange: [0.7, 1.0],
    mass: REMORA_MASS,
    hitchhiker: {
      hosts: { billfish: 1, 'large-fish': 0.15 },
      rideSeconds: [120, 240],
      freeSeconds: [8, 18],
      discAheadBodyLengths: 0.3,
    },
    model: remoraPlaceholderModel('remora-osteochir', 1.6),
    // Out of the Atlas until its model lands: it still renders a generated stand-in.
    hiddenInAtlas: true,
    placeholder: { type: 'remora', bodyColor: '#7a7f84', discLength: 0.3 },
  },
  {
    id: 'phtheirichthys-lineatus',
    name: 'Slender Suckerfish',
    scientificName: 'Phtheirichthys lineatus',
    family: 'Echeneidae',
    alternateNames: ['Louse fish'],
    biome: 'ocean',
    depthZone: 'epipelagic',
    schooling: false,
    repulser: false,
    aggressive: false,
    predator: false,
    tempo: 'cruise',
    conservationStatus: {
      system: 'IUCN Red List',
      code: 'LC',
      label: 'Least Concern',
    },
    atlasDetails: {
      commonDiet: 'Fish scraps, plankton.',
      foundIn: 'Tropical and subtropical seas worldwide, oceanic, near the surface (0 to 5 m).',
      sexualDimorphism: 'Unknown',
      lifeSpan: 'Unknown',
      maturityAge: 'Unknown',
      social: {
        schoolSize: 'N/A',
        groupingBehaviour: 'Most often found on barracudas, also on other fishes and sea turtles, on the body or inside the gill chambers. Not strongly host-dependent, and often met swimming free.',
        reproduction: 'Unknown',
      },
      averages: {
        // Usual total length (Wikipedia, after FishBase); no sex-specific data.
        // Weight from FishBase's length–weight (a 0.00263, b 3.17) at the usual length; this slender
        // species may weigh less. No age data.
        maleSizeMeters: 0.34,
        femaleSizeMeters: 0.34,
        maleWeightKg: 0.19,
        femaleWeightKg: 0.19,
        maleLifeExpectancyYears: 'Unknown',
        femaleLifeExpectancyYears: 'Unknown',
      },
      lifecycle: {
        sexualMaturityYears: 'Unknown',
        sexualSterilityYears: 'None known',
        offspringPerMatingEvent: 'Unknown',
      },
    },
    atlasSummary: {
      biome: 'Ocean',
      zone: 'Sunlight',
      diet: 'Scraps + plankton',
      social: 'Loose hitchhiker',
    },
    description: 'A slender remora with the smallest suction disc in the family — 9 to 11 plates spanning under a third of its length. It is most often found on barracudas, also on other fishes and sea turtles, but it is not strongly tied to any host and is often met swimming free. It feeds mostly on fish scraps and plankton rather than host parasites.',
    adultLengthRangeMeters: [0.34, 0.76],
    maxBodyLengthMeters: 0.76,
    swim: {
      ...REMORA_SWIM,
      ...OPEN_SEA_RIDER_BOUNDS,
      // 76 cm maximum total length = 3.04 WU.
      bodyLengthWU: 3.04,
    },
    sizeRange: [0.45, 1.0],
    mass: REMORA_MASS,
    hitchhiker: {
      hosts: { barracuda: 1, turtle: 0.6, 'large-fish': 0.3 },
      // The loosest rider: short rides, long spells free.
      rideSeconds: [15, 40],
      freeSeconds: [45, 90],
      // The smallest disc in the family (18–28% of standard length), close behind the snout.
      discAheadBodyLengths: 0.35,
    },
    model: remoraPlaceholderModel('phtheirichthys-lineatus', 3.04),
    // Out of the Atlas until its model lands: it still renders a generated stand-in.
    hiddenInAtlas: true,
    placeholder: { type: 'remora', bodyColor: '#5d646b', discLength: 0.2 },
  },
  // --- Pilot fish (Carangidae) ---------------------------------------------------------------
  // Facts from FishBase. It runs the remoras' escort path but never clamps on
  // (`hitchhiker.attaches: false`): see docs/ride-hosts.md.
  {
    id: 'naucrates-ductor',
    name: 'Pilot Fish',
    scientificName: 'Naucrates ductor',
    family: 'Carangidae',
    alternateNames: ['Pilotfish'],
    // Tank capture (2026-10-11): a full side-on body of fish 306.
    atlasThumbnail: '/atlas/naucrates-ductor-thumbnail.png',
    biome: 'ocean',
    depthZone: 'epipelagic',
    // Small groups in the wild, but each one holds its own station round the host, so it runs
    // the solo-agent path the escort steering lives on.
    schooling: false,
    repulser: false,
    aggressive: false,
    predator: false,
    tempo: 'cruise',
    conservationStatus: {
      system: 'IUCN Red List',
      code: 'LC',
      label: 'Least Concern',
    },
    atlasDetails: {
      commonDiet: 'Host scraps, small fishes, invertebrates, host parasites.',
      foundIn: 'Warm open ocean worldwide, 0 to 300 m.',
      sexualDimorphism: 'Unknown',
      lifeSpan: 'Unknown',
      maturityAge: 'Unknown; mature at about 39 cm (estimated)',
      social: {
        schoolSize: 'Small groups',
        groupingBehaviour: 'Adults swim in small groups around sharks, rays, sea turtles, large fishes, and ships, often just ahead of the snout. Juveniles shelter under jellyfish and drifting seaweed.',
        reproduction: 'Unknown',
      },
      averages: {
        // FishBase common length (total length); no sex-specific data.
        // Weight from FishBase's length–weight (a 0.01413, b 2.93) at the common length. The only age
        // study (Reñones et al. 1999, Mallorca) aged fish under a year old, so no lifespan.
        maleSizeMeters: 0.35,
        femaleSizeMeters: 0.35,
        maleWeightKg: 0.7,
        femaleWeightKg: 0.7,
        maleLifeExpectancyYears: 'Unknown',
        femaleLifeExpectancyYears: 'Unknown',
      },
      lifecycle: {
        // Maturity size estimated from the maximum length (Froese & Binohlan 2000). Checked against
        // measured sizes: angelfish 27 vs 25-28 cm, grouper 44 vs 37, whale shark 7.6 vs 8 m; it runs 70%
        // high for remoras, so the echeneids keep Unknown.
        sexualMaturityYears: 'Unknown; mature at about 39 cm (estimated)',
        sexualSterilityYears: 'None known',
        offspringPerMatingEvent: 'Unknown',
      },
    },
    atlasSummary: {
      biome: 'Ocean',
      zone: 'Sunlight',
      diet: 'Scraps + small prey',
      social: 'Follower',
    },
    description: 'A small jack, up to 70 cm, banded with five to seven dark bars on a blue-silver body. It never attaches to anything: it keeps pace beside a large animal, riding the water it pushes aside and picking up scraps and parasites, so in the reserve it holds loose stations round the giant sunfish\'s head and flanks, now and then darting off on its own before slowing back to the sunfish\'s pace.',
    adultLengthRangeMeters: [0.35, 0.7],
    maxBodyLengthMeters: 0.7,
    swim: {
      // A quick carangid cruiser that never hovers. Roaming on its own it swims well ahead of the
      // sunfish's pace; while following, the escort steering slows it to the host's and these
      // only bound it.
      visualTimeScale: 0.7,
      driftEnabled: false,
      idleBLPerSec: [0.9, 1.3],
      idleDriftBLPerSec: [0.08, 0.16],
      snapBLPerSec: [1.4, 1.9],
      burstBLPerSec: [2.2, 3.0],
      burstInterval: [10.0, 18.0],
      burstActionDuration: 0.8,
      turnActionDuration: 0.6,
      erraticness: 0.1,
      turnRadiusBodyLengths: 1.2,
      speedMultiplier: 1.0,
      boundsUseSpeciesSize: false,
      ...DRIFT_RIDER_BOUNDS,
      // 1 WU = 25 cm: 70 cm maximum total length = 2.8 WU.
      bodyLengthWU: 2.8,
      boids: {
        neighborCap: 4,
        perceptionBodyLengths: 2.0,
        separationWeight: 0.25,
        alignmentWeight: 0,
        cohesionWeight: 0,
        maxWeight: 0.25,
        menace: 0.05,
        // Lives beside sharks: nothing big alarms it.
        wariness: 0.05,
      },
    },
    // Individuals span the 35 cm common length to the 70 cm maximum.
    sizeRange: [0.5, 1.0],
    // Rough length–weight for a deep-bodied jack; no published weight for this species.
    mass: { coefficient: 0.012, exponent: 3 },
    hitchhiker: {
      // Follows rather than rides: it escorts its host and never latches, breaking off now and
      // then to roam the tank at its own pace before coming back.
      attaches: false,
      freeSeconds: [25, 55],
      // The sunfish is this tank's host (Jeremy's call); sharks are its classic one.
      hosts: { sunfish: 1, shark: 1, ray: 0.8, turtle: 0.8, 'large-fish': 0.6 },
      escort: {
        // Round the front half: ahead of the snout and along the head and flanks, not trailing
        // under the belly like a remora, and clear of the sunfish's rear dorsal and anal fins.
        along: [-0.9, 0.05],
        // Both flanks and underneath, up to 35 degrees above the side; never over the top.
        angleDegrees: [-215, 35],
        radius: [1.2, 1.6],
        // Then it drifts round to a new station, or (`leaveChance`) swims off for `freeSeconds`,
        // so at any moment a share of the group is roaming while the rest pace the host.
        seconds: [25, 60],
        leaveChance: 0.6,
        // Pacing the slow sunfish it eases right down, well under its free cruise.
        minSpeedBLPerSec: 0.3,
        // It goes looking for its host anywhere in the tank.
        rangeBodyLengths: 10,
      },
    },
    model: {
      path: '/models/fish/naucrates-ductor/naucrates-ductor.glb',
      // Source length 7.3672 -> 2.8 WU; the root is recentred mid-length on the body axis.
      scale: 0.3801,
      position: [0, -0.0567, -0.192],
      followAim: 'root',
      moveset: {
        cruise: 'procedural_cruise',
        drift: 'procedural_drift',
        turnLeft: 'procedural_turn_left',
        turnRight: 'procedural_turn_right',
        burst: 'procedural_burst',
      },
      proceduralAnimation: {
        type: 'caudal-vertex',
        bodyMeshNames: ['naucrates_ductor'],
        sourceAxis: 'z',
        lateralAxis: 'x',
        tailAtMaxZ: true,
        // Carangiform like the mahi (its close relative): a firm front and a compact rear-body
        // stroke. The mahi's 0.043 and 0.033 body lengths, in this model's source units.
        amplitude: 0.32,
        waveSpeed: 2.8,
        waveTravel: 3.5,
        flexStart: 0.26,
        flexFull: 0.84,
        turnStrength: 0.24,
        burstAmplitude: 0.8,
        response: 7.5,
        speedFrequencyBoost: 0.32,
        burstFrequencyBoost: 0.24,
        pectoralFinFlutter: 0.12,
        pelvicFinFlutter: 0.06,
      },
      debugForwardOrigin: 'head',
      debugForwardOffsetRatio: 0.5,
    },
  },
  // --- Longfin bannerfish (Chaetodontidae) ---------------------------------------------------
  // Facts from FishBase. A reef butterflyfish that follows the Mola now and then, the way its
  // close relative the schooling bannerfish (Heniochus diphreutes) cleans bump-head sunfish at
  // Bali's reef cleaning stations (Fishes of Australia). A follower like the pilot fish, joining
  // less often and leaving sooner: see docs/ride-hosts.md.
  {
    id: 'heniochus-acuminatus',
    name: 'Longfin Bannerfish',
    scientificName: 'Heniochus acuminatus',
    family: 'Chaetodontidae',
    alternateNames: ['Pennant Coralfish', 'Bannerfish'],
    // Tank capture (2026-10-11): a three-quarter view of fish 336, banner up over the back.
    atlasThumbnail: '/atlas/heniochus-acuminatus-thumbnail.png',
    biome: 'ocean',
    depthZone: 'epipelagic',
    // Adults go in pairs, not schools, so it runs the solo-agent path (followers must). Biome
    // pairs each female with a male, who keeps loose company with her (advancePairFollow).
    schooling: false,
    pairBonded: true,
    repulser: false,
    aggressive: false,
    predator: false,
    tempo: 'cruise',
    conservationStatus: {
      system: 'IUCN Red List',
      code: 'LC',
      label: 'Least Concern',
    },
    atlasDetails: {
      // Its real home; the tank's ocean biome would read "Pelagic Ocean".
      biome: 'Coral Reef',
      commonDiet: 'Plankton; juveniles pick parasites off other fishes.',
      foundIn: 'Indo-Pacific reefs, Persian Gulf and East Africa to Japan, Australia, and French Polynesia, 2 to 178 m (usually 15 to 75 m).',
      sexualDimorphism: 'Unknown',
      lifeSpan: 'Unknown',
      maturityAge: 'Unknown; mature at about 16 cm (estimated)',
      social: {
        schoolSize: 'Pairs',
        groupingBehaviour: 'Adults swim in pairs in deep, sheltered lagoons and channels and on outer reef slopes, rarely more than a few metres off the reef. Juveniles are usually solitary and may act as cleaners.',
        reproduction: 'Spawns in pairs; eggs drift in open water.',
      },
      averages: {
        // FishBase common length (total length); no sex-specific data.
        // Weight from FishBase's length–weight (a 0.02291, b 3.04) at the common length. No age data.
        maleSizeMeters: 0.15,
        femaleSizeMeters: 0.15,
        maleWeightKg: 0.09,
        femaleWeightKg: 0.09,
        maleLifeExpectancyYears: 'Unknown',
        femaleLifeExpectancyYears: 'Unknown',
      },
      lifecycle: {
        // Maturity size estimated from the maximum length (Froese & Binohlan 2000). Checked against
        // measured sizes: angelfish 27 vs 25-28 cm, grouper 44 vs 37, whale shark 7.6 vs 8 m; it runs 70%
        // high for remoras, so the echeneids keep Unknown.
        sexualMaturityYears: 'Unknown; mature at about 16 cm (estimated)',
        sexualSterilityYears: 'None known',
        offspringPerMatingEvent: 'Unknown',
      },
    },
    atlasSummary: {
      biome: 'Reef',
      zone: 'Sunlight',
      diet: 'Zooplankton',
      social: 'Pairs',
    },
    description: 'A deep-bodied butterflyfish, up to 25 cm, banded black and white with a yellow tail, and named for the white pennant that streams back from its dorsal fin, longer than the fish itself. It cruises on its pectoral fins with its body held stiff, saving its tail for a quick dart. Its relative the schooling bannerfish cleans parasites off ocean sunfish, so in the reserve it now and then joins the giant sunfish to hover close along its flanks before drifting off again.',
    adultLengthRangeMeters: [0.15, 0.25],
    maxBodyLengthMeters: 0.25,
    swim: {
      // An unhurried, manoeuvrable reef fish. Roaming it keeps well under the pilot fish's
      // cruise; following, the escort steering matches the sunfish's pace and these only
      // bound it (its burst still reaches the sunfish's cruise).
      visualTimeScale: 0.8,
      driftEnabled: false,
      idleBLPerSec: [0.6, 1.0],
      idleDriftBLPerSec: [0.08, 0.16],
      snapBLPerSec: [1.2, 1.6],
      burstBLPerSec: [2.6, 3.4],
      burstInterval: [12.0, 22.0],
      burstActionDuration: 0.6,
      turnActionDuration: 0.5,
      erraticness: 0.18,
      turnRadiusBodyLengths: 0.8,
      speedMultiplier: 1.0,
      boundsUseSpeciesSize: false,
      ...DRIFT_RIDER_BOUNDS,
      ...REEF_BOUNDS,
      // 1 WU = 25 cm: 25 cm maximum total length = 1.0 WU, just under the sardinella.
      bodyLengthWU: 1.0,
      boids: {
        neighborCap: 4,
        perceptionBodyLengths: 2.5,
        separationWeight: 0.25,
        alignmentWeight: 0,
        cohesionWeight: 0,
        maxWeight: 0.25,
        menace: 0.02,
        wariness: 0.3,
      },
    },
    // Individuals span the 15 cm common length to the 25 cm maximum.
    sizeRange: [0.6, 1.0],
    // Rough length–weight for a deep, compressed body; no published weight for this species.
    mass: { coefficient: 0.02, exponent: 3 },
    // Reef behaviour (reefBehavior.js, docs/reef-behavior.md). Adults keep "rarely more than a
    // few metres off the reef" but feed on plankton in the water over it, so they hang off the
    // faces and cruise past them more than they peck; the young pick at the rock and at fishes.
    reef: {
      affinity: 0.75,
      modes: { patrol: 0.4, hover: 0.35, peck: 0.15, shelter: 0.1 },
      // Where there are corals it hangs by them more than by the rock: beside the tables, and
      // above the staghorn thickets' crowns, where a plankton picker feeds (it eats mostly
      // zooplankton, and some benthic invertebrates: Seatizens, SURG). Now and then it picks at
      // a thicket's outer branches.
      corals: { table: { hover: 0.45 }, thicket: { hover: 0.4, patrol: 0.2, peck: 0.1 } },
    },
    hitchhiker: {
      // Follows rather than rides, and less often than the pilot fish: it takes the sunfish
      // on 40% of its checks, holds a station for a shorter spell, and usually roams off after
      // it for longer, so it spends about a fifth of its time following (the pilot fish about
      // three fifths).
      attaches: false,
      freeSeconds: [60, 120],
      hosts: { sunfish: 0.4 },
      escort: {
        // Close along the sunfish's flanks and under its belly, as a cleaner would, and clear
        // of its rear dorsal and anal fins.
        along: [-0.5, 0.1],
        angleDegrees: [-215, 35],
        radius: [1.05, 1.3],
        seconds: [15, 35],
        leaveChance: 0.85,
        minSpeedBLPerSec: 0.3,
        rangeBodyLengths: 10,
      },
    },
    model: {
      path: '/models/fish/heniochus-acuminatus/heniochus-acuminatus.glb',
      // Source length 0.3199 (nose to tail tip, banner excluded) -> 1.0 WU; the root is
      // recentred mid-length on the body axis.
      scale: 3.1262,
      position: [0, -0.0216, -0.044],
      followAim: 'root',
      moveset: {
        cruise: 'procedural_cruise',
        drift: 'procedural_drift',
        turnLeft: 'procedural_turn_left',
        turnRight: 'procedural_turn_right',
        burst: 'procedural_burst',
      },
      proceduralAnimation: {
        type: 'caudal-vertex',
        bodyMeshNames: ['longfin_bannerfish'],
        // The banner is its own object (the 4th dorsal spine, drawn out past the tail). It
        // waves over the body's bounds, so it stays on the back and, behind the tail tip,
        // moves with it; over its own bounds it would stretch the wave past the tail.
        followBodyMeshNames: ['banner'],
        // Each fish's banner is a different length: stretched back from its root by a factor
        // drawn per fish from `range`. Even the shortest reaches well past the tail.
        meshLengthVariation: { meshName: 'banner', range: [0.8, 1.2] },
        sourceAxis: 'z',
        lateralAxis: 'x',
        tailAtMaxZ: true,
        // Labriform: it cruises on its pectorals with a stiff, deep body, so the wave starts
        // halfway back (behind the sparse mid-body faces at 0.4) and is one short flick, and
        // the stroke is small until a burst. Amplitude and turn 0.03 body lengths, in source
        // units.
        amplitude: 0.0096,
        waveSpeed: 3.6,
        waveTravel: 2.5,
        flexStart: 0.5,
        flexFull: 0.9,
        turnStrength: 0.0096,
        burstAmplitude: 1.2,
        response: 9,
        speedFrequencyBoost: 0.4,
        burstFrequencyBoost: 0.35,
        // The pectorals are the cruising engine, so they row well past a caudal swimmer's.
        pectoralFinFlutter: 0.45,
        // They lie close along the deep flank, running up and back from a low base, so their
        // tips sit nearer the body's axis than their roots: find each root by the body's surface.
        finRootFrom: 'body-surface',
        pelvicFinFlutter: 0.1,
      },
      debugForwardOrigin: 'head',
      debugForwardOffsetRatio: 0.5,
    },
  },
  // --- Raccoon butterflyfish (Chaetodontidae) ------------------------------------------------
  // Facts from FishBase. A nocturnal reef butterflyfish in pairs or small groups that picks
  // nudibranchs, tubeworm tentacles, other bottom invertebrates and some coral polyps off the
  // reef. The tank has no night, so it plays its daytime self: close to the reef, picking and
  // resting under cover more than the plankton-picking bannerfish. Jeremy's model.
  {
    id: 'chaetodon-lunula',
    name: 'Raccoon Butterflyfish',
    scientificName: 'Chaetodon lunula',
    family: 'Chaetodontidae',
    alternateNames: ['Raccoon Fish', 'Halfmoon Butterflyfish'],
    // Rendered from the tank (2026-10-21): fish 422 alone, a three-quarter head view facing left.
    atlasThumbnail: '/atlas/chaetodon-lunula-thumbnail.png',
    biome: 'ocean',
    depthZone: 'epipelagic',
    // "Usually in pairs or small groups" (FishBase); groups of up to about 20. The tank holds
    // one group: a loose company that works one patch of reef together, each fish on the
    // solo-agent path with its own reef behaviour, following the group's leader between
    // patches (`group`, see Biome and advancePairFollow). Not a school: no shared heading.
    schooling: false,
    group: { maxSize: 20 },
    repulser: false,
    aggressive: false,
    predator: false,
    tempo: 'cruise',
    conservationStatus: {
      system: 'IUCN Red List',
      code: 'LC',
      label: 'Least Concern',
    },
    atlasDetails: {
      biome: 'Coral Reef',
      commonDiet: 'Nudibranchs, tubeworm tentacles and other bottom invertebrates; some algae and coral polyps.',
      foundIn: 'Indo-Pacific reefs, East Africa to Hawaii, the Marquesas and Ducie, southern Japan to Lord Howe and Rapa, 0 to 170 m.',
      sexualDimorphism: 'Unknown',
      lifeSpan: 'Up to 9 years',
      maturityAge: 'Unknown; mature at about 13 cm (estimated)',
      social: {
        schoolSize: 'Small groups',
        groupingBehaviour: 'Feeds at night. Usually in pairs or small groups on shallow lagoon and seaward reef flats, down past 30 m. Juveniles live among rocks on inner reef flats and in tide pools.',
        reproduction: 'Forms distinct, monogamous pairs; eggs drift in open water.',
      },
      averages: {
        // FishBase: oldest aged fish 9 years, unsexed (life expectancy is the oldest age, as for the
        // other species).
        // No measured average, so FishBase's Life-history tool estimate: L_opt, the length at which an
        // unfished cohort is heaviest (Froese & Binohlan 2000, from the maximum length):
        // 12.8 cm TL from 20 cm. Weight from FishBase's length–weight (a 0.02291, b 3.00).
        maleSizeMeters: 0.13,
        femaleSizeMeters: 0.13,
        maleWeightKg: 0.05,
        femaleWeightKg: 0.05,
        maleLifeExpectancyYears: 9,
        femaleLifeExpectancyYears: 9,
      },
      lifecycle: {
        // Maturity size estimated from the maximum length (Froese & Binohlan 2000). Checked against
        // measured sizes: angelfish 27 vs 25-28 cm, grouper 44 vs 37, whale shark 7.6 vs 8 m; it runs 70%
        // high for remoras, so the echeneids keep Unknown.
        sexualMaturityYears: 'Unknown; mature at about 13 cm (estimated)',
        sexualSterilityYears: 'None known',
        offspringPerMatingEvent: 'Unknown',
      },
    },
    atlasSummary: {
      biome: 'Reef',
      zone: 'Sunlight',
      diet: 'Invertebrates',
      social: 'Small groups',
    },
    description: 'A yellow butterflyfish, up to 20 cm, with a black mask over its eye like a raccoon\'s, a white band behind it and a dark crescent on the shoulder. It hunts at night for nudibranchs and the tentacles of tubeworms, and spends the day in pairs or small groups close to the reef.',
    adultLengthRangeMeters: [0.14, 0.2],
    maxBodyLengthMeters: 0.2,
    swim: {
      // The bannerfish's labriform cruise, kept a little closer and slower: a bottom picker,
      // not a plankton picker in the water over the reef. Tune once the model swims.
      visualTimeScale: 0.8,
      driftEnabled: false,
      idleBLPerSec: [0.6, 1.0],
      idleDriftBLPerSec: [0.08, 0.16],
      snapBLPerSec: [1.2, 1.6],
      burstBLPerSec: [2.6, 3.4],
      burstInterval: [14.0, 24.0],
      burstActionDuration: 0.6,
      turnActionDuration: 0.5,
      erraticness: 0.18,
      turnRadiusBodyLengths: 0.8,
      speedMultiplier: 1.0,
      boundsUseSpeciesSize: false,
      ...REEF_BOUNDS,
      // 1 WU = 25 cm: 20 cm maximum total length = 0.8 WU, under the bannerfish (1.0) and the
      // 1.08 WU sardinella floor, at the size of the juvenile angelfish's largest.
      bodyLengthWU: 0.8,
      boids: {
        neighborCap: 4,
        perceptionBodyLengths: 2.5,
        separationWeight: 0.25,
        alignmentWeight: 0,
        cohesionWeight: 0,
        maxWeight: 0.25,
        menace: 0.02,
        wariness: 0.35,
      },
    },
    // 14 to 20 cm. No published common length; this keeps them all near adult size.
    sizeRange: [0.7, 1.0],
    // FishBase Bayesian length–weight (TL cm): a 0.02291, b 3.00.
    mass: { coefficient: 0.02291, exponent: 3 },
    // Reef behaviour (reefBehavior.js, docs/reef-behavior.md). It feeds on the reef, not over
    // it, so it pecks more than the bannerfish and holds close; resting by day, it shelters
    // more too. Polyps are part of its diet, so it picks at both coral forms; at 0.8 WU it is
    // small enough to slip in among the staghorn.
    reef: {
      affinity: 0.85,
      modes: { patrol: 0.2, hover: 0.25, peck: 0.35, shelter: 0.2 },
      pecks: [1, 3],
      corals: {
        table: { peck: 0.4, shelter: 0.4, hover: 0.3 },
        thicket: { peck: 0.3, shelter: 0.25, hover: 0.25 },
      },
    },
    model: {
      path: '/models/fish/chaetodon-lunula/chaetodon-lunula.glb',
      // Source length 0.2003 (nose to tail tip) -> 0.8 WU; the root is recentred mid-length on
      // the line from the snout (y 0.0028) to the tail tip (y 0.0151). The texture is opaque
      // (no alpha channel), so no alphaBlend/alphaTest despite the GLB's BLEND material.
      scale: 3.994,
      position: [0, -0.0359, -0.1286],
      followAim: 'root',
      moveset: {
        cruise: 'procedural_cruise',
        drift: 'procedural_drift',
        turnLeft: 'procedural_turn_left',
        turnRight: 'procedural_turn_right',
        burst: 'procedural_burst',
      },
      proceduralAnimation: {
        type: 'caudal-vertex',
        bodyMeshNames: ['chaetodon_lunula'],
        sourceAxis: 'z',
        lateralAxis: 'x',
        tailAtMaxZ: true,
        // The bannerfish's labriform tuning (a stiff, deep body that cruises on its pectorals and
        // saves its tail for a dart), in this model's units: 0.03 body lengths of 0.2003.
        amplitude: 0.006,
        waveSpeed: 3.6,
        waveTravel: 2.5,
        flexStart: 0.5,
        flexFull: 0.9,
        turnStrength: 0.006,
        burstAmplitude: 1.2,
        response: 9,
        speedFrequencyBoost: 0.4,
        burstFrequencyBoost: 0.35,
        pectoralFinFlutter: 0.45,
        finRootFrom: 'body-surface',
        pelvicFinFlutter: 0.1,
        // Jeremy's shape keys: "open spines" (the basis) and "folded spines" (a morph target). The
        // front dorsal and the anal spines fold while it swims and stand up in alarm (Fish.jsx,
        // the spine driver). Mirror baked into the keys by scripts/bake-mirror-shape-keys.py.
        spineFold: { morphTarget: 'folded spines' },
      },
      debugForwardOrigin: 'head',
      debugForwardOffsetRatio: 0.5,
    },
  },
  // --- Emperor angelfish (Pomacanthidae) -----------------------------------------------------
  // Facts from FishBase. A reef angelfish that forms pairs, and whose young and adults "may
  // clean much larger fishes, such as sunfish", so it pairs like the bannerfish and follows the
  // Mola now and then as a cleaner. Jeremy's adult and juvenile models (see lifeStages).
  {
    id: 'pomacanthus-imperator',
    name: 'Emperor Angelfish',
    scientificName: 'Pomacanthus imperator',
    family: 'Pomacanthidae',
    alternateNames: ['Imperator Angelfish'],
    // Tank capture (2026-10-13): fish 353 side-on, mask and yellow tail in frame.
    atlasThumbnail: '/atlas/pomacanthus-imperator-thumbnail.png',
    biome: 'ocean',
    depthZone: 'epipelagic',
    // Adults keep to pairs, so like the bannerfish it roams as a solo agent and Biome pairs it.
    schooling: false,
    pairBonded: true,
    repulser: false,
    aggressive: false,
    predator: false,
    tempo: 'cruise',
    conservationStatus: {
      system: 'IUCN Red List',
      code: 'LC',
      label: 'Least Concern',
    },
    atlasDetails: {
      biome: 'Coral Reef',
      commonDiet: 'Sponges, tunicates, and other encrusting animals; also picks parasites off larger fishes.',
      foundIn: 'Indo-Pacific reefs, Red Sea and East Africa to the Line and Tuamotu islands, north to southern Japan and south to the Great Barrier Reef, New Caledonia, and the Austral Islands, 1 to 100 m.',
      sexualDimorphism: 'Unknown',
      lifeSpan: 'Up to 14 years',
      maturityAge: 'Unknown; females mature at about 25 cm, males at 28 cm',
      social: {
        schoolSize: 'Pairs',
        groupingBehaviour: 'Adults form pairs and keep to ledges and caves in rich coral on lagoon, channel, and seaward reefs. Juveniles hide under ledges and in holes on sheltered reefs, dark blue ringed in white until the adult stripes come in at about 12 to 14 cm. Young and adults may clean much larger fishes, such as sunfish.',
        reproduction: 'Forms pairs. Spawning is poorly documented.',
      },
      averages: {
        // FishBase's 14-year maximum reported age is used as life expectancy, as for the other species.
        // No measured average, so FishBase's Life-history tool estimate: L_opt, the length at which an
        // unfished cohort is heaviest (Froese & Binohlan 2000, from the maximum length):
        // 26 cm SL from 40 cm SL = 29.5 cm TL (adults SL 0.882 TL). Weight from FishBase's length–weight
        // (a 0.01738, b 2.88). Kenyan fish mature at 25 to 28 cm, just under it.
        maleSizeMeters: 0.3,
        femaleSizeMeters: 0.3,
        maleWeightKg: 0.3,
        femaleWeightKg: 0.3,
        maleLifeExpectancyYears: 14,
        femaleLifeExpectancyYears: 14,
      },
      lifecycle: {
        // Obota et al. 2016 (W. Indian Ocean J. Mar. Sci., Kenya, 384 fish): females mature at 25 cm TL,
        // males at 28 cm; a ripe ovary holds 17,790 to 266,472 eggs (mean 79,353).
        sexualMaturityYears: 'Unknown; females mature at about 25 cm, males at 28 cm',
        sexualSterilityYears: 'None known',
        offspringPerMatingEvent: 'About 18,000 to 266,000 eggs (79,000 on average)',
      },
    },
    atlasSummary: {
      biome: 'Reef',
      zone: 'Sunlight',
      diet: 'Sponges',
      social: 'Pairs',
    },
    description: 'A reef angelfish up to 40 cm, striped electric blue and yellow, with a dark mask across its eyes and a yellow tail. Pairs keep to ledges and caves in rich coral, grazing sponges and other encrusting animals. Young and adults will also clean much larger fishes, sunfish among them, so in the reserve it now and then joins the giant sunfish before drifting off again.',
    // FishBase: 40 cm maximum (standard length), maturing at 25 cm.
    adultLengthRangeMeters: [0.25, 0.4],
    maxBodyLengthMeters: 0.4,
    swim: {
      // Same unhurried, manoeuvrable pectoral cruiser as the bannerfish, at its own length.
      visualTimeScale: 0.8,
      driftEnabled: false,
      idleBLPerSec: [0.5, 0.85],
      idleDriftBLPerSec: [0.06, 0.14],
      snapBLPerSec: [1.0, 1.4],
      burstBLPerSec: [2.2, 3.0],
      burstInterval: [12.0, 22.0],
      burstActionDuration: 0.6,
      turnActionDuration: 0.5,
      erraticness: 0.16,
      turnRadiusBodyLengths: 0.8,
      speedMultiplier: 1.0,
      boundsUseSpeciesSize: false,
      ...DRIFT_RIDER_BOUNDS,
      ...REEF_BOUNDS,
      // 1 WU = 25 cm: 40 cm maximum = 1.6 WU, half again the sardinella.
      bodyLengthWU: 1.6,
      boids: {
        neighborCap: 4,
        perceptionBodyLengths: 2.5,
        separationWeight: 0.25,
        alignmentWeight: 0,
        cohesionWeight: 0,
        maxWeight: 0.25,
        menace: 0.02,
        wariness: 0.3,
      },
    },
    // Individuals span the 25 cm maturity length to the 40 cm maximum.
    sizeRange: [0.62, 1.0],
    // Rough length–weight for a deep, compressed body; no published weight for this species.
    mass: { coefficient: 0.02, exponent: 3 },
    // Reef behaviour (reefBehavior.js, docs/reef-behavior.md). It grazes sponges and other
    // encrusting animals on ledges and in caves, so it pecks most, a few gentle nibbles at a
    // time, between spells hanging at the face.
    reef: {
      affinity: 0.85,
      modes: { patrol: 0.2, hover: 0.25, peck: 0.45, shelter: 0.1 },
      pecks: [1, 3],
      // Rich coral is its home ground (FishBase): it nibbles along the table corals' rims and
      // tucks under them as well as at the rock. Its sponges and tunicates grow on rock, not on
      // living staghorn: it only hangs by and cruises past the thickets.
      corals: { table: { peck: 0.65, shelter: 0.5 }, thicket: { hover: 0.25, patrol: 0.2, peck: 0 } },
    },
    hitchhiker: {
      // A cleaner like the bannerfish, joining the sunfish a little less readily.
      attaches: false,
      freeSeconds: [70, 140],
      hosts: { sunfish: 0.3 },
      escort: {
        along: [-0.5, 0.1],
        angleDegrees: [-215, 35],
        radius: [1.05, 1.3],
        seconds: [15, 35],
        leaveChance: 0.85,
        minSpeedBLPerSec: 0.3,
        rangeBodyLengths: 10,
      },
    },
    model: {
      path: '/models/fish/pomacanthus-imperator/pomacanthus-imperator.glb',
      // Source length 0.4002 (nose to tail tip, modelled at true size) -> 1.6 WU; the root is
      // recentred mid-length on the body axis (snout and tail tip both sit ~0.01 up).
      scale: 3.998,
      position: [0, -0.04, 0.0126],
      followAim: 'root',
      // The fins' texture is a photo with an alpha channel (rays and soft, see-through webbing):
      // blend it rather than render the whole fin card opaque, dropping only the fully clear
      // texels so they cannot hide what is behind them.
      alphaBlend: true,
      alphaTest: 0.02,
      moveset: {
        cruise: 'procedural_cruise',
        drift: 'procedural_drift',
        turnLeft: 'procedural_turn_left',
        turnRight: 'procedural_turn_right',
        burst: 'procedural_burst',
      },
      proceduralAnimation: {
        type: 'caudal-vertex',
        bodyMeshNames: ['pomacanthus_imperator'],
        sourceAxis: 'z',
        lateralAxis: 'x',
        tailAtMaxZ: true,
        // Labriform like the bannerfish: a stiff, deep body that saves its tail for darts, so
        // the wave starts past mid-body (its rings sit every 5–10% back) and is one short
        // flick. Amplitude and turn 0.03 body lengths, in source units. A touch slower and
        // lazier than the bannerfish, being larger.
        amplitude: 0.012,
        waveSpeed: 3.3,
        waveTravel: 2.5,
        flexStart: 0.55,
        flexFull: 0.9,
        turnStrength: 0.012,
        burstAmplitude: 1.2,
        response: 8.5,
        speedFrequencyBoost: 0.4,
        burstFrequencyBoost: 0.35,
        // The model's only separate fins are the pelvics (no pectoral objects), splayed out
        // below the flank a quarter of the way back.
        pelvicFinFlutter: 0.12,
      },
      debugForwardOrigin: 'head',
      debugForwardOffsetRatio: 0.5,
    },
    // Juveniles (a creature's `lifeStage: 'juvenile'`; see speciesForLifeStage): dark blue with
    // white rings, until the adult colours come in at about 12–14 cm (Seatizens: under ~14 cm).
    // They keep to themselves under ledges, so they do not pair, but young fish clean too.
    lifeStages: {
      juvenile: {
        pairBonded: false,
        // Juveniles hide under ledges and in holes: they shelter most, for longer.
        reef: {
          affinity: 0.9,
          modes: { patrol: 0.15, hover: 0.2, peck: 0.25, shelter: 0.4 },
          shelterSeconds: [15, 35],
          // Under a table coral's plate is as good a hole as any. Small enough to slip in among
          // staghorn branches too, though juveniles are mostly found under ledges and in holes
          // (Fishes of Australia, SURG), so less often.
          corals: { table: { shelter: 0.55 }, thicket: { shelter: 0.3, hover: 0.25, peck: 0 } },
        },
        // 8–14 cm against the species' 40 cm (bodyLengthWU 1.6): 0.32–0.56 WU, under the 1.08 WU
        // sardinella floor, as a real juvenile is.
        sizeRange: [0.2, 0.35],
        swim: {
          // Speeds are in species body lengths (40 cm), so a 12 cm juvenile at the adult's
          // multiplier would cover 2–3 of its own lengths a second; this keeps it near 1–1.7.
          speedMultiplier: 0.6,
        },
        model: {
          path: '/models/fish/pomacanthus-imperator/pomacanthus-imperator-juvenile.glb',
          // Source length 0.1995 (nose to tail tip, Z) -> 1.6 WU at size 1, so the size range
          // above gives true length. The root is recentred mid-length, and up 0.012 onto the
          // body axis (snout at -0.011, caudal fin centre at -0.013).
          scale: 8.02,
          position: [0, 0.096, -0.1396],
          followAim: 'root',
          // Its photo texture is fully opaque (fins are cut in the mesh), so no alpha settings.
          moveset: {
            cruise: 'procedural_cruise',
            drift: 'procedural_drift',
            turnLeft: 'procedural_turn_left',
            turnRight: 'procedural_turn_right',
            burst: 'procedural_burst',
          },
          proceduralAnimation: {
            type: 'caudal-vertex',
            bodyMeshNames: ['pomacanthus_imperator_juvenile'],
            sourceAxis: 'z',
            lateralAxis: 'x',
            tailAtMaxZ: true,
            // The adult's labriform stroke at this model's length (0.03 body lengths = 0.006
            // source units), beating a little quicker for a smaller fish.
            amplitude: 0.006,
            waveSpeed: 4.0,
            waveTravel: 2.5,
            flexStart: 0.55,
            flexFull: 0.9,
            turnStrength: 0.006,
            burstAmplitude: 1.2,
            response: 8.5,
            speedFrequencyBoost: 0.4,
            burstFrequencyBoost: 0.35,
            // Unlike the adult model, this one has separate pectorals (and no pelvics), low on
            // the flank a quarter of the way back.
            pectoralFinFlutter: 0.12,
          },
          debugForwardOrigin: 'head',
          debugForwardOffsetRatio: 0.5,
        },
      },
    },
  },
  {
    id: 'balistoides-conspicillum',
    name: 'Clown Triggerfish',
    scientificName: 'Balistoides conspicillum',
    family: 'Balistidae',
    // Tank capture (2026-10-15): fish 406 side-on in The Drift, a pilot fish for scale.
    atlasThumbnail: '/atlas/balistoides-conspicillum-thumbnail.png',
    biome: 'ocean',
    depthZone: 'epipelagic',
    // Adults are solitary; FishBase records pairs only for spawning, so no `pairBonded`.
    schooling: false,
    repulser: false,
    aggressive: false,
    predator: false,
    tempo: 'cruise',
    conservationStatus: {
      system: 'IUCN Red List',
      code: 'LC',
      label: 'Least Concern',
    },
    atlasDetails: {
      biome: 'Coral Reef',
      commonDiet: 'Sea urchins, crabs and other crustaceans, molluscs, and tunicates.',
      foundIn: 'Indo-Pacific reefs, East Africa through northern Australia to Samoa, north to southern Japan, 1 to 75 m.',
      sexualDimorphism: 'Unknown',
      lifeSpan: 'Up to 20 years',
      maturityAge: 'About 1 year',
      social: {
        schoolSize: 'Solitary',
        groupingBehaviour: 'Adults swim alone and in the open along deep drop-offs on clear seaward reefs, retreating into caves when approached. Juveniles are secretive, keeping to small caves rich in invertebrate growth.',
        reproduction: 'Forms distinct pairs to spawn, over patches of mixed coral rubble and sand on clear seaward reefs.',
      },
      averages: {
        // Toronto Zoo: lives up to 20 years.
        // No measured average, so FishBase's Life-history tool estimate: L_opt, the length at which an
        // unfished cohort is heaviest (Froese & Binohlan 2000, from the maximum length):
        // 32.7 cm TL from 50 cm. Weight from FishBase's length–weight (a 0.02692, b 2.91).
        maleSizeMeters: 0.33,
        femaleSizeMeters: 0.33,
        maleWeightKg: 0.69,
        femaleWeightKg: 0.69,
        maleLifeExpectancyYears: 20,
        femaleLifeExpectancyYears: 20,
      },
      lifecycle: {
        // Toronto Zoo: mature at about a year.
        sexualMaturityYears: 'About 1 year',
        sexualSterilityYears: 'None known',
        offspringPerMatingEvent: 'Unknown',
      },
    },
    atlasSummary: {
      biome: 'Reef',
      zone: 'Sunlight',
      diet: 'Urchins',
      social: 'Solitary',
    },
    description: 'A reef triggerfish up to 50 cm, black with large white spots across the belly, a yellow-netted back, and a yellow ring round the mouth. It cruises on its rippling dorsal and anal fins, keeping its armoured body rigid, and only beats its tail to dart. Alone along deep drop-offs, it cracks sea urchins, crabs, and molluscs, and retreats into a cave when approached.',
    // FishBase: 50 cm maximum (total length). No common or maturity length is published.
    adultLengthRangeMeters: [0.3, 0.5],
    maxBodyLengthMeters: 0.5,
    swim: {
      // Balistiform gait (Korsmeyer et al. 2002, Picasso triggerfish): dorsal and anal fins
      // alone up to ~1.5 BL/s, tail beats added intermittently above that and continuously
      // above ~3.5 BL/s. Cruise sits inside the fin-only range; bursts are the tail-driven darts.
      visualTimeScale: 0.8,
      driftEnabled: false,
      idleBLPerSec: [0.4, 0.8],
      idleDriftBLPerSec: [0.06, 0.12],
      snapBLPerSec: [0.9, 1.4],
      burstBLPerSec: [2.4, 3.4],
      burstInterval: [14.0, 26.0],
      burstActionDuration: 0.6,
      turnActionDuration: 0.5,
      erraticness: 0.14,
      // Fin-driven and very manoeuvrable: it can turn nearly in place and even back up.
      turnRadiusBodyLengths: 0.6,
      speedMultiplier: 1.0,
      boundsUseSpeciesSize: false,
      // Down to the reef and forward to the foreground rocks.
      ...REEF_BOUNDS,
      // 1 WU = 25 cm: 50 cm maximum = 2.0 WU.
      bodyLengthWU: 2.0,
      boids: {
        neighborCap: 4,
        perceptionBodyLengths: 2.5,
        separationWeight: 0.3,
        alignmentWeight: 0,
        cohesionWeight: 0,
        maxWeight: 0.3,
        // Others give a territorial triggerfish room; it shies from what approaches it.
        menace: 0.15,
        wariness: 0.35,
      },
    },
    // Reef behaviour (reefBehavior.js, docs/reef-behavior.md). It cracks sea urchins, crabs and
    // molluscs off the reef: a slightly firmer peck than the others, holding on longer. Between
    // them it cruises the drop-off, and it retreats into a cave when approached.
    reef: {
      affinity: 0.7,
      modes: { patrol: 0.4, hover: 0.1, peck: 0.3, shelter: 0.2 },
      lungeSeconds: 0.5,
      biteSeconds: 0.45,
      turnDegreesPerSecond: 130,
      startleShelterChance: 0.85,
      // Its prey is on the rock, not the coral, so it seldom pecks a table; but a big fish takes
      // cover under one as readily as in a cave (Kerry & Bellwood 2012, below at the grouper).
      // A staghorn thicket it only cruises past.
      corals: {
        table: { patrol: 0.2, hover: 0.15, peck: 0.1, shelter: 0.5 },
        thicket: { patrol: 0.2, hover: 0, peck: 0 },
      },
    },
    // Individuals span 30 cm to the 50 cm maximum.
    sizeRange: [0.6, 1.0],
    // FishBase Bayesian length–weight (TL cm → g): about 2.4 kg at 50 cm.
    mass: { coefficient: 0.02692, exponent: 2.91 },
    model: {
      path: '/models/fish/balistoides-conspicillum/balistoides-conspicillum.glb',
      // Jeremy's model (2026-10-14): source length 4.589 (node scale 3.11 over 1.4753 raw)
      // -> 2.0 WU; recentred mid-length on the body axis. 1 raw mesh unit = 1.355 WU.
      scale: 0.4358,
      position: [0, -0.071, -0.223],
      followAim: 'root',
      // Opaque, unlike the angelfish: the fin outlines are cut in the mesh and the texture's alpha
      // is solid. Its GLB material still says BLEND, and blending one material for the whole fish
      // drops depth writes, so the far side drew over the near (fins and tail through the body).
      moveset: {
        cruise: 'procedural_cruise',
        drift: 'procedural_drift',
        turnLeft: 'procedural_turn_left',
        turnRight: 'procedural_turn_right',
        burst: 'procedural_burst',
      },
      proceduralAnimation: {
        // Balistiform: the Mola's painted-fin type with a travelling ripple (see
        // docs/procedural/mask-fin-row.md). R soft dorsal, G anal, B caudal; separate pectorals.
        type: 'mola-mask-vertex',
        bodyMeshNames: ['clown_triggerfish'],
        maskAttribute: 'color_1',
        forwardAxis: '-z',
        upAxis: 'y',
        waveSpeed: 7,
        // Fin rays sweep ~30–45° in balistiform swimming; at the Atlas's cruise speed this
        // turns the fin edge ~23° (about 2 cm on the 5 cm soft dorsal).
        finRotationRadians: 0.6,
        finWaveTravel: 6,
        analPhaseOffset: 0.6,
        analPhaseRate: 1,
        analAmplitudeScale: 0.8,
        pectoralAmplitude: 0,
        clavusAmplitude: 0,
        // About 4 cm of tail travel at a full burst (raw source units: 1 raw = 1.355 WU).
        caudalBurstAmplitude: 0.12,
        caudalBeatRate: 2.5,
        turnStrength: 0.02,
        burstAmplitude: 0.4,
        response: 6,
        speedFrequencyBoost: 0.5,
        burstFrequencyBoost: 0.3,
        pectoralFinFlutter: 0.18,
      },
      debugForwardOrigin: 'head',
      debugForwardOffsetRatio: 0.5,
    },
  },
  // Facts from FishBase, plus Norman & Stevens 2007 (males mature at about 8 m) and Meekan et al.
  // 2020 (males level off at 8–9 m, females near 14.5 m). The species is described at its true
  // scale; the tank keeps only juveniles (`lifeStage: 'juvenile'`, see lifeStages below), a
  // 6 m animal of the kind that makes up most feeding aggregations. An adult would be longer than
  // the Open Sea is deep.
  {
    id: 'rhincodon-typus',
    name: 'Whale Shark',
    scientificName: 'Rhincodon typus',
    family: 'Rhincodontidae',
    alternateNames: [],
    // Tank render (2026-10-16, dev_3): fish 410's head in three-quarter view, the other fish and
    // particles hidden for the frame so nothing else is in the water.
    atlasThumbnail: '/atlas/rhincodon-typus-thumbnail.png',
    biome: 'ocean',
    depthZone: 'epipelagic',
    schooling: false,
    // A body this size parts the water: others make way, though it hunts nothing they fear.
    repulser: true,
    aggressive: false,
    predator: false,
    tempo: 'cruise',
    conservationStatus: {
      system: 'IUCN Red List',
      code: 'EN',
      label: 'Endangered',
    },
    atlasDetails: {
      commonDiet: 'Plankton, krill and other small crustaceans, fish eggs, small fishes, and squid, filtered from the water.',
      foundIn: 'All tropical and warm temperate seas except the Mediterranean, offshore and close inshore, from the surface to almost 2,000 m, usually above 100 m.',
      sexualDimorphism: 'Females grow larger: males level off at about 8 to 9 m, while females are expected to reach about 14.5 m.',
      lifeSpan: 'Up to 80 years',
      maturityAge: 'About 30 years (estimated); males mature at about 8 m long',
      social: {
        schoolSize: 'Solitary or aggregations',
        groupingBehaviour: 'Found alone or in seasonal feeding aggregations of more than 100, mostly young males under 7 m. Highly migratory, yet returns to the same sites each year. Often swims with schools of other open-ocean fishes, especially tunas and mackerels. The pattern of spots behind the gills is unique to each animal and stays the same for life.',
        reproduction: 'Pups hatch from egg cases inside the mother and are born live at about 55 to 64 cm. One pregnant female carried about 300 embryos.',
      },
      averages: {
        // FishBase gives a common length of 10 m (males and unsexed) but no sex-specific sizes or
        // weights; 80 years is its maximum reported age, used as life expectancy as elsewhere.
        // Mean asymptotic lengths from Ningaloo photo-identification growth (Meekan et al. 2020, Front.
        // Mar. Sci.): males level off at about 8 to 9 m, females are predicted to reach about 14.5 m.
        // Weights from FishBase's length–weight (a 0.00389, b 3.12) at those lengths.
        maleSizeMeters: 8.5,
        femaleSizeMeters: 14.5,
        maleWeightKg: 5400,
        femaleWeightKg: 28000,
        maleLifeExpectancyYears: 80,
        femaleLifeExpectancyYears: 80,
      },
      lifecycle: {
        // Age at maturity is the FishLife estimate for this species (Thorson et al. 2017: 32 years), which
        // matches its measured ages where checked (lifespan 75 vs 80 years).
        sexualMaturityYears: 'About 30 years (estimated); males mature at about 8 m long',
        sexualSterilityYears: 'None known',
        offspringPerMatingEvent: 'Up to about 300 pups',
      },
    },
    atlasSummary: {
      biome: 'Ocean',
      zone: 'Sunlight',
      diet: 'Plankton',
      social: 'Solitary',
    },
    description: 'The largest fish in the sea, up to 20 m: a filter-feeding shark, dark blue-grey above with a checkerboard of white spots and pale stripes, white below. It cruises slowly near the surface, straining plankton, fish eggs, and small fishes through its wide mouth, and the spots behind its gills are as unique as a fingerprint. The whale shark in the reserve is a 6 m juvenile, the size most often seen at feeding sites.',
    // FishBase: 20 m maximum (female, total length); males mature at about 8 m.
    adultLengthRangeMeters: [8, 20],
    maxBodyLengthMeters: 20,
    swim: {
      // An unhurried cruiser: slow, broad tail sweeps, long glides, no real burst. Speeds are in
      // body lengths, so at the juvenile's 24 WU the cruise is about 0.5–0.8 m/s.
      visualTimeScale: 0.8,
      visualHeadingFollowsMotion: true,
      driftEnabled: false,
      idleBLPerSec: [0.08, 0.13],
      idleDriftBLPerSec: [0.02, 0.04],
      snapBLPerSec: [0.12, 0.17],
      burstBLPerSec: [0.18, 0.24],
      burstInterval: [40.0, 70.0],
      burstActionDuration: 5.0,
      turnActionDuration: 4.0,
      turnTriggerThreshold: 0.042,
      erraticness: 0.012,
      // Broad, unhurried turns; boundary steering tightens them near the walls, as for the mako.
      turnRadiusBodyLengths: 1.0,
      speedMultiplier: 1.0,
      movementBoundsScale: 1.22,
      soloTargetVerticalBodyLengths: 0.1,
      boundsUseSpeciesSize: false,
      // Feeds near the surface. Held further back than the mako (z -2 rather than 4) so the
      // nose of a 24 WU body stays well short of the camera.
      boundsYMin: -12,
      boundsZMin: -28,
      boundsZMax: -2,
      // 1 WU = 25 cm: the 20 m maximum is 80 WU. Never drawn at this size (see lifeStages).
      bodyLengthWU: 80,
      boids: {
        neighborCap: 3,
        perceptionBodyLengths: 1.2,
        separationWeight: 0.05,
        alignmentWeight: 0,
        cohesionWeight: 0,
        maxWeight: 0.06,
        selfAvoidanceScale: 0.1,
        // Harmless, but big: smaller fish give it room without fleeing it as they do the mako.
        menace: 0.3,
        wariness: 0.02,
      },
    },
    // Where remoras ride: sharksuckers and the common remora are often seen on whale sharks, on
    // the belly and flanks behind the gills. Anchors are in body lengths (runtime model frame,
    // +X right, +Y up, +Z tail), so the juvenile's 24 WU scale uses them unchanged.
    rideHost: {
      groups: ['shark', 'large-fish'],
      // Sampled over `whaleshark`'s faces (scripts/fit-ride-anchors.mjs) from 10% to 55% of the
      // length: 18 points, all on the belly between the gills and mid-body (the big pectorals
      // rule out the flanks), where remoras are mostly seen on whale sharks.
      anchors: RIDE_ANCHORS['rhincodon-typus'].anchors,
      waveSpan: RIDE_ANCHORS['rhincodon-typus'].waveSpan,
      // Clearance ellipsoid riders route around: snout to caudal peduncle along Z, the pectoral
      // span across X, the body (not the dorsal fin) in Y. At 24 WU: centre (0, 0.1, -2.4),
      // radii (3.5, 1.8, 9.6) WU.
      body: { center: [0, 0.006, -0.1], radii: [0.145, 0.075, 0.4] },
    },
    // Adults from the 8 m male maturity length to the 20 m maximum.
    sizeRange: [0.4, 1.0],
    // FishBase's length–weight for this body shape (TL cm → g; not species-specific): about 1.8 t
    // at 6 m.
    mass: { coefficient: 0.00389, exponent: 3.12 },
    model: {
      path: '/models/fish/rhincodon-typus/rhincodon-typus.glb',
      // Jeremy's model (2026-10-16): source length 99.87 (nose -Z to tail tip +Z), root already
      // mid-length on the body axis. 80 WU at size 1 for an adult; the juvenile rescales it.
      scale: 0.801,
      followAim: 'root',
      // Opaque: the texture (a generated three-view sheet) has no alpha channel. The supplied
      // GLB's BLEND material was made opaque and its 2.07 MB PNG re-encoded as a 184 KB JPEG.
      moveset: {
        cruise: 'procedural_cruise',
        drift: 'procedural_drift',
        turnLeft: 'procedural_turn_left',
        turnRight: 'procedural_turn_right',
        burst: 'procedural_burst',
      },
      proceduralAnimation: WHALE_SHARK_CAUDAL,
      debugForwardOrigin: 'head',
      debugForwardOffsetRatio: 0.5,
    },
    lifeStages: {
      // The only stage in the tank: a 5.5–6.5 m young shark, larger than the mako (17.8 WU) and
      // short of the ~8 m at which males mature. It keeps the species' gait, sized to itself.
      juvenile: {
        sizeRange: [0.92, 1.08],
        swim: {
          // 6 m = 24 WU at size 1.
          bodyLengthWU: 24,
        },
        model: {
          path: '/models/fish/rhincodon-typus/rhincodon-typus.glb',
          // Source length 99.87 -> 24 WU at size 1.
          scale: 0.2403,
          followAim: 'root',
          moveset: {
            cruise: 'procedural_cruise',
            drift: 'procedural_drift',
            turnLeft: 'procedural_turn_left',
            turnRight: 'procedural_turn_right',
            burst: 'procedural_burst',
          },
          proceduralAnimation: WHALE_SHARK_CAUDAL,
          debugForwardOrigin: 'head',
          debugForwardOffsetRatio: 0.5,
        },
      },
    },
  },
  // Facts from FishBase (Heemstra & Randall 1993 and its population and maturity tables). Picked
  // for The Reefs (Jeremy, 2026-10-18): a caudal swimmer, IUCN Vulnerable, above the 27 cm floor.
  {
    id: 'plectropomus-areolatus',
    name: 'Squaretail Coral Grouper',
    scientificName: 'Plectropomus areolatus',
    family: 'Epinephelidae',
    // Texture photo: Rickard Zerpe, credited in IMAGE_CREDITS.
    // Rendered tile (2026-10-18): fish 414 alone in open water, three-quarter head facing left.
    atlasThumbnail: '/atlas/plectropomus-areolatus-thumbnail.png',
    biome: 'ocean',
    depthZone: 'epipelagic',
    // FishBase calls it often shy; adults live spread out and only gather to spawn.
    schooling: false,
    repulser: false,
    aggressive: false,
    // Feeds exclusively on fishes (FishBase).
    predator: true,
    tempo: 'cruise',
    conservationStatus: {
      system: 'IUCN Red List',
      // Assessed 2016 (A2bd): declines from fishing, above all at spawning aggregations.
      code: 'VU',
      label: 'Vulnerable',
    },
    atlasDetails: {
      biome: 'Coral Reef',
      commonDiet: 'Reef fishes, and nothing else.',
      foundIn: 'Indo-Pacific reefs, Red Sea to the Phoenix Islands and Samoa, north to the Ryukyu Islands, south to Australia, 1 to 20 m.',
      // Solomon Islands (JCU thesis 52614): males grow faster and reach larger sizes. Khasanah et al.
      // 2019 (PMC6769801, Indonesia, n = 24): males in the larger size classes, smallest mature male
      // 42 cm against 33 cm for females. That paper's "males 34–55 cm, females 34–80 cm" ranges are
      // the camouflage grouper's, not this species'.
      sexualDimorphism: 'Males tend to grow faster and larger than females.',
      // Oldest aged fish: 14 years on the Great Barrier Reef, 9 on the Red Sea coast of Saudi Arabia.
      lifeSpan: 'Up to 14 years',
      // Pohnpei, Micronesia: females mature at 36.6 cm, about 2 years; males about 3 years.
      maturityAge: 'Females about 2 years; males about 3 years',
      social: {
        schoolSize: 'Solitary',
        groupingBehaviour: 'A shy fish of lagoons and seaward reefs with rich coral growth, most often met in channels along the reef front. Adults live spread out across the reef and come together only to spawn.',
        // FishBase lists protogyny, but no fish changing sex has been found (Rhodes et al. 2013,
        // Pohnpei: "unresolved"), and a Solomon Islands study found separate sexes (JCU thesis 52614).
        // Moon phase varies by region: full moon in Palau and Pohnpei (FishBase), new moon in
        // Wakatobi, Indonesia, where fish spawn from noon to dusk (Khasanah et al. 2019, Animals, PMC6769801).
        reproduction: 'Long thought to change sex from female to male, but no fish caught mid-change has been found, and a Solomon Islands study found the sexes separate from the start. Fish gather to spawn in channels along the reef front around the full or new moon, depending on the region, and in Indonesia spawn by day from noon until dusk. The eggs are scattered into open water with no parental care.',
      },
      averages: {
        // FishBase gives an 80 cm maximum (total length) and no common length or weight.
        // Khasanah et al. 2019 (Animals 9:643, Indonesia): the commercial catch averaged 1.05–1.08 kg
        // (n > 1,000 a year, sexes not split), about 42 cm by FishBase's length–weight (a 0.01096,
        // b 3.07). Life expectancy is the oldest aged fish, 14 years (unsexed).
        maleSizeMeters: 0.42,
        femaleSizeMeters: 0.42,
        maleWeightKg: 1.1,
        femaleWeightKg: 1.1,
        maleLifeExpectancyYears: 14,
        femaleLifeExpectancyYears: 14,
      },
      lifecycle: {
        sexualMaturityYears: 'Females about 2 years; males about 3 years',
        sexualSterilityYears: 'None known',
        offspringPerMatingEvent: 'Unknown',
      },
    },
    atlasSummary: {
      biome: 'Reef',
      zone: 'Sunlight',
      diet: 'Fish',
      social: 'Solitary',
    },
    description: 'A coral grouper up to 80 cm, pale grey to reddish brown and covered in small dark-edged blue spots, with dark fins and a square-cut tail edged in white. A shy hunter of rich coral reefs, it eats only fish. Around the full or new moon of the spawning season it gathers with others in channels along the reef front, and fishing at those gatherings is why the species is Vulnerable.',
    // FishBase: 80 cm maximum (total length); females mature at 36.6 cm.
    adultLengthRangeMeters: [0.37, 0.8],
    maxBodyLengthMeters: 0.8,
    swim: {
      // Starting values until the model lands and the motion is reviewed: a stalking reef
      // predator, slow and deliberate at cruise, with rare hard bursts from the tail.
      visualTimeScale: 0.8,
      driftEnabled: false,
      idleBLPerSec: [0.3, 0.6],
      idleDriftBLPerSec: [0.05, 0.1],
      snapBLPerSec: [0.8, 1.2],
      burstBLPerSec: [3.0, 4.5],
      burstInterval: [16.0, 30.0],
      burstActionDuration: 0.5,
      turnActionDuration: 0.6,
      erraticness: 0.1,
      // Broad pectorals let a grouper turn tightly for its length.
      turnRadiusBodyLengths: 1.2,
      speedMultiplier: 1.0,
      boundsUseSpeciesSize: false,
      // Down to the reef and forward to the foreground rocks.
      ...REEF_BOUNDS,
      // 1 WU = 25 cm: 80 cm maximum = 3.2 WU.
      bodyLengthWU: 3.2,
      boids: {
        neighborCap: 4,
        perceptionBodyLengths: 2.5,
        separationWeight: 0.3,
        alignmentWeight: 0,
        cohesionWeight: 0,
        maxWeight: 0.3,
        // A fish-eater: smaller fish give it room. Shy itself, so it yields to what approaches.
        menace: 0.3,
        wariness: 0.3,
      },
    },
    // Reef behaviour (reefBehavior.js, docs/reef-behavior.md). A shy ambush hunter that eats
    // only fish: it hangs still off a face or under a ledge for long spells and never pecks at
    // the rock.
    reef: {
      affinity: 0.8,
      modes: { patrol: 0.25, hover: 0.45, peck: 0, shelter: 0.3 },
      hoverSeconds: [10, 24],
      shelterSeconds: [15, 35],
      hoverStandoffBodyLengths: [0.9, 1.3],
      turnDegreesPerSecond: 90,
      startleShelterChance: 0.7,
      // Large reef fishes, coral trout among them, use table corals for cover more than any other
      // coral: at least three times the abundance, biomass and residence time of branching or
      // massive corals (Kerry & Bellwood 2012, Coral Reefs 31:415, Lizard Island). It hides under
      // the tables most of all, and hangs by them in ambush; by a staghorn thicket, far less.
      corals: { table: { shelter: 0.8, hover: 0.5 }, thicket: { hover: 0.15, patrol: 0.15 } },
    },
    // Individuals span 40 cm (just past female maturity) to 72 cm, the largest regional records.
    sizeRange: [0.5, 0.9],
    // FishBase Bayesian length–weight (TL cm → g): about 0.9 kg at 40 cm, 7.6 kg at 80 cm.
    mass: { coefficient: 0.01096, exponent: 3.07 },
    model: {
      path: '/models/fish/plectropomus-areolatus/plectropomus-areolatus.glb',
      // Jeremy's model (2026-10-18): source length 0.8002 (1 raw = 1 m) -> 3.2 WU; recentred
      // mid-length on the body axis (y ≈ -0.004 raw, snout to tail stalk). The texture's alpha
      // was solid, so it ships as a JPEG with the GLB's BLEND dropped.
      scale: 3.999,
      position: [0, 0.016, 0.155],
      followAim: 'root',
      moveset: {
        cruise: 'procedural_cruise',
        drift: 'procedural_drift',
        turnLeft: 'procedural_turn_left',
        turnRight: 'procedural_turn_right',
        burst: 'procedural_burst',
      },
      proceduralAnimation: {
        type: 'caudal-vertex',
        bodyMeshNames: ['squaretail_coral_grouper'],
        sourceAxis: 'z',
        lateralAxis: 'x',
        tailAtMaxZ: true,
        // Subcarangiform: a little more body in the wave than the jacks, at a slow beat.
        // About 0.05 body lengths of stroke (pilot fish 0.043); fin roots sit at 0.30.
        amplitude: 0.04,
        waveSpeed: 2.2,
        waveTravel: 4.0,
        flexStart: 0.3,
        flexFull: 0.85,
        turnStrength: 0.026,
        burstAmplitude: 0.9,
        response: 6,
        speedFrequencyBoost: 0.32,
        burstFrequencyBoost: 0.24,
        // Groupers hold station on their pectorals, so these work harder than a jack's.
        pectoralFinFlutter: 0.14,
        pelvicFinFlutter: 0.06,
      },
      debugForwardOrigin: 'head',
      debugForwardOffsetRatio: 0.5,
    },
  },
  // --- Humphead wrasse (Labridae) ------------------------------------------------------------
  // Facts from FishBase, Choat et al. 2006 (MEPS 318:237, age and growth, NE Australia) and the
  // Florida Museum profile. The largest wrasse: a roving reef predator, usually alone, sometimes
  // in pairs, that crushes shellfish and urchins off the reef by day and sleeps under ledges at
  // night. Chosen over the bumphead parrotfish so The Reefs gains a focal animal, not a herd
  // (Jeremy, 2026-10-21). Long Cheilinus undulatus (FishBase still uses it): moved to the
  // resurrected genus Crassilabrus by Near et al. 2025 (Bull. Peabody Mus. Nat. Hist., the
  // phylogenetic taxonomy of Labridae), being closer to the slingjaw wrasses (Epibulus) than to
  // Cheilinus. Jeremy's terminal male and female models (`model.sexVariants`).
  {
    id: 'crassilabrus-undulatus',
    name: 'Humphead Wrasse',
    scientificName: 'Crassilabrus undulatus',
    family: 'Labridae',
    alternateNames: ['Napoleon Wrasse', 'Maori Wrasse'],
    // Rendered tile (2026-10-22): fish 458 alone in open water, three-quarter head facing left.
    atlasThumbnail: '/atlas/crassilabrus-undulatus-thumbnail.png',
    biome: 'ocean',
    depthZone: 'epipelagic',
    // "Usually solitary but may occur in pairs" (FishBase); sometimes one male with smaller adults
    // and juveniles (Florida Museum). Each fish roams as a solo agent. The tank has one
    // terminal male (Jeremy, 2026-10-22) and, since the female model, two smaller females.
    schooling: false,
    repulser: false,
    aggressive: false,
    // Mollusks, fishes, sea urchins and crustaceans (FishBase).
    predator: true,
    tempo: 'cruise',
    conservationStatus: {
      system: 'IUCN Red List',
      // Assessed 17 July 2024 (A2bcd); CITES Appendix II. Fished for the live reef food fish trade.
      code: 'EN',
      label: 'Endangered',
    },
    atlasDetails: {
      biome: 'Coral Reef',
      commonDiet: 'Mollusks, fishes, sea urchins and crustaceans; one of the few predators of sea hares, boxfishes and crown-of-thorns starfish.',
      foundIn: 'Indo-Pacific reefs, Red Sea to South Africa and the Tuamotu Islands, north to the Ryukyu Islands, south to New Caledonia, 0 to 100 m.',
      // Choat et al. 2006: males grow faster and reach 140 cm FL. Florida Museum: females rarely
      // pass about 1 m; males blue to green, the hump larger in larger males.
      sexualDimorphism: 'Males grow faster and larger, blue to green, the forehead hump growing with size. Females rarely pass about 1 m.',
      // FishBase: 32 years. Choat et al. 2006: 25 for males, 30 for females.
      lifeSpan: 'Up to 32 years',
      // Choat et al. 2006 (FishBase's unsexed Great Barrier Reef record says 5–7 years).
      maturityAge: 'Females about 6 to 7 years; males from about 9 years',
      social: {
        schoolSize: 'Solitary',
        groupingBehaviour: 'Usually alone, sometimes in pairs, or one male with smaller adults and young. Adults rove steep outer reef slopes, channels and lagoon reefs by day and rest in caves and under coral ledges at night. Juveniles settle among staghorn and other branching corals, and in seagrass.',
        // Choat et al. 2006: male recruitment from 9 years at about 70 cm; not all females change.
        // Florida Museum: aggregations at the down-current end of the reef, daily after high tide
        // off Palau, in most months; pairs spawn within groups of up to 100.
        reproduction: 'Starts life female; some females turn male from about 9 years and 70 cm, but not all do. Adults gather at the down-current end of a reef, off Palau daily after high tide in most months, and pairs spawn within groups of up to 100.',
      },
      averages: {
        // Choat et al. 2006 (NE Australia, 164 aged fish; the tail is rounded, so fork length is
        // total length). Females level off at a mean asymptotic 75.5 cm (VBGF). Males grow on a
        // line (44.6 mm a year) from 70 cm at 9 years to 142 cm: 1.0 m is the middle of that
        // range, reached at about 16 years. Weights from FishBase's length–weight (a 0.01445,
        // b 2.98). Life expectancy is each sex's oldest aged fish, as for the other species
        // (FishBase gives 32 years unsexed).
        maleSizeMeters: 1.0,
        femaleSizeMeters: 0.75,
        maleWeightKg: 13,
        femaleWeightKg: 5.7,
        maleLifeExpectancyYears: 25,
        femaleLifeExpectancyYears: 30,
      },
      lifecycle: {
        // Choat et al. 2006: ovaries ripen first at about 55 cm FL and 6 to 7 years; the youngest male
        // was 9 years. No egg count published (the paper gives ovary weights only).
        sexualMaturityYears: 'Females about 6 to 7 years; males from about 9 years',
        sexualSterilityYears: 'None known',
        offspringPerMatingEvent: 'Unknown',
      },
    },
    atlasSummary: {
      biome: 'Reef',
      zone: 'Sunlight',
      diet: 'Shellfish + urchins',
      social: 'Solitary',
    },
    description: 'The largest wrasse, past 2 m and 190 kg, with thick lips and a hump on the forehead that grows with age. The body is olive to green with a dark bar on each scale; the head is blue-green, covered in wavy yellowish lines, with two black lines running back from the eye. It roves the outer reef alone or in pairs by day, crushing shellfish, urchins and even crown-of-thorns starfish, and sleeps under a ledge at night. Fishing for the live reef food fish trade has made it Endangered. Long known as Cheilinus undulatus, it was moved to Crassilabrus in 2025, when genes showed it nearer the slingjaw wrasse.',
    // Sadovy de Mitcheson, Liu & Suharti 2010 (Indonesia, histology of 178 fish): smallest mature
    // female 65 cm TL. FishBase maximum 229 cm SL.
    adultLengthRangeMeters: [0.65, 2.29],
    maxBodyLengthMeters: 2.29,
    swim: {
      // Starting values until the model lands: a labriform cruiser that rows on its pectorals,
      // slow and heavy, keeping its tail for rare bursts.
      visualTimeScale: 0.75,
      driftEnabled: false,
      idleBLPerSec: [0.2, 0.4],
      idleDriftBLPerSec: [0.04, 0.08],
      snapBLPerSec: [0.6, 0.9],
      burstBLPerSec: [2.0, 3.0],
      burstInterval: [20.0, 40.0],
      burstActionDuration: 0.6,
      turnActionDuration: 0.8,
      erraticness: 0.08,
      // Pectoral rowing turns a wrasse tightly for its length.
      turnRadiusBodyLengths: 1.0,
      speedMultiplier: 1.0,
      boundsUseSpeciesSize: false,
      ...REEF_BOUNDS,
      // 1 WU = 25 cm: 229 cm maximum = 9.16 WU. sizeRange keeps the tank's fish at 1.15–1.5 m.
      bodyLengthWU: 9.16,
      boids: {
        neighborCap: 4,
        perceptionBodyLengths: 2.0,
        separationWeight: 0.3,
        alignmentWeight: 0,
        cohesionWeight: 0,
        maxWeight: 0.3,
        // Big and a fish-eater, so smaller fish give it room; calm and curious, so it yields little.
        menace: 0.3,
        wariness: 0.1,
      },
    },
    // 0.5–0.65 of 229 cm = 1.15–1.5 m: large adults without the 2 m record holders, about 4.6–6
    // WU, so it reads as a resident rather than a wall on the phone's crop (2026-10-21).
    sizeRange: [0.5, 0.65],
    // Females level off near 75 cm and rarely pass about 1 m (Choat et al. 2006, Florida Museum):
    // 0.35–0.44 of 229 cm = 0.8–1.0 m, about 3.2–4 WU, the grouper's length and a little more.
    sizeRangeBySex: { female: [0.35, 0.44] },
    // FishBase Bayesian length–weight (TL cm): a 0.01445, b 2.98; about 13 kg at 1 m, 44 kg at 1.5 m.
    mass: { coefficient: 0.01445, exponent: 2.98 },
    // Reef behaviour (reefBehavior.js, docs/reef-behavior.md). It roves the reef by day, so it
    // patrols more than any other resident, pausing off a face and biting shellfish and urchins
    // off the rock. Its ledge is for the night, so it shelters little. At the corals it cruises
    // past and under the tables; the staghorn is a juvenile's home, too tight for an adult.
    reef: {
      affinity: 0.75,
      modes: { patrol: 0.45, hover: 0.25, peck: 0.2, shelter: 0.1 },
      pecks: [1, 2],
      hoverSeconds: [4, 10],
      hoverStandoffBodyLengths: [0.6, 0.9],
      turnDegreesPerSecond: 60,
      startleShelterChance: 0.2,
      corals: { table: { patrol: 0.3, hover: 0.25, shelter: 0.15 }, thicket: { patrol: 0.2, peck: 0.1 } },
    },
    model: {
      path: '/models/fish/crassilabrus-undulatus/crassilabrus-undulatus.glb',
      // Jeremy's terminal male (2026-10-22): source length 20.198 raw, snout to tail tip -> 9.16
      // WU; the root is recentred mid-length on the line from the snout (y -0.99) to the tail
      // tip's middle (y -0.49). The tail fin starts about 0.8 back. The three photo textures were
      // solid PNGs, so they ship as JPEGs (fins resized to 1024 px) with the GLB's BLEND dropped:
      // 9.3 MB -> 0.85 MB. The body came out inside out (normals and winding inward; the
      // double-sided material hid it in the tank, the Atlas lit it from within), so its winding
      // and normals are flipped in the GLB, as Recalculate Outside would (dev_2). His revised model
      // (dev_6, rear body reshaped) came out inside out too and is flipped the same way.
      scale: 0.45351,
      position: [0, 0.3347, -0.8858],
      sexVariants: {
        male: {
          path: '/models/fish/crassilabrus-undulatus/crassilabrus-undulatus.glb',
        },
        // Jeremy's female (2026-10-22): no hump, grey with a yellow-edged tail. Source length
        // 10.008 raw, snout to tail tip -> 9.16 WU; recentred mid-length on the line from the
        // snout (y -0.09) to the tail tip's middle (y 0.39). One body texture, a Diego Delso
        // photo (CC BY-SA 4.0, credited in Sources): a solid 1920 px PNG shipped as a JPEG with
        // the BLEND dropped, 3.2 MB -> 0.58 MB. Exported the right way out (99% of normals).
        female: {
          path: '/models/fish/crassilabrus-undulatus/crassilabrus-undulatus-female.glb',
          scale: 0.9153,
          position: [0, -0.1355, -1.675],
          proceduralAnimation: {
            ...HUMPHEAD_WRASSE_SWIM,
            bodyMeshNames: ['humphead_wrasse_female'],
            // 0.03 body lengths of 10.008, as the male's.
            amplitude: 0.3,
          },
        },
      },
      followAim: 'root',
      moveset: {
        cruise: 'procedural_cruise',
        drift: 'procedural_drift',
        turnLeft: 'procedural_turn_left',
        turnRight: 'procedural_turn_right',
        burst: 'procedural_burst',
      },
      proceduralAnimation: {
        ...HUMPHEAD_WRASSE_SWIM,
        bodyMeshNames: ['humphead_wrasse'],
        // 0.03 body lengths of 20.198.
        amplitude: 0.6,
      },
      debugForwardOrigin: 'head',
      debugForwardOffsetRatio: 0.5,
    },
  },
  // --- Munk's devil ray (Mobulidae) ----------------------------------------------------------
  // Facts from FishBase, the Sharks and Rays profile and Palacios et al. 2021 (Aquatic
  // Conservation, Gulf of California maturity). A small devil ray that schools in the thousands in
  // the southern Gulf of California and leaps clear of the water in groups. The hero school of a
  // planned third reserve, a shallow Sea of Cortez sand bay (Jeremy, 2026-10-23; ROADMAP: Munk's
  // Devil Ray and The Shallows). Swims in The Shallows as Jeremy's model (dev_2).
  {
    id: 'mobula-munkiana',
    name: "Munk's Devil Ray",
    scientificName: 'Mobula munkiana',
    family: 'Mobulidae',
    alternateNames: ["Munk's Pygmy Devil Ray", 'Popcorn Ray'],
    biome: 'ocean',
    depthZone: 'epipelagic',
    // "Found singly, in small groups, or in schools" (FishBase); aggregations of many thousands
    // in the southern Gulf of California and around the tip of Baja (Sharks and Rays).
    schooling: true,
    repulser: false,
    aggressive: false,
    // Mainly planktonic crustaceans, also small schooling fishes (FishBase): a filter feeder.
    predator: false,
    tempo: 'cruise',
    conservationStatus: {
      system: 'IUCN Red List',
      // Assessed 9 November 2018 (A2d+3d); CITES Appendix II, CMS Appendices I and II. Taken in
      // targeted fisheries in Mexico and Peru and for the gill plate trade, and easy to catch
      // because it schools.
      code: 'VU',
      label: 'Vulnerable',
    },
    atlasDetails: {
      biome: 'Coastal Open Water',
      commonDiet: 'Planktonic crustaceans, above all mysid shrimps; sometimes small schooling fishes.',
      foundIn: 'Eastern Pacific, from the Gulf of California to Peru and the Galápagos Islands, at the surface down to about 30 m.',
      maxLengthLabel: 'Disc width',
      sexualDimorphism: 'None described beyond the claspers of males.',
      lifeSpan: 'Unknown',
      maturityAge: 'Unknown',
      social: {
        schoolSize: 'Thousands',
        groupingBehaviour: 'Alone, in small groups or in schools of many thousands, common in the southern Gulf of California and around the tip of Baja. Rays leap clear of the water one after another, which earned them the name "popcorn rays"; the leaps may be courtship. Juveniles have been seen feeding in the breaking waves of the surf zone.',
        // Palacios et al. 2021: courtship seen and sperm found in males at Espíritu Santo.
        reproduction: 'Bears live young, a single pup about 35 cm across. Gestation is unknown. Mating is thought to happen in the southern Gulf of California from April to June.',
      },
      averages: {
        // FishBase: common disc width 100 cm, nothing by sex.
        maleSizeMeters: 'Unknown',
        femaleSizeMeters: 'Unknown',
        maleWeightKg: 'Unknown',
        femaleWeightKg: 'Unknown',
        maleLifeExpectancyYears: 'Unknown',
        femaleLifeExpectancyYears: 'Unknown',
      },
      lifecycle: {
        sexualMaturityYears: 'Unknown',
        sexualSterilityYears: 'Unknown',
        offspringPerMatingEvent: '1 pup',
      },
    },
    atlasSummary: {
      biome: 'Coastal',
      zone: 'Sunlight',
      diet: 'Mysid shrimp',
      social: 'Schooling',
    },
    // Rendered in The Shallows with Jeremy's model, alone in frame (dev_2, 2026-10-24).
    atlasThumbnail: '/atlas/mobula-munkiana-thumbnail.png',
    description: "One of the smallest devil rays, about a metre across, purplish-grey to brown above and white below, with short horn-like head fins, a small dorsal fin and a long whip of a tail with no sting. It sieves mysid shrimps and other plankton from the water in schools that can number many thousands, and groups leap clear of the surface one after another. It has a single pup at a time, and fishing for its gill plates has left it Vulnerable.",
    // Sizes are disc width (wingtip to wingtip), the measure rays are given in. FishBase lists a
    // 220 cm maximum from an older reference; recent papers give about 130 cm (Stewart et al.
    // 2018, as cited in Marine Biology 2023, doi 10.1007/s00227-023-04314-0) and the Sharks and
    // Rays profile 110 cm. Size at maturity is in Palacios et al. 2021, not yet
    // read, so the lower bound is FishBase's common width.
    adultLengthRangeMeters: [1.0, 1.3],
    maxBodyLengthMeters: 1.3,
    swim: {
      // Starting values until the model and the disc-wave motion land: a steady cruiser that
      // flies in a school, never hovers, and turns in broad banked arcs.
      visualTimeScale: 0.6,
      driftEnabled: false,
      // A calm cruising school: no scheduled surge, nor acceleration on a turn.
      burstEnabled: false,
      turnSpeedupEnabled: false,
      schoolSoftWallBodyLengths: 0.5,
      schoolFormationWeight: 0.22,
      schoolStationGain: 0.1,
      schoolStationSpeedRange: [0.9, 1.1],
      schoolMigrationSmoothing: 0.45,
      // An organic 3D cloud, sampled once with clearance for full-size wings and
      // opposite beat phases. No rows or layers; same slots at spawn and in flight.
      schoolFormation: {
        radiusBodyLengths: 2.45,
        heightBodyLengths: 1.15,
        lateralBodyLengths: 1.12,
        longitudinalBodyLengths: 0.9,
        verticalBodyLengths: 0.5,
      },
      idleBLPerSec: [0.5, 0.9],
      idleDriftBLPerSec: [0.12, 0.25],
      snapBLPerSec: [1.4, 2.0],
      burstBLPerSec: [2.5, 3.5],
      burstInterval: [14.0, 28.0],
      erraticness: 0.08,
      turnRadiusBodyLengths: 2.5,
      // 1 WU = 25 cm: 130 cm disc width = 5.2 WU.
      bodyLengthWU: 5.2,
      // The Shallows' swim volume (landscapes.js shallows, SHALLOWS_VIEW): the upper half of the
      // bay, from 12 WU over the sand (y -28) to under a metre below the surface (y 4.6), so the
      // school flies above the camera (y -24), and 22–69 WU in front of it (z 24). The Z bounds
      // are offset by -15 in fishSwim.js, so -30/17 is z -45 to 2. A box ±15 WU wide, so the
      // school keeps crossing the middle strip a 375 px phone sees. 40 s samples of 10+ rays in
      // that strip: ±26 62%, ±20 100% then 60% on a second run (the school's path varies); desktop
      // kept all 60 in frame throughout.
      boundsUseSpeciesSize: false,
      boundsHalfX: 15,
      boundsYMin: -16,
      boundsYMax: 1,
      boundsZMin: -30,
      boundsZMax: 17,
      // The school's slots are spaced for sardinella (about 1 WU); a 4 WU ray needs about 3.5
      // times the room, or 60 of them pack into a ball of overlapping wings.
      schoolSpacingScale: 3.5,
      boids: {
        neighborCap: 6,
        perceptionBodyLengths: 3.0,
        separationWeight: 0.35,
        alignmentWeight: 0.4,
        cohesionWeight: 0.2,
        maxWeight: 0.45,
        menace: 0,
        wariness: 0.4,
      },
    },
    // 0.65–0.85 of 130 cm = 0.85–1.1 m across (3.4–4.4 WU): the common adult, about a metre.
    sizeRange: [0.65, 0.85],
    // Jeremy's model (`_blender models/mobula munkiana.glb`, 2026-10-24), run through
    // scripts/paint-disc-wave-masks.py: scaled to a 1.3 m disc (1 unit = 1 m), origin mid-disc,
    // nose -Z, the COLOR_1 masks computed from its shape, textures as JPEG (solid alpha, so it
    // renders opaque). One mesh in three material parts: top, bottom and the head fins' sides.
    model: {
      path: '/models/fish/mobula-munkiana/mobula-munkiana.glb',
      // Individual albedo variation; noiseScale is in the model's source metres. A single
      // seed covers all three material parts and survives tank switches/debug remounts.
      surfaceVariation: {
        noise: 0.65,
        noiseScale: 3,
        brightness: [0.65, 1.3],
        saturation: [0.6, 1.25],
        warmth: [-0.08, 0.08],
      },
      // 1 m = 4 WU, so the 1.3 m disc is the 5.2 WU body length.
      scale: 4,
      followAim: 'root',
      moveset: {
        cruise: 'procedural_cruise',
        drift: 'procedural_drift',
        turnLeft: 'procedural_turn_left',
        turnRight: 'procedural_turn_right',
        burst: 'procedural_burst',
      },
      // Mobuliform disc-wave (docs/procedural/disc-wave.md, approved 2026-10-23): the wings beat
      // together, under one wavelength across the chord, the tips lagging the root. Lengths in
      // source metres.
      proceduralAnimation: {
        type: 'disc-wave-vertex',
        bodyMeshNames: ['munks_devil_ray_1', 'munks_devil_ray_2', 'munks_devil_ray_3'],
        // Wingtip lift at full cruise, either side of level: 0.26 of the 0.55 m wing, about 25°.
        amplitude: 0.26,
        // About one beat every 1.4 s at cruise (a small ray beats faster than a manta).
        waveSpeed: 3.6,
        // Stable individual cadence, integrated into the clock (never elapsed * rate).
        beatRateRange: [0.78, 1.22],
        // Radians of wave across the chord: well under a wavelength, so it flaps, not ripples.
        waveTravel: 0.6,
        // Radians the tip trails the root, so the wing curls after each stroke.
        spanLag: 0.9,
        // The downstroke takes 42% of the beat, the recovery the rest.
        downFraction: 0.42,
        marginRampPower: 1.6,
        // A resting ray still beats, at half the cruise stroke.
        idleAmplitudeFloor: 0.5,
        burstAmplitude: 0.4,
        turnStrength: 0.35,
        heave: 0.06,
        tailAmplitude: 0.05,
        response: 3,
        speedFrequencyBoost: 0.3,
        burstFrequencyBoost: 0.35,
      },
      debugForwardOrigin: 'head',
      debugForwardOffsetRatio: 0.2,
    },
  },
  // A coral for The Reefs' landscape (Jeremy, 2026-10-19: "they need an atlas entry, since
  // corals are animals"). Not a swimming creature: no `swim`, no tank roster slot, no creature
  // rows. Its tables are placed on the rocks by the landscape (landscapes.js `corals`,
  // src/components/coralPlacement.js); the Atlas shows a cluster of them on a small rock.
  // Facts: SeaLifeBase (IUCN EN, 2023, A3ce; tables several metres across), Wikipedia (1-25 m;
  // range narrowed by Rassmussen et al. 2025), reproduction from the Philippine, Taiwanese,
  // Japanese and Singapore spawning studies (PMC6350966, Zool. Stud. 57-46, Toh 2012).
  {
    id: 'acropora-hyacinthus',
    name: 'Hyacinth Table Coral',
    scientificName: 'Acropora hyacinthus',
    family: 'Acroporidae',
    // Tile (2026-10-19): Jeremy's own capture of a table coral cluster in The Reefs, square-
    // cropped round the cluster and scaled to 470 px.
    atlasThumbnail: '/atlas/acropora-hyacinthus-thumbnail.png',
    biome: 'ocean',
    depthZone: 'epipelagic',
    schooling: false,
    repulser: false,
    aggressive: false,
    predator: false,
    conservationStatus: {
      system: 'IUCN Red List',
      // Assessed 2023 (A3ce): projected declines as reefs warm and degrade.
      code: 'EN',
      label: 'Endangered',
    },
    atlasDetails: {
      biome: 'Coral Reef',
      maxLengthLabel: 'Table width',
      commonDiet: 'Sugars from the algae living in its tissues, and plankton its polyps catch at night.',
      foundIn: 'The central Pacific and the east coast of Australia, including the Great Barrier Reef, on upper reef slopes 1 to 25 m deep. Once thought to range across the whole Indo-Pacific.',
      sexualDimorphism: 'None: every colony is both male and female.',
      lifeSpan: 'Unknown',
      maturityAge: 'Unknown',
      social: {
        schoolSize: 'Colonial',
        groupingBehaviour: 'Each table is one colony: thousands of tiny polyps sharing one skeleton. Tables grow on shallow upper reef slopes, often crowding one another in overlapping tiers, with fish sheltering in the shade beneath.',
        reproduction: 'Each colony makes both eggs and sperm, once a year. A night or two after a full moon it releases them into the water to meet those of other colonies. The season shifts with latitude, from March in the Philippines to July and August in southern Japan.',
      },
      averages: {
        // Colonies are both sexes, and no average colony size, weight or age is published (the largest
        // recorded tables are about 3 m across, Coral Trait Database).
        maleSizeMeters: 'Unknown',
        femaleSizeMeters: 'Unknown',
        maleWeightKg: 'Unknown',
        femaleWeightKg: 'Unknown',
        maleLifeExpectancyYears: 'Unknown',
        femaleLifeExpectancyYears: 'Unknown',
      },
      lifecycle: {
        // Coral Trait Database: 5.6 eggs per polyp on average (Great Barrier Reef colonies range 1 to
        // 17); colonies spawn once a year.
        sexualMaturityYears: 'Unknown',
        sexualSterilityYears: 'None known',
        offspringPerMatingEvent: 'About 6 eggs per polyp',
      },
    },
    atlasSummary: {
      biome: 'Reef',
      zone: 'Sunlight',
      diet: 'Sunlight & plankton',
      social: 'Colonial',
    },
    description: 'A table coral: one colony of thousands of tiny polyps building a flat, lattice-like plate on a short stalk, growing into tables several metres across. It lives on shallow upper reef slopes, where its tables shade the fish below. Expected to keep declining as reefs warm and degrade, it is listed as Endangered.',
    // The biggest table's width (Jeremy's model of a Kelso Reef table); tables grow larger.
    maxBodyLengthMeters: 2.5,
    model: {
      path: '/models/fish/acropora-hyacinthus/acropora-hyacinthus.glb',
      // Nine of the tank's tables crowning a small bommie on a faint patch of sand, centred on
      // the rock and tables, after Jeremy's photo of one (scripts/build-coral-atlas.py,
      // 2026-10-19: "in the atlas, show a cluster instead of one single stalk"). 1 raw = 1 m
      // -> 4 WU.
      scale: 4,
      // The sand's soft edge is alpha-blended; the rock and tables are opaque.
      alphaBlend: true,
    },
  },
  // The second coral for The Reefs' landscape (Jeremy's staghorn model, 2026-10-20). Like the
  // table coral, a landscape species: no `swim`, no roster slot, no creature rows. It grows in
  // one-colour patches on the table corals' bommies (landscapes.js `staghorn`,
  // src/components/staghornPlacement.js); the Atlas shows a thicket round a low rock in three
  // colour patches (scripts/build-staghorn-atlas.py).
  // Facts: SeaLifeBase (IUCN EN, 27 April 2023, A3ce; hermaphrodite; thickets dominating
  // lagoons), Wikipedia (range, 5-30 m, thickets up to 10 m across, blue, brown or cream with
  // pale tips; formerly Acropora formosa), spawning from Oliver 1987 (JCU thesis, A. formosa:
  // once a year in the mass spawning).
  {
    id: 'acropora-muricata',
    name: 'Staghorn Coral',
    scientificName: 'Acropora muricata',
    family: 'Acroporidae',
    // Tile (2026-10-20): an in-tank close-up of a bommie crowned with brown staghorn, blue on its
    // shoulder and tables at its foot, rendered square at 940 px with the tank's own renderer
    // and scaled to 470 px.
    atlasThumbnail: '/atlas/acropora-muricata-thumbnail.png',
    biome: 'ocean',
    depthZone: 'epipelagic',
    schooling: false,
    repulser: false,
    aggressive: false,
    predator: false,
    conservationStatus: {
      system: 'IUCN Red List',
      // Assessed 27 April 2023 (A3ce): projected declines as reefs warm and degrade.
      code: 'EN',
      label: 'Endangered',
    },
    atlasDetails: {
      biome: 'Coral Reef',
      maxLengthLabel: 'Thicket width',
      commonDiet: 'Sugars from the algae living in its tissues, and plankton its polyps catch at night.',
      foundIn: 'The Indo-Pacific, from the Red Sea and East Africa to the central Pacific, on shallow reefs, reef slopes and in lagoons, 5 to 30 m deep.',
      sexualDimorphism: 'None: every colony is both male and female.',
      lifeSpan: 'Unknown',
      maturityAge: 'Unknown',
      social: {
        schoolSize: 'Colonial',
        groupingBehaviour: 'Each colony is thousands of tiny polyps sharing one branching skeleton. Branches broken off by storms take root where they land and grow into new colonies, so thickets spread across lagoons and shallow slopes, often as one clone.',
        reproduction: 'Each colony makes both eggs and sperm and releases them once a year, in the mass spawning a few nights after a full moon, when many reef corals spawn together. It also spreads by fragments, which grow into new colonies.',
      },
      averages: {
        // Colonies are both sexes, and no average colony size, weight or age is published (recorded
        // thickets reach 2.5 to 10 m across, Coral Trait Database).
        maleSizeMeters: 'Unknown',
        femaleSizeMeters: 'Unknown',
        maleWeightKg: 'Unknown',
        femaleWeightKg: 'Unknown',
        maleLifeExpectancyYears: 'Unknown',
        femaleLifeExpectancyYears: 'Unknown',
      },
      lifecycle: {
        sexualMaturityYears: 'Unknown',
        sexualSterilityYears: 'None known',
        offspringPerMatingEvent: 'Unknown',
      },
    },
    atlasSummary: {
      biome: 'Reef',
      zone: 'Sunlight',
      diet: 'Sunlight & plankton',
      social: 'Colonial',
    },
    description: 'A branching coral whose colonies grow like antlers, blue, brown or cream with pale tips, into thickets up to 10 m across. Broken branches take root and grow on, so a thicket can cover a lagoon floor, sheltering small fish between its branches. Bleaching and the decline of reefs have made it Endangered.',
    // The Atlas thicket's width, for the scale comparison; thickets grow to 10 m (Wikipedia).
    maxBodyLengthMeters: 3,
    model: {
      path: '/models/fish/acropora-muricata/acropora-muricata.glb',
      // Fourteen of the tank's colonies round a low rock in brown, blue and cream patches, on a faint patch of sand,
      // centred on the rock and colonies (scripts/build-staghorn-atlas.py). 1 raw = 1 m -> 4 WU.
      scale: 4,
      // The sand's soft edge is alpha-blended; the rock and colonies are opaque.
      alphaBlend: true,
    },
  },
]

export const CREATURES = [
  ...Array.from({ length: 88 }, (_, index) => ({
    id: index + 1,
    species: 'amblygaster-sirm',
    biome: 'ocean',
    depthZone: 'epipelagic',
    bornAt: index === 0 ? '2026-05-13T00:00:00Z' : '2026-05-17T00:00:00Z',
    alive: true,
    sex: (index + 1) % 2 === 0 ? 'female' : 'male',
  })),
  {
    id: 89,
    species: 'mola-alexandrini',
    biome: 'ocean',
    depthZone: 'epipelagic',
    bornAt: '2026-05-26T00:00:00Z',
    alive: true,
    sex: 'male',
  },
  ...[0.338, 0.398, 0.44, 0.476].map((size, index) => ({
    id: 90 + index,
    species: 'coryphaena-hippurus',
    biome: 'ocean',
    depthZone: 'epipelagic',
    bornAt: `2026-06-08T07:1${index}:00Z`,
    alive: true,
    sex: index % 2 === 0 ? 'male' : 'female',
    size,
  })),
  {
    id: 94,
    species: 'isurus-oxyrinchus',
    biome: 'ocean',
    depthZone: 'epipelagic',
    bornAt: '2026-07-02T00:00:00Z',
    alive: true,
    sex: 'female',
    size: 0.82,
  },
  // Remora review fixtures: more shark riders than the mako has anchors, so some always
  // wait their turn, plus one of each host-less or occasional rider.
  ...[
    ['echeneis-naucrates', 0.7],
    ['echeneis-naucrates', 0.35],
    ['echeneis-neucratoides', 0.6],
    ['remora-remora', 0.5],
    ['remora-remora', 0.25],
    ['remora-albescens', 0.6],
    ['remora-australis', 0.5],
    ['remora-brachyptera', 0.6],
    ['remora-osteochir', 0.5],
    ['phtheirichthys-lineatus', 0.55],
  ].map(([species, size], index) => ({
    id: 95 + index,
    species,
    biome: 'ocean',
    depthZone: 'epipelagic',
    bornAt: '2026-09-25T00:00:00Z',
    alive: true,
    sex: index % 2 === 0 ? 'male' : 'female',
    size,
  })),
  // Pilot fish review fixtures: a small group round the Mola.
  ...[0.9, 0.7, 0.55].map((size, index) => ({
    id: 105 + index,
    species: 'naucrates-ductor',
    biome: 'ocean',
    depthZone: 'epipelagic',
    bornAt: '2026-10-10T00:00:00Z',
    alive: true,
    sex: index % 2 === 0 ? 'male' : 'female',
    size,
  })),
  // Longfin bannerfish review fixtures: a pair round the Mola.
  ...[0.95, 0.75].map((size, index) => ({
    id: 108 + index,
    species: 'heniochus-acuminatus',
    biome: 'ocean',
    depthZone: 'epipelagic',
    bornAt: '2026-10-11T00:00:00Z',
    alive: true,
    sex: index % 2 === 0 ? 'male' : 'female',
    size,
  })),
  // Whale shark review fixture: one 6 m juvenile male in the Open Sea.
  {
    id: 110,
    species: 'rhincodon-typus',
    biome: 'ocean',
    depthZone: 'epipelagic',
    bornAt: '2026-10-16T00:00:00Z',
    alive: true,
    sex: 'male',
    lifeStage: 'juvenile',
    // Mid-range: 24 WU, 6 m.
    size: 0.5,
  },
]
