import { useMemo } from 'react'
import Environment from './Environment'
import Fish from './Fish'
import OceanBubbles from './OceanBubbles'
import SardineInstancedLayer from './SardineInstancedLayer'
import { SPECIES_BY_KEY } from '../utils/speciesLookup'
import { hashString } from '../utils/hash'

const SCHOOL_MAX_SIZE = 64
const ENABLE_SARDINE_INSTANCED_LAYER = true

function schoolKeyForCreature(creature) {
  return `${creature.biome}:${creature.depthZone}:${creature.species}`
}

function deterministicSchoolOrder(creature) {
  return hashString(`${creature.species}:${creature.biome}:${creature.depthZone}:${creature.id}`)
}

export default function Biome({ name, creatures, tankVisitSeed = 0, selectedCreatureId, zoomActive, debugSunBaskRequestId = 0, debugRepulserDemoRequestId = 0, soloRuntimeRecoveryEnabled = true, hideSelectionSilhouette = false, debug = false, debugView = 'all', debugLayers = null, debugLodView = false, debugStatsEnabled = false, debugSimulationSpeed = 1, onCreatureClick, onCreatureReady, onRuntimeRecoveryNeeded }) {
  const visibleCreatures = useMemo(
    () => creatures.filter(c => c.biome === name && c.alive),
    [creatures, name],
  )
  const schoolByCreatureId = useMemo(() => {
    const schoolingGroups = visibleCreatures.reduce((groups, creature) => {
      const species = SPECIES_BY_KEY.get(creature.species)
      if (!species?.schooling) return groups

      const key = schoolKeyForCreature(creature)
      const group = groups.get(key) ?? []
      group.push(creature)
      groups.set(key, group)
      return groups
    }, new Map())

    const nextSchoolByCreatureId = new Map()
    schoolingGroups.forEach((group, key) => {
      if (group.length < 2) return
      const orderedGroup = [...group].sort((a, b) => deterministicSchoolOrder(a) - deterministicSchoolOrder(b))
      for (let offset = 0; offset < orderedGroup.length; offset += SCHOOL_MAX_SIZE) {
        const schoolGroup = orderedGroup.slice(offset, offset + SCHOOL_MAX_SIZE)
        if (schoolGroup.length < 2) continue
        const schoolId = `${key}:visit-${tankVisitSeed}:school-${Math.floor(offset / SCHOOL_MAX_SIZE)}`
        schoolGroup.forEach((creature, index) => {
          nextSchoolByCreatureId.set(creature.id, {
            id: schoolId,
            index,
            count: schoolGroup.length,
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
        const showDebug = debug && (debugView === 'all' || (debugView === 'focused' && selected))
        return (
          <Fish
            key={creature.id}
            creature={creature}
            selected={selected}
            zoomActive={zoomActive}
            debugSunBaskRequestId={selected ? debugSunBaskRequestId : 0}
            debugRepulserDemoRequestId={debugRepulserDemoRequestId}
            soloRuntimeRecoveryEnabled={soloRuntimeRecoveryEnabled}
            hideSelectionSilhouette={hideSelectionSilhouette}
            debug={showDebug}
            debugLayers={debugLayers}
            debugLodView={debugLodView}
            debugSimulationSpeed={debugSimulationSpeed}
            school={schoolByCreatureId.get(creature.id) ?? null}
            onClick={onCreatureClick}
            onReady={onCreatureReady}
            onRuntimeRecoveryNeeded={onRuntimeRecoveryNeeded}
          />
        )
      })}
    </group>
  )
}
