import { describe, expect, it } from 'vitest'
import { createDemoHousehold, DEMO_TODAY } from '../../data/fixtures/demoHousehold'
import { summarizeDebts } from './debts'
import { addGoalMovement, archiveGoal, createGoal, deleteGoal, filterGoals, goalMovementsOf, goalProgress, goalSaved, summarizeGoals, updateGoal, type MovementRequest } from './goals'
import { summarizeMoney } from './moneyAccounts'
import type { FinanceData } from './types'

const add = (data: FinanceData, request: Partial<MovementRequest>) => {
  const result = addGoalMovement(data, { id: 'm1', goalId: 'trip-to-japan', effect: 'assigned', amount: 10_000, date: DEMO_TODAY, note: '', ...request })
  if (result.status !== 'ok') throw new Error(result.error)
  return result.data
}
const goal = (data: FinanceData, id: string) => data.goals.find(g => g.id === id)!

describe('example goals', () => {
  it('start empty, as approved', () => {
    const data = createDemoHousehold()
    expect(goal(data, 'trip-to-japan')).toMatchObject({ target: 2_000_000, deadline: null, openingBalance: 0 })
    expect(goal(data, 'christmas-gift')).toMatchObject({ target: 50_000, deadline: '2026-12-25', openingBalance: 0 })
    expect(data.goalMovements).toEqual([])
    expect(summarizeGoals(data)).toEqual({ saved: 0, target: 2_050_000, activeCount: 2 })
  })

  it('a goal with no date never gets a pace', () => {
    expect(goalProgress(goal(createDemoHousehold(), 'trip-to-japan'), [], DEMO_TODAY)).toEqual({
      saved: 0, remaining: 2_000_000, percent: 0, hasTarget: true, daysToDeadline: null, pace: { status: 'no-deadline' },
    })
  })

  it('a goal with a date suggests a weekly and a monthly pace with the approved rules', () => {
    // 63 days: 9 whole weeks and 2 whole months (23 Nov and 23 Dec).
    // 500.00 / 9 = 55.555... rounds up to 55.56; 500.00 / 2 = 250.00.
    expect(goalProgress(goal(createDemoHousehold(), 'christmas-gift'), [], DEMO_TODAY)).toEqual({
      saved: 0, remaining: 50_000, percent: 0, hasTarget: true, daysToDeadline: 63,
      pace: { status: 'suggested', weekly: { opportunities: 9, amount: 5_556 }, monthly: { opportunities: 2, amount: 25_000 } },
    })
  })

  it('has no monthly pace when less than a month is left, but still a weekly one', () => {
    expect(goalProgress(goal(createDemoHousehold(), 'christmas-gift'), [], '2026-12-10').pace).toEqual({
      status: 'suggested', weekly: { opportunities: 2, amount: 25_000 }, monthly: null,
    })
  })

  it('says when the date has passed, and suggests nothing', () => {
    const christmas = goal(createDemoHousehold(), 'christmas-gift')
    expect(goalProgress(christmas, [], '2026-12-25')).toMatchObject({ daysToDeadline: 0, pace: { status: 'deadline-passed' } })
    expect(goalProgress(christmas, [], '2027-01-05')).toMatchObject({ daysToDeadline: -11, pace: { status: 'deadline-passed' } })
  })
})

describe('contributions and withdrawals', () => {
  it('adding 100 to Trip to Japan saves 100 there, with one dated entry, and changes nothing else', () => {
    const before = createDemoHousehold()
    const after = add(before, { amount: 10_000, note: '  First step  ' })
    expect(goalSaved(goal(after, 'trip-to-japan'), after.goalMovements)).toBe(10_000)
    expect(goalSaved(goal(after, 'christmas-gift'), after.goalMovements)).toBe(0)
    expect(summarizeGoals(after).saved).toBe(10_000)
    expect(after.goalMovements).toEqual([{ id: 'm1', goalId: 'trip-to-japan', date: DEMO_TODAY, amount: 10_000, note: 'First step', effect: 'assigned' }])
    expect(summarizeMoney(after)).toEqual(summarizeMoney(before))
    expect(summarizeDebts(after)).toEqual(summarizeDebts(before))
    expect(before.goalMovements).toEqual([])
  })

  it('refuses to withdraw 150 when 100 is saved', () => {
    const data = add(createDemoHousehold(), { amount: 10_000 })
    expect(addGoalMovement(data, { id: 'm2', goalId: 'trip-to-japan', effect: 'unassigned', amount: 15_000, date: DEMO_TODAY, note: '' }))
      .toEqual({ status: 'rejected', error: 'more-than-saved' })
  })

  it('allows withdrawing exactly what is saved, stored as a negative movement', () => {
    let data = add(createDemoHousehold(), { amount: 10_000 })
    data = add(data, { id: 'm2', effect: 'unassigned', amount: 10_000, date: '2026-10-24' })
    expect(goalSaved(goal(data, 'trip-to-japan'), data.goalMovements)).toBe(0)
    expect(goalMovementsOf(data.goalMovements, 'trip-to-japan').map(m => m.amount)).toEqual([10_000, -10_000])
  })

  it.each([
    [{ amount: 0 }, 'amount-not-positive'],
    [{ amount: -500 }, 'amount-not-positive'],
    [{ amount: 12.5 }, 'amount-not-positive'],
    [{ date: '2026-02-30' }, 'invalid-date'],
    [{ goalId: 'missing' }, 'goal-not-found'],
  ] as const)('rejects %j', (change, error) => {
    expect(addGoalMovement(createDemoHousehold(), { id: 'x', goalId: 'trip-to-japan', effect: 'assigned', amount: 100, date: DEMO_TODAY, note: '', ...change }))
      .toEqual({ status: 'rejected', error })
  })

  it('progress caps at 100% when more than the target is saved', () => {
    const data = add(createDemoHousehold(), { goalId: 'christmas-gift', amount: 60_000, effect: 'new-savings', accountId: 'emergency-cash' })
    expect(goalProgress(goal(data, 'christmas-gift'), data.goalMovements, DEMO_TODAY)).toMatchObject({ saved: 60_000, remaining: 0, percent: 100, pace: { status: 'reached' } })
  })
})

describe('creating, editing and archiving goals', () => {
  it('creates an empty flexible goal without asking for a date', () => {
    const result = createGoal(createDemoHousehold(), 'bike', { name: '  New Bike ', owner: 'jordan', target: 300_000, deadline: null }, DEMO_TODAY)
    if (result.status !== 'valid') throw new Error('expected valid')
    expect(goal(result.data, 'bike')).toEqual({
      id: 'bike', kind: 'goal', name: 'New Bike', owner: 'jordan', target: 300_000, currency: 'PLN', deadline: null, openingBalance: 0, createdOn: DEMO_TODAY, status: 'active',
    })
    expect(result.data.goalMovements).toEqual([])
  })

  it('lists every problem with the fields', () => {
    expect(createGoal(createDemoHousehold(), 'x', { name: ' ', owner: 'nobody', target: 0, deadline: '2026-13-01' }, DEMO_TODAY)).toEqual({
      status: 'invalid', errors: ['name-required', 'target-not-positive', 'invalid-deadline', 'unknown-owner'],
    })
  })

  it('edits a goal without touching its movements or other data', () => {
    const before = add(createDemoHousehold(), { amount: 10_000 })
    const result = updateGoal(before, 'trip-to-japan', { name: 'Japan 2027', owner: 'shared', target: 2_200_000, deadline: '2027-09-01' })
    if (result.status !== 'valid') throw new Error('expected valid')
    expect(goal(result.data, 'trip-to-japan')).toMatchObject({ name: 'Japan 2027', target: 2_200_000, deadline: '2027-09-01', createdOn: DEMO_TODAY })
    expect(result.data.goalMovements).toEqual(before.goalMovements)
    expect(result.data.bills).toBe(before.bills)
  })

  it('archives a goal instead of deleting it, keeping its history', () => {
    const data = archiveGoal(add(createDemoHousehold(), { amount: 10_000 }), 'trip-to-japan')
    expect(goal(data, 'trip-to-japan').status).toBe('archived')
    expect(data.goalMovements).toHaveLength(1)
    expect(summarizeGoals(data)).toEqual({ saved: 0, target: 50_000, activeCount: 1 })
    expect(addGoalMovement(data, { id: 'm2', goalId: 'trip-to-japan', effect: 'assigned', amount: 1, date: DEMO_TODAY, note: '' }))
      .toEqual({ status: 'rejected', error: 'goal-archived' })
  })
})

describe('deleting and filtering goals', () => {
  it('deletes a goal and only its own movements', () => {
    let data = createDemoHousehold()
    for (const goalId of ['trip-to-japan', 'christmas-gift']) {
      const added = addGoalMovement(data, { id: `m-${goalId}`, goalId, effect: 'assigned', amount: 10_000, date: DEMO_TODAY, note: '' })
      if (added.status !== 'ok') throw new Error('rejected')
      data = added.data
    }
    const after = deleteGoal(data, 'trip-to-japan')
    expect(after.goals.map(g => g.id)).toEqual(['christmas-gift'])
    expect(after.goalMovements.map(m => m.goalId)).toEqual(['christmas-gift'])
    expect({ ...after, goals: data.goals, goalMovements: data.goalMovements }).toEqual(data)
  })

  it('filters flexible goals and goals with a date, never listing archived ones', () => {
    const data = archiveGoal(createDemoHousehold(), 'christmas-gift')
    const goals = createDemoHousehold().goals
    expect(filterGoals(goals, 'all').map(g => g.name)).toEqual(['Trip to Japan', 'Christmas Gift'])
    expect(filterGoals(goals, 'flexible').map(g => g.name)).toEqual(['Trip to Japan'])
    expect(filterGoals(goals, 'dated').map(g => g.name)).toEqual(['Christmas Gift'])
    expect(filterGoals(data.goals, 'dated')).toEqual([])
  })
})
