import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { build } from 'esbuild'
import { createRequire } from 'node:module'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { BoxGeometry, Matrix4, MeshStandardMaterial, Vector3 } from 'three'
const require = createRequire(import.meta.url)
const source = await readFile('src/components/Landscape.jsx', 'utf8')
const result = await build({
  stdin: { contents: source + '\nexport {mergeKitModels,staghornLods,applyCoralSway,installLodDebug};', resolveDir: fileURLToPath(new URL('../src/components/', import.meta.url)), loader: 'jsx' },
  bundle: true, write: false, platform: 'node', format: 'esm', define: { 'import.meta.hot': 'false' },
  plugins: [{ name: 'landscape-context', setup(b) {
    b.onResolve({ filter: /^react$|^three-mesh-bvh$|^three(\/.*)?$/ }, args => ({ path: pathToFileURL(require.resolve(args.path)).href, external: true }))
    b.onResolve({ filter: /@react-three\/fiber|hooks\/useEnvironmentLoading|loading\/environmentRuntime/ }, args => ({ path: args.path, namespace: 'stub' }))
    b.onLoad({ filter: /.*/, namespace: 'stub' }, args => ({ contents: args.path.includes('environmentRuntime') ? 'export const environmentLoader={onRetire:()=>()=>{}}' : args.path.includes('useEnvironmentLoading') ? 'export const useEnvironmentGLTF=()=>{},useEnvironmentTextures=()=>{}' : 'export const useFrame=()=>{}' }))
  } }],
})
const { mergeKitModels, staghornLods, applyCoralSway, installLodDebug } = await import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`).catch(error => { throw new Error(error.message) })
const meshes = Object.fromEntries(['hi','lo','far','min'].map(tier => [`coral_${tier}`, new BoxGeometry()]))
const kit = { models: [{ name: 'coral' }], hiDetailDistance: 5, loDetailDistance: 20, farDetailDistance: 30, chunkWU: 100 }
const items = [0, 10, 40].map(x => ({ model: 0, matrix: new Matrix4().makeTranslation(x, 0, 0), position: new Vector3(x, 0, 0) }))
const chunks = mergeKitModels(items, kit, meshes, { x: 0, y: 0, z: 0 }, item => item.position)
assert.equal(chunks.length, 1, 'mixed tiers remain one draw chunk')
assert.deepEqual([...new Set(chunks[0].geometry.attributes.debugLodLevel.array)], [0, 1, 2])
const material = new MeshStandardMaterial()
const [bommie] = staghornLods([{ model: 0, site: 'one', base: new Vector3(), matrix: new Matrix4() }], kit, meshes, [material])
assert.equal(bommie.lod.levels.length, 4)
assert.equal(bommie.near.children[0].geometry, bommie.lo[0])
assert.equal(bommie.near.children[0].geometry.attributes.debugLodLevel.getX(0), 1, 'near starts on real low, not fake LOD0')
assert.equal(bommie.lod.levels[2].object.children[0].geometry.attributes.debugLodLevel.getX(0), 2)
assert.equal(bommie.lod.levels[3].object.children[0].geometry.attributes.debugLodLevel.getX(0), 3)
const [model, group] = bommie.models[0]
const high = bommie.merge('hi', model, group)
assert.equal(high.attributes.debugLodLevel.getX(0), 0, 'sliced high build tags real high')
bommie.near.children[0].geometry = high
bommie.near.children[0].geometry = bommie.lo[0]
assert.equal(bommie.near.children[0].geometry.attributes.debugLodLevel.getX(0), 1, 'retiring high returns to actual low colour')
for (const geometry of [...Object.values(meshes), ...chunks.map(c => c.geometry), ...bommie.geometries, high]) geometry.dispose()
material.dispose()
// The merged release's single-level sea fan keeps its authored sway while the main-branch
// debug view supplies its diagnostic colour; exiting debug restores the original hooks.
const fanMaterial = new MeshStandardMaterial()
applyCoralSway(fanMaterial, { period: 7, bend: 0.06, flutter: 0.25 })
const authoredCompile = fanMaterial.onBeforeCompile
const authoredKey = fanMaterial.customProgramCacheKey
const restoreFan = installLodDebug(fanMaterial, 4)
const shader = {
  uniforms: {},
  vertexShader: '#include <common>\n#include <begin_vertex>',
  fragmentShader: '#include <common>\n#include <normal_fragment_begin>\n#include <dithering_fragment>',
}
fanMaterial.onBeforeCompile(shader)
assert.ok(shader.uniforms.uSwayTime, 'debug colouring retains the sway clock')
assert.match(shader.vertexShader, /transformed \+= aSway/)
assert.match(shader.fragmentShader, /float debugLevel = 4\.0/)
restoreFan()
assert.equal(fanMaterial.onBeforeCompile, authoredCompile)
assert.equal(fanMaterial.customProgramCacheKey, authoredKey)
fanMaterial.dispose()
console.log('actual Landscape chunk/table/staghorn LOD tags: mixed draw merging, near low/high/low, far/min passed')
