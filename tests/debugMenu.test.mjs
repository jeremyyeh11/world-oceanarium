import assert from 'node:assert/strict'
import { build } from 'esbuild'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { CREATURES, TANKS } from '../src/data/species.js'
import { creaturesForTank } from '../src/utils/speciesLookup.js'
import { clearedDebugLayers, debugOverlayVisibility, reservePopulation, sardineReadout } from '../src/utils/debugMenu.js'

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
assert.equal(debugOverlayVisibility({ neighbors: true }, false, false).neighbors, false)
assert.deepEqual(sardineReadout({ lod0Drawn: 2, lod1Drawn: 4, instancedDrawn: 8, frustumCulled: 3, frustumCandidates: 17 }), { lod0: 2, lod1: 4, lod2: 8, culled: 3, candidates: 17 })
assert.deepEqual(sardineReadout({ lod0Drawn: NaN, lod1Drawn: -2 }), { lod0: 0, lod1: 0, lod2: 0, culled: 0, candidates: 0 })

const result = await build({ entryPoints: ['src/components/DebugPanel.jsx'], bundle: true, write: false, platform: 'node', format: 'esm', jsx: 'automatic', plugins: [{ name: 'react-file-urls', setup(b) { b.onResolve({ filter: /^react(\/jsx-runtime)?$/ }, args => ({ path: import.meta.resolve(args.path), external: true })) } }], define: { 'import.meta.env.DEV': 'false' } })
// Write neither a build output nor a test dependency into the app tree.
const { default: DebugPanel } = await import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`)
const props = { population: 103, totalCount: 110, section: 'creature', debugView: 'focused', debugLayers: cleared, debugSimulationSpeed: 1, forceDetail: false, audioLevels: {}, environmentLoading: { phase: 'active' } }
const html = renderToStaticMarkup(createElement(DebugPanel, props))
assert.match(html, /Select a creature to inspect/)
assert.doesNotMatch(html, /Bones|sun-bask|Override:/)
assert.match(html, /aria-pressed="true">Selected/)
assert.match(html, /data-debug-population="true">103/)
const molaHtml = renderToStaticMarkup(createElement(DebugPanel, { ...props, canQueueSunBask: true, selectedCreature: { id: 'mola', species: 'Mola alexandrini' } }))
assert.match(molaHtml, /Queue Mola sun-bask/)
const renderHtml = renderToStaticMarkup(createElement(DebugPanel, { ...props, section: 'render', forceDetail: true, debugSimulationSpeed: 4 }))
assert.match(renderHtml, /Sardines only/)
assert.match(renderHtml, /Override:/)
assert.match(renderHtml, /4x simulation/)
const dataHtml = renderToStaticMarkup(createElement(DebugPanel, { ...props, section: 'data', creatureDataSource: 'static', creatureDataError: { code: '503', message: 'offline' } }))
assert.match(dataHtml, /503: offline/)
console.log('debug menu population, independent layers, sardine counters, empty/contextual/override/error UI tests passed')
