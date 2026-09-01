import fs from 'node:fs'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'

globalThis.self = globalThis
globalThis.createImageBitmap = async () => ({ close() {} })

const targets = [
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
    requiredFinMeshes: ['shortfinmakopectoral-finsl', 'shortfinmakopectoral-finsr', 'shortfinmakopelvic-finsl', 'shortfinmakopelvic-finsr'],
    minBodyLength: 20,
  },
]

const axisValue = (vector, axis) => axis === 'x' ? vector.x : (axis === 'y' ? vector.y : vector.z)
const loader = new GLTFLoader()
for (const target of targets) {
  const data = fs.readFileSync(new URL(`../${target.path}`, import.meta.url))
  const gltf = await loader.parseAsync(data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength), '')
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
      })
    }
  })
  const meshNames = meshes.map(mesh => mesh.name)
  const bodyMeshes = meshes.filter(mesh => target.bodyMeshNames?.includes(mesh.name))
  const missingBodyMeshes = (target.bodyMeshNames ?? []).filter(name => !meshNames.includes(name))
  const missingFinMeshes = (target.requiredFinMeshes ?? []).filter(name => !meshNames.includes(name))
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
    || bodyContractFailed
  ))
  console.log(JSON.stringify({
    name: target.name,
    path: target.path,
    authoredClipsIgnoredAtRuntime: gltf.animations.map(clip => clip.name),
    proceduralMode: 'longitudinal-vertex',
    meshes,
    bodyMeshes: target.bodyMeshNames ?? [],
    missingBodyMeshes,
    missingFinMeshes,
    proceduralBones: [],
    missingBones: [],
    staticContractFailed,
  }))
  if (staticContractFailed) process.exitCode = 1
}
