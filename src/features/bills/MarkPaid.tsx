import { BillCelebrationContext } from '../../app/writeStatus'
import { completesBillMonth } from '../home/bullseye'
import { useContext, useState } from 'react'
import { useUnsavedChanges } from '../../app/unsavedChanges'
import { useWriteBlocked, useWriteStatus } from '../../app/writeStatus'
import { Field } from '../../components/Field'
import { isBillDueIn, markBillPaid, validatePayment, type BillOccurrence, type PaymentError } from '../../domain/finance/bills'
import type { FinanceData } from '../../domain/finance/types'
import type { CalendarDate } from '../../domain/goalTime'
import { formatAmount, formatDate, formatYearMonth } from '../../ui/format'
import { suggestedPaidOn } from './payment'
import { amountText } from '../../ui/labels'
import { parseMoneyInput } from '../../ui/moneyInput'
import { isKept, outcomeText, type ChangeSpace } from '../../ui/saveOutcome'

const NOT_SURE = 'not-sure'

const ERRORS: Record<PaymentError, string> = {
  'not-due': 'This bill is not due in this month any more. Close the form and check it.',
  'invalid-amount': 'Enter the amount paid, such as 120.45.',
  'invalid-date': 'Choose the date it was paid.',
  'date-after-today': 'Choose a date that is not after today.',
  'unknown-account': 'That account is no longer here. Choose another, or Not sure.',
  'interest-not-loan': 'Interest is only for a loan.',
  'invalid-interest': 'Enter the interest from your statement, such as 18.40, or leave it empty.',
  'interest-above-amount': 'The interest can’t be more than the amount paid.',
}

type Props = {
  data: FinanceData
  occurrence: BillOccurrence
  today: CalendarDate
  /** The amounts are hidden where the form opens: a known amount is kept without showing it. */
  hidden?: boolean
  onChange: ChangeSpace
  /**
   * After the payment is kept, with the message to show ("… Saved on this device."). `completion` is a separate
   * notice ("All bills for … are paid.") when this payment completed the month for the first time and Home's
   * rings did not play the pulse; it is never joined to the payment message.
   */
  onSaved: (message: string, completion?: string) => void
  onCancel: () => void
  /** Where the form belongs, so the app knows which form a change of view would close. */
  tag?: string
  /**
   * `mark` (Bills, Left to Pay): Mark as Paid, dated on the due date once it has passed.
   * `review` (Ring-first Home): Review payment, dated today, with the expected amount and due date first.
   * Both save the same payment with the same rules.
   */
  variant?: 'mark' | 'review'
}

/**
 * Mark as Paid (M1): always a short form, the same on Home, in the Bills
 * list and on the bill. It records the month's amount, the date, the account
 * (or Not sure) and, for a loan, the interest from the statement, as one
 * change. It never changes a Remaining Balance and never guesses interest.
 */
export function MarkPaidForm({ data, occurrence, today, hidden = false, onChange, onSaved, onCancel, tag, variant = 'mark' }: Props) {
  const review = variant === 'review'
  const celebration = useContext(BillCelebrationContext)
  const { bill, month } = occurrence
  const monthLabel = formatYearMonth(month)
  const debt = bill.debtId ? data.debts.find(item => item.id === bill.debtId) ?? null : null
  const isLoan = debt?.kind === 'loan'
  const accounts = data.moneyAccounts
  const daily = accounts.filter(account => account.kind === 'daily-spending')
  // One Daily Spending account comes chosen; with none at all, Not sure is the only choice.
  const firstAccount = daily.length === 1 ? daily[0].id : accounts.length === 0 ? NOT_SURE : ''
  const keepHidden = hidden && occurrence.amount !== null
  const [form, setForm] = useState({ amount: keepHidden ? '' : amountText(occurrence.amount), paidOn: review ? today : suggestedPaidOn(occurrence, today), paidFrom: firstAccount, interest: '' })
  const [errors, setErrors] = useState<Partial<Record<'amount' | 'paidOn' | 'paidFrom' | 'interest' | 'form', string>>>({})
  const [refusal, setRefusal] = useState('')
  const [sending, setSending] = useState(false)
  const { revision } = useWriteStatus()
  const blocked = useWriteBlocked()
  const [base] = useState(revision)
  const prefix = `pay-${bill.id}-${month}`
  useUnsavedChanges(`Mark as paid: ${bill.name}, ${monthLabel}`, {
    'Amount': keepHidden ? '(hidden)' : form.amount, 'Paid on': form.paidOn, 'Paid from': form.paidFrom, ...(isLoan ? { 'Interest': form.interest } : {}),
  }, { tag, month })
  const change = (field: keyof typeof form) => (value: string) => { setForm({ ...form, [field]: value }); setErrors({}); setRefusal('') }

  const save = async () => {
    const amount = keepHidden ? occurrence.amount : parseMoneyInput(form.amount)
    const interest = !isLoan || form.interest.trim() === '' ? null : parseMoneyInput(form.interest)
    const found: typeof errors = {}
    if (amount === null) found.amount = occurrence.amount === null && form.amount.trim() === '' ? `Enter the amount paid in ${monthLabel}: it isn’t known yet.` : ERRORS['invalid-amount']
    if (form.paidFrom === '') found.paidFrom = 'Choose the account it was paid from, or Not sure.'
    if (isLoan && form.interest.trim() !== '' && interest === null) found.interest = ERRORS['invalid-interest']
    if (Object.keys(found).length === 0 && amount !== null) {
      const fields = { amount, paidOn: form.paidOn, paidFrom: form.paidFrom === NOT_SURE ? null : form.paidFrom, interest }
      for (const error of validatePayment(data, bill.id, month, fields, today)) {
        const field = error === 'invalid-amount' ? 'amount' : error === 'invalid-date' || error === 'date-after-today' ? 'paidOn'
          : error === 'unknown-account' ? 'paidFrom' : error === 'not-due' ? 'form' : 'interest'
        found[field] ??= ERRORS[error]
      }
      if (Object.keys(found).length === 0) {
        setSending(true)
        let completed = false
        const outcome = await onChange(current => {
          const next = markBillPaid(current, bill.id, month, fields, today)
          completed = completesBillMonth(current, next, month)
          return next
        }, base).finally(() => setSending(false))
        if (isKept(outcome)) {
          // Only after the payment is kept: the month is claimed once on this device, and Home plays the pulse if it is showing.
          const celebrated = completed ? celebration.publish({ month, spaceId: data.space.id }) : { claimed: false, shown: false }
          onSaved(outcomeText(`${bill.name} marked as paid for ${monthLabel}.`, outcome),
            celebrated.claimed && !celebrated.shown ? `All bills for ${monthLabel} are paid.` : undefined)
        }
        else setRefusal(outcomeText('', outcome))
        return
      }
    }
    setErrors(found)
  }

  return (
    <div className={`form-stack edit-box mark-paid${review ? ' is-review' : ''}`} role="group" aria-label={`${review ? 'Review payment' : 'Mark as paid'}: ${bill.name}, ${monthLabel}`}>
      {review
        ? <>
          <p className="mark-paid-title"><b>Review payment</b> <small>{bill.name} · {monthLabel}</small></p>
          <dl className="review-facts">
            <div><dt>Expected</dt><dd>{keepHidden ? 'Hidden' : occurrence.amount === null ? 'Not known yet' : formatAmount(occurrence.amount, data.space.currency)}</dd></div>
            <div><dt>Due</dt><dd>{formatDate(occurrence.dueDate)}</dd></div>
            {debt && <div><dt>Linked to</dt><dd>{debt.name}</dd></div>}
          </dl>
        </>
        : <p className="mark-paid-title"><b>Mark as Paid</b> <small>{bill.name} · {monthLabel} · due {formatDate(occurrence.dueDate)}</small></p>}
      {keepHidden
        ? <p className="muted-note">{review ? <>Amount: hidden with the amounts. The expected amount for {monthLabel} is kept. Show the amounts to check or change it.</> : <>Amount: hidden with the amounts. The amount for {monthLabel} is kept. Show the amounts to change it.</>}</p>
        : <Field id={`${prefix}-amount`} label={review ? `Amount paid (${data.space.currency})` : `Amount (${data.space.currency})`} inputMode="decimal" value={form.amount} onChange={change('amount')} error={errors.amount}
          help={`If you change it, only ${monthLabel} changes.`} />}
      <Field id={`${prefix}-date`} label="Paid on" type="date" max={today} value={form.paidOn} onChange={change('paidOn')} error={errors.paidOn} help="Can’t be after today." />
      <div className="form-field">
        <label htmlFor={`${prefix}-account`}>Paid from</label>
        <select id={`${prefix}-account`} value={form.paidFrom} aria-invalid={!!errors.paidFrom} aria-describedby={`${prefix}-account-help`} onChange={event => change('paidFrom')(event.target.value)}>
          {form.paidFrom === '' && <option value="">Choose an account</option>}
          {accounts.map(account => <option key={account.id} value={account.id}>{account.name}</option>)}
          <option value={NOT_SURE}>Not sure</option>
        </select>
        <p id={`${prefix}-account-help`} className="field-help">
          {form.paidFrom === NOT_SURE ? 'Without an account, this payment won’t match your account balances.' : 'Cards aren’t accounts: a bill paid by card is paid from the account that pays the card.'}
          {accounts.length === 0 && ' Add an account in Money to choose it here.'}
        </p>
        {errors.paidFrom && <p className="field-error">{errors.paidFrom}</p>}
      </div>
      {isLoan && <Field id={`${prefix}-interest`} label={`Interest in this payment (optional, ${data.space.currency})`} inputMode="decimal" value={form.interest} onChange={change('interest')}
        error={errors.interest} help="From your statement. Without it, interest isn’t counted in Spent, and the app doesn’t guess it." />}
      {debt && <p className="field-help">Paying doesn’t change the Remaining Balance. Update it from your statement.{review ? ' This payment is counted once, in Bills.' : ''}</p>}
      {errors.form && <p className="field-error" role="alert">{errors.form}</p>}
      {refusal && <p className="field-error" role="alert">{refusal}</p>}
      <div className="inline-actions">
        <button type="button" className="button-small button-small-primary" aria-disabled={blocked || undefined} onClick={() => { if (!blocked && !sending) void save() }}>{sending ? 'Saving…' : review ? 'Confirm Payment' : 'Save as Paid'}</button>
        <button type="button" className="button-small" onClick={onCancel}>Cancel</button>
      </div>
    </div>
  )
}

/** Mark as Not Paid asks first: it removes the date, the account and the interest of that month. */
export function ConfirmNotPaid({ occurrence, sending, onConfirm, onCancel }: { occurrence: BillOccurrence; sending: boolean; onConfirm: () => void; onCancel: () => void }) {
  const monthLabel = formatYearMonth(occurrence.month)
  if (!isBillDueIn(occurrence.bill, occurrence.month)) return (
    <div className="callout callout-warning" role="group" aria-label="Payment kept">
      {occurrence.bill.pausedMonths?.includes(occurrence.month)
        ? <p>{monthLabel} is a skipped month for this bill, so it can't be marked as not paid. The payment stays in History and reports.</p>
        : <p>{monthLabel} is outside this bill's scheduled months, so it can't be marked as not paid. The payment stays in History and reports. To change it, first include {monthLabel} in the bill's dates in Edit Details.</p>}
      <button type="button" className="button-small" onClick={onCancel}>Keep as Paid</button>
    </div>
  )
  return (
    <div className="callout callout-warning" role="group" aria-label="Mark as not paid?">
      <p><b>Mark {occurrence.bill.name} as not paid for {monthLabel}?</b></p>
      <p>The date, the account and the interest saved for {monthLabel} are removed. The amount stays.</p>
      <div className="inline-actions">
        <button type="button" className="button-small button-small-primary" onClick={onConfirm}>{sending ? 'Saving…' : 'Mark as Not Paid'}</button>
        <button type="button" className="button-small" onClick={onCancel}>Keep as Paid</button>
      </div>
    </div>
  )
}
