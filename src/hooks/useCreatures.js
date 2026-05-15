import { useMemo } from 'react'
import { CREATURES, SPECIES } from '../data/species'

const ACTIVE_SPECIES = new Set(SPECIES.map(species => species.name))
const SPECIES_BY_NAME = new Map(SPECIES.map(species => [species.name, species]))
const DEFAULT_SIZE_RANGE = [0.9, 1.1]

function hashString(value) {
  let hash = 2166136261
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

function persistentUnitRandom(seed) {
  let t = hashString(seed) + 0x6D2B79F5
  t = Math.imul(t ^ (t >>> 15), t | 1)
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}

function speciesSizeForCreature(creature) {
  const species = SPECIES_BY_NAME.get(creature.species)
  const [min, max] = species?.sizeRange ?? DEFAULT_SIZE_RANGE
  const random = persistentUnitRandom(`${creature.species}:${creature.id}:size`)
  return min + random * (max - min)
}

function withDefaultSize(creature) {
  return {
    ...creature,
    size: creature.size ?? speciesSizeForCreature(creature),
    traits: creature.traits ?? {},
  }
}

const LOCAL_CREATURES = CREATURES
  .filter(creature => creature.alive !== false && ACTIVE_SPECIES.has(creature.species))
  .map(withDefaultSize)

export function useCreatures() {
  return useMemo(() => ({
    creatures: LOCAL_CREATURES,
    source: 'local',
    error: null,
  }), [])
}
