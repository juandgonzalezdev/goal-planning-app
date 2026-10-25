import { Icon } from '../../components/Icon'
import { evaluateConfirmedGoal, type ConfirmedGoal } from '../../domain/goal'
import type { CalendarDate } from '../../domain/goalTime'
import { summarizeGoals } from '../../domain/finance/goals'
import { activeGoalRows } from '../../domain/finance/home'
import { savingsSummary } from '../../domain/finance/savings'
import { ownerColor } from '../../domain/finance/space'
import type { FinanceData, Id } from '../../domain/finance/types'
import { formatAmount, formatDate } from '../../ui/format'
import { progressPercent } from '../../ui/planStatus'

type Props = {
  data: FinanceData
  title: string
  today: CalendarDate
  onViewAll: () => void
  onAddGoal: () => void
  onOpenGoal: (id: Id) => void
}

function ProgressBar({ percent, color, label }: { percent: number; color: string; label: string }) {
  return (
    <div className="bar thin" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(percent)}>
      <div style={{ width: `${percent}%`, background: color }} />
    </div>
  )
}

/**
 * What am I saving for? One row per active goal with its type, what is
 * saved of the target and what is still to go. What the goals hold is
 * part of Savings (see My Money), not extra money.
 */
export function OurGoals({ data, title, today, onViewAll, onAddGoal, onOpenGoal }: Props) {
  const rows = activeGoalRows(data, today)
  const summary = summarizeGoals(data)
  const savings = savingsSummary(data)
  const money = (minor: number) => formatAmount(minor, data.space.currency)

  return (
    <section className="block home-section" aria-labelledby="home-goals">
      <div className="section-head">
        <h2 id="home-goals" className="section-title">{title}</h2>
        <div className="inline-actions">
          <button type="button" className="button-small button-small-primary" onClick={onAddGoal}><Icon name="plus" size={16} /> Add Goal</button>
          <button type="button" className="button-small" onClick={onViewAll}>View All <Icon name="arrowRight" size={16} /></button>
        </div>
      </div>
      {rows.length === 0
        ? <p className="muted-note">No goals yet.</p>
        : <>
          <div className="goals-total">
            <b>{money(summary.saved)}</b>
            <small>Saved for {summary.activeCount} {summary.activeCount === 1 ? 'goal' : 'goals'}{savings.total !== null ? ` · part of your Savings (${money(savings.total)})` : ''}</small>
          </div>
          <ul className="goal-rows">
            {rows.map(({ goal, progress }) => (
              <li key={goal.id}>
                <button type="button" className="goal-row" onClick={() => onOpenGoal(goal.id)}>
                  <span>{goal.name}<small className="goal-kind">{goal.deadline ? `With Date · ${formatDate(goal.deadline)}` : 'Flexible'}</small></span>
                  <span>{Math.round(progress.percent)}%</span>
                  <ProgressBar percent={progress.percent} color={ownerColor(data.space, goal.owner)} label={`${goal.name} progress`} />
                  <small className="goal-row-amounts">{money(progress.saved)} of {money(goal.target ?? 0)} · {progress.remaining > 0 ? `${money(progress.remaining)} to go` : 'Goal reached'}</small>
                </button>
              </li>
            ))}
          </ul>
        </>}
    </section>
  )
}

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
