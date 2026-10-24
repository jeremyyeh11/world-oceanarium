# Debug instruments

Review: `v0.36.2-dev_1`, `feat/update-debug-menu`, issue #159. Base: `e2447609193ba38d83ba0de62007f75859057f0f` (`v0.36.1`). Not a clean release.

## Felt intention and boundaries

Inspect one animal, understand what it is doing, then get the instrument out of the view. Keep the flat full-width bottom strip; no decorative cards, rounded controls or scene grading.

This changes diagnostic UI and rendering overrides, not the simulation clocks, steering, authored behaviours, assets, environment loading UI or database. Bones display is removed; skeletal cloning, authored clips and procedural/curve rig animation remain intact. Slow motion/pause needs a separate coordinated clock audit.

## Access and lifecycle

- Existing Ctrl/Cmd+Shift+D and version-entry interaction still open debug.
- Scope starts at Selected. With no creature followed, the inspector asks for selection.
- Heading/speed and identity start enabled. Steering, neighbours, behaviour, LOD colours and Force detail start off.
- Creature/Render/Scene/Audio/Data sections toggle independently of overlay state; only one section is expanded at a time. Click the active section again to collapse it.
- Reset clears every overlay (including colours), chooses Selected, restores 1x and normal detail, and collapses sections. It does not reposition fish or release follow.
- Exit performs the same reset and closes debug. Re-entry does not restore hidden quality/speed overrides.
- Hidden, paused and screenshot views do not sample optional diagnostics. Screenshot mode suppresses debug visuals and speed/detail overrides.
- Touch controls are at least 44px in each dimension. The panel scrolls vertically when necessary and is capped at 52dvh. Follow-card scrolling and debug scrolling are exempt from the follow camera's page-scroll blocker.

## Readout semantics

### Population and source

`reservePopulation` uses `creaturesForTank`, the same living curated species filter as Biome. A population is not an on-screen count. Data separately identifies the source, loaded row count and any fetch/config warning.

Raw local fixtures in this audit have 103 Open Sea animals and 7 Reef animals out of 110 loaded rows; The Shallows has no local fixture rays. These are fixture counts, not production-table assertions. No database writes were made.

### Rendering

- RAF/s counts browser animation callbacks over about one second. It is not GPU completion, GPU time, or a phone benchmark.
- LOD 0/1/2 and point-frustum counts are sardine-only registry submissions. Never infer LOD0 by subtracting sardines from the entire mixed-species reserve population.
- Selected or explicitly forced sardines contribute to the detailed registry. A state transition may briefly reflect a pending React render; this is diagnostic sampling, not a synchronized GPU visibility query.
- Normal overlays, All scope and LOD colours do not force detailed sardines. The explicit Force sardine detail override applies reserve-wide and bypasses the normal sardine point-cull path; it is labelled as a workload change.
- Selection retains the existing close-inspection detail behaviour even without debug.
- Sardine eligibility uses resolved canonical species identity, not an exact display-name comparison. Both `amblygaster-sirm` fixtures and normalized `Spotted Sardinella` rows must work.
- 4x/10x remain advanced soak-test controls, with a persistent override warning. No new simulation speed or clock logic was added.

### Creature and scene

`Fish` exposes `userData.inspectCreature` only for a selected creature while its inspector is requested. The getter reads existing runtime refs; the DOM inspector polls it every 500ms. Cleanup removes the getter and timer. There is no second per-frame snapshot publisher. Available fields: speed in m/s, behaviour, school, host, reef mode/stage and queued action. Bask is a queue, not an immediate interrupt: the inspector explicitly says it waits for the current behaviour.

Heading/speed, steering vectors, neighbour web, identity and agent-behaviour labels have independent switches. Steering/neighbours keep the existing selected-creature-or-solitary-agent eligibility. Heading now also works for solitary agents without requiring their combined behaviour label.

Scene mounts its R3F observer only while open. It reads the previous renderer pass's calls/triangles, resident geometries/textures and DPR once per second. These are not full multipass GPU timings or memory bytes; transmission may reset render counters between passes. The observer never takes over rendering or changes quality.

### Audio

The Audio section is the only `useAudioLevels` subscriber. Without subscribers, the existing 100ms meter timer skips analyser scans; closing the section does not mute or rewire sound. UI level updates retain their existing one-second cadence/quantization. Hidden/paused views release the subscription.

## Implementation map

- `src/components/DebugPanel.jsx`: section presentation, contextual actions and selected inspection timer.
- `src/utils/debugMenu.js`: pure overlay eligibility, reset state, reserve count and measured sardine formatting.
- `src/components/TankView.jsx`: debug lifecycle, demand gates, summary RAF sampling and optional renderer observer.
- `src/components/Biome.jsx`: explicit detail/inspection prop routing.
- `src/components/Fish.jsx`: independent visibility, explicit detail override, precise selected/forced registry entries and on-demand getter. Animation/steering implementations remain unchanged.
- `src/hooks/useOceanAudio.js`: diagnostic subscriber demand guard; sound graph/playback unchanged.

Keep the summary in normal flow. A sticky header reproduced a second empty dark bar over the tank in Chromium despite correct DOM bounds; changing only its position to static removed it. The final compiled stylesheet was tested again from a fresh production-preview navigation.

## Verification

Run `npm test`, `npm run lint`, `npm run build`, `npm run verify:procedural-fish-assets` and `git diff --check`.

Passed locally:
- New pure/SSR regressions: reserve filtering (including dead rows), independent switches, cleared state, measured-only counters, empty/selected/contextual/error/override UI.
- Actual Fish frame regressions: normal/overlay/LOD-colour/forced/selected paths, slug and normalized-name eligibility, heading independence, inspector cleanup, registry cleanup, and exact unchanged motion across diagnostic modes over 180 fixed frames each. Rendering is stubbed in this test, not the Fish movement callback.
- Existing full suite, including the 218-ray 180-second renderless school check; existing procedural asset contracts pass.
- Lint: zero errors, eight existing warnings. Production build succeeds with its existing large-chunk warning. Rust gates are inapplicable (no Cargo manifest).
- Real Chromium UI smoke at 1280×800 and 375×812: Sea and Reef, selected Mako/Mola, contextual Bask queue, scope/overlay switches, explicit detail and 4x/10x warnings, Reset/Exit/re-entry, Scene/Data/Audio sections, follow-card layout/scroll exemption. Final clean production bundle: no horizontal menu overflow, no undersized buttons, static header and no captured page exceptions.
- Browser registry check: local 88 sardines stayed at LOD2 with normal diagnostics, switched to 88 LOD0 only after Force detail. Audio analyser instrumentation observed 21 scans with Audio open and zero during the subsequent closed interval; probe restored afterward.

Evidence is saved outside the application tree in the Game Builder browser workspace `debug-menu-qa/`, including `final-clean-bundle.json`, `final-desktop-layout.json`, `final-clean-mobile.png`, `final-clean-desktop.png`, `bask-queue.json`, and intermediate pre-fix screenshots. Early programmatic selection during startup once left the selector picked; a clean reload, startup settling and normal pointer input succeeded. No unrelated selector/loading change was made. Local production preview's Vercel analytics-script 404s are expected without Vercel hosting.

Limits: local missing-env fixture source only, not live table validation. Browser/software-renderer timings are not physical-phone FPS, heat, latency or touch-feel measurements. The Shallows' full population is exercised by the existing renderless school suite, not this fixture-backed browser pass. Jeremy's visual/feel review and physical-phone review remain open. Remote preview/CI status must be checked separately on the pushed commit.
