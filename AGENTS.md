# AGENTS.md — World Oceanarium

Guidance for Codex and other coding agents working in this repository.

## Project identity

World Oceanarium is a quiet, biologically grounded aquarium simulation, not a generic game prototype. Treat it as a crafted observation experience:

- calm, legible creature behavior over flashy mechanics
- real species facts and scale before invented stats
- elegant motion, strong feel, and minimal UI
- one polished creature/behavior at a time over shallow variety
- stable, immediately playable browser builds

Design rule: every mechanic must answer **what it feels like to do, and why that matters**.

## Repository / stack

- Repo: `jeremyyeh11/world-oceanarium`
- App: Vite + React + React Three Fiber + Drei + Three.js
- Package manager: npm
- Main commands:
  - `npm install`
  - `npm run dev`
  - `npm run build`
  - `npm run preview`
  - `npm run backup:creatures` before/after direct creature-data writes

Important paths:

- `src/components/Fish.jsx` — creature rendering, movement, animation, debug labels
- `src/components/Biome.jsx` — renders a tank's curated creature assemblage (see `docs/tank-design.md`)
- `src/components/TankView.jsx` — tank UI, debug mode, follow selection, controls
- `src/hooks/useCreatures.js` — Supabase/local creature source routing
- `src/hooks/useOceanAudio.js` — Web Audio graph and SFX
- `src/data/species.js` — species templates (incl. `tempo`), `TANKS` curation layer, biological facts
- `src/utils/speciesLookup.js` — species/tank lookups, `creaturesForTank`, dev coherence guard
- `docs/tank-design.md` — the tank/assemblage model: how species map to tanks and how to edit by hand
- `src/version.js` — visible bottom-right version label
- `CHANGELOG.md` — categorized release-bucket notes
- `ROADMAP.md` — active TODOs, release blockers, and review follow-ups ordered by current work, priority, then chronology
- `public/models/` and `public/audio/` — shipped assets

## Working style

- Inspect existing code before editing. Prefer small, direct patches.
- Preserve 60fps: avoid new per-frame allocations/heavy scans in `useFrame` unless measured harmless.
- Keep browser-playable behavior intact after every change.
- Use existing systems and conventions before adding new abstractions.
- Do not ship diagnostic visuals, wireframes, loud colors, or debug probes in final/clean builds unless explicitly requested as a dev probe.
- If an experiment is reverted before push, summarize only the net shipped change.

## Versioning and changelog

Visible versions use a target-release plus dev-suffix model:

- In-progress builds: `v0.8.0-dev_106`, `v0.8.0-dev_107`, etc.
- Clean accepted release: `v0.8.0`
- Update `src/version.js` for every pushed deployed code change.
- Keep `package.json` at the stable target semver; do not churn npm version for every dev suffix.
- Update `CHANGELOG.md` in categorized release buckets, not raw commit diaries.
- For doc-only changes that do not affect the app build or deployment, do not bump the visible app version unless asked.

## Roadmap workflow

- Keep `ROADMAP.md` as the source of truth for active TODOs, release blockers, and review follow-ups that come up in chat.
- Add new TODO lists and release blockers to `ROADMAP.md` with relevant dev patch/bucket version numbers for reference.
- Order roadmap items by current work first, then priority, then chronological discovery order unless Jeremy/YK explicitly asks to reorder.
- When work starts on a roadmap item, mark it `Current in development` and add subtasks when useful.
- When an item is completed and pushed to a clean public release, remove it from active roadmap sections or archive it away.
- Do not bump `src/version.js` for roadmap-only/doc-only edits unless asked.

## Validation

Before pushing code changes:

```bash
npm run build
```

After pushing app changes, verify both GitHub Actions and Vercel commit status:

```bash
SHA=$(git rev-parse HEAD)
gh api repos/jeremyyeh11/world-oceanarium/commits/$SHA/check-runs \
  --jq '.check_runs[]? | [.name,.status,.conclusion,.details_url] | @tsv'
gh api repos/jeremyyeh11/world-oceanarium/commits/$SHA/status \
  --jq '.statuses[]? | [.context,.state,.description,.target_url] | @tsv'
```

Vite chunk-size warnings are non-blocking if the build succeeds.

## Data and secrets

- Frontend may use only browser-safe Supabase env vars:
  - `VITE_SUPABASE_URL`
  - `VITE_SUPABASE_ANON_KEY`
  - optional `VITE_SUPABASE_CREATURES_URL`
- Never put service-role keys in frontend code, committed files, logs, final replies, or memory.
- `creatures_dev` and `creatures` intentionally diverge. Do not sync/copy tables unless explicitly asked.
- Clean production builds should not silently fall back to bundled creature fixtures when Supabase is empty.
- Before direct Supabase creature writes, run `npm run backup:creatures`; verify after writes and back up again.

## Creature / species conventions

- Canonical species slugs are scientific-name slugs, e.g. `amblygaster-sirm`, `mola-alexandrini`.
- Keep legacy aliases working while old rows age out.
- `1 WU = 25 cm` for real-world scale.
- Use body-length-scaled movement and camera framing for large animals.
- Sardines stay on shared-school movement; large non-schooling species use solo-agent behavior.
- Current Mola axis convention: GLB `+Y` up, `+Z` forward.

## Visual / UX taste

- Preserve tank brightness/color unless specifically asked to grade/darken.
- Favor readable motion and elegant presentation over visual noise.
- Follow mode should feel smooth; avoid camera snaps, raw `lookAt()` jumps, and sudden target shifts.
- Mobile matters: touch controls, follow mode, debug access, audio unlock, and layout should be tested conceptually for phone use.
- Controls/debug affordances should be compact and unobtrusive.

## Mola / large solo-agent notes

- Destinations stay in bounds; large solo agents may traverse outside X/Z destination bounds for broad maneuvers.
- Keep Mola Y protected by a hard surface ceiling below `SURFACE_PLANE_Y`.
- Sun-bask lifecycle: approach → side-up hold/drift/animation → exit.
- Runtime root roll owns the whole-animal bask pose; do not let authored animation root tracks fight it.
- Debug sun-bask shortcut: debug mode + selected/followed Mola + `Ctrl+Shift+X` queues bask; mobile debug panel has the same action.
- Solo-agent debug label format:

```text
81 • Giant Sunfish
Mola alexandrini
speed 0.42 m/s
sun-bask hold • sun_bask_l
queue none
```

## Communication / handoff

When reporting a shipped patch, include:

- what changed and why
- key technical details/constants needed for future debugging
- validation/deploy status
- visible version and commit SHA when applicable
- release judgement: either keep iterating with `-dev_##` builds or promote to a clean release, with one short reason

When completing a task in the World Oceanarium Telegram thread, tag Jeremy so completion is visible to him.

Keep replies concise. No markdown tables.

<!-- code-review-graph MCP tools -->
## MCP Tools: code-review-graph

**IMPORTANT: This project has a knowledge graph. ALWAYS use the
code-review-graph MCP tools BEFORE using Grep/Glob/Read to explore
the codebase.** The graph is faster, cheaper (fewer tokens), and gives
you structural context (callers, dependents, test coverage) that file
scanning cannot.

### When to use graph tools FIRST

- **Exploring code**: `semantic_search_nodes` or `query_graph` instead of Grep
- **Understanding impact**: `get_impact_radius` instead of manually tracing imports
- **Code review**: `detect_changes` + `get_review_context` instead of reading entire files
- **Finding relationships**: `query_graph` with callers_of/callees_of/imports_of/tests_for
- **Architecture questions**: `get_architecture_overview` + `list_communities`

Fall back to Grep/Glob/Read **only** when the graph doesn't cover what you need.

### Key Tools

| Tool | Use when |
| ------ | ---------- |
| `detect_changes` | Reviewing code changes — gives risk-scored analysis |
| `get_review_context` | Need source snippets for review — token-efficient |
| `get_impact_radius` | Understanding blast radius of a change |
| `get_affected_flows` | Finding which execution paths are impacted |
| `query_graph` | Tracing callers, callees, imports, tests, dependencies |
| `semantic_search_nodes` | Finding functions/classes by name or keyword |
| `get_architecture_overview` | Understanding high-level codebase structure |
| `refactor_tool` | Planning renames, finding dead code |

### Workflow

1. The graph auto-updates on file changes (via hooks).
2. Use `detect_changes` for code review.
3. Use `get_affected_flows` to understand impact.
4. Use `query_graph` pattern="tests_for" to check coverage.
