// Fetch and decode audio files for useOceanAudio (bed layers, SFX) and the event layer.

export const CLIP_FORMATS = ['webm', 'm4a', 'mp3']

export async function loadAudioBuffer(context, url) {
  const response = await window.fetch(url)
  if (!response.ok) throw new Error(`Audio asset failed to load: ${url}`)
  const arrayBuffer = await response.arrayBuffer()
  return context.decodeAudioData(arrayBuffer)
}

// `src` is a public path without extension. Each format is tried in order when the
// previous one fails to fetch or decode (canPlayType is not trusted: iOS). The decoded
// buffer is cached in `cache` (a Map) for the session; a clip missing in every format
// resolves to null once and is skipped from then on.
export function loadClip(context, cache, src, formats = CLIP_FORMATS, label = 'Audio clip') {
  let entry = cache.get(src)
  if (!entry) {
    entry = formats
      .reduce((attempt, format) => attempt
        ? attempt.catch(() => loadAudioBuffer(context, `${src}.${format}`))
        : loadAudioBuffer(context, `${src}.${format}`), null)
      .catch(error => {
        console.warn(`${label} unavailable: ${src}`, error)
        return null
      })
    cache.set(src, entry)
  }
  return entry
}
