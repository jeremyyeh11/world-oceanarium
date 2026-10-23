// What changed, told to visitors. CHANGELOG.md is the full engineering record
// (constants, dev builds, measurements); this is the short version the version
// label opens: new things to see and fixes they would notice, newest first.
// Releases that only touched tooling, code structure or data plumbing are left out.
//
// Each change is `new` (something to see or do) or `fix` (something that was wrong).
export const VISITOR_CHANGELOG = [
  {
    version: 'v0.34.1',
    date: '2026-10-23',
    title: 'Reef fish reach their rocks',
    changes: [
      ['fix', 'A reef fish heading for a rock behind it now turns round and swims to it, instead of carrying on the other way and giving up.'],
      ['fix', 'Young emperor angelfish moving to a new patch of reef now get all the way there.'],
      ['fix', 'A fish swimming into the gap between two rocks picks a way round and keeps to it, instead of shivering from side to side.'],
    ],
  },
  {
    version: 'v0.34.0',
    date: '2026-10-22',
    title: 'Humphead Wrasse females',
    changes: [
      ['new', 'Two female Humphead Wrasses join the male at The Reefs: smaller, grey and without his hump, with a yellow rim on the tail. The Atlas now shows them as a pair.'],
    ],
  },
  {
    version: 'v0.33.0',
    date: '2026-10-22',
    title: 'Humphead Wrasse',
    changes: [
      ['new', 'A Humphead Wrasse joins The Reefs and the Atlas: the largest wrasse, a big blue-green male with a hump on his forehead who patrols the reef and stops to bite shellfish off the rocks. It is Endangered, fished for the live reef food trade.'],
    ],
  },
  {
    version: 'v0.32.2',
    date: '2026-10-22',
    title: 'Fuller Atlas entries',
    changes: [
      ['new', 'Atlas entries now give average size, weight and life expectancy, and age at maturity and eggs, for far more species, from published studies. Estimates are marked as estimated.'],
      ['new', 'Sources lists the studies behind those figures, next to the image credits.'],
    ],
  },
  {
    version: 'v0.32.1',
    date: '2026-10-22',
    title: 'The Atlas scrolls on iPad',
    changes: [
      ['fix', 'The Atlas entry opened from a fish you are following scrolls again on iPad, so the bottom of the entry is no longer out of reach.'],
    ],
  },
  {
    version: 'v0.32.0',
    date: '2026-10-21',
    title: 'Raccoon Butterflyfish',
    changes: [
      ['new', 'A group of twenty Raccoon Butterflyfish works The Reefs together, picking at the rocks and corals and raising their spines when startled. They join the Atlas too.'],
    ],
  },
  {
    version: 'v0.31.6',
    date: '2026-10-20',
    title: 'Smooth departures from the rocks',
    changes: [
      ['fix', 'A reef fish leaving a nook between two rocks no longer jitters back and forth as it swims clear.'],
      ['fix', 'Fish coming away from a rock, or from the sunfish they were following, no longer jump into place in a single frame.'],
    ],
  },
  {
    version: 'v0.31.5',
    date: '2026-10-20',
    title: 'Reef fish swim freely among the rocks',
    changes: [
      ['fix', 'A reef fish swimming close past a rock or a coral table no longer shivers its head from side to side or up and down for a few seconds: it curves smoothly round, and over or under a table.'],
      ['fix', 'A reef fish nosing into a gap between two rocks too narrow for it no longer wedges there, shivering nose-down for minutes: it slips along the rocks or turns back and goes another way.'],
      ['fix', 'Fish gliding along the sea floor beside a rock no longer nod up and down.'],
    ],
  },
  {
    version: 'v0.31.4',
    date: '2026-10-20',
    title: 'Fish at the staghorn',
    changes: [
      ['new', 'Reef fish now use the staghorn coral: bannerfish hang over the branch tips where plankton drifts, young angelfish slip in among the branches, and the others pass over or wait beside them.'],
      ['fix', 'Fish resting at the rocks and table corals no longer end up with staghorn branches through them.'],
    ],
  },
  {
    version: 'v0.31.3',
    date: '2026-10-20',
    title: 'A lower view of The Reefs',
    changes: [
      ['new', 'The Reefs\' starting view tilts slightly down, so the central coral outcrop sits near the middle of the screen.'],
    ],
  },
  {
    version: 'v0.31.0',
    date: '2026-10-20',
    title: 'Staghorn coral',
    changes: [
      ['new', 'Staghorn coral grows on The Reefs in brown, cream and blue patches, branching among the table corals on the same rocks.'],
      ['new', 'The Staghorn Coral joins the Atlas: an Endangered branching coral.'],
    ],
  },
  {
    version: 'v0.30.1',
    date: '2026-10-19',
    title: 'Fish at the corals',
    changes: [
      ['new', 'Reef fish now use the table corals: they hide under the plates or between two tiers, nibble along the edges, and hang about beside them. The grouper likes them most.'],
      ['new', 'In the Atlas, the Hyacinth Table Coral\'s bommie sits on a faint patch of sand.'],
      ['fix', 'The species count on the welcome card now includes the coral.'],
    ],
  },
  {
    version: 'v0.30.0',
    date: '2026-10-19',
    title: 'Table corals',
    changes: [
      ['new', 'Table corals grow on The Reefs: clusters of flat, branching plates crowning the rocks, big tables spreading out low over the sand and small ones standing on top.'],
      ['new', 'The Hyacinth Table Coral joins the Atlas: an Endangered coral whose tables are colonies of thousands of tiny polyps.'],
      ['fix', 'Switching to The Reefs no longer stalls while the rocks are built, and going back to it is quicker still.'],
    ],
  },
  {
    version: 'v0.29.0',
    date: '2026-10-19',
    title: 'Life on the reef',
    changes: [
      ['new', 'Reef fish now live on the rocks: they keep a home patch, nose in to pick at the rock, hang about off the face, and tuck into nooks, where a passing threat leaves them be.'],
      ['new', 'The Reefs has a new look: shallow blue water that deepens toward the sea bed, sunlit rock with shadowed undersides, and sunlight dappling the sand.'],
      ['new', 'A new view of The Reefs, from low among the rocks, with a reef outcrop in the middle where the fish gather.'],
      ['fix', 'Fish no longer shiver when they swim close past a rock.'],
    ],
  },
  {
    version: 'v0.28.0',
    date: '2026-10-18',
    title: 'Squaretail Coral Grouper',
    changes: [
      ['new', 'The Squaretail Coral Grouper joins The Reefs and the Atlas: a shy, spotted hunter of coral reefs, listed as Vulnerable because it is fished where it gathers to spawn.'],
      ['fix', 'Long species names no longer run under the close button on a fish\'s card.'],
    ],
  },
  {
    version: 'v0.27.0',
    title: 'Tracking a fish',
    changes: [
      ['new', 'In the diver camera, hold the right mouse button and move the green cursor onto any part of a fish, its head, fin or tail; click to keep the camera on that spot, and click again to let go.'],
      ['new', 'Tap the version label to read what has changed, release by release.'],
      ['new', 'Image credits now sit together in one section of Sources.'],
      ['fix', 'The diver camera swims at a gentler pace, and the mouse turns it more gently.'],
    ],
  },
  {
    version: 'v0.26.0',
    date: '2026-10-17',
    title: 'Diver camera',
    changes: [
      ['new', 'Swim the tank yourself: the dive-mask key in the menu frees the camera. WASD and the mouse on desktop, drag and pinch on a phone, Esc to surface.'],
    ],
  },
  {
    version: 'v0.25.0',
    date: '2026-10-17',
    title: 'The Reefs',
    changes: [
      ['new', 'The Drift becomes The Reefs: limestone cliffs, ledges and boulders on a rolling sand floor, with a canyon at the back.'],
      ['new', 'Fish steer around the rocks.'],
    ],
  },
  {
    version: 'v0.24.0',
    date: '2026-10-16',
    title: 'Fish in the light',
    changes: [
      ['new', 'Fish catch sunlight on their backs and shade toward the belly, depending on how deep they swim.'],
      ['new', 'The largest fish cast shadows on the fish below them.'],
    ],
  },
  {
    version: 'v0.23.0',
    date: '2026-10-16',
    title: 'Whale Shark',
    changes: [
      ['new', 'Young whale sharks cruise The Open Sea, and remoras ride them.'],
      ['new', 'The Atlas lists species alphabetically by scientific name.'],
      ['fix', 'Large fish no longer pass through each other.'],
      ['fix', 'The info card shows a juvenile’s own length and weight, not the adult’s.'],
    ],
  },
  {
    version: 'v0.22.1',
    date: '2026-10-15',
    title: 'Clown Triggerfish',
    changes: [
      ['new', 'Clown triggerfish patrol the reef, rippling their top and bottom fins and beating the tail only to dart.'],
      ['new', 'Atlas photo tile for the Clown Triggerfish.'],
    ],
  },
  {
    version: 'v0.21.0',
    date: '2026-10-13',
    title: 'Juvenile emperor angelfish',
    changes: [
      ['new', 'Young emperor angelfish in their blue-and-white ringed pattern, with a Juvenile tag on the info card.'],
    ],
  },
  {
    version: 'v0.20.1',
    date: '2026-10-13',
    title: 'Emperor Angelfish',
    changes: [
      ['new', 'Emperor angelfish swim in loose pairs and now and then visit the sunfish to clean it.'],
      ['new', 'The Atlas shows pair-living species as pairs.'],
      ['fix', 'The angelfish’s fins are see-through at the edges instead of cut hard.'],
    ],
  },
  {
    version: 'v0.19.1',
    date: '2026-10-12',
    title: 'Longfin Bannerfish and loose pairs',
    changes: [
      ['new', 'Longfin bannerfish, trailing their long dorsal banner, stay near the sunfish.'],
      ['new', 'Bannerfish and adult mahi-mahi swim as loose male–female pairs that drift apart and find each other again.'],
      ['new', 'Atlas photo tile for the Pilot Fish.'],
    ],
  },
  {
    version: 'v0.18.0',
    date: '2026-10-10',
    title: 'Pilot Fish',
    changes: [
      ['new', 'Pilot fish escort the sunfish, holding loose stations around its head.'],
    ],
  },
  {
    version: 'v0.17.3',
    date: '2026-10-10',
    title: 'Whitefin Sharksucker',
    changes: [
      ['new', 'The Whitefin Sharksucker gets its real model and its Atlas photo tile.'],
    ],
  },
  {
    version: 'v0.17.2',
    date: '2026-10-09',
    title: 'Readable type',
    changes: [
      ['fix', 'Longer text across the Atlas, info card, search and menus uses a clearer reading font, and the smallest text on phones is larger.'],
    ],
  },
  {
    version: 'v0.17.0',
    date: '2026-09-29',
    title: 'Smoother edges',
    changes: [
      ['fix', 'Fish turn away from the edges of the view more naturally instead of sliding along them.'],
    ],
  },
  {
    version: 'v0.16.0',
    date: '2026-09-28',
    title: 'Remoras and predators',
    changes: [
      ['new', 'Eight remoras join the tanks; they ride sharks and the sunfish by suction disc, or tag along behind them.'],
      ['new', 'Prey flee where a predator is heading, and a startled sardine’s alarm spreads through its whole school.'],
      ['new', 'Atlas fish are framed larger.'],
      ['fix', 'Sardine schools no longer flatten against the surface or the sides of their swim space.'],
    ],
  },
  {
    version: 'v0.15.8',
    title: 'Atlas corrections',
    changes: [
      ['fix', 'Four species’ facts corrected against the sources; Mahi-mahi and Shortfin Mako are larger to match.'],
      ['fix', 'Smoother frame rate.'],
    ],
  },
  {
    version: 'v0.15.7',
    title: 'Sources',
    changes: [
      ['new', 'A Sources panel in the menu lists the references the species facts come from.'],
    ],
  },
  {
    version: 'v0.15.6',
    title: 'Loading screen',
    changes: [
      ['new', 'The landing card shows loading progress and waits until the tank is ready.'],
      ['fix', 'Switching tanks no longer leaves the previous tank’s fish behind.'],
      ['fix', 'No more stutter the first time each species comes into view.'],
    ],
  },
  {
    version: 'v0.15.5',
    title: 'Follow and Atlas fixes',
    changes: [
      ['fix', 'Following a fish keeps it steadily centred.'],
      ['fix', 'Atlas fish swim again, and on phones the Atlas opens on the species list.'],
    ],
  },
  {
    version: 'v0.15.4',
    date: '2026-09-02',
    title: 'Performance pass',
    changes: [
      ['fix', 'Faster loading and a steadier frame rate, especially on phones.'],
    ],
  },
  {
    version: 'v0.15.0',
    title: 'CRT interface',
    changes: [
      ['new', 'The interface looks like a monitor in an observation room: scanlines and pixel type.'],
      ['new', 'The Atlas is redesigned as a field guide, with a scale bar against a person.'],
      ['new', 'Tank list in the bottom-left corner, and a landing card you dive through to enter.'],
    ],
  },
  {
    version: 'v0.14.0',
    title: 'Swimming bodies',
    changes: [
      ['new', 'Fish bodies bend as they swim, with each species’ own stroke: quick sardines, powerful sharks.'],
    ],
  },
  {
    version: 'v0.13.0',
    title: 'Ocean surface',
    changes: [
      ['new', 'The water surface moves in waves and reflects the sky above.'],
    ],
  },
  {
    version: 'v0.12.x',
    title: 'Natural movement',
    changes: [
      ['new', 'Every creature swims with the same natural steering, so schools and loners move as one ocean.'],
      ['new', 'Larger sardine schools.'],
      ['new', 'Switching tanks and back finds the fish where you left them.'],
      ['fix', 'Fish no longer freeze in place.'],
    ],
  },
  {
    version: 'v0.11.0',
    title: 'Visual refinement',
    changes: [
      ['new', 'Smoother follow camera and a cleaner interface.'],
    ],
  },
  {
    version: 'v0.10.0',
    title: 'Schooling',
    changes: [
      ['new', 'Sardines school like real fish, keeping their neighbours close and turning together.'],
    ],
  },
  {
    version: 'v0.9.0',
    title: 'Tanks',
    changes: [
      ['new', 'Each tank holds its own community of species that live together in the wild.'],
    ],
  },
  {
    version: 'v0.8.x',
    title: 'Sunfish, mahi-mahi, mako and the Atlas',
    changes: [
      ['new', 'The Giant Sunfish, which rises to bask on its side at the surface.'],
      ['new', 'Mahi-mahi, with males and females that look different, and the Shortfin Mako Shark.'],
      ['new', 'The Atlas: a page for every species with its facts, size and conservation status.'],
      ['new', 'Deeper, darker water toward the bottom of the tank.'],
      ['fix', 'Follow mode stays steady and orbits smoothly, on desktop and phone.'],
    ],
  },
  {
    version: 'v0.7.x',
    title: 'Search, sound and screenshots',
    changes: [
      ['new', 'Search for a creature and follow it.'],
      ['new', 'Ocean ambience and interface sounds.'],
      ['new', 'Screenshot mode hides the interface.'],
      ['new', 'Sardines in their hundreds.'],
    ],
  },
  {
    version: 'v0.6.x',
    title: 'Following a fish',
    changes: [
      ['new', 'Tap a fish to follow it and read about it.'],
    ],
  },
  {
    version: 'v0.5.x',
    title: 'Early ocean',
    changes: [
      ['new', 'The first open-ocean tank: swimming fish, drifting bubbles, light and fog.'],
    ],
  },
]
