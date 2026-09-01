# Procedural caudal fish review

Status: clean `v0.14.0` established the procedural caudal runtime; `v0.14.0-dev_6` continues review with Jeremy's new static runtime GLBs and stronger movement ranges on `feat/static-procedural-fish-models`.

## Scope

This review build removes authored animation playback for:

- Spotted Sardinella (`Amblygaster sirm`)
- Mahi-mahi (`Coryphaena hippurus`), male and female assets
- Shortfin Mako (`Isurus oxyrinchus`)

GLB animation clips remain embedded in existing asset files for rollback comparison, but runtime passes an empty clip set to `useAnimations` whenever `model.proceduralAnimation` exists. No authored clip can influence pose for these species.

## Felt intention

- **Sardinella:** quick, economical tail cadence; school stays alive without synchronized clip loops.
- **Mahi-mahi:** rigid head and front body carrying intent; broad rear-body follow-through during pair turns.
- **Mako:** heavy, committed glide; rigid torso; caudal power increases during acceleration and burst.

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

## Current asset bridge

Jeremy's replacement male Mahi was the first true static-mesh path. The `v0.14.0-dev_6` review extends that path to four supplied runtime GLBs: Sardinella, male Mahi, female Mahi, and Shortfin Mako. They contain no bones, skin weights, or animation clips; their body waves come from GPU vertex deformation. This pass widens caudal displacement, turn and burst response, and independent fin flutter while preserving each species' front-body rigidity; Mahi and Mako normal cruise speed are also raised 25%.

The new Mahi and Mako runtime GLBs preserve separate pectoral/pelvic fin meshes. The body mesh receives the travelling caudal wave; fins are excluded from body bending and receive small procedural flutter from the same live movement clock.

Future caudal assets may ship as neutral static meshes. They need consistent `+Z` swim-forward orientation, sufficient longitudinal topology, clean normals, and predictable bounds. A later GPU vertex-deformation path can derive head-to-tail influence from local longitudinal position; painted masks remain optional for fin isolation or anatomy that automatic bounds cannot classify cleanly.

## Static target meshes

- Sardinella body: `sardine`, source axis `x`, lateral axis `z`.
- Mahi male body: `mahi-combined`; fins: `mahi-malepectoral-finsl/r`, `mahi-malepelvic-finsl/r`.
- Mahi female body: `mahi-female`; fins: `mahi-femalepectoral-finsl/r`, `mahi-femalepelvic-finsl/r`.
- Mako body: `shortfinmako003`; fins: `shortfinmakopectoral-finsl/r`, `shortfinmakopelvic-finsl/r`.

Run `npm run verify:procedural-fish-assets` to prove the static target GLBs expose the expected body/fin meshes and contain no authored clip, bone, or skinning data.

## Review gates

- Sardinella cruise reads fast but not twitchy; individuals remain desynchronized.
- Mahi head/front body stays stable; rear body follows actual pair steering rather than holding a permanent sideways curl.
- Mako reads powerful and deliberate, not eel-like.
- Burst increases stroke force and cadence without a pose cut.
- Follow/orbit selection, Atlas, LOD switching, audio cues, boids translation, and Mola authored behavior remain unchanged.
- No runtime/WebGL errors.
