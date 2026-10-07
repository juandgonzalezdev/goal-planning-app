import type { MoneyAmount } from './goalAmounts'

export interface MonthlyPlanInput {
  /** Amount still missing to reach the target. */
  remainingAmount: MoneyAmount
  /** Number of monthly contribution opportunities (whole months). */
  opportunities: number
  /** The contribution per month that the user considers comfortable. */
  comfortableContribution: MoneyAmount
}

/**
 * The result of evaluating a Monthly Plan. The `status` field tells which
 * shape of result it is, so a value like `requiredMonthlyContribution`
 * only exists when it was actually calculated.
 */
export type MonthlyPlanEvaluation =
  | {
      status: 'supported'
      requiredMonthlyContribution: MoneyAmount
      /** How much more per month the user planned than is required. */
      monthlySurplus: MoneyAmount
    }
  | {
      status: 'needs-adjustment'
      requiredMonthlyContribution: MoneyAmount
      /** How much more per month would be required than the user planned. */
      monthlyShortfall: MoneyAmount
    }
  | {
      /** No monthly opportunity exists, so no monthly amount can be computed. */
      status: 'not-applicable'
    }

/**
 * Divides `amount` by `parts` and rounds the result UP to the next whole
 * unit. It uses the remainder instead of a decimal division, so there is no
 * floating-point rounding error: paying the result `parts` times always
 * reaches `amount`, and paying one unit less never does.
 */
function divideRoundingUp(amount: MoneyAmount, parts: number): MoneyAmount {
  const remainder = amount % parts
  const roundedDownQuotient = (amount - remainder) / parts
  return remainder === 0 ? roundedDownQuotient : roundedDownQuotient + 1
}

export function evaluateMonthlyPlan({
  remainingAmount,
  opportunities,
  comfortableContribution,
}: MonthlyPlanInput): MonthlyPlanEvaluation {
  if (opportunities <= 0) {
    return { status: 'not-applicable' }
  }

  const requiredMonthlyContribution = divideRoundingUp(
    remainingAmount,
    opportunities,
  )

  if (comfortableContribution >= requiredMonthlyContribution) {
    return {
      status: 'supported',
      requiredMonthlyContribution,
      monthlySurplus: comfortableContribution - requiredMonthlyContribution,
    }
  }

  return {
    status: 'needs-adjustment',
    requiredMonthlyContribution,
    monthlyShortfall: requiredMonthlyContribution - comfortableContribution,
  }
}