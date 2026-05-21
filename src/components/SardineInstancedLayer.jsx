import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { getSardineInstances } from './sardineInstanceRegistry'

const SARDINE_LOD2_MODEL_PATH = '/models/fish/sardine/sardine_LOD2.glb'
const MAX_INSTANCES_PER_VARIANT = 1024
const SARDINE_MODEL_SCALE = 0.42

const hiddenMatrix = new THREE.Matrix4().makeScale(0, 0, 0)
const instanceMatrix = new THREE.Matrix4()
const instancePosition = new THREE.Vector3()
const instanceQuaternion = new THREE.Quaternion()
const instanceScale = new THREE.Vector3()
const tempColor = new THREE.Color()
const fallbackGeometry = new THREE.BoxGeometry(0.18, 0.08, 0.72)
const fallbackMaterial = new THREE.MeshBasicMaterial({
  color: '#9edfe8',
  transparent: false,
  opacity: 1,
  depthWrite: true,
  depthTest: true,
})

function isFiniteVector3(value) {
  return value && Number.isFinite(value.x) && Number.isFinite(value.y) && Number.isFinite(value.z)
}

function isFiniteQuaternion(value) {
  return value && Number.isFinite(value.x) && Number.isFinite(value.y) && Number.isFinite(value.z) && Number.isFinite(value.w)
}

function cloneMainSardineMaterialSettings(material) {
  if (!material) return fallbackMaterial.clone()
  const nextMaterial = material.clone()
  nextMaterial.transparent = false
  nextMaterial.opacity = 1
  nextMaterial.depthWrite = true
  nextMaterial.depthTest = true
  nextMaterial.roughness = nextMaterial.roughness ?? 0.5
  nextMaterial.side = THREE.DoubleSide
  if ('skinning' in nextMaterial) nextMaterial.skinning = false
  return nextMaterial
}

function extractInstancedMeshAsset(scene) {
  let sourceMesh = null
  scene.updateMatrixWorld(true)
  scene.traverse(child => {
    if (sourceMesh || !child.isMesh || !child.geometry) return
    sourceMesh = child
  })

  if (!sourceMesh) {
    return {
      geometry: fallbackGeometry,
      material: fallbackMaterial,
      source: 'fallback-box',
    }
  }

  sourceMesh.updateWorldMatrix(true, false)
  const geometry = sourceMesh.geometry.clone()
  geometry.applyMatrix4(sourceMesh.matrixWorld)
  geometry.computeBoundingSphere()
  geometry.computeBoundingBox()

  return {
    geometry,
    material: cloneMainSardineMaterialSettings(sourceMesh.material),
    source: 'sardine-lod2-glb',
  }
}

function useInstancedSardineAsset() {
  const gltf = useGLTF(SARDINE_LOD2_MODEL_PATH)
  return useMemo(() => extractInstancedMeshAsset(gltf.scene), [gltf.scene])
}

export default function SardineInstancedLayer() {
  const asset = useInstancedSardineAsset()
  const meshRef = useRef(null)

  useFrame(() => {
    const rawEntries = Array.from(getSardineInstances().values())
    const entries = rawEntries
      .filter(entry => isFiniteVector3(entry?.position) && Number.isFinite(entry?.scale ?? 1))
      .slice(0, MAX_INSTANCES_PER_VARIANT)

    if (typeof window !== 'undefined') {
      window.__WO_SARDINE_INSTANCE_DEBUG = {
        total: entries.length,
        available: rawEntries.length,
        buckets: [entries.length],
        variants: 1,
        mode: 'LOD2',
        asset: asset.source,
        sample: entries[0] ? {
          position: [Number(entries[0].position.x.toFixed(2)), Number(entries[0].position.y.toFixed(2)), Number(entries[0].position.z.toFixed(2))],
          scale: Number((entries[0].scale ?? 1).toFixed(2)),
        } : null,
      }
    }

    const mesh = meshRef.current
    if (!mesh) return

    for (let i = 0; i < entries.length; i += 1) {
      const entry = entries[i]
      instancePosition.copy(entry.position)
      const visualScale = THREE.MathUtils.clamp(entry.scale ?? 1, 0.45, 1.35) * SARDINE_MODEL_SCALE
      instanceScale.setScalar(visualScale)
      if (isFiniteQuaternion(entry.quaternion)) {
        instanceQuaternion.copy(entry.quaternion).normalize()
      } else {
        instanceQuaternion.identity()
      }
      instanceMatrix.compose(instancePosition, instanceQuaternion, instanceScale)
      mesh.setMatrixAt(i, instanceMatrix)
      const tint = entry.tint ?? 1
      tempColor.setRGB(1 * tint, 1 * tint, 1 * tint)
      mesh.setColorAt(i, tempColor)
    }

    mesh.count = entries.length
    mesh.instanceMatrix.needsUpdate = true
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
    mesh.frustumCulled = false
  })

  return (
    <instancedMesh
      ref={node => {
        meshRef.current = node
        if (!node) return
        node.count = 0
        for (let i = 0; i < MAX_INSTANCES_PER_VARIANT; i += 1) node.setMatrixAt(i, hiddenMatrix)
        node.instanceMatrix.needsUpdate = true
      }}
      args={[asset.geometry, asset.material, MAX_INSTANCES_PER_VARIANT]}
      frustumCulled={false}
      raycast={() => null}
    />
  )
}

useGLTF.preload(SARDINE_LOD2_MODEL_PATH)
