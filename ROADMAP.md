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

### Current maintenance bucket: v0.8.4 — Debug-runtime hardening and maintainability

Status: `Current in development`

Reference:
- Follow-up bucket after clean `v0.8.3` release.
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

No active feature bucket.

### Feature backlog

#### 1. Creature moments — schooling behavior around large fish

Status: `Current in development`

Reference:
- `v0.8.4-dev_1` starts this feature sequence item and visible review patch.
- Jeremy requested this as the next feature sequence item; promoted to active feature work.
- Intended feel: authored animal moments, not quests or gamification — the tank should read less like isolated loops and more like creatures sharing space.

Subtasks:
- [ ] Add schooling response where small fish subtly repel/part around large fish passing nearby.
- [ ] Add schooling response where small fish can briefly follow or trail a large fish without looking magnetized.
- [ ] Keep behavior legible, soft, and rare enough that it feels observed rather than scripted.
- [ ] Verify sardine school cohesion, performance, and follow-camera readability on desktop and phone.

#### 2. Mahi mahi

Status: `Backlog`

Reference:
- Jeremy requested this as the next species sequence item after creature moments.

Subtasks:
- [ ] Source/prepare Mahi mahi asset and confirm scientific name, scale, orientation, animation set, and licensing.
- [ ] Add species data, movement profile, selection copy, and LOD/render path.
- [ ] Tune behavior for fast, confident pelagic cruising with readable flashes/turns rather than generic fish movement.
- [ ] Verify desktop/mobile performance, follow-camera framing, and creature database backup before release.

#### Rejected/saved visual experiments

Status: `Backlog`

Reference:
- `v0.8.0-dev_107` appendage-only/outline-related experiment was visually rejected; preserve useful dev-bucket knowledge without returning it to main unless explicitly asked.

Subtasks:
- [ ] If a future visual experiment looks bad, revert main quickly while preserving the experiment in a separate dev branch/bucket for reference.
- [ ] Document branch/bucket name here when such a saved experiment is created.

## Released / archived

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
