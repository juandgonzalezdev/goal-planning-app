import { describe, expect, it } from 'vitest'
import { addMonthsToDate, countMonthlyOpportunities } from './monthlyPlan'

describe('countMonthlyOpportunities', () => {
  it('counts exactly 12 months for a deadline one year ahead', () => {
    expect(countMonthlyOpportunities('2026-10-06', '2027-10-06')).toBe(12)
  })

  it('does not count a month that is not yet complete', () => {
    expect(countMonthlyOpportunities('2026-10-06', '2027-10-05')).toBe(11)
  })

  it('counts 1 month when the deadline is the same day next month', () => {
    expect(countMonthlyOpportunities('2026-10-06', '2026-11-06')).toBe(1)
  })

  it('counts 0 months when less than one full month remains', () => {
    expect(countMonthlyOpportunities('2026-10-06', '2026-11-05')).toBe(0)
    expect(countMonthlyOpportunities('2026-10-06', '2026-10-30')).toBe(0)
  })

  it('counts 0 for a deadline that is today or in the past', () => {
    expect(countMonthlyOpportunities('2026-10-06', '2026-10-06')).toBe(0)
    expect(countMonthlyOpportunities('2026-10-06', '2026-09-01')).toBe(0)
  })

  it('moves to the last day of a shorter month when the day does not exist', () => {
    expect(countMonthlyOpportunities('2026-01-31', '2026-02-28')).toBe(1)
    expect(countMonthlyOpportunities('2026-01-31', '2026-02-27')).toBe(0)
    expect(countMonthlyOpportunities('2028-01-31', '2028-02-29')).toBe(1)
  })

  it('counts from today each time, not by adding one month repeatedly', () => {
    expect(countMonthlyOpportunities('2026-01-31', '2026-03-31')).toBe(2)
    expect(countMonthlyOpportunities('2026-01-31', '2026-03-30')).toBe(1)
  })

  it('handles a long-term deadline across several years', () => {
    expect(countMonthlyOpportunities('2026-10-06', '2036-10-06')).toBe(120)
  })
})

describe('addMonthsToDate', () => {
  it('returns the same date for 0 months', () => {
    expect(addMonthsToDate('2026-10-21', 0)).toBe('2026-10-21')
  })

  it('adds months across a year boundary', () => {
    expect(addMonthsToDate('2026-10-21', 3)).toBe('2027-01-21')
    expect(addMonthsToDate('2026-10-21', 63)).toBe('2032-01-21')
  })

  it('moves to the last day of a shorter month', () => {
    expect(addMonthsToDate('2026-12-31', 2)).toBe('2027-02-28')
    expect(addMonthsToDate('2027-12-31', 2)).toBe('2028-02-29')
    expect(addMonthsToDate('2026-01-31', 3)).toBe('2026-04-30')
  })

  it('counts from the start date each time, not month by month', () => {
    expect(addMonthsToDate('2026-01-31', 2)).toBe('2026-03-31')
  })

  it('handles a 50-year span', () => {
    expect(addMonthsToDate('2028-02-29', 600)).toBe('2078-02-28')
  })

  it('produces a date with exactly that many monthly opportunities', () => {
    for (const start of ['2026-01-31', '2026-02-28', '2027-12-31', '2028-02-29', '2026-10-21']) {
      for (let months = 0; months <= 30; months++) {
        expect(countMonthlyOpportunities(start, addMonthsToDate(start, months))).toBe(months)
      }
    }
  })
})