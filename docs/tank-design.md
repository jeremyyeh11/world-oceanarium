# Tank design & the assemblage model

How the app decides **which creatures appear in which tank**, and how to change it
by hand. Written to be self-contained: you should be able to add a species, build a
new tank, or debug a "wrong fish in the tank" problem from this file alone.

## The problem this solves

Originally a "tank" was just a **biome**, and it rendered *every* creature tagged
with that biome:

```js
// old Biome.jsx
creatures.filter(c => c.biome === name && c.alive)
```

That is a database query, not a curated exhibit. With four open-ocean species all
tagged `ocean` / `epipelagic`, the tank became a grab-bag: a slow, drifting sunfish
sharing water with fast pursuit hunters. It read as two unrelated scenes stitched
together.

The fix separates **environment** from **cast**:

- **biome** = what the water looks like (color, lighting, bubbles, fog). Unchanged.
- **tank** = a *curated assemblage* — an explicit, hand-picked list of species that
  belong together.

A tank borrows a biome for its environment but lists its own cast.

## The four coherence axes

A tank feels like one real place when its species agree on these. Use them as a
checklist before adding anything to a tank:

1. **Motion tempo** — do they move on the same clock? A drifter next to sprinters
   breaks the illusion instantly. This is the strongest signal and the one the code
   guards automatically (see below).
2. **Trophic story** — is there a legible food web? `bait → mid predator → apex` is a
   readable story; an animal that plugs into nothing reads as a random specimen.
3. **Scale composition** — deliberate size layering (small = ambient texture, mid =
   mobile focal point, large = slow hero), not a random size jumble.
4. **Geographic plausibility** — would they actually co-occur in the same water mass?

Note: a tank *may* deliberately mix tempos when it serves the story — the Open Sea
keeps `sprint` bait flickering under `cruise` hunters, and that flicker-vs-glide
tension is the drama. What it must **not** do is mix `drift` with the fast tempos.

## Data model

### 1. `tempo` on each species — `src/data/species.js`

Every species carries a motion rhythm, independent of its trophic role:

| value      | meaning                                        |
|------------|------------------------------------------------|
| `'drift'`  | slow, gelatinous, current-borne (e.g. sunfish) |
| `'cruise'` | steady glides, broad turns, occasional bursts  |
| `'sprint'` | fast darting / schooling flicker (bait)        |

```js
{
  id: 'isurus-oxyrinchus',
  // ...
  tempo: 'cruise',
}
```

### 2. `TANKS` — `src/data/species.js`

The curation layer. Each tank borrows a `biome` for its environment and lists its
cast explicitly by species `id`:

```js
export const TANKS = [
  {
    id: 'open-sea',
    name: 'The Open Sea',
    tagline: 'A blue-water pursuit',
    description: 'Fast open-ocean hunters and their bait, ...', // shown above the switcher
    biome: 'ocean',            // drives environment (water, light, bubbles)
    depthZone: 'epipelagic',   // drives the zone label / framing
    seed: 137,                 // per-tank surface/sky signature (see below)
    species: ['amblygaster-sirm', 'coryphaena-hippurus', 'isurus-oxyrinchus'],
  },
  {
    id: 'the-drift',
    name: 'The Drift',
    tagline: 'Slow grazers of the open blue',
    description: 'A calmer, dimmer column ...',
    biome: 'ocean',
    depthZone: 'epipelagic',
    seed: 953,
    lighting: { exposure: 0.97, backgroundBeamAlpha: 0.1 }, // optional palette overrides
    species: ['mola-alexandrini'],
  },
]

export const DEFAULT_TANK_ID = 'open-sea'
```

Tank fields:

- `name` / `tagline` — display strings.
- `description` — one or two lines shown in small font above the switcher (falls back
  to `tagline` if absent).
- `biome` — an existing `BIOMES` id; drives environment (water, light, bubbles, fog).
- `depthZone` — an existing `DEPTH_ZONES` id; drives the zone label / camera framing.
- `seed` — a number giving the tank a distinct-but-stable **visual signature** (see
  "Visual signature" below).
- `lighting` — optional palette overrides (any key from a `PALETTES` entry in
  `SceneLighting.jsx`, e.g. `exposure`, `backgroundBeamAlpha`, `fog`, `density`)
  merged over the biome palette to art-direct the tank's mood.
- `species` — the explicit cast, by species id.

The membership model is **hybrid**: tanks list species explicitly (deliberate
curation, one place to look), *and* species carry `tempo` (so the coherence guard can
catch mistakes). Explicit lists mean a new species does **not** appear in any tank
until you add its id to one — that is intentional; curation is a deliberate act.

### 3. Resolver + coherence guard — `src/utils/speciesLookup.js`

`creaturesForTank(creatures, tank)` maps live creatures to a tank. Creatures reference
their species by name/alias (from Supabase or the static set), so it normalizes
through `SPECIES_BY_KEY` and matches on the canonical species `id`. This means the
filter is **data-source agnostic** — it works the same for static-dev creatures and
Supabase rows.

```js
export function creaturesForTank(creatures, tank) {
  if (!tank) return []
  const ids = new Set(tank.species)
  return creatures.filter(creature => {
    if (!creature.alive) return false
    const species = SPECIES_BY_KEY.get(creature.species)
    return species ? ids.has(species.id) : false
  })
}
```

The **coherence guard** runs once at load in dev (`import.meta.env.DEV`) and is silent
in production. If a tank mixes `drift` with `cruise`/`sprint`, it logs:

```
[oceanarium] Tank "the-drift" mixes drifters with fast swimmers — tempo clash.
```

So "rojak" becomes a console warning during `npm run dev`, not a vibe you notice
later. If you see that warning, either move the offending species to its own tank or
reconsider its `tempo`.

## How rendering flows

```
species.js (TANKS, tempo)
  └─ App.jsx            activeTankId state (default DEFAULT_TANK_ID)
                        resolves tank -> biome, renders the switcher
       └─ TankView.jsx  gets biome (environment) + tank (cast); shows tank.name
            └─ Biome.jsx filters creatures via creaturesForTank(creatures, tank)
                         environment components still keyed on biome id (name)
```

Key detail: `Biome` keeps a fallback — if no `tank` prop is passed it reverts to the
old `c.biome === name` filter, so nothing breaks if a tank is ever missing.

## Tank switching and session continuity

Only the active tank is mounted and rendered. Switching tanks therefore unmounts every
`Fish` in the tank being left; hidden tanks consume no background simulation time.

Since `v0.12.2`, each fish writes its continuity-critical state through a module-level
store keyed by `creature.id` (`src/components/fishRuntimeStore.js`). When the creature
remounts, it resumes its stored position, heading, velocity, committed boid steering,
simulation clock, and seed/reset gates before the first frame is shown. This avoids both
the old respawn and a one-frame flash at the model origin.

Lifecycle rules:

- **Tank switch:** freeze the departing tank; resume inhabitants when it is revisited.
- **Creature-data refresh:** `App.jsx` prunes snapshots whose creature ids are no longer live.
- **Page reload:** intentionally clears the module store and starts a fresh session.
- **School remount:** members keep their individual position/heading, but the shared school
  migration goal currently repicks when the leader remounts. The school can leave in a new
  direction without any member teleporting.

Do not mount every tank simultaneously to preserve continuity; that scales runtime work
with total tank count. Extend the snapshot only when a newly added simulation field is
visibly continuity-critical.

Files touched by this system:

- `src/data/species.js` — `tempo` on species, `TANKS`, `DEFAULT_TANK_ID`
- `src/utils/speciesLookup.js` — `creaturesForTank`, `TANK_BY_ID`, dev guard
- `src/components/Biome.jsx` — tank-based creature filter
- `src/components/Fish.jsx` — hydrates and continuously mirrors each creature's runtime snapshot
- `src/components/fishRuntimeStore.js` — get-or-create snapshot store + live-id pruning
- `src/components/TankView.jsx` — accepts `tank`, shows its name/description, threads seed + lighting to the scene
- `src/components/SceneLighting.jsx` — background/env painting; seeds the mottle RNG and merges `lighting` overrides
- `src/components/WaterSurface.jsx` — surface caustic shader; `uSeed` uniform offsets the noise domain per tank
- `src/App.jsx` — `activeTankId` state, tank→biome resolution, switcher + description, and snapshot pruning after creature-data refresh
- `src/index.css` — `.tank-switcher-dock` / `.tank-switcher` / `.tank-switch-button` styles (bottom-center)

## Visual signature

Switching tanks should look different, not just swap the fish. Two mechanisms, both
driven by tank fields:

- **`seed`** (scalable, zero art) — feeds a seeded PRNG for the background light
  mottling (`SceneLighting.jsx`) and a `uSeed` uniform that offsets the surface
  caustic noise domain (`WaterSurface.jsx`). Same palette, but a genuinely different
  stretch of water — so every tank is distinct and stable without hand-authoring.
- **`lighting`** (deliberate art direction) — optional palette overrides merged over
  the biome palette. Use for a real mood shift: The Drift lowers `exposure` and softens
  `backgroundBeamAlpha` to read calmer and dimmer than The Open Sea.

Rule of thumb: give every tank a unique `seed`; reach for `lighting` only when a tank
should feel meaningfully different in mood.

## How to change it by hand

### Move a species into a different tank

Edit the `species: [...]` arrays in `TANKS`. Remove the id from one tank, add it to
another. That is the whole change — the render path follows automatically.

### Add a brand-new species to a tank

1. Add the species object to `SPECIES` in `species.js` (with a `tempo`).
2. Add its `id` to the `species` array of the tank it belongs in.
3. Make sure creatures of that species exist (static `CREATURES` array in
   `species.js`, or the Supabase `creatures` table) — the tank only shows creatures
   that actually exist, not species templates.

### Create a new tank

Append an entry to `TANKS`:

```js
{
  id: 'twilight-drift',
  name: 'The Twilight',
  tagline: '...',
  description: '...',       // shown above the switcher
  biome: 'ocean',           // must be an existing biome id (see BIOMES)
  depthZone: 'mesopelagic', // must be an existing depth-zone id (see DEPTH_ZONES)
  seed: 421,                // any number; give each tank a unique one
  species: ['some-species-id'],
}
```

The switcher renders one button per tank automatically (it only shows when
`TANKS.length > 1`). Keep every species in the tank on a compatible tempo, or the dev
guard will warn.

### Change the default tank

Set `DEFAULT_TANK_ID` in `species.js` to another tank's `id`.

## Scaling the switcher (future)

The bottom-center pill switcher is fine for **2–4 tanks** and stops scaling past that.
Planned progression (revisit when a 3rd/4th tank lands):

- **Phase 1 — now (2–4 tanks):** the inline segmented pill. Keep.
- **Phase 2 — ~5–8 tanks:** group tanks by **biome**. The switcher becomes
  biome-scoped (only tanks in the current biome), and the biome choice moves to a
  lightweight lobby. The entry point already exists: `TankView` has a latent `onBack`
  → "Back to biome menu" hook that `App` does not currently wire up.
- **Phase 3 — many tanks / depth stratification:** a two-axis navigator. `DEPTH_ZONES`
  exists but nothing uses it for navigation yet; the model is pick a biome, then move
  *vertically* through depth zones (scroll-down = deeper) with tanks as stops along the
  column. This turns the depth axis from a decorative label into real navigation.

The data model already supports every phase — `tank.biome` and `tank.depthZone` are the
grouping keys the later phases need. Only the navigation UI changes.

## Current roster

| Species             | tempo    | tank        | role in the story        |
|---------------------|----------|-------------|--------------------------|
| Spotted Sardinella  | `sprint` | `open-sea`  | bait / schooling texture |
| Mahi-mahi           | `cruise` | `open-sea`  | mid predator             |
| Shortfin Mako Shark | `cruise` | `open-sea`  | apex predator            |
| Giant Sunfish       | `drift`  | `the-drift` | slow gelatinous grazer   |

The Open Sea is a self-contained food chain (bait → mid → apex) at one tempo band.
The sunfish was pulled out into The Drift because its `drift` tempo clashes with the
pursuit hunters — the exact case the coherence guard protects against.
