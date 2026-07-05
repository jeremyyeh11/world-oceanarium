export const WORLD_UNIT_METERS = 0.25

export const DEPTH_ZONES = [
  {
    id: 'epipelagic',
    name: 'Epipelagic',
    label: 'Epipelagic · Sunlight Zone',
    shortLabel: 'Sunlight Zone',
    depthRangeMeters: [0, 200],
  },
  {
    id: 'mesopelagic',
    name: 'Mesopelagic',
    label: 'Mesopelagic · Twilight Zone',
    shortLabel: 'Twilight Zone',
    depthRangeMeters: [200, 1000],
  },
  {
    id: 'bathypelagic',
    name: 'Bathypelagic',
    label: 'Bathypelagic · Midnight Zone',
    shortLabel: 'Midnight Zone',
    depthRangeMeters: [1000, 4000],
  },
]

export const BIOMES = [
  {
    id: 'tropical-river',
    name: 'Tropical River',
    tagline: 'Warm currents and lush overgrowth',
    color: '#2a6e3f',
    accent: '#5dd97a',
    icon: '🌿',
    description: 'Slow-moving tropical rivers winding through dense rainforest.',
  },
  {
    id: 'ocean',
    name: 'Pelagic Ocean',
    tagline: 'Open water from sunlight to midnight',
    color: '#0e4a7a',
    accent: '#4db8ff',
    icon: '🌊',
    description: 'Open-water ocean habitat organized by depth zones, from epipelagic sunlight to the dark pelagic depths.',
    zones: ['epipelagic', 'mesopelagic', 'bathypelagic'],
    defaultDepthZone: 'epipelagic',
  },
]

// Motion rhythm on each species — describes how the animal moves, independent of
// trophic role. Used to keep tanks coherent (see TANKS below).
//   'drift'  — slow, gelatinous, current-borne
//   'cruise' — steady glides, broad turns, occasional bursts
//   'sprint' — fast darting / schooling flicker
//
// A tank is a curated assemblage, not "everything in a biome". It borrows a biome
// for its environment (water, light, bubbles are keyed on biome id) but lists its
// cast explicitly. Drifters and fast swimmers must not share a tank — see the
// coherence guard in utils/speciesLookup.js.
export const TANKS = [
  {
    id: 'open-sea',
    name: 'The Open Sea',
    tagline: 'A blue-water pursuit',
    // One or two lines shown under the tank name above the switcher.
    description: 'Fast open-ocean hunters and their bait, from flickering sardinella to the cruising mako.',
    biome: 'ocean',
    depthZone: 'epipelagic',
    // seed varies the surface caustics + background mottle so each tank has a
    // distinct-but-stable sky/surface signature (see SceneLighting / WaterSurface).
    seed: 137,
    species: ['amblygaster-sirm', 'coryphaena-hippurus', 'isurus-oxyrinchus'],
  },
  {
    id: 'the-drift',
    name: 'The Drift',
    tagline: 'Slow grazers of the open blue',
    description: 'A calmer, dimmer column where soft-bodied giants drift on the current.',
    biome: 'ocean',
    depthZone: 'epipelagic',
    seed: 953,
    // Optional per-tank lighting overrides merged over the biome palette — a cheap
    // way to art-direct a tank's mood beyond the procedural seed variation.
    lighting: { exposure: 0.97, backgroundBeamAlpha: 0.1 },
    species: ['mola-alexandrini'],
  },
]

export const DEFAULT_TANK_ID = 'open-sea'

export const SPECIES = [
  {
    id: 'amblygaster-sirm',
    legacyIds: ['sardine'],
    name: 'Spotted Sardinella',
    scientificName: 'Amblygaster sirm',
    family: 'Clupeidae',
    alternateNames: ['Northern pilchard', 'Spotted pilchard', 'Spotted sardine', 'Trenched sardine'],
    biome: 'ocean',
    depthZone: 'epipelagic',
    schooling: true,
    repulser: false,
    aggressive: false,
    predator: false,
    tempo: 'sprint',
    conservationStatus: {
      system: 'IUCN Red List',
      code: 'LC',
      label: 'Least Concern',
    },
    atlasDetails: {
      commonDiet: 'Plankton, copepods, larvae.',
      foundIn: 'Indo-West Pacific coastal waters and lagoons.',
      sexualDimorphism: 'N/A',
      lifeSpan: 'Up to 8 years',
      maturityAge: '1 year (estimated)',
      social: {
        schoolSize: 'More than 1000',
        groupingBehaviour: 'Pelagic schooling fish in coastal waters and lagoons. Juveniles found closer inshore.',
        reproduction: 'Communal broadcast spawning. No pair bonding.',
      },
      averages: {
        maleSizeMeters: 0.20,
        femaleSizeMeters: 0.22,
        maleWeightKg: 0.05,
        femaleWeightKg: 0.07,
        maleLifeExpectancyYears: 8,
        femaleLifeExpectancyYears: 8,
      },
      lifecycle: {
        sexualMaturityYears: '1 year (estimated)',
        sexualSterilityYears: 'Unknown',
        offspringPerMatingEvent: '11,600 to 43,200 eggs',
      },
    },
    atlasSummary: {
      biome: 'Ocean',
      zone: 'Sunlight',
      diet: 'Copepods + larvae',
      social: 'Schooling',
    },
    description: 'A small, fast-schooling Indo-West Pacific sardinella with a slender silver body and a row of gold-to-dark flank spots. It lives in coastal waters and lagoons, feeding mostly on plankton, and reads in the tank as a quick flicker of many bodies rather than a lone specimen.',
    atlasThumbnail: '/atlas/amblygaster-sirm-thumbnail.png',
    adultLengthRangeMeters: [0.15, 0.27],
    maxBodyLengthMeters: 0.27,
    swim: {
      // World Oceanarium scale: 1 WU = 25 cm. A. sirm maximum total length ≈27 cm = 1.08 WU.
      bodyLengthWU: 1.08,
      // Keeps biologically grounded BL/s ratios readable in the aquarium camera.
      visualTimeScale: 0.35,
      idleBLPerSec: [1.0, 1.8],
      idleDriftBLPerSec: [0.18, 0.35],
      snapBLPerSec: [3.0, 5.0],
      burstBLPerSec: [5.0, 8.0],
      burstInterval: [5.5, 9.5],
      erraticness: 0.24,
      turnRadius: 0.78,
      // Turn radius in body lengths — nimble bait, but still arcs forward through turns.
      turnRadiusBodyLengths: 1.3,
      // Bait balls range through the upper column; deepened for vertical spread.
      boundsYMin: -10,
      boundsZMin: -15,
      boundsZMax: 8,
      boids: {
        neighborCap: 14,
        perceptionBodyLengths: 3.4,
        separationWeight: 0.38,
        alignmentWeight: 0.24,
        cohesionWeight: 0.16,
        maxWeight: 0.38,
        // Harmless bait, but very skittish — flees anything menacing (the mako most of all).
        menace: 0,
        wariness: 0.85,
      },
    },
    // Normalized individual size maps to roughly 15–27 cm total length for Amblygaster sirm.
    sizeRange: [0.55, 1.0],
    mass: {
      // Length-weight estimate: grams = coefficient * bodyLengthCm^exponent.
      coefficient: 0.006,
      exponent: 3,
    },
    model: {
      path: '/models/fish/sardine/sardine.glb',
      scale: 0.42,
      actionAnimationDurations: {
        burst: 1.39,
        snap_left: 1.12,
        snap_right: 1.12,
      },
    },
  },
  {
    id: 'coryphaena-hippurus',
    legacyIds: ['mahi-mahi', 'mahimahi', 'dolphinfish', 'dorado'],
    name: 'Mahi-mahi',
    scientificName: 'Coryphaena hippurus',
    family: 'Coryphaenidae',
    alternateNames: ['Common dolphinfish', 'Dorado'],
    biome: 'ocean',
    depthZone: 'epipelagic',
    schooling: true,
    repulser: false,
    aggressive: false,
    predator: true,
    tempo: 'cruise',
    conservationStatus: {
      system: 'IUCN Red List',
      code: 'LC',
      label: 'Least Concern',
    },
    atlasDetails: {
      commonDiet: 'Small fish, squid, crustaceans.',
      foundIn: 'Warm tropical and subtropical open ocean, often near floating cover.',
      sexualDimorphism: 'Males develop the tall blunt forehead/head profile; females keep a lower, more rounded head profile.',
      lifeSpan: 'Up to 5 years',
      maturityAge: '4 to 5 months',
      social: {
        schoolSize: '1 to 2',
        groupingBehaviour: 'Adults travel alone or in pairs, with occasional small loose groups near floating debris and weedlines. Juveniles may school in open water.',
        reproduction: 'Broadcast spawning in pairs or small groups in warm open water above 21°C. Multiple spawning events per season, around every 2 days; extended year-round season in the tropics.',
      },
      averages: {
        maleSizeMeters: 0.91,
        femaleSizeMeters: 0.91,
        maleWeightKg: 20,
        femaleWeightKg: 14,
        maleLifeExpectancyYears: 5,
        femaleLifeExpectancyYears: 5,
      },
      lifecycle: {
        sexualMaturityYears: '4 to 5 months',
        sexualSterilityYears: 'Reproductive until death',
        offspringPerMatingEvent: '80,000 to 1,000,000 eggs',
      },
    },
    atlasSummary: {
      biome: 'Ocean',
      zone: 'Sunlight',
      diet: 'Fish + squid',
      social: 'Solo / pairs',
    },
    atlasThumbnail: '/atlas/coryphaena-hippurus-thumbnail.png',
    description: 'A fast, flashing open-ocean hunter with a long dorsal fin, forked tail, and electric blue-green body that can flare brighter when excited. Adult Mahi-mahi cruise warm surface waters alone or in pairs, often gathering around floating cover before breaking into quick prey-chasing runs; juveniles may form larger schools.',
    adultLengthRangeMeters: [0.91, 1.8],
    maxBodyLengthMeters: 1.8,
    swim: {
      // World Oceanarium scale: 1 WU = 25 cm. Size 1.0 now maps to Jeremy's 1.8 m max body length.
      bodyLengthWU: 7.2,
      // Adult Mahi-mahi are rendered as loose pairs: sardine-style shared pathing,
      // capped at two fish, not a biological school.
      schoolMaxSize: 2,
      schoolSpacingScale: 5.2,
      schoolMaxAvoidanceAngleDegrees: 18,
      schoolDirectionResponse: 3.2,
      visualTimeScale: 0.48,
      idleBLPerSec: [0.28, 0.44],
      idleDriftBLPerSec: [0.05, 0.10],
      snapBLPerSec: [0.52, 0.76],
      burstBLPerSec: [1.05, 1.35],
      burstInterval: [8.0, 14.0],
      driftInterval: [10.0, 18.0],
      driftDuration: [3.0, 5.5],
      burstActionDuration: 1.6,
      turnActionDuration: 1.05,
      // Raised so gentle sustained arcs keep swimming on the looping idle clip (tail
      // waving) and bank via curve-deform, rather than firing the long non-looping
      // snap clip that froze the body in a C-curl. Only sharp turns trigger the snap.
      turnTriggerThreshold: 0.3,
      erraticness: 0.08,
      turnRadius: 1.45,
      // Cruiser: broad, committed turns.
      turnRadiusBodyLengths: 1.6,
      speedMultiplier: 1.0,
      movementBoundsScale: 1.18,
      boundsUseSpeciesSize: false,
      // Surface-associated (often near floating cover) — stays in the upper column.
      boundsYMin: -7,
      boundsZMin: -23,
      boundsZMax: 4,
      boids: {
        neighborCap: 1,
        perceptionBodyLengths: 2.1,
        separationWeight: 0.18,
        alignmentWeight: 0.05,
        cohesionWeight: 0.025,
        maxWeight: 0.18,
        // A capable mid predator: mildly menacing to bait, moderately wary of the mako.
        menace: 0.4,
        wariness: 0.5,
      },
    },
    // Normalized individual size maps directly to the 0–1 share of the 1.8 m max; DB rows use a truncated normal distribution centered near the 0.91 m average.
    sizeRange: [0, 1],
    mass: {
      // Broad length-weight placeholder tuned for readable card weights until curated fishery data lands.
      coefficient: 0.005,
      exponent: 3,
    },
    model: {
      path: '/models/fish/mahi-mahi/mahi-mahi_male.glb',
      sexVariants: {
        male: { path: '/models/fish/mahi-mahi/mahi-mahi_male.glb' },
        female: { path: '/models/fish/mahi-mahi/mahi-mahi_female.glb' },
      },
      // Source GLB is ~9.79 units nose-to-tail; scale maps size 1.0 to the 1.8 m / 7.2 WU max.
      scale: 0.735,
      moveset: {
        cruise: 'idle',
        drift: 'idle',
        // Turns stay on the looping idle swim clip and bank via curve-deform (same as the
        // mako). The old snap_left/snap_right were 5.61s non-looping turn-sweep clips that
        // replayed through a sustained wide-arc turn, sweeping the tail over and over
        // (reading as the tail spinning in circles).
        turnLeft: 'idle',
        turnRight: 'idle',
        burst: 'burst',
      },
      animationFadeDuration: 0.16,
      animationTimeScale: 1,
      lockAnimationPlayback: true,
      actionAnimationDurations: {
        burst: 5.61,
        snap_left: 5.61,
        snap_right: 5.61,
      },
      actionMovementDelayOverrides: {
        burst: 0.8,
      },
      loopAnimations: ['idle'],
      curveDeform: {
        bones: ['spine.003', 'spine.004', 'spine.005', 'spine.006', 'spine.007'],
        axis: 'z',
        strength: 1.0,
        // Kept gentle: the mahi drives its bend from sustained heading misalignment
        // (turnIntent), unlike the mako which uses only the tiny per-frame turn rate. A
        // wide-arc turn holds a large misalignment, so a high maxAngle × 5 spine bones
        // saturated into a held C-curl. Lower per-bone max + drive so it reads as a
        // subtle banana-bank through the turn, not a curl.
        maxAngleDegrees: 8,
        response: 8.5,
        tailBias: 0.85,
        baseWeight: 0.28,
        chainMultiplier: 1.05,
        turnIntentScale: 0.25,
        burstBoost: 0.72,
        speedBoost: 0.28,
        // Ease the bend back to straight when forward travel slows (e.g. crawling out of
        // a turn), so the tail straightens before the mahi swims on rather than holding a
        // full sideways bend while barely moving.
        easeStraightenBySpeed: true,
        straightenFloor: 0.1,
      },
      debugForwardOrigin: 'head',
      // GLB origin sits near mid-body; nose is at +4.55 / 9.79 of the source length.
      debugForwardOffsetRatio: 0.465,
    },
  },
  {
    id: 'isurus-oxyrinchus',
    legacyIds: ['shortfin-mako', 'short-fin-mako', 'mako-shark'],
    name: 'Shortfin Mako Shark',
    scientificName: 'Isurus oxyrinchus',
    family: 'Lamnidae',
    alternateNames: ['Shortfin mako', 'Blue pointer', 'Bonito shark'],
    biome: 'ocean',
    depthZone: 'epipelagic',
    schooling: false,
    repulser: true,
    aggressive: false,
    predator: true,
    tempo: 'cruise',
    conservationStatus: {
      system: 'IUCN Red List',
      code: 'EN',
      label: 'Endangered',
    },
    atlasDetails: {
      commonDiet: 'Fish, squid, other fast pelagic prey.',
      foundIn: 'Temperate and tropical open ocean, from surface waters into deeper offshore zones.',
      sexualDimorphism: 'Females grow larger than males.',
      lifeSpan: 'Up to 32 years',
      maturityAge: 'Males 7 to 9 years; females 18 to 21 years',
      social: {
        schoolSize: 1,
        groupingBehaviour: 'Mostly solitary open-ocean predator, occasionally near prey concentrations.',
        reproduction: 'Internal fertilization with live young; embryos develop in the uterus and feed on unfertilized eggs. No parental care after birth.',
      },
      averages: {
        maleSizeMeters: 2.0,
        femaleSizeMeters: 2.8,
        maleWeightKg: 60,
        femaleWeightKg: 140,
        maleLifeExpectancyYears: 29,
        femaleLifeExpectancyYears: 32,
      },
      lifecycle: {
        sexualMaturityYears: 'Males 7 to 9 years; females 18 to 21 years',
        sexualSterilityYears: 'Unknown',
        offspringPerMatingEvent: '4 to 25 pups',
      },
    },
    atlasSummary: {
      biome: 'Ocean',
      zone: 'Sunlight',
      diet: 'Fish + squid',
      social: 'Solitary',
    },
    description: 'A lean, metallic-blue lamnid built for fast open-water pursuit. The shortfin mako should read as a committed pelagic hunter: long glides, rare sharp acceleration, and broad turns that carry its body through the water rather than twitching like a small schooling fish.',
    atlasThumbnail: '/atlas/isurus-oxyrinchus-thumbnail.png',
    adultLengthRangeMeters: [2.0, 4.0],
    maxBodyLengthMeters: 4.0,
    swim: {
      // World Oceanarium scale: 1 WU = 25 cm. Review max maps 4.0 m to 16 WU.
      bodyLengthWU: 16,
      visualTimeScale: 0.38,
      idleBLPerSec: [0.16, 0.24],
      idleDriftBLPerSec: [0.03, 0.055],
      snapBLPerSec: [0.24, 0.36],
      burstBLPerSec: [0.44, 0.66],
      burstInterval: [18.0, 30.0],
      driftInterval: [18.0, 30.0],
      driftDuration: [5.0, 8.0],
      burstActionDuration: 4.8,
      turnActionDuration: 3.2,
      turnTriggerThreshold: 0.042,
      erraticness: 0.018,
      turnRadius: 1.32,
      // Apex pelagic shark: long glides and wide banking turns, never a pivot.
      turnRadiusBodyLengths: 1.4,
      speedMultiplier: 1.0,
      movementBoundsScale: 1.48,
      soloSteeringTurnRateDegrees: 6,
      soloTargetVerticalBodyLengths: 0.18,
      boundsUseSpeciesSize: false,
      // Ranges from the surface into deeper offshore water — deep diver.
      boundsYMin: -14,
      boundsZMin: -36,
      boundsZMax: 4,
      boids: {
        // Apex solo hunter: sees few neighbors, is unbothered by others, but reads as
        // maximally menacing so nearly everything else steers away from it.
        neighborCap: 3,
        perceptionBodyLengths: 1.4,
        separationWeight: 0.05,
        alignmentWeight: 0,
        cohesionWeight: 0,
        maxWeight: 0.06,
        selfAvoidanceScale: 0.1,
        menace: 0.95,
        wariness: 0.08,
      },
    },
    // Review spread maps individuals to roughly 2.6–4.0 m while the Atlas shows the species maximum.
    sizeRange: [0.65, 1.0],
    mass: {
      // Broad length-weight placeholder until curated shark body-condition data lands.
      coefficient: 0.004,
      exponent: 3,
    },
    model: {
      path: '/models/fish/isurus-oxyrinchus/isurus-oxyrinchus.glb',
      // Source GLB is ~40.18 units nose-to-tail; scale maps size 1.0 to 4.0 m / 16 WU.
      scale: 0.398,
      moveset: {
        cruise: 'idle',
        drift: 'idle',
        turnLeft: 'idle',
        turnRight: 'idle',
        // Layer the authored burst clip softly over the continuous swim base so the
        // body action is visible without the old full-pose snap into the clip.
        burst: 'burst',
      },
      layeredAnimations: true,
      layeredBaseAnimation: 'idle',
      layeredBaseWeight: 1,
      layeredOverlayWeight: 0.42,
      animationFadeDuration: 1.25,
      animationTimeScale: 1.28,
      actionAnimationDurations: {
        burst: 6.2,
      },
      actionMovementDelayOverrides: {
        burst: 0.75,
      },
      loopAnimations: ['idle'],
      curveDeform: {
        bones: ['spine.003', 'spine.004', 'spine.005', 'spine.006'],
        axis: 'z',
        strength: 1.1,
        maxAngleDegrees: 12,
        response: 4.8,
        tailBias: 0.72,
        baseWeight: 0.18,
        chainMultiplier: 1.04,
        turnIntentScale: 3.6,
        burstBoost: 0.38,
        speedBoost: 0.18,
        idleSwayDegrees: 3.6,
        idleSwaySpeed: 2.1,
        idleSwayPhaseOffset: 1.45,
        idleSwaySpeedBoost: 0.35,
      },
      debugForwardOrigin: 'head',
      // Nose is near +28.02 over the ~40.18 source-length span.
      debugForwardOffsetRatio: 0.697,
    },
  },
  {
    id: 'mola-alexandrini',
    legacyIds: ['mola-mola'],
    legacyNames: ['Ocean Sunfish', 'Bumphead Sunfish'],
    name: 'Giant Sunfish',
    scientificName: 'Mola alexandrini',
    family: 'Molidae',
    alternateNames: ["Bumphead sunfish", "Bump-head sunfish", "Ramsay's sunfish", 'Southern ocean sunfish', 'Southern sunfish', 'Short sunfish'],
    biome: 'ocean',
    depthZone: 'epipelagic',
    schooling: false,
    repulser: true,
    aggressive: false,
    predator: false,
    tempo: 'drift',
    conservationStatus: {
      system: 'IUCN Red List',
      code: 'NE',
      label: 'Not Evaluated',
    },
    atlasDetails: {
      commonDiet: 'Jellyfish, salps, soft-bodied prey.',
      foundIn: 'Open ocean outside polar regions.',
      sexualDimorphism: 'N/A',
      lifeSpan: 'Unknown',
      maturityAge: 'Unknown',
      social: {
        schoolSize: 1,
        groupingBehaviour: 'Adults are reported to travel mainly alone or in pairs, and sometimes in groups. Juveniles loosely school for predator protection, dispersing at maturity.',
        reproduction: 'Broadcast spawning in open water; adults briefly aggregate to spawn. No parental care.',
      },
      averages: {
        maleSizeMeters: 2.5,
        femaleSizeMeters: 3.3,
        maleWeightKg: 1000,
        femaleWeightKg: 2300,
        maleLifeExpectancyYears: 20,
        femaleLifeExpectancyYears: 20,
      },
      lifecycle: {
        sexualMaturityYears: 'Unknown',
        sexualSterilityYears: 'Unknown',
        offspringPerMatingEvent: 'More than 300,000,000 eggs',
      },
    },
    atlasSummary: {
      biome: 'Ocean',
      zone: 'Sunlight',
      diet: 'Soft-bodied prey',
      social: 'Solitary',
    },
    description: 'The giant sunfish rows its tall dorsal and anal fins together, usually traveling alone through open water after maturity. Also known as the bumphead sunfish and Ramsay\'s sunfish, it can briefly aggregate to broadcast spawn before returning to solitary cruising, deep soft-bodied prey hunts, and sideways surface basking.',
    adultLengthRangeMeters: [1.6, 3.3],
    maxBodyLengthMeters: 3.3,
    atlasThumbnail: '/atlas/mola-alexandrini-thumbnail.png',
    swim: {
      // World Oceanarium scale: 1 WU = 25 cm. Adults render at their factual size:
      // Mola alexandrini reaches ~3.3 m total length = 13.2 WU (matches the Atlas female average).
      bodyLengthWU: 13.2,
      visualTimeScale: 1.0,
      idleBLPerSec: [0.0624, 0.1104],
      idleDriftBLPerSec: [0.010, 0.020],
      snapBLPerSec: [0.085, 0.12],
      burstBLPerSec: [0.15, 0.2175],
      burstInterval: [13.0, 20.0],
      driftInterval: [20.0, 34.0],
      driftDuration: [7.0, 12.0],
      burstActionDuration: 10.0,
      turnActionDuration: 10.0,
      turnTriggerThreshold: 0.0045,
      erraticness: 0.055,
      turnRadius: 1.0,
      // Slow gelatinous drifter: gentle, wide turns.
      turnRadiusBodyLengths: 1.2,
      speedMultiplier: 1.0,
      movementBoundsScale: 1.35,
      boundsBodyLengthWU: 1.08,
      boundsUseSpeciesSize: false,
      // Basks at the surface but also makes deep dives — full-column diver.
      boundsYMin: -14,
      boundsZMin: -25,
      boundsZMax: 0,
      boids: {
        neighborCap: 4,
        perceptionBodyLengths: 1.25,
        separationWeight: 0.05,
        alignmentWeight: 0,
        cohesionWeight: 0,
        maxWeight: 0.05,
        selfAvoidanceScale: 0.04,
        repulsionScale: 2.8,
        // A gentle giant: harmless, so nobody flees it, and it barely reacts to anything.
        menace: 0.03,
        wariness: 0.12,
      },
    },
    // Normalized individual size maps to roughly 248–330 cm total length (male average → female maximum).
    sizeRange: [0.75, 1.0],
    mass: {
      // Broad placeholder estimate until curated species/body-condition data lands.
      coefficient: 0.018,
      exponent: 3,
    },
    model: {
      path: '/models/fish/mola-alexandrini/mola-alexandrini.glb',
      // Blender +Z exports as GLB +Y, so this asset's GLB axes are +Y up and +Z forward.
      // The fish root also uses +Y up and +Z swim-forward, so no extra child rotation is needed.
      rotation: [0, 0, 0],
      // Source body length is ~20.69 model units; scale maps size 1.0 to 3.3 m / 13.2 WU max.
      scale: 0.638,
      moveset: {
        cruise: 'slow_cruise',
        drift: 'idle_drift',
        turnLeft: 'bank_l',
        turnRight: 'bank_r',
        burst: 'burst',
        sunBaskLeft: 'sun_bask_r',
        sunBaskRight: 'sun_bask_l',
      },
      layeredAnimations: true,
      layeredBaseAnimation: 'slow_cruise',
      layeredOverlayAnimations: ['idle_drift', 'bank_l', 'bank_r', 'burst', 'sun_bask_l', 'sun_bask_r'],
      layeredBaseWeight: 0.62,
      layeredOverlayWeight: 0.72,
      animationFadeDuration: 0.55,
      loopAnimations: ['idle_drift', 'slow_cruise', 'sun_bask_l', 'sun_bask_r'],
    },
    placeholder: {
      type: 'mola-mola',
      bodyColor: '#8fb8bc',
      finColor: '#6f9fa4',
    },
  },
]

export const CREATURES = [
  ...Array.from({ length: 88 }, (_, index) => ({
    id: index + 1,
    species: 'amblygaster-sirm',
    biome: 'ocean',
    depthZone: 'epipelagic',
    bornAt: index === 0 ? '2026-05-13T00:00:00Z' : '2026-05-17T00:00:00Z',
    alive: true,
    sex: (index + 1) % 2 === 0 ? 'female' : 'male',
  })),
  {
    id: 89,
    species: 'mola-alexandrini',
    biome: 'ocean',
    depthZone: 'epipelagic',
    bornAt: '2026-05-26T00:00:00Z',
    alive: true,
    sex: 'male',
  },
  ...[0.338, 0.398, 0.44, 0.476].map((size, index) => ({
    id: 90 + index,
    species: 'coryphaena-hippurus',
    biome: 'ocean',
    depthZone: 'epipelagic',
    bornAt: `2026-06-08T07:1${index}:00Z`,
    alive: true,
    sex: index % 2 === 0 ? 'male' : 'female',
    size,
  })),
  {
    id: 94,
    species: 'isurus-oxyrinchus',
    biome: 'ocean',
    depthZone: 'epipelagic',
    bornAt: '2026-07-02T00:00:00Z',
    alive: true,
    sex: 'female',
    size: 0.82,
  }
]
