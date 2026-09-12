# Procedural animation

Hub for World Oceanarium's rig-free animation path: static GLBs with no bones, no
skin weights, and no authored clips, posed every frame by live movement state.

Reading order:

```
AGENTS.md  →  docs/procedural/README.md  →  docs/procedural/<type>.md
```

Read this file for the rules that apply to every animal. Read the type doc for the
Blender contract, vertex-paint channels, config keys, and review gates specific to
one motion architecture.

## Types and the animals that use them

Docs are split by **motion architecture**, not by creature. A sea turtle and a
penguin are the same problem; a prawn and a lobster are not. Find the animal, read
that type's doc.

| Type | Motion | Animals | Status |
| --- | --- | --- | --- |
| [caudal-wave](caudal-wave.md) | Travelling body/tail undulation | Sardinella, Mahi-mahi, Shortfin Mako; eels and sea snakes as a config variant | Implemented |
| [mask-fin-row](mask-fin-row.md) | Rigid body, painted fins rowing from fixed roots | Giant Sunfish | Implemented |
| [bell-pulse](bell-pulse.md) | Contract-and-glide jet propulsion | Jellyfish, salps | Proposed |
| [foil-flap](foil-flap.md) | Paired oscillating foils on a rigid body | Sea turtles, penguins, sea lions | Proposed |
| [disc-wave](disc-wave.md) | Travelling wave along a lateral margin | Rays, skates, cuttlefish | Proposed |
| [limb-step](limb-step.md) | Limb cycling under a rigid carapace | Crabs, walking lobsters | Proposed |
| [pleopod-beat](pleopod-beat.md) | Metachronal swimmeret wave | Prawns, shrimp, krill | Proposed |

`Implemented` means the shader type exists in `src/components/Fish.jsx` and ships.
`Proposed` means the doc is a starting convention only — no runtime code exists yet,
and the first real asset should be expected to change it.

## When a new type doc is warranted

**Only when the animal needs a new shader `type` string.**

An eel is `caudal-wave` with `flexStart` near `0` — that is a tuning row in the
caudal doc, not a new document. A second jellyfish species is `bell-pulse` with
different constants. Without this rule the doc set grows a file per animal and the
shared content drifts apart.

If you are unsure: write the config you would need. If every key already exists on an
implemented type, you do not need a new type.

## Shared asset contract

Every procedural GLB, regardless of type:

- **Scale.** `1 WU = 25 cm`. Supply the real-world body dimension so `model.scale`
  can be derived rather than eyeballed.
- **Orientation.** `+Z` is swim-forward, `+Y` is up. For animals whose "forward" is a
  body axis rather than a head (a jellyfish bell, a drifting ray), the locomotor axis
  still points `+Z` — the renderer aims model-forward at the heading, so an asset
  built apex-up will swim sideways.
- **Transforms applied.** Scale `1`, rotation `0`, origin at world `0`. Multi-object
  assets must share one local frame or their deformations will shear apart.
- **Origin is the follow point.** It is what the camera frames and what the animal
  pivots around. Rig-free assets use `followAim: 'root'`.
- **No bones, no skinning, no animation clips.** The verifier rejects all three.
- **`COLOR_0` stays white.** It is material data. Motion masks go in `COLOR_1`
  (exposed by Three as `color_1`). A non-white `COLOR_0` will tint the animal.
- **Clean normals and predictable bounds.** Bounds-derived types read
  `geometry.boundingBox` directly; a stray vertex changes the whole deformation.

### Compute the animal's WU size before designing its motion

**Do this first, before the Blender contract, before the shader, before any felt
intention.** It is the cheapest kill-check available and the easiest one to skip.

`1 WU = 25 cm`. Currently shipping:

- Spotted Sardinella — `1.08` WU (27 cm), the smallest animal in the tank
- Mahi-mahi — `7.2` WU (1.8 m)
- Giant Sunfish — `13.2` WU (3.3 m)
- Shortfin Mako — `16` WU (4 m)

Take the species' real adult length, convert, and compare against that 1.08 WU
floor. If the animal lands far below it, say so and resolve it before designing
anything: pick a larger species in the same group, accept it as a near-camera-only
detail animal, or conclude it does not earn a tank slot.

The precedent is already in the code. `EncyclopediaPage.jsx:263` explains why the
in-scene diver was replaced with proportional bars: *"a 27cm fish next to a diver
reads as a sliver, which is the honest answer."* An animal an order of magnitude
below the sardinella is a sliver of a sliver, and no amount of shader work fixes it.

A motion design whose whole premise is a detail the viewer can never resolve is
wasted work, however good the rest of the reasoning is.

### A type doc is not a substitute for the species checklist

The type docs cover motion. They do not cover research, biological facts, tank role,
Atlas copy, or release evidence — [`../new-species-checklist.md`](../new-species-checklist.md)
owns all of that, and its §1 and §2 come *before* any motion work.

In particular: settle the canonical scientific-name slug and the real adult length
first. A plan for "a jellyfish" or "a comb jelly" has skipped the step that would
have surfaced the scale problem above.

One rule earns its own heading because it has already cost a re-export:

### Anything whose root must track a deforming surface has to ride the same deformation

A mesh animated as a separate rigid object cannot stay attached to a surface being
deformed on the GPU. Its root will detach and float.

The Shortfin Mako's pelvic fins shipped as independent objects, detached from the
body wave, and had to be re-exported welded into `shortfinmako003`. The rule
generalises: pectoral fins that only flutter can stay independent, because their
attachment point barely moves. Anything rooted in a part that flexes — tail fins,
jellyfish tentacles at the bell margin, a ray's trailing edge — must be joined into
the deforming mesh and carry the body's mask weight at the attachment ring.

Joined, not welded: the shader deforms by position and painted mask, not topology.
Vertices need not be merged. What matters is that root vertices are **coincident in
position** with the surface region they attach to and **carry that region's mask
value**.

## Runtime drivers

The simulation writes these every frame; every type reads from the same set:

- `speed01` — normalised speed against burst speed
- `accel01` — normalised signed acceleration
- `turn` — signed steering, damped per type by `response`
- `burst01` — burst envelope, decaying over the burst action's duration
- `speedEase01` — actual forward travel vs intended cruise rate
- `phase` — deterministic per-creature offset, so a school never syncs

Written at `src/components/Fish.jsx:3535`, consumed in the `useFrame` at
`src/components/Fish.jsx:2006`.

### The integrated clock rule

Each rig runs its own continuous wave clock, integrated per frame:

```js
proceduralWaveClockRef.current += rawDelta * waveSpeed * (1 + speed01 * boost + ...)
```

Never `elapsed * frequency`. Multiplying global elapsed time by a live frequency
re-projects the whole history onto the new rate, so every speed or burst change
snaps the pose. This is the single easiest way to break a procedural animal, and it
looks like a physics bug rather than a timebase bug.

Documented exception: `EncyclopediaPage.jsx:447` does use `elapsed * waveSpeed`. It
is safe there only because the Atlas pins `speed01` at a constant and never changes
frequency. Do not copy the pattern into the tank path.

## Shared motion primitives

Type docs reference these rather than restating them.

**Travelling wave along a normalised parameter.** Map each vertex to `t` in `0..1`
along the propagation axis, then `sin(phase - t * waveTravel)`. `waveTravel` is how
many radians of wave fit across the body — it controls how much of an S is visible
at once. Used by caudal-wave, disc-wave, pleopod-beat.

**Root-pivoted rotation from a painted attachment.** Rotate a vertex about a fixed
root point by an angle scaled by its painted weight, rather than translating it.
Translation makes an appendage shear and stretch; rotation gives a real tip arc.
Ease the weight with a zero-slope curve (quintic `w³(w(6w−15)+10)`) so the
attachment has no kink — never a hard dead-zone cutoff, which hinges visibly. Used
by mask-fin-row, and proposed for foil-flap and limb-step.

**Asymmetric drive envelope.** A fast power stroke over ~25–30% of the cycle, a slow
elastic recovery over the rest, each smoothstep-eased. Anything that pushes against
water is asymmetric in time; a symmetric sine reads mechanical. Proposed for
bell-pulse, limb-step, and tail-flip.

**Impulse-and-decay locomotion coupling.** For animals whose thrust is periodic
rather than continuous, the *speed* must pulse from the same phase as the *pose*.
A bell that contracts while the body translates at constant velocity reads wrong no
matter how good the deformation is. This is the one primitive that touches shared
movement code, so it is species-gated and frame-time measured wherever it is used.

## Where the code lives

All in `src/components/Fish.jsx` unless noted:

- `applyFishLightMask()` `:1167` — builds per-type uniforms and injects GLSL into a
  cloned `MeshStandardMaterial` via `onBeforeCompile`. Add new types here.
- `applyModelMaterialSettings()` `:1467` — clones and normalises materials. Currently
  forces `transparent = false`, `opacity = 1`, `depthWrite = true` on everything;
  a translucent type needs an opt-in here.
- `shouldProcedurallyDeformMesh()` `:1807` — decides which meshes get the GPU path.
  New types must be added to its type list.
- `collectProceduralFinMeshes()` `:1816` — finds independent meshes animated as whole
  objects on the CPU instead.
- `useFrame` `:2006` — integrates the wave clock and writes uniforms.
- `prepareProceduralVertexMaterials()` `:1506` / `updateProceduralVertexMaterials()`
  `:1523` — the Atlas reuses the identical path through these.
- `material.userData.proceduralFishUniforms` — where the live uniforms hang.
- `material.customProgramCacheKey` `:1461` — keyed by procedural type so programs are
  shared across individuals. Extend it with any new type or every fish compiles its
  own shader.

## The enforced half of the contract

`npm run verify:procedural-fish-assets` runs two scripts:

- `scripts/verify-procedural-docs.mjs` — **fails if any procedural type shipping in
  species data has no doc here.** Dependency-free and runs first, so a missing
  contract fails before anything loads a GLB. Each type doc declares which shader
  type it covers on its second line (``Shader type: `caudal-vertex` ``), and the
  check reads that — adding a doc is enough to satisfy it, there is no mapping table
  to keep in sync. It also warns when a type ships while its doc is still marked
  `Proposed`, which means the doc needs validating against the shipped asset and
  promoting.
- `scripts/inspect-procedural-targets.mjs` — the GLB contract below.

Prose goes stale silently; the verifier does not. **Every type doc's asset contract
must have a matching target entry in `inspect-procedural-targets.mjs`**, and anything
machine-checkable belongs there rather than only here.

A target entry supports:

- `path`, `name` — asset location and label
- `staticMesh: true` — rejects clips, bones, and skinning
- `bodyMeshNames` — meshes that must exist and take the GPU path
- `requiredFinMeshes` — independently animated meshes that must exist
- `forbiddenMeshNames` — meshes that must *not* exist (used to prove a weld happened)
- `requiredBodyAttributes` — e.g. `['color_1']` for painted masks
- `minVertices`, `minBodyLength`, `sourceAxis` — topology and bounds floors

It exits non-zero on any failure. Run it **before** writing runtime code: it catches
export mistakes at the cheapest possible moment.

## Adding a new species to an existing type

1. Inspect the GLB and add a verifier target entry. Run the verifier.
2. Add the `model.proceduralAnimation` block to `src/data/species.js`, starting from
   the nearest shipped species in that type's doc.
3. Tune against the type doc's felt-intention and "must not happen" list.
4. Add a tuning row to the type doc recording what you chose and why.
5. Work `docs/new-species-checklist.md` for everything else — research, behaviour,
   Atlas, responsive QA, release evidence.

## Adding a new type

1. Confirm it is genuinely new (see the criterion above). **Name the closest
   existing type and say in one line why it does not fit.** "It is a different
   animal" is not a reason — the split is by motion architecture, and two unrelated
   animals often share one. If the only difference is constants, it is a config.
2. **Confirm the approach with Jeremy before implementing.** A new motion
   architecture is a design decision, not a mechanical one.
3. Write the type doc first, from the template the existing docs share: which animals
   / felt intention and what must not happen / Blender contract / vertex-paint
   channels / material notes / config keys / verifier entry / review gates. Declare
   the shader type on its second line — ``Shader type: `your-type` · Status: …`` —
   or `verify-procedural-docs.mjs` will not see it.
4. **State plainly what produces thrust, and what is only decoration.** Somewhere in
   the doc — its own section or inside felt intention — name the layer that actually
   pushes the animal through water, and say which layers are silhouette or surface
   detail riding along. A doc that describes several moving parts without saying
   which one is the engine produces an animal that moves without swimming.
5. Add the uniform block and GLSL injection in `applyFishLightMask()`, the type
   string to `shouldProcedurallyDeformMesh()`, the clock integration in `useFrame`,
   and the cache-key entry.
6. Confirm the Atlas path renders it — it must use the same deformation as the tank.
7. Update this hub's type index and promote the doc's status to `Implemented`.

## Known couplings worth knowing about

- **Mola behaviour is hardcoded by species.** `isMolaCreature()` gates sun-bask,
  deep-exit recovery, and idle-drift roll in `Fish.jsx`. That is authored behaviour
  layered on top of `mask-fin-row`, not part of the type. A second animal using the
  same shader will not inherit it.
- **Bounds are computed per mesh.** Each deformed mesh reads its own
  `geometry.boundingBox`. Any type whose deformation must be continuous across two
  separate objects needs shared bounds first — see [bell-pulse](bell-pulse.md).
- **Tempo coherence.** `tempo: 'drift'` species cannot share a tank with `cruise` or
  `sprint` species; a dev-only guard warns at `src/utils/speciesLookup.js:52`.
