import { monthsOfYear, yearMonthOf, type YearMonth } from '../calendar'
import type { CalendarDate } from '../goalTime'
import type { MoneyAmount } from '../goalAmounts'
import { sumMinor } from '../money'
import { summarizeDebts } from './debts'
import { savingsSummary } from './savings'
import { monthEnd, monthResult } from './spending'
import type { FinanceData } from './types'

export interface YearMonthRow {
  month: YearMonth
  /** False for a month after today: nothing in it has happened yet. */
  started: boolean
  income: MoneyAmount
  extraordinaryIncome: MoneyAmount
  spending: MoneyAmount
  result: MoneyAmount
  /** Savings at the end of the month, from the balances entered by then (null when not known). */
  savingsAtEnd: MoneyAmount | null
  /** Debt at the end of the month, from the balances entered by then. */
  debtAtEnd: MoneyAmount
}

export interface YearSummary {
  year: number
  months: YearMonthRow[]
  income: MoneyAmount
  extraordinaryIncome: MoneyAmount
  spending: MoneyAmount
  result: MoneyAmount
  deficitMonths: YearMonth[]
}

/**
 * The year month by month, from the records. Savings and debt use the
 * balances entered by the end of each month: they are never worked back
 * from today's balance.
 */
export function yearSummary(data: FinanceData, year: number, today: CalendarDate): YearSummary {
  const current = yearMonthOf(today)
  const months = monthsOfYear(year).map(month => {
    const r = monthResult(data, month, today)
    const end = monthEnd(month) < today ? monthEnd(month) : today
    const started = month <= current
    return {
      month, started,
      income: r.income.total, extraordinaryIncome: r.income.extraordinary, spending: r.spending.total, result: r.result,
      savingsAtEnd: started ? savingsSummary(data, end).total : null,
      debtAtEnd: started ? summarizeDebts(data, end).total : 0,
    }
  })
  const started = months.filter(row => row.started)
  return {
    year, months,
    income: sumMinor(started.map(row => row.income)),
    extraordinaryIncome: sumMinor(started.map(row => row.extraordinaryIncome)),
    spending: sumMinor(started.map(row => row.spending)),
    result: sumMinor(started.map(row => row.result)),
    deficitMonths: started.filter(row => row.result < 0).map(row => row.month),
  }
}
