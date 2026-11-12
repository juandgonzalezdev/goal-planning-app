import type { FinanceData } from '../domain/finance/types'
import { NEW_PROGRESS, type GuideProgress } from '../features/home/gettingStarted'
import {
  checkProgress, guideKey, isGuideKey, LEGACY_GUIDE_KEY, makeGuideRecord, readGuideRecord, readLegacyGuide, type GuideReading,
} from './guideProgress'
import { openDatabase, transact, when } from './idb'
import {
  ERASED_KEY, isErasedMarked, makeEnvelope, OLDER_COPY_KEY, readData, readEnvelope, readOlderCopy, sameRecords,
  type Reading,
} from './savedCopies'
import type {
  EraseResult, GuideRestore, LoadResult, ProgressLoad, ProgressSaveResult, RecoveryCopies, SaveResult, SpaceStore, StoreChange, StoredSpace,
  UnreadableReason,
} from './spaceStore'

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
 * - GS-6A.1: `meta` also keeps one `guide-progress:<space id>` record per
 *   space with its Getting Started progress and its own revision
 *   (`guideProgress.ts`). It is written apart from the space, so a guide
 *   change never changes the space's revision. No new store and no new
 *   database version: a tab of an earlier version keeps working.
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
  pause?: (step: 'before-copy' | 'before-activate' | 'before-guide-copy') => Promise<void>
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
              // A new space never takes progress left under its id (GS-6A.1): it starts with a new guide.
              meta.delete(guideKey(id))
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
        when(meta.get(CURRENT), current => when(meta.get(LAST_REVISION), last => when(meta.getAllKeys(), metaKeys => {
          const readCurrent = (then: (raw: unknown) => void) => {
            if (typeof current !== 'string') { then(undefined); return }
            when(spaces.get(current), then)
          }
          readCurrent(raw => {
            const revision = Math.max(revisionOf(raw), revisionOf({ revision: last }))
            spaces.clear()
            tx.objectStore(QUARANTINE).clear()
            meta.delete(CURRENT)
            // Getting Started progress of every space goes with them (GS-6A.1): nothing of it can come back.
            for (const key of metaKeys.filter(isGuideKey)) meta.delete(key)
            if (revision > 0) meta.put(revision, LAST_REVISION)
            when(meta.put('erased', LEGACY), () => end.done(true))
          })
        })))
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
    // Getting Started progress kept by versions before GS-6A.1: only a screen preference, it holds no records.
    try { storage?.removeItem(LEGACY_GUIDE_KEY) } catch { /* Tied to the erased space's id: a new space never reads it. */ }
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
            // GS-6A.1: the progress of a space that leaves `spaces` goes to quarantine with it, never left behind under its id.
            const readTargetGuide = (then: (guide: unknown) => void) => {
              if (expected.target === id) { then(undefined); return }
              when(meta.get(guideKey(expected.target)), then)
            }
            readDestination(destination => readTargetGuide(targetGuide => {
              const destinationReading = destination === undefined ? null : readEnvelope(destination)
              const keepsNothingNew = destinationReading?.ok === true && sameRecords(destinationReading.value.data, older.data)
              // The older copy goes on from the highest set-aside revision, so no open tab can save over it with an old one.
              const revision = Math.max(revisionOf(raw), revisionOf(destination)) + 1
              const toSetAside = [
                ...(raw === undefined ? [] : [{ spaceId: expected.target, value: raw }]),
                ...(destination === undefined || keepsNothingNew ? [] : [{ spaceId: id, value: destination }]),
                ...(targetGuide === undefined ? [] : [{ spaceId: expected.target, guideProgress: targetGuide }]),
              ]
              const replace = () => {
                if (expected.target !== id) { spaces.delete(expected.target); meta.delete(guideKey(expected.target)) }
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
            }))
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

  /** Saved progress as `loadProgress` reports it. Unusable progress is never read as finished: a new guide is shown. */
  const fromReading = (reading: Exclude<GuideReading, { state: 'none' }>): ProgressLoad =>
    reading.state === 'readable'
      ? { status: 'loaded', progress: reading.progress, revision: reading.revision }
      : { status: 'locked', progress: NEW_PROGRESS, revision: reading.revision, reason: reading.reason }

  /** What localStorage had for this space, for a browser that cannot use its database (never after Erase). */
  const legacyOnly = (spaceId: string): GuideProgress => {
    if (isErasedMarked(storage)) return NEW_PROGRESS
    const legacy = readLegacyGuide(storage, spaceId)
    return legacy.state === 'readable' ? legacy.progress : NEW_PROGRESS
  }

  async function loadProgress(spaceId: string): Promise<ProgressLoad> {
    const db = await database()
    if (!db) return { status: 'unavailable', progress: legacyOnly(spaceId) }
    const key = guideKey(spaceId)
    try {
      for (let attempt = 0; attempt < 3; attempt++) {
        const state = await transact<{ current: unknown; raw: unknown }>(db, [META], 'readonly', (tx, end) => {
          const meta = tx.objectStore(META)
          when(meta.get(CURRENT), current => when(meta.get(key), raw => end.done({ current, raw })))
        })
        // Erased or replaced meanwhile: nothing is read or brought in for a space that is not open.
        if (state.current !== spaceId) return { status: 'failed' }
        const reading = readGuideRecord(state.raw, spaceId)
        // Saved progress always wins (GS-6A-T01): localStorage is never read again for this space.
        if (reading.state !== 'none') return fromReading(reading)
        const legacy = readLegacyGuide(storage, spaceId)
        // Nothing saved anywhere: a new guide, and nothing is written until the user changes something.
        if (legacy.state !== 'readable') return { status: 'loaded', progress: NEW_PROGRESS, revision: 0 }
        await pause?.('before-guide-copy')
        // Bring it in: only while the space is still the one open and nothing was saved meanwhile (another tab, a restore).
        const copied = await transact<ProgressLoad | 'again'>(db, [META], 'readwrite', (tx, end) => {
          const meta = tx.objectStore(META)
          when(meta.get(CURRENT), current => {
            if (current !== spaceId) { end.undo('again'); return }
            when(meta.get(key), existing => {
              if (existing !== undefined) { end.undo('again'); return }
              when(meta.add(makeGuideRecord(spaceId, legacy.progress, 1, now()), key), () =>
                end.done({ status: 'loaded', progress: legacy.progress, revision: 1 }))
            })
          })
        })
        if (copied !== 'again') {
          notify({ kind: 'progress-saved', spaceId, revision: 1 })
          return copied
        }
      }
      return { status: 'failed' }
    } catch {
      // The database failed part-way: nothing half-written stays. localStorage still has it, untouched; it is brought in next time.
      const legacy = readLegacyGuide(storage, spaceId)
      return legacy.state === 'readable' ? { status: 'loaded', progress: legacy.progress, revision: 0 } : { status: 'failed' }
    }
  }

  async function saveProgress(spaceId: string, progress: GuideProgress, baseRevision: number): Promise<ProgressSaveResult> {
    const db = await database()
    if (!db || !checkProgress(progress).ok) return { status: 'failed' }
    const key = guideKey(spaceId)
    let result: ProgressSaveResult
    try {
      result = await transact<ProgressSaveResult>(db, [META], 'readwrite', (tx, end) => {
        const meta = tx.objectStore(META)
        when(meta.get(CURRENT), current => {
          // Erased, or another space was started: an old tab never writes progress for it.
          if (current !== spaceId) { end.undo({ status: 'conflict', latest: null }); return }
          when(meta.get(key), raw => {
            const reading = readGuideRecord(raw, spaceId)
            // Damaged, or from a newer version: never written over by a normal change.
            if (reading.state === 'unreadable') { end.undo({ status: 'failed' }); return }
            const saved = reading.state === 'readable' ? reading.revision : 0
            if (saved !== baseRevision) {
              end.undo({ status: 'conflict', latest: reading.state === 'readable' ? { progress: reading.progress, revision: reading.revision } : null })
              return
            }
            const revision = baseRevision + 1
            when(meta.put(makeGuideRecord(spaceId, progress, revision, now()), key), () => end.done({ status: 'saved', revision }))
          })
        })
      })
    } catch {
      return { status: 'failed' }
    }
    if (result.status === 'saved') notify({ kind: 'progress-saved', spaceId, revision: result.revision })
    return result
  }

  async function restore(data: FinanceData, baseRevision: number, guide: GuideRestore): Promise<SaveResult> {
    const db = await database()
    if (!db || !writable(data) || (guide.kind === 'replace' && !checkProgress(guide.progress).ok)) return { status: 'failed' }
    const id = data.space.id
    const key = guideKey(id)
    // Read before the transaction (localStorage is not part of it): only used when the space has no saved progress yet.
    const legacy = guide.kind === 'keep' && !isErasedMarked(storage) ? readLegacyGuide(storage, id) : null
    let result: { saved: SaveResult; guideRevision: number | null }
    try {
      result = await transact<{ saved: SaveResult; guideRevision: number | null }>(db, [SPACES, META, QUARANTINE], 'readwrite', (tx, end) => {
        const spaces = tx.objectStore(SPACES)
        const meta = tx.objectStore(META)
        when(meta.get(CURRENT), current => {
          if (current === undefined) { end.undo({ saved: { status: 'conflict', latest: null }, guideRevision: null }); return }
          when(spaces.get(current), rawSpace => {
            const reading = readEnvelope(rawSpace)
            const latest = reading.ok ? reading.value : null
            if (current !== id || !latest || latest.revision !== baseRevision) { end.undo({ saved: { status: 'conflict', latest }, guideRevision: null }); return }
            when(meta.get(key), rawGuide => {
              const saved = readGuideRecord(rawGuide, id)
              // What the space's progress becomes: null keeps what is saved.
              let next: GuideProgress | null
              if (guide.kind === 'replace') next = guide.progress
              else if (saved.state === 'readable') next = null
              else if (saved.state === 'unreadable' && saved.reason === 'newer-version') next = null
              else if (saved.state === 'none' && legacy?.state === 'readable') next = legacy.progress
              else next = NEW_PROGRESS
              const write = () => {
                const revision = baseRevision + 1
                spaces.put(makeEnvelope(data, revision, now()), id)
                const guideRevision = next ? (saved.state === 'none' ? 0 : saved.revision) + 1 : null
                if (next && guideRevision) meta.put(makeGuideRecord(id, next, guideRevision, now()), key)
                // Both in this one transaction: the records and the progress are restored together, or neither is.
                end.done({ saved: { status: 'saved', revision }, guideRevision })
              }
              // Progress that cannot be used is set aside, never deleted, before the backup's takes its place.
              if (next && saved.state === 'unreadable') when(tx.objectStore(QUARANTINE).add({ movedAt: now(), spaceId: id, guideProgress: rawGuide }), write)
              else write()
            })
          })
        })
      })
    } catch {
      return { status: 'failed' }
    }
    if (result.saved.status === 'saved') {
      notify({ kind: 'saved', spaceId: id, revision: result.saved.revision })
      if (result.guideRevision) notify({ kind: 'progress-saved', spaceId: id, revision: result.guideRevision })
    }
    return result.saved
  }

  async function exportCopies(): Promise<RecoveryCopies> {
    let olderCopy: string | null = null
    let olderCopyError: string | undefined
    try {
      olderCopy = storage ? storage.getItem(OLDER_COPY_KEY) : null
    } catch {
      olderCopyError = 'This browser does not allow reading the older copy.'
    }
    let olderGuideProgress: string | null = null
    try { olderGuideProgress = storage ? storage.getItem(LEGACY_GUIDE_KEY) : null } catch { /* Not readable: left out. */ }
    const copies: RecoveryCopies = { database: null, olderCopy, ...(olderCopyError && { olderCopyError }), olderGuideProgress, erasedMark: isErasedMarked(storage) }
    const db = await database()
    if (!db) return { ...copies, databaseError: 'This browser cannot open its database here.' }
    try {
      // One read-only transaction: every store as it is at one moment, and nothing can be written.
      const stored = await transact<NonNullable<RecoveryCopies['database']>>(db, [SPACES, META, QUARANTINE], 'readonly', (tx, end) => {
        const meta = tx.objectStore(META)
        const spaces = tx.objectStore(SPACES)
        const quarantine = tx.objectStore(QUARANTINE)
        when(meta.get(CURRENT), currentSpace => when(meta.get(LEGACY), legacy => when(meta.get(LAST_REVISION), lastRevision =>
          when(spaces.getAllKeys(), spaceKeys => when(spaces.getAll(), spaceValues =>
            when(quarantine.getAllKeys(), quarantineKeys => when(quarantine.getAll(), quarantineValues =>
              when(meta.getAllKeys(), metaKeys => when(meta.getAll(), metaValues => end.done({
                currentSpace, legacy, lastRevision,
                spaces: spaceKeys.map((key, index) => ({ id: String(key), stored: spaceValues[index] })),
                quarantine: quarantineKeys.map((key, index) => ({ key: String(key), stored: quarantineValues[index] })),
                guideProgress: metaKeys.flatMap((key, index) => (isGuideKey(key) ? [{ key, stored: metaValues[index] }] : [])),
              }))))))))))
      })
      return { ...copies, database: stored }
    } catch {
      return { ...copies, databaseError: 'The database could not be read.' }
    }
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

  return { load, create, save, restore, erase, useOlderCopy, exportCopies, loadProgress, saveProgress, watch, close }
}
