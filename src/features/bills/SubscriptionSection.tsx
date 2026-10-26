import { useState } from 'react'
import type { CalendarDate } from '../../domain/goalTime'
import {
  applyCancel, applyPause, rateSubscription, setSubscriptionOptions, simulateSubscription, upcomingCharges, type Simulation, type SimulationKind,
} from '../../domain/finance/subscriptions'
import { SUBSCRIPTION_RATINGS, type FinanceData, type RecurringBill, type SubscriptionRating } from '../../domain/finance/types'
import { formatAmount, formatDate, formatYearMonth } from '../../ui/format'
import { outcomeText, type SaveOutcome } from '../../ui/saveOutcome'

type Props = { data: FinanceData; bill: RecurringBill; today: CalendarDate; onChange: (change: (data: FinanceData) => FinanceData) => SaveOutcome; onMessage: (text: string) => void }

const RATING_NAMES: Record<SubscriptionRating, string> = { needed: 'Needed', adjustable: 'Could adjust', optional: 'Optional' }
const KNOWN = [{ value: 'yes', label: 'Yes' }, { value: 'no', label: 'No' }, { value: 'unknown', label: 'Not sure' }] as const
const known = (value: boolean | null | undefined) => (value === true ? 'yes' : value === false ? 'no' : 'unknown')
const fromKnown = (value: string) => (value === 'yes' ? true : value === 'no' ? false : null)

/**
 * A subscription: the next charges, the user's own rating, whether it can
 * be paused or cancelled, and a what-if. A simulation changes nothing
 * until Confirm; then only future months change (payments already made
 * stay), and the money not spent is not added to Savings by itself.
 */
export function SubscriptionSection({ data, bill, today, onChange, onMessage }: Props) {
  const [simulation, setSimulation] = useState<Simulation | null>(null)
  const money = (minor: number) => formatAmount(minor, data.space.currency)
  const info = bill.subscription
  const next = upcomingCharges(data, bill, today, 3)
  const ended = bill.endMonth !== null && bill.endMonth < today.slice(0, 7)
  const periodName = bill.frequency === 'yearly' ? 'yearly' : 'monthly'

  const simulate = (kind: SimulationKind) => setSimulation(simulateSubscription(data, bill.id, kind, today, 3))
  const confirm = () => {
    if (!simulation) return
    const sim = simulation
    const outcome = onChange(current => (sim.kind === 'pause' ? applyPause(current, sim) : applyCancel(current, sim)))
    setSimulation(null)
    onMessage(outcomeText(sim.kind === 'pause'
      ? `${bill.name} is paused for ${sim.charges.map(c => formatYearMonth(c.month)).join(', ')}. Payments already made stay.`
      : `${bill.name} ends after ${sim.charges[0] ? formatYearMonth(sim.charges[0].month) : 'now'}: the last month due is the one before. Payments already made stay.`, outcome))
  }

  return (
    <section className="block" aria-labelledby="bill-subscription">
      <h2 id="bill-subscription" className="section-title">Subscription</h2>
      <dl className="fact-rows">
        <div><dt>Billing</dt><dd>{bill.frequency === 'yearly' ? 'Once a year' : 'Every month'}</dd></div>
        <div><dt>Next charges</dt><dd>{ended ? 'Ended' : next.length === 0 ? 'None in the next two years'
          : next.map(c => `${formatDate(c.dueDate)}${c.amount === null ? ' (amount not known)' : ` · ${money(c.amount)}`}`).join('; ')}</dd></div>
        {(bill.pausedMonths ?? []).length > 0 && <div><dt>Paused</dt><dd>{bill.pausedMonths!.map(formatYearMonth).join(', ')}</dd></div>}
      </dl>

      <fieldset className="choice-row">
        <legend>How do you see it?</legend>
        {SUBSCRIPTION_RATINGS.map(rating => (
          <label key={rating}>
            <input type="radio" name="sub-rating" checked={info?.rating === rating} onChange={() => onMessage(outcomeText('Saved.', onChange(current => rateSubscription(current, bill.id, rating))))} />
            {RATING_NAMES[rating]}
          </label>
        ))}
      </fieldset>
      <p className="field-help">Your own view. The app never decides what is worth it for you.</p>
      <div className="filter-grid">
        {(['canPause', 'canCancel'] as const).map(key => (
          <div key={key} className="form-field">
            <label htmlFor={`sub-${key}`}>{key === 'canPause' ? 'Can it be paused?' : 'Can it be cancelled?'}</label>
            <select id={`sub-${key}`} value={known(info?.[key])} onChange={e => onMessage(outcomeText('Saved.', onChange(current => setSubscriptionOptions(current, bill.id, { [key]: fromKnown(e.target.value) }))))}>
              {KNOWN.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </div>
        ))}
      </div>

      {!ended && !simulation && (
        <div className="inline-actions">
          <button type="button" className="button-small" onClick={() => simulate('pause')}>What If I Pause It?</button>
          <button type="button" className="button-small" onClick={() => simulate('cancel')}>What If I Cancel It?</button>
        </div>
      )}
      {simulation && (
        <div className="callout" role="status">
          <p><b>Simulation only. Nothing has changed.</b></p>
          {simulation.charges.length === 0
            ? <p>There are no upcoming charges to skip.</p>
            : <p>
              {simulation.kind === 'pause'
                ? `Pausing ${bill.name} for ${simulation.charges.length} ${periodName} ${simulation.charges.length === 1 ? 'period' : 'periods'} (${simulation.charges.map(c => formatYearMonth(c.month)).join(', ')})`
                : `Cancelling ${bill.name} from ${formatYearMonth(simulation.charges[0].month)}`}
              {' '}could reduce planned spending by {money(simulation.reduction)}{simulation.kind === 'cancel' ? (bill.frequency === 'yearly' ? ' over the next year' : ' over the next 12 months') : ''}.
            </p>}
          {simulation.unknownCount > 0 && <p>{simulation.unknownCount} {simulation.unknownCount === 1 ? 'charge has' : 'charges have'} no known amount and {simulation.unknownCount === 1 ? 'is' : 'are'} not counted.</p>}
          {simulation.kind === 'pause' && (simulation.restartFee === null
            ? <p>A restart fee is not known: check with the service. It would lower this amount.</p>
            : simulation.restartFee > 0 && <p>A restart fee of {money(simulation.restartFee)} is already taken off.</p>)}
          {simulation.allowed === false && <p>You noted that it {simulation.kind === 'pause' ? 'cannot be paused' : 'cannot be cancelled'}.</p>}
          {simulation.allowed === null && <p>Check first that the service lets you {simulation.kind === 'pause' ? 'pause' : 'cancel'} it.</p>}
          <p className="field-help">Payments already made never change. Money not spent is not added to Savings by itself: record it as savings if you set it aside.</p>
          <div className="inline-actions">
            {simulation.charges.length > 0 && simulation.allowed !== false && (
              <button type="button" className="button-small button-small-primary" onClick={confirm}>Confirm {simulation.kind === 'pause' ? 'Pause' : 'Cancellation'}</button>
            )}
            <button type="button" className="button-small" onClick={() => setSimulation(null)}>Cancel</button>
          </div>
        </div>
      )}
    </section>
  )
}
