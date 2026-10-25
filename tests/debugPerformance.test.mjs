import assert from 'node:assert/strict'
import { MeshStandardMaterial, BoxGeometry, ShaderLib, Matrix4 } from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { createFrameMeter, createGpuTimer } from '../src/utils/frameProfiler.js'
import { installLodDebug, tagLodGeometry } from '../src/utils/lodDebug.js'

let clock = 0
const meter = createFrameMeter(() => clock)
for (let i = 0; i < 60; i++) { meter.begin(); clock += 17; assert.equal(meter.end(), null, 'no Canvas frame, no FPS') }
let sample
for (let i = 0; i < 60; i++) {
  meter.begin(); meter.markRendered(); clock += 4
  sample = meter.end() ?? sample
  clock += 12
}
assert.ok(sample.fps > 0 && sample.cpuMs === 4)
// A fresh interval has exactly 50 rendered frames over 1 second, 4ms CPU each.
clock = 0
const counted = createFrameMeter(() => clock)
for (let i = 0; i < 50; i++) { counted.begin(); counted.markRendered(); clock += 4; sample = counted.end(); clock += 16 }
counted.begin(); counted.markRendered(); clock += 4; sample = counted.end()
assert.equal(sample.fps, 51 * 1000 / 1004)
assert.equal(sample.cpuMs, 4)
assert.equal(sample.frameMs, 1004 / 51)
assert.equal(createGpuTimer({ getExtension: () => null }).poll(), null, 'unsupported GPU timer is unavailable')

let ready = false, disjoint = false, active = null, deleted = 0, lost = false
const ext = { TIME_ELAPSED_EXT: 1, GPU_DISJOINT_EXT: 2 }
const gl = {
  CURRENT_QUERY: 3, QUERY_RESULT_AVAILABLE: 4, QUERY_RESULT: 5,
  getExtension: () => ext, isContextLost: () => lost, getQuery: () => active,
  createQuery: () => ({}), beginQuery: (_, q) => { active = q }, endQuery: () => { active = null },
  getParameter: () => disjoint,
  getQueryParameter: (_, what) => what === 4 ? ready : 3500000,
  deleteQuery: () => { deleted++ },
}
const timer = createGpuTimer(gl)
timer.begin(); timer.begin(); assert.equal(timer.poll(), null, 'never read an in-flight result'); timer.end()
assert.equal(timer.poll(), null, 'never block for unavailable GPU result')
ready = true; assert.equal(timer.poll(), 3.5); assert.equal(deleted, 1)
timer.begin(); timer.end(); disjoint = true; assert.equal(timer.poll(), null); assert.equal(deleted, 2)
disjoint = false; timer.begin(); lost = true; assert.equal(timer.poll(), null); timer.dispose()
lost = false
const owned = createGpuTimer(gl); active = null; owned.begin(); owned.dispose(); assert.equal(active, null); assert.equal(deleted, 3)
active = {}; const external = createGpuTimer(gl); external.begin(); external.end(); assert.notEqual(active, null, 'do not end someone else’s query'); active = null

for (const level of [null, 0, 1, 2, 3, 4]) {
  const material = new MeshStandardMaterial()
  let called = 0
  material.onBeforeCompile = shader => { called++; shader.uniforms.proceduralTime = { value: 12 } }
  material.customProgramCacheKey = () => 'procedural-cache-key'
  const before = material.onBeforeCompile, key = material.customProgramCacheKey
  const restore = installLodDebug(material, level)
  const shader = { vertexShader: ShaderLib.standard.vertexShader, fragmentShader: ShaderLib.standard.fragmentShader, uniforms: {} }
  material.onBeforeCompile(shader, {})
  assert.equal(called, 1); assert.equal(shader.uniforms.proceduralTime.value, 12)
  assert.match(shader.fragmentShader, /gl_FragColor.rgb = debugLevel/)
  assert.match(material.customProgramCacheKey(), /procedural-cache-key\|debug-lod/)
  if (level == null) assert.match(shader.vertexShader, /attribute float debugLodLevel/)
  else assert.match(shader.fragmentShader, new RegExp(`float debugLevel = ${level}\\.0`))
  restore(); restore()
  assert.equal(material.onBeforeCompile, before); assert.equal(material.customProgramCacheKey, key)
  assert.equal(material.userData.debugLodLevel, undefined)
  material.dispose()
}
const parts = [0, 1, 2, 3].map(level => tagLodGeometry(new BoxGeometry().applyMatrix4(new Matrix4().makeTranslation(level, 0, 0)), level))
const beforePositions = parts.map(p => [...p.attributes.position.array])
const merged = mergeGeometries(parts)
assert.deepEqual([...new Set(merged.attributes.debugLodLevel.array)], [0, 1, 2, 3], 'mixed chunk preserves actual source tiers; far/min do not become fake high')
parts.forEach((p, i) => { assert.deepEqual([...p.attributes.position.array], beforePositions[i]); p.dispose() }); merged.dispose()
console.log('performance meters/GPU unsupported-pending-disjoint-context-cleanup, shader chaining/restoration, all-tier mixed GLB geometry tests passed')
