import type { FinanceData } from '../domain/finance/types'
import type { GuideProgress } from '../features/home/gettingStarted'
import type { GuideUnreadable } from './guideProgress'

/**
 * What any store of the own space must do: the browser's database today
 * (`indexedDbStore.ts`), a server later. Screens never talk to a store
 * directly; `useSpace` does.
 *
 * The rules every store keeps:
 * - Saving compares the revision and writes in one atomic step, so a
 *   change made on an older revision is refused, never written over a
 *   newer one.
 * - All or nothing: a save leaves the old revision whole or the new one
 *   whole.
 * - Everything read is checked (`readFinanceData`) before it is used.
 * - The revision lives outside the records: a backup holds plain FinanceData.
 * - Getting Started progress is kept apart from the records, with its own
 *   revision (GS-6A.1): changing it never changes the space's revision.
 * - Data that cannot be read is never overwritten without the user's choice.
 */

/** The records as saved, with the revision they were saved as (1, 2, 3…). */
export interface StoredSpace {
  data: FinanceData
  revision: number
}

/** Why saved data cannot be opened. */
export type UnreadableReason =
  /** Damaged or not app data. */
  | 'broken'
  /** Saved by a newer version of the app: opening it could lose information. */
  | 'newer-version'
  /** The space this device points at is not there. */
  | 'missing'
  /** The copy made from the older saved data does not match it. */
  | 'copies-differ'

export type LoadResult =
  /** No own space on this device. */
  | { status: 'empty' }
  | { status: 'loaded'; space: StoredSpace }
  /**
   * Something is saved but cannot be used. Nothing was changed. `source`
   * says which copy: the current space, or the older copy the app kept
   * before this storage existed. `olderCopy` is true when that older copy
   * can be read and offered with "Use Older Copy".
   */
  | { status: 'unreadable'; source: 'space' | 'older-copy'; reason: UnreadableReason; errors: string[]; olderCopy: boolean }
  /**
   * This browser cannot save safely, so nothing can be saved. `space` is
   * the older copy, if one can be read; it may be older than the latest
   * changes, and the screen must say so.
   */
  | { status: 'read-only'; space: StoredSpace | null; mayBeOutdated: true }

export type SaveResult =
  /** The whole change is stored: the transaction finished. */
  | { status: 'saved'; revision: number }
  /** Something else changed the space first (or erased it). Nothing was written. */
  | { status: 'conflict'; latest: StoredSpace | null }
  /** The store refused or failed. Nothing was written. */
  | { status: 'failed' }

export type EraseResult =
  /** Nothing is left that could come back. */
  | { status: 'erased' }
  /** The space no longer opens and is never brought back, but the older copy is still on this device. */
  | { status: 'partly-erased'; remaining: 'older-copy' }
  /** Nothing was erased. */
  | { status: 'failed' }

/**
 * What another tab (or an older version of the app) did. Only a notice: safety never depends on it.
 * `closed`: a newer version of the app, opened in another tab, took over the database. This tab can
 * no longer read or save anything until it is reloaded.
 */
export type StoreChange = { kind: 'saved'; spaceId: string; revision: number } | { kind: 'erased' } | { kind: 'older-copy-changed' } | { kind: 'closed' }
  /** GS-6A.1: Getting Started progress of that space was saved (its own revision). The space's records did not change. */
  | { kind: 'progress-saved'; spaceId: string; revision: number }

/**
 * Getting Started progress of one space, as `loadProgress` finds it (GS-6A.1).
 * `revision` is the progress's own revision, never the space's: 0 means nothing
 * is saved for it yet (the progress shown is then a new guide, or the one
 * brought from localStorage when that could not be saved yet).
 */
export type ProgressLoad =
  | { status: 'loaded'; progress: GuideProgress; revision: number }
  /**
   * Something is saved but cannot be used safely (damaged, or written by a newer version of the app).
   * It is kept as it is and never written over by a normal change; `progress` is a new guide, not finished.
   */
  | { status: 'locked'; progress: GuideProgress; revision: number; reason: GuideUnreadable }
  /** This browser cannot use its database: `progress` is what localStorage had for this space, to show only. */
  | { status: 'unavailable'; progress: GuideProgress }
  /** The space is not the one this device opens (erased or replaced elsewhere), or the database failed. Nothing was written. */
  | { status: 'failed' }

export type ProgressSaveResult =
  /** The whole change is stored: the transaction finished. */
  | { status: 'saved'; revision: number }
  /**
   * Something else changed it first (another tab, a restore), or the space is no longer the one open.
   * Nothing was written. `latest`: what is saved now, when it can be read.
   */
  | { status: 'conflict'; latest: { progress: GuideProgress; revision: number } | null }
  /** The store refused or failed, or what is saved cannot be written over safely. Nothing was written. */
  | { status: 'failed' }

/**
 * What Restore Backup does with Getting Started progress (GS-6A.1, D-GS6-18):
 * - `replace`: the backup has progress; it becomes the space's progress.
 * - `keep`: an older backup without progress. The space keeps its own valid
 *   progress; with none, it gets a guide that is not finished. Never invented.
 */
export type GuideRestore = { kind: 'replace'; progress: GuideProgress } | { kind: 'keep' }

/**
 * Every copy this device keeps, exactly as it is stored, for "Download Both Copies": the current
 * space, the older copy and whatever was set aside. Nothing is checked, fixed or changed, so a copy
 * that cannot be opened is in it too. It is not a backup: Restore Backup does not take it.
 */
export interface RecoveryCopies {
  /** The browser's database, or null when it cannot be read (`databaseError` says why). */
  database: {
    currentSpace: unknown
    /** `migrated` or `erased` when the older copy was dealt with. */
    legacy: unknown
    lastRevision: unknown
    spaces: { id: string; stored: unknown }[]
    quarantine: { key: string; stored: unknown }[]
    /** GS-6A.1: every Getting Started progress record, as stored. */
    guideProgress?: { key: string; stored: unknown }[]
  } | null
  databaseError?: string
  /** The older copy in localStorage, as text, untouched (null: none). */
  olderCopy: string | null
  olderCopyError?: string
  /** GS-6A.1: the Getting Started progress versions before it kept in localStorage, as text, untouched (null: none). */
  olderGuideProgress?: string | null
  /** This device has the mark that the own space was erased. */
  erasedMark: boolean
}

export interface SpaceStore {
  load(): Promise<LoadResult>
  /**
   * Starts a new own space: at revision 1, or after the last revision of a
   * space erased before, so no tab still open on that one can save over it.
   * Refused (conflict) when one already exists.
   */
  create(data: FinanceData): Promise<SaveResult>
  /** Saves only if the stored space is still at `baseRevision`. */
  save(data: FinanceData, baseRevision: number): Promise<SaveResult>
  erase(): Promise<EraseResult>
  /**
   * After the user confirms "Use Older Copy" on unreadable data: the
   * unreadable space goes to quarantine (never deleted, never written
   * over) and the older copy becomes the space.
   */
  useOlderCopy(): Promise<SaveResult>
  /** Reads every copy as it is stored, in a read-only transaction: nothing is ever changed. */
  exportCopies(): Promise<RecoveryCopies>
  /**
   * Restore Backup: replaces the space's records and its Getting Started
   * progress in ONE transaction, only if the space is still at
   * `baseRevision`. Both are written or neither is.
   */
  restore(data: FinanceData, baseRevision: number, guide: GuideRestore): Promise<SaveResult>
  /**
   * Getting Started progress of the space open now (GS-6A.1). The first time,
   * when nothing is saved yet, the progress versions before it kept in
   * localStorage for this space is brought in, only if nothing was saved
   * meanwhile (another tab, a restore). Safe to repeat.
   */
  loadProgress(spaceId: string): Promise<ProgressLoad>
  /**
   * Saves Getting Started progress only if what is saved is still at
   * `baseRevision` (0: nothing saved yet). It never changes the space's
   * records or their revision.
   */
  saveProgress(spaceId: string, progress: GuideProgress, baseRevision: number): Promise<ProgressSaveResult>
  /** Calls `onChange` when another tab changes the space. Returns a function that stops it. */
  watch(onChange: (change: StoreChange) => void): () => void
}
