# Changelog

Significant changes only. Categorized by feature area inside each clean release/version grouping.

Versioning convention notes:
- Current convention: work toward a clean target release using visible `-dev_##` builds, then publish the clean version when accepted.
- Dev patches are intentionally excluded below; each target release summarizes the accepted bucket.
- Before the dev-patch convention, changes are grouped by minor version (`v0.6.x`, `v0.5.x`, etc.).
- Earliest unversioned work is grouped as `pre-v0.x`.

## v0.8.0 — Mola alexandrini + solo-agent movement

Status: in progress as `v0.8.0-dev_118`.

### Creature behavior

- Starts the Mola alexandrini feature bucket after clean `v0.7.9` acceptance.
- Target: add Giant Sunfish as the first non-schooling agent-driven creature, with reusable solo-agent movement plus a species-specific Mola profile.
- Adds the Giant Sunfish (`Mola alexandrini`) species profile at current review scale: 180–240 cm total length, using the project scale of 1 WU = 25 cm, so individuals render at 7.2–9.6 WU.
- Updates the Mola species metadata and info-card description toward behavior-first `Mola alexandrini` facts: fin-rowing swimming, deep-diving soft-bodied prey, sideways surface basking for warmth/oxygen/parasite relief, and head/chin/clavus traits; legacy `mola-mola` / `Ocean Sunfish` creature rows still resolve to Giant Sunfish.
- Adds the uploaded `Mola alexandrini` GLB with embedded clips: `idle_drift`, `slow_cruise`, `bank_l`, `bank_r`, `burst`, `sun_bask_l`, and `sun_bask_r`. The current movement system maps cruise to `slow_cruise`, turn actions to the bank clips, and speedups to `burst`; during sun-bask hold, playback isolates the complete authored `sun_bask_l/r` clip with no slow-cruise base layer and no appendage-only overlay slicing. Refreshes the canonical Mola GLB in `v0.8.0-dev_108` from Jeremy's replacement archive while preserving scene, mesh/material/skin counts, embedded texture shape, scale bounds, and expected animation names.
- Corrects the uploaded Mola GLB axis conversion for Jeremy's Blender-to-GLB setup: Blender `+Z` becomes GLB `+Y`, so the runtime asset is GLB `+Y` up and `+Z` forward. The model now uses identity child rotation to match the fish root's `+Y` up / `+Z` swim-forward axes.
- Fixes the instanced/model fish light-mask shader world-position injection so the uploaded Mola and sardine instanced layers compile cleanly in browser dogfood.
- Planned signature behavior: near-surface sun basking with slow approach, surface clearance padding, lazy hold/drift, and eventual return to cruising. `v0.8.0-dev_110` tested removing procedural yaw/roll ocean-drift rotation; snapping persisted, so `v0.8.0-dev_111` restored rotational drift and kept the investigation focused elsewhere. `v0.8.0-dev_112` freezes the base visual-forward orientation during bask hold while preserving translation drift, bask roll completion, rotation drift, and isolated sun-bask animation. `v0.8.0-dev_113` eases that look-at freeze in on hold entry and eases it back out during exit so normal route-facing influence resumes gradually instead of reactivating in one frame. `v0.8.0-dev_114` slows isolated `sun_bask_l/r` playback to `0.5x` for a calmer bask hold while leaving movement speed and other clips unchanged. `v0.8.0-dev_116` adds a short entry-only fade into the isolated bask action, then stops the previous cruise/bank actions after the fade so the hold no longer starts with an animation-pose tick. `v0.8.0-dev_117` smooths the remaining transition tick by coasting briefly into hold, ramping exit swim speed back up, and crossfading the final bask→cruise handoff.

### Movement architecture

- Planned architecture keeps sardines on the existing spline-school system while adding a generic solo-agent core for non-schooling species.
- Species-specific behavior profiles will layer personality/state weights on top of reusable steering, target selection, bounds, debug, and animation-speed outputs.
- Keeps the Mola GLB path unwired for now; the placeholder path is data-driven through the species profile so the final asset can replace the geometry later without blocking behavior tuning.
- Scales follow-camera default distance by focused creature body length for large solo animals, so clicking the real-scale Mola starts farther back instead of zooming inside the fish while sardines keep the existing close inspection distance.
- Adds a small centered follow-camera recovery notice when an automatically followed creature leaves the runtime boundary and the camera exits to let hard recovery happen, using the custom name when present or the common species name otherwise.
- Restores smooth camera entry into follow mode by damping the focus point from the current tank view before tracking the selected creature, and keeps the placeholder Mola base material color stable when selected by rendering the selection rim as a back-face shell instead of tinting the body.
- Adds focused debug readouts for solo agent-style individuals such as the Giant Sunfish: current movement status, speed, destination coordinates, distance to target, wall clearance, and surface clearance.
- Moves and scales the solo-agent debug readout for large creatures so the Mola label sits above the body at follow-camera distance instead of being tiny or visually buried near the target marker.
- Corrects the Mola review speed target down to 0.5–0.8 WU/s and starts replacing the old solo spline-follow behavior with a real target-seeking solo-agent movement path for non-schooling individuals, hiding the old cyan spline debug for Mola.
- Makes Mola movement forward-facing: opposite-side targets now require the animal to rotate before it translates, debug speed/distance labels use meters, the forward vector starts at the mesh front, and Mola target sampling uses wider movement bounds so it explores more of the tank volume.
- Smooths Mola target turns into broad forward arcs instead of on-the-spot pivots, so opposite-direction retargets keep moving along the face direction while turning toward the destination.
- Fixes the arc-turn stall by steering the visual facing toward the actual destination while translating along the current forward vector, with a higher minimum arc speed so the Mola keeps making progress during opposite-direction turns.
- Adds a cyan wireframe movement-boundary box to Mola direction debug so the padded solo-agent target volume is visible in the tank.
- Retunes tank-view movement bounds only: sardines and Mola get wider horizontal X travel and deeper negative-Y travel, while the Mola target volume moves farther back on negative Z. Follow mode mechanics are unchanged.
- Tunes active tank movement bounds to give sardines and Mola much wider horizontal travel (`X [-25, 25]`), lowers both movement volumes to `Y min -7`, and gives sardines explicit asymmetric depth travel (`Z [-15, 8]`). Mola depth stays at the current review range (`Z [-35, -10]`). Keeps the randomized school startup feel visible under explicit min/max bounds by varying each visit's school lane/depth/vertical traversal phase, instead of always starting the shared spline from the same left/back/down pattern.
- Hides the landing/biome-entry step while there is only one active tank: app boot now opens directly into the Ocean tank and suppresses the tank back button until multi-tank navigation returns.
- Restores audio unlock after direct tank entry: since there is no landing `DIVE IN` gesture anymore, the first pointer/touch/key gesture in the tank now starts the Web Audio graph before UI/fish SFX fire.
- Retriggers the deployment pipeline after Vercel did not create/report a deployment for `v0.8.0-dev_22`; no gameplay or audio behavior changes beyond the audio-unlock fix.
- Makes the audio control reflect actual Web Audio unlock state, not just the mute flag: it now appears off until audio has really started, and tapping the audio button before unlock starts sound instead of accidentally muting it.
- Narrows tank-view X movement bounds for both Spotted Sardinella and Mola mola from `[-25, 25]` to `[-18, 18]`; Y/Z bounds and follow-mode mechanics are unchanged.
- Pulls Mola tank-view depth forward by changing its Z range from `[-35, -10]` to `[-25, -10]`; sardine bounds and follow-mode mechanics are unchanged.
- Canonicalizes creature species storage around scientific-name slugs: `mola-alexandrini` for Giant Sunfish and `amblygaster-sirm` for Spotted Sardinella, while keeping legacy aliases for older `mola-mola`, `sardine`, and display-name rows.
- Adds a static dev-creature safety net for `-dev_` builds when Supabase env vars are missing or `creatures_dev` returns no active supported creatures, preventing the tank from rendering as an empty blue scene during review/deploy smoke tests.
- Fixes the Mola layered-animation crash by initializing `AnimationAction.userData` before storing per-action time-scale metadata.
- Corrects Mola turn-sign detection so left turns trigger `bank_l` and right turns trigger `bank_r`, then softens solo-agent steering plus Mola animation crossfades/overlay weight to reduce visible jitter between movement states.
- Converts Mola solo-agent travel from direct target steering to wide-radius cubic splines: each destination rebuilds a curve from current position and visual-forward tangent, movement advances by curve arc length, banking follows curve tangent deltas, and avoidance is applied as a soft offset instead of replacing the route.
- Fixes Mola spline continuity so each new solo-agent route departs along the prior route's exit tangent and timed retargets wait until the fish is near the spline end, preventing backwards-looking traversal on route rebuilds.
- Moves the Mola solo-agent follow/debug lookahead target to a body-length-scaled point ahead on the active spline, matching the sardine follow-target pattern so the target no longer sits inside the large body.
- Tightens Mola visual-forward tracking against the active spline tangent, using faster tangent catch-up for solo agents so the body stays close to parallel with the curve instead of sliding sideways/backward along it.
- Increases Mola solo-agent spline turning radius by lengthening cubic control leads, blending sharp destination approaches more strongly toward the current route tangent, and slowing arc-length progress when local spline tangent delta exceeds the lower curvature cap.
- Enforces broad Mola spline routes at generation time: candidate targets/curves are sampled for full 3D tangent continuity, sample-to-sample tangent delta, and minimum turning radius; only curves under the tangent caps and over the radius floor are accepted when possible, close targets are rejected, and fallback picks the smoothest candidate instead of the first random target.
- Preserves route-swap tangent continuity on all axes by keeping the new Bezier's first control point on the previous spline tangent instead of flattening control-point Y, and by sampling the current path tangent for early/reached-target retargets instead of snapping to the old endpoint tangent.
- Doubles global GLTF animation time scales, increases Mola idle movement speed by `1.2x`, and increases Mola burst movement speed by `1.5x` for a more active fin/body read against the widened path arcs.
- Adds size-biased avoidance so smaller creatures yield more strongly to larger creatures while larger creatures are minimally disturbed by smaller ones; species dominance overrides are left as an explicit future movement-system TODO.
- Removes boundary-avoidance/clamping from runtime fish movement: destinations are still generated inside the swim bounds, but agents can temporarily traverse outside the target box while completing broad maneuvers near an edge.
- Keeps Mola solo-agent Bezier handles unclamped as well as runtime positions, so near-boundary routes can bend outside the target box instead of forming a clipped control-point corner while still ending at an in-bounds destination.
- Hard-gates Mola solo-agent route swaps on a minimum sampled turn radius of `1.2x` body length, increases target/curve retries, and stops using rejected “smoothest fallback” curves after a route already exists.
- Reduces Mola Bezier handle length to prevent stretched-control S-bends, caps handle length as a smaller route-distance fraction, and rejects sampled curves whose XZ tangent changes turn direction mid-route.
- Fixes the post-initial spline-end stall by adding a strict-gated forward continuation target when broad random retargets all fail after a route completes, so the Mola keeps moving without reintroducing rejected fallback curves.
- Adds a deterministic endpoint recovery arc for the completed-route case when all random retargets fail: the arc is generated at `1.25x` the required turn radius, ends inside bounds, and is accepted only if it still passes the start-tangent, minimum-radius, and no-tangent-reversal gates.
- Starts Mola spline handoff much earlier at `82%` route progress so the next route is generated before the fish parks at a completed spline endpoint.
- Replaces the single long-handle Mola route cubic with a multi-segment cubic path: modest per-segment handles, controlled intermediate waypoints, and per-point tangent directions shape rotation gradually across the route instead of concentrating curvature into one Bezier span.
- Removes the unsafe completed-endpoint best-candidate override that could reintroduce sharp turns; endpoint recovery now has to pass the radius/no-reversal gate again.
- Fixes retarget-generation frame spikes by restoring the retarget cooldown gate, applying the same cooldown to completed/reached endpoints, and reducing Mola route candidate search from `32x18` to `16x8` attempts now that segmented paths need less brute force.
- Removes the debug-panel `None` view mode so debug visuals are always either `View all` or `Selected fish`; debug now defaults to `View all` when enabled.
- Revamps movement bounds so species only define Y/Z ranges while global X range is derived from tank camera projection at each destination depth: near-front destinations get narrow X travel and farther negative-Z destinations get wider X travel. Removes the debug movement-boundary box.
- Rebuilds Mola solo-agent movement around explicit behavior lifecycles: destinations are sampled once per behavior inside the forward 180° cone, behind/failed destinations fall back to a broad turn behavior, route swaps happen only after behavior completion, runtime boundary avoidance is disabled for solo paths, and Mola debug labels now show id, common/scientific name, move speed, and active behavior.
- Narrows Mola debug output to only the requested identity/speed/behavior label, hides solo-agent spline/target/speed/name debug extras, and hardens solo-agent path advancement against invalid path-length or speed values so an accepted visible route always advances position.
- Fixes the Mola `choose-behavior` stall by replacing failed over-strict cruise route rejection with an immediate turn-route fallback, plus a last-resort forward fallback path, so solo agents always receive an active behavior/path instead of waiting in retry cooldown.
- Restores the Mola debug spline while keeping Mola debug text limited to the requested identity/speed/behavior fields, and defaults debug view to selected fish only.
- Adds boundary-aware solo-agent spline generation: endpoint tangents near X/Y/Z bounds are shaped and gated to glide within 15° of the boundary plane, and failed near-boundary routes now use a boundary-glide recovery path before any inward fallback so Mola does not sharply reverse off the edge.
- Tightens Mola route validation against rare boundary S-curves by tracking cumulative turn, meaningful opposite-direction curvature, and a lower total-turn budget for boundary-glide recovery; boundary-glide now keeps its end tangent boundary-parallel with less inward bias so edge recovery remains one broad glide instead of left-right snaking.
- Extends Mola spline smoothness validation to all axes by detecting opposite-direction curvature in XZ, XY, and YZ planes, so vertical/depth S-curves are rejected along with horizontal wiggles while preserving full 3D tangent continuity.
- Replaces Mola's committed spline-follow movement with continuous steering: destinations remain inside bounds, but the body turns toward them under a fixed max turn rate, applies boundary-plane glancing bias near edges, and moves forward from its own heading so smoothness comes from the controller instead of repeatedly accepting/rejecting generated splines. The cyan debug line is now a predicted steering trail, not the movement source.
- Extends Mola's destination Z range forward to `[-25, 0]`, but adds stateful depth residency so it usually chains several deep targets at `Z <= -10` and only occasionally enters short front excursions. This biases time spent in the back without independently biasing every destination sample and causing constant front/back swings.
- Increases selected-creature zoom-out capacity for large animals by scaling max follow distance from body length, so selected Mola can pull back far enough to show surrounding water and neighbors. Normal selection no longer adds Fresnel/outline or body scale changes; selection Fresnel is debug-only.
- Smooths selected-creature camera entry by easing follow distance directly from the camera's current position to the creature-specific follow distance, avoiding both immediate rush-in and pre-zoom spring-back.
- Reduces the global projected X destination range to `90%` of the previous width, giving fish more screen-edge buffer when steering/animation carries them outside their destination bounds.
- Adds the currently requested/playing movement animation name to the Mola debug text below the behavior line.
- Removes the remaining selected-follow spring/lateral snap by seeding follow focus from the current camera pose and easing directly to the selected creature with softer target/position damping.
- Adds a follow-camera surface collision plane: when zoom/orbit would lift the camera into the water surface, the desired camera pose clamps just below the surface while X/Z motion continues, creating a slide-along-surface behavior instead of rising above it.
- Adds a runtime safety envelope for solo-agent movement: Mola can still temporarily traverse outside destination bounds for broad maneuvers, but its body center is capped to a small body-length-scaled overshoot and immediately retargets inward if it hits that outer envelope.
- Smooths selected-follow camera rotation by seeding a look target from the current camera forward vector and damping it toward the framed creature focus, avoiding the raw `lookAt` target jump that could create an initial lateral snap before position damping was visible.
- Applies the same smoothed-look-target transition when exiting follow mode back to tank view, so rotation eases from the current follow-facing direction instead of snapping immediately to the default tank `lookAt`.
- Adds a Mola sun-basking behavior lifecycle: occasional front/surface approach, gradual side-up roll, 30s stationary bask hold with tiny drift and left/right bask animation, then an exit target that rolls back down before normal solo-agent behavior resumes.
- Adds a Mola-specific hard surface ceiling for body-center motion and destination sampling, so X/Z maneuver leniency remains but upward runtime overshoot slides along a safe center height below the water surface instead of letting the body clip through the surface plane.
- Lowers the Mola surface ceiling to account for the GLB's full visual vertical reach, preventing the visible body from swimming above the water surface in follow mode.
- Resolves species records by id, scientific name, common name, and legacy names before applying Mola-only behavior, fixing debug sun-bask queueing and surface ceilings when creature feeds use non-common-name species keys.
- Expands the Mola runtime safety envelope on X/Z only, moving any hard outer-cap recovery well past the screen edge while keeping the existing vertical/surface protections unchanged.
- Disables solo-agent hard outer-envelope recovery while any creature is in follow mode, then waits 1 second after exiting follow before allowing recovery again; surface-ceiling protection remains active.
- Adds a debug-only sunfish follow shortcut: while debug mode is on and a Mola is selected/followed, `Ctrl+Shift+X` queues sun-basking as the next solo-agent behavior after the current behavior completes.
- Adds an explicit solo-agent debug `queue` line between `behavior` and `animation`, showing `none` or the queued next action.
- Removes the remaining Mola boundary-tangent steering near destination bounds and tightens Mola behavior completion from nearly one body length to a small center-distance threshold, preventing visible mid-route retargets/sharp turns near screen edges.
- When the selected solo agent hits the offscreen hard-recovery envelope during follow mode, exits follow mode first, then waits until the tank camera has returned to its original default pose before allowing the hard outer-envelope correction/retarget, so the hard correction happens only after the follow-return camera motion is complete.
- Keeps the debug Mola sun-bask shortcut naturalistic: while debug mode is on and a Mola is selected/followed, `Ctrl+Shift+X` queues sun-basking as the next solo-agent behavior instead of interrupting the current behavior.
- Adjusts the Mola basking pose lifecycle so the approach stays normal/upright, then the Mola rolls side-up during the surface hold while playing `sun_bask_l` / `sun_bask_r`, and rolls back down during exit.
- Moves Mola sun-bask targets/holds closer to the surface with a separate basking surface clearance (`0.12x` body length, clamped to `0.85–1.25 WU`) while preserving the larger normal Mola surface ceiling for cruise motion.
- Flips the Mola left/right sun-bask clip mapping so the side-up roll uses the visually matching `sun_bask_l` / `sun_bask_r` animation.
- Starts the Mola side-up sun-bask roll during the swimming approach instead of after it stops, slows roll-in/roll-out, tightens approach arrival so it reaches the near-surface target before holding, doubles bask hold time to `60s`, and adds small independent XYZ ocean-drift motion during the stationary bask pose.
- Adds a mobile-friendly debug action button: while debug mode is on and a Mola is selected/followed, tap `bask` in the debug panel to queue the same natural sun-bask behavior as `Ctrl+Shift+X`.
- Retimes the Mola sun-bask approach roll from elapsed-time based to distance-progress based with eased-in interpolation, so it only reaches the full side-up pose as the fish arrives and starts basking instead of rotating fully too early mid-approach.
- Clamps follow-camera X/Z inside the water-surface plane footprint, matching the existing Y ceiling, so zooming/orbiting out during follow mode cannot pull the camera beyond the surface card and reveal space above/outside the water. `v0.8.0-dev_118` adds adaptive selected-creature framing: large/near subjects such as Mola automatically back the follow distance out to fit their bounds, and if the surface-card clamp prevents more physical pullback the camera gently widens FOV up to a capped follow-only limit so mobile can still see the whole fish without freely exposing plane edges.
- Expands the water-surface plane width by `3x` while scaling the procedural surface UVs in X by the same factor, preserving shimmer/glint density instead of stretching the texture across the wider top surface.
- Adds eased deceleration during the Mola sun-bask approach, ramping down forward movement over the final approach distance instead of switching from cruise speed to stationary hold abruptly.
- Delays Mola side-up roll pacing until late in the sun-bask approach: roll now starts after about `62%` route progress and caps at `92%` while still approaching, then completes to the full 90° pose gradually during the bask hold instead of snapping at the stage transition.
- Adds subtle procedural yaw and extra roll drift during Mola sun-bask hold, layered over the side-up pose so basking feels like ocean drift rather than a fixed frozen orientation.
- Smooths the sun-bask exit transition by preserving the current drift yaw/roll offsets at exit start and fading them out over the exit roll-down, while also easing the roll-down curve instead of linearly dropping from the side-up pose.
- Replaces the Mola GLB with Jeremy's refreshed upload after verifying GLB header/chunks, buffer bounds, mesh/material/skin counts, and all seven expected animation clips (`slow_cruise`, `bank_l`, `bank_r`, `burst`, `idle_drift`, `sun_bask_l`, `sun_bask_r`).
- Fixes first-tap mobile audio enable: the audio button now treats the pre-unlocked state as “start audio” even if the global gesture unlock already ran on `pointerdown`, and the audio UI only marks the graph started once the `AudioContext` reports `running` so failed mobile unlock attempts do not show a false-on mute button.
- Removes the remaining Mola sun-bask exit snap by keeping the exit behavior alive until roll-down finishes even if the exit destination is reached early, and suppresses generic procedural turn banking while any sun-bask stage owns the side-up pose.
- Reformats the Mola solo-agent debug label to match the sardine debug label shape: `id • name`, scientific name, speed, `behavior • animation`, and queue.
- Fades Mola sun-bask ocean drift in over the first hold seconds so non-zero yaw/roll/position drift cannot appear as a one-frame snap on approach → hold.
- Removes authored `root` transform tracks from Mola sun-bask animation overlays and lengthens the bask overlay blend, leaving runtime root roll as the only whole-animal bask pose owner.
- Replaces the Mola GLB with Jeremy's latest refreshed upload (`mola alexnadrini.glb`), preserving the expected scene shape, material/skin counts, and all seven movement/sun-bask animation clips while adding the updated mesh data.

## v0.7.9 — Sardine texture refresh

Status: accepted and promoted as clean `v0.7.9`.

### Sardine visuals

- Reverts the external sardine albedo override after phone review showed the uploaded image did not align with the GLB UVs; sardines are back on the embedded model textures while the next texture path is decided.
- Replaces all three sardine GLB assets from Jeremy's updated zip: full `sardine.glb`, `sardine_LOD1.glb`, and `sardine_LOD2.glb`.
- Overrides sardine material roughness to `0.2` for the full model and both instanced LOD models, while leaving metalness at the embedded GLB value.

## v0.7.8 — Screenshotability polish

Status: accepted and promoted as clean `v0.7.8`.

### Screenshot / debug capture

- Starts the next dev bucket after clean `v0.7.7` acceptance.
- Always hides the debug menu in screenshot mode while keeping debug overlays/LOD colors available when debug is enabled.
- Adds a screenshot-only procedural film-grain overlay without changing contrast, saturation, exposure, or fog.

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
