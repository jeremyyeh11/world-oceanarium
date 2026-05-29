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

Current dev build reference: `v0.8.0-dev_125`.

### 1. Mola hard-recovery visibility

Status: `Archive candidate` / Jeremy says fade-out recovery is good

Reference:
- Jeremy report after `v0.8.0-dev_121`: when Mola hard-recovers at the Z boundary, the hard turn is still visible in the far distance.
- Implemented in `v0.8.0-dev_122`: when Mola reaches the outer runtime envelope outside follow mode, fade it out over 8 seconds, perform hard recovery while hidden, then fade it back in.

Subtasks:
- [x] Hide Mola outer-envelope recovery with fade-out/reposition/fade-in.
- [x] Jeremy/YK phone/visual pass: Jeremy says fade-out recovery is good.

Release impact: accepted; archive after clean public release.

### 2. Mola fake-lighting banding

Status: `Archive candidate` / Jeremy says lighting banding is good

Reference:
- Jeremy screenshot/report after `v0.8.0-dev_122`: fake lighting on Mola is too obvious as banding.
- Implemented in `v0.8.0-dev_123`: replace straight sine stripe weighting with a warped procedural noise mask, lower contrast, and slower drift so lighting reads like broken water variation instead of bands.

Subtasks:
- [x] Break up fake-lighting bands on Mola/material shader.
- [x] Jeremy/YK visual pass: Jeremy says lighting banding is good.

Release impact: accepted; archive after clean public release.

### 3. Follow recovery notice on mobile

Status: `Archive candidate` / Jeremy says mobile notice is good

Reference:
- Implemented in `v0.8.0-dev_115`: auto-exit follow mode on selected solo-agent runtime recovery and show `{name} will be back in a bit!`.
- Jeremy report after `v0.8.0-dev_117`: message not seen on mobile.
- Jeremy request after `v0.8.0-dev_119`: with current zoom logic, kick the user out of Mola follow mode when hard recovery is pending or the Mola clips into the camera, then display the recovery message.
- Implemented in `v0.8.0-dev_120`: Mola follow mode exits with the same recovery notice when the camera gets close enough for camera clipping; the existing pending hard-recovery path continues to use the same notice.
- Implemented in `v0.8.0-dev_121`: manual Mola zoom-in is clamped to a body-length-based minimum distance before the camera can clip into the Mola.

Subtasks:
- [x] Reproduce/inspect selected Mola hard-recovery pending path and confirm it calls the recovery-notice follow exit before hard recovery runs.
- [x] Add camera-clip follow bailout for selected Mola, using the same centered recovery notice.
- [x] Clamp manual Mola zoom-in so pinch/scroll cannot drive the camera into the body.
- [x] Verify notice only appears for automatic recovery/clip follow exits, not manual close/tap-away exits.
- [x] Jeremy/YK mobile pass: Jeremy says mobile notice is good.

Release impact: accepted; archive after clean public release.

### 4. Mobile follow-camera zoom/framing

Status: `Archive candidate` / Jeremy says zoom is good

Reference:
- Reported after `v0.8.0-dev_117`: when Mola swims close to screen on mobile, zoom-out can feel stuck; whole-fish visibility should be equal priority with hiding surface plane edges/fake effects.
- Implemented in `v0.8.0-dev_118`: adaptive selected-creature framing.
- Reported after `v0.8.0-dev_118`: Mola follow default should be a bit more zoomed out, and manual pinch/scroll should allow both zoom in and zoom out instead of feeling locked.
- Implemented in `v0.8.0-dev_119`: farther large-creature default plus restored manual zoom authority.
- Jeremy review after `v0.8.0-dev_119`: zoom is good.

Release impact: keep as archive candidate until clean public release.

### 5. Immediate audio startup

Status: `Current in development`

Reference:
- Jeremy report after `v0.8.0-dev_123`: mobile audio only turns on after clicking a UI element, not from general tank/canvas interaction.
- Implemented in `v0.8.0-dev_124`: audio unlock now listens on both window and document for pointerdown/touchstart/touchend/click gestures so canvas/tank touches can satisfy the mobile Web Audio user-activation gate.
- Jeremy request after `v0.8.0-dev_124`: audio should be enabled the moment the page is opened, for all platforms.
- Implemented in `v0.8.0-dev_125`: tank page now attempts immediate audio startup on page open and foreground return, with gesture unlock retained only as fallback if the browser blocks audible autoplay.

Subtasks:
- [x] Add broader mobile gesture unlock path beyond UI buttons.
- [x] Attempt audio startup immediately on tank page open and foreground return.
- [ ] Jeremy/YK all-platform pass: confirm audio is enabled as soon as the page opens; note any browser/device that still blocks audible autoplay.

Release impact: blocker until mobile audio review passes.

### 6. Final `reju` pass for `v0.8.0`

Status: `Next`

Reference:
- `v0.8.0-dev_117`: Mola bask animation + approach/hold/exit transitions visually approved by Jeremy.
- `v0.8.0-dev_119`: mobile zoom/framing fix approved by Jeremy.
- `v0.8.0-dev_120`: Mola follow recovery now exits on pending hard recovery or camera clipping and shows the centered recovery message.
- `v0.8.0-dev_121`: manual Mola zoom-in is limited before the camera can clip into the body.
- `v0.8.0-dev_122`: Mola outer-envelope hard recovery fades out/in to hide the boundary correction.
- `v0.8.0-dev_123`: Mola fake-lighting mask is warped/noise-broken to reduce obvious banding.
- Jeremy accepted lighting banding, fade-out recovery, and mobile notice after `v0.8.0-dev_123`.
- `v0.8.0-dev_124`: mobile audio unlock listens to tank/canvas gestures, not just UI clicks.
- `v0.8.0-dev_125`: audio start is attempted immediately on tank page open and foreground return across platforms.

Subtasks:
- [ ] Technical gates: `npm run build`, GitHub Actions Build, Vercel status, browser smoke, no console errors.
- [ ] Phone pass: immediate audio-on-open behavior, follow Mola, pinch/orbit/zoom, recovery notice, bask behavior, no obvious layout/control issues.
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
