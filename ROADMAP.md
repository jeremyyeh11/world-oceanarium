# World Oceanarium Roadmap

Purpose: keep active maintenance work, feature ideas, release blockers, and follow-up notes in one ordered place so review TODOs do not get lost.

Ordering rule: keep code cleanup/maintenance separate from feature work. Within each section, list current work first, then priority, then chronological discovery order. Only reorder manually when Jeremy/YK asks.

Status labels:
- `Current in development` — actively being worked/reviewed in the current dev bucket.
- `Next` — should happen before clean release if current item passes.
- `Blocked / waiting review` — implemented or partially implemented, needs human/device judgement.
- `Backlog` — known follow-up, not blocking current release unless promoted.
- `Archive candidate` — remove or move to archive once completed and pushed to a clean public release.

## Current work

### Procedural cinematic camera

Status: `Current in development`

Reference:
- Jeremy redirected the feature toward a Nat Geo-style species documentary: follow a fish first, then enter Cinematic Mode from that fish's info card. The selected species remains the main subject while shots may move between its individuals and groups.
- Branch: `feat/cinematic-camera`; development build: `v0.13.0-dev_7`.
- Detailed architecture and review contract: [`docs/cinematic-camera.md`](docs/cinematic-camera.md).

Subtasks:
- [x] Build individual, pair, and school hero candidates from the shared live fish registry without species-specific sequencing.
- [x] Filter the live hero set to the followed fish's species, then add a seeded weighted rolling queue with recency, hero-type variety, viability, and spatial-continuity weighting.
- [x] Add generic profile, lead, static, group, member-cutaway, and shared-frame bridge shots.
- [x] Add 5–10 second holds, low-frequency shot evaluation, hysteresis, and early bad-shot replacement.
- [x] Add Cinematic Mode beside Atlas in the followed fish's info card, with clean presentation UI, desktop any-key exit, inert mouse input, and mobile long-press exit.
- [x] Use validity-gated jump cuts for shot changes: preflight framing/facing/finite pose and both bridge subjects before committing the cut; retain damped within-shot tracking.
- [x] Add restrained still, tracking, dolly, truck, and tilt coverage with exactly one camera movement vocabulary per shot.
- [x] Rebalance away from repeated still shots, make planned movement visually legible, and exit Cinematic Mode with the existing recovery notice before a current subject hard-resets beyond its boundary.
- [x] Make presentation rendering use the real device viewport, add portrait-aware camera distance/FOV/look-ahead/movement limits, validate full subject bounds, expand the presentation water ceiling, and hide light-ray shafts in Screenshot/Cinematic modes.
- [x] Fix pair/school aggregate bridges averaging the camera into empty water between separate groups; independent aggregate heroes now receive separate shots and direct validated cuts.
- [x] Preserve resting/manual follow-camera code paths and avoid frame-by-frame React state updates.
- [x] Build, lint, and browser-smoke both multi-hero and single-hero tanks.
- [ ] Collect Jeremy desktop visual review of a sustained 60–90 second sequence.
- [ ] Run Jeremy/YK phone review for composition, exit behavior, and performance.
- [ ] Collect explicit release approval before merge, clean promotion, deployment, or branch deletion.

Review gates:
- No species, creature id, hero count, or fixed narrative sequence is encoded in the director.
- Open Sea keeps the selected species as its main documentary subject while producing readable individual/group coverage and coherent same-species individual handoffs without rapid repetition, arbitrary oscillation, or snappy long-distance camera jumps. Separate pairs/schools must never be averaged into one empty midpoint composition.
- The Drift remains useful with one available hero, varying generic shot classes and replacing sustained poor angles early.
- Shots generally hold 5–10 seconds, but invalid targets, poor scale/framing, or sustained head-/tail-on angles are replaced gracefully.
- The camera does not reveal hard tank boundaries or travel visibly through geometry.
- Existing resting, selected-creature follow, Screenshot Mode, debug, and tank-switch behavior remain unchanged outside Cinematic Mode.
- Any desktop keyboard key returns manual control; desktop mouse input does nothing. A stationary 900ms touch/pen long press exits on mobile.

### Deforming ocean surface

Status: `Archive candidate`

Reference:
- Jeremy requested a separate ocean-surface branch rather than coupling genuine mesh deformation to the cinematic-camera PR.
- Branch: `feat/deforming-ocean-surface`; accepted for clean `v0.13.0` from the historically labeled review build `v0.14.0-dev_12` after Jeremy reju.
- Technical contract: [`docs/deforming-ocean-surface.md`](docs/deforming-ocean-surface.md).

Subtasks:
- [x] Replace the flat plane with a subdivided, vertex-displaced surface.
- [x] Use layered mobile-conscious Gerstner waves with analytic normals.
- [x] Replace the localized fragment treatment with a full-plane physical water material and material-specific CC0 HDR environment.
- [x] Overscan beyond camera range and use a half-resolution refraction target for mobile-conscious physical transmission.
- [x] Retune the material from cyan toward muted cobalt and dissolve its grazing-angle horizon with distance + facing fades.
- [x] Remove the repeated low-angle reflection bands from portrait/level views while retaining the physical surface in steeper upward views.
- [x] Restore low-angle HDR reflection with a much tighter `4.2–8.5 WU` Gerstner spectrum for smaller reflected ripples.
- [x] Break the remaining periodic rhythm into three crossed scales, each pairing waves with different directions, speeds, phases, and incommensurate wavelengths.
- [x] Brighten the material-local HDR reflection without changing global tank or creature lighting.
- [x] Increase coarse-to-fine wavelength separation and lower the resting camera up-pitch so the surface reads less tiled and crowns portrait framing instead of filling half the screen.
- [x] Raise the minimum wave scale from `3.1` to `4.5 WU` and brighten the water-local HDR reflection from `1.15` to `2.2`.
- [x] Increase the water-local HDR intensity to `8.0` so reflected sky highlights shine above the blue water body.
- [x] Render the authored fake god-ray planes only in the settled default camera view; disable them throughout follow/orbit and the return transition.
- [x] Give coarse, medium, and fine wave pairs descending displacement magnitudes while preserving the existing `0.119 WU` maximum summed excursion.
- [x] Collect desktop and physical-phone visual/performance review and Jeremy release approval.

Review gates:
- [x] The ceiling reads as calm moving water, not cloth, chrome, or a noisy special effect.
- [x] No rectangular plane edge appears during upward camera angles.
- [x] Fish remain legible and normal tank performance remains stable on phone.

### Larger Sardinella schools

Status: `Archive candidate`

Reference:
- Jeremy asked to increase the code-level school-size cap from 64 to 180 after adding 187 production Sardinellas.
- Branch: `feat/sardinella-school-size`; accepted for clean `v0.12.3` release from `v0.12.3-dev_1` after Jeremy approval.

Subtasks:
- [x] Raise the shared-school cap to 180 while preserving Mahi-mahi's explicit pair cap.
- [x] Build and browser-smoke `v0.12.3-dev_1`.
- [x] Collect Jeremy release approval.

Review gate:
- [x] 275 live Sardinellas resolve into two logical schools (180 + 95) without obvious frame-rate or formation regressions.

## Code cleanup / maintenance

### Debug-runtime hardening and maintainability

Status: `Backlog`

Reference:
- Follow-up bucket after clean `v0.8.3` release; deferred while `v0.8.4` shipped the accepted creature-moments repulser v1 slice.
- Deferred from v0.8.3 umbrella #8 after `v0.8.3-dev_11` was accepted.

Why this is next:
- `v0.8.3` shipped the visible debug-toolbar polish and cleanup; the remaining value is making the debug path safer and easier to maintain without changing player-facing feel.
- These are mostly technical gates, so they should be validated by behavior-equivalence checks, build, and a short desktop/mobile smoke pass rather than long visual review.

Subtasks:
- [ ] Gate sardine debug globals out of normal runtime while preserving debug/LOD opt-in.
- [ ] Review and split `Fish.jsx` only where it reduces risk/complexity; preserve strict behavior equivalence.
- [ ] Decide and wire the local debug channel at `fish.chiayong.com`.

Review gates:
- Normal public build has no leaked sardine/debug globals unless debug is explicitly enabled.
- Debug mode still shows creature counts, LOD 0/1/2, frustum counts, and selected-creature readouts.
- Follow camera, mobile debug strip, compact mobile version label, and audio unlock behavior remain unchanged.
- `npm run build` passes and browser smoke confirms both normal and debug entry paths.

### Maintenance backlog

#### Creature data backup hygiene

Status: `Backlog`

Reference:
- Backups are JSON snapshots/diffs under `.supabase-creature-backups/`, not Markdown.
- Latest committed production snapshot after `v0.8.3`: `.supabase-creature-backups/snapshots/2026-06-03_03-49-58-066Z_creatures.json`.
- Latest production read during the `v0.12.2` documentation refresh: 95 active creatures = 88 `amblygaster-sirm` + 5 `coryphaena-hippurus` + 1 `isurus-oxyrinchus` + 1 `mola-alexandrini`. `creatures_dev` was not compared in that read.

Subtasks:
- [ ] Before direct Supabase creature writes, run `npm run backup:creatures`; verify after writes and back up again.
- [ ] If creature data starts changing often, consider adding a small report script for count/species/size diffs instead of reading raw JSON.

#### Roadmap hygiene

Status: `Backlog`

Subtasks:
- [ ] When new release blockers or TODO lists come up in chat, add them here with relevant dev patch/bucket version references.
- [ ] When actively working an item, move/set it to `Current in development`.
- [ ] When an item is completed and pushed to clean public release, remove it from active sections or archive it under a dated/archive section.
- [ ] Keep ordering: current work first, then priority, then chronological discovery order unless Jeremy/YK manually asks to reorder.

## Feature backlog

Future content ideas and parked experiments. None of these are in flight — promote to `Current work` when picked up.

#### Small-fish follow / trail moment

Status: `Backlog`

Reference:
- Deferred follow-up from creature-moments repulser v1 (clean `v0.8.4`): consider a separate small-fish follow/trail moment later without making it feel magnetized.

Subtasks:
- [ ] Add an optional, rare follow/trail response for small fish behind a larger creature, kept soft and observed rather than scripted.

#### Shared deterministic world clock / same living moment

Status: `Backlog`

Reference:
- Parked feature from deleted branch `hold/shared-world-clock-unassigned` (`936c65d`) after Jeremy asked whether World Oceanarium could feel like it is always running for everyone: person A and B see the same broad tank moment, and returning an hour later feels like one hour elapsed instead of a fresh random restart.
- Preferred technical direction was lightweight deterministic world time: shared epoch + stable seeded schedules, not an always-on server simulation.

Subtasks:
- [ ] Rebuild from current `main` if reopened; do not resurrect the stale branch directly.
- [ ] Add a canonical world epoch and elapsed-time helper.
- [ ] Replace startup randomness with deterministic seeds derived from stable creature/school IDs and world time.
- [ ] Seed school route/progress/formation phase so reloads at the same clock time land in the same broad scene.
- [ ] Seed solo-agent startup phase so returning later feels elapsed, not rebooted.
- [ ] Keep visitor-local UI state separate from shared world state.
- [ ] Visual pass: confirm the same living moment feels alive rather than mechanical.

#### Sardine procedural animation feel

Status: `Backlog`

Reference:
- Parked feature from deleted branch `feature/procedural-sardine-animation` (`a956537`) after Jeremy judged the procedural sardine direction not working well enough for the release path.
- `v0.8.5-dev_14` refined sardine snap presets, removed idle/micro-correct/startle-flick lab presets, removed tank-view micro-correct/startle-flick moments, and remapped drift to cruise.
- Keep sardines on authored animation clips for now; revisit movement-input procedural posing only in a future version if there is a stronger authored-feel plan.

Subtasks:
- [ ] Rebuild from current `main` if reopened; do not resurrect the stale branch directly.
- [ ] Preserve as an incomplete/future-version experiment only.
- [ ] Do not reintroduce procedural sardine snap/micro-correct/startle-flick behavior unless explicitly promoted later.
- [ ] If reopened, rebuild procedural sardine posing around live movement inputs without losing the feel/readability of authored clips.

#### Rejected/saved visual experiments

Status: `Backlog`

Reference:
- `v0.8.0-dev_107` appendage-only/outline-related experiment was visually rejected; preserve useful dev-bucket knowledge without returning it to main unless explicitly asked.
- Parked/deleted branch `dev/screen-space-outline` (`1499d47`) used screen-space selection outlines. It was already an ancestor of `main` before deletion, but keep the idea here as a future visual experiment note rather than a live branch.

Subtasks:
- [ ] Do not resurrect screen-space outlines directly unless Jeremy/YK explicitly reopen the visual direction.
- [ ] If reopened, rebuild from current `main` and judge it against readability/feel on desktop and phone, not just technical correctness.
- [ ] If a future visual experiment looks bad, revert main quickly while preserving the experiment in a separate dev branch/bucket for reference.
- [ ] Document branch/bucket name here when such a saved experiment is created.

#### New tank / depth-zone content

Status: `Backlog`

Reference:
- From the tank assemblages work (clean `v0.9.0`): The Drift stays in `epipelagic` for now — revisit a twilight/mesopelagic depth zone later.
- Open backlog decision: whether Supabase `creatures` need per-tank seeding beyond the static-dev set.

Subtasks:
- [ ] Decide whether Supabase `creatures` need per-tank seeding beyond the static-dev set.
- [ ] Consider a twilight/mesopelagic depth zone as a home for The Drift or a new tank.

#### Tank switcher scalability

Status: `Backlog`

Revisit when a 3rd/4th tank lands — the inline pill does not scale past ~4. Full write-up in `docs/tank-design.md`.
- Phase 1 (now, 2–4 tanks): inline segmented pill switcher. Keep.
- Phase 2 (~5–8 tanks): group by biome. Switcher becomes biome-scoped; promote the biome choice to a lightweight lobby. Entry point already exists — `TankView` has a latent `onBack` → "Back to biome menu" hook that `App` does not currently wire up.
- Phase 3 (many tanks / depth stratification): two-axis navigator. `DEPTH_ZONES` exists but is unused for navigation; model is pick biome → move vertically through depth zones (scroll-down = deeper) with tanks as stops. Turns the depth axis from a label into real navigation.
- Data model already supports all phases (`tank.biome`, `tank.depthZone` are the grouping keys); only the navigation UI changes.

## Released / archived

Newest first. Each entry shipped as a clean public release and was drained here per the roadmap-hygiene rule.

### v0.12.2 — Persistent tank sessions

Status: accepted and promoted as clean `v0.12.2`; Jeremy cleared the visual pass and requested no further changes.

Reference:
- PR: `#63` (`persist-tank-session`).
- Active-tank-only rendering remains intact; hidden tanks freeze rather than consuming background simulation time.

Subtasks:
- [x] Persist each creature's continuity-critical runtime state by creature id across tank unmount/remount.
- [x] Resume position, heading, velocity, committed boid steering, simulation clock, and seed/reset gates without an origin flash or spawn reset.
- [x] Prune runtime snapshots when the live creature set changes.
- [x] Preserve page reload as the intentional fresh-session boundary.
- [x] Build/lint and production deployment passed.
- [x] Jeremy visual pass cleared; no change needed.

Optional future refinement (not release-blocking):
- Persist the shared school migration goal if schools should resume the exact same travel direction; members already resume without teleporting.

### v0.12.1 — Frozen-mahi regression fix

Status: shipped as clean `v0.12.1` after validation against the live production creature set.

Reference:
- Production had five Mahi-mahi, leaving one unpaired creature outside the schooling path.

Subtasks:
- [x] Route every creature not currently in a school through solo roaming, including orphaned members of normally-schooling species.
- [x] Verify all five live Mahi-mahi translate normally; paired and solitary species behavior remains intact.

### v0.12.0 — Unified boids movement

Status: accepted and promoted as clean `v0.12.0` from `v0.12.0-dev_12` after Jeremy approval.

Reference:
- PRs: `#61` (boids-only movement and spline removal) and `#62` (unified schools/solo integrator).

Subtasks:
- [x] Move every creature onto one steer → boids → turn-cap → integrate → clamp pipeline.
- [x] Remove the remaining spline/path plumbing and obsolete solo runtime-envelope machinery.
- [x] Fix Mahi-mahi freeze/backward-swim behavior and preserve coherent sardine clouds / mahi pairs.
- [x] Keep the Mako submerged, visible, smooth at boundaries, and stable in follow mode.
- [x] Preserve Mola sun-bask, depth excursions, surface ceilings, and deep-exit recovery.
- [x] Validate schools, Mako, Mola, cross-species threat response, build, and lint.

### v0.11.0 — Visual/UI refinement

Status: accepted and promoted as clean `v0.11.0` after the visual/UI review pass.

Subtasks:
- [x] Reduce surface domination without changing FOV/position scale cues.
- [x] Remove background/god-ray/seabed seams exposed by orbiting.
- [x] Make follow mode bone-aware, closer, full-yaw, tank-switch safe, and resilient to debug remounts.
- [x] Restrict debug vectors/labels to the selected creature and resolve switcher/debug/mobile overlaps.
- [x] Dispose the biome floor material correctly and expose missing follow-bone diagnostics.

### v0.10.0 — Boid schooling overlay

Status: accepted and promoted as clean `v0.10.0` from `v0.10.0-dev_14` after Jeremy feel review. Lint clean, production build passes.

Reference:
- Jeremy shared a classic boids logic screenshot — separation / alignment / cohesion / speed limit — and asked whether WO can adopt it.
- Branch: `feat/boid-schooling-overlay`.
- `v0.10.0-dev_1` prototypes local boid steering as an overlay on existing shared school paths, keeping the path as calm migration/current bias while nearby schoolmates add capped alignment and cohesion.
- `v0.10.0-dev_2` removes the legacy standalone separation pass, makes boid separation/alignment/cohesion the generic steering layer for all species, and adds species-specific biases for sardines, Mahi-mahi, and Giant Sunfish.
- `v0.10.0-dev_3` exposes boid debug vectors/readouts in debug mode so review can see separation, alignment, cohesion, and final steering.
- `v0.10.0-dev_4` disables spline/path-follow movement so schools now swim from local heading plus boid steering instead of following a hidden route.

Subtasks:
- [x] Create `feat/boid-schooling-overlay` branch from latest `origin/main`.
- [x] Add local alignment/cohesion steering beside existing separation avoidance for schooling fish.
- [x] Replace standalone separation with generic interspecies boid steering for all species.
- [x] Add species-biased boid parameters: sardine high-neighbor schooling, Mahi one-neighbor pair bias, Giant Sunfish low self-avoid / high repulsion.
- [x] Add debug vectors/readouts for separation, alignment, cohesion, and final boid steering.
- [x] Disable spline/path-follow movement for the boid review build.
- [x] `v0.10.0-dev_5` Fix jitter: commit each fish to a boid decision for ~one animation cycle (clamped, per-fish jittered) instead of steering every frame; select a stable nearest-N neighbor set instead of registry-iteration order.
- [x] `v0.10.0-dev_5` Add species reaction hierarchy — `menace`/`wariness` per species; prey flee the mako at a wide radius, nobody minds the mola; add missing mako boid profile.
- [x] `v0.10.0-dev_6` Rework debug overlay: focused fish draws relation-colored connectors to each remembered neighbor (green follow / red avoid / gray neutral), a cyan heading tick per neighbor, and a magenta threat vector; webs gated to the focused fish to stay legible.
- [x] `v0.10.0-dev_7` Suppress boid steering during the mola sun-bask so authored behavior owns the path.
- [x] `v0.10.0-dev_8` Fix schools clumping: re-enable a soft travel destination (school path far exit + intermediate waypoints) with boids as the local overlay; `SCHOOL_TRAVEL_ENABLED` flag, position stays boid-driven.
- [x] `v0.10.0-dev_8` Body-length turn-radius kinematics for schools and solo agents so creatures arc forward through turns instead of pivoting/strafing (`turnRadiusBodyLengths` per species, `maxTurnRadiansForSpeed` = speed/radius).
- [x] `v0.10.0-dev_8` Cut over-frequent swim SFX via a longer global ambient throttle (1.15s) with a responsive follow gap (0.3s).
- [x] `v0.10.0-dev_9` Pitch safeguard: derive visual pitch from actual per-frame vertical travel, not target direction, so hovering fish read level (no swim-bladder look) while genuine ascents/descents still pitch.
- [x] `v0.10.0-dev_9` Clamp per-bone curve-deform turn bend to `maxAngle` so mahi/mako tails stop over-rotating into a kink on sharp turns.
- [x] `v0.10.0-dev_9` Solo turns purely arc-radius based (dropped the fixed-degree cap that widened the effective radius and caused boundary sweeps); mako/mola bank through turns at swim speed.
- [x] `v0.10.0-dev_9` Depth diversity: deepen per-species `boundsYMin` by ecology (mahi shallow/surface-associated, mako + mola deep divers) and widen school vertical traversal (`PATH_VERTICAL_TRAVERSAL_BIAS/JITTER`).
- [x] Browser-smoke both tanks; lint clean, production build passes, no runtime errors.
- [x] `v0.10.0-dev_10` Fix mahi freezing in a C-curl while turning: raise mahi `turnTriggerThreshold` (0.03 → 0.3) so gentle arcs stay on the looping idle clip and bank via curve-deform instead of firing the 5.61s snap; clamp only the static curve-deform bend (keep follow-through/idle-sway oscillation so the tail keeps waving); scale mahi spine bend with turn magnitude (`turnIntentScale` 5.5 → 2.2, `strength` 1.55 → 1.2).
- [x] `v0.10.0-dev_11` Ease mahi curve-deform bend back to straight as forward travel slows (`speedEase01` input + `easeStraightenBySpeed`/`straightenFloor`), so the tail straightens on turn-exit instead of holding a one-sided bend while crawling.
- [x] `v0.10.0-dev_12` Stop mahi tail spinning in circles during turns: mapped mahi `turnLeft`/`turnRight` to the looping `idle` clip (like the mako) so turns no longer replay the 5.61s non-looping snap-sweep clip; the mahi swims continuously and banks via curve-deform.
- [x] `v0.10.0-dev_13` Fix mahi held C-curl during turns: its curve-deform was driven by sustained heading misalignment (the mako's is unused, driven only by per-frame turn rate) and saturated the 5-bone spine. Lowered `maxAngleDegrees` 16 → 8, `turnIntentScale` → 0.25, `strength` → 1.0 so the mahi banks in a subtle curve, not a curl.
- [x] `v0.10.0-dev_14` Widen horizontal swim volume ~1.5x (`GLOBAL_X_DESTINATION_RANGE_SCALE` 0.9 → 1.35) so fish swim off-screen left/right, hiding boundary hard-reset u-turns and decluttering. Widen turn radii (`turnRadiusBodyLengths` per species; default → 2.5) so opposite-direction retargets sweep wide instead of pivoting.
- [x] Jeremy feel review (dev_14): accepted with reju — fish use the full width and swim off-frame to hide resets / declutter; opposite-direction retargets read as wide arcs; mahi banks gently (no C-curl/spin); pitch relaxes when hovering; vertical spread. Promoted to clean `v0.10.0`.

Post-release follow-ups (not release-blocking):
- Radii now exceed the tank depth so u-turns exit frame and may hard-reset off-screen (intended). Revisit only if an on-screen reset becomes visible.
- Movement briefly throttles near a close follow-target on some opposite retargets (possible residual on-the-spot rotation) — could keep forward momentum through turns.
- Mahi `snap_left`/`snap_right` clips are unused for turns — repurpose for sharp evasive turns later if wanted.
- Later `v0.12.0` movement verification reconfirmed the full Mola approach → hold → exit bask sequence and unified turn/travel behavior; Jeremy's `v0.12.2` visual pass is cleared. No on-device visual gate remains open from this release.
- Tuning knobs: `GLOBAL_X_DESTINATION_RANGE_SCALE`, per-species `turnRadiusBodyLengths`, `boundsYMin`, curve-deform `turnIntentScale`/`maxAngleDegrees`/`straightenFloor`, audio `SFX_AMBIENT/FOLLOW_MIN_GAP_SECONDS`.

Accepted gates:
- Sardines travel as a school toward a destination (not clumping in place), reading alive and locally responsive, not chaotic or jittery.
- Creatures bank through turns on a body-length radius — forward motion during turns, no pivoting/strafing/drifting.
- Mahi-mahi pair behavior and Mola solo behavior remain unchanged in intent; sun-bask still fires.
- Cross-species reaction reads: bait steers clear of the mako, tolerates the mola.
- Swim audio is occasional ambient texture, not a constant stream.
- Build passes and desktop browser smoke shows no runtime errors.

Tuning knobs (in `src/data/species.js` per-species `swim.boids`/`swim`, and constants in `Fish.jsx`):
- Per species: `menace`, `wariness`, `neighborCap`, `perceptionBodyLengths`, `separation/alignment/cohesion/maxWeight`, `turnRadiusBodyLengths`.
- Global (`Fish.jsx`): `BOID_DECISION_MIN/MAX_INTERVAL`, `BOID_DECISION_JITTER`, `BOID_THREAT_PERCEPTION_SCALE`, `BOID_THREAT_WEIGHT`, `DEFAULT_TURN_RADIUS_BODY_LENGTHS`, `SCHOOL_TRAVEL_ENABLED`.
- Audio (`useOceanAudio.js`): `SFX_AMBIENT_MIN_GAP_SECONDS`, `SFX_FOLLOW_MIN_GAP_SECONDS`.

### v0.9.0 — Tank assemblages & curation

Status: accepted and promoted as clean `v0.9.0` (merged to `main`) after Jeremy chat approval. Lint clean, production build passes.

Reference:
- Jeremy felt the pelagic ocean tank read as "rojak" (a haphazard mix): a slow-drifting sunfish sharing water with fast pursuit hunters. Root cause — a "tank" was just a biome and rendered every creature tagged with it, with no curation layer.
- Branch: `feat/tank-assemblages`.
- Design doc: `docs/tank-design.md` (full model + how to edit by hand).
- Approach approved in chat: hybrid membership — tanks list species explicitly (deliberate curation) and species carry a `tempo` so a dev-only coherence guard can flag drifter/fast-swimmer clashes.

Subtasks:
- [x] Add `tempo` (`drift`/`cruise`/`sprint`) to the four ocean species.
- [x] Add `TANKS` curation layer + `DEFAULT_TANK_ID` in `species.js`; split the roster into `open-sea` (bait → mahi → mako) and `the-drift` (sunfish).
- [x] `creaturesForTank` resolver + dev coherence guard in `speciesLookup.js`.
- [x] Filter `Biome` by active tank (biome still drives environment); `TankView` shows tank name.
- [x] `activeTankId` state + bottom-center tank switcher in `App.jsx` + styles.
- [x] Per-tank description above the switcher (one line on desktop, wraps only when the viewport is too narrow).
- [x] Per-tank visual signature: `seed` varies surface caustics + background mottle; optional `lighting` palette overrides (The Drift reads calmer/dimmer).
- [x] Document the model in `docs/tank-design.md` and update `AGENTS.md` paths.
- [x] Jeremy review: switcher placement/feel, names/taglines/descriptions, and The Drift lighting — all approved.
- [x] Decision: The Drift stays in `epipelagic` for now (revisit a twilight depth zone later — see Feature backlog).

(Open follow-ups moved to Feature backlog: per-tank Supabase seeding, twilight depth zone, switcher scalability phases 2/3.)

### v0.8.20 — Underwater depth & atmosphere pass

Status: accepted and promoted as clean `v0.8.20` from `v0.8.20-dev_1` after Jeremy approval.

Reference:
- Jeremy asked to fix visual-feel problems from the upward camera: no depth cues, scale mismatch (mola not reading as huge), empty top two-thirds, god rays reading as a pasted decal, and no marine snow.
- Branch: `feat/underwater-depth-atmosphere`.
- Direction approved in chat: deep saturated ocean blue (not teal), luminous surface with bottom-up light absorption; atmosphere-only fill for the empty column (no fake creatures); sunfish bumped to factual 3.3 m.

Subtasks:
- [x] Depth cues: dedicated moody background gradient + aerial-perspective fog haze, decoupled from creature-lighting env map.
- [x] Marine snow: densify (96 → 240) and redistribute into the creature/camera column with sink + height glow.
- [x] God rays: fan divergence from an off-screen sun + dusty grain octave so they read volumetric.
- [x] Scale: Giant Sunfish to factual 3.3 m (`bodyLengthWU` 13.2, GLB `scale` 0.638); verify other species proportionate.
- [x] Camera: ease resting up-pitch (`lookY` 0.35 → -1.5) so fish can occupy the top half of frame.
- [x] Collect Jeremy feel review across color/banding/absorption/UI-stacking iterations; accepted and promoted to clean `v0.8.20`.

Accepted gates:
- Distant creatures fade/desaturate into haze; near subjects keep form and color.
- Mola reads dramatically larger than the mahi-mahi.
- God rays read as volumetric light, not a flat decal layer.
- Build passes.

### v0.8.19 — Shortfin Mako Shark import

Status: accepted and merged to `main` (mako shark branch merge) from `v0.8.19-dev_3` after animation/movement smoothing. Species is live (`Isurus oxyrinchus` in `src/data/species.js`) and later integrated as a boid profile / deep diver in `v0.10.0`.

Reference:
- Jeremy supplied `short fin mako.zip` and asked to add it on a new branch.
- Branch: `feat/shortfin-mako`.

Subtasks:
- [x] Inspect supplied GLB source scale, mesh count, rig, and animation clips.
- [x] Add `Isurus oxyrinchus` species data, tank model path/scale, movement profile, and static-dev review creature.
- [x] Add Atlas source-length scaling and fixed pose for the mako GLB.
- [x] Add one canonical `isurus-oxyrinchus` row to `creatures_dev` for Vercel review, with before/after JSON backups.
- [x] Build/lint/browser-smoke the first review build.
- [x] Patch mako animation snap by keeping burst movement on the continuous swim loop (`v0.8.19-dev_2`).
- [x] Address Jeremy feedback that mako movement was still snappy and the animation was barely visible (`v0.8.19-dev_3`).
- [x] Merged to `main`; scale/feel accepted (later refined via the `v0.10.0` boid + depth passes).

Accepted gates:
- Mako reads as a solitary fast pelagic shark: long committed glides, broad turns, rare acceleration.
- Atlas scale shows the supplied 40.18-unit source model as a 4.0 m review maximum beside the diver.
- Build passes.

### v0.8.18 — Push-away boundary review

Status: accepted and promoted as clean `v0.8.18` from `v0.8.18-dev_3` after Jeremy approval (`reju`).

Reference:
- Jeremy asked for a new branch to push everything away from the camera, then clarified not to move camera/follow constants because swim/reset boundaries are hard-coded.
- Branch: `feat/push-away-camera`.

Subtasks:
- [x] Create fresh branch/worktree from `origin/main`.
- [x] Revert camera/follow-distance pullback from `v0.8.18-dev_1`.
- [x] Push swim boundary start/end Z planes farther away from camera (`-15 WU` in `v0.8.18-dev_3`).
- [x] Keep solo-agent hard reset/runtime envelope derived from shifted swim bounds.
- [x] Build/lint/browser-smoke review build.
- [x] Collect Jeremy/YK feel review — Jeremy approved with `reju`.

Accepted gates:
- [x] Desktop tank default view keeps original camera feel while fish swim farther from camera.
- [x] Follow mode keeps original zoom constants but targets shifted fish positions cleanly.
- [x] No boundary/reset fighting near the front plane.
- [x] No blank/empty first view on phone-sized smoke.

### v0.8.17 — Vercel Speed Insights

Status: accepted and promoted as clean `v0.8.17` from `v0.8.17-dev_1` after Jeremy approval.

Accepted gates:
- Speed Insights package installed and injected once beside Vercel Analytics.
- Main CI passed after merge and clean-version correction.
- Vercel production deployment completed successfully.

Implementation summary:
- Adds `@vercel/speed-insights` and renders `<SpeedInsights />` at the app root.

### v0.8.15 — Mahi-mahi spline-follow body deformation

Status: accepted and promoted as clean `v0.8.15` from `v0.8.15-dev_15` after Jeremy approval.

Reference:
- Jeremy rejected speed-only Mahi-mahi movement tuning and asked whether a general curve deformation can ride on top of the authored animation while the fish follows the spline.
- Jeremy reviewed `v0.8.15-dev_2` and said deformation was not enough; `v0.8.15-dev_3` raises the visible bend while keeping the same additive-after-mixer architecture.
- Jeremy screenshot review of `v0.8.15-dev_3` showed fish still flat in turns. Cause: GLB runtime bone names are `spine001`–`spine007` and the bend axis should be local `z`, so previous deformation was either not finding bones or twisting instead of side-bending.
- Jeremy review of `v0.8.15-dev_4` showed catastrophic pretzel deformation; emergency rollback was `v0.8.15-dev_5` with curve deformation disabled until additive posing was non-accumulating and safely previewed.
- Jeremy rejected leaving deformation disabled; `v0.8.15-dev_6` restores visible deformation with previous-additive removal and safer visible strength.
- Jeremy asked to show bones in debug; `v0.8.15-dev_7` adds a default-on `B` overlay for curve-deform bone chain visibility.
- Jeremy refined bone debug: smaller labels, all bones on selected creatures, unavailable in `View all`, and selected schooling fish should show their shared movement/follow spline.
- Jeremy added male/female Mahi-mahi GLBs and asked for general school logic that mixes available sex variants at approximately 1:1, exactly 1:1 for two-creature Mahi pairs.
- Jeremy asked for selected bone-name fonts to be billboards, unbold, and always rendered in front.
- Jeremy asked for bone-name fonts even smaller, matching the selected name label font.
- Jeremy noticed the forward vector coming from mid-body; GLB origin/pivot is near mid-body, but debug heading should start at the nose.
- Jeremy asked to increase spline deformation while only touching `spine003` through `spine007`.
- Jeremy review of `v0.8.15-dev_13`: effect still not visible; Mahi still seems to rotate on the spot with a flat/straight body. It should bend/curl in the direction it is turning.
- Jeremy review of `v0.8.15-dev_14`: better, but the Mahi curve can be slightly stronger down-chain, random pitch snaps should be eliminated or interpolated, and generated school splines should preserve incoming direction and delay the first turn for all schooling fish.

Subtasks:
- [x] Keep authored GLB animation playback first and additive deformation after mixer update.
- [x] Add model-level deformation tunables for strength, max angle, response, tail bias, burst boost, and speed boost.
- [x] Drive Mahi-mahi spine deformation from live path/follow turn pressure without changing accepted movement speeds.
- [x] Build and browser-smoke `v0.8.15-dev_2`.
- [x] Increase deformation and browser-smoke `v0.8.15-dev_3`.
- [x] Fix bone-name matching / bend axis and browser-smoke `v0.8.15-dev_4`.
- [x] Emergency-disable curve deformation in `v0.8.15-dev_5` after `dev_4` deformation failure.
- [x] Restore non-accumulating deformation and browser-smoke `v0.8.15-dev_6`.
- [x] Add curve-deform bone debug overlay and browser-smoke `v0.8.15-dev_7`.
- [x] Refine selected-creature all-bone debug overlay and browser-smoke `v0.8.15-dev_8`.
- [x] Add Mahi male/female variants plus balanced school sex-model assignment and browser-smoke `v0.8.15-dev_9`.
- [x] Make bone-name labels billboards, normal weight, front-rendered and browser-smoke `v0.8.15-dev_10`.
- [x] Shrink bone-name labels to match selected name label font and browser-smoke `v0.8.15-dev_11`.
- [x] Move model forward-vector debug start to Mahi nose/head offset and browser-smoke `v0.8.15-dev_12`.
- [x] Increase Mahi spline deformation and restrict curve-deform bones to `spine003`-`spine007`; browser-smoke `v0.8.15-dev_13`.
- [x] Drive Mahi curve deformation from sustained follow-spline turn intent, add base `spine003` bend, and browser-smoke `v0.8.15-dev_14`.
- [x] Add 1.05× down-chain bend multiplier, smooth pitch changes, preserve new-school-spline direction, and browser-smoke `v0.8.15-dev_15`.

Accepted gates:
- Mahi-mahi no longer reads as a rigid root rotating through curves.
- Idle/burst/snap authored clips still play at accepted timing.
- Deformation strength can be dialed or disabled from species/model config.

### v0.8.14 — Hotfix: follow camera retargeting

Status: accepted and promoted as clean `v0.8.14` from `v0.8.14-dev_1` after Jeremy approval.

Reference:
- Jeremy reported that follow cam cannot jump to another fish while already following; a tap exits follow cam before the new fish can be selected.
- Root cause: follow-mode pointerdown captured the pointer immediately for possible orbit drag, so direct fish taps in follow mode could be retargeted to the stage and interpreted as a follow-mode exit.

Subtasks:
- [x] Move pointer capture from follow-mode pointerdown to the moment an orbit drag is actually confirmed.
- [x] Keep empty-water tap exiting follow mode.
- [x] Keep orbit-drag release suppression so releasing over another fish does not accidentally retarget.
- [x] Build and browser-smoke `v0.8.14-dev_1`.
- [x] Promote clean `v0.8.14` after approval.

Accepted gates:
- [x] While following fish A, direct tap fish B switches follow target to B without an intermediate exit.
- [x] While following fish A, drag-orbit then release over fish B keeps following fish A.
- [x] Empty-water tap still exits follow mode.
- [x] `npm run build` passes and local browser smoke shows clean `v0.8.14`.

### v0.8.13 — Hotfix: mobile empty tank on clean deployment

Status: accepted and promoted as clean `v0.8.13` from `v0.8.13-dev_1` after Jeremy approval.

Reference:
- Jeremy reported clean `v0.8.12` mobile showed UI/water/version but no visible fish on the Vercel deployment URL.
- Local reproduction with missing browser Supabase env vars showed `0/0` debug load and the same visually empty tank because clean builds did not use static fallback.
- Local mobile smoke with real Supabase data showed fish visible, so the hotfix target is missing-env release fallback, not mobile camera framing.

Subtasks:
- [x] Reproduce the empty tank on clean `v0.8.12` with missing browser Supabase env vars.
- [x] Verify production creature data contains 88 `amblygaster-sirm`, 1 `mola-alexandrini`, and 4 `coryphaena-hippurus`.
- [x] Ship `v0.8.13-dev_1` fallback for missing-env deployments only, with bundled release creature rows matching production counts.
- [x] Mobile-smoke the missing-env path and the real-data path.
- [x] Jeremy approved `v0.8.13-dev_1` for clean `v0.8.13` promotion.

### v0.8.10 / v0.8.12 — Mahi mahi

Status: accepted and promoted as clean `v0.8.10` (from `v0.8.8-dev_16`) and reopened/finished as clean `v0.8.12` (from `v0.8.12-dev_13`) after Jeremy approval.

Reference:
- `v0.8.8-dev_1` starts the isolated Mahi mahi implementation branch from clean `v0.8.7`.
- `v0.8.8-dev_2` shrinks tank-view Mahi-mahi and expands school spacing after Jeremy review: previous fish read too large and tight schooling risked spin-in-place behavior.
- `v0.8.8-dev_3` makes the wired `snap_left` / `snap_right` turn clips visible again after Jeremy reported not seeing turning animations in `dev_2`.
- `v0.8.8-dev_4` reduces the unnatural abruptness from `dev_3` by making snap turns rare/short accents with softer fades and smoother path variation.
- `v0.8.8-dev_10` keeps the stacked Atlas species-group review moving: schooling Atlas groups now use per-fish phase/speed/burst offsets, with Jeremy's latest Mahi-mahi and Giant Sunfish diver silhouette placements.
- `v0.8.8-dev_11` updates Atlas lifecycle facts from Jeremy's notes for Mahi-mahi and spotted sardinella.
- `v0.8.8-dev_12` uppercases Atlas species-list common names for consistency with the right info panel.
- `v0.8.8-dev_13` pushes the spotted sardinella upper-left companion deeper behind the diver silhouette after Jeremy's marked screenshot.
- `v0.8.8-dev_14` restores the spotted sardinella hero position and moves the deeper background companion downward so it remains visible behind the hero.
- `v0.8.8-dev_15` moves that deeper spotted sardinella background companion farther down after Jeremy's follow-up mark.
- `v0.8.8-dev_16` corrects the marked spotted sardinella companion: restores the left-deep companion and moves the lower-left background companion farther down beneath the hero.
- `v0.8.12-dev_1` reopens the Mahi-mahi branch after the accidental merge: keeps Mahi-mahi hidden from Atlas, removes adult Mahi-mahi from schooling behavior, and moves it onto the faster solo-agent movement path for solo/pair adult travel.
- `v0.8.12-dev_2` unhides Mahi-mahi in The Atlas for species-page review.
- `v0.8.12-dev_3` fixes Mahi-mahi solo-agent drift/glitchiness by aligning turn/burst triggers to the current visible forward vector and increasing only Mahi-mahi's solo steering rate so turns read as forward swimming.
- `v0.8.12-dev_4` fixes Mahi-mahi blitzing up/down across the screen by constraining solo-agent vertical target changes and reducing the Mahi-mahi speed envelope.
- `v0.8.12-dev_5` fixes the follow-up Mahi-mahi solo-agent glitches: edge recovery no longer snaps all the way back to inner swim bounds, live course corrections keep the continuous swim loop rather than forcing snap-left/right clips, and burst movement duration now stays inside the authored burst clip.
- `v0.8.12-dev_6` adds Jeremy's supplied Mahi-mahi portrait as the Atlas species-list thumbnail.
- `v0.8.12-dev_7` locks Mahi-mahi GLB animation clips to authored 1× speed, restores snap-left/right turn clips with shorter blending, and tightens/slows solo U-turns so turn motion reads forward instead of backward drift.
- `v0.8.12-dev_8` switches Mahi-mahi to shared pair-group movement capped at two fish per group, reusing the sardine-style pathing blueprint while keeping adult social copy as solo/pairs. Mahi clips stay in-place: idle default, burst/turn animations as accents, movement translation handled by simulation. Static-dev fallback now carries ten `coryphaena-hippurus` rows so local/no-env review also forms pairs.
- `v0.8.12-dev_9` keeps Mahi-mahi authored snap-left/right clips at 1× and lets them play for their full GLB duration after a turn trigger; movement still uses the short turn impulse, so the fish does not get five seconds of forced translation.
- `v0.8.12-dev_10` applies Jeremy's global animation-speed rule: base GLB playback is 1×, each individual varies only from 0.9× to 1.1× regardless of species, and sardinella action holds are long enough for burst/snap clips to finish before returning to idle.
- `v0.8.12-dev_11` fixes Mahi-mahi/schooling authored action recovery: one-shot snap/burst clips now hand back to the cruise/drift loop after their hold when no new snap or burst is triggered.
- `v0.8.12-dev_12` delays only the Mahi-mahi burst movement impulse by 0.45s so it lands with the authored burst body action, while the GLB burst clip plays through at 1×.
- `v0.8.12-dev_13` makes the authored-action movement delay an explicit model override with a 0s default, and raises Mahi-mahi's burst movement delay override to 0.8s after Jeremy's review.
- Jeremy approved `v0.8.12-dev_13` for clean `v0.8.12` promotion.
- Jeremy approved `v0.8.8-dev_16` for clean `v0.8.10` promotion and merge after `v0.8.9` landed on `main` first.

Subtasks:
- [x] Source/prepare Mahi mahi asset and confirm scientific name, scale, orientation, and animation set. Licensing/source approval remains tied to Jeremy-supplied asset provenance.
- [x] Add species data, movement profile, selection copy, static-dev review creatures, and model render path.
- [x] Tune behavior for fast, confident pelagic cruising with readable flashes/turns rather than generic fish movement.
- [x] Reduce tank-view scale and increase loose-school spacing so Mahi-mahi do not dominate the tank or spin in place.
- [x] Retune turn trigger/action timing so authored turn clips fire visibly in the looser-school build.
- [x] Calm abrupt turn feel after review: restore smoother path-led turning and reserve snap clips for larger turns.
- [x] Stage Atlas schooling groups without synchronized/flock-stiff animation, and apply latest approved diver silhouette positions.
- [x] Add Jeremy's supplied Mahi-mahi Atlas thumbnail image.
- [x] Reopen Mahi-mahi adult behavior after accidental merge; move adult Mahi-mahi off schooling and onto a faster solo-agent path for solo/pair travel.
- [x] Fix Mahi-mahi solo-agent drift/glitchy turn triggers so turns use live forward motion instead of stale debug path tangents.
- [x] Fix Mahi-mahi full-screen up/down dashes by limiting vertical target deltas and calming the speed profile.
- [x] Fix follow-up Mahi-mahi teleport/backward/frozen-animation glitches by removing inner-bound recovery snaps, keeping live turns on the continuous swim loop, and shortening burst movement to match the authored clip.
- [x] Restore Mahi-mahi authored snap-left/right visibility, play GLB animations at 1×, and tighten solo U-turn motion.
- [x] Replace solo-agent Mahi-mahi with capped pair-group movement: shared pathing in groups of two, idle as default clip, burst/turn clips as in-place accents with simulation-driven translation.
- [x] Fix Mahi-mahi snap-left/right interruption by decoupling the short movement impulse from the full authored turn-clip playback duration.
- [x] Set global fish GLB playback to 1× with only 0.9×–1.1× per-individual variation, and extend spotted sardinella action holds so burst/snap clips are not cut off.
- [x] Fix one-shot authored actions freezing on their final frame by returning to cruise/drift after the action hold when no new snap/burst fires.
- [x] Align Mahi-mahi burst movement with the authored burst clip by delaying the speed impulse until the body action begins.
- [x] Make authored action movement delay an explicit model override and tune Mahi-mahi burst delay to 0.8s after review.
- [x] Review whether the pair-group Mahi-mahi movement now reads natural enough in tank view, or needs looser spacing/speed tweaks.
- [x] Verify desktop/mobile performance, follow-camera framing, and creature database backup before release.

### v0.8.9 — Camera position polish

Status: accepted and promoted as clean `v0.8.9` after Jeremy approval.

Released from: `v0.8.9-dev_5`.

Accepted gates:
- Jeremy accepted the final lowered tank camera framing after the phone blank-scene regression was fixed.
- Clean build has no temporary camera/DOF debug controls.
- Jeremy's preview/device pass confirmed the page opens and the accepted framing is visible after the phone blank-scene regression fix.
- Final release judgement: `SHIP`.

Implementation summary:
- Lowers and tightens the default tank camera to `y=-3.35`, `z=10`, `lookY=0.35`, `fov=61`.
- Removes the temporary camera and DOF tuning UI, associated CSS/props/state, and the debug postprocess component.
- Keeps existing debug toolbar controls for creature/debug simulation modes.

### v0.8.6 — UI overhaul + encyclopaedia addition

Status: accepted and promoted as clean `v0.8.6` after Jeremy approval.

Released from: `v0.8.6-dev_62`.

Accepted gates:
- The Atlas entry point, species list, model/scale stage, and species-information panel are accepted for clean release.
- Follow-card Atlas entry uses the compact icon beside the common name without crowding the card.
- Atlas mobile layout scrolls naturally and keeps full-bleed square panels.
- `Amblygaster sirm` and `Mola alexandrini` Atlas data/copy are source-safe and review-approved, with unknown fields left explicit.
- `Mola alexandrini` displays as `Giant Sunfish`; alternate common names stay limited in prose and preserved in metadata.
- Jeremy visual pass accepted the release candidate.
- Final release judgement: `SHIP`.

Implementation summary:
- Adds The Atlas as the field-guide layer for World Oceanarium, with species selection, 3D creature stage, diver scale reference, conservation status, and structured species facts.
- Tightens followed-creature info cards into identity-first field cards with a compact Atlas route beside the name.
- Adds responsive Atlas behavior for desktop and phone, including portrait touch-scroll fallback and full-bleed mobile panels.
- Updates Spotted Sardinella and Giant Sunfish copy/data with safer biological fields, sexed averages, lifecycle rows, and preserved alternate-name search metadata.

### v0.8.5 — Follow mode stability

Status: accepted and promoted as clean `v0.8.5` after Jeremy approval.

Released from: `v0.8.5-dev_3`.

Accepted gates:
- Mobile follow mode keeps the focused creature centered instead of biasing framing around the phone info card or stale cropped-stage pan.
- Orbit-drag release over another creature no longer steals follow target selection.
- Pinch/wheel zoom release over another creature no longer steals follow target selection.
- Touch follow gestures recover after finger-up lands on a fish, so the next orbit/zoom gesture works normally.
- Jeremy visual/device pass accepted the release candidate.
- Final release judgement: `SHIP`.

Implementation summary:
- Separates follow manipulation gestures from creature selection with short selection-suppression windows for orbit, pinch, and wheel zoom.
- Handles touch end/cancel in capture and clears stale pinch state after touch-up so mobile follow controls remain responsive.
- Keeps direct tap-to-select behavior available when there was no orbit/zoom manipulation.

### v0.8.4 — Creature moments (schooling behavior around large fish)

Status: accepted and promoted as clean `v0.8.4` after Jeremy approval (repulser v1). Mobile already looked good.

Reference:
- `v0.8.4-dev_1` starts this feature sequence item and visible review patch.
- `v0.8.4-dev_3` added a temporary forced `repel` debug demo for review; `v0.8.4-dev_4` removes it after Jeremy accepted repulser v1.
- Intended feel: authored animal moments, not quests or gamification — the tank should read less like isolated loops and more like creatures sharing space.

Subtasks:
- [x] Add schooling response where small fish subtly repel/part around large fish passing nearby.
- [x] Keep behavior legible, soft, and rare enough that it feels observed rather than scripted.
- [x] Verify sardine school cohesion, performance, and follow-camera readability on desktop and phone for repulser v1.
- [x] Remove the temporary forced `repel` debug demo before clean public release.
- [ ] Follow-up (moved to Feature backlog): consider a separate small-fish follow/trail moment later without making v1 feel magnetized.

### v0.8.3 — Code hygiene and debug-runtime cleanup

Status: accepted and promoted as clean `v0.8.3` after Jeremy approval.

Released from: `v0.8.3-dev_11`.

Reference:
- GitHub umbrella: #8
- Subtasks: #9, #10, #11, #12, #13

Accepted gates:
- Shared species/hash/body-length helpers extracted.
- Confirmed-unused starter-era components/assets removed.
- Bottom debug bar accepted as flat toolbar with creature-level LOD/frustum wording.
- Mobile debug strip accepted for phone-width usability.
- Normal mobile version label shortened while desktop keeps the full `world oceanarium` label.
- Same-creature follow-camera orbit no longer snaps back after non-limit orbit drags.
- Jeremy visual pass accepted the release candidate.
- Final release judgement: `SHIP`.

Implementation summary:
- Moves debug UI toward a cleaner full-width toolbar and compact mobile layout while preserving debug affordances.
- Keeps follow-camera orbit state stable when duplicate same-creature selection events arrive after drag release.
- Removes unused starter files and centralizes creature helper logic for cleaner future species work.

### v0.8.2 — Follow-camera orbit polish

Status: accepted and promoted as clean `v0.8.2` after Jeremy approval.

Released from: `v0.8.2-dev_2`.

Accepted gates:
- Follow-camera orbit stays constrained by yaw/pitch limits.
- Drag release preserves the held orbit angle instead of snapping back to centered follow framing.
- Restarting a drag from a clamped yaw/pitch limit stays smooth instead of jumping toward center.
- Tap-to-exit follow mode remains preserved when the pointer does not become an orbit drag.
- Jeremy visual pass accepted the held-orbit feel.
- Final release judgement: `SHIP`.

Implementation summary:
- Adds persistent limited follow-camera orbit after Jeremy asked for camera orbiting with limits but no snapback.
- Adds incremental pointer-delta dragging for follow orbit, using the current clamped orbit as the baseline for each move instead of recalculating from the original drag start.
- Keeps horizontal follow orbit at ±36° and vertical pitch at ±30° for safer surface/body framing.

### v0.8.1 — Mola recovery polish

Status: accepted and promoted as clean `v0.8.1` after Jeremy approval.

Released from: `v0.8.1-dev_6`.

Accepted gates:
- Mola slow fade recovery restricted to far negative-Z runtime exits.
- X-axis and positive-Z/front hard recovery no longer fade or snap visibly near the camera.
- Mola cannot remain hidden after a recovery fade.
- Debug-only simulation speed controls accepted as a review aid.
- Mola look-at/root orientation transition smoothing accepted.
- Final release judgement: `SHIP`.

Implementation summary:
- Gates depth fade recovery to negative-Z exits, with an opacity watchdog and immediate retarget/clamp recovery for X/front runtime exits.
- Expands and stages positive-Z/front recovery farther offscreen so boundary correction stays hidden.
- Preserves current heading during visible X/front recovery, avoiding sideways clamp-vector snap-turns.
- Adds debug-only simulation speed controls (`1x`, `4x`, `10x`) for faster chance/timer review.
- Smooths Mola solo-agent look-at orientation with quaternion interpolation and extra easing after behavior/stage changes.

### v0.8.0 — Mola alexandrini + solo-agent movement

Status: accepted and promoted as clean `v0.8.0` after Jeremy approval.

Released from: `v0.8.0-dev_126`.

Accepted gates:
- Mola hard-recovery visibility: fade-out/reposition/fade-in accepted.
- Mola fake-lighting banding: warped/noise-broken mask accepted.
- Follow recovery notice on mobile: accepted.
- Mobile follow-camera zoom/framing: accepted.
- Immediate audio startup / Mobile Safari fallback: accepted for clean release after `v0.8.0-dev_126`.
- Final release judgement: `SHIP`.

Implementation summary:
- Adds Giant Sunfish / `Mola alexandrini` as the first large non-schooling solo-agent creature.
- Replaces placeholder behavior with the uploaded Mola GLB and expected movement/sun-bask clips.
- Builds reusable solo-agent movement, broad smooth steering, depth residency, runtime safety envelope, and follow-camera framing for large creatures.
- Adds Mola near-surface sun-basking lifecycle with approach, roll, hold drift, animation isolation, and smooth exit.
- Improves follow mode for large creatures: adaptive distance/FOV, manual zoom authority, surface-footprint clamps, smooth entry/exit, and recovery notices.
- Hardens audio startup/unlock after direct tank entry, including immediate startup attempts and Mobile Safari gesture fallback.
