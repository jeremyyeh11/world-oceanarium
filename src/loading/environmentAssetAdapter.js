import { TextureLoader } from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js'
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js'
import { buildGraph } from '@react-three/fiber'

const draco = new DRACOLoader().setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.5/')
const gltfLoader = new GLTFLoader().setDRACOLoader(draco).setMeshoptDecoder(MeshoptDecoder)
const textureLoader = new TextureLoader()

function resourcesOf(value) {
  const geometries = new Set()
  const materials = new Set()
  const textures = new Set()
  const images = new Set()
  if (value.isTexture) textures.add(value)
  for (const scene of value.scenes ?? []) scene.traverse(object => {
    if (object.geometry) geometries.add(object.geometry)
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) if (material) {
      materials.add(material)
      for (const item of Object.values(material)) if (item?.isTexture) textures.add(item)
    }
  })
  let bytes = 0
  const buffers = new Set()
  for (const geometry of geometries) {
    for (const attribute of [...Object.values(geometry.attributes), geometry.index].filter(Boolean)) {
      const array = attribute.isInterleavedBufferAttribute ? attribute.data.array : attribute.array
      if (array?.buffer) buffers.add(array.buffer)
    }
    for (const attributes of Object.values(geometry.morphAttributes)) for (const attribute of attributes) buffers.add(attribute.array.buffer)
  }
  for (const buffer of buffers) bytes += buffer.byteLength
  for (const texture of textures) if (texture.image && !images.has(texture.image)) {
    images.add(texture.image)
    const image = texture.image
    // Approximate decoded RGBA + mip chain. Not actual GPU allocation/RSS.
    bytes += Math.ceil((image.width ?? 1) * (image.height ?? 1) * 4 * 4 / 3)
  }
  return { bytes, dispose() {
    for (const geometry of geometries) geometry.dispose()
    for (const material of materials) material.dispose()
    for (const texture of textures) texture.dispose()
    for (const image of images) image.close?.()
  } }
}

export async function loadEnvironmentAsset(asset, { signal, beforeDecode = () => Promise.resolve() }) {
  // Fetch is abortable; parsing/decoding may not be. The scheduler disposes late cancelled results.
  const controller = new AbortController()
  const abort = () => controller.abort()
  signal.addEventListener('abort', abort, { once: true })
  if (signal.aborted) controller.abort()
  const timeout = setTimeout(abort, 30000)
  let blobUrl
  try {
    const response = await fetch(asset.url, { signal: controller.signal })
    if (!response.ok) throw new Error(`Asset request failed (${response.status}): ${asset.url}`)
    const buffer = await response.arrayBuffer()
    clearTimeout(timeout) // Network timeout excludes intentionally paused speculative decode.
    controller.signal.throwIfAborted()
    // A response can arrive in the middle of a busy foreground frame. Admit decode
    // separately at idle; starting an idle network request does not make its completion idle.
    await beforeDecode()
    controller.signal.throwIfAborted()
    let value
    if (asset.kind === 'gltf') {
      const base = new URL('.', new URL(asset.url, window.location.href)).href
      value = await gltfLoader.parseAsync(buffer, base)
      Object.assign(value, buildGraph(value.scene))
    } else if (asset.kind === 'texture') {
      blobUrl = URL.createObjectURL(new Blob([buffer]))
      value = await textureLoader.loadAsync(blobUrl)
    } else throw new Error(`Unsupported environment asset kind: ${asset.kind}`)
    const resources = resourcesOf(value)
    if (controller.signal.aborted) { resources.dispose(); throw new Error(`Asset load cancelled: ${asset.url}`) }
    return { value, ...resources }
  } finally {
    clearTimeout(timeout)
    signal.removeEventListener('abort', abort)
    if (blobUrl) URL.revokeObjectURL(blobUrl)
  }
}
