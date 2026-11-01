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

## Collaborator-proof rules

Several agents work on this repo (Claude, Codex, Hermes and others), alongside Jeremy and YK. None of them can read another agent's private memory, so a rule kept only there will be broken by the next agent.

- This file and the docs it links (`docs/new-species-checklist.md`, `docs/tank-design.md`, `docs/procedural/`, ROADMAP) are the single source of truth for how work is done here.
- When Jeremy corrects a process, or you learn a rule the next agent will need, write it here or into the doc it belongs to, in the same PR as the work. Saving it to your own memory as well is fine; saving it only there is not.
- Your own memory may keep only what is specific to your machine or tools (local paths, workarounds), with a pointer to the rule here.
- If your memory disagrees with this file, this file wins. Raise the conflict with Jeremy rather than following the memory.
- Rules written here stay generic: no personal paths, vault locations or secrets (see Release hygiene, "Commit only what belongs to the codebase").

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
- `docs/ride-hosts.md` — remoras riding hosts and followers escorting them: `rideHost` anchors (none on an escort-only host), `hitchhiker` host weights and `escort` stations, the ride stages, and how to add a host
- `docs/reef-behavior.md` — reef fish at the rocks: `reef` profiles, the patrol/hover/peck/shelter modes and stages, site raycasts, swim volume; and the coral forms index (`table`, `thicket`, `mound`; `fan`, `host` proposed): how each mode plays at each form, and the universal rules every fish follows at every coral. A new coral is a row under an existing form unless its shape offers something none covers
- `src/components/coralPlacement.js` — table corals on the reef rocks: which rocks get a cluster, and the foot/top/shoulder placement against the drawn rock. The coral kit and its Atlas specimen are built by `scripts/build-coral-kit.py` and `scripts/build-coral-atlas.py` (headless Blender)
- `src/components/staghornPlacement.js` — staghorn coral in one-colour patches on the table corals' bommies, placed after the tables and clear of their plates; drawn as one `THREE.LOD` per bommie. Each patch is one `thicket` reef-site surface (Landscape.jsx `thicketReefSurfaces`). Kit and Atlas specimen from `scripts/build-staghorn-kit.py` and `scripts/build-staghorn-atlas.py`
- `src/components/seaFanPlacement.js` — giant sea fans growing from rock faces on the table corals' bommies and, singly, on other reef rocks, placed after the tables and before the staghorn (which keeps clear of them, `inFan`), broadside to the landscape's current; swaying via `src/utils/coralSway.js` (`docs/procedural/coral-sway.md`, which holds the model contract). Kit and Atlas specimen from `scripts/build-sea-fan-kit.py`
- `src/components/brainCoralPlacement.js` — brain corals (*Platygyra daedalea*) as boulders on the ledges and at the feet of the table corals' bommies, placed after the tables and sea fans and before the staghorn (which keeps clear of them, `inMound`), each a `mound` to the reef fish. A colony is only spun about its vertical and leant a little, never turned over; the underside below its origin stays buried. Kit and Atlas specimen from `scripts/build-brain-coral-kit.py` (whose header holds the model contract) and `scripts/build-brain-coral-atlas.py`
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
- At every clean release, in the same PR: move the released section out of `## Current work`, to `## Released / archived` when nothing in it is open, or to `## Shipped, with open follow-ups` when items remain. A shipped section never stays in Current work.

## Release hygiene

Each rule below was missed at least once. New rules go here too (see Collaborator-proof rules).

- **Merge means promote.** When Jeremy asks to merge a `-dev_##` branch, that is his acceptance: promote to the clean version in the same PR (`src/version.js`, `package.json`, `package-lock.json`, both changelogs, ROADMAP), then merge. Never leave a `-dev_` version on `main`, and don't ask him to check on his phone first.
- **`main` is ruleset-protected.** Changes land only by PR with a passing `Build` check, squash merge only, auto-merge off (`gh api repos/jeremyyeh11/world-oceanarium/rulesets`; the legacy branch-protection endpoint wrongly answers "not protected"). If he says merge while Build runs, finish the other work first, then check Build once and merge in the same turn.
- **Other agents merge in parallel.** Right before choosing a `-dev_##` number or merging, `git fetch` and read `origin/main`'s `src/version.js` and CHANGELOG status line; on conflict, rebase, keep their entry and take the next free number. Merged branches get deleted, which closes any new PR on them, so start each new PR on a fresh branch from `main`.
- **Verify the deploy by the live bundle.** Vercel's GitHub statuses are sometimes missing or wrong. After merging, fetch https://world-oceanarium-three.vercel.app, take the first `/assets/*.js`, and look for the new version string (the bundle holds every past version too, so look for the new one appearing). If there is no Production deployment for the merge SHA, or the domain still serves the old bundle 10 minutes after a successful one, ask Jeremy to redeploy or promote it in the Vercel dashboard.
- **Credit sources where they belong.** Databases (FishBase, IUCN, Coral Trait Database) in `SOURCES`; papers, theses and species profiles that decide an Atlas value in `STUDY_CREDITS`; photos in `IMAGE_CREDITS`. Add the credit in the same commit as the value, with a comment beside the value in `species.js`.
- **Atlas tile with the first swim.** The species' `public/atlas/<slug>-thumbnail.png` is captured in the same build that first shows it in a tank (`docs/new-species-checklist.md` section 6), never left for promotion. The prebuild check warns on `-dev_`; treat that warning as a to-do.

- **Two changelogs, one truth.** A clean release updates `CHANGELOG.md` and the visitor list in `src/data/changelog.js` in the same PR. A visitor line describes what production shows: never a change that only `creatures_dev` or a dev-only life stage can show. A production data write that changes what visitors see (a new school, an animal grown or replaced) gets a visitor line in the next release bucket.
- **Production writes are recorded in the same session.** After a `creatures` write, update ROADMAP, CHANGELOG and any species doc that states production counts before the session ends, on the same branch as the code where there is one. Never leave a doc saying a write is pending once it has happened.
- **Every photo texture is credited when it ships.** List each image embedded in a GLB (name, size) at intake and look at each one. Each photo gets an `IMAGE_CREDITS` entry in `src/data/sources.js`: the full credit, or, with no known source, an entry with no `url` (it shows "Unknown source"; add `author` if only the photographer is known) and a ROADMAP item to find it. Never ship a photo with no entry. Generated images are not photos and are not listed.
- **No foreign images in assets.** Logos, watermarked stock comps, screenshots and other images that are not the animal never ship inside a GLB. If a material only samples a corner of one, cut that corner out as the texture and remap the UVs (`v0.40.1`, the mako's mouth).
- **Comments and docs follow behaviour.** When a dev build changes how something works (where it is placed, which rows production holds), update the entry's header comment in `species.js`, its AGENTS.md path line and its docs in the same commit.
- **The fish queue stays current.** Before adding any new species, read `docs/fish-queue.md` and take the next species in its Up next order unless Jeremy picks otherwise; add a species he names that is not on it where he places it. When a species ships in a clean release, move its line to the end of the queue's Done section (version and PR) in the same PR, so the queue stays one chronological sequence. Never delete a line.
- **Suggesting the next species starts from the fish queue.** When Jeremy asks what to add next, read `docs/fish-queue.md` first and weigh, in this order: (1) the queue's Up next order; (2) what complements the current species list (reserve balance, hosts and riders, reef cover); (3) his overrides in the discussion. The queue keeps growing and changing: when the discussion changes the order or adds species, amend the queue in the same session.
- **Append new species** at the end of `SPECIES` (and of the per-species maps in `EncyclopediaPage.jsx`). The Atlas sorts by name, so order is only for readers; a comment above an entry describes that entry only.
- **Merge through the PR** so the squash title ends in `(#N)`, and link the PR in the CHANGELOG status line.
- **Commit only what belongs to the codebase.** Anything else (reel and social notes, book materials, personal notes) is never committed, and neither is where it is kept: no personal folder or vault paths in the repo. Hand such material to Jeremy in chat.

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
- Before direct Supabase creature writes, run `npm run backup:creatures`; verify after writes and back up again. It snapshots production `creatures` only, so snapshot `creatures_dev` yourself (anon REST read) before and after a dev write.
- Both tables share `creatures_id_seq`, which is far behind: insert with explicit ids, above that table's own `max(id)` (the same id in both tables is fine).
- Every live row has its own `description`: one light sentence with a real detail. Write one for every new row, dev and production.
- Bundled `CREATURES` fixtures load only when `creatures_dev` is empty, so a new species is invisible on a dev build until it has `creatures_dev` rows.
- Older builds skip unknown species, so a new species' production rows may be written before its build is live. A new life stage or sex variant is the exception: write those rows only once the live bundle serves the build that draws them.
- Population lives in the database, not the repo. When a tank gets slower with no code change, check the live row counts first.

## Creature / species conventions

- Canonical species slugs are scientific-name slugs, e.g. `amblygaster-sirm`, `mola-alexandrini`.
- Each reserve's roster is its own: a species lives in one reserve only. Putting a species in a second reserve is a separate call for Jeremy.
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
- Jeremy's models are flat-shaded (faceted) on purpose. Never smooth them or offer to.
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
