import { Icon } from '../../components/Icon'
import { emergencyFund, goalSaved } from '../../domain/finance/goals'
import { formatAmount, formatDate } from '../../ui/format'
import { DataBlockFrame } from './DataBlockFrame'
import type { SectionProps } from './DataScreen'

/** The active goals and the Emergency Fund, the purposes of part of Savings; each opens the goal's own screen. */
export function GoalsSection({ data, onOpenGoal, onAddGoal, onReviewEmergency }: SectionProps) {
  const money = (minor: number) => formatAmount(minor, data.space.currency)
  const pots = data.goals.filter(goal => goal.status === 'active')
  const hasEmergency = emergencyFund(data.goals) !== null
  const goals = pots.filter(goal => goal.kind !== 'emergency').length
  const summary = [goals === 0 ? 'No goals yet' : `${goals} ${goals === 1 ? 'goal' : 'goals'}`, hasEmergency ? 'Emergency Fund' : 'No Emergency Fund yet'].join(' · ')

  return (
    <DataBlockFrame block="goals" summary={summary}
      actions={<button type="button" className="button-small" onClick={onAddGoal}><Icon name="plus" size={16} /> Add Goal</button>}>
      <p className="field-help">Goals and the Emergency Fund are purposes for part of your Savings. They are part of Savings, not extra money.</p>
      {pots.length === 0 ? (
        <div className="empty-state">
          <p className="muted-note">No goals yet. A goal gives part of your savings a purpose, such as a trip.</p>
          <button type="button" className="button-small align-start" onClick={onAddGoal}><Icon name="plus" size={16} /> Add Your First Goal</button>
        </div>
      ) : (
        <ul className="line-list compact-list">
          {pots.map(goal => (
            <li key={goal.id}>
              <button type="button" className="line line-button" onClick={() => onOpenGoal(goal.id)}>
                <span>
                  <span className="item-name">{goal.name}</span>
                  <small>{goal.kind === 'emergency' ? 'Emergency Fund' : goal.deadline ? `With Date · ${formatDate(goal.deadline)}` : 'Flexible'}</small>
                </span>
                <b>{money(goalSaved(goal, data.goalMovements))}{goal.target !== null && goal.target !== undefined && ` of ${money(goal.target)}`}</b>
                <Icon name="arrowRight" size={16} />
              </button>
            </li>
          ))}
        </ul>
      )}
      {!hasEmergency && (
        <button type="button" className="button-small align-start" onClick={onReviewEmergency}>Start an Emergency Fund</button>
      )}
    </DataBlockFrame>
  )
}
