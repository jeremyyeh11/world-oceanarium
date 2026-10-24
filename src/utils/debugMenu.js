import { creaturesForTank } from './speciesLookup.js'

export const DEBUG_SECTIONS = ['creature', 'render', 'scene', 'audio', 'data']
export const DEBUG_LAYERS = [
  { id: 'heading', label: 'Heading / speed' },
  { id: 'steering', label: 'Steering' },
  { id: 'neighbors', label: 'Neighbours' },
  { id: 'name', label: 'Labels' },
  { id: 'behavior', label: 'Behaviour' },
]

export function clearedDebugLayers() {
  return Object.fromEntries(DEBUG_LAYERS.map(layer => [layer.id, false]))
}

export function debugOverlayVisibility(layers, selected, agent) {
  return {
    heading: Boolean(layers?.heading),
    steering: Boolean(layers?.steering) && (selected || agent),
    neighbors: Boolean(layers?.neighbors) && (selected || agent),
    name: Boolean(layers?.name),
    behavior: Boolean(layers?.behavior) && agent,
  }
}

// Match Biome's population filter. This is not a claim that every animal is on screen.
export function reservePopulation(creatures, tank, biomeId) {
  return tank ? creaturesForTank(creatures, tank).length
    : creatures.filter(creature => creature.alive && creature.biome === biomeId).length
}

export function debugCount(value) {
  return Number.isFinite(value) ? Math.max(0, Math.round(value)) : 0
}

// Only measured sardine registries; never subtract sardines from a mixed reserve
// population to invent LOD0 or a full-scene cull count.
export function sardineReadout(stats) {
  return {
    lod0: debugCount(stats?.lod0Drawn),
    lod1: debugCount(stats?.lod1Drawn),
    lod2: debugCount(stats?.instancedDrawn),
    culled: debugCount(stats?.frustumCulled),
    candidates: debugCount(stats?.frustumCandidates),
  }
}
