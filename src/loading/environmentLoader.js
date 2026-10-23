// Framework-independent scheduler. See docs/environment-loading.md for the UI contract.
// Asset readiness deliberately does NOT mean geometry/shaders/the first frame are ready.
export function createEnvironmentLoader({ environments, loadAsset, scheduleIdle, now = () => performance.now(),
  concurrency = 3, maxCachedBytes = 192 * 1024 * 1024, maxBackgroundBytes = 64 * 1024 * 1024,
  maxCachedAssets = 80, readGraceMs = 1000 } = {}) {
  const catalog = new Map(environments.map(env => [env.id, env]))
  if (catalog.size !== environments.length) throw new Error('Duplicate environment id')
  const definitions = new Map()
  for (const env of environments) for (const asset of env.assets) {
    const previous = definitions.get(asset.key)
    if (previous && (previous.url !== asset.url || previous.kind !== asset.kind)) throw new Error(`Conflicting asset: ${asset.key}`)
    definitions.set(asset.key, asset)
  }
  const entries = new Map()
  const listeners = new Set()
  const retirementListeners = new Set()
  const environmentKeys = id => new Set(catalog.get(id)?.assets.map(asset => asset.key) ?? [])
  let activeId = null
  let requestedId = null
  let recentId = null
  let prefetchId = null
  let phase = 'idle'
  let error = null
  let request = null
  let running = 0
  let idleCancel = null
  let closed = false
  let emitPending = false
  let backgroundEnabled = false
  let backgroundSpent = 0
  let snapshot

  function protectedEntry(entry) {
    return entry.pins > 0 || entry.readUntil > now() || environmentKeys(activeId).has(entry.asset.key)
      || environmentKeys(requestedId).has(entry.asset.key)
  }
  function residentBytes() {
    return [...entries.values()].reduce((sum, entry) => sum + (entry.result?.bytes ?? 0), 0)
  }
  function residentCount() {
    return [...entries.values()].filter(entry => entry.state === 'ready' || entry.state === 'loading').length
  }
  function snapshotOf() {
    const states = {}
    for (const [id, env] of catalog) {
      const loaded = env.assets.filter(asset => entries.get(asset.key)?.state === 'ready').length
      states[id] = Object.freeze({ id, loaded, total: env.assets.length,
        progress: env.assets.length ? loaded / env.assets.length : 1,
        assetsReady: loaded === env.assets.length })
    }
    return Object.freeze({ activeId, requestedId, phase, error, prefetchId,
      cachedBytes: residentBytes(), cachedAssets: residentCount(),
      // These are accounted source resources, NOT measured browser/GPU memory.
      overBudget: residentBytes() > maxCachedBytes || residentCount() > maxCachedAssets, environments: Object.freeze(states) })
  }
  function emit() {
    if (emitPending || closed) return
    emitPending = true
    queueMicrotask(() => {
      emitPending = false
      if (closed) return
      const next = snapshotOf()
      if (JSON.stringify(next) !== JSON.stringify(snapshot)) {
        snapshot = next
        for (const listener of listeners) listener()
      }
    })
  }
  function remove(entry) {
    if (entry.state === 'loading') return
    entries.delete(entry.asset.key)
    entry.result?.dispose?.()
  }
  function trim() {
    const keep = new Set([...environmentKeys(activeId), ...environmentKeys(requestedId),
      ...environmentKeys(recentId), ...environmentKeys(prefetchId)])
    const candidates = [...entries.values()].filter(entry => !protectedEntry(entry) && entry.state !== 'loading')
      .sort((a, b) => a.used - b.used)
    for (const entry of candidates) {
      if (!keep.has(entry.asset.key) || residentBytes() > maxCachedBytes || residentCount() > maxCachedAssets) remove(entry)
    }
    emit()
  }
  function priority(entry) {
    if (environmentKeys(requestedId).has(entry.asset.key)) return 3
    if (entry.pins || entry.readUntil > now() || environmentKeys(activeId).has(entry.asset.key)) return 2
    if (environmentKeys(prefetchId).has(entry.asset.key)) return 1
    return 0
  }
  function ensure(asset, foreground = false) {
    if (closed) throw new Error('Environment loader disposed')
    let entry = entries.get(asset.key)
    if (!entry) {
      let resolve
      const promise = new Promise(done => { resolve = done })
      entry = { asset, state: 'queued', result: null, error: null, pins: 0, readUntil: 0,
        used: now(), promise, resolve }
      entries.set(asset.key, entry)
    }
    if (foreground) entry.readUntil = now() + readGraceMs
    entry.used = now()
    return entry
  }
  function finishRequest() {
    if (!request || phase !== 'loading') return
    const env = catalog.get(requestedId)
    const failed = env.assets.map(asset => entries.get(asset.key)).find(entry => entry?.state === 'error')
    if (failed) {
      phase = 'error'
      error = failed.error?.message ?? String(failed.error)
      request.resolve({ id: requestedId, status: 'error', error })
      request = null
    } else if (env.assets.every(asset => entries.get(asset.key)?.state === 'ready')) {
      phase = 'assets-ready'
      request.resolve({ id: requestedId, status: 'assets-ready' })
      request = null
    }
    emit()
  }
  function start(entry, background) {
    entry.state = 'loading'
    entry.controller = new AbortController()
    entry.background = background
    if (background) backgroundSpent += entry.asset.estimatedBytes ?? 16 * 1024 * 1024
    running += 1
    emit()
    const beforeDecode = () => {
      if (!background || priority(entry) >= 2) return Promise.resolve()
      return new Promise((resolve, reject) => {
        let cancel
        const signal = entry.controller.signal
        const cleanup = () => { cancel?.(); signal.removeEventListener('abort', aborted); entry.promoteDecode = null }
        const done = () => { cleanup(); resolve() }
        const aborted = () => { cleanup(); reject(new Error('Decode preparation cancelled')) }
        const schedule = () => { cancel = scheduleIdle(() => {
          if (priority(entry) >= 2 || (backgroundEnabled && phase === 'ready')) done()
          else schedule()
        }) }
        entry.promoteDecode = done
        if (signal.aborted) { aborted(); return }
        signal.addEventListener('abort', aborted, { once: true })
        schedule()
      })
    }
    Promise.resolve().then(() => loadAsset(entry.asset, { signal: entry.controller.signal, beforeDecode })).then(result => {
      // A decode already in progress may not be interruptible. Never resurrect its retired entry.
      if (closed || entry.controller.signal.aborted || entries.get(entry.asset.key) !== entry) {
        result.dispose?.()
        entry.state = 'cancelled'
      } else {
        entry.result = result
        entry.state = 'ready'
        entry.used = now()
      }
    }, failure => {
      entry.state = entry.controller.signal.aborted ? 'cancelled' : 'error'
      entry.error = failure
    }).finally(() => {
      running -= 1
      entry.resolve()
      if (entry.state === 'cancelled' && entries.get(entry.asset.key) === entry) entries.delete(entry.asset.key)
      finishRequest()
      trim()
      pump()
    })
  }
  function pump() {
    if (closed) return
    finishRequest()
    const queued = [...entries.values()].filter(entry => entry.state === 'queued').sort((a, b) => priority(b) - priority(a))
    for (const entry of queued) {
      if (running >= concurrency || priority(entry) < 2) break
      start(entry, false)
    }
    if (running || idleCancel || !backgroundEnabled || !prefetchId || phase !== 'ready') return
    const candidate = queued.find(entry => priority(entry) === 1)
    if (!candidate) return
    const estimate = candidate.asset.estimatedBytes ?? 16 * 1024 * 1024
    // Conservative admission. Active/selected assets may exceed budgets; speculation may not.
    if (backgroundSpent + estimate > maxBackgroundBytes || residentBytes() + estimate > maxCachedBytes
      || residentCount() >= maxCachedAssets) return
    idleCancel = scheduleIdle(() => {
      idleCancel = null
      if (!closed && running === 0 && backgroundEnabled && phase === 'ready'
        && entries.get(candidate.asset.key) === candidate && candidate.state === 'queued' && priority(candidate) === 1) start(candidate, true)
      else pump()
    })
  }
  function cancelObsolete() {
    idleCancel?.()
    idleCancel = null
    for (const entry of [...entries.values()]) {
      if (priority(entry) > 1) continue
      if (entry.state === 'loading') entry.controller.abort()
      else if (entry.state === 'queued') { entries.delete(entry.asset.key); entry.resolve() }
    }
  }
  function retire(id) {
    if (id && id !== activeId && id !== requestedId) for (const listener of retirementListeners) listener(id)
  }

  snapshot = snapshotOf()
  return {
    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener) },
    getSnapshot: () => snapshot,
    onRetire(listener) { retirementListeners.add(listener); return () => retirementListeners.delete(listener) },
    select(id) {
      if (!catalog.has(id)) throw new Error(`Unknown environment: ${id}`)
      if (closed) throw new Error('Environment loader disposed')
      request?.resolve({ id: requestedId, status: 'cancelled' })
      requestedId = id
      prefetchId = null
      backgroundEnabled = false
      phase = 'loading'
      error = null
      let resolve
      const promise = new Promise(done => { resolve = done })
      request = { resolve }
      cancelObsolete()
      for (const asset of catalog.get(id).assets) {
        const previous = entries.get(asset.key)
        if (previous?.state === 'error') { remove(previous) }
        // An aborted decode may still finish. Replace it; the stale finalizer cannot touch this entry.
        if (previous?.controller?.signal.aborted) entries.delete(asset.key)
        previous?.promoteDecode?.()
        ensure(asset)
      }
      pump()
      emit()
      return promise
    },
    beginActivation(id) {
      if (requestedId === id && phase === 'assets-ready') { phase = 'activating'; emit(); return true }
      return false
    },
    markRendered(id) {
      if (id !== requestedId || !['assets-ready', 'activating'].includes(phase)) return false
      const retired = recentId
      recentId = activeId === id ? recentId : activeId
      activeId = id
      phase = 'ready'
      backgroundSpent = 0
      if (retired !== recentId) retire(retired)
      trim()
      return true
    },
    failActivation(id, failure) {
      if (id !== requestedId) return
      phase = 'error'
      error = failure?.message ?? String(failure)
      emit()
    },
    prefetch(id) {
      if (id !== null && !catalog.has(id)) throw new Error(`Unknown environment: ${id}`)
      prefetchId = id === activeId ? null : id
      cancelObsolete()
      if (prefetchId) for (const asset of catalog.get(prefetchId).assets) ensure(asset)
      trim()
      pump()
    },
    setBackgroundEnabled(enabled) {
      if (backgroundEnabled === enabled) return
      backgroundEnabled = enabled
      if (!enabled) { idleCancel?.(); idleCancel = null } else pump()
    },
    read(asset) {
      definitions.set(asset.key, asset)
      const entry = ensure(asset, true)
      if (entry.state === 'ready') return entry.result.value
      if (entry.state === 'error') throw entry.error
      pump()
      throw entry.promise
    },
    // Mounted consumers (including Atlas) lease shared sources. Never dispose a displayed asset.
    retain(assets) {
      const retained = assets.map(asset => ensure(asset))
      for (const entry of retained) entry.pins += 1
      pump()
      return () => { for (const entry of retained) entry.pins -= 1; trim(); pump() }
    },
    maintain() { trim(); pump() },
    dispose() {
      if (closed) return
      closed = true
      idleCancel?.()
      request?.resolve({ id: requestedId, status: 'cancelled' })
      for (const entry of entries.values()) {
        entry.controller?.abort()
        entry.result?.dispose?.()
        entry.resolve()
      }
      entries.clear()
      listeners.clear()
      retirementListeners.clear()
    },
  }
}
