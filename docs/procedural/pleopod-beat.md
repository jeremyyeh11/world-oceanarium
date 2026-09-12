# pleopod-beat

Shader type: `pleopod-beat-vertex` (proposed) · Status: **Proposed — not implemented**

A metachronal wave through many small swimmerets, plus an escape tail-flip. Fine,
rapid, insect-like motion under a mostly rigid body.

Read [README.md](README.md) first for the rules shared by every type.

> Starting convention only. No runtime code exists. Expect the first asset to change
> it.

## Animals

Proposed: prawns, shrimp, krill.

**Not this type:** lobsters walking on the bottom — see [limb-step](limb-step.md),
which shares this type's tail-flip. Mysids and amphipods are close enough to be
config variants, not new types.

## Felt intention

**Busy, weightless, twitchy.** A prawn hangs in the water column, swimmerets blurring
beneath it, making small constant adjustments. It is never quite still and never
travels far in a straight line.

Then, on threat: a single explosive backward tail-flip that covers many body lengths
in an instant, followed by stillness. The contrast between the two is the animal.

## What must not happen

- Swimmerets beating in unison. The metachronal wave — each appendage slightly behind
  the one ahead of it — is the entire visual signature.
- The wave running the wrong way. It travels **back to front** along the abdomen.
- A tail-flip that moves the animal forward. It goes **backward**, fast.
- A tail-flip that is a smooth animation. It is an impulse: near-instant flex, long
  coast, slow recovery.
- Antennae rigid. They are long, passive, and trail — the cheapest possible detail
  win on this animal.
- Continuous forward cruising. Prawns hover and dart.

## Blender contract (proposed)

**Objects:** one mesh for body, abdomen and swimmerets. Antennae may be separate card
objects if they are texture cards — but if their roots sit on the head, which barely
deforms, independent objects are safe here (unlike jellyfish tentacles).

**Orientation:** `+Z` forward, `+Y` up, transforms applied, origin at world `0`.

**Topology:** the abdomen must flex for the tail-flip, so it needs 8–12 loops along
its length. Swimmerets are tiny and numerous — they need 3–4 loops each, and they are
where the vertex budget goes. Carapace needs none.

At typical viewing distance individual swimmerets are a few pixels. Do not model them
at full fidelity; consider a small number of merged paddle groups reading as many.

**Poly budget:** 1500–3000 vertices. This is a small animal likely to appear in
numbers — if it becomes a schooling species, it belongs on the instanced path
alongside the sardines (`SardineInstancedLayer.jsx`), which changes the contract
substantially.

## Vertex paint channels (proposed)

| Channel | Means |
| --- | --- |
| R | Swimmeret phase slot — flat per appendage pair, ascending front to back |
| G | Position along appendage, `0` at root → `1` at tip |
| B | Abdominal flex weight for the tail-flip, `0` at carapace → `1` at telson |
| A | Antenna trail weight, if antennae are in the body mesh |

## How the deformation should work

- Swimmerets: root-pivoted rotation, phase offset by R so the wave travels back to
  front. High frequency, small amplitude. The asymmetric drive envelope applies — the
  power stroke is fast.
- Abdomen: normally near-rigid, with a slight arch. `B` drives the flex.
- Tail-flip: triggered by behaviour, not by the cycle. A single impulse through `B`
  with a hard onset and a long decay, coupled to a large backward velocity impulse via
  the impulse-and-decay primitive. Swimmerets should stop during the flip and resume
  after.
- Antennae: pure passive trail, lagging the body's heading, driven by `A` and the
  animal's own turn rate rather than by the swimmeret clock.

## Locomotion coupling

Two distinct modes on one animal, which is unusual for this doc set:

- **Hover** — swimmeret beat produces small continuous thrust; speed is low and
  roughly constant.
- **Escape** — tail-flip produces a large backward impulse that decays over one to two
  seconds.

Both use the impulse-and-decay primitive; only the constants differ. The tail-flip is
shared with [limb-step](limb-step.md) and should be authored once for both.

## Config keys (proposed)

`type`, `bodyMeshNames`, `pleopodRadians`, `pleopodRootYZ`, `waveSpeed`, `waveTravel`,
`dutyCycle`, `antennaTrail`, `antennaLag`, `abdomenArch`, `turnStrength`, `response`,
plus `tailFlip` (`impulse`, `decay`, `flexRadians`, `cooldown`).

## Verifier entry (proposed)

```js
{
  name: '<Species> pleopod-beat static',
  path: 'public/models/fish/<slug>/<slug>.glb',
  staticMesh: true,
  bodyMeshNames: ['<body>'],
  requiredBodyAttributes: ['color_1'],
  minVertices: 1500,
}
```

## Review gates

- The swimmeret wave is visibly metachronal and travels back to front.
- The animal hovers and darts; it does not cruise in straight lines.
- The tail-flip is explosive, backward, and followed by stillness.
- Swimmerets pause during the flip and resume cleanly.
- Antennae trail passively and never lead the body.
- Individuals in a group stay desynchronised.
- Atlas specimen moves through the same path as the tank.
- No runtime or WebGL errors.
