import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { SPECIES, TANKS } from '../src/data/species.js'
import { PIXEL_SPRITES, SPRITE_PALETTE } from '../src/data/pixelSprites.js'
import { GENERAL_DESCENT } from '../src/data/descentScenery.js'
import { reserveDepthRange } from '../src/utils/reserveDepth.js'

const speciesIds = new Set(SPECIES.map(species => species.id))

// Every sprite uses palette colours only (an unknown character renders magenta).
for (const [name, sprite] of Object.entries(PIXEL_SPRITES)) {
  assert.ok(sprite.width > 0 && sprite.height > 0, `${name} is empty`)
  const palette = new Set(Object.values(SPRITE_PALETTE))
  assert.ok(sprite.runs.every(([, , , colour]) => palette.has(colour)), `${name} uses a colour outside SPRITE_PALETTE`)
}

// A descent's pieces sit inside its depth range, on a side, with drawn sprites, and name
// real species.
function checkDescent(label, owner) {
  const [top, bottom] = reserveDepthRange(owner)
  for (const item of [...(owner.descent.signature ?? []), ...(owner.descent.scenery ?? [])]) {
    assert.ok(PIXEL_SPRITES[item.sprite], `${label}: no sprite '${item.sprite}'`)
    assert.ok(item.side === 'left' || item.side === 'right', `${label}: ${item.sprite} needs side left or right`)
    assert.ok(item.depth === 'floor' || (item.depth >= top && item.depth <= bottom), `${label}: ${item.sprite} depth ${item.depth} outside ${top}–${bottom} m`)
    if (item.distance !== undefined) assert.ok(item.distance >= 0 && item.distance <= 1, `${label}: ${item.sprite} distance must be 0–1`)
  }
  for (const item of owner.descent.signature ?? []) {
    assert.ok(speciesIds.has(item.species), `${label}: signature '${item.sprite}' names unknown species '${item.species}'`)
  }
}

// A reserve's signature species come from its own roster.
for (const tank of TANKS) {
  if (!tank.descent) continue
  checkDescent(tank.id, tank)
  for (const item of tank.descent.signature ?? []) {
    assert.ok(tank.species.includes(item.species), `${tank.id}: signature '${item.sprite}' (${item.species}) is not on its roster`)
  }
}

// The landing dive's montage may mix every reserve, but only species some reserve has.
checkDescent('landing dive', GENERAL_DESCENT)
const rostered = new Set(TANKS.flatMap(tank => tank.species))
for (const item of GENERAL_DESCENT.descent.signature) {
  assert.ok(rostered.has(item.species), `landing dive: ${item.species} is in no reserve`)
}

// Every reserve has a selector preview still, and the file is there.
for (const tank of TANKS) {
  assert.ok(tank.cardImage, `${tank.id}: no cardImage`)
  assert.ok(existsSync(new URL(`../public${tank.cardImage}`, import.meta.url)), `${tank.id}: ${tank.cardImage} is not in public/`)
}

console.log('scenery tests passed')
