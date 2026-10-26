import { useRef, useState, type ChangeEvent } from 'react'
import { Field } from '../components/Field'
import { amountText } from '../ui/labels'
import { Icon } from '../components/Icon'
import { exportFinanceData, importFinanceData } from '../data/exchange'
import type { YearMonth } from '../domain/calendar'
import { usualAmountFor } from '../domain/finance/bills'
import { recordBalance, summarizeDebts } from '../domain/finance/debts'
import { createEmergencyFund, emergencyFund, goalSaved } from '../domain/finance/goals'
import { deleteIncomeSource, monthIncome, recordIncomeReceived, saveIncomeSource } from '../domain/finance/income'
import { deleteAccount, saveAccount, summarizeMoney } from '../domain/finance/moneyAccounts'
import { MONEY_ACCOUNT_KINDS, type FinanceData, type Id, type IncomeSource, type MoneyAccountKind, type Owner } from '../domain/finance/types'
import type { CalendarDate } from '../domain/goalTime'
import { MONEY_KINDS } from '../ui/chartColors'
import { formatAmount, formatDate, formatDueDay, formatYearMonth } from '../ui/format'
import { parseMoneyInput } from '../ui/moneyInput'
import { outcomeText, type SaveOutcome } from '../ui/saveOutcome'

type Props = {
  data: FinanceData
  isDemo: boolean
  months: YearMonth[]
  month: YearMonth
  today: CalendarDate
  owner: Owner
  newId: () => string
  onChange: (change: (data: FinanceData) => FinanceData) => SaveOutcome
  onReplace: (data: FinanceData) => SaveOutcome
  onOpenBill: (id: Id | null) => void
  onOpenDebt: (id: Id | null) => void
  onOpenGoal: (id: Id) => void
  onAddGoal: () => void
  onResetDemo: () => void
}

/**
 * Manage Your Data: the one place to see and edit every record: income
 * and pay days, bills, cards and loans, account balances and goals. Home,
 * Bills and Cards open these same records, so a change made anywhere
 * shows everywhere. Export and import stay at the end.
 */
export function DataScreen(props: Props) {
  const { data, isDemo } = props
  const [message, setMessage] = useState('')
  const say = (done: string, outcome: SaveOutcome) => setMessage(outcomeText(done, outcome))
  return (
    <div className="tab-screen">
      <h1 className="tab-title">Manage Your Data</h1>
      <p className="muted-note">
        {isDemo
          ? 'Demo: Alex is invented. Change anything to try it out; nothing here is saved, and your own space is never touched.'
          : 'Everything you enter is saved on this device only. No bank is connected.'}
      </p>
      <p className="muted-note" role="status">{message}</p>
      <IncomeSection {...props} say={say} />
      <BillsSection {...props} />
      <DebtsSection {...props} />
      <AccountsSection {...props} say={say} />
      <GoalsSection {...props} say={say} />
      {isDemo && (
        <section className="block" aria-labelledby="data-demo">
          <h2 id="data-demo" className="section-title">Demo</h2>
          <p className="field-help">Put Alex’s original example back. Only the demo changes.</p>
          <button type="button" className="button-secondary" onClick={() => { props.onResetDemo(); setMessage('The demo is back to the original example.') }}>Reset Demo</button>
        </section>
      )}
      <ExchangeSection data={data} isDemo={isDemo} onReplace={props.onReplace} />
    </div>
  )
}

type SectionProps = Props & { say: (done: string, outcome: SaveOutcome) => void }

function IncomeSection({ data, months, today, owner, newId, onChange, say }: SectionProps) {
  const money = (minor: number) => formatAmount(minor, data.space.currency)
  const [editing, setEditing] = useState<{ id: Id | null; name: string; amount: string; payDay: string; startMonth: string; endMonth: string; error?: string } | null>(null)
  const [receiving, setReceiving] = useState<{ sourceId: Id; month: YearMonth; amount: string; date: string; error?: string } | null>(null)

  const saveSource = () => {
    if (!editing) return
    const amount = parseMoneyInput(editing.amount)
    const payDay = /^\d{1,2}$/.test(editing.payDay.trim()) ? Number(editing.payDay) : NaN
    if (amount === null) { setEditing({ ...editing, error: 'Enter the usual net amount, such as 6500.' }); return }
    const id = editing.id ?? newId()
    const memberId = data.incomeSources.find(s => s.id === id)?.memberId ?? (owner === 'shared' ? data.space.members[0].id : owner)
    let ok = false
    const outcome = onChange(current => {
      const result = saveIncomeSource(current, id, memberId, { name: editing.name, amount, payDay, startMonth: editing.startMonth, endMonth: editing.endMonth || null })
      ok = result.status === 'ok'
      return result.status === 'ok' ? result.data : current
    })
    if (!ok) { setEditing({ ...editing, error: 'Check the name, the pay day (1 to 31) and the months.' }); return }
    setEditing(null)
    say('Income saved.', outcome)
  }

  const saveReceived = (source: IncomeSource) => {
    if (!receiving) return
    const amount = parseMoneyInput(receiving.amount)
    if (amount === null) { setReceiving({ ...receiving, error: 'Enter the amount that arrived.' }); return }
    if (!receiving.date || receiving.date > today) { setReceiving({ ...receiving, error: 'Choose a date that is not after today.' }); return }
    const id = newId()
    const outcome = onChange(current => recordIncomeReceived(current, source, receiving.month, { id, amount, receivedOn: receiving.date }) ?? current)
    setReceiving(null)
    say(`Income for ${formatYearMonth(receiving.month)} recorded.`, outcome)
  }

  return (
    <section className="block" aria-labelledby="data-income">
      <div className="section-head">
        <h2 id="data-income" className="section-title">Income</h2>
        <button type="button" className="button-small" onClick={() => setEditing({ id: null, name: '', amount: '', payDay: '', startMonth: months[0], endMonth: '' })}><Icon name="plus" size={16} /> Add Income</button>
      </div>
      <p className="field-help">Expected income is a plan. Home shows it as expected until you record what arrived.</p>
      {data.incomeSources.length === 0 && !editing && <p className="muted-note">No income entered yet.</p>}
      {editing && (
        <div className="form-stack edit-box">
          <Field id="income-name" label="Name" value={editing.name} onChange={name => setEditing({ ...editing, name, error: undefined })} maxLength={60} />
          <Field id="income-amount" label={`Usual Net Amount per Month (${data.space.currency})`} inputMode="decimal" value={editing.amount} onChange={amount => setEditing({ ...editing, amount, error: undefined })} />
          <Field id="income-day" label="Pay Day" inputMode="numeric" value={editing.payDay} onChange={payDay => setEditing({ ...editing, payDay, error: undefined })} help="Day of the month it usually arrives." />
          <Field id="income-start" label="First Month" type="month" value={editing.startMonth} onChange={startMonth => setEditing({ ...editing, startMonth })} />
          <Field id="income-end" label="Last Month (optional)" type="month" value={editing.endMonth} onChange={endMonth => setEditing({ ...editing, endMonth })} />
          {editing.error && <p className="field-error" role="alert">{editing.error}</p>}
          <div className="inline-actions">
            <button type="button" className="button-small button-small-primary" onClick={saveSource}>Save Income</button>
            <button type="button" className="button-small" onClick={() => setEditing(null)}>Cancel</button>
          </div>
        </div>
      )}
      {data.incomeSources.map(source => (
        <div key={source.id} className="record">
          <div className="bill-line"><b>{source.name}</b><b>{money(source.amount)}</b></div>
          <small className="muted-note">Pay day {source.payDay} · from {formatYearMonth(source.startMonth)}{source.endMonth ? ` to ${formatYearMonth(source.endMonth)}` : ''}</small>
          <ul className="line-list">
            {months.map(m => {
              const line = monthIncome(data, m).lines.find(l => l.source?.id === source.id)
              if (!line) return null
              const isOpen = receiving?.sourceId === source.id && receiving.month === m
              return (
                <li key={m}>
                  <div className="line">
                    <span>{formatYearMonth(m)}<small>{line.received ? `Received on ${formatDate(line.received.receivedOn)}` : `Expected on ${formatDate(line.payDate!)}`}</small></span>
                    <b>{line.received ? money(line.received.amount) : `${money(line.expected ?? 0)} expected`}</b>
                  </div>
                  {!isOpen
                    ? <div className="inline-actions">
                      <button type="button" className="text-button" aria-label={`Record ${source.name} received in ${formatYearMonth(m)}`}
                        onClick={() => setReceiving({ sourceId: source.id, month: m, amount: amountText(line.received?.amount ?? source.amount), date: line.received?.receivedOn ?? (line.payDate! <= today ? line.payDate! : today) })}>
                        {line.received ? 'Change' : 'Record Received'}
                      </button>
                      {line.received && <button type="button" className="text-button" onClick={() => say(`${formatYearMonth(m)} is expected again.`, onChange(current => recordIncomeReceived(current, source, m, null) ?? current))}>Not Received</button>}
                    </div>
                    : <div className="form-stack edit-box">
                      <Field id="received-amount" label={`Amount Received (${data.space.currency})`} inputMode="decimal" value={receiving.amount} onChange={amount => setReceiving({ ...receiving, amount, error: undefined })} error={receiving.error} />
                      <Field id="received-date" label="Date Received" type="date" max={today} value={receiving.date} onChange={date => setReceiving({ ...receiving, date, error: undefined })} />
                      <div className="inline-actions">
                        <button type="button" className="button-small button-small-primary" onClick={() => saveReceived(source)}>Save</button>
                        <button type="button" className="button-small" onClick={() => setReceiving(null)}>Cancel</button>
                      </div>
                    </div>}
                </li>
              )
            })}
          </ul>
          <div className="inline-actions">
            <button type="button" className="text-button" onClick={() => setEditing({ id: source.id, name: source.name, amount: amountText(source.amount), payDay: String(source.payDay), startMonth: source.startMonth, endMonth: source.endMonth ?? '' })}>Edit {source.name}</button>
            <button type="button" className="text-button" onClick={() => say(`${source.name} removed. Income already received stays.`, onChange(current => deleteIncomeSource(current, source.id)))}>Remove</button>
          </div>
        </div>
      ))}
    </section>
  )
}

function BillsSection({ data, month, onOpenBill }: Props) {
  const money = (minor: number) => formatAmount(minor, data.space.currency)
  return (
    <section className="block" aria-labelledby="data-bills">
      <div className="section-head">
        <h2 id="data-bills" className="section-title">Bills</h2>
        <button type="button" className="button-small" onClick={() => onOpenBill(null)}><Icon name="plus" size={16} /> Add Bill</button>
      </div>
      {data.bills.length === 0 ? <p className="muted-note">No bills yet.</p> : (
        <ul className="line-list">
          {data.bills.map(bill => {
            const usual = usualAmountFor(bill, month)
            return (
              <li key={bill.id}>
                <button type="button" className="line line-button" onClick={() => onOpenBill(bill.id)}>
                  <span>{bill.name}<small>{bill.category} · {formatDueDay(bill.dueDay)}</small></span>
                  <b>{usual === null ? 'Amount needed' : money(usual)}</b>
                  <Icon name="arrowRight" size={16} />
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}

function DebtsSection({ data, onOpenDebt }: Props) {
  const money = (minor: number) => formatAmount(minor, data.space.currency)
  const { items } = summarizeDebts(data)
  return (
    <section className="block" aria-labelledby="data-debts">
      <div className="section-head">
        <h2 id="data-debts" className="section-title">Cards &amp; Loans</h2>
        <button type="button" className="button-small" onClick={() => onOpenDebt(null)}><Icon name="plus" size={16} /> Add</button>
      </div>
      {items.length === 0 ? <p className="muted-note">No cards or loans yet.</p> : (
        <ul className="line-list">
          {items.map(({ debt, balance, asOf }) => (
            <li key={debt.id}>
              <button type="button" className="line line-button" onClick={() => onOpenDebt(debt.id)}>
                <span>{debt.name}<small>{asOf ? `Remaining Balance as of ${formatDate(asOf)}` : 'Balance not entered'}</small></span>
                <b>{balance === null ? 'Balance needed' : money(balance)}</b>
                <Icon name="arrowRight" size={16} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

type AccountForm = { id: Id | null; name: string; kind: MoneyAccountKind; balance: string; asOf: string; error?: string }

function AccountsSection({ data, today, owner, newId, onChange, say }: SectionProps) {
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

function GoalsSection({ data, today, owner, newId, onChange, onOpenGoal, onAddGoal, say }: SectionProps) {
  const money = (minor: number) => formatAmount(minor, data.space.currency)
  const pots = data.goals.filter(goal => goal.status === 'active')
  const hasEmergency = emergencyFund(data.goals) !== null
  return (
    <section className="block" aria-labelledby="data-goals">
      <div className="section-head">
        <h2 id="data-goals" className="section-title">Goals &amp; Emergency Fund</h2>
        <button type="button" className="button-small" onClick={onAddGoal}><Icon name="plus" size={16} /> Add Goal</button>
      </div>
      {pots.length === 0 ? <p className="muted-note">No goals yet.</p> : (
        <ul className="line-list">
          {pots.map(goal => (
            <li key={goal.id}>
              <button type="button" className="line line-button" onClick={() => onOpenGoal(goal.id)}>
                <span>{goal.name}<small>{goal.kind === 'emergency' ? 'Emergency Fund' : goal.deadline ? `With Date · ${formatDate(goal.deadline)}` : 'Flexible'}</small></span>
                <b>{money(goalSaved(goal, data.goalMovements))}{goal.target !== null && ` of ${money(goal.target)}`}</b>
                <Icon name="arrowRight" size={16} />
              </button>
            </li>
          ))}
        </ul>
      )}
      {!hasEmergency && (
        <button type="button" className="button-small align-start" onClick={() => say('Emergency Fund added, starting at 0.', onChange(current => createEmergencyFund(current, newId(), owner, today)))}>
          Add Emergency Fund
        </button>
      )}
      <p className="field-help">Goals and the Emergency Fund are purposes for part of your Savings.</p>
    </section>
  )
}

/** Export and import a data file. Importing never replaces anything until the user confirms. */
function ExchangeSection({ data, isDemo, onReplace }: { data: FinanceData; isDemo: boolean; onReplace: (data: FinanceData) => SaveOutcome }) {
  const [pending, setPending] = useState<FinanceData | null>(null)
  const [errors, setErrors] = useState<string[]>([])
  const [done, setDone] = useState('')
  const fileInput = useRef<HTMLInputElement>(null)

  const download = () => {
    const blob = new Blob([exportFinanceData(data)], { type: 'application/json' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = 'goal-planning-data.json'
    link.click()
    URL.revokeObjectURL(link.href)
  }

  const readFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    setDone('')
    if (!file) return
    const result = importFinanceData(await file.text())
    if (result.status === 'imported') { setErrors([]); setPending(result.data) }
    else { setPending(null); setErrors(result.errors) }
  }

  return <>
    <section className="block">
      <h2 className="section-title">Export</h2>
      <p className="field-help">Download everything in this space as a JSON file.</p>
      <button type="button" className="button-secondary" onClick={download}>Export JSON</button>
    </section>

    <section className="block">
      <h2 className="section-title">Import</h2>
      {isDemo ? (
        <p className="field-help">Exit the demo to import your own data. Demo information and your own space are never mixed.</p>
      ) : <>
        <p className="field-help">Replace this space with a JSON file. The file is checked first, and nothing changes until you confirm.</p>
        <label className="form-field">Choose a JSON file
          <input ref={fileInput} type="file" accept="application/json,.json" onChange={readFile} />
        </label>
        {errors.length > 0 && (
          <div className="callout callout-warning" role="alert">
            <p>This file cannot be used. Nothing was changed.</p>
            <ul>{errors.slice(0, 5).map(error => <li key={error}>{error}</li>)}</ul>
            {errors.length > 5 && <p>And {errors.length - 5} more problems.</p>}
          </div>
        )}
        {pending && (
          <div className="callout" role="alert">
            <p>Replace everything in this space with “{pending.space.name}” from the file? This cannot be undone. Export first if you want a copy.</p>
            <div className="inline-actions">
              <button type="button" className="button-small button-small-primary" onClick={() => { setDone(outcomeText('Your space was replaced with the file.', onReplace(pending))); setPending(null) }}>Replace</button>
              <button type="button" className="button-small" onClick={() => setPending(null)}>Cancel</button>
            </div>
          </div>
        )}
        {done && <p className="muted-note" role="status">{done}</p>}
      </>}
    </section>
  </>
}
