# Fish queue

Species that are named for the oceanarium but not swimming in it yet. A species leaves this
list when it swims in a reserve and has its Atlas tile ([new-species-checklist.md](new-species-checklist.md)).
No species repeats across reserves.

## Prepped: waiting for Jeremy's model

- **Giant Sea Fan** (`annella-mollis`, a soft coral up to 2 m, IUCN Not Evaluated). Landscape
  species for The Reefs, like the Acroporas: no creature rows. Species entry (hidden), placement
  (`src/components/seaFanPlacement.js`), sway (`src/utils/coralSway.js`), Atlas pose and the kit
  script are in (`v0.38.0-dev_1`); landscapes.js `seaFans.pending` keeps it off. Needs his
  `_blender models/annella mollis.glb` to the contract in
  [procedural/coral-sway.md](procedural/coral-sway.md), then that doc's intake checklist.

## Queued: species entry in `src/data/species.js`, no model

These keep their researched entries (facts, Atlas copy, `hitchhiker` ride data) but have no
model, are on no tank and are out of the Atlas. They need Jeremy's GLB, then the remora
intake in [ride-hosts.md](ride-hosts.md) (`node scripts/fit-rider-model.mjs <id>`), a tank
slot and `creatures_dev` rows. Their generated stand-ins were removed in `v0.37.0-dev_2`.

- **White Suckerfish** (`remora-albescens`, 30 cm, LC). Rides manta rays almost exclusively,
  often inside the mouth and gill chambers. Best home: The Shallows, on the Giant Oceanic
  Manta (needs a `rideHost` on the manta; mouth riding is a separate roadmap item).
- **Common Remora** (`remora-remora`, 86 cm, LC). Rides sharks first, also turtles, whales
  and large fish. Fits the open sea, on the mako and whale shark.
- **Spearfish Remora** (`remora-brachyptera`, 50 cm, LC). Rides billfish, also sunfish:
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
- Escorts: golden trevally, cobia, rainbow runner; barberfish and cleaner wrasse fall under
  the size floor.
- Hosts: reef manta (*Mobula alfredi*, The Reefs), Mola mola, swordfish, spinner dolphin,
  dugong. Turtles, dolphins and the dugong need new motion types.
- Deep sea and oddities: needs a deep-sea reserve first; barreleye, mantis shrimp and the
  immortal jellyfish fall under the size floor.
