# World Oceanarium

An interactive 3D aquarium and living ecosystem simulator built with React Three Fiber. The scene is a "window" into an underwater world — you navigate through distinct biomes and descend through real depth zones, observing creatures that are born, age, and die as part of an ongoing simulation.

## Concept

This is equal parts portfolio project and passion project. The goal is a faithful, educational replica of real aquatic ecosystems — not a game, not an evolution sandbox. Species are introduced manually by a curator. Individual creatures are born organically through in-sim interactions, persist across sessions, and carry a full identity: a unique ID, birth timestamp, lineage, and genetic traits inherited from their parents.

## Features (current)

- Perspective camera locked to pan — scroll vertically through depth zones, switch horizontally between biomes
- Biome switching with blur-slide transition
- Ocean depth zones: Epipelagic → Mesopelagic → Bathypelagic → Abyssalpelagic → Hadalpelagic
- Noise-displaced seabed per biome
- Click a creature to view its identity card (ID, species, birth date, generation)
- Persistent creature database via Supabase — every individual has a record

## Planned

- Reef, lake, and river biomes
- Behavioral mechanics: schooling, aggression, predation, breeding, symbiosis
- Population dynamics: colony formation, extinction
- Real GLB assets from Blender (currently placeholder geometry)
- Scrolling texture FX: caustics, water shimmer, bubbles
- Vercel deployment

## Stack

- React + Vite
- React Three Fiber + @react-three/drei
- Supabase (PostgreSQL) for creature persistence

## Running Locally

```bash
npm install
npm run dev
```

## Creature ID Scheme

- Alpha phase: `alpha_1`, `alpha_2`, ... (manually introduced)
- Production: globally incrementing integers `1`, `2`, `3`, ...
- New species are always manually introduced
- New individuals can be manually introduced or born organically between existing creatures
