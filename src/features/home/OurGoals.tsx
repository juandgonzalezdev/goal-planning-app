import { Icon } from '../../components/Icon'
import { evaluateConfirmedGoal, type ConfirmedGoal } from '../../domain/goal'
import type { CalendarDate } from '../../domain/goalTime'
import { summarizeGoals } from '../../domain/finance/goals'
import { activeGoalRows } from '../../domain/finance/home'
import { ownerColor } from '../../domain/finance/space'
import type { FinanceData } from '../../domain/finance/types'
import { formatAmount } from '../../ui/format'
import { progressPercent } from '../../ui/planStatus'

type Props = {
  data: FinanceData
  title: string
  today: CalendarDate
  /** The goal confirmed in the Goal Planner (kept in memory, as in Phase 2). */
  confirmedGoal: ConfirmedGoal | null
  onOpenPlanner: () => void
}

function ProgressBar({ percent, color, label }: { percent: number; color: string; label: string }) {
  return (
    <div className="bar thin" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(percent)}>
      <div style={{ width: `${percent}%`, background: color }} />
    </div>
  )
}

/**
 * Our Goals: what is saved in the pots, one row per active goal. It also
 * keeps the way into the Goal Planner and shows the Assistant as coming soon.
 */
export function OurGoals({ data, title, today, confirmedGoal, onOpenPlanner }: Props) {
  const rows = activeGoalRows(data, today)
  const summary = summarizeGoals(data)
  const planned = confirmedGoal
    ? progressPercent(confirmedGoal.input.targetAmount, evaluateConfirmedGoal(confirmedGoal, today).remainingAmount)
    : 0

  return (
    <section className="block home-section" aria-labelledby="home-goals">
      <div className="section-head">
        <h2 id="home-goals" className="section-title">{title}</h2>
        <button type="button" className="button-small" onClick={onOpenPlanner}>Goal Planner <Icon name="arrowRight" size={16} /></button>
      </div>
      {rows.length === 0
        ? <p className="muted-note">No goals yet.</p>
        : <>
          <div className="goals-total">
            <b>{formatAmount(summary.saved, data.space.currency)}</b>
            <small>Saved toward {summary.activeCount} {summary.activeCount === 1 ? 'goal' : 'goals'}</small>
          </div>
          <ul className="goal-rows">
            {rows.map(({ goal, progress }) => (
              <li key={goal.id} className="goal-row">
                <span>{goal.name}</span>
                <span>{Math.round(progress.percent)}%</span>
                <ProgressBar percent={progress.percent} color={ownerColor(data.space, goal.owner)} label={`${goal.name} progress`} />
              </li>
            ))}
          </ul>
        </>}
      {confirmedGoal && (
        <button type="button" className="goal-row planned-goal" onClick={onOpenPlanner}>
          <span><small>Planned goal</small>{confirmedGoal.details.name}</span>
          <span>{planned.toFixed(1)}%</span>
          <ProgressBar percent={planned} color="var(--color-accent)" label={`${confirmedGoal.details.name} progress`} />
        </button>
      )}
      <div className="assistant-row">
        <Icon name="assistant" />
        <span className="assistant-title">Assistant<span className="badge">Coming soon</span></span>
        <span className="assistant-text">Will explain your numbers in simple words. You always decide.</span>
      </div>
    </section>
  )
}
