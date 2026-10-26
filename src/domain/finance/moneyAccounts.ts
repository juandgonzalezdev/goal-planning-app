import { characterCount } from '../goal'
import type { CalendarDate } from '../goalTime'
import type { MoneyAmount } from '../goalAmounts'
import { sumMinor } from '../money'
import { latestBalance } from './balances'
import { MONEY_ACCOUNT_KINDS, type FinanceData, type Id, type MoneyAccount, type MoneyAccountKind, type Owner } from './types'

export interface MoneyAccountItem {
  account: MoneyAccount
  balance: MoneyAmount | null
  asOf: CalendarDate | null
}

export interface MoneySummary {
  items: MoneyAccountItem[]
  /** Total per kind, in the fixed order daily spending, investment, savings, other. */
  byKind: { kind: MoneyAccountKind; total: MoneyAmount }[]
  /**
   * Everything entered, added up. Not all of it can be spent today, and it
   * is never netted against debt. Goals and the emergency fund are not
   * added: they are part of Savings, not extra money.
   */
  total: MoneyAmount
  missingBalanceCount: number
}

/** The latest balance of each account; with `asOf`, as known on that date. */
export function summarizeMoney(data: Pick<FinanceData, 'moneyAccounts' | 'balances'>, asOf?: CalendarDate): MoneySummary {
  const items = data.moneyAccounts.map(account => {
    const snapshot = latestBalance(data.balances, account.id, asOf)
    return { account, balance: snapshot?.amount ?? null, asOf: snapshot?.asOf ?? null }
  })
  const known = (list: MoneyAccountItem[]) => sumMinor(list.flatMap(item => (item.balance === null ? [] : [item.balance])))
  return {
    items,
    byKind: MONEY_ACCOUNT_KINDS.map(kind => ({ kind, total: known(items.filter(item => item.account.kind === kind)) })),
    total: known(items),
    missingBalanceCount: items.filter(item => item.balance === null).length,
  }
}

export const ACCOUNT_NAME_MAX_LENGTH = 40

export interface AccountFields {
  kind: MoneyAccountKind
  name: string
  owner: Owner
}

export type AccountFieldError = 'name-required' | 'name-too-long' | 'unknown-kind' | 'has-goal-movements'

export function validateAccountFields(data: FinanceData, id: Id | null, fields: AccountFields): AccountFieldError[] {
  const errors: AccountFieldError[] = []
  const name = fields.name.trim()
  if (name === '') errors.push('name-required')
  else if (characterCount(name) > ACCOUNT_NAME_MAX_LENGTH) errors.push('name-too-long')
  if (!(MONEY_ACCOUNT_KINDS as readonly string[]).includes(fields.kind)) errors.push('unknown-kind')
  // Goal movements point at savings accounts; one in use cannot become another kind.
  if (id && fields.kind !== 'savings' && data.goalMovements.some(movement => movement.accountId === id)) errors.push('has-goal-movements')
  return errors
}

export type AccountResult = { status: 'ok'; data: FinanceData } | { status: 'invalid'; errors: AccountFieldError[] }

export function saveAccount(data: FinanceData, id: Id, fields: AccountFields): AccountResult {
  const exists = data.moneyAccounts.some(account => account.id === id)
  const errors = validateAccountFields(data, exists ? id : null, fields)
  if (errors.length > 0) return { status: 'invalid', errors }
  const account: MoneyAccount = { id, kind: fields.kind, name: fields.name.trim(), owner: fields.owner, currency: data.space.currency }
  return { status: 'ok', data: { ...data, moneyAccounts: exists ? data.moneyAccounts.map(a => (a.id === id ? account : a)) : [...data.moneyAccounts, account] } }
}

/** Deletes an account and its balances. A savings account that goal movements point at is kept. */
export function deleteAccount(data: FinanceData, id: Id): FinanceData | null {
  if (data.goalMovements.some(movement => movement.accountId === id)) return null
  return { ...data, moneyAccounts: data.moneyAccounts.filter(a => a.id !== id), balances: data.balances.filter(b => b.accountId !== id) }
}
