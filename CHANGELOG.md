# Changelog

Significant changes only. Categorized by feature area inside each clean release/version grouping.

Versioning convention notes:
- Current convention: work toward a clean target release using visible `-dev_##` builds, then publish the clean version when accepted.
- Dev patches are intentionally excluded below; each target release summarizes the accepted bucket.
- Before the dev-patch convention, changes are grouped by minor version (`v0.6.x`, `v0.5.x`, etc.).
- Earliest unversioned work is grouped as `pre-v0.x`.

## v0.7.8 — Screenshotability polish

Status: in progress as `v0.7.8-dev_12`.

### Screenshot / debug capture

- Starts the next dev bucket after clean `v0.7.7` acceptance.
- Always hides the debug menu in screenshot mode while keeping debug overlays/LOD colors available when debug is enabled.
- Adds a screenshot-only procedural film-grain overlay without changing contrast, saturation, exposure, or fog.

### Follow camera

- Adds a subtle depth-of-field pass in follow mode, active both inside and outside screenshot mode, with focus locked to the followed fish.
- Keeps follow-mode depth of field on the normal output color/tone-mapping path so the postprocess composite does not darken the tank.
- Softens the follow-mode DOF strength and focuses from the fish bounds center instead of the root object position, reducing whole-frame dark blur/smear.
- Replaces the simple bokeh pass with the `webgl_postprocessing_dof2` shader path and sets focal depth from the followed fish's camera-space depth.
- Uses the `dof2` shader autofocus path with focus coordinates projected from the followed fish center, so the shader samples depth exactly at the followed fish on screen.
- Restores postprocess sharpness by rendering follow DOF at up to `2x` device pixel ratio and enabling 4x MSAA on the color target when WebGL2 is available.

## v0.7.7 — Surface and depth polish

Status: accepted and promoted as clean `v0.7.7`.

### Environment direction

- Starts the next dev bucket after clean `v0.7.6` acceptance.
- Target: improve the tank's top water surface and strengthen depth cues so the ocean reads less flat while preserving current sardine LOD performance.
- Replaces the temporary flat water-surface plane material with a high-visibility cyan checker texture so the surface plane position, scale, and motion are easy to inspect before styling it into the final reference-like shimmer.
- Step 1 of the reference-image pass: replaces the checker diagnostic with a cheap procedural additive surface shimmer shader, creating a brighter broken cyan/white water ceiling without real volumetrics or postprocessing.
- Extends the surface shimmer plane deeper into the tank and fades it by camera-depth so the bright water ceiling recedes instead of reading as a nearby horizon line.
- Makes the surface-depth change more obvious by hiding the near half of the plane, moving the shimmer much farther back, extending its far fade, and slightly boosting brightness so the visible ceiling starts deeper in the scene.
- Replaces the wrong mid-screen horizon stripe with a camera-anchored top shimmer backdrop that stays near the upper water column and fades downward instead of intersecting the scene as a visible horizontal line.
- Disables the old `UnderwaterFX` `SurfaceFoam` plane so only one surface shimmer plane is visible; this removes the duplicate halfway-down screen band.
- Adds a visible cyan wireframe overlay to the current surface plane so its actual bounds and placement can be inspected directly.
- Moves the diagnostic surface plane upward so its bottom wireframe edge sits near the requested upper-water reference line.
- Converts the diagnostic surface from a camera-facing billboard to a real world-horizontal ceiling plane so placement can be judged in tank space.
- Widens the world-horizontal diagnostic surface plane on the X axis from `46` to `70` so the left/right coverage can be checked with wireframe visible.
- Retunes the surface shader from broad cloudy patches toward thinner broken cyan/white shimmer streaks with a stronger lower fade, while keeping the wireframe diagnostic visible.
- Scales the surface shader tiling down by `3x` so the shimmer pattern reads larger across the world-horizontal plane.
- Corrects the surface shader tiling in the opposite direction and widens the shimmer thresholds so blob/streak edges dissolve more softly instead of cutting sharply.
- Adds a cross-panned procedural interference band: two different noise fields pan in opposing directions, multiply together, and drive the main cyan/white color lerp for a more water-like shimmer texture.
- Removes the wireframe diagnostic and temporarily shows a large animated Perlin mask in obvious green/black before using it to make the fake caustics more occasional.
- Reduces the visible Perlin-mask blob size by increasing the diagnostic mask frequency.
- Sets the Perlin-mask diagnostic to exactly half the original blob size for easier visual approval.
- Applies the approved Perlin mask to the surface shader so bright caustic streaks appear only in mask-active regions while inactive regions stay darker, and restores depth testing so fish can occlude the surface plane in 3D.
- Doubles all active surface noise pan speeds and increases caustic contrast so mask-active regions are brighter while masked-out regions fall darker.
- Halves the active Perlin mask blob size again by doubling its UV frequency from `6.4 × 2.9` to `12.8 × 5.8`, making bright/dark caustic regions more broken up.
- Darkens the surface shader by lowering the base cyan lift, dimming bright/glint targets, reducing caustic mix weights, and lowering transparent alpha.
- Changes the Perlin mask from a hard caustic cutoff to a dimmer: mask-black regions now keep subdued caustics/glints instead of fully masking them out.
- Replaces the earlier bespoke darkening with a simple `color *= 0.8` albedo multiplier while restoring the prior color mix and alpha, so intensity is lower without changing the caustic balance.
- On mobile, widens the top exposure radial gradient to the horizontally scrollable tank-stage width and pans it with the stage, reducing visible screen-space banding/elongation.
- Adds a first fake god-ray experiment: three subtle upper/back 3D shader planes with depth testing on, low additive alpha, and no raycasting.
- Softens the fake god rays after phone review: two broader beams, stronger side/vertical fades, lower alpha, slower shimmer, and normal blending to remove sharp/out-of-place edges.
- Turns on god-ray diagnostic wireframe and aligns both ray planes to the same 15° left angle for placement review.
- Applies the widened/panning top exposure gradient to desktop as well as mobile, so the radial gradient spans the full scroll-stage width on all devices.
- Corrects god-ray diagnostic opacity so beams are strongest near the visible water surface and fade deeper, while increasing diagnostic intensity for placement review.
- Splits god-ray diagnostics into a real filled ray shader plus a separate wireframe overlay, so the beam fill remains visible while the grid shows placement.
- Expands the god-ray diagnostic from two broad beams to five thinner, lower-intensity beams angled 15° left for composition review.
- Hides god-ray wireframes and varies beam thickness across the five rays so the set reads less mechanically uniform.
- Raises non-diagnostic god-ray fill intensity after the wireframe-off build made the beams disappear on device.
- Repositions god rays so every beam starts from the same surface Y anchor while varying X/Z depth, pushing several rays farther back into the tank instead of out toward the camera.
- Moves the god-ray top/source edge up to Y=15 while preserving varied X/Z placement, thickness, and 15° left angle.
- Flips god-ray Z positions from negative to positive values while preserving X positions, source height, thickness, intensity, and angle.
- Moves god-ray Z positions back to the negative side but adds 8 world units to each original depth, placing them closer to the surface plane depth.
- Varies god-ray size by depth: nearer beams keep the current thick scale, while farther-back beams are thinner and a few extra rays sit deeper at more negative Z.
- Adds shader-only god-ray motion: slow asynchronous brightness breathing, UV shimmer drift, and tiny top-weighted centerline wobble without moving the ray planes.
- Keeps the procedural water surface and god rays mounted in follow mode so close-up fish inspection preserves the same top-water lighting context.
- Varies each god ray's fade length so some shafts die out high while others extend deeper into the tank.
- Adds five more thin god rays, mostly farther back.
- Reverts the surface-shadow band experiment because it did not add enough visually.
- Adds sparse, shader-only white/cyan surface glint streaks as the next cheap surface-lighting layer after rejecting shadow bands.
- Breaks the surface glints out of uniform parallel bands by warping the line field and cross-cutting it into irregular patches.
- Increases glint domain-warp strength and bends the sine phase so surface streaks curve instead of reading as straight broken lines.
- Makes glints rarer and less intense, deepens ocean haze/distance grading, and adds a sparse suspended-particle layer near the upper water column.
- Shrinks suspended-particle specks substantially and pushes the ocean haze darker/denser for stronger distance depth.
- Makes suspended particles smaller/fainter again and changes motion from near-static bobbing to subtle upward water-column drift so they do not read as hanging ornaments.
- Adds an intentionally obvious diagnostic fish light-mask shader to full GLTF fish, using animated world-space cyan/shadow bands to prove the fake light-function path before tasteful tuning.
- Extends the same obvious diagnostic light-mask to instanced sardine LOD1/LOD2 materials so every visible fish tier can be checked together.
- Converts the fish light mask from cyan diagnostic color into a world-space dimming/light factor, so all LODs read more like swimming through moving light and shadow.
- Broadens and slows the fish light/shadow mask bands while keeping the effect readable, reducing small-pattern shimmer on sardines without making it disappear.

## v0.7.6 — Instanced sardine optimization

Status: accepted and promoted as clean `v0.7.6`.

### Sardine LOD rendering

- Added distance-gated sardine LOD rendering for dense schools.
- Keeps nearby, selected, focused, and debug sardines on the full animated GLTF path.
- Renders mid/far non-selected sardines through real `THREE.InstancedMesh` layers using Jeremy's uploaded `sardine_LOD1.glb` and `sardine_LOD2.glb`.
- Preserves per-creature identity, click, search, and follow behavior through invisible interaction proxies.

### Visual feel

- Matched low-LOD sardine scale, orientation, and material behavior to the full sardine mesh.
- Added procedural vertex-shader wiggle to LOD1/LOD2 so instanced fish stay alive without per-fish skeletal animation.
- Rejected far-LOD motion/controller throttling after phone feedback showed visible jitter; sardine motion updates remain full-rate.

### Performance / culling

- Added conservative frustum culling for non-selected, non-debug sardines in tank and follow modes.
- Retuned tank-view thresholds to target a healthier full/mid/far LOD mix: LOD0 inside `10.5` world units, LOD1 from `10.5–13.5`, and LOD2 beyond `13.5`; follow mode remains LOD0 inside `5`, LOD1 `5–8`, LOD2 beyond `8`.
- Reduced debug-panel overhead with slower sampling, unchanged-state skips, and throttled audio meter updates.

### Debug / interaction

- Added compact debug rows for `LOD0`, `LOD1`, `LOD2`, and `Frustum` counts.
- Added `L` debug color view with Jeremy's spectrum: LOD0 green, LOD1 olive, LOD2 red.
- Fixed small-window desktop fish clicks by delaying pan pointer capture until actual drag movement.

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
