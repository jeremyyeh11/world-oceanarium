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
- `src/loading/`, `src/hooks/useEnvironmentLoading.js` — budgeted environment/source lifecycle and the loading-UI contract (selector, loading screen: `EnvironmentSelector.jsx`, `EnvironmentLoader.jsx`); read `docs/environment-loading.md` before adding preload/cache owners
- `src/hooks/useOceanAudio.js` — Web Audio graph and SFX
- `src/data/species.js` — species templates (incl. `tempo`), `TANKS` curation layer, biological facts
- `src/utils/speciesLookup.js` — species/tank lookups, `creaturesForTank`, dev coherence guard
- `docs/tank-design.md` — the tank/assemblage model: how species map to tanks and how to edit by hand; the **new reserve checklist** (copy says *reserve*, `depthMeters`, descent scenery and signature species). Public copy calls a tank a reserve; code keeps `tank`
- `docs/procedural/README.md` — procedural animation hub: shared asset contract, runtime drivers, motion primitives, and the creature/type index. Read before touching any rig-free animation path
- `docs/procedural/<type>.md` — per-motion-type contract (Blender setup, vertex-paint channels, config keys, review gates). Types: `caudal-wave`, `mask-fin-row`, `bell-pulse`, `foil-flap`, `disc-wave`, `limb-step`, `pleopod-beat`
- `docs/new-species-checklist.md` — required species feature path: biological contract, asset/scale, motion feel, Atlas, responsive QA, and release evidence
- `docs/ride-hosts.md` — remoras riding hosts: `rideHost` anchors, `hitchhiker` host weights, the ride stages, and how to add a host
- `docs/reef-behavior.md` — reef fish at the rocks: `reef` profiles, the patrol/hover/peck/shelter modes and stages, site raycasts, swim volume; and the coral forms index (`table`, `thicket`; `mound`, `fan`, `host` proposed): how each mode plays at each form, and the universal rules every fish follows at every coral. A new coral is a row under an existing form unless its shape offers something none covers
- `src/components/coralPlacement.js` — table corals on the reef rocks: which rocks get a cluster, and the foot/top/shoulder placement against the drawn rock. The coral kit and its Atlas specimen are built by `scripts/build-coral-kit.py` and `scripts/build-coral-atlas.py` (headless Blender)
- `src/components/staghornPlacement.js` — staghorn coral in one-colour patches on the table corals' bommies, placed after the tables and clear of their plates; drawn as one `THREE.LOD` per bommie. Each patch is one `thicket` reef-site surface (Landscape.jsx `thicketReefSurfaces`). Kit and Atlas specimen from `scripts/build-staghorn-kit.py` and `scripts/build-staghorn-atlas.py`
- `src/components/seaFanPlacement.js` — giant sea fans on the table corals' bommies, placed after the tables and before the staghorn (which keeps clear of them, `inFan`), broadside to the landscape's current; swaying via `src/utils/coralSway.js` (`docs/procedural/coral-sway.md`, which holds the model contract). Kit and Atlas specimen from `scripts/build-sea-fan-kit.py`
- `src/version.js` — visible bottom-right version label
- `CHANGELOG.md` — categorized release-bucket notes
- `ROADMAP.md` — active TODOs, release blockers, and review follow-ups ordered by current work, priority, then chronology
- `public/models/` and `public/audio/` — shipped assets

**Stop and ask before implementing a new motion architecture.** If a supplied asset
needs motion that no type in `docs/procedural/README.md`'s index covers, do not invent
a shader `type` string and build it. Write the type doc first, confirm the approach
with Jeremy, then implement. `npm run verify:procedural-fish-assets` fails on any
procedural type with no written contract. If the motion is a config of an existing
type — an eel is `caudal-wave` with a low `flexStart` — use that type instead of
adding one. Name the closest existing type and why it does not fit; "it is a
different animal" is not a reason.

**Check the animal's size in world units before designing its motion.** `1 WU = 25 cm`,
and the smallest shipping species is the Spotted Sardinella at `1.08` WU / 27 cm. An
animal far below that floor needs resolving — a larger species, a near-camera-only
role, or no tank slot — before any motion work, not after.

## Working style

- Inspect existing code before editing. Prefer small, direct patches.
- Preserve 60fps: avoid new per-frame allocations/heavy scans in `useFrame` unless measured harmless.
- Keep browser-playable behavior intact after every change.
- Use existing systems and conventions before adding new abstractions.
- Do not ship diagnostic visuals, wireframes, loud colors, or debug probes in final/clean builds unless explicitly requested as a dev probe.
- If an experiment is reverted before push, summarize only the net shipped change.

## Branch naming

- For each new species, use `species/<scientific-name>` with the lowercase, hyphenated scientific name, e.g. `species/mola-alexandrini`.
- If a session adds multiple species, create a separate branch for each species and do that species' work on its corresponding branch.
- For other work, use a task-based prefix such as `fix/`, `feat/`, `ui/`, or `refactor/`, followed by a descriptive kebab-case name.
- Do not use agent-name prefixes such as `claude/`, `codex/`, or `hermes/`.

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
- Landscape rocks (`src/components/rockObstacles.js`) join that pipeline: steer around the rocks ahead (felt gradually across their outlines), push out of any rock after the clamps, and never pick a target inside one. Where two rocks' padded shapes overlap or meet in a wedge (a pinch), the push never flicks a fish from one into the other: it slides along both faces or holds where it started the frame, and a fish held there gives up where it was going (see `docs/reef-behavior.md`, Pinches between rocks). A tank's rocks come from `src/data/landscapes.js`; hand-placed pieces flagged `inSwim` may stand in the swim volume, everything else stays outside it. Table coral plates join the same field as extra obstacles (`setExtraObstacles`) once their placement finishes.
- A normally-schooling creature that is currently unpaired must still use the solo fallback (`Boolean(species) && !isSchooling`) so odd live counts cannot create a movement dead zone.
- Reef-associated species (a `reef` block) hover at, peck at and shelter in the rocks: `src/components/reefBehavior.js`, sites from raycasts of the drawn rocks in `src/components/reefSites.js`. Travel to a site runs on the pipeline; settling in, the time at the rock and turning to leave own the pose, like the sun-bask hold. Corals are visited by growth form (`CORAL_FORMS` in reefBehavior.js, per-species `reef.corals.<form>` shares): every coral blocks the site rays like rock, joins the obstacle field, and a coral search that finds nothing falls back to rock. See `docs/reef-behavior.md`.
- Exception to the unified pipeline: a remora clamped to a host (ride stages `latch`/`attached`) takes its pose from the host's published pose plus an anchor, like the Mola sun-bask hold. Ride hosts run `useFrame` at priority −1 so riders read the same frame's pose. See `docs/ride-hosts.md`.
- Current Mola axis convention: GLB `+Y` up, `+Z` forward.

## Tank-session continuity

- One tank is mounted at a time: the one being viewed or, while the tank selector or loading screen covers it, the last one viewed, hidden (TankView `hidden`: window listeners off, follow released, viewport hidden) and paused once its first frame has rendered (`paused`: canvas `frameloop="never"`). A paused tank renders and simulates nothing; it stays mounted only so the WebGL context, compiled shaders and uploaded textures survive. Tanks that are not mounted do not simulate. Never mount a second tank alongside it.
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
