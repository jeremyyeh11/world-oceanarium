import * as THREE from 'three'

// Height-graded water: the fog colour depends on the world height of what it covers, deep near
// the sea bed and bright near the surface, instead of one colour at every depth. Light fades with
// depth too: what lies near the sea bed is lit less (`seabedLight` of full at the low height). A tank opts in
// with `lighting.heightFog` (SceneLighting.jsx); with none, the shaders give exactly three's own
// fog.
//
// It patches three's fog chunks once, at import, so every fogged material picks it up (rocks,
// sand, fish, labels). The values live in shared uniform objects rather than THREE.Color or
// Vector instances: three copies those into each material's uniforms when the material is
// built, but keeps plain objects by reference, so one write here reaches every material.
// SceneLighting writes them before the tank's scene renders and switches the grade off after,
// so other canvases (the Atlas) are untouched.
//
// World height is worked out per vertex from the view-space position and the second row of the
// camera's world matrix, which every fogged shader already has to hand (mvPosition).

const worldYRow = { x: 0, y: 0, z: 0, w: 0 }
const lowColor = { x: 0, y: 0, z: 0 }
const highColor = { x: 0, y: 0, z: 0 }
// x: height of the low colour, y: height of the high colour, z: strength (0 = off), w: light
// left at the low height (1 = none taken).
const range = { x: 0, y: 1, z: 0, w: 0 }

// Once only: a hot reload re-runs this module, and appending twice would declare everything twice.
if (!THREE.ShaderChunk.fog_vertex.includes('vFogWorldY')) {
THREE.ShaderChunk.fog_pars_vertex += /* glsl */`
#ifdef USE_FOG
  uniform vec4 fogWorldYRow;
  varying float vFogWorldY;
#endif
`
THREE.ShaderChunk.fog_vertex += /* glsl */`
#ifdef USE_FOG
  vFogWorldY = dot( fogWorldYRow, vec4( mvPosition.xyz, 1.0 ) );
#endif
`
THREE.ShaderChunk.fog_pars_fragment += /* glsl */`
#ifdef USE_FOG
  uniform vec3 fogHeightLow;
  uniform vec3 fogHeightHigh;
  uniform vec4 fogHeightRange;
  varying float vFogWorldY;
#endif
`
THREE.ShaderChunk.fog_fragment = THREE.ShaderChunk.fog_fragment.replace(
  'gl_FragColor.rgb = mix( gl_FragColor.rgb, fogColor, fogFactor );',
  /* glsl */`vec3 fogTint = fogColor;
  if ( fogHeightRange.z > 0.0 ) {
    float fogHeightT = clamp( ( vFogWorldY - fogHeightRange.x ) / max( 0.001, fogHeightRange.y - fogHeightRange.x ), 0.0, 1.0 );
    fogTint = mix( fogColor, mix( fogHeightLow, fogHeightHigh, fogHeightT ), fogHeightRange.z );
    gl_FragColor.rgb *= mix( 1.0, mix( fogHeightRange.w, 1.0, fogHeightT ), fogHeightRange.z );
  }
  gl_FragColor.rgb = mix( gl_FragColor.rgb, fogTint, fogFactor );`,
)
}

for (const shader of Object.values(THREE.ShaderLib)) {
  if (!shader.uniforms?.fogColor) continue
  shader.uniforms.fogWorldYRow = { value: worldYRow }
  shader.uniforms.fogHeightLow = { value: lowColor }
  shader.uniforms.fogHeightHigh = { value: highColor }
  shader.uniforms.fogHeightRange = { value: range }
}

const scratchColor = new THREE.Color()

function writeColor(target, hex) {
  scratchColor.set(hex)
  target.x = scratchColor.r
  target.y = scratchColor.g
  target.z = scratchColor.b
}

// settings: { low, high, yLow, yHigh, strength, seabedLight }, colours as hex strings.
export function enableHeightFog(settings, camera) {
  writeColor(lowColor, settings.low)
  writeColor(highColor, settings.high)
  range.x = settings.yLow
  range.y = settings.yHigh
  range.z = settings.strength ?? 1
  range.w = settings.seabedLight ?? 1
  const e = camera.matrixWorld.elements
  worldYRow.x = e[1]
  worldYRow.y = e[5]
  worldYRow.z = e[9]
  worldYRow.w = e[13]
}

export function disableHeightFog() {
  range.z = 0
}
