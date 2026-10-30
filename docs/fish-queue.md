# Fish queue

Species that are named for the oceanarium but not swimming in it yet. A species leaves this
list when it swims in a reserve and has its Atlas tile ([new-species-checklist.md](new-species-checklist.md)).
No species repeats across reserves.

## Queued: species entry in `src/data/species.js`, no model

The White Suckerfish swims in The Shallows on the giant manta from `v0.42.0-dev_2` (branch
`species/remora-albescens`), so it has left the queue. The Golden Trevally shipped in clean `v0.41.0` (six in The Shallows), so it has left the queue ([species-preparation.md](species-preparation.md)). The Yellowfin Tuna shipped in clean
`v0.40.0` and the Bluespine Unicornfish in `v0.39.0`.

### Remoras awaiting their models

These keep their researched entries (facts, Atlas copy, `hitchhiker` ride data) but have no
model, are on no tank and are out of the Atlas. They need Jeremy's GLB, then the remora
intake in [ride-hosts.md](ride-hosts.md) (`node scripts/fit-rider-model.mjs <id>`), a tank
slot and `creatures_dev` rows. Their generated stand-ins were removed in `v0.37.0-dev_2`.

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
- Escorts: cobia, rainbow runner; barberfish and cleaner wrasse fall under the size floor.
  Cobia is absent from the eastern Pacific, so not for The Shallows.
- Hosts: reef manta (*Mobula alfredi*, The Reefs), Mola mola, swordfish, spinner dolphin,
  dugong. Turtles, dolphins and the dugong need new motion types.
- Deep sea and oddities: needs a deep-sea reserve first; barreleye, mantis shrimp and the
  immortal jellyfish fall under the size floor.
