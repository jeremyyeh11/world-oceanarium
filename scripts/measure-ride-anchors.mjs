// Measure where remoras can ride a host: slices a host GLB along its length and prints the
// belly line, back line, and flank half-widths in the runtime model frame (+X right, +Y up,
// +Z tail, origin = model root), both in world units and divided by the host's body length —
// the units `rideHost.anchors[].at` uses. See docs/ride-hosts.md.
//
//   node scripts/measure-ride-anchors.mjs <glb> --scale <model.scale> --body-length <WU> [--mesh <bodyMeshName>] [--slices 24]
//
// Example (the mako's anchors came from this):
//   node scripts/measure-ride-anchors.mjs public/models/fish/isurus-oxyrinchus/isurus-oxyrinchus_static_parts.glb \
//     --scale 0.443 --body-length 17.8 --mesh shortfinmako003
import fs from 'node:fs'
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'

globalThis.self = globalThis
globalThis.createImageBitmap = async () => ({ close() {} })

const args = process.argv.slice(2)
const glbPath = args.find(arg => !arg.startsWith('--') && !/^[\d.-]+$/.test(arg))
const option = (name, fallback) => {
  const index = args.indexOf(`--${name}`)
  return index >= 0 ? args[index + 1] : fallback
}
const scale = Number(option('scale', 1))
const bodyLength = Number(option('body-length', NaN))
const meshName = option('mesh', null)
const slices = Number(option('slices', 24))

if (!glbPath || !Number.isFinite(bodyLength)) {
  console.error('usage: node scripts/measure-ride-anchors.mjs <glb> --scale <model.scale> --body-length <WU> [--mesh <name>] [--slices 24]')
  process.exit(1)
}

const data = fs.readFileSync(glbPath)
const gltf = await new GLTFLoader().parseAsync(data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength), '')
const root = new THREE.Group()
root.scale.setScalar(scale)
root.add(gltf.scene)
root.updateMatrixWorld(true)

const points = []
gltf.scene.traverse(node => {
  if (!node.isMesh || (meshName && node.name !== meshName)) return
  const position = node.geometry.getAttribute('position')
  for (let i = 0; i < position.count; i += 1) {
    points.push(new THREE.Vector3().fromBufferAttribute(position, i).applyMatrix4(node.matrixWorld))
  }
})
if (points.length === 0) {
  console.error(meshName ? `no mesh named "${meshName}"` : 'no meshes found')
  process.exit(1)
}

const box = new THREE.Box3().setFromPoints(points)
const span = box.max.z - box.min.z
const fmt = value => (Number.isFinite(value) ? value.toFixed(2).padStart(6) : '     -')
const norm = value => (Number.isFinite(value) ? (value / bodyLength).toFixed(4).padStart(8) : '       -')

console.log(`mesh ${meshName ?? '(all)'}  bounds x[${fmt(box.min.x)},${fmt(box.max.x)}] y[${fmt(box.min.y)},${fmt(box.max.y)}] z[${fmt(box.min.z)},${fmt(box.max.z)}]  (snout at min z)`)
console.log(`body length ${bodyLength} WU; "/BL" columns are anchor units`)
console.log('     z    z/BL   belly  belly/BL    back   flankX flankX/BL (at mid-height)')
for (let s = 0; s < slices; s += 1) {
  const z0 = box.min.z + (span * s) / slices
  const z1 = box.min.z + (span * (s + 1)) / slices
  const slice = points.filter(p => p.z >= z0 && p.z < z1)
  // Belly and back along the centre line; flank half-width at mid-height.
  let belly = Infinity
  let back = -Infinity
  for (const p of slice) {
    if (Math.abs(p.x) >= 0.25) continue
    belly = Math.min(belly, p.y)
    back = Math.max(back, p.y)
  }
  const midY = (belly + back) / 2
  let flank = -Infinity
  for (const p of slice) if (Math.abs(p.y - midY) < 0.35) flank = Math.max(flank, Math.abs(p.x))
  const z = (z0 + z1) / 2
  console.log(`${fmt(z)} ${norm(z)} ${fmt(belly)} ${norm(belly)} ${fmt(back)} ${fmt(flank)} ${norm(flank)}`)
}
