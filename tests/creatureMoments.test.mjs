import assert from 'node:assert/strict'
import { SPECIES } from '../src/data/species.js'
import {
  creatureRepulsesOthers,
  repulserInfluenceAtDistance,
  lerpRepulserDrift,
  repulserDebugIntensity,
  resolveRepulserDriftVector,
} from '../src/utils/creatureMoments.js'

const speciesById = new Map(SPECIES.map(species => [species.id, species]))

assert.equal(creatureRepulsesOthers(speciesById.get('amblygaster-sirm')), false, 'sardines default to non-repulsers')
assert.equal(creatureRepulsesOthers(speciesById.get('mola-alexandrini')), true, 'Mola is tagged as a repulser')
assert.equal(creatureRepulsesOthers({}), false, 'missing repulser flag defaults false')

assert.equal(repulserInfluenceAtDistance(0, 6, 16), 1, 'inside inner radius uses full drift')
assert.equal(repulserInfluenceAtDistance(16, 6, 16), 0, 'outside outer radius has no drift')
assert.ok(repulserInfluenceAtDistance(11, 6, 16) > 0, 'falloff remains active between inner and outer radii')
assert.ok(repulserInfluenceAtDistance(11, 6, 16) < 1, 'falloff softens between inner and outer radii')

const drift = resolveRepulserDriftVector(
  { x: 1, y: 0, z: 0 },
  [
    { id: 'mola', repulser: true, biome: 'ocean', position: { x: 0, y: 0, z: 0 }, bodyLength: 9.6 },
    { id: 'sardine', repulser: false, biome: 'ocean', position: { x: 0.5, y: 0, z: 0 }, bodyLength: 1 },
  ],
  { selfId: 'sardine-1', biome: 'ocean', innerRadius: 6, outerRadius: 16, maxDrift: 1.8 },
)
assert.ok(drift.x > 0.8, 'school drift moves away from repulser')
assert.equal(drift.y, 0, 'school drift stays horizontal')

const initial = { x: 0, y: 0, z: 0 }
const target = { x: 1.8, y: 0, z: 0 }
const eased = lerpRepulserDrift(initial, target, 0.1, 4)
assert.ok(eased.x > 0, 'repulser drift begins moving toward target')
assert.ok(eased.x < target.x, 'repulser drift is lerped, not snapped')

assert.equal(repulserDebugIntensity({ x: 0, y: 0, z: 0 }, 2.2), 0, 'no repulser drift keeps marker yellow')
assert.ok(repulserDebugIntensity({ x: 1.1, y: 0, z: 0 }, 2.2) > 0.45, 'partial repulser drift warms marker toward red')
assert.equal(repulserDebugIntensity({ x: 2.2, y: 0, z: 0 }, 2.2), 1, 'max repulser drift makes marker red')


console.log('creature moments tests passed')
