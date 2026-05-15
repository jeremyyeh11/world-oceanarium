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
    name: 'Open Ocean',
    tagline: 'The deep blue, surface to hadal',
    color: '#0e4a7a',
    accent: '#4db8ff',
    icon: '🌊',
    description: 'From sunlit surface to the deepest trenches.',
  },
]

export const SPECIES = [
  {
    id: 'sardine',
    name: 'Sardine',
    biome: 'ocean',
    depthZone: 'epipelagic',
    schooling: true,
    aggressive: false,
    predator: false,
    swim: {
      // World Oceanarium scale: 1 WU = 25 cm. Common adult sardine ≈20 cm = 0.8 WU.
      bodyLengthWU: 0.8,
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
    sizeRange: [0.7, 0.9],
    model: {
      path: '/models/fish/sardine/sardine.glb',
      scale: 0.42,
    },
  },
  {
    id: 'betta',
    name: 'Betta Fish',
    biome: 'tropical-river',
    depthZone: 'shallow',
    schooling: false,
    aggressive: true,
    predator: false,
    swim: { speed: 0.78, erraticness: 0.62, turnRadius: 0.45 },
    sizeRange: [0.72, 1.08],
  },
  {
    id: 'tetra',
    name: 'Neon Tetra',
    biome: 'tropical-river',
    depthZone: 'mid',
    schooling: true,
    aggressive: false,
    predator: false,
    swim: { speed: 1.18, erraticness: 0.52, turnRadius: 0.55 },
    sizeRange: [0.82, 1.12],
  },
]

export const CREATURES = [
  {
    id: 'sardine_1',
    species: 'Sardine',
    biome: 'ocean',
    depthZone: 'epipelagic',
    bornAt: '2026-05-13T00:00:00Z',
    alive: true,
    parentIds: null,
    generation: 0,
    traits: { swimErraticness: 0.22, turnRadius: 0.82 },
    color: '#b7c8cc',
  },
]
