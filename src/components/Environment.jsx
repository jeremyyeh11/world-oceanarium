import { Suspense, useRef, useEffect, useLayoutEffect, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { CAUSTIC_TIME, applyCaustics, causticsCacheKey } from '../utils/caustics'
import Landscape from './Landscape'
import { landscapePieces, sandGrain, sandHeight } from '../data/landscapes'
import { clearRockObstacles, clearSeabed, setRockObstacles, setSeabed } from './rockObstacles'

// Radial alpha fade so the seabed's outer rim dissolves to nothing instead of ending in a
// hard edge/horizon line when the follow cam looks toward it. The plane's local xy spans
// ±180 (360 wide); fade the outer band to transparent so the background shows through
// seamlessly. depthWrite stays on — nothing renders below the floor.
//
// With `grainShade` (a landscape's sand) the sand also shades by its grain before fog,
// from a per-vertex `sandGrain` attribute in [-1, 1]: troughs darken to 55% and crests
// brighten to 120%. The soft underwater light barely shades gentle dunes on its own, so
// without this the relief reads flat, especially at the default view's grazing angle. The
// large hills are left out of it, or the whole basin would read dark against them.
//
// `caustics` (a landscape's, utils/caustics.js) lays the sunlight net on the sand too.
function makeFloorMaterial(color, grainShade = false, caustics = null) {
  const material = new THREE.MeshStandardMaterial({
    color, roughness: 0.92, envMapIntensity: 0.28, side: THREE.DoubleSide, transparent: true, depthWrite: true,
  })
  material.onBeforeCompile = (shader) => {
    const grainVertex = grainShade ? '\nattribute float sandGrain;\nvarying float vSandGrain;' : ''
    const grainFragment = grainShade ? '\nvarying float vSandGrain;' : ''
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\nvarying float vFloorRadial;${grainVertex}`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>\nvFloorRadial = length(position.xy) / 180.0;${grainShade ? '\nvSandGrain = sandGrain;' : ''}`)
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\nvarying float vFloorRadial;${grainFragment}`)
      .replace('#include <dithering_fragment>', '#include <dithering_fragment>\ngl_FragColor.a *= 1.0 - smoothstep(0.5, 0.94, vFloorRadial);')
    if (grainShade) {
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <fog_fragment>',
        'gl_FragColor.rgb *= mix(0.55, 1.2, smoothstep(-1.0, 1.0, vSandGrain));\n#include <fog_fragment>',
      )
    }
    // The plane is double-sided with its normals facing down, so the sand takes |normal.y|.
    applyCaustics(shader, caustics && { ...caustics, twoSided: true })
  }
  material.customProgramCacheKey = () => `floor:${grainShade}|${causticsCacheKey(caustics)}`
  return material
}

function noise(x, z) {
  const n = Math.sin(x * 127.1 + z * 311.7) * 43758.5453
  return (n - Math.floor(n)) * 2 - 1
}

export const FLOOR_Y = { ocean: -52, 'tropical-river': -12, lake: -20 }
const FLOOR_COLORS = { ocean: '#0e1f33', 'tropical-river': '#1a2e14', lake: '#1a2e1c' }

// A tank landscape brings its own seabed height; every other tank uses its biome's floor.
export function floorYFor(biome, landscape = null) {
  return landscape?.floorY ?? FLOOR_Y[biome] ?? -20
}

// Floor height under a point, for keeping a camera above it: a landscape's sand rises in
// dunes and hills well above its mean level.
export function floorHeightAt(biome, landscape, x, z) {
  return landscape ? sandHeight(landscape, x, z) : floorYFor(biome)
}

function NoiseFloor({ biome, landscape }) {
  const ref = useRef()
  const floorY = floorYFor(biome, landscape)
  const color = landscape?.floorColor ?? FLOOR_COLORS[biome] ?? '#0e1f33'
  const grainShade = Boolean(landscape)
  const caustics = landscape?.caustics ?? null
  const material = useMemo(() => makeFloorMaterial(color, grainShade, caustics), [color, grainShade, caustics])

  // Material is created imperatively (not as a JSX tag), so R3F won't auto-dispose it.
  // Free the old shader program/GPU resources when the biome changes or the floor unmounts.
  useEffect(() => () => material.dispose(), [material])

  useEffect(() => {
    if (!ref.current) return
    const geometry = ref.current.geometry
    const pos = geometry.attributes.position
    const grain = landscape ? new Float32Array(pos.count) : null
    // The plane is rotated +90° about x: local y becomes world z and local -z becomes world
    // height. A landscape's sand uses the same smooth function its rocks are placed on.
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i)
      const y = pos.getY(i)
      const bump = landscape
        ? sandHeight(landscape, x, y) - landscape.floorY
        : noise(x * 0.2, y * 0.2) * 1.2 + noise(x * 0.6, y * 0.6) * 0.4
      pos.setZ(i, -bump)
      if (grain) grain[i] = sandGrain(x, y)
    }
    if (grain) geometry.setAttribute('sandGrain', new THREE.BufferAttribute(grain, 1))
    pos.needsUpdate = true
    ref.current.geometry.computeVertexNormals()
  }, [landscape])

  return (
    // Oversized seabed: the extra span pushes the plane's edges far out into the distance
    // fog so orbiting the follow cam never reveals a hard rim — the floor reads as fading
    // into the horizon. The visible near-floor is unchanged (it sits well below the swim
    // zone and is already fog-dimmed), so this only affects grazing/low orbit angles.
    <mesh ref={ref} rotation={[Math.PI / 2, 0, 0]} position={[0, floorY, 0]} material={material}>
      {/* A landscape's hummocks and ripples need finer vertices (1.9 WU) than open water's. */}
      <planeGeometry args={[360, 360, landscape ? 192 : 96, landscape ? 192 : 96]} />
    </mesh>
  )
}

// Advances the caustics' shared clock (utils/caustics.js) while a landscape with them is up.
function CausticClock() {
  useFrame(({ clock }) => {
    CAUSTIC_TIME.value = clock.getElapsedTime()
  })
  return null
}

function RiverVegetation() {
  const plants = [
    [-7, -10.2, -2.4, 2.3], [-5.4, -10.4, 1.8, 3.1], [-3.2, -10.8, -1.1, 1.8],
    [-1.2, -10.5, 2.5, 2.6], [1.4, -10.7, -2.1, 2.2], [3.6, -10.3, 0.8, 3.5],
    [5.8, -10.6, -1.7, 2.0], [7.1, -10.4, 2.2, 2.8],
  ]
  return plants.map(([x, y, z, h], i) => (
    <mesh key={i} position={[x, y + h / 2, z]}>
      <cylinderGeometry args={[0.06, 0.16, h, 6]} />
      <meshStandardMaterial color={i % 2 ? '#2f7d3f' : '#1f5f32'} roughness={0.58} envMapIntensity={0.45} />
    </mesh>
  ))
}

// Rocks fish can meet: anything reaching above the Mola's lowest fin (y -21 leaves a margin)
// near the swim volume. maxPad covers the largest body pad rockObstacles.js applies.
const ROCK_OBSTACLE_OPTIONS = {
  region: { xMin: -85, xMax: 85, zMin: -75, zMax: 25 },
  floorTop: -21,
  maxPad: 8,
}

export default function Environment({ biome, landscape = null, environmentId = null }) {
  // Publish the tank's rocks to the fish before their first frame (layout effect), from the
  // same seeded layout the Landscape renders, so avoidance never waits for the rock kit.
  const pieces = useMemo(() => (landscape ? landscapePieces(landscape) : null), [landscape])
  useLayoutEffect(() => {
    if (!pieces) return undefined
    const owner = setRockObstacles(pieces, ROCK_OBSTACLE_OPTIONS)
    return () => clearRockObstacles(owner)
  }, [pieces])
  // The sand, for fish to stay above (rockObstacles.js liftAboveSeabed), with its highest point
  // over the obstacle region found once on a 1 WU grid.
  useLayoutEffect(() => {
    if (!landscape) return undefined
    const { region } = ROCK_OBSTACLE_OPTIONS
    let top = -Infinity
    for (let x = region.xMin; x <= region.xMax; x += 1) {
      for (let z = region.zMin; z <= region.zMax; z += 1) top = Math.max(top, sandHeight(landscape, x, z))
    }
    const owner = setSeabed((x, z) => sandHeight(landscape, x, z), top)
    return () => clearSeabed(owner)
  }, [landscape])

  return (
    <group>
      <NoiseFloor biome={biome} landscape={landscape} />
      {landscape?.caustics && <CausticClock />}
      {/* The rock kit loads on its own so the seabed and fish never wait for it. */}
      {landscape && (
        <Suspense fallback={null}>
          <Landscape landscape={landscape} environmentId={environmentId} />
        </Suspense>
      )}
      {biome === 'tropical-river' && <RiverVegetation />}
    </group>
  )
}
