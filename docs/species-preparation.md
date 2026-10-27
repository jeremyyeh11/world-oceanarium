# Next two species: GLB handoff

Prepared 2026-10-27, `v0.39.0-dev_1`, on Jeremy's request. Canonical biological and
draft behaviour data are in `src/data/species.js`; source credits are in
`src/data/sources.js`. This document records intake decisions and remaining gates,
not a second species database. [Fish queue](fish-queue.md) ·
[Species checklist](new-species-checklist.md) · [Caudal-wave contract](procedural/caudal-wave.md).

## Current boundary — clean `v0.39.0`

The unicornfish GLB was supplied on 2026-10-27 and registered with the existing
caudal-wave, reef, environment-manifest and Atlas systems. Jeremy confirmed six
dev adults at 40–55 cm FL; `creatures_dev` IDs 841–846, three of each sex, size
parameters 0/0.2/0.4/0.6/0.8/1. One adult model represents both sexes; its depicted
sex and photo provenance have not been established. Do not infer a licence.

Yellowfin is active in The Open Sea in `v0.40.0-dev_2`: the supplied model,
Atlas specimen and one 299-fish development school. The runtime joins all five
source parts without removing geometry. No new loading owner, motion architecture
or database migration was added.

Swim constants describe authored feel, not measured animal speeds. Jeremy accepted
the unicornfish from `v0.39.0-dev_5` on 2026-10-27 and explicitly approved clean
promotion/merge plus six public adults. Yellowfin still needs visual acceptance, public stocking approval and clean release.

Public unicornfish: IDs 847–852, three of each sex, size parameters
0/0.2/0.4/0.6/0.8/1, matching the dev size distribution. The repository backup ran
before/after the insert, with dedicated snapshots of both sources under ignored
`.supabase-creature-backups/releases/unicorn-2026-10-27/`. Production is 503→509;
all pre-existing rows are byte-for-byte unchanged, and dev remains unchanged at 502.
Explicit IDs were allocated above both tables' maxima under transaction locks;
no sequence, schema or policy changes. The supplied model is approved for this
integration; its underlying photo licence remains unspecified, not inferred.

### Unicornfish intake record

- Original: Jeremy's `naso unicornis.glb`, 1,723,400 bytes, SHA-256
  `f7916e72b78ed2682b1ad7a990c4d9a147c5ed658a1c7b06aa0ff97c488bf1c9`.
  The original is untouched. Runtime copy is rebuilt with
  `python scripts/prepare-unicornfish-model.py "<original path>"`.
- Five meshes, 5,278 exported vertices / 2,684 triangles: body `naso_unicornis`,
  `pectorall/r`, `pelvicl/r`. No clips, bones, skins or morphs. Winding agrees with
  normals; all five signed volumes are positive. Nose −Z, up +Y.
- Source fork length 57.4027938843: mouth vertex 106 to the midpoint of central
  caudal rear-rim vertices 150/250 (original body POSITION accessor). The latter
  bracket the middle rays; this is an approximate geometric reference on the
  faceted model. Tail-tip bounds are 59.8211669922. Model scale
  `0.04877811358180113` maps the fork reference to 2.8 WU / 70 cm FL. The Atlas
  uses that same reference.
- All node translations baked into positions, then shifted by source
  `[-1.4091576338, 2, 9.6684169769]`: centred laterally, near the body axis and
  halfway along the fork length. All five runtime node transforms are identity.
- Original 960 × 616 PNG retained byte-for-byte; alpha is 255 throughout, so the
  material uses opaque rendering. No resampling, topology or normal changes.
- Before/after production backups via the repository backup script; separate
  ignored dev snapshots contain 496 before / 502 after. Existing dev rows unchanged.
  The dev ID sequence was already behind existing IDs (default insert collided at
  682 and rolled back); insertion allocated 841–846 under a dev-table lock, leaving
  the shared sequence and production rows alone.

## Bluespine Unicornfish — `naso-unicornis`

Intended reserve: The Reefs. Felt intention: quietly working across a reef patch,
with deliberate grazing visits and loose company. Six dev adults at 40–55 cm fork
length are confirmed (1.6–2.2 WU). Size 1 is the sourced 70 cm fork-length maximum
(2.8 WU), not a proposed population of record-sized fish.

Reuse the labriform `caudal-vertex` configuration: firm body, pectorals rowing at
cruise, tail contributing more in turns and bursts. Start structurally from the
bannerfish, not its plankton-picking or cleaner behaviour. `schooling: false` plus
`group.maxSize: 6` lets each fish retain its own rock visits. Both existing coral
forms explicitly set `peck: 0`; this algae browser must not bite live coral. Existing
rock pecks represent grazing; there is no simulated algae growth/removal system.

Research decisions:

- FishBase supplies taxonomy, range, habitat, maximum fork length and LC status
  (assessment 7 May 2010). Its 50 cm common length is **total length** and is not
  substituted for a measured fork length.
- Moore, Rechelluul & Victor (2015), section 3.3.5, supplies sex-specific mean
  fork lengths from a Palau commercial catch. These are regional catch
  means. Weight is calculated at those lengths using the study's pooled relation;
  it is not an observed mean weight or a sex-specific relation.
- Andrews et al. (2016) supersedes preliminary slow-growth/maturity estimates:
  Hawaiian median maturity is near 2 years male / 3 years female. Validated
  longevity exceeds 50 years; this is a record, not mean survival.
- Georgia Aquarium supplies visible sex differences and the uncertainty over
  horn function. Species-specific eggs per spawning batch were not established
  in the consulted sources, so that field remains explicitly Unknown.

Model emphasis: horn, blue paired tail plates, body silhouette and tail filaments.
The forehead horn should not project past the mouth. No sex-specific second model
is required for the first intake; record which sex the supplied specimen depicts.

## Yellowfin Tuna — `thunnus-albacares`

Reserve: The Open Sea. Felt intention: continuous, purposeful forward travel in
one substantial school. Jeremy requested a random count from 200–300; the single
draw was **299**. Adults use a configured 120–150 cm fork-length range (4.8–6 WU);
size 1 is the sourced 239 cm maximum (9.56 WU).

Existing `caudal-vertex` supplies a nearly rigid front and compact tail stroke.
The existing body-clearance school cloud uses an unlimited group cap, packing 0.3,
gaps 0.7 lateral / 1.4 longitudinal / 0.6 vertical body lengths, drift tolerance
0.06–0.16, and turn-rate scale 0.35. Pitch is limited to 6 degrees; hovering and
independent timed bursts are disabled. The species-specific wedge leaves room for
the full formation and its turns. Ordinary menace/wariness supplies interspecies
response; members of the same school are excluded from predator threat avoidance.
Hunting/capture is outside this implementation.

Research decisions:

- FishBase supplies taxonomy, fork-length maxima/common length, school structure,
  distribution and global LC status (assessment 15 January 2021).
- NOAA supplies broad maturity and spawning context. Its older 6–7-year longevity
  text is superseded by ICCAT's validated Atlantic ages up to 18 years; a record
  across pooled sexes must not be presented as average life expectancy.
- Atlas size is explicitly a common-length proxy, not male/female measured means.
  Whole weight is derived using Morita's western/central Pacific fork-length
  relation reproduced by FAO, within its sampled range for the proposed fish.
- Pacicco et al. (2023) supplies the observed batch egg range, labelled with its
  Gulf of Mexico origin. A spawning batch is not annual fecundity.
- Monterey Bay Aquarium supplies ram ventilation and heat-retention context.

Model emphasis: fusiform body, caudal keels, crescent tail, yellow finlets and
second dorsal/anal fins appropriate to the selected adult size. Longer yellow fins
are not a male-only trait. One adult model can serve both sexes initially.

## Yellowfin intake — `v0.40.0-dev_2`

The updated `thunnus albacares.glb` (2026-10-27) contains a static body and four
independent paired fins: 3,586 exported vertices / 1,860 triangles total. It has one
opaque embedded PNG and no bones, clips or vertex colours. Intake joins the five
parts into one primitive, preserving every vertex, triangle, normal, UV and image.
Paired stabilising fins retain the supplied pose on the rigid front; the tail
supplies thrust. Source-part vertex/index ranges are recorded in mesh extras and
checked by the asset verifier, alongside the source-hash guard.
The original is untouched. The hash-guarded `scripts/prepare-yellowfin-model.py`
reproduces the centred runtime copy; provenance is beside the GLB.

Measured mouth vertex 8 to central caudal notch vertex 91: 2.240529418 source units.
Tail-tip span is 2.398549914. Scale 4.266848684615521 maps fork length to 9.56 WU /
239 cm at size 1; Atlas uses the same reference. The mouth/fork midpoint is the
root-follow pivot. Orientation is nose -Z, Y up. Two-sided fins are preserved;
unnecessary BLEND is removed because every source alpha sample is 255.

Existing `caudal-vertex` supplies a late compact tail stroke: flex 0.55–0.92,
amplitude 0.100824 source units (0.045 fork lengths), turn strength 0.067216,
wave speed 3, travel 2.4, burst amplitude 0.7. This is authored motion tuning,
not a measured tailbeat frequency. Dorsals, anal fin, finlets and tail remain
attached through the shared deformation. No new motion architecture was added.

The runtime-shader tile is a left-facing three-quarter head close-up, rendered
alone. Browser checks at 1366x900, 390x844 and 844x390 show the complete Atlas
specimen and scale bar without fin/tail clipping or horizontal overflow. These
are browser viewport checks, not physical-phone testing. The live Open Sea follow
view is reviewed locally. The normal reserve manifest now includes the tuna model;
no bundled fallback residents were added.

Development stocking: `creatures_dev` IDs **853–1151**, 150 females / 149 males,
all adult, ocean/epipelagic/alive. Six averaged uniform random draws supply a
centre-weighted size parameter within 0–1; actual stocked range is **124.065–145.872
cm FL**. Dev count 502 → 801. `npm run backup:creatures` plus separate full snapshots
of both tables ran before and after. All 509 production rows and all 502 existing
dev rows compare identically. Backups live in ignored `.supabase-creature-backups`.

Validation: full `npm test`, procedural verifier, scoped lint (eight existing
warnings), and build pass. `node scripts/inspect-ray-school.mjs 180 2 --verify
--count=299 --species=thunnus-albacares` runs the actual Fish frame: no wall contacts,
stable spread, bounded individual motion, one body-envelope brush pair in 3 of 181
samples. Tuna use a slender body envelope; the unchanged ray run retains its wider
wing-clearance checks. A 60-second single-fish frame check travels 148.6 WU with no
boundary contacts, confirming the unpaired fallback.

Performance: the five-part model measured 18.8 FPS / 3,139 full-frame draw calls.
The joined model sampled roughly 52–59 FPS / 547–729 calls locally at DPR 1,
depending on view and culling. Geometry is unchanged; these are browser samples,
not a sustained 60 FPS guarantee or physical-phone measurement. Keep this build
in development for visual/feel acceptance and performance review.

## Export contract for both GLBs

1. Follow the existing [caudal-wave Blender contract](procedural/caudal-wave.md).
   Nose points **−Z**, up is **+Y**, transforms applied, shared origin at a useful
   mid-body follow pivot. Static geometry: no bones, skin weights or authored clips.
2. Keep the body and fins rooted in flexing regions in the same deforming mesh
   (joined islands are fine). Put rowing pectorals in separate objects, with their
   origins at the attachment; names must include `pectoral` and end in `l` / `r`.
   Tail plates/keels, finlets and rear fins must follow the body wave.
3. Keep enough longitudinal rings through the rear bend. Preserve the faceted
   style; verify outward normals. `COLOR_0` stays white. No motion paint is needed
   for the caudal wave. Solid photo textures should be JPEG/opaque; preserve real
   fin transparency only where needed. Supply photo provenance for credits.
4. **Record the nose-to-tail-fork distance separately from total mesh bounds.**
   `model.scale = maxBodyLengthMeters / 0.25 / sourceForkLength`.
   Tail tips/filaments extend beyond this biological reference. Never scale a
   nose-to-tip measurement as if it were fork length. The Atlas source-length
   entry must use the same fork distance so its specimen and scale bar agree.
5. Expected destinations after intake:
   `public/models/fish/naso-unicornis/naso-unicornis.glb` and
   `public/models/fish/thunnus-albacares/thunnus-albacares.glb`.
   Actual mesh names, scale, source offsets, shader amplitudes/turn bend (source
   units), fin roots and Atlas poses must come from inspection, not guessed config.

## Remaining Yellowfin acceptance gates

1. Jeremy reviews the complete school, fin silhouette, continuous motion and follow view.
2. Check physical-phone performance and decide whether further rendering work is needed.
3. Obtain separate public stocking and clean-release approval.

## Documentary reel briefs (30 seconds each)

Unicornfish — **“Unicorns are real.”** 0–5 s: side silhouette/horn reveal. 5–15 s:
orbit toward the blue tail blades. 15–25 s: observe a grazing visit. 25–30 s:
widen to the loose reef group and reveal the name. Narration distinguishes the
horn's uncertain purpose from the tail blades and algae diet. No fighting or coral
destruction animation is required.

Yellowfin — **“Every breath is a swim.”** 0–5 s: uninterrupted side-follow and the
breathing hook. 5–15 s: mouth/gill/tail close views with narration about water flow.
15–25 s: the school banks, showing yellow fins and streamlined bodies. 25–30 s:
continue into blue water and reveal the name. Do not imply simulated gill-fluid
dynamics; an explanatory graphic can illustrate the biology in the edit.

## Source links (consulted 2026-10-27)

- [FishBase: Naso unicornis](https://www.fishbase.se/summary/Naso-unicornis.html)
  and [Thunnus albacares](https://www.fishbase.se/summary/Thunnus-albacares.html).
- [Moore et al. 2015, SPC](https://purl.org/spc/digilib/doc/qdpre),
  [searchable Palau mirror](https://palau-data.sprep.org/system/files/Creel%20survey%20and%20demographic%20assessments%20of%20coastal%20finfish%20fisheries%20of%20southern%20Palau.pdf),
  [Andrews et al. 2016](https://repository.library.noaa.gov/view/noaa/52477),
  [Georgia Aquarium](https://www.georgiaaquarium.org/animal/bluespine-unicornfish/).
- [NOAA Pacific Yellowfin Tuna](https://www.fisheries.noaa.gov/species/pacific-yellowfin-tuna),
  [ICCAT 2024–2025](https://www.iccat.int/documents/scrs/execsum/yft_eng.pdf),
  [FAO/Morita weight relation](https://www.fao.org/4/t1817e/t1817e05.htm),
  [Pacicco et al. 2023](https://repository.library.noaa.gov/view/noaa/49255),
  [Monterey Bay Aquarium](https://www.montereybayaquarium.org/animals-the-ocean/animals-a-to-z/yellowfin-tuna).

## Preparation validation

Atlas copy review (`v0.39.0-dev_4`): Jeremy requested removing the FL abbreviation
and all parenthetical notes from the two new entries, with a separate Atlas clarity
pass later. The values, fork-length scale, regional/common-length proxies, estimated
weights and longevity caveats documented here and in source comments are unchanged.

`npm test`, `npm run build` and `npm run verify:procedural-fish-assets` pass.
Application/test/tool lint passes with the existing eight warnings using
`npx eslint src tests scripts vite.config.js --ignore-pattern '.claude/**'`.
The unscoped `npm run lint` also crawls unrelated nested `.claude/worktrees` and
their generated bundles, and fails there; those files are outside this patch.
New regression coverage proves queued species do not warm missing assets, enter
reserve manifests or become invisible residents even if a live row arrives early.
It also protects fork-length scaling, mass units and the coral-biting overrides.
Unicornfish intake (`v0.39.0-dev_2`): those checks pass again with the supplied
model and real thumbnail. Desktop 1440×900, portrait 375×812 and landscape
844×390 Atlas checks show the whole specimen and fork-length scale; portrait
document width equals viewport width. The dev Reefs follow view was checked with
the six approved adults. Screenshot evidence is saved in the 2026-10-27 Codex
visualization folder (`unicornfish-atlas-desktop.png`, `unicornfish-atlas-portrait.png`,
`unicornfish-atlas-landscape.png`, `unicornfish-tank-follow.png`). Temporary capture
code was removed; the shared fish runtime and loader architecture are unchanged.
Jeremy's motion/feel approval and physical-phone measurements are not claimed.
