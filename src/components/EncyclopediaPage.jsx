import { Suspense, useMemo, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls, useGLTF } from '@react-three/drei'
import { clone } from 'three/examples/jsm/utils/SkeletonUtils.js'
import { DEPTH_ZONES, SPECIES, WORLD_UNIT_METERS } from '../data/species'

const DEPTH_ZONE_BY_ID = new Map(DEPTH_ZONES.map(zone => [zone.id, zone]))

const THUMBNAIL_GRADIENTS = [
  'linear-gradient(135deg, rgba(74, 196, 255, 0.34), rgba(7, 34, 62, 0.82))',
  'linear-gradient(135deg, rgba(154, 222, 211, 0.28), rgba(10, 45, 54, 0.86))',
  'linear-gradient(135deg, rgba(200, 218, 255, 0.26), rgba(26, 36, 66, 0.86))',
]

function speciesLengthMeters(species) {
  const bodyLengthWU = species?.swim?.bodyLengthWU
  if (!Number.isFinite(bodyLengthWU)) return null
  return bodyLengthWU * WORLD_UNIT_METERS
}

function formatLength(meters) {
  if (!Number.isFinite(meters) || meters <= 0) return 'Unknown'
  if (meters < 1) return `${Math.round(meters * 100)} cm`
  return `${meters.toFixed(meters < 10 ? 1 : 0)} m`
}

function ModelAsset({ species }) {
  const modelPath = species?.model?.path
  const gltf = useGLTF(modelPath)
  const scene = useMemo(() => clone(gltf.scene), [gltf.scene])
  const rawScale = species?.model?.scale ?? 1
  const viewerScale = species?.id === 'mola-alexandrini' ? rawScale * 0.62 : rawScale * 8.5
  const rotation = species?.model?.rotation ?? [0, 0, 0]

  return <primitive object={scene} rotation={rotation} scale={viewerScale} position={[0, 0, 0]} />
}

function FallbackFish({ species }) {
  const isLarge = species?.swim?.bodyLengthWU > 3
  const bodyLength = isLarge ? 4.2 : 2.4
  const bodyHeight = isLarge ? 1.2 : 0.58
  const color = species?.predator ? '#9ab7c8' : '#78d4e6'

  return (
    <group rotation={[0, -0.35, 0]}>
      <mesh scale={[bodyLength, bodyHeight, bodyHeight * 0.58]}>
        <sphereGeometry args={[0.5, 48, 24]} />
        <meshStandardMaterial color={color} roughness={0.48} metalness={0.04} />
      </mesh>
      <mesh position={[-bodyLength * 0.31, 0, 0]} rotation={[0, 0, Math.PI / 2]} scale={[bodyHeight * 0.85, bodyHeight * 0.5, bodyHeight * 0.06]}>
        <coneGeometry args={[0.6, 1.0, 3]} />
        <meshStandardMaterial color="#5ba4ba" roughness={0.6} />
      </mesh>
      <mesh position={[bodyLength * 0.17, bodyHeight * 0.28, 0]} rotation={[0.25, 0, 0]} scale={[bodyHeight * 0.28, bodyHeight * 0.7, bodyHeight * 0.06]}>
        <coneGeometry args={[0.45, 0.9, 3]} />
        <meshStandardMaterial color="#b1e4ed" roughness={0.5} />
      </mesh>
    </group>
  )
}

function SpeciesModel({ species }) {
  return (
    <Canvas camera={{ position: [0, 1.25, 7.5], fov: 38 }} dpr={[1, 1.5]}>
      <color attach="background" args={['#06111d']} />
      <ambientLight intensity={1.6} />
      <directionalLight position={[4, 5, 6]} intensity={2.8} />
      <directionalLight position={[-5, 1, -4]} intensity={0.8} color="#7bcfff" />
      <Suspense fallback={<FallbackFish species={species} />}>
        {species?.model?.path ? <ModelAsset species={species} /> : <FallbackFish species={species} />}
      </Suspense>
      <OrbitControls enablePan={false} enableZoom={false} autoRotate autoRotateSpeed={0.55} minPolarAngle={Math.PI * 0.3} maxPolarAngle={Math.PI * 0.72} />
    </Canvas>
  )
}

function HumanScalePlaceholder() {
  return (
    <div className="encyclopedia-scale-placeholder" aria-label="Placeholder human scale image">
      <div className="encyclopedia-human-silhouette">
        <span className="human-head" />
        <span className="human-body" />
        <span className="human-leg human-leg--left" />
        <span className="human-leg human-leg--right" />
      </div>
      <div>
        <strong>Human scale image</strong>
        <span>placeholder for final art</span>
      </div>
    </div>
  )
}

function SpeciesThumbnail({ species, index }) {
  const initials = species.name.split(/\s+/).map(part => part[0]).join('').slice(0, 2).toUpperCase()
  return (
    <div className="encyclopedia-species-thumb" style={{ background: THUMBNAIL_GRADIENTS[index % THUMBNAIL_GRADIENTS.length] }}>
      <span>{initials}</span>
    </div>
  )
}

export default function EncyclopediaPage({ initialSpeciesId, onClose }) {
  const [selectedId, setSelectedId] = useState(initialSpeciesId ?? SPECIES[0]?.id)
  const selectedSpecies = SPECIES.find(species => species.id === selectedId) ?? SPECIES[0]
  const lengthMeters = speciesLengthMeters(selectedSpecies)
  const depthZone = DEPTH_ZONE_BY_ID.get(selectedSpecies?.depthZone)
  const modelLabel = selectedSpecies?.model?.path ? '3D model preview' : 'Placeholder 3D form'

  return (
    <section className="encyclopedia-page" aria-label="Oceanarium encyclopaedia mockup">
      <div className="encyclopedia-topbar">
        <div>
          <p>Oceanarium encyclopaedia</p>
          <h1>Species gallery</h1>
        </div>
        <button className="encyclopedia-close" type="button" onClick={onClose} aria-label="Close encyclopaedia">×</button>
      </div>

      <aside className="encyclopedia-species-list" aria-label="Species list">
        <div className="encyclopedia-list-heading">
          <span>Existing species</span>
          <strong>{SPECIES.length}</strong>
        </div>
        {SPECIES.map((species, index) => (
          <button
            key={species.id}
            type="button"
            className={`encyclopedia-species-row${species.id === selectedSpecies.id ? ' is-selected' : ''}`}
            onClick={() => setSelectedId(species.id)}
          >
            <SpeciesThumbnail species={species} index={index} />
            <span>
              <strong>{species.name}</strong>
              {species.scientificName && <em>{species.scientificName}</em>}
            </span>
          </button>
        ))}
      </aside>

      <main className="encyclopedia-model-stage" aria-label={modelLabel}>
        <div className="encyclopedia-stage-label">{modelLabel}</div>
        <SpeciesModel species={selectedSpecies} />
        <HumanScalePlaceholder />
      </main>

      <aside className="encyclopedia-info-panel" aria-label={`${selectedSpecies.name} information`}>
        <p className="encyclopedia-panel-kicker">{selectedSpecies.family ?? 'Oceanarium species'}</p>
        <h2>{selectedSpecies.name}</h2>
        {selectedSpecies.scientificName && <p className="encyclopedia-scientific">{selectedSpecies.scientificName}</p>}
        <p className="encyclopedia-description">{selectedSpecies.description ?? 'Species notes coming soon.'}</p>
        <div className="encyclopedia-stat-grid">
          <div><span>Body length</span><strong>{formatLength(lengthMeters)}</strong></div>
          <div><span>Depth zone</span><strong>{depthZone?.shortLabel ?? selectedSpecies.depthZone ?? 'Unknown'}</strong></div>
          <div><span>Behavior</span><strong>{selectedSpecies.schooling ? 'Schooling' : selectedSpecies.repulser ? 'Large solo presence' : 'Solo / pending'}</strong></div>
          <div><span>Model</span><strong>{selectedSpecies.model?.path ? 'Available' : 'Placeholder'}</strong></div>
        </div>
        <div className="encyclopedia-note-block">
          <strong>Mockup note</strong>
          <p>This is the first pass at the gallery flow: list on the left, model and scale read in the center, field-guide facts on the right.</p>
        </div>
      </aside>
    </section>
  )
}
