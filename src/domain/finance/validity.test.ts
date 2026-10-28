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
