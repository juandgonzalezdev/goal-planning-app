import { isCalendarDate, isYearMonth, type YearMonth } from '../calendar'
import { characterCount } from '../goal'
import type { CalendarDate } from '../goalTime'
import type { MoneyAmount } from '../goalAmounts'
import { calculatePayoff, type PayoffEstimate } from '../loanPayoff'
import { isMinorAmount, MINOR_UNITS_PER_UNIT, sumMinor } from '../money'
import { latestBalance } from './balances'
import { isBillDueIn, usualAmountFor } from './bills'
import type { BalanceSnapshot, DebtAccount, DebtKind, FinanceData, Id, Owner, RecurringBill } from './types'

export interface DebtItem {
  debt: DebtAccount
  /** What is still owed (card: Remaining Balance; loan: outstanding principal), or null if never entered. */
  balance: MoneyAmount | null
  asOf: CalendarDate | null
}

/** The bill that pays a debt, if there is one. */
export const linkedBill = (data: Pick<FinanceData, 'bills'>, debtId: Id): RecurringBill | null =>
  data.bills.find(bill => bill.debtId === debtId) ?? null

export interface DebtPayment {
  /** The planned monthly payment in `month`, or null when it is not known. */
  amount: MoneyAmount | null
  /** bill: it comes from the linked bill (and is counted in Monthly Bills). debt: entered on the debt. none: not entered. */
  source: 'bill' | 'debt' | 'none'
  bill: RecurringBill | null
}

/**
 * A debt's monthly payment. A linked bill is the one place that holds it,
 * so the payment shown in Cards and the bill in Monthly Bills are always
 * the same amount, counted once.
 */
export function debtPayment(data: Pick<FinanceData, 'bills'>, debt: DebtAccount, month: YearMonth): DebtPayment {
  const bill = linkedBill(data, debt.id)
  if (bill) return { amount: isBillDueIn(bill, month) ? usualAmountFor(bill, month) : null, source: 'bill', bill }
  if (debt.monthlyPayment !== undefined) return { amount: debt.monthlyPayment, source: 'debt', bill: null }
  return { amount: null, source: 'none', bill: null }
}

export interface CardsSummary {
  items: (DebtItem & { payment: DebtPayment })[]
  /** Remaining balances added up (not payments). */
  totalBalance: MoneyAmount
  missingBalanceCount: number
  /** Planned monthly payments, each debt once. */
  totalPayments: MoneyAmount
  missingPaymentCount: number
}

/** "Summary based on your loans and cards": only the debt records and their bills, never income. */
export function summarizeCards(data: Pick<FinanceData, 'debts' | 'balances' | 'bills'>, month: YearMonth, asOf?: CalendarDate): CardsSummary {
  const debts = summarizeDebts(data, asOf)
  const items = debts.items.map(item => ({ ...item, payment: debtPayment(data, item.debt, month) }))
  return {
    items,
    totalBalance: debts.total,
    missingBalanceCount: debts.missingBalanceCount,
    totalPayments: sumMinor(items.flatMap(item => (item.payment.amount === null ? [] : [item.payment.amount]))),
    missingPaymentCount: items.filter(item => item.payment.amount === null).length,
  }
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

/** Every debt's latest balance; with `asOf`, as known on that date. */
export function summarizeDebts(data: Pick<FinanceData, 'debts' | 'balances'>, asOf?: CalendarDate): DebtSummary {
  const items = data.debts.map(debt => {
    const snapshot = latestBalance(data.balances, debt.id, asOf)
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
 * It reuses the tested Phase 1 calculator (loanPayoff.ts) unchanged; amounts go in
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

export const DEBT_NAME_MAX_LENGTH = 40

/** What the user can set on a card or loan. The balance and the payment have their own actions. */
export interface DebtFields {
  kind: DebtKind
  name: string
  owner: Owner
  yearlyInterestBasisPoints: number
  dueDay: number
  closingDay: number | null
  minimumPayment: MoneyAmount | null
  startMonth: YearMonth | null
  finalPaymentMonth: YearMonth | null
}

export type DebtFieldError = 'name-required' | 'name-too-long' | 'invalid-interest' | 'invalid-due-day' | 'invalid-closing-day'
  | 'invalid-minimum' | 'invalid-start' | 'invalid-final' | 'ends-before-start'

const isDay = (value: number) => Number.isInteger(value) && value >= 1 && value <= 31

export function validateDebtFields(fields: DebtFields): DebtFieldError[] {
  const errors: DebtFieldError[] = []
  const name = fields.name.trim()
  if (name === '') errors.push('name-required')
  else if (characterCount(name) > DEBT_NAME_MAX_LENGTH) errors.push('name-too-long')
  if (!Number.isInteger(fields.yearlyInterestBasisPoints) || fields.yearlyInterestBasisPoints < 0 || fields.yearlyInterestBasisPoints > 100_00) errors.push('invalid-interest')
  if (!isDay(fields.dueDay)) errors.push('invalid-due-day')
  if (fields.closingDay !== null && !isDay(fields.closingDay)) errors.push('invalid-closing-day')
  if (fields.minimumPayment !== null && (!isMinorAmount(fields.minimumPayment) || fields.minimumPayment < 0)) errors.push('invalid-minimum')
  if (fields.startMonth !== null && !isYearMonth(fields.startMonth)) errors.push('invalid-start')
  if (fields.finalPaymentMonth !== null && !isYearMonth(fields.finalPaymentMonth)) errors.push('invalid-final')
  else if (fields.startMonth !== null && fields.finalPaymentMonth !== null && fields.finalPaymentMonth < fields.startMonth) errors.push('ends-before-start')
  return errors
}

/** Card-only and loan-only fields are dropped from the other kind, so nothing hidden stays behind. */
function applyDebtFields(debt: DebtAccount, fields: DebtFields): DebtAccount {
  const next: DebtAccount = {
    ...debt, kind: fields.kind, name: fields.name.trim(), owner: fields.owner,
    yearlyInterestBasisPoints: fields.yearlyInterestBasisPoints, dueDay: fields.dueDay,
  }
  delete next.closingDay; delete next.minimumPayment; delete next.startMonth; delete next.finalPaymentMonth
  if (fields.kind === 'card') {
    if (fields.closingDay !== null) next.closingDay = fields.closingDay
    if (fields.minimumPayment !== null) next.minimumPayment = fields.minimumPayment
  } else {
    if (fields.startMonth !== null) next.startMonth = fields.startMonth
    if (fields.finalPaymentMonth !== null) next.finalPaymentMonth = fields.finalPaymentMonth
  }
  return next
}

export type DebtResult = { status: 'ok'; data: FinanceData } | { status: 'invalid'; errors: DebtFieldError[] }

export function addDebt(data: FinanceData, id: Id, fields: DebtFields): DebtResult {
  const errors = validateDebtFields(fields)
  if (errors.length > 0) return { status: 'invalid', errors }
  const debt = applyDebtFields({ id, kind: fields.kind, name: '', owner: fields.owner, currency: data.space.currency, yearlyInterestBasisPoints: 0, dueDay: 1 }, fields)
  return { status: 'ok', data: { ...data, debts: [...data.debts, debt] } }
}

/** Changes a card's or loan's details. Its balance history and its bill stay as they are. */
export function updateDebt(data: FinanceData, id: Id, fields: DebtFields): DebtResult {
  const errors = validateDebtFields(fields)
  if (errors.length > 0) return { status: 'invalid', errors }
  return { status: 'ok', data: { ...data, debts: data.debts.map(debt => (debt.id === id ? applyDebtFields(debt, fields) : debt)) } }
}

/** Sets the planned payment of a debt that no bill pays (null removes it). */
export function setDebtOwnPayment(data: FinanceData, id: Id, amount: MoneyAmount | null): FinanceData {
  return {
    ...data,
    debts: data.debts.map(debt => {
      if (debt.id !== id) return debt
      const rest = { ...debt }
      delete rest.monthlyPayment
      return amount === null ? rest : { ...rest, monthlyPayment: amount }
    }),
  }
}

/**
 * Records a balance the user read somewhere, true on `asOf`. It is a new
 * snapshot: the earlier ones stay as history. Used for debts and accounts.
 */
export function recordBalance(data: FinanceData, id: Id, accountId: Id, amount: MoneyAmount, asOf: CalendarDate): FinanceData | null {
  if (!isMinorAmount(amount) || !isCalendarDate(asOf)) return null
  if (!data.debts.some(debt => debt.id === accountId) && !data.moneyAccounts.some(account => account.id === accountId)) return null
  const snapshot: BalanceSnapshot = { id, accountId, asOf, amount, currency: data.space.currency, source: 'entered' }
  return { ...data, balances: [...data.balances, snapshot] }
}

/**
 * Deletes a card or loan and its balance history. A bill that pays it is
 * handled as the user chose: deleted with its months, or kept as an
 * ordinary bill with no link. It is never left pointing at nothing.
 */
export function deleteDebt(data: FinanceData, id: Id, linkedBillChoice: 'delete-bill' | 'keep-bill'): FinanceData {
  const bill = linkedBill(data, id)
  let bills = data.bills
  let billMonths = data.billMonths
  if (bill && linkedBillChoice === 'delete-bill') {
    bills = bills.filter(b => b.id !== bill.id)
    billMonths = billMonths.filter(record => record.billId !== bill.id)
  } else if (bill) {
    bills = bills.map(b => {
      if (b.id !== bill.id) return b
      const rest = { ...b }
      delete rest.debtId
      return rest
    })
  }
  return {
    ...data,
    debts: data.debts.filter(debt => debt.id !== id),
    balances: data.balances.filter(snapshot => snapshot.accountId !== id),
    bills,
    billMonths,
  }
}
