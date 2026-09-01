# Procedural caudal fish review

Status: clean `v0.14.0` established the procedural caudal runtime; `v0.14.0-dev_13` continues review with Jeremy's new static runtime GLBs, stronger movement ranges, species-shaped body-wave silhouettes, a continuous Mako patrol, forward-led large-fish turning, a pelvic-fin-welded Mako export, and a mask-driven Giant Sunfish with paired local-Y fin yaw on `feat/static-procedural-fish-models`.

## Scope

This review build removes authored animation playback for:

- Spotted Sardinella (`Amblygaster sirm`)
- Mahi-mahi (`Coryphaena hippurus`), male and female assets
- Shortfin Mako (`Isurus oxyrinchus`)
- Giant Sunfish (`Mola alexandrini`)

GLB animation clips remain embedded in existing asset files for rollback comparison, but runtime passes an empty clip set to `useAnimations` whenever `model.proceduralAnimation` exists. No authored clip can influence pose for these species.

## Felt intention

- **Sardinella:** quick, economical tail cadence; school stays alive without synchronized clip loops.
- **Mahi-mahi:** rigid head and front body carrying intent; compact rear-body tail flick during pair turns, not a long S.
- **Mako:** heavy, continuous forward patrol; a strong mid-body-to-tail travelling wave reveals a broad S load before the tail completes the stroke.
- **Giant Sunfish:** heavy disc carries intention; tall dorsal and anal fins row it forward, pectorals assist turns, and its clavus barely trims the rear. It must never read as a tail-propelled fish.

Force chain: head carries intention, body transmits force, tail finishes stroke. Whole-body uniform wobble is rejected.

## Runtime drivers

Simulation writes live values every frame:

- normalized speed
- normalized acceleration
- signed turn
- burst envelope
- actual-forward-speed easing
- deterministic individual phase

Each procedural rig integrates its own continuous wave clock. Frequency changes from speed/burst therefore do not re-project global elapsed time onto a new phase or pop the pose.

For larger procedural fish, the rendered heading follows the same already turn-capped vector used to advance the creature's position. This prevents render-only heading smoothing from rotating the long body ahead of its actual trajectory, which reads as spinning on the spot. Mahi pairs and Mako use this forward-led path; smaller fish retain their existing visual smoothing.

## Current asset bridge

Jeremy's replacement male Mahi was the first true static-mesh path. The `v0.14.0-dev_10` review extends that path to four supplied runtime GLBs: Sardinella, male Mahi, female Mahi, and Shortfin Mako. They contain no bones, skin weights, or animation clips; their body waves come from GPU vertex deformation. This pass widens caudal displacement, turn and burst response, and independent fin flutter while preserving each species' front-body rigidity; Mahi and Mako normal cruise speed are also raised 25%. Its longitudinal phase and flex envelope are now species-specific: Mako deformation begins much farther forward and travels far enough to counter-curve the tail into a visible S; Mahi remains tail-led, compact, and fast. The Mako's configured drift state is disabled, so it retains continuous forward motion at every normal behavior beat; its cruise, snap, and burst rates each receive a further 20% increase. Mahi and Mako visible headings now remain locked to their actual turn-capped paths.

The new Mahi runtime GLBs preserve separate pectoral/pelvic fin meshes. The Mako keeps separate pectorals for subtle procedural flutter, while Jeremy's revised Mako export welds both pelvic fins into `shortfinmako003`; they now travel continuously with the body wave and cannot detach. Independent fin objects remain excluded from body bending.

Jeremy's static Mola uses `COLOR_1` as motion data, exposed by Three as `color_1`: exclusive red/green/blue gradients mean dorsal/anal/clavus, while RGB-grey means pectorals. The Mola shader leaves the black body mask almost rigid; red and green yaw together around local Y toward the same `−X/+X` extreme, pectorals assist turns, and the clavus remains restrained. `COLOR_0` remains white material data and does not tint the animal.

Future caudal assets may ship as neutral static meshes. They need consistent `+Z` swim-forward orientation, sufficient longitudinal topology, clean normals, and predictable bounds. A later GPU vertex-deformation path can derive head-to-tail influence from local longitudinal position; painted masks remain optional for fin isolation or anatomy that automatic bounds cannot classify cleanly.

## Static target meshes

- Sardinella body: `sardine`, source axis `x`, lateral axis `z`.
- Mahi male body: `mahi-combined`; fins: `mahi-malepectoral-finsl/r`, `mahi-malepelvic-finsl/r`.
- Mahi female body: `mahi-female`; fins: `mahi-femalepectoral-finsl/r`, `mahi-femalepelvic-finsl/r`.
- Mako body: `shortfinmako003` (includes welded pelvic fins); independently fluttered fins: `shortfinmakopectoral-finsl/r`.
- Giant Sunfish body: `10001003`; motion-mask attribute: `color_1` (`COLOR_1` in GLB).

Run `npm run verify:procedural-fish-assets` to prove the static target GLBs expose the expected body/fin meshes and contain no authored clip, bone, or skinning data.

## Review gates

- Sardinella cruise reads fast but not twitchy; individuals remain desynchronized.
- Mahi head/front body stays stable; rear body follows actual pair steering rather than holding a permanent sideways curl.
- Mahi and Mako visibly travel through every turn; neither rotates in place ahead of its motion. Mako keeps moving through every normal behavior beat, and shows a broad, unmistakable S from mid-body to tail while the head/shoulders carry its line; it remains powerful and deliberate, never eel-like.
- Giant Sunfish retains a heavy, calm disc body while dorsal/anal fins visibly row; pectorals and clavus do not detach, flicker, or tint its material.
- Burst increases stroke force and cadence without a pose cut.
- Follow/orbit selection, Atlas, LOD switching, audio cues, boids translation, and every unrelated authored-animation species remain unchanged.
- No runtime/WebGL errors.
