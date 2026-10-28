import type { YearMonth } from '../calendar'
import type { CalendarDate } from '../goalTime'
import type { MoneyAmount } from '../goalAmounts'
import { billsForMonth } from './bills'
import { BILL_SPENDING_CATEGORY } from './spending'
import { MOVEMENT_EFFECT_NAMES, type FinanceData, type Id, type MovementEffect, type SpendingCategory } from './types'

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
  /** What the app says about it (effect, account, status). Never the user's own note. */
  detail: string
  /** The user's own words about this record, kept apart from what the app says. */
  note?: string
  /** What a goal movement did to Savings (savings entries from a movement only). */
  effect?: MovementEffect
  category: SpendingCategory | null
  /** Accounts and debts the entry touches, for the account filter. */
  accountIds: Id[]
  ref: ActivityRef
  /** Loan payments with a recorded split. */
  split?: { principal: MoneyAmount; interest: MoneyAmount }
  /** When the record was entered in the app, if known (never invented for older records). */
  recordedAt?: string
  /** Its place in its own list: later is newer. Orders same-day records that have no recordedAt. */
  sequence: number
}

export function activityLog(data: FinanceData): ActivityEntry[] {
  const accountName = (id: Id | undefined) => (id ? data.moneyAccounts.find(a => a.id === id)?.name ?? data.debts.find(d => d.id === id)?.name ?? 'Deleted account' : null)
  const entries: ActivityEntry[] = []

  data.income.forEach((entry, sequence) => {
    const source = data.incomeSources.find(s => s.id === entry.sourceId)
    entries.push({
      key: `income:${entry.id}`, type: 'income', date: entry.receivedOn, month: entry.month, amount: entry.amount,
      label: source?.name ?? entry.note ?? 'Income',
      detail: [entry.extraordinary ? 'One-off income' : null, accountName(entry.accountId) && `Into ${accountName(entry.accountId)}`].filter(Boolean).join(' · '),
      ...(source && entry.note ? { note: entry.note } : {}),
      category: null, accountIds: entry.accountId ? [entry.accountId] : [], ref: { kind: 'income', id: entry.id },
      recordedAt: entry.recordedAt, sequence,
    })
  })

  for (const month of [...new Set(data.billMonths.filter(r => r.paid).map(r => r.month))]) {
    for (const occurrence of billsForMonth(data, month)) {
      if (!occurrence.paid) continue
      const sequence = data.billMonths.findIndex(r => r.billId === occurrence.bill.id && r.month === month)
      const record = data.billMonths[sequence] as (typeof data.billMonths)[number] | undefined
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
        recordedAt: record?.recordedAt, sequence,
        ...(hasSplit && record?.interest !== undefined ? { split: { principal: (occurrence.amount as MoneyAmount) - record.interest, interest: record.interest } } : {}),
      })
    }
  }

  data.expenses.forEach((expense, sequence) => {
    const onCard = data.debts.some(debt => debt.id === expense.accountId)
    entries.push({
      key: `expense:${expense.id}`, type: 'spending', date: expense.date, month: expense.date.slice(0, 7), amount: -expense.amount,
      label: expense.description || expense.category,
      detail: [expense.category, expense.nature === 'exceptional' ? 'One-off' : expense.nature === 'annual' ? 'Once a year' : null,
        onCard ? `On ${accountName(expense.accountId)} (new card debt)` : `From ${accountName(expense.accountId)}`].filter(Boolean).join(' · '),
      category: expense.category, accountIds: [expense.accountId], ref: { kind: 'expense', id: expense.id },
      recordedAt: expense.recordedAt, sequence,
    })
  })

  data.transfers.forEach((transfer, sequence) => {
    entries.push({
      key: `transfer:${transfer.id}`, type: 'transfer', date: transfer.date, month: transfer.date.slice(0, 7), amount: transfer.amount,
      label: `${accountName(transfer.fromAccountId)} → ${accountName(transfer.toAccountId)}`, detail: 'Not income or spending',
      ...(transfer.note ? { note: transfer.note } : {}),
      category: null, accountIds: [transfer.fromAccountId, transfer.toAccountId], ref: { kind: 'transfer', id: transfer.id },
      recordedAt: transfer.recordedAt, sequence,
    })
  })

  const goalName = (id: Id) => data.goals.find(goal => goal.id === id)?.name ?? 'Deleted goal'
  data.goalMovements.forEach((movement, sequence) => {
    entries.push({
      key: `movement:${movement.id}`, type: 'savings', date: movement.date, month: movement.date.slice(0, 7), amount: movement.amount,
      label: goalName(movement.goalId), detail: savingsEffectText(movement.effect, accountName(movement.accountId)), category: null,
      ...(movement.note ? { note: movement.note } : {}), ...(isMovementEffect(movement.effect) ? { effect: movement.effect } : {}),
      accountIds: movement.accountId ? [movement.accountId] : [], ref: { kind: 'movement', id: movement.id, goalId: movement.goalId },
      recordedAt: movement.recordedAt, sequence,
    })
  })
  data.goals.filter(g => g.openingBalance > 0).forEach((goal, sequence) => {
    entries.push({
      key: `opening:${goal.id}`, type: 'savings', date: goal.createdOn, month: goal.createdOn.slice(0, 7), amount: goal.openingBalance,
      label: goal.name, detail: 'Already saved when it was added', category: null, accountIds: [], ref: { kind: 'opening', goalId: goal.id }, sequence,
    })
  })

  data.balances.forEach((snapshot, sequence) => {
    entries.push({
      key: `balance:${snapshot.id}`, type: 'balance', date: snapshot.asOf, month: snapshot.asOf.slice(0, 7), amount: snapshot.amount,
      label: accountName(snapshot.accountId) ?? 'Deleted account', detail: snapshot.source === 'entered' ? 'Balance entered' : 'From a goal movement',
      category: null, accountIds: [snapshot.accountId], ref: { kind: 'balance', id: snapshot.id },
      recordedAt: snapshot.recordedAt, sequence,
    })
  })

  return entries.sort(newestFirst)
}

const isMovementEffect = (effect: unknown): effect is MovementEffect => typeof effect === 'string' && effect in MOVEMENT_EFFECT_NAMES

/**
 * What a savings movement did, from the movement itself (never guessed
 * from the sign of the amount). A movement without a known effect gets a
 * neutral description.
 */
function savingsEffectText(effect: unknown, account: string | null): string {
  switch (effect) {
    case 'new-savings': return `${MOVEMENT_EFFECT_NAMES['new-savings']}${account ? ` · Into ${account}` : ''}`
    case 'assigned': return `${MOVEMENT_EFFECT_NAMES.assigned} · Savings total unchanged`
    case 'unassigned': return `${MOVEMENT_EFFECT_NAMES.unassigned} · Savings total unchanged`
    case 'taken-out': return `${MOVEMENT_EFFECT_NAMES['taken-out']}${account ? ` · From ${account}` : ''}`
    default: return 'Savings movement (where it came from is not recorded)'
  }
}

// Same day, no entry time: an end-of-day balance first, then savings, transfers, spending, bills and income (the order used so far).
const LEGACY_ORDER: Record<ActivityType, number> = { balance: 0, savings: 1, transfer: 2, spending: 3, bill: 4, income: 5 }
// Same entry time (one action that made two records): the action first, then the balance it updated.
const SAME_TIME_ORDER: Record<ActivityType, number> = { income: 0, bill: 1, spending: 2, transfer: 3, savings: 4, balance: 5 }

/**
 * Newest first, and always the same order for the same records:
 * 1. by date; 2. on the same date, records with an entry time before
 * older ones without (they were entered later), newest time first;
 * 3. then by type, and by their place in their own list (later is newer).
 */
export function newestFirst(a: ActivityEntry, b: ActivityEntry): number {
  const byDate = b.date.localeCompare(a.date)
  if (byDate !== 0) return byDate
  if (a.recordedAt !== undefined || b.recordedAt !== undefined) {
    if (a.recordedAt === undefined) return 1
    if (b.recordedAt === undefined) return -1
    const byTime = Date.parse(b.recordedAt) - Date.parse(a.recordedAt)
    if (byTime !== 0) return byTime
    const byAction = SAME_TIME_ORDER[a.type] - SAME_TIME_ORDER[b.type]
    if (byAction !== 0) return byAction
  } else {
    const byType = LEGACY_ORDER[a.type] - LEGACY_ORDER[b.type]
    if (byType !== 0) return byType
  }
  return b.sequence - a.sequence || a.key.localeCompare(b.key)
}

export type HistoryPeriod = { kind: 'all' } | { kind: 'year'; year: number } | { kind: 'month'; month: YearMonth }

export interface HistoryFilter {
  period: HistoryPeriod
  /** Words to find in the name or the note (any case; spaces around them are ignored). '' finds everything. */
  search: string
  type: ActivityType | 'all'
  category: SpendingCategory | 'all'
  accountId: Id | 'all'
}

export const NO_FILTER: HistoryFilter = { period: { kind: 'all' }, search: '', type: 'all', category: 'all', accountId: 'all' }

/** The search as it is matched: without the spaces around it, in lower case. */
export const searchText = (search: string) => search.trim().toLocaleLowerCase()

export function matchesSearch(entry: ActivityEntry, search: string): boolean {
  const words = searchText(search)
  if (words === '') return true
  return entry.label.toLocaleLowerCase().includes(words) || (entry.note ?? '').toLocaleLowerCase().includes(words)
}

export function inPeriod(entry: ActivityEntry, period: HistoryPeriod): boolean {
  if (period.kind === 'year') return entry.month.startsWith(`${period.year}-`)
  if (period.kind === 'month') return entry.month === period.month
  return true
}

/** Only these types have a category: with any other type, a category filter can match nothing. */
export const typeHasCategory = (type: ActivityType | 'all') => type === 'all' || type === 'spending' || type === 'bill'

export function filterActivity(entries: readonly ActivityEntry[], filter: HistoryFilter): ActivityEntry[] {
  return entries.filter(entry => {
    if (!inPeriod(entry, filter.period)) return false
    if (filter.type !== 'all' && entry.type !== filter.type) return false
    if (filter.category !== 'all' && entry.category !== filter.category) return false
    if (filter.accountId !== 'all' && !entry.accountIds.includes(filter.accountId)) return false
    return matchesSearch(entry, filter.search)
  })
}

export interface HistoryDay {
  date: CalendarDate
  entries: ActivityEntry[]
}

export interface HistoryMonth {
  /** The month the entries count for (a bill's own month, as the period filter uses). */
  month: YearMonth
  entries: ActivityEntry[]
}

/**
 * Entries (already newest first) in groups by the month they count for,
 * newest month first. The order inside each month is kept as it was.
 */
export function groupByMonth(entries: readonly ActivityEntry[]): HistoryMonth[] {
  const groups = new Map<YearMonth, ActivityEntry[]>()
  for (const entry of entries) {
    const group = groups.get(entry.month)
    if (group) group.push(entry)
    else groups.set(entry.month, [entry])
  }
  return [...groups].map(([month, list]) => ({ month, entries: list })).sort((a, b) => b.month.localeCompare(a.month))
}

/** Entries in groups by date, keeping their order (a bill paid in another month keeps its own date). */
export function groupByDay(entries: readonly ActivityEntry[]): HistoryDay[] {
  const days: HistoryDay[] = []
  for (const entry of entries) {
    const last = days[days.length - 1]
    if (last && last.date === entry.date) last.entries.push(entry)
    else days.push({ date: entry.date, entries: [entry] })
  }
  return days
}
