# Changelog

Significant changes only. Categorized by feature area inside each clean release/version grouping.

Versioning convention notes:
- Current convention: work toward a clean target release using visible `-dev_##` builds, then publish the clean version when accepted.
- Dev patches are intentionally excluded below; each target release summarizes the accepted bucket.
- Before the dev-patch convention, changes are grouped by minor version (`v0.6.x`, `v0.5.x`, etc.).
- Earliest unversioned work is grouped as `pre-v0.x`.




## v0.8.8 — Mahi mahi

Status: in development; current visible dev patch is `v0.8.8-dev_9`.

### Creature roster

- `v0.8.8-dev_1` starts the Mahi mahi feature branch from clean `v0.8.7`, carrying the supplied model asset into species, behavior, and Atlas review.
- Adds `Coryphaena hippurus` / Mahi-mahi to the active species roster with Jeremy's supplied GLB, three static-dev review creatures, a source-safe Atlas entry, and model moves wired to `idle`, `burst`, `snap_left`, and `snap_right`.
- Tunes Mahi-mahi as loose-schooling epipelagic hunters: larger spacing than sardines, faster readable cruise/burst speeds, wider open-ocean bounds, and less twitchy turns than the sardine school.
- `v0.8.8-dev_2` responds to Jeremy's review by shrinking tank-view Mahi-mahi specimens and spreading the school farther apart, with wider turn radius/lower erraticness to avoid on-the-spot spinning.
- `v0.8.8-dev_3` restores visible Mahi-mahi snap-left/right turns after the smoother `dev_2` path made tangent-change triggers too rare: lower turn threshold, shorter held turn action, and slightly more live path variation without returning to tight spinning.
- `v0.8.8-dev_4` calms the overcorrected turn feel: ordinary course changes are movement/bank-led again, snap clips require larger turns, fade in/out softer, and turn accents are brief instead of held.
- `v0.8.8-dev_5` updates Mahi-mahi sizing to Jeremy's 1.8 m max / 0.91 m average, with normalized individual DB sizes distributed around the average instead of uniform stepping.
- `v0.8.8-dev_6` softens Mahi-mahi turns after review: wider path radius, lower erraticness, rarer snap triggers, shorter turn holds, and slower animation fades so the school arcs instead of cutting hard corners.
- `v0.8.8-dev_7` makes Mahi-mahi schooling forward-led: avoidance is constrained to a narrow forward cone and direction changes are smoothed so each fish swims into the turn instead of sliding, strafing, or backing through it.
- `v0.8.8-dev_8` updates the Atlas staging: Mahi-mahi uses Jeremy's diver silhouette position/opacity, and sardine/Mahi-mahi entries add smaller mid/background companions around the centered hero fish.
- `v0.8.8-dev_9` adjusts the Mahi-mahi Atlas diver silhouette to Jeremy's approved staging position `[0.5, 0.45, -0.85]` at `0.38` opacity.
- Target feel: fast, confident pelagic cruising with readable flashes and turns — elegant movement, not generic fish drift.

## v0.8.7 — Atlas thumbnail polish

Status: accepted and promoted as clean `v0.8.7` from `v0.8.7-dev_3` after Jeremy approval.

### Interface / encyclopaedia

- `v0.8.7-dev_1` adds Jeremy's supplied sardine-school artwork as the Spotted Sardinella Atlas thumbnail.
- `v0.8.7-dev_2` widens the desktop Atlas species list so `Spotted Sardinella` does not clip beside its thumbnail.
- `v0.8.7-dev_3` preserves the Atlas WebGL drawing buffer so screenshot capture includes the 3D model and diver silhouette.

## v0.8.6 — UI overhaul + encyclopaedia

Status: accepted and promoted as clean `v0.8.6` from `v0.8.6-dev_62` after Jeremy approval.

### Interface / encyclopaedia

- `v0.8.6-dev_1` starts the isolated UI overhaul + encyclopaedia feature branch from clean `v0.8.4` so navigation, creature information architecture, and reading flow can iterate separately from species work.
- `v0.8.6-dev_2` adds the first encyclopaedia mockup: top-right gallery entry, left species list with thumbnails, central 3D/species-scale stage, right field-guide info panel, human-scale placeholder, and an info-card button from followed fish.
- `v0.8.6-dev_3` removes the generic Large Predator species placeholder entirely and removes the floor disc from the encyclopaedia 3D viewport.
- `v0.8.6-dev_4` renames the feature to Oceanpaedia, removes redundant panel labels, and fixes the model viewer to a non-orbiting side profile with per-species pose overrides for future angle tuning.
- `v0.8.6-dev_5` renames the page and entry points from Oceanpaedia to The Atlas.
- `v0.8.6-dev_6` adds the supplied epipelagic sunlight-water backdrop to The Atlas viewport for epipelagic species.
- `v0.8.6-dev_7` replaces the corner human-scale placeholder with Jeremy's diver silhouette placed inside the viewport beside the fish, using a head-comparison crop for very small species.
- `v0.8.6-dev_8` plays Atlas model idle clips in place and triggers occasional in-place burst clips without viewport translation.
- `v0.8.6-dev_9` removes the rejected Atlas model animation experiment and replaces the supplied photo backdrop with the live ocean tank backdrop stack, without tank fish or UI.
- `v0.8.6-dev_10` restores the Atlas in-place idle/burst animations, keeps the tank backdrop, and moves the diver scale reference into the lower-right Mola comparison area using a 1.7 m human scale.
- `v0.8.6-dev_11` moves the sardine diver-scale silhouette behind the fish body instead of cropping it against the left edge, matching Jeremy's marked comparison layout.
- `v0.8.6-dev_12` replaces the diver PNG with Jeremy's SVG on a Three.js mesh plane, scales the Atlas fish and diver from species max body length, labels the stat as max body length, and caps small-fish display size so sardines do not fill the viewport.
- `v0.8.6-dev_13` reduces the diver mesh opacity to a subdued reference silhouette and adds an IUCN Red List conservation-status bar to the Atlas info panel.
- `v0.8.6-dev_14` makes the diver mesh double-sided and camera-facing so it cannot vanish from backface/axis changes, then shifts the Atlas camera 15° left and 15° upward for a slight front-left, top-down fish view.
- `v0.8.6-dev_15` makes the diver silhouette visibly render against the dark tank backdrop with a pale translucent mesh material, and turns the Atlas camera another 15° left for a 30° front-left view.
- `v0.8.6-dev_16` switches the Atlas diver scale reference to a camera-facing sprite using the supplied SVG texture, normalizes the SVG fill to tint correctly, raises its opacity, and disables depth testing so it remains visible in front of the dark tank viewport.
- `v0.8.6-dev_17` rasterizes the supplied diver SVG into a PNG texture and uses that PNG for the Atlas sprite so browser/WebGL SVG-texture handling cannot hide the scale reference.
- `v0.8.6-dev_18` replaces the Atlas diver texture with Jeremy's new PNG, normalizes it to a black silhouette, and lowers the sprite opacity so it reads as a quieter scale reference.
- `v0.8.6-dev_19` sanitizes Atlas GLB materials to render opaque front faces with depth writes, preventing Mola's opposite eye/interior surfaces from showing through the head.
- `v0.8.6-dev_20` lowers the Atlas diver silhouette and places it behind the fish with depth testing so creature bodies occlude the scale reference instead of being covered by it.
- `v0.8.6-dev_21` adds a debug-gated Atlas diver pose editor with X/Y/Z/opacity sliders, per-species localStorage persistence, reset, and copyable pose JSON for committing reviewed placements.
- `v0.8.6-dev_22` moves Atlas pose-editor activation to `Ctrl+Shift+D`, shows the Atlas version label in the overlay, and squares/full-bleeds the Atlas panels while keeping thin borders.
- `v0.8.6-dev_46` tightens followed-creature atlas-card copy while staying on the Atlas branch: quick facts are split into terse Biome / Zone / Diet / Social fields, depth/measurement labels are shortened, and empty individual notes use a neutral placeholder without removing the top-right Atlas entry or info-card Atlas button.
- `v0.8.6-dev_58` source-safes the Atlas species copy: `Amblygaster sirm` now reads as spotted sardinella with coastal/lagoons schooling context, while sparse `Mola alexandrini` social and reproduction fields stay `Unknown` instead of speculative.
- `v0.8.6-dev_59` replaces the prior unknown placeholders with Jeremy's supplied Atlas fact sheet for spotted sardinella and bumphead sunfish, and formats sub-kilogram masses / decimal-meter lengths cleanly in the Atlas tables.
- `v0.8.6-dev_60` adjusts the follow-card shell and title row for the longer bumphead sunfish common name: wider card, no common-name wrap, smaller name-to-Atlas-icon gap, and a slightly more compact icon.
- `v0.8.6-dev_61` changes the displayed common name for `Mola alexandrini` to `Giant Sunfish`, folds the other common names into the general species description, and relaxes the follow-card Atlas icon spacing after review.
- `v0.8.6-dev_62` limits the `Giant Sunfish` general description to two alternate common-name mentions while retaining the broader alternate-name list for search/reference data.
- Target feel: quiet field-guide clarity layered over the aquarium, not a menu-heavy game UI.

## v0.8.5 — Follow mode stability

Status: accepted and promoted as clean `v0.8.5` from `v0.8.5-dev_3` after Jeremy approval.

### Camera / controls

- `v0.8.5-dev_1` keeps follow mode centered on mobile by removing the phone info-card camera framing bias and immediately zeroing any cropped-stage pan when a creature is focused.
- Suppresses creature reselection after follow-orbit drags by pointer-capturing the orbit drag and ignoring creature focus events for a short release window, so releasing over another fish does not steal follow mode.
- `v0.8.5-dev_2` applies the same release-window suppression to follow zoom gestures: mobile pinch zoom and follow-mode wheel zoom now ignore creature focus events briefly after zooming, so lifting a finger over another fish does not switch targets.
- `v0.8.5-dev_3` lets the follow gesture system recover after touch-up on a fish by handling touch end in capture before fish selection swallows the event, then clearing stale pinch state after a short delay so the next finger-down can orbit/zoom again.


## v0.8.4 — Creature moments repulser v1

Status: accepted and promoted as clean `v0.8.4` from `v0.8.4-dev_4` after Jeremy approval on desktop/mobile feel.

### Creature behavior

- Starts the creature-moments bucket with a species-level `repulser` flag: Mola is a repulser and sardines default false.
- `v0.8.4-dev_1` adds smoothed schooling drift away from nearby repulser creatures so sardines can softly part around the Mola instead of abruptly snapping away.
- `v0.8.4-dev_2` makes the debug follow-target marker lerp from yellow to red as repulser drift increases, then back to yellow as the school returns to its normal target.
- `v0.8.4-dev_3` temporarily added a debug-panel `repel` demo button so the effect could be reviewed without waiting for a Mola crossing.
- `v0.8.4-dev_4` removes that forced demo trigger after Jeremy accepted repulser v1; the natural Mola-proximity repulser drift remains.
- Keeps the response horizontal, biome-local, and utility-tested so the feel can be tuned without cluttering the per-frame fish loop.
- Defers the separate follow/trail creature-moment idea to a later iteration instead of blocking this clean repulser v1 release.

## v0.8.3 — Code hygiene and debug-runtime cleanup

Status: accepted and promoted as clean `v0.8.3` from `v0.8.3-dev_11` after Jeremy approval.

### Performance / code hygiene

- Cleanup stack continues the post-`v0.8.2` code-hygiene bucket by extracting shared species/hash/body-length helpers so creature identity and scale logic lives in one place.
- Starter cleanup removes confirmed-unused starter-era components and assets.
- `v0.8.3-dev_2` moves the debug panel into a bottom horizontal bar and changes debug copy/counts from sardine-specific wording to creature-level LOD/frustum readouts; single-model creatures count as LOD0.
- `v0.8.3-dev_6` removes the remaining follow-camera snapback path by preserving orbit/distance when the already-selected creature receives a duplicate pointer-up/click selection after an orbit drag.
- `v0.8.3-dev_7` makes mobile debug usable as a compact two-row strip: essentials readout on top, horizontally scrollable controls below, and audio meters collapsed out of the phone layout.
- `v0.8.3-dev_11` keeps the normal mobile version label compact by showing only the version string while preserving the full `world oceanarium` label on desktop.

## v0.8.2 — Follow-camera orbit polish

Status: accepted and promoted as clean `v0.8.2` from `v0.8.2-dev_2` after Jeremy approval.

### Camera / controls

- Starts the post-`v0.8.1` patch bucket for follow-camera orbit polish.
- `v0.8.2-dev_1` keeps drag-to-orbit constrained but persistent after pointer release, removing the snapback to centered follow framing.
- `v0.8.2-dev_2` changes follow-orbit dragging to incremental pointer deltas, so starting a new drag while already clamped at the yaw/pitch limit does not jump back toward center.
- Widens horizontal follow orbit slightly to ±36° while keeping vertical pitch at ±30° for safer surface/body framing.

## v0.8.1 — Mola recovery polish

Status: accepted and promoted as clean `v0.8.1` from `v0.8.1-dev_6` after Jeremy approval.

### Creature behavior

- Starts the post-`v0.8.0` patch bucket for Mola runtime recovery polish.
- `v0.8.1-dev_1` restricts the slow Mola fade-out/fade-in recovery to only the far negative-Z hard-recovery envelope. X-axis runtime envelope recovery now uses immediate hidden retarget/clamp behavior instead of the depth-disappearance fade.
- Adds a fade-out watchdog so a Mola that started the negative-Z recovery fade cannot remain transparent if recovery state changes before the fade-out completes.
- `v0.8.1-dev_2` gives the Mola a much larger positive-Z runtime buffer, so front/offscreen hard recovery happens farther past the camera instead of popping visibly near the tank front.
- `v0.8.1-dev_3` keeps non-negative-Z Mola runtime recovery at the expanded runtime-envelope edge instead of snapping all the way back to swim bounds, fixing bottom-right/front X-boundary exits that read as teleporting and spinning near the camera.
- `v0.8.1-dev_4` adds a debug-only simulation speed control (`1x`, `4x`, `10x`) so chance-based Mola behaviors and recovery cases can be reviewed without waiting at real time.
- `v0.8.1-dev_5` keeps Mola X/front runtime recovery from forcing the visual heading to the recovery clamp vector, fixing the visible sideways snap-turn at the X edge.
- `v0.8.1-dev_6` smooths Mola model look-at orientation across solo-agent behavior transitions, so target/behavior changes do not hard-overwrite the root quaternion in a single frame.

## v0.8.0 — Mola alexandrini + solo-agent movement

Status: accepted and promoted as clean `v0.8.0`.

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
- Adds a small centered follow-camera recovery notice when an automatically followed creature leaves the runtime boundary and the camera exits to let hard recovery happen, using the custom name when present or the common species name otherwise. `v0.8.0-dev_120` also exits Mola follow mode with the same notice if the follow camera gets close enough for the Mola to clip into the camera, so runtime recovery and camera-clip bailouts share one clear player-facing explanation. `v0.8.0-dev_121` limits manual Mola zoom-in before that clip zone so pinch/scroll cannot intentionally drive the camera into the body. `v0.8.0-dev_122` fades Mola out over 8 seconds before outer-envelope hard recovery, performs the recovery while hidden, then fades back in so boundary correction reads like swimming away and returning. `v0.8.0-dev_123` breaks up the fake fish-lighting mask with warped procedural noise and softer contrast so Mola no longer shows obvious straight light bands. `v0.8.0-dev_124` expands the mobile audio unlock path beyond UI clicks so tank/canvas gestures can start Web Audio too. `v0.8.0-dev_125` attempts audio startup immediately on tank page open and foreground return. `v0.8.0-dev_126` hardens the Mobile Safari fallback by keeping gesture retry active until Web Audio truly starts, adding pointer/touch end/cancel hooks, using silent unlock pulses, and falling back from unsupported AudioContext constructor options.
- Restores smooth camera entry into follow mode by damping the focus point from the current tank view before tracking the selected creature, and keeps the placeholder Mola base material color stable when selected by rendering the selection rim as a back-face shell instead of tinting the body.
- Adds focused debug readouts for solo agent-style individuals such as the Giant Sunfish: current movement status, speed, destination coordinates, distance to target, wall clearance, and surface clearance.
- Moves and scales the solo-agent debug readout for large creatures so the Mola label sits above the body at follow-camera distance instead of being tiny or visually buried near the target marker.
- Corrects the Mola review speed target down to 0.5–0.8 WU/s and starts replacing the old solo spline-follow behavior with a real target-seeking solo-agent movement path for non-schooling individuals, hiding the old cyan spline debug for Mola.
- Makes Mola movement forward-facing: opposite-side targets now require the animal to rotate before it translates, debug speed/distance labels use meters, the forward vector starts at the mesh front, and Mola target sampling uses wider movement bounds so it explores more of the tank volume.
- Smooths Mola target turns into broad forward arcs instead of on-the-spot pivots, so opposite-direction retargets keep moving along the face direction while turning toward the destination.
- Fixes the arc-turn stall by steering the visual facing toward the actual destination while translating along the current forward vector, with a higher minimum arc speed so the Mola keeps making progress during opposite-direction turns.
- Adds a cyan wireframe movement-boundary box to Mola direction debug so the padded solo-agent target volume is visible in the tank.
- Retunes tank-view movement bounds only: sardines and Mola get wider horizontal X travel and deeper negative-Y travel, while the Mola target volume moves farther back on negative Z. Follow mode mechanics are unchanged.
- Tunes active tank movement bounds to give sardines and Mola much wider horizontal travel (`X [-25, 25]`), lowers both movement volumes to `Y min -7`, and gives sardines explicit asymmetric depth trav

... [OUTPUT TRUNCATED - 16662 chars omitted out of 66662 total] ...

ity, so the fit safety no longer locks zoom-in/zoom-out controls.
- Expands the water-surface plane width by `3x` while scaling the procedural surface UVs in X by the same factor, preserving shimmer/glint density instead of stretching the texture across the wider top surface.
- Adds eased deceleration during the Mola sun-bask approach, ramping down forward movement over the final approach distance instead of switching from cruise speed to stationary hold abruptly.
- Delays Mola side-up roll pacing until late in the sun-bask approach: roll now starts after about `62%` route progress and caps at `92%` while still approaching, then completes to the full 90° pose gradually during the bask hold instead of snapping at the stage transition.
- Adds subtle procedural yaw and extra roll drift during Mola sun-bask hold, layered over the side-up pose so basking feels like ocean drift rather than a fixed frozen orientation.
- Smooths the sun-bask exit transition by preserving the current drift yaw/roll offsets at exit start and fading them out over the exit roll-down, while also easing the roll-down curve instead of linearly dropping from the side-up pose.
- Replaces the Mola GLB with Jeremy's refreshed upload after verifying GLB header/chunks, buffer bounds, mesh/material/skin counts, and all seven expected animation clips (`slow_cruise`, `bank_l`, `bank_r`, `burst`, `idle_drift`, `sun_bask_l`, `sun_bask_r`).
- Fixes first-tap mobile audio enable: the audio button now treats the pre-unlocked state as “start audio” even if the global gesture unlock already ran on `pointerdown`, and the audio UI only marks the graph started once the `AudioContext` reports `running` so failed mobile unlock attempts do not show a false-on mute button. `v0.8.0-dev_125` now attempts to start the Web Audio graph immediately on tank page open and again on foreground return, with gesture unlock kept only as fallback.
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