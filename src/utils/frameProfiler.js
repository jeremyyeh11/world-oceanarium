// GPU duration, not GPU utilisation. At most one pending query; never block for a result.
export function createGpuTimer(gl) {
  const ext = gl.getExtension('EXT_disjoint_timer_query_webgl2')
  if (!ext) return { begin() {}, end() {}, poll: () => null, dispose() {} }
  let pending = null
  let active = false
  let latest = null
  return {
    begin() {
      if (pending || gl.isContextLost() || gl.getQuery(ext.TIME_ELAPSED_EXT, gl.CURRENT_QUERY)) return
      pending = gl.createQuery()
      if (!pending) return
      gl.beginQuery(ext.TIME_ELAPSED_EXT, pending)
      active = true
    },
    end() {
      if (active && !gl.isContextLost()) gl.endQuery(ext.TIME_ELAPSED_EXT)
      active = false
    },
    poll() {
      if (gl.isContextLost()) { pending = null; latest = null; return null }
      if (gl.getParameter(ext.GPU_DISJOINT_EXT)) {
        if (pending && !active) { gl.deleteQuery(pending); pending = null }
        latest = null
        return null
      }
      if (pending && !active && gl.getQueryParameter(pending, gl.QUERY_RESULT_AVAILABLE)) {
        latest = gl.getQueryParameter(pending, gl.QUERY_RESULT) / 1e6
        gl.deleteQuery(pending)
        pending = null
      }
      return latest
    },
    dispose() {
      if (active && !gl.isContextLost()) gl.endQuery(ext.TIME_ELAPSED_EXT)
      if (pending && !gl.isContextLost()) gl.deleteQuery(pending)
      pending = null
      active = false
      latest = null
    },
  }
}

// Only frames actually submitted by this Canvas count (not a second browser RAF loop).
// CPU duration includes synchronous R3F callbacks and render submission, not async work or %.
export function createFrameMeter(now = () => performance.now()) {
  let since = now()
  let start = since
  let frames = 0
  let cpu = 0
  let rendered = false
  return {
    begin() { start = now(); rendered = false },
    markRendered() { rendered = true },
    end() {
      if (!rendered) return null
      frames++
      cpu += now() - start
      const elapsed = now() - since
      if (elapsed < 1000) return null
      const result = { fps: frames * 1000 / elapsed, frameMs: elapsed / frames, cpuMs: cpu / frames }
      frames = 0
      cpu = 0
      since = now()
      return result
    },
  }
}
