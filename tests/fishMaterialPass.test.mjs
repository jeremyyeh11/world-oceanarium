import assert from 'node:assert/strict'
import { Group, Mesh, MeshBasicMaterial, MeshStandardMaterial, Object3D } from 'three'
import { createFishMaterialPass } from '../src/components/fishMaterialPass.js'

// Reference is the pre-cache Fish.jsx traversal, including repeated writes and proxy exclusion.
function referencePass(root, opacity, envMapIntensity) {
  root.traverse(child => {
    if (!child.isMesh || child.userData?.interactionProxy) return
    const apply = material => {
      if (!material) return
      const alphaBlend = material.userData.alphaBlend === true
      material.transparent = alphaBlend || opacity < 0.999
      material.opacity = opacity
      if ('depthWrite' in material) material.depthWrite = !alphaBlend && opacity >= 0.999
      if ('envMapIntensity' in material) material.envMapIntensity = envMapIntensity
    }
    if (Array.isArray(child.material)) child.material.forEach(apply)
    else apply(child.material)
  })
}

function fixture() {
  const root = new Group()
  const nested = new Group()
  const opaque = new Mesh(undefined, new MeshStandardMaterial())
  const blendMaterial = new MeshStandardMaterial({ transparent: true })
  blendMaterial.userData.alphaBlend = true
  const blend = new Mesh(undefined, blendMaterial)
  const array = new Mesh(undefined, [new MeshBasicMaterial(), null, opaque.material])
  const proxy = new Mesh(undefined, new MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }))
  proxy.userData.interactionProxy = true
  proxy.visible = false
  opaque.visible = false // traverse updates hidden meshes, too.
  nested.add(opaque, blend, array)
  root.add(nested, proxy, new Object3D())
  return { root, nested, opaque, blend, array, proxy }
}

function materialsOf(root) {
  const result = []
  root.traverse(child => {
    if (!child.isMesh) return
    for (const material of [].concat(child.material ?? [])) {
      if (material) result.push([material.transparent, material.opacity, material.depthWrite, material.envMapIntensity])
    }
  })
  return result
}

const actual = fixture()
const expected = fixture()
function recordWrites(root) {
  const log = []
  const seen = new Set()
  root.traverse(mesh => {
    if (!mesh.isMesh) return
    for (const material of [].concat(mesh.material ?? [])) {
      if (!material || seen.has(material)) continue
      const id = seen.size
      seen.add(material)
      for (const key of ['transparent', 'opacity', 'depthWrite', 'envMapIntensity']) {
        if (!(key in material)) continue
        let value = material[key]
        Object.defineProperty(material, key, {
          configurable: true,
          get() { return value },
          set(next) { log.push([id, key, next]); value = next },
        })
      }
    }
  })
  return log
}
const actualWrites = recordWrites(actual.root)
const expectedWrites = recordWrites(expected.root)
const pass = createFishMaterialPass()
for (const opacity of [1, 0.999, 0.998999, 0.5, 0, 1]) {
  for (const env of [0.25, 0.45, 0.95]) {
    actualWrites.length = 0
    expectedWrites.length = 0
    referencePass(expected.root, opacity, env)
    pass.update(actual.root, opacity, env)
    assert.deepEqual(actualWrites, expectedWrites, 'write count/order matches, including repeated shared materials')
    assert.deepEqual(materialsOf(actual.root), materialsOf(expected.root))
  }
}
assert.equal(actual.proxy.material.opacity, 0, 'interaction proxies stay untouched')

// Material replacement and in-place array edits do not dispatch scene-graph events.
actual.opaque.material = new MeshStandardMaterial()
expected.opaque.material = new MeshStandardMaterial()
actual.array.material.push(new MeshStandardMaterial())
expected.array.material.push(new MeshStandardMaterial())
actual.array.material[0] = new MeshBasicMaterial()
expected.array.material[0] = new MeshBasicMaterial()
actual.proxy.userData.interactionProxy = false
expected.proxy.userData.interactionProxy = false
referencePass(expected.root, 0.4, 0.7)
pass.update(actual.root, 0.4, 0.7)
assert.deepEqual(materialsOf(actual.root), materialsOf(expected.root), 'live material references and flags stay current')

// Same inputs still reapply after another pass changes a property; no dirty-value shortcut.
actual.opaque.material.opacity = 0.123
pass.update(actual.root, 0.4, 0.7)
assert.equal(actual.opaque.material.opacity, 0.4)

let traversals = 0
const originalTraverse = actual.root.traverse
actual.root.traverse = function (callback) { traversals += 1; originalTraverse.call(this, callback) }
for (let i = 0; i < 100; i += 1) pass.update(actual.root, 1, 0.95)
assert.equal(traversals, 0, 'steady frames must not traverse the fish hierarchy')

// Suspense/model/LOD/debug replacements can change any depth of the tree.
const branch = new Group()
const addedMesh = new Mesh(undefined, new MeshStandardMaterial())
branch.add(new Group().add(addedMesh))
actual.nested.add(branch)
pass.update(actual.root, 0.6, 0.8)
assert.equal(traversals, 1, 'nested child addition refreshes the target cache once')
assert.equal(addedMesh.material.opacity, 0.6)
assert.equal(addedMesh.material.envMapIntensity, 0.8)
actual.nested.remove(branch)
addedMesh.material.opacity = 0.321
pass.update(actual.root, 1, 0.9)
assert.equal(traversals, 2, 'nested child removal refreshes the target cache once')
assert.equal(addedMesh.material.opacity, 0.321, 'detached subtrees receive no writes')
assert.equal(branch.hasEventListener('childadded', pass.invalidate), false, 'detached listeners are removed')

const replacement = new Group().add(new Mesh(undefined, new MeshStandardMaterial()))
pass.update(replacement, 0.2, 0.3)
assert.equal(replacement.children[0].material.opacity, 0.2, 'root replacement is supported')
assert.equal(actual.nested.hasEventListener('childadded', pass.invalidate), false, 'old root listeners are removed')
pass.dispose()
assert.equal(replacement.hasEventListener('childadded', pass.invalidate), false, 'unmount removes listeners')
pass.update(replacement, 0.7, 0.8)
assert.equal(replacement.children[0].material.opacity, 0.7, 'effect cleanup/restart can reuse the cache')
pass.update(null, 1, 1)
assert.equal(replacement.hasEventListener('childadded', pass.invalidate), false, 'null root releases references')
pass.dispose()

console.log('fish material pass equivalence and cache lifecycle tests passed')
