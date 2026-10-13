import { DEPTH_ZONES, SPECIES, TANKS, WORLD_UNIT_METERS } from '../data/species.js'

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
// Hitchhikers (remoras, and followers like the pilot fish) are exempt: they spend most of
// their time clamped to or following a host and move at its pace, so they do not set a
// tank's tempo.
if (import.meta.env?.DEV) {
  for (const tank of TANKS) {
    const tempos = new Set(
      tank.species
        .map(id => SPECIES.find(species => species.id === id))
        .filter(species => species && !species.hitchhiker)
        .map(species => species.tempo)
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

// A species can describe its young in `lifeStages.<stage>` (the emperor angelfish's juvenile:
// its own model, size range, and manner). A creature's `lifeStage` picks one; the stage's fields
// replace the species' own, except `swim`, which merges. Cached so every fish of a stage shares
// one object, as fish of a species do.
const SPECIES_BY_LIFE_STAGE = new Map()

export function speciesForLifeStage(species, lifeStage) {
  const stage = lifeStage ? species?.lifeStages?.[lifeStage] : null
  if (!stage) return species
  const key = `${species.id}:${lifeStage}`
  let staged = SPECIES_BY_LIFE_STAGE.get(key)
  if (!staged) {
    staged = { ...species, ...stage, swim: { ...species.swim, ...stage.swim }, lifeStage }
    SPECIES_BY_LIFE_STAGE.set(key, staged)
  }
  return staged
}

export function resolveSpecies(creature) {
  return speciesForLifeStage(SPECIES_BY_KEY.get(creature?.species), creature?.lifeStage)
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
