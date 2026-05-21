import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

const SURFACE_VERTEX = /* glsl */ `
  varying vec2 vUv;

  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const SURFACE_FRAGMENT = /* glsl */ `
  uniform float uTime;
  varying vec2 vUv;

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
  }

  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
      mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
      u.y
    );
  }

  float fbm(vec2 p) {
    float value = 0.0;
    float amp = 0.58;
    for (int i = 0; i < 4; i++) {
      value += amp * noise(p);
      p = mat2(1.68, -0.74, 0.74, 1.68) * p + 5.3;
      amp *= 0.52;
    }
    return value;
  }

  void main() {
    vec2 uv = vUv;
    vec2 driftA = vec2(uTime * 0.035, uTime * 0.010);
    vec2 driftB = vec2(-uTime * 0.090, uTime * 0.026);

    float broad = fbm(uv * vec2(4.5, 2.0) + driftA);
    float chop = fbm(uv * vec2(17.0, 5.4) + driftB);
    float fine = noise(uv * vec2(42.0, 10.0) + vec2(uTime * 0.16, -uTime * 0.04));

    float broken = broad * 0.58 + chop * 0.34 + fine * 0.14;
    float foam = smoothstep(0.56, 0.84, broken);
    float glint = smoothstep(0.72, 0.94, chop + fine * 0.20);

    // Keep the plane readable as a water ceiling: bright near the visual band,
    // feathered at its edges, never a hard rectangular debug card.
    float edgeFade = smoothstep(0.0, 0.08, uv.y) * smoothstep(1.0, 0.16, uv.y);
    float xFade = smoothstep(0.0, 0.05, uv.x) * smoothstep(1.0, 0.05, 1.0 - uv.x);
    float band = edgeFade * xFade;

    vec3 deepCyan = vec3(0.06, 0.48, 0.70);
    vec3 brightCyan = vec3(0.26, 0.92, 1.0);
    vec3 whiteGlint = vec3(0.86, 1.0, 0.96);
    vec3 color = mix(deepCyan, brightCyan, foam * 0.86);
    color = mix(color, whiteGlint, glint * 0.58);

    float alpha = (0.18 + foam * 0.34 + glint * 0.16) * band;
    gl_FragColor = vec4(color, alpha);
  }
`

export default function WaterSurface() {
  const material = useRef()
  const uniforms = useMemo(() => ({ uTime: { value: 0 } }), [])

  useFrame(({ clock }) => {
    if (material.current) material.current.uniforms.uTime.value = clock.getElapsedTime()
  })

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[60, 3.5, 0]} raycast={() => null}>
      <planeGeometry args={[240, 30, 1, 1]} />
      <shaderMaterial
        ref={material}
        uniforms={uniforms}
        vertexShader={SURFACE_VERTEX}
        fragmentShader={SURFACE_FRAGMENT}
        transparent
        depthWrite={false}
        depthTest={false}
        blending={THREE.AdditiveBlending}
        side={THREE.DoubleSide}
      />
    </mesh>
  )
}
