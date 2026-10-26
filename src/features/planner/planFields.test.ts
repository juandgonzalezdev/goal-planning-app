import { describe, expect, it } from 'vitest'
import { formatDate, formatMoney, formatMonths } from '../../ui/format'
import { fieldsToInput, fromGrosze, isValidCalendarDate, sameFields, toGrosze, type Fields } from './planFields'

describe('toGrosze and fromGrosze', () => {
  it('reads PLN text as whole grosze', () => {
    expect(toGrosze('321.67')).toBe(32_167)
    expect(toGrosze('321,6')).toBe(32_160)
    expect(toGrosze(' 310 ')).toBe(31_000)
    expect(toGrosze('1.234')).toBeNull()
    expect(toGrosze('-5')).toBeNull()
  })

  it('writes grosze as form text with two decimals', () => {
    expect(fromGrosze(32_167)).toBe('321.67')
    expect(fromGrosze(31_000)).toBe('310.00')
    expect(fromGrosze(5)).toBe('0.05')
    expect(fromGrosze(0)).toBe('0.00')
  })

  it('round-trips every amount exactly', () => {
    for (const grosze of [0, 1, 99, 100, 101, 32_167, 1_930_000, 123_456_789]) {
      expect(toGrosze(fromGrosze(grosze))).toBe(grosze)
    }
  })
})

describe('fieldsToInput', () => {
  const fields: Fields = { targetAmount: '25000', alreadySaved: '5700', targetDate: '2031-10-21', comfortableContribution: '310' }

  it('converts valid fields into engine input', () => {
    expect(fieldsToInput(fields, '2026-10-21')).toEqual({
      today: '2026-10-21', targetDate: '2031-10-21',
      targetAmount: 2_500_000, alreadySaved: 570_000, comfortableContribution: 31_000,
    })
  })

  it('rejects a zero target, a bad amount or an impossible date', () => {
    expect(fieldsToInput({ ...fields, targetAmount: '0' }, '2026-10-21')).toBeNull()
    expect(fieldsToInput({ ...fields, alreadySaved: 'abc' }, '2026-10-21')).toBeNull()
    expect(fieldsToInput({ ...fields, targetDate: '2027-02-29' }, '2026-10-21')).toBeNull()
  })

  it('compares fields as typed text', () => {
    expect(sameFields(fields, { ...fields })).toBe(true)
    expect(sameFields(fields, { ...fields, comfortableContribution: '310.00' })).toBe(false)
  })

  it('accepts leap days only in leap years', () => {
    expect(isValidCalendarDate('2028-02-29')).toBe(true)
    expect(isValidCalendarDate('2027-02-29')).toBe(false)
  })
})

describe('format', () => {
  it('formats money, dates and month counts in English', () => {
    // Intl puts a non-breaking space (code 160) between 'PLN' and the amount.
    expect(formatMoney(32_167)).toBe(`PLN${String.fromCharCode(160)}321.67`)
    expect(formatDate('2032-01-21')).toBe('21 Jan 2032')
    expect(formatDate('2028-02-29')).toBe('29 Feb 2028')
    expect(formatMonths(1)).toBe('1 month')
    expect(formatMonths(3)).toBe('3 months')
  })
})
