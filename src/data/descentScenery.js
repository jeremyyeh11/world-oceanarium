// The landing dive's descent: after Dive in, before any reserve is chosen, so it shows
// everything rather than one place. Curated by hand, like a reserve's `descent` block
// (docs/tank-design.md, Descent scenery): update it as creatures and reserves are added.
// Same rules: composed, not scattered; species and corals only; sprites face left.
//
// It is a montage of every reserve over the sunlight zone, not one real water column:
// open-water animals in the upper half, reef fish lower down, a coral garden at the
// bottom where the diver arrives at the selector.
export const GENERAL_DESCENT = {
  depthZone: 'epipelagic',
  depthMeters: [0, 200],
  descent: {
    signature: [
      // Open water, zigzagging down the line.
      { sprite: 'sunfish', species: 'mola-alexandrini', depth: 12, side: 'right' },
      { sprite: 'mahi-mahi-male', species: 'coryphaena-hippurus', depth: 35, side: 'left', flip: true },
      { sprite: 'mahi-mahi-female', species: 'coryphaena-hippurus', depth: 35, side: 'left', flip: true, dx: 6, dy: 10, distance: 0.25 },
      { sprite: 'sardine', species: 'amblygaster-sirm', depth: 68, side: 'right' },
      { sprite: 'sardine', species: 'amblygaster-sirm', depth: 68, side: 'right', dx: 11, dy: -5 },
      { sprite: 'sardine', species: 'amblygaster-sirm', depth: 68, side: 'right', dx: 6, dy: 5, distance: 0.2 },
      { sprite: 'sardine', species: 'amblygaster-sirm', depth: 68, side: 'right', dx: 17, dy: 2, distance: 0.35 },
      { sprite: 'sardine', species: 'amblygaster-sirm', depth: 68, side: 'right', dx: 14, dy: 10, distance: 0.45 },
      { sprite: 'whale-shark', species: 'rhincodon-typus', depth: 102, side: 'left', flip: true },
      // The reef, lower down.
      { sprite: 'bannerfish', species: 'heniochus-acuminatus', depth: 138, side: 'right' },
      { sprite: 'emperor-angelfish', species: 'pomacanthus-imperator', depth: 162, side: 'left', flip: true },
      { sprite: 'raccoon-butterflyfish', species: 'chaetodon-lunula', depth: 178, side: 'right', distance: 0.2 },
      { sprite: 'raccoon-butterflyfish', species: 'chaetodon-lunula', depth: 178, side: 'right', dx: 12, dy: -6, distance: 0.35 },
    ],
    scenery: [
      { sprite: 'table-coral', depth: 'floor', side: 'left' },
      { sprite: 'staghorn-blue', depth: 'floor', side: 'left', dx: -3, distance: 0.25 },
      { sprite: 'staghorn-orange', depth: 'floor', side: 'right' },
    ],
  },
}
