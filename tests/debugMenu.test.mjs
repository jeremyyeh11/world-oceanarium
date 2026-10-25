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
assert.match(html, /role="tablist"/)
assert.match(html, /id="debug-tab-creature" role="tab" class="debug-tab" aria-selected="true" tabindex="0"/)
assert.match(html, /id="debug-tab-performance" role="tab" class="debug-tab" aria-selected="false" tabindex="-1"/)
assert.match(html, /id="debug-creature" role="tabpanel" aria-labelledby="debug-tab-creature" tabindex="0" class=/)
assert.match(html, /id="debug-performance" role="tabpanel" aria-labelledby="debug-tab-performance" tabindex="0" hidden=""/)
assert.doesNotMatch(html, /aria-expanded=/)
// Exercise the real tab handlers, not a duplicate navigation implementation.
for (const [section, key, expected] of [
  ['creature', 'ArrowRight', 'performance'], ['creature', 'ArrowLeft', 'performance'],
  ['performance', 'ArrowRight', 'creature'], ['performance', 'ArrowLeft', 'creature'],
  ['performance', 'Home', 'creature'], ['creature', 'End', 'performance'],
]) {
  let changed, focused, prevented = false
  const tree = DebugPanel({ ...props, section, onSectionChange: next => { changed = next } })
  const tablist = tree.props.children.find(child => child?.props?.role === 'tablist')
  tablist.props.onKeyDown({ key, preventDefault: () => { prevented = true }, currentTarget: { querySelector: selector => ({ focus: () => { focused = selector } }) } })
  assert.equal(changed, expected); assert.equal(focused, `#debug-tab-${expected}`); assert.equal(prevented, true)
  changed = undefined
  tablist.props.onKeyDown({ key: 'Tab' })
  assert.equal(changed, undefined, 'normal Tab key is not intercepted')
  tablist.props.children.find(tab => tab.props.id === `debug-tab-${section}`).props.onClick()
  assert.equal(changed, section, 'clicking active tab does not collapse either panel')
}
for (const section of ['creature', 'performance']) {
  const tree = DebugPanel({ ...props, section })
  const children = tree.props.children.filter(Boolean)
  assert.equal(children.at(-1).props.role, 'tablist', 'tabs are last, below both content panels')
  assert.deepEqual(children.slice(1, -1).map(child => child.props.role), ['tabpanel', 'tabpanel'])
  const markup = renderToStaticMarkup(createElement(DebugPanel, { ...props, section }))
  assert.ok(markup.lastIndexOf('role="tablist"') > markup.lastIndexOf('role="tabpanel"'), 'rendered DOM order follows bottom-tab visual order')
}
const molaHtml = renderToStaticMarkup(createElement(DebugPanel, { ...props, canQueueSunBask: true }))
assert.match(molaHtml, /Queue Mola sun-bask/)
const performanceHtml = renderToStaticMarkup(createElement(DebugPanel, { ...props, section: 'performance', debugSimulationSpeed: 4 }))
assert.match(performanceHtml, /LOD colours — all GLBs/)
assert.match(performanceHtml, /LOD3 \/ min/)
assert.match(performanceHtml, /Single level/)
assert.match(performanceHtml, /4x simulation/)
assert.match(performanceHtml, /id="debug-tab-performance" role="tab" class="debug-tab" aria-selected="true" tabindex="0"/)
assert.match(performanceHtml, /id="debug-creature" role="tabpanel" aria-labelledby="debug-tab-creature" tabindex="0" hidden=""/)
const status = renderToStaticMarkup(createElement(DebugDataStatus, { source: 'static', totalCount: 110, population: 103, error: { code: 503, message: 'offline' } }))
assert.match(status, /Data: static · 110 total · 103 reserve · 503: offline/)
assert.match(status, /data-debug-data/)
const overlay = renderToStaticMarkup(createElement(DebugReadout))
assert.match(overlay, /Select a creature to inspect/)
assert.match(overlay, /FPS unavailable/)
assert.match(overlay, /CPU frame unavailable/)
assert.match(overlay, /GPU unavailable/)
assert.match(overlay, /JS heap unavailable/)
assert.match(overlay, /Draw calls unavailable/)
const selected = renderToStaticMarkup(createElement(DebugReadout, { selectedCreature: CREATURES[0], performanceStats: { fps: 48.1, cpuMs: 4.123, calls: 251, gpuMs: null } }))
assert.match(selected, /Steering target \(world XYZ\)/)
assert.match(selected, /Behaviour/)
assert.match(selected, /FPS 48.1/)
assert.match(selected, /CPU frame 4.12/)
assert.match(selected, /Draw calls 251/)
console.log('debug menu: 3 independent creature controls, 2 sections, contextual action, all-GLB legend, top-left selected/performance/unavailable UI passed')
