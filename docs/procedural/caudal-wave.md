# caudal-wave

Shader type: `caudal-vertex` · Status: **Implemented** (clean `v0.14.0`, extended through `v0.15.3`)

Travelling body undulation driven by a vertex's position along the body's long axis.
No painted mask required — influence is derived from the mesh's own bounds.

Read [README.md](README.md) first for the rules shared by every type.

## Animals

Shipping: Spotted Sardinella (`amblygaster-sirm`), Mahi-mahi (`coryphaena-hippurus`,
both sex variants), Shortfin Mako (`isurus-oxyrinchus`).

Also this type: anguilliform swimmers (eels, sea snakes) as a config variant —
`flexStart` near `0` and a high `waveTravel` puts the wave through the whole body
instead of confining it to the rear. Do not give them their own type.

**Not this type:** anything propelled by fins rather than by its body. A Mola looks
like a fish and is not caudal — see [mask-fin-row](mask-fin-row.md). A ray's thrust
is in its disc margin — see [disc-wave](disc-wave.md).

## Felt intention

**Force chain: head carries intention, body transmits force, tail finishes the
stroke.** Whole-body uniform wobble is rejected. The front of the animal should look
like it has decided where to go.

Per species:

- **Sardinella** — quick, economical cadence; a school stays alive without
  synchronised loops.
- **Mahi-mahi** — rigid head and front body carrying intent; compact rear-body flick
  during pair turns, not a long S.
- **Mako** — heavy, continuous forward patrol; a strong mid-body-to-tail wave reveals
  a broad S load before the tail completes the stroke.

## What must not happen

- A shark that undulates like an eel. `flexStart` too low, or `waveTravel` too high
  for the body.
- The front of the animal wobbling. The head is the reference frame.
- Tail-first travel, or the body rotating ahead of its actual path (see **Forward-led
  heading** below).
- A pose pop when speed or burst changes — that is the integrated clock rule.
- A fish holding a permanent sideways curl while barely moving. That is what
  `easeStraightenBySpeed` and `speedEase01` exist for.
- Independent fins detaching from a flexing region of the body.

## Blender contract

**Objects.** One body mesh, plus optional independent fin meshes.

- Body: a single object containing everything that should flex. Name it and declare
  it in `bodyMeshNames`.
- Independent fins: separate objects whose names contain `pectoral` or `pelvic`.
  These are excluded from the GPU path and rotated whole on the CPU. Side is inferred
  from the name ending in `r`, `.r`, or `-r` (right) — otherwise left.
- **Fins rooted in a flexing region must be joined into the body instead.** The Mako
  ships with both pelvic fins welded into `shortfinmako003` for exactly this reason;
  the verifier asserts they are absent as separate objects.
- An independent fin turns about its root, wherever its origin is. The renderer finds
  each fin's root (the tenth of its vertices nearest the body's long axis) and keeps it
  in place while the flutter turns the fin. A mirrored copy that kept its twin's origin
  (the Live Sharksucker's right fins did) therefore turns at the body, not about a point
  on the far side of it.
- Where the wave reaches a fin's root, the fin is carried sideways with the body under
  it, on the CPU, with the shader's own formula (`caudalLateralCurve` in
  `fishSwim.js`). It moves the fin but does not bend it, so keep fin roots near
  `flexStart`.
- **A body with two materials becomes several meshes.** GLTFLoader splits it by
  material into `<name>_1`, `<name>_2`, …, and each split deforms over its *own*
  bounds. A split that is not in `bodyMeshNames` still deforms over those bounds, waving
  as if it were a whole fish. List it in `followBodyMeshNames` and it deforms over the
  body's bounds instead, moving exactly with the body under it. The mako's teeth
  (`shortfinmako003_1`) and the Live Sharksucker's suction disc (`live_sharksucker_2`)
  are both material splits like this.

**Orientation.** `+Z` swim-forward, `+Y` up, transforms applied, origin at world `0`.
The `sourceAxis` config key can point the deformation along `x` or `z` — Sardinella
uses `x` — but new assets should use `z` and match the project convention.

**Topology.** Sufficient *longitudinal* loops to carry the wave smoothly. The wave is
a sine along one axis; too few rings and it facets visibly at the tail. Denser rings
from `flexStart` rearward, where the amplitude lives. Front-body density can be low —
it barely moves.

**Bounds.** The deformation reads `geometry.boundingBox` along `sourceAxis`. A stray
vertex, a leftover eye, or a modifier not applied changes the whole body's
parameterisation. Keep the body mesh tight.

**Vertex painting.** None required. Optional only for fin isolation or anatomy that
name-based classification cannot separate cleanly (`bodyMeshPatterns`).

## How the deformation works

Every vertex maps to `tail01` in `0..1` along `sourceAxis` (`tailAtMaxZ` picks which
end is the tail). A smoothstep flex envelope ramps from `flexStart` to `flexFull`, so
the front stays rigid. Lateral offset is then:

```
wave   = sin(phase - tail01 * waveTravel)
stroke = amplitude * mix(0.42, 1.0, speed01) * (1 + burst01 * burstAmplitude)
offset = wave * stroke * flex  +  turn * turnStrength * flex²
```

Normals are corrected analytically from the curve's slope, so shading follows the
bend rather than lagging it. The `flex²` on the turn term keeps steering bias in the
tail where it belongs.

A remora clamped to a host adds a second bend, up and down this time: its rear body
curves toward its own up (the disc side, facing the host) by `uProceduralHug` at the
tail, easing in from `RIDE_BEND_START` (30% back) as a square. The ride system sets it
per rider from the skin fit (`rideAnchorFit` in `fishSwim.js`); every other fish leaves
it at 0. Normals are corrected for it the same way.

## Config keys

In `model.proceduralAnimation`, `src/data/species.js`.

| Key | Default | Meaning |
| --- | --- | --- |
| `type` | — | `'caudal-vertex'` |
| `bodyMeshNames` | — | Meshes taking the GPU path |
| `bodyMeshPatterns` | — | Substring fallback for mesh selection |
| `followBodyMeshNames` | — | Material splits that deform over the body's bounds, not their own |
| `sourceAxis` | `'z'` | Body long axis |
| `lateralAxis` | `'x'` (or `'z'` if source is `x`) | Axis the stroke displaces along |
| `tailAtMaxZ` | `false` | `true` when the tail sits at the axis maximum |
| `amplitude` | `0.16` | Peak lateral displacement in model units |
| `waveSpeed` | `2.3` | Base stroke frequency |
| `waveTravel` | `5.2` | Radians of wave across the body — higher shows more S |
| `flexStart` | `0.18` | Where flex begins; everything ahead is rigid |
| `flexFull` | `0.82` | Where flex reaches full weight |
| `turnStrength` | `0.22` | Steering bias into the tail |
| `burstAmplitude` | `0.55` | Extra stroke under burst |
| `response` | `7` | Turn damping rate — lower is heavier |
| `speedFrequencyBoost` | `0.32` | Cadence gain from speed |
| `burstFrequencyBoost` | `0.24` | Cadence gain from burst |
| `pectoralFinFlutter` | `0.12` | CPU flutter for independent pectorals |
| `pelvicFinFlutter` | `0.07` | CPU flutter for independent pelvics |

## Shipped tuning

Starting points for a new species — copy the nearest body plan, then tune.

**Sardinella** — small, fast, high cadence, tiny stroke. `sourceAxis: 'x'`,
`lateralAxis: 'z'`, `tailAtMaxZ: false`, `amplitude: 0.065`, `waveSpeed: 5.2`,
`waveTravel: 5.6`, `flexStart: 0.15`, `flexFull: 0.82`, `turnStrength: 0.04`,
`burstAmplitude: 0.9`, `response: 11`, boosts `0.5`/`0.42`.

**Mahi-mahi (male)** — carangiform: firm front, compact rear C-flick, not a shark S.
`amplitude: 0.42`, `waveSpeed: 2.6`, `waveTravel: 3.5`, `flexStart: 0.24`,
`flexFull: 0.82`, `turnStrength: 0.32`, `burstAmplitude: 0.8`, `response: 7.5`,
boosts `0.32`/`0.24`, flutter `0.13`/`0.075`. Female is the same shape at
`amplitude: 0.4`, `waveSpeed: 2.55`, `turnStrength: 0.3`, `burstAmplitude: 0.78`.

**Mako** — lamnid power: wave starts far forward and travels far enough to
counter-curve the tail into a visible S. `amplitude: 1.2`, `waveSpeed: 2.4`,
`waveTravel: 7.4`, `flexStart: 0.1` (ahead of the pectoral roots at 0.25, so the body
bends from just behind the head), `flexFull: 0.86`, `turnStrength: 0.58`,
`burstAmplitude: 0.82`, `response: 4.8`, boosts `0.28`/`0.22`,
`pectoralFinFlutter: 0.06`, `followBodyMeshNames: ['shortfinmako003_1']` (teeth).
Before 2026-09-28 it was `amplitude: 0.82`, `waveSpeed: 1.86`, `flexStart: 0.18`,
which read as a stiff front with a waving tail.

**Live Sharksucker** — a remora: rigid head and disc, a steady subcarangiform rear
body. Source length 6.6014, so the remora stroke of 0.07 and 0.03 body lengths is
`amplitude: 0.462`, `turnStrength: 0.198`. `waveSpeed: 3.0`, `waveTravel: 3.2` (one
gentle bend down the body; 4.4 and 4.6 read as a snake),
`flexStart: 0.14` (just ahead of the pectoral roots at 0.18), `flexFull: 0.86`,
`burstAmplitude: 0.8`, `response: 8`, boosts `0.4`/`0.3`, flutter `0.09`/`0.05`,
`followBodyMeshNames: ['live_sharksucker_2']` (disc). The stand-in remoras share the
same stroke, beat, and start (`REMORA_CAUDAL`).

Note the pattern: **bigger animal → lower `waveSpeed`, higher `waveTravel` and
`amplitude`, lower `response`.** Mass reads as slow cadence, long wave, and lazy
steering.

## Forward-led heading

Large procedural fish render their heading from the **same turn-capped vector that
advances position**, not from a separately smoothed visual heading. Without this the
long body rotates ahead of its actual trajectory and reads as spinning on the spot.

Mahi pairs and Mako use this path. Smaller fish keep their visual smoothing — at
Sardinella's body length the artefact is invisible and the smoothing looks better.
Any new species longer than roughly a Mahi should be forward-led.

## Verifier entry

In `scripts/inspect-procedural-targets.mjs`:

```js
{
  name: 'Shortfin Mako static parts',
  path: 'public/models/fish/isurus-oxyrinchus/isurus-oxyrinchus_static_parts.glb',
  staticMesh: true,
  bodyMeshNames: ['shortfinmako003'],
  requiredFinMeshes: ['shortfinmakopectoral-finsl', 'shortfinmakopectoral-finsr'],
  forbiddenMeshNames: ['shortfinmakopelvic-finsl', 'shortfinmakopelvic-finsr'],
  minBodyLength: 20,
}
```

`forbiddenMeshNames` is how a required weld is proven. Use it whenever a fin has been
merged into the body deliberately. `requiredFollowMeshes` proves a
`followBodyMeshNames` part is still there under the name the config expects.

## Review gates

- Front body stays stable through turns and bursts; the head carries the line.
- The species' stroke shape is unmistakable at normal viewing distance without debug
  labels — Sardinella flicker, Mahi compact flick, Mako broad S.
- The animal visibly travels through every turn; it never rotates in place.
- Burst increases stroke force and cadence with no pose cut.
- Schooling individuals stay desynchronised.
- Independent fins never detach, flicker, or invert.
- Tail straightens as the animal slows out of a turn rather than holding a curl.
- Atlas specimen moves through the same path as the tank.
- No runtime or WebGL errors.
