import { describe, expect, it } from 'vitest'
import { evaluateGoalPlan, type GoalPlanInput } from './evaluateGoalPlan'
import {
  exploreAlternatives,
  getContributionSchedule,
  PLANNING_HORIZON_MONTHS,
  type GoalPlanAlternatives,
} from './exploreAlternatives'

// Integer minor units: 2_500_000 = PLN 25,000.00.
const homeDeposit: GoalPlanInput = {
  today: '2026-10-21',
  targetDate: '2031-10-21',
  targetAmount: 2_500_000,
  alreadySaved: 570_000,
  comfortableContribution: 31_000,
}

function expectAvailable(alternatives: GoalPlanAlternatives) {
  if (alternatives.status !== 'available') {
    throw new Error(`expected alternatives, got '${alternatives.status}'`)
  }
  return alternatives
}

/** The calendar day before a 'YYYY-MM-DD' date, computed in UTC. */
function dayBefore(date: string): string {
  const [year, month, day] = date.split('-').map(Number)
  return new Date(Date.UTC(year, month - 1, day - 1)).toISOString().slice(0, 10)
}

describe('getContributionSchedule', () => {
  it('uses a smaller final contribution when the amount does not divide evenly', () => {
    expect(getContributionSchedule(1_930_000, 31_000)).toEqual({
      monthlyContribution: 31_000, contributionCount: 63, finalContribution: 8_000,
    })
  })

  it('uses a full final contribution when the amount divides evenly', () => {
    expect(getContributionSchedule(1_200_000, 100_000)).toEqual({
      monthlyContribution: 100_000, contributionCount: 12, finalContribution: 100_000,
    })
  })

  it('needs a single contribution when it already covers the amount', () => {
    expect(getContributionSchedule(1, 5)).toEqual({
      monthlyContribution: 5, contributionCount: 1, finalContribution: 1,
    })
  })
})

describe('exploreAlternatives: 60-month home deposit example', () => {
  const alternatives = expectAvailable(exploreAlternatives(homeDeposit))

  it('keeps the original evaluation unchanged', () => {
    expect(alternatives.original).toEqual(evaluateGoalPlan(homeDeposit))
    expect(alternatives.original).toMatchObject({
      status: 'needs-adjustment', requiredMonthlyContribution: 32_167, monthlyShortfall: 1_167,
    })
  })

  it('increases the contribution to the required amount and keeps the date', () => {
    expect(alternatives.increaseContribution).toEqual({
      kind: 'increase-contribution',
      status: 'available',
      proposedInput: { ...homeDeposit, comfortableContribution: 32_167 },
      monthlyIncrease: 1_167,
      result: {
        status: 'supported', remainingAmount: 1_930_000, daysRemaining: 1826,
        monthlyOpportunities: 60, requiredMonthlyContribution: 32_167, monthlySurplus: 0,
      },
      // 59 x 321.67 = 18,978.53, so the 60th contribution is 321.47.
      schedule: { monthlyContribution: 32_167, contributionCount: 60, finalContribution: 32_147 },
    })
  })

  it('extends the date by 3 months and keeps the contribution', () => {
    expect(alternatives.extendDate).toEqual({
      kind: 'extend-date',
      status: 'available',
      proposedInput: { ...homeDeposit, targetDate: '2032-01-21' },
      additionalMonths: 3,
      result: {
        status: 'supported', remainingAmount: 1_930_000, daysRemaining: 1918,
        monthlyOpportunities: 63, requiredMonthlyContribution: 30_635, monthlySurplus: 365,
      },
      // 62 x 310.00 = 19,220.00, so the 63rd contribution is 80.00.
      schedule: { monthlyContribution: 31_000, contributionCount: 63, finalContribution: 8_000 },
    })
  })
})

describe('exploreAlternatives: when no adjustment is needed', () => {
  it.each([
    ['funded', { alreadySaved: 2_500_000 }],
    ['supported', { targetDate: '2032-10-21' }],
    ['not-applicable', { targetDate: '2026-11-20' }],
    ['invalid-target-date', { targetDate: '2026-10-21' }],
  ] as const)('proposes nothing for a %s plan', (status, change) => {
    const input = { ...homeDeposit, ...change }
    expect(exploreAlternatives(input)).toEqual({
      status: 'not-needed', original: evaluateGoalPlan(input),
    })
    expect(evaluateGoalPlan(input).status).toBe(status)
  })
})

describe('exploreAlternatives: extend date edge cases', () => {
  it('is unavailable when the comfortable contribution is 0', () => {
    const alternatives = expectAvailable(exploreAlternatives({ ...homeDeposit, comfortableContribution: 0 }))
    expect(alternatives.extendDate).toEqual({
      kind: 'extend-date', status: 'unavailable', reason: 'zero-contribution',
    })
    expect(alternatives.increaseContribution.result.status).toBe('supported')
  })

  it('proposes a timeline of exactly the 600-month planning horizon', () => {
    const alternatives = expectAvailable(exploreAlternatives({
      today: '2026-10-21', targetDate: '2027-10-21',
      targetAmount: 600_000, alreadySaved: 0, comfortableContribution: 1_000,
    }))
    expect(alternatives.extendDate).toMatchObject({
      status: 'available',
      proposedInput: { targetDate: '2076-10-21' },
      additionalMonths: 588,
      result: { status: 'supported', monthlyOpportunities: PLANNING_HORIZON_MONTHS },
    })
  })

  it('is unavailable, with the months needed, just beyond the planning horizon', () => {
    const alternatives = expectAvailable(exploreAlternatives({
      today: '2026-10-21', targetDate: '2027-10-21',
      targetAmount: 600_001, alreadySaved: 0, comfortableContribution: 1_000,
    }))
    expect(alternatives.extendDate).toEqual({
      kind: 'extend-date', status: 'unavailable', reason: 'beyond-planning-horizon',
      monthsNeeded: 601, planningHorizonMonths: 600,
    })
    expect(alternatives.increaseContribution.status).toBe('available')
  })

  it('moves to the last day of February in a non-leap year', () => {
    const alternatives = expectAvailable(exploreAlternatives({
      today: '2026-12-31', targetDate: '2027-01-31',
      targetAmount: 10_000, alreadySaved: 0, comfortableContribution: 5_000,
    }))
    expect(alternatives.extendDate).toMatchObject({
      proposedInput: { targetDate: '2027-02-28' }, additionalMonths: 1,
      result: { status: 'supported', monthlyOpportunities: 2 },
    })
  })

  it('moves to 29 February in a leap year', () => {
    const alternatives = expectAvailable(exploreAlternatives({
      today: '2027-12-31', targetDate: '2028-01-31',
      targetAmount: 10_000, alreadySaved: 0, comfortableContribution: 5_000,
    }))
    expect(alternatives.extendDate).toMatchObject({
      proposedInput: { targetDate: '2028-02-29' },
      result: { status: 'supported', monthlyOpportunities: 2 },
    })
  })

  it('does not count a shorter month as complete when today is a month end', () => {
    // From 31 Jan, 3 months lands on 30 Apr (April has no 31st).
    const alternatives = expectAvailable(exploreAlternatives({
      today: '2026-01-31', targetDate: '2026-02-28',
      targetAmount: 9_000, alreadySaved: 0, comfortableContribution: 3_000,
    }))
    expect(alternatives.extendDate).toMatchObject({
      proposedInput: { targetDate: '2026-04-30' }, additionalMonths: 2,
    })
  })
})

describe('exploreAlternatives: increase contribution edge cases', () => {
  it('can need fewer contributions than opportunities when amounts are tiny', () => {
    // 0.01 remaining over 5 months requires 0.01, which is reached after one month.
    const alternatives = expectAvailable(exploreAlternatives({
      today: '2026-10-21', targetDate: '2027-03-21',
      targetAmount: 1, alreadySaved: 0, comfortableContribution: 0,
    }))
    expect(alternatives.increaseContribution.schedule).toEqual({
      monthlyContribution: 1, contributionCount: 1, finalContribution: 1,
    })
    expect(alternatives.increaseContribution.result.monthlyOpportunities).toBe(5)
  })
})

describe('exploreAlternatives: invariants over many plans', () => {
  // A small deterministic pseudo-random generator, so every run is identical.
  let seed = 20261021
  const next = (max: number) => {
    seed = (seed * 1_103_515_245 + 12_345) % 2_147_483_648
    return seed % max
  }
  const todays = ['2026-10-21', '2026-01-31', '2026-02-28', '2027-12-31', '2028-02-29', '2026-08-31', '2026-03-30']

  const cases: GoalPlanInput[] = []
  for (let i = 0; i < 400; i++) {
    const today = todays[i % todays.length]
    const targetAmount = 1 + next(5_000_000)
    const alreadySaved = next(targetAmount)
    const months = 1 + next(120)
    // Draw contributions mostly below the required amount, so most plans
    // need adjustment, including some that exceed the planning horizon.
    const roughlyRequired = Math.ceil((targetAmount - alreadySaved) / months)
    cases.push({
      today,
      targetDate: dayBeforeOrSame(today, months),
      targetAmount,
      alreadySaved,
      comfortableContribution: next(roughlyRequired + 1),
    })
  }

  /** A date `months` months after `today`, shifted back by 0-2 days. */
  function dayBeforeOrSame(today: string, months: number): string {
    const [year, month, day] = today.split('-').map(Number)
    const shift = next(3)
    const lastDay = new Date(Date.UTC(year, month - 1 + months + 1, 0)).getUTCDate()
    return new Date(Date.UTC(year, month - 1 + months, Math.min(day, lastDay) - shift))
      .toISOString().slice(0, 10)
  }

  const available = cases
    .map(input => ({ input, alternatives: exploreAlternatives(input) }))
    .filter(({ alternatives }) => alternatives.status === 'available')

  it('generates enough plans that need adjustment to be meaningful', () => {
    expect(available.length).toBeGreaterThan(100)
  })

  it('proposes the smallest contribution that is supported by the original date', () => {
    for (const { input, alternatives } of available) {
      const { increaseContribution } = expectAvailable(alternatives)
      expect(increaseContribution.proposedInput).toEqual({
        ...input, comfortableContribution: increaseContribution.proposedInput.comfortableContribution,
      })
      expect(increaseContribution.result.status).toBe('supported')
      const oneUnitLess = evaluateGoalPlan({
        ...increaseContribution.proposedInput,
        comfortableContribution: increaseContribution.proposedInput.comfortableContribution - 1,
      })
      expect(oneUnitLess.status).toBe('needs-adjustment')
    }
  })

  it('proposes the earliest later date that the original contribution supports', () => {
    let checked = 0
    for (const { input, alternatives } of available) {
      const { extendDate, original } = expectAvailable(alternatives)
      if (extendDate.status !== 'available') {
        if (extendDate.reason === 'beyond-planning-horizon') {
          expect(extendDate.monthsNeeded).toBeGreaterThan(PLANNING_HORIZON_MONTHS)
        } else {
          expect(input.comfortableContribution).toBe(0)
        }
        continue
      }
      checked++
      expect(extendDate.proposedInput).toEqual({ ...input, targetDate: extendDate.proposedInput.targetDate })
      expect(extendDate.proposedInput.targetDate > input.targetDate).toBe(true)
      expect(extendDate.result.status).toBe('supported')
      expect(extendDate.additionalMonths).toBe(
        extendDate.result.monthlyOpportunities - original.monthlyOpportunities,
      )
      expect(extendDate.additionalMonths).toBeGreaterThan(0)
      const oneDayEarlier = evaluateGoalPlan({
        ...extendDate.proposedInput, targetDate: dayBefore(extendDate.proposedInput.targetDate),
      })
      expect(oneDayEarlier.status).toBe('needs-adjustment')
    }
    expect(checked).toBeGreaterThan(50)
  })

  it('builds schedules that add up exactly to the remaining amount', () => {
    for (const { alternatives } of available) {
      const { increaseContribution, extendDate, original } = expectAvailable(alternatives)
      const schedules = [increaseContribution.schedule]
      if (extendDate.status === 'available') {
        schedules.push(extendDate.schedule)
        expect(extendDate.schedule.contributionCount).toBe(extendDate.result.monthlyOpportunities)
      }
      expect(increaseContribution.schedule.contributionCount).toBeLessThanOrEqual(original.monthlyOpportunities)
      for (const { monthlyContribution, contributionCount, finalContribution } of schedules) {
        expect(finalContribution).toBeGreaterThan(0)
        expect(finalContribution).toBeLessThanOrEqual(monthlyContribution)
        expect((contributionCount - 1) * monthlyContribution + finalContribution).toBe(original.remainingAmount)
      }
    }
  })
})

describe('exploreAlternatives: purity', () => {
  it('does not mutate the input object', () => {
    const input = Object.freeze({ ...homeDeposit })
    exploreAlternatives(input)
    expect(input).toEqual(homeDeposit)
  })

  it('returns the same result for the same input', () => {
    expect(exploreAlternatives(homeDeposit)).toEqual(exploreAlternatives(homeDeposit))
  })
})
