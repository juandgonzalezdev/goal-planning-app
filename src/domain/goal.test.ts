import { describe, expect, it } from 'vitest'
import { GOAL_DESCRIPTION_MAX_LENGTH, GOAL_NAME_MAX_LENGTH, validateGoalDetails } from './goal'

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
