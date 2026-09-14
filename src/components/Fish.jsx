import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { Billboard, Text, useAnimations, useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { clone } from 'three/examples/jsm/utils/SkeletonUtils.js'
import { WORLD_UNIT_METERS } from '../data/species'
import { triggerFishSwimSound } from '../hooks/useOceanAudio'
import { removeSardineFrustumEntry, removeSardineInstance, removeSardineLod1Instance, removeSardineLod0Entry, SARDINE_INSTANCE_DISTANCE, SARDINE_LOD1_DISTANCE, SARDINE_TANK_INSTANCE_DISTANCE, SARDINE_TANK_LOD1_DISTANCE, updateSardineFrustumEntry, updateSardineInstance, updateSardineLod1Instance, updateSardineLod0Entry } from './sardineInstanceRegistry'
import { SURFACE_PLANE_Y } from './WaterSurface'
import { isMolaCreature, resolveSpecies } from '../utils/speciesLookup'
import { hashString } from '../utils/hash'
import { SARDINE_MATERIAL_ROUGHNESS } from '../utils/sardineMaterials'
import { SARDINE_DEBUG_GLOBAL } from '../utils/debugIdentifiers'
import { getFishRuntime } from './fishRuntimeStore'
import {
  BOID_MAX_DEBUG_NEIGHBORS,
  DEFAULT_BURST_ACTION_DURATION,
  DEFAULT_DRIFT_DURATION,
  DEFAULT_DRIFT_INTERVAL,
  DEFAULT_SWIM,
  DEFAULT_TURN_ACTION_DURATION,
  MOLA_SUN_BASK_APPROACH_Z,
  SNAP_TURN_THRESHOLD,
  SWIM_BOX,
  boundaryAvoidanceTurnStep,
  clampToMolaSurfaceCeiling,
  clampToSurfaceCeiling,
  clampToSwimBounds,
  computeBoidSteering,
  creatureBodyLength,
  debugForwardOffset,
  enforceForwardPitchLimit,
  followLookaheadDistance,
  forEachFish,
  getFishEntry,
  getSchoolState,
  interactionProxyDimensions,
  isMolaDeepZExit,
  maxTurnRadiansForSpeed,
  maxVisualPitch,
  molaSunBaskSurfaceCenterYMax,
  mulberry32,
  pickMolaSunBaskExitTarget,
  pickMolaSunBaskTarget,
  pickSoloAgentContinuationTarget,
  pickSoloAgentSteeringDestination,
  pickSoloAgentTarget,
  placeholderDimensions,
  randomRange,
  randomRangeFromPair,
  releaseSchoolState,
  resolveModel,
  resolveSwimProfile,
  rotateDirectionToward,
  schoolFormationOffset,
  setForwardWithPitch,
  shapeSoloAgentSteeringDesired,
  soloAgentReachedDistance,
  swimBounds,
  swimXRangeAtZ,
  turnRateForCreature,
  unregisterFish,
  updateFishRegistry,
} from './fishSwim'



const MAX_MODEL_BANK = THREE.MathUtils.degToRad(5)
const BURST_STRAIGHT_THRESHOLD = 0.004
const DEFAULT_MOVESET = {
  cruise: 'idle',
  drift: 'idle',
  turnLeft: 'snap_left',
  turnRight: 'snap_right',
  burst: 'burst',
}
const FISH_SFX_MIN_INTERVAL = 0.75
const SCHOOL_SFX_LEADER_ONLY = true
const GLOBAL_ANIMATION_TIME_SCALE = 1
const SELECTED_OUTLINE_COLOR = '#57c7e8'
const LEADER_OUTLINE_COLOR = '#80ff72'
const LOD0_DEBUG_COLOR = '#00ff28'
const SELECTED_RIM_INTENSITY = 1.65
const LEADER_RIM_INTENSITY = 0.8
const RIM_POWER = 3.1
const FISH_LIGHT_MASK_ENABLED = true
const SARDINE_INSTANCE_HYSTERESIS = 0.65
const SARDINE_VIEW_CULL_MARGIN_NDC = 1.28
const PERSONAL_SPEED_SCALE = [0.94, 1.08]
const PERSONAL_CATCHUP_SCALE = [0.90, 1.15]
const ORGANIC_NOISE_AMPLITUDE = 0.055
const ORGANIC_NOISE_RESPONSE = 1.15
const ORGANIC_NOISE_INTERVAL = [1.8, 3.8]
const DEBUG_FORWARD_SPEED_SCALE = 0.625
const DEBUG_FORWARD_MIN_LENGTH = 0.11
const DEBUG_LABEL_SCALE = 0.0525
const DEBUG_NAME_LABEL_SCALE = 0.045
const DEBUG_AGENT_LABEL_SCALE = 0.045
// Multiplies camera distance to keep world-space debug labels a near-constant on-screen
// size (see nameLabel update). Tuned so a mid-tank creature reads at ~1x.
const DEBUG_LABEL_DISTANCE_SCALE = 0.09
const DEBUG_BOID_VECTOR_SCALE = 5.0
// Ceiling on a single simulation step (before the debug speed multiplier). On a smooth
// display rawDelta is ~0.016s so this never engages; it only caps genuine hitches / very
// low frame rates, where an unbounded step would let a fast swimmer leap clear across its
// boundary envelope in one frame (tunnelling) and get snapped back. Capping the step makes
// slow frames dilate time slightly instead of teleporting — invisible in an ambient tank.
const MAX_SIMULATION_RAW_DELTA = 0.05
const DEBUG_LABEL_FONT = '/fonts/DejaVuSansMono.ttf'
const VISUAL_PITCH_RESPONSE = 4.8
// Fade the swim pitch toward level as forward speed drops below a fraction of the fish's own
// cruise speed. Without this, a fish coasting to a near-stop (a drift beat, or settling onto a
// reached follow-target) has its tiny horizontal travel swamped by the vertical bob, and
// atan2 snaps the nose to the full pitch limit — it looks parked and staring up and down.
// Referencing each fish's own idle speed keeps genuine dives (mako, mola) pitching normally,
// since those happen at speed.
const PITCH_FADE_SPEED_FRACTION_LO = 0.1
const PITCH_FADE_SPEED_FRACTION_HI = 0.45
const SUN_BASK_ANIMATION_NAMES = new Set(['sun_bask_l', 'sun_bask_r'])
const MOLA_SUN_BASK_ANIMATION_FADE_DURATION = 3.5
const MOLA_SUN_BASK_ANIMATION_ENTRY_FADE_DURATION = 0.55
const MOLA_SUN_BASK_ANIMATION_SPEED_SCALE = 0.5
// A school travels toward a shared roaming goal (pure boids alone just mill in place). The
// leader picks a new (forward-biased) goal once the group is within SCHOOL_GOAL_REACHED of it.
const SCHOOL_GOAL_REACHED_BODY_LENGTHS = 3.0
const SCHOOL_GOAL_REACHED_MIN = 2.0
// The shared migration direction is low-pass filtered so goal re-picks (which nudge the goal
// laterally) can't accumulate into a constant slow turn — the school holds straight glides and
// only swings when the goal genuinely shifts. Time constant in 1/seconds. Kept moderate: too low
// lags the direction behind actual travel and the school's headings spread (coherence drops).
const SCHOOL_MIGRATION_SMOOTH = 1.6
// School steering blends a shared migration urge (travel along goal - centroid) with a pull
// toward this member's formation slot (its designed place in the travel frame). The slot pull
// gives the school a stable 3D shape so it holds width instead of collapsing to single-file —
// a plain "seek the goal point" funnels every fish into a conga line. Boid separation/threat
// then ride on top for anti-overlap and predator avoidance.
const SCHOOL_MIGRATION_WEIGHT = 0.6
const SCHOOL_FORMATION_WEIGHT = 0.65
const BOID_STEERING_SMOOTHING = 3.4
// A fish commits to a boid steering decision and holds it for roughly one
// animation cycle, then re-decides. This stops the per-frame re-evaluation that
// made fish jitter and flip direction several times a second.
const BOID_DECISION_MIN_INTERVAL = 1.0
const BOID_DECISION_MAX_INTERVAL = 2.6
const BOID_DECISION_JITTER = 0.3
const SOLO_AGENT_TANGENT_TURN_RATE = THREE.MathUtils.degToRad(155)
const SOLO_AGENT_TANGENT_CATCHUP_RATE = THREE.MathUtils.degToRad(260)
const SOLO_AGENT_TANGENT_CATCHUP_ALIGNMENT = 0.72
// Non-mola solo agents (the mako) get a hard surface ceiling this far below the water plane, so
// the swim bounds can't carry them up through the surface. Tuned to keep the mako's body visibly
// submerged while still leaving a little headroom above its swim bounds.
const SOLO_AGENT_SURFACE_CLEARANCE = 2.0
const MOLA_RUNTIME_RECOVERY_FADE_OUT_DURATION = 8
const MOLA_RUNTIME_RECOVERY_FADE_IN_DURATION = 3.5
const MOLA_FRONT_EXCURSION_CHANCE = 0.24
const MOLA_FRONT_TARGET_COUNT = [1, 2]
const MOLA_DEEP_TARGET_COUNT = [4, 7]
const MOLA_SUN_BASK_CHANCE = 0.16
const MOLA_SUN_BASK_COOLDOWN = 75
const MOLA_SUN_BASK_DURATION = 60
const MOLA_SUN_BASK_EXIT_ROLL_DURATION = 10
const MOLA_SUN_BASK_REACHED_BODY_LENGTHS = 0.08
const MOLA_SUN_BASK_REACHED_MAX = 0.75
const MOLA_SUN_BASK_APPROACH_MIN_SPEED_SCALE = 0.22
const MOLA_SUN_BASK_APPROACH_DECEL_START = 0.45
const MOLA_SUN_BASK_ROLL_PROGRESS_START = 0.62
const MOLA_SUN_BASK_APPROACH_MAX_ROLL_ALPHA = 0.92
const MOLA_SUN_BASK_HOLD_ROLL_COMPLETE_DURATION = 5
const MOLA_SUN_BASK_HOLD_COAST_DURATION = 1.2
const MOLA_SUN_BASK_EXIT_SPEED_RAMP_DURATION = 2.5
const MOLA_SUN_BASK_DRIFT_ROLL_AMPLITUDE = THREE.MathUtils.degToRad(4)
const MOLA_SUN_BASK_DRIFT_YAW_AMPLITUDE = THREE.MathUtils.degToRad(3)
const MOLA_SUN_BASK_DRIFT_INTRO_DURATION = 4
const MOLA_SUN_BASK_LOOK_AT_ENTER_BLEND_DURATION = 1.5
const MOLA_SUN_BASK_LOOK_AT_EXIT_BLEND_DURATION = 6
const MOLA_BEHAVIOR_LOOK_AT_RESPONSE = 2.2
const MOLA_BEHAVIOR_LOOK_AT_TRANSITION_RESPONSE = 1.15
const MOLA_BEHAVIOR_LOOK_AT_TRANSITION_DURATION = 1.5
const MOLA_SUN_BASK_DRIFT_XZ_AMPLITUDE = 0.09
const MOLA_SUN_BASK_DRIFT_Y_AMPLITUDE = 0.035
const AGENT_BEHAVIOR_RETRY_COOLDOWN = 1.2


const tangent = new THREE.Vector3()
const lookTarget = new THREE.Vector3()
const up = new THREE.Vector3(0, 1, 0)
const nextPoint = new THREE.Vector3()
const schoolBasePosition = new THREE.Vector3()
const schoolFollowDirection = new THREE.Vector3()
const debugForwardStart = new THREE.Vector3()
const debugForwardEnd = new THREE.Vector3()
const horizontalForward = new THREE.Vector3()
const pitchedForward = new THREE.Vector3()
const frameMove = new THREE.Vector3()
const rawVisualForward = new THREE.Vector3()
const splineVisualTangent = new THREE.Vector3()
const agentMoveDirection = new THREE.Vector3()
const targetDesiredDirection = new THREE.Vector3()
const agentCandidateTarget = new THREE.Vector3()
const curveDeformAxisX = new THREE.Vector3(1, 0, 0)
const curveDeformAxisY = new THREE.Vector3(0, 1, 0)
const curveDeformAxisZ = new THREE.Vector3(0, 0, 1)
const agentRuntimeClamp = new THREE.Vector3()
const agentBaskExitTarget = new THREE.Vector3()
const targetLookQuaternion = new THREE.Quaternion()
const bankQuaternion = new THREE.Quaternion()
const tempScale = new THREE.Vector3()
const cullProjection = new THREE.Vector3()
const debugBoidVectorEnd = new THREE.Vector3()
const debugNeighborStart = new THREE.Vector3()
const debugNeighborEnd = new THREE.Vector3()
const debugNeighborHeadingEnd = new THREE.Vector3()
const BOID_RELATION_COLORS = {
  follow: new THREE.Color('#80ff72'),
  avoid: new THREE.Color('#ff5a36'),
  neutral: new THREE.Color('#9aa7b2'),
}


function makeDebugLineGeometry() {
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 0, 0, 0], 3))
  return geometry
}

function updateDebugLine(lineRef, start, end) {
  const geometry = lineRef.current?.geometry
  const positions = geometry?.attributes?.position
  if (!positions) return

  positions.setXYZ(0, start.x, start.y, start.z)
  positions.setXYZ(1, end.x, end.y, end.z)
  positions.needsUpdate = true
  geometry.computeBoundingSphere()
}

function updateDebugVectorLine(lineRef, start, vector, scale = 1) {
  debugBoidVectorEnd.copy(start).addScaledVector(vector, scale)
  updateDebugLine(lineRef, start, debugBoidVectorEnd)
}

function depthFadeFromScreenZ(z) {
  const normalized = THREE.MathUtils.clamp((z + SWIM_BOX.z) / (SWIM_BOX.z * 2), 0, 1)
  return THREE.MathUtils.lerp(0.22, 1.0, normalized ** 1.65)
}

function applyFishLightMask(material, rim = null, proceduralVertex = null, geometry = null) {
  if (!FISH_LIGHT_MASK_ENABLED && !rim && !proceduralVertex) return
  const rimColor = rim ? new THREE.Color(rim.color) : new THREE.Color('#000000')
  const rimIntensity = rim?.intensity ?? 0
  const rimPower = rim?.power ?? RIM_POWER
  const rimKey = rim ? `${rimColor.getHexString()}:${rimIntensity}:${rimPower}` : 'none'
  const maskUniforms = { uTime: { value: 0 } }
  const proceduralBounds = geometry?.boundingBox
  const proceduralSourceAxis = proceduralAxisIndex(proceduralVertex?.sourceAxis, 2)
  const proceduralLateralAxis = proceduralAxisIndex(proceduralVertex?.lateralAxis, proceduralSourceAxis === 0 ? 2 : 0)
  const caudalUniforms = proceduralVertex?.type === 'caudal-vertex' && proceduralBounds ? {
    phase: { value: 0 },
    speed: { value: 0 },
    turn: { value: 0 },
    burst: { value: 0 },
    minSource: { value: proceduralAxisMin(proceduralBounds, proceduralSourceAxis) },
    maxSource: { value: proceduralAxisMax(proceduralBounds, proceduralSourceAxis) },
    sourceAxis: { value: proceduralSourceAxis },
    lateralAxis: { value: proceduralLateralAxis },
    tailAtMaxZ: { value: proceduralVertex.tailAtMaxZ ? 1 : 0 },
    amplitude: { value: proceduralVertex.amplitude ?? 0.16 },
    waveTravel: { value: proceduralVertex.waveTravel ?? 5.2 },
    flexStart: { value: proceduralVertex.flexStart ?? 0.18 },
    flexFull: { value: proceduralVertex.flexFull ?? 0.82 },
    turnStrength: { value: proceduralVertex.turnStrength ?? 0.22 },
    burstAmplitude: { value: proceduralVertex.burstAmplitude ?? 0.55 },
  } : null
  const molaMaskUniforms = proceduralVertex?.type === 'mola-mask-vertex' && proceduralBounds ? {
    phase: { value: 0 },
    speed: { value: 0 },
    turn: { value: 0 },
    burst: { value: 0 },
    finRotationRadians: { value: proceduralVertex.finRotationRadians ?? 0.46 },
    dorsalRootYZ: { value: new THREE.Vector2(...(proceduralVertex.dorsalRootYZ ?? [0, -0.08716])) },
    analRootYZ: { value: new THREE.Vector2(...(proceduralVertex.analRootYZ ?? [0, 0.14121])) },
    dorsalPhaseOffset: { value: proceduralVertex.dorsalPhaseOffset ?? 0 },
    analPhaseOffset: { value: proceduralVertex.analPhaseOffset ?? 1.08 },
    analPhaseRate: { value: proceduralVertex.analPhaseRate ?? 0.91 },
    pectoralAmplitude: { value: proceduralVertex.pectoralAmplitude ?? 0.014 },
    clavusAmplitude: { value: proceduralVertex.clavusAmplitude ?? 0.016 },
    turnStrength: { value: proceduralVertex.turnStrength ?? 0.012 },
    burstAmplitude: { value: proceduralVertex.burstAmplitude ?? 0.38 },
  } : null
  const proceduralUniforms = caudalUniforms ?? molaMaskUniforms

  material.onBeforeCompile = (shader) => {
    shader.uniforms.uFishLightMaskTime = maskUniforms.uTime
    shader.uniforms.uRimColor = { value: rimColor }
    shader.uniforms.uRimIntensity = { value: rimIntensity }
    shader.uniforms.uRimPower = { value: rimPower }
    if (caudalUniforms) {
      shader.uniforms.uProceduralPhase = caudalUniforms.phase
      shader.uniforms.uProceduralSpeed = caudalUniforms.speed
      shader.uniforms.uProceduralTurn = caudalUniforms.turn
      shader.uniforms.uProceduralBurst = caudalUniforms.burst
      shader.uniforms.uProceduralMinSource = caudalUniforms.minSource
      shader.uniforms.uProceduralMaxSource = caudalUniforms.maxSource
      shader.uniforms.uProceduralSourceAxis = caudalUniforms.sourceAxis
      shader.uniforms.uProceduralLateralAxis = caudalUniforms.lateralAxis
      shader.uniforms.uProceduralTailAtMaxZ = caudalUniforms.tailAtMaxZ
      shader.uniforms.uProceduralAmplitude = caudalUniforms.amplitude
      shader.uniforms.uProceduralWaveTravel = caudalUniforms.waveTravel
      shader.uniforms.uProceduralFlexStart = caudalUniforms.flexStart
      shader.uniforms.uProceduralFlexFull = caudalUniforms.flexFull
      shader.uniforms.uProceduralTurnStrength = caudalUniforms.turnStrength
      shader.uniforms.uProceduralBurstAmplitude = caudalUniforms.burstAmplitude
    }
    if (molaMaskUniforms) {
      shader.uniforms.uMolaPhase = molaMaskUniforms.phase
      shader.uniforms.uMolaSpeed = molaMaskUniforms.speed
      shader.uniforms.uMolaTurn = molaMaskUniforms.turn
      shader.uniforms.uMolaBurst = molaMaskUniforms.burst
      shader.uniforms.uMolaFinRotationRadians = molaMaskUniforms.finRotationRadians
      shader.uniforms.uMolaDorsalRootYZ = molaMaskUniforms.dorsalRootYZ
      shader.uniforms.uMolaAnalRootYZ = molaMaskUniforms.analRootYZ
      shader.uniforms.uMolaDorsalPhaseOffset = molaMaskUniforms.dorsalPhaseOffset
      shader.uniforms.uMolaAnalPhaseOffset = molaMaskUniforms.analPhaseOffset
      shader.uniforms.uMolaAnalPhaseRate = molaMaskUniforms.analPhaseRate
      shader.uniforms.uMolaPectoralAmplitude = molaMaskUniforms.pectoralAmplitude
      shader.uniforms.uMolaClavusAmplitude = molaMaskUniforms.clavusAmplitude
      shader.uniforms.uMolaTurnStrength = molaMaskUniforms.turnStrength
      shader.uniforms.uMolaBurstAmplitude = molaMaskUniforms.burstAmplitude
    }
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
varying vec3 vFishWorldPosition;
${caudalUniforms ? `uniform float uProceduralPhase;
uniform float uProceduralSpeed;
uniform float uProceduralTurn;
uniform float uProceduralBurst;
uniform float uProceduralMinSource;
uniform float uProceduralMaxSource;
uniform float uProceduralSourceAxis;
uniform float uProceduralLateralAxis;
uniform float uProceduralTailAtMaxZ;
uniform float uProceduralAmplitude;
uniform float uProceduralWaveTravel;
uniform float uProceduralFlexStart;
uniform float uProceduralFlexFull;
uniform float uProceduralTurnStrength;
uniform float uProceduralBurstAmplitude;
float proceduralAxisValue(vec3 value, float axis) {
  return axis < 0.5 ? value.x : (axis < 1.5 ? value.y : value.z);
}
void proceduralAddAxis(inout vec3 value, float axis, float offset) {
  if (axis < 0.5) value.x += offset;
  else if (axis < 1.5) value.y += offset;
  else value.z += offset;
}
void proceduralAdjustNormal(inout vec3 value, float sourceAxis, float lateralAxis, float slope) {
  float lateralComponent = proceduralAxisValue(value, lateralAxis);
  if (sourceAxis < 0.5) value.x -= slope * lateralComponent;
  else if (sourceAxis < 1.5) value.y -= slope * lateralComponent;
  else value.z -= slope * lateralComponent;
  value = normalize(value);
}
void proceduralFishCurve(float sourceCoord, out float lateralOffset, out float lateralSlope) {
  float bodyLength = max(0.0001, uProceduralMaxSource - uProceduralMinSource);
  float tail01FromMin = (sourceCoord - uProceduralMinSource) / bodyLength;
  float tail01FromMax = (uProceduralMaxSource - sourceCoord) / bodyLength;
  float tail01 = clamp(mix(tail01FromMax, tail01FromMin, uProceduralTailAtMaxZ), 0.0, 1.0);
  float flexRange = max(0.0001, uProceduralFlexFull - uProceduralFlexStart);
  float flexT = clamp((tail01 - uProceduralFlexStart) / flexRange, 0.0, 1.0);
  float flex = flexT * flexT * (3.0 - 2.0 * flexT);
  float dTailDz = mix(-1.0, 1.0, uProceduralTailAtMaxZ) / bodyLength;
  float dFlexDz = (tail01 > uProceduralFlexStart && tail01 < uProceduralFlexFull)
    ? (6.0 * flexT * (1.0 - flexT) / flexRange) * dTailDz
    : 0.0;
  float wavePhase = uProceduralPhase - tail01 * uProceduralWaveTravel;
  float wave = sin(wavePhase);
  float dWaveDz = cos(wavePhase) * (-uProceduralWaveTravel * dTailDz);
  float stroke = uProceduralAmplitude
    * mix(0.42, 1.0, uProceduralSpeed)
    * (1.0 + uProceduralBurst * uProceduralBurstAmplitude);
  lateralOffset = wave * stroke * flex + uProceduralTurn * uProceduralTurnStrength * flex * flex;
  lateralSlope = stroke * (dWaveDz * flex + wave * dFlexDz)
    + uProceduralTurn * uProceduralTurnStrength * 2.0 * flex * dFlexDz;
}` : ''}${molaMaskUniforms ? `attribute vec4 color_1;
uniform float uMolaPhase;
uniform float uMolaSpeed;
uniform float uMolaTurn;
uniform float uMolaBurst;
uniform float uMolaFinRotationRadians;
uniform vec2 uMolaDorsalRootYZ;
uniform vec2 uMolaAnalRootYZ;
uniform float uMolaDorsalPhaseOffset;
uniform float uMolaAnalPhaseOffset;
uniform float uMolaAnalPhaseRate;
uniform float uMolaPectoralAmplitude;
uniform float uMolaClavusAmplitude;
uniform float uMolaTurnStrength;
uniform float uMolaBurstAmplitude;
void proceduralMolaMotion(inout vec3 value) {
  vec3 mask = clamp(color_1.rgb, 0.0, 1.0);
  // White/grey is deliberately reserved for pectorals. Removing its shared value
  // leaves the exclusive red/green/blue dorsal, anal, and clavus weights.
  float pectoral = min(mask.r, min(mask.g, mask.b));
  float dorsal = max(0.0, mask.r - pectoral);
  float anal = max(0.0, mask.g - pectoral);
  float clavus = max(0.0, mask.b - pectoral);
  float speedStroke = mix(0.42, 1.0, uMolaSpeed);
  float burstStroke = 1.0 + uMolaBurst * uMolaBurstAmplitude;
  float dorsalRotation = sin(uMolaPhase + uMolaDorsalPhaseOffset) * uMolaFinRotationRadians * speedStroke * burstStroke;
  float analRotation = sin(uMolaPhase * uMolaAnalPhaseRate + uMolaAnalPhaseOffset) * uMolaFinRotationRadians * speedStroke * burstStroke;
  // Raw X maps to the Mola's forward axis. Each fin rotates in raw Y/Z about
  // its own painted attachment root, creating a real tip arc instead of a
  // side-to-side translation. Quintic easing retains the painter's continuous
  // gradient while holding the first few root loops gentler still: no dead-zone
  // hinge, and zero first/second derivative at the rigid attachment.
  float dorsalInfluence = dorsal * dorsal * dorsal * (dorsal * (dorsal * 6.0 - 15.0) + 10.0);
  float dorsalAngle = dorsalInfluence * dorsalRotation;
  float dorsalCos = cos(dorsalAngle);
  float dorsalSin = sin(dorsalAngle);
  float dorsalY = value.y - uMolaDorsalRootYZ.x;
  float dorsalZ = value.z - uMolaDorsalRootYZ.y;
  value.y = uMolaDorsalRootYZ.x + dorsalY * dorsalCos - dorsalZ * dorsalSin;
  value.z = uMolaDorsalRootYZ.y + dorsalY * dorsalSin + dorsalZ * dorsalCos;
  float analInfluence = anal * anal * anal * (anal * (anal * 6.0 - 15.0) + 10.0);
  float analAngle = analInfluence * analRotation;
  float analCos = cos(analAngle);
  float analSin = sin(analAngle);
  float analY = value.y - uMolaAnalRootYZ.x;
  float analZ = value.z - uMolaAnalRootYZ.y;
  value.y = uMolaAnalRootYZ.x + analY * analCos - analZ * analSin;
  value.z = uMolaAnalRootYZ.y + analY * analSin + analZ * analCos;
  float side = value.x < 0.0 ? -1.0 : 1.0;
  float pectoralStroke = sin(uMolaPhase * 0.82 + side * 0.72) * uMolaPectoralAmplitude * speedStroke;
  value.z += pectoral * pectoralStroke;
  value.x += pectoral * side * uMolaTurn * uMolaTurnStrength;
  // The clavus is a restrained rear rudder, never a shark tail.
  value.x += clavus * sin(uMolaPhase * 0.57 + 0.45) * uMolaClavusAmplitude * speedStroke;
  value.z += clavus * uMolaTurn * uMolaTurnStrength;
}` : ''}`
      )
    if (caudalUniforms) {
      shader.vertexShader = shader.vertexShader.replace(
        '#include <beginnormal_vertex>',
        `#include <beginnormal_vertex>
float proceduralNormalOffset;
float proceduralNormalSlope;
proceduralFishCurve(proceduralAxisValue(position, uProceduralSourceAxis), proceduralNormalOffset, proceduralNormalSlope);
proceduralAdjustNormal(objectNormal, uProceduralSourceAxis, uProceduralLateralAxis, proceduralNormalSlope);`
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
float proceduralLateralOffset;
float proceduralLateralSlope;
proceduralFishCurve(proceduralAxisValue(position, uProceduralSourceAxis), proceduralLateralOffset, proceduralLateralSlope);
proceduralAddAxis(transformed, uProceduralLateralAxis, proceduralLateralOffset);`
      )
    }
    if (molaMaskUniforms) {
      shader.vertexShader = shader.vertexShader.replace(
        '#include <project_vertex>',
        `proceduralMolaMotion(transformed);
#include <project_vertex>`
      )
    }
    shader.vertexShader = shader.vertexShader.replace(
        '#include <worldpos_vertex>',
        `#include <worldpos_vertex>
vec4 fishWorldPosition = vec4(transformed, 1.0);
#ifdef USE_INSTANCING
fishWorldPosition = instanceMatrix * fishWorldPosition;
#endif
fishWorldPosition = modelMatrix * fishWorldPosition;
vFishWorldPosition = fishWorldPosition.xyz;`
      )
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
uniform float uFishLightMaskTime;
uniform vec3 uRimColor;
uniform float uRimIntensity;
uniform float uRimPower;
varying vec3 vFishWorldPosition;
float fishMaskHash(vec3 p) {
  p = fract(p * 0.3183099 + vec3(0.17, 0.31, 0.47));
  p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}
float fishMaskNoise(vec3 p) {
  vec3 i = floor(p);
  vec3 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(mix(fishMaskHash(i + vec3(0.0, 0.0, 0.0)), fishMaskHash(i + vec3(1.0, 0.0, 0.0)), f.x),
        mix(fishMaskHash(i + vec3(0.0, 1.0, 0.0)), fishMaskHash(i + vec3(1.0, 1.0, 0.0)), f.x), f.y),
    mix(mix(fishMaskHash(i + vec3(0.0, 0.0, 1.0)), fishMaskHash(i + vec3(1.0, 0.0, 1.0)), f.x),
        mix(fishMaskHash(i + vec3(0.0, 1.0, 1.0)), fishMaskHash(i + vec3(1.0, 1.0, 1.0)), f.x), f.y),
    f.z
  );
}
float fishMaskFbm(vec3 p) {
  float value = 0.0;
  float amplitude = 0.5;
  for (int i = 0; i < 3; i++) {
    value += fishMaskNoise(p) * amplitude;
    p = p * 2.03 + vec3(7.1, 3.7, 5.3);
    amplitude *= 0.5;
  }
  return value;
}`
      )
      .replace(
        '#include <dithering_fragment>',
        `${FISH_LIGHT_MASK_ENABLED ? `vec3 maskPos = vFishWorldPosition;
float t = uFishLightMaskTime;
vec3 warpedPos = maskPos;
warpedPos.x += (fishMaskFbm(maskPos * vec3(0.18, 0.28, 0.16) + vec3(t * 0.018, -t * 0.010, 1.7)) - 0.5) * 4.8;
warpedPos.y += (fishMaskFbm(maskPos * vec3(0.14, 0.22, 0.20) + vec3(3.1, t * 0.014, -t * 0.012)) - 0.5) * 2.6;
warpedPos.z += (fishMaskFbm(maskPos * vec3(0.20, 0.14, 0.18) + vec3(-t * 0.012, 2.4, t * 0.016)) - 0.5) * 4.2;
float broad = fishMaskFbm(warpedPos * vec3(0.34, 0.24, 0.30) + vec3(t * 0.020, 0.0, -t * 0.015));
float mottled = fishMaskFbm(warpedPos * vec3(0.88, 0.52, 0.74) + vec3(4.2, -t * 0.025, t * 0.018));
float softStripeA = sin(warpedPos.x * 0.62 + warpedPos.y * 0.38 + warpedPos.z * 0.42 + t * 0.18);
float softStripeB = sin(warpedPos.x * -0.34 + warpedPos.y * 0.46 + warpedPos.z * 0.72 - t * 0.13);
float brokenLight = broad * 0.58 + mottled * 0.32 + (softStripeA + softStripeB) * 0.05 + 0.05;
float topWeight = smoothstep(-8.0, 3.0, maskPos.y);
float lightFactor = mix(0.82, 1.08, smoothstep(0.22, 0.82, brokenLight));
gl_FragColor.rgb *= mix(1.0, lightFactor, 0.58 * topWeight);` : ''}
float rimAmount = pow(1.0 - abs(dot(normalize(normal), normalize(vViewPosition))), uRimPower);
gl_FragColor.rgb += uRimColor * rimAmount * uRimIntensity;
#include <dithering_fragment>`
      )
  }
  const proceduralKey = !proceduralVertex
    ? 'static'
    : proceduralVertex.type === 'caudal-vertex'
      ? `caudal-vertex:${proceduralSourceAxis}:${proceduralLateralAxis}`
      : `mola-mask-vertex:${proceduralVertex.maskAttribute ?? 'color_1'}`
  material.customProgramCacheKey = () => `fish-light-mask:${FISH_LIGHT_MASK_ENABLED ? 'on' : 'off'}:${rimKey}:${proceduralKey}`
  material.userData.fishLightMaskUniforms = maskUniforms
  if (proceduralUniforms) material.userData.proceduralFishUniforms = proceduralUniforms
  material.needsUpdate = true
}

function applyModelMaterialSettings(root, rim = null, lodDebugColor = null, proceduralAnimation = null) {
  const materials = []
  root.traverse(child => {
    if (!child.isMesh) return
    child.castShadow = false
    child.receiveShadow = false
    const list = Array.isArray(child.material) ? child.material : [child.material]
    const clonedMaterials = list.map(material => {
      if (!material) return material
      const nextMaterial = material.clone()
      nextMaterial.transparent = false
      nextMaterial.opacity = 1
      nextMaterial.depthWrite = true
      nextMaterial.roughness = nextMaterial.roughness ?? 0.5
      if (nextMaterial.name?.toLowerCase() === 'sardine') nextMaterial.roughness = SARDINE_MATERIAL_ROUGHNESS
      if (lodDebugColor && nextMaterial.color) nextMaterial.color.set(lodDebugColor)
      if (lodDebugColor && nextMaterial.emissive) {
        nextMaterial.emissive.set(lodDebugColor)
        nextMaterial.emissiveIntensity = 0.32
      }
      const proceduralMeshConfig = shouldProcedurallyDeformMesh(child, proceduralAnimation) ? proceduralAnimation : null
      if (proceduralMeshConfig) child.geometry.computeBoundingBox()
      applyFishLightMask(
        nextMaterial,
        rim,
        proceduralMeshConfig,
        child.geometry,
      )
      materials.push(nextMaterial)
      return nextMaterial
    })
    child.material = Array.isArray(child.material) ? clonedMaterials : clonedMaterials[0]
  })
  return materials
}

// The Atlas presents the same static GLBs as the tank. Keep its specimens on the
// exact vertex-deformation path rather than falling back to removed authored clips.
// eslint-disable-next-line react-refresh/only-export-components -- shared renderer helper, never a React value
export function prepareProceduralVertexMaterials(root, proceduralAnimation) {
  if (!root || !proceduralAnimation) return []
  const materials = []
  root.traverse(child => {
    if (!child.isMesh || !shouldProcedurallyDeformMesh(child, proceduralAnimation)) return
    child.geometry.computeBoundingBox()
    const list = Array.isArray(child.material) ? child.material : [child.material]
    list.forEach(material => {
      if (!material) return
      applyFishLightMask(material, null, proceduralAnimation, child.geometry)
      materials.push(material)
    })
  })
  return materials
}

// eslint-disable-next-line react-refresh/only-export-components -- shared renderer helper, never a React value
export function updateProceduralVertexMaterials(materials, { phase = 0, speed01 = 0, turn = 0, burst01 = 0 } = {}) {
  materials.forEach(material => {
    const uniforms = material?.userData?.proceduralFishUniforms
    if (!uniforms) return
    uniforms.phase.value = phase
    uniforms.speed.value = THREE.MathUtils.clamp(speed01, 0, 1)
    uniforms.turn.value = THREE.MathUtils.clamp(turn, -1, 1)
    uniforms.burst.value = THREE.MathUtils.clamp(burst01, 0, 1)
  })
}

function animationVariationForCreature(creature) {
  const rand = mulberry32(hashString(`${creature.id ?? creature.species}:animation-variation`))
  const baseSpeed = randomRange(rand, 0.9, 1.1)

  return {
    startOffset: randomRange(rand, 0, 1),
    speeds: {
      idle: baseSpeed,
      slow_cruise: baseSpeed,
      idle_drift: baseSpeed,
      burst: baseSpeed,
      snap_left: baseSpeed,
      snap_right: baseSpeed,
      bank_l: baseSpeed,
      bank_r: baseSpeed,
      default: baseSpeed,
    },
  }
}

function resolveMoveAnimation(model, move) {
  return model?.moveset?.[move] ?? DEFAULT_MOVESET[move] ?? move
}

function resolveModelAnimation(model, animation) {
  return model?.animationMap?.[animation] ?? animation
}

function shouldLoopModelAnimation(model, animation, resolvedAnimation) {
  if (animation === 'idle') return true
  return model?.loopAnimations?.includes(resolvedAnimation) ?? false
}

function modelFadeDuration(model, fallback = 0.18) {
  return model?.animationFadeDuration ?? fallback
}

function modelAnimationSpeed(model, animationVariation, animation, resolvedAnimation) {
  const modelTimeScale = Number.isFinite(model?.animationTimeScale) ? model.animationTimeScale : 1
  const speed = animationVariation?.speeds?.[resolvedAnimation]
    ?? animationVariation?.speeds?.[animation]
    ?? animationVariation?.speeds?.default
    ?? 1
  return speed * modelTimeScale * GLOBAL_ANIMATION_TIME_SCALE
}

function modelActionAnimationDuration(model, animation, fallback) {
  const resolvedAnimation = resolveModelAnimation(model, animation)
  const duration = model?.actionAnimationDurations?.[resolvedAnimation]
    ?? model?.actionAnimationDurations?.[animation]
  return Number.isFinite(duration) && duration > 0 ? duration : fallback
}

// How long a fish holds a boid decision before re-deciding: about one cycle of its
// current swim clip (so a movement decision lasts as long as the animation driving it),
// clamped and per-fish jittered so a school does not re-decide in lockstep.
function boidDecisionInterval(model, animation, jitterUnit) {
  const clip = modelActionAnimationDuration(model, animation, 1.4)
  const base = THREE.MathUtils.clamp(clip, BOID_DECISION_MIN_INTERVAL, BOID_DECISION_MAX_INTERVAL)
  return base * (1 + (jitterUnit - 0.5) * 2 * BOID_DECISION_JITTER)
}

function modelActionMovementDelay(model, animation, fallback = 0) {
  const resolvedAnimation = resolveModelAnimation(model, animation)
  const delay = model?.actionMovementDelayOverrides?.[resolvedAnimation]
    ?? model?.actionMovementDelayOverrides?.[animation]
  return Number.isFinite(delay) && delay >= 0 ? delay : fallback
}

function configureModelAction(action, model, animation, resolvedAnimation, speed, offset) {
  action.enabled = true
  action.userData ??= {}
  action.userData.baseTimeScale = speed
  action.setEffectiveTimeScale(speed)

  if (shouldLoopModelAnimation(model, animation, resolvedAnimation)) {
    action.setLoop(THREE.LoopRepeat, Infinity)
    action.clampWhenFinished = false
    action.time = (action.getClip()?.duration ?? 0) * offset
  } else {
    action.setLoop(THREE.LoopOnce, 1)
    action.clampWhenFinished = true
    action.time = 0
  }
}

function playModelAction(actions, activeActionRef, model, animation, animationVariation) {
  const resolvedAnimation = resolveModelAnimation(model, animation)
  const nextAction = actions[resolvedAnimation] ?? actions[animation] ?? actions.idle ?? Object.values(actions)[0]
  if (!nextAction || activeActionRef.current === nextAction) return

  const speed = modelAnimationSpeed(model, animationVariation, animation, resolvedAnimation)
  const offset = animationVariation?.startOffset ?? 0

  nextAction.reset()
  nextAction.setEffectiveWeight(1)
  configureModelAction(nextAction, model, animation, resolvedAnimation, speed, offset)

  const previousAction = activeActionRef.current
  nextAction.play()
  if (previousAction) nextAction.crossFadeFrom(previousAction, modelFadeDuration(model, 0.12), false)

  activeActionRef.current = nextAction
}

function isSunBaskAnimationName(name) {
  return SUN_BASK_ANIMATION_NAMES.has(name)
}

function sunBaskAnimationFadeDuration(model, animation, resolvedAnimation) {
  if (isSunBaskAnimationName(animation) || isSunBaskAnimationName(resolvedAnimation)) {
    return modelFadeDuration(model, MOLA_SUN_BASK_ANIMATION_FADE_DURATION)
  }
  return modelFadeDuration(model)
}

function layeredAnimationClips(gltfAnimations, model) {
  // Keep authored clips intact. Sun-bask playback is isolated at action time so
  // the complete authored bask clip plays alone, with no cruise base or overlay
  // surgery that can introduce partial-rig conflicts.
  return gltfAnimations
}

function playLayeredModelAction(actions, activeActionRef, model, animation, animationVariation) {
  const baseAnimation = model.layeredBaseAnimation ?? resolveMoveAnimation(model, 'cruise')
  const baseAction = actions[baseAnimation]
  const offset = animationVariation?.startOffset ?? 0
  const resolvedAnimation = resolveModelAnimation(model, animation)

  if (isSunBaskAnimationName(animation) || isSunBaskAnimationName(resolvedAnimation)) {
    const sunBaskAction = actions[resolvedAnimation] ?? actions[animation]
    if (!sunBaskAction || activeActionRef.current === sunBaskAction) return

    const entryFadeDuration = modelFadeDuration(model, MOLA_SUN_BASK_ANIMATION_ENTRY_FADE_DURATION)
    const previousActions = Object.values(actions).filter(action => (
      action && action !== sunBaskAction && action.isRunning()
    ))
    const shouldEaseEntry = entryFadeDuration > 0 && previousActions.length > 0
    Object.values(actions).forEach(action => {
      if (!action || action === sunBaskAction) return
      if (shouldEaseEntry && action.isRunning()) action.fadeOut(entryFadeDuration)
      else action.stop()
    })

    const speed = modelAnimationSpeed(model, animationVariation, animation, resolvedAnimation) * MOLA_SUN_BASK_ANIMATION_SPEED_SCALE
    sunBaskAction.reset()
    sunBaskAction.setEffectiveWeight(1)
    configureModelAction(sunBaskAction, model, animation, resolvedAnimation, speed, 0)
    sunBaskAction.play()
    if (shouldEaseEntry) {
      sunBaskAction.fadeIn(entryFadeDuration)
      globalThis.setTimeout?.(() => {
        if (!sunBaskAction.isRunning()) return
        previousActions.forEach(action => action.stop())
      }, entryFadeDuration * 1000 + 50)
    }
    activeActionRef.current = sunBaskAction
    return
  }

  const previousOverlay = activeActionRef.current
  const previousWasSunBask = previousOverlay
    && previousOverlay !== baseAction
    && isSunBaskAnimationName(previousOverlay.getClip?.()?.name)
  const sunBaskExitFadeDuration = modelFadeDuration(model, MOLA_SUN_BASK_ANIMATION_ENTRY_FADE_DURATION)

  if (baseAction && !baseAction.isRunning()) {
    const speed = modelAnimationSpeed(model, animationVariation, baseAnimation, baseAnimation)
    baseAction.reset()
    baseAction.setEffectiveWeight(model.layeredBaseWeight ?? 1)
    configureModelAction(baseAction, model, baseAnimation, baseAnimation, speed, offset)
    baseAction.play()
    if (previousWasSunBask) baseAction.fadeIn(sunBaskExitFadeDuration)
  }

  if (resolvedAnimation === baseAnimation) {
    if (previousOverlay && previousOverlay !== baseAction) previousOverlay.fadeOut(previousWasSunBask ? sunBaskExitFadeDuration : modelFadeDuration(model))
    activeActionRef.current = null
    return
  }

  const nextAction = actions[resolvedAnimation] ?? actions[animation]
  if (!nextAction || activeActionRef.current === nextAction) return

  const speed = modelAnimationSpeed(model, animationVariation, animation, resolvedAnimation)
  nextAction.reset()
  nextAction.setEffectiveWeight(model.layeredOverlayWeight ?? 1)
  configureModelAction(nextAction, model, animation, resolvedAnimation, speed, offset)
  nextAction.play()
  nextAction.fadeIn(sunBaskAnimationFadeDuration(model, animation, resolvedAnimation))
  if (previousOverlay) previousOverlay.fadeOut(sunBaskAnimationFadeDuration(model, animation, resolvedAnimation))
  activeActionRef.current = nextAction
}

function MolaMolaPlaceholder({ species, swim, rimColor = null, rimIntensity = 0 }) {
  const dims = placeholderDimensions(species, swim)
  const bodyColor = species?.placeholder?.bodyColor ?? '#8fb8bc'
  const finColor = species?.placeholder?.finColor ?? '#6f9fa4'
  const rim = rimColor ?? '#000000'

  return (
    <group raycast={() => null}>
      {rimColor && (
        <mesh scale={[dims.length * 1.04, dims.height * 1.04, dims.thickness * 1.08]}>
          <sphereGeometry args={[0.5, 36, 18]} />
          <meshBasicMaterial color={rim} transparent opacity={0.34} depthWrite={false} depthTest side={THREE.BackSide} />
        </mesh>
      )}
      <mesh scale={[dims.length, dims.height, dims.thickness]}>
        <sphereGeometry args={[0.5, 48, 24]} />
        <meshStandardMaterial color={bodyColor} roughness={0.46} metalness={0.02} envMapIntensity={0.9} />
      </mesh>
      <mesh position={[dims.length * -0.08, dims.height * 0.48, 0]} rotation={[0, 0, Math.PI]} scale={[dims.length * 0.08, dims.height * 0.34, dims.thickness * 0.58]}>
        <coneGeometry args={[1, 1, 3]} />
        <meshStandardMaterial color={finColor} roughness={0.56} metalness={0.01} envMapIntensity={0.75} />
      </mesh>
      <mesh position={[dims.length * -0.08, dims.height * -0.48, 0]} scale={[dims.length * 0.08, dims.height * 0.34, dims.thickness * 0.58]}>
        <coneGeometry args={[1, 1, 3]} />
        <meshStandardMaterial color={finColor} roughness={0.56} metalness={0.01} envMapIntensity={0.75} />
      </mesh>
      <mesh position={[dims.length * -0.50, 0, 0]} rotation={[0, 0, Math.PI / 2]} scale={[dims.thickness * 0.45, dims.height * 0.22, dims.thickness * 0.36]}>
        <coneGeometry args={[1, 1, 3]} />
        <meshStandardMaterial color={finColor} roughness={0.58} metalness={0.01} envMapIntensity={0.7} />
      </mesh>
    </group>
  )
}

function collectCurveDeformBones(object, model) {
  const names = (model?.proceduralAnimation ?? model?.curveDeform)?.bones
  if (!Array.isArray(names) || names.length === 0) return []
  const objectsByNormalizedName = new Map()
  object.traverse(child => {
    if (!child?.name) return
    objectsByNormalizedName.set(normalizeCurveDeformBoneName(child.name), child)
  })
  const found = []
  names.forEach(name => {
    const bone = object.getObjectByName(name) ?? objectsByNormalizedName.get(normalizeCurveDeformBoneName(name))
    if (bone?.isBone) found.push(bone)
  })
  return found
}

function normalizeCurveDeformBoneName(name) {
  return String(name).toLowerCase().replace(/[^a-z0-9]/g, '')
}

function curveDeformAxis(config) {
  if (config?.axis === 'x') return curveDeformAxisX
  if (config?.axis === 'y') return curveDeformAxisY
  return curveDeformAxisZ
}

function proceduralAxisIndex(axis, fallback) {
  if (axis === 'x') return 0
  if (axis === 'y') return 1
  if (axis === 'z') return 2
  return fallback
}

function proceduralAxisMin(bounds, axisIndex) {
  if (axisIndex === 0) return bounds.min.x
  if (axisIndex === 1) return bounds.min.y
  return bounds.min.z
}

function proceduralAxisMax(bounds, axisIndex) {
  if (axisIndex === 0) return bounds.max.x
  if (axisIndex === 1) return bounds.max.y
  return bounds.max.z
}

function shouldProcedurallyDeformMesh(mesh, proceduralAnimation) {
  if (!['caudal-vertex', 'mola-mask-vertex'].includes(proceduralAnimation?.type)) return false
  const name = mesh.name?.toLowerCase() ?? ''
  if (proceduralAnimation.bodyMeshNames?.some(bodyName => name === bodyName.toLowerCase())) return true
  if (proceduralAnimation.bodyMeshPatterns?.some(pattern => name.includes(pattern.toLowerCase()))) return true
  if (/pectoral|pelvic|fin|flipper|eye|jaw|mouth/.test(name)) return false
  return true
}

function collectProceduralFinMeshes(object) {
  const fins = []
  object.traverse(child => {
    if (!child.isMesh) return
    const name = child.name?.toLowerCase() ?? ''
    const isPectoral = name.includes('pectoral')
    const isPelvic = name.includes('pelvic')
    if (!isPectoral && !isPelvic) return
    fins.push({
      mesh: child,
      baseQuaternion: child.quaternion.clone(),
      side: name.endsWith('r') || name.includes('.r') || name.includes('-r') ? -1 : 1,
      kind: isPectoral ? 'pectoral' : 'pelvic',
    })
  })
  return fins
}

function curveDeformMaxAngle(config) {
  const degrees = Number.isFinite(config?.maxAngleDegrees) ? config.maxAngleDegrees : 0
  return THREE.MathUtils.degToRad(THREE.MathUtils.clamp(degrees, 0, 24))
}

function ensureCurveDeformState(state, count) {
  for (let index = state.previousAdditives.length; index < count; index += 1) {
    state.previousAdditives.push(new THREE.Quaternion())
    state.postAdditiveQuaternions.push(new THREE.Quaternion())
    state.hasPreviousAdditive.push(false)
  }
  state.previousAdditives.length = count
  state.postAdditiveQuaternions.length = count
  state.hasPreviousAdditive.length = count
}

function removePreviousCurveDeformAdditive(bone, state, index, scratchQuat) {
  if (!state.hasPreviousAdditive[index]) return
  const postAdditive = state.postAdditiveQuaternions[index]
  if (bone.quaternion.angleTo(postAdditive) > 0.0001) {
    state.hasPreviousAdditive[index] = false
    return
  }
  scratchQuat.copy(state.previousAdditives[index]).invert()
  bone.quaternion.multiply(scratchQuat)
  state.hasPreviousAdditive[index] = false
}

function collectModelBones(object) {
  const bones = []
  object.traverse(child => {
    if (child?.isBone) bones.push(child)
  })
  return bones
}

function BoneDebugOverlay({ object, bones, modelScale = 1, parentScale = 1 }) {
  const markerRefs = useRef([])
  const labelRefs = useRef([])
  const scratchWorldPositionRef = useRef(new THREE.Vector3())
  const localPositions = useMemo(
    () => bones.map(() => new THREE.Vector3()),
    [bones],
  )
  const boneIndices = useMemo(() => new Map(bones.map((bone, index) => [bone.uuid, index])), [bones])
  const boneSegments = useMemo(() => {
    const segments = []
    bones.forEach((bone, index) => {
      const parentIndex = bone.parent?.isBone ? boneIndices.get(bone.parent.uuid) : undefined
      if (Number.isInteger(parentIndex)) segments.push([parentIndex, index])
    })
    return segments
  }, [bones, boneIndices])
  const lineGeometry = useMemo(() => {
    const geometry = new THREE.BufferGeometry()
    const pointCount = Math.max(2, boneSegments.length * 2)
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(pointCount * 3), 3))
    return geometry
  }, [boneSegments.length])
  const markerScale = THREE.MathUtils.clamp(0.055 / Math.max(0.001, modelScale), 0.035, 0.12)
  const labelScale = DEBUG_NAME_LABEL_SCALE / Math.max(0.001, modelScale * parentScale)

  useFrame(() => {
    if (!object || bones.length === 0) return
    object.updateWorldMatrix(true, true)
    const scratch = scratchWorldPositionRef.current
    bones.forEach((bone, index) => {
      bone.getWorldPosition(scratch)
      localPositions[index].copy(scratch)
      object.worldToLocal(localPositions[index])
      const marker = markerRefs.current[index]
      if (marker) marker.position.copy(localPositions[index])
      const label = labelRefs.current[index]
      if (label) label.position.copy(localPositions[index]).addScalar(markerScale * 1.15)
    })
    const positionAttribute = lineGeometry.getAttribute('position')
    let cursor = 0
    boneSegments.forEach(([startIndex, endIndex]) => {
      const start = localPositions[startIndex]
      const end = localPositions[endIndex]
      positionAttribute.setXYZ(cursor, start.x, start.y, start.z)
      positionAttribute.setXYZ(cursor + 1, end.x, end.y, end.z)
      cursor += 2
    })
    while (cursor < positionAttribute.count) {
      const fallback = localPositions[0] ?? scratch.set(0, 0, 0)
      positionAttribute.setXYZ(cursor, fallback.x, fallback.y, fallback.z)
      cursor += 1
    }
    positionAttribute.needsUpdate = true
    lineGeometry.computeBoundingSphere()
  })

  if (bones.length === 0) return null

  return (
    <group raycast={() => null}>
      <lineSegments geometry={lineGeometry} raycast={() => null} renderOrder={45}>
        <lineBasicMaterial color="#35f7ff" transparent opacity={0.92} depthTest={false} depthWrite={false} />
      </lineSegments>
      {bones.map((bone, index) => (
        <group key={`${bone.uuid}:${index}`}>
          <mesh
            ref={element => { markerRefs.current[index] = element }}
            scale={markerScale}
            raycast={() => null}
            renderOrder={46}
          >
            <sphereGeometry args={[1, 8, 8]} />
            <meshBasicMaterial color={bone.parent?.isBone ? '#35f7ff' : '#ffec6a'} transparent opacity={0.9} depthTest={false} depthWrite={false} />
          </mesh>
          <Billboard
            ref={element => { labelRefs.current[index] = element }}
            follow
            raycast={() => null}
            renderOrder={80}
          >
            <Text
              fontSize={labelScale}
              font={DEBUG_LABEL_FONT}
              fontWeight="normal"
              color="#eaffff"
              anchorX="left"
              anchorY="middle"
              depthTest={false}
              depthWrite={false}
              renderOrder={81}
              material-depthTest={false}
              material-depthWrite={false}
              material-transparent
              material-toneMapped={false}
              raycast={() => null}
            >
              {bone.name}
            </Text>
          </Billboard>
        </group>
      ))}
    </group>
  )
}

function FishModel({ model, animation = 'idle', animationVariation, animationSpeedScaleRef = null, curveDeformInputRef = null, debugSimulationSpeed = 1, debugCurveBones = false, debugParentScale = 1, rim = null, lodDebugColor = null }) {
  const gltf = useGLTF(model.path)
  const object = useMemo(() => clone(gltf.scene), [gltf.scene])
  // Procedural species intentionally ignore every authored GLB clip. The rig is
  // only a deformation lattice: live speed/turn/burst signals drive its neutral
  // bind pose directly, so future assets need no animation timeline.
  const animations = useMemo(
    () => (model?.proceduralAnimation ? [] : layeredAnimationClips(gltf.animations, model)),
    [gltf.animations, model],
  )
  const curveDeformBones = useMemo(() => collectCurveDeformBones(object, model), [object, model])
  const proceduralFinMeshes = useMemo(() => collectProceduralFinMeshes(object), [object])
  const debugBones = useMemo(() => collectModelBones(object), [object])
  const { actions } = useAnimations(animations, object)
  const activeActionRef = useRef(null)
  const materialsRef = useRef([])
  const curveDeformTurnRef = useRef(0)
  const proceduralWaveClockRef = useRef(0)
  const curveDeformQuatRef = useRef(new THREE.Quaternion())
  const curveDeformScratchQuatRef = useRef(new THREE.Quaternion())
  const curveDeformStateRef = useRef({
    previousAdditives: [],
    postAdditiveQuaternions: [],
    hasPreviousAdditive: [],
  })

  useEffect(() => {
    materialsRef.current = applyModelMaterialSettings(object, rim, lodDebugColor, model?.proceduralAnimation)
  }, [object, rim, lodDebugColor, model])

  useFrame(({ clock }, rawDelta) => {
    const elapsed = clock.getElapsedTime()
    const activeAction = activeActionRef.current
    const simulationSpeed = THREE.MathUtils.clamp(
      Number.isFinite(debugSimulationSpeed) ? debugSimulationSpeed : 1,
      1,
      10,
    )
    if (activeAction) {
      const baseTimeScale = activeAction.userData?.baseTimeScale ?? 1
      const runtimeAnimationScale = model?.lockAnimationPlayback ? 1 : (animationSpeedScaleRef?.current ?? 1)
      const debugAnimationScale = model?.lockAnimationPlayback ? 1 : simulationSpeed
      activeAction.setEffectiveTimeScale(baseTimeScale * runtimeAnimationScale * debugAnimationScale)
    }
    const curveConfig = model?.proceduralAnimation ?? model?.curveDeform
    const proceduralInput = curveDeformInputRef?.current ?? {}
    if (curveConfig?.type === 'caudal-vertex') {
      const response = Number.isFinite(curveConfig.response) ? Math.max(0.01, curveConfig.response) : 7
      curveDeformTurnRef.current = THREE.MathUtils.damp(
        curveDeformTurnRef.current,
        THREE.MathUtils.clamp(proceduralInput.turn ?? 0, -1, 1),
        response,
        rawDelta * simulationSpeed,
      )
      const speed01 = THREE.MathUtils.clamp(proceduralInput.speed01 ?? 0, 0, 1)
      const burst01 = THREE.MathUtils.clamp(proceduralInput.burst01 ?? 0, 0, 1)
      const waveSpeed = Number.isFinite(curveConfig.waveSpeed) ? curveConfig.waveSpeed : 2.3
      proceduralWaveClockRef.current += rawDelta * simulationSpeed * waveSpeed * (
        1
        + speed01 * (curveConfig.speedFrequencyBoost ?? 0.32)
        + burst01 * (curveConfig.burstFrequencyBoost ?? 0.24)
        + Math.max(0, proceduralInput.accel01 ?? 0) * 0.1
      )
      proceduralFinMeshes.forEach((fin, index) => {
        const pectoralScale = Number.isFinite(curveConfig.pectoralFinFlutter) ? curveConfig.pectoralFinFlutter : 0.12
        const pelvicScale = Number.isFinite(curveConfig.pelvicFinFlutter) ? curveConfig.pelvicFinFlutter : 0.07
        const flutterScale = fin.kind === 'pectoral' ? pectoralScale : pelvicScale
        const phase = proceduralWaveClockRef.current * (fin.kind === 'pectoral' ? 1.35 : 0.72)
          + (proceduralInput.phase ?? 0)
          + index * 0.83
          + fin.side * 0.4
        const stroke = flutterScale * (0.35 + speed01 * 0.5 + burst01 * 0.45)
        curveDeformQuatRef.current.setFromEuler(new THREE.Euler(
          Math.sin(phase) * stroke * 0.45,
          fin.side * Math.sin(phase * 0.7 + 0.6) * stroke * 0.55,
          fin.side * Math.sin(phase + 1.2) * stroke,
        ))
        fin.mesh.quaternion.copy(fin.baseQuaternion).multiply(curveDeformQuatRef.current)
      })
    } else if (curveConfig?.type === 'mola-mask-vertex') {
      const response = Number.isFinite(curveConfig.response) ? Math.max(0.01, curveConfig.response) : 3.2
      curveDeformTurnRef.current = THREE.MathUtils.damp(
        curveDeformTurnRef.current,
        THREE.MathUtils.clamp(proceduralInput.turn ?? 0, -1, 1),
        response,
        rawDelta * simulationSpeed,
      )
      const speed01 = THREE.MathUtils.clamp(proceduralInput.speed01 ?? 0, 0, 1)
      const burst01 = THREE.MathUtils.clamp(proceduralInput.burst01 ?? 0, 0, 1)
      const waveSpeed = Number.isFinite(curveConfig.waveSpeed) ? curveConfig.waveSpeed : 0.92
      proceduralWaveClockRef.current += rawDelta * simulationSpeed * waveSpeed * (
        1
        + speed01 * (curveConfig.speedFrequencyBoost ?? 0.22)
        + burst01 * (curveConfig.burstFrequencyBoost ?? 0.18)
        + Math.max(0, proceduralInput.accel01 ?? 0) * 0.08
      )
    }
    if (curveConfig && curveDeformBones.length > 0) {
      const curveState = curveDeformStateRef.current
      ensureCurveDeformState(curveState, curveDeformBones.length)
      const scratchQuat = curveDeformScratchQuatRef.current
      const input = curveDeformInputRef?.current ?? {}
      const strength = Number.isFinite(curveConfig.strength) ? curveConfig.strength : 0
      const maxAngle = curveDeformMaxAngle(curveConfig)
      const response = Number.isFinite(curveConfig.response) ? Math.max(0.01, curveConfig.response) : 5
      const targetTurn = THREE.MathUtils.clamp(input.turn ?? 0, -1, 1)
      curveDeformTurnRef.current = THREE.MathUtils.damp(
        curveDeformTurnRef.current,
        targetTurn,
        response,
        rawDelta * simulationSpeed,
      )
      const burstBoost = 1 + (Number.isFinite(curveConfig.burstBoost) ? curveConfig.burstBoost : 0) * THREE.MathUtils.clamp(input.burst01 ?? 0, 0, 1)
      const speedBoost = 1 + (Number.isFinite(curveConfig.speedBoost) ? curveConfig.speedBoost : 0) * THREE.MathUtils.clamp(input.speed01 ?? 0, 0, 1)
      const accelerationBoost = 1 + (Number.isFinite(curveConfig.accelerationBoost) ? curveConfig.accelerationBoost : 0) * Math.max(0, input.accel01 ?? 0)
      // Optionally ease the turn bend back toward straight as actual forward speed drops,
      // so a fish crawling out of a turn straightens its tail before swimming on instead
      // of holding a full sideways bend while barely moving.
      const speedEase = curveConfig.easeStraightenBySpeed
        ? THREE.MathUtils.lerp(
          Number.isFinite(curveConfig.straightenFloor) ? curveConfig.straightenFloor : 0.12,
          1,
          THREE.MathUtils.clamp(input.speedEase01 ?? 1, 0, 1),
        )
        : 1
      const baseAngle = THREE.MathUtils.clamp(
        curveDeformTurnRef.current * strength * burstBoost * speedBoost * accelerationBoost * speedEase * maxAngle,
        -maxAngle,
        maxAngle,
      )
      const idleSwayAngle = THREE.MathUtils.degToRad(THREE.MathUtils.clamp(
        Number.isFinite(curveConfig.idleSwayDegrees) ? curveConfig.idleSwayDegrees : 0,
        0,
        10,
      ))
      const idleSwaySpeed = Number.isFinite(curveConfig.idleSwaySpeed) ? Math.max(0.01, curveConfig.idleSwaySpeed) : 1.35
      const idleSwayPhaseOffset = Number.isFinite(curveConfig.idleSwayPhaseOffset) ? curveConfig.idleSwayPhaseOffset : 1.15
      const idleSwaySpeedBoost = 1 + (Number.isFinite(curveConfig.idleSwaySpeedBoost) ? curveConfig.idleSwaySpeedBoost : 0) * THREE.MathUtils.clamp(input.speed01 ?? 0, 0, 1)
      const speedFrequencyBoost = Number.isFinite(curveConfig.speedFrequencyBoost) ? curveConfig.speedFrequencyBoost : 0.45
      const burstFrequencyBoost = Number.isFinite(curveConfig.burstFrequencyBoost) ? curveConfig.burstFrequencyBoost : 0.35
      const tailBias = Number.isFinite(curveConfig.tailBias) ? Math.max(0.1, curveConfig.tailBias) : 1
      const baseWeight = Number.isFinite(curveConfig.baseWeight)
        ? THREE.MathUtils.clamp(curveConfig.baseWeight, 0, 1)
        : 0
      const chainMultiplier = Number.isFinite(curveConfig.chainMultiplier)
        ? THREE.MathUtils.clamp(curveConfig.chainMultiplier, 0.5, 1.5)
        : 1
      // Integrate frequency into a continuous per-fish clock. Multiplying global
      // elapsed time by live speed would jump phase whenever speed/burst changes.
      proceduralWaveClockRef.current += rawDelta * simulationSpeed * idleSwaySpeed * (
        1
        + THREE.MathUtils.clamp(input.speed01 ?? 0, 0, 1) * speedFrequencyBoost
        + THREE.MathUtils.clamp(input.burst01 ?? 0, 0, 1) * burstFrequencyBoost
        + Math.max(0, input.accel01 ?? 0) * 0.12
      )
      const idleSwayPhase = proceduralWaveClockRef.current + (input.phase ?? 0)
      const phase = idleSwayPhase * 0.62
      const bendAxis = curveDeformAxis(curveConfig)
      let previousCumulativeAngle = 0
      curveDeformBones.forEach((bone, index) => {
        removePreviousCurveDeformAdditive(bone, curveState, index, scratchQuat)
        const ratio = curveDeformBones.length <= 1 ? 1 : index / (curveDeformBones.length - 1)
        const chainWeight = Math.pow(chainMultiplier, index)
        const tailWeight = THREE.MathUtils.lerp(baseWeight, 1, Math.pow(ratio, tailBias)) * chainWeight
        const followThrough = Math.sin(phase - ratio * 1.15) * 0.24 * Math.abs(baseAngle)
        const idleSway = Math.sin(idleSwayPhase - ratio * idleSwayPhaseOffset) * idleSwayAngle * idleSwaySpeedBoost * tailWeight
        // Clamp only the STATIC turn bend to the configured max (tailWeight /
        // chainMultiplier^index can otherwise overshoot into a kink). Follow-through and
        // idle sway stay additive on top so the tail keeps waving (swimming) through a
        // sustained turn instead of freezing at the clamp.
        const staticBend = THREE.MathUtils.clamp(baseAngle * tailWeight, -maxAngle, maxAngle)
        // Bone rotations accumulate down a hierarchy. Treat each formula result as
        // desired CUMULATIVE spine curvature, then apply only its delta from the
        // previous joint. Applying the full angle to every bone folds the tail like
        // a hinge even when every individual angle looks conservative.
        const cumulativeAngle = staticBend + followThrough + idleSway
        const localAngle = cumulativeAngle - previousCumulativeAngle
        previousCumulativeAngle = cumulativeAngle
        curveDeformQuatRef.current.setFromAxisAngle(bendAxis, localAngle)
        bone.quaternion.multiply(curveDeformQuatRef.current)
        curveState.previousAdditives[index].copy(curveDeformQuatRef.current)
        curveState.postAdditiveQuaternions[index].copy(bone.quaternion)
        curveState.hasPreviousAdditive[index] = true
      })
    }
    materialsRef.current.forEach(material => {
      const uniforms = material?.userData?.fishLightMaskUniforms
      if (uniforms) uniforms.uTime.value = elapsed
      const proceduralUniforms = material?.userData?.proceduralFishUniforms
      if (proceduralUniforms) {
        proceduralUniforms.phase.value = proceduralWaveClockRef.current + (proceduralInput.phase ?? 0)
        proceduralUniforms.speed.value = THREE.MathUtils.clamp(proceduralInput.speed01 ?? 0, 0, 1)
        proceduralUniforms.turn.value = curveDeformTurnRef.current
        proceduralUniforms.burst.value = THREE.MathUtils.clamp(proceduralInput.burst01 ?? 0, 0, 1)
      }
    })
  })

  useEffect(() => {
    if (model?.proceduralAnimation) return
    if (model?.layeredAnimations) {
      playLayeredModelAction(actions, activeActionRef, model, animation, animationVariation)
      return
    }
    playModelAction(actions, activeActionRef, model, animation, animationVariation)
  }, [actions, model, animation, animationVariation])

  return (
    <group
      scale={model.scale ?? 1}
      rotation={model.rotation ?? [0, 0, 0]}
      position={model.position ?? [0, 0, 0]}
    >
      <primitive object={object} />
      {debugCurveBones && debugBones.length > 0 && (
        <BoneDebugOverlay object={object} bones={debugBones} modelScale={model.scale ?? 1} parentScale={debugParentScale} />
      )}
    </group>
  )
}

export default function Fish({ creature, selected = false, zoomActive = false, debugSunBaskRequestId = 0, soloRuntimeRecoveryEnabled = true, hideSelectionSilhouette = false, debug = false, debugLayers = null, debugLodView = false, debugSimulationSpeed = 1, school = null, modelVariantKey = null, onClick, onReady, onRuntimeRecoveryNeeded }) {
  const ref = useRef()
  // Persistent kinematic snapshot for this creature. Survives unmount/remount so switching tanks
  // resumes movement instead of re-seeding. Object-valued fields below are shared by reference
  // (the sim writes through to the store); scalar fields are hydrated here and mirrored back at
  // the end of each frame. See fishRuntimeStore.js.
  const runtime = useMemo(() => getFishRuntime(creature.id), [creature.id])
  const modelRootRef = useRef()
  const forwardLineRef = useRef()
  const boidSeparationLineRef = useRef()
  const boidAlignmentLineRef = useRef()
  const boidCohesionLineRef = useRef()
  const boidThreatLineRef = useRef()
  const boidResultLineRef = useRef()
  const boidLabelRef = useRef()
  // Per-neighbor debug lines: a connector fish->neighbor (colored by relation) and a
  // short tick showing the neighbor's own heading. Fixed pools so nothing allocates.
  const boidNeighborLineRefs = useRef([])
  const boidNeighborHeadingRefs = useRef([])
  const speedLabelRef = useRef()
  const agentLabelRef = useRef()
  const nameLabelRef = useRef()
  const swim = useMemo(() => resolveSwimProfile(creature), [creature])
  const species = useMemo(() => resolveSpecies(creature), [creature])
  const model = useMemo(() => resolveModel(creature, modelVariantKey), [creature, modelVariantKey])
  const canInstanceSardine = model?.path?.includes('/sardine/') && creature.species === 'Spotted Sardinella'
  const animationVariation = useMemo(() => animationVariationForCreature(creature), [creature])
  const schoolOffset = useMemo(() => schoolFormationOffset(school, creature), [school, creature])
  const isSchooling = Boolean(schoolOffset)
  const size = creature.size ?? 1
  const organicMotion = useMemo(() => {
    const rand = mulberry32(hashString(`${school?.id ?? 'solo'}:${creature.id ?? creature.species}:organic-motion`))
    return {
      speedScale: isSchooling ? randomRange(rand, PERSONAL_SPEED_SCALE[0], PERSONAL_SPEED_SCALE[1]) : 1,
      catchupScale: isSchooling ? randomRange(rand, PERSONAL_CATCHUP_SCALE[0], PERSONAL_CATCHUP_SCALE[1]) : 1,
      noiseSeed: Math.floor(randomRange(rand, 1, 0xFFFFFFFF)) >>> 0,
    }
  }, [creature, isSchooling, school?.id])
  const isSchoolLeader = isSchooling && school.index === 0
  // Any creature not currently part of a school runs the solo-agent movement path: the
  // designed solitary hunters (mako/mola, schooling === false) and — critically — a schooling
  // species that failed to pair up (an odd-count / orphaned mahi that Biome dropped from its
  // school). Without covering that orphan it matched neither movement mode, held its heading
  // into a wall, and froze there. This is data-dependent: it surfaces when the live creature
  // set has an odd count in a biome/depthZone (e.g. a paired mahi died), not on the even
  // static/dev set.
  const isSoloAgent = Boolean(species) && !isSchooling
  // Only the designed solitary hunters surface the agent debug readout; an orphaned schooling
  // fish roams on the same path but shouldn't spawn debug labels/vectors in the tank.
  const showAgentDebug = isSoloAgent && species.schooling === false
  const schoolState = useMemo(() => (isSchooling ? getSchoolState(school, creature, swim) : null), [isSchooling, school, creature, swim])
  const followTarget = useRef(new THREE.Vector3())
  const agentTarget = useRef(new THREE.Vector3())
  const agentRand = useRef(mulberry32(hashString(`${creature.id ?? creature.species}:solo-agent`)))
  const agentHasTarget = useRef(false)
  const nextAgentRetargetAt = useRef(0)
  const agentStatus = useRef('cruise')
  const agentBehavior = useRef(null)
  const agentBehaviorStartedAt = useRef(0)
  const agentBehaviorDistance = useRef(0)
  const agentDepthMode = useRef('deep')
  const agentDepthTargetsRemaining = useRef(0)
  const lastSunBaskAt = useRef(-Infinity)
  const sunBaskQueued = useRef(false)
  const queuedSunBaskRequestId = useRef(0)
  const lastFollowRecoveryExitAt = useRef(-Infinity)
  const runtimeRecoveryFade = useRef({ phase: 'idle', startedAt: 0 })
  const simulationTime = useRef(runtime.simulationTime)
  const smoothedBoidSteering = useRef(runtime.smoothedBoidSteering)
  // Boid decisions are committed and held for ~one animation cycle, then re-decided.
  // Between ticks the committed vector is eased in, so heading changes are smooth and
  // infrequent instead of recomputed every frame.
  const committedBoidSteering = useRef(runtime.committedBoidSteering)
  const boidDecisionNextAt = useRef(runtime.boidDecisionNextAt)
  const boidDecisionJitter = useRef(Math.random())
  const boidDebugState = useRef({
    separation: new THREE.Vector3(),
    alignment: new THREE.Vector3(),
    cohesion: new THREE.Vector3(),
    threat: new THREE.Vector3(),
    result: new THREE.Vector3(),
    neighborCount: 0,
    socialWeightTotal: 0,
    perceptionRadius: 0,
    neighborActive: 0,
    neighbors: Array.from({ length: BOID_MAX_DEBUG_NEIGHBORS }, () => ({
      id: null,
      pos: new THREE.Vector3(),
      forward: new THREE.Vector3(0, 0, -1),
      relation: 'neutral',
      socialWeight: 0,
    })),
  })
  const repulserDrift = useRef(new THREE.Vector3())
  const desiredDirection = useRef(runtime.desiredDirection)
  const labelPosition = useRef(new THREE.Vector3())
  const previousPosition = useRef(runtime.previousPosition)
  const hasFollowPosition = useRef(runtime.hasFollowPosition)
  const previousTangent = useRef(runtime.previousTangent)
  const visualForward = useRef(runtime.visualForward)
  const visualPitch = useRef(runtime.visualPitch)
  const hasVisualForward = useRef(runtime.hasVisualForward)
  const baseLookQuaternion = useRef(runtime.baseLookQuaternion)
  const hasBaseLookQuaternion = useRef(runtime.hasBaseLookQuaternion)
  // Mount-scoped (not persisted): applies the stored world position back onto the freshly-mounted
  // group exactly once, before its first frame renders, so a resumed fish appears where it froze
  // rather than flashing at the origin.
  const restoredPositionRef = useRef(false)
  const lookBehaviorKey = useRef('')
  const lookBehaviorTransitionStartedAt = useRef(-Infinity)
  const animationCooldown = useRef(0)
  const animationHoldUntil = useRef(0)
  const velocity = useRef(runtime.velocity ?? 0)
  const actionSpeedStartAt = useRef(0)
  const actionSpeedUntil = useRef(0)
  const actionSpeedTarget = useRef(0)
  const curveDeformTurnIntent = useRef(0)
  // Smoothed ratio of actual forward travel to intended cruise speed. Drops when a
  // fish is throttled (e.g. crawling out of a turn), used to ease the curve-deform
  // bend back toward straight before forward swimming resumes.
  const curveDeformSpeedEase = useRef(1)
  const curveDeformPreviousSpeed = useRef(runtime.velocity)
  const nextBurstAt = useRef(runtime.nextBurstAt)
  const nextDriftAt = useRef(runtime.nextDriftAt)
  const driftUntil = useRef(runtime.driftUntil)
  const lastSwimSfxAt = useRef(0)
  const organicRand = useRef(mulberry32(organicMotion.noiseSeed))
  const organicNoise = useRef({
    lateral: 0,
    vertical: 0,
    longitudinal: 0,
    targetLateral: 0,
    targetVertical: 0,
    targetLongitudinal: 0,
    nextAt: 0,
  })
  const animationRef = useRef(resolveMoveAnimation(model, 'cruise'))
  const animationSpeedScaleRef = useRef(1)
  const curveDeformInputRef = useRef({ turn: 0, speed01: 0, accel01: 0, speedEase01: 1, burst01: 0, phase: 0 })
  const [animation, setAnimation] = useState(() => resolveMoveAnimation(model, 'cruise'))
  const [instancedSardineLod, setInstancedSardineLod] = useState(null)
  const forwardDebugGeometry = useMemo(() => makeDebugLineGeometry(), [])
  const boidSeparationGeometry = useMemo(() => makeDebugLineGeometry(), [])
  const boidAlignmentGeometry = useMemo(() => makeDebugLineGeometry(), [])
  const boidCohesionGeometry = useMemo(() => makeDebugLineGeometry(), [])
  const boidThreatGeometry = useMemo(() => makeDebugLineGeometry(), [])
  const boidResultGeometry = useMemo(() => makeDebugLineGeometry(), [])
  const boidNeighborGeometries = useMemo(
    () => Array.from({ length: BOID_MAX_DEBUG_NEIGHBORS }, () => makeDebugLineGeometry()),
    [],
  )
  const boidNeighborHeadingGeometries = useMemo(
    () => Array.from({ length: BOID_MAX_DEBUG_NEIGHBORS }, () => makeDebugLineGeometry()),
    [],
  )
  const motion = useMemo(() => {
    const rand = mulberry32(hashString(`${isSchooling ? school.id : (creature.id ?? creature.species)}-motion`))
    const velocityScale = swim.bodyLengthWU * swim.visualTimeScale * swim.speedMultiplier
    return {
      idleSpeed: randomRangeFromPair(rand, swim.idleBLPerSec, DEFAULT_SWIM.idleBLPerSec) * velocityScale,
      idleDrift: randomRangeFromPair(rand, swim.idleDriftBLPerSec, DEFAULT_SWIM.idleDriftBLPerSec) * velocityScale,
      idlePeriod: randomRange(rand, 4.5, 8.5),
      snapSpeed: randomRangeFromPair(rand, swim.snapBLPerSec, DEFAULT_SWIM.snapBLPerSec) * velocityScale,
      burstSpeed: randomRangeFromPair(rand, swim.burstBLPerSec, DEFAULT_SWIM.burstBLPerSec) * velocityScale,
      driftSpeed: randomRangeFromPair(rand, swim.idleDriftBLPerSec, DEFAULT_SWIM.idleDriftBLPerSec) * velocityScale,
      burstInterval: randomRangeFromPair(rand, swim.burstInterval, DEFAULT_SWIM.burstInterval),
      driftInterval: randomRangeFromPair(rand, swim.driftInterval, DEFAULT_DRIFT_INTERVAL),
      driftDuration: randomRangeFromPair(rand, swim.driftDuration, DEFAULT_DRIFT_DURATION),
      burstActionDuration: swim.burstActionDuration ?? DEFAULT_BURST_ACTION_DURATION,
      turnActionDuration: swim.turnActionDuration ?? DEFAULT_TURN_ACTION_DURATION,
      turnTriggerThreshold: swim.turnTriggerThreshold ?? SNAP_TURN_THRESHOLD,
      burstPhase: randomRange(rand, 0, 3.5),
      driftPhase: randomRange(rand, 5, 11),
      bobPhase: randomRange(rand, 0, Math.PI * 2),
      bobAmount: randomRange(rand, 0.035, 0.11) * THREE.MathUtils.lerp(0.45, 1.35, swim.erraticness),
      metersPerWU: WORLD_UNIT_METERS,
    }
  }, [creature, swim, isSchooling, school?.id])
  const instancedEntry = useMemo(() => {
    const rand = mulberry32(hashString(`${creature.id}:sardine-instance`))
    return {
      matrix: new THREE.Matrix4(),
      position: new THREE.Vector3(),
      quaternion: new THREE.Quaternion(),
      scale: 1,
      variant: Math.floor(randomRange(rand, 0, 4)),
      tint: randomRange(rand, 0.92, 1.08),
    }
  }, [creature.id])

  useEffect(() => {
    onReady?.(creature, ref)
  }, [creature, onReady])

  useEffect(() => {
    if (!debugSunBaskRequestId || debugSunBaskRequestId === queuedSunBaskRequestId.current) return
    if (!debug || !selected || !zoomActive || !isMolaCreature(creature)) return
    queuedSunBaskRequestId.current = debugSunBaskRequestId
    sunBaskQueued.current = true
  }, [creature, debug, debugSunBaskRequestId, selected, zoomActive])

  useEffect(() => {
    return () => unregisterFish(creature.id)
  }, [creature.id])

  useEffect(() => {
    return () => {
      removeSardineLod1Instance(creature.id)
      removeSardineInstance(creature.id)
      removeSardineLod0Entry(creature.id)
      removeSardineFrustumEntry(creature.id)
    }
  }, [creature.id])

  useEffect(() => {
    organicRand.current = mulberry32(organicMotion.noiseSeed)
    organicNoise.current = {
      lateral: 0,
      vertical: 0,
      longitudinal: 0,
      targetLateral: 0,
      targetVertical: 0,
      targetLongitudinal: 0,
      nextAt: 0,
    }
  }, [organicMotion.noiseSeed])

  useEffect(() => {
    agentRand.current = mulberry32(hashString(`${creature.id ?? creature.species}:solo-agent`))
    agentHasTarget.current = false
    nextAgentRetargetAt.current = 0
    agentStatus.current = 'cruise'
    agentBehavior.current = null
    agentBehaviorStartedAt.current = 0
    agentBehaviorDistance.current = 0
    agentDepthMode.current = 'deep'
    agentDepthTargetsRemaining.current = 0
    lastSunBaskAt.current = -Infinity
    sunBaskQueued.current = false
    queuedSunBaskRequestId.current = 0
    runtimeRecoveryFade.current = { phase: 'idle', startedAt: 0 }
  }, [creature.id, creature.species])

  useEffect(() => {
    if (!isSchoolLeader || !school?.id) return undefined
    return () => releaseSchoolState(school.id, schoolState)
  }, [isSchoolLeader, school?.id, schoolState])

  useEffect(() => {
    // One-time kinematic seed: establishes the starting speed, burst/drift schedule and steering
    // state. Once a fish has spawned (hasFollowPosition, persisted in the runtime store), a later
    // remount on a tank switch skips this so the resumed fish keeps its persisted motion — without
    // the guard it would snap back to idle speed and re-trigger an immediate burst on return.
    // Gating on hasFollowPosition (only set true after the first frame actually seeds a position)
    // rather than a mount-time flag keeps this correct under React StrictMode's dev double-mount.
    if (runtime.hasFollowPosition) return
    velocity.current = motion.idleSpeed
    nextBurstAt.current = motion.burstPhase + motion.burstInterval
    nextDriftAt.current = motion.driftPhase
    driftUntil.current = 0
    smoothedBoidSteering.current.set(0, 0, 0)
    committedBoidSteering.current.set(0, 0, 0)
    boidDecisionNextAt.current = 0
    boidDebugState.current.separation.set(0, 0, 0)
    boidDebugState.current.alignment.set(0, 0, 0)
    boidDebugState.current.cohesion.set(0, 0, 0)
    boidDebugState.current.threat.set(0, 0, 0)
    boidDebugState.current.result.set(0, 0, 0)
    boidDebugState.current.neighborCount = 0
    boidDebugState.current.neighborActive = 0
    boidDebugState.current.socialWeightTotal = 0
    repulserDrift.current.set(0, 0, 0)
    hasVisualForward.current = false
    hasBaseLookQuaternion.current = false
    lookBehaviorKey.current = ''
    lookBehaviorTransitionStartedAt.current = -Infinity
    curveDeformInputRef.current.phase = motion.bobPhase
    // runtime.hasFollowPosition is a one-time seed guard, not a reactive input — re-running this on
    // its change would defeat the purpose (it flips true after the first seed).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [motion])

  const playAnimation = (name) => {
    if (animationRef.current === name) return
    animationRef.current = name
    setAnimation(name)
  }

  const playSwimSfx = (type, intensity, now) => {
    if (SCHOOL_SFX_LEADER_ONLY && isSchooling && !isSchoolLeader && !selected) return
    if (now - lastSwimSfxAt.current < FISH_SFX_MIN_INTERVAL) return
    lastSwimSfxAt.current = now
    triggerFishSwimSound({
      type,
      intensity,
      creatureId: creature.id,
      followMode: selected,
      schooling: isSchooling,
    })
  }

  useFrame(({ clock, camera }, rawDelta) => {
    const fish = ref.current
    if (!fish) return

    // Restore the persisted position onto this mount's group before anything reads it. Runs once;
    // hasFollowPosition (hydrated from the store) then routes the fish down the "already spawned"
    // branch below so it continues from here instead of re-seeding at spawn.
    if (!restoredPositionRef.current) {
      restoredPositionRef.current = true
      if (runtime.hasPosition && hasFollowPosition.current) {
        fish.position.copy(runtime.position)
        previousPosition.current.copy(runtime.position)
      }
    }

    const rawNow = clock.getElapsedTime()
    const simulationSpeed = THREE.MathUtils.clamp(
      Number.isFinite(debugSimulationSpeed) ? debugSimulationSpeed : 1,
      1,
      10,
    )
    const delta = Math.min(rawDelta, MAX_SIMULATION_RAW_DELTA) * simulationSpeed
    if (simulationTime.current === null) simulationTime.current = rawNow
    simulationTime.current += delta
    const now = simulationTime.current

    if (isSchooling) {
      const noise = organicNoise.current
      const rand = organicRand.current
      if (now >= noise.nextAt) {
        noise.targetLateral = randomRange(rand, -ORGANIC_NOISE_AMPLITUDE, ORGANIC_NOISE_AMPLITUDE)
        noise.targetVertical = randomRange(rand, -ORGANIC_NOISE_AMPLITUDE * 0.55, ORGANIC_NOISE_AMPLITUDE * 0.55)
        noise.targetLongitudinal = randomRange(rand, -ORGANIC_NOISE_AMPLITUDE * 0.75, ORGANIC_NOISE_AMPLITUDE * 0.75)
        noise.nextAt = now + randomRange(rand, ORGANIC_NOISE_INTERVAL[0], ORGANIC_NOISE_INTERVAL[1])
      }
      const noiseAlpha = 1 - Math.exp(-delta * ORGANIC_NOISE_RESPONSE)
      noise.lateral = THREE.MathUtils.lerp(noise.lateral, noise.targetLateral, noiseAlpha)
      noise.vertical = THREE.MathUtils.lerp(noise.vertical, noise.targetVertical, noiseAlpha)
      noise.longitudinal = THREE.MathUtils.lerp(noise.longitudinal, noise.targetLongitudinal, noiseAlpha)
    }

    const idleVelocity = Math.max(
      0.08,
      motion.idleSpeed + Math.sin(now / motion.idlePeriod + motion.bobPhase) * motion.idleDrift,
    )
    const driftMove = resolveMoveAnimation(model, 'drift')
    const hasDriftMove = swim.driftEnabled && Boolean(
      model?.moveset?.drift && driftMove !== resolveMoveAnimation(model, 'cruise'),
    )
    const isActionMoveActive = now >= actionSpeedStartAt.current && now < actionSpeedUntil.current
    const isDrifting = hasDriftMove && !isActionMoveActive && now < driftUntil.current
    const targetVelocity = isActionMoveActive ? actionSpeedTarget.current : (isDrifting ? motion.driftSpeed : idleVelocity)
    const velocityResponse = isActionMoveActive ? 8 : (isDrifting ? 1.2 : 2.4)

    velocity.current = THREE.MathUtils.lerp(
      velocity.current,
      targetVelocity,
      1 - Math.exp(-delta * velocityResponse),
    )

    curveDeformTurnIntent.current = 0
    let position
    if (isSchooling) {
      // Boids: the fish owns its own position. Seed the first frame from the school's spawn
      // centre plus this member's formation offset, then track fish.position thereafter.
      if (hasFollowPosition.current) {
        position = fish.position
      } else {
        position = schoolBasePosition.copy(schoolState.center)
        position.x += schoolOffset.lateral
        position.y += schoolOffset.vertical
        position.z += schoolOffset.longitudinal
        clampToSwimBounds(position, swimBounds(creature.depthZone, swim, creature.size ?? 1))
      }
      // Heading estimate for steering/boids until the movement step recomputes the tangent.
      if (desiredDirection.current.lengthSq() > 0.0001) tangent.copy(desiredDirection.current)
      else if (hasVisualForward.current) tangent.copy(visualForward.current)
      else tangent.set(0, 0, -1)
      if (tangent.lengthSq() > 0.000001) tangent.normalize()
      else tangent.set(0, 0, -1)
    } else {
      // Solo agents own their position too. Seed the first frame from a deterministic point in
      // bounds (same idea as the school spawn centre); track fish.position thereafter.
      if (hasFollowPosition.current) {
        position = fish.position
      } else {
        position = pickSoloAgentTarget(schoolBasePosition, creature, swim, agentRand.current)
      }
      if (desiredDirection.current.lengthSq() > 0.0001) tangent.copy(desiredDirection.current)
      else if (hasVisualForward.current) tangent.copy(visualForward.current)
      else tangent.set(0, 0, -1)
      tangent.normalize()
    }

    const followDistance = followLookaheadDistance(creature, swim, isSchooling)
    if (isSchooling) {
      // Every member steers toward the SAME shared goal. Spread is emergent from boid
      // separation/cohesion, not from offsetting each fish's target (which strung them into a
      // conga line and held a permanent yaw offset that cocked the tails).
      followTarget.current.copy(schoolState.goal)
    } else if (isSoloAgent) {
      position = hasFollowPosition.current ? fish.position : position
      const currentForward = desiredDirection.current.lengthSq() > 0.0001
        ? desiredDirection.current
        : (hasVisualForward.current ? visualForward.current : tangent)
      if (currentForward.lengthSq() < 0.0001) currentForward.set(0, 0, -1)
      currentForward.normalize()

      const bodyLength = creatureBodyLength(creature, swim)
      const reachedDistance = agentBehavior.current?.type === 'sun-bask' && agentBehavior.current.stage === 'approach'
        ? Math.min(bodyLength * MOLA_SUN_BASK_REACHED_BODY_LENGTHS, MOLA_SUN_BASK_REACHED_MAX)
        : soloAgentReachedDistance(creature, bodyLength)
      const targetDistance = agentHasTarget.current ? position.distanceTo(agentTarget.current) : Infinity
      if (agentBehavior.current && targetDistance <= reachedDistance) {
        if (agentBehavior.current.type === 'sun-bask' && agentBehavior.current.stage === 'approach') {
          const plannedDistance = Math.max(0.001, agentBehavior.current.approachDistance ?? 0)
          const distanceProgress = plannedDistance > 0.001
            ? 1 - (targetDistance / plannedDistance)
            : 1
          const progress = THREE.MathUtils.clamp(distanceProgress, 0, 1)
          const delayedProgress = THREE.MathUtils.clamp(
            (progress - MOLA_SUN_BASK_ROLL_PROGRESS_START) / Math.max(0.001, 1 - MOLA_SUN_BASK_ROLL_PROGRESS_START),
            0,
            1,
          )
          const easedRoll = delayedProgress * delayedProgress * delayedProgress * (delayedProgress * (delayedProgress * 6 - 15) + 10)
          const holdStartRollAlpha = easedRoll * MOLA_SUN_BASK_APPROACH_MAX_ROLL_ALPHA
          agentBehavior.current = {
            ...agentBehavior.current,
            stage: 'hold',
            stageStartedAt: now,
            holdUntil: now + MOLA_SUN_BASK_DURATION,
            holdStartRollAlpha,
            holdForward: (hasVisualForward.current ? visualForward.current : currentForward).clone().normalize(),
          }
          agentHasTarget.current = false
          agentBehaviorDistance.current = 0
          driftUntil.current = 0
          animationHoldUntil.current = now + MOLA_SUN_BASK_DURATION
          animationCooldown.current = now + MOLA_SUN_BASK_DURATION
          playAnimation(resolveMoveAnimation(model, agentBehavior.current.side < 0 ? 'sunBaskLeft' : 'sunBaskRight'))
        } else if (agentBehavior.current.type === 'sun-bask' && agentBehavior.current.stage === 'exit') {
          const exitElapsed = Math.max(0, now - (agentBehavior.current.stageStartedAt ?? agentBehaviorStartedAt.current))
          if (exitElapsed >= MOLA_SUN_BASK_EXIT_ROLL_DURATION) {
            agentBehavior.current = null
            agentHasTarget.current = false
            agentBehaviorDistance.current = 0
            nextAgentRetargetAt.current = now + randomRange(agentRand.current, 0.15, 0.55)
          } else {
            agentBehavior.current = {
              ...agentBehavior.current,
              exitArrivedAt: agentBehavior.current.exitArrivedAt ?? now,
            }
            agentHasTarget.current = false
            agentBehaviorDistance.current = 0
          }
        } else {
          agentBehavior.current = null
          agentHasTarget.current = false
          agentBehaviorDistance.current = 0
          nextAgentRetargetAt.current = now + randomRange(agentRand.current, 0.15, 0.55)
        }
      }

      if (!agentBehavior.current && now >= nextAgentRetargetAt.current) {
        const usesDepthResidency = isMolaCreature(creature)
        const forceSunBask = usesDepthResidency && sunBaskQueued.current
        const canSunBask = usesDepthResidency
          && (forceSunBask || (now - lastSunBaskAt.current >= MOLA_SUN_BASK_COOLDOWN
            && agentRand.current() < MOLA_SUN_BASK_CHANCE))
        const sunBaskDestination = canSunBask
          ? pickMolaSunBaskTarget(agentCandidateTarget, creature, swim, agentRand.current, position, currentForward)
          : null

        if (sunBaskDestination) {
          const side = agentRand.current() < 0.5 ? -1 : 1
          const approachDistance = Math.max(0.001, position.distanceTo(sunBaskDestination))
          agentBehavior.current = { type: 'sun-bask', stage: 'approach', side, stageStartedAt: now, holdUntil: 0, approachDistance }
          sunBaskQueued.current = false
          agentBehaviorStartedAt.current = now
          agentBehaviorDistance.current = 0
          lastSunBaskAt.current = now
          agentTarget.current.copy(sunBaskDestination)
          agentHasTarget.current = true
          agentDepthMode.current = 'front'
          agentDepthTargetsRemaining.current = 0
        } else {
          if (usesDepthResidency && agentDepthTargetsRemaining.current <= 0) {
            const nextMode = agentDepthMode.current === 'deep' && agentRand.current() < MOLA_FRONT_EXCURSION_CHANCE ? 'front' : 'deep'
            agentDepthMode.current = nextMode
            agentDepthTargetsRemaining.current = Math.floor(randomRange(
              agentRand.current,
              nextMode === 'front' ? MOLA_FRONT_TARGET_COUNT[0] : MOLA_DEEP_TARGET_COUNT[0],
              (nextMode === 'front' ? MOLA_FRONT_TARGET_COUNT[1] : MOLA_DEEP_TARGET_COUNT[1]) + 1,
            ))
          }
          const destination = pickSoloAgentSteeringDestination(
            agentCandidateTarget,
            creature,
            swim,
            agentRand.current,
            position,
            currentForward,
            usesDepthResidency ? agentDepthMode.current : 'any',
          )
          if (destination) {
            if (usesDepthResidency) agentDepthTargetsRemaining.current = Math.max(0, agentDepthTargetsRemaining.current - 1)
            agentBehavior.current = { type: 'steer', completion: 'arrival' }
            agentBehaviorStartedAt.current = now
            agentBehaviorDistance.current = 0
            agentTarget.current.copy(destination)
            agentHasTarget.current = true
          } else {
            agentBehavior.current = null
            agentHasTarget.current = false
            nextAgentRetargetAt.current = now + AGENT_BEHAVIOR_RETRY_COOLDOWN
          }
        }
      }

      if (agentBehavior.current?.type === 'sun-bask' && agentBehavior.current.stage === 'exit') {
        const exitElapsed = Math.max(0, now - (agentBehavior.current.stageStartedAt ?? agentBehaviorStartedAt.current))
        if (exitElapsed >= MOLA_SUN_BASK_EXIT_ROLL_DURATION && !agentHasTarget.current) {
          agentBehavior.current = null
          agentBehaviorDistance.current = 0
          nextAgentRetargetAt.current = now + randomRange(agentRand.current, 0.15, 0.55)
        }
      }

      if (agentBehavior.current?.type === 'sun-bask' && agentBehavior.current.stage === 'hold' && now >= agentBehavior.current.holdUntil) {
        pickMolaSunBaskExitTarget(agentBaskExitTarget, creature, swim, fish.position, currentForward)
        agentTarget.current.copy(agentBaskExitTarget)
        agentHasTarget.current = true
        const driftElapsed = Math.max(0, now - (agentBehavior.current.stageStartedAt ?? agentBehaviorStartedAt.current))
        const exitStartYawDrift = Math.sin(driftElapsed * 0.19 + motion.bobPhase * 1.7) * MOLA_SUN_BASK_DRIFT_YAW_AMPLITUDE
        const exitStartRollDrift = Math.sin(driftElapsed * 0.27 + motion.bobPhase * 2.3 + 1.1) * MOLA_SUN_BASK_DRIFT_ROLL_AMPLITUDE
        agentBehavior.current = {
          ...agentBehavior.current,
          stage: 'exit',
          stageStartedAt: now,
          exitStartRollAlpha: 1,
          exitStartYawDrift,
          exitStartRollDrift,
        }
        agentBehaviorDistance.current = 0
        animationHoldUntil.current = now + MOLA_SUN_BASK_EXIT_ROLL_DURATION
        animationCooldown.current = now + MOLA_SUN_BASK_EXIT_ROLL_DURATION
      }

      if (agentHasTarget.current) {
        followTarget.current.copy(fish.position).addScaledVector(currentForward, followDistance)
      }
    } else {
      // Not schooling and not a solo agent (shouldn't occur in practice): project the follow
      // target ahead along the current heading so downstream orientation stays sane.
      followTarget.current.copy(fish.position).addScaledVector(tangent, followDistance)
    }

    if (!hasFollowPosition.current) {
      fish.position.copy(position)
      previousPosition.current.copy(fish.position)
      hasFollowPosition.current = true
    } else {
      // --- Unified movement: one steer → boids → turn-cap → integrate → clamp pipeline. ---
      // Schools and solo agents differ only in how the base desired heading is produced
      // (shared migration goal + formation slot vs. a personal roaming/authored target) and
      // in which clamps shape the result; the integrator itself is identical.
      previousPosition.current.copy(fish.position)
      tangent.copy(desiredDirection.current.lengthSq() > 0.0001 ? desiredDirection.current : (hasVisualForward.current ? visualForward.current : tangent))
      if (tangent.lengthSq() < 0.0001) tangent.set(0, 0, -1)
      tangent.normalize()

      const bounds = swimBounds(creature.depthZone, swim, creature.size ?? 1)
      const sunBaskHolding = agentBehavior.current?.type === 'sun-bask' && agentBehavior.current.stage === 'hold'
      if (sunBaskHolding) {
        // Mola sun-bask hold: behavior owns position outright (coast to a stop,
        // surface drift), bypassing the shared integrator entirely.
        desiredDirection.current.copy(tangent)
        agentMoveDirection.copy(tangent)
        const driftElapsed = now - agentBehavior.current.stageStartedAt
        const driftPhase = driftElapsed * 0.45 + motion.bobPhase
        const driftIntroAlpha = THREE.MathUtils.smoothstep(driftElapsed, 0, MOLA_SUN_BASK_DRIFT_INTRO_DURATION)
        const coastAlpha = 1 - THREE.MathUtils.smoothstep(driftElapsed, 0, MOLA_SUN_BASK_HOLD_COAST_DURATION)
        if (coastAlpha > 0.001 && velocity.current > 0.001) {
          fish.position.addScaledVector(agentMoveDirection, velocity.current * coastAlpha * organicMotion.speedScale * delta)
        }
        fish.position.x += Math.sin(driftPhase) * MOLA_SUN_BASK_DRIFT_XZ_AMPLITUDE * driftIntroAlpha * delta
        fish.position.z += Math.cos(driftPhase * 0.73) * MOLA_SUN_BASK_DRIFT_XZ_AMPLITUDE * driftIntroAlpha * delta
        velocity.current = THREE.MathUtils.damp(velocity.current, 0, 1.4, delta)
        const driftY = Math.sin(driftPhase * 0.57 + 1.7) * MOLA_SUN_BASK_DRIFT_Y_AMPLITUDE * driftIntroAlpha
        fish.position.y = THREE.MathUtils.damp(fish.position.y, molaSunBaskSurfaceCenterYMax(creature, swim, bounds) + driftY, 1.2, delta)
        clampToMolaSurfaceCeiling(fish.position, creature, swim, bounds, agentMoveDirection, molaSunBaskSurfaceCenterYMax(creature, swim, bounds))
        agentBehaviorDistance.current = 0
      } else {
        // Base desired heading — the only mode-specific step.
        if (isSchooling) {
          // Leader maintains the shared school centroid + migration direction, and advances the
          // goal once the group's centroid reaches it.
          if (isSchoolLeader) {
            let cx = 0, cy = 0, cz = 0, cn = 0
            forEachFish(entry => {
              if (entry.schoolId === school.id) { cx += entry.position.x; cy += entry.position.y; cz += entry.position.z; cn += 1 }
            })
            if (cn > 0) schoolState.centroid.set(cx / cn, cy / cn, cz / cn)
            const reached = Math.max(bodyLength * SCHOOL_GOAL_REACHED_BODY_LENGTHS, SCHOOL_GOAL_REACHED_MIN)
            if (schoolState.centroid.distanceTo(schoolState.goal) <= reached) {
              const heading = desiredDirection.current.lengthSq() > 0.0001 ? desiredDirection.current : tangent
              pickSoloAgentContinuationTarget(schoolState.goal, creature, swim, schoolState.rand, schoolState.centroid, heading)
              // Inset the goal from the walls so a wide-turning school (big fish, tight bounds)
              // banks away early instead of driving into a boundary it can't out-turn and thrashing.
              const gm = Math.min(bodyLength * 2, (bounds.zMax - bounds.zMin) * 0.28)
              schoolState.goal.x = THREE.MathUtils.clamp(schoolState.goal.x, bounds.xMin + gm, bounds.xMax - gm)
              schoolState.goal.y = THREE.MathUtils.clamp(schoolState.goal.y, bounds.yMin + gm * 0.5, bounds.yMax - gm * 0.5)
              schoolState.goal.z = THREE.MathUtils.clamp(schoolState.goal.z, bounds.zMin + gm, bounds.zMax - gm)
            }
            // Shared direction (goal - centroid), identical for every member, low-pass filtered so
            // frame-to-frame goal jitter doesn't accumulate into a constant turn.
            nextPoint.subVectors(schoolState.goal, schoolState.centroid)
            if (nextPoint.lengthSq() > 1e-6) {
              nextPoint.normalize()
              if (schoolState.migrationDir.lengthSq() < 1e-6) schoolState.migrationDir.copy(nextPoint)
              else schoolState.migrationDir.lerp(nextPoint, 1 - Math.exp(-delta * SCHOOL_MIGRATION_SMOOTH))
              if (schoolState.migrationDir.lengthSq() > 1e-6) schoolState.migrationDir.normalize()
              else schoolState.migrationDir.copy(nextPoint)
            } else if (schoolState.migrationDir.lengthSq() < 1e-6) {
              schoolState.migrationDir.set(0, 0, -1)
            }
          }

          // Shared migration direction (leader-computed) — parallel travel, never a funnel.
          schoolFollowDirection.copy(schoolState.migrationDir)
          if (schoolFollowDirection.lengthSq() < 1e-6) {
            schoolFollowDirection.subVectors(schoolState.goal, fish.position)
            if (schoolFollowDirection.lengthSq() > 1e-6) schoolFollowDirection.normalize()
            else schoolFollowDirection.set(0, 0, -1)
          }
          // This member's formation slot, placed in the travel frame around the school centroid
          // (right = perpendicular to heading in XZ, up = world Y). Anchoring the shape here means
          // a single-file line is no longer an equilibrium, so the ball keeps its width.
          const hx = schoolFollowDirection.x, hz = schoolFollowDirection.z
          schoolBasePosition.copy(schoolState.centroid)
          schoolBasePosition.x += hz * schoolOffset.lateral + hx * schoolOffset.longitudinal
          schoolBasePosition.z += -hx * schoolOffset.lateral + hz * schoolOffset.longitudinal
          schoolBasePosition.y += schoolOffset.vertical
          // Desired heading = migration urge + pull toward the formation slot. The slot pull is
          // scaled down for tiny schools: with only a couple of members the slots sit right beside
          // the centroid, so a strong pull makes the pair orbit their slots (a constant curve that
          // cocks the tail). A pair instead just travels parallel on the shared migration + boid
          // separation; big schools get the full formation shaping.
          const formationWeight = SCHOOL_FORMATION_WEIGHT * THREE.MathUtils.clamp((school.count - 2) / 6, 0.1, 1)
          agentMoveDirection.copy(schoolFollowDirection).multiplyScalar(SCHOOL_MIGRATION_WEIGHT)
          targetDesiredDirection.subVectors(schoolBasePosition, fish.position)
          if (targetDesiredDirection.lengthSq() > 1e-6) {
            agentMoveDirection.addScaledVector(targetDesiredDirection.normalize(), formationWeight)
          }
          if (agentMoveDirection.lengthSq() < 1e-6) agentMoveDirection.copy(schoolFollowDirection)
          agentMoveDirection.normalize()
          // Boundary shaping via a projected lookahead point.
          agentCandidateTarget.copy(fish.position).addScaledVector(agentMoveDirection, bodyLength * 6)
          shapeSoloAgentSteeringDesired(agentMoveDirection, fish.position, agentCandidateTarget, tangent, creature, swim)
        } else if (agentHasTarget.current) {
          // Solo agent: steer toward the personal roaming/authored target (boundary-shaped for
          // non-mola species).
          shapeSoloAgentSteeringDesired(agentMoveDirection, fish.position, agentTarget.current, tangent, creature, swim)
        } else {
          // Between targets: hold the current heading and let boids/clamps shape it.
          agentMoveDirection.copy(tangent)
        }

        // Boid forces as a first-class steering input (separation / alignment / cohesion /
        // threat). Authored behaviors (the mola sun-bask approach/exit) own the steering
        // outright — boid forces are suppressed so they never nudge the animation off its
        // path. The bask hold stage above already bypasses boids entirely.
        const authoredBehaviorActive = agentBehavior.current?.type === 'sun-bask'
        if (!authoredBehaviorActive) {
          if (now >= boidDecisionNextAt.current) {
            computeBoidSteering(committedBoidSteering.current, fish, creature, swim, school, agentMoveDirection, boidDebugState.current)
            boidDecisionNextAt.current = now + boidDecisionInterval(model, animationRef.current, boidDecisionJitter.current)
          }
          smoothedBoidSteering.current.lerp(committedBoidSteering.current, 1 - Math.exp(-delta * BOID_STEERING_SMOOTHING))
        } else {
          // Keep the committed vector decaying so it does not snap back in when the
          // authored behavior ends.
          smoothedBoidSteering.current.multiplyScalar(Math.exp(-delta * BOID_STEERING_SMOOTHING))
        }
        // agentMoveDirection is the base heading (unit); add boid forces on top for
        // anti-overlap and predator avoidance.
        targetDesiredDirection.copy(agentMoveDirection).add(smoothedBoidSteering.current)
        if (targetDesiredDirection.lengthSq() > 0.0001) targetDesiredDirection.normalize()
        else targetDesiredDirection.copy(agentMoveDirection)

        if (desiredDirection.current.lengthSq() < 0.0001) desiredDirection.current.copy(targetDesiredDirection)

        // Spine bend intent: signed yaw between current and desired heading.
        const turnIntentScale = Number.isFinite(model?.curveDeform?.turnIntentScale)
          ? model.curveDeform.turnIntentScale
          : 0
        if (turnIntentScale > 0) {
          const turnIntent = desiredDirection.current.z * targetDesiredDirection.x - desiredDirection.current.x * targetDesiredDirection.z
          curveDeformTurnIntent.current = THREE.MathUtils.clamp(turnIntent * turnIntentScale, -1, 1)
        }

        // Authored speed shaping: the sun-bask approach eases the mola to a crawl at the bask
        // point, and the exit ramps it back up to cruise. 1 for everything else.
        let authoredSpeedScale = 1
        if (agentBehavior.current?.type === 'sun-bask' && agentBehavior.current.stage === 'approach') {
          const plannedDistance = Math.max(0.001, agentBehavior.current.approachDistance ?? 0)
          const remainingDistance = agentHasTarget.current ? fish.position.distanceTo(agentTarget.current) : 0
          const progressToBask = THREE.MathUtils.clamp(1 - (remainingDistance / plannedDistance), 0, 1)
          const decelAlpha = THREE.MathUtils.clamp(
            (progressToBask - MOLA_SUN_BASK_APPROACH_DECEL_START) / Math.max(0.001, 1 - MOLA_SUN_BASK_APPROACH_DECEL_START),
            0,
            1,
          )
          const easedDecel = decelAlpha * decelAlpha * (3 - 2 * decelAlpha)
          authoredSpeedScale = THREE.MathUtils.lerp(1, MOLA_SUN_BASK_APPROACH_MIN_SPEED_SCALE, easedDecel)
        } else if (agentBehavior.current?.type === 'sun-bask' && agentBehavior.current.stage === 'exit') {
          const exitElapsed = Math.max(0, now - (agentBehavior.current.stageStartedAt ?? agentBehaviorStartedAt.current))
          authoredSpeedScale = THREE.MathUtils.smoothstep(exitElapsed, 0, MOLA_SUN_BASK_EXIT_SPEED_RAMP_DURATION)
        }

        // Turn no faster than a body-length arc allows at the current speed; tighten near walls.
        const forwardSpeed = velocity.current * authoredSpeedScale * organicMotion.speedScale
        let turnStep = maxTurnRadiansForSpeed(swim, bodyLength, forwardSpeed, delta)
        turnStep = boundaryAvoidanceTurnStep(turnStep, fish.position, desiredDirection.current, bounds, swim, bodyLength, forwardSpeed, delta)
        rotateDirectionToward(desiredDirection.current, targetDesiredDirection, turnStep)

        // Integrate velocity along the heading — no follow-target distance cap.
        const movementScale = forwardSpeed * delta
        agentMoveDirection.copy(desiredDirection.current)
        fish.position.addScaledVector(agentMoveDirection, movementScale)

        // Species-shaped clamps on the shared swim bounds.
        if (isMolaCreature(creature)) {
          // The mola's authored targets (front excursions, sun-bask approach) extend past the
          // shared zMax, so its forward wall sits where those targets end. The rear stays soft:
          // a blown deep U-turn exits into the dark and the fade-out recovery below brings it
          // back, instead of the mola sliding along a wall it cannot out-turn.
          fish.position.z = Math.min(fish.position.z, MOLA_SUN_BASK_APPROACH_Z[1])
          const { xMin, xMax } = swimXRangeAtZ(bounds, fish.position.z)
          fish.position.x = THREE.MathUtils.clamp(fish.position.x, xMin, xMax)
          fish.position.y = Math.max(fish.position.y, bounds.yMin)
          const surfaceYMax = agentBehavior.current?.type === 'sun-bask'
            ? molaSunBaskSurfaceCenterYMax(creature, swim, bounds)
            : null
          clampToMolaSurfaceCeiling(fish.position, creature, swim, bounds, agentMoveDirection, surfaceYMax)
        } else {
          clampToSwimBounds(fish.position, bounds)
          if (isSoloAgent) {
            // Keep the body below the water plane and flatten any upward heading so it glides
            // along the ceiling instead of nosing through the surface.
            clampToSurfaceCeiling(fish.position, agentMoveDirection, SURFACE_PLANE_Y - SOLO_AGENT_SURFACE_CLEARANCE)
          }
        }

        // Mola deep-exit recovery: past the soft rear wall it fades out, snaps back inside the
        // shared bounds, retargets, and fades back in. While the follow cam is on it, recovery
        // is deferred and the cam is asked to let go instead (a teleport under the camera reads
        // as a glitch).
        if (isMolaCreature(creature)) {
          const deepExit = isMolaDeepZExit(fish.position, bounds, bodyLength)
          if (zoomActive && selected && deepExit && now - lastFollowRecoveryExitAt.current > 1.0) {
            lastFollowRecoveryExitAt.current = now
            onRuntimeRecoveryNeeded?.(creature)
          }
          const runtimeRecoveryEnabled = !zoomActive && soloRuntimeRecoveryEnabled
          const fadeState = runtimeRecoveryFade.current
          if (runtimeRecoveryEnabled && fadeState.phase === 'fade-out'
            && now - fadeState.startedAt >= MOLA_RUNTIME_RECOVERY_FADE_OUT_DURATION) {
            agentRuntimeClamp.copy(fish.position)
            clampToSwimBounds(agentRuntimeClamp, bounds)
            agentMoveDirection.subVectors(agentRuntimeClamp, fish.position)
            if (agentMoveDirection.lengthSq() > 0.0001) desiredDirection.current.copy(agentMoveDirection.normalize())
            fish.position.copy(agentRuntimeClamp)
            agentBehavior.current = null
            agentHasTarget.current = false
            agentBehaviorDistance.current = 0
            nextAgentRetargetAt.current = now
            runtimeRecoveryFade.current = { phase: 'fade-in', startedAt: now }
          } else if (runtimeRecoveryEnabled && deepExit && fadeState.phase !== 'fade-out' && fadeState.phase !== 'fade-in') {
            runtimeRecoveryFade.current = { phase: 'fade-out', startedAt: now }
          }
        }

        if (isSoloAgent) agentBehaviorDistance.current += movementScale
      }
      followTarget.current.copy(fish.position).addScaledVector(agentMoveDirection, followDistance)
      tangent.subVectors(fish.position, previousPosition.current)
      if (tangent.lengthSq() > 0.000001) tangent.normalize()
      else tangent.copy(agentMoveDirection)
    }

    if (showAgentDebug) {
      const behavior = agentBehavior.current
      agentStatus.current = behavior?.type === 'sun-bask'
        ? `sun-bask ${behavior.stage}`
        : (behavior?.type ?? 'choose-behavior')
    }

    updateFishRegistry(fish, creature, swim, school, desiredDirection.current)

    let runtimeRecoveryOpacity = 1
    let recoveryFadeState = runtimeRecoveryFade.current
    if (recoveryFadeState.phase === 'fade-out' && now - recoveryFadeState.startedAt >= MOLA_RUNTIME_RECOVERY_FADE_OUT_DURATION + 0.25) {
      runtimeRecoveryFade.current = { phase: 'fade-in', startedAt: now }
      recoveryFadeState = runtimeRecoveryFade.current
    }
    if (recoveryFadeState.phase === 'fade-out') {
      runtimeRecoveryOpacity = 1 - THREE.MathUtils.smoothstep(
        now - recoveryFadeState.startedAt,
        0,
        MOLA_RUNTIME_RECOVERY_FADE_OUT_DURATION,
      )
    } else if (recoveryFadeState.phase === 'fade-in') {
      runtimeRecoveryOpacity = THREE.MathUtils.smoothstep(
        now - recoveryFadeState.startedAt,
        0,
        MOLA_RUNTIME_RECOVERY_FADE_IN_DURATION,
      )
      if (now - recoveryFadeState.startedAt >= MOLA_RUNTIME_RECOVERY_FADE_IN_DURATION) {
        runtimeRecoveryFade.current = { phase: 'idle', startedAt: 0 }
        runtimeRecoveryOpacity = 1
      }
    }

    const fade = depthFadeFromScreenZ(fish.position.z)
    fish.traverse(child => {
      if (!child.isMesh || child.userData?.interactionProxy) return
      const materials = Array.isArray(child.material) ? child.material : [child.material]
      materials.filter(Boolean).forEach(material => {
        if (model) {
          material.transparent = runtimeRecoveryOpacity < 0.999
          material.opacity = runtimeRecoveryOpacity
          if ('depthWrite' in material) material.depthWrite = runtimeRecoveryOpacity >= 0.999
          if ('envMapIntensity' in material) material.envMapIntensity = THREE.MathUtils.lerp(0.45, 0.95, fade)
          return
        }

        material.transparent = runtimeRecoveryOpacity < 0.999
        material.opacity = runtimeRecoveryOpacity
        if ('depthWrite' in material) material.depthWrite = runtimeRecoveryOpacity >= 0.999
        if ('envMapIntensity' in material) material.envMapIntensity = THREE.MathUtils.lerp(0.25, 0.95, fade)
      })
    })

    const pitchLimit = maxVisualPitch(creature, swim)
    if (isSoloAgent && desiredDirection.current.lengthSq() > 0.0001) {
      horizontalForward.set(desiredDirection.current.x, 0, desiredDirection.current.z)
    } else {
      horizontalForward.set(tangent.x, 0, tangent.z)
    }
    if (horizontalForward.lengthSq() < 0.0001) horizontalForward.set(0, 0, -1)
    horizontalForward.normalize()

    splineVisualTangent.subVectors(followTarget.current, fish.position)
    if (splineVisualTangent.lengthSq() < 0.0001) splineVisualTangent.copy(tangent)
    else splineVisualTangent.normalize()
    // Pitch reflects ACTUAL vertical travel this frame, not the direction to the target.
    // A creature genuinely swimming up/down to a higher/lower destination pitches into it,
    // but one hovering along the XZ plane (e.g. blocked under the surface, or a target it
    // is not vertically closing on) stays level — no swim-bladder-dysfunction look.
    frameMove.subVectors(fish.position, previousPosition.current)
    const frameHorizontalMove = Math.hypot(frameMove.x, frameMove.z)
    // Weight pitch by how fast the fish is actually swimming forward relative to its own cruise
    // speed, so a near-stopped fish stays level instead of pitching on residual vertical bob.
    const horizontalSpeed = frameHorizontalMove / Math.max(delta, 1e-4)
    const pitchSpeedReference = Math.max(1e-3, motion.idleSpeed)
    const pitchSpeedWeight = THREE.MathUtils.smoothstep(
      horizontalSpeed,
      pitchSpeedReference * PITCH_FADE_SPEED_FRACTION_LO,
      pitchSpeedReference * PITCH_FADE_SPEED_FRACTION_HI,
    )
    const targetVisualPitch = pitchSpeedWeight * ((frameHorizontalMove > 1e-4 || Math.abs(frameMove.y) > 1e-4)
      ? THREE.MathUtils.clamp(Math.atan2(frameMove.y, Math.max(frameHorizontalMove, 1e-4)), -pitchLimit, pitchLimit)
      : 0)
    if (!hasVisualForward.current) {
      visualPitch.current = targetVisualPitch
    } else {
      visualPitch.current = THREE.MathUtils.damp(
        visualPitch.current,
        targetVisualPitch,
        VISUAL_PITCH_RESPONSE,
        delta,
      )
    }
    setForwardWithPitch(rawVisualForward, horizontalForward, visualPitch.current)

    if (!hasVisualForward.current) {
      visualForward.current.copy(rawVisualForward)
      hasVisualForward.current = true
    } else if (swim.visualHeadingFollowsMotion) {
      // `rawVisualForward` comes from this frame's already turn-capped movement vector.
      // Taking it directly means the model cannot rotate ahead of its body translation,
      // which was making large procedural fish read as if they were spinning in place.
      visualForward.current.copy(rawVisualForward)
    } else {
      const visualAlignment = visualForward.current.dot(rawVisualForward)
      const visualTurnRate = isSoloAgent
        ? (visualAlignment < SOLO_AGENT_TANGENT_CATCHUP_ALIGNMENT
          ? SOLO_AGENT_TANGENT_CATCHUP_RATE
          : SOLO_AGENT_TANGENT_TURN_RATE)
        : turnRateForCreature(creature, swim)
      rotateDirectionToward(
        visualForward.current,
        rawVisualForward,
        visualTurnRate * delta,
      )
      enforceForwardPitchLimit(visualForward.current, pitchLimit)
    }
    pitchedForward.copy(visualForward.current)
    if (agentBehavior.current?.type === 'sun-bask'
      && (agentBehavior.current.stage === 'hold' || agentBehavior.current.stage === 'exit')
      && agentBehavior.current.holdForward?.lengthSq?.() > 0.0001) {
      const behavior = agentBehavior.current
      const stageElapsed = Math.max(0, now - (behavior.stageStartedAt ?? agentBehaviorStartedAt.current))
      const freezeAlpha = behavior.stage === 'hold'
        ? THREE.MathUtils.smoothstep(stageElapsed, 0, MOLA_SUN_BASK_LOOK_AT_ENTER_BLEND_DURATION)
        : 1 - THREE.MathUtils.smoothstep(stageElapsed, 0, MOLA_SUN_BASK_LOOK_AT_EXIT_BLEND_DURATION)
      pitchedForward.lerpVectors(visualForward.current, behavior.holdForward, freezeAlpha).normalize()
      visualForward.current.copy(pitchedForward)
    }

    if (debug) {
      const showDirection = debugLayers?.direction ?? true
      const showName = debugLayers?.name ?? true
      const effectiveDebugVelocity = velocity.current * organicMotion.speedScale
      const effectiveDebugSpeedMeters = effectiveDebugVelocity * WORLD_UNIT_METERS
      const debugVectorLength = DEBUG_FORWARD_MIN_LENGTH + effectiveDebugVelocity * DEBUG_FORWARD_SPEED_SCALE
      debugForwardStart.copy(fish.position).addScaledVector(pitchedForward, debugForwardOffset(creature, swim, model))
      debugForwardEnd.copy(debugForwardStart).addScaledVector(pitchedForward, debugVectorLength)
      updateDebugLine(forwardLineRef, debugForwardStart, debugForwardEnd)
      if (forwardLineRef.current) forwardLineRef.current.visible = showDirection && !showAgentDebug
      const showBoidDebug = showDirection && (selected || showAgentDebug)
      const boidDebug = boidDebugState.current
      updateDebugVectorLine(boidSeparationLineRef, debugForwardStart, boidDebug.separation, DEBUG_BOID_VECTOR_SCALE)
      updateDebugVectorLine(boidAlignmentLineRef, debugForwardStart, boidDebug.alignment, DEBUG_BOID_VECTOR_SCALE)
      updateDebugVectorLine(boidCohesionLineRef, debugForwardStart, boidDebug.cohesion, DEBUG_BOID_VECTOR_SCALE)
      updateDebugVectorLine(boidThreatLineRef, debugForwardStart, boidDebug.threat, DEBUG_BOID_VECTOR_SCALE)
      updateDebugVectorLine(boidResultLineRef, debugForwardStart, smoothedBoidSteering.current, DEBUG_BOID_VECTOR_SCALE)
      if (boidSeparationLineRef.current) boidSeparationLineRef.current.visible = showBoidDebug && boidDebug.separation.lengthSq() > 0.000001
      if (boidAlignmentLineRef.current) boidAlignmentLineRef.current.visible = showBoidDebug && boidDebug.alignment.lengthSq() > 0.000001
      if (boidCohesionLineRef.current) boidCohesionLineRef.current.visible = showBoidDebug && boidDebug.cohesion.lengthSq() > 0.000001
      if (boidThreatLineRef.current) boidThreatLineRef.current.visible = showBoidDebug && boidDebug.threat.lengthSq() > 0.000001
      if (boidResultLineRef.current) boidResultLineRef.current.visible = showBoidDebug && smoothedBoidSteering.current.lengthSq() > 0.000001

      // Neighbor connectors (colored by relation) + heading ticks, tracking live positions.
      // Only drawn for the focused fish (selected or agent-debug) so one individual's
      // perception is legible instead of every sampled fish webbing the whole school.
      const showNeighborWeb = showBoidDebug && (selected || showAgentDebug)
      const headingTickLength = Math.max(0.35, bodyLength * 0.9)
      for (let n = 0; n < BOID_MAX_DEBUG_NEIGHBORS; n += 1) {
        const connector = boidNeighborLineRefs.current[n]
        const headingTick = boidNeighborHeadingRefs.current[n]
        const active = showNeighborWeb && n < boidDebug.neighborActive
        if (connector) {
          if (active) {
            const slot = boidDebug.neighbors[n]
            const live = getFishEntry(slot.id)
            debugNeighborEnd.copy(live?.position ?? slot.pos)
            updateDebugLine({ current: connector }, debugForwardStart, debugNeighborEnd)
            const color = BOID_RELATION_COLORS[slot.relation] ?? BOID_RELATION_COLORS.neutral
            if (connector.material?.color) connector.material.color.copy(color)
            if (headingTick) {
              debugNeighborStart.copy(debugNeighborEnd)
              debugNeighborHeadingEnd.copy(debugNeighborStart).addScaledVector(live?.forward ?? slot.forward, headingTickLength)
              updateDebugLine({ current: headingTick }, debugNeighborStart, debugNeighborHeadingEnd)
              headingTick.visible = true
            }
          } else if (headingTick) {
            headingTick.visible = false
          }
          connector.visible = active
        }
      }
      if (boidLabelRef.current) {
        boidLabelRef.current.position.copy(debugForwardStart).addScaledVector(up, 0.30 + size * 0.06)
        boidLabelRef.current.text = `boid n${boidDebug.neighborCount} social ${boidDebug.socialWeightTotal.toFixed(1)}\nsep ${boidDebug.separation.length().toFixed(2)} align ${boidDebug.alignment.length().toFixed(2)} coh ${boidDebug.cohesion.length().toFixed(2)} threat ${boidDebug.threat.length().toFixed(2)} out ${smoothedBoidSteering.current.length().toFixed(2)}`
        boidLabelRef.current.lookAt(camera.position)
        boidLabelRef.current.visible = showBoidDebug
      }
      if (speedLabelRef.current) {
        speedLabelRef.current.position.copy(debugForwardEnd).addScaledVector(up, 0.14)
        speedLabelRef.current.text = `${effectiveDebugSpeedMeters.toFixed(2)} m/s`
        speedLabelRef.current.lookAt(camera.position)
        speedLabelRef.current.visible = showDirection && !showAgentDebug
      }
      if (agentLabelRef.current) {
        const bodyLength = creatureBodyLength(creature, swim)
        const status = agentStatus.current
        const displayName = creature.customName?.trim() || species?.name || creature.species || 'Unknown'
        const scientificName = species?.scientificName ?? '—'
        labelPosition.current.copy(fish.position).addScaledVector(up, bodyLength * 0.46 + 0.28)
        agentLabelRef.current.position.copy(labelPosition.current)
        const currentAnimation = animationRef.current ?? '—'
        const queuedAction = sunBaskQueued.current ? 'sun-bask' : 'none'
        agentLabelRef.current.text = `${creature.id ?? '?'} • ${displayName}\n${scientificName}\nspeed ${effectiveDebugSpeedMeters.toFixed(2)} m/s\n${status} • ${currentAnimation}\nqueue ${queuedAction}`
        agentLabelRef.current.lookAt(camera.position)
        agentLabelRef.current.visible = showDirection && showAgentDebug
      }
      if (nameLabelRef.current) {
        nameLabelRef.current.position.copy(fish.position).addScaledVector(up, creatureBodyLength(creature, swim) * 0.16 + 0.045)
        nameLabelRef.current.lookAt(camera.position)
        // World-space text shrinks with distance, so far-off labels became unreadable.
        // Scale ~linearly with camera distance to hold a roughly constant on-screen size,
        // clamped so it neither vanishes far away nor overwhelms up close.
        const nameLabelDistance = fish.position.distanceTo(camera.position)
        nameLabelRef.current.scale.setScalar(THREE.MathUtils.clamp(nameLabelDistance * DEBUG_LABEL_DISTANCE_SCALE, 0.85, 3.2))
        nameLabelRef.current.visible = showName && !showAgentDebug
      }
    }

    if (model) {
      const smoothMolaLookAt = isSoloAgent && isMolaCreature(creature)
      const currentLookBehaviorKey = smoothMolaLookAt
        ? `${agentBehavior.current?.type ?? 'idle'}:${agentBehavior.current?.stage ?? agentBehavior.current?.completion ?? 'none'}`
        : ''
      if (currentLookBehaviorKey !== lookBehaviorKey.current) {
        lookBehaviorKey.current = currentLookBehaviorKey
        lookBehaviorTransitionStartedAt.current = now
      }

      fish.up.copy(up)
      lookTarget.copy(fish.position).addScaledVector(pitchedForward, -1)
      fish.lookAt(lookTarget)
      targetLookQuaternion.copy(fish.quaternion)
      if (!hasBaseLookQuaternion.current) {
        baseLookQuaternion.current.copy(targetLookQuaternion)
        hasBaseLookQuaternion.current = true
      } else if (smoothMolaLookAt) {
        const transitionElapsed = now - lookBehaviorTransitionStartedAt.current
        const transitionAlpha = 1 - THREE.MathUtils.smoothstep(
          transitionElapsed,
          0,
          MOLA_BEHAVIOR_LOOK_AT_TRANSITION_DURATION,
        )
        const lookResponse = THREE.MathUtils.lerp(
          MOLA_BEHAVIOR_LOOK_AT_RESPONSE,
          MOLA_BEHAVIOR_LOOK_AT_TRANSITION_RESPONSE,
          transitionAlpha,
        )
        baseLookQuaternion.current.slerp(targetLookQuaternion, 1 - Math.exp(-delta * lookResponse))
      } else {
        baseLookQuaternion.current.copy(targetLookQuaternion)
      }
      fish.quaternion.copy(baseLookQuaternion.current)
      if (agentBehavior.current?.type === 'sun-bask') {
        const behavior = agentBehavior.current
        const stageElapsed = Math.max(0, now - (behavior.stageStartedAt ?? agentBehaviorStartedAt.current))
        const rollAlpha = behavior.stage === 'approach'
          ? (() => {
              const plannedDistance = Math.max(0.001, behavior.approachDistance ?? 0)
              const remainingDistance = agentHasTarget.current ? fish.position.distanceTo(agentTarget.current) : 0
              const distanceProgress = plannedDistance > 0.001
                ? 1 - (remainingDistance / plannedDistance)
                : agentBehaviorDistance.current / Math.max(0.001, agentBehaviorDistance.current + remainingDistance)
              const progress = THREE.MathUtils.clamp(distanceProgress, 0, 1)
              const delayedProgress = THREE.MathUtils.clamp(
                (progress - MOLA_SUN_BASK_ROLL_PROGRESS_START) / Math.max(0.001, 1 - MOLA_SUN_BASK_ROLL_PROGRESS_START),
                0,
                1,
              )
              const easedProgress = delayedProgress * delayedProgress * delayedProgress * (delayedProgress * (delayedProgress * 6 - 15) + 10)
              return easedProgress * MOLA_SUN_BASK_APPROACH_MAX_ROLL_ALPHA
            })()
          : (behavior.stage === 'hold'
            ? (() => {
                const completionAlpha = THREE.MathUtils.clamp(stageElapsed / MOLA_SUN_BASK_HOLD_ROLL_COMPLETE_DURATION, 0, 1)
                const easedCompletion = completionAlpha * completionAlpha * (3 - 2 * completionAlpha)
                return THREE.MathUtils.lerp(behavior.holdStartRollAlpha ?? MOLA_SUN_BASK_APPROACH_MAX_ROLL_ALPHA, 1, easedCompletion)
              })()
            : (behavior.stage === 'exit'
              ? (() => {
                  const exitAlpha = THREE.MathUtils.clamp(stageElapsed / MOLA_SUN_BASK_EXIT_ROLL_DURATION, 0, 1)
                  const easedExit = exitAlpha * exitAlpha * (3 - 2 * exitAlpha)
                  return THREE.MathUtils.lerp(behavior.exitStartRollAlpha ?? 1, 0, easedExit)
                })()
              : 0))
        bankQuaternion.setFromAxisAngle(pitchedForward, (behavior.side ?? 1) * Math.PI * 0.5 * rollAlpha)
        fish.quaternion.premultiply(bankQuaternion)
        if (behavior.stage === 'hold' || behavior.stage === 'exit') {
          const driftElapsed = Math.max(0, now - (behavior.stageStartedAt ?? agentBehaviorStartedAt.current))
          const driftIntroAlpha = behavior.stage === 'hold'
            ? THREE.MathUtils.smoothstep(driftElapsed, 0, MOLA_SUN_BASK_DRIFT_INTRO_DURATION)
            : 1
          const driftFade = behavior.stage === 'exit'
            ? 1 - THREE.MathUtils.clamp(stageElapsed / MOLA_SUN_BASK_EXIT_ROLL_DURATION, 0, 1)
            : driftIntroAlpha
          const yawDrift = behavior.stage === 'exit'
            ? (behavior.exitStartYawDrift ?? 0) * driftFade
            : Math.sin(driftElapsed * 0.19 + motion.bobPhase * 1.7) * MOLA_SUN_BASK_DRIFT_YAW_AMPLITUDE * driftFade
          const rollDrift = behavior.stage === 'exit'
            ? (behavior.exitStartRollDrift ?? 0) * driftFade
            : Math.sin(driftElapsed * 0.27 + motion.bobPhase * 2.3 + 1.1) * MOLA_SUN_BASK_DRIFT_ROLL_AMPLITUDE * driftFade
          bankQuaternion.setFromAxisAngle(up, yawDrift)
          fish.quaternion.premultiply(bankQuaternion)
          bankQuaternion.setFromAxisAngle(pitchedForward, rollDrift)
          fish.quaternion.premultiply(bankQuaternion)
        }
      } else if (isMolaCreature(creature) && isDrifting) {
        // Idle drift has a little settling weight: only a shallow, slow roll,
        // never the deliberate surface-bask bank owned by the behavior above.
        const idleDriftRollRadians = Number.isFinite(model?.proceduralAnimation?.idleDriftRollRadians)
          ? model.proceduralAnimation.idleDriftRollRadians
          : 0.035
        const idleDriftRollFrequency = Number.isFinite(model?.proceduralAnimation?.idleDriftRollFrequency)
          ? model.proceduralAnimation.idleDriftRollFrequency
          : 0.18
        const idleDriftRoll = Math.sin(now * idleDriftRollFrequency + motion.bobPhase * 1.9 + 0.6)
          * idleDriftRollRadians
        bankQuaternion.setFromAxisAngle(pitchedForward, idleDriftRoll)
        fish.quaternion.premultiply(bankQuaternion)
      }
    } else {
      lookTarget.copy(fish.position).add(pitchedForward)
      fish.lookAt(lookTarget)
      fish.rotateY(Math.PI / 2)
    }

    const pitch = THREE.MathUtils.clamp(pitchedForward.y * 0.55, -0.22, 0.22)
    if (!model) fish.rotateZ(pitch)
    fish.up.lerp(up, 0.18)

    if (debug && canInstanceSardine && typeof window !== 'undefined') {
      const stats = window[SARDINE_DEBUG_GLOBAL] ?? { frames: 0, samples: [] }
      stats.frames += 1
      if (stats.samples.length < 12 || selected) {
        const projected = fish.position.clone().project(camera)
        const meshDetails = []
        if (selected) {
          fish.traverse(child => {
            if (!child.isMesh) return
            const material = Array.isArray(child.material) ? child.material[0] : child.material
            meshDetails.push({
              name: child.name,
              visible: child.visible,
              proxy: Boolean(child.userData?.interactionProxy),
              opacity: material?.opacity,
              transparent: material?.transparent,
              geometry: child.geometry?.attributes?.position?.count,
              scale: [Number(child.scale.x.toFixed(3)), Number(child.scale.y.toFixed(3)), Number(child.scale.z.toFixed(3))],
            })
          })
        }
        const sample = {
          id: creature.id,
          selected,
          debug,
          instancedSardineLod,
          renderModel: Boolean(renderModel),
          position: [Number(fish.position.x.toFixed(2)), Number(fish.position.y.toFixed(2)), Number(fish.position.z.toFixed(2))],
          camera: [Number(camera.position.x.toFixed(2)), Number(camera.position.y.toFixed(2)), Number(camera.position.z.toFixed(2))],
          ndc: [Number(projected.x.toFixed(2)), Number(projected.y.toFixed(2)), Number(projected.z.toFixed(2))],
          distanceToCamera: Number(camera.position.distanceTo(fish.position).toFixed(2)),
          children: fish.children.length,
          meshDetails,
        }
        const index = stats.samples.findIndex(item => String(item.id) === String(creature.id))
        if (index >= 0) stats.samples[index] = sample
        else stats.samples.push(sample)
      }
      window[SARDINE_DEBUG_GLOBAL] = stats
    }

    const forceDetailedForDebug = debug && !debugLodView
    if (canInstanceSardine && !selected && !forceDetailedForDebug) {
      const distanceToCamera = camera.position.distanceTo(fish.position)
      const lod2Distance = zoomActive ? SARDINE_INSTANCE_DISTANCE : SARDINE_TANK_INSTANCE_DISTANCE
      const lod1Distance = zoomActive ? SARDINE_LOD1_DISTANCE : SARDINE_TANK_LOD1_DISTANCE
      const nextInstancedLod = (() => {
        if (instancedSardineLod === 'lod2') {
          if (distanceToCamera > lod2Distance - SARDINE_INSTANCE_HYSTERESIS) return 'lod2'
        } else if (distanceToCamera > lod2Distance + SARDINE_INSTANCE_HYSTERESIS) {
          return 'lod2'
        }

        if (instancedSardineLod === 'lod1') {
          if (distanceToCamera > lod1Distance - SARDINE_INSTANCE_HYSTERESIS) return 'lod1'
        } else if (distanceToCamera > lod1Distance + SARDINE_INSTANCE_HYSTERESIS) {
          return 'lod1'
        }

        return null
      })()
      cullProjection.copy(fish.position).project(camera)
      const offscreenCulled = (
        cullProjection.z < -1 ||
        cullProjection.z > 1 ||
        Math.abs(cullProjection.x) > SARDINE_VIEW_CULL_MARGIN_NDC ||
        Math.abs(cullProjection.y) > SARDINE_VIEW_CULL_MARGIN_NDC
      )
      if (modelRootRef.current) modelRootRef.current.visible = !offscreenCulled
      updateSardineFrustumEntry(creature.id, {
        candidate: true,
        culled: offscreenCulled,
      })
      // Report what is actually on screen, not what we are about to switch to.
      // `renderModel` keys off instancedSardineLod (the committed state), so during a
      // pending transition the detailed model is still the thing being drawn — and
      // this is the readout used to diagnose exactly that.
      updateSardineLod0Entry(creature.id, {
        candidate: !instancedSardineLod,
        drawn: !instancedSardineLod && !offscreenCulled,
      })

      // The detailed model is mounted/unmounted through React state
      // (renderModel = model && !instancedSardineLod), which commits a render after
      // this frame. Handing the fish to the instanced layer before that unmount lands
      // draws it twice — once as an instance, once as the still-mounted model.
      //
      // Normally a frame or two and invisible. It stops being invisible when many fish
      // cross a threshold at once and the main thread is busy enough to delay the
      // re-render, which is precisely what a tank switch does: the camera resets, the
      // whole school re-evaluates, and the scene warm-up compiles on the same thread.
      // Each sardine also owns its own setState, so flushing means ~275 re-renders.
      //
      // So registration waits for the state to catch up. The overlap still exists, but
      // it now fails the harmless way: a transitioning fish stays detailed a frame
      // longer instead of being drawn twice. Too much detail nobody notices; a doubled
      // fish they do.
      const lodTransitionPending = nextInstancedLod !== instancedSardineLod
      if (lodTransitionPending) setInstancedSardineLod(nextInstancedLod)
      if (!lodTransitionPending && nextInstancedLod && !offscreenCulled) {
        instancedEntry.position.copy(fish.position)
        instancedEntry.quaternion.copy(fish.quaternion).normalize()
        instancedEntry.scale = size
        instancedEntry.matrix.compose(
          fish.position,
          instancedEntry.quaternion,
          tempScale.set(size, size, size),
        )
        if (nextInstancedLod === 'lod1') {
          updateSardineLod1Instance(creature.id, instancedEntry)
          removeSardineInstance(creature.id)
        } else {
          updateSardineInstance(creature.id, instancedEntry)
          removeSardineLod1Instance(creature.id)
        }
      } else {
        removeSardineLod1Instance(creature.id)
        removeSardineInstance(creature.id)
      }
    } else {
      if (modelRootRef.current) modelRootRef.current.visible = true
      removeSardineLod0Entry(creature.id)
      removeSardineFrustumEntry(creature.id)
      if (instancedSardineLod) setInstancedSardineLod(null)
      removeSardineLod1Instance(creature.id)
      removeSardineInstance(creature.id)
    }

    if (model) {
      const animationForward = pitchedForward
      let turn = 0
      if (previousTangent.current.lengthSq() > 0) {
        turn = previousTangent.current.z * animationForward.x - previousTangent.current.x * animationForward.z
      }
      if (previousTangent.current.lengthSq() > 0 && now > animationCooldown.current && now > animationHoldUntil.current) {
        let triggeredAction = false
        if (turn > motion.turnTriggerThreshold) {
          const turnDuration = motion.turnActionDuration
          const turnAnimation = resolveMoveAnimation(model, 'turnLeft')
          const turnAnimationDuration = modelActionAnimationDuration(model, turnAnimation, turnDuration)
          playAnimation(turnAnimation)
          playSwimSfx('turn', THREE.MathUtils.clamp(Math.abs(turn) * 34, 0.34, 0.88), now)
          actionSpeedStartAt.current = now
          actionSpeedUntil.current = now + turnDuration
          actionSpeedTarget.current = motion.snapSpeed
          animationHoldUntil.current = now + turnAnimationDuration
          animationCooldown.current = now + Math.max(0.7, turnAnimationDuration * 0.72)
          driftUntil.current = 0
          triggeredAction = true
        } else if (turn < -motion.turnTriggerThreshold) {
          const turnDuration = motion.turnActionDuration
          const turnAnimation = resolveMoveAnimation(model, 'turnRight')
          const turnAnimationDuration = modelActionAnimationDuration(model, turnAnimation, turnDuration)
          playAnimation(turnAnimation)
          playSwimSfx('turn', THREE.MathUtils.clamp(Math.abs(turn) * 34, 0.34, 0.88), now)
          actionSpeedStartAt.current = now
          actionSpeedUntil.current = now + turnDuration
          actionSpeedTarget.current = motion.snapSpeed
          animationHoldUntil.current = now + turnAnimationDuration
          animationCooldown.current = now + Math.max(0.7, turnAnimationDuration * 0.72)
          driftUntil.current = 0
          triggeredAction = true
        } else if (Math.abs(turn) < BURST_STRAIGHT_THRESHOLD && now > nextBurstAt.current) {
          const burstDuration = motion.burstActionDuration
          const burstAnimation = resolveMoveAnimation(model, 'burst')
          const burstAnimationDuration = modelActionAnimationDuration(model, burstAnimation, burstDuration)
          const burstMovementDelay = modelActionMovementDelay(model, burstAnimation)
          playAnimation(burstAnimation)
          playSwimSfx('burst', THREE.MathUtils.clamp(motion.burstSpeed / Math.max(0.001, motion.idleSpeed) * 0.18, 0.42, 1), now)
          actionSpeedStartAt.current = now + burstMovementDelay
          actionSpeedUntil.current = actionSpeedStartAt.current + burstDuration
          actionSpeedTarget.current = motion.burstSpeed
          animationHoldUntil.current = now + burstAnimationDuration
          animationCooldown.current = now + Math.max(1.0, burstAnimationDuration * 0.65)
          nextBurstAt.current = now + motion.burstInterval
          driftUntil.current = 0
          triggeredAction = true
        }

        if (!triggeredAction) {
          if (hasDriftMove) {
            if (now >= nextDriftAt.current) {
              driftUntil.current = now + motion.driftDuration
              nextDriftAt.current = driftUntil.current + motion.driftInterval
            }
            playAnimation(now < driftUntil.current ? driftMove : resolveMoveAnimation(model, 'cruise'))
          } else {
            playAnimation(resolveMoveAnimation(model, 'cruise'))
          }
        }
      } else if (now > animationHoldUntil.current) {
        if (hasDriftMove) {
          if (now >= nextDriftAt.current) {
            driftUntil.current = now + motion.driftDuration
            nextDriftAt.current = driftUntil.current + motion.driftInterval
          }
          playAnimation(now < driftUntil.current ? driftMove : resolveMoveAnimation(model, 'cruise'))
        } else {
          playAnimation(resolveMoveAnimation(model, 'cruise'))
        }
      }

      const activeAnimation = animationRef.current
      if (activeAnimation === resolveMoveAnimation(model, 'burst')) {
        animationSpeedScaleRef.current = THREE.MathUtils.clamp(velocity.current / Math.max(0.001, motion.burstSpeed), 0.72, 1.18)
      } else if (activeAnimation === resolveMoveAnimation(model, 'cruise')) {
        animationSpeedScaleRef.current = THREE.MathUtils.clamp(velocity.current / Math.max(0.001, motion.idleSpeed), 0.62, 1.32)
      } else if (activeAnimation === driftMove) {
        animationSpeedScaleRef.current = THREE.MathUtils.clamp(velocity.current / Math.max(0.001, motion.idleSpeed), 0.28, 0.62)
      } else {
        animationSpeedScaleRef.current = 1
      }

      curveDeformInputRef.current.turn = THREE.MathUtils.clamp(turn * 10.5 + curveDeformTurnIntent.current, -1, 1)
      curveDeformInputRef.current.speed01 = THREE.MathUtils.clamp(velocity.current / Math.max(0.001, motion.burstSpeed), 0, 1)
      curveDeformInputRef.current.accel01 = THREE.MathUtils.clamp(
        (velocity.current - curveDeformPreviousSpeed.current) / Math.max(0.001, motion.burstSpeed * delta),
        -1,
        1,
      )
      curveDeformPreviousSpeed.current = velocity.current
      // Actual forward travel this frame vs the intended cruise rate. Movement is
      // clamped to the follow-target distance, so a fish crawling out of a turn reads
      // slow here even though velocity.current still says "cruise". Curve-deform uses
      // this to straighten the tail before the fish resumes swimming forward.
      const actualForwardSpeed = frameMove.length() / Math.max(1e-4, delta)
      const cruiseSpeedRef = Math.max(1e-3, motion.idleSpeed * organicMotion.speedScale)
      curveDeformSpeedEase.current = THREE.MathUtils.damp(
        curveDeformSpeedEase.current,
        THREE.MathUtils.clamp(actualForwardSpeed / cruiseSpeedRef, 0, 1),
        6,
        delta,
      )
      curveDeformInputRef.current.speedEase01 = curveDeformSpeedEase.current
      curveDeformInputRef.current.burst01 = activeAnimation === resolveMoveAnimation(model, 'burst')
        ? THREE.MathUtils.clamp((animationHoldUntil.current - now) / Math.max(0.001, modelActionAnimationDuration(model, activeAnimation, motion.burstActionDuration)), 0, 1)
        : 0

      const suppressProceduralBank = agentBehavior.current?.type === 'sun-bask'
      const bank = suppressProceduralBank ? 0 : THREE.MathUtils.clamp(turn * 4, -MAX_MODEL_BANK, MAX_MODEL_BANK)
      bankQuaternion.setFromAxisAngle(pitchedForward, -bank)
      fish.quaternion.premultiply(bankQuaternion)

      previousTangent.current.copy(animationForward)
    }

    // Snapshot this frame's kinematic state so a later remount (tank switch) resumes from here.
    // Vector/quaternion state is shared by reference with the store and needs no copy; only the
    // group position and the scalar bookkeeping are mirrored back.
    runtime.hasPosition = true
    runtime.position.copy(fish.position)
    runtime.hasFollowPosition = hasFollowPosition.current
    runtime.hasVisualForward = hasVisualForward.current
    runtime.hasBaseLookQuaternion = hasBaseLookQuaternion.current
    runtime.visualPitch = visualPitch.current
    runtime.velocity = velocity.current
    runtime.simulationTime = simulationTime.current
    runtime.boidDecisionNextAt = boidDecisionNextAt.current
    runtime.nextBurstAt = nextBurstAt.current
    runtime.nextDriftAt = nextDriftAt.current
    runtime.driftUntil = driftUntil.current
  })

  const focusScale = 1
  const bodyLength = creatureBodyLength(creature, swim)
  const agentDebugLabelScale = THREE.MathUtils.clamp(bodyLength * 0.024, DEBUG_AGENT_LABEL_SCALE, 0.22)
  const showSelectedOutline = selected && debug && !hideSelectionSilhouette
  const renderModel = model && !instancedSardineLod
  const renderMolaPlaceholder = !model && species?.placeholder?.type === 'mola-mola'
  const proxyDimensions = interactionProxyDimensions(species, swim)
  const lodDebugColor = debugLodView && renderModel && canInstanceSardine ? LOD0_DEBUG_COLOR : null
  const rimColor = showSelectedOutline ? SELECTED_OUTLINE_COLOR : (debug && isSchoolLeader ? LEADER_OUTLINE_COLOR : null)
  const rimIntensity = showSelectedOutline ? SELECTED_RIM_INTENSITY : LEADER_RIM_INTENSITY
  const fresnelRim = useMemo(() => (
    rimColor ? { color: rimColor, intensity: rimIntensity, power: RIM_POWER } : null
  ), [rimColor, rimIntensity])

  const handleSelect = (event) => {
    event.stopPropagation()
    event.nativeEvent?.stopImmediatePropagation?.()
    event.nativeEvent?.preventDefault?.()
    if (event.delta > 8) return
    onClick(creature, ref)
  }

  return (
    <group>
      {debug && (
        <>
          <line ref={forwardLineRef} geometry={forwardDebugGeometry} raycast={() => null}>
            <lineBasicMaterial color="#ff4fd8" transparent opacity={0.95} depthTest={false} depthWrite={false} />
          </line>
          <line ref={boidSeparationLineRef} geometry={boidSeparationGeometry} raycast={() => null}>
            <lineBasicMaterial color="#ff5a36" transparent opacity={0.95} depthTest={false} depthWrite={false} />
          </line>
          <line ref={boidAlignmentLineRef} geometry={boidAlignmentGeometry} raycast={() => null}>
            <lineBasicMaterial color="#80ff72" transparent opacity={0.95} depthTest={false} depthWrite={false} />
          </line>
          <line ref={boidCohesionLineRef} geometry={boidCohesionGeometry} raycast={() => null}>
            <lineBasicMaterial color="#ffd166" transparent opacity={0.95} depthTest={false} depthWrite={false} />
          </line>
          <line ref={boidThreatLineRef} geometry={boidThreatGeometry} raycast={() => null}>
            <lineBasicMaterial color="#ff2fa0" transparent opacity={0.95} depthTest={false} depthWrite={false} />
          </line>
          <line ref={boidResultLineRef} geometry={boidResultGeometry} raycast={() => null}>
            <lineBasicMaterial color="#ffffff" transparent opacity={0.95} depthTest={false} depthWrite={false} />
          </line>
          {boidNeighborGeometries.map((geometry, n) => (
            <line
              key={`boid-neighbor-${n}`}
              ref={el => { boidNeighborLineRefs.current[n] = el }}
              geometry={geometry}
              visible={false}
              raycast={() => null}
            >
              <lineBasicMaterial color="#9aa7b2" transparent opacity={0.7} depthTest={false} depthWrite={false} />
            </line>
          ))}
          {boidNeighborHeadingGeometries.map((geometry, n) => (
            <line
              key={`boid-neighbor-heading-${n}`}
              ref={el => { boidNeighborHeadingRefs.current[n] = el }}
              geometry={geometry}
              visible={false}
              raycast={() => null}
            >
              <lineBasicMaterial color="#7df9ff" transparent opacity={0.9} depthTest={false} depthWrite={false} />
            </line>
          ))}
          <Text
            ref={boidLabelRef}
            fontSize={DEBUG_LABEL_SCALE}
            font={DEBUG_LABEL_FONT}
            color="#ffffff"
            anchorX="center"
            anchorY="middle"
            depthTest={false}
            renderOrder={22}
            raycast={() => null}
          >
            boid n0
          </Text>
          <Text
            ref={speedLabelRef}
            fontSize={DEBUG_LABEL_SCALE}
            font={DEBUG_LABEL_FONT}
            color="#ff8fe7"
            anchorX="center"
            anchorY="middle"
            depthTest={false}
            raycast={() => null}
          >
            0.00 m/s
          </Text>
          {showAgentDebug && (
            <Text
              ref={agentLabelRef}
              fontSize={agentDebugLabelScale}
              font={DEBUG_LABEL_FONT}
              color="#9af7ff"
              anchorX="center"
              anchorY="middle"
              depthTest={false}
              renderOrder={20}
              raycast={() => null}
            >
              agent cruise-wander
            </Text>
          )}
          <Text
            ref={nameLabelRef}
            fontSize={DEBUG_NAME_LABEL_SCALE}
            font={DEBUG_LABEL_FONT}
            color="#d6f7ff"
            anchorX="center"
            anchorY="middle"
            depthTest={false}
            raycast={() => null}
          >
            {`${creature.id ?? '?'} · ${creature.species ?? 'unknown'}${species?.scientificName ? `\n${species.scientificName}` : ''}`}
          </Text>
        </>
      )}
      <group
        ref={ref}
        scale={[size * focusScale, size * focusScale, size * focusScale]}
        onPointerUp={handleSelect}
        onClick={handleSelect}
      >
        <mesh userData={{ interactionProxy: true }}>
          <boxGeometry args={proxyDimensions} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} color="#000000" />
        </mesh>
        <group ref={modelRootRef}>
          {renderModel ? (
            <FishModel
              key={`${model.path}:${lodDebugColor ?? 'normal'}:${rimColor ?? 'none'}`}
              model={model}
              animation={animation}
              animationVariation={animationVariation}
              animationSpeedScaleRef={animationSpeedScaleRef}
              curveDeformInputRef={curveDeformInputRef}
              debugSimulationSpeed={debugSimulationSpeed}
              debugCurveBones={debug && selected && Boolean(debugLayers?.bones)}
              debugParentScale={size * focusScale}
              rim={fresnelRim}
              lodDebugColor={lodDebugColor}
            />
          ) : renderMolaPlaceholder ? (
            <MolaMolaPlaceholder
              species={species}
              swim={swim}
              rimColor={rimColor}
              rimIntensity={rimIntensity}
            />
          ) : !model ? (
            <>
              {rimColor && (
                <mesh scale={1.02} raycast={() => null}>
                  <boxGeometry args={[0.7, 0.28, 0.18]} />
                  <meshStandardMaterial color="#7ab8c0" emissive={rimColor} emissiveIntensity={rimIntensity} roughness={0.42} metalness={0.02} />
                </mesh>
              )}
              <mesh>
                <boxGeometry args={[0.7, 0.28, 0.18]} />
                <meshStandardMaterial
                  color="#7ab8c0"
                  roughness={0.42}
                  metalness={0.02}
                  envMapIntensity={0.85}
                />
              </mesh>
            </>
          ) : null}
        </group>
      </group>
    </group>
  )
}

// Preload the assets species.js actually resolves to. This list drifted when the
// static/procedural models landed: it kept naming the superseded rigged GLBs, so
// every load eagerly fetched sardine.glb and mahi-mahi_female.glb — 5.79 MB that
// is never drawn — while the _static_parts models that *are* drawn were left to
// load lazily on first sighting. Exactly backwards.
//
// Every model species.js can resolve for the mahi is covered: its base
// model.path points at the male static mesh too, so the rigged mahi-mahi_male.glb
// is gone entirely rather than sitting unreferenced.
//
// This list is deliberately exhaustive — every model the tank can draw is here.
// The mako was previously left out on the reasoning that one creature did not
// justify 3.10 MB up front, but a lazy fetch on first sighting stalls the frame
// mid-session, and the landing gate now covers the load anyway. Being exhaustive
// also keeps the gate's progress bar honest: <FishModel>'s useGLTF then resolves
// from drei's cache instead of opening a second wave of requests after the
// Supabase fetch settles, which would send the bar to 100% and restart it.
useGLTF.preload('/models/fish/sardine/sardine_static.glb')
useGLTF.preload('/models/fish/mola-alexandrini/mola-alexandrini.glb')
useGLTF.preload('/models/fish/mahi-mahi/mahi-mahi_male_static_parts.glb')
useGLTF.preload('/models/fish/mahi-mahi/mahi-mahi_female_static_parts.glb')
useGLTF.preload('/models/fish/isurus-oxyrinchus/isurus-oxyrinchus_static_parts.glb')
