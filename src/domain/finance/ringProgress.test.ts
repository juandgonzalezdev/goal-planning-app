import { describe, expect, it } from 'vitest'
import { createAlexDemo } from '../../data/fixtures/demoAlex'
import { billsRingProgress, debtsRingProgress, goalsRingProgress, incomeRingProgress } from './goalRings'

describe('real ring progress', () => {
  it('distinguishes absent, expected, received and mixed income including extra income', () => {
    const data = createAlexDemo()
    const source = { ...data.incomeSources[0], amount: 10000, startMonth: '2026-01', endMonth: '2026-12' }
    data.incomeSources = [source]; data.income = []
    expect(incomeRingProgress(data, '2026-12').percent).toBe(0)
    expect(incomeRingProgress(data, '2027-01').percent).toBeNull()
    const entry = { id: 'extra', memberId: source.memberId, month: '2026-12', receivedOn: '2026-12-01', amount: 5000, currency: source.currency, extraordinary: true }
    data.income = [entry]
    expect(incomeRingProgress(data, '2026-12').percent).toBeCloseTo(100 / 3)
    data.income = [{ ...entry, sourceId: source.id, amount: 15000 }]
    expect(incomeRingProgress(data, '2026-12')).toMatchObject({ received: 15000, expected: 0, percent: 100 })
    data.incomeSources = []
    data.income = [entry]
    expect(incomeRingProgress(data, '2026-12').percent).toBeNull()
    expect(incomeRingProgress(data, '2026-12').received).toBe(5000)
    data.incomeSources = [{ ...source, amount: 0 }]
    expect(incomeRingProgress(data, '2026-12').percent).toBeNull()
    data.incomeSources = [{ ...source, endMonth: '2026-11' }]
    expect(incomeRingProgress(data, '2026-12').percent).toBeNull()
    data.income = [{ ...entry, amount: 0 }]
    expect(incomeRingProgress(data, '2026-12').percent).toBeNull()
  })

  it('counts unknown amounts once and respects pauses, annual schedules and preserved payments', () => {
    const data = createAlexDemo()
    const bill = { ...data.bills[0], amount: null, startMonth: '2026-01', endMonth: null }
    data.bills = [bill, { ...bill, id: 'annual', frequency: 'yearly' }, { ...bill, id: 'paused', pausedMonths: ['2026-12'] }]
    data.billMonths = [{ billId: bill.id, month: '2026-12', paid: true }]
    expect(billsRingProgress(data, '2026-12')).toMatchObject({ count: 1, paidCount: 1, percent: 100 })
    data.bills[0].endMonth = '2026-06'
    expect(billsRingProgress(data, '2026-12')).toMatchObject({ count: 1, paidCount: 1 })
    expect(billsRingProgress(data, '2027-01')).toMatchObject({ count: 2, paidCount: 0, percent: 0 })
    data.bills = []
    expect(billsRingProgress(data, '2026-12').percent).toBeNull()
  })

  it('uses linked payment status, discloses unverified debts and never uses balances as progress', () => {
    const data = createAlexDemo()
    const debt = data.debts[0]
    data.debts = [debt, { ...debt, id: 'unlinked', monthlyPayment: 10000 }]
    const bill = { ...data.bills.find(b => b.debtId === debt.id)!, startMonth: '2026-01', endMonth: null }
    data.bills = [bill]; data.billMonths = []
    expect(debtsRingProgress(data, '2026-12')).toMatchObject({ count: 1, paidCount: 0, percent: 0, unverifiedCount: 1 })
    data.billMonths = [{ billId: bill.id, month: '2026-12', paid: true }]
    const paid = debtsRingProgress(data, '2026-12')
    expect(paid).toMatchObject({ count: 1, paidCount: 1, percent: 100 })
    data.debts.push({ ...debt, id: 'no-schedule', monthlyPayment: undefined })
    expect(debtsRingProgress(data, '2026-12').unverifiedCount).toBe(2)
    data.debts.pop()
    data.balances = []
    expect(debtsRingProgress(data, '2026-12')).toEqual(paid)
    data.billMonths = []; data.bills[0].pausedMonths = ['2026-12']
    data.debts[1].finalPaymentMonth = '2026-11'
    expect(debtsRingProgress(data, '2026-12')).toMatchObject({ count: 0, percent: null, unverifiedCount: 0 })
    data.debts[1].startMonth = '2027-01'; data.debts[1].finalPaymentMonth = undefined
    expect(debtsRingProgress(data, '2026-12').unverifiedCount).toBe(0)
  })

  it('caps each current active goal and excludes emergency, completed and untargeted goals', () => {
    const data = createAlexDemo(); const original = data.goals[0]
    data.goals = [
      { ...original, id: 'a', kind: 'goal', status: 'active', target: 100000, openingBalance: 120000 },
      { ...original, id: 'b', kind: 'goal', status: 'active', target: 100000, openingBalance: 20000 },
      { ...original, id: 'no', kind: 'goal', status: 'active', target: null },
      { ...original, id: 'emergency', kind: 'emergency', status: 'active', target: 100000 },
      { ...original, id: 'done', kind: 'goal', status: 'archived', target: 100000 },
    ]; data.goalMovements = []
    expect(goalsRingProgress(data)).toMatchObject({ saved: 140000, counted: 120000, target: 200000, percent: 60, withoutTargetCount: 1 })
    data.goalMovements = [{ id: 'move', goalId: 'b', amount: 10000, date: '2026-12-31', effect: 'assigned', note: '' }]
    expect(goalsRingProgress(data).percent).toBe(65)
    data.goals = [{ ...original, target: null }]; data.goalMovements = []
    expect(goalsRingProgress(data).percent).toBeNull()
    data.goals = [{ ...original, kind: 'goal', status: 'active', openingBalance: 0, target: 100000 }]
    expect(goalsRingProgress(data).percent).toBe(0)
  })
})
