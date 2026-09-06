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
- `src/components/fishRuntimeStore.js` — session-lifetime fish snapshots that survive active-tank unmount/remount
- `src/components/Biome.jsx` — renders a tank's curated creature assemblage (see `docs/tank-design.md`)
- `src/components/TankView.jsx` — tank UI, debug mode, follow selection, controls
- `src/hooks/useCreatures.js` — Supabase/local creature source routing
- `src/hooks/useOceanAudio.js` — Web Audio graph and SFX
- `src/data/species.js` — species templates (incl. `tempo`), `TANKS` curation layer, biological facts
- `src/utils/speciesLookup.js` — species/tank lookups, `creaturesForTank`, dev coherence guard
- `docs/tank-design.md` — the tank/assemblage model: how species map to tanks and how to edit by hand
- `docs/new-species-checklist.md` — required species feature path: biological contract, asset/scale, motion feel, Atlas, responsive QA, and release evidence
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
- Every creature uses the unified steer → boids → turn-cap → integrate → clamp pipeline. Schools derive their base heading from a shared migration goal + formation slot; creatures outside a school use a personal roaming/authored target.
- A normally-schooling creature that is currently unpaired must still use the solo fallback (`Boolean(species) && !isSchooling`) so odd live counts cannot create a movement dead zone.
- Current Mola axis convention: GLB `+Y` up, `+Z` forward.

## Tank-session continuity

- Only the active tank is mounted/rendered. Hidden tanks do not simulate in the background.
- `fishRuntimeStore.js` persists continuity-critical state by creature id so switching tanks freezes/resumes fish instead of reseeding them.
- Preserve the page reload boundary: module state intentionally clears on reload; do not add durable browser/server persistence without a separate design decision.
- Prune snapshots against the current live creature ids after data refreshes.
- School-member positions/headings persist, but the shared school migration goal currently repicks after remount. Treat exact school-goal continuity as an optional refinement, not a bug in individual persistence.

## Visual / UX taste

- Preserve tank brightness/color unless specifically asked to grade/darken.
- Favor readable motion and elegant presentation over visual noise.
- Follow mode should feel smooth; avoid camera snaps, raw `lookAt()` jumps, and sudden target shifts.
- Mobile matters: touch controls, follow mode, debug access, audio unlock, and layout should be tested conceptually for phone use.
- Controls/debug affordances should be compact and unobtrusive.

## Mola authored-behavior notes

- Mola cruise movement uses the unified integrator; its sun-bask, depth-residency targets, surface ceilings, and deep-exit recovery are authored layers on top.
- Keep Mola Y protected by a hard surface ceiling below `SURFACE_PLANE_Y`.
- Sun-bask lifecycle: approach → side-up hold/drift/animation → exit.
- Runtime root roll owns the whole-animal bask pose; do not let authored animation root tracks fight it.
- The rear boundary is intentionally soft so a blown deep U-turn can exit into darkness and use the fade-out/snap/fade-in recovery instead of wall-sliding.
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

This project uses code-review-graph through Hermes Agent and Codex. When the
MCP tools are available, use them before broad file searches for dependency
exploration, change review, and blast-radius analysis. Hermes prefixes these
tools with `mcp_crg_`; the underlying tool names end in `_tool`.

Pass this repository's root explicitly through `repo_root` when the tool accepts
it. The shared Hermes MCP server can serve multiple repositories, so relying on
its default repository can query the wrong project.

The graph is structural context, not ground truth. Fall back to direct file reads
for static assets/configuration or whenever the graph is stale or incomplete.

### Useful tools

- Exploration: `semantic_search_nodes_tool`, `query_graph_tool`
- Change review: `detect_changes_tool`, `get_review_context_tool`
- Impact: `get_impact_radius_tool`, `get_affected_flows_tool`
- Architecture: `get_architecture_overview_tool`, `list_communities_tool`
- Test relationships: `query_graph_tool` with `pattern="tests_for"`

After source changes, refresh the graph with `build_or_update_graph_tool` or
`code-review-graph update --repo .` before relying on review results.
