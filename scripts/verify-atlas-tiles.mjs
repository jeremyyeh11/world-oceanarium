// Every species shown in the Atlas needs its list tile (`atlasThumbnail`, a file in
// public/atlas/). Runs before `npm run build`: a `-dev_` build only warns, so review builds
// still deploy, but a clean version fails until the tile is in. Tiles kept getting forgotten
// until after promotion (triggerfish v0.22.0, grouper v0.28.0-dev_1).
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { SPECIES } from '../src/data/species.js'
import { APP_VERSION } from '../src/version.js'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const problems = []

for (const species of SPECIES) {
  if (species.hiddenInAtlas) continue
  const tile = species.atlasThumbnail
  if (!tile) {
    problems.push(`${species.id}: no atlasThumbnail (expected /atlas/${species.id}-thumbnail.png)`)
  } else if (!fs.existsSync(path.join(repoRoot, 'public', tile))) {
    problems.push(`${species.id}: atlasThumbnail ${tile} is missing from public/`)
  }
}

if (problems.length === 0) {
  console.log('Atlas tiles: every Atlas species has one.')
} else {
  const isDevBuild = APP_VERSION.includes('-dev_')
  const label = isDevBuild ? 'warning' : 'error'
  for (const problem of problems) console[isDevBuild ? 'warn' : 'error'](`Atlas tile ${label}: ${problem}`)
  if (!isDevBuild) {
    console.error(`${APP_VERSION} is a clean version: capture the missing tiles before promoting (docs/new-species-checklist.md, section 6).`)
    process.exit(1)
  }
}
