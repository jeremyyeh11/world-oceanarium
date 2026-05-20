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
      lods: [
        { path: '/models/fish/sardine/sardine.glb', scale: 0.42, maxDistance: 4.0 },
        { path: '/models/fish/sardine/sardine-lod1.glb', scale: 0.42, maxDistance: 6.8 },
        { path: '/models/fish/sardine/sardine-lod2.glb', scale: 0.42 },
      ],
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

