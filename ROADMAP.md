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