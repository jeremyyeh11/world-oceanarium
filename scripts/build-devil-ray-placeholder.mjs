// Generate a stand-in Munk's devil ray GLB until Jeremy's model is supplied.
//
//   node scripts/build-devil-ray-placeholder.mjs
//
// Written to public/models/fish/mobula-munkiana/mobula-munkiana_placeholder.glb to the same
// disc-wave contract the real model follows (docs/procedural/disc-wave.md, First animal): one
// mesh, nose at -Z, up +Y, origin at the centre of the disc, 1 unit = 1 m with a 1.3 m disc,
// grid quads across the wings, no bones or clips, COLOR_0 absent (white), and the COLOR_1
// masks painted per vertex: R 0 across the body rising to 1 at the wingtips, G 0 at a wing's
// leading edge to 1 at its trailing edge, B 0 at the tail root to 1 at its tip.
//
// The planform is a generic devil ray — swept, pointed wings, a short head with rolled cephalic
// fins, a small dorsal fin and a whip tail as long as the disc — in one flat colour. It is
// scaffolding, not an anatomical model.
import fs from 'node:fs'
import path from 'node:path'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js'

// GLTFExporter reads its binary output back through FileReader, which Node lacks.
globalThis.FileReader = class {
  readAsArrayBuffer(blob) {
    blob.arrayBuffer().then(buffer => {
      this.result = buffer
      this.onloadend?.()
    })
  }
}

const ID = 'mobula-munkiana'
const BODY_MESH_NAME = 'devil-ray-placeholder'
const HALF_SPAN = 0.65
// Half-width of the body's flat centre, where R stays 0: about the width of the head.
const BODY_HALF_WIDTH = 0.1
// Rings across the whole span (odd, so one runs down the midline) and divisions along the chord.
const SPAN_RINGS = 61
const CHORD_DIVISIONS = 24

// Leading and trailing edge (z) at a fraction of the half span, s = 0 midline to 1 tip.
// The head is blunt, the wings sweep back to a pointed tip, the trailing edge bows forward.
function leadingEdge(s) {
  return -0.27 + 0.39 * Math.pow(Math.max(0, s - 0.08) / 0.92, 1.25)
}
function trailingEdge(s) {
  return 0.22 - 0.1 * Math.pow(s, 1.6)
}
// Half thickness: a body bulge along the midline, a thin wing, closing at both edges.
function halfThickness(x, chord01) {
  const body = 0.055 * Math.exp(-((x / 0.11) ** 2))
  return (0.005 + body) * Math.pow(Math.sin(Math.PI * chord01), 0.6)
}
function spanWeight(x) {
  const t = THREE.MathUtils.clamp((Math.abs(x) - BODY_HALF_WIDTH) / (HALF_SPAN - BODY_HALF_WIDTH), 0, 1)
  return t * t * (3 - 2 * t)
}

function discGeometry() {
  const positions = []
  const masks = []
  const indices = []
  const rowLength = SPAN_RINGS
  // Top surface then bottom; the edge rows (chord 0 and 1) have zero thickness, so the two
  // surfaces meet there without a seam to weld.
  for (const side of [1, -1]) {
    const base = positions.length / 3
    for (let c = 0; c <= CHORD_DIVISIONS; c += 1) {
      const chord01 = c / CHORD_DIVISIONS
      for (let i = 0; i < SPAN_RINGS; i += 1) {
        const u = i / (SPAN_RINGS - 1) * 2 - 1
        const s = Math.abs(u)
        // Rings bunch slightly toward the tip, where the wing moves most.
        const x = Math.sign(u) * HALF_SPAN * Math.pow(s, 0.9)
        const sx = Math.abs(x) / HALF_SPAN
        // The tip closes to a point: shrink the chord to nothing at s = 1.
        const lead = leadingEdge(sx)
        const trail = Math.max(lead, trailingEdge(sx))
        const z = THREE.MathUtils.lerp(lead, trail, chord01)
        const y = side * halfThickness(x, chord01)
        positions.push(x, y, z)
        masks.push(spanWeight(x), chord01, 0, 1)
      }
    }
    for (let c = 0; c < CHORD_DIVISIONS; c += 1) {
      for (let i = 0; i < SPAN_RINGS - 1; i += 1) {
        const a = base + c * rowLength + i
        const b = a + 1
        const d = a + rowLength
        const e = d + 1
        if (side > 0) indices.push(a, d, b, b, d, e)
        else indices.push(a, b, d, b, e, d)
      }
    }
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('color_1', new THREE.Float32BufferAttribute(masks, 4))
  geometry.setIndex(indices)
  return geometry
}

// A tapered tube along +Z (the tail), or any axis-aligned horn, with B or R painted along it.
function taperedTube({ from, to, radius0, radius1, segments = 18, sides = 6, mask }) {
  const geometry = new THREE.CylinderGeometry(radius1, radius0, 1, sides, segments, false)
  // Cylinder runs along Y from -0.5 to 0.5; lay it from `from` to `to`.
  geometry.translate(0, 0.5, 0)
  const start = new THREE.Vector3(...from)
  const end = new THREE.Vector3(...to)
  const direction = end.clone().sub(start)
  geometry.scale(1, direction.length(), 1)
  geometry.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.clone().normalize()))
  geometry.translate(start.x, start.y, start.z)
  const position = geometry.getAttribute('position')
  const masks = []
  for (let index = 0; index < position.count; index += 1) {
    const along = new THREE.Vector3().fromBufferAttribute(position, index).sub(start).dot(direction) / direction.lengthSq()
    masks.push(...mask(THREE.MathUtils.clamp(along, 0, 1), position.getX(index)))
  }
  geometry.setAttribute('color_1', new THREE.Float32BufferAttribute(masks, 4))
  geometry.deleteAttribute('uv')
  geometry.deleteAttribute('normal')
  return geometry
}

// The small dorsal fin at the base of the tail: a thin upright triangle.
function dorsalFin() {
  const positions = [
    0, 0.03, 0.12, 0, 0.085, 0.2, 0, 0.03, 0.21,
    0, 0.03, 0.12, 0, 0.03, 0.21, 0, 0.085, 0.2,
  ]
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('color_1', new THREE.Float32BufferAttribute(new Array(6).fill([0, 1, 0, 1]).flat(), 4))
  geometry.setIndex([0, 1, 2, 3, 4, 5])
  return geometry
}

function devilRayGeometry() {
  const parts = [
    discGeometry(),
    dorsalFin(),
    // The whip tail, about as long as the disc is wide, from the back of the body.
    taperedTube({ from: [0, 0.01, 0.2], to: [0, 0.0, 1.45], radius0: 0.012, radius1: 0.0015, segments: 24, mask: t => [0, 1, t, 1] }),
    // Cephalic fins rolled into horns, pointing forward either side of the mouth.
    ...[-1, 1].map(side => taperedTube({
      from: [side * 0.075, 0.0, -0.24],
      to: [side * 0.085, -0.005, -0.33],
      radius0: 0.018,
      radius1: 0.008,
      segments: 4,
      mask: () => [0, 0, 0, 1],
    })),
  ]
  const merged = mergeGeometries(parts)
  merged.computeVertexNormals()
  merged.computeBoundingBox()
  return merged
}

const mesh = new THREE.Mesh(
  devilRayGeometry(),
  new THREE.MeshStandardMaterial({
    name: BODY_MESH_NAME,
    // Purplish grey-brown, the upper side's colour; the white belly comes with the real model.
    color: '#5a4f5c',
    roughness: 0.6,
    metalness: 0.02,
  }),
)
mesh.name = BODY_MESH_NAME
const scene = new THREE.Scene()
scene.add(mesh)
const glb = await new GLTFExporter().parseAsync(scene, { binary: true })
const outDir = path.join('public', 'models', 'fish', ID)
fs.mkdirSync(outDir, { recursive: true })
const outPath = path.join(outDir, `${ID}_placeholder.glb`)
fs.writeFileSync(outPath, Buffer.from(glb))
const box = mesh.geometry.boundingBox
console.log(`${outPath}  ${mesh.geometry.getAttribute('position').count} verts  x ${box.min.x.toFixed(3)}..${box.max.x.toFixed(3)}  z ${box.min.z.toFixed(3)}..${box.max.z.toFixed(3)}  ${(glb.byteLength / 1024).toFixed(1)} KB`)
