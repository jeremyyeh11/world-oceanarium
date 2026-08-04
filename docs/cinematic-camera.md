# Cinematic Camera

Status: `v0.13.0-dev_1` on `feat/cinematic-camera`, awaiting visual review. This document describes the implemented development build, not an approved clean release.

## Felt intention

Cinematic Camera should feel like the tank has noticed a living moment worth watching. It does not wander continuously or cycle presets blindly. It chooses a subject, gives the composition time to breathe, and hands attention to another subject when the animals make that transition possible.

Texture: calm, observant, lightly authored.

Rhythm: readable 5–10 second holds; early cuts only when a shot genuinely deteriorates.

Legibility: one primary subject or coherent group should be obvious without labels.

Resonance: the camera discovers relationships already present in the tank rather than scripting behavior for named species.

Surprise: the sequence is seeded and procedural, so an unexpected shared frame can become the next story beat without becoming arbitrary.

## Non-negotiable cast rule

The director contains no species names, creature ids, fixed cast size, or authored species-to-species sequence.

Mako → Sardinella was a narrative example, never an implementation rule. The same system must work with the current production assemblage, another database population, a tank containing one animal, or a future tank with different species.

## Controls

Cinematic Camera is a separate option in the tank controls menu, beside Screenshot Mode.

While active:

- ordinary tank UI is hidden;
- selected-creature follow is released;
- Screenshot Mode remains separate;
- any pointer input exits immediately;
- `Esc` exits immediately;
- resting/manual camera control resumes on exit.

A brief non-interactive hint announces the mode and its exit controls, then fades.

## Live hero discovery

`Fish.jsx` writes mutable runtime entries to `fishRegistry.js`. The existing boid consumers and the cinematic director read the same registry; the director does not traverse the Three.js scene.

At four evaluations per second, the director snapshots valid entries and creates stable candidates:

- an unschooled animal becomes an `individual` hero;
- two members sharing a school id become a `pair` hero;
- three or more members sharing a school id become a `school` hero.

A school contributes one queue entry, not one entry per fish. This prevents a large Sardinella population from overwhelming every other subject. A school shot may temporarily use one readable member as a cutaway while the school remains the queued hero.

Each aggregate carries:

- stable runtime key;
- hero kind;
- live member references;
- representative species key for diversity weighting;
- centroid;
- average heading;
- spatial radius;
- largest member body length.

Invalid, unmounted, invisible, or directionless entries are excluded.

## Rolling queue

The director maintains a rolling horizon of four future heroes. It repairs or refills that queue whenever the live candidate set changes.

Selection is seeded weighted randomness, not uniform random choice. Candidate weight includes:

- a strong cooldown for recently shown heroes;
- a diversity bonus for a different species or hero kind;
- a continuity bonus when the candidate is spatially close enough to share a frame with the current hero;
- a small base weight so a valid candidate can eventually return.

Queue entries are revalidated before promotion. Missing candidates are dropped rather than forcing a broken shot. With only one hero, the queue remains empty and the director varies generic shot templates around that subject.

The seed is derived from the tank visit seed, allowing reproducible QA without making different visits identical.

## Shot grammar

The current generic vocabulary is:

- `profile-track` — camera maintains a broad side or three-quarter relationship as the hero moves;
- `lead-track` — camera stays ahead and offset, giving the animal room to enter the composition;
- `hero-static` — camera position holds while its gaze tracks the moving hero, allowing the animal to create the shot;
- `school-wide` — frames an aggregate using live radius and body scale;
- `member-cutaway` — follows one member while retaining the school as the narrative context;
- `relationship` — frames current and queued heroes together before promoting the queued hero.

Shot offsets derive from body length, group radius, heading, and spatial spread. No template names a species.

The transition grammar is:

1. hold a current-hero shot;
2. inspect the rolling queue;
3. if the queued hero can share a useful frame, create a relationship bridge;
4. promote that secondary hero in the following shot;
5. otherwise cut directly to the next viable hero rather than flying through empty water or geometry.

Within-shot position and gaze use damped camera motion. Shot changes are controlled transitions, while the director avoids long spatial camera paths across the tank.

## Shot timing and failure detection

A normal shot lasts a seeded 5–10 seconds.

The director evaluates composition at 4 Hz rather than in React state or per-frame planning. After a short settling grace period, it tracks sustained failure with hysteresis. A single noisy frame does not cut.

A shot may end early when:

- the hero disappears or becomes invalid;
- projected target position leaves the safe screen region;
- projected scale becomes too small or too large;
- profile/static/member coverage sustains a poor head-on or tail-on angle;
- lead coverage loses its intended forward angle;
- the camera-to-subject distance becomes unsafe.

Camera height is clamped above the tank floor and below the water surface. This protects the most obvious floor/surface crossings while visual review remains responsible for judging authored environment edges.

## Performance shape

- Hero planning/evaluation: 4 Hz.
- Camera pose application: `useFrame`, using mutable refs and reusable Three.js vectors.
- React state: only mode entry/exit and UI visibility.
- School telemetry: sampled from mutable member vectors; no scene traversal or React renders.
- Candidate raycasting: not included in `dev_1`; current obstruction safety relies on open tank geometry and framing checks. Add shortlisted raycasts only if review finds persistent geometry occlusion.

## Existing-camera isolation

`Camera.jsx` checks a cinematic pose only while that pose is active. Resting camera and selected-creature follow retain their existing code paths, damping, target-bone behavior, FOV logic, and default reset behavior.

On cinematic exit, cinematic smoothing state is cleared and normal camera ownership resumes immediately.

## Development review contract

Before clean promotion:

- watch at least 60–90 seconds in The Open Sea;
- confirm shots usually hold 5–10 seconds;
- confirm the same hero or species does not dominate without cause;
- confirm at least one shared-frame handoff when spatially available;
- confirm poor sustained angles recover without oscillation;
- confirm no hard tank boundary or geometry traversal is revealed;
- test The Drift's single-hero fallback;
- test pointer and `Esc` exits;
- test desktop and phone framing/performance;
- confirm manual follow and Screenshot Mode remain unchanged.

No merge, clean version promotion, deployment, or branch deletion is authorized by plan approval alone. Those require explicit release approval.
