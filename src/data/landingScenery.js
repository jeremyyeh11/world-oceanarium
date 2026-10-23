// The landing's standee scenery: pixel cut-outs (src/data/pixelSprites.js) around the
// Dive in card, the same style as each reserve's descent. Curated by hand, not generated
// from the roster: add a piece here when a new creature or reserve earns a place on the
// front page, and draw its sprite first.
//
// Each piece: { sprite, species?, comingSoon?, x, y, px, flip?, seabed?, phone? }
//   x, y      position as % of the screen (left and top edges of the sprite); for a
//             `seabed` piece, y is ignored and it stands on the bottom edge
//   px        size of one sprite cell in CSS px on desktop
//   phone     { x, y, px } overrides at phone widths, or false to leave it out there
//             (the card covers the middle of a phone screen, so keep pieces to the edges)
//   species   the species id it depicts, for reference when the roster changes
//   comingSoon a creature not in any reserve yet, drawn dark and greyed out as a hint
//             of what is on the way; `futureSpecies` names it. When it joins a roster,
//             drop `comingSoon`, rename `futureSpecies` to `species`.
//
// Static: pieces never travel or scroll; swimming species bob a pixel in place.
export const LANDING_SCENERY = [
  // Open water, top: the whale shark above the card, the sunfish off to the right.
  { sprite: 'whale-shark', species: 'rhincodon-typus', x: 5, y: 11, px: 4, phone: { x: 4, y: 5, px: 2 } },
  { sprite: 'sunfish', species: 'mola-alexandrini', x: 81, y: 20, px: 4, phone: { x: 76, y: 9, px: 2 } },

  // A small school of raccoon butterflyfish, lower left, heading for the card.
  { sprite: 'raccoon-butterflyfish', species: 'chaetodon-lunula', x: 9, y: 55, px: 3, flip: true, phone: { x: 7, y: 80, px: 2 } },
  { sprite: 'raccoon-butterflyfish', species: 'chaetodon-lunula', x: 14, y: 51, px: 3, flip: true, phone: { x: 15, y: 78, px: 2 } },
  { sprite: 'raccoon-butterflyfish', species: 'chaetodon-lunula', x: 13, y: 59, px: 3, flip: true, phone: { x: 13, y: 83, px: 2 } },
  { sprite: 'raccoon-butterflyfish', species: 'chaetodon-lunula', x: 19, y: 55, px: 3, flip: true, phone: false },
  { sprite: 'raccoon-butterflyfish', species: 'chaetodon-lunula', x: 18, y: 62, px: 3, flip: true, phone: false },

  // Coming soon: the reef manta and the spotted eagle ray, greyed out off the card's right.
  { sprite: 'manta-ray', futureSpecies: 'mobula-alfredi', comingSoon: true, x: 70, y: 60, px: 3, phone: { x: 58, y: 77, px: 2 } },
  { sprite: 'eagle-ray', futureSpecies: 'aetobatus-narinari', comingSoon: true, x: 86, y: 47, px: 3, phone: false },

  // The reef along the bottom edge.
  { sprite: 'table-coral', species: 'acropora-hyacinthus', seabed: true, x: 3, px: 4, phone: { x: 1, px: 2 } },
  { sprite: 'staghorn-orange', species: 'acropora-muricata', seabed: true, x: 18, px: 4, phone: { x: 27, px: 3 } },
  { sprite: 'staghorn-blue', species: 'acropora-muricata', seabed: true, x: 70, px: 4, phone: { x: 66, px: 3 } },
  { sprite: 'table-coral', species: 'acropora-hyacinthus', seabed: true, x: 79, px: 3, flip: true, phone: false },
]
