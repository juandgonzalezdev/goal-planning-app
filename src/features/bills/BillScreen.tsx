import { useEffect, useRef, useState } from 'react'
import { useLeaveGuard, useUnsavedChanges } from '../../app/unsavedChanges'
import { Field } from '../../components/Field'
import { amountText } from '../../ui/labels'
import { Icon } from '../../components/Icon'
import { MonthSwitch } from '../../components/MonthSwitch'
import { yearsAround, type YearMonth } from '../../domain/calendar'
import { MonthYearField } from '../../components/MonthYearField'
import { BillForm } from './BillForm'
import { billsForMonth, deleteBill, isBillDueIn, markBillNotPaid, setBillMonthAmount, setUsualAmountFrom, usualAmountFor } from '../../domain/finance/bills'
import { ConfirmNotPaid, MarkPaidForm } from './MarkPaid'
import { paidText } from './payment'
import type { FinanceData, Id, Owner } from '../../domain/finance/types'
import type { CalendarDate } from '../../domain/goalTime'
import { formatAmount, formatDate, formatDueDay, formatYearMonth } from '../../ui/format'
import { parseMoneyInput } from '../../ui/moneyInput'
import { isKept, outcomeText, type ChangeSpace, type SaveOutcome } from '../../ui/saveOutcome'
import { useWriteBlocked, useWriteStatus } from '../../app/writeStatus'
import { validityOn } from '../../domain/finance/validity'
import { SubscriptionSection } from './SubscriptionSection'

type Props = {
  data: FinanceData
  /** null: adding a new bill. */
  billId: Id | null
  /** One-time request to open the existing bill's editor. */
  initiallyEditing?: boolean
  onInitialEditingConsumed?: () => void
  /** Adding a bill from a day of the calendar: its due day starts on that day. */
  dueDate?: CalendarDate | null
  months: YearMonth[]
  month: YearMonth
  onMonthChange: (month: YearMonth) => void
  today: CalendarDate
  owner: Owner
  newId: () => string
  onBack: () => void
  /** Cancel on a new bill: leaves without asking, because Cancel is the user's choice to drop what was typed. */
  onCancel?: () => void
  onChange: ChangeSpace
  onCreated: (id: Id, message: string) => void
  onDeleted: () => void
  onOpenDebt: (id: Id) => void
}

/**
 * One bill: this month's amount and paid status, its usual amount (with an
 * explicit "from this month on" change), and its details. A quick change on
 * Home only touches one month; the usual amount changes only here.
 */
export function BillScreen(props: Props) {
  const { data, billId, month, today, onBack, onChange } = props
  const bill = billId ? data.bills.find(b => b.id === billId) ?? null : null
  const currency = data.space.currency
  const money = (minor: number) => formatAmount(minor, currency)
  const [editing, setEditing] = useState(billId === null || !!props.initiallyEditing)
  const { initiallyEditing, onInitialEditingConsumed } = props
  useEffect(() => {
    if (initiallyEditing) onInitialEditingConsumed?.()
  }, [initiallyEditing, onInitialEditingConsumed])
  const editButton = useRef<HTMLButtonElement>(null)
  const wasEditing = useRef(editing)
  useEffect(() => {
    if (wasEditing.current && !editing) editButton.current?.focus()
    if (editing) document.getElementById('bill-name')?.focus()
    wasEditing.current = editing
  }, [editing])
  // The amount being typed for one month; another month shows its own amount, not this draft.
  const [monthDraft, setMonthDraft] = useState<{ month: YearMonth; text: string } | null>(null)
  const monthText = monthDraft?.month === month ? monthDraft.text : null
  const setMonthText = (text: string | null) => setMonthDraft(text === null ? null : { month, text })
  const [usual, setUsual] = useState<{ amount: string; from: string; error?: string } | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  // Mark as Paid (its form) or Mark as Not Paid (its question), for the month they were opened on.
  const [paying, setPaying] = useState<{ month: YearMonth; step: 'form' | 'not-paid' } | null>(null)
  const payStep = paying?.month === month ? paying.step : null
  // After the form or the question closes, the keyboard goes back to the button that opened it.
  const [payReturn, setPayReturn] = useState(false)
  const closePaying = () => { setPaying(null); setPayReturn(true) }
  const [message, setMessage] = useState('')
  const { revision } = useWriteStatus()
  const blocked = useWriteBlocked()
  // Which change is being saved ("Saving…"), and the revision each editor was opened on.
  const [sending, setSending] = useState<'month' | 'usual' | 'paid' | 'delete' | null>(null)
  const [monthBase, setMonthBase] = useState(revision)
  const [usualBase, setUsualBase] = useState(revision)
  const [deleteBase, setDeleteBase] = useState(revision)
  const amountForm = useUnsavedChanges(`Amount for one month: ${bill?.name ?? ''}`, monthText === null ? null : { 'Month': monthDraft?.month, 'Amount': monthText }, { month: monthDraft?.month })
  const guard = useLeaveGuard()
  const paymentTag = `bill-payment:${billId}`
  // The amount typed for one month belongs to that month: after another month is chosen (the app asks first), it is gone.
  if (monthDraft && monthDraft.month !== month) setMonthDraft(null)
  const [messageMonth, setMessageMonth] = useState(month)
  if (messageMonth !== month) { setMessageMonth(month); setMessage('') }
  useUnsavedChanges(`New usual amount: ${bill?.name ?? ''}`, usual ? { 'Amount': usual.amount, 'From month': usual.from } : null)
  /** Saves one change and says what happened; an editor closes only when the change is kept. */
  const save = async (what: NonNullable<typeof sending>, done: string, change: (data: FinanceData) => FinanceData, base?: number): Promise<SaveOutcome> => {
    setSending(what)
    const outcome = await onChange(change, base).finally(() => setSending(null))
    setMessage(outcomeText(done, outcome))
    return outcome
  }

  if (billId && !bill) {
    return (
      <div className="tab-screen">
        <button type="button" className="back-link" onClick={onBack}><Icon name="arrowLeft" size={18} /> Back</button>
        <div className="empty-block"><p>This bill is no longer here. It may have been deleted in another tab.</p></div>
      </div>
    )
  }

  const occurrence = bill ? billsForMonth(data, month).find(o => o.bill.id === bill.id) ?? null : null
  if (editing || !bill) {
    return (
      <div className="tab-screen">
        <button type="button" className="back-link" onClick={() => (bill ? setEditing(false) : onBack())}><Icon name="arrowLeft" size={18} /> {bill ? 'Cancel' : 'Back'}</button>
        <h1 className="tab-title">{bill ? `Edit ${bill.name}` : 'Add Bill'}</h1>
        <BillForm data={data} bill={bill} month={month} dueDay={props.dueDate ? Number(props.dueDate.slice(8)) : undefined} today={today} owner={props.owner} newId={props.newId} onChange={onChange}
          onCancel={() => (bill ? setEditing(false) : (props.onCancel ?? onBack)())} onCreated={props.onCreated}
          onSaved={done => { setEditing(false); setMessage(done) }} />
      </div>
    )
  }

  const usualNow = usualAmountFor(bill, month)
  const debt = bill.debtId ? data.debts.find(d => d.id === bill.debtId) ?? null : null
  const monthLabel = formatYearMonth(month)
  const record = data.billMonths.find(item => item.billId === bill.id && item.month === month)
  const endedBeforeFirst = bill.category === 'Subscriptions' && bill.endMonth === bill.startMonth && bill.pausedMonths?.includes(bill.startMonth) && validityOn(bill, today) === 'ended'
  const skipped = (bill.pausedMonths ?? []).filter(m => !(endedBeforeFirst && m === bill.startMonth))
  const paymentCount = data.billMonths.filter(r => r.billId === bill.id && r.paid).length

  const saveMonthAmount = async (value: number | null | undefined, done: string) => {
    const outcome = await save('month', done, current => setBillMonthAmount(current, bill.id, month, value), monthBase)
    if (isKept(outcome)) setMonthText(null)
  }
  const saveUsual = async () => {
    if (!usual) return
    const amount = usual.amount.trim() === '' ? null : parseMoneyInput(usual.amount)
    if (usual.amount.trim() !== '' && amount === null) { setUsual({ ...usual, error: 'Enter an amount such as 750, or leave it empty for unknown.' }); return }
    if (!/^\d{4}-\d{2}$/.test(usual.from) || usual.from < bill.startMonth) { setUsual({ ...usual, error: `Choose ${formatYearMonth(bill.startMonth)} or later.` }); return }
    const from = usual.from
    const outcome = await save('usual', `Usual amount changed from ${formatYearMonth(from)} on.`, current => setUsualAmountFrom(current, bill.id, from, amount), usualBase)
    if (isKept(outcome)) setUsual(null)
  }

  return (
    <div className="tab-screen">
      <button type="button" className="back-link" onClick={onBack}><Icon name="arrowLeft" size={18} /> Back</button>
      <div className="screen-top bill-details-header">
        <div><h1 className="tab-title">{bill.name}</h1>
        <p className="muted-note">{bill.category} · Due {formatDueDay(bill.dueDay).toLowerCase()}</p></div>
        <button ref={editButton} type="button" className="button-small button-small-primary" onClick={() => guard(() => true, () => { setMonthText(null); setUsual(null); setPaying(null); setEditing(true); setMessage('') })}>Edit Details</button>
      </div>
      {bill.category === 'Subscriptions' && <SubscriptionSection data={data} bill={bill} today={today} onChange={onChange} onMessage={setMessage} />}
      <MonthSwitch months={props.months} value={month} onChange={props.onMonthChange} />
      <p className="muted-note" role="status">{message}</p>

      <section className="block" aria-labelledby="bill-month">
        <h2 id="bill-month" className="section-title">{monthLabel}</h2>
        {occurrence?.paid && !isBillDueIn(bill, month) && <p className="field-help">This bill isn't planned for {monthLabel}, but this payment was recorded. It still counts in History and reports.</p>}
        {!occurrence
          ? <p className="muted-note">This bill is not due in {monthLabel}.</p>
          : <>
            <div className="bill-line">
              <span>{occurrence.amountChangedThisMonth ? `Amount for ${monthLabel} only` : 'Amount'}</span>
              <b>{occurrence.amount === null ? 'Unknown' : money(occurrence.amount)}</b>
            </div>
            <div className="bill-line">
              <small>{occurrence.paid ? paidText(data, record) : `Due ${formatDate(occurrence.dueDate)}`}</small>
              <b className={`paid-state${occurrence.paid ? ' is-paid' : ''}`}>{occurrence.paid ? '✓ Paid' : '○ Pending'}</b>
            </div>
            {record?.interest !== undefined && occurrence.paid && <p className="muted-note">Interest in this payment: {money(record.interest)}</p>}
            {payStep === null && (
              <button type="button" className="button-small align-start" autoFocus={payReturn} aria-label={`${occurrence.paid ? 'Mark as Not Paid' : 'Mark as Paid'}: ${bill.name}, ${monthLabel}`}
                onClick={() => guard(form => form.id === amountForm.id, () => { setMonthText(null); setMessage(''); setPayReturn(false); setPaying({ month, step: occurrence.paid ? 'not-paid' : 'form' }) })}>
                {occurrence.paid ? 'Mark as Not Paid' : 'Mark as Paid'}
              </button>
            )}
            {payStep === 'form' && !occurrence.paid && (
              <MarkPaidForm data={data} occurrence={occurrence} today={today} onChange={onChange} tag={paymentTag}
                onSaved={done => { closePaying(); setMessage(done) }} onCancel={closePaying} />
            )}
            {payStep === 'not-paid' && occurrence.paid && (
              <ConfirmNotPaid occurrence={occurrence} sending={sending === 'paid'} onCancel={closePaying} onConfirm={() => {
                if (blocked || sending) return
                void save('paid', `${bill.name} marked as not paid for ${monthLabel}.`, current => markBillNotPaid(current, bill.id, month)).then(outcome => { if (isKept(outcome)) closePaying() })
              }} />
            )}
            {monthText === null
              ? <button type="button" className="text-button" onClick={() => guard(form => form.tag === paymentTag, () => { setPaying(null); setPayReturn(false); setMonthBase(revision); setMonthText(amountText(occurrence.amount)) })}>Change Amount for {monthLabel}</button>
              : <div className="amount-editor">
                <Field id="bill-month-amount" label={`Amount for ${monthLabel} (${currency})`} inputMode="decimal" value={monthText} onChange={setMonthText} />
                <div className="inline-actions">
                  <button type="button" className="button-small button-small-primary" aria-disabled={blocked || undefined} onClick={() => { const v = parseMoneyInput(monthText); if (v !== null) void saveMonthAmount(v, `${monthLabel} amount saved.`) }}>{sending === 'month' ? 'Saving…' : 'Save'}</button>
                  <button type="button" className="button-small" aria-disabled={blocked || undefined} onClick={() => void saveMonthAmount(null, `${monthLabel} amount marked as not known.`)}>Not Known Yet</button>
                  {occurrence.amountChangedThisMonth && <button type="button" className="button-small" aria-disabled={blocked || undefined} onClick={() => void saveMonthAmount(undefined, 'Back to the usual amount.')}>Use Usual Amount</button>}
                  <button type="button" className="button-small" onClick={() => setMonthText(null)}>Cancel</button>
                </div>
                <p className="field-help">Only {monthLabel} changes.</p>
              </div>}
          </>}
      </section>

      <section className="block" aria-labelledby="bill-usual">
        <h2 id="bill-usual" className="section-title">Usual Amount</h2>
        <div className="bill-line"><span>From {monthLabel}</span><b>{usualNow === null ? 'Unknown' : money(usualNow)}</b></div>
        {(bill.amountChanges ?? []).length > 0 && (
          <details><summary>Amount history</summary><ul className="line-list">
            <li className="line"><span>From {formatYearMonth(bill.startMonth)}</span><b>{bill.amount === null ? 'Unknown' : money(bill.amount)}</b></li>
            {bill.amountChanges!.map(change => (
              <li key={change.from} className="line"><span>From {formatYearMonth(change.from)}</span><b>{change.amount === null ? 'Unknown' : money(change.amount)}</b></li>
            ))}
          </ul></details>
        )}
        {!usual
          ? <button type="button" className="button-small align-start" onClick={() => { setUsualBase(revision); setUsual({ amount: amountText(usualNow), from: month }) }}>Change Usual Amount</button>
          : <div className="form-stack">
            <Field id="bill-usual-amount" label={`New Usual Amount (${currency})`} inputMode="decimal" value={usual.amount} onChange={amount => setUsual({ ...usual, amount, error: undefined })} error={usual.error} />
            <MonthYearField id="bill-usual-from" label="From month" value={usual.from} onChange={from => setUsual({ ...usual, from, error: undefined })}
              years={yearsAround(Number(today.slice(0, 4)))} defaultYear={Number(month.slice(0, 4))}
              help="This month and the months after it change. Earlier months keep their amount, and a month with its own amount keeps it." />
            <div className="inline-actions">
              <button type="button" className="button-small button-small-primary" aria-disabled={blocked || undefined} onClick={() => void saveUsual()}>{sending === 'usual' ? 'Saving…' : 'Save Usual Amount'}</button>
              <button type="button" className="button-small" onClick={() => setUsual(null)}>Cancel</button>
            </div>
          </div>}
      </section>

      <section className="block" aria-labelledby="bill-details">
        <h2 id="bill-details" className="section-title">Details</h2>
        <dl className="fact-rows">
          <div><dt>Category</dt><dd>{bill.category}</dd></div>
          <div><dt>Due Day</dt><dd>{formatDueDay(bill.dueDay)}</dd></div>
          {bill.frequency === 'yearly' && <div><dt>Billing</dt><dd>Once a year</dd></div>}
          {skipped.length > 0 && <div><dt>Skipped months</dt><dd>{skipped.map(formatYearMonth).join(', ')}</dd></div>}
          <div><dt>First Month</dt><dd>{formatYearMonth(bill.startMonth)}</dd></div>
          <div><dt>Last Month</dt><dd>{bill.endMonth ? formatYearMonth(bill.endMonth) : 'No end'}</dd></div>
          {bill.note && <div><dt>Note</dt><dd>{bill.note}</dd></div>}
          <div><dt>Pays</dt><dd>{debt ? <button type="button" className="text-button inline-link" onClick={() => props.onOpenDebt(debt.id)}>{debt.name}</button> : 'No card or loan'}</dd></div>
        </dl>
        <div className="inline-actions">
          {!confirmDelete && <button type="button" className="button-small" onClick={() => { setDeleteBase(revision); setConfirmDelete(true) }}>Delete Bill</button>}
        </div>
        {confirmDelete && (
          <div className="callout callout-warning" role="alert">
            <p>Delete “{bill.name}”? {paymentCount > 0 && <>{paymentCount} recorded {paymentCount === 1 ? 'payment will' : 'payments will'} also be removed from History and reports. </>}This cannot be undone.{debt ? ` “${debt.name}” stays in Money, under Cards & Loans, without a monthly payment.` : ''}</p>
            <div className="inline-actions">
              <button type="button" className="button-small button-small-danger" aria-disabled={blocked || undefined}
                onClick={async () => { if (sending) return; if (isKept(await save('delete', '', current => deleteBill(current, bill.id), deleteBase))) props.onDeleted() }}>{sending === 'delete' ? 'Saving…' : 'Delete Bill'}</button>
              <button type="button" className="button-small" onClick={() => setConfirmDelete(false)}>Cancel</button>
            </div>
          </div>
        )}
      </section>
    </div>
  )
}
