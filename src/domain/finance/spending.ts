import { dateInMonth, type YearMonth } from '../calendar'
import type { CalendarDate } from '../goalTime'
import type { MoneyAmount } from '../goalAmounts'
import { sumMinor } from '../money'
import { billsForMonth, summarizeBills, type BillOccurrence, type BillSummary } from './bills'
import {
  SPENDING_CATEGORIES, type BillCategory, type DebtAccount, type FinanceData, type Id, type IncomeEntry,
  type SpendingCategory, type SpendingNature,
} from './types'

/**
 * Real spending and the month's result.
 *
 * Planned is not spent: a bill is an obligation until it is paid. Spending
 * counts each thing once, in the month it belongs to:
 * - a paid bill (rent, a subscription…), in the bill's month;
 * - an expense (groceries, a taxi…), on its date, paid from an account or
 *   with a card. A card purchase is spent when it is bought, so paying the
 *   card later is not spent again;
 * - for a loan installment, only the interest the lender showed. The rest
 *   (principal) pays the debt back: it is not spending. When the split is
 *   not known, nothing is guessed and the screen says so.
 * Transfers between accounts and savings movements are never spending.
 */

/** Where a bill's spending is grouped. Loan and card bills only add their interest. */
export const BILL_SPENDING_CATEGORY: Record<BillCategory, SpendingCategory> = {
  Housing: 'Housing', Utilities: 'Utilities', Transport: 'Transport', Subscriptions: 'Subscriptions',
  Loans: 'Interest & Fees', Cards: 'Interest & Fees', Education: 'Education', Other: 'Other',
}

export interface SpendingItem {
  /** Stable key: `bill:<billId>:<month>`, `interest:<billId>:<month>` or `expense:<id>`. */
  key: string
  source: 'bill' | 'loan-interest' | 'expense'
  /** The day it was paid or bought (a paid bill without a date uses its due date). */
  date: CalendarDate
  /** The month it counts for. */
  month: YearMonth
  amount: MoneyAmount
  category: SpendingCategory
  label: string
  nature: SpendingNature
  /** The account or card it was paid with, when known. */
  accountId: Id | null
  billId?: Id
  expenseId?: Id
}

export interface CategorySpending {
  category: SpendingCategory
  total: MoneyAmount
  items: SpendingItem[]
}

/** A loan or card payment made in the month. It pays debt back, so it is not spending. */
export interface DebtRepayment {
  occurrence: BillOccurrence
  debt: DebtAccount
  /** What left the account. null when the amount is not known. */
  amount: MoneyAmount | null
  /** What lowered the debt. null when it is not known (a loan installment without its interest). */
  principal: MoneyAmount | null
  interest: MoneyAmount | null
  date: CalendarDate
  accountId: Id | null
}

export interface MonthSpending {
  month: YearMonth
  items: SpendingItem[]
  total: MoneyAmount
  /** In the fixed category order; categories with nothing spent are left out. */
  byCategory: CategorySpending[]
  /** Paid bills with no known amount: they are not in the total. */
  unknownAmountCount: number
  /** Loan payments whose interest is not known: their interest is not in the total. */
  unsplitLoanPayments: DebtRepayment[]
  repayments: DebtRepayment[]
}

const debtOf = (data: Pick<FinanceData, 'debts'>, id: Id | undefined) => (id ? data.debts.find(debt => debt.id === id) ?? null : null)

function billMonthRecord(data: Pick<FinanceData, 'billMonths'>, billId: Id, month: YearMonth) {
  return data.billMonths.find(record => record.billId === billId && record.month === month)
}

/** Everything spent in a month, and the debt payments made in it. */
export function monthSpending(data: Pick<FinanceData, 'bills' | 'billMonths' | 'debts' | 'expenses'>, month: YearMonth): MonthSpending {
  const items: SpendingItem[] = []
  const repayments: DebtRepayment[] = []
  let unknownAmountCount = 0

  for (const occurrence of billsForMonth(data, month)) {
    if (!occurrence.paid) continue
    const { bill } = occurrence
    const record = billMonthRecord(data, bill.id, month)
    const date = record?.paidOn ?? occurrence.dueDate
    const accountId = record?.paidFrom ?? null
    const debt = debtOf(data, bill.debtId)
    if (debt) {
      const interest = debt.kind === 'card' ? 0 : record?.interest ?? null
      const principal = occurrence.amount === null || interest === null ? null : occurrence.amount - interest
      repayments.push({ occurrence, debt, amount: occurrence.amount, principal, interest, date, accountId })
      if (debt.kind === 'loan' && interest !== null && interest > 0) {
        items.push({ key: `interest:${bill.id}:${month}`, source: 'loan-interest', date, month, amount: interest, category: 'Interest & Fees',
          label: `${bill.name} interest`, nature: 'regular', accountId, billId: bill.id })
      }
      continue
    }
    if (occurrence.amount === null) { unknownAmountCount++; continue }
    items.push({ key: `bill:${bill.id}:${month}`, source: 'bill', date, month, amount: occurrence.amount, category: BILL_SPENDING_CATEGORY[bill.category],
      label: bill.name, nature: bill.frequency === 'yearly' ? 'annual' : 'regular', accountId, billId: bill.id })
  }

  for (const expense of data.expenses) {
    if (expense.date.slice(0, 7) !== month) continue
    items.push({ key: `expense:${expense.id}`, source: 'expense', date: expense.date, month, amount: expense.amount, category: expense.category,
      label: expense.description || expense.category, nature: expense.nature, accountId: expense.accountId, expenseId: expense.id })
  }

  items.sort((a, b) => a.date.localeCompare(b.date) || a.label.localeCompare(b.label))
  const byCategory = SPENDING_CATEGORIES.map(category => {
    const list = items.filter(item => item.category === category)
    return { category, total: sumMinor(list.map(item => item.amount)), items: list }
  }).filter(group => group.items.length > 0)

  return {
    month, items, total: sumMinor(items.map(item => item.amount)), byCategory, unknownAmountCount,
    unsplitLoanPayments: repayments.filter(r => r.debt.kind === 'loan' && r.interest === null),
    repayments,
  }
}

export interface MonthIncomeReceived {
  entries: IncomeEntry[]
  total: MoneyAmount
  /** Part of the total marked as one-off (e.g. a tax refund). */
  extraordinary: MoneyAmount
}

/** Income received for a month (what really arrived; nothing expected is counted). */
export function incomeReceived(data: Pick<FinanceData, 'income'>, month: YearMonth): MonthIncomeReceived {
  const entries = data.income.filter(entry => entry.month === month).sort((a, b) => a.receivedOn.localeCompare(b.receivedOn))
  return {
    entries,
    total: sumMinor(entries.map(entry => entry.amount)),
    extraordinary: sumMinor(entries.filter(entry => entry.extraordinary).map(entry => entry.amount)),
  }
}

export type BillPaymentState = 'paid' | 'paid-late' | 'due' | 'overdue'

/** A bill's state on `today`: paid (on time or late), not due yet, or overdue (its due date has passed). */
export function billPaymentState(occurrence: BillOccurrence, record: { paidOn?: CalendarDate } | undefined, today: CalendarDate): BillPaymentState {
  if (occurrence.paid) return record?.paidOn && record.paidOn > occurrence.dueDate ? 'paid-late' : 'paid'
  return occurrence.dueDate < today ? 'overdue' : 'due'
}

export interface PendingBill {
  occurrence: BillOccurrence
  state: 'due' | 'overdue'
}

export interface MonthResult {
  month: YearMonth
  income: MonthIncomeReceived
  /** Planned obligations: the month's bills, paid or not (debt installments included). */
  planned: BillSummary
  spending: MonthSpending
  pending: PendingBill[]
  /** Income received minus spending. Not money saved, and not cash: see `cashFlow`. */
  result: MoneyAmount
  /**
   * Money in and out of the user's own accounts: income in; bills paid,
   * spending paid from an account and card or loan payments out. Card
   * purchases are not in it until the card is paid. Transfers between
   * accounts cancel out and are left out.
   */
  cashFlow: { moneyIn: MoneyAmount; moneyOut: MoneyAmount; net: MoneyAmount }
}

/** The month on Home: income, obligations, spending, pending payments and the result. */
export function monthResult(data: FinanceData, month: YearMonth, today: CalendarDate): MonthResult {
  const income = incomeReceived(data, month)
  const occurrences = billsForMonth(data, month)
  const spending = monthSpending(data, month)
  const pending = occurrences.filter(o => !o.paid).map(occurrence => ({ occurrence, state: occurrence.dueDate < today ? 'overdue' as const : 'due' as const }))
  const isCard = (id: Id | null) => id !== null && data.debts.some(debt => debt.id === id && debt.kind === 'card')
  const paidBills = occurrences.filter(o => o.paid && o.amount !== null).map(o => o.amount as MoneyAmount)
  const accountSpending = spending.items.filter(item => item.source === 'expense' && !isCard(item.accountId)).map(item => item.amount)
  const moneyOut = sumMinor([...paidBills, ...accountSpending])
  return {
    month, income, planned: summarizeBills(occurrences), spending, pending,
    result: income.total - spending.total,
    cashFlow: { moneyIn: income.total, moneyOut, net: income.total - moneyOut },
  }
}

/** The last day of a month, e.g. '2026-02' -> '2026-02-28'. */
export const monthEnd = (month: YearMonth): CalendarDate => dateInMonth(month, 31)
