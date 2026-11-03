import { addMonthsToYearMonth, monthsOfYear, yearMonthOf, type YearMonth } from '../calendar'
import type { CalendarDate } from '../goalTime'
import type { MoneyAmount } from '../goalAmounts'
import { calculatePayoff } from '../loanPayoff'
import { balanceHistory } from './balances'
import { goalMovementsOf } from './pots'
import { savingsSummary } from './savings'
import { monthIncome } from './income'
import { incomeReceived, monthEnd, monthSpending } from './spending'
import type { BalanceSnapshot, FinanceData, Goal, GoalMovement, Id, MoneyAccount } from './types'

/**
 * The series the four charts draw (Rumbo de diseño §7). They only read
 * what was recorded: a month with nothing entered stays empty (null) and
 * is never filled from its neighbours, and estimates are kept apart from
 * records. Nothing here is saved.
 */

/** The `count` months that end with the month of `today`, oldest first. */
export const monthsUpTo = (today: CalendarDate, count: number): YearMonth[] =>
  Array.from({ length: count }, (_, index) => addMonthsToYearMonth(yearMonthOf(today), index - count + 1))

/**
 * Runs of consecutive known values, as index lists. A line joins only the
 * points of one run, so it never crosses a month with nothing entered;
 * a run of one is a point with no line.
 */
export function knownRuns(values: readonly (number | null)[]): number[][] {
  const runs: number[][] = []
  let run: number[] = []
  values.forEach((value, index) => {
    if (value === null) { if (run.length) runs.push(run); run = [] } else run.push(index)
  })
  if (run.length) runs.push(run)
  return runs
}

export interface SavingsPoint {
  month: YearMonth
  /** Total savings at the end of the month, only in a month with a savings balance entered (and every savings account known). */
  total: MoneyAmount | null
  /** The savings balances entered in this month, latest first per account. */
  entered: { account: MoneyAccount; snapshot: BalanceSnapshot }[]
}

/**
 * Savings over time: one point for each month in which a savings balance
 * was entered (typed or from a goal movement), with the total of savings
 * accounts at the end of that month, as Money counts it. Months with no
 * balance entered are gaps, even though Money still shows the last known
 * balance then: the chart shows records, not carried-over figures.
 */
export function savingsSeries(data: Pick<FinanceData, 'moneyAccounts' | 'balances' | 'goals' | 'goalMovements'>, months: readonly YearMonth[], today: CalendarDate): SavingsPoint[] {
  const accounts = data.moneyAccounts.filter(account => account.kind === 'savings')
  return months.map(month => {
    const entered = accounts.flatMap(account => {
      const inMonth = balanceHistory(data.balances, account.id).filter(snapshot => yearMonthOf(snapshot.asOf) === month)
      return inMonth.length ? [{ account, snapshot: inMonth[inMonth.length - 1] }] : []
    })
    const end = monthEnd(month) < today ? monthEnd(month) : today
    const total = entered.length && month <= yearMonthOf(today) ? savingsSummary(data, end).total : null
    return { month, total, entered }
  })
}

export interface DebtPoint {
  month: YearMonth
  /** The last balance entered in this month, or null when none was. */
  snapshot: BalanceSnapshot | null
}

/** Remaining Balance over time: the last balance entered in each month; months without one are gaps. */
export function debtSeries(balances: readonly BalanceSnapshot[], debtId: Id, months: readonly YearMonth[]): DebtPoint[] {
  const history = balanceHistory(balances, debtId)
  return months.map(month => {
    const inMonth = history.filter(snapshot => yearMonthOf(snapshot.asOf) === month)
    return { month, snapshot: inMonth.length ? inMonth[inMonth.length - 1] : null }
  })
}

/**
 * The estimate as a path: the balance after each of the next months,
 * paying `payment` every month with the same yearly interest, as the
 * Estimate section calculates it (the Phase 1 calculator). It stops at 0
 * or after `maxMonths`. Empty when the payment never brings it down.
 */
export function payoffPath(balance: MoneyAmount, yearlyInterestBasisPoints: number, payment: MoneyAmount, maxMonths: number): MoneyAmount[] {
  if (balance <= 0 || payment <= 0) return []
  if (calculatePayoff(balance / 100, yearlyInterestBasisPoints / 100, payment / 100).status === 'payment-too-low') return []
  const rate = yearlyInterestBasisPoints / 120_000
  const path: MoneyAmount[] = []
  let outstanding = balance / 100
  while (path.length < maxMonths && outstanding > 0.005) {
    const charge = outstanding * rate
    outstanding = Math.max(0, outstanding + charge - Math.min(outstanding + charge, payment / 100))
    path.push(Math.round(outstanding * 100))
  }
  return path
}

export interface GoalStep {
  key: string
  date: CalendarDate
  /** What this record changed (the opening balance for the first step). */
  amount: MoneyAmount
  /** What was in the goal after it. */
  saved: MoneyAmount
  /** null for "Already saved when it was added". */
  movement: GoalMovement | null
}

/**
 * Saved over time for one goal: what was already saved when it was added,
 * then each Contribution and Withdrawal in date order, with the running
 * total. The total is the one Goals shows (goalSaved), step by step.
 */
export function goalSteps(goal: Goal, movements: readonly GoalMovement[]): GoalStep[] {
  const steps: GoalStep[] = goal.openingBalance > 0
    ? [{ key: 'opening', date: goal.createdOn, amount: goal.openingBalance, saved: goal.openingBalance, movement: null }]
    : []
  let saved = goal.openingBalance
  for (const movement of goalMovementsOf(movements, goal.id)) {
    saved += movement.amount
    steps.push({ key: movement.id, date: movement.date, amount: movement.amount, saved, movement })
  }
  return steps
}

export interface IncomeSpendingMonth {
  month: YearMonth
  /** False for a month after today's. */
  started: boolean
  /** Income received (0 for a month not started). */
  income: MoneyAmount
  spending: MoneyAmount
  /** Income still expected: only in the month of today and later months. */
  expected: MoneyAmount
  /** A started month with no income received and nothing spent: shown as such, not as 0. */
  nothingRecorded: boolean
}

/**
 * Income & Spending by month for a year (History › Year Overview): what
 * was received and spent in each month up to today's, and the income still
 * expected from this month on. An earlier month's income that never came
 * is not "expected" any more, so it is not drawn. Later months appear only
 * when some income is expected in them.
 */
export function incomeSpendingByMonth(data: FinanceData, year: number, today: CalendarDate): IncomeSpendingMonth[] {
  const current = yearMonthOf(today)
  return monthsOfYear(year).map(month => {
    const started = month <= current
    const income = started ? incomeReceived(data, month).total : 0
    const spending = started ? monthSpending(data, month).total : 0
    const expected = month >= current ? monthIncome(data, month).expected : 0
    return { month, started, income, spending, expected, nothingRecorded: started && income === 0 && spending === 0 }
  }).filter(row => row.started || row.expected > 0)
}
