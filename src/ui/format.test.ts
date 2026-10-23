import { describe, expect, it } from 'vitest'
import { formatAmount, formatYearMonth, weekdayOf } from './format'

// Intl puts a no-break space between groups and before the symbol.
const plain = (text: string) => text.replace(/\u00a0|\u202f/g, ' ')

describe('formatAmount', () => {
  it('shows amounts like the approved design', () => {
    // Polish style, as in v5.9: four-digit amounts have no group space.
    expect(plain(formatAmount(719_403, 'PLN'))).toBe('7194,03 zł')
    expect(plain(formatAmount(2_000_000, 'PLN'))).toBe('20 000,00 zł')
    expect(plain(formatAmount(0, 'PLN'))).toBe('0,00 zł')
    expect(plain(formatAmount(5, 'PLN'))).toBe('0,05 zł')
  })

  it('keeps the currency of the amount, never only swapping the symbol', () => {
    expect(plain(formatAmount(123_456, 'EUR'))).toBe('1234,56 €')
    expect(plain(formatAmount(123_456, 'USD'))).toContain('1234,56')
    expect(plain(formatAmount(123_456, 'USD'))).toContain('USD')
  })
})

describe('dates', () => {
  it('names months and weekdays', () => {
    expect(formatYearMonth('2026-10')).toBe('October 2026')
    expect(weekdayOf('2026-10-10')).toBe('Saturday')
    expect(weekdayOf('2026-10-25')).toBe('Sunday')
  })
})
