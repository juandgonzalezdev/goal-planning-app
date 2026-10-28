import type { FinanceData } from '../domain/finance/types'
import { readFinanceData } from './exchange'
import { STORAGE_KEY } from './localStore'
import { CURRENT_SCHEMA_VERSION } from './migrations'
import type { StoredSpace, UnreadableReason } from './spaceStore'

/**
 * Reading what is saved, without changing it: the space as the browser's
 * database keeps it (an envelope with its revision), and the older copy
 * that versions before it kept in localStorage.
 */

/** The older copy: where every version before the database saved the own space. */
export const OLDER_COPY_KEY = STORAGE_KEY

/**
 * Written to localStorage when the own space is erased. While it is
 * there, the older copy is never opened again, even in a browser where
 * the database cannot be used.
 */
export const ERASED_KEY = 'goal-planning-app.erased'

export const ENVELOPE_FORMAT = 1

/** How the database keeps a space: the records, untouched, and the revision they were saved as. */
export interface Envelope {
  format: typeof ENVELOPE_FORMAT
  revision: number
  /** When it was saved (an ISO date and time). */
  savedAt: string
  data: FinanceData
}

export const makeEnvelope = (data: FinanceData, revision: number, savedAt: string): Envelope =>
  ({ format: ENVELOPE_FORMAT, revision, savedAt, data })

export type Reading<T> = { ok: true; value: T } | { ok: false; reason: UnreadableReason; errors: string[] }

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value)

/** Checks records read back from anywhere: brought up to date and validated, or the reason they cannot be used. */
export function readData(value: unknown): Reading<FinanceData> {
  const version = isRecord(value) ? value.schemaVersion : undefined
  if (typeof version === 'number' && version > CURRENT_SCHEMA_VERSION) {
    return { ok: false, reason: 'newer-version', errors: [`It was saved by a newer version of the app (${version}).`] }
  }
  const result = readFinanceData(value)
  return result.status === 'imported' ? { ok: true, value: result.data } : { ok: false, reason: 'broken', errors: result.errors }
}

/** Reads an envelope from the database. `undefined` means nothing is stored under that key. */
export function readEnvelope(value: unknown): Reading<StoredSpace> {
  if (value === undefined) return { ok: false, reason: 'missing', errors: ['The saved space is not there.'] }
  if (!isRecord(value) || typeof value.format !== 'number') return { ok: false, reason: 'broken', errors: ['The saved space is damaged.'] }
  if (value.format > ENVELOPE_FORMAT) return { ok: false, reason: 'newer-version', errors: ['It was saved by a newer version of the app.'] }
  if (typeof value.revision !== 'number' || !Number.isInteger(value.revision) || value.revision < 1) {
    return { ok: false, reason: 'broken', errors: ['The saved space has no valid revision.'] }
  }
  const data = readData(value.data)
  return data.ok ? { ok: true, value: { data: data.value, revision: value.revision } } : data
}

export type OlderCopy =
  | { state: 'none' }
  | { state: 'readable'; data: FinanceData }
  | { state: 'unreadable'; reason: UnreadableReason; errors: string[] }

/** Reads the older copy from localStorage, as versions before the database did. */
export function readOlderCopy(storage: Storage | null): OlderCopy {
  let text: string | null
  try {
    text = storage ? storage.getItem(OLDER_COPY_KEY) : null
  } catch {
    return { state: 'unreadable', reason: 'broken', errors: ['This browser does not allow reading saved data.'] }
  }
  if (text === null) return { state: 'none' }
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    return { state: 'unreadable', reason: 'broken', errors: ['The saved data is not valid JSON.'] }
  }
  const data = readData(parsed)
  return data.ok ? { state: 'readable', data: data.value } : { state: 'unreadable', reason: data.reason, errors: data.errors }
}

/** True when this device has a mark that the own space was erased. */
export function isErasedMarked(storage: Storage | null): boolean {
  try {
    return storage?.getItem(ERASED_KEY) === 'yes'
  } catch {
    return false
  }
}

/** Two copies hold the same records. */
export const sameRecords = (a: FinanceData, b: FinanceData): boolean => JSON.stringify(a) === JSON.stringify(b)
