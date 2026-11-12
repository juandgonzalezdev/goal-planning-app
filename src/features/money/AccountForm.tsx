import { Field } from '../../components/Field'
import { MONEY_ACCOUNT_KINDS, type MoneyAccountKind } from '../../domain/finance/types'
import type { CurrencyCode } from '../../domain/money'
import { MONEY_KINDS } from '../../ui/chartColors'
import type { AccountDraft } from './accountDraft'

type Props = {
  draft: AccountDraft
  onDraftChange: (draft: AccountDraft) => void
  currency: CurrencyCode
  today: string
  /** This form is being saved: Save says so. */
  saving: boolean
  /** Saving is blocked (another tab, a pending write): Save is marked as unavailable. */
  blocked: boolean
  onSave: () => void
  onCancel: () => void
}

/** The fields and buttons, exactly as Money showed them. Typing clears the message; Kind does not. */
export function AccountForm({ draft, onDraftChange, currency, today, saving, blocked, onSave, onCancel }: Props) {
  const set = (change: Partial<AccountDraft>) => onDraftChange({ ...draft, ...change })
  return (
    <div className="form-stack edit-box">
      <Field id="account-name" label="Account Name" value={draft.name} onChange={name => set({ name, error: undefined })} maxLength={60} />
      <div className="form-field">
        <label htmlFor="account-kind">Kind</label>
        <select id="account-kind" value={draft.kind} onChange={e => set({ kind: e.target.value as MoneyAccountKind })}>
          {MONEY_ACCOUNT_KINDS.map(kind => <option key={kind} value={kind}>{MONEY_KINDS[kind].label}</option>)}
        </select>
      </div>
      {draft.id === null && <>
        <Field id="account-balance" label={`Balance (${currency}, optional)`} inputMode="decimal" value={draft.balance} onChange={balance => set({ balance, error: undefined })}
          help="Leave it empty if you don’t know it yet: it shows as not entered, not as 0." />
        <Field id="account-date" label="Balance Date" type="date" max={today} value={draft.asOf} onChange={asOf => set({ asOf, error: undefined })} />
      </>}
      {draft.error && <p className="field-error" role="alert">{draft.error}</p>}
      <div className="inline-actions">
        <button type="button" className="button-small button-small-primary" aria-disabled={blocked || undefined} onClick={onSave}>{saving ? 'Saving…' : 'Save Account'}</button>
        <button type="button" className="button-small" onClick={onCancel}>Cancel</button>
      </div>
    </div>
  )
}
