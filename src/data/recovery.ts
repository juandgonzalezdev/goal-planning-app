import { RECOVERY_KIND } from './exchange'
import type { RecoveryCopies } from './spaceStore'

/**
 * The file "Download Both Copies" saves: every copy this device keeps,
 * exactly as stored (also the ones that cannot be opened), so nothing is
 * lost before trying Use Older Copy or Erase. It holds the financial
 * information as plain text, not encrypted, and it is not a backup.
 */
export function recoveryFile(copies: RecoveryCopies, createdAt: string): string {
  return JSON.stringify({
    kind: RECOVERY_KIND,
    format: 1,
    createdAt,
    note: 'Recovery file of Goal Planning. It holds every saved copy exactly as it was stored, not encrypted. It is not a backup: Restore Backup does not open it. Keep it private.',
    ...copies,
  }, null, 2)
}

/** The name of the file, with the day it was made: goal-planning-recovery-2026-10-28.json. */
export const recoveryFileName = (createdAt: string) => `goal-planning-recovery-${createdAt.slice(0, 10)}.json`
