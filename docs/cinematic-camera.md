# Cinematic Camera

Status: `v0.13.0-dev_3` on `feat/cinematic-camera`, awaiting visual review. This document describes the implemented development build, not an approved clean release.

## Felt intention

Cinematic Camera should feel like entering a patient wildlife documentary about one chosen species. It does not wander continuously, cycle presets blindly, or browse the whole tank. It gives a composition time to breathe, then moves among individuals and groups of the selected species when their motion makes another shot useful.

Texture: calm, observant, lightly authored.

Rhythm: readable 5–10 second holds; early cuts only when a shot genuinely deteriorates.

Legibility: one primary subject or coherent group should be obvious without labels.

Resonance: the player chooses what animal to observe; the camera discovers relationships among that species rather than scripting behavior for named animals.

Surprise: the sequence is seeded and procedural, so an unexpected shared frame can become the next story beat without becoming arbitrary.

## Non-negotiable cast rule

The director contains no hardcoded species names, creature ids, or fixed cast size. Its only species constraint is the runtime key supplied by the fish the player was following when they entered Cinematic Mode.

The selected species remains the documentary's main subject until exit. Shots may switch among its individuals, pairs, and schools. Other species may cross the frame as environmental context, but they never enter the hero queue or become the promoted main subject. The same mechanism must work for any current or future species without authored cases.

## Controls

Entry is deliberately contextual:

1. click or tap a fish to enter the existing follow camera;
2. use the Cinematic button in that fish's info card, beside Atlas;
3. Cinematic Mode starts with that fish's species locked as the documentary subject.

While active:

- ordinary tank UI is hidden;
- selected-creature follow is released;
- Screenshot Mode remains separate;
- desktop: any keyboard key exits; mouse input remains inert;
- mobile: a stationary 900ms touch/pen long press exits, with movement cancelling the hold;
- resting/manual camera control resumes on exit.

A brief non-interactive hint announces the mode and its exit controls, then fades.

## Live hero discovery

`Fish.jsx` writes mutable runtime entries to `fishRegistry.js`. The existing boid consumers and the cinematic director read the same registry; the director does not traverse the Three.js scene.

At four evaluations per second, the director first filters valid entries to the selected species, then creates stable candidates:

- an unschooled animal becomes an `individual` hero;
- two members sharing a school id become a `pair` hero;
- three or more members sharing a school id become a `school` hero.

A school contributes one queue entry, not one entry per fish. This prevents an abundant selected species from generating hundreds of near-identical queue entries. A school or pair shot may temporarily use one readable member as a cutaway while the group remains the queued hero.

Each aggregate carries:

- stable runtime key;
- hero kind;
- live member references;
- runtime species key used by the entry filter;
- centroid;
- average heading;
- spatial radius;
- largest member body length.

Invalid, unmounted, invisible, or directionless entries are excluded.

## Rolling queue

The director maintains a rolling horizon of four future heroes. It repairs or refills that queue whenever the live candidate set changes.

Selection is seeded weighted randomness, not uniform random choice. Candidate weight includes:

- a strong cooldown for recently shown heroes;
- a variety bonus for a different hero kind;
- a continuity bonus when the candidate is spatially close enough to share a frame with the current hero;
- a small base weight so a valid candidate can eventually return.

Queue entries are revalidated before promotion. Missing candidates are dropped rather than forcing a broken shot. With only one hero, the queue remains empty and the director varies generic shot templates around that subject.

The seed is derived from the tank visit seed and selected species, allowing reproducible QA without making different visits identical.

## Shot grammar

The current generic vocabulary is:

- `profile-track` — camera maintains a broad side or three-quarter relationship as the hero moves;
- `lead-track` — camera stays ahead and offset, giving the animal room to enter the composition;
- `hero-static` — camera position holds while its gaze tracks the moving hero, allowing the animal to create the shot;
- `school-wide` — frames an aggregate using live radius and body scale;
- `member-cutaway` — follows one member while retaining the school as the narrative context;
- `relationship` — frames current and queued heroes of the selected species together before promoting the queued hero.

Shot offsets derive from body length, group radius, heading, and spatial spread. No template names a species.

The transition grammar is:

1. hold a current-hero shot;
2. inspect the rolling queue;
3. if the queued hero can share a useful frame, create a relationship bridge;
4. promote that secondary hero in the following shot;
5. otherwise ease through a controlled pose/FOV handoff to the next viable hero rather than snapping, flying through empty water, or promoting another species.

Within-shot position and gaze use damped camera motion. Shot changes use a 2.8s smoothstep blend of position, look target, and FOV, while the director favors nearby same-species heroes and uses bridge shots before larger intra-species moves so the camera does not snap across the tank.

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
- Candidate raycasting: not included in `dev_2`; current obstruction safety relies on open tank geometry and framing checks. Add shortlisted raycasts only if review finds persistent geometry occlusion.

## Existing-camera isolation

`Camera.jsx` checks a cinematic pose only while that pose is active. Resting camera and selected-creature follow retain their existing code paths, damping, target-bone behavior, FOV logic, and default reset behavior.

On cinematic exit, cinematic smoothing state is cleared and normal camera ownership resumes immediately.

## Development review contract

Before clean promotion:

- enter from a followed Mako, Mahi-mahi, and Sardinella separately and verify the selected species stays the primary subject;
- watch at least 60–90 seconds for one Open Sea species;
- confirm shots usually hold 5–10 seconds;
- confirm available individuals/groups vary without another species becoming the main subject;
- confirm at least one shared-frame handoff when spatially available;
- confirm poor sustained angles recover without oscillation;
- confirm no hard tank boundary or geometry traversal is revealed;
- test The Drift's single-hero fallback;
- confirm desktop mouse input does nothing and any keyboard key exits;
- confirm a short mobile tap does not exit, movement cancels the hold, and a stationary 900ms long press exits;
- test desktop and phone framing/performance;
- confirm manual follow and Screenshot Mode remain unchanged.

No merge, clean version promotion, deployment, or branch deletion is authorized by plan approval alone. Those require explicit release approval.
