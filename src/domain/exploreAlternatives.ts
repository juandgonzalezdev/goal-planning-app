import type { MoneyAmount } from './goalAmounts'
import { evaluateGoalPlan, type GoalPlanInput, type GoalPlanResult } from './evaluateGoalPlan'
import { addMonthsToDate } from './monthlyPlan'
import { divideRoundingUp } from './monthlyPlanEvaluation'

/**
 * Longest timeline, in whole months, that the Extend Date alternative will
 * propose (50 years). This is a technical limit of the planner, not a
 * judgement about whether a goal can be reached.
 */
export const PLANNING_HORIZON_MONTHS = 600

type NeedsAdjustmentResult = Extract<GoalPlanResult, { status: 'needs-adjustment' }>
type SupportedResult = Extract<GoalPlanResult, { status: 'supported' }>

/**
 * A hypothetical schedule of equal monthly contributions that reaches the
 * remaining amount exactly. It describes what a plan would involve; it does
 * not mean anything has been committed or paid.
 */
export interface ContributionSchedule {
  /** Amount contributed in every month except the last one. */
  monthlyContribution: MoneyAmount
  /** Number of monthly contributions until the remaining amount is reached. */
  contributionCount: number
  /**
   * Amount needed in the last contribution month. It is smaller than
   * `monthlyContribution` when the remaining amount is not an exact multiple
   * of it (for example because the required amount was rounded up).
   */
  finalContribution: MoneyAmount
}

export interface IncreaseContributionAlternative {
  kind: 'increase-contribution'
  status: 'available'
  /** The original input with only `comfortableContribution` changed. */
  proposedInput: GoalPlanInput
  /** How much more per month than the original comfortable contribution. */
  monthlyIncrease: MoneyAmount
  /** The engine's evaluation of `proposedInput`. */
  result: SupportedResult
  schedule: ContributionSchedule
}

export type ExtendDateAlternative =
  | {
      kind: 'extend-date'
      status: 'available'
      /** The original input with only `targetDate` changed. */
      proposedInput: GoalPlanInput
      /** Whole months added to the original number of opportunities. */
      additionalMonths: number
      /** The engine's evaluation of `proposedInput`. */
      result: SupportedResult
      schedule: ContributionSchedule
    }
  | {
      /** A contribution of 0 never reaches the remaining amount. */
      kind: 'extend-date'
      status: 'unavailable'
      reason: 'zero-contribution'
    }
  | {
      kind: 'extend-date'
      status: 'unavailable'
      reason: 'beyond-planning-horizon'
      /** Whole months the original contribution would need. */
      monthsNeeded: number
      planningHorizonMonths: number
    }

export type AlternativeKind = IncreaseContributionAlternative['kind'] | ExtendDateAlternative['kind']

export type GoalPlanAlternatives =
  | {
      /** The original plan does not need adjustment, so nothing is proposed. */
      status: 'not-needed'
      original: GoalPlanResult
    }
  | {
      status: 'available'
      original: NeedsAdjustmentResult
      increaseContribution: IncreaseContributionAlternative
      extendDate: ExtendDateAlternative
    }

/**
 * Equal contributions of `monthlyContribution` until `remainingAmount` is
 * reached; the last one covers only what is still missing.
 * `monthlyContribution` must be greater than 0.
 */
export function getContributionSchedule(
  remainingAmount: MoneyAmount,
  monthlyContribution: MoneyAmount,
): ContributionSchedule {
  const contributionCount = divideRoundingUp(remainingAmount, monthlyContribution)
  return {
    monthlyContribution,
    contributionCount,
    finalContribution: remainingAmount - (contributionCount - 1) * monthlyContribution,
  }
}

/** Re-runs the engine on a proposed input and checks it is supported. */
function evaluateProposal(proposedInput: GoalPlanInput): SupportedResult {
  const result = evaluateGoalPlan(proposedInput)
  if (result.status !== 'supported') {
    throw new Error(`Proposed alternative evaluated as '${result.status}', expected 'supported'`)
  }
  return result
}

/**
 * Builds two alternatives for a plan that needs adjustment, each changing
 * exactly one input while keeping the other:
 *  1. the smallest monthly contribution that reaches the target by the
 *     original date;
 *  2. the earliest target date that the original contribution reaches.
 * Both are re-evaluated with `evaluateGoalPlan`. Does not change the input,
 * apply anything, or advise which alternative to choose.
 */
export function exploreAlternatives(input: GoalPlanInput): GoalPlanAlternatives {
  const original = evaluateGoalPlan(input)
  if (original.status !== 'needs-adjustment') {
    return { status: 'not-needed', original }
  }

  const { remainingAmount, monthlyOpportunities, requiredMonthlyContribution } = original

  const increaseInput = { ...input, comfortableContribution: requiredMonthlyContribution }
  const increaseContribution: IncreaseContributionAlternative = {
    kind: 'increase-contribution',
    status: 'available',
    proposedInput: increaseInput,
    monthlyIncrease: original.monthlyShortfall,
    result: evaluateProposal(increaseInput),
    schedule: getContributionSchedule(remainingAmount, requiredMonthlyContribution),
  }

  return {
    status: 'available',
    original,
    increaseContribution,
    extendDate: buildExtendDate(input, remainingAmount, monthlyOpportunities),
  }
}

function buildExtendDate(
  input: GoalPlanInput,
  remainingAmount: MoneyAmount,
  originalOpportunities: number,
): ExtendDateAlternative {
  const contribution = input.comfortableContribution
  if (contribution <= 0) {
    return { kind: 'extend-date', status: 'unavailable', reason: 'zero-contribution' }
  }

  // Fewest whole months in which the original contribution covers the
  // remaining amount. It is always more than the original opportunities,
  // because the original plan fell short.
  const monthsNeeded = divideRoundingUp(remainingAmount, contribution)
  if (monthsNeeded > PLANNING_HORIZON_MONTHS) {
    return {
      kind: 'extend-date',
      status: 'unavailable',
      reason: 'beyond-planning-horizon',
      monthsNeeded,
      planningHorizonMonths: PLANNING_HORIZON_MONTHS,
    }
  }

  // The earliest date that contains exactly `monthsNeeded` whole months.
  const proposedInput = { ...input, targetDate: addMonthsToDate(input.today, monthsNeeded) }
  return {
    kind: 'extend-date',
    status: 'available',
    proposedInput,
    additionalMonths: monthsNeeded - originalOpportunities,
    result: evaluateProposal(proposedInput),
    schedule: getContributionSchedule(remainingAmount, contribution),
  }
}
