import * as THREE from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'

const STEM_WIDTH = 0.15

function starterBlade() {
  const widths = [0.08, 0.38, 0.49, 0.44, 0.52, 0.37, 0.29, 0.16, 0.01]
  const card = new THREE.PlaneGeometry(1, 1, 2, widths.length - 1).translate(0, 0.5, 0)
  const vertices = card.attributes.position
  for (let i = 0; i < vertices.count; i += 1) {
    const y = vertices.getY(i)
    const edge = vertices.getX(i) * 2
    const width = widths[Math.round(y * (widths.length - 1))]
    const x = edge * width + Math.sin(y * 7) * 0.11
    const z = edge === 0 ? width * 0.16 : Math.sin(y * 23 + edge) * width * 0.24
    vertices.setXYZ(i, x, y, z)
  }
  const float = new THREE.SphereGeometry(1, 6, 4).scale(0.115, 0.038, 0.10).translate(0.022, 0.052, 0)
  const geometry = mergeGeometries([card, float])
  card.dispose()
  float.dispose()
  return geometry
}

export function makeKelpTemplate(gltf, isStem) {
  let mesh
  gltf?.scene.traverse(object => {
    if (!object.isMesh) return
    if (mesh || Array.isArray(object.material)) throw new Error('Kelp assets need one mesh with one material')
    mesh = object
  })
  if (gltf && !mesh) throw new Error('Kelp asset has no mesh')
  // One span per link keeps the starter stem's triangle count at sixteen spans.
  const source = mesh?.geometry ?? (isStem ? new THREE.CylinderGeometry(0.5, 0.5, 1, 5, 1, true) : starterBlade())
  const material = mesh?.material.clone() ?? new THREE.MeshStandardMaterial({
    color: isStem ? '#77612e' : '#998338', roughness: 0.83, envMapIntensity: 0.32,
  })
  material.side = isStem ? THREE.FrontSide : THREE.DoubleSide
  material.flatShading = true
  material.vertexColors = true

  const vertices = source.attributes.position
  const bounds = new THREE.Box3().setFromBufferAttribute(vertices)
  const length = bounds.max.y - bounds.min.y
  const width = Math.max(bounds.max.x - bounds.min.x, bounds.max.z - bounds.min.z)
  if (!(length > 0 && width > 0)) throw new Error('Kelp assets need length on +Y and width on X or Z')
  const rows = new Map()
  for (let i = 0; i < vertices.count; i += 1) {
    const y = vertices.getY(i)
    const t = (y - bounds.min.y) / length
    if (!rows.has(t)) rows.set(t, [])
    rows.get(t).push({ i, x: vertices.getX(i) / width, z: vertices.getZ(i) / width })
  }
  const indices = source.index ? Array.from(source.index.array) : Array.from({ length: vertices.count }, (_, i) => i)
  const template = { material, rows, count: vertices.count, indices, uv: source.attributes.uv, color: source.attributes.color, isStem }
  if (!mesh) source.dispose()
  return template
}

const acrossStem = new THREE.Vector3(1, 0, 0)
const up = new THREE.Vector3(0, 1, 0)
const center = new THREE.Vector3()
const tangent = new THREE.Vector3()
const before = new THREE.Vector3()
const across = new THREE.Vector3()
const normal = new THREE.Vector3()

function writeSegment(position, rows, start, curve, segment, segmentCount, width, reference) {
  for (const [t, vertices] of rows) {
    const u = (segment + t) / segmentCount
    curve.getPoint(u, center)
    curve.getPoint(Math.max(0, u - 0.001), before)
    curve.getPoint(Math.min(1, u + 0.001), tangent).sub(before).normalize()
    across.copy(Math.abs(tangent.dot(reference)) < 0.98 ? reference : up)
    across.addScaledVector(tangent, -across.dot(tangent)).normalize()
    normal.crossVectors(across, tangent)
    for (const { i, x, z } of vertices) {
      position.setXYZ(start + i,
        center.x + width * (x * across.x + z * normal.x),
        center.y + width * (x * across.y + z * normal.y),
        center.z + width * (x * across.z + z * normal.z),
      )
    }
  }
}

export function makeKelpBatch(template, plants) {
  const { material, rows, count, uv, color, isStem } = template
  const sections = plants.flatMap(plant => {
    plant.skin ??= []
    if (!isStem) return plant.blades.map(blade => ({ plant, ...blade, repeats: 1 }))
    return [{ plant, points: plant.stalk, across: acrossStem, width: STEM_WIDTH, shade: 0.9, repeats: plant.stalk.length - 1 }]
  })
  const vertexCount = sections.reduce((total, section) => total + section.repeats * count, 0)
  const geometry = new THREE.BufferGeometry()
  const position = new THREE.BufferAttribute(new Float32Array(vertexCount * 3), 3).setUsage(THREE.DynamicDrawUsage)
  const uvs = new THREE.BufferAttribute(new Float32Array(vertexCount * 2), 2)
  const colors = new THREE.BufferAttribute(new Float32Array(vertexCount * 3), 3)
  const indices = []
  let start = 0
  for (const section of sections) {
    const { plant, points, width, shade, repeats, across: reference } = section
    const curve = new THREE.CatmullRomCurve3(points, false, 'catmullrom', 0.45)
    const offset = start
    const write = () => {
      for (let i = 0; i < repeats; i += 1) writeSegment(position, rows, offset + i * count, curve, i, repeats, width, reference)
    }
    plant.skin.push(write)
    write()
    for (let repeat = 0; repeat < repeats; repeat += 1) {
      for (const index of template.indices) indices.push(start + index)
      for (let i = 0; i < count; i += 1) {
        if (uv) uvs.setXY(start + i, uv.getX(i), uv.getY(i))
        colors.setXYZ(start + i, shade * (color?.getX(i) ?? 1), shade * (color?.getY(i) ?? 1), shade * (color?.getZ(i) ?? 1))
      }
      start += count
    }
  }
  geometry.setIndex(indices)
  geometry.setAttribute('position', position)
  geometry.setAttribute('uv', uvs)
  geometry.setAttribute('color', colors)
  const mesh = new THREE.Mesh(geometry, material)
  mesh.name = isStem ? 'kelp-stipes' : 'kelp-blades'
  // A bed can bend outside its original mesh bounds. The runtime tests padded moving plant
  // bounds before deforming, and updates draw bounds only when part of the bed moves.
  return mesh
}
