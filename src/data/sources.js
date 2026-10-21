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
      'Weight',
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
    id: 'coral-trait-database',
    name: 'Coral Trait Database',
    kicker: 'Coral biology',
    url: 'https://www.coraltraits.org/',
    summary:
      'Published measurements of reef-building corals, read for the corals the way FishBase is for the fish.',
    provides: ['Colony size', 'Growth', 'Eggs per polyp'],
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

// Studies and species profiles behind Atlas figures the databases above do not give (sizes,
// weights, ages, maturity, eggs). The Sources panel lists them in a Studies section after the
// references, the way it lists the photographs. `subject` says which species and fields each
// one decided.
export const STUDY_CREDITS = [
  {
    id: 'bachman-2018-sharksucker',
    subject: 'Live Sharksucker size, weight and eggs',
    authors: 'Bachman et al.',
    year: 2018,
    title: 'Growth and reproduction of Echeneis naucrates from the eastern Gulf of Mexico',
    venue: 'Journal of Fish Biology',
    url: 'https://doi.org/10.1111/jfb.13790',
  },
  {
    id: 'battaglia-2016-marlinsucker',
    subject: 'Marlinsucker size and weight',
    authors: 'Battaglia et al.',
    year: 2016,
    title: 'Age, growth, biological and ecological aspects of Remora osteochir (Echeneidae) in the Mediterranean Sea',
    venue: 'Journal of the Marine Biological Association of the UK 96: 639–645',
    url: 'https://www.cambridge.org/core/journals/journal-of-the-marine-biological-association-of-the-united-kingdom/article/age-growth-biological-and-ecological-aspects-of-remora-osteochir-echeneidae-in-the-mediterranean-sea/108E8851B137A2A7B3DEDC6EF59795E2',
  },
  {
    id: 'meekan-2020-whale-shark',
    subject: 'Whale Shark size and weight by sex',
    authors: 'Meekan et al.',
    year: 2020,
    title: 'Asymptotic growth of whale sharks suggests sex-specific life-history strategies',
    venue: 'Frontiers in Marine Science',
    url: 'https://doi.org/10.3389/fmars.2020.575683',
  },
  {
    id: 'khasanah-2019-groupers',
    subject: 'Squaretail Coral Grouper size and weight',
    authors: 'Khasanah et al.',
    year: 2019,
    title: 'Reproductive biology of three important threatened/near-threatened groupers in Eastern Indonesia and implications for management',
    venue: 'Animals 9: 643',
    url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC6769801/',
  },
  {
    id: 'obota-2016-emperor-angelfish',
    subject: 'Emperor Angelfish maturity and eggs',
    authors: 'Obota, Fulanda, Okemwa & Kimani',
    year: 2016,
    title: 'Reproductive biology and body condition of exploited populations of Emperor Angelfish along the Kenyan Coast',
    venue: 'WIO Journal of Marine Science 15(2): 19–30',
    url: 'https://www.ajol.info/index.php/wiojms/article/view/138710',
  },
  {
    id: 'froese-binohlan-2000',
    subject: 'Estimated average size (Raccoon Butterflyfish, Emperor Angelfish, Clown Triggerfish, White Suckerfish, Whalesucker) and maturity size (Pilot Fish, Longfin Bannerfish, Raccoon Butterflyfish)',
    authors: 'Froese & Binohlan',
    year: 2000,
    title: 'Empirical relationships to estimate asymptotic length, length at first maturity and length at maximum yield per recruit in fishes',
    venue: 'Journal of Fish Biology 56: 758–773',
    url: 'https://doi.org/10.1111/j.1095-8649.2000.tb00870.x',
  },
  {
    id: 'thorson-2017-fishlife',
    subject: 'Estimated ages: Giant Sunfish lifespan and maturity, Whale Shark maturity',
    authors: 'Thorson, Munch, Cope & Gao',
    year: 2017,
    title: 'Predicting life history parameters for all fishes worldwide (FishLife)',
    venue: 'Ecological Applications 27: 2262–2276',
    url: 'https://doi.org/10.1002/eap.1606',
  },
  {
    id: 'toronto-zoo-clown-triggerfish',
    subject: 'Clown Triggerfish lifespan and maturity',
    authors: 'Toronto Zoo',
    title: 'Clown triggerfish',
    venue: 'species profile',
    url: 'https://www.torontozoo.com/animals/Clown%20triggerfish',
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
  {
    id: 'zerpe-squaretail-coral-grouper',
    subject: 'Squaretail Coral Grouper texture',
    author: 'Rickard Zerpe',
    work: 'Squaretail coral grouper (Plectropomus areolatus), Raja Ampat, Indonesia',
    url: 'https://commons.wikimedia.org/wiki/File:Squaretail_coral_grouper_(Plectropomus_areolatus)_(46722835651).jpg',
    licence: { name: 'CC BY 2.0', url: 'https://creativecommons.org/licenses/by/2.0/' },
    changes: 'Mapped onto the 3D model, the fins cut out, and resized.',
  },
  {
    id: 'mcminds-table-coral',
    subject: 'Table coral texture (cream tables)',
    author: 'Ryan McMinds',
    work: 'Acropora hyacinthus, Kelso Reef',
    url: 'https://commons.wikimedia.org/wiki/File:Acropora_hyacinthus,_Kelso_Reef.jpg',
    licence: { name: 'CC BY 2.0', url: 'https://creativecommons.org/licenses/by/2.0/' },
    changes: 'Mapped onto the 3D models, baked into a new texture, and resized.',
  },
  {
    id: 'holobionics-table-coral',
    subject: 'Table coral texture (pink table)',
    author: 'Holobionics',
    work: 'Lodestone Reef, Valentines Day 2016 CoralScape',
    url: 'https://commons.wikimedia.org/wiki/File:Lodestone_Reef,_Valentines_Day_2016_CoralScape.jpg',
    licence: { name: 'CC BY-SA 4.0', url: 'https://creativecommons.org/licenses/by-sa/4.0/' },
    changes: 'Mapped onto the 3D model, baked into a new texture, and resized; the adapted texture is shared under the same licence.',
  },
]
