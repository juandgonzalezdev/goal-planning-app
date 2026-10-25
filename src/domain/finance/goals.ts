import { countWeeklyOpportunities, daysBetween, isCalendarDate } from '../calendar'
import { validateGoalDetails, type GoalDetailsError } from '../goal'
import type { CalendarDate } from '../goalTime'
import { getRemainingAmount, type MoneyAmount } from '../goalAmounts'
import { isMinorAmount, sumMinor } from '../money'
import { countMonthlyOpportunities } from '../monthlyPlan'
import { divideRoundingUp } from '../monthlyPlanEvaluation'
import { latestBalance } from './balances'
import { goalSaved } from './pots'
import { savingsSummary } from './savings'
import { MOVEMENT_EFFECTS, type BalanceSnapshot, type FinanceData, type Goal, type GoalMovement, type Id, type MovementEffect, type Owner } from './types'

export { goalMovementsOf, goalSaved } from './pots'

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
  /** 0 when there is no target (the emergency fund). */
  remaining: MoneyAmount
  /** 0 to 100, from the amounts. Above-target savings show 100. Never stored. */
  percent: number
  /** False for the emergency fund, which has no target: then percent and remaining mean nothing. */
  hasTarget: boolean
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
  const target = goal.target
  const remaining = target === null ? 0 : getRemainingAmount(target, saved)
  const percent = target === null ? 0 : target > 0 ? Math.min(100, (Math.max(saved, 0) * 100) / target) : 100
  const daysToDeadline = goal.deadline === null ? null : daysBetween(today, goal.deadline)

  let pace: GoalPace
  if (goal.deadline === null || target === null) pace = { status: 'no-deadline' }
  else if (remaining === 0) pace = { status: 'reached' }
  else if (daysToDeadline !== null && daysToDeadline <= 0) pace = { status: 'deadline-passed' }
  else pace = {
    status: 'suggested',
    weekly: suggestion(remaining, countWeeklyOpportunities(today, goal.deadline)),
    monthly: suggestion(remaining, countMonthlyOpportunities(today, goal.deadline)),
  }
  return { saved, remaining, percent, hasTarget: target !== null, daysToDeadline, pace }
}

export interface GoalsSummary {
  /** Active goals only (not the emergency fund). Part of Savings, not extra money. */
  saved: MoneyAmount
  target: MoneyAmount
  activeCount: number
}

/** The goals the user is saving for: active, and not the emergency fund. */
export const activeGoals = (goals: readonly Goal[]): Goal[] => goals.filter(goal => goal.status === 'active' && goal.kind === 'goal')

/** The emergency fund, if the space has one. */
export const emergencyFund = (goals: readonly Goal[]): Goal | null =>
  goals.find(goal => goal.kind === 'emergency' && goal.status === 'active') ?? null

export function summarizeGoals(data: Pick<FinanceData, 'goals' | 'goalMovements'>): GoalsSummary {
  const active = activeGoals(data.goals)
  return {
    saved: sumMinor(active.map(goal => goalSaved(goal, data.goalMovements))),
    target: sumMinor(active.map(goal => goal.target ?? 0)),
    activeCount: active.length,
  }
}

export type MovementKind = 'contribution' | 'withdrawal'

/** Which way a movement goes. */
export const movementKind = (effect: MovementEffect): MovementKind =>
  effect === 'new-savings' || effect === 'assigned' ? 'contribution' : 'withdrawal'

export interface MovementRequest {
  id: Id
  goalId: Id
  effect: MovementEffect
  /** Always positive; `effect` says the direction. */
  amount: MoneyAmount
  date: CalendarDate
  note: string
  /** The savings account, for new savings and money taken out. */
  accountId?: Id
}

export type MovementError = 'goal-not-found' | 'invalid-effect' | 'goal-archived' | 'amount-not-positive' | 'invalid-date' | 'more-than-saved'
  | 'more-than-unassigned' | 'not-a-savings-account' | 'account-balance-unknown' | 'before-balance-date' | 'more-than-account'

/**
 * Records one movement of a pot, and what it does to Savings:
 * - new-savings: the pot and the savings account grow by the amount, once.
 * - assigned: existing unassigned savings go to the pot. Savings stay the same.
 * - unassigned: the pot gives money back to unassigned savings. Savings stay the same.
 * - taken-out: the pot and the savings account shrink (the money was spent or moved out).
 *
 * The account's new balance is a new snapshot marked as coming from this
 * movement, so its history shows why it changed. No money is moved for
 * real, and the money is never assumed to come from Daily Spending or
 * from income. A pot never goes below 0, and unassigned savings, when the
 * savings balance is known, never go below 0 either.
 */
export function addGoalMovement(data: FinanceData, request: MovementRequest): { status: 'ok'; data: FinanceData } | { status: 'rejected'; error: MovementError } {
  const goal = data.goals.find(g => g.id === request.goalId)
  if (!goal) return { status: 'rejected', error: 'goal-not-found' }
  if (goal.status !== 'active') return { status: 'rejected', error: 'goal-archived' }
  if (!isMinorAmount(request.amount) || request.amount <= 0) return { status: 'rejected', error: 'amount-not-positive' }
  if (!isCalendarDate(request.date)) return { status: 'rejected', error: 'invalid-date' }
  const { effect, amount } = request
  if (!(MOVEMENT_EFFECTS as readonly string[]).includes(effect)) return { status: 'rejected', error: 'invalid-effect' }
  if ((effect === 'unassigned' || effect === 'taken-out') && amount > goalSaved(goal, data.goalMovements)) {
    return { status: 'rejected', error: 'more-than-saved' }
  }
  if (effect === 'assigned') {
    const { unassigned } = savingsSummary(data)
    if (unassigned !== null && amount > Math.max(unassigned, 0)) return { status: 'rejected', error: 'more-than-unassigned' }
  }

  let balances = data.balances
  const movesAccount = effect === 'new-savings' || effect === 'taken-out'
  if (movesAccount) {
    const account = data.moneyAccounts.find(a => a.id === request.accountId && a.kind === 'savings')
    if (!account) return { status: 'rejected', error: 'not-a-savings-account' }
    const latest = latestBalance(data.balances, account.id)
    if (!latest) return { status: 'rejected', error: 'account-balance-unknown' }
    if (request.date < latest.asOf) return { status: 'rejected', error: 'before-balance-date' }
    if (effect === 'taken-out' && amount > latest.amount) return { status: 'rejected', error: 'more-than-account' }
    const snapshot: BalanceSnapshot = {
      id: `${request.id}-balance`, accountId: account.id, asOf: request.date,
      amount: latest.amount + (effect === 'new-savings' ? amount : -amount),
      currency: data.space.currency, source: 'goal-movement', movementId: request.id,
    }
    balances = [...balances, snapshot]
  }

  const movement: GoalMovement = {
    id: request.id,
    goalId: goal.id,
    date: request.date,
    amount: movementKind(effect) === 'contribution' ? amount : -amount,
    note: request.note.trim(),
    effect,
    ...(movesAccount ? { accountId: request.accountId } : {}),
  }
  return { status: 'ok', data: { ...data, balances, goalMovements: [...data.goalMovements, movement] } }
}

/** What the user can set when creating or editing a goal. */
export interface GoalFields {
  name: string
  owner: Owner
  /** null only for the emergency fund. */
  target: MoneyAmount | null
  deadline: CalendarDate | null
}

export type GoalFieldError = GoalDetailsError | 'target-not-positive' | 'invalid-deadline' | 'unknown-owner'

/**
 * Checks goal fields. The name follows the existing goal rules (required,
 * at most 60 characters, trimmed). A deadline is optional and may be any
 * real date; whether it is still ahead is shown by the progress, not
 * blocked here.
 */
export function validateGoalFields(data: Pick<FinanceData, 'space'>, fields: GoalFields, kind: Goal['kind'] = 'goal'): { status: 'valid'; fields: GoalFields } | { status: 'invalid'; errors: GoalFieldError[] } {
  const errors: GoalFieldError[] = []
  const details = validateGoalDetails(fields.name, '')
  if (details.status === 'invalid') errors.push(...details.errors)
  const targetOptional = kind === 'emergency' && fields.target === null
  if (!targetOptional && (!isMinorAmount(fields.target) || fields.target <= 0)) errors.push('target-not-positive')
  if (fields.deadline !== null && !isCalendarDate(fields.deadline)) errors.push('invalid-deadline')
  if (fields.owner !== 'shared' && !data.space.members.some(member => member.id === fields.owner)) errors.push('unknown-owner')
  return errors.length > 0 ? { status: 'invalid', errors } : { status: 'valid', fields: { ...fields, name: fields.name.trim() } }
}

/** Creates an empty pot. It starts with nothing saved and no movements. */
export function createGoal(data: FinanceData, id: Id, fields: GoalFields, today: CalendarDate) {
  const checked = validateGoalFields(data, fields)
  if (checked.status === 'invalid') return checked
  const goal: Goal = { id, kind: 'goal', ...checked.fields, currency: data.space.currency, openingBalance: 0, createdOn: today, status: 'active' }
  return { status: 'valid' as const, data: { ...data, goals: [...data.goals, goal] } }
}

/** Starts an empty emergency fund (no target, no date), if the space has none. */
export function createEmergencyFund(data: FinanceData, id: Id, owner: Owner, today: CalendarDate): FinanceData {
  if (emergencyFund(data.goals)) return data
  const goal: Goal = { id, kind: 'emergency', name: 'Emergency Fund', owner, target: null, currency: data.space.currency, deadline: null, openingBalance: 0, createdOn: today, status: 'active' }
  return { ...data, goals: [...data.goals, goal] }
}

/** Changes a goal's name, owner, target or date. Its movements and every other record stay as they are. */
export function updateGoal(data: FinanceData, id: Id, fields: GoalFields) {
  const kind = data.goals.find(goal => goal.id === id)?.kind ?? 'goal'
  const checked = validateGoalFields(data, fields, kind)
  if (checked.status === 'invalid') return checked
  return { status: 'valid' as const, data: { ...data, goals: data.goals.map(goal => (goal.id === id ? { ...goal, ...checked.fields } : goal)) } }
}

/** Removes a goal from the active list but keeps it and its movements, so no history is lost. */
export const archiveGoal = (data: FinanceData, id: Id): FinanceData =>
  ({ ...data, goals: data.goals.map(goal => (goal.id === id ? { ...goal, status: 'archived' } : goal)) })

/**
 * Deletes a goal and its movements, when the user asks for it. What was
 * saved in it goes back to unassigned savings: no account balance changes
 * (balances worked out from its movements stay as history). Nothing else
 * changes. (Archiving, above, is the way to hide a goal and keep its history.)
 */
export const deleteGoal = (data: FinanceData, id: Id): FinanceData => ({
  ...data,
  goals: data.goals.filter(goal => goal.id !== id),
  goalMovements: data.goalMovements.filter(movement => movement.goalId !== id),
})

export type GoalFilter = 'all' | 'flexible' | 'dated'

/** The goals list filters: All, Flexible (no deadline) and With Date. Archived goals are never listed. */
export const filterGoals = (goals: readonly Goal[], filter: GoalFilter): Goal[] =>
  activeGoals(goals).filter(goal => (filter === 'all' || (filter === 'flexible' ? goal.deadline === null : goal.deadline !== null)))
