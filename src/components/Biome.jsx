import Environment from './Environment'
import Fish from './Fish'
import OceanBubbles from './OceanBubbles'
import { SPECIES } from '../data/species'

const SPECIES_BY_NAME = new Map(SPECIES.map(species => [species.name, species]))

function schoolKeyForCreature(creature) {
  return `${creature.biome}:${creature.depthZone}:${creature.species}`
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
    group.forEach((creature, index) => {
      schoolByCreatureId.set(creature.id, {
        id: key,
        index,
        count: group.length,
      })
    })
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
