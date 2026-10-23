import { describe, expect, it } from 'vitest'
import { validateFinanceData } from '../../data/validate'
import { createSpaceData, ownerColor, ownerName, validateSetup, type SpaceSetup } from './space'

const individual: SpaceSetup = { mode: 'individual', names: ['  Robin '], currency: 'PLN', theme: 'system' }
const duo: SpaceSetup = { mode: 'duo', names: ['Robin', 'Sasha'], currency: 'EUR', theme: 'dark' }

describe('createSpaceData', () => {
  it('creates an Individual space that is completely empty', () => {
    const result = createSpaceData(individual)
    if (result.status !== 'created') throw new Error('expected a space')
    expect(result.data.space).toEqual({
      id: 'my-space', name: 'Robin', mode: 'individual', currency: 'PLN',
      members: [{ id: 'member-1', name: 'Robin', color: '#3B82F6' }],
    })
    for (const list of [result.data.income, result.data.bills, result.data.billMonths, result.data.debts, result.data.moneyAccounts, result.data.balances, result.data.goals, result.data.goalMovements]) {
      expect(list).toEqual([])
    }
    expect(validateFinanceData(result.data).status).toBe('valid')
  })

  it('creates a Duo space with two members, their colours and the chosen preferences', () => {
    const result = createSpaceData(duo)
    if (result.status !== 'created') throw new Error('expected a space')
    expect(result.data.space.name).toBe('Robin & Sasha')
    expect(result.data.space.members.map(m => [m.name, m.color])).toEqual([['Robin', '#3B82F6'], ['Sasha', '#10B981']])
    expect(result.data.preferences).toEqual({ language: 'en', theme: 'dark', displayCurrency: 'EUR' })
    expect(result.data.space.currency).toBe('EUR')
    expect(validateFinanceData(result.data).status).toBe('valid')
  })

  it('ignores a leftover second name in an Individual space', () => {
    const result = createSpaceData({ ...individual, names: ['Robin', 'Sasha'] })
    expect(result.status === 'created' && result.data.space.members).toHaveLength(1)
  })
})

describe('validateSetup', () => {
  it('needs names, within the length limit', () => {
    expect(validateSetup({ ...individual, names: [' '] })).toEqual(['name-required'])
    expect(validateSetup({ ...individual, names: ['x'.repeat(41)] })).toEqual(['name-too-long'])
    expect(validateSetup({ ...individual, names: ['x'.repeat(40)] })).toEqual([])
    expect(validateSetup({ ...duo, names: ['Robin', ''] })).toEqual(['second-name-required'])
    expect(validateSetup({ ...duo, names: ['', 'y'.repeat(41)] })).toEqual(['name-required', 'second-name-too-long'])
  })

  it('does not allow Group yet', () => {
    expect(validateSetup({ ...duo, mode: 'group', names: ['A', 'B', 'C'] })).toEqual(['mode-not-available'])
  })
})

describe('owners', () => {
  it('gives members their colour and name, and shared items purple', () => {
    const result = createSpaceData(duo)
    if (result.status !== 'created') throw new Error('expected a space')
    expect(ownerColor(result.data.space, 'member-2')).toBe('#10B981')
    expect(ownerColor(result.data.space, 'shared')).toBe('#8B5CF6')
    expect(ownerName(result.data.space, 'member-1')).toBe('Robin')
    expect(ownerName(result.data.space, 'shared')).toBe('Shared')
  })
})
