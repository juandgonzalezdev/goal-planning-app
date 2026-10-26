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
