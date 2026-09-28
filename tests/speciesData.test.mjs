import assert from 'node:assert/strict'
import { SPECIES } from '../src/data/species.js'

const speciesById = new Map(SPECIES.map(species => [species.id, species]))

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
assert.equal(giantSunfish.atlasDetails.averages.maleLifeExpectancyYears, 'Unknown')
assert.equal(giantSunfish.atlasDetails.averages.femaleLifeExpectancyYears, 'Unknown')
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
const SUPPLIED_REMORA_SOURCE_LENGTHS = { 'echeneis-naucrates': 6.6014 }
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
  } else {
    assert.equal(remora.model.path, `/models/fish/${id}/${id}_placeholder.glb`, `${id} uses its generated stand-in`)
    assert.equal(remora.model.scale, remora.swim.bodyLengthWU, `${id} stand-in renders at its body length`)
    // Jeremy's review, 2026-09-28: remoras without their model stay out of the Atlas.
    assert.equal(remora.hiddenInAtlas, true, `${id} is kept out of the Atlas until its model lands`)
  }
  assert.equal(remora.model.proceduralAnimation.type, 'caudal-vertex', `${id} swims with the caudal wave`)
  // The stand-in's disc is built where the ride system expects it.
  assert.ok(remora.hitchhiker.discAheadBodyLengths > 0 && remora.hitchhiker.discAheadBodyLengths < 0.5, `${id} disc sits on the head`)
}
// Standard-length maxima are labelled as such, like the sardinella's.
assert.equal(speciesById.get('remora-albescens').atlasDetails.maxLengthLabel, 'Standard length')
assert.equal(speciesById.get('remora-osteochir').atlasDetails.maxLengthLabel, 'Standard length')

console.log('species data correction tests passed')
