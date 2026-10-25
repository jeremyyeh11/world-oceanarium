import { useEffect, useState } from 'react'
import { APP_VERSION_SHORT_LABEL } from '../version'
import { DEBUG_LAYERS, DEBUG_SECTIONS } from '../utils/debugMenu'
import { LOD_DEBUG_COLORS } from '../utils/lodDebug'
import { resolveSpecies } from '../utils/speciesLookup'

const number = (value, places = 0) => Number.isFinite(value) ? value.toFixed(places) : 'unavailable'
const duration = value => Number.isFinite(value) ? `${value.toFixed(2)} ms` : 'unavailable'

export function DebugDataStatus({ loading, source, totalCount, population, error }) {
  const message = `Data: ${loading ? 'loading' : source} · ${totalCount} total · ${population} reserve${error ? ` · ${error.code ?? 'ERR'}: ${error.message ?? String(error)}` : ''}`
  return <div className="debug-topbar" data-debug-data title={message}>{message}</div>
}

export function DebugReadout({ selectedCreature, fishRef, performanceStats }) {
  const [snapshot, setSnapshot] = useState(null)
  useEffect(() => {
    const sample = () => {
      const next = fishRef?.current?.userData.inspectCreature?.()
      setSnapshot(next && String(next.creatureId) === String(selectedCreature?.id) ? next : null)
    }
    sample()
    const timer = window.setInterval(sample, 500)
    return () => window.clearInterval(timer)
  }, [fishRef, selectedCreature?.id])
  const species = selectedCreature && resolveSpecies(selectedCreature)
  return <aside className="debug-readout" aria-label="Live debug readout" data-debug-readout>
    {selectedCreature ? <>
      <div>{selectedCreature.customName || species?.name || selectedCreature.species} · #{selectedCreature.id}</div>
      <div>Speed {number(snapshot?.speed, 2)} m/s · Behaviour {snapshot?.behavior ?? 'sampling…'}</div>
      <div>Steering target (world XYZ): {snapshot?.steering?.map(v => number(v, 2)).join(', ') ?? 'sampling…'}</div>
      {snapshot?.steeringForces && <div>Steer: sep {number(snapshot.steeringForces.separation, 2)} · align {number(snapshot.steeringForces.alignment, 2)} · coh {number(snapshot.steeringForces.cohesion, 2)} · threat {number(snapshot.steeringForces.threat, 2)} · out {number(snapshot.steeringForces.result, 2)}</div>}
      {snapshot?.school != null && <div>School {snapshot.school}</div>}
      {snapshot?.host != null && <div>Host #{snapshot.host}</div>}
      {snapshot?.reef && <div>Reef {snapshot.reef}</div>}
      {snapshot?.queued && <div>Queued: {snapshot.queued}</div>}
    </> : <div>Select a creature to inspect.</div>}
    <div className="debug-performance-readout">
      <div>FPS {number(performanceStats?.fps, 1)} · Frame {number(performanceStats?.frameMs, 1)} ms</div>
      <div>CPU frame {duration(performanceStats?.cpuMs)} · GPU {duration(performanceStats?.gpuMs)}</div>
      <div>JS heap {number(performanceStats?.heapMB, 1)} MB · Draw calls {number(performanceStats?.calls)}</div>
      <div>Triangles {number(performanceStats?.triangles)} · DPR {number(performanceStats?.dpr, 2)}</div>
      <div>Geometries {number(performanceStats?.geometries)} · Textures {number(performanceStats?.textures)}</div>
    </div>
  </aside>
}

export default function DebugPanel({ population, section, onSectionChange, debugView, debugLayers, debugSimulationSpeed, environmentLoading, canQueueSunBask, onDebugViewChange, onDebugLayerToggle, onDebugSimulationSpeedChange, onQueueSunBask, onReset, onExit }) {
  function onTabKeyDown(event) {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
    event.preventDefault()
    const current = DEBUG_SECTIONS.indexOf(section)
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? DEBUG_SECTIONS.length - 1
      : (current + (event.key === 'ArrowRight' ? 1 : -1) + DEBUG_SECTIONS.length) % DEBUG_SECTIONS.length
    onSectionChange(DEBUG_SECTIONS[next])
    event.currentTarget.querySelector(`#debug-tab-${DEBUG_SECTIONS[next]}`)?.focus()
  }
  return <div className="debug-panel debug-panel--floating" role="region" aria-label="Debug menu">
    <div className="debug-summary">
      <span>Reserve <strong data-debug-population>{population}</strong></span>
      {debugSimulationSpeed !== 1 && <span className="debug-warning">Override: {debugSimulationSpeed}x simulation</span>}
      <span className="debug-version">{APP_VERSION_SHORT_LABEL}</span>
      <button type="button" className="debug-panel-button" onClick={onReset}>Reset</button>
      <button type="button" className="debug-panel-button" onClick={onExit}>Exit</button>
    </div>
    <div className="debug-tabs" role="tablist" aria-label="Diagnostic sections" onKeyDown={onTabKeyDown}>{DEBUG_SECTIONS.map(id => <button type="button" key={id} id={`debug-tab-${id}`} role="tab" className="debug-tab" aria-selected={section === id} tabIndex={section === id ? 0 : -1} aria-controls={`debug-${id}`} onClick={() => onSectionChange(id)}>{id === 'creature' ? 'Creatures' : 'Performance'}</button>)}</div>
    <div id="debug-creature" role="tabpanel" aria-labelledby="debug-tab-creature" tabIndex={0} hidden={section !== 'creature'} className="debug-detail">
      <div className="debug-panel-row" aria-label="Overlay scope"><span>Scope</span><Toggle label="Selected" active={debugView === 'focused'} onClick={() => onDebugViewChange('focused')} /><Toggle label="All" active={debugView === 'all'} onClick={() => onDebugViewChange('all')} /></div>
      <div className="debug-panel-row" aria-label="Creature overlays">{DEBUG_LAYERS.map(({ id, label }) => <Toggle key={id} label={label} active={debugLayers[id]} onClick={() => onDebugLayerToggle(id)} />)}</div>
      <p className="debug-note">Steering and behaviour describe only the selected creature, in the top-left readout.</p>
      {canQueueSunBask && <button type="button" className="debug-panel-button" onClick={onQueueSunBask}>Queue Mola sun-bask</button>}
    </div>
    <div id="debug-performance" role="tabpanel" aria-labelledby="debug-tab-performance" tabIndex={0} hidden={section !== 'performance'} className="debug-detail">
      <Toggle label="LOD colours — all GLBs" active={debugLayers.lod} onClick={() => onDebugLayerToggle('lod')} />
      <div className="debug-lod-legend">{['LOD0 / high', 'LOD1 / low', 'LOD2 / far', 'LOD3 / min', 'Single level'].map((label, i) => <span key={label}><i style={{ backgroundColor: LOD_DEBUG_COLORS[i] }} />{label}</span>)}</div>
      <p className="debug-note">Actual drawn tier, including rocks/corals. Single level = no LOD switch.</p>
      <p className="debug-note">CPU/GPU = frame ms, not utilisation. JS heap ≠ device RAM. Unsupported measurements say unavailable.</p>
      <p className="debug-note">Environment {environmentLoading?.activeId ?? '—'} · {environmentLoading?.phase ?? 'unknown'}{environmentLoading?.error && ` · ${environmentLoading.error.message}`}</p>
      <details className="debug-advanced"><summary>Advanced soak test</summary><div className="debug-panel-row">{[1, 4, 10].map(speed => <Toggle key={speed} label={`${speed}x`} active={debugSimulationSpeed === speed} onClick={() => onDebugSimulationSpeedChange(speed)} />)}</div></details>
    </div>
  </div>
}

function Toggle({ label, active, onClick }) {
  return <button type="button" className="debug-panel-button" aria-pressed={Boolean(active)} onClick={onClick}>{label}</button>
}
