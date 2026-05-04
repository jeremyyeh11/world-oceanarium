import Environment from './Environment'
import Fish from './Fish'

export default function Biome({ name, creatures, selectedCreatureId, zoomActive, onCreatureClick }) {
  const visibleCreatures = creatures.filter(c => c.biome === name && c.alive)
  return (
    <group>
      <Environment biome={name} hideZoneLabels={zoomActive} />
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
