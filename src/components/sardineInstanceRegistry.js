export const SARDINE_INSTANCE_DISTANCE = 8.0
export const SARDINE_TANK_INSTANCE_DISTANCE = 13.5
export const SARDINE_LOD1_DISTANCE = 5.0
export const SARDINE_TANK_LOD1_DISTANCE = 10.5

const sardineLod2Instances = new Map()
const sardineLod1Instances = new Map()
const sardineLod0Entries = new Map()
const sardineFrustumEntries = new Map()

export function updateSardineInstance(id, entry) {
  if (!id || !entry) return
  sardineLod2Instances.set(String(id), entry)
}

export function removeSardineInstance(id) {
  if (!id) return
  sardineLod2Instances.delete(String(id))
}

export function getSardineInstances() {
  return sardineLod2Instances
}


export function updateSardineLod1Instance(id, entry) {
  if (!id || !entry) return
  sardineLod1Instances.set(String(id), entry)
}

export function removeSardineLod1Instance(id) {
  if (!id) return
  sardineLod1Instances.delete(String(id))
}

export function getSardineLod1Instances() {
  return sardineLod1Instances
}

export function updateSardineLod0Entry(id, entry) {
  if (!id || !entry) return
  sardineLod0Entries.set(String(id), entry)
}

export function removeSardineLod0Entry(id) {
  if (!id) return
  sardineLod0Entries.delete(String(id))
}

export function updateSardineFrustumEntry(id, entry) {
  if (!id || !entry) return
  sardineFrustumEntries.set(String(id), entry)
}

export function removeSardineFrustumEntry(id) {
  if (!id) return
  sardineFrustumEntries.delete(String(id))
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

export function getSardineFrustumStats() {
  let candidates = 0
  let culled = 0
  sardineFrustumEntries.forEach(entry => {
    if (!entry?.candidate) return
    candidates += 1
    if (entry.culled) culled += 1
  })
  return { candidates, culled }
}
