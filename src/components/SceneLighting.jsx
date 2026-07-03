import { useEffect, useMemo } from 'react'
import { useThree } from '@react-three/fiber'
import * as THREE from 'three'

// Baseline tank lighting: generated HDRI-equivalent environment, ACES tone mapping,
// hemisphere/key/fill lights, and exponential water-depth fade. New tanks should add
// a palette here and tune from this setup rather than replacing the lighting model.
const PALETTES = {
  ocean: {
    envTop: '#6cb4f5',
    envHorizon: '#0e55b0',
    envDeep: '#010a24',
    // Distance haze color for the sunlit zone: a rich saturated ocean blue so far
    // creatures fade into blue-scattered light (aerial perspective), not gray.
    fog: '#0a2d5e',
    hemiSky: '#6fb4ff',
    hemiGround: '#020a1c',
    key: '#8cc4ff',
    fill: '#1257b0',
    density: 0.032,
    exposure: 1.04,
    // Dedicated backdrop gradient for scene.background (kept separate from the brighter
    // environment map that lights the creatures): a luminous surface band up top that
    // falls off to deep-blue water where the animals swim, filling the empty column
    // without washing the scene out. Epipelagic open water is a saturated cobalt/azure —
    // nearly pure blue wavelengths — so keep chroma high and avoid pale/gray drift.
    backgroundStops: [
      [0, '#2f86dd'],
      [0.14, '#1659b8'],
      [0.34, '#0d3f92'],
      [0.56, '#072a68'],
      [0.78, '#041843'],
      [1, '#010a24'],
    ],
    backgroundBeamAlpha: 0.16,
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

function paintEquirectGradient({ envTop, envHorizon, envDeep }, { stops = null, beamAlpha = 0.24, mottle = 0, blur = 0 } = {}) {
  const canvas = document.createElement('canvas')
  canvas.width = 1536
  canvas.height = 768
  const ctx = canvas.getContext('2d')

  const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height)
  const gradientStops = stops ?? [[0, envTop], [0.34, envHorizon], [0.72, '#062433'], [1, envDeep]]
  for (const [offset, color] of gradientStops) gradient.addColorStop(offset, color)
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, canvas.width, canvas.height)

  ctx.globalCompositeOperation = 'screen'
  for (let i = 0; i < 9; i += 1) {
    const x = canvas.width * (0.12 + i * 0.11)
    const beam = ctx.createRadialGradient(x, 0, 0, x, canvas.height * 0.28, canvas.width * 0.18)
    beam.addColorStop(0, `rgba(190, 225, 255, ${beamAlpha})`)
    beam.addColorStop(1, 'rgba(190, 225, 255, 0)')
    ctx.fillStyle = beam
    ctx.fillRect(0, 0, canvas.width, canvas.height)
  }

  // Soft, organic light mottling: large blurry caustic-style patches (lighter and darker)
  // scattered over the water. This gives the column depth/variation so it doesn't read as a
  // flat gradient, and because it varies luminance horizontally it also breaks up the straight
  // horizontal 8-bit gradient bands — without any per-pixel grain.
  if (mottle > 0) {
    for (let i = 0; i < 46; i += 1) {
      const cx = Math.random() * canvas.width
      const cy = Math.random() * canvas.height * 0.92
      const radius = canvas.width * (0.10 + Math.random() * 0.24)
      // Fade the effect with depth — the surface has the most light play.
      const depthFalloff = 1.0 - (cy / canvas.height) * 0.55
      const strength = (0.035 + Math.random() * 0.055) * mottle * depthFalloff
      const patch = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius)
      if (Math.random() > 0.42) {
        ctx.globalCompositeOperation = 'screen'
        patch.addColorStop(0, `rgba(90, 165, 255, ${strength})`)
        patch.addColorStop(1, 'rgba(90, 165, 255, 0)')
      } else {
        ctx.globalCompositeOperation = 'multiply'
        patch.addColorStop(0, `rgba(2, 10, 40, ${strength * 1.5})`)
        patch.addColorStop(1, 'rgba(2, 10, 40, 0)')
      }
      ctx.fillStyle = patch
      ctx.fillRect(0, 0, canvas.width, canvas.height)
    }
  }
  ctx.globalCompositeOperation = 'source-over'

  // Optional soft blur pass: spreads the gradient/mottle transitions so no hard 8-bit
  // step edges survive as visible bands. Runs once at init via a temp canvas.
  let sourceCanvas = canvas
  if (blur > 0) {
    const blurred = document.createElement('canvas')
    blurred.width = canvas.width
    blurred.height = canvas.height
    const blurCtx = blurred.getContext('2d')
    blurCtx.filter = `blur(${blur}px)`
    blurCtx.drawImage(canvas, 0, 0)
    sourceCanvas = blurred
  }

  const texture = new THREE.CanvasTexture(sourceCanvas)
  texture.mapping = THREE.EquirectangularReflectionMapping
  texture.colorSpace = THREE.SRGBColorSpace
  texture.needsUpdate = true
  return texture
}

export default function SceneLighting({ biome = 'ocean' }) {
  const { scene, gl } = useThree()
  const palette = PALETTES[biome] ?? PALETTES.ocean
  const envTexture = useMemo(() => paintEquirectGradient(palette), [palette])
  const backgroundTexture = useMemo(
    () => (palette.backgroundStops
      ? paintEquirectGradient(palette, { stops: palette.backgroundStops, beamAlpha: palette.backgroundBeamAlpha ?? 0.18, mottle: palette.backgroundMottle ?? 1, blur: palette.backgroundBlur ?? 3 })
      : null),
    [palette],
  )

  useEffect(() => {
    const previousEnvironment = scene.environment
    const previousBackground = scene.background
    const previousToneMapping = gl.toneMapping
    const previousExposure = gl.toneMappingExposure

    scene.environment = envTexture
    if (backgroundTexture) scene.background = backgroundTexture
    gl.toneMapping = THREE.ACESFilmicToneMapping
    gl.toneMappingExposure = palette.exposure

    return () => {
      scene.environment = previousEnvironment
      scene.background = previousBackground
      gl.toneMapping = previousToneMapping
      gl.toneMappingExposure = previousExposure
      backgroundTexture?.dispose()
      envTexture.dispose()
    }
  }, [envTexture, backgroundTexture, gl, palette.exposure, scene])

  return (
    <>
      {!backgroundTexture && <color attach="background" args={[palette.fog]} />}
      <fogExp2 attach="fog" args={[palette.fog, palette.density]} />
      <hemisphereLight args={[palette.hemiSky, palette.hemiGround, biome === 'tropical-river' ? 1.55 : 1.35]} />
      <directionalLight position={[-8, 12, 8]} intensity={biome === 'tropical-river' ? 1.9 : 1.65} color={palette.key} />
      <directionalLight position={[7, -2, 5]} intensity={0.55} color={palette.fill} />
      <pointLight position={[0, 4, 6]} intensity={0.7} distance={26} decay={1.7} color={palette.envHorizon} />
    </>
  )
}
