import { creaturesForTank } from './speciesLookup.js'

export const DEBUG_SECTIONS = ['creature', 'performance']
export const DEBUG_LAYERS = [
  { id: 'heading', label: 'Heading / speed' },
  { id: 'neighbors', label: 'Neighbours' },
  { id: 'name', label: 'Labels' },
]

export function clearedDebugLayers() {
  return Object.fromEntries(DEBUG_LAYERS.map(layer => [layer.id, false]))
}

export function debugOverlayVisibility(layers) {
  return {
    heading: Boolean(layers?.heading),
    neighbors: Boolean(layers?.neighbors),
    name: Boolean(layers?.name),
  }
}

// Match Biome's population filter. This is not a claim that every animal is on screen.
export function reservePopulation(creatures, tank, biomeId) {
  return tank ? creaturesForTank(creatures, tank).length
    : creatures.filter(creature => creature.alive && creature.biome === biomeId).length
}
