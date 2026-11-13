import { describe, expect, it } from 'vitest'
import { createDemoHousehold, DEMO_TODAY } from '../../data/fixtures/demoHousehold'
import { createAlexDemo } from '../../data/fixtures/demoAlex'
import { importFinanceData, exportFinanceData } from '../../data/exchange'
import { validateFinanceData } from '../../data/validate'
import { createEmergencyFundFromDraft, restoreEmergencyFund, reviewEmergencyFund } from './emergency'
import { emergencyFund, inspectEmergencyFund } from './goals'
import { savingsSummary } from './savings'
import type { FinanceData, GoalStatus } from './types'

const create = (d: FinanceData) => createEmergencyFundFromDraft(d, { goalId: 'r2-fund', movementId: 'r2-initial' }, 'shared', DEMO_TODAY, { target: null, alreadySetAside: 0 })
function example(status: GoalStatus = 'archived') {
  const d = createAlexDemo()
  d.goals = d.goals.map(g => g.kind === 'emergency' ? { ...g, status, name: 'Fondo de emergencia / Fundusz', target: 300000 } : g)
  return d
}
function restored(d: FinanceData) {
  const result = restoreEmergencyFund(d)
  if (result.status !== 'ok') throw Error(result.error)
  return result
}
describe('R2 Emergency Fund integrity', () => {
  it('identifies absence and creates the first fund', () => {
    const d = createDemoHousehold(); const before = structuredClone(d)
    expect(inspectEmergencyFund(d.goals)).toEqual({ status: 'none' })
    const result = create(d); expect(result.status).toBe('ok')
    if (result.status === 'ok') expect(result.data.goals.filter(g => g.kind === 'emergency')).toHaveLength(1)
    expect(d).toEqual(before)
  })
  it.each(['active', 'archived'] as const)('rejects duplicate when %s without mutation', status => {
    const d = example(status); const before = structuredClone(d)
    expect(inspectEmergencyFund(d.goals).status).toBe(status)
    expect(create(d)).toEqual({ status: 'rejected', error: 'fund-exists' }); expect(d).toEqual(before)
  })
  it('preserves canonical identity, configuration and all other records', () => {
    const d = example(); const before = structuredClone(d); const fund = d.goals.find(g => g.kind === 'emergency')!
    const r = restored(d)
    expect(r.goalId).toBe(fund.id)
    expect(r.data).toEqual({ ...d, goals: d.goals.map(g => g.id === fund.id ? { ...g, status: 'active' } : g) })
    expect(d).toEqual(before)
    expect(r.data.goalMovements).toBe(d.goalMovements)
    expect(r.data.balances).toBe(d.balances)
  })
  it('preserves R1 Savings, reserves, available and historical cutoff', () => {
    const d = example(); const r = restored(d).data
    for (const date of [undefined, '2026-06-30', '2026-12-31']) {
      const before = savingsSummary(d, date); const after = savingsSummary(r, date)
      expect([after.total, after.assigned, after.unassigned]).toEqual([before.total, before.assigned, before.unassigned])
      expect(after.purposes.map(p => [p.goal.id, p.saved])).toEqual(before.purposes.map(p => [p.goal.id, p.saved]))
    }
  })
  it('repeated restoration returns the same active data with no changes', () => {
    const first = restored(example()); const second = restored(first.data)
    expect(second.data).toBe(first.data); expect(second.goalId).toBe(first.goalId)
  })
  it('refuses restoration when absent', () => {
    expect(restoreEmergencyFund(createDemoHousehold())).toEqual({ status: 'rejected', error: 'fund-not-found' })
  })
  it.each(['active', 'archived'] as const)('does not pick among duplicate %s funds', status => {
    const d = example(status); const fund = d.goals.find(g => g.kind === 'emergency')!
    d.goals.push({ ...fund, id: 'duplicate', status: 'archived' }); const before = structuredClone(d)
    expect(inspectEmergencyFund(d.goals).status).toBe('ambiguous'); expect(emergencyFund(d.goals)).toBeNull()
    expect(create(d)).toEqual({ status: 'rejected', error: 'ambiguous-fund' })
    expect(restoreEmergencyFund(d)).toEqual({ status: 'rejected', error: 'ambiguous-fund' })
    expect(reviewEmergencyFund(d, fund.id, 200000, null)).toBeNull(); expect(d).toEqual(before)
  })
  it('refuses unexpected status without changing records', () => {
    const d = example(); d.goals.find(g => g.kind === 'emergency')!.status = 'unexpected' as GoalStatus
    const before = structuredClone(d)
    expect(inspectEmergencyFund(d.goals).status).toBe('invalid')
    expect(restoreEmergencyFund(d)).toEqual({ status: 'rejected', error: 'invalid-fund' })
    expect(create(d)).toEqual({ status: 'rejected', error: 'invalid-fund' }); expect(d).toEqual(before)
  })
  it('refuses conflicting canonical IDs', () => {
    const d = example(); d.goals.find(g => g.kind === 'goal')!.id = d.goals.find(g => g.kind === 'emergency')!.id
    expect(restoreEmergencyFund(d)).toEqual({ status: 'rejected', error: 'invalid-fund' })
  })
  it('rejects incompatible historical references without repair', () => {
    const d = example(); d.goalMovements[0].goalId = 'missing'; const before = structuredClone(d)
    expect(restoreEmergencyFund(d)).toEqual({ status: 'rejected', error: 'invalid-data' }); expect(d).toEqual(before)
  })
  it('does not use names or translations to identify a fund', () => {
    const d = example(); const fund = d.goals.find(g => g.kind === 'emergency')!
    d.goals[0].name = 'Emergency Fund'; fund.name = 'A completely different name'
    expect(restored(d).goalId).toBe(fund.id)
    const ordinary = createDemoHousehold(); ordinary.goals[0].name = 'Emergency Fund'
    expect(create(ordinary).status).toBe('ok')
  })
  it('keeps archived funds out of the legacy active selector', () => {
    expect(emergencyFund(example().goals)).toBeNull()
    expect(emergencyFund(example('active').goals)?.kind).toBe('emergency')
  })
  it('retains old backup compatibility', () => {
    const d = example(); const read = importFinanceData(exportFinanceData(d))
    if (read.status !== 'imported') throw Error(read.errors.join(','))
    expect(restored(read.data).data.goalMovements).toEqual(d.goalMovements)
    expect(validateFinanceData(restored(read.data).data).status).toBe('valid')
  })
  it('restores a zero reserve without new movements', () => {
    const d = createDemoHousehold(); const made = create(d)
    if (made.status !== 'ok') throw Error('creation failed')
    const archived = { ...made.data, goals: made.data.goals.map(g => g.kind === 'emergency' ? { ...g, status: 'archived' as const } : g) }
    expect(restored(archived).data.goalMovements).toEqual(d.goalMovements)
    expect(savingsSummary(restored(archived).data).assigned).toBe(savingsSummary(d).assigned)
  })
})

describe('R2 historical compatibility boundaries', () => {
  it.each(['deficit', 'unknown'] as const)('restores without repairing %s Savings', state => {
    const d = example()
    if (state === 'unknown') d.balances = d.balances.filter(b => !d.moneyAccounts.some(a => a.kind === 'savings' && a.id === b.accountId))
    else d.goals.find(g => g.kind === 'emergency')!.openingBalance = 9999999
    const before = savingsSummary(d); const r = restored(d).data; const after = savingsSummary(r)
    expect([after.total, after.assigned, after.unassigned]).toEqual([before.total, before.assigned, before.unassigned])
    expect(r.balances).toEqual(d.balances); expect(r.goalMovements).toEqual(d.goalMovements)
  })
  it('rejects a new fund identity colliding with an existing ordinary goal', () => {
    const d = createDemoHousehold(); const copy = structuredClone(d)
    const r = createEmergencyFundFromDraft(d, { goalId: d.goals[0].id, movementId: 'm' }, 'shared', DEMO_TODAY, { target: null, alreadySetAside: 0 })
    expect(r).toEqual({ status: 'rejected', error: 'invalid-data' }); expect(d).toEqual(copy)
  })
})
