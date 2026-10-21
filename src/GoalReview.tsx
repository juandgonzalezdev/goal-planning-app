import { useEffect, useRef } from 'react'
import type { GoalPlanInput, GoalPlanResult } from './domain/evaluateGoalPlan'
import { getShortfallAtTargetDate, type ConfirmedGoal, type GoalDetails } from './domain/goal'
import { formatDate, formatMoney as money, formatMonths } from './ui/format'
import { STATUS_LABELS } from './ui/planStatus'

type Props = {
  /** The latest validated name and description. */
  details: GoalDetails
  /** The evaluation on screen when review was opened; never the live form fields. */
  input: GoalPlanInput
  result: GoalPlanResult
  /** The goal this confirmation would replace, when editing one. */
  replacing: ConfirmedGoal | null
  onBack: () => void
  onConfirm: () => void
}

function Row({ label, value }: { label: string; value: string | number }) {
  return <div className="alt-row"><dt>{label}</dt><dd>{value}</dd></div>
}

function Consequence({ input, result }: Pick<Props, 'input' | 'result'>) {
  if (result.status === 'funded') {
    return <p className="review-consequence positive">Your recorded savings of {money(input.alreadySaved)} already meet the target of {money(input.targetAmount)}. No monthly contributions are needed for this plan.</p>
  }
  if (result.status === 'supported') {
    return <p className="review-consequence positive">Your monthly contribution of {money(input.comfortableContribution)} covers the calculated requirement of {money(result.requiredMonthlyContribution)}, with {money(result.monthlySurplus)} to spare each month.</p>
  }
  if (result.status === 'needs-adjustment') {
    const { plannedTotal, uncoveredAmount } = getShortfallAtTargetDate(input, result)
    return (
      <div className="review-consequence warning">
        <p>Your monthly contribution of {money(input.comfortableContribution)} is <strong>{money(result.monthlyShortfall)} a month</strong> below the calculated requirement of {money(result.requiredMonthlyContribution)}.</p>
        <p>If you confirm this plan as it is, {formatMonths(result.monthlyOpportunities)} of contributions would add up to {money(plannedTotal)} by {formatDate(input.targetDate)}. That leaves {money(uncoveredAmount)} of the remaining amount uncovered, so the target would not be reached by that date unless the plan changes.</p>
        <p>You can go back to explore alternatives, or confirm the plan as it is.</p>
      </div>
    )
  }
  return null
}

/** Shows exactly what will be confirmed. Nothing becomes a goal until the user selects "Confirm goal". */
export function GoalReview({ details, input, result, replacing, onBack, onConfirm }: Props) {
  const headingRef = useRef<HTMLHeadingElement>(null)
  useEffect(() => { headingRef.current?.focus() }, [])
  const isMonthly = result.status === 'supported' || result.status === 'needs-adjustment'

  return (
    <section className="panel review-panel" aria-labelledby="review-title">
      <div className="eyebrow">REVIEW YOUR GOAL</div>
      <h2 id="review-title" ref={headingRef} tabIndex={-1}>Check your goal before confirming</h2>
      <p className="section-subtitle">These are the values from your last evaluation. Nothing changes unless you confirm.</p>
      <div className="goal-heading">
        <span className="goal-type">Personal goal</span>
        <h3>{details.name}</h3>
        {details.description && <p className="goal-description">{details.description}</p>}
      </div>
      <dl className="alt-rows">
        <Row label="Target amount" value={money(input.targetAmount)} />
        <Row label="Already saved (as you entered it)" value={money(input.alreadySaved)} />
        <Row label="Remaining amount" value={money(result.remainingAmount)} />
        <Row label="Target date" value={formatDate(input.targetDate)} />
        <Row label="Your monthly contribution" value={result.status === 'funded' ? 'Not needed, target already met' : money(input.comfortableContribution)} />
        {isMonthly && <Row label="Required monthly contribution" value={money(result.requiredMonthlyContribution)} />}
        <Row label="Planning state" value={STATUS_LABELS[result.status]} />
      </dl>
      <Consequence input={input} result={result} />
      <p className="disclaimer">Calculated on {formatDate(input.today)} from the amounts and date you entered. No interest, inflation or fees are included.</p>
      {replacing && <p className="review-replace" role="note">Confirming replaces the goal you confirmed on {formatDate(replacing.confirmedOn)}.</p>}
      <p className="temporary-note" role="note">This prototype keeps your goal only while this page stays open. Refreshing or closing the page will remove it.</p>
      <div className="confirm-actions review-actions">
        <button type="button" className="confirm-button" onClick={onConfirm}>Confirm goal</button>
        <button type="button" className="secondary-button" onClick={onBack}>Back to edit</button>
      </div>
    </section>
  )
}
