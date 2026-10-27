import { describe, expect, it } from 'vitest'
import { createAlexDemo } from '../../data/fixtures/demoAlex'
import { debtMonthPayment, summarizeCards } from './debts'
import { activityLog } from './history'
import { saveExpense, stampNewRecords } from './records'
import { addGoalMovement } from './goals'
import { setBillPaid } from './bills'
import type { FinanceData, GoalMovement } from './types'

const expense = (data: FinanceData, id: string, date = '2026-12-31') =>
  saveExpense(data, id, { date, amount: 1_000, category: 'Groceries', description: id, accountId: 'everyday', nature: 'regular' }, '2026-12-31')

function added(data: FinanceData, id: string, now: string) {
  const result = expense(data, id)
  if (result.status !== 'ok') throw new Error('not saved')
  return stampNewRecords(data, result.data, now)
}

describe('History order', () => {
  it('lists records entered in the app newest first, before older same-day records', () => {
    let data = createAlexDemo()
    data = added(data, 'first', '2027-01-05T10:00:00.000Z')
    data = added(data, 'second', '2027-01-05T10:00:05.000Z')
    const day = activityLog(data).filter(entry => entry.date === '2026-12-31')
    expect(day[0].label).toBe('second')
    expect(day[1].label).toBe('first')
    // The demo's own records keep no time: none is invented for them.
    expect(day.slice(2).every(entry => entry.recordedAt === undefined)).toBe(true)
  })

  it('keeps the first time when a record is changed, and stamps only new records', () => {
    let data = added(createAlexDemo(), 'lunch', '2027-01-05T10:00:00.000Z')
    const changed = expense(data, 'lunch')
    if (changed.status !== 'ok') throw new Error('not saved')
    data = stampNewRecords(data, changed.data, '2027-01-06T09:00:00.000Z')
    expect(data.expenses.find(e => e.id === 'lunch')?.recordedAt).toBe('2027-01-05T10:00:00.000Z')
    expect(data.expenses.filter(e => e.recordedAt !== undefined)).toHaveLength(1)
    expect(data.goalMovements.some(m => m.recordedAt !== undefined)).toBe(false)
  })

  it('marks the time a bill is paid, and drops it when it is unpaid again', () => {
    const before = createAlexDemo()
    const paid = stampNewRecords(before, setBillPaid(before, 'phone', '2026-12', true, '2026-12-31'), '2027-01-05T10:00:00.000Z')
    const record = paid.billMonths.find(r => r.billId === 'phone' && r.month === '2026-12')
    expect(record?.recordedAt).toBe('2027-01-05T10:00:00.000Z')
    const unpaid = stampNewRecords(paid, setBillPaid(paid, 'phone', '2026-12', false), '2027-01-05T11:00:00.000Z')
    expect(unpaid.billMonths.find(r => r.billId === 'phone' && r.month === '2026-12')?.recordedAt).toBeUndefined()
  })

  it('is the same order every time for records without a time (later in its list is newer)', () => {
    const data = createAlexDemo()
    const first = activityLog(data).map(entry => entry.key)
    const second = activityLog({ ...data }).map(entry => entry.key)
    expect(second).toEqual(first)
  })

  it('lists a savings movement before the balance it updated, entered together', () => {
    const data = createAlexDemo()
    const moved = addGoalMovement(data, { id: 'm1', goalId: 'trip-to-japan', effect: 'new-savings', amount: 10_000, date: '2026-12-31', note: '', accountId: 'savings-account' })
    if (moved.status !== 'ok') throw new Error(moved.error)
    const stamped = stampNewRecords(data, moved.data, '2027-01-05T10:00:00.000Z')
    const day = activityLog(stamped).filter(entry => entry.date === '2026-12-31')
    expect(day.slice(0, 2).map(entry => entry.type)).toEqual(['savings', 'balance'])
  })
})

describe('History: savings movements say what they did', () => {
  it('uses the movement’s own effect, never the sign of the amount', () => {
    const detail = (effect: GoalMovement['effect'] | 'mystery') => {
      const data = createAlexDemo()
      const movement = { id: 'x', goalId: 'trip-to-japan', date: '2026-12-30', amount: effect === 'unassigned' || effect === 'taken-out' ? -100 : 100, note: '', effect, ...(effect === 'new-savings' || effect === 'taken-out' ? { accountId: 'savings-account' } : {}) } as GoalMovement
      return activityLog({ ...data, goalMovements: [...data.goalMovements, movement] }).find(entry => entry.key === 'movement:x')!.detail
    }
    expect(detail('new-savings')).toMatch(/^New savings · Into /)
    expect(detail('assigned')).toBe('From unassigned savings · Savings total unchanged')
    expect(detail('unassigned')).toBe('Back to unassigned savings · Savings total unchanged')
    expect(detail('taken-out')).toMatch(/^Taken out of savings · From /)
    expect(detail('mystery')).toBe('Savings movement (where it came from is not recorded)')
  })
})

describe('Card payments by month', () => {
  it('shows the month’s own amount, as Monthly Bills does, and keeps the usual one for estimates', () => {
    const data = createAlexDemo()
    const card = data.debts.find(d => d.id === 'credit-card')!
    expect(debtMonthPayment(data, card, '2026-12')).toMatchObject({ amount: 248_927, usual: 30_000, changedThisMonth: true, due: true })
    expect(debtMonthPayment(data, card, '2027-01')).toMatchObject({ amount: 30_000, usual: 30_000, changedThisMonth: false })
    const december = summarizeCards(data, '2026-12')
    expect(december.items.find(i => i.debt.id === 'credit-card')?.payment.amount).toBe(248_927)
  })
})
