import type { CalendarDate } from '../goalTime'
import type { MoneyAmount } from '../goalAmounts'
import { calculatePayoff, type PayoffEstimate } from '../loanPayoff'
import { MINOR_UNITS_PER_UNIT, sumMinor } from '../money'
import { latestBalance } from './balances'
import type { DebtAccount, FinanceData } from './types'

export interface DebtItem {
  debt: DebtAccount
  /** What is still owed (card: Remaining Balance; loan: outstanding principal), or null if never entered. */
  balance: MoneyAmount | null
  asOf: CalendarDate | null
}

export interface DebtSummary {
  items: DebtItem[]
  /**
   * Card balances plus loan principals. Monthly installments are not part
   * of it: an installment pays the debt (and interest), it is not more debt.
   */
  total: MoneyAmount
  /** Debts with no balance entered yet, so `total` may be incomplete. */
  missingBalanceCount: number
}

export function summarizeDebts(data: Pick<FinanceData, 'debts' | 'balances'>): DebtSummary {
  const items = data.debts.map(debt => {
    const snapshot = latestBalance(data.balances, debt.id)
    return { debt, balance: snapshot?.amount ?? null, asOf: snapshot?.asOf ?? null }
  })
  return {
    items,
    total: sumMinor(items.flatMap(item => (item.balance === null ? [] : [item.balance]))),
    missingBalanceCount: items.filter(item => item.balance === null).length,
  }
}

export type DebtPayoffEstimate =
  | { status: 'estimated'; months: number; interest: MoneyAmount }
  | Exclude<PayoffEstimate, { status: 'estimated' }>

/**
 * An estimate, not a bank figure: how long paying `monthlyPayment` would
 * take and the interest it would cost, with the same rate every month.
 * It reuses the tested calculator from My Money unchanged; amounts go in
 * and come out in minor units, and the interest is rounded to the nearest
 * grosz (or cent).
 */
export function estimateDebtPayoff(balance: MoneyAmount, yearlyInterestBasisPoints: number, monthlyPayment: MoneyAmount): DebtPayoffEstimate {
  const estimate = calculatePayoff(
    balance / MINOR_UNITS_PER_UNIT,
    yearlyInterestBasisPoints / 100,
    monthlyPayment / MINOR_UNITS_PER_UNIT,
  )
  return estimate.status === 'estimated'
    ? { status: 'estimated', months: estimate.months, interest: Math.round(estimate.interest * MINOR_UNITS_PER_UNIT) }
    : estimate
}
