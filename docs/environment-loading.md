# Budgeted environment loading

Review branch: `feat/budgeted-environment-loader`; target `v0.34.2-dev_5` (not a clean release).

## Intention and scope

The current ocean should keep swimming while the next location's source assets prepare. More environments should not mean more simultaneously running tanks, an all-assets startup download, or an unbounded decoded-asset cache.

The loading UI sits on top of this (`v0.35.0`): the tank selector (`EnvironmentSelector.jsx`), the per-visit loading screen (`EnvironmentLoader.jsx`) and the bottom-left Tanks button, wired in `App.jsx`. See **UI on top** below. No fish-count, movement, material-quality, water, resolution, data-source, or database changes.

This is loading infrastructure, not a claim that the reported phone first-entry delay or steady FPS is solved. GLTF parsing, image decoding and GPU work are different costs.

## Files and responsibilities

- `src/loading/environmentManifest.js`: data-driven catalog from `TANKS`, `SPECIES` model/sex/life-stage variants and landscape kits/maps. Source keys are `kind:url`; shared assets appear once per manifest and once in the cache.
- `src/loading/environmentLoader.js`: React/Three-independent queue, priority, cancellation, lifecycle, accounting and observable state. Injected adapter/clock/idle scheduler make it deterministic to test.
- `src/loading/environmentAssetAdapter.js`: abortable fetch; GLTF parsing with Draco/Meshopt support; texture decode; resource accounting/disposal. GLTF results retain `scene`, `animations`, `nodes`, `materials`, etc.
- `src/loading/environmentRuntime.js`: one browser controller, idle admission, visibility/save-data/frame-pressure hints, HMR cleanup.
- `src/hooks/useEnvironmentLoading.js`: navigation, immutable external-store snapshot, source hooks and mounted-consumer leases. Tanks and Atlas must share these hooks instead of creating independent global Drei preload caches.
- `TankView.WarmScene` / `compileEnvironmentScene.js`: safe synchronous shader preparation on the existing renderer, then first-submitted-frame acknowledgement. Never create a second Canvas/tank for prefetch.
- `Landscape.jsx`: derived merged-geometry/placement caches retire separately from GLTF sources when an environment drops out of the active/recent pair.
- `src/loading/runSlicedPreparation.js`: guards synchronous generator setup as well as sliced iteration, routes failures through rollback, and cancels pending slices on unmount.

## Lifecycle and UI contract

`useEnvironmentNavigation(initialId, prefetchOrder)` is instantiated once by `App`. `initialId` may be `null` (nothing loads until the first request); `prefetchOrder` is an optional ranked id list for the speculative hint. It returns:

```js
const { mountedId, requestEnvironment, state } = useEnvironmentNavigation(initialId, prefetchOrder)
```

Pass `requestEnvironment` to the selector/loading UI. Other UI components can read the same state with `useEnvironmentLoading()`; **do not instantiate a second navigation owner** just to show progress.

State fields:

- `activeId`: environment whose first frame was last acknowledged. During activation this can differ from `mountedId`.
- `requestedId`: latest requested destination, not necessarily displayed yet.
- `phase`: `idle` → `loading` → `assets-ready` → `activating` → `ready`; failures produce `error`.
- `error`: plain message or `null`. Source failure leaves the previous tank mounted; activation failure restores the last acknowledged tank. Failed, unmounted targets lose source/derived-cache protection instead of pinning an unusable destination indefinitely. Repeating `requestEnvironment(id)` retries failed source loads.
- `environments[id]`: `{ id, loaded, total, progress, assetsReady, sceneTasks }`. `progress` is 0–1 by **completed source asset count**, not byte transfer or total loading time. `sceneTasks` counts registered mount-time preparation barriers. Never label 100% as “scene ready”: construction, uploads and shader compilation can remain.
- `prefetchId`: the one speculative destination, or `null`. It may be only partially prepared.
- `cachedBytes`, `cachedAssets`, `overBudget`: controller accounting, **not measured process/GPU memory**.

`requestEnvironment(id)` resolves `{ id, status }`, where status is `assets-ready`, `cancelled`, or `error` (errors also include `error`). Unknown IDs are programmer errors. A superseded selection cannot activate later. `assets-ready` means navigation can mount the target; observe `phase === 'ready'` for first-frame acknowledgement.

The current tank is not replaced during source fetch/decode. After those complete, navigation mounts the target in the **same Canvas**; registered placement jobs commit, then `WarmScene` prepares shader variants. A following RAF acknowledges that a frame was submitted. This is not a physical display/presentation timestamp. A cold target can still hitch during construction/upload; there is no retained screenshot/crossfade/loading overlay in this patch. Do not interpret `assets-ready` as a promise of a seamless first frame.

The landing gate waits only on the creature fetch: it leads to the selector, not a tank, so no manifest or speculative request can lock it. Failed manifest loads do not mount source-consuming `Biome` components; the loading screen offers Retry (`requestEnvironment` again) and a way back to the selector without throwing that fetch error through the Canvas.

## Priorities, pressure and limits

Defaults live in `createEnvironmentLoader` and can be overridden at construction:

- Selected destination first, then active/mounted source consumers, then speculative work.
- At most **3** source tasks concurrently; background tasks start **one at a time** and only after foreground tasks finish.
- After the active first frame, prefetch the first id in `prefetchOrder` that is neither active nor fully loaded; without one, the next catalog neighbour. The selector supplies `prefetchOrder` from `utils/attentionOrder.js` (inverted-L attention over its live column count). No per-Reef eager preload block. Other intent signals can call `environmentLoader.prefetch(id)`; `prefetch(null)` cancels speculation. The hint is re-applied on a new ready transition or a new ranking, not every progress update.
- Speculative starts and post-network decode admission both wait for idle. A slow frame (>40 ms) suppresses new background admission for 1.5 seconds; hidden pages and `navigator.connection.saveData` suppress it too. Already-running decode cannot always be interrupted. Browsers without idle callbacks use a conservative delayed fallback; it is not a hard frame-time guarantee.
- Accounted decoded-source cache target: **192 MiB**, at most **80** resident/in-flight source assets. Per-visit speculative estimated admission: **64 MiB**. Default per-asset estimate: **16 MiB**, deliberately conservative and overridable on a manifest descriptor. Speculation may stop after a partial manifest; there is no promise to fully warm an arbitrarily large environment.
- Active, selected and mounted-consumer sources are pinned. **An oversized active environment may exceed the target**; the loader reports this instead of breaking a displayed scene. These limits do not make an oversized scene fit a low-memory phone.
- Prefer one recent environment's sources; older/unneeded unleased sources retire LRU-first, and even recent sources may be evicted under the byte/count target. HTTP browser cache remains browser-managed; this controller bounds its own decoded cache, not browser HTTP storage.
- Source hooks include a brief read-to-commit grace window for suspended React renders. Mounted consumers take real leases. Atlas can pin a shared fish even after its old tank retires; closing Atlas releases that lease. A foreground read or lease retries a cached speculative failure; a fresh viewer lease also retries a previous foreground failure. Repeated reads of a persistent foreground failure keep throwing that error rather than creating an infinite retry loop.
- A new selection cancels obsolete speculative/queued work, promotes shared pending work, and discards/disposes obsolete results that finish after cancellation. Repeated prefetch hints are idempotent; hints preserve shared sources still needed by the new destination. Foreground Atlas leases/reads also immediately promote a paused decode. Admission is rechecked when idle work actually starts, not only when queued. Fetch is abortable; GLTF/image decode is not assumed abortable. Already-active resources are never evicted just to satisfy a speculative budget.

Accounting counts geometry backing buffers and decoded RGBA/mip estimates. It excludes cloned/per-fish geometry/materials, derived terrain/BVHs, renderer render targets/programs, common HDR, transient response buffers/decoder scratch, browser caches and driver allocations. Resource disposal is a lifecycle operation, not proof of immediate memory return. Derived landscape caches have a separate active/recent retention policy; a superseded target that unmounts before acknowledgement also retires after its final mount lease ends. Lightweight fish snapshots remain in the existing runtime store.

## Adding an environment

1. Follow the new reserve checklist in `docs/tank-design.md` (copy, `depthMeters`, descent scenery). Declare its species in `SPECIES`, curate it in `TANKS`, and attach a landscape using the existing data layer. Current GLB/texture dependencies are collected automatically, including sex/life-stage variants.
2. If introducing a new dependency type (audio, a new texture role, external GLTF sidecars, a renderer-owned resource), extend the manifest collector and adapter explicitly; do not hide a module-scope `useGLTF.preload` inside a scene component. Current shipped GLBs are embedded/self-contained; sidecar request ownership/accounting is not implemented.
3. Use `useEnvironmentGLTF` / `useEnvironmentTextures` for source consumers, including future Atlas views. Clone mutable per-instance data as before; do not dispose the controller-owned original from a consumer.
4. Supply better `estimatedBytes` metadata when tuning admission for large assets. Changing budgets is a measured device-policy choice, not a claim that one setting fits all phones.
5. Extend deterministic tests and test actual cold/warm switches, rapid selection, failure/retry, Atlas overlap and resource retirement on-device.

## Remaining preparation work

- Network and source parse/decode preparation are integrated now. GLTF parse/image decode can still create an indivisible main-thread task even when admitted at idle. Moving suitable decoding to workers or changing asset packaging is a separate measured change.
- Existing rock merges and coral/staghorn placement still happen when the target mounts; the existing sliced placement hook is retained. Placement/BVH jobs register `beginPreparation(id, label)` barriers and release them after their generated results commit. First-frame readiness waits for those barriers and shader warm-up; it does not prematurely report a rocks-only reef as complete. New asynchronous scene construction must register/release a barrier (including cleanup) the same way. This patch does not claim all geometry is background-built.
- Shader compilation and uploads remain renderer-specific. The current Three `compileAsync` polls material state after teardown and can throw outside its Promise on a rapid switch; use synchronous `compile` until asynchronous compilation has explicit material-lifetime ownership. Compilation is not equivalent to uploading every texture or guaranteeing a presented frame. Common HDR stays owned by Drei's environment hook.
- Freezing a tank under a fully covering Atlas (the selector does freeze it; see below), native Atlas scrolling, adaptive resolution, texture compression and water/reef rendering optimization are separate scopes—not implemented here.

## Verification and rollback

`npm test` runs scheduler regressions covering selection priority, latest-wins, abort/late disposal, shared leases, budgets, pressure/idle gating, decode promotion, error/retry, source Suspense, retirement and future manifest registration. Existing Node/Python/asset/lint/build gates remain required. Browser smoke and physical-phone measurements are separate gates; software-renderer timings are not mobile performance evidence.

Rollback is the feature commit(s): restore the former source hooks/module preloads, direct tank selection and landing readiness together. Do not mix cache owners or roll back only the eviction side of this lifecycle.

## UI on top

- **Landing.** The gate is opaque and is only the Dive in button (live immediately, nothing to wait for). Dive in replaces the card with the descent at once (its scenery is the general montage in `src/data/descentScenery.js`); the diver starts at 0 m; the descent (`DiveDescent.jsx`) tracks the first reserve below (`utils/environmentProgress.js`: files 85%, build the rest) and the gate clears onto the selector once it is `ready` (at least 1.6 s; after 15 s it opens regardless).
- **Boot.** No tank is requested at startup. The selector mounts under the landing gate and reports its ranking (`onRank`); `App` requests the top-ranked tank as a normal selection, so it fetches, mounts hidden under the selector, warms and renders its first frame, then pauses. With the active tank ready, the loader prefetches the next-ranked one speculatively, within the budgets above (with the default 16 MiB per-asset estimate and 64 MiB speculative cap that is about four files per visit, not the whole tank).
- **Picking a tank.** Every entry shows the reserve's loading descent, the warm, paused tank included: there it has nothing to load and lands after the minimum hold (about 2.5 s). Any other tank opens the descent and `requestEnvironment(id)`; the old tank stays mounted, hidden and paused, until the new one's files are in, then the scene swaps in the same Canvas. The descent shows files (`loaded / total`), then "Building the reserve…" for `assets-ready`/`activating`, and clears on `phase === 'ready'` for that id (held at least 1.3 s). On `error` it shows the message with Retry and Reserves.
- **Back to the selector.** The tank is hidden (`TankView hidden`: window listeners off, follow released, `.tank-viewport.is-hidden`) and, once warm, paused (`paused`: `frameloop="never"`; `ResumeClock` restarts the r3f clock on resume). A hidden tank that has not rendered its first frame keeps rendering until it has, because `markRendered` needs a submitted frame.

