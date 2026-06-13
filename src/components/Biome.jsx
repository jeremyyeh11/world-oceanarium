import { useMemo } from 'react'
import Environment from './Environment'
import Fish from './Fish'
import OceanBubbles from './OceanBubbles'
import SardineInstancedLayer from './SardineInstancedLayer'
import { SPECIES_BY_KEY } from '../utils/speciesLookup'
import { hashString } from '../utils/hash'

const SCHOOL_MAX_SIZE = 64
const ENABLE_SARDINE_INSTANCED_LAYER = true

function schoolMaxSizeForSpecies(species) {
  const configured = species?.swim?.schoolMaxSize
  if (!Number.isFinite(configured)) return SCHOOL_MAX_SIZE
  return Math.max(2, Math.min(SCHOOL_MAX_SIZE, Math.floor(configured)))
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

export default function Biome({ name, creatures, tankVisitSeed = 0, selectedCreatureId, zoomActive, debugSunBaskRequestId = 0, soloRuntimeRecoveryEnabled = true, hideSelectionSilhouette = false, debug = false, debugView = 'all', debugLayers = null, debugLodView = false, debugStatsEnabled = false, debugSimulationSpeed = 1, onCreatureClick, onCreatureReady, onRuntimeRecoveryNeeded }) {
  const visibleCreatures = useMemo(
    () => creatures.filter(c => c.biome === name && c.alive),
    [creatures, name],
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
        schoolGroup.forEach((creature, index) => {
          nextSchoolByCreatureId.set(creature.id, {
            id: schoolId,
            index,
            count: schoolGroup.length,
            modelVariantKey: schoolModelVariantKey(species, schoolId, index, schoolGroup.length),
          })
        })
      }
    })
    return nextSchoolByCreatureId
  }, [visibleCreatures, tankVisitSeed])

  return (
    <group>
      <Environment biome={name} />
      {name === 'ocean' && <OceanBubbles />}
      {ENABLE_SARDINE_INSTANCED_LAYER && name === 'ocean' && <SardineInstancedLayer debugLodView={debugLodView} debugStatsEnabled={debugStatsEnabled} />}
      {visibleCreatures.map(creature => {
        const selected = String(creature.id) === String(selectedCreatureId)
        const school = schoolByCreatureId.get(creature.id) ?? null
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
            modelVariantKey={school?.modelVariantKey ?? null}
            onClick={onCreatureClick}
            onReady={onCreatureReady}
            onRuntimeRecoveryNeeded={onRuntimeRecoveryNeeded}
          />
        )
      })}
    </group>
  )
}
