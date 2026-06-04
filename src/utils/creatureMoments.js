export function creatureRepulsesOthers(species) {
  return species?.repulser === true
}

export function repulserInfluenceAtDistance(distance, innerRadius, outerRadius) {
  if (!Number.isFinite(distance) || !Number.isFinite(innerRadius) || !Number.isFinite(outerRadius)) return 0
  if (outerRadius <= innerRadius) return distance < outerRadius ? 1 : 0
  if (distance <= innerRadius) return 1
  if (distance >= outerRadius) return 0
  const t = 1 - ((distance - innerRadius) / (outerRadius - innerRadius))
  return t * t * (3 - 2 * t)
}

function finiteNumber(value, fallback = 0) {
  return Number.isFinite(value) ? value : fallback
}

export function resolveRepulserDriftVector(position, entries, options = {}) {
  const selfId = options.selfId ?? null
  const biome = options.biome ?? null
  const innerRadius = finiteNumber(options.innerRadius, 6)
  const outerRadius = finiteNumber(options.outerRadius, 16)
  const maxDrift = finiteNumber(options.maxDrift, 1.8)
  const currentX = finiteNumber(position?.x)
  const currentY = finiteNumber(position?.y)
  const currentZ = finiteNumber(position?.z)
  const out = { x: 0, y: 0, z: 0 }

  for (const entry of entries ?? []) {
    if (!entry?.repulser) continue
    if (entry.id === selfId) continue
    if (biome && entry.biome && entry.biome !== biome) continue

    const dx = currentX - finiteNumber(entry.position?.x)
    const dy = (currentY - finiteNumber(entry.position?.y)) * 0.18
    const dz = currentZ - finiteNumber(entry.position?.z)
    const distance = Math.hypot(dx, dy, dz)
    const effectiveOuter = Math.max(outerRadius, finiteNumber(entry.bodyLength) * 1.65)
    const effectiveInner = Math.max(innerRadius, finiteNumber(entry.bodyLength) * 0.62)
    const influence = repulserInfluenceAtDistance(distance, effectiveInner, effectiveOuter)
    if (influence <= 0) continue

    if (distance < 0.0001) {
      out.x += maxDrift * influence
    } else {
      out.x += (dx / distance) * maxDrift * influence
      out.z += (dz / distance) * maxDrift * influence
    }
  }

  const length = Math.hypot(out.x, out.z)
  if (length > maxDrift && length > 0.0001) {
    out.x = (out.x / length) * maxDrift
    out.z = (out.z / length) * maxDrift
  }
  out.y = 0
  return out
}

export function lerpRepulserDrift(current, target, delta, response = 2.8) {
  const alpha = 1 - Math.exp(-Math.max(0, finiteNumber(delta)) * Math.max(0, finiteNumber(response)))
  return {
    x: finiteNumber(current?.x) + (finiteNumber(target?.x) - finiteNumber(current?.x)) * alpha,
    y: finiteNumber(current?.y) + (finiteNumber(target?.y) - finiteNumber(current?.y)) * alpha,
    z: finiteNumber(current?.z) + (finiteNumber(target?.z) - finiteNumber(current?.z)) * alpha,
  }
}

export function repulserDebugIntensity(drift, maxDrift) {
  const maxLength = Math.max(0.0001, finiteNumber(maxDrift, 1))
  const length = Math.hypot(finiteNumber(drift?.x), finiteNumber(drift?.y), finiteNumber(drift?.z))
  return Math.min(1, Math.max(0, length / maxLength))
}
