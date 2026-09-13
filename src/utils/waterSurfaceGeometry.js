/**
 * Where the water surface sits in world space.
 *
 * These live apart from `WaterSurface.jsx` so that plain `.js` modules — and the
 * Node test runner, which cannot import `.jsx` — can read them without pulling in
 * a renderer. `WaterSurface.jsx` re-exports them, so existing importers are
 * unaffected by the move.
 */
export const SURFACE_PLANE_Y = 4.6
export const SURFACE_PLANE_X = 0
export const SURFACE_PLANE_Z = -4
export const SURFACE_PLANE_WIDTH = 320
export const SURFACE_PLANE_DEPTH = 320
