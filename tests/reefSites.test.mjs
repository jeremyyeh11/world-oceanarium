import assert from 'node:assert/strict'
import * as THREE from 'three'
import {
  castReefRay,
  clearCoralSurfaces,
  clearReefSurfaces,
  reefSegmentClear,
  setCoralSurfaces,
  setReefSurfaces,
} from '../src/components/reefSites.js'

const rock = new THREE.BoxGeometry(2, 2, 2).translate(10, 0, 0)
const lattice = new THREE.PlaneGeometry(4, 4)
const rockOwner = setReefSurfaces([rock])
const fanOwner = setCoralSurfaces([lattice], [{ form: 'fan', centre: new THREE.Vector3(), top: 2, radius: 2 }])
const front = new THREE.Vector3(0, 0, 3)
const back = new THREE.Vector3(0, 0, -3)
const hit = new THREE.Vector3()
try {
  assert.equal(castReefRay(front, new THREE.Vector3(0, 0, -1), 6, hit), 3)
  assert.ok(hit.length() < 1e-6)
  assert.equal(castReefRay(back, new THREE.Vector3(0, 0, 1), 6, hit), 3, 'the back of a fan blocks site rays')
  assert.ok(hit.length() < 1e-6)
  assert.equal(reefSegmentClear(front, back), false, 'forward approaches cannot cross a fan')
  assert.equal(reefSegmentClear(back, front), false, 'reverse approaches cannot cross a fan')
  assert.equal(castReefRay(front, new THREE.Vector3(0, 0, -1), 2), -1, 'respect the ray distance')

  // Solid rock retains its original inside-to-outside semantics. Fan registration must not
  // turn the shared rock material double-sided or leak a side setting across surface owners.
  assert.equal(castReefRay(new THREE.Vector3(13, 0, 0), new THREE.Vector3(-1, 0, 0), 4), 2)
  assert.equal(castReefRay(new THREE.Vector3(10, 0, 0), new THREE.Vector3(1, 0, 0), 4), -1)
  for (const form of ['table', 'thicket']) {
    const geometry = new THREE.BoxGeometry(2, 2, 2).translate(20, 0, 0)
    const owner = setCoralSurfaces([geometry], [{ form, centre: new THREE.Vector3(20, 0, 0), top: 1, radius: 1 }])
    assert.equal(castReefRay(new THREE.Vector3(20, 0, 0), new THREE.Vector3(1, 0, 0), 4), -1, `${form} retains front-face raycasts`)
    clearCoralSurfaces(owner)
    geometry.dispose()
  }
  clearCoralSurfaces(fanOwner)
  assert.equal(reefSegmentClear(front, back), true, 'unmounting a fan releases its raycast surface')
} finally {
  clearCoralSurfaces(fanOwner)
  clearReefSurfaces(rockOwner)
  rock.dispose()
  lattice.dispose()
}
console.log('reef site rays: both fan faces, solid-surface semantics and cleanup passed')
