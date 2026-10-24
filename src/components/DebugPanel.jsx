import { useEffect, useState } from 'react'
import { APP_VERSION_SHORT_LABEL } from '../version'
import { LEVEL_FLOOR_DB } from '../hooks/useOceanAudio'
import { DEBUG_LAYERS, DEBUG_SECTIONS, sardineReadout } from '../utils/debugMenu'
import { resolveSpecies } from '../utils/speciesLookup'

export default function DebugPanel({ population, totalCount, selectedCreature, fishRef, section, onSectionChange, debugView, debugLayers, debugSimulationSpeed, forceDetail, performanceStats, sceneStats, environmentLoading, audioLevels, creatureDataSource, creatureDataError, canQueueSunBask, onDebugViewChange, onDebugLayerToggle, onDebugSimulationSpeedChange, onForceDetailChange, onQueueSunBask, onReset, onExit }) {
  const sardines = sardineReadout(performanceStats)
  const toggleSection = id => onSectionChange(section === id ? null : id)
  return (
    <div className="debug-panel debug-panel--floating" role="region" aria-label="Debug menu">
      <div className="debug-summary">
        <span>Reserve <strong data-debug-population>{population}</strong></span>
        <span title="Browser animation callbacks per second; not GPU completion or a phone benchmark">RAF <strong>{performanceStats?.fps ?? '—'}</strong>/s</span>
        {(forceDetail || debugSimulationSpeed !== 1) && <span className="debug-warning">Override: {forceDetail ? 'full sardine detail ' : ''}{debugSimulationSpeed !== 1 ? `${debugSimulationSpeed}x simulation` : ''}</span>}
        <span className="debug-version">{APP_VERSION_SHORT_LABEL}</span>
        <button type="button" className="debug-panel-button" onClick={onReset}>Reset</button>
        <button type="button" className="debug-panel-button" onClick={onExit}>Exit</button>
      </div>
      <div className="debug-tabs" aria-label="Diagnostic sections">
        {DEBUG_SECTIONS.map(id => <button key={id} type="button" className="debug-panel-button" aria-expanded={section === id} aria-controls={`debug-${id}`} onClick={() => toggleSection(id)}>{id}</button>)}
      </div>
      {section === 'creature' && <div id="debug-creature" className="debug-detail">
        <div className="debug-panel-row" aria-label="Overlay scope">
          <span className="debug-panel-label">Scope</span>
          <Toggle label="Selected" active={debugView === 'focused'} onClick={() => onDebugViewChange('focused')} />
          <Toggle label="All" active={debugView === 'all'} onClick={() => onDebugViewChange('all')} />
        </div>
        <div className="debug-panel-row" aria-label="Creature overlays">
          {DEBUG_LAYERS.map(layer => <Toggle key={layer.id} label={layer.label} active={debugLayers[layer.id]} onClick={() => onDebugLayerToggle(layer.id)} />)}
        </div>
        <p className="debug-note">Steering and neighbours: selected creature or solitary agents. Overlays add drawing cost; they do not force detail.</p>
        {selectedCreature ? <CreatureInspector key={selectedCreature.id} creature={selectedCreature} fishRef={fishRef} /> : <p>Select a creature to inspect.</p>}
        {canQueueSunBask && <button type="button" className="debug-panel-button" onClick={onQueueSunBask}>Queue Mola sun-bask</button>}
      </div>}
      {section === 'render' && <div id="debug-render" className="debug-detail">
        <p><strong>Sardines only</strong> · drawn LOD 0 / 1 / 2: <span data-debug-lod>{sardines.lod0} / {sardines.lod1} / {sardines.lod2}</span></p>
        <p>Point-frustum culled: {sardines.culled} / {sardines.candidates} sardines</p>
        <p className="debug-note">Registry submissions, not a full-scene visibility count. Selection uses normal close-up detail. Forced detail bypasses sardine point culling.</p>
        <div className="debug-panel-row">
          <Toggle label="Sardine LOD colours" active={debugLayers.lod} onClick={() => onDebugLayerToggle('lod')} />
          <Toggle label="Force sardine detail" active={forceDetail} onClick={() => onForceDetailChange(!forceDetail)} />
        </div>
        <div className="debug-panel-row" aria-label="Soak-test simulation speed"><span>Soak test</span>{[1, 4, 10].map(speed => <Toggle key={speed} label={`${speed}x`} active={debugSimulationSpeed === speed} onClick={() => onDebugSimulationSpeedChange(speed)} />)}</div>
        <p className="debug-note">Overrides change the workload. RAF/s is browser callback cadence, not GPU timing.</p>
      </div>}
      {section === 'scene' && <div id="debug-scene" className="debug-detail">
        <p>Environment: {environmentLoading.activeId ?? '—'} · {environmentLoading.phase}</p>
        <p>Renderer calls: {sceneStats?.calls ?? '—'} · triangles: {sceneStats?.triangles ?? '—'}</p>
        <p>Resident geometries: {sceneStats?.geometries ?? '—'} · textures: {sceneStats?.textures ?? '—'} · DPR: {sceneStats?.dpr ?? '—'}</p>
        <p className="debug-note">Previous renderer pass snapshot; transmission/multipass work may not be included. Resource counts are not memory bytes.</p>
      </div>}
      {section === 'audio' && <div id="debug-audio" className="debug-detail">
        <p>Audio dB{audioLevels.muted ? ' · muted' : ''}</p>
        {['overall', 'ambient', 'sfx'].map(id => <p key={id}>{id}: {formatDb(audioLevels[`${id}Db`])}</p>)}
      </div>}
      {section === 'data' && <div id="debug-data" className="debug-detail">
        <p>Source: {creatureDataSource} · loaded rows: {totalCount} · reserve population: {population}</p>
        {creatureDataError && <p className="debug-warning">{creatureDataError.code ? `${creatureDataError.code}: ` : ''}{creatureDataError.message ?? String(creatureDataError)}</p>}
        <p className="debug-note">Population uses this reserve's species filter and living rows; not animals visible on screen.</p>
      </div>}
      {creatureDataError && section !== 'data' && <button type="button" className="debug-panel-button debug-warning" onClick={() => onSectionChange('data')}>Data warning — inspect</button>}
    </div>
  )
}

function Toggle({ label, active, onClick }) {
  return <button type="button" className="debug-panel-button" aria-pressed={Boolean(active)} onClick={onClick}>{label}</button>
}

function CreatureInspector({ creature, fishRef }) {
  const [snapshot, setSnapshot] = useState(null)
  useEffect(() => {
    const sample = () => setSnapshot(fishRef?.current?.userData.inspectCreature?.() ?? null)
    sample()
    const timer = window.setInterval(sample, 500)
    return () => window.clearInterval(timer)
  }, [fishRef])
  const species = resolveSpecies(creature)
  return <div className="debug-inspector" aria-label="Selected creature inspection">
    <p>{creature.id} · {creature.customName || species?.name || creature.species}{species?.scientificName ? ` · ${species.scientificName}` : ''}</p>
    <p>Speed: {Number.isFinite(snapshot?.speed) ? `${snapshot.speed.toFixed(2)} m/s` : '—'} · behaviour: {snapshot?.behavior ?? '—'}</p>
    {snapshot?.queued && <p>Queued: {snapshot.queued}</p>}
    {snapshot?.school && <p>School: {snapshot.school}</p>}
    {snapshot?.host != null && <p>Host: {snapshot.host}</p>}
    {snapshot?.reef && <p>Reef: {snapshot.reef}</p>}
  </div>
}

function formatDb(value) {
  return !Number.isFinite(value) || value <= LEVEL_FLOOR_DB + 0.5 ? '−∞ dB' : `${Math.round(value)} dB`
}
