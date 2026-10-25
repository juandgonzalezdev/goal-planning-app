import { describe, expect, it } from 'vitest'
import { setBillMonthAmount, setBillPaid } from '../domain/finance/bills'
import { addGoalMovement } from '../domain/finance/goals'
import type { FinanceData } from '../domain/finance/types'
import { exportFinanceData, importFinanceData } from './exchange'
import { createDemoHousehold, DEMO_TODAY } from './fixtures/demoHousehold'
import { migrateToCurrent } from './migrations'
import { validateFinanceData } from './validate'

const invalidErrors = (change: (data: FinanceData) => void) => {
  const data = createDemoHousehold()
  change(data)
  const result = validateFinanceData(data)
  return result.status === 'invalid' ? result.errors : []
}

describe('validateFinanceData', () => {
  it('accepts the demo household', () => {
    expect(validateFinanceData(createDemoHousehold())).toMatchObject({ status: 'valid' })
  })

  it('rejects something that is not app data', () => {
    expect(validateFinanceData(null)).toEqual({ status: 'invalid', errors: ['The data is not an object.'] })
    expect(validateFinanceData([])).toMatchObject({ status: 'invalid' })
  })

  it.each<[string, (d: FinanceData) => void, string]>([
    ['a decimal amount', d => { d.bills[0].amount = 150.5 }, 'bills[0].amount must be a whole, non-negative amount or null.'],
    ['an owner who is not a member', d => { d.goals[0].owner = 'kim' }, 'goals[0].owner is not a member or "shared".'],
    ['a bill linked to a missing debt', d => { d.bills[0].debtId = 'gone' }, 'bills[0].debtId is not a debt.'],
    ['another currency', d => { d.income[0].currency = 'EUR' }, 'income[0] must use the space currency.'],
    ['a repeated id', d => { d.goals[1].id = d.goals[0].id }, 'goals: id "trip-to-japan" is used twice.'],
    ['a duo with three members', d => { d.space.members.push({ id: 'kim', name: 'Kim', color: '#000' }) }, 'A duo space cannot have 3 member(s).'],
    ['a date that does not exist', d => { d.balances[0].asOf = '2026-09-31' }, 'balances[0].asOf must be a real date.'],
    ['a bill that ends before it starts', d => { d.bills[0].endMonth = '2026-09' }, 'bills[0] ends before it starts.'],
    ['a balance for a missing account', d => { d.balances[0].accountId = 'gone' }, 'balances[0].accountId is not a debt or money account.'],
    ['the same bill month twice', d => { d.billMonths.push({ billId: 'rent', month: '2026-10', paid: false }) }, 'billMonths: rent:2026-10 is recorded twice.'],
    ['a goal target of 0', d => { d.goals[0].target = 0 }, 'goals[0].target must be a whole amount above 0.'],
  ])('rejects %s', (_label, change, error) => {
    expect(invalidErrors(change)).toContain(error)
  })

  it('rejects a goal history that goes below zero', () => {
    expect(invalidErrors(d => {
      d.goalMovements = [
        { id: 'a', goalId: 'trip-to-japan', date: '2026-10-24', amount: 10_000, note: '', effect: 'assigned' },
        { id: 'b', goalId: 'trip-to-japan', date: '2026-10-23', amount: -5_000, note: '', effect: 'unassigned' },
      ]
    })).toEqual(['Goal "Trip to Japan" would go below 0 on 2026-10-23.'])
  })
})

describe('migrateToCurrent', () => {
  it('passes current data through unchanged', () => {
    const data = createDemoHousehold()
    expect(migrateToCurrent(data)).toEqual({ status: 'migrated', data, fromVersion: 2 })
  })

  it('refuses data without a version, or from a newer app', () => {
    expect(migrateToCurrent({ goals: [] })).toEqual({ status: 'no-version' })
    expect(migrateToCurrent({ schemaVersion: 3 })).toEqual({ status: 'newer-version', version: 3 })
    expect(migrateToCurrent('text')).toEqual({ status: 'not-data' })
  })

  it('runs each step in order when there are newer versions', () => {
    const steps = {
      1: (d: Record<string, unknown>) => ({ ...d, renamed: d.old, old: undefined }),
      2: (d: Record<string, unknown>) => ({ ...d, added: true }),
    }
    const input = { schemaVersion: 1, old: 'kept' }
    expect(migrateToCurrent(input, steps, 3)).toEqual({
      status: 'migrated', fromVersion: 1, data: { schemaVersion: 3, renamed: 'kept', old: undefined, added: true },
    })
    expect(input).toEqual({ schemaVersion: 1, old: 'kept' })
    expect(migrateToCurrent({ schemaVersion: 1 }, {}, 2)).toEqual({ status: 'unknown-version', version: 1 })
  })
})

describe('export and import', () => {
  it('round-trips paid months, month amounts, goal movements and preferences', () => {
    let data = setBillPaid(createDemoHousehold(), 'rent', '2026-11', true)
    data = setBillMonthAmount(data, 'phone', '2026-11', null)
    const added = addGoalMovement(data, { id: 'm1', goalId: 'trip-to-japan', effect: 'assigned', amount: 10_000, date: DEMO_TODAY, note: 'Start' })
    if (added.status !== 'ok') throw new Error(added.error)
    data = { ...added.data, preferences: { language: 'pl', theme: 'day-night', displayCurrency: 'EUR' } }

    expect(importFinanceData(exportFinanceData(data))).toEqual({ status: 'imported', data })
  })

  it('rejects broken files with a clear reason', () => {
    expect(importFinanceData('{ not json')).toEqual({ status: 'rejected', errors: ['The file is not valid JSON.'] })
    expect(importFinanceData('{"goals": []}')).toEqual({ status: 'rejected', errors: ['The file has no schemaVersion.'] })
    expect(importFinanceData('{"schemaVersion": 7}')).toEqual({ status: 'rejected', errors: ['The file is from a newer app version (7).'] })
    const broken = createDemoHousehold() as unknown as Record<string, unknown>
    delete broken.goals
    expect(importFinanceData(JSON.stringify(broken))).toMatchObject({ status: 'rejected', errors: expect.arrayContaining(['goals must be a list.']) })
  })
})

describe('demo data', () => {
  it('is fresh each time, so one test or screen cannot change another', () => {
    const first = createDemoHousehold()
    first.goals[0].name = 'Changed'
    first.income[0].amount = 1
    expect(createDemoHousehold().goals[0].name).toBe('Trip to Japan')
    expect(createDemoHousehold().income[0].amount).toBe(500_000)
  })
})
