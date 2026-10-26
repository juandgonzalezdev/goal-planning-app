import type { GoalPlanResult } from '../../domain/evaluateGoalPlan'
import type { MoneyAmount } from '../../domain/goalAmounts'

/** Short headings for each planning state, shared by every screen. */
export const STATUS_LABELS: Record<GoalPlanResult['status'], string> = {
  funded: 'Goal already funded',
  'invalid-target-date': 'Review your target date',
  'not-applicable': 'Monthly plan not applicable',
  supported: 'Plan is supported',
  'needs-adjustment': 'Plan needs adjustment',
}

/** Share of the target already saved, from 0 to 100, for the progress bar. */
export function progressPercent(target: MoneyAmount, remaining: MoneyAmount): number {
  return target > 0 ? Math.max(0, Math.min(100, ((target - remaining) / target) * 100)) : 0
}
