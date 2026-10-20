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
jumping out of it. The same ramp runs when a fish remounts (tank switch). See Back on the
pipeline for how the clamps treat a fish that a pose has left inside the padding, outside its
swim volume or under the sand.

## Back on the pipeline

The first frames after a reef pose (and after a cleaner leaves its host, see `docs/ride-hosts.md`)
start the fish somewhere the pipeline's clamps would not have let it go: inside a rock's padding
(a rest point a nose off the face always is), sometimes inside two pads at once in a nook, now and
then outside the swim volume or under the sand pad. Until `v0.31.6-dev_1` the clamps put it back
in a frame. A per-frame trace of the pipeline stages (desktop, 2026-10-20) found:

- The rock clamp, easing in, flicked a fish between two overlapping pads for up to half a second
  in the first second back: from inside, `pushOutOfRocks` took it to the deepest pad's surface,
  which lay inside the other pad, and the next frame the other pad was the deepest. 0.1 to 0.27 WU
  a frame each way (a grouper back from a hover at the outcrop, x 3.9, y -16; angelfish and a
  bannerfish at the foreground bommies). This was most of the hand-back jumps.
- The swim clamp and the sand lift snapped in a fish a hover or shelter had left beyond the back
  wall or under the sand pad (0.1 to 0.8 WU, seen 2026-10-19; in 50 minutes of tracing on
  2026-10-20 they moved a fish 0.03 WU at most).

Since `v0.31.6-dev_1`:

- The swim clamp, the sand lift and a host's clearance never take a fish further from where it
  began the frame than its own step plus a return speed (Fish.jsx `limitClampCorrection`:
  `CLAMP_RETURN_SPEED` 1.2 WU/s; the host clearance 2.4 WU/s). A fish that began the frame inside
  is stopped at a wall, or pushed back along its own step, exactly as before; one that began it
  outside comes back in at most that much faster than it swims, instead of being snapped in. The
  rock clamp does the same for a fish that began the frame inside the padding while it eases in
  after a reef pose (`clampBlend` below 1, `startedInsideLastPush`). Not elsewhere: capped
  everywhere, a fish pressing on into a rock stayed just inside it frame after frame, and clown
  triggerfish flicked their heading about twice as often.
- From inside overlapping pads, the rock clamp moves the fish along the depth-weighted sum of the
  pads' normals (`easeOutAlongSummedNormal`, the same sum as the rock bend's `summedHit`), at
  most a capped step a frame and scaled by how far the normals agree. The sum turns smoothly as the
  fish moves, down the pads' summed depth and out along the crease between them; where the pulls
  cancel (the middle of a gap, level at the floor) the push fades and the fish leaves along the
  crease on its own steering, as a full step there overshot the balance and the next pulled it
  back (2 cm a frame each way). A fish squeezing through a pinch (`ROCK_PINCH_GIVE_UPS`) is pushed
  out of the deeper rock as before.

Measured on desktop (2026-10-20, The Reefs, `creatures_dev`: 24 emperor angelfish, 12 bannerfish,
3 clown triggerfish, 3 groupers, 18 pilot fish, the sunfish). A jump here is how far a frame moved
the fish beyond its own swim step, in the 2.5 s after it left a reef pose (or its host changed,
`docs/ride-hosts.md`):

- The changes switched off and on in alternating 3.5-minute blocks of one session after a
  2.5-minute warm-up, 13.2 minutes off and 10.5 on (the rock cap then still applied everywhere):
  hand-backs over 0.1 WU in 13 of 435 off (the largest 0.20), 0 of 387 on (the largest 0.038).
  Pops (a frame's step over four times the last) 1.13 a minute off, 0.29 on. Reef trips settled
  59% of 708 off and 66% of 557 on (59 to 69% across three sessions either way).
- The code as shipped, before #144's probe change (`v0.31.5`; the clamps are the same), 13.8
  minutes on a fresh load: 481 hand-backs, none over 0.05 WU (the largest
  0.038); 0.43 pops a minute; trips settled 62%; heading flicks a fish-minute 15 for the
  angelfish, 9 bannerfish, 17 triggerfish (10 to 14 without the changes), 0.5 groupers.
- On `v0.31.5` (with #144's probe), 11.9 minutes: 409 hand-backs and 430 cleaner host changes,
  none over 0.05 WU.

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

## Coral forms

Reef fish use the corals as well as the rock. Coral behaviour is split by the coral's growth
form, not its species, the way docs/procedural splits motion by architecture: a second table
coral is a `table`, a second branching coral a `thicket`. A new coral needs a new form only if its
shape offers fish something no form covers. Jeremy (2026-10-19): "build fish behavior to interact
with the corals, hide underneath, within, peck at it"; (2026-10-20) "there should be some sort of
universal behavior to govern all fish interaction with various coral types".

Forms:

- `table` (tabular corals; Hyacinth Table Coral): a plate on a stalk, cover overhead, a rim,
  tiers. Implemented (`v0.30.1`).
- `thicket` (branching corals; Staghorn Coral): a patch of colonies, a crown of branch tips,
  flanks, narrow gaps inside. Implemented (`v0.31.4`).
- `mound` (massive, brain and encrusting corals): a solid surface like rock, an overhang at the
  base. Proposed; no model yet.
- `fan` (gorgonians, sea whips, soft corals): a flat, bendy lattice. Proposed.
- `host` (anemones): a home for one symbiont, closer to docs/ride-hosts.md. Proposed; needs its
  own design.

The four modes at each form (`CORAL_FORMS` in reefBehavior.js; `aim` is the site search's
`query.aim` in reefSites.js):

- shelter: under a table's plate or between two tiers (`under`, with a surface straight overhead,
  `requireCover`, and enclosure 0.25 against a rock nook's 0.35); in among a thicket's branches
  (`inside`, fish up to 0.8 WU, enclosure 0.4); a mound's overhang (proposed).
- peck: along a table's rim (`rim`); a thicket's outer branches (`flank`); a mound's surface
  (proposed).
- hover: beside a table's rim (`rim`); over a thicket's crown, 0.7 to 1.2 body lengths above the
  tips, level and 12° nose-down, looking across it (`crown`, 60% of thicket hovers), or beside its
  flank (`flank`).
- patrol: past a table's rim (`rim`); right over a thicket's crown (`crown` with `passOver`: the
  pass point rises up to 1.5 WU until it clears the colonies' padded steering shapes).

Universal rules, every fish at every form:

1. Solid: every coral blocks the site rays as rock does, so lines in, room to turn and enclosure
   all see it. Each form publishes its surfaces with `setCoralSurfaces(geometries, metas)` (each
   meta has its `form`); any number of sets can be up at once.
2. Fit: a fish goes into a structure only where it has room to turn on the spot (0.55 body
   lengths); the gaps decide who fits, not a species list. `maxBodyLengthWU` only saves searches
   that cannot succeed.
3. Steer: every coral is in the obstacle field (rockObstacles.js `setExtraObstacles`).
4. Choose: each decision picks its mode, then rock or a form by the species' share for that mode
   (`reef.corals.<form>.<mode>`, defaults in `REEF_DEFAULTS.corals`); what is left goes to rock.
   A form the tank lacks takes no share.
5. Fall back: a coral search that finds nothing tries the same move on rock the next frame.

The site's form and aim are on the reef state (`siteKind`, `siteAim`) and in the debug label
(`reef hover hold thicket crown`).

### Tables

The tables join the surfaces the site search raycasts: one surface per table inside `reefReach`,
built from its `_lo` mesh (700 triangles, 300 for the small table) with a BVH tree, and kept for
the session with the placement.

- shelter, `under`: the level ray aims at the stalk, below the plate's underside. The rest point
  lands under the plate (hiding underneath) or between two stacked tiers (within).
- peck, hover, patrol, `rim`: the ray aims at the plate's rim height from outside, so the fish
  nibbles along a plate's edge or hangs off it. A rim is a narrow target: table searches get 12
  tries (8 for rock).

By species (species.js `reef.corals.table`): the grouper hides under the tables most (0.8) and
hangs by them in ambush (0.5), after Kerry & Bellwood (2012): large reef fishes, coral trout among
them, used table corals at least three times as much as branching or massive ones. The juvenile
emperor angelfish shelters under them (0.55); the adult nibbles their rims (0.65); the bannerfish
hangs by them (0.45); the clown triggerfish, whose prey is on the rock, seldom pecks them (0.1)
but takes cover under them (0.5).

A rest point under a plate is inside the plate's padded steering ellipsoid; stages 2 to 4 own the
pose there, and on leaving the rock clamp eases back in over 1.5 s as it does at a rock. The entry
point is not: it must be outside every padded shape (see Sites), which the 1.6 entry-distance try
gets past a plate over a sheltering fish.

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

### Thickets

Each staghorn patch (one colour, 12 to 18 interlocking colonies, staghornPlacement.js) is one
thicket to the fish: Landscape.jsx `thicketReefSurfaces` merges its colonies' `_far` meshes (350
to 600 triangles each: the branches where they are, without the close-up detail) into one surface
with a BVH tree, built one patch per slice after the placement (37 patches inside `reefReach`,
119k triangles, 56 ms in all, 1.1 ms median and 3.6 ms worst per patch on desktop). Its meta
carries the patch's middle, crown height and reach, and each colony's base, crown and reach.

A thicket search aims at one of the patch's colonies, not the patch's middle, which is often bare
rock between colonies (aiming at the middle, most rays met rock or a table first):

- `crown`: straight down onto the colony's crown from clear water above the patch; the face is
  taken as pointing straight up, and the fish lines up level from its own (or the camera's) side.
- `flank`: a nearly level ray at the colony's side; the face is the colony's outline (a dome over
  it), not the facet of the branch the ray met, which points anywhere.
- `inside`: a level ray at the colony's heart, kept only where the branch it met is within 0.65 of
  the colony's reach (it slipped in past the outer branches).

Thin branch tips can slip between roomToTurn's eight level rays: one came within 0.09 body
lengths of a bannerfish hanging over a crown. So a thicket spot also needs its room clear in 26
directions over the sphere (`roomAllRound`, a little less above and below, the face skipped except
over a crown), cast only at the surfaces whose boxes come within reach. Thicket searches get 20
tries (16 for a shelter).

By species (species.js `reef.corals.thicket`): the bannerfish hangs over the crowns most (hover
0.4), where a plankton picker feeds, cruises over them (patrol 0.2) and now and then picks at the
outer branches (peck 0.1); the adult angelfish hangs by and cruises past them (0.25, 0.2); the
juvenile angelfish hides in among the branches (shelter 0.3, the only fish small enough) and
hangs by them (0.25); the grouper lies in wait by them far less than by the tables (hover 0.15,
patrol 0.15), after Kerry & Bellwood (2012); the triggerfish only cruises past (patrol 0.2).

Measured on desktop (2026-10-20, `v0.31.4-dev_1`, 42 reef fish, after a 2-minute warm-up):

- Shares: over 5 minutes, thickets took 25 of 235 visits (16 of 95 hovers, 9 of 61 patrols, none
  of 53 pecks or 26 shelters) and 6.4% of the time fish spent at a site; tables 86, rock 124.
  Thicket trips succeed about as often as the others (60%; rock 69%, tables 63%). Pecks and
  shelters at a thicket are rare: the bannerfish's peck share seldom comes up, and about 1 in 9
  juvenile shelter searches finds a spot among the branches.
- Clearance: at a thicket hold, no fish's centre came within 0.26 body lengths of a branch over a
  crown (341 samples) or 0.83 by a flank; before `roomAllRound` one came within 0.09. No jumps.
- Searches (80 each, against the real patches): a crown 1.5 to 1.7 ms median and 6 ms worst,
  finding a spot 58 to 64% of the time; a flank peck 1.1 and 2.6 ms, 39%; a shelter inside 1.3
  and 5.6 ms, 11%. A rock shelter in the same session took 2.9 and 8.4 ms.

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

Up to `v0.31.4`, a fish that nosed in there could stay for minutes, its heading flicking about 60
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

Since `v0.31.5` (built as `v0.30.3-dev_1`):

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
  longest 17 s). All of those left were fish shivering on the move past a rock (see Steering past
  rocks).
- Heading flips per fish-minute: 37 and 81 off (pins included), 14 and 14 on; near rocks 103 and
  241 off, 31 and 31 on.
- Trips to a rock settled as often either way: 69% of 1,213 off, 69% of 1,226 on.
- Pops (a frame's step over four times the last): 15 off and 9 on in the second session; the
  only one over 0.1 WU with the changes on was a grouper's hand-back from a reef pose (see Back
  on the pipeline).

Staged, the reported case: a grouper or triggerfish put at the foot of the bommies nose into the
gap, its destination through it. Before, it stayed for minutes at 60 flips a second; now each was
out in 1.7 to 3.6 s (held a moment, gave up, turned round, or slid up the crease and over), with
0 to 20 heading flips (once 59). Two young angelfish put in the coral cage slid out in 4 s.

## Steering past rocks

`steerAroundRocks` (rockObstacles.js) probes ahead along the heading at four points (0.2, 0.45,
0.7 and 1 of its reach, 3 BL or 1.5 s of travel, at least 3 WU, plus the pad) and bends the
desired heading along the rock it meets and away from it. Fish.jsx smooths the bend per fish
(`ROCK_AVOID_RISE` 10/s, `ROCK_AVOID_FALL` 2.5/s).

Up to `v0.31.4` the probe either hit a pad or missed it, and a hit bent the heading in
full at once (urgency at least 0.2, more for the nearer probe points). A fish skimming a rock
held its heading where the probe tip sat on the pad's outline, and a per-frame trace (desktop,
The Reefs) showed the tip landing in and out of the pad on alternate frames: of a young
angelfish's 116 flips in one episode, 75 came with the probe switching between hit and miss and
41 with it switching between two pads whose pushes pointed opposite ways, a rock above and a
small obstacle below.
The smoothing's quick rise and slow fall turned each in-out pair into a 2° to 5° flick of the
heading, frame after frame, for seconds. A thin coral table did the same on its own: in its
middle the probe's side flips between above and below, and so did the bend's vertical part.
The clamp, pinches and the push off a rock the fish is brushing played no part.

Since `v0.31.5` (built as `v0.31.4-dev_1` on `fix/reef-rock-shiver`) the probe feels a rock gradually (`feltHit`):

- Each pad counts from a band outside its padded surface to the same depth inside, ramping from
  nothing to full strength (`PROBE_FEEL_ANGLE`: the band is 0.15 rad wide as seen from the fish,
  so for a young angelfish it reaches 0.05 WU either side of the padding at the nearest probe
  point and 0.26 WU at the farthest).
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

Measured on desktop (2026-10-20, The Reefs, `creatures_dev`: 24 emperor angelfish, 12
bannerfish, 3 clown triggerfish, 3 groupers, 18 pilot fish), the change switched off and on in
alternating 3-minute blocks of one session after a dropped warm-up, 15 minutes each way:

- Stuck episodes at rocks (over 100 heading flips, more than 2° a frame each way, in 10 s): 10
  off (0.66 a minute, the longest 28.6 s), none on.
- Heading flips per fish-minute: 30.4 off, 7.0 on (reef fish 38.0 and 6.2).
- Trips to a rock settled as often: 67.9% of 744 off, 67.6% of 753 on (patrols left out).
- Pops (a moving fish's frame step over four times the last, frame hitches left out): 24 off,
  23 on; over 0.1 WU 4 and 5, all fish just back from a reef pose (see Known limits).

## Tuning

Every `reef` key overrides `REEF_DEFAULTS` in `reefBehavior.js` (`modes` and each form's shares in
`corals` merge key by key). A life stage can carry its own `reef` block (the juvenile emperor
angelfish shelters most). The debug label shows `reef <mode> <stage>`, the coral form when the
site is on one (`table`, `thicket`, and `crown` over a thicket's crown), and the peck phase
and pecks left; `getFishEntry(id).reef` exposes the live state for console checks (import the
module through the app's own `?t=` URL, from `performance.getEntriesByType('resource')`: a bare
import of an edited module loads a second, empty copy).

## Known limits

- Heading straight at a rock's middle, the side a fish turns to is still a choice (see Steering
  past rocks). Shivering on the move past a rock, the last kind of stuck episode in the pinch
  measurements, is gone since `v0.31.5`.
- A fish a pose leaves outside its volume or under the sand pad stays there for a few frames while
  it eases back in (see Back on the pipeline); the poses themselves are not yet kept inside.
- A grouper settling in moves up to 0.13 WU a frame along the settle curve (an arrival at speed,
  within the pose, not a jump).

- The landscape has no caves. Shelters are concave spots between and under ledge tiers, which
  small fish find often and fish over about 1.5 BL rarely (a 2 BL fish found one in 0 of 40
  searches).
- The resting view (dev_10, Jeremy's diver-camera pose at x 12, z 25.2, turned 9.5° left) sees
  the foreground rocks, the mid-ground outcrop (seeds 81 and 82 in landscapes.js) and the canyon.
  Measured after the fish settle (in frame, not behind rock, within 60 WU): desktop sees 38% of
  the reef fish and 17% of those at a rock, a 375 px phone 16% and 8%; 59% of the fish at a rock
  are at the foreground rocks. Much of the reef activity is still out of frame or behind the near
  rocks.
