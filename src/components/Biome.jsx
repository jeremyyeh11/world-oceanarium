import Environment from './Environment'
import Fish from './Fish'

export default function Biome({ name, creatures, onCreatureClick }) {
  const visibleCreatures = creatures.filter(c => c.biome === name && c.alive)
  return (
    <group>
      <Environment biome={name} />
      {visibleCreatures.map(creature => (
        <Fish
          key={creature.id}
          creature={creature}
          onClick={() => onCreatureClick(creature)}
        />
      ))}
    </group>
  )
}
