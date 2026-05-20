import { useEffect, useState } from 'react'
import { SPECIES } from '../data/species'
import { APP_VERSION } from '../version'

const ACTIVE_SPECIES = new Set(SPECIES.map(species => species.name))
const SPECIES_BY_NAME = new Map(SPECIES.map(species => [species.name, species]))
const DEFAULT_SIZE_RANGE = [0.9, 1.1]
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL?.replace(/\/$/, '')
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY
const SUPABASE_CREATURES_URL = import.meta.env.VITE_SUPABASE_CREATURES_URL
const SUPABASE_CREATURES_TABLE = APP_VERSION.includes('-dev_') ? 'creatures_dev' : 'creatures'

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

function speciesSizeRange(creature) {
  const species = SPECIES_BY_NAME.get(creature.species)
  return species?.sizeRange ?? DEFAULT_SIZE_RANGE
}

function deterministicSizeParameter(creature) {
  return persistentUnitRandom(`${creature.species}:${creature.id}:size`)
}

function sizeFromParameter(creature) {
  const [min, max] = speciesSizeRange(creature)
  const rawSize = Number(creature.size)
  const sizeParameter = Number.isFinite(rawSize)
    ? Math.max(0, Math.min(1, rawSize))
    : deterministicSizeParameter(creature)

  return min + sizeParameter * (max - min)
}

function withDefaultSize(creature) {
  return {
    ...creature,
    sizeParameter: Number.isFinite(Number(creature.size)) ? Math.max(0, Math.min(1, Number(creature.size))) : null,
    size: sizeFromParameter(creature),
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
    description: row.description ?? row.individual_description,
    customName: row.customName ?? row.custom_name,
    size: row.size,
  })
}

function creaturesFromRows(rows) {
  return rows
    .map(normalizeCreature)
    .filter(creature => creature.alive !== false && ACTIVE_SPECIES.has(creature.species))
}

function resolveCreaturesUrl() {
  if (SUPABASE_CREATURES_URL) {
    if (SUPABASE_CREATURES_URL.includes('{table}')) {
      return SUPABASE_CREATURES_URL.replaceAll('{table}', SUPABASE_CREATURES_TABLE)
    }

    if (SUPABASE_CREATURES_TABLE === 'creatures_dev') {
      return SUPABASE_CREATURES_URL.replace(/\/creatures(?=\?|$)/, '/creatures_dev')
    }

    return SUPABASE_CREATURES_URL
  }

  if (!SUPABASE_URL) return null
  return `${SUPABASE_URL}/rest/v1/${SUPABASE_CREATURES_TABLE}?select=*&alive=eq.true&order=id.asc`
}

const EMPTY_CREATURE_STATE = {
  creatures: [],
  source: 'supabase-empty',
  error: null,
}

export function useCreatures() {
  const [state, setState] = useState(EMPTY_CREATURE_STATE)

  useEffect(() => {
    const creaturesUrl = resolveCreaturesUrl()

    if (!creaturesUrl || !SUPABASE_ANON_KEY) {
      setState({
        creatures: [],
        source: 'supabase-not-configured',
        error: 'Supabase creature env vars are not configured.',
      })
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
          creatures,
          source: SUPABASE_CREATURES_TABLE === 'creatures_dev' ? 'supabase-dev' : 'supabase',
          error: null,
        })
      } catch (error) {
        if (controller.signal.aborted) return
        setState({
          creatures: [],
          source: 'supabase-error',
          error: error instanceof Error ? error.message : 'Supabase creatures fetch failed.',
        })
      }
    }

    loadCreatures()
    return () => controller.abort()
  }, [])

  return state
}
