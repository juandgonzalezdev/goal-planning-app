import { Icon } from '../../components/Icon'
import { ProgressBar } from '../../components/ProgressBar'
import type { CalendarDate } from '../../domain/goalTime'
import { emergencyCover } from '../../domain/finance/emergency'
import { summarizeGoals } from '../../domain/finance/goals'
import { activeGoalRows } from '../../domain/finance/home'
import { savingsSummary } from '../../domain/finance/savings'
import { ownerColor } from '../../domain/finance/space'
import type { FinanceData, Id } from '../../domain/finance/types'
import { formatDate } from '../../ui/format'
import { EyeToggle } from '../../ui/privacy'
import { useBlockAmounts } from '../../ui/amountVisibility'

type Props = {
  data: FinanceData
  title: string
  /** The end of the month shown (or today): goals and what they hold by then. */
  asOf: CalendarDate
  /** The user chose Maybe Later on the emergency fund suggestion. */
  emergencyLater: boolean
  onEmergencyLater: () => void
  onReviewEmergency: () => void
  onViewAll: () => void
  onAddGoal: () => void
  onOpenGoal: (id: Id) => void
}

/**
 * What am I saving for? One row per active goal with what it holds and,
 * when it has a target, what is still to go. What the goals hold is part
 * of Savings (see My Money), not extra money.
 *
 * Without an emergency fund, the first suggestion is to start one. It is
 * optional: Review My Emergency Fund only opens a draft, and nothing is
 * created or assigned until the user confirms it there.
 */
export function HomeGoals(props: Props) {
  const { data, title, asOf, onOpenGoal } = props
  // The goals as they were by `asOf`: nothing added later is shown for a past month.
  const past = { goals: data.goals.filter(goal => goal.createdOn <= asOf), goalMovements: data.goalMovements.filter(m => m.date <= asOf) }
  const rows = activeGoalRows(past, asOf)
  const summary = summarizeGoals(past)
  const savings = savingsSummary(data, asOf)
  const cover = emergencyCover({ ...data, ...past }, asOf)
  const hasFund = data.goals.some(goal => goal.kind === 'emergency' && goal.status === 'active')
  const { money, percent, hidden } = useBlockAmounts('goals', data.space.currency)

  return (
    <section className="block home-section" aria-labelledby="home-goals">
      <div className="section-head">
        <h2 id="home-goals" className="section-title">{title}</h2>
        <div className="inline-actions">
          <EyeToggle block="goals" />
          <button type="button" className="button-small button-small-primary" onClick={props.onAddGoal}><Icon name="plus" size={16} /> Add Goal</button>
          <button type="button" className="button-small" onClick={props.onViewAll}>View All <Icon name="arrowRight" size={16} /></button>
        </div>
      </div>

      {!hasFund && !props.emergencyLater && (
        <div className="suggestion-card" role="group" aria-labelledby="emergency-suggestion">
          <h3 id="emergency-suggestion" className="section-title">Start with an emergency fund</h3>
          <p>Money kept for an unexpected cost or a month with less income. It means you need to borrow less, and the savings for your other goals stay where they are.</p>
          <p className="field-help">Optional. Nothing is created until you confirm it.</p>
          <div className="inline-actions">
            <button type="button" className="button-small button-small-primary" onClick={props.onReviewEmergency}>Review My Emergency Fund</button>
            <button type="button" className="button-small" onClick={props.onEmergencyLater}>Maybe Later</button>
          </div>
        </div>
      )}

      {cover.fund && cover.fund.createdOn <= asOf && (
        <button type="button" className="goal-row" onClick={() => onOpenGoal(cover.fund!.id)}>
          <span>{cover.fund.name}<small className="goal-kind">
            {cover.months === null ? 'Cover not worked out yet' : `Covers about ${cover.months.toLocaleString('en-GB')} ${cover.months === 1 ? 'month' : 'months'} of essential costs`}
          </small></span>
          <span>{money(cover.saved)}</span>
          {cover.fund.target !== null && (
            <small className="goal-row-amounts">{cover.saved >= cover.fund.target ? 'Target reached' : `${money(cover.fund.target - cover.saved)} to the target of ${money(cover.fund.target)}`}</small>
          )}
        </button>
      )}
      {hasFund && (
        <button type="button" className="text-button align-start" onClick={props.onReviewEmergency}>Review My Emergency Fund</button>
      )}

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
                  <span>{goal.name}<small className="goal-kind">{goal.deadline ? `With Date · ${formatDate(goal.deadline)}` : progress.hasTarget ? 'Flexible' : 'No target'}</small></span>
                  <span>{progress.hasTarget ? percent(`${Math.round(progress.percent)}%`) : money(progress.saved)}</span>
                  {progress.hasTarget && (hidden
                    ? <div className="bar thin" aria-hidden="true"><div style={{ width: '100%', background: 'var(--color-track-strong)' }} /></div>
                    : <ProgressBar percent={progress.percent} color={ownerColor(data.space, goal.owner)} label={`${goal.name} progress`} />)}
                  <small className="goal-row-amounts">{progress.hasTarget
                    ? `${money(progress.saved)} of ${money(goal.target ?? 0)} · ${progress.remaining > 0 ? `${money(progress.remaining)} to go` : 'Goal reached'}`
                    : 'Saved so far, with no target set'}</small>
                </button>
              </li>
            ))}
          </ul>
        </>}
    </section>
  )
}
