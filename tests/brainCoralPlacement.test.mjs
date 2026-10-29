import assert from 'node:assert/strict'
import * as THREE from 'three'
import { createServer } from 'vite'

// Brain corals against real triangles: colonies sit on a rock's top or the sand at its foot, held
// up all round, never inside a table's plate or each other, and inMound keeps later corals off
// them. Then a reef fish's site search finds a mound's side and keeps to the mound it aimed at.
// No dependency scan, as in seaFanPlacement.test.mjs.
const server = await createServer({ server: { middlewareMode: true }, appType: 'custom', optimizeDeps: { noDiscovery: true } })
try {
  const { placeBrainCorals, measureMound, inMound } = await server.ssrLoadModule('/src/components/brainCoralPlacement.js')
  const { findReefSite, setReefSurfaces, clearReefSurfaces, setCoralSurfaces, clearCoralSurfaces } = await server.ssrLoadModule('/src/components/reefSites.js')
  // A dome 1 m across and 0.5 m tall, base at the origin.
  const dome = new THREE.SphereGeometry(0.5, 32, 12, 0, Math.PI * 2, 0, Math.PI / 2)
  const shape = measureMound(dome)
  assert.ok(Math.abs(shape.height - 0.5) < 1e-6 && Math.abs(shape.radius - 0.5) < 1e-3, 'measures the dome')
  // A flat-topped rock 10 WU square and 4 tall on sand at y 0, a table plate over its middle.
  const rock = new THREE.BoxGeometry(10, 4, 10).translate(0, 2, 0)
  const plate = { x: 0, y: 4.9, z: 0, radius: 2, thickness: 0.3 }
  const table = { plate, matrix: new THREE.Matrix4().makeTranslation(0, 4, 0) }
  const landscape = {
    floorY: 0,
    maxTop: 30,
    brainCorals: { seed: 9103, perCluster: [16, 16], footShare: 0.5, diameter: [2, 3.2], ledgeScale: 0.7 },
  }
  const generator = placeBrainCorals(landscape, [{ geometries: [rock], seed: 1 }], [table], [shape], null)
  let step
  do { step = generator.next() } while (!step.done)
  const mounds = step.value
  assert.ok(mounds.length >= 5, `places colonies on the rock and at its foot: ${mounds.length}`)
  let onTop = 0
  let onSand = 0
  for (const [i, mound] of mounds.entries()) {
    const sunk = mound.height * 0.06
    if (Math.abs(mound.base.y - (4 - sunk)) < 0.01) onTop++
    else if (Math.abs(mound.base.y + sunk) < 0.01) onSand++
    else assert.fail(`colony ${i} sits on rock or sand, not at y ${mound.base.y}`)
    // The rock's top ends at |x|, |z| = 5: a colony there is held up under most of its rim.
    if (onTop && Math.abs(mound.base.y - (4 - sunk)) < 0.01) {
      assert.ok(Math.max(Math.abs(mound.base.x), Math.abs(mound.base.z)) < 5, 'a top colony stands on the top')
    }
    // Out of the table's plate.
    for (const sample of shape.samples) {
      const point = sample.clone().applyMatrix4(mound.matrix)
      const underPlate = Math.hypot(point.x, point.z) < plate.radius + 0.2
      assert.ok(!(underPlate && Math.abs(point.y - plate.y) < plate.thickness / 2 + 0.2), 'clear of the plate')
      assert.ok(!inMound(mounds.filter(other => other !== mound), point), 'clear of the other colonies')
    }
  }
  assert.ok(onTop > 0 && onSand > 0, `on the top (${onTop}) and the sand (${onSand})`)
  assert.ok(inMound(mounds, mounds[0].centre), 'a colony holds its own middle')
  assert.ok(!inMound(mounds, new THREE.Vector3(100, 0, 100)), 'and nothing far off')

  // The fish's side: a dome surface on a slab of rock.
  const slab = new THREE.BoxGeometry(40, 1, 40).translate(0, -0.5, 0)
  const surface = new THREE.SphereGeometry(2, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2)
  const rockOwner = setReefSurfaces([slab])
  const moundOwner = setCoralSurfaces([surface], [{ form: 'mound', centre: new THREE.Vector3(), top: 2, radius: 2 }])
  try {
    const out = { point: new THREE.Vector3(), normal: new THREE.Vector3(), rest: new THREE.Vector3(), entry: new THREE.Vector3(), outward: new THREE.Vector3(), faceIn: new THREE.Vector3(), enclosure: 0 }
    let found = 0
    let rand = 1
    for (let k = 0; k < 20; k++) {
      const site = findReefSite(out, {
        force: true,
        region: { xMin: -20, xMax: 20, yMin: 0, yMax: 10, zMin: -20, zMax: 20 },
        contains: point => point.y > 0 && point.y < 10,
        near: null,
        radius: 50,
        from: new THREE.Vector3(8, 1.5, 0),
        rand: () => { rand = (rand * 16807) % 2147483647; return rand / 2147483647 },
        standoff: 0.5,
        clearance: 0.3,
        entryDistance: 1.5,
        normalY: [-0.25, 0.55],
        kind: 'mound',
        aim: 'surface',
      })
      if (!site) continue
      found++
      assert.ok(Math.abs(out.point.length() - 2) < 0.1, 'the site is on the dome')
      assert.ok(out.rest.distanceTo(out.point) > 0.45, 'the fish rests off the surface')
    }
    assert.ok(found >= 10, `site searches at a mound find its side: ${found} of 20`)
  } finally {
    clearCoralSurfaces(moundOwner)
    clearReefSurfaces(rockOwner)
  }
  console.log(`brain coral placement: ${mounds.length} colonies (${onTop} on the rock, ${onSand} on the sand) and mound sites passed`)
} finally { await server.close() }
