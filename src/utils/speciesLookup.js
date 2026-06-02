import { SPECIES, WORLD_UNIT_METERS } from '../data/species'

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

export function resolveSpecies(creature) {
  return SPECIES_BY_KEY.get(creature?.species)
}

export function creatureBodyLengthWU(creature, bodyLengthWU = DEFAULT_BODY_LENGTH_WU) {
  return bodyLengthWU * (creature?.size ?? 1)
}

export function creatureBodyLengthMeters(creature, bodyLengthWU = DEFAULT_BODY_LENGTH_WU) {
  return creatureBodyLengthWU(creature, bodyLengthWU) * WORLD_UNIT_METERS
}
