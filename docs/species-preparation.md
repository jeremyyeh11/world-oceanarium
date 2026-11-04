# Species preparation: GLB handoff

Prepared 2026-10-27, `v0.39.0-dev_1`, on Jeremy's request. Canonical biological and
draft behaviour data are in `src/data/species.js`; source credits are in
`src/data/sources.js`. This document records intake decisions and remaining gates,
not a second species database. [Fish queue](fish-queue.md) ·
[Species checklist](new-species-checklist.md) · [Caudal-wave contract](procedural/caudal-wave.md).

## Spearfish Remora — `remora-brachyptera` (prepared `v0.48.0-dev_1`, model `dev_2`, tank `dev_3`, credit `dev_4`, shipped `v0.48.0`)

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

Decided by Jeremy (2026-10-30):

- **Count: four,** sizes spread 30–50 cm (size parameters 0, 0.33, 0.67, 1; about 6.4 WU of
  the Mola's 10 WU), so all four can ride at once with a spot spare as they rotate.
  `creatures_dev` rows once the model is in (backups first); production rows only on his
  go-ahead.
- **Host: the reserve's one Mola,** id 21 (male, size 0.88) in both tables. No second Mola.

Model (`v0.48.0-dev_2`, Jeremy's GLB, intake per [ride-hosts.md](ride-hosts.md), Remora models):

- Rig-free, nose −Z. The body has two primitives: `remora_brachyptera_1` (body with dorsal,
  anal and caudal fins) and `remora_brachyptera_2` (the suction disc, in
  `followBodyMeshNames`). Jeremy's retextured export (`v0.48.2-dev_1`) merged the disc into the
  body; `scripts/prepare-spearfish-remora-model.py` splits it back out (176 faces). The short pectorals and the pelvics are separate objects
  (`pectorall/r`, `pelvicl/r`) and flutter on their own.
- `scripts/fit-rider-model.mjs`: source length 3.5506 → 2 WU (scale 0.5633; 3.5093 before the
  retextured export's mouth and tail edits); the disc runs 24.5% of total length (about 28% of
  standard length, inside the 28–40% in life), its centre 0.3039
  body lengths ahead of the root; the second dorsal stands about 2 cm proud of the disc line.
  `npm test` fits that measured top line on every Mola spot.
- Stroke: the sharksuckers' 0.07 and 0.03 body lengths (amplitude 0.249, turn 0.107 source
  units); fin flutter 0.08 / 0.04, as on the whitefin.
- Texture (`v0.48.2-dev_1`): Jeremy retextured the model from Eric L. Chen's iNaturalist photo
  (one fish from above, the side and below, East China Sea, CC BY-NC 4.0, `chen-spearfish-remora`),
  replacing John Snow's Mexican Fish.com photos, which had no licence. The prepare script cuts
  the 2048 px PNG to the two views the UVs use (1536×783 JPEG) and drops BLEND (solid alpha):
  2.08 MB to 207 KB.
- Atlas: framed at 1.45 display units, between the bannerfish and the pilot fish; checked at
  375 px and on desktop.

Shipped in clean `v0.48.0` (2026-11-03, Jeremy: "merge"): production `creatures` ids 1480–1483,
the same four as dev (837 → 841 rows, backed up before and after).

Open:

- Riding the gill chamber, as juveniles do, stays a backlog item (ROADMAP, Remoras).

Tank (`dev_3`, 2026-11-02):

- `creatures_dev` ids 1183–1186 (dev table 832 → 836; production unchanged at 831), sizes 0,
  0.33, 0.67, 1, alternating sex, each with its own description. Backed up before and after.
- Checked in the dev tank: all four rode the Mola (id 21) within seconds of load, and ran the
  full cycle (attached, release, escort or free, approach, dock, latch, attached) on new spots.
  A ride measured 172 s (data: 90–200 s); they held on through the Mola's dive to y −13.
- Sun-bask (debug shortcut; it waits for a basking spot ahead of the Mola, so it can take a
  minute or two to start): the rider on the top spot let go at y 4.19 as the Mola rose and
  re-attached once it settled; one holding just under the limit stayed submerged (highest point
  4.46, surface 4.6).
- Atlas tile rendered off the largest rider (`public/atlas/remora-brachyptera-thumbnail.png`,
  470 px).

## Leather Coral — `sarcophyton-glaucum` (prepared `v0.47.0-dev_1`, model `dev_2`, sway `dev_3`–`dev_7`, shipped `v0.47.0`)

Reserve: The Reefs, a landscape coral like the tables, staghorn, sea fans and brain corals
(fish queue, Up next item 6), swaying on the sea fans' `coral-sway` shader. Jeremy picked
*S. glaucum*, the toadstool leather coral, over *S. trocheliophorum* (2026-11-01): it has the
classic mushroom silhouette (smooth stalk, wide folded cap) and by far the best-studied biology;
the elephant-ear species would have left most of the Atlas Unknown.

Felt intention: a few fat, fleshy toadstools that lean slowly with the surge, their caps
rocking together like one thick body, not a lattice. Why: it is a soft coral with no hard
skeleton, a leathery body stiffened only by spicules, that grows slowly and lives long on calm
reef flats, lagoons and the lower flanks of reefs. Must not happen: wobbling like jelly,
fluttering like the fan's rim, swinging further than the fans beside it, or moving out of step
with the surge that moves them.

Prepared: hidden species entry (no model, on no tank, no landscape placement, out of the Atlas),
Benayahu & Loya 1986, Schleyer et al. 2004 and Chao et al. 2017 credited in `STUDY_CREDITS`, and
a test that keeps it hidden and off every tank.

Size check: colonies up to 80 cm across (Coral Trait Database) = 3.2 WU, above the 27 cm /
1.08 WU floor even at a young 30 cm (1.2 WU).

Research decisions:

- WoRMS: family Sarcophytidae (no longer Alcyoniidae); records from Mozambique and Madagascar to
  Fiji and Samoa. SeaLifeBase lists only New Caledonia, Taiwan, the Ryukyus and Palau, which is
  narrower than the studies (Red Sea, KwaZulu-Natal), so `foundIn` follows the studies.
- IUCN: Not Evaluated (SeaLifeBase, Red List 2025-2). No *Sarcophyton* has been assessed.
- Depth: 3–30 m in the Eilat population (Coral Trait Database, median 16.5 m); SeaLifeBase adds
  the intertidal. The Reefs' drawn 0–10 m sits inside that.
- Benayahu & Loya 1986 decide sex, maturity, spawning and eggs: separate sexes 1:1; males mature
  at 6–7 years, females after 10; eggs ripen over 22–23 months, so a female holds two batches;
  most colonies spawn on one summer night (9 July 1980); about 35 eggs a polyp; larvae swim
  14 days. Schleyer et al. 2004 found 9% of KwaZulu-Natal colonies carrying both sexes, noted in
  a comment only.
- Size, weight and life span stay Unknown: no average or age is published ("long life span").
  Colour is left out of the copy: only aquarium-trade sources describe it (tan, cream, brown,
  yellowish or greenish).
- Toxins (Chao et al. 2017): sarcophine is toxic to fish, sarcophytoxide fights stony corals for
  space. Reef fish should therefore never peck it.

Sway config the GLB will need (proposed, tune at intake):

- **No vertex-paint channels.** `coral-sway` bakes `aSwayFlex` (distance from the holdfast over
  the colony's reach) and `aSway` at placement (`addSwayAttributes`), so the model needs none;
  `COLOR_0` stays white or absent. The `flex²` falloff keeps the stalk nearly still and moves the
  cap's rim most, which is the lean wanted.
- **Swing direction: the current itself,** horizontal. A fan swings along its face normal, which
  placement points down the current; a toadstool has no face, so its placement script passes the
  landscape's `current` (x, z) straight to `addSwayAttributes`. Phase from position along the
  current as for the fans, so a fan and a toadstool side by side lean together.
- **A `LEATHER_CORAL_SWAY` beside `SEA_FAN_SWAY`:** the same `period` 7 (one surge for the whole
  reef), `bend` about 0.03 (half the fans': a thick, rubbery body), `flutter` about 0.1 (a fleshy
  cap barely ripples). Different `flutter` compiles one more shader program, nothing per frame.
  Shipped in `dev_2` as proposed; Jeremy found it "not obvious enough", so `dev_3` swings 0.15 of
  the height with `flutter` 0.2 (see coral-sway.md).
- `coral-sway.md` holds only the sea fan's Blender contract; the toadstool contract below joins
  it at intake.

Corals on the bommies now (last measured at the cauliflower coral's intake, below): 130 tables in
9 clusters, 25 scattered sea fans plus 3–6 a bommie, 26 brain corals, 20 cauliflower colonies on
tops and upper shoulders (plus front colonies, not counted), staghorn 275 (298 before the
cauliflower, 358 before the brain corals).

Decided by Jeremy (2026-11-01, "go with your suggestion"; the cauliflower coral comes on its own
branch; the leather coral is the last coral for now):

- **Colony count: 1–3 toadstools a bommie** on the nine table bommies (about 10–25 in all) at
  30–80 cm (1.2–3.2 WU), with a few loners on low rocks in the sand between bommies.
- **Placement: low ledges, the foot of the rock and rubble beside it,** in one-colour patches,
  leaving the exposed tops to the tables, staghorn and cauliflower (it is a coral of calm flats
  and lagoons, also turbid water). The foot placement costs mostly the staghorn's foot patches
  (`footShare` 0.35) and the brain corals' sand spots.
- **Order: tables, sea fans, brain corals, cauliflower, leather coral, then the staghorn,** which
  keeps clear of the leather corals as it does of the brain corals. The cauliflower is on its own
  branch (PR #183): whichever model lands first, the leather corals go after the brain corals and
  the cauliflower slots in before them.
- **Space for all.** Jeremy wants the bommies populated with room for every coral. With no more
  corals after this one, the intake fixes the final balance: measure every coral's count before
  and after the leather corals (and, if it landed, after the cauliflower), per bommie as well as
  in all. Gate: every table bommie still shows all its corals; the staghorn still crowns each
  bommie; no coral falls by more than about a fifth from its count before the leather corals.
  Where one does, trim the leather count first, then the cauliflower's, and report every coral's
  before and after.
- **Reef fish: solid but unvisited at first,** as the sea fans are (site rays and obstacle field,
  no mode visits it). A toadstool is a cap on a stalk like a small table, but the `table` form
  includes pecking, which a toxic coral must not get; a no-peck `table` row or a new form is a
  later call.

Model (`dev_2`, Jeremy's `sarcophyton glaucum.glb`, 2026-11-02): four toadstools, each one object
(cap or two heads joined to the stalk) with its origin at the stalk's foot, polyps withdrawn and
painted, caps from Diego Delso's (peach) and David Burdick's (grey) photos, stalks and undersides
from Alexander Vasenin's. 878 to 2,748 triangles, 49 to 66 cm tall. He chose joined colonies over
mix-and-match caps and stems, and cut the two heaviest from 5,552 and 4,048 triangles. Burdick's
photo is all rights reserved and used without permission on Jeremy's call ("just use it, i'll
takedown if necessary"): credited as such, with a ROADMAP item to ask him.

Kit (`scripts/build-leather-coral-kit.py`): nothing decimated or baked; each photo cut to its used
part and scaled to 1024 px (61 MB of PNGs to a 1.2 MB GLB), every face moved onto one UV map (his
stalks sampled a second), every material opaque (his export was Blend). Atlas specimen
(`scripts/build-leather-coral-atlas.py`): all four on a 1.5 m rock, swaying from their feet. Tile:
the classic peach toadstool rendered in Blender from the specimen, as the sea fan's was, since the
dev tank would not load in the preview over Remote Control.

Placement (`src/components/leatherCoralPlacement.js`, landscapes.js `leatherCorals`): 1 to 3 a
bommie, one colour (grey, peach; the two-headed one counts as either), within 0.6 rad of one side,
most often the camera's; ledges in the lower half of the bommie (at least 70% up-facing) or the sand
within 1.5 m of its foot (40%); 35 to 75 cm tall (1.4 to 3 WU), up to 9° lean, foot sunk 4%; foot
supported all round (7 of 8 points), stalk and cap clear of rock, sand, tables, fans, brain and
cauliflower corals and each other (the cap touching nothing), shrinking to 80% then 60% before
giving up. The staghorn keeps clear of them (`inToadstool`: a cylinder of the cap's reach plus its
swing and 5 cm). Reef fish: the `toadstool` form, solid but unvisited (docs/reef-behavior.md).

Space check, one full load of the dev tank (`dev_2`, desktop): 15 toadstools on all 9 bommies (1 to
3 each, 22 to 72 cm). Tables 130, brain corals 26 and cauliflower corals 29 (20 on the tops plus
the front ones) as read; the sea fans (25 when last measured) were not read. All four are placed
before the toadstools, so they cannot change. Staghorn 243, against 275 at
the cauliflower intake (measured before its front colonies): at most 32 fewer (−12%), inside the
fifth Jeremy allowed. The same-session count without the toadstools was not taken (the preview
hung on reload), and the tank was not checked by eye.

Sway (`dev_3`–`dev_7`, Jeremy on his phone): stronger, then in the cap with the stalk still
(`flexFrom`), then circling in the level plane (`orbit`), then half as fast (14 s), then, after
reference videos, far smaller: `bend` 0.08 (docs/procedural/coral-sway.md has the steps).
Accepted ("looks good. lets merge") and shipped in `v0.47.0`.

Still open: Burdick's permission (ROADMAP).

## Bluefin Trevally — `caranx-melampygus` (prepared `v0.46.0-dev_1`, model `dev_3`, fins `dev_4`, size and tail `dev_5`, shipped `v0.46.0`)

Reserve: The Reefs, as a follower of the humphead wrasse (fish queue, Up next item 5). Felt
intention: a quick blue hunter shadowing a slow, heavy forager, hanging just above and behind
it while the wrasse works the rock, ready to snatch whatever bolts. Must not happen: a trevally
below the wrasse or inside the rock it is working, or a school milling on its own.

Prepared: hidden species entry (no model, no roster slot, no rows), `hitchhiker` follower block
(`hosts: { 'reef-forager': 1 }`, stations above and to either side, `along [-0.3, 0.9]`,
`angleDegrees [20, 160]`, `radius [1.15, 1.5]`). The wrasse gained an escort-only `rideHost`
in a new `reef-forager` group, so the pilot fish and bannerfish (who follow `large-fish`) do not
start trailing it; visitors see no change. Clearance measured on both wrasse models.

Size check: 117 cm FL maximum = 4.68 WU; fish 35–45 cm FL = 1.4–1.8 WU (45–70 cm until `dev_5`),
above the 27 cm / 1.08 WU floor.

Research decisions:

- FishBase: 117 cm FL maximum, 60 cm TL common length, 43.5 kg; 0–190 m; Lm 35 cm; LC (9 March
  2015). Range Red Sea and East Africa to Ducie Island, eastern Pacific Mexico to Panama.
- Pardee et al. 2021 (Hawaii, 194 aged): mean asymptotic FL 74.9 cm female, 69.2 cm male (growth
  not significantly different); oldest female 24 years, male 17; A50 4.1 / 2.9 years; W (g) =
  6.77e-6 FL (mm)^3.15, giving 7.7 / 6.0 kg at those lengths.
- Sudekum et al. 1991: gravid April–November, peak May–July; 49,700 to 4.27 million mature eggs
  per gravid female (32.8–64 cm SL); over 90% fish.
- Hobson 1974 (Kona): patrols about 1 m above the reef; 16 of 24 groups of a big goatfish had a
  jack following close behind. Wikipedia (citing Hobson 1974, Potts 1981) adds wrasses, rays and
  sharks as hosts; no source names the humphead wrasse itself (a Maldives photo caption shows
  bluefin hunting beside a juvenile one). Rays and sharks are left off until a Reefs one exists:
  stations above a ray would sit level with its wings.

Decided by Jeremy (2026-11-01):

- **Life stage: adults.** Silver with a blue-bronze back, electric-blue fins and spotted flanks.
  Juveniles (dark fins, yellow pectorals) live in sandy shallows and do not follow.
- **Count: eight** (six in production, below), two or three per wrasse (the reef has one male and two females), at 45–70 cm
  FL (35–45 cm since `dev_5`, below), in `creatures_dev` first. With so many following, `leaveChance` is 0.2, so most are with a
  wrasse at any moment. The escort picks the nearest wrasse, not the least crowded one, so at
  intake watch that they spread over all three rather than piling onto one.

Model intake (2026-11-01, `dev_3`): Jeremy's GLB (4.2 MB, SHA-256 `e08edff3…`) is a body and
four independent paired fins with node rotations, sharing one material; flat-shaded, 91% of
normals outward, positive volume. Nose −Z, +Y up. Its texture is a whole 1920 × 1280 photo, Diego
Delso's bluefin trevally off Jeddah (Commons, CC BY-SA 4.0, credited); the UVs use only the fish,
so `scripts/prepare-bluefin-trevally-model.py` crops to that area plus 8 px, resizes to 1024 px
wide as a JPEG and remaps the UVs (GLB 4.2 → 0.24 MB). The photo has no alpha, so BLEND is
dropped. The fins keep their rotations; their offsets follow the new root, and they are renamed
`pectoral.l/.r`, `pelvic.l/.r` (the 146-vertex pair are the long sickle pectorals). Scale is from
the fork length, snout (vertex 14) to the deepest point of the fork (vertex 310): 0.773418 source
units = 4.68 WU; the upper lobe reaches 0.85897 (5.2 WU). The root sits halfway along the fork
length on the body axis; the Atlas uses the same fork reference. Motion is the golden trevally's
carangid `caudal-wave` config with amplitude and turn scaled to this model's units.

Fin fix (2026-11-01, `dev_4`): in that export both pelvic roots hung about 0.009 source units
(about 1.3 cm on a full-size fish) below the belly, visibly detached. Jeremy re-exported
(SHA-256 `57792a36…`) with only the fin objects moved: pelvics raised 0.011, pectorals each
0.015 toward the body. Mesh, texture, landmarks and scale are byte-for-byte the same. Measured
by casting from each fin's root vertices to the body: pelvic roots now 0.002 inside the belly,
pectoral roots 0.004–0.034 inside. The Atlas tile was recaptured, since the old one showed the
gap.

`creatures_dev` ids 1175–1182, eight adults, size parameters 0/0.14/…/1 (45–70 cm FL), four of
each sex. Dev snapshots before and after (824 → 832, no existing row changed) and the production
backup before and after (831, unchanged). No production rows yet.

Spread: with each follower taking the nearest wrasse, 4, 3 and 1 followed the three wrasses, the
last soon none. `escort.maxPerHost` (new, [ride-hosts.md](ride-hosts.md)) caps a host at three, so
a fourth goes on to the next nearest. Measured in the dev tank (2026-11-01): all eight escorting
within about 25 s of loading, 3 / 2 / 3 across the wrasses for the 30 s sampled, usually 2–10 WU
from their wrasse's centre (up to 17 while catching up after a burst), very occasionally dipping
below its middle for a moment while closing in.

Atlas tile: fish 1182's head facing left, rendered from a little below in The Reefs with the other
fish hidden, 470 px. Atlas checked at desktop, 375 × 812 and 844 × 390 browser viewports: the whole
fish and the 1.17 m scale bar show. These are browser viewport checks, not a physical phone.

Feel review (2026-11-01, `dev_5`), from Jeremy's tank screenshots beside photos of bluefin
trailing humpheads:

- **Too big.** At 45–70 cm FL a bluefin was nearly as long as the 0.8–1 m females; in the photos
  the trevally is roughly 40–50% of the wrasse. Now 35–45 cm FL (1.4–1.8 WU), still adult (males
  mature from 32.9 cm FL). The rows keep their size parameters, so no database write. Live in the
  dev tank: wrasses 5.61, 3.70 and 3.41 WU (1.40, 0.93 and 0.85 m), so a bluefin's fork length is
  25–32% of the male's length and 38–53% of a female's.
- **Darting.** While escorting, the escort sets the follower's speed, but idle bursts (every
  10–18 s) and snap turns still played their tail strokes, so the tail whipped with no dash to
  match. `escort.quietTail` ([ride-hosts.md](ride-hosts.md)) drops them while escorting; startles
  still fire, and roaming on its own it bursts as before. Steering is unchanged.
- **Tremble.** They steer toward a station fixed in the wrasse's body frame, so the wrasse's own
  occasional tremble reaches them through that target, amplified at side stations. That belongs to
  the wrasse, not to this species, and is left for its own fix.

Measured in the dev tank (2026-11-01, desktop browser), the quiet tail switched off and on in
alternating 50 s blocks after a dropped 25 s warm-up, all eight escorting most of the time. Off:
164 strokes (43 bursts, 121 snap turns) in 9.3 escorting fish-minutes, about 18 per fish per
minute. On: none in 9.0 fish-minutes, startles included.

Production (2026-11-02, Jeremy: "write 6 instead" of eight): `creatures` ids 1474–1479, six
adults, size parameters 0/0.2/…/1 (35–45 cm FL), three of each sex, each with its own
description. Production backup before and after (831 → 837, no existing row changed).
Accepted from `dev_5` and shipped in clean `v0.46.0` ([PR #179](https://github.com/jeremyyeh11/world-oceanarium/pull/179)).

## Cauliflower Coral — `pocillopora-meandrina` (prepared `v0.45.0-dev_1`, model `dev_2`, shipped `v0.45.0`)

Reserve: The Reefs, a landscape coral like the tables, staghorn, sea fans and brain corals
(fish queue, Up next item 4). Jeremy picked *P. meandrina* over *P. damicornis* (2026-11-01):
it is the coral actually called cauliflower coral, its stubby round bushes read apart from the
staghorn's long antlers, and *P. damicornis* was split into several species in 2014, so many of
its published facts belong to look-alikes.

Felt intention: small, tough, bright knots of coral on the most exposed tops and shoulders of
the bommies, each its own little bush, with fish dipping into them. Why: it is the coral of
wave-swept reef crests, often the first to settle bare rock, and stays small. Must not happen:
a carpet or a thicket of interlocking colonies (that is the staghorn), a colony bigger than a
reef fish's reach, or bushes in the sheltered sand between bommies.

Prepared: hidden species entry (no model, on no tank, no landscape placement, out of the Atlas),
SeaLifeBase and the NMFS 2019 status review credited in `STUDY_CREDITS`, and a test that keeps it
hidden and off every tank.

Size check: colonies commonly 20–40 cm across, most stopping near 40 cm = 0.8–1.6 WU. Below the
27 cm / 1.08 WU swimming floor at the small end, but corals are landscape, not creatures; the
brain corals run 33 cm to 1.2 m.

Research decisions:

- SeaLifeBase: Endangered (27 October 2023, A3ce), shallow reefs, commonest on exposed reef
  fronts. Its 0–98 m depth is not used; the status review's "the surface to at least 34 m" is.
- NMFS 2019: range from the western Indian Ocean to the eastern Pacific (95 of 133 Indo-Pacific
  ecoregions); commonest under 5 m on reef crests and upper slopes; bushes 20–40 cm, light brown
  or cream, also green or pink; determinate growth and a short life for a coral (no age given);
  first to colonise lava, storm-cleared reef and pipes; hermaphrodite broadcast spawner 1–3 days
  after the full moon just after sunrise in late spring or early summer; eggs carry zooxanthellae
  (Hirose et al. 2001); crabs and shrimp in colonies over about 10 cm ward off crown-of-thorns
  starfish (Glynn 1976). Its growth rates (10–31 cm a year in Hawaii and Johnston Atoll, quoted
  from Jokiel & Tyler 1992) are implausibly high for a bush that stops near 40 cm (possibly mm),
  so they are not used until checked against the paper.
- Size, weight, age, maturity and eggs per spawning stay Unknown: no figure is published.
- Wikipedia says its larvae develop inside the polyp (brooding). The status review and its
  spawning studies say broadcast spawner; the entry follows them.
- Reef behaviour: a new row under the existing `thicket` form (branching coral), no new form.
  Its colonies are small and set apart, so a thicket's `inside` shelter suits only the smallest
  fish; check at intake whether the shares need trimming for it.

Decided by Jeremy (2026-11-01):

- **Colony count: 2–4 colonies a bommie** on the nine table bommies (about 20–35 in all) at
  20–45 cm (0.8–1.8 WU), more on the most exposed tops.
- **Placement: bommie tops and upper shoulders only** (its wave-swept crest habitat), never on
  the sand, singly or in loose twos and threes rather than patches. Order: after the tables, sea fans and brain corals, before the staghorn, which keeps
  clear of them (as for the brain corals). Last measured counts: 130 tables in 9 clusters,
  25 scattered sea fans plus 3–6 a bommie, 24 brain corals, staghorn about 310 (358 before the
  brain corals). The cauliflower colonies will take staghorn spots on the same tops; re-measure
  every coral at intake and say what each lost.

Model intake (2026-11-01, `dev_2`): Jeremy's GLB holds three colonies modelled with displacement
over a photo projected from view (his style): two pink (one photo) and one cream, origins at the
foot, normals outward, no alpha, 55,000 to 290,000 triangles each, at 3.6, 5.6 and 8.1 m across.
`scripts/build-cauliflower-coral-kit.py` is a copy of the brain coral's kit script, not the
staghorn's (the brain coral's keeps his object origin and fixes the seam fault): it scales the set
so the biggest is 45 cm (20, 31 and 45 cm), bakes each colony's colour and normal maps onto a
6,000 / 6,000 / 3,000 triangle `_hi`, and decimates `_lo` and `_far` to 40% and 16%. Two changes
from the brain coral's: a wider UV angle limit, and no seam protection, since on these lobes
nearly every vertex is a seam vertex and the protection froze the decimation (the 48 px EXTEND
margin covers the seams; the dark grooves count as a few "black" triangles). Kit 1.0 MB plus six
maps (1.1 MB). The pink photo is Dwayne Meadows' NOAA photo (public domain), embedded as a 563 px
thumbnail; the cream is Peterwchen's Kauaʻi tidepool photo (CC BY-SA 4.0); both credited in
`IMAGE_CREDITS`.

Placement (`src/components/cauliflowerCoralPlacement.js`): 2 to 4 a bommie, groups of 1 to 3 within
40 cm, on ledges in the upper 55% of the bommie only, 20 to 45 cm drawn (a clash tries 75%), sunk
to the neck so the pink colony's short stalk is in the rock. Measured in the dev tank (desktop,
2026-11-01): 20 colonies on the nine table bommies (1 to 3 each, 15 to 35 cm); tables 130, sea fans
25 and brain corals 26 unchanged; staghorn 298 → 275 (−23, −8%). From the resting view 1 of the 13
colonies in frame has a clear line of sight, against 2 of 17 brain corals: corals there are seen
past other reef, and the diver and follow cameras see them close.

Atlas (`dev_2`): the three colonies at true size on a 1.1 m rock (2.3 MB,
`scripts/build-cauliflower-coral-atlas.py`), checked on desktop, 375 px portrait (no horizontal
overflow) and 844 × 390 landscape; tile from an in-tank close-up of two cream colonies. Unhidden and
on The Reefs' `landscapeSpecies` (14 species). No creature rows: a coral is landscape.

Front colonies (`dev_4`, 2026-11-01; Jeremy: "i dont like that thyere all hidden away, put some of
them on the front as well, if not add more"): after the top and shoulder groups, each bommie whose
middle is in the resting frame gets `front` (3 to 4) more colonies on ledges on its camera side,
from 10% of its height up, each kept only if the resting camera sees at least one of three points
on its head (in frame, no drawn rock and no table plate within 3.5 m on the way). A first try
asking for two of three points added only 1 colony (5 of the 9 bommies are in frame; most spots
that fit were seen by none). The loosened count is not measured: the dev tank would not finish
loading in a browser with no window open. Unit test: a camera in front of the test bommie gets its
three front colonies, all on the camera side.

`dev_5` (Jeremy on `dev_4`, his desktop screenshot of the default view: "i still dont see any"):
the front colonies now start from the camera. Rays go through the lower part of the resting frame
(92% of its half width, from 92% below the middle to 40% above it); a colony stands on the first
rock ledge a ray meets, on any drawn rock 6 to 60 WU away, so its spot is in view by
construction, and is kept if two of its three sight points are seen (a table plate can still hide
it). `front: [12, 16]` in the whole view. A colony on a bommie joins that bommie's thicket; one
off every bommie is a thicket of its own. Not measured in the tank: the dev tank again would not
finish loading in the session's browser.

Open for Jeremy: the look in the tank on his phone (the front colonies first), the tile (a
recapture is easy), and whether the cream colony's sharper lobes need softening at the source.

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
