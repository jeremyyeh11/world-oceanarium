import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { mergeGeometries, mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { landscapePieces, sandHeight, seededRandom } from '../data/landscapes'

// Placeholder rocks for a tank landscape (src/data/landscapes.js), standing in for the
// modelled GLBs until they land. Each piece is a seeded, displaced icosahedron, so the same
// seed always builds the same rock. All pieces are baked into one mesh (one draw call); the
// rubble is a second, instanced one.
//
// taper widens the top (a bommie's overhang); flatBottom squashes everything below it so the
// rock sits flat on the sand instead of balancing on a point. column pushes the sphere out
// toward a cylinder, so a tall cliff keeps steep sides and a broad top instead of tapering
// to a spike.
// detail sets the triangle count, 20 × (detail + 1)²: with about 170 pieces in one tank,
// keep it low enough for phones (about 130k triangles for The Reefs).
const ROCK_PROFILES = {
  boulder: { detail: 4, roughness: 0.42, taper: 0, flatBottom: -0.4 },
  bommie: { detail: 6, roughness: 0.5, taper: 0.55, flatBottom: -0.7 },
  wall: { detail: 6, roughness: 0.55, taper: 0.35, flatBottom: -0.55 },
  cliff: { detail: 6, roughness: 0.42, taper: 0.1, flatBottom: -0.85, column: 0.75 },
  rubble: { detail: 0, roughness: 0.4, taper: 0, flatBottom: -0.3 },
}

const ROCK_COLOR = '#b3a88e'
const scratch = new THREE.Vector3()

// Builds a rock in a unit box: x and z span [-0.5, 0.5], y spans [0, 1] with the base at 0,
// so a scale of [width, height, depth] gives the piece its size in WU directly.
function makeRockGeometry(kind, seed) {
  const profile = ROCK_PROFILES[kind] ?? ROCK_PROFILES.boulder
  const rand = seededRandom(seed)
  const octaves = [0, 1, 2, 3].map(() => [
    0.8 + rand() * 0.8, 0.8 + rand() * 0.8, 0.8 + rand() * 0.8,
    rand() * Math.PI * 2, rand() * Math.PI * 2, rand() * Math.PI * 2,
  ])
  // Icosahedron geometry is non-indexed: a vertex shared by several faces exists once per
  // face. The displacement is a smooth function of position, so those copies move together
  // and the surface never cracks; they are welded afterwards to cut the vertex count about
  // six-fold. The material's flatShading keeps the faceted look without split normals.
  const source = new THREE.IcosahedronGeometry(1, profile.detail)
  const sourcePos = source.attributes.position
  for (let i = 0; i < sourcePos.count; i++) {
    scratch.fromBufferAttribute(sourcePos, i).normalize()
    let n = 0
    let amp = 1
    let freq = 1.6
    for (const [fx, fy, fz, px, py, pz] of octaves) {
      n += amp * 0.5 * (
        Math.sin(scratch.x * freq * fx + px) * Math.sin(scratch.y * freq * fy + py)
        + Math.sin(scratch.z * freq * fz + pz)
      )
      amp *= 0.55
      freq *= 2.3
    }
    if (profile.column) {
      const ring = Math.hypot(scratch.x, scratch.z)
      const widen = THREE.MathUtils.lerp(1, 1 / Math.max(ring, 0.3), profile.column)
      scratch.x *= widen
      scratch.z *= widen
    }
    scratch.multiplyScalar((1 + profile.roughness * n) * (1 + profile.taper * scratch.y))
    if (scratch.y < profile.flatBottom) scratch.y = profile.flatBottom + (scratch.y - profile.flatBottom) * 0.15
    sourcePos.setXYZ(i, scratch.x, scratch.y, scratch.z)
  }
  source.deleteAttribute('normal')
  source.deleteAttribute('uv')
  const geometry = mergeVertices(source)
  source.dispose()
  const pos = geometry.attributes.position

  geometry.computeBoundingBox()
  const box = geometry.boundingBox
  const size = box.getSize(new THREE.Vector3())
  const center = box.getCenter(new THREE.Vector3())
  geometry.translate(-center.x, -box.min.y, -center.z)
  geometry.scale(1 / size.x, 1 / size.y, 1 / size.z)
  geometry.computeVertexNormals()

  // Light tops, dark undersides and base: reads as sunlit rock with shaded overhangs even
  // before textures.
  const normals = geometry.attributes.normal
  const colors = new Float32Array(pos.count * 3)
  const tint = 0.94 + rand() * 0.12
  for (let i = 0; i < pos.count; i++) {
    const shade = THREE.MathUtils.clamp(0.5 + normals.getY(i) * 0.28 + pos.getY(i) * 0.22, 0.2, 1)
    colors[i * 3] = shade * tint
    colors[i * 3 + 1] = shade
    colors[i * 3 + 2] = shade * (2 - tint)
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  return geometry
}

// Every placed piece, baked into one geometry.
function makeLandscapeGeometry(landscape) {
  const matrix = new THREE.Matrix4()
  const position = new THREE.Vector3()
  const rotation = new THREE.Quaternion()
  const scale = new THREE.Vector3()
  const up = new THREE.Vector3(0, 1, 0)
  const parts = landscapePieces(landscape).map(piece => {
    const part = makeRockGeometry(piece.kind, piece.seed)
    part.applyMatrix4(matrix.compose(
      position.set(piece.x, piece.y, piece.z),
      rotation.setFromAxisAngle(up, piece.yaw),
      scale.set(piece.width, piece.height, piece.depth),
    ))
    return part
  })
  const merged = mergeGeometries(parts)
  parts.forEach(part => part.dispose())
  return merged
}

function Rubble({ landscape, material }) {
  const ref = useRef()
  const { count, seed, xMin, xMax, zMin, zMax, sizeMin, sizeMax } = landscape.rubble
  const geometry = useMemo(() => makeRockGeometry('rubble', seed), [seed])
  useEffect(() => () => geometry.dispose(), [geometry])

  useLayoutEffect(() => {
    const mesh = ref.current
    if (!mesh) return
    const rand = seededRandom(seed + 1)
    const matrix = new THREE.Matrix4()
    const position = new THREE.Vector3()
    const rotation = new THREE.Quaternion()
    const euler = new THREE.Euler()
    const scale = new THREE.Vector3()
    for (let i = 0; i < count; i++) {
      const x = xMin + rand() * (xMax - xMin)
      const z = zMin + rand() * (zMax - zMin)
      const s = sizeMin + rand() * (sizeMax - sizeMin)
      scale.set(s * (0.8 + rand() * 0.5), s * (0.45 + rand() * 0.35), s * (0.8 + rand() * 0.5))
      position.set(x, sandHeight(landscape, x, z) - scale.y * 0.25, z)
      rotation.setFromEuler(euler.set((rand() - 0.5) * 0.4, rand() * Math.PI * 2, (rand() - 0.5) * 0.4))
      mesh.setMatrixAt(i, matrix.compose(position, rotation, scale))
    }
    mesh.instanceMatrix.needsUpdate = true
    mesh.computeBoundingSphere()
    // A new geometry or material rebuilds the instancedMesh (they are its args), which
    // resets every instance to the origin, so the placement must rerun with it.
  }, [landscape, geometry, material, count, seed, xMin, xMax, zMin, zMax, sizeMin, sizeMax])

  return <instancedMesh ref={ref} args={[geometry, material, count]} />
}

export default function Landscape({ landscape }) {
  const material = useMemo(() => new THREE.MeshStandardMaterial({
    color: ROCK_COLOR, roughness: 0.95, metalness: 0, flatShading: true, vertexColors: true, envMapIntensity: 0.35,
  }), [])
  const geometry = useMemo(() => makeLandscapeGeometry(landscape), [landscape])

  // Built imperatively, so R3F won't dispose them; free them when the tank unmounts.
  useEffect(() => () => material.dispose(), [material])
  useEffect(() => () => geometry.dispose(), [geometry])

  return (
    <group>
      <mesh geometry={geometry} material={material} />
      {landscape.rubble && <Rubble landscape={landscape} material={material} />}
    </group>
  )
}
