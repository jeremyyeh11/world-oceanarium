import fs from 'node:fs'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'

globalThis.self = globalThis
globalThis.createImageBitmap = async () => ({ close() {} })

const targets = [
  ['Sardinella', 'public/models/fish/sardine/sardine.glb', ['Bone', 'Bone001', 'Bone002', 'Bone003']],
  ['Mahi-mahi male', 'public/models/fish/mahi-mahi/mahi-mahi_male.glb', ['spine003', 'spine004', 'spine005', 'spine006', 'spine007']],
  ['Mahi-mahi female', 'public/models/fish/mahi-mahi/mahi-mahi_female.glb', ['spine003', 'spine004', 'spine005', 'spine006', 'spine007']],
  ['Shortfin Mako', 'public/models/fish/isurus-oxyrinchus/isurus-oxyrinchus.glb', ['spine003', 'spine004', 'spine005', 'spine006']],
]
const loader = new GLTFLoader()
for (const [name, path, expectedBones] of targets) {
  const data = fs.readFileSync(new URL(`../${path}`, import.meta.url))
  const gltf = await loader.parseAsync(data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength), '')
  const bones = []
  let skinnedMeshes = 0
  gltf.scene.traverse(node => {
    if (node.isBone) bones.push(node.name)
    if (node.isSkinnedMesh) skinnedMeshes += 1
  })
  const missingBones = expectedBones.filter(expected => !bones.includes(expected))
  console.log(JSON.stringify({
    name,
    path,
    authoredClipsIgnoredAtRuntime: gltf.animations.map(clip => clip.name),
    skinnedMeshes,
    proceduralBones: expectedBones,
    missingBones,
  }))
  if (missingBones.length) process.exitCode = 1
}
