import { useEffect, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { seededRandom, sandHeight } from '../data/landscapes'
import { SURFACE_PLANE_Y } from '../utils/waterSurfaceGeometry'
import { useEnvironmentGLTF } from '../hooks/useEnvironmentLoading'
import { forEachFish } from './fishSwim'
import { advanceKelp, makeKelp } from './kelpMotion'
import { makeKelpBatch, makeKelpTemplate } from './kelpSkin'

function plantBeds(landscape, rocks, templates) {
  const { beds, seed, height } = landscape.kelp
  const random = seededRandom(seed)
  const ray = new THREE.Raycaster(new THREE.Vector3(), new THREE.Vector3(0, -1, 0))
  const probeMaterial = new THREE.MeshBasicMaterial()
  const rockMeshes = rocks.map(geometry => new THREE.Mesh(geometry, probeMaterial))
  const hits = []
  const bedsWithPlants = []
  for (const [x, z, spread, count] of beds) {
    const plants = []
    for (let i = 0; i < count * 5 && plants.length < count; i += 1) {
      const angle = random() * Math.PI * 2
      const distance = Math.sqrt(random()) * spread
      const px = x + Math.cos(angle) * distance
      const pz = z + Math.sin(angle) * distance
      ray.ray.origin.set(px, SURFACE_PLANE_Y, pz)
      hits.length = 0
      ray.intersectObjects(rockMeshes, false, hits)
      const hit = hits[0]
      if (!hit || hit.point.y < sandHeight(landscape, px, pz) + 0.25) continue
      if (plants.some(plant => plant.root.distanceToSquared(hit.point) < 0.36)) continue
      const root = hit.point.clone()
      root.y -= 0.08
      const length = (SURFACE_PLANE_Y - 0.8 - root.y) * THREE.MathUtils.lerp(height[0], height[1], random())
      plants.push(makeKelp(root, length, random))
    }
    if (!plants.length) continue
    const meshes = templates.map(template => makeKelpBatch(template, plants))
    const bounds = new THREE.Box3()
    const sphere = new THREE.Sphere()
    const updateDrawBounds = () => {
      bounds.makeEmpty()
      for (const plant of plants) bounds.union(plant.bounds)
      bounds.getBoundingSphere(sphere)
      for (const mesh of meshes) mesh.geometry.boundingSphere = sphere
    }
    updateDrawBounds()
    bedsWithPlants.push({ plants, meshes, updateDrawBounds })
  }
  probeMaterial.dispose()
  return bedsWithPlants
}

export default function KelpForest({ landscape, rocks, diverActive }) {
  const stem = useEnvironmentGLTF(landscape.kelp.stemModel)
  const blade = useEnvironmentGLTF(landscape.kelp.bladeModel)
  const field = useMemo(() => {
    const templates = [makeKelpTemplate(stem, true), makeKelpTemplate(blade, false)]
    const beds = plantBeds(landscape, rocks, templates)
    const colliders = []
    const fishShapes = []
    const frustum = new THREE.Frustum()
    const projection = new THREE.Matrix4()
    const diver = { position: new THREE.Vector3(), radius: 1.2, halfLength: 0 }
    let time = 0
    let fishCount = 0
    const addFish = (entry) => {
      if (entry.opacity !== undefined && entry.opacity < 0.2) return
      const shape = fishShapes[fishCount] ?? (fishShapes[fishCount] = {})
      fishCount += 1
      shape.position = entry.position
      shape.axis = entry.forward
      shape.radius = Math.max(0.18, entry.bodyLength * 0.17)
      shape.halfLength = entry.bodyLength * 0.33
      colliders.push(shape)
    }
    const update = (camera, delta, diverActive) => {
      const frame = Math.min(delta, 1 / 15)
      time += frame
      colliders.length = 0
      fishCount = 0
      forEachFish(addFish)
      if (diverActive) {
        diver.position.copy(camera.position)
        colliders.push(diver)
      }
      camera.updateMatrixWorld()
      frustum.setFromProjectionMatrix(projection.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse))
      for (const { plants, meshes, updateDrawBounds } of beds) {
        let changed = false
        for (const plant of plants) {
          const distance = plant.bounds.distanceToPoint(camera.position)
          // Simulate contact around the diver even at the side of the screen. Distant
          // visible plants update at 15 Hz, and far or offscreen plants keep their pose.
          if (distance > 105 || (distance > 9 && !frustum.intersectsBox(plant.bounds))) {
            plant.elapsed = 0
            continue
          }
          const step = distance < 29 ? 1 / 60 : distance < 60 ? 1 / 30 : 1 / 15
          plant.elapsed += frame
          if (plant.elapsed + 1e-8 < step) continue
          do {
            plant.elapsed -= step
            advanceKelp(plant, time - plant.elapsed, step, colliders)
          } while (plant.elapsed + 1e-8 >= step)
          for (const write of plant.skin) write()
          changed = true
        }
        if (!changed) continue
        for (const mesh of meshes) mesh.geometry.attributes.position.needsUpdate = true
        updateDrawBounds()
      }
    }
    return { beds, templates, update }
  }, [landscape, rocks, stem, blade])
  useFrame(({ camera }, delta) => field.update(camera, delta, diverActive))
  useEffect(() => () => {
    for (const { meshes } of field.beds) for (const mesh of meshes) mesh.geometry.dispose()
    for (const { material } of field.templates) material.dispose()
  }, [field])

  return <group name="kelp-forest">{field.beds.flatMap(({ meshes }, i) => meshes.map(mesh => (
    <primitive key={`${i}-${mesh.name}`} object={mesh} />
  )))}</group>
}
