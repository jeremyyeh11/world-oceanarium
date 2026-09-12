# limb-step

Shader type: `limb-step-vertex` (proposed) · Status: **Proposed — not implemented**

Limb cycling under a rigid carapace. The body is a stable box; the legs do
everything. The only type here that contacts a surface.

Read [README.md](README.md) first for the rules shared by every type.

> Starting convention only. No runtime code exists. Expect the first asset to change
> it — this is the least certain doc in the set, for the reason below.

## Animals

Proposed: crabs, walking lobsters.

**Not this type:** prawns and shrimp, which swim on a pleopod wave — see
[pleopod-beat](pleopod-beat.md). A lobster's **escape tail-flip** is shared with that
type; see the tail-flip note below.

## The honest caveat

Every other type in this set deforms a body in open water, where being approximately
right is enough. A walking animal is judged against the floor. Feet that slide,
hover, or sink are immediately visible in a way that a slightly-wrong fin arc is not.

This is the type most likely to need something beyond pure GPU vertex deformation —
plausibly per-limb CPU transforms with a real foot-planting constraint, closer to the
existing independent-fin path than to the mask-vertex path. **Do not assume this ships
as a vertex shader.** Prototype the gait before committing to the architecture.

A cheaper escape route worth considering first: keep crabs in midwater or on a
substrate the camera never sees closely, and treat the legs as decorative motion
rather than locomotion. Whether that is acceptable is a design decision, not a
technical one.

## Felt intention

**Deliberate, sideways, armoured.** A crab's body glides level and steady while eight
legs cycle beneath it. The carapace is a stable platform — it does not bob with each
step. Sudden stops are total: a crab freezes completely, then resumes.

## What must not happen

- Feet sliding along the floor while the body translates. The defining failure.
- The carapace bobbing or rolling per step.
- All legs on one side moving in phase — real gaits alternate in a metachronal
  sequence.
- Legs interpenetrating the body or each other.
- Continuous motion. Crabs stop dead and hold; that stillness is characteristic.
- Chelae (claws) swinging passively like legs. They are carried, and they posture.

## Blender contract (proposed)

**Objects:** one mesh, whole animal, legs included — if the deformation stays on the
GPU. If per-limb CPU transforms win the prototype, legs become separate objects with
their pivots at the coxa, and this section is rewritten.

**Orientation:** `+Z` forward, `+Y` up, transforms applied, origin at world `0`.

Crabs walk sideways. Resist modelling them facing `+X`: `+Z` stays the direction of
travel, and the sideways-facing carapace is achieved by how the body sits on that
axis. Consistency with every other asset is worth more than anatomical tidiness.

Origin at the carapace centre, at **standing height** — the body's resting Y above
the floor is part of the asset contract, not something to discover at runtime.

**Topology:** joints need loops to bend — 3–4 loops per joint minimum. Carapace needs
none.

**Poly budget:** 2000–4000 vertices, most of it in the legs.

## Vertex paint channels (proposed)

| Channel | Means |
| --- | --- |
| R | Limb index / phase offset — a distinct flat value per leg, giving the gait sequence |
| G | Position along the limb, `0` at coxa → `1` at dactyl (foot) |
| B | Limb role — `0` walking leg, `~0.5` chela, `1` abdomen/tail |
| A | Side, or unused |

R as a flat per-limb constant is what makes the metachronal gait possible in a single
shader: each leg reads its own phase slot from paint.

## How the deformation should work

- Each limb swings about its coxa, phase-offset by R, using the asymmetric drive
  envelope: a fast swing (foot off ground) and a slow stance (foot planted, body
  passing over it).
- Stance-phase feet must translate **backward in body space at exactly the body's
  forward speed** — that is what makes them appear planted. This is the hard part and
  the reason the architecture is uncertain: it requires the shader to know the body's
  speed in world units per second, which is available as a driver, but the mapping
  from that to a per-limb offset depends on stride length.
- Gait frequency scales with speed, and stride length should scale too, or the animal
  moonwalks at the extremes.
- At zero speed the cycle stops entirely. No idle sway.
- Chelae get a separate slow posture drift, unconnected to the gait.

## Tail-flip

Lobsters escape by flexing the abdomen — a single violent impulse, not a cycle.
Shared with [pleopod-beat](pleopod-beat.md). It is a behaviour layer triggered by
threat, applying the impulse-and-decay primitive to an abdominal flex, and it should
be authored once and referenced by both types rather than implemented twice.

## Config keys (proposed)

`type`, `bodyMeshNames`, `strideRadians`, `strideLength`, `stancePhase`,
`gaitFrequency`, `speedStrideGain`, `chelaDriftAmplitude`, `standingHeight`,
`turnStrength`, `response`, plus `tailFlip` (`impulse`, `decay`) for lobsters.

## Verifier entry (proposed)

```js
{
  name: '<Species> limb-step static',
  path: 'public/models/fish/<slug>/<slug>.glb',
  staticMesh: true,
  bodyMeshNames: ['<body>'],
  requiredBodyAttributes: ['color_1'],
  minVertices: 2000,
}
```

## Review gates

- Feet do not slide. Verify at several speeds, including very slow.
- The carapace stays level; it does not bob per step.
- The gait is metachronal, not synchronised.
- Stopping is total and immediate; the animal holds still convincingly.
- Stride length scales with speed — no moonwalking at either extreme.
- Legs do not interpenetrate the body or each other through the cycle.
- Atlas specimen moves through the same path as the tank.
- No runtime or WebGL errors.
