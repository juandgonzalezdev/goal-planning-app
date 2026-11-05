import { useEffect, useRef, useState } from 'react'
import { useUnsavedChanges } from '../../app/unsavedChanges'
import { VALIDITY_NAMES, validityOn } from '../../domain/finance/validity'
import type { CalendarDate } from '../../domain/goalTime'
import {
  applyCancel, applyPause, rateSubscription, setSubscriptionOptions, simulateSubscription, subscriptionPaymentConflicts, subscriptionPlan, upcomingCharges, type Simulation, type SimulationKind,
} from '../../domain/finance/subscriptions'
import { SUBSCRIPTION_RATINGS, type FinanceData, type RecurringBill, type SubscriptionRating } from '../../domain/finance/types'
import { formatAmount, formatDate, formatYearMonth } from '../../ui/format'
import { isKept, outcomeText, type ChangeSpace, type SaveOutcome } from '../../ui/saveOutcome'
import { useWriteBlocked, useWriteStatus } from '../../app/writeStatus'

type Props = { data: FinanceData; bill: RecurringBill; today: CalendarDate; onChange: ChangeSpace; onMessage: (text: string) => void }

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
  const preview = useRef<HTMLParagraphElement>(null)
  const action = useRef<HTMLButtonElement>(null)
  const pauseAction = useRef<HTMLButtonElement>(null)
  const status = useRef<HTMLParagraphElement>(null)
  const [simulation, setSimulation] = useState<Simulation | null>(null)
  useEffect(() => { if (simulation) preview.current?.focus() }, [simulation])
  const { revision } = useWriteStatus()
  const blocked = useWriteBlocked()
  // The revision the simulation was made on: confirming it later never writes over newer changes.
  const [base, setBase] = useState(revision)
  const [sending, setSending] = useState(false)
  // A simulation waiting for Confirm is a change not made yet.
  useUnsavedChanges(`Subscription: ${bill.name}`, simulation ? (simulation.kind === 'pause' ? { 'Simulation': 'Pause' } : { 'Action': 'End Subscription' }) : null, { empty: {} })
  const money = (minor: number) => formatAmount(minor, data.space.currency)
  const info = bill.subscription
  const next = upcomingCharges(data, bill, today, 3)
  const validity = validityOn(bill, today)
  const ended = validity === 'ended'
  const endedBeforeFirst = ended && bill.endMonth === bill.startMonth && bill.pausedMonths?.includes(bill.startMonth)
  const skipped = (bill.pausedMonths ?? []).filter(month => !(endedBeforeFirst && month === bill.startMonth))
  const periodName = bill.frequency === 'yearly' ? 'yearly' : 'monthly'
  const candidate = simulation ? subscriptionPlan(data, simulation) : null
  const paymentConflicts = simulation ? subscriptionPaymentConflicts(data, simulation) : []

  const simulate = (kind: SimulationKind) => { setBase(revision); setSimulation(simulateSubscription(data, bill.id, kind, today, 3)) }
  const save = async (done: string, change: (data: FinanceData) => FinanceData, from?: number): Promise<SaveOutcome> => {
    setSending(true)
    const outcome = await onChange(change, from).finally(() => setSending(false))
    onMessage(outcomeText(done, outcome))
    return outcome
  }
  // The simulation closes only once the change is kept; otherwise it stays, with the reason.
  const confirm = async () => {
    if (!simulation || blocked || sending || paymentConflicts.length > 0) return
    const sim = simulation
    const beforeFirst = sim.kind === 'cancel' && candidate?.endMonth === bill.startMonth && candidate.pausedMonths?.includes(bill.startMonth)
    const outcome = await save(sim.kind === 'pause'
      ? `${bill.name} is paused for ${sim.charges.map(c => formatYearMonth(c.month)).join(', ')}. Payments already made stay.`
      : `${bill.name} is ended in this app${beforeFirst ? ' before its first charge' : ''}. No charges are planned from ${sim.charges[0] ? formatYearMonth(sim.charges[0].month) : 'now'}. Payments already made stay.`,
    current => (sim.kind === 'pause' ? applyPause(current, sim) : applyCancel(current, sim)), base)
    if (isKept(outcome)) { setSimulation(null); requestAnimationFrame(() => status.current?.focus()) }
  }

  return (
    <section className="block" aria-labelledby="bill-subscription">
      <h2 id="bill-subscription" className="section-title">Manage Subscription</h2>
      <p ref={status} tabIndex={-1}><b>Status: {VALIDITY_NAMES[validity]}</b></p>
      <p className="field-help">Status as of {formatDate(today)}, whatever month you are viewing.</p>
      {!ended && next.length > 0 && !simulation && <button ref={action} type="button" className="button-small button-small-primary" onClick={() => simulate('cancel')}>End Subscription</button>}
      {ended && <p>{endedBeforeFirst ? 'Ended before its first charge. No charges are kept in the plan.' : 'No more future charges are planned.'} Recorded payments stay in History and reports.</p>}
      {validity === 'upcoming' && <p>Starts {formatYearMonth(bill.startMonth)}.</p>}
      {!ended && next.length === 0 && <p>No upcoming unpaid charges were found in the next two years.</p>}
      <dl className="fact-rows">
        <div><dt>Billing</dt><dd>{bill.frequency === 'yearly' ? 'Once a year' : 'Every month'}</dd></div>
        <div><dt>Next charges</dt><dd>{ended ? 'Ended' : next.length === 0 ? 'None in the next two years'
          : next.map(c => `${formatDate(c.dueDate)}${c.amount === null ? ' (amount not known)' : ` · ${money(c.amount)}`}`).join('; ')}</dd></div>
        {skipped.length > 0 && <div><dt>Skipped months</dt><dd>{skipped.map(formatYearMonth).join(', ')}</dd></div>}
      </dl>

      <details>
      <summary>Review Subscription</summary>
      <fieldset className="choice-row">
        <legend>How do you see it?</legend>
        {SUBSCRIPTION_RATINGS.map(rating => (
          <label key={rating}>
            <input type="radio" name="sub-rating" checked={info?.rating === rating} aria-disabled={blocked || undefined} onChange={() => void save('Saved.', current => rateSubscription(current, bill.id, rating))} />
            {RATING_NAMES[rating]}
          </label>
        ))}
      </fieldset>
      <p className="field-help">Your own view. The app never decides what is worth it for you.</p>
      <div className="filter-grid">
        {(['canPause', 'canCancel'] as const).map(key => (
          <div key={key} className="form-field">
            <label htmlFor={`sub-${key}`}>{key === 'canPause' ? 'Can it be paused?' : 'Can it be cancelled?'}</label>
            <select id={`sub-${key}`} value={known(info?.[key])} aria-disabled={blocked || undefined} onChange={e => { const value = fromKnown(e.target.value); void save('Saved.', current => setSubscriptionOptions(current, bill.id, { [key]: value })) }}>
              {KNOWN.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </div>
        ))}
      </div>

      {!ended && !simulation && (
        <div className="inline-actions">
          <button ref={pauseAction} type="button" className="button-small" onClick={() => simulate('pause')}>What If I Pause It?</button>
        </div>
      )}
      </details>
      {simulation && (
        <div className="callout" role="group" aria-label={simulation.kind === 'cancel' ? 'End Subscription confirmation' : 'Pause simulation'}>
          <p tabIndex={-1} ref={preview}><b>{simulation.kind === 'cancel' ? 'End this subscription?' : 'Simulation only.'} Nothing has changed.</b></p>
          {simulation.kind === 'cancel' && <p>Goal Planning App only ends planned charges here. It does not cancel the service with your provider. Contact the provider to cancel your service.</p>}
          {simulation.charges.length === 0
            ? <p>There are no upcoming charges to skip.</p>
            : <p>
              {simulation.kind === 'pause'
                ? `Pausing ${bill.name} for ${simulation.charges.length} ${periodName} ${simulation.charges.length === 1 ? 'period' : 'periods'} (${simulation.charges.map(c => formatYearMonth(c.month)).join(', ')})`
                : `Ending planned charges for ${bill.name} from ${formatYearMonth(simulation.charges[0].month)}`}
              {simulation.unknownCount === simulation.charges.length
                ? '. Savings cannot be estimated until an amount is known.'
                : <> could reduce planned spending by {money(simulation.reduction)} for {simulation.charges.length} planned {simulation.charges.length === 1 ? 'charge' : 'charges'}.</>}
            </p>}
          {simulation.kind === 'cancel' && simulation.charges[0] && <p>{candidate?.endMonth === bill.startMonth && candidate.pausedMonths?.includes(bill.startMonth)
            ? 'No charges will be kept in the plan.'
            : `Charges through ${formatYearMonth(candidate?.endMonth ?? bill.startMonth)} stay in the plan.`}</p>}
          {simulation.unknownCount > 0 && <p>{simulation.unknownCount} {simulation.unknownCount === 1 ? 'charge has' : 'charges have'} no known amount and {simulation.unknownCount === 1 ? 'is' : 'are'} not counted.</p>}
          {simulation.kind === 'pause' && (simulation.restartFee === null
            ? <p>A restart fee is not known: check with the service. It would lower this amount.</p>
            : simulation.restartFee > 0 && <p>A restart fee of {money(simulation.restartFee)} is already taken off.</p>)}
          {simulation.allowed === false && <p>You noted that it {simulation.kind === 'pause' ? 'cannot be paused' : 'cannot be cancelled'}. Change this in Review Subscription.</p>}
          {simulation.allowed === null && <p>Check first that the service lets you {simulation.kind === 'pause' ? 'pause' : 'cancel'} it.</p>}
          <p className="field-help">Payments already made never change. Money not spent is not added to Savings by itself: record it as savings if you set it aside.</p>
          {paymentConflicts.length > 0 && <p role="alert">{paymentConflicts.map(formatYearMonth).join(', ')} {paymentConflicts.length === 1 ? 'is' : 'are'} already paid. {simulation.kind === 'pause'
            ? 'These charges cannot be paused. Nothing has changed.'
            : `Nothing has changed. To keep every payment, open Edit Details and choose ${formatYearMonth(paymentConflicts[paymentConflicts.length - 1])} or later as the last month.`}</p>}
          <div className="inline-actions">
            {simulation.charges.length > 0 && simulation.allowed !== false && (
              <button type="button" className="button-small button-small-primary" aria-disabled={blocked || paymentConflicts.length > 0 || undefined} onClick={() => void confirm()}>{sending ? 'Saving…' : `Confirm ${simulation.kind === 'pause' ? 'Pause' : 'End Subscription'}`}</button>
            )}
            <button type="button" className="button-small" disabled={sending} onClick={() => { setSimulation(null); requestAnimationFrame(() => (simulation.kind === 'pause' ? pauseAction : action).current?.focus()) }}>{simulation.kind === 'cancel' ? 'Keep Subscription' : 'Cancel'}</button>
          </div>
        </div>
      )}
    </section>
  )
}
