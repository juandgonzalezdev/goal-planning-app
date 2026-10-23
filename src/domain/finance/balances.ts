import type { BalanceSnapshot, Id } from './types'

/**
 * The newest balance entered for an account, or null if none was entered.
 * When two snapshots have the same date, the one entered later (later in
 * the list) wins.
 */
export function latestBalance(balances: readonly BalanceSnapshot[], accountId: Id): BalanceSnapshot | null {
  let latest: BalanceSnapshot | null = null
  for (const snapshot of balances) {
    if (snapshot.accountId !== accountId) continue
    if (!latest || snapshot.asOf >= latest.asOf) latest = snapshot
  }
  return latest
}

/** Every balance entered for an account, oldest first. */
export const balanceHistory = (balances: readonly BalanceSnapshot[], accountId: Id): BalanceSnapshot[] =>
  balances
    .map((snapshot, order) => ({ snapshot, order }))
    .filter(({ snapshot }) => snapshot.accountId === accountId)
    .sort((a, b) => a.snapshot.asOf.localeCompare(b.snapshot.asOf) || a.order - b.order)
    .map(({ snapshot }) => snapshot)
