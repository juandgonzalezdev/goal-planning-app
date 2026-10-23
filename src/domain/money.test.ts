import { describe, expect, it } from 'vitest'
import { isCurrencyCode, isMinorAmount, sumMinor } from './money'

describe('money', () => {
  it('knows the three supported currencies', () => {
    expect(['PLN', 'EUR', 'USD'].every(isCurrencyCode)).toBe(true)
    expect(isCurrencyCode('GBP')).toBe(false)
    expect(isCurrencyCode('pln')).toBe(false)
  })

  it('accepts only whole minor-unit amounts', () => {
    expect(isMinorAmount(0)).toBe(true)
    expect(isMinorAmount(-1250)).toBe(true)
    expect(isMinorAmount(12.5)).toBe(false)
    expect(isMinorAmount(Number.NaN)).toBe(false)
    expect(isMinorAmount('1250')).toBe(false)
  })

  it('adds amounts exactly, where decimals would not', () => {
    expect(0.1 + 0.2).not.toBe(0.3)
    expect(sumMinor([10, 20])).toBe(30)
    expect(sumMinor([])).toBe(0)
  })

  it('refuses to add a decimal amount', () => {
    expect(() => sumMinor([100, 0.5])).toThrow()
  })
})
