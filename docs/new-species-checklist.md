# New species feature checklist

Use this for every new World Oceanarium species. Work through it in order; a species is not complete because its GLB merely loads.

## 0. Felt intention

Write this before implementation:

- **What should watching it feel like?** Name a concrete quality: darting tension, patient weight, synchronized shelter, wary solitude—not a genre label.
- **Why does that fit the animal?** Tie the feeling to an observed biological trait or habitat pressure.
- **What must *not* happen?** Record the obvious wrong read (for example, a Mako must not undulate like an eel; a Mola must not hover like a balloon).
- **Reference species:** choose the closest existing implementation only as a structural starting point, never as a behavioral clone.

## 1. Research and species facts

- [ ] Confirm canonical scientific-name slug, common name, family, and IUCN status from reliable sources.
- [ ] Establish useful, source-safe values for range/habitat, depth, diet, social grouping, reproduction, adult/max length, weight, and lifespan.
- [ ] Separate confirmed facts from unknowns. Use `Unknown` / `N/A` rather than invented precision.
- [ ] Fill the Atlas **Averages** and **Lifecycle** as fully as sources allow (Jeremy: never leave a fish's average size Unknown just because FishBase has no sex split):
  - Size: sex-specific from a study when one exists (a growth-curve mean asymptotic length counts), else FishBase common length or a published catch mean for both sexes. With no measured average, use FishBase's life-history estimate L_opt (Froese & Binohlan 2000) and label it estimated.
  - Weight: a length–weight relation (FishBase Bayesian a, b, or a species study) evaluated at that size.
  - Life expectancy: each sex's oldest aged fish; the unsexed maximum age for both if that is all there is.
  - Estimates (FishLife, Froese & Binohlan) only where they pass a check against the species' measured values; genus- or family-level FishLife ages and length formulas for remoras failed.
  - Sterility "None known" when nothing is published. Cite every value in a comment beside it, and credit the study in `STUDY_CREDITS`.
- [ ] Write concise, value-bearing Atlas copy. Keep ranges and units consistent with existing fields.
- [ ] Decide intended tank/assemblage role: prey, schooling midwater fish, solitary grazer, predator, cleaner, background resident, etc.
- [ ] Confirm live population / school count and sex variation requirements with Jeremy before any production data write.

## 2. Asset intake and scale contract

- [ ] **Compute the animal's size in world units before anything else** (`1 WU = 25 cm`) and compare it against the smallest shipping species, Spotted Sardinella at `1.08` WU / 27 cm. If it lands far below that, resolve it now — pick a larger species in the group, accept it as a near-camera-only detail animal, or conclude it does not earn a tank slot. A motion design built around detail the viewer cannot resolve is wasted work.
- [ ] Inspect the supplied GLB before adding data: mesh names/counts, vertices, materials, bounds, root orientation, bones/skinning, clips, and source length.
- [ ] Textures: list every embedded image's size and name. Shrink oversized photo textures (a fish this size is about 2 MB in all); an image named after a Commons/Flickr file needs its licence looked up and credited.
- [ ] Alpha: measure the texture's alpha. If it is solid, leave `alphaBlend`/`alphaTest` off and drop BLEND; `alphaBlend` on a model whose body and fins share one material draws the far side over the near.
- [ ] Normals: measure the share of vertex normals pointing away from the mesh centre. Supplied exports have come in inside out (re-check every re-send); flip the winding and normals if so. Flat shading is the intended art style, never a defect to smooth.
- [ ] A coral or other rooted model marks its root with the object origin: use it as the holdfast, never a computed lowest point.
- [ ] Confirm provenance is recorded as supplied/approved; do not invent licensing claims.
- [ ] List every image embedded in the GLB (name, size) and look at each one. Remove anything that is not the animal (logos, watermarked comps, screenshots); if a material samples only a corner of one, cut that corner out and remap the UVs.
- [ ] Credit every photo texture in `IMAGE_CREDITS` (`src/data/sources.js`) in the build that ships it: the full credit, or an entry with no `url` that shows "Unknown source" plus a ROADMAP item to find it. Generated images are not listed.
- [ ] Put the runtime asset at `public/models/fish/<scientific-slug>/` and update the relevant preload only when startup cost is justified.
- [ ] Set model transform, real-world scale (`1 WU = 25 cm`), body length, and source-length measurement deliberately.
- [ ] Ensure the authored root/origin is at the intended follow point—normally the body/swim pivot; if it is used for camera follow, it must be visually meaningful.
- [ ] Define follow targeting explicitly: root-follow for rig-free/static models; configured named bone only when the bone is real and intended.
- [ ] Add a species-specific Atlas pose and source-length entry whenever the default clips, hides, or makes scale unreadable.
- [ ] Verify no deprecated assets are still eagerly fetched and no removed clips/bones are assumed at runtime.

## 3. Procedural animation and motion feel

- [ ] Choose animation architecture from the inspected asset: authored clips, procedural bone pose, static GPU deformation, or a deliberate hybrid. Do not infer it from a species template.
- [ ] For any rig-free/procedural asset, identify its motion type in the index at [`docs/procedural/README.md`](procedural/README.md) and work that type's doc for the Blender contract, vertex-paint channels, config keys, and review gates.
- [ ] **If no existing type covers the motion, stop.** Write the new type doc and confirm the approach with Jeremy before implementing it. `npm run verify:procedural-fish-assets` fails on a procedural type with no written contract. If the motion is a config of an existing type, use that type rather than adding one.
- [ ] When proposing a new type, name the closest existing type and say why it does not fit. "It is a different animal" is not a reason — the split is by motion architecture, and unrelated animals often share one.
- [ ] State which layer actually produces thrust and which layers are decoration. Several moving parts with no named engine produces an animal that moves without swimming.
- [ ] Define the locomotion driver: caudal/body wave, fin rowing, ray undulation, glide, pulsation, hovering, etc.
- [ ] Map live movement state into animation: speed, acceleration, turn direction/onset, burst intent, drift/idle state, and stable per-creature phase.
- [ ] Keep idle/drift visibly different from active forward cruise.
- [ ] Make anatomy lead the motion: rigid front/flexible tail where appropriate; separately driven fins when they are the animal's propulsion.
- [ ] Give schools stable phase/rate variation so they do not move as one synchronized machine.
- [ ] Check bursts, turns, stop/recovery, surface/depth limits, and slow movement—not only a looping cruise.
- [ ] Verify on a real tank path that the animal translates with its pose: no tail-first travel, spinning in place, pop, fold, or timebase snapping.

## 4. Behavior must reflect facts

- [ ] Turn the research into a small behavioral contract: social mode, cruising layer, preferred depth, speed/turn character, feeding/predator avoidance, and any signature behavior.
- [ ] Set `swim` and boid values deliberately: body length, cruise/burst speed, turn radius, erraticness, neighbor cap, spacing, and interspecies response.
- [ ] Confirm the species has the right solo fallback as well as its school/pair behavior.
- [ ] If it rides other animals (remoras) or is ridden (sharks, rays, turtles, whales, billfish), declare `hitchhiker` or `rideHost` and follow [`ride-hosts.md`](ride-hosts.md). A new host needs anchors measured off its GLB.
- [ ] Check that behavior reads from a normal viewing distance without debug labels.
- [ ] Validate interactions with the existing tank: it must neither ignore every other animal nor create constant collisions/avoidance jitter.
- [ ] Compare implementation against the species facts and felt intention. If they disagree, change behavior—not the copy—to make the mismatch disappear.

## 5. Atlas must reflect the species

- [ ] Confirm identity and biological fields match the researched source of truth: names, conservation, habitat, diet, social behavior, size/weight/lifespan, and lifecycle/reproduction.
- [ ] Confirm sex-specific facts and model presentation where applicable.
- [ ] Ensure the Atlas model uses the same intended animation/deformation path as tank presentation, unless a documented presentation-specific simplification is necessary.
- [ ] Check that Atlas data contains no filler, false precision, stale placeholder values, or generic copy inherited from the template species.
- [ ] Verify scale comparison reads honestly against the typical-human reference.

## 6. Atlas viewport and responsive display

- [ ] Desktop: model is fully framed, recognizably oriented, and legible beside details/list without clipping fins, tail, or head.
- [ ] Portrait mobile: list-first flow works; selection opens detail; `← Species` returns to the list; no horizontal overflow.
- [ ] Landscape mobile: existing desktop-style Atlas layout remains usable unless a deliberate species-specific exception is designed.
- [ ] Capture the new species at desktop, portrait mobile, and landscape mobile. Inspect edge clearance, scale readability, text collision, and stage contrast.
- [ ] Confirm the specimen moves in Atlas when its intended presentation includes procedural motion.
- [ ] **Atlas list tile.** Capture `public/atlas/<slug>-thumbnail.png` as soon as the species swims in a tank, and set `atlasThumbnail` on the entry: a square three-quarter head close-up facing left, rendered with only the target fish visible (no other fish in frame), as the mako's and whale shark's are. Do it in the same build that first shows the species, not at promotion. `npm run build` runs `scripts/verify-atlas-tiles.mjs` first: it warns on a `-dev_` version and fails a clean version while any Atlas species has no tile.
  - How: render it rather than waiting for a lucky pose. In the dev tank, freeze `performance.now`, grab `{ scene, camera, renderer }` through an `onBeforeRender` hook, hide points, instanced meshes and every other small mesh (keep water and background), place a fresh `PerspectiveCamera` (fov about 40) a few WU beside and ahead of the head, render, and call `toDataURL()` in the same task (the drawing buffer is not preserved, so a later read is blank). Restore visibility. Crop square with a little margin round the snout, about 470 px, and check the PNG by eye before committing.
  - A landscape species (coral) uses an in-tank close-up of it in place, not an isolated render.

## 7. Creature data and release safety

- [ ] For `creatures_dev` or production `creatures` writes: back up before and after, use canonical scientific slug, and read back IDs/counts/species values.
- [ ] Never change public Supabase data unless specifically requested.
- [ ] Add dev review rows only when the review build actually reads them; static fallback is not proof when configured Supabase data wins.
- [ ] Keep this work on its own `species/<scientific-name>` branch (one species per branch, AGENTS.md) and release as a `-dev` review build until explicit approval.
- [ ] After any production `creatures` write, update ROADMAP, CHANGELOG and the species docs that state production counts in the same session; never leave them saying the write is pending.

## 8. Verification evidence

- [ ] Run `npm run verify:procedural-fish-assets` when the species uses the static/procedural asset path. It checks both the GLB contract and that every shipping procedural type has a doc in `docs/procedural/`.
- [ ] Run `npm run lint`, `npm run build`, and `git diff --check`.
- [ ] Browser smoke: asset loads, intended creature source is used, species appears in tank and Atlas, follow target is centered, and browser has no new runtime errors.
- [ ] Capture before/after screenshots or video for movement, follow framing, and Atlas framing across required viewports.
- [ ] Check GitHub Build and Vercel on the review commit after push.
- [ ] Before clean release: rebase latest `origin/main`, rerun gates, get explicit Jeremy/YK approval, promote version/changelog/roadmap together, merge, delete branch, and verify main deployment.
- [ ] Release hygiene (AGENTS.md): both changelogs updated, and every visitor line true of production (nothing only `creatures_dev` shows); the species' ROADMAP section moved out of Current work; the entry appended at the end of `SPECIES`, its header comment matching what shipped; merged through the PR so the title ends in `(#N)`.
- [ ] Nothing outside the codebase is committed: reel and social briefs, book materials and the like go to Jeremy in chat (AGENTS.md, Release hygiene).

## Review handoff

Report these plainly:

- Species + intended feeling.
- Biological/behavioral contract and any deliberate simplification.
- Asset contract: scale, animation path, root/bone follow target, and Atlas pose.
- Screenshots/video: tank, desktop Atlas, portrait mobile Atlas, landscape mobile Atlas.
- The Atlas list tile (the new `public/atlas/<slug>-thumbnail.png`).
- Exact checks run and their result.
- Review URL/version/commit, with clear distinction between technical gates and requested visual/feel approval.
