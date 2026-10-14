// The viewing room in front of a tank: a dark wall with one fixed-aspect glass window cut
// into it, a floor, and a human silhouette for scale. It is screen-space only — the room
// never touches the 3D scene. The Camera lens-shifts so whatever is inside the window frames
// the same tank view on every screen; the room just decides where that window sits.

const WU_METERS = 0.25
const FIGURE_HEIGHT_M = 1.7
// Glass sill height above the floor, in metres. A big public tank runs almost to the floor.
const SILL_HEIGHT_M = 0.35

export const DEFAULT_GLASS = {
  // Vertical (and, being square, horizontal) field of view seen through the window.
  fov: 61,
  // Camera-to-glass distance. 17.6 WU is the front face of the shared swim volume
  // (camera z 10, volume front ≈ z -7.6), so scale is honest for the nearest animals.
  glassDistanceWU: 17.6,
}

export function glassWidthMeters(glass) {
  return 2 * Math.tan((glass.fov * Math.PI) / 360) * glass.glassDistanceWU * WU_METERS
}

// Window size and placement for a viewport. Portrait screens get the window high with floor
// below it; landscape screens get the window centred with wall either side.
export function getGlassLayout(viewportWidth, viewportHeight, glass = DEFAULT_GLASS) {
  const portrait = viewportHeight > viewportWidth
  const size = Math.round(portrait
    ? Math.min(viewportWidth * 0.86, viewportHeight * 0.6)
    : Math.min(viewportHeight * 0.78, viewportWidth * 0.6))
  const centerX = viewportWidth / 2
  const centerY = viewportHeight * (portrait ? 0.42 : 0.46)
  const frame = Math.max(10, Math.round(size * 0.045))
  const pxPerMeter = size / glassWidthMeters(glass)
  const left = centerX - size / 2
  const top = centerY - size / 2
  const bottom = top + size
  const floorY = bottom + frame + SILL_HEIGHT_M * pxPerMeter
  return {
    viewportWidth,
    viewportHeight,
    size,
    left,
    top,
    bottom,
    centerX,
    centerY,
    frame,
    floorY,
    pxPerMeter,
    radius: Math.round(size * 0.025),
    // Offsets of the window centre from the viewport centre, for the camera lens shift.
    offsetX: centerX - viewportWidth / 2,
    offsetY: centerY - viewportHeight / 2,
    fov: glass.fov,
  }
}

function roundedRectPath(x, y, w, h, r) {
  return `M${x + r} ${y}H${x + w - r}A${r} ${r} 0 0 1 ${x + w} ${y + r}V${y + h - r}A${r} ${r} 0 0 1 ${x + w - r} ${y + h}H${x + r}A${r} ${r} 0 0 1 ${x} ${y + h - r}V${y + r}A${r} ${r} 0 0 1 ${x + r} ${y}Z`
}

export default function GlassRoom({ layout, steppedIn = false }) {
  if (!layout) return null
  const { viewportWidth: vw, viewportHeight: vh, size, left, top, frame, floorY, pxPerMeter, radius, centerX, centerY } = layout
  const holePath = roundedRectPath(left, top, size, size, radius)
  const wallClip = `path(evenodd, '${`M0 0H${vw}V${vh}H0Z`}${holePath}')`
  // Scale that pushes the window frame past every screen edge: "stepping up to the glass".
  const stepScale = (Math.hypot(vw, vh) / size) * 1.4
  const figureHeight = FIGURE_HEIGHT_M * pxPerMeter
  const figureWidth = figureHeight * (100 / 340)
  const figureX = left + size * 0.68
  const figureFeetY = floorY + Math.max(8, (vh - floorY) * 0.12)

  return (
    <div
      className={`glass-room${steppedIn ? ' is-stepped-in' : ''}`}
      style={{
        '--glass-step-scale': stepScale,
        '--glass-cx': `${centerX}px`,
        '--glass-cy': `${centerY}px`,
        '--glass-size': `${size}px`,
        '--glass-floor-y': `${floorY}px`,
      }}
      aria-hidden="true"
    >
      <div className="glass-wall" style={{ clipPath: wallClip }}>
        <div className="glass-floor" style={{ top: floorY }} />
        <div
          className="glass-light-spill"
          style={{
            top: floorY,
            left: left - size * 0.06,
            width: size * 1.12,
            height: Math.max(0, vh - floorY),
          }}
        />
        <div
          className="glass-figure-shadow"
          style={{ left: figureX - figureWidth * 0.7, top: figureFeetY - figureWidth * 0.12, width: figureWidth * 1.4, height: figureHeight * 0.32 }}
        />
      </div>
      <div
        className="glass-frame"
        style={{ left: left - frame, top: top - frame, width: size + frame * 2, height: size + frame * 2, borderWidth: frame, borderRadius: radius + frame }}
      />
      <div className="glass-pane" style={{ left, top, width: size, height: size, borderRadius: radius }} />
      <svg
        className="glass-figure"
        viewBox="0 0 100 340"
        style={{ left: figureX - figureWidth / 2, top: figureFeetY - figureHeight, width: figureWidth, height: figureHeight }}
        focusable="false"
      >
        <ellipse cx="50" cy="20" rx="12.5" ry="15" />
        <path d="M44 32h12v14H44z" />
        <path d="M50 42c14 0 30 2 37 9c6 6 8 16 8 28l2 74c0 16-3 30-9 32c-5 1-8-5-8-13l-1-50l-1 74l-4 132c0 5-4 8-12 8h-6l-2-126h-4l-2 126h-6c-8 0-12-3-12-8l-4-132l-1-74l-1 50c0 8-3 14-8 13c-6-2-9-16-9-32l2-74c0-12 2-22 8-28c7-7 23-9 37-9z" />
      </svg>
    </div>
  )
}
