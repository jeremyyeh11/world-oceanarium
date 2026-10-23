// The landing's standee scenery: pixel cut-outs (src/data/pixelSprites.js) around the
// Dive in card, the same style as each reserve's descent. Curated by hand, not generated
// from the roster: add a piece here when a new creature or reserve earns a place on the
// front page, and draw its sprite first.
//
// Composed, not scattered (desktop, card in the middle third):
//   - the whale shark is the hero, gliding left across the top: the eye follows it to the
//     left edge, then down the butterflyfish school, which rises diagonally into the card;
//   - the sunfish balances it on the right third, near and bright;
//   - the coming-soon rays are a distant pair low on the right, small and dark;
//   - corals anchor both bottom corners, the larger mass on the left.
// Depth is by size and `distance`: farther pieces are drawn smaller and dimmer.
// Phones keep the same idea in the bands above and below the card.
//
// Each piece: { sprite, species?, comingSoon?, x, y, px, flip?, seabed?, distance?, phone? }
//   x, y      position as % of the screen (left and top edges of the sprite); for a
//             `seabed` piece, y is ignored and it stands on the bottom edge
//   px        size of one sprite cell in CSS px on desktop (whole numbers stay crisp)
//   distance  0 (near) to 1 (far): dimmer and greyer with distance
//   phone     { x, y, px } overrides at phone widths, or false to leave it out there
//             (the card covers the middle of a phone screen, so keep pieces to the edges)
//   species   the species id it depicts, for reference when the roster changes
//   comingSoon a creature not in any reserve yet, drawn dark and greyed out as a hint
//             of what is on the way; `futureSpecies` names it. When it joins a roster,
//             drop `comingSoon`, rename `futureSpecies` to `species`.
//
// Static: pieces never travel or scroll; swimming species bob a pixel in place. Array order
// is paint order: later pieces draw in front.
export const LANDING_SCENERY = [
  // Distant pair, low right: coming soon.
  { sprite: 'eagle-ray', futureSpecies: 'aetobatus-narinari', comingSoon: true, x: 88, y: 55, px: 2, phone: false },
  { sprite: 'manta-ray', futureSpecies: 'mobula-alfredi', comingSoon: true, x: 74, y: 64, px: 3, phone: { x: 62, y: 80, px: 2 } },

  // Hero: the whale shark across the top, heading left.
  { sprite: 'whale-shark', species: 'rhincodon-typus', x: 41, y: 6, px: 5, phone: { x: 16, y: 7, px: 3 } },

  // The sunfish, near, on the right third.
  { sprite: 'sunfish', species: 'mola-alexandrini', x: 77, y: 30, px: 4, phone: { x: 76, y: 14, px: 2 } },

  // Raccoon butterflyfish rising diagonally into the card, the rear of the school smaller.
  { sprite: 'raccoon-butterflyfish', species: 'chaetodon-lunula', x: 22, y: 58, px: 2, flip: true, distance: 0.45, phone: false },
  { sprite: 'raccoon-butterflyfish', species: 'chaetodon-lunula', x: 18, y: 64, px: 2, flip: true, distance: 0.35, phone: { x: 20, y: 79, px: 2 } },
  { sprite: 'raccoon-butterflyfish', species: 'chaetodon-lunula', x: 14, y: 61, px: 3, flip: true, distance: 0.2, phone: false },
  { sprite: 'raccoon-butterflyfish', species: 'chaetodon-lunula', x: 11, y: 68, px: 3, flip: true, distance: 0.1, phone: { x: 13, y: 83, px: 2 } },
  { sprite: 'raccoon-butterflyfish', species: 'chaetodon-lunula', x: 6, y: 73, px: 3, flip: true, phone: { x: 6, y: 87, px: 2 } },

  // Corals: the larger mass bottom left, a smaller one bottom right.
  { sprite: 'staghorn-blue', species: 'acropora-muricata', seabed: true, x: 14, px: 3, distance: 0.35, phone: false },
  { sprite: 'table-coral', species: 'acropora-hyacinthus', seabed: true, x: 1, px: 5, phone: { x: 1, px: 3 } },
  { sprite: 'staghorn-orange', species: 'acropora-muricata', seabed: true, x: 9, px: 4, phone: { x: 19, px: 2 } },
  { sprite: 'table-coral', species: 'acropora-hyacinthus', seabed: true, x: 87, px: 3, flip: true, distance: 0.3, phone: false },
  { sprite: 'staghorn-blue', species: 'acropora-muricata', seabed: true, x: 83, px: 3, phone: { x: 80, px: 2 } },
]
