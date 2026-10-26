import { useEffect, useRef } from 'react'
import type { GoalPlanResult } from '../../domain/evaluateGoalPlan'
import { evaluateConfirmedGoal, type ConfirmedGoal } from '../../domain/goal'
import type { CalendarDate } from '../../domain/goalTime'
import { formatDate, formatMoney as money } from '../../ui/format'
import { progressPercent, STATUS_LABELS } from './planStatus'

type Props = {
  goal: ConfirmedGoal
  today: CalendarDate
  onEdit: () => void
}

const projectionNotes: Record<GoalPlanResult['status'], string> = {
  funded: 'The amount you entered as saved meets the target. No monthly contributions are needed.',
  'invalid-target-date': 'The target date is today or has passed, and there is still an amount remaining. You can edit the goal if you want to change it.',
  'not-applicable': 'There are no complete months left before the target date, so a monthly plan no longer applies. You can edit the goal if you want to change it.',
  supported: 'Your confirmed monthly contribution is at least the calculated requirement.',
  'needs-adjustment': 'Your confirmed monthly contribution is below the calculated requirement. You can edit the goal if you want to change it.',
}

function Row({ label, value }: { label: string; value: string | number }) {
  return <div className="alt-row"><dt>{label}</dt><dd>{value}</dd></div>
}

/**
 * The confirmed goal, kept separate from today's projection. The projection
 * is recalculated from the confirmed values; it never changes the goal.
 */
export function GoalOverview({ goal, today, onEdit }: Props) {
  const headingRef = useRef<HTMLHeadingElement>(null)
  useEffect(() => { headingRef.current?.focus() }, [])
  const { details, input, confirmedOn } = goal
  const atConfirmation = evaluateConfirmedGoal(goal, input.today)
  const projection = evaluateConfirmedGoal(goal, today)
  const isMonthly = projection.status === 'supported' || projection.status === 'needs-adjustment'
  const ratio = progressPercent(input.targetAmount, projection.remainingAmount)

  return (
    <section className="panel overview-panel" aria-labelledby="overview-title">
      <div className="overview-head">
        <div>
          <span className="goal-type">Personal goal</span>
          <h2 id="overview-title" ref={headingRef} tabIndex={-1}>{details.name}</h2>
          {details.description && <p className="goal-description">{details.description}</p>}
          <p className="goal-meta">Confirmed on {formatDate(confirmedOn)}</p>
        </div>
        <button type="button" className="secondary-button" onClick={onEdit}>Edit goal</button>
      </div>
      <p className="temporary-note" role="note">Not saved: this prototype keeps your goal only while this page stays open. Refreshing or closing the page will remove it.</p>
      <div className="overview-grid">
        <section className="overview-section" aria-labelledby="confirmed-title">
          <h3 id="confirmed-title">What you confirmed</h3>
          <dl className="alt-rows">
            <Row label="Target amount" value={money(input.targetAmount)} />
            <Row label={`Already saved (entered ${formatDate(input.today)})`} value={money(input.alreadySaved)} />
            <Row label="Target date" value={formatDate(input.targetDate)} />
            <Row label="Your monthly contribution" value={atConfirmation.status === 'funded' ? 'Not needed, target already met' : money(input.comfortableContribution)} />
            <Row label="Planning state when confirmed" value={STATUS_LABELS[atConfirmation.status]} />
          </dl>
        </section>
        <section className="overview-section" aria-labelledby="projection-title">
          <h3 id="projection-title">Today’s projection</h3>
          <p className="projection-date">Calculated on {formatDate(today)} from the values you confirmed</p>
          <p className={`projection-state status-${projection.status}`}>{STATUS_LABELS[projection.status]}</p>
          <p className="result-description">{projectionNotes[projection.status]}</p>
          <dl className="alt-rows">
            <Row label="Remaining amount" value={money(projection.remainingAmount)} />
            <Row label="Days remaining" value={projection.status === 'funded' ? '—' : projection.daysRemaining} />
            <Row label="Monthly opportunities" value={'monthlyOpportunities' in projection ? projection.monthlyOpportunities : '—'} />
            <Row label="Required monthly contribution" value={isMonthly ? money(projection.requiredMonthlyContribution) : '—'} />
            {projection.status === 'needs-adjustment' && <Row label="Monthly shortfall" value={money(projection.monthlyShortfall)} />}
            {projection.status === 'supported' && <Row label="Monthly surplus" value={money(projection.monthlySurplus)} />}
          </dl>
          <div className="progress-head"><span>Goal progress</span><span>{ratio.toFixed(1)}%</span></div>
          <div className="progress-track" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={ratio} aria-label="Goal progress"><div style={{ width: `${ratio}%` }}/></div>
        </section>
      </div>
      <p className="disclaimer">The amount already saved is the one you entered on {formatDate(input.today)}. It has not been verified or updated automatically. No interest, inflation or fees are included.</p>
    </section>
  )
}
