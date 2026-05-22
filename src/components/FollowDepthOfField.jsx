import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { BokehPass } from 'three/examples/jsm/postprocessing/BokehPass.js'
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js'

const DOF_APERTURE = 0.00009
const DOF_MAX_BLUR = 0.0035
const DOF_PIXEL_RATIO_CAP = 1.35
const targetPosition = new THREE.Vector3()
const targetBounds = new THREE.Box3()

export default function FollowDepthOfField({ focusTarget = null }) {
  const { gl, scene, camera, size } = useThree()
  const composerRef = useRef(null)
  const bokehPassRef = useRef(null)

  useEffect(() => {
    const composer = new EffectComposer(gl)
    composer.setPixelRatio(Math.min(gl.getPixelRatio(), DOF_PIXEL_RATIO_CAP))
    composer.setSize(size.width, size.height)

    const renderPass = new RenderPass(scene, camera)
    const bokehPass = new BokehPass(scene, camera, {
      focus: 3.2,
      aperture: DOF_APERTURE,
      maxblur: DOF_MAX_BLUR,
    })

    composer.addPass(renderPass)
    composer.addPass(bokehPass)
    composer.addPass(new OutputPass())
    composerRef.current = composer
    bokehPassRef.current = bokehPass
    gl.domElement.dataset.followDof = 'active'

    return () => {
      delete gl.domElement.dataset.followDof
      bokehPass.dispose()
      composer.dispose()
      composerRef.current = null
      bokehPassRef.current = null
    }
  }, [camera, gl, scene, size.height, size.width])

  useFrame((_, delta) => {
    const composer = composerRef.current
    const bokehPass = bokehPassRef.current
    if (!composer || !bokehPass || !focusTarget) return

    targetBounds.setFromObject(focusTarget)
    if (!targetBounds.isEmpty()) {
      targetBounds.getCenter(targetPosition)
    } else {
      focusTarget.getWorldPosition(targetPosition)
    }

    bokehPass.uniforms.focus.value = camera.position.distanceTo(targetPosition)
    composer.render(delta)
  }, 1)

  return null
}
