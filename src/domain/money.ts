import type { MoneyAmount } from './goalAmounts'

/** The currencies the app can record. Each one has two decimals. */
export const CURRENCIES = ['PLN', 'EUR', 'USD'] as const
export type CurrencyCode = (typeof CURRENCIES)[number]

export const isCurrencyCode = (value: unknown): value is CurrencyCode =>
  typeof value === 'string' && (CURRENCIES as readonly string[]).includes(value)

/** Minor units per main unit: 100 grosze in a złoty, 100 cents in a euro or dollar. */
export const MINOR_UNITS_PER_UNIT = 100

/**
 * True for a whole number of minor units that JavaScript can add exactly.
 * Money is never stored as a decimal like 12.5, because adding decimals
 * gives results like 0.1 + 0.2 = 0.30000000000000004.
 */
export const isMinorAmount = (value: unknown): value is MoneyAmount =>
  typeof value === 'number' && Number.isSafeInteger(value)

/** Adds whole minor-unit amounts. Stops loudly if a decimal slipped in. */
export function sumMinor(amounts: readonly MoneyAmount[]): MoneyAmount {
  let total = 0
  for (const amount of amounts) {
    if (!isMinorAmount(amount)) throw new Error(`Not a whole minor-unit amount: ${amount}`)
    total += amount
  }
  return total
}
