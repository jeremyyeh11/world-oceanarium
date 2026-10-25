import { useEffect, useRef } from 'react'
import { addEffect, addAfterEffect, useFrame, useThree } from '@react-three/fiber'
import { createFrameMeter, createGpuTimer } from '../utils/frameProfiler'

export default function PerformanceDiagnostics({ onSample }) {
  const gl = useThree(state => state.gl)
  const meter = useRef(null)
  useFrame(() => meter.current?.markRendered(), -100000)
  useEffect(() => {
    const frame = createFrameMeter()
    meter.current = frame
    const gpu = createGpuTimer(gl.getContext())
    const autoReset = gl.info.autoReset
    // Aggregate all renderer passes in the canvas frame, including transmission/reflections.
    gl.info.autoReset = false
    let nextQuery = 0
    const before = addEffect(() => {
      frame.begin()
      gl.info.reset()
      gpu.poll()
      if (performance.now() >= nextQuery) { gpu.begin(); nextQuery = performance.now() + 500 }
    })
    const after = addAfterEffect(() => {
      gpu.end()
      const sample = frame.end()
      if (!sample) return
      onSample({ ...sample, gpuMs: gpu.poll(),
        heapMB: Number.isFinite(performance.memory?.usedJSHeapSize) ? performance.memory.usedJSHeapSize / 1048576 : null,
        calls: gl.info.render.calls, triangles: gl.info.render.triangles,
        geometries: gl.info.memory.geometries, textures: gl.info.memory.textures, dpr: gl.getPixelRatio(),
      })
    })
    return () => {
      before(); after(); gpu.dispose(); meter.current = null
      gl.info.autoReset = autoReset
      onSample(null)
    }
  }, [gl, onSample])
  return null
}
