# Audio redesign: plan and clip list

Status: proposal, 2026-11-14. Phase 1 (engine) is in `v0.51.0-dev_1`, Phase 2 (event layer) in `v0.51.0-dev_2` and the first recorded clips in `v0.51.0-dev_3`; see [Phase 1 status](#phase-1-status), [Phase 2 status](#phase-2-status) and [Recorded clips](#recorded-clips). §1 describes the engine before them. Every shipped clip, with what it plays as, is listed in [audio-clips.md](audio-clips.md).

## 1. How it works today

- **Engine:** raw Web Audio in `src/hooks/useOceanAudio.js` (722 lines), called once from `src/App.jsx:85`. There is no Howler, no three.js audio and no positional audio.
- **Ambience:** fully synthesised, with no audio file behind it:
  - an 8 s brown-noise loop through a 360 Hz lowpass
  - a 42 Hz sine rumble
  - a 0.18 Hz swell LFO
  - all of it through a **1600 Hz master lowpass**
- **The same ambience plays in every tank:** Open Sea, Reefs, Shallows and Kelp.
- **Files:** 9 MP3s in `public/audio/`:
  - 3 small fish-movement clips and 2 big ones (`fish-sfx/`)
  - 4 UI clicks (`ui-sfx/`)
- **What makes a sound:**
  - a fish turn or burst (`Fish.jsx:4466-4510`). Only the school leader sounds, instanced sardines never do, and each fish has a 0.75 s throttle.
  - button clicks
- **Variation:**
  - each fish is hashed to one fixed clip
  - no pitch randomisation
  - follow mode opens the filter and raises the gain
- **Gaps:**
  - no spatial audio
  - no per-tank or per-species sound
  - mute is not persisted and there is no volume control
  - audio is not in the loading manifest
  - `pauseAudio` never suspends the context
  - the 1600 Hz master lowpass would cancel any distance filtering added on top of it

## 2. Design principles (from the research)

1. **Muffled-with-distance is a stylisation, not physics.** Real absorption across 50 m is about 0.04 dB at 10 kHz, which nobody can hear. Tie the lowpass to the **visual fog**, so the sound and the picture agree on what is "far".
2. **Underwater hearing is poorly directional:** errors of up to 90°, and front and back get confused. Keep the stereo image narrow (width 0.3–0.6). The fish you are following gets a little more width and brightness.
3. **Healthy reefs are loud and crackly.** Snapping shrimp crackle (2–20 kHz) plus fish grunts below 2 kHz, rising at dawn and dusk. Open water is near-silent and low.
4. **Few readable voices, many as texture.** The nearest 6–10 fish get real voices; everything else feeds a density-driven bed.
5. **Randomise everything:** which sample plays, pitch (±30–60 cents), gain (±3 dB), pan, and timing. Never repeat the same sample twice in a row.
6. **Use the equalpower panner, not HRTF.** HRTF is CPU-heavy on phones and wrong underwater anyway, because it adds outer-ear cues that divers do not get.

## 3. Clip list to collect

Licence rule: use only **CC0, CC-BY, NOAA (US government), Pixabay or Sonniss GDC** clips.
- Avoid Macaulay Library, Watkins, BBC Sound Effects, DOSITS, and anything marked NC (non-commercial).
- For every clip, record its title, author, URL and licence. CC-BY clips must be credited in the Sources modal.

Formats:
- Any download format is fine; we transcode on our side to Opus (WebM) plus an AAC (m4a) fallback.
- Beds should be 45–90 s long, with no memorable events inside them.
- One-shots: one sound per file, about 0.2–4 s long.

### A. Habitat beds (loops)

| # | Clip | Tank | Qty | Search terms (Freesound unless noted) |
|---|---|---|---|---|
| A1 | Open-water hydrophone bed, no boats | Open Sea | 1–2 | `hydrophone open ocean`, `underwater ambience deep`; MBARI Pacific Sound (CC-BY) |
| A2 | Snapping-shrimp crackle | Reefs, Kelp (filtered lower) | 2 different | `hydrophone snapping shrimp`, `coral reef hydrophone`; NOAA SanctSound Florida Keys |
| A3 | Reef water bed (gentle movement, faint life) | Reefs | 1 | `coral reef underwater ambience` |
| A4 | Underwater surf and wave wash | Shallows | 1 | `underwater waves hydrophone`, `surf underwater` |
| A5 | Seagrass fizz or bubble trickle | Shallows | 1 | `seagrass hydrophone`, `underwater small bubbles` |
| A6 | Swell surge (slow push and pull) | Kelp | 1 | `underwater surge`, `kelp hydrophone`; SanctSound Channel Islands |
| A7 | Descent bed (pressure, bubbles rising past) | Loading dive | 1 | `scuba descent underwater`, `diving underwater ambience` |

The low rumble can stay synthesised: the current 42 Hz plus noise patch works.

### B. One-shot pools (mono, several variants each)

| # | Archetype | Covers | Qty | Search terms / source |
|---|---|---|---|---|
| B1 | Swish, small and big | Every swimmer | +3 small, +3 big (on top of the existing 5) | `underwater swish`, `water whoosh underwater`, `fish swim underwater` |
| B2 | Sub-bass push / wingbeat | Whale shark, manta, mola, mako lunge | 3 | `underwater whoosh low`, `underwater impact deep`; Sonniss |
| B3 | School whoosh (many bodies turning) | Sardinella, trevally schools, devil-ray school | 3 | `school of fish underwater`, `underwater rush` |
| B4 | Low knock, grunt or boom (swim bladder) | Grouper, emperor angelfish, trevallies, tuna, mola | 5 | NOAA Fisheries "Sounds in the Ocean" (grouper, drum, toadfish); `fish grunt hydrophone` |
| B5 | Drum roll / pulse train | Clown triggerfish, bannerfish | 2 | `fish drumming hydrophone`; NOAA (black drum, silver perch) |
| B6 | High click or tick | Butterflyfish, remora attach, turtle squeak, ray click | 5 | `underwater click`, `hydrophone clicks` |
| B7 | Crunch, nibble or scrape (feeding) | Triggerfish, wrasse, unicornfish, angelfish, turtle grazing | 4 | `parrotfish eating coral`, `underwater crunch`, `fish feeding hydrophone` |
| B8 | Surface slap and splash, heard from below | Munk's devil-ray "tortilla" breach, mahi/tuna strike | 3 | `splash heard underwater`, `belly flop underwater` |
| B9 | Turtle breath at the surface (in air) | Green turtle `breathe` stage | 2 | `sea turtle breathing`, `turtle exhale` |
| B10 | Bubble burst (exhale cluster) | Diver hint, clam squirt, accents | 4 | `scuba exhale bubbles`, `underwater bubbles burst` |
| B11 | Small bubble bloops | Rock and seagrass sparkle | 4 | `single bubble underwater`, `bubble bloop` |
| B12 | Distant whale call | Open Sea, Kelp (rare) | 3 | MBARI humpback song (CC-BY); `humpback whale hydrophone` |
| B13 | Kelp creak / stretch | Kelp, close to the camera | 3 | `rubber creak`, `kelp`, `rope stretch underwater` (designed) |
| B14 | Dolphin whistle (optional) | Open Sea | 2 | `dolphin whistle hydrophone` |

### C. UI (dry, on their own bus)

| # | Clip | Qty | Notes |
|---|---|---|---|
| C1 | Clicks | keep the 4 | already in place |
| C2 | Modal open swell / close reverse-bubble | 1 + 1 | Pixabay `bubble whoosh` |
| C3 | Error / soft "bonk" | 1 | `SearchControl` already sends `variant: 'error'` |
| C4 | Select-fish "ping" (soft sonar-like) | 1 | plays on focus |
| C5 | Tank transition (dive in / surface out) | 1 + 1 | `underwater plunge`, `surface from underwater` |

The total is about 60 files. Download budget: under 1 MB at first load, then about 300–600 KB per tank, lazy-loaded when that tank is entered.

## 4. How to make it feel alive (procedural layer)

### 4.1 Beds that never loop audibly
- Two or three layers per tank, with **mismatched loop lengths** (for example 47 s, 61 s and 73 s), so the combined texture almost never repeats.
- Each layer starts at a random offset.
- A **slow random walk** on each layer's gain (±2 dB) and lowpass (±0.3 octave) every few seconds. Use a random walk, not a sine LFO, because sines read as mechanical.
- Crackle uses two different mono loops panned hard left and right, which is cheaper and less repetitive than one stereo loop.

### 4.2 An event scheduler instead of fixed loops
- Each tank has a **rate table**: how many grunts, clicks, bubbles and whale calls per minute. Triggers follow a Poisson process (random gaps around a mean), so they never fall into a metronome rhythm.
- The rates are modulated by:
  - **Time of day.** Dawn and dusk choruses multiply fish-call density by 1.5–2. The existing day state can drive this, or the real local clock.
  - **Life nearby.** The number of fish within fog distance scales how dense the bed and calls are.
  - **Calm vs alarm.** See "hush" in §4.4.
- **Call and response.** When a fish grunts, raise the chance of a second grunt 0.5–3 s later, from a different position and pitch. That imitates the territorial back-and-forth heard in real reef recordings. A third reply is rarer still. This one rule does most of the "conscious" work.

### 4.3 Per-voice variation
- Never play the same sample twice in a row.
- Pitch ±30–60 cents at random, **plus** a size offset: big fish −100 to −300 cents, small fish +100 cents. One grunt clip then covers both a grouper and a trevally.
- Gain ±3 dB, a 5–20 ms start jitter, and a random choice from the archetype pool.
- Each individual fish keeps a stable **voice seed** (the existing `hashString(creatureId)`), which biases its pitch. The same angelfish then always sounds like "itself", which reads as a character.

### 4.4 Sound tied to behaviour (hooks that already exist)

| Event (code) | Sound |
|---|---|
| Predator pass / threat startle (`threatLevelAt`, `THREAT_STARTLE_LEVEL`) | **Hush:** fish calls and crackle dip 4–6 dB and the call rate drops to about 20%, then recover over 6–10 s once the predator leaves. Add a school whoosh on the startle. This is the strongest "aware" cue. |
| School alarm wave (`raiseSchoolAlarm`) | One school whoosh at the school's centroid, not one per fish |
| Reef fish `peck` (`reefBehavior.js`) | Tiny nibble or crunch, close fish only |
| Triggerfish or angelfish aggression / close follow | Drum roll or 1–3 low knocks |
| Turtle `breathe` stage (`turtleSurfacing.js`) | Surface breath, heavily lowpassed (heard from below) |
| Manta feeding pass (mouth open) | Slow filtered water-rush layer for the duration of the pass |
| Remora `latch` / `release` | Click |
| Devil-ray breach (to add) | Surface slap and a bubble cloud |
| Fish selected / followed | Select ping. The bed ducks about 2 dB ("lean in"). That fish's voice gets wider and brighter. |
| Tank switch | 1–3 s crossfade of beds and reverb. The descent bed follows `DiveDescent` progress with a depth filter. |

### 4.5 Distance and depth
- **Voice pool:** 6–10 equalpower `PannerNode` chains (panner, lowpass, gain, reverb send). Every 100–200 ms the pool is reassigned to the nearest or most salient fish, with a 150 ms fade before a voice is reused. Fish outside the pool feed the density bed.
- **Panner settings:** `distanceModel 'inverse'`, `refDistance` about 1.5 m, `rolloff` 1. For big sources (whale shark, manta, schools) use `refDistance` 5–10 and `rolloff` 0.5–0.7.
- **Lowpass cutoff,** ramped with `setTargetAtTime`:
  ```
  fc = clamp(9000 · 2^(−d / D_oct) · 2^(−z / 25) · habitatTint, 250, 16000)
  D_oct = fogFar / 4        habitatTint: shallows 1.15, reef 1.0, kelp 0.85
  ```
  - d is the fish's distance from the camera and z is depth, both in metres.
  - With fog at 32 m, a fish 1 m away is about 7 kHz, 10 m about 3.3 kHz, and 30 m about 0.6 kHz.
  - Use Q = −3 (flat; Q is in dB for this filter type).
- **Extra gain** `2^(−d / (2·D_oct))` on top of the panner, so far sounds get quieter as well as duller, not only muffled.
- **Reverb:** one shared ConvolverNode per tank, with a procedural impulse response (decaying noise, no file).

  | Tank | Decay | IR lowpass | Extra |
  |---|---|---|---|
  | Shallows | 1 s | 3 kHz | 8–25 ms early reflections |
  | Reef | 1.5 s | 2 kHz | |
  | Kelp | 1.8 s | 1.4 kHz | |
  | Open Sea | 3 s | (not set) | low send |
- **Depth tint:** shallows get the surf and bubble layers and a brighter mix. Deeper water loses the surf and keeps the low rumble and rare distant calls. Diver mode can drive this live from the camera's Y position.

## 5. Engine prerequisites
1. Raise the 1600 Hz master lowpass to about 12 kHz, or remove it, and move the "underwater" tint into each bed.
2. Bus layout: `beds → world bus (M/S width) → master`, `voices → world bus + reverb send`, `UI → master` (dry).
3. Load Opus first and fall back to m4a when `decodeAudioData` throws. Don't trust `canPlayType`, because of iOS quirks.
4. Lazy-load each tank's pack and add audio to the environment loading manifest. Phase 1 lazy-loads only; manifest integration waits until real bed files exist, so audio can never hold up the visual loader in the meantime.
5. Persist mute in `localStorage` (wrapped in try/catch). Add one volume slider.
6. Make `pauseAudio` suspend the context when the page is hidden. If resume fails, show a "tap to resume" prompt.
7. Keep decoded beds short and mono where possible: 60 s of stereo is about 23 MB of RAM.

## 6. Phases

| Phase | Work | Size |
|---|---|---|
| 0 | Collect the clips (§3) and the credits sheet | ~3–4 h of browsing |
| 1 | Engine: buses, master-LP fix, per-tank bed loader, mute persistence | ~1 session |
| 2 | Scheduler: Poisson events, call and response, per-voice variation, day modulation | ~1 session |
| 3 | Spatial voice pool, distance and depth filter, reverb per tank | ~1 session |
| 4 | Behaviour hooks: hush, startle, peck, turtle breath, manta, remora, focus duck | ~1 session |
| 5 | UI sounds, volume slider, Sources-modal credits, phone tuning pass | ~½ session |

Phases 1 and 2 can ship using the synthesised bed and the existing 5 fish clips while clips are still being collected.

## 7. Species sound reference

| Species | Tank | Evidence | Archetype |
|---|---|---|---|
| Spotted Sardinella | Open Sea | Passive school noise (genus) | School whoosh |
| Mahi-mahi | Open Sea | No data | Swish, surface strike |
| Shortfin Mako | Open Sea | Silent (no sound organ) | Sub-bass push on lunge |
| Yellowfin Tuna | Open Sea | Captive study, peak about 263 Hz | Rare low thup, swish |
| Whale Shark | Open Sea | Silent | Sub-bass push, filter-feeding whoosh |
| Remoras (all) | All | Passive only / examined, none | Click on latch |
| Giant Sunfish | Reefs | Documented (pharyngeal grinding) | Rare low creak-grind |
| Pilot Fish | Reefs | Doubted | Swish |
| Longfin Bannerfish | Reefs | Genus documented, 100–1000 Hz pulses | Soft pulse train |
| Raccoon Butterflyfish | Reefs | Congeners: tail click about 2.7 kHz | Soft click |
| Emperor Angelfish | Reefs | Anecdotal loud knock | 1–3 low knocks |
| Clown Triggerfish | Reefs | Family drum roll, about 193 Hz | Drum roll, crunch |
| Squaretail Coral Grouper | Reefs | Family very vocal, 30–300 Hz | Boom at dusk |
| Humphead Wrasse | Reefs | Unverified | Crunch |
| Bluespine Unicornfish | Reefs | Congeners pulse | Nibble/scrape |
| Bluefin / Golden Trevally | Reefs / Shallows | Genus grunts, 25–250 Hz | Low grunt on attack |
| Munk's Devil Ray | Shallows | Silent, but loud breach slap | Surface slap, school whoosh |
| Giant Oceanic Manta | Shallows | Silent | Sub-bass wingbeat |
| East Pacific Green Turtle | Shallows | Documented 2022 (10 call types, quiet) | Surface breath, rare squeak, grazing crunch |
| Giant Clam | Reefs | Mechanical only | Bubble squirt |
| Corals | Reefs | Silent | Part of the reef bed |

Kelp Forest has no roster yet. Its bed is crackle, urchin scrape and surge.

## 8. Epidemic Sound as the library (blocked on licence)

Jeremy asked to prefer Epidemic Sound, where he holds a subscription. The catalogue was searched signed out (2026-11-14). Nothing was downloaded.

**Licence: unresolved, so do not ship Epidemic files yet.** Read from Epidemic's policy pages on 2026-11-14:
- **Which plans cover a web app:** Creator, Pro, Pro Plus and Business grant use in video and podcast productions only. "Apps & games" is listed under Business Plus and Enterprise only. Whether a browser web app counts as an "app" needs written confirmation from Epidemic.
- **No public files:** the "No standalone use" clause rules out files that third parties can download, so Epidemic audio can never be committed to this public repo. If it is used, keep the files out of git and serve them from private storage. The repo holds only a manifest (track id, title, download date, plan).
- **No edits:** the licence allows only cutting, looping and fading. Runtime pitch shifting, distance filtering, reversing or layering (§4.3, §4.5) may count as changing a clip's character. Epidemic clips would then have to be limited to unprocessed beds and UI sounds, or Epidemic must confirm that interactive processing is allowed.
- **Lapse:** after the subscription ends, no new versions may be made, and the general terms require copies to be removed. Treat the audio as usable only while subscribed, and keep a fallback ready.
- **Credit:** where reasonably possible, "Artist / Title / courtesy of Epidemic Sound" goes in the Sources modal.

**Top picks** (track URL `epidemicsound.com/sound-effects/tracks/<id>/`):
- A1 deep bed: Ambience, Underwater, Deep 01 `127d88ce-948f-47cb-877f-98e9e25ca787` (3:00)
- A4 surf wash: Water, Underwater, Wave, Rocky Cliff, Ocean Floor, Hydrophone `8fc10ace-b5ce-453e-800e-372ddd0b2549` (2:00)
- A5 bubble fizz: Ambience, Underwater, Small Bubbles 02 `6240c1b0-601e-4392-b4dc-1b3d9190ca00` (2:36)
- A6 current: Ambience, Underwater, Underwater, Current `6ed2b3ad-4954-48a6-b42a-91f87bdb18d1` (3:00)
- A7 descent: Ambience, Underwater, Deep, Bubbles 03 `e60238c6-77bc-4dac-be25-0bdfc10c4763` (3:15)
- B1 swish:
  - small: Movement, Hydrophonic, Glide Past 01–03 `e734b7d0-763c-4f46-896d-8bc5f7ab41c9`
  - big: Movement, Pass By 07 `74616ac5-c675-49c5-a911-80290b867826` (about 10 variants)
- B2 deep push and thump:
  - push: Whoosh, Organic, Deep, Bubble `bced34b5-3ed7-40a5-b5eb-7e5ed3ef9a3b`
  - thump: Underwater, Impact, Heavy Impact, Short 01 `9f8f4aea-e56c-47f9-9374-2644553b9e92`
- B6 click: Single Shrimp Energy Snap `d21a8b64-9f43-41c8-b44c-93d164e7869d`
- B8 splash from below: Underwater, Splash, Swimming, Big Splash, Dive 01 `38ef00ce-bc7a-4dad-9e4a-65d2fd9c0110`
- B10 exhale bubbles: Underwater Texture, Bubbles, Scuba Diving, Submarine, Deep 01 `190f9415-19d4-47e5-a4ee-f32b31cf8820`
- B11 bloop: Bubbles, Bubble, Single, Pop, Hydrophone `57d041bb-a82b-4619-a032-451b5e74f698`
- B12 whale: Whales, Humpback, Underwater, Distant, East Australia 04 `38cf48cd-163a-439f-8a53-ecf5f2cd7d99` (series 01–10)
- B13 creak: Underwater, Misc, Ship Squeak 01 `91dadf06-d140-4a65-9299-41e452cdeb90`
- B14 dolphin: Dolphin Yelling Underwater, Caribbean Sea `304f4c58-b43d-4374-a83d-189e6b5dfd9a`
- C2 modal sounds:
  - open: Whoosh, Organic, Bubble, Underwater 01 `dd9095a9-c6e8-449c-a4f7-9ce1f14b1615`
  - close: Weird Bubbles, Reversed 02 `6dffc139-5614-49d7-ad12-c93eab37faf1`
- C3 error: User Interface, Beep, Error Tone, Soft `17f72d25-b4a6-4d8f-addc-f446ee8b3cb7`
- C4 select ping: Submarine, Sonar, Modern, One Hit `6f6ef31d-e8b1-48c9-b026-fca1fe6510f8`
- C5 transitions:
  - plunge: Underwater, Dive In, Close, Bass, Hydrophone `41212567-b8aa-4233-ab55-41eccd437a0a`
  - surfacing: Splash, From Underwater To Surface 01 `64813f2e-c3c9-420a-8a81-e4ab32064631`

**Gaps Epidemic doesn't fill** (use Freesound CC0 or NOAA):
- A2 snapping-shrimp crackle: every crackle bed has a boat engine.
- A3 reef ambience.
- B4 fish grunts.
- B5 fish drumming.
- B7 underwater crunch.
- Weak matches: B3 school rush, B9 turtle breath.

Signed-out search shows only the top 10 results per query, so a signed-in search may find more.

## 9. Clip library: Freesound CC0 and NOAA (chosen 2026-11-14)

Jeremy chose Freesound CC0 and NOAA over Epidemic Sound. The clips cut from these picks, and which of them play, are in [audio-clips.md](audio-clips.md). Each Freesound licence below was read on the sound's own page. NOAA Fisheries recordings are made by the US government and carry no copyright. Recordings that a partner owns (LGL, Puerto Rico, AWI, Cornell) are excluded.

The top picks are the download batch. Freesound items are listed by sound id: the page is `freesound.org/s/<id>/` and the HQ preview is at `cdn.freesound.org/previews/…`. NOAA files sit under `fisheries.noaa.gov/s3/2023-04/`.

Beds:
- A1 open water: GirlWithSoundRecorder 773947 (Korcula, 6:44)
- A2 shrimp crackle: KaleidacousticsAudio 630436 (Hvar, 13:30) and MeliaRoger 867441 (Aber Wrac'h, at night, 10:08)
- A3 reef: NOAA `Sdsc01-…-GRNMS-…-soundscape-clip.mp3` (Gray's Reef: shrimp plus a fish chorus)
- A4 surf: L.Finck 815116
- A5 bubble fizz: KolbyRFX 852478
- A6 surge: KolbyRFX 852167
- A7 descent: sbvitug 634225

One-shots:
- B1 swish: JavierZumer 422657
- B2 deep thump: Sheyvan 470084
- B3 school rush: NapierFreesound 760849, as source material
- B4 fish calls (NOAA): red grouper `Epmo-pulses…`, toadfish `Opsp-tonal…`, cod grunt `Gamo-grunt…`
- B5 knock train (NOAA): haddock `Meae-knock…`
- B6 click (NOAA): snapping shrimp `Alsp-snaps…`
- B7 grazing: bruno.auzet 654439 (a winkle rasping seaweed)
- B8 splash heard from below: stuniverso 761566
- B9 breath: geraldfiebig 385796 (dolphin breaths stand in; no turtle recording found)
- B10 exhale: timsc 274491
- B11 bubbles: Valerie-Vivegnis 865358, JavierZumer 422666
- B12 humpback (NOAA): `Meno-song…`
- B13 creak: kyles 450258
- B14 dolphin (NOAA): Atlantic spotted dolphin `Stfr-Multisound…`

UI:
- C2 bubble rise: mosaichorse 486885 (reversed for close)
- C3 error: JonnyRuss01 478191
- C4 ping: nicorico_120 808185
- C5 plunge and surface: adviseme333 679404 and 679410

NOAA credit for the Sources modal: "NOAA Fisheries, NEFSC Passive Acoustics Branch. 2023. <Species>." plus the page URL.

Remaining gaps:
- No real school-rush recording: layer it.
- No turtle breath.
- No real fish-drum roll: the drum recordings are partner-owned.
- Designed sounds only for the thump, creak and UI.

## Sources (key)
- DOSITS: common sounds and Wenz curves, spreading loss, shallow-water reverberation (dosits.org)
- Gottesman et al. 2020, *MEPS* 654:35 (kelp soundscape); Butler et al. 2021, *Front. Mar. Sci.* (kelp, 2.5–7.5 kHz shrimp at dawn and dusk)
- *Frontiers in Remote Sensing* 2024 review (reef choruses); Gordon et al. 2019, *Nat. Commun.* (healthy-reef playback)
- Charrier et al. 2022, *Endang. Species Res.* 48:31 (green turtle calls)
- Parmentier et al. 2017 (triggerfish drumming); Parmentier et al. 2011 (bannerfish); Tricas & Boyle 2015 (butterflyfish)
- FishSounds.net species pages; NOAA Fisheries "Sounds in the Ocean"; NOAA SanctSound; MBARI Pacific Sound (CC-BY)
- Web Audio spec (PannerNode, BiquadFilter Q in dB); WebKit audioSession notes

## Phase 1 status

Shipped in `v0.51.0-dev_1` (branch `feat/audio-redesign`). Still synthesised: no new audio files.

- **Buses** (`useOceanAudio.js`, `buildAudioGraph`): beds → `bedBus` (0.18, the old ambient gain) → `worldBus` → `masterGain` → 12 kHz guard lowpass (`MASTER_LOWPASS_HZ`) → output. Fish SFX → `sfxGain` → 1600 Hz tint → `worldBus`. UI clicks → `uiBus` → 1600 Hz tint → `masterGain`, untouched by any reserve change. The two 1600 Hz tints copy the old master filter (Q 0.36 dB), so swims and clicks sound as before; new filters use Q −3.01 dB (flat). The debug meter's SFX level no longer includes UI clicks.
- **Profiles** (`src/audio/ambienceProfiles.js`): `default` (landing and selector, the old bed), `open-sea`, `the-reefs`, `the-shallows`. Each sets the noise lowpass, rumble frequency and gain, swell rate and depth, bed tint, bed gain, optional crackle and `files`. Kelp Forest is not on `main`; the file notes its intended settings.

  | Profile | Noise LP | Rumble | Swell (rate, depth) | Tint | Crackle (density/s, HP–LP, gain, width) |
  |---|---|---|---|---|---|
  | default | 360 Hz | 42 Hz, 0.055 | 0.18 Hz, 0.11 | 1600 Hz | none |
  | open-sea | 240 Hz | 34 Hz, 0.07 | 0.06 Hz, 0.07 | 1100 Hz | none |
  | the-reefs | 420 Hz | 44 Hz, 0.05 | 0.14 Hz, 0.10 | 6500 Hz | 14, 2300–7500 Hz, 0.9, ±0.7 |
  | the-shallows | 560 Hz | 50 Hz, 0.04 | 0.09 Hz, 0.26 | 4200 Hz | 4, 2500–6000 Hz, 0.6, ±0.5 |

- **Crackle:** two mono loops (7.3 s and 9.7 s) of sparse clicks with Poisson gaps, rendered once per profile, panned to ±width, through a highpass and lowpass. In a simulated render the reef crackle sits about 20 dB under the noise layer (RMS), the shallows about 33 dB under.
- **Drift and swell:** one self-rescheduling timeout every 3–5 s (`BED_DRIFT_*`) random-walks the bed level, crackle and file gains (±2 dB) and the tint and noise lowpass (±0.3 octave) with `setTargetAtTime`, pulled back toward the profile value. The swell is scheduled up to 7 s ahead on the bed's mix gain, each crest with its own length (±30%) and depth (±40%). Nothing runs per frame; the timer skips while the context is suspended. Every loop starts at a random offset.
- **Crossfade:** `useOceanAudio(viewingTankId)`; null means `default`. A switch builds the new chain, ramps it in and the old one out linearly over 2 s, then stops and disconnects the old chain 250 ms later. A chain caught mid-fade fades out from its current level. With the context not running, the swap is immediate.
- **Bed files:** `loadBedFile` fetches and decodes `${src}.webm`, then `${src}.m4a` if the fetch or decode fails, once per session, the first time a profile that lists the file is built. Each layer loops from a random offset and fades in over 1.5 s. Every profile's `files` is empty, so this path is inert.
- **Lifecycle:** page hidden or `pagehide` → fade, then `AudioContext.suspend()` after 560 ms; the existing foreground/gesture `startAudio` paths resume it (a rejected resume is caught and waits for the next gesture). Window blur only fades. The iOS unlock pulse and `audioSession` handling are unchanged.
- **Not in Phase 1:** mute persistence (needs a decision: it crosses the reload boundary in AGENTS.md), volume slider, spatial audio, the one-shot scheduler, new UI sounds.

## Phase 2 status

Shipped in `v0.51.0-dev_2` (branch `feat/audio-redesign`). Still no new audio files: every event voice is synthesised.

- **Routing:** event voices → `eventBus` (`EVENT_BUS_GAIN` 1, the one knob for the layer) → `worldBus`. Each voice is its content → distance lowpass → gain → narrow `StereoPannerNode` → `eventBus`. Events skip the 1600 Hz SFX tint; the distance lowpass replaces it.
- **Scheduler** (`src/audio/eventScheduler.js`, created in `ensureAudio`): one self-rescheduling `setTimeout`, sleeping until the next candidate (25 ms to 5 s); nothing per frame. Each archetype draws exponential gaps (mean 60 / rate s), floored at its min gap since its last event. While muted, stopped, suspended or hidden (`canPlay`), it polls once a second and drops whatever falls due, so nothing bursts on return. On a reserve switch the new rates apply at once, pending replies are dropped and sounding voices finish. At most 6 event voices sound at once (`MAX_EVENT_VOICES`); an event over the cap is skipped, not queued. Each voice disconnects all its nodes when its last source ends.
- **Rates** (events per minute; replies come on top), in `ambienceProfiles.js` `events.rates`:

  | Profile | grunt | knock | thup | click | bubble | bloop | Distance tint |
  |---|---|---|---|---|---|---|---|
  | default | | | | | 0.5 | | 1.0 |
  | open-sea | | | 0.6 | | 0.4 | 0.3 | 0.9 |
  | the-reefs | 4 | 2.5 | | 6 | 1 | 2 | 1.0 |
  | the-shallows | 0.5 | | | 3 | 2 | 3 | 1.15 |

  Min gaps (`EVENT_ARCHETYPES`): grunt 2.5 s, knock 3 s, thup 12 s, click 0.6 s, bubble 6 s, bloop 1.5 s. Grunts and knocks start call-and-response chains; grunt, knock, thup and click are fish calls (time of day).
- **Call and response:** a call is answered with probability 0.45 (a reply answered again with 0.2), never more than 3 in a chain, 0.5–3 s later. The reply is the same archetype from the same base pitch shifted 200–500 cents up or down (clamped ±700), panned to the other side (|pan| 0.15–0.5), at a freshly drawn distance. The reply chance scales with the current activity (below 1).
- **Time of day:** the visitor's local clock, rechecked every 60 s: dawn 05–08 and dusk 17–20 multiply fish-call rates ×1.6, night 20–05 ×0.8, day ×1. Chosen from §4.2 (dawn and dusk choruses ×1.5–2): ×1.6 is audible without crowding the layer; night is only a little quieter because reefs keep calling after dark (invertebrate and nocturnal fish activity), and silence would read as broken. Bubbles are not fish calls and keep their rate.
- **Activity:** `setEventActivity(multiplier, rampSeconds)` (exported, module state, default 1, clamped 0–4) ramps a multiplier on every event rate along a smoothstep from wherever the current ramp is. Rate changes use thinning: candidates are drawn at the highest rate the ramp reaches and each is kept with probability rate(now) / that ceiling; a new ramp re-draws pending candidates (exact, since the gaps are memoryless). `getEventActivity()` reads it. Phase 4's predator hush will drive it (about 0.2, recovering over 6–10 s); it is not wired to anything yet, and it changes rates only, not levels.
- **Virtual distance** (until the Phase 3 voice pool): d = 2 + 23·√u m (density rising with distance, mean about 17 m). Lowpass fc = clamp(9000 · 2^(−d/8) · tint, 250, 16000) Hz, Q −3.01 dB, with D_oct fixed at 8 m until the fog is wired; extra gain 2^(−d/16); pan uniform within ±0.5.
- **Variation:** events get ±50 cents, ±3 dB and a 5–20 ms start jitter (`src/audio/voiceVariation.js`); clip pools never repeat a clip twice in a row. Fish swims now pick a random clip (no immediate repeat) instead of a hashed one, with ±30 cents, ±3 dB and 5–20 ms jitter on top of the fish's own pitch: a stable bias of ±40 cents from `hashString(creatureId)` plus a size offset of −150 cents per doubling of body length from 0.4 m, clamped to −300…+100 (sardinella about +85, a 1 m fish about −200, 1.6 m and up −300). `Fish.jsx` sends `bodyLengthMeters`. The synth fallback follows the same pitch, gain and jitter. Throttles unchanged.
- **Synth voices** (peaks before the distance gain, `SYNTH_LEVEL`):
  - grunt (0.04): triangle or sine at 50–300 Hz (log-weighted low), glide ×1.4 → ×1 in 30 ms then down to ×0.78, 80–250 ms, 12 ms attack; a 40 ms band-passed noise burst (3× pitch, 200–900 Hz) at the onset; through a body lowpass at 5× pitch (500–1500 Hz).
  - knock (0.07): 1–3 hits (45/35/20%) 90–160 ms apart, sine at 80–180 Hz dropping from ×1.5 in 15 ms, 2 ms attack, gone in 80 ms, each hit 4% lower and ×0.8 quieter, plus a 900 Hz-lowpassed noise tick per hit.
  - thup (0.05): one knock at 55–110 Hz, gone in 180 ms.
  - click (0.3): white noise through a bandpass at 2–5 kHz (Q 2.5), 5–15 ms.
  - bloop (0.03): sine sweeping up from 300–500 Hz to 2.4–3.2× (at most 1400 Hz) over 40–120 ms, 2 ms attack, exponential decay.
  - bubble (0.024 per bloop, ×0.6–1): 3–8 bloops 25–90 ms apart, each 5–15% higher.
- **Levels:** set against an offline render (loudest 50 ms RMS, median of 15 draws, against the Reefs bed noise layer's RMS on the bed bus, about −42 dBFS): grunt about 0 dB median / +5 dB loudest, knock −3 / 0, thup −2 / 0, bloop and bubble −12 / −7, click −23 / −12. Never heard: the levels and the phone-speaker audibility of low grunts need a listen.
- **Clips:** `src/audio/clipManifest.js` maps each archetype to public paths without extension; `loadClip` (`src/audio/clipLoader.js`, also used for bed files) tries `.webm`, `.m4a`, then `.mp3`, once per session, when a reserve that plays the archetype is first entered. A pool with decoded buffers plays instead of the synth (playback rate from the voice's cents). Every pool is empty.
- **Dev probe:** in dev builds only, `globalThis.__oceanAudioEvents` is the live scheduler: `stats` (fired per archetype, replies, capped, thinned, dropped, active and peak voices) and `trigger(archetype)`. Vite strips it from production builds.
- **Not in Phase 2:** spatial voice pool and reverb (Phase 3), predator/turtle/peck hooks and the hush wiring (Phase 4), new UI sounds, mute persistence, life-nearby density modulation (§4.2).

## Recorded clips

Wired in `v0.51.0-dev_3` (branch `feat/audio-redesign`). Nothing has been heard: every level below comes from an offline render.

- **Source of truth:** `src/audio/clipCatalog.json`, written by `scripts/build-audio-clips.py` (never edited by hand), lists all 100 clips (91 new, 9 older MP3s) with source, licence, trim, loop points and sizes. `src/audio/clipUses.js` says what each catalog `use` does in this build (in use, staged or existing); `src/audio/clipManifest.js` derives the event pools, each reserve's bed layers and the older MP3 URLs from the two, so no path is written twice. The clip list ([audio-clips.md](audio-clips.md), `npm run audio:clip-list`) and the Sources modal's Sounds section (`SOUND_CREDITS`) derive from the same files.
- **Wired:** event pools grunt (red grouper, cod, toadfish: 12 clips), knock (haddock: 6), click (snapping shrimp: 6), bloop (6) and bubble (6); beds The Reefs (Hvar and Aber Wrac'h shrimp, Gray's Reef soundscape), Open Sea (Korcula) and The Shallows (surf, bubble flow). The landing gate and selector keep their synth-only bed.
- **Not wired (never fetched):** the Kelp Forest bed (the reserve is not on `main`), the descent bed, the haddock knock train, every `later:*` one-shot, the new UI sounds (Phase 5), and the `thup` clips, which are provisional and unheard: the Open Sea thup stays synthesised.
- **Loading:** unchanged in shape. A reserve's bed files are fetched on its first entry (WebM/Opus, then m4a), decoded once and cached for the session; an event pool loads the first time a reserve that plays it is entered (the landing's sparse bubbles load the bubble pool, about 16 KB, at the first gesture). A file that fails in both formats resolves to null and is skipped.
- **Bed loops:** each bed file holds its loop plus about 85 ms of codec padding at each end. A layer loops only between the catalog's `loop` points (`loopStart`/`loopEnd`) and starts at a random point inside the loop; looping the whole file would click.
- **Synth layers with recordings** (`withFiles` in `ambienceProfiles.js`): until a reserve's first recorded layer has decoded, its bed plays the full dev_2 synth layers, so a missing file never thins it. When the first layer fades in (1.5 s), the synth layers it duplicates ramp to their `withFiles` gains with it: The Reefs' procedural crackle goes to 0 (real shrimp replace it), its noise 0.9 → 0.7 and rumble 0.05 → 0.045 stay as glue; Open Sea and The Shallows lower only the noise (0.9 → 0.6, 0.88 → 0.6); the faint Shallows crackle stays.
- **Bed mix** (`files` in each profile, gain and pan per clip id; beds are all −20 LUFS integrated): Reefs Hvar 0.19 pan −0.6, Aber Wrac'h 0.3 pan +0.6, Gray's Reef 0.3 centred; Open Sea Korcula 0.38; Shallows surf 0.3, bubble flow 0.2. Hvar and Gray's Reef are heavily limited in the build (they may sound squashed), so they sit lowest.
- **Bed levels,** from an offline render of the bed chain on the bed bus (30 s, without drift or swell, approximate K-weighting, LUFS-like): totals stay within 0.4 LU of the dev_2 synth beds (Open Sea −38.9 → −39.3, Reefs −38.3 → −38.3, Shallows −38.8 → −38.7). Per layer: Reefs noise −42.7, rumble −43.4, Aber Wrac'h −46.2, Hvar −47.5, Gray's Reef −50.5 (the dev_2 crackle was −59.6); Open Sea rumble −42.5, noise −44.8, Korcula −45.7; Shallows rumble −43.5, noise −44.0, surf −44.4, bubble flow −49.3.
- **Event clip levels** (`CLIP_LEVEL` in `eventScheduler.js`, on top of the same distance gain and lowpass as the synth): clips are peak-normalised to −3 dBFS, so each archetype is scaled to land near its synth voice: grunt 0.074, knock 0.085, click 0.28, bloop 0.027, bubble 0.045. Measured with the real scheduler in an `OfflineAudioContext`: 61 triggers per archetype and mode, the same distance draws for synth and clip, loudest 50 ms RMS per voice. Clip minus synth (median / power mean / loudest, dB): grunt +1.5 / +1.2 / −0.9, knock −0.6 / −0.5 / −0.9, click −3.7 / −2.8 / −3.0, bloop +0.1 / −0.2 / +2.8, bubble −0.8 / −0.6 / −0.1. Repeat runs move about ±1.5 dB, clicks more (a near snap is broadband, a far one is cut by the distance lowpass).
- **Credits:** the Sources modal has a Sounds section, one row per source recording with clips in `public/audio` (31: 8 NOAA Fisheries with NOAA's credit line, 22 Freesound CC0 credited as a courtesy, and one row for the 9 older MP3s, whose source was not recorded). Staged recordings are listed too, since their files ship.
- **Still to check by ear,** on a phone: the bed loop seams (shallows-bubble-flow, shallows-surf and, when wired, descent-scuba are the ones to listen to), whether Gray's Reef and Hvar sound squashed, the event levels, and the thup clips before they are wired.
