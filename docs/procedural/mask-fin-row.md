# mask-fin-row

Shader type: `mola-mask-vertex` · Status: **Implemented** (clean `v0.15.3`)

Rigid body, painted vertex mask, fins rotating about their own attachment roots.
For animals whose thrust comes from fins rather than from flexing the body.

Read [README.md](README.md) first for the rules shared by every type.

## Animals

Shipping: Giant Sunfish (`mola-alexandrini`).

**Not this type:** anything that flexes its body to swim — see
[caudal-wave](caudal-wave.md). Paired flippers on a rigid body that beat as foils
rather than rowing as sheets are closer to [foil-flap](foil-flap.md), though the two
may end up merging once a turtle asset exists; both are root-pivoted rotation driven
by a painted weight.

## Felt intention

**A heavy disc carries the intention; the fins do the work.** Tall dorsal and anal
fins row it forward, pectorals assist turns, and the clavus barely trims the rear.

The animal should read as massive and calm — deliberate sculling with the body
settling between strokes, never a fish being pushed along by a tail.

## What must not happen

- Reading as tail-propelled. The clavus is a rudder, not a caudal fin.
- The disc hovering like a balloon, weightless.
- A rigid hinge at a fin base. The mask ramp is continuous and the easing is
  zero-slope at the root precisely so there is no visible kink.
- Fins detaching, flickering, or tinting the material.
- Dorsal and anal locked in permanent opposition — they de-sync by design.

## Blender contract

**Objects.** One body mesh containing everything, fins included. All propulsion
surfaces are part of the single deforming mesh and separated by paint, not by object
split. The Mola ships as `10001003`.

**Orientation.** `+Z` swim-forward, `+Y` up, transforms applied, origin at world `0`.

Note the axis subtlety: the shader rotates dorsal and anal fins in raw **Y/Z** about
roots expressed as `[y, z]` pairs, treating raw **X** as the lateral axis for
pectoral and clavus offsets. This differs from `caudal-wave`'s convention. Match the
shipped Mola's orientation exactly when authoring a new asset for this type.

**Topology.** Enough density through the fin blades to show the arc — the fin bends
along its length, so it needs lengthwise loops, not just a flat blade. The Mola body
carries 8000+ vertices and the verifier enforces that floor. The rigid disc itself
does not need density; the fins do.

**Vertex painting.** Required. This type is entirely mask-driven.

## Vertex paint channels

Painted into `COLOR_1`, exposed by Three as `color_1`. `COLOR_0` stays white material
data and must not tint the animal.

The scheme is **exclusive channels with grey reserved**:

| Painted colour | Means | Motion |
| --- | --- | --- |
| Pure red gradient | Dorsal fin | Root-pivoted rotation in Y/Z about `dorsalRootYZ` |
| Pure green gradient | Anal fin | Root-pivoted rotation in Y/Z about `analRootYZ`, de-synced |
| Pure blue gradient | Clavus | Restrained rear rudder trim |
| RGB grey | Pectorals | Small sculling offset, assists turns |
| Black | Rigid body | No motion |

The shader recovers the channels by taking `pectoral = min(r, min(g, b))` — the
shared grey component — then subtracting it from each channel so red, green and blue
carry only their exclusive weight. This is why grey means pectoral and why a
half-red-half-grey blend will misbehave: keep the fin gradients pure.

**Gradient shape matters.** Paint a continuous ramp from `0` at the rigid attachment
to `1` at the fin tip, following the blade. The shader applies zero-slope quintic
easing (`w³(w(6w−15)+10)`) on top, which holds the first few loops near the root
gentler still. Do not paint a hard step at the base to "protect" the body — the
easing already does that, and a step produces the hinge it was meant to prevent.

## How the deformation works

Dorsal and anal each rotate about their own painted root in the raw Y/Z plane:

```
angle = quintic(weight) * sin(phase * rate + offset) * finRotationRadians
        * mix(0.42, 1.0, speed01) * (1 + burst01 * burstAmplitude)
```

Rotation, not translation — the tip traces a real arc instead of shearing sideways.
Pectorals and clavus are cheaper: small direct offsets scaled by their weight, with
the pectoral's stroke mirrored by sign of raw X so the two sides oppose.

## Config keys

| Key | Default | Meaning |
| --- | --- | --- |
| `type` | — | `'mola-mask-vertex'` |
| `bodyMeshNames` | — | The single body mesh |
| `maskAttribute` | `'color_1'` | Documentation only; the shader reads `color_1` |
| `waveSpeed` | `0.92` | Base stroke frequency |
| `finRotationRadians` | `0.46` | Peak fin rotation |
| `dorsalRootYZ` | `[0, -0.08716]` | Dorsal pivot in raw Y/Z |
| `analRootYZ` | `[0, 0.14121]` | Anal pivot in raw Y/Z |
| `dorsalPhaseOffset` | `0` | Dorsal phase |
| `analPhaseOffset` | `1.08` | Anal phase — offsets it from dorsal |
| `analPhaseRate` | `0.91` | Anal frequency ratio, so the pair drifts in and out |
| `pectoralAmplitude` | `0.014` | Pectoral sculling offset |
| `clavusAmplitude` | `0.016` | Clavus trim offset |
| `turnStrength` | `0.012` | Steering contribution from pectorals and clavus |
| `burstAmplitude` | `0.38` | Extra stroke under burst |
| `response` | `3.2` | Turn damping — low, this animal is heavy |
| `speedFrequencyBoost` | `0.10` | Cadence gain from speed |
| `burstFrequencyBoost` | `0.08` | Cadence gain from burst |
| `idleDriftRollRadians` | `0.035` | Passive-drift settling roll (see below) |
| `idleDriftRollFrequency` | `0.18` | Roll rate |

## Shipped tuning

**Giant Sunfish.** `waveSpeed: 0.46` — half the default, deliberately slow so the
disc settles between strokes. `finRotationRadians: 0.30`, intentionally restrained.
`analPhaseOffset: 1.08` with `analPhaseRate: 0.91` so dorsal and anal de-sync over
time rather than sitting in permanent opposition. Speed and burst boosts are low
(`0.10`/`0.08`): this animal does not visibly change gear.

The lesson generalises: for this type, restraint reads as mass. The first instinct is
always to increase `finRotationRadians`, and it is almost always wrong.

## Balistiform variant (proposed)

Status: **Proposed — waiting on Jeremy's go-ahead and the Clown Triggerfish
(`balistoides-conspicillum`) model.** Nothing below runs yet.

### Why this type, and what it lacks

Triggerfish swim like the Mola in the way that matters: a rigid body pushed by its
dorsal and anal fins, steered by its pectorals. Same engine, same painted channels, so
it stays `mola-mask-vertex` rather than a new type. Three things differ, each one new
config key rather than a new architecture:

1. **The fins ripple; they do not flap.** The Mola swings each fin as one blade, every
   point in phase. A triggerfish's soft dorsal and anal fins carry a wave that travels
   from the front of the fin to the back, all rays at the same frequency (George &
   Westneat, gilded triggerfish). Proposed key `finWaveTravel`: radians of phase lag
   from the fin's leading edge to its trailing edge. `0` is the Mola. Start near one
   wavelength (about `6`) and tune by eye. The phase position comes from the vertex's
   forward coordinate across the fin's own span (`dorsalSpan` / `analSpan`, measured
   off the mesh), the same travelling-wave primitive the README describes.
2. **The tail is an engine in bursts, not a rudder.** The Mola's blue channel (clavus) is
   a restrained trim. On a triggerfish the blue channel is the caudal fin: still near
   idle while cruising, beating under `burst01`. Proposed key `caudalBurstAmplitude`.
3. **Axes.** The shader is written in the Mola's raw frame. Proposed keys `forwardAxis`
   / `lateralAxis` so the triggerfish exports in the caudal convention every other fish
   uses (nose at `-Z`, `+Y` up).

Plus `analAmplitudeScale` (below `1`): the dorsal does more of the work than the anal.

### What produces thrust

- **Cruise (up to ~1.5 BL/s):** dorsal and anal fins only. The body does not bend and the
  tail does not beat. The leading rays carry the largest amplitude: they produce close
  to half the thrust.
- **Burst:** the tail beats, and the fins keep rippling alongside it (Korsmeyer et al.
  2002: Picasso triggerfish, tail beats intermittent above ~1.5 BL/s and continuous above
  ~3.5).
- **Decoration and steering:** pectorals scull and bias turns.

### Felt intention

**An armoured box that glides on ripples, then snaps.** Unhurried, precise, able to stop
and turn nearly in place; the surprise is the sudden tail-driven dart.

### What must not happen

- Cruising on its tail. If the tail beats at cruise speed, it reads as a reef fish
  like the angelfish, which is the wrong animal.
- A wave running back to front, or dorsal and anal locked in the same phase at cruise.
- The body bending. The scaled skin is rigid; only the fins and, in bursts, the tail move.
- The first dorsal spine (the trigger) moving. It lies folded in its groove.

### Blender contract (Clown Triggerfish)

- **One mesh, everything joined**, fins included, named `balistoides_conspicillum`.
  Separate pectoral objects are fine too (`pectoral.l` / `pectoral.r`) if painting them
  grey is awkward.
- **Orientation:** nose at `-Z`, `+Y` up, transforms applied. Origin mid-length on the
  body axis.
- **True scale:** 50 cm nose to tail tip (0.5 Blender units), as the angelfish was.
- **Fin topology:** the soft dorsal and anal fins need loops in both directions: at least
  12–16 divisions along the fin base (front to back) so the wave does not step, and 4–6
  from base to edge so the arc bends. The caudal fin needs a few loops from the
  peduncle out.
- **`COLOR_1` paint**, each a continuous `0 → 1` ramp from the attachment to the edge,
  no hard step at the base:
  - pure red: soft (second) dorsal fin
  - pure green: anal fin
  - pure blue: caudal fin, `0` at the narrowest point of the tail stalk
  - grey: pectorals
  - black: body, the first dorsal spine, and the pelvic spine
- **`COLOR_0` stays white.** Keep textures small and note their source and licence.

## Material notes

Standard opaque path. `applyModelMaterialSettings()` forces
`transparent = false, opacity = 1, depthWrite = true`, which is correct here.

One interaction to know about: the Mola's deep-exit recovery fades the animal out and
back in by writing `material.transparent` and `material.opacity` per frame
(`Fish.jsx:3031`). Any future type needing a non-opaque base will have to make that
path multiply a configured base opacity rather than reset it to `1`.

## Authored behaviour is not part of this type

Sun-basking, deep-exit fade recovery, and the idle-drift settling roll are gated by
`isMolaCreature()` in `Fish.jsx` — hardcoded by species, layered on top of the
shader. A second animal using `mask-fin-row` inherits none of it.

Worth noting how the layering works, because it is the pattern to copy: the behaviour
owns the live fish transform (approach, hold, exit, root roll), while the shader owns
only the fin motion. They must not fight — the runtime root roll owns the whole-animal
bask pose, and the idle-drift roll is suppressed during a bask.

## Verifier entry

```js
{
  name: 'Giant Sunfish static motion mask',
  path: 'public/models/fish/mola-alexandrini/mola-alexandrini.glb',
  staticMesh: true,
  bodyMeshNames: ['10001003'],
  requiredBodyAttributes: ['color_1'],
  minBodyLength: 0.5,
  minVertices: 8000,
}
```

`requiredBodyAttributes: ['color_1']` is the important line — it is what makes a
mask-less export fail loudly instead of rendering a rigid animal.

## Review gates

- The body stays a heavy, calm disc while dorsal and anal fins visibly row.
- Dorsal and anal do not sit in fixed opposition.
- No kink, hinge, or dead zone at any fin attachment.
- Pectorals and clavus do not detach, flicker, or tint the material.
- The animal never reads as tail-propelled.
- Burst increases stroke force and cadence without a pose cut.
- Passive drift shows a subtle settling roll; it does not fight authored behaviour.
- Atlas specimen moves through the same path as the tank.
- No runtime or WebGL errors.
