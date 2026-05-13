import { useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { SPECIES } from '../data/species'

const DEPTH_Y = {
  epipelagic: [-2.2, 3.0],
  mesopelagic: [-15, -8],
  bathypelagic: [-27, -20],
  abyssalpelagic: [-40, -34],
  hadalpelagic: [-50, -45],
  shallow: [1, 3],
  mid: [-4, -1],
  deep: [-8, -4],
  benthic: [-10, -7],
}

const SWIM_BOX = {
  x: 8.0,
  z: 7.4,
}

const SPECIES_BY_NAME = new Map(SPECIES.map(species => [species.name, species]))
const DEFAULT_SWIM = { speed: 1, erraticness: 0.35, turnRadius: 0.65 }

const tangent = new THREE.Vector3()
const lookTarget = new THREE.Vector3()
const up = new THREE.Vector3(0, 1, 0)
const nextPoint = new THREE.Vector3()

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

function resolveSwimProfile(creature) {
  const species = SPECIES_BY_NAME.get(creature.species)
  const speciesSwim = species?.swim ?? DEFAULT_SWIM
  const traits = creature.traits ?? {}

  return {
    speed: traits.swimSpeed ?? speciesSwim.speed ?? DEFAULT_SWIM.speed,
    erraticness: traits.swimErraticness ?? speciesSwim.erraticness ?? DEFAULT_SWIM.erraticness,
    turnRadius: traits.turnRadius ?? speciesSwim.turnRadius ?? DEFAULT_SWIM.turnRadius,
  }
}

function clampToSwimBox(point, yMin, yMax) {
  point.x = THREE.MathUtils.clamp(point.x, -SWIM_BOX.x, SWIM_BOX.x)
  point.y = THREE.MathUtils.clamp(point.y, yMin, yMax)
  point.z = THREE.MathUtils.clamp(point.z, -SWIM_BOX.z, SWIM_BOX.z)
  return point
}

function randomPoint(rand, yMin, yMax, swim, index = 0) {
  const midY = (yMin + yMax) / 2
  const halfY = (yMax - yMin) / 2
  const verticalRange = THREE.MathUtils.lerp(0.16, 1.0, swim.erraticness)
  const edgeBias = index % 2 === 0 ? -0.55 : 0.55

  return new THREE.Vector3(
    randomRange(rand, -SWIM_BOX.x * 0.82, SWIM_BOX.x * 0.82) + edgeBias,
    midY + randomRange(rand, -halfY * verticalRange, halfY * verticalRange),
    randomRange(rand, -SWIM_BOX.z, SWIM_BOX.z),
  )
}

function makeSwimPath(creature, swim, seed = hashString(creature.id ?? creature.species ?? 'fish'), start = null, exitTangent = null) {
  const rand = mulberry32(seed)
  const [yMin, yMax] = DEPTH_Y[creature.depthZone] ?? DEPTH_Y.epipelagic
  const pointCount = Math.round(THREE.MathUtils.lerp(8, 5, swim.turnRadius))
  const points = []

  if (start && exitTangent) {
    points.push(start.clone())

    const leadDistance = THREE.MathUtils.lerp(1.8, 5.8, swim.turnRadius) * randomRange(rand, 0.86, 1.12)
    const lead = start.clone().add(exitTangent.clone().normalize().multiplyScalar(leadDistance))
    const verticalKick = THREE.MathUtils.lerp(0.12, 0.85, swim.erraticness)
    lead.y += randomRange(rand, -verticalKick, verticalKick)
    lead.z += randomRange(rand, -0.55, 0.55)
    points.push(clampToSwimBox(lead, yMin, yMax))

    for (let i = 2; i < pointCount; i += 1) points.push(randomPoint(rand, yMin, yMax, swim, i))
  } else {
    for (let i = 0; i < pointCount; i += 1) points.push(randomPoint(rand, yMin, yMax, swim, i))
  }

  const tension = THREE.MathUtils.lerp(0.32, 0.74, swim.turnRadius)
  return new THREE.CatmullRomCurve3(points, false, 'catmullrom', tension)
}

function makePathGeometry(path) {
  return new THREE.BufferGeometry().setFromPoints(path.getPoints(120))
}

function depthFadeFromScreenZ(z) {
  const normalized = THREE.MathUtils.clamp((z + SWIM_BOX.z) / (SWIM_BOX.z * 2), 0, 1)
  return THREE.MathUtils.lerp(0.22, 1.0, normalized ** 1.65)
}

export default function Fish({ creature, selected = false, debug = false, onClick }) {
  const ref = useRef()
  const materialRef = useRef()
  const swim = useMemo(() => resolveSwimProfile(creature), [creature])
  const pathSeed = useRef(hashString(creature.id ?? creature.species ?? 'fish'))
  const progress = useRef(0)
  const [path, setPath] = useState(() => makeSwimPath(creature, swim, pathSeed.current))
  const pathRef = useRef(path)
  const splineGeometry = useMemo(() => makePathGeometry(path), [path])
  const motion = useMemo(() => {
    const rand = mulberry32(hashString(`${creature.id ?? creature.species}-motion`))
    return {
      speed: randomRange(rand, 0.018, 0.034) * swim.speed,
      bobPhase: randomRange(rand, 0, Math.PI * 2),
      bobAmount: randomRange(rand, 0.035, 0.11) * THREE.MathUtils.lerp(0.45, 1.35, swim.erraticness),
    }
  }, [creature, swim])

  useFrame(({ clock }, delta) => {
    const fish = ref.current
    if (!fish) return

    progress.current += delta * motion.speed

    if (progress.current >= 1) {
      const oldPath = pathRef.current
      const endPoint = oldPath.getPointAt(1)
      const endTangent = oldPath.getTangentAt(1).normalize()

      pathSeed.current = Math.imul(pathSeed.current ^ 0x9E3779B9, 1664525) >>> 0
      const nextPath = makeSwimPath(creature, swim, pathSeed.current, endPoint, endTangent)
      pathRef.current = nextPath
      setPath(nextPath)
      progress.current = 0
    }

    const activePath = pathRef.current
    const t = THREE.MathUtils.clamp(progress.current, 0, 1)
    const position = activePath.getPointAt(t)
    activePath.getPointAt(Math.min(t + 0.006, 1), nextPoint)

    fish.position.copy(position)
    fish.position.y += Math.sin(clock.getElapsedTime() * 1.7 + motion.bobPhase) * motion.bobAmount

    const fade = depthFadeFromScreenZ(fish.position.z)
    if (materialRef.current) {
      materialRef.current.opacity = fade
      materialRef.current.envMapIntensity = THREE.MathUtils.lerp(0.25, 0.95, fade)
    }

    tangent.subVectors(nextPoint, position).normalize()
    lookTarget.copy(fish.position).add(tangent)
    fish.lookAt(lookTarget)
    fish.rotateY(Math.PI / 2)

    const pitch = THREE.MathUtils.clamp(tangent.y * 0.55, -0.32, 0.32)
    fish.rotateZ(pitch)
    fish.up.lerp(up, 0.18)
  })

  const size = creature.traits?.size ?? 1
  const focusScale = selected ? 1.08 : 1

  return (
    <group>
      {debug && (
        <line geometry={splineGeometry} raycast={() => null}>
          <lineBasicMaterial color="#7df9ff" transparent opacity={0.55} depthWrite={false} />
        </line>
      )}
      <mesh
        ref={ref}
        scale={[size * focusScale, size * focusScale, size * focusScale]}
        onClick={(e) => { e.stopPropagation(); onClick(creature, ref) }}
      >
        <boxGeometry args={[0.7, 0.28, 0.18]} />
        <meshStandardMaterial
          ref={materialRef}
          color={creature.color ?? '#7ab8c0'}
          roughness={0.42}
          metalness={0.02}
          envMapIntensity={0.85}
          transparent
          opacity={1}
        />
      </mesh>
    </group>
  )
}
