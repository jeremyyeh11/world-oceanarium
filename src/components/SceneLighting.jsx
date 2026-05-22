import { useEffect, useMemo } from 'react'
import { useThree } from '@react-three/fiber'
import * as THREE from 'three'

// Baseline tank lighting: generated HDRI-equivalent environment, ACES tone mapping,
// hemisphere/key/fill lights, and exponential water-depth fade. New tanks should add
// a palette here and tune from this setup rather than replacing the lighting model.
const PALETTES = {
  ocean: {
    envTop: '#8bdcff',
    envHorizon: '#0d648f',
    envDeep: '#010712',
    fog: '#030f1b',
    hemiSky: '#8edcff',
    hemiGround: '#020816',
    key: '#9ee5ff',
    fill: '#116b92',
    density: 0.036,
    exposure: 1.04,
  },
  'tropical-river': {
    envTop: '#d3ffd0',
    envHorizon: '#2d8a5c',
    envDeep: '#04120a',
    fog: '#0a2818',
    hemiSky: '#d5ffc1',
    hemiGround: '#031207',
    key: '#d8ffb0',
    fill: '#287e4f',
    density: 0.052,
    exposure: 1.03,
  },
  lake: {
    envTop: '#b8e6ff',
    envHorizon: '#2d6f72',
    envDeep: '#051013',
    fog: '#071d21',
    hemiSky: '#c3edff',
    hemiGround: '#051013',
    key: '#c7f1ff',
    fill: '#2a7276',
    density: 0.034,
    exposure: 1.04,
  },
}

function paintEquirectGradient({ envTop, envHorizon, envDeep }) {
  const canvas = document.createElement('canvas')
  canvas.width = 1024
  canvas.height = 512
  const ctx = canvas.getContext('2d')

  const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height)
  gradient.addColorStop(0, envTop)
  gradient.addColorStop(0.34, envHorizon)
  gradient.addColorStop(0.72, '#062433')
  gradient.addColorStop(1, envDeep)
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, canvas.width, canvas.height)

  ctx.globalCompositeOperation = 'screen'
  for (let i = 0; i < 9; i += 1) {
    const x = canvas.width * (0.12 + i * 0.11)
    const beam = ctx.createRadialGradient(x, 0, 0, x, canvas.height * 0.28, canvas.width * 0.18)
    beam.addColorStop(0, 'rgba(220, 255, 230, 0.24)')
    beam.addColorStop(1, 'rgba(220, 255, 230, 0)')
    ctx.fillStyle = beam
    ctx.fillRect(0, 0, canvas.width, canvas.height)
  }

  const texture = new THREE.CanvasTexture(canvas)
  texture.mapping = THREE.EquirectangularReflectionMapping
  texture.colorSpace = THREE.SRGBColorSpace
  texture.needsUpdate = true
  return texture
}

export default function SceneLighting({ biome = 'ocean' }) {
  const { scene, gl } = useThree()
  const palette = PALETTES[biome] ?? PALETTES.ocean
  const envTexture = useMemo(() => paintEquirectGradient(palette), [palette])

  useEffect(() => {
    const previousEnvironment = scene.environment
    const previousToneMapping = gl.toneMapping
    const previousExposure = gl.toneMappingExposure

    scene.environment = envTexture
    gl.toneMapping = THREE.ACESFilmicToneMapping
    gl.toneMappingExposure = palette.exposure

    return () => {
      scene.environment = previousEnvironment
      gl.toneMapping = previousToneMapping
      gl.toneMappingExposure = previousExposure
      envTexture.dispose()
    }
  }, [envTexture, gl, palette.exposure, scene])

  return (
    <>
      <color attach="background" args={[palette.fog]} />
      <fogExp2 attach="fog" args={[palette.fog, palette.density]} />
      <hemisphereLight args={[palette.hemiSky, palette.hemiGround, biome === 'tropical-river' ? 1.55 : 1.35]} />
      <directionalLight position={[-8, 12, 8]} intensity={biome === 'tropical-river' ? 1.9 : 1.65} color={palette.key} />
      <directionalLight position={[7, -2, 5]} intensity={0.55} color={palette.fill} />
      <pointLight position={[0, 4, 6]} intensity={0.7} distance={26} decay={1.7} color={palette.envHorizon} />
    </>
  )
}
