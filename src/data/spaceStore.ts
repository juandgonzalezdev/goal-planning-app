import type { FinanceData } from '../domain/finance/types'

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
 * - The revision lives outside the records: backups stay plain FinanceData.
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
  /** Calls `onChange` when another tab changes the space. Returns a function that stops it. */
  watch(onChange: (change: StoreChange) => void): () => void
}
