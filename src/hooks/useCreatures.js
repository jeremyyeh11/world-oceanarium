import { useEffect, useMemo, useState } from 'react'
import { CREATURES, SPECIES } from '../data/species'

const ACTIVE_SPECIES = new Set(SPECIES.map(species => species.name))
const SPECIES_BY_NAME = new Map(SPECIES.map(species => [species.name, species]))
const DEFAULT_SIZE_RANGE = [0.9, 1.1]
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL?.replace(/\/$/, '')
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY
const SUPABASE_CREATURES_URL = import.meta.env.VITE_SUPABASE_CREATURES_URL

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

function normalizeCreature(row) {
  return withDefaultSize({
    id: String(row.id),
    species: row.species,
    biome: row.biome,
    depthZone: row.depthZone ?? row.depth_zone,
    bornAt: row.bornAt ?? row.born_at,
    diedAt: row.diedAt ?? row.died_at,
    alive: row.alive ?? true,
    parentIds: row.parentIds ?? row.parent_ids ?? null,
    generation: row.generation ?? 0,
    traits: row.traits ?? {},
    color: row.color,
    size: row.size,
  })
}

function creaturesFromRows(rows) {
  return rows
    .map(normalizeCreature)
    .filter(creature => creature.alive !== false && ACTIVE_SPECIES.has(creature.species))
}

function resolveCreaturesUrl() {
  if (SUPABASE_CREATURES_URL) return SUPABASE_CREATURES_URL
  if (!SUPABASE_URL) return null
  return `${SUPABASE_URL}/rest/v1/creatures?select=*&alive=eq.true`
}

const LOCAL_CREATURES = CREATURES
  .filter(creature => creature.alive !== false && ACTIVE_SPECIES.has(creature.species))
  .map(withDefaultSize)

export function useCreatures() {
  const fallback = useMemo(() => ({
    creatures: LOCAL_CREATURES,
    source: 'local',
    error: null,
  }), [])

  const [state, setState] = useState(fallback)

  useEffect(() => {
    const creaturesUrl = resolveCreaturesUrl()

    if (!creaturesUrl || !SUPABASE_ANON_KEY) {
      setState(fallback)
      return undefined
    }

    const controller = new AbortController()

    async function loadCreatures() {
      try {
        const response = await fetch(creaturesUrl, {
          signal: controller.signal,
          headers: {
            apikey: SUPABASE_ANON_KEY,
            Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          },
        })

        if (!response.ok) {
          throw new Error(`Supabase creatures fetch failed (${response.status})`)
        }

        const rows = await response.json()
        const creatures = creaturesFromRows(Array.isArray(rows) ? rows : [])

        setState({
          creatures: creatures.length > 0 ? creatures : LOCAL_CREATURES,
          source: creatures.length > 0 ? 'supabase' : 'local-fallback-empty-supabase',
          error: creatures.length > 0 ? null : 'Supabase returned zero active known creatures; showing local fallback.',
        })
      } catch (error) {
        if (controller.signal.aborted) return
        setState({
          creatures: LOCAL_CREATURES,
          source: 'local-fallback-supabase-error',
          error: error instanceof Error ? error.message : 'Supabase creatures fetch failed.',
        })
      }
    }

    loadCreatures()
    return () => controller.abort()
  }, [fallback])

  return state
}
