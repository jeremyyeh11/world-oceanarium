import assert from 'node:assert/strict'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { createServer } from 'vite'

// Cauliflower corals against real triangles: colonies stand only on a bommie's top (never on a low
// shelf or the sand), their stalk buried to the neck, held up all round, never inside a table's
// plate, a brain coral or each other, and inBush keeps later corals off them. No dependency scan,
// as in seaFanPlacement.test.mjs.
const server = await createServer({ server: { middlewareMode: true }, appType: 'custom', optimizeDeps: { noDiscovery: true } })
try {
  const { placeCauliflowerCorals, measureBush, inBush } = await server.ssrLoadModule('/src/components/cauliflowerCoralPlacement.js')
  const { inMound } = await server.ssrLoadModule('/src/components/brainCoralPlacement.js')
  // A bush 1 m across: a half dome on a 0.3 m stalk, its foot at the origin.
  const head = new THREE.SphereGeometry(0.5, 32, 12, 0, Math.PI * 2, 0, Math.PI / 2).translate(0, 0.3, 0)
  const stalk = new THREE.CylinderGeometry(0.08, 0.08, 0.3, 12).translate(0, 0.15, 0)
  const bush = mergeGeometries([head.toNonIndexed(), stalk.toNonIndexed()])
  const shape = measureBush(bush)
  assert.ok(Math.abs(shape.height - 0.8) < 1e-6 && Math.abs(shape.radius - 0.5) < 1e-3, 'measures the bush')
  assert.ok(Math.abs(shape.ground - 0.3 * 0.85) < 0.01, `finds the neck: ground line at ${shape.ground.toFixed(3)}`)
  // A bommie 10 WU square and 4 tall on a low shelf 1 WU tall, on sand at y 0; a table plate over
  // the bommie's middle and a brain coral on its top.
  const rock = mergeGeometries([new THREE.BoxGeometry(10, 4, 10).translate(0, 2, 0), new THREE.BoxGeometry(18, 1, 18).translate(0, 0.5, 0)])
  const plate = { x: 0, y: 4.9, z: 0, radius: 1.5, thickness: 0.3 }
  const table = { plate, matrix: new THREE.Matrix4().makeTranslation(0, 4, 0) }
  const mound = { base: new THREE.Vector3(-3, 4, -3), height: 1, reach: 1.2 }
  const landscape = {
    floorY: 0,
    maxTop: 30,
    cauliflowerCorals: { seed: 9419, perCluster: [12, 12], diameter: [0.8, 1.8] },
  }
  const generator = placeCauliflowerCorals(landscape, [{ geometries: [rock], seed: 1 }], [table], [shape], null, point => inMound([mound], point))
  let step
  do { step = generator.next() } while (!step.done)
  const bushes = step.value
  assert.ok(bushes.length >= 6, `places colonies on the bommie: ${bushes.length}`)
  for (const [i, colony] of bushes.entries()) {
    assert.ok(Math.abs(colony.base.y - 4) < 1e-6, `colony ${i} stands on the top, not at y ${colony.base.y}`)
    assert.ok(Math.max(Math.abs(colony.base.x), Math.abs(colony.base.z)) < 5, 'held up on the top')
    // Its stalk is in the rock: the model's origin sits below the ledge by the scaled ground line.
    const origin = new THREE.Vector3().setFromMatrixPosition(colony.matrix)
    assert.ok(origin.y < 4 - 0.01, 'the stalk is sunk into the rock')
    for (const sample of shape.samples) {
      const point = sample.clone().applyMatrix4(colony.matrix)
      assert.ok(point.y > 4 - 0.05, 'the head stays above the rock')
      const underPlate = Math.hypot(point.x, point.z) < plate.radius + 0.2
      assert.ok(!(underPlate && Math.abs(point.y - plate.y) < plate.thickness / 2 + 0.2), 'clear of the plate')
      assert.ok(!inMound([mound], point), 'clear of the brain coral')
      assert.ok(!inBush(bushes.slice(0, i), point), 'clear of the colonies placed before it')
    }
    const up = new THREE.Vector3(0, 1, 0).transformDirection(colony.matrix)
    assert.ok(up.y > Math.cos(0.31), 'a colony leans at most 17°')
  }
  assert.ok(inBush(bushes, bushes[0].centre), 'a colony holds its own middle')
  assert.ok(!inBush(bushes, new THREE.Vector3(100, 0, 100)), 'and nothing far off')
  console.log(`cauliflower coral placement: ${bushes.length} colonies, all on the bommie's top, passed`)
} finally { await server.close() }
