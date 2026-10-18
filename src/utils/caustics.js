import * as THREE from 'three'

// Sunlight caustics on the landscape: the bright, shifting net of light that a rippled surface
// throws onto shallow rock and sand. Projected in world space (each point looks up the pattern
// by where it is, slanted along the sun), so the light lies on the rock and stays put as the
// camera moves; it is not a screen-space overlay.
//
// Cheap by design: one tileable caustic texture (a Voronoi edge net, built once on the CPU) is
// sampled twice per fragment at two scales drifting in different directions, and the minimum of
// the two is the light. That breaks the net into the familiar wandering threads at the cost of
// two texture reads. Only upward-facing surfaces take it, it weakens with depth, and it fades out
// with distance before the pattern can shimmer.
//
// A landscape opts in with `caustics` (landscapes.js); applyCaustics patches a material's shader
// in its onBeforeCompile and the shared clock is advanced by Environment.jsx.

const TEXTURE_SIZE = 256
const CELLS = 8

let causticTexture = null
// Shared by reference with every patched material, so one write moves them all.
export const CAUSTIC_TIME = { value: 0 }

function causticMap() {
  if (causticTexture) return causticTexture
  // Seeded points, one per cell, on a torus so the texture tiles.
  let seed = 1234567
  const rand = () => {
    seed = (seed * 16807) % 2147483647
    return seed / 2147483647
  }
  const points = Array.from({ length: CELLS * CELLS }, () => [rand(), rand()])
  const data = new Uint8Array(TEXTURE_SIZE * TEXTURE_SIZE)
  for (let py = 0; py < TEXTURE_SIZE; py++) {
    for (let px = 0; px < TEXTURE_SIZE; px++) {
      const u = (px + 0.5) / TEXTURE_SIZE * CELLS
      const v = (py + 0.5) / TEXTURE_SIZE * CELLS
      const cx = Math.floor(u)
      const cy = Math.floor(v)
      let f1 = Infinity
      let f2 = Infinity
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const gx = cx + dx
          const gy = cy + dy
          const point = points[((gy + CELLS) % CELLS) * CELLS + ((gx + CELLS) % CELLS)]
          const d = Math.hypot(gx + point[0] - u, gy + point[1] - v)
          if (d < f1) {
            f2 = f1
            f1 = d
          } else if (d < f2) {
            f2 = d
          }
        }
      }
      // Bright along the cell borders, falling off softly into the cells.
      const edge = Math.max(0, 1 - (f2 - f1) / 0.32)
      data[py * TEXTURE_SIZE + px] = Math.round(255 * edge ** 1.6)
    }
  }
  causticTexture = new THREE.DataTexture(data, TEXTURE_SIZE, TEXTURE_SIZE, THREE.RedFormat, THREE.UnsignedByteType)
  causticTexture.wrapS = THREE.RepeatWrapping
  causticTexture.wrapT = THREE.RepeatWrapping
  causticTexture.magFilter = THREE.LinearFilter
  causticTexture.minFilter = THREE.LinearMipmapLinearFilter
  causticTexture.generateMipmaps = true
  causticTexture.needsUpdate = true
  return causticTexture
}

const f = value => Number(value).toFixed(4)

/**
 * Patch a shader (inside onBeforeCompile) with caustics. settings (landscapes.js `caustics`):
 *   strength   how bright at full (0.3 is subtle)
 *   scale      WU across one tile of the pattern
 *   speed      drift, tiles per second
 *   color      linear-ish RGB triple of the light
 *   slant      [x, z] WU of sideways shift per WU of height, along the sun
 *   depth      [yLow, yHigh, share]: at yLow and below only `share` of the light is left
 *   fade       [start, end] camera distance (WU) over which it fades out
 *   twoSided   take |normal.y| (a double-sided plane, like the sand, whose normals face down)
 */
export function applyCaustics(shader, settings) {
  if (!settings) return
  shader.uniforms.uCausticMap = { value: causticMap() }
  shader.uniforms.uCausticTime = CAUSTIC_TIME
  const up = settings.twoSided ? 'abs(normalize(mat3(modelMatrix) * objectNormal).y)' : 'normalize(mat3(modelMatrix) * objectNormal).y'
  shader.vertexShader = shader.vertexShader
    .replace('#include <common>', '#include <common>\nvarying vec3 vCausticWorld;\nvarying float vCausticUp;')
    .replace('#include <begin_vertex>', `#include <begin_vertex>\nvCausticWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;\nvCausticUp = ${up};`)
  const [r, g, b] = settings.color
  const [slantX, slantZ] = settings.slant
  const [depthLow, depthHigh, depthShare] = settings.depth
  const [fadeStart, fadeEnd] = settings.fade
  shader.fragmentShader = shader.fragmentShader
    .replace('#include <common>', '#include <common>\nuniform sampler2D uCausticMap;\nuniform float uCausticTime;\nvarying vec3 vCausticWorld;\nvarying float vCausticUp;')
    .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
      {
        float causticFacing = smoothstep(0.3, 0.9, vCausticUp);
        float causticDistance = length(vCausticWorld - cameraPosition);
        float causticFade = 1.0 - smoothstep(${f(fadeStart)}, ${f(fadeEnd)}, causticDistance);
        if (causticFacing * causticFade > 0.0) {
          vec2 causticUv = (vCausticWorld.xz + vCausticWorld.y * vec2(${f(slantX)}, ${f(slantZ)})) / ${f(settings.scale)};
          float drift = uCausticTime * ${f(settings.speed)};
          float causticA = texture2D(uCausticMap, causticUv + drift * vec2(0.71, 0.43)).r;
          float causticB = texture2D(uCausticMap, causticUv * 1.37 + vec2(0.31, 0.57) - drift * vec2(0.52, 0.81)).r;
          float caustic = min(causticA, causticB);
          float causticDepth = mix(${f(depthShare)}, 1.0, smoothstep(${f(depthLow)}, ${f(depthHigh)}, vCausticWorld.y));
          totalEmissiveRadiance += vec3(${f(r)}, ${f(g)}, ${f(b)}) * diffuseColor.rgb * caustic * causticFacing * causticFade * causticDepth * ${f(settings.strength)};
        }
      }`)
}

export function causticsCacheKey(settings) {
  return settings ? `caustics:${JSON.stringify(settings)}` : ''
}
