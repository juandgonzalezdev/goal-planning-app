import { describe, expect, it } from 'vitest'
import { createDemoHousehold } from '../../data/fixtures/demoHousehold'
import { exportFinanceData, importFinanceData } from '../../data/exchange'
import { buildReport } from '../../report/report'
import { addBill, billsForMonth, deleteBill, markBillNotPaid, markBillPaid, updateBill, type BillFields } from './bills'
import { accountFlows } from './flows'
import { activityLog } from './history'
import { monthlyOverview } from './overview'
import { monthResult } from './spending'
import { applyCancel, applyPause, simulateSubscription } from './subscriptions'
import type { FinanceData, RecurringBill } from './types'

const fields: BillFields = { name: 'Integrity Stream', category: 'Subscriptions', owner: 'shared', dueDay: 5,
  startMonth: '2026-01', endMonth: null, note: '', debtId: null }
function fresh(frequency: RecurringBill['frequency'] = 'monthly'): FinanceData {
  const seed = createDemoHousehold()
  const result = addBill({ ...seed, bills: [], billMonths: [], income: [], expenses: [], transfers: [], debts: [], goals: [], goalMovements: [], balances: [] }, 'integrity', fields, 12345, frequency)
  if (result.status !== 'ok') throw Error('setup')
  return result.data
}
function paid(month = '2026-04', data = fresh()) {
  return markBillPaid(data, 'integrity', month, { amount: 12345, paidOn: '2026-02-01',
    paidFrom: data.moneyAccounts[0].id, interest: null }, '2026-02-01')
}
const legacy = (data: FinanceData, changes: Partial<RecurringBill>): FinanceData => ({ ...data, bills: data.bills.map(b => ({ ...b, ...changes })) })
const pdf = (data: FinanceData, year = false, includeAmounts = true) => buildReport(data, {
  period: year ? { kind: 'year', year: 2026 } : { kind: 'month', month: '2026-04' },
  today: '2026-12-31', generatedOn: '2026-12-31', includeAmounts, isDemo: true,
}).toString()

describe('recorded payments survive plan changes', () => {
  it.each([{ endMonth: '2026-02' }, { pausedMonths: ['2026-04'] }, { frequency: 'yearly' as const }])('does not unpay a recorded payment outside the calendar %j', changes => {
    const before = legacy(paid(), changes)
    const after = markBillNotPaid(before, 'integrity', '2026-04')
    expect(after).toBe(before)
    expect(activityLog(after).filter(e => e.type === 'bill')).toHaveLength(1)
    expect(billsForMonth(after, '2026-04')).toHaveLength(1)
    expect(monthResult(after, '2026-04', '2026-12-31')).toMatchObject({ spending: { total: 12345 }, pending: [] })
    expect(pdf(after)).toBe(pdf(before))
  })
  it.each([{ pausedMonths: ['2026-04'] }, { frequency: 'yearly' as const }])('allows independent date changes on restored data %j', changes => {
    const before = legacy(paid(), changes)
    const edited = updateBill(before, 'integrity', { ...fields, endMonth: '2026-12' })
    expect(edited.status).toBe('ok')
    if (edited.status !== 'ok') throw Error('edit')
    expect(edited.data.billMonths).toEqual(before.billMonths)
    expect(billsForMonth(edited.data, '2026-04')).toHaveLength(1)
    expect(activityLog(edited.data)).toEqual(activityLog(before))
    expect(monthResult(edited.data, '2026-04', '2026-12-31')).toEqual(monthResult(before, '2026-04', '2026-12-31'))
    expect(pdf(edited.data)).toBe(pdf(before))
  })
  it('blocks an additional excluded payment but not a pre-existing paused payment', () => {
    const before = legacy(paid(), { pausedMonths: ['2026-04'] })
    const withNewPayment = markBillPaid(before, 'integrity', '2026-06', { amount: 12345, paidOn: '2026-02-01', paidFrom: null, interest: null }, '2026-02-01')
    expect(updateBill(withNewPayment, 'integrity', { ...fields, endMonth: '2026-05' })).toEqual({ status: 'invalid', errors: ['end-excludes-payment'] })
    expect(updateBill(withNewPayment, 'integrity', { ...fields, endMonth: '2026-06' }).status).toBe('ok')
  })
  it('assigns an end conflict to End month even when Start month also changes', () => {
    expect(updateBill(paid(), 'integrity', { ...fields, startMonth: '2025-12', endMonth: '2026-02' }))
      .toEqual({ status: 'invalid', errors: ['end-excludes-payment'] })
  })
  it('allows safe pause and cancellation despite a pre-existing paid pause', () => {
    const before = legacy(paid(), { pausedMonths: ['2026-04'] })
    for (const kind of ['pause', 'cancel'] as const) {
      const sim = simulateSubscription(before, 'integrity', kind, '2026-05-01')!
      const after = kind === 'pause' ? applyPause(before, sim) : applyCancel(before, sim)
      expect(after).not.toBe(before)
      expect(after.billMonths).toEqual(before.billMonths)
      expect(activityLog(after)).toEqual(activityLog(before))
      expect(pdf(after)).toBe(pdf(before))
    }
  })
  it.each([
    { endMonth: '2026-02' }, { pausedMonths: ['2026-04'] }, { startMonth: '2026-05' },
    { frequency: 'yearly' as const },
  ])('reads restored payments exactly once despite incompatible plan %j', changes => {
    const before = paid()
    const after = legacy(before, changes)
    const restored = importFinanceData(exportFinanceData(after))
    expect(restored.status).toBe('imported')
    if (restored.status !== 'imported') throw Error('restore')
    expect(restored.data.billMonths).toEqual(before.billMonths)
    expect(activityLog(restored.data).filter(e => e.type === 'bill')).toEqual(activityLog(before).filter(e => e.type === 'bill'))
    expect(billsForMonth(restored.data, '2026-04')).toHaveLength(1)
    expect(monthResult(restored.data, '2026-04', '2026-12-31')).toMatchObject({
      planned: { knownTotal: 12345, paidCount: 1, count: 1, leftToPay: 0 },
      spending: { total: 12345 }, result: -12345, cashFlow: { moneyOut: 12345 }, pending: [],
    })
    expect(monthlyOverview(restored.data, '2026-04')).toEqual(monthlyOverview(before, '2026-04'))
    expect(accountFlows(restored.data)).toEqual(accountFlows(before))
    expect(pdf(restored.data)).toContain('123.45')
    expect(pdf(restored.data, true)).toContain('123.45')
    expect(pdf(restored.data, false, false)).not.toContain('123.45')
  })
  it.each([{ endMonth: '2026-02' }, { startMonth: '2026-05' }])('rejects an edit excluding a payment %j without mutating data', changes => {
    const before = paid()
    const copy = structuredClone(before)
    expect(updateBill(before, 'integrity', { ...fields, ...changes }).status).toBe('invalid')
    expect(before).toEqual(copy)
  })
  it('rejects an annual anniversary change that would exclude a paid month', () => {
    const data = paid('2027-01', fresh('yearly'))
    expect(updateBill(data, 'integrity', { ...fields, startMonth: '2026-02' }).status).toBe('invalid')
  })
  it('allows a compatible end and note edits on restored data without changing payments', () => {
    const data = paid()
    const edit = updateBill(data, 'integrity', { ...fields, endMonth: '2026-04' })
    expect(edit.status).toBe('ok')
    if (edit.status === 'ok') expect(edit.data.billMonths).toEqual(data.billMonths)
    const old = legacy(data, { endMonth: '2026-02' })
    expect(updateBill(old, 'integrity', { ...fields, endMonth: '2026-02', note: 'Receipt kept' }).status).toBe('ok')
  })
  it('blocks fresh cancellation before a later prepaid month', () => {
    const before = paid()
    const sim = simulateSubscription(before, 'integrity', 'cancel', '2026-02-01')!
    expect(sim.charges[0].month).toBe('2026-02')
    expect(applyCancel(before, sim)).toBe(before)
  })
  it('blocks cancellation before a later prepaid annual charge', () => {
    const before = paid('2028-01', fresh('yearly'))
    const sim = simulateSubscription(before, 'integrity', 'cancel', '2026-02-01')!
    expect(sim.charges[0].month).toBe('2027-01')
    expect(applyCancel(before, sim)).toBe(before)
  })
  it('rejects a stale pause after its month has been paid', () => {
    const sim = simulateSubscription(fresh(), 'integrity', 'pause', '2026-02-01')!
    const before = paid()
    expect(applyPause(before, sim)).toBe(before)
  })
  it('a fresh pause skips paid months and keeps their financial data', () => {
    const before = paid()
    const sim = simulateSubscription(before, 'integrity', 'pause', '2026-02-01')!
    expect(sim.charges.map(c => c.month)).toEqual(['2026-02', '2026-03', '2026-05'])
    const after = applyPause(before, sim)
    expect(after.billMonths).toEqual(before.billMonths)
    expect(activityLog(after)).toEqual(activityLog(before))
    expect(pdf(after)).toBe(pdf(before))
  })
  it('normal cancellation and cancellation before the first charge still work', () => {
    const before = paid('2026-01')
    const after = applyCancel(before, simulateSubscription(before, 'integrity', 'cancel', '2026-02-01')!)
    expect(after.bills[0].endMonth).toBe('2026-01')
    expect(activityLog(after)).toEqual(activityLog(before))
    const data = fresh()
    const first = applyCancel(data, simulateSubscription(data, 'integrity', 'cancel', '2025-12-01')!)
    expect(billsForMonth(first, '2026-01')).toEqual([])
    expect(first.billMonths).toEqual([])
  })
  it('does not fabricate pending bills from unpaid restored records outside the plan', () => {
    const data = legacy(fresh(), { endMonth: '2026-02' })
    data.billMonths = [{ billId: 'integrity', month: '2026-04', paid: false, amount: 12345 }]
    expect(billsForMonth(data, '2026-04')).toEqual([])
  })
  it('keeps unknown and zero payments without guessing an amount or creating duplicates', () => {
    const data = legacy(paid(), { pausedMonths: ['2026-04'] })
    for (const amount of [null, 0]) {
      const changed = { ...data, billMonths: data.billMonths.map(r => ({ ...r, amount })) }
      expect(activityLog(changed).filter(e => e.type === 'bill')).toMatchObject([{ amount: amount === null ? null : -0 }])
      expect(monthResult(changed, '2026-04', '2026-12-31').planned).toMatchObject({ paidCount: 1, count: 1, leftToPay: 0, unknownCount: amount === null ? 1 : 0 })
    }
  })
  it('preserves loan principal, interest, account flows and Remaining Balance for legacy payments', () => {
    let data = fresh()
    data = { ...data, debts: [{ id: 'loan', name: 'Invented Loan', kind: 'loan', owner: 'shared', currency: data.space.currency, yearlyInterestBasisPoints: 0, dueDay: 5 }],
      balances: [{ id: 'balance', accountId: 'loan', amount: 90000, currency: data.space.currency, asOf: '2026-01-31', source: 'entered' }],
      bills: data.bills.map(b => ({ ...b, debtId: 'loan', category: 'Loans' })) }
    const before = markBillPaid(data, 'integrity', '2026-04', { amount: 12345, paidOn: '2026-02-01', paidFrom: data.moneyAccounts[0].id, interest: 2345 }, '2026-02-01')
    const after = legacy(before, { endMonth: '2026-02' })
    expect(monthResult(after, '2026-04', '2026-12-31').spending.total).toBe(2345)
    expect(accountFlows(after)).toEqual(accountFlows(before))
    expect(accountFlows(after).find(f => f.kind === 'repayment')?.amount).toBe(-10000)
    expect(activityLog(after)).toEqual(activityLog(before))
    expect(after.balances).toEqual(before.balances)
  })
  it('explicit deletion removes only this bill and its payments, leaving debt, balances and other records', () => {
    const data = paid()
    const other = { ...data.bills[0], id: 'other' }
    const before = { ...data, bills: [...data.bills, other], billMonths: [...data.billMonths, { ...data.billMonths[0], billId: 'other' }] }
    const after = deleteBill(before, 'integrity')
    expect(after).toEqual({ ...before, bills: [other], billMonths: [before.billMonths[1]] })
    expect(activityLog(after).filter(e => e.type === 'bill')).toHaveLength(1)
  })
})
