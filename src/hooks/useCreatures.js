import { useEffect, useMemo, useState } from 'react'
import { CREATURES, SPECIES } from '../data/species'
import { supabase } from '../lib/supabase'

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

function withDefaultTraits(creature) {
  const traits = creature.traits ?? {}
  return {
    ...creature,
    traits: {
      ...traits,
      size: traits.size ?? speciesSizeForCreature(creature),
    },
  }
}

const LOCAL_CREATURES = CREATURES
  .filter(creature => ACTIVE_SPECIES.has(creature.species))
  .map(withDefaultTraits)

function fromSupabaseCreature(row) {
  return withDefaultTraits({
    id: row.id,
    species: row.species,
    biome: row.biome,
    depthZone: row.depth_zone,
    bornAt: row.born_at,
    alive: row.alive,
    parentIds: row.parent_ids,
    generation: row.generation,
    traits: row.traits ?? {},
    color: row.color,
  })
}

function activeCreaturesOnly(creatures) {
  return creatures.filter(creature => creature.alive !== false && ACTIVE_SPECIES.has(creature.species))
}

export function useCreatures() {
  const [creatures, setCreatures] = useState(() => supabase ? [] : LOCAL_CREATURES)
  const [source, setSource] = useState(supabase ? 'supabase-loading' : 'local')
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false

    async function loadCreatures() {
      if (!supabase) return

      const { data, error: queryError } = await supabase
        .from('creatures')
        .select('id, species, biome, depth_zone, born_at, alive, parent_ids, generation, traits, color')
        .eq('alive', true)
        .order('born_at', { ascending: true })

      if (cancelled) return

      if (queryError) {
        console.warn('Could not load creatures from Supabase. Using local seed creatures.', queryError)
        setError(queryError)
        setCreatures(LOCAL_CREATURES)
        setSource('local')
        return
      }

      setCreatures(activeCreaturesOnly((data ?? []).map(fromSupabaseCreature)))
      setSource('supabase')
    }

    loadCreatures()

    return () => {
      cancelled = true
    }
  }, [])

  return useMemo(() => ({ creatures, source, error }), [creatures, source, error])
}
