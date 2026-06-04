import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { useGLTF, useTexture } from '@react-three/drei'
import * as THREE from 'three'
import { clone } from 'three/examples/jsm/utils/SkeletonUtils.js'
import { DEPTH_ZONES, SPECIES, WORLD_UNIT_METERS } from '../data/species'
import SceneLighting from './SceneLighting'
import UnderwaterFX from './UnderwaterFX'
import WaterSurface from './WaterSurface'

const DEPTH_ZONE_BY_ID = new Map(DEPTH_ZONES.map(zone => [zone.id, zone]))

const THUMBNAIL_GRADIENTS = [
  'linear-gradient(135deg, rgba(74, 196, 255, 0.34), rgba(7, 34, 62, 0.82))',
  'linear-gradient(135deg, rgba(154, 222, 211, 0.28), rgba(10, 45, 54, 0.86))',
  'linear-gradient(135deg, rgba(200, 218, 255, 0.26), rgba(26, 36, 66, 0.86))',
]

const DEFAULT_VIEW_POSE = {
  yawOffset: Math.PI / 2,
  cameraPosition: [0, 0.65, 9.2],
  fov: 34,
  scaleMultiplier: 6.8,
  position: [0, -0.05, 0],
}

// Per-species fixed gallery poses. Most fish should read in side profile,
// but future species can override yaw, camera, or scale when a different
// anatomical angle is more legible.
const VIEW_POSES_BY_SPECIES = {
  'mola-alexandrini': {
    yawOffset: Math.PI / 2,
    cameraPosition: [0, 0.8, 10.8],
    fov: 34,
    scaleMultiplier: 0.42,
    position: [0, -0.55, 0],
  },
}

function viewPoseForSpecies(species) {
  return { ...DEFAULT_VIEW_POSE, ...(VIEW_POSES_BY_SPECIES[species?.id] ?? {}) }
}

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

const ROOT_TRANSLATION_TRACK_RE = /^(root|scene)\.position$/i

function cloneInPlaceClip(clip) {
  const tracks = clip.tracks.filter(track => !ROOT_TRANSLATION_TRACK_RE.test(track.name))
  return new THREE.AnimationClip(clip.name, clip.duration, tracks.map(track => track.clone()))
}

function findClip(clips, candidates) {
  const normalized = candidates.filter(Boolean).map(name => String(name).toLowerCase())
  return clips.find(clip => normalized.includes(clip.name.toLowerCase()))
    ?? clips.find(clip => normalized.some(name => clip.name.toLowerCase().includes(name)))
}

function atlasIdleCandidates(model) {
  return [
    model?.animationMap?.idle,
    model?.moveset?.drift,
    model?.moveset?.cruise,
    'idle',
    'idle_drift',
    'slow_cruise',
  ]
}

function atlasBurstCandidates(model) {
  return [
    model?.animationMap?.burst,
    model?.moveset?.burst,
    'burst',
    'snap_left',
    'snap_right',
  ]
}

function nextBurstDelay() {
  return THREE.MathUtils.randFloat(6.5, 10.5)
}

function ModelAsset({ species, pose }) {
  const modelPath = species?.model?.path
  const gltf = useGLTF(modelPath)
  const scene = useMemo(() => clone(gltf.scene), [gltf.scene])
  const mixerRef = useRef(null)
  const actionsRef = useRef({ idle: null, burst: null })
  const burstDueAtRef = useRef(0)
  const rawScale = species?.model?.scale ?? 1
  const viewerScale = rawScale * pose.scaleMultiplier
  const sourceRotation = species?.model?.rotation ?? [0, 0, 0]
  const rotation = [sourceRotation[0], sourceRotation[1] + pose.yawOffset, sourceRotation[2]]

  useEffect(() => {
    const clips = gltf.animations ?? []
    const idleClip = findClip(clips, atlasIdleCandidates(species?.model))
    const burstClip = findClip(clips, atlasBurstCandidates(species?.model))
    if (!idleClip && !burstClip) return undefined

    const mixer = new THREE.AnimationMixer(scene)
    const fadeDuration = species?.model?.animationFadeDuration ?? 0.28
    const idleAction = idleClip ? mixer.clipAction(cloneInPlaceClip(idleClip)) : null
    const burstAction = burstClip ? mixer.clipAction(cloneInPlaceClip(burstClip)) : null

    if (idleAction) {
      idleAction.enabled = true
      idleAction.setLoop(THREE.LoopRepeat, Infinity)
      idleAction.setEffectiveTimeScale(idleClip.name === 'slow_cruise' ? 0.82 : 1)
      idleAction.setEffectiveWeight(1)
      idleAction.play()
    }

    if (burstAction) {
      burstAction.enabled = true
      burstAction.setLoop(THREE.LoopOnce, 1)
      burstAction.clampWhenFinished = false
      burstAction.setEffectiveTimeScale(burstClip.duration > 3 ? 1.18 : 1)
      burstAction.setEffectiveWeight(1)
    }

    const onFinished = event => {
      if (event.action !== burstAction || !idleAction) return
      idleAction.reset().fadeIn(fadeDuration).play()
      burstDueAtRef.current = mixer.time + nextBurstDelay()
    }

    mixer.addEventListener('finished', onFinished)
    mixerRef.current = mixer
    actionsRef.current = { idle: idleAction, burst: burstAction }
    burstDueAtRef.current = mixer.time + 3.8

    return () => {
      mixer.removeEventListener('finished', onFinished)
      mixer.stopAllAction()
      mixer.uncacheRoot(scene)
      mixerRef.current = null
      actionsRef.current = { idle: null, burst: null }
    }
  }, [gltf.animations, scene, species])

  useFrame((_, delta) => {
    const mixer = mixerRef.current
    if (!mixer) return
    mixer.update(delta)

    const { idle, burst } = actionsRef.current
    if (!burst || burst.isRunning()) return
    if (mixer.time < burstDueAtRef.current) return

    burst.reset().play()
    if (idle) burst.crossFadeFrom(idle, species?.model?.animationFadeDuration ?? 0.28, false)
    burstDueAtRef.current = mixer.time + 999
  })

  return <primitive object={scene} rotation={rotation} scale={viewerScale} position={pose.position} />
}

const HUMAN_SCALE_METERS = 1.7
const DIVER_IMAGE_ASPECT = 620 / 360

const DIVER_POSES_BY_SPECIES = {
  'mola-alexandrini': {
    position: [1.48, -0.72, 0.95],
    opacity: 0.58,
  },
}

function displayedSpeciesLengthUnits(species, pose) {
  const bodyLengthWU = species?.swim?.bodyLengthWU
  if (!Number.isFinite(bodyLengthWU)) return null
  return bodyLengthWU * pose.scaleMultiplier
}

function AtlasDiverScale({ species }) {
  const texture = useTexture('/atlas/diver-silhouette.png')
  const lengthMeters = speciesLengthMeters(species)
  const isTinyComparison = Number.isFinite(lengthMeters) && lengthMeters < 0.6
  const pose = viewPoseForSpecies(species)
  const displayedLength = displayedSpeciesLengthUnits(species, pose)
  const exactWidth = Number.isFinite(displayedLength) && Number.isFinite(lengthMeters)
    ? displayedLength * (HUMAN_SCALE_METERS / lengthMeters)
    : 2.8
  const width = isTinyComparison ? Math.min(exactWidth, 6.8) : exactWidth
  const height = width / DIVER_IMAGE_ASPECT
  const diverPose = DIVER_POSES_BY_SPECIES[species?.id] ?? {
    position: isTinyComparison ? [-3.85, -0.18, 0.95] : [1.35, -1.36, 0.95],
    opacity: isTinyComparison ? 0.54 : 0.62,
  }

  return (
    <mesh position={diverPose.position} scale={[width, height, 1]} raycast={() => null}>
      <planeGeometry args={[1, 1]} />
      <meshBasicMaterial map={texture} transparent opacity={diverPose.opacity} depthWrite={false} depthTest={false} toneMapped={false} />
    </mesh>
  )
}

function FallbackFish({ species, pose = DEFAULT_VIEW_POSE }) {
  const isLarge = species?.swim?.bodyLengthWU > 3
  const bodyLength = isLarge ? 4.2 : 2.4
  const bodyHeight = isLarge ? 1.2 : 0.58
  const color = species?.predator ? '#9ab7c8' : '#78d4e6'

  return (
    <group rotation={[0, pose.yawOffset, 0]} position={pose.position}>
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
  const pose = viewPoseForSpecies(species)

  return (
    <Canvas camera={{ position: pose.cameraPosition, fov: pose.fov }} dpr={[1, 1.5]}>
      <SceneLighting biome="ocean" />
      <directionalLight position={[4, 5, 6]} intensity={2.8} />
      <directionalLight position={[-5, 1, -4]} intensity={0.8} color="#7bcfff" />
      <WaterSurface biome="ocean" />
      <UnderwaterFX biome="ocean" />
      <Suspense fallback={null}>
        <AtlasDiverScale species={species} />
      </Suspense>
      <Suspense fallback={<FallbackFish species={species} pose={pose} />}>
        {species?.model?.path ? <ModelAsset species={species} pose={pose} /> : <FallbackFish species={species} pose={pose} />}
      </Suspense>
    </Canvas>
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

  return (
    <section className="encyclopedia-page" aria-label="The Atlas mockup">
      <div className="encyclopedia-topbar">
        <div>
          <h1>The Atlas</h1>
        </div>
        <button className="encyclopedia-close" type="button" onClick={onClose} aria-label="Close encyclopaedia">×</button>
      </div>

      <aside className="encyclopedia-species-list" aria-label="Species list">
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

      <main
        className="encyclopedia-model-stage is-tank-backdrop"
        aria-label={`${selectedSpecies.name} fixed side view`}
      >
        <SpeciesModel species={selectedSpecies} />
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
