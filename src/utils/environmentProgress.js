// One environment's load, read off the environment loader's snapshot
// (docs/environment-loading.md) as the descent UI shows it.
//
// Source files are most of a cold load but not all of it: once they are in, the scene
// still builds (rock merges, coral placement) and its shaders compile before the first
// frame. Files get FILES_SHARE of the bar and the build holds the rest, so the diver
// does not sit at the bottom while the reserve is still being put together.
export const FILES_SHARE = 0.85

// stage: 'idle' (not requested), 'fetching', 'building', 'ready' or 'error'.
export function environmentProgress(state, id) {
  const env = state.environments[id]
  const loaded = env?.loaded ?? 0
  const total = env?.total ?? 0
  const isTarget = Boolean(id) && state.requestedId === id
  let stage = 'idle'
  let progress = (env?.progress ?? 0) * FILES_SHARE
  if (isTarget) {
    if (state.phase === 'error') stage = 'error'
    else if (state.phase === 'ready' && state.activeId === id) { stage = 'ready'; progress = 1 }
    else if (state.phase === 'assets-ready' || state.phase === 'activating') {
      stage = 'building'
      progress = FILES_SHARE + (1 - FILES_SHARE) * 0.5
    } else stage = 'fetching'
  }
  return { stage, progress, loaded, total }
}
