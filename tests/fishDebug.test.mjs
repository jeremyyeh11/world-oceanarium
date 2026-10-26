// Exercise Fish.jsx's actual movement/render-decision frame. GPU work is not simulated.
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import * as THREE from 'three'
import { build } from 'esbuild'
import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'
import { resolve } from 'node:path'
const require = createRequire(import.meta.url)
const key = '__fishDebugTest'
const h = { frames: [], effects: [], cleanups: [], setters: [], lines: [], texts: [], groups: [] }
globalThis[key] = h
h.useRef = current => ({ current })
h.useMemo = fn => fn()
h.useState = initial => {
  const setter = { initial: typeof initial === 'function' ? initial() : initial, values: [] }
  h.setters.push(setter)
  return [setter.initial, value => setter.values.push(value)]
}
h.useEffect = effect => h.effects.push(effect)
h.jsx = (type, props, ...children) => {
  if (!['group', 'mesh', 'line', 'debug-text'].includes(type)) return null
  const object = type === 'line' ? new THREE.Line(props.geometry, new THREE.LineBasicMaterial())
    : type === 'mesh' ? new THREE.Mesh() : new THREE.Group()
  if (props?.ref) typeof props.ref === 'function' ? props.ref(object) : props.ref.current = object
  if (props?.visible != null) object.visible = props.visible
  if (props?.userData) object.userData = props.userData
  if (props?.scale) object.scale.fromArray(props.scale)
  if (props?.position) object.position.fromArray(props.position)
  if (type === 'line') h.lines.push(object)
  if (type === 'debug-text') h.texts.push(object)
  if (type === 'group') h.groups.push(object)
  for (const child of children.flat(Infinity)) if (child?.isObject3D) object.add(child)
  return object
}
const result = await build({
  stdin: { contents: `export {default as Fish, applyModelMaterialSettings} from './src/components/Fish.jsx'; export {getSardineLod0Stats} from './src/components/sardineInstanceRegistry.js'; export {pruneFishRuntime} from './src/components/fishRuntimeStore.js';`, resolveDir: resolve('.') },
  bundle: true, write: false, format: 'esm', platform: 'node', jsxFactory: '__debugJSX', jsxFragment: '__debugFragment',
  banner: { js: `const __debugJSX=globalThis.${key}.jsx; const __debugFragment=Symbol('fragment');` },
  define: { 'import.meta.env.DEV': 'false' },
  plugins: [{ name: 'frame-dependencies', setup(b) {
    b.onLoad({ filter: /components[\\/]Fish\.jsx$/ }, async args => ({ contents: (await readFile(args.path, 'utf8')) + '\nexport { applyModelMaterialSettings };', loader: 'jsx' }))
    b.onResolve({ filter: /^three(\/.*)?$/ }, args => ({ path: pathToFileURL(require.resolve(args.path)).href, external: true }))
    b.onResolve({ filter: /^(react|@react-three\/fiber|@react-three\/drei)$|\/hooks\/(useEnvironmentLoading|useOceanAudio)$|^\.\/WaterSurface$/ }, args => ({ path: args.path, namespace: 'stub' }))
    b.onLoad({ filter: /.*/, namespace: 'stub' }, args => {
      if (args.path === 'react') return { contents: `const h=globalThis.${key}; export const useRef=h.useRef,useMemo=h.useMemo,useState=h.useState,useEffect=h.useEffect;` }
      if (args.path === '@react-three/fiber') return { contents: `export const useFrame=fn=>globalThis.${key}.frames.push(fn);` }
      if (args.path === '@react-three/drei') return { contents: `export const Text='debug-text',useAnimations=()=>({actions:{}});` }
      if (args.path.endsWith('useOceanAudio')) return { contents: 'export const triggerFishSwimSound=()=>{};' }
      if (args.path.endsWith('WaterSurface')) return { contents: 'export const SURFACE_PLANE_Y=4.6;' }
      return { contents: 'export const useEnvironmentGLTF=()=>{throw new Error("Do not render GLBs in frame test")};' }
    })
  } }],
})
const runtime = await import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`)
// Real material helper regression: repeated colour on/off must preserve authored values.
const modelRoot = new THREE.Group()
const original = new THREE.MeshStandardMaterial({ color: '#507fb1', emissive: '#162738', emissiveIntensity: 0.17, roughness: 0.42 })
const mesh = new THREE.Mesh(new THREE.BoxGeometry(), original)
modelRoot.add(mesh)
const authored = { colour: original.color.toArray(), emissive: original.emissive.toArray(), intensity: original.emissiveIntensity }
const allocated = []
for (const colour of [null, '#454545', null, '#ff4fd8', null, '#454545', null]) {
  allocated.push(...runtime.applyModelMaterialSettings(modelRoot, null, colour))
  assert.deepEqual(mesh.material.color.toArray(), authored.colour, 'LOD on/off never bakes tint into colour')
  assert.deepEqual(mesh.material.emissive.toArray(), authored.emissive, 'LOD on/off never bakes glow into emissive')
  assert.equal(mesh.material.emissiveIntensity, authored.intensity)
  const shader = { vertexShader: THREE.ShaderLib.standard.vertexShader, fragmentShader: THREE.ShaderLib.standard.fragmentShader, uniforms: {} }
  mesh.material.onBeforeCompile(shader, {})
  assert.equal(shader.fragmentShader.includes('float debugLevel'), Boolean(colour), 'normal shader restored on every off path')
}
allocated.forEach(material => material.dispose()); original.dispose(); mesh.geometry.dispose()
const camera = new THREE.PerspectiveCamera(61, 16 / 9, 0.1, 200)
camera.position.set(0, -8, 80)
camera.lookAt(0, -8, 0)
camera.updateMatrixWorld()
const creature = { id: 'debug-sardine', species: 'amblygaster-sirm', biome: 'ocean', depthZone: 'epipelagic', size: 1, alive: true }
const originalRandom = Math.random
const snapshots = []
try {
  for (const options of [
    { debug: false },
    { debug: true, debugLayers: { heading: true } },
    { debug: true, debugLayers: { neighbors: true } },
    // Live rows may normalize the scientific slug to the display name.
    { debug: true, creature: { ...creature, species: 'Spotted Sardinella' } },
    { debug: true, debugLodView: true },
    { debug: true, debugForceDetail: true },
    { debug: true, selected: true, debugInspectorEnabled: true, debugLayers: { name: true } },
  ]) {
    for (const value of Object.values(h)) if (Array.isArray(value)) value.length = 0
    runtime.pruneFishRuntime([])
    Math.random = () => 0.5
    runtime.Fish({ creature, ...options })
    for (const effect of h.effects) { const cleanup = effect(); if (cleanup) h.cleanups.push(cleanup) }
    for (let frame = 1; frame <= 180; frame++) for (const fn of h.frames) fn({ camera, clock: { getElapsedTime: () => frame / 60 } }, 1 / 60)
    const lodRequests = h.setters.flatMap(s => s.values).filter(v => v === 'lod1' || v === 'lod2')
    assert.equal(lodRequests.length > 0, !options.selected, 'only ordinary selection suppresses distant LOD; removed forced-detail prop has no effect')
    if (options.debugLayers?.heading) {
      assert.ok(h.lines[0].visible, 'heading visible')
      assert.ok(h.lines.slice(1).every(line => !line.visible), 'heading does not enable steering/neighbours')
    }
    if (options.debugLayers?.neighbors) assert.equal(h.lines[0].visible, false, 'neighbours do not enable heading')
    const fish = h.groups.find(g => g.userData.inspectCreature)
    if (options.debugInspectorEnabled) {
      const snapshot = fish?.userData.inspectCreature()
      assert.equal(snapshot?.creatureId, creature.id, 'inspector identifies source to reject stale previous-fish refs')
      assert.ok(Number.isFinite(snapshot?.speed), 'inspector reads live speed')
      assert.equal(snapshot.steering.length, 3, 'selected steering is text-readable world XYZ')
      assert.ok(Object.values(snapshot.steeringForces).every(Number.isFinite), 'selected steering forces available')
      assert.equal(h.texts.length, 2, 'only speed and identity text exist in world space')
      assert.equal(h.texts.at(-1).visible, true, 'independent identity label visible')
    } else assert.equal(fish, undefined, 'no inspector publisher when closed')
    const positioned = h.groups.find(g => g.children.some(c => c.isMesh))
    if (!options.creature) snapshots.push(positioned.position.toArray())
    for (const cleanup of h.cleanups) cleanup()
    if (fish) assert.equal(fish.userData.inspectCreature, undefined, 'inspector cleanup releases getter')
    assert.equal(runtime.getSardineLod0Stats().candidates, 0, 'unmount clears LOD registry')
  }
  for (const snapshot of snapshots.slice(1)) assert.deepEqual(snapshot, snapshots[0], 'diagnostics/LOD overrides do not change motion')
  // PR review regression: unpaired mahi runs the solo path, regardless of old label eligibility.
  function orphanRun(inspect) {
    for (const value of Object.values(h)) if (Array.isArray(value)) value.length = 0
    runtime.pruneFishRuntime([])
    Math.random = () => 0.5
    runtime.Fish({ creature: { ...creature, id: 8888, species: 'coryphaena-hippurus' }, selected: true, debug: true, debugInspectorEnabled: inspect })
    for (const effect of h.effects) { const cleanup = effect(); if (cleanup) h.cleanups.push(cleanup) }
    const fish = h.groups.find(g => g.children.some(c => c.isMesh))
    const publisher = h.groups.find(g => g.userData.inspectCreature)
    const points = [], labels = []
    for (let frame = 1; frame <= 180; frame++) {
      for (const fn of h.frames) fn({ camera, clock: { getElapsedTime: () => frame / 60 } }, 1 / 60)
      points.push(fish.position.toArray())
      if (inspect) labels.push(publisher.userData.inspectCreature().behavior)
    }
    for (const cleanup of h.cleanups) cleanup()
    return { points, labels }
  }
  const plain = orphanRun(false), inspected = orphanRun(true)
  assert.deepEqual(inspected.points, plain.points, 'inspecting unpaired mahi does not change movement')
  assert.ok(inspected.labels.some(value => value !== 'cruise'), 'unpaired schooling species reports live solo behaviour, not initial label-only cruise')
} finally {
  Math.random = originalRandom
  delete globalThis[key]
}
console.log('actual Fish frame: normal/overlay/colour/removed-override/selected LOD, independent heading, inspector lifecycle and motion equivalence passed (180 frames each)')
