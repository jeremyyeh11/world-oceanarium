import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { useThree } from '@react-three/fiber'
import { assetDefinition, ENVIRONMENT_MANIFESTS } from '../loading/environmentManifest.js'
import { environmentLoader } from '../loading/environmentRuntime.js'

/** Future UI entry point: snapshot is immutable; progress is asset-count based, NOT bytes.
 * Read phase/error/requestedId; select via navigation.requestEnvironment(id). No UI lives here.
 */
export function useEnvironmentLoading() {
  return useSyncExternalStore(environmentLoader.subscribe, environmentLoader.getSnapshot)
}

// `initialId` may be null: nothing loads until the first requestEnvironment (the tank
// selector decides which). `prefetchOrder` is an optional ranked list of environment
// ids (most likely next first, e.g. utils/attentionOrder.js over the selector's
// layout); the speculative hint takes the first one not already active or loaded,
// falling back to the catalog neighbour.
export function useEnvironmentNavigation(initialId, prefetchOrder = null) {
  const [mountedId, setMountedId] = useState(initialId)
  const state = useEnvironmentLoading()
  const requestEnvironment = useCallback(async id => {
    const result = await environmentLoader.select(id)
    // Latest selection wins. A superseded promise may settle after the newer one.
    if (result.status === 'assets-ready') {
      if (!environmentLoader.beginActivation(id)) return { id, status: 'cancelled' }
      setMountedId(id)
    }
    return result
  }, [])
  useEffect(() => {
    if (initialId) requestEnvironment(initialId)
    const timer = window.setInterval(() => environmentLoader.maintain(), 2000)
    return () => window.clearInterval(timer)
  }, [initialId, requestEnvironment])
  const prefetchKey = prefetchOrder?.join('|') ?? ''
  useEffect(() => {
    if (state.phase !== 'ready') return
    // One speculative destination at a time. Ranked order when given, else the neighbour.
    const ranked = prefetchKey ? prefetchKey.split('|') : []
    const environments = environmentLoader.getSnapshot().environments
    const choice = ranked.find(id => id !== state.activeId && !environments[id]?.assetsReady)
    if (choice) {
      environmentLoader.prefetch(choice)
      return
    }
    const index = ENVIRONMENT_MANIFESTS.findIndex(env => env.id === state.activeId)
    const next = ENVIRONMENT_MANIFESTS[(index + 1) % ENVIRONMENT_MANIFESTS.length]
    environmentLoader.prefetch(next?.id ?? null)
  }, [state.activeId, state.phase, prefetchKey])
  useEffect(() => {
    // Source failures never leave the old tank. If shader/placement activation fails
    // after mounting the target, restore the last acknowledged environment instead.
    if (state.phase === 'error' && state.activeId && mountedId !== state.activeId) setMountedId(state.activeId)
  }, [mountedId, state.activeId, state.phase])
  return { mountedId, requestEnvironment, state }
}

export function useEnvironmentSourceLease(kind, urls) {
  // Stable effect identity for callers that construct texture arrays/objects each render.
  const signature = JSON.stringify(urls)
  const assets = useMemo(() => JSON.parse(signature).map(url => assetDefinition(kind, url)), [kind, signature])
  useLayoutEffect(() => environmentLoader.retain(assets), [assets])
  return assets
}

function useSources(kind, urls) {
  const assets = useEnvironmentSourceLease(kind, urls)
  const previous = useRef(null)
  const values = assets.map(asset => environmentLoader.read(asset))
  // Drei returns stable source arrays. Preserve that contract: texture consumers use
  // array/object identity to memoize materials, merged coral geometry and GPU uploads.
  if (!previous.current || previous.current.length !== values.length || values.some((value, i) => value !== previous.current[i])) previous.current = values
  return previous.current
}

// Owned source cache shared by tanks and Atlas. Consumers lease originals; clones remain local.
export function useEnvironmentGLTF(url) {
  return useSources('gltf', [url])[0]
}

export function useEnvironmentTextures(input) {
  const gl = useThree(state => state.gl)
  const object = typeof input === 'object' && !Array.isArray(input)
  const urls = object ? Object.values(input) : Array.isArray(input) ? input : [input]
  const textures = useSources('texture', urls)
  // Match drei's early upload behaviour. Upload happens ONLY in the active renderer.
  const signature = textures.map(texture => texture.uuid).join(':')
  useEffect(() => { for (const texture of textures) gl.initTexture?.(texture) }, [gl, signature]) // eslint-disable-line react-hooks/exhaustive-deps
  const inputSignature = JSON.stringify(input)
  return useMemo(() => {
    const shape = JSON.parse(inputSignature)
    return typeof shape === 'object' && !Array.isArray(shape)
      ? Object.fromEntries(Object.keys(shape).map((key, i) => [key, textures[i]]))
      : Array.isArray(shape) ? textures : textures[0]
  }, [inputSignature, textures])
}
