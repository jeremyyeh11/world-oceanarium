// Writes docs/audio-clips.md: every clip in src/audio/clipCatalog.json, grouped by folder,
// with its source, licence, trim, duration and whether this build plays it. The status comes
// from the same use table the app wires clips with (src/audio/clipUses.js) and the reserve
// mixes and event rates from src/audio/ambienceProfiles.js, so the list cannot drift from the
// app. Run after changing the catalog (scripts/build-audio-clips.py) or the wiring:
//
//   npm run audio:clip-list
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { AMBIENCE_PROFILES, EVENT_ARCHETYPES } from '../src/audio/ambienceProfiles.js'
import { clipUse, soundCredits } from '../src/audio/clipUses.js'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const CATALOG_PATH = join(ROOT, 'src', 'audio', 'clipCatalog.json')
const OUTPUT_PATH = join(ROOT, 'docs', 'audio-clips.md')

const catalog = JSON.parse(readFileSync(CATALOG_PATH, 'utf8'))

const FOLDERS = [
  ['beds', 'Beds (looping habitat layers)'],
  ['events', 'Events (event-layer one-shots)'],
  ['oneshots', 'One-shots (staged for later phases)'],
  ['ui', 'UI'],
  ['fish-sfx', 'Fish swims (older MP3s)'],
  ['ui-sfx', 'UI clicks (older MP3s)'],
]

const PROFILE_NAMES = { default: 'the landing gate and reserve selector' }

function profileName(id) {
  return PROFILE_NAMES[id] ?? id.split('-').map(word => word[0].toUpperCase() + word.slice(1)).join(' ')
}

const seconds = value => `${Number(value).toFixed(3).replace(/\.?0+$/, '')} s`
const range = ([from, to]) => `${Number(from).toFixed(3)}–${Number(to).toFixed(3)} s`
const signed = value => (value > 0 ? `+${value}` : value < 0 ? `−${-value}` : '0')
const kb = bytes => `${Math.round(bytes / 1024)} KB`

function folderOf(clip) {
  return clip.path.split('/')[2]
}

function eventWhere(use) {
  const plays = Object.entries(AMBIENCE_PROFILES)
    .filter(([, profile]) => profile.events?.rates?.[use.archetype])
    .map(([id, profile]) => `${profileName(id)} ${profile.events.rates[use.archetype]}/min`)
  const chorus = EVENT_ARCHETYPES[use.archetype]?.fishCall ? ' (×1.6 at dawn and dusk, ×0.8 at night)' : ''
  const where = plays.length ? plays.join(', ') : 'no reserve plays it yet'
  return `event layer, ${use.where}: ${where}${chorus}`
}

function bedWhere(use, clip) {
  const mix = AMBIENCE_PROFILES[use.bed]?.files?.[clip.id]
  const level = mix ? `gain ${mix.gain}, pan ${signed(mix.pan ?? 0)}` : 'no mix set (plays low and centred)'
  return `${profileName(use.bed)} bed, looping with the synth bed while ${profileName(use.bed)} is viewed; ${level}`
}

function status(clip) {
  const use = clipUse(clip.use)
  if (use.status === 'in use') return `**in use**: ${use.archetype ? eventWhere(use) : bedWhere(use, clip)}`
  if (use.status === 'existing') return `**existing**: ${use.where}`
  return `staged: ${use.where}`
}

function source(clip) {
  if (!clip.sourceUrl) return `${clip.author}`
  const title = clip.title ? `"${clip.title}"` : 'untitled'
  return `${title} by ${clip.author}, ${clip.licence}, ${clip.sourceUrl}`
}

function cut(clip) {
  const parts = []
  if (clip.segments) parts.push(`segments ${clip.segments.map(range).join(' + ')}`)
  else if (clip.trim) parts.push(`trim ${range(clip.trim)}`)
  if (clip.loop) parts.push(`loop ${range(clip.loop)}`)
  parts.push(`duration ${seconds(clip.duration)}`)
  return parts.join('; ')
}

function clipLine(clip) {
  const file = `public${clip.path}.${clip.formats.length > 1 ? `{${clip.formats.join(',')}}` : clip.formats[0]}`
  return `- \`${file}\`: ${status(clip)}. Source: ${source(clip)}. ${cut(clip)[0].toUpperCase()}${cut(clip).slice(1)}.`
}

// What entering each reserve fetches (Opus sizes): its bed layers, plus the event pools it
// plays the first time any reserve plays them.
function downloadSummary() {
  const lines = []
  for (const [id, profile] of Object.entries(AMBIENCE_PROFILES)) {
    const beds = catalog.filter(clip => clipUse(clip.use).bed === id && clipUse(clip.use).status === 'in use')
    const archetypes = Object.keys(profile.events?.rates ?? {})
    const events = catalog.filter(clip => {
      const use = clipUse(clip.use)
      return use.status === 'in use' && use.archetype && archetypes.includes(use.archetype)
    })
    const bytes = [...beds, ...events].reduce((sum, clip) => sum + (clip.bytes?.webm ?? 0), 0)
    const pools = [...new Set(events.map(clip => clipUse(clip.use).archetype))]
    const parts = []
    if (beds.length) parts.push(`${beds.length} bed${beds.length > 1 ? 's' : ''}`)
    if (pools.length) parts.push(`event pools ${pools.join(', ')}`)
    lines.push(`- ${profileName(id)}: ${parts.join(' and ') || 'nothing'}${bytes ? `, about ${kb(bytes)} of Opus` : ''}`)
  }
  return lines
}

const counts = { 'in use': 0, staged: 0, existing: 0 }
for (const clip of catalog) counts[clipUse(clip.use).status] += 1
const recordings = soundCredits(catalog)

const out = [
  '# Audio clips',
  '',
  'Generated by `npm run audio:clip-list` (`scripts/write-audio-clip-list.mjs`) from `src/audio/clipCatalog.json`, the use table in `src/audio/clipUses.js` and the reserve mixes and event rates in `src/audio/ambienceProfiles.js`. Do not edit by hand. Regenerate it whenever the catalog or the wiring changes, in the same commit (AGENTS.md, Release hygiene).',
  '',
  'The clips themselves are built by `python -I -B scripts/build-audio-clips.py <source-folder>`, which also writes the catalog. The source folder holds the original downloads (never committed); every one can be downloaded again from the source URLs below, under the file names listed in `SOURCES` in the script. `python -I -B scripts/build-audio-clips.py <any-folder> --describe` prints each output with its source and processing chain. Nothing here has been listened to: the trims were chosen by analysis.',
  '',
  'Status:',
  '- **in use**: fetched and played in this build, where and how often as stated.',
  '- staged: shipped in `public/audio` but never fetched yet; what it is kept for.',
  '- **existing**: the older MP3s, played as before the redesign.',
  '',
  `${catalog.length} clips: ${counts['in use']} in use, ${counts.staged} staged, ${counts.existing} existing, cut from ${recordings.length} source recordings (all credited in the Sources modal, Sounds section: \`SOUND_CREDITS\` in \`src/data/sources.js\`).`,
  '',
  'Fetched on first entry, then cached for the session (an event pool already loaded by another reserve is not fetched again):',
  ...downloadSummary(),
  '',
  'Trim and loop times are in seconds: trim in the source recording, loop inside the built file (beds hold the loop plus about 85 ms of padding at each end and play only the loop).',
]

for (const [folder, heading] of FOLDERS) {
  const clips = catalog.filter(clip => folderOf(clip) === folder)
  if (!clips.length) continue
  out.push('', `## ${heading}`, '', ...clips.map(clipLine))
}
const known = new Set(FOLDERS.map(([folder]) => folder))
const others = catalog.filter(clip => !known.has(folderOf(clip)))
if (others.length) out.push('', '## Other folders', '', ...others.map(clipLine))

writeFileSync(OUTPUT_PATH, `${out.join('\n')}\n`)
console.log(`Wrote ${OUTPUT_PATH}: ${catalog.length} clips (${counts['in use']} in use, ${counts.staged} staged, ${counts.existing} existing)`)
