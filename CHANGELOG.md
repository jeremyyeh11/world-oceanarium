# Changelog

Significant changes only. Categorized by feature area inside each clean release/version grouping.

Versioning convention notes:
- Current convention: work toward a clean target release using visible `-dev_##` builds, then publish the clean version when accepted.
- Dev patches are intentionally excluded below; each target release summarizes the accepted bucket.
- Before the dev-patch convention, changes are grouped by minor version (`v0.6.x`, `v0.5.x`, etc.).
- Earliest unversioned work is grouped as `pre-v0.x`.

## v0.13.0 — Procedural cinematic camera

Status: `v0.13.0-dev_2` is in development and awaiting Jeremy's visual review. It has not been promoted to a clean release.

### Camera / presentation

- Adds Cinematic Camera to the selected fish's follow info card beside its Atlas shortcut. The followed fish supplies a runtime species key; the director discovers eligible individual, pair, and school heroes of that species from the live registry without hardcoded species names, creature ids, or cast size.
- Keeps that species as the documentary's main subject for the full session. Shots may move between its individuals, pairs, and schools while other species remain incidental background context rather than queue heroes.
- Maintains a seeded weighted rolling queue instead of uniform random cuts. Recent heroes are cooled down, underrepresented hero types gain weight, and spatially bridgeable candidates are preferred.
- Uses generic profile, lead, static, member-cutaway, school-wide, and relationship-bridge compositions. Shots hold for 5–10 seconds unless sustained bad framing, scale, viewing angle, or runtime invalidation triggers an early replacement.
- Hands subjects off through shared-frame relationship shots when a viable next hero is nearby. A school is one queue hero rather than one queue entry per member; a readable member may be used as a temporary cutaway.
- Keeps planning/evaluation at low frequency while camera motion stays frame-smooth. Runtime telemetry uses mutable Three.js data rather than React state updates or repeated scene traversal.
- Desktop exits on any keyboard key; mouse input remains inert. Mobile touch/pen exits after the same movement-cancelled 900ms long press used by Screenshot Mode. Manual resting and selected-creature follow cameras remain separate and regain control on exit.

### Validation

- Production build and lint pass locally for `dev_2`. Browser smoke confirmed contextual entry from followed Sardinella and Mako info cards, species-locked primary framing with other species only incidental, inert desktop mouse input, any-key desktop exit, and mobile-style touch simulation where short tap and moved hold stayed active while a stationary 900ms hold exited.

## v0.13.0 — Deforming ocean surface

Status: accepted and promoted as clean `v0.13.0` from the historically labeled `v0.14.0-dev_12` review build after Jeremy reju. The clean number was corrected to follow `v0.12.3`; the feature remained isolated from the cinematic-camera branch throughout review.

### Environment / atmosphere

- Replaces the visually animated but physically flat two-triangle ceiling with a 320×320 WU, 256×256-segment water mesh displaced in the vertex shader by six deterministic Gerstner waves arranged as three crossed scales.
- Derives surface tangents and normals analytically in the same vertex pass and feeds them into a real `MeshPhysicalMaterial` with water IOR, transmission, thickness, absorption, roughness, Fresnel reflection, and clearcoat across the full plane—no front-only fragment alpha strip.
- Gives the water material its own licensed 1K Qwantani Pure Sky HDR environment for underside reflection/refraction without changing creature lighting or the scene background.
- Keeps physical transmission mobile-conscious with a half-linear-resolution refraction target, and distance-fades the material before the plane edge can enter upward views.
- Retunes the physical tint from saturated cyan toward the tanks' muted cobalt/steel-blue palette, then combines camera-distance and grazing-angle alpha fades so the far surface dissolves into water fog before it can form a hard horizon line.
- Suppresses the surface more decisively at shallow viewing angles, removing the repeated reflected bands seen in portrait and level views without adding a replacement noise texture; steeper upward views retain the physical HDR material and Gerstner deformation.
- Restores the low-angle HDR reflection with a denser, lower-amplitude `4.2–8.5 WU` Gerstner spectrum, so reflected wave lines are materially smaller than the prior `12–22 WU` ribbons; the closer distance fade hides the smaller plane before its edge.
- Pairs each coarse, medium, and fine displacement scale with a second incommensurate wave moving in a different direction and at a different speed, then balances their amplitudes so no single sinusoid dominates the reflection.
- Raises only the water material's Qwantani Pure Sky HDR environment intensity from `0.8` to `1.15`, making the underside reflection brighter without relighting fish, fog, or either tank.
- Widens the crossed displacement spectrum to `3.1–20 WU` across coarse, medium, and fine pairs, creating a stronger large/medium/small hierarchy instead of six similarly sized tiled ripples.
- Lowers the default camera target from `lookY=-2.1` to `-2.75` (about `3.4°` upward) so the horizontal ceiling crowns portrait framing rather than occupying nearly half the screen; the plane remains at its physical world height and follow framing is unchanged.
- Raises the crossed spectrum's lower bound from `3.1` to `4.5 WU` (`4.5–22 WU` overall) and increases only the water-local Qwantani HDR environment intensity from `1.15` to `2.2`.
- Increases that water-local HDR intensity again from `2.2` to `8.0`, making reflected sky highlights visibly brighter than the water body without changing global tank lighting.
- Keeps the authored fake god-ray planes exclusive to the settled default camera view; follow/orbit and the transition back to default retain particles and physical water but render no fake shafts.
- Redistributes the unchanged `0.119 WU` wave budget into descending pair magnitudes—coarse `0.064`, medium `0.036`, fine `0.019 WU`—so the three wavelength bands differ in physical height as well as wavelength, direction, and speed.

## v0.12.3 — Larger Sardinella schools

Status: accepted and promoted as clean `v0.12.3` from `v0.12.3-dev_1` after Jeremy approval.

### Creature behavior

- Raises the shared-school cap from 64 to 180 fish. The current 275 live Spotted Sardinellas now resolve into two logical schools (180 + 95) instead of five (64 + 64 + 64 + 64 + 19); Mahi-mahi remain explicitly capped at pairs via `schoolMaxSize: 2`.

## v0.12.2 — Persistent tank sessions

Status: accepted and promoted as clean `v0.12.2` after Jeremy's visual pass. No further visual changes are required.

### Tank continuity

- Switching tanks no longer resets every inhabitant. Continuity-critical fish state now lives in `src/components/fishRuntimeStore.js`, keyed by creature id, so position, heading, velocity, committed boid steering, simulation clock, and seed/reset gates survive the active tank's unmount/remount cycle.
- Only the active tank remains mounted and rendered, preserving the existing `O(active tank)` runtime cost. Hidden tanks do not simulate in the background; they freeze and resume when revisited.
- `App.jsx` prunes stored snapshots whenever live creature data changes, preventing removed creatures from leaving stale runtime entries. A page reload clears the module store and intentionally starts a fresh session.
- Returning schools preserve each member's position and heading without teleporting. The shared school migration goal is still recreated when its leader remounts, so a school may choose a new travel direction after resuming; this is an optional continuity refinement, not a release blocker.

### Validation

- Production build and lint passed, GitHub Build and Vercel Production completed successfully, the public alias serves clean `v0.12.2`, and Jeremy cleared the visual pass.

## v0.12.1 — Frozen-mahi regression fix

Status: patch on `v0.12.0`. Fixes a data-dependent freeze that surfaced only on the live (production Supabase) creature set, not the static/dev set.

### Creature behavior

- Fixes a mahi freezing in place, a regression from the `v0.12.0` school/solo unification (#62). That change classified movement as `isSchooling` (in a school) vs `isSoloAgent` (`species.schooling === false`), so a **schooling** species that failed to pair up matched *neither* mode: it never got a steering target, held its heading straight into a swim-bounds wall, and `clampToSwimBounds` pinned it there every frame (animating but not translating). A mahi ends up unschooled because `Biome.jsx` drops any group of `< 2` from schooling and mahi's `schoolMaxSize` is 2 — so an **odd** count of alive mahi in one `biome:depthZone` orphans exactly one. This is data-dependent: production held 5 alive mahi in `ocean:epipelagic` (→ pairs `[2] [2]` + a frozen `[1]`), while the static/dev seed has 4 (two clean pairs), so it never reproduced locally. Fix: `isSoloAgent` now covers *any* creature not currently in a school (`Boolean(species) && !isSchooling`), so an orphaned schooling fish roams on the solo-agent path (personal target + boundary-avoidance steering) instead of freezing; the designed solitary hunters (mako/mola) are unchanged and still solely own the agent debug readout. Note the same orphaning happens whenever a paired mahi dies (its partner becomes a live singleton), independent of any deploy. Verified in preview against the live data: all 5 mahi translate (net 4.5–13 WU over ~2s, smooth), the former orphan cruises freely, eslint/build clean.

## v0.12.0 — Unified boids movement

Status: accepted and promoted as clean `v0.12.0` from `v0.12.0-dev_12` after Jeremy reju (merged via #62).

### Creature behavior

- `v0.12.0-dev_12` unifies schools and solo agents onto one movement pipeline: every creature now runs the same per-frame steer → boids → turn-cap → integrate → clamp integrator, differing only in how its base desired heading is produced (schools: shared migration goal + formation slot; solo agents: personal roaming/authored target) and in species-shaped clamps. The solo agent is a "school of one" — its two-step capped steering, `soloAgentSpeed` fallback, and the entire `clampToSoloAgentRuntimeEnvelope` overshoot-envelope machinery (margins, probe, mola snap-and-retarget recovery) are deleted; the mako is held by the shared `clampToSwimBounds` + its surface ceiling, and now applies spine-bend turn intent (its `curveDeform.turnIntentScale` was authored but previously unread in the solo path). The mola keeps its authored layer on top of the unified integrator: sun-bask state machine (boids suppressed while active, approach-decel/exit-ramp now shape the shared integrator's speed), depth-residency targets, surface ceilings, a hard forward wall at the end of its authored target range (its front-excursion/bask targets extend past the shared zMax), and a soft rear wall — past it the negative-Z fade-out/snap/fade-in recovery still runs (`isMolaDeepZExit`). `boundaryAvoidanceTurnStep` now applies to the mola too (it was mako/school-only). Inert tuning fields removed: `turnRadius` (all species + default) and `soloSteeringTurnRateDegrees` (mako).
- `v0.12.0-dev_11` removes the last of the spline/path plumbing — no fish uses a `THREE.CatmullRomCurve3` anywhere anymore. Solo agents (mako/mola) had kept a vestigial path: a predictive debug curve rebuilt on every retarget (fed only the overlay deleted in dev_7), a `useState` spline used solely to seed the first-frame spawn position, and a legacy path-sampled follow-target fallback. Now: the three debug-path builds and their refs are gone; solo agents seed their first frame from a deterministic seeded point in bounds (`pickSoloAgentTarget`, mirroring the school spawn centre); the fallback follow-target projects ahead along the current heading; and `makeSwimPath`, `limitPathYGradient`, `traversalY`, `randomPoint`, `makeSoloAgentSteeringDebugPath`, `soloAgentSteeringTurnRate`, `SPLINE_MOVEMENT_ENABLED`, `randomSeed`, and their constants are deleted (~200 more lines). Verified in-preview: all 93 Open Sea fish spawn and move (mahi/sardines/mako, everyone below the surface, mako ≤ its ceiling); the mola spawns, cruises, runs its deep/front excursions and holds correctly at its surface ceiling at 10x. The sun-bask state machine is untouched apart from those dead viz lines (a natural bask wasn't rolled during verification — worth one visual confirm via the debug BASK button). Note: the `turnRadius` and `soloSteeringTurnRateDegrees` species fields are now inert (their readers were dead code); left in `species.js` pending the planned solo/school pipeline merge.
- `v0.12.0-dev_10` completes the mechanical dead-code sweep left by the boids swap: deletes ~660 lines of orphaned movement code from `Fish.jsx` — the unused spline/path builders (`makeSchoolPath`, `rotatedSchoolPoint`, `offsetFromSchoolPoint`, `makeSoloAgentPath`, `makeSoloAgentBezier`, `measureSoloAgentCurve`, `makeSoloAgentBoundaryGlidePath`, `makeSoloAgentRecoveryArc`, `makeSoloAgentForwardFallbackPath`, `soloAgentPathMeetsEndpointGate`, `pickSoloAgentDestination`, boundary-endpoint helpers, `limitAvoidanceAngle`, `currentSchoolDrift`), their ~45 orphaned constants (`SCHOOL_TRAVEL_ENABLED`, `SCHOOL_PHASE_WINDOW`, `REPULSER_DRIFT_*`, `SOLO_AGENT_CURVE_*`, `SOLO_AGENT_RETARGET_*`, `AGENT_BOUNDARY_GLIDE_*`, `SCHOOL_DRIFT`, …), scratch vectors, and the write-only `phase`/`driftPhase`/`driftSpeed` formation fields. No behaviour change; build clean, movement-related lint warnings 41 → 0 (2 unrelated pre-existing remain).
- `v0.12.0-dev_9` keeps the mako a visible presence in the main tank and removes its edge-snap. It had the widest roaming volume in the tank (`movementBoundsScale 1.48`, `boundsZMin -36`) with a ~41 WU turn radius, so it spent most of its time off-screen and, out at the far edges, overshot its envelope into hard clamps (the "tail drifting up/down at the screen edge"). Pulled the range in (`movementBoundsScale` 1.48→1.22, `boundsZMin` -36→-26) and sized the turn radius to the tighter box (`turnRadiusBodyLengths` 2.6→1.7) so it carves away from boundaries instead of overshooting. Verified: the mako now cruises as an on-screen centerpiece and its Z range stays within the new envelope (was reaching ~-38, now ~-22) with no far-edge snapping.
- `v0.12.0-dev_8` stops the follow cam kicking you out of the mako. While following a solo agent, its runtime-envelope recovery was suppressed and the *only* response to it reaching an envelope edge was to release focus (the "back in a bit!" notice) — so following the wide-roaming mako dropped you constantly, even while it was clearly on screen. That release made sense when recovery *teleported* the fish, but dev_5/dev_6 made the mako's boundary handling gentle. Now the mako gets its gentle surface + envelope clamp applied every frame (including while followed), so it stays inside its envelope and trackable, and the follow-release is gated to the mola only (whose snap / fade-out recovery genuinely needs it).
- `v0.12.0-dev_7` begins the post-boids dead-code cleanup: removes the schooling-spline debug overlay (the cyan predictive line, already gated off behind the disabled `SPLINE_MOVEMENT_ENABLED`) and its now-orphaned helpers (`makePathGeometry`, `splineGeometry`, `schoolMaxAvoidanceAngle`, `schoolDirectionResponse`). No behaviour change. The larger mechanical sweep (remaining unused solo-agent path builders and constants) and the solo-agent path-plumbing removal are tracked for a follow-up pass.
- `v0.12.0-dev_6` stops the mako swimming up through the water surface (a regression exposed by dev_5's gentler recovery). The mako's runtime-overshoot envelope adds a ~5.5 WU vertical margin above its swim bounds, putting its ceiling near y≈7.9 — well above the surface plane (y=4.6) — and only the mola had a surface ceiling. dev_5 removed the old recovery's hard downward shove, so the mako could now drift up and linger at that above-water ceiling. Added a generic surface ceiling for non-mola solo agents (`clampToSurfaceCeiling`) at `SURFACE_PLANE_Y - SOLO_AGENT_SURFACE_CLEARANCE` (2.0), applied every frame and flattening any upward heading so the mako glides along it instead of nosing through. Verified at 10x: mako max y = 2.60 (the ceiling), 0 frames above the surface, still diving its full range.
- `v0.12.0-dev_5` fixes the mako drifting vertically up and down when the sim is sped up (found at 10x after a while). The solo-agent runtime-envelope recovery, when a fast agent overshot its expanded envelope, snapped the position to the edge, forced the heading to the pure inward normal, and re-picked a target every frame — so a mako that overshot the vertical envelope got pointed straight in, snapped, then re-accelerated straight back out, thrashing vertically (position being *set*, not swum). Non-mola solo agents (the mako) now use the same gentle boundary handling as the boids schools: a plain position clamp back inside the envelope, letting steering + boundary-avoidance turning carve the heading away over the next frames — no forced heading, no per-frame re-target, so the snap loop can't form. The mola keeps its snap-and-retarget recovery (its authored surface/sun-bask behaviour relies on it). Verified: over ~240s of 10x sim the mako traverses its full vertical range smoothly (worst 1 direction-reversal per 2s, no snap-sized jumps) instead of thrashing.
- `v0.12.0-dev_4` finishes the mahi tail fix flagged in review (tail still bent while cruising). With `turnIntentScale` already 0, the `curveDeform` tail bend is driven purely by the actual per-frame turn rate (× 10.5) — so the mahi looked cocked because it was *continuously turning*: its `turnRadiusBodyLengths` of 2.8 gave a ~20 WU turn radius inside a ~27 WU-wide confined box, so a pair that reached a wall or corner could not out-turn it and orbited in place. Lowered `turnRadiusBodyLengths` 2.8 → 1.3 (a broad arc that still fits the bounds, so the mahi carves away and straightens) and `curveDeform.strength` 1.0 → 0.45 (gentle cruise-arcs barely bend the tail; genuine turns still bank). Measured mahi turn rate dropped from up to ~9°/frame (spinning) to ≤1.3°/frame with tail-bend intent ≤0.10 (essentially straight), no freeze or backward-swim, while sardine heading coherence stayed ~0.94 at rms ~2.1 WU.
- `v0.12.0-dev_3` tightens the school tuning after review feedback (schools too loose / facing random directions, mahi tails still cocked). Sardinella now form a coherent directional cloud: measured heading coherence ~0.95 (fish generally face the same way) at rms radius ~2.3 WU — looser than the old spline ball but tighter than the dev_2 scatter — via stronger alignment (0.16→0.38) with lighter separation (0.55→0.30) so separation stops fighting the formation slot. The mahi tail cock is driven by `curveDeform` bend, which sums the actual per-frame turn rate with a `turnIntent` (heading-vs-desired) term; under continuous boid steering that term stayed high and baked in a permanent sideways tail, so mahi `turnIntentScale` is now 0 (bend follows real turning only, like the mako). Also: formation-slot pull is scaled down for tiny schools so a pair travels parallel instead of orbiting their slots; the shared migration direction is low-pass filtered so per-frame goal re-picks don't accumulate into a constant turn; and school goals are inset from the walls so a wide-turning school (big body, tight bounds) banks away early instead of thrashing into a boundary it can't out-turn.
- `v0.12.0-dev_2` fixes two regressions from the dev_1 boids swap: schooling fish strung into a single-file conga line and the mahi held their tails cocked at a fixed angle. Both came from steering every member toward the same goal *point* offset by its formation slot in world axes — that funnels the group single-file and holds a permanent yaw. Schools now migrate along a shared *direction* (goal − live school centroid, leader-computed and identical for all members) so they travel parallel, and each fish is pulled toward its formation slot placed in the travel frame (right = perpendicular-to-heading, up = world Y) around the centroid, so the shape is designed rather than emergent — a single-file line is no longer a stable equilibrium. Boid separation/threat ride on top for anti-overlap and predator avoidance. Retuned the sardinella boids for the new model (separation 0.38→0.55, alignment 0.24→0.16, maxWeight 0.38→0.62). Measured: sardine along:lateral spread ratio 18:1 → ~1.2:1 (a rounded cloud), mahi tail-bend intent down to ≤0.18 (gentle bank, not a cocked C-curl), with no freeze or backward-swim regression.
- `v0.12.0-dev_1` removes the schooling spline entirely and moves schools onto pure boids, fixing the mahi-mahi freeze/backward-swim bug at its root. Schooling fish used to chase a follow-target sampled on a shared spline, with motion capped to the distance-to-target (no overshoot). The follow-target parameter `clamp(t + followDistance/pathLength, 0, 1)` saturated at the path endpoint whenever `followDistance` was large relative to the path — true for the big-bodied mahi in its confined bounds — so the target pinned to the curve's end, the fish caught up, and `targetDistance→0` froze it in place (turning/animating but not translating) until the leader regenerated the path; a fish nudged past the pinned target then swam backward to return. This replaces `getSchoolState`'s path/progress with a shared roaming **goal point** (the leader repicks it via `pickSoloAgentContinuationTarget` on arrival), and rewrites the school-follower step to steer toward that goal (offset per member by its formation slot) blended with first-class boid separation/alignment/cohesion, capped to a body-length turn arc, integrating velocity freely with no distance cap. Also deletes the `v0.12.0-dev` anti-stuck watchdog and the no-overshoot clamp that were band-aiding the freeze. Verified over sustained runs: no mahi freeze, zero backward-swim frames, sardine schools stay tight balls (rms radius ~1.7 WU) and mahi hold loose pairs.

## v0.11.0 — Visual/UI refinement

Status: accepted and promoted as clean `v0.11.0` after the visual/UI refinement pass and review fixes.

### Camera / follow

- Lowers the resting camera pitch and tightens the water-surface far fade so the ceiling no longer dominates the upper frame while preserving camera position, FOV, and scale-by-position.
- Follow mode now aims at an optional per-species body bone, supports closer zoom and full-yaw orbit at constant distance/FOV, and releases cleanly when switching tanks.
- Revalidates the cached follow bone after model remounts, fixing the camera becoming stranded when debug mode swaps fish materials. Missing configured bones fall back safely and produce a debug warning.

### Environment / UI / debug

- Makes the equirectangular background and god-ray pattern wrap seamlessly, fades god rays edge-on, fades the seabed rim, and blurs across the assembled wrap so orbiting exposes no obvious seam.
- Restricts direction, boid, and name overlays to the selected creature; removes deprecated drift/follow-target markers; and scales name labels with camera distance.
- Keeps the tank switcher clear of the debug toolbar and hides it on mobile while the creature info card is open.
- Disposes the imperatively-created floor material on biome change/unmount, preventing a shader/material leak.

## v0.10.0 — Boid schooling movement

Status: accepted and promoted as clean `v0.10.0` from `v0.10.0-dev_14` after Jeremy reju (merged from `feat/boid-schooling-overlay`).

### Creature behavior

- `v0.10.0-dev_14` widens the horizontal swim volume ~1.5x (`GLOBAL_X_DESTINATION_RANGE_SCALE` 0.9 → 1.35) so fish deliberately swim off-screen to the left/right — this hides hard-reset u-turns at the boundary and declutters the tank when crowded. Also widens turn radii (`turnRadiusBodyLengths`: sardine 1.3 → 2.0, mahi 1.6 → 2.8, mako 1.4 → 2.6, mola 1.2 → 2.0; default 1.6 → 2.5) so opposite-direction retargets sweep as wide arcs rather than tightening toward an on-the-spot rotation.
- `v0.10.0-dev_13` fixes the mahi still bending into a held C-curl during turns (the curve-deform, not the animation). Unlike the mako — whose `curveDeformTurnIntent` is never set (that assignment lives only in the school branch), so its bend is driven purely by the tiny per-frame turn rate — the mahi drove its spine bend from the *sustained heading misalignment*, which stays large through a whole wide-arc turn and saturated the 5-bone spine to near-max, holding a C-curl. Brought the mahi into the mako's gentle range: `maxAngleDegrees` 16 → 8, `turnIntentScale` 5.5 → 0.25 (net across dev_10/13), `strength` 1.55 → 1.0, so the spine reads as a subtle banking curve rather than a held curl.
- `v0.10.0-dev_12` stops the mahi tail spinning in circles during turns. The mahi mapped `turnLeft`/`turnRight` to the non-looping 5.61s `snap_left`/`snap_right` turn-sweep clips; under the new wide-arc turning a turn lasts several seconds, so the clip replayed repeatedly and swept the tail over and over. Mapped mahi turns to the looping `idle` swim clip instead (same approach the mako already uses), so the mahi swims continuously and banks through turns via curve-deform rather than replaying a sweep animation.
- `v0.10.0-dev_11` eases the mahi curve-deform bend back to straight as forward travel slows. School movement is clamped to the follow-target distance, so a mahi crawling out of a turn moves slowly while `velocity.current` still reads cruise — leaving the tail held in a full sideways bend while barely moving. Curve-deform now takes a `speedEase01` input (actual per-frame forward travel vs the intended cruise rate, smoothed) and, where a species opts in via `easeStraightenBySpeed`, scales the turn bend by it down to a `straightenFloor`. The mahi now straightens its tail before swimming on instead of waving one-sided against a locked bend.
- `v0.10.0-dev_10` fixes the mahi-mahi freezing in a C-curl while turning. Its `turnTriggerThreshold` was 0.03, so any gentle sustained arc fired the 5.61s non-looping `snap_left`/`snap_right` clip (held for its full duration), while `curveDeform.turnIntentScale: 5.5` saturated the 5-bone spine bend to max for any turn — and dev_9's clamp had frozen the tail oscillation on top. Now: the curve-deform clamp limits only the static turn bend (follow-through + idle sway stay additive, so the tail keeps waving through a turn); the mahi turn trigger is raised to 0.3 so gentle arcs stay on the looping idle swim clip and bank via curve-deform instead of snapping; and the mahi spine bend scales with actual turn magnitude (`turnIntentScale` 5.5 → 2.2, `strength` 1.55 → 1.2) for a gentle bank rather than a full curl. The mako already maps its turns to the idle loop, so it was unaffected.
- `v0.10.0-dev_9` addresses movement nuances from review. Pitch now reflects actual vertical travel each frame instead of the direction to the target, so a creature hovering along the XZ plane reads level rather than head-up/tail-down (swim-bladder-dysfunction look); it still pitches into genuine ascents/descents. Clamps the turn-driven curve-deform bend per bone to the configured `maxAngle` so `chainMultiplier`/follow-through can no longer over-rotate mahi/mako tail bones into a kink on sharp turns. Solo-agent (mako/mola) turns are now purely body-length arc-radius based — the old fixed-degree cap turned slower than the radius implied, giving an even wider effective radius so the shark swept along tank boundaries instead of completing a forward arc; it now banks through turns at swim speed. Adds depth diversity: deepened per-species `boundsYMin` by ecology (mahi surface-associated stays shallow; mako and mola dive deep) and widened the school vertical path traversal, so creatures spread through the water column and periodically leave frame instead of clustering mid-screen.
- `v0.10.0-dev_8` fixes schools clumping in place after the spline was disabled: schools again travel toward a real destination (the shared school path's far exit, reached through its intermediate waypoints), with boids only adjusting the local formation on top — position stays boid-driven, so it is a soft destination, not the old rigid path-lock. Adds body-length turn-radius kinematics: heading changes are capped to a forward arc of `turnRadiusBodyLengths * bodyLength` (angular rate = speed / radius) for both schooling fish and solo agents, so creatures bank through turns instead of pivoting or strafing (per-species `turnRadiusBodyLengths`; `>=1` arcs, `<1` reserved for a future spin-in-place creature). Cuts over-frequent swim SFX by raising the global throttle: ambient swim sounds now gap at 1.15s while the followed creature stays responsive at 0.3s.
- `v0.10.0-dev_7` protects authored behaviors from boid interference: while a solo agent runs the mola sun-bask (approach, hold, or exit) its boid steering is fully suppressed so the authored animation owns the path, and the committed boid vector decays out so it does not snap back in when the behavior ends.
- `v0.10.0-dev_6` reworks the boid debug overlay so the system is legible: the focused fish (selected creature or any solo agent) draws a line to each remembered neighbor colored by relation — green = following, red = avoiding, gray = neutral — plus a cyan tick at each neighbor showing which way it is heading, and a magenta threat-avoidance vector for the observer. Neighbor webs are limited to the focused fish so a school no longer webs into an unreadable tangle; sampled schoolmates still show the aggregate separation/alignment/cohesion/threat vectors and a readout.
- `v0.10.0-dev_5` fixes the "jitter every half second" by committing each fish to a boid decision for roughly one animation cycle (clamped, per-fish jittered) instead of re-steering every frame, and by selecting a stable nearest-N neighbor set rather than whatever the registry iterated first. Adds a species reaction hierarchy: each species carries `menace` (how threatening it reads) and `wariness` (how strongly it reacts), so prey flee the mako at a wide radius while nobody minds the mola.
- `v0.10.0-dev_4` disables spline/path-follow movement. Schools keep their seeded initial spread, then swim from their own current heading plus boid separation/alignment/cohesion; debug no longer draws the old cyan spline line.
- `v0.10.0-dev_3` adds boid debug visualization in debug mode: selected fish, sampled school fish, and solo agents show separation, alignment, cohesion, and final boid steering vectors plus neighbor/social weight readouts.
- `v0.10.0-dev_2` removes the previous standalone soft-separation path and folds separation into the generic boid system. Boid steering now runs for schooling and solo species, considers interspecies neighbors, and uses species-biased parameters: sardines are tight/high-neighbor, Mahi-mahi are capped to one neighbor with weak pair influence, and Giant Sunfish barely avoids others while strongly repelling nearby fish.
- `v0.10.0-dev_1` prototypes a local boid overlay for schooling fish: existing shared school paths still provide the calm ocean-current route, while nearby schoolmates add capped alignment and cohesion steering on top of the existing soft separation avoidance. The goal is sardine schools that feel less spline-choreographed and more like many local decisions without turning chaotic.

## v0.9.0 — Tank assemblages & curation

Status: accepted and promoted as clean `v0.9.0` after Jeremy approval (merged via #57). See `docs/tank-design.md`.

### Tanks / curation

- A "tank" is no longer a whole biome dumped on screen. Introduced a `TANKS` curation layer (`src/data/species.js`): each tank borrows a biome for its environment but lists its cast explicitly by species id. `Biome` now renders `creaturesForTank(creatures, tank)` (`src/utils/speciesLookup.js`) instead of `c.biome === name`, falling back to the old biome filter when no tank is passed.
- Split the pelagic roster into two coherent tanks: `The Open Sea` (spotted sardinella bait → mahi-mahi → shortfin mako, a single-tempo pursuit food chain) and `The Drift` (giant sunfish alone), resolving the "rojak" mix of a slow drifter among fast hunters.
- Added a `tempo` field (`drift`/`cruise`/`sprint`) to each species and a dev-only coherence guard that warns when a tank mixes drifters with fast swimmers.
- `TankView` header now shows the tank name; `App` tracks `activeTankId` and renders a bottom-center tank switcher (only when more than one tank exists).

## v0.8.20 — Underwater depth & atmosphere review

Status: accepted and promoted as clean `v0.8.20` from `v0.8.20-dev_1` after Jeremy approval.

### Environment / atmosphere

- `v0.8.20-dev_1` reworks the ocean sunlight-zone depth read: `scene.background` now uses a dedicated deep-ocean-blue gradient (luminous surface band falling to dark mid/lower water) kept separate from the brighter environment map that lights the creatures, so the empty upper column reads as lit water instead of a flat void without under-lighting the animals. Distance fog is retuned to a deep-blue haze so far creatures desaturate into scattered light (aerial perspective) rather than fading to black. Palette pulled from teal toward pure ocean blue. The backdrop is painted at higher resolution with soft organic light mottling (large caustic-style light/dark patches) plus a blur pass, which gives the water depth/variation instead of a flat gradient and eliminates the horizontal 8-bit banding without introducing per-pixel grain. A `.tank-depth-absorption` multiply overlay (counterpart to `.tank-top-exposure`) darkens the lower field so light visibly dies with depth across both water and creatures. Tank UI without an explicit stacking level (desktop info card, biome title/zone label, follow hint) now sets `z-index: 30` so it renders above the screen-space water overlays (`z 4`) and below interactive chrome (`z 55+`).
- Marine snow / suspended particulate raised from 96 to 240 particles and redistributed down into the creature/camera zone (previously confined above it), with a slow net sink and a height-based glow so particles high in the column catch more downwelling light.
- God-ray shafts now fan out from an off-screen upper-left sun instead of marching as identical parallel bands, and gain a finer grain octave so they read as volumetric light rather than a clean decal.

### Camera

- Eased the resting default view from a ~20° up-pitch (which pinned creatures to the bottom edge) to ~10° up (`lookY` `0.35` → `-1.5`), so animals can swim into the top half of frame while the surface band and god rays still crown the top.

### Creature data / scale

- Giant Sunfish (`Mola alexandrini`) render scale raised to its factual maximum: `bodyLengthWU` `9.6 → 13.2` (≈3.3 m, matching the Atlas female average) and GLB `scale` `0.464 → 0.638`. It now visibly dwarfs the mahi-mahi; normalized individual size maps to ≈248–330 cm. The prior 2.4 m review cap is removed. Sardine, mahi-mahi, and mako scales verified factually proportionate and unchanged.

## v0.8.19 — Shortfin Mako Shark review

Status: accepted and merged directly to `main` from `v0.8.19-dev_3` (`79dccfe`) after animation/movement smoothing. The shark is live and was subsequently integrated into the tank assemblage and unified boids movement releases.

### Creature data / Atlas / asset

- `v0.8.19-dev_3` slows mako solo-agent steering/velocity changes, raises the turn trigger threshold, layers the authored burst clip softly over the continuous swim loop, and adds a subtle procedural spine/tail sway so the shark always reads as swimming instead of rigidly snapping between headings.
- `v0.8.19-dev_2` keeps mako burst movement but maps the visible burst animation back to the continuous `idle` swim loop and lengthens the model fade, avoiding the supplied `burst` clip's pose discontinuity/snap during tank transitions.
- `v0.8.19-dev_1` imports Jeremy's Shortfin Mako Shark GLB (`Isurus oxyrinchus`), adds a solitary pelagic predator species profile, one static-dev review creature, Atlas source-length scaling/pose data, and a first-pass solo movement profile with long glides and rare burst acceleration.

## v0.8.18 — Push-away boundary review

Status: accepted and promoted as clean `v0.8.18` from `v0.8.18-dev_3` after Jeremy approval.

### Movement boundary / framing

- `v0.8.18-dev_2` restores the default camera and follow-distance constants from `v0.8.17`; camera position and follow zoom are no longer changed.
- `v0.8.18-dev_3` pushes the swim boundary start/end Z planes `15 WU` farther from the camera by applying `SWIM_BOUNDARY_Z_OFFSET_FROM_CAMERA = -15` to both default and species-specific `boundsZMin`/`boundsZMax`.
- The hard solo-agent runtime envelope still derives from those shifted bounds, so reset/clamp behavior moves with the swim volume instead of fighting the new presentation.
- Clean `v0.8.18` ships the accepted `-15 WU` swim-volume offset while preserving the original camera and follow zoom constants.

## v0.8.17 — Speed Insights review

Status: accepted and promoted as clean `v0.8.17` from `v0.8.17-dev_1` after Jeremy approval.

### Observability

- Adds Vercel Speed Insights client injection beside the existing Vercel Analytics hook so deployed public builds can collect performance metrics.


## v0.8.16 — Creature sex + dimorphism review

Status: accepted and promoted as clean `v0.8.16` from `v0.8.16-dev_3` after Jeremy approval.

### Creature data / Atlas

- `v0.8.16-dev_3` imports Jeremy's returned Atlas CSV copy edits, including Sardinella adult length range and simplified social/reproduction/lifecycle wording.
- `v0.8.16-dev_2` assigns `sex` for every active creature row, including non-dimorphic species, while only sexually dimorphic model variants affect GLB selection.
- `v0.8.16-dev_1` adds a nullable `sex` creature field for Supabase `creatures` and `creatures_dev`, maps Mahi-mahi male/female rows to the matching GLB variants, shows sex on the follow info card, and adds Atlas sexual-dimorphism copy for each species. Non-dimorphic species ignore sex at the model layer.
- Clean `v0.8.16` ships creature sex across all active Supabase rows, Mahi-mahi sex-driven GLB selection, and the accepted Atlas dimorphism/copy edits.


## v0.8.15 — Mahi-mahi curve deformation review

Status: accepted and promoted as clean `v0.8.15` from `v0.8.15-dev_15` after Jeremy approval.

### Creature behavior

- `v0.8.15-dev_2` keeps accepted Mahi-mahi translation speeds and authored 1× GLB playback, then layers a controllable additive spine deformation after the animation mixer. The deformation reads path/spline turn pressure, distributes a subtle bend through `spine.001`–`spine.007`, adds a small tail-follow-through phase, and exposes model-level strength/response/max-angle/tail-bias/burst-boost tunables for review rollback or dialing.
- `v0.8.15-dev_3` increases the visible deformation after Jeremy review: stronger turn-pressure input, a higher safe max bend, faster response, more body-wide/tail follow-through, and stronger burst/speed boost while still preserving accepted translation speeds and authored 1× clips.
- `v0.8.15-dev_4` fixes the actual visibility bug: the GLB loader resolves Mahi spine bone names as `spine001`–`spine007`, so the dotted config names were not matching; it now normalizes bone names and bends on the rig's local `z` axis instead of twisting around the forward axis.
- `v0.8.15-dev_5` emergency-disables Mahi curve deformation (`strength: 0`) after review caught catastrophic accumulated spine bending in `dev_4`; keep the accepted authored animation / movement baseline safe while the additive deformation path is reworked.
- `v0.8.15-dev_6` restores visible Mahi curve deformation with a non-accumulating additive pass: each frame removes the previous additive only when it is still present, then applies a fresh local-`z` side-bend to the resolved spine chain. Strength is re-enabled at a safer visible range (`0.82`, max `9°`).
- `v0.8.15-dev_7` adds a debug bone overlay for curve-deform rigs: debug mode now defaults the `B` layer on, drawing the resolved spine chain and runtime bone names over Mahi-mahi so reviewers can see exactly which bones the deformation targets.
- `v0.8.15-dev_8` retargets bone debug to selected-creature inspection: smaller labels, all resolved GLB bones for the selected creature, no bone overlay in `View all`, and selected schooling fish now show their shared movement/follow spline even when they are not the school leader.
- `v0.8.15-dev_9` adds male/female model variants for Mahi-mahi and general school-level sex-variant assignment: schools with both sex models available receive an approximately balanced mix, with Mahi-mahi pairs resolving to exactly one male and one female.
- `v0.8.15-dev_10` makes selected-creature bone-name labels camera-facing billboards, unbold/normal weight, and front-rendered so bones stay legible over the fish mesh.
- `v0.8.15-dev_11` shrinks selected-creature bone-name labels to match the normal selected-name label font size while preserving billboard/front-render behavior.
- `v0.8.15-dev_12` moves model forward-vector debug lines to the configured head/nose offset instead of the model root, clarifying that Mahi GLB origins sit near mid-body while the debug heading starts at the nose.
- `v0.8.15-dev_13` increases Mahi spline deformation and limits additive bend targets to `spine003`–`spine007`, keeping the forward head/root bones out of the deformation chain.
- `v0.8.15-dev_14` makes Mahi curling respond to sustained turn intent toward the follow spline, adds a base bend on `spine003`, and strengthens rear-spine curl so turns read as body bending instead of straight-body rotation.
- `v0.8.15-dev_15` adds a 1.05× per-bone chain multiplier to Mahi curve deformation, smooths visual pitch changes to remove random pitch snaps, and makes newly generated school splines preserve their incoming direction with the first turn pushed away from the spline start for all schooling fish.
- Clean `v0.8.15` ships the accepted Mahi-mahi curve-deformation pass: authored GLB animation remains intact, additive bend is limited to `spine003`–`spine007`, turns use sustained follow-spline intent, debug bone/forward-vector tools are readable, Mahi pairs can use male/female variants, and schooling splines now continue smoothly across regenerated paths.

## v0.8.14 — Follow-camera retargeting

Status: accepted and promoted as clean `v0.8.14` from `v0.8.14-dev_1` after Jeremy approval.

### Camera / controls

- `v0.8.14-dev_1` fixes follow-camera retargeting: tapping another fish while already following now switches directly to that fish instead of first exiting follow mode. Follow orbit still captures the pointer after drag movement crosses the orbit threshold, so orbit-release over another fish remains protected from accidental retargeting.
- Clean `v0.8.14` ships the accepted follow-camera retargeting fix.


## v0.8.13 — Mobile release fallback hotfix

Status: accepted and promoted as clean `v0.8.13` from `v0.8.13-dev_1` after Jeremy approval.

### Creature data / mobile smoke

- `v0.8.13-dev_1` prevents a clean deployment with missing browser Supabase env vars from rendering a visually empty tank by falling back to bundled release creature rows only for the missing-env case. If Supabase is configured but empty or errors, clean builds still do not silently replace that result. The bundled fallback now mirrors the released production counts: 88 `amblygaster-sirm`, 1 `mola-alexandrini`, and 4 `coryphaena-hippurus`.
- Clean `v0.8.13` ships the mobile empty-tank hotfix so the public release shows fish even on deployments missing browser Supabase env vars, while preserving real Supabase data as the source of truth when configured.


## v0.8.12 — Mahi-mahi adult movement review

Status: accepted and promoted as clean `v0.8.12` from `v0.8.12-dev_13` after Jeremy approval.

### Creature behavior

- `v0.8.12-dev_1` removes adult Mahi-mahi from the schooling system and routes it through the solo-agent movement path used by Giant Sunfish, tuned much faster for confident adult pelagic passes. Atlas/social copy now frames adults as solo/pair travelers while noting juvenile schooling.
- `v0.8.12-dev_2` adds Mahi-mahi back into The Atlas for review now that Jeremy wants the species visible there again.
- `v0.8.12-dev_3` fixes glitchy Mahi-mahi turning by driving authored turn/burst triggers from the live visual forward vector instead of the stale debug-path end tangent, and gives Mahi-mahi a faster solo steering turn rate so it swims into turns instead of broad drifting.
- `v0.8.12-dev_4` fixes the Mahi-mahi screen-blitzing regression: solo-agent targets now limit vertical jumps from the current position, and Mahi-mahi cruise/snap/burst speeds are reduced to read as forward pelagic passes instead of full-screen up/down dashes.
- `v0.8.12-dev_5` fixes the follow-up Mahi-mahi solo-agent glitches: runtime recovery now clamps to the expanded solo envelope instead of snapping back to inner swim bounds, Mahi-mahi live turns stay on the continuous swim loop instead of snap-left/right clips, and burst movement no longer outlasts the authored burst animation.
- `v0.8.12-dev_6` adds Jeremy's supplied Mahi-mahi portrait as the Atlas species-list thumbnail, normalized to the existing 502×502 Atlas thumbnail convention.
- `v0.8.12-dev_7` retunes Mahi-mahi authored animation playback: GLB clips now play at 1× without global/random/velocity time scaling, snap-left/right turn clips are restored with a shorter blend, and solo U-turns slow down while steering faster so the fish turns through the arc instead of sliding backward.
- `v0.8.12-dev_8` moves Mahi-mahi off the failed solo-agent path and onto the proven shared group movement, capped at two fish per pair. The GLB clips remain in-place: idle is the default loop, burst/turn clips are accents with separate forward translation, and normal banking stays on idle. Static-dev fallback now carries ten `coryphaena-hippurus` rows so local/no-env review also forms pairs.
- `v0.8.12-dev_9` fixes Mahi-mahi snap-turn playback without retiming the authored GLB clips: turn movement still uses the short simulation impulse, but `snap_left` / `snap_right` now stay selected for their full authored 5.0417s duration instead of being interrupted after the 1.05s movement impulse.
- `v0.8.12-dev_10` sets global fish GLB playback back to 1× and clamps per-individual animation speed variation to 0.9×–1.1× across species. Spotted sardinella burst/snap animation holds now cover the full clip at the slowest allowed individual speed, so authored clips are not cut off while movement impulses remain short.
- `v0.8.12-dev_11` fixes one-shot authored clips freezing on their final frame: after a snap/burst hold expires, fish now return to their cruise/drift loop when no new action is triggered, instead of staying stuck if the trigger window is open but idle conditions are calm.
- `v0.8.12-dev_12` aligns Mahi-mahi burst movement to the authored burst clip: the clip starts first, the forward speed impulse waits 0.45s for the visible body action, and the burst clip is held for its full authored duration instead of being cut at the movement impulse.
- `v0.8.12-dev_13` makes authored action movement timing a named model override with a default of 0s, and increases the Mahi-mahi burst movement delay override to 0.8s so the speed impulse lands later in the authored burst action.
- Clean `v0.8.12` ships the accepted Mahi-mahi adult behavior: loose pair-group movement, authored 1× GLB playback with 0.9×–1.1× individual variation, full-duration snap/burst clip holds, explicit burst movement delay override, and Atlas visibility restored for the species page.

## v0.8.11 — Atlas release gating hotfix

Status: hotfix on `main` after `v0.8.10`.

### Interface / encyclopaedia

- Hides unreleased species entries from The Atlas and removes their follow-card Atlas shortcut, starting with `Coryphaena hippurus` / Mahi-mahi until that Atlas page is explicitly ready for release.

## v0.8.10 — Mahi mahi

Status: accepted and promoted as clean `v0.8.10` from `v0.8.8-dev_16` after Jeremy approval; clean target advanced because `v0.8.9` camera polish landed on `main` first.

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
- `v0.8.8-dev_10` desynchronizes Atlas schooling groups with per-fish animation phase, playback speed, and burst timing offsets, and applies Jeremy's latest Mahi-mahi/Giant Sunfish diver silhouette placements.
- `v0.8.8-dev_11` updates Atlas lifecycle facts from Jeremy's notes: Mahi-mahi maturity/sterility/spawn-egg range and spotted sardinella estimated maturity/unknown sterility.
- `v0.8.8-dev_12` uppercases Atlas species-list common names so the left selection column matches the right info-panel heading style.
- `v0.8.8-dev_13` adjusts spotted sardinella Atlas group composition from Jeremy's marked screenshot: pushes the upper-left companion deeper behind the diver silhouette.
- `v0.8.8-dev_14` restores the spotted sardinella hero position and moves the deeper background companion downward so it reads behind the hero instead of hidden behind it.
- `v0.8.8-dev_15` moves that deeper spotted sardinella background companion farther down after Jeremy's follow-up mark.
- `v0.8.8-dev_16` corrects the marked spotted sardinella companion: restores the left-deep companion and moves the lower-left background companion farther down beneath the hero.
- Target feel: fast, confident pelagic cruising with readable flashes and turns — elegant movement, not generic fish drift.

## v0.8.9 — Camera position polish

Status: accepted and promoted as clean `v0.8.9` after Jeremy approval.

### Camera / debug

- `v0.8.9-dev_1` starts a separate camera-position branch from clean `v0.8.7`, lowers the default tank camera, angles the look target upward for a standing-at-the-tank read, and adds debug sliders for camera height, distance, look height, FOV, and experimental depth-of-field focus/aperture/blur.
- `v0.8.9-dev_2` fixes the empty-scene regression by mounting the experimental DOF postprocess only when the debug panel explicitly enables it, so normal tank rendering does not instantiate the composer/pass stack.
- `v0.8.9-dev_3` makes the camera debug bar wrap/scroll vertically on cramped screens and adds `Shift Y`, a true vertical camera translation slider that moves both camera height and look target together instead of changing only the view angle.
- `v0.8.9-dev_4` bakes Jeremy's approved camera framing into the tank defaults (`y=-6.35`, `z=10`, `lookY=-2.65`, `fov=61`) and removes the temporary camera/DOF debug controls from the debug toolbar.
- `v0.8.9-dev_5` fixes the phone blank-scene regression by baking the approved camera slider values without double-applying the temporary `Shift Y` translation on narrow viewports (`y=-3.35`, `z=10`, `lookY=0.35`, `fov=61`).
- Clean `v0.8.9` ships the accepted lowered tank camera framing with the temporary camera/DOF debug tools removed.

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