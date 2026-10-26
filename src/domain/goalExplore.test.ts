import { describe, expect, it } from 'vitest'
import { getContributionSchedule, tryDate, tryMonthlyAmount } from './goalExplore'

// Invented amounts in grosze: 1_000_000 = PLN 10,000.00.
describe('getContributionSchedule', () => {
  it('ends with a smaller last contribution when the amount does not divide exactly', () => {
    expect(getContributionSchedule(1_000_000, 300_000)).toEqual({ monthlyContribution: 300_000, contributionCount: 4, finalContribution: 100_000 })
  })

  it('has equal contributions when it divides exactly', () => {
    expect(getContributionSchedule(900_000, 300_000)).toEqual({ monthlyContribution: 300_000, contributionCount: 3, finalContribution: 300_000 })
  })
})

describe('tryMonthlyAmount', () => {
  it('says when the goal would be reached, first contribution one month from today', () => {
    const result = tryMonthlyAmount(820_000, 50_000, '2026-12-31', null)
    expect(result).toMatchObject({ status: 'ok', schedule: { contributionCount: 17, finalContribution: 20_000 }, reachedOn: '2028-05-31', byDeadline: null })
  })

  it('compares the amount with the goal date', () => {
    const short = tryMonthlyAmount(600_000, 50_000, '2026-01-15', '2026-07-15')
    expect(short.status === 'ok' && short.byDeadline).toEqual({ status: 'needs-adjustment', requiredMonthlyContribution: 100_000, monthlyShortfall: 50_000 })
    const enough = tryMonthlyAmount(600_000, 100_000, '2026-01-15', '2026-07-15')
    expect(enough.status === 'ok' && enough.byDeadline).toEqual({ status: 'supported', requiredMonthlyContribution: 100_000, monthlySurplus: 0 })
  })

  it('never divides by zero and stops at the horizon', () => {
    expect(tryMonthlyAmount(100_000, 0, '2026-01-01', null)).toEqual({ status: 'zero' })
    expect(tryMonthlyAmount(0, 100, '2026-01-01', null)).toEqual({ status: 'reached' })
    expect(tryMonthlyAmount(1_000_000, 1, '2026-01-01', null)).toEqual({ status: 'too-long', months: 1_000_000 })
  })
})

describe('tryDate', () => {
  it('rounds the monthly amount up so it always reaches the target', () => {
    expect(tryDate(1_000_000, '2027-03-31', '2026-12-31')).toMatchObject({ status: 'ok', months: 3, perMonth: 333_334 })
  })

  it('needs at least one whole month', () => {
    expect(tryDate(1_000_000, '2027-01-15', '2026-12-31')).toEqual({ status: 'too-soon' })
    expect(tryDate(0, '2027-06-30', '2026-12-31')).toEqual({ status: 'reached' })
  })
})
