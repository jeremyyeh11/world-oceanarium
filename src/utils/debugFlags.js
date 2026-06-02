// The fish light-mask shader is the current shipped water-caustic look, despite
// its historical "diagnostic" name. Keep it on by default to preserve visuals;
// set VITE_WO_ENABLE_FISH_LIGHT_MASK=false for a targeted shader comparison.
export const ENABLE_FISH_LIGHT_MASK = import.meta.env.VITE_WO_ENABLE_FISH_LIGHT_MASK !== 'false'

export function sardineDebugGlobalsEnabled(localDebug = false) {
  if (localDebug) return true
  return typeof window !== 'undefined' && window.__WO_ENABLE_SARDINE_DEBUG === true
}
