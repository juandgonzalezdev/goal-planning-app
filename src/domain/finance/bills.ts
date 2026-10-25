import { dateInMonth, isYearMonth, type YearMonth } from '../calendar'
import { characterCount } from '../goal'
import type { CalendarDate } from '../goalTime'
import type { MoneyAmount } from '../goalAmounts'
import { isMinorAmount, sumMinor } from '../money'
import { BILL_CATEGORIES, type BillCategory, type BillMonth, type FinanceData, type Id, type Owner, type RecurringBill } from './types'

/** One bill in one month: what is due, when, and whether it was paid. */
export interface BillOccurrence {
  bill: RecurringBill
  month: YearMonth
  dueDate: CalendarDate
  /** null when the amount is not known. Never treated as 0. */
  amount: MoneyAmount | null
  /** True when this month's amount differs from the bill's usual amount. */
  amountChangedThisMonth: boolean
  paid: boolean
}

/** True when the bill is due in `month` (between its first and last month). */
export const isBillDueIn = (bill: RecurringBill, month: YearMonth) =>
  month >= bill.startMonth && (bill.endMonth === null || month <= bill.endMonth)

/**
 * The bill's usual amount in a month: its starting amount, or the latest
 * change made from that month or earlier. A change never reaches back.
 */
export function usualAmountFor(bill: RecurringBill, month: YearMonth): MoneyAmount | null {
  let amount = bill.amount
  for (const change of bill.amountChanges ?? []) if (change.from <= month) amount = change.amount
  return amount
}

const findBillMonth = (billMonths: readonly BillMonth[], billId: Id, month: YearMonth) =>
  billMonths.find(record => record.billId === billId && record.month === month)

/** The bills due in a month, in date order (then by name). */
export function billsForMonth(data: Pick<FinanceData, 'bills' | 'billMonths'>, month: YearMonth): BillOccurrence[] {
  return data.bills
    .filter(bill => isBillDueIn(bill, month))
    .map(bill => {
      const record = findBillMonth(data.billMonths, bill.id, month)
      const changed = record !== undefined && record.amount !== undefined
      return {
        bill,
        month,
        dueDate: dateInMonth(month, bill.dueDay),
        amount: changed ? record.amount ?? null : usualAmountFor(bill, month),
        amountChangedThisMonth: changed,
        paid: record?.paid ?? false,
      }
    })
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate) || a.bill.name.localeCompare(b.bill.name))
}

export interface BillSummary {
  /** Sum of the amounts that are known. Unknown amounts are left out, not counted as 0. */
  knownTotal: MoneyAmount
  /** How many bills have no known amount. The screen must say so next to the total. */
  unknownCount: number
  /** Known amounts not paid yet. */
  leftToPay: MoneyAmount
  /** Unpaid bills whose amount is not known, so `leftToPay` may be higher. */
  unpaidUnknownCount: number
  paidCount: number
  count: number
}

export function summarizeBills(occurrences: readonly BillOccurrence[]): BillSummary {
  const known = occurrences.filter(o => o.amount !== null)
  const unpaid = occurrences.filter(o => !o.paid)
  return {
    knownTotal: sumMinor(known.map(o => o.amount as MoneyAmount)),
    unknownCount: occurrences.length - known.length,
    leftToPay: sumMinor(unpaid.filter(o => o.amount !== null).map(o => o.amount as MoneyAmount)),
    unpaidUnknownCount: unpaid.filter(o => o.amount === null).length,
    paidCount: occurrences.length - unpaid.length,
    count: occurrences.length,
  }
}

/** The bills of one due date, for the date list in Monthly Bills. */
export interface BillDay {
  dueDate: CalendarDate
  occurrences: BillOccurrence[]
  summary: BillSummary
}

/** Groups a month's bills by due date, earliest first. */
export function groupBillsByDay(occurrences: readonly BillOccurrence[]): BillDay[] {
  const days = new Map<CalendarDate, BillOccurrence[]>()
  for (const occurrence of occurrences) {
    days.set(occurrence.dueDate, [...(days.get(occurrence.dueDate) ?? []), occurrence])
  }
  return [...days.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([dueDate, list]) => ({ dueDate, occurrences: list, summary: summarizeBills(list) }))
}

/** Known amount per category, for the Monthly Bills chart. Categories with nothing known are left out. */
export function billTotalsByCategory(occurrences: readonly BillOccurrence[]): { category: BillCategory; total: MoneyAmount }[] {
  const totals = new Map<BillCategory, MoneyAmount>()
  for (const { bill, amount } of occurrences) {
    if (amount === null) continue
    totals.set(bill.category, (totals.get(bill.category) ?? 0) + amount)
  }
  return [...totals.entries()].map(([category, total]) => ({ category, total })).filter(item => item.total > 0)
}

/** Replaces (or adds) the record of one bill in one month. Other months are not touched. */
function withBillMonth(data: FinanceData, billId: Id, month: YearMonth, change: (record: BillMonth) => BillMonth): FinanceData {
  const existing = findBillMonth(data.billMonths, billId, month)
  const updated = change(existing ?? { billId, month, paid: false })
  return {
    ...data,
    billMonths: existing
      ? data.billMonths.map(record => (record === existing ? updated : record))
      : [...data.billMonths, updated],
  }
}

/**
 * Marks one month of a bill as paid (on `paidOn`) or unpaid. Debt balances
 * never change because of it: an installment pays interest and principal,
 * and the app does not know the split.
 */
export const setBillPaid = (data: FinanceData, billId: Id, month: YearMonth, paid: boolean, paidOn?: CalendarDate) =>
  withBillMonth(data, billId, month, record => {
    const rest: BillMonth = { ...record, paid }
    delete rest.paidOn
    return paid && paidOn ? { ...rest, paidOn } : rest
  })

/**
 * Sets this month's amount of a bill: a number, null for "not known", or
 * undefined to go back to the usual amount. Other months are not touched.
 */
export function setBillMonthAmount(data: FinanceData, billId: Id, month: YearMonth, amount: MoneyAmount | null | undefined): FinanceData {
  return withBillMonth(data, billId, month, record => {
    const rest: BillMonth = { ...record }
    delete rest.amount
    return amount === undefined ? rest : { ...rest, amount }
  })
}

/**
 * Changes the usual amount from `from` on. Earlier months keep what they
 * had, and a month with its own amount keeps it. Later changes are
 * replaced, because the new amount applies "from now on".
 */
export function setUsualAmountFrom(data: FinanceData, billId: Id, from: YearMonth, amount: MoneyAmount | null): FinanceData {
  return {
    ...data,
    bills: data.bills.map(bill => {
      if (bill.id !== billId) return bill
      const earlier = (bill.amountChanges ?? []).filter(change => change.from < from)
      const next: RecurringBill = { ...bill }
      if (from <= bill.startMonth) {
        next.amount = amount
        delete next.amountChanges
      } else {
        next.amountChanges = [...earlier, { from, amount }]
      }
      return next
    }),
  }
}

export const BILL_NAME_MAX_LENGTH = 40
export const BILL_NOTE_MAX_LENGTH = 120

/** What the user can set on a bill (its amounts have their own actions). */
export interface BillFields {
  name: string
  category: BillCategory
  owner: Owner
  dueDay: number
  startMonth: YearMonth
  endMonth: YearMonth | null
  note: string
  debtId: Id | null
}

export type BillFieldError = 'name-required' | 'name-too-long' | 'unknown-category' | 'invalid-due-day' | 'invalid-start'
  | 'invalid-end' | 'ends-before-start' | 'note-too-long' | 'unknown-debt' | 'debt-already-paid' | 'starts-after-change'

export function validateBillFields(data: FinanceData, fields: BillFields, billId: Id | null): BillFieldError[] {
  const errors: BillFieldError[] = []
  const name = fields.name.trim()
  if (name === '') errors.push('name-required')
  else if (characterCount(name) > BILL_NAME_MAX_LENGTH) errors.push('name-too-long')
  if (!(BILL_CATEGORIES as readonly string[]).includes(fields.category)) errors.push('unknown-category')
  if (!Number.isInteger(fields.dueDay) || fields.dueDay < 1 || fields.dueDay > 31) errors.push('invalid-due-day')
  if (!isYearMonth(fields.startMonth)) errors.push('invalid-start')
  if (fields.endMonth !== null && !isYearMonth(fields.endMonth)) errors.push('invalid-end')
  else if (fields.endMonth !== null && fields.endMonth < fields.startMonth) errors.push('ends-before-start')
  if (characterCount(fields.note.trim()) > BILL_NOTE_MAX_LENGTH) errors.push('note-too-long')
  if (fields.debtId !== null) {
    if (!data.debts.some(debt => debt.id === fields.debtId)) errors.push('unknown-debt')
    else if (data.bills.some(bill => bill.debtId === fields.debtId && bill.id !== billId)) errors.push('debt-already-paid')
  }
  const current = data.bills.find(bill => bill.id === billId)
  const firstChange = current?.amountChanges?.[0]?.from
  if (firstChange && fields.startMonth >= firstChange) errors.push('starts-after-change')
  return errors
}

function applyFields(bill: RecurringBill, fields: BillFields): RecurringBill {
  const next: RecurringBill = {
    ...bill, name: fields.name.trim(), category: fields.category, owner: fields.owner,
    dueDay: fields.dueDay, startMonth: fields.startMonth, endMonth: fields.endMonth,
  }
  const note = fields.note.trim()
  if (note) next.note = note
  else delete next.note
  if (fields.debtId) next.debtId = fields.debtId
  else delete next.debtId
  return next
}

/** A debt that a bill now pays keeps no payment of its own, so the payment is counted once. */
function withoutDebtPayment(data: FinanceData, debtId: Id | null): FinanceData {
  if (!debtId) return data
  return {
    ...data,
    debts: data.debts.map(debt => {
      if (debt.id !== debtId || debt.monthlyPayment === undefined) return debt
      const rest = { ...debt }
      delete rest.monthlyPayment
      return rest
    }),
  }
}

export type BillResult = { status: 'ok'; data: FinanceData } | { status: 'invalid'; errors: BillFieldError[] }

/** Adds a bill with its usual amount (null if not known yet). */
export function addBill(data: FinanceData, id: Id, fields: BillFields, amount: MoneyAmount | null): BillResult {
  const errors = validateBillFields(data, fields, null)
  if (amount !== null && (!isMinorAmount(amount) || amount < 0)) return { status: 'invalid', errors }
  if (errors.length > 0) return { status: 'invalid', errors }
  const bill = applyFields({ id, name: '', category: 'Other', owner: fields.owner, amount, currency: data.space.currency, dueDay: 1, startMonth: fields.startMonth, endMonth: null }, fields)
  return { status: 'ok', data: withoutDebtPayment({ ...data, bills: [...data.bills, bill] }, fields.debtId) }
}

/** Changes a bill's details. Its amounts, paid months and every other record stay as they are. */
export function updateBill(data: FinanceData, id: Id, fields: BillFields): BillResult {
  const errors = validateBillFields(data, fields, id)
  if (errors.length > 0) return { status: 'invalid', errors }
  return { status: 'ok', data: withoutDebtPayment({ ...data, bills: data.bills.map(bill => (bill.id === id ? applyFields(bill, fields) : bill)) }, fields.debtId) }
}

/** Deletes a bill and what was recorded for it each month. Its loan or card (if any) stays. */
export const deleteBill = (data: FinanceData, id: Id): FinanceData => ({
  ...data,
  bills: data.bills.filter(bill => bill.id !== id),
  billMonths: data.billMonths.filter(record => record.billId !== id),
})
