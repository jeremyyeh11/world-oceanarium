import { RIDE_ANCHORS } from './rideAnchors.js'

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
    species: [
      'amblygaster-sirm',
      'coryphaena-hippurus',
      'isurus-oxyrinchus',
      // Remoras. The sharksuckers and the common remora ride the mako; the white suckerfish,
      // marlinsucker, and slender suckerfish only occasionally; the whalesucker swims free
      // until a whale or dolphin joins the tank.
      'echeneis-naucrates',
      'echeneis-neucratoides',
      'remora-remora',
      'remora-albescens',
      'remora-australis',
      'remora-osteochir',
      'phtheirichthys-lineatus',
    ],
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
    // The spearfish remora rides the Mola; it is recorded on ocean sunfishes as well as billfish.
    species: ['mola-alexandrini', 'remora-brachyptera'],
  },
]

export const DEFAULT_TANK_ID = 'open-sea'

// Shared free-swimming profile for the remoras (Echeneidae). Off a host they are steady,
// agile swimmers, not sprinters; they never hover (they need water moving over the gills),
// and they read a shark as a ride, not a threat — hence near-zero wariness. Riding itself is
// the `hitchhiker` block on each species; see the ride section of fishSwim.js.
const REMORA_SWIM = {
  visualTimeScale: 0.6,
  driftEnabled: false,
  idleBLPerSec: [0.55, 0.85],
  idleDriftBLPerSec: [0.08, 0.16],
  snapBLPerSec: [0.9, 1.3],
  burstBLPerSec: [1.8, 2.6],
  burstInterval: [9.0, 16.0],
  burstActionDuration: 0.9,
  turnActionDuration: 0.6,
  erraticness: 0.12,
  turnRadiusBodyLengths: 1.2,
  speedMultiplier: 1.0,
  boundsUseSpeciesSize: false,
  boids: {
    neighborCap: 4,
    perceptionBodyLengths: 2.0,
    separationWeight: 0.2,
    alignmentWeight: 0,
    cohesionWeight: 0,
    maxWeight: 0.2,
    menace: 0.08,
    wariness: 0.05,
  },
}
// Riders share their host's swim volume, so every anchor on it stays reachable.
const OPEN_SEA_RIDER_BOUNDS = { movementBoundsScale: 1.22, boundsYMin: -14, boundsZMin: -26, boundsZMax: 4 }
const DRIFT_RIDER_BOUNDS = { movementBoundsScale: 1.35, boundsYMin: -14, boundsZMin: -25, boundsZMax: 0 }
// Length–weight for the slender echeneid body, fitted to the two published maxima:
// Echeneis naucrates 2.3 kg at 110 cm and Remora remora 1.1 kg at 86.4 cm (both ≈0.0017).
const REMORA_MASS = { coefficient: 0.0017, exponent: 3 }
// Stand-in model until the real GLBs land: generated by scripts/build-remora-placeholders.mjs
// to the same asset contract (unit length along Z, nose -Z, up +Y, origin mid-body, one body
// mesh) and animated through the real caudal-vertex wave. Swapping in a supplied model is a
// path/scale/mesh-name edit here plus a verifier target.
const REMORA_CAUDAL = {
  type: 'caudal-vertex',
  bodyMeshNames: ['remora-placeholder'],
  sourceAxis: 'z',
  lateralAxis: 'x',
  tailAtMaxZ: true,
  // Unit-length source, so amplitude is a fraction of body length (sardinella ≈0.036,
  // mahi ≈0.043 on the same measure).
  amplitude: 0.07,
  // A slow beat and a long wave: one gentle bend travelling down the body, not an eel's S
  // (4.4 and 4.6 read as snakes in Jeremy's review, 2026-09-28).
  waveSpeed: 3.0,
  waveTravel: 3.2,
  // The wave starts just ahead of the pectoral fins (0.18 of the length), so head and body
  // read as one piece; the disc rides the nearly still front.
  flexStart: 0.14,
  flexFull: 0.86,
  turnStrength: 0.03,
  burstAmplitude: 0.8,
  response: 8,
  speedFrequencyBoost: 0.4,
  burstFrequencyBoost: 0.3,
}
function remoraPlaceholderModel(id, bodyLengthWU) {
  return {
    path: `/models/fish/${id}/${id}_placeholder.glb`,
    // Source length is 1, so the scale is the body length in WU.
    scale: bodyLengthWU,
    followAim: 'root',
    moveset: {
      cruise: 'procedural_cruise',
      drift: 'procedural_drift',
      turnLeft: 'procedural_turn_left',
      turnRight: 'procedural_turn_right',
      burst: 'procedural_burst',
    },
    proceduralAnimation: REMORA_CAUDAL,
    debugForwardOrigin: 'head',
    debugForwardOffsetRatio: 0.5,
  }
}

export const SPECIES = [
  {
    id: 'amblygaster-sirm',
    legacyIds: ['sardine'],
    name: 'Spotted Sardinella',
    scientificName: 'Amblygaster sirm',
    family: 'Dorosomatidae',
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
      maxLengthLabel: 'Standard length',
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
      // World Oceanarium scale: 1 WU = 25 cm. A. sirm maximum standard length ≈27 cm = 1.08 WU.
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
      // Up to just under the water surface (SURFACE_PLANE_Y 4.6), where bait balls really do end up.
      // The epipelagic band stopped them at 2.83, an invisible ceiling 1.8 WU below the surface
      // that a school driven upward flattened against.
      boundsYMax: 3.9,
      boundsZMin: -15,
      boundsZMax: 8,
      boids: {
        // Nearest six, not fourteen: studies of schooling fish find a fish's one or two nearest
        // neighbours dominate how it moves (Katz et al. 2011), so averaging over fourteen blurred
        // the local interactions a school is made of.
        neighborCap: 6,
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
    // Normalized individual size maps to roughly 15–27 cm standard length for Amblygaster sirm.
    sizeRange: [0.55, 1.0],
    mass: {
      // Length-weight estimate: grams = coefficient * bodyLengthCm^exponent.
      coefficient: 0.006,
      exponent: 3,
    },
    model: {
      path: '/models/fish/sardine/sardine_static.glb',
      scale: 0.42,
      // Rig-free static mesh: follow the moving Fish root, never an AABB center or bone.
      followAim: 'root',
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
      lifeSpan: 'Up to 4 years',
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
        maleLifeExpectancyYears: 4,
        femaleLifeExpectancyYears: 4,
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
    adultLengthRangeMeters: [0.91, 2.1],
    maxBodyLengthMeters: 2.1,
    swim: {
      // World Oceanarium scale: 1 WU = 25 cm. Size 1.0 now maps to Jeremy's 2.1 m max body length.
      bodyLengthWU: 8.4,
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
    // Normalized individual size maps directly to the 0–1 share of the 2.1 m max; DB rows use a truncated normal distribution centered near the 0.91 m average.
    sizeRange: [0, 1],
    mass: {
      // Broad length-weight placeholder tuned for readable card weights until curated fishery data lands.
      coefficient: 0.005,
      exponent: 3,
    },
    model: {
      // Base/fallback model, used only when a creature's sex matches no sexVariant
      // below. It points at the male static mesh rather than a rigged one so the
      // deprecated mahi-mahi_male.glb could be dropped: both variants are static
      // now, so nothing else referenced it.
      path: '/models/fish/mahi-mahi/mahi-mahi_male_static_parts.glb',
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
      // Source GLB is ~9.79 units nose-to-tail; scale maps size 1.0 to the 2.1 m / 8.4 WU max.
      scale: 0.858,
      // Both sex variants are rig-free static meshes; aim follow at the moving Fish root.
      // Keep the legacy name for compatibility with a future rigged variant, where it wins.
      followAim: 'root',
      followBone: 'spine001',
      moveset: {
        cruise: 'procedural_cruise',
        drift: 'procedural_drift',
        turnLeft: 'procedural_turn_left',
        turnRight: 'procedural_turn_right',
        burst: 'procedural_burst',
      },
      // Matches the male variant's config. This has to stay in step with the base
      // `path` above: it previously drove a bone chain (`spine.003`..`spine.007`),
      // which only worked because the base pointed at the rigged mahi-mahi_male.glb.
      // The static meshes carry no bones, so a bone-driven config here would leave
      // any creature that fell through to the base rendering completely still.
      proceduralAnimation: {
        type: 'caudal-vertex',
        bodyMeshNames: ['mahi-combined'],
        sourceAxis: 'z',
        lateralAxis: 'x',
        tailAtMaxZ: true,
        amplitude: 0.42,
        waveSpeed: 2.6,
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
    adultLengthRangeMeters: [2.0, 4.45],
    maxBodyLengthMeters: 4.45,
    swim: {
      // World Oceanarium scale: 1 WU = 25 cm. Review max maps 4.45 m to 17.8 WU.
      bodyLengthWU: 17.8,
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
    // Where remoras ride. Measured off shortfinmako003 in the runtime model frame (+X right,
    // +Y up, +Z tail; the root sits ~30% back from the snout) and divided by 17.8 WU. All four
    // anchors sit in the front third, ahead of where the caudal wave starts to swing the body
    // (flexStart 0.18 of the mesh length), so a clamped remora sways less than 0.05 WU against it.
    rideHost: {
      groups: ['shark', 'large-fish'],
      // Attach points sampled over shortfinmako003's faces by their normals and fitted to its
      // skin (scripts/fit-ride-anchors.mjs -> src/data/rideAnchors.js): belly and flanks from
      // 12% to 50% of the length, as uneven as the mesh, clear of the pectoral fins. `rail` is
      // the skin's height along each normal; riders are laid along it (rideAnchorFit).
      anchors: RIDE_ANCHORS['isurus-oxyrinchus'].anchors,
      waveSpan: RIDE_ANCHORS['isurus-oxyrinchus'].waveSpan,
      // Clearance ellipsoid riders route around: centre (0, -0.1, 3.0) WU, radii (2.2, 1.9,
      // 8.8) WU — the body and pectoral fins from snout to caudal peduncle.
      body: { center: [0, -0.0056, 0.1685], radii: [0.1236, 0.1067, 0.4944] },
    },
    // Review spread maps individuals to roughly 2.9–4.45 m while the Atlas shows the species maximum.
    sizeRange: [0.65, 1.0],
    mass: {
      // Broad length-weight placeholder until curated shark body-condition data lands.
      coefficient: 0.004,
      exponent: 3,
    },
    model: {
      path: '/models/fish/isurus-oxyrinchus/isurus-oxyrinchus_static_parts.glb',
      // Source GLB is ~40.18 units nose-to-tail; scale maps size 1.0 to 4.45 m / 17.8 WU.
      scale: 0.443,
      // Rig-free static mesh: follow the moving Fish root, never an AABB center or bone.
      followAim: 'root',
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
        // The teeth are a second material split; they move with the jaw under them.
        followBodyMeshNames: ['shortfinmako003_1'],
        sourceAxis: 'z',
        lateralAxis: 'x',
        tailAtMaxZ: true,
        amplitude: 1.2,
        // Large lamnid power: a strong travelling phase runs from the pectorals into a
        // counter-curving tail. The wave starts ahead of the pectoral roots (0.25 of the
        // length) so the body reads as one piece from the head back, rather than a stiff
        // front and a waving tail, while the head itself stays on intent.
        waveSpeed: 2.4,
        waveTravel: 7.4,
        flexStart: 0.1,
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
      // The origin sits 28.02 source units from the tail tip over the ~40.18 span, so the nose is
      // 12.16 ahead of it: 0.303. (This read 0.697, measured from the tail end, which started the
      // debug vectors ~6.7 WU past the snout.) A live mesh check agrees: at 16.68 WU the snout is
      // 4.9 WU ahead of the origin and the tail tip 11.6 WU behind.
      debugForwardOffsetRatio: 0.303,
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
        maleLifeExpectancyYears: 'Unknown',
        femaleLifeExpectancyYears: 'Unknown',
      },
      lifecycle: {
        sexualMaturityYears: 'Unknown',
        sexualSterilityYears: 'Unknown',
        offspringPerMatingEvent: 'Unknown',
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
    // Where remoras ride: the flanks, clear of the rowing dorsal/anal fin roots and the
    // pectorals. Measured off mesh 10001003 in the runtime model frame and divided by the
    // 13.2 WU body length. The Mola body is rigid, so a clamped rider cannot drift off it.
    rideHost: {
      groups: ['sunfish', 'large-fish'],
      // Sampled over 10001003's faces like the mako's, from 15% to 70% of the length, skipping
      // every face its motion mask paints as a flapping fin.
      anchors: RIDE_ANCHORS['mola-alexandrini'].anchors,
      waveSpan: RIDE_ANCHORS['mola-alexandrini'].waveSpan,
      // Clearance ellipsoid riders route around: centre (0, 0, -0.1) WU, radii (1.5, 3.4,
      // 5.4) WU — the disc of the body, not the tall dorsal and anal fins, which riders pass
      // by going round the nose or tail rather than over the top.
      body: { center: [0, 0, -0.0076], radii: [0.1136, 0.2576, 0.4091] },
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
      // Rig-free static mesh: follow the moving Fish root, never an AABB center or bone.
      followAim: 'root',
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
        // Very slow, deliberate sculling: let the heavy disc settle between strokes.
        waveSpeed: 0.46,
        // Both fins rotate around the forward raw-X axis from their individual
        // mask-derived roots, so their tips trace arcs instead of translating.
        finRotationRadians: 0.30,
        dorsalRootYZ: [0, -0.08716],
        analRootYZ: [0, 0.14121],
        // Preserve the artist's uninterrupted soft mask ramp; the shader uses
        // gentler zero-slope quintic easing at each rigid root. Dorsal/anal de-sync.
        dorsalPhaseOffset: 0,
        analPhaseOffset: 1.08,
        analPhaseRate: 0.91,
        pectoralAmplitude: 0.014,
        clavusAmplitude: 0.016,
        turnStrength: 0.012,
        burstAmplitude: 0.38,
        response: 3.2,
        speedFrequencyBoost: 0.10,
        burstFrequencyBoost: 0.08,
        // Only during the existing passive drift state: a subtle, slow settling roll.
        idleDriftRollRadians: 0.035,
        idleDriftRollFrequency: 0.18,
      },
    },
    placeholder: {
      type: 'mola-mola',
      bodyColor: '#8fb8bc',
      finColor: '#6f9fa4',
    },
  },
  // --- Remoras (Echeneidae) ------------------------------------------------------------------
  // Facts from FishBase species summaries unless noted. No supplied models yet: each renders a
  // generated stand-in (remoraPlaceholderModel) until its GLB lands. `hitchhiker.hosts` weights come
  // from each species' documented host range (1 = its usual host, lower = recorded but
  // occasional); host groups are declared by host species in `rideHost.groups`.
  {
    id: 'echeneis-naucrates',
    name: 'Live Sharksucker',
    scientificName: 'Echeneis naucrates',
    family: 'Echeneidae',
    alternateNames: ['Sharksucker', 'Suckerfish'],
    // Jeremy's close-up capture from the tank (2026-09-28): the head reads at tile size.
    atlasThumbnail: '/atlas/echeneis-naucrates-thumbnail.png',
    // With its fins hanging down, the fish's centre sits ~56% of the way down the photo; showing
    // a band from lower in it centres the fish in the wide tile (Jeremy's review, mobile).
    atlasThumbnailPosition: '50% 72%',
    biome: 'ocean',
    depthZone: 'epipelagic',
    schooling: false,
    repulser: false,
    aggressive: false,
    predator: false,
    tempo: 'cruise',
    conservationStatus: {
      system: 'IUCN Red List',
      code: 'LC',
      label: 'Least Concern',
    },
    atlasDetails: {
      commonDiet: 'Small fishes, host scraps, host parasites.',
      foundIn: 'Tropical and warm-temperate seas worldwide except the eastern Pacific, inshore to offshore, 1 to 85 m.',
      sexualDimorphism: 'Unknown',
      lifeSpan: 'Unknown',
      maturityAge: 'Unknown',
      social: {
        schoolSize: 'N/A',
        groupingBehaviour: 'Rides sharks, rays, large bony fishes, sea turtles, whales, dolphins, and even ships, but is often found swimming free in shallow inshore water. Juveniles act as cleaners for parrotfishes.',
        reproduction: 'Unknown',
      },
      averages: {
        // FishBase common length (standard length); no sex-specific data.
        maleSizeMeters: 0.66,
        femaleSizeMeters: 0.66,
        maleWeightKg: 'Unknown',
        femaleWeightKg: 'Unknown',
        maleLifeExpectancyYears: 'Unknown',
        femaleLifeExpectancyYears: 'Unknown',
      },
      lifecycle: {
        sexualMaturityYears: 'Unknown',
        sexualSterilityYears: 'Unknown',
        offspringPerMatingEvent: 'Unknown',
      },
    },
    atlasSummary: {
      biome: 'Ocean',
      zone: 'Sunlight',
      diet: 'Scraps + parasites',
      social: 'Hitchhiker',
    },
    description: 'The largest remora, reaching 1.1 m. Its first dorsal fin has become an oval suction disc on top of the head, a dark, white-edged stripe runs along each flank, and the lower jaw juts well past the upper. It takes almost any large ride — sharks, rays, turtles, whales, even ships — yet is often found swimming free inshore, so it should read as a rider that comes and goes: long stretches clamped under the mako, then a spell on its own.',
    adultLengthRangeMeters: [0.66, 1.1],
    maxBodyLengthMeters: 1.1,
    swim: {
      ...REMORA_SWIM,
      ...OPEN_SEA_RIDER_BOUNDS,
      // 1 WU = 25 cm: 1.1 m maximum total length = 4.4 WU.
      bodyLengthWU: 4.4,
    },
    // Individuals span roughly the 66 cm common length to the 1.1 m maximum.
    sizeRange: [0.6, 1.0],
    mass: REMORA_MASS,
    hitchhiker: {
      hosts: { shark: 1, ray: 0.8, turtle: 0.8, cetacean: 0.5, 'large-fish': 0.5 },
      rideSeconds: [40, 100],
      freeSeconds: [20, 45],
      // Measured off the supplied model by scripts/fit-rider-model.mjs. The front lobes of the
      // second dorsal fin and the upper caudal lobe stand ~4.5 cm proud of the line from the
      // disc to the tail, so the rider pivots on its disc until they clear the host's skin.
      discAheadBodyLengths: 0.3522,
      dorsalClearanceBodyLengths: 0.0371,
      backProfile: [[-0.1453, 0.0382], [-0.1253, 0.0352], [-0.1153, 0.0226], [-0.1053, 0.0182], [-0.0653, 0.0093], [-0.0153, 0.0038], [0.0447, 0.0001], [0.0947, 0.0017], [0.1047, 0.0025], [0.1147, 0.0048], [0.1447, 0.0053], [0.2347, -0.0005], [0.3247, -0.0021], [0.3347, -0.006], [0.3647, -0.021], [0.3947, -0.0332], [0.4147, -0.0397], [0.4247, -0.0418], [0.4347, -0.04], [0.4447, -0.0359], [0.4647, -0.0213], [0.4847, -0.0119], [0.5347, 0.0051], [0.5447, 0.0073], [0.6747, 0.0273], [0.7147, 0.0302], [0.7547, 0.024], [0.7747, 0.0068], [0.8047, -0.0256], [0.8247, -0.0363], [0.8347, -0.036], [0.8447, 0.0026]],
    },
    model: {
      path: '/models/fish/echeneis-naucrates/echeneis-naucrates.glb',
      // Source length 6.6014 -> 4.4 WU. The supplied origin sits 31% back from the snout and
      // off the midline; `position` recentres the root mid-length on the body axis, the frame
      // the ride fit and the stand-ins use (scripts/fit-rider-model.mjs).
      scale: 0.6665,
      position: [-0.093, -0.0572, -0.8437],
      followAim: 'root',
      moveset: {
        cruise: 'procedural_cruise',
        drift: 'procedural_drift',
        turnLeft: 'procedural_turn_left',
        turnRight: 'procedural_turn_right',
        burst: 'procedural_burst',
      },
      proceduralAnimation: {
        ...REMORA_CAUDAL,
        // GLTFLoader splits the body mesh by material: `_1` is the body (dorsal, anal, and
        // caudal fins welded in), `_2` the suction disc, which moves with the head under it.
        bodyMeshNames: ['live_sharksucker_1'],
        followBodyMeshNames: ['live_sharksucker_2'],
        // The stand-ins' stroke, 0.07 and 0.03 body lengths, in this model's source units.
        amplitude: 0.462,
        turnStrength: 0.198,
        // Separate pectoral and pelvic fins, both ahead of flexStart.
        pectoralFinFlutter: 0.09,
        pelvicFinFlutter: 0.05,
      },
      debugForwardOrigin: 'head',
      debugForwardOffsetRatio: 0.5,
    },
  },
  {
    id: 'echeneis-neucratoides',
    name: 'Whitefin Sharksucker',
    scientificName: 'Echeneis neucratoides',
    family: 'Echeneidae',
    alternateNames: [],
    // Jeremy's tank capture (2026-10-09): a full side-on body under the host's fins.
    atlasThumbnail: '/atlas/echeneis-neucratoides-thumbnail.png',
    biome: 'ocean',
    depthZone: 'epipelagic',
    schooling: false,
    repulser: false,
    aggressive: false,
    predator: false,
    tempo: 'cruise',
    conservationStatus: {
      system: 'IUCN Red List',
      code: 'DD',
      label: 'Data Deficient',
    },
    atlasDetails: {
      commonDiet: 'Host scraps, host parasites.',
      foundIn: 'Western Atlantic, Massachusetts to northern South America including the Gulf of Mexico; reefs and offshore.',
      sexualDimorphism: 'Unknown',
      lifeSpan: 'Unknown',
      maturityAge: 'Unknown',
      social: {
        schoolSize: 'N/A',
        groupingBehaviour: 'Travels attached to large fishes, sharks, rays, sea turtles, dolphins, whales, and ships, or swims free over shallow coral reefs.',
        reproduction: 'Unknown',
      },
      averages: {
        // FishBase common length (total length); no sex-specific data.
        maleSizeMeters: 0.5,
        femaleSizeMeters: 0.5,
        maleWeightKg: 'Unknown',
        femaleWeightKg: 'Unknown',
        maleLifeExpectancyYears: 'Unknown',
        femaleLifeExpectancyYears: 'Unknown',
      },
      lifecycle: {
        sexualMaturityYears: 'Unknown',
        sexualSterilityYears: 'Unknown',
        offspringPerMatingEvent: 'Unknown',
      },
    },
    atlasSummary: {
      biome: 'Ocean',
      zone: 'Sunlight',
      diet: 'Scraps + parasites',
      social: 'Hitchhiker',
    },
    description: 'The western Atlantic cousin of the live sharksucker, smaller at up to 75 cm. It is told apart by the broad white tips of its dorsal, anal, and tail fins, and by a suction disc with fewer plates — 18 to 22 lamellae against the live sharksucker\'s 23 to 28. It rides large fishes, sharks, rays, turtles, and whales, or swims free over shallow reefs.',
    adultLengthRangeMeters: [0.5, 0.75],
    maxBodyLengthMeters: 0.75,
    swim: {
      ...REMORA_SWIM,
      ...OPEN_SEA_RIDER_BOUNDS,
      // 75 cm maximum total length = 3.0 WU.
      bodyLengthWU: 3.0,
    },
    sizeRange: [0.67, 1.0],
    mass: REMORA_MASS,
    hitchhiker: {
      hosts: { shark: 1, ray: 0.8, turtle: 0.8, cetacean: 0.5, 'large-fish': 0.5 },
      rideSeconds: [40, 100],
      freeSeconds: [20, 45],
      // Measured from the supplied GLB by scripts/fit-rider-model.mjs. The disc is 35% of
      // the body length ahead of the recentered root; the profile keeps the whitefin's raised
      // dorsal/caudal lobes clear while the disc remains seated on the host skin.
      discAheadBodyLengths: 0.3504,
      dorsalClearanceBodyLengths: 0.0497,
      backProfile: [[-0.1471, 0.0241], [-0.1371, 0.0224], [-0.1271, 0.0228], [-0.1171, 0.0196], [-0.0971, 0.0152], [-0.0871, 0.0117], [-0.0371, 0.0051], [-0.0071, 0.0033], [0.0729, 0.0002], [0.0829, 0.0001], [0.0929, 0.0012], [0.1829, 0.0001], [0.2829, 0.0032], [0.3829, 0.008], [0.5029, -0.0067], [0.5129, -0.0039], [0.5529, 0.0109], [0.6029, 0.0231], [0.6429, 0.0313], [0.7129, 0.041], [0.7229, 0.0436], [0.7329, 0.0442], [0.7429, 0.0408], [0.7529, 0.0346], [0.7929, -0.0024], [0.8029, -0.01], [0.8129, -0.0162], [0.8229, -0.0217], [0.8329, -0.0255], [0.8429, -0.0233]],
    },
    model: {
      path: '/models/fish/echeneis-neucratoides/echeneis-neucratoides.glb',
      // Supplied source body length is fitted by scripts/fit-rider-model.mjs.
      // The root is recentred on the body axis so host skin fitting uses the same frame
      // as the generated remora stand-ins.
      scale: 0.5463,
      position: [0, -0.008, -0.734],
      followAim: 'root',
      moveset: {
        cruise: 'procedural_cruise',
        drift: 'procedural_drift',
        turnLeft: 'procedural_turn_left',
        turnRight: 'procedural_turn_right',
        burst: 'procedural_burst',
      },
      proceduralAnimation: {
        ...REMORA_CAUDAL,
        // The supplied GLB is rig-free. Its main body carries the long dorsal, anal,
        // and caudal surfaces; the second material split is the rigid suction disc.
        bodyMeshNames: ['e_neucratoides_(2)'],
        followBodyMeshNames: ['e_neucratoides_(2)_1'],
        // Keep the front rigid and give the smaller whitefin a compact rear stroke.
        amplitude: 0.385,
        turnStrength: 0.165,
        pectoralFinFlutter: 0.08,
        pelvicFinFlutter: 0.04,
      },
      debugForwardOrigin: 'head',
      debugForwardOffsetRatio: 0.5,
    },
  },
  {
    id: 'remora-remora',
    name: 'Common Remora',
    scientificName: 'Remora remora',
    family: 'Echeneidae',
    alternateNames: ['Shark sucker', 'Remora'],
    biome: 'ocean',
    depthZone: 'epipelagic',
    schooling: false,
    repulser: false,
    aggressive: false,
    predator: false,
    tempo: 'cruise',
    conservationStatus: {
      system: 'IUCN Red List',
      code: 'LC',
      label: 'Least Concern',
    },
    atlasDetails: {
      commonDiet: 'Parasitic copepods, host scraps, plankton.',
      foundIn: 'Warm seas worldwide, 0 to 200 m.',
      sexualDimorphism: 'Unknown',
      lifeSpan: 'Unknown',
      maturityAge: 'Unknown',
      social: {
        schoolSize: 'N/A',
        groupingBehaviour: 'Usually rides sharks, but also other large fishes, sea turtles, whales, dolphins, and ships. Only sometimes found swimming free.',
        reproduction: 'Mating pairs may share one host. Spawning is poorly known.',
      },
      averages: {
        // FishBase common length (total length); no sex-specific data.
        maleSizeMeters: 0.4,
        femaleSizeMeters: 0.4,
        maleWeightKg: 'Unknown',
        femaleWeightKg: 'Unknown',
        maleLifeExpectancyYears: 'Unknown',
        femaleLifeExpectancyYears: 'Unknown',
      },
      lifecycle: {
        sexualMaturityYears: 'Unknown',
        sexualSterilityYears: 'Unknown',
        offspringPerMatingEvent: 'Unknown',
      },
    },
    atlasSummary: {
      biome: 'Ocean',
      zone: 'Sunlight',
      diet: 'Copepods + scraps',
      social: 'Hitchhiker',
    },
    description: 'The classic shark rider. Most stay under 40 cm, though the largest reach 86 cm, and the body is brown, black, or grey. It picks parasitic copepods off its host and takes scraps and plankton, and is only sometimes found swimming free — so in the tank it should spend long stretches clamped to the mako and short ones on its own.',
    adultLengthRangeMeters: [0.4, 0.864],
    maxBodyLengthMeters: 0.864,
    swim: {
      ...REMORA_SWIM,
      ...OPEN_SEA_RIDER_BOUNDS,
      // 86.4 cm maximum total length = 3.456 WU.
      bodyLengthWU: 3.456,
    },
    sizeRange: [0.46, 1.0],
    mass: REMORA_MASS,
    hitchhiker: {
      hosts: { shark: 1, turtle: 0.5, cetacean: 0.4, 'large-fish': 0.4 },
      rideSeconds: [80, 180],
      freeSeconds: [10, 25],
      discAheadBodyLengths: 0.29,
    },
    model: remoraPlaceholderModel('remora-remora', 3.456),
    // Out of the Atlas until its model lands: it still renders a generated stand-in.
    hiddenInAtlas: true,
    placeholder: { type: 'remora', bodyColor: '#5a4b3f', discLength: 0.32 },
  },
  {
    id: 'remora-albescens',
    name: 'White Suckerfish',
    scientificName: 'Remora albescens',
    family: 'Echeneidae',
    alternateNames: ['White remora'],
    biome: 'ocean',
    depthZone: 'epipelagic',
    schooling: false,
    repulser: false,
    aggressive: false,
    predator: false,
    tempo: 'cruise',
    conservationStatus: {
      system: 'IUCN Red List',
      code: 'LC',
      label: 'Least Concern',
    },
    atlasDetails: {
      commonDiet: 'Unknown; barely any parasitic copepods.',
      foundIn: 'Warm seas worldwide, oceanic, to 200 m.',
      maxLengthLabel: 'Standard length',
      sexualDimorphism: 'Unknown',
      lifeSpan: 'Unknown',
      maturityAge: 'Unknown',
      social: {
        schoolSize: 'N/A',
        groupingBehaviour: 'Host-specific on manta rays, often inside the host\'s mouth and gill chambers. Occasionally attaches to sharks and black marlin; rarely found free.',
        reproduction: 'Unknown',
      },
      averages: {
        maleSizeMeters: 'Unknown',
        femaleSizeMeters: 'Unknown',
        maleWeightKg: 'Unknown',
        femaleWeightKg: 'Unknown',
        maleLifeExpectancyYears: 'Unknown',
        femaleLifeExpectancyYears: 'Unknown',
      },
      lifecycle: {
        sexualMaturityYears: 'Unknown',
        sexualSterilityYears: 'Unknown',
        offspringPerMatingEvent: 'Unknown',
      },
    },
    atlasSummary: {
      biome: 'Ocean',
      zone: 'Sunlight',
      diet: 'Unknown',
      social: 'Hitchhiker',
    },
    description: 'The smallest remora, whitish to light grey and up to 30 cm. It is host-specific on manta rays and slips into their mouths and gill chambers more often than any other remora. It only occasionally attaches to sharks or black marlin and is rarely found swimming free.',
    maxBodyLengthMeters: 0.3,
    swim: {
      ...REMORA_SWIM,
      ...OPEN_SEA_RIDER_BOUNDS,
      // 30 cm maximum standard length = 1.2 WU, just above the 1.08 WU tank floor.
      bodyLengthWU: 1.2,
    },
    // Held near the maximum so individuals do not fall far below the tank's 27 cm floor.
    sizeRange: [0.8, 1.0],
    mass: REMORA_MASS,
    hitchhiker: {
      // Manta rays are its host; sharks and black marlin only occasionally.
      hosts: { ray: 1, shark: 0.3, billfish: 0.3 },
      rideSeconds: [120, 240],
      freeSeconds: [8, 18],
      // Its disc is 34–40% of standard length, starting just behind the snout.
      discAheadBodyLengths: 0.285,
    },
    model: remoraPlaceholderModel('remora-albescens', 1.2),
    // Out of the Atlas until its model lands: it still renders a generated stand-in.
    hiddenInAtlas: true,
    placeholder: { type: 'remora', bodyColor: '#cfd6d8', discLength: 0.33 },
  },
  {
    id: 'remora-australis',
    name: 'Whalesucker',
    scientificName: 'Remora australis',
    family: 'Echeneidae',
    alternateNames: [],
    biome: 'ocean',
    depthZone: 'epipelagic',
    schooling: false,
    repulser: false,
    aggressive: false,
    predator: false,
    tempo: 'cruise',
    conservationStatus: {
      system: 'IUCN Red List',
      code: 'LC',
      label: 'Least Concern',
    },
    atlasDetails: {
      commonDiet: 'Host parasites, sloughed skin, host faeces.',
      foundIn: 'Tropical and warm seas worldwide, oceanic, 1 to 50 m.',
      sexualDimorphism: 'Unknown',
      lifeSpan: 'Unknown',
      maturityAge: 'Unknown',
      social: {
        schoolSize: 'N/A',
        groupingBehaviour: 'Attaches only to whales and dolphins. On spinner dolphins, usually no more than three ride one host, on its flanks or belly.',
        reproduction: 'Unknown',
      },
      averages: {
        maleSizeMeters: 'Unknown',
        femaleSizeMeters: 'Unknown',
        maleWeightKg: 'Unknown',
        femaleWeightKg: 'Unknown',
        maleLifeExpectancyYears: 'Unknown',
        femaleLifeExpectancyYears: 'Unknown',
      },
      lifecycle: {
        sexualMaturityYears: 'Unknown',
        sexualSterilityYears: 'Unknown',
        offspringPerMatingEvent: 'Unknown',
      },
    },
    atlasSummary: {
      biome: 'Ocean',
      zone: 'Sunlight',
      diet: 'Parasites + skin',
      social: 'Hitchhiker',
    },
    description: 'A remora that rides nothing but marine mammals — whales and dolphins, including spinner dolphins, where it clamps to the flanks or belly. Its suction disc is unusually large, about half its body length, and it is uniformly brown to grey. It eats parasites and sloughed skin, and forages on its hosts\' faeces and vomit.',
    maxBodyLengthMeters: 0.76,
    swim: {
      ...REMORA_SWIM,
      ...OPEN_SEA_RIDER_BOUNDS,
      // 76 cm maximum total length = 3.04 WU.
      bodyLengthWU: 3.04,
    },
    sizeRange: [0.6, 1.0],
    mass: REMORA_MASS,
    hitchhiker: {
      hosts: { cetacean: 1 },
      rideSeconds: [150, 300],
      freeSeconds: [8, 18],
      // The disc runs about half the body (47–59% of standard length), so its centre sits
      // further back than on any other remora.
      discAheadBodyLengths: 0.225,
    },
    model: remoraPlaceholderModel('remora-australis', 3.04),
    // Out of the Atlas until its model lands: it still renders a generated stand-in.
    hiddenInAtlas: true,
    placeholder: { type: 'remora', bodyColor: '#6b5a48', discLength: 0.45 },
  },
  {
    id: 'remora-brachyptera',
    name: 'Spearfish Remora',
    scientificName: 'Remora brachyptera',
    family: 'Echeneidae',
    alternateNames: [],
    biome: 'ocean',
    depthZone: 'epipelagic',
    schooling: false,
    repulser: false,
    aggressive: false,
    predator: false,
    tempo: 'cruise',
    conservationStatus: {
      system: 'IUCN Red List',
      code: 'LC',
      label: 'Least Concern',
    },
    atlasDetails: {
      commonDiet: 'Parasitic copepods from its host.',
      foundIn: 'Tropical and warm-temperate seas worldwide, oceanic.',
      sexualDimorphism: 'Unknown',
      lifeSpan: 'Unknown',
      maturityAge: 'Unknown',
      social: {
        schoolSize: 'N/A',
        groupingBehaviour: 'Rides billfishes and swordfish, on the body and inside the gill chamber; also recorded on ocean sunfishes, blue sharks, and loggerhead turtles. Capable of short bursts of independent swimming.',
        reproduction: 'Unknown',
      },
      averages: {
        // FishBase common length (total length); no sex-specific data.
        maleSizeMeters: 0.25,
        femaleSizeMeters: 0.25,
        maleWeightKg: 'Unknown',
        femaleWeightKg: 'Unknown',
        maleLifeExpectancyYears: 'Unknown',
        femaleLifeExpectancyYears: 'Unknown',
      },
      lifecycle: {
        sexualMaturityYears: 'Unknown',
        sexualSterilityYears: 'Unknown',
        offspringPerMatingEvent: 'Unknown',
      },
    },
    atlasSummary: {
      biome: 'Ocean',
      zone: 'Sunlight',
      diet: 'Copepods',
      social: 'Hitchhiker',
    },
    description: 'A slim, pale remora — whitish to pale blue in life — that rides marlins, sailfish, and swordfish, and is also recorded on ocean sunfishes. Juveniles often shelter inside the host\'s gill chamber. It can shift about its host\'s body and manage short bursts of independent swimming, so it should read as a fish that barely leaves its ride.',
    adultLengthRangeMeters: [0.25, 0.5],
    maxBodyLengthMeters: 0.5,
    swim: {
      ...REMORA_SWIM,
      ...DRIFT_RIDER_BOUNDS,
      // 50 cm maximum total length = 2.0 WU.
      bodyLengthWU: 2.0,
    },
    // Skewed above the 25 cm common length so individuals stay clear of the 27 cm tank floor.
    sizeRange: [0.6, 1.0],
    mass: REMORA_MASS,
    hitchhiker: {
      // Billfishes are its usual hosts. Sunfish (Mola), blue shark, and loggerhead records:
      // Gulf of Tehuantepec first record, Hidrobiológica 2022,
      // https://www.scielo.org.mx/scielo.php?pid=S0188-88972022000100071&script=sci_arttext
      hosts: { billfish: 1, sunfish: 0.7, shark: 0.25, turtle: 0.25 },
      rideSeconds: [90, 200],
      freeSeconds: [6, 14],
      discAheadBodyLengths: 0.3,
    },
    model: remoraPlaceholderModel('remora-brachyptera', 2.0),
    // Out of the Atlas until its model lands: it still renders a generated stand-in.
    hiddenInAtlas: true,
    placeholder: { type: 'remora', bodyColor: '#b9cad6', discLength: 0.3 },
  },
  {
    id: 'remora-osteochir',
    name: 'Marlinsucker',
    scientificName: 'Remora osteochir',
    family: 'Echeneidae',
    alternateNames: ['Marlin sucker'],
    biome: 'ocean',
    depthZone: 'epipelagic',
    schooling: false,
    repulser: false,
    aggressive: false,
    predator: false,
    tempo: 'cruise',
    conservationStatus: {
      system: 'IUCN Red List',
      code: 'LC',
      label: 'Least Concern',
    },
    atlasDetails: {
      commonDiet: 'Unknown',
      foundIn: 'Subtropical waters of every ocean, oceanic, to 200 m.',
      maxLengthLabel: 'Standard length',
      sexualDimorphism: 'Unknown',
      lifeSpan: 'Unknown',
      maturityAge: 'Unknown',
      social: {
        schoolSize: 'N/A',
        groupingBehaviour: 'Strongly prefers marlins and sailfish, riding on the body or inside the gill chamber; occasionally clings to other large fishes.',
        reproduction: 'Egg-laying, with distinct pairing during breeding. Mature pairs are often found together on a single host.',
      },
      averages: {
        maleSizeMeters: 'Unknown',
        femaleSizeMeters: 'Unknown',
        maleWeightKg: 'Unknown',
        femaleWeightKg: 'Unknown',
        maleLifeExpectancyYears: 'Unknown',
        femaleLifeExpectancyYears: 'Unknown',
      },
      lifecycle: {
        sexualMaturityYears: 'Unknown',
        sexualSterilityYears: 'Unknown',
        offspringPerMatingEvent: 'Unknown',
      },
    },
    atlasSummary: {
      biome: 'Ocean',
      zone: 'Sunlight',
      diet: 'Unknown',
      social: 'Hitchhiker',
    },
    description: 'A small oceanic remora, up to 40 cm, with a strong preference for marlins and sailfish. It rides on the body or inside the gill chamber and only occasionally clings to other large fishes. It matures at about 14 cm, and mature pairs are often found together on one host.',
    maxBodyLengthMeters: 0.4,
    swim: {
      ...REMORA_SWIM,
      ...OPEN_SEA_RIDER_BOUNDS,
      // 40 cm maximum standard length = 1.6 WU.
      bodyLengthWU: 1.6,
    },
    sizeRange: [0.7, 1.0],
    mass: REMORA_MASS,
    hitchhiker: {
      hosts: { billfish: 1, 'large-fish': 0.15 },
      rideSeconds: [120, 240],
      freeSeconds: [8, 18],
      discAheadBodyLengths: 0.3,
    },
    model: remoraPlaceholderModel('remora-osteochir', 1.6),
    // Out of the Atlas until its model lands: it still renders a generated stand-in.
    hiddenInAtlas: true,
    placeholder: { type: 'remora', bodyColor: '#7a7f84', discLength: 0.3 },
  },
  {
    id: 'phtheirichthys-lineatus',
    name: 'Slender Suckerfish',
    scientificName: 'Phtheirichthys lineatus',
    family: 'Echeneidae',
    alternateNames: ['Louse fish'],
    biome: 'ocean',
    depthZone: 'epipelagic',
    schooling: false,
    repulser: false,
    aggressive: false,
    predator: false,
    tempo: 'cruise',
    conservationStatus: {
      system: 'IUCN Red List',
      code: 'LC',
      label: 'Least Concern',
    },
    atlasDetails: {
      commonDiet: 'Fish scraps, plankton.',
      foundIn: 'Tropical and subtropical seas worldwide, oceanic, near the surface (0 to 5 m).',
      sexualDimorphism: 'Unknown',
      lifeSpan: 'Unknown',
      maturityAge: 'Unknown',
      social: {
        schoolSize: 'N/A',
        groupingBehaviour: 'Most often found on barracudas, also on other fishes and sea turtles, on the body or inside the gill chambers. Not strongly host-dependent, and often met swimming free.',
        reproduction: 'Unknown',
      },
      averages: {
        // Usual total length (Wikipedia, after FishBase); no sex-specific data.
        maleSizeMeters: 0.34,
        femaleSizeMeters: 0.34,
        maleWeightKg: 'Unknown',
        femaleWeightKg: 'Unknown',
        maleLifeExpectancyYears: 'Unknown',
        femaleLifeExpectancyYears: 'Unknown',
      },
      lifecycle: {
        sexualMaturityYears: 'Unknown',
        sexualSterilityYears: 'Unknown',
        offspringPerMatingEvent: 'Unknown',
      },
    },
    atlasSummary: {
      biome: 'Ocean',
      zone: 'Sunlight',
      diet: 'Scraps + plankton',
      social: 'Loose hitchhiker',
    },
    description: 'A slender remora with the smallest suction disc in the family — 9 to 11 plates spanning under a third of its length. It is most often found on barracudas, also on other fishes and sea turtles, but it is not strongly tied to any host and is often met swimming free. It feeds mostly on fish scraps and plankton rather than host parasites.',
    adultLengthRangeMeters: [0.34, 0.76],
    maxBodyLengthMeters: 0.76,
    swim: {
      ...REMORA_SWIM,
      ...OPEN_SEA_RIDER_BOUNDS,
      // 76 cm maximum total length = 3.04 WU.
      bodyLengthWU: 3.04,
    },
    sizeRange: [0.45, 1.0],
    mass: REMORA_MASS,
    hitchhiker: {
      hosts: { barracuda: 1, turtle: 0.6, 'large-fish': 0.3 },
      // The loosest rider: short rides, long spells free.
      rideSeconds: [15, 40],
      freeSeconds: [45, 90],
      // The smallest disc in the family (18–28% of standard length), close behind the snout.
      discAheadBodyLengths: 0.35,
    },
    model: remoraPlaceholderModel('phtheirichthys-lineatus', 3.04),
    // Out of the Atlas until its model lands: it still renders a generated stand-in.
    hiddenInAtlas: true,
    placeholder: { type: 'remora', bodyColor: '#5d646b', discLength: 0.2 },
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
  },
  // Remora review fixtures: more shark riders than the mako has anchors, so some always
  // wait their turn, plus one of each host-less or occasional rider.
  ...[
    ['echeneis-naucrates', 0.7],
    ['echeneis-naucrates', 0.35],
    ['echeneis-neucratoides', 0.6],
    ['remora-remora', 0.5],
    ['remora-remora', 0.25],
    ['remora-albescens', 0.6],
    ['remora-australis', 0.5],
    ['remora-brachyptera', 0.6],
    ['remora-osteochir', 0.5],
    ['phtheirichthys-lineatus', 0.55],
  ].map(([species, size], index) => ({
    id: 95 + index,
    species,
    biome: 'ocean',
    depthZone: 'epipelagic',
    bornAt: '2026-09-25T00:00:00Z',
    alive: true,
    sex: index % 2 === 0 ? 'male' : 'female',
    size,
  })),
]
