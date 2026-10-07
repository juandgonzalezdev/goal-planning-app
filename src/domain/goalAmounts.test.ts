import { describe, expect, it } from 'vitest'
import { getRemainingAmount } from './goalAmounts'

// Money in these tests is a whole number of the smallest unit,
// e.g. 2_500_000 means 25,000.00 in a currency with two decimals.
describe('getRemainingAmount', () => {
  it('subtracts the amount already saved from the target', () => {
    expect(getRemainingAmount(2_500_000, 570_000)).toBe(1_930_000)
  })

  it('returns the full target when nothing has been saved', () => {
    expect(getRemainingAmount(2_500_000, 0)).toBe(2_500_000)
  })

  it('returns 0 when the saved amount equals the target', () => {
    expect(getRemainingAmount(2_500_000, 2_500_000)).toBe(0)
  })

  it('never returns a negative amount when savings exceed the target', () => {
    expect(getRemainingAmount(2_500_000, 3_000_000)).toBe(0)
  })
})