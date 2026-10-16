// Fixed set dressing for tanks that carry a `landscape` key (see TANKS in species.js).
//
// Every piece is placed by hand here, so the layout is identical on every load. The only
// generated part is the rubble scatter, and it is drawn from a fixed seed, so it is just as
// stable. Nothing here reads the tank-visit seed.
//
// Units are world units (1 WU = 25 cm). The Mola and the fish that follow it roam back to
// z -40 (DRIFT_RIDER_BOUNDS boundsZMin -25, plus the -15 camera offset) and down to y -14,
// and the Mola's 13 WU body reaches about 6.6 WU past its centre. So every tall piece
// stands with its front face at z <= -47, behind the swim volume: no fish ever meets a
// rock. The few boulders in front of that line stay below the Mola's deepest fin
// (about y -20), so they only show from a low follow-cam angle.
//
// The phone frame is narrow (about ±16 WU wide at z -50), so the walls start close to the
// centre to frame open blue between them on a 375 px screen; the outer pieces extend the
// same canyon for wide screens.
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
      // Left canyon wall
      ['bommie', -9, -50, 7, 15, 7, 0.4, 11],
      ['wall', -19, -54, 16, 17, 9, 0.3, 12],
      ['wall', -34, -62, 22, 21, 10, -0.2, 13],
      ['boulder', -13, -46.5, 4.5, 3.5, 4, 1.1, 14],
      // Right canyon wall
      ['bommie', 10, -51, 8, 12, 7, -0.5, 21],
      ['wall', 19, -56, 18, 19, 10, -0.3, 22],
      ['wall', 36, -64, 24, 23, 11, 0.15, 23],
      ['boulder', 6.5, -47, 3.5, 2.6, 3.2, 0.2, 24],
      // Far ridge, seen through the gap between the walls
      ['wall', -2, -76, 34, 11, 12, 0.05, 31],
      // Low boulders under the swim volume (tops below y -20)
      ['boulder', -14, -12, 3.5, 1.6, 3, 0.7, 41],
      ['boulder', 10, -6, 3, 1.4, 2.6, 2.1, 42],
      ['boulder', 2, -18, 4, 1.8, 3.5, 0.3, 43],
      ['boulder', -6, 0, 2.5, 1.2, 2.2, 1.6, 44],
      ['boulder', 20, -20, 4, 1.8, 3, 2.7, 45],
      ['boulder', -9, -30, 4, 1.8, 3.4, 1.2, 46],
      ['boulder', 13, -36, 3.6, 1.7, 3, 0.5, 47],
    ],
    // Rubble chunks scattered on the sand around the walls, 10–30 cm each.
    rubble: { count: 240, seed: 4127, xMin: -48, xMax: 48, zMin: -82, zMax: -20, sizeMin: 0.4, sizeMax: 1.2 },
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
