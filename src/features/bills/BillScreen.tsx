import { useState } from 'react'
import { Field } from '../../components/Field'
import { amountText } from '../../ui/labels'
import { Icon } from '../../components/Icon'
import { MonthSwitch } from '../../components/MonthSwitch'
import type { YearMonth } from '../../domain/calendar'
import {
  addBill, billsForMonth, deleteBill, setBillMonthAmount, setBillPaid, setUsualAmountFrom, updateBill, usualAmountFor,
  type BillFieldError, type BillFields,
} from '../../domain/finance/bills'
import { BILL_CATEGORIES, type FinanceData, type Id, type Owner, type RecurringBill } from '../../domain/finance/types'
import type { CalendarDate } from '../../domain/goalTime'
import { formatAmount, formatDate, formatDueDay, formatYearMonth } from '../../ui/format'
import { parseMoneyInput } from '../../ui/moneyInput'
import { outcomeText, type SaveOutcome } from '../../ui/saveOutcome'
import { SubscriptionSection } from './SubscriptionSection'

type Props = {
  data: FinanceData
  /** null: adding a new bill. */
  billId: Id | null
  months: YearMonth[]
  month: YearMonth
  onMonthChange: (month: YearMonth) => void
  today: CalendarDate
  owner: Owner
  newId: () => string
  onBack: () => void
  onChange: (change: (data: FinanceData) => FinanceData) => SaveOutcome
  onCreated: (id: Id) => void
  onDeleted: () => void
  onOpenDebt: (id: Id) => void
}

const FIELD_ERRORS: Record<BillFieldError, [keyof BillDraft, string]> = {
  'name-required': ['name', 'Enter a name, such as Rent.'],
  'name-too-long': ['name', 'Use 40 characters or fewer.'],
  'unknown-category': ['category', 'Choose a category.'],
  'invalid-due-day': ['dueDay', 'Enter a day from 1 to 31.'],
  'invalid-start': ['startMonth', 'Choose the first month.'],
  'invalid-end': ['endMonth', 'Choose a month, or leave it empty.'],
  'ends-before-start': ['endMonth', 'The last month can’t be before the first.'],
  'note-too-long': ['note', 'Keep the note to 120 characters or fewer.'],
  'unknown-debt': ['debtId', 'Choose a card or loan from the list.'],
  'debt-already-paid': ['debtId', 'Another bill already pays this card or loan.'],
  'starts-after-change': ['startMonth', 'The first month must be before the first change of the usual amount.'],
}

interface BillDraft { name: string; category: string; dueDay: string; startMonth: string; endMonth: string; note: string; debtId: string; amount: string }
type DraftErrors = Partial<Record<keyof BillDraft, string>>

const draftOf = (bill: RecurringBill | null, month: YearMonth): BillDraft => ({
  name: bill?.name ?? '', category: bill?.category ?? 'Other', dueDay: bill ? String(bill.dueDay) : '', startMonth: bill?.startMonth ?? month,
  endMonth: bill?.endMonth ?? '', note: bill?.note ?? '', debtId: bill?.debtId ?? '', amount: '',
})

function readDraft(draft: BillDraft, owner: Owner): BillFields {
  return {
    name: draft.name, category: draft.category as BillFields['category'], owner,
    dueDay: /^\d{1,2}$/.test(draft.dueDay.trim()) ? Number(draft.dueDay) : NaN,
    startMonth: draft.startMonth, endMonth: draft.endMonth === '' ? null : draft.endMonth, note: draft.note, debtId: draft.debtId === '' ? null : draft.debtId,
  }
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
  const [draft, setDraft] = useState<BillDraft>(() => draftOf(bill, month))
  const [errors, setErrors] = useState<DraftErrors>({})
  // The amount being typed for one month; another month shows its own amount, not this draft.
  const [monthDraft, setMonthDraft] = useState<{ month: YearMonth; text: string } | null>(null)
  const monthText = monthDraft?.month === month ? monthDraft.text : null
  const setMonthText = (text: string | null) => setMonthDraft(text === null ? null : { month, text })
  const [usual, setUsual] = useState<{ amount: string; from: string; error?: string } | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [message, setMessage] = useState('')

  if (billId && !bill) {
    return (
      <div className="tab-screen">
        <button type="button" className="back-link" onClick={onBack}><Icon name="arrowLeft" size={18} /> Back</button>
        <div className="empty-block"><p>This bill is no longer here.</p></div>
      </div>
    )
  }

  const occurrence = bill ? billsForMonth(data, month).find(o => o.bill.id === bill.id) ?? null : null
  const set = (patch: Partial<BillDraft>) => setDraft({ ...draft, ...patch })
  const availableDebts = data.debts.filter(debt => !data.bills.some(b => b.debtId === debt.id && b.id !== billId))

  const saveDetails = () => {
    const fields = readDraft(draft, bill?.owner ?? props.owner)
    let amount: number | null = null
    if (!bill && draft.amount.trim() !== '') {
      amount = parseMoneyInput(draft.amount)
      if (amount === null) { setErrors({ amount: 'Enter an amount such as 700, or leave it empty if you don’t know it yet.' }); return }
    }
    const id = bill?.id ?? props.newId()
    let problems: BillFieldError[] = []
    const outcome = onChange(current => {
      const result = bill ? updateBill(current, id, fields) : addBill(current, id, fields, amount)
      if (result.status === 'ok') return result.data
      problems = result.errors
      return current
    })
    if (problems.length > 0) {
      setErrors(Object.fromEntries(problems.map(problem => FIELD_ERRORS[problem])))
      return
    }
    setErrors({})
    if (!bill) { props.onCreated(id); return }
    setEditing(false)
    setMessage(outcomeText('Details updated.', outcome))
  }

  if (editing || !bill) {
    return (
      <div className="tab-screen">
        <button type="button" className="back-link" onClick={() => (bill ? setEditing(false) : onBack())}><Icon name="arrowLeft" size={18} /> {bill ? 'Cancel' : 'Back'}</button>
        <h1 className="tab-title">{bill ? `Edit ${bill.name}` : 'Add Bill'}</h1>
        <section className="block">
          <div className="form-stack">
            <Field id="bill-name" label="Name" value={draft.name} onChange={name => set({ name })} error={errors.name} maxLength={60} />
            <div className="form-field">
              <label htmlFor="bill-category">Category</label>
              <select id="bill-category" value={draft.category} onChange={e => set({ category: e.target.value })}>
                {BILL_CATEGORIES.map(category => <option key={category}>{category}</option>)}
              </select>
            </div>
            {!bill && <Field id="bill-amount" label={`Usual Amount (${currency})`} inputMode="decimal" value={draft.amount} onChange={amount => set({ amount })} error={errors.amount}
              help="Leave it empty if it changes and you don’t know it yet. It will show as unknown, never as 0." />}
            <Field id="bill-due" label="Due Day" inputMode="numeric" value={draft.dueDay} onChange={dueDay => set({ dueDay })} error={errors.dueDay} help="Day of the month, 1 to 31. Short months use their last day." />
            <Field id="bill-start" label="First Month" type="month" value={draft.startMonth} onChange={startMonth => set({ startMonth })} error={errors.startMonth} />
            <Field id="bill-end" label="Last Month (optional)" type="month" value={draft.endMonth} onChange={endMonth => set({ endMonth })} error={errors.endMonth} help="Leave it empty if the bill has no end." />
            <div className="form-field">
              <label htmlFor="bill-debt">Pays a Card or Loan</label>
              <select id="bill-debt" value={draft.debtId} onChange={e => set({ debtId: e.target.value })} aria-describedby="bill-debt-help">
                <option value="">No</option>
                {availableDebts.map(debt => <option key={debt.id} value={debt.id}>{debt.name}</option>)}
              </select>
              <p id="bill-debt-help" className="field-help">Then this bill is that card’s or loan’s monthly payment, counted once. Marking it paid never lowers the balance.</p>
              {errors.debtId && <p className="field-error">{errors.debtId}</p>}
            </div>
            <Field id="bill-note" label="Note (optional)" value={draft.note} onChange={note => set({ note })} error={errors.note} maxLength={140} />
          </div>
        </section>
        <div className="inline-actions">
          <button type="button" className="button-small button-small-primary" onClick={saveDetails}>{bill ? 'Save Changes' : 'Add Bill'}</button>
          <button type="button" className="button-small" onClick={() => { if (bill) { setDraft(draftOf(bill, month)); setErrors({}); setEditing(false) } else onBack() }}>Cancel</button>
        </div>
      </div>
    )
  }

  const usualNow = usualAmountFor(bill, month)
  const debt = bill.debtId ? data.debts.find(d => d.id === bill.debtId) ?? null : null
  const monthLabel = formatYearMonth(month)
  const paidOn = data.billMonths.find(record => record.billId === bill.id && record.month === month)?.paidOn

  const saveMonthAmount = (value: number | null | undefined, done: string) => {
    const outcome = onChange(current => setBillMonthAmount(current, bill.id, month, value))
    setMonthText(null)
    setMessage(outcomeText(done, outcome))
  }
  const saveUsual = () => {
    if (!usual) return
    const amount = usual.amount.trim() === '' ? null : parseMoneyInput(usual.amount)
    if (usual.amount.trim() !== '' && amount === null) { setUsual({ ...usual, error: 'Enter an amount such as 750, or leave it empty for unknown.' }); return }
    if (!/^\d{4}-\d{2}$/.test(usual.from) || usual.from < bill.startMonth) { setUsual({ ...usual, error: `Choose ${formatYearMonth(bill.startMonth)} or later.` }); return }
    const outcome = onChange(current => setUsualAmountFrom(current, bill.id, usual.from, amount))
    setUsual(null)
    setMessage(outcomeText(`Usual amount changed from ${formatYearMonth(usual.from)} on.`, outcome))
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
              <b>{occurrence.amount === null ? 'Amount needed' : money(occurrence.amount)}</b>
            </div>
            <div className="bill-line">
              <small>{occurrence.paid ? (paidOn ? `Paid on ${formatDate(paidOn)}` : 'Paid') : `Due ${formatDate(occurrence.dueDate)}`}</small>
              <button type="button" className={`paid-toggle${occurrence.paid ? ' is-paid' : ''}`} aria-pressed={occurrence.paid} aria-label={`${bill.name} paid in ${monthLabel}`}
                onClick={() => { const outcome = onChange(current => setBillPaid(current, bill.id, month, !occurrence.paid, today)); setMessage(outcomeText(occurrence.paid ? 'Marked as not paid.' : 'Marked as paid.', outcome)) }}>
                {occurrence.paid ? '✓ Paid' : '○ Pending'}
              </button>
            </div>
            {monthText === null
              ? <button type="button" className="text-button" onClick={() => setMonthText(amountText(occurrence.amount))}>Change Amount for {monthLabel}</button>
              : <div className="amount-editor">
                <Field id="bill-month-amount" label={`Amount for ${monthLabel} (${currency})`} inputMode="decimal" value={monthText} onChange={setMonthText} />
                <div className="inline-actions">
                  <button type="button" className="button-small button-small-primary" onClick={() => { const v = parseMoneyInput(monthText); if (v !== null) saveMonthAmount(v, `${monthLabel} amount saved.`) }}>Save</button>
                  <button type="button" className="button-small" onClick={() => saveMonthAmount(null, `${monthLabel} amount marked as not known.`)}>Not Known Yet</button>
                  {occurrence.amountChangedThisMonth && <button type="button" className="button-small" onClick={() => saveMonthAmount(undefined, 'Back to the usual amount.')}>Use Usual Amount</button>}
                  <button type="button" className="button-small" onClick={() => setMonthText(null)}>Cancel</button>
                </div>
                <p className="field-help">Only {monthLabel} changes.</p>
              </div>}
          </>}
      </section>

      <section className="block" aria-labelledby="bill-usual">
        <h2 id="bill-usual" className="section-title">Usual Amount</h2>
        <div className="bill-line"><span>From {monthLabel}</span><b>{usualNow === null ? 'Not known' : money(usualNow)}</b></div>
        {(bill.amountChanges ?? []).length > 0 && (
          <ul className="line-list">
            <li className="line"><span>From {formatYearMonth(bill.startMonth)}</span><b>{bill.amount === null ? 'Not known' : money(bill.amount)}</b></li>
            {bill.amountChanges!.map(change => (
              <li key={change.from} className="line"><span>From {formatYearMonth(change.from)}</span><b>{change.amount === null ? 'Not known' : money(change.amount)}</b></li>
            ))}
          </ul>
        )}
        {!usual
          ? <button type="button" className="button-small align-start" onClick={() => setUsual({ amount: amountText(usualNow), from: month })}>Change Usual Amount</button>
          : <div className="form-stack">
            <Field id="bill-usual-amount" label={`New Usual Amount (${currency})`} inputMode="decimal" value={usual.amount} onChange={amount => setUsual({ ...usual, amount, error: undefined })} error={usual.error} />
            <Field id="bill-usual-from" label="From Month" type="month" value={usual.from} onChange={from => setUsual({ ...usual, from, error: undefined })}
              help="This month and the months after it change. Earlier months keep their amount, and a month with its own amount keeps it." />
            <div className="inline-actions">
              <button type="button" className="button-small button-small-primary" onClick={saveUsual}>Save Usual Amount</button>
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
          <button type="button" className="button-small" onClick={() => { setDraft(draftOf(bill, month)); setEditing(true); setMessage('') }}>Edit Details</button>
          {!confirmDelete && <button type="button" className="button-small" onClick={() => setConfirmDelete(true)}>Delete Bill</button>}
        </div>
        {confirmDelete && (
          <div className="callout callout-warning" role="alert">
            <p>Delete “{bill.name}” and what was recorded for it each month? This cannot be undone.{debt ? ` “${debt.name}” stays in Cards, without a monthly payment.` : ''}</p>
            <div className="inline-actions">
              <button type="button" className="button-small button-small-danger" onClick={() => { onChange(current => deleteBill(current, bill.id)); props.onDeleted() }}>Delete Bill</button>
              <button type="button" className="button-small" onClick={() => setConfirmDelete(false)}>Cancel</button>
            </div>
          </div>
        )}
      </section>
    </div>
  )
}
