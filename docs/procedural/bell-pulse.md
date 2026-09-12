# bell-pulse

Shader type: `bell-pulse-vertex` · Status: **Proposed — not implemented**

Contract-and-glide jet propulsion. A bell squeezes, ejects water, and the animal
coasts while the bell elastically recovers.

Read [README.md](README.md) first for the rules shared by every type.

> This doc is a starting convention derived from a design pass, not a shipped
> contract. No runtime code exists yet. Expect the first real asset to change some of
> it — particularly the paint channels and the poly budget.

## Animals

Proposed: jellyfish (scyphozoans), salps.

**Not this type:** siphonophores, which are colonial and trail rather than pulse;
ctenophores, which row with ciliary combs. Both would need their own treatment if
they are ever added.

## Felt intention

**Pulse and glide.** Thrust is impulsive and periodic; the animal accelerates during
the contraction and then coasts and decays. Weightless but not inert — every bit of
movement is paid for by a visible stroke.

## What must not happen

- **A bell beating in place while the body translates at constant velocity.** The
  classic wrong read, and exactly what a shader-only implementation produces. See
  **Locomotion coupling** below — this is the defining requirement of the type.
- Strands leading the bell. They always lag.
- Strand roots detaching from the bell margin.
- All strands moving as one curtain.
- A symmetric sine on the bell. Real contraction is fast; recovery is slow.
- A pose pop when speed changes — the integrated clock rule.

## Blender contract

**Objects: two, sharing one local frame.**

- `jelly-bell` — the bell shell.
- `jelly-strands` — all oral arms and marginal tentacles as cards, `Ctrl+J`'d into
  one object. Separate islands, **vertices not merged at the roots**.

Two objects rather than one because transparency sorting is per-object and the bell
(blended) and the strands (alpha-tested) need independent `renderOrder`. Draw-call
cost is identical either way.

**Joined, not welded.** The shader deforms by position and painted mask, not by
topology, so it does not need shared vertices — and welding a card root into the bell
surface wrecks its normals and UVs. What matters is that card root vertices are
coincident in position with the bell margin they attach to and carry the bell's mask
value there. See the shared rule in [README.md](README.md).

**Orientation.** **Apex at `+Z`, strands trailing toward `−Z`.** Forward for a
jellyfish *is* the bell axis. Do not build it apex-up on the reasoning that jellies
drift upward: the engine aims model-forward at the heading, so an apex-`+Y` asset
swims sideways. Vertical drift is a behaviour layer, not a model property.

Origin at the bell's centre of volume — it is the follow and pivot point.

**Both objects need applied transforms and a shared origin.** The deformation is
computed in local space; two objects with different frames will shear apart.

**Poly budget** (generous — the Mola body is 8000+, the sardine 500):

- Bell: 16–24 axial rings × 24–32 radial segments, roughly 1500–3000 vertices. Even
  ring spacing, **denser toward the margin** where curvature and flare are highest.
  Ring count is what makes the travelling contraction smooth instead of stepped.
- Strands: **minimum 5 lengthwise segments per card, 8 preferred**, one quad wide. A
  two-triangle card cannot bend, and a rigid tentacle breaks the illusion faster than
  anything else on this list. Roughly 4 oral arms plus 8–16 marginal cards,
  200–600 vertices total.
- **Cross the cards** — 2–3 planes at 60°/120° per cluster so they do not vanish
  edge-on. Not billboarded: billboarding fights the margin attachment.

**Texture.** One shared alpha atlas for all strands — one material, one draw call.
512² straight-alpha PNG is plenty; 1024² if frill detail warrants it. Put the taper
in the alpha, not the geometry. Avoid KTX2/Basis here: it handles cutout alpha badly
at this size.

## Vertex paint channels

Painted into `COLOR_1`. `COLOR_0` stays white material data.

Unlike [mask-fin-row](mask-fin-row.md)'s exclusive channels, this type wants
continuous independent weights:

| Channel | Means | Painted |
| --- | --- | --- |
| R | Bell contraction weight | `0` at apex → `1` at margin, following the **surface arc** |
| G | Strand trail weight | `0` at root → `1` at tip, normalised per strand |
| B | Strand stiffness | `~0` thin marginal tentacle (whippy), `~1` oral arm (heavy, damped) |
| A | Per-strand identity | Flat random `0..1` per strand island |

Why R is painted rather than bounds-derived: on a deep dome, distance-along-`Z` is
not distance-from-apex along the bell surface. Painting lets the artist declare the
true apex→margin arc. Card roots take the bell's R value at their attachment point —
this is the attachment ramp that keeps them riding the margin.

G cannot be derived from bounds at all — each strand needs its own normalised
`0..1`, regardless of its actual length. It must be painted.

A is the cheapest possible fix for the curtain look: select each strand island, flat
fill a different alpha. One operation per island. Fallback if alpha export is awkward:
hash a per-strand root position in the shader, at the cost of artist control.

## How the deformation should work

Four layers:

1. **Bell contraction.** Radial scale `1 − c·shape(u)`, axial scale `1 + c·k·shape(u)`
   where `u` is the painted R weight. The bell narrows *and* elongates on the power
   stroke, then flattens on recovery. Roughly volume-conserving, which is what sells
   gelatinous.
2. **Asymmetric drive.** `c` is **not** a sine: fast contraction over ~25–30% of the
   cycle, slow elastic relaxation over the rest, each smoothstep-eased. The single
   biggest readability win available, and it costs nothing.
3. **Margin lag and flare.** The contraction wave travels apex→margin (phase offset
   by `u`), and the last ~20% of the bell curls outward on relaxation.
4. **Strand trail.** Same clock, phase-delayed by stiffness, amplitude ramped root→tip
   by G, plus a slower secondary sway at a different rate and the per-strand offset
   from A.

## Locomotion coupling

**The part that is not a shader, and the reason this type is not just a config of an
existing one.**

Forward speed must pulse from the same phase as the pose. `thrust01` derives from the
wave clock and feeds the movement integrator as a speed envelope:

```
speed = base * (glideFloor + gain * thrustEnvelope(phase))
```

Without it the animation is decorative and reads wrong regardless of how good the
bell deformation is.

This is the only part touching shared movement code, so it must be gated behind a
`pulseLocomotion` flag on the species and frame-time measured. See the
impulse-and-decay primitive in [README.md](README.md).

## Required runtime change: shared bounds

Bounds are currently computed **per mesh** from each `geometry.boundingBox`. Two
objects would derive different parameters and shear apart at the attachment.

Before this type can ship, the uniform build in `applyFishLightMask()` needs to take
min/max once from a configured bounds-source mesh (the bell) and pass the same values
to every deformed mesh of that model. Small and contained, and a correctness
improvement for any future multi-object asset.

## Material and translucency

Everything shipping today is opaque, so this is new ground. Options, cheapest first:

**Opaque bell plus Fresnel rim.** Effectively free, reuses existing rim code. No
sorting risk, correct depth. Reads as a pale glowing bell; loses the see-through
signature. Fine for small or distant animals.

**Single-layer blend.** `transparent`, opacity `0.35–0.55`, `depthWrite: false`,
`DoubleSide`, pinned `renderOrder`. Double-sided blending gives natural density
falloff at grazing angles. Jelly-on-jelly sorting is wrong (per-object) and shows
when two overlap — fine for a handful, bad for a bloom. **Recommended default.**

**Two-pass back-then-front.** Draw the bell twice, `BackSide` then `FrontSide`, both
blended, `depthWrite` off. Correct within a convex bell: you genuinely see the far
inner wall through the near wall. Cost is 2× a small, cheaply-shaded mesh. **Best
effect-per-cost; the upgrade if single-layer reads flat.**

**Thickness-driven fake subsurface.** Fresnel-ish thickness modulating alpha and
colour so the rim reads denser than the centre, plus forward scatter when light is
behind the bell. Pure shader math, no extra pass, no sorting change. **Do this
regardless of which of the above is chosen** — most of the gelatinous read comes from
here, not from the alpha value.

**`MeshPhysicalMaterial.transmission` — no.** Real refraction, but Three renders the
scene to a transmission target per frame: effectively a second scene pass, on top of
a full tank, at capped dpr. It also fights the `onBeforeCompile` injection. Defensible
only in the Atlas viewport, where there is one hero model and nothing else to render.

**Strands: alpha-test, not blend.** `alphaTest ≈ 0.35`, `transparent: false`,
`depthWrite: true` — they sort correctly against everything and leave the transparent
pass entirely. Blended strands hit the classic foliage problem: strand-on-strand
order within one object is undefined and flickers as the camera moves. Add
`alphaToCoverage: true` for soft edges with correct depth, nearly free with MSAA on.
This single decision removes most of the sorting risk.

**Overdraw is the real cost driver, not shader complexity.** Translucent bells are
large on screen and blend over everything behind them; twenty near-camera jellies can
redraw the screen twenty times in the transparent pass. Cap count per tank, keep the
bell shader free of extra texture fetches, never blend the strands.

This type therefore also needs an **opt-in material override** honoured by
`applyModelMaterialSettings()` (per-mesh opacity, `depthWrite`, `side`, `renderOrder`,
`alphaTest`, `alphaToCoverage`), and the fade-recovery path at `Fish.jsx:3031` must
multiply a configured base opacity rather than reset it to `1`.

## Config keys (proposed)

`type`, `bodyMeshNames`, `boundsMeshName`, `waveSpeed`, `contractAmount`,
`axialAmount`, `marginFlare`, `waveLag`, `dutyCycle`, `strandLag`, `strandSway`,
`strandAmplitude`, `strandStiffnessSplit`, `turnStrength`, `burstAmplitude`,
`response`, `speedFrequencyBoost`, `burstFrequencyBoost`, `pulseLocomotion`
(`glideFloor`, `gain`).

Starting points cannot be given honestly until an asset exists. Expect a low
`waveSpeed` (this is a `tempo: 'drift'` animal), low `response`, and a `dutyCycle`
near `0.28`.

## Verifier entry (proposed)

```js
{
  name: 'Jellyfish bell and strands',
  path: 'public/models/fish/<slug>/<slug>.glb',
  staticMesh: true,
  bodyMeshNames: ['jelly-bell', 'jelly-strands'],
  requiredBodyAttributes: ['color_1'],
  minVertices: 200,
  minBodyLength: 0.5,
}
```

Note `minVertices` applies to every body mesh, so it must clear the *strands* floor,
not the bell's.

## Tank placement

`tempo: 'drift'`. The dev coherence guard warns on mixing drifters with cruisers or
sprinters, so jellies belong in `the-drift` with the Giant Sunfish — which is also
biologically right, since Mola eat them.

## Review gates

- The animal visibly accelerates on the contraction and coasts between pulses.
- The contraction is asymmetric: fast squeeze, slow recovery.
- The contraction wave travels apex→margin; the margin flares on recovery.
- Strands always lag the bell and never lead it.
- Strand roots stay locked to the bell margin through every pulse and turn.
- Strands do not move as a synchronised curtain.
- No sorting flicker as the camera orbits, including with two animals overlapping.
- Frame time holds at target count on a mid-range phone, with bells near camera.
- Bell remains legible against the dark Atlas stage.
- No runtime or WebGL errors.
