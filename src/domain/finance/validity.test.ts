import { describe, expect, it } from 'vitest'
import { countByValidity, matchesValidity, validityOn } from './validity'

const job = { startMonth: '2026-01', endMonth: '2026-06' }
const salary = { startMonth: '2026-09', endMonth: null }
const bonus = { startMonth: '2027-03', endMonth: '2027-03' }

describe('validityOn', () => {
  it('is active from the first to the last month, both included', () => {
    expect(validityOn(job, '2026-01')).toBe('active')
    expect(validityOn(job, '2026-06')).toBe('active')
    expect(validityOn(salary, '2030-12')).toBe('active')
  })

  it('is ended only after the last month', () => {
    expect(validityOn(job, '2026-07')).toBe('ended')
  })

  it('is upcoming before the first month, never ended', () => {
    expect(validityOn(salary, '2026-08')).toBe('upcoming')
    expect(validityOn(bonus, '2026-12')).toBe('upcoming')
  })
})

describe('filters', () => {
  it('counts each kind on the reference month', () => {
    expect(countByValidity([job, salary, bonus], '2026-12')).toEqual({ active: 1, upcoming: 1, ended: 1, all: 3 })
  })

  it('keeps everything with All', () => {
    for (const item of [job, salary, bonus]) expect(matchesValidity(item, '2026-12', 'all')).toBe(true)
    expect([job, salary, bonus].filter(item => matchesValidity(item, '2026-12', 'ended'))).toEqual([job])
  })
})

it('recognizes the restored pre-first-charge ending representation without changing other categories', () => {
  const subscription = { startMonth: '2026-11', endMonth: '2026-11', category: 'Subscriptions', pausedMonths: ['2026-11'] }
  for (const month of ['2026-10', '2026-11', '2026-12']) expect(validityOn(subscription, month)).toBe('ended')
  expect(validityOn({ ...subscription, category: 'Other' }, '2026-11')).toBe('active')
})

describe('subscription schedule status without rewriting legacy plans', () => {
  const annual = { startMonth: '2026-03', endMonth: '2027-02', category: 'Subscriptions', frequency: 'yearly' as const, dueDay: 20 }
  it('recognizes a legacy annual ending in a non-anniversary month and keeps monthly callers inclusive', () => {
    const before = structuredClone(annual)
    expect(validityOn(annual, '2026-11-05')).toBe('ended')
    expect(validityOn(annual, '2026-03-19')).toBe('active')
    expect(validityOn(annual, '2026-03-20')).toBe('ended')
    expect(validityOn(annual, '2026-03')).toBe('active')
    expect(annual).toEqual(before)
  })
  it('uses planned months, including skipped anniversaries, without the simulation horizon', () => {
    expect(validityOn({ ...annual, pausedMonths: ['2026-03'] }, '2026-01-01')).toBe('ended')
    expect(validityOn({ ...annual, endMonth: '2030-02' }, '2026-11-05')).toBe('active')
    expect(validityOn({ ...annual, endMonth: null, pausedMonths: ['2026-03', '2027-03', '2028-03'] }, '2026-11-05')).toBe('active')
  })
  it('counts and filters the same status, with income and other bill categories unchanged', () => {
    expect(matchesValidity(annual, '2026-11-05', 'ended')).toBe(true)
    expect(countByValidity([annual], '2026-11-05')).toEqual({ all: 1, ended: 1, active: 0, upcoming: 0 })
    expect(validityOn({ ...annual, category: 'Other' }, '2026-11-05')).toBe('active')
    expect(validityOn({ startMonth: '2026-01', endMonth: '2026-11' }, '2026-11-30')).toBe('active')
  })
})
