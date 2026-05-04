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
  { id: 'mackerel', name: 'Mackerel', biome: 'ocean', depthZone: 'epipelagic', schooling: true, aggressive: false, predator: false },
  { id: 'betta', name: 'Betta Fish', biome: 'tropical-river', depthZone: 'shallow', schooling: false, aggressive: true, predator: false },
  { id: 'tetra', name: 'Neon Tetra', biome: 'tropical-river', depthZone: 'mid', schooling: true, aggressive: false, predator: false },
]

export const CREATURES = [
  {
    id: 'alpha_1',
    species: 'Mackerel',
    biome: 'ocean',
    depthZone: 'epipelagic',
    bornAt: '2026-05-01T00:00:00Z',
    alive: true,
    parentIds: null,
    generation: 0,
    traits: { size: 1.0 },
    color: '#7ab8c0',
  },
  {
    id: 'alpha_2',
    species: 'Betta Fish',
    biome: 'tropical-river',
    depthZone: 'shallow',
    bornAt: '2026-05-04T00:00:00Z',
    alive: true,
    parentIds: null,
    generation: 0,
    traits: { size: 0.8 },
    color: '#d43f5a',
  },
  {
    id: 'alpha_3',
    species: 'Neon Tetra',
    biome: 'tropical-river',
    depthZone: 'mid',
    bornAt: '2026-05-04T00:00:00Z',
    alive: true,
    parentIds: null,
    generation: 0,
    traits: { size: 0.5 },
    color: '#00d4ff',
  },
]
