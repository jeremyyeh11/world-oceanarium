# Changelog

Significant changes only. Categorized by feature area inside each clean release/version grouping.

Versioning convention notes:
- Current convention: work toward a clean target release using visible `-dev_##` builds, then publish the clean version when accepted.
- Dev patches are intentionally excluded below; each target release summarizes the accepted bucket.
- Before the dev-patch convention, changes are grouped by minor version (`v0.6.x`, `v0.5.x`, etc.).
- Earliest unversioned work is grouped as `pre-v0.x`.

## v0.35.0 — Tank selector and loading screen (in development)

Status: `v0.35.0-dev_4` (2026-10-23, branch `claude/environment-loader-ui-ux-v28m0g`), stacked on `feat/budgeted-environment-loader` (#153, `v0.34.2-dev_5`). Jeremy: landing → dive in → environment selector → loading screen → tank, with a bottom-left button back to the selector. Rebuilt on #153's loader after a first pass on `main` (#154, closed) duplicated its preloading and readiness work.

### Navigation

- New flow: landing gate → **Choose a tank** selector → loading screen → tank. A bottom-left **Tanks** button (with the current tank's name) returns to the selector; it replaces the bottom-left tank list.
- Selector (`EnvironmentSelector.jsx`): one card per tank with index, depth zone and range, name, tagline, description and live species count; each card's swatch is the tank's own water palette. Arrow keys move between cards; focus returns to the last tank mounted. The chosen card flares for 420 ms.
- Loading screen (`EnvironmentLoader.jsx`), driven by #153's `useEnvironmentLoading()`: files `loaded / total` (85% of the bar), then "Building the tank…" while the scene assembles and shaders compile, clearing on `phase === 'ready'` for that tank (held at least 1.3 s, 700 ms sink). On `error`: the message, Retry and Tanks.
- The landing gate waits only on the creature fetch (`useSceneReady.js` removed). Search, screenshot and diver show only inside a tank; the Atlas and the menu stay available on the selector.

### Loading

- No tank on boot (`useEnvironmentNavigation(null, prefetchOrder)`). The selector ranks tanks by where viewers look first (`utils/attentionOrder.js`: inverted L, `max(0.85^c · 0.55^r, 0.8^r · 0.55^c)`; 5×5 ranks A1, B1, A2, C1, A3, D1, E1 … E5; one column is top to bottom) over its live column count. App requests the top-ranked tank, which warms hidden under the gate and selector; once it has rendered, the loader prefetches the next-ranked tank instead of the catalog neighbour. #153's speculative budget (16 MiB estimate per file, 64 MiB per visit) admits about four of that tank's files; the budget is unchanged. A paused tank re-enables speculation (`reportRenderingPaused` in environmentRuntime.js): #153 enables it from frame-pressure reports, and the slow warm-up frames just before a pause left it off for as long as the tank stayed paused, so nothing was prefetched from the selector.
- One canvas for the session. A tank off screen is `hidden` (listeners off, follow released, `.tank-viewport.is-hidden`) and, once its first frame has rendered, `paused` (`frameloop="never"`; `ResumeClock` restarts the r3f clock on resume). Picking the warm tank resumes it with no loading screen; another tank swaps in the same canvas. AGENTS.md, docs/tank-design.md and docs/environment-loading.md state the one-mounted-tank rule with this case.

## v0.34.2 — Budgeted environment-loading infrastructure (unreleased)

Status: review build `v0.34.2-dev_5`, branch `feat/budgeted-environment-loader`, #152. Not a clean release; no merge/promotion approval. `v0.34.1` remains reserved for the separate reef-motion PR.

### Loading infrastructure

- Data-driven environment manifests, shared tank/Atlas source ownership, selected-first queue and latest-selection-wins cancellation. Current tank remains mounted during the next destination's source fetch/decode; only one tank Canvas/simulation runs.
- Bounded idle/pressure-aware speculation, evictable decoded-source cache and mounted-consumer leases. Active/selected assets may exceed targets rather than breaking a displayed scene; accounting is not GPU/process memory.
- Foreground consumers recover from failed background prefetches; synchronous placement setup failures release readiness barriers and use activation rollback, just like iteration failures.
- Documented state/navigation hooks for Jeremy's future loading UI. **No new loading UI**, DB writes, fish-count/motion/quality/resolution changes, or claimed physical-phone speedup. Mount-time geometry and GPU work remain distinct from source readiness; see `docs/environment-loading.md`.

## v0.33.1 — Visitor changelog caught up

Status: clean `v0.33.1` (2026-10-22, branch `fix/changelog-v0.33.0`). `package.json` and `package-lock.json` move to `0.33.1`. From `main` at `v0.33.0`. Jeremy: "why chsngelogs not added".

### Changelog

- The in-app changelog (`src/data/changelog.js`, opened from the version label) gains the releases it was missing: v0.33.0 Humphead Wrasse, v0.32.2 fuller Atlas entries, v0.32.0 Raccoon Butterflyfish, v0.31.3 the lower view of The Reefs, v0.31.0 Staghorn coral. Only `CHANGELOG.md` had been written for them. v0.31.2 (lossless asset recompression) stays out as tooling, per the file's rule.

## v0.34.0 — Humphead Wrasse females

Status: accepted and promoted as clean `v0.34.0` from `v0.34.0-dev_1` on Jeremy's go-ahead (2026-10-22, branch `feat/humphead-wrasse-female`, #151: "promote to clean v0.34.0, merge, then add the two females to prod once it's live"). `package.json` and `package-lock.json` move to `0.34.0`. From `main` at `v0.33.1`. Jeremy's female humphead wrasse model, the second model promised when the male shipped.

### Species

- Female humphead wrasse model as a sex variant (`model.sexVariants`, as the mahi-mahi): no hump, grey with a yellow-rimmed tail. Same labriform `caudal-vertex` swim as the male (the shared settings moved to `HUMPHEAD_WRASSE_SWIM` in species.js), amplitude 0.3 for her 10.008-raw source.
- Females get their own size range: `sizeRangeBySex: { female: [0.35, 0.44] }` = 0.8–1.0 m (3.2–4 WU), since females level off near 75 cm and rarely pass about 1 m (Choat et al. 2006, Florida Museum). `useCreatures` reads `sizeRangeBySex[sex]` before `sizeRange`; the male keeps 1.15–1.5 m.

### Model

- Source 10.008 raw long, nose −Z, scale 0.9153 (9.16 WU at size 1), recentred mid-length on the snout-to-tail-tip line: `position [0, -0.1355, -1.675]`. Exported the right way out (99% of normals outward), so no flip this time.
- One body texture, a solid 1920 × 1014 PNG, shipped as a JPEG with the `BLEND` alpha mode dropped: 3.2 MB to 0.58 MB. The photo is Diego Delso's (CC BY-SA 4.0, cropped by Bloopityboop), credited in Sources.

### Atlas

- The Atlas shows the male with a female below and behind him, at 0.75 of his length (the sexes' average lengths). Companions take a `sex` key, resolved by the new `speciesForSex` (speciesLookup.js) as `lifeStage` is. Framing checked on desktop, 375 px portrait and phone landscape.

### Data

- Two females in `creatures_dev` (ids 460 and 461, sizes 0.6 and 0.25 = 92.5 and 85 cm); dev is 277 alive. The same two in production `creatures` (ids 462 and 463), written once the live bundle served `v0.34.0`, since older builds draw them as males.

## v0.33.0 — Humphead Wrasse

Status: accepted and promoted as clean `v0.33.0` from `v0.33.0-dev_6` on Jeremy's go-ahead (2026-10-22, branch `feat/crassilabrus-undulatus`, #148: "pls push both and merge to main CLEAN"). `package.json` and `package-lock.json` move to `0.33.0`. From `main` at `v0.32.2`. Jeremy's next reef fish for The Reefs, chosen over the bumphead parrotfish so the reef gains one focal animal rather than a herd; one terminal male to start, females later as a second model.

### Species

- Humphead Wrasse (*Crassilabrus undulatus*, Labridae, Endangered 2024, CITES Appendix II). Long *Cheilinus undulatus*; moved to the resurrected genus *Crassilabrus* by Near et al. 2025. Facts from FishBase, Choat et al. 2006, Sadovy de Mitcheson et al. 2010 and the Florida Museum: 229 cm SL maximum, up to 32 years, usually solitary or in pairs, starts female and some turn male from about 9 years.
- Averages by sex (Choat et al. 2006): males 1.0 m, 13 kg, 25 years; females 0.75 m, 5.7 kg, 30 years. Females mature at 6–7 years, males appear from 9.
- Tank fish are 1.15–1.5 m (4.6–6 WU), bigger than the grouper and smaller than the visiting sunfish. Reef behaviour: patrols the reef more than any resident, short hovers, a bite or two at the rock, little shelter by day; cruises past and under the table corals.

### Model and motion

- Jeremy's terminal male model (flat-shaded, his style), revised once (rear body reshaped). The bannerfish's labriform `caudal-vertex` config, slower: pectorals row, the tail bends for bursts. Both exports came out inside out; the body's winding and normals are flipped outward in the GLB.
- Three solid photo textures re-encoded as JPEGs (fins resized to 1024 px) and the BLEND material dropped: 9.3 MB to 0.85 MB. Fin photos credited in Sources (Mokkie, CC BY-SA 3.0; LuxTonnerre, CC BY 2.0).

### Atlas and Sources

- Atlas entry with its own framing (desktop, 375 px portrait, landscape) and a rendered tile.
- Four studies added to the Sources modal's Studies list: Choat et al. 2006, Sadovy de Mitcheson et al. 2010, the Florida Museum profile, Near et al. 2025.

### Data

- One male in `creatures_dev` (id 458, 1.4 m). Production `creatures` has none yet: it needs Jeremy's go-ahead.

## v0.32.2 — Atlas averages and lifecycle for every species

Status: accepted and promoted as clean `v0.32.2` from `v0.32.2-dev_4` on Jeremy's go-ahead (2026-10-22, branch `fix/atlas-averages`, #149: "pls push both and merge to main CLEAN"). `package.json` and `package-lock.json` move to `0.32.2`. From `main` at `v0.32.1`. Jeremy: "fill in all the averages for all species ... same thing for lifecycle".

### Atlas

- Averages (size, weight, life expectancy) and Lifecycle (maturity, sterility, eggs) filled for every species where a source exists, each value cited in a comment beside it in `species.js`.
  - Sizes by sex from studies where they exist: Live Sharksucker (Bachman et al. 2018), Whale Shark (Meekan et al. 2020), Marlinsucker (Battaglia et al. 2016), Squaretail Coral Grouper catch mean (Khasanah et al. 2019). Otherwise FishBase's common length.
  - Where no average size is measured (Raccoon Butterflyfish, Emperor Angelfish, Clown Triggerfish, White Suckerfish, Whalesucker): FishBase's Life-history estimate L_opt from the maximum length (Froese & Binohlan 2000).
  - Weights from FishBase's length–weight relationship at that size. Life expectancy is each sex's oldest aged fish, as the mako and mahi already were.
  - Lifecycle: Emperor Angelfish maturity sizes and eggs (Obota et al. 2016), Marlinsucker maturity size and eggs, Live Sharksucker eggs per batch, Table Coral eggs per polyp (Coral Trait Database), Clown Triggerfish lifespan and maturity (Toronto Zoo). Sterility reads "None known" where nothing is published.
- Checked model estimates, labelled "(estimated)": Giant Sunfish lifespan 21 years and maturity 7 years at 1.5 m, Whale Shark maturity 30 years (FishLife, Thorson et al. 2017); maturity sizes for the Pilot Fish, Longfin Bannerfish and Raccoon Butterflyfish (Froese & Binohlan). Estimates that missed measured values in the check stay out: genus-level FishLife ages (45–90% off) and any length formula for the remora family (70% high), so the sharksuckers and remoras keep Unknown.

### Sources

- A Studies section in the Sources modal (`STUDY_CREDITS`), listed like the Image credits: each study or species profile with the species and fields it decided.
- Coral Trait Database added as a source; FishBase now also lists Weight.

## v0.32.1 — Atlas scrolls on iPad

Status: accepted and promoted as clean `v0.32.1` from `v0.32.1-dev_1` on Jeremy's go-ahead (2026-10-22, branch `fix/atlas-scroll-while-following`, #147: "works. merge to main clean version"). `package.json` and `package-lock.json` move to `0.32.1`. From `main` at `v0.32.0`. Jeremy: on his iPad the Atlas info section was cut off at the bottom and would not scroll.

### Atlas

- The Atlas scrolls while a fish is followed. Opening it from a fish's info card keeps that fish selected underneath, and follow mode's window-level `touchmove` block (capture, non-passive) cancelled every touch-scroll outside the info card, the Atlas included. Phones never showed it: the portrait Atlas (≤ 880 px) scrolls itself by hand from `touchmove`, which still runs after the block. An iPad is wider than 880 px, gets the three-column Atlas and relies on native scrolling, so the info panel was stuck. The block, and the mobile wheel block beside it, now let through touches that start in the info card, the Atlas (`.encyclopedia-page`) or the sources/changelog modal (`.sources-modal`). Measured at 1180×820: a touchmove on the Atlas info panel was cancelled before and is not now; one on the tank canvas is still cancelled.

## v0.32.0 — Raccoon Butterflyfish

Status: accepted and promoted as clean `v0.32.0` from `v0.32.0-dev_4` on Jeremy's go-ahead (2026-10-21, branch `feat/chaetodon-lunula`, #146: "merge"). `package.json` and `package-lock.json` move to `0.32.0`. Jeremy's next reef fish for The Reefs, in one group of 20 (his call: "1 group of 20 is good").

### Species

- Raccoon Butterflyfish (*Chaetodon lunula*, Chaetodontidae, Least Concern): facts from FishBase. 20 cm maximum total length = 0.8 WU, under the 1.08 WU sardinella floor (Jeremy: "size ok"); individuals 14 to 20 cm; length–weight a 0.02291 / b 3.00; up to 9 years. Nocturnal, in pairs or small groups; eats nudibranchs, tubeworm tentacles and other bottom invertebrates, some algae and coral polyps.
- Jeremy's model (`public/models/fish/chaetodon-lunula/`, 433 KB): one body with the dorsal, anal and tail fins, separate pectoral and pelvic fins, nose at −Z, a 447 px photo texture with no alpha (so no `alphaBlend`). Scale 3.994 from a 0.2003 source length; root recentred on the snout-to-tail line.
- Motion: the bannerfish's labriform `caudal-vertex` tuning (a stiff deep body that cruises on its pectorals, a wave from halfway back) in this model's units. No new motion type.
- Folding spines (Jeremy: "is it possible to make the spines retract?"): Jeremy's two shape keys, "open spines" and "folded spines", as a glTF morph target weighted per fish (`spineFold` on `caudal-vertex`). Folded on the move and in a shelter, half open while it hovers or picks at a rock, fully open for 4 s after a startle (a butterflyfish's threat display). The swim wave runs after the morph, so folded spines bend with the body. His Mirror modifier is baked into both keys by `scripts/bake-mirror-shape-keys.py` (headless, on a copy of the `.blend`); the open shape matches his own export triangle for triangle. `dev_2` and `dev_3` folded painted spines in the shader instead; a computed fold of a few large spine triangles crumpled into a faceted ridge ("doesnt look v good"), and he asked for shape keys for control of both poses. Contract in `docs/procedural/caudal-wave.md` (Folding spines).
- Atlas: shown with five of its group; a rendered three-quarter head tile with the spines folded (`public/atlas/chaetodon-lunula-thumbnail.png`). School size reads "Small groups" (Jeremy: the 20 is a guess).

### Behaviour

- Reef groups (`group` on a species): Biome makes the first fish of each group of up to `group.maxSize` the leader and the rest followers on the pair-follow path, each at its own station on a golden-angle spiral round her (1.2 to 4.5 body lengths out, spread up and down; `groupFollowersForCreatures`, `groupBondProfile`, `advancePairFollow`). While she is at a rock they do their own reef behaviour round her, so the group works one patch of reef, then gathers and moves on. Not the sardinella school, which has a shared heading and turns reef behaviour off. Design in `docs/reef-behavior.md` (Home and mates).
- Its reef profile: a bottom picker resting by day, so more peck and shelter than the bannerfish (affinity 0.85; patrol 0.2, hover 0.25, peck 0.35, shelter 0.2), and it picks polyps at both coral forms; at 0.8 WU it shelters among the staghorn.
- Measured on desktop with 20: median 3.6 WU from the group's centre, about 17 of 20 within 6 WU, about 12 of the 20 at a rock at once. Bannerfish pairs unchanged (followers with their mates in 100 of 120 samples).

### Atlas

- The quick-card values (diet, biome, location) wrap inside their column: "Nudibranchs," broke out into the next column on a landscape phone.

### Data

- 20 rows in `creatures_dev` (ids 418–437, 10 F / 10 M, each with a description). None in production `creatures` yet.

## v0.31.6 — No jumps on the way back from a rock or a host

Status: accepted and promoted as clean `v0.31.6` from `v0.31.6-dev_1` on Jeremy's go-ahead (2026-10-21, branch `fix/reef-handback-jumps`, #145: "its good", then "promote to clean v0.31.6 and merge"). `package.json` and `package-lock.json` move to `0.31.6`. From `main` at `v0.31.5` (which carries #138's pinch handling and #144's probe). The ROADMAP item from 2026-10-19: reef fish jumped in a single frame when they came back onto the swim pipeline from a reef pose (0.1 to 0.8 WU), and a cleaner by the sunfish was moved up to 2.3 WU by the host clearance.

### Behaviour

- Cause, from a per-frame trace of the pipeline stages (integrate, swim clamp, host clearance, rock clamp, sand lift) on desktop at The Reefs:
  - Most hand-back jumps were the rock clamp easing in after a reef pose (`REEF_CLAMP_RECOVERY_SECONDS`). Back from a site in a nook a fish is inside two overlapping rock pads; from inside, `pushOutOfRocks` took it to the deepest pad's surface, inside the other pad, and the next frame the other pad was the deepest: 0.1 to 0.27 WU a frame each way for up to half a second (a grouper back from a hover at the outcrop; angelfish and a bannerfish at the foreground bommies).
  - The swim clamp and the sand lift snapped in a fish a pose had left outside its volume or under the sand pad (0.1 to 0.8 WU on 2026-10-19; in 50 minutes of tracing on 2026-10-20 they moved one 0.03 WU at most).
  - The host clearance (`keepRiderClearOfHost`) shoved a cleaner 0.12 to 0.2 WU in a frame when it came round a fish already inside it: a pair follower inherits the sunfish's clearance the moment its mate starts escorting it, and the sunfish turns into its escorts. Escorts of a sunfish at the back wall also sat up to 0.1 WU past their own swim walls, pushed there by the clearance after the swim clamp; letting go, the swim clamp snapped them back. No 1 WU or bigger move turned up in the traces.
- Fix (design in `docs/reef-behavior.md`, Back on the pipeline, and `docs/ride-hosts.md`):
  - The swim clamp, the sand lift and the host clearance never take a fish further from where it began the frame than its own step plus a return speed (Fish.jsx `limitClampCorrection`; 1.2 WU/s, `CLAMP_RETURN_SPEED`; the host clearance 2.4 WU/s, `HOST_CLEAR_RETURN_SPEED`). A fish that began the frame inside is stopped at a wall, or pushed back along its own step, exactly as before; one that began it outside eases back in. The rock clamp does the same for a fish back from a reef site, inside the padding, while the clamp eases in (`clampBlend` < 1). Capped everywhere, a fish pressing on into a rock stayed just inside it frame after frame, and clown triggerfish flicked their heading about twice as often (25 flicks a fish-minute against 10 to 14), so elsewhere the rock still stops a fish at the face.
  - From inside overlapping pads the rock clamp moves the fish along the depth-weighted sum of their normals, a capped step a frame, scaled by how far the normals agree (rockObstacles.js `easeOutAlongSummedNormal`, `startedInsideLastPush`), so the way out turns smoothly instead of flipping between the rocks. Squeezing through a pinch is unchanged.
- Measured on desktop at The Reefs (`creatures_dev`: 24 emperor angelfish, 12 bannerfish, 3 clown triggerfish, 3 groupers, 18 pilot fish, the sunfish). A jump is how far a frame moved a fish beyond its own swim step, in the 2.5 s after it left a reef pose or its host changed; frames slower than 40 ms left out.
  - Same-session A/B (the changes switched off and on in alternating 3.5-minute blocks after a 2.5-minute warm-up, 13.2 minutes off and 10.5 on; the rock cap then applied to every fish that began a frame inside a pad): reef hand-backs over 0.1 WU 13 of 435 off (largest 0.20), 0 of 387 on (largest 0.038); cleaners letting go of or taking up the sunfish none over 0.05 either way; pops (a frame's step over four times the last) 1.13 → 0.29 a minute; reef trips settled 59% of 708 → 66% of 557 (two earlier sessions 65% / 66% and 69% / 63%: noise); heading flicks a fish-minute angelfish 18 / 16, bannerfish 12 / 14, groupers 2 / 2, clown triggerfish 10 / 25.
  - The shipped code, 13.8 minutes on a fresh load after a 2.5-minute warm-up: 481 hand-backs, none over 0.05 WU (largest 0.038); 444 cleaner host changes, none over 0.05 (largest 0.037); 0.43 pops a minute, none over 0.1 WU; reef trips settled 62% of 786; heading flicks a fish-minute angelfish 15, bannerfish 9, groupers 0.5, clown triggerfish 17 (27, 9 and 15 for the three fish); 0.65 stuck episodes a minute (over 100 flicks in 10 s; 0.8 in the `v0.30.3` measurements).
  - This build, on `v0.31.5` (#144's probe), 11.9 minutes on a fresh load, read from the fish registry (a frame's move beyond the fish's speed × frame time): 409 hand-backs and 430 cleaner host changes, none over 0.05 WU.
- Test: `tests/rockObstacles.test.mjs` backs a triggerfish out of the bommie gap from inside both pads with the clamp easing in: no frame moves it further than its step plus the return speed, no flicking between the rocks (the old push: 0.2 WU jumps, 450 flicks over 16 runs), out within 4 s.

### Known issues

- A pose can still leave a fish outside its swim volume or under the sand pad; it now eases back in over a few frames instead of snapping. Keeping the poses inside in the first place (a leave direction into the volume) is in the ROADMAP Backlog.
- The heading flicks above were measured before #144 (`v0.31.5`) fixed shivering on the move past a rock, which made most of them.

## v0.31.5 — Reef fish swim past rocks without shivering

Status: accepted and promoted as clean `v0.31.5` from `v0.31.4-dev_1` on Jeremy's go-ahead (2026-10-20, branch `fix/reef-rock-shiver`, #144: "merge"). `package.json` and `package-lock.json` move to `0.31.5`. The same release ships #138's pinch fix (`v0.30.3-dev_1`, next section), which this builds on and carried. The ROADMAP item from 2026-10-19: a reef fish swimming past a rock, mostly a young emperor angelfish round the foreground stacks, flicked its heading 2° to 5° every frame for a few seconds; after `v0.30.3-dev_1` these were all of the stuck episodes left (about 0.8 a minute on desktop).

### Behaviour

- Cause, from a per-frame trace of the probe ahead, the bend and the heading (desktop, The Reefs): `steerAroundRocks` either hit a pad or missed it, and a hit bent the heading in full at once (urgency at least 0.2). A fish skimming a rock held its heading where the probe tip sat on the padding's outline, and the tip landed in and out of it on alternate frames; the bend smoothing's quick rise and slow fall (`ROCK_AVOID_RISE` 10/s, `ROCK_AVOID_FALL` 2.5/s) turned each in-out pair into a flick. In a young angelfish's 116-flip episode, 75 flips came with the probe switching between hit and miss and 41 with it switching between two pads whose pushes pointed opposite ways (a rock above, a small obstacle below; up, then down). A thin coral table did the same on its own: in its middle the probe's side flips between above and below, and so did the bend's vertical part. The clamp, pinches and the push off a rock the fish is brushing played no part.
- Fix, in rockObstacles.js (design in `docs/reef-behavior.md`, Steering past rocks):
  - The probe feels a rock gradually (`feltHit`): each pad counts from a band outside its padding to the same depth inside, ramping from nothing to full strength. The band is 0.15 rad as seen from the fish (`PROBE_FEEL_ANGLE`): 0.05 WU either side of the padding at the nearest probe point and 0.26 WU at the farthest, for a young angelfish. A fish skimming a rock settles on a steady small bend.
  - Overlapping pads add up by their ramps, so one rock's push fades out as the probe leaves it instead of handing over to the other's in full.
  - Every probe point that feels a rock bends the heading, weighted by the square of its urgency; before, only the nearest hit counted, and the bend jumped when the nearest hit moved from one point to the next.
  - A pad's vertical push points to the fish's side of its middle, not the probe's, fading to level within a quarter of its padded half-height of the middle (`SIDE_BAND`), and is at least half that half-height strong (`SIDE_FLOOR`). A fish above a coral table pulls up over it and one below dips under it; before, a fish above heading down through a table was bent further down once its probe passed the table's middle. A tall rock's push stays nearly level.
  - The push off a rock the fish is brushing comes on over the first tenth of the padding (`TOUCH_ONSET`) instead of at half strength at once.
- Measured on desktop at The Reefs (`creatures_dev`: 24 emperor angelfish, 12 bannerfish, 3 clown triggerfish, 3 groupers, 18 pilot fish, the sunfish), the change switched off and on in alternating 3-minute blocks of one session after a dropped warm-up, 15 minutes each way:
  - Stuck episodes at rocks (a fish with over 100 heading flips, more than 2° a frame each way, in 10 s): 10 off (0.66 a minute, the longest 28.6 s: 7 young angelfish, 2 bannerfish and a clown triggerfish, round the foreground stacks and at the back outcrop) and none on. Three pilot fish also had episodes in open water in the off blocks, away from any rock.
  - Heading flips per fish-minute: 30.4 off, 7.0 on (reef fish 38.0 and 6.2).
  - Trips to a rock settled as often: 67.9% of 744 off and 67.6% of 753 on, patrols left out (hover 68% and 68%, peck 67% and 68%, shelter 71% of 106 and 66% of 93).
  - Pops (a moving fish's frame step over four times the last, 3 or more fish within 0.1 s left out as frame hitches): 24 off, 23 on; over 0.1 WU, 4 and 5, all fish just back from a reef pose (the hand-back jumps in Known issues).
- Test: `tests/rockObstacles.test.mjs` sweeps a heading across a rock's outline a twentieth of a degree at a time (the old probe: urgency jumped by 0.2), runs a young angelfish past a rock with a smaller one beside it, frame by frame with the bend smoothing (the old probe: 95 flips over 17 runs; now none), and checks a thin table's push goes to the fish's side.

### Known issues

- Heading straight at a rock's middle, the side to turn to is still a choice, as before.
- Jumps on the way back from a reef pose (next section): unchanged.

## v0.31.5 — Reef fish no longer wedge between rocks

Status: shipped in clean `v0.31.5` with the shiver fix above (#144 carried it; #138 closed as included). Built as `v0.30.3-dev_1` (branch `fix/reef-floor-pinch`), from `main` at `v0.30.1`; independent of `v0.30.2` (#137, reef trips, still in review). The ROADMAP item from 2026-10-19: a reef fish could wedge nose-down between two rocks at the bottom of its swim volume and shiver there for minutes (a clown triggerfish at x 0.4, y -19, z 0.4 for over 3 minutes, about 58 heading flips a second; a bannerfish for 47 s), with or without the `v0.30.2` changes.

### Behaviour

- Cause, from a per-frame trace of position, heading, rock push and wall contact (desktop, The Reefs). Fish steer by each rock's ellipsoid padded for the body (0.35 BL + 0.3 WU). At the foot of the two foreground bommies (x -3 and 3.2) a triggerfish's pads overlap by about 0.27 WU at the swim floor (y -19). There the rock clamp pushed the fish out of the deeper pad onto that pad's surface, inside the other pad, and the next frame back out of the other: the body jumped 3.5 cm between two spots every frame. The push went out from each rock's centre, above the floor, so it also took the fish 2.7 cm below the floor, and the swim clamp lifted it back. Each push slid the heading along that face, and the two faces took back every two frames what the turn toward the destination had gained: a grouper whose destination was up and to the right stayed pointing 72° down, at 60 flips a second, for 4.5 minutes. The rock bend in the steering also came after the swim-floor clip, so it could point the heading into the floor, and an open-water swim never gave up. The same flicking held a pair follower for 56 s between two stacked coral tiers.
- Fix, in rockObstacles.js and Fish.jsx (design in `docs/reef-behavior.md`, Pinches between rocks):
  - At the swim floor the rock clamp pushes a fish out level, across the rock's section at its height, never down through the floor (`pushOutOfRocks` takes `floorY`).
  - A pinch is a push whose point is still inside another pad, or a push off a face turned more than about 105° from the face it was last pushed off (`WEDGE_DOT`; where the pads meet in a wedge, the fish bounced between the faces 0.13 WU apart). There the fish takes only the part of its step that goes into neither face, along the crease between them where it goes into both, starting from where it began the frame (`from`). It slides along a gap, or up and out of it, where it can, and is held where nothing is left. The clamp leaves its heading to the steering. A fish that started inside two pads (just off a reef site in a nook) is still pushed out of the deeper one a frame at a time, its heading sliding along that face as before (left alone, it came out of nooks in twice as many 0.1 WU jumps). A plain hold was tried first: a juvenile angelfish caged between coral tables and the outcrop stayed for 112 s.
  - The rock bend steers by the depth-weighted sum of the normals of every pad the probe is in (`summedHit`), so in an overlap it points out of the gap rather than at each rock in turn; unchanged for a single pad. At a pinch the fish skips the probe ahead (`lookAhead`) and steers by its destination and the push off the rocks it touches. Probing on into the gap, the bend slid it along the gap and outweighed a destination behind it two to one; a grouper stayed held for a minute that way in a test build.
  - The floor: the swim-wall clip runs after the rock bend; a fish at a pinch keeps the wall contacts of where it ended up; and on the floor (`FLOOR_BAND`, 0.02 WU) the rock bend loses its downward part. Pressed into the floor by a push off a rock above it, a fish's heading flicked on and off the floor contact every other frame.
  - Held at a pinch for 0.3 s (sliding on by less than a tenth of its step, `pinchedLastPush`), a fish gives up its swim or reef trip and decides again at once (`ROCK_PINCH_GIVE_UP_SECONDS`). Its next swim is picked in the half behind it and not pulled into its home range: a destination ahead, or a home past the gap, led it straight back in (one fish gave up 9 times in 2.7 s at one spot, another every 1.9 s for half a minute). It then has 1.5 s to come round before it would give up again (`ROCK_PINCH_TURN_SECONDS`). A pair follower whose station is past the gap spends a spell apart from its mate (`separatePair`); one was held calmly for 55 s before that.
  - A reef fish's open-water swim that has not closed half a body length in 3 s is given up as well, as its trips to a rock already were (`STEER_PROGRESS_SECONDS`, `STEER_PROGRESS_BODY_LENGTHS`). The first check also allows for the turn toward the destination.
  - Safety valve: after three give-ups without getting clear of pinches for 2 s, a fish squeezes through. For 2 s the clamp only pushes it out of the deeper rock, as before (`ROCK_PINCH_GIVE_UPS`). A bannerfish was once held 85 s between two tiers of the foreground stacks, turning back 51 times.
- Measured on desktop at The Reefs (`creatures_dev`: 24 emperor angelfish, 12 bannerfish, 3 clown triggerfish, 3 groupers), the changes switched off and on in alternating blocks of one session, two sessions of about 11 to 12 minutes each way:
  - Pinned: off, three fish stayed 2 to 4.3 minutes, two triggerfish at the foot of the bommies and a bannerfish among the outcrop's coral tables. Each was out within seconds of the changes coming on. On, no fish stayed in one place off a reef site for more than 13 s (apart from the bannerfish above, before the safety valve). A third session with the valve (8 minutes, changes on) had none over 7 s, and the valve fired once.
  - Stuck episodes (over 100 heading flips, more than 2° a frame each way, in 10 s): 35 in 22 minutes off (1.6 a minute, longest 132 s), 19 in 23 minutes on (0.8 a minute, longest 17 s). Those left are all fish shivering on the move past a rock, an older problem (see Known issues).
  - Heading flips per fish-minute: 37 and 81 off (pins included), 14 and 14 on; near rocks 103 and 241 off, 31 and 31 on.
  - Trips to a rock settled 69% of 1,213 off and 69% of 1,226 on.
  - Pops (a frame's step over four times the last), second session: 15 off, 9 on. The only one over 0.1 WU with the changes on was a grouper's hand-back from a reef pose, also seen off.
- Staged, the reported case: groupers and triggerfish put at the gap (x 0.47, y -19, z -0.46, heading into it, destination through it). Before, a fish there stayed for minutes at 60 flips a second. After, every one was out within 1.7 to 3.6 s: held a moment, gave up, turned round, or slid up the crease and over. Flips per trial were 0 to 20, with one at 59. Two juvenile angelfish put in the coral cage slid out in 3.9 and 4.4 s.
- Test: `tests/rockObstacles.test.mjs` runs a triggerfish into the bommie gap frame by frame and checks it never jumps, never goes through the floor and never flicks between the rocks (the old clamp: 179 flicks, 0.13 WU jumps, 7.8 cm through the floor), plus the level push and the probe switch.

### Known issues

- Shivering on the move (fixed in the same release, above): a fish brushing past a rock still flicks its heading 2° to 5° a frame for a few seconds now and then, mostly young emperor angelfish round the foreground stacks. The probe ahead hits the rock one frame and misses it the next, and a thin coral table's normal flips between up and down as the probe crosses its middle.
- Jumps on the way back from a reef pose: a hover or shelter can leave a fish outside its swim volume or under the sand, and the first frame back on the pipeline snaps it in (0.1 to 0.8 WU), with or without these changes.

## v0.31.4 — Fish at the staghorn

Status: accepted and promoted as clean `v0.31.4` from `v0.31.4-dev_1` on Jeremy's go-ahead (2026-10-20, branch `feat/staghorn-fish`, #143: "merge"). `package.json` and `package-lock.json` move to `0.31.4`. Jeremy (2026-10-20): "do fish now interact with the new staghorn corals? if not, establish behavior. there should be some sort of universal behavior to govern all fish interaction with various coral types". They did not: the staghorn was only a steering obstacle, and the reef-site rays passed through it, so a fish could settle at a rock face or a table's rim with branches through its body.

### Fish behaviour

- Coral forms (`docs/reef-behavior.md`, Coral forms): coral behaviour is split by growth form, not species. `CORAL_FORMS` in `reefBehavior.js` says how each reef mode plays at each form: a `table` (under the plate, at the rim) and now a `thicket` (over the crown, at the flank, in among the branches); `mound`, `fan` and `host` are written down as proposed. Five rules hold for every fish at every coral: corals are solid to the site rays, a fish goes in only where it has room to turn, every coral is a steering obstacle, each decision picks rock or a form by the species' share for that mode, and a coral search that finds nothing tries rock.
- Staghorn thickets join the reef-site surfaces: one per patch (37 inside the reef reach), its colonies' `_far` meshes merged with a BVH tree, built one patch per slice after the placement (119k triangles, 56 ms in all, 3.6 ms worst per patch). `setCoralSurfaces` now takes any number of sets, each tagged with its form.
- At a thicket: hovers hang 0.7–1.2 body lengths over a colony's crown, level and 12° nose-down (60% of thicket hovers) or beside its flank, facing the colony's outline; patrols pass right over the crown; pecks pick at the outer branches; fish up to 0.8 WU (the juvenile angelfish) shelter in among the branches. Searches aim at a colony, not the patch's middle (mostly bare rock), and check room in 26 directions, cast only at nearby surfaces: thin tips slipped between the eight level rays and came within 0.09 body lengths of a fish.
- Shares (`reef.corals.<form>`, was `reef.coral`): the bannerfish hangs over the crowns most (0.4; table hover 0.6 → 0.45), the juvenile angelfish hides among the branches (0.3; table shelter 0.7 → 0.55), the adult angelfish, grouper and triggerfish hang by or cruise past them less. Over 5 minutes on desktop, thickets took 25 of 235 visits, 60% of thicket trips succeeded (rock 69%, tables 63%), no fish came within 0.26 body lengths of a branch, and thicket searches took 1.1–1.7 ms median, 6 ms worst (a rock shelter 2.9 and 8.4 ms in the same session).

## v0.31.3 — Reef camera tilt

Status: accepted and promoted as clean `v0.31.3` from `v0.31.1-dev_1` on Jeremy's go-ahead (2026-10-20, branch `reef-camera-tilt`, #140: "Looks good on my phone, merge and promote"). Built as `v0.31.1-dev_1` on clean `v0.31.0`; `v0.31.2` merged in the meantime, so the clean number is `v0.31.3`. `package.json` and `package-lock.json` move to `0.31.3`. Jeremy (2026-10-20): "angle camera slightly down for the reef so the central outcrop bommie sits around the center/slightly below the center of the screen".

### Camera

- The Reefs' resting camera (`REEFS_VIEW`) pitches 1.6° down instead of 5.4° up (look target y -10.5, was -7.4); position, turn and 42° field of view are unchanged. The central outcrop moves from about 70% to about 53% of the way down the frame on desktop (1280×720) and a 375 px phone. Coral placement reads the view's direction but picks the same rocks at either pitch (checked side by side).

## v0.31.2 — Lossless performance cleanup

Status: accepted for clean `v0.31.2` from `v0.31.2-dev_3` on YK's explicit merge approval (2026-10-20, PR #142 / #141, branch `feat/lossless-performance-cleanup`). Baseline clean `v0.31.0`; other open review branches keep their own release buckets. No database changes. Physical-phone performance improvement remains unmeasured; release approval is not a claim that mobile lag is solved.

### Performance / assets

- Cache each fish's material-pass mesh targets instead of rediscovering the full object/bone tree every frame. Keep current material references, every-frame writes, depth light, fades, alpha blending and proxy exclusions; refresh when nested model/LOD/debug children change and remove listeners on cleanup.
- Losslessly recompress embedded PNG IDAT data. Preserve filtered rows, decoded pixels, all PNG format/colour/provenance metadata, texture dimensions/sampling and GLB geometry/animation semantics. No downscaling, lossy compression, water/boids/cadence or visual simplification.
- Add equivalence/lifecycle tests, an asset verifier with mutation-rejection tests and an isolated material-pass microbenchmark. Detailed evidence and rollback in `docs/lossless-performance-cleanup.md`. Smaller download size is not a claim of lower decoded/GPU memory or a complete fix for mobile lag.
- Review hardening: run Python/Pillow regression tests in CI; refuse unsupported GLB extensions and invalid BIN/view ranges; keep validation active under Python optimized mode; report new models separately and reject removals rather than aborting comparison or implying baseline equivalence. Runtime material logic and the optimized GLB bytes are unchanged by these tooling fixes.
- Preserve JSON types in equivalence checks: reject boolean/float buffer indices and distinguish booleans from numeric values in normalized semantics, rather than relying on Python's `False == 0` / `True == 1` equality.

## v0.31.0 — Staghorn coral

Status: accepted and promoted as clean `v0.31.0` from `v0.31.0-dev_3` on Jeremy's go-ahead (2026-10-20, branch `feat/staghorn-coral`, #139: "push and merge to main"). `package.json` and `package-lock.json` move to `0.31.0`. Jeremy supplied a staghorn coral model (*Acropora muricata*). In `dev_1` it grew as thickets on their own at the foot of a few rocks (his first pick); seeing them he asked to "place the staghorns together with the table corals so they look like a cluster? a bommie? now they just look so sad and separate", with "same colour ones" clustered together, "not a random scatter", after his photos of staghorn fields with tables among them and a staghorn thicket crowning a rock. On `dev_2` he found the low detail levels "really bad" ("i shouldnt be able to see sharp pointy edges") and saw backface problems.

### Corals

- Staghorn kit (`scripts/build-staghorn-kit.py`, headless Blender 5.2): Jeremy's GLB (13 colonies stacked at the origin, 9 unique meshes in three colours, 242k triangles, 42 MB with six photo textures) becomes two colonies per colour, a big and a small one: `staghornN_hi` (2,200–4,000 triangles), `_lo` (1,000–1,800), `_far` (350–600) and `_min` (160–300), with the full-detail sources baked into one colour and one tangent-space normal map per colour, shared by its two colonies (colour 2048 px for brown and cream, 1536 px for blue; normals 1024 px). 2.0 MB GLB plus six JPEG maps, 5.9 MB (`public/models/landscape/staghorn-*`). Map sizes follow the source's texel density, 7–11 texels per cm of coral: the first bake (a 512–1024 px map per colony, Smart UV Project's packing using 17–30% of it) gave 2.7–5.3, which Jeremy found "very very bad" close up; the shared, concave-packed maps (36–41% used) give 7.8–10, about the source. Same-camera close-ups at 35 cm match the source's own sharpness; finer detail than that is not in the source photos. Collapse decimation flattens a thin branch into a pointed blade once its tube runs out of triangles: `dev_1`/`dev_2`'s `_lo` (600–1,100) and `_far` (160–300) did, so `dev_3` keeps about half and a sixth of `_hi` and the old `_far` budget only for `_min`. The decimated branches are five- or six-sided tubes, so the unwrap uses an 80° angle limit (the table kit's 66° gave every triangle its own island and a 3.5 MB GLB) and smooth normals.
- Placement (`src/components/staghornPlacement.js`), on the table corals' bommies (`dev_2`): once the tables are placed, each table cluster gets a patch of staghorn for about every 4 tables (3–6), each patch one colour (staghorn spreads by broken branches that root where they land, so a patch is one clone), neighbouring patches in different colours. About a third of the patches stand at the rock's foot, on the sand within 2.5 WU of it, the rest on its top and shoulders among the tables, mostly on the side facing the resting camera. A patch is 2–3.2 WU across either way and holds 12–18 colonies, the big ones first in its middle. A colony stands on a ledge (normal y ≥ 0.45) or the sand within 4 WU of its patch's height, sunk 6–14% of its height, turned at random and tilted up to 9°, at 0.9–1.5 times the scanned size; it is kept only if at most 3 of 24 branch points touch rock and 3 dip into the sand, none comes within 5 cm of a table's plate (nor does its base), its base is over a fifth of the summed branch spreads from its neighbours' (they interlock) and it stays under `maxTop`. Result: 371 colonies over the 9 table bommies (28–63 each). `dev_1`'s separate thickets (96 colonies at 6 bare rocks) are gone.
- Drawn as one `THREE.LOD` per bommie, its levels merged per kit model, switched by the live camera's distance: the close-up level within 22 WU, `_lo` to 50 WU, `_far` to 75 WU, `_min` beyond. The close-up level is `_lo` until the camera comes within 28 WU of the bommie; then its `_hi` meshes are merged, one kit model a frame, and swapped in, and freed again beyond 45 WU (`StaghornBommie`). In `dev_2` only bommies near the resting camera had `_hi`, so the diver and follow cameras met the flattened `_lo` up close everywhere else. Drawn two-sided (`doubleSided` on the kit), so a thin branch seen edge-on never shows through. From the resting view the staghorn draws 134k triangles (`dev_2` 94k, the tables 38k). Placement runs in 6 ms slices after the tables' and is kept for the session.
- Fish steer round the colonies: each publishes an obstacle box, and rockObstacles.js now holds any number of extra obstacle sets (`setExtraObstacles` returns an owner; it held one before, which the staghorn would have replaced).
- Shared with the tables (Landscape.jsx): `useCoralKit` (meshes and materials), `useSlicedPlacement`, `kitGeometry`, `useExtraObstacles`; the table corals draw as before.

### Atlas

- Staghorn Coral (*Acropora muricata*, Acroporidae), Endangered (IUCN, 27 April 2023, A3ce). Specimen (`scripts/build-staghorn-atlas.py`): 14 colonies round a low rock in three one-colour patches (brown, blue, cream), on the table coral's faint sand patch, 3.16 × 2.06 m, framed like the table coral (30° down). GLB 4.6 MB: it embeds the colour maps at half size, as the Atlas shows the whole thicket at once. Tile: an in-tank close-up of a bommie crowned with brown staghorn, blue on its shoulder and tables at its foot. Checked on desktop and a 375 px phone (no overflow) in `dev_1`.
- The landing card counts 14 species (`landscapeSpecies` adds `acropora-muricata`).

## v0.30.1 — Fish at the corals

Status: accepted and promoted as clean `v0.30.1` from `v0.30.1-dev_1` on Jeremy's go-ahead (2026-10-19, branch `feat/table-corals`, #136; "Looks good on my phone"). `package.json` and `package-lock.json` move to `0.30.1`. Jeremy (2026-10-19): "build fish behavior to interact with the corals, hide underneath, within, peck at it"; "add the radial sand highlight gradient thing back to the atlas, but make it more subtle than the previous iteration"; "does number of species include the corals? on the landing modal at the start".

### Behaviour

- Reef fish use the table corals (`docs/reef-behavior.md`, Corals). The tables inside `reefReach` join the surfaces the site search raycasts (`setCoralSurfaces` in reefSites.js beside the rocks' set), one per table from its `_lo` mesh with a BVH tree, built once per placement. Each reef decision picks coral or rock first, by the species' share for that mode (`reef.coral`; defaults patrol 0.35, hover 0.5, peck 0.6, shelter 0.6); a coral search that finds nothing tries rock the next frame.
- Hiding under and within: a coral shelter aims below the plate, at the stalk, and keeps only a rest point with a surface straight overhead (`requireCover`), so the fish tucks under a table or between two stacked tiers. With the plate overhead it needs less enclosure than a rock nook (0.25, against 0.35). Pecks, hovers and patrols aim at the plate's rim height, with 12 tries (rock 8).
- By species: the grouper hides under the tables most (0.8) and hangs by them (0.5), after Kerry & Bellwood (2012): large reef fishes, coral trout among them, used tabular corals at least three times as much as branching or massive ones (Lizard Island). The juvenile emperor angelfish shelters under them (0.7), the adult nibbles their rims (0.65), the bannerfish hangs by them (0.6), and the clown triggerfish, whose prey is on the rock, seldom pecks them (0.1) but takes cover under them (0.5).
- Line-up points a fish can reach: a site's entry point must now lie outside every rock's and table's padded steering shape (`reachable`, rockObstacles.js `insideRock`), else a nearer one, else one 1.6 entry distances out. Before, about a quarter of trips lined up inside the padding, and 10 of 13 such trips were given up circling short of the site, on rock and coral alike.
- Measured on desktop at The Reefs: over about 90 s, corals took 7 of 11 shelters, 10 of 21 hovers and 4 of 18 pecks (an earlier 60 s run: 13 of 16, 12 of 41 and 14 of 27), and 5 of the grouper's 6 visits. Coral trips settle as often as rock ones (59% against 62%; the rest are mostly startles and stalls far from the site). Leaving a coral is as smooth as leaving rock: fastest move in the first 2 s 8 WU/s (rock 8.4), no jumps. Search cost, one a frame at most: coral shelter 1.4 ms median, 3.3 ms worst (rock 1.9 / 4.2); coral rim 0.4 / 1.4 ms (rock 0.3 / 1.1).
- In view: the clusters stand in front of the resting camera, so a fish at a coral is on screen and not hidden by rock 66% of the time on desktop (a fish at rock 17%) and 45% on a 375 px phone (rock 31%).
- Debug label: `reef shelter hold coral`.

### Atlas

- The sand patch is back, fainter (Jeremy: "more subtle than the previous iteration"): a 3 m disc at the rocks' foot line, the tank floor's sand toned to 25% (was 45%), at most 60% opaque (was fully), fading out from 30% of its radius (was 40%), a little darker under the rock. On the stage it measures RGB(40, 70, 104) against the backdrop's RGB(13, 39, 76); the first patch measured RGB(125, 147, 160) and read as a white glow. Alpha-blended again (`model.alphaBlend`); GLB 3.28 MB (was 3.18). Checked on desktop, 375 px portrait and 812 × 375 landscape.

### Landing

- The species count on the landing card includes the coral: 13 (was 12). A tank lists species that have no creature rows in `landscapeSpecies` (The Reefs: `acropora-hyacinthus`), and App.jsx counts them with the creature species.

## v0.30.0 — Table corals

Status: accepted and promoted as clean `v0.30.0` on Jeremy's go-ahead (2026-10-19, branch `feat/table-corals`; "this is good enough to merge a clean version to main first"). `package.json` and `package-lock.json` move to `0.30.0`. The branch stays open for `v0.30.x` iterations. Jeremy (2026-10-18/19) asked for a coral to start The Reefs' colour, chose the table coral (*Acropora hyacinthus*), modelled it from reference photos, and set the look from his photos of a bommie crowned with tables.

### Corals

- Coral kit (`scripts/build-coral-kit.py`, headless Blender 5.2): Jeremy's GLB (three corals, ~40k triangles, 35 MB of Commons photo textures) is welded, moved so its origin is the stalk's foot, decimated to `coralN_hi` (3,000 triangles; 1,400 for the small one), `coralN_lo` (700; 300) and `coralN_far` (160; 60), and the full-detail source is baked onto `_hi` into a 1024 px colour map and a tangent-space normal map that keeps the bristly branch tips (512 px for the small one). 39 MB in, 0.8 MB GLB plus six JPEG maps out (`public/models/landscape/table-corals.glb`, `coral0..2-color/-normal.jpg`). The models: a 2.5 m cream table with a raised tier, a 2.2 m pink table on a far off-centre stalk, and a 0.7 m small table.
- Placement (`src/components/coralPlacement.js`), once per landscape, against the rocks as drawn. A table grows where a ray finds rock: down onto a ledge (normal y ≥ 0.5) or the sand at a rock's foot, stalk sunk a sixth of its height; or in toward a wall, plate out of the face and stalk inside the rock (kept only if the stalk's foot and middle test inside). A candidate is kept only if at most 6 of 32 plate points are inside rock, no plate point dips into the sand, it clears every plate already placed with 20 cm of water between overlapping tiers, and it stays below `maxTop`. Plates tilt at most 5° and overhang away from the rock.
- Clusters, after Jeremy's photo (2026-10-19: "denser clusters but less number of clusters everywhere"): each cluster crowns one rock (a stack with its tiers and talus, `coralRockOf`) in three passes: about 20% big tables (50–80% of the rock's narrower width) low round its foot, on a low ledge or the sand within 2 WU, spreading out over the sand; 30% small ones (15–32%) on its top on visible stalks; the rest (20–45%) up its shoulders, a quarter of them out of a wall. Earlier builds this cycle spread 541 tables over 58 rocks; Jeremy found them "very sparse".
- Where: the mid-ground outcrop (hand-placed, 26 tables) plus up to 14 more clusters on rocks at least 1 m tall and at least 0.45 as wide as tall (the slim foreground pillars stay bare: a table on a post reads as a mushroom), whose tops reach y -21, within 95 WU of the resting camera and in front of it (within 75° of its view, favouring the view itself and nearer rocks), at least 20 WU (5 m) apart. Result: 130 tables in 9 clusters.
- Scale: 1 WU = 25 cm as for the fish. Widths 40 cm to 2.5 m: adult tables average 1.47 ± 0.49 m (tagged colonies, Philippines), young colonies of 20–60 cm make up most of a reef's tables, the largest reach several metres (SeaLifeBase). A lineup render against a 1.65 m person and the angelfish, triggerfish and grouper at true length confirmed the proportions.
- Drawn merged per model and 60 WU chunk (frustum-culled), each table from `_hi`, `_lo` or `_far` by distance from the resting camera (30 / 60 WU). Placement runs in slices of about 6 ms a frame (a generator yielding every 20 candidate spots; longest step measured 2.2 ms) and is kept per landscape for the session.
- Fish steer round the plates: rockObstacles.js takes a second, extra obstacle set (`setExtraObstacles`), and each plate publishes an ellipsoid box from its underside to its top.
- Image credits: Ryan McMinds, "Acropora hyacinthus, Kelso Reef" (CC BY 2.0), and Holobionics, "Lodestone Reef, Valentines Day 2016 CoralScape" (CC BY-SA 4.0; the adapted texture is shared alike), in Sources.

### Atlas

- New entry: Hyacinth Table Coral (`acropora-hyacinthus`), Endangered (IUCN 2023, A3ce), not a swimming creature: no `swim`, no tank roster slot, no creature rows. Range per Rassmussen et al. 2025 (central Pacific and Australia's east coast), 1–25 m; diet, colonial grouping, hermaphrodite broadcast spawning a night or two after a full moon (season by latitude). Unknowns left `Unknown`. It sorts first (Nº 001).
- The specimen is a cluster (`scripts/build-coral-atlas.py`): nine of the tank's tables crowning a small bommie (the kit's blockiest rock, `rock0`, with a low lump at each front corner), one 2.8 m table spreading out low at the front-right, small ones on top on their stalks, placed with the tank's checks. The Atlas's brighter, bluer lights washed the plates grey-white, so the Atlas copies are tinted ×(0.95, 0.8, 0.7); the tank's corals are unchanged. A soft sand patch was tried and dropped (Jeremy: "remove the white radial highlight").
- The camera can look down further per species (`pitchDegrees`, EncyclopediaPage.jsx): the coral is seen from 30° above (others 15°). The model is shown smaller and the camera closer (2.7 display units at 6.4) so the phone's pulled-back camera stays under the water surface (y 4.6); above it the stage turned into a flat blue silhouette.
- List tile: Jeremy's own capture of a coral cluster in the tank, square-cropped to 470 px.

### Performance

- The Reefs' rocks are built once per page load (`builtLandscape`, Landscape.jsx). Switching tanks, React rendered the new tank five times before committing while its models loaded (production build), and each pass rebuilt every rock: 200–400 ms each, about 1.3 s of main thread wasted per visit. Measured on the production build, first visit: one build, stalls 228 + 64 + 162 ms (was eight stalls totalling about 1.9 s); return visit: no build, 90 + 67 ms. GPU copies are still freed when the tank unmounts and re-uploaded on return.

### Known issues

- In the tank the plates read pale grey from the resting view (fog and distance); only the Atlas copies are warmed.
- The two tall foreground pillars carry no tables, so from the resting view the clusters show on the outcrop and the near foreground mound; the massif's clusters show from the diver camera.
- Reef fish steer round the plates but do not hover at or shelter under them yet (sites come from rock raycasts only).
- Switching to The Reefs still renders the tank five times while models load; only the rock build is cached.

## v0.29.0 — Reef behaviour and a new look for The Reefs

Status: accepted and promoted as clean `v0.29.0` from `v0.29.0-dev_13` on Jeremy's go-ahead (2026-10-19, branch `feat/reef-behavior`, #134). `package.json` and `package-lock.json` move to `0.29.0`; `three-mesh-bvh` (0.8.3, already installed by drei) is now a direct dependency. Jeremy (2026-10-18): "write new behavior for reef associated fish to have reef associated behavior? hang out around rocks, feed from/poke at rocks (swim forward and jerk back), hide in caves, etc".

### Behaviour

- Reef fish keep to the rocks (`docs/reef-behavior.md`). The bannerfish, emperor angelfish (adult and juvenile), clown triggerfish and squaretail grouper each get a `reef` profile: `affinity` (share of decisions spent at the reef, 0.7 to 0.9) and weights for four modes. `patrol` cruises past a face; `hover` hangs 1 to 1.6 BL off it; `peck` darts in to the face, bites, jerks back and repeats 2 to 7 times; `shelter` tucks into a nook, turns to face out, and is not startled there. By species: the angelfish pecks most (grazing sponges), the triggerfish pecks fewer and harder with a head shake and shelters after a scare (85%), the grouper hovers and shelters for long spells and never pecks, and the juvenile angelfish shelters most.
- Travel to a site runs on the unified pipeline. Settling in, the time at the rock, and turning to leave own the pose, like the sun-bask hold. Measured peck cycle on a 1.6 WU angelfish: snout 0.51 WU off the face at rest, in to 0.02 WU in 0.29 s, a 0.2 s bite, back to 0.7 WU in 0.19 s.
- Sites come from raycasts of the drawn rocks, not the steering ellipsoids, so a peck lands on the visible face. Landscape keeps the rocks inside the new `reefReach` box whole, each with a three-mesh-bvh tree (now a direct dependency, the same 0.8.3 drei already installs). One search per frame at most: 0.3 ms median for a peck site, 0.8 ms median and 4.8 ms worst for a shelter (desktop). Tree build is about 13 ms per tank mount.
- Each fish keeps a home rock; its open-water swims stay within its home range. A pair follower lets its mate be while the mate is at a rock and does its own reef behaviour nearby. A fish at a rock finishes before it rejoins its mate or follows the sunfish.
- Reef fish open at their rocks (dev_2; Jeremy: "when i start the app, it seems like all the fish are just randomly scattered across"). On its first frame each picks a site near where it would have spawned and starts part-way through a hover, peck run or shelter; with chance 1 − affinity it starts just off the rock instead. A pair follower starts by its mate's rock. On a fresh load 31 of the first 42 reef fish were at a rock (was none); the spawn frame took 10.3 ms on desktop, since spawn searches skip the once-a-frame limit. After the first visits about 55% stay within 5 body lengths of rock; most of the rest are with a mate or the sunfish.
- In, out, hang about, move on (dev_13; Jeremy: "i dont need them to like wiggle left right when pecking. think of how an actual fish woudl do it. in out, hover around, move on"). Four things read as wiggling, all gone: the head shake while nibbling (removed, `biteShakeDegrees` dropped, the triggerfish's too); the fish re-aiming its body at each small facet of the rock between pecks (up to ~40°; it now faces the site along its normal the whole visit); hopping sideways to the next spot (0.3 BL, now 0.1, at nearly the same place); and the hover's heading wander (±34°, now ±14°, easing in over the first 1.5 s). One or two pecks by default (was 1 to 3; angelfish 1 to 3, was 2 to 4), then the fish hangs about 0.35 BL further off the spot for 2 to 5 s (`afterPeckHoverSeconds`) before it leaves. Measured on an adult angelfish visit: 0° of heading swing through every rest, ease-in, nibble and ease-back; the largest turn in the first 2 s of hanging about was 0.4° per 30 ms (was 5°).
- Gentle pecks (dev_12; Jeremy: "it actually looks too sharp. like i think it can just be a gentle peck, not multiple violent pecks"). By default 1 to 3 pecks (was 2 to 5; angelfish 2 to 4, was 3 to 7), 1.2 to 3 s apart (was 0.4 to 1.1). Each eases in over 0.6 s (was 0.28), nibbles for 0.35 s with a 1.5° head shake at 5 Hz (was 0.16 s, 4° at 8 Hz), and eases back over 0.7 s with smoothstep (was a 0.16 s ease-out snap that started at full speed). The snout rests 0.18 BL off the face (was 0.32) and eases back only 0.03 BL past it (was 0.12). The triggerfish stays a little firmer: 1 to 3 pecks, 0.5 s in, 0.45 s holding on, 3° shake (was 9°). Measured on a juvenile angelfish: one peck, peak speed 0.12 WU/s in and out; the old snap back peaked near 10 WU/s on an adult.
- Fish no longer vibrate near rocks (dev_11; Jeremy: "why do the fish kinda vibrate or tweak out occasionally?"). Measured per frame over 30 s with ~48 reef fish: the body heading flipped back and forth by more than 2° a frame 67 times; 54% of those inside a rock's padded proxy, 27% in followers steering by a shaking leader. The cause was the rock clamp and the steering fighting: the turn step aimed the heading back into the face every frame and `pushOutOfRocks` slid it along the face the next. Now, for 0.35 s after the clamp pushes a fish off a face, its steering drops the into-face part of its desired heading (`ROCK_CONTACT_MEMORY_SECONDS`, as the swim walls already do with `boundaryContacts`), and the rock-avoidance bend is smoothed per fish (on in ~0.1 s, off over ~0.4 s) instead of switching off the frame the probe clears. After: 3 flips in 30 s (2 fish), none at a rock or in a follower; the only sharp position changes left are the peck's designed jerk back.
- After leaving a rock, the rock clamp comes back over 1.5 s, so the fish eases out of the proxy padding instead of jumping.
- Swim volumes: the four species now reach down to y -19 and back to z -52 (`REEF_BOUNDS`), keeping their own front edges. The triggerfish and grouper no longer keep to a shallow band under the surface (y -1.9 to 2.7).

### Landscape

- A mid-ground outcrop inside the swim volume, just right of centre, so the phone sees reef life (Jeremy: "Add a mid-ground rock outcrop inside the swim volume near the centre ... horizontal limestone stacks, no columns, keep the triangle"). A three-tier stack at x 2.5, z -33 (16 × 11 WU base, top y -10.7) and a lower two-tier stack to its left at x -6.5, z -26.5 (top y -17.6), so it steps up to the right like the rest of the reef. The top stays 4.7 WU below the resting camera's eye line, keeping the open blue down the middle. Without it, the reachable rock was almost all the right-hand massif, and a 375 px phone saw 1.5% of the fish at a rock; with it, 15%, and 12% to 16% of each reef species (fish in frame, not behind rock, within 55 WU). The sunfish passes over it at y -3 without stalling.

### Look (dev_3)

Jeremy (2026-10-18): "the whole view looks a bit dead. should we change up the camera position a bit? Also maybe since its the reefs the waters should be shallower and maybe the colours are brighter and less foggy?"

- Shallow-reef water for The Reefs: the tank's `lighting` now overrides the whole palette, not just exposure and fog. Turquoise background and environment (`#8fe0f7` at the surface down to `#0d4a66`), a light sea-green haze (`#1f6f8c`, was the ocean's `#0a2d5e`), warm key sunlight (`#fff0d4`), exposure 1.12 (was 0.97), fog density 0.011 (was 0.016), brighter beams (0.22, was 0.1). The water depth itself is unchanged (sand at -24, surface at 4.6).
- The water surface takes a per-tank tint (`lighting.surfaceColor`, `lighting.surfaceAttenuationColor`, WaterSurface.jsx): turquoise here, so the underside no longer reads as dark slate.
- Resting camera: eye at y -9 (was -6), looking at y -7.5 (was -4.3), 42° (was 47°), still at z 14. The outcrop's top now sits at eye level against open water. A closer camera (z 9) was tried and dropped: it looked down onto bare sand and stood the foreground bommie in mid-frame.
- The foreground bommie at x 3.2 (seed 62) is capped at y -12: from the lower eye it rose to 63% down the frame as a column; it pokes up from the bottom edge again.
- The mid-ground outcrop moves 4 WU nearer (main stack z -29, was -33; the satellite to x -7, z -23.5). With fish starting at their rocks, the phone sees 22% of the fish at a rock (15% at dev_1). The camera change on its own barely moves that (23% from the old view against 22% from the new, same fish), and a reef fish is still about 20 px long on a 375 px phone (18 px before): the gain is mood and framing, not size.

### Colour (dev_4 to dev_8)

Jeremy (2026-10-18) sent five reef photos as colour references: "i think u may darken the limestone if u need to / paint shadows". What they share: dark rock against bright water, sunlit tops and near-black undersides, distance fading to luminous azure, sunbeams from the surface, pale sand.

- Painted rock shade (`rockShade` on the landscape, `applyRockShade` in Landscape.jsx): the limestone is darkened to 0.6, its upward faces lifted to 1.2 of that and its downward ones taken to 0.22, and it darkens toward its base (0.35 at the sand, y -24, to full at y -6). The hemisphere fill from below is near-black (`#06202c`), so undersides stay in shadow.
- Water by height (dev_6; Jeremy: "not a big fan of the super bright cyan blue. look at the references again", then "there should be a stronger gradient. closer to the sea bed = darker. closer to surface = more cyan"). dev_4's all-over bright cyan (haze `#2a96cc`) read flat; the references share a deep blue that darkens with depth and distance. New `utils/heightFog.js` patches three's fog chunks once so the fog colour follows the world height of what it covers: deep navy `#03152c` at the sand's mean level (y -24) to cyan `#43b6d8` at the surface (y 4.6), and what lies by the sand is lit at half strength (`seabedLight` 0.5). A tank opts in with `lighting.heightFog`; SceneLighting switches it on just before the tank's scene renders and off after, so the Open Sea and the Atlas render as before (checked: strength 0 and the scene's render hooks restored after switching tanks). Background from `#8edbf2` overhead through `#47bde0` at 0.3 and `#17609b` at the horizon to `#03142b` straight down, with the steps inside the band the resting view sees (0.35 to 0.58); surface tint `#6cc6e2`; fallback haze `#14588f`, density 0.013, exposure 1.06. Pale sand `#c4bea2` (was `#a39c80`).
- Deep blue, not black, and dark with distance (dev_7; Jeremy: "bottom is way too dark. i think the dark also = more deep blue rather than black. can u accentuate this darkness in the background and keep the foreground lighter?"). The light lost near the sea bed now scales with the fog factor, so near rock and fish keep their light and the shadow gathers further off. The sea-bed haze is deep blue `#0b3070` (was near-black `#03152c`), and the bottom of the background runs `#11478a` → `#0a2c60` (was `#0c3a68` → `#03142b`). Fog density 0.016 (was 0.013), so the distance carries more of it. The painted shade on rock bases eases (low 0.6, was 0.35; overall tone 0.66, was 0.6; undersides 0.25, was 0.22).
- No light shafts in The Reefs (`lighting.godRays: false`, dev_5). dev_4 had made them near-white additive sunbeams placed for the low camera; Jeremy: "idw the fake sun beams". The Open Sea and the Atlas keep theirs.
- Warm sunlit tops (dev_8): the rock's upward faces near the surface tint toward ochre (`rockShade.warm`: up to 0.5 of the way to ×[1.18, 1.02, 0.78], from y -18 to 0), a stand-in for the colour corals will bring against the blue.
- Caustics (dev_8; Jeremy: "dont over do this ... make sure the caustics is 3d space projected on the landscape this time. keep it optimised"). New `utils/caustics.js`: a tileable 256 × 256 Voronoi edge net built once on the CPU, sampled twice per fragment at two scales drifting apart and combined by their minimum, added as light (times the surface colour) to the rock and sand shaders. Each point looks it up by its world position, slanted along the sun ([0.4, −0.4] per WU of height), so it lies on the landscape and holds still under a moving camera. Upward faces only (|normal.y| on the double-sided sand); cells about 1.5 WU (37 cm) across, drifting 0.02 tiles a second; 60% strength at the sand rising to full at y 0; faded out between 25 and 60 WU from the camera so it never shimmers. Measured cost in the resting view: 7.1 ms median frame with it, 6.9 ms without (noise).
- Still missing from the references: colour on the rock (coral, sponges). That needs coral models.

### Camera (dev_9, dev_10)

- Resting view from Jeremy's diver-camera screenshot ("can we make this the defautl caemra view? or something liek this but aligned to world xz. nice foreground and background composition"): eye at y -12.5 (was -9), looking at y -11.35 (about 4.7° up, was about 6°), still 42° at z 14 on the x 0 line, straight down -z. The canyon columns sat at the same screen x in his shot as in the dev_7 view, which fixed the field of view and z; the height and pitch were solved from where the foreground bommie's top (on the eye line) and the left column's top (a quarter down) fall in it. The near rocks now rise above the eye line and frame the bottom of the frame, the outcrop and its fish sit in the middle, and the columns stand behind. On a 375 px phone the outcrop and its fish sit in the centre between the near rocks and a column.
- dev_10: the resting view is the pose Jeremy framed in the diver camera in the browser pane ("ok yea do it"), read off the live camera: x 12, y -9.8, z 25.2, turned 9.5° left and pitched 5.4° up, 42°. The resting camera takes an x position and a look target now (`x`, `lookX`, `lookY`, `lookZ`; Camera.jsx), and the rock detail levels measure from the same x. The turn centres even a 375 px phone on the outcrop (x 2.9 at its depth). The nearest rock is a scatter boulder 3.6 WU behind and below the camera.
- Reef fish come forward to the foreground rocks (dev_10; Jeremy: "can we have the fish swim closer also? so they also hang around the foreground rocks", "u may jsut expand the swim boundary. im okay with them swimming off screen also"). Their volume runs to z +8 (was -15, or -8.3 for the triggerfish and grouper) and is a box ±58 WU wide (new `boundsHalfX`; fishSwim.js `halfXAt`/`sideKAt`) rather than the shared wedge that narrows toward the old camera (±13 at z 0); every other species keeps the wedge. The site raycasts reach the foreground rocks (`reefReach` to z 10).
- The sand is an obstacle (rockObstacles.js `setSeabed`/`liftAboveSeabed`): toward the front it rises above the reef fish's y -19 floor (to -18.1 at z +6), so fish are kept about half a body depth above it and level off along it, open-water targets are lifted out of it, and reef sites must clear it. Measured: no fish below the sand over 1,260 samples.
- Reef fish favour what the visitor sees: 60% of new homes go to the middle of the resting view (18 to 58 WU out, within 15% of that to either side), and half of site searches come at a rock from the camera's side and keep only a spot the camera can see (one more ray). Without that, the wider volume spread homes over the whole reef and the fish at a rock were in sight 3–4% of the time. Settled, desktop now sees 38% of the reef fish (17% of those at a rock) and a 375 px phone 16% (8%); 59% of the fish at a rock are at the foreground rocks.

### Known issues (dev_1)

- No caves in the landscape: shelters are nooks between ledge tiers, common for small fish and rare above about 1.5 BL.
- Fish use the outcrop only when it is near their home, so most reef activity is still on the right-hand massif, which desktop sees partly and the phone not at all.

## v0.28.0 — Squaretail Coral Grouper

Status: accepted and promoted as clean `v0.28.0` from `v0.28.0-dev_1` on Jeremy's go-ahead (2026-10-18, branch `feat/plectropomus-areolatus`, #133). `package.json` and `package-lock.json` move to `0.28.0`. Jeremy (2026-10-18): a caudal swimmer for The Reefs, low effort, IUCN Vulnerable or worse, not a shark.

### Species

- Squaretail Coral Grouper (`plectropomus-areolatus`, Epinephelidae, IUCN Vulnerable): Jeremy's model in The Reefs and the Atlas on `caudal-vertex`, 80 cm = 3.2 WU, with independent pectoral and pelvic fins. Facts from FishBase; the reproduction copy says the sexual pattern is unresolved (FishBase lists protogyny, but Rhodes et al. 2013 found no fish changing sex and a Solomon Islands study found separate sexes). Swim values are starting values: slow cruise, rare hard bursts, menace and wariness 0.3.
- Model intake: the texture's alpha was solid, so the 2.9 MB PNG ships as a 193 KB JPEG (quality 85, mean colour unchanged) with the GLB's BLEND dropped; the GLB goes from 3.0 MB to 0.35 MB. Jeremy narrowed the body after review (width 72% of depth, was 85%). Added to `verify:procedural-fish-assets`.
- Sources: Rickard Zerpe's photo (CC BY 2.0) joins the Image credits.
- `creatures_dev`: 3 groupers (ids 412–414; sizes 0.35, 0.6, 0.9 ≈ 51, 59, 69 cm), backed up before and after. Production has none.

- Atlas tile: a three-quarter head close-up of fish 414, rendered alone in open water (470 × 470).

### Tooling

- `npm run build` now runs `scripts/verify-atlas-tiles.mjs` first (`prebuild`): every Atlas species needs an `atlasThumbnail` file in `public/`. A `-dev_` version only warns; a clean version fails. Tiles had been forgotten until after promotion (triggerfish, then the grouper at `dev_1`). The new-species checklist now makes the tile part of the step where the species first swims.

### Interface

- Info card: the species name wraps between words (`whiteSpace: normal`, `textWrap: balance`) instead of staying on one line. "Squaretail Coral Grouper", the longest name yet, ran under the close button on desktop; it now takes two lines there and still fits one line at 375 px.

## v0.27.0 — Diver tracking, changelog, grouped image credits

Status: accepted and promoted as clean `v0.27.0` from `v0.27.0-dev_1` on Jeremy's go-ahead (2026-10-17, branch `cleanup`, #132). `package.json` and `package-lock.json` move to `0.27.0`. Jeremy (2026-10-17): the version label opens the changelog history for visitors (features and fixes only); image credits in one section of the Sources panel instead of a card each; slower WASD and a less sensitive mouse in the diver camera. Then: "holding down right click reveals a green tracking square of what the camera is tracking, then left click confirms it. left click again detaches", tracking as a damped track that lags like the mouse look; then "focus on a specific part of the fish not the whole fish", and "its still tracking like the center of the fish and i cant select lets say the tail or the face".

### Interface

- Tapping the version label opens a Changelog panel (`src/components/ChangelogModal.jsx`, on the Sources panel's chassis). It reads `src/data/changelog.js`, a visitor-facing summary of each release, newest first, every line marked New or Fix; tooling-, code- and data-only releases are left out. This file stays the engineering record. A lone tap opens it once no second tap follows within 320 ms, so the triple tap that toggles debug still works and never opens it.
- Sources: the two texture-photo credits move out of the reference list into one Image credits section at the end (`IMAGE_CREDITS` in `src/data/sources.js`), each line keeping the work, author, licence link, and changes made.

### Camera

- Diver tracking (desktop): holding the right button stops the mouse turning the view and moves a green aim cursor over it instead (one pixel per pixel, from the middle). `pickAimedFish` raycasts every fish near the cursor's ray (within 7° of it, counting half the body length either side of the fish's origin, up to 80 WU) and takes the first drawn body the ray hits, so a remora riding the mako no longer wins over the mako's flank under the cursor. With no body hit, the fish closest to the ray is taken (the current pick keeps a 1.5° advantage so a school does not flicker) and its nearest vertex to the ray is the point. A left click while holding locks on; a left click detaches. Buttons are read from `mousedown`/`mouseup`, since a second button pressed while one is held fires only a `pointermove`.
- Tracks a point on the body, not the fish (Jeremy: "focus on a specific part of the fish"). Only fish meshes are raycast, never the scene, so the rock chunks are not tested, and the hidden tap-target box is skipped; the hit is stored in the fish group's own frame and put back through its world matrix each frame, so it stays on the same part of the body through turns, pitch and bank. The swimming wave is a GPU deformation, so a point on the tail follows the body but not the wave's sway. Off the body, or on a sardine drawn by the instanced layer, the fish's centre is used. The registry entry now carries the fish's group (`object`). Measured in the Open Sea: a point locked 38 px from a fish's centre settled to the middle of the view while the fish's centre swung from +58 to -14 px as it turned.
- Marks: the aim cursor, a frame round the fish (faint and dashed once locked) and an 18 px square on the point that is or would be tracked, solid with a centre dot once locked.
- Why `dev_1`'s first cut seemed to track the centre: it picked at the middle of the view with no visible crosshair while the view lagged, it reached only 45 WU (the mako was at 64), and the nearest-fish rule handed the pick to remoras riding the mako. Measured after the fix, on the mako at 54 WU: a spot 12% in from either end, locked, stays within 6–12 px of the locked mark and about 37 px off dead centre from the lag, while the fish's origin (near one end of the body, not its middle) sits 125–200 px away.
- While locked, the look target is aimed at the tracked point every frame and goes through the same two look stages (rate 4.4) as the mouse, so the view trails the fish by about 0.9 s; the mouse look is ignored until detached, and WASD still swims (W toward the fish). Tracking drops if the fish leaves the tank or passes 110 WU. Holding right while locked shows the locked square, heavier and with a centre dot. The square is a DOM element beside the canvas, sized to the fish's projected length (34 px up to 70% of the short screen side) and written from the frame loop without React renders. Phone has no tracking yet.
- Diver camera cruise 2.2 WU/s (0.55 m/s), down from 3; the boost stays ×2.5 (1.4 m/s).
- Diver camera mouse look 0.0014 rad per pixel, down from 0.0021 (Jeremy: "reduce sensitivity of mouse in diver mode"). Touch look is unchanged.

## v0.26.0 — Diver camera

Status: accepted and promoted as clean `v0.26.0` from `v0.26.0-dev_2` on Jeremy's go-ahead (2026-10-17, branch `feat/diver-camera`, #131; `dev_1` the diver camera, `dev_2` faster swim, slower mouse, pointer lock, Esc to exit). `package.json` and `package-lock.json` move to `0.26.0`. Jeremy (2026-10-17): a free camera, WASD and mouse, from the menu like screenshot mode; movement eases in and out with a delayed drag so it stays smooth. The authored views stay slow or static; this is the way to any other angle.

### Camera

- New diver camera (`src/components/DiverCamera.jsx`), toggled from the controls menu (dive-mask key, below screenshot). Esc exits; the resting camera then eases back from wherever the diver stopped.
- Desktop: WASD/arrows swim (W follows the look direction, pitch included), Q/E (or C/Space) sink/rise, Shift for the boost, wheel to glide forward/back. The mouse looks through pointer lock (`dev_2`, Jeremy: "hide cursor and dont require a click and drag"): no cursor, no button, 0.0021 rad per pixel. The browser spends Esc on releasing the lock, so a release while the page has focus exits the diver; a release from switching windows does not, and a click re-locks. Where the lock is refused (an embedded frame), plain mouse movement still looks. Phone: one finger drags the view, two fingers drift, spreading them swims forward.
- Smoothing: every input passes two exponential stages (move rate 2.4, look rate 4.4), so a key press is an S-curve: about 1.6 s to cruise speed, a ~2 s glide to a stop after release; a mouse flick lands over ~0.9 s. Cruise 3 WU/s (0.75 m/s; 2 WU/s in `dev_1`), boost ×2.5.
- Stays in the water: under the surface (0.35 WU clearance), 1 WU over the sand (`floorHeightAt`), out of the rocks (`pushOutOfRocks`), inside x ±60, z -70 to 30. Hitting a limit stops that part of the motion rather than bouncing.
- While diving, fish use the follow cam's close-range LOD, fish picks and stage panning are off, and the dock, search and Atlas are hidden; screenshot mode still works on top of it.

## v0.25.0 — The Reefs landscape

Status: accepted and promoted as clean `v0.25.0` from `v0.25.0-dev_11` on Jeremy's go-ahead (2026-10-17, branch `feat/reef-landscape`, #130; `dev_1` the prototype, `dev_2` side and foreground rocks, `dev_3` tall edge cliffs, `dev_4` rock all round and more layers, `dev_5` outcrops instead of rings, varied heights, `dev_6` Jeremy's limestone rocks, kitbashed, `dev_7` deeper sand relief, `dev_8` zoom, sand hills, rocks through the surface, `dev_9` talus, uneven canyon, lower camera, `dev_10` stacked ledges and a massif on the right, `dev_11` fish steer around rocks). Jeremy (2026-10-16): add a landscape (rocks now, corals later) to the tank formerly called The Drift, renamed The Reefs; the landscape is fixed and does not change between loads. `dev_1` was a prototype with placeholder rocks; `dev_6` kitbashed Jeremy's limestone rocks in. `package.json` moves to `0.25.0`.

### Tanks

- The Drift is renamed The Reefs (tank id `the-drift` → `the-reefs`), with a new tagline and description. The Open Sea is unchanged.

### Landscape

- New per-tank `landscape` key (`src/data/landscapes.js`), rendered by `src/components/Landscape.jsx` inside `Environment`:
  - Sand seabed at y -22 (the ocean biome floor stays at -52 for The Open Sea), with low smooth ripples that the rocks are placed on.
  - Fixed hand-placed layout: two bommies and four wall pieces framing a canyon at the back, a far ridge in the gap, and nine low boulders, plus 240 rubble chunks from a fixed seed (one instanced draw call).
  - Placeholder rocks are seeded, displaced icosahedrons with flat facets and baked top-light vertex colour, standing in for the bommie, boulder and wall models.
- Clearance: The Reefs' swim volume is x ±56, z -40 to -15, y -14 to 2.8 (sunfish and followers, from `swimBounds`), plus the triggerfish's box reaching forward to z -8.3. Fish do not avoid rocks yet, so every piece sits in one of three free zones, checked against its rotated footprint: back (front face at z -47 or further), foreground (footprint in front of z -7.5, between the fish and the glass), or floor (top below y -20).
- More rock on the sides and in the foreground (`dev_2`, Jeremy: "add some more on the left and right side ... also some in the foreground to present depth"): four more back walls and bommies out to x ±67 for wide screens, and six foreground pieces rising to y -4 to -8 just behind the glass. The phone shows a centre crop of the 16:9 frame (about ±0.27 WU per WU of distance), so the two inner foreground bommies sit at x ±3 to reach its bottom corners; the rest show when panning and on wide screens. Rubble now 320 chunks over x ±64.
- Tall cliffs at the edges (`dev_3`, Jeremy: "some taller cliffs on the edges"): a new `cliff` placeholder shape (`column` pushes the sphere toward a cylinder, so it keeps steep sides and a broad top instead of tapering to a spike). Six cliffs 24–26.5 WU tall (6–6.6 m), tops 1–4 WU under the water surface: one pair at the back at x ±17 frames the phone's default view, one pair at the back at x ±50 frames wide screens, and the foreground pair at x about ±15 (replacing two foreground walls) frames a wide screen's left and right edges.
- Rings of rock all round, more layers (`dev_4`, Jeremy: "only two layers ... when i click on a fish and look around, its clearly staged"):
  - Three generated rings of rock (fixed seeds, so still identical on every load) walk a rectangle around the swim volume at 3–9, 16–26 and 34–46 WU out: along the sides and behind the camera (z 12 and beyond, so the default view is never blocked), and across the back for the two outer rings (the middle one keeps open water at |x| < 12). A follow cam looking any way now sees reef at the edge of the water.
  - Default view layers, front to back: foreground pieces, five new low mounds at z -34 to -44, the hand-placed back canyon, then the two outer rings fading into the fog.
  - 60 low boulders and 800 rubble chunks over the whole seabed (x ±110, z -110 to 60), so the sand under a followed fish is never bare.
  - A new `side` free zone (inner face at |x| 63 or more). `landscapePieces` places every piece (base on the sand, top capped 1.1 WU under the surface, or under y -20 where only the floor zone fits) and drops any generated piece that would reach the swim volume; a node check of all 168 pieces found none in it.
- Draw cost: all pieces are welded (`mergeVertices`, so flat shading now comes from the material) and baked into one mesh: 129k triangles in one draw call, plus 16k for the instanced rubble, about 17% of The Reefs' 867k scene triangles. Placeholder detail is lower to match (boulder 4, bommie/wall/cliff 6, rubble 0).
- Outcrops instead of rings, varied heights (`dev_5`, Jeremy: "all the rocks are too flat in height ... and the ring is too obvious"):
  - The three rings are replaced by 40 outcrops from a fixed seed: clusters of one main rock and 1–3 smaller ones leaning on it, scattered over the area around the swim volume out to x ±125, z -125 to 75, at uneven spacing. Open water stays behind the canyon's centre (|x| < 12, z -47 to -72). Generated pieces may not stand in front of the camera; only the hand-placed foreground does.
  - Main rock heights come from three bands: low mound 6–12 WU (35%), mid 12–20 (40%), tall 20–30 (25%); the smaller rocks are 25–75% of their main rock.
  - Each piece's top limit is now its own, between 3.5 and 7 WU under the old shared cap of y 3.5 (`topJitter`), so tall pieces no longer line up just under the surface. Rock tops (pieces over 3 WU) now spread from y -19 to 2.8, median -12.7; in `dev_4` many sat exactly at 3.5.
  - 210 pieces, none in the swim volume (node check); 158k rock triangles in one draw call (was 129k).
- Jeremy's limestone rocks, kitbashed (`dev_6`, Jeremy: "replace with the rocks in this ... principle of kitbashing ... reproject uvs"):
  - The placeholder rocks are gone. Every piece and rubble chunk is now one of the nine rocks in Jeremy's `limestone boulders.glb`, spun, tilted (cliffs up to 0.12 rad, boulders 0.45; walls and boulders may also lie on a side or upside down; rubble tumbles freely) and stretched non-uniformly into its box, all from the piece's seed, so the layout stays fixed.
  - Best fit: each piece tries eight rock-and-orientation candidates and keeps the one needing the least uneven stretch, so tall slots get tall rocks. No axis stretches more than 2× another (2.3× bommies, 2.6× cliffs); beyond that the longer axes shrink instead, so a piece only ever gets smaller than its box and keeps its clearance.
  - UVs are re-projected per piece after the stretch, cube-style in world space (Blender's Cube Projection): one tile of the GWC Rock 008 texture set (colour, normal, roughness) every 6 WU (1.5 m) on every rock, with a random texture offset per piece. Measured over every triangle: linear texture density 0.79–1.0 of the target (1st–99th percentile, median 0.93), the low end being cube projection's slant on faces between two axes (floor 0.76).
  - `scripts/build-landscape-kit.py` (headless Blender, Jeremy's open scene untouched) welds each rock, decimates it to three detail levels, and resizes the textures: rockN_hi (at most 3,000 triangles) for pieces within 30 WU of the camera, rockN_lo (600, or 120 for the small rocks) further out, and a 40-triangle rubble chunk. Kit 1.0 MB plus 0.96 MB of 1024 px textures, down from 9.8 MB. A first build decimated the rocks without welding them and tore the distant ones into floating shards (Jeremy: "rocks are broken"); welding fixed it.
  - Rendering: the pieces bake into 18 chunk meshes 60 WU square, one draw call each, so the frustum culls whatever is off screen. 139k triangles and 338k vertices in all; the default view draws 114k and 280k. Rubble is 600 chunks (was 800).
- Deeper sand relief (`dev_7`, Jeremy: "the sand layer can have greater displacement. now its too flat"):
  - The sand now has dunes (40–60 WU wavelength), a broad swell, hummocks (about 18 WU) and fine ripples (6 WU), spanning y -27.2 to -20.6: 1.7 m from trough to crest, up from about 0.4 m. Its mean level drops from y -22 to -24 so the highest crest under the swim volume (measured -20.56) stays below the Mola's lowest fin at y -20. The seabed mesh is finer for it (192 segments, 1.9 WU, was 96).
  - The sand shades by height before fog: troughs at 55%, crests at 120%. The soft underwater light barely shades dunes on its own, and the default view sees the sand 40 WU or more away at a grazing angle, so without it the relief still read flat.
  - The follow camera's floor guard now keeps 1.6 WU above the highest crest (y -20.4) rather than the mean level, so it never dips under a dune.
  - Floor-zone boulders sitting on a crest are capped lower to stay under y -20; any capped below 0.4 WU are dropped. All 210 pieces still clear the swim volume.
- Zoom, sand hills, taller rocks (`dev_8`, Jeremy: "some can go higher ... should we consider zooming in a bit? ... add another layer of displacement with large texture scale"):
  - The Reefs zooms in about 1.35×: its resting camera's FOV is 47° (was 61°), from a new per-tank `camera` override (any of Camera.jsx's fov, y, z, lookY). Fish and rocks read larger, ahead of corals. The Open Sea keeps 61°, and follow mode keeps its own framing. Fish swim bounds still come from the 60° projection, so at the sides fish leave the zoomed frame more often.
  - Large sand hills on top of the kept grain: up to 10 WU (2.5 m), rising only outside the swim clearance over a 32 WU ramp, so the basin under the fish is unchanged (crest -20.56) while dunes climb toward the reef walls and in front of the glass (sand from y -27 to -11.7). The grain shading now comes from a per-vertex `sandGrain` attribute, so the hills do not darken the basin.
  - The follow camera's floor guard samples the sand under the camera instead of one global height, so it clears the hills without stopping it from following fish low over the basin.
  - Rocks through the surface: the camera sits only 2 m under the water, so a rock capped below the surface never climbs past the middle of the screen. A quarter of the tall back and side pieces, and the four canyon cliffs, now break the surface, raised to a top between y 9 and 14; rocks in front of the glass never do. The tall outcrop band is 22–36 WU (was 20–30). 13 pieces break the surface; tops reach 13.7.
  - The phone-framing cliffs move in to x ±12.5 so the zoomed phone view keeps them at its edges, and every rock sinks 15% of its height into the sand (was 8%): the kit rocks' uneven undersides showed gaps under low, wide pieces such as the far ridge.
- Talus, an uneven canyon, a lower camera (`dev_9`, Jeremy: "more transition from the seabed to the cliffs ... maintain the composition with the cliffs on the two sides ... a bit of rocks in the center, but not necessarily in symmetry"; then "move the camera a bit back and down, point slightly up"):
  - Talus aprons: around every piece at least 14 WU tall, up to one buttress rock (30–60% of its height) leaning on it and one to three boulders (8–25%) around that, all kitbashed from the small kit rocks and through the same zone checks (capped to the floor zone, or dropped, where they would reach the swim volume). 137 talus rocks; 352 pieces in all.
  - The back canyon is laid out again unevenly: the left framing cliff stands nearer and taller (x -10.5, z -53.5, top y 14), the right one further back and lower (x 15, z -63, top 8) with a smaller spire beside it (top -1), and the wide-screen pair likewise (x -36 top 13; x 41 top 10). Hand-placed rocks can fix their top (`options.top`, the tuple's ninth entry), growing or capping the piece, to hold the composition.
  - Off-centre rocks in the gap: a mid bommie left of centre (top -7), a low wide rock right of it, a faint spire far back (top 2), and the far ridge moved right.
  - The Reefs' camera moves back and down, pitched up: z 14 (was 10), y -6 (was -3.35), about 7° up (was 3.4°), still 47°. It lives in `REEFS_VIEW` in landscapes.js, which the tank's `camera` and the rock detail levels share. Generated rocks in front of the swim volume now stand at z 16 or beyond, behind the moved camera.
  - Cost: 159k rock triangles; the default view draws 102k (244k vertices).
- Stacked ledges and a massif on the right (`dev_10`, Jeremy: "too many columns ... go more horizontal stacking ... looks too much like zhangjiajie", "stack up like a mini mountain behind ... enough layers to see it", then "some floating rocks ... make the hill more pronounced ... on the right side, slope towards the left so it gives a triangle composition"):
  - New `stack` pieces: 2–3 wide, low ledge tiers (from the wide kit rocks), each smaller one set off-centre and resting on the one below, sunk a third of its height into it. Landscape.jsx measures each placed rock's real top and drops the next tier onto it, so tiers no longer float where a rock was shrunk to fit its box.
  - Only the central valley stands in columns (the two framing cliffs, the spire beside the right one, the far spire, the mid bommie). The outer canyon walls, the wide-screen edge pieces and the generated outcrops are now stacks; outcrop width follows height, and leaning and talus rocks are never much taller than wide. Random surface-breakers are off (`pierce.share` 0).
  - A massif behind the swim clearance: the sand climbs over 36 WU from the back line to 26 WU at the right, 20% of that at the left, capped at y 0. Four terrace rows of stacks (z -55 to -83, 38 stacks) step up it, taller and wider toward the right, fading into the fog. Outcrops leave the slope to the terraces.
  - Triangle composition: the left valley cliff drops to top y 7 and the right one rises to 13, with its spire at 3; the left foreground is lower (tops about -12) and the right foreground steps up toward the right edge (tops -13.8, -8.6, -3.3, -0.8). On a phone the right cliff now stands above the left with the massif behind it. On a 16:9 screen the right foreground run is mostly outside the frame: near the glass the frame is only about ±11 WU wide.
  - 333 pieces, none in the swim volume; 207k rock triangles, 146k in the default view.
- Fish steer around rocks (`dev_11`, Jeremy chose this over shrinking the swim volume, "so rocks can stand anywhere"):
  - `src/components/rockObstacles.js`: every placed rock near the swim volume (158 in The Reefs) becomes an ellipsoid inscribed in its box, in a 12 WU grid. Environment publishes them from the same seeded layout before the fish's first frame and clears them on unmount; The Open Sea has none, so every query returns at once.
  - It joins the unified pipeline at three points (Fish.jsx): steer — a probe ahead along the heading (3 body lengths or 1.5 s of travel) bends the desired heading along the rock's surface and away from it, and the urgency raises the turn rate up to 3×; clamp — after the swim-bound clamps, a fish still inside a rock padded by 0.35 body lengths + 0.3 WU is moved to its surface and its heading loses the into-rock part, so it slides along the face; target — solo, school, continuation and sun-bask targets inside a rock are rejected, and fallbacks are nudged out. Riding remoras and the sun-bask hold keep their authored poses.
  - The follow camera is held on a rock's surface (about 1 WU off) instead of orbiting into it.
  - The right massif moves into the swim volume: nine `inSwim` stacks from x 14 to 55, z -22 to -43, stepping up toward the right and back (tops about -16 to -2). Hand-placed pieces flagged `inSwim` skip the clearance rule (their tiers and talus inherit it); generated pieces still never enter the swim volume, so the centre stays open.
  - Measured live, 90 s, 44,602 fish samples against 161 rocks, 1,558 of them within 6 WU of the massif: no fish centre inside a rock, and none within 0.2 body lengths of one. A second 38 s run after the layout changes below: 18,966 samples, none inside.
  - Floating ledges: upper tiers now sink half their height into the tier below, sit well inside it (62% and 40% of the bottom tier's size, offset 4–12% of its width), and low, wide kinds bury more of their height in the sand (ledge 35%, talus 30%, boulder 25%; tall kinds 15%): a wide rock laid flat touches the sand at one point and its curved underside lifted its edges.
- The follow camera's floor guard uses the tank's seabed (y -22 + 1.6) instead of the biome's.
- The Reefs' fog is thinner (`density` 0.016, was the ocean's 0.032) so the rocks read about 60 WU from the camera.

## v0.24.0 — Situational fish lighting

Status: accepted and promoted as clean `v0.24.0` from `v0.24.0-dev_4` on Jeremy's go-ahead (2026-10-16; `dev_1` the light terms, first written as `v0.18.0-dev_1` on 2026-10-09; `dev_2` more contrast after Jeremy's desktop look on 2026-10-15; `dev_3` large fish shade the fish under them; `dev_4` renumbered from `v0.23.0` when the Whale Shark shipped as clean `v0.23.0`, no other change). `package.json` moves to `0.24.0`. Prompted by an aquarium reference photo: fish were lit the same way wherever they swam.

### Fish lighting

- New shared shader term (`src/utils/fishSituationalLight.js`) on every GLB fish material and the instanced sardine LODs, applied before tone mapping and fog:
  - Top light: backs brighten and bellies shade, strongest high in the column and inside slowly drifting light pools.
  - Back light: a fish seen from below goes toward silhouette on its camera-facing side, with a cyan edge glow.
  - Front light: fish in the front of the swim volume pick up light from the viewing side. It is tied to the tank, not the camera, so follow-cam close-ups keep their shading.
- The scene lights, background, and fog are unchanged.
- More contrast (`dev_2`, Jeremy: "a little bit more contrast"): backs brighten up to 2.15× in full sun (was 1.95×), bellies shade by up to 70% (was 50%), the from-below silhouette darkens by up to 70% (was 60%), and bellies take 60% less of the front light. In `dev_1` the front light filled bellies in, so in a level view they ended slightly brighter than with no situational light at all (+4% measured on the sunfish).

### Fish shadows

- Large fish shade the fish under them (`dev_3`, after Jeremy asked whether fish shadow each other; they did not: every fish mesh has `castShadow`/`receiveShadow` off and the tank has no shadow map). Shadow maps would be too costly for a full tank on a phone, so it is shader-only: any fish with a body length of 10 WU or more (the sunfish at 12.8, the mako at 16.7; not the mahi) publishes its centre, heading and length into one of four shared uniform slots each frame, and every fish and sardine fragment under its top-down footprint darkens by up to 70%. The footprint is an ellipse 1 × 0.6 body lengths, and it widens and thins with depth until it is gone about 12 WU down. Fades with the caster's opacity; the caster leaves out its own body. Atlas fish take no caster shadows.
- `dev_4`: the juvenile Whale Shark from `v0.23.0` (22–26 WU) is over the threshold, so it casts too, with no change for it; its footprint is about 24 × 14 WU. Not yet seen live.
- Measured on frozen frames (same frame, shadows on vs off): six fish under the sunfish, 1,977 pixels darker, the most shaded pilot fish about 48% darker; two fish under the mako, 983 pixels darker. Sardines take the shadow too (same shader), but no school passed under the mako during the check, so that is not yet seen.

## v0.23.0 — Whale Shark

Status: accepted and promoted as clean `v0.23.0` from `v0.24.0-dev_5` on Jeremy's go-ahead (2026-10-16; `dev_1` the species, `dev_2` its Atlas tile and the Atlas sorted by scientific name, `dev_3` a new tile, `dev_4` remoras ride it, `dev_5` big bodies keep clear of each other). Built as `v0.24.0-dev_*` while the situational fish lighting (#128) held `v0.23.0`; this shipped first, so it takes `v0.23.0` and the lighting moves to the next number. `package.json` moves to `0.23.0`. 1 juvenile in `creatures_dev` (id 410) and 1 in production `creatures` (id 411, juvenile male, size parameter 0.5 = 6 m, on Jeremy's go-ahead; insert only, checked against a snapshot: 257 → 258 rows, the existing rows unchanged). Both carry the individual description "The biggest fish in the Open Sea, 6 m and still growing, with a spot pattern no other whale shark shares."

### Species

- Whale Shark (`Rhincodon typus`, Rhincodontidae) on Jeremy's model, in the Open Sea and the Atlas. FishBase facts: up to 20 m (female), common to 10 m, from the surface to almost 2,000 m in all tropical and warm temperate seas except the Mediterranean, alone or in feeding aggregations of more than 100, live-bearing (about 300 embryos in one female), up to 80 years. IUCN Endangered. Males mature at about 8 m (Norman & Stevens 2007) and level off at 8–9 m, females near 14.5 m (Meekan et al. 2020).
- Juveniles only. The species is described at its true scale (20 m = 80 WU), longer than the tank is deep, so the tank keeps young sharks: `lifeStages.juvenile` sets the body length to 24 WU (6 m) with its own model scale, `sizeRange [0.92, 1.08]` (5.5–6.5 m), the size most often seen at feeding sites and larger than the 17.8 WU mako. Rows carry `life_stage = 'juvenile'`; the card shows the Juvenile chip.
- Slow cruiser: 0.08–0.13 BL/s (about 0.5–0.8 m/s at 6 m), no real burst, turns of one body length. Held further back than the mako (`boundsZMax -2`) so a 24 WU body does not fill the camera. Others give it room (`repulser`, menace `0.3`) without fleeing it as they do the mako.
- Motion: rig-free `caudal-vertex`, a broad, slow sweep of the tall tail (0.035 body lengths, `waveSpeed 1.4`, wave from 0.22 of the length) with stiff pectorals (`pectoralFinFlutter 0.04`).
- Model intake: 2.2 MB as supplied, about 2,300 triangles; head at -Z, root mid-length, separate pectorals. The texture is a generated three-view sheet with no alpha channel, so the material was made opaque (it said BLEND) and the 1536 × 1024 PNG (2.07 MB) re-encoded as a JPEG (184 KB, mean colour within 0.4 of the original): 0.33 MB shipped. Verifier target added.
- Atlas framing: 3.9 display units (the diagonal pose brings the head toward the camera), shifted right; about 80% of a 375 px phone's stage.

### Atlas

- Whale Shark tile: a close-up of fish 410's head in three-quarter view, mouth, eye, and spots, rendered in the tank with the other fish and particles hidden for that frame; 470 × 470 like the mako's. (`dev_2`'s side-on capture had the mako in it and read small; Jeremy asked for a closer, cleaner head shot in `dev_3`.)
- The Atlas lists species alphabetically by scientific name (`dev_2`, Jeremy's request), so a new species slots in by name instead of at the end. The Nº shown is the place in that list, so most species renumber: the triggerfish is now Nº 002, the mahi-mahi Nº 003, and so on; the sardinella stays Nº 001 and the whale shark is Nº 011.

### Behavior

- Remoras ride the whale shark (`dev_4`), as sharksuckers and the common remora do in the wild. It joins the mako in the `shark` host group, so the riders that rate sharks highest split between the two. 18 ride anchors fitted from its mesh (`scripts/fit-ride-anchors.mjs`, 10–55% of the length): all on the belly between the gills and mid-body, since its big pectorals rule out the flanks. Clearance ellipsoid: snout to caudal peduncle, the pectoral span across. Measured in the dev tank: within seconds two live sharksuckers were attached to the whale shark and four other riders to the mako, unchanged over 30 s.

### Big bodies keep clear

- Long fish (6 WU and up: the whale shark, the mako, the larger mahi) no longer pass through each other (`dev_5`, Jeremy's screenshot of the mako going through the whale shark). Boid separation treats every fish as a sphere among its nearest few neighbours, with the big swimmers' boid forces capped near zero (the mako's 0.06), so near a sardine school the other shark was not even among the neighbours. Now each reads the others as capsules along their length, checks where both will be over the next 8 s, and steers off sideways or over/under, applied after that cap; the shorter body gives way more. Fish this long also re-decide their boid steering every 0.5 s instead of every 1–3.4 s, which had let a bursting mako close ~40 WU between two looks.
- Measured in the dev tank as the gap between the two sharks' body axes: before, the mako passed straight through at 1.5 WU; after, over 3 minutes and 4 approaches, three kept 5.3–7.5 WU apart and one fast pass came to 2.7 WU for half a second (the skins meet at about 2.6–3 WU). Covered by a new test in `tests/fishSwim.test.mjs`.

### Fixes

- The creature card took length and mass from the base species, ignoring the life stage. It now resolves the stage first, so the whale shark reads 6.0 m and 1,810 kg (it read 20 m and 77 t). Juvenile angelfish share the adult's body length, so their cards are unchanged.

## v0.22.1 — Clown Triggerfish Atlas tile

Status: clean `v0.22.1` (2026-10-15), on Jeremy's request. `package.json` moves to `0.22.1`.

### Atlas

- The Clown Triggerfish's Atlas tile: a tank capture of fish 406 side-on in The Drift, a pilot fish below it for scale, 420 × 420 like the emperor angelfish's. Captured from the WebGL canvas inside the render frame at 2264 × 1273, cropped 660 px square around the fish.

### Data

- 3 Clown Triggerfish in production `creatures` (2026-10-15, on Jeremy's go-ahead): ids 407–409, sizes 0.66 / 0.82 / 0.97, 1 female and 2 male, adult, matching `creatures_dev` 404–406. Insert only, checked against a snapshot: 254 → 257 rows, the existing rows unchanged.

## v0.22.0 — Clown Triggerfish

Status: accepted and promoted as clean `v0.22.0` from `v0.22.0-dev_4` on Jeremy's go-ahead (2026-10-15; `dev_1` the species, model, and balistiform shader, `dev_2` lights turned fins as turned, `dev_3` stops the soft dorsal folding over, `dev_4` draws it opaque). `package.json` moves to `0.22.0`. 3 triggerfish in `creatures_dev` (ids 404–406); none in production `creatures` yet.

### Species

- Clown Triggerfish (`Balistoides conspicillum`) on Jeremy's model, in The Drift and the Atlas. Facts from FishBase: 50 cm maximum (2.0 WU), solitary along deep reef drop-offs, retreating to caves when approached; pairs only to spawn. Length–weight from FishBase's Bayesian estimate (a 0.02692, b 2.91: about 2.4 kg at 50 cm). Least Concern.
- Swims balistiform: dorsal and anal fins alone at cruise, tail beats only in bursts (Korsmeyer et al. 2002 on the Picasso triggerfish). Cruise 0.4–0.8 BL/s, bursts 2.4–3.4 BL/s, turns in 0.6 body lengths.
- Model intake: 0.94 MB as supplied (one 1000 × 588 PNG). Opaque (`dev_4`): the texture's alpha is solid and the fins are cut in the mesh, but the GLB material is BLEND; with `alphaBlend` the single material for the whole fish lost its depth writes and the fins and tail drew through the body. Source length 4.589 → `scale 0.4358`, recentred mid-length. Jeremy remodelled the soft dorsal and anal fins as thin blades and painted `COLOR_1` (R soft dorsal, G anal, B caudal); separate `pectoral.l` / `pectoral.r`. Verifier target added.

### Procedural animation

- `mola-mask-vertex` gains a balistiform variant (docs/procedural/mask-fin-row.md): `finWaveTravel` sends a ripple front to back along each painted fin, with each fin's span and sloping base line read from its paint (`molaFinBases()`, once per model); `caudalBurstAmplitude` / `caudalBeatRate` make the blue channel a tail that beats only in bursts and leans into turns; `analAmplitudeScale`; `forwardAxis` / `upAxis` rotate an asset into the Mola's raw frame. Separate pectoral objects flutter on this type as on `caudal-vertex`. The Mola's defaults are the identity and leave it unchanged.
- `dev_2`: the normal turns with its fin (`proceduralMolaNormal`, sharing `molaFinAngles` with the position), so a swung fin is lit as swung instead of in its rest pose. This applies to the Mola's fins too, a small shading change.
- `dev_3`: each rippling-fin vertex turns about the body surface directly under it (a `molaFinRoot` attribute built once per model from the unpainted body's top and bottom in 40 bins along the length), not one straight base line per fin. The triggerfish's soft dorsal base drops from 0.36 to 0.18 raw along a curve, so the straight line sat up to 0.06 above the lower rows of a 0.07–0.15 fin, and they swung the wrong way, folding the fin over. A root is never placed above its own vertex.

## v0.21.0 — Juvenile emperor angelfish

Status: accepted and promoted as clean `v0.21.0` from `v0.21.0-dev_2` on Jeremy's go-ahead (2026-10-13; `dev_1` was the life stages and the juvenile, `dev_2` the adult model's shading). `package.json` moves to `0.21.0`. Sixteen juvenile emperor angelfish were written to production `creatures` (ids 382–397, 8 female and 8 male) on the same go-ahead.

### Data

- New `life_stage` column on `creatures` and `creatures_dev` (`supabase/migrations/202610131545_add_creature_life_stage.sql`): text, required, defaults to `adult`, checked to `juvenile` or `adult`. Every existing row is `adult`. Entered by hand for now; deriving it from `born_at` is planned.
- `useCreatures` reads it as `creature.lifeStage` (`adult` when absent, as in the bundled fixtures).

### Species

- A species can describe a life stage in `lifeStages.<stage>`: its own model, size range, and manner. `speciesForLifeStage` merges the stage over the species (`swim` merges, everything else replaces) and `resolveSpecies` applies it, so a juvenile's model, motion, size and pairing all follow from its row. Cached per stage.
- Juvenile Emperor Angelfish on Jeremy's model: dark blue ringed in white, the pattern young fish wear until about 12–14 cm (Seatizens puts it under ~14 cm). `sizeRange [0.2, 0.35]` of the species' 40 cm, so 8–14 cm (0.32–0.56 WU), below the 27 cm sardinella floor as a real juvenile is. Juveniles do not pair (they keep to themselves under ledges) but still clean the sunfish, as FishBase records for young and adults. `speedMultiplier 0.6`, since speeds are in species (40 cm) body lengths.
- Model intake: supplied at 0.1995 nose to tail tip, so `scale 8.02` maps it to the species' 1.6 WU at size 1. The file was 15.4 MB, almost all one 3834 × 2556 PNG whose alpha is fully opaque; it ships as a 2048-wide JPEG with the material set opaque, 0.41 MB. Motion is the adult's labriform `caudal-vertex` stroke at its length (`amplitude 0.006`, `waveSpeed 4.0`), and unlike the adult model it has separate pectorals (`pectoralFinFlutter 0.12`).
- The texture is Diego Delso's photograph on Wikimedia Commons (CC BY-SA 4.0); credited in the Sources list with the licence, the changes, and the share-alike terms.
- No separate Atlas entry: the angelfish's Atlas stage adds two juveniles at true size beside the pair (Atlas companions take an optional `lifeStage`).
- The info card shows a Juvenile chip.
- Adult model updated (`dev_2`): Jeremy's revised shading, metalness `0` → `0.04` and roughness `0.5` → `1.0` (the glTF default, now unset), geometry and textures unchanged. Shipped through the same resize (29.5 → 2.02 MB: fins 1024-wide PNG, body 2048-wide JPEG).
- 16 juveniles in `creatures_dev` (ids 366–381, 8 female and 8 male, size parameters 0–1), twice the 8 adults, and 16 in production `creatures` (ids 382–397).

## v0.20.1 — See-through angelfish fins

Status: accepted and promoted as clean `v0.20.1` from `v0.20.1-dev_1` on Jeremy's go-ahead (2026-10-13). `package.json` moves to `0.20.1`.

### Rendering

- The emperor angelfish's fins now blend their texture's alpha (Jeremy's `-alpha` PNG), so the webbing is see-through instead of cut hard at 50%. New opt-in `model.alphaBlend`: a model's alpha-blended materials stay transparent with depth writes off, and the per-frame material pass (which made every material opaque unless the fish was fading) leaves them blending. `alphaTest` drops to `0.02`, cutting only the fully clear texels. Measured live: the angelfish's `fin` material reads `transparent: true`, `depthWrite: false`, `alphaTest: 0.02` in both the tank and the Atlas; the pilot fish, bannerfish, sharksuckers, and mahi fins are unchanged and opaque.

## v0.20.0 — Emperor Angelfish

Status: accepted and promoted as clean `v0.20.0` from `v0.20.0-dev_4` on Jeremy's go-ahead (2026-10-13; `dev_1` was the species data alone, `dev_2` added Jeremy's model, `dev_3` the Atlas tile, `dev_4` the Atlas pairs). `package.json` moves to `0.20.0`. Eight emperor angelfish were written to production `creatures` (ids 358–365, 4 female and 4 male) on the same go-ahead.

### Species

- Emperor Angelfish (`Pomacanthus imperator`, Pomacanthidae) on Jeremy's adult model, in The Drift: the first fish chosen for a future reef conversion. FishBase facts: up to 40 cm (maturing at 25 cm), 1–100 m on Indo-Pacific reefs, sponges and tunicates, pairs, up to 14 years, IUCN Least Concern. FishBase also records that young and adults clean much larger fishes such as sunfish.
- Behaviour: loose male–female pairs (`pairBonded`) and an occasional cleaner visit to the sunfish (`hosts { sunfish: 0.3 }`, the bannerfish's escort stations). 1.6 WU at full size, `sizeRange [0.62, 1.0]`.
- Model intake: supplied at true size (0.4002 nose to tail tip), so `scale 3.998` and `position [0, -0.04, 0.0126]` recentre it on the body axis. The supplied file was 29.5 MB, almost all two 4227 × 3170 photo textures; they ship resized (body 2048-wide JPEG, fins 1024-wide PNG), 1.96 MB in all, about the bannerfish's size.
- Motion: the bannerfish's labriform `caudal-vertex` stroke at its own length (0.03 body lengths, `flexStart 0.55`, `waveSpeed 3.3`). The model's only separate fins are the pelvics (`pelvicFinFlutter 0.12`); it has no pectoral objects.
- New opt-in `model.alphaTest`: every fish renders opaque, which drew the fins' alpha-cut photo as solid cards. A model with `alphaTest` cuts its alpha-blended materials at that value instead, in the tank and the Atlas. Only the angelfish sets it (`0.5`).
- Atlas framing: `maxLengthDisplayUnits 1.7` (about 28% of a desktop stage's width, beside the bannerfish's ~30%) and `portraitPhoneDistanceScale 0.43` (about 80% of a 375 px phone's stage). Tile (`dev_3`): a tank capture of fish 353 side-on, mask and yellow tail in frame, 420 × 420.
- The Atlas shows both pair-bonded species as pairs (`dev_4`): the main fish with its mate a little behind, beside, and above it, 0.9× its size and out of step, as they swim in the tank. The angelfish and the bannerfish each sit left of centre with the camera between the two, and stand further back on a phone so both fit (angelfish `portraitPhoneDistanceScale 0.43 → 0.66`; bannerfish camera `4.85 → 5.6`, phone `0.8 → 0.98`).
- The texture is Rickard Zerpe's photograph on Wikimedia Commons (CC BY 2.0); it is credited in the Sources list with the licence and the changes made.
- 8 rows in `creatures_dev` (ids 350–357, 4 female and 4 male, sizes 0.62–1.00), and the same 8 in production `creatures` (ids 358–365).

## v0.19.1 — Loose pairs

Status: accepted and promoted as clean `v0.19.1` from `v0.19.1-dev_2` on Jeremy's go-ahead (2026-10-12; `dev_1` paired the bannerfish tightly, `dev_2` loosened the pairs and moved the mahi-mahi onto them). `package.json` moves to `0.19.1`.

### Behavior

- Longfin bannerfish and adult mahi-mahi now swim as loose male–female pairs (`pairBonded`), as adults of both do. Biome matches each female with a male of the same tank (fish with no sex recorded fill in for the short side; a fish left over roams alone). She leads, sunfish visits included; he keeps company (`advancePairFollow`, ride stage `pair`).
- Loose, not lockstep: his station wanders round her on slow out-of-step cycles, 0.7–1.8 of his body lengths away (mahi `0.5–1.2`), from 30° ahead of level to 65° behind, and up to 0.35 body lengths above or below. He matches her velocity plus a gentle closing velocity (gain `0.35`, capped at 0.8× his burst), so he lags her turns. Measured on mahi: 1–5 WU apart, headings mostly 3–25° apart.
- Spells together last 40–90 s; at the end of each, 40% of the time he breaks off for 15–35 s and roams on his own (a bannerfish may visit the sunfish alone), then swims back. Measured: a split mahi reached 33 WU away and closed back to 3 WU about 10 s after the spell ended.
- While she escorts the sunfish he takes her outer flank and inherits the sunfish's clearance, so he never wedges against its body. If she leaves the tank he is free again.
- Mahi-mahi no longer school (`schooling: false`): their capped two-fish school is replaced by the pair. The live 2 F + 3 M make two pairs and one lone male.

## v0.19.0 — Longfin Bannerfish

Status: accepted and promoted as clean `v0.19.0` from `v0.19.0-dev_3` on Jeremy's go-ahead (2026-10-11; `dev_2` fixed the pectoral pivot, `dev_3` added the pilot fish tile). `package.json` moves to `0.19.0` with it (it had stayed at `0.15.3`). Twelve bannerfish were then written to production `creatures` (ids 338–349) on Jeremy's go-ahead.

### Species

- Longfin Bannerfish (`Heniochus acuminatus`, Chaetodontidae) on Jeremy's supplied model, in The Drift. FishBase facts: up to 25 cm (15 cm common), 2–178 m on Indo-Pacific reefs, adults in pairs, planktivorous, IUCN Least Concern. Rendered at 0.6–1.0 WU (`sizeRange [0.6, 1.0]` of 1.0 WU), just under the sardinella. The Atlas names its home as Coral Reef (`atlasDetails.biome`), not the tank's Pelagic Ocean.
- Rig-free `caudal-vertex` body tuned for a labriform swimmer: stiff front (`flexStart 0.5`), one short flick (`waveTravel 2.5`), a small cruise stroke (0.03 body lengths) that grows under burst (`burstAmplitude 1.2`), and pectorals rowing at `0.45`, nearly four times a caudal swimmer's. Source length 0.3199 (banner excluded): `scale 3.1262`, `position [0, -0.0216, -0.044]`.
- The banner (the drawn-out 4th dorsal spine) is a separate object deforming over the body's bounds (`followBodyMeshNames`), so behind the tail tip it moves with the tail. Each fish's banner is its own length: `meshLengthVariation` stretches a per-fish copy of the geometry back from its root by 0.8–1.2, once at mount.
- Pectorals turn about their base (`dev_2`). The renderer takes a fin's root as the vertices nearest the body's long axis, but these pectorals lie close along the deep flank and run up and back from a low base, so the nearest were near the tip and the fins turned about it. New `finRootFrom: 'body-surface'` takes the vertices nearest the body's surface instead (computed once per model). Measured live: the base now moves under 1 mm while the tip swings 19 mm. Other species keep the axis rule.
- Atlas entry and framing (`maxLengthDisplayUnits 1.1`, phone `0.8`), and a tank-capture tile.
- Two local fixture fish (ids 108–109), and 12 rows in `creatures_dev` (ids 326–337, sizes 0.60–1.00).

### Behavior

- A follower like the pilot fish, but less keen: sunfish only (`hosts { sunfish: 0.4 }`), close stations along the flanks and belly as a cleaner would (`along [-0.5, 0.1]`, `radius [1.05, 1.3]`, 15–35 s), then usually (`leaveChance 0.85`) off for 60–120 s. About a fifth of its time following, against the pilot fish's three fifths; measured 2–5 of 12 escorting at once while 11–15 of 18 pilot fish were. Its relative the schooling bannerfish cleans bump-head sunfish at Bali's cleaning stations.

### Atlas

- Pilot Fish tile (`dev_3`): a tank capture of fish 306, full side-on body, 600 × 485.

### Tooling

- `inspect-procedural-targets.mjs` fails a follow mesh whose frame differs from the body's (`followFrameMismatches`); a follow part with its own origin would wave as if shifted along the body.
- Docs: the caudal-wave and procedural README orientation notes now say what the renderer does (caudal fish face `-Z`), not `+Z` forward.

## v0.18.0 — Pilot Fish

Status: accepted and promoted as clean `v0.18.0` from `v0.18.0-dev_2` after Jeremy's review (2026-10-10). Eighteen pilot fish were written to production `creatures` (ids 308–325) on Jeremy's go-ahead; on 2026-10-12 he had five retired (`alive = false`), leaving 13.

### Species

- Pilot Fish (`Naucrates ductor`, Carangidae) on Jeremy's supplied model, in The Drift. FishBase facts: up to 70 cm (35 cm common), 0–300 m in warm open ocean, IUCN Least Concern. Rendered at 1.4–2.8 WU (`sizeRange [0.5, 1.0]` of 2.8 WU).
- Rig-free `caudal-vertex` body with the mahi's carangiform stroke scaled to this model (amplitude 0.32 and turn 0.24 source units, `flexStart 0.26`), plus pectoral and pelvic flutter. Source length 7.3672, root recentred mid-length on the body axis (`scale 0.3801`, `position [0, -0.0567, -0.192]`).
- Atlas entry with framing (`maxLengthDisplayUnits 1.75`); no photo tile yet.
- Three local fixture fish (ids 105–107), and 18 rows in `creatures_dev` (ids 290–307, sizes 0.45–1.0). Production `creatures` untouched.

### Behavior

- Followers: a `hitchhiker` with `attaches: false` runs the escort stage only. It never claims a spot or latches, finds its host from anywhere in the tank (`rangeBodyLengths 10`), and when a spell ends it either moves to a new station on the same host or (`escort.leaveChance`) swims off on its own for `freeSeconds`, then rejoins. It also lets go while the host fades, and rejoins after. `escort.minSpeedBLPerSec` sets its slowest escort pace apart from its free cruise.
- The pilot fish holds loose stations round the Mola's front half: ahead of the snout and beside the head and flanks (`along [-0.9, 0.05]`, `angleDegrees [-215, 35]`, `radius [1.2, 1.6]`, 25–60 s each). After each one it breaks off 60% of the time to roam for 25–55 s at a quicker cruise (`idleBLPerSec [0.9, 1.3]`, burst 2.2–3.0), then slows back to the Mola's pace (escort floor 0.3 BL/s). With 18 in the tank, about a fifth to a third roam at once. See `docs/ride-hosts.md`.

## v0.17.3 — Whitefin Sharksucker tile

Status: accepted and promoted as clean `v0.17.3` from `v0.17.3-dev_1` after Jeremy's review (2026-10-10, #116).

### Atlas

- The Whitefin Sharksucker's Atlas tile is Jeremy's tank capture: a full side-on body swimming under the host's fins. Downscaled to 600 px wide (197 KB), in line with the other tiles. The photo's aspect nearly matches the tile on phones and desktop, so it needs no `atlasThumbnailPosition`.

## v0.17.2 — Readable type

Status: accepted and promoted as clean `v0.17.2` from `v0.17.2-dev_3` after Jeremy's phone review (2026-10-09). `dev_1` covered the Atlas, `dev_2` applied the same rule to the rest of the UI, and `dev_3` set all reading-face text 10% smaller after review (#114).

### Type system

- One rule across the whole UI, documented on `--crt-font-read` in `src/styles/crt.css`. Pixel faces (Pixelify Sans, Jersey 15) set titles, buttons, tags, kickers, index numbers, and the version label, never below 0.8rem (12.8px). IBM Plex Mono sets anything read rather than glanced at: sentences, data values and their labels, scientific names, the search field, debug readouts, and URLs.
- Plex Mono's tall x-height reads a size larger than the pixel faces, so every reading-face size is `calc(var(--crt-read-scale) * <base>)` with `--crt-read-scale: 0.9`. Bases are 0.72rem for labels and 0.8rem or more for values and sentences, so the smallest Plex text renders at 10.4px and body text at 11.5–12.4px. The 16px phone search field (stops iOS zooming on focus) and the Atlas IUCN track are exempt.
- Fonts load from the existing Google Fonts request, which now includes IBM Plex Mono (400, 500, italic 400).

### Atlas

- Descriptions, data values and their row labels, quick facts, the scale readout, scientific names, and the conservation labels move to Plex Mono. Headings, section tags, dex numbers, and chips keep the pixel faces at 0.8rem or more.
- The smallest Atlas text on a phone goes from 9.1px to 10.4px. The seven-cell conservation track sits at 10.6px, the most its cells allow at 375px.
- The scale readout's label column sizes to its content, so "Typical human" stays on one line in the wider face.

### Tank UI

- Tank menu: index numbers, heading, and names move to 0.8rem; the tank description moves to Plex Mono (11.5px).
- Follow mode: the info card's chips go from 9.3px to 12.8px, and its scientific name, notes, fact labels, and values move to Plex Mono. The phone card no longer forces one size on every paragraph. The "pinch to zoom" hint goes from 9.1px Jersey 15 to 10.4px Plex Mono.
- Search: the field and placeholder move to Plex Mono; the placeholder goes from 8.3px uppercase to 11.5px sentence case.
- Sources: the intro, summaries, full names, and hosts move to Plex Mono; tags, kickers, and entry numbers go to 0.8rem.
- Debug panel: readouts move to Plex Mono (phone panel 9.3px → 10.4px); buttons stay pixel at 0.8rem. The panel version label and the runtime recovery notice no longer fall back to the system monospace.
- Landing card and screenshot help: small labels go to 0.8rem; the screenshot help sentence moves to Plex Mono.

### Verification

- `npm run lint` (0 errors), `npm run build`, and `git diff --check` pass. A runtime sweep of every visible text node at 375px and 1280px across the landing card, tank HUD, follow mode, search, Sources, debug panel, screenshot help, and Atlas found nothing below the floors apart from the IUCN track, and no horizontal page scroll.

## v0.17.1 — Whitefin Sharksucker model

Status: accepted and promoted as clean `v0.17.1` from `v0.16.1-dev_1` after Jeremy's merge approval (2026-09-29), rebased onto clean `v0.17.0`.

### Species

- Replaces the generated Whitefin Sharksucker (*Echeneis neucratoides*) stand-in with Jeremy's supplied static GLB.
- Fits the model to its measured `5.4912`-unit source length, rendering the `75 cm` maximum at `3.0 WU`; recentres the model root and records the measured disc offset, dorsal clearance, and back profile for host skin fitting.
- Keeps the existing host-riding contract: free swimming, escort, approach, dock, latch, attached, and eased release across sharks, rays, turtles, cetaceans, and large fish.
- Uses the existing `caudal-vertex` path: the main body deforms, the suction-disc material split follows the body under it, and the four independent fins remain available for root-pivoted flutter.
- Production intentionally has no Whitefin rows yet; two review animals remain in `creatures_dev` for a later population release.

### Verification

- `npm test`, `npm run verify:procedural-fish-assets`, `npm run lint`, `npm run build`, and `git diff --check` pass after rebasing onto `v0.17.0`.

## v0.17.0 — Boundary-aware swimming

Status: accepted and promoted as clean `v0.17.0` from `v0.17.0-dev_01` after Jeremy's review (2026-09-29).

### Swimming

- Projected side bounds now use their real sloped X/Z frustum planes for look-ahead, soft-wall steering, wall glide, and hard-contact recovery. A fish moving toward the camera can therefore anticipate the narrowing side even with no X component.
- Solo steering preserves targets that already point inward, combines simultaneous wall contacts at corners, and receives an allocation-free contact mask from the runtime clamp. An outward heading is redirected tangent-plus-inward instead of repeating integrate → clamp while appearing to swim against invisible glass.
- Opposing boundary recovery uses the existing true-angle yaw/pitch arc with a deterministic per-fish turn side, avoiding the normal lerped turn's dead-astern stall without changing open-water turning. Mola authored movement and remora ride/release pose ownership remain exempt.

## v0.16.0 — Predator response, schooling and remoras

Status: accepted and promoted as clean `v0.16.0` from `v0.16.0-dev_17` after Jeremy's review (2026-09-28). `dev_2` had the evade and escape work and the first school fixes, `dev_3` added the school alarm (#105), `dev_5` the landing-card mark (#107), and `dev_6` the school-neighbours work and soft vertical walls. `dev_7`–`dev_12` were the remoras' review builds (#102, opened as `dev_1`), with the first supplied remora model, the Live Sharksucker; the other seven still render generated stand-ins that already swim with the real caudal wave. `dev_8` retuned the mako's and the remoras' body wave after Jeremy's review, `dev_9` sampled ride spots from the host's mesh, limited riders by host size, and pivoted fins at their roots, `dev_10` let remoras follow a host loosely, `dev_11` bent clamped remoras onto the host's skin and slowed their swimming wave, and `dev_12` fixed remoras snapping round at the end of the latch. `dev_13` gave schools soft front, back and side walls (#109), `dev_14` is the remoras rebased onto it, `dev_15` is an Atlas hot patch for the Live Sharksucker, `dev_16` frames every Atlas fish larger, and `dev_17` brings Jeremy's revised Live Sharksucker model.

### Species

- Eight remoras (Echeneidae) join the Atlas and the tanks: Live Sharksucker, Whitefin Sharksucker, Common Remora, White Suckerfish, Whalesucker, Spearfish Remora, Marlinsucker, and Slender Suckerfish. Facts are from the FishBase species summaries. The only non-FishBase claim that affects placement, the spearfish remora on ocean sunfish, comes from a 2022 first-record paper cited next to its data. Life span, maturity age, and brood size read Unknown for all eight, because no source gives them.
- Each renders at its true maximum length, from the 30 cm White Suckerfish (1.2 WU, just above the 1.08 WU tank floor) to the 1.1 m Live Sharksucker (4.4 WU). Weight uses one length–weight fit, taken from the two published maxima (sharksucker 2.3 kg at 110 cm, common remora 1.1 kg at 86.4 cm).
- The Live Sharksucker renders Jeremy's model: a striped body with its suction disc, separate pectoral and pelvic fins, and the raised front lobes of the second dorsal and anal fins. Its disc is its own material, so it follows the body under it (`followBodyMeshNames`) rather than waving on its own; the body, fins welded in, rides the `caudal-vertex` wave at the remora stroke. The model's origin sat 31% back from the snout and off the midline, so `model.position` recentres it mid-body, where the ride system and the Atlas expect the root. Its Atlas tile shows a close-up tank capture of its head and disc.
- Jeremy's revised Live Sharksucker model (`dev_17`) has a narrower head, and its disc is one surface instead of two identical overlapping copies, which could flicker where they overlap. Its length, root, disc and top line are unchanged, so `scripts/fit-rider-model.mjs` prints the same scale, recentring, disc position and `backProfile`, and nothing in `species.js` moves. Measured on the mesh against published morphometrics (standard length taken at the narrowest point of the tail stalk, 87% of total length): body depth 8.7–9.0% SL (7–13% in Fishes of Australia, 8–10% in McEachran & Fechhelm), disc 26.9% SL (22–23% and 27–28%), pectoral fin 12.2% SL (12–15%), pelvic fin 11.8% SL (11–14%). The disc ends ahead of the laid-back pectoral fin, as Fishes of Australia describes.
- Until their models arrive, the other seven are generated stand-ins: a slender body with a flat suction disc, long low second dorsal and anal fins, and a forked tail, coloured per species. It is built to the same asset contract the real GLBs will follow (unit length, nose −Z, one body mesh), so it swims with the real `caudal-vertex` tail wave, and its disc sits where the ride system clamps it.
- Only remoras with their real model appear in the Atlas: for now the Live Sharksucker. The seven still on stand-ins are marked `hiddenInAtlas` until their GLBs land (Jeremy's review, 2026-09-28).
- Seven go in The Open Sea and the Spearfish Remora goes in The Drift with the Mola. The tempo guard now skips riders: a remora mostly moves at its host's pace, so the spearfish remora does not count as a cruise fish in a drift tank.

### Remora movement

- Remoras ride hosts. A remora picks a free anchor on a host it rides, steers at an intercept point, settles onto the host over 1.1 s, and is then carried: it turns, pitches, and rolls with the host. When its ride time ends, it swims forward off its disc, peels away, unrolls upright over 1.4 s, falls behind, and swims free until it wants another ride.
- Hosts and riders are matched by host group. The mako is `shark` + `large-fish`; the Mola is `sunfish` + `large-fish`. Each remora weights the groups it rides by its documented host range. The sharksuckers and common remora take the mako readily. The white suckerfish, marlinsucker, and slender suckerfish take it only occasionally. The whalesucker never does, and swims free until a whale or dolphin exists. A future manta, turtle, or billfish needs only its own `rideHost` block to be ridden.
- Clamped remoras lie on the skin instead of floating off it. Each spot carries a *rail*: the skin's height along the body behind and ahead of it, raycast off the host mesh. A rider is laid along the rail (see the fit below). The stand-in bodies are also about 20% slimmer, and every stand-in disc top sits at the exact height the ride system clamps to.
- Remoras never swim through their host on the way in. Each host declares a clearance ellipsoid around its body. A remora heads for a staging point just outside its spot, swinging round the body when the host is in the way. Near the host it docks: it moves in the host's own frame round to its spot, turns to face the host's way, then slides in along the surface normal. After integration, an approaching remora found inside the clearance is pushed back to its surface. Speed matches the host's velocity plus a closing velocity, so a remora that gets ahead of its spot eases off instead of racing away. Measured live over 38 s, every mako spot filled, and no approaching or docking remora came closer than 1.2× the body's radius.
- Ride spots come from the host's mesh. `scripts/fit-ride-anchors.mjs` samples points over the body's faces by area and orients each by its face normal. It skips:
  - the back, and faces pointing along the body;
  - thin welded fins, and the Mola's mask-painted flapping fins;
  - spots where a rider would touch a separate fin;
  - spots beside a bump such as a fin root.

  The mako now has 18 spots on both flanks and the belly from 12% to 50% of its length, and the Mola 12, none mirrored. They were 4 symmetric hand-placed spots each. Riders take the nearest free spot give or take 35%, so they spread out.
- A host carries riders up to 80% of its own length laid end to end (`rideHost.loadRatio`): the 4.2 m mako takes three 1.1 m sharksuckers, or about ten white suckerfish. A spot is free only if its rider would clear the riders already there (each a capsule along its body, 6% of its length wide). In the live tank, three sharksuckers rode the mako (12.4 WU of its 13.3 WU capacity) and the fourth swam free, waiting.
- A clamped remora moves with the host's body wave under its disc: sideways by the wave's offset there, and turned with the body's slope. Hosts publish their live wave state with their pose. Without this, riders further back would have seen the skin slide under them since `dev_8` started the mako's wave near its pectorals.
- The fit to the skin now takes, of every tilt, the one lying closest to the skin on average, each lifted just enough that nothing cuts in, with a gap under the disc counting three times. The old fit tilted toward one fixed contact point and then lifted, which on the new, bumpier spots floated some discs 3–4 cm. Across all 198 rider-and-spot pairs the median disc lift is now 0 and the worst 4.5 mm.
- Remoras follow a host loosely when they are not clamped to it (Jeremy's review, with a photo of remoras shadowing a tiger shark). A remora that finds no room on a host often escorts it instead of roaming off. One that has just let go stays with its host half the time. An escort holds a loose, slowly drifting station below and beside the belly and matches the host's velocity, so it lags on turns rather than snapping in. Every 4–8 s it checks for a free spot, and it swims off after 25–60 s or as soon as the host fades. It is never pushed inside the host, by the approach's own clamp. In the live tank the fourth sharksucker shadowed the full mako about 4 WU off and took the first spot that opened.
- A clamped remora bends its rear body onto the host's skin, like the remoras in Jeremy's reference photo. Before, it stuck out straight behind its disc. The skin fit now chooses the bend together with the tilt: from 30% back, curving toward the host, at most 15% of its length at the tail, and never into the skin, fin lobes included. The bend is drawn by a second, up-and-down term in the `caudal-vertex` shader; it eases in over the latch and out as the remora lets go. On the mako, a full-size sharksucker's tail now reaches the skin on 14 of 18 spots; before, it sat 0.36–0.71 WU off on every one.
- Remoras ease onto their host again instead of snapping on (Jeremy's review, 2026-09-28). Since `dev_9`, the latch blended a rider's position but not its rotation: it held its docking angle for the whole 1.1 s latch, then turned to its final angle in one frame. The rotation blend passed its output quaternion as its own target, and three.js's `slerpQuaternions` copies the start into the output before reading the target. Measured live over three latches, the rider now turns at most 2.5° a frame, and the last step into its clamped pose is at most 0.3°. A test now checks the rotation partway through the latch, not only at its ends.
- A docking or clamped remora never startles off its host. The prey escape from `dev_2` would otherwise fire on a remora carried past a mahi; the ride owns its pose until it lets go.
- A clamped rider leaves the steer → boids → integrate pipeline, as the Mola sun-bask hold already does. A rider and its host ignore each other in boids, so the mako no longer pushes away the remora under its belly. A rider fades with its host through the Mola's deep-exit recovery, holds on until the host is visible again, and lets go before a basking Mola's roll would lift it out of the water.
- A supplied model is fitted to its measured top line, not a straight back. The real sharksucker's second dorsal fin has a raised front lobe about 4.6 cm above the line from its disc to its tail; fitted as a straight back, that lobe would have cut 3–5 cm into the mako. It now pivots on its disc until nothing behind it cuts in: up to 4° off the mako's belly and flanks, disc flush on the skin, lobe just touching. Its rear body stands 0.2–0.6 WU off the skin, depending on size and anchor, mostly because a straight 1.1 m body cannot follow a belly that curves toward the tail.
- Ride hosts now run their frame first (`useFrame` priority −1) and publish their final pose, so riders never lag a frame behind. Ride state persists across tank switches.

### Swimming

- The mako and the remoras swim with a bigger, faster body wave that starts near the pectoral fins, so head and body read as one piece rather than a stiff front with a waving tail (Jeremy's review, 2026-09-28). Mako: stroke `0.82 → 1.2`, beat `1.86 → 2.4`, wave start `0.18 → 0.1` of the length. Remoras: stroke `0.045 → 0.07` body lengths and wave start `0.3 → 0.14`. Their beat went to 4.4 and then, with a longer wave (`waveTravel 4.6 → 3.2`), to `3.0`: at 4.4 and 4.6 they read as snakes. They now make one gentle bend down the body.
- Independent fins turn about their roots. The sharksucker's right fins had kept their left twins' origin, on the far side of the body, so they swung through a wide arc and drifted; the renderer now finds each fin's root and turns it there. Measured live, the roots stay within 0.008 source units vertically and along the body while the tips flutter 0.06–0.12.
- Independent fins are carried with the body under their roots. With the wave starting near them, the body now moves under the mako's pectorals by up to ~1.4 cm; each fin shifts with it instead of being left behind. The Atlas does the same.
- The mako's teeth no longer wave on their own. They are a second material split and deformed over their own tiny bounds, so their back edge swung a full tail stroke. They now follow the jaw under them (`followBodyMeshNames`), as the sharksucker's disc does.

### Behaviour

- Prey flee where a predator is going, not where it is. Each fish steers away from the closest point of the threat's path over the next second (Nature of Code's evade), so a sardine beside a passing mako breaks sideways off its line instead of fleeing ahead down it, and a charging mako is noticed before it arrives. The neighbour registry gained each fish's speed to make that prediction; a fish with no speed is treated exactly as before.
- A big predator is seen from farther away. Every fish's threat range used to scale with its own size and cap at ~6–8 WU, less than half a 16.7 WU mako. The range toward a threat is now at least that threat's own body length. Only the mako is long enough for this to change anything: sardines and mahi notice it from ~16.7 WU, sardines bolt within ~7.4 WU of its path (was ~3), and mahi within ~4.6 WU, where before they never visibly escaped at all.
- A real threat startles a fish into an escape. The boid steering is only re-decided every 1–2.6 s, too late for an escape, so a cheap check runs every frame against the handful of fish with any menace (the mako and the mahi, not the ~275 sardines). A startled fish carves an arc toward safety on a turning circle 0.8 of its body length across while it accelerates to 2.5× its burst speed. Its body curls into the turn through the ordinary turn deformation, amplified, and its tail whips at up to ~3.5× its cruise stroke and ~2× the beat. An earlier in-place flick read as a twitch on a sardine but as the whole mahi snapping round, which is why the escape is an arc. A per-fish cooldown of 1.6–2.6 s follows each startle so a school doesn't pulse in unison. The random idle bursts are kept, and no longer block a startle: a mahi mid idle-burst once swam straight past the mako's mouth.
- A school reacts together. One startled sardine used to be one fish reacting; now its alarm spreads through its school as a wave at 15 WU/s, about three times a cruising mako, weakening to nothing 12 WU out and fading about 2 s after it passes. Every member reacts in proportion to how alarmed it is (Nature of Code's state-dependent weights): the formation packs toward 40% of its spacing with the pull to each slot up to 2.5× as strong, the fish cruises at up to 1.8× its idle speed and stops drifting, and it startles at half the usual threat level. As the wave first reaches a fish it flinches with an ordinary burst, and that ripple of bursts is what makes the wave visible. On a staged pass the alarm reached 177 of 180 sardines within ~1.8 s and neighbours closed from ~1.05 to ~0.8 WU apart (20–27%). The school as a whole stays about as wide, because the escapes split it to both sides of the mako first. Each fish reads a handful of wave events rather than its neighbours, so the wave costs almost nothing per frame.
- The escape uses a new `yawToward` turn at a true angular rate. The ordinary turn lerps, which barely moves toward a target behind the fish and then flips past halfway, so any U-turn built on it would have snapped. Normal swimming still uses the old turn, so its look is unchanged.
- The tail whip also reaches the instanced sardine layer. Nearly every sardine near a predator is drawn by it rather than the detailed model: all 275 were, while following the mako.
- Sardines watch their nearest 6 neighbours instead of 14. Studies of schooling fish find the nearest one or two dominate how a fish moves (Katz et al. 2011); averaging over fourteen blurred the local interactions a school is made of.
- School members keep their place by speed as well as by turning. Real schooling fish hold their front-back position by speeding up and slowing down and turn mostly to correct left-right (Katz et al. 2011); ours only turned toward their slot. A member now cruises 25% faster per body length its slot lies ahead of it, and slower when behind, within 0.7–1.5× its idle speed.
- On one ~85 s run each against `v0.16.0-dev_3`, both schools had fewer stragglers (5.2 → 3.0 and 3.8 → 2.1 fish more than twice the school's radius out) and the small school was tighter and better aligned. The big school came out a little looser. A single run each; the stragglers are the one result that moved the same way in both schools.

### Interface

- Every Atlas fish is framed larger (Jeremy's review). Each species' camera moved in, rather than its model growing, so the sardinella's and mahi's companions keep their places. On a desktop stage (1170 px square) the main fish now spans: sardinella 4.2 grid squares (40% of the width, was 2.2), mahi-mahi 6.3 (60%, was 4.4), mako 7.1 (68%, was 5.6), sunfish 74% of the height (was 59%), and the sharksucker's 6.1. Each species has its own phone zoom, filling 79–89% of a 375 px phone's stage. The mako used to run off a phone; the sardinella grew there from ~63%. The mako is re-centred (its origin sits near the gills, so its tail pulled it right), and the tall sunfish has its own tablet zoom so its fins stay on a tablet's short stage.
- The Live Sharksucker's Atlas tile is Jeremy's close-up capture from the tank (`public/atlas/echeneis-naucrates-thumbnail.png`). A first version showed the whole scene and shrank the fish to a sliver in the ~50 px tile. The tiles are wider than tall (64 × 46 px on a phone) and crop the photo's middle band, which left the fish, fins hanging down, low in the tile; a new `atlasThumbnailPosition` field (`'50% 72%'` here) picks a lower band so the fish sits centred. Its Atlas model is framed larger: about six of the stage grid's 112 px squares long on a desktop stage (measured 6.07), up from 3.4. A phone cannot fit six squares, so each species' portrait-phone camera zoom is now its own setting (`portraitPhoneDistanceScale`; the sardinella keeps its 0.46), and the sharksucker's 0.9 fills 85% of a 375 px phone's stage instead of running off it. On a tablet it fills 58%.
- The World Oceanarium mark (the "WO" sunfish) now sits between the live-feed line and the title on the landing card, tinted in the CRT foam colour with the same slight convergence split as the lettering. It is extracted from the favicon art as a transparent mask (`public/logo-mark.png`).

### Fixes

- A sardine school could flatten into a sheet against the top of its swim band, and left running long enough it got stuck there: all 180 sardines at `yMax`, every one pointing ~30° up, the school a single flat layer. Two causes, both older than this release:
  - The leader kept the school's goal only ~0.6–0.9 WU inside the vertical bounds while the formation reaches ~4 WU above and below its centre, so a goal near the top put the upper half past the bound. The goal now stays at least the formation's vertical half-extent inside (3.98 WU for 180 sardines); at the highest goal that allows, at most 5 of 180 touched the bound.
  - The trap: `clampToSwimBounds` held a fish's position on the bound but left its heading pitched into it, and boid alignment spread that pitch through the school, while slots measured from a centroid on the bound kept pulling half the fish past it. `dev_2` made fish glide along a bound; the pinned school let go as soon as that loaded.
- The sardines' ceiling was an invisible wall 1.8 WU under the water surface, and a school driven upward (a mahi below it was enough) still spread along it. It now sits just under the surface itself (`boundsYMax` 3.9 against the surface's 4.6), and both vertical bounds became soft walls for schools (Nature of Code's walls): within ~2 body lengths of the top or bottom a member is steered away, harder the closer it gets, and near a bound the formation compresses in proportion instead of its slots being clamped into one layer. The surface stays a hard limit, since past it is air, so the glide rule now applies there only. Over a two-minute run at most 4 sardines touched the surface and 3 the floor at once, and no school ever had more than 17% of its fish within one 0.15 WU layer.
- Sardine schools got pinned flat against the front, back and side walls of their swim volume, the same trap the top had before `dev_6`. Seen from the camera, a school pinned against a side wall and the front wall at once collapses into a vertical line of fish. Those four walls were only a hard clamp: it held a fish on the wall still heading into it, boid alignment spread that heading through the school, and the goal sat only ~2 WU inside the walls while a 180-sardine school is ~5 WU across. They now get what the top and bottom got:
  - a soft push away within ~2 body lengths of the wall (`horizontalBoundRepulsion`), following the side walls' taper with depth;
  - a slide along the wall instead of into it (`glideAlongWalls`), turning toward the middle of the tank when heading straight in;
  - a formation that draws in toward its centre near a wall instead of reaching past it;
  - a goal kept the formation's own half-extent inside the walls (`schoolFormationHorizontalHalfExtent`, ~5 WU for 180 sardines). An inset of the half-extent plus the soft-wall band kept the schools out of the front of the tank (8.7 of 23 WU of depth to roam), so the band was left out.

  Measured live, sampling every 2 s in the foreground on the same data, "pinned" meaning at least 40% of a school within 0.05 WU of a wall: `dev_6` was pinned in 46 of 104 samples, at worst 98% of a school; with the fix, 0 of 107, at worst 24% brushing a wall as it swam along it. The schools still roamed the whole tank: centres from x −26.5 to 27.9 and z −27.7 to −9.7, with front fish reaching the front wall.
- The mako's debug vectors started ~6.7 WU past its snout. Its `debugForwardOffsetRatio` had been measured from the tail end of the model (0.697) and is now 0.303, confirmed against the live mesh.

### Performance

- The boid decision reads threats straight from the handful of fish with menace and gathers social neighbours only within the perception radius. It used to gather everyone out to the (much wider) threat radius, so a sardine in the school sorted ~140 neighbours per decision to find one shark. A decision now costs 4.4 µs instead of 9.5 µs, with behaviour unchanged: 40 random scenes, 125,120 per-component checks against the previous version, largest difference 1.7×10⁻¹⁶ (float summation order), and two deliberately broken copies caught with 17,160 and 25,454 mismatches.

### Repository

- `tests/fishSwim.test.mjs` covers the new movement: prediction, the size-scaled range, the per-frame threat check, the escape direction, `yawToward` / `pitchToward`, the school alarm wave (arrival order, falloff, fading, merging, the event cap and expiry), the formation's vertical extent, the soft walls, and gliding along the ceiling. Every group was checked against 32 hand-broken copies of the code; two first slipped through (a registry that never refreshed speed after the first frame, and a turn that could go the long way round), and a test was added for each.
- `tests/fishRide.test.mjs` covers anchor frames, pose composition, slot bookkeeping, host choice, and a simulated approach → dock → latch → ride → release against a moving mako, including a host that is too fast, a host that leaves, and a host that fades. It also checks that approaches from above, below, the far side, ahead, and behind a still or cruising mako never enter its body. Eight hand-built mutants are all caught: boid exclusion, host rotation, the surface rule, disc orientation, release, the swing-round waypoint, the staging stand-off, and the push-out.
- `scripts/measure-ride-anchors.mjs` prints a host GLB's belly and flank lines in anchor units, for adding hosts.
- `scripts/fit-ride-anchors.mjs <host-id>` raycasts a host's body mesh and prints fitted anchors (skin point, averaged normal, rail). The tests now check that every remora, on every anchor of every host it rides, touches the skin and never cuts into it. Three more mutants are caught: no tilt, no lift, and a lift check that samples the rider instead of checking the rail's exact breakpoints. That last one was a real bug the test found.
- `scripts/build-remora-placeholders.mjs` generates the stand-in GLBs from species data. The procedural asset verifier checks all eight against the static-mesh contract.
- `scripts/fit-ride-anchors.mjs <host-id>` now generates a host's spots from its mesh into `src/data/rideAnchors.js`, recording the command that made each entry. The ride tests check the spread (both flanks, underneath, not mirrored), that every rider rests on the skin at every spot and no nearby tilt fits better, capacity, spacing, and the wave follow (including that the CPU curve's slope matches its offset). 14 deliberately broken copies of the new code are all caught.
- `scripts/fit-rider-model.mjs <id>` raycasts a supplied remora model and prints its scale, recentring offset, Atlas source length, disc position, and measured top line (`backProfile`). The ride tests check a supplied rider against that top line at every breakpoint of the skin and the back. The procedural asset verifier checks the sharksucker's body, rigid disc, and four fins.
- The Atlas now honours `model.position`, so a recentred model sits centred in the gallery. Other species are unchanged.
- `docs/ride-hosts.md` documents the system. AGENTS.md, the tank-design doc, and the species checklist point to it.

## v0.15.8 — Atlas corrections and frame cost

Status: accepted and promoted as clean `v0.15.8` from `v0.15.8-dev_3` after Jeremy's review.

### Atlas

- Four species carried figures that did not survive a check against the sources the v0.15.7 panel now names. Spotted Sardinella moved from Clupeidae to Dorosomatidae; Mahi-mahi's life span dropped from 5 years to 4; and Giant Sunfish had both a stated 20-year life expectancy and a "more than 300,000,000 eggs" brood figure that no source supports, so both now read Unknown rather than asserting a number the Atlas cannot stand behind.
- Maximum lengths grew for two species — Mahi-mahi 1.8 m to 2.1 m, Shortfin Mako 4.0 m to 4.45 m. These are not text-only edits: `bodyLengthWU` and the model `scale` are derived from the maximum, so both fish are now rendered at the corrected size rather than only described at it.
- The specimen scale bar's label is no longer the hardcoded word "Specimen". A species can now declare `atlasDetails.maxLengthLabel`, which Spotted Sardinella uses to say "Standard length" — its 27 cm maximum is a standard length, not a total length, and labelling it as the latter overstated the animal.
- The stage readout keeps two decimals below 10 m, so the Mako's 4.45 m no longer renders as "4.5 m".

### Performance

- The invisible tap-target box every fish carries is no longer drawn. It was a zero-opacity mesh, and three.js still draws and depth-sorts a transparent mesh whatever its opacity, so it cost one draw call per fish: 281 in the Open Sea, about four in five of the frame's draw calls. It is now `visible={false}`. Neither three's raycaster nor r3f's event layer checks `visible`, so a tap still lands on it. Desktop dev build, Open Sea, 600-frame averages: draw calls 328 → ~70, render 1.69 → ~1.05 ms, whole frame 2.78 → ~2.05 ms.
- The fish update stopped creating throwaway objects every frame, following the Nature of Code autonomous-agents chapter's advice on temporary vectors. Swim bounds and boid settings are cached per swim profile, and frozen so one fish can never edit an object another fish is reading. Boundary checks no longer build candidate arrays. The neighbour search reuses pooled records instead of one new object per candidate. The material pass no longer allocates a closure per fish. Sardine LOD registry entries are reused, and fin flutter reuses one `Euler`. JS heap growth dropped from 46 to 30 MB/s. The CPU saving is small; the point is fewer garbage-collection pauses on phones.
- Behaviour is unchanged, and that was checked rather than assumed. A throwaway harness ran `main`'s `fishSwim.js` and this one side by side on 200,000 random inputs: 3.4 million comparisons, all bit-identical. A deliberately broken copy produced 130,305 mismatches, so the harness would have caught a real difference.

### Repository

- Movement moved out of `Fish.jsx` into `src/components/fishSwim.js` — swim bounds, boundary avoidance, solo-agent steering, the Mola sun-bask targeting, and the boid/schooling maths. `Fish.jsx` drops from 3,783 lines to 2,861. The moved logic is byte-identical to what it replaced; the only behavioural surface that changed is that `SCHOOL_STATES` and `FISH_REGISTRY` are now private to the new module, reached through four accessors rather than touched directly.
- The new module is `.js` rather than `.jsx`, which is what makes it testable: Node cannot import `.jsx`, and that is why the largest file in the project has never had a unit test. `tests/fishSwim.test.mjs` is the first coverage movement has ever had — 59 assertions, verified against 12 hand-built mutants rather than a green run, since a test that passes proves nothing about what it would catch.
- The water-surface plane constants moved to `src/utils/waterSurfaceGeometry.js` so a `.js` module can read them without importing a renderer. `WaterSurface.jsx` re-exports them, so no importer changed.
- `tests/speciesData.test.mjs` pins every corrected figure, including the derived `bodyLengthWU` and model scales, so a future data edit cannot silently drift the rendered size away from the stated length. `npm test` was already wired to this file on `main` but the file itself had never landed, so the script errored on a missing module; it runs now.
- `tests/fishSwim.test.mjs` pins the new caches: repeat calls share one frozen bounds object, a different depth zone is never served stale bounds, and two species sharing one swim profile never inherit each other's boid settings.

## v0.15.7 — Sources

Status: accepted and promoted as clean `v0.15.7` from `v0.15.7-dev_1` after Jeremy's review.

### Interface

- The top-right menu gained a Sources key, opening a panel that lists the references the species data is read from: FishBase, WoRMS, the IUCN Red List, and this repository. The Atlas states a lot of specific things about each animal — depth bands, brood sizes, life expectancy — and until now the app never said where any of it came from, which is the one thing a claim like that needs.
- Each entry carries the fields that reference decided, so a single row of an Atlas entry can be traced back to the source that filled it rather than to the bibliography as a whole.
- The list is rendered from `src/data/sources.js` rather than from markup, so adding a reference is a data edit. The menu's open/close stagger moved from naming each key to counting them, which is what let a fourth key join it without touching the animation.

### Repository

- The Blender source files moved out of the repo to Dropbox and were purged from git history. They were never read by the build — only exported GLBs under `public/models/` are — but as undiffable binaries they dominated the repository: the pack shrank from 71 MB to under 20 MB. History was rewritten, so every commit SHA changed; an existing clone should be re-cloned rather than pulled.

## v0.15.6 — Loading screen

Status: accepted and promoted as clean `v0.15.6` from `v0.15.6-dev_4` after Jeremy's review on both mobile and desktop.

### Loading

- The landing gate now reports what it is waiting for. `TankView`'s `<Canvas>` has always mounted behind the gate, so assets were already streaming in while it covered the screen — but nothing said so, and "Dive in" was enabled immediately, so it was possible to enter a half-loaded ocean and watch it fill in. The existing hairline under the tagline doubles as the bar, so nothing is added to the layout and nothing needs dismissing when it finishes: it simply stops being lit.
- The scene is compiled and its textures uploaded while the gate is up. three.js defers a texture's GPU upload until the frame it is first drawn, so each species used to stutter as it swam into view — and at a different moment each visit, since fish are seeded to new positions. The Shortfin Mako compounded it by not being preloaded at all, fetching on first sighting.
- Entry waits for the scene rather than for a click. Readiness needs the loader queue quiet for 300 ms rather than merely inactive, since it reports inactive whenever the queue drains between batches, and it also waits on the creature fetch — which required `useCreatures` to gain a real `loading` flag, its `source` being unable to distinguish "not fetched yet" from "returned no rows". Three ways that could have stranded a visitor on a disabled button are handled explicitly: a warm cache where the loader is never observed active, a failed asset, and a dead network.
- The bar is drawn with `transform` rather than `width`. Animating width is a layout property computed on the main thread, which during a load is the busiest thread in the app; it stuttered measurably on a phone while desktop had the headroom to hide it. transform is composited off the main thread, so the fill keeps moving even while the main thread is blocked.

### Fixes

- Switching tanks left the previous tank's creatures in the scene, and drew some of them twice. `<Biome>` and the scene warm-up are siblings under `<Canvas>` and were given the same React key; React reconciles children through a map keyed by `key`, so two siblings sharing one collide and their children may be duplicated or omitted. Introduced in `v0.15.6-dev_1` and fixed in `dev_4`.
- Sardines handed themselves to the instanced layer immediately, while the detailed model unmounts through React state a render later — so a transitioning fish could be drawn twice. Registration now waits for the state to catch up, which leaves a fish detailed one frame longer instead.
- `SardineInstancedLayer` cloned its geometry and material and never disposed either. The clones belong to the component rather than to the GLTF cache, and `<Biome>` is keyed by tank, so every switch orphaned a set on the GPU.
- Replaced drei's `<Preload all>` with a local warm-up. Both compile the scene, but drei also renders it six times through a `CubeCamera` to warm environment reflections; at ~281 fish that pass dominated the cost, and nothing here consumes it — the environment map is a `CanvasTexture` built in `SceneLighting` and the water's HDR is loaded directly.
- The LOD debug readout reported the pending detail level rather than the committed one, describing what was about to happen instead of what was on screen.

## v0.15.5 — Static-asset follow and Atlas regression fixes

Status: accepted and promoted as clean `v0.15.5` from `v0.15.5-dev_1` after Jeremy's review.

### Follow camera

- Follows each rig-free procedural fish at its live mesh origin instead of a removed skeletal target or a trailing smoothed sightline. The camera can still translate smoothly, while the fish remains centered on desktop and mobile.
- Makes static-root follow an explicit `followAim: 'root'` model contract. A future hybrid/rigged procedural model may still use a valid named bone, and broken rig metadata remains diagnosable.

### Atlas

- Restores motion to rig-free Atlas specimens by reusing the tank's species-specific procedural deformation rather than bringing authored clips back.
- Portrait mobile Atlas opens on the species list, then moves through explicit list → detail → back navigation. Desktop and landscape retain their existing detail/list presentation.
- Shifts the Shortfin Mako's Atlas hero left enough for its tail to clear the right specimen-stage edge.

## v0.15.4 — Performance pass and fish asset reconciliation

Status: accepted and promoted as clean `v0.15.4` after Jeremy's device review — **desktop 150 fps, mobile 60 fps** (the vsync ceiling), measured 2026-09-02.

### Performance

- Caps the tank canvas at `dpr={[1, 1.5]}` instead of react-three-fiber's `[1, 2]` default. The scene is fragment-bound — the water's `transmission` re-renders the opaque scene into a refraction target, and the surface, god rays and suspended particles all overdraw — so cost tracks pixel count closely. On a DPR-3 phone at the 375x812 review viewport that is 1,218,000 fragments per pass against 684,516, a 44% reduction. Matches the cap the encyclopedia canvas already used.
- Removes `mix-blend-mode: multiply` from `.crt-screen`. That layer is fixed, full-viewport and above everything, so blending forced the compositor to re-blend the whole screen against a backdrop containing the constantly-repainting tank canvas. Free to drop because the film flattens to `rgb(5.9, 12.1, 18.0)` at alpha 0.150 — for a black source, multiply and normal blending are algebraically identical, so the error scales only with distance from black. Worst case 2.7/255 on one channel in the deepest blacks; 0.00 against white UI text.
- Stops `SardineInstancedLayer` rebuilding its instance list every frame. The old `Array.from().map(spread).filter().slice()` chain allocated ~1,100 objects per frame across both LOD buckets to reproduce data already in the registry Map, and re-derived each instance's wiggle phase with an FNV hash over a creature id that never changes. Now reusable buffers plus a phase cache: 20.6 -> 6.4 us/frame, and zero steady-state allocations. The CPU saving is ~0.1% of the frame budget; the GC pressure was the point.
- Root cause of the original report was population growth rather than a code regression. The ocean biome grew 21 -> 88 -> 275 Sardinella between May and July 2026, and every alive creature mounts its own `<Fish>` with a per-frame `useFrame`, so frame cost tracks a Supabase row count that changes with no commit.

### Runtime assets

- Corrects the `useGLTF.preload` list, which was never updated when the static models landed and still named the superseded rigged GLBs. Every load eagerly fetched `sardine.glb` and `mahi-mahi_female.glb` — never drawn — while the `_static_parts` models that are drawn loaded lazily on first sighting. Bytes fetched to render the full scene: 25.28 MB -> ~15 MB.
- Points the Mahi-mahi base `model.path` at `mahi-mahi_male_static_parts.glb`, moving its `proceduralAnimation` from a bone chain to the male variant's `caudal-vertex` config at the same time. The static meshes carry no bones, so a bone-driven config on the base would have left any creature falling through to it rendering completely still.
- Deletes five superseded GLBs — `isurus-oxyrinchus.glb`, `mahi-mahi_male_static.glb`, `mahi-mahi_male.glb`, `sardine.glb`, `mahi-mahi_female.glb`. `public/models` drops 31.96 MB across 12 files to 14.99 MB across 7, and every remaining model is rig-free.
- Rebuilds the Sardinella LOD ladder from Jeremy's rig-free re-exports. It had inverted under `v0.15.3`, with the LOD0 hero mesh at 303 triangles against LOD1's 748 — the mid-distance model carrying 2.5x the geometry of the closest one. Now 2,492 -> 786 -> 145, monotonic and bone-free.
- Down-res's the Sardinella LOD textures to 256x144 and 128x72, sized from on-screen length at each LOD's closest draw distance (~223 px and ~140 px at the capped viewport) rather than from triangle count. Both LOD files fall under 100 KB, and the Sardinella texture is no longer duplicated across files.

## v0.15.3 — Static procedural fish runtime assets

Status: accepted and promoted as clean `v0.15.3` from `v0.15.3-dev_5` after Jeremy's review.

### Creature motion

- Uses Jeremy's static, rig-free runtime assets for Sardinella, both Mahi-mahi variants, Shortfin Mako, and Giant Sunfish. Caudal species receive GPU body deformation; the Mola keeps a rigid disc body and mask-driven appendage motion.
- The Giant Sunfish’s dorsal/anal fins rotate from independent painted attachment pivots, use the refined low-value `COLOR_1` root gradients with continuous quintic easing, and row at a deliberately slow cadence. Its passive drift may settle through a tiny roll; its behavior-owned sun bask remains separate.
- The static-asset contract requires expected mesh topology and `color_1` for Mola, while rejecting clips, bones, and skinning.

## v0.15.2 — Synthetic bold fix

Status: accepted and promoted as clean `v0.15.2` from `v0.15.2-dev_1` after Jeremy's review.

### Typography

- Removes the `font-weight: 600` (and one `500`) left on eleven small-type sites after `v0.15.1` moved them to Jersey 15. Jersey 15 ships **weight 400 only**, so those declarations were not selecting a bold face — the browser was synthesising one by smearing the glyph in place. Measured at the rendered 12.96px, the `6` went from 25 ink pixels at weight 400 to 38 at 600 with **no change in advance width**, which is the signature of faux bold; on a pixel font whose `6` has a one-pixel counter, that smear closes the hole and the digit reads as an `8` or a `0`. The weights were correct when Pixelify Sans, which has real 400–700, occupied those sites.
- Adds `font-synthesis-weight: none` alongside every `--crt-font-tiny` declaration, so reintroducing a weight there fails visibly rather than silently filling the counters again.
- No hierarchy is lost: every affected pair was already separated by colour and size, with weight adding nothing a real face was providing.

## v0.15.1 — Small type and Atlas cleanup

Status: accepted and promoted as clean `v0.15.1` from `v0.15.1-dev_3`.

### Typography

- `v0.15.1-dev_3` returns `HUMAN_SCALE_METERS` to the better-sourced `1.65`. It had been rounded to `1.7` purely because Pixelify Sans rendered "1.65 M" as "1.6S M"; measured at the 12.96px the readout uses, Jersey 15's 5/S shapes overlap 53% against Pixelify's 75%, so the constraint is gone and the accurate figure is back.
- `v0.15.1-dev_3` raises the IUCN conservation codes, the smallest text in the app. `index.css` set them at `0.62rem` desktop and `0.46rem` on mobile — the latter rendering at ~7.4px, and Jersey's shorter cap height would have made it smaller still. Now `0.7rem` and `0.57rem`, landing at 11.2px and 9.1px.

- `v0.15.1-dev_2` resolves the `--crt-font-tiny` KIV: small type moves to **Jersey 15**, leaving Pixelify Sans on everything above `0.75rem`. Chosen on measurement rather than reputation — rasterising confusable glyph pairs at 10px and diffing the pixels put Jersey's `5`/`S` collision lowest of every candidate tested. Notably it beat Silkscreen, which is explicitly designed for small sizes and was the expected winner but scored *worse* than Pixelify Sans on that pair.
- Nudges all 30 labelled small-type sites up 10%. Jersey 15 has a shorter cap height than Pixelify Sans, needing ~4% more size just to match apparent size; the remaining 6% is net legibility gain, affordable because Jersey runs 23% narrower — the scale readout ends up 273px wide against 278px before, despite larger text.
- Verified at desktop and 375px: nothing clipped, no page overflow, the stage readout still fits inside the specimen stage, and the tank index still fits on screen.

### Housekeeping

- Removes the CSS orphaned when `v0.15.0` replaced the in-scene diver sprite with a DOM scale bar: `.atlas-pose-editor` and its heading/control/action rules, `.atlas-human-scale` and its head-comparison and image variants, and `.encyclopedia-stage-label` — the last superseded by `.atlas-stage-chip` / `.atlas-stage-readout`. Each was verified unreferenced by any JSX first; where a dead name appeared inside a grouped selector, only that selector was dropped and the group left otherwise intact. `index.css` goes from 2,130 to 2,005 lines.
- Deletes `public/atlas/diver.png` and `diver.svg`, the sprite texture and its source, now unreferenced.
- Fixes an unrelated console error found while verifying: `<feTurbulence stitchTiles="no">` in the screenshot-grain filter is not a valid value (the attribute takes `stitch` or `noStitch`), so it threw on every page load while silently falling back to `noStitch`. Now set explicitly — same rendering, no error.
- Leaves the `world-oceanarium-atlas-diver-poses` localStorage key alone. Nothing reads or writes it any more, so stored values are inert; adding migration code to clear them would cost more than the bytes it reclaims.

## v0.15.0 — CRT/pixel interface

Status: accepted and promoted as clean `v0.15.0` from `v0.15.0-dev_11` after Jeremy's review. The 3D scene stays pseudo-realistic throughout — only the interface layer changes.

### Interface / visual language

- Brings `package.json` to `0.15.0`, matching the visible app version. It had read `0.8.0` since before `v0.13.0`.
- Adds `--crt-font-tiny` as a KIV escape hatch for small type. Pixelify Sans stops being reliable below ~12px — its "5" reads as an "S", which already forced `HUMAN_SCALE_METERS` from `1.65` back to `1.7`. Every rule setting a font-size under `0.75rem` now points its `font-family` at this token instead of `--crt-font`, so swapping in a second face for small type is a one-line change. Aliased to `--crt-font` for now, so nothing renders differently until a replacement is chosen; `grep --crt-font-tiny` finds all 30 sites.
- Two of those sites needed specificity work rather than a token swap. `index.css` styles `.atlas-table-section h3` (0,1,1) with a `ui-monospace` `font:` shorthand that outranks a bare `.atlas-section-tag` (0,1,0), so the section headings are now selected as `.atlas-table-section .atlas-section-tag` (0,2,0). The IUCN status spans render at ~9px — the smallest text in the app — but are never given a font-size in these stylesheets, so a font-size sweep could not see them; they are labelled explicitly.
- Adopts a CRT-terminal visual language for the UI, framing the tank as though watched through a phosphor monitor rather than restyling the scene itself. Three primitives carry it: scanline banding on a non-interactive film, phosphor glow with a chromatic-aberration split, and notched pixel edges via `clip-path` in place of `border-radius`.
- Adds `src/styles/crt.css` (tokens plus primitives) and `src/styles/crt-retrofit.css` (overrides for the pre-existing chrome). The retrofit is deliberately quarantined in its own file imported last, so the entire look reverts by removing one import.
- Suppresses the global tube film in screenshot mode, keeping captures of the scene free of interface framing.
- `v0.15.0-dev_2` retunes the whole pass softer after `dev_1` read as too sharp: chromatic splits drop from 3px hard offsets to 1px at 1px blur and roughly half alpha, panel treatment drops from stacked 2px+3px hard keylines to a single 1px rule plus a wide bloom, scanline alpha falls from `0.20` to `0.12`, the global film from `0.40` to `0.30`, and the cyan/pink phosphors come off full saturation. Stepped transitions and one-frame title dropouts become eased, so no motion snaps hard enough to catch the eye.
- `v0.15.0-dev_4` restyles the follow readout ("Following fish / scroll to zoom · drag to orbit"), the last element still speaking the pre-CRT glass-pill language. It becomes a notched HUD strip with a hairline rule and a blinking live indicator, and moves up from `4.8rem` to `3.4rem` now that the tank title removed in `dev_3` no longer sits above it. Its styling also moves out of component inline styles into the shared CRT sheet.

### The Atlas

- `v0.15.0-dev_11` gives the specimen stage its own scanlines on top of the global `.crt-screen` film, so the specimen reads as something on a monitor rather than a window cut through one. Kept at the same 3px pitch as everywhere else — a second pitch would beat against the global film and shimmer — with a heavier line instead, landing at roughly double the banding of the surrounding page.
- `v0.15.0-dev_10` returns `HUMAN_SCALE_METERS` to `1.7` on legibility grounds: Pixelify Sans renders "5" close enough to "S" that "1.65 M" reads as "1.6S M" at readout size. `1.65` remains the better statistic, and the constant documents why it was traded away — a reference figure nobody can read is worth less than a rounder one they can. `formatReferenceLength` stays, since it renders either value correctly and guards the rounding trap if the constant moves again.
- `v0.15.0-dev_10` lifts the scale readout's legibility after review: the human bar moves from a near-invisible `#2c5f7a` to `--crt-drift`, the palette's established "legible but secondary" tone, keeping it subordinate to the lit specimen without hiding it. Value type goes from ~10px to ~12px, the track from 7px to 8px, and the label column widens to match.
- `v0.15.0-dev_9` relabels the stage scale reference from "Diver" to "Typical human" and moves `HUMAN_SCALE_METERS` from `1.7` to `1.65`. The old figure was effectively the global *male* mean, which quietly picked a sex for a bar labelled as a typical human; `1.65` sits between the global means for men (~171cm) and women (~160cm) reported by the NCD Risk Factor Collaboration's pooled analysis of 1,472 studies (eLife, 2016).
- `v0.15.0-dev_9` adds `formatReferenceLength` for that value. The existing `formatStageLength` rounds to one decimal, and `(1.65).toFixed(1)` is `"1.6"` — binary64 stores 1.65 as 1.64999…, so a figure stated as 165cm would have silently rendered as 1.6m.
- `v0.15.0-dev_8` fixes the `dev_7` measurement grid, which was never visible: it was applied to the stage's CSS background, but `SceneLighting` sets `scene.background` on an opaque WebGL canvas sitting above it, so nothing behind that canvas can ever show. The grid moves onto `.atlas-stage-frame`, which paints above the canvas alongside the corner brackets. That is also the truer idea — the grid is etched on the viewport, not floating in the ocean. The stage's own background and its `is-tank-backdrop::after` layer are left documented as permanently hidden.
- `v0.15.0-dev_8` replaces the in-scene diver sprite with a proportional scale bar in the stage readout. The sprite shared 3D space with the specimen and so was only legible at some sizes — against a 27cm sardinella a 1.7m diver cropped to a shapeless mass filling the frame. Two bars carry the same comparison and stay readable at every size: the longer subject fills the track and the shorter is measured against it, with a minimum width so a small specimen still shows a visible stub. Verified proportional across the range (sardinella 16%, mahi 94%, mako and sunfish pinning the track).
- `v0.15.0-dev_8` removes everything that existed only to position that sprite: the pose tables, normalisation and merge helpers, localStorage persistence, the diver pose editor, and the three-tap/Ctrl+Shift+D toggle that opened it. The Atlas version label becomes an inert readout rather than a hidden debug button. Roughly 200 lines net.
- `v0.15.0-dev_7` reworks the specimen stage to match the rest of the dex. A two-pitch measurement grid (fine at 28px, major every fourth line) replaces the plain gradient backdrop — a specimen floating on a gradient reads as a picture, while the same specimen over ruled paper reads as something being measured, which is what the diver silhouette was always there to do. The `is-tank-backdrop` overlay drops its bright top wash and keeps only the vignette, so it stops competing with the grid.
- `v0.15.0-dev_7` adds a scale readout to the stage naming both sides of the comparison: the diver reference (from `HUMAN_SCALE_METERS`) and the selected species' max length, with keyed swatches tying each figure to what it measures. The silhouette had always been the scale reference without ever saying so or giving the figure it referenced.
- `v0.15.0-dev_7` retones the diver sprite from pure black to the dex chassis colour — the one value in the atlas that belonged to no palette. It still reads as a silhouette rather than a hole punched in the stage.
- `v0.15.0-dev_4` reimagines the Atlas as a field dex, borrowing the grammar of Pokédex/HUD reference panels rather than their palette — it stays on the CRT tokens so the atlas still belongs to the same app. Four motifs carry it: corners chamfered on a single diagonal, L-brackets framing the specimen stage, section labels drawn as bracket tags (`-BIOLOGY-`, `-SOCIAL-`, `-AVERAGES-`, `-LIFECYCLE-`), and a zero-padded `№` on every specimen in both the index rail and the info panel.
- Species selection reads as an illuminated left rail rather than a filled row, so a dense list does not turn into a block of colour. Quick facts regroup from three separate cards into one hairline-divided readout strip.
- No information is dropped in the process: the same status bar, quick facts, description, and all ten data rows across Social/Averages/Lifecycle still render. The description gains a `-BIOLOGY-` heading so it matches the other sections instead of floating unlabelled.
- Added as `src/styles/atlas-dex.css`, imported last and quarantined the same way as the CRT retrofit.

### Tank switcher

- `v0.15.0-dev_6` collapses the tank index behind a hamburger toggle that shows the active tank name when closed, and opens the list upward from the same bottom-left anchor. This is written as one threshold-driven mode rather than a phone-only branch: compact viewports (`max-width: 768px` or a coarse pointer) always collapse, and desktop adopts the identical menu once tank count passes `TANK_INLINE_LIMIT` (6) — the collapsed form is the long-term pattern for both, which also retires the earlier "revisit past 8 tanks" roadmap item.
- On compact viewports the container drops entirely — no fill, outline, or chamfer, just type and hairline rules over the scene. Every text layer gains a hard shadow to replace the contrast the panel was providing, since the water behind ranges from near-black to bright surface caustics.
- The list is unmounted rather than hidden while collapsed, so its rows cannot be tabbed into off-screen. Closing is wired to outside pointerdown, Escape, and selecting a tank; screenshot mode and the landing gate force it shut so it cannot spring back open on return.
- Adds `src/hooks/useMediaQuery.js`. The breakpoint changes behaviour rather than only appearance, and CSS alone cannot tell React whether a control is collapsible — hiding the toggle in CSS while its collapsed state lives in JS leaves the two disagreeing about what is on screen.
- `v0.15.0-dev_5` moves the tank switcher from the bottom centre to the bottom left and rebuilds it as a vertical index. It now speaks the same language as the Atlas species list — chamfered panel, `-TANKS-` bracket heading, two-digit row numbers, and an illuminated left rail for the selection instead of a filled pill — and it balances the focus card, which is anchored bottom right.
- This also fixes a scaling failure measured on the old horizontal row. At 375px it clipped off *both* screen edges from five tanks onward, and because `html`/`body`/`#root` all set `overflow: hidden`, those tanks were unreachable rather than merely off-screen; four tanks already squeezed the labels to min-content. The vertical list stays fully on screen at every count tested from 2 to 12, capping its height at `min(38vh, 16rem)` and scrolling internally past roughly seven entries. The active row is pulled into view on selection so it cannot be left scrolled out of sight.
- The tank description moves inside the panel beneath a hairline, so the tank and its blurb read as one module rather than a caption floating above a separate control.

### Interface / visual language

- `v0.15.0-dev_3` removes the top-centre tank title and its depth-zone subtitle (`The Open Sea` / `Epipelagic · Sunlight Zone`). The switcher dock at the bottom already names the active tank, so the header was a second answer to a question the UI had answered once. Drops the now-unused `defaultDepthZone` lookup and its `DEPTH_ZONE_BY_ID` import with it.
- `v0.15.0-dev_2` moves the UI from VT323 to Pixelify Sans. The practical gain is real weights (400–700): the single-weight face forced every emphasis to be faked with glow, and restoring weight-based hierarchy is what allowed the glow to come down globally. Type sizes return to roughly their pre-CRT values, since Pixelify Sans has a normal x-height where VT323 needed a ~1.3x bump.

### Landing gate

- Adds an entry modal that closes by "diving": the card sinks and blurs past a stationary scanline film while depth ticks rise past it. The film sits above the gate on purpose — scanlines belong to the glass, so the viewer descends past a fixed screen rather than watching a textured card move.
- Dismissing the gate doubles as the user gesture that satisfies the Web Audio autoplay gate.
- `v0.15.0-dev_2` cuts the copy to the title, tagline, species count, and the follow hint per Jeremy's review; the tagline becomes "just keep swimming", and the footnote now appears only during the dive.

## v0.14.0 — Procedural caudal-fish animation

Status: accepted and promoted as clean `v0.14.0` from `v0.14.0-dev_4` after Jeremy requested the procedural and Blender-model branches be checked and merged.

### Creature motion

- `v0.14.0-dev_4` makes the static male Mahi's procedural body wave review-legible: doubles lateral amplitude (`0.16` → `0.32` source units), raises cadence (`2.15` → `2.6`), begins flexibility earlier along the body (`0.28` → `0.16`), reaches full tail influence sooner (`0.88` → `0.78`), and strengthens turn/burst response without reintroducing skeletal folding. Asset inspection also confirms Blender's pelvic/pectoral vertex groups did not survive this GLB export: it contains only `position`, `normal`, and `uv`, with one combined mesh/material and no custom attributes, geometry groups, skin weights, morphs, or named fin nodes.
- Restores Jeremy's updated male and female Mahi Blender source files after their first model PR accidentally included a full revert. Both source files are valid Zstandard-compressed Blender files and expose separate left/right pectoral and pelvic fin objects. Runtime still uses the reviewed combined static male GLB; independent fin animation requires a later GLB export preserving those named mesh parts.
- `v0.14.0-dev_3` replaces the male Mahi rigged/animated GLB with Jeremy's supplied neutral `mahi-combined` static mesh: zero bones, zero skin weights, zero clips, one 28,470-vertex mesh. A GPU vertex deformer derives flexible-body influence directly from local longitudinal Z bounds, preserves a rigid front, sends a travelling lateral wave into the tail, responds to live speed/turn/burst inputs, and analytically adjusts normals to match the bent surface. The female Mahi remains on the procedural bone-lattice bridge pending a matching static asset.
- `v0.14.0-dev_2` fixes the severe Mahi tail fold found in review. The first pass computed a conservative desired angle for each spine bone but applied that complete angle at every joint; because those bones are hierarchical, rotations compounded down the chain into the photographed hinge. The pose now treats each computed value as cumulative spine curvature and applies only the difference from the previous joint, keeping the configured tail angle bounded across Sardinella, Mahi, and Mako. This was hierarchical bone accumulation—not an unintended vertex mask.
- Completely disables authored GLB animation playback for Sardinella, both Mahi-mahi variants, and the Shortfin Mako. Their existing rigs now serve only as neutral deformation lattices driven directly by live movement state.
- Replaces clip selection with species-shaped procedural cruise, drift, turn, and burst semantics. Actual speed, acceleration, signed turn, burst envelope, and forward-travel easing drive bend strength and stroke cadence every frame.
- Integrates a deterministic continuous wave clock per rendered fish, preventing speed or burst changes from snapping sine phase. Stable per-creature phase offsets preserve school desynchronization.
- Keeps Sardinella quick and flexible, Mahi front-heavy with rear-body follow-through, and Mako rigid/powerful through distinct parameter blocks. Mola and all other species keep their existing playback path.
- Adds `npm run verify:procedural-fish-assets` to verify every target GLB exposes the configured procedural bone chain while reporting embedded clips that runtime intentionally ignores.

## v0.13.0 — Deforming ocean surface

Status: accepted and promoted as clean `v0.13.0` from the historically labeled `v0.14.0-dev_12` review build after Jeremy reju. The clean number was corrected to follow `v0.12.3`; the feature remained isolated from the cinematic-camera branch throughout review.

### Environment / atmosphere

- Replaces the visually animated but physically flat two-triangle ceiling with a 320×320 WU, 256×256-segment water mesh displaced in the vertex shader by six deterministic Gerstner waves arranged as three crossed scales.
- Derives surface tangents and normals analytically in the same vertex pass and feeds them into a real `MeshPhysicalMaterial` with water IOR, transmission, thickness, absorption, roughness, Fresnel reflection, and clearcoat across the full plane—no front-only fragment alpha strip.
- Gives the water material its own licensed 1K Qwantani Pure Sky HDR environment for underside reflection/refraction without changing creature lighting or the scene background.
- Keeps physical transmission mobile-conscious with a half-linear-resolution refraction target, and distance-fades the material before the plane edge can enter upward views.
- Retunes the physical tint from saturated cyan toward the tanks' muted cobalt/steel-blue palette, then combines camera-distance and grazing-angle alpha fades so the far surface dissolves into water fog before it can form a hard horizon line.
- Suppresses the surface more decisively at shallow viewing angles, removing the repeated reflected bands seen in portrait and level views without adding a replacement noise texture; steeper upward views retain the physical HDR material and Gerstner deformation.
- Restores the low-angle HDR reflection with a denser, lower-amplitude `4.2–8.5 WU` Gerstner spectrum, so reflected wave lines are materially smaller than the prior `12–22 WU` ribbons; the closer distance fade hides the smaller plane before its edge.
- Pairs each coarse, medium, and fine displacement scale with a second incommensurate wave moving in a different direction and at a different speed, then balances their amplitudes so no single sinusoid dominates the reflection.
- Raises only the water material's Qwantani Pure Sky HDR environment intensity from `0.8` to `1.15`, making the underside reflection brighter without relighting fish, fog, or either tank.
- Widens the crossed displacement spectrum to `3.1–20 WU` across coarse, medium, and fine pairs, creating a stronger large/medium/small hierarchy instead of six similarly sized tiled ripples.
- Lowers the default camera target from `lookY=-2.1` to `-2.75` (about `3.4°` upward) so the horizontal ceiling crowns portrait framing rather than occupying nearly half the screen; the plane remains at its physical world height and follow framing is unchanged.
- Raises the crossed spectrum's lower bound from `3.1` to `4.5 WU` (`4.5–22 WU` overall) and increases only the water-local Qwantani HDR environment intensity from `1.15` to `2.2`.
- Increases that water-local HDR intensity again from `2.2` to `8.0`, making reflected sky highlights visibly brighter than the water body without changing global tank lighting.
- Keeps the authored fake god-ray planes exclusive to the settled default camera view; follow/orbit and the transition back to default retain particles and physical water but render no fake shafts.
- Redistributes the unchanged `0.119 WU` wave budget into descending pair magnitudes—coarse `0.064`, medium `0.036`, fine `0.019 WU`—so the three wavelength bands differ in physical height as well as wavelength, direction, and speed.

## v0.12.3 — Larger Sardinella schools

Status: accepted and promoted as clean `v0.12.3` from `v0.12.3-dev_1` after Jeremy approval.

### Creature behavior

- Raises the shared-school cap from 64 to 180 fish. The current 275 live Spotted Sardinellas now resolve into two logical schools (180 + 95) instead of five (64 + 64 + 64 + 64 + 19); Mahi-mahi remain explicitly capped at pairs via `schoolMaxSize: 2`.

## v0.12.2 — Persistent tank sessions

Status: accepted and promoted as clean `v0.12.2` after Jeremy's visual pass. No further visual changes are required.

### Tank continuity

- Switching tanks no longer resets every inhabitant. Continuity-critical fish state now lives in `src/components/fishRuntimeStore.js`, keyed by creature id, so position, heading, velocity, committed boid steering, simulation clock, and seed/reset gates survive the active tank's unmount/remount cycle.
- Only the active tank remains mounted and rendered, preserving the existing `O(active tank)` runtime cost. Hidden tanks do not simulate in the background; they freeze and resume when revisited.
- `App.jsx` prunes stored snapshots whenever live creature data changes, preventing removed creatures from leaving stale runtime entries. A page reload clears the module store and intentionally starts a fresh session.
- Returning schools preserve each member's position and heading without teleporting. The shared school migration goal is still recreated when its leader remounts, so a school may choose a new travel direction after resuming; this is an optional continuity refinement, not a release blocker.

### Validation

- Production build and lint passed, GitHub Build and Vercel Production completed successfully, the public alias serves clean `v0.12.2`, and Jeremy cleared the visual pass.

## v0.12.1 — Frozen-mahi regression fix

Status: patch on `v0.12.0`. Fixes a data-dependent freeze that surfaced only on the live (production Supabase) creature set, not the static/dev set.

### Creature behavior

- Fixes a mahi freezing in place, a regression from the `v0.12.0` school/solo unification (#62). That change classified movement as `isSchooling` (in a school) vs `isSoloAgent` (`species.schooling === false`), so a **schooling** species that failed to pair up matched *neither* mode: it never got a steering target, held its heading straight into a swim-bounds wall, and `clampToSwimBounds` pinned it there every frame (animating but not translating). A mahi ends up unschooled because `Biome.jsx` drops any group of `< 2` from schooling and mahi's `schoolMaxSize` is 2 — so an **odd** count of alive mahi in one `biome:depthZone` orphans exactly one. This is data-dependent: production held 5 alive mahi in `ocean:epipelagic` (→ pairs `[2] [2]` + a frozen `[1]`), while the static/dev seed has 4 (two clean pairs), so it never reproduced locally. Fix: `isSoloAgent` now covers *any* creature not currently in a school (`Boolean(species) && !isSchooling`), so an orphaned schooling fish roams on the solo-agent path (personal target + boundary-avoidance steering) instead of freezing; the designed solitary hunters (mako/mola) are unchanged and still solely own the agent debug readout. Note the same orphaning happens whenever a paired mahi dies (its partner becomes a live singleton), independent of any deploy. Verified in preview against the live data: all 5 mahi translate (net 4.5–13 WU over ~2s, smooth), the former orphan cruises freely, eslint/build clean.

## v0.12.0 — Unified boids movement

Status: accepted and promoted as clean `v0.12.0` from `v0.12.0-dev_12` after Jeremy reju (merged via #62).

### Creature behavior

- `v0.12.0-dev_12` unifies schools and solo agents onto one movement pipeline: every creature now runs the same per-frame steer → boids → turn-cap → integrate → clamp integrator, differing only in how its base desired heading is produced (schools: shared migration goal + formation slot; solo agents: personal roaming/authored target) and in species-shaped clamps. The solo agent is a "school of one" — its two-step capped steering, `soloAgentSpeed` fallback, and the entire `clampToSoloAgentRuntimeEnvelope` overshoot-envelope machinery (margins, probe, mola snap-and-retarget recovery) are deleted; the mako is held by the shared `clampToSwimBounds` + its surface ceiling, and now applies spine-bend turn intent (its `curveDeform.turnIntentScale` was authored but previously unread in the solo path). The mola keeps its authored layer on top of the unified integrator: sun-bask state machine (boids suppressed while active, approach-decel/exit-ramp now shape the shared integrator's speed), depth-residency targets, surface ceilings, a hard forward wall at the end of its authored target range (its front-excursion/bask targets extend past the shared zMax), and a soft rear wall — past it the negative-Z fade-out/snap/fade-in recovery still runs (`isMolaDeepZExit`). `boundaryAvoidanceTurnStep` now applies to the mola too (it was mako/school-only). Inert tuning fields removed: `turnRadius` (all species + default) and `soloSteeringTurnRateDegrees` (mako).
- `v0.12.0-dev_11` removes the last of the spline/path plumbing — no fish uses a `THREE.CatmullRomCurve3` anywhere anymore. Solo agents (mako/mola) had kept a vestigial path: a predictive debug curve rebuilt on every retarget (fed only the overlay deleted in dev_7), a `useState` spline used solely to seed the first-frame spawn position, and a legacy path-sampled follow-target fallback. Now: the three debug-path builds and their refs are gone; solo agents seed their first frame from a deterministic seeded point in bounds (`pickSoloAgentTarget`, mirroring the school spawn centre); the fallback follow-target projects ahead along the current heading; and `makeSwimPath`, `limitPathYGradient`, `traversalY`, `randomPoint`, `makeSoloAgentSteeringDebugPath`, `soloAgentSteeringTurnRate`, `SPLINE_MOVEMENT_ENABLED`, `randomSeed`, and their constants are deleted (~200 more lines). Verified in-preview: all 93 Open Sea fish spawn and move (mahi/sardines/mako, everyone below the surface, mako ≤ its ceiling); the mola spawns, cruises, runs its deep/front excursions and holds correctly at its surface ceiling at 10x. The sun-bask state machine is untouched apart from those dead viz lines (a natural bask wasn't rolled during verification — worth one visual confirm via the debug BASK button). Note: the `turnRadius` and `soloSteeringTurnRateDegrees` species fields are now inert (their readers were dead code); left in `species.js` pending the planned solo/school pipeline merge.
- `v0.12.0-dev_10` completes the mechanical dead-code sweep left by the boids swap: deletes ~660 lines of orphaned movement code from `Fish.jsx` — the unused spline/path builders (`makeSchoolPath`, `rotatedSchoolPoint`, `offsetFromSchoolPoint`, `makeSoloAgentPath`, `makeSoloAgentBezier`, `measureSoloAgentCurve`, `makeSoloAgentBoundaryGlidePath`, `makeSoloAgentRecoveryArc`, `makeSoloAgentForwardFallbackPath`, `soloAgentPathMeetsEndpointGate`, `pickSoloAgentDestination`, boundary-endpoint helpers, `limitAvoidanceAngle`, `currentSchoolDrift`), their ~45 orphaned constants (`SCHOOL_TRAVEL_ENABLED`, `SCHOOL_PHASE_WINDOW`, `REPULSER_DRIFT_*`, `SOLO_AGENT_CURVE_*`, `SOLO_AGENT_RETARGET_*`, `AGENT_BOUNDARY_GLIDE_*`, `SCHOOL_DRIFT`, …), scratch vectors, and the write-only `phase`/`driftPhase`/`driftSpeed` formation fields. No behaviour change; build clean, movement-related lint warnings 41 → 0 (2 unrelated pre-existing remain).
- `v0.12.0-dev_9` keeps the mako a visible presence in the main tank and removes its edge-snap. It had the widest roaming volume in the tank (`movementBoundsScale 1.48`, `boundsZMin -36`) with a ~41 WU turn radius, so it spent most of its time off-screen and, out at the far edges, overshot its envelope into hard clamps (the "tail drifting up/down at the screen edge"). Pulled the range in (`movementBoundsScale` 1.48→1.22, `boundsZMin` -36→-26) and sized the turn radius to the tighter box (`turnRadiusBodyLengths` 2.6→1.7) so it carves away from boundaries instead of overshooting. Verified: the mako now cruises as an on-screen centerpiece and its Z range stays within the new envelope (was reaching ~-38, now ~-22) with no far-edge snapping.
- `v0.12.0-dev_8` stops the follow cam kicking you out of the mako. While following a solo agent, its runtime-envelope recovery was suppressed and the *only* response to it reaching an envelope edge was to release focus (the "back in a bit!" notice) — so following the wide-roaming mako dropped you constantly, even while it was clearly on screen. That release made sense when recovery *teleported* the fish, but dev_5/dev_6 made the mako's boundary handling gentle. Now the mako gets its gentle surface + envelope clamp applied every frame (including while followed), so it stays inside its envelope and trackable, and the follow-release is gated to the mola only (whose snap / fade-out recovery genuinely needs it).
- `v0.12.0-dev_7` begins the post-boids dead-code cleanup: removes the schooling-spline debug overlay (the cyan predictive line, already gated off behind the disabled `SPLINE_MOVEMENT_ENABLED`) and its now-orphaned helpers (`makePathGeometry`, `splineGeometry`, `schoolMaxAvoidanceAngle`, `schoolDirectionResponse`). No behaviour change. The larger mechanical sweep (remaining unused solo-agent path builders and constants) and the solo-agent path-plumbing removal are tracked for a follow-up pass.
- `v0.12.0-dev_6` stops the mako swimming up through the water surface (a regression exposed by dev_5's gentler recovery). The mako's runtime-overshoot envelope adds a ~5.5 WU vertical margin above its swim bounds, putting its ceiling near y≈7.9 — well above the surface plane (y=4.6) — and only the mola had a surface ceiling. dev_5 removed the old recovery's hard downward shove, so the mako could now drift up and linger at that above-water ceiling. Added a generic surface ceiling for non-mola solo agents (`clampToSurfaceCeiling`) at `SURFACE_PLANE_Y - SOLO_AGENT_SURFACE_CLEARANCE` (2.0), applied every frame and flattening any upward heading so the mako glides along it instead of nosing through. Verified at 10x: mako max y = 2.60 (the ceiling), 0 frames above the surface, still diving its full range.
- `v0.12.0-dev_5` fixes the mako drifting vertically up and down when the sim is sped up (found at 10x after a while). The solo-agent runtime-envelope recovery, when a fast agent overshot its expanded envelope, snapped the position to the edge, forced the heading to the pure inward normal, and re-picked a target every frame — so a mako that overshot the vertical envelope got pointed straight in, snapped, then re-accelerated straight back out, thrashing vertically (position being *set*, not swum). Non-mola solo agents (the mako) now use the same gentle boundary handling as the boids schools: a plain position clamp back inside the envelope, letting steering + boundary-avoidance turning carve the heading away over the next frames — no forced heading, no per-frame re-target, so the snap loop can't form. The mola keeps its snap-and-retarget recovery (its authored surface/sun-bask behaviour relies on it). Verified: over ~240s of 10x sim the mako traverses its full vertical range smoothly (worst 1 direction-reversal per 2s, no snap-sized jumps) instead of thrashing.
- `v0.12.0-dev_4` finishes the mahi tail fix flagged in review (tail still bent while cruising). With `turnIntentScale` already 0, the `curveDeform` tail bend is driven purely by the actual per-frame turn rate (× 10.5) — so the mahi looked cocked because it was *continuously turning*: its `turnRadiusBodyLengths` of 2.8 gave a ~20 WU turn radius inside a ~27 WU-wide confined box, so a pair that reached a wall or corner could not out-turn it and orbited in place. Lowered `turnRadiusBodyLengths` 2.8 → 1.3 (a broad arc that still fits the bounds, so the mahi carves away and straightens) and `curveDeform.strength` 1.0 → 0.45 (gentle cruise-arcs barely bend the tail; genuine turns still bank). Measured mahi turn rate dropped from up to ~9°/frame (spinning) to ≤1.3°/frame with tail-bend intent ≤0.10 (essentially straight), no freeze or backward-swim, while sardine heading coherence stayed ~0.94 at rms ~2.1 WU.
- `v0.12.0-dev_3` tightens the school tuning after review feedback (schools too loose / facing random directions, mahi tails still cocked). Sardinella now form a coherent directional cloud: measured heading coherence ~0.95 (fish generally face the same way) at rms radius ~2.3 WU — looser than the old spline ball but tighter than the dev_2 scatter — via stronger alignment (0.16→0.38) with lighter separation (0.55→0.30) so separation stops fighting the formation slot. The mahi tail cock is driven by `curveDeform` bend, which sums the actual per-frame turn rate with a `turnIntent` (heading-vs-desired) term; under continuous boid steering that term stayed high and baked in a permanent sideways tail, so mahi `turnIntentScale` is now 0 (bend follows real turning only, like the mako). Also: formation-slot pull is scaled down for tiny schools so a pair travels parallel instead of orbiting their slots; the shared migration direction is low-pass filtered so per-frame goal re-picks don't accumulate into a constant turn; and school goals are inset from the walls so a wide-turning school (big body, tight bounds) banks away early instead of thrashing into a boundary it can't out-turn.
- `v0.12.0-dev_2` fixes two regressions from the dev_1 boids swap: schooling fish strung into a single-file conga line and the mahi held their tails cocked at a fixed angle. Both came from steering every member toward the same goal *point* offset by its formation slot in world axes — that funnels the group single-file and holds a permanent yaw. Schools now migrate along a shared *direction* (goal − live school centroid, leader-computed and identical for all members) so they travel parallel, and each fish is pulled toward its formation slot placed in the travel frame (right = perpendicular-to-heading, up = world Y) around the centroid, so the shape is designed rather than emergent — a single-file line is no longer a stable equilibrium. Boid separation/threat ride on top for anti-overlap and predator avoidance. Retuned the sardinella boids for the new model (separation 0.38→0.55, alignment 0.24→0.16, maxWeight 0.38→0.62). Measured: sardine along:lateral spread ratio 18:1 → ~1.2:1 (a rounded cloud), mahi tail-bend intent down to ≤0.18 (gentle bank, not a cocked C-curl), with no freeze or backward-swim regression.
- `v0.12.0-dev_1` removes the schooling spline entirely and moves schools onto pure boids, fixing the mahi-mahi freeze/backward-swim bug at its root. Schooling fish used to chase a follow-target sampled on a shared spline, with motion capped to the distance-to-target (no overshoot). The follow-target parameter `clamp(t + followDistance/pathLength, 0, 1)` saturated at the path endpoint whenever `followDistance` was large relative to the path — true for the big-bodied mahi in its confined bounds — so the target pinned to the curve's end, the fish caught up, and `targetDistance→0` froze it in place (turning/animating but not translating) until the leader regenerated the path; a fish nudged past the pinned target then swam backward to return. This replaces `getSchoolState`'s path/progress with a shared roaming **goal point** (the leader repicks it via `pickSoloAgentContinuationTarget` on arrival), and rewrites the school-follower step to steer toward that goal (offset per member by its formation slot) blended with first-class boid separation/alignment/cohesion, capped to a body-length turn arc, integrating velocity freely with no distance cap. Also deletes the `v0.12.0-dev` anti-stuck watchdog and the no-overshoot clamp that were band-aiding the freeze. Verified over sustained runs: no mahi freeze, zero backward-swim frames, sardine schools stay tight balls (rms radius ~1.7 WU) and mahi hold loose pairs.

## v0.11.0 — Visual/UI refinement

Status: accepted and promoted as clean `v0.11.0` after the visual/UI refinement pass and review fixes.

### Camera / follow

- Lowers the resting camera pitch and tightens the water-surface far fade so the ceiling no longer dominates the upper frame while preserving camera position, FOV, and scale-by-position.
- Follow mode now aims at an optional per-species body bone, supports closer zoom and full-yaw orbit at constant distance/FOV, and releases cleanly when switching tanks.
- Revalidates the cached follow bone after model remounts, fixing the camera becoming stranded when debug mode swaps fish materials. Missing configured bones fall back safely and produce a debug warning.

### Environment / UI / debug

- Makes the equirectangular background and god-ray pattern wrap seamlessly, fades god rays edge-on, fades the seabed rim, and blurs across the assembled wrap so orbiting exposes no obvious seam.
- Restricts direction, boid, and name overlays to the selected creature; removes deprecated drift/follow-target markers; and scales name labels with camera distance.
- Keeps the tank switcher clear of the debug toolbar and hides it on mobile while the creature info card is open.
- Disposes the imperatively-created floor material on biome change/unmount, preventing a shader/material leak.

## v0.10.0 — Boid schooling movement

Status: accepted and promoted as clean `v0.10.0` from `v0.10.0-dev_14` after Jeremy reju (merged from `feat/boid-schooling-overlay`).

### Creature behavior

- `v0.10.0-dev_14` widens the horizontal swim volume ~1.5x (`GLOBAL_X_DESTINATION_RANGE_SCALE` 0.9 → 1.35) so fish deliberately swim off-screen to the left/right — this hides hard-reset u-turns at the boundary and declutters the tank when crowded. Also widens turn radii (`turnRadiusBodyLengths`: sardine 1.3 → 2.0, mahi 1.6 → 2.8, mako 1.4 → 2.6, mola 1.2 → 2.0; default 1.6 → 2.5) so opposite-direction retargets sweep as wide arcs rather than tightening toward an on-the-spot rotation.
- `v0.10.0-dev_13` fixes the mahi still bending into a held C-curl during turns (the curve-deform, not the animation). Unlike the mako — whose `curveDeformTurnIntent` is never set (that assignment lives only in the school branch), so its bend is driven purely by the tiny per-frame turn rate — the mahi drove its spine bend from the *sustained heading misalignment*, which stays large through a whole wide-arc turn and saturated the 5-bone spine to near-max, holding a C-curl. Brought the mahi into the mako's gentle range: `maxAngleDegrees` 16 → 8, `turnIntentScale` 5.5 → 0.25 (net across dev_10/13), `strength` 1.55 → 1.0, so the spine reads as a subtle banking curve rather than a held curl.
- `v0.10.0-dev_12` stops the mahi tail spinning in circles during turns. The mahi mapped `turnLeft`/`turnRight` to the non-looping 5.61s `snap_left`/`snap_right` turn-sweep clips; under the new wide-arc turning a turn lasts several seconds, so the clip replayed repeatedly and swept the tail over and over. Mapped mahi turns to the looping `idle` swim clip instead (same approach the mako already uses), so the mahi swims continuously and banks through turns via curve-deform rather than replaying a sweep animation.
- `v0.10.0-dev_11` eases the mahi curve-deform bend back to straight as forward travel slows. School movement is clamped to the follow-target distance, so a mahi crawling out of a turn moves slowly while `velocity.current` still reads cruise — leaving the tail held in a full sideways bend while barely moving. Curve-deform now takes a `speedEase01` input (actual per-frame forward travel vs the intended cruise rate, smoothed) and, where a species opts in via `easeStraightenBySpeed`, scales the turn bend by it down to a `straightenFloor`. The mahi now straightens its tail before swimming on instead of waving one-sided against a locked bend.
- `v0.10.0-dev_10` fixes the mahi-mahi freezing in a C-curl while turning. Its `turnTriggerThreshold` was 0.03, so any gentle sustained arc fired the 5.61s non-looping `snap_left`/`snap_right` clip (held for its full duration), while `curveDeform.turnIntentScale: 5.5` saturated the 5-bone spine bend to max for any turn — and dev_9's clamp had frozen the tail oscillation on top. Now: the curve-deform clamp limits only the static turn bend (follow-through + idle sway stay additive, so the tail keeps waving through a turn); the mahi turn trigger is raised to 0.3 so gentle arcs stay on the looping idle swim clip and bank via curve-deform instead of snapping; and the mahi spine bend scales with actual turn magnitude (`turnIntentScale` 5.5 → 2.2, `strength` 1.55 → 1.2) for a gentle bank rather than a full curl. The mako already maps its turns to the idle loop, so it was unaffected.
- `v0.10.0-dev_9` addresses movement nuances from review. Pitch now reflects actual vertical travel each frame instead of the direction to the target, so a creature hovering along the XZ plane reads level rather than head-up/tail-down (swim-bladder-dysfunction look); it still pitches into genuine ascents/descents. Clamps the turn-driven curve-deform bend per bone to the configured `maxAngle` so `chainMultiplier`/follow-through can no longer over-rotate mahi/mako tail bones into a kink on sharp turns. Solo-agent (mako/mola) turns are now purely body-length arc-radius based — the old fixed-degree cap turned slower than the radius implied, giving an even wider effective radius so the shark swept along tank boundaries instead of completing a forward arc; it now banks through turns at swim speed. Adds depth diversity: deepened per-species `boundsYMin` by ecology (mahi surface-associated stays shallow; mako and mola dive deep) and widened the school vertical path traversal, so creatures spread through the water column and periodically leave frame instead of clustering mid-screen.
- `v0.10.0-dev_8` fixes schools clumping in place after the spline was disabled: schools again travel toward a real destination (the shared school path's far exit, reached through its intermediate waypoints), with boids only adjusting the local formation on top — position stays boid-driven, so it is a soft destination, not the old rigid path-lock. Adds body-length turn-radius kinematics: heading changes are capped to a forward arc of `turnRadiusBodyLengths * bodyLength` (angular rate = speed / radius) for both schooling fish and solo agents, so creatures bank through turns instead of pivoting or strafing (per-species `turnRadiusBodyLengths`; `>=1` arcs, `<1` reserved for a future spin-in-place creature). Cuts over-frequent swim SFX by raising the global throttle: ambient swim sounds now gap at 1.15s while the followed creature stays responsive at 0.3s.
- `v0.10.0-dev_7` protects authored behaviors from boid interference: while a solo agent runs the mola sun-bask (approach, hold, or exit) its boid steering is fully suppressed so the authored animation owns the path, and the committed boid vector decays out so it does not snap back in when the behavior ends.
- `v0.10.0-dev_6` reworks the boid debug overlay so the system is legible: the focused fish (selected creature or any solo agent) draws a line to each remembered neighbor colored by relation — green = following, red = avoiding, gray = neutral — plus a cyan tick at each neighbor showing which way it is heading, and a magenta threat-avoidance vector for the observer. Neighbor webs are limited to the focused fish so a school no longer webs into an unreadable tangle; sampled schoolmates still show the aggregate separation/alignment/cohesion/threat vectors and a readout.
- `v0.10.0-dev_5` fixes the "jitter every half second" by committing each fish to a boid decision for roughly one animation cycle (clamped, per-fish jittered) instead of re-steering every frame, and by selecting a stable nearest-N neighbor set rather than whatever the registry iterated first. Adds a species reaction hierarchy: each species carries `menace` (how threatening it reads) and `wariness` (how strongly it reacts), so prey flee the mako at a wide radius while nobody minds the mola.
- `v0.10.0-dev_4` disables spline/path-follow movement. Schools keep their seeded initial spread, then swim from their own current heading plus boid separation/alignment/cohesion; debug no longer draws the old cyan spline line.
- `v0.10.0-dev_3` adds boid debug visualization in debug mode: selected fish, sampled school fish, and solo agents show separation, alignment, cohesion, and final boid steering vectors plus neighbor/social weight readouts.
- `v0.10.0-dev_2` removes the previous standalone soft-separation path and folds separation into the generic boid system. Boid steering now runs for schooling and solo species, considers interspecies neighbors, and uses species-biased parameters: sardines are tight/high-neighbor, Mahi-mahi are capped to one neighbor with weak pair influence, and Giant Sunfish barely avoids others while strongly repelling nearby fish.
- `v0.10.0-dev_1` prototypes a local boid overlay for schooling fish: existing shared school paths still provide the calm ocean-current route, while nearby schoolmates add capped alignment and cohesion steering on top of the existing soft separation avoidance. The goal is sardine schools that feel less spline-choreographed and more like many local decisions without turning chaotic.

## v0.9.0 — Tank assemblages & curation

Status: accepted and promoted as clean `v0.9.0` after Jeremy approval (merged via #57). See `docs/tank-design.md`.

### Tanks / curation

- A "tank" is no longer a whole biome dumped on screen. Introduced a `TANKS` curation layer (`src/data/species.js`): each tank borrows a biome for its environment but lists its cast explicitly by species id. `Biome` now renders `creaturesForTank(creatures, tank)` (`src/utils/speciesLookup.js`) instead of `c.biome === name`, falling back to the old biome filter when no tank is passed.
- Split the pelagic roster into two coherent tanks: `The Open Sea` (spotted sardinella bait → mahi-mahi → shortfin mako, a single-tempo pursuit food chain) and `The Drift` (giant sunfish alone), resolving the "rojak" mix of a slow drifter among fast hunters.
- Added a `tempo` field (`drift`/`cruise`/`sprint`) to each species and a dev-only coherence guard that warns when a tank mixes drifters with fast swimmers.
- `TankView` header now shows the tank name; `App` tracks `activeTankId` and renders a bottom-center tank switcher (only when more than one tank exists).

## v0.8.20 — Underwater depth & atmosphere review

Status: accepted and promoted as clean `v0.8.20` from `v0.8.20-dev_1` after Jeremy approval.

### Environment / atmosphere

- `v0.8.20-dev_1` reworks the ocean sunlight-zone depth read: `scene.background` now uses a dedicated deep-ocean-blue gradient (luminous surface band falling to dark mid/lower water) kept separate from the brighter environment map that lights the creatures, so the empty upper column reads as lit water instead of a flat void without under-lighting the animals. Distance fog is retuned to a deep-blue haze so far creatures desaturate into scattered light (aerial perspective) rather than fading to black. Palette pulled from teal toward pure ocean blue. The backdrop is painted at higher resolution with soft organic light mottling (large caustic-style light/dark patches) plus a blur pass, which gives the water depth/variation instead of a flat gradient and eliminates the horizontal 8-bit banding without introducing per-pixel grain. A `.tank-depth-absorption` multiply overlay (counterpart to `.tank-top-exposure`) darkens the lower field so light visibly dies with depth across both water and creatures. Tank UI without an explicit stacking level (desktop info card, biome title/zone label, follow hint) now sets `z-index: 30` so it renders above the screen-space water overlays (`z 4`) and below interactive chrome (`z 55+`).
- Marine snow / suspended particulate raised from 96 to 240 particles and redistributed down into the creature/camera zone (previously confined above it), with a slow net sink and a height-based glow so particles high in the column catch more downwelling light.
- God-ray shafts now fan out from an off-screen upper-left sun instead of marching as identical parallel bands, and gain a finer grain octave so they read as volumetric light rather than a clean decal.

### Camera

- Eased the resting default view from a ~20° up-pitch (which pinned creatures to the bottom edge) to ~10° up (`lookY` `0.35` → `-1.5`), so animals can swim into the top half of frame while the surface band and god rays still crown the top.

### Creature data / scale

- Giant Sunfish (`Mola alexandrini`) render scale raised to its factual maximum: `bodyLengthWU` `9.6 → 13.2` (≈3.3 m, matching the Atlas female average) and GLB `scale` `0.464 → 0.638`. It now visibly dwarfs the mahi-mahi; normalized individual size maps to ≈248–330 cm. The prior 2.4 m review cap is removed. Sardine, mahi-mahi, and mako scales verified factually proportionate and unchanged.

## v0.8.19 — Shortfin Mako Shark review

Status: accepted and merged directly to `main` from `v0.8.19-dev_3` (`79dccfe`) after animation/movement smoothing. The shark is live and was subsequently integrated into the tank assemblage and unified boids movement releases.

### Creature data / Atlas / asset

- `v0.8.19-dev_3` slows mako solo-agent steering/velocity changes, raises the turn trigger threshold, layers the authored burst clip softly over the continuous swim loop, and adds a subtle procedural spine/tail sway so the shark always reads as swimming instead of rigidly snapping between headings.
- `v0.8.19-dev_2` keeps mako burst movement but maps the visible burst animation back to the continuous `idle` swim loop and lengthens the model fade, avoiding the supplied `burst` clip's pose discontinuity/snap during tank transitions.
- `v0.8.19-dev_1` imports Jeremy's Shortfin Mako Shark GLB (`Isurus oxyrinchus`), adds a solitary pelagic predator species profile, one static-dev review creature, Atlas source-length scaling/pose data, and a first-pass solo movement profile with long glides and rare burst acceleration.

## v0.8.18 — Push-away boundary review

Status: accepted and promoted as clean `v0.8.18` from `v0.8.18-dev_3` after Jeremy approval.

### Movement boundary / framing

- `v0.8.18-dev_2` restores the default camera and follow-distance constants from `v0.8.17`; camera position and follow zoom are no longer changed.
- `v0.8.18-dev_3` pushes the swim boundary start/end Z planes `15 WU` farther from the camera by applying `SWIM_BOUNDARY_Z_OFFSET_FROM_CAMERA = -15` to both default and species-specific `boundsZMin`/`boundsZMax`.
- The hard solo-agent runtime envelope still derives from those shifted bounds, so reset/clamp behavior moves with the swim volume instead of fighting the new presentation.
- Clean `v0.8.18` ships the accepted `-15 WU` swim-volume offset while preserving the original camera and follow zoom constants.

## v0.8.17 — Speed Insights review

Status: accepted and promoted as clean `v0.8.17` from `v0.8.17-dev_1` after Jeremy approval.

### Observability

- Adds Vercel Speed Insights client injection beside the existing Vercel Analytics hook so deployed public builds can collect performance metrics.


## v0.8.16 — Creature sex + dimorphism review

Status: accepted and promoted as clean `v0.8.16` from `v0.8.16-dev_3` after Jeremy approval.

### Creature data / Atlas

- `v0.8.16-dev_3` imports Jeremy's returned Atlas CSV copy edits, including Sardinella adult length range and simplified social/reproduction/lifecycle wording.
- `v0.8.16-dev_2` assigns `sex` for every active creature row, including non-dimorphic species, while only sexually dimorphic model variants affect GLB selection.
- `v0.8.16-dev_1` adds a nullable `sex` creature field for Supabase `creatures` and `creatures_dev`, maps Mahi-mahi male/female rows to the matching GLB variants, shows sex on the follow info card, and adds Atlas sexual-dimorphism copy for each species. Non-dimorphic species ignore sex at the model layer.
- Clean `v0.8.16` ships creature sex across all active Supabase rows, Mahi-mahi sex-driven GLB selection, and the accepted Atlas dimorphism/copy edits.


## v0.8.15 — Mahi-mahi curve deformation review

Status: accepted and promoted as clean `v0.8.15` from `v0.8.15-dev_15` after Jeremy approval.

### Creature behavior

- `v0.8.15-dev_2` keeps accepted Mahi-mahi translation speeds and authored 1× GLB playback, then layers a controllable additive spine deformation after the animation mixer. The deformation reads path/spline turn pressure, distributes a subtle bend through `spine.001`–`spine.007`, adds a small tail-follow-through phase, and exposes model-level strength/response/max-angle/tail-bias/burst-boost tunables for review rollback or dialing.
- `v0.8.15-dev_3` increases the visible deformation after Jeremy review: stronger turn-pressure input, a higher safe max bend, faster response, more body-wide/tail follow-through, and stronger burst/speed boost while still preserving accepted translation speeds and authored 1× clips.
- `v0.8.15-dev_4` fixes the actual visibility bug: the GLB loader resolves Mahi spine bone names as `spine001`–`spine007`, so the dotted config names were not matching; it now normalizes bone names and bends on the rig's local `z` axis instead of twisting around the forward axis.
- `v0.8.15-dev_5` emergency-disables Mahi curve deformation (`strength: 0`) after review caught catastrophic accumulated spine bending in `dev_4`; keep the accepted authored animation / movement baseline safe while the additive deformation path is reworked.
- `v0.8.15-dev_6` restores visible Mahi curve deformation with a non-accumulating additive pass: each frame removes the previous additive only when it is still present, then applies a fresh local-`z` side-bend to the resolved spine chain. Strength is re-enabled at a safer visible range (`0.82`, max `9°`).
- `v0.8.15-dev_7` adds a debug bone overlay for curve-deform rigs: debug mode now defaults the `B` layer on, drawing the resolved spine chain and runtime bone names over Mahi-mahi so reviewers can see exactly which bones the deformation targets.
- `v0.8.15-dev_8` retargets bone debug to selected-creature inspection: smaller labels, all resolved GLB bones for the selected creature, no bone overlay in `View all`, and selected schooling fish now show their shared movement/follow spline even when they are not the school leader.
- `v0.8.15-dev_9` adds male/female model variants for Mahi-mahi and general school-level sex-variant assignment: schools with both sex models available receive an approximately balanced mix, with Mahi-mahi pairs resolving to exactly one male and one female.
- `v0.8.15-dev_10` makes selected-creature bone-name labels camera-facing billboards, unbold/normal weight, and front-rendered so bones stay legible over the fish mesh.
- `v0.8.15-dev_11` shrinks selected-creature bone-name labels to match the normal selected-name label font size while preserving billboard/front-render behavior.
- `v0.8.15-dev_12` moves model forward-vector debug lines to the configured head/nose offset instead of the model root, clarifying that Mahi GLB origins sit near mid-body while the debug heading starts at the nose.
- `v0.8.15-dev_13` increases Mahi spline deformation and limits additive bend targets to `spine003`–`spine007`, keeping the forward head/root bones out of the deformation chain.
- `v0.8.15-dev_14` makes Mahi curling respond to sustained turn intent toward the follow spline, adds a base bend on `spine003`, and strengthens rear-spine curl so turns read as body bending instead of straight-body rotation.
- `v0.8.15-dev_15` adds a 1.05× per-bone chain multiplier to Mahi curve deformation, smooths visual pitch changes to remove random pitch snaps, and makes newly generated school splines preserve their incoming direction with the first turn pushed away from the spline start for all schooling fish.
- Clean `v0.8.15` ships the accepted Mahi-mahi curve-deformation pass: authored GLB animation remains intact, additive bend is limited to `spine003`–`spine007`, turns use sustained follow-spline intent, debug bone/forward-vector tools are readable, Mahi pairs can use male/female variants, and schooling splines now continue smoothly across regenerated paths.

## v0.8.14 — Follow-camera retargeting

Status: accepted and promoted as clean `v0.8.14` from `v0.8.14-dev_1` after Jeremy approval.

### Camera / controls

- `v0.8.14-dev_1` fixes follow-camera retargeting: tapping another fish while already following now switches directly to that fish instead of first exiting follow mode. Follow orbit still captures the pointer after drag movement crosses the orbit threshold, so orbit-release over another fish remains protected from accidental retargeting.
- Clean `v0.8.14` ships the accepted follow-camera retargeting fix.


## v0.8.13 — Mobile release fallback hotfix

Status: accepted and promoted as clean `v0.8.13` from `v0.8.13-dev_1` after Jeremy approval.

### Creature data / mobile smoke

- `v0.8.13-dev_1` prevents a clean deployment with missing browser Supabase env vars from rendering a visually empty tank by falling back to bundled release creature rows only for the missing-env case. If Supabase is configured but empty or errors, clean builds still do not silently replace that result. The bundled fallback now mirrors the released production counts: 88 `amblygaster-sirm`, 1 `mola-alexandrini`, and 4 `coryphaena-hippurus`.
- Clean `v0.8.13` ships the mobile empty-tank hotfix so the public release shows fish even on deployments missing browser Supabase env vars, while preserving real Supabase data as the source of truth when configured.


## v0.8.12 — Mahi-mahi adult movement review

Status: accepted and promoted as clean `v0.8.12` from `v0.8.12-dev_13` after Jeremy approval.

### Creature behavior

- `v0.8.12-dev_1` removes adult Mahi-mahi from the schooling system and routes it through the solo-agent movement path used by Giant Sunfish, tuned much faster for confident adult pelagic passes. Atlas/social copy now frames adults as solo/pair travelers while noting juvenile schooling.
- `v0.8.12-dev_2` adds Mahi-mahi back into The Atlas for review now that Jeremy wants the species visible there again.
- `v0.8.12-dev_3` fixes glitchy Mahi-mahi turning by driving authored turn/burst triggers from the live visual forward vector instead of the stale debug-path end tangent, and gives Mahi-mahi a faster solo steering turn rate so it swims into turns instead of broad drifting.
- `v0.8.12-dev_4` fixes the Mahi-mahi screen-blitzing regression: solo-agent targets now limit vertical jumps from the current position, and Mahi-mahi cruise/snap/burst speeds are reduced to read as forward pelagic passes instead of full-screen up/down dashes.
- `v0.8.12-dev_5` fixes the follow-up Mahi-mahi solo-agent glitches: runtime recovery now clamps to the expanded solo envelope instead of snapping back to inner swim bounds, Mahi-mahi live turns stay on the continuous swim loop instead of snap-left/right clips, and burst movement no longer outlasts the authored burst animation.
- `v0.8.12-dev_6` adds Jeremy's supplied Mahi-mahi portrait as the Atlas species-list thumbnail, normalized to the existing 502×502 Atlas thumbnail convention.
- `v0.8.12-dev_7` retunes Mahi-mahi authored animation playback: GLB clips now play at 1× without global/random/velocity time scaling, snap-left/right turn clips are restored with a shorter blend, and solo U-turns slow down while steering faster so the fish turns through the arc instead of sliding backward.
- `v0.8.12-dev_8` moves Mahi-mahi off the failed solo-agent path and onto the proven shared group movement, capped at two fish per pair. The GLB clips remain in-place: idle is the default loop, burst/turn clips are accents with separate forward translation, and normal banking stays on idle. Static-dev fallback now carries ten `coryphaena-hippurus` rows so local/no-env review also forms pairs.
- `v0.8.12-dev_9` fixes Mahi-mahi snap-turn playback without retiming the authored GLB clips: turn movement still uses the short simulation impulse, but `snap_left` / `snap_right` now stay selected for their full authored 5.0417s duration instead of being interrupted after the 1.05s movement impulse.
- `v0.8.12-dev_10` sets global fish GLB playback back to 1× and clamps per-individual animation speed variation to 0.9×–1.1× across species. Spotted sardinella burst/snap animation holds now cover the full clip at the slowest allowed individual speed, so authored clips are not cut off while movement impulses remain short.
- `v0.8.12-dev_11` fixes one-shot authored clips freezing on their final frame: after a snap/burst hold expires, fish now return to their cruise/drift loop when no new action is triggered, instead of staying stuck if the trigger window is open but idle conditions are calm.
- `v0.8.12-dev_12` aligns Mahi-mahi burst movement to the authored burst clip: the clip starts first, the forward speed impulse waits 0.45s for the visible body action, and the burst clip is held for its full authored duration instead of being cut at the movement impulse.
- `v0.8.12-dev_13` makes authored action movement timing a named model override with a default of 0s, and increases the Mahi-mahi burst movement delay override to 0.8s so the speed impulse lands later in the authored burst action.
- Clean `v0.8.12` ships the accepted Mahi-mahi adult behavior: loose pair-group movement, authored 1× GLB playback with 0.9×–1.1× individual variation, full-duration snap/burst clip holds, explicit burst movement delay override, and Atlas visibility restored for the species page.

## v0.8.11 — Atlas release gating hotfix

Status: hotfix on `main` after `v0.8.10`.

### Interface / encyclopaedia

- Hides unreleased species entries from The Atlas and removes their follow-card Atlas shortcut, starting with `Coryphaena hippurus` / Mahi-mahi until that Atlas page is explicitly ready for release.

## v0.8.10 — Mahi mahi

Status: accepted and promoted as clean `v0.8.10` from `v0.8.8-dev_16` after Jeremy approval; clean target advanced because `v0.8.9` camera polish landed on `main` first.

### Creature roster

- `v0.8.8-dev_1` starts the Mahi mahi feature branch from clean `v0.8.7`, carrying the supplied model asset into species, behavior, and Atlas review.
- Adds `Coryphaena hippurus` / Mahi-mahi to the active species roster with Jeremy's supplied GLB, three static-dev review creatures, a source-safe Atlas entry, and model moves wired to `idle`, `burst`, `snap_left`, and `snap_right`.
- Tunes Mahi-mahi as loose-schooling epipelagic hunters: larger spacing than sardines, faster readable cruise/burst speeds, wider open-ocean bounds, and less twitchy turns than the sardine school.
- `v0.8.8-dev_2` responds to Jeremy's review by shrinking tank-view Mahi-mahi specimens and spreading the school farther apart, with wider turn radius/lower erraticness to avoid on-the-spot spinning.
- `v0.8.8-dev_3` restores visible Mahi-mahi snap-left/right turns after the smoother `dev_2` path made tangent-change triggers too rare: lower turn threshold, shorter held turn action, and slightly more live path variation without returning to tight spinning.
- `v0.8.8-dev_4` calms the overcorrected turn feel: ordinary course changes are movement/bank-led again, snap clips require larger turns, fade in/out softer, and turn accents are brief instead of held.
- `v0.8.8-dev_5` updates Mahi-mahi sizing to Jeremy's 1.8 m max / 0.91 m average, with normalized individual DB sizes distributed around the average instead of uniform stepping.
- `v0.8.8-dev_6` softens Mahi-mahi turns after review: wider path radius, lower erraticness, rarer snap triggers, shorter turn holds, and slower animation fades so the school arcs instead of cutting hard corners.
- `v0.8.8-dev_7` makes Mahi-mahi schooling forward-led: avoidance is constrained to a narrow forward cone and direction changes are smoothed so each fish swims into the turn instead of sliding, strafing, or backing through it.
- `v0.8.8-dev_8` updates the Atlas staging: Mahi-mahi uses Jeremy's diver silhouette position/opacity, and sardine/Mahi-mahi entries add smaller mid/background companions around the centered hero fish.
- `v0.8.8-dev_9` adjusts the Mahi-mahi Atlas diver silhouette to Jeremy's approved staging position `[0.5, 0.45, -0.85]` at `0.38` opacity.
- `v0.8.8-dev_10` desynchronizes Atlas schooling groups with per-fish animation phase, playback speed, and burst timing offsets, and applies Jeremy's latest Mahi-mahi/Giant Sunfish diver silhouette placements.
- `v0.8.8-dev_11` updates Atlas lifecycle facts from Jeremy's notes: Mahi-mahi maturity/sterility/spawn-egg range and spotted sardinella estimated maturity/unknown sterility.
- `v0.8.8-dev_12` uppercases Atlas species-list common names so the left selection column matches the right info-panel heading style.
- `v0.8.8-dev_13` adjusts spotted sardinella Atlas group composition from Jeremy's marked screenshot: pushes the upper-left companion deeper behind the diver silhouette.
- `v0.8.8-dev_14` restores the spotted sardinella hero position and moves the deeper background companion downward so it reads behind the hero instead of hidden behind it.
- `v0.8.8-dev_15` moves that deeper spotted sardinella background companion farther down after Jeremy's follow-up mark.
- `v0.8.8-dev_16` corrects the marked spotted sardinella companion: restores the left-deep companion and moves the lower-left background companion farther down beneath the hero.
- Target feel: fast, confident pelagic cruising with readable flashes and turns — elegant movement, not generic fish drift.

## v0.8.9 — Camera position polish

Status: accepted and promoted as clean `v0.8.9` after Jeremy approval.

### Camera / debug

- `v0.8.9-dev_1` starts a separate camera-position branch from clean `v0.8.7`, lowers the default tank camera, angles the look target upward for a standing-at-the-tank read, and adds debug sliders for camera height, distance, look height, FOV, and experimental depth-of-field focus/aperture/blur.
- `v0.8.9-dev_2` fixes the empty-scene regression by mounting the experimental DOF postprocess only when the debug panel explicitly enables it, so normal tank rendering does not instantiate the composer/pass stack.
- `v0.8.9-dev_3` makes the camera debug bar wrap/scroll vertically on cramped screens and adds `Shift Y`, a true vertical camera translation slider that moves both camera height and look target together instead of changing only the view angle.
- `v0.8.9-dev_4` bakes Jeremy's approved camera framing into the tank defaults (`y=-6.35`, `z=10`, `lookY=-2.65`, `fov=61`) and removes the temporary camera/DOF debug controls from the debug toolbar.
- `v0.8.9-dev_5` fixes the phone blank-scene regression by baking the approved camera slider values without double-applying the temporary `Shift Y` translation on narrow viewports (`y=-3.35`, `z=10`, `lookY=0.35`, `fov=61`).
- Clean `v0.8.9` ships the accepted lowered tank camera framing with the temporary camera/DOF debug tools removed.

## v0.8.7 — Atlas thumbnail polish

Status: accepted and promoted as clean `v0.8.7` from `v0.8.7-dev_3` after Jeremy approval.

### Interface / encyclopaedia

- `v0.8.7-dev_1` adds Jeremy's supplied sardine-school artwork as the Spotted Sardinella Atlas thumbnail.
- `v0.8.7-dev_2` widens the desktop Atlas species list so `Spotted Sardinella` does not clip beside its thumbnail.
- `v0.8.7-dev_3` preserves the Atlas WebGL drawing buffer so screenshot capture includes the 3D model and diver silhouette.

## v0.8.6 — UI overhaul + encyclopaedia

Status: accepted and promoted as clean `v0.8.6` from `v0.8.6-dev_62` after Jeremy approval.

### Interface / encyclopaedia

- `v0.8.6-dev_1` starts the isolated UI overhaul + encyclopaedia feature branch from clean `v0.8.4` so navigation, creature information architecture, and reading flow can iterate separately from species work.
- `v0.8.6-dev_2` adds the first encyclopaedia mockup: top-right gallery entry, left species list with thumbnails, central 3D/species-scale stage, right field-guide info panel, human-scale placeholder, and an info-card button from followed fish.
- `v0.8.6-dev_3` removes the generic Large Predator species placeholder entirely and removes the floor disc from the encyclopaedia 3D viewport.
- `v0.8.6-dev_4` renames the feature to Oceanpaedia, removes redundant panel labels, and fixes the model viewer to a non-orbiting side profile with per-species pose overrides for future angle tuning.
- `v0.8.6-dev_5` renames the page and entry points from Oceanpaedia to The Atlas.
- `v0.8.6-dev_6` adds the supplied epipelagic sunlight-water backdrop to The Atlas viewport for epipelagic species.
- `v0.8.6-dev_7` replaces the corner human-scale placeholder with Jeremy's diver silhouette placed inside the viewport beside the fish, using a head-comparison crop for very small species.
- `v0.8.6-dev_8` plays Atlas model idle clips in place and triggers occasional in-place burst clips without viewport translation.
- `v0.8.6-dev_9` removes the rejected Atlas model animation experiment and replaces the supplied photo backdrop with the live ocean tank backdrop stack, without tank fish or UI.
- `v0.8.6-dev_10` restores the Atlas in-place idle/burst animations, keeps the tank backdrop, and moves the diver scale reference into the lower-right Mola comparison area using a 1.7 m human scale.
- `v0.8.6-dev_11` moves the sardine diver-scale silhouette behind the fish body instead of cropping it against the left edge, matching Jeremy's marked comparison layout.
- `v0.8.6-dev_12` replaces the diver PNG with Jeremy's SVG on a Three.js mesh plane, scales the Atlas fish and diver from species max body length, labels the stat as max body length, and caps small-fish display size so sardines do not fill the viewport.
- `v0.8.6-dev_13` reduces the diver mesh opacity to a subdued reference silhouette and adds an IUCN Red List conservation-status bar to the Atlas info panel.
- `v0.8.6-dev_14` makes the diver mesh double-sided and camera-facing so it cannot vanish from backface/axis changes, then shifts the Atlas camera 15° left and 15° upward for a slight front-left, top-down fish view.
- `v0.8.6-dev_15` makes the diver silhouette visibly render against the dark tank backdrop with a pale translucent mesh material, and turns the Atlas camera another 15° left for a 30° front-left view.
- `v0.8.6-dev_16` switches the Atlas diver scale reference to a camera-facing sprite using the supplied SVG texture, normalizes the SVG fill to tint correctly, raises its opacity, and disables depth testing so it remains visible in front of the dark tank viewport.
- `v0.8.6-dev_17` rasterizes the supplied diver SVG into a PNG texture and uses that PNG for the Atlas sprite so browser/WebGL SVG-texture handling cannot hide the scale reference.
- `v0.8.6-dev_18` replaces the Atlas diver texture with Jeremy's new PNG, normalizes it to a black silhouette, and lowers the sprite opacity so it reads as a quieter scale reference.
- `v0.8.6-dev_19` sanitizes Atlas GLB materials to render opaque front faces with depth writes, preventing Mola's opposite eye/interior surfaces from showing through the head.
- `v0.8.6-dev_20` lowers the Atlas diver silhouette and places it behind the fish with depth testing so creature bodies occlude the scale reference instead of being covered by it.
- `v0.8.6-dev_21` adds a debug-gated Atlas diver pose editor with X/Y/Z/opacity sliders, per-species localStorage persistence, reset, and copyable pose JSON for committing reviewed placements.
- `v0.8.6-dev_22` moves Atlas pose-editor activation to `Ctrl+Shift+D`, shows the Atlas version label in the overlay, and squares/full-bleeds the Atlas panels while keeping thin borders.
- `v0.8.6-dev_46` tightens followed-creature atlas-card copy while staying on the Atlas branch: quick facts are split into terse Biome / Zone / Diet / Social fields, depth/measurement labels are shortened, and empty individual notes use a neutral placeholder without removing the top-right Atlas entry or info-card Atlas button.
- `v0.8.6-dev_58` source-safes the Atlas species copy: `Amblygaster sirm` now reads as spotted sardinella with coastal/lagoons schooling context, while sparse `Mola alexandrini` social and reproduction fields stay `Unknown` instead of speculative.
- `v0.8.6-dev_59` replaces the prior unknown placeholders with Jeremy's supplied Atlas fact sheet for spotted sardinella and bumphead sunfish, and formats sub-kilogram masses / decimal-meter lengths cleanly in the Atlas tables.
- `v0.8.6-dev_60` adjusts the follow-card shell and title row for the longer bumphead sunfish common name: wider card, no common-name wrap, smaller name-to-Atlas-icon gap, and a slightly more compact icon.
- `v0.8.6-dev_61` changes the displayed common name for `Mola alexandrini` to `Giant Sunfish`, folds the other common names into the general species description, and relaxes the follow-card Atlas icon spacing after review.
- `v0.8.6-dev_62` limits the `Giant Sunfish` general description to two alternate common-name mentions while retaining the broader alternate-name list for search/reference data.
- Target feel: quiet field-guide clarity layered over the aquarium, not a menu-heavy game UI.

## v0.8.5 — Follow mode stability

Status: accepted and promoted as clean `v0.8.5` from `v0.8.5-dev_3` after Jeremy approval.

### Camera / controls

- `v0.8.5-dev_1` keeps follow mode centered on mobile by removing the phone info-card camera framing bias and immediately zeroing any cropped-stage pan when a creature is focused.
- Suppresses creature reselection after follow-orbit drags by pointer-capturing the orbit drag and ignoring creature focus events for a short release window, so releasing over another fish does not steal follow mode.
- `v0.8.5-dev_2` applies the same release-window suppression to follow zoom gestures: mobile pinch zoom and follow-mode wheel zoom now ignore creature focus events briefly after zooming, so lifting a finger over another fish does not switch targets.
- `v0.8.5-dev_3` lets the follow gesture system recover after touch-up on a fish by handling touch end in capture before fish selection swallows the event, then clearing stale pinch state after a short delay so the next finger-down can orbit/zoom again.


## v0.8.4 — Creature moments repulser v1

Status: accepted and promoted as clean `v0.8.4` from `v0.8.4-dev_4` after Jeremy approval on desktop/mobile feel.

### Creature behavior

- Starts the creature-moments bucket with a species-level `repulser` flag: Mola is a repulser and sardines default false.
- `v0.8.4-dev_1` adds smoothed schooling drift away from nearby repulser creatures so sardines can softly part around the Mola instead of abruptly snapping away.
- `v0.8.4-dev_2` makes the debug follow-target marker lerp from yellow to red as repulser drift increases, then back to yellow as the school returns to its normal target.
- `v0.8.4-dev_3` temporarily added a debug-panel `repel` demo button so the effect could be reviewed without waiting for a Mola crossing.
- `v0.8.4-dev_4` removes that forced demo trigger after Jeremy accepted repulser v1; the natural Mola-proximity repulser drift remains.
- Keeps the response horizontal, biome-local, and utility-tested so the feel can be tuned without cluttering the per-frame fish loop.
- Defers the separate follow/trail creature-moment idea to a later iteration instead of blocking this clean repulser v1 release.

## v0.8.3 — Code hygiene and debug-runtime cleanup

Status: accepted and promoted as clean `v0.8.3` from `v0.8.3-dev_11` after Jeremy approval.

### Performance / code hygiene

- Cleanup stack continues the post-`v0.8.2` code-hygiene bucket by extracting shared species/hash/body-length helpers so creature identity and scale logic lives in one place.
- Starter cleanup removes confirmed-unused starter-era components and assets.
- `v0.8.3-dev_2` moves the debug panel into a bottom horizontal bar and changes debug copy/counts from sardine-specific wording to creature-level LOD/frustum readouts; single-model creatures count as LOD0.
- `v0.8.3-dev_6` removes the remaining follow-camera snapback path by preserving orbit/distance when the already-selected creature receives a duplicate pointer-up/click selection after an orbit drag.
- `v0.8.3-dev_7` makes mobile debug usable as a compact two-row strip: essentials readout on top, horizontally scrollable controls below, and audio meters collapsed out of the phone layout.
- `v0.8.3-dev_11` keeps the normal mobile version label compact by showing only the version string while preserving the full `world oceanarium` label on desktop.

## v0.8.2 — Follow-camera orbit polish

Status: accepted and promoted as clean `v0.8.2` from `v0.8.2-dev_2` after Jeremy approval.

### Camera / controls

- Starts the post-`v0.8.1` patch bucket for follow-camera orbit polish.
- `v0.8.2-dev_1` keeps drag-to-orbit constrained but persistent after pointer release, removing the snapback to centered follow framing.
- `v0.8.2-dev_2` changes follow-orbit dragging to incremental pointer deltas, so starting a new drag while already clamped at the yaw/pitch limit does not jump back toward center.
- Widens horizontal follow orbit slightly to ±36° while keeping vertical pitch at ±30° for safer surface/body framing.

## v0.8.1 — Mola recovery polish

Status: accepted and promoted as clean `v0.8.1` from `v0.8.1-dev_6` after Jeremy approval.

### Creature behavior

- Starts the post-`v0.8.0` patch bucket for Mola runtime recovery polish.
- `v0.8.1-dev_1` restricts the slow Mola fade-out/fade-in recovery to only the far negative-Z hard-recovery envelope. X-axis runtime envelope recovery now uses immediate hidden retarget/clamp behavior instead of the depth-disappearance fade.
- Adds a fade-out watchdog so a Mola that started the negative-Z recovery fade cannot remain transparent if recovery state changes before the fade-out completes.
- `v0.8.1-dev_2` gives the Mola a much larger positive-Z runtime buffer, so front/offscreen hard recovery happens farther past the camera instead of popping visibly near the tank front.
- `v0.8.1-dev_3` keeps non-negative-Z Mola runtime recovery at the expanded runtime-envelope edge instead of snapping all the way back to swim bounds, fixing bottom-right/front X-boundary exits that read as teleporting and spinning near the camera.
- `v0.8.1-dev_4` adds a debug-only simulation speed control (`1x`, `4x`, `10x`) so chance-based Mola behaviors and recovery cases can be reviewed without waiting at real time.
- `v0.8.1-dev_5` keeps Mola X/front runtime recovery from forcing the visual heading to the recovery clamp vector, fixing the visible sideways snap-turn at the X edge.
- `v0.8.1-dev_6` smooths Mola model look-at orientation across solo-agent behavior transitions, so target/behavior changes do not hard-overwrite the root quaternion in a single frame.

## v0.8.0 — Mola alexandrini + solo-agent movement

Status: accepted and promoted as clean `v0.8.0`.

### Creature behavior

- Starts the Mola alexandrini feature bucket after clean `v0.7.9` acceptance.
- Target: add Giant Sunfish as the first non-schooling agent-driven creature, with reusable solo-agent movement plus a species-specific Mola profile.
- Adds the Giant Sunfish (`Mola alexandrini`) species profile at current review scale: 180–240 cm total length, using the project scale of 1 WU = 25 cm, so individuals render at 7.2–9.6 WU.
- Updates the Mola species metadata and info-card description toward behavior-first `Mola alexandrini` facts: fin-rowing swimming, deep-diving soft-bodied prey, sideways surface basking for warmth/oxygen/parasite relief, and head/chin/clavus traits; legacy `mola-mola` / `Ocean Sunfish` creature rows still resolve to Giant Sunfish.
- Adds the uploaded `Mola alexandrini` GLB with embedded clips: `idle_drift`, `slow_cruise`, `bank_l`, `bank_r`, `burst`, `sun_bask_l`, and `sun_bask_r`. The current movement system maps cruise to `slow_cruise`, turn actions to the bank clips, and speedups to `burst`; during sun-bask hold, playback isolates the complete authored `sun_bask_l/r` clip with no slow-cruise base layer and no appendage-only overlay slicing. Refreshes the canonical Mola GLB in `v0.8.0-dev_108` from Jeremy's replacement archive while preserving scene, mesh/material/skin counts, embedded texture shape, scale bounds, and expected animation names.
- Corrects the uploaded Mola GLB axis conversion for Jeremy's Blender-to-GLB setup: Blender `+Z` becomes GLB `+Y`, so the runtime asset is GLB `+Y` up and `+Z` forward. The model now uses identity child rotation to match the fish root's `+Y` up / `+Z` swim-forward axes.
- Fixes the instanced/model fish light-mask shader world-position injection so the uploaded Mola and sardine instanced layers compile cleanly in browser dogfood.
- Planned signature behavior: near-surface sun basking with slow approach, surface clearance padding, lazy hold/drift, and eventual return to cruising. `v0.8.0-dev_110` tested removing procedural yaw/roll ocean-drift rotation; snapping persisted, so `v0.8.0-dev_111` restored rotational drift and kept the investigation focused elsewhere. `v0.8.0-dev_112` freezes the base visual-forward orientation during bask hold while preserving translation drift, bask roll completion, rotation drift, and isolated sun-bask animation. `v0.8.0-dev_113` eases that look-at freeze in on hold entry and eases it back out during exit so normal route-facing influence resumes gradually instead of reactivating in one frame. `v0.8.0-dev_114` slows isolated `sun_bask_l/r` playback to `0.5x` for a calmer bask hold while leaving movement speed and other clips unchanged. `v0.8.0-dev_116` adds a short entry-only fade into the isolated bask action, then stops the previous cruise/bank actions after the fade so the hold no longer starts with an animation-pose tick. `v0.8.0-dev_117` smooths the remaining transition tick by coasting briefly into hold, ramping exit swim speed back up, and crossfading the final bask→cruise handoff.

### Movement architecture

- Planned architecture keeps sardines on the existing spline-school system while adding a generic solo-agent core for non-schooling species.
- Species-specific behavior profiles will layer personality/state weights on top of reusable steering, target selection, bounds, debug, and animation-speed outputs.
- Keeps the Mola GLB path unwired for now; the placeholder path is data-driven through the species profile so the final asset can replace the geometry later without blocking behavior tuning.
- Scales follow-camera default distance by focused creature body length for large solo animals, so clicking the real-scale Mola starts farther back instead of zooming inside the fish while sardines keep the existing close inspection distance.
- Adds a small centered follow-camera recovery notice when an automatically followed creature leaves the runtime boundary and the camera exits to let hard recovery happen, using the custom name when present or the common species name otherwise. `v0.8.0-dev_120` also exits Mola follow mode with the same notice if the follow camera gets close enough for the Mola to clip into the camera, so runtime recovery and camera-clip bailouts share one clear player-facing explanation. `v0.8.0-dev_121` limits manual Mola zoom-in before that clip zone so pinch/scroll cannot intentionally drive the camera into the body. `v0.8.0-dev_122` fades Mola out over 8 seconds before outer-envelope hard recovery, performs the recovery while hidden, then fades back in so boundary correction reads like swimming away and returning. `v0.8.0-dev_123` breaks up the fake fish-lighting mask with warped procedural noise and softer contrast so Mola no longer shows obvious straight light bands. `v0.8.0-dev_124` expands the mobile audio unlock path beyond UI clicks so tank/canvas gestures can start Web Audio too. `v0.8.0-dev_125` attempts audio startup immediately on tank page open and foreground return. `v0.8.0-dev_126` hardens the Mobile Safari fallback by keeping gesture retry active until Web Audio truly starts, adding pointer/touch end/cancel hooks, using silent unlock pulses, and falling back from unsupported AudioContext constructor options.
- Restores smooth camera entry into follow mode by damping the focus point from the current tank view before tracking the selected creature, and keeps the placeholder Mola base material color stable when selected by rendering the selection rim as a back-face shell instead of tinting the body.
- Adds focused debug readouts for solo agent-style individuals such as the Giant Sunfish: current movement status, speed, destination coordinates, distance to target, wall clearance, and surface clearance.
- Moves and scales the solo-agent debug readout for large creatures so the Mola label sits above the body at follow-camera distance instead of being tiny or visually buried near the target marker.
- Corrects the Mola review speed target down to 0.5–0.8 WU/s and starts replacing the old solo spline-follow behavior with a real target-seeking solo-agent movement path for non-schooling individuals, hiding the old cyan spline debug for Mola.
- Makes Mola movement forward-facing: opposite-side targets now require the animal to rotate before it translates, debug speed/distance labels use meters, the forward vector starts at the mesh front, and Mola target sampling uses wider movement bounds so it explores more of the tank volume.
- Smooths Mola target turns into broad forward arcs instead of on-the-spot pivots, so opposite-direction retargets keep moving along the face direction while turning toward the destination.
- Fixes the arc-turn stall by steering the visual facing toward the actual destination while translating along the current forward vector, with a higher minimum arc speed so the Mola keeps making progress during opposite-direction turns.
- Adds a cyan wireframe movement-boundary box to Mola direction debug so the padded solo-agent target volume is visible in the tank.
- Retunes tank-view movement bounds only: sardines and Mola get wider horizontal X travel and deeper negative-Y travel, while the Mola target volume moves farther back on negative Z. Follow mode mechanics are unchanged.
- Tunes active tank movement bounds to give sardines and Mola much wider horizontal travel (`X [-25, 25]`), lowers both movement volumes to `Y min -7`, and gives sardines explicit asymmetric depth trav

... [OUTPUT TRUNCATED - 16662 chars omitted out of 66662 total] ...

ity, so the fit safety no longer locks zoom-in/zoom-out controls.
- Expands the water-surface plane width by `3x` while scaling the procedural surface UVs in X by the same factor, preserving shimmer/glint density instead of stretching the texture across the wider top surface.
- Adds eased deceleration during the Mola sun-bask approach, ramping down forward movement over the final approach distance instead of switching from cruise speed to stationary hold abruptly.
- Delays Mola side-up roll pacing until late in the sun-bask approach: roll now starts after about `62%` route progress and caps at `92%` while still approaching, then completes to the full 90° pose gradually during the bask hold instead of snapping at the stage transition.
- Adds subtle procedural yaw and extra roll drift during Mola sun-bask hold, layered over the side-up pose so basking feels like ocean drift rather than a fixed frozen orientation.
- Smooths the sun-bask exit transition by preserving the current drift yaw/roll offsets at exit start and fading them out over the exit roll-down, while also easing the roll-down curve instead of linearly dropping from the side-up pose.
- Replaces the Mola GLB with Jeremy's refreshed upload after verifying GLB header/chunks, buffer bounds, mesh/material/skin counts, and all seven expected animation clips (`slow_cruise`, `bank_l`, `bank_r`, `burst`, `idle_drift`, `sun_bask_l`, `sun_bask_r`).
- Fixes first-tap mobile audio enable: the audio button now treats the pre-unlocked state as “start audio” even if the global gesture unlock already ran on `pointerdown`, and the audio UI only marks the graph started once the `AudioContext` reports `running` so failed mobile unlock attempts do not show a false-on mute button. `v0.8.0-dev_125` now attempts to start the Web Audio graph immediately on tank page open and again on foreground return, with gesture unlock kept only as fallback.
- Removes the remaining Mola sun-bask exit snap by keeping the exit behavior alive until roll-down finishes even if the exit destination is reached early, and suppresses generic procedural turn banking while any sun-bask stage owns the side-up pose.
- Reformats the Mola solo-agent debug label to match the sardine debug label shape: `id • name`, scientific name, speed, `behavior • animation`, and queue.
- Fades Mola sun-bask ocean drift in over the first hold seconds so non-zero yaw/roll/position drift cannot appear as a one-frame snap on approach → hold.
- Removes authored `root` transform tracks from Mola sun-bask animation overlays and lengthens the bask overlay blend, leaving runtime root roll as the only whole-animal bask pose owner.
- Replaces the Mola GLB with Jeremy's latest refreshed upload (`mola alexnadrini.glb`), preserving the expected scene shape, material/skin counts, and all seven movement/sun-bask animation clips while adding the updated mesh data.

## v0.7.9 — Sardine texture refresh

Status: accepted and promoted as clean `v0.7.9`.

### Sardine visuals

- Reverts the external sardine albedo override after phone review showed the uploaded image did not align with the GLB UVs; sardines are back on the embedded model textures while the next texture path is decided.
- Replaces all three sardine GLB assets from Jeremy's updated zip: full `sardine.glb`, `sardine_LOD1.glb`, and `sardine_LOD2.glb`.
- Overrides sardine material roughness to `0.2` for the full model and both instanced LOD models, while leaving metalness at the embedded GLB value.

## v0.7.8 — Screenshotability polish

Status: accepted and promoted as clean `v0.7.8`.

### Screenshot / debug capture

- Starts the next dev bucket after clean `v0.7.7` acceptance.
- Always hides the debug menu in screenshot mode while keeping debug overlays/LOD colors available when debug is enabled.
- Adds a screenshot-only procedural film-grain overlay without changing contrast, saturation, exposure, or fog.

## v0.7.7 — Surface and depth polish

Status: accepted and promoted as clean `v0.7.7`.

### Environment direction

- Starts the next dev bucket after clean `v0.7.6` acceptance.
- Target: improve the tank's top water surface and strengthen depth cues so the ocean reads less flat while preserving current sardine LOD performance.
- Replaces the temporary flat water-surface plane material with a high-visibility cyan checker texture so the surface plane position, scale, and motion are easy to inspect before styling it into the final reference-like shimmer.
- Step 1 of the reference-image pass: replaces the checker diagnostic with a cheap procedural additive surface shimmer shader, creating a brighter broken cyan/white water ceiling without real volumetrics or postprocessing.
- Extends the surface shimmer plane deeper into the tank and fades it by camera-depth so the bright water ceiling recedes instead of reading as a nearby horizon line.
- Makes the surface-depth change more obvious by hiding the near half of the plane, moving the shimmer much farther back, extending its far fade, and slightly boosting brightness so the visible ceiling starts deeper in the scene.
- Replaces the wrong mid-screen horizon stripe with a camera-anchored top shimmer backdrop that stays near the upper water column and fades downward instead of intersecting the scene as a visible horizontal line.
- Disables the old `UnderwaterFX` `SurfaceFoam` plane so only one surface shimmer plane is visible; this removes the duplicate halfway-down screen band.
- Adds a visible cyan wireframe overlay to the current surface plane so its actual bounds and placement can be inspected directly.
- Moves the diagnostic surface plane upward so its bottom wireframe edge sits near the requested upper-water reference line.
- Converts the diagnostic surface from a camera-facing billboard to a real world-horizontal ceiling plane so placement can be judged in tank space.
- Widens the world-horizontal diagnostic surface plane on the X axis from `46` to `70` so the left/right coverage can be checked with wireframe visible.
- Retunes the surface shader from broad cloudy patches toward thinner broken cyan/white shimmer streaks with a stronger lower fade, while keeping the wireframe diagnostic visible.
- Scales the surface shader tiling down by `3x` so the shimmer pattern reads larger across the world-horizontal plane.
- Corrects the surface shader tiling in the opposite direction and widens the shimmer thresholds so blob/streak edges dissolve more softly instead of cutting sharply.
- Adds a cross-panned procedural interference band: two different noise fields pan in opposing directions, multiply together, and drive the main cyan/white color lerp for a more water-like shimmer texture.
- Removes the wireframe diagnostic and temporarily shows a large animated Perlin mask in obvious green/black before using it to make the fake caustics more occasional.
- Reduces the visible Perlin-mask blob size by increasing the diagnostic mask frequency.
- Sets the Perlin-mask diagnostic to exactly half the original blob size for easier visual approval.
- Applies the approved Perlin mask to the surface shader so bright caustic streaks appear only in mask-active regions while inactive regions stay darker, and restores depth testing so fish can occlude the surface plane in 3D.
- Doubles all active surface noise pan speeds and increases caustic contrast so mask-active regions are brighter while masked-out regions fall darker.
- Halves the active Perlin mask blob size again by doubling its UV frequency from `6.4 × 2.9` to `12.8 × 5.8`, making bright/dark caustic regions more broken up.
- Darkens the surface shader by lowering the base cyan lift, dimming bright/glint targets, reducing caustic mix weights, and lowering transparent alpha.
- Changes the Perlin mask from a hard caustic cutoff to a dimmer: mask-black regions now keep subdued caustics/glints instead of fully masking them out.
- Replaces the earlier bespoke darkening with a simple `color *= 0.8` albedo multiplier while restoring the prior color mix and alpha, so intensity is lower without changing the caustic balance.
- On mobile, widens the top exposure radial gradient to the horizontally scrollable tank-stage width and pans it with the stage, reducing visible screen-space banding/elongation.
- Adds a first fake god-ray experiment: three subtle upper/back 3D shader planes with depth testing on, low additive alpha, and no raycasting.
- Softens the fake god rays after phone review: two broader beams, stronger side/vertical fades, lower alpha, slower shimmer, and normal blending to remove sharp/out-of-place edges.
- Turns on god-ray diagnostic wireframe and aligns both ray planes to the same 15° left angle for placement review.
- Applies the widened/panning top exposure gradient to desktop as well as mobile, so the radial gradient spans the full scroll-stage width on all devices.
- Corrects god-ray diagnostic opacity so beams are strongest near the visible water surface and fade deeper, while increasing diagnostic intensity for placement review.
- Splits god-ray diagnostics into a real filled ray shader plus a separate wireframe overlay, so the beam fill remains visible while the grid shows placement.
- Expands the god-ray diagnostic from two broad beams to five thinner, lower-intensity beams angled 15° left for composition review.
- Hides god-ray wireframes and varies beam thickness across the five rays so the set reads less mechanically uniform.
- Raises non-diagnostic god-ray fill intensity after the wireframe-off build made the beams disappear on device.
- Repositions god rays so every beam starts from the same surface Y anchor while varying X/Z depth, pushing several rays farther back into the tank instead of out toward the camera.
- Moves the god-ray top/source edge up to Y=15 while preserving varied X/Z placement, thickness, and 15° left angle.
- Flips god-ray Z positions from negative to positive values while preserving X positions, source height, thickness, intensity, and angle.
- Moves god-ray Z positions back to the negative side but adds 8 world units to each original depth, placing them closer to the surface plane depth.
- Varies god-ray size by depth: nearer beams keep the current thick scale, while farther-back beams are thinner and a few extra rays sit deeper at more negative Z.
- Adds shader-only god-ray motion: slow asynchronous brightness breathing, UV shimmer drift, and tiny top-weighted centerline wobble without moving the ray planes.
- Keeps the procedural water surface and god rays mounted in follow mode so close-up fish inspection preserves the same top-water lighting context.
- Varies each god ray's fade length so some shafts die out high while others extend deeper into the tank.
- Adds five more thin god rays, mostly farther back.
- Reverts the surface-shadow band experiment because it did not add enough visually.
- Adds sparse, shader-only white/cyan surface glint streaks as the next cheap surface-lighting layer after rejecting shadow bands.
- Breaks the surface glints out of uniform parallel bands by warping the line field and cross-cutting it into irregular patches.
- Increases glint domain-warp strength and bends the sine phase so surface streaks curve instead of reading as straight broken lines.
- Makes glints rarer and less intense, deepens ocean haze/distance grading, and adds a sparse suspended-particle layer near the upper water column.
- Shrinks suspended-particle specks substantially and pushes the ocean haze darker/denser for stronger distance depth.
- Makes suspended particles smaller/fainter again and changes motion from near-static bobbing to subtle upward water-column drift so they do not read as hanging ornaments.
- Adds an intentionally obvious diagnostic fish light-mask shader to full GLTF fish, using animated world-space cyan/shadow bands to prove the fake light-function path before tasteful tuning.
- Extends the same obvious diagnostic light-mask to instanced sardine LOD1/LOD2 materials so every visible fish tier can be checked together.
- Converts the fish light mask from cyan diagnostic color into a world-space dimming/light factor, so all LODs read more like swimming through moving light and shadow.
- Broadens and slows the fish light/shadow mask bands while keeping the effect readable, reducing small-pattern shimmer on sardines without making it disappear.

## v0.7.6 — Instanced sardine optimization

Status: accepted and promoted as clean `v0.7.6`.

### Sardine LOD rendering

- Added distance-gated sardine LOD rendering for dense schools.
- Keeps nearby, selected, focused, and debug sardines on the full animated GLTF path.
- Renders mid/far non-selected sardines through real `THREE.InstancedMesh` layers using Jeremy's uploaded `sardine_LOD1.glb` and `sardine_LOD2.glb`.
- Preserves per-creature identity, click, search, and follow behavior through invisible interaction proxies.

### Visual feel

- Matched low-LOD sardine scale, orientation, and material behavior to the full sardine mesh.
- Added procedural vertex-shader wiggle to LOD1/LOD2 so instanced fish stay alive without per-fish skeletal animation.
- Rejected far-LOD motion/controller throttling after phone feedback showed visible jitter; sardine motion updates remain full-rate.

### Performance / culling

- Added conservative frustum culling for non-selected, non-debug sardines in tank and follow modes.
- Retuned tank-view thresholds to target a healthier full/mid/far LOD mix: LOD0 inside `10.5` world units, LOD1 from `10.5–13.5`, and LOD2 beyond `13.5`; follow mode remains LOD0 inside `5`, LOD1 `5–8`, LOD2 beyond `8`.
- Reduced debug-panel overhead with slower sampling, unchanged-state skips, and throttled audio meter updates.

### Debug / interaction

- Added compact debug rows for `LOD0`, `LOD1`, `LOD2`, and `Frustum` counts.
- Added `L` debug color view with Jeremy's spectrum: LOD0 green, LOD1 olive, LOD2 red.
- Fixed small-window desktop fish clicks by delaying pan pointer capture until actual drag movement.

## v0.7.5 — Sardine population staging

Status: accepted and promoted as clean `v0.7.5`.

### Creature data

- Started the next dev cycle after clean `v0.7.4` acceptance.
- Used `creatures_dev` for dense-sardine stress testing while keeping the clean release on production `creatures`.
- Reverted runtime rendering/LOD/debug changes back to the original `v0.7.5-dev_01` normal animated GLTF fish path after rejecting the LOD/marker experiments.
- Added a live FPS readout to the debug card for mobile pan/orbit performance checks.
- Replaced the selected/leader duplicate-mesh silhouette with a Fresnel rim shader on the fish material.
- Rewired debug layer controls to two toggles: direction (`↗`) for spline/follow target/drift/velocity vectors and name (`#`) for close per-fish ID/species/scientific-name labels.
- Tuned Fresnel selection rim thinner and brighter for a sharper mesh outline.
- Removed live sardines from production `creatures`; clean/public builds intentionally see zero live sardines until production data is repopulated.
- Preserved the dev/prod split: `-dev_##` builds read `creatures_dev`, clean builds read `creatures`.

## v0.7.4 — UI audio polish

Status: accepted and promoted as clean `v0.7.4`.

### Button / control SFX

- Added a trimmed UI click SFX asset derived from Jeremy's uploaded audio sample.
- Wired subtle button click playback through the existing tank Web Audio graph.
- Added search-submit success/error click variants using the same damped aquatic sample.
- Kept the hidden debug version-label tap silent to avoid noisy triple-tap debug access.
- Replaced the first generated click with Jeremy's four uploaded UI-click assets.
- Randomized UI click selection while preventing immediate repeat sounds.
- Routed visible `-dev_##` builds to Supabase `creatures_dev` while clean releases keep using `creatures`.
- Hardened creature URL overrides so dev builds cannot accidentally stay pinned to the production `creatures` table.
- Normalized Supabase species ids to display species names before filtering, so rows using `sardine` still render as Spotted Sardinella.
- `creatures_dev` has its own anon read policy; dev and production creature tables intentionally diverge.
- Removed the temporary dev-read fallback to production `creatures` so staged testing reflects only `creatures_dev`.

## v0.7.3 — Public launch shell polish

### Screenshot/share polish

- Added screenshot mode from the tank top controls.
- Hid all app UI, fish info cards, debug overlays, version label, and tank labels while screenshot mode is active.
- Added a persistent acknowledgement prompt with platform-specific exit instructions.
- Set desktop exit to `Esc` and mobile/touch exit to long-press anywhere.
- Kept screenspace lighting/exposure visible in screenshot mode so captures preserve the intended tank look.
- Hid the selected/followed fish silhouette in screenshot mode while preserving the follow camera state.
- Replaced the crowded top-right icon row with a consistent hamburger menu that drops tank controls vertically.
- Kept search as a top-level button beside the hamburger while screenshot/audio/fullscreen stay inside the dropdown.
- Animated the hamburger icon to rotate open while menu icons pour/slide downward with a short stagger.
- Added the matching reverse animation so dropdown icons slide back up into the hamburger when closing.
- Added Jeremy-uploaded favicon and Apple touch icon assets for public launch polish.
- Updated the launch icons to Jeremy's latest uploaded WO mola mola image.
- Fixed mobile search expansion so the input anchors to the search button and stays inside the viewport beside the hamburger.
- Moved mobile expanded search onto a second row below the search/hamburger icons, right-aligned to the hamburger with consistent control spacing.

## v0.7.2 — Audio + mobile follow polish

### Audio foundation

- Added procedural underwater ambience for the tank.
- Added audio debug meters for:
  - overall mix
  - ambient channel
  - SFX channel
- Added fish swim / turn / burst sound-effect hooks.
- Replaced procedural fish SFX with Jeremy-uploaded MP3 movement/burst assets.
- Tuned ambience low-pass and mobile-safe underwater muffling.
- Tuned SFX louder than ambience, especially in follow mode.
- Maintained mobile master volume while reducing desktop master volume by 50%.
- Extended fish SFX envelopes so sounds play fully instead of blipping.
- Trimmed/faded an uploaded burst-audio artifact.

### Audio lifecycle

- Scoped audio to the tank:
  - landing is silent
  - landing has no audio control
  - `DIVE IN` starts tank audio on user gesture
  - returning to landing stops/suspends audio
- Added synchronous iOS/WebAudio unlock path.
- Added best-effort media playback audio-session hint for mobile browsers.
- Paused tank audio when the browser/app backgrounds.
- Resumed tank audio only when returning to the tank and not manually muted.
- Added fade-out / fade-in for app/browser switches.
- Added foreground resume retries and next-gesture recovery for mobile Safari app switches.
- Avoided manually suspending Web Audio during app backgrounding to reduce Safari resume failures.
- Released and reclaimed mobile playback audio-session state so other phone audio can take over cleanly while Oceanarium is hidden.
- Documented remaining intermittent mobile Safari audio-session recovery as a known limitation.

### Mobile follow UX

- Reworked mobile follow card to overlay the full tank naturally instead of reserving a fixed bottom band.
- Kept the info card content-sized with `max-height` rather than fixed/min height.
- Moved mobile debug panel inside the follow info card.
- Lifted the version label above the actual mobile card height using dynamic card measurement.
- Removed follow-card gaps caused by fixed viewport bands.
- Disabled accidental page/text selection and touch callouts outside inputs.
- Blocked page scroll while dragging the tank in follow mode.
- Preserved scrolling inside the info card.
- Restored orbit and pinch-to-zoom after scroll-lock tuning.
- Hid home/back navigation while following a creature.
- Offset mobile follow-camera framing above the info card so followed fish stays centered in the visible tank area.

### Search/mobile input

- Hid the mobile keyboard after search submit on both success and failure paths.
- Preserved text selection in search input despite global selection lock.

### Debug/dev visibility

- Added school-leader highlighting in debug mode.
- Added low-opacity shader-style outlines for selected fish and debug-only school leaders.
- Removed the oversized debug leader ring so leader marking relies on label + outline.
- Pulled drift and leader labels closer to their target/mesh anchors.
- Reduced debug text by 30% and switched drift/speed/leader labels to a basic monospaced font.
- Shortened debug velocity vectors by 50% so motion overlays stay readable in dense schools.
- Kept debug audio meters available for audio tuning.

## v0.7.1 — Schooling motion + debug polish

### Schooling motion

- Added organic school motion on top of shared school paths:
  - per-fish speed variation
  - catch-up variation
  - smoother local motion
  - less synchronized/robotic swimming
- Clamped fish pitch to spline gradient so fish do not over-tilt on path changes.

### Debug tools

- Added fish motion debug labels.
- Shrunk noisy debug labels for readability.
- Added debug overlay layer toggles.
- Iconified debug layer toggles to keep the panel compact.

### Creature copy

- Used custom creature names inside individual creature descriptions.

## v0.7.0 — Search + interaction foundation

### Creature search / controls

- Added creature search controls.
- Simplified top controls.
- Refined desktop/mobile search layout across multiple passes.
- Anchored the search icon/button so mobile layout stays stable.
- Stabilized mobile search close behavior.

### Follow interaction

- Allowed switching followed fish by tapping another fish while already following.
- Improved follow-mode click targeting.
- Centered follow mode and smoothed camera target switching.
- Follow camera centers on selected fish mesh bounds instead of model root, with translation damping and user-orbit-only rotation.
- Added drag threshold before orbiting the follow camera.
- Randomized initial school paths per tank visit.
- Added per-visit rotated/weaved school control points so debug splines do not collapse into a straight line from the front view.

### Schooling foundation

- Added shared school spline follow targets.
- Moved schooling from individual-looking paths toward one shared spline per school.
- Added soft fish clipping avoidance.
- Relaxed dense-school separation so sardines can stay visually dense.
- Added smoother dense-school avoidance steering.
- Distributed school offsets vertically and forward/backward for fuller formations.
- Kept the debug school leader in the visual front of the formation instead of letting the arbitrary driver fish trail behind followers.
- Added follow steering for all fish.
- Capped solo fish follow target lookahead for large creatures.

### Data/source-of-truth

- Switched Supabase to the creature source of truth.
- Mapped creature size parameter to species size range.

### App shell

- Added Vercel Analytics using the Vite-safe `inject()` setup.
- Updated landing tagline.
- Added fullscreen toggle.
- Removed debug passcode gate after mobile debug access matured.

## v0.6.x — Creature data, focus mode, schooling foundation

### Creature/species data

- Clarified ocean biome zones.
- Updated spotted sardinella species information.
- Added custom-name tag support.
- Moved creature IDs to integers.
- Moved creature ID display into the focus header.
- Removed unused prototype creature fields.
- Added persistent species size variation.
- Made creature size a first-class field.
- Moved between Supabase/local creature-source modes while stabilizing the data model.

### Focus/follow UI

- Polished the focus info card.
- Added species-level descriptions.
- Added generated individual descriptions.
- Added description fallbacks.
- Added creature size and weight display.
- Fixed fractional fish measurements.
- Added follow camera zoom controls.
- Tightened follow-mode hints and split hints by platform.
- Constrained and flattened the mobile focus card.
- Made mobile focus card full-width where needed.
- Simplified mobile follow labels.

### Fish models/animation

- Added sardine 3D model and GLB pipeline.
- Added sardine swim animations.
- Fixed sardine forward axis, orientation, pitch, and roll limits.
- Kept GLB fish materials opaque.
- Based swim speeds on body lengths.
- Varied fish animation playback to avoid synchronized schools.

### Movement/follow mechanics

- Added constrained fish follow camera.
- Refined fish follow camera behavior and exit mode.
- Scaled path turns for large creatures.
- Moved solo follow targets outside large fish.
- Set solo follow targets by body length.
- Limited fish facing turn rate.
- Added vertical spline variation limits.
- Increased vertical fish traversal.
- Randomized swim paths per page load.
- Added soft top-light preservation during follow mode.

### Schooling foundation

- Added temporary sardines for schooling tests.
- Added schooling path offsets.
- Refreshed schooling splines over time.
- Made schooling fish face individual paths.
- Tried individual/lane splines before moving toward shared-school architecture.
- Added schooling follow debug vectors.
- Moved schooling follow target ahead of each fish.
- Increased schooling follow lookahead.
- Loaded creatures from Supabase for live schooling data.

### Debug/dev tools

- Added mobile debug long-press, then replaced it with triple-tap version label.
- Moved debug mode behind keyboard shortcut during tuning.
- Showed creature data source and Supabase debug error details.
- Reduced debug vector clutter.
- Anchored debug forward vector at fish nose.

### App shell / analytics

- Added Vercel Analytics dependency and Vite integration.
- Updated landing tagline.

### Species cleanup

- Removed river placeholder species.
- Renamed large predator placeholder species.
- Added and later cleaned temporary shark/collision-test data.

## v0.5.x — Movement tuning foundation

### Movement controls

- Added horizontal tank panning when the fixed 16:9 stage is heavily cropped on narrow screens.
- Added species/individual movement tuning parameters:
  - `speed`
  - `erraticness`
  - `turnRadius`
- Tightened swim path bounds so fish stay on-screen more reliably.
- Added baseline mackerel movement values.

### Changelog/versioning

- Added the project changelog.
- Began grouping older pre-`v0.3.0` changes for readability.

## v0.4.x — Spline swimming + underwater visuals

### Fish movement

- Replaced simple left/right oscillation with Catmull-Rom spline swimming.
- Fish now travel forward through the tank instead of hovering in place.
- Added X, Y depth, and Z screen-depth variation to swimming.
- Fish rotate toward their movement tangent with slight pitch while climbing/diving.
- Increased swim volume depth to make toward/away motion more visible.
- Added automatic spline regeneration after each completed path.
- Changed path regeneration so new paths start from the previous endpoint.
- Preserved exit direction into the next spline to avoid teleporting or sudden direction snaps.

### Debug tools

- Added passcode-gated debug mode.
- Added visible swim spline rendering while debug mode is active.
- Added toggle behavior to exit debug mode.
- Debug splines show the active open swim path.

### Depth/fog/readability

- Added explicit screen-depth fade to fish.
- Reduced far-fish environment reflection so distant fish fade more naturally into fog.

### Underwater visuals

- Added underwater light rays and caustics experiments.
- Removed the caustic web overlay after visual review.
- Tuned surface-ray orientation, width, height, and softness.
- Added animated surface foam band.
- Hid underwater light rays when they became visually too loud.

## v0.3.x — Ocean-only build + bubble field

### Ocean shell

- Made Open Ocean the active tank focus.
- Added `Sunlight Zone` subtitle under Open Ocean.
- Added persistent bottom-right version footer.
- Established app/package versioning.

### Bubble particles

- Added Open Ocean bubble particle field using Three.js `Points` + `BufferGeometry`.
- Converted bubbles from square point sprites to circular shader particles.
- Lowered opacity, size, density, and particle count.
- Added lifetime-based size scaling.
- Moved bubble spawning into the visible sunlight zone.
- Reduced bubble scale/density after visual review so bubbles stayed subtle.

## pre-v0.x — Initial prototype and project foundation

### Project setup

- Created the initial World Oceanarium Vite/React/Three.js project.
- Added CI build workflow and production deployment workflow.
- Added Vercel-compatible build/deploy setup.

### App flow

- Added initial oceanarium UI shell, landing screen, and biome selection flow.
- Added read-only Supabase creature loading with local seed fallback.
- Added initial biome/tank rendering with fish, floor, vegetation, water surface, camera, and UI.
- Added fish selection and focus-follow camera behavior.
- Cropped the 3D tank to a fixed 16:9 viewport and removed vertical tank scrolling.
- Made landing enter Open Ocean directly and back return to landing.
- Removed Tropical River from the active flow while keeping selection/menu code for future tanks.

### Visual foundation

- Added generated equirectangular environment lighting, hemisphere/key/fill/point lighting, and exponential water-depth fog.
- Tuned fish, floor, vegetation, and water materials to respond to environment lighting.
- Established generated HDRI-equivalent environment lighting as the baseline for future tanks.
- Added initial ocean bubbles, depth fade, surface/floor/vegetation visual treatment, and ocean-only scene polish.
