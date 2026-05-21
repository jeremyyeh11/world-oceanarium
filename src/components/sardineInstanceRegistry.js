export const SARDINE_INSTANCE_DISTANCE = 8.0

const sardineInstances = new Map()

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
