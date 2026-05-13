import Environment from './Environment'
import Fish from './Fish'
import OceanBubbles from './OceanBubbles'

export default function Biome({ name, creatures, selectedCreatureId, zoomActive, onCreatureClick }) {
  const visibleCreatures = creatures.filter(c => c.biome === name && c.alive)
  return (
    <group>
      <Environment biome={name} />
      {name === 'ocean' && <OceanBubbles />}
      {visibleCreatures.map(creature => (
        <Fish
          key={creature.id}
          creature={creature}
          selected={creature.id === selectedCreatureId}
          onClick={onCreatureClick}
        />
      ))}
    </group>
  )
}
