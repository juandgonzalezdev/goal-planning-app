import { describe, expect, it } from 'vitest'
import { createSpaceData } from '../domain/finance/space'
import type { FinanceData } from '../domain/finance/types'
import { NEW_PROGRESS, type GuideProgress } from '../features/home/gettingStarted'
import { BACKUP_KIND, exportBackup, exportFinanceData, importBackup } from './exchange'
import { checkProgress } from './guideProgress'
import { recoveryFile } from './recovery'

/* GS-6A.1: the backup file keeps the records and Getting Started apart, and older files are still restored. */

function ownSpace(): FinanceData {
  const created = createSpaceData({ mode: 'individual', names: ['Robin'], currency: 'PLN', theme: 'system' })
  if (created.status !== 'created') throw new Error('setup failed')
  return created.data
}
const progress = (change: Partial<GuideProgress> = {}): GuideProgress => ({ ...NEW_PROGRESS, ...change })
const envelope = (change: Record<string, unknown>) => JSON.stringify({ kind: BACKUP_KIND, format: 1, financeData: ownSpace(), gettingStarted: null, ...change })

describe('Backup file with Getting Started (GS-6A.1)', () => {
  it('round-trips the records and saved progress, finished or not, with the records unchanged', () => {
    const data = ownSpace()
    for (const saved of [progress({ finished: true, skipped: ['debts'], none: ['income'], last: 'finish' }), progress({ hidden: true })]) {
      const text = exportBackup(data, saved)
      expect(JSON.parse(text)).toEqual({ kind: BACKUP_KIND, format: 1, financeData: data, gettingStarted: { progress: saved } })
      expect(importBackup(text)).toEqual({ status: 'imported', backup: { data, guide: { kind: 'replace', progress: saved } } })
    }
  })

  it('a file without saved progress, and an older file with the records only, keep the space’s own progress', () => {
    const data = ownSpace()
    expect(importBackup(exportBackup(data, null))).toEqual({ status: 'imported', backup: { data, guide: { kind: 'keep' } } })
    expect(importBackup(exportFinanceData(data))).toEqual({ status: 'imported', backup: { data, guide: { kind: 'keep' } } })
  })

  it('refuses malformed Getting Started data, whole: nothing of the file is used', () => {
    const bad: unknown[] = [
      'yes', { progress: { ...NEW_PROGRESS, finished: 'yes' } }, { progress: { ...NEW_PROGRESS, skipped: ['finish'] } },
      { progress: { ...NEW_PROGRESS, skipped: ['income'], none: ['income'] } }, { progress: { ...NEW_PROGRESS, extra: 1 } },
      { progress: { ...NEW_PROGRESS, version: 1 } }, { progress: NEW_PROGRESS, note: 'x' }, { progress: { ...NEW_PROGRESS, last: 'day-to-day' } },
    ]
    for (const gettingStarted of bad) expect(importBackup(envelope({ gettingStarted })).status).toBe('rejected')
  })

  it('refuses progress, or a backup, from a newer version, saying so', () => {
    expect(importBackup(envelope({ gettingStarted: { progress: { ...NEW_PROGRESS, version: 3 } } }))).toEqual({
      status: 'rejected', errors: ['Getting Started progress is from a newer version of the app (3).'],
    })
    expect(importBackup(envelope({ format: 2 }))).toEqual({ status: 'rejected', errors: ['The backup is from a newer app version (format 2).'] })
    expect(importBackup(envelope({ format: 'one' })).status).toBe('rejected')
    expect(importBackup(envelope({ extra: true }))).toEqual({ status: 'rejected', errors: ['The backup has unknown fields: extra.'] })
  })

  it('keeps every check on the records, and refuses a file with good progress but bad records', () => {
    const broken = { ...ownSpace(), goals: [{ id: 'g' }] }
    expect(importBackup(envelope({ financeData: broken, gettingStarted: { progress: progress({ finished: true }) } })).status).toBe('rejected')
    expect(importBackup(envelope({ financeData: { ...ownSpace(), schemaVersion: 9 } }))).toMatchObject({ status: 'rejected', errors: ['The file is from a newer app version (9).'] })
    expect(importBackup(JSON.stringify({ kind: BACKUP_KIND, format: 1 }))).toEqual({ status: 'rejected', errors: ['The backup has no financeData.'] })
    expect(importBackup('{ not json')).toEqual({ status: 'rejected', errors: ['The file is not valid JSON.'] })
  })

  it('still refuses a recovery file (Download Both Copies)', () => {
    const text = recoveryFile({ database: null, olderCopy: null, erasedMark: false }, '2026-11-12T12:00:00.000Z')
    expect(importBackup(text)).toEqual({ status: 'rejected', errors: ['This is a recovery file, not a backup. It cannot be restored here.'] })
  })

  it('the strict check never takes a newer version as finished', () => {
    expect(checkProgress({ version: 3, finished: true })).toMatchObject({ ok: false, reason: 'newer-version' })
    expect(checkProgress(NEW_PROGRESS)).toEqual({ ok: true, progress: NEW_PROGRESS })
  })
})
