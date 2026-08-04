import { useFrame } from '@react-three/fiber'
import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { FLOOR_Y } from './Environment'
import { FISH_REGISTRY } from './fishRegistry'
import { SURFACE_PLANE_Y } from './WaterSurface'

const HERO_QUEUE_LENGTH = 4
const DIRECTOR_EVALUATION_SECONDS = 0.25
const MIN_SHOT_SECONDS = 5
const MAX_SHOT_SECONDS = 10
const BAD_SHOT_GRACE_SECONDS = 2.2
const BAD_SHOT_HOLD_SECONDS = 0.8
const MAX_BRIDGE_DISTANCE = 34
const FAR_BRIDGE_DISTANCE = 58
const CAMERA_FLOOR_CLEARANCE = 1.8
const CAMERA_SURFACE_CLEARANCE = 0.45
const WORLD_UP = new THREE.Vector3(0, 1, 0)

const MOVEMENTS_BY_TEMPLATE = {
  'school-wide': ['still', 'truck', 'truck', 'dolly'],
  'pair-wide': ['still', 'truck', 'dolly', 'track'],
  'member-cutaway': ['still', 'track', 'tilt', 'dolly'],
  'profile-track': ['still', 'track', 'truck', 'dolly'],
  'hero-static': ['still', 'tilt', 'dolly'],
  'lead-track': ['dolly', 'dolly', 'track', 'truck'],
  'relationship-wide': ['still', 'truck', 'dolly'],
}

function vectorIsFinite(vector) {
  return Number.isFinite(vector.x) && Number.isFinite(vector.y) && Number.isFinite(vector.z)
}

function hashString(value) {
  let hash = 2166136261
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

function mulberry32(seed) {
  let value = seed >>> 0
  return () => {
    value |= 0
    value = (value + 0x6D2B79F5) | 0
    let next = Math.imul(value ^ (value >>> 15), 1 | value)
    next = (next + Math.imul(next ^ (next >>> 7), 61 | next)) ^ next
    return ((next ^ (next >>> 14)) >>> 0) / 4294967296
  }
}

function refreshHeroMetrics(hero) {
  if (!hero?.members?.length) return false

  hero.position.set(0, 0, 0)
  hero.forward.set(0, 0, 0)
  hero.bodyLength = 0
  let liveCount = 0

  hero.members.forEach(member => {
    if (!member?.object?.parent) return
    hero.position.add(member.position)
    hero.forward.add(member.forward)
    hero.bodyLength = Math.max(hero.bodyLength, member.bodyLength ?? 1)
    liveCount += 1
  })

  if (!liveCount) return false
  hero.position.multiplyScalar(1 / liveCount)
  if (hero.forward.lengthSq() < 0.0001) hero.forward.set(0, 0, -1)
  else hero.forward.normalize()

  hero.radius = Math.max(hero.bodyLength * 0.5, 0.5)
  hero.members.forEach(member => {
    if (!member?.object?.parent) return
    hero.radius = Math.max(
      hero.radius,
      hero.position.distanceTo(member.position) + (member.bodyLength ?? 1) * 0.5,
    )
  })
  hero.liveCount = liveCount
  return true
}

function buildCinematicHeroes(entries = FISH_REGISTRY.values(), species = null) {
  const schools = new Map()
  const individuals = []

  for (const entry of entries) {
    if (!entry?.object?.parent) continue
    if (!species || entry.species !== species) continue
    if (!entry.schoolId) {
      individuals.push(entry)
      continue
    }
    const school = schools.get(entry.schoolId) ?? []
    school.push(entry)
    schools.set(entry.schoolId, school)
  }

  const heroes = individuals.map(entry => ({
    id: `fish:${entry.creatureId ?? entry.object.uuid}`,
    kind: 'individual',
    species: entry.species,
    members: [entry],
    position: new THREE.Vector3(),
    forward: new THREE.Vector3(),
    radius: 0,
    bodyLength: entry.bodyLength ?? 1,
    liveCount: 1,
  }))

  schools.forEach((members, schoolId) => {
    heroes.push({
      id: `school:${schoolId}`,
      kind: members.length === 2 ? 'pair' : 'school',
      species: members[0]?.species ?? 'unknown',
      members,
      position: new THREE.Vector3(),
      forward: new THREE.Vector3(),
      radius: 0,
      bodyLength: 1,
      liveCount: members.length,
    })
  })

  return heroes.filter(refreshHeroMetrics)
}

function weightedChoice(candidates, weightFor, random) {
  const weighted = candidates.map(candidate => ({ candidate, weight: Math.max(0.001, weightFor(candidate)) }))
  const total = weighted.reduce((sum, entry) => sum + entry.weight, 0)
  let cursor = random() * total
  for (const entry of weighted) {
    cursor -= entry.weight
    if (cursor <= 0) return entry.candidate
  }
  return weighted.at(-1)?.candidate ?? null
}

function chooseNextHero(heroes, currentHero, excludedIds, recent, random) {
  const candidates = heroes.filter(hero => hero.id !== currentHero?.id && !excludedIds.has(hero.id))
  if (!candidates.length) return null

  return weightedChoice(candidates, hero => {
    const lastSeen = recent.get(hero.id) ?? -Infinity
    const recencyWeight = Number.isFinite(lastSeen) ? Math.min(2.8, 0.45 + (performance.now() - lastSeen) / 25000) : 2.8
    const typeContrast = currentHero && hero.kind !== currentHero.kind ? 1.18 : 1
    const distance = currentHero ? hero.position.distanceTo(currentHero.position) : 0
    const bridgeWeight = currentHero ? THREE.MathUtils.clamp(1.7 - distance / 34, 0.18, 1.45) : 1
    return recencyWeight * typeContrast * bridgeWeight
  }, random)
}

function preferredHeroForOrigin(heroes, originCreatureId) {
  if (!originCreatureId) return null
  const origin = String(originCreatureId)
  return heroes.find(hero => hero.members.some(member => String(member.creatureId) === origin)) ?? null
}

function refillQueue(state, heroes, currentHero) {
  state.queue = state.queue.filter(id => heroes.some(hero => hero.id === id) && id !== currentHero?.id)
  const excluded = new Set(state.queue)
  if (currentHero) excluded.add(currentHero.id)

  while (state.queue.length < Math.min(HERO_QUEUE_LENGTH, Math.max(0, heroes.length - 1))) {
    const next = chooseNextHero(heroes, currentHero, excluded, state.recent, state.random)
    if (!next) break
    state.queue.push(next.id)
    excluded.add(next.id)
  }
}

function heroById(heroes, id) {
  return heroes.find(hero => hero.id === id) ?? null
}

function shotDuration(random) {
  return THREE.MathUtils.lerp(MIN_SHOT_SECONDS, MAX_SHOT_SECONDS, random())
}

function movementForTemplate(template, random, previousMovement) {
  const movements = MOVEMENTS_BY_TEMPLATE[template] ?? ['still']
  const movement = movements[Math.floor(random() * movements.length)]
  if (movement !== previousMovement || movements.every(candidate => candidate === previousMovement)) return movement
  const alternatives = movements.filter(candidate => candidate !== previousMovement)
  return random() < 0.72 ? alternatives[Math.floor(random() * alternatives.length)] : movement
}

function createHeroShot(state, hero, now) {
  const templates = hero.kind === 'school'
    ? ['school-wide', 'member-cutaway', 'school-wide']
    : hero.kind === 'pair'
      ? ['pair-wide', 'member-cutaway', 'profile-track', 'hero-static']
      : ['profile-track', 'hero-static', 'lead-track']
  const template = templates[Math.floor(state.random() * templates.length)]
  const movement = movementForTemplate(template, state.random, state.lastMovement)
  state.shotSerial += 1
  return {
    id: state.shotSerial,
    type: 'hero',
    template,
    movement,
    heroId: hero.id,
    nextHeroId: null,
    side: state.random() < 0.5 ? -1 : 1,
    memberIndex: Math.floor(state.random() * Math.max(1, hero.members.length)),
    startedAt: now,
    duration: shotDuration(state.random),
    lockedPosition: null,
    movementState: null,
    badSince: null,
  }
}

function createBridgeShot(state, hero, nextHero, now) {
  const template = 'relationship-wide'
  const movement = movementForTemplate(template, state.random, state.lastMovement)
  state.shotSerial += 1
  return {
    id: state.shotSerial,
    type: 'bridge',
    template,
    movement,
    heroId: hero.id,
    nextHeroId: nextHero.id,
    side: state.shot?.side ?? (state.random() < 0.5 ? -1 : 1),
    memberIndex: 0,
    startedAt: now,
    duration: THREE.MathUtils.lerp(5, 8, state.random()),
    lockedPosition: null,
    movementState: null,
    badSince: null,
  }
}

function resolveShotSubject(hero, shot, out) {
  if (!refreshHeroMetrics(hero)) return false
  if (shot.template === 'member-cutaway' && hero.members.length) {
    const member = hero.members[shot.memberIndex % hero.members.length]
    if (!member?.object?.parent) return false
    out.position.copy(member.position)
    out.forward.copy(member.forward)
    if (out.forward.lengthSq() < 0.0001) out.forward.set(0, 0, -1)
    else out.forward.normalize()
    out.radius = Math.max(0.4, (member.bodyLength ?? 1) * 0.5)
    out.bodyLength = member.bodyLength ?? 1
    return true
  }

  out.position.copy(hero.position)
  out.forward.copy(hero.forward)
  out.radius = hero.radius
  out.bodyLength = hero.bodyLength
  return true
}

function calculateHeroPose(shot, subject, pose, scratch, minCameraY, maxCameraY) {
  const forward = scratch.forward.copy(subject.forward)
  forward.y *= 0.35
  if (forward.lengthSq() < 0.0001) forward.set(0, 0, -1)
  else forward.normalize()
  const right = scratch.right.crossVectors(WORLD_UP, forward).normalize().multiplyScalar(shot.side)
  const subjectScale = Math.max(subject.bodyLength, subject.radius * 1.35)
  const distance = THREE.MathUtils.clamp(subjectScale * 2.2 + 2.2, 3.8, 24)
  const height = THREE.MathUtils.clamp(subjectScale * 0.3 + 0.55, 0.75, 3.4)

  pose.lookAt.copy(subject.position).addScaledVector(forward, distance * 0.12)
  if (shot.template === 'lead-track') {
    pose.position.copy(subject.position)
      .addScaledVector(forward, distance)
      .addScaledVector(right, distance * 0.22)
      .addScaledVector(WORLD_UP, height)
    pose.fov = 54
  } else if (shot.template === 'school-wide' || shot.template === 'pair-wide') {
    pose.position.copy(subject.position)
      .addScaledVector(right, distance * 1.15)
      .addScaledVector(forward, distance * 0.12)
      .addScaledVector(WORLD_UP, height * 1.2)
    pose.fov = 60
  } else {
    scratch.desiredPosition.copy(subject.position)
      .addScaledVector(right, distance)
      .addScaledVector(forward, distance * 0.28)
      .addScaledVector(WORLD_UP, height)
    if (shot.template === 'hero-static') {
      if (!shot.lockedPosition) shot.lockedPosition = scratch.desiredPosition.clone()
      pose.position.copy(shot.lockedPosition)
    } else {
      pose.position.copy(scratch.desiredPosition)
    }
    pose.fov = shot.template === 'member-cutaway' ? 50 : 55
  }

  pose.position.y = THREE.MathUtils.clamp(pose.position.y, minCameraY, maxCameraY)
  pose.lookAt.y = THREE.MathUtils.clamp(pose.lookAt.y, minCameraY - 1.2, maxCameraY + 0.4)
}

function calculateBridgePose(shot, current, next, pose, scratch, minCameraY, maxCameraY) {
  const midpoint = scratch.midpoint.copy(current.position).add(next.position).multiplyScalar(0.5)
  const spread = current.position.distanceTo(next.position) + current.radius + next.radius
  const forward = scratch.forward.copy(current.forward).add(next.forward)
  forward.y *= 0.25
  if (forward.lengthSq() < 0.0001) forward.set(0, 0, -1)
  else forward.normalize()
  const right = scratch.right.crossVectors(WORLD_UP, forward).normalize().multiplyScalar(shot.side)
  const distance = THREE.MathUtils.clamp(spread * 0.78 + 4.5, 7, 28)

  pose.lookAt.copy(midpoint)
  scratch.desiredPosition.copy(midpoint)
    .addScaledVector(right, distance)
    .addScaledVector(forward, distance * 0.08)
    .addScaledVector(WORLD_UP, THREE.MathUtils.clamp(spread * 0.12 + 1, 1.2, 4))
  if (!shot.lockedPosition) shot.lockedPosition = scratch.desiredPosition.clone()
  pose.position.copy(shot.lockedPosition)
  pose.position.y = THREE.MathUtils.clamp(pose.position.y, minCameraY, maxCameraY)
  pose.lookAt.y = THREE.MathUtils.clamp(pose.lookAt.y, minCameraY - 1.2, maxCameraY + 0.4)
  pose.fov = THREE.MathUtils.clamp(54 + spread * 0.35, 56, 66)
}

function applyShotMovement(shot, subject, pose, now, scratch) {
  if (!shot.movementState) {
    if (shot.movement !== 'track') {
      const lead = THREE.MathUtils.clamp(subject.bodyLength * 0.65, 0.8, 4.5)
      pose.lookAt.addScaledVector(subject.forward, lead)
      pose.fov = THREE.MathUtils.clamp(pose.fov + 7, 35, 75)
    }
    const viewForward = scratch.motionForward.subVectors(pose.lookAt, pose.position)
    if (viewForward.lengthSq() < 0.0001) viewForward.set(0, 0, -1)
    else viewForward.normalize()
    const viewRight = scratch.motionRight.crossVectors(viewForward, WORLD_UP)
    if (viewRight.lengthSq() < 0.0001) viewRight.set(1, 0, 0)
    else viewRight.normalize()
    shot.movementState = {
      position: pose.position.clone(),
      lookAt: pose.lookAt.clone(),
      fov: pose.fov,
      forward: viewForward.clone(),
      right: viewRight.clone().multiplyScalar(shot.side),
      travel: THREE.MathUtils.clamp(subject.bodyLength * 0.5 + subject.radius * 0.18, 1.8, 7),
      tilt: THREE.MathUtils.clamp(pose.position.distanceTo(pose.lookAt) * 0.11, 0.8, 3.5),
    }
  }

  const movement = shot.movementState
  pose.fov = movement.fov
  if (shot.movement === 'track') return

  const progress = THREE.MathUtils.clamp((now - shot.startedAt) / Math.max(0.001, shot.duration), 0, 1)
  pose.position.copy(movement.position)
  pose.lookAt.copy(movement.lookAt)

  if (shot.movement === 'dolly') {
    pose.position.addScaledVector(movement.forward, movement.travel * (progress - 0.35))
  } else if (shot.movement === 'truck') {
    const offset = movement.travel * (progress - 0.5)
    pose.position.addScaledVector(movement.right, offset)
    pose.lookAt.addScaledVector(movement.right, offset)
  } else if (shot.movement === 'tilt') {
    pose.lookAt.y += movement.tilt * (progress - 0.5)
  }
}

function shotCompositionIsBad(camera, shot, subject, scratch, checkFacing = true) {
  scratch.projected.copy(subject.position).project(camera)
  if (scratch.projected.z < -1 || scratch.projected.z > 1) return true
  if (Math.abs(scratch.projected.x) > 0.78 || Math.abs(scratch.projected.y) > 0.72) return true
  if (!checkFacing) return false

  scratch.toCamera.subVectors(camera.position, subject.position).normalize()
  const facing = subject.forward.dot(scratch.toCamera)
  if ((shot.template === 'profile-track' || shot.template === 'hero-static' || shot.template === 'member-cutaway') && Math.abs(facing) > 0.88) return true
  if (shot.template === 'lead-track' && facing < -0.05) return true
  return false
}

function subjectIsInFrame(camera, subject, scratch, maxX = 0.84, maxY = 0.76) {
  scratch.projected.copy(subject.position).project(camera)
  return scratch.projected.z >= -1
    && scratch.projected.z <= 1
    && Math.abs(scratch.projected.x) <= maxX
    && Math.abs(scratch.projected.y) <= maxY
}

function hasDominantForeignSubject(camera, selectedSpecies, subject, scratch) {
  const subjectProminence = subject.bodyLength / Math.max(1, camera.position.distanceTo(subject.position))
  let dominated = false
  FISH_REGISTRY.forEach(entry => {
    if (dominated || entry.species === selectedSpecies || !entry.object?.parent) return
    scratch.foreignProjected.copy(entry.position).project(camera)
    if (scratch.foreignProjected.z < -1 || scratch.foreignProjected.z > 1) return
    if (Math.abs(scratch.foreignProjected.x) > 0.96 || Math.abs(scratch.foreignProjected.y) > 0.9) return
    const prominence = (entry.bodyLength ?? 1) / Math.max(1, camera.position.distanceTo(entry.position))
    if (prominence > subjectProminence * 1.6) dominated = true
  })
  return dominated
}

function shotPoseIsValid(sourceCamera, shot, selectedSpecies, subject, nextSubject, targetPose, scratch) {
  if (!vectorIsFinite(targetPose.position) || !vectorIsFinite(targetPose.lookAt)) return false
  if (!Number.isFinite(targetPose.fov) || targetPose.fov < 35 || targetPose.fov > 75) return false
  if (targetPose.position.distanceToSquared(targetPose.lookAt) < 1) return false

  const camera = scratch.preflightCamera
  camera.aspect = sourceCamera.aspect
  camera.near = sourceCamera.near
  camera.far = sourceCamera.far
  camera.fov = targetPose.fov
  camera.position.copy(targetPose.position)
  camera.up.copy(sourceCamera.up)
  camera.lookAt(targetPose.lookAt)
  camera.updateProjectionMatrix()
  camera.updateMatrixWorld(true)
  if (hasDominantForeignSubject(camera, selectedSpecies, subject, scratch)) return false

  if (shot.type === 'bridge') {
    return Boolean(nextSubject)
      && subjectIsInFrame(camera, subject, scratch)
      && subjectIsInFrame(camera, nextSubject, scratch)
  }
  return !shotCompositionIsBad(camera, shot, subject, scratch)
}

function canBridgeHeroes(currentHero, nextHero) {
  // Independent pairs/schools are separate documentary subjects. Bridging two
  // aggregates points the lens at empty water between them instead of either group.
  return currentHero?.kind === 'individual' && nextHero?.kind === 'individual'
}

function advanceShot(state, heroes, now) {
  const currentHero = heroById(heroes, state.shot?.heroId)
  if (!currentHero) {
    const fallback = weightedChoice(heroes, () => 1, state.random)
    state.shot = fallback ? createHeroShot(state, fallback, now) : null
    return
  }

  if (state.shot.type === 'bridge') {
    const promoted = heroById(heroes, state.shot.nextHeroId)
    if (promoted) {
      state.recent.set(currentHero.id, performance.now())
      state.queue = state.queue.filter(id => id !== promoted.id)
      state.shot = createHeroShot(state, promoted, now)
      refillQueue(state, heroes, promoted)
      return
    }
  }

  refillQueue(state, heroes, currentHero)
  const nextHero = heroById(heroes, state.queue[0])
  if (nextHero && canBridgeHeroes(currentHero, nextHero) && currentHero.position.distanceTo(nextHero.position) <= MAX_BRIDGE_DISTANCE) {
    state.shot = createBridgeShot(state, currentHero, nextHero, now)
    return
  }

  if (nextHero) {
    const distance = currentHero.position.distanceTo(nextHero.position)
    if (canBridgeHeroes(currentHero, nextHero) && (distance <= FAR_BRIDGE_DISTANCE || state.random() < 0.45)) {
      state.shot = createBridgeShot(state, currentHero, nextHero, now)
      return
    }
    state.recent.set(currentHero.id, performance.now())
    state.queue.shift()
    state.shot = createHeroShot(state, nextHero, now)
    refillQueue(state, heroes, nextHero)
    return
  }

  state.shot = createHeroShot(state, currentHero, now)
}

export default function CinematicDirector({ active = false, biome = 'ocean', seed = 0, species = null, originCreatureId = null, poseRef }) {
  const stateRef = useRef(null)
  const scratchRef = useRef({
    subject: { position: new THREE.Vector3(), forward: new THREE.Vector3(), radius: 1, bodyLength: 1 },
    nextSubject: { position: new THREE.Vector3(), forward: new THREE.Vector3(), radius: 1, bodyLength: 1 },
    forward: new THREE.Vector3(),
    right: new THREE.Vector3(),
    midpoint: new THREE.Vector3(),
    desiredPosition: new THREE.Vector3(),
    motionForward: new THREE.Vector3(),
    motionRight: new THREE.Vector3(),
    projected: new THREE.Vector3(),
    foreignProjected: new THREE.Vector3(),
    toCamera: new THREE.Vector3(),
    targetPose: { position: new THREE.Vector3(), lookAt: new THREE.Vector3(), fov: 55 },
    preflightCamera: new THREE.PerspectiveCamera(),
  })

  useEffect(() => {
    stateRef.current = {
      random: mulberry32(hashString(`${seed}:${biome}:${species}:${originCreatureId ?? 'species'}:cinematic`)),
      heroes: [],
      queue: [],
      recent: new Map(),
      shot: null,
      shotSerial: 0,
      lastMovement: null,
      nextEvaluationAt: 0,
      outputShotId: null,
      hasValidOutput: false,
    }
    if (!poseRef.current) poseRef.current = {}
    poseRef.current.active = false
    poseRef.current.subjectCreatureIds = new Set()
    return () => {
      if (poseRef.current) {
        poseRef.current.active = false
        poseRef.current.subjectCreatureIds?.clear()
      }
    }
  }, [active, biome, originCreatureId, poseRef, seed, species])

  useFrame(({ camera, clock }) => {
    const pose = poseRef.current
    if (!pose) return
    const state = stateRef.current
    const enabled = active && Boolean(species)
    pose.active = enabled && Boolean(state?.hasValidOutput)
    if (!enabled) return
    if (!pose.position) pose.position = new THREE.Vector3()
    if (!pose.lookAt) pose.lookAt = new THREE.Vector3()
    if (!pose.subjectCreatureIds) pose.subjectCreatureIds = new Set()

    const now = clock.getElapsedTime()
    if (now >= state.nextEvaluationAt || !state.heroes.length) {
      state.heroes = buildCinematicHeroes(FISH_REGISTRY.values(), species)
      state.nextEvaluationAt = now + DIRECTOR_EVALUATION_SECONDS
      if (!state.shot && state.heroes.length) {
        const firstHero = preferredHeroForOrigin(state.heroes, originCreatureId) ?? weightedChoice(state.heroes, () => 1, state.random)
        state.shot = createHeroShot(state, firstHero, now)
        refillQueue(state, state.heroes, firstHero)
      }
    }

    const shot = state.shot
    if (!shot) return
    const hero = heroById(state.heroes, shot.heroId)
    const subject = scratchRef.current.subject
    if (!hero || !resolveShotSubject(hero, shot, subject)) {
      advanceShot(state, state.heroes, now)
      return
    }

    const minCameraY = (FLOOR_Y[biome] ?? -20) + CAMERA_FLOOR_CLEARANCE
    const maxCameraY = SURFACE_PLANE_Y - CAMERA_SURFACE_CLEARANCE
    const nextHero = shot.nextHeroId ? heroById(state.heroes, shot.nextHeroId) : null
    const targetPose = scratchRef.current.targetPose
    let nextSubject = null
    if (shot.type === 'bridge') {
      if (!nextHero || !resolveShotSubject(nextHero, shot, scratchRef.current.nextSubject)) {
        advanceShot(state, state.heroes, now)
        return
      }
      nextSubject = scratchRef.current.nextSubject
      calculateBridgePose(shot, subject, nextSubject, targetPose, scratchRef.current, minCameraY, maxCameraY)
    } else {
      calculateHeroPose(shot, subject, targetPose, scratchRef.current, minCameraY, maxCameraY)
    }
    applyShotMovement(shot, subject, targetPose, now, scratchRef.current)

    if (state.outputShotId !== shot.id) {
      if (!shotPoseIsValid(camera, shot, species, subject, nextSubject, targetPose, scratchRef.current)) {
        advanceShot(state, state.heroes, now)
        return
      }
      state.lastMovement = shot.movement
      state.outputShotId = shot.id
      pose.subjectCreatureIds.clear()
      if (shot.template === 'member-cutaway') {
        const member = hero.members[shot.memberIndex % hero.members.length]
        if (member?.creatureId !== undefined) pose.subjectCreatureIds.add(String(member.creatureId))
      } else {
        hero.members.forEach(member => {
          if (member?.creatureId !== undefined) pose.subjectCreatureIds.add(String(member.creatureId))
        })
      }
      if (shot.type === 'bridge') {
        nextHero?.members.forEach(member => {
          if (member?.creatureId !== undefined) pose.subjectCreatureIds.add(String(member.creatureId))
        })
      }
    }

    pose.position.copy(targetPose.position)
    pose.lookAt.copy(targetPose.lookAt)
    pose.fov = targetPose.fov
    pose.shotId = shot.id
    pose.shotName = `${shot.template}:${shot.movement}`
    state.hasValidOutput = true
    pose.active = true

    const age = now - shot.startedAt
    if (age >= shot.duration) {
      advanceShot(state, state.heroes, now)
      return
    }

    if (age < BAD_SHOT_GRACE_SECONDS || shot.type === 'bridge') return
    const shotIsBad = shotCompositionIsBad(camera, shot, subject, scratchRef.current, shot.movement === 'track')
      || hasDominantForeignSubject(camera, species, subject, scratchRef.current)
    if (shotIsBad) {
      if (shot.badSince === null) shot.badSince = now
      if (now - shot.badSince >= BAD_SHOT_HOLD_SECONDS) advanceShot(state, state.heroes, now)
    } else {
      shot.badSince = null
    }
  })

  return null
}
