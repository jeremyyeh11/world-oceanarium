import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { useEnvironmentGLTF as useGLTF, useEnvironmentSourceLease } from '../hooks/useEnvironmentLoading'
import * as THREE from 'three'
import { clone } from 'three/examples/jsm/utils/SkeletonUtils.js'
import { BIOMES, SPECIES, WORLD_UNIT_METERS } from '../data/species'
import { APP_VERSION_SHORT_LABEL } from '../version'
import { speciesForLifeStage, speciesForSex } from '../utils/speciesLookup'
import { addSwayAttributes, applyCoralSway, useSwayClock } from '../utils/coralSway'
import Environment from './Environment'
import OceanBubbles from './OceanBubbles'
import SceneLighting from './SceneLighting'
import UnderwaterFX from './UnderwaterFX'
import WaterSurface from './WaterSurface'
import {
  prepareProceduralFinFollow,
  prepareProceduralVertexMaterials,
  updateProceduralFinFollow,
  updateProceduralVertexMaterials,
} from './Fish'

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
// Listed alphabetically by scientific name (Jeremy, 2026-10-16), so a new species slots in by
// name rather than at the end. The Nº shown is its place in this list.
const ATLAS_SPECIES = SPECIES
  .filter(species => !species.hiddenInAtlas)
  .sort((a, b) => a.scientificName.localeCompare(b.scientificName))

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
//
// Framing (Jeremy's review, 2026-09-28: "make the fish bigger"): each hero fills roughly 55-67% of
// a desktop stage's width (the Mola, being tall, 74% of its height). The camera moved in rather
// than the model growing, so the sardinella's and mahi's companions keep their places around it.
// A portrait phone's stage is ~360 px wide, so each species sets its own phone zoom
// (portraitPhoneDistanceScale, a multiple of cameraDistance) to fill about 85% of it.
const VIEW_POSES_BY_SPECIES = {
  // The table coral cluster (a small bommie crowned with tables), front on and
  // turned a little, looking 30° down onto it as in Jeremy's photo (2026-10-19: "camera angled
  // a bit down from above").
  'acropora-hyacinthus': {
    yawOffset: -0.4,
    pitchDegrees: 30,
    // Looking down this steeply puts the camera high: the model is shown smaller and the camera
    // closer than for a fish, so on every viewport (phones pull back up to 1.12×) it stays well
    // under the water surface at y 4.6. Above it, the stage turns into a flat blue silhouette.
    maxLengthDisplayUnits: 2.7,
    cameraDistance: 6.4,
    // Wider than tall, so phones zoom in less than for a fish.
    portraitPhoneDistanceScale: 1.12,
    mobileDistanceScale: 0.95,
    position: [0, -0.1, 0],
    lookAt: [0, -0.1, 0],
  },
  // The staghorn thicket round its low rock, framed like the table coral cluster: front on,
  // turned a little, looking 30° down.
  'acropora-muricata': {
    yawOffset: -0.25,
    pitchDegrees: 30,
    maxLengthDisplayUnits: 2.7,
    cameraDistance: 6.4,
    portraitPhoneDistanceScale: 1.12,
    mobileDistanceScale: 0.95,
    position: [0, -0.1, 0],
    lookAt: [0, -0.1, 0],
  },
  // Three sea fans growing from a low rock (the model's origin is the rock's foot): the orange
  // in the middle, the yellow and pink leaning out to the left and right (Jeremy's sketch,
  // 2026-10-26). Nearly face on so the lattices read, turned a little so they show they are flat
  // sheets; lowered so the group sits in the middle of the stage.
  'annella-mollis': {
    yawOffset: -0.35,
    pitchDegrees: 8,
    maxLengthDisplayUnits: 2.6,
    cameraDistance: 6.4,
    portraitPhoneDistanceScale: 1.05,
    mobileDistanceScale: 0.95,
    position: [0, -1.05, 0],
    lookAt: [0, -0.05, 0],
  },
  'amblygaster-sirm': {
    maxLengthDisplayUnits: 1.35,
    portraitPhoneDistanceScale: 0.68,
    cameraDistance: 4.85,
    position: [0, -0.02, 0],
    lookAt: [0, -0.02, 0],
  },
  'coryphaena-hippurus': {
    maxLengthDisplayUnits: 2.8,
    cameraDistance: 6.85,
    portraitPhoneDistanceScale: 0.95,
    position: [0, -0.02, 0],
    lookAt: [0, -0.02, 0],
  },
  'mola-alexandrini': {
    yawOffset: Math.PI / 2 + ATLAS_CREATURE_DIAGONAL_YAW_RADIANS,
    cameraDistance: 8.5,
    portraitPhoneDistanceScale: 0.87,
    // Tall: on a tablet's wide, short stage its fins would run off the top and bottom.
    mobileDistanceScale: 0.82,
    fov: 34,
    maxLengthDisplayUnits: 4.1,
    position: [0, -0.55, 0],
    lookAt: [0, -0.3, 0],
  },
  'isurus-oxyrinchus': {
    cameraDistance: 8.9,
    portraitPhoneDistanceScale: 1.0,
    fov: 34,
    maxLengthDisplayUnits: 4.45,
    // Shift hero left in-frame so the tail clears the right stage edge: the model's origin sits
    // near its gills, with the tail trailing far behind, so centring the origin puts the shark
    // right of centre.
    position: [-0.63, -0.12, 0],
    lookAt: [0, -0.08, 0],
  },
  // Remoras: slender bodies, framed between the sardinella (0.27 m) and the mahi (2.1 m).
  // Framed about six grid squares long on a desktop stage (Jeremy's review, 2026-09-28). A phone
  // cannot fit six 112 px squares, so there the camera stays further back than the usual 0.6 and
  // the fish fills about 85% of the stage's width.
  'echeneis-naucrates': { maxLengthDisplayUnits: 3.7, portraitPhoneDistanceScale: 0.9 },
  'echeneis-neucratoides': { maxLengthDisplayUnits: 1.85 },
  // Pilot fish: 0.7 m, framed a touch shorter than the 0.75 m whitefin sharksucker.
  'naucrates-ductor': { maxLengthDisplayUnits: 1.75 },
  // Longfin bannerfish: 0.25 m, the sardinella's size and camera. Its banner trails another 0.6
  // body lengths behind the tail, so the fish sits left of centre to keep the banner on stage.
  // Shown as a pair: the camera stands back a little and looks between the two.
  'heniochus-acuminatus': {
    maxLengthDisplayUnits: 1.1,
    portraitPhoneDistanceScale: 0.98,
    cameraDistance: 5.6,
    position: [-0.45, -0.12, 0],
    lookAt: [0.15, 0.22, 0],
  },
  // Raccoon butterflyfish: 0.2 m, deep-bodied, shown with five of its group (see
  // ATLAS_COMPANIONS_BY_SPECIES); the camera looks between them.
  'chaetodon-lunula': {
    maxLengthDisplayUnits: 0.95,
    portraitPhoneDistanceScale: 0.9,
    cameraDistance: 5.6,
    position: [-0.45, -0.1, 0],
    lookAt: [0.15, 0.2, 0],
  },
  // Emperor angelfish: 0.4 m, between the bannerfish and the pilot fish, and deep-bodied.
  // Shown as a pair (see ATLAS_COMPANIONS_BY_SPECIES): the main fish sits left of centre and the
  // camera looks between the two. On a phone the camera stays back far enough for both.
  'pomacanthus-imperator': {
    maxLengthDisplayUnits: 1.7,
    portraitPhoneDistanceScale: 0.66,
    position: [-0.45, -0.1, 0],
    lookAt: [0, 0.2, 0],
  },
  // Humphead wrasse: deep-bodied and long-finned, framed a touch longer than the grouper's
  // fallback (3.2) on the default camera. Shown with a female (see ATLAS_COMPANIONS_BY_SPECIES):
  // the male sits a little left and up, and the camera looks between the two.
  'crassilabrus-undulatus': {
    maxLengthDisplayUnits: 3.1,
    portraitPhoneDistanceScale: 0.95,
    position: [-0.2, 0.35, 0],
    lookAt: [-0.35, -0.2, 0],
  },
  // Whale shark: framed by the mako's camera. Its origin is mid-length and the diagonal yaw brings
  // the broad head toward the camera, so it is shorter on stage than the mako (4.45) and shifted
  // a little right to keep the head in frame.
  'rhincodon-typus': {
    cameraDistance: 8.9,
    portraitPhoneDistanceScale: 1.0,
    fov: 34,
    maxLengthDisplayUnits: 3.9,
    position: [0.3, -0.1, 0],
    lookAt: [0, -0.08, 0],
  },
  // Munk's devil ray: a flat, wide flier, so the camera looks down onto the disc rather than
  // along its edge, on the usual diagonal. Without a pose it fell back to the tank scale (5.2
  // units across) and filled a phone's stage (Jeremy, 2026-10-24: "too big in atlas"). Wider
  // than long, so phones pull back instead of moving in. The camera stays under the water
  // surface (y 4.6) on every viewport: at the default 9.2 a 30° look down put it above, and the
  // stage turned into a flat silhouette.
  'mobula-munkiana': {
    pitchDegrees: 30,
    cameraDistance: 6.8,
    maxLengthDisplayUnits: 2.9,
    portraitPhoneDistanceScale: 0.95,
    mobileDistanceScale: 0.9,
    // Left of centre so the whip tail, trailing to the right, stays on a phone's stage.
    position: [-0.35, -0.1, 0],
    lookAt: [0, -0.1, 0],
  },
  // Giant oceanic manta: the devil ray's framing. Its disc is 1.3 times as wide as it is long
  // nose to tail, so the length shown is shorter to give the same width on stage.
  'mobula-birostris': {
    pitchDegrees: 30,
    cameraDistance: 6.8,
    maxLengthDisplayUnits: 2.3,
    portraitPhoneDistanceScale: 0.95,
    mobileDistanceScale: 0.9,
    position: [-0.25, -0.1, 0],
    lookAt: [0, -0.1, 0],
  },
}

const MODEL_SOURCE_LENGTH_UNITS_BY_SPECIES = {
  'amblygaster-sirm': 1.8223,
  'coryphaena-hippurus': 9.788,
  'mola-alexandrini': 20.7909,
  'isurus-oxyrinchus': 40.1835,
  // Supplied model (scripts/fit-rider-model.mjs prints this).
  'echeneis-naucrates': 6.6014,
  // Supplied Whitefin Sharksucker model (scripts/fit-rider-model.mjs).
  'echeneis-neucratoides': 5.4912,
  // Supplied pilot fish model, nose to tail tip along Z.
  'naucrates-ductor': 7.3672,
  // Supplied bannerfish model, nose to tail tip along Z (banner excluded).
  'heniochus-acuminatus': 0.3199,
  // Supplied raccoon butterflyfish model, nose to tail tip along Z.
  'chaetodon-lunula': 0.2003,
  // Supplied emperor angelfish model, nose to tail tip along Z.
  'pomacanthus-imperator': 0.4002,
  // Supplied whale shark model, nose to tail tip along Z.
  'rhincodon-typus': 99.8702,
  // Supplied humphead wrasse model, nose to tail tip along Z.
  'crassilabrus-undulatus': 20.1981,
  // Supplied devil ray model (scripts/paint-disc-wave-masks.py), nose to tail tip along Z; the
  // disc is 1.3 across.
  'mobula-munkiana': 1.5228,
  // Supplied manta model (scripts/paint-disc-wave-masks.py), nose to tail tip along Z; the disc
  // is 7 across.
  'mobula-birostris': 5.4073,
  // The table coral cluster, widest across (scripts/build-coral-atlas.py prints its bounds).
  'acropora-hyacinthus': 5.013,
  // The staghorn thicket, widest across (scripts/build-staghorn-atlas.py prints its bounds).
  'acropora-muricata': 3.157,
  // The three fans on their rock, widest across (scripts/build-sea-fan-atlas.py prints the bounds).
  'annella-mollis': 1.711,
}

const ATLAS_HERO_ANIMATION_BY_SPECIES = {
  'amblygaster-sirm': { animationOffset: 0.45, animationSpeed: 0.97, burstDelay: 4.9 },
  'coryphaena-hippurus': { animationOffset: 0.8, animationSpeed: 1.03, burstDelay: 5.4 },
  'isurus-oxyrinchus': { animationOffset: 0.35, animationSpeed: 0.92, burstDelay: 6.8 },
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
  // Pair-bonded species show their mate, as in the tank: a little behind, beside, and above
  // the main fish (which faces left, so behind is to the right), slightly smaller and out of
  // step with it.
  'heniochus-acuminatus': [
    { position: [0.5, 0.62, -0.9], scale: 0.9, yaw: 0.08, animationOffset: 1.9, animationSpeed: 0.94, burstDelay: 7.4 },
  ],
  // A group-living species shows a few of its group round the main fish, at different depths
  // and slightly different headings, out of step with each other.
  'chaetodon-lunula': [
    { position: [0.55, 0.6, -0.9], scale: 0.92, yaw: 0.08, animationOffset: 1.9, animationSpeed: 0.94, burstDelay: 7.4 },
    { position: [0.85, -0.5, -1.4], scale: 0.85, yaw: 0.14, animationOffset: 3.3, animationSpeed: 1.07, burstDelay: 6.1 },
    { position: [-0.15, 1.05, -2.2], scale: 0.8, yaw: -0.06, animationOffset: 0.6, animationSpeed: 1.02, burstDelay: 8.2 },
    { position: [1.45, 0.35, -2.6], scale: 0.88, yaw: 0.2, animationOffset: 4.4, animationSpeed: 0.9, burstDelay: 6.8 },
    { position: [0.3, -1.05, -2.4], scale: 0.82, yaw: 0.04, animationOffset: 2.6, animationSpeed: 1.1, burstDelay: 7.9 },
  ],
  // The angelfish pair, plus two juveniles (`lifeStage`, their own model) at true size against
  // a 40 cm adult: `scale` is the juvenile's length as a share of the species' 40 cm.
  'pomacanthus-imperator': [
    { position: [0.5, 0.55, -1.0], scale: 0.9, yaw: 0.08, animationOffset: 1.9, animationSpeed: 0.94, burstDelay: 7.4 },
    { lifeStage: 'juvenile', position: [0.35, -0.55, 0.45], scale: 0.32, yaw: -0.12, animationOffset: 0.7, animationSpeed: 1.12 },
    { lifeStage: 'juvenile', position: [1.05, -0.2, -0.35], scale: 0.27, yaw: 0.18, animationOffset: 2.6, animationSpeed: 1.06 },
  ],
  // The male with a female (`sex`, her own model), below and behind him: `scale` is the ratio of
  // the sexes' average lengths (0.75 m to 1.0 m, Choat et al. 2006).
  'crassilabrus-undulatus': [
    { sex: 'female', position: [0.7, -1.05, -1.5], scale: 0.75, yaw: 0.1, animationOffset: 1.9, animationSpeed: 0.94, burstDelay: 7.4 },
  ],
}

function viewPoseForSpecies(species) {
  return { ...DEFAULT_VIEW_POSE, ...(VIEW_POSES_BY_SPECIES[species?.id] ?? {}) }
}

function atlasCameraPosition(pose) {
  const distance = pose.cameraDistance ?? pose.cameraPosition?.[2] ?? 9.2
  const yaw = THREE.MathUtils.degToRad(ATLAS_CAMERA_YAW_DEGREES)
  // A pose can look further down than the usual 15° (`pitchDegrees`), as the coral does.
  const pitch = THREE.MathUtils.degToRad(pose.pitchDegrees ?? ATLAS_CAMERA_PITCH_DEGREES)
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
    return baseDistance * (pose.portraitPhoneDistanceScale ?? 0.6)
  }

  return baseDistance * (pose.mobileDistanceScale ?? 0.68)
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

// Dex entries are 1-based and zero-padded to three digits — the padding is what
// makes the number read as a catalogue index rather than a count.
function dexNumber(index) {
  return String(index + 1).padStart(3, '0')
}

// Stage readout keeps centimetres below a metre and up to two decimals for
// precise sub-10-metre maxima such as the 4.45 m Shortfin Mako figure.
function formatStageLength(meters) {
  if (!Number.isFinite(meters) || meters <= 0) return null
  if (meters < 1) return `${Math.round(meters * 100)} cm`
  if (meters < 10) return `${Number(meters.toFixed(2))} m`
  return `${Math.round(meters)} m`
}

// The human reference is an exact constant rather than an estimated body
// length, so it keeps whatever precision it was defined with. It uses its own
// formatter so the stated 1.65m reference stays 1.65m even if the specimen
// formatter's precision rules change.
function formatReferenceLength(meters) {
  return `${Number(meters.toFixed(2))} m`
}

/**
 * Scale reference for the specimen stage.
 *
 * Replaces the in-scene diver sprite, which had to share the 3D space with the
 * specimen and so was only legible at some sizes: against a 27cm sardinella a
 * 1.7m diver cropped to a shapeless mass filling the frame. Two proportional
 * bars carry the same comparison and stay readable at every size, because the
 * longer subject always fills the track and the shorter one is measured
 * against it — a 27cm fish next to a diver reads as a sliver, which is the
 * honest answer.
 */
function AtlasScaleBar({ species }) {
  const speciesMeters = speciesLengthMeters(species)
  const measurementLabel = species?.atlasDetails?.maxLengthLabel
  const usesDiscWidth = measurementLabel === 'Disc width'
  const speciesLabel = usesDiscWidth ? 'Specimen' : measurementLabel ?? 'Specimen'
  if (!Number.isFinite(speciesMeters) || speciesMeters <= 0) return null

  const longest = Math.max(HUMAN_SCALE_METERS, speciesMeters)
  // Floor the rendered width so a very small specimen still shows a visible
  // stub rather than vanishing into the track.
  const widthFor = (meters) => `${Math.max(3, (meters / longest) * 100)}%`

  return (
    <div className="atlas-stage-readout" aria-label="Scale reference">
      <span className="atlas-stage-readout-tag">Scale</span>
      <div className="atlas-scale-row">
        <span className="atlas-scale-label">Typical human</span>
        <span className="atlas-scale-track">
          <span className="atlas-scale-fill is-human" style={{ width: widthFor(HUMAN_SCALE_METERS) }} />
        </span>
        <b className="atlas-scale-value">{formatReferenceLength(HUMAN_SCALE_METERS)}</b>
      </div>
      <div className="atlas-scale-row">
        <span className="atlas-scale-label">{speciesLabel}</span>
        <span className="atlas-scale-track">
          <span className="atlas-scale-fill is-specimen" style={{ width: widthFor(speciesMeters) }} />
        </span>
        <b className="atlas-scale-value">{formatStageLength(speciesMeters)}{usesDiscWidth ? ' (disc width)' : ''}</b>
      </div>
    </div>
  )
}

function AtlasTableSection({ title, rows }) {
  return (
    <section className="atlas-table-section" aria-label={title}>
      <h3 className="atlas-section-tag">{title}</h3>
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

function prepareAtlasModelScene(sourceScene, alphaTest = null, alphaBlend = false, doubleSided = false) {
  const scene = clone(sourceScene)
  scene.traverse(object => {
    if (!object.isMesh) return
    const sanitizeMaterial = material => {
      if (!material) return material
      const nextMaterial = material.clone()
      // Opaque, but a model can opt into keeping its alpha-blended materials (fins) see-through
      // with `model.alphaBlend` and cutting them at `model.alphaTest`, the same as in the tank.
      const blendsAlpha = alphaBlend && material.transparent
      if (alphaTest != null && material.transparent) nextMaterial.alphaTest = alphaTest
      nextMaterial.transparent = blendsAlpha
      nextMaterial.opacity = 1
      nextMaterial.depthWrite = !blendsAlpha
      nextMaterial.depthTest = true
      // Two-sided for a model that is a single sheet in places (a sea fan's lattice: `model.doubleSided`).
      nextMaterial.side = doubleSided ? THREE.DoubleSide : THREE.FrontSide
      // A lattice cut out by its texture's alpha: smoothed at the cut edges, as in the tank.
      nextMaterial.alphaToCoverage = doubleSided && nextMaterial.alphaTest > 0
      nextMaterial.needsUpdate = true
      return nextMaterial
    }
    object.material = Array.isArray(object.material)
      ? object.material.map(sanitizeMaterial)
      : sanitizeMaterial(object.material)
  })
  return scene
}

// A soft coral specimen swaying as it does in the tank (`model.sway`, utils/coralSway.js): each
// coral mesh's origin is its holdfast and its lattice faces +Z, so it swings along Z, its rim the
// most. Meshes under a node named `rock…` (the specimen's base rock) stay still. Each coral mesh
// gets its own copy of its geometry with the sway baked in.
function prepareAtlasSway(scene, sway) {
  if (!sway) return
  const meshes = []
  const onRock = object => object && (object.name.startsWith('rock') || onRock(object.parent))
  scene.traverse(object => { if (object.isMesh && !onRock(object)) meshes.push(object) })
  let height = 0
  let reach = 0
  for (const mesh of meshes) {
    const position = mesh.geometry.attributes.position
    for (let i = 0; i < position.count; i++) {
      height = Math.max(height, position.getY(i))
      reach = Math.max(reach, Math.hypot(position.getX(i), position.getY(i), position.getZ(i)))
    }
  }
  const origin = new THREE.Vector3()
  const direction = new THREE.Vector3(0, 0, 1)
  for (const mesh of meshes) {
    mesh.geometry = addSwayAttributes(mesh.geometry.clone(), { origin, direction, amplitude: sway.bend * height, reach, phase: 0 })
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
    materials.forEach(material => applyCoralSway(material, sway))
  }
}

function ModelAsset({ species, adultSpecies = species, pose, companion = null }) {
  const modelPath = species?.model?.path
  const gltf = useGLTF(modelPath)
  const alphaTest = species?.model?.alphaTest ?? null
  const alphaBlend = species?.model?.alphaBlend === true
  const doubleSided = species?.model?.doubleSided === true
  const sway = species?.model?.sway ?? null
  const scene = useMemo(() => {
    const prepared = prepareAtlasModelScene(gltf.scene, alphaTest, alphaBlend, doubleSided)
    prepareAtlasSway(prepared, sway)
    return prepared
  }, [gltf.scene, alphaTest, alphaBlend, doubleSided, sway])
  useSwayClock()
  const proceduralAnimation = species?.model?.proceduralAnimation ?? null
  const proceduralMaterials = useMemo(
    () => prepareProceduralVertexMaterials(scene, proceduralAnimation),
    [scene, proceduralAnimation],
  )
  const proceduralFinFollow = useMemo(
    () => prepareProceduralFinFollow(scene, proceduralAnimation),
    [scene, proceduralAnimation],
  )
  const mixerRef = useRef(null)
  const actionsRef = useRef({ idle: null, burst: null })
  const burstDueAtRef = useRef(0)
  const animationProfile = companion ?? ATLAS_HERO_ANIMATION_BY_SPECIES[species?.id] ?? null
  const animationOffset = animationProfile?.animationOffset ?? 0
  const animationSpeed = animationProfile?.animationSpeed ?? 1
  const openingBurstDelay = animationProfile?.burstDelay ?? 3.8
  // The pose frames the adult model. A life stage's model maps its own source length to the same
  // tank length (its `model.scale`), so it takes the adult's framing times the ratio of scales.
  const stageScale = (species?.model?.scale ?? 1) / (adultSpecies?.model?.scale ?? 1)
  const viewerScale = atlasModelScaleForSpecies(adultSpecies, pose) * stageScale * (companion?.scale ?? 1)
  const sourceRotation = species?.model?.rotation ?? [0, 0, 0]
  const yaw = pose.yawOffset + (companion?.yaw ?? 0)
  const position = companion?.position ?? pose.position
  // `model.position` recentres a model whose origin is off its body (in tank WU, so divide by
  // the tank scale to get source units); the tank applies it outside the model's rotation.
  const sourceOffset = useMemo(() => {
    const offset = species?.model?.position
    const tankScale = species?.model?.scale ?? 1
    return offset ? offset.map(value => value / tankScale) : [0, 0, 0]
  }, [species])

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
    if (proceduralAnimation) {
      // Atlas is an in-place gallery pose, but its static specimens should still
      // breathe through the same species-shaped procedural material as the tank.
      const phase = (_.clock.getElapsedTime() * (proceduralAnimation.waveSpeed ?? 1) + animationOffset) * animationSpeed
      updateProceduralVertexMaterials(proceduralMaterials, {
        phase,
        speed01: 0.42,
      })
      updateProceduralFinFollow(proceduralFinFollow, proceduralAnimation, { phase, speed01: 0.42 })
      return
    }
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

  return (
    <group rotation={[0, yaw, 0]} scale={viewerScale} position={position}>
      <group position={sourceOffset}>
        <primitive object={scene} rotation={sourceRotation} />
      </group>
    </group>
  )
}

// Reference height for the stage scale bar: the global sex-averaged mean adult
// height, sitting between the means for men (~171cm) and women (~160cm) in the
// NCD Risk Factor Collaboration's pooled analysis of 1,472 studies (eLife,
// 2016). 1.7 would be effectively the male mean alone.
//
// This was briefly rounded to 1.7 because Pixelify Sans rendered "1.65 M" as
// "1.6S M". Moving small type to Jersey 15 removed that constraint — measured
// at the 12.96px this readout uses, its 5/S shapes overlap 53% against
// Pixelify's 75% — so the accurate figure is back.
const HUMAN_SCALE_METERS = 1.65

function SpeciesModel({ species }) {
  const pose = viewPoseForSpecies(species)
  const cameraPosition = atlasCameraPosition(pose)
  const companions = ATLAS_COMPANIONS_BY_SPECIES[species?.id] ?? []
  // Lease outside the suspending Canvas subtree: a slow/abandoned model render must
  // not leave source lifetime dependent on the brief read-to-commit grace window.
  useEnvironmentSourceLease('gltf', [...new Set([species?.model?.path,
    ...companions.map(companion => speciesForSex(speciesForLifeStage(species, companion.lifeStage), companion.sex)?.model?.path),
  ].filter(Boolean))])

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
      {/* No stand-in while a model loads: the stage stays empty until the real one is in. */}
      <Suspense fallback={null}>
        {species?.model?.path && (
          <>
            {companions.map((companion, index) => (
              <ModelAsset
                key={`${species.id}-atlas-companion-${index}`}
                species={speciesForSex(speciesForLifeStage(species, companion.lifeStage), companion.sex)}
                adultSpecies={species}
                pose={pose}
                companion={companion}
              />
            ))}
            <ModelAsset species={species} pose={pose} />
          </>
        )}
      </Suspense>
    </Canvas>
  )
}

function SpeciesThumbnail({ species, index }) {
  const initials = species.name.split(/\s+/).map(part => part[0]).join('').slice(0, 2).toUpperCase()
  return (
    <div className="encyclopedia-species-thumb" style={{ background: THUMBNAIL_GRADIENTS[index % THUMBNAIL_GRADIENTS.length] }}>
      {species.atlasThumbnail
        // The tiles are wider than tall (64 x 46 on a phone), so they show a band of the image;
        // `atlasThumbnailPosition` picks which band, to frame the fish.
        ? <img src={species.atlasThumbnail} alt="" loading="lazy" style={species.atlasThumbnailPosition ? { objectPosition: species.atlasThumbnailPosition } : undefined} />
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

export default function EncyclopediaPage({ initialSpeciesId, mobileListFirst = false, onClose }) {
  const [selectedId, setSelectedId] = useState(() => {
    if (ATLAS_SPECIES.some(species => species.id === initialSpeciesId)) return initialSpeciesId
    return ATLAS_SPECIES[0]?.id
  })
  const [mobileView, setMobileView] = useState(() => (mobileListFirst ? 'list' : 'detail'))
  const pageRef = useRef(null)
  const selectedIndex = Math.max(0, ATLAS_SPECIES.findIndex(species => species.id === selectedId))
  const selectedSpecies = ATLAS_SPECIES[selectedIndex]
  const biome = BIOME_BY_ID.get(selectedSpecies?.biome)
  const atlasDetails = selectedSpecies?.atlasDetails ?? {}
  const showingMobileList = mobileListFirst && mobileView === 'list'

  const selectSpecies = (speciesId) => {
    setSelectedId(speciesId)
    if (mobileListFirst) setMobileView('detail')
  }

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



  return (
    <section ref={pageRef} className={`encyclopedia-page${showingMobileList ? ' is-mobile-list-view' : ''}`} aria-label="THE ATLAS">
      <div className="encyclopedia-topbar">
        <div className="encyclopedia-topbar-title">
          {mobileListFirst && !showingMobileList && (
            <button className="atlas-mobile-back" type="button" onClick={() => setMobileView('list')}>
              ← Species
            </button>
          )}
          <h1>THE ATLAS</h1>
        </div>
        <div className="encyclopedia-topbar-actions">
          <span className="atlas-version-label">{APP_VERSION_SHORT_LABEL}</span>
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
            onClick={() => selectSpecies(species.id)}
          >
            <SpeciesThumbnail species={species} index={index} />
            <span>
              <span className="atlas-dex-no">№ {dexNumber(index)}</span>
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
        {/* Purely decorative dex framing: L-brackets on the two chamfered
            corners, plus the specimen readout chip. */}
        <div className="atlas-stage-frame" aria-hidden="true" />
        <div className="atlas-stage-chip" aria-hidden="true">
          <span>Specimen</span>
          <b>№ {dexNumber(selectedIndex)}</b>
        </div>
        <AtlasScaleBar species={selectedSpecies} />
      </main>

      <aside className="encyclopedia-info-panel" aria-label={`${selectedSpecies.name} information`}>
        <div className="atlas-dex-head">
          <span className="atlas-dex-no atlas-dex-no--lg">№ {dexNumber(selectedIndex)}</span>
          <p className="encyclopedia-panel-kicker">{selectedSpecies.family ?? 'Oceanarium species'}</p>
        </div>
        <h2>{selectedSpecies.name}</h2>
        {selectedSpecies.scientificName && <p className="encyclopedia-scientific">{selectedSpecies.scientificName}</p>}
        <ConservationStatusBar status={selectedSpecies.conservationStatus} />
        <AtlasQuickCards
          diet={atlasDetails.commonDiet}
          // A species whose home is not its tank's biome (the reef bannerfish, kept in the open
          // ocean) names its real one in `atlasDetails.biome`.
          biome={atlasDetails.biome ?? biome?.name ?? selectedSpecies.biome}
          location={atlasDetails.foundIn}
        />
        <section className="atlas-table-section" aria-label="Biology">
          <h3 className="atlas-section-tag">Biology</h3>
          <p className="encyclopedia-description">{selectedSpecies.description ?? 'Species notes coming soon.'}</p>
        </section>
        <div className="atlas-table-stack">
          <AtlasTableSection
            title="Social"
            rows={[
              { label: 'Sexual dimorphism', value: unknownIfEmpty(atlasDetails.sexualDimorphism) },
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
