import { describe, expect, it } from 'vitest'
import { createDemoHousehold, DEMO_TODAY } from '../../data/fixtures/demoHousehold'
import { setBillMonthAmount } from './bills'
import { addGoalMovement, archiveGoal } from './goals'
import { activeGoalRows, billsByCategory } from './home'

// Invented demo household; totals added up by hand from demoHousehold.ts, in grosze.

describe('bills by category', () => {
  it('adds up each category in the fixed order and matches the month total', () => {
    const october = billsByCategory(createDemoHousehold(), '2026-10')
    expect(october.categories.map(c => [c.category, c.total])).toEqual([
      ['Housing', 300_000], ['Loans', 195_000], ['Education', 30_000], ['Subscriptions', 10_099], ['Utilities', 12_045], ['Other', 9_999],
    ])
    expect(october.total).toBe(557_143)
    expect(october.categories.reduce((sum, c) => sum + c.total, 0)).toBe(october.total)
    expect(october.unknownCount).toBe(0)
  })

  it('leaves a category with only unknown amounts out of the chart and counts it as unknown', () => {
    const november = billsByCategory(createDemoHousehold(), '2026-11')
    expect(november.categories.map(c => c.category)).not.toContain('Utilities')
    expect(november).toMatchObject({ total: 545_098, unknownCount: 1 })
  })

  it('lists every bill of a category, including unknown amounts', () => {
    const subscriptions = billsByCategory(createDemoHousehold(), '2026-10').categories.find(c => c.category === 'Subscriptions')
    expect(subscriptions?.occurrences.map(o => o.bill.name)).toEqual(['Bank Plan', 'Streaming', 'Music'])
  })

  it('follows a month-only amount change', () => {
    const data = setBillMonthAmount(createDemoHousehold(), 'phone', '2026-11', 9_000)
    const november = billsByCategory(data, '2026-11')
    expect(november.categories.find(c => c.category === 'Utilities')?.total).toBe(9_000)
    expect(november).toMatchObject({ total: 554_098, unknownCount: 0 })
  })

  it('is empty for a space with no bills', () => {
    const data = { ...createDemoHousehold(), bills: [], billMonths: [] }
    expect(billsByCategory(data, '2026-10')).toEqual({ categories: [], total: 0, unknownCount: 0 })
  })
})

describe('goal rows', () => {
  it('shows the two example goals empty', () => {
    const rows = activeGoalRows(createDemoHousehold(), DEMO_TODAY)
    expect(rows.map(r => [r.goal.name, r.progress.saved, r.progress.percent])).toEqual([['Trip to Japan', 0, 0], ['Christmas Gift', 0, 0]])
  })

  it('follows contributions and leaves archived goals out', () => {
    const added = addGoalMovement(createDemoHousehold(), { id: 'm1', goalId: 'christmas-gift', kind: 'contribution', amount: 12_500, date: DEMO_TODAY, note: '' })
    if (added.status !== 'ok') throw new Error('contribution rejected')
    const rows = activeGoalRows(archiveGoal(added.data, 'trip-to-japan'), DEMO_TODAY)
    expect(rows).toHaveLength(1)
    expect(rows[0].progress).toMatchObject({ saved: 12_500, percent: 25 })
  })
})
