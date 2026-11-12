import { afterEach, describe, expect, it } from 'vitest'
import { formatAmount, formatDate, formatDayRange, formatLongDate, formatShortYearMonth, formatYearMonth, monthName, weekdayOf } from './format'

import { setActiveLanguage } from '../i18n'

afterEach(() => setActiveLanguage('en'))

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

describe('UTC years below 100', () => {
  const cases = [
    { year: '0001', number: 1, weekdays: ['Monday', 'lunes', 'poniedziałek'] },
    { year: '0099', number: 99, weekdays: ['Thursday', 'jueves', 'czwartek'] },
    { year: '0100', number: 100, weekdays: ['Friday', 'viernes', 'piątek'] },
    { year: '2026', number: 2026, weekdays: ['Thursday', 'jueves', 'czwartek'] },
  ]
  for (const [index, language] of (['en', 'es', 'pl'] as const).entries()) {
    it.each(cases)('preserves year $year and its weekday in ' + language, ({ year, number, weekdays }) => {
      setActiveLanguage(language)
      const date = (year + '-01-01') as Parameters<typeof formatDate>[0]
      const month = (year + '-01') as Parameters<typeof formatYearMonth>[0]
      expect(weekdayOf(date)).toBe(weekdays[index])
      expect(formatYearMonth(month)).toBe([
        'January ' + number, 'enero de ' + number, 'styczeń ' + number,
      ][index])
      for (const text of [formatDate(date), formatLongDate(date), formatShortYearMonth(month)]) {
        expect(text).toMatch(new RegExp('\\b' + number + '$'))
        if (number < 100) expect(text).not.toContain(String(1900 + number))
      }
      expect(formatLongDate(date)).toContain(weekdays[index])
      expect(monthName(month)).toBe(['January', 'enero', 'styczeń'][index])
      expect(formatDayRange(date, (year + '-01-07') as typeof date)).toContain('7')
      expect(date).toBe(year + '-01-01')
    })
  }

  it('preserves leap day in year 4', () => {
    setActiveLanguage('pl')
    expect(formatDate('0004-02-29')).toBe('29 lut 4')
    expect(weekdayOf('0004-02-29')).toBe('niedziela')
  })
})
