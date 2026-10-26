import type { YearMonth } from '../calendar'
import type { CalendarDate } from '../goalTime'
import type { MoneyAmount } from '../goalAmounts'
import { sumMinor } from '../money'
import { billsForMonth } from './bills'
import { monthEnd, monthResult } from './spending'
import type { BalanceSnapshot, FinanceData, Id } from './types'

/**
 * How each record changes an account's balance. A flow is never stored:
 * it is read from the records (income, paid bills, expenses, transfers,
 * goal movements), so editing a record changes its flow everywhere.
 *
 * For a money account a flow adds to or takes from what is there. For a
 * card or loan it adds to or takes from what is owed: a card purchase adds,
 * a card payment and a loan's principal take away. A loan installment
 * whose interest is not known has no principal flow (the app never guesses
 * it), so that loan cannot be checked for that month.
 */
export interface AccountFlow {
  accountId: Id
  /** When it happened (the payment date of a paid bill, or its due date). */
  date: CalendarDate
  /** The month the record counts for (a bill's own month). */
  month: YearMonth
  amount: MoneyAmount
  kind: 'income' | 'bill' | 'expense' | 'transfer' | 'goal-movement' | 'repayment'
  label: string
}

/** Every flow the records describe, for every account and debt. */
export function accountFlows(data: FinanceData, months?: readonly YearMonth[]): AccountFlow[] {
  const flows: AccountFlow[] = []
  const inMonths = (month: YearMonth) => !months || months.includes(month)
  for (const entry of data.income) {
    if (entry.accountId && inMonths(entry.month)) flows.push({ accountId: entry.accountId, date: entry.receivedOn, month: entry.month, amount: entry.amount, kind: 'income', label: entry.note ?? 'Income' })
  }
  // Bill months are only ever in the months that have a record (paid ones).
  const billMonths = [...new Set(data.billMonths.filter(record => record.paid).map(record => record.month))].filter(inMonths)
  for (const month of billMonths) {
    for (const occurrence of billsForMonth(data, month)) {
      if (!occurrence.paid || occurrence.amount === null) continue
      const record = data.billMonths.find(r => r.billId === occurrence.bill.id && r.month === month)
      const date = record?.paidOn ?? occurrence.dueDate
      if (record?.paidFrom) flows.push({ accountId: record.paidFrom, date, month, amount: -occurrence.amount, kind: 'bill', label: occurrence.bill.name })
      const debt = occurrence.bill.debtId ? data.debts.find(d => d.id === occurrence.bill.debtId) : undefined
      if (!debt) continue
      const interest = debt.kind === 'card' ? 0 : record?.interest
      if (interest !== undefined) flows.push({ accountId: debt.id, date, month, amount: -(occurrence.amount - interest), kind: 'repayment', label: occurrence.bill.name })
    }
  }
  for (const expense of data.expenses) {
    const month = expense.date.slice(0, 7)
    if (!inMonths(month)) continue
    const onCard = data.debts.some(debt => debt.id === expense.accountId)
    flows.push({ accountId: expense.accountId, date: expense.date, month, amount: onCard ? expense.amount : -expense.amount, kind: 'expense', label: expense.description })
  }
  for (const transfer of data.transfers) {
    const month = transfer.date.slice(0, 7)
    if (!inMonths(month)) continue
    flows.push({ accountId: transfer.fromAccountId, date: transfer.date, month, amount: -transfer.amount, kind: 'transfer', label: transfer.note || 'Transfer' })
    flows.push({ accountId: transfer.toAccountId, date: transfer.date, month, amount: transfer.amount, kind: 'transfer', label: transfer.note || 'Transfer' })
  }
  for (const movement of data.goalMovements) {
    const month = movement.date.slice(0, 7)
    if (!movement.accountId || !inMonths(month)) continue
    flows.push({ accountId: movement.accountId, date: movement.date, month, amount: movement.amount, kind: 'goal-movement', label: movement.note || 'Savings movement' })
  }
  return flows
}

/**
 * How a month's result was absorbed, from the records alone:
 *
 *   result = change in Daily Spending + change in Savings
 *          + change in Investments − change in debt + not explained
 *
 * A negative result (a deficit) is therefore covered by money taken from
 * the accounts and by new debt, and every part has a number. "Not
 * explained" is what the records do not say: income or spending without an
 * account, a loan payment without its interest, or savings recorded
 * without saying where the money came from. It is 0 when everything is
 * recorded.
 */
export interface MonthFunding {
  month: YearMonth
  result: MoneyAmount
  everydayChange: MoneyAmount
  savingsChange: MoneyAmount
  investmentChange: MoneyAmount
  /** Above 0: more is owed at the end of the month (new debt). */
  debtChange: MoneyAmount
  notExplained: MoneyAmount
}

export function monthFunding(data: FinanceData, month: YearMonth, today: CalendarDate): MonthFunding {
  const flows = accountFlows(data, [month])
  const kindOf = (id: Id) => data.moneyAccounts.find(account => account.id === id)?.kind ?? (data.debts.some(debt => debt.id === id) ? 'debt' : null)
  const total = (kinds: string[]) => sumMinor(flows.filter(flow => kinds.includes(kindOf(flow.accountId) ?? '')).map(flow => flow.amount))
  const { result } = monthResult(data, month, today)
  const everydayChange = total(['daily-spending', 'other'])
  const savingsChange = total(['savings'])
  const investmentChange = total(['investment'])
  const debtChange = total(['debt'])
  return { month, result, everydayChange, savingsChange, investmentChange, debtChange, notExplained: result - (everydayChange + savingsChange + investmentChange - debtChange) }
}

export type ReconciliationStatus =
  /** The entered balances agree with the records (difference 0) or not (difference ≠ 0). */
  | 'checked'
  /** No balance was entered by the end of the month (or before it), so there is nothing to compare. */
  | 'no-balances'
  /** A loan installment in the period has no interest split, so the principal is not known. */
  | 'split-unknown'

export interface AccountReconciliation {
  accountId: Id
  month: YearMonth
  status: ReconciliationStatus
  /** The last balance entered before the month (or at its start). */
  opening: BalanceSnapshot | null
  /** The last balance entered by the end of the month. */
  closing: BalanceSnapshot | null
  /** What the records added or took away between the two balances. */
  recordedChange: MoneyAmount
  /** closing − (opening + recordedChange). 0 means the records explain the balance. */
  difference: MoneyAmount
}

/**
 * Compares the balances the user entered with the records between them.
 * Only entered balances are used as checkpoints: a balance worked out
 * from a goal movement is itself a record. A balance is true at the end of
 * its day, so records dated on the same day are already in it.
 */
export function reconcileAccount(data: FinanceData, accountId: Id, month: YearMonth): AccountReconciliation {
  const entered = data.balances.filter(b => b.accountId === accountId && b.source === 'entered')
    .map((snapshot, order) => ({ snapshot, order }))
    .sort((a, b) => a.snapshot.asOf.localeCompare(b.snapshot.asOf) || a.order - b.order)
    .map(({ snapshot }) => snapshot)
  const start = `${month}-01`
  const end = monthEnd(month)
  const opening = [...entered].reverse().find(b => b.asOf < start) ?? null
  const closing = [...entered].reverse().find(b => b.asOf <= end) ?? null
  const base = { accountId, month, opening, closing, recordedChange: 0, difference: 0 }
  if (!opening || !closing || closing.asOf < start) return { ...base, status: 'no-balances' }
  const flows = accountFlows(data).filter(flow => flow.accountId === accountId && flow.date > opening.asOf && flow.date <= closing.asOf)
  const debt = data.debts.find(d => d.id === accountId)
  if (debt?.kind === 'loan') {
    const unsplit = data.billMonths.some(record => {
      const bill = data.bills.find(b => b.id === record.billId)
      if (!record.paid || bill?.debtId !== debt.id || record.interest !== undefined) return false
      const occurrence = billsForMonth(data, record.month).find(o => o.bill.id === bill.id)
      const date = record.paidOn ?? occurrence?.dueDate ?? ''
      return date > opening.asOf && date <= closing.asOf
    })
    if (unsplit) return { ...base, status: 'split-unknown' }
  }
  const recordedChange = sumMinor(flows.map(flow => flow.amount))
  return { ...base, status: 'checked', recordedChange, difference: closing.amount - (opening.amount + recordedChange) }
}
