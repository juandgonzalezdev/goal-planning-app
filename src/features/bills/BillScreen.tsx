import { useState } from 'react'
import { Field } from '../../components/Field'
import { amountText } from '../../ui/labels'
import { Icon } from '../../components/Icon'
import { MonthSwitch } from '../../components/MonthSwitch'
import { yearsAround, type YearMonth } from '../../domain/calendar'
import { MonthYearField } from '../../components/MonthYearField'
import { BillForm } from './BillForm'
import { billsForMonth, deleteBill, setBillMonthAmount, setBillPaid, setUsualAmountFrom, usualAmountFor } from '../../domain/finance/bills'
import type { FinanceData, Id, Owner } from '../../domain/finance/types'
import type { CalendarDate } from '../../domain/goalTime'
import { formatAmount, formatDate, formatDueDay, formatYearMonth } from '../../ui/format'
import { parseMoneyInput } from '../../ui/moneyInput'
import { isKept, outcomeText, type ChangeSpace, type SaveOutcome } from '../../ui/saveOutcome'
import { useWriteBlocked, useWriteStatus } from '../../app/writeStatus'
import { SubscriptionSection } from './SubscriptionSection'

type Props = {
  data: FinanceData
  /** null: adding a new bill. */
  billId: Id | null
  /** Adding a bill from a day of the calendar: its due day starts on that day. */
  dueDate?: CalendarDate | null
  months: YearMonth[]
  month: YearMonth
  onMonthChange: (month: YearMonth) => void
  today: CalendarDate
  owner: Owner
  newId: () => string
  onBack: () => void
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
  const [editing, setEditing] = useState(billId === null)
  // The amount being typed for one month; another month shows its own amount, not this draft.
  const [monthDraft, setMonthDraft] = useState<{ month: YearMonth; text: string } | null>(null)
  const monthText = monthDraft?.month === month ? monthDraft.text : null
  const setMonthText = (text: string | null) => setMonthDraft(text === null ? null : { month, text })
  const [usual, setUsual] = useState<{ amount: string; from: string; error?: string } | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [message, setMessage] = useState('')
  const { revision } = useWriteStatus()
  const blocked = useWriteBlocked()
  // Which change is being saved ("Saving…"), and the revision each editor was opened on.
  const [sending, setSending] = useState<'month' | 'usual' | 'paid' | 'delete' | null>(null)
  const [monthBase, setMonthBase] = useState(revision)
  const [usualBase, setUsualBase] = useState(revision)
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
        <div className="empty-block"><p>This bill is no longer here.</p></div>
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
          onCancel={() => (bill ? setEditing(false) : onBack())} onCreated={props.onCreated}
          onSaved={done => { setEditing(false); setMessage(done) }} />
      </div>
    )
  }

  const usualNow = usualAmountFor(bill, month)
  const debt = bill.debtId ? data.debts.find(d => d.id === bill.debtId) ?? null : null
  const monthLabel = formatYearMonth(month)
  const paidOn = data.billMonths.find(record => record.billId === bill.id && record.month === month)?.paidOn

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
      <div>
        <h1 className="tab-title">{bill.name}</h1>
        <p className="muted-note">{bill.category} · Due {formatDueDay(bill.dueDay).toLowerCase()}</p>
      </div>
      <MonthSwitch months={props.months} value={month} onChange={next => { setMonthDraft(null); setMessage(''); props.onMonthChange(next) }} />
      <p className="muted-note" role="status">{message}</p>

      <section className="block" aria-labelledby="bill-month">
        <h2 id="bill-month" className="section-title">{monthLabel}</h2>
        {!occurrence
          ? <p className="muted-note">This bill is not due in {monthLabel}.</p>
          : <>
            <div className="bill-line">
              <span>{occurrence.amountChangedThisMonth ? `Amount for ${monthLabel} only` : 'Amount'}</span>
              <b>{occurrence.amount === null ? 'Unknown' : money(occurrence.amount)}</b>
            </div>
            <div className="bill-line">
              <small>{occurrence.paid ? (paidOn ? `Paid on ${formatDate(paidOn)}` : 'Paid') : `Due ${formatDate(occurrence.dueDate)}`}</small>
              <button type="button" className={`paid-toggle${occurrence.paid ? ' is-paid' : ''}`} aria-pressed={occurrence.paid} aria-label={`${bill.name} paid in ${monthLabel}`}
                aria-disabled={blocked || undefined} onClick={() => void save('paid', occurrence.paid ? 'Marked as not paid.' : 'Marked as paid.', current => setBillPaid(current, bill.id, month, !occurrence.paid, today))}>
                {occurrence.paid ? '✓ Paid' : '○ Pending'}
              </button>
            </div>
            {monthText === null
              ? <button type="button" className="text-button" onClick={() => { setMonthBase(revision); setMonthText(amountText(occurrence.amount)) }}>Change Amount for {monthLabel}</button>
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
          <ul className="line-list">
            <li className="line"><span>From {formatYearMonth(bill.startMonth)}</span><b>{bill.amount === null ? 'Unknown' : money(bill.amount)}</b></li>
            {bill.amountChanges!.map(change => (
              <li key={change.from} className="line"><span>From {formatYearMonth(change.from)}</span><b>{change.amount === null ? 'Unknown' : money(change.amount)}</b></li>
            ))}
          </ul>
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

      {bill.category === 'Subscriptions' && <SubscriptionSection data={data} bill={bill} today={today} onChange={onChange} onMessage={setMessage} />}

      <section className="block" aria-labelledby="bill-details">
        <h2 id="bill-details" className="section-title">Details</h2>
        <dl className="fact-rows">
          <div><dt>Category</dt><dd>{bill.category}</dd></div>
          <div><dt>Due Day</dt><dd>{formatDueDay(bill.dueDay)}</dd></div>
          {bill.frequency === 'yearly' && <div><dt>Billing</dt><dd>Once a year</dd></div>}
          {(bill.pausedMonths ?? []).length > 0 && <div><dt>Paused</dt><dd>{bill.pausedMonths!.map(formatYearMonth).join(', ')}</dd></div>}
          <div><dt>First Month</dt><dd>{formatYearMonth(bill.startMonth)}</dd></div>
          <div><dt>Last Month</dt><dd>{bill.endMonth ? formatYearMonth(bill.endMonth) : 'No end'}</dd></div>
          {bill.note && <div><dt>Note</dt><dd>{bill.note}</dd></div>}
          <div><dt>Pays</dt><dd>{debt ? <button type="button" className="text-button inline-link" onClick={() => props.onOpenDebt(debt.id)}>{debt.name}</button> : 'No card or loan'}</dd></div>
        </dl>
        <div className="inline-actions">
          <button type="button" className="button-small" onClick={() => { setEditing(true); setMessage('') }}>Edit Details</button>
          {!confirmDelete && <button type="button" className="button-small" onClick={() => setConfirmDelete(true)}>Delete Bill</button>}
        </div>
        {confirmDelete && (
          <div className="callout callout-warning" role="alert">
            <p>Delete “{bill.name}” and what was recorded for it each month? This cannot be undone.{debt ? ` “${debt.name}” stays in Cards, without a monthly payment.` : ''}</p>
            <div className="inline-actions">
              <button type="button" className="button-small button-small-danger" aria-disabled={blocked || undefined}
                onClick={async () => { if (isKept(await save('delete', '', current => deleteBill(current, bill.id)))) props.onDeleted() }}>{sending === 'delete' ? 'Saving…' : 'Delete Bill'}</button>
              <button type="button" className="button-small" onClick={() => setConfirmDelete(false)}>Cancel</button>
            </div>
          </div>
        )}
      </section>
    </div>
  )
}
