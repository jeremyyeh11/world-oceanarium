import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { getSardineInstances, getSardineLod1Instances } from './sardineInstanceRegistry'

const SARDINE_LOD1_MODEL_PATH = '/models/fish/sardine/sardine_LOD1.glb'
const SARDINE_LOD2_MODEL_PATH = '/models/fish/sardine/sardine_LOD2.glb'
const MAX_INSTANCES_PER_VARIANT = 1024
const SARDINE_MODEL_SCALE = 0.42
const SARDINE_LIGHT_MASK_DIAGNOSTIC = true

const hiddenMatrix = new THREE.Matrix4().makeScale(0, 0, 0)
const instanceMatrix = new THREE.Matrix4()
const instancePosition = new THREE.Vector3()
const instanceQuaternion = new THREE.Quaternion()
const instanceScale = new THREE.Vector3()
const tempColor = new THREE.Color()
const instancePhaseStride = 1
const LOD1_DEBUG_COLOR = new THREE.Color('#8f8f00')
const LOD2_DEBUG_COLOR = new THREE.Color('#ff2b1a')
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

function addSardineWiggleMaterial(material, { amplitude = 0.018, frequency = 5.0, speed = 3.2 } = {}) {
  const nextMaterial = cloneMainSardineMaterialSettings(material)
  nextMaterial.userData.wiggleUniforms = null
  nextMaterial.onBeforeCompile = shader => {
    shader.uniforms.uSardineWiggleTime = { value: 0 }
    shader.uniforms.uSardineWiggleAmplitude = { value: amplitude }
    shader.uniforms.uSardineWiggleFrequency = { value: frequency }
    shader.uniforms.uSardineWiggleSpeed = { value: speed }
    nextMaterial.userData.wiggleUniforms = shader.uniforms
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
attribute float instancePhase;
uniform float uSardineWiggleTime;
uniform float uSardineWiggleAmplitude;
uniform float uSardineWiggleFrequency;
uniform float uSardineWiggleSpeed;
varying vec3 vSardineWorldPosition;`,
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
float sardineTailMask = smoothstep(-0.08, 0.82, abs(position.z));
float sardineWave = sin((position.z * uSardineWiggleFrequency) + (uSardineWiggleTime * uSardineWiggleSpeed) + instancePhase);
transformed.x += sardineWave * uSardineWiggleAmplitude * sardineTailMask;`,
      )
      .replace(
        '#include <worldpos_vertex>',
        `#include <worldpos_vertex>
vSardineWorldPosition = worldPosition.xyz;`,
      )
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
uniform float uSardineWiggleTime;
varying vec3 vSardineWorldPosition;`,
      )
      .replace(
        '#include <dithering_fragment>',
        `${SARDINE_LIGHT_MASK_DIAGNOSTIC ? `vec3 maskPos = vSardineWorldPosition;
float stripeA = sin(maskPos.x * 3.3 + maskPos.y * 1.6 + maskPos.z * 2.1 + uSardineWiggleTime * 0.75);
float stripeB = sin(maskPos.x * -1.7 + maskPos.z * 4.2 - uSardineWiggleTime * 0.55);
float diagnosticMask = smoothstep(0.05, 0.42, stripeA + stripeB * 0.35);
float diagnosticShadow = smoothstep(0.15, 0.55, -stripeA + stripeB * 0.20);
gl_FragColor.rgb *= mix(0.42, 1.0, diagnosticShadow);
gl_FragColor.rgb = mix(gl_FragColor.rgb, vec3(0.08, 1.0, 0.95), diagnosticMask * 0.82);` : ''}
#include <dithering_fragment>`,
      )
  }
  nextMaterial.customProgramCacheKey = () => `sardine-instanced-wiggle-${amplitude}-${frequency}-${speed}-light-mask-${SARDINE_LIGHT_MASK_DIAGNOSTIC ? 'on' : 'off'}`
  nextMaterial.needsUpdate = true
  return nextMaterial
}

function extractInstancedMeshAsset(scene, source) {
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
    material: addSardineWiggleMaterial(sourceMesh.material, source === 'sardine-lod1-glb'
      ? { amplitude: 0.024, frequency: 5.6, speed: 3.4 }
      : { amplitude: 0.012, frequency: 4.2, speed: 2.8 }),
    source,
  }
}

function useInstancedSardineAsset(path, source) {
  const gltf = useGLTF(path)
  return useMemo(() => extractInstancedMeshAsset(gltf.scene, source), [gltf.scene, source])
}

function collectEntries(entriesMap) {
  return Array.from(entriesMap.entries())
    .map(([id, entry]) => ({ ...entry, id }))
    .filter(entry => isFiniteVector3(entry?.position) && Number.isFinite(entry?.scale ?? 1))
    .slice(0, MAX_INSTANCES_PER_VARIANT)
}

function phaseFromId(id) {
  const text = String(id ?? '')
  let hash = 2166136261
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return ((hash >>> 0) / 4294967295) * Math.PI * 2
}

function writeInstances(mesh, entries, debugColor = null) {
  if (!mesh) return
  const phaseAttribute = mesh.geometry.getAttribute('instancePhase')

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
    const tint = debugColor ? 1 : (entry.tint ?? 1)
    if (debugColor) tempColor.copy(debugColor)
    else tempColor.setRGB(1 * tint, 1 * tint, 1 * tint)
    mesh.setColorAt(i, tempColor)
    if (phaseAttribute) phaseAttribute.array[i * instancePhaseStride] = phaseFromId(entry.id)
  }

  mesh.count = entries.length
  mesh.instanceMatrix.needsUpdate = true
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
  if (phaseAttribute) phaseAttribute.needsUpdate = true
  mesh.frustumCulled = false
}

function prepareMesh(node) {
  if (!node) return
  node.count = 0
  if (!node.geometry.getAttribute('instancePhase')) {
    node.geometry.setAttribute('instancePhase', new THREE.InstancedBufferAttribute(new Float32Array(MAX_INSTANCES_PER_VARIANT), 1))
  }
  for (let i = 0; i < MAX_INSTANCES_PER_VARIANT; i += 1) node.setMatrixAt(i, hiddenMatrix)
  node.instanceMatrix.needsUpdate = true
}

function updateWiggleTime(material, elapsedTime) {
  const uniforms = material?.userData?.wiggleUniforms
  if (uniforms?.uSardineWiggleTime) uniforms.uSardineWiggleTime.value = elapsedTime
}

export default function SardineInstancedLayer({ debugLodView = false }) {
  const lod1Asset = useInstancedSardineAsset(SARDINE_LOD1_MODEL_PATH, 'sardine-lod1-glb')
  const lod2Asset = useInstancedSardineAsset(SARDINE_LOD2_MODEL_PATH, 'sardine-lod2-glb')
  const lod1MeshRef = useRef(null)
  const lod2MeshRef = useRef(null)

  useFrame(({ clock }) => {
    updateWiggleTime(lod1Asset.material, clock.elapsedTime)
    updateWiggleTime(lod2Asset.material, clock.elapsedTime)
    const rawLod1Entries = getSardineLod1Instances()
    const rawLod2Entries = getSardineInstances()
    const lod1Entries = collectEntries(rawLod1Entries)
    const lod2Entries = collectEntries(rawLod2Entries)

    if (typeof window !== 'undefined') {
      window.__WO_SARDINE_INSTANCE_DEBUG = {
        total: lod2Entries.length,
        lod1Total: lod1Entries.length,
        lod2Total: lod2Entries.length,
        available: rawLod1Entries.size + rawLod2Entries.size,
        buckets: [lod1Entries.length, lod2Entries.length],
        variants: 2,
        mode: debugLodView ? 'LOD1+LOD2-LOD-COLOR' : 'LOD1+LOD2',
        asset: `${lod1Asset.source}+${lod2Asset.source}`,
        sample: lod2Entries[0] || lod1Entries[0] ? {
          position: [Number((lod2Entries[0] ?? lod1Entries[0]).position.x.toFixed(2)), Number((lod2Entries[0] ?? lod1Entries[0]).position.y.toFixed(2)), Number((lod2Entries[0] ?? lod1Entries[0]).position.z.toFixed(2))],
          scale: Number(((lod2Entries[0] ?? lod1Entries[0]).scale ?? 1).toFixed(2)),
        } : null,
      }
    }

    writeInstances(lod1MeshRef.current, lod1Entries, debugLodView ? LOD1_DEBUG_COLOR : null)
    writeInstances(lod2MeshRef.current, lod2Entries, debugLodView ? LOD2_DEBUG_COLOR : null)
  })

  return (
    <>
      <instancedMesh
        ref={node => {
          lod1MeshRef.current = node
          prepareMesh(node)
        }}
        args={[lod1Asset.geometry, lod1Asset.material, MAX_INSTANCES_PER_VARIANT]}
        frustumCulled={false}
        raycast={() => null}
      />
      <instancedMesh
        ref={node => {
          lod2MeshRef.current = node
          prepareMesh(node)
        }}
        args={[lod2Asset.geometry, lod2Asset.material, MAX_INSTANCES_PER_VARIANT]}
        frustumCulled={false}
        raycast={() => null}
      />
    </>
  )
}

useGLTF.preload(SARDINE_LOD1_MODEL_PATH)
useGLTF.preload(SARDINE_LOD2_MODEL_PATH)
