import { SPECIES, TANKS } from '../data/species.js'
import { brainCoralsOf, landscapeForTank } from '../data/landscapes.js'

// Keys identify source assets, not instances. A fish used by several tanks/Atlas loads once.
export function assetDefinition(kind, url) {
  return { key: `${kind}:${url}`, kind, url, estimatedBytes: 16 * 1024 * 1024 }
}

export function modelAssets(species, add) {
  if (species.model?.path) add('gltf', species.model.path)
  for (const variant of Object.values(species.model?.sexVariants ?? {})) if (variant.path) add('gltf', variant.path)
  for (const stage of Object.values(species.lifeStages ?? {})) modelAssets(stage, add)
}

// No environment-name branches: new TANKS/species/landscape declarations join this catalog.
// The common water HDR stays renderer-owned; it is one shared resource, not a per-tank cache.
export function createEnvironmentManifests(tanks = TANKS, species = SPECIES, landscapeOf = landscapeForTank) {
  const byId = new Map(species.map(item => [item.id, item]))
  return tanks.map(tank => {
    const assets = new Map()
    const add = (kind, url) => { const asset = assetDefinition(kind, url); assets.set(asset.key, asset) }
    for (const id of tank.species) {
      const item = byId.get(id)
      if (!item) throw new Error(`Unknown species ${id} in environment ${tank.id}`)
      modelAssets(item, add)
    }
    // Sardine LODs are source assets too; the active ocean instancer mounts them independently.
    if (tank.biome === 'ocean') for (const level of [1, 2]) add('gltf', `/models/fish/sardine/sardine_LOD${level}.glb`)
    const landscape = landscapeOf(tank)
    if (landscape?.kit) {
      add('gltf', landscape.kit.path)
      for (const url of Object.values(landscape.kit.textures)) add('texture', url)
      for (const coral of [landscape.corals, landscape.staghorn, brainCoralsOf(landscape)]) if (coral) {
        add('gltf', coral.kit.path)
        for (const model of coral.kit.models) for (const url of [model.color, model.normal]) add('texture', url)
      }
      // The sea fans' textures are inside their GLB.
      if (landscape.seaFans) add('gltf', landscape.seaFans.kit.path)
    }
    return { id: tank.id, assets: [...assets.values()] }
  })
}

export const ENVIRONMENT_MANIFESTS = createEnvironmentManifests()
