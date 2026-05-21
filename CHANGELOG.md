# Changelog

Significant changes only. Categorized by feature area inside each clean release/version grouping.

Versioning convention notes:
- Current convention: work toward a clean target release using visible `-dev_##` builds, then publish the clean version when accepted.
- Dev patches are intentionally excluded below; each target release summarizes the accepted bucket.
- Before the dev-patch convention, changes are grouped by minor version (`v0.6.x`, `v0.5.x`, etc.).
- Earliest unversioned work is grouped as `pre-v0.x`.

## v0.7.6 — Instanced sardine optimization

Status: in progress as `v0.7.6-dev_21`.

### Rendering performance

- Started a dev-only distance-gated instancing pass for Spotted Sardinella.
- Keeps nearby/selected/debug sardines on the normal animated GLTF path.
- Switches non-selected sardines beyond `6.0` world units to a batched `InstancedMesh` visual layer.
- Keeps invisible per-creature proxy meshes in the normal fish path so individual identity, search/follow refs, and click handling remain intact.
- Ships this first dev patch as a diagnostic/visibility build: real per-fish instance matrices are capped to 24 visible far sardines while the normal GLTF fish path remains visible, so Jeremy can inspect coordinate-space/orientation behavior on device before the shader-wiggle pass is re-enabled.
- Temporarily disables the diagnostic instanced layer after local screenshots showed the layer blanked the scene even though creature data and GLTF meshes were loaded; this restores visible normal fish while preserving the registry/proxy code for the next isolated instancing fix.
- Adds debug-card render/performance counters for visible creature count, sardine count, FPS, instancing mode, drawn instance count, and far-sardine candidate count so mobile tests can tell whether instancing is actually active.
- Opens debug with fish overlays off by default so the FPS/candidate readout itself does not tank performance; use the existing `◎` / `◉` buttons only when visual vectors/labels are needed.
- Replaces the oversized cyan ellipsoid diagnostic instances with a smaller procedural fish-shaped instanced body/tail at sardine scale, so the instanced performance path is visible without the blob/pill artifact.
- Fixes an instanced-sardine fallback bug where hidden interaction proxy/fallback boxes were visibly rendering for far instanced model fish; model-backed instanced fish now render only the invisible click proxy plus the shared instanced visual.
- Replaces the temporary procedural instanced impostor with Jeremy's uploaded `sardine_LOD2.glb`, using the same scale/orientation/material setup as the main sardine mesh but with a much lower-poly static instanced visual for far fish.
- Simplifies the debug-card instancing readout to `LOD2`, moves the LOD2 switch farther from the camera at `8.0` world units so the lower-poly mesh is less noticeable, and tightens mobile debug-card margins so the floating panel stays inside the screen when not following a fish.
- Tunes normal tank-view LOD0 distance to `25.0` world units while keeping follow mode at the previous `8.0` world-unit LOD2 switch, balancing the previous `30.0` visual-quality setting with a little more LOD2 performance headroom.
- Changes the debug card from the generic instancing line to compact `LOD0: drawn/candidates` and `LOD2: drawn/candidates` rows.
- Adds conservative camera-frustum culling for non-selected, non-debug sardines in normal tank view; offscreen sardines now skip both LOD0 model draw and LOD2 instance registration while follow mode behavior stays unchanged.
- Adds a compact `Frustum: culled/checked` debug row so phone tests can see how many sardines the tank-view culler is actually removing.
- Fixes small-window desktop fish selection by delaying stage pan pointer capture until the cursor actually moves past a drag threshold; simple fish clicks now reach the canvas instead of being swallowed by pan mode.
- Extends conservative frustum culling to follow mode for non-selected, non-debug sardines so the debug row reports real culling while following instead of always staying at `0/199`.
- Reduces debug-on overhead so the panel is a better performance indicator: metrics sample at 1s cadence, skip unchanged React state updates, and throttle/round audio meter UI updates.
- Adds Jeremy's uploaded `sardine_LOD1.glb` as a mid-distance instanced mesh between full LOD0 and far LOD2; LOD1 eats into the LOD0 side so existing LOD2 thresholds/counts stay unchanged while farther LOD0 candidates move to the cheaper mid-poly path.
- Retunes tank-view sardine LOD thresholds toward Jeremy's target mix of roughly `50` LOD0 / `70` LOD1 / `80` LOD2 on a 200-sardine tank: full GLTF now targets near fish inside `10.5` world units, LOD1 spans `10.5–13.5`, and LOD2 starts beyond `13.5`; follow-mode distances remain unchanged.
- Adds a cheap procedural vertex wiggle shader to instanced LOD1/LOD2 sardines: LOD1 gets a stronger body/tail bend, LOD2 gets a subtler far-distance bend, and each instance gets a deterministic per-fish phase so the school does not animate in lockstep.

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
