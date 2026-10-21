import { getRemainingAmount, type MoneyAmount } from './goalAmounts'
import { getDeadlineFacts, type CalendarDate } from './goalTime'
import { countMonthlyOpportunities } from './monthlyPlan'
import { evaluateMonthlyPlan } from './monthlyPlanEvaluation'

/**
 * Validated planning inputs. Amounts are non-negative integer minor currency
 * units; targetAmount must be greater than zero. Dates are real YYYY-MM-DD
 * calendar dates. Input validation is a separate responsibility.
 *
 * `today` is injected to make calculations deterministic and tests repeatable.
 */
export interface GoalPlanInput {
  today: CalendarDate
  targetDate: CalendarDate
  targetAmount: MoneyAmount
  alreadySaved: MoneyAmount
  comfortableContribution: MoneyAmount
}

/** One outcome only; no AI-generated math and no automatic plan changes. */
export type GoalPlanResult =
  | {
      status: 'funded'
      remainingAmount: 0
    }
  | {
      status: 'invalid-target-date'
      remainingAmount: MoneyAmount
      daysRemaining: 0
    }
  | {
      status: 'not-applicable'
      remainingAmount: MoneyAmount
      daysRemaining: number
      monthlyOpportunities: 0
    }
  | {
      status: 'supported'
      remainingAmount: MoneyAmount
      daysRemaining: number
      monthlyOpportunities: number
      requiredMonthlyContribution: MoneyAmount
      monthlySurplus: MoneyAmount
    }
  | {
      status: 'needs-adjustment'
      remainingAmount: MoneyAmount
      daysRemaining: number
      monthlyOpportunities: number
      requiredMonthlyContribution: MoneyAmount
      monthlyShortfall: MoneyAmount
    }

/**
 * Orchestrates existing, tested domain calculations in the approved order:
 * funded -> invalid target date -> monthly evaluation.
 * Does not validate inputs, change them, or advise which option to choose.
 */
export function evaluateGoalPlan(input: GoalPlanInput): GoalPlanResult {
  const remainingAmount = getRemainingAmount(input.targetAmount, input.alreadySaved)

  // An already-funded goal stays funded even when its deadline has passed.
  if (remainingAmount === 0) {
    return { status: 'funded', remainingAmount: 0 }
  }

  const { daysRemaining, isInFuture } = getDeadlineFacts(input.today, input.targetDate)
  if (!isInFuture) {
    return { status: 'invalid-target-date', remainingAmount, daysRemaining: 0 }
  }

  const monthlyOpportunities = countMonthlyOpportunities(input.today, input.targetDate)
  const monthly = evaluateMonthlyPlan({
    remainingAmount,
    opportunities: monthlyOpportunities,
    comfortableContribution: input.comfortableContribution,
  })

  if (monthly.status === 'not-applicable') {
    return { status: 'not-applicable', remainingAmount, daysRemaining, monthlyOpportunities: 0 }
  }

  return {
    ...monthly,
    remainingAmount,
    daysRemaining,
    monthlyOpportunities,
  }
}
