// The landing dive's descent: after Dive in, before any reserve is chosen, so it shows
// everything rather than one place. Curated by hand, like a reserve's `descent` block
// (docs/tank-design.md, Descent scenery): update it as creatures and reserves are added.
// Same rules: composed, not scattered; species and corals only; sprites face left.
//
// A reef drop-off (Jeremy, dev_16): the line passes a shallow reef crest at the top, then
// falls away down the wall into open blue, so every piece sits at a depth that agrees
// with its own reserve (The Reefs is 0–10 m, The Open Sea 0–200 m). Top to bottom, by
// where each animal typically lives: the reef crest and its bannerfish, a sardinella
// school off the edge, the sunfish foraging deeper, the whale shark deepest. No seabed:
// the dive ends in open water before the selector. Sides alternate.
export const GENERAL_DESCENT = {
  depthZone: 'epipelagic',
  depthMeters: [0, 200],
  descent: {
    signature: [
      { sprite: 'bannerfish', species: 'heniochus-acuminatus', depth: 8, side: 'right', dx: 12, dy: 12 },
      { sprite: 'sardine', species: 'amblygaster-sirm', depth: 35, side: 'left', flip: true },
      { sprite: 'sardine', species: 'amblygaster-sirm', depth: 35, side: 'left', flip: true, dx: 10, dy: -5, distance: 0.25 },
      { sprite: 'sardine', species: 'amblygaster-sirm', depth: 35, side: 'left', flip: true, dx: 6, dy: 5, distance: 0.4 },
      { sprite: 'sunfish', species: 'mola-alexandrini', depth: 90, side: 'right' },
      { sprite: 'whale-shark', species: 'rhincodon-typus', depth: 150, side: 'left', flip: true },
    ],
    // The reef crest, at The Reefs' own depths.
    scenery: [
      { sprite: 'table-coral', depth: 6, side: 'right' },
      { sprite: 'staghorn-orange', depth: 5, side: 'right', dx: 25, distance: 0.2 },
    ],
  },
}
