import { DEPTH_ZONES, SPECIES, WORLD_UNIT_METERS } from '../data/species'

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
