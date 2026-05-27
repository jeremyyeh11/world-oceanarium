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

export const SPECIES = [
  {
    id: 'amblygaster-sirm',
    legacyIds: ['sardine'],
    name: 'Spotted Sardinella',
    scientificName: 'Amblygaster sirm',
    family: 'Clupeidae',
    alternateNames: ['Northern pilchard', 'Spotted pilchard', 'Spotted sardine', 'Trenched sardine'],
    biome: 'ocean',
    depthZone: 'epipelagic',
    schooling: true,
    aggressive: false,
    predator: false,
    description: 'A reef-associated coastal sardinella with 10–20 golden spots along the flank. It reaches up to 27 cm total length and is widely caught for food and bait fisheries.',
    swim: {
      // World Oceanarium scale: 1 WU = 25 cm. A. sirm maximum total length ≈27 cm = 1.08 WU.
      bodyLengthWU: 1.08,
      // Keeps biologically grounded BL/s ratios readable in the aquarium camera.
      visualTimeScale: 0.35,
      idleBLPerSec: [1.0, 1.8],
      idleDriftBLPerSec: [0.18, 0.35],
      snapBLPerSec: [3.0, 5.0],
      burstBLPerSec: [5.0, 8.0],
      burstInterval: [5.5, 9.5],
      erraticness: 0.24,
      turnRadius: 0.78,
      boundsXMin: -18,
      boundsXMax: 18,
      boundsYMin: -7,
      boundsZMin: -15,
      boundsZMax: 8,
    },
    // Normalized individual size maps to roughly 15–27 cm total length for Amblygaster sirm.
    sizeRange: [0.55, 1.0],
    mass: {
      // Length-weight estimate: grams = coefficient * bodyLengthCm^exponent.
      coefficient: 0.006,
      exponent: 3,
    },
    model: {
      path: '/models/fish/sardine/sardine.glb',
      scale: 0.42,
    },
  },
  {
    id: 'large-predator',
    name: 'Large Predator',
    biome: 'ocean',
    depthZone: 'epipelagic',
    schooling: false,
    aggressive: false,
    predator: true,
    description: 'A generic large solo predator placeholder for testing scale, presence, and future apex species behavior.',
    swim: {
      // Generic large non-schooling predator placeholder for future specific species.
      bodyLengthWU: 2.0,
      visualTimeScale: 0.35,
      idleBLPerSec: [0.35, 0.65],
      idleDriftBLPerSec: [0.08, 0.16],
      snapBLPerSec: [1.1, 1.6],
      burstBLPerSec: [1.8, 2.5],
      burstInterval: [8.0, 13.0],
      erraticness: 0.12,
      turnRadius: 0.9,
      speedMultiplier: 0.55,
    },
    sizeRange: [3.2, 3.8],
    mass: {
      // Generic shark-like estimate until this placeholder becomes a specific species.
      coefficient: 0.0095,
      exponent: 3,
    },
  },
  {
    id: 'mola-alexandrini',
    legacyIds: ['mola-mola'],
    legacyNames: ['Ocean Sunfish'],
    name: 'Giant Sunfish',
    scientificName: 'Mola alexandrini',
    family: 'Molidae',
    alternateNames: ["Bumphead sunfish", "Bump-head sunfish", "Ramsay's sunfish", 'Southern ocean sunfish', 'Southern sunfish', 'Short sunfish'],
    biome: 'ocean',
    depthZone: 'epipelagic',
    schooling: false,
    aggressive: false,
    predator: false,
    description: 'The giant sunfish rows its tall dorsal and anal fins together, usually traveling alone or in pairs through open water. It dives deep to hunt jellyfish, salps, crustaceans, mollusks, and other soft-bodied prey, then may bask sideways near the surface to warm up, recover oxygen, and invite parasite-picking birds. Adults have a distinctive head bump, chin bump, rectangular body scales, and rounded clavus that separate them from other sunfish.',
    swim: {
      // World Oceanarium scale: 1 WU = 25 cm. Current review scale keeps adults at 180–240 cm = 7.2–9.6 WU until the final GLB scale is approved.
      // Target review speed: ~0.6–1.1 WU/s after the latest 1.2x idle movement tuning.
      bodyLengthWU: 9.6,
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
      turnRadius: 1.0,
      speedMultiplier: 1.0,
      movementBoundsScale: 1.35,
      boundsBodyLengthWU: 1.08,
      boundsUseSpeciesSize: false,
      boundsXMin: -18,
      boundsXMax: 18,
      boundsYMin: -7,
      boundsZMin: -25,
      boundsZMax: -10,
    },
    // Current review scale maps normalized individual size to 180–240 cm total length; revisit if we want full giant-sunfish adult maximums after the GLB lands.
    sizeRange: [0.75, 1.0],
    mass: {
      // Broad placeholder estimate until curated species/body-condition data lands.
      coefficient: 0.018,
      exponent: 3,
    },
    model: {
      path: '/models/fish/mola-alexandrini/mola-alexandrini.glb',
      // Blender +Z exports as GLB +Y, so this asset's GLB axes are +Y up and +Z forward.
      // The fish root also uses +Y up and +Z swim-forward, so no extra child rotation is needed.
      rotation: [0, 0, 0],
      // Source body length is ~20.69 model units; scale to the existing 9.6 WU max review length.
      scale: 0.464,
      moveset: {
        cruise: 'slow_cruise',
        drift: 'idle_drift',
        turnLeft: 'bank_l',
        turnRight: 'bank_r',
        burst: 'burst',
        sunBaskLeft: 'sun_bask_l',
        sunBaskRight: 'sun_bask_r',
      },
      layeredAnimations: true,
      layeredBaseAnimation: 'slow_cruise',
      layeredOverlayAnimations: ['idle_drift', 'bank_l', 'bank_r', 'burst', 'sun_bask_l', 'sun_bask_r'],
      layeredBaseWeight: 0.62,
      layeredOverlayWeight: 0.72,
      animationFadeDuration: 0.55,
      loopAnimations: ['idle_drift', 'slow_cruise', 'sun_bask_l', 'sun_bask_r'],
    },
    placeholder: {
      type: 'mola-mola',
      bodyColor: '#8fb8bc',
      finColor: '#6f9fa4',
    },
  },
]

export const CREATURES = [
  {
    id: 1,
    species: 'amblygaster-sirm',
    biome: 'ocean',
    depthZone: 'epipelagic',
    bornAt: '2026-05-13T00:00:00Z',
    alive: true,
  },
  {
    id: 2,
    species: 'amblygaster-sirm',
    biome: 'ocean',
    depthZone: 'epipelagic',
    bornAt: '2026-05-17T00:00:00Z',
    alive: true,
  },
  {
    id: 3,
    species: 'amblygaster-sirm',
    biome: 'ocean',
    depthZone: 'epipelagic',
    bornAt: '2026-05-17T00:00:00Z',
    alive: true,
  },
  {
    id: 4,
    species: 'amblygaster-sirm',
    biome: 'ocean',
    depthZone: 'epipelagic',
    bornAt: '2026-05-17T00:00:00Z',
    alive: true,
  },
  {
    id: 5,
    species: 'amblygaster-sirm',
    biome: 'ocean',
    depthZone: 'epipelagic',
    bornAt: '2026-05-17T00:00:00Z',
    alive: true,
  },
  {
    id: 6,
    species: 'amblygaster-sirm',
    biome: 'ocean',
    depthZone: 'epipelagic',
    bornAt: '2026-05-17T00:00:00Z',
    alive: true,
  },
  {
    id: 7,
    species: 'mola-alexandrini',
    biome: 'ocean',
    depthZone: 'epipelagic',
    bornAt: '2026-05-26T00:00:00Z',
    alive: true,
  },
]

