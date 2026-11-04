import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { applyCaustics, causticsCacheKey } from './caustics'

// Soft corals swaying in the surge (docs/procedural/coral-sway.md): a sea fan rocks back and forth
// across the current, its holdfast still and its rim swinging furthest, with a smaller, faster
// flutter that grows toward the rim. All of it is a vertex offset in the material's shader, from
// two attributes baked into the geometry when it is placed (addSwayAttributes), so merged meshes
// sway too and the CPU does nothing per frame but advance one shared clock.
//
//   aSwayFlex  0 at the holdfast to 1 at the farthest point of the colony from it
//   aSway      xyz: the way the colony swings (the current's direction) times its rim's swing,
//              in the geometry's units; w: its phase, so neighbours do not move in step
//
// The offset is aSway.xyz × flex² × (sin(t) + flutter × flex × sin(2.7 t + 4 flex)): flex²
// keeps the stem near the holdfast nearly still, the way a fan's trunk is stiff and its outer
// branches bend.

// Shared by reference with every patched material, so one write moves them all.
export const SWAY_TIME = { value: 0 }

const f = value => Number(value).toFixed(4)

// Advances the sway clock in a canvas's frame loop. Seconds of wall time, so the tank and the
// Atlas, each with its own canvas, agree.
export function useSwayClock() {
  useFrame(() => {
    SWAY_TIME.value = performance.now() / 1000
  })
}

// Bakes the sway attributes into a geometry (any space; origin and direction in the same one).
// origin: the holdfast (Vector3); direction: the unit swing direction (Vector3); amplitude: the
// rim's swing in the geometry's units; reach: the distance from the holdfast that counts as the
// rim (flex 1); phase: radians. By default flex is the straight-line distance from the holdfast
// over reach (a fan). With `up` (the colony's unit up) flex is height along it instead, 0 up to
// `flexFrom` of reach and rising to 1 at the top (a toadstool: its stalk still, its cap swaying).
// With `swell`, each vertex swings along the surface's own outward normal instead of `direction`,
// so the part breathes in and out rather than leaning (a giant clam's mantle): the normals of the
// faces meeting at a point are averaged, so a flat-shaded mesh's split vertices move together and
// its facets never open.
export function addSwayAttributes(geometry, { origin, direction, amplitude, reach, phase, up = null, flexFrom = 0, swell = false }) {
  const position = geometry.attributes.position
  const flex = new Float32Array(position.count)
  const sway = new Float32Array(position.count * 4)
  const outward = swell ? pointNormals(geometry) : null
  for (let i = 0; i < position.count; i++) {
    const dx = position.getX(i) - origin.x
    const dy = position.getY(i) - origin.y
    const dz = position.getZ(i) - origin.z
    flex[i] = up
      ? Math.min(Math.max(((dx * up.x + dy * up.y + dz * up.z) / reach - flexFrom) / (1 - flexFrom), 0), 1)
      : Math.min(Math.hypot(dx, dy, dz) / reach, 1)
    const way = outward ? outward[i] : direction
    sway[i * 4] = way.x * amplitude
    sway[i * 4 + 1] = way.y * amplitude
    sway[i * 4 + 2] = way.z * amplitude
    sway[i * 4 + 3] = phase
  }
  geometry.setAttribute('aSwayFlex', new THREE.BufferAttribute(flex, 1))
  geometry.setAttribute('aSway', new THREE.BufferAttribute(sway, 4))
  return geometry
}

// One unit normal per vertex, the same for every vertex at the same point: the sum of the normals
// of the faces round that point (vertices within 0.1 mm count as one), normalised.
function pointNormals(geometry) {
  const position = geometry.attributes.position
  const index = geometry.index
  const keyOf = i => `${Math.round(position.getX(i) * 1e4)},${Math.round(position.getY(i) * 1e4)},${Math.round(position.getZ(i) * 1e4)}`
  const sums = new Map()
  const keys = new Array(position.count)
  for (let i = 0; i < position.count; i++) keys[i] = keyOf(i)
  const a = new THREE.Vector3()
  const b = new THREE.Vector3()
  const c = new THREE.Vector3()
  const count = index ? index.count : position.count
  for (let k = 0; k < count; k += 3) {
    const [i, j, l] = index ? [index.getX(k), index.getX(k + 1), index.getX(k + 2)] : [k, k + 1, k + 2]
    a.fromBufferAttribute(position, i)
    b.fromBufferAttribute(position, j).sub(a)
    c.fromBufferAttribute(position, l).sub(a)
    // Area-weighted: the cross product's length is twice the face's area.
    const face = new THREE.Vector3().crossVectors(b, c)
    for (const v of [i, j, l]) {
      const sum = sums.get(keys[v])
      if (sum) sum.add(face)
      else sums.set(keys[v], face.clone())
    }
  }
  for (const sum of sums.values()) sum.normalize()
  return keys.map(key => sums.get(key) ?? new THREE.Vector3(0, 1, 0))
}

/**
 * Patch a material to sway (and take the landscape's caustics, utils/caustics.js). settings
 * (landscapes.js `seaFans.sway`, `leatherCorals.sway`):
 *   period   seconds for one swing back and forth (the surge)
 *   flutter  the faster ripple's share of the swing at the rim
 *   orbit    optional: the swing across the current, as a share of the swing along it, a quarter
 *            period behind, so the top traces an ellipse in the level plane instead of a line
 *            (a toadstool's cap circling on its stalk; a fan, which bends one way only, has none)
 */
export function applyCoralSway(material, settings, caustics = null) {
  const orbit = settings.orbit ?? 0
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uSwayTime = SWAY_TIME
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uSwayTime;\nattribute float aSwayFlex;\nattribute vec4 aSway;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
      {
        float swayT = uSwayTime * ${f((Math.PI * 2) / settings.period)} + aSway.w;
        float swayWave = sin(swayT) + ${f(settings.flutter)} * aSwayFlex * sin(2.7 * swayT + 4.0 * aSwayFlex);
        transformed += aSway.xyz * (aSwayFlex * aSwayFlex) * swayWave;${orbit > 0 ? `
        // Across the current, level: the swing's direction turned a quarter about up.
        transformed += vec3(-aSway.z, 0.0, aSway.x) * (aSwayFlex * aSwayFlex) * ${f(orbit)} * cos(swayT);` : ''}
      }`)
    // Both faces lit alike: a double-sided material turns a back face's normal round, so the
    // side of a fan facing away from the sun shaded dark and read as missing (Jeremy, 2026-10-26:
    // "render the fan plane on both sides"). A thin lattice is lit through, so the back face
    // keeps the front's normal.
    shader.fragmentShader = shader.fragmentShader.replace('#include <normal_fragment_begin>', `#include <normal_fragment_begin>
      #ifdef DOUBLE_SIDED
        normal *= faceDirection;
      #endif`)
    applyCaustics(shader, caustics)
  }
  material.customProgramCacheKey = () => `coral-sway:${f(settings.period)}:${f(settings.flutter)}:${f(orbit)}:lit-both|${causticsCacheKey(caustics)}`
}
