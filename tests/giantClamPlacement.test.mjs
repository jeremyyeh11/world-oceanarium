import assert from 'node:assert/strict'
import * as THREE from 'three'
import { createServer } from 'vite'

// Giant clams against real triangles: one clam by each bommie in front of zMin (none by one behind
// it), on the sand off the bommie's foot, never in it, level, broadside to the camera, at least
// `spacing` apart, the first in the phone's view; inClam keeps later corals out of them. No
// dependency scan, as in seaFanPlacement.test.mjs.
const server = await createServer({ server: { middlewareMode: true }, appType: 'custom', optimizeDeps: { noDiscovery: true } })
try {
  const { placeGiantClams, measureClam, inClam } = await server.ssrLoadModule('/src/components/giantClamPlacement.js')
  // A clam 1 m long, 0.5 m wide and 0.55 m tall: a squashed half sphere for the shell and a low
  // dome for the mantle in its gape, its rest point at the origin, the length along X.
  const shell = new THREE.SphereGeometry(0.5, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2).rotateX(Math.PI).scale(1, 0.9, 0.5).translate(0, 0.45, 0)
  const mantle = new THREE.SphereGeometry(0.45, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 0.2, 0.45).translate(0, 0.45, 0)
  const shape = measureClam([shell, mantle])
  assert.ok(Math.abs(shape.length - 1) < 0.01 && Math.abs(shape.width - 0.5) < 0.01, `measures the clam: ${shape.length.toFixed(2)} x ${shape.width.toFixed(2)}`)
  assert.ok(Math.abs(shape.height - 0.54) < 0.01, `finds its height: ${shape.height.toFixed(2)}`)
  // Three bommies 8 WU square and 6 tall on flat sand at y 0: one on the camera's line of sight,
  // one off to the side, and one behind zMin.
  const bommie = (x, z) => new THREE.BoxGeometry(8, 6, 8).translate(x, 3, z)
  const clusters = [{ geometries: [bommie(0, -10)], seed: 1 }, { geometries: [bommie(30, -12)], seed: 2 }, { geometries: [bommie(0, -45)], seed: 3 }]
  const plate = { x: 0, y: 6.9, z: -10, radius: 1.5, thickness: 0.3 }
  const table = { plate, matrix: new THREE.Matrix4().makeTranslation(0, 6, -10) }
  const landscape = {
    floorY: 0,
    maxTop: 30,
    giantClams: { seed: 9661, count: 4, zMin: -30, spacing: 8, phoneWidth: 0.18, viewWidth: 0.85, length: [2.4, 4.8] },
  }
  const view = { x: 0, y: 4, z: 30, lookX: 0, lookY: 0 }
  const sightRocks = clusters.flatMap(cluster => cluster.geometries)
  const generator = placeGiantClams(landscape, clusters, [table], [shape], view, null, sightRocks)
  let step
  do { step = generator.next() } while (!step.done)
  const clams = step.value
  assert.equal(clams.length, 2, `one clam by each front bommie: ${clams.length}`)
  assert.deepEqual(clams.map(clam => clam.site).sort(), [0, 1], 'none by the bommie behind zMin')
  // The resting camera's 16:9 frame, as placement measures it.
  const camera = new THREE.PerspectiveCamera(42, 16 / 9, 0.1, 1000)
  camera.position.set(view.x, view.y, view.z)
  camera.lookAt(view.lookX, view.lookY, 0)
  camera.updateMatrixWorld()
  const ndc = clams[0].centre.clone().project(camera)
  assert.ok(Math.abs(ndc.x) <= 0.18 + 1e-6 && ndc.y > -0.75, `the first is in the phone's view: (${ndc.x.toFixed(2)}, ${ndc.y.toFixed(2)})`)
  assert.ok(clams[0].base.z > -6, 'in front of its bommie, where the camera sees it')
  const line = clams[0].sight
  assert.ok(line && !clams[1].sight, 'only the phone-view clam keeps a line of sight')
  assert.ok(inClam(clams, line.from.clone().addScaledVector(line.direction, line.length * 0.6)), 'later corals keep out of its line of sight')
  assert.ok(line.direction.z > 0, 'which runs toward the camera')
  for (const [i, clam] of clams.entries()) {
    assert.ok(clam.length >= 2.4 - 1e-6 && clam.length <= 4.8 + 1e-6, `clam ${i} is 60 cm to 1.2 m: ${(clam.length / 4).toFixed(2)} m`)
    assert.ok(clam.base.y < 0 && clam.base.y > -0.2, `clam ${i} lies on the sand, sunk a little: ${clam.base.y.toFixed(3)}`)
    for (const sample of shape.samples) {
      const point = sample.clone().applyMatrix4(clam.matrix)
      const inRock = clusters.some(cluster => {
        const box = new THREE.Box3().setFromBufferAttribute(cluster.geometries[0].attributes.position)
        return box.containsPoint(point)
      })
      assert.ok(!inRock, `clam ${i} is out of the bommie`)
      assert.ok(!inClam(clams.slice(0, i), point), `clam ${i} is clear of the clams before it`)
    }
    const up = new THREE.Vector3(0, 1, 0).transformDirection(clam.matrix)
    assert.ok(up.y > Math.cos(0.11), 'a clam lies level, leaning at most 6°')
    // Broadside: the shell's length within about 40° of square to the line to the camera.
    const toEye = new THREE.Vector3(view.x - clam.base.x, 0, view.z - clam.base.z).normalize()
    assert.ok(Math.abs(clam.axis.dot(toEye)) < Math.sin(0.7) + 1e-6, `clam ${i} shows its fluted side to the camera`)
  }
  assert.ok(Math.hypot(clams[0].base.x - clams[1].base.x, clams[0].base.z - clams[1].base.z) >= 8, 'clams lie at least 2 m apart')
  assert.ok(inClam(clams, clams[0].centre), 'a clam holds its own space')
  assert.ok(!inClam(clams, new THREE.Vector3(100, 0, 100)), 'and nothing far off')
  console.log(`giant clam placement: ${clams.length} clams on the sand, the first in the phone's view, passed`)
} finally {
  await server.close()
}
