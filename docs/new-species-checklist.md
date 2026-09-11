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
- [ ] Write concise, value-bearing Atlas copy. Keep ranges and units consistent with existing fields.
- [ ] Decide intended tank/assemblage role: prey, schooling midwater fish, solitary grazer, predator, cleaner, background resident, etc.
- [ ] Confirm live population / school count and sex variation requirements with Jeremy before any production data write.

## 2. Asset intake and scale contract

- [ ] Inspect the supplied GLB before adding data: mesh names/counts, vertices, materials, bounds, root orientation, bones/skinning, clips, and source length.
- [ ] Confirm provenance is recorded as supplied/approved; do not invent licensing claims.
- [ ] Put the runtime asset at `public/models/fish/<scientific-slug>/` and update the relevant preload only when startup cost is justified.
- [ ] Set model transform, real-world scale (`1 WU = 25 cm`), body length, and source-length measurement deliberately.
- [ ] Ensure the authored root/origin is at the intended follow point—normally the body/swim pivot; if it is used for camera follow, it must be visually meaningful.
- [ ] Define follow targeting explicitly: root-follow for rig-free/static models; configured named bone only when the bone is real and intended.
- [ ] Add a species-specific Atlas pose and source-length entry whenever the default clips, hides, or makes scale unreadable.
- [ ] Verify no deprecated assets are still eagerly fetched and no removed clips/bones are assumed at runtime.

## 3. Procedural animation and motion feel

- [ ] Choose animation architecture from the inspected asset: authored clips, procedural bone pose, static GPU deformation, or a deliberate hybrid. Do not infer it from a species template.
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

## 7. Creature data and release safety

- [ ] For `creatures_dev` or production `creatures` writes: back up before and after, use canonical scientific slug, and read back IDs/counts/species values.
- [ ] Never change public Supabase data unless specifically requested.
- [ ] Add dev review rows only when the review build actually reads them; static fallback is not proof when configured Supabase data wins.
- [ ] Keep this work on a `feat/...` branch and release as a `-dev` review build until explicit approval.

## 8. Verification evidence

- [ ] Run `npm run verify:procedural-fish-assets` when the species uses the static/procedural asset path.
- [ ] Run `npm run lint`, `npm run build`, and `git diff --check`.
- [ ] Browser smoke: asset loads, intended creature source is used, species appears in tank and Atlas, follow target is centered, and browser has no new runtime errors.
- [ ] Capture before/after screenshots or video for movement, follow framing, and Atlas framing across required viewports.
- [ ] Check GitHub Build and Vercel on the review commit after push.
- [ ] Before clean release: rebase latest `origin/main`, rerun gates, get explicit Jeremy/YK approval, promote version/changelog/roadmap together, merge, delete branch, and verify main deployment.

## Review handoff

Report these plainly:

- Species + intended feeling.
- Biological/behavioral contract and any deliberate simplification.
- Asset contract: scale, animation path, root/bone follow target, and Atlas pose.
- Screenshots/video: tank, desktop Atlas, portrait mobile Atlas, landscape mobile Atlas.
- Exact checks run and their result.
- Review URL/version/commit, with clear distinction between technical gates and requested visual/feel approval.
