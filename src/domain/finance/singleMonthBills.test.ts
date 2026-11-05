import { describe, expect, it } from 'vitest'
import { createDemoHousehold } from '../../data/fixtures/demoHousehold'
import { buildReport } from '../../report/report'
import { addBill, billsForMonth, groupBillsByDay, markBillPaid, updateBill, type BillFields } from './bills'
import { activityLog } from './history'
import { monthlyOverview, toPay } from './overview'
import { activeSubscriptions, applyCancel, applyPause, simulateSubscription, upcomingCharges } from './subscriptions'
import { validityOn } from './validity'
import type { FinanceData } from './types'

const fields: BillFields = { name: 'Single visit', category: 'Other', owner: 'shared', dueDay: 2,
  startMonth: '2026-11', endMonth: '2026-11', note: '', debtId: null }
const base = (): FinanceData => ({ ...createDemoHousehold(), bills: [], billMonths: [] })
function added(overrides: Partial<BillFields> = {}, yearly = false) {
  const result = addBill(base(), 'single', { ...fields, ...overrides }, 12345, yearly ? 'yearly' : 'monthly')
  if (result.status !== 'ok') throw new Error(result.errors.join(','))
  return result.data
}

describe('single-month bills across consumers', () => {
  it('calendar and monthly totals include exactly one occurrence, with no retroactive or later bills', () => {
    const data = added()
    for (const month of ['2026-10', '2026-12', '2027-11']) {
      expect(billsForMonth(data, month)).toEqual([])
      expect(monthlyOverview(data, month).monthlyCommitments).toBe(0)
    }
    expect(groupBillsByDay(billsForMonth(data, '2026-11'))).toMatchObject([{ dueDate: '2026-11-02', summary: { count: 1, knownTotal: 12345 } }])
    expect(monthlyOverview(data, '2026-11').monthlyCommitments).toBe(12345)
  })
  it('All Bills validity includes the month itself and keeps ended bills available', () => {
    const bill = added().bills[0]
    expect(validityOn(bill, '2026-10')).toBe('upcoming')
    expect(validityOn(bill, '2026-11')).toBe('active')
    expect(validityOn(bill, '2026-12')).toBe('ended')
  })
  it('Coming up shows the single charge only in its seven-day window', () => {
    const data = added()
    expect(toPay(data, '2026-10', '2026-10-28').comingUp?.bills.map(o => o.bill.id)).toEqual(['single'])
    expect(toPay(data, '2026-11', '2026-11-28').comingUp).toBeNull()
  })
  it('subscription projections and pauses cannot invent future charges', () => {
    const data = added({ category: 'Subscriptions' })
    expect(activeSubscriptions(data, '2026-12-01')).toEqual([])
    expect(upcomingCharges(data, data.bills[0], '2026-10-28', 12)).toHaveLength(1)
    const simulation = simulateSubscription(data, 'single', 'pause', '2026-10-28')!
    expect(simulation.charges.map(c => c.month)).toEqual(['2026-11'])
    expect(billsForMonth(applyPause(data, simulation), '2026-11')).toEqual([])
  })
  it('cancels a single-month subscription before its first charge without keeping it due', () => {
    const data = added({ category: 'Subscriptions' })
    const simulation = simulateSubscription(data, 'single', 'cancel', '2026-10-28')!
    const cancelled = applyCancel(data, simulation)
    expect(billsForMonth(cancelled, '2026-11')).toEqual([])
    expect(upcomingCharges(cancelled, cancelled.bills[0], '2026-10-28', 12)).toEqual([])
    expect(cancelled.billMonths).toEqual(data.billMonths)
    expect(validityOn(cancelled.bills[0], '2026-10')).toBe('ended')
    expect(validityOn(cancelled.bills[0], '2026-11')).toBe('ended')
    expect(activeSubscriptions(cancelled, '2026-10-28')).toEqual([])
  })
  it('yearly bills respect both a one-month boundary and their original anniversary', () => {
    const single = added({}, true)
    expect(billsForMonth(single, '2026-11')).toHaveLength(1)
    expect(billsForMonth(single, '2027-11')).toEqual([])
    const yearly = added({ endMonth: null }, true)
    expect(billsForMonth(yearly, '2026-10')).toEqual([])
    expect(billsForMonth(yearly, '2026-12')).toEqual([])
    expect(billsForMonth(yearly, '2027-11')).toHaveLength(1)
  })
  it('a later detail edit keeps payment date, amount, account, History and earlier periods', () => {
    const data = added()
    const paid = markBillPaid(data, 'single', '2026-11', { amount: 12000, paidOn: '2026-11-03', paidFrom: null, interest: null }, '2026-11-03')
    const before = activityLog(paid)
    const edited = updateBill(paid, 'single', { ...fields, note: 'Receipt kept' })
    if (edited.status !== 'ok') throw new Error('Edit failed')
    expect(edited.data.billMonths).toEqual(paid.billMonths)
    expect(activityLog(edited.data)).toEqual(before)
    expect(before.filter(e => e.type === 'bill')).toMatchObject([{ month: '2026-11', date: '2026-11-03', amount: -12000 }])
    expect(monthlyOverview(edited.data, '2026-11')).toEqual(monthlyOverview(paid, '2026-11'))
    expect(billsForMonth(edited.data, '2026-12')).toEqual([])
  })
  it('PDF pending bills include the selected month only', () => {
    const data = added()
    const pdf = (month: string) => buildReport(data, { period: { kind: 'month', month }, today: '2026-11-01', generatedOn: '2026-11-01', includeAmounts: true, isDemo: true }).toString()
    expect(pdf('2026-11')).toContain('Single visit')
    expect(pdf('2026-10')).not.toContain('Single visit')
    expect(pdf('2026-12')).not.toContain('Single visit')
  })
  it('adding an unrelated single-month bill leaves existing history and loan relationships unchanged', () => {
    const data = createDemoHousehold()
    const before = activityLog(data)
    const result = addBill(data, 'single', fields, 12345)
    if (result.status !== 'ok') throw new Error('Add failed')
    expect(result.data.debts).toEqual(data.debts)
    expect(result.data.bills.slice(0, -1)).toEqual(data.bills)
    expect(result.data.billMonths).toEqual(data.billMonths)
    expect(activityLog(result.data)).toEqual(before)
  })
})
