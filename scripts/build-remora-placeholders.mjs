// Generate stand-in remora GLBs until the real models are supplied.
//
//   node scripts/build-remora-placeholders.mjs
//
// One static, rig-free mesh per remora species (every species whose `placeholder.type` is
// 'remora'), written to public/models/fish/<id>/<id>_placeholder.glb. They follow the same
// asset contract the real models will (docs/procedural/README.md): unit length along Z,
// nose at -Z, up +Y, origin mid-body, no bones or clips, a single body mesh so the whole
// animal — fins included — rides the caudal-vertex wave. The suction disc sits on the head
// at the species' `hitchhiker.discAheadBodyLengths` and spans `placeholder.discLength`, so a
// clamped placeholder already lies with its disc on the host's skin.
//
// Shape is deliberately generic — slender body, flat disc, long low second dorsal and anal
// fins, forked tail — and coloured per species. It is scaffolding, not an anatomical model.
import fs from 'node:fs'
import path from 'node:path'
import * as THREE from 'three'
import { mergeGeometries, mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js'
import { SPECIES } from '../src/data/species.js'

// GLTFExporter reads its binary output back through FileReader, which Node lacks.
globalThis.FileReader = class {
  readAsArrayBuffer(blob) {
    blob.arrayBuffer().then(buffer => {
      this.result = buffer
      this.onloadend?.()
    })
  }
}

const BODY_MESH_NAME = 'remora-placeholder'
const RING_SEGMENTS = 20
// Height of the disc's top above the body axis, in body lengths. The ride system's default
// dorsal clearance (RIDE_DEFAULT_DORSAL_CLEARANCE_BODY_LENGTHS in fishSwim.js) is this same
// number, so a clamped stand-in's disc lies exactly on the host's skin.
const DISC_TOP = 0.058
// Half-width / half-height of the body along its length, t = 0 at the snout. Slender, with a
// broad flat head (the disc sits on it), tapering to a thin caudal peduncle.
const PROFILE = [
  [0.0, 0.0032, 0.0026],
  [0.03, 0.024, 0.017],
  [0.08, 0.044, 0.031],
  [0.15, 0.054, 0.041],
  [0.25, 0.059, 0.048],
  [0.4, 0.058, 0.051],
  [0.55, 0.05, 0.048],
  [0.68, 0.037, 0.039],
  [0.78, 0.022, 0.027],
  [0.86, 0.011, 0.017],
]

function profileAt(t) {
  for (let i = 1; i < PROFILE.length; i += 1) {
    const [t1, w1, h1] = PROFILE[i]
    const [t0, w0, h0] = PROFILE[i - 1]
    if (t <= t1) {
      const u = (t - t0) / (t1 - t0)
      const s = u * u * (3 - 2 * u)
      return [w0 + (w1 - w0) * s, h0 + (h1 - h0) * s]
    }
  }
  const [, w, h] = PROFILE.at(-1)
  return [w, h]
}

// Lofted body: rings of ellipses from snout to peduncle, capped at both ends.
function bodyGeometry() {
  const tEnd = PROFILE.at(-1)[0]
  const rings = []
  for (let i = 0; i <= 40; i += 1) {
    // Denser rings at the snout, where the profile curves fastest.
    const u = i / 40
    rings.push(tEnd * (1 - Math.cos((u * Math.PI) / 2)) ** 0.85)
  }
  const positions = []
  const indices = []
  for (const t of rings) {
    const [w, h] = profileAt(t)
    for (let j = 0; j < RING_SEGMENTS; j += 1) {
      const theta = (j / RING_SEGMENTS) * Math.PI * 2
      positions.push(w * Math.cos(theta), h * Math.sin(theta), -0.5 + t)
    }
  }
  const ring = (i, j) => i * RING_SEGMENTS + (j % RING_SEGMENTS)
  for (let i = 0; i < rings.length - 1; i += 1) {
    for (let j = 0; j < RING_SEGMENTS; j += 1) {
      indices.push(ring(i, j), ring(i + 1, j), ring(i, j + 1))
      indices.push(ring(i, j + 1), ring(i + 1, j), ring(i + 1, j + 1))
    }
  }
  const snout = positions.length / 3
  positions.push(0, 0, -0.5)
  const tail = snout + 1
  positions.push(0, 0, -0.5 + tEnd)
  const last = rings.length - 1
  for (let j = 0; j < RING_SEGMENTS; j += 1) {
    indices.push(snout, ring(0, j), ring(0, j + 1))
    indices.push(tail, ring(last, j + 1), ring(last, j))
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  // Wind outward: a vertex on the +X side of a mid-body ring must face +X.
  const probe = ring(20, 0)
  if (geometry.getAttribute('normal').getX(probe) < 0) {
    const index = geometry.getIndex()
    for (let k = 0; k < index.count; k += 3) {
      const a = index.getX(k + 1)
      index.setX(k + 1, index.getX(k + 2))
      index.setX(k + 2, a)
    }
    geometry.computeVertexNormals()
  }
  return geometry
}

// A thin fin from an outline in the (z, y) side plane, `thickness` across X.
function sideFin(outline, thickness) {
  const shape = new THREE.Shape(outline.map(([z, y]) => new THREE.Vector2(z, y)))
  const geometry = new THREE.ExtrudeGeometry(shape, { depth: thickness, bevelEnabled: false })
  // Shape X -> model Z, extrusion -> model X, centred on the midline.
  geometry.rotateY(-Math.PI / 2)
  geometry.translate(thickness / 2, 0, 0)
  return geometry
}

// A thin fin from an outline in the (x, z) plane at height y, `thickness` downward.
function flatFin(outline, y, thickness) {
  const shape = new THREE.Shape(outline.map(([x, z]) => new THREE.Vector2(x, z)))
  const geometry = new THREE.ExtrudeGeometry(shape, { depth: thickness, bevelEnabled: false })
  // Shape Y -> model Z, extrusion -> model -Y.
  geometry.rotateX(Math.PI / 2)
  geometry.translate(0, y, 0)
  return geometry
}

// A low dome from just inside the head up to DISC_TOP, so it always meets the head and its
// top is always at the clearance the ride system assumes.
function discGeometry(discAhead, discLength) {
  const centerT = 0.5 - discAhead
  const [headWidth, headHeight] = profileAt(centerT)
  const bottom = headHeight - 0.004
  const disc = new THREE.SphereGeometry(0.5, 24, 8)
  disc.scale(headWidth * 1.3, DISC_TOP - bottom, discLength)
  disc.translate(0, (DISC_TOP + bottom) / 2, -discAhead)
  return disc
}

function remoraGeometry(discAhead, discLength) {
  const parts = [
    bodyGeometry(),
    discGeometry(discAhead, discLength),
    // Forked caudal fin from the peduncle back to the tail tip at z = +0.5.
    sideFin([[0.34, 0.015], [0.5, 0.078], [0.45, 0], [0.5, -0.078], [0.34, -0.015]], 0.005),
    // Long, low second dorsal and anal fins, mirror images of each other.
    sideFin([[-0.06, 0.043], [-0.04, 0.076], [0.27, 0.047], [0.31, 0.019], [0.3, 0.015], [-0.06, 0.036]], 0.004),
    sideFin([[-0.06, -0.043], [-0.04, -0.076], [0.27, -0.047], [0.31, -0.019], [0.3, -0.015], [-0.06, -0.036]], 0.004),
    // Small pectoral fins angled back from behind the head.
    flatFin([[0.045, -0.31], [0.12, -0.2], [0.045, -0.25]], -0.01, 0.004),
    flatFin([[-0.045, -0.31], [-0.12, -0.2], [-0.045, -0.25]], -0.01, 0.004),
  ].map(part => {
    part.deleteAttribute('uv')
    return part.index ? part : mergeVertices(part)
  })
  const merged = mergeGeometries(parts)
  merged.computeBoundingBox()
  return merged
}

const exporter = new GLTFExporter()
const remoras = SPECIES.filter(species => species.placeholder?.type === 'remora')
for (const species of remoras) {
  const discAhead = species.hitchhiker?.discAheadBodyLengths ?? 0.3
  const discLength = species.placeholder.discLength ?? 0.25
  const mesh = new THREE.Mesh(
    remoraGeometry(discAhead, discLength),
    new THREE.MeshStandardMaterial({
      name: BODY_MESH_NAME,
      color: species.placeholder.bodyColor ?? '#5f666d',
      roughness: 0.55,
      metalness: 0.05,
    }),
  )
  mesh.name = BODY_MESH_NAME
  const scene = new THREE.Scene()
  scene.add(mesh)
  const glb = await exporter.parseAsync(scene, { binary: true })
  const outDir = path.join('public', 'models', 'fish', species.id)
  fs.mkdirSync(outDir, { recursive: true })
  const outPath = path.join(outDir, `${species.id}_placeholder.glb`)
  fs.writeFileSync(outPath, Buffer.from(glb))
  const box = mesh.geometry.boundingBox
  console.log(`${outPath}  ${mesh.geometry.getAttribute('position').count} verts  z ${box.min.z.toFixed(3)}..${box.max.z.toFixed(3)}  ${(glb.byteLength / 1024).toFixed(1)} KB`)
}
