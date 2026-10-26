import { useState } from 'react'
import { Field } from '../../components/Field'
import { Icon } from '../../components/Icon'
import { recordBalance } from '../../domain/finance/debts'
import { deleteAccount, saveAccount, summarizeMoney } from '../../domain/finance/moneyAccounts'
import { MONEY_ACCOUNT_KINDS, type Id, type MoneyAccountKind } from '../../domain/finance/types'
import { MONEY_KINDS } from '../../ui/chartColors'
import { formatAmount, formatDate } from '../../ui/format'
import { amountText } from '../../ui/labels'
import { parseMoneyInput } from '../../ui/moneyInput'
import type { SectionProps } from './DataScreen'

type AccountForm = { id: Id | null; name: string; kind: MoneyAccountKind; balance: string; asOf: string; error?: string }

/** Accounts and their dated balances: add, rename, update a balance or delete. */
export function AccountsSection({ data, today, owner, newId, onChange, say }: SectionProps) {
  const money = (minor: number) => formatAmount(minor, data.space.currency)
  const { items } = summarizeMoney(data)
  const [form, setForm] = useState<AccountForm | null>(null)
  const [balanceFor, setBalanceFor] = useState<{ id: Id; amount: string; asOf: string; error?: string } | null>(null)

  const saveForm = () => {
    if (!form) return
    const balance = form.balance.trim() === '' ? null : parseMoneyInput(form.balance)
    if (form.id === null && form.balance.trim() !== '' && balance === null) { setForm({ ...form, error: 'Enter a balance such as 820, or leave it empty.' }); return }
    if (form.id === null && balance !== null && (!form.asOf || form.asOf > today)) { setForm({ ...form, error: 'Choose a balance date that is not after today.' }); return }
    const id = form.id ?? newId()
    const balanceId = newId()
    let ok = false
    const outcome = onChange(current => {
      const result = saveAccount(current, id, { kind: form.kind, name: form.name, owner: current.moneyAccounts.find(a => a.id === id)?.owner ?? owner })
      if (result.status !== 'ok') return current
      ok = true
      return form.id === null && balance !== null ? recordBalance(result.data, balanceId, id, balance, form.asOf) ?? result.data : result.data
    })
    if (!ok) { setForm({ ...form, error: 'Enter a name (40 characters or fewer). A savings account used by goal movements must stay a savings account.' }); return }
    setForm(null)
    say('Account saved.', outcome)
  }

  const saveBalance = () => {
    if (!balanceFor) return
    const amount = parseMoneyInput(balanceFor.amount)
    if (amount === null) { setBalanceFor({ ...balanceFor, error: 'Enter a balance such as 820 or 0.' }); return }
    if (!balanceFor.asOf || balanceFor.asOf > today) { setBalanceFor({ ...balanceFor, error: 'Choose a date that is not after today.' }); return }
    const id = newId()
    const outcome = onChange(current => recordBalance(current, id, balanceFor.id, amount, balanceFor.asOf) ?? current)
    setBalanceFor(null)
    say('Balance updated.', outcome)
  }

  return (
    <section className="block" aria-labelledby="data-accounts">
      <div className="section-head">
        <h2 id="data-accounts" className="section-title">Accounts &amp; Balances</h2>
        <button type="button" className="button-small" onClick={() => setForm({ id: null, name: '', kind: 'savings', balance: '', asOf: today })}><Icon name="plus" size={16} /> Add Account</button>
      </div>
      <p className="field-help">Balances you read in your bank or count yourself, with their date. A new balance keeps the old one in History.</p>
      {form && (
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
            <button type="button" className="button-small button-small-primary" onClick={saveForm}>Save Account</button>
            <button type="button" className="button-small" onClick={() => setForm(null)}>Cancel</button>
          </div>
        </div>
      )}
      {items.length === 0 && !form && <p className="muted-note">No accounts yet.</p>}
      <ul className="line-list">
        {items.map(({ account, balance, asOf }) => (
          <li key={account.id} className="record">
            <div className="line">
              <span>{account.name}<small>{MONEY_KINDS[account.kind].label} · {asOf ? `as of ${formatDate(asOf)}` : 'balance not entered'}</small></span>
              <b>{balance === null ? 'Not entered' : money(balance)}</b>
            </div>
            {balanceFor?.id === account.id
              ? <div className="form-stack edit-box">
                <Field id="account-new-balance" label={`New Balance of ${account.name} (${data.space.currency})`} inputMode="decimal" value={balanceFor.amount}
                  onChange={amount => setBalanceFor({ ...balanceFor, amount, error: undefined })} error={balanceFor.error} />
                <Field id="account-new-date" label="Balance Date" type="date" max={today} value={balanceFor.asOf} onChange={value => setBalanceFor({ ...balanceFor, asOf: value, error: undefined })} />
                <div className="inline-actions">
                  <button type="button" className="button-small button-small-primary" onClick={saveBalance}>Save Balance</button>
                  <button type="button" className="button-small" onClick={() => setBalanceFor(null)}>Cancel</button>
                </div>
              </div>
              : <div className="inline-actions">
                <button type="button" className="text-button" aria-label={`Update ${account.name} balance`} onClick={() => setBalanceFor({ id: account.id, amount: amountText(balance), asOf: today })}>Update Balance</button>
                <button type="button" className="text-button" aria-label={`Edit ${account.name}`} onClick={() => setForm({ id: account.id, name: account.name, kind: account.kind, balance: '', asOf: today })}>Edit</button>
                <button type="button" className="text-button" aria-label={`Delete ${account.name}`} onClick={() => {
                  let refused = false
                  const outcome = onChange(current => { const next = deleteAccount(current, account.id); refused = next === null; return next ?? current })
                  if (refused) say(`${account.name} has goal movements, so it stays. You can set its balance instead.`, outcome)
                  else say(`${account.name} deleted.`, outcome)
                }}>Delete</button>
              </div>}
          </li>
        ))}
      </ul>
    </section>
  )
}
