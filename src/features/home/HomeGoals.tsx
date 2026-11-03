import { ProgressBar } from '../../components/ProgressBar'
import type { CalendarDate } from '../../domain/goalTime'
import { emergencyCover } from '../../domain/finance/emergency'
import { summarizeGoals } from '../../domain/finance/goals'
import { activeGoalRows } from '../../domain/finance/home'
import { savingsSummary } from '../../domain/finance/savings'
import { ownerColor } from '../../domain/finance/space'
import type { FinanceData, Id } from '../../domain/finance/types'
import { formatDate } from '../../ui/format'
import { useBlockAmounts } from '../../ui/amountVisibility'
import { HomeBlockFrame } from './HomeBlock'

type Props = {
  data: FinanceData
  /** The end of the month shown (or today): goals and what they hold by then. */
  asOf: CalendarDate
  /** The user chose Maybe Later on the emergency fund suggestion. */
  emergencyLater: boolean
  onEmergencyLater: () => void
  onReviewEmergency: () => void
  onOpenGoal: (id: Id) => void
}

/**
 * Goals, in Money & Goals on Home: what am I saving for? One row per active goal with what it holds and,
 * when it has a target, what is still to go. What the goals hold is part
 * of Savings (see Accounts & Savings), not extra money. Add Goal is in
 * + Add, and Goals opens from the area's heading.
 *
 * Without an emergency fund, the first suggestion is to start one. It is
 * optional: Review My Emergency Fund only opens a draft, and nothing is
 * created or assigned until the user confirms it there.
 */
export function HomeGoals(props: Props) {
  const { data, asOf, onOpenGoal } = props
  // The goals as they were by `asOf`: nothing added later is shown for a past month.
  const past = { goals: data.goals.filter(goal => goal.createdOn <= asOf), goalMovements: data.goalMovements.filter(m => m.date <= asOf) }
  const rows = activeGoalRows(past, asOf)
  const summary = summarizeGoals(past)
  const savings = savingsSummary(data, asOf)
  const cover = emergencyCover({ ...data, ...past }, asOf)
  const hasFund = data.goals.some(goal => goal.kind === 'emergency' && goal.status === 'active')
  const { money, percent, hidden } = useBlockAmounts('goals', data.space.currency)
  const showFund = cover.fund !== null && cover.fund.createdOn <= asOf
  const summaryText = [
    rows.length === 0 ? 'No goals yet' : `${money(summary.saved)} for ${summary.activeCount} ${summary.activeCount === 1 ? 'goal' : 'goals'}, part of Savings`,
    showFund ? `${cover.fund!.name} ${money(cover.saved)}` : null,
  ].filter(Boolean).join(' · ')

  return (
    <HomeBlockFrame block="goals" title="Goals" period={`Saved by ${formatDate(asOf)} · Target dates on each goal`} summary={summaryText}>

      {!hasFund && !props.emergencyLater && (
        <div className="suggestion-card" role="group" aria-labelledby="emergency-suggestion">
          <h4 id="emergency-suggestion" className="section-title">Start with an emergency fund</h4>
          <p>Money kept for an unexpected cost or a month with less income. It means you need to borrow less, and the savings for your other goals stay where they are.</p>
          <p className="field-help">Optional. Nothing is created until you confirm it.</p>
          <div className="inline-actions">
            <button type="button" className="button-small button-small-primary" data-return-key="emergency-review" onClick={props.onReviewEmergency}>Review My Emergency Fund</button>
            <button type="button" className="button-small" onClick={props.onEmergencyLater}>Maybe Later</button>
          </div>
        </div>
      )}

      {showFund && cover.fund && (
        <button type="button" className="goal-row" data-return-key={`goal-${cover.fund.id}`} onClick={() => onOpenGoal(cover.fund!.id)}>
          <span>{cover.fund.name}<small className="goal-kind">
            {hidden ? 'Cover hidden with the amounts' : cover.months === null ? 'Cover not worked out yet' : `Covers about ${cover.months.toLocaleString('en-GB')} ${cover.months === 1 ? 'month' : 'months'} of essential costs`}
          </small></span>
          <span>{money(cover.saved)}</span>
          {cover.fund.target !== null && !hidden && (
            <small className="goal-row-amounts">{cover.saved >= cover.fund.target ? 'Target reached' : `${money(cover.fund.target - cover.saved)} to the target of ${money(cover.fund.target)}`}</small>
          )}
        </button>
      )}
      {hasFund && (
        <button type="button" className="text-button align-start" data-return-key="emergency-review" onClick={props.onReviewEmergency}>Review My Emergency Fund</button>
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
                <button type="button" className="goal-row" data-return-key={`goal-${goal.id}`} onClick={() => onOpenGoal(goal.id)}>
                  <span>{goal.name}<small className="goal-kind">{goal.deadline ? `With Date · ${formatDate(goal.deadline)}` : progress.hasTarget ? 'Flexible' : 'No target'}</small></span>
                  <span>{progress.hasTarget ? percent(`${Math.round(progress.percent)}%`) : money(progress.saved)}</span>
                  {progress.hasTarget && !hidden && <ProgressBar percent={progress.percent} color={ownerColor(data.space, goal.owner)} label={`${goal.name} progress`} />}
                  <small className="goal-row-amounts">{progress.hasTarget
                    ? `${money(progress.saved)} of ${money(goal.target ?? 0)}${hidden ? '' : ` · ${progress.remaining > 0 ? `${money(progress.remaining)} to go` : 'Goal reached'}`}`
                    : 'Saved so far, with no target set'}</small>
                </button>
              </li>
            ))}
          </ul>
        </>}
    </HomeBlockFrame>
  )
}
