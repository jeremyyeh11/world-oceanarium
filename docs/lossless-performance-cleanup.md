# Lossless performance cleanup — review evidence

Review build: `v0.31.2-dev_3`, branch `feat/lossless-performance-cleanup`, PR #142.
Baseline: main `9e7cc1f` (`v0.31.0`). Tracking: #141.

## Intended experience

Unchanged fish appearance, motion, water, controls and pacing. Reduce invisible bookkeeping and transfer bytes without trading visual quality for speed.

## Material pass

- Cache mesh targets per fish instead of traversing its full group/bone hierarchy every frame.
- Read each cached mesh's **current** material or material array. `FishModel` can replace materials after mount or a debug-setting change; caching those material objects forever would be incorrect.
- Preserve depth-graded environment intensity, fade opacity, transparency/depth-write thresholds, proxy exclusions, traversal order, shared-material writes and every-frame cadence. No dirty-value write suppression.
- Observe `childadded` / `childremoved` on all nodes (Three.js events do not bubble). Nested async model/LOD/debug swaps invalidate the target list; refresh on the next material pass. Unmount/root replacement removes listeners and references. No GPU-resource ownership changes.
- Tests compare the old pass with the new pass at full opacity, the 0.999 boundary and fades; cover hidden meshes, alpha blending, array/null/shared materials, material/array replacement, proxy-flag changes, nested add/remove, root replacement and cleanup/restart.
- Warm steady-state test: 100 unchanged frames, **zero hierarchy traversals**.

## Assets

Only PNG IDAT DEFLATE streams are recompressed. Exact filtered scanlines and all non-IDAT chunks are preserved, including IHDR bit depth/colour type, colour profiles/gamma, EXIF/text and credits. No image conversion, filtering changes, downscaling, requantization, lossy compression or geometry/animation changes.

`python3 scripts/optimize-glb-pngs.py --compare-ref 9e7cc1f` validates every changed GLB:
- exact non-PNG bufferView bytes (including geometry, skins, animation and embedded JPEGs);
- exact GLB semantics except buffer offsets/lengths needed for repacking;
- exact PNG metadata/format and decompressed filtered rows;
- identical decoded image dimensions, mode and pixel bytes via Pillow.

Smaller transfer does **not** imply lower decoded/GPU texture memory or fewer texture uploads. No resource deduplication is claimed: existing fish individuals already share textures, and keeping sampler/colour-space/ownership behaviour unchanged takes priority over speculative sharing.

Final comparison: **15 changed GLBs, 18 embedded PNGs**, 35,634,820 → 31,970,476 bytes. Saves **3,664,344 bytes (3.66 MB; 10.28% of these files)**. The two Mahi-mahi variants save 1,059,172 bytes each. Machine-readable per-file hashes/sizes: `docs/lossless-assets-verification.json`. Unchanged models are not included in these totals.

## Local browser/runtime evidence

- Original browser evidence below was recorded on `dev_1`; review fixes through `dev_3` change tooling/CI plus the version label, not runtime material logic or optimized GLB bytes. Fresh `dev_2` smoke also covered both tanks, phone Whitefin Atlas and fish-by-ID follow with no captured application errors; touch-driver input timed out, so physical/touch-scroll performance is still unverified.
- Production baseline and branch builds exercised at 1280 × 577, plus 375 × 812 phone emulation. Open Sea and Reefs render; Whitefin Sharksucker Atlas model renders with no page-width overflow on the phone viewport. Fish search/follow and Atlas navigation exercised.
- Live reef scene: 7 fish roots / 30 non-proxy material meshes, zero alpha/depth-write mismatches. Instrumented fish-root traversals for five rendered seconds: **zero** steady-state traversals.
- Four rendered tank swaps (Sea → Reefs → Sea → Reefs): old cached-node listeners return to **zero** on every unmount. Sea: 394 listened nodes / 103 roots / 151 frame subscribers; reef: 66 / 7 / 37, stable on revisit. Geometry counts 78 sea / 116 reef; textures 45 in both. These short checks demonstrate cache cleanup, not a universal memory-leak proof.
- No uncaught application errors/rejections observed. Local Vercel Analytics/Speed Insights scripts return expected 404s because Vercel serves them only on deployments.
- Local fixture uses the repository's bundled development creatures (baseline uses its existing missing-env fallback). No local Supabase writes or claims about production population equivalence.
- Server browser is ANGLE/Vulkan **SwiftShader**. Phone emulation verifies layout/interactions, not physical-phone graphics or scrolling smoothness. The browser's synthetic touch-scroll command timed out; no touch-scroll performance improvement is claimed.

Screenshots and tank-cycle JSON are retained in the agent workspace `lossless-qa/` evidence directory. Deployed-preview verification is reported in the PR.

## Validation commands

- `npm test`
- `python3 tests/glbPngOptimization.test.py`
- `npm run lint` — baseline and branch both have 8 existing warnings, zero errors.
- `npm run build`
- `python3 scripts/optimize-glb-pngs.py --compare-ref 9e7cc1f`
- `node scripts/benchmark-fish-material-pass.mjs`

Review hardening: CI now sets up Python 3.12/Pillow and executes the PNG tooling tests as well as the Node suites. The repacker/verifier deliberately rejects all declared or embedded GLB extensions until their independent storage semantics are supported, and checks BIN/view bounds and alignment. No current shipped model uses an extension. Comparison resolves the git baseline first; new files get a separate `no-baseline-not-equivalence-verified` entry, deleted files are listed explicitly and fail the gate, and invalid refs still fail. Validation uses explicit exceptions so `python -O` / `PYTHONOPTIMIZE` cannot silently disable equivalence checks. Regression cases cover declared/undeclared meshopt ranges, malformed views/buffer declarations, additions/removals, invalid refs and optimized-mode mutation rejection.

Independent first-round review: runtime review found no additional actionable regression. Asset review independently confirmed all 15 committed models/18 PNGs and the manifest; it reproduced deleted-file omission and invalid buffer-declaration acceptance, both covered by the review hardening above. Parent also reproduced geometry/PNG corruption acceptance under `python -O` before replacing assertion gates. Second-round general/runtime review was clean; asset review caught boolean buffer indices passing Python's `False == 0` equality. Parent reproduced the related texture-source substitution as well. Buffer indices now require exact integer types, and normalized semantic comparison uses canonical JSON to retain boolean/number distinctions. Regressions include both cases under normal and optimized Python. Fresh review of this follow-up remains required; no merge/release approval is implied.

The default microbenchmark reproduces shipped GLB node/primitive hierarchies without rendering or texture decoding: 200 fish, evenly cycling through 22 fish GLBs, three runtime groups per fish (1,231 nodes / 594 meshes). Seven alternating 500-frame rounds after warmup: **25.17 ms baseline vs 5.45 ms cached** median for the entire round. Optional `--synthetic` stresses a 60-node hierarchy. Neither is real tank FPS, actual population weighting or a prediction for physical phones. Physical-phone feel/performance review remains separate.

## Rollback

Revert this branch's implementation commit (or the eventual squash PR) to restore the original material traversal and GLBs. No DB/schema changes; `creatures` and `creatures_dev` untouched. No changes to water, simulation/steering/cadence, LOD thresholds or user input.
