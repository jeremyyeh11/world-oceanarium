# Reef behaviour

Reef-associated species hang around the rocks: they cruise past faces, hang off them, peck at
them, and tuck into nooks. A species opts in with a `reef` block in `src/data/species.js`; the
state machine is `src/components/reefBehavior.js`, the rock queries `src/components/reefSites.js`,
and `src/components/Fish.jsx` runs it on the solo-agent path.

What it should feel like: watching a reef, not an aquarium of drifting fish. Each fish has a
patch of rock it keeps to, and the moments at the rock (a nose eased to the face for a gentle
nibble, a fish turning round inside a crevice to look out) are what make the rocks read as
somewhere fish live rather than set dressing.

## Modes

- `patrol`: swim to a point a couple of body lengths off a face, and on. No stop.
- `hover`: settle 1 to 1.6 body lengths off a face and hang there, looking into the reef and
  slowly wandering its heading (`hoverSeconds`).
- `peck`: settle with the snout `peckGapBodyLengths` off the face, then a few gentle `pecks`:
  ease in (`lungeSeconds`), nibble (`biteSeconds`, with a small head shake of
  `biteShakeDegrees`), ease back (`recoilSeconds`, `recoilBodyLengths` past the rest point),
  rest (`peckRestSeconds`). In and out both ease at each end: a gentle peck, not a strike
  (Jeremy, dev_12). Each peck lands on a fresh spot found on the drawn rock, a little way along
  the face.
- `shelter`: settle nose-in to the most enclosed nook the search finds, turn round on the spot to
  face out, and wait (`shelterSeconds`). A sheltered fish does not startle.

Each decision a free reef fish makes goes to the reef with probability `affinity`, split by
`modes` (weights, normalised); the rest are ordinary open-water swims, kept within its home range.
After a startle, the next decision is a shelter with probability `startleShelterChance`. A
shelter search that finds no nook falls back to a hover.

## Stages

1. `travel`: the unified pipeline steers to the site's entry point, a level line-up
   `max(1.5 WU, 2.2 BL)` out from the rest point, slowing to 60% of cruise over the last three
   body lengths. Within 1.6 entry distances of the rest point, once a ray shows the way in is
   clear, it settles. It gives up after the travel timeout, or if it fails to close half a body
   length on the entry in 3 s.
2. `settle`: a Hermite curve from the fish's pose to the rest point, arriving facing the face.
3. `hold` (hover, shelter) or `peck`.
4. `leave`: turn on the spot toward a direction out from the face and 25° to 70° to one side
   (backing off the face while still facing it), swim out, and hand back to the pipeline.

Stages 2 to 4 own position and facing outright, like the Mola's sun-bask hold. That is the one
exception to the unified pipeline here: the rock proxies' padding would keep a snout off the
rock, and easing back off it moves the fish backwards, which the forward-only integrator cannot do.
Boid forces fade while it is at the rock. The body may tilt up to 35° (the swimming limit is
15°) to graze a sloped face, and does not bank as it turns on the spot.

After leaving, the rock clamp (`pushOutOfRocks`) comes back over 1.5 s
(`REEF_CLAMP_RECOVERY_SECONDS`), so a fish still inside a proxy's padding eases away instead of
jumping out of it. The same ramp runs when a fish remounts (tank switch).

## Sites

`reefSites.js` raycasts the drawn rocks, not the ellipsoid proxies the fish steer by. Landscape
keeps the placed geometry of every rock inside the landscape's `reefReach` box whole (not merged
into a chunk) and publishes it while the tank is up; each carries a three-mesh-bvh tree.

A site search picks the nearest of three random rocks near home, aims at the side facing the
fish, and casts a nearly level ray at it. The hit is kept if:

- the face is square-on to the ray and its normal's y suits the mode (sides and gentle tops;
  undersides too for shelter);
- the rest point is inside the fish's swim volume, with nothing between it and the face;
- there is `0.55 BL` of free room round the rest point (to turn on the spot);
- the entry point is in the volume, with a clear line in;
- for a shelter, the share of rays meeting rock within `2.5 BL` is at least 0.35: the 8 level
  rays that do not point into the face, plus 3 overhead. The most enclosed of 10 tries wins.

At most one search runs per frame across the tank (others retry next frame), and an empty search
is retried twice before the decision goes to open water. Measured on desktop (2026-10-18): a
peck search takes 0.3 ms median, a shelter search 0.8 ms median and 4.8 ms worst; building the
trees for the 87 reachable rocks takes about 13 ms once per tank mount.

## Spawning

On a fish's first frame (not a remount after a tank switch), `spawnReefBehavior` picks a site
near where it would have spawned and starts it part-way through: hovering, pecking or
sheltering in the species' own mix, with 35% to 100% of the hold left. With chance
`1 - affinity` it starts at the site's entry point instead, swimming past. A pair follower
starts by its mate's rock if the mate is already up. Spawn searches skip the once-a-frame
limit, so the first frame does them all (10.3 ms on desktop with 42 reef fish).

## Home and mates

A fish's home is the first site it finds; most sites are picked within `homeRadiusBodyLengths`
of it, and `newHomeChance` of decisions move house. A new home goes to the middle of the resting
view 60% of the time (`pickViewHome`: 18 to 58 WU out, within 15% of that to either side), else
round where the fish is; and half of all site searches come at a rock from the camera's side and
keep only a spot the camera can see (`viewBias`). Landscape passes the tank's resting view to
reefSites.js for both. A pair follower uses its
mate's position as home. While the leader is at a rock (`reefHold` on its registry entry), the
follower stops station-keeping and does its own reef behaviour nearby; at a rock, a fish finishes
before it rejoins its mate or starts following a host.

## Swim volume

Reef fish use `REEF_BOUNDS` (species.js): down to y -19 (the basin's highest dune crest is
-20.5), back to z -52 (the canyon's front faces) and forward to z +8, among and in front of the
foreground rocks. It is a box ±58 WU wide (`boundsHalfX`; fishSwim.js `halfXAt`) rather than
the shared wedge, which narrows toward the old camera at z 12 and would keep them off the
foreground rocks on the right. Toward the front the sand rises above y -19 (to -18.1 at z +6),
so every fish is kept above the sand (rockObstacles.js `liftAboveSeabed`), open-water targets
are lifted out of it, and reef sites must clear it. Rocks a fish cannot reach from its volume
are never picked.

## Tuning

Every `reef` key overrides `REEF_DEFAULTS` in `reefBehavior.js`. A life stage can carry its own
`reef` block (the juvenile emperor angelfish shelters most). The debug label shows
`reef <mode> <stage>`, with the peck phase and pecks left; `getFishEntry(id).reef` exposes the
live state for console checks.

## Known limits

- The landscape has no caves. Shelters are concave spots between and under ledge tiers, which
  small fish find often and fish over about 1.5 BL rarely (a 2 BL fish found one in 0 of 40
  searches).
- The resting view (dev_10, Jeremy's diver-camera pose at x 12, z 25.2, turned 9.5° left) sees
  the foreground rocks, the mid-ground outcrop (seeds 81 and 82 in landscapes.js) and the canyon.
  Measured after the fish settle (in frame, not behind rock, within 60 WU): desktop sees 38% of
  the reef fish and 17% of those at a rock, a 375 px phone 16% and 8%; 59% of the fish at a rock
  are at the foreground rocks. Much of the reef activity is still out of frame or behind the near
  rocks.
