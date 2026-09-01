# Procedural caudal fish review

Status: `v0.14.0-dev_1` on `feat/procedural-fish-animation`, awaiting movement-feel review.

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

Existing GLBs are skinned, so this first test reuses their neutral bone chains as deformation lattices while discarding authored timelines. This proves animation-authoring removal without requiring asset re-export.

Future caudal assets may ship as neutral static meshes. They need consistent `+Z` swim-forward orientation, sufficient longitudinal topology, clean normals, and predictable bounds. A later GPU vertex-deformation path can derive head-to-tail influence from local longitudinal position; painted masks remain optional for fin isolation or anatomy that automatic bounds cannot classify cleanly.

## Target bone chains

- Sardinella: `Bone` → `Bone001` → `Bone002` → `Bone003`
- Mahi-mahi: `spine003` → `spine004` → `spine005` → `spine006` → `spine007`
- Mako: `spine003` → `spine004` → `spine005` → `spine006`

Run `npm run verify:procedural-fish-assets` to prove both Mahi variants and the Sardinella/Mako assets still expose every configured deformation bone while reporting the embedded clips that runtime ignores.

## Review gates

- Sardinella cruise reads fast but not twitchy; individuals remain desynchronized.
- Mahi head/front body stays stable; rear body follows actual pair steering rather than holding a permanent sideways curl.
- Mako reads powerful and deliberate, not eel-like.
- Burst increases stroke force and cadence without a pose cut.
- Follow/orbit selection, Atlas, LOD switching, audio cues, boids translation, and Mola authored behavior remain unchanged.
- No runtime/WebGL errors.
