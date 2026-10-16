import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { mulberry32 } from './fishSwim'
import { sandHeight } from '../data/landscapes'

// Placeholder rocks for a tank landscape (src/data/landscapes.js), standing in for the
// modelled GLBs until they land. Each piece is a seeded, displaced icosahedron, so the same
// seed always builds the same rock.
//
// taper widens the top (a bommie's overhang); flatBottom squashes everything below it so the
// rock sits flat on the sand instead of balancing on a point. column pushes the sphere out
// toward a cylinder, so a tall cliff keeps steep sides and a broad top instead of tapering
// to a spike.
const ROCK_PROFILES = {
  boulder: { detail: 5, roughness: 0.42, taper: 0, flatBottom: -0.4 },
  bommie: { detail: 7, roughness: 0.5, taper: 0.55, flatBottom: -0.7 },
  wall: { detail: 7, roughness: 0.55, taper: 0.35, flatBottom: -0.55 },
  cliff: { detail: 8, roughness: 0.42, taper: 0.1, flatBottom: -0.85, column: 0.75 },
  rubble: { detail: 1, roughness: 0.4, taper: 0, flatBottom: -0.3 },
}

const ROCK_COLOR = '#b3a88e'
const scratch = new THREE.Vector3()

// Builds a rock in a unit box: x and z span [-0.5, 0.5], y spans [0, 1] with the base at 0,
// so a mesh scale of [width, height, depth] gives the piece its size in WU directly.
function makeRockGeometry(kind, seed) {
  const profile = ROCK_PROFILES[kind] ?? ROCK_PROFILES.boulder
  const rand = mulberry32(seed)
  const octaves = [0, 1, 2, 3].map(() => [
    0.8 + rand() * 0.8, 0.8 + rand() * 0.8, 0.8 + rand() * 0.8,
    rand() * Math.PI * 2, rand() * Math.PI * 2, rand() * Math.PI * 2,
  ])
  // Icosahedron geometry is non-indexed: a vertex shared by several faces exists once per
  // face. The displacement is a smooth function of position, so those copies move together
  // and the surface never cracks; the split normals give the faceted placeholder look.
  const geometry = new THREE.IcosahedronGeometry(1, profile.detail)
  const pos = geometry.attributes.position
  for (let i = 0; i < pos.count; i++) {
    scratch.fromBufferAttribute(pos, i).normalize()
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
    pos.setXYZ(i, scratch.x, scratch.y, scratch.z)
  }

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

// Lowest sand height under a piece's footprint, so no edge of its base floats.
function baseHeight(landscape, x, z, width, depth) {
  const hx = width * 0.5
  const hz = depth * 0.5
  return Math.min(
    sandHeight(landscape, x, z),
    sandHeight(landscape, x - hx, z), sandHeight(landscape, x + hx, z),
    sandHeight(landscape, x, z - hz), sandHeight(landscape, x, z + hz),
  )
}

function Rubble({ landscape, material }) {
  const ref = useRef()
  const { count, seed, xMin, xMax, zMin, zMax, sizeMin, sizeMax } = landscape.rubble
  const geometry = useMemo(() => makeRockGeometry('rubble', seed), [seed])
  useEffect(() => () => geometry.dispose(), [geometry])

  useLayoutEffect(() => {
    const mesh = ref.current
    if (!mesh) return
    const rand = mulberry32(seed + 1)
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
  const pieces = useMemo(() => landscape.rocks.map(([kind, x, z, width, height, depth, yaw, seed]) => {
    // Sink the base a little so the flattened bottom never shows a gap against the sand.
    const sink = Math.min(1.2, height * 0.08) + 0.1
    return {
      key: `${kind}-${seed}`,
      geometry: makeRockGeometry(kind, seed),
      position: [x, baseHeight(landscape, x, z, width, depth) - sink, z],
      rotation: [0, yaw, 0],
      scale: [width, height, depth],
    }
  }), [landscape])

  // Built imperatively, so R3F won't dispose them; free them when the tank unmounts.
  useEffect(() => () => material.dispose(), [material])
  useEffect(() => () => pieces.forEach(piece => piece.geometry.dispose()), [pieces])

  return (
    <group>
      {pieces.map(piece => (
        <mesh key={piece.key} geometry={piece.geometry} material={material} position={piece.position} rotation={piece.rotation} scale={piece.scale} />
      ))}
      {landscape.rubble && <Rubble landscape={landscape} material={material} />}
    </group>
  )
}
