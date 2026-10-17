// Where the species data comes from. Kept as data rather than markup so the
// list can grow — the Sources modal renders whatever is in here, in order.
//
// `provides` is the short answer to "which fields did this reference decide?",
// so a reader can trace any single row of an Atlas entry back to one source.
export const SOURCES = [
  {
    id: 'fishbase',
    name: 'FishBase',
    kicker: 'Species biology',
    url: 'https://www.fishbase.se/',
    summary:
      'The global fish database, and the starting point for every Atlas entry. Most of what a species page states about the animal itself is read from here.',
    provides: [
      'Taxonomy',
      'Habitat',
      'Depth',
      'Diet',
      'Size',
      'Lifespan',
      'Maturity',
      'Reproduction',
      'Conservation status',
    ],
  },
  {
    id: 'worms',
    name: 'WoRMS',
    fullName: 'World Register of Marine Species',
    kicker: 'Taxonomy',
    url: 'https://www.marinespecies.org/',
    summary:
      'The register scientific names are checked against, so a species reads the same on a tank label, a debug tag, and an Atlas entry.',
    provides: ['Accepted taxonomy', 'Family classification'],
  },
  {
    id: 'iucn-red-list',
    name: 'IUCN Red List',
    kicker: 'Conservation',
    url: 'https://www.iucnredlist.org/',
    summary:
      'The conservation-status framework behind the NE → CR bar on every Atlas entry, and the per-species assessments that place each animal on it.',
    provides: ['Status framework', 'Species assessments'],
  },
  {
    id: 'world-oceanarium',
    name: 'world-oceanarium',
    fullName: 'GitHub repository',
    kicker: 'This project',
    url: 'https://github.com/jeremyyeh11/world-oceanarium',
    summary:
      'The oceanarium itself: the implementation, and the shipped species data showing how the references above were applied to each animal.',
    provides: ['Implementation', 'Species data'],
  },
]

// Photographs the models are textured from. The Sources panel groups them in one
// Image credits section after the references. Each licence asks for credit, a link
// to the licence, and a note of changes; CC BY-SA also asks that the adapted
// texture is shared under the same licence, which `changes` says.
export const IMAGE_CREDITS = [
  {
    id: 'zerpe-emperor-angelfish',
    subject: 'Emperor Angelfish texture',
    author: 'Rickard Zerpe',
    work: 'Emperor angelfish (Pomacanthus imperator)',
    url: 'https://commons.wikimedia.org/wiki/File:Emperor_angelfish_(Pomacanthus_imperator)_(32827796637).jpg',
    licence: { name: 'CC BY 2.0', url: 'https://creativecommons.org/licenses/by/2.0/' },
    changes: 'Mapped onto the 3D model, the fins cut out, and resized.',
  },
  {
    id: 'delso-emperor-angelfish-juvenile',
    subject: 'Juvenile Emperor Angelfish texture',
    author: 'Diego Delso',
    work: 'Juvenile emperor angelfish (Pomacanthus imperator), Ad Dimaniyat Islands, Oman',
    url: 'https://commons.wikimedia.org/wiki/File:Pez_%C3%A1ngel_emperador_(Pomacanthus_imperator),_islas_Ad_Dimaniyat,_Om%C3%A1n,_2024-08-14,_DD_47.jpg',
    licence: { name: 'CC BY-SA 4.0', url: 'https://creativecommons.org/licenses/by-sa/4.0/' },
    changes: 'Mapped onto the 3D model and resized; the adapted texture is shared under the same licence.',
  },
]
