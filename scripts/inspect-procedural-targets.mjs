import fs from 'node:fs'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'

globalThis.self = globalThis
globalThis.createImageBitmap = async () => ({ close() {} })

const targets = [
  { name: 'Sardinella', path: 'public/models/fish/sardine/sardine.glb', expectedBones: ['Bone', 'Bone001', 'Bone002', 'Bone003'] },
  { name: 'Mahi-mahi male static', path: 'public/models/fish/mahi-mahi/mahi-mahi_male_static.glb', staticMesh: true },
  { name: 'Mahi-mahi female', path: 'public/models/fish/mahi-mahi/mahi-mahi_female.glb', expectedBones: ['spine003', 'spine004', 'spine005', 'spine006', 'spine007'] },
  { name: 'Shortfin Mako', path: 'public/models/fish/isurus-oxyrinchus/isurus-oxyrinchus.glb', expectedBones: ['spine003', 'spine004', 'spine005', 'spine006'] },
]
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
      meshes.push({
        name: node.name,
        skinned: Boolean(node.isSkinnedMesh),
        vertices: node.geometry.getAttribute('position')?.count ?? 0,
        minZ: node.geometry.boundingBox.min.z,
        maxZ: node.geometry.boundingBox.max.z,
      })
    }
  })
  const expectedBones = target.expectedBones ?? []
  const missingBones = expectedBones.filter(expected => !bones.includes(expected))
  const staticContractFailed = Boolean(target.staticMesh && (
    gltf.animations.length > 0
    || bones.length > 0
    || meshes.length !== 1
    || meshes[0].skinned
    || meshes[0].vertices < 1000
    || meshes[0].maxZ - meshes[0].minZ < 1
  ))
  console.log(JSON.stringify({
    name: target.name,
    path: target.path,
    authoredClipsIgnoredAtRuntime: gltf.animations.map(clip => clip.name),
    proceduralMode: target.staticMesh ? 'longitudinal-vertex' : 'bone-lattice',
    meshes,
    proceduralBones: expectedBones,
    missingBones,
    staticContractFailed,
  }))
  if (missingBones.length || staticContractFailed) process.exitCode = 1
}
