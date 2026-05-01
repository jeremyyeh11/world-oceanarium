import Environment from './Environment'
import Fish from './Fish'
import { CREATURES } from '../data/species'

export default function Biome({ name, onCreatureClick }) {
  const creatures = CREATURES.filter(c => c.biome === name && c.alive)
  return (
    <group>
      <Environment biome={name} />
      {creatures.map(creature => (
        <Fish
          key={creature.id}
          creature={creature}
          onClick={() => onCreatureClick(creature)}
        />
      ))}
    </group>
  )
}
