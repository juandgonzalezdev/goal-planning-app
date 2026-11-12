import { describe, expect, it } from 'vitest'
import { createDemoHousehold, DEMO_TODAY } from '../../data/fixtures/demoHousehold'
import { importFinanceData, exportFinanceData } from '../../data/exchange'
import { validateFinanceData } from '../../data/validate'
import { stepDone } from '../../features/home/gettingStarted'
import { addGoalMovement, archiveGoal, updateGoal } from './goals'
import { savingsSummary } from './savings'
import type { FinanceData, GoalStatus } from './types'

function fixture(status: GoalStatus = 'active'): FinanceData {
  const data = createDemoHousehold()
  data.goals = data.goals.slice(0, 1).map(g => ({ ...g, status, openingBalance: 20000, createdOn: '2026-09-01' }))
  data.goalMovements = []
  data.balances = data.balances.map(b => b.accountId === 'emergency-cash' ? { ...b, amount: 100000, asOf: '2026-09-01' } : b)
  return data
}
const summary = (data: FinanceData) => {
  const { total, assigned, unassigned } = savingsSummary(data)
  return { total, assigned, unassigned }
}
function move(data: FinanceData, effect: 'assigned' | 'new-savings' | 'unassigned', amount: number) {
  return addGoalMovement(data, { id: 'r1-move', goalId: data.goals[0].id, effect, amount, date: DEMO_TODAY, note: '', ...(effect === 'new-savings' ? { accountId: 'emergency-cash' } : {}) })
}
describe('R1 complete reserves', () => {
  it.each(['active', 'archived'] as const)('counts %s opening reserves', status => {
    expect(summary(fixture(status))).toEqual({ total: 100000, assigned: 20000, unassigned: 80000 })
  })
  it('counts mixed states once', () => {
    const d = fixture(); d.goals.push({ ...d.goals[0], id: 'other', status: 'archived', openingBalance: 30000 })
    expect(summary(d).assigned).toBe(50000)
  })
  it('counts archived movements', () => {
    const d = fixture('archived'); d.goalMovements.push({ id: 'old', goalId: d.goals[0].id, date: DEMO_TODAY, amount: 1234, effect: 'assigned', note: '' })
    expect(summary(d).assigned).toBe(21234)
  })
  it.each(['active', 'archived'] as const)('counts %s emergency fund once', status => {
    const d = fixture(status); d.goals[0].kind = 'emergency'
    expect(summary(d).assigned).toBe(20000)
  })
  it.each([['duo', 2], ['group', 3]] as const)('does not multiply reserves in %s', (mode, count) => {
    const d = fixture('archived'); d.space.mode = mode
    d.space.members = Array.from({ length: count }, (_, i) => ({ ...d.space.members[0], id: `member-${i}` }))
    d.goals[0].owner = 'shared'
    expect(summary(d).assigned).toBe(20000)
  })
  it.each([0, 20000, 100000])('retains known savings %i and signed availability', amount => {
    const d = fixture('archived'); d.balances = d.balances.map(b => b.accountId === 'emergency-cash' ? { ...b, amount } : b)
    expect(summary(d)).toEqual({ total: amount, assigned: 20000, unassigned: amount - 20000 })
  })
  it.each(['missing-account', 'missing-balance'] as const)('keeps unknown savings: %s', kind => {
    const d = fixture('archived')
    if (kind === 'missing-account') d.moneyAccounts = d.moneyAccounts.filter(a => a.kind !== 'savings')
    else d.balances = d.balances.filter(b => b.accountId !== 'emergency-cash')
    expect(summary(d)).toEqual({ total: null, assigned: 20000, unassigned: null })
  })
  it('archive preserves financial values and records', () => {
    const d = fixture(); const archived = archiveGoal(d, d.goals[0].id)
    expect(summary(archived)).toEqual(summary(d)); expect(archived.goalMovements).toEqual(d.goalMovements); expect(archived.balances).toEqual(d.balances)
    expect(archived.goals[0]).toEqual({ ...d.goals[0], status: 'archived' })
  })
  it('equivalent restored state preserves identity and money without adding movements', () => {
    const d = fixture('archived'); const restored = { ...d, goals: d.goals.map(g => ({ ...g, status: 'active' as const })) }
    expect(summary(restored)).toEqual(summary(d)); expect(restored.goalMovements).toEqual(d.goalMovements); expect(restored.goals[0].id).toBe(d.goals[0].id)
  })
  it('target changes do not reserve money', () => {
    const d = fixture(); const result = updateGoal(d, d.goals[0].id, { name: d.goals[0].name, owner: d.goals[0].owner, target: 999999, deadline: null })
    if (result.status !== 'valid') throw Error('invalid')
    expect(summary(result.data)).toEqual(summary(d))
  })
  it('respects creation and movement cutoff dates', () => {
    const d = fixture('archived'); d.goalMovements.push({ id: 'later', goalId: d.goals[0].id, amount: 5000, effect: 'assigned', date: '2026-10-01', note: '' })
    expect(savingsSummary(d, '2026-08-31').assigned).toBe(0)
    expect(savingsSummary(d, '2026-09-30').assigned).toBe(20000)
    expect(savingsSummary(d, '2026-10-01').assigned).toBe(25000)
  })
  it('does not mutate input records', () => {
    const d = fixture('archived'); const original = structuredClone(d)
    savingsSummary(d); savingsSummary(d, '2026-09-30')
    expect(d).toEqual(original)
  })
  it('reads a legacy records-only backup unchanged', () => {
    const d = fixture('archived'); const read = importFinanceData(exportFinanceData(d))
    expect(read.status).toBe('imported')
    if (read.status === 'imported') { expect(read.data).toEqual(d); expect(summary(read.data)).toEqual(summary(d)) }
  })
  it('accepts valid historical deficit without repairing records', () => {
    const d = fixture('archived'); d.goals[0].openingBalance = 120000
    expect(validateFinanceData(d).status).toBe('valid'); expect(summary(d).unassigned).toBe(-20000)
  })
  it('new savings increases account and reserve once', () => {
    const d = fixture(); const result = move(d, 'new-savings', 1000)
    if (result.status !== 'ok') throw Error(result.error)
    expect(summary(result.data)).toEqual({ total: 101000, assigned: 21000, unassigned: 80000 })
  })
  it('assigned rejects money already reserved in archived goals', () => {
    const d = fixture(); d.goals.push({ ...d.goals[0], id: 'archived', status: 'archived', openingBalance: 70000 })
    expect(move(d, 'assigned', 10001)).toEqual({ status: 'rejected', error: 'more-than-unassigned' })
    const result = move(d, 'assigned', 10000)
    if (result.status !== 'ok') throw Error(result.error)
    expect(summary(result.data).unassigned).toBe(0)
  })
  it('unassigned releases only reserve', () => {
    const d = fixture(); const result = move(d, 'unassigned', 1000)
    if (result.status !== 'ok') throw Error(result.error)
    expect(summary(result.data)).toEqual({ total: 100000, assigned: 19000, unassigned: 81000 }); expect(result.data.balances).toEqual(d.balances)
  })
  it('Getting Started still requires active goals', () => {
    expect(stepDone(fixture('archived'), 'goals')).toBe(false)
    expect(stepDone(fixture('active'), 'goals')).toBe(true)
  })
})
