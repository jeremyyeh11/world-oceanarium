import { BufferAttribute } from 'three'

// Shared legend. Single-level GLBs are not mislabeled as an adaptive LOD0.
export const LOD_DEBUG_COLORS = ['#ff4fd8', '#80ff72', '#5ab8ff', '#b58cff', '#ffd166']

export function tagLodGeometry(geometry, level) {
  const values = new Uint8Array(geometry.attributes.position.count).fill(level)
  geometry.setAttribute('debugLodLevel', new BufferAttribute(values, 1))
  return geometry
}

// Chain rather than replace authored/procedural shader code. No material/texture cloning,
// disposal, rig changes, or new LOD decisions. Cleanup restores the exact previous hooks.
export function installLodDebug(material, level = null) {
  const before = material.onBeforeCompile
  const key = material.customProgramCacheKey
  const baseKey = key.call(material)
  function compile(shader, renderer) {
    before.call(this, shader, renderer)
    if (level == null) {
      shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nattribute float debugLodLevel; varying float vDebugLodLevel;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvDebugLodLevel = debugLodLevel;')
      shader.fragmentShader = shader.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vDebugLodLevel;')
    }
    const index = level == null ? 'vDebugLodLevel' : Number(level).toFixed(1)
    const colours = ['vec3(1.0, 0.310, 0.847)', 'vec3(0.502, 1.0, 0.447)', 'vec3(0.353, 0.722, 1.0)', 'vec3(0.710, 0.549, 1.0)', 'vec3(1.0, 0.820, 0.400)']
    shader.fragmentShader = shader.fragmentShader.replace('#include <dithering_fragment>', `#include <dithering_fragment>\nfloat debugLevel = ${index};\ngl_FragColor.rgb = debugLevel < 0.5 ? ${colours[0]} : debugLevel < 1.5 ? ${colours[1]} : debugLevel < 2.5 ? ${colours[2]} : debugLevel < 3.5 ? ${colours[3]} : ${colours[4]};`)
  }
  material.onBeforeCompile = compile
  material.customProgramCacheKey = () => `${baseKey}|debug-lod:${level ?? 'attribute'}`
  material.needsUpdate = true
  material.userData.debugLodLevel = level ?? 'attribute'
  return () => {
    if (material.onBeforeCompile !== compile) return
    material.onBeforeCompile = before
    material.customProgramCacheKey = key
    delete material.userData.debugLodLevel
    material.needsUpdate = true
  }
}
