import { dateInMonth, type YearMonth } from '../calendar'
import type { CalendarDate } from '../goalTime'
import type { MoneyAmount } from '../goalAmounts'
import { sumMinor } from '../money'
import type { BillCategory, BillMonth, FinanceData, Id, RecurringBill } from './types'

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
        amount: changed ? record.amount ?? null : bill.amount,
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

/** Marks one month of a bill as paid or unpaid. Debt balances never change because of it. */
export const setBillPaid = (data: FinanceData, billId: Id, month: YearMonth, paid: boolean) =>
  withBillMonth(data, billId, month, record => ({ ...record, paid }))

/**
 * Sets this month's amount of a bill: a number, null for "not known", or
 * undefined to go back to the usual amount. Other months are not touched.
 */
export function setBillMonthAmount(data: FinanceData, billId: Id, month: YearMonth, amount: MoneyAmount | null | undefined): FinanceData {
  return withBillMonth(data, billId, month, record => {
    const rest: BillMonth = { billId: record.billId, month: record.month, paid: record.paid }
    return amount === undefined ? rest : { ...rest, amount }
  })
}
