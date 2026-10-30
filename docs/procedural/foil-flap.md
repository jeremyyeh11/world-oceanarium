# foil-flap

Shader type: `foil-flap-vertex` (proposed) · Status: **Proposed — not implemented; contract awaiting Jeremy's approval**

Paired appendages beating as hydrofoils on a rigid body. Thrust comes from the
downstroke of a stiff, twisting blade — flight underwater, not rowing.

Read [README.md](README.md) first for the rules shared by every type.

> No runtime code exists. This contract was firmed up for the first asset, the East
> Pacific green turtle (`chelonia-mydas`, prepared hidden in `v0.50.0-dev_1`; see
> [species-preparation.md](../species-preparation.md)). Nothing below is built until Jeremy
> confirms the approach (AGENTS.md: stop and ask before a new motion architecture).

## Animals

First asset: East Pacific green turtle, adults 65–90 cm straight shell length in the
reserve (2.6–3.6 WU), well above the 1.08 WU floor. Later candidates: other sea turtles,
penguins, sea lions (a sea lion's fore-flippers are the same problem).

**Not this type:** a Mola, whose dorsal and anal fins scull as flexible sheets rather
than beating as rigid foils — see [mask-fin-row](mask-fin-row.md). A ray, whose thrust
is a wave through a continuous disc margin — see [disc-wave](disc-wave.md).

## Why not an existing type

Two types come close. Neither covers it with config alone.

**[mask-fin-row](mask-fin-row.md), the closest.** Both are a rigid body whose painted
appendages rotate about fixed roots with quintic-eased weights. That is where the
likeness ends:

- *Stroke plane.* Its rotating fins (dorsal, anal) swing in the raw Y/Z plane about a
  lateral axis: a fin on the body's midline. A turtle's fore-flippers are a mirrored pair
  that swing up and down about a roughly fore–aft axis through each shoulder. The type's
  only paired channel, grey pectorals, is a small mirrored *offset*, not a rotation.
- *Twist.* A foil pitches about its own span axis, leading the stroke. mask-fin-row has
  no concept of rotating a blade about its own length.
- *Timing.* mask-fin-row runs a continuous sine. A turtle strokes in bursts with an
  asymmetric beat and glides with its flippers held swept back. Neither the envelope nor
  the glide hold exists there.
- *Locomotion.* A turtle's speed should surge on each downstroke (README,
  impulse-and-decay). mask-fin-row moves the body at constant speed.

Fitting all four into mask-fin-row would mean a new paired rotation about a new axis, a
new twist rotation, a new clock and a new movement coupling: an architecture behind a
flag, not a variant. The balistiform variant shows the line: three keys, same engine,
same channels. Here the engine moves from the midline fins to a paired flipper.

**[disc-wave](disc-wave.md) (mobuliform).** The devil ray's wings also beat together
with a fast downstroke, but a wing is continuous with the disc: no shoulder to pivot on,
and the tip lag is a phase delay along a bending sheet. A turtle flipper is a stiff blade
on a joint. disc-wave's displacement would bend the flipper like rubber and leave the
shoulder unhinged.

**Recommendation: a new type, `foil-flap-vertex`, reusing shared helpers.** The quintic
weight easing, the `forwardAxis`/`upAxis` remap and root-pivot rotation come from
mask-fin-row; the asymmetric envelope from disc-wave. This answers the ROADMAP question
(does foil-flap merge into mask-fin-row?) with no: the turtle needs a genuine twist, the
merge criterion this doc set itself.

## What produces thrust

- **Engine: the fore-flippers' downstroke.** Both flippers sweep down and back together,
  leading edge pitched down, and the turtle surges forward. The upstroke recovers with
  the blade feathered and adds little.
- **Steering and trim: the hind flippers.** They trail as rudders and elevators, angled
  into turns. They do not paddle while the turtle cruises.
- **Decoration: none moves on its own.** Shell, head and neck stay rigid in the first
  pass. A slight head bob or the slow four-limb paddle turtles use when manoeuvring at
  low speed are later ideas, not part of this contract.

## Felt intention

**Powerful, unhurried flight.** The shell is a stable platform; the fore-flippers sweep
through a long arc, the animal surges on each downstroke, then glides. All the motion is
in the flippers.

Glides matter as much as strokes. A turtle that flaps continuously reads anxious.

## What must not happen

- A flipper that translates instead of rotating: that shears and stretches the blade.
- A flat paddle with no twist. The pitch change across the stroke is what makes it
  read as a foil rather than an oar.
- Symmetric up and down strokes. The power stroke is the downstroke.
- The shell pitching or rolling in sympathy with every beat.
- Continuous flapping with no glide.
- Left and right beating in perfect lockstep through a turn: asymmetry is how it steers.
- Hind flippers paddling at cruise, reading as a swimming dog.
- A turtle that speeds along at constant velocity while its flippers beat.

## Blender contract (proposed)

**Objects.** One body mesh in the export: shell (carapace and plastron), head and neck,
and all four flippers joined. Fore-flipper roots sit in the shoulder, which barely moves,
so the flippers *could* be independent objects; but the twist needs per-vertex control
along the blade, which whole-object rotation cannot give. Join them and let the paint
separate them. In the `.blend` Jeremy may keep the flippers as separate objects named
`flipper.fore.l`, `flipper.fore.r`, `flipper.hind.l`, `flipper.hind.r`: the intake script
joins and paints them (below).

**Orientation.** Nose at `-Z`, `+Y` up (the renderer turns local `-Z` to the heading),
transforms applied. Origin at world `0`, at the centre of the shell (the follow point).

**Scale.** `1` raw unit = `1` m, at a known straight shell length (front to back edge of
the shell along the midline, not over the curve). Note the shell length with the export:
the species' world scale is derived from it, as the Atlas `maxLengthLabel` "Shell length"
says.

**Rest pose.** Fore-flippers held out level and slightly swept back, as at the top of a
glide; hind flippers trailing beside the tail. The glide pose is computed from this one.

**Topology.** Fore-flippers 8–10 spanwise loops from shoulder to tip and 3–4 chordwise
divisions, so the blade both bends and twists without faceting badly (faceting itself is
the art style). A dense ring at the shoulder, where rotation starts. Hind flippers 4–5
spanwise loops. The shell needs no density at all.

**Poly budget.** About 3000–6000 vertices in all; each fore-flipper about 300–500.

**Normals.** Outward. Recalculate Outside before export; past exports have come in
inside out.

## Vertex paint channels (proposed)

Painted into `COLOR_1`, exposed as `color_1`. `COLOR_0` stays white.

| Channel | Means | Ramp |
| --- | --- | --- |
| R | Fore-flipper stroke weight | `0` in the shoulder ring → `1` at the tip |
| G | Fore-flipper twist weight | `0` at the shoulder → `1` at the tip; may rise faster than R so the outer blade carries most of the twist |
| B | Hind-flipper rudder weight | `0` at the hip → `1` at the tip |
| A | Unused | Side comes from the sign of raw X |

Black (all three `0`) is rigid: shell, head and neck.

**Computed, not hand-painted.** As with the devil ray, the masks are pure geometry: a
proposed `scripts/paint-foil-flap-masks.py` (headless Blender, modelled on
`paint-disc-wave-masks.py`) joins the four flipper objects to the body, paints R and G as
ramps along each fore-flipper's span from its shoulder, B along each hind flipper, writes
white `COLOR_0`, measures the shoulder and hip roots and the span axes, and prints them as
config. Blender's vertex paint cannot paint one channel alone, so hand painting would need
packing anyway.

## How the deformation should work

Per vertex, side `s = sign(x)`, in the rest frame:

1. **Twist** about the fore-flipper's own span axis (root → tip at rest, mirrored by side)
   by `twistRadians · twistDrive(phase + twistLead) · ease(G)`. The lead is the whole trick:
   the blade pitches into the stroke before it sweeps. Without it you have an oar.
2. **Stroke** about an axis through the shoulder root, roughly fore–aft and tilted by
   `strokeAxisSweep` so the tip moves down *and back*, by
   `s · strokeRadians · envelope(phase) · ease(R) · (1 + s · turn · turnStrength)`.
   Rotation, not translation, so the tip traces an arc and the shoulder never stretches.
3. **Sweep** (optional) about the vertical through the root by
   `sweepRadians · sin(phase + sweepLead) · ease(R)`, which opens the tip's path into the
   figure-eight a flying flipper traces.
4. **Hind rudder** about the hip by `turn · rudderRadians · ease(B)` (yaw) plus a small
   trailing trim that follows the stroke with a lag, never driving.
5. **Glide** blends 1–3 toward a held pose (`glidePose`: flippers swept back along the
   shell, slightly down) by `glideBlend`.

`envelope` is the README's asymmetric drive envelope: the downstroke over
`downstrokeFraction` of the beat (about 0.35–0.4), the recovery over the rest, each
smoothstep-eased. `ease` is the shared zero-slope quintic.

## Clock, glides and locomotion coupling

The beat clock follows the integrated clock rule (README). On top of it a small CPU state
machine, per creature, from its own seeded stream:

- **Stroke group:** `strokesPerGroup` beats (2–3 at cruise), then a **glide** of
  `glideSeconds` with `glideBlend` easing to 1 and back over about half a beat. The clock
  holds still during the glide, so the next group starts from the top of a stroke.
- **Speed:** faster swimming shortens glides and adds strokes; a burst strokes
  continuously at `burstAmplitude` with no glide. Idle drift is mostly glide.
- **Turns:** amplitude biased between sides by `turn`, and the hind rudders angle; the
  shell banks only through the existing integrator.
- **Impulse-and-decay:** each downstroke adds a forward impulse, decaying through the
  recovery and the glide, so speed surges with the pose. This is the one shared-movement
  touch, gated to this type and frame-time measured, as the README requires. Uniforms
  carry `strokePhase` and `glideBlend` only; no per-frame allocation.

## Config keys (proposed)

| Key | Proposed start | Meaning |
| --- | --- | --- |
| `type` | — | `'foil-flap-vertex'` |
| `bodyMeshNames` | — | The single body mesh |
| `forwardAxis`, `upAxis` | `'-z'`, `'y'` | Shared axis remap (as mask-fin-row's balistiform variant) |
| `foreRoot`, `hindRoot` | from the paint script | Right-side shoulder and hip pivots `[x, y, z]`; left mirrored |
| `foreSpanAxis` | from the paint script | Right fore-flipper span direction at rest |
| `waveSpeed` | `0.6` | Base beats per second |
| `strokeRadians` | `0.7` | Peak stroke rotation (about ±40°) |
| `strokeAxisSweep` | `0.35` | Tilt of the stroke axis so the tip moves down and back |
| `downstrokeFraction` | `0.38` | Share of the beat spent on the power stroke |
| `twistRadians` | `0.5` | Peak blade pitch |
| `twistLead` | `0.6` | Phase lead of twist over stroke (radians) |
| `sweepRadians`, `sweepLead` | `0.15`, `1.2` | Fore–aft tip sweep for the figure-eight |
| `strokesPerGroup` | `[2, 3]` | Beats per stroke group at cruise |
| `glideSeconds` | `[1.5, 4]` | Glide length at cruise; longer at idle, none in a burst |
| `glidePose` | `0.8` | How far the glide pose sweeps the flippers back (0 rest, 1 flat along the shell) |
| `rudderRadians` | `0.35` | Hind-flipper yaw at full turn |
| `turnStrength` | `0.3` | Stroke amplitude bias between sides per unit `turn` |
| `burstAmplitude` | `0.3` | Extra stroke under burst |
| `response` | `2.5` | Turn damping |
| `speedFrequencyBoost`, `burstFrequencyBoost` | `0.3`, `0.4` | Cadence gain |
| `strokeImpulse` | `0.35` | Forward impulse per downstroke, in body lengths per second |

Every value is a starting point for the first tuning pass, not a measurement. Tuning goes
in a tuning row here once the turtle ships.

## Verifier entry (proposed)

```js
{
  name: 'East Pacific Green Turtle foil-flap static',
  path: 'public/models/fish/chelonia-mydas/chelonia-mydas.glb',
  staticMesh: true,
  bodyMeshNames: ['<body>'],
  forbiddenMeshNames: ['flipper.fore.l', 'flipper.fore.r'], // joined by the paint script
  requiredBodyAttributes: ['color_1'],
  minVertices: 2000,
}
```

## Review gates

- The turtle surges on the downstroke and glides between stroke groups; at cruise it
  glides for a good share of the time (aim for at least a third, measured).
- The downstroke takes about 35–40% of the beat (measured in the Atlas, as the devil ray's
  43% was).
- Flipper blades visibly change pitch through the stroke; they never read as flat oars.
- The shell stays a stable platform: no pitch or roll with the beat.
- Turns come from asymmetric stroke amplitude and the hind rudders, not from rotating in
  place.
- No shear or stretch at the shoulder: edge lengths in the shoulder ring stay within a few
  percent through the stroke.
- Hind flippers never paddle at cruise.
- Reads as a turtle at 375 px portrait from the resting camera.
- Atlas specimen moves through the same path as the tank.
- No runtime or WebGL errors; phone frame time measured with the turtles in The Shallows.

## Open questions for Jeremy

1. Approve a separate `foil-flap-vertex` type (recommended), or fold it into
   `mask-fin-row` as a variant despite the four mechanisms above?
2. Flippers kept as separate objects in the `.blend` for the paint script to join (as
   proposed), or joined and painted by hand?
3. First pass with glides and the speed surge, or the beat alone first and the surge as a
   second build?
