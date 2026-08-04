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
const SHOT_TRANSITION_SECONDS = 2.8
const CAMERA_FLOOR_CLEARANCE = 1.8
const CAMERA_SURFACE_CLEARANCE = 0.45
const WORLD_UP = new THREE.Vector3(0, 1, 0)

function smoothstep(value) {
  const t = THREE.MathUtils.clamp(value, 0, 1)
  return t * t * (3 - 2 * t)
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

function createHeroShot(state, hero, now) {
  const templates = hero.kind === 'school'
    ? ['school-wide', 'member-cutaway', 'school-wide']
    : hero.kind === 'pair'
      ? ['pair-wide', 'member-cutaway', 'profile-track', 'hero-static']
      : ['profile-track', 'hero-static', 'lead-track']
  const template = templates[Math.floor(state.random() * templates.length)]
  state.shotSerial += 1
  return {
    id: state.shotSerial,
    type: 'hero',
    template,
    heroId: hero.id,
    nextHeroId: null,
    side: state.random() < 0.5 ? -1 : 1,
    memberIndex: Math.floor(state.random() * Math.max(1, hero.members.length)),
    startedAt: now,
    duration: shotDuration(state.random),
    lockedPosition: null,
    badSince: null,
  }
}

function createBridgeShot(state, hero, nextHero, now) {
  state.shotSerial += 1
  return {
    id: state.shotSerial,
    type: 'bridge',
    template: 'relationship-wide',
    heroId: hero.id,
    nextHeroId: nextHero.id,
    side: state.shot?.side ?? (state.random() < 0.5 ? -1 : 1),
    memberIndex: 0,
    startedAt: now,
    duration: THREE.MathUtils.lerp(5, 8, state.random()),
    lockedPosition: null,
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

function shotCompositionIsBad(camera, shot, subject, scratch) {
  scratch.projected.copy(subject.position).project(camera)
  if (scratch.projected.z < -1 || scratch.projected.z > 1) return true
  if (Math.abs(scratch.projected.x) > 0.78 || Math.abs(scratch.projected.y) > 0.72) return true

  scratch.toCamera.subVectors(camera.position, subject.position).normalize()
  const facing = subject.forward.dot(scratch.toCamera)
  if ((shot.template === 'profile-track' || shot.template === 'hero-static' || shot.template === 'member-cutaway') && Math.abs(facing) > 0.88) return true
  if (shot.template === 'lead-track' && facing < -0.05) return true
  return false
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
  if (nextHero && currentHero.position.distanceTo(nextHero.position) <= MAX_BRIDGE_DISTANCE) {
    state.shot = createBridgeShot(state, currentHero, nextHero, now)
    return
  }

  if (nextHero) {
    const distance = currentHero.position.distanceTo(nextHero.position)
    if (distance <= FAR_BRIDGE_DISTANCE || state.random() < 0.45) {
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
    projected: new THREE.Vector3(),
    toCamera: new THREE.Vector3(),
    targetPose: { position: new THREE.Vector3(), lookAt: new THREE.Vector3(), fov: 55 },
  })

  useEffect(() => {
    stateRef.current = {
      random: mulberry32(hashString(`${seed}:${biome}:${species}:${originCreatureId ?? 'species'}:cinematic`)),
      heroes: [],
      queue: [],
      recent: new Map(),
      shot: null,
      shotSerial: 0,
      nextEvaluationAt: 0,
      outputShotId: null,
      transition: null,
      lastPose: null,
    }
    if (!poseRef.current) poseRef.current = {}
    poseRef.current.active = active && Boolean(species)
    return () => {
      if (poseRef.current) poseRef.current.active = false
    }
  }, [active, biome, originCreatureId, poseRef, seed, species])

  useFrame(({ camera, clock }) => {
    const pose = poseRef.current
    if (!pose) return
    const enabled = active && Boolean(species)
    pose.active = enabled
    if (!enabled) return
    if (!pose.position) pose.position = new THREE.Vector3()
    if (!pose.lookAt) pose.lookAt = new THREE.Vector3()

    const state = stateRef.current
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
    if (shot.type === 'bridge' && nextHero && resolveShotSubject(nextHero, shot, scratchRef.current.nextSubject)) {
      calculateBridgePose(shot, subject, scratchRef.current.nextSubject, targetPose, scratchRef.current, minCameraY, maxCameraY)
    } else {
      calculateHeroPose(shot, subject, targetPose, scratchRef.current, minCameraY, maxCameraY)
    }

    if (state.outputShotId !== shot.id) {
      state.outputShotId = shot.id
      if (state.lastPose) {
        state.transition = {
          startedAt: now,
          from: {
            position: state.lastPose.position.clone(),
            lookAt: state.lastPose.lookAt.clone(),
            fov: state.lastPose.fov,
          },
        }
      } else {
        state.transition = null
      }
    }

    const transition = state.transition
    if (transition) {
      const progress = smoothstep((now - transition.startedAt) / SHOT_TRANSITION_SECONDS)
      pose.position.lerpVectors(transition.from.position, targetPose.position, progress)
      pose.lookAt.lerpVectors(transition.from.lookAt, targetPose.lookAt, progress)
      pose.fov = THREE.MathUtils.lerp(transition.from.fov, targetPose.fov, progress)
      if (progress >= 0.999) state.transition = null
    } else {
      pose.position.copy(targetPose.position)
      pose.lookAt.copy(targetPose.lookAt)
      pose.fov = targetPose.fov
    }
    pose.shotId = shot.id
    pose.shotName = shot.template
    if (!state.lastPose) state.lastPose = { position: new THREE.Vector3(), lookAt: new THREE.Vector3(), fov: pose.fov }
    state.lastPose.position.copy(pose.position)
    state.lastPose.lookAt.copy(pose.lookAt)
    state.lastPose.fov = pose.fov

    const age = now - shot.startedAt
    if (age >= shot.duration) {
      advanceShot(state, state.heroes, now)
      return
    }

    if (age < BAD_SHOT_GRACE_SECONDS || shot.type === 'bridge') return
    if (shotCompositionIsBad(camera, shot, subject, scratchRef.current)) {
      if (shot.badSince === null) shot.badSince = now
      if (now - shot.badSince >= BAD_SHOT_HOLD_SECONDS) advanceShot(state, state.heroes, now)
    } else {
      shot.badSince = null
    }
  })

  return null
}
