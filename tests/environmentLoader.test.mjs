import assert from 'node:assert/strict'
import { createEnvironmentLoader } from '../src/loading/environmentLoader.js'
import { createEnvironmentManifests, ENVIRONMENT_MANIFESTS } from '../src/loading/environmentManifest.js'
import { SPECIES, TANKS } from '../src/data/species.js'
import { compileEnvironmentScene } from '../src/loading/compileEnvironmentScene.js'
import { runSlicedPreparation } from '../src/loading/runSlicedPreparation.js'

const asset = name => ({ key: `gltf:${name}`, url: name, kind: 'gltf', estimatedBytes: 10 })
const flush = async () => { for (let i = 0; i < 15; i++) await Promise.resolve() }
function fixture(options = {}) {
  const a = asset('a'), b = asset('b'), shared = asset('shared'), c = asset('c'), d = asset('d')
  const started = [], disposed = [], pending = new Map(), idle = []
  let time = 0
  const environments = [{ id: 'a', assets: [shared, a] }, { id: 'b', assets: [shared, b] },
    { id: 'c', assets: [c] }, { id: 'd', assets: [d] }]
  const loader = createEnvironmentLoader({ environments, now: () => time, concurrency: 2,
    maxCachedBytes: 100, maxBackgroundBytes: 30, maxCachedAssets: 10, readGraceMs: 5,
    scheduleIdle(work) { const job = { work, cancelled: false }; idle.push(job); return () => { job.cancelled = true } },
    loadAsset(source, { signal, beforeDecode }) {
      started.push(source.key)
      return new Promise((resolve, reject) => {
        pending.set(source.key, { resolve, reject, signal, beforeDecode })
      })
    }, ...options })
  async function resolve(key, bytes = 10) {
    const task = pending.get(`gltf:${key}`)
    assert.ok(task, `No pending ${key}`)
    task.resolve({ value: key, bytes, dispose: () => disposed.push(key) })
    await flush()
  }
  return { loader, started, disposed, pending, a, b, shared, c, d, idle, resolve,
    advance: () => { time += 20; loader.maintain() },
    runIdle: async () => { const job = idle.shift(); if (job && !job.cancelled) job.work(); await flush() } }
}

{
  const f = fixture()
  const first = f.loader.select('a')
  await flush()
  assert.deepEqual(f.started, ['gltf:shared', 'gltf:a'])
  assert.equal(f.loader.getSnapshot().phase, 'loading')
  await f.resolve('shared'); await f.resolve('a')
  assert.equal((await first).status, 'assets-ready')
  assert.equal(f.loader.beginActivation('a'), true)
  assert.equal(f.loader.markRendered('a'), true)
  await flush()
  f.loader.prefetch('b')
  f.loader.setBackgroundEnabled(true)
  await flush()
  assert.equal(f.started.length, 2, 'Background work must wait for idle')
  await f.runIdle()
  assert.equal(f.started.at(-1), 'gltf:b')
  await f.resolve('b')
  const second = await f.loader.select('b')
  assert.equal(second.status, 'assets-ready')
  assert.equal(f.started.filter(key => key === 'gltf:shared').length, 1, 'Shared sources deduplicated')
  assert.equal(f.loader.getSnapshot().activeId, 'a', 'Old environment stays active while preparing')
  f.loader.beginActivation('b'); f.loader.markRendered('b')
  assert.throws(() => f.loader.select('unknown'), /Unknown environment/)
  f.loader.dispose()
}
{
  const f = fixture()
  const old = f.loader.select('a')
  await flush()
  const latest = f.loader.select('c')
  assert.equal((await old).status, 'cancelled')
  assert.equal(f.pending.get('gltf:a').signal.aborted, true)
  await f.resolve('a'); await f.resolve('shared')
  assert.ok(f.disposed.includes('a') && f.disposed.includes('shared'), 'Late aborted decodes disposed')
  await f.resolve('c')
  assert.equal((await latest).status, 'assets-ready')
  assert.equal(f.loader.beginActivation('a'), false)
  assert.equal(f.loader.markRendered('a'), false)
  assert.equal(f.loader.markRendered('c'), true)
  f.loader.dispose()
}
{
  const f = fixture()
  const first = f.loader.select('a')
  await flush()
  f.pending.get('gltf:shared').reject(new Error('offline'))
  await flush()
  assert.equal((await first).status, 'error')
  assert.match(f.loader.getSnapshot().error, /offline/)
  await f.resolve('a')
  const retry = f.loader.select('a')
  await flush(); await f.resolve('shared'); await f.resolve('a')
  assert.equal((await retry).status, 'assets-ready')
  f.disposed.length = 0
  f.loader.markRendered('a')
  const release = f.loader.retain([f.a])
  const retired = []
  f.loader.onRetire(id => retired.push(id))
  for (const id of ['c', 'd']) {
    const p = f.loader.select(id); await flush(); await f.resolve(id); await p; f.loader.markRendered(id)
  }
  f.advance()
  assert.deepEqual(retired, ['a'])
  assert.equal(f.disposed.includes('a'), false, 'Atlas/mounted consumer lease protects shared resources')
  release(); f.advance()
  assert.equal(f.disposed.includes('a'), true)
  assert.equal(f.disposed.includes('d'), false, 'Active asset never evicted')
  f.loader.dispose()
}
{
  const f = fixture({ maxCachedBytes: 15, maxBackgroundBytes: 5 })
  const p = f.loader.select('a'); await flush(); await f.resolve('shared'); await f.resolve('a'); await p
  f.loader.markRendered('a'); f.loader.prefetch('b'); f.loader.setBackgroundEnabled(true)
  await flush(); await f.runIdle()
  assert.equal(f.started.includes('gltf:b'), false, 'Speculation cannot exceed admission budget')
  assert.equal(f.loader.getSnapshot().overBudget, true, 'Oversize active environment reported honestly')
  assert.equal(f.disposed.length, 0)
  f.loader.dispose()
}
{
  const f = fixture()
  const p = f.loader.select('a'); await flush(); await f.resolve('shared'); await f.resolve('a'); await p
  f.loader.markRendered('a'); f.loader.prefetch('b'); f.loader.setBackgroundEnabled(true)
  f.loader.setBackgroundEnabled(false)
  await f.runIdle()
  assert.equal(f.started.includes('gltf:b'), false, 'Frame pressure cancels queued idle work')
  const before = f.loader.getSnapshot()
  assert.equal(f.loader.getSnapshot(), before, 'External-store snapshot identity stable between notifications')
  f.loader.dispose(); f.loader.dispose()
}
{
  const f = fixture()
  let suspended
  try { f.loader.read(f.a) } catch (value) { suspended = value }
  assert.ok(suspended instanceof Promise)
  await flush(); await f.resolve('a'); await suspended
  assert.equal(f.loader.read(f.a), 'a')
  const release = f.loader.retain([f.a]); f.advance()
  assert.equal(f.disposed.length, 0)
  release(); f.advance()
  assert.deepEqual(f.disposed, ['a'])
  f.loader.dispose()
}
{
  const f = fixture()
  const p = f.loader.select('a'); await flush(); f.loader.dispose()
  assert.equal((await p).status, 'cancelled')
  await f.resolve('shared'); await f.resolve('a')
  assert.deepEqual(f.disposed.sort(), ['a', 'shared'])
  assert.throws(() => f.loader.read(f.a), /disposed/)
}
{
  const f = fixture()
  const p = f.loader.select('a'); await flush(); await f.resolve('shared'); await f.resolve('a'); await p
  f.loader.markRendered('a'); f.loader.prefetch('b'); f.loader.setBackgroundEnabled(true); await f.runIdle()
  f.loader.setBackgroundEnabled(false)
  let decoded = false
  const gate = f.pending.get('gltf:b').beforeDecode().then(() => { decoded = true })
  await f.runIdle()
  assert.equal(decoded, false, 'Network completion must not bypass foreground pressure')
  const selected = f.loader.select('b')
  await gate
  assert.equal(decoded, true, 'Selected decode promotes without waiting for idle')
  await f.resolve('b'); await selected
  f.loader.markRendered('b'); f.loader.dispose()
}
{
  const f = fixture()
  const p = f.loader.select('a'); await flush(); await f.resolve('shared'); await f.resolve('a'); await p
  f.loader.beginActivation('a')
  const first = f.loader.beginPreparation('a', 'corals')
  const second = f.loader.beginPreparation('a', 'staghorn')
  await flush()
  assert.equal(f.loader.getSnapshot().environments.a.sceneTasks, 2)
  assert.equal(f.loader.markRendered('a'), false, 'First frame cannot acknowledge incomplete derived scene work')
  first(); first(); second()
  const third = f.loader.beginPreparation('a', 'collision-surfaces')
  second(); await flush()
  assert.equal(f.loader.getSnapshot().environments.a.sceneTasks, 1, 'Old completion cannot clear a newer task map')
  third(); await flush()
  assert.equal(f.loader.markRendered('a'), true)
  f.loader.dispose()
}
{
  const f = fixture({ concurrency: 1 })
  f.loader.select('a'); await flush()
  let suspended
  try { f.loader.read(f.c) } catch (promise) { suspended = promise }
  let settled = false
  suspended.then(() => { settled = true })
  f.advance(); await flush()
  assert.equal(settled, true, 'Evicted queued reads must wake Suspense, not hang forever')
  assert.equal(f.started.includes('gltf:c'), false)
  f.loader.dispose()
}
// Manifest registration is data-driven, covers sex/life-stage variants, and deduplicates maps.
assert.equal(ENVIRONMENT_MANIFESTS.length, TANKS.length)
for (const manifest of ENVIRONMENT_MANIFESTS) assert.equal(new Set(manifest.assets.map(a => a.key)).size, manifest.assets.length)
const synthetic = createEnvironmentManifests([{ id: 'future', biome: 'lake', species: ['x'] }], [{ id: 'x',
  model: { path: '/base', sexVariants: { female: { path: '/female' } } }, lifeStages: { juvenile: { model: { path: '/young' } } } }], () => null)
assert.deepEqual(synthetic[0].assets.map(a => a.url), ['/base', '/female', '/young'])
for (const tank of TANKS) for (const id of tank.species) assert.ok(SPECIES.some(species => species.id === id))
// Cancellation/intent/Atlas races found by independent review.
{
  const f = fixture()
  const old = f.loader.select('c'); await flush()
  const selected = f.loader.select('d'); await flush()
  const release = f.loader.retain([f.c])
  assert.equal((await old).status, 'cancelled')
  await f.resolve('c'); await f.resolve('d'); await selected; f.loader.markRendered('d')
  assert.equal(f.started.filter(key => key === 'gltf:c').length, 2)
  await f.resolve('c'); f.advance(); await flush()
  assert.equal(f.disposed.filter(key => key === 'c').length, 1, 'Lease must protect replacement, not aborted generation')
  release(); f.advance()
  assert.equal(f.disposed.filter(key => key === 'c').length, 2)
  f.loader.dispose()
}
{
  const f = fixture()
  const p = f.loader.select('a'); await flush(); await f.resolve('shared'); await f.resolve('a'); await p
  f.loader.markRendered('a'); f.loader.prefetch('b'); f.loader.setBackgroundEnabled(true); await f.runIdle()
  f.loader.prefetch('b')
  assert.equal(f.pending.get('gltf:b').signal.aborted, false, 'Repeated hint must not abort itself')
  f.loader.setBackgroundEnabled(false)
  let promoted = false
  const gate = f.pending.get('gltf:b').beforeDecode().then(() => { promoted = true })
  await flush()
  const release = f.loader.retain([f.b])
  let suspended
  try { f.loader.read(f.b) } catch (promise) { suspended = promise }
  await gate
  assert.equal(promoted, true, 'Foreground Atlas lease/read promotes paused decode without idle')
  await f.resolve('b'); await suspended
  release(); f.loader.dispose()
}
{
  const a = asset('a'), b = asset('b'), c = asset('c')
  const f = fixture({ environments: [{ id: 'a', assets: [a] }, { id: 'b', assets: [b] }, { id: 'c', assets: [b, c] }] })
  const p = f.loader.select('a'); await flush(); await f.resolve('a'); await p; f.loader.markRendered('a')
  f.loader.prefetch('b'); f.loader.setBackgroundEnabled(true); await f.runIdle()
  f.loader.prefetch('c')
  assert.equal(f.pending.get('gltf:b').signal.aborted, false, 'Changed hint preserves still-needed shared speculative source')
  await f.resolve('b'); await f.runIdle(); await f.resolve('c')
  assert.equal(f.loader.getSnapshot().environments.c.assetsReady, true)
  f.loader.dispose()
}
{
  const a = asset('a'), b = asset('b'), c = asset('c')
  const f = fixture({ maxCachedAssets: 2, maxCachedBytes: 20,
    environments: [{ id: 'a', assets: [a] }, { id: 'b', assets: [b] }, { id: 'c', assets: [c] }] })
  const p = f.loader.select('a'); await flush(); await f.resolve('a'); await p; f.loader.markRendered('a')
  f.loader.prefetch('b'); f.loader.setBackgroundEnabled(true)
  const release = f.loader.retain([c]); await flush(); await f.resolve('c')
  await f.runIdle()
  assert.equal(f.started.includes('gltf:b'), false, 'Admission must recheck budgets at actual idle start')
  release(); await f.runIdle()
  assert.equal(f.started.includes('gltf:b'), true)
  await f.resolve('b'); f.loader.dispose()
}
{
  const f = fixture()
  const p = f.loader.select('a'); await flush(); await f.resolve('shared'); await f.resolve('a'); await p; f.loader.markRendered('a')
  const target = f.loader.select('c'); await flush(); await f.resolve('c'); await target; f.loader.beginActivation('c')
  const retired = []
  f.loader.onRetire((id, state) => retired.push({ id, state }))
  const unmount = f.loader.retainScene('c')
  const release = f.loader.retain([f.c])
  f.loader.failActivation('c', new Error('shader failed')); f.advance()
  assert.deepEqual(retired, [], 'Failed derived scene must not retire while mounted')
  unmount(); release(); f.advance()
  assert.equal(retired.length, 1)
  assert.equal(retired[0].id, 'c'); assert.equal(retired[0].state.activeId, 'a'); assert.equal(retired[0].state.phase, 'error')
  assert.equal(f.loader.getSnapshot().activeId, 'a')
  assert.equal(f.disposed.includes('c'), true, 'Failed target sources become evictable after rollback')
  f.loader.dispose()
}
{
  const f = fixture()
  const p = f.loader.select('a'); await flush(); await f.resolve('shared'); await f.resolve('a'); await p; f.loader.markRendered('a')
  const target = f.loader.select('c'); await flush(); await f.resolve('c'); await target; f.loader.beginActivation('c')
  const retired = []
  f.loader.onRetire(id => retired.push(id))
  const firstUnmount = f.loader.retainScene('c'), finalUnmount = f.loader.retainScene('c')
  const activeUnmount = f.loader.retainScene('a')
  const next = f.loader.select('d'); await flush()
  activeUnmount(); firstUnmount()
  assert.deepEqual(retired, [], 'Active scene and still-mounted superseded target must stay protected')
  finalUnmount(); finalUnmount()
  assert.deepEqual(retired, ['c'], 'Unmounted superseded target retires even if never active/recent')
  await f.resolve('d'); await next; f.loader.markRendered('d')
  assert.deepEqual(retired, ['c'])
  f.loader.dispose()
}
{
  const hidden = { visible: false }, visible = { visible: true }
  const scene = { traverse: fn => [hidden, visible].forEach(fn) }
  const camera = {}
  let compiled = 0
  const renderer = { compile(s, c) { assert.equal(s, scene); assert.equal(c, camera); assert.equal(hidden.visible, true); compiled++ },
    compileAsync() { throw new Error('Unsafe async material polling must not run') } }
  compileEnvironmentScene(renderer, scene, camera)
  assert.equal(compiled, 1); assert.equal(hidden.visible, false); assert.equal(visible.visible, true)
  renderer.compile = () => { throw new Error('compile failure') }
  assert.throws(() => compileEnvironmentScene(renderer, scene, camera), /compile failure/)
  assert.equal(hidden.visible, false, 'Visibility restored even when shader preparation fails')
}
// A failed speculative source must not poison a later foreground Atlas consumer.
for (const consumer of ['read', 'lease']) {
  const f = fixture()
  const p = f.loader.select('a'); await flush(); await f.resolve('shared'); await f.resolve('a'); await p; f.loader.markRendered('a')
  f.loader.prefetch('b'); f.loader.setBackgroundEnabled(true); await f.runIdle()
  f.pending.get('gltf:b').reject(new Error('transient speculative failure')); await flush()
  let release, suspended
  if (consumer === 'lease') release = f.loader.retain([f.b])
  try { f.loader.read(f.b) } catch (value) { suspended = value }
  assert.ok(suspended instanceof Promise, `${consumer} must retry a failed speculative source, not rethrow its cached error`)
  await flush()
  assert.equal(f.started.filter(key => key === 'gltf:b').length, 2)
  // Persistent foreground failures stay observable instead of an infinite Suspense retry loop.
  const foregroundFailure = new Error('foreground failure')
  f.pending.get('gltf:b').reject(foregroundFailure); await suspended; await flush()
  assert.throws(() => f.loader.read(f.b), error => error === foregroundFailure)
  release?.()
  const reopened = f.loader.retain([f.b]); await flush(); await f.resolve('b')
  assert.equal(f.loader.read(f.b), 'b', 'A fresh outer viewer lease can retry on reopening')
  reopened(); f.loader.dispose()
}
// Setup and iteration failures both release preparation barriers and enter rollback.
for (const stage of ['setup', 'iteration']) {
  const f = fixture()
  const p = f.loader.select('a'); await flush(); await f.resolve('shared'); await f.resolve('a'); await p; f.loader.markRendered('a')
  const target = f.loader.select('c'); await flush(); await f.resolve('c'); await target; f.loader.beginActivation('c')
  const complete = f.loader.beginPreparation('c', 'placement')
  const failure = new Error(`${stage} failed`)
  let reported = 0
  const stop = runSlicedPreparation(() => {
    if (stage === 'setup') throw failure
    return { next() { throw failure }, return() {} }
  }, { sliceMs: 4, now: () => 0, onReady() { assert.fail('Failed placement must not publish geometry') },
    onError(error) { reported++; assert.equal(error, failure); complete(); f.loader.failActivation('c', error) } })
  await flush()
  assert.equal(reported, 1)
  assert.equal(f.loader.getSnapshot().phase, 'error')
  assert.equal(f.loader.getSnapshot().activeId, 'a')
  assert.equal(f.loader.getSnapshot().environments.c.sceneTasks, 0)
  stop(); stop(); f.loader.dispose()
}
{
  const jobs = [], cancelled = [], results = []
  let time = 0, returned = 0
  const stop = runSlicedPreparation(() => ({ next: () => ({ done: false }), return() { returned++ } }), {
    sliceMs: 2, now: () => time++, schedule(work) { jobs.push(work); return jobs.length }, cancel: id => cancelled.push(id),
    onReady: value => results.push(value), onError: error => { throw error },
  })
  assert.equal(jobs.length, 1)
  stop(); stop(); jobs[0]()
  assert.equal(returned, 1, 'Generator cleanup is idempotent')
  assert.equal(jobs.length, 1, 'A late cancelled slice must not reschedule or publish')
  assert.deepEqual(cancelled, [1]); assert.deepEqual(results, [])
  let starts = 0, steps = 0
  const stopReady = runSlicedPreparation(() => { starts++; return { next() { return ++steps === 2 ? { done: true, value: 'corals' } : { done: false } } } }, {
    sliceMs: 4, now: () => 0, onReady: value => results.push(value), onError: error => { throw error },
  })
  assert.equal(starts, 1); assert.deepEqual(results, ['corals']); stopReady()
}
// Many future environments retain only active/recent sources, not the entire visited catalog.
{
  const environments = Array.from({ length: 40 }, (_, i) => ({ id: `env-${i}`, assets: [asset(`unique-${i}`)] }))
  const disposed = []
  const loader = createEnvironmentLoader({ environments, maxCachedBytes: 30, maxBackgroundBytes: 10,
    scheduleIdle: () => () => {}, loadAsset: async source => ({ value: source.url, bytes: 10, dispose: () => disposed.push(source.url) }) })
  for (const env of environments) {
    const result = await loader.select(env.id)
    assert.equal(result.status, 'assets-ready')
    loader.markRendered(env.id)
    await flush()
    assert.ok(loader.getSnapshot().cachedAssets <= 2, 'Visited environment count must not grow source retention')
  }
  assert.equal(disposed.length, 38)
  loader.dispose()
  assert.equal(disposed.length, 40)
}
console.log('environment loader: priority, cancellation, errors/retry, shared leases, budgets, retirement, idle/decode pressure, scene barriers, Suspense, disposal and 40-environment retention passed')
