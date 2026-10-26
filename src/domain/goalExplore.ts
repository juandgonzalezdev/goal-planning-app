import type { CalendarDate } from './goalTime'
import type { MoneyAmount } from './goalAmounts'
import { addMonthsToDate, countMonthlyOpportunities } from './monthlyPlan'
import { divideRoundingUp, evaluateMonthlyPlan, type MonthlyPlanEvaluation } from './monthlyPlanEvaluation'

/**
 * Exploring a goal: "what if I saved this much a month?" and "what would
 * this date need?". It only calculates, from the amount still to go and
 * today, with the approved monthly rule (whole months, the first
 * contribution one month from today). Nothing is saved or committed, and
 * no monthly amount is ever required to keep a goal.
 */

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
  /** The last contribution: smaller than the others when the amount does not divide exactly. */
  finalContribution: MoneyAmount
}

/**
 * Equal contributions of `monthlyContribution` until `remainingAmount` is
 * reached; the last one covers only what is still missing.
 * `monthlyContribution` must be greater than 0.
 */
export function getContributionSchedule(remainingAmount: MoneyAmount, monthlyContribution: MoneyAmount): ContributionSchedule {
  const contributionCount = divideRoundingUp(remainingAmount, monthlyContribution)
  return {
    monthlyContribution,
    contributionCount,
    finalContribution: remainingAmount - (contributionCount - 1) * monthlyContribution,
  }
}

/** Longest time the explorer shows (50 years): a technical limit, not a judgement. */
export const EXPLORE_HORIZON_MONTHS = 600

export type MonthlyTry =
  | { status: 'reached' }
  | { status: 'zero' }
  | { status: 'too-long'; months: number }
  | {
      status: 'ok'
      schedule: ContributionSchedule
      /** The day of the last contribution. */
      reachedOn: CalendarDate
      /** With a deadline: whether this amount reaches it in time. */
      byDeadline: MonthlyPlanEvaluation | null
    }

/** Saving `perMonth` each month from next month: when the goal would be reached, and how it compares with its date. */
export function tryMonthlyAmount(remaining: MoneyAmount, perMonth: MoneyAmount, today: CalendarDate, deadline: CalendarDate | null): MonthlyTry {
  if (remaining <= 0) return { status: 'reached' }
  if (perMonth <= 0) return { status: 'zero' }
  const schedule = getContributionSchedule(remaining, perMonth)
  if (schedule.contributionCount > EXPLORE_HORIZON_MONTHS) return { status: 'too-long', months: schedule.contributionCount }
  const byDeadline = deadline
    ? evaluateMonthlyPlan({ remainingAmount: remaining, opportunities: countMonthlyOpportunities(today, deadline), comfortableContribution: perMonth })
    : null
  return { status: 'ok', schedule, reachedOn: addMonthsToDate(today, schedule.contributionCount), byDeadline }
}

export type DateTry =
  | { status: 'reached' }
  | { status: 'too-soon' }
  | { status: 'ok'; months: number; perMonth: MoneyAmount; schedule: ContributionSchedule }

/** What a date would need each month (rounded up, so paying it every month always reaches the target). */
export function tryDate(remaining: MoneyAmount, date: CalendarDate, today: CalendarDate): DateTry {
  if (remaining <= 0) return { status: 'reached' }
  const months = countMonthlyOpportunities(today, date)
  if (months <= 0) return { status: 'too-soon' }
  const perMonth = divideRoundingUp(remaining, months)
  return { status: 'ok', months, perMonth, schedule: getContributionSchedule(remaining, perMonth) }
}
