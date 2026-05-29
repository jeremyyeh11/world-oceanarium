const outlineTargets = new Map()

export function setSelectionOutlineTarget(key, object, enabled) {
  if (!key) return
  if (!enabled || !object) {
    outlineTargets.delete(key)
    return
  }
  outlineTargets.set(key, object)
}

export function removeSelectionOutlineTarget(key) {
  if (!key) return
  outlineTargets.delete(key)
}

export function getSelectionOutlineTargets() {
  return [...outlineTargets.values()].filter(object => object?.parent && object.visible !== false)
}
