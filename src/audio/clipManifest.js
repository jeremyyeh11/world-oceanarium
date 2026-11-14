// Recorded clips, derived from src/audio/clipCatalog.json (written by
// scripts/build-audio-clips.py, never edited by hand) through the use table in
// src/audio/clipUses.js. Nothing here repeats a path: a clip is wired by its catalog `use`.
//
// - EVENT_CLIPS: the event layer's pools by archetype (src/audio/eventScheduler.js). Each
//   entry is a public path without extension; the loader tries `.webm` (Opus), then `.m4a`,
//   then `.mp3`. A pool is loaded once per session, the first time a reserve that plays the
//   archetype is entered. While a pool is empty (or none of its clips decode), that
//   archetype plays its procedural synth voice instead. `thup` stays empty on purpose (its
//   clips are provisional and unheard), so the Open Sea thup is synthesised.
// - bedLayersFor(profileId): the recorded layers of one reserve's bed, each the catalog's
//   path and loop points joined with the profile's own gain and pan for that clip id
//   (src/audio/ambienceProfiles.js `files`).
// - FISH_SFX_URLS, UI_SFX_URLS: the older MP3s, played by useOceanAudio.js as before.
//
// Every shipped clip is listed in docs/audio-clips.md and credited in the Sources modal
// (SOUND_CREDITS); both derive from the same catalog (AGENTS.md, Release hygiene).
import CLIP_CATALOG from './clipCatalog.json'
import { AMBIENCE_PROFILES } from './ambienceProfiles'
import { bedClips, eventClipPaths, legacyClipUrls } from './clipUses'

export { CLIP_CATALOG }

// Gain and pan for a catalog bed clip the profile does not mention: low and centred, so
// a newly built bed is heard faintly rather than at full level before it is mixed.
const UNMIXED_BED_LAYER = { gain: 0.15, pan: 0 }

const eventPools = eventClipPaths(CLIP_CATALOG)

export const EVENT_CLIPS = {
  grunt: eventPools.grunt ?? [],
  knock: eventPools.knock ?? [],
  thup: eventPools.thup ?? [],
  click: eventPools.click ?? [],
  bubble: eventPools.bubble ?? [],
  bloop: eventPools.bloop ?? [],
}

// { id, src, loop: [start, end] | null, gain, pan } per recorded layer of the profile's bed.
export function bedLayersFor(profileId) {
  const mix = AMBIENCE_PROFILES[profileId]?.files ?? {}
  return bedClips(CLIP_CATALOG, profileId).map(clip => {
    if (!mix[clip.id] && import.meta.env?.DEV) {
      console.warn(`Ambience bed layer ${clip.id} has no gain in ambienceProfiles.js; playing it low`)
    }
    const { gain, pan } = { ...UNMIXED_BED_LAYER, ...mix[clip.id] }
    return { id: clip.id, src: clip.path, loop: Array.isArray(clip.loop) ? clip.loop : null, gain, pan }
  })
}

const legacyPools = legacyClipUrls(CLIP_CATALOG)

export const FISH_SFX_URLS = {
  turn: legacyPools['fish-swim:turn'] ?? [],
  burst: legacyPools['fish-swim:burst'] ?? [],
}

export const UI_SFX_URLS = {
  click: legacyPools['ui:click'] ?? [],
}
