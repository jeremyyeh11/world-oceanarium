import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import { writeCreatureBackup } from '../scripts/backup-supabase-creatures.mjs'

const backupName = (day, kind) => `2026-11-${String(day).padStart(2, '0')}_05-00-00-000Z_${kind}.json`

test('creature backup compares and retains only managed production history', async t => {
  const tempDir = path.resolve(os.tmpdir())
  const root = await fs.mkdtemp(path.join(tempDir, 'creature-backup-test-'))
  assert.equal(path.dirname(root), tempDir)
  t.after(() => fs.rm(root, { recursive: true, force: true }))

  const snapshotsDir = path.join(root, 'snapshots')
  const diffsDir = path.join(root, 'diffs')
  await Promise.all([fs.mkdir(snapshotsDir), fs.mkdir(diffsDir)])

  const oldRows = [{ id: 1, species: 'mobula-munkiana' }]
  const addedRows = [{ id: 1484, species: 'chelonia-mydas' }, { id: 1485, species: 'chelonia-mydas' }]
  const devSnapshot = '20261022T010605_creatures_dev_after.json'
  const invalidSnapshot = backupName(31, 'creatures')
  const wrongKind = backupName(28, 'diff')
  const manualSnapshot = '000-manual.json'
  const manualDiff = '000-notes.json'
  const invalidDiff = backupName(31, 'diff')
  const snapshotNames = Array.from({ length: 12 }, (_, i) => backupName(i + 1, 'creatures'))
  const diffNames = Array.from({ length: 11 }, (_, i) => backupName(i + 2, 'diff'))

  await Promise.all([
    ...snapshotNames.map(name => fs.writeFile(path.join(snapshotsDir, name), JSON.stringify(oldRows))),
    ...diffNames.map(name => fs.writeFile(path.join(diffsDir, name), '{}')),
    ...[devSnapshot, invalidSnapshot, wrongKind, manualSnapshot].map(name =>
      fs.writeFile(path.join(snapshotsDir, name), '[{"id":99}]')),
    ...[manualDiff, invalidDiff].map(name => fs.writeFile(path.join(diffsDir, name), '{}')),
  ])

  const now = new Date('2026-11-13T05:00:00.000Z')
  await writeCreatureBackup([...oldRows, ...addedRows], root, now)

  const diff = JSON.parse(await fs.readFile(path.join(diffsDir, backupName(13, 'diff')), 'utf8'))
  assert.equal(diff.from, backupName(12, 'creatures'))
  assert.equal(diff.to, backupName(13, 'creatures'))
  assert.deepEqual(diff.counts, { before: 1, after: 3, added: 2, removed: 0, changed: 0 })
  assert.deepEqual(diff.added, addedRows)

  assert.deepEqual((await fs.readdir(snapshotsDir)).sort(), [
    ...snapshotNames.slice(2), backupName(13, 'creatures'),
    devSnapshot, invalidSnapshot, wrongKind, manualSnapshot,
  ].sort())
  assert.deepEqual((await fs.readdir(diffsDir)).sort(), [
    ...diffNames.slice(2), backupName(13, 'diff'), manualDiff, invalidDiff,
  ].sort())
})
