import { describe, expect, it } from 'vitest'
import { createAlexDemo } from '../../data/fixtures/demoAlex'
import { goalMonthPosition, nextDebtPayment } from './goalRings'

describe('rings calendar facts', () => {
  it('counts calendar months independently of saved money, including no deadline', () => {
    const goal = { ...createAlexDemo().goals[0], createdOn: '2026-09-01', deadline: '2027-06-01' }
    expect(goalMonthPosition(goal, '2026-12-31')).toEqual({ current: 4, total: 10 })
    expect(goalMonthPosition({ ...goal, openingBalance: 999999 }, '2026-12-31')).toEqual({ current: 4, total: 10 })
    expect(goalMonthPosition({ ...goal, deadline: null }, '2026-12-31')).toBeNull()
    expect(goalMonthPosition(goal, '2028-01-01')).toEqual({ current: 10, total: 10 })
  })

  it('takes next payment from the linked bill and skips a paid month', () => {
    const data = createAlexDemo()
    const debt = data.debts[0]
    const original = data.bills.find(b => b.debtId === debt.id)!
    data.bills = [{ ...original, dueDay: 15, endMonth: null }]
    data.billMonths = [{ billId: original.id, month: '2026-12', paid: true }]
    expect(nextDebtPayment(data, debt, '2026-12-01')?.dueDate).toBe('2027-01-15')
    data.bills = [{ ...data.bills[0], endMonth: '2026-12' }]
    expect(nextDebtPayment(data, debt, '2026-12-01')).toBeNull()
  })

  it('keeps an own payment on its due day and respects the final month', () => {
    const data = createAlexDemo(); data.bills = []
    const debt = { ...data.debts[0], dueDay: 15, monthlyPayment: 12345, startMonth: '2026-01', finalPaymentMonth: '2026-12' }
    expect(nextDebtPayment(data, debt, '2026-12-15')).toMatchObject({ dueDate: '2026-12-15', amount: 12345 })
    expect(nextDebtPayment(data, debt, '2026-12-16')).toBeNull()
  })
})
