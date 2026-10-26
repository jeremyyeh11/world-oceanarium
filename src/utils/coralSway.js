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
// rim (flex 1); phase: radians.
export function addSwayAttributes(geometry, { origin, direction, amplitude, reach, phase }) {
  const position = geometry.attributes.position
  const flex = new Float32Array(position.count)
  const sway = new Float32Array(position.count * 4)
  for (let i = 0; i < position.count; i++) {
    const d = Math.hypot(position.getX(i) - origin.x, position.getY(i) - origin.y, position.getZ(i) - origin.z)
    flex[i] = Math.min(d / reach, 1)
    sway[i * 4] = direction.x * amplitude
    sway[i * 4 + 1] = direction.y * amplitude
    sway[i * 4 + 2] = direction.z * amplitude
    sway[i * 4 + 3] = phase
  }
  geometry.setAttribute('aSwayFlex', new THREE.BufferAttribute(flex, 1))
  geometry.setAttribute('aSway', new THREE.BufferAttribute(sway, 4))
  return geometry
}

/**
 * Patch a material to sway (and take the landscape's caustics, utils/caustics.js). settings
 * (landscapes.js `seaFans.sway`):
 *   period   seconds for one swing back and forth (the surge)
 *   flutter  the faster ripple's share of the swing at the rim
 */
export function applyCoralSway(material, settings, caustics = null) {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uSwayTime = SWAY_TIME
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uSwayTime;\nattribute float aSwayFlex;\nattribute vec4 aSway;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
      {
        float swayT = uSwayTime * ${f((Math.PI * 2) / settings.period)} + aSway.w;
        float swayWave = sin(swayT) + ${f(settings.flutter)} * aSwayFlex * sin(2.7 * swayT + 4.0 * aSwayFlex);
        transformed += aSway.xyz * (aSwayFlex * aSwayFlex) * swayWave;
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
  material.customProgramCacheKey = () => `coral-sway:${f(settings.period)}:${f(settings.flutter)}:lit-both|${causticsCacheKey(caustics)}`
}
