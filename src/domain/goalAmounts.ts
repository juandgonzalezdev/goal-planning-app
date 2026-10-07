/**
 * Money is a whole number of the smallest unit of a currency (for example
 * 2_500_000 means 25,000.00 in a currency with two decimals). Every value
 * passed to one call must be in the same currency.
 */
export type MoneyAmount = number

/**
 * How much is still missing to reach the target. This is a goal-level fact:
 * it does not depend on any plan. It never goes below 0, so savings above
 * the target do not produce a negative amount.
 */
export function getRemainingAmount(
  targetAmount: MoneyAmount,
  alreadySaved: MoneyAmount,
): MoneyAmount {
  return Math.max(targetAmount - alreadySaved, 0)
}