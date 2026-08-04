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

The current clean release is `v0.13.0`; `v0.13.0-dev_5` is the in-review cinematic-camera build pending final retarget after rebase. The ocean sunlight zone contains two deliberately curated tanks:

- **The Open Sea** — spotted sardinella, Mahi-mahi, and a Shortfin Mako Shark form a bait → mid-predator → apex-predator assemblage.
- **The Drift** — a Giant Sunfish occupies a calmer, dimmer tank built around its slower rhythm and authored sun-bask behavior.

Current foundations:

- real-world scale: `1 WU = 25 cm`
- body-length-scaled speed, turn radius, and camera framing
- one unified boids movement pipeline for schools, pairs, and solitary creatures
- Blender-authored GLB animation with species-specific procedural shaping where useful
- bone-aware follow camera for close observation
- species-locked documentary shot direction entered from a followed fish, built from that species' live individuals/pairs/schools with validity-gated jump cuts, one deliberate movement per shot, and no hardcoded cast
- Supabase-backed individual creature records, with browser-safe production credentials
- session continuity across tank switches: hidden tanks freeze and resume without respawning their inhabitants

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

Production creature data now lives in Supabase/Postgres. Versioned static creature rows remain as a development and missing-environment fallback; both sources normalize into the same runtime creature shape.

## Documentation

Index of the project's Markdown references, for both human and future-agent use. Start here.

| File | What it's for |
| --- | --- |
| [AGENTS.md](AGENTS.md) | Architecture, important source paths, commands, and conventions for coding agents. Read first when touching the code. |
| [ROADMAP.md](ROADMAP.md) | Source of truth for active TODOs, release blockers, and review follow-ups, ordered by current work. |
| [CHANGELOG.md](CHANGELOG.md) | Significant changes grouped by release bucket. |
| [MEMORY.md](MEMORY.md) | Durable working preferences and conventions captured across sessions (Atlas/copy/debug prefs, release-judgement, workflow). |
| [docs/tank-design.md](docs/tank-design.md) | The tank/assemblage model — how species map to tanks, the coherence rules, and how to edit tanks by hand. |
| [docs/cinematic-camera.md](docs/cinematic-camera.md) | Cinematic Camera's felt intention, live hero queue, generic shot grammar, controls, performance shape, and review contract. |

## Development

```bash
npm install
npm run dev
npm run lint
npm run build
```
