import type { FinanceData } from '../domain/finance/types'
import { openDatabase, transact, when } from './idb'
import {
  ERASED_KEY, isErasedMarked, makeEnvelope, OLDER_COPY_KEY, readData, readEnvelope, readOlderCopy, sameRecords,
  type Reading,
} from './savedCopies'
import type { EraseResult, LoadResult, SaveResult, SpaceStore, StoreChange, StoredSpace, UnreadableReason } from './spaceStore'

/**
 * The own space in the browser's database (IndexedDB).
 *
 * Three stores:
 * - `spaces`: one envelope per space id ({ format, revision, savedAt, data }).
 * - `meta`: `current-space` (the id this device opens), `legacy`
 *   (`migrated` or `erased`: the older copy was dealt with and is never
 *   brought in again) and `last-revision` (the last revision of an erased
 *   space: a space started after it goes on from there, so a tab still
 *   open on the erased one can never save over the new one, even under
 *   the same id).
 * - `quarantine`: spaces that could not be read and were set aside by
 *   "Use Older Copy". Each one gets its own new key, so none is ever
 *   written over.
 *
 * The older copy in localStorage is only read, never changed, except by
 * Erase.
 */
export const DATABASE_NAME = 'goal-planning-app'
const DATABASE_VERSION = 1
const SPACES = 'spaces'
const META = 'meta'
const QUARANTINE = 'quarantine'
const CURRENT = 'current-space'
const LEGACY = 'legacy'
const LAST_REVISION = 'last-revision'
const CHANNEL = 'goal-planning-app.space'

type LegacyState = 'migrated' | 'erased'

export interface IndexedDbStoreOptions {
  /** The browser's `indexedDB`, or null where it does not exist. */
  indexedDB: IDBFactory | null
  /** The browser's localStorage: where the older copy is. */
  olderCopy: Storage | null
  now?: () => string
  databaseName?: string
  /** Where other tabs' notices come from. Tests pass their own. */
  window?: Pick<Window, 'addEventListener' | 'removeEventListener'> | null
  /** Tests only: waits before a migration step, to play two tabs one step at a time. */
  pause?: (step: 'before-copy' | 'before-activate') => Promise<void>
}

/** What `load` saw last, so "Use Older Copy" can check that nothing changed since. */
interface Seen {
  current: string | undefined
  target: string
  fingerprint: string
}

const fingerprint = (value: unknown) => JSON.stringify(value) ?? 'undefined'

/** The revision a stored value was saved as, or 0 when it has none that can be trusted. */
const revisionOf = (value: unknown): number => {
  const revision = (value as { revision?: unknown } | undefined)?.revision
  return typeof revision === 'number' && Number.isInteger(revision) && revision > 0 ? revision : 0
}

export interface IndexedDbStore extends SpaceStore {
  /** Closes the database and the channel to other tabs. */
  close(): void
}

export function createIndexedDbStore(options: IndexedDbStoreOptions): IndexedDbStore {
  const { indexedDB: factory, olderCopy: storage, now = () => new Date().toISOString(), databaseName = DATABASE_NAME, pause } = options
  const win = options.window === undefined ? (typeof window === 'undefined' ? null : window) : options.window
  let opening: Promise<IDBDatabase | null> | null = null
  let channel: BroadcastChannel | null = null
  let seen: Seen | null = null
  /** A newer version of the app took the database over: it is never opened again by this one. */
  let taken = false
  const watchers = new Set<(change: StoreChange) => void>()
  // Tells this store's own notices apart from other tabs' (a tab hears its own messages on a second channel).
  const self = Math.random().toString(36).slice(2)

  /** The database, or null when this browser cannot use it (then nothing can be saved). */
  const database = () => {
    if (taken) return Promise.resolve(null)
    opening ??= factory
      ? openDatabase(factory, databaseName, DATABASE_VERSION, db => {
        db.createObjectStore(SPACES)
        db.createObjectStore(META)
        db.createObjectStore(QUARANTINE, { autoIncrement: true })
      }, () => {
        taken = true
        opening = null
        for (const onChange of [...watchers]) onChange({ kind: 'closed' })
      }).catch(() => null)
      : Promise.resolve(null)
    return opening
  }

  const notify = (change: StoreChange) => {
    try {
      if (typeof BroadcastChannel === 'undefined') return
      channel ??= new BroadcastChannel(CHANNEL)
      channel.postMessage({ from: self, change })
    } catch {
      // Only a notice: the revision check keeps the data safe without it.
    }
  }

  /** The device cannot save safely: show the older copy, if any, as possibly out of date. Never after Erase. */
  const readOnly = (): LoadResult => {
    if (isErasedMarked(storage)) return { status: 'read-only', space: null, mayBeOutdated: true }
    const older = readOlderCopy(storage)
    return { status: 'read-only', space: older.state === 'readable' ? { data: older.data, revision: 0 } : null, mayBeOutdated: true }
  }

  /** The older copy can be offered with "Use Older Copy". */
  const olderCopyUsable = (legacy: LegacyState | undefined) =>
    legacy !== 'erased' && !isErasedMarked(storage) && readOlderCopy(storage).state === 'readable'

  const unreadable = (source: 'space' | 'older-copy', reading: { reason: UnreadableReason; errors: string[] }, olderCopy: boolean): LoadResult =>
    ({ status: 'unreadable', source, reason: reading.reason, errors: reading.errors, olderCopy })

  /** Reads `current-space`, `legacy` and the current envelope in one go. */
  const readState = (db: IDBDatabase) => transact<{ current: string | undefined; legacy: LegacyState | undefined; raw: unknown }>(
    db, [SPACES, META], 'readonly', (tx, end) => {
      const meta = tx.objectStore(META)
      when(meta.get(CURRENT), current => when(meta.get(LEGACY), legacy => {
        if (typeof current !== 'string') { end.done({ current: undefined, legacy, raw: undefined }); return }
        when(tx.objectStore(SPACES).get(current), raw => end.done({ current, legacy, raw }))
      }))
    })

  /**
   * Copies the older copy into the database, checks the copy, and only then
   * makes it the current space. Every write checks again, inside its own
   * transaction, that nothing changed meanwhile (another tab migrating,
   * saving or erasing); if something did, it writes nothing and the load
   * starts over.
   */
  async function migrate(db: IDBDatabase, older: FinanceData): Promise<LoadResult | 'again'> {
    const id = older.space.id
    await pause?.('before-copy')
    // 1. Write the copy, only if nobody activated, migrated or erased meanwhile, and never over an existing envelope.
    const copied = await transact<'again' | 'written' | 'exists'>(db, [SPACES, META], 'readwrite', (tx, end) => {
      const meta = tx.objectStore(META)
      when(meta.get(CURRENT), current => when(meta.get(LEGACY), legacy => {
        if (current !== undefined || legacy !== undefined) { end.undo('again'); return }
        const spaces = tx.objectStore(SPACES)
        when(spaces.get(id), existing => {
          if (existing !== undefined) { end.done('exists'); return }
          when(spaces.add(makeEnvelope(older, 1, now()), id), () => end.done('written'))
        })
      }))
    })
    if (copied === 'again') return 'again'

    // 2. Check the copy. Revision 1 must hold exactly the older copy's records; a later revision means another tab migrated and went on working.
    const check = await transact<{ raw: unknown; reading: Reading<StoredSpace> }>(db, [SPACES], 'readonly', (tx, end) => {
      when(tx.objectStore(SPACES).get(id), raw => end.done({ raw, reading: readEnvelope(raw) }))
    })
    if (!check.reading.ok) {
      seen = { current: undefined, target: id, fingerprint: fingerprint(check.raw) }
      return unreadable('space', check.reading, true)
    }
    if (check.reading.value.revision === 1 && !sameRecords(check.reading.value.data, older)) {
      seen = { current: undefined, target: id, fingerprint: fingerprint(check.raw) }
      return unreadable('space', { reason: 'copies-differ', errors: ['The copy in the new storage does not match the older copy.'] }, true)
    }
    const checked = fingerprint(check.raw)

    await pause?.('before-activate')
    // 3. Activate, only if the copy is still exactly the one checked and nobody erased meanwhile.
    const activated = await transact<'again' | 'erased' | StoredSpace>(db, [SPACES, META], 'readwrite', (tx, end) => {
      const meta = tx.objectStore(META)
      when(meta.get(CURRENT), current => when(meta.get(LEGACY), legacy => {
        if (legacy === 'erased') { end.undo('erased'); return }
        if (current !== undefined && current !== id) { end.undo('again'); return }
        when(tx.objectStore(SPACES).get(id), raw => {
          const reading = readEnvelope(raw)
          if (!reading.ok) { end.undo('again'); return }
          // Another tab activated it already: use what is there now.
          if (current === id) { end.done(reading.value); return }
          if (fingerprint(raw) !== checked) { end.undo('again'); return }
          meta.put(id, CURRENT)
          when(meta.put('migrated', LEGACY), () => end.done(reading.value))
        })
      }))
    })
    if (activated === 'again') return 'again'
    if (activated === 'erased') return { status: 'empty' }
    return { status: 'loaded', space: activated }
  }

  async function load(): Promise<LoadResult> {
    seen = null
    const db = await database()
    if (!db) return readOnly()
    try {
      for (let attempt = 0; attempt < 5; attempt++) {
        const state = await readState(db)
        if (state.current !== undefined) {
          const reading = readEnvelope(state.raw)
          if (reading.ok) return { status: 'loaded', space: reading.value }
          seen = { current: state.current, target: state.current, fingerprint: fingerprint(state.raw) }
          return unreadable('space', reading, olderCopyUsable(state.legacy))
        }
        // The older copy was already brought in, or erased: it is never brought in again.
        if (state.legacy !== undefined || isErasedMarked(storage)) return { status: 'empty' }
        const older = readOlderCopy(storage)
        if (older.state === 'none') return { status: 'empty' }
        if (older.state === 'unreadable') return unreadable('older-copy', older, false)
        const migrated = await migrate(db, older.data)
        if (migrated !== 'again') return migrated
      }
      return { status: 'unreadable', source: 'space', reason: 'broken', errors: ['The saved space kept changing while it was being opened. Try again.'], olderCopy: false }
    } catch {
      // The database failed part-way: nothing half-written stays (each step is one transaction). Show the older copy, read-only.
      return readOnly()
    }
  }

  /** A space whose records would not read back is never written. */
  const writable = (data: FinanceData) => readData(data).ok

  async function save(data: FinanceData, baseRevision: number): Promise<SaveResult> {
    const db = await database()
    if (!db || !writable(data)) return { status: 'failed' }
    const id = data.space.id
    let result: SaveResult
    try {
      result = await transact<SaveResult>(db, [SPACES, META], 'readwrite', (tx, end) => {
        const spaces = tx.objectStore(SPACES)
        when(tx.objectStore(META).get(CURRENT), current => {
          // Erased, or another space was started: never brought back by an old save.
          if (current === undefined) { end.undo({ status: 'conflict', latest: null }); return }
          when(spaces.get(current), raw => {
            const reading = readEnvelope(raw)
            const latest = reading.ok ? reading.value : null
            if (current !== id || !latest || latest.revision !== baseRevision) { end.undo({ status: 'conflict', latest }); return }
            const revision = baseRevision + 1
            when(spaces.put(makeEnvelope(data, revision, now()), id), () => end.done({ status: 'saved', revision }))
          })
        })
      })
    } catch {
      return { status: 'failed' }
    }
    if (result.status === 'saved') notify({ kind: 'saved', spaceId: id, revision: result.revision })
    return result
  }

  async function create(data: FinanceData): Promise<SaveResult> {
    const db = await database()
    if (!db || !writable(data)) return { status: 'failed' }
    const id = data.space.id
    let result: SaveResult
    try {
      result = await transact<SaveResult>(db, [SPACES, META], 'readwrite', (tx, end) => {
        const spaces = tx.objectStore(SPACES)
        const meta = tx.objectStore(META)
        when(meta.get(CURRENT), current => {
          if (current !== undefined) {
            when(spaces.get(current), raw => {
              const reading = readEnvelope(raw)
              end.undo({ status: 'conflict', latest: reading.ok ? reading.value : null })
            })
            return
          }
          when(spaces.get(id), existing => {
            if (existing !== undefined) { end.undo({ status: 'conflict', latest: null }); return }
            when(meta.get(LAST_REVISION), last => {
              const revision = revisionOf({ revision: last }) + 1
              spaces.add(makeEnvelope(data, revision, now()), id)
              when(meta.put(id, CURRENT), () => end.done({ status: 'saved', revision }))
            })
          })
        })
      })
    } catch {
      return { status: 'failed' }
    }
    if (result.status === 'saved') notify({ kind: 'saved', spaceId: id, revision: result.revision })
    return result
  }

  async function erase(): Promise<EraseResult> {
    const db = await database()
    if (!db) return { status: 'failed' }
    try {
      // One transaction: the space, what is in quarantine and the pointer go together, and the older copy is marked as erased.
      // The last revision is kept, so a space started later never reuses a revision a tab may still hold.
      await transact<true>(db, [SPACES, META, QUARANTINE], 'readwrite', (tx, end) => {
        const spaces = tx.objectStore(SPACES)
        const meta = tx.objectStore(META)
        when(meta.get(CURRENT), current => when(meta.get(LAST_REVISION), last => {
          const readCurrent = (then: (raw: unknown) => void) => {
            if (typeof current !== 'string') { then(undefined); return }
            when(spaces.get(current), then)
          }
          readCurrent(raw => {
            const revision = Math.max(revisionOf(raw), revisionOf({ revision: last }))
            spaces.clear()
            tx.objectStore(QUARANTINE).clear()
            meta.delete(CURRENT)
            if (revision > 0) meta.put(revision, LAST_REVISION)
            when(meta.put('erased', LEGACY), () => end.done(true))
          })
        }))
      })
    } catch {
      return { status: 'failed' }
    }
    notify({ kind: 'erased' })
    // The older copy: marked first (so it is never opened again, even without the database), then removed.
    try { storage?.setItem(ERASED_KEY, 'yes') } catch { /* the database mark still holds */ }
    let removed: boolean
    try {
      storage?.removeItem(OLDER_COPY_KEY)
      removed = !storage || storage.getItem(OLDER_COPY_KEY) === null
    } catch {
      removed = false
    }
    return removed ? { status: 'erased' } : { status: 'partly-erased', remaining: 'older-copy' }
  }

  async function useOlderCopy(): Promise<SaveResult> {
    const db = await database()
    const expected = seen
    const older = readOlderCopy(storage)
    if (!db || !expected || older.state !== 'readable' || isErasedMarked(storage)) return { status: 'failed' }
    const id = older.data.space.id
    let result: SaveResult
    try {
      result = await transact<SaveResult>(db, [SPACES, META, QUARANTINE], 'readwrite', (tx, end) => {
        const spaces = tx.objectStore(SPACES)
        const meta = tx.objectStore(META)
        when(meta.get(CURRENT), current => when(meta.get(LEGACY), legacy => {
          when(spaces.get(expected.target), raw => {
            const reading = readEnvelope(raw)
            // Check again: nothing may have changed since the user saw the problem (another tab saving, fixing or erasing).
            if (legacy === 'erased' || current !== expected.current || fingerprint(raw) !== expected.fingerprint) {
              end.undo({ status: 'conflict', latest: reading.ok ? reading.value : null })
              return
            }
            // The older copy may belong under another id than the space that cannot be read.
            // Whatever is stored there was never shown to the user, so it is read in this
            // same transaction and set aside too, unless it holds exactly the older copy's records.
            const readDestination = (then: (destination: unknown) => void) => {
              if (expected.target === id) { then(undefined); return }
              when(spaces.get(id), then)
            }
            readDestination(destination => {
              const destinationReading = destination === undefined ? null : readEnvelope(destination)
              const keepsNothingNew = destinationReading?.ok === true && sameRecords(destinationReading.value.data, older.data)
              // The older copy goes on from the highest set-aside revision, so no open tab can save over it with an old one.
              const revision = Math.max(revisionOf(raw), revisionOf(destination)) + 1
              const toSetAside = [
                ...(raw === undefined ? [] : [{ spaceId: expected.target, value: raw }]),
                ...(destination === undefined || keepsNothingNew ? [] : [{ spaceId: id, value: destination }]),
              ]
              const replace = () => {
                if (expected.target !== id) spaces.delete(expected.target)
                spaces.put(makeEnvelope(older.data, revision, now()), id)
                meta.put(id, CURRENT)
                when(meta.put('migrated', LEGACY), () => end.done({ status: 'saved', revision }))
              }
              // A new key for every quarantined copy: earlier ones are never written over.
              const setAside = (index: number) => {
                if (index === toSetAside.length) { replace(); return }
                when(tx.objectStore(QUARANTINE).add({ movedAt: now(), ...toSetAside[index] }), () => setAside(index + 1))
              }
              setAside(0)
            })
          })
        }))
      })
    } catch {
      return { status: 'failed' }
    }
    if (result.status === 'saved') {
      seen = null
      notify({ kind: 'saved', spaceId: id, revision: result.revision })
    }
    return result
  }

  function watch(onChange: (change: StoreChange) => void) {
    let listener: BroadcastChannel | null = null
    try {
      if (typeof BroadcastChannel !== 'undefined') {
        listener = new BroadcastChannel(CHANNEL)
        listener.onmessage = event => {
          const message = event.data as { from?: unknown; change?: StoreChange } | null
          if (message?.change && message.from !== self) onChange(message.change)
        }
      }
    } catch {
      listener = null
    }
    // An older version of the app, still open in another tab, keeps saving to the older copy.
    const onStorage = (event: StorageEvent) => { if (event.key === OLDER_COPY_KEY) onChange({ kind: 'older-copy-changed' }) }
    win?.addEventListener('storage', onStorage)
    watchers.add(onChange)
    return () => {
      listener?.close()
      win?.removeEventListener('storage', onStorage)
      watchers.delete(onChange)
    }
  }

  function close() {
    channel?.close()
    channel = null
    void opening?.then(db => db?.close())
    opening = null
  }

  return { load, create, save, erase, useOlderCopy, watch, close }
}
