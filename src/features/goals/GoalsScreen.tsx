import { Icon } from '../../components/Icon'
import type { CalendarDate } from '../../domain/goalTime'
import { emergencyFund, filterGoals, goalProgress, goalSaved, summarizeGoals, type GoalFilter } from '../../domain/finance/goals'
import { ownerColor } from '../../domain/finance/space'
import type { FinanceData, Id } from '../../domain/finance/types'
import { formatAmount, formatDate } from '../../ui/format'

const FILTERS: { id: GoalFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'flexible', label: 'Flexible' },
  { id: 'dated', label: 'With Date' },
]

type Props = {
  data: FinanceData
  today: CalendarDate
  /** All, Flexible or With Date: kept while moving around the app (for this session). */
  filter: GoalFilter
  onFilterChange: (filter: GoalFilter) => void
  onNew: () => void
  onOpenGoal: (id: Id) => void
  /** No Emergency Fund yet: Start an Emergency Fund opens its draft. */
  onStartEmergency: () => void
}

/**
 * The Goals tab: the Emergency Fund on its own card, then every active
 * goal, its progress and what is still to go. The Emergency Fund is not
 * added to Saved in Goals, and both are part of Savings, not extra money.
 */
export function GoalsScreen({ data, today, filter, onFilterChange: setFilter, onNew, onOpenGoal, onStartEmergency }: Props) {
  const fund = emergencyFund(data.goals)
  const money = (minor: number) => formatAmount(minor, data.space.currency)
  const summary = summarizeGoals(data)
  const goals = filterGoals(data.goals, filter)
  const title = data.space.mode === 'individual' ? 'My Goals' : 'Our Goals'

  return (
    <div className="tab-screen">
      <div className="screen-top">
        <h1 className="tab-title">{title}</h1>
        <button type="button" className="button-small button-small-primary" data-return-key="add-goal" onClick={onNew}><Icon name="plus" size={16} /> Add Goal</button>
      </div>
      <section className="block" aria-labelledby="goals-emergency">
        <h2 id="goals-emergency" className="section-title">Emergency Fund</h2>
        {fund
          ? <button type="button" className="goal-card" data-return-key={`goal-${fund.id}`} onClick={() => onOpenGoal(fund.id)}>
            <span className="line"><b>{fund.name}</b><small>For unexpected costs</small></span>
            <span className="goal-card-amount">{money(goalSaved(fund, data.goalMovements))} <small>{fund.target !== null && fund.target !== undefined ? `of ${money(fund.target)}` : 'saved'}</small></span>
          </button>
          : <>
            <p className="muted-note">No Emergency Fund yet. It keeps part of your savings for unexpected costs.</p>
            <button type="button" className="button-small align-start" data-return-key="start-emergency" onClick={onStartEmergency}>Start an Emergency Fund</button>
          </>}
        <p className="field-help">The Emergency Fund is not added to Saved in Goals.</p>
      </section>
      <div className="stat-grid">
        <div className="stat"><small>Saved in Goals</small><b>{money(summary.saved)}</b></div>
        <div className="stat"><small>Total Targets</small><b>{money(summary.target)}</b>
          {summary.withoutTargetCount > 0 && <small>+ {summary.withoutTargetCount} with no target</small>}</div>
      </div>
      <p className="muted-note">What your goals hold is part of your Savings, not extra money on top of it.</p>
      <div className="month-switch" role="group" aria-label="Show goals">
        {FILTERS.map(option => (
          <button key={option.id} type="button" aria-pressed={filter === option.id} className={filter === option.id ? 'is-active' : ''} onClick={() => setFilter(option.id)}>
            {option.label}
          </button>
        ))}
      </div>
      {goals.length === 0
        ? <div className="empty-block">
          <p>{filter === 'all' ? 'No goals yet.' : filter === 'flexible' ? 'No flexible goals.' : 'No goals with a date.'}</p>
          {filter === 'all' && <p>Tap Add Goal to start one. It begins at 0.</p>}
        </div>
        : <ul className="goal-cards">
          {goals.map(goal => {
            const progress = goalProgress(goal, data.goalMovements, today)
            return (
              <li key={goal.id}>
                <button type="button" className="goal-card" data-return-key={`goal-${goal.id}`} onClick={() => onOpenGoal(goal.id)}>
                  <span className="line"><b>{goal.name}</b><small>{goal.deadline ? `With Date · ${formatDate(goal.deadline)}` : 'Flexible · No deadline'}</small></span>
                  {progress.hasTarget ? <>
                    <span className="goal-card-amount">{money(progress.saved)} <small>of {money(goal.target ?? 0)} · {Math.round(progress.percent)}%</small></span>
                    <span className="bar" role="progressbar" aria-label={`${goal.name} progress`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress.percent)}>
                      <span style={{ width: `${progress.percent}%`, background: ownerColor(data.space, goal.owner) }} />
                    </span>
                    <small>{progress.remaining > 0 ? `${money(progress.remaining)} to go` : 'Goal reached'}</small>
                  </> : <>
                    <span className="goal-card-amount">{money(progress.saved)} <small>saved · no target</small></span>
                  </>}
                </button>
              </li>
            )
          })}
        </ul>}
    </div>
  )
}
