import assert from 'node:assert/strict'
import { Group, Line3, Mesh, MeshStandardMaterial, PlaneGeometry, Vector3 } from 'three'
import { advanceKelp, makeKelp } from '../src/components/kelpMotion.js'
import { makeKelpBatch, makeKelpTemplate } from '../src/components/kelpSkin.js'
import { seededRandom } from '../src/data/landscapes.js'
import { SURFACE_PLANE_Y } from '../src/utils/waterSurfaceGeometry.js'

const root = new Vector3(0, -47, 0)
const plant = makeKelp(root, 44, seededRandom(1))
const control = makeKelp(root, 44, seededRandom(1))
const dt = 1 / 60
const advanceBoth = (from, to, colliders = []) => {
  for (let step = from; step < to; step += 1) {
    advanceKelp(plant, step * dt, dt, colliders)
    advanceKelp(control, step * dt, dt, [])
  }
}
const straightStipe = new Line3()
const nearest = new Vector3()
let peakBow = 0
for (let tick = 1; tick < 360; tick += 30) {
  advanceBoth(tick, Math.min(tick + 30, 360))
  straightStipe.set(root, plant.stalk.at(-1))
  for (const point of plant.stalk) {
    peakBow = Math.max(peakBow, point.distanceTo(straightStipe.closestPointToPoint(point, true, nearest)))
  }
}
assert.ok(plant.stalk[0].equals(root))
assert.equal(plant.stalk.length, 17)
assert.ok(peakBow > 1.5, 'the stipe bows away from its root-to-tip axis during the swell')
for (const { a, b, length } of plant.links) {
  assert.ok(Math.abs(a.position.distanceTo(b.position) - length) < length * 0.03)
}

const axis = new Vector3(0, 0, 1)
const joint = plant.stalk.indexOf(plant.blades[5].points[0])
const center = plant.stalk[joint].clone().add(new Vector3(0.3, 0, 0))
const capsule = { position: center.clone(), axis, radius: 1.2, halfLength: 1 }
advanceBoth(360, 402, [capsule])
assert.ok(plant.stalk[0].equals(root), 'contact leaves the holdfast fixed')
assert.ok(capsule.position.equals(center), 'contact is one-way')
assert.ok(plant.stalk[joint].distanceTo(control.stalk[joint]) > 0.5, 'contact bends the stipe')
assert.ok(plant.blades[5].points[2].distanceTo(control.blades[5].points[2]) > 0.1, 'contact travels into the blade')
for (const { position } of plant.points.slice(1)) {
  const offset = position.clone().sub(center)
  offset.z -= Math.max(-capsule.halfLength, Math.min(capsule.halfLength, offset.z))
  assert.ok(offset.length() >= capsule.radius - 1e-6)
}
advanceBoth(402, 900)
assert.ok(plant.stalk[joint].distanceTo(control.stalk[joint]) < 0.1, 'kelp settles into the current after contact')

// Changing simulation rate near the canopy keeps a finite pose beneath the water.
const tall = makeKelp(root, SURFACE_PLANE_Y - root.y, seededRandom(2))
const diver = { position: tall.stalk[5].clone(), radius: 1.2, halfLength: 0 }
advanceKelp(tall, 0, dt, [diver])
assert.ok(tall.stalk[5].distanceTo(diver.position) >= diver.radius - 1e-6)
for (let step = 1; step <= 120; step += 1) advanceKelp(tall, step / 15, 1 / 15, [])
assert.ok(tall.points.every(({ position }) => Number.isFinite(position.lengthSq()) && position.y <= SURFACE_PLANE_Y))

// An authored segment is repeated with coincident end rings. Its blade slot can still
// use the generated cards. Neither mesh owns the GLB source geometry or material.
const scene = new Group()
const segment = new PlaneGeometry(1, 1).translate(0, 0.5, 0)
const material = new MeshStandardMaterial()
scene.add(new Mesh(segment, material))
const stem = makeKelpTemplate({ scene }, true)
const blade = makeKelpTemplate(null, false)
const stipes = makeKelpBatch(stem, [plant])
const blades = makeKelpBatch(blade, [plant])
const vertices = stipes.geometry.attributes.position
assert.equal(vertices.count, segment.attributes.position.count * (plant.stalk.length - 1))
assert.ok(new Vector3().fromBufferAttribute(vertices, 0).equals(new Vector3().fromBufferAttribute(vertices, 6)))
assert.equal(blades.geometry.attributes.position.count, blade.count * plant.blades.length)
assert.notEqual(stem.material, material)

console.log('kelp motion tests passed')
