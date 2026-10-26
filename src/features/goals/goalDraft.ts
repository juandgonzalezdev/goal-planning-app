import { isCalendarDate } from '../../domain/calendar'
import { GOAL_NAME_MAX_LENGTH, characterCount } from '../../domain/goal'
import type { CalendarDate } from '../../domain/goalTime'
import type { MoneyAmount } from '../../domain/goalAmounts'
import type { MovementKind } from '../../domain/finance/goals'
import type { Goal, Owner } from '../../domain/finance/types'
import { parseMoneyInput } from '../../ui/moneyInput'

/** What the goal form holds while the user types. */
export interface GoalDraft {
  name: string
  target: string
  /** false: Flexible, no deadline. */
  dated: boolean
  deadline: string
}

export const EMPTY_GOAL_DRAFT: GoalDraft = { name: '', target: '', dated: false, deadline: '' }

/** The New Goal flow: the form, then the short confirmation (I5). */
export interface NewGoalState {
  draft: GoalDraft
  step: 'form' | 'confirm'
}

export const EMPTY_NEW_GOAL: NewGoalState = { draft: EMPTY_GOAL_DRAFT, step: 'form' }

export const draftFromGoal = (goal: Goal): GoalDraft => ({
  name: goal.name,
  target: goal.target === null ? '' : (goal.target / 100).toFixed(2),
  dated: goal.deadline !== null,
  deadline: goal.deadline ?? '',
})

export interface GoalDraftErrors { name?: string; target?: string; deadline?: string }

export interface ReadGoalOptions {
  today: CalendarDate
  owner: Owner
  /** When editing: the goal's current date, which may stay even if it has passed. */
  currentDeadline?: CalendarDate | null
}

/**
 * Turns the form into goal fields, or explains what to fix. The target is
 * optional (a box to save in); a date needs a target, so there is
 * something to reach by then. A new date must be after today; an existing
 * date may be kept as it is. No monthly amount is ever asked for.
 */
export function readGoalDraft(draft: GoalDraft, { today, owner, currentDeadline = null }: ReadGoalOptions):
  | { status: 'valid'; fields: { name: string; owner: Owner; target: MoneyAmount | null; deadline: CalendarDate | null } }
  | { status: 'invalid'; errors: GoalDraftErrors } {
  const errors: GoalDraftErrors = {}
  const name = draft.name.trim()
  if (name === '') errors.name = 'Enter a name for your goal.'
  else if (characterCount(name) > GOAL_NAME_MAX_LENGTH) errors.name = `Use ${GOAL_NAME_MAX_LENGTH} characters or fewer.`
  const noTarget = draft.target.trim() === ''
  const target = noTarget ? null : parseMoneyInput(draft.target)
  if (!noTarget && (target === null || target <= 0)) errors.target = 'Enter an amount above 0, such as 500 or 1250.50, or leave it empty.'
  else if (noTarget && draft.dated) errors.target = 'A goal with a date needs a target amount. Enter one, or choose Flexible.'
  let deadline: CalendarDate | null = null
  if (draft.dated) {
    if (!isCalendarDate(draft.deadline)) errors.deadline = 'Choose a target date.'
    else if (draft.deadline <= today && draft.deadline !== currentDeadline) errors.deadline = 'Choose a date after today.'
    else deadline = draft.deadline
  }
  if (errors.name || errors.target || errors.deadline) return { status: 'invalid', errors }
  return { status: 'valid', fields: { name, owner, target, deadline } }
}

/** What the contribution / withdrawal form holds. */
export interface MovementDraft {
  kind: MovementKind
  amount: string
  date: string
  note: string
}

export const NOTE_MAX_LENGTH = 100

export interface MovementDraftErrors { amount?: string; date?: string; note?: string }

/** Checks the movement form. Whether a withdrawal fits in the pot is checked by the goal itself. */
export function readMovementDraft(draft: MovementDraft, today: CalendarDate):
  | { status: 'valid'; amount: MoneyAmount; date: CalendarDate; note: string }
  | { status: 'invalid'; errors: MovementDraftErrors } {
  const errors: MovementDraftErrors = {}
  const amount = parseMoneyInput(draft.amount)
  if (amount === null || amount <= 0) errors.amount = 'Enter an amount above 0, such as 100 or 25.50.'
  if (!isCalendarDate(draft.date)) errors.date = 'Choose a date.'
  else if (draft.date > today) errors.date = 'The date can’t be after today.'
  const note = draft.note.trim()
  if (characterCount(note) > NOTE_MAX_LENGTH) errors.note = `Keep the note to ${NOTE_MAX_LENGTH} characters or fewer.`
  if (errors.amount || errors.date || errors.note) return { status: 'invalid', errors }
  return { status: 'valid', amount: amount as MoneyAmount, date: draft.date, note }
}
