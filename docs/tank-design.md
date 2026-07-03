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
    biome: 'ocean',            // drives environment (water, light, bubbles)
    depthZone: 'epipelagic',   // drives the zone label / framing
    species: ['amblygaster-sirm', 'coryphaena-hippurus', 'isurus-oxyrinchus'],
  },
  {
    id: 'the-drift',
    name: 'The Drift',
    tagline: 'Slow grazers of the open blue',
    biome: 'ocean',
    depthZone: 'epipelagic',
    species: ['mola-alexandrini'],
  },
]

export const DEFAULT_TANK_ID = 'open-sea'
```

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

Files touched by this system:

- `src/data/species.js` — `tempo` on species, `TANKS`, `DEFAULT_TANK_ID`
- `src/utils/speciesLookup.js` — `creaturesForTank`, `TANK_BY_ID`, dev guard
- `src/components/Biome.jsx` — tank-based creature filter
- `src/components/TankView.jsx` — accepts `tank`, shows its name in the header
- `src/App.jsx` — `activeTankId` state, tank→biome resolution, the switcher
- `src/index.css` — `.tank-switcher` / `.tank-switch-button` styles (bottom-center pill)

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
  biome: 'ocean',           // must be an existing biome id (see BIOMES)
  depthZone: 'mesopelagic', // must be an existing depth-zone id (see DEPTH_ZONES)
  species: ['some-species-id'],
}
```

The switcher renders one button per tank automatically (it only shows when
`TANKS.length > 1`). Keep every species in the tank on a compatible tempo, or the dev
guard will warn.

### Change the default tank

Set `DEFAULT_TANK_ID` in `species.js` to another tank's `id`.

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
