import { describe, expect, it } from 'vitest'
import { countMonthlyOpportunities } from './monthlyPlan'

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