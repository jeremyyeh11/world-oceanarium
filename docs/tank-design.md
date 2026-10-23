# Tank design & the assemblage model

How the app decides **which creatures appear in which tank**, and how to change it
by hand. In public copy a tank is a **reserve** (open and free range, like a wildlife
reserve); the code and these docs keep `tank`. Written to be self-contained: you should be able to add a species, build a
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
    id: 'the-reefs',           // formerly the-drift / The Drift
    name: 'The Reefs',
    tagline: 'Reef fish among the rocks',
    description: 'A sheltered reef ...',
    biome: 'ocean',
    depthZone: 'epipelagic',
    seed: 953,
    lighting: { exposure: 0.97, backgroundBeamAlpha: 0.1, density: 0.016 }, // optional palette overrides
    landscape: 'reefs',        // optional fixed seabed + rocks (src/data/landscapes.js)
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

Hitchhikers (species with a `hitchhiker` block — the remoras, the pilot fish, and the bannerfish) are
left out of the check. They spend most of their time clamped to or following a host and
move at its pace, so the spearfish remora and the pilot fish can share The Drift with the
Mola. The bannerfish follows only about a fifth of the time, but its own cruise (about
0.5–0.8 WU/s) is slower than the Mola's, so it does not break the tank's calm either. See
[`ride-hosts.md`](ride-hosts.md).

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

One tank is mounted at a time. Switching tanks unmounts every `Fish` in the tank being
left; tanks that are not mounted consume no background simulation time.

While the tank selector or the loading screen covers it, the last tank viewed stays
mounted underneath, hidden (`TankView` `hidden`: window listeners off, follow released,
viewport invisible) and, once its first frame has rendered, paused (`paused`: canvas
`frameloop="never"`). Nothing renders or simulates, so its fish do not move; picking it
again resumes it with no loader. It stays mounted only so the WebGL context survives:
unmounting the canvas recompiled every shader and re-uploaded every texture on each
visit. Picking a different tank swaps the scene inside that same canvas once the new
tank's files are in (docs/environment-loading.md).

Since `v0.12.2`, each fish writes its continuity-critical state through a module-level
store keyed by `creature.id` (`src/components/fishRuntimeStore.js`). When the creature
remounts, it resumes its stored position, heading, velocity, committed boid steering,
simulation clock, and seed/reset gates before the first frame is shown. This avoids both
the old respawn and a one-frame flash at the model origin.

Lifecycle rules:

- **Tank switch:** freeze the departing tank; resume inhabitants when it is revisited.
- **Selector open:** pause the tank in place (no unmount, no snapshot needed); resume on return.
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
  the biome palette. Use for a real mood shift: The Reefs lowers `exposure` and softens
  `backgroundBeamAlpha` to read calmer and dimmer than The Open Sea, and thins the fog
  (`density`) so its rocks read as clear reef water.
- **`camera`** (optional) — resting-camera overrides for the tank (any of `fov`, `y`, `z`,
  `lookY` from `DEFAULT_CAMERA_SETTINGS` in `Camera.jsx`). The Reefs uses `REEFS_VIEW` from
  `src/data/landscapes.js`, so its rock detail levels measure from the same viewpoint.
- **`landscape`** (fixed set dressing) — names an entry in `src/data/landscapes.js`: the
  tank's seabed height and colour, hand-placed rocks, fixed-seed outcrops and rubble, and the
  rock kit they are kitbashed from (`public/models/landscape/`, built by
  `scripts/build-landscape-kit.py`).
  It is identical on every load. Keep every tall piece behind the swim volume of the
  tank's deepest-roaming species (fish do not avoid rocks yet); the file header records
  the current clearances. Tanks without one keep the biome's open-water floor.

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
  depthMeters: [200, 600],  // the reserve's own depth range, in metres (see checklist)
  seed: 421,                // any number; give each tank a unique one
  species: ['some-species-id'],
}
```

The reserve selector renders one card per tank automatically. Keep every species in the
tank on a compatible tempo, or the dev guard will warn.

### New reserve checklist

Everything a new tank needs before it ships as a reserve. Species-level work (models,
motion, Atlas) has its own list in `docs/new-species-checklist.md`; this is the reserve
around them.

1. **Roster and tempo.** Species ids in `species`, one coherent tempo (above). Landscape,
   if any, in `src/data/landscapes.js` via `landscape`.
2. **Copy.** `name`, `tagline` and `description` say *reserve*, never *tank*, and
   describe a wild place, not an enclosure.
3. **Depth range: `depthMeters: [top, bottom]`.** The real depth the reserve represents,
   in metres, inside its `depthZone`'s range. It is the scale of the reserve's loading
   descent (the depth beside the diver and the tick marks) and the depth on its selector
   card (`utils/reserveDepth.js`). Without it the zone's whole range is used, which is
   wrong for most places (a reef is not 200 m deep), so always set it. Ticks are picked
   automatically as round steps (0–30 m → every 10 m, 0–200 m → every 50 m); nothing to
   configure. Ground it in fact: where the reserve's species actually live, and, where
   the scene has a seabed, the drawn depth (surface `SURFACE_PLANE_Y` 4.6 to the sand,
   `1 WU = 25 cm`). Note in a comment if the two disagree. `tests/reserveDepth.test.mjs`
   fails on a reserve without a sane range.
4. **Descent scenery** (see below). Decide which signature species (and, for a reserve
   with a seabed, which corals) appear on its loading descent, draw any missing sprites in
   `src/data/pixelSprites.js`, and add a `descent` block. Scenery is for the loading
   descents only; the landing stays just the card. If the new reserve has a signature
   animal, consider adding it to the landing dive's montage too
   (`src/data/descentScenery.js`, `GENERAL_DESCENT`).
5. **Card preview: `cardImage`.** A still of the reserve for its selector card, in
   `public/reserves/<id>.webp`: cropped to 16:7, 1120 × 490, WebP around quality 80
   (10–30 KB). Frame it on the reserve's hero animal, close, not the resting view: open
   water from the resting camera reads as empty blue. Hide the UI (screenshot mode) and
   leave the CRT film off; the card adds its own scanlines and fades the bottom third
   into the card. Retake it when the reserve's look changes. `tests/scenery.test.mjs`
   fails on a reserve without one.
6. **Selector and loading.** Nothing else to wire: the selector card, the attention
   ranking and preloading (`docs/environment-loading.md`) pick the new entry up from
   `TANKS`. The card's swatch (from `lighting.backgroundStops`, else the biome colour)
   shows under the still while it loads. Check the card and the descent on a phone,
   portrait and landscape.

### Descent scenery and signature species

Each reserve's loading descent (the freediver going down the guideline,
`DiveDescent.jsx`) can carry scenery that says where you are going. Built in
`v0.35.0-dev_10` for The Reefs and `dev_13` for The Open Sea; `tests/scenery.test.mjs`
checks every piece. The landing has no scenery (Jeremy, dev_13).

- **Standees, no cardboard.** Flat pixel-art cut-outs set around the guideline, like a
  cardboard standee display without the cardboard outline: same 2 px cell style and CRT
  palette as the diver, the diver loading bar still going down the centre. The scenery
  **does not scroll** or parallax; it stays put while the diver moves past it.
- **Real depth order.** Pieces go where their animal typically lives, so their order
  down the line matches reality at least relatively, and a species shown on two descents
  sits at depths that agree with each other (a coral is never deeper than its reserve).
- **Placed by depth.** Each piece sits at a depth in metres within the reserve's
  `depthMeters`, on the left or right of the line, so the scenery matches the tick
  marks. Pieces stay dark until the diver reaches their depth, then light up, the way
  the passed ticks do, so the place assembles as you descend and arrival lands in it.
- **Signature species.** One or a few recognisable species of the reserve's own roster,
  drawn as pixel sprites at a fixed depth (e.g. The Reefs: the longfin bannerfish and the
  emperor angelfish, distinctive at pixel scale). They may idle in place (a fin flick
  on stepped frames) but do not travel across the screen. Real colours, muted to the
  phosphor palette.
- **Corals, no landscape.** Scenery is living things only: species and corals. No rocks,
  ledges, boulders or sand pieces (Jeremy, dev_12). For The Reefs: table coral and
  staghorn on the seabed where the diver arrives, in the reef's coral colours.
- **Composed, not scattered.** Lay pieces out as a picture: alternate sides down the line
  so the eye zigzags with the diver, group small species into a school rather than
  spreading them, let the seabed form a garden around the landing spot with the larger
  mass on one side, and set back secondary pieces with `distance` (dimmer, greyer).
  Open water has no seabed: The Open Sea's descent zigzags from a mahi-mahi pair near
  the surface, to a sardinella school, to the whale shark deeper down.
- **The landing dive** (after Dive in, before any reserve is chosen) has its own
  montage of every reserve, `GENERAL_DESCENT` in `src/data/descentScenery.js`: a reef
  drop-off over 0–200 m. A shallow reef crest at the top (corals and the bannerfish at
  The Reefs' own 0–10 m), then open water down the wall in order of where each animal
  typically lives: sardinella, the sunfish, the whale shark deepest; no seabed. Kept
  sparse, ordered by real depth, and consistent with each piece's own reserve. Curated by
  hand; its species must be on some reserve's roster.
- **Data.** A `descent` block on the tank (The Reefs' is in species.js):

  ```js
  descent: {
    signature: [
      { sprite: 'bannerfish', species: 'heniochus-acuminatus', depth: 3.5, side: 'left', flip: true },
    ],
    scenery: [
      { sprite: 'table-coral', depth: 'floor', side: 'left' },
      { sprite: 'staghorn-blue', depth: 'floor', side: 'left', dx: -3, distance: 0.25 },
    ],
  }
  ```

  `depth` is metres inside `depthMeters`, or `'floor'` to stand on the seabed (floor
  pieces line up outward from the line, in list order). `dx` (sprite cells, away from the
  line) and `dy` (sprite cells, down; not for floor pieces) offset a piece to compose
  groups, so a group scales with its sprites, and
  `distance` (0 near to 1 far) sets it back. `species` must be on the
  reserve's own roster. Sprites face left; `flip` turns one to face the line from the
  left. Pieces keep clear of the depth labels beside the line.
- **Sprites** live in `src/data/pixelSprites.js` as character grids over one shared
  palette (`SPRITE_PALETTE`), rendered by `PixelSprite.jsx`. Every sprite faces left.
  Check a new one at large scale before shipping: the silhouette and one or two field
  marks are what make it read at 2 px per cell.

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
| Shortfin Mako Shark | `cruise` | `open-sea`  | apex predator, ride host |
| Giant Sunfish       | `drift`  | `the-drift` | slow gelatinous grazer, ride host |
| Live Sharksucker, Whitefin Sharksucker, Common Remora | `cruise` | `open-sea` | ride the mako |
| White Suckerfish, Marlinsucker, Slender Suckerfish | `cruise` | `open-sea` | ride the mako only occasionally |
| Whalesucker         | `cruise` | `open-sea`  | swims free until a whale or dolphin arrives |
| Spearfish Remora    | `cruise` | `the-drift` | rides the Mola           |

The Open Sea is a self-contained food chain (bait → mid → apex) at one tempo band.
The sunfish was pulled out into The Drift because its `drift` tempo clashes with the
pursuit hunters — the exact case the coherence guard protects against. The remoras are
the exception the guard allows: riders take their host's pace.
