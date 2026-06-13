# World Oceanarium Roadmap

Purpose: keep active maintenance work, feature ideas, release blockers, and follow-up notes in one ordered place so review TODOs do not get lost.

Ordering rule: keep code cleanup/maintenance separate from feature work. Within each section, list current work first, then priority, then chronological discovery order. Only reorder manually when Jeremy/YK asks.

Status labels:
- `Current in development` — actively being worked/reviewed in the current dev bucket.
- `Next` — should happen before clean release if current item passes.
- `Blocked / waiting review` — implemented or partially implemented, needs human/device judgement.
- `Backlog` — known follow-up, not blocking current release unless promoted.
- `Archive candidate` — remove or move to archive once completed and pushed to a clean public release.

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
- Latest refreshed production snapshot after `v0.8.3`: `.supabase-creature-backups/snapshots/2026-06-03_03-49-58-066Z_creatures.json`.
- Current live table check: 89 total active creatures = 88 `amblygaster-sirm` + 1 `mola-alexandrini`; `creatures` and `creatures_dev` matched at time of check.

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

## Feature list

### Mahi-mahi spline-follow body deformation

Status: `Current in development`

Reference:
- Jeremy rejected speed-only Mahi-mahi movement tuning and asked whether a general curve deformation can ride on top of the authored animation while the fish follows the spline.
- Implementation target: `v0.8.15-dev_14` repaired deformation review build with visible turn-intent body curl.
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

Review gates:
- Mahi-mahi no longer reads as a rigid root rotating through curves.
- Idle/burst/snap authored clips still play at accepted timing.
- Deformation strength can be dialed or disabled from species/model config.

### Hotfix: follow camera retargeting

Status: `Archive candidate`

Reference:
- Jeremy reported that follow cam cannot jump to another fish while already following; a tap exits follow cam before the new fish can be selected.
- Root cause: follow-mode pointerdown captured the pointer immediately for possible orbit drag, so direct fish taps in follow mode could be retargeted to the stage and interpreted as a follow-mode exit.
- Jeremy approved `v0.8.14-dev_1` for clean `v0.8.14` promotion.

Subtasks:
- [x] Move pointer capture from follow-mode pointerdown to the moment an orbit drag is actually confirmed.
- [x] Keep empty-water tap exiting follow mode.
- [x] Keep orbit-drag release suppression so releasing over another fish does not accidentally retarget.
- [x] Build and browser-smoke `v0.8.14-dev_1`.
- [x] Promote clean `v0.8.14` after approval.

Review gates:
- [x] While following fish A, direct tap fish B switches follow target to B without an intermediate exit.
- [x] While following fish A, drag-orbit then release over fish B keeps following fish A.
- [x] Empty-water tap still exits follow mode.
- [x] `npm run build` passes and local browser smoke shows clean `v0.8.14`.

### Hotfix: mobile empty tank on clean deployment

Status: `Archive candidate`

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

### Active feature bucket

#### 1. Mahi mahi

Status: `Archive candidate`

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
- Jeremy requested this as the next species sequence item after creature moments.

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

### Feature backlog

#### 1. Creature moments — schooling behavior around large fish

Status: `Archive candidate`

Reference:
- `v0.8.4-dev_1` starts this feature sequence item and visible review patch.
- `v0.8.4-dev_3` added a temporary forced `repel` debug demo for review; `v0.8.4-dev_4` removes it after Jeremy accepted repulser v1.
- Jeremy approved repulser v1 for clean `v0.8.4`; mobile already looked good.
- Intended feel: authored animal moments, not quests or gamification — the tank should read less like isolated loops and more like creatures sharing space.

Subtasks:
- [x] Add schooling response where small fish subtly repel/part around large fish passing nearby.
- [ ] Follow-up: consider a separate small-fish follow/trail moment later without making v1 feel magnetized.
- [x] Keep behavior legible, soft, and rare enough that it feels observed rather than scripted.
- [x] Verify sardine school cohesion, performance, and follow-camera readability on desktop and phone for repulser v1.
- [x] Remove the temporary forced `repel` debug demo before clean public release.

#### Sardine procedural snap/micro-correct experiment

Status: `Backlog`

Reference:
- `v0.8.5-dev_14` refined sardine snap presets, removed idle/micro-correct/startle-flick lab presets, removed tank-view micro-correct/startle-flick moments, and remapped drift to cruise.
- Jeremy judged this direction not working well for now; stick to authored animation clips for the current release path.

Subtasks:
- [ ] Preserve as an incomplete/future-version experiment only.
- [ ] Do not reintroduce procedural sardine snap/micro-correct/startle-flick behavior unless explicitly promoted later.

#### Rejected/saved visual experiments

Status: `Backlog`

Reference:
- `v0.8.0-dev_107` appendage-only/outline-related experiment was visually rejected; preserve useful dev-bucket knowledge without returning it to main unless explicitly asked.

Subtasks:
- [ ] If a future visual experiment looks bad, revert main quickly while preserving the experiment in a separate dev branch/bucket for reference.
- [ ] Document branch/bucket name here when such a saved experiment is created.

## Released / archived

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