# foil-flap

Shader type: `foil-flap-vertex` (proposed) · Status: **Proposed — not implemented**

Paired appendages beating as hydrofoils on a rigid body. Thrust comes from the
downstroke of a stiff, twisting blade — flight underwater, not rowing.

Read [README.md](README.md) first for the rules shared by every type.

> Starting convention only. No runtime code exists. Expect the first asset to change
> it.

## Animals

Proposed: sea turtles, penguins, sea lions.

**Not this type:** a Mola, whose dorsal and anal fins scull as flexible sheets rather
than beating as rigid foils — see [mask-fin-row](mask-fin-row.md). A ray, whose thrust
is a wave through a continuous disc margin — see [disc-wave](disc-wave.md).

Worth flagging early: this type and `mask-fin-row` are both root-pivoted rotation
driven by a painted weight. If the first turtle implementation ends up as
`mask-fin-row` with different constants, **merge them** rather than keeping two
near-identical shaders. The criterion is whether the foil needs a genuine twist
(pitch about its own span axis), which `mask-fin-row` has no concept of.

## Felt intention

**Powerful, unhurried flight.** A turtle's body is a stable platform; the flippers
sweep through a long arc and the animal surges forward on each downstroke, then
glides. The body should barely move — all the motion is in the appendages.

Glide phases matter as much as strokes. A turtle that flaps continuously reads
anxious.

## What must not happen

- A flipper that translates instead of rotating — that shears and stretches the blade.
- A flat paddle with no twist. The pitch change across the stroke is what makes it
  read as a foil rather than an oar.
- Symmetric up and down strokes. The power stroke is the downstroke.
- The body pitching or rolling in sympathy with every beat.
- Continuous flapping with no glide.
- Left and right beating in perfect lockstep through a turn — asymmetry is how it
  steers.

## Blender contract (proposed)

**Objects:** one body mesh containing the shell/torso and both fore-flippers, with
hind flippers either included or as separate low-motion objects.

Fore-flippers must be part of the deforming mesh: their roots sit in the shoulder,
which barely moves, so they *could* be independent objects — but the twist needs
per-vertex control along the blade, which whole-object rotation cannot give. Paint
them instead.

**Orientation:** `+Z` forward, `+Y` up, transforms applied, origin at world `0`.

**Topology:** lengthwise loops along each flipper span — the blade bends and twists
along its length, so it needs at least 6–8 spanwise divisions. Chordwise can stay
coarse. The body needs no density at all.

**Poly budget:** body dominated by silhouette needs, not motion. Flippers ~200–400
vertices each.

## Vertex paint channels (proposed)

| Channel | Means |
| --- | --- |
| R | Fore-flipper stroke weight, `0` at shoulder → `1` at tip |
| G | Twist weight along the blade — usually similar to R but can lead it |
| B | Hind-flipper / rudder weight |
| A | Side sign, or unused — side may be cheaper from raw X |

## How the deformation should work

- Stroke: root-pivoted rotation about the shoulder in the vertical plane, using the
  asymmetric drive envelope from [README.md](README.md) so the downstroke is fast and
  the recovery slow.
- Twist: rotation about the flipper's own span axis, phase-**led** slightly ahead of
  the stroke. This lead is the whole trick — a foil pitches into the stroke before it
  sweeps. Without it you have an oar.
- Turn: bias stroke amplitude between sides by `turn`, and add a hind-flipper rudder
  offset.
- Glide: a `dutyCycle` well below 1, with the animal holding an extended pose between
  stroke groups. Consider strokes in bursts of 2–3 with a glide between, rather than
  a continuous cycle.

## Locomotion coupling

Like [bell-pulse](bell-pulse.md), thrust here is periodic, so speed should pulse with
the stroke. Less critical than for a jellyfish — a turtle's glide is long and its
speed variation modest — but a constant-velocity turtle with flapping flippers will
read as a toy. Reuse the impulse-and-decay primitive.

## Config keys (proposed)

`type`, `bodyMeshNames`, `strokeRootYZ` (or per-side roots), `strokeRadians`,
`twistRadians`, `twistLead`, `dutyCycle`, `strokeGroupCount`, `glideFraction`,
`rudderAmplitude`, `turnStrength`, `burstAmplitude`, `response`, `waveSpeed`,
`speedFrequencyBoost`, `burstFrequencyBoost`.

## Verifier entry (proposed)

```js
{
  name: '<Species> foil-flap static',
  path: 'public/models/fish/<slug>/<slug>.glb',
  staticMesh: true,
  bodyMeshNames: ['<body>'],
  requiredBodyAttributes: ['color_1'],
  minVertices: 2000,
}
```

## Review gates

- The animal surges on the downstroke and glides between stroke groups.
- Flipper blades twist through the stroke; they never read as flat oars.
- The body stays a stable platform.
- Turns are driven by asymmetric stroke amplitude, not by rotating in place.
- No shear or stretch at the shoulder attachment.
- Atlas specimen moves through the same path as the tank.
- No runtime or WebGL errors.
