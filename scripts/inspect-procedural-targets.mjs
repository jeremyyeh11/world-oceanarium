import fs from 'node:fs'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { SPECIES } from '../src/data/species.js'

globalThis.self = globalThis
globalThis.createImageBitmap = async () => ({ close() {} })

const targets = [
  {
    name: 'Yellowfin Tuna static body',
    path: 'public/models/fish/thunnus-albacares/thunnus-albacares.glb',
    staticMesh: true,
    bodyMeshNames: ['thunnus_albacares'],
    sourceAxis: 'z',
    minBodyLength: 2.398,
    minVertices: 3200,
  },
  {
    name: 'Bluespine Unicornfish static parts',
    path: 'public/models/fish/naso-unicornis/naso-unicornis.glb',
    staticMesh: true,
    bodyMeshNames: ['naso_unicornis'],
    requiredFinMeshes: ['pectorall', 'pectoralr', 'pelvicl', 'pelvicr'],
    sourceAxis: 'z',
    minBodyLength: 59.8,
    minVertices: 4400,
  },
  {
    name: 'Sardinella static',
    path: 'public/models/fish/sardine/sardine_static.glb',
    staticMesh: true,
    bodyMeshNames: ['sardine'],
    sourceAxis: 'x',
    minBodyLength: 1,
    minVertices: 500,
  },
  {
    name: 'Mahi-mahi male static parts',
    path: 'public/models/fish/mahi-mahi/mahi-mahi_male_static_parts.glb',
    staticMesh: true,
    bodyMeshNames: ['mahi-combined'],
    requiredFinMeshes: ['mahi-malepectoral-finsl', 'mahi-malepectoral-finsr', 'mahi-malepelvic-finsl', 'mahi-malepelvic-finsr'],
  },
  {
    name: 'Mahi-mahi female static parts',
    path: 'public/models/fish/mahi-mahi/mahi-mahi_female_static_parts.glb',
    staticMesh: true,
    bodyMeshNames: ['mahi-female'],
    requiredFinMeshes: ['mahi-femalepectoral-finsl', 'mahi-femalepectoral-finsr', 'mahi-femalepelvic-finsl', 'mahi-femalepelvic-finsr'],
  },
  {
    name: 'Shortfin Mako static parts',
    path: 'public/models/fish/isurus-oxyrinchus/isurus-oxyrinchus_static_parts.glb',
    staticMesh: true,
    bodyMeshNames: ['shortfinmako003'],
    // The replacement Mako welds pelvic fins into shortfinmako003 so they deform
    // continuously with the body. Only pectorals remain independent flutter meshes.
    requiredFinMeshes: ['shortfinmakopectoral-finsl', 'shortfinmakopectoral-finsr'],
    // The teeth are a second material split that moves with the body (followBodyMeshNames).
    requiredFollowMeshes: ['shortfinmako003_1'],
    forbiddenMeshNames: ['shortfinmakopelvic-finsl', 'shortfinmakopelvic-finsr'],
    minBodyLength: 20,
  },
  {
    name: 'Clown Triggerfish balistiform mask',
    path: 'public/models/fish/balistoides-conspicillum/balistoides-conspicillum.glb',
    staticMesh: true,
    bodyMeshNames: ['clown_triggerfish'],
    requiredFinMeshes: ['pectorall', 'pectoralr'],
    requiredBodyAttributes: ['color_1'],
    minVertices: 3000,
  },
  {
    // Jeremy's model, masks computed by scripts/paint-disc-wave-masks.py.
    name: "Munk's Devil Ray disc-wave",
    path: 'public/models/fish/mobula-munkiana/mobula-munkiana.glb',
    staticMesh: true,
    // One mesh in three material parts: top (_1), bottom (_2) and the head fins' sides (_3). The
    // floors below apply per part, so only the two that carry the disc are checked here; the app
    // deforms all three (species.js bodyMeshNames). 1536 and 1360 vertices: his faceted model,
    // under the contract's 3000 suggestion in all, and the wings still bend cleanly (dev_2).
    bodyMeshNames: ['munks_devil_ray_1', 'munks_devil_ray_2'],
    requiredBodyAttributes: ['color_1'],
    minVertices: 1300,
  },
  {
    // Jeremy's model, Mirror and "open mouth" baked by scripts/bake-mirror-shape-keys.py, masks
    // by scripts/paint-disc-wave-masks.py. Four material parts: top (_1), bottom (_2), eye (_3)
    // and mouth (_4); the floors are per part, so only the two disc parts are checked (1519 and
    // 1336 vertices).
    name: 'Giant Oceanic Manta disc-wave',
    path: 'public/models/fish/mobula-birostris/mobula-birostris.glb',
    staticMesh: true,
    bodyMeshNames: ['mobula_birostris_1', 'mobula_birostris_2'],
    requiredBodyAttributes: ['color_1'],
    minVertices: 1300,
  },
  {
    name: 'Whale Shark static parts',
    path: 'public/models/fish/rhincodon-typus/rhincodon-typus.glb',
    staticMesh: true,
    bodyMeshNames: ['whaleshark'],
    requiredFinMeshes: ['whalesharkpectorall', 'whalesharkpectoralr'],
    minBodyLength: 90,
  },
  {
    name: 'Giant Sunfish static motion mask',
    path: 'public/models/fish/mola-alexandrini/mola-alexandrini.glb',
    staticMesh: true,
    bodyMeshNames: ['10001003'],
    requiredBodyAttributes: ['color_1'],
    minBodyLength: 0.5,
    minVertices: 8000,
  },
  {
    name: 'Live Sharksucker static parts',
    path: 'public/models/fish/echeneis-naucrates/echeneis-naucrates.glb',
    staticMesh: true,
    bodyMeshNames: ['live_sharksucker_1'],
    // The suction disc is its own material split and moves with the body (followBodyMeshNames).
    requiredFollowMeshes: ['live_sharksucker_2'],
    requiredFinMeshes: ['pectorall', 'pectoralr', 'pelvicl', 'pelvicr'],
    minBodyLength: 6,
  },
  {
    name: 'Whitefin Sharksucker static parts',
    path: 'public/models/fish/echeneis-neucratoides/echeneis-neucratoides.glb',
    staticMesh: true,
    bodyMeshNames: ['e_neucratoides_(2)'],
    requiredFollowMeshes: ['e_neucratoides_(2)_1'],
    requiredFinMeshes: ['pectorall', 'pectoralr', 'pelvicl', 'pelvicr'],
    sourceAxis: 'z',
    minBodyLength: 5,
    minVertices: 1000,
  },
  {
    name: 'Pilot Fish static parts',
    path: 'public/models/fish/naucrates-ductor/naucrates-ductor.glb',
    staticMesh: true,
    bodyMeshNames: ['naucrates_ductor'],
    requiredFinMeshes: ['pectorall', 'pectoralr', 'pelvicl', 'pelvicr'],
    sourceAxis: 'z',
    minBodyLength: 5,
    minVertices: 1000,
  },
  {
    name: 'Longfin Bannerfish static parts',
    path: 'public/models/fish/heniochus-acuminatus/heniochus-acuminatus.glb',
    staticMesh: true,
    bodyMeshNames: ['longfin_bannerfish'],
    // The banner is a separate object, not a material split, so it has its own origin.
    requiredFollowMeshes: ['banner'],
    requiredFinMeshes: ['pectorall', 'pectoralr', 'pelvicl', 'pelvicr'],
    sourceAxis: 'z',
    minBodyLength: 0.3,
    minVertices: 1000,
  },
  {
    name: 'Raccoon Butterflyfish static parts',
    path: 'public/models/fish/chaetodon-lunula/chaetodon-lunula.glb',
    staticMesh: true,
    bodyMeshNames: ['chaetodon_lunula'],
    requiredFinMeshes: ['pectorall', 'pectoralr', 'pelvicl', 'pelvicr'],
    sourceAxis: 'z',
    minBodyLength: 0.19,
    minVertices: 1000,
  },
  {
    name: 'Emperor Angelfish static parts',
    path: 'public/models/fish/pomacanthus-imperator/pomacanthus-imperator.glb',
    staticMesh: true,
    bodyMeshNames: ['pomacanthus_imperator'],
    // Pelvics only: the model has no separate pectoral objects.
    requiredFinMeshes: ['pelvicl', 'pelvicr'],
    sourceAxis: 'z',
    minBodyLength: 0.39,
    minVertices: 1000,
  },
  {
    name: 'Emperor Angelfish juvenile static parts',
    path: 'public/models/fish/pomacanthus-imperator/pomacanthus-imperator-juvenile.glb',
    staticMesh: true,
    bodyMeshNames: ['pomacanthus_imperator_juvenile'],
    // Pectorals only: the juvenile model has no separate pelvic objects.
    requiredFinMeshes: ['pectorall', 'pectoralr'],
    sourceAxis: 'z',
    minBodyLength: 0.19,
    minVertices: 1000,
  },
  {
    name: 'Squaretail Coral Grouper static parts',
    path: 'public/models/fish/plectropomus-areolatus/plectropomus-areolatus.glb',
    staticMesh: true,
    bodyMeshNames: ['squaretail_coral_grouper'],
    requiredFinMeshes: ['pectorall', 'pectoralr', 'pelvicl', 'pelvicr'],
    sourceAxis: 'z',
    minBodyLength: 0.79,
    minVertices: 3000,
  },
  {
    name: 'Humphead Wrasse static parts',
    path: 'public/models/fish/crassilabrus-undulatus/crassilabrus-undulatus.glb',
    staticMesh: true,
    bodyMeshNames: ['humphead_wrasse'],
    requiredFinMeshes: ['pectorall', 'pectoralr', 'pelvicl', 'pelvicr'],
    sourceAxis: 'z',
    // Modelled at 20.198 raw (snout to tail tip), not 1 raw = 1 m.
    minBodyLength: 20,
    minVertices: 3000,
  },
  {
    name: 'Humphead Wrasse female static parts',
    path: 'public/models/fish/crassilabrus-undulatus/crassilabrus-undulatus-female.glb',
    staticMesh: true,
    bodyMeshNames: ['humphead_wrasse_female'],
    requiredFinMeshes: ['pectorall', 'pectoralr', 'pelvicl', 'pelvicr'],
    sourceAxis: 'z',
    // Modelled at 10.008 raw (snout to tail tip).
    minBodyLength: 10,
    minVertices: 2000,
  },
]

const axisValue = (vector, axis) => axis === 'x' ? vector.x : (axis === 'y' ? vector.y : vector.z)
const loader = new GLTFLoader()
for (const target of targets) {
  const data = fs.readFileSync(new URL(`../${target.path}`, import.meta.url))
  const gltf = await loader.parseAsync(data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength), '')
  gltf.scene.updateMatrixWorld(true)
  const bones = []
  const meshes = []
  gltf.scene.traverse(node => {
    if (node.isBone) bones.push(node.name)
    if (node.isMesh) {
      node.geometry.computeBoundingBox()
      const bbox = node.geometry.boundingBox
      const sourceAxis = target.sourceAxis ?? 'z'
      meshes.push({
        name: node.name,
        skinned: Boolean(node.isSkinnedMesh),
        vertices: node.geometry.getAttribute('position')?.count ?? 0,
        attributes: Object.keys(node.geometry.attributes ?? {}),
        minSource: axisValue(bbox.min, sourceAxis),
        maxSource: axisValue(bbox.max, sourceAxis),
        sourceSpan: axisValue(bbox.max, sourceAxis) - axisValue(bbox.min, sourceAxis),
        matrixWorld: node.matrixWorld,
      })
    }
  })
  const meshNames = meshes.map(mesh => mesh.name)
  const bodyMeshes = meshes.filter(mesh => target.bodyMeshNames?.includes(mesh.name))
  const missingBodyMeshes = (target.bodyMeshNames ?? []).filter(name => !meshNames.includes(name))
  const missingFinMeshes = (target.requiredFinMeshes ?? []).filter(name => !meshNames.includes(name))
  const missingFollowMeshes = (target.requiredFollowMeshes ?? []).filter(name => !meshNames.includes(name))
  // A follow mesh deforms in its own local frame against the body's bounds, so the two frames must
  // match: a follow part exported as a separate object with its own origin (the bannerfish's
  // banner, before its origin was moved to the body's) would wave as if shifted along the body.
  const followFrameMismatches = (target.requiredFollowMeshes ?? []).filter(name => {
    const follow = meshes.find(mesh => mesh.name === name)
    return follow && bodyMeshes[0] && !follow.matrixWorld.equals(bodyMeshes[0].matrixWorld)
      && follow.matrixWorld.elements.some((value, index) => Math.abs(value - bodyMeshes[0].matrixWorld.elements[index]) > 1e-5)
  })
  const unexpectedMeshes = (target.forbiddenMeshNames ?? []).filter(name => meshNames.includes(name))
  const missingBodyAttributes = (target.requiredBodyAttributes ?? []).filter(attribute => (
    bodyMeshes.some(mesh => !mesh.attributes.includes(attribute))
  ))
  const bodyContractFailed = bodyMeshes.some(mesh => (
    mesh.skinned
    || mesh.vertices < (target.minVertices ?? 1000)
    || mesh.sourceSpan < (target.minBodyLength ?? 1)
  ))
  const staticContractFailed = Boolean(target.staticMesh && (
    gltf.animations.length > 0
    || bones.length > 0
    || missingBodyMeshes.length > 0
    || missingFinMeshes.length > 0
    || missingFollowMeshes.length > 0
    || followFrameMismatches.length > 0
    || unexpectedMeshes.length > 0
    || missingBodyAttributes.length > 0
    || bodyContractFailed
  ))
  console.log(JSON.stringify({
    name: target.name,
    path: target.path,
    authoredClipsIgnoredAtRuntime: gltf.animations.map(clip => clip.name),
    proceduralMode: 'longitudinal-vertex',
    meshes: meshes.map(({ matrixWorld, ...mesh }) => mesh),
    bodyMeshes: target.bodyMeshNames ?? [],
    missingBodyMeshes,
    missingFinMeshes,
    missingFollowMeshes,
    followFrameMismatches,
    unexpectedMeshes,
    missingBodyAttributes,
    proceduralBones: [],
    missingBones: [],
    staticContractFailed,
  }))
  if (staticContractFailed) process.exitCode = 1
}
