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

console.log('species data correction tests passed')
