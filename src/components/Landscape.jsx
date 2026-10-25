import { Suspense, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { useEnvironmentGLTF as useGLTF, useEnvironmentTextures as useTexture } from '../hooks/useEnvironmentLoading'
import { environmentLoader } from '../loading/environmentRuntime'
import { runSlicedPreparation } from '../loading/runSlicedPreparation.js'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { MeshBVH } from 'three-mesh-bvh'
import { landscapeForTank, landscapePieces, rubblePieces, seededRandom } from '../data/landscapes'
import { TANKS } from '../data/species'
import { clearCoralSurfaces, clearReefSurfaces, setCoralSurfaces, setReefSurfaces } from './reefSites'
import { clearExtraObstacles, setExtraObstacles } from './rockObstacles'
import { coralClusters, coralRockOf, measureCoral, placeCorals } from './coralPlacement'
import { measureColony, placeStaghorn } from './staghornPlacement'
import { inFan, measureFan, placeSeaFans } from './seaFanPlacement'
import { applyCaustics, causticsCacheKey } from '../utils/caustics'
import { addSwayAttributes, applyCoralSway, useSwayClock } from '../utils/coralSway'

// Rocks for a tank landscape (src/data/landscapes.js), kitbashed from the landscape's kit of
// modelled rocks. Every piece and rubble chunk is transformed, given fresh UVs and baked into
// a few chunk meshes (one draw call each, culled when off screen).

const scratchA = new THREE.Vector3()
const scratchB = new THREE.Vector3()
const scratchC = new THREE.Vector3()

// Base orientations a rock can be laid in before its spin: upright, on either side, or upside
// down. Tall kinds stay upright so cliffs and bommies keep their silhouette.
const LAYS = [[0, 0, 0], [Math.PI / 2, 0, 0], [-Math.PI / 2, 0, 0], [0, 0, Math.PI / 2], [0, 0, -Math.PI / 2], [Math.PI, 0, 0]]
const UPRIGHT_KINDS = new Set(['cliff', 'bommie'])
const FIT_CANDIDATES = 8
const UP = new THREE.Vector3(0, 1, 0)

// Size of a rock's bounds once rotated.
function rotatedSize(geometry, quaternion) {
  const position = geometry.attributes.position
  const min = new THREE.Vector3(Infinity, Infinity, Infinity)
  const max = new THREE.Vector3(-Infinity, -Infinity, -Infinity)
  for (let i = 0; i < position.count; i++) {
    scratchA.fromBufferAttribute(position, i).applyQuaternion(quaternion)
    min.min(scratchA)
    max.max(scratchA)
  }
  return max.sub(min)
}

// How unevenly a rock of this size has to stretch to fill a piece's box (1 = uniform).
function stretchOf(size, piece) {
  const scales = [piece.width / size.x, piece.height / size.y, piece.depth / size.z]
  return Math.max(...scales) / Math.min(...scales)
}

// Seeded per-piece choices: which kit rock, how it is laid, spun and tilted before it is
// fitted to its box, and where its texture starts. Several rock-and-orientation candidates
// are tried and the one needing the least uneven stretch wins, so a tall slot gets a tall
// rock and a low mound gets a rock laid on its side rather than a squashed spire.
function pieceLook(kit, piece, rocks) {
  const rand = seededRandom((piece.seed * 2654435761) >>> 0)
  const variants = kit.variants[piece.kind] ?? kit.variants.boulder
  const uvOffset = [rand(), rand()]
  if (piece.kind === 'rubble') {
    const rotation = new THREE.Quaternion().setFromEuler(new THREE.Euler(rand() * Math.PI * 2, rand() * Math.PI * 2, rand() * Math.PI * 2))
    return { rock: variants[Math.floor(rand() * variants.length)], rotation, uvOffset }
  }
  const tilt = kit.tilt[piece.kind] ?? 0.2
  let best = null
  for (let c = 0; c < FIT_CANDIDATES; c++) {
    const rock = variants[Math.floor(rand() * variants.length)]
    const lay = UPRIGHT_KINDS.has(piece.kind) ? LAYS[0] : LAYS[Math.floor(rand() * LAYS.length)]
    const rotation = new THREE.Quaternion().setFromAxisAngle(UP, rand() * Math.PI * 2)
      .multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler((rand() * 2 - 1) * tilt, 0, (rand() * 2 - 1) * tilt)))
      .multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(...lay)))
    const stretch = stretchOf(rotatedSize(rocks[`rock${rock}_lo`], rotation), piece)
    if (!best || stretch < best.stretch) best = { rock, rotation, stretch }
  }
  return { ...best, uvOffset }
}

// Fits a kit rock to a piece: rotate it, squeeze its bounds into the piece's box with the base
// at 0, then yaw and place it. No axis stretches more than maxStretch times another: the
// longer axes are shrunk instead, so a piece only ever gets smaller than its box and its
// clearance from the swim volume holds.
function placeRock(source, piece, rotation, maxStretch) {
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', source.attributes.position.clone())
  geometry.setAttribute('normal', source.attributes.normal.clone())
  geometry.setIndex(source.index.clone())
  geometry.applyQuaternion(rotation)
  geometry.computeBoundingBox()
  const box = geometry.boundingBox
  const size = box.getSize(new THREE.Vector3())
  const center = box.getCenter(new THREE.Vector3())
  const scales = [piece.width / size.x, piece.height / size.y, piece.depth / size.z]
  const cap = Math.min(...scales) * maxStretch
  geometry.translate(-center.x, -box.min.y, -center.z)
  geometry.scale(...scales.map(scale => Math.min(scale, cap)))
  geometry.rotateY(piece.yaw)
  geometry.translate(piece.x, piece.y, piece.z)
  return geometry
}

// Cube-projects UVs in world space, after the rock has been stretched, so the texture keeps
// one size on every rock (Blender's Cube Projection). Each triangle maps along the axis its
// face points most along; a vertex shared by triangles on different axes is split, so each
// projection keeps its own UV. Signs follow the face direction so the normal map's bumps
// stay the right way round on opposite faces.
function projectUVs(geometry, tile, [offsetU, offsetV]) {
  const position = geometry.attributes.position
  const normal = geometry.attributes.normal
  const index = geometry.index.array
  const remap = new Map()
  const positions = []
  const normals = []
  const uvs = []
  const indices = new Uint32Array(index.length)
  for (let t = 0; t < index.length; t += 3) {
    scratchA.fromBufferAttribute(position, index[t])
    scratchB.fromBufferAttribute(position, index[t + 1]).sub(scratchA)
    scratchC.fromBufferAttribute(position, index[t + 2]).sub(scratchA)
    scratchB.cross(scratchC)
    const ax = Math.abs(scratchB.x)
    const ay = Math.abs(scratchB.y)
    const az = Math.abs(scratchB.z)
    const axis = ax >= ay && ax >= az ? 0 : ay >= az ? 1 : 2
    const sign = Math.sign(axis === 0 ? scratchB.x : axis === 1 ? scratchB.y : scratchB.z) || 1
    for (let k = 0; k < 3; k++) {
      const vertex = index[t + k]
      const key = vertex * 6 + axis * 2 + (sign > 0 ? 1 : 0)
      let mapped = remap.get(key)
      if (mapped === undefined) {
        mapped = positions.length / 3
        remap.set(key, mapped)
        const x = position.getX(vertex)
        const y = position.getY(vertex)
        const z = position.getZ(vertex)
        positions.push(x, y, z)
        normals.push(normal.getX(vertex), normal.getY(vertex), normal.getZ(vertex))
        const [u, v] = axis === 0 ? [-sign * z, y] : axis === 1 ? [x, -sign * z] : [sign * x, y]
        uvs.push(u / tile + offsetU, v / tile + offsetV)
      }
      indices[t + k] = mapped
    }
  }
  const projected = new THREE.BufferGeometry()
  projected.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  projected.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3))
  projected.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
  projected.setIndex(new THREE.BufferAttribute(indices, 1))
  return projected
}

// Painted light and shadow on the rock (a landscape's `rockShade`): the scene lights alone leave the
// limestone one even mid value, where a reef under sun reads as dark rock with sunlit tops.
// Darkens the whole rock by `tone`, its downward faces toward `underside` and its upward ones
// up to `top`, and its lower reaches toward `low` (from `lowY` up to `highY`, world y). The
// baked chunks are in world space, so the vertex normal and position are already world ones.
// `shade.warm` tints the upward faces near the surface warmer (sunlight, and a stand-in for
// the colour corals will bring): by up to `strength` toward `color`, from `yLow` to `yHigh`.
// `caustics` (utils/caustics.js) adds the sunlight net on top.
function applyRockShade(material, shade, caustics) {
  if (!shade && !caustics) return
  const warm = shade?.warm
  material.onBeforeCompile = (shader) => {
    if (shade) {
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nvarying float vRockUp;\nvarying float vRockY;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvRockUp = normal.y;\nvRockY = position.y;')
      const warmGlsl = warm ? `
        float rockWarm = smoothstep(0.3, 0.9, vRockUp) * smoothstep(${warm.yLow.toFixed(2)}, ${warm.yHigh.toFixed(2)}, vRockY) * ${warm.strength.toFixed(3)};
        diffuseColor.rgb *= mix(vec3(1.0), vec3(${warm.color.map(c => c.toFixed(3)).join(', ')}), rockWarm);` : ''
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', '#include <common>\nvarying float vRockUp;\nvarying float vRockY;')
        .replace('#include <map_fragment>', `#include <map_fragment>
        float rockFacing = mix(${shade.underside.toFixed(3)}, ${shade.top.toFixed(3)}, smoothstep(-0.5, 0.8, vRockUp));
        float rockHeight = mix(${shade.low.toFixed(3)}, 1.0, smoothstep(${shade.lowY.toFixed(2)}, ${shade.highY.toFixed(2)}, vRockY));
        diffuseColor.rgb *= ${shade.tone.toFixed(3)} * rockFacing * rockHeight;${warmGlsl}`)
    }
    applyCaustics(shader, caustics)
  }
  material.customProgramCacheKey = () => `rock-shade:${JSON.stringify(shade)}|${causticsCacheKey(caustics)}`
}

// Whether a piece's box reaches into the landscape's reef reach (see reefSites.js).
function inReefReach(reach, piece) {
  if (!reach || piece.kind === 'rubble') return false
  const r = Math.max(piece.width, piece.depth) / 2
  return piece.x + r > reach.xMin && piece.x - r < reach.xMax
    && piece.z + r > reach.zMin && piece.z - r < reach.zMax
    && piece.y + piece.height > reach.yMin && piece.y < reach.yMax
}

function makeLandscapeChunks(landscape, rocks) {
  const { kit } = landscape
  const camera = new THREE.Vector3(landscape.view?.x ?? 0, landscape.view?.y ?? -3.35, landscape.view?.z ?? 10)
  const pieces = [...landscapePieces(landscape), ...(landscape.rubble ? rubblePieces(landscape) : [])]
  const chunks = new Map()
  // The placed rocks reef fish can reach, kept whole (not merged) for their raycasts.
  const reefSurfaces = []
  // The placed rocks table corals can grow on, grouped by rock (coralRockOf) and kept whole too.
  const bySeed = landscape.corals ? new Map(pieces.map(piece => [piece.seed, piece])) : null
  const coralRocks = new Map()
  // How far each placed rock's real top sits below its box top (rocks shrink to fit their
  // box), so a stacked tier can be dropped onto the rock it rests on.
  const topShortfall = new Map()
  for (const piece of pieces) {
    const look = pieceLook(kit, piece, rocks)
    const near = camera.distanceTo(scratchA.set(piece.x, piece.y + piece.height / 2, piece.z)) < kit.hiDetailDistance
    const lod = piece.kind === 'rubble' ? 'rubble' : near ? 'hi' : 'lo'
    const source = rocks[`rock${look.rock}_${lod}`] ?? rocks[`rock${look.rock}_lo`]
    const placed = placeRock(source, piece, look.rotation, piece.kind === 'rubble' ? Infinity : kit.maxStretch[piece.kind] ?? 2)
    const drop = topShortfall.get(piece.restsOn) ?? 0
    if (drop > 0) placed.translate(0, -drop, 0)
    placed.computeBoundingBox()
    topShortfall.set(piece.seed, piece.top - placed.boundingBox.max.y)
    const projected = projectUVs(placed, kit.textureTileWU, look.uvOffset)
    const reachable = inReefReach(landscape.reefReach, piece)
    if (reachable) reefSurfaces.push(placed)
    const rock = bySeed && piece.kind !== 'rubble' ? coralRockOf(piece, bySeed) : null
    if (rock !== null) {
      if (!coralRocks.has(rock)) coralRocks.set(rock, [])
      coralRocks.get(rock).push(placed)
    }
    if (!reachable && rock === null) placed.dispose()
    const key = `${Math.floor(piece.x / kit.chunkWU)}:${Math.floor(piece.z / kit.chunkWU)}`
    if (!chunks.has(key)) chunks.set(key, [])
    chunks.get(key).push(projected)
  }
  const merged = [...chunks].map(([key, parts]) => {
    const geometry = mergeGeometries(parts)
    parts.forEach(part => part.dispose())
    geometry.computeBoundingSphere()
    return { key, geometry }
  })
  return { chunks: merged, reefSurfaces, coralRocks }
}

const PLACEMENT_SLICE_MS = 6
// Placed corals per landscape, for the session.
const PLACED_CORALS = new WeakMap()
// Placed staghorn colonies per landscape, for the session.
const PLACED_STAGHORN = new WeakMap()
// The staghorn thickets reef fish can reach, as raycast surfaces, per landscape.
const THICKET_REEF_SURFACES = new WeakMap()
// The tables reef fish can reach, as raycast surfaces (reefSites.js setCoralSurfaces), per placement.
const CORAL_REEF_SURFACES = new WeakMap()
// Placed sea fans per landscape, for the session.
const PLACED_SEA_FANS = new WeakMap()
// The sea fans reef fish can reach, as raycast surfaces, per placement.
const FAN_REEF_SURFACES = new WeakMap()

// One world-space geometry per table inside the landscape's reef reach, from its _lo mesh (700
// triangles, 300 for the small one: plenty for a ray), with its plate for the site search to aim
// under or at. Built once per placement and kept for the session, BVH trees and all.
function coralReefSurfaces(landscape, corals, meshes, kit) {
  const cached = CORAL_REEF_SURFACES.get(corals)
  if (cached) return cached
  const reach = landscape.reefReach
  const geometries = []
  const metas = []
  for (const coral of corals) {
    const { plate } = coral
    if (reach && (plate.x < reach.xMin || plate.x > reach.xMax || plate.z < reach.zMin || plate.z > reach.zMax
      || plate.y < reach.yMin || plate.y > reach.yMax)) continue
    const source = meshes[`${kit.models[coral.model].name}_lo`]
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', source.attributes.position.clone())
    geometry.setIndex(source.index.clone())
    geometry.applyMatrix4(coral.matrix)
    geometry.computeBoundingBox()
    geometries.push(geometry)
    // The plate is the top 40% of the model: underside at 60% of its height, top at 100%.
    metas.push({
      form: 'table',
      centre: new THREE.Vector3(plate.x, plate.y, plate.z),
      underside: plate.y - plate.thickness / 2,
      top: plate.y + plate.thickness / 2,
      radius: plate.radius,
      foot: new THREE.Vector3().setFromMatrixPosition(coral.matrix),
    })
  }
  const result = { geometries, metas }
  CORAL_REEF_SURFACES.set(corals, result)
  return result
}

// The staghorn thickets inside the landscape's reef reach as raycast surfaces (reefSites.js
// setCoralSurfaces), one per patch: a patch of one colour reads as one thicket, and a fish
// visits it as one, over its crown, at its flank or in among its branches. Each is its colonies'
// _far meshes merged (350 to 600 triangles a colony: the branches where they are, without the
// close-up detail), with the patch's middle, crown, reach and colonies. A generator, run in slices
// (useSlicedPlacement) since a patch's BVH tree takes a few ms: it yields after each patch.
function* thicketReefSurfaces(landscape, colonies, meshes, kit) {
  const reach = landscape.reefReach
  const byPatch = new Map()
  for (const colony of colonies) {
    if (!byPatch.has(colony.patch)) byPatch.set(colony.patch, [])
    byPatch.get(colony.patch).push(colony)
  }
  const geometries = []
  const metas = []
  for (const list of byPatch.values()) {
    const centre = new THREE.Vector3()
    let baseY = Infinity
    list.forEach(colony => {
      centre.add(colony.base)
      baseY = Math.min(baseY, colony.base.y)
    })
    centre.divideScalar(list.length)
    centre.y = baseY
    if (reach && (centre.x < reach.xMin || centre.x > reach.xMax || centre.z < reach.zMin || centre.z > reach.zMax
      || centre.y < reach.yMin - 4 || centre.y > reach.yMax)) continue
    const parts = list.map(colony => {
      const source = meshes[`${kit.models[colony.model].name}_far`]
      const part = new THREE.BufferGeometry()
      part.setAttribute('position', source.attributes.position.clone())
      part.setIndex(source.index.clone())
      return part.applyMatrix4(colony.matrix)
    })
    const geometry = mergeGeometries(parts)
    parts.forEach(part => part.dispose())
    geometry.computeBoundingBox()
    geometry.boundsTree = new MeshBVH(geometry)
    const box = geometry.boundingBox
    // The branches' reach from the middle: the farthest box corner level with it, a little in.
    const radius = Math.max(
      Math.hypot(Math.max(box.max.x - centre.x, centre.x - box.min.x), Math.max(box.max.z - centre.z, centre.z - box.min.z)) * 0.8,
      0.5,
    )
    geometries.push(geometry)
    // Its colonies, for the site search to aim at: the middle of the base, the crown's height
    // and the branches' reach.
    const aims = list.map(colony => ({
      x: colony.base.x, y: colony.base.y, z: colony.base.z, top: colony.centre.y * 2 - colony.base.y, reach: colony.reach,
    }))
    metas.push({ form: 'thicket', centre, top: box.max.y, radius, colonies: aims })
    yield
  }
  return { geometries, metas }
}

// A coral kit's meshes by name and one material per kit model (its baked colour and normal
// maps), shaded like the rock; two-sided when the kit says so (`doubleSided`).
function useCoralKit(kit, caustics) {
  const gltf = useGLTF(kit.path)
  const maps = useTexture(kit.models.flatMap(model => [model.color, model.normal]))
  const meshes = useMemo(() => {
    const byName = {}
    gltf.scene.traverse(object => { if (object.isMesh) byName[object.name] = object.geometry })
    return byName
  }, [gltf])
  const materials = useMemo(() => kit.models.map((model, i) => {
    const [color, normal] = [maps[i * 2], maps[i * 2 + 1]]
    for (const texture of [color, normal]) {
      // Baked onto the glTF's own UVs, which run top-down.
      texture.flipY = false
      texture.anisotropy = 4
      texture.needsUpdate = true
    }
    color.colorSpace = THREE.SRGBColorSpace
    const coralMaterial = new THREE.MeshStandardMaterial({
      map: color, normalMap: normal, roughness: 0.95, metalness: 0, envMapIntensity: 0.35,
      side: kit.doubleSided ? THREE.DoubleSide : THREE.FrontSide,
    })
    applyRockShade(coralMaterial, null, caustics)
    return coralMaterial
  }), [kit, maps, caustics])
  useEffect(() => () => materials.forEach(material => material.dispose()), [materials])
  return { meshes, materials }
}

// Runs a placement generator (coralPlacement.js, staghornPlacement.js) in slices of about
// PLACEMENT_SLICE_MS per frame (a few hundred ms in all on a phone would otherwise freeze the
// tank) and keeps its result for the session in `cache`, by landscape: the same landscape always
// places the same corals, so a return visit draws them at once. start() makes the generator;
// it is rerun when `inputs` change.
function useSlicedPlacement(cache, landscape, start, inputs, environmentId) {
  const [placed, setPlaced] = useState(() => cache.get(landscape) ?? null)
  const finish = useRef(null)
  useLayoutEffect(() => {
    const cached = cache.get(landscape)
    if (cached) {
      setPlaced(cached)
      return undefined
    }
    const complete = environmentLoader.beginPreparation(environmentId, 'landscape-placement')
    finish.current = complete
    const stop = runSlicedPreparation(start, {
      sliceMs: PLACEMENT_SLICE_MS,
      onReady(value) {
        cache.set(landscape, value)
        setPlaced(value)
      },
      onError(error) {
        complete()
        environmentLoader.failActivation(environmentId, error)
      },
    })
    return () => { stop(); complete(); if (finish.current === complete) finish.current = null }
  // start() is a fresh closure every render; `inputs` are what it reads.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cache, landscape, environmentId, ...inputs])
  useLayoutEffect(() => {
    if (placed) { finish.current?.(); finish.current = null }
  }, [placed])
  return placed
}

// A copy of a kit mesh, moved into place.
function kitGeometry(source, matrix) {
  const geometry = new THREE.BufferGeometry()
  for (const attribute of ['position', 'normal', 'uv']) geometry.setAttribute(attribute, source.attributes[attribute].clone())
  geometry.setIndex(source.index.clone())
  return geometry.applyMatrix4(matrix)
}

// Placed kit models ({ model, matrix }) merged per kit model and square chunk (culled when off
// screen), each from its _hi, _lo or _far mesh by its distance (at centreOf) from the resting
// camera.
function mergeKitModels(placed, kit, meshes, view, centreOf) {
  const camera = new THREE.Vector3(view?.x ?? 0, view?.y ?? -3.35, view?.z ?? 10)
  const parts = new Map()
  for (const item of placed) {
    const centre = centreOf(item)
    const distance = camera.distanceTo(centre)
    const lod = distance < kit.hiDetailDistance ? 'hi' : distance < kit.loDetailDistance ? 'lo' : 'far'
    const geometry = kitGeometry(meshes[`${kit.models[item.model].name}_${lod}`], item.matrix)
    const key = `${item.model}:${Math.floor(centre.x / kit.chunkWU)}:${Math.floor(centre.z / kit.chunkWU)}`
    if (!parts.has(key)) parts.set(key, { model: item.model, list: [] })
    parts.get(key).list.push(geometry)
  }
  return [...parts].map(([key, { model, list }]) => {
    const geometry = mergeGeometries(list)
    list.forEach(part => part.dispose())
    geometry.computeBoundingSphere()
    return { key, model, geometry }
  })
}

// One THREE.LOD per bommie's staghorn, each level its colonies merged per kit model, switched by
// the live camera's distance to them: the diver and follow cameras come right up to bommies the
// resting view only sees far off. The close-up level starts as the _lo meshes and gets the _hi
// ones only while the camera is near (StaghornBommie): _hi for every bommie would hold about a
// million triangles, and _lo up close showed flattened, pointed branches (Jeremy, 2026-10-20).
function staghornLods(colonies, kit, meshes, materials) {
  const bySite = new Map()
  for (const colony of colonies) {
    if (!bySite.has(colony.site)) bySite.set(colony.site, [])
    bySite.get(colony.site).push(colony)
  }
  return [...bySite].map(([site, list]) => {
    const centre = new THREE.Vector3()
    list.forEach(colony => centre.add(colony.base))
    centre.divideScalar(list.length)
    const toLocal = new THREE.Matrix4().makeTranslation(-centre.x, -centre.y, -centre.z)
    const byModel = new Map()
    for (const colony of list) {
      if (!byModel.has(colony.model)) byModel.set(colony.model, [])
      byModel.get(colony.model).push(colony)
    }
    const models = [...byModel]
    // This bommie's colonies of one kit model at one level, merged, in the LOD's frame.
    const local = new THREE.Matrix4()
    const merge = (level, model, group) => {
      const parts = group.map(colony => kitGeometry(meshes[`${kit.models[model].name}_${level}`], local.multiplyMatrices(toLocal, colony.matrix)))
      const geometry = mergeGeometries(parts)
      parts.forEach(part => part.dispose())
      geometry.computeBoundingSphere()
      return geometry
    }
    const lod = new THREE.LOD()
    lod.position.copy(centre)
    const lo = models.map(([model, group]) => merge('lo', model, group))
    const far = models.map(([model, group]) => merge('far', model, group))
    const least = models.map(([model, group]) => merge('min', model, group))
    const near = new THREE.Group()
    const mid = new THREE.Group()
    const distant = new THREE.Group()
    const back = new THREE.Group()
    models.forEach(([model], i) => {
      near.add(new THREE.Mesh(lo[i], materials[model]))
      mid.add(new THREE.Mesh(lo[i], materials[model]))
      distant.add(new THREE.Mesh(far[i], materials[model]))
      back.add(new THREE.Mesh(least[i], materials[model]))
    })
    lod.addLevel(near, 0)
    lod.addLevel(mid, kit.hiDetailDistance)
    lod.addLevel(distant, kit.loDetailDistance)
    lod.addLevel(back, kit.farDetailDistance)
    return { key: site, lod, near, lo, models, merge, geometries: [...lo, ...far, ...least] }
  })
}

// Swaps a bommie's close-up level to the _hi meshes while the live camera is within
// kit.hiBuildDistance of it, one kit model a frame (each merge is a few ms), and back to _lo
// (freeing the _hi meshes) beyond kit.hiDropDistance.
function StaghornBommie({ bommie, kit }) {
  const hi = useRef([])
  useFrame(({ camera }) => {
    const built = hi.current
    const distance = camera.position.distanceTo(bommie.lod.position)
    if (distance < kit.hiBuildDistance && built.length < bommie.models.length) {
      const i = built.length
      const [model, group] = bommie.models[i]
      const geometry = bommie.merge('hi', model, group)
      built.push(geometry)
      bommie.near.children[i].geometry = geometry
    } else if (distance > kit.hiDropDistance && built.length) {
      bommie.near.children.forEach((mesh, i) => { mesh.geometry = bommie.lo[i] })
      built.forEach(geometry => geometry.dispose())
      hi.current = []
    }
  })
  useEffect(() => () => hi.current.forEach(geometry => geometry.dispose()), [])
  return <primitive object={bommie.lod} />
}

// Extra rock obstacles (rockObstacles.js) for as long as the component is up.
function useExtraObstacles(obstacles) {
  useLayoutEffect(() => {
    if (!obstacles.length) return undefined
    const owner = setExtraObstacles(obstacles)
    return () => clearExtraObstacles(owner)
  }, [obstacles])
}

// Table corals (landscape.corals): placed against the drawn rocks (coralPlacement.js), then
// merged per kit model and square chunk (culled when off screen), each coral from the _hi,
// _lo or _far mesh by its distance from the resting camera. The plates join the fish's rock
// obstacles. Loads on its own, so the rocks never wait. The staghorn (landscape.staghorn)
// grows on the same bommies once the tables are placed.
function Corals({ landscape, coralRocks, sightRocks, environmentId }) {
  const { kit } = landscape.corals
  const { meshes, materials } = useCoralKit(kit, landscape.caustics)
  const clusters = useMemo(() => coralClusters(landscape, coralRocks, landscape.view), [landscape, coralRocks])
  const corals = useSlicedPlacement(PLACED_CORALS, landscape, () => {
    const measures = kit.models.map(model => measureCoral(meshes[`${model.name}_hi`]))
    return placeCorals(landscape, clusters, measures, landscape.view)
  }, [kit, meshes, clusters], environmentId)

  const { merged, obstacles } = useMemo(() => {
    if (!corals) return { merged: [], obstacles: [] }
    return {
      merged: mergeKitModels(corals, kit, meshes, landscape.view, coral => scratchA.set(coral.plate.x, coral.plate.y, coral.plate.z)),
      obstacles: corals.map(coral => coral.obstacle),
    }
  }, [kit, meshes, landscape, corals])

  useExtraObstacles(obstacles)
  // Reef fish hide under, between and peck at the tables they can reach (reefSites.js).
  const reefCorals = useMemo(() => (corals ? coralReefSurfaces(landscape, corals, meshes, kit) : null), [landscape, corals, meshes, kit])
  useLayoutEffect(() => {
    if (!reefCorals?.geometries.length) return undefined
    const owner = setCoralSurfaces(reefCorals.geometries, reefCorals.metas)
    return () => clearCoralSurfaces(owner)
  }, [reefCorals])
  useEffect(() => () => merged.forEach(part => part.geometry.dispose()), [merged])

  return (
    <>
      {merged.map(part => <mesh key={part.key} geometry={part.geometry} material={materials[part.model]} />)}
      {corals && landscape.seaFans ? (
        <Suspense fallback={null}>
          <SeaFans landscape={landscape} clusters={clusters} tables={corals} sightRocks={sightRocks} coralRocks={coralRocks} environmentId={environmentId} />
        </Suspense>
      ) : corals && landscape.staghorn && (
        <Suspense fallback={null}>
          <Staghorn landscape={landscape} clusters={clusters} tables={corals} environmentId={environmentId} />
        </Suspense>
      )}
    </>
  )
}

// Staghorn (landscape.staghorn): patches of one colour each on the table corals' bommies,
// clear of their plates and of the sea fans when there are any (`fans`, placed first:
// staghornPlacement.js), each bommie's drawn as one LOD (staghornLods). Each colony joins the
// fish's rock obstacles.
function Staghorn({ landscape, clusters, tables, fans = null, environmentId }) {
  const { kit } = landscape.staghorn
  const { meshes, materials } = useCoralKit(kit, landscape.caustics)
  const colonies = useSlicedPlacement(PLACED_STAGHORN, landscape, () => {
    const measures = kit.models.map(model => measureColony(meshes[`${model.name}_far`]))
    return placeStaghorn(landscape, clusters, tables, measures, landscape.view, fans && ((point, extra) => inFan(fans, point, extra)))
  }, [kit, meshes, clusters, tables, fans], environmentId)

  const { bommies, obstacles } = useMemo(() => {
    if (!colonies) return { bommies: [], obstacles: [] }
    return {
      bommies: staghornLods(colonies, kit, meshes, materials),
      obstacles: colonies.map(colony => colony.obstacle),
    }
  }, [kit, meshes, materials, colonies])

  useExtraObstacles(obstacles)
  useEffect(() => () => bommies.forEach(bommie => bommie.geometries.forEach(geometry => geometry.dispose())), [bommies])

  return (
    <>
      {bommies.map(bommie => <StaghornBommie key={bommie.key} bommie={bommie} kit={kit} />)}
      {colonies && <ThicketReefSurfaces landscape={landscape} colonies={colonies} meshes={meshes} kit={kit} environmentId={environmentId} />}
    </>
  )
}

// Reef fish hover over, pick at and hide among the staghorn thickets they can reach
// (reefSites.js), once the patches' surfaces are built (thicketReefSurfaces, kept for the session).
function ThicketReefSurfaces({ landscape, colonies, meshes, kit, environmentId }) {
  const surfaces = useSlicedPlacement(THICKET_REEF_SURFACES, landscape, () => thicketReefSurfaces(landscape, colonies, meshes, kit), [colonies, meshes, kit], environmentId)
  useLayoutEffect(() => {
    if (!surfaces?.geometries.length) return undefined
    const owner = setCoralSurfaces(surfaces.geometries, surfaces.metas)
    return () => clearCoralSurfaces(owner)
  }, [surfaces])
  return null
}

// A sea fan kit (landscape.seaFans.kit, built by scripts/build-sea-fan-kit.py): each fan (fan0,
// fan1, ...) in model metres with its holdfast at the origin and its lattice in the XY plane, as
// its parts (one per material: the branches, the lattice cut out by its texture's alpha) and one
// shared list of materials. The GLB's own materials, two-sided, swaying (utils/coralSway.js),
// and a masked one smoothed at its cut edges by alpha to coverage (the canvas is antialiased),
// so thin branches fade instead of flickering when the fan is far off.
function useSeaFanKit(kit, sway, caustics) {
  const gltf = useGLTF(kit.path)
  const { models, materials } = useMemo(() => {
    const sources = []
    const models = []
    gltf.scene.updateMatrixWorld(true)
    const toFan = new THREE.Matrix4()
    gltf.scene.traverse(object => {
      if (!object.isMesh) return
      let fan = object
      while (fan && !/^fan\d+$/.test(fan.name)) fan = fan.parent
      if (!fan) return
      const index = Number(fan.name.slice(3))
      let material = sources.indexOf(object.material)
      if (material < 0) material = sources.push(object.material) - 1
      const source = object.geometry
      const geometry = new THREE.BufferGeometry()
      geometry.setAttribute('position', source.attributes.position.clone())
      if (source.attributes.normal) geometry.setAttribute('normal', source.attributes.normal.clone())
      else geometry.computeVertexNormals()
      // Every part needs the same attributes to merge; an untextured part gets zero UVs.
      geometry.setAttribute('uv', source.attributes.uv?.clone() ?? new THREE.BufferAttribute(new Float32Array(source.attributes.position.count * 2), 2))
      geometry.setIndex(source.index ? source.index.clone() : [...Array(source.attributes.position.count).keys()])
      geometry.applyMatrix4(toFan.copy(fan.matrixWorld).invert().multiply(object.matrixWorld))
      if (!models[index]) models[index] = []
      models[index].push({ geometry, material })
    })
    const materials = sources.map(source => {
      const material = source.clone()
      material.side = THREE.DoubleSide
      material.transparent = false
      material.depthWrite = true
      material.alphaToCoverage = material.alphaTest > 0
      material.roughness = 0.9
      material.metalness = 0
      material.envMapIntensity = 0.35
      applyCoralSway(material, sway, caustics)
      return material
    })
    return { models: models.filter(Boolean), materials }
  }, [gltf, sway, caustics])
  useEffect(() => () => materials.forEach(material => material.dispose()), [materials])
  return { models, materials }
}

// A placed fan's parts, moved into place with its sway baked in.
function placedFanParts(fan, parts, sway) {
  return parts.map(part => {
    const geometry = new THREE.BufferGeometry()
    for (const attribute of ['position', 'normal', 'uv']) geometry.setAttribute(attribute, part.geometry.attributes[attribute].clone())
    geometry.setIndex(part.geometry.index.clone())
    geometry.applyMatrix4(fan.matrix)
    addSwayAttributes(geometry, { origin: fan.base, direction: fan.normal, amplitude: sway.bend * fan.height, reach: fan.reach, phase: fan.phase })
    return { geometry, material: part.material }
  })
}

// The sea fans inside the landscape's reef reach as raycast surfaces (reefSites.js
// setCoralSurfaces), one per fan, so a fan blocks a fish's site rays like rock. No reef mode
// visits the `fan` form yet (docs/reef-behavior.md, Coral forms); fish steer round them.
function fanReefSurfaces(landscape, fans, models) {
  const cached = FAN_REEF_SURFACES.get(fans)
  if (cached) return cached
  const reach = landscape.reefReach
  const geometries = []
  const metas = []
  for (const fan of fans) {
    const { base } = fan
    if (reach && (base.x < reach.xMin || base.x > reach.xMax || base.z < reach.zMin || base.z > reach.zMax
      || base.y < reach.yMin - 4 || base.y > reach.yMax)) continue
    const parts = models[fan.model].map(part => {
      const geometry = new THREE.BufferGeometry()
      geometry.setAttribute('position', part.geometry.attributes.position.clone())
      geometry.setIndex(part.geometry.index.clone())
      return geometry.applyMatrix4(fan.matrix)
    })
    const geometry = parts.length > 1 ? mergeGeometries(parts) : parts[0]
    if (parts.length > 1) parts.forEach(part => part.dispose())
    geometry.computeBoundingBox()
    geometries.push(geometry)
    metas.push({ form: 'fan', centre: base.clone(), top: base.y + fan.height, radius: fan.width / 2, normal: fan.normal.clone() })
  }
  const result = { geometries, metas }
  FAN_REEF_SURFACES.set(fans, result)
  return result
}

// Giant sea fans (landscape.seaFans): on the table corals' bommies and scattered over the
// reef's other rocks, clear of the tables (seaFanPlacement.js), merged per material and square
// chunk, swaying in the surge. Each fan joins the fish's rock obstacles and blocks their site
// rays. The staghorn (landscape.staghorn) is placed after them, clear of them.
function SeaFans({ landscape, clusters, tables, sightRocks, coralRocks, environmentId }) {
  const { kit, sway } = landscape.seaFans
  const { models, materials } = useSeaFanKit(kit, sway, landscape.caustics)
  useSwayClock()
  const fans = useSlicedPlacement(PLACED_SEA_FANS, landscape, () => {
    const measures = models.map(parts => measureFan(parts.map(part => ({ geometry: part.geometry, masked: materials[part.material].alphaTest > 0 }))))
    return placeSeaFans(landscape, clusters, tables, measures, landscape.view, sightRocks, coralRocks)
  }, [models, materials, clusters, tables, sightRocks, coralRocks], environmentId)

  const { merged, obstacles } = useMemo(() => {
    if (!fans) return { merged: [], obstacles: [] }
    const groups = new Map()
    for (const fan of fans) {
      const chunk = `${Math.floor(fan.base.x / kit.chunkWU)}:${Math.floor(fan.base.z / kit.chunkWU)}`
      for (const part of placedFanParts(fan, models[fan.model], sway)) {
        const key = `${part.material}:${chunk}`
        if (!groups.has(key)) groups.set(key, { material: part.material, list: [] })
        groups.get(key).list.push(part.geometry)
      }
    }
    return {
      merged: [...groups].map(([key, { material, list }]) => {
        const geometry = mergeGeometries(list)
        list.forEach(part => part.dispose())
        // Room for the swing, so a fan at a chunk's edge is not culled mid-sway.
        geometry.computeBoundingSphere()
        geometry.boundingSphere.radius += sway.bend * landscape.seaFans.height[1] * 2
        return { key, material, geometry }
      }),
      obstacles: fans.map(fan => fan.obstacle),
    }
  }, [kit, models, sway, landscape, fans])

  useExtraObstacles(obstacles)
  const reefFans = useMemo(() => (fans ? fanReefSurfaces(landscape, fans, models) : null), [landscape, fans, models])
  useLayoutEffect(() => {
    if (!reefFans?.geometries.length) return undefined
    const owner = setCoralSurfaces(reefFans.geometries, reefFans.metas)
    return () => clearCoralSurfaces(owner)
  }, [reefFans])
  useEffect(() => () => merged.forEach(part => part.geometry.dispose()), [merged])

  return (
    <>
      {merged.map(part => <mesh key={part.key} geometry={part.geometry} material={materials[part.material]} />)}
      {fans && landscape.staghorn && (
        <Suspense fallback={null}>
          <Staghorn landscape={landscape} clusters={clusters} tables={tables} fans={fans} environmentId={environmentId} />
        </Suspense>
      )}
    </>
  )
}

// Built rocks per landscape, kept for the session. React renders a tank several times before
// it commits: on a tank switch, while the new tank's models are still loading, each one that
// suspends makes React throw the uncommitted render away and render it again once it arrives.
// The Reefs took five passes (2026-10-19, production build) and each rebuilt every rock, 200 to
// 400 ms on the main thread, about 1.3 s wasted per visit. The layout is deterministic, so it is
// built once per landscape and loaded kit and reused by every later pass and every return visit.
const BUILT_LANDSCAPES = new WeakMap()

function builtLandscape(landscape, gltf, rocks) {
  const built = BUILT_LANDSCAPES.get(landscape)
  if (built?.gltf === gltf) return built.result
  const result = makeLandscapeChunks(landscape, rocks)
  BUILT_LANDSCAPES.set(landscape, { gltf, result })
  return result
}

export default function Landscape({ landscape, environmentId }) {
  const { kit } = landscape
  const gltf = useGLTF(kit.path)
  const textures = useTexture(kit.textures)
  const rocks = useMemo(() => {
    const byName = {}
    gltf.scene.traverse(object => { if (object.isMesh) byName[object.name] = object.geometry })
    return byName
  }, [gltf])

  const material = useMemo(() => {
    for (const texture of Object.values(textures)) {
      texture.wrapS = THREE.RepeatWrapping
      texture.wrapT = THREE.RepeatWrapping
      texture.anisotropy = 4
      texture.needsUpdate = true
    }
    textures.color.colorSpace = THREE.SRGBColorSpace
    // Roughness is read from the green channel; the greyscale map has it in all three.
    const rockMaterial = new THREE.MeshStandardMaterial({
      map: textures.color, normalMap: textures.normal, roughnessMap: textures.roughness,
      roughness: 1, metalness: 0, envMapIntensity: 0.35,
    })
    applyRockShade(rockMaterial, landscape.rockShade, landscape.caustics)
    return rockMaterial
  }, [textures, landscape.rockShade, landscape.caustics])
  const { chunks, reefSurfaces, coralRocks } = useMemo(() => builtLandscape(landscape, gltf, rocks), [landscape, gltf, rocks])
  // Every drawn rock, for the sea fans' sight test (seaFanPlacement.js).
  const sightRocks = useMemo(() => chunks.map(chunk => chunk.geometry), [chunks])

  // Built imperatively, so R3F won't dispose them; free their GPU copies when the tank
  // unmounts. The chunks stay cached (builtLandscape): three uploads them again on a return visit.
  useEffect(() => () => material.dispose(), [material])
  useEffect(() => () => chunks.forEach(chunk => chunk.geometry.dispose()), [chunks])
  // Reef fish raycast the rocks they can reach (reefSites.js) for as long as the tank is up.
  useLayoutEffect(() => {
    const owner = setReefSurfaces(reefSurfaces, landscape.view)
    return () => clearReefSurfaces(owner)
  }, [reefSurfaces, landscape.view])
  // The reef surfaces and the rocks corals grow on stay cached with the chunks; they are only
  // raycast, never drawn, so there is nothing on the GPU to free.

  return (
    <group>
      {chunks.map(chunk => <mesh key={chunk.key} geometry={chunk.geometry} material={material} />)}
      {landscape.corals && (
        <Suspense fallback={null}>
          <Corals landscape={landscape} coralRocks={coralRocks} sightRocks={sightRocks} environmentId={environmentId} />
        </Suspense>
      )}
    </group>
  )
}

// Only the active landscape and one recent landscape retain derived placements. Source
// eviction is separate: matrices/BVH/merged rocks are not GLTF-loader cache resources.
// Normal retirement follows the replacement scene's first frame. A failed target
// retires only after its Biome mount lease has ended during rollback.
const unsubscribeRetirement = environmentLoader.onRetire((id, current) => {
  const landscape = landscapeForTank(TANKS.find(tank => tank.id === id))
  if (!landscape) return
  const protectedIds = [current.activeId, ...(current.phase === 'error' ? [] : [current.requestedId])]
  if (protectedIds.some(active => landscapeForTank(TANKS.find(tank => tank.id === active)) === landscape)) return
  const disposeGeometry = geometry => { geometry.disposeBoundsTree?.(); geometry.dispose() }
  const built = BUILT_LANDSCAPES.get(landscape)
  for (const chunk of built?.result.chunks ?? []) disposeGeometry(chunk.geometry)
  const placed = new Set([...(built?.result.reefSurfaces ?? []), ...[...(built?.result.coralRocks.values() ?? [])].flat()])
  for (const geometry of placed) disposeGeometry(geometry)
  const corals = PLACED_CORALS.get(landscape)
  const surfaces = corals && CORAL_REEF_SURFACES.get(corals)
  for (const geometry of surfaces?.geometries ?? []) disposeGeometry(geometry)
  if (corals) CORAL_REEF_SURFACES.delete(corals)
  for (const geometry of THICKET_REEF_SURFACES.get(landscape)?.geometries ?? []) disposeGeometry(geometry)
  const fans = PLACED_SEA_FANS.get(landscape)
  for (const geometry of (fans && FAN_REEF_SURFACES.get(fans)?.geometries) ?? []) disposeGeometry(geometry)
  if (fans) FAN_REEF_SURFACES.delete(fans)
  PLACED_SEA_FANS.delete(landscape)
  BUILT_LANDSCAPES.delete(landscape)
  PLACED_CORALS.delete(landscape)
  PLACED_STAGHORN.delete(landscape)
  THICKET_REEF_SURFACES.delete(landscape)
})
if (import.meta.hot) import.meta.hot.dispose(unsubscribeRetirement)
