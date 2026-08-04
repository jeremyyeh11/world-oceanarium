// Shared live fish registry. Fish.jsx owns writes; camera/director systems read it.
// Entries reuse mutable Three.js vectors so consumers can sample without scene traversal.
export const FISH_REGISTRY = new Map()
