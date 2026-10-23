import { useState } from 'react'
import { Icon } from '../../components/Icon'
import type { CalendarDate } from '../../domain/goalTime'
import { filterGoals, goalProgress, summarizeGoals, type GoalFilter } from '../../domain/finance/goals'
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
  onBack: () => void
  onNew: () => void
  onOpenGoal: (id: Id) => void
}

/** Goals & Savings Pots: every active goal, its progress and what is still to go. */
export function GoalsScreen({ data, today, onBack, onNew, onOpenGoal }: Props) {
  const [filter, setFilter] = useState<GoalFilter>('all')
  const money = (minor: number) => formatAmount(minor, data.space.currency)
  const summary = summarizeGoals(data)
  const goals = filterGoals(data.goals, filter)
  const title = data.space.mode === 'individual' ? 'My Goals' : 'Our Goals'

  return (
    <div className="tab-screen">
      <div className="screen-top">
        <button type="button" className="back-link" onClick={onBack}><Icon name="arrowLeft" size={18} /> Home</button>
        <button type="button" className="button-small button-small-primary" onClick={onNew}><Icon name="plus" size={16} /> New Goal</button>
      </div>
      <h1 className="tab-title">{title}</h1>
      <div className="stat-grid">
        <div className="stat"><small>Saved in Goals</small><b>{money(summary.saved)}</b></div>
        <div className="stat"><small>Total Targets</small><b>{money(summary.target)}</b></div>
      </div>
      <p className="muted-note">Goals set money aside. They are not added to {data.space.mode === 'individual' ? 'My' : 'Our'} Money.</p>
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
          {filter === 'all' && <p>Tap New Goal to start one. It begins at 0.</p>}
        </div>
        : <ul className="goal-cards">
          {goals.map(goal => {
            const progress = goalProgress(goal, data.goalMovements, today)
            return (
              <li key={goal.id}>
                <button type="button" className="goal-card" onClick={() => onOpenGoal(goal.id)}>
                  <span className="line"><b>{goal.name}</b><small>{goal.deadline ? formatDate(goal.deadline) : 'No deadline'}</small></span>
                  <span className="goal-card-amount">{money(progress.saved)} <small>of {money(goal.target)}</small></span>
                  <span className="bar" role="progressbar" aria-label={`${goal.name} progress`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress.percent)}>
                    <span style={{ width: `${progress.percent}%`, background: ownerColor(data.space, goal.owner) }} />
                  </span>
                  <small>{progress.remaining > 0 ? `${money(progress.remaining)} to go` : 'Goal reached'}</small>
                </button>
              </li>
            )
          })}
        </ul>}
    </div>
  )
}
