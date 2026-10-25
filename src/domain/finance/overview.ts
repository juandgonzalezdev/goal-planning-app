import type { YearMonth } from '../calendar'
import type { MoneyAmount } from '../goalAmounts'
import { billsForMonth, summarizeBills, type BillSummary } from './bills'
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
