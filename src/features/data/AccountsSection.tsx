import { useContext, useEffect, useRef, useState } from 'react'
import { Field } from '../../components/Field'
import { Icon } from '../../components/Icon'
import { recordBalance } from '../../domain/finance/debts'
import { deleteAccount, saveAccount, summarizeMoney } from '../../domain/finance/moneyAccounts'
import { MONEY_ACCOUNT_KINDS, type FinanceData, type Id, type MoneyAccountKind } from '../../domain/finance/types'
import { MONEY_KINDS } from '../../ui/chartColors'
import { formatAmount, formatDate } from '../../ui/format'
import { amountText } from '../../ui/labels'
import { parseMoneyInput } from '../../ui/moneyInput'
import { DataBlockFrame } from './DataBlockFrame'
import { DataBlocksContext, setBlockOpen } from './dataBlocks'
import type { SectionProps } from './DataScreen'
import { useWriteBlocked, useWriteStatus } from '../../app/writeStatus'
import { isKept, type SaveOutcome } from '../../ui/saveOutcome'

type AccountForm = { id: Id | null; name: string; kind: MoneyAccountKind; balance: string; asOf: string; error?: string }

/**
 * Accounts and their dated balances in a compact list (name, kind, latest
 * balance and its date). Opening an account shows Update Balance, Edit and
 * Delete. A balance never entered stays "Not entered", never 0.
 */
export function AccountsSection({ data, today, owner, newId, onChange, say, tell }: SectionProps) {
  const money = (minor: number) => formatAmount(minor, data.space.currency)
  const { items } = summarizeMoney(data)
  const [form, setForm] = useState<AccountForm | null>(null)
  const [balanceFor, setBalanceFor] = useState<{ id: Id; amount: string; asOf: string; error?: string } | null>(null)
  const { view, onViewChange } = useContext(DataBlocksContext)
  const focusField = useRef<string | null>(null)
  const { revision } = useWriteStatus()
  const blocked = useWriteBlocked()
  // The revision each form was opened on, and which change is being saved.
  const [formBase, setFormBase] = useState(revision)
  const [balanceBase, setBalanceBase] = useState(revision)
  const [sending, setSending] = useState<'form' | 'balance' | null>(null)
  /** Saves one change and says what happened. */
  const save = async (done: string, change: (data: FinanceData) => FinanceData, base?: number, what: typeof sending = null): Promise<SaveOutcome> => {
    setSending(what)
    const outcome = await onChange(change, base).finally(() => setSending(null))
    say(done, outcome)
    return outcome
  }

  useEffect(() => {
    if (!focusField.current) return
    document.getElementById(focusField.current)?.focus()
    focusField.current = null
  })

  const startNew = () => {
    onViewChange(setBlockOpen(view, 'accounts', true))
    setFormBase(revision)
    setForm({ id: null, name: '', kind: 'savings', balance: '', asOf: today })
    focusField.current = 'account-name'
  }

  const saveForm = async () => {
    if (!form) return
    const balance = form.balance.trim() === '' ? null : parseMoneyInput(form.balance)
    if (form.id === null && form.balance.trim() !== '' && balance === null) { setForm({ ...form, error: 'Enter a balance such as 820, or leave it empty.' }); return }
    if (form.id === null && balance !== null && (!form.asOf || form.asOf > today)) { setForm({ ...form, error: 'Choose a balance date that is not after today.' }); return }
    const id = form.id ?? newId()
    const balanceId = newId()
    const { kind, name, asOf } = form
    const apply = (current: FinanceData) => {
      const result = saveAccount(current, id, { kind, name, owner: current.moneyAccounts.find(a => a.id === id)?.owner ?? owner })
      if (result.status !== 'ok') return null
      return form.id === null && balance !== null ? recordBalance(result.data, balanceId, id, balance, asOf) ?? result.data : result.data
    }
    if (!apply(data)) { setForm({ ...form, error: 'Enter a name (40 characters or fewer). A savings account used by goal movements must stay a savings account.' }); return }
    const outcome = await save('Account saved.', current => apply(current) ?? current, formBase, 'form')
    // Not kept: the form stays as typed; the message says why.
    if (isKept(outcome)) setForm(null)
  }

  const saveBalance = async () => {
    if (!balanceFor) return
    const amount = parseMoneyInput(balanceFor.amount)
    if (amount === null) { setBalanceFor({ ...balanceFor, error: 'Enter a balance such as 820 or 0.' }); return }
    if (!balanceFor.asOf || balanceFor.asOf > today) { setBalanceFor({ ...balanceFor, error: 'Choose a date that is not after today.' }); return }
    const id = newId()
    const { id: accountId, asOf } = balanceFor
    const outcome = await save('Balance updated.', current => recordBalance(current, id, accountId, amount, asOf) ?? current, balanceBase, 'balance')
    if (isKept(outcome)) setBalanceFor(null)
  }

  const formBox = form && (
    <div className="form-stack edit-box">
      <Field id="account-name" label="Account Name" value={form.name} onChange={name => setForm({ ...form, name, error: undefined })} maxLength={60} />
      <div className="form-field">
        <label htmlFor="account-kind">Kind</label>
        <select id="account-kind" value={form.kind} onChange={e => setForm({ ...form, kind: e.target.value as MoneyAccountKind })}>
          {MONEY_ACCOUNT_KINDS.map(kind => <option key={kind} value={kind}>{MONEY_KINDS[kind].label}</option>)}
        </select>
      </div>
      {form.id === null && <>
        <Field id="account-balance" label={`Balance (${data.space.currency}, optional)`} inputMode="decimal" value={form.balance} onChange={balance => setForm({ ...form, balance, error: undefined })}
          help="Leave it empty if you don’t know it yet: it shows as not entered, not as 0." />
        <Field id="account-date" label="Balance Date" type="date" max={today} value={form.asOf} onChange={asOf => setForm({ ...form, asOf, error: undefined })} />
      </>}
      {form.error && <p className="field-error" role="alert">{form.error}</p>}
      <div className="inline-actions">
        <button type="button" className="button-small button-small-primary" aria-disabled={blocked || undefined} onClick={() => void saveForm()}>{sending === 'form' ? 'Saving…' : 'Save Account'}</button>
        <button type="button" className="button-small" onClick={() => setForm(null)}>Cancel</button>
      </div>
    </div>
  )
  const missing = items.filter(item => item.balance === null).length
  const summary = items.length === 0 ? 'No accounts yet'
    : [`${items.length} ${items.length === 1 ? 'account' : 'accounts'}`, ...(missing > 0 ? [`${missing} without a balance`] : [])].join(' · ')

  return (
    <DataBlockFrame block="accounts" summary={summary}
      actions={<button type="button" className="button-small" onClick={startNew}><Icon name="plus" size={16} /> Add Account</button>}>
      <p className="field-help">Balances you read in your bank or count yourself, with their date. A new balance keeps the old one in History.</p>
      {form?.id === null && formBox}
      {items.length === 0 && !form && (
        <div className="empty-state">
          <p className="muted-note">No accounts yet. Add the account you spend from, and any savings or investments.</p>
          <button type="button" className="button-small align-start" onClick={startNew}><Icon name="plus" size={16} /> Add Your First Account</button>
        </div>
      )}
      <ul className="line-list compact-list">
        {items.map(({ account, balance, asOf }) => {
          const open = view.account === account.id
          const detailId = `account-${account.id}`
          return (
            <li key={account.id} className={`compact-item${open ? ' is-open' : ''}`}>
              <button type="button" className="line line-button" aria-expanded={open} aria-controls={open ? detailId : undefined}
                onClick={() => onViewChange({ ...view, account: open ? null : account.id })}>
                <span>
                  <span className="item-name">{account.name}</span>
                  <small>{MONEY_KINDS[account.kind].label} · {asOf ? `as of ${formatDate(asOf)}` : 'balance not entered'}</small>
                </span>
                <b>{balance === null ? 'Not entered' : money(balance)}</b>
                <span className="item-chevron"><Icon name="chevronDown" size={16} /></span>
              </button>
              {open && (
                <div id={detailId} className="item-detail">
                  {balanceFor?.id === account.id
                    ? <div className="form-stack edit-box">
                      <Field id="account-new-balance" label={`New Balance of ${account.name} (${data.space.currency})`} inputMode="decimal" value={balanceFor.amount}
                        onChange={amount => setBalanceFor({ ...balanceFor, amount, error: undefined })} error={balanceFor.error} />
                      <Field id="account-new-date" label="Balance Date" type="date" max={today} value={balanceFor.asOf} onChange={value => setBalanceFor({ ...balanceFor, asOf: value, error: undefined })} />
                      <div className="inline-actions">
                        <button type="button" className="button-small button-small-primary" aria-disabled={blocked || undefined} onClick={() => void saveBalance()}>{sending === 'balance' ? 'Saving…' : 'Save Balance'}</button>
                        <button type="button" className="button-small" onClick={() => setBalanceFor(null)}>Cancel</button>
                      </div>
                    </div>
                    : form?.id === account.id ? formBox
                    : <div className="inline-actions">
                      <button type="button" className="button-small" aria-label={`Update Balance: ${account.name}`} onClick={() => {
                        setBalanceBase(revision)
                        setBalanceFor({ id: account.id, amount: amountText(balance), asOf: today })
                        focusField.current = 'account-new-balance'
                      }}>Update Balance</button>
                      <button type="button" className="button-small" aria-label={`Edit: ${account.name}`} onClick={() => {
                        setFormBase(revision)
                        setForm({ id: account.id, name: account.name, kind: account.kind, balance: '', asOf: today })
                        focusField.current = 'account-name'
                      }}>Edit</button>
                      <button type="button" className="button-small" aria-label={`Delete: ${account.name}`} aria-disabled={blocked || undefined} onClick={() => {
                        if (deleteAccount(data, account.id) === null) { tell(`${account.name} has goal movements, so it stays. You can set its balance instead.`); return }
                        void save(`${account.name} deleted.`, current => deleteAccount(current, account.id) ?? current)
                      }}>Delete</button>
                    </div>}
                </div>
              )}
            </li>
          )
        })}
      </ul>
    </DataBlockFrame>
  )
}
