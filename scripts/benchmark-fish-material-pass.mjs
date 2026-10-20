import assert from 'node:assert/strict'
import { performance } from 'node:perf_hooks'
import { readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { Group, Mesh, MeshStandardMaterial, Object3D } from 'three'
import { createFishMaterialPass } from '../src/components/fishMaterialPass.js'

// Isolated material bookkeeping, not an FPS or physical-device benchmark.
// Use exactly the baseline module-level callback and inputs, avoiding a biased
// reference that allocates a fresh callback or closure on every update.
let opacity = 1
let env = 0.95
function apply(material) {
  if (!material) return
  const alphaBlend = material.userData.alphaBlend === true
  material.transparent = alphaBlend || opacity < 0.999
  material.opacity = opacity
  if ('depthWrite' in material) material.depthWrite = !alphaBlend && opacity >= 0.999
  if ('envMapIntensity' in material) material.envMapIntensity = env
}
function visit(child) {
  if (!child.isMesh || child.userData?.interactionProxy) return
  if (Array.isArray(child.material)) {
    for (let i = 0; i < child.material.length; i += 1) apply(child.material[i])
  } else apply(child.material)
}
function syntheticFixture() {
  const root = new Group()
  let branch = root
  for (let i = 0; i < 60; i += 1) {
    const node = new Object3D()
    branch.add(node)
    if (i % 10 === 0) branch = node
  }
  for (let i = 0; i < 3; i += 1) branch.add(new Mesh(undefined, new MeshStandardMaterial()))
  return root
}
// Match shipped GLB node/primitive hierarchies without decoding textures or
// invoking a renderer. Equal weighting is not the live population distribution.
function modelFixture(document) {
  const meshForPrimitive = primitive => {
    const source = document.materials?.[primitive.material]
    const material = new MeshStandardMaterial()
    material.userData.alphaBlend = source?.alphaMode === 'BLEND'
    return new Mesh(undefined, material)
  }
  const nodes = document.nodes.map(node => {
    const primitives = document.meshes?.[node.mesh]?.primitives ?? []
    if (primitives.length === 1) return meshForPrimitive(primitives[0])
    return new Group().add(...primitives.map(meshForPrimitive))
  })
  document.nodes.forEach((node, index) => {
    for (const child of node.children ?? []) nodes[index].add(nodes[child])
  })
  const model = new Group()
  for (const index of document.scenes[document.scene ?? 0].nodes) model.add(nodes[index])
  return new Group().add(new Group().add(model))
}
const directory = fileURLToPath(new URL('../public/models/fish/', import.meta.url))
const paths = readdirSync(directory, { recursive: true }).filter(path => path.endsWith('.glb') && !path.startsWith('acropora-')).sort()
const models = paths.map(path => {
  const bytes = readFileSync(`${directory}/${path}`)
  return JSON.parse(bytes.subarray(20, 20 + bytes.readUInt32LE(12)).toString())
})
const synthetic = process.argv.includes('--synthetic')
const fish = Array.from({ length: 200 }, (_, index) => synthetic ? syntheticFixture() : modelFixture(models[index % models.length]))
let totalNodes = 0
let totalMeshes = 0
for (const root of fish) root.traverse(node => { totalNodes += 1; if (node.isMesh) totalMeshes += 1 })
const caches = fish.map(() => createFishMaterialPass())
let traversals = 0
for (const root of fish) {
  const traverse = root.traverse
  root.traverse = function (callback) { traversals += 1; traverse.call(this, callback) }
}
const baseline = frames => {
  for (let frame = 0; frame < frames; frame += 1) {
    opacity = frame % 2 ? 1 : 0.5
    env = 0.25 + (frame % 10) / 20
    for (const root of fish) root.traverse(visit)
  }
}
const cached = frames => {
  for (let frame = 0; frame < frames; frame += 1) {
    const alpha = frame % 2 ? 1 : 0.5
    const intensity = 0.25 + (frame % 10) / 20
    for (let i = 0; i < fish.length; i += 1) caches[i].update(fish[i], alpha, intensity)
  }
}
baseline(100)
cached(100)
const rounds = { baseline: [], cached: [] }
for (let round = 0; round < 7; round += 1) {
  for (const [name, run] of round % 2 ? [['cached', cached], ['baseline', baseline]] : [['baseline', baseline], ['cached', cached]]) {
    const start = performance.now()
    run(500)
    rounds[name].push(performance.now() - start)
  }
}
traversals = 0
cached(500)
assert.equal(traversals, 0)
const median = values => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)]
const baselineMs = median(rounds.baseline)
const cachedMs = median(rounds.cached)
console.log(JSON.stringify({ fixture: synthetic ? '200 synthetic fish, 60 non-mesh nodes + 3 meshes each' : `200 fish using shipped node/primitive trees, round-robin across ${models.length} fish GLBs, plus three runtime groups`, framesPerRound: 500, roundCount: 7, totalNodes, totalMeshes, baselineMs, cachedMs, reductionPercent: (1 - cachedMs / baselineMs) * 100, steadyFrameTraversals: traversals, rounds, caveat: 'Isolated material bookkeeping only; not tank FPS, live population weighting, or physical-mobile performance' }, null, 2))
for (const cache of caches) cache.dispose()
