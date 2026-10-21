import { useEffect, useMemo, useRef, type ReactNode } from 'react'
import type { GoalPlanInput } from './domain/evaluateGoalPlan'
import {
  exploreAlternatives,
  type AlternativeKind,
  type ContributionSchedule,
  type ExtendDateAlternative,
  type IncreaseContributionAlternative,
} from './domain/exploreAlternatives'
import { formatDate, formatMoney, formatMonths } from './ui/format'

type Props = {
  /** The exact input of the evaluation on screen; never the live form fields. */
  input: GoalPlanInput
  /** False while the form differs from `input`, so an outdated alternative cannot be applied. */
  canApply: boolean
  /** The alternative awaiting confirmation, if any. */
  pending: AlternativeKind | null
  onSelect: (kind: AlternativeKind) => void
  onCancel: () => void
  onConfirm: (kind: AlternativeKind) => void
  onClose: () => void
}

function Row({ label, value, changed = false }: { label: string; value: ReactNode; changed?: boolean }) {
  return (
    <div className={changed ? 'alt-row changed' : 'alt-row'}>
      <dt>{label}</dt>
      <dd>{value}{changed && <span className="changed-tag">Changed</span>}</dd>
    </div>
  )
}

function scheduleSentence({ monthlyContribution, contributionCount, finalContribution }: ContributionSchedule, opportunities: number) {
  const reach = contributionCount < opportunities ? ` The remaining amount would be reached after ${formatMonths(contributionCount)} of ${opportunities}.` : ''
  if (finalContribution === monthlyContribution) {
    return `Hypothetical schedule: ${contributionCount} × ${formatMoney(monthlyContribution)}.${reach}`
  }
  const regular = contributionCount - 1
  return `Hypothetical schedule: ${regular} × ${formatMoney(monthlyContribution)}, then a final ${formatMoney(finalContribution)} in month ${contributionCount}.${reach}`
}

function ScheduleRows({ schedule }: { schedule: ContributionSchedule }) {
  return (
    <>
      <Row label="Contributions until target" value={schedule.contributionCount} />
      <Row label="Final contribution (estimated)" value={formatMoney(schedule.finalContribution)} />
    </>
  )
}

function ConfirmBox({ text, canApply, onConfirm, onCancel }: { text: string; canApply: boolean; onConfirm: () => void; onCancel: () => void }) {
  return (
    <div className="confirm-box" role="group" aria-label="Confirm change">
      <p>{text}</p>
      <div className="confirm-actions">
        <button type="button" className="confirm-button" disabled={!canApply} onClick={onConfirm}>Confirm change</button>
        <button type="button" className="secondary-button" onClick={onCancel}>Cancel</button>
      </div>
    </div>
  )
}

function CardActions({ kind, confirmText, ...props }: Pick<Props, 'canApply' | 'pending' | 'onSelect' | 'onCancel' | 'onConfirm'> & { kind: AlternativeKind; confirmText: string }) {
  if (props.pending === kind) {
    return <ConfirmBox text={confirmText} canApply={props.canApply} onConfirm={() => props.onConfirm(kind)} onCancel={props.onCancel} />
  }
  return <button type="button" className="secondary-button use-button" disabled={!props.canApply} onClick={() => props.onSelect(kind)}>Use this alternative</button>
}

function IncreaseCard({ input, alternative, ...props }: Omit<Props, 'onClose'> & { alternative: IncreaseContributionAlternative }) {
  const { result, schedule, proposedInput } = alternative
  return (
    <article className="alt-card" aria-labelledby="alt-increase-title">
      <div className="alt-tag">Keeps your target date</div>
      <h3 id="alt-increase-title">Increase monthly contribution</h3>
      <dl className="alt-rows">
        <Row label="Your monthly contribution" value={formatMoney(proposedInput.comfortableContribution)} changed />
        <Row label="Target date" value={formatDate(proposedInput.targetDate)} />
        <Row label="Monthly opportunities" value={result.monthlyOpportunities} />
        <Row label="Required monthly contribution" value={formatMoney(result.requiredMonthlyContribution)} />
        <Row label="Monthly surplus" value={formatMoney(result.monthlySurplus)} />
        <ScheduleRows schedule={schedule} />
      </dl>
      <p className="alt-note">Change: {formatMoney(alternative.monthlyIncrease)} more per month. This is the required monthly contribution for your original date.</p>
      <p className="alt-note">{scheduleSentence(schedule, result.monthlyOpportunities)}</p>
      <CardActions {...props} kind="increase-contribution" confirmText={
        `Change your comfortable monthly contribution from ${formatMoney(input.comfortableContribution)} to ${formatMoney(proposedInput.comfortableContribution)}? Your target date (${formatDate(input.targetDate)}) and other inputs stay the same. You can restore your previous plan afterwards.`
      } />
    </article>
  )
}

function ExtendCard({ input, alternative, ...props }: Omit<Props, 'onClose'> & { alternative: ExtendDateAlternative }) {
  if (alternative.status === 'unavailable') {
    return (
      <article className="alt-card unavailable" aria-labelledby="alt-extend-title">
        <div className="alt-tag">Keeps your monthly contribution</div>
        <h3 id="alt-extend-title">Extend target date</h3>
        <p className="alt-unavailable">
          {alternative.reason === 'zero-contribution'
            ? `A new target date can only be calculated for a monthly contribution above ${formatMoney(0)}.`
            : `At ${formatMoney(input.comfortableContribution)} per month, this plan would need ${formatMonths(alternative.monthsNeeded)}. The planner calculates timelines of up to ${formatMonths(alternative.planningHorizonMonths)} (50 years), so no date is shown for this alternative. This is a limit of the planner, not an assessment of your goal.`}
        </p>
      </article>
    )
  }
  const { result, schedule, proposedInput } = alternative
  return (
    <article className="alt-card" aria-labelledby="alt-extend-title">
      <div className="alt-tag">Keeps your monthly contribution</div>
      <h3 id="alt-extend-title">Extend target date</h3>
      <dl className="alt-rows">
        <Row label="Your monthly contribution" value={formatMoney(proposedInput.comfortableContribution)} />
        <Row label="Target date" value={formatDate(proposedInput.targetDate)} changed />
        <Row label="Monthly opportunities" value={result.monthlyOpportunities} changed />
        <Row label="Required monthly contribution" value={formatMoney(result.requiredMonthlyContribution)} />
        <Row label="Monthly surplus" value={formatMoney(result.monthlySurplus)} />
        <ScheduleRows schedule={schedule} />
      </dl>
      <p className="alt-note">Change: {formatMonths(alternative.additionalMonths)} later. This is the earliest date with enough whole months for your current contribution.</p>
      <p className="alt-note">{scheduleSentence(schedule, result.monthlyOpportunities)}</p>
      <CardActions {...props} kind="extend-date" confirmText={
        `Change your target date from ${formatDate(input.targetDate)} to ${formatDate(proposedInput.targetDate)}? Your monthly contribution (${formatMoney(input.comfortableContribution)}) and other inputs stay the same. You can restore your previous plan afterwards.`
      } />
    </article>
  )
}

/**
 * Side-by-side comparison of the evaluated plan and its two alternatives.
 * It only displays them; applying one is left to the parent after the user
 * confirms. Alternatives are not ranked.
 */
export function ExploreAlternatives({ onClose, ...props }: Props) {
  const alternatives = useMemo(() => exploreAlternatives(props.input), [props.input])
  const headingRef = useRef<HTMLHeadingElement>(null)
  useEffect(() => { headingRef.current?.focus() }, [])

  if (alternatives.status !== 'available') return null
  const { original, increaseContribution, extendDate } = alternatives
  const { input } = props

  return (
    <section className="panel alternatives-panel" aria-labelledby="alternatives-title">
      <div className="alternatives-head">
        <div>
          <div className="eyebrow">EXPLORE ALTERNATIVES</div>
          <h2 id="alternatives-title" ref={headingRef} tabIndex={-1}>Compare ways to adjust this plan</h2>
          <p className="section-subtitle">Each alternative changes one input and keeps the other. They are listed in no particular order, and neither is recommended over the other. Your current plan stays as it is unless you confirm a change.</p>
        </div>
        <button type="button" className="secondary-button" onClick={onClose}>Close alternatives</button>
      </div>
      {!props.canApply && <p className="stale-inline" role="status">Your inputs changed after this analysis. Select “Evaluate goal” before using an alternative.</p>}
      <div className="alt-grid">
        <article className="alt-card current" aria-labelledby="alt-current-title">
          <div className="alt-tag">As evaluated</div>
          <h3 id="alt-current-title">Your current plan</h3>
          <dl className="alt-rows">
            <Row label="Your monthly contribution" value={formatMoney(input.comfortableContribution)} />
            <Row label="Target date" value={formatDate(input.targetDate)} />
            <Row label="Monthly opportunities" value={original.monthlyOpportunities} />
            <Row label="Required monthly contribution" value={formatMoney(original.requiredMonthlyContribution)} />
            <Row label="Monthly shortfall" value={formatMoney(original.monthlyShortfall)} />
            <Row label="Contributions until target" value="Not within this timeline" />
            <Row label="Final contribution (estimated)" value="—" />
          </dl>
          <p className="alt-note">At {formatMoney(input.comfortableContribution)} per month, {formatMonths(original.monthlyOpportunities)} of contributions add up to {formatMoney(input.comfortableContribution * original.monthlyOpportunities)} of the {formatMoney(original.remainingAmount)} remaining.</p>
        </article>
        <IncreaseCard {...props} alternative={increaseContribution} />
        <ExtendCard {...props} alternative={extendDate} />
      </div>
      <div className="assumptions">
        <h3>Assumptions</h3>
        <ul>
          <li>Calculated from {formatDate(input.today)} using whole calendar months. A month that is not complete before the target date is not counted.</li>
          <li>The remaining amount stays {formatMoney(original.remainingAmount)}. Your target amount and the amount already saved do not change.</li>
          <li>Required contributions are rounded up to the next grosz, so a final contribution can be smaller than the others.</li>
          <li>No interest, inflation or fees are included.</li>
          <li>Schedules are hypothetical and only for comparison. Nothing is saved, committed or paid.</li>
        </ul>
      </div>
    </section>
  )
}
