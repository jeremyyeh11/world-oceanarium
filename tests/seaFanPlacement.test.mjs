import assert from 'node:assert/strict'
import * as THREE from 'three'
import { createServer } from 'vite'

// Exercise placement against actual triangles: steep walls must never accept a yaw fallback
// that puts the broad face against its host, including currents aimed directly into the rock.
// No dependency scan: the test only SSR-loads a module, and closing the server while the
// browser-deps scan of index.html was still running printed a stack trace.
const server = await createServer({ server: { middlewareMode: true }, appType: 'custom', optimizeDeps: { noDiscovery: true } })
try {
  const { placeSeaFans, measureFan } = await server.ssrLoadModule('/src/components/seaFanPlacement.js')
  const lattice = new THREE.PlaneGeometry(0.6, 1, 8, 8).translate(0, 0.5, 0)
  const vertices = lattice.attributes.position
  for (let i = 0; i < vertices.count; i++) vertices.setX(i, vertices.getX(i) * Math.min(1, vertices.getY(i) / 0.3))
  const shape = measureFan([{ geometry: lattice, masked: true }])
  let checkedWalls = 0
  let checkedTops = 0
  for (const dimensions of [[8, 8, 8], [12, 1, 12]]) for (const current of [[0, 1], [1, 0], [0.16, 1]]) {
    const rock = new THREE.BoxGeometry(...dimensions).translate(0, -8, 0)
    const landscape = {
      floorY: -100,
      maxTop: 10,
      seaFans: { seed: 8411, perCluster: [12, 12], height: [0.8, 1.2], current, facingJitter: 0.35, sway: { bend: 0.05 } },
    }
    const generator = placeSeaFans(landscape, [{ geometries: [rock], seed: 1 }], [], [shape], null, [rock])
    let step
    do { step = generator.next() } while (!step.done)
    assert.ok(step.value.length >= 8, 'placement still finds fans on exposed rock')
    for (const fan of step.value) {
      const facingWall = Math.abs(fan.normal.dot(fan.surfaceNormal))
      assert.ok(facingWall < 0.5, 'broad faces stay clear of their attachment surface')
      const growth = new THREE.Vector3(0, 1, 0).transformDirection(fan.matrix)
      assert.ok(growth.dot(fan.surfaceNormal) > 0, 'the trunk grows outward from its host')
      assert.ok(Math.abs(growth.dot(fan.normal)) < 1e-6, 'the fan basis remains orthogonal')
      if (fan.surfaceNormal.y < Math.SQRT1_2) {
        checkedWalls++
        assert.ok(facingWall < 1e-6, 'a wall-mounted fan is perpendicular to the wall')
        assert.ok(Math.abs(fan.normal.y) < 1e-6, 'local flow runs horizontally along the wall')
      } else checkedTops++
    }
  }
  assert.ok(checkedWalls > 0 && checkedTops > 0, `exercise walls and tops: ${checkedWalls}, ${checkedTops}`)
  console.log(`sea fan placement: ${checkedWalls} wall fans and ${checkedTops} top fans passed`)
} finally { await server.close() }
