import { describe, expect, it } from 'vitest'
import { AREA_OF, HOME_AREAS, HOME_BLOCKS, allAreasHidden, hiddenAreasFrom, savedHiddenNames } from '../../ui/amountVisibility'
import { balanceDatesText } from './balanceDates'
import { DEFAULT_LAYOUT, HOME_SECTIONS, layoutToSave, moveArea, normalizeLayout, setAllOpen, setOpen } from './homeLayout'

describe('Home layout', () => {
  it('starts with the three areas in order and every part closed', () => {
    expect(DEFAULT_LAYOUT.order).toEqual(['month', 'left-to-pay', 'money-goals'])
    expect(DEFAULT_LAYOUT.open).toEqual([])
    expect(normalizeLayout(null)).toEqual(DEFAULT_LAYOUT)
  })

  it('reads this version’s layout without losing or repeating an area, and writes it back the same', () => {
    const read = normalizeLayout({ version: 2, order: ['money-goals', 'money-goals', 'nope', 7], open: ['goals', 'goals', 'month', 'nope'] })
    expect(read).toEqual({ order: ['money-goals', 'month', 'left-to-pay'], open: ['goals'] })
    expect(normalizeLayout(layoutToSave(read))).toEqual(read)
    expect(layoutToSave(read)).toEqual({ version: 2, order: ['money-goals', 'month', 'left-to-pay'], open: ['goals'] })
    for (const broken of ['text', 7, [], { order: 'month' }, { open: null }, { version: 2, order: null, open: 'all' }]) {
      const layout = normalizeLayout(broken)
      expect([...layout.order].sort()).toEqual([...HOME_AREAS].sort())
      expect(layout.open).toEqual([])
    }
  })

  it('reads an earlier version’s seven blocks: each area where its first block was, and the parts that were open', () => {
    // The order of the earlier version, with Year Summary moved first and My Money above Total Debt.
    const earlier = { order: ['year', 'left-to-pay', 'money', 'month', 'categories', 'debt', 'goals'], open: ['month', 'left-to-pay', 'money', 'year'] }
    expect(normalizeLayout(earlier)).toEqual({ order: ['month', 'left-to-pay', 'money-goals'], open: ['money', 'year'] })
    expect(normalizeLayout({ order: ['goals', 'month', 'year'], open: [] }).order).toEqual(['money-goals', 'month', 'left-to-pay'])
    expect(normalizeLayout({ order: ['left-to-pay'] }).order).toEqual(['left-to-pay', 'month', 'money-goals'])
    // Legacy area entries open no nested part; This Month keeps its default expansion.
    expect(normalizeLayout({ order: [...HOME_BLOCKS], open: ['month', 'left-to-pay'] })).toEqual(DEFAULT_LAYOUT)
  })

  it('moves one area, opens and closes parts one by one or all at once', () => {
    expect(moveArea(DEFAULT_LAYOUT, 'money-goals', 0).order).toEqual(['money-goals', 'month', 'left-to-pay'])
    expect(moveArea(DEFAULT_LAYOUT, 'month', 99).order).toEqual(['left-to-pay', 'money-goals', 'month'])
    expect(setOpen(DEFAULT_LAYOUT, 'goals', true).open).toEqual(['goals'])
    expect(setOpen(setOpen(DEFAULT_LAYOUT, 'goals', true), 'goals', false).open).toEqual([])
    expect(setAllOpen(DEFAULT_LAYOUT, true).open).toEqual([...HOME_SECTIONS])
    expect(setAllOpen(DEFAULT_LAYOUT, false).open).toEqual([])
  })
})

describe('Hidden amounts on Home', () => {
  it('hides each area that held a hidden block of the earlier version: never fewer amounts', () => {
    expect([...hiddenAreasFrom([])]).toEqual([])
    expect([...hiddenAreasFrom(['year'])]).toEqual(['month'])
    expect([...hiddenAreasFrom(['categories'])]).toEqual(['month'])
    expect([...hiddenAreasFrom(['debt', 'unknown', 42 as unknown as string])]).toEqual(['money-goals'])
    expect([...hiddenAreasFrom(['left-to-pay', 'goals'])].sort()).toEqual(['left-to-pay', 'money-goals'])
    expect(allAreasHidden(hiddenAreasFrom([...HOME_BLOCKS]))).toBe(true)
    // A part of each area hidden is every area hidden, so Bills and History hide their amounts too.
    expect(allAreasHidden(hiddenAreasFrom(['year', 'left-to-pay', 'debt']))).toBe(true)
    expect(allAreasHidden(hiddenAreasFrom(['year', 'debt']))).toBe(false)
  })

  it('saves the names of every block of a hidden area, so an earlier version hides the same amounts', () => {
    expect(savedHiddenNames(new Set())).toEqual([])
    expect(savedHiddenNames(new Set(['money-goals']))).toEqual(['money-goals', 'debt', 'money', 'goals'])
    expect(savedHiddenNames(new Set(['month']))).toEqual(['month', 'categories', 'year'])
    const all = savedHiddenNames(new Set(HOME_AREAS))
    // What an earlier version reads: its seven block names, every one hidden.
    expect(HOME_BLOCKS.every(block => all.includes(block))).toBe(true)
    // Read again by this version: the same areas.
    for (const area of HOME_AREAS) expect([...hiddenAreasFrom(savedHiddenNames(new Set([area])))]).toEqual([area])
    for (const block of HOME_BLOCKS) expect(savedHiddenNames(new Set([AREA_OF[block]]))).toContain(block)
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

it('round-trips the independent rings collapse preference while preserving legacy defaults and order',()=>{
 const legacy=normalizeLayout({version:2,order:['money-goals'],open:['goals']})
 expect(legacy.ringsOpen??true).toBe(true)
 const collapsed=setAllOpen(legacy,false)
 expect(normalizeLayout(layoutToSave(collapsed))).toEqual(collapsed)
 expect(collapsed.ringsOpen).toBe(false);expect(collapsed.order).toEqual(legacy.order)
 expect(setAllOpen(collapsed,true).ringsOpen).toBe(true)
})

it('round-trips This Month folding without changing area order or legacy defaults', () => {
  const legacy = normalizeLayout({ version: 2, order: ['money-goals'], open: ['year'] })
  expect(legacy.monthOpen ?? true).toBe(true)
  const closed = setAllOpen(legacy, false)
  expect(closed.monthOpen).toBe(false)
  expect(closed.order).toEqual(legacy.order)
  expect(normalizeLayout(layoutToSave(closed))).toEqual(closed)
  expect(setAllOpen(closed, true).monthOpen).toBe(true)
  expect(normalizeLayout({ version: 2, monthOpen: 'false' }).monthOpen).toBeUndefined()
})
