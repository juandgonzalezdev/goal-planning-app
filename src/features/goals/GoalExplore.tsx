import { useId, useState } from 'react'
import { isCalendarDate } from '../../domain/calendar'
import type { CalendarDate } from '../../domain/goalTime'
import { tryDate, tryMonthlyAmount } from '../../domain/goalExplore'
import { updateGoal, type GoalProgress } from '../../domain/finance/goals'
import type { FinanceData, Goal } from '../../domain/finance/types'
import { formatAmount, formatDate, formatMonths, referenceDay } from '../../ui/format'
import { parseMoneyInput } from '../../ui/moneyInput'
import { isKept, outcomeText, type SaveOutcome } from '../../ui/saveOutcome'
import { useWriteBlocked, useWriteStatus } from '../../app/writeStatus'

type Props = {
  data: FinanceData; goal: Goal; progress: GoalProgress; today: CalendarDate
  /** The demo works from its own fixed date, so the text never calls it "today". */
  isDemo: boolean
  onChange: (data: FinanceData, base?: number) => Promise<SaveOutcome>
}

/**
 * Explore: try a monthly amount or a date and see what it would mean.
 * It only calculates; the goal changes only with Use This Date, after a
 * confirmation. No monthly amount is ever required or saved.
 */
export function GoalExplore({ data, goal, progress, today, isDemo, onChange }: Props) {
  const [open, setOpen] = useState(false)
  const [monthly, setMonthly] = useState('')
  const [date, setDate] = useState('')
  const [confirmDate, setConfirmDate] = useState(false)
  const [message, setMessage] = useState('')
  const panelId = useId()
  const { revision } = useWriteStatus()
  const blocked = useWriteBlocked()
  // The revision the date was confirmed on.
  const [base, setBase] = useState(revision)
  const [sending, setSending] = useState(false)
  const money = (minor: number) => formatAmount(minor, data.space.currency)
  const from = referenceDay(today, isDemo)
  if (!progress.hasTarget || progress.remaining <= 0) return null

  const perMonth = monthly.trim() === '' ? null : parseMoneyInput(monthly)
  const monthlyTry = perMonth === null ? null : tryMonthlyAmount(progress.remaining, perMonth, today, goal.deadline)
  const dateTry = isCalendarDate(date) ? tryDate(progress.remaining, date, today) : null

  const applyDate = async () => {
    const result = updateGoal(data, goal.id, { name: goal.name, owner: goal.owner, target: goal.target, deadline: date })
    if (result.status !== 'valid') return
    setSending(true)
    const outcome = await onChange(result.data, base).finally(() => setSending(false))
    setMessage(outcomeText(`The target date is now ${formatDate(date)}.`, outcome))
    if (!isKept(outcome)) return
    setConfirmDate(false)
    setDate('')
  }

  return (
    <section className="block" aria-labelledby={`${panelId}-title`}>
      <div className="section-head">
        <h2 id={`${panelId}-title`} className="section-title">Explore</h2>
        <button type="button" className="button-small" aria-expanded={open} aria-controls={panelId} onClick={() => setOpen(!open)}>{open ? 'Close' : 'Try an Amount or Date'}</button>
      </div>
      <p className="muted-note">{money(progress.remaining)} still to go. Try what a monthly amount or a date would mean. Nothing changes unless you choose it.</p>
      {open && (
        <div id={panelId} className="form-stack">
          <div className="form-field">
            <label htmlFor={`${panelId}-monthly`}>If I save each month ({data.space.currency})</label>
            <input id={`${panelId}-monthly`} inputMode="decimal" value={monthly} onChange={e => setMonthly(e.target.value)} />
          </div>
          {monthly.trim() !== '' && perMonth === null && <p className="field-error">Enter an amount such as 200 or 150.50.</p>}
          {monthlyTry && (
            <p className="explain" role="status">
              {monthlyTry.status === 'zero' && 'With nothing a month, the goal is not reached. Any amount helps, even a small one.'}
              {monthlyTry.status === 'too-long' && `That would take ${formatMonths(monthlyTry.months)}, more than 50 years.`}
              {monthlyTry.status === 'ok' && <>
                {formatMonths(monthlyTry.schedule.contributionCount)} of {money(monthlyTry.schedule.monthlyContribution)}
                {monthlyTry.schedule.finalContribution !== monthlyTry.schedule.monthlyContribution && ` (the last one ${money(monthlyTry.schedule.finalContribution)})`}
                {' '}would reach it around {formatDate(monthlyTry.reachedOn)}.
                {monthlyTry.byDeadline?.status === 'supported' && ` That is in time for ${formatDate(goal.deadline!)}.`}
                {monthlyTry.byDeadline?.status === 'needs-adjustment' && ` For ${formatDate(goal.deadline!)} it would need ${money(monthlyTry.byDeadline.requiredMonthlyContribution)} a month (${money(monthlyTry.byDeadline.monthlyShortfall)} more).`}
                {monthlyTry.byDeadline?.status === 'not-applicable' && ` The target date is less than a month away.`}
              </>}
            </p>
          )}
          <div className="form-field">
            <label htmlFor={`${panelId}-date`}>Or reach it by</label>
            <input id={`${panelId}-date`} type="date" min={today} value={date} onChange={e => { setDate(e.target.value); setConfirmDate(false) }} />
          </div>
          {dateTry && (
            <div className="explain" role="status">
              {dateTry.status === 'too-soon' && <p>Choose a date at least one month after {from}.</p>}
              {dateTry.status === 'ok' && <>
                <p>About {money(dateTry.perMonth)} a month for {formatMonths(dateTry.months)} (rounded up, so it always gets there).</p>
                {date !== goal.deadline && (confirmDate
                  ? <div className="inline-actions">
                    <span>Set {formatDate(date)} as the target date?</span>
                    <button type="button" className="button-small button-small-primary" aria-disabled={blocked || undefined} onClick={() => void applyDate()}>{sending ? 'Saving…' : 'Yes, Use This Date'}</button>
                    <button type="button" className="button-small" onClick={() => setConfirmDate(false)}>Cancel</button>
                  </div>
                  : <button type="button" className="button-small align-start" onClick={() => { setBase(revision); setConfirmDate(true) }}>Use This Date</button>)}
              </>}
            </div>
          )}
          <p className="field-help">An illustration only, worked out from {from}: the first contribution counts one month after it. It is not a commitment and nothing is paid automatically.</p>
        </div>
      )}
      <p className="muted-note" role="status">{message}</p>
    </section>
  )
}
