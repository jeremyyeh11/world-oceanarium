# Fish queue

Every species in the oceanarium, in chronological order: those that shipped, then those still
to come, in the order they will be added. Check this list before starting any new species and
take the next one in [Up next](#up-next) unless Jeremy picks otherwise; a species he names that
is not listed goes in at the point he chooses. When a species swims in a reserve in a clean
release and has its Atlas tile ([new-species-checklist.md](new-species-checklist.md)), move its
line to the end of [Done](#done) with the version and PR; never delete a line. No species
repeats across reserves.

## Done

Oldest first ([species-preparation.md](species-preparation.md)).

1. **Spotted Sardinella** (`amblygaster-sirm`): `v0.6.x`, The Open Sea.
2. **Giant Sunfish** (`mola-alexandrini`): `v0.8.0`, The Reefs.
3. **Mahi-mahi** (`coryphaena-hippurus`): `v0.8.10`, The Open Sea.
4. **Shortfin Mako** (`isurus-oxyrinchus`): `v0.8.19`, The Open Sea.
5. **Live Sharksucker** (`echeneis-naucrates`): `v0.16.0` (#102, #111), The Open Sea.
6. **Whitefin Sharksucker** (`echeneis-neucratoides`): `v0.17.1` (#112), The Open Sea.
7. **Pilot Fish** (`naucrates-ductor`): `v0.18.0` (#118), The Reefs.
8. **Longfin Bannerfish** (`heniochus-acuminatus`): `v0.19.0` (#119), The Reefs.
9. **Emperor Angelfish** (`pomacanthus-imperator`): `v0.20.0` (#122), The Reefs.
10. **Clown Triggerfish** (`balistoides-conspicillum`): `v0.22.0` (#126), The Reefs.
11. **Whale Shark** (`rhincodon-typus`): `v0.23.0` (#129), The Open Sea.
12. **Squaretail Coral Grouper** (`plectropomus-areolatus`): `v0.28.0` (#133), The Reefs.
13. **Hyacinth Table Coral** (`acropora-hyacinthus`): `v0.30.0` (#135), The Reefs.
14. **Staghorn Coral** (`acropora-muricata`): `v0.31.0` (#139), The Reefs.
15. **Raccoon Butterflyfish** (`chaetodon-lunula`): `v0.32.0` (#146), The Reefs.
16. **Humphead Wrasse** (`crassilabrus-undulatus`): `v0.33.0` (#148), The Reefs.
17. **Munk's Devil Ray** (`mobula-munkiana`): `v0.36.0`, The Shallows.
18. **Giant Oceanic Manta** (`mobula-birostris`): `v0.37.0` (#161), The Shallows.
19. **Giant Sea Fan** (`annella-mollis`): `v0.38.0`, The Reefs.
20. **Bluespine Unicornfish** (`naso-unicornis`): `v0.39.0` (#165), The Reefs.
21. **Yellowfin Tuna** (`thunnus-albacares`): `v0.40.0` (#168), The Open Sea.
22. **Golden Trevally** (`gnathanodon-speciosus`): `v0.41.0` (#173), The Shallows.

## Up next

In the order they will be added.

1. **White Suckerfish** (`remora-albescens`), The Shallows. In review: `v0.42.0-dev_2`
   (branch `species/remora-albescens`), Jeremy's model in, three riders on the Giant Oceanic
   Manta's belly in `creatures_dev`.
2. **Brain Coral** (*Platygyra daedalea*), The Reefs. Static hard coral, boulders on the
   bommies.
3. **Common Remora** (`remora-remora`), The Open Sea. Rides the mako and the whale shark.
4. **Cauliflower Coral** (*Pocillopora*, species to choose), The Reefs. Static hard coral,
   built with the staghorn's kit script.
5. **Bluefin Trevally** (*Caranx melampygus*), The Reefs. Escorts the humphead wrasse, on the
   golden trevally's escort code.
6. **Leather Coral** (*Sarcophyton*, species to choose), The Reefs. Soft coral on the sea
   fan's sway shader.
7. **Spearfish Remora** (`remora-brachyptera`), The Reefs. Rides the Mola.
8. **Giant Clam** (*Tridacna gigas*), The Reefs. Static landscape piece in the sand between
   bommies.
9. **East Pacific Green Turtle** (*Chelonia mydas*), The Shallows. Needs a new flipper motion
   type.
10. **Golden Cownose Ray** (*Rhinoptera steindachneri*), The Shallows.
11. **Sailfish** (*Istiophorus platypterus*), The Open Sea. A billfish host.
12. **Marlinsucker** (`remora-osteochir`), The Open Sea. Rides the sailfish.
13. **Reef Manta** (*Mobula alfredi*), The Reefs.
14. **Toadfish** (species to choose).
15. **Scrawled Filefish** (*Aluterus scriptus*).
16. **Coelacanth** (*Latimeria*, species to choose).
17. **Butterfly Ray** (*Gymnura*, species to choose).
18. **Oceanic Whitetip Shark** (*Carcharhinus longimanus*).
19. **Goliath Grouper** (*Epinephelus itajara*).
20. **Koi** (*Cyprinus rubrofuscus*, domestic).

Corals crowd the bommie tops: each coral release checks how many of every coral still fit
(placement order matters; the sea fans go before the staghorn).

## Not yet in order

Named but not placed in the order above. Check range, IUCN status and the 27 cm size floor
before starting one.

- **Whalesucker** (`remora-australis`): rides whales and dolphins only; needs a cetacean first.
- **Slender Suckerfish** (`phtheirichthys-lineatus`): rides barracuda, also turtles; needs one
  of those first.
- The Shallows: round stingray (*Urobatis halleri*), California sea lion.
- Escorts: cobia, rainbow runner; barberfish and cleaner wrasse fall under the size floor.
  Cobia is absent from the eastern Pacific, so not for The Shallows.
- Hosts: Mola mola, swordfish, spinner dolphin, dugong. Dolphins and the dugong need new
  motion types.
- Deep sea and oddities: needs a deep-sea reserve first; barreleye, mantis shrimp and the
  immortal jellyfish fall under the size floor.

## Remora entries

These remoras have researched entries in `src/data/species.js` (facts, Atlas copy, `hitchhiker`
ride data) but no model, are on no tank and are out of the Atlas. Each needs Jeremy's GLB, then
the remora intake in [ride-hosts.md](ride-hosts.md) (`node scripts/fit-rider-model.mjs <id>`),
a tank slot and `creatures_dev` rows. Their generated stand-ins were removed in
`v0.37.0-dev_2`.

- **Common Remora** (`remora-remora`, 86 cm, LC). Rides sharks first, also turtles, whales and
  large fish. Home: The Open Sea, on the mako and whale shark.
- **Spearfish Remora** (`remora-brachyptera`, 50 cm, LC). Rides billfish, also sunfish. Home:
  The Reefs, on its Mola.
- **Marlinsucker** (`remora-osteochir`, 40 cm, LC). Rides billfish only; needs a marlin,
  sailfish or swordfish first.
- **Whalesucker** (`remora-australis`, 76 cm, LC). Rides whales and dolphins only.
- **Slender Suckerfish** (`phtheirichthys-lineatus`, 76 cm, LC). Rides barracuda, also turtles.
