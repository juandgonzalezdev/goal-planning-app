import { isCalendarDate, isYearMonth, type YearMonth } from '../../domain/calendar'
import { addBill, setUsualAmountFrom } from '../../domain/finance/bills'
import { addDebt, debtPayment, recordBalance, setDebtOwnPayment, updateDebt, type DebtFields } from '../../domain/finance/debts'
import type { DebtAccount, DebtKind, FinanceData, Owner } from '../../domain/finance/types'
import type { CalendarDate } from '../../domain/goalTime'
import type { MoneyAmount } from '../../domain/goalAmounts'
import { amountText } from '../../ui/labels'
import { parseMoneyInput } from '../../ui/moneyInput'

/** What the card or loan form holds while the user types. */
export interface DebtDraft {
  kind: DebtKind
  name: string
  /** Yearly interest in percent, e.g. "18.50". */
  interest: string
  dueDay: string
  closingDay: string
  minimumPayment: string
  startMonth: string
  finalPaymentMonth: string
  /** The planned monthly payment. Blank means not known. */
  payment: string
  /** The month the payment applies from (for a payment held by a bill). */
  paymentFrom: string
  /** For a debt with no bill: also add the payment to Monthly Bills. */
  addBill: boolean
  /** New debts only: the Remaining Balance and the date it is true on. */
  balance: string
  balanceAsOf: string
}

export const emptyDebtDraft = (month: YearMonth, today: CalendarDate): DebtDraft => ({
  kind: 'loan', name: '', interest: '', dueDay: '', closingDay: '', minimumPayment: '', startMonth: '', finalPaymentMonth: '',
  payment: '', paymentFrom: month, addBill: true, balance: '', balanceAsOf: today,
})

export function draftFromDebt(data: FinanceData, debt: DebtAccount, month: YearMonth, today: CalendarDate): DebtDraft {
  const payment = debtPayment(data, debt, month)
  return {
    kind: debt.kind, name: debt.name, interest: (debt.yearlyInterestBasisPoints / 100).toFixed(2), dueDay: String(debt.dueDay),
    closingDay: debt.closingDay ? String(debt.closingDay) : '', minimumPayment: amountText(debt.minimumPayment),
    startMonth: debt.startMonth ?? '', finalPaymentMonth: debt.finalPaymentMonth ?? '',
    payment: amountText(payment.amount), paymentFrom: month, addBill: false, balance: '', balanceAsOf: today,
  }
}

export type DebtDraftErrors = Partial<Record<'name' | 'interest' | 'dueDay' | 'closingDay' | 'minimumPayment' | 'startMonth' | 'finalPaymentMonth' | 'payment' | 'paymentFrom' | 'balance' | 'balanceAsOf', string>>

export interface ReadDebt {
  fields: DebtFields
  payment: MoneyAmount | null
  paymentFrom: YearMonth
  balance: { amount: MoneyAmount; asOf: CalendarDate } | null
}

const readDay = (text: string) => (/^\d{1,2}$/.test(text.trim()) && Number(text) >= 1 && Number(text) <= 31 ? Number(text) : null)
const readOptionalAmount = (text: string): MoneyAmount | null | 'invalid' => (text.trim() === '' ? null : parseMoneyInput(text) ?? 'invalid')

/** Turns the form into debt fields, or explains what to fix in plain words. */
export function readDebtDraft(draft: DebtDraft, owner: Owner, options: { isNew: boolean; today: CalendarDate }):
  | { status: 'valid'; value: ReadDebt }
  | { status: 'invalid'; errors: DebtDraftErrors } {
  const errors: DebtDraftErrors = {}
  const name = draft.name.trim()
  if (name === '') errors.name = 'Enter a name, such as Credit Card or Student Loan.'
  else if (Array.from(name).length > 40) errors.name = 'Use 40 characters or fewer.'
  const interest = parseMoneyInput(draft.interest)
  if (interest === null || interest > 100_00) errors.interest = 'Enter the yearly interest in percent, such as 9.9 or 0.'
  const dueDay = readDay(draft.dueDay)
  if (dueDay === null) errors.dueDay = 'Enter a day from 1 to 31.'
  const card = draft.kind === 'card'
  const closingDay = card && draft.closingDay.trim() !== '' ? readDay(draft.closingDay) : null
  if (card && draft.closingDay.trim() !== '' && closingDay === null) errors.closingDay = 'Enter a day from 1 to 31, or leave it empty.'
  const minimum = card ? readOptionalAmount(draft.minimumPayment) : null
  if (minimum === 'invalid') errors.minimumPayment = 'Enter an amount such as 90, or leave it empty.'
  const startMonth = !card && draft.startMonth !== '' ? draft.startMonth : null
  if (startMonth !== null && !isYearMonth(startMonth)) errors.startMonth = 'Choose a month.'
  const finalPaymentMonth = !card && draft.finalPaymentMonth !== '' ? draft.finalPaymentMonth : null
  if (finalPaymentMonth !== null && !isYearMonth(finalPaymentMonth)) errors.finalPaymentMonth = 'Choose a month.'
  else if (startMonth && finalPaymentMonth && finalPaymentMonth < startMonth) errors.finalPaymentMonth = 'The last payment can’t be before the first.'
  const payment = readOptionalAmount(draft.payment)
  if (payment === 'invalid') errors.payment = 'Enter an amount such as 250, or leave it empty if you don’t know it.'
  if (!isYearMonth(draft.paymentFrom)) errors.paymentFrom = 'Choose a month.'
  let balance: ReadDebt['balance'] = null
  if (options.isNew && draft.balance.trim() !== '') {
    const amount = parseMoneyInput(draft.balance)
    if (amount === null) errors.balance = 'Enter an amount such as 1800, or leave it empty.'
    if (!isCalendarDate(draft.balanceAsOf)) errors.balanceAsOf = 'Choose the date of this balance.'
    else if (draft.balanceAsOf > options.today) errors.balanceAsOf = 'The date can’t be after today.'
    if (amount !== null && !errors.balanceAsOf) balance = { amount, asOf: draft.balanceAsOf }
  }
  if (Object.keys(errors).length > 0) return { status: 'invalid', errors }
  return {
    status: 'valid',
    value: {
      fields: {
        kind: draft.kind, name, owner, yearlyInterestBasisPoints: interest as number, dueDay: dueDay as number,
        closingDay, minimumPayment: minimum as MoneyAmount | null, startMonth, finalPaymentMonth,
      },
      payment: payment as MoneyAmount | null,
      paymentFrom: draft.paymentFrom,
      balance,
    },
  }
}

/**
 * Applies the form in one step. The payment goes to the one place that
 * holds it: the linked bill (from `paymentFrom` on, earlier months keep
 * theirs), a new linked bill when the user asked for one, or the debt.
 */
export function applyDebtForm(data: FinanceData, debtId: string | null, read: ReadDebt, draft: DebtDraft, ids: { debt: string; bill: string; balance: string }): FinanceData | null {
  const id = debtId ?? ids.debt
  const saved = debtId ? updateDebt(data, id, read.fields) : addDebt(data, id, read.fields)
  if (saved.status !== 'ok') return null
  let next = saved.data
  if (read.balance) next = recordBalance(next, ids.balance, id, read.balance.amount, read.balance.asOf) ?? next
  const debt = next.debts.find(d => d.id === id) as DebtAccount
  const current = debtPayment(next, debt, read.paymentFrom)
  if (current.bill) {
    if (current.amount !== read.payment) next = setUsualAmountFrom(next, current.bill.id, read.paymentFrom, read.payment)
  } else if (draft.addBill && read.payment !== null) {
    next = setDebtOwnPayment(next, id, null)
    const bill = addBill(next, ids.bill, {
      name: read.fields.name, category: read.fields.kind === 'card' ? 'Cards' : 'Loans', owner: read.fields.owner, dueDay: read.fields.dueDay,
      startMonth: read.paymentFrom, endMonth: read.fields.kind === 'loan' ? read.fields.finalPaymentMonth : null, note: '', debtId: id,
    }, read.payment)
    if (bill.status !== 'ok') return null
    next = bill.data
  } else {
    next = setDebtOwnPayment(next, id, read.payment)
  }
  return next
}
