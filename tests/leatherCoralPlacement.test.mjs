import assert from 'node:assert/strict'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { createServer } from 'vite'

// Leather corals against real triangles: toadstools stand only on a bommie's low ledges or the sand
// at its foot (never its top), one colour a bommie, upright, held up all round, clear of a table's
// plate, a cauliflower coral and each other, and inToadstool keeps later corals out from under their
// caps. No dependency scan, as in seaFanPlacement.test.mjs.
const server = await createServer({ server: { middlewareMode: true }, appType: 'custom', optimizeDeps: { noDiscovery: true } })
try {
  const { placeLeatherCorals, measureToadstool, inToadstool } = await server.ssrLoadModule('/src/components/leatherCoralPlacement.js')
  const { inBush } = await server.ssrLoadModule('/src/components/cauliflowerCoralPlacement.js')
  // A toadstool 0.6 m tall: a 0.3 m wide cap on a 0.1 m stalk, its foot at the origin.
  const cap = new THREE.CylinderGeometry(0.3, 0.25, 0.1, 16).translate(0, 0.55, 0)
  const stalk = new THREE.CylinderGeometry(0.06, 0.1, 0.5, 12).translate(0, 0.25, 0)
  const shape = measureToadstool([cap.toNonIndexed(), stalk.toNonIndexed()])
  assert.ok(Math.abs(shape.height - 0.6) < 1e-6 && Math.abs(shape.reach - 0.3) < 1e-3, 'measures the toadstool')
  assert.ok(Math.abs(shape.footRadius - 0.1) < 0.01, `finds the stalk's foot: ${shape.footRadius.toFixed(3)}`)
  // A bommie 10 WU square and 6 tall on a low shelf 1 WU tall, on sand at y 0; a table plate over
  // the bommie's middle and a cauliflower coral on the shelf.
  const rock = mergeGeometries([new THREE.BoxGeometry(10, 6, 10).translate(0, 3, 0), new THREE.BoxGeometry(16, 1, 16).translate(0, 0.5, 0)])
  const plate = { x: 0, y: 6.9, z: 0, radius: 1.5, thickness: 0.3 }
  const table = { plate, matrix: new THREE.Matrix4().makeTranslation(0, 6, 0) }
  const bush = { base: new THREE.Vector3(6, 1, 0), height: 1, reach: 0.8, ground: 0 }
  const kit = { models: [{ name: 'a', colours: ['grey'] }, { name: 'b', colours: ['peach'] }, { name: 'c', colours: ['grey', 'peach'] }] }
  const landscape = {
    floorY: 0,
    maxTop: 30,
    leatherCorals: {
      kit, seed: 9551, perCluster: [6, 6], patchSpread: Math.PI, lowShare: 0.5, footShare: 0.4,
      height: [1.4, 3], current: [0.16, 1], sway: { period: 7, bend: 0.03, flutter: 0.1 },
    },
  }
  const generator = placeLeatherCorals(landscape, [{ geometries: [rock], seed: 1 }], [table], [shape, shape, shape], null, point => inBush([bush], point))
  let step
  do { step = generator.next() } while (!step.done)
  const toadstools = step.value
  assert.ok(toadstools.length >= 3, `places toadstools round the bommie: ${toadstools.length}`)
  for (const [i, colony] of toadstools.entries()) {
    const ledge = colony.base.y + colony.height * 0.04
    assert.ok(ledge < 6 * 0.5 + 0.01, `colony ${i} stands low, not at y ${ledge.toFixed(2)}`)
    assert.ok(Math.abs(ledge - 1) < 1e-6 || Math.abs(ledge) < 0.2, `colony ${i} is on the shelf or the sand, at y ${ledge.toFixed(2)}`)
    for (const sample of shape.samples) {
      const point = sample.clone().applyMatrix4(colony.matrix)
      assert.ok(Math.max(Math.abs(point.x), Math.abs(point.z)) > 5 || point.y > 6, 'out of the bommie')
      assert.ok(!inBush([bush], point), 'clear of the cauliflower coral')
      assert.ok(!inToadstool(toadstools.slice(0, i), point), 'clear of the toadstools placed before it')
    }
    const up = new THREE.Vector3(0, 1, 0).transformDirection(colony.matrix)
    assert.ok(up.y > Math.cos(0.16), 'a toadstool leans at most 9°')
    assert.ok(colony.swing > 0 && Number.isFinite(colony.phase), 'it sways')
  }
  const shared = ['grey', 'peach'].filter(colour => toadstools.every(colony => kit.models[colony.model].colours.includes(colour)))
  assert.ok(shared.length >= 1, 'one colour on the bommie')
  assert.ok(inToadstool(toadstools, toadstools[0].centre), 'a colony holds the water under its cap')
  assert.ok(!inToadstool(toadstools, new THREE.Vector3(100, 0, 100)), 'and nothing far off')
  console.log(`leather coral placement: ${toadstools.length} toadstools, low and of one colour, passed`)
} finally {
  await server.close()
}
