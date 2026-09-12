// Every procedural animation type shipping in species data must have a written
// contract in docs/procedural/. Prose goes stale silently; this does not.
//
// Each type doc declares which shader type it covers on its own second line:
//   Shader type: `caudal-vertex` · Status: **Implemented**
// so adding a doc is enough to satisfy this check — there is no mapping table
// here to keep in sync.
//
// Dependency-free on purpose: it runs before the GLB inspection so a missing
// contract fails fast, and it still works when node_modules is absent.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = fileURLToPath(new URL('..', import.meta.url))
const docsDir = path.join(repoRoot, 'docs/procedural')

const DECLARED_TYPE = /^Shader type: `([^`]+)`/m
const DECLARED_STATUS = /^Shader type:.*Status: \*\*(Implemented|Proposed)/m

function readTypeDocs() {
  const docs = new Map()
  const docProblems = []
  for (const file of fs.readdirSync(docsDir).sort()) {
    if (!file.endsWith('.md') || file === 'README.md') continue
    const source = fs.readFileSync(path.join(docsDir, file), 'utf8')
    const declaredType = source.match(DECLARED_TYPE)?.[1]
    if (!declaredType) {
      docProblems.push(`${file} declares no "Shader type:" line`)
      continue
    }
    if (docs.has(declaredType)) {
      docProblems.push(`${declaredType} is claimed by both ${docs.get(declaredType).file} and ${file}`)
      continue
    }
    docs.set(declaredType, { file, status: source.match(DECLARED_STATUS)?.[1] ?? 'Unknown' })
  }
  return { docs, docProblems }
}

function collectUsedTypes(species) {
  const used = new Map()
  const note = (type, where) => {
    if (!type) return
    if (!used.has(type)) used.set(type, [])
    used.get(type).push(where)
  }
  for (const entry of species) {
    note(entry?.model?.proceduralAnimation?.type, entry.id)
    for (const [sex, variant] of Object.entries(entry?.model?.sexVariants ?? {})) {
      note(variant?.proceduralAnimation?.type, `${entry.id} (${sex})`)
    }
  }
  return used
}

const { docs, docProblems } = readTypeDocs()
const { SPECIES } = await import(new URL('../src/data/species.js', import.meta.url))
const used = collectUsedTypes(SPECIES)

const undocumented = [...used.entries()].filter(([type]) => !docs.has(type))
const unpromoted = [...used.entries()].filter(([type]) => docs.get(type)?.status === 'Proposed')

console.log(JSON.stringify({
  documentedTypes: Object.fromEntries([...docs].map(([type, doc]) => [type, `${doc.file} (${doc.status})`])),
  usedTypes: Object.fromEntries([...used].map(([type, where]) => [type, where])),
  undocumentedTypes: undocumented.map(([type]) => type),
  unpromotedTypes: unpromoted.map(([type]) => type),
  docContractFailed: undocumented.length > 0 || docProblems.length > 0,
}, null, 2))

for (const problem of docProblems) {
  console.error(`\ndocs/procedural: ${problem}`)
}

for (const [type, where] of undocumented) {
  console.error(`
No written contract for procedural type "${type}" (used by: ${where.join(', ')}).

A new motion architecture needs its doc BEFORE its implementation ships. Write
docs/procedural/<motion-name>.md from the template the existing type docs share,
declaring "Shader type: \`${type}\`" on its second line, then add it to the type
index in docs/procedural/README.md.

If this is not genuinely a new architecture, it should be a config of an existing
type instead — see "When a new type doc is warranted" in docs/procedural/README.md.`)
}

for (const [type, where] of unpromoted) {
  console.warn(`
Warning: "${type}" ships in species data (${where.join(', ')}) but ${docs.get(type).file}
is still marked Proposed. Validate the doc against the shipped asset and promote it
to Implemented, here and in the type index.`)
}

if (undocumented.length > 0 || docProblems.length > 0) process.exitCode = 1
