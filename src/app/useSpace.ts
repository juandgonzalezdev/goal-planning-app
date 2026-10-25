import { useCallback, useMemo, useRef, useState } from 'react'
import { ALEX_DEMO_TODAY, createAlexDemo } from '../data/fixtures/demoAlex'
import { browserStorage, createLocalStore, type FinanceStore, type LoadResult } from '../data/localStore'
import type { FinanceData } from '../domain/finance/types'
import type { CalendarDate } from '../domain/goalTime'
import type { SaveOutcome } from '../ui/saveOutcome'

/** Invented example data and the fixed date it is shown on. */
export interface DemoFixture {
  data: FinanceData
  today: CalendarDate
}

/** The public demo: Alex's Individual space. */
export const alexDemo = (): DemoFixture => ({ data: createAlexDemo(), today: ALEX_DEMO_TODAY })

/**
 * The space that is open: the user's own (saved on this device) or the
 * demo (invented data, never saved). The two are never mixed: opening the
 * demo does not read or change the own space, and leaving it drops every
 * change made in it.
 */
export type OpenSpace = { kind: 'own'; data: FinanceData } | { kind: 'demo'; data: FinanceData }

export function useSpace(storage: Storage | null = browserStorage(), getToday: () => CalendarDate, createDemo: () => DemoFixture = alexDemo) {
  const store: FinanceStore = useMemo(() => createLocalStore(storage), [storage])
  const [initialLoad] = useState<LoadResult>(() => store.load())
  const [open, setOpen] = useState<OpenSpace | null>(() => (initialLoad.status === 'loaded' ? { kind: 'own', data: initialLoad.data } : null))
  /** True while saved data exists that could not be read; it is never overwritten silently. */
  const [unreadable, setUnreadable] = useState(initialLoad.status === 'unreadable')
  const [saveFailed, setSaveFailed] = useState(false)
  const [demoToday, setDemoToday] = useState<CalendarDate | null>(null)

  // The latest open space, so a change can be saved in the same step it is made.
  const openRef = useRef(open)
  const replaceOpen = useCallback((next: OpenSpace | null): SaveOutcome => {
    openRef.current = next
    setOpen(next)
    if (next?.kind !== 'own') return 'demo'
    const saved = store.save(next.data)
    setSaveFailed(!saved)
    return saved ? 'saved' : 'not-saved'
  }, [store])

  /**
   * Changes the open space's data. The own space is saved straight away;
   * the demo never is. Says which, so the screen can tell the user.
   */
  const update = useCallback((change: (data: FinanceData) => FinanceData): SaveOutcome => {
    const current = openRef.current
    if (!current) return 'not-saved'
    return replaceOpen({ ...current, data: change(current.data) })
  }, [replaceOpen])

  const startOwnSpace = useCallback((data: FinanceData) => {
    setUnreadable(false)
    replaceOpen({ kind: 'own', data })
  }, [replaceOpen])

  const openDemo = useCallback(() => {
    const fixture = createDemo()
    setDemoToday(fixture.today)
    replaceOpen({ kind: 'demo', data: fixture.data })
  }, [replaceOpen, createDemo])
  const closeDemo = useCallback(() => { if (openRef.current?.kind === 'demo') replaceOpen(null) }, [replaceOpen])
  /** Puts the original example back. Only the demo changes: the own space is never read or touched. */
  const resetDemo = useCallback(() => { if (openRef.current?.kind === 'demo') openDemo() }, [openDemo])

  /** Erases the own space from this device. Returns false if the browser refused. */
  const eraseOwnSpace = useCallback(() => {
    const erased = store.clear()
    if (erased) {
      if (openRef.current?.kind === 'own') replaceOpen(null)
      setUnreadable(false)
      setSaveFailed(false)
    }
    return erased
  }, [store, replaceOpen])

  // The demo always shows its own fixed date, so its October data makes sense on any day.
  const today = open?.kind === 'demo' && demoToday ? demoToday : getToday()

  return { open, today, unreadable, saveFailed, update, startOwnSpace, openDemo, closeDemo, resetDemo, eraseOwnSpace }
}
