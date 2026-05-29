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

`v0.8.1` — Mola recovery polish.

Current dev build reference: `v0.8.1-dev_1`.

### 1. Mola recovery fade axis gating

Status: `Current in development`

Reference:
- Jeremy report after clean `v0.8.0`: Mola fade-out/fade-in recovery also triggers on hard recovery at `-X` / `+X`, but it should only occur when exceeding the far `-Z` runtime envelope.
- Jeremy also reports some cases where the sunfish does not reappear and remains transparent for a long time.
- Implemented in `v0.8.1-dev_1`: only negative-Z runtime envelope exits start the slow depth fade; X-axis exits clamp/retarget immediately, and fade-out has a watchdog transition into fade-in so opacity cannot get stuck at zero.

Subtasks:
- [x] Gate Mola slow fade recovery to far negative-Z runtime exit only.
- [x] Restore immediate recovery path for `-X` / `+X` runtime exits.
- [x] Add fade-out watchdog so Mola always fades back in.
- [ ] Jeremy/YK visual pass: verify X-axis recovery no longer fades and negative-Z fade still reads as swimming away/returning.

Release impact: blocker until visual pass.


## Released / archived

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
