import { describe, expect, it } from 'vitest'
import type { GoalPlanInput } from './evaluateGoalPlan'
import { evaluateGoalPlan } from './evaluateGoalPlan'
import {
  confirmGoal,
  evaluateConfirmedGoal,
  getShortfallAtTargetDate,
  GOAL_DESCRIPTION_MAX_LENGTH,
  GOAL_NAME_MAX_LENGTH,
  isConfirmable,
  validateGoalDetails,
} from './goal'

// Invented example values. Integer minor units: 2_500_000 = PLN 25,000.00.
const supported: GoalPlanInput = {
  today: '2026-10-21',
  targetDate: '2031-10-21',
  targetAmount: 2_500_000,
  alreadySaved: 570_000,
  comfortableContribution: 40_000,
}
const needsAdjustment: GoalPlanInput = { ...supported, comfortableContribution: 31_000 }
const funded: GoalPlanInput = { ...supported, alreadySaved: 2_500_000 }
const invalidDate: GoalPlanInput = { ...supported, targetDate: '2026-10-21' }
const notApplicable: GoalPlanInput = { ...supported, targetDate: '2026-11-10' }

describe('validateGoalDetails', () => {
  it('trims the name and description', () => {
    expect(validateGoalDetails('  Holiday fund ', '  Two weeks in summer  '))
      .toEqual({ status: 'valid', details: { name: 'Holiday fund', description: 'Two weeks in summer' } })
  })

  it('requires a name after trimming', () => {
    expect(validateGoalDetails('', '')).toEqual({ status: 'invalid', errors: ['name-required'] })
    expect(validateGoalDetails('   ', '')).toEqual({ status: 'invalid', errors: ['name-required'] })
  })

  it('allows an empty description', () => {
    expect(validateGoalDetails('Bike', '   ')).toEqual({ status: 'valid', details: { name: 'Bike', description: '' } })
  })

  it('accepts a name of exactly 60 characters and refuses 61', () => {
    expect(validateGoalDetails('a'.repeat(GOAL_NAME_MAX_LENGTH), '').status).toBe('valid')
    expect(validateGoalDetails('a'.repeat(GOAL_NAME_MAX_LENGTH + 1), ''))
      .toEqual({ status: 'invalid', errors: ['name-too-long'] })
  })

  it('measures the name after trimming', () => {
    expect(validateGoalDetails(`  ${'a'.repeat(GOAL_NAME_MAX_LENGTH)}  `, '').status).toBe('valid')
  })

  it('accepts a description of exactly 200 characters and refuses 201', () => {
    expect(validateGoalDetails('Bike', 'd'.repeat(GOAL_DESCRIPTION_MAX_LENGTH)).status).toBe('valid')
    expect(validateGoalDetails('Bike', 'd'.repeat(GOAL_DESCRIPTION_MAX_LENGTH + 1)))
      .toEqual({ status: 'invalid', errors: ['description-too-long'] })
  })

  it('counts Polish letters and emoji as one character each', () => {
    expect(validateGoalDetails('ł'.repeat(GOAL_NAME_MAX_LENGTH), '').status).toBe('valid')
    expect(validateGoalDetails('🚲'.repeat(GOAL_NAME_MAX_LENGTH), '').status).toBe('valid')
    expect(validateGoalDetails('🚲'.repeat(GOAL_NAME_MAX_LENGTH + 1), '').status).toBe('invalid')
  })

  it('reports every problem at once', () => {
    expect(validateGoalDetails('', 'd'.repeat(GOAL_DESCRIPTION_MAX_LENGTH + 1)))
      .toEqual({ status: 'invalid', errors: ['name-required', 'description-too-long'] })
  })
})

describe('isConfirmable', () => {
  it('allows supported, needs-adjustment and funded plans', () => {
    expect(isConfirmable(evaluateGoalPlan(supported))).toBe(true)
    expect(isConfirmable(evaluateGoalPlan(needsAdjustment))).toBe(true)
    expect(isConfirmable(evaluateGoalPlan(funded))).toBe(true)
  })

  it('blocks an invalid target date and a deadline without a monthly plan', () => {
    expect(isConfirmable(evaluateGoalPlan(invalidDate))).toBe(false)
    expect(isConfirmable(evaluateGoalPlan(notApplicable))).toBe(false)
  })
})

describe('confirmGoal', () => {
  it('keeps the accepted input exactly and records the confirmation date', () => {
    expect(confirmGoal(' Home deposit ', '', needsAdjustment, '2026-10-21')).toEqual({
      status: 'confirmed',
      goal: { details: { name: 'Home deposit', description: '' }, input: needsAdjustment, confirmedOn: '2026-10-21' },
    })
  })

  it('stores a copy, so later changes to the input object do not reach the goal', () => {
    const input = { ...supported }
    const result = confirmGoal('Car', '', input, '2026-10-21')
    input.comfortableContribution = 1
    expect(result.status === 'confirmed' && result.goal.input.comfortableContribution).toBe(40_000)
  })

  it('confirms an already funded goal', () => {
    expect(confirmGoal('Laptop', '', funded, '2026-10-21').status).toBe('confirmed')
  })

  it('refuses invalid details', () => {
    expect(confirmGoal('  ', '', supported, '2026-10-21')).toEqual({ status: 'invalid-details', errors: ['name-required'] })
  })

  it('refuses plans that cannot be confirmed', () => {
    expect(confirmGoal('Car', '', invalidDate, '2026-10-21')).toEqual({ status: 'not-confirmable', planStatus: 'invalid-target-date' })
    expect(confirmGoal('Car', '', notApplicable, '2026-10-21')).toEqual({ status: 'not-confirmable', planStatus: 'not-applicable' })
  })
})

describe('evaluateConfirmedGoal', () => {
  const result = confirmGoal('Home deposit', '', needsAdjustment, '2026-10-21')
  if (result.status !== 'confirmed') throw new Error('fixture must confirm')
  const { goal } = result

  it('matches the confirmed evaluation on the day of confirmation', () => {
    expect(evaluateConfirmedGoal(goal, '2026-10-21')).toEqual(evaluateGoalPlan(needsAdjustment))
  })

  it('recalculates from a later day without changing the confirmed goal', () => {
    const later = evaluateConfirmedGoal(goal, '2027-10-21')
    expect(later).toEqual(evaluateGoalPlan({ ...needsAdjustment, today: '2027-10-21' }))
    expect(later.status === 'needs-adjustment' && later.monthlyOpportunities).toBe(48)
    expect(goal.input).toEqual(needsAdjustment)
    expect(goal.confirmedOn).toBe('2026-10-21')
  })

  it('keeps the amount already saved as entered, even after time passes', () => {
    expect(evaluateConfirmedGoal(goal, '2030-01-01').remainingAmount).toBe(1_930_000)
  })

  it('reports a passed deadline factually', () => {
    expect(evaluateConfirmedGoal(goal, '2032-01-01').status).toBe('invalid-target-date')
  })
})

describe('getShortfallAtTargetDate', () => {
  it('totals the chosen contributions and the amount they leave uncovered', () => {
    const result = evaluateGoalPlan(needsAdjustment)
    if (result.status !== 'needs-adjustment') throw new Error('fixture must need adjustment')
    // 60 opportunities x 310.00 = 18,600.00 of the 19,300.00 remaining.
    expect(getShortfallAtTargetDate(needsAdjustment, result)).toEqual({ plannedTotal: 1_860_000, uncoveredAmount: 70_000 })
  })
})
