import assert from 'node:assert/strict'
import { SPECIES, TANKS } from '../src/data/species.js'
import { LANDING_SCENERY } from '../src/data/landingScenery.js'
import { PIXEL_SPRITES, SPRITE_PALETTE } from '../src/data/pixelSprites.js'
import { reserveDepthRange } from '../src/utils/reserveDepth.js'

const speciesIds = new Set(SPECIES.map(species => species.id))

// Every sprite uses palette colours only (an unknown character renders magenta).
for (const [name, sprite] of Object.entries(PIXEL_SPRITES)) {
  assert.ok(sprite.width > 0 && sprite.height > 0, `${name} is empty`)
  const palette = new Set(Object.values(SPRITE_PALETTE))
  assert.ok(sprite.runs.every(([, , , colour]) => palette.has(colour)), `${name} uses a colour outside SPRITE_PALETTE`)
}

// The landing is curated by hand: every piece names a drawn sprite, a real species if it
// names one, and a position on screen.
for (const piece of LANDING_SCENERY) {
  assert.ok(PIXEL_SPRITES[piece.sprite], `landing: no sprite '${piece.sprite}'`)
  if (piece.species) assert.ok(speciesIds.has(piece.species), `landing: unknown species '${piece.species}'`)
  // A coming-soon piece is one not on any roster yet; once it is, it should say so.
  if (piece.comingSoon) {
    assert.ok(piece.futureSpecies && !piece.species, `landing: coming-soon ${piece.sprite} names its futureSpecies, not species`)
    assert.ok(!speciesIds.has(piece.futureSpecies), `landing: ${piece.futureSpecies} has arrived; drop comingSoon and make it species`)
  }
  assert.ok(piece.x >= 0 && piece.x <= 100, `landing: ${piece.sprite} x out of range`)
  if (!piece.seabed) assert.ok(piece.y >= 0 && piece.y <= 100, `landing: ${piece.sprite} y out of range`)
  assert.ok(piece.px > 0, `landing: ${piece.sprite} needs px`)
}

// A reserve's descent scenery sits inside its depth range, on a side, with drawn sprites;
// its signature species come from its own roster.
for (const tank of TANKS) {
  if (!tank.descent) continue
  const [top, bottom] = reserveDepthRange(tank)
  for (const item of [...(tank.descent.signature ?? []), ...(tank.descent.scenery ?? [])]) {
    assert.ok(PIXEL_SPRITES[item.sprite], `${tank.id}: no sprite '${item.sprite}'`)
    assert.ok(item.side === 'left' || item.side === 'right', `${tank.id}: ${item.sprite} needs side left or right`)
    assert.ok(item.depth === 'floor' || (item.depth >= top && item.depth <= bottom), `${tank.id}: ${item.sprite} depth ${item.depth} outside ${top}–${bottom} m`)
  }
  for (const item of tank.descent.signature ?? []) {
    assert.ok(tank.species.includes(item.species), `${tank.id}: signature '${item.sprite}' (${item.species}) is not on its roster`)
  }
}

console.log('scenery tests passed')
