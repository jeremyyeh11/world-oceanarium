import { SPECIES } from '../data/species.js'
import { modelAssets } from './environmentManifest.js'

// The Atlas reads its models through the environment loader, which keeps only the
// active/recent tanks' decoded sources. Warming the Atlas there would either be trimmed
// straight away or pin every species past the cache budget, so this warms the browser's
// HTTP cache instead: the files arrive during the landing descent and the first Atlas open
// (or species pick) skips the download, leaving only the parse.
export function atlasWarmupUrls(species = SPECIES) {
  const urls = new Set()
  for (const item of species) {
    if (item.hiddenInAtlas) continue
    if (item.atlasThumbnail) urls.add(item.atlasThumbnail)
    // Variants and life stages too: the Atlas companions (females, juveniles) use them.
    modelAssets(item, (_kind, url) => urls.add(url))
  }
  return [...urls]
}

// One file at a time at low priority, so it never competes with a reserve's own files.
// Failures are ignored: the Atlas still fetches on demand.
export async function warmAtlasSources(urls, { signal } = {}) {
  for (const url of urls) {
    if (signal?.aborted) return
    try {
      const response = await fetch(url, { signal, priority: 'low' })
      await response.arrayBuffer()
    } catch {
      if (signal?.aborted) return
    }
  }
}
