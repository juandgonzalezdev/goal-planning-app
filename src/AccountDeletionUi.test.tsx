// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AccountsSection } from './features/money/AccountsSection'
import { INITIAL_MONEY_VIEW, MoneyBlocksContext, type MoneyView } from './features/money/moneyBlocks'
import type { SectionProps } from './features/money/MoneyScreen'
import { createAlexDemo } from './data/fixtures/demoAlex'
import { fire } from './test/space'

afterEach(cleanup)

describe('account deletion revalidation', () => {
  it('does not announce deletion if a reference is found when the change runs', async () => {
    const data = createAlexDemo()
    data.moneyAccounts.push({ id: 'test-delete', name: 'Test Delete', kind: 'daily-spending', owner: 'alex', currency: 'PLN' })
    const current = structuredClone(data)
    current.billMonths.push({ billId: 'phone', month: '2027-01', paid: true, paidFrom: 'test-delete', paidOn: '2026-12-31' })
    const say = vi.fn()
    const tell = vi.fn()
    const onChange = vi.fn<SectionProps['onChange']>(async change => {
      expect(change(current)).toBe(current)
      return 'saved'
    })
    const view: MoneyView = { ...INITIAL_MONEY_VIEW, open: ['accounts'], account: 'test-delete' }
    const props: SectionProps = {
      data, today: '2026-12-31', month: '2026-12', months: ['2026-12'], owner: 'alex', isDemo: false,
      newId: () => 'unused', view, onViewChange: vi.fn(), onMonthChange: vi.fn(), onOpenDebt: vi.fn(),
      onOpenGoal: vi.fn(), onOpenReports: vi.fn(), onChange, say, tell,
    }
    render(<MoneyBlocksContext.Provider value={{ view, onViewChange: props.onViewChange }}><AccountsSection {...props} /></MoneyBlocksContext.Provider>)
    await fire.click(screen.getByRole('button', { name: 'Delete: Test Delete' }))
    await fire.click(screen.getByRole('button', { name: 'Delete Account and Balances' }))
    expect(onChange).toHaveBeenCalledOnce()
    expect(say).not.toHaveBeenCalled()
    expect(tell).toHaveBeenCalledWith(expect.stringContaining('bill payments'))
    expect(screen.getByRole('group', { name: 'Delete Test Delete?' })).toBeTruthy()
    expect(current.moneyAccounts.some(account => account.id === 'test-delete')).toBe(true)
  })
})
