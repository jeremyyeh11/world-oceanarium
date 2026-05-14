# World Oceanarium

World Oceanarium is a living window into real aquatic ecosystems.

The goal is not to make a generic aquarium toy. It is to build a faithful, beautiful, slow-burn oceanarium where every animal is treated as a real creature: correctly scaled, biologically grounded, individually tracked, and placed inside an ecosystem that can eventually change over real time.

## Purpose

World Oceanarium should feel like looking into a carefully maintained slice of the ocean.

Each species is introduced deliberately. Movement, size, behavior, depth range, and interactions should be based on how the animal actually lives, then tuned just enough to remain readable and elegant on screen.

The project values:

- biological plausibility over arbitrary game stats
- calm observation over noisy mechanics
- one strong creature at a time over shallow variety
- real scale and body-length-based motion
- persistent identity for individual animals
- tasteful presentation with minimal UI

## Current Focus

The current tank contains a single sardine in the ocean sunlight zone.

This sardine is the reference creature for the project’s core standards:

- real-world scale: `1 WU = 25 cm`
- body-length-based swim speed
- idle swimming, snap turns, and straight-line bursts
- Blender-authored GLB animation clips
- follow camera for close observation
- local creature records shaped for future persistence

## Long-Term Direction

Eventually, World Oceanarium should support real simulation state over time:

- births and deaths
- aging
- lineage
- schooling
- predation
- biome-specific behavior
- curator-introduced species
- persistent individual histories

For now, creature data lives locally in versioned source files. This keeps the early project simple and reliable. The data is intentionally shaped like future database records, so it can later migrate to Supabase/Postgres without resetting existing creatures.

## Development

```bash
npm install
npm run dev
```
