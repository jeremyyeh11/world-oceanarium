import assert from 'node:assert/strict'
import { build } from 'esbuild'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { CREATURES, TANKS } from '../src/data/species.js'
import { creaturesForTank } from '../src/utils/speciesLookup.js'
import { clearedDebugLayers, debugOverlayVisibility, reservePopulation } from '../src/utils/debugMenu.js'

for (const tank of TANKS) {
  assert.equal(reservePopulation(CREATURES, tank, tank.biome), creaturesForTank(CREATURES, tank).length, tank.id)
  assert.equal(reservePopulation([...CREATURES, ...CREATURES.map(c => ({ ...c, alive: false }))], tank, tank.biome), creaturesForTank(CREATURES, tank).length)
}
const openSea = TANKS.find(t => t.id === 'open-sea')
assert.ok(reservePopulation(CREATURES, openSea, 'ocean') < reservePopulation(CREATURES, null, 'ocean'), 'reserve excludes other ocean casts')
const cleared = clearedDebugLayers()
assert.ok(Object.values(cleared).every(value => value === false))
assert.ok(!('bones' in cleared))
for (const id of Object.keys(cleared)) {
  const visibility = debugOverlayVisibility({ ...cleared, [id]: true }, true, true)
  assert.deepEqual(Object.keys(visibility).filter(key => visibility[key]), [id], `${id} is independent`)
}
assert.equal(debugOverlayVisibility({ neighbors: true }, false, false).neighbors, true, 'All scope includes schooling neighbours too')

const result = await build({ entryPoints: ['src/components/DebugPanel.jsx'], bundle: true, write: false, platform: 'node', format: 'esm', jsx: 'automatic', plugins: [{ name: 'react-file-urls', setup(b) { b.onResolve({ filter: /^react(\/jsx-runtime)?$/ }, args => ({ path: import.meta.resolve(args.path), external: true })) } }], define: { 'import.meta.env.DEV': 'false' } })
// Write neither a build output nor a test dependency into the app tree.
const { default: DebugPanel, DebugReadout, DebugDataStatus } = await import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`)
const props = { population: 103, totalCount: 110, section: 'creature', debugView: 'focused', debugLayers: cleared, debugSimulationSpeed: 1, environmentLoading: { phase: 'active' } }
const html = renderToStaticMarkup(createElement(DebugPanel, props))
assert.doesNotMatch(html, /Bones|sun-bask|Override:|Force sardine|>audio<|>data<|>scene<|>render</)
assert.match(html, /aria-pressed="true">Selected/)
assert.match(html, /data-debug-population="true">103/)
assert.match(html, />Heading \/ speed</)
assert.match(html, />Neighbours</)
assert.match(html, />Labels</)
assert.doesNotMatch(html, />Steering<|>Behaviour</)
assert.match(html, />Performance</)
const molaHtml = renderToStaticMarkup(createElement(DebugPanel, { ...props, canQueueSunBask: true }))
assert.match(molaHtml, /Queue Mola sun-bask/)
const performanceHtml = renderToStaticMarkup(createElement(DebugPanel, { ...props, section: 'performance', debugSimulationSpeed: 4 }))
assert.match(performanceHtml, /LOD colours — all GLBs/)
assert.match(performanceHtml, /LOD3 \/ min/)
assert.match(performanceHtml, /Single level/)
assert.match(performanceHtml, /4x simulation/)
const status = renderToStaticMarkup(createElement(DebugDataStatus, { source: 'static', totalCount: 110, population: 103, error: { code: 503, message: 'offline' } }))
assert.match(status, /Data: static · 110 total · 103 reserve · 503: offline/)
assert.match(status, /data-debug-data/)
const overlay = renderToStaticMarkup(createElement(DebugReadout, { showPerformance: true }))
assert.match(overlay, /Select a creature to inspect/)
assert.match(overlay, /FPS unavailable/)
assert.match(overlay, /CPU frame unavailable/)
assert.match(overlay, /GPU unavailable/)
assert.match(overlay, /JS heap unavailable/)
assert.match(overlay, /Draw calls unavailable/)
const selected = renderToStaticMarkup(createElement(DebugReadout, { selectedCreature: CREATURES[0], showPerformance: true, performanceStats: { fps: 48.1, cpuMs: 4.123, calls: 251, gpuMs: null } }))
assert.match(selected, /Steering target \(world XYZ\)/)
assert.match(selected, /Behaviour/)
assert.match(selected, /FPS 48.1/)
assert.match(selected, /CPU frame 4.12/)
assert.match(selected, /Draw calls 251/)
console.log('debug menu: 3 independent creature controls, 2 sections, contextual action, all-GLB legend, top-left selected/performance/unavailable UI passed')
