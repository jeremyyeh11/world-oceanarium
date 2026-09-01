import { useEffect, useState } from 'react'

/**
 * Subscribe to a CSS media query from JS.
 *
 * Needed where a breakpoint changes *behaviour* rather than only appearance —
 * CSS alone cannot tell React whether a control should be collapsible, and
 * hiding a toggle with CSS while leaving its collapsed state in JS leaves the
 * two disagreeing about what is on screen.
 */
export function useMediaQuery(query) {
  const [matches, setMatches] = useState(() => window.matchMedia?.(query)?.matches ?? false)

  useEffect(() => {
    const list = window.matchMedia?.(query)
    if (!list) return undefined

    const sync = () => setMatches(list.matches)
    sync()
    list.addEventListener('change', sync)
    return () => list.removeEventListener('change', sync)
  }, [query])

  return matches
}
