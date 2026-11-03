import { describe, expect, it } from 'vitest'
import { ALEX_DEMO_TODAY, createAlexDemo } from '../../data/fixtures/demoAlex'
import { addDays } from '../calendar'
import { formatDayRange } from '../../ui/format'
import { markBillNotPaid } from './bills'
import { toPay } from './overview'
import { monthResult } from './spending'

// Left to Pay with an explicit reference (Rumbo de diseño §6): the month of today, a past
// month and a future month are told apart, and Coming up never joins the month's total.
const names = (list: { bill: { name: string } }[]) => list.map(item => item.bill.name)

describe('toPay', () => {
  it('in the month of today: overdue before today, due later from today, and Coming up apart', () => {
    const data = markBillNotPaid(createAlexDemo(), 'utilities', '2026-12')
    const plan = toPay(data, '2026-12', ALEX_DEMO_TODAY)
    expect(plan.period).toBe('current')
    expect(names(plan.overdue)).toEqual(['Utilities'])
    expect(names(plan.open)).toEqual(['Phone & Internet'])
    // 31 Dec + 7 days: January's unpaid bills due 1 to 7 January, in date order.
    expect(plan.comingUp).toMatchObject({ month: '2027-01', from: '2027-01-01', to: '2027-01-07' })
    expect(names(plan.comingUp!.bills)).toEqual(['Gym Membership', 'Transit Pass', 'Music Streaming'])
    expect(plan.comingUp!.bills.every(bill => bill.month === '2027-01')).toBe(true)
  })

  it('Coming up is never added to the month’s Left to Pay', () => {
    const data = createAlexDemo()
    const december = monthResult(data, '2026-12', ALEX_DEMO_TODAY).planned
    expect(december.leftToPay).toBe(6_999)
    expect(toPay(data, '2026-12', ALEX_DEMO_TODAY).comingUp!.bills.length).toBeGreaterThan(0)
  })

  it('has no Coming up while the next seven days stay in the same month', () => {
    expect(toPay(createAlexDemo(), '2026-12', '2026-12-20').comingUp).toBeNull()
    expect(toPay(createAlexDemo(), '2026-12', '2026-12-24').comingUp).toBeNull()
    expect(names(toPay(createAlexDemo(), '2026-12', '2026-12-25').comingUp!.bills)).toEqual(['Gym Membership', 'Transit Pass'])
    // Only bills not paid yet: December's first-of-the-month bills are paid in the demo.
    expect(toPay(createAlexDemo(), '2026-11', '2026-11-25').comingUp).toBeNull()
    expect(toPay(markBillNotPaid(createAlexDemo(), 'gym', '2026-12'), '2026-11', '2026-11-25').comingUp).toMatchObject({ month: '2026-12', to: '2026-12-02' })
  })

  it('a past month lists what was not marked as paid, with nothing counted from today', () => {
    const data = markBillNotPaid(createAlexDemo(), 'music', '2026-08')
    const plan = toPay(data, '2026-08', ALEX_DEMO_TODAY)
    expect(plan).toMatchObject({ period: 'past', overdue: [], comingUp: null })
    expect(names(plan.open)).toEqual(['Music Streaming'])
  })

  it('a future month lists what is planned, without Overdue or Coming up', () => {
    const plan = toPay(createAlexDemo(), '2027-01', ALEX_DEMO_TODAY)
    expect(plan).toMatchObject({ period: 'future', overdue: [], comingUp: null })
    expect(plan.open.length).toBe(11)
  })

  it('never brings unpaid bills of earlier months into the month shown', () => {
    const data = markBillNotPaid(createAlexDemo(), 'music', '2026-11')
    const plan = toPay(data, '2026-12', ALEX_DEMO_TODAY)
    expect([...plan.overdue, ...plan.open].every(bill => bill.month === '2026-12')).toBe(true)
    expect(monthResult(data, '2026-12', ALEX_DEMO_TODAY).planned.leftToPay).toBe(6_999)
  })
})

describe('dates', () => {
  it('adds days across months, years and leap days', () => {
    expect(addDays('2026-12-31', 7)).toBe('2027-01-07')
    expect(addDays('2028-02-26', 7)).toBe('2028-03-04')
    expect(addDays('2027-02-26', 3)).toBe('2027-03-01')
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28')
  })

  it('writes a short range of days', () => {
    expect(formatDayRange('2027-01-01', '2027-01-07')).toBe('1–7 Jan')
    expect(formatDayRange('2026-12-30', '2027-01-05')).toBe('30 Dec – 5 Jan')
  })
})
