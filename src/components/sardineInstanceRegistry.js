export const SARDINE_INSTANCE_DISTANCE = 8.0
export const SARDINE_TANK_INSTANCE_DISTANCE = 25.0

const sardineInstances = new Map()
const sardineLod0Entries = new Map()

export function updateSardineInstance(id, entry) {
  if (!id || !entry) return
  sardineInstances.set(String(id), entry)
}

export function removeSardineInstance(id) {
  if (!id) return
  sardineInstances.delete(String(id))
}

export function getSardineInstances() {
  return sardineInstances
}

export function updateSardineLod0Entry(id, entry) {
  if (!id || !entry) return
  sardineLod0Entries.set(String(id), entry)
}

export function removeSardineLod0Entry(id) {
  if (!id) return
  sardineLod0Entries.delete(String(id))
}

export function getSardineLod0Stats() {
  let candidates = 0
  let drawn = 0
  sardineLod0Entries.forEach(entry => {
    if (!entry?.candidate) return
    candidates += 1
    if (entry.drawn) drawn += 1
  })
  return { candidates, drawn }
}
