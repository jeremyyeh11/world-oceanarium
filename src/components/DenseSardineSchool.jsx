import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { SPECIES } from '../data/species'

const SARDINE_SPECIES = 'Spotted Sardinella'
const SARDINE_MODEL_PATH = '/models/fish/sardine/sardine.glb'
const DENSE_SARDINE_THRESHOLD = 128
const DENSE_SCHOOL_MAX_SIZE = 128
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5))
const DEPTH_Y = {
  epipelagic: [-2.2, 3.0],
  mesopelagic: [-15, -8],
  bathypelagic: [-27, -20],
}
const SWIM_BOX = { x: 8.0, z: 7.4 }
const PATH_EDGE_PADDING = 0.75
const PATH_VERTICAL_PADDING = 0.16
const SCHOOL_SPACING = 0.46
const SCHOOL_FORMATION_RADIUS_SCALE = 0.48
const SCHOOL_VERTICAL_SPREAD = 0.72
const SCHOOL_LONGITUDINAL_SPREAD = 0.58
const SCHOOL_PHASE_WINDOW = 0.085
const SCHOOL_DRIFT = 0.08
const UP = new THREE.Vector3(0, 1, 0)
const SPECIES_BY_NAME = new Map(SPECIES.map(species => [species.name, species]))

const scratchPosition = new THREE.Vector3()
const scratchTangent = new THREE.Vector3()
const scratchNext = new THREE.Vector3()
const scratchLateral = new THREE.Vector3()
const scratchQuaternion = new THREE.Quaternion()
const scratchScale = new THREE.Vector3()
const scratchMatrix = new THREE.Matrix4()
const scratchInstanceMatrix = new THREE.Matrix4()
const scratchLook = new THREE.Matrix4()

function hashString(value) {
  let hash = 2166136261
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

function mulberry32(seed) {
  return function rand() {
    let t = seed += 0x6D2B79F5
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function randomRange(rand, min, max) {
  return min + rand() * (max - min)
}

function deterministicOrder(creature) {
  return hashString(`${creature.species}:${creature.biome}:${creature.depthZone}:${creature.id}`)
}

function swimBounds(depthZone, bodyLength = 1, size = 1) {
  const [rawYMin, rawYMax] = DEPTH_Y[depthZone] ?? DEPTH_Y.epipelagic
  const bodyMargin = Math.max(PATH_EDGE_PADDING, Math.min(1.4, bodyLength * size * 0.28))
  const verticalMargin = Math.min((rawYMax - rawYMin) * 0.16, Math.max(PATH_VERTICAL_PADDING, Math.min(0.48, bodyLength * size * 0.12)))
  return {
    x: Math.max(1.5, SWIM_BOX.x - bodyMargin),
    z: Math.max(1.5, SWIM_BOX.z - bodyMargin),
    yMin: rawYMin + verticalMargin,
    yMax: rawYMax - verticalMargin,
  }
}

function clampToSwimBox(point, bounds) {
  point.x = THREE.MathUtils.clamp(point.x, -bounds.x, bounds.x)
  point.y = THREE.MathUtils.clamp(point.y, bounds.yMin, bounds.yMax)
  point.z = THREE.MathUtils.clamp(point.z, -bounds.z, bounds.z)
  return point
}

function traversalY(rand, bounds, index) {
  const midY = (bounds.yMin + bounds.yMax) / 2
  const halfY = (bounds.yMax - bounds.yMin) / 2
  const direction = index % 2 === 0 ? -1 : 1
  return THREE.MathUtils.clamp(
    midY + direction * halfY * 0.72 + randomRange(rand, -halfY * 0.16, halfY * 0.16),
    bounds.yMin,
    bounds.yMax,
  )
}

function makeSchoolPath(seed, depthZone, bodyLength, size) {
  const rand = mulberry32(seed)
  const bounds = swimBounds(depthZone, bodyLength, size)
  const rotation = randomRange(rand, -Math.PI, Math.PI)
  const weavePhase = randomRange(rand, 0, Math.PI * 2)
  const pointCount = 7
  const points = []

  for (let i = 0; i < pointCount; i += 1) {
    const normalized = i / (pointCount - 1)
    const side = i % 2 === 0 ? -1 : 1
    const depthSide = Math.floor(i / 2) % 2 === 0 ? -1 : 1
    const weave = Math.sin(normalized * Math.PI * 2.2 + weavePhase) * bounds.z * 0.24
    const localX = side * bounds.x * randomRange(rand, 0.56, 0.84) + randomRange(rand, -bounds.x * 0.12, bounds.x * 0.12)
    const localZ = depthSide * bounds.z * randomRange(rand, 0.36, 0.76) + weave + randomRange(rand, -bounds.z * 0.14, bounds.z * 0.14)
    const cos = Math.cos(rotation)
    const sin = Math.sin(rotation)
    points.push(clampToSwimBox(new THREE.Vector3(
      localX * cos - localZ * sin,
      traversalY(rand, bounds, i),
      localX * sin + localZ * cos,
    ), bounds))
  }

  return new THREE.CatmullRomCurve3(points, false, 'catmullrom', 0.62)
}

function makeFishOffset(schoolId, creature, index, count) {
  const rand = mulberry32(hashString(`${schoolId}:${creature.id}:dense-instance`))
  const indexRadius = Math.sqrt((index + 0.5) / Math.max(1, count))
  const schoolRadius = SCHOOL_SPACING * Math.sqrt(count) * SCHOOL_FORMATION_RADIUS_SCALE
  const angle = index * GOLDEN_ANGLE + randomRange(rand, -0.16, 0.16)
  const isLeader = index === 0

  return {
    phase: (isLeader ? 1 : (count - 1 - index) / count) * SCHOOL_PHASE_WINDOW + randomRange(rand, -0.006, 0.006),
    lateral: Math.cos(angle) * schoolRadius * indexRadius + randomRange(rand, -0.04, 0.04),
    vertical: Math.sin(angle) * schoolRadius * indexRadius * SCHOOL_VERTICAL_SPREAD + randomRange(rand, -0.035, 0.035),
    longitudinal: isLeader
      ? schoolRadius * SCHOOL_LONGITUDINAL_SPREAD * 0.48
      : (Math.sin(index * GOLDEN_ANGLE * 0.73) * 0.55 + randomRange(rand, -0.45, 0.45)) * schoolRadius * SCHOOL_LONGITUDINAL_SPREAD,
    driftPhase: randomRange(rand, 0, Math.PI * 2),
    driftSpeed: randomRange(rand, 0.72, 1.28),
    speedScale: randomRange(rand, 0.92, 1.08),
  }
}

function makeDenseSchools(creatures, tankVisitSeed) {
  const groups = new Map()
  creatures.forEach(creature => {
    const key = `${creature.biome}:${creature.depthZone}:${creature.species}`
    const group = groups.get(key) ?? []
    group.push(creature)
    groups.set(key, group)
  })

  const species = SPECIES_BY_NAME.get(SARDINE_SPECIES)
  const bodyLength = species?.swim?.bodyLengthWU ?? 1.08
  const modelScale = species?.model?.scale ?? 0.42
  const schoolDescriptors = []
  const fishDescriptors = []

  groups.forEach((group, key) => {
    const ordered = [...group].sort((a, b) => deterministicOrder(a) - deterministicOrder(b))
    for (let offset = 0; offset < ordered.length; offset += DENSE_SCHOOL_MAX_SIZE) {
      const schoolCreatures = ordered.slice(offset, offset + DENSE_SCHOOL_MAX_SIZE)
      if (!schoolCreatures.length) continue
      const first = schoolCreatures[0]
      const schoolId = `${key}:visit-${tankVisitSeed}:dense-school-${Math.floor(offset / DENSE_SCHOOL_MAX_SIZE)}`
      const path = makeSchoolPath(hashString(schoolId), first.depthZone, bodyLength, first.size ?? 1)
      const schoolIndex = schoolDescriptors.length
      const speedRand = mulberry32(hashString(`${schoolId}:speed`))
      schoolDescriptors.push({
        id: schoolId,
        path,
        pathLength: Math.max(0.001, path.getLength()),
        progress: randomRange(speedRand, 0, SCHOOL_PHASE_WINDOW * 0.5),
        speed: randomRange(speedRand, 0.35, 0.58),
      })
      schoolCreatures.forEach((creature, index) => {
        fishDescriptors.push({
          creature,
          schoolIndex,
          offset: makeFishOffset(schoolId, creature, index, schoolCreatures.length),
          size: creature.size ?? 1,
          modelScale,
        })
      })
    }
  })

  return { schoolDescriptors, fishDescriptors }
}

function extractInstancedMeshes(gltf) {
  gltf.scene.updateMatrixWorld(true)
  const rootInverse = gltf.scene.matrixWorld.clone().invert()
  const meshes = []

  gltf.scene.traverse(child => {
    if (!child.isMesh || !child.geometry || !child.material) return
    const localMatrix = rootInverse.clone().multiply(child.matrixWorld)
    const material = child.material.clone()
    material.transparent = false
    material.depthWrite = true
    if ('roughness' in material) material.roughness = material.roughness ?? 0.5
    meshes.push({ geometry: child.geometry, material, localMatrix })
  })

  return meshes
}

export function isDenseSardineCreature(creature) {
  return creature.alive && creature.species === SARDINE_SPECIES && creature.biome === 'ocean'
}

export function shouldUseDenseSardineRenderer(creatures) {
  return creatures.filter(isDenseSardineCreature).length >= DENSE_SARDINE_THRESHOLD
}

export default function DenseSardineSchool({ creatures, tankVisitSeed = 0, selectedCreatureId, onCreatureClick, onCreatureReady }) {
  const gltf = useGLTF(SARDINE_MODEL_PATH)
  const instancedMeshes = useMemo(() => extractInstancedMeshes(gltf), [gltf])
  const schoolData = useMemo(() => makeDenseSchools(creatures, tankVisitSeed), [creatures, tankVisitSeed])
  const meshRefs = useRef([])
  const virtualRefs = useRef(new Map())
  const selectedCreatureIdRef = useRef(selectedCreatureId)

  selectedCreatureIdRef.current = selectedCreatureId

  useEffect(() => {
    const refs = new Map()
    schoolData.fishDescriptors.forEach(({ creature }) => {
      const object = new THREE.Object3D()
      const ref = { current: object }
      refs.set(creature.id, ref)
      onCreatureReady?.(creature, ref)
    })
    virtualRefs.current = refs
  }, [schoolData, onCreatureReady])

  useFrame((_, delta) => {
    const { schoolDescriptors, fishDescriptors } = schoolData
    schoolDescriptors.forEach(school => {
      school.progress += delta * school.speed / school.pathLength
      if (school.progress >= 1 - SCHOOL_PHASE_WINDOW) school.progress = 0
    })

    const now = performance.now() / 1000
    fishDescriptors.forEach((descriptor, index) => {
      const { creature, schoolIndex, offset, size, modelScale } = descriptor
      const school = schoolDescriptors[schoolIndex]
      const t = THREE.MathUtils.clamp(school.progress + offset.phase, 0, 1)
      school.path.getPointAt(t, scratchPosition)
      school.path.getPointAt(Math.min(t + 0.006, 1), scratchNext)
      scratchTangent.subVectors(scratchNext, scratchPosition)
      if (scratchTangent.lengthSq() < 0.0001) school.path.getTangentAt(t, scratchTangent)
      scratchTangent.normalize()
      scratchLateral.set(scratchTangent.z, 0, -scratchTangent.x)
      if (scratchLateral.lengthSq() < 0.0001) scratchLateral.set(1, 0, 0)
      scratchLateral.normalize()

      const drift = Math.sin(now * offset.driftSpeed + offset.driftPhase) * SCHOOL_DRIFT
      scratchPosition
        .addScaledVector(scratchLateral, offset.lateral + drift)
        .addScaledVector(UP, offset.vertical)
        .addScaledVector(scratchTangent, offset.longitudinal)

      scratchLook.lookAt(scratchPosition, scratchNext.copy(scratchPosition).addScaledVector(scratchTangent, -1), UP)
      scratchQuaternion.setFromRotationMatrix(scratchLook)
      const focusScale = creature.id === selectedCreatureIdRef.current ? 1.12 : 1
      scratchScale.setScalar(size * modelScale * focusScale)
      scratchMatrix.compose(scratchPosition, scratchQuaternion, scratchScale)

      const virtualRef = virtualRefs.current.get(creature.id)
      if (virtualRef?.current) {
        virtualRef.current.position.copy(scratchPosition)
        virtualRef.current.quaternion.copy(scratchQuaternion)
        virtualRef.current.scale.copy(scratchScale)
      }

      meshRefs.current.forEach((mesh, meshIndex) => {
        if (!mesh) return
        scratchInstanceMatrix.multiplyMatrices(scratchMatrix, instancedMeshes[meshIndex].localMatrix)
        mesh.setMatrixAt(index, scratchInstanceMatrix)
      })
    })

    meshRefs.current.forEach(mesh => {
      if (!mesh) return
      mesh.instanceMatrix.needsUpdate = true
    })
  })

  const handlePointerUp = (event) => {
    const descriptor = schoolData.fishDescriptors[event.instanceId]
    if (!descriptor) return
    event.stopPropagation()
    event.nativeEvent?.stopImmediatePropagation?.()
    event.nativeEvent?.preventDefault?.()
    if (event.delta > 8) return
    onCreatureClick?.(descriptor.creature, virtualRefs.current.get(descriptor.creature.id))
  }

  return (
    <group>
      {instancedMeshes.map((mesh, meshIndex) => (
        <instancedMesh
          key={meshIndex}
          ref={element => { meshRefs.current[meshIndex] = element }}
          args={[mesh.geometry, mesh.material, schoolData.fishDescriptors.length]}
          frustumCulled={false}
          onPointerUp={handlePointerUp}
          onClick={handlePointerUp}
        />
      ))}
    </group>
  )
}

useGLTF.preload(SARDINE_MODEL_PATH)
