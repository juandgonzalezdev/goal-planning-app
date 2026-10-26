import { Icon } from '../../components/Icon'
import { ProgressBar } from '../../components/ProgressBar'
import { evaluateConfirmedGoal, type ConfirmedGoal } from '../../domain/goal'
import type { CalendarDate } from '../../domain/goalTime'
import type { FinanceData } from '../../domain/finance/types'
import { formatAmount, formatDate } from '../../ui/format'
import { progressPercent } from '../planner/planStatus'

type PlannerProps = {
  confirmedGoal: ConfirmedGoal | null
  currency: FinanceData['space']['currency']
  today: CalendarDate
  /** The planned goal is already one of the saved goals. */
  savedAsGoal: boolean
  onOpenPlanner: () => void
  onSaveAsGoal: () => void
}

/**
 * How can I plan another goal? The Goal Planner tries a plan before
 * anything is saved. Its plan stays apart from My Goals until the user
 * saves it as a goal, so the two never change each other by themselves.
 */
export function PlannerSection({ confirmedGoal, currency, today, savedAsGoal, onOpenPlanner, onSaveAsGoal }: PlannerProps) {
  const planned = confirmedGoal
    ? progressPercent(confirmedGoal.input.targetAmount, evaluateConfirmedGoal(confirmedGoal, today).remainingAmount)
    : 0
  return (
    <section className="block home-section" aria-labelledby="home-planner">
      <h2 id="home-planner" className="section-title">Plan Another Goal</h2>
      <p className="muted-note">Try a target, a date and a monthly amount, and compare alternatives before you decide. A plan is not saved in My Goals until you choose Save as Goal.</p>
      {confirmedGoal && <>
        <button type="button" className="goal-row planned-goal" onClick={onOpenPlanner}>
          <span><small>Planned goal</small>{confirmedGoal.details.name}</span>
          <span>{planned.toFixed(1)}%</span>
          <ProgressBar percent={planned} color="var(--color-accent)" label={`${confirmedGoal.details.name} progress`} />
        </button>
        {savedAsGoal
          ? <p className="muted-note">Saved in My Goals.</p>
          : <div className="inline-actions">
            <button type="button" className="button-small" onClick={onSaveAsGoal}>Save as Goal</button>
            <span className="field-help">Creates “{confirmedGoal.details.name}” in My Goals ({formatAmount(confirmedGoal.input.targetAmount, currency)}, {formatDate(confirmedGoal.input.targetDate)}) with 0 saved. Record money you already have in the goal.</span>
          </div>}
      </>}
      <button type="button" className="tool-row" onClick={onOpenPlanner}>
        <Icon name="target" />
        <span className="assistant-title">Goal Planner</span>
        <span className="assistant-text">{confirmedGoal ? 'See or edit your planned goal' : 'Plan a goal step by step'}</span>
        <Icon name="arrowRight" size={18} />
      </button>
      <div className="assistant-row">
        <Icon name="assistant" />
        <span className="assistant-title">Assistant<span className="badge">Coming soon</span></span>
        <span className="assistant-text">Will explain your numbers in simple words. You always decide.</span>
      </div>
    </section>
  )
}
