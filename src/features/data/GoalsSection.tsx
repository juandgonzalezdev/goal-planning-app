import { Icon } from '../../components/Icon'
import { createEmergencyFund, emergencyFund, goalSaved } from '../../domain/finance/goals'
import { formatAmount, formatDate } from '../../ui/format'
import type { SectionProps } from './DataScreen'

/** The active goals and the Emergency Fund; each opens the goal's own screen. */
export function GoalsSection({ data, today, owner, newId, onChange, onOpenGoal, onAddGoal, say }: SectionProps) {
  const money = (minor: number) => formatAmount(minor, data.space.currency)
  const pots = data.goals.filter(goal => goal.status === 'active')
  const hasEmergency = emergencyFund(data.goals) !== null
  return (
    <section className="block" aria-labelledby="data-goals">
      <div className="section-head">
        <h2 id="data-goals" className="section-title">Goals &amp; Emergency Fund</h2>
        <button type="button" className="button-small" onClick={onAddGoal}><Icon name="plus" size={16} /> Add Goal</button>
      </div>
      {pots.length === 0 ? <p className="muted-note">No goals yet.</p> : (
        <ul className="line-list">
          {pots.map(goal => (
            <li key={goal.id}>
              <button type="button" className="line line-button" onClick={() => onOpenGoal(goal.id)}>
                <span>{goal.name}<small>{goal.kind === 'emergency' ? 'Emergency Fund' : goal.deadline ? `With Date · ${formatDate(goal.deadline)}` : 'Flexible'}</small></span>
                <b>{money(goalSaved(goal, data.goalMovements))}{goal.target !== null && ` of ${money(goal.target)}`}</b>
                <Icon name="arrowRight" size={16} />
              </button>
            </li>
          ))}
        </ul>
      )}
      {!hasEmergency && (
        <button type="button" className="button-small align-start" onClick={() => say('Emergency Fund added, starting at 0.', onChange(current => createEmergencyFund(current, newId(), owner, today)))}>
          Add Emergency Fund
        </button>
      )}
      <p className="field-help">Goals and the Emergency Fund are purposes for part of your Savings.</p>
    </section>
  )
}
