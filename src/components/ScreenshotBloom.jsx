import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js'

const BLOOM_PIXEL_RATIO_CAP = 1.5
const BLOOM_STRENGTH = 0.28
const BLOOM_RADIUS = 0.58
const BLOOM_THRESHOLD = 0.72

export default function ScreenshotBloom() {
  const { gl, scene, camera, size } = useThree()
  const composerRef = useRef(null)

  useEffect(() => {
    const pixelRatio = Math.min(gl.getPixelRatio(), BLOOM_PIXEL_RATIO_CAP)
    const composer = new EffectComposer(gl)
    composer.setPixelRatio(pixelRatio)
    composer.setSize(size.width, size.height)

    const renderPass = new RenderPass(scene, camera)
    const bloomPass = new UnrealBloomPass(
      new THREE.Vector2(size.width * pixelRatio, size.height * pixelRatio),
      BLOOM_STRENGTH,
      BLOOM_RADIUS,
      BLOOM_THRESHOLD,
    )
    const outputPass = new OutputPass()

    composer.addPass(renderPass)
    composer.addPass(bloomPass)
    composer.addPass(outputPass)
    composerRef.current = composer

    gl.domElement.dataset.screenshotBloom = 'unreal'
    gl.domElement.dataset.screenshotBloomStrength = `${BLOOM_STRENGTH}`
    gl.domElement.dataset.screenshotBloomRadius = `${BLOOM_RADIUS}`
    gl.domElement.dataset.screenshotBloomThreshold = `${BLOOM_THRESHOLD}`

    return () => {
      delete gl.domElement.dataset.screenshotBloom
      delete gl.domElement.dataset.screenshotBloomStrength
      delete gl.domElement.dataset.screenshotBloomRadius
      delete gl.domElement.dataset.screenshotBloomThreshold
      composerRef.current = null
      composer.dispose()
      bloomPass.dispose()
      renderPass.dispose?.()
      outputPass.dispose?.()
    }
  }, [camera, gl, scene, size.height, size.width])

  useFrame((_, delta) => {
    composerRef.current?.render(delta)
  }, 1)

  return null
}
