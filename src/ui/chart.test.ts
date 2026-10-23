import { describe, expect, it } from 'vitest'
import { barPercent, donutGradient, sharePercents } from './chart'

describe('donutGradient', () => {
  it('gives each segment its share of the ring, in order', () => {
    expect(donutGradient([{ value: 1, color: 'red' }, { value: 3, color: 'blue' }])).toBe('conic-gradient(red 0% 25%, blue 25% 100%)')
  })

  it('skips empty segments and always closes the ring at 100%', () => {
    expect(donutGradient([{ value: 1, color: 'a' }, { value: 0, color: 'b' }, { value: 2, color: 'c' }]))
      .toBe('conic-gradient(a 0% 33.33%, c 33.33% 100%)')
  })

  it('returns null when there is nothing to show', () => {
    expect(donutGradient([])).toBeNull()
    expect(donutGradient([{ value: 0, color: 'a' }])).toBeNull()
  })
})

describe('sharePercents', () => {
  it('splits a whole into parts that add up to exactly 100', () => {
    const shares = sharePercents([1, 1, 1])
    expect(shares).toEqual([33.33, 33.33, 33.34])
    expect(shares.reduce((a, b) => a + b, 0)).toBeCloseTo(100, 10)
  })

  it('matches the demo July split (Alex 540.50, Jordan 910.10)', () => {
    expect(sharePercents([540_050, 910_010])).toEqual([37.24, 62.76])
  })

  it('gives zeros for an empty month', () => {
    expect(sharePercents([0, 0])).toEqual([0, 0])
  })
})

describe('barPercent', () => {
  it('scales against the longest bar and stays between 0 and 100', () => {
    expect(barPercent(50, 200)).toBe(25)
    expect(barPercent(300, 200)).toBe(100)
    expect(barPercent(-5, 200)).toBe(0)
    expect(barPercent(5, 0)).toBe(0)
  })
})
