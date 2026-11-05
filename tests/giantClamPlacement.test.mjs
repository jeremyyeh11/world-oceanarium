import assert from 'node:assert/strict'
import * as THREE from 'three'
import { createServer } from 'vite'

// Giant clams against real triangles: the first in the phone's view by a rock, then one by each
// bommie in front of zMin (none by one behind it), on the sand off the bommie's foot, never in it,
// level, broadside to the camera, at least `spacing` apart; inClam keeps later corals out of them
// and out of the first one's line of sight. No dependency scan, as in seaFanPlacement.test.mjs.
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
  assert.equal(clams.length, 3, `one in view, then one by each front bommie: ${clams.length}`)
  assert.equal(clams[0].site, -1, 'the first by any rock')
  assert.deepEqual(clams.slice(1).map(clam => clam.site).sort(), [0, 1], 'none by the bommie behind zMin')
  // The resting camera's 16:9 frame, as placement measures it.
  const camera = new THREE.PerspectiveCamera(42, 16 / 9, 0.1, 1000)
  camera.position.set(view.x, view.y, view.z)
  camera.lookAt(view.lookX, view.lookY, 0)
  camera.updateMatrixWorld()
  const ndc = clams[0].centre.clone().project(camera)
  assert.ok(Math.abs(ndc.x) <= 0.18 + 1e-6 && ndc.y > -0.75, `the first is in the phone's view: (${ndc.x.toFixed(2)}, ${ndc.y.toFixed(2)})`)
  const nearest = Math.min(...clusters.map(cluster => {
    const box = new THREE.Box3().setFromBufferAttribute(cluster.geometries[0].attributes.position)
    return box.distanceToPoint(clams[0].base.clone().setY(1))
  }))
  assert.ok(nearest >= 1 && nearest <= 10, `by a rock, 25 cm to 2.5 m off it: ${nearest.toFixed(2)} WU`)
  const line = clams[0].sight
  assert.ok(line && clams.slice(1).every(clam => !clam.sight), 'only the phone-view clam keeps a line of sight')
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
  for (const [i, a] of clams.entries()) {
    for (const b of clams.slice(i + 1)) assert.ok(Math.hypot(a.base.x - b.base.x, a.base.z - b.base.z) >= 8, 'clams lie at least 2 m apart')
  }
  assert.ok(inClam(clams, clams[0].centre), 'a clam holds its own space')
  assert.ok(!inClam(clams, new THREE.Vector3(100, 0, 100)), 'and nothing far off')
  // The mantle's swell: every vertex swings along the surface's outward normal, split vertices of a
  // flat-shaded mesh together (no facet opens), nothing below flexFrom.
  const { addSwayAttributes } = await server.ssrLoadModule('/src/utils/coralSway.js')
  const dome = new THREE.SphereGeometry(1, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2).toNonIndexed()
  addSwayAttributes(dome, {
    origin: new THREE.Vector3(), direction: new THREE.Vector3(0, 1, 0), amplitude: 0.1, reach: 1, phase: 0,
    up: new THREE.Vector3(0, 1, 0), flexFrom: 0.45, swell: true,
  })
  const position = dome.attributes.position
  const sway = dome.attributes.aSway
  const byPoint = new Map()
  for (let i = 0; i < position.count; i++) {
    const p = new THREE.Vector3().fromBufferAttribute(position, i)
    const s = new THREE.Vector3(sway.getX(i), sway.getY(i), sway.getZ(i))
    assert.ok(Math.abs(s.length() - 0.1) < 1e-4, 'the swell has the amplitude')
    if (p.length() > 0.5 && p.y < 0.98) assert.ok(s.clone().normalize().dot(p.clone().normalize()) > 0.9, 'and points out of the surface')
    const key = p.toArray().map(v => v.toFixed(4)).join(',')
    if (byPoint.has(key)) assert.ok(byPoint.get(key).distanceTo(s) < 1e-6, 'split vertices swell together')
    else byPoint.set(key, s)
    if (p.y < 0.45) assert.equal(dome.attributes.aSwayFlex.getX(i), 0, 'nothing below flexFrom moves')
  }
  console.log(`giant clam placement: ${clams.length} clams on the sand, the first in the phone's view; the mantle swells, passed`)
} finally {
  await server.close()
}
