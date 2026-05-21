import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { getSardineInstances } from './sardineInstanceRegistry'

const VARIANT_COUNT = 1
const MAX_INSTANCES_PER_VARIANT = 512
const VALIDATION_INSTANCE_LIMIT = 24
const hiddenMatrix = new THREE.Matrix4().makeScale(0, 0, 0)
const instanceMatrix = new THREE.Matrix4()
const instancePosition = new THREE.Vector3()
const instanceQuaternion = new THREE.Quaternion()
const instanceScale = new THREE.Vector3(1.65, 1.65, 1.65)
const tempColor = new THREE.Color()

function isFiniteVector3(value) {
  return value && Number.isFinite(value.x) && Number.isFinite(value.y) && Number.isFinite(value.z)
}

function isFiniteQuaternion(value) {
  return value && Number.isFinite(value.x) && Number.isFinite(value.y) && Number.isFinite(value.z) && Number.isFinite(value.w)
}

function makeProceduralSardineGeometry() {
  const geometry = new THREE.SphereGeometry(1, 14, 8)
  geometry.scale(0.105, 0.055, 0.38)
  geometry.computeVertexNormals()
  geometry.computeBoundingSphere()
  return geometry
}

function useInstancedSardineAsset() {
  return useMemo(() => [{
    geometry: makeProceduralSardineGeometry(),
    material: new THREE.MeshBasicMaterial({ color: '#62f6ff', depthWrite: false, depthTest: true }),
  }], [])
}

export default function SardineInstancedLayer() {
  const assets = useInstancedSardineAsset()
  const meshRefs = useRef([])

  useFrame(() => {
    const rawEntries = Array.from(getSardineInstances().values())
    const entries = rawEntries
      .filter(entry => isFiniteVector3(entry?.position) && isFiniteQuaternion(entry?.quaternion))
      .slice(0, VALIDATION_INSTANCE_LIMIT)
    if (typeof window !== 'undefined') {
      window.__WO_SARDINE_INSTANCE_DEBUG = {
        total: entries.length,
        available: rawEntries.length,
        buckets: [entries.length],
        variants: VARIANT_COUNT,
        mode: 'sanitized-position-quaternion',
        sample: entries[0] ? {
          position: [Number(entries[0].position.x.toFixed(2)), Number(entries[0].position.y.toFixed(2)), Number(entries[0].position.z.toFixed(2))],
          scale: Number((entries[0].scale ?? 1).toFixed(2)),
        } : null,
      }
    }
    const mesh = meshRefs.current[0]
    if (!mesh) return
    for (let i = 0; i < entries.length; i += 1) {
      instancePosition.copy(entries[i].position)
      instanceQuaternion.copy(entries[i].quaternion).normalize()
      const visualScale = THREE.MathUtils.clamp(entries[i].scale ?? 1, 0.45, 1.35)
      instanceScale.setScalar(1.65 * visualScale)
      instanceMatrix.compose(instancePosition, instanceQuaternion, instanceScale)
      mesh.setMatrixAt(i, instanceMatrix)
      const tint = entries[i].tint ?? 1
      tempColor.setRGB(0.70 * tint, 0.92 * tint, 0.98 * tint)
      mesh.setColorAt(i, tempColor)
    }
    mesh.count = entries.length
    mesh.instanceMatrix.needsUpdate = true
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
    mesh.frustumCulled = false
  }, 1)

  return (
    <instancedMesh
      ref={node => {
        meshRefs.current[0] = node
        if (!node) return
        node.count = 0
        for (let i = 0; i < MAX_INSTANCES_PER_VARIANT; i += 1) node.setMatrixAt(i, hiddenMatrix)
        node.instanceMatrix.needsUpdate = true
      }}
      args={[assets[0].geometry, assets[0].material, MAX_INSTANCES_PER_VARIANT]}
      frustumCulled={false}
      raycast={() => null}
    />
  )
}
