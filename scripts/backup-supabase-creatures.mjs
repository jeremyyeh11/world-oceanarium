import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(__dirname, '..')
const envFileCandidates = [
  process.env.SUPABASE_ENV_FILE,
  path.join('/home/yk', '.secrets', 'world-oceanarium-supabase-test.env'),
  path.join(os.homedir(), '.secrets', 'world-oceanarium-supabase-test.env'),
].filter(Boolean)
const backupRoot = path.join(repoRoot, '.supabase-creature-backups')
const KEEP_DIFFS = 10
const KEEP_SNAPSHOTS = KEEP_DIFFS + 1
const BACKUP_FILE_PATTERN = /^(\d{4}-\d{2}-\d{2})_(\d{2})-(\d{2})-(\d{2})-(\d{3})Z_(creatures|diff)\.json$/

async function firstExistingEnvFile(candidates) {
  for (const candidate of candidates) {
    try {
      await fs.access(candidate)
      return candidate
    } catch {
      // Try next candidate.
    }
  }
  return candidates.at(-1)
}

function parseArgs() {
  const args = process.argv.slice(2)
  const options = { envFile: null }

  for (let i = 0; i < args.length; i += 1) {
    if (args[i] === '--env-file') {
      options.envFile = args[i + 1]
      i += 1
    }
  }

  return options
}

async function loadEnvFile(envFile) {
  try {
    const content = await fs.readFile(envFile, 'utf8')
    content.split(/\r?\n/).forEach(line => {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) return
      const separator = trimmed.indexOf('=')
      if (separator === -1) return
      const key = trimmed.slice(0, separator).trim()
      const value = trimmed.slice(separator + 1).trim().replace(/^['"]|['"]$/g, '')
      if (key && process.env[key] === undefined) process.env[key] = value
    })
  } catch (error) {
    if (error.code !== 'ENOENT') throw error
  }
}

function resolveSupabaseConfig() {
  const url = process.env.SUPABASE_URL?.replace(/\/$/, '')
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY
  if (!url || !key) {
    throw new Error('Missing SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY/SUPABASE_ANON_KEY. Use --env-file or env vars.')
  }
  return { url, key }
}

function sortObject(value) {
  if (Array.isArray(value)) return value.map(sortObject)
  if (!value || typeof value !== 'object') return value
  return Object.fromEntries(Object.keys(value).sort().map(key => [key, sortObject(value[key])]))
}

function canonicalRows(rows) {
  return rows
    .map(sortObject)
    .sort((a, b) => String(a.id).localeCompare(String(b.id)))
}

async function fetchCreatures({ url, key }) {
  const response = await fetch(`${url}/rest/v1/creatures?select=*&order=id.asc`, {
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
    },
  })

  if (!response.ok) {
    throw new Error(`Supabase creatures backup failed (${response.status})`)
  }

  const rows = await response.json()
  return canonicalRows(Array.isArray(rows) ? rows : [])
}

function isBackupFile(name, kind) {
  const match = BACKUP_FILE_PATTERN.exec(name)
  if (!match || match[6] !== kind) return false
  const [, day, hours, minutes, seconds, milliseconds] = match
  const iso = `${day}T${hours}:${minutes}:${seconds}.${milliseconds}Z`
  const date = new Date(iso)
  return Number.isFinite(date.valueOf()) && date.toISOString() === iso
}

async function listBackupFiles(dir, kind) {
  try {
    // Fixed-width UTC filenames sort chronologically after filtering. Dev and
    // manual backups can share the folder without affecting selection or retention.
    return (await fs.readdir(dir, { withFileTypes: true }))
      .filter(file => file.isFile() && isBackupFile(file.name, kind))
      .map(file => file.name)
      .sort()
  } catch (error) {
    if (error.code === 'ENOENT') return []
    throw error
  }
}

function diffRows(previousRows, currentRows) {
  const previous = new Map(previousRows.map(row => [String(row.id), row]))
  const current = new Map(currentRows.map(row => [String(row.id), row]))
  const added = []
  const removed = []
  const changed = []

  current.forEach((row, id) => {
    if (!previous.has(id)) {
      added.push(row)
      return
    }
    const before = previous.get(id)
    if (JSON.stringify(before) !== JSON.stringify(row)) changed.push({ id, before, after: row })
  })

  previous.forEach((row, id) => {
    if (!current.has(id)) removed.push(row)
  })

  return { added, removed, changed }
}

async function prune(dir, kind, keep) {
  const files = await listBackupFiles(dir, kind)
  const stale = files.slice(0, Math.max(0, files.length - keep))
  await Promise.all(stale.map(file => fs.unlink(path.join(dir, file))))
}

export async function writeCreatureBackup(rows, root, now = new Date()) {
  const snapshotsDir = path.join(root, 'snapshots')
  const diffsDir = path.join(root, 'diffs')
  await fs.mkdir(snapshotsDir, { recursive: true })
  await fs.mkdir(diffsDir, { recursive: true })

  const timestamp = now.toISOString().replace(/[:.]/g, '-').replace('T', '_')
  const snapshots = await listBackupFiles(snapshotsDir, 'creatures')
  const previousSnapshot = snapshots.at(-1)
  const previousRows = previousSnapshot
    ? JSON.parse(await fs.readFile(path.join(snapshotsDir, previousSnapshot), 'utf8'))
    : []

  const snapshotFile = `${timestamp}_creatures.json`
  const snapshotPath = path.join(snapshotsDir, snapshotFile)
  await fs.writeFile(snapshotPath, `${JSON.stringify(rows, null, 2)}\n`)

  if (previousSnapshot) {
    const diff = diffRows(previousRows, rows)
    const diffFile = `${timestamp}_diff.json`
    await fs.writeFile(path.join(diffsDir, diffFile), `${JSON.stringify({
      from: previousSnapshot,
      to: snapshotFile,
      counts: {
        before: previousRows.length,
        after: rows.length,
        added: diff.added.length,
        removed: diff.removed.length,
        changed: diff.changed.length,
      },
      ...diff,
    }, null, 2)}\n`)
  }

  await prune(snapshotsDir, 'creatures', KEEP_SNAPSHOTS)
  await prune(diffsDir, 'diff', KEEP_DIFFS)

  return { snapshotPath, previousSnapshot }
}

async function main() {
  const options = parseArgs()
  await loadEnvFile(options.envFile || await firstExistingEnvFile(envFileCandidates))
  const config = resolveSupabaseConfig()
  const rows = await fetchCreatures(config)
  const { snapshotPath, previousSnapshot } = await writeCreatureBackup(rows, backupRoot)

  console.log(`Backed up ${rows.length} creature rows to ${path.relative(repoRoot, snapshotPath)}`)
  if (previousSnapshot) console.log(`Recorded diff; keeping last ${KEEP_DIFFS} diffs.`)
  else console.log('Initial snapshot; diff starts on next backup.')
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(error => {
    console.error(error.message)
    process.exitCode = 1
  })
}
