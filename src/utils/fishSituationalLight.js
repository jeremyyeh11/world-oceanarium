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

export const FISH_SITUATIONAL_LIGHT_ENABLED = true

export const FISH_SITUATIONAL_LIGHT_PARS = /* glsl */ `
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
  lit *= 1.0 + dorsal * 0.95 * sun - ventral * 0.5 * (0.4 + 0.6 * sun);

  float facing = max(dot(worldNormal, -viewDir), 0.0);
  float back = smoothstep(0.04, 0.42, viewDir.y) * mix(0.55, 1.0, nearSurface);
  lit *= 1.0 - back * 0.6 * facing;
  float rim = pow(1.0 - facing, 2.2);
  lit += vec3(0.42, 0.86, 1.1) * rim * back * (0.35 + 0.65 * sun) * (0.5 + 0.5 * dorsal);

  // Gallery light enters from the viewing side (+z). The swim volume spans roughly
  // z -22..-8, so the front half of it is lit; tied to the tank rather than the camera so a
  // follow-cam close-up keeps its modelling instead of flattening under a headlamp.
  float front = smoothstep(-20.0, -9.0, worldPos.z) * (1.0 - back * 0.75);
  lit += albedo * vec3(0.5, 0.72, 0.86) * max(worldNormal.z, 0.0) * front * 0.45;
  return lit;
}
`

// The call, injected just before <opaque_fragment> of a MeshStandard/MeshPhysical shader.
// `worldPosVarying` names the varying holding the fragment's world position.
export function fishSituationalLightCall(worldPosVarying, timeUniform) {
  return `outgoingLight = fishSituationalLight(outgoingLight, diffuseColor.rgb, ${worldPosVarying}, normal, ${timeUniform});
#include <opaque_fragment>`
}

export function supportsFishSituationalLight(material) {
  return FISH_SITUATIONAL_LIGHT_ENABLED && Boolean(material?.isMeshStandardMaterial)
}
