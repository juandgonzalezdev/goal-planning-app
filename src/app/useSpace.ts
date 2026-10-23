import { useCallback, useMemo, useRef, useState } from 'react'
import { createDemoHousehold, DEMO_TODAY } from '../data/fixtures/demoHousehold'
import { browserStorage, createLocalStore, type FinanceStore, type LoadResult } from '../data/localStore'
import type { FinanceData } from '../domain/finance/types'
import type { CalendarDate } from '../domain/goalTime'

/**
 * The space that is open: the user's own (saved on this device) or the
 * demo (invented data, never saved). The two are never mixed: opening the
 * demo does not read or change the own space, and leaving it drops every
 * change made in it.
 */
export type OpenSpace = { kind: 'own'; data: FinanceData } | { kind: 'demo'; data: FinanceData }

export function useSpace(storage: Storage | null = browserStorage(), getToday: () => CalendarDate) {
  const store: FinanceStore = useMemo(() => createLocalStore(storage), [storage])
  const [initialLoad] = useState<LoadResult>(() => store.load())
  const [open, setOpen] = useState<OpenSpace | null>(() => (initialLoad.status === 'loaded' ? { kind: 'own', data: initialLoad.data } : null))
  /** True while saved data exists that could not be read; it is never overwritten silently. */
  const [unreadable, setUnreadable] = useState(initialLoad.status === 'unreadable')
  const [saveFailed, setSaveFailed] = useState(false)

  // The latest open space, so a change can be saved in the same step it is made.
  const openRef = useRef(open)
  const replaceOpen = useCallback((next: OpenSpace | null) => {
    openRef.current = next
    setOpen(next)
    if (next?.kind === 'own') setSaveFailed(!store.save(next.data))
  }, [store])

  /** Changes the open space's data. The own space is saved straight away; the demo never is. */
  const update = useCallback((change: (data: FinanceData) => FinanceData) => {
    const current = openRef.current
    if (current) replaceOpen({ ...current, data: change(current.data) })
  }, [replaceOpen])

  const startOwnSpace = useCallback((data: FinanceData) => {
    setUnreadable(false)
    replaceOpen({ kind: 'own', data })
  }, [replaceOpen])

  const openDemo = useCallback(() => replaceOpen({ kind: 'demo', data: createDemoHousehold() }), [replaceOpen])
  const closeDemo = useCallback(() => { if (openRef.current?.kind === 'demo') replaceOpen(null) }, [replaceOpen])

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
  const today = open?.kind === 'demo' ? DEMO_TODAY : getToday()

  return { open, today, unreadable, saveFailed, update, startOwnSpace, openDemo, closeDemo, eraseOwnSpace }
}
