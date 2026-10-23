// The landing dive's descent: after Dive in, before any reserve is chosen, so it shows
// everything rather than one place. Curated by hand, like a reserve's `descent` block
// (docs/tank-design.md, Descent scenery): update it as creatures and reserves are added.
// Same rules: composed, not scattered; species and corals only; sprites face left.
//
// It is a montage of every reserve over the sunlight zone, not one real water column:
// open-water animals in the upper part, a reef fish lower down, corals at the bottom
// where the diver arrives at the selector.
export const GENERAL_DESCENT = {
  depthZone: 'epipelagic',
  depthMeters: [0, 200],
  // Sparse on purpose (Jeremy, dev_15: "too cluttered"): four moments down the line,
  // alternating sides with plenty of water between them, then a small coral garden.
  descent: {
    signature: [
      { sprite: 'sunfish', species: 'mola-alexandrini', depth: 22, side: 'right' },
      { sprite: 'sardine', species: 'amblygaster-sirm', depth: 65, side: 'left', flip: true },
      { sprite: 'sardine', species: 'amblygaster-sirm', depth: 65, side: 'left', flip: true, dx: 10, dy: -5, distance: 0.25 },
      { sprite: 'sardine', species: 'amblygaster-sirm', depth: 65, side: 'left', flip: true, dx: 6, dy: 5, distance: 0.4 },
      { sprite: 'whale-shark', species: 'rhincodon-typus', depth: 112, side: 'right' },
      { sprite: 'bannerfish', species: 'heniochus-acuminatus', depth: 158, side: 'left', flip: true },
    ],
    scenery: [
      { sprite: 'table-coral', depth: 'floor', side: 'left' },
      { sprite: 'staghorn-orange', depth: 'floor', side: 'right' },
    ],
  },
}
