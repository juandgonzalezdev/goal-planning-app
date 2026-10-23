import { describe, expect, it } from 'vitest'
import {
  addMonthsToYearMonth, countWeeklyOpportunities, dateInMonth, daysBetween,
  isCalendarDate, isYearMonth, monthsOfYear, yearMonthOf,
} from './calendar'

describe('calendar', () => {
  it('accepts only real dates in YYYY-MM-DD form', () => {
    expect(isCalendarDate('2026-12-25')).toBe(true)
    expect(isCalendarDate('2028-02-29')).toBe(true)
    expect(isCalendarDate('2026-02-29')).toBe(false)
    expect(isCalendarDate('2026-13-01')).toBe(false)
    expect(isCalendarDate('2026-1-01')).toBe(false)
    expect(isCalendarDate(null)).toBe(false)
  })

  it('accepts only real months in YYYY-MM form', () => {
    expect(isYearMonth('2026-10')).toBe(true)
    expect(isYearMonth('2026-00')).toBe(false)
    expect(isYearMonth('2026-10-01')).toBe(false)
  })

  it('moves between months across years', () => {
    expect(yearMonthOf('2026-10-23')).toBe('2026-10')
    expect(addMonthsToYearMonth('2026-12', 1)).toBe('2027-01')
    expect(addMonthsToYearMonth('2027-01', -1)).toBe('2026-12')
    expect(addMonthsToYearMonth('2026-10', 24)).toBe('2028-10')
    expect(monthsOfYear(2026)).toHaveLength(12)
    expect(monthsOfYear(2026)[0]).toBe('2026-01')
    expect(monthsOfYear(2026)[11]).toBe('2026-12')
  })

  it('moves a due day the month does not have to its last day', () => {
    expect(dateInMonth('2026-10', 31)).toBe('2026-10-31')
    expect(dateInMonth('2026-11', 31)).toBe('2026-11-30')
    expect(dateInMonth('2027-02', 30)).toBe('2027-02-28')
    expect(dateInMonth('2028-02', 30)).toBe('2028-02-29')
    expect(dateInMonth('2026-10', 5)).toBe('2026-10-05')
  })

  it('counts days without daylight-saving shifts', () => {
    // Poland changes the clocks on 25 Oct 2026; every day still counts as one.
    expect(daysBetween('2026-10-23', '2026-12-25')).toBe(63)
    expect(daysBetween('2026-10-24', '2026-10-26')).toBe(2)
    expect(daysBetween('2026-12-25', '2026-10-23')).toBe(-63)
  })

  it('counts whole weeks, with a contribution on the deadline itself', () => {
    expect(countWeeklyOpportunities('2026-10-23', '2026-12-25')).toBe(9)
    expect(countWeeklyOpportunities('2026-10-23', '2026-10-30')).toBe(1)
    expect(countWeeklyOpportunities('2026-10-23', '2026-10-29')).toBe(0)
    expect(countWeeklyOpportunities('2026-10-23', '2026-10-01')).toBe(0)
  })
})
