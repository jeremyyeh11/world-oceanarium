# disc-wave

Shader type: `disc-wave-vertex` · Status: **Implemented** (mobuliform; rajiform still a proposal)

A travelling wave along a continuous lateral margin. The body is a disc or a mantle;
thrust ripples down its edge from front to back.

Read [README.md](README.md) first for the rules shared by every type.

> The mobuliform sub-mode below runs in `src/components/Fish.jsx` (`applyFishLightMask`,
> `discWingLift`), first on a generated stand-in (`scripts/build-devil-ray-placeholder.mjs`,
> 2026-10-23), then on Jeremy's Munk's devil ray (`v0.36.0-dev_2`, 2026-10-24), its masks
> computed by `scripts/paint-disc-wave-masks.py`. The rajiform sections further down are
> still a starting convention.

## First animal: Munk's devil ray (approved by Jeremy 2026-10-23)

The first asset is mobuliform, not rajiform: *Mobula munkiana* (`mobula-munkiana`),
0.85–1.1 m across in the tank (3.4–4.4 WU), schooling in the hundreds. A devil ray flies:
the wings beat up and down with under one wavelength across the chord, and the tip
trails the root, so the wing curls rather than ripples. Proposed changes to this doc for
that sub-mode (Jeremy: "Approved: mobuliform disc-wave with wings beating together,
spanLag and nose -Z"):

- **Stay in disc-wave, not foil-flap.** The wing is continuous with the body (no shoulder
  joint to pivot on), and the trailing tip is a phase lag along the span, which this
  type's painted phase already expresses. foil-flap's rigid root rotation would hinge the
  disc at a seam. Mobuliform is a config: `waveTravel` under about 0.8 so the chord
  holds less than one wavelength, plus a new `spanLag` (phase delay from root to tip, by
  `R`) so the tips curl after the stroke.
- **Both wings beat together in straight flight.** The "left and right in sync" warning
  below is about a rippling ray; a devil ray's wings stroke as a pair, and asymmetry
  belongs to turns (bias amplitude and timing by `turn`, and bank the root).
- **Downstroke is the power stroke.** Use the README's asymmetric drive envelope, as
  foil-flap does, so the stroke is quicker down than up; the body heaves slightly
  opposite the wings, but never pitches.
- **Orientation.** The renderer turns local `-Z` to the heading (README, Shared asset
  contract), so a devil ray is exported nose at `-Z`, not `+Z` as written below.
- **Tail.** A long whip with no sting: `B` weight, trailing the body's heave with a lag,
  never driving.
- **Cephalic fins.** Rolled into horns while cruising; unrolling to feed is a later
  idea. `A` stays unused for now.

Blender contract for Jeremy's model (proposed):

- One mesh, whole animal: disc, head with rolled cephalic fins, small dorsal fin, tail.
  Nose at `-Z`, `+Y` up, transforms applied, origin at world `0` at the centre of the
  disc, `1` raw unit = `1` m, so a 1.3 m disc is 1.3 units wingtip to wingtip.
- Grid-like quads across each wing: about 20 spanwise rings (root to tip) and 10–14
  chordwise divisions. 3000–6000 vertices in all, mostly in the wings.
- `COLOR_0` white. `COLOR_1`: `R` 0 along the body's flat centre (about the width of the
  head) rising to 1 at the wingtips; `G` 0 at the wing's leading edge to 1 at its
  trailing edge; `B` 0 at the tail root to 1 at its tip.
- Painting: the masks are pure geometry, so intake computes them instead of Jeremy painting
  them: `scripts/paint-disc-wave-masks.py` (headless Blender) paints R as a linear ramp from
  the head's width to the wingtip, G from each station's leading to trailing edge, and B
  along the tail. It also scales the disc to 1.3 m, centres the origin, writes a white
  `COLOR_0` with the masks as `COLOR_1`, and exports. Check the result with the local paint
  viewer. (Blender's vertex paint can't paint one channel alone; hand-painted layers would
  need packing, and his first paint ramped the wing to 1 by mid-span, which moves the outer
  wing as a rigid plate instead of bending it.)
- Purplish-grey to brown above with dark bands across the top of the mouth; white below,
  often with dusky wingtips. Opaque texture, 2048 px or less.

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

## Config keys

As implemented (`proceduralAnimation` in `species.js`; lengths in source units, 1 = 1 m):

- `type: 'disc-wave-vertex'`, `bodyMeshNames`.
- `amplitude` — wingtip lift either side of level at full cruise.
- `waveSpeed` — radians of beat per second at rest; `speedFrequencyBoost`,
  `burstFrequencyBoost` raise it with speed and bursts (integrated clock, README).
- `waveTravel` — radians of wave across the chord (G). Under about 0.8 flaps; several
  radians ripple.
- `spanLag` — radians the wingtip trails the wing root (R), so the wing curls.
- `downFraction` — share of the beat spent on the downstroke (the power stroke).
- `marginRampPower` — exponent on R, so the body stays rigid and the tips move most.
- `idleAmplitudeFloor` — share of the stroke kept at rest.
- `burstAmplitude`, `turnStrength` (outer wing beats harder), `response` (turn damping).
- `heave` — the body's dip against the wings, as a share of the stroke.
- `tailAmplitude` — the tail's trailing lift (B) and its lean into turns.

The shader takes the wing span (where R starts rising, and the tip) from the paint once
per model, for the normals' slope.

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
