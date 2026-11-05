import * as THREE from 'three'
import { sandHeight, seededRandom } from '../data/landscapes.js'

// Scenery only: thin ribbon leaves, not a stocked species or a solid fish obstacle.
// Each chunk shares one segmented plane and one material. Only the sway clock changes per frame.
const SEGMENTS = 6
const NOISE_SIZE = 64
const PALETTE = ['#657b2d', '#778b35', '#526b28', '#879342', '#6b8238']

function noiseTexture(seed) {
  const random = seededRandom(seed)
  const cells = 8
  const grid = Float32Array.from({ length: cells * cells * 2 }, () => random())
  const data = new Uint8Array(NOISE_SIZE * NOISE_SIZE * 4)
  const sample = (x, y, channel) => grid[(((y + cells) % cells) * cells + (x + cells) % cells) * 2 + channel]
  for (let y = 0; y < NOISE_SIZE; y++) {
    for (let x = 0; x < NOISE_SIZE; x++) {
      const gx = x / NOISE_SIZE * cells
      const gy = y / NOISE_SIZE * cells
      const ix = Math.floor(gx)
      const iy = Math.floor(gy)
      const tx = THREE.MathUtils.smoothstep(gx - ix, 0, 1)
      const ty = THREE.MathUtils.smoothstep(gy - iy, 0, 1)
      const offset = (y * NOISE_SIZE + x) * 4
      for (let channel = 0; channel < 2; channel++) {
        const a = THREE.MathUtils.lerp(sample(ix, iy, channel), sample(ix + 1, iy, channel), tx)
        const b = THREE.MathUtils.lerp(sample(ix, iy + 1, channel), sample(ix + 1, iy + 1, channel), tx)
        data[offset + channel] = Math.round(255 * THREE.MathUtils.lerp(a, b, ty))
      }
      data[offset + 2] = 128
      data[offset + 3] = 255
    }
  }
  const texture = new THREE.DataTexture(data, NOISE_SIZE, NOISE_SIZE, THREE.RGBAFormat)
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping
  texture.minFilter = texture.magFilter = THREE.LinearFilter
  texture.needsUpdate = true
  return texture
}

function leafGeometry() {
  const geometry = new THREE.PlaneGeometry(1, 1, 1, SEGMENTS)
  geometry.translate(0, 0.5, 0)
  const position = geometry.attributes.position
  const colors = new Float32Array(position.count * 3)
  for (let i = 0; i < position.count; i++) {
    const height = position.getY(i)
    // Broad ribbon with a rounded taper, instead of a triangular lawn-grass blade.
    position.setX(i, position.getX(i) * (1 - height ** 3 * 0.97))
    const shade = 0.48 + Math.sin(height * Math.PI * 0.65) * 0.7
    colors.set([shade, shade, shade], i * 3)
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  return geometry
}

function grassMaterial(config, texture, time) {
  const material = new THREE.MeshStandardMaterial({
    vertexColors: true, side: THREE.DoubleSide, roughness: 0.95,
    metalness: 0, envMapIntensity: 0.3, emissive: '#34451b', emissiveIntensity: 0.16,
  })
  const current = new THREE.Vector2(...config.current).normalize()
  material.onBeforeCompile = shader => {
    shader.uniforms.uGrassNoise = { value: texture }
    shader.uniforms.uGrassTime = time
    shader.uniforms.uGrassCurrent = { value: current }
    shader.uniforms.uGrassBend = { value: config.bend }
    shader.uniforms.uGrassSpeed = { value: config.speed }
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>
        uniform sampler2D uGrassNoise;
        uniform float uGrassTime;
        uniform vec2 uGrassCurrent;
        uniform float uGrassBend;
        uniform float uGrassSpeed;`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        #ifdef USE_INSTANCING
          vec3 grassRoot = (modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
          float grassHeight = length(instanceMatrix[1].xyz);
          float grassFlex = position.y * position.y;
          vec2 grassUv = grassRoot.xz / 22.0 - uGrassCurrent * uGrassTime * uGrassSpeed;
          vec2 grassNoise = texture2D(uGrassNoise, grassUv).rg * 2.0 - 1.0;
          float grassRipple = sin(uGrassTime * 1.65 + dot(grassRoot.xz, vec2(0.47, 0.31)) - position.y * 3.0);
          vec2 grassFlow = uGrassCurrent * (0.28 + grassNoise.r)
            + vec2(-uGrassCurrent.y, uGrassCurrent.x) * grassNoise.g * 0.35;
          grassFlow += uGrassCurrent * grassRipple * position.y * 0.12;
          vec3 grassOffset = vec3(grassFlow.x, 0.0, grassFlow.y) * grassHeight * uGrassBend * grassFlex;
          // Return the world-current offset to this leaf's rotated/scaled local basis.
          transformed.x += dot(grassOffset, instanceMatrix[0].xyz) / dot(instanceMatrix[0].xyz, instanceMatrix[0].xyz);
          transformed.z += dot(grassOffset, instanceMatrix[2].xyz) / dot(instanceMatrix[2].xyz, instanceMatrix[2].xyz);
          transformed.y -= length(grassFlow) * uGrassBend * grassFlex * position.y * 0.12;
        #endif`)
  }
  material.customProgramCacheKey = () => 'seagrass-noise-v1'
  return material
}

function clearOfRocks(x, z, pieces) {
  for (const rock of pieces) {
    const dx = x - rock.x
    const dz = z - rock.z
    const cos = Math.cos(rock.yaw)
    const sin = Math.sin(rock.yaw)
    const localX = dx * cos - dz * sin
    const localZ = dx * sin + dz * cos
    if (Math.abs(localX) < rock.width * 0.5 + 0.5 && Math.abs(localZ) < rock.depth * 0.5 + 0.5) return false
  }
  return true
}

export function createSeagrass(landscape, rocks, time) {
  const config = landscape.seagrass
  const random = seededRandom(config.seed)
  const chunks = new Map()
  const geometry = leafGeometry()
  const texture = noiseTexture(config.seed + 1)
  const material = grassMaterial(config, texture, time)
  const dummy = new THREE.Object3D()
  const color = new THREE.Color()
  const occupied = new Set()
  for (const [cx, cz, radiusX, radiusZ] of config.patches) {
    for (let gz = cz - radiusZ; gz < cz + radiusZ; gz += config.spacing) {
      for (let gx = cx - radiusX; gx < cx + radiusX; gx += config.spacing) {
        const x = gx + (random() - 0.5) * config.spacing
        const z = gz + (random() - 0.5) * config.spacing
        const radius = Math.hypot((x - cx) / radiusX, (z - cz) / radiusZ)
        const mottling = 0.62 + Math.sin(x * 0.53 + z * 0.21) * Math.sin(z * 0.47 - x * 0.13) * 0.3
        if (random() > (1 - THREE.MathUtils.smoothstep(radius, 0.45, 1)) * mottling) continue
        const cell = `${Math.round(x / config.spacing)}:${Math.round(z / config.spacing)}`
        if (occupied.has(cell) || !clearOfRocks(x, z, rocks)) continue
        occupied.add(cell)
        const key = `${Math.floor(x / config.chunkSize)}:${Math.floor(z / config.chunkSize)}`
        if (!chunks.has(key)) chunks.set(key, [])
        const leaves = chunks.get(key)
        const shootHeight = THREE.MathUtils.lerp(...config.height, random())
        const count = 4 + Math.floor(random() * 4)
        for (let leaf = 0; leaf < count; leaf++) {
          const lx = x + (random() - 0.5) * 0.28
          const lz = z + (random() - 0.5) * 0.28
          leaves.push({
            x: lx, y: sandHeight(landscape, lx, lz) - 0.18, z: lz,
            height: shootHeight * (0.6 + random() * 0.4),
            width: THREE.MathUtils.lerp(...config.width, random()),
            yaw: random() * Math.PI * 2,
            color: PALETTE[Math.floor(random() * PALETTE.length)],
          })
        }
      }
    }
  }
  const meshes = []
  for (const [key, leaves] of chunks) {
    const mesh = new THREE.InstancedMesh(geometry, material, leaves.length)
    mesh.name = `seagrass:${key}`
    for (let i = 0; i < leaves.length; i++) {
      const leaf = leaves[i]
      dummy.position.set(leaf.x, leaf.y, leaf.z)
      dummy.rotation.set(0, leaf.yaw, 0)
      dummy.scale.set(leaf.width, leaf.height, 1)
      dummy.updateMatrix()
      mesh.setMatrixAt(i, dummy.matrix)
      mesh.setColorAt(i, color.set(leaf.color))
    }
    mesh.instanceMatrix.needsUpdate = true
    mesh.instanceColor.needsUpdate = true
    mesh.computeBoundingSphere()
    // Vertex displacement is invisible to Three's culling: include the furthest tip swing.
    mesh.boundingSphere.radius += config.height[1] * config.bend * 1.8
    // Leaves are soft decoration; keep picking/follow selection on the animals behind them.
    mesh.raycast = () => {}
    meshes.push(mesh)
  }
  return {
    meshes,
    dispose() {
      for (const mesh of meshes) mesh.dispose()
      geometry.dispose()
      material.dispose()
      texture.dispose()
    },
  }
}
