import type { MoneyAmount } from '../domain/goalAmounts'
import { isMinorAmount, MINOR_UNITS_PER_UNIT } from '../domain/money'
import { parseDecimalInput } from './decimalInput'

/**
 * Reads a typed amount such as '12,50' or '1 234.56' into minor units
 * (1250, 123456). Returns null for anything that is not a valid,
 * non-negative amount with at most two decimals: it never guesses.
 */
export function parseMoneyInput(text: string): MoneyAmount | null {
  const value = parseDecimalInput(text)
  if (!Number.isFinite(value)) return null
  // At most two decimals were accepted, so rounding only removes the
  // tiny binary error of the multiplication (e.g. 1.15 * 100 = 114.99999...).
  const minor = Math.round(value * MINOR_UNITS_PER_UNIT)
  return isMinorAmount(minor) ? minor : null
}
