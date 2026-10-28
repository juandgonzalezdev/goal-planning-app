import { useState } from 'react'
import { useEditBase, useWriteBlocked } from '../../app/writeStatus'
import { Field } from '../../components/Field'
import type { CalendarDate } from '../../domain/goalTime'
import {
  DESCRIPTION_MAX_LENGTH, saveExpense, saveTransfer, updateIncomeEntry, type RecordError, type RecordResult,
} from '../../domain/finance/records'
import { SPENDING_CATEGORIES, SPENDING_NATURES, type Expense, type FinanceData, type Id, type IncomeEntry, type SpendingCategory, type SpendingNature, type Transfer } from '../../domain/finance/types'
import { amountText } from '../../ui/labels'
import { parseMoneyInput } from '../../ui/moneyInput'

/**
 * The small forms History uses to add or change one record. Each saves
 * one record only, so the other months keep what they had.
 */

const ERROR_TEXT: Record<RecordError, string> = {
  'invalid-date': 'Choose a date.',
  'after-today': 'Choose a date that is not after today.',
  'amount-not-positive': 'Enter an amount above 0, such as 45 or 12.50.',
  'unknown-category': 'Choose a category.',
  'description-too-long': `Use at most ${DESCRIPTION_MAX_LENGTH} characters.`,
  'unknown-account': 'Choose an account.',
  'same-account': 'Choose two different accounts.',
  'unknown-nature': 'Choose how often it happens.',
  'not-found': 'This record is no longer there.',
}

const NATURE_NAMES: Record<SpendingNature, string> = { regular: 'Usual spending', annual: 'Once a year', exceptional: 'One-off (unusual)' }

type FormProps<T> = {
  data: FinanceData
  today: CalendarDate
  /** The record to change, or null to add one with `newId`. */
  record: T | null
  newId: () => string
  /**
   * Saves the record, on the revision the form was opened on (`base`).
   * Answers with what is wrong in the record, or why it was not saved
   * (`refusal`); the form stays as typed in both cases.
   */
  onSave: (result: (data: FinanceData) => RecordResult, base: number) => Promise<{ errors: RecordError[]; refusal: string }>
  onCancel: () => void
}

/** A record form's save: its errors, why it was not saved, and "Saving…". */
function useRecordSave(onSave: FormProps<unknown>['onSave']) {
  const base = useEditBase()
  const blocked = useWriteBlocked()
  const [errors, setErrors] = useState<RecordError[]>([])
  const [refusal, setRefusal] = useState('')
  const [sending, setSending] = useState(false)
  const run = async (make: (data: FinanceData) => RecordResult) => {
    setSending(true)
    const answer = await onSave(make, base).finally(() => setSending(false))
    setErrors(answer.errors)
    setRefusal(answer.refusal)
  }
  return { run, errors, refusal, sending, blocked }
}

function Errors({ errors, refusal = '' }: { errors: RecordError[]; refusal?: string }) {
  if (errors.length === 0 && !refusal) return null
  return <p className="field-error" role="alert">{[...[...new Set(errors)].map(error => ERROR_TEXT[error]), refusal].filter(Boolean).join(' ')}</p>
}

export function ExpenseForm({ data, today, record, newId, onSave, onCancel }: FormProps<Expense>) {
  const paying = [...data.moneyAccounts.map(a => ({ id: a.id, name: a.name })), ...data.debts.filter(d => d.kind === 'card').map(d => ({ id: d.id, name: `${d.name} (card)` }))]
  const [date, setDate] = useState(record?.date ?? today)
  const [amount, setAmount] = useState(amountText(record?.amount))
  const [category, setCategory] = useState<SpendingCategory>(record?.category ?? 'Groceries')
  const [description, setDescription] = useState(record?.description ?? '')
  const [accountId, setAccountId] = useState<Id>(record?.accountId ?? paying[0]?.id ?? '')
  const [nature, setNature] = useState<SpendingNature>(record?.nature ?? 'regular')
  const saving = useRecordSave(onSave)
  // The new record's id, kept so a second try after a refusal adds the same record, not a second one.
  const [newRecordId] = useState(() => record?.id ?? newId())
  const prefix = `expense-${record?.id ?? 'new'}`

  const save = () => {
    const minor = parseMoneyInput(amount)
    void saving.run(current => saveExpense(current, newRecordId, { date, amount: minor ?? 0, category, description, accountId, nature }, today))
  }
  return (
    <div className="record-form" role="group" aria-label={record ? 'Change spending' : 'Add spending'}>
      <Field id={`${prefix}-date`} label="Date" type="date" max={today} value={date} onChange={setDate} />
      <Field id={`${prefix}-amount`} label={`Amount (${data.space.currency})`} inputMode="decimal" value={amount} onChange={setAmount} />
      <div className="form-field">
        <label htmlFor={`${prefix}-category`}>Category</label>
        <select id={`${prefix}-category`} value={category} onChange={e => setCategory(e.target.value as SpendingCategory)}>
          {SPENDING_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>
      <Field id={`${prefix}-description`} label="What was it? (optional)" value={description} maxLength={DESCRIPTION_MAX_LENGTH} onChange={setDescription} />
      <div className="form-field">
        <label htmlFor={`${prefix}-account`}>Paid from</label>
        <select id={`${prefix}-account`} value={accountId} onChange={e => setAccountId(e.target.value)} aria-describedby={`${prefix}-account-help`}>
          {paying.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
        <p id={`${prefix}-account-help`} className="field-help">On a card, it is spending now and card debt until you pay the card.</p>
      </div>
      <div className="form-field">
        <label htmlFor={`${prefix}-nature`}>How often</label>
        <select id={`${prefix}-nature`} value={nature} onChange={e => setNature(e.target.value as SpendingNature)}>
          {SPENDING_NATURES.map(n => <option key={n} value={n}>{NATURE_NAMES[n]}</option>)}
        </select>
      </div>
      <Errors errors={saving.errors} refusal={saving.refusal} />
      <div className="inline-actions">
        <button type="button" className="button-small button-small-primary" aria-disabled={saving.blocked || undefined} onClick={save}>{saving.sending ? 'Saving…' : record ? 'Save Changes' : 'Add Spending'}</button>
        <button type="button" className="button-small" onClick={onCancel}>Cancel</button>
      </div>
    </div>
  )
}

export function TransferForm({ data, today, record, newId, onSave, onCancel }: FormProps<Transfer>) {
  const accounts = data.moneyAccounts
  const [date, setDate] = useState(record?.date ?? today)
  const [amount, setAmount] = useState(amountText(record?.amount))
  const [fromAccountId, setFrom] = useState<Id>(record?.fromAccountId ?? accounts[0]?.id ?? '')
  const [toAccountId, setTo] = useState<Id>(record?.toAccountId ?? accounts[1]?.id ?? accounts[0]?.id ?? '')
  const [note, setNote] = useState(record?.note ?? '')
  const saving = useRecordSave(onSave)
  const [newRecordId] = useState(() => record?.id ?? newId())
  const prefix = `transfer-${record?.id ?? 'new'}`

  const save = () => {
    const minor = parseMoneyInput(amount)
    void saving.run(current => saveTransfer(current, newRecordId, { date, amount: minor ?? 0, fromAccountId, toAccountId, note }, today))
  }
  return (
    <div className="record-form" role="group" aria-label={record ? 'Change transfer' : 'Add transfer'}>
      <p className="field-help">Money moved between your own accounts. It is not income or spending.</p>
      <Field id={`${prefix}-date`} label="Date" type="date" max={today} value={date} onChange={setDate} />
      <Field id={`${prefix}-amount`} label={`Amount (${data.space.currency})`} inputMode="decimal" value={amount} onChange={setAmount} />
      {(['from', 'to'] as const).map(side => (
        <div key={side} className="form-field">
          <label htmlFor={`${prefix}-${side}`}>{side === 'from' ? 'From' : 'To'}</label>
          <select id={`${prefix}-${side}`} value={side === 'from' ? fromAccountId : toAccountId} onChange={e => (side === 'from' ? setFrom : setTo)(e.target.value)}>
            {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </div>
      ))}
      <Field id={`${prefix}-note`} label="Note (optional)" value={note} maxLength={DESCRIPTION_MAX_LENGTH} onChange={setNote} />
      <Errors errors={saving.errors} refusal={saving.refusal} />
      <div className="inline-actions">
        <button type="button" className="button-small button-small-primary" aria-disabled={saving.blocked || undefined} onClick={save}>{saving.sending ? 'Saving…' : record ? 'Save Changes' : 'Add Transfer'}</button>
        <button type="button" className="button-small" onClick={onCancel}>Cancel</button>
      </div>
    </div>
  )
}

export function IncomeForm({ data, today, record, onSave, onCancel }: Omit<FormProps<IncomeEntry>, 'record' | 'newId'> & { record: IncomeEntry }) {
  const [date, setDate] = useState(record.receivedOn)
  const [amount, setAmount] = useState(amountText(record.amount))
  const saving = useRecordSave(onSave)
  const prefix = `income-${record.id}`
  const save = () => {
    const minor = parseMoneyInput(amount)
    void saving.run(current => updateIncomeEntry(current, record.id, minor ?? -1, date, today))
  }
  return (
    <div className="record-form" role="group" aria-label="Change income">
      <Field id={`${prefix}-date`} label="Date Received" type="date" max={today} value={date} onChange={setDate} />
      <Field id={`${prefix}-amount`} label={`Amount Received (${data.space.currency})`} inputMode="decimal" value={amount} onChange={setAmount}
        help="It still counts for the same month." />
      <Errors errors={saving.errors} refusal={saving.refusal} />
      <div className="inline-actions">
        <button type="button" className="button-small button-small-primary" aria-disabled={saving.blocked || undefined} onClick={save}>{saving.sending ? 'Saving…' : 'Save Changes'}</button>
        <button type="button" className="button-small" onClick={onCancel}>Cancel</button>
      </div>
    </div>
  )
}
