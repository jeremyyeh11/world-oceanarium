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
    id: 'sardine',
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
    id: 'mola-mola',
    name: 'Ocean Sunfish',
    scientificName: 'Mola mola',
    family: 'Molidae',
    alternateNames: ['Common mola', 'Mola'],
    biome: 'ocean',
    depthZone: 'epipelagic',
    schooling: false,
    aggressive: false,
    predator: false,
    description: 'A huge, laterally flattened open-ocean sunfish that drifts through the upper water column and often basks near the surface. This placeholder uses real-scale length until Jeremy supplies the final GLB.',
    swim: {
      // World Oceanarium scale: 1 WU = 25 cm. 240 cm max total length = 9.6 WU.
      // Target review speed: 0.5–0.8 WU/s = roughly 0.05–0.08 body lengths/s at max length.
      bodyLengthWU: 9.6,
      visualTimeScale: 1.0,
      idleBLPerSec: [0.055, 0.085],
      idleDriftBLPerSec: [0.006, 0.014],
      snapBLPerSec: [0.10, 0.14],
      burstBLPerSec: [0.13, 0.18],
      burstInterval: [14.0, 22.0],
      erraticness: 0.055,
      turnRadius: 1.0,
      speedMultiplier: 1.0,
      movementBoundsScale: 1.35,
      boundsBodyLengthWU: 1.08,
      boundsUseSpeciesSize: false,
      boundsXMin: -18,
      boundsXMax: 18,
      boundsYMin: -7,
      boundsZMin: -35,
      boundsZMax: -10,
    },
    // Normalized individual size maps to 180–240 cm total length.
    sizeRange: [0.75, 1.0],
    mass: {
      // Broad placeholder estimate until curated species/body-condition data lands.
      coefficient: 0.018,
      exponent: 3,
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
    species: 'Spotted Sardinella',
    biome: 'ocean',
    depthZone: 'epipelagic',
    bornAt: '2026-05-13T00:00:00Z',
    alive: true,
  },
  {
    id: 2,
    species: 'Spotted Sardinella',
    biome: 'ocean',
    depthZone: 'epipelagic',
    bornAt: '2026-05-17T00:00:00Z',
    alive: true,
  },
  {
    id: 3,
    species: 'Spotted Sardinella',
    biome: 'ocean',
    depthZone: 'epipelagic',
    bornAt: '2026-05-17T00:00:00Z',
    alive: true,
  },
  {
    id: 4,
    species: 'Spotted Sardinella',
    biome: 'ocean',
    depthZone: 'epipelagic',
    bornAt: '2026-05-17T00:00:00Z',
    alive: true,
  },
  {
    id: 5,
    species: 'Spotted Sardinella',
    biome: 'ocean',
    depthZone: 'epipelagic',
    bornAt: '2026-05-17T00:00:00Z',
    alive: true,
  },
  {
    id: 6,
    species: 'Spotted Sardinella',
    biome: 'ocean',
    depthZone: 'epipelagic',
    bornAt: '2026-05-17T00:00:00Z',
    alive: true,
  },
]

