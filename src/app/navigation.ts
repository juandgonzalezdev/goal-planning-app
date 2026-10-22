import { useCallback, useEffect, useState } from 'react'

/** Every screen the app can show. My Space ('home') is the home screen. */
export const SCREENS = ['welcome', 'choose-space', 'home', 'goals', 'money'] as const
export type Screen = (typeof SCREENS)[number]

/** Which way the user moved, so a transition can slide the matching way. */
export type Direction = 'forward' | 'back'

export const isScreen = (value: unknown): value is Screen =>
  typeof value === 'string' && (SCREENS as readonly string[]).includes(value)

/** Reads the screen stored in a browser history entry; anything unknown means Welcome. */
export function screenFromHistoryState(state: unknown): Screen {
  const screen = (state as { screen?: unknown } | null)?.screen
  return isScreen(screen) ? screen : 'welcome'
}

/**
 * The current screen, linked to the browser history so the browser back
 * button and the phone back gesture move between screens. Only the screen
 * name goes into the history: never anything the user typed.
 */
export function useNavigation() {
  const [screen, setScreen] = useState<Screen>('welcome')
  const [direction, setDirection] = useState<Direction>('forward')

  useEffect(() => {
    // Every page load starts at Welcome, because nothing is kept after a refresh.
    window.history.replaceState({ screen: 'welcome' }, '')
    const onPopState = (event: PopStateEvent) => {
      setDirection('back')
      setScreen(screenFromHistoryState(event.state))
    }
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])

  const go = useCallback((next: Screen) => {
    window.history.pushState({ screen: next }, '')
    setDirection('forward')
    setScreen(next)
  }, [])

  /** The same as the browser back button. */
  const back = useCallback(() => window.history.back(), [])

  return { screen, direction, go, back }
}
