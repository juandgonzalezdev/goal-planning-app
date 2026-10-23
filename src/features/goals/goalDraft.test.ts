import { describe, expect, it } from 'vitest'
import { createDemoHousehold, DEMO_TODAY } from '../../data/fixtures/demoHousehold'
import { draftFromGoal, readGoalDraft, readMovementDraft } from './goalDraft'

const options = { today: DEMO_TODAY, owner: 'shared' as const }

describe('readGoalDraft', () => {
  it('reads a flexible goal without asking for a date', () => {
    expect(readGoalDraft({ name: '  Bike ', target: '1 250,50', dated: false, deadline: '2020-01-01' }, options))
      .toEqual({ status: 'valid', fields: { name: 'Bike', owner: 'shared', target: 125_050, deadline: null } })
  })

  it('reads a goal with a date after today', () => {
    expect(readGoalDraft({ name: 'Gift', target: '500', dated: true, deadline: '2026-12-25' }, options))
      .toMatchObject({ status: 'valid', fields: { target: 50_000, deadline: '2026-12-25' } })
  })

  it('explains every problem in simple words', () => {
    expect(readGoalDraft({ name: ' ', target: '0', dated: true, deadline: '' }, options)).toEqual({
      status: 'invalid',
      errors: { name: 'Enter a name for your goal.', target: 'Enter an amount above 0, such as 500 or 1250.50.', deadline: 'Choose a target date.' },
    })
    expect(readGoalDraft({ name: 'x'.repeat(61), target: 'abc', dated: true, deadline: DEMO_TODAY }, options).status).toBe('invalid')
    expect(readGoalDraft({ name: 'Gift', target: '10', dated: true, deadline: DEMO_TODAY }, options))
      .toEqual({ status: 'invalid', errors: { deadline: 'Choose a date after today.' } })
  })

  it('lets an edit keep a date that has already passed', () => {
    const draft = { name: 'Old', target: '10', dated: true, deadline: '2026-01-01' }
    expect(readGoalDraft(draft, { ...options, currentDeadline: '2026-01-01' }).status).toBe('valid')
    expect(readGoalDraft({ ...draft, deadline: '2026-02-01' }, { ...options, currentDeadline: '2026-01-01' }).status).toBe('invalid')
  })

  it('fills the form from a saved goal', () => {
    const [japan, gift] = createDemoHousehold().goals
    expect(draftFromGoal(japan)).toEqual({ name: 'Trip to Japan', target: '20000.00', dated: false, deadline: '' })
    expect(draftFromGoal(gift)).toEqual({ name: 'Christmas Gift', target: '500.00', dated: true, deadline: '2026-12-25' })
  })
})

describe('readMovementDraft', () => {
  it('reads an amount, a date and an optional note', () => {
    expect(readMovementDraft({ kind: 'contribution', amount: '100', date: DEMO_TODAY, note: '  ' }, DEMO_TODAY))
      .toEqual({ status: 'valid', amount: 10_000, date: DEMO_TODAY, note: '' })
  })

  it('rejects no amount, a future date and a long note', () => {
    expect(readMovementDraft({ kind: 'withdrawal', amount: '', date: '2026-10-24', note: 'n'.repeat(101) }, DEMO_TODAY)).toEqual({
      status: 'invalid',
      errors: {
        amount: 'Enter an amount above 0, such as 100 or 25.50.',
        date: 'The date can’t be after today.',
        note: 'Keep the note to 100 characters or fewer.',
      },
    })
  })
})
