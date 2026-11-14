// What each clip in src/audio/clipCatalog.json does in this build, keyed by the catalog's
// `use`. One table drives the app wiring (clipManifest.js), the Sounds section of the
// Sources modal (SOUND_CREDITS in src/data/sources.js) and the clip list for review
// (docs/audio-clips.md, written by `npm run audio:clip-list`). The catalog itself is
// written by scripts/build-audio-clips.py: never edit it by hand.
//
// This module has no imports, so Node scripts can read it as it is.
//
//   status    'in use'   fetched and played in this build
//             'staged'   shipped in public/audio but never fetched yet (a later phase)
//             'existing' the older MP3s, played exactly as before the redesign
//   archetype the event pool it fills (src/audio/eventScheduler.js)
//   bed       the ambience profile whose bed it layers into (src/audio/ambienceProfiles.js,
//             where each layer's gain and pan are set)
//   legacy    which of the older MP3 pools it is (useOceanAudio.js): 'fish-swim:<type>' or
//             'ui:<type>'
//   label     short subject for the Sounds credits
//   where     for docs/audio-clips.md: what it is staged for, or the plain-words context of
//             an in-use clip (the script adds the reserves and rates from the profiles)
//
// A `use` missing here counts as staged (never fetched). When a use is wired, change its
// status here, then run `npm run audio:clip-list` (AGENTS.md, Release hygiene).
export const CLIP_USES = {
  'bed:the-reefs': { status: 'in use', bed: 'the-reefs', label: 'The Reefs ambience' },
  'bed:open-sea': { status: 'in use', bed: 'open-sea', label: 'Open Sea ambience' },
  'bed:the-shallows': { status: 'in use', bed: 'the-shallows', label: 'The Shallows ambience' },
  'bed:kelp-forest': {
    status: 'staged',
    label: 'Kelp Forest ambience',
    where: 'Kelp Forest bed (surge), when that reserve is on main',
  },
  'bed:descent': {
    status: 'staged',
    label: 'Dive descent ambience',
    where: 'descent bed under the dive loading screen (plan §4.4, tank switch), a later phase',
  },
  grunt: { status: 'in use', archetype: 'grunt', label: 'Fish grunts', where: 'grunts, with call and response' },
  knock: { status: 'in use', archetype: 'knock', label: 'Fish knocks', where: 'knocks, with call and response' },
  click: { status: 'in use', archetype: 'click', label: 'Shrimp snaps', where: 'single snaps' },
  bloop: { status: 'in use', archetype: 'bloop', label: 'Bubbles', where: 'single bubbles' },
  bubble: { status: 'in use', archetype: 'bubble', label: 'Bubbles', where: 'bubble clusters' },
  'knock-train': {
    status: 'staged',
    label: 'Fish knocks',
    where: 'knock train for triggerfish or angelfish aggression (plan §4.4, Phase 4)',
  },
  thup: {
    status: 'staged',
    label: 'Deep thumps',
    where: 'Open Sea thup: provisional and never heard, so the thup stays synthesised until a listen',
  },
  'later:swish': { status: 'staged', label: 'Swim swishes', where: 'more fish swim variants (plan §3 B1), Phase 3 or 4' },
  'later:deep-thump': { status: 'staged', label: 'Deep thumps', where: 'sub-bass push on big-animal lunges (B2), Phase 4' },
  'later:school-rush': { status: 'staged', label: 'School rushes', where: 'school whoosh on an alarm or startle (B3), Phase 4' },
  'later:grazing': { status: 'staged', label: 'Grazing', where: 'reef fish peck and turtle grazing (B7), Phase 4' },
  'later:splash-below': { status: 'staged', label: 'Splashes from below', where: 'devil-ray breach and surface strikes (B8), Phase 4' },
  'later:breath': { status: 'staged', label: 'Breaths', where: 'green turtle breath at the surface (B9, dolphin breaths standing in), Phase 4' },
  'later:exhale': { status: 'staged', label: 'Bubble bursts', where: 'exhale bubble bursts (B10), Phase 4' },
  'later:humpback': { status: 'staged', label: 'Whale song', where: 'rare distant whale call in the Open Sea (B12), a later phase' },
  'later:creak': { status: 'staged', label: 'Creaks', where: 'kelp creak in the Kelp Forest (B13), a later phase' },
  'later:dolphin-whistle': { status: 'staged', label: 'Dolphin whistles', where: 'optional dolphin whistle in the Open Sea (B14)' },
  'ui:modal-open': { status: 'staged', label: 'Interface sounds', where: 'modal open (C2), Phase 5' },
  'ui:modal-close': { status: 'staged', label: 'Interface sounds', where: 'modal close (C2), Phase 5' },
  'ui:soft-error': { status: 'staged', label: 'Interface sounds', where: 'soft error (C3), Phase 5' },
  'ui:select-ping': { status: 'staged', label: 'Interface sounds', where: 'select-fish ping (C4), Phase 5' },
  'ui:plunge': { status: 'staged', label: 'Interface sounds', where: 'dive in on a tank transition (C5), Phase 5' },
  'ui:surface': { status: 'staged', label: 'Interface sounds', where: 'surface out on a tank transition (C5), Phase 5' },
  'fish-swim:turn': {
    status: 'existing',
    legacy: 'fish-swim:turn',
    label: 'Fish swims',
    where: 'fish swim sound on a turn (Fish.jsx), any reserve; unchanged',
  },
  'fish-swim:burst': {
    status: 'existing',
    legacy: 'fish-swim:burst',
    label: 'Fish swims',
    where: 'fish swim sound on a burst (Fish.jsx), any reserve; unchanged',
  },
  'ui:click': { status: 'existing', legacy: 'ui:click', label: 'Interface clicks', where: 'button clicks; unchanged' },
}

const STAGED = { status: 'staged', label: 'Other sounds', where: 'not wired (no entry in src/audio/clipUses.js)' }

export function clipUse(use) {
  return CLIP_USES[use] ?? STAGED
}

export function isClipInUse(clip) {
  return clipUse(clip.use).status !== 'staged'
}

// Public paths (no extension) of the in-use event clips, by archetype.
export function eventClipPaths(catalog) {
  const pools = {}
  for (const clip of catalog) {
    const use = clipUse(clip.use)
    if (use.status !== 'in use' || !use.archetype) continue
    if (!pools[use.archetype]) pools[use.archetype] = []
    pools[use.archetype].push(clip.path)
  }
  return pools
}

// Catalog entries of the in-use bed layers for one ambience profile, in catalog order.
export function bedClips(catalog, profileId) {
  return catalog.filter(clip => {
    const use = clipUse(clip.use)
    return use.status === 'in use' && use.bed === profileId
  })
}

// Full URLs of the older MP3 pools ('fish-swim:turn', 'ui:click', ...), by pool.
export function legacyClipUrls(catalog) {
  const pools = {}
  for (const clip of catalog) {
    const use = clipUse(clip.use)
    if (!use.legacy) continue
    if (!pools[use.legacy]) pools[use.legacy] = []
    pools[use.legacy].push(`${clip.path}.${clip.formats?.[0] ?? 'mp3'}`)
  }
  return pools
}

// One credit per source recording that ships in public/audio, in catalog order (beds,
// events, one-shots, UI, the older MP3s). Clips cut from the same recording share a row;
// `subjects` lists what they are used as, `inUse` whether any of them plays in this build.
export function soundCredits(catalog) {
  const rows = new Map()
  for (const clip of catalog) {
    const key = clip.sourceUrl || clip.credit || clip.author
    const use = clipUse(clip.use)
    let row = rows.get(key)
    if (!row) {
      row = {
        id: clip.id,
        title: clip.title ?? null,
        author: clip.author,
        licence: clip.licence,
        url: clip.sourceUrl ?? null,
        credit: clip.credit ?? null,
        subjects: [],
        clips: [],
        inUse: false,
      }
      rows.set(key, row)
    }
    if (!row.subjects.includes(use.label)) row.subjects.push(use.label)
    row.clips.push(clip.id)
    row.inUse ||= use.status !== 'staged'
  }
  return [...rows.values()]
}
