import { describe, expect, it } from 'vitest'
import { parseDecimalInput } from './decimalInput'

describe('parseDecimalInput', () => {
  it.each([
    ['12000', 12000],
    ['12000.5', 12000.5],
    ['12000,50', 12000.5],
    ['9,49', 9.49],
    ['12,345.67', 12345.67],
    ['12.345,67', 12345.67],
    ['1,234,567.89', 1234567.89],
    [' 1 200 ', 1200],
    ['1\u00a0200,00', 1200],
    ['0', 0],
  ])('reads %j as %d', (text, value) => {
    expect(parseDecimalInput(text)).toBe(value)
  })

  it.each([
    ['empty text', ''],
    ['only spaces', '   '],
    ['letters', 'abc'],
    ['a minus sign', '-5'],
    ['a currency name', '100 PLN'],
    ['three decimals', '1.234'],
    ['a separator with no decimals after it', '12.'],
    ['two decimal separators', '1.2.3'],
    ['mixed grouping', '1,23,456.00'],
  ])('rejects %s', (_, text) => {
    expect(parseDecimalInput(text)).toBeNaN()
  })
})
