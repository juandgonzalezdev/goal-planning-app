import type { FinanceData } from '../domain/finance/types'
import { exportFinanceData, importFinanceData } from './exchange'

/**
 * Keeps the user's own space on this device, in the browser's
 * localStorage. This is a prototype convenience, not secure storage:
 * anyone who can use this browser can read it. The demo is never saved.
 *
 * Everything the app saves goes through this one place. Saving here is
 * immediate and either works or fails; a store on a server would answer
 * later and can also fail or be refused, so replacing this one also
 * changes `useSpace` and the "Saved" messages the screens show.
 */
export const STORAGE_KEY = 'goal-planning-app.my-space'

export type LoadResult =
  | { status: 'empty' }
  | { status: 'loaded'; data: FinanceData }
  /** Something is saved but it cannot be used. It is left untouched until the user decides. */
  | { status: 'unreadable'; errors: string[] }

export interface FinanceStore {
  load(): LoadResult
  /** Returns false when the browser refused to save (for example, private mode or full storage). */
  save(data: FinanceData): boolean
  /** Erases the saved space from this device. */
  clear(): boolean
}

export function createLocalStore(storage: Storage | null, key = STORAGE_KEY): FinanceStore {
  return {
    load() {
      let text: string | null
      try {
        text = storage ? storage.getItem(key) : null
      } catch {
        return { status: 'unreadable', errors: ['This browser does not allow reading saved data.'] }
      }
      if (text === null) return { status: 'empty' }
      const result = importFinanceData(text)
      return result.status === 'imported' ? { status: 'loaded', data: result.data } : { status: 'unreadable', errors: result.errors }
    },
    save(data) {
      try {
        if (!storage) return false
        storage.setItem(key, exportFinanceData(data))
        return true
      } catch {
        return false
      }
    },
    clear() {
      try {
        storage?.removeItem(key)
        return true
      } catch {
        return false
      }
    },
  }
}

/** The browser's localStorage, or null where it cannot even be reached. */
export function browserStorage(): Storage | null {
  try {
    return window.localStorage
  } catch {
    return null
  }
}
