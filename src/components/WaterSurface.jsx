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
    vec2 driftA = vec2(uTime * 0.028, uTime * 0.010);
    vec2 driftB = vec2(-uTime * 0.072, uTime * 0.022);

    float broad = fbm(uv * vec2(3.4, 1.8) + driftA);
    float chop = fbm(uv * vec2(14.0, 4.8) + driftB);
    float fine = noise(uv * vec2(36.0, 8.0) + vec2(uTime * 0.13, -uTime * 0.035));

    float broken = broad * 0.60 + chop * 0.34 + fine * 0.12;
    float foam = smoothstep(0.55, 0.83, broken);
    float glint = smoothstep(0.73, 0.95, chop + fine * 0.18);

    // World-horizontal water ceiling: strongest near its far/top UV edge,
    // with a downward dissolve so the diagnostic plane can be positioned in tank space.
    float topGlow = smoothstep(0.00, 0.18, uv.y);
    float lowerFade = 1.0 - smoothstep(0.46, 0.88, uv.y);
    float sideFade = smoothstep(0.0, 0.10, uv.x) * smoothstep(1.0, 0.10, 1.0 - uv.x);
    float softMask = topGlow * lowerFade * sideFade;

    vec3 deepCyan = vec3(0.04, 0.36, 0.52);
    vec3 brightCyan = vec3(0.28, 0.86, 1.0);
    vec3 whiteGlint = vec3(0.88, 1.0, 0.96);
    vec3 color = mix(deepCyan, brightCyan, foam * 0.72);
    color = mix(color, whiteGlint, glint * 0.44);

    float alpha = (0.10 + foam * 0.24 + glint * 0.10) * softMask;
    gl_FragColor = vec4(color, alpha);
  }
`

const SURFACE_PLANE_POSITION = [0, 4.6, -4]
const SURFACE_PLANE_ROTATION = [-Math.PI / 2, 0, 0]
const SURFACE_PLANE_SIZE = [46, 32, 1, 1]

export default function WaterSurface() {
  const material = useRef()
  const uniforms = useMemo(() => ({ uTime: { value: 0 } }), [])

  useFrame(({ clock }) => {
    if (material.current) material.current.uniforms.uTime.value = clock.getElapsedTime()
  })

  return (
    <group>
      <mesh position={SURFACE_PLANE_POSITION} rotation={SURFACE_PLANE_ROTATION} raycast={() => null}>
        <planeGeometry args={SURFACE_PLANE_SIZE} />
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
      <mesh position={SURFACE_PLANE_POSITION} rotation={SURFACE_PLANE_ROTATION} raycast={() => null}>
        <planeGeometry args={SURFACE_PLANE_SIZE} />
        <meshBasicMaterial
          color="#7ff4ff"
          transparent
          opacity={0.88}
          wireframe
          depthWrite={false}
          depthTest={false}
        />
      </mesh>
    </group>
  )
}
