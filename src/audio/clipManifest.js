// Recorded one-shots for the event layer (src/audio/eventScheduler.js), by archetype
// (docs/audio-redesign.md §3 B). Each entry is a public path without extension, e.g.
// `${EVENT_CLIP_BASE}/grunt-01`; the loader tries `.webm` (Opus), then `.m4a`, then
// `.mp3`. A pool is loaded once per session, the first time a reserve that plays the
// archetype is entered. While a pool is empty (or none of its clips decode), that
// archetype plays its procedural synth voice instead.
//
// All pools are empty until the clips are collected (Phase 0). Credit every clip in
// the Sources modal when it is added (AGENTS.md, Release hygiene).

export const EVENT_CLIP_BASE = '/audio/events'

export const EVENT_CLIPS = {
  grunt: [],
  knock: [],
  thup: [],
  click: [],
  bubble: [],
  bloop: [],
}
