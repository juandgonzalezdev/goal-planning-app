import { useEffect, useRef, useState } from 'react'
import { useUnsavedChanges } from '../../app/unsavedChanges'
import { useWriteBlocked, useWriteStatus } from '../../app/writeStatus'
import { Icon } from '../../components/Icon'
import { summarizeMoney } from '../../domain/finance/moneyAccounts'
import { MONEY_KINDS } from '../../ui/chartColors'
import { useAllAmounts } from '../../ui/amountVisibility'
import { isKept, outcomeText } from '../../ui/saveOutcome'
import { AccountForm } from '../money/AccountForm'
import { accountFormTitle, accountTypedFields, newAccountDraft, prepareAccountSave, type AccountDraft } from '../money/accountDraft'
import { Amount } from './Amount'
import type { StageProps } from './stageProps'

/**
 * Accounts & Savings inside Getting Started (GS-3). The form is Money's own
 * (GS-2: `AccountForm` and `accountDraft.ts`); this stage is its host, as
 * Accounts & Savings is in Money: it keeps the draft, registers it as a
 * form with unsaved changes, saves it on the revision it was opened on and
 * says what happened. After a save the user stays here, sees the account in
 * the list and can add another.
 */
export function AccountsStage({ data, today, owner, newId, onChange }: StageProps) {
  const [draft, setDraft] = useState<AccountDraft | null>(null)
  const { revision } = useWriteStatus()
  const blocked = useWriteBlocked()
  const [base, setBase] = useState(revision)
  const [sending, setSending] = useState(false)
  const [message, setMessage] = useState('')
  useUnsavedChanges(accountFormTitle(draft), accountTypedFields(draft))
  const focus = useRef<string | null>(null)
  useEffect(() => {
    if (!focus.current) return
    document.getElementById(focus.current)?.focus()
    focus.current = null
  })
  const { items } = summarizeMoney(data)
  // Hide amounts (the header eye) covers these balances, as in Bills and History: the mask on screen, "amount hidden" for screen readers.
  const amounts = useAllAmounts(data.space.currency)

  const start = () => {
    setBase(revision)
    setDraft(newAccountDraft(today))
    setMessage('')
    focus.current = 'account-name'
  }
  const save = async () => {
    if (!draft || sending) return
    const prepared = prepareAccountSave(data, draft, { today, owner, newId })
    if ('error' in prepared) { setDraft({ ...draft, error: prepared.error }); return }
    setSending(true)
    const outcome = await onChange(current => prepared.apply(current) ?? current, base).finally(() => setSending(false))
    if (outcome === 'stale') return
    setMessage(outcomeText('Account saved.', outcome))
    // Not kept: the form stays as typed; the message says why.
    if (isKept(outcome)) { setDraft(null); focus.current = 'gs-add-account' }
  }
  const cancel = () => { setDraft(null); focus.current = 'gs-add-account' }

  return (
    <div className="gs-records">
      {items.length === 0
        ? <p className="muted-note">No accounts yet.</p>
        : <ul className="gs-list" aria-label="Your accounts">
          {items.map(({ account, balance }) => (
            <li key={account.id}>
              <span><span className="item-name">{account.name}</span><small>{MONEY_KINDS[account.kind].label}</small></span>
              <b>{balance === null ? 'Not entered' : <Amount text={amounts.money(balance)} spoken={amounts.spoken(balance)} hidden={amounts.hidden} />}</b>
            </li>
          ))}
        </ul>}
      <p className="muted-note" role="status">{message}</p>
      {draft
        ? <AccountForm draft={draft} onDraftChange={setDraft} currency={data.space.currency} today={today} saving={sending} blocked={blocked}
          onSave={() => void save()} onCancel={cancel} />
        : <button id="gs-add-account" type="button" className="button-small align-start" onClick={start}>
          <Icon name="plus" size={16} /> {items.length === 0 ? 'Add Account' : 'Add Another Account'}
        </button>}
    </div>
  )
}
