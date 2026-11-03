import { describe, expect, it } from 'vitest'
import { createAlexDemo } from '../../data/fixtures/demoAlex'
import { deleteAccount } from './moneyAccounts'
import type { FinanceData } from './types'

const emptyAccount = (): FinanceData => {
  const data = createAlexDemo()
  data.moneyAccounts.push({ id: 'unused', name: 'Unused', kind: 'daily-spending', owner: 'alex', currency: 'PLN' })
  return data
}

describe('preserving account history', () => {
  it.each(['payment', 'income', 'expense', 'transfer-from', 'transfer-to', 'goal'] as const)('blocks deletion with a linked %s', kind => {
    const data = emptyAccount()
    if (kind === 'payment') data.billMonths.push({ billId: 'phone', month: '2027-01', paid: true, paidFrom: 'unused', paidOn: '2026-12-31' })
    if (kind === 'income') data.income.push({ ...data.income[0], id: 'linked', accountId: 'unused' })
    if (kind === 'expense') data.expenses.push({ ...data.expenses[0], id: 'linked', accountId: 'unused' })
    if (kind === 'transfer-from' || kind === 'transfer-to') data.transfers.push({ id: 'linked', date: '2026-12-31', amount: 100, currency: 'PLN', fromAccountId: kind === 'transfer-from' ? 'unused' : 'everyday', toAccountId: kind === 'transfer-to' ? 'unused' : 'everyday', note: '' })
    if (kind === 'goal') data.goalMovements.push({ ...data.goalMovements[0], id: 'linked', accountId: 'unused' })
    const before = structuredClone(data)
    expect(deleteAccount(data, 'unused')).toBeNull()
    expect(data).toEqual(before)
  })
  it('deletes an account with only balances and removes only its snapshots', () => {
    const data = emptyAccount()
    data.balances.push({ ...data.balances[0], id: 'initial', accountId: 'unused' }, { ...data.balances[0], id: 'later', accountId: 'unused' })
    const before = structuredClone(data)
    const after = deleteAccount(data, 'unused')!
    expect(after.moneyAccounts.some(account => account.id === 'unused')).toBe(false)
    expect(after.balances).toEqual(before.balances.filter(record => record.accountId !== 'unused'))
    expect(data).toEqual(before)
  })
  it('keeps the account and all its balances when a payment references it', () => {
    const data = emptyAccount()
    data.balances.push({ ...data.balances[0], id: 'initial', accountId: 'unused' })
    data.billMonths.push({ billId: 'phone', month: '2027-01', paid: true, paidFrom: 'unused', paidOn: '2026-12-31' })
    const before = structuredClone(data)
    expect(deleteAccount(data, 'unused')).toBeNull()
    expect(data).toEqual(before)
  })
  it('allows deletion when no records reference the account', () => {
    const data = emptyAccount()
    const after = deleteAccount(data, 'unused')!
    expect(after.moneyAccounts.some(account => account.id === 'unused')).toBe(false)
    expect(after.balances).toEqual(data.balances)
  })
})
