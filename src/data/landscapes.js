// Fixed set dressing for tanks that carry a `landscape` key (see TANKS in species.js).
//
// Every piece is placed by hand here, so the layout is identical on every load. The only
// generated part is the rubble scatter, and it is drawn from a fixed seed, so it is just as
// stable. Nothing here reads the tank-visit seed.
//
// Units are world units (1 WU = 25 cm). Fish do not avoid rocks yet, so every piece
// stays out of the swim volume of every species in the tank. For The Reefs that volume is
// x ±56, z -40 to -15, y -14 to 2.8 (the Mola and its followers), plus the triggerfish's
// shallower box reaching forward to z -8.3. The Mola's 13 WU body reaches about 6.6 WU past
// its centre. That leaves three zones, checked against each piece's rotated footprint:
//   back: front face at z <= -47, any height
//   foreground: footprint at z >= -7.5 (between the swim volume and the glass), any height
//   floor: anywhere, top below y -20 (under the Mola's deepest fin)
//
// The phone frame is narrow (about ±16 WU wide at z -50, ±3 WU at z 0), so the back walls
// start close to the centre to frame open blue between them on a 375 px screen, and the
// foreground pieces nearest the centre poke into the phone's bottom corners. The outer
// pieces fill the sides for wide screens.
//
// Prototype: each piece renders as a procedural placeholder rock (Landscape.jsx) until the
// modelled GLBs land. `kind` names the model it stands in for: bommie, boulder, wall.

export const LANDSCAPES = {
  reefs: {
    // Two metres below the Mola's 14 WU dive floor, so its fins clear the sand.
    floorY: -22,
    floorColor: '#a39c80',
    // Height of the low sand ripples, in WU.
    floorRelief: 0.5,
    // [kind, x, z, width, height, depth, yaw (rad), seed]. x/z sit the piece's base centre
    // on the sand; width/height/depth are its bounding box in WU.
    rocks: [
      // Back left canyon wall
      ['bommie', -9, -52, 7, 15, 7, 0.4, 11],
      ['wall', -19, -54, 16, 17, 9, 0.3, 12],
      ['wall', -27, -53, 12, 13, 7, 0.5, 15],
      ['wall', -34, -62, 22, 21, 10, -0.2, 13],
      ['wall', -48, -56, 20, 18, 10, 0.3, 16],
      ['bommie', -60, -70, 12, 24, 10, 0, 17],
      ['boulder', -13, -50, 4.5, 3.5, 4, 1.1, 14],
      // Back right canyon wall
      ['bommie', 10, -52.5, 8, 12, 7, -0.5, 21],
      ['wall', 19, -56, 18, 19, 10, -0.3, 22],
      ['wall', 27, -54, 12, 11, 7, -0.4, 25],
      ['wall', 36, -64, 24, 23, 11, 0.15, 23],
      ['wall', 49, -58, 22, 20, 10, -0.2, 26],
      ['bommie', 61, -72, 12, 25, 10, 0, 27],
      ['boulder', 6.5, -49.5, 3.5, 2.6, 3.2, 0.2, 24],
      // Far ridge, seen through the gap between the walls
      ['wall', -2, -76, 34, 11, 12, 0.05, 31],
      // Foreground left: reef rising in front of the swim volume, framing the glass
      ['wall', -9, -3, 10, 18, 6, 0.2, 51],
      ['bommie', -3, 1, 5, 18, 5, 0.5, 52],
      ['wall', -17, 0, 9, 17, 7, -0.3, 53],
      // Foreground right
      ['wall', 10, -3, 11, 18.5, 6, -0.25, 61],
      ['bommie', 3.2, 1.5, 4.5, 17, 4.5, -0.4, 62],
      ['wall', 18, 1, 10, 15, 7, 0.35, 63],
      // Low boulders under the swim volume (tops below y -20)
      ['boulder', -14, -12, 3.5, 1.6, 3, 0.7, 41],
      ['boulder', 10, -6, 3, 1.4, 2.6, 2.1, 42],
      ['boulder', 2, -18, 4, 1.8, 3.5, 0.3, 43],
      ['boulder', -6, 0, 2.5, 1.2, 2.2, 1.6, 44],
      ['boulder', 20, -20, 4, 1.5, 3, 2.7, 45],
      ['boulder', -9, -30, 4, 1.8, 3.4, 1.2, 46],
      ['boulder', 13, -36, 3.6, 1.7, 3, 0.5, 47],
    ],
    // Rubble chunks scattered on the sand around the walls, 10–30 cm each.
    rubble: { count: 320, seed: 4127, xMin: -64, xMax: 64, zMin: -84, zMax: -20, sizeMin: 0.4, sizeMax: 1.2 },
  },
}

export function landscapeForTank(tank) {
  return tank?.landscape ? LANDSCAPES[tank.landscape] ?? null : null
}

// Smooth low sand ripples. Seabed vertices and every placed piece sample the same function,
// so rocks sit on the sand rather than on a guessed flat height.
export function sandHeight(landscape, x, z) {
  const relief = landscape.floorRelief ?? 0
  const ripple = Math.sin(x * 0.11 + z * 0.04) * 0.6 + Math.sin(z * 0.17 - x * 0.05 + 1.3) * 0.4
  const swell = Math.sin(x * 0.031 + 0.7) * Math.sin(z * 0.027 + 2.1)
  return landscape.floorY + relief * (ripple * 0.6 + swell)
}
