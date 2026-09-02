import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { getSardineInstances, getSardineLod1Instances } from './sardineInstanceRegistry'
import { hashString } from '../utils/hash'
import { SARDINE_MATERIAL_ROUGHNESS } from '../utils/sardineMaterials'
import { SARDINE_INSTANCE_DEBUG_GLOBAL } from '../utils/debugIdentifiers'

const SARDINE_LOD1_MODEL_PATH = '/models/fish/sardine/sardine_LOD1.glb'
const SARDINE_LOD2_MODEL_PATH = '/models/fish/sardine/sardine_LOD2.glb'
const MAX_INSTANCES_PER_VARIANT = 1024
const SARDINE_MODEL_SCALE = 0.42
const SARDINE_LIGHT_MASK_ENABLED = true

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
  nextMaterial.roughness = SARDINE_MATERIAL_ROUGHNESS
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
vec4 sardineWorldPosition = vec4(transformed, 1.0);
#ifdef USE_INSTANCING
sardineWorldPosition = instanceMatrix * sardineWorldPosition;
#endif
sardineWorldPosition = modelMatrix * sardineWorldPosition;
vSardineWorldPosition = sardineWorldPosition.xyz;`,
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
        `${SARDINE_LIGHT_MASK_ENABLED ? `vec3 maskPos = vSardineWorldPosition;
float stripeA = sin(maskPos.x * 1.75 + maskPos.y * 0.85 + maskPos.z * 1.10 + uSardineWiggleTime * 0.46);
float stripeB = sin(maskPos.x * -0.95 + maskPos.z * 2.15 - uSardineWiggleTime * 0.34);
float lightMask = smoothstep(0.06, 0.46, stripeA + stripeB * 0.28);
float shadowMask = smoothstep(0.08, 0.50, -stripeA + stripeB * 0.16);
float topWeight = smoothstep(-8.0, 3.0, maskPos.y);
float lightFactor = mix(0.68, 1.04, lightMask) * mix(0.82, 1.0, shadowMask);
gl_FragColor.rgb *= mix(1.0, lightFactor, 0.80 * topWeight);` : ''}
#include <dithering_fragment>`,
      )
  }
  nextMaterial.customProgramCacheKey = () => `sardine-instanced-wiggle-${amplitude}-${frequency}-${speed}-light-mask-${SARDINE_LIGHT_MASK_ENABLED ? 'on' : 'off'}`
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
  const asset = useMemo(() => extractInstancedMeshAsset(gltf.scene, source), [gltf.scene, source])

  // extractInstancedMeshAsset clones both the geometry and the material, and those
  // clones belong to this component, not to drei's GLTF cache — nothing else will
  // ever free them. <Biome> is keyed by tank, so every switch remounts this layer
  // and mints a fresh pair while the previous pair stays resident on the GPU.
  // Switching back and forth accumulated a set each time.
  //
  // The fallbacks are module-scope singletons shared by every mount, so disposing
  // those would break the next one.
  useEffect(() => () => {
    if (asset.source === 'fallback-box') return
    asset.geometry?.dispose()
    asset.material?.dispose()
  }, [asset])

  return asset
}

// Reused per-frame buffers, one pair per LOD bucket.
//
// This used to be a four-stage chain — Array.from, map, filter, slice — that
// allocated four arrays plus one spread object per instance, for both buckets,
// on every single frame. The spread existed only to carry the Map key onto the
// entry. At the live school size (~275 sardines) that is on the order of 16k
// short-lived objects a second handed straight to the GC, rebuilding data that
// is already sitting in the registry Map.
//
// Now the Map is walked once and the buffers are filled in place. Entries are
// held by reference and never copied; the id travels in a parallel array.
const lod1Scratch = { entries: [], ids: [], count: 0 }
const lod2Scratch = { entries: [], ids: [], count: 0 }

function collectEntries(entriesMap, scratch) {
  let count = 0
  for (const [id, entry] of entriesMap) {
    if (count >= MAX_INSTANCES_PER_VARIANT) break
    if (!isFiniteVector3(entry?.position)) continue
    if (!Number.isFinite(entry?.scale ?? 1)) continue
    scratch.entries[count] = entry
    scratch.ids[count] = id
    count += 1
  }
  // Release anything past the live count. Without this a school that shrinks
  // would keep the departed entries (and their Vector3s/Quaternions) reachable
  // from the scratch arrays for the rest of the session.
  for (let i = count; i < scratch.count; i += 1) {
    scratch.entries[i] = null
    scratch.ids[i] = null
  }
  scratch.count = count
  return scratch
}

// The wiggle phase is derived from the creature id, so it is fixed for the life
// of a fish — but it was recomputed for every instance on every frame, running
// an FNV hash over each character of the id. Cached by id instead. The map is
// bounded by the creature set (a few hundred) and each value is one number.
const phaseById = new Map()

function phaseFromId(id) {
  const key = typeof id === 'string' ? id : String(id ?? '')
  let phase = phaseById.get(key)
  if (phase === undefined) {
    phase = (hashString(key) / 4294967295) * Math.PI * 2
    phaseById.set(key, phase)
  }
  return phase
}

function writeInstances(mesh, scratch, debugColor = null) {
  if (!mesh) return
  const phaseAttribute = mesh.geometry.getAttribute('instancePhase')
  const { entries, ids, count } = scratch

  for (let i = 0; i < count; i += 1) {
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
    if (phaseAttribute) phaseAttribute.array[i * instancePhaseStride] = phaseFromId(ids[i])
  }

  mesh.count = count
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

export default function SardineInstancedLayer({ debugLodView = false, debugStatsEnabled = false }) {
  const lod1Asset = useInstancedSardineAsset(SARDINE_LOD1_MODEL_PATH, 'sardine-lod1-glb')
  const lod2Asset = useInstancedSardineAsset(SARDINE_LOD2_MODEL_PATH, 'sardine-lod2-glb')
  const lod1MeshRef = useRef(null)
  const lod2MeshRef = useRef(null)

  useFrame(({ clock }) => {
    updateWiggleTime(lod1Asset.material, clock.elapsedTime)
    updateWiggleTime(lod2Asset.material, clock.elapsedTime)
    const rawLod1Entries = getSardineLod1Instances()
    const rawLod2Entries = getSardineInstances()
    const lod1Entries = collectEntries(rawLod1Entries, lod1Scratch)
    const lod2Entries = collectEntries(rawLod2Entries, lod2Scratch)

    if (debugStatsEnabled && typeof window !== 'undefined') {
      const sampleEntry = lod2Entries.entries[0] ?? lod1Entries.entries[0] ?? null
      window[SARDINE_INSTANCE_DEBUG_GLOBAL] = {
        total: lod2Entries.count,
        lod1Total: lod1Entries.count,
        lod2Total: lod2Entries.count,
        available: rawLod1Entries.size + rawLod2Entries.size,
        buckets: [lod1Entries.count, lod2Entries.count],
        variants: 2,
        mode: debugLodView ? 'LOD1+LOD2-LOD-COLOR' : 'LOD1+LOD2',
        asset: `${lod1Asset.source}+${lod2Asset.source}`,
        sample: sampleEntry ? {
          position: [Number(sampleEntry.position.x.toFixed(2)), Number(sampleEntry.position.y.toFixed(2)), Number(sampleEntry.position.z.toFixed(2))],
          scale: Number((sampleEntry.scale ?? 1).toFixed(2)),
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
