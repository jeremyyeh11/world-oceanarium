// Generate a stand-in East Pacific green turtle GLB until Jeremy's model is supplied.
//
//   node scripts/build-turtle-placeholder.mjs
//
// Written to public/models/fish/chelonia-mydas/chelonia-mydas_placeholder.glb to the foil-flap
// contract the real model follows (docs/procedural/foil-flap.md): one mesh, nose at -Z, up +Y,
// origin at the centre of the shell, 1 unit = 1 m with a 1 m straight shell length, no bones or
// clips, COLOR_0 absent (white), and the COLOR_1 masks computed per vertex: R (stroke) 0 at the
// fore-flipper's shoulder ring, 1 where the flipper leaves the shell, so the blade turns stiffly
// and the bend stays hidden inside; G (twist) a hair above 0 at the
// shoulder ring rising to 1 at the tip; B (rudder) the same along each hind flipper. The shell,
// head, neck and tail are black.
//
// A generic sea turtle in one flat colour: domed shell, swept fore-flippers, small hind paddles.
// It is scaffolding, not an anatomical model.
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

const ID = 'chelonia-mydas'
const BODY_MESH_NAME = 'turtle-placeholder'
const SHELL_HALF_LENGTH = 0.5
const SHELL_HALF_WIDTH = 0.4
const SHELL_TOP = 0.17
const SHELL_BOTTOM = 0.07
const BLACK = [0, 0, 0, 1]

function painted(geometry, mask) {
  geometry.deleteAttribute('uv')
  geometry.deleteAttribute('normal')
  const position = geometry.getAttribute('position')
  const masks = []
  for (let index = 0; index < position.count; index += 1) masks.push(...mask(index))
  geometry.setAttribute('color_1', new THREE.Float32BufferAttribute(masks, 4))
  return geometry
}

// Domed carapace over a flatter plastron, narrowing toward the tail.
function shellGeometry() {
  const geometry = new THREE.SphereGeometry(1, 18, 10)
  const position = geometry.getAttribute('position')
  for (let index = 0; index < position.count; index += 1) {
    const x = position.getX(index)
    const y = position.getY(index)
    const z = position.getZ(index)
    const rearTaper = 1 - 0.3 * Math.max(0, z)
    position.setXYZ(
      index,
      x * SHELL_HALF_WIDTH * rearTaper,
      y * (y > 0 ? SHELL_TOP : SHELL_BOTTOM),
      z * SHELL_HALF_LENGTH,
    )
  }
  return painted(geometry, () => BLACK)
}

function ellipsoid(center, radii, widthSegments = 10, heightSegments = 8) {
  const geometry = new THREE.SphereGeometry(1, widthSegments, heightSegments)
  geometry.scale(...radii)
  geometry.translate(...center)
  return painted(geometry, () => BLACK)
}

// A flattened blade from a root ring to a closed tip: `stations` span fractions (0 the root ring,
// sunk in the shell), each an elliptical section `chord` wide and `thickness` deep, the chord
// horizontal and the leading edge forward (-Z). `mask(s)` paints a station.
function bladeGeometry({ root, tip, bow, stations, chord, thickness, sides = 8, mask }) {
  const start = new THREE.Vector3(...root)
  const end = new THREE.Vector3(...tip)
  const span = end.clone().sub(start)
  const up = new THREE.Vector3(0, 1, 0)
  const back = new THREE.Vector3().crossVectors(up, span).normalize()
  if (back.z < 0) back.negate()
  const positions = []
  const masks = []
  const indices = []
  stations.forEach(s => {
    const center = start.clone().addScaledVector(span, s)
    // Bowed forward along the leading edge, as a flipper's front edge curves.
    center.z -= bow * Math.sin(Math.PI * s)
    const width = THREE.MathUtils.lerp(chord[0], chord[1], s)
    const depth = THREE.MathUtils.lerp(thickness[0], thickness[1], s)
    for (let k = 0; k < sides; k += 1) {
      const angle = (k / sides) * Math.PI * 2
      const point = center.clone()
        .addScaledVector(back, Math.cos(angle) * width * 0.5)
        .addScaledVector(up, Math.sin(angle) * depth * 0.5)
      positions.push(point.x, point.y, point.z)
      masks.push(...mask(s))
    }
  })
  for (let ring = 0; ring < stations.length - 1; ring += 1) {
    for (let k = 0; k < sides; k += 1) {
      const a = ring * sides + k
      const b = ring * sides + ((k + 1) % sides)
      const c = a + sides
      const d = b + sides
      indices.push(a, b, c, b, d, c)
    }
  }
  // Close the tip with a fan to one point just past the last ring.
  const tipCenter = start.clone().addScaledVector(span, 1.02)
  const tipIndex = positions.length / 3
  positions.push(tipCenter.x, tipCenter.y, tipCenter.z)
  masks.push(...mask(1))
  const last = (stations.length - 1) * sides
  for (let k = 0; k < sides; k += 1) indices.push(last + k, last + ((k + 1) % sides), tipIndex)
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('color_1', new THREE.Float32BufferAttribute(masks, 4))
  geometry.setIndex(indices)
  // Winding differs by side; flip the left so every face points out.
  if (root[0] < 0) {
    const index = geometry.getIndex()
    for (let i = 0; i < index.count; i += 3) {
      const b = index.getX(i + 1)
      index.setX(i + 1, index.getX(i + 2))
      index.setX(i + 2, b)
    }
  }
  return geometry
}

const smooth = (edge, s) => THREE.MathUtils.smoothstep(s, 0, edge)
// Dense at the shoulder, where the rotation starts. The shell margin crosses the blade at about
// 0.12 of its span.
const SHELL_MARGIN = 0.12
const FORE_STATIONS = [0, 0.05, SHELL_MARGIN, 0.2, 0.3, 0.42, 0.55, 0.68, 0.8, 0.9, 1]
const HIND_STATIONS = [0, 0.08, 0.25, 0.45, 0.65, 0.85, 1]

function turtleGeometry() {
  const parts = [
    shellGeometry(),
    // Head and neck, held level and a little proud of the shell's front edge.
    ellipsoid([0, 0.03, -0.66], [0.075, 0.065, 0.1]),
    ellipsoid([0, 0.02, -0.52], [0.07, 0.06, 0.1], 8, 6),
    // Short tail.
    ellipsoid([0, -0.01, 0.54], [0.035, 0.025, 0.08], 6, 4),
    ...[-1, 1].flatMap(side => [
      bladeGeometry({
        root: [side * 0.26, -0.01, -0.26],
        tip: [side * 0.86, -0.04, 0.02],
        bow: 0.07,
        stations: FORE_STATIONS,
        chord: [0.15, 0.05],
        thickness: [0.05, 0.01],
        mask: s => [smooth(SHELL_MARGIN, s), Math.max(0.002, s), 0, 1],
      }),
      bladeGeometry({
        root: [side * 0.17, -0.03, 0.36],
        tip: [side * 0.32, -0.04, 0.6],
        bow: 0.02,
        stations: HIND_STATIONS,
        chord: [0.1, 0.08],
        thickness: [0.035, 0.01],
        mask: s => [0, 0, Math.max(0.002, smooth(0.5, s)), 1],
      }),
    ]),
  ]
  const merged = mergeGeometries(parts)
  merged.computeVertexNormals()
  merged.computeBoundingBox()
  return merged
}

const mesh = new THREE.Mesh(
  turtleGeometry(),
  new THREE.MeshStandardMaterial({
    name: BODY_MESH_NAME,
    color: '#5f6146',
    roughness: 0.65,
    metalness: 0.02,
    flatShading: true,
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
