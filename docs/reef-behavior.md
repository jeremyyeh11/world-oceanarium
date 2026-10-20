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
- `peck`: settle with the snout `peckGapBodyLengths` off the face, then one or two gentle
  `pecks` at the same spot: ease in (`lungeSeconds`), nibble (`biteSeconds`), ease back
  (`recoilSeconds`, `recoilBodyLengths` past the rest point), rest (`peckRestSeconds`); then
  hang about a little further off the spot (`afterPeckHoverSeconds`) and move on. The fish faces
  the site steadily the whole visit, with no head shake and no re-aiming at the rock's facets:
  "in out, hover around, move on" (Jeremy, dev_13). Each peck lands on a fresh spot found on the drawn rock, a little way along
  the face.
- `shelter`: settle nose-in to the most enclosed nook the search finds, turn round on the spot to
  face out, and wait (`shelterSeconds`). A sheltered fish does not startle.

Each decision a free reef fish makes goes to the reef with probability `affinity`, split by
`modes` (weights, normalised); the rest are ordinary open-water swims, kept within its home range
and given up when they stop closing on the destination (see Pinches between rocks).
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
- the entry point is in the volume, with a clear line in, and outside every rock's and table's
  padded steering shape (rockObstacles.js `insideRock`, the query's `reachable`): the steering
  keeps a fish out of that padding, so it would circle short of an entry inside it and give up.
  It is tried at 1, then 0.6, then 1.6 entry distances out;
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

## Corals

Where a landscape has table corals (`corals` in landscapes.js, placed by coralPlacement.js), the
reef fish use them as well as the rock (Jeremy, 2026-10-19: "build fish behavior to interact with
the corals, hide underneath, within, peck at it"). The tables join the surfaces the site search
raycasts (`setCoralSurfaces` in reefSites.js, beside the rocks' `setReefSurfaces`): one surface per
table inside `reefReach`, built from its `_lo` mesh (700 triangles, 300 for the small table) with a
BVH tree, and kept for the session with the placement. Every ray meets coral as it meets rock, so
lines in, room to turn and enclosure all see the plates.

Each reef decision picks its kind first: a coral with the mode's share in the species' `coral`
block (`REEF_DEFAULTS.coral`: patrol 0.35, hover 0.5, peck 0.6, shelter 0.6), else rock. A coral
search asks for that kind only (`query.kind`) and aims by mode (`query.aim`):

- shelter, `under`: the level ray aims at the stalk, below the plate's underside. The rest point
  lands under the plate (hiding underneath) or between two stacked tiers (within), and is kept
  only with a surface straight overhead (`requireCover`). The plate overhead is what hides the
  fish, so a coral shelter needs less enclosure than a rock nook (0.25, against 0.35).
- peck, hover, patrol, `rim`: the ray aims at the plate's rim height from outside, so the fish
  nibbles along a plate's edge or hangs off it. A rim is a narrow target: coral searches get 12
  tries (8 for rock).

A coral search that finds nothing tries the same move on rock the next frame. The site's kind is
on the reef state (`siteKind`) and in the debug label (`reef shelter hold coral`).

By species (species.js `reef.coral`): the grouper hides under the tables most (0.8) and hangs by
them in ambush (0.5), after Kerry & Bellwood (2012): large reef fishes, coral trout among them,
used table corals at least three times as much as branching or massive ones. The juvenile emperor
angelfish shelters under them (0.7); the adult nibbles their rims (0.65); the bannerfish hangs by
them (0.6); the clown triggerfish, whose prey is on the rock, seldom pecks them (0.1) but takes
cover under them (0.5).

A rest point under a plate is inside the plate's padded steering ellipsoid (rockObstacles.js
`setExtraObstacles`); stages 2 to 4 own the pose there, and on leaving the rock clamp eases back
in over 1.5 s as it does at a rock. The entry point is not: it must be outside every padded shape
(see Sites), which the 1.6 entry-distance try gets past a plate over a sheltering fish.

Measured on desktop (2026-10-19, `v0.30.1-dev_1`):

- Shares: over about 90 s, corals took 7 of 11 shelters, 10 of 21 hovers and 4 of 18 pecks, and
  5 of the grouper's 6 visits. Coral trips settle as often as rock ones (59% against 62%).
- Leaving: the fastest move in the first 2 s after leaving a coral was 8 WU/s (rock 8.4), with no
  jumps.
- Searches: a coral shelter 1.4 ms median and 3.3 ms worst (rock 1.9 and 4.2), a coral rim
  0.4 and 1.4 ms (rock 0.3 and 1.1); 44% of coral shelter searches find a spot (rock 18%).
- In view: the clusters stand in front of the resting camera, so a fish at a coral is on screen
  and not hidden by rock 66% of the time on desktop (a fish at rock 17%) and 45% on a 375 px
  phone (rock 31%).

## Swim volume

Reef fish use `REEF_BOUNDS` (species.js): down to y -19 (the basin's highest dune crest is
-20.5), back to z -52 (the canyon's front faces) and forward to z +8, among and in front of the
foreground rocks. It is a box ±58 WU wide (`boundsHalfX`; fishSwim.js `halfXAt`) rather than
the shared wedge, which narrows toward the old camera at z 12 and would keep them off the
foreground rocks on the right. Toward the front the sand rises above y -19 (to -18.1 at z +6),
so every fish is kept above the sand (rockObstacles.js `liftAboveSeabed`), open-water targets
are lifted out of it, and reef sites must clear it. Rocks a fish cannot reach from its volume
are never picked.

## Pinches between rocks

Fish steer by each rock's ellipsoid padded for the body (rockObstacles.js, `rockPad`: 0.35 BL +
0.3 WU). Where two rocks stand closer together than that, their pads overlap. At the foot of the
two foreground bommies (x -3 and 3.2, z 1 to 1.5), a clown triggerfish's pads (0.95 WU) overlap
by about 0.27 WU at the swim floor: a small lens whose nearest way out is below the floor.

Up to `v0.30.2`, a fish that nosed in there could stay for minutes, its heading flicking about 60
times a second and its body jumping 3.5 cm between two spots every frame (a clown triggerfish for
over 3 minutes and a bannerfish for 47 s on 2026-10-19; a grouper for 4.5 minutes in the
measurement run). A per-frame trace showed four things holding it there:

- The rock clamp pushed the fish out of the deeper pad onto that pad's surface, which lay inside
  the other pad. The next frame it pushed the fish back out of the other one. The push went out
  from the rock's centre, which is above the floor, so it also took the fish 2.7 cm below the
  floor, and the swim clamp lifted it back.
- Each push slid the heading along that rock's face (its into-rock part removed). The two faces
  took back every two frames what the turn toward the destination had gained. A grouper whose
  destination was up and to the right stayed pointing 72° down.
- The rock bend in the steering came after the swim-wall clip, so it could still point the heading
  into the floor.
- An open-water swim ended only on arrival.

Since `v0.30.3-dev_1`:

- Pushed out level at the floor: `pushOutOfRocks` takes the swim floor and never pushes a fish
  through it. Where the push from the centre would, the fish goes out level instead, across the
  rock's section at its own height, and its heading slides along that section's face.
- No step into a pinch: `pushOutOfRocks` also takes where the fish started the frame and the face
  it was last pushed off (within `ROCK_CONTACT_MEMORY_SECONDS`). A pinch is a push whose point
  is still inside another pad, or a push off a face turned more than about 105° from the last
  one (`WEDGE_DOT`: the two pads meet in a wedge, and out of one face is into the other the next
  frame). There the fish takes only the part of its step that goes into neither face (along the
  crease between them where it goes into both), so it slides along a gap, or up and out of it,
  where it can; where nothing is left it stays where it started the frame, held. Either way the
  clamp leaves its heading to the steering. A fish that started inside two pads (just off a reef
  site in a nook) is still pushed out of the deeper one a frame at a time, its heading sliding
  along that face, as before (left alone, it pressed on into the padding and came out of a nook
  in twice as many jumps of 0.1 WU). A plain hold was tried first: a juvenile angelfish caged between a coral table on
  one side and the outcrop and another table on the other could not get out of it in any
  direction it turned, and stayed for 112 s.
- One bend for overlapping pads: the rock bend steers by the depth-weighted sum of the normals of
  every pad the probe is in (`summedHit`), so in an overlap it points out of the gap instead of at
  one rock and then the other. With one pad it is that pad's normal, as before. A fish at a pinch
  skips the probe ahead (`steerAroundRocks`, `lookAhead`) and steers by where it is going and
  the push off the rocks it touches: probing on into the gap, the bend slid it along the gap and
  outweighed a destination behind it two to one, so a grouper stayed held for a minute.
- The floor: the swim-wall clip (`shapeDirectionForBoundaryContacts`) runs after the rock bend,
  a fish at a pinch keeps the wall contacts of where it ended up (held on the floor, it is still
  on it), and on the floor (within `FLOOR_BAND`) the rock bend loses its downward part: below a
  rock's middle its push-off points down, and pressed into the floor a fish's heading flicked on
  and off the floor contact every other frame.
- Giving up: held at a pinch (sliding on by less than a tenth of its step, `pinchedLastPush`)
  for 0.3 s (`ROCK_PINCH_GIVE_UP_SECONDS`, Fish.jsx), a fish gives up its swim or its trip to a
  rock and decides again at once. The next swim is picked in the half behind it, back the way it
  came (a destination ahead mostly lay past the same gap), and is not pulled into its home range
  (a home past the gap led it straight back in); it has 1.5 s to come round before it would give
  up again (`ROCK_PINCH_TURN_SECONDS`). A pair follower whose station is past the gap spends a
  spell apart from its mate instead (fishSwim.js `separatePair`), as pairs now and then do anyway.
- Stall check: a reef fish's open-water swim that has not closed half a body length on its
  destination in 3 s is given up as well (`STEER_PROGRESS_*`), as its trips to a rock already
  were. The first check also allows for the turn toward the destination (its angle off the
  heading over the turn rate at cruise).
- After a give-up it has time to come round before it gives up again: a U-turn at the pinch's
  raised turn rate, at least `ROCK_PINCH_TURN_SECONDS`. And if it has given up three times
  without getting clear of pinches for 2 s (`ROCK_PINCH_GIVE_UPS`), it squeezes through: for
  2 s the clamp only pushes it out of the deeper rock, as before pinches were handled. A
  bannerfish was once held 85 s between two tiers of the foreground stacks, turning back 51 times.

Measured on desktop (2026-10-19, The Reefs, `creatures_dev`: 24 emperor angelfish, 12
bannerfish, 3 clown triggerfish, 3 groupers), the changes switched off and on in alternating
blocks of one session, two sessions of about 11 and 12 minutes each way:

- Pinned: with the changes off, three fish stayed for 2 to 4.3 minutes, two triggerfish at the
  foot of the bommies and a bannerfish among the outcrop's coral tables; each was out within
  seconds of the changes coming on. With them on, no fish stayed in one place off a reef site for
  more than 13 s, but for the bannerfish held 85 s that led to the squeeze-through; a third
  session with it (8 minutes, changes on) had none over 7 s, and the squeeze-through fired once.
- Stuck episodes (a fish with over 100 heading flips, more than 2° a frame each way, in 10 s):
  35 in 22 minutes off (1.6 a minute, the longest 132 s), 19 in 23 minutes on (0.8 a minute, the
  longest 17 s). All of those left are fish shivering on the move past a rock (see Known limits).
- Heading flips per fish-minute: 37 and 81 off (pins included), 14 and 14 on; near rocks 103 and
  241 off, 31 and 31 on.
- Trips to a rock settled as often either way: 69% of 1,213 off, 69% of 1,226 on.
- Pops (a frame's step over four times the last): 15 off and 9 on in the second session; the
  only one over 0.1 WU with the changes on was a grouper's hand-back from a reef pose (see Known
  limits).

Staged, the reported case: a grouper or triggerfish put at the foot of the bommies nose into the
gap, its destination through it. Before, it stayed for minutes at 60 flips a second; now each was
out in 1.7 to 3.6 s (held a moment, gave up, turned round, or slid up the crease and over), with
0 to 20 heading flips (once 59). Two young angelfish put in the coral cage slid out in 4 s.

## Steering past rocks

`steerAroundRocks` (rockObstacles.js) probes ahead along the heading at four points (0.2, 0.45,
0.7 and 1 of its reach, 3 BL or 1.5 s of travel, at least 3 WU, plus the pad) and bends the
desired heading along the rock it meets and away from it. Fish.jsx smooths the bend per fish
(`ROCK_AVOID_RISE` 10/s, `ROCK_AVOID_FALL` 2.5/s).

Up to `v0.30.3-dev_1` the probe either hit a pad or missed it, and a hit bent the heading in
full at once (urgency at least 0.2, more for the nearer probe points). A fish skimming a rock
held its heading where the probe tip sat on the pad's outline, and a per-frame trace (desktop,
The Reefs) showed the tip landing in and out of the pad on alternate frames: 65% of a young
angelfish's flips came with the probe switching between hit and miss, the rest with it switching
between two pads whose pushes pointed opposite ways, a rock above and a small obstacle below.
The smoothing's quick rise and slow fall turned each in-out pair into a 2° to 5° flick of the
heading, frame after frame, for seconds. A thin coral table did the same on its own: in its
middle the probe's side flips between above and below, and so did the bend's vertical part.
The clamp, pinches and the push off a rock the fish is brushing played no part.

Since `v0.31.4-dev_1` the probe feels a rock gradually (`feltHit`):

- Each pad counts from a band outside its padded surface to the same depth inside, ramping from
  nothing to full strength (`PROBE_FEEL_ANGLE`: the band is 0.15 rad wide as seen from the fish,
  so about 0.05 WU at the nearest probe point and 0.26 WU at the farthest for a young angelfish).
  The bend fades to nothing at a rock's outline instead of switching on there, and a fish
  skimming a rock settles on a steady small bend.
- Overlapping pads add up by their ramps, so the push from one rock fades out as the probe
  leaves it rather than handing over to the other's in full.
- Every probe point that feels a rock bends the heading, weighted by the square of its urgency,
  so the strongest leads; before, only the nearest hit counted, and the urgency jumped when the
  nearest hit moved from one point to the next.
- A pad's vertical push points to the fish's side of its middle, not the probe's
  (`SIDE_BAND`: within a quarter of the padded half-height of the middle it fades to level), and
  is at least half the padded half-height strong (`SIDE_FLOOR`). A fish above a coral table pulls
  up over it and one below dips under it; before, a fish above heading down through a table was
  bent further down once its probe passed the table's middle. A tall rock's push stays nearly level.
- The push off a rock the fish is brushing comes on over the first tenth of the padding
  (`TOUCH_ONSET`) instead of at half strength at once.

Heading straight at a rock's middle, the side to turn to is still a choice (the side the
desired heading leans to).

TBD-MEASURED

## Tuning

Every `reef` key overrides `REEF_DEFAULTS` in `reefBehavior.js` (`modes` and `coral` merge key by
key). A life stage can carry its own `reef` block (the juvenile emperor angelfish shelters most).
The debug label shows `reef <mode> <stage>`, `coral` when the site is on one, and the peck phase
and pecks left; `getFishEntry(id).reef` exposes the live state for console checks (import the
module through the app's own `?t=` URL, from `performance.getEntriesByType('resource')`: a bare
import of an edited module loads a second, empty copy).

## Known limits

- Shivering on the move: a fish brushing past a rock still flicks its heading 2° to 5° a frame
  for a few seconds now and then, mostly young emperor angelfish round the foreground stacks.
  The probe ahead hits the rock one frame and misses it the next, and a thin coral table's
  normal flips between up and down as the probe crosses its middle. All the stuck episodes left
  in the measurements above are of this kind.
- Jumps on the way back from a reef pose: a hover or shelter can leave a fish outside its swim
  volume or under the sand, and the first frame back on the pipeline snaps it in (0.1 to 0.8 WU,
  seen with and without the pinch changes).

- The landscape has no caves. Shelters are concave spots between and under ledge tiers, which
  small fish find often and fish over about 1.5 BL rarely (a 2 BL fish found one in 0 of 40
  searches).
- The resting view (dev_10, Jeremy's diver-camera pose at x 12, z 25.2, turned 9.5° left) sees
  the foreground rocks, the mid-ground outcrop (seeds 81 and 82 in landscapes.js) and the canyon.
  Measured after the fish settle (in frame, not behind rock, within 60 WU): desktop sees 38% of
  the reef fish and 17% of those at a rock, a 375 px phone 16% and 8%; 59% of the fish at a rock
  are at the foreground rocks. Much of the reef activity is still out of frame or behind the near
  rocks.
