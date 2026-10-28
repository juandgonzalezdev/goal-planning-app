import { describe, expect, it } from 'vitest'
import { monthWeeks, weekdayIndexMondayFirst } from '../../domain/calendar'
import { billsForMonth, type BillOccurrence } from '../../domain/finance/bills'
import type { RecurringBill } from '../../domain/finance/types'
import { cellBills, filterBills, scheduleSentence, selectedDay, shortDay } from './billsView'

const bill = (id: string, dueDay: number, extra: Partial<RecurringBill> = {}): RecurringBill =>
  ({ id, name: id, category: 'Other', owner: 'shared', amount: 1_000, currency: 'PLN', dueDay, startMonth: '2027-01', endMonth: null, ...extra })
const due = (bills: RecurringBill[], month: string) => billsForMonth({ bills, billMonths: [] }, month).map(o => o.dueDate)

describe('monthWeeks', () => {
  it('starts on Monday and fills a whole number of weeks', () => {
    expect(weekdayIndexMondayFirst('2028-02-01')).toBe(1) // Tuesday
    const weeks = monthWeeks('2028-02')
    expect(weeks.every(week => week.length === 7)).toBe(true)
    expect(weeks[0].slice(0, 2)).toEqual([null, '2028-02-01'])
    expect(weeks.flat().filter(Boolean)).toHaveLength(29)
    // February 2027 starts on a Monday and has 28 days: exactly four weeks.
    expect(monthWeeks('2027-02')).toHaveLength(4)
    expect(monthWeeks('2027-02')[3][6]).toBe('2027-02-28')
  })
})

describe('due dates on the calendar', () => {
  it('moves day 29, 30 and 31 to the last day of a shorter month', () => {
    const bills = [bill('d29', 29), bill('d30', 30), bill('d31', 31)]
    expect(due(bills, '2027-02')).toEqual(['2027-02-28', '2027-02-28', '2027-02-28'])
    expect(due(bills, '2028-02')).toEqual(['2028-02-29', '2028-02-29', '2028-02-29'])
    expect(due(bills, '2027-04')).toEqual(['2027-04-29', '2027-04-30', '2027-04-30'])
  })
  it('shows a bill only from its first to its last month', () => {
    const bills = [bill('ends', 5, { endMonth: '2027-03' }), bill('starts', 5, { startMonth: '2027-03' })]
    expect(billsForMonth({ bills, billMonths: [] }, '2027-02').map(o => o.bill.id)).toEqual(['ends'])
    expect(billsForMonth({ bills, billMonths: [] }, '2027-03').map(o => o.bill.id)).toEqual(['ends', 'starts'])
    expect(billsForMonth({ bills, billMonths: [] }, '2027-04').map(o => o.bill.id)).toEqual(['starts'])
  })
})

describe('Bills view helpers', () => {
  const occurrences = billsForMonth({ bills: [bill('a', 3), bill('b', 9), bill('c', 9)], billMonths: [{ billId: 'b', month: '2027-05', paid: true }] }, '2027-05')

  it('chooses the reference day in its month, else the first day with bills, else nothing', () => {
    expect(selectedDay('2027-05', null, '2027-05-20', occurrences)).toBe('2027-05-20')
    expect(selectedDay('2027-05', null, '2027-06-01', occurrences)).toBe('2027-05-03')
    expect(selectedDay('2027-05', '2027-05-09', '2027-05-20', occurrences)).toBe('2027-05-09')
    // A day chosen in another month is not reused.
    expect(selectedDay('2027-05', '2027-04-09', '2027-06-01', occurrences)).toBe('2027-05-03')
    expect(selectedDay('2027-05', null, '2027-06-01', [])).toBeNull()
  })

  it('filters Pending and Paid without touching the bills', () => {
    expect(filterBills(occurrences, 'paid').map(o => o.bill.id)).toEqual(['b'])
    expect(filterBills(occurrences, 'pending').map(o => o.bill.id)).toEqual(['a', 'c'])
    expect(filterBills(occurrences, 'all')).toHaveLength(3)
  })

  it('fits three bills in a cell, or two and “+N more”', () => {
    const many = Array.from({ length: 5 }, (_, i) => ({ bill: { id: String(i) } }) as BillOccurrence)
    expect(cellBills(many.slice(0, 3), 3)).toMatchObject({ more: 0 })
    expect(cellBills(many.slice(0, 3), 3).shown).toHaveLength(3)
    expect(cellBills(many.slice(0, 4), 3)).toMatchObject({ more: 2 })
    expect(cellBills(many, 3).shown).toHaveLength(2)
  })

  it('writes the check sentence of Add Bill', () => {
    expect(scheduleSentence({ dueDay: '22', startMonth: '2026-12', endMonth: '' })).toBe('Monthly on day 22, starting December 2026. No end date.')
    expect(scheduleSentence({ dueDay: '31', startMonth: '2026-12', endMonth: '2027-06' })).toBe('Monthly on day 31, starting December 2026, ending June 2027.')
    expect(scheduleSentence({ dueDay: '5', startMonth: '2026-12', endMonth: '' }, true)).toBe('Once a year in December, on day 5, starting December 2026. No end date.')
    expect(scheduleSentence({ dueDay: '5', startMonth: '2026-12', endMonth: '2026-03' })).toBe('Monthly on day 5, starting December 2026.')
    expect(scheduleSentence({ dueDay: '32', startMonth: '2026-12', endMonth: '' })).toBeNull()
    expect(scheduleSentence({ dueDay: '', startMonth: '2026-12', endMonth: '' })).toBeNull()
  })
})

describe('shortDay', () => {
  it('is the short day for the day bar, read from the text so no time zone can move it', () => {
    expect(shortDay('2026-12-22')).toBe('Tue 22 Dec')
    expect(shortDay('2028-02-29')).toBe('Tue 29 Feb')
    expect(shortDay('2027-01-01')).toBe('Fri 1 Jan')
  })
})
