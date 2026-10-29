# Fish queue

Species that are named for the oceanarium but not swimming in it yet. Check this list before
starting any new species. When a species swims in a reserve in a clean release and has its
Atlas tile ([new-species-checklist.md](new-species-checklist.md)), move its line to
[Done](#done) with the version and PR; never delete it. No species repeats across reserves.

## Next up: one a day, days 23–30

Jeremy's order for the end of the one-creature-a-day series (agreed 2026-10-29). Work them in
this order unless he changes it. The corals and the clam are meant to complete The Reefs by
day 30. Day 22, the White Suckerfish, is in progress on `species/remora-albescens`.

1. **Day 23 (Oct 30): Brain Coral** (*Platygyra daedalea*), The Reefs. Static hard coral,
   boulders on the bommies.
2. **Day 24 (Oct 31): Common Remora** (`remora-remora`), The Open Sea. Rides the mako and the
   whale shark. Entry already written (below).
3. **Day 25 (Nov 1): Cauliflower Coral** (*Pocillopora*, species to choose), The Reefs.
   Static hard coral, built with the staghorn's kit script.
4. **Day 26 (Nov 2): Bluefin Trevally** (*Caranx melampygus*), The Reefs. Escorts the
   humphead wrasse, on the golden trevally's escort code.
5. **Day 27 (Nov 3): Leather Coral** (*Sarcophyton*, species to choose), The Reefs. Soft
   coral on the sea fan's sway shader.
6. **Day 28 (Nov 4): Spearfish Remora** (`remora-brachyptera`), The Reefs. Rides the Mola.
   Entry already written (below).
7. **Day 29 (Nov 5): Giant Clam** (*Tridacna gigas*), The Reefs. Static landscape piece in
   the sand between bommies.
8. **Day 30 (Nov 6): East Pacific Green Turtle** (*Chelonia mydas*), The Shallows. The
   finale; needs a new flipper motion type, built in one day.

Three more corals crowd the bommie tops: each coral release checks how many of every coral
still fit (placement order matters; the sea fans go before the staghorn).

After day 30: golden cownose ray, sailfish (then the marlinsucker on it), reef manta.

## Queued: species entry in `src/data/species.js`, no model

### Remoras awaiting their models

These keep their researched entries (facts, Atlas copy, `hitchhiker` ride data) but have no
model, are on no tank and are out of the Atlas. They need Jeremy's GLB, then the remora
intake in [ride-hosts.md](ride-hosts.md) (`node scripts/fit-rider-model.mjs <id>`), a tank
slot and `creatures_dev` rows. Their generated stand-ins were removed in `v0.37.0-dev_2`.

- **White Suckerfish** (`remora-albescens`, 30 cm, LC). Rides manta rays almost exclusively,
  often inside the mouth and gill chambers. Best home: The Shallows, on the Giant Oceanic
  Manta (its `rideHost` is escort-only: it needs anchors fitted to its mesh; mouth riding is a
  separate roadmap item).
- **Common Remora** (`remora-remora`, 86 cm, LC). Day 24. Rides sharks first, also turtles, whales
  and large fish. Fits the open sea, on the mako and whale shark.
- **Spearfish Remora** (`remora-brachyptera`, 50 cm, LC). Day 28. Rides billfish, also sunfish:
  was on The Reefs for its Mola.
- **Marlinsucker** (`remora-osteochir`, 40 cm, LC). Rides billfish only; needs a marlin or
  swordfish first.
- **Whalesucker** (`remora-australis`, 76 cm, LC). Rides whales and dolphins only; needs a
  cetacean first.
- **Slender Suckerfish** (`phtheirichthys-lineatus`, 76 cm, LC). Rides barracuda, also
  turtles; needs one of those first.

## Planned: named, no entry yet

From the October species series and the reserve plans. Check range, IUCN status and the
27 cm size floor before starting one.

- The Shallows: golden cownose ray (*Rhinoptera steindachneri*), East Pacific green turtle,
  round stingray (*Urobatis halleri*), California sea lion (later).
- Escorts: cobia, rainbow runner; barberfish and cleaner wrasse fall under the size floor.
  Cobia is absent from the eastern Pacific, so not for The Shallows.
- Hosts: reef manta (*Mobula alfredi*, The Reefs), Mola mola, swordfish, spinner dolphin,
  dugong. Turtles, dolphins and the dugong need new motion types.
- Deep sea and oddities: needs a deep-sea reserve first; barreleye, mantis shrimp and the
  immortal jellyfish fall under the size floor.

## Done

Species that left the queue, newest first ([species-preparation.md](species-preparation.md)).

- **Golden Trevally** (`gnathanodon-speciosus`): clean `v0.41.0` (#173), six in The Shallows.
- **Yellowfin Tuna** (`thunnus-albacares`): clean `v0.40.0` (#168), The Open Sea.
- **Bluespine Unicornfish** (`naso-unicornis`): clean `v0.39.0` (#165), The Reefs.
