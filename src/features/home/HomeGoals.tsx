import { Icon } from '../../components/Icon'
import { ProgressBar } from '../../components/ProgressBar'
import type { CalendarDate } from '../../domain/goalTime'
import { summarizeGoals } from '../../domain/finance/goals'
import { activeGoalRows } from '../../domain/finance/home'
import { savingsSummary } from '../../domain/finance/savings'
import { ownerColor } from '../../domain/finance/space'
import type { FinanceData, Id } from '../../domain/finance/types'
import { formatAmount, formatDate } from '../../ui/format'

type Props = {
  data: FinanceData
  title: string
  today: CalendarDate
  onViewAll: () => void
  onAddGoal: () => void
  onOpenGoal: (id: Id) => void
}

/**
 * What am I saving for? One row per active goal with its type, what is
 * saved of the target and what is still to go. What the goals hold is
 * part of Savings (see My Money), not extra money.
 */
export function HomeGoals({ data, title, today, onViewAll, onAddGoal, onOpenGoal }: Props) {
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
