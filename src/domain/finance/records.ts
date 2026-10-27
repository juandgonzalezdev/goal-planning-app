import { isCalendarDate } from '../calendar'
import { characterCount } from '../goal'
import type { CalendarDate } from '../goalTime'
import type { MoneyAmount } from '../goalAmounts'
import { isMinorAmount } from '../money'
import { SPENDING_CATEGORIES, SPENDING_NATURES, type Expense, type FinanceData, type Id, type SpendingCategory, type SpendingNature, type Transfer } from './types'

/**
 * Adding, changing and deleting spending, transfers and received income.
 * Each change touches one record only: the months around it keep what
 * they had. Totals, balances checks and charts follow because they are
 * always worked out from the records.
 */

export const DESCRIPTION_MAX_LENGTH = 60

export interface ExpenseFields {
  date: CalendarDate
  amount: MoneyAmount
  category: SpendingCategory
  description: string
  accountId: Id
  nature: SpendingNature
}

export type RecordError = 'invalid-date' | 'after-today' | 'amount-not-positive' | 'unknown-category' | 'description-too-long'
  | 'unknown-account' | 'same-account' | 'unknown-nature' | 'not-found'

const isPayingAccount = (data: FinanceData, id: Id) =>
  data.moneyAccounts.some(account => account.id === id) || data.debts.some(debt => debt.id === id && debt.kind === 'card')

function checkCommon(date: CalendarDate, amount: MoneyAmount, today: CalendarDate): RecordError[] {
  const errors: RecordError[] = []
  if (!isCalendarDate(date)) errors.push('invalid-date')
  else if (date > today) errors.push('after-today')
  if (!isMinorAmount(amount) || amount <= 0) errors.push('amount-not-positive')
  return errors
}

export function validateExpense(data: FinanceData, fields: ExpenseFields, today: CalendarDate): RecordError[] {
  const errors = checkCommon(fields.date, fields.amount, today)
  if (!(SPENDING_CATEGORIES as readonly string[]).includes(fields.category)) errors.push('unknown-category')
  if (!(SPENDING_NATURES as readonly string[]).includes(fields.nature)) errors.push('unknown-nature')
  if (characterCount(fields.description.trim()) > DESCRIPTION_MAX_LENGTH) errors.push('description-too-long')
  if (!isPayingAccount(data, fields.accountId)) errors.push('unknown-account')
  return errors
}

export type RecordResult = { status: 'ok'; data: FinanceData } | { status: 'invalid'; errors: RecordError[] }

/** Adds (with a new id) or replaces (same id) one expense. */
export function saveExpense(data: FinanceData, id: Id, fields: ExpenseFields, today: CalendarDate): RecordResult {
  const errors = validateExpense(data, fields, today)
  if (errors.length > 0) return { status: 'invalid', errors }
  const expense: Expense = { id, ...fields, description: fields.description.trim(), currency: data.space.currency }
  const exists = data.expenses.some(e => e.id === id)
  return { status: 'ok', data: { ...data, expenses: exists ? data.expenses.map(e => (e.id === id ? expense : e)) : [...data.expenses, expense] } }
}

export const deleteExpense = (data: FinanceData, id: Id): FinanceData => ({ ...data, expenses: data.expenses.filter(e => e.id !== id) })

export interface TransferFields {
  date: CalendarDate
  amount: MoneyAmount
  fromAccountId: Id
  toAccountId: Id
  note: string
}

export function validateTransfer(data: FinanceData, fields: TransferFields, today: CalendarDate): RecordError[] {
  const errors = checkCommon(fields.date, fields.amount, today)
  const isAccount = (id: Id) => data.moneyAccounts.some(account => account.id === id)
  if (!isAccount(fields.fromAccountId) || !isAccount(fields.toAccountId)) errors.push('unknown-account')
  else if (fields.fromAccountId === fields.toAccountId) errors.push('same-account')
  if (characterCount(fields.note.trim()) > DESCRIPTION_MAX_LENGTH) errors.push('description-too-long')
  return errors
}

/** Adds or replaces one transfer between the user's own accounts. */
export function saveTransfer(data: FinanceData, id: Id, fields: TransferFields, today: CalendarDate): RecordResult {
  const errors = validateTransfer(data, fields, today)
  if (errors.length > 0) return { status: 'invalid', errors }
  const transfer: Transfer = { id, ...fields, note: fields.note.trim(), currency: data.space.currency }
  const exists = data.transfers.some(t => t.id === id)
  return { status: 'ok', data: { ...data, transfers: exists ? data.transfers.map(t => (t.id === id ? transfer : t)) : [...data.transfers, transfer] } }
}

export const deleteTransfer = (data: FinanceData, id: Id): FinanceData => ({ ...data, transfers: data.transfers.filter(t => t.id !== id) })

/** Changes what was received for one income record (amount and day). The month it counts for stays. */
export function updateIncomeEntry(data: FinanceData, id: Id, amount: MoneyAmount, receivedOn: CalendarDate, today: CalendarDate): RecordResult {
  if (!data.income.some(entry => entry.id === id)) return { status: 'invalid', errors: ['not-found'] }
  const errors: RecordError[] = []
  if (!isCalendarDate(receivedOn)) errors.push('invalid-date')
  else if (receivedOn > today) errors.push('after-today')
  if (!isMinorAmount(amount) || amount < 0) errors.push('amount-not-positive')
  if (errors.length > 0) return { status: 'invalid', errors }
  return { status: 'ok', data: { ...data, income: data.income.map(entry => (entry.id === id ? { ...entry, amount, receivedOn } : entry)) } }
}

type Stampable = { id: Id; recordedAt?: string }

/** New records (ids not there before) get `now`; changed ones keep the time they were first entered. */
function stampList<T extends Stampable>(before: readonly T[], after: readonly T[], now: string): T[] {
  if (before === after) return after as T[]
  const earlier = new Map(before.map(item => [item.id, item]))
  return after.map(item => {
    if (item.recordedAt !== undefined) return item
    const old = earlier.get(item.id)
    if (!old) return { ...item, recordedAt: now }
    return old.recordedAt !== undefined ? { ...item, recordedAt: old.recordedAt } : item
  })
}

/**
 * Notes when each record was entered, after a change made in the app, so
 * History can list records of the same day newest first. Only records
 * created by this change get the time; nothing older ever gets one (it
 * would be invented). A bill month gets it when it is marked paid.
 * Imports and the demo's example data never go through here.
 */
export function stampNewRecords(before: FinanceData, after: FinanceData, now: string): FinanceData {
  if (before === after) return after
  const paidBefore = new Map(before.billMonths.map(record => [`${record.billId}:${record.month}`, record]))
  const billMonths = before.billMonths === after.billMonths ? after.billMonths : after.billMonths.map(record => {
    const old = paidBefore.get(`${record.billId}:${record.month}`)
    if (!record.paid) {
      if (record.recordedAt === undefined) return record
      const rest = { ...record }
      delete rest.recordedAt
      return rest
    }
    if (record.recordedAt !== undefined) return record
    if (old?.paid) return old.recordedAt !== undefined ? { ...record, recordedAt: old.recordedAt } : record
    return { ...record, recordedAt: now }
  })
  return {
    ...after,
    income: stampList(before.income, after.income, now),
    billMonths,
    balances: stampList(before.balances, after.balances, now),
    goalMovements: stampList(before.goalMovements, after.goalMovements, now),
    expenses: stampList(before.expenses, after.expenses, now),
    transfers: stampList(before.transfers, after.transfers, now),
  }
}
