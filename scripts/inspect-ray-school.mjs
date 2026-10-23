// Run Fish.jsx's real movement frame with rendering/audio stubbed out. No copied integrator.
// Usage: node scripts/inspect-ray-school.mjs [seconds=300] [seed=0] [--verify]
// Fixed 60 Hz, mixed tank sizes, empty obstacle field. Rendering and real-device FPS
// still need browser review; this checks the actual movement frame, not GPU motion.
import assert from 'node:assert/strict'
import * as THREE from 'three'
import { build } from 'esbuild'
import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'
import { resolve } from 'node:path'
const require = createRequire(import.meta.url)
const seconds = Number(process.argv[2] ?? 300)
const seed = process.argv[3] ?? '0'
const verify = process.argv.includes('--verify') || Boolean(process.env.RAY_ASSERT)
assert.ok(Number.isFinite(seconds) && seconds > 0, 'provide positive simulation seconds')
const state = { frames: [], effects: [], cleanups: [], owner: null }
const key = '__rayFrameHarness'
globalThis[key] = state
state.useRef = value => ({ current: value })
state.useMemo = fn => fn()
state.useState = value => [typeof value === 'function' ? value() : value, () => {}]
state.useEffect = fn => state.effects.push(fn)
state.useFrame = fn => state.frames.push({ fn, id: state.owner })
state.jsx = (type, props, ...children) => {
  if (typeof type !== 'string' || (type !== 'group' && type !== 'mesh')) return null
  const object = type === 'mesh' ? new THREE.Mesh() : new THREE.Group()
  if (props?.ref) props.ref.current = object
  if (props?.visible != null) object.visible = props.visible
  if (props?.userData) object.userData = props.userData
  if (props?.scale != null) typeof props.scale === 'number' ? object.scale.setScalar(props.scale) : object.scale.fromArray(props.scale)
  if (props?.position) object.position.fromArray(props.position)
  for (const child of children.flat(Infinity)) if (child?.isObject3D) object.add(child)
  return object
}
const result = await build({
  stdin: { contents: `export {default as Fish} from './src/components/Fish.jsx'; export * from './src/components/fishSwim.js'; export {SPECIES} from './src/data/species.js';`, resolveDir: resolve('.') },
  bundle: true, write: false, format: 'esm', platform: 'node', target: 'node22',
  jsxFactory: '__rayJSX', jsxFragment: '__rayFragment',
  banner: { js: `const __rayJSX=globalThis.${key}.jsx; const __rayFragment=Symbol('fragment');` },
  define: { 'import.meta.env.DEV': 'false' },
  plugins: [{ name: 'renderless-fish-frame', setup(build) {
    build.onResolve({ filter: /^(three)(\/.*)?$/ }, args => ({ path: pathToFileURL(require.resolve(args.path)).href, external: true }))
    build.onResolve({ filter: /^(react|@react-three\/fiber|@react-three\/drei)$|\/hooks\/(useEnvironmentLoading|useOceanAudio)$|^\.\/WaterSurface$/ }, args => ({ path: args.path, namespace: 'frame-stub' }))
    build.onLoad({ filter: /.*/, namespace: 'frame-stub' }, args => {
      if (args.path === 'react') return { contents: `const h=globalThis.${key}; export const useRef=h.useRef,useMemo=h.useMemo,useState=h.useState,useEffect=h.useEffect;` }
      if (args.path === '@react-three/fiber') return { contents: `export const useFrame=globalThis.${key}.useFrame;` }
      if (args.path === '@react-three/drei') return { contents: `export const Billboard=()=>null,Text=()=>null,useAnimations=()=>({actions:{}});` }
      if (args.path.endsWith('useOceanAudio')) return { contents: 'export const triggerFishSwimSound=()=>{};' }
      if (args.path.endsWith('WaterSurface')) return { contents: 'export const SURFACE_PLANE_Y=4.6;' }
      return { contents: 'export const useEnvironmentGLTF=()=>{throw new Error("Rendering should not execute in frame test")};' }
    })
  }}],
})
const runtime = await import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`)
const species = runtime.SPECIES.find(s => s.id === 'mobula-munkiana')
// Fix only the non-seeded debug-decision jitter for repeatable sampling cadence.
let randomState = 12345
Math.random = () => ((randomState = Math.imul(randomState, 1664525) + 1013904223 >>> 0) / 4294967296)
const creatures = Array.from({ length: 60 }, (_, index) => ({ id: String(464 + index), species: species.id, biome: 'ocean', depthZone: 'epipelagic', size: 0.65 + (index * 0.61803398875 % 1) * 0.2 }))
const schoolId = `ray-runtime-${seed}`
for (let index = 0; index < creatures.length; index++) {
  state.owner = creatures[index].id
  runtime.Fish({ creature: creatures[index], school: { id: schoolId, index, count: creatures.length } })
}
for (const effect of state.effects) { const cleanup = effect(); if (typeof cleanup === 'function') state.cleanups.push(cleanup) }
const camera = new THREE.PerspectiveCamera(60, 16 / 9, 0.1, 1000)
camera.position.set(0, -24, 24); camera.lookAt(0, -7, -20); camera.updateMatrixWorld()
let elapsed = 0
const clock = { getElapsedTime: () => elapsed }
const school = runtime.getSchoolState({ id: schoolId, count: 60 }, creatures[0], runtime.resolveSwimProfile(creatures[0]))
const initialOffsets = new Map()
function sample() {
  const entries = []
  runtime.forEachFish(entry => { if (entry.schoolId === schoolId) entries.push(entry) })
  assert.equal(entries.length, creatures.length, 'every ray publishes its movement frame')
  const centroid = new THREE.Vector3()
  for (const entry of entries) centroid.add(entry.position)
  centroid.multiplyScalar(1 / entries.length)
  const forward = school.migrationDir.clone()
  const right = new THREE.Vector3(forward.z, 0, -forward.x).normalize()
  const cloud = species.swim.schoolFormation
  const bounds = runtime.swimBounds('epipelagic', runtime.resolveSwimProfile(creatures[0]), creatures[0].size)
  let x = 0, y = 0, z = 0, relativeMotion = 0
  let near = 0, min = Infinity, wall = 0, minPair = null
  let speedLo = Infinity, speedHi = 0
  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i]
    const offset = entry.position.clone().sub(centroid)
    x += offset.dot(right) ** 2
    y += offset.y ** 2
    z += offset.dot(forward) ** 2
    if (!initialOffsets.has(entry.object)) initialOffsets.set(entry.object, offset.clone())
    relativeMotion += offset.distanceToSquared(initialOffsets.get(entry.object))
    speedLo = Math.min(speedLo, entry.speed)
    speedHi = Math.max(speedHi, entry.speed)
    const { xMin, xMax } = runtime.swimXRangeAtZ(bounds, entry.position.z)
    if (entry.position.x < xMin + 0.05 || entry.position.x > xMax - 0.05
      || entry.position.y < bounds.yMin + 0.05 || entry.position.y > bounds.yMax - 0.05
      || entry.position.z < bounds.zMin + 0.05 || entry.position.z > bounds.zMax - 0.05) wall++
    for (let j = 0; j < i; j++) {
      const other = entries[j]
      const dx = entry.position.x - other.position.x
      const dy = entry.position.y - other.position.y
      const dz = entry.position.z - other.position.z
      // Mixed-size rays need their pair's width and actual heading, not the goal
      // heading or the largest possible ray. This is an ellipsoid, not a sphere.
      const width = (entry.bodyLength + other.bodyLength) * 0.5 * (cloud.spacingScale ?? 1)
      const hx = entry.forward.x + other.forward.x
      const hz = entry.forward.z + other.forward.z
      const h = Math.max(1e-6, Math.hypot(hx, hz))
      const lateral = (dx * hz - dz * hx) / (h * width * cloud.lateralBodyLengths)
      const longitudinal = (dx * hx + dz * hz) / (h * width * cloud.longitudinalBodyLengths)
      const vertical = dy / (width * cloud.verticalBodyLengths)
      const distance = Math.hypot(lateral, longitudinal, vertical)
      if (distance < min) {
        min = distance
        minPair = [creatures[i].id, creatures[j].id]
      }
      if (distance < 0.65) near++
    }
  }
  return {
    seconds: Math.round(elapsed),
    spread: [x, y, z].map(value => +Math.sqrt(value / entries.length).toFixed(2)),
    minPair, tightPairs: near, minClearance: +min.toFixed(3), wall,
    relativeMotion: +Math.sqrt(relativeMotion / entries.length).toFixed(3),
    speed: [+speedLo.toFixed(2), +speedHi.toFixed(2)],
    centroid: centroid.toArray().map(value => +value.toFixed(1)),
  }
}
const samples = []
for(let frame=0;frame<=seconds*60;frame++){
  elapsed=frame/60
  for(const {fn} of state.frames)fn({clock,camera},1/60)
  if(frame%60===0) samples.push(sample())
  if(frame%1800===0 && !verify && !process.env.RAY_SUMMARY_ONLY) console.log(JSON.stringify(samples.at(-1)))
}
const first = samples[0]
const summary = {
  seed, seconds,
  initialSpread: first.spread,
  minSpread: [0,1,2].map(axis => Math.min(...samples.map(s=>s.spread[axis]))),
  maxSpread: [0,1,2].map(axis => Math.max(...samples.map(s=>s.spread[axis]))),
  minClearance: Math.min(...samples.map(s=>s.minClearance)),
  maxTightPairs: Math.max(...samples.map(s=>s.tightPairs)),
  maxWall: Math.max(...samples.map(s=>s.wall)),
  firstWall: samples.find(s=>s.wall>0),
  maxRelativeMotion: Math.max(...samples.map(s=>s.relativeMotion)),
  closest: samples.reduce((a,b)=>a.minClearance<b.minClearance?a:b),
}
console.log(JSON.stringify({summary}))
if(verify) {
  assert.equal(summary.maxTightPairs,0,'no close-pair cluster develops during the runtime soak')
  assert.equal(summary.maxWall,0,'the whole school turns before a member hits a swim bound')
  assert.ok(summary.maxRelativeMotion > 0.2, 'individuals drift relative to the school, not in a rigid formation')
  assert.ok(summary.maxRelativeMotion < 3, 'individual drift stays bounded')
  assert.ok(summary.minClearance>=0.75,'pairwise wing-clearance distance stays at least 75% of its target')
  for(let axis=0;axis<3;axis++) {
    assert.ok(summary.minSpread[axis]>=first.spread[axis]*0.7, 'school does not collapse into rows')
    assert.ok(summary.maxSpread[axis]<=first.spread[axis]*1.4, 'school does not disperse across the reserve')
  }
}
for(const cleanup of state.cleanups)cleanup()
delete globalThis[key]
