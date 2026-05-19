import { useMemo } from 'react'
import Environment from './Environment'
import Fish from './Fish'
import OceanBubbles from './OceanBubbles'
import { SPECIES } from '../data/species'

const SPECIES_BY_NAME = new Map(SPECIES.map(species => [species.name, species]))
const SCHOOL_MAX_SIZE = 64

function hashString(value) {
  let hash = 2166136261
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

function schoolKeyForCreature(creature) {
  return `${creature.biome}:${creature.depthZone}:${creature.species}`
}

function deterministicSchoolOrder(creature) {
  return hashString(`${creature.species}:${creature.biome}:${creature.depthZone}:${creature.id}`)
}

export default function Biome({ name, creatures, tankVisitSeed = 0, selectedCreatureId, zoomActive, debug = false, debugView = 'all', debugLayers = null, onCreatureClick, onCreatureReady }) {
  const visibleCreatures = useMemo(
    () => creatures.filter(c => c.biome === name && c.alive),
    [creatures, name],
  )
  const schoolByCreatureId = useMemo(() => {
    const schoolingGroups = visibleCreatures.reduce((groups, creature) => {
      const species = SPECIES_BY_NAME.get(creature.species)
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
      {visibleCreatures.map(creature => {
        const selected = creature.id === selectedCreatureId
        const showDebug = debug && (debugView === 'all' || (debugView === 'focused' && selected))
        return (
          <Fish
            key={creature.id}
            creature={creature}
            selected={selected}
            debug={showDebug}
            debugLayers={debugLayers}
            school={schoolByCreatureId.get(creature.id) ?? null}
            onClick={onCreatureClick}
            onReady={onCreatureReady}
          />
        )
      })}
    </group>
  )
}
