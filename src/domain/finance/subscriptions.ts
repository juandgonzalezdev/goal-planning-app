import { addMonthsToYearMonth, dateInMonth, yearMonthOf, type YearMonth } from '../calendar'
import type { CalendarDate } from '../goalTime'
import type { MoneyAmount } from '../goalAmounts'
import { sumMinor } from '../money'
import { isBillDueIn, usualAmountFor } from './bills'
import { monthResult, monthSpending } from './spending'
import type { FinanceData, Id, RecurringBill, SpendingCategory, SubscriptionRating } from './types'

/**
 * Subscriptions and what-if simulations. A simulation only calculates: it
 * never changes a record. Applying it is a separate, confirmed step, and
 * even then only future months change: payments already made stay.
 * Money not spent is not saved automatically either: Savings only grow
 * when the user records savings.
 */

/** How far ahead the app looks for the next charges (two years covers a yearly plan twice). */
const LOOK_AHEAD_MONTHS = 24

/** A subscription is a bill in the Subscriptions category that has not ended. */
export function activeSubscriptions(data: Pick<FinanceData, 'bills'>, today: CalendarDate): RecurringBill[] {
  const month = yearMonthOf(today)
  return data.bills.filter(bill => bill.category === 'Subscriptions' && (bill.endMonth === null || bill.endMonth >= month))
}

export interface UpcomingCharge {
  month: YearMonth
  dueDate: CalendarDate
  /** null when the amount is not known. */
  amount: MoneyAmount | null
}

/**
 * The next charges of a bill after `today`: months where it is due, from
 * the current month on (the current month only if its due date has not
 * passed and it is not paid yet).
 */
export function upcomingCharges(data: Pick<FinanceData, 'bills' | 'billMonths'>, bill: RecurringBill, today: CalendarDate, count: number): UpcomingCharge[] {
  const charges: UpcomingCharge[] = []
  const first = yearMonthOf(today)
  for (let i = 0; i <= LOOK_AHEAD_MONTHS && charges.length < count; i++) {
    const month = addMonthsToYearMonth(first, i)
    if (!isBillDueIn(bill, month)) continue
    const dueDate = dateInMonth(month, bill.dueDay)
    const record = data.billMonths.find(r => r.billId === bill.id && r.month === month)
    if (record?.paid || dueDate <= today) continue
    charges.push({ month, dueDate, amount: record?.amount !== undefined ? record.amount : usualAmountFor(bill, month) })
  }
  return charges
}

export type SimulationKind = 'pause' | 'cancel'

export interface Simulation {
  kind: SimulationKind
  billId: Id
  /** The charges that would not happen. */
  charges: UpcomingCharge[]
  /** The known amounts of those charges, minus a known restart fee for a pause. */
  reduction: MoneyAmount
  /** The known restart cost taken off (0 when there is none); null when it is not known. */
  restartFee: MoneyAmount | null
  /** Charges whose amount is not known: they are not in `reduction`. */
  unknownCount: number
  /** False when the service says it cannot be paused or cancelled. */
  allowed: boolean | null
}

/**
 * Pausing for `periods` billing periods (months for a monthly bill, years
 * for a yearly one), or cancelling (the charges of the next 12 months).
 * The planned spending that would not happen is the sum of those charges;
 * a known restart fee is taken off a pause.
 */
export function simulateSubscription(data: Pick<FinanceData, 'bills' | 'billMonths'>, billId: Id, kind: SimulationKind, today: CalendarDate, periods = 3): Simulation | null {
  const bill = data.bills.find(b => b.id === billId)
  if (!bill) return null
  const count = kind === 'pause' ? periods : bill.frequency === 'yearly' ? 1 : 12
  const charges = upcomingCharges(data, bill, today, count)
  const known = charges.flatMap(charge => (charge.amount === null ? [] : [charge.amount]))
  const fee = kind === 'pause' ? bill.subscription?.restartFee ?? null : 0
  return {
    kind, billId, charges,
    reduction: Math.max(0, sumMinor(known) - (fee ?? 0)),
    restartFee: fee,
    unknownCount: charges.length - known.length,
    allowed: kind === 'pause' ? bill.subscription?.canPause ?? null : bill.subscription?.canCancel ?? null,
  }
}

/** Applies a confirmed pause: those future months are not due. Paid months never change. */
export function applyPause(data: FinanceData, simulation: Simulation): FinanceData {
  const months = simulation.charges.map(charge => charge.month)
  return {
    ...data,
    bills: data.bills.map(bill => (bill.id !== simulation.billId ? bill
      : { ...bill, pausedMonths: [...new Set([...(bill.pausedMonths ?? []), ...months])].sort() })),
  }
}

/**
 * Applies a confirmed cancellation: the last month due becomes the month
 * before the next charge. Months already paid stay as they were.
 */
export function applyCancel(data: FinanceData, simulation: Simulation): FinanceData {
  const next = simulation.charges[0]
  if (!next) return data
  return {
    ...data,
    bills: data.bills.map(bill => {
      if (bill.id !== simulation.billId) return bill
      const last = addMonthsToYearMonth(next.month, -1)
      return { ...bill, endMonth: last < bill.startMonth ? bill.startMonth : last }
    }),
  }
}

/** Sets the user's own classification of a subscription (or clears it with null). */
export function rateSubscription(data: FinanceData, billId: Id, rating: SubscriptionRating | null): FinanceData {
  return {
    ...data,
    bills: data.bills.map(bill => (bill.id !== billId ? bill
      : { ...bill, subscription: { canPause: bill.subscription?.canPause ?? null, canCancel: bill.subscription?.canCancel ?? null, ...bill.subscription, rating } })),
  }
}

export type Ease = 'easy' | 'unknown' | 'hard'

export interface Opportunity {
  key: string
  kind: 'subscription' | 'flexible-spending'
  label: string
  /** For a subscription: the next 12 months of charges. For flexible spending: 12 × the monthly average. */
  yearly: MoneyAmount
  monthly: MoneyAmount
  ease: Ease
  billId?: Id
  category?: SpendingCategory
  rating?: SubscriptionRating | null
}

/** Spending that is often flexible. Listed to review, never assumed to be unnecessary. */
export const FLEXIBLE_CATEGORIES: readonly SpendingCategory[] = ['Eating Out', 'Leisure', 'Shopping']

const EASE_WEIGHT: Record<Ease, number> = { easy: 1, unknown: 0.6, hard: 0.3 }

/**
 * Things the user could review, biggest effect and easiest change first:
 * subscriptions the user did not mark as needed (by their next 12 months
 * of charges, and whether they can be cancelled), and flexible spending
 * (by its 6-month average). It is a list to look at, not advice.
 */
export function opportunities(data: FinanceData, today: CalendarDate): Opportunity[] {
  const list: Opportunity[] = []
  for (const bill of activeSubscriptions(data, today)) {
    if (bill.subscription?.rating === 'needed') continue
    const simulation = simulateSubscription(data, bill.id, 'cancel', today)
    if (!simulation || simulation.reduction === 0) continue
    const canCancel = bill.subscription?.canCancel ?? null
    list.push({ key: `subscription:${bill.id}`, kind: 'subscription', label: bill.name, yearly: simulation.reduction,
      monthly: Math.round(simulation.reduction / 12), ease: canCancel === null ? 'unknown' : canCancel ? 'easy' : 'hard',
      billId: bill.id, rating: bill.subscription?.rating ?? null })
  }
  const through = yearMonthOf(today)
  const months = Array.from({ length: 6 }, (_, i) => addMonthsToYearMonth(through, i - 5))
  const items = months.flatMap(month => monthSpending(data, month).items)
  for (const category of FLEXIBLE_CATEGORIES) {
    const regular = items.filter(item => item.category === category && item.nature === 'regular')
    if (regular.length === 0) continue
    const monthly = Math.round(sumMinor(regular.map(item => item.amount)) / months.length)
    list.push({ key: `flexible:${category}`, kind: 'flexible-spending', label: category, yearly: monthly * 12, monthly, ease: 'unknown', category })
  }
  return list.sort((a, b) => b.yearly * EASE_WEIGHT[b.ease] - a.yearly * EASE_WEIGHT[a.ease] || a.label.localeCompare(b.label))
}

/** The largest monthly deficit of a year (as a positive amount), so a small saving is seen in proportion. null when no month was in deficit. */
export function largestDeficit(data: FinanceData, year: number, today: CalendarDate): { month: YearMonth; amount: MoneyAmount } | null {
  let worst: { month: YearMonth; amount: MoneyAmount } | null = null
  for (let m = 1; m <= 12; m++) {
    const month = `${year}-${String(m).padStart(2, '0')}`
    if (month > yearMonthOf(today)) break
    const { result } = monthResult(data, month, today)
    if (result < 0 && (!worst || -result > worst.amount)) worst = { month, amount: -result }
  }
  return worst
}

/** Sets what the user knows about pausing or cancelling a subscription (null: not known). */
export function setSubscriptionOptions(data: FinanceData, billId: Id, options: { canPause?: boolean | null; canCancel?: boolean | null }): FinanceData {
  return {
    ...data,
    bills: data.bills.map(bill => (bill.id !== billId ? bill
      : { ...bill, subscription: { canPause: null, canCancel: null, rating: null, ...bill.subscription, ...options } })),
  }
}
