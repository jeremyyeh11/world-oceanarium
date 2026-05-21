import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { getSardineInstances } from './sardineInstanceRegistry'

const MAX_INSTANCES_PER_VARIANT = 1024
const BODY_LENGTH_WU = 0.86

const hiddenMatrix = new THREE.Matrix4().makeScale(0, 0, 0)
const instanceMatrix = new THREE.Matrix4()
const instancePosition = new THREE.Vector3()
const instanceQuaternion = new THREE.Quaternion()
const identityQuaternion = new THREE.Quaternion()
const instanceScale = new THREE.Vector3()
const tempColor = new THREE.Color()

function isFiniteVector3(value) {
  return value && Number.isFinite(value.x) && Number.isFinite(value.y) && Number.isFinite(value.z)
}

function makeFusiformBodyGeometry() {
  const radialSegments = 12
  const sections = [
    { z: -0.5, rx: 0.012, ry: 0.008 },
    { z: -0.36, rx: 0.052, ry: 0.034 },
    { z: -0.12, rx: 0.082, ry: 0.052 },
    { z: 0.16, rx: 0.074, ry: 0.047 },
    { z: 0.38, rx: 0.038, ry: 0.026 },
    { z: 0.5, rx: 0.008, ry: 0.006 },
  ]
  const positions = []
  const normals = []
  const uvs = []
  const indices = []

  sections.forEach((section, sectionIndex) => {
    for (let i = 0; i < radialSegments; i += 1) {
      const angle = (i / radialSegments) * Math.PI * 2
      const x = Math.cos(angle) * section.rx
      const y = Math.sin(angle) * section.ry
      positions.push(x, y, section.z * BODY_LENGTH_WU)
      normals.push(Math.cos(angle), Math.sin(angle), 0)
      uvs.push(i / radialSegments, sectionIndex / (sections.length - 1))
    }
  })

  for (let section = 0; section < sections.length - 1; section += 1) {
    for (let i = 0; i < radialSegments; i += 1) {
      const current = section * radialSegments + i
      const next = section * radialSegments + ((i + 1) % radialSegments)
      const above = (section + 1) * radialSegments + i
      const aboveNext = (section + 1) * radialSegments + ((i + 1) % radialSegments)
      indices.push(current, above, next, next, above, aboveNext)
    }
  }

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3))
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  geometry.computeBoundingSphere()
  return geometry
}

function makeTailGeometry() {
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute([
    0, 0, 0.43,
    0, 0.095, 0.58,
    0, 0, 0.50,
    0, 0, 0.43,
    0, -0.095, 0.58,
    0, 0, 0.50,
  ], 3))
  geometry.setIndex([0, 1, 2, 3, 4, 5])
  geometry.computeVertexNormals()
  geometry.computeBoundingSphere()
  return geometry
}

function useInstancedSardineAsset() {
  return useMemo(() => [
    {
      geometry: makeFusiformBodyGeometry(),
      material: new THREE.MeshBasicMaterial({
        color: '#9edfe8',
        transparent: true,
        opacity: 0.68,
        depthWrite: false,
        depthTest: true,
      }),
    },
    {
      geometry: makeTailGeometry(),
      material: new THREE.MeshBasicMaterial({
        color: '#7bcbd8',
        transparent: true,
        opacity: 0.52,
        depthWrite: false,
        depthTest: true,
        side: THREE.DoubleSide,
      }),
    },
  ], [])
}

export default function SardineInstancedLayer() {
  const assets = useInstancedSardineAsset()
  const meshRefs = useRef([])

  useFrame(() => {
    const rawEntries = Array.from(getSardineInstances().values())
    const entries = rawEntries
      .filter(entry => isFiniteVector3(entry?.position) && Number.isFinite(entry?.scale ?? 1))
      .slice(0, MAX_INSTANCES_PER_VARIANT)
    if (typeof window !== 'undefined') {
      window.__WO_SARDINE_INSTANCE_DEBUG = {
        total: entries.length,
        available: rawEntries.length,
        buckets: assets.map(() => entries.length),
        variants: assets.length,
        mode: 'procedural-fish-fixed-orientation',
        sample: entries[0] ? {
          position: [Number(entries[0].position.x.toFixed(2)), Number(entries[0].position.y.toFixed(2)), Number(entries[0].position.z.toFixed(2))],
          scale: Number((entries[0].scale ?? 1).toFixed(2)),
        } : null,
      }
    }

    meshRefs.current.forEach(mesh => {
      if (!mesh) return
      for (let i = 0; i < entries.length; i += 1) {
        instancePosition.copy(entries[i].position)
        const visualScale = THREE.MathUtils.clamp(entries[i].scale ?? 1, 0.45, 1.35)
        instanceScale.setScalar(visualScale)
        instanceQuaternion.copy(identityQuaternion)
        instanceMatrix.compose(instancePosition, instanceQuaternion, instanceScale)
        mesh.setMatrixAt(i, instanceMatrix)
        const tint = entries[i].tint ?? 1
        tempColor.setRGB(0.70 * tint, 0.88 * tint, 0.92 * tint)
        mesh.setColorAt(i, tempColor)
      }
      mesh.count = entries.length
      mesh.instanceMatrix.needsUpdate = true
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
      mesh.frustumCulled = false
    })
  })

  return assets.map((asset, index) => (
    <instancedMesh
      key={index}
      ref={node => {
        meshRefs.current[index] = node
        if (!node) return
        node.count = 0
        for (let i = 0; i < MAX_INSTANCES_PER_VARIANT; i += 1) node.setMatrixAt(i, hiddenMatrix)
        node.instanceMatrix.needsUpdate = true
      }}
      args={[asset.geometry, asset.material, MAX_INSTANCES_PER_VARIANT]}
      frustumCulled={false}
      raycast={() => null}
    />
  ))
}
