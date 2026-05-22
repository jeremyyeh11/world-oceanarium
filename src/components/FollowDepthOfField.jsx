import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { BokehDepthShader, BokehShader } from 'three/examples/jsm/shaders/BokehShader2.js'

const DOF_PIXEL_RATIO_CAP = 1.25
const DOF_RINGS = 2
const DOF_SAMPLES = 3
const DOF_FSTOP = 9.5
const DOF_MAX_BLUR = 0.35
const DOF_FOCAL_LENGTH = 35
const DOF_FOCUS_DAMPING = 8
const targetPosition = new THREE.Vector3()
const targetCameraPosition = new THREE.Vector3()
const targetBounds = new THREE.Box3()

function getFollowFocalDepth(camera, focusTarget) {
  targetBounds.setFromObject(focusTarget)
  if (!targetBounds.isEmpty()) {
    targetBounds.getCenter(targetPosition)
  } else {
    focusTarget.getWorldPosition(targetPosition)
  }

  targetCameraPosition.copy(targetPosition)
  camera.worldToLocal(targetCameraPosition)
  return Math.max(camera.near, Math.min(camera.far, -targetCameraPosition.z))
}

export default function FollowDepthOfField({ focusTarget = null }) {
  const { gl, scene, camera, size } = useThree()
  const postRef = useRef(null)
  const focusDepthRef = useRef(null)

  useEffect(() => {
    const pixelRatio = Math.min(gl.getPixelRatio(), DOF_PIXEL_RATIO_CAP)
    const width = Math.max(1, Math.floor(size.width * pixelRatio))
    const height = Math.max(1, Math.floor(size.height * pixelRatio))

    const colorTarget = new THREE.WebGLRenderTarget(width, height, { type: THREE.HalfFloatType })
    colorTarget.texture.name = 'FollowDepthOfField.color'
    const depthTarget = new THREE.WebGLRenderTarget(width, height, { type: THREE.HalfFloatType })
    depthTarget.texture.name = 'FollowDepthOfField.depth'

    const depthShader = BokehDepthShader
    const depthMaterial = new THREE.ShaderMaterial({
      uniforms: THREE.UniformsUtils.clone(depthShader.uniforms),
      vertexShader: depthShader.vertexShader,
      fragmentShader: depthShader.fragmentShader,
    })
    depthMaterial.uniforms.mNear.value = camera.near
    depthMaterial.uniforms.mFar.value = camera.far

    const bokehUniforms = THREE.UniformsUtils.clone(BokehShader.uniforms)
    bokehUniforms.tColor.value = colorTarget.texture
    bokehUniforms.tDepth.value = depthTarget.texture
    bokehUniforms.textureWidth.value = width
    bokehUniforms.textureHeight.value = height
    bokehUniforms.znear.value = camera.near
    bokehUniforms.zfar.value = camera.far
    bokehUniforms.focalLength.value = DOF_FOCAL_LENGTH
    bokehUniforms.fstop.value = DOF_FSTOP
    bokehUniforms.maxblur.value = DOF_MAX_BLUR
    bokehUniforms.showFocus.value = false
    bokehUniforms.manualdof.value = false
    bokehUniforms.vignetting.value = false
    bokehUniforms.depthblur.value = false
    bokehUniforms.threshold.value = 0.8
    bokehUniforms.gain.value = 0
    bokehUniforms.bias.value = 0.5
    bokehUniforms.fringe.value = 0
    bokehUniforms.noise.value = true
    bokehUniforms.dithering.value = 0.0001
    bokehUniforms.pentagon.value = false
    bokehUniforms.shaderFocus.value = false
    bokehUniforms.focusCoords.value.set(0.5, 0.5)

    const bokehMaterial = new THREE.ShaderMaterial({
      uniforms: bokehUniforms,
      vertexShader: BokehShader.vertexShader,
      fragmentShader: BokehShader.fragmentShader,
      defines: {
        RINGS: DOF_RINGS,
        SAMPLES: DOF_SAMPLES,
      },
    })

    const postScene = new THREE.Scene()
    const postCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), bokehMaterial)
    postScene.add(quad)

    postRef.current = {
      bokehUniforms,
      colorTarget,
      depthMaterial,
      depthTarget,
      postCamera,
      postScene,
      previousAutoClear: gl.autoClear,
    }
    gl.domElement.dataset.followDof = 'dof2'

    return () => {
      delete gl.domElement.dataset.followDof
      gl.autoClear = postRef.current?.previousAutoClear ?? gl.autoClear
      postRef.current = null
      colorTarget.dispose()
      depthTarget.dispose()
      depthMaterial.dispose()
      bokehMaterial.dispose()
      quad.geometry.dispose()
    }
  }, [camera, gl, scene, size.height, size.width])

  useFrame((_, delta) => {
    const post = postRef.current
    if (!post || !focusTarget) return

    const targetDepth = getFollowFocalDepth(camera, focusTarget)
    focusDepthRef.current = focusDepthRef.current == null
      ? targetDepth
      : THREE.MathUtils.damp(focusDepthRef.current, targetDepth, DOF_FOCUS_DAMPING, delta)
    post.bokehUniforms.focalDepth.value = focusDepthRef.current
    post.bokehUniforms.znear.value = camera.near
    post.bokehUniforms.zfar.value = camera.far
    post.depthMaterial.uniforms.mNear.value = camera.near
    post.depthMaterial.uniforms.mFar.value = camera.far

    gl.autoClear = false
    gl.clear()

    gl.setRenderTarget(post.colorTarget)
    gl.clear()
    gl.render(scene, camera)

    const previousOverrideMaterial = scene.overrideMaterial
    scene.overrideMaterial = post.depthMaterial
    gl.setRenderTarget(post.depthTarget)
    gl.clear()
    gl.render(scene, camera)
    scene.overrideMaterial = previousOverrideMaterial

    gl.setRenderTarget(null)
    gl.render(post.postScene, post.postCamera)
  }, 1)

  return null
}
