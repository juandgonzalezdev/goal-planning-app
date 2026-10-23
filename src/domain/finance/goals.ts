import { countWeeklyOpportunities, daysBetween, isCalendarDate } from '../calendar'
import { validateGoalDetails, type GoalDetailsError } from '../goal'
import type { CalendarDate } from '../goalTime'
import { getRemainingAmount, type MoneyAmount } from '../goalAmounts'
import { isMinorAmount, sumMinor } from '../money'
import { countMonthlyOpportunities } from '../monthlyPlan'
import { divideRoundingUp } from '../monthlyPlanEvaluation'
import type { FinanceData, Goal, GoalMovement, Id, Owner } from './types'

/** The pot's movements, oldest first (same-day movements keep the order they were added in). */
export const goalMovementsOf = (movements: readonly GoalMovement[], goalId: Id): GoalMovement[] =>
  movements
    .map((movement, order) => ({ movement, order }))
    .filter(({ movement }) => movement.goalId === goalId)
    .sort((a, b) => a.movement.date.localeCompare(b.movement.date) || a.order - b.order)
    .map(({ movement }) => movement)

/** What is in the pot: the opening balance plus every movement. */
export const goalSaved = (goal: Goal, movements: readonly GoalMovement[]): MoneyAmount =>
  goal.openingBalance + sumMinor(goalMovementsOf(movements, goal.id).map(m => m.amount))

/** A suggested pace: how much each time to reach the target by the date. Never a payment. */
export interface PaceSuggestion {
  /** How many contributions fit before the deadline. */
  opportunities: number
  /** Rounded up to the next grosz, so paying it every time always reaches the target. */
  amount: MoneyAmount
}

export type GoalPace =
  | { status: 'no-deadline' }
  | { status: 'reached' }
  | { status: 'deadline-passed' }
  /** null when not even one whole week (or month) fits before the deadline. */
  | { status: 'suggested'; weekly: PaceSuggestion | null; monthly: PaceSuggestion | null }

export interface GoalProgress {
  saved: MoneyAmount
  remaining: MoneyAmount
  /** 0 to 100. Above-target savings show 100. */
  percent: number
  /** Whole days to the deadline (0 on the day itself, negative after it), or null with no deadline. */
  daysToDeadline: number | null
  pace: GoalPace
}

const suggestion = (remaining: MoneyAmount, opportunities: number): PaceSuggestion | null =>
  opportunities > 0 ? { opportunities, amount: divideRoundingUp(remaining, opportunities) } : null

/**
 * Where a pot stands today. The monthly pace uses the approved monthly
 * rule (whole months, first contribution one month from today); the weekly
 * pace uses the same rule with weeks.
 */
export function goalProgress(goal: Goal, movements: readonly GoalMovement[], today: CalendarDate): GoalProgress {
  const saved = goalSaved(goal, movements)
  const remaining = getRemainingAmount(goal.target, saved)
  const percent = goal.target > 0 ? Math.min(100, (Math.max(saved, 0) / goal.target) * 100) : 100
  const daysToDeadline = goal.deadline === null ? null : daysBetween(today, goal.deadline)

  let pace: GoalPace
  if (goal.deadline === null) pace = { status: 'no-deadline' }
  else if (remaining === 0) pace = { status: 'reached' }
  else if (daysToDeadline !== null && daysToDeadline <= 0) pace = { status: 'deadline-passed' }
  else pace = {
    status: 'suggested',
    weekly: suggestion(remaining, countWeeklyOpportunities(today, goal.deadline)),
    monthly: suggestion(remaining, countMonthlyOpportunities(today, goal.deadline)),
  }
  return { saved, remaining, percent, daysToDeadline, pace }
}

export interface GoalsSummary {
  /** Active goals only. */
  saved: MoneyAmount
  target: MoneyAmount
  activeCount: number
}

export function summarizeGoals(data: Pick<FinanceData, 'goals' | 'goalMovements'>): GoalsSummary {
  const active = data.goals.filter(goal => goal.status === 'active')
  return {
    saved: sumMinor(active.map(goal => goalSaved(goal, data.goalMovements))),
    target: sumMinor(active.map(goal => goal.target)),
    activeCount: active.length,
  }
}

export type MovementKind = 'contribution' | 'withdrawal'

export interface MovementRequest {
  id: Id
  goalId: Id
  kind: MovementKind
  /** Always positive; `kind` says the direction. */
  amount: MoneyAmount
  date: CalendarDate
  note: string
}

export type MovementError = 'goal-not-found' | 'goal-archived' | 'amount-not-positive' | 'invalid-date' | 'more-than-saved'

/**
 * Adds one contribution or withdrawal to a pot. A withdrawal can never take
 * out more than is saved. Nothing else changes: no account balance, no
 * other goal. No money is actually moved.
 */
export function addGoalMovement(data: FinanceData, request: MovementRequest): { status: 'ok'; data: FinanceData } | { status: 'rejected'; error: MovementError } {
  const goal = data.goals.find(g => g.id === request.goalId)
  if (!goal) return { status: 'rejected', error: 'goal-not-found' }
  if (goal.status !== 'active') return { status: 'rejected', error: 'goal-archived' }
  if (!isMinorAmount(request.amount) || request.amount <= 0) return { status: 'rejected', error: 'amount-not-positive' }
  if (!isCalendarDate(request.date)) return { status: 'rejected', error: 'invalid-date' }
  if (request.kind === 'withdrawal' && request.amount > goalSaved(goal, data.goalMovements)) {
    return { status: 'rejected', error: 'more-than-saved' }
  }
  const movement: GoalMovement = {
    id: request.id,
    goalId: goal.id,
    date: request.date,
    amount: request.kind === 'contribution' ? request.amount : -request.amount,
    note: request.note.trim(),
  }
  return { status: 'ok', data: { ...data, goalMovements: [...data.goalMovements, movement] } }
}

/** What the user can set when creating or editing a goal. */
export interface GoalFields {
  name: string
  owner: Owner
  target: MoneyAmount
  deadline: CalendarDate | null
}

export type GoalFieldError = GoalDetailsError | 'target-not-positive' | 'invalid-deadline' | 'unknown-owner'

/**
 * Checks goal fields. The name follows the existing goal rules (required,
 * at most 60 characters, trimmed). A deadline is optional and may be any
 * real date; whether it is still ahead is shown by the progress, not
 * blocked here.
 */
export function validateGoalFields(data: Pick<FinanceData, 'space'>, fields: GoalFields): { status: 'valid'; fields: GoalFields } | { status: 'invalid'; errors: GoalFieldError[] } {
  const errors: GoalFieldError[] = []
  const details = validateGoalDetails(fields.name, '')
  if (details.status === 'invalid') errors.push(...details.errors)
  if (!isMinorAmount(fields.target) || fields.target <= 0) errors.push('target-not-positive')
  if (fields.deadline !== null && !isCalendarDate(fields.deadline)) errors.push('invalid-deadline')
  if (fields.owner !== 'shared' && !data.space.members.some(member => member.id === fields.owner)) errors.push('unknown-owner')
  return errors.length > 0 ? { status: 'invalid', errors } : { status: 'valid', fields: { ...fields, name: fields.name.trim() } }
}

/** Creates an empty pot. It starts with nothing saved and no movements. */
export function createGoal(data: FinanceData, id: Id, fields: GoalFields, today: CalendarDate) {
  const checked = validateGoalFields(data, fields)
  if (checked.status === 'invalid') return checked
  const goal: Goal = { id, ...checked.fields, currency: data.space.currency, openingBalance: 0, createdOn: today, status: 'active' }
  return { status: 'valid' as const, data: { ...data, goals: [...data.goals, goal] } }
}

/** Changes a goal's name, owner, target or date. Its movements and every other record stay as they are. */
export function updateGoal(data: FinanceData, id: Id, fields: GoalFields) {
  const checked = validateGoalFields(data, fields)
  if (checked.status === 'invalid') return checked
  return { status: 'valid' as const, data: { ...data, goals: data.goals.map(goal => (goal.id === id ? { ...goal, ...checked.fields } : goal)) } }
}

/** Removes a goal from the active list but keeps it and its movements, so no history is lost. */
export const archiveGoal = (data: FinanceData, id: Id): FinanceData =>
  ({ ...data, goals: data.goals.map(goal => (goal.id === id ? { ...goal, status: 'archived' } : goal)) })
