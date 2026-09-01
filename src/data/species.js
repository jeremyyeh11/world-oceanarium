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
      // Turn radius in body lengths — nimble bait, but still arcs forward through turns.
      turnRadiusBodyLengths: 2.0,
      // Bait balls range through the upper column; deepened for vertical spread.
      boundsYMin: -10,
      boundsZMin: -15,
      boundsZMax: 8,
      boids: {
        neighborCap: 14,
        perceptionBodyLengths: 3.4,
        // Boids-only model: strong alignment keeps the bait ball heading generally one way,
        // moderate cohesion + lighter separation keep it a tight-but-not-packed cloud (sparser
        // than the old spline ball, denser than a loose scatter). The formation slot supplies
        // the 3D shape so separation no longer needs to be cranked up to avoid a conga line.
        separationWeight: 0.30,
        alignmentWeight: 0.38,
        cohesionWeight: 0.20,
        maxWeight: 0.70,
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
      path: '/models/fish/sardine/sardine_static.glb',
      scale: 0.42,
      moveset: {
        cruise: 'procedural_cruise',
        drift: 'procedural_drift',
        turnLeft: 'procedural_turn_left',
        turnRight: 'procedural_turn_right',
        burst: 'procedural_burst',
      },
      proceduralAnimation: {
        type: 'caudal-vertex',
        sourceAxis: 'x',
        lateralAxis: 'z',
        tailAtMaxZ: false,
        amplitude: 0.065,
        waveSpeed: 5.2,
        waveTravel: 5.6,
        flexStart: 0.15,
        flexFull: 0.82,
        turnStrength: 0.04,
        burstAmplitude: 0.9,
        response: 11,
        speedFrequencyBoost: 0.5,
        burstFrequencyBoost: 0.42,
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
      // Raised from 0.48: mahi are fast open-water cruisers in reality and should
      // visibly outpace bait/drifters, not match their speed.
      visualTimeScale: 0.75,
      // Glide near-level. At the faster cruise speed the mahi tracks the vertical waviness of
      // its path eagerly enough to bob its nose up and down toward the generic ~13° limit;
      // with the follow-cam centring it, that pitch bob was the only apparent motion and read
      // as the fish hovering in place staring up and down. Cap it to a gentle glide.
      maxVisualPitchDegrees: 6,
      // The rendered heading must be the actual forward-moving pair trajectory, not a
      // faster visual smoothing pass that can make the long body pivot on its own.
      visualHeadingFollowsMotion: true,
      idleBLPerSec: [0.35, 0.55],
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
      // Cruiser turns, but sized to the mahi's confined upper-column bounds. The old 2.8 gave a
      // ~20 WU turn radius in a ~27 WU-wide box, so a pair that reached a wall/corner could not
      // out-turn it and just orbited in place (a constant curve that cocked the tails). 1.3 keeps
      // a broad, committed arc that still fits the box, so the mahi carves away and straightens.
      turnRadiusBodyLengths: 1.3,
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
        male: {
          path: '/models/fish/mahi-mahi/mahi-mahi_male_static_parts.glb',
          // Static, rig-free asset supplied for the procedural test. Longitudinal
          // influence derives from local Z bounds; no authored mask or skin weight.
          proceduralAnimation: {
            type: 'caudal-vertex',
            bodyMeshNames: ['mahi-combined'],
            sourceAxis: 'z',
            lateralAxis: 'x',
            tailAtMaxZ: true,
            amplitude: 0.42,
            waveSpeed: 2.6,
            // Mahi is a smaller, fast carangiform swimmer: hold the front firm and
            // confine the stroke to a compact rear-body C/flick instead of a shark S.
            waveTravel: 3.5,
            flexStart: 0.24,
            flexFull: 0.82,
            turnStrength: 0.32,
            burstAmplitude: 0.8,
            response: 7.5,
            speedFrequencyBoost: 0.32,
            burstFrequencyBoost: 0.24,
            pectoralFinFlutter: 0.13,
            pelvicFinFlutter: 0.075,
          },
        },
        female: {
          path: '/models/fish/mahi-mahi/mahi-mahi_female_static_parts.glb',
          proceduralAnimation: {
            type: 'caudal-vertex',
            bodyMeshNames: ['mahi-female'],
            sourceAxis: 'z',
            lateralAxis: 'x',
            tailAtMaxZ: true,
            amplitude: 0.4,
            waveSpeed: 2.55,
            // Keep the female's compact tail-led stroke matched to the male, without
            // giving this smaller pelagic fish the mako's long S silhouette.
            waveTravel: 3.5,
            flexStart: 0.24,
            flexFull: 0.82,
            turnStrength: 0.3,
            burstAmplitude: 0.78,
            response: 7.5,
            speedFrequencyBoost: 0.32,
            burstFrequencyBoost: 0.24,
            pectoralFinFlutter: 0.13,
            pelvicFinFlutter: 0.075,
          },
        },
      },
      // Source GLB is ~9.79 units nose-to-tail; scale maps size 1.0 to the 1.8 m / 7.2 WU max.
      scale: 0.735,
      // Head-end spine bone used as the follow-cam aim point (shared by both sex variants).
      followBone: 'spine001',
      moveset: {
        cruise: 'procedural_cruise',
        drift: 'procedural_drift',
        turnLeft: 'procedural_turn_left',
        turnRight: 'procedural_turn_right',
        burst: 'procedural_burst',
      },
      proceduralAnimation: {
        bones: ['spine.003', 'spine.004', 'spine.005', 'spine.006', 'spine.007'],
        axis: 'z',
        strength: 0.45,
        maxAngleDegrees: 8,
        response: 8.5,
        tailBias: 0.85,
        baseWeight: 0.28,
        chainMultiplier: 1.05,
        turnIntentScale: 0,
        burstBoost: 0.72,
        speedBoost: 0.28,
        accelerationBoost: 0.12,
        speedFrequencyBoost: 0.32,
        burstFrequencyBoost: 0.24,
        // Ease the bend back to straight when forward travel slows (e.g. crawling out of
        // a turn), so the tail straightens before the mahi swims on rather than holding a
        // full sideways bend while barely moving.
        easeStraightenBySpeed: true,
        straightenFloor: 0.1,
        idleSwayDegrees: 3.2,
        idleSwaySpeed: 2.35,
        idleSwayPhaseOffset: 1.2,
        idleSwaySpeedBoost: 0.42,
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
      // Raised from 0.38 to 0.95 (~2.5×) so the mako clearly leads the tank at roughly the
      // real mako-vs-mahi cruise ratio (~1.5×). This speed used to make it overshoot the
      // solo-agent boundary envelope on U-turns and get snapped back inward (reading as
      // strafing backward); it is now held cleanly by the predictive boundary-avoidance
      // steering in Fish.jsx (boundaryAvoidanceTurnStep), so it keeps its wide banking
      // turns in open water and simply carves tighter as it nears a wall.
      visualTimeScale: 0.95,
      // The shark's visual nose/heading must stay welded to its turn-capped patrol arc.
      // Do not visually rotate it ahead of its body translation near walls or on U-turns.
      visualHeadingFollowsMotion: true,
      // Mako never settles into a hover/drift beat: it continually patrols forward,
      // with only a small speed-breathing variation around its 20%-faster cruise.
      driftEnabled: false,
      idleBLPerSec: [0.24, 0.36],
      idleDriftBLPerSec: [0.036, 0.066],
      snapBLPerSec: [0.288, 0.432],
      burstBLPerSec: [0.528, 0.792],
      burstInterval: [18.0, 30.0],
      burstActionDuration: 4.8,
      turnActionDuration: 3.2,
      turnTriggerThreshold: 0.042,
      erraticness: 0.018,
      // Apex pelagic shark: long glides and wide banking turns, never a pivot. Sized to the
      // tightened bounds below (the old 2.6 gave a ~41 WU radius that could not out-turn the
      // envelope and overshot into hard clamps at the tank edges); 1.7 keeps a broad, committed
      // arc that still fits so the mako carves away cleanly instead of snapping back.
      turnRadiusBodyLengths: 1.7,
      speedMultiplier: 1.0,
      // Pulled in from 1.48 / z -36 so the mako stays a visible presence in the main tank instead
      // of roaming far off-screen most of the time; still the widest-ranging fish in the tank.
      movementBoundsScale: 1.22,
      soloTargetVerticalBodyLengths: 0.18,
      boundsUseSpeciesSize: false,
      // Ranges from the surface into deeper offshore water — deep diver.
      boundsYMin: -14,
      boundsZMin: -26,
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
      path: '/models/fish/isurus-oxyrinchus/isurus-oxyrinchus_static_parts.glb',
      // Source GLB is ~40.18 units nose-to-tail; scale maps size 1.0 to 4.0 m / 16 WU.
      scale: 0.398,
      moveset: {
        cruise: 'procedural_cruise',
        drift: 'procedural_drift',
        turnLeft: 'procedural_turn_left',
        turnRight: 'procedural_turn_right',
        burst: 'procedural_burst',
      },
      proceduralAnimation: {
        type: 'caudal-vertex',
        bodyMeshNames: ['shortfinmako003'],
        sourceAxis: 'z',
        lateralAxis: 'x',
        tailAtMaxZ: true,
        amplitude: 0.82,
        // Large lamnid power: a strong travelling phase runs from the mid-body into a
        // counter-curving tail. This exposes a broad S silhouette while the head stays
        // on intent, rather than making the entire shark undulate like an eel.
        waveSpeed: 1.86,
        waveTravel: 7.4,
        flexStart: 0.18,
        flexFull: 0.86,
        turnStrength: 0.58,
        burstAmplitude: 0.82,
        response: 4.8,
        speedFrequencyBoost: 0.28,
        burstFrequencyBoost: 0.22,
        // Pelvic fins are welded into shortfinmako003 in the supplied replacement
        // GLB, so they ride the same continuous body wave and cannot detach.
        pectoralFinFlutter: 0.06,
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
      // Slow gelatinous drifter: gentle, wide turns.
      turnRadiusBodyLengths: 2.0,
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
      // Jeremy's static GLB retains the established world bounds and +Z swim-forward
      // orientation, while color_1 encodes dorsal/anal/clavus/pectoral motion masks.
      rotation: [0, 0, 0],
      scale: 0.638,
      moveset: {
        cruise: 'procedural_cruise',
        drift: 'procedural_drift',
        turnLeft: 'procedural_turn_left',
        turnRight: 'procedural_turn_right',
        burst: 'procedural_burst',
        sunBaskLeft: 'procedural_sun_bask_left',
        sunBaskRight: 'procedural_sun_bask_right',
      },
      proceduralAnimation: {
        type: 'mola-mask-vertex',
        bodyMeshNames: ['10001003'],
        // COLOR_0 remains white material data. Blender exported the painted mask as
        // COLOR_1, exposed by Three as color_1: R dorsal, G anal, B clavus, RGB-grey pectorals.
        maskAttribute: 'color_1',
        waveSpeed: 0.92,
        // Dorsal/anal masks bend together around scene-local Y (export local Z):
        // a broad sideways scull,
        // not a tail-fish fore/aft compression stroke.
        finYawRadians: 0.46,
        pectoralAmplitude: 0.014,
        clavusAmplitude: 0.016,
        turnStrength: 0.012,
        burstAmplitude: 0.38,
        response: 3.2,
        speedFrequencyBoost: 0.22,
        burstFrequencyBoost: 0.18,
      },
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
