import type { FinanceData } from '../domain/finance/types'
import { migrateToCurrent } from './migrations'
import { validateFinanceData } from './validate'

/** The file a user exports: everything they entered, nothing calculated. */
export const exportFinanceData = (data: FinanceData): string => JSON.stringify(data, null, 2)

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
