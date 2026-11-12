import { Field } from '../../components/Field'
import type { CurrencyCode } from '../../domain/money'
import type { IncomeSourceDraft } from './incomeDraft'

type Props = {
  draft: IncomeSourceDraft
  onDraftChange: (draft: IncomeSourceDraft) => void
  currency: CurrencyCode
  /** This form is being saved: Save says so. */
  saving: boolean
  /** Saving is blocked (another tab, a pending write): Save is marked as unavailable. */
  blocked: boolean
  onSave: () => void
  onCancel: () => void
}

/**
 * The fields and buttons of Add Income and Edit (GS-2), exactly as Money
 * showed them. Typing a name, amount or pay day clears the message; the
 * months do not. The draft and its checks are in `incomeDraft.ts`.
 */
export function IncomeSourceForm({ draft, onDraftChange, currency, saving, blocked, onSave, onCancel }: Props) {
  const set = (change: Partial<IncomeSourceDraft>) => onDraftChange({ ...draft, ...change })
  return (
    <div className="form-stack edit-box">
      <Field id="income-name" label="Name" value={draft.name} onChange={name => set({ name, error: undefined })} maxLength={60} />
      <Field id="income-amount" label={`Usual Net Amount per Month (${currency})`} inputMode="decimal" value={draft.amount} onChange={amount => set({ amount, error: undefined })} />
      <Field id="income-day" label="Pay Day" inputMode="numeric" value={draft.payDay} onChange={payDay => set({ payDay, error: undefined })} help="Day of the month it usually arrives." />
      <Field id="income-start" label="First Month" type="month" value={draft.startMonth} onChange={startMonth => set({ startMonth })} />
      <Field id="income-end" label="Last Month (optional)" type="month" value={draft.endMonth} onChange={endMonth => set({ endMonth })} />
      {draft.error && <p className="field-error" role="alert">{draft.error}</p>}
      <div className="inline-actions">
        <button type="button" className="button-small button-small-primary" aria-disabled={blocked || undefined} onClick={onSave}>{saving ? 'Saving…' : 'Save Income'}</button>
        <button type="button" className="button-small" onClick={onCancel}>Cancel</button>
      </div>
    </div>
  )
}
