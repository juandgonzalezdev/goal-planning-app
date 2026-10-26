import type { YearMonth } from '../calendar'
import type { CalendarDate } from '../goalTime'
import type { MoneyAmount } from '../goalAmounts'
import { billsForMonth } from './bills'
import { BILL_SPENDING_CATEGORY } from './spending'
import type { FinanceData, Id, SpendingCategory } from './types'

/**
 * Financial History: every record as one list, newest first. Each entry
 * keeps its type, so a payment, an income, a transfer, a savings
 * movement and a balance are never mixed up, and its source, so it can be
 * opened and edited. Nothing is estimated.
 */
export const ACTIVITY_TYPES = ['income', 'bill', 'spending', 'transfer', 'savings', 'balance'] as const
export type ActivityType = (typeof ACTIVITY_TYPES)[number]

export type ActivityRef =
  | { kind: 'income'; id: Id }
  | { kind: 'bill'; billId: Id; month: YearMonth }
  | { kind: 'expense'; id: Id }
  | { kind: 'transfer'; id: Id }
  | { kind: 'movement'; id: Id; goalId: Id }
  | { kind: 'opening'; goalId: Id }
  | { kind: 'balance'; id: Id }

export interface ActivityEntry {
  key: string
  type: ActivityType
  date: CalendarDate
  /** The month it counts for (a bill's own month; otherwise the month of the date). */
  month: YearMonth
  /** Money in (+) or out (−) for income, bills and spending; the moved or entered amount otherwise. null when not known. */
  amount: MoneyAmount | null
  label: string
  detail: string
  category: SpendingCategory | null
  /** Accounts and debts the entry touches, for the account filter. */
  accountIds: Id[]
  ref: ActivityRef
  /** Loan payments with a recorded split. */
  split?: { principal: MoneyAmount; interest: MoneyAmount }
}

export function activityLog(data: FinanceData): ActivityEntry[] {
  const accountName = (id: Id | undefined) => (id ? data.moneyAccounts.find(a => a.id === id)?.name ?? data.debts.find(d => d.id === id)?.name ?? 'Deleted account' : null)
  const entries: ActivityEntry[] = []

  for (const entry of data.income) {
    const source = data.incomeSources.find(s => s.id === entry.sourceId)
    entries.push({
      key: `income:${entry.id}`, type: 'income', date: entry.receivedOn, month: entry.month, amount: entry.amount,
      label: source?.name ?? entry.note ?? 'Income',
      detail: [entry.extraordinary ? 'One-off income' : null, source && entry.note ? entry.note : null, accountName(entry.accountId) && `Into ${accountName(entry.accountId)}`].filter(Boolean).join(' · '),
      category: null, accountIds: entry.accountId ? [entry.accountId] : [], ref: { kind: 'income', id: entry.id },
    })
  }

  for (const month of [...new Set(data.billMonths.filter(r => r.paid).map(r => r.month))]) {
    for (const occurrence of billsForMonth(data, month)) {
      if (!occurrence.paid) continue
      const record = data.billMonths.find(r => r.billId === occurrence.bill.id && r.month === month)
      const debt = occurrence.bill.debtId ? data.debts.find(d => d.id === occurrence.bill.debtId) : undefined
      const hasSplit = debt?.kind === 'loan' && record?.interest !== undefined && occurrence.amount !== null
      const split = debt?.kind === 'loan'
        ? hasSplit ? 'Only the interest is spending' : 'Interest split not known'
        : debt ? 'Pays the card back (not spending)' : null
      const late = record?.paidOn && record.paidOn > occurrence.dueDate ? 'Paid late' : null
      entries.push({
        key: `bill:${occurrence.bill.id}:${month}`, type: 'bill', date: record?.paidOn ?? occurrence.dueDate, month,
        amount: occurrence.amount === null ? null : -occurrence.amount, label: occurrence.bill.name,
        detail: [late, split, accountName(record?.paidFrom) && `From ${accountName(record?.paidFrom)}`].filter(Boolean).join(' · '),
        category: BILL_SPENDING_CATEGORY[occurrence.bill.category],
        accountIds: [record?.paidFrom, debt?.id].filter((id): id is Id => !!id), ref: { kind: 'bill', billId: occurrence.bill.id, month },
        ...(hasSplit && record?.interest !== undefined ? { split: { principal: (occurrence.amount as MoneyAmount) - record.interest, interest: record.interest } } : {}),
      })
    }
  }

  for (const expense of data.expenses) {
    const onCard = data.debts.some(debt => debt.id === expense.accountId)
    entries.push({
      key: `expense:${expense.id}`, type: 'spending', date: expense.date, month: expense.date.slice(0, 7), amount: -expense.amount,
      label: expense.description || expense.category,
      detail: [expense.category, expense.nature === 'exceptional' ? 'One-off' : expense.nature === 'annual' ? 'Once a year' : null,
        onCard ? `On ${accountName(expense.accountId)} (new card debt)` : `From ${accountName(expense.accountId)}`].filter(Boolean).join(' · '),
      category: expense.category, accountIds: [expense.accountId], ref: { kind: 'expense', id: expense.id },
    })
  }

  for (const transfer of data.transfers) {
    entries.push({
      key: `transfer:${transfer.id}`, type: 'transfer', date: transfer.date, month: transfer.date.slice(0, 7), amount: transfer.amount,
      label: transfer.note || 'Transfer', detail: `${accountName(transfer.fromAccountId)} → ${accountName(transfer.toAccountId)} · Not income or spending`,
      category: null, accountIds: [transfer.fromAccountId, transfer.toAccountId], ref: { kind: 'transfer', id: transfer.id },
    })
  }

  const goalName = (id: Id) => data.goals.find(goal => goal.id === id)?.name ?? 'Deleted goal'
  for (const movement of data.goalMovements) {
    entries.push({
      key: `movement:${movement.id}`, type: 'savings', date: movement.date, month: movement.date.slice(0, 7), amount: movement.amount,
      label: goalName(movement.goalId), detail: movement.note, category: null,
      accountIds: movement.accountId ? [movement.accountId] : [], ref: { kind: 'movement', id: movement.id, goalId: movement.goalId },
    })
  }
  for (const goal of data.goals.filter(g => g.openingBalance > 0)) {
    entries.push({
      key: `opening:${goal.id}`, type: 'savings', date: goal.createdOn, month: goal.createdOn.slice(0, 7), amount: goal.openingBalance,
      label: goal.name, detail: 'Already saved when it was added', category: null, accountIds: [], ref: { kind: 'opening', goalId: goal.id },
    })
  }

  for (const snapshot of data.balances) {
    entries.push({
      key: `balance:${snapshot.id}`, type: 'balance', date: snapshot.asOf, month: snapshot.asOf.slice(0, 7), amount: snapshot.amount,
      label: accountName(snapshot.accountId) ?? 'Deleted account', detail: snapshot.source === 'entered' ? 'Balance entered' : 'From a goal movement',
      category: null, accountIds: [snapshot.accountId], ref: { kind: 'balance', id: snapshot.id },
    })
  }

  const order: Record<ActivityType, number> = { balance: 0, savings: 1, transfer: 2, spending: 3, bill: 4, income: 5 }
  return entries.sort((a, b) => b.date.localeCompare(a.date) || order[a.type] - order[b.type] || a.key.localeCompare(b.key))
}

export type HistoryPeriod = { kind: 'all' } | { kind: 'year'; year: number } | { kind: 'month'; month: YearMonth }

export interface HistoryFilter {
  period: HistoryPeriod
  type: ActivityType | 'all'
  category: SpendingCategory | 'all'
  accountId: Id | 'all'
}

export const NO_FILTER: HistoryFilter = { period: { kind: 'all' }, type: 'all', category: 'all', accountId: 'all' }

export function filterActivity(entries: readonly ActivityEntry[], filter: HistoryFilter): ActivityEntry[] {
  return entries.filter(entry => {
    const { period } = filter
    if (period.kind === 'year' && !entry.month.startsWith(`${period.year}-`)) return false
    if (period.kind === 'month' && entry.month !== period.month) return false
    if (filter.type !== 'all' && entry.type !== filter.type) return false
    if (filter.category !== 'all' && entry.category !== filter.category) return false
    if (filter.accountId !== 'all' && !entry.accountIds.includes(filter.accountId)) return false
    return true
  })
}
