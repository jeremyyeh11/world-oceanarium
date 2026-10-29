# Species preparation: GLB handoff

Prepared 2026-10-27, `v0.39.0-dev_1`, on Jeremy's request. Canonical biological and
draft behaviour data are in `src/data/species.js`; source credits are in
`src/data/sources.js`. This document records intake decisions and remaining gates,
not a second species database. [Fish queue](fish-queue.md) ·
[Species checklist](new-species-checklist.md) · [Caudal-wave contract](procedural/caudal-wave.md).

## Spearfish Remora — `remora-brachyptera` (prepared `v0.48.0-dev_1`)

Reserve: The Reefs, riding the giant sunfish ([fish queue](fish-queue.md), Up next 7). Felt
intention: a pale passenger that is almost part of the Mola, clamped to its flanks for minutes
at a time and rolling with it through a sun-bask, letting go only for a short swim before it
takes a spot again. Its ride (`rideSeconds` 90–200) is long and its time off (`freeSeconds`
6–14) the shortest of any remora's. Must not happen: a remora roaming the reef on its own, a
rider poking through the Mola's rowing dorsal or anal fin, or riders crowding the Mola so
thickly it reads as spotted.

Ready: the hidden species entry (no model, on no roster, no rows, out of the Atlas) with
FishBase facts and its `hitchhiker` block. In this build:

- Host range verified in Anislado-Tolentino et al. 2022 (Hidrobiológica 32: 71–74, now in
  `STUDY_CREDITS`): billfishes and swordfish first, and in the gill cavity of *Mola* sp., the
  sharptail mola and the blue shark, on loggerhead turtles, occasionally free. Weights
  unchanged: billfish 1, sunfish 0.7, shark 0.25, turtle 0.25. The reserve's only host is the
  Mola, so it accepts the Mola on 70% of its tries and escorts it on many of the rest.
- FishBase (consulted 2026-10-29): 50 cm TL maximum, 25 cm TL common, LC (assessed 2009),
  pelagic-oceanic, length–weight a 0.00263, b 3.17. No depth range, no maturity length, no age
  or fecundity data; a search found no age, growth or spawning study of this species. Averages
  stay at the common length (25 cm, 0.07 kg); life span, maturity and eggs stay Unknown.
- Size floor: `sizeRange` 0.6–1.0 gives 30–50 cm (1.2–2.0 WU), all above 27 cm.
- Atlas copy no longer describes how the reserve should play it (as on the common remora).
- The Mola covers this rider with no change: `rideHost.groups` has `sunfish`; its 12 anchors
  regenerate byte-for-byte from today's GLB with the command recorded in `rideAnchors.js`; and
  `tests/fishRide.test.mjs` already fits every attaching rider with a sunfish weight on every
  Mola spot. Measured for this one (stand-in straight back): it lies on all 12 spots at 30, 40
  and 50 cm, median disc lift 0, worst 2.2 mm. A full-size Mola (13.2 WU, load 80%) carries
  five 50 cm riders, six at 40 cm or eight at 30 cm at once, every arrival order tried (checked at
  full size only; the reserve's Mola is size 0.88). No other rider claims Mola spots: the pilot fish,
  bannerfish and angelfish only escort.
- Swim room: `DRIFT_RIDER_BOUNDS`, the Mola's own box, so a rider let go anywhere the Mola
  swims is already inside its swim volume.

Open for Jeremy:

- **Count.** Suggested 4, sizes spread 30–50 cm (size parameters 0, 0.33, 0.67, 1; about
  6.4 WU of the Mola's 10 WU), so all four can ride at once with a spot spare as they rotate.
  `creatures_dev` first (backups first); production rows only on his go-ahead.
- **Which Mola.** Both tables hold one Mola, id 21 (male, size 0.88), in The Reefs. The riders
  share it, unless he wants a second Mola for them, which is its own production change.
- **The GLB.** A remora body plan like the sharksuckers': nose −Z, up +Y, origin anywhere, one
  body mesh (a disc with its own material goes in `followBodyMeshNames`). Slim but deep-chested
  (depth 14–17% of standard length), short rounded pectorals (*brachyptera*, "short fin"), a
  disc of 14–17 laminae over 28–40% of standard length, dorsal fin starting just ahead of the
  anal, an emarginate to truncate tail. Fresh colour: uniformly pale whitish grey, the tail with
  a blackish margin (Anislado-Tolentino et al. 2022); whitish to pale blue in life. Scale it from
  total length. Flat-shaded as always.
- **Rider intake** once it lands ([ride-hosts.md](ride-hosts.md), Remora models): `node
  scripts/fit-rider-model.mjs remora-brachyptera`, textures and credits, Atlas source length
  and pose, `SUPPLIED_REMORA_SOURCE_LENGTHS`, verifier target, drop `hiddenInAtlas`, add it to
  The Reefs' roster, the Atlas tile with its first swim, then `npm test` against its measured
  top line.
- Watch in the live tank: a rider on the Mola's upper flank lets go before a sun-bask would lift
  it above the water. Riding the gill chamber, as juveniles do, stays a backlog item (ROADMAP,
  Remoras).

## Golden Trevally — `gnathanodon-speciosus` (prepared `v0.41.0-dev_1`, model `dev_2`)

Reserve: The Shallows, as a follower of the giant manta (Jeremy, 2026-10-28). Felt
intention: small gold escorts keeping pace with something enormous, slipping ahead of its
head and under its body, now and then peeling away. Must not happen: a trevally inside a
flapping wing, or a school milling on its own away from the manta most of the time.

Prepared: hidden species entry (no model, no roster slot, no rows), FishBase facts, Farrag et
al. 2019 life span, the `hitchhiker` follower block and its swim room. The manta gained an
escort-only `rideHost` ([ride-hosts.md](ride-hosts.md), Followers) in the same build.

Research decisions:

- FishBase: range east to Baja California, the Gulf of California and Ecuador; 0–80 m;
  120 cm TL maximum, 75 cm FL common length, 15 kg maximum; Lm 32.5 cm; LC (9 March 2015).
  Adults "closely swim around sharks and other large fishes"; juveniles in particular
  pilot them. No source names mantas, so the manta takes its `ray`/`large-fish` weight (0.8).
- Farrag et al. 2019 (southern Arabian Gulf): L∞ 84.5 cm TL, K 0.28, life span estimated at
  about 11 years. Labelled estimated; no aged maximum is published.
- Weight at the common length from FishBase's Bayesian relation (a 0.01318, b 2.96, cm TL):
  4.7 kg, a slight underestimate since the common length is a fork length.
- Reproduction, sexual dimorphism and eggs per spawning stay Unknown.

Decided by Jeremy (2026-10-28):

- **Life stage: adults.** Young fish are bright gold with bold black bars and are the classic
  pilots, but the piloting ones are near or under the 27 cm floor. Adults turn golden-silver
  with faded bars and a few dark blotches; the model shows that look. Sizes follow the
  entry's 50–75 cm TL (2–3 WU).
- **Count: six,** in `creatures_dev` first.

Model intake (2026-10-29, `dev_2`): Jeremy's GLB is a body and four independent paired fins
sharing one material, flat-shaded, normals outward. Its texture is a whole 2048 × 1362 aquarium
photo from Commons (Norbert Potensky, CC BY-SA 3.0, credited); the UVs use only the fish, so
`scripts/prepare-golden-trevally-model.py` crops to that area plus 8 px, resizes to 1024 px
wide and remaps the UVs (GLB 4.8 → 1.3 MB). The photo has no alpha, so BLEND is dropped. Scale
is from total length, mouth to lower lobe tip: 1.1995 source units = 4.8 WU (fork length 0.982).
The photo shows a fish with bold bars, the younger look; Jeremy's call stands as six adults by
size. Motion is the pilot fish's carangid `caudal-wave` config with amplitude and turn scaled to
this model's units. `creatures_dev` ids 1152–1157, size parameters 0/0.2/…/1 (50–75 cm), three
of each sex. Production `creatures` ids 1451–1456, the same sizes and sexes, on Jeremy's
go-ahead (2026-10-29; 808 → 814 rows). Backups before and after both writes. Shipped in clean
`v0.41.0`.

## Current boundary — clean `v0.40.0`

The unicornfish GLB was supplied on 2026-10-27 and registered with the existing
caudal-wave, reef, environment-manifest and Atlas systems. Jeremy confirmed six
dev adults at 40–55 cm FL; `creatures_dev` IDs 841–846, three of each sex, size
parameters 0/0.2/0.4/0.6/0.8/1. One adult model represents both sexes; its depicted
sex and photo provenance have not been established. Do not infer a licence.

Yellowfin is included in clean `v0.40.0`, accepted from `v0.40.0-dev_6`: the supplied model,
Atlas specimen and one 299-fish development school. The runtime joins all five
source parts without removing geometry. No new loading owner, motion architecture
or database migration was added.

Swim constants describe authored feel, not measured animal speeds. Jeremy accepted
the unicornfish from `v0.39.0-dev_5` on 2026-10-27 and explicitly approved clean
promotion/merge plus six public adults. Jeremy requested Yellowfin clean promotion and merge on 2026-10-27.
Jeremy separately approved public stocking on 2026-10-28. Production now includes
299 adults, IDs **1152–1450**, with the reviewed development size/sex distribution:
150 females / 149 males, 124.065–145.872 cm FL. Production total is 509→808;
all prior production rows and all 801 development rows are unchanged. Dedicated
before/after snapshots are under ignored
`.supabase-creature-backups/yellowfin-public-2026-10-28/`; the repository backup
script also ran before/after. No Whale Shark data changed in this stocking.

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
not a sustained 60 FPS guarantee or physical-phone measurement. Jeremy accepted
clean promotion/merge from dev_6; physical-phone measurement remains a follow-up.

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

## Yellowfin clean release and remaining follow-ups

Jeremy requested clean `v0.40.0` promotion/merge from `v0.40.0-dev_6` on 2026-10-27.
The supplied model, fin silhouette, school, solo fallback and adult Whale Shark
visibility changes are included. No production creature writes are part of this
merge. The Atlas entry is available; the 299-fish tank school was separately added
to production on Jeremy's approval on 2026-10-28 (see Current boundary above).
Physical-phone measurement remains open in `ROADMAP.md`.
The source photo's licence remains unspecified, not inferred.

Adult Whale Shark #410's dev_6 real-frame visibility check (10 minutes, 16:9 default
camera, centre inside frustum and within 120 WU) starts visible at 0 s, is visible
91.8% of samples, has a longest absence of 16.5 s and no boundary contacts. The
prior dev_5 first pass took 106.6 s and centre visibility was 10.1%. These are
single-shark simulation results; they do not replace live/phone visual review.
Outer bounds remain wide; `swim.goalBounds` and the existing true-angle yaw/pitch
arc bring it through the visible scene. Contract: `docs/tank-design.md`.

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
