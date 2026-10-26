import type { CalendarDate } from '../goalTime'
import type { MoneyAmount } from '../goalAmounts'
import { sumMinor } from '../money'
import { summarizeMoney, type MoneyAccountItem } from './moneyAccounts'
import { goalSaved } from './pots'
import type { FinanceData, Goal } from './types'

export interface SavingsPurpose {
  goal: Goal
  saved: MoneyAmount
}

/**
 * Savings, divided by purpose. The money is in the savings accounts (a
 * savings account, a piggy bank); goals and the emergency fund say what
 * part of it is for. So:
 *
 *   Savings = what the savings accounts hold
 *           = purposes (goals + emergency fund) + unassigned
 *
 * Purposes are never added on top of Savings.
 */
export interface SavingsSummary {
  accounts: MoneyAccountItem[]
  /** Known savings balances added up. */
  knownTotal: MoneyAmount
  /** Savings accounts with no balance entered. */
  missingBalanceCount: number
  /** null when there is no savings account, or a balance is missing: then Savings is not known. */
  total: MoneyAmount | null
  /** Active goals first, in the order they were added, then the emergency fund. */
  purposes: SavingsPurpose[]
  /** What the purposes hold, together. */
  assigned: MoneyAmount
  /**
   * Savings with no purpose: total minus assigned. null when Savings is not
   * known. Below 0 means the purposes hold more than the accounts: the
   * screen must say so, never hide it.
   */
  unassigned: MoneyAmount | null
}

/**
 * With `asOf`, Savings as known on that date: the balances true by then,
 * the goals that existed by then and their movements up to then.
 */
export function savingsSummary(data: Pick<FinanceData, 'moneyAccounts' | 'balances' | 'goals' | 'goalMovements'>, asOf?: CalendarDate): SavingsSummary {
  const accounts = summarizeMoney(data, asOf).items.filter(item => item.account.kind === 'savings')
  const knownTotal = sumMinor(accounts.flatMap(item => (item.balance === null ? [] : [item.balance])))
  const missingBalanceCount = accounts.filter(item => item.balance === null).length
  const total = accounts.length > 0 && missingBalanceCount === 0 ? knownTotal : null
  const active = data.goals.filter(goal => goal.status === 'active' && (asOf === undefined || goal.createdOn <= asOf))
  const ordered = [...active.filter(goal => goal.kind === 'goal'), ...active.filter(goal => goal.kind === 'emergency')]
  const purposes = ordered.map(goal => ({ goal, saved: goalSaved(goal, data.goalMovements, asOf) }))
  const assigned = sumMinor(purposes.map(purpose => purpose.saved))
  return { accounts, knownTotal, missingBalanceCount, total, purposes, assigned, unassigned: total === null ? null : total - assigned }
}
