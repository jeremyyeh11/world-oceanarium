import * as THREE from 'three'

// Persistent per-creature swim state that survives a <Fish> unmount/remount.
//
// Why this exists: switching tanks swaps which creatures the active <Biome> renders, so every
// fish in the tank you leave is unmounted (its component-local refs — position, heading,
// velocity, sim clock, the seed gate — are discarded). Without this store, returning to a tank
// re-seeds everyone from spawn, which reads as the whole tank "resetting". Here we keep each
// creature's kinematic snapshot alive at module scope, keyed by creature id, so a returning fish
// resumes exactly where it froze.
//
// Scalability: only the *active* tank is ever mounted, so this holds at most the union of
// creatures the visitor has actually looked at this session (a bounded, small set), and it is
// pruned to the live creature set on data refresh. It is plain JS memory — a page reload clears
// it, which is the intended "reload the session" boundary.
//
// This deliberately stores only the fields needed for a seamless visual resume (position,
// orientation, speed, sim phase, burst/drift schedule, school-steering smoothing). Transient
// bookkeeping (boid debug vectors, animation action timers, sardine LOD state) is allowed to
// re-initialize on remount because it converges within a frame or two and is not visible.

const FISH_RUNTIME = new Map()

function createRuntimeEntry() {
  return {
    // Position is applied back onto the freshly-mounted THREE.Group (which starts at the origin),
    // so it is snapshotted every frame and restored once on remount. hasPosition guards the restore.
    hasPosition: false,
    position: new THREE.Vector3(),
    // Orientation / heading continuity. These object refs are shared by reference with the
    // component, so the sim writes through to the store every frame with no copy-back needed.
    desiredDirection: new THREE.Vector3(),
    previousPosition: new THREE.Vector3(),
    previousTangent: new THREE.Vector3(),
    visualForward: new THREE.Vector3(),
    baseLookQuaternion: new THREE.Quaternion(),
    smoothedBoidSteering: new THREE.Vector3(),
    committedBoidSteering: new THREE.Vector3(),
    // Scalar continuity state — hydrated on mount, mirrored back at the end of each frame.
    hasFollowPosition: false,
    hasVisualForward: false,
    hasBaseLookQuaternion: false,
    visualPitch: 0,
    velocity: null,
    simulationTime: null,
    boidDecisionNextAt: 0,
    nextBurstAt: 0,
    nextDriftAt: 0,
    driftUntil: 0,
  }
}

export function getFishRuntime(creatureId) {
  const key = String(creatureId)
  let entry = FISH_RUNTIME.get(key)
  if (!entry) {
    entry = createRuntimeEntry()
    FISH_RUNTIME.set(key, entry)
  }
  return entry
}

// Drop snapshots for creatures no longer present in the live data set (e.g. a creature that died
// between refreshes) so the store does not accumulate stale entries over a long-lived session.
export function pruneFishRuntime(validCreatureIds) {
  const valid = validCreatureIds instanceof Set
    ? validCreatureIds
    : new Set(Array.from(validCreatureIds, id => String(id)))
  for (const key of FISH_RUNTIME.keys()) {
    if (!valid.has(key)) FISH_RUNTIME.delete(key)
  }
}
