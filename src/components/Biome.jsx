import { useLayoutEffect, useMemo } from 'react'
import { environmentLoader } from '../loading/environmentRuntime'
import Environment from './Environment'
import { landscapeForTank } from '../data/landscapes'
import Fish from './Fish'
import OceanBubbles from './OceanBubbles'
import SardineInstancedLayer from './SardineInstancedLayer'
import { SPECIES_BY_KEY, creaturesForTank, resolveSpecies } from '../utils/speciesLookup'
import { hashString } from '../utils/hash'

const SCHOOL_MAX_SIZE = 180
const ENABLE_SARDINE_INSTANCED_LAYER = true

function schoolMaxSizeForSpecies(species) {
  const configured = species?.swim?.schoolMaxSize
  // `Infinity`: the species' whole population in a reserve is one school (Munk's devil ray).
  if (configured === Infinity) return Infinity
  if (!Number.isFinite(configured)) return SCHOOL_MAX_SIZE
  return Math.max(2, Math.floor(configured))
}

function schoolKeyForCreature(creature) {
  return `${creature.biome}:${creature.depthZone}:${creature.species}`
}

function deterministicSchoolOrder(creature) {
  return hashString(`${creature.species}:${creature.biome}:${creature.depthZone}:${creature.id}`)
}

function sexModelVariantKeysForSpecies(species) {
  const variants = species?.model?.sexVariants
  if (!variants || typeof variants !== 'object') return []
  return ['male', 'female'].filter(key => variants[key]?.path)
}

function schoolModelVariantKey(species, schoolId, index, count) {
  const variantKeys = sexModelVariantKeysForSpecies(species)
  if (variantKeys.length < 2) return null

  const half = Math.ceil(count / 2)
  const baseKey = index < half ? variantKeys[0] : variantKeys[1]
  const shouldFlip = (hashString(`${schoolId}:sex-order`) & 1) === 1
  if (!shouldFlip) return baseKey
  return baseKey === variantKeys[0] ? variantKeys[1] : variantKeys[0]
}

function creatureSexModelVariantKey(creature, species, fallbackKey) {
  const sex = normalizedSex(creature)
  if (sex && species?.model?.sexVariants?.[sex]?.path) return sex
  return fallbackKey
}

function normalizedSex(creature) {
  return typeof creature.sex === 'string' ? creature.sex.trim().toLowerCase() : ''
}

// Pair-bonded species (`pairBonded`, the bannerfish) swim as male–female pairs: each female
// leads and her male keeps station at her side (advancePairFollow). Fish with no sex recorded
// fill in for whichever sex is short; a fish left without a partner roams alone.
function pairFollowersForCreatures(creatures) {
  const groups = new Map()
  creatures.forEach(creature => {
    // By life stage: juvenile emperor angelfish live alone, so only adults pair.
    if (!resolveSpecies(creature)?.pairBonded) return
    const key = schoolKeyForCreature(creature)
    const group = groups.get(key) ?? { female: [], male: [], unknown: [] }
    const sex = normalizedSex(creature)
    group[sex === 'female' || sex === 'male' ? sex : 'unknown'].push(creature)
    groups.set(key, group)
  })
  const followers = new Map()
  groups.forEach(group => {
    const byOrder = (a, b) => deterministicSchoolOrder(a) - deterministicSchoolOrder(b)
    const females = group.female.sort(byOrder)
    const males = group.male.sort(byOrder)
    group.unknown.sort(byOrder).forEach(creature => (females.length <= males.length ? females : males).push(creature))
    const count = Math.min(females.length, males.length)
    for (let i = 0; i < count; i += 1) {
      followers.set(males[i].id, { leaderId: females[i].id, side: (deterministicSchoolOrder(males[i]) & 1) === 0 ? 1 : -1 })
    }
  })
  return followers
}

// Group-living species (`group`, the raccoon butterflyfish) keep loose company on the reef: in
// each group of up to `group.maxSize`, the first fish leads and every other one follows her on
// the pair path, at its own `slot` round her (advancePairFollow). A fish left on its own roams
// alone.
function groupFollowersForCreatures(creatures) {
  const groups = new Map()
  creatures.forEach(creature => {
    const species = resolveSpecies(creature)
    if (!species?.group) return
    const key = schoolKeyForCreature(creature)
    const entry = groups.get(key) ?? { maxSize: Math.max(2, species.group.maxSize ?? 20), creatures: [] }
    entry.creatures.push(creature)
    groups.set(key, entry)
  })
  const followers = new Map()
  groups.forEach(({ maxSize, creatures: group }) => {
    const ordered = [...group].sort((a, b) => deterministicSchoolOrder(a) - deterministicSchoolOrder(b))
    for (let offset = 0; offset < ordered.length; offset += maxSize) {
      const members = ordered.slice(offset, offset + maxSize)
      for (let i = 1; i < members.length; i += 1) {
        followers.set(members[i].id, { leaderId: members[0].id, side: 1, slot: i - 1, count: members.length - 1 })
      }
    }
  })
  return followers
}

export default function Biome({ name, tank = null, creatures, tankVisitSeed = 0, selectedCreatureId, zoomActive, debugSunBaskRequestId = 0, soloRuntimeRecoveryEnabled = true, hideSelectionSilhouette = false, debug = false, debugView = 'all', debugLayers = null, debugLodView = false, debugStatsEnabled = false, debugSimulationSpeed = 1, onCreatureClick, onCreatureReady, onRuntimeRecoveryNeeded }) {
  // Retire failed target geometry only after this scene has actually unmounted.
  useLayoutEffect(() => tank?.id ? environmentLoader.retainScene(tank.id) : undefined, [tank?.id])
  const visibleCreatures = useMemo(
    () => (tank ? creaturesForTank(creatures, tank) : creatures.filter(c => c.biome === name && c.alive)),
    [creatures, name, tank],
  )
  const schoolByCreatureId = useMemo(() => {
    const schoolingGroups = visibleCreatures.reduce((groups, creature) => {
      const species = SPECIES_BY_KEY.get(creature.species)
      if (!species?.schooling) return groups

      const key = schoolKeyForCreature(creature)
      const entry = groups.get(key) ?? { species, creatures: [] }
      entry.creatures.push(creature)
      groups.set(key, entry)
      return groups
    }, new Map())

    const nextSchoolByCreatureId = new Map()
    schoolingGroups.forEach(({ species, creatures: group }, key) => {
      if (group.length < 2) return
      const orderedGroup = [...group].sort((a, b) => deterministicSchoolOrder(a) - deterministicSchoolOrder(b))
      const maxSchoolSize = schoolMaxSizeForSpecies(species)
      for (let offset = 0; offset < orderedGroup.length; offset += maxSchoolSize) {
        const schoolGroup = orderedGroup.slice(offset, offset + maxSchoolSize)
        if (schoolGroup.length < 2) continue
        const schoolId = `${key}:visit-${tankVisitSeed}:school-${Math.floor(offset / maxSchoolSize)}`
        // Each member's size (its body-length multiplier), by school index, shared by every
        // member: a formation cloud sizes each slot's gaps to the animal that fills it.
        const memberSizes = schoolGroup.map(creature => creature.size ?? 1)
        schoolGroup.forEach((creature, index) => {
          nextSchoolByCreatureId.set(creature.id, {
            id: schoolId,
            index,
            count: schoolGroup.length,
            memberSizes,
            modelVariantKey: schoolModelVariantKey(species, schoolId, index, schoolGroup.length),
          })
        })
      }
    })
    return nextSchoolByCreatureId
  }, [visibleCreatures, tankVisitSeed])

  const pairByCreatureId = useMemo(
    () => new Map([...pairFollowersForCreatures(visibleCreatures), ...groupFollowersForCreatures(visibleCreatures)]),
    [visibleCreatures],
  )

  // A landscape's caustics as they fall on its animals (`caustics.fish` overrides), or none.
  const fishCaustics = useMemo(() => {
    const caustics = landscapeForTank(tank)?.caustics
    return caustics?.fish ? { ...caustics, ...caustics.fish } : null
  }, [tank])

  return (
    <group>
      <Environment biome={name} landscape={landscapeForTank(tank)} environmentId={tank?.id} />
      {name === 'ocean' && <OceanBubbles />}
      {ENABLE_SARDINE_INSTANCED_LAYER && name === 'ocean' && <SardineInstancedLayer debugLodView={debugLodView} debugStatsEnabled={debugStatsEnabled} />}
      {visibleCreatures.map(creature => {
        const selected = String(creature.id) === String(selectedCreatureId)
        const school = schoolByCreatureId.get(creature.id) ?? null
        // Debug visuals only draw for what you actually select (or agent-focus). Previously
        // every 16th school member force-drew its vectors in focused view even with nothing
        // selected, which read as stray "neighbour lines" hanging off random fish.
        const showDebug = debug && (debugView === 'all' || (debugView === 'focused' && selected))
        return (
          <Fish
            key={creature.id}
            creature={creature}
            selected={selected}
            zoomActive={zoomActive}
            debugSunBaskRequestId={selected ? debugSunBaskRequestId : 0}
            soloRuntimeRecoveryEnabled={soloRuntimeRecoveryEnabled}
            hideSelectionSilhouette={hideSelectionSilhouette}
            debug={showDebug}
            debugLayers={debugLayers}
            debugLodView={debugLodView}
            debugSimulationSpeed={debugSimulationSpeed}
            school={school}
            caustics={fishCaustics}
            pair={pairByCreatureId.get(creature.id) ?? null}
            modelVariantKey={creatureSexModelVariantKey(creature, SPECIES_BY_KEY.get(creature.species), school?.modelVariantKey ?? null)}
            onClick={onCreatureClick}
            onReady={onCreatureReady}
            onRuntimeRecoveryNeeded={onRuntimeRecoveryNeeded}
          />
        )
      })}
    </group>
  )
}
