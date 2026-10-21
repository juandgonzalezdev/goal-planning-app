import { evaluateGoalPlan, type GoalPlanInput, type GoalPlanResult } from './evaluateGoalPlan'
import type { CalendarDate } from './goalTime'

export const GOAL_NAME_MAX_LENGTH = 60
export const GOAL_DESCRIPTION_MAX_LENGTH = 200

/** A goal's name and optional description, already trimmed. */
export interface GoalDetails {
  name: string
  /** Empty when the user gave no description. */
  description: string
}

export type GoalDetailsError = 'name-required' | 'name-too-long' | 'description-too-long'

export type GoalDetailsValidation =
  | { status: 'valid'; details: GoalDetails }
  | { status: 'invalid'; errors: GoalDetailsError[] }

/**
 * A goal the user explicitly confirmed. It stores what the user accepted,
 * never calculation results: those are recalculated when needed.
 */
export interface ConfirmedGoal {
  details: GoalDetails
  /** The exact evaluated input the user accepted; `input.today` is the day it was evaluated. */
  input: GoalPlanInput
  confirmedOn: CalendarDate
}

export type ConfirmGoalResult =
  | { status: 'confirmed'; goal: ConfirmedGoal }
  | { status: 'invalid-details'; errors: GoalDetailsError[] }
  | { status: 'not-confirmable'; planStatus: GoalPlanResult['status'] }

/**
 * Counts characters as a person sees them, so 'ł' or an emoji counts as one
 * (plain `.length` counts some of them as two).
 */
export const characterCount = (text: string) => Array.from(text).length

export function validateGoalDetails(name: string, description: string): GoalDetailsValidation {
  const details = { name: name.trim(), description: description.trim() }
  const errors: GoalDetailsError[] = []
  if (details.name === '') errors.push('name-required')
  else if (characterCount(details.name) > GOAL_NAME_MAX_LENGTH) errors.push('name-too-long')
  if (characterCount(details.description) > GOAL_DESCRIPTION_MAX_LENGTH) errors.push('description-too-long')
  return errors.length === 0 ? { status: 'valid', details } : { status: 'invalid', errors }
}

/**
 * Plans the user may confirm as a goal. A plan that needs adjustment is
 * allowed: the user decides whether to accept the shortfall. Invalid dates
 * and deadlines without a monthly plan have nothing to confirm.
 */
export function isConfirmable(result: GoalPlanResult): boolean {
  return result.status === 'supported' || result.status === 'needs-adjustment' || result.status === 'funded'
}

/**
 * Builds the confirmed goal from validated details and the accepted input.
 * The input is evaluated here, so the record can never be paired with a
 * result calculated from other numbers. Nothing is stored or changed.
 */
export function confirmGoal(name: string, description: string, input: GoalPlanInput, confirmedOn: CalendarDate): ConfirmGoalResult {
  const validation = validateGoalDetails(name, description)
  if (validation.status === 'invalid') return { status: 'invalid-details', errors: validation.errors }
  const result = evaluateGoalPlan(input)
  if (!isConfirmable(result)) return { status: 'not-confirmable', planStatus: result.status }
  return { status: 'confirmed', goal: { details: validation.details, input: { ...input }, confirmedOn } }
}

/**
 * Today's projection for a confirmed goal: the same confirmed amounts and
 * date, calculated from `today`. The confirmed goal itself is not changed,
 * and the amount already saved is the one the user entered, not a verified balance.
 */
export function evaluateConfirmedGoal(goal: ConfirmedGoal, today: CalendarDate): GoalPlanResult {
  return evaluateGoalPlan({ ...goal.input, today })
}

export type NeedsAdjustmentResult = Extract<GoalPlanResult, { status: 'needs-adjustment' }>

/**
 * What confirming a plan that needs adjustment means by the target date:
 * the total the chosen contributions would add up to, and the part of the
 * remaining amount they would leave uncovered (always above zero here).
 */
export function getShortfallAtTargetDate(input: GoalPlanInput, result: NeedsAdjustmentResult) {
  const plannedTotal = input.comfortableContribution * result.monthlyOpportunities
  return { plannedTotal, uncoveredAmount: result.remainingAmount - plannedTotal }
}
