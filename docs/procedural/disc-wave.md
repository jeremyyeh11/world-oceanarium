# disc-wave

Shader type: `disc-wave-vertex` (proposed) · Status: **Proposed — not implemented**

A travelling wave along a continuous lateral margin. The body is a disc or a mantle;
thrust ripples down its edge from front to back.

Read [README.md](README.md) first for the rules shared by every type.

> Starting convention only. No runtime code exists. Expect the first asset to change
> it.

## Animals

Proposed: rays and skates (rajiform/mobuliform swimmers), cuttlefish.

**Not this type:** a Mola, whose fins are discrete blades on a rigid body — see
[mask-fin-row](mask-fin-row.md). A flatfish, which is a `caudal-wave` animal lying on
its side.

Note the two sub-modes, which may or may not need separate configs:

- **Rajiform** (skates, stingrays) — many wavelengths visible in the disc at once; it
  ripples.
- **Mobuliform** (manta, eagle ray) — under one wavelength; the wings flap more than
  they ripple, approaching [foil-flap](foil-flap.md).

A single `waveTravel`-equivalent key should cover both. If it does not, mobuliform
rays belong with the turtles.

## Felt intention

**Effortless, continuous, silent.** A ray does not stroke and recover — the wave is
always travelling. The animal appears to be carried rather than to push.

## What must not happen

- The wave running the wrong way. It travels **front to back**, always.
- Left and right margins waving in sync, which makes it flap like a bird.
- The central body disc deforming. The spine and head are rigid; the motion is in the
  margin.
- A wave amplitude uniform across the disc — it must ramp from zero at the body to
  maximum at the outer edge.
- The tail leading or whipping. On a ray the tail is ballast and a rudder.

## Blender contract (proposed)

**Objects:** one mesh, whole animal. The margin is continuous with the body, so
splitting it would guarantee a seam.

**Orientation:** `+Z` forward, `+Y` up, transforms applied, origin at world `0`. The
disc lies in the XZ plane.

**Topology:** this is the type most sensitive to topology. The wave travels along `Z`
and ramps along `X`, so the disc needs a **grid-like quad layout** aligned to those
axes, not a radial fan from the centre and not a triangulated blob. Aim for even
spacing with 20–30 divisions front-to-back along the margin — too few and the ripple
steps visibly.

**Poly budget:** 3000–6000 vertices for a mid-size ray, concentrated in the margin.

## Vertex paint channels (proposed)

| Channel | Means |
| --- | --- |
| R | Margin wave weight, `0` at the spine → `1` at the outer edge |
| G | Longitudinal phase position, `0` at the leading edge → `1` at the trailing edge |
| B | Tail / rudder weight |
| A | Unused, or cephalic-lobe weight for mantas |

G is worth painting rather than deriving from Z bounds because the margin's leading
edge is a curve, not a plane — a bounds-derived phase makes the wave start at
different times along the wing and skews the ripple.

## How the deformation should work

```
offset.y = sin(phase - G * waveTravel) * amplitude * ramp(R) * speedStroke
```

- `ramp(R)` should be superlinear (R² or a smoothstep) so the spine stays genuinely
  rigid rather than merely low-amplitude.
- Turn: bias amplitude between sides by sign of raw X and `turn`, plus a tail offset.
- The wave never stops. Even at rest there is a slow low-amplitude ripple — unlike
  every other type here, this animal has no still pose.
- Normals need the analytic slope correction, as in [caudal-wave](caudal-wave.md);
  a large flat surface shows unlit deformation immediately.

## Config keys (proposed)

`type`, `bodyMeshNames`, `amplitude`, `waveSpeed`, `waveTravel`, `marginRampPower`,
`tailAmplitude`, `turnStrength`, `burstAmplitude`, `response`, `idleAmplitudeFloor`,
`speedFrequencyBoost`, `burstFrequencyBoost`.

`idleAmplitudeFloor` is specific to this type and matters: it is what stops a resting
ray from freezing solid.

## Verifier entry (proposed)

```js
{
  name: '<Species> disc-wave static',
  path: 'public/models/fish/<slug>/<slug>.glb',
  staticMesh: true,
  bodyMeshNames: ['<body>'],
  requiredBodyAttributes: ['color_1'],
  minVertices: 3000,
}
```

## Review gates

- The wave travels front to back and never reverses.
- The spine and head stay rigid; amplitude ramps to the outer margin.
- Left and right margins are not locked in sync.
- A resting animal still ripples slowly; it never freezes.
- Turns bias the margins asymmetrically rather than rotating the body in place.
- Shading follows the deformation — no flat unlit patches on the wings.
- Atlas specimen moves through the same path as the tank.
- No runtime or WebGL errors.
