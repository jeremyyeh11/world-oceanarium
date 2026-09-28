// Fit a supplied remora model to the ride system by raycasting it.
//
//   node scripts/fit-rider-model.mjs <rider-species-id> [--glb <path>] [--disc <meshName>]
//
// Reads the rider's model from src/data/species.js: the body is
// `model.proceduralAnimation.bodyMeshNames[0]` and the suction disc is `--disc` or the first
// of `followBodyMeshNames`. The model must follow the project frame (nose at -Z, up +Y); a
// `model.rotation` is applied first. It prints, to paste into species.js:
//   - `model.scale` (source length -> `swim.bodyLengthWU`) and `model.position`, which puts
//     the rider's root mid-length on the body axis, like the stand-ins' origin;
//   - the Atlas source length (MODEL_SOURCE_LENGTH_UNITS_BY_SPECIES in EncyclopediaPage.jsx);
//   - `hitchhiker.discAheadBodyLengths` and `dorsalClearanceBodyLengths`: the disc centre
//     ahead of the root and the disc top above it, so the disc sits on the host's skin;
//   - `hitchhiker.backProfile`: the model's top line along its centre, as `[behind, drop]`
//     pairs in rider body lengths — how far back from the disc, and how far below the
//     disc-top line (negative where a fin lobe stands proud of it). rideAnchorFit in
//     fishSwim.js pivots the rider on its disc until none of it cuts into the host.
// See docs/ride-hosts.md.
import fs from 'node:fs'
import path from 'node:path'
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { SPECIES } from '../src/data/species.js'

globalThis.self = globalThis
globalThis.createImageBitmap = async () => ({ close() {} })

// Top-line samples along the body (fraction of its length) and the simplification tolerance
// (rider body lengths; 0.0005 is 2 mm on a 1.1 m sharksucker).
const PROFILE_STEP = 0.01
const PROFILE_TOLERANCE = 0.0005
// The body axis is the median mid-height over this stretch of the length, clear of the head
// and the caudal fin.
const AXIS_FROM = 0.2
const AXIS_TO = 0.8

const args = process.argv.slice(2)
const option = name => {
  const index = args.indexOf(`--${name}`)
  return index >= 0 ? args[index + 1] : null
}
const riderId = args.find(arg => !arg.startsWith('--') && !args[args.indexOf(arg) - 1]?.startsWith('--'))
const species = SPECIES.find(entry => entry.id === riderId)
if (!species?.hitchhiker || !species.model?.path) {
  console.error('usage: node scripts/fit-rider-model.mjs <rider-species-id> [--glb <path>] [--disc <meshName>]  (a species with model and hitchhiker)')
  process.exit(1)
}
const procedural = species.model.proceduralAnimation ?? {}
const bodyMeshName = procedural.bodyMeshNames?.[0]
const discMeshName = option('disc') ?? procedural.followBodyMeshNames?.[0]
if (!bodyMeshName || !discMeshName) {
  console.error('needs a body mesh (proceduralAnimation.bodyMeshNames) and a disc mesh (--disc or followBodyMeshNames)')
  process.exit(1)
}

const glbPath = option('glb') ?? path.join('public', species.model.path)
const data = fs.readFileSync(glbPath)
const gltf = await new GLTFLoader().parseAsync(data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength), '')
const root = new THREE.Group()
if (species.model.rotation) root.rotation.set(...species.model.rotation)
root.add(gltf.scene)
root.updateMatrixWorld(true)

const meshes = {}
gltf.scene.traverse(node => {
  if (!node.isMesh) return
  node.material.side = THREE.DoubleSide
  meshes[node.name] = node
})
const body = meshes[bodyMeshName]
const disc = meshes[discMeshName]
if (!body || !disc) {
  console.error(`mesh not found: ${!body ? bodyMeshName : discMeshName} (have ${Object.keys(meshes).join(', ')})`)
  process.exit(1)
}

const bodyBox = new THREE.Box3().setFromObject(body)
const discBox = new THREE.Box3().setFromObject(disc)
const length = bodyBox.max.z - bodyBox.min.z
const centerX = (bodyBox.min.x + bodyBox.max.x) / 2
const centerZ = (bodyBox.min.z + bodyBox.max.z) / 2
const zAt = t => bodyBox.min.z + length * t

const raycaster = new THREE.Raycaster()
const DOWN = new THREE.Vector3(0, -1, 0)
const UP = new THREE.Vector3(0, 1, 0)
const above = bodyBox.max.y + 1
const below = bodyBox.min.y - 1
function firstHitY(objects, originY, direction, z) {
  raycaster.set(new THREE.Vector3(centerX, originY, z), direction)
  return raycaster.intersectObjects(objects, false)[0]?.point.y ?? null
}

const midHeights = []
for (let t = AXIS_FROM; t <= AXIS_TO + 1e-9; t += PROFILE_STEP) {
  const top = firstHitY([body], above, DOWN, zAt(t))
  const bottom = firstHitY([body], below, UP, zAt(t))
  if (top !== null && bottom !== null) midHeights.push((top + bottom) / 2)
}
midHeights.sort((a, b) => a - b)
const centerY = midHeights[Math.floor(midHeights.length / 2)]

const discCenterZ = (discBox.min.z + discBox.max.z) / 2
const discTop = discBox.max.y
const discT = (discCenterZ - bodyBox.min.z) / length

const samples = []
for (let t = PROFILE_STEP / 4; t < 1; t += PROFILE_STEP) {
  const top = firstHitY([body, disc], above, DOWN, zAt(t))
  if (top !== null) samples.push([t - discT, (discTop - top) / length])
}
// Keep the ends of the body even if nothing hit exactly there.
const profile = simplify(samples, PROFILE_TOLERANCE)

// Ramer–Douglas–Peucker on the drop values.
function simplify(points, tolerance) {
  if (points.length <= 2) return points
  const [x0, y0] = points[0]
  const [x1, y1] = points.at(-1)
  let worst = 0
  let worstIndex = 0
  for (let i = 1; i < points.length - 1; i += 1) {
    const [x, y] = points[i]
    const error = Math.abs(y - (y0 + ((y1 - y0) * (x - x0)) / (x1 - x0)))
    if (error > worst) {
      worst = error
      worstIndex = i
    }
  }
  if (worst <= tolerance) return [points[0], points.at(-1)]
  return [...simplify(points.slice(0, worstIndex + 1), tolerance).slice(0, -1), ...simplify(points.slice(worstIndex), tolerance)]
}

const bodyLengthWU = species.swim.bodyLengthWU
const scale = bodyLengthWU / length
const round = (value, digits = 4) => Number(value.toFixed(digits))
const contactBehind = (centerZ - discCenterZ) / length + 0.2
let contactDrop = null
for (let i = 1; i < profile.length; i += 1) {
  const [s0, d0] = profile[i - 1]
  const [s1, d1] = profile[i]
  if (contactBehind >= s0 && contactBehind <= s1) contactDrop = d0 + ((d1 - d0) * (contactBehind - s0)) / (s1 - s0)
}
const proudest = profile.reduce((worst, point) => (point[1] < worst[1] ? point : worst), profile[0])

console.log(`${species.id}: body "${bodyMeshName}", disc "${discMeshName}"`)
console.log(`source length ${round(length)} (Atlas MODEL_SOURCE_LENGTH_UNITS_BY_SPECIES), root at [${round(centerX)}, ${round(centerY)}, ${round(centerZ)}] in source units`)
console.log(`disc ${round((discBox.max.z - discBox.min.z) / length, 3)} body lengths long, centre ${round(discT, 3)} of the length back from the snout`)
console.log(`contact point (0.2 behind the root) sits ${round(contactDrop ?? NaN)} below the disc top; highest point of the top line is ${round(-proudest[1])} above it, ${round(proudest[0], 2)} behind the disc`)
console.log(`${samples.length} top-line samples -> ${profile.length} profile points (tolerance ${PROFILE_TOLERANCE})`)
console.log('')
console.log('model: {')
console.log(`  // Source length ${round(length)} -> ${bodyLengthWU} WU; the root is recentred mid-length on the body axis.`)
console.log(`  scale: ${round(scale)},`)
console.log(`  position: [${[centerX, centerY, centerZ].map(value => round(-value * scale)).join(', ')}],`)
console.log('},')
console.log('hitchhiker: {')
console.log(`  discAheadBodyLengths: ${round((centerZ - discCenterZ) / length)},`)
console.log(`  dorsalClearanceBodyLengths: ${round((discTop - centerY) / length)},`)
console.log(`  backProfile: [${profile.map(([s, d]) => `[${round(s)}, ${round(d)}]`).join(', ')}],`)
console.log('},')
