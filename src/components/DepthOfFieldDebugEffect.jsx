import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo } from 'react'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { BokehPass } from 'three/examples/jsm/postprocessing/BokehPass.js'

export default function DepthOfFieldDebugEffect({ settings }) {
  const { gl, scene, camera, size } = useThree()
  const enabled = Boolean(settings?.enabled)

  const composer = useMemo(() => {
    const nextComposer = new EffectComposer(gl)
    nextComposer.addPass(new RenderPass(scene, camera))
    const bokehPass = new BokehPass(scene, camera, {
      focus: settings.focus,
      aperture: settings.aperture,
      maxblur: settings.maxblur,
      width: size.width,
      height: size.height,
    })
    nextComposer.addPass(bokehPass)
    nextComposer.userData.bokehPass = bokehPass
    return nextComposer
  }, [camera, gl, scene, settings.aperture, settings.focus, settings.maxblur, size.height, size.width])

  useEffect(() => {
    composer.setSize(size.width, size.height)
  }, [composer, size.height, size.width])

  useFrame((_, delta) => {
    if (!enabled) return
    const bokehPass = composer.userData.bokehPass
    if (bokehPass?.uniforms) {
      bokehPass.uniforms.focus.value = settings.focus
      bokehPass.uniforms.aperture.value = settings.aperture
      bokehPass.uniforms.maxblur.value = settings.maxblur
    }
    composer.render(delta)
  }, enabled ? 1 : 0)

  return null
}
