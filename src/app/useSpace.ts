import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ALEX_DEMO_TODAY, createAlexDemo } from '../data/fixtures/demoAlex'
import { createIndexedDbStore } from '../data/indexedDbStore'
import { browserStorage } from '../data/localStore'
import type { LoadResult, RecoveryCopies, SaveResult, SpaceStore, UnreadableReason } from '../data/spaceStore'
import { stampNewRecords } from '../domain/finance/records'
import type { FinanceData } from '../domain/finance/types'
import type { CalendarDate } from '../domain/goalTime'
import type { SaveOutcome } from '../ui/saveOutcome'

/** Invented example data and the fixed date it is shown on. */
export interface DemoFixture {
  data: FinanceData
  today: CalendarDate
}

const isoNow = () => new Date().toISOString()

/** The public demo: Alex's Individual space. */
export const alexDemo = (): DemoFixture => ({ data: createAlexDemo(), today: ALEX_DEMO_TODAY })

/** The browser's database, or null where it cannot even be reached. */
function browserIndexedDb(): IDBFactory | null {
  try {
    return typeof indexedDB === 'undefined' ? null : indexedDB
  } catch {
    return null
  }
}

/** The store the app uses: the browser's database, with the older copy in this localStorage. */
export const browserSpaceStore = (storage: Storage | null): SpaceStore =>
  createIndexedDbStore({ indexedDB: browserIndexedDb(), olderCopy: storage })

/**
 * The space that is open: the user's own (saved on this device, at a
 * revision) or the demo (invented data, never saved). The two are never
 * mixed: opening the demo does not read or change the own space, and
 * leaving it drops every change made in it.
 */
export type OpenSpace = { kind: 'own'; data: FinanceData; revision: number } | { kind: 'demo'; data: FinanceData }

/** Why the own space cannot be used as usual. None of these is ever treated as "no space". */
export type SpaceProblem =
  /** Something is saved but cannot be opened. Nothing was changed. */
  | { kind: 'unreadable'; source: 'space' | 'older-copy'; reason: UnreadableReason; olderCopy: boolean }
  /**
   * This browser cannot save safely. `withCopy`: an older copy is open to look at; it may be out of date.
   * `takenOver`: a newer version of the app, opened in another tab, took the database over; only reloading helps.
   */
  | { kind: 'read-only'; withCopy: boolean; takenOver?: true }
  /** Erase removed the space, but this browser kept an older copy. It is never opened again. */
  | { kind: 'partly-erased' }
  /** Another tab changed or erased the space: nothing more is saved until it is opened again. */
  | { kind: 'conflict' }
  /**
   * Another tab erased the space while changes typed here were not saved: nothing can be saved,
   * and the space stays on screen so they can be copied, until the user discards them.
   */
  | { kind: 'erased-elsewhere' }

/**
 * Something another tab did, for a short notice. `updated`: its changes are shown (nothing typed
 * here was waiting). `erased`: it erased the space, which is closed here. `older-copy-changed`:
 * an older version of the app, open in another tab, is still saving to the older copy.
 */
export type SpaceNotice = 'updated' | 'erased' | 'older-copy-changed'

export type EraseOutcome = 'erased' | 'partly-erased' | 'failed' | 'read-only' | 'busy' | 'stale'

type Store = SpaceStore & { close?: () => void }

/**
 * The open space and every change to it. The own space is saved in the
 * store (the browser's database); a change shows on screen only once the
 * store confirmed it (`saved`).
 *
 * Two rules keep answers that come late from touching the wrong space:
 * - One write at a time: while one is being saved, any other is refused
 *   (`busy`) without being sent, here and not only in the buttons.
 * - Each opening is a session. Every answer is checked against the session
 *   it started in; after leaving, erasing or switching to the demo it is
 *   ignored (`stale`). Ignoring an answer does not cancel the write: the
 *   store may still save it, and the store's revision check is what keeps
 *   it from landing on another space.
 */
export function useSpace(storage: Storage | null = browserStorage(), getToday: () => CalendarDate, createDemo: () => DemoFixture = alexDemo,
  getNow: () => string = isoNow, createStore: (storage: Storage | null) => SpaceStore = browserSpaceStore,
  hasUnsaved: () => boolean = () => false) {
  const store: Store = useMemo(() => createStore(storage), [createStore, storage])
  const [opening, setOpening] = useState(true)
  const [open, setOpen] = useState<OpenSpace | null>(null)
  const [problem, setProblem] = useState<SpaceProblem | null>(null)
  const [demoToday, setDemoToday] = useState<CalendarDate | null>(null)
  // Which session is saving (null: none). Only the open session's save is shown and holds the other controls.
  const [savingIn, setSavingIn] = useState<number | null>(null)
  const [session, setSession] = useState(0)
  // Goes up each time the own space is read again from the store: the screens start again from it.
  const [generation, setGeneration] = useState(0)
  const [notice, setNotice] = useState<SpaceNotice | null>(null)

  // The same values for the callbacks, so an answer is checked against what is open now, not when it started.
  const openRef = useRef(open)
  const problemRef = useRef(problem)
  const sessionRef = useRef(0)
  /** The write being saved, if any. */
  const writing = useRef<Promise<unknown> | null>(null)
  /** The own revision that came from outside this tab when the space was opened: edits started before it are refused. */
  const floor = useRef(0)
  /** A newer version of the app took the database over: nothing can be read or saved here any more. */
  const takenOver = useRef(false)
  /** The space is being opened (first opening, Try Again, Open Latest Version): checks for other tabs wait. */
  const openingRef = useRef(true)
  const hasUnsavedRef = useRef(hasUnsaved)
  useEffect(() => { hasUnsavedRef.current = hasUnsaved }, [hasUnsaved])

  const show = useCallback((next: OpenSpace | null) => { openRef.current = next; setOpen(next) }, [])
  const report = useCallback((next: SpaceProblem | null) => { problemRef.current = next; setProblem(next) }, [])
  /** Starts a new session: answers to anything started before it are ignored. */
  const newSession = useCallback(() => {
    sessionRef.current += 1
    setSession(sessionRef.current)
    return sessionRef.current
  }, [])

  /** Runs one write in the store. Refused (`busy`) while another is being saved. */
  const write = useCallback(async <T,>(run: () => Promise<T>, failed: T): Promise<{ result: T; current: boolean } | 'busy'> => {
    if (writing.current) return 'busy'
    const mine = sessionRef.current
    setSavingIn(mine)
    const pending = run().catch(() => failed)
    writing.current = pending
    try {
      const result = await pending
      return { result, current: sessionRef.current === mine }
    } finally {
      writing.current = null
      setSavingIn(null)
    }
  }, [])

  /** Shows what `load` found. Unreadable or read-only data is never shown as an empty device. */
  const apply = useCallback((result: LoadResult) => {
    setGeneration(value => value + 1)
    if (result.status === 'loaded') {
      floor.current = result.space.revision
      show({ kind: 'own', data: result.space.data, revision: result.space.revision })
      report(null)
    } else if (result.status === 'empty') {
      show(null)
      report(null)
    } else if (result.status === 'unreadable') {
      show(null)
      report({ kind: 'unreadable', source: result.source, reason: result.reason, olderCopy: result.olderCopy })
    } else {
      // Revision 0: it does not come from the store, so nothing can be saved on it.
      floor.current = 0
      show(result.space ? { kind: 'own', data: result.space.data, revision: 0 } : null)
      report({ kind: 'read-only', withCopy: result.space !== null, ...(takenOver.current && { takenOver: true as const }) })
    }
  }, [show, report])

  /** Reads the own space and shows it, unless another session started meanwhile. A store that throws is read-only, never empty. */
  const load = useCallback(async (mine: number, isCurrent: () => boolean = () => true) => {
    let result: LoadResult
    do {
      // A write still being saved is answered first, so what is read is never older than it.
      await writing.current
      result = await store.load().catch((): LoadResult => ({ status: 'read-only', space: null, mayBeOutdated: true }))
    } while (writing.current && sessionRef.current === mine)
    if (sessionRef.current !== mine || !isCurrent()) return
    apply(result)
    openingRef.current = false
    setOpening(false)
  }, [store, apply])

  /** Closes the own space after another tab erased it: Welcome says so. */
  const closeErased = useCallback(() => {
    newSession()
    floor.current = 0
    show(null)
    report(null)
    setNotice('erased')
  }, [newSession, show, report])

  /**
   * Another tab may have changed the space: reads it again and decides. Nothing typed here and not
   * saved is ever replaced: with unsaved changes (or a problem to decide on) it only stops saving and
   * says so. A write being saved is answered first. After reading, the session, the space on screen
   * (its id and revision), the writes and the unsaved changes are checked again before anything is shown.
   */
  const checkOnce = useCallback(async (): Promise<'again' | 'done'> => {
    while (writing.current) await writing.current
    if (openingRef.current || takenOver.current) return 'done'
    const mine = sessionRef.current
    const before = openRef.current
    const problemBefore = problemRef.current
    if (before?.kind === 'demo') return 'done'
    const result = await store.load().catch(() => null)
    if (!result || result.status === 'read-only') return 'done'
    if (sessionRef.current !== mine || openRef.current !== before || problemRef.current !== problemBefore || writing.current || openingRef.current) return 'again'
    const editing = hasUnsavedRef.current()

    if (before?.kind === 'own') {
      const sameSpace = result.status === 'loaded' && result.space.data.space.id === before.data.space.id
      if (sameSpace && result.space.revision <= before.revision) return 'done'
      if (problemBefore?.kind === 'read-only' || problemBefore?.kind === 'erased-elsewhere') return 'done'
      if (result.status === 'empty') {
        if (editing) { report({ kind: 'erased-elsewhere' }); setNotice(null) } else closeErased()
        return 'done'
      }
      // Newer changes, another space, or a space that no longer opens.
      if (editing || problemBefore) {
        if (!problemBefore) report({ kind: 'conflict' })
        setNotice(null)
        return 'done'
      }
      apply(result)
      setNotice(result.status === 'loaded' ? 'updated' : null)
      return 'done'
    }

    // Nothing open here (Welcome, setup, the recovery screen).
    if (editing || problemBefore?.kind === 'partly-erased' || problemBefore?.kind === 'read-only') return 'done'
    const shown = problemBefore?.kind === 'unreadable' ? 'unreadable' : 'empty'
    if (result.status === shown && result.status === 'empty') return 'done'
    if (result.status === 'unreadable' && problemBefore?.kind === 'unreadable' && problemBefore.reason === result.reason && problemBefore.source === result.source) return 'done'
    apply(result)
    setNotice(result.status === 'loaded' ? 'updated' : null)
    return 'done'
  }, [store, apply, report, closeErased])

  // One check at a time; a notice that comes during one runs another after it.
  const checking = useRef(false)
  const checkAgain = useRef(false)
  const check = useCallback(async () => {
    if (checking.current) { checkAgain.current = true; return }
    checking.current = true
    try {
      do {
        checkAgain.current = false
        if (await checkOnce() === 'again') checkAgain.current = true
      } while (checkAgain.current)
    } finally {
      checking.current = false
    }
  }, [checkOnce])

  // What other tabs do. Only notices: the revision check keeps the data safe without them.
  useEffect(() => store.watch(change => {
    if (change.kind === 'closed') {
      // A newer version of the app in another tab took the database over: what is shown stays, nothing more is saved.
      takenOver.current = true
      report({ kind: 'read-only', withCopy: openRef.current?.kind === 'own', takenOver: true })
    } else if (change.kind === 'older-copy-changed') {
      setNotice('older-copy-changed')
    } else {
      void check()
    }
  }), [store, report, check])

  // Back to this tab (or the page shown again from the browser's cache): a notice may have been missed, as on an iPhone in the background.
  useEffect(() => {
    if (typeof document === 'undefined') return
    const onVisible = () => { if (document.visibilityState === 'visible') void check() }
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('pageshow', onVisible)
    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('pageshow', onVisible)
    }
  }, [check])

  // The first opening.
  useEffect(() => {
    let current = true
    void load(sessionRef.current, () => current)
    return () => { current = false }
  }, [load])

  /** Opens the own space again from the store, after any write being saved has finished. */
  const reload = useCallback(async () => {
    const mine = newSession()
    openingRef.current = true
    setNotice(null)
    setOpening(true)
    await writing.current
    await load(mine)
  }, [load, newSession])

  /** Saves a change to the own space, on the revision it was made on. The demo keeps it without saving. */
  const commit = useCallback(async (next: (data: FinanceData) => FinanceData, base: number | undefined): Promise<SaveOutcome> => {
    const current = openRef.current
    if (!current) return 'not-saved'
    if (current.kind === 'demo') {
      show({ ...current, data: next(current.data) })
      return 'demo'
    }
    if (problemRef.current?.kind === 'read-only') return 'read-only'
    if (problemRef.current) return 'conflict'
    if (writing.current) return 'busy'
    if (base !== undefined && base < floor.current) return 'outdated'
    const data = next(current.data)
    const done = await write<SaveResult>(() => store.save(data, current.revision), { status: 'failed' })
    if (done === 'busy') return 'busy'
    if (!done.current) return 'stale'
    if (done.result.status === 'saved') {
      show({ kind: 'own', data, revision: done.result.revision })
      return 'saved'
    }
    if (done.result.status === 'conflict') {
      report({ kind: 'conflict' })
      return 'conflict'
    }
    return 'not-saved'
  }, [show, report, store, write])

  /**
   * Changes the open space's data. `base` is the revision the edit started
   * on (a form's `useEditBase`); without it, the revision on screen.
   * Records the change creates get the time they were entered (for the
   * order of same-day records in History).
   */
  const update = useCallback((change: (data: FinanceData) => FinanceData, base?: number): Promise<SaveOutcome> =>
    commit(data => stampNewRecords(data, change(data), getNow()), base), [commit, getNow])

  /**
   * Replaces the whole space with a restored backup, as it is: no record gets a time it did not have.
   * The open space keeps its own id, whatever id the backup has, so it is still the same space for the store.
   */
  const replaceData = useCallback((data: FinanceData, base?: number): Promise<SaveOutcome> =>
    commit(current => ({ ...data, space: { ...data.space, id: current.space.id } }), base), [commit])

  /** Starts the own space. Refused if this device already has one (another tab may have made it). */
  const startOwnSpace = useCallback(async (data: FinanceData): Promise<SaveOutcome> => {
    if (problemRef.current?.kind === 'read-only') return 'read-only'
    if (problemRef.current?.kind === 'unreadable' || problemRef.current?.kind === 'conflict' || problemRef.current?.kind === 'erased-elsewhere') return 'conflict'
    const done = await write<SaveResult>(() => store.create(data), { status: 'failed' })
    if (done === 'busy') return 'busy'
    if (!done.current) return 'stale'
    if (done.result.status === 'saved') {
      floor.current = done.result.revision
      report(null)
      show({ kind: 'own', data, revision: done.result.revision })
      return 'saved'
    }
    if (done.result.status === 'conflict') {
      report({ kind: 'conflict' })
      return 'conflict'
    }
    return 'not-saved'
  }, [show, report, store, write])

  const openDemo = useCallback(() => {
    newSession()
    const fixture = createDemo()
    setDemoToday(fixture.today)
    show({ kind: 'demo', data: fixture.data })
  }, [show, createDemo, newSession])
  /** Leaves the demo (dropping its changes) and opens whatever the device has now. */
  const closeDemo = useCallback(() => {
    if (openRef.current?.kind !== 'demo') return
    show(null)
    void reload()
  }, [show, reload])
  /** Puts the original example back. Only the demo changes: the own space is never read or touched. */
  const resetDemo = useCallback(() => { if (openRef.current?.kind === 'demo') openDemo() }, [openDemo])

  /** After another tab erased the space, the user chose to discard what was typed here: Welcome. */
  const discardErased = useCallback(() => {
    if (problemRef.current?.kind === 'erased-elsewhere') closeErased()
  }, [closeErased])

  /**
   * "Use Older Copy" on the recovery screen, after the user confirmed: the copy that cannot be opened
   * is set aside (never deleted) and the older copy opens. Refused when anything changed since.
   */
  const restoreOlderCopy = useCallback(async (): Promise<SaveOutcome> => {
    if (problemRef.current?.kind !== 'unreadable' || !problemRef.current.olderCopy) return 'not-saved'
    const done = await write<SaveResult>(() => store.useOlderCopy(), { status: 'failed' })
    if (done === 'busy') return 'busy'
    if (!done.current) return 'stale'
    if (done.result.status === 'failed') return 'not-saved'
    // Saved, or something changed meanwhile: either way, what the device has now is opened.
    await reload()
    return done.result.status === 'saved' ? 'saved' : 'conflict'
  }, [store, write, reload])

  /** Every copy as stored, for "Download Both Copies". Only reads. */
  const exportCopies = useCallback((): Promise<RecoveryCopies> => store.exportCopies(), [store])

  /** Erases the own space from this device. Says how far it got: an erase is never reported as done while a copy is left. */
  const eraseOwnSpace = useCallback(async (): Promise<EraseOutcome> => {
    if (problemRef.current?.kind === 'read-only') return 'read-only'
    const done = await write(() => store.erase(), { status: 'failed' as const })
    if (done === 'busy') return 'busy'
    if (!done.current) return 'stale'
    if (done.result.status === 'failed') return 'failed'
    newSession()
    floor.current = 0
    setNotice(null)
    if (openRef.current?.kind === 'own') show(null)
    report(done.result.status === 'erased' ? null : { kind: 'partly-erased' })
    return done.result.status
  }, [show, report, store, write, newSession])

  // The demo always shows its own fixed date, so its October data makes sense on any day.
  const today = open?.kind === 'demo' && demoToday ? demoToday : getToday()
  const saving = savingIn !== null && savingIn === session
  const canWrite = open?.kind === 'demo' || (open?.kind === 'own' && problem === null)
  const revision = open?.kind === 'own' ? open.revision : 0

  return {
    opening, open, problem, notice, generation, saving, canWrite, revision, today, update, replaceData, startOwnSpace, openDemo, closeDemo, resetDemo,
    eraseOwnSpace, reload, discardErased, restoreOlderCopy, exportCopies, dismissNotice: useCallback(() => setNotice(null), []),
  }
}
