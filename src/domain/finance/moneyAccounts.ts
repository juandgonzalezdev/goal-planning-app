import type { CalendarDate } from '../goalTime'
import type { MoneyAmount } from '../goalAmounts'
import { sumMinor } from '../money'
import { latestBalance } from './balances'
import { MONEY_ACCOUNT_KINDS, type FinanceData, type MoneyAccount, type MoneyAccountKind } from './types'

export interface MoneyAccountItem {
  account: MoneyAccount
  balance: MoneyAmount | null
  asOf: CalendarDate | null
}

export interface MoneySummary {
  items: MoneyAccountItem[]
  /** Total per kind, in the fixed order daily spending, investment, emergency, other. */
  byKind: { kind: MoneyAccountKind; total: MoneyAmount }[]
  /**
   * Everything entered, added up. Not all of it can be spent today, and it
   * is never netted against debt. Goals are not added: a goal sets money
   * aside, it is not extra money.
   */
  total: MoneyAmount
  missingBalanceCount: number
}

export function summarizeMoney(data: Pick<FinanceData, 'moneyAccounts' | 'balances'>): MoneySummary {
  const items = data.moneyAccounts.map(account => {
    const snapshot = latestBalance(data.balances, account.id)
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
