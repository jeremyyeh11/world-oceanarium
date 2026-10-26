# coral-sway

Shader type: `coral-sway` · Status: **Implemented** (landscape corals, `src/utils/coralSway.js`)

Soft corals rocking in the surge. First used by the Giant Sea Fan (*Annella mollis*), a landscape
species on The Reefs. Unlike the other types here it is not a creature's swim: a coral has no
`swim`, no creature rows and no `proceduralAnimation` block. Its kit meshes are placed on the rocks
(`src/components/seaFanPlacement.js`) and their materials patched by `applyCoralSway`.

## Felt intention

- **What watching it should feel like:** the water moving. A fan leans slowly one way, then back,
  every few seconds, its rim swinging furthest, the way kelp or a curtain shows a breeze you
  cannot see. Neighbouring fans lean a beat apart, so the surge reads as passing through the reef.
- **Why that fits:** sea fans grow broadside to strong tidal currents to sieve plankton
  (SeaLifeBase, after Goh & Chou 1996); the skeleton is flexible, the holdfast fixed.
- **Must not:** wobble like jelly, flap like a flag, move in lockstep with every other fan, or
  move the holdfast. Never so far that it reads as a storm: the reef is calm.

## How it moves

Two vertex attributes, baked when a fan is placed (`addSwayAttributes`), so merged meshes sway too:

- `aSwayFlex`: 0 at the holdfast to 1 at the point of the fan farthest from it.
- `aSway`: xyz the swing direction (the fan's face normal, along the current) times the rim's
  swing in WU; w the fan's phase (its position along the current, plus jitter).

The vertex offset is `aSway.xyz × flex² × (sin t + flutter × flex × sin(2.7 t + 4 flex))`, with
`t = time × 2π / period + phase`. `flex²` keeps the trunk near the holdfast nearly still; the
`flutter` term is a smaller, faster ripple that grows toward the rim. One shared clock
(`SWAY_TIME`, advanced by `useSwayClock` in each canvas) drives every fan; the CPU does nothing
else per frame. The Atlas specimen uses the same code (EncyclopediaPage.jsx `prepareAtlasSway`).

Config (landscapes.js `SEA_FAN_SWAY`, shared by the tank and the Atlas):

| Key | Default | Meaning |
| --- | --- | --- |
| `period` | 7 | Seconds for one swing back and forth (the surge) |
| `bend` | 0.05 | The rim's swing either way, as a share of the fan's height (0.28 WU on a 5.6 WU fan) |
| `flutter` | 0.25 | The faster ripple's share of the swing at the rim |

Normals are not bent with the fan (the swing is a few degrees), and the fish's raycast surfaces
and obstacle boxes stay at the rest pose; the obstacle box is padded instead.

## Blender contract: sea fan

Jeremy's source: `_blender models/annella mollis.glb`. Build the kit with:

```
"C:/Program Files/Blender Foundation/Blender 5.2/blender.exe" -b --factory-startup \
  --python scripts/build-sea-fan-kit.py -- "<path>/annella mollis.glb" public <preview-dir>
```

`--alpha="<image key>=<mask>"` replaces a lattice texture's alpha with a black and white mask
(white solid). Jeremy's fans read "too see through" (2026-10-26); he painted fuller masks
(`annella mollis alpha orange|pink|yellow.jpg` beside the source) and then baked them into the
GLB's own textures (34/18/32% solid), so the current build needs no `--alpha`.

It writes `public/models/landscape/sea-fans.glb` (every fan, for the tank), prints each fan's
size, triangles and materials, and warns where the model breaks the contract. Then build the
Atlas specimen (all three fans on a low limestone rock: the orange in the middle, the yellow and
pink leaning out left and right, after Jeremy's sketch) from it:

```
"C:/Program Files/Blender Foundation/Blender 5.2/blender.exe" -b --factory-startup   --python scripts/build-sea-fan-atlas.py -- public/models/landscape   public/models/fish/annella-mollis/annella-mollis.glb <preview-dir>
```

1. **Real size, metres.** 1 unit = 1 m. Fans 0.75 to 2 m tall (most colonies are 76 to 150 cm).
2. **One to three fans per file**, of different shapes, each its own top-level object (child
   objects are fine: each top-level object and its children make one fan). The placement scales
   them to 3 to 7.5 WU tall, so a few distinct silhouettes beat many sizes of one.
3. **Upright, facing front view.** +Z up, the lattice spread across X and Z, facing −Y (what the
   front view sees). A fan modelled lying flat in the XY plane (Jeremy's first three, 2026-10-26)
   is stood up by the script, turned about its root so the least of it hangs below the root
   (within 70° of the root-to-middle direction). **The object's origin is the holdfast:** put it
   at the root of the trunk (taking the trunk's lowest point instead left fans floating).
   Lattice hanging below the root can only go into the rock, so the fan fits fewer spots; the
   yellow fan's 31 cm does. Transforms need not be applied.
4. **Trunk and main branches: low-poly tubes.** 6 sides, 3 to 6 main branches, flat shaded
   (the faceted style). They give the fan its thickness where it matters.
5. **Lattice: one plane, subdivided at least 8 × 8,** so it can bend. Trim it to the fan's
   outline: placement tests the plane's vertices against the rock, tables and staghorn, so the
   empty corners of a rectangle count as fan and cost it room on the bommies.
6. **Lattice material: alpha clip.** Image texture Alpha → **Math node, Round** → Principled BSDF
   Alpha. The exporter writes that as `alphaMode: MASK` (cutoff 0.5); for another cutoff use Math
   nodes for `1 - (alpha < cutoff)`. Never Blend: overlapping blended fans sort wrongly. An alpha
   wired straight in (Blend) gets the Round node from the script.
7. **Paint the mesh thicker than life.** A fan far off is drawn from a small mip of the texture,
   where thin strands average below the cutoff and vanish. Keep strands at least about 1.5% of
   the texture's width (15 px on 1024). The runtime smooths the cut edges with alpha to coverage.
8. **Texture: PNG with alpha.** The script scales a lattice's image to 2048 px at most and an
   image only the branches use to 1024, and writes WebP (Jeremy's first GLB was 76 MB with
   photo textures up to 4720 px; the kit is 4.1 MB). His fans are photo cut-outs; credit each
   photo in src/data/sources.js IMAGE_CREDITS.
9. **Budget: up to 3000 triangles a fan** (the yellow fan's branches are 4,646; fine for three
   models). No bones, animation clips or shape keys.

## Intake checklist

1. Run the kit script; read its warnings and preview.
2. Set species.js `maxBodyLengthMeters` to fan0's size (kit print-out) and EncyclopediaPage.jsx
   `MODEL_SOURCE_LENGTH_UNITS_BY_SPECIES['annella-mollis']` to the specimen's largest extent
   (Atlas print-out).
3. Give the landscape its `seaFans` block (landscapes.js), drop species.js `hiddenInAtlas`, and
   add `'annella-mollis'` to The Reefs' `landscapeSpecies` (all done for the first fans, `dev_2`).
4. Phone (375 px) review of the resting view: the fans read, sway gently, do not flicker far off,
   and none clips a rock, table or staghorn colony or floats.
5. Atlas tile in the same build (docs/new-species-checklist.md §6).
6. No creature rows: corals are landscape.

## Review gates

- No fan inside a rock, table plate or staghorn colony; no holdfast floating or under an overhang.
- The sway reads at the resting view on a phone and stays calm: no lockstep, no flag-flapping.
- The lattice does not shimmer or vanish at 60 to 90 WU.
- The staghorn still crowns the bommies: fans go in before it and it keeps clear of them
  (`inFan`), so a fan costs a bommie a few colonies.

## Known limits

- Reef fish treat fans as solid (site rays, obstacle field) but never visit them: the `fan` coral
  form has no modes yet (docs/reef-behavior.md, Coral forms).
- The Reefs is drawn as 0 to 10 m deep; *Annella mollis* lives at 10 to 40 m. Jeremy's call.
- The sight test (`minVisible`) only checks the rock: a fan can still sit behind a table, the
  staghorn (placed after it) or a fish.

## Placement (seaFanPlacement.js)

Jeremy (2026-10-26, on `dev_2`): fans floated, clipped into corals and walls, only ever stood
upright, and were too few. Since `dev_3`:

- Rock only: a ray from outside meets a rock face (tops, slopes and walls; not an overhang's
  underside or rock at the sand); the fan grows along the face's normal tipped up (`GROW_UP`),
  its face turned toward the current. Its holdfast is sunk 4% of its height into the rock and
  must test as inside rock, so none floats.
- Clashes: a 14 × 14 grid over the fan's face (where the model has lattice) and 24 branch points
  must stay out of every drawn rock (not only the bommie's), the sand, every table's plate and
  stalk, and every fan already placed; only points within 12% of the fan's height of the holdfast
  (by distance) may touch rock. The staghorn, placed after, keeps its sample points and its body
  clear of the fans (`inFan` with an extra margin).
- Stances (`dev_5`): with the strict rock test most spots failed because a fan facing the current
  ran its lattice along the rock it grows from, so a spot tries up to eight stances (`VARIANTS`:
  turned up to 69° from the current, or tipped further out from the face) before giving up.
- Count: `perCluster` 3–6 on each table bommie, and 1–3 on each of up to 30 other rocks in front
  of the camera (`scatter`), at 2.2–6 WU. On desktop (`dev_5`): 25 fans (want about 140: tables
  crowd the bommies), 22 in frame, 11 in a phone's centre crop; dive to placed about 12 s (was 9),
  phone time unmeasured.
- Audit (`dev_5`, raycasts against rock seen from both sides; an earlier one-sided audit could
  not see inside rock and proved nothing): every holdfast is inside rock; 0.5% of sampled lattice
  points are inside rock (2.4% before the distance rule and stances), thin edges between the test
  points.
- Lighting: both faces of a fan are shaded with the front's normal (`applyCoralSway`), so the
  side facing away from the sun no longer reads dark or missing.
- Orientation (`dev_6`, Jeremy: fans must not face the rock wall): faces steeper than 45° use
  local flow along the wall (`surfaceNormal × up`). The fan's sheet projects out from the wall,
  with its face normal exactly tangent to it. Both signs of that flow axis and three upward
  leans (0.35, 0.9, 2) are tried to fit asymmetric branches; no yaw fallback may turn it toward
  the wall. Gentler tops keep the authored current and yaw variation. The placed fan retains
  `surfaceNormal` for orientation audits. The dev_6 layout: 14 fans, all three shapes, five fan
  centres in a 375 × 812 resting-camera crop; zero floating roots. Physical-phone review pending.
- Density (`dev_7`, Jeremy: restore around 25): scatter host spacing 6.5 WU (was 8), with 2–4
  candidate fans per rock (was 1–3), up to the same 30 host rocks. The shipped kits produce
  25 fans on 19 sites, all three shapes, five centres in the phone camera crop. Wall orientation,
  per-fan clearance, visibility threshold and size range are unchanged; all holdfasts remain
  inside rock. Placement still runs in the existing preparation slices, with no new frame work.
