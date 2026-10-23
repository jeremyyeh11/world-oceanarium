import { useGLTF, useProgress, useTexture } from '@react-three/drei'
import { SPECIES } from '../data/species'
import { landscapeForTank } from '../data/landscapes'

const SPECIES_BY_ID = new Map(SPECIES.map(species => [species.id, species]))

// How many tanks the selector fetches ahead, best-ranked first (utils/attentionOrder.js).
// With two tanks that is all of them. Keep it small as tanks are added: every tank is
// several MB, and on mobile data fetching ones the viewer never opens is a real cost.
export const PRELOAD_TANK_LIMIT = 2

// A tank whose assets are all cached never makes the loader queue active, so after this
// long without it starting, move on to the next tank.
const QUEUE_START_MS = 500

// Every model file a species can draw: its base model and sex variants (`model`) and its
// life-stage overrides (`lifeStages`, e.g. the juvenile emperor angelfish). Walking
// the entry rather than naming fields keeps this exhaustive as species data grows, the
// same reasoning as the old module-level list in Fish.jsx (a model fetched lazily on
// first sighting stalls the frame mid-session). Only `/models/` paths: Atlas images are
// not the tank's to fetch.
function speciesModelPaths(species, paths = new Set()) {
  const visit = (value) => {
    if (typeof value === 'string') {
      if (value.startsWith('/models/') && value.endsWith('.glb')) paths.add(value)
    } else if (Array.isArray(value)) {
      value.forEach(visit)
    } else if (value && typeof value === 'object') {
      Object.values(value).forEach(visit)
    }
  }
  visit(species.model)
  visit(species.lifeStages)
  return paths
}

// Starts fetching one tank's models and textures into drei's cache, so the tank's own
// useGLTF/useTexture calls resolve from it. Each call must use the same arguments as the
// component that draws the asset, or it caches under a different key and fetches twice:
// useGLTF(path) in Fish.jsx; useGLTF(kit.path) and useTexture(kit.textures) in
// Landscape.jsx; useTexture of the coral kit's colour + normal list in useCoralKit.
export function preloadTank(tank) {
  const paths = new Set()
  for (const id of tank.species ?? []) {
    const species = SPECIES_BY_ID.get(id)
    if (species) speciesModelPaths(species, paths)
  }
  paths.forEach(path => useGLTF.preload(path))

  const landscape = landscapeForTank(tank)
  if (landscape?.kit) {
    useGLTF.preload(landscape.kit.path)
    useTexture.preload(Object.values(landscape.kit.textures))
    for (const coral of [landscape.corals, landscape.staghorn]) {
      if (!coral) continue
      useGLTF.preload(coral.kit.path)
      useTexture.preload(coral.kit.models.flatMap(model => [model.color, model.normal]))
    }
  }
}

// Preloads tanks one at a time, in the order given: the next starts once the loader
// queue drains, so the best-ranked tank gets the bandwidth instead of sharing it.
// Returns a cancel function, which stops further tanks from starting; a fetch already
// in flight finishes.
//
// Known cost: the tank loader's readiness waits for the whole queue to drain, so picking
// a tank while a different one is mid-preload makes its loading screen wait for that
// fetch too. Sequencing limits this to one tank's worth at most.
export function preloadTanksInOrder(tanks) {
  let cancelled = false
  let unsubscribe = null
  let timer = null

  const clear = () => {
    unsubscribe?.()
    unsubscribe = null
    if (timer) window.clearTimeout(timer)
    timer = null
  }

  const run = (index) => {
    if (cancelled || index >= tanks.length) return
    preloadTank(tanks[index])

    let started = useProgress.getState().active
    const next = () => {
      clear()
      run(index + 1)
    }
    if (!started) timer = window.setTimeout(next, QUEUE_START_MS)
    unsubscribe = useProgress.subscribe(state => {
      if (state.active) {
        started = true
        if (timer) window.clearTimeout(timer)
        timer = null
      } else if (started) {
        next()
      }
    })
  }

  run(0)
  return () => {
    cancelled = true
    clear()
  }
}
