// Pixel-art sprites for the standee scenery on each reserve's loading descent,
// in the same cell style as the descent's diver. Each sprite is a grid of characters:
// '.' is empty, any other character is a cell in that palette colour. Every sprite faces
// left; standees flip it when placed (`flip`).
//
// Real colours, knocked back toward the CRT phosphor palette so they sit on the monitor
// rather than pasted over it. Keep species sprites recognisable at 2 px per cell: the
// silhouette and one or two field marks (the bannerfish's pennant and bands, the whale
// shark's spots) matter more than detail.
//
// Adding a sprite: draw it here, add it to a tank's `descent` in species.js, and check it at
// large scale before shipping.

export const SPRITE_PALETTE = {
  // Ink and light
  k: '#0a1622', // near-black: bands, masks, eyes
  w: '#e6f1f5', // white
  // Fish
  y: '#e9c766', // yellow (butterflyfish, bannerfish tail and dorsal, angelfish stripes)
  Y: '#d7a94a', // deeper yellow (tails)
  b: '#2f62a6', // angelfish blue
  l: '#8fc4e6', // light blue edge
  g: '#5c7f98', // whale shark grey-blue
  G: '#3f5d75', // whale shark back
  s: '#cfe2ee', // whale shark spots, belly
  m: '#9db2c2', // sunfish silver
  M: '#6f8798', // sunfish fins and clavus
  // Corals (living reef animals; no rock or landscape pieces in the scenery)
  c: '#d9c9a6', // table coral cream
  C: '#efe3c6', // table coral rim highlight
  d: '#8f7f62', // table coral underside
  o: '#d98b55', // staghorn orange
  O: '#efb07c', // staghorn tips
  u: '#5d93c4', // staghorn blue
  U: '#93bfe2', // staghorn blue tips
}

const SPRITES = {
  // Rhincodon typus, the whale shark: broad flat head, tall upper tail lobe, pale spots.
  'whale-shark': [
    '................................GG..',
    '...............GG...............GGG.',
    '..............GGGG.............GGGG.',
    '....GGGGGGGGGGGGGGGGGGGGGGG...GGGG..',
    '..GGsGGGsGGGsGGGsGGGsGGGGGGGgGGGG...',
    '.ggggsgggsgggsgggsgggggggggggggg....',
    'gkgggggsgggsgggsgggsgggggggggggg....',
    'kkgggsgggsgggsgggggggggggggggggg....',
    '.sssssssssssssssssssssgggggggggg....',
    '..sssgsss..........ssss....ggggg....',
    '.....ggg....................ggg.....',
    '......gg.....................g......',
  ],
  // Amblygaster sirm, the spotted sardinella: a slim silver fish with a blue back, a row of
  // gold flank spots and a forked tail. Small on purpose: it reads as one of many.
  sardine: [
    '..GGGGGGG..G',
    '.kGyGyGyGGGG',
    'ssssssssssG.',
    '..sssssss..s',
  ],
  // Mola alexandrini, the giant sunfish: a tall disc with a tall dorsal and anal fin at
  // the back and a scalloped clavus instead of a tail.
  sunfish: [
    '.........MM....',
    '........MMM....',
    '.......MMMM....',
    '......MMMMM....',
    '...mmmmMMMMm...',
    '..mmmmmmmmmmmm.',
    '.mmmmmmmmmmmmmM',
    '.mkmmmmmmmmmmmM',
    'mmmmmmmmmmmmmmM',
    'kmmmmmmmmmmmmmM',
    'mmmmmmmmmmmmmmM',
    '.mmmmmmmmmmmmmM',
    '.mmmmmmmmmmmmmM',
    '..mmmmmmmmmmmm.',
    '...mmmmMMMMm...',
    '......MMMMM....',
    '.......MMMM....',
    '........MMM....',
    '.........MM....',
  ],
  // Heniochus acuminatus, the longfin bannerfish: white disc, two broad black bands,
  // yellow tail and soft dorsal, and the long white pennant streaming back.
  bannerfish: [
    '.........wwwww',
    '.......ww.....',
    '......w.......',
    '.....ww.......',
    '....wwwy......',
    '...wwkkyy.....',
    '..wwwkkkyyy...',
    '.wkwwkkwwkyyY.',
    'wwwwkkwwwkkyYY',
    '.wwwkkwwwkkyYY',
    '..wwkkwwwkkyY.',
    '...wkkwwkkyy..',
    '....kkwwkk....',
    '.....k..k.....',
  ],
  // Pomacanthus imperator, the emperor angelfish (adult): blue with yellow stripes, a dark
  // mask through the eye edged in light blue, and a yellow tail.
  'emperor-angelfish': [
    '.....bybbybb....',
    '...lybbybbybb...',
    '..lkkybbybbybb..',
    '.lkkkbybbybbybY.',
    'lkwkkbbybbybbYYY',
    'lkkkkybbybbybYYY',
    '.lkkkbybbybbyYYY',
    '..lkkbbybbybby..',
    '...lbybbybbyb...',
    '.....bybbybb....',
  ],
  // Chaetodon lunula, the raccoon butterflyfish: yellow, a black mask over the eye with a
  // white band behind it, and a dark spot at the base of the tail.
  'raccoon-butterflyfish': [
    '...yyyy...',
    '..yyyyyyy.',
    '.ykkwyyyyY',
    'ykwkwyyyYY',
    'yykkwyyyyY',
    '.yyyyyyky.',
    '..yyyyyy..',
    '...y..y...',
  ],
  // Acropora hyacinthus, a table coral: a flat plate on a short stalk.
  'table-coral': [
    '..cccccccccccccccccc..',
    '.cCcCcCcCcCcCcCcCcCcc.',
    'cccccccccccccccccccccc',
    '..ddddddddddddddddd...',
    '.........dd...........',
    '.........dd...........',
    '........dddd..........',
  ],
  // Acropora muricata, staghorn: branching antler-like stems, in its orange and blue forms.
  'staghorn-orange': [
    '..O.....O.....',
    '..o..O..o..O..',
    '..oo.o.oo..o..',
    '...o.o.o..oo..',
    '...oooo...o...',
    '....oo..oo....',
    '.....oooo.....',
    '......oo......',
    '......oo......',
  ],
  'staghorn-blue': [
    '.U...U...U..',
    '.u.U.u..Uu..',
    '.uu.uu.u.u..',
    '..u.u..uu...',
    '..uuu.uu....',
    '...uuuu.....',
    '....uu......',
    '....uu......',
  ],
}

// Each sprite as { width, height, runs }, runs being [x, y, length, colour] merged along
// rows so the SVG stays small. Computed once at import.
export const PIXEL_SPRITES = Object.fromEntries(Object.entries(SPRITES).map(([name, rows]) => {
  const width = Math.max(...rows.map(row => row.length))
  const runs = []
  rows.forEach((row, y) => {
    let x = 0
    while (x < row.length) {
      const key = row[x]
      if (key === '.') { x += 1; continue }
      let end = x + 1
      while (end < row.length && row[end] === key) end += 1
      runs.push([x, y, end - x, SPRITE_PALETTE[key] ?? '#ff00ff'])
      x = end
    }
  })
  return [name, { width, height: rows.length, runs }]
}))
