# World Oceanarium Roadmap

Purpose: keep active work, release blockers, and follow-up ideas in one ordered place so review TODOs do not get lost.

Ordering rule: list work in the sequence we are currently tackling, then by priority, then chronological discovery order. Only reorder manually when Jeremy/YK asks.

Status labels:
- `Current in development` — actively being worked/reviewed in the current dev bucket.
- `Next` — should happen before clean release if current item passes.
- `Blocked / waiting review` — implemented or partially implemented, needs human/device judgement.
- `Backlog` — known follow-up, not blocking current release unless promoted.
- `Archive candidate` — remove or move to archive once completed and pushed to a clean public release.

## Current release bucket: `v0.8.0` — Mola alexandrini + solo-agent movement

Current dev build reference: `v0.8.0-dev_119`.

### 1. Mobile follow-camera zoom/framing

Status: `Current in development` / `Blocked waiting Jeremy mobile review`

Reference:
- Reported after `v0.8.0-dev_117`: when Mola swims close to screen on mobile, zoom-out can feel stuck; whole-fish visibility should be equal priority with hiding surface plane edges/fake effects.
- Implemented in `v0.8.0-dev_118`: adaptive selected-creature framing.
- Reported after `v0.8.0-dev_118`: Mola follow default should be a bit more zoomed out, and manual pinch/scroll should allow both zoom in and zoom out instead of feeling locked.
- Implemented in `v0.8.0-dev_119`: farther large-creature default plus restored manual zoom authority.

Subtasks:
- [x] Add bounds-based follow framing for selected creatures.
- [x] Auto-back follow camera distance for large/near subjects like Mola.
- [x] If surface-card X/Z clamps prevent more physical pullback, gently widen follow-only FOV up to a capped limit.
- [x] Ease FOV back to normal in default tank view.
- [x] Validate build/browser smoke/CI/Vercel for `v0.8.0-dev_118`.
- [x] Move Mola default follow distance a bit farther back in `v0.8.0-dev_119`.
- [x] Restore manual pinch/scroll zoom authority so zoom-in and zoom-out both visibly change framing.
- [ ] Jeremy/YK mobile pass: follow Mola near front/screen, pinch zoom in/out, orbit, confirm whole body can recover without ugly surface-plane reveal.
- [ ] Tune if review finds FOV too wide, still too close, or surface edges too exposed.

Release impact: blocker until mobile review passes.

### 2. Follow recovery notice on mobile

Status: `Next`

Reference:
- Implemented in `v0.8.0-dev_115`: auto-exit follow mode on selected solo-agent runtime recovery and show `{name} will be back in a bit!`.
- Jeremy report after `v0.8.0-dev_117`: message not seen on mobile.

Subtasks:
- [ ] Reproduce on mobile or mobile emulation: selected/followed Mola reaches hard-recovery condition, follow exits automatically.
- [ ] Verify notice DOM renders above canvas/info card and is not hidden by mobile layout/screenshot/debug states.
- [ ] Verify notice only appears for automatic runtime-recovery follow exit, not manual close/tap-away exits.
- [ ] If hard to trigger naturally, add/use debug-only forced recovery path for QA, then remove or keep strictly debug-gated.
- [ ] Ship fix in next dev patch if needed.

Release impact: smaller blocker; important because it explains sudden disappearance/recovery.

### 3. Final `reju` pass for `v0.8.0`

Status: `Next`

Reference:
- `v0.8.0-dev_117`: Mola bask animation + approach/hold/exit transitions visually approved by Jeremy.
- `v0.8.0-dev_119`: mobile zoom/framing fix deployed; awaiting phone review.
- Mobile audio works per Jeremy report after `v0.8.0-dev_117`.

Subtasks:
- [ ] Technical gates: `npm run build`, GitHub Actions Build, Vercel status, browser smoke, no console errors.
- [ ] Phone pass: audio unlock, follow Mola, pinch/orbit/zoom, recovery notice, bask behavior, no obvious layout/control issues.
- [ ] Visual/feel pass: Mola scale/read, follow framing, sun-bask smoothness, surface clearance, no fake surface edge exposure that breaks the scene.
- [ ] Decide `ship` or `hold`.
- [ ] If ship: promote from `v0.8.0-dev_##` to clean `v0.8.0`, update changelog status, verify production deployment.

Release impact: final gate.

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
