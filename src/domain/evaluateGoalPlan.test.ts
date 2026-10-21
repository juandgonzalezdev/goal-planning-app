import { describe, expect, it } from 'vitest'
import { evaluateGoalPlan, type GoalPlanInput } from './evaluateGoalPlan'

// Integer minor units: 2_500_000 = PLN 25,000.00.
const base: GoalPlanInput = {
  today: '2026-10-21',
  targetDate: '2031-10-21',
  targetAmount: 2_500_000,
  alreadySaved: 570_000,
  comfortableContribution: 31_000,
}

describe('evaluateGoalPlan: approved state priority', () => {
  it('reports funded even when the deadline has passed', () => {
    expect(evaluateGoalPlan({ ...base, alreadySaved: 2_500_000, targetDate: '2026-01-01' }))
      .toEqual({ status: 'funded', remainingAmount: 0 })
  })

  it('reports funded and never negative for an over-funded goal', () => {
    expect(evaluateGoalPlan({ ...base, alreadySaved: 2_600_000, targetDate: '2026-01-01' }))
      .toEqual({ status: 'funded', remainingAmount: 0 })
  })

  it('treats a non-funded goal due today as invalid target date', () => {
    expect(evaluateGoalPlan({ ...base, targetDate: '2026-10-21' }))
      .toEqual({ status: 'invalid-target-date', remainingAmount: 1_930_000, daysRemaining: 0 })
  })

  it('treats a non-funded goal with a past deadline as invalid target date', () => {
    expect(evaluateGoalPlan({ ...base, targetDate: '2026-09-01' }))
      .toEqual({ status: 'invalid-target-date', remainingAmount: 1_930_000, daysRemaining: 0 })
  })

  it('prefers funded over invalid target date when both conditions exist', () => {
    expect(evaluateGoalPlan({ ...base, alreadySaved: 2_500_000, targetDate: '2026-10-21' }).status)
      .toBe('funded')
  })
})

describe('evaluateGoalPlan: monthly calculation', () => {
  it('marks a 300 PLN gift due in 9 days as monthly plan not applicable', () => {
    expect(evaluateGoalPlan({
      ...base, targetAmount: 30_000, alreadySaved: 0,
      comfortableContribution: 30_000, targetDate: '2026-10-30',
    })).toEqual({
      status: 'not-applicable', remainingAmount: 30_000,
      daysRemaining: 9, monthlyOpportunities: 0,
    })
  })

  it('reports needs-adjustment for the 60-month home deposit example', () => {
    expect(evaluateGoalPlan(base)).toEqual({
      status: 'needs-adjustment', remainingAmount: 1_930_000,
      daysRemaining: 1826, monthlyOpportunities: 60,
      requiredMonthlyContribution: 32_167, monthlyShortfall: 1_167,
    })
  })

  it('reports supported for the 72-month home deposit example', () => {
    expect(evaluateGoalPlan({ ...base, targetDate: '2032-10-21' })).toEqual({
      status: 'supported', remainingAmount: 1_930_000,
      daysRemaining: 2192, monthlyOpportunities: 72,
      requiredMonthlyContribution: 26_806, monthlySurplus: 4_194,
    })
  })

  it('supports a plan when the user contribution is exactly the required amount', () => {
    expect(evaluateGoalPlan({
      ...base, targetDate: '2027-10-21', targetAmount: 1_200_000,
      alreadySaved: 0, comfortableContribution: 100_000,
    })).toMatchObject({
      status: 'supported', monthlyOpportunities: 12,
      requiredMonthlyContribution: 100_000, monthlySurplus: 0,
    })
  })

  it('counts a month correctly at a shortened month end', () => {
    expect(evaluateGoalPlan({
      today: '2027-01-31', targetDate: '2027-02-28',
      targetAmount: 10_000, alreadySaved: 0, comfortableContribution: 10_000,
    })).toMatchObject({ status: 'supported', monthlyOpportunities: 1 })
  })

  it('does not mutate the input object', () => {
    const input = Object.freeze({ ...base })
    evaluateGoalPlan(input)
    expect(input).toEqual(base)
  })
})
