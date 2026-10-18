import { useEffect, useLayoutEffect, useMemo } from 'react'
import * as THREE from 'three'
import { useGLTF, useTexture } from '@react-three/drei'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { LANDSCAPES, landscapePieces, rubblePieces, seededRandom } from '../data/landscapes'
import { clearReefSurfaces, setReefSurfaces } from './reefSites'

// Rocks for a tank landscape (src/data/landscapes.js), kitbashed from the landscape's kit of
// modelled rocks. Every piece and rubble chunk is transformed, given fresh UVs and baked into
// a few chunk meshes (one draw call each, culled when off screen).

const scratchA = new THREE.Vector3()
const scratchB = new THREE.Vector3()
const scratchC = new THREE.Vector3()

// Base orientations a rock can be laid in before its spin: upright, on either side, or upside
// down. Tall kinds stay upright so cliffs and bommies keep their silhouette.
const LAYS = [[0, 0, 0], [Math.PI / 2, 0, 0], [-Math.PI / 2, 0, 0], [0, 0, Math.PI / 2], [0, 0, -Math.PI / 2], [Math.PI, 0, 0]]
const UPRIGHT_KINDS = new Set(['cliff', 'bommie'])
const FIT_CANDIDATES = 8
const UP = new THREE.Vector3(0, 1, 0)

// Size of a rock's bounds once rotated.
function rotatedSize(geometry, quaternion) {
  const position = geometry.attributes.position
  const min = new THREE.Vector3(Infinity, Infinity, Infinity)
  const max = new THREE.Vector3(-Infinity, -Infinity, -Infinity)
  for (let i = 0; i < position.count; i++) {
    scratchA.fromBufferAttribute(position, i).applyQuaternion(quaternion)
    min.min(scratchA)
    max.max(scratchA)
  }
  return max.sub(min)
}

// How unevenly a rock of this size has to stretch to fill a piece's box (1 = uniform).
function stretchOf(size, piece) {
  const scales = [piece.width / size.x, piece.height / size.y, piece.depth / size.z]
  return Math.max(...scales) / Math.min(...scales)
}

// Seeded per-piece choices: which kit rock, how it is laid, spun and tilted before it is
// fitted to its box, and where its texture starts. Several rock-and-orientation candidates
// are tried and the one needing the least uneven stretch wins, so a tall slot gets a tall
// rock and a low mound gets a rock laid on its side rather than a squashed spire.
function pieceLook(kit, piece, rocks) {
  const rand = seededRandom((piece.seed * 2654435761) >>> 0)
  const variants = kit.variants[piece.kind] ?? kit.variants.boulder
  const uvOffset = [rand(), rand()]
  if (piece.kind === 'rubble') {
    const rotation = new THREE.Quaternion().setFromEuler(new THREE.Euler(rand() * Math.PI * 2, rand() * Math.PI * 2, rand() * Math.PI * 2))
    return { rock: variants[Math.floor(rand() * variants.length)], rotation, uvOffset }
  }
  const tilt = kit.tilt[piece.kind] ?? 0.2
  let best = null
  for (let c = 0; c < FIT_CANDIDATES; c++) {
    const rock = variants[Math.floor(rand() * variants.length)]
    const lay = UPRIGHT_KINDS.has(piece.kind) ? LAYS[0] : LAYS[Math.floor(rand() * LAYS.length)]
    const rotation = new THREE.Quaternion().setFromAxisAngle(UP, rand() * Math.PI * 2)
      .multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler((rand() * 2 - 1) * tilt, 0, (rand() * 2 - 1) * tilt)))
      .multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(...lay)))
    const stretch = stretchOf(rotatedSize(rocks[`rock${rock}_lo`], rotation), piece)
    if (!best || stretch < best.stretch) best = { rock, rotation, stretch }
  }
  return { ...best, uvOffset }
}

// Fits a kit rock to a piece: rotate it, squeeze its bounds into the piece's box with the base
// at 0, then yaw and place it. No axis stretches more than maxStretch times another: the
// longer axes are shrunk instead, so a piece only ever gets smaller than its box and its
// clearance from the swim volume holds.
function placeRock(source, piece, rotation, maxStretch) {
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', source.attributes.position.clone())
  geometry.setAttribute('normal', source.attributes.normal.clone())
  geometry.setIndex(source.index.clone())
  geometry.applyQuaternion(rotation)
  geometry.computeBoundingBox()
  const box = geometry.boundingBox
  const size = box.getSize(new THREE.Vector3())
  const center = box.getCenter(new THREE.Vector3())
  const scales = [piece.width / size.x, piece.height / size.y, piece.depth / size.z]
  const cap = Math.min(...scales) * maxStretch
  geometry.translate(-center.x, -box.min.y, -center.z)
  geometry.scale(...scales.map(scale => Math.min(scale, cap)))
  geometry.rotateY(piece.yaw)
  geometry.translate(piece.x, piece.y, piece.z)
  return geometry
}

// Cube-projects UVs in world space, after the rock has been stretched, so the texture keeps
// one size on every rock (Blender's Cube Projection). Each triangle maps along the axis its
// face points most along; a vertex shared by triangles on different axes is split, so each
// projection keeps its own UV. Signs follow the face direction so the normal map's bumps
// stay the right way round on opposite faces.
function projectUVs(geometry, tile, [offsetU, offsetV]) {
  const position = geometry.attributes.position
  const normal = geometry.attributes.normal
  const index = geometry.index.array
  const remap = new Map()
  const positions = []
  const normals = []
  const uvs = []
  const indices = new Uint32Array(index.length)
  for (let t = 0; t < index.length; t += 3) {
    scratchA.fromBufferAttribute(position, index[t])
    scratchB.fromBufferAttribute(position, index[t + 1]).sub(scratchA)
    scratchC.fromBufferAttribute(position, index[t + 2]).sub(scratchA)
    scratchB.cross(scratchC)
    const ax = Math.abs(scratchB.x)
    const ay = Math.abs(scratchB.y)
    const az = Math.abs(scratchB.z)
    const axis = ax >= ay && ax >= az ? 0 : ay >= az ? 1 : 2
    const sign = Math.sign(axis === 0 ? scratchB.x : axis === 1 ? scratchB.y : scratchB.z) || 1
    for (let k = 0; k < 3; k++) {
      const vertex = index[t + k]
      const key = vertex * 6 + axis * 2 + (sign > 0 ? 1 : 0)
      let mapped = remap.get(key)
      if (mapped === undefined) {
        mapped = positions.length / 3
        remap.set(key, mapped)
        const x = position.getX(vertex)
        const y = position.getY(vertex)
        const z = position.getZ(vertex)
        positions.push(x, y, z)
        normals.push(normal.getX(vertex), normal.getY(vertex), normal.getZ(vertex))
        const [u, v] = axis === 0 ? [-sign * z, y] : axis === 1 ? [x, -sign * z] : [sign * x, y]
        uvs.push(u / tile + offsetU, v / tile + offsetV)
      }
      indices[t + k] = mapped
    }
  }
  const projected = new THREE.BufferGeometry()
  projected.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  projected.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3))
  projected.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
  projected.setIndex(new THREE.BufferAttribute(indices, 1))
  return projected
}

// Painted light and shadow on the rock (a landscape's `rockShade`): the scene lights alone leave the
// limestone one even mid value, where a reef under sun reads as dark rock with sunlit tops.
// Darkens the whole rock by `tone`, its downward faces toward `underside` and its upward ones
// up to `top`, and its lower reaches toward `low` (from `lowY` up to `highY`, world y). The
// baked chunks are in world space, so the vertex normal and position are already world ones.
function applyRockShade(material, shade) {
  if (!shade) return
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying float vRockUp;\nvarying float vRockY;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvRockUp = normal.y;\nvRockY = position.y;')
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying float vRockUp;\nvarying float vRockY;')
      .replace('#include <map_fragment>', `#include <map_fragment>
        float rockFacing = mix(${shade.underside.toFixed(3)}, ${shade.top.toFixed(3)}, smoothstep(-0.5, 0.8, vRockUp));
        float rockHeight = mix(${shade.low.toFixed(3)}, 1.0, smoothstep(${shade.lowY.toFixed(2)}, ${shade.highY.toFixed(2)}, vRockY));
        diffuseColor.rgb *= ${shade.tone.toFixed(3)} * rockFacing * rockHeight;`)
  }
  material.customProgramCacheKey = () => `rock-shade:${JSON.stringify(shade)}`
}

// Whether a piece's box reaches into the landscape's reef reach (see reefSites.js).
function inReefReach(reach, piece) {
  if (!reach || piece.kind === 'rubble') return false
  const r = Math.max(piece.width, piece.depth) / 2
  return piece.x + r > reach.xMin && piece.x - r < reach.xMax
    && piece.z + r > reach.zMin && piece.z - r < reach.zMax
    && piece.y + piece.height > reach.yMin && piece.y < reach.yMax
}

function makeLandscapeChunks(landscape, rocks) {
  const { kit } = landscape
  const camera = new THREE.Vector3(0, landscape.view?.y ?? -3.35, landscape.view?.z ?? 10)
  const pieces = [...landscapePieces(landscape), ...(landscape.rubble ? rubblePieces(landscape) : [])]
  const chunks = new Map()
  // The placed rocks reef fish can reach, kept whole (not merged) for their raycasts.
  const reefSurfaces = []
  // How far each placed rock's real top sits below its box top (rocks shrink to fit their
  // box), so a stacked tier can be dropped onto the rock it rests on.
  const topShortfall = new Map()
  for (const piece of pieces) {
    const look = pieceLook(kit, piece, rocks)
    const near = camera.distanceTo(scratchA.set(piece.x, piece.y + piece.height / 2, piece.z)) < kit.hiDetailDistance
    const lod = piece.kind === 'rubble' ? 'rubble' : near ? 'hi' : 'lo'
    const source = rocks[`rock${look.rock}_${lod}`] ?? rocks[`rock${look.rock}_lo`]
    const placed = placeRock(source, piece, look.rotation, piece.kind === 'rubble' ? Infinity : kit.maxStretch[piece.kind] ?? 2)
    const drop = topShortfall.get(piece.restsOn) ?? 0
    if (drop > 0) placed.translate(0, -drop, 0)
    placed.computeBoundingBox()
    topShortfall.set(piece.seed, piece.top - placed.boundingBox.max.y)
    const projected = projectUVs(placed, kit.textureTileWU, look.uvOffset)
    if (inReefReach(landscape.reefReach, piece)) reefSurfaces.push(placed)
    else placed.dispose()
    const key = `${Math.floor(piece.x / kit.chunkWU)}:${Math.floor(piece.z / kit.chunkWU)}`
    if (!chunks.has(key)) chunks.set(key, [])
    chunks.get(key).push(projected)
  }
  const merged = [...chunks].map(([key, parts]) => {
    const geometry = mergeGeometries(parts)
    parts.forEach(part => part.dispose())
    geometry.computeBoundingSphere()
    return { key, geometry }
  })
  return { chunks: merged, reefSurfaces }
}

export default function Landscape({ landscape }) {
  const { kit } = landscape
  const gltf = useGLTF(kit.path)
  const textures = useTexture(kit.textures)
  const rocks = useMemo(() => {
    const byName = {}
    gltf.scene.traverse(object => { if (object.isMesh) byName[object.name] = object.geometry })
    return byName
  }, [gltf])

  const material = useMemo(() => {
    for (const texture of Object.values(textures)) {
      texture.wrapS = THREE.RepeatWrapping
      texture.wrapT = THREE.RepeatWrapping
      texture.anisotropy = 4
      texture.needsUpdate = true
    }
    textures.color.colorSpace = THREE.SRGBColorSpace
    // Roughness is read from the green channel; the greyscale map has it in all three.
    const rockMaterial = new THREE.MeshStandardMaterial({
      map: textures.color, normalMap: textures.normal, roughnessMap: textures.roughness,
      roughness: 1, metalness: 0, envMapIntensity: 0.35,
    })
    applyRockShade(rockMaterial, landscape.rockShade)
    return rockMaterial
  }, [textures, landscape.rockShade])
  const { chunks, reefSurfaces } = useMemo(() => makeLandscapeChunks(landscape, rocks), [landscape, rocks])

  // Built imperatively, so R3F won't dispose them; free them when the tank unmounts.
  useEffect(() => () => material.dispose(), [material])
  useEffect(() => () => chunks.forEach(chunk => chunk.geometry.dispose()), [chunks])
  // Reef fish raycast the rocks they can reach (reefSites.js) for as long as the tank is up.
  useLayoutEffect(() => {
    const owner = setReefSurfaces(reefSurfaces)
    return () => clearReefSurfaces(owner)
  }, [reefSurfaces])
  useEffect(() => () => reefSurfaces.forEach(geometry => geometry.dispose()), [reefSurfaces])

  return (
    <group>
      {chunks.map(chunk => <mesh key={chunk.key} geometry={chunk.geometry} material={material} />)}
    </group>
  )
}

// Fetch the rock kits with the rest of the tank's assets, so the landing gate's progress
// covers them and the first visit to a landscaped tank does not pop the rocks in late.
for (const { kit } of Object.values(LANDSCAPES)) {
  if (!kit) continue
  useGLTF.preload(kit.path)
  useTexture.preload(Object.values(kit.textures))
}
