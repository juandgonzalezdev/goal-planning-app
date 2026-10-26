import type { CalendarDate } from '../goalTime'
import type { MoneyAmount } from '../goalAmounts'
import { sumMinor } from '../money'
import type { Goal, GoalMovement, Id } from './types'

/** The pot's movements, oldest first (same-day movements keep the order they were added in). */
export const goalMovementsOf = (movements: readonly GoalMovement[], goalId: Id): GoalMovement[] =>
  movements
    .map((movement, order) => ({ movement, order }))
    .filter(({ movement }) => movement.goalId === goalId)
    .sort((a, b) => a.movement.date.localeCompare(b.movement.date) || a.order - b.order)
    .map(({ movement }) => movement)

/** What is in the pot: the opening balance plus every movement (up to `asOf`, when given). */
export const goalSaved = (goal: Goal, movements: readonly GoalMovement[], asOf?: CalendarDate): MoneyAmount =>
  goal.openingBalance + sumMinor(goalMovementsOf(movements, goal.id).filter(m => asOf === undefined || m.date <= asOf).map(m => m.amount))
