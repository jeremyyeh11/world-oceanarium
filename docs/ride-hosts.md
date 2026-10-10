# Ride hosts and hitchhikers

How remoras ride other animals. Code: the ride section of
[`src/components/fishSwim.js`](../src/components/fishSwim.js) (pure, tested in
[`tests/fishRide.test.mjs`](../tests/fishRide.test.mjs)) and its wiring in
[`src/components/Fish.jsx`](../src/components/Fish.jsx).

## Felt intention

A remora should read as a passenger that has to work for its ride. Most of the time it
is clamped to the host and carried effortlessly, moving exactly as the host moves:
turning, pitching, and rolling with it, even through a basking Mola's roll. Now and then
it lets go, swims forward off its disc, falls behind, and swims on its own for a
while. When it wants a ride again it has to catch the host.

Must not happen:
- A rider passing through the host on its way to its spot.
- A rider sliding around on the host, or floating a body-width off it.
- A rider snapping onto or off the host. Latching eases in over 1.1 s, and letting go
  unrolls over 1.4 s.
- A shark shouldering its own remoras aside, or a remora fleeing the shark it wants to
  ride.
- A remora above the water, or left behind in the dark when a Mola fades out and snaps
  back.

## Data

Both sides are declared in [`src/data/species.js`](../src/data/species.js). They are
matched by host group, so adding a host species gives rides to every remora that rides
that kind of animal, with no edits to the remora entries.

**Host:** `rideHost`

```js
rideHost: {
  groups: ['shark', 'large-fish'],          // what kind of host this is
  anchors: RIDE_ANCHORS['isurus-oxyrinchus'].anchors,    // generated from the mesh
  waveSpan: RIDE_ANCHORS['isurus-oxyrinchus'].waveSpan,  // nose and tail along Z
  loadRatio: 0.8,                           // optional: how much of its length riders may cover
  body: { center: [0, -0.0056, 0.1685], radii: [0.1236, 0.1067, 0.4944] },
},
```

Anchors are not placed by hand. `node scripts/fit-ride-anchors.mjs <host-id>` samples them
over the host's body mesh and writes them to
[`src/data/rideAnchors.js`](../src/data/rideAnchors.js), which records the command that
made each entry:

1. It keeps the faces a remora could clamp to: between `--from` and `--to` of the length
   (the mako uses 12–50%, the Mola 15–70%), not facing up (the back) or along the body
   (snout, fin edges), and not on a flapping fin painted in a motion mask (the Mola's).
2. It draws points over those faces by area with a fixed `--seed`, and keeps a point only
   if it is:
   - at least 6% of the host's length from every point already kept;
   - on at least 3% of body thickness, which skips thin welded fins;
   - somewhere a typical rider would clear the host's separate fins (the mako's
     pectorals);
   - not beside a bump: the skin over the stretch a rider lies on must not rise more
     than 0.4% of the host's length above the spot. That skips fin roots, such as the
     Mola's pectoral just ahead or the mako's welded pelvics just behind.

   Nothing is mirrored, so the spots are as uneven as the mesh. The mako has 18 spots on
   both flanks and the belly; the Mola has 12.
3. Each point's normal is averaged over a small cross of rays, and its rail is sampled.

- `at` is the point on the host's surface where the rider's disc sits. It is in host
  body lengths, measured from the model root in the runtime model frame: +X right, +Y
  up, +Z toward the tail.
- `normal` is the outward surface normal at that point. The rider's back faces into
  the host along it. A belly anchor keeps the rider upright; a flank anchor lays it on
  its side.
- `rail` is the skin's height along the normal at steps along the body, from a little
  ahead of the anchor to well behind it: `[offset, height]` pairs in host body lengths.
  A rigid rider pointing along the host's axis drifts off a belly or flank that curves
  away behind its disc, and a sampled spot can bulge or dip under it. `rideAnchorFit`
  finds the tilt and the bend of the rider's rear body that lie closest to the skin on
  average, each lifted just enough that nothing cuts in, fin lobes included. A gap under
  the disc counts three times, so riders stay on their discs: across all 198
  rider-and-spot pairs the median disc lift is 0 and the worst is 1.4 mm.
- The bend (`rideBendProfile`) starts 30% back from the nose, behind the disc and the
  pectoral fins, and grows as the square of the distance from there. At most, the tail
  bends 15% of the rider's length toward the host. The `caudal-vertex` shader bends the
  mesh by it (`uProceduralHug`) along the rider's own up axis: it eases in over the
  latch, holds while attached, and eases out as the rider lets go. On the mako, a
  full-size sharksucker's tail reaches the skin on 14 of the 18 spots. On the other four
  the belly curves away more sharply than 15% allows.
- `waveSpan` lets riders follow a host's caudal wave (see Runtime). The generator writes
  it; hosts without a `caudal-vertex` wave (the Mola) ignore it.
- Capacity: a host carries riders up to `loadRatio` (default 0.8) of its own length laid
  end to end. A 4.2 m mako takes three 1.1 m sharksuckers, or about ten white
  suckerfish. One rider per spot, and a spot is free only if its rider would clear the
  riders already on the host: each rider is treated as a capsule along its body, 6% of
  its length wide. Riders that find no room swim free and try again later.
- `body` is a clearance ellipsoid around the host's body, in the same units and frame.
  It should cover the body and any fins a rider could pass through; tall thin fins
  (the Mola's dorsal and anal fins) can stay outside it, because riders go round the
  nose or tail rather than over the top. Each rider inflates it by a fifth of its own
  length.

**Rider:** `hitchhiker`

```js
hitchhiker: {
  hosts: { shark: 1, ray: 0.8, turtle: 0.8, cetacean: 0.5, 'large-fish': 0.5 },
  rideSeconds: [40, 100],     // how long one ride lasts
  freeSeconds: [20, 45],      // how long it swims free after letting go
  dorsalClearanceBodyLengths: 0.058, // optional: root to disc top (the stand-in's DISC_TOP)
  discAheadBodyLengths: 0.325,       // disc centre ahead of the root, in rider body lengths
  contactDropBodyLengths: 0.021,     // optional: how far below the disc top the back sits
                                     // 0.2 body lengths behind the root (body taper)
  backProfile: [[-0.14, 0.038], ...],// supplied models only: the measured top line
},
```

- `backProfile` replaces the stand-ins' straight back with the model's real top line:
  `[behind, drop]` pairs in rider body lengths, `behind` measured back from the disc
  centre and `drop` below the disc-top line, negative where something stands proud of
  it. `rideAnchorFit` then lays the real top line against the skin, fin lobes included.
  Don't write it by hand: `scripts/fit-rider-model.mjs` measures
  it (see Remora models below).

- `hosts` maps group to a weight from 0 to 1. Each weight comes from the species'
  documented host range: 1 for the usual host, lower for hosts it is recorded on only
  occasionally. A remora accepts a chosen host with probability equal to that weight,
  so a white suckerfish (sharks 0.3) takes the mako only sometimes. Among free spots it
  takes the nearest, give or take 35%, so riders spread over a host instead of all
  queuing for the same few spots.
- A rider must be a solo agent (`schooling: false`).

Current groups: `shark`, `ray`, `turtle`, `cetacean`, `billfish`, `sunfish`,
`barracuda`, `large-fish`. The mako is `shark` + `large-fish`; the Mola is `sunfish` +
`large-fish`.

## Followers (pilot fish)

A follower is a `hitchhiker` with `attaches: false`. It runs the escort stage only: it
never looks for a spot, claims no slot, adds no load, and is never carried. It needs no
disc or back profile. The Pilot Fish (`naucrates-ductor`) is the first, following the Mola
in The Drift.

```js
hitchhiker: {
  attaches: false,
  hosts: { sunfish: 1, shark: 1, ray: 0.8, turtle: 0.8, 'large-fish': 0.6 },
  escort: {                     // all optional; defaults are the remoras' escort values
    along: [-0.9, 0.05],        // nose -1 .. tail 1
    angleDegrees: [-215, 35],   // 0 = host's right, -90 below, -180 left
    radius: [1.2, 1.6],         // times the clearance
    seconds: [40, 90],          // how long it holds one station
    rangeBodyLengths: 10,       // how far (host lengths) it will go to find its host
    leaveChance: 0.6,           // chance, when a spell ends, to roam off for `freeSeconds`
    minSpeedBLPerSec: 0.3,      // slowest escort pace; unset, half its idle speed
  },
  freeSeconds: [25, 55],        // how long a roam lasts before it rejoins
},
```

- Free, it picks the nearest host it follows (chance = its weight) every 6–14 s.
- Escorting, when a spell ends it either draws a new station on the same host or, with
  `leaveChance`, swims off free for `freeSeconds` at its own cruise and then rejoins. With
  `leaveChance: 0` it never stops following.
- It also lets go when the host fades (the Mola's deep-exit recovery) or leaves, and
  rejoins once the host is back.
- Its free-swim speeds (`idleBLPerSec` and up) can sit well above the host's pace: while
  escorting, the steering matches the host and `minSpeedBLPerSec` is the floor.
- Steering, the push-out clamp, and boid exemption with its host are the escort's own.
- The pilot fish's stations sit round the host's front half, ahead of the snout and along
  the head and flanks, never over the top: clear of the Mola's rear dorsal and anal fins,
  which stand outside the clearance ellipsoid.

## Runtime

Stages: `free` → `approach` → `dock` → `latch` → `attached` → `release` → `free`, with
`escort` beside the first and last: `free` ⇄ `escort` → `approach`, and `release` → `escort`.

- **free:** the ordinary solo-agent swim. Every 6–14 s (3–10 s after spawn) the remora
  looks for a free spot on a matching host in its biome, one the host has room for and
  it would clear the other riders on (see Capacity above).
- **escort:** following a host loosely, the way remoras shadow a shark beneath and beside
  it. A remora that wants a ride but finds no room (or loses its roll for an occasional
  host) escorts that host instead of roaming off, with chance 0.7 × its weight for the
  host. One that has just let go stays with its host half the time, for its spell off the
  disc. Each escort holds a loose station, placed in the clearance ellipsoid's normalized
  space:
  - along the body from −0.45 to 0.4 (nose −1, tail 1);
  - round it from −165° to −15° (0 is the host's right, −90° straight below);
  - out from 1.25 to 1.9 times the clearance;
  - each drifting slowly, by ±0.12, ±18° and ±0.15, so escorts never settle into a
    formation.

  It steers like an approach: the host's velocity plus a closing velocity that grows with
  its distance from the station (gain 0.45), so it lags on a turn and drifts back rather
  than snapping in. The approach's "never inside the host" push applies to it too.
  - It holds no spot and no load on the host.
  - Every 4–8 s it looks for a spot and goes for one that has opened.
  - After 25–60 s it swims off, and it leaves at once if the host fades.
  - Only hosts within three of their own body lengths are escorted.

  In the live tank, with the mako full, the fourth sharksucker closed from 25 WU to about
  4 WU off the mako and held there, and took the first spot that opened.
- **approach:** ordinary steering, matching the host's velocity plus a closing velocity
  toward a waypoint, at up to 1.2× burst speed. The target is the anchor's *staging
  point*: out along the anchor's normal, just past the clearance ellipsoid. With the
  host in the way, the waypoint swings round the body in 45° steps instead. As a hard
  stop, an approaching remora found inside the clearance is pushed back out to its
  surface after integration, like the swim-bounds clamp. The rider and its host ignore
  each other in boids. The approach gives up after a timeout scaled to the distance
  (12–30 s), so a remora does not chase a mako it cannot catch forever.
- **dock:** once the remora is near the host (within 1.6× the clearance, or about a
  body length of its staging point), it moves in the host's own frame. It follows the
  same swing-round path at a relative speed that closes the remaining distance, turns
  to face the host's way, and is carried with it. The free-swimming integrator could
  not hold a path this tight round a turning shark; this can, and it cannot cross the
  body. The tail reads as swimming at the host's pace. The remora gives up after 12 s.
- **latch → attached:** latching starts at the staging point and slides the remora in
  along the surface normal. From then on the rider's pose is the host's published pose composed with
  the anchor. On a host with a caudal wave, the rider also moves with the body under its
  disc (`rideFollowHostWave`): sideways by the wave's offset there, and turned about the
  disc with the body's local slope. The host's renderer publishes its live wave state
  (phase, speed, turn, burst) with its pose, and `caudalLateralCurve` repeats the
  shader's formula on the CPU. The rider leaves the steer → boids → integrate pipeline
  entirely, the same way the Mola sun-bask hold does. Its tail settles to a slow beat, it
  does not bank or trigger turns, and it fades with the host.
- **release:** it swims forward along the host's heading, peels off the surface, and
  eases back inside its own swim volume if the host had carried it outside. A remora
  also lets go before the host would lift it above the water. It never lets go while
  the host is faded out.

Ordering: hosts run their `useFrame` at priority −1 (`RIDE_HOST_FRAME_PRIORITY`) and
publish their final pose (bank and roll included) through `updateFishRegistryPose`.
Riders therefore read the same frame's pose and never lag a frame behind the host.
Negative priority is required, because a positive one makes r3f stop rendering
automatically.

Ride state lives in `fishRuntimeStore`, so a remora clamped to the mako is still
clamped when you come back to the tank.

## Adding a host (e.g. the manta, for the white suckerfish)

1. Add `rideHost` with its groups and a `body` clearance ellipsoid covering the body and
   pectoral fins. `node scripts/measure-ride-anchors.mjs <glb> --scale <model.scale>
   --body-length <bodyLengthWU> --mesh <bodyMesh>` prints belly, back, and flank lines
   along the length to size it from.
2. Run `node scripts/fit-ride-anchors.mjs <host-id> [--count 18] [--from 0.12] [--to 0.5]`.
   Keep `--to` where the body still bends gently: riders follow the caudal wave at their
   disc but are rigid along their length, so far back on a strongly waving body their
   ends would drift off the skin. Point `anchors` and `waveSpan` at the new
   `RIDE_ANCHORS` entry. Riders whose `hosts` include one of the host's groups start
   using it right away.
3. Set `loadRatio` only if the host should carry more or fewer riders than 80% of its
   length laid end to end.
4. `npm test` runs these checks:
   - the spots are many, on both flanks and underneath, never facing up, not mirrored,
     and within the sampled stretch of the body;
   - the anchor frames are right-handed, face into the host, and face the host's way;
   - every rider, on every spot of every host it rides, rests on the skin, never cuts
     into it, and lies at least as close as any nearby tilt;
   - a loaded host turns away a rider that would not fit, and a spot beside a rider on
     the same flank is not free;
   - a clamped rider moves and turns with the host's wave by the amounts the shader's
     formula gives;
   - approaches from above, below, the far side, ahead, and behind never enter the
     body;
   - no rider in a tank is left with nothing to ride there, unless it's on the test's
     waiting list.

## Remora models

Until the real GLBs arrive, each remora renders a stand-in from
`node scripts/build-remora-placeholders.mjs`. It writes
`public/models/fish/<id>/<id>_placeholder.glb`: unit length along Z, nose at −Z, up +Y,
origin mid-body, and one mesh named `remora-placeholder` that rides the real
`caudal-vertex` wave. The disc is built at the species' `discAheadBodyLengths` and
`placeholder.discLength`, and the colour comes from `placeholder.bodyColor`. Rerun the
script after changing any of those.

A supplied model needs nose at −Z and up +Y; its origin can be anywhere. The Live
Sharksucker (`echeneis-naucrates.glb`) was the first. To take one in:

1. Put it at `public/models/fish/<id>/<id>.glb`. Point `model.path` at it and set
   `proceduralAnimation.bodyMeshNames` to the body mesh. GLTFLoader splits a mesh with
   two materials into `<name>_1`, `<name>_2`, …; each split deforms over its own bounds,
   so list a separate disc (or any other part that must not wave on its own) in
   `followBodyMeshNames`: it then moves with the body under it. Remove the species' `placeholder` block
   and its `hiddenInAtlas: true`: a remora stays out of the Atlas until its model lands.
2. Run `node scripts/fit-rider-model.mjs <id>`. It raycasts the model and prints
   `model.scale` and a `model.position` that recentres the root mid-length on the body
   axis (the frame the fit assumes), the Atlas source length, and the rider's
   `discAheadBodyLengths`, `dorsalClearanceBodyLengths`, and `backProfile`. Paste them in.
3. Scale `amplitude` and `turnStrength` by the source length: the stand-ins use 0.045
   and 0.03 body lengths, and the config is in model units.
4. Set the Atlas source length in `MODEL_SOURCE_LENGTH_UNITS_BY_SPECIES`
   (`EncyclopediaPage.jsx`), add a verifier target to
   `scripts/inspect-procedural-targets.mjs`, add the source length to
   `SUPPLIED_REMORA_SOURCE_LENGTHS` in `tests/speciesData.test.mjs`, and delete the
   stand-in GLB.
5. `npm test`: every rider must still touch the skin and never cut into it, now against
   its measured top line.

## Known simplifications

- A rider follows the host's wave only at its disc: it moves and turns with the body
  there, but it stays rigid along its length. The mako's spots stop at half its
  length for that reason.
- Spots are generated once per host mesh; riders do not choose new spots on the fly,
  and spacing is checked with the rider's rest pose, not its wave-following one.
- A rider bends in one smooth curve only (a parabola from 30% back). A skin with a bump
  in the middle of the rider's length still leaves it resting on the bump.
- A supplied model's fins are rigid. The Live Sharksucker's second dorsal fin has a
  raised front lobe about 4.6 cm above the line from its disc to its tail, and its upper
  tail lobe stands proud too. The bend stops when either touches the skin, and the top of
  its tail stalk, being thinner than its head, still sits a little off the skin.
- The fit follows the rider's centre line only. Paired fins that stand above the disc
  (the sharksucker's pectorals, by about 1.7 cm) can graze a strongly curved host.
- No rider enters a mouth or gill chamber. The white suckerfish does both on mantas,
  and juvenile spearfish remoras shelter in gill chambers. Every rider sits on the
  outside of the body.
- Riders do not move between anchors on the same host, although real remoras do.
- Escorts keep apart only through the ordinary boid separation between remoras; their
  stations are random, not assigned.
- A docking remora is carried in the host's frame, so it keeps up even through a
  mako's burst. That holds only for the few seconds it spends beside the host.
- A clamped remora's tail still beats gently, because the caudal wave has a 42% stroke
  floor at low speed.
- The clearance ellipsoid is one ellipsoid. The mako's tall caudal fin sticks out of
  it, so a remora coming straight up from behind the tail can graze it.
