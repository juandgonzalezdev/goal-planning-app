import { useEffect, useRef, useState } from 'react'
import { Field } from '../../components/Field'
import { MonthYearField } from '../../components/MonthYearField'
import { isYearMonth, yearMonthOf, yearsAround, type YearMonth } from '../../domain/calendar'
import { readDueDay, scheduleSentence } from './billsView'
import { addBill, updateBill, validateBillFields, type BillFieldError, type BillFields } from '../../domain/finance/bills'
import { BILL_CATEGORIES, type FinanceData, type Id, type Owner, type RecurringBill } from '../../domain/finance/types'
import type { CalendarDate } from '../../domain/goalTime'
import { parseMoneyInput } from '../../ui/moneyInput'
import { outcomeText, type SaveOutcome } from '../../ui/saveOutcome'

type Props = {
  data: FinanceData
  /** null: Add Bill. Otherwise its details are edited (its amounts have their own actions). */
  bill: RecurringBill | null
  /** The shared month: a new bill starts in it. */
  month: YearMonth
  /** Add Bill from a day of the calendar: the due day starts on it. */
  dueDay?: number
  today: CalendarDate
  owner: Owner
  newId: () => string
  onCancel: () => void
  onChange: (change: (data: FinanceData) => FinanceData) => SaveOutcome
  /** A new bill was saved; `message` says what happened to the save, e.g. "Bill added. Saved on this device." */
  onCreated: (id: Id, message: string) => void
  onSaved: (message: string) => void
}

interface BillDraft {
  name: string; category: string; amount: string; amountUnknown: boolean; dueDay: string
  startMonth: string; endMonth: string; debtId: string; note: string
}
type DraftField = Exclude<keyof BillDraft, 'amountUnknown'>
type DraftErrors = Partial<Record<DraftField, string>>

const FIELD_ERRORS: Record<BillFieldError, [DraftField, string]> = {
  'name-required': ['name', 'Enter a name, such as Rent.'],
  'name-too-long': ['name', 'Use 40 characters or fewer.'],
  'unknown-category': ['category', 'Choose a category.'],
  'invalid-due-day': ['dueDay', 'Enter a day from 1 to 31.'],
  'invalid-start': ['startMonth', 'Choose the start month.'],
  'invalid-end': ['endMonth', 'Choose a month, or No end month.'],
  'ends-before-start': ['endMonth', 'The end month can’t be before the start month.'],
  'note-too-long': ['note', 'Keep the note to 120 characters or fewer.'],
  'unknown-debt': ['debtId', 'Choose a card or loan from the list.'],
  'debt-already-paid': ['debtId', 'Another bill already pays this card or loan.'],
  'starts-after-change': ['startMonth', 'The start month must be before the first change of the usual amount.'],
}

/** Where each field is on the screen, top to bottom: the first one with an error gets the focus. */
const FIELD_IDS: Record<DraftField, string> = {
  name: 'bill-name', category: 'bill-category', amount: 'bill-amount', dueDay: 'bill-due',
  startMonth: 'bill-start', endMonth: 'bill-end', debtId: 'bill-debt', note: 'bill-note',
}
const FIELD_ORDER = Object.keys(FIELD_IDS) as DraftField[]
/** The fields inside More options. */
const MORE_FIELDS: readonly DraftField[] = ['endMonth', 'debtId', 'note']

const draftOf = (bill: RecurringBill | null, month: YearMonth, dueDay?: number): BillDraft => ({
  name: bill?.name ?? '', category: bill?.category ?? 'Other', amount: '', amountUnknown: false, dueDay: bill ? String(bill.dueDay) : dueDay ? String(dueDay) : '',
  startMonth: bill?.startMonth ?? month, endMonth: bill?.endMonth ?? '', debtId: bill?.debtId ?? '', note: bill?.note ?? '',
})

function readDraft(draft: BillDraft, owner: Owner): BillFields {
  return {
    name: draft.name, category: draft.category as BillFields['category'], owner, dueDay: readDueDay(draft.dueDay),
    startMonth: draft.startMonth, endMonth: draft.endMonth === '' ? null : draft.endMonth, note: draft.note, debtId: draft.debtId === '' ? null : draft.debtId,
  }
}

/**
 * Add Bill (and Edit Details of a bill): the main fields first, the rest in
 * More options. An unknown amount is chosen explicitly and saved as
 * unknown, never as 0. Saving once creates one bill.
 */
export function BillForm({ data, bill, month, dueDay, today, owner, newId, onCancel, onChange, onCreated, onSaved }: Props) {
  const currency = data.space.currency
  const [draft, setDraft] = useState<BillDraft>(() => draftOf(bill, month, dueDay))
  const [errors, setErrors] = useState<DraftErrors>({})
  const [moreOpen, setMoreOpen] = useState(() => !!(bill?.endMonth || bill?.debtId || bill?.note))
  // A save in progress: a second tap (or Enter) before the screen changes must not add a second bill.
  const saving = useRef(false)
  const focusField = useRef<DraftField | null>(null)
  const years = yearsAround(Number(today.slice(0, 4)))
  const startYear = isYearMonth(draft.startMonth) ? Number(draft.startMonth.slice(0, 4)) : Number(yearMonthOf(today).slice(0, 4))
  const availableDebts = data.debts.filter(debt => !data.bills.some(b => b.debtId === debt.id && b.id !== bill?.id))
  const sentence = scheduleSentence(draft, bill?.frequency === 'yearly')

  useEffect(() => {
    if (!focusField.current) return
    document.getElementById(FIELD_IDS[focusField.current])?.focus()
    focusField.current = null
  })

  const set = (patch: Partial<BillDraft>) => {
    setDraft({ ...draft, ...patch })
    const cleared = { ...errors }
    for (const key of Object.keys(patch)) delete cleared[(key === 'amountUnknown' ? 'amount' : key) as DraftField]
    setErrors(cleared)
  }

  const showErrors = (found: DraftErrors) => {
    setErrors(found)
    const first = FIELD_ORDER.find(field => found[field])
    if (!first) return
    // An error inside More options opens it, so it is never hidden; the focus goes to the first error on the screen.
    if (MORE_FIELDS.some(field => found[field])) setMoreOpen(true)
    focusField.current = first
  }

  const save = () => {
    if (saving.current) return
    const fields = readDraft(draft, bill?.owner ?? owner)
    const found: DraftErrors = Object.fromEntries(validateBillFields(data, fields, bill?.id ?? null).map(problem => FIELD_ERRORS[problem]))
    let amount: number | null = null
    if (!bill && !draft.amountUnknown) {
      if (draft.amount.trim() === '') found.amount = 'Enter the usual amount, or choose Amount not known yet.'
      else {
        amount = parseMoneyInput(draft.amount)
        if (amount === null) found.amount = 'Enter an amount such as 700 or 120.45.'
      }
    }
    if (Object.keys(found).length > 0) { showErrors(found); return }

    saving.current = true
    const id = bill?.id ?? newId()
    let problems: BillFieldError[] = []
    const outcome = onChange(current => {
      const result = bill ? updateBill(current, id, fields) : addBill(current, id, fields, amount)
      if (result.status === 'ok') return result.data
      problems = result.errors
      return current
    })
    if (problems.length > 0) {
      saving.current = false
      showErrors(Object.fromEntries(problems.map(problem => FIELD_ERRORS[problem])))
      return
    }
    if (!bill) { onCreated(id, outcomeText('Bill added.', outcome)); return }
    saving.current = false
    onSaved(outcomeText('Details updated.', outcome))
  }

  return (
    <form className="bill-form" noValidate onSubmit={event => { event.preventDefault(); save() }}>
      <section className="block">
        <div className="form-stack">
          <Field id="bill-name" label="Bill name" value={draft.name} onChange={name => set({ name })} error={errors.name} maxLength={60} />
          <div className="form-field">
            <label htmlFor="bill-category">Category</label>
            <select id="bill-category" value={draft.category} onChange={e => set({ category: e.target.value })}>
              {BILL_CATEGORIES.map(category => <option key={category}>{category}</option>)}
            </select>
          </div>
          {!bill && (
            <div className="bill-amount-group">
              <Field id="bill-amount" label={`Usual amount (${currency})`} inputMode="decimal" value={draft.amountUnknown ? '' : draft.amount}
                disabled={draft.amountUnknown} onChange={amount => set({ amount })} error={errors.amount} />
              <label className="check-row">
                <input type="checkbox" checked={draft.amountUnknown} aria-describedby="bill-amount-unknown-help" onChange={e => set({ amountUnknown: e.target.checked })} />
                <span>Amount not known yet</span>
              </label>
              <p id="bill-amount-unknown-help" className="field-help check-help">It shows as Unknown, never as 0.</p>
            </div>
          )}
          <Field id="bill-due" label="Due day" inputMode="numeric" value={draft.dueDay} onChange={dueDay => set({ dueDay })} error={errors.dueDay} help="Shorter months use their last day." />
          <MonthYearField id="bill-start" label="Start month" value={draft.startMonth} onChange={startMonth => set({ startMonth })} years={years}
            defaultYear={startYear} error={errors.startMonth} />

          <button type="button" className="more-toggle" aria-expanded={moreOpen} aria-controls="bill-more" onClick={() => setMoreOpen(!moreOpen)}>
            More options <span className="muted-note">End month, card or loan, note</span>
          </button>
          {moreOpen && (
            <div id="bill-more" className="form-stack more-options">
              <MonthYearField id="bill-end" label="End month" value={draft.endMonth} onChange={endMonth => set({ endMonth })} years={years}
                noneLabel="No end month" defaultYear={startYear} error={errors.endMonth} />
              <div className="form-field">
                <label htmlFor="bill-debt">Pays a card or loan</label>
                <select id="bill-debt" value={draft.debtId} onChange={e => set({ debtId: e.target.value })}
                  aria-invalid={!!errors.debtId} aria-describedby={[draft.debtId ? 'bill-debt-help' : '', errors.debtId ? 'bill-debt-error' : ''].filter(Boolean).join(' ') || undefined}>
                  <option value="">None</option>
                  {availableDebts.map(debt => <option key={debt.id} value={debt.id}>{debt.name}</option>)}
                  {draft.debtId && !availableDebts.some(debt => debt.id === draft.debtId) && <option value={draft.debtId}>{data.debts.find(debt => debt.id === draft.debtId)?.name ?? 'Unknown card or loan'}</option>}
                </select>
                {draft.debtId && <p id="bill-debt-help" className="field-help">This bill is its monthly payment, counted once. Marking it paid does not update the remaining balance.</p>}
                {errors.debtId && <p id="bill-debt-error" className="field-error">{errors.debtId}</p>}
              </div>
              <Field id="bill-note" label="Note" value={draft.note} onChange={note => set({ note })} error={errors.note} maxLength={140} />
            </div>
          )}
        </div>
      </section>
      {sentence && <p className="bill-schedule">{sentence}</p>}
      <div className="inline-actions">
        <button type="submit" className="button-small button-small-primary">{bill ? 'Save Changes' : 'Add Bill'}</button>
        <button type="button" className="button-small" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  )
}
