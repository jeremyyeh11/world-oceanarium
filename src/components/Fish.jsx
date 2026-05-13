import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

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
  x: 9.5,
  z: 3.8,
}

const tangent = new THREE.Vector3()
const lookTarget = new THREE.Vector3()
const up = new THREE.Vector3(0, 1, 0)

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

function makeSwimPath(creature) {
  const rand = mulberry32(hashString(creature.id ?? creature.species ?? 'fish'))
  const [yMin, yMax] = DEPTH_Y[creature.depthZone] ?? DEPTH_Y.epipelagic
  const pointCount = 7
  const points = []

  for (let i = 0; i < pointCount; i += 1) {
    const side = i % 2 === 0 ? -1 : 1
    const x = side * randomRange(rand, SWIM_BOX.x * 0.45, SWIM_BOX.x)
    const y = randomRange(rand, yMin, yMax)
    const z = randomRange(rand, -SWIM_BOX.z, SWIM_BOX.z)
    points.push(new THREE.Vector3(x, y, z))
  }

  return new THREE.CatmullRomCurve3(points, true, 'catmullrom', 0.42)
}

export default function Fish({ creature, selected = false, onClick }) {
  const ref = useRef()
  const path = useMemo(() => makeSwimPath(creature), [creature])
  const motion = useMemo(() => {
    const rand = mulberry32(hashString(`${creature.id ?? creature.species}-motion`))
    return {
      offset: rand(),
      speed: randomRange(rand, 0.018, 0.034),
      bobPhase: randomRange(rand, 0, Math.PI * 2),
      bobAmount: randomRange(rand, 0.035, 0.11),
    }
  }, [creature])

  useFrame(({ clock }) => {
    const fish = ref.current
    if (!fish) return

    const t = (motion.offset + clock.getElapsedTime() * motion.speed) % 1
    const position = path.getPointAt(t)
    const next = path.getPointAt((t + 0.006) % 1)

    fish.position.copy(position)
    fish.position.y += Math.sin(clock.getElapsedTime() * 1.7 + motion.bobPhase) * motion.bobAmount

    tangent.subVectors(next, position).normalize()
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
    <mesh
      ref={ref}
      scale={[size * focusScale, size * focusScale, size * focusScale]}
      onClick={(e) => { e.stopPropagation(); onClick(creature, ref) }}
    >
      <boxGeometry args={[0.7, 0.28, 0.18]} />
      <meshStandardMaterial color={creature.color ?? '#7ab8c0'} roughness={0.42} metalness={0.02} envMapIntensity={0.85} />
    </mesh>
  )
}
