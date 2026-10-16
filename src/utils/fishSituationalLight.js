// Situational fish lighting. The scene lights are directional and the environment map is
// uniform, so every fish was shaded the same way wherever it swam. Real downwelling light
// depends on where the animal is relative to the surface, the light pools the surface
// focuses, and the viewer:
//   - top light:   dorsal surfaces catch the sun, bellies fall into shade; strongest high in
//                  the column and inside a light pool
//   - back light:  a fish seen from below sits against the bright surface, so its
//                  camera-facing side drops toward silhouette and its edges glow
//   - front light: a fish in the front of the tank catches light from the viewing side
// Runs on the lit colour before tone mapping and fog, so distant fish still fade into the
// water haze. Shared by the GLB fish materials and the instanced sardine LODs so a sardine
// does not change shading when it switches level.
//
// Large fish (the sunfish, the mako) also shade the fish under them. There are no shadow maps
// (too costly for a full tank on a phone): each caster publishes its centre, heading and body
// length into a few shared uniform slots every frame, and the shader darkens a fragment under
// a caster's top-down footprint, widening and fading with depth as the light scatters.

import * as THREE from 'three'

export const FISH_SITUATIONAL_LIGHT_ENABLED = true

export const FISH_SHADOW_CASTER_SLOTS = 4
// Body length (WU) from which a fish shades the ones below it: the sunfish (13.2) and the mako
// (17.8), not the mahi (8.4 at full size).
export const FISH_SHADOW_CASTER_MIN_BODY_LENGTH = 10

// Shared by every fish and sardine material, so one write per caster reaches them all.
// casters: xyz centre, w body length (0 = empty slot). shapes: xy heading in the XZ plane,
// z strength (fades with the caster's opacity).
export const fishShadowUniforms = {
  uFishShadowCasters: { value: Array.from({ length: FISH_SHADOW_CASTER_SLOTS }, () => new THREE.Vector4(0, 0, 0, 0)) },
  uFishShadowShapes: { value: Array.from({ length: FISH_SHADOW_CASTER_SLOTS }, () => new THREE.Vector3()) },
  uFishShadowStrength: { value: 0.7 },
}

const shadowSlots = new Map()

export function publishFishShadowCaster(creatureId, position, forward, bodyLength, opacity = 1) {
  let slot = shadowSlots.get(creatureId)
  if (slot === undefined) {
    const used = new Set(shadowSlots.values())
    for (let i = 0; i < FISH_SHADOW_CASTER_SLOTS; i += 1) {
      if (!used.has(i)) { slot = i; break }
    }
    if (slot === undefined) return
    shadowSlots.set(creatureId, slot)
  }
  fishShadowUniforms.uFishShadowCasters.value[slot].set(position.x, position.y, position.z, bodyLength)
  const headingLength = Math.hypot(forward.x, forward.z)
  const shape = fishShadowUniforms.uFishShadowShapes.value[slot]
  if (headingLength > 1e-3) shape.set(forward.x / headingLength, forward.z / headingLength, opacity)
  else shape.set(0, -1, opacity)
}

export function releaseFishShadowCaster(creatureId) {
  const slot = shadowSlots.get(creatureId)
  if (slot === undefined) return
  shadowSlots.delete(creatureId)
  fishShadowUniforms.uFishShadowCasters.value[slot].set(0, 0, 0, 0)
}

// The slot a fish casts from, or -1, so its own body is left out of its shadow. A material
// whose self uniform stays at -2 (the Atlas) takes no caster shadows at all.
export function fishShadowSlot(creatureId) {
  return shadowSlots.get(creatureId) ?? -1
}

// Binds the shared caster uniforms, plus the material's own slot uniform, in onBeforeCompile.
export function bindFishShadowUniforms(shader, selfUniform) {
  Object.assign(shader.uniforms, fishShadowUniforms)
  shader.uniforms.uFishShadowSelf = selfUniform
}

export const FISH_SITUATIONAL_LIGHT_PARS = /* glsl */ `
uniform vec4 uFishShadowCasters[${FISH_SHADOW_CASTER_SLOTS}];
uniform vec3 uFishShadowShapes[${FISH_SHADOW_CASTER_SLOTS}];
uniform float uFishShadowStrength;
uniform float uFishShadowSelf;
float fishCasterShadow(vec3 worldPos) {
  if (uFishShadowSelf < -1.5) return 0.0;
  float shade = 0.0;
  for (int i = 0; i < ${FISH_SHADOW_CASTER_SLOTS}; i++) {
    vec4 caster = uFishShadowCasters[i];
    if (caster.w <= 0.0 || float(i) == uFishShadowSelf) continue;
    float len = caster.w;
    float below = caster.y - worldPos.y;
    // Starts under the body, then widens and thins with depth; gone about 12 WU down.
    float onset = smoothstep(0.0, 0.12 * len, below);
    float spread = 1.0 + max(below, 0.0) / len * 0.8;
    float reach = 1.0 - smoothstep(2.0, 12.0, below);
    vec2 offset = worldPos.xz - caster.xz;
    vec3 shape = uFishShadowShapes[i];
    float along = dot(offset, shape.xy) / (0.5 * len * spread);
    float across = dot(offset, vec2(-shape.y, shape.x)) / (0.3 * len * spread);
    float footprint = 1.0 - smoothstep(0.25, 1.0, length(vec2(along, across)));
    shade = max(shade, onset * reach * footprint * shape.z / (0.5 + 0.5 * spread));
  }
  return shade * uFishShadowStrength;
}
float fishPoolHash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}
float fishPoolNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(fishPoolHash(i), fishPoolHash(i + vec2(1.0, 0.0)), f.x),
    mix(fishPoolHash(i + vec2(0.0, 1.0)), fishPoolHash(i + vec2(1.0, 1.0)), f.x),
    f.y
  );
}
vec3 fishSituationalLight(vec3 lit, vec3 albedo, vec3 worldPos, vec3 viewNormal, float time) {
  vec3 worldNormal = inverseTransformDirection(viewNormal, viewMatrix);
  vec3 toFish = worldPos - cameraPosition;
  vec3 viewDir = normalize(toFish);

  // Light pools: broad, slowly drifting patches where the surface focuses the sun. Sized so
  // neighbouring fish in one frame land in different pools.
  vec2 poolUv = worldPos.xz * 0.15 + vec2(time * 0.011, -time * 0.007);
  float poolNoise = fishPoolNoise(poolUv) * 0.65 + fishPoolNoise(poolUv * 2.3 + vec2(4.1, 1.7)) * 0.35;
  float pool = smoothstep(0.32, 0.74, poolNoise);
  float nearSurface = smoothstep(-9.0, 3.0, worldPos.y);
  float sun = mix(0.3, 1.0, pool) * mix(0.4, 1.0, nearSurface);

  float up = worldNormal.y;
  float dorsal = smoothstep(-0.1, 0.9, up);
  float ventral = smoothstep(0.1, -0.8, up);
  lit *= 1.0 + dorsal * 1.15 * sun - ventral * 0.7 * (0.4 + 0.6 * sun);

  float facing = max(dot(worldNormal, -viewDir), 0.0);
  float back = smoothstep(0.04, 0.42, viewDir.y) * mix(0.55, 1.0, nearSurface);
  lit *= 1.0 - back * 0.7 * facing;
  float rim = pow(1.0 - facing, 2.2);
  lit += vec3(0.42, 0.86, 1.1) * rim * back * (0.35 + 0.65 * sun) * (0.5 + 0.5 * dorsal);

  // Gallery light enters from the viewing side (+z). The swim volume spans roughly
  // z -22..-8, so the front half of it is lit; tied to the tank rather than the camera so a
  // follow-cam close-up keeps its modelling instead of flattening under a headlamp. Bellies
  // take less of it, so the front light does not fill in the top light's shading.
  float front = smoothstep(-20.0, -9.0, worldPos.z) * (1.0 - back * 0.75) * (1.0 - ventral * 0.6);
  lit += albedo * vec3(0.5, 0.72, 0.86) * max(worldNormal.z, 0.0) * front * 0.45;
  return lit;
}
`

// The call, injected just before <opaque_fragment> of a MeshStandard/MeshPhysical shader.
// `worldPosVarying` names the varying holding the fragment's world position.
export function fishSituationalLightCall(worldPosVarying, timeUniform) {
  return `outgoingLight = fishSituationalLight(outgoingLight, diffuseColor.rgb, ${worldPosVarying}, normal, ${timeUniform});
outgoingLight *= 1.0 - fishCasterShadow(${worldPosVarying});
#include <opaque_fragment>`
}

export function supportsFishSituationalLight(material) {
  return FISH_SITUATIONAL_LIGHT_ENABLED && Boolean(material?.isMeshStandardMaterial)
}
