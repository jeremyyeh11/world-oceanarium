# World Oceanarium — Project Bible

## What This Is
A web-based interactive aquarium/ecosystem sim — passion/portfolio project built with React Three Fiber. The scene is a "window" into an underwater world: a perspective camera locked to pan only, giving real 3D depth without free orbit.

## Stack
- **React + Vite** — project scaffolding
- **React Three Fiber (R3F)** — Three.js in React
- **@react-three/drei** — helpers (GLB loading, etc.)
- **Deployed on Vercel**

## Art Style
- Low-poly geometry with photographic textures (Ian Hubert "lazy" style)
- Intentional geometric imperfections — NOT hyper-realism
- Mood: open underwater world, fog-based depth, infinite feel

## Camera & Navigation
- **Camera is perspective, forward-facing only** — locked to pan on X (biomes) and Y (depth). Never rotates or moves on Z.
- Real 3D depth comes from perspective projection + fog. No fake layering needed.
- **World axes:**
  - X → biomes (each biome is a separate scene, side by side in world space)
  - Y → depth (surface at top, floor at bottom — full continuous column)
  - Z → depth into screen (fish swim here; camera stays fixed)
- **Left/right navigation:** blur-slide transition between biomes (discrete jump)
- **Up/down navigation:** continuous drag/scroll — smooth camera pan on Y
- **Fish click:** camera zooms toward fish, simple HTML overlay info card appears
- **ESC or click away:** releases fish focus, resets camera

## Biomes
Separate scenes — fish are contained within their biome and do not cross boundaries.
Planned biomes (order TBD): ocean, reef, lake, river.

## Fish & Ecosystem
- Educational ecosystem sim — species are real, manually introduced, and fixed. No procedural speciation.
- Fish linger within their **depth sub-zones** (e.g., surface, mid-water, benthic)
- Fish that wander too far from their zone may die off
- Organic population dynamics: birth, colony formation, extinction
- **Future behavioral mechanics** (not yet implemented, but data model should support):
  - Schooling
  - Aggression / territory
  - Breeding / birth
  - Predation
  - Symbiotic relationships

### Two-layer data model

**Species template** — static, lives in `/src/data/species.js`:
```js
{
  id: 'clownfish',
  name: 'Clownfish',
  biome: 'reef',
  depthZone: 'shallow',   // shallow | mid | deep | benthic
  schooling: true,
  aggressive: false,
  predator: false,
  // ... expand as mechanics are added
}
```

**Individual creature** — persistent, lives in Supabase:
```sql
CREATE TABLE creatures (
  id            TEXT PRIMARY KEY,   -- 'alpha_1' during alpha, then 1, 2, 3... globally
  species       TEXT NOT NULL,      -- references species.id
  biome         TEXT NOT NULL,
  depth_zone    TEXT NOT NULL,
  born_at       TIMESTAMPTZ DEFAULT now(),
  died_at       TIMESTAMPTZ,
  alive         BOOLEAN DEFAULT true,
  parent_ids    TEXT[],             -- null if manually introduced; array of parent IDs if born
  generation    INT DEFAULT 0,      -- 0 = manually introduced, 1+ = born in-sim
  traits        JSONB               -- individual variation within species (size, coloration, etc.)
);
```

### Creature ID scheme
- Alpha phase: `alpha_1`, `alpha_2`, ... (manually introduced test creatures)
- Production: globally incrementing integers `1`, `2`, `3`, ... regardless of species
- New **species** are always manually introduced by the curator
- New **individuals** can be manually introduced OR born organically between existing agents

## FX
- **No shader-based caustics** — use scrolling/fake textures instead
- Other FX (water shimmer, particles) also texture-based to start
- Water surface: simple animated plane

## Asset Pipeline
- Models + animations authored in Blender, exported as `.glb`
- Fish have baked skeletal swim animations
- Assets go in `/public` folder, loaded via `useGLTF`
- **No assets ready yet** — use placeholder geometry until Blender work is done

## Code Architecture
One file per concern:
- `App.jsx` — scene root, canvas setup, biome routing
- `Camera.jsx` — pan controls, biome-slide logic, fish zoom/focus
- `Biome.jsx` — biome container, loads correct fish + environment for active biome
- `Fish.jsx` (or per-species file) — mesh, animation, click handling, behavioral state
- `Environment.jsx` — floor, rocks, plants, geometry per biome
- `WaterSurface.jsx` — animated water plane
- `FX.jsx` — particles, scrolling textures
- `InfoCard.jsx` — HTML overlay shown on fish click
- `UI.jsx` — navigation arrows / scroll controls

## Current Status
- **Starting from scratch** — workspace is empty as of 2026-05-01
- No Vite project scaffolded yet
- No Blender assets ready yet

## Conventions
- Functional components + hooks only
- No class components
- Clean, minimal dependencies
- Fish species data in a flat data file (`/src/data/species.js`) — not hardcoded into components
