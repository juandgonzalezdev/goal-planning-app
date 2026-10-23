import type { YearMonth } from '../calendar'
import type { MoneyAmount } from '../goalAmounts'
import { billsForMonth, summarizeBills } from './bills'
import { summarizeDebts } from './debts'
import { householdIncomeFor } from './income'
import type { FinanceData } from './types'

/** The four numbers at the top of Home, for one month. */
export interface MonthlyOverview {
  month: YearMonth
  householdIncome: MoneyAmount
  /** Known bill amounts this month. */
  monthlyCommitments: MoneyAmount
  /** Bills this month without a known amount (so commitments may be higher). */
  unknownBillCount: number
  leftToPay: MoneyAmount
  totalDebt: MoneyAmount
}

export function monthlyOverview(data: FinanceData, month: YearMonth): MonthlyOverview {
  const bills = summarizeBills(billsForMonth(data, month))
  return {
    month,
    householdIncome: householdIncomeFor(data, month),
    monthlyCommitments: bills.knownTotal,
    unknownBillCount: bills.unknownCount,
    leftToPay: bills.leftToPay,
    totalDebt: summarizeDebts(data).total,
  }
}
