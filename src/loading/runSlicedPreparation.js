// Placement setup can throw before it even returns a generator (e.g. kit measurement).
// Keep setup, sliced iteration and callbacks in one error path so navigation can roll back.
// onReady is NOT a scene-ready acknowledgement: React must commit the generated meshes first.
export function runSlicedPreparation(start, { sliceMs, onReady, onError,
  now = () => performance.now(), schedule = work => setTimeout(work, 0), cancel = clearTimeout }) {
  let steps
  let timer = null
  let stopped = false
  function step() {
    if (stopped) return
    try {
      steps ??= start()
      const until = now() + sliceMs
      while (now() < until) {
        const { done, value } = steps.next()
        if (done) {
          stopped = true
          onReady(value)
          return
        }
      }
      timer = schedule(step)
    } catch (error) {
      stopped = true
      onError(error)
    }
  }
  step()
  let released = false
  return () => {
    if (released) return
    released = true
    stopped = true
    cancel(timer)
    try { steps?.return?.() } catch (error) { onError(error) }
  }
}
