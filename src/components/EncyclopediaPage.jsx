import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { useGLTF, useTexture } from '@react-three/drei'
import * as THREE from 'three'
import { clone } from 'three/examples/jsm/utils/SkeletonUtils.js'
import { BIOMES, DEPTH_ZONES, SPECIES, WORLD_UNIT_METERS } from '../data/species'
import { APP_VERSION_SHORT_LABEL } from '../version'
import Environment from './Environment'
import OceanBubbles from './OceanBubbles'
import SceneLighting from './SceneLighting'
import UnderwaterFX from './UnderwaterFX'
import WaterSurface from './WaterSurface'

const DEPTH_ZONE_BY_ID = new Map(DEPTH_ZONES.map(zone => [zone.id, zone]))
const BIOME_BY_ID = new Map(BIOMES.map(biome => [biome.id, biome]))

const THUMBNAIL_GRADIENTS = [
  'linear-gradient(135deg, rgba(74, 196, 255, 0.34), rgba(7, 34, 62, 0.82))',
  'linear-gradient(135deg, rgba(154, 222, 211, 0.28), rgba(10, 45, 54, 0.86))',
  'linear-gradient(135deg, rgba(200, 218, 255, 0.26), rgba(26, 36, 66, 0.86))',
]

const IUCN_STATUS_STEPS = [
  { code: 'NE', label: 'Not Evaluated', color: '#6d7781' },
  { code: 'DD', label: 'Data Deficient', color: '#8e969d' },
  { code: 'LC', label: 'Least Concern', color: '#3fcf7f' },
  { code: 'NT', label: 'Near Threatened', color: '#b9d84b' },
  { code: 'VU', label: 'Vulnerable', color: '#f2c94c' },
  { code: 'EN', label: 'Endangered', color: '#f2994a' },
  { code: 'CR', label: 'Critically Endangered', color: '#eb5757' },
]

const ATLAS_CAMERA_YAW_DEGREES = 0
const ATLAS_CAMERA_PITCH_DEGREES = 15
const ATLAS_CREATURE_DIAGONAL_YAW_RADIANS = Math.PI / 6
const ATLAS_DEBUG_TOGGLE_EVENT = 'world-oceanarium-toggle-debug'
const ATLAS_DEBUG_TAP_WINDOW_MS = 1200
const ATLAS_DEBUG_REQUIRED_TAPS = 3
const ATLAS_DIVER_POSE_STORAGE_KEY = 'world-oceanarium-atlas-diver-poses'
const ATLAS_SPECIES = SPECIES.filter(species => !species.hiddenInAtlas)

const DEFAULT_VIEW_POSE = {
  yawOffset: Math.PI / 2 + ATLAS_CREATURE_DIAGONAL_YAW_RADIANS,
  cameraDistance: 9.2,
  fov: 34,
  maxLengthDisplayUnits: 2.8,
  position: [0, -0.05, 0],
  lookAt: [0, -0.05, 0],
}

// Per-species fixed gallery poses. Most fish should read in side profile,
// but future species can override yaw, camera, or scale when a different
// anatomical angle is more legible.
const VIEW_POSES_BY_SPECIES = {
  'amblygaster-sirm': {
    maxLengthDisplayUnits: 1.35,
    cameraDistance: 9.2,
    position: [0, -0.02, 0],
    lookAt: [0, -0.02, 0],
  },
  'coryphaena-hippurus': {
    maxLengthDisplayUnits: 2.8,
    cameraDistance: 9.8,
    position: [0, -0.02, 0],
    lookAt: [0, -0.02, 0],
  },
  'mola-alexandrini': {
    yawOffset: Math.PI / 2 + ATLAS_CREATURE_DIAGONAL_YAW_RADIANS,
    cameraDistance: 10.8,
    fov: 34,
    maxLengthDisplayUnits: 4.1,
    position: [0, -0.55, 0],
    lookAt: [0, -0.3, 0],
  },
}

const MODEL_SOURCE_LENGTH_UNITS_BY_SPECIES = {
  'amblygaster-sirm': 1.8223,
  'coryphaena-hippurus': 9.788,
  'mola-alexandrini': 20.7909,
}

const ATLAS_HERO_ANIMATION_BY_SPECIES = {
  'amblygaster-sirm': { animationOffset: 0.45, animationSpeed: 0.97, burstDelay: 4.9 },
  'coryphaena-hippurus': { animationOffset: 0.8, animationSpeed: 1.03, burstDelay: 5.4 },
}

const ATLAS_COMPANIONS_BY_SPECIES = {
  'amblygaster-sirm': [
    { position: [-1.15, -0.3, -2.65], scale: 0.5, yaw: -0.08, animationOffset: 1.35, animationSpeed: 1.08, burstDelay: 7.1 },
    { position: [1.18, -0.34, -1.5], scale: 0.52, yaw: 0.1, animationOffset: 2.9, animationSpeed: 0.91, burstDelay: 6.2 },
    { position: [-0.42, -1.24, -1.9], scale: 0.44, yaw: 0.04, animationOffset: 4.25, animationSpeed: 1.14, burstDelay: 8.4 },
  ],
  'coryphaena-hippurus': [
    { position: [-1.55, 0.42, -1.65], scale: 0.54, yaw: -0.1, animationOffset: 1.6, animationSpeed: 0.92, burstDelay: 7.6 },
    { position: [1.42, -0.5, -2.05], scale: 0.48, yaw: 0.12, animationOffset: 3.35, animationSpeed: 1.11, burstDelay: 6.5 },
    { position: [0.28, 0.86, -2.4], scale: 0.42, yaw: 0.05, animationOffset: 4.9, animationSpeed: 0.86, burstDelay: 8.9 },
  ],
}

function viewPoseForSpecies(species) {
  return { ...DEFAULT_VIEW_POSE, ...(VIEW_POSES_BY_SPECIES[species?.id] ?? {}) }
}

function atlasCameraPosition(pose) {
  const distance = pose.cameraDistance ?? pose.cameraPosition?.[2] ?? 9.2
  const yaw = THREE.MathUtils.degToRad(ATLAS_CAMERA_YAW_DEGREES)
  const pitch = THREE.MathUtils.degToRad(ATLAS_CAMERA_PITCH_DEGREES)
  const lookAt = pose.lookAt ?? pose.position ?? [0, 0, 0]
  const horizontalDistance = Math.cos(pitch) * distance

  return [
    lookAt[0] + Math.sin(yaw) * horizontalDistance,
    lookAt[1] + Math.sin(pitch) * distance,
    lookAt[2] + Math.cos(yaw) * horizontalDistance,
  ]
}

function atlasViewportCameraDistance(species, pose, size) {
  const baseDistance = pose.cameraDistance ?? pose.cameraPosition?.[2] ?? 9.2
  const isMobile = size.width <= 880
  if (!isMobile) return baseDistance

  const isPortraitPhone = size.width <= 480 && size.height > size.width
  if (isPortraitPhone) {
    return baseDistance * (species?.id === 'amblygaster-sirm' ? 0.46 : 0.6)
  }

  return baseDistance * 0.68
}

function AtlasCamera({ species, pose }) {
  useFrame(({ camera, size }) => {
    const cameraPose = {
      ...pose,
      cameraDistance: atlasViewportCameraDistance(species, pose, size),
    }
    const [x, y, z] = atlasCameraPosition(cameraPose)
    const lookAt = pose.lookAt ?? pose.position ?? [0, 0, 0]
    camera.position.set(x, y, z)
    camera.lookAt(lookAt[0], lookAt[1], lookAt[2])
  })
  return null
}

function displayedSpeciesLengthUnits(species, pose) {
  if (!Number.isFinite(pose?.maxLengthDisplayUnits)) return null
  return pose.maxLengthDisplayUnits
}

function atlasModelScaleForSpecies(species, pose) {
  const sourceLength = MODEL_SOURCE_LENGTH_UNITS_BY_SPECIES[species?.id]
  if (Number.isFinite(sourceLength) && sourceLength > 0 && Number.isFinite(pose?.maxLengthDisplayUnits)) {
    return pose.maxLengthDisplayUnits / sourceLength
  }
  return species?.model?.scale ?? 1
}

function speciesLengthMeters(species) {
  if (Number.isFinite(species?.maxBodyLengthMeters)) return species.maxBodyLengthMeters
  const bodyLengthWU = species?.swim?.bodyLengthWU
  if (!Number.isFinite(bodyLengthWU)) return null
  return bodyLengthWU * WORLD_UNIT_METERS
}

function speciesLengthRangeMeters(species) {
  if (Array.isArray(species?.adultLengthRangeMeters) && species.adultLengthRangeMeters.length >= 2) {
    const [min, max] = species.adultLengthRangeMeters.map(Number)
    if (Number.isFinite(min) && Number.isFinite(max) && min > 0 && max >= min) return [min, max]
  }

  const maxLength = speciesLengthMeters(species)
  if (!Number.isFinite(maxLength) || maxLength <= 0) return null

  if (Array.isArray(species?.sizeRange) && species.sizeRange.length >= 2) {
    const [minScale, maxScale] = species.sizeRange.map(Number)
    if (Number.isFinite(minScale) && Number.isFinite(maxScale) && minScale > 0 && maxScale >= minScale) {
      return [maxLength * minScale, maxLength * maxScale]
    }
  }

  return [maxLength, maxLength]
}

function formatLength(meters) {
  if (!Number.isFinite(meters) || meters <= 0) return 'Unknown'
  if (meters < 1) return `${Math.round(meters * 100)} cm`
  return `${meters.toFixed(meters < 10 ? 1 : 0)} m`
}

function formatLengthRange(range) {
  if (!Array.isArray(range) || range.length < 2) return 'Unknown'
  const [min, max] = range
  if (!Number.isFinite(min) || !Number.isFinite(max) || min <= 0 || max <= 0) return 'Unknown'
  if (Math.abs(min - max) < 0.001) return formatLength(max)

  const bothUnderMeter = min < 1 && max < 1
  if (bothUnderMeter) return `${Math.round(min * 100)} cm - ${Math.round(max * 100)} cm`
  return `${min.toFixed(min < 10 ? 1 : 0)} m - ${max.toFixed(max < 10 ? 1 : 0)} m`
}

function unknownIfEmpty(value) {
  if (value === null || value === undefined || value === '') return 'Unknown'
  return value
}

function formatInteger(value, suffix) {
  const numeric = Number(value)
  if (!Number.isFinite(numeric) || numeric <= 0) return 'Unknown'
  return `${Math.round(numeric)} ${suffix}`
}

function formatSexLength(value) {
  if (typeof value === 'string' && value.trim() !== '' && Number.isNaN(Number(value))) return value
  const numeric = Number(value)
  if (!Number.isFinite(numeric) || numeric <= 0) return 'Unknown'
  if (numeric < 1) return `${numeric.toFixed(2)} m`
  if (numeric < 10 && !Number.isInteger(numeric)) return `${numeric.toFixed(1)} m`
  return `${Math.round(numeric)} m`
}

function formatYears(value) {
  if (typeof value === 'string' && value.trim() !== '' && Number.isNaN(Number(value))) return value
  return formatInteger(value, 'years')
}

function formatWeight(value) {
  if (typeof value === 'string' && value.trim() !== '' && Number.isNaN(Number(value))) return value
  const numeric = Number(value)
  if (!Number.isFinite(numeric) || numeric <= 0) return 'Unknown'
  if (numeric < 1) return `${numeric.toFixed(2)} kg`
  return `${new Intl.NumberFormat().format(Math.round(numeric))} kg`
}

function formatOffspring(value) {
  const numeric = Number(value)
  if (!Number.isFinite(numeric) || numeric <= 0) return unknownIfEmpty(value)
  return new Intl.NumberFormat().format(Math.round(numeric))
}

function SexPair({ male, female, formatter }) {
  return (
    <span className="atlas-sex-pair">
      <span aria-label="Male">♂ {formatter(male)}</span>
      <span aria-label="Female">♀ {formatter(female)}</span>
    </span>
  )
}

function AtlasQuickCards({ diet, biome, location }) {
  return (
    <div className="atlas-quick-card-grid" aria-label="Species quick facts">
      <div><span>Diet</span><strong>{unknownIfEmpty(diet)}</strong></div>
      <div><span>Biome</span><strong>{unknownIfEmpty(biome)}</strong></div>
      <div><span>Location</span><strong>{unknownIfEmpty(location)}</strong></div>
    </div>
  )
}

function AtlasTableSection({ title, rows }) {
  return (
    <section className="atlas-table-section" aria-label={title}>
      <h3>{title}</h3>
      <div className="atlas-info-table">
        {rows.map(row => (
          <div className="atlas-info-row" key={row.label}>
            <div className="atlas-info-label">{row.label}</div>
            <div className="atlas-info-value">{row.value}</div>
          </div>
        ))}
      </div>
    </section>
  )
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

function prepareAtlasModelScene(sourceScene) {
  const scene = clone(sourceScene)
  scene.traverse(object => {
    if (!object.isMesh) return
    const sanitizeMaterial = material => {
      if (!material) return material
      const nextMaterial = material.clone()
      nextMaterial.transparent = false
      nextMaterial.opacity = 1
      nextMaterial.depthWrite = true
      nextMaterial.depthTest = true
      nextMaterial.side = THREE.FrontSide
      nextMaterial.needsUpdate = true
      return nextMaterial
    }
    object.material = Array.isArray(object.material)
      ? object.material.map(sanitizeMaterial)
      : sanitizeMaterial(object.material)
  })
  return scene
}

function ModelAsset({ species, pose, companion = null }) {
  const modelPath = species?.model?.path
  const gltf = useGLTF(modelPath)
  const scene = useMemo(() => prepareAtlasModelScene(gltf.scene), [gltf.scene])
  const mixerRef = useRef(null)
  const actionsRef = useRef({ idle: null, burst: null })
  const burstDueAtRef = useRef(0)
  const animationProfile = companion ?? ATLAS_HERO_ANIMATION_BY_SPECIES[species?.id] ?? null
  const animationOffset = animationProfile?.animationOffset ?? 0
  const animationSpeed = animationProfile?.animationSpeed ?? 1
  const openingBurstDelay = animationProfile?.burstDelay ?? 3.8
  const viewerScale = atlasModelScaleForSpecies(species, pose) * (companion?.scale ?? 1)
  const sourceRotation = species?.model?.rotation ?? [0, 0, 0]
  const rotation = [sourceRotation[0], sourceRotation[1] + pose.yawOffset + (companion?.yaw ?? 0), sourceRotation[2]]
  const position = companion?.position ?? pose.position

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
      idleAction.setEffectiveTimeScale((idleClip.name === 'slow_cruise' ? 0.82 : 1) * animationSpeed)
      idleAction.setEffectiveWeight(1)
      idleAction.play()
    }

    if (burstAction) {
      burstAction.enabled = true
      burstAction.setLoop(THREE.LoopOnce, 1)
      burstAction.clampWhenFinished = false
      burstAction.setEffectiveTimeScale((burstClip.duration > 3 ? 1.18 : 1) * animationSpeed)
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
    if (Number.isFinite(animationOffset) && animationOffset > 0) {
      mixer.update(animationOffset)
    }
    burstDueAtRef.current = mixer.time + openingBurstDelay

    return () => {
      mixer.removeEventListener('finished', onFinished)
      mixer.stopAllAction()
      mixer.uncacheRoot(scene)
      mixerRef.current = null
      actionsRef.current = { idle: null, burst: null }
    }
  }, [animationOffset, animationSpeed, gltf.animations, openingBurstDelay, scene, species])

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

  return <primitive object={scene} rotation={rotation} scale={viewerScale} position={position} />
}

const HUMAN_SCALE_METERS = 1.7
const DIVER_IMAGE_ASPECT = 479 / 212

const DEFAULT_DIVER_POSE = {
  position: [1.35, -1.62, -0.85],
  opacity: 0.42,
}

const DIVER_POSES_BY_SPECIES = {
  'amblygaster-sirm': {
    position: [2.25, -0.55, -0.85],
    opacity: 0.34,
  },
  'coryphaena-hippurus': {
    position: [0.8, -1.65, -0.85],
    opacity: 0.38,
  },
  'mola-alexandrini': {
    position: [1.85, -2.25, -0.85],
    opacity: 0.38,
  },
}

function baseDiverPoseForSpecies(species) {
  return DIVER_POSES_BY_SPECIES[species?.id] ?? DEFAULT_DIVER_POSE
}

function normalizeDiverPose(candidate, fallback = DEFAULT_DIVER_POSE) {
  const position = Array.isArray(candidate?.position) ? candidate.position : fallback.position
  return {
    position: [0, 1, 2].map(index => (
      Number.isFinite(Number(position?.[index])) ? Number(position[index]) : fallback.position[index]
    )),
    opacity: Number.isFinite(Number(candidate?.opacity)) ? Number(candidate.opacity) : fallback.opacity,
  }
}

function mergedDiverPoseForSpecies(species, overridePose = null) {
  const basePose = baseDiverPoseForSpecies(species)
  const pose = normalizeDiverPose(overridePose, basePose)
  pose.position[2] = basePose.position[2]
  return pose
}

function AtlasDiverScale({ species, diverPoseOverride = null }) {
  const texture = useTexture('/atlas/diver.png')
  const lengthMeters = speciesLengthMeters(species)
  const pose = viewPoseForSpecies(species)
  const displayedLength = displayedSpeciesLengthUnits(species, pose)
  const width = Number.isFinite(displayedLength) && Number.isFinite(lengthMeters)
    ? displayedLength * (HUMAN_SCALE_METERS / lengthMeters)
    : 2.8
  const height = width / DIVER_IMAGE_ASPECT
  const diverPose = mergedDiverPoseForSpecies(species, diverPoseOverride)

  return (
    <sprite position={diverPose.position} scale={[width, height, 1]} renderOrder={-5} raycast={() => null}>
      <spriteMaterial
        color="#000000"
        map={texture}
        transparent
        opacity={diverPose.opacity}
        alphaTest={0.01}
        depthWrite={false}
        depthTest
        toneMapped={false}
      />
    </sprite>
  )
}

function FallbackFish({ species, pose = DEFAULT_VIEW_POSE }) {
  const isLarge = species?.swim?.bodyLengthWU > 3
  const bodyLength = displayedSpeciesLengthUnits(species, pose) ?? (isLarge ? 4.2 : 2.4)
  const bodyHeight = isLarge ? bodyLength * 0.28 : bodyLength * 0.24
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

function SpeciesModel({ species, diverPoseOverride = null }) {
  const pose = viewPoseForSpecies(species)
  const cameraPosition = atlasCameraPosition(pose)
  const companions = ATLAS_COMPANIONS_BY_SPECIES[species?.id] ?? []

  return (
    <Canvas camera={{ position: cameraPosition, fov: pose.fov }} dpr={[1, 1.5]} gl={{ preserveDrawingBuffer: true }}>
      <AtlasCamera species={species} pose={pose} />
      <SceneLighting biome="ocean" />
      <Environment biome="ocean" />
      <OceanBubbles count={22} depthTest={false} maxY={-0.75} minY={-3.15} opacityScale={0.72} renderOrder={8} sizeScale={1.1} />
      <directionalLight position={[4, 5, 6]} intensity={2.8} />
      <directionalLight position={[-5, 1, -4]} intensity={0.8} color="#7bcfff" />
      <WaterSurface biome="ocean" />
      <UnderwaterFX biome="ocean" />
      <Suspense fallback={null}>
        <AtlasDiverScale species={species} diverPoseOverride={diverPoseOverride} />
      </Suspense>
      <Suspense fallback={<FallbackFish species={species} pose={pose} />}>
        {species?.model?.path ? (
          <>
            {companions.map((companion, index) => (
              <ModelAsset key={`${species.id}-atlas-companion-${index}`} species={species} pose={pose} companion={companion} />
            ))}
            <ModelAsset species={species} pose={pose} />
          </>
        ) : <FallbackFish species={species} pose={pose} />}
      </Suspense>
    </Canvas>
  )
}

function SpeciesThumbnail({ species, index }) {
  const initials = species.name.split(/\s+/).map(part => part[0]).join('').slice(0, 2).toUpperCase()
  return (
    <div className="encyclopedia-species-thumb" style={{ background: THUMBNAIL_GRADIENTS[index % THUMBNAIL_GRADIENTS.length] }}>
      {species.atlasThumbnail
        ? <img src={species.atlasThumbnail} alt="" loading="lazy" />
        : <span>{initials}</span>}
    </div>
  )
}

function ConservationStatusBar({ status }) {
  const statusCode = status?.code ?? 'NE'
  const activeIndex = Math.max(0, IUCN_STATUS_STEPS.findIndex(step => step.code === statusCode))
  const activeStep = IUCN_STATUS_STEPS[activeIndex]

  return (
    <section className="iucn-status-card" aria-label={`IUCN Red List status: ${activeStep.label}`}>
      <div className="iucn-status-heading">
        <span>IUCN Red List</span>
        <strong style={{ color: activeStep.color }}>{activeStep.code}</strong>
      </div>
      <div className="iucn-status-name">{activeStep.label}</div>
      <div className="iucn-status-track" aria-hidden="true">
        {IUCN_STATUS_STEPS.map((step, index) => (
          <span
            key={step.code}
            className={index === activeIndex ? 'is-active' : ''}
            style={{ '--iucn-color': step.color }}
          >
            {step.code}
          </span>
        ))}
      </div>
    </section>
  )
}

function loadStoredDiverPoses() {
  if (typeof window === 'undefined') return {}
  try {
    const stored = window.localStorage.getItem(ATLAS_DIVER_POSE_STORAGE_KEY)
    if (!stored) return {}
    const parsed = JSON.parse(stored)
    if (!parsed || typeof parsed !== 'object') return {}
    return Object.fromEntries(Object.entries(parsed).map(([speciesId, pose]) => [speciesId, normalizeDiverPose(pose)]))
  } catch (error) {
    console.warn('Could not load Atlas diver poses', error)
    return {}
  }
}

function saveStoredDiverPoses(poses) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(ATLAS_DIVER_POSE_STORAGE_KEY, JSON.stringify(poses))
  } catch (error) {
    console.warn('Could not save Atlas diver poses', error)
  }
}

function roundPoseValue(value) {
  return Math.round(value * 100) / 100
}

function roundedDiverPose(pose) {
  return {
    position: pose.position.map(roundPoseValue),
    opacity: roundPoseValue(pose.opacity),
  }
}

function AtlasDiverPoseEditor({ species, pose, onPoseChange, onReset }) {
  const [copyState, setCopyState] = useState('Copy JSON')
  const controls = [
    { label: 'X', index: 0, min: -4, max: 4, step: 0.05 },
    { label: 'Y', index: 1, min: -3, max: 2, step: 0.05 },
  ]

  const updatePosition = (index, value) => {
    const next = normalizeDiverPose(pose)
    next.position[index] = Number(value)
    onPoseChange(roundedDiverPose(next))
  }

  const updateOpacity = (value) => {
    const next = normalizeDiverPose(pose)
    next.opacity = Number(value)
    onPoseChange(roundedDiverPose(next))
  }

  const copyPose = async () => {
    const text = `'${species.id}': ${JSON.stringify(roundedDiverPose(pose))}`
    try {
      await navigator.clipboard?.writeText(text)
      setCopyState('Copied')
    } catch {
      setCopyState(text)
    }
    window.setTimeout(() => setCopyState('Copy JSON'), 1400)
  }

  return (
    <aside className="atlas-pose-editor" aria-label="Atlas diver pose editor">
      <div className="atlas-pose-editor-heading">
        <strong>Diver pose</strong>
        <span>{species.name}</span>
      </div>
      {controls.map(control => (
        <label key={control.label} className="atlas-pose-control">
          <span>{control.label}</span>
          <input
            type="range"
            min={control.min}
            max={control.max}
            step={control.step}
            value={pose.position[control.index]}
            onChange={(event) => updatePosition(control.index, event.target.value)}
          />
          <output>{pose.position[control.index].toFixed(2)}</output>
        </label>
      ))}
      <label className="atlas-pose-control">
        <span>Opacity</span>
        <input
          type="range"
          min="0"
          max="1"
          step="0.01"
          value={pose.opacity}
          onChange={(event) => updateOpacity(event.target.value)}
        />
        <output>{pose.opacity.toFixed(2)}</output>
      </label>
      <div className="atlas-pose-actions">
        <button type="button" onClick={copyPose}>{copyState}</button>
        <button type="button" onClick={onReset}>Reset species</button>
      </div>
      <p>Ctrl+Shift+D hides/shows this panel. Saves locally in this browser. Z is fixed at -0.85 so scale stays comparable.</p>
    </aside>
  )
}

export default function EncyclopediaPage({ initialSpeciesId, onClose }) {
  const [selectedId, setSelectedId] = useState(() => {
    if (ATLAS_SPECIES.some(species => species.id === initialSpeciesId)) return initialSpeciesId
    return ATLAS_SPECIES[0]?.id
  })
  const [poseEditorOpen, setPoseEditorOpen] = useState(false)
  const [storedDiverPoses, setStoredDiverPoses] = useState(() => loadStoredDiverPoses())
  const pageRef = useRef(null)
  const debugTapCount = useRef(0)
  const debugTapTimer = useRef(null)
  const selectedSpecies = ATLAS_SPECIES.find(species => species.id === selectedId) ?? ATLAS_SPECIES[0]
  const diverPose = mergedDiverPoseForSpecies(selectedSpecies, storedDiverPoses[selectedSpecies?.id])
  const biome = BIOME_BY_ID.get(selectedSpecies?.biome)
  const atlasDetails = selectedSpecies?.atlasDetails ?? {}
  const resetDebugTaps = () => {
    debugTapCount.current = 0
    if (!debugTapTimer.current) return
    window.clearTimeout(debugTapTimer.current)
    debugTapTimer.current = null
  }

  useEffect(() => {
    const togglePoseEditor = () => setPoseEditorOpen(current => !current)
    const togglePoseEditorFromShortcut = (event) => {
      if (!event.ctrlKey || !event.shiftKey || event.key.toLowerCase() !== 'd') return
      event.preventDefault()
      togglePoseEditor()
    }

    window.addEventListener(ATLAS_DEBUG_TOGGLE_EVENT, togglePoseEditor)
    window.addEventListener('keydown', togglePoseEditorFromShortcut)
    return () => {
      window.removeEventListener(ATLAS_DEBUG_TOGGLE_EVENT, togglePoseEditor)
      window.removeEventListener('keydown', togglePoseEditorFromShortcut)
    }
  }, [])


  useEffect(() => {
    const page = pageRef.current
    if (!page) return undefined

    const touchState = { startY: 0, startScrollTop: 0 }
    const isPortraitMobileAtlas = () => window.matchMedia('(max-width: 880px) and (orientation: portrait)').matches

    const handleTouchStart = (event) => {
      if (!isPortraitMobileAtlas() || event.touches.length !== 1) return
      touchState.startY = event.touches[0].clientY
      touchState.startScrollTop = page.scrollTop
    }

    const handleTouchMove = (event) => {
      if (!isPortraitMobileAtlas() || event.touches.length !== 1) return
      const deltaY = touchState.startY - event.touches[0].clientY
      if (Math.abs(deltaY) < 2) return

      const maxScrollTop = Math.max(0, page.scrollHeight - page.clientHeight)
      if (maxScrollTop <= 0) return

      page.scrollTop = Math.min(maxScrollTop, Math.max(0, touchState.startScrollTop + deltaY))
      event.preventDefault()
    }

    page.addEventListener('touchstart', handleTouchStart, { passive: true })
    page.addEventListener('touchmove', handleTouchMove, { passive: false })

    return () => {
      page.removeEventListener('touchstart', handleTouchStart)
      page.removeEventListener('touchmove', handleTouchMove)
    }
  }, [])

  const updateDiverPose = (nextPose) => {
    const speciesId = selectedSpecies?.id
    if (!speciesId) return
    setStoredDiverPoses(current => {
      const basePose = baseDiverPoseForSpecies(selectedSpecies)
      const normalizedPose = normalizeDiverPose(nextPose, basePose)
      normalizedPose.position[2] = basePose.position[2]
      const next = { ...current, [speciesId]: normalizedPose }
      saveStoredDiverPoses(next)
      return next
    })
  }

  const resetDiverPose = () => {
    const speciesId = selectedSpecies?.id
    if (!speciesId) return
    setStoredDiverPoses(current => {
      const next = { ...current }
      delete next[speciesId]
      saveStoredDiverPoses(next)
      return next
    })
  }

  const handleVersionTap = (event) => {
    event.preventDefault()
    event.stopPropagation()

    if (debugTapTimer.current) {
      window.clearTimeout(debugTapTimer.current)
    }

    debugTapCount.current += 1

    if (debugTapCount.current >= ATLAS_DEBUG_REQUIRED_TAPS) {
      resetDebugTaps()
      setPoseEditorOpen(current => !current)
      return
    }

    debugTapTimer.current = window.setTimeout(resetDebugTaps, ATLAS_DEBUG_TAP_WINDOW_MS)
  }

  return (
    <section ref={pageRef} className="encyclopedia-page" aria-label="THE ATLAS">
      <div className="encyclopedia-topbar">
        <div>
          <h1>THE ATLAS</h1>
        </div>
        <div className="encyclopedia-topbar-actions">
          <button
            className={`atlas-version-label${poseEditorOpen ? ' is-active' : ''}`}
            type="button"
            onPointerUp={handleVersionTap}
            onContextMenu={(event) => event.preventDefault()}
            aria-label="Tap three times to toggle Atlas diver pose editor"
            aria-pressed={poseEditorOpen}
            title="Tap three times or press Ctrl+Shift+D to toggle diver pose editor"
          >
            {APP_VERSION_SHORT_LABEL}
          </button>
          <button className="encyclopedia-close" type="button" onClick={onClose} aria-label="Close encyclopaedia">
            <svg aria-hidden="true" viewBox="0 0 24 24" focusable="false">
              <path d="M7 7l10 10M17 7L7 17" />
            </svg>
          </button>
        </div>
      </div>

      <aside className="encyclopedia-species-list" aria-label="Species list">
        {ATLAS_SPECIES.map((species, index) => (
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
        <SpeciesModel species={selectedSpecies} diverPoseOverride={diverPose} />
        {poseEditorOpen && (
          <AtlasDiverPoseEditor
            species={selectedSpecies}
            pose={diverPose}
            onPoseChange={updateDiverPose}
            onReset={resetDiverPose}
          />
        )}
      </main>

      <aside className="encyclopedia-info-panel" aria-label={`${selectedSpecies.name} information`}>
        <p className="encyclopedia-panel-kicker">{selectedSpecies.family ?? 'Oceanarium species'}</p>
        <h2>{selectedSpecies.name}</h2>
        {selectedSpecies.scientificName && <p className="encyclopedia-scientific">{selectedSpecies.scientificName}</p>}
        <ConservationStatusBar status={selectedSpecies.conservationStatus} />
        <AtlasQuickCards
          diet={atlasDetails.commonDiet}
          biome={biome?.name ?? selectedSpecies.biome}
          location={atlasDetails.foundIn}
        />
        <p className="encyclopedia-description">{selectedSpecies.description ?? 'Species notes coming soon.'}</p>
        <div className="atlas-table-stack">
          <AtlasTableSection
            title="Social"
            rows={[
              { label: 'School size', value: formatOffspring(atlasDetails.social?.schoolSize) },
              { label: 'Grouping behaviour', value: unknownIfEmpty(atlasDetails.social?.groupingBehaviour) },
              { label: 'Reproduction', value: unknownIfEmpty(atlasDetails.social?.reproduction) },
            ]}
          />
          <AtlasTableSection
            title="Averages"
            rows={[
              { label: 'Size', value: <SexPair male={atlasDetails.averages?.maleSizeMeters} female={atlasDetails.averages?.femaleSizeMeters} formatter={formatSexLength} /> },
              { label: 'Weight', value: <SexPair male={atlasDetails.averages?.maleWeightKg} female={atlasDetails.averages?.femaleWeightKg} formatter={formatWeight} /> },
              { label: 'Life expectancy', value: <SexPair male={atlasDetails.averages?.maleLifeExpectancyYears} female={atlasDetails.averages?.femaleLifeExpectancyYears} formatter={formatYears} /> },
            ]}
          />
          <AtlasTableSection
            title="Lifecycle"
            rows={[
              { label: 'Age of sexual maturity', value: formatYears(atlasDetails.lifecycle?.sexualMaturityYears) },
              { label: 'Age of sexual sterility', value: formatYears(atlasDetails.lifecycle?.sexualSterilityYears) },
              { label: 'No. of offspring/eggs per mating event', value: formatOffspring(atlasDetails.lifecycle?.offspringPerMatingEvent) },
            ]}
          />
        </div>
      </aside>
    </section>
  )
}
