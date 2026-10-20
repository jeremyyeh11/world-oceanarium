// Cache the meshes targeted by the old per-frame traversal, not a stale snapshot of
// their materials. FishModel replaces materials after mounting and debug changes;
// reading each cached mesh's current material also preserves in-place array edits.
export function createFishMaterialPass() {
  let root = null
  let dirty = true
  const nodes = []
  const meshes = []

  const invalidate = () => { dirty = true }
  const dispose = () => {
    for (let i = 0; i < nodes.length; i += 1) {
      nodes[i].removeEventListener('childadded', invalidate)
      nodes[i].removeEventListener('childremoved', invalidate)
    }
    nodes.length = 0
    meshes.length = 0
    root = null
    dirty = true
  }
  const collect = node => {
    nodes.push(node)
    node.addEventListener('childadded', invalidate)
    node.addEventListener('childremoved', invalidate)
    if (node.isMesh) meshes.push(node)
  }
  const apply = (material, opacity, envMapIntensity) => {
    if (!material) return
    const alphaBlend = material.userData.alphaBlend === true
    material.transparent = alphaBlend || opacity < 0.999
    material.opacity = opacity
    if ('depthWrite' in material) material.depthWrite = !alphaBlend && opacity >= 0.999
    if ('envMapIntensity' in material) material.envMapIntensity = envMapIntensity
  }

  return {
    invalidate,
    dispose,
    update(nextRoot, opacity, envMapIntensity) {
      if (root !== nextRoot || dirty) {
        dispose()
        root = nextRoot
        // childadded/childremoved do not bubble: watch every node so asynchronous
        // GLBs, nested fin/debug meshes and sardine LOD swaps invalidate the cache.
        root?.traverse(collect)
        dirty = false
      }
      for (let i = 0; i < meshes.length; i += 1) {
        const mesh = meshes[i]
        if (mesh.userData?.interactionProxy) continue
        const material = mesh.material
        if (Array.isArray(material)) {
          for (let j = 0; j < material.length; j += 1) apply(material[j], opacity, envMapIntensity)
        } else {
          apply(material, opacity, envMapIntensity)
        }
      }
    },
  }
}
