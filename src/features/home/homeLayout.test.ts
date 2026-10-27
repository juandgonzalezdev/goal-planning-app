import { describe, expect, it } from 'vitest'
import { HOME_BLOCKS } from '../../ui/amountVisibility'
import { balanceDatesText } from './balanceDates'
import { DEFAULT_LAYOUT, moveBlock, normalizeLayout, setAllOpen, setOpen } from './homeLayout'

describe('Home layout', () => {
  it('starts in the approved order, with This Month and Left to Pay open', () => {
    expect(DEFAULT_LAYOUT.order).toEqual(['month', 'left-to-pay', 'categories', 'debt', 'money', 'goals', 'year'])
    expect(DEFAULT_LAYOUT.open).toEqual(['month', 'left-to-pay'])
    expect(normalizeLayout(null)).toEqual(DEFAULT_LAYOUT)
  })

  it('reads old, incomplete or broken values without losing or repeating a block', () => {
    const read = normalizeLayout({ order: ['year', 'year', 'unknown', 42, 'money'], open: ['debt', 'debt', 'nope'] })
    expect(read.order).toEqual(['year', 'money', 'month', 'left-to-pay', 'categories', 'debt', 'goals'])
    expect(read.open).toEqual(['debt'])
    for (const broken of ['text', 7, [], { order: 'month' }, { open: null }]) {
      const layout = normalizeLayout(broken)
      expect([...layout.order].sort()).toEqual([...HOME_BLOCKS].sort())
    }
    // No list of open blocks: the default ones; an empty list: all closed.
    expect(normalizeLayout({ order: ['year'] }).open).toEqual(['month', 'left-to-pay'])
    expect(normalizeLayout({ open: [] }).open).toEqual([])
  })

  it('moves one block, opens and closes blocks one by one or all at once', () => {
    expect(moveBlock(DEFAULT_LAYOUT, 'year', 0).order).toEqual(['year', 'month', 'left-to-pay', 'categories', 'debt', 'money', 'goals'])
    expect(moveBlock(DEFAULT_LAYOUT, 'month', 99).order.at(-1)).toBe('month')
    expect(moveBlock(DEFAULT_LAYOUT, 'debt', 2).order).toEqual(['month', 'left-to-pay', 'debt', 'categories', 'money', 'goals', 'year'])
    expect(setOpen(DEFAULT_LAYOUT, 'goals', true).open).toEqual(['month', 'left-to-pay', 'goals'])
    expect(setOpen(DEFAULT_LAYOUT, 'month', false).open).toEqual(['left-to-pay'])
    expect(setAllOpen(DEFAULT_LAYOUT, true).open).toHaveLength(7)
    expect(setAllOpen(DEFAULT_LAYOUT, false).open).toEqual([])
  })
})

describe('Balance dates on Home', () => {
  it('names one date only when every balance has it, and never invents one', () => {
    expect(balanceDatesText(['2026-08-31', '2026-08-31'], '2026-08-31')).toBe('Balances as of 31 Aug 2026')
    expect(balanceDatesText(['2026-08-31', '2025-12-31', '2026-08-15'], '2026-08-31')).toBe('Latest balances, dated 31 Dec 2025 to 31 Aug 2026')
    expect(balanceDatesText(['2026-08-31', null], '2026-08-31')).toBe('Balances as of 31 Aug 2026 · Some not entered')
    expect(balanceDatesText([null], '2026-08-31')).toBe('No balances entered by 31 Aug 2026')
  })
})
