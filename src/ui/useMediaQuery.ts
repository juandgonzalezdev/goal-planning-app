import { useSyncExternalStore } from 'react'

/**
 * Whether a CSS media query matches now, following changes (a window made
 * wider, a phone turned). Without matchMedia (tests, old browsers) it is false.
 */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    notify => {
      const list = window.matchMedia?.(query)
      if (!list?.addEventListener) return () => {}
      list.addEventListener('change', notify)
      return () => list.removeEventListener('change', notify)
    },
    () => window.matchMedia?.(query)?.matches ?? false,
    () => false,
  )
}

/** Wide screens: the tabs, the logo and Settings go in a sidebar (see app.css). */
export const SIDEBAR_QUERY = '(min-width: 1024px)'
