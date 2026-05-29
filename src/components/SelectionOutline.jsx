import { useEffect, useMemo } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { OutlinePass } from 'three/examples/jsm/postprocessing/OutlinePass.js'
import { getSelectionOutlineTargets } from './selectionOutlineRegistry'

const OUTLINE_COLOR = new THREE.Color('#aaf0ff')
const HIDDEN_OUTLINE_COLOR = new THREE.Color('#102f3a')

export default function SelectionOutline({ enabled = true }) {
  const { gl, scene, camera, size } = useThree()

  const composer = useMemo(() => {
    const nextComposer = new EffectComposer(gl)
    nextComposer.addPass(new RenderPass(scene, camera))

    const outlinePass = new OutlinePass(new THREE.Vector2(size.width, size.height), scene, camera)
    outlinePass.edgeStrength = 2.6
    outlinePass.edgeThickness = 1.15
    outlinePass.edgeGlow = 0
    outlinePass.pulsePeriod = 0
    outlinePass.visibleEdgeColor.copy(OUTLINE_COLOR)
    outlinePass.hiddenEdgeColor.copy(HIDDEN_OUTLINE_COLOR)
    nextComposer.addPass(outlinePass)
    nextComposer.outlinePass = outlinePass

    return nextComposer
  }, [gl, scene, camera])

  useEffect(() => {
    composer.setSize(size.width, size.height)
    composer.setPixelRatio(gl.getPixelRatio())
    composer.outlinePass?.setSize(size.width, size.height)
  }, [composer, gl, size.width, size.height])

  useFrame(() => {
    if (!enabled) return
    const outlinePass = composer.outlinePass
    if (outlinePass) outlinePass.selectedObjects = getSelectionOutlineTargets()
    composer.render()
  }, 1)

  return null
}
