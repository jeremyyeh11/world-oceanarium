import Environment from './Environment'
import Fish from './Fish'
import OceanBubbles from './OceanBubbles'
import { SPECIES } from '../data/species'

const SPECIES_BY_NAME = new Map(SPECIES.map(species => [species.name, species]))
const SCHOOL_MAX_SIZE = 8

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

export default function Biome({ name, creatures, selectedCreatureId, zoomActive, debug = false, onCreatureClick }) {
  const visibleCreatures = creatures.filter(c => c.biome === name && c.alive)
  const schoolingGroups = visibleCreatures.reduce((groups, creature) => {
    const species = SPECIES_BY_NAME.get(creature.species)
    if (!species?.schooling) return groups

    const key = schoolKeyForCreature(creature)
    const group = groups.get(key) ?? []
    group.push(creature)
    groups.set(key, group)
    return groups
  }, new Map())

  const schoolByCreatureId = new Map()
  schoolingGroups.forEach((group, key) => {
    if (group.length < 2) return
    const orderedGroup = [...group].sort((a, b) => deterministicSchoolOrder(a) - deterministicSchoolOrder(b))
    for (let offset = 0; offset < orderedGroup.length; offset += SCHOOL_MAX_SIZE) {
      const schoolGroup = orderedGroup.slice(offset, offset + SCHOOL_MAX_SIZE)
      if (schoolGroup.length < 2) continue
      const schoolId = `${key}:school-${Math.floor(offset / SCHOOL_MAX_SIZE)}`
      schoolGroup.forEach((creature, index) => {
        schoolByCreatureId.set(creature.id, {
          id: schoolId,
          index,
          count: schoolGroup.length,
        })
      })
    }
  })

  return (
    <group>
      <Environment biome={name} />
      {name === 'ocean' && <OceanBubbles />}
      {visibleCreatures.map(creature => (
        <Fish
          key={creature.id}
          creature={creature}
          selected={creature.id === selectedCreatureId}
          debug={debug}
          school={schoolByCreatureId.get(creature.id) ?? null}
          onClick={onCreatureClick}
        />
      ))}
    </group>
  )
}
