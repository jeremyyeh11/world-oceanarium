import { DEPTH_ZONES, SPECIES, TANKS, WORLD_UNIT_METERS } from '../data/species'

export const DEFAULT_BODY_LENGTH_WU = 1

export function speciesLookupKeys(species) {
  return [
    species.id,
    species.name,
    species.scientificName,
    ...(species.legacyIds ?? []),
    ...(species.legacyNames ?? []),
  ].filter(Boolean)
}

export function speciesAliasKeys(species) {
  return [
    species.id,
    species.name,
    ...(species.legacyIds ?? []),
    ...(species.legacyNames ?? []),
  ].filter(Boolean)
}

export const SPECIES_BY_KEY = new Map(
  SPECIES.flatMap(species => speciesLookupKeys(species).map(key => [key, species])),
)

export const TANK_BY_ID = new Map(TANKS.map(tank => [tank.id, tank]))

// Resolve which live creatures belong in a tank, from its explicit species list.
// Creatures reference species by name/alias, so we normalize through SPECIES_BY_KEY
// and match on the canonical species id.
export function creaturesForTank(creatures, tank) {
  if (!tank) return []
  const ids = new Set(tank.species)
  return creatures.filter(creature => {
    if (!creature.alive) return false
    const species = SPECIES_BY_KEY.get(creature.species)
    return species ? ids.has(species.id) : false
  })
}

// Coherence guard: drifters and fast swimmers read as two different worlds, so a
// tank must not mix them. Runs once at load in dev; silent in production builds.
if (import.meta.env?.DEV) {
  for (const tank of TANKS) {
    const tempos = new Set(
      tank.species
        .map(id => SPECIES.find(species => species.id === id)?.tempo)
        .filter(Boolean),
    )
    if (tempos.has('drift') && (tempos.has('cruise') || tempos.has('sprint'))) {
      console.warn(
        `[oceanarium] Tank "${tank.id}" mixes drifters with fast swimmers — tempo clash.`,
      )
    }
  }
}

export const ACTIVE_SPECIES_NAMES = new Set(SPECIES.map(species => species.name))
export const SPECIES_BY_NAME = new Map(SPECIES.map(species => [species.name, species]))
export const DEPTH_ZONE_BY_ID = new Map(DEPTH_ZONES.map(zone => [zone.id, zone]))
export const SPECIES_NAME_BY_ALIAS = new Map(
  SPECIES.flatMap(species => speciesAliasKeys(species).map(key => [key, species.name])),
)

export function resolveSpecies(creature) {
  return SPECIES_BY_KEY.get(creature?.species)
}

export function isMolaCreature(creature) {
  const species = resolveSpecies(creature)
  return species?.id === 'mola-alexandrini' || creature?.species === 'mola-alexandrini' || creature?.species === 'mola-mola'
}

export function creatureBodyLengthWU(creature, bodyLengthWU = DEFAULT_BODY_LENGTH_WU) {
  return (bodyLengthWU ?? DEFAULT_BODY_LENGTH_WU) * (creature?.size ?? 1)
}

export function creatureBodyLengthMeters(creature, bodyLengthWU = DEFAULT_BODY_LENGTH_WU) {
  return creatureBodyLengthWU(creature, bodyLengthWU) * WORLD_UNIT_METERS
}
