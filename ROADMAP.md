# World Oceanarium Roadmap

Purpose: keep active work, release blockers, and follow-up ideas in one ordered place so review TODOs do not get lost.

Ordering rule: list work in the sequence we are currently tackling, then by priority, then chronological discovery order. Only reorder manually when Jeremy/YK asks.

Status labels:
- `Current in development` — actively being worked/reviewed in the current dev bucket.
- `Next` — should happen before clean release if current item passes.
- `Blocked / waiting review` — implemented or partially implemented, needs human/device judgement.
- `Backlog` — known follow-up, not blocking current release unless promoted.
- `Archive candidate` — remove or move to archive once completed and pushed to a clean public release.

## Current release bucket

### v0.8.3 — Code hygiene and debug-runtime cleanup

Status: `Current in development`

Reference:
- GitHub umbrella: #8
- Subtasks: #9, #10, #11, #12, #13

Subtasks:
- [x] Extract shared species/hash/body-length helpers.
- [ ] Gate sardine debug globals out of normal runtime while preserving debug/LOD opt-in.
- [x] Remove confirmed-unused starter-era components/assets.
- [ ] Review `Fish.jsx` split after current visual/release review stabilizes.
- [ ] Decide and wire the local debug channel at `fish.chiayong.com`.

## Released / archived

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

## Backlog / future buckets

### A. Roadmap hygiene

Status: `Backlog`

Subtasks:
- [ ] When new release blockers or TODO lists come up in chat, add them here with relevant dev patch/bucket version references.
- [ ] When actively working an item, move/set it to `Current in development`.
- [ ] When an item is completed and pushed to clean public release, remove it from active sections or archive it under a dated/archive section.
- [ ] Keep ordering: current work first, then priority, then chronological discovery order unless Jeremy/YK manually asks to reorder.

### B. Rejected/saved visual experiments

Status: `Backlog`

Reference:
- `v0.8.0-dev_107` appendage-only/outline-related experiment was visually rejected; preserve useful dev-bucket knowledge without returning it to main unless explicitly asked.

Subtasks:
- [ ] If a future visual experiment looks bad, revert main quickly while preserving the experiment in a separate dev branch/bucket for reference.
- [ ] Document branch/bucket name here when such a saved experiment is created.
