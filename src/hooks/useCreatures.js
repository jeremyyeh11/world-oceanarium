import { useEffect, useState } from 'react'
import { CREATURES } from '../data/species'
import { supabase } from '../lib/supabase'

function fromSupabaseCreature(row) {
  return {
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
  }
}

export function useCreatures() {
  const [creatures, setCreatures] = useState(CREATURES)
  const [source, setSource] = useState('local')
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
        setSource('local')
        return
      }

      if (data?.length) {
        setCreatures(data.map(fromSupabaseCreature))
        setSource('supabase')
      }
    }

    loadCreatures()

    return () => {
      cancelled = true
    }
  }, [])

  return { creatures, source, error }
}
