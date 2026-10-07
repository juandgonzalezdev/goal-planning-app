import { describe, expect, it } from 'vitest'
import { getDeadlineFacts } from './goalTime'

describe('getDeadlineFacts', () => {
  it('counts the days from today to a future deadline', () => {
    const facts = getDeadlineFacts('2026-10-06', '2026-10-30')
    expect(facts).toEqual({ daysRemaining: 24, isInFuture: true })
  })

  it('treats a deadline of tomorrow as 1 day remaining', () => {
    const facts = getDeadlineFacts('2026-10-06', '2026-10-07')
    expect(facts).toEqual({ daysRemaining: 1, isInFuture: true })
  })

  it('treats a deadline equal to today as not in the future', () => {
    const facts = getDeadlineFacts('2026-10-06', '2026-10-06')
    expect(facts).toEqual({ daysRemaining: 0, isInFuture: false })
  })

  it('reports 0 days, never a negative number, for a past deadline', () => {
    const facts = getDeadlineFacts('2026-10-06', '2026-09-01')
    expect(facts).toEqual({ daysRemaining: 0, isInFuture: false })
  })

  it('counts a range across a leap day correctly', () => {
    expect(getDeadlineFacts('2028-02-28', '2028-03-01').daysRemaining).toBe(2)
    expect(getDeadlineFacts('2027-02-28', '2027-03-01').daysRemaining).toBe(1)
  })

  it('is not affected by a daylight-saving clock change', () => {
    // Clocks in Europe go back on 2026-10-25, making that day 25 hours long.
    expect(getDeadlineFacts('2026-10-24', '2026-10-26').daysRemaining).toBe(2)
  })
})