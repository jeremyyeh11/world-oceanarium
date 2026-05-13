# Changelog

Significant changes only. Versions before `v0.3.0` are grouped under `pre-v0.3.0`.

## v0.5.0 — Movement tuning foundation

- Added horizontal tank panning when the fixed 16:9 stage is heavily cropped on narrow screens.
- Added species/individual movement tuning parameters:
  - `speed`
  - `erraticness`
  - `turnRadius`
- Tightened swim path bounds so fish stay on-screen more reliably.
- Added baseline mackerel movement values.

## v0.4.4 — Continuous swim paths

- Changed fish spline regeneration so new paths start from the previous endpoint.
- Preserved exit direction into the next spline to avoid teleporting or sudden direction snaps.
- Debug splines now show the active open swim path.

## v0.4.3 — Stronger depth fade + refreshed paths

- Added explicit screen-depth fade to fish so far-away fish fade more than near-screen fish.
- Reduced far-fish environment reflection so distant fish no longer stay equally bright through fog.
- Added automatic spline regeneration after each completed swim path.

## v0.4.2 — Deeper 3D swim volume

- Increased fish swim depth to roughly 60% of visible screen width.
- Made it easier to see fish swimming toward and away from the screen.

## v0.4.1 — Debug swim splines

- Added passcode-gated Debug Mode.
- Added visible swim spline rendering while Debug Mode is active.
- Added toggle behavior to exit Debug Mode.

## v0.4.0 — Spline-based fish swimming

- Replaced simple left/right oscillation with Catmull-Rom spline swimming.
- Fish now travel forward through the tank instead of hovering in place.
- Fish movement includes X, Y depth, and Z screen-depth variation.
- Fish rotate toward their movement tangent with slight pitch while climbing/diving.

## v0.3.3 — Bubble scale/density correction

- Reduced bubble size dramatically after visual review.
- Reduced bubble density.
- Kept bubbles subtle instead of dominant foreground discs.

## v0.3.2 — Visible sunlight-zone bubbles

- Moved bubble spawning into the visible sunlight zone.
- Kept shorter bubble lifetimes while preventing them from dying before they reached camera view.

## v0.3.1 — Softer bubble particles

- Converted bubbles from square point sprites to circular shader particles.
- Lowered opacity.
- Reduced particle count/spawn density.
- Added lifetime-based size scaling using the requested logarithmic curve.

## v0.3.0 — Ocean-only build + version footer

- Added Open Ocean bubble particle field using Three.js `Points` + `BufferGeometry`.
- Added `Sunlight Zone` subtitle under Open Ocean.
- Added persistent bottom-right version footer.
- Established app/package versioning.

## pre-v0.3.0

- Created the initial World Oceanarium Vite/React/Three.js project.
- Added initial oceanarium UI shell, landing screen, and biome selection flow.
- Added read-only Supabase creature loading with local seed fallback.
- Added initial biome/tank rendering with fish, floor, vegetation, water surface, camera, and UI.
- Added fish selection and focus-follow camera behavior.
- Cropped the 3D tank to a fixed 16:9 viewport and removed vertical tank scrolling.
- Added generated equirectangular environment lighting, hemisphere/key/fill/point lighting, and exponential water-depth fog.
- Tuned fish, floor, vegetation, and water materials to respond to environment lighting.
- Removed Tropical River from the active flow while keeping selection/menu code for future tanks.
- Made landing enter Open Ocean directly and back return to landing.
- Established generated HDRI-equivalent environment lighting as the baseline for future tanks.
- Added CI build workflow and production deployment workflow.
