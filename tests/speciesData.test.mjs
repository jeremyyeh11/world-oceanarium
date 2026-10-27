import assert from 'node:assert/strict'
import { SPECIES, TANKS } from '../src/data/species.js'
import { atlasWarmupUrls } from '../src/loading/atlasWarmup.js'
import { ENVIRONMENT_MANIFESTS } from '../src/loading/environmentManifest.js'
import { creaturesForTank, resolveSpecies } from '../src/utils/speciesLookup.js'

const speciesById = new Map(SPECIES.map(species => [species.id, species]))

// Prepared species must not create missing-GLB requests or invisible live residents.
// They become eligible for actual asset/pose verification when Jeremy supplies the GLBs.
for (const id of ['thunnus-albacares']) {
  const prepared = speciesById.get(id)
  assert.ok(prepared, `${id} canonical species exists`)
  assert.equal(prepared.hiddenInAtlas, true, `${id} waits for the real specimen and tile`)
  assert.equal(prepared.model, undefined, `${id} does not advertise a nonexistent model`)
  assert.deepEqual(atlasWarmupUrls([prepared]), [], `${id} causes no speculative asset requests`)
  assert.ok(ENVIRONMENT_MANIFESTS.every(manifest => manifest.assets.every(asset => !asset.url.includes(id))), `${id} cannot block reserve loading`)
  // Alias resolution is ready, but a future alive row cannot enter an existing reserve early.
  for (const alias of [id, prepared.name, prepared.scientificName]) {
    const creature = { id: `pending-${id}`, species: alias, alive: true, size: 0.6 }
    assert.equal(resolveSpecies(creature), prepared)
    for (const tank of TANKS) assert.deepEqual(creaturesForTank([creature], tank), [], `${id} is not stocked before intake`)
  }
  assert.equal(prepared.atlasDetails.maxLengthLabel, 'Fork length')
  assert.ok(Math.abs(prepared.swim.bodyLengthWU * 0.25 - prepared.maxBodyLengthMeters) < 1e-9, `${id} biological reference and world scale agree`)
  assert.ok(prepared.sizeRange[0] > 0 && prepared.sizeRange[1] <= 1)
}

const unicornfish = speciesById.get('naso-unicornis')
const tuna = speciesById.get('thunnus-albacares')
assert.ok(!unicornfish.hiddenInAtlas, 'supplied unicornfish is visible in Atlas')
assert.equal(unicornfish.model.path, '/models/fish/naso-unicornis/naso-unicornis.glb')
assert.ok(Math.abs(unicornfish.model.scale * 57.402793884277344 - unicornfish.swim.bodyLengthWU) < 1e-6, 'fork length, not tail-tip bounds, defines world scale')
assert.equal(unicornfish.atlasDetails.maxLengthLabel, 'Fork length')
assert.equal(unicornfish.model.proceduralAnimation.type, 'caudal-vertex')
assert.ok(atlasWarmupUrls([unicornfish]).includes(unicornfish.model.path))
for (const alias of [unicornfish.id, unicornfish.name, unicornfish.scientificName]) {
  const creature = { id: 'intake-unicornfish', species: alias, alive: true, size: 0.6 }
  assert.equal(resolveSpecies(creature), unicornfish)
  const matchingTanks = TANKS.filter(tank => creaturesForTank([creature], tank).length)
  assert.equal(matchingTanks.length, 1, 'unicornfish has exactly one reserve')
  assert.equal(matchingTanks[0].id, 'the-reefs', 'unicornfish belongs in The Reefs')
}
assert.equal(unicornfish.schooling, false, 'reef visits retain individual control')
assert.equal(unicornfish.group.maxSize, 6)
for (const form of ['table', 'thicket']) assert.equal(unicornfish.reef.corals[form].peck, 0, 'an algae browser must override inherited coral-biting shares')
assert.equal(tuna.schooling, true)
assert.equal(tuna.swim.driftEnabled, false, 'a ram-ventilating tuna must keep swimming')
assert.equal(tuna.reef, undefined, 'pelagic tuna must not inherit reef holds')
// Guard the length convention/units: unlike the FishBase TL relationship, these
// pooled relationships use fork cm and return grams. Proposed specimens are in range.
assert.ok(Math.abs(unicornfish.mass.coefficient * 42.2 ** unicornfish.mass.exponent / 1000 - 1.4) < 0.1)
assert.ok(Math.abs(tuna.mass.coefficient * 150 ** tuna.mass.exponent / 1000 - 63) < 1)

const sardinella = speciesById.get('amblygaster-sirm')
assert.ok(sardinella)
assert.equal(sardinella.family, 'Dorosomatidae')
assert.equal(sardinella.atlasDetails.maxLengthLabel, 'Standard length')
assert.equal(sardinella.maxBodyLengthMeters, 0.27)

const mahiMahi = speciesById.get('coryphaena-hippurus')
assert.ok(mahiMahi)
assert.equal(mahiMahi.atlasDetails.lifeSpan, 'Up to 4 years')
assert.equal(mahiMahi.atlasDetails.averages.maleLifeExpectancyYears, 4)
assert.equal(mahiMahi.atlasDetails.averages.femaleLifeExpectancyYears, 4)
assert.equal(mahiMahi.maxBodyLengthMeters, 2.1)
assert.equal(mahiMahi.adultLengthRangeMeters[1], 2.1)
assert.equal(mahiMahi.swim.bodyLengthWU, 8.4)
assert.equal(mahiMahi.model.scale, 0.858)

const shortfinMako = speciesById.get('isurus-oxyrinchus')
assert.ok(shortfinMako)
assert.equal(shortfinMako.maxBodyLengthMeters, 4.45)
assert.equal(shortfinMako.adultLengthRangeMeters[1], 4.45)
assert.equal(shortfinMako.swim.bodyLengthWU, 17.8)
assert.equal(shortfinMako.model.scale, 0.443)

const giantSunfish = speciesById.get('mola-alexandrini')
assert.ok(giantSunfish)
// No age study of this species: life expectancy is a FishLife estimate and must say so.
assert.equal(giantSunfish.atlasDetails.averages.maleLifeExpectancyYears, 'About 21 years (estimated)')
assert.equal(giantSunfish.atlasDetails.averages.femaleLifeExpectancyYears, 'About 21 years (estimated)')
assert.equal(giantSunfish.atlasDetails.lifecycle.offspringPerMatingEvent, 'Unknown')

// Remoras (v0.16.0). FishBase maxima, IUCN status, and the rendered size derived from them:
// bodyLengthWU is the maximum length at 1 WU = 25 cm, so a data edit that changes one
// without the other fails here rather than silently mis-sizing the fish.
const REMORAS = [
  ['echeneis-naucrates', 1.1, 'LC'],
  ['echeneis-neucratoides', 0.75, 'DD'],
  ['remora-remora', 0.864, 'LC'],
  ['remora-albescens', 0.3, 'LC'],
  ['remora-australis', 0.76, 'LC'],
  ['remora-brachyptera', 0.5, 'LC'],
  ['remora-osteochir', 0.4, 'LC'],
  ['phtheirichthys-lineatus', 0.76, 'LC'],
]
// Supplied remora GLBs and their source lengths (scripts/fit-rider-model.mjs prints them).
const SUPPLIED_REMORA_SOURCE_LENGTHS = {
  'echeneis-naucrates': 6.6014,
  'echeneis-neucratoides': 5.4912,
}
for (const [id, maxMeters, iucn] of REMORAS) {
  const remora = speciesById.get(id)
  assert.ok(remora, `${id} exists`)
  assert.equal(remora.family, 'Echeneidae', `${id} is an echeneid`)
  assert.equal(remora.maxBodyLengthMeters, maxMeters, `${id} maximum length`)
  assert.ok(Math.abs(remora.swim.bodyLengthWU - maxMeters / 0.25) < 1e-9, `${id} renders at its maximum length`)
  assert.equal(remora.conservationStatus.code, iucn, `${id} IUCN status`)
  // Stand-in model: unit-length source, so its scale must equal the body length. A supplied
  // model must keep the same size: source length × scale = body length. Both ride the caudal wave.
  const suppliedSourceLength = SUPPLIED_REMORA_SOURCE_LENGTHS[id]
  if (suppliedSourceLength) {
    assert.equal(remora.model.path, `/models/fish/${id}/${id}.glb`, `${id} uses its supplied model`)
    assert.ok(Math.abs(remora.model.scale * suppliedSourceLength - remora.swim.bodyLengthWU) < 0.001, `${id} supplied model renders at its body length`)
    assert.equal(remora.placeholder, undefined, `${id} no longer builds a stand-in`)
    assert.ok(!remora.hiddenInAtlas, `${id} is in the Atlas, now its model is in`)
    assert.equal(remora.model.proceduralAnimation.type, 'caudal-vertex', `${id} swims with the caudal wave`)
  } else {
    // Queued until its model lands (docs/fish-queue.md; the generated stand-ins went in
    // v0.37.0-dev_2): no model, out of the Atlas, on no tank.
    assert.equal(remora.model, undefined, `${id} has no model yet`)
    assert.equal(remora.hiddenInAtlas, true, `${id} is kept out of the Atlas until its model lands`)
    assert.ok(!TANKS.some(tank => tank.species?.includes(id)), `${id} is on no tank`)
  }
  // The disc sits on the head, where the ride system expects it.
  assert.ok(remora.hitchhiker.discAheadBodyLengths > 0 && remora.hitchhiker.discAheadBodyLengths < 0.5, `${id} disc sits on the head`)
}
// Standard-length maxima are labelled as such, like the sardinella's.
assert.equal(speciesById.get('remora-albescens').atlasDetails.maxLengthLabel, 'Standard length')
assert.equal(speciesById.get('remora-osteochir').atlasDetails.maxLengthLabel, 'Standard length')

console.log('species data correction tests passed')
