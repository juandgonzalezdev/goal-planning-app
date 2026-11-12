import type { FinanceData } from '../domain/finance/types'
import type { GuideProgress } from '../features/home/gettingStarted'
import { checkProgress } from './guideProgress'
import { migrateToCurrent } from './migrations'
import type { GuideRestore } from './spaceStore'
import { validateFinanceData } from './validate'

/** The records alone, as every backup before GS-6A.1 was (Restore Backup still reads these files). */
export const exportFinanceData = (data: FinanceData): string => JSON.stringify(data, null, 2)

/**
 * The backup file from GS-6A.1 on: an explicit envelope that keeps the
 * records and Getting Started apart.
 *
 *     { "kind": "goal-planning-backup", "format": 1,
 *       "financeData": { …FinanceData, unchanged… },
 *       "gettingStarted": { "progress": { …GuideProgress v2… } } | null }
 *
 * `gettingStarted` is null when no progress was saved (or it could not be
 * read): restoring that file keeps the space's own progress, as an older
 * backup does.
 */
export const BACKUP_KIND = 'goal-planning-backup'
export const BACKUP_FORMAT = 1

/** `progress`: only progress the store confirmed as saved, never what is on screen. */
export const exportBackup = (data: FinanceData, progress: GuideProgress | null): string =>
  JSON.stringify({ kind: BACKUP_KIND, format: BACKUP_FORMAT, financeData: data, gettingStarted: progress ? { progress } : null }, null, 2)

/** A backup read and checked: the records, and what happens to Getting Started when it is restored. */
export interface Backup {
  data: FinanceData
  guide: GuideRestore
}

export type BackupImport = { status: 'imported'; backup: Backup } | { status: 'rejected'; errors: string[] }

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value)
const ENVELOPE_FIELDS = ['kind', 'format', 'financeData', 'gettingStarted']

/**
 * Reads a backup file for Restore Backup: the envelope from GS-6A.1, or an
 * older file with the records only (then Getting Started is kept as the
 * space has it). All or nothing: a file with any problem, in the records or
 * in Getting Started, is refused whole. Nothing is replaced here.
 */
export function importBackup(text: string): BackupImport {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    return { status: 'rejected', errors: ['The file is not valid JSON.'] }
  }
  if (isRecoveryFile(parsed)) return { status: 'rejected', errors: ['This is a recovery file, not a backup. It cannot be restored here.'] }
  if (!isRecord(parsed) || parsed.kind !== BACKUP_KIND) {
    // Before GS-6A.1: the records only.
    const older = readFinanceData(parsed)
    return older.status === 'imported' ? { status: 'imported', backup: { data: older.data, guide: { kind: 'keep' } } } : older
  }
  if (typeof parsed.format === 'number' && parsed.format > BACKUP_FORMAT) {
    return { status: 'rejected', errors: [`The backup is from a newer app version (format ${parsed.format}).`] }
  }
  const errors: string[] = []
  if (parsed.format !== BACKUP_FORMAT) errors.push(`The backup format must be ${BACKUP_FORMAT}.`)
  const unknown = Object.keys(parsed).filter(key => !ENVELOPE_FIELDS.includes(key))
  if (unknown.length) errors.push(`The backup has unknown fields: ${unknown.join(', ')}.`)
  let guide: GuideRestore = { kind: 'keep' }
  const meta = parsed.gettingStarted
  if (meta !== null && meta !== undefined) {
    if (!isRecord(meta) || Object.keys(meta).some(key => key !== 'progress')) errors.push('Getting Started in the backup must hold only "progress".')
    else {
      const progress = checkProgress(meta.progress)
      if (progress.ok) guide = { kind: 'replace', progress: progress.progress }
      else errors.push(...progress.errors)
    }
  }
  if (!('financeData' in parsed)) errors.push('The backup has no financeData.')
  else {
    const records = readFinanceData(parsed.financeData)
    if (records.status === 'rejected') errors.push(...records.errors)
    else if (!errors.length) return { status: 'imported', backup: { data: records.data, guide } }
  }
  return { status: 'rejected', errors }
}

/** What "Download Both Copies" saves: every copy as it was stored. Never read back as a backup. */
export const RECOVERY_KIND = 'goal-planning-recovery'

const isRecoveryFile = (value: unknown): boolean =>
  typeof value === 'object' && value !== null && (value as { kind?: unknown }).kind === RECOVERY_KIND

export type ImportResult = { status: 'imported'; data: FinanceData } | { status: 'rejected'; errors: string[] }

/**
 * Reads an exported file: parses it, brings older versions up to date and
 * checks it. Nothing is replaced here; the screen must ask the user before
 * using the result.
 */
export function importFinanceData(text: string): ImportResult {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    return { status: 'rejected', errors: ['The file is not valid JSON.'] }
  }
  if (isRecoveryFile(parsed)) return { status: 'rejected', errors: ['This is a recovery file, not a backup. It cannot be restored here.'] }
  return readFinanceData(parsed)
}

/**
 * The same checks for data that is already an object (for example, read
 * back from the browser's database): older versions are brought up to
 * date, then everything is checked. The value given is never changed.
 */
export function readFinanceData(parsed: unknown): ImportResult {
  const migrated = migrateToCurrent(parsed)
  switch (migrated.status) {
    case 'not-data': return { status: 'rejected', errors: ['The file does not contain app data.'] }
    case 'no-version': return { status: 'rejected', errors: ['The file has no schemaVersion.'] }
    case 'newer-version': return { status: 'rejected', errors: [`The file is from a newer app version (${migrated.version}).`] }
    case 'unknown-version': return { status: 'rejected', errors: [`The file version ${migrated.version} is not supported.`] }
    case 'migrated': {
      const checked = validateFinanceData(migrated.data)
      return checked.status === 'valid' ? { status: 'imported', data: checked.data } : { status: 'rejected', errors: checked.errors }
    }
  }
}
