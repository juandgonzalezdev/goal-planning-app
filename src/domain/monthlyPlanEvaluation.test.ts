import { describe, expect, it } from 'vitest'
import { evaluateMonthlyPlan } from './monthlyPlanEvaluation'

// Money is in the smallest unit: 31_000 means 310.00.
// Test scenario: target 25,000.00, saved 5,700.00 -> remaining 1_930_000.
const REMAINING = 1_930_000
const COMFORTABLE = 31_000

describe('evaluateMonthlyPlan', () => {
  it('needs adjustment when the required amount is far above the comfortable one', () => {
    expect(
      evaluateMonthlyPlan({
        remainingAmount: REMAINING,
        opportunities: 12,
        comfortableContribution: COMFORTABLE,
      }),
    ).toEqual({
      status: 'needs-adjustment',
      requiredMonthlyContribution: 160_834,
      monthlyShortfall: 129_834,
    })
  })

  it('needs adjustment by a small gap just below the break-even point', () => {
    expect(
      evaluateMonthlyPlan({
        remainingAmount: REMAINING,
        opportunities: 62,
        comfortableContribution: COMFORTABLE,
      }),
    ).toEqual({
      status: 'needs-adjustment',
      requiredMonthlyContribution: 31_130,
      monthlyShortfall: 130,
    })
  })

  it('is supported with a surplus just above the break-even point', () => {
    expect(
      evaluateMonthlyPlan({
        remainingAmount: REMAINING,
        opportunities: 63,
        comfortableContribution: COMFORTABLE,
      }),
    ).toEqual({
      status: 'supported',
      requiredMonthlyContribution: 30_635,
      monthlySurplus: 365,
    })
  })

  it('is supported with no surplus when the amounts are exactly equal', () => {
    // 1_200_000 / 12 divides exactly, so nothing is rounded up.
    expect(
      evaluateMonthlyPlan({
        remainingAmount: 1_200_000,
        opportunities: 12,
        comfortableContribution: 100_000,
      }),
    ).toEqual({
      status: 'supported',
      requiredMonthlyContribution: 100_000,
      monthlySurplus: 0,
    })
  })

  it('rounds the required amount up to the next unit', () => {
    // 10 / 3 = 3.33..., so 4 is required. With nothing contributed, the
    // shortfall equals the whole required amount.
    expect(
      evaluateMonthlyPlan({
        remainingAmount: 10,
        opportunities: 3,
        comfortableContribution: 0,
      }),
    ).toEqual({
      status: 'needs-adjustment',
      requiredMonthlyContribution: 4,
      monthlyShortfall: 4,
    })
  })

  it('always requires an amount that reaches the target, and no more than one unit extra', () => {
    const cases = [
      { remainingAmount: 1, opportunities: 5 },
      { remainingAmount: 1_930_000, opportunities: 12 },
      { remainingAmount: 1_930_000, opportunities: 63 },
      { remainingAmount: 999_999, opportunities: 7 },
      { remainingAmount: 2_500_000, opportunities: 120 },
    ]

    for (const { remainingAmount, opportunities } of cases) {
      const result = evaluateMonthlyPlan({
        remainingAmount,
        opportunities,
        comfortableContribution: 0,
      })
      if (result.status === 'not-applicable') {
        throw new Error('expected a calculated plan')
      }
      const required = result.requiredMonthlyContribution
      // Paying the required amount every time reaches the target...
      expect(required * opportunities).toBeGreaterThanOrEqual(remainingAmount)
      // ...and one unit less would fall short, so nothing is overstated.
      expect((required - 1) * opportunities).toBeLessThan(remainingAmount)
    }
  })

  it('requires nothing when the remaining amount is 0', () => {
    expect(
      evaluateMonthlyPlan({
        remainingAmount: 0,
        opportunities: 12,
        comfortableContribution: COMFORTABLE,
      }),
    ).toEqual({
      status: 'supported',
      requiredMonthlyContribution: 0,
      monthlySurplus: COMFORTABLE,
    })
  })

  it('is not applicable, with no division, when there are 0 monthly opportunities', () => {
    expect(
      evaluateMonthlyPlan({
        remainingAmount: REMAINING,
        opportunities: 0,
        comfortableContribution: COMFORTABLE,
      }),
    ).toEqual({ status: 'not-applicable' })
  })
})