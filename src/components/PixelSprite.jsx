import { PIXEL_SPRITES } from '../data/pixelSprites'

// One pixel-art sprite (src/data/pixelSprites.js) as crisp SVG cells. Size is the sprite's
// grid times `--sprite-px` (set by the surrounding layout, 2 px by default). Sprites face
// left; `flip` mirrors one to face right.
export default function PixelSprite({ name, flip = false, className = '', style }) {
  const sprite = PIXEL_SPRITES[name]
  if (!sprite) return null
  return (
    <svg
      className={`pixel-sprite${flip ? ' is-flipped' : ''}${className ? ` ${className}` : ''}`}
      viewBox={`0 0 ${sprite.width} ${sprite.height}`}
      shapeRendering="crispEdges"
      aria-hidden="true"
      style={{ '--sprite-w': sprite.width, '--sprite-h': sprite.height, ...style }}
    >
      {sprite.runs.map(([x, y, length, color]) => (
        <rect key={`${x}:${y}`} x={x} y={y} width={length} height={1} fill={color} />
      ))}
    </svg>
  )
}
