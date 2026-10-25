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

/** What is in the pot: the opening balance plus every movement. */
export const goalSaved = (goal: Goal, movements: readonly GoalMovement[]): MoneyAmount =>
  goal.openingBalance + sumMinor(goalMovementsOf(movements, goal.id).map(m => m.amount))
