import { useEffect, useState } from 'react'
import { CREATURES } from '../data/species'
import { APP_VERSION } from '../version'
import { hashString } from '../utils/hash'
import { ACTIVE_SPECIES_NAMES, SPECIES_BY_NAME, SPECIES_NAME_BY_ALIAS } from '../utils/speciesLookup'
const DEFAULT_SIZE_RANGE = [0.9, 1.1]
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL?.replace(/\/$/, '')
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY
const SUPABASE_CREATURES_URL = import.meta.env.VITE_SUPABASE_CREATURES_URL
const SUPABASE_CREATURES_TABLE = APP_VERSION.includes('-dev_') ? 'creatures_dev' : 'creatures'
const ALLOW_STATIC_DEV_CREATURES = APP_VERSION.includes('-dev_')
const ALLOW_STATIC_MISSING_ENV_FALLBACK = true

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

function normalizeSpecies(value) {
  return SPECIES_NAME_BY_ALIAS.get(value) ?? value
}

function fallbackSexForDimorphicCreature(row) {
  const species = normalizeSpecies(row.species)
  if (species !== 'coryphaena-hippurus') return null
  const id = Number(row.id)
  if ([90, 92].includes(id)) return 'male'
  if ([91, 93].includes(id)) return 'female'
  return null
}

function normalizeCreature(row) {
  return withDefaultSize({
    id: String(row.id),
    species: normalizeSpecies(row.species),
    biome: row.biome,
    depthZone: row.depthZone ?? row.depth_zone,
    bornAt: row.bornAt ?? row.born_at,
    diedAt: row.diedAt ?? row.died_at,
    alive: row.alive ?? true,
    description: row.description ?? row.individual_description,
    customName: row.customName ?? row.custom_name,
    sex: row.sex ?? fallbackSexForDimorphicCreature(row),
    size: row.size,
  })
}

function creaturesFromRows(rows) {
  return rows
    .map(normalizeCreature)
    .filter(creature => creature.alive !== false && ACTIVE_SPECIES_NAMES.has(creature.species))
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

function staticDevCreatures() {
  return creaturesFromRows(CREATURES)
}

export function useCreatures() {
  const [state, setState] = useState(EMPTY_CREATURE_STATE)

  useEffect(() => {
    const creaturesUrl = resolveCreaturesUrl()

    if (!creaturesUrl || !SUPABASE_ANON_KEY) {
      setState({
        creatures: (ALLOW_STATIC_DEV_CREATURES || ALLOW_STATIC_MISSING_ENV_FALLBACK) ? staticDevCreatures() : [],
        source: ALLOW_STATIC_DEV_CREATURES ? 'static-dev' : 'static-missing-env',
        error: 'Supabase creature env vars are not configured.',
      })
      return undefined
    }

    const controller = new AbortController()

    async function fetchCreatureRows(url) {
      const response = await fetch(url, {
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
      return Array.isArray(rows) ? rows : []
    }

    async function loadCreatures() {
      try {
        const rows = await fetchCreatureRows(creaturesUrl)
        const creatures = creaturesFromRows(rows)

        if (ALLOW_STATIC_DEV_CREATURES && creatures.length === 0) {
          setState({
            creatures: staticDevCreatures(),
            source: 'static-dev-empty-supabase',
            error: null,
          })
          return
        }

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
