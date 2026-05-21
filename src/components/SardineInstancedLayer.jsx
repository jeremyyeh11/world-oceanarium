import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { getSardineInstances } from './sardineInstanceRegistry'

const VARIANT_COUNT = 1
const MAX_INSTANCES_PER_VARIANT = 512
const VALIDATION_INSTANCE_LIMIT = 24
const hiddenMatrix = new THREE.Matrix4().makeScale(0, 0, 0)
const tempColor = new THREE.Color()

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
    const entries = Array.from(getSardineInstances().values()).filter(entry => entry?.matrix).slice(0, VALIDATION_INSTANCE_LIMIT)
    if (typeof window !== 'undefined') {
      window.__WO_SARDINE_INSTANCE_DEBUG = { total: entries.length, available: getSardineInstances().size, buckets: [entries.length], variants: VARIANT_COUNT, mode: 'limited-real-matrices' }
    }
    const mesh = meshRefs.current[0]
    if (!mesh) return
    for (let i = 0; i < entries.length; i += 1) {
      mesh.setMatrixAt(i, entries[i].matrix)
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
