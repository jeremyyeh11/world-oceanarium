// Generate a host's ride anchors from its mesh: attach points sampled over the body's
// faces, oriented by the face normals, and fitted to the real skin.
//
//   node scripts/fit-ride-anchors.mjs <host-species-id> [--count 18] [--from 0.12] [--to 0.5] [--seed 1]
//
// Reads the host's model and `rideHost` from src/data/species.js and writes its entry in
// src/data/rideAnchors.js (other hosts are kept). All values are in host body lengths,
// runtime model frame (+X right, +Y up, +Z tail), like the anchors. It:
//   1. collects the body mesh's triangles (`bodyMeshNames`) and keeps the faces a remora
//      could clamp to: between `--from` and `--to` of the length, not facing up (the back)
//      or along the body (snout, fin edges), and with at least MIN_THICKNESS of body behind
//      them, so thin welded fins (dorsal, pelvics, caudal) are skipped;
//   2. draws points over those faces by area with a fixed seed, and keeps a point only if
//      it is MIN_SPACING from every point already kept and a typical rider lying there would
//      clear the host's separate fins (the mako's pectorals). Nothing is mirrored, so the
//      spots are as uneven as the mesh;
//   3. averages each point's normal over a small cross of rays, so one facet does not tilt
//      the rider, and samples a rail: the skin's height along that normal at steps along the
//      body, so the ride system can lay a rider along the skin (rideAnchorFit in fishSwim.js);
//   4. records `waveSpan`, the body's nose and tail along Z, so riders can follow the host's
//      caudal wave at their spot.
import fs from 'node:fs'
import path from 'node:path'
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { SPECIES } from '../src/data/species.js'
import { RIDE_ANCHORS } from '../src/data/rideAnchors.js'

globalThis.self = globalThis
globalThis.createImageBitmap = async () => ({ close() {} })

const RAIL_FROM = -0.12
const RAIL_TO = 0.36
const RAIL_STEP = 0.02
// Surface normal: averaged over a small cross of rays round the point, in WU.
const NORMAL_PROBE = 0.12
// Face filters, in host body lengths or as normal components.
const MAX_NORMAL_UP = 0.35
const MAX_NORMAL_ALONG = 0.5
const MIN_THICKNESS = 0.03
const MIN_SPACING = 0.06
// Around a spot, over the stretch a rider lies on, the skin may rise this far above the spot
// itself (host body lengths). More means a fin root or a bump that would prop the rider off
// its disc: the Mola's pectoral fin just ahead, the mako's welded pelvic fins just behind.
const MAX_RAIL_RISE = 0.004
const RISE_FROM = -0.06
const RISE_TO = 0.2
// Faces whose motion-mask weight (any channel) exceeds this belong to a moving fin.
const MAX_MASK = 0.05
// A typical rider for the fin-clearance check: a quarter of the host long, lying from a
// little ahead of the disc to well behind it, this far off the skin (host body lengths).
const PROBE_RIDER_FROM = -0.08
const PROBE_RIDER_TO = 0.18
const PROBE_RIDER_RADIUS = 0.02
const OUT_FILE = path.join('src', 'data', 'rideAnchors.js')

const args = process.argv.slice(2)
const option = (name, fallback) => {
  const index = args.indexOf(`--${name}`)
  return index >= 0 ? Number(args[index + 1]) : fallback
}
const hostId = args.find(arg => !arg.startsWith('--') && !/^[\d.]+$/.test(arg))
const species = SPECIES.find(entry => entry.id === hostId)
if (!species?.rideHost || !species.model?.path) {
  console.error('usage: node scripts/fit-ride-anchors.mjs <host-species-id> [--count 18] [--from 0.12] [--to 0.5] [--seed 1]  (a species with model and rideHost)')
  process.exit(1)
}
const count = option('count', 18)
const from = option('from', 0.12)
const to = option('to', 0.5)
const seed = option('seed', 1)
const bodyMeshNames = species.model.proceduralAnimation?.bodyMeshNames ?? []
const bodyLength = species.swim.bodyLengthWU

const data = fs.readFileSync(path.join('public', species.model.path))
const gltf = await new GLTFLoader().parseAsync(data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength), '')
const root = new THREE.Group()
root.scale.setScalar(species.model.scale ?? 1)
if (species.model.rotation) root.rotation.set(...species.model.rotation)
if (species.model.position) root.position.set(...species.model.position)
root.add(gltf.scene)
root.updateMatrixWorld(true)
const bodies = []
const fins = []
gltf.scene.traverse(node => {
  if (!node.isMesh) return
  node.material.side = THREE.DoubleSide
  if (!bodyMeshNames.length || bodyMeshNames.includes(node.name)) bodies.push(node)
  else fins.push(node)
})

// Every body triangle in the runtime model frame (WU).
const triangles = []
let maskedFaces = 0
for (const mesh of bodies) {
  const position = mesh.geometry.getAttribute('position')
  // A painted motion mask (the Mola's `color_1`: dorsal, anal, clavus, pectorals) marks parts
  // that flap on their own. A rider there would have the fin swing through it.
  const mask = mesh.geometry.getAttribute('color_1')
  const index = mesh.geometry.index
  const faceCount = index ? index.count / 3 : position.count / 3
  const vertexIndex = i => (index ? index.getX(i) : i)
  const vertex = i => new THREE.Vector3().fromBufferAttribute(position, vertexIndex(i)).applyMatrix4(mesh.matrixWorld)
  const masked = i => mask && Math.max(mask.getX(vertexIndex(i)), mask.getY(vertexIndex(i)), mask.getZ(vertexIndex(i))) > MAX_MASK
  for (let f = 0; f < faceCount; f += 1) {
    if (masked(f * 3) || masked(f * 3 + 1) || masked(f * 3 + 2)) {
      maskedFaces += 1
      continue
    }
    const a = vertex(f * 3)
    const b = vertex(f * 3 + 1)
    const c = vertex(f * 3 + 2)
    const cross = new THREE.Vector3().subVectors(b, a).cross(new THREE.Vector3().subVectors(c, a))
    const area = cross.length() / 2
    if (area > 1e-9) triangles.push({ a, b, c, area, normal: cross.normalize() })
  }
}
const box = new THREE.Box3()
for (const t of triangles) box.expandByPoint(t.a).expandByPoint(t.b).expandByPoint(t.c)
const span = box.max.z - box.min.z
const tail01At = z => (z - box.min.z) / span

const raycaster = new THREE.Raycaster()
const normalMatrix = new THREE.Matrix3()
// First hit from `origin` along `direction`, with its outward normal (facing the ray).
function cast(origin, direction, near = 0) {
  raycaster.set(origin, direction)
  raycaster.near = near
  const hit = raycaster.intersectObjects(bodies, false)[0]
  raycaster.near = 0
  if (!hit) return null
  const normal = hit.face.normal.clone().applyMatrix3(normalMatrix.getNormalMatrix(hit.object.matrixWorld)).normalize()
  if (normal.dot(direction) > 0) normal.negate()
  return { point: hit.point.clone(), normal, distance: hit.distance }
}

// How much body lies behind a face: from just inside it, straight in, to where the ray leaves.
function thicknessBehind(point, normal) {
  const inward = normal.clone().negate()
  const exit = cast(point.clone().addScaledVector(inward, 1e-3), inward, 1e-3)
  return exit ? exit.distance : 0
}

const finPoints = []
for (const fin of fins) {
  const position = fin.geometry.getAttribute('position')
  for (let i = 0; i < position.count; i += 1) finPoints.push(new THREE.Vector3().fromBufferAttribute(position, i).applyMatrix4(fin.matrixWorld))
}
function clearsFins(point, normal) {
  if (finPoints.length === 0) return true
  const back = new THREE.Vector3(0, 0, 1).addScaledVector(normal, -normal.z).normalize()
  const radius = PROBE_RIDER_RADIUS * bodyLength
  for (let s = PROBE_RIDER_FROM; s <= PROBE_RIDER_TO + 1e-9; s += 0.02) {
    const probe = point.clone().addScaledVector(back, s * bodyLength).addScaledVector(normal, radius)
    for (const finPoint of finPoints) if (finPoint.distanceToSquared(probe) < (radius * 1.5) ** 2) return false
  }
  return true
}

// Faces a remora could clamp to, weighted by area.
const candidates = triangles.filter(t => {
  const center = new THREE.Vector3().add(t.a).add(t.b).add(t.c).divideScalar(3)
  const tail01 = tail01At(center.z)
  return tail01 >= from && tail01 <= to && t.normal.y <= MAX_NORMAL_UP && Math.abs(t.normal.z) <= MAX_NORMAL_ALONG
})
const totalArea = candidates.reduce((sum, t) => sum + t.area, 0)
if (candidates.length === 0) throw new Error('no faces pass the filters')

let state = seed >>> 0 || 1
const rand = () => {
  state = (state + 0x6D2B79F5) >>> 0
  let t = state
  t = Math.imul(t ^ (t >>> 15), t | 1)
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}
function samplePoint() {
  let pick = rand() * totalArea
  let t = candidates[0]
  for (const candidate of candidates) {
    pick -= candidate.area
    if (pick <= 0) {
      t = candidate
      break
    }
  }
  let u = rand()
  let v = rand()
  if (u + v > 1) {
    u = 1 - u
    v = 1 - v
  }
  const point = t.a.clone()
    .addScaledVector(new THREE.Vector3().subVectors(t.b, t.a), u)
    .addScaledVector(new THREE.Vector3().subVectors(t.c, t.a), v)
  return { point, normal: t.normal.clone() }
}

// Rail: skin height along the normal at steps along the body (the rider's back direction).
function railFor(point, normal) {
  const back = new THREE.Vector3(0, 0, 1).addScaledVector(normal, -normal.z).normalize()
  const rail = []
  for (let s = RAIL_FROM; s <= RAIL_TO + 1e-9; s += RAIL_STEP) {
    const onPlane = point.clone().addScaledVector(back, s * bodyLength)
    const sample = cast(onPlane.clone().addScaledVector(normal, 4), normal.clone().negate())
    // No skin there (past the snout, or off a thin fin): nothing to lie against.
    const height = sample ? sample.point.clone().sub(onPlane).dot(normal) : -0.25 * bodyLength
    rail.push([Number(s.toFixed(2)), Number((height / bodyLength).toFixed(4))])
  }
  return rail
}

const tangentA = new THREE.Vector3()
const tangentB = new THREE.Vector3()
const kept = []
let rejectedThin = 0
let rejectedFins = 0
let rejectedRise = 0
for (let attempt = 0; attempt < count * 400 && kept.length < count; attempt += 1) {
  const { point, normal: faceNormal } = samplePoint()
  if (kept.some(anchor => anchor.point.distanceTo(point) < MIN_SPACING * bodyLength)) continue
  if (thicknessBehind(point, faceNormal) < MIN_THICKNESS * bodyLength) {
    rejectedThin += 1
    continue
  }
  // Average the normal over a small cross of rays so one facet does not tilt the rider.
  tangentA.set(0, 0, 1).addScaledVector(faceNormal, -faceNormal.z).normalize()
  tangentB.crossVectors(faceNormal, tangentA).normalize()
  const normal = faceNormal.clone()
  for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    const probe = point.clone()
      .addScaledVector(tangentA, a * NORMAL_PROBE)
      .addScaledVector(tangentB, b * NORMAL_PROBE)
      .addScaledVector(faceNormal, 3)
    const sample = cast(probe, faceNormal.clone().negate())
    if (sample) normal.add(sample.normal)
  }
  normal.normalize()
  if (normal.y > MAX_NORMAL_UP || Math.abs(normal.z) > MAX_NORMAL_ALONG) continue
  if (!clearsFins(point, normal)) {
    rejectedFins += 1
    continue
  }
  const rail = railFor(point, normal)
  if (rail.some(([at, height]) => at >= RISE_FROM && at <= RISE_TO && height > MAX_RAIL_RISE)) {
    rejectedRise += 1
    continue
  }
  kept.push({ point, normal, rail })
}

function regionName(normal) {
  if (normal.y < -0.7) return 'belly'
  const side = normal.x < 0 ? 'l' : 'r'
  return normal.y < -0.35 ? `lower-flank-${side}` : `flank-${side}`
}

// Front to back, so indices read along the body.
kept.sort((a, b) => a.point.z - b.point.z)
const anchors = kept.map(({ point, normal, rail }) => {
  return {
    name: `${regionName(normal)}-${Math.round(tail01At(point.z) * 100)}`,
    at: point.toArray().map(v => Number((v / bodyLength).toFixed(4))),
    normal: normal.toArray().map(v => Number(v.toFixed(3))),
    rail,
  }
})

const entry = {
  generated: `node scripts/fit-ride-anchors.mjs ${hostId} --count ${count} --from ${from} --to ${to} --seed ${seed}`,
  waveSpan: [Number((box.min.z / bodyLength).toFixed(4)), Number((box.max.z / bodyLength).toFixed(4))],
  anchors,
}
const all = { ...RIDE_ANCHORS, [hostId]: entry }
const fmt = value => JSON.stringify(value).replace(/,/g, ', ')
const lines = [
  '// Ride anchors for each host, generated from its mesh by scripts/fit-ride-anchors.mjs.',
  '// Do not edit by hand: rerun the command recorded in `generated`. See docs/ride-hosts.md.',
  '//',
  '// `waveSpan` is the body\'s nose and tail along Z; `at`, `normal`, and `rail` are one',
  '// attach point each, in host body lengths, runtime model frame (+X right, +Y up, +Z tail).',
  'export const RIDE_ANCHORS = {',
]
for (const [id, host] of Object.entries(all).sort(([a], [b]) => a.localeCompare(b))) {
  lines.push(`  '${id}': {`)
  lines.push(`    generated: '${host.generated}',`)
  lines.push(`    waveSpan: ${fmt(host.waveSpan)},`)
  lines.push('    anchors: [')
  for (const anchor of host.anchors) {
    lines.push(`      { name: '${anchor.name}', at: ${fmt(anchor.at)}, normal: ${fmt(anchor.normal)}, rail: ${fmt(anchor.rail)} },`)
  }
  lines.push('    ],')
  lines.push('  },')
}
lines.push('}', '')
fs.writeFileSync(OUT_FILE, lines.join('\n'))
console.log(`${species.name}: ${anchors.length} anchors from ${candidates.length} candidate faces (${maskedFaces} faces on masked fins skipped; ${rejectedThin} points too thin, ${rejectedFins} under a fin, ${rejectedRise} beside a bump) -> ${OUT_FILE}`)
for (const anchor of anchors) console.log(`  ${anchor.name.padEnd(18)} at ${fmt(anchor.at)}  normal ${fmt(anchor.normal)}`)
