import { describe, expect, it } from 'vitest'
import { parseMoneyInput } from './moneyInput'

describe('parseMoneyInput', () => {
  it.each([
    ['12,50', 1250],
    ['12.5', 1250],
    ['1 234,56', 123456],
    ['1.234,56', 123456],
    ['1,234.56', 123456],
    ['1.15', 115],
    ['0', 0],
  ])('reads %s as %i minor units', (text, minor) => {
    expect(parseMoneyInput(text)).toBe(minor)
  })

  it.each(['', 'abc', '-5', '1.234', '12.345,6.7'])('rejects %j', text => {
    expect(parseMoneyInput(text)).toBeNull()
  })
})
