# Debug instruments

Review: `v0.37.2-dev_4`, `feat/update-debug-menu`, issue #159 / PR #160. Rebased on clean `v0.37.1` (`origin/main`); no merge/release approval.

## Feel and boundaries

A field instrument: watch the animal, glance at text, get out of its way. Flat, full-width bottom strip. No scene grading, simulation-clock refactor, new motion, loading UI, asset edits or database writes. Removing Bones display does not remove skeletal cloning, authored clips or procedural animation support.

## Layout and lifecycle

- **Creatures:** only Heading/speed, Neighbours, Labels. Selected/All scopes apply to those three world overlays. All includes schooling neighbours, not only solo agents.
- Steering/behaviour have no world vectors, floating labels or global switches. Only the selected animal publishes a runtime getter; a top-left, pointer-transparent text overlay samples it every 500ms. Includes actual speed, behaviour, desired world-XYZ heading, boid force magnitudes, school/host/reef and queued action where available. Nothing selected: prompt, not stale previous-animal data.
- Normal follow hint/info card are suppressed while debug is visible so they cannot occlude the text. Selection/follow remain intact; normal card returns on Exit. Background click/Escape still releases follow.
- **Performance:** combines former Render + Scene. Live top-left metrics whenever debug is visible, independent of the selected tab; actual all-GLB LOD tint and an advanced 1x/4x/10x soak control. No Force sardine detail.
- **Data:** persistent plain source/total/reserve/error text at the top, independent of the selected tab; no Data tab. Population uses the same living curated filter as Biome, not screen visibility. Full error also appears in its title.
- No Audio tab/subscription. Existing subscriber guard means no diagnostic analyser scans; playback graph is untouched.
- Existing shortcut/version access retained. Reset clears overlays/colours, restores Selected/1x and the Creatures tab; Exit resets then closes. Neither repositions fish nor releases follow. Reopening cannot retain hidden simulation overrides.
- Hidden/paused/screenshot views stop optional sampling. Screenshot mode suppresses debug visuals/speed overrides. Touch targets >=44px; flat panel scrolls if needed, no sticky header (Chromium/WebGL compositing previously duplicated its paint).

All top-left text uses an explicit system code-monospace stack, left-aligned in one pointer-transparent flow stack below the normal top controls. Data/readout share the same safe-area-aware left edge; long Data errors wrap without colliding with creature/performance text. No CRT display-font fallback.

Creatures and Performance are true flat underline tabs, not bordered buttons. Exactly one active panel; ArrowLeft/Right wrap, Home/End select endpoints; roving tab focus and associated ARIA panels. Clicking the active tab does not collapse it. Reset selects Creatures.

## LOD colour contract

Shared legend: pink LOD0/high; green LOD1/low; blue LOD2/far; purple LOD3/min; dark grey (`#454545`) Single level.

- FishModel: all fish GLBs, including sex/age variants, retain their deformation/animation path. Most use a single supplied model (dark grey), not an invented adaptive LOD0.
- Sardines: detailed GLB pink; existing LOD1/LOD2 instanced GLBs green/blue. Canonical species identity supports scientific slugs and normalized display-name rows. Colour/scope never forces detail or bypasses point culling; selected sardines keep normal close-up behaviour.
- Rocks: mark the actual chosen hi/lo/rubble source (0/1/2, including lo fallback). Table corals mark hi/lo/far (0/1/2). Tags survive merging within one chunk without splitting it or adding draw calls.
- Staghorn: tag actual hi/lo/far/min geometry, including the near level's temporary lo geometry before a sliced high-detail build and its lo fallback after retirement. Colour does not pretend that the LOD container's index is its current source mesh.
- A one-byte-per-vertex diagnostic tier attribute is kept on derived landscape geometry. Normal shaders ignore it, but Three still uploads all geometry attributes, so budget that extra byte per derived vertex even with colours off. No source GLBs are edited.
- Tint chains existing onBeforeCompile/cache-key hooks, overwrites final RGB only and preserves alpha, rig, morphs, depth, placements and LOD distances. Restore hooks exactly on switch-off/Exit/unmount; no texture disposal/material cloning. Water, procedural sand and effects are not GLBs and are not tinted. Scope is the reserve, not a separate Atlas view.

## Honest measurements

`PerformanceDiagnostics` mounts whenever debug is active and the tank is visible/unpaused; it is independent of tab selection. Switching tabs does not restart sampling or clear metrics. Exit/hidden/paused/screenshot mode unmount it and restore renderer-info settings. No positive useFrame priority and no render-loop takeover.

- FPS counts Canvas frames through R3F callbacks, not an independent requestAnimationFrame counter. Mean frame interval includes browser scheduling/vsync/GPU stalls. Still not a display scan-out or GPU-completion count.
- CPU frame is mean synchronous R3F callback/render submission time in ms, measured between R3F before/after hooks. It does not mean CPU usage %, per-core load, asynchronous work or total browser CPU.
- GPU ms uses EXT_disjoint_timer_query_webgl2, at most one pending query and at most two samples/s. Poll availability without blocking; invalidate disjoint/context-lost results; release owned queries. Missing extension/result displays unavailable, not a fake estimate. Device-wide GPU utilisation/VRAM are unavailable.
- JS heap uses performance.memory.usedJSHeapSize when supported. It is not total RAM, decoded texture memory, GPU memory or RSS. Other browsers may report unavailable.
- Draw calls/triangles are renderer.info sums across the latest complete active-canvas frame (including multipass). Temporarily disable automatic per-render resets, reset at frame start and restore the previous setting on cleanup. Resident geometry/texture counts are object counts, not bytes; DPR is renderer pixel ratio.
- GPU timing, overlays and recompiling tint themselves have overhead. Software-GPU/browser-emulation results do not measure physical-phone FPS, latency, heat or touch feel.

## Tests and review

Run npm test, npm run lint, npm run build, npm run verify:procedural-fish-assets, git diff --check. Rust gates inapplicable: no Cargo manifest.

- Pure/SSR tests: curated population/dead rows, exactly three overlay switches/two sections, persistent source/error text, selected-only readout, contextual Bask, truthful unavailable metrics and full LOD legend.
- Actual Fish callback test: 180 fixed frames per mode; exact motion equivalence, slug/display-name identity, normal distant LOD despite diagnostic colours and removed Force prop, selected-only getter/steering and cleanup. The PR review regression covers an unpaired mahi: normally schooling species still report their live solo behaviour, with identical movement with/without inspection. GPU rendering is not simulated by this test.
- Frame/GPU tests: count submitted frames only, CPU duration, unsupported/pending/disjoint/context-lost timers, external-query ownership and cleanup.
- Real Fish material-helper regression: repeated normal/grey/off/pink/off cycles preserve authored colour/emission and remove the diagnostic shader on every off path. Scalar diagnostic tint/emission writes removed; all colours are final-RGB overrides only.
- Shader/geometry tests: chain procedural callbacks/cache keys, retain uniforms, exact restore; all tiers survive merging with unchanged positions.
- Existing full suite includes the 218-ray renderless school soak and procedural asset contracts. No data writes.

Browser evidence/remaining gates are recorded with the PR and in external debug-menu-qa-v3 evidence. Local production preview uses missing-env fixtures, not live tables. Cold selection before startup readiness can leave the existing selector picked; waiting for startup then selecting normally works (selector/App/loading code unchanged). Human visual/phone review remains open. Remote CI/deployment must be verified on the exact pushed commit; preview login protection is not deployed-app smoke.
