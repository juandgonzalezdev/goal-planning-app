import {
  GUIDE_STEPS, NONE_STEPS, PROGRESS_VERSION, readProgress, type GuideProgress, type GuideStep, type NoneStep,
} from '../features/home/gettingStarted'

/**
 * Getting Started progress as it is saved (GS-6A.1): one record per space in
 * the database's `meta` store, apart from the space's records and from their
 * revision. A change to the guide never changes the space's revision, so it
 * never makes a form open in another tab look out of date.
 *
 * The record: `{ format: 1, spaceId, revision, savedAt, progress }`, where
 * `revision` counts the guide's own saves (1, 2, 3…) and `progress` is
 * `GuideProgress` v2.
 *
 * Before GS-6A.1 the progress was kept in localStorage
 * (`goal-planning-app.getting-started` → `{ spaceId, progress }`). That value
 * is only read, to bring it in once; it is never written again here.
 */

/** Where every version before GS-6A.1 kept the progress (one value per device). */
export const LEGACY_GUIDE_KEY = 'goal-planning-app.getting-started'

export const GUIDE_RECORD_FORMAT = 1

const PREFIX = 'guide-progress:'

/** The `meta` key of a space's progress. */
export const guideKey = (spaceId: string) => `${PREFIX}${spaceId}`

/** Whether a `meta` key holds Getting Started progress (any space). */
export const isGuideKey = (key: IDBValidKey): key is string => typeof key === 'string' && key.startsWith(PREFIX)

export interface GuideRecord {
  format: typeof GUIDE_RECORD_FORMAT
  spaceId: string
  revision: number
  savedAt: string
  progress: GuideProgress
}

export const makeGuideRecord = (spaceId: string, progress: GuideProgress, revision: number, savedAt: string): GuideRecord =>
  ({ format: GUIDE_RECORD_FORMAT, spaceId, revision, savedAt, progress: { ...progress, skipped: [...progress.skipped], none: [...progress.none] } })

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value)

/** Why saved progress cannot be used (nor written over). */
export type GuideUnreadable = 'broken' | 'newer-version'

export type ProgressCheck = { ok: true; progress: GuideProgress } | { ok: false; reason: GuideUnreadable; errors: string[] }

const PROGRESS_FIELDS = ['version', 'hidden', 'skipped', 'none', 'finished', 'last']

/**
 * The strict check for progress written by this version (v2), as saved in the
 * database or in a backup file. Unlike `readProgress`, nothing is guessed:
 * anything unexpected is refused with the reason, and a newer version is
 * never read as if it were this one (so it is never taken as finished).
 */
export function checkProgress(value: unknown): ProgressCheck {
  if (!isRecord(value)) return { ok: false, reason: 'broken', errors: ['Getting Started progress is not an object.'] }
  if (typeof value.version === 'number' && value.version > PROGRESS_VERSION) {
    return { ok: false, reason: 'newer-version', errors: [`Getting Started progress is from a newer version of the app (${value.version}).`] }
  }
  const errors: string[] = []
  if (value.version !== PROGRESS_VERSION) errors.push(`Getting Started progress must be version ${PROGRESS_VERSION}.`)
  const unknown = Object.keys(value).filter(key => !PROGRESS_FIELDS.includes(key))
  if (unknown.length) errors.push(`Getting Started progress has unknown fields: ${unknown.join(', ')}.`)
  if (typeof value.hidden !== 'boolean') errors.push('Getting Started "hidden" must be true or false.')
  if (typeof value.finished !== 'boolean') errors.push('Getting Started "finished" must be true or false.')
  const steps = (field: unknown, allowed: readonly string[], name: string): string[] => {
    if (!Array.isArray(field) || field.some(item => typeof item !== 'string' || !allowed.includes(item))) {
      errors.push(`Getting Started "${name}" must list known stages.`)
      return []
    }
    if (new Set(field).size !== field.length) errors.push(`Getting Started "${name}" lists a stage twice.`)
    return field as string[]
  }
  const skipped = steps(value.skipped, GUIDE_STEPS.filter(step => step !== 'finish'), 'skipped')
  const none = steps(value.none, NONE_STEPS, 'none')
  if (skipped.some(step => none.includes(step))) errors.push('A Getting Started stage cannot be both skipped and none.')
  if (value.last !== null && !(typeof value.last === 'string' && (GUIDE_STEPS as readonly string[]).includes(value.last))) {
    errors.push('Getting Started "last" must be a known stage or null.')
  }
  if (errors.length) return { ok: false, reason: 'broken', errors }
  return {
    ok: true,
    progress: {
      version: PROGRESS_VERSION, hidden: value.hidden as boolean, finished: value.finished as boolean,
      skipped: skipped as GuideStep[], none: none as NoneStep[], last: value.last as GuideStep | null,
    },
  }
}

export type GuideReading =
  /** Nothing saved for that space. */
  | { state: 'none' }
  | { state: 'readable'; progress: GuideProgress; revision: number }
  /** Something is saved but cannot be used: it is kept as it is, never written over by a normal change. */
  | { state: 'unreadable'; reason: GuideUnreadable; errors: string[]; revision: number }

const revisionOf = (value: Record<string, unknown>) =>
  (typeof value.revision === 'number' && Number.isInteger(value.revision) && value.revision > 0 ? value.revision : 0)

/** Reads a record from the database. `undefined`: nothing saved. */
export function readGuideRecord(raw: unknown, spaceId: string): GuideReading {
  if (raw === undefined) return { state: 'none' }
  if (!isRecord(raw) || typeof raw.format !== 'number') return { state: 'unreadable', reason: 'broken', errors: ['The saved Getting Started progress is damaged.'], revision: 0 }
  const revision = revisionOf(raw)
  if (raw.format > GUIDE_RECORD_FORMAT) return { state: 'unreadable', reason: 'newer-version', errors: ['The saved Getting Started progress is from a newer version of the app.'], revision }
  if (raw.format !== GUIDE_RECORD_FORMAT || revision === 0 || raw.spaceId !== spaceId) {
    return { state: 'unreadable', reason: 'broken', errors: ['The saved Getting Started progress is damaged.'], revision }
  }
  const progress = checkProgress(raw.progress)
  return progress.ok ? { state: 'readable', progress: progress.progress, revision } : { state: 'unreadable', reason: progress.reason, errors: progress.errors, revision }
}

export type LegacyGuide =
  /** No earlier progress for this space (none at all, another space's, or a value that cannot be read). */
  | { state: 'none' }
  | { state: 'readable'; progress: GuideProgress }
  /** Written by a newer version: never brought in (it could be read as something it does not mean). */
  | { state: 'newer-version' }

/**
 * The progress versions before GS-6A.1 kept in localStorage, for this space
 * only, read with `readProgress` (the tolerant reading of v1 and v2). Only
 * reads: the value stays where it is.
 */
export function readLegacyGuide(storage: Storage | null, spaceId: string): LegacyGuide {
  let text: string | null
  try {
    text = storage ? storage.getItem(LEGACY_GUIDE_KEY) : null
  } catch {
    return { state: 'none' }
  }
  if (text === null) return { state: 'none' }
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    return { state: 'none' }
  }
  if (!isRecord(parsed) || parsed.spaceId !== spaceId || !isRecord(parsed.progress)) return { state: 'none' }
  const version = parsed.progress.version
  if (typeof version === 'number' && version > PROGRESS_VERSION) return { state: 'newer-version' }
  return { state: 'readable', progress: readProgress(parsed.progress) }
}
