import { useCallback, useEffect, useState } from 'react'

/**
 * Every screen the app can show. The first four come before a space is
 * open; the five tabs, the goal screens, the Goal Planner and Settings
 * belong to an open space. Goals open from Home: they are not a tab.
 */
export const SCREENS = ['welcome', 'sign-up', 'log-in', 'setup', 'home', 'bills', 'cards', 'history', 'data', 'goals', 'goal', 'new-goal', 'planner', 'settings'] as const
export type Screen = (typeof SCREENS)[number]

/** The five main tabs, in the approved order. */
export const TABS = ['home', 'bills', 'cards', 'history', 'data'] as const satisfies readonly Screen[]
export type Tab = (typeof TABS)[number]

/** Screens that only make sense inside an open space (own or demo). */
const SPACE_ONLY: readonly Screen[] = ['goals', 'goal', 'new-goal', 'planner', 'settings']
export const isSpaceScreen = (screen: Screen) => (TABS as readonly Screen[]).includes(screen) || SPACE_ONLY.includes(screen)
export const isTab = (screen: Screen): screen is Tab => (TABS as readonly Screen[]).includes(screen)

/** Which way the user moved, so a transition can slide the matching way. */
export type Direction = 'forward' | 'back'

export const isScreen = (value: unknown): value is Screen =>
  typeof value === 'string' && (SCREENS as readonly string[]).includes(value)

/** Reads the screen stored in a browser history entry; anything unknown means `fallback`. */
export function screenFromHistoryState(state: unknown, fallback: Screen = 'welcome'): Screen {
  const screen = (state as { screen?: unknown } | null)?.screen
  return isScreen(screen) ? screen : fallback
}

/**
 * The current screen, linked to the browser history so the browser back
 * button and the phone back gesture move between screens. Only the screen
 * name goes into the history: never anything the user typed.
 */
export function useNavigation(initial: Screen = 'welcome') {
  const [screen, setScreen] = useState<Screen>(initial)
  const [direction, setDirection] = useState<Direction>('forward')

  useEffect(() => {
    window.history.replaceState({ screen: initial }, '')
    const onPopState = (event: PopStateEvent) => {
      setDirection('back')
      setScreen(screenFromHistoryState(event.state, initial))
    }
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
    // The first screen is only read once, when the app starts.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const go = useCallback((next: Screen) => {
    window.history.pushState({ screen: next }, '')
    setDirection('forward')
    setScreen(next)
  }, [])

  /** Moves without adding a history step, e.g. after finishing setup, so Back does not return into it. */
  const replace = useCallback((next: Screen) => {
    window.history.replaceState({ screen: next }, '')
    setDirection('forward')
    setScreen(next)
  }, [])

  /** The same as the browser back button. */
  const back = useCallback(() => window.history.back(), [])

  return { screen, direction, go, replace, back }
}
