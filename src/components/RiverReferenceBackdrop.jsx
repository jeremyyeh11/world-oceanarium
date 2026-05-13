import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

const CONTOUR_VERTEX = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const CONTOUR_FRAGMENT = /* glsl */ `
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
    float v = 0.0;
    float a = 0.52;
    for (int i = 0; i < 5; i++) {
      v += a * noise(p);
      p = mat2(1.6, -1.1, 1.1, 1.6) * p + 4.7;
      a *= 0.52;
    }
    return v;
  }

  void main() {
    vec2 uv = vUv;
    float field = fbm(uv * vec2(5.8, 4.2) + vec2(uTime * 0.018, -uTime * 0.012));
    float contour = abs(fract(field * 9.0) - 0.5);
    float line = smoothstep(0.048, 0.0, contour);
    float shorelineGlow = smoothstep(0.52, 0.82, uv.y) * smoothstep(1.0, 0.78, uv.y);
    float alpha = line * 0.23 + shorelineGlow * 0.08;
    gl_FragColor = vec4(vec3(0.34, 1.0, 0.78), alpha);
  }
`

function makeBankGeometry() {
  const verts = [
    [-14, 8, 0], [14, 8, 0],
    [14, -0.55, 0], [11.8, -0.95, 0], [9.6, -0.48, 0], [7.2, -1.2, 0],
    [5.2, -0.76, 0], [3.3, -1.55, 0], [1.1, -0.92, 0], [-0.8, -1.35, 0],
    [-2.7, -0.7, 0], [-4.9, -1.22, 0], [-7.4, -0.54, 0], [-9.2, -1.0, 0],
    [-11.4, -0.38, 0], [-14, -0.85, 0],
  ]
  const shape = new THREE.Shape()
  shape.moveTo(verts[0][0], verts[0][1])
  verts.slice(1).forEach(([x, y]) => shape.lineTo(x, y))
  shape.closePath()
  return new THREE.ShapeGeometry(shape)
}

function RiverBank() {
  const geometry = useMemo(makeBankGeometry, [])
  return (
    <mesh geometry={geometry} position={[0, 0, -5.8]} raycast={() => null}>
      <meshBasicMaterial color="#071a1a" transparent opacity={0.96} side={THREE.DoubleSide} fog={false} />
    </mesh>
  )
}

function WaterContourOverlay() {
  const material = useRef()
  const uniforms = useMemo(() => ({ uTime: { value: 0 } }), [])

  useFrame(({ clock }) => {
    if (material.current) material.current.uniforms.uTime.value = clock.getElapsedTime()
  })

  return (
    <mesh position={[0, -3.65, -5.6]} raycast={() => null}>
      <planeGeometry args={[28, 9.5, 1, 1]} />
      <shaderMaterial
        ref={material}
        uniforms={uniforms}
        vertexShader={CONTOUR_VERTEX}
        fragmentShader={CONTOUR_FRAGMENT}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </mesh>
  )
}

function FloatingMarkers() {
  const markers = [
    [-6.3, -2.6, 0.28], [-2.2, -3.35, -0.18], [3.9, -2.15, 0.12], [7.5, -4.05, -0.34],
  ]
  return markers.map(([x, y, r], i) => (
    <group key={i} position={[x, y, -4.9]} rotation={[0, 0, r]} raycast={() => null}>
      <mesh>
        <boxGeometry args={[0.55, 0.13, 0.01]} />
        <meshBasicMaterial color={i % 2 ? '#dfffee' : '#70ffd7'} transparent opacity={0.82} fog={false} />
      </mesh>
      <mesh position={[0, -0.12, 0]}>
        <boxGeometry args={[0.36, 0.05, 0.01]} />
        <meshBasicMaterial color="#032c2d" transparent opacity={0.72} fog={false} />
      </mesh>
    </group>
  ))
}

export default function RiverReferenceBackdrop() {
  return (
    <group>
      <mesh position={[0, 0, -6.2]} raycast={() => null}>
        <planeGeometry args={[28, 16]} />
        <meshBasicMaterial color="#052025" fog={false} />
      </mesh>
      <mesh position={[0, -4.2, -6.05]} raycast={() => null}>
        <planeGeometry args={[28, 8]} />
        <meshBasicMaterial color="#12bda6" fog={false} />
      </mesh>
      <WaterContourOverlay />
      <RiverBank />
      <FloatingMarkers />
    </group>
  )
}
