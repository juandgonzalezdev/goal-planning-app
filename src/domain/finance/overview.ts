import { addDays, addMonthsToYearMonth, yearMonthOf, type YearMonth } from '../calendar'
import type { CalendarDate } from '../goalTime'
import type { MoneyAmount } from '../goalAmounts'
import { billsForMonth, summarizeBills, type BillOccurrence, type BillSummary } from './bills'
import { summarizeDebts } from './debts'
import { householdIncomeFor, monthIncome, type MonthIncome } from './income'
import type { FinanceData } from './types'

/** The numbers at the top of Home, for one month. */
export interface MonthlyOverview {
  month: YearMonth
  /** Income received this month (what Yearly Net Income counts). */
  householdIncome: MoneyAmount
  /** Received and expected income, kept apart. */
  income: MonthIncome
  /** Known bill amounts this month: planned, not necessarily paid. */
  monthlyCommitments: MoneyAmount
  /** Bills this month without a known amount (so commitments may be higher). */
  unknownBillCount: number
  /**
   * Income (received + expected) minus the known bills, or null with no
   * income. It is not money available to spend: daily costs are not
   * recorded and no future contribution is planned.
   */
  incomeMinusBills: MoneyAmount | null
  leftToPay: MoneyAmount
  bills: BillSummary
  totalDebt: MoneyAmount
}

export function monthlyOverview(data: FinanceData, month: YearMonth): MonthlyOverview {
  const bills = summarizeBills(billsForMonth(data, month))
  const income = monthIncome(data, month)
  return {
    month,
    householdIncome: householdIncomeFor(data, month),
    income,
    monthlyCommitments: bills.knownTotal,
    unknownBillCount: bills.unknownCount,
    incomeMinusBills: income.basis === 'none' ? null : income.total - bills.knownTotal,
    leftToPay: bills.leftToPay,
    bills,
    totalDebt: summarizeDebts(data).total,
  }
}

/**
 * What Left to Pay says about a month. "All paid" needs every bill paid:
 * an unpaid bill with an unknown amount is never treated as 0.
 */
export type LeftToPayStatus =
  | { status: 'no-bills' }
  | { status: 'all-paid' }
  | { status: 'amounts-missing'; leftToPay: MoneyAmount; unknownCount: number }
  | { status: 'bills-left'; leftToPay: MoneyAmount; count: number }

export function leftToPayStatus(summary: BillSummary): LeftToPayStatus {
  if (summary.count === 0) return { status: 'no-bills' }
  if (summary.unpaidUnknownCount > 0) return { status: 'amounts-missing', leftToPay: summary.leftToPay, unknownCount: summary.unpaidUnknownCount }
  if (summary.paidCount === summary.count) return { status: 'all-paid' }
  return { status: 'bills-left', leftToPay: summary.leftToPay, count: summary.count - summary.paidCount }
}

/** How far ahead Coming up looks, from today. */
export const COMING_UP_DAYS = 7

/**
 * What is still to pay in a month, with an explicit reference:
 * - the month of today: overdue (due before today) and due later, from today;
 *   plus Coming up, the next month's unpaid bills due within the next seven
 *   days, kept apart and never added to this month's total;
 * - a past month: its bills not marked as paid, nothing counted from today;
 * - a future month: its bills planned (not paid yet), no overdue, no Coming up.
 * Unpaid bills of earlier months are never brought into the month shown.
 */
export interface ToPay {
  period: 'current' | 'past' | 'future'
  overdue: BillOccurrence[]
  /** current: due today or later. past: not marked as paid. future: planned. */
  open: BillOccurrence[]
  comingUp: { month: YearMonth; from: CalendarDate; to: CalendarDate; bills: BillOccurrence[] } | null
}

export function toPay(data: Pick<FinanceData, 'bills' | 'billMonths'>, month: YearMonth, today: CalendarDate): ToPay {
  const unpaid = billsForMonth(data, month).filter(occurrence => !occurrence.paid)
  const current = yearMonthOf(today)
  if (month < current) return { period: 'past', overdue: [], open: unpaid, comingUp: null }
  if (month > current) return { period: 'future', overdue: [], open: unpaid, comingUp: null }
  const until = addDays(today, COMING_UP_DAYS)
  const next = addMonthsToYearMonth(month, 1)
  const ahead = until.slice(0, 7) === next
    ? billsForMonth(data, next).filter(occurrence => !occurrence.paid && occurrence.dueDate <= until)
    : []
  return {
    period: 'current',
    overdue: unpaid.filter(occurrence => occurrence.dueDate < today),
    open: unpaid.filter(occurrence => occurrence.dueDate >= today),
    comingUp: ahead.length > 0 ? { month: next, from: `${next}-01`, to: until, bills: ahead } : null,
  }
}
