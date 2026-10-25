import { useState } from 'react'
import { Field } from '../../components/Field'
import { Icon } from '../../components/Icon'
import type { YearMonth } from '../../domain/calendar'
import { balanceHistory } from '../../domain/finance/balances'
import { debtPayment, deleteDebt, estimateDebtPayoff, recordBalance, summarizeDebts } from '../../domain/finance/debts'
import type { FinanceData, Id, Owner } from '../../domain/finance/types'
import type { CalendarDate } from '../../domain/goalTime'
import { compareExtraPayments } from '../../domain/loanPayoff'
import { formatAmount, formatDate, formatDueDay, formatRate, formatYearMonth } from '../../ui/format'
import { parseMoneyInput } from '../../ui/moneyInput'
import { outcomeText, type SaveOutcome } from '../../ui/saveOutcome'
import { amountText, DEBT_KIND_NAMES } from '../../ui/labels'
import { applyDebtForm, draftFromDebt, emptyDebtDraft, readDebtDraft, type DebtDraft, type DebtDraftErrors } from './debtDraft'

type Props = {
  data: FinanceData
  /** null: adding a new card or loan. */
  debtId: Id | null
  month: YearMonth
  today: CalendarDate
  owner: Owner
  newId: () => string
  onBack: () => void
  onChange: (change: (data: FinanceData) => FinanceData) => SaveOutcome
  onCreated: (id: Id) => void
  onDeleted: () => void
  onOpenBill: (id: Id) => void
}

/**
 * One card or loan: what is still owed and on which date, the planned
 * payment, the minimum payment and the dates, each kept apart. Everything
 * can be edited here, and Home, Cards and Bills read the same records.
 */
export function DebtScreen(props: Props) {
  const { data, debtId, month, today } = props
  const debt = debtId ? data.debts.find(d => d.id === debtId) ?? null : null
  if (debtId && !debt) {
    return (
      <div className="tab-screen">
        <button type="button" className="back-link" onClick={props.onBack}><Icon name="arrowLeft" size={18} /> Back</button>
        <div className="empty-block"><p>This card or loan is no longer here.</p></div>
      </div>
    )
  }
  return debt ? <DebtDetail {...props} debtId={debt.id} /> : <DebtForm {...props} draftStart={emptyDebtDraft(month, today)} />
}

function DebtDetail(props: Props & { debtId: Id }) {
  const { data, debtId, month, today, onBack, onChange, onOpenBill } = props
  const currency = data.space.currency
  const money = (minor: number) => formatAmount(minor, currency)
  const debt = data.debts.find(d => d.id === debtId)!
  const item = summarizeDebts(data).items.find(i => i.debt.id === debtId)!
  const payment = debtPayment(data, debt, month)
  const history = balanceHistory(data.balances, debtId).reverse()
  const [editing, setEditing] = useState(false)
  const [balanceForm, setBalanceForm] = useState<{ amount: string; asOf: string; error?: string } | null>(null)
  const [deleting, setDeleting] = useState<'keep-bill' | 'delete-bill' | null>(null)
  const [message, setMessage] = useState('')

  if (editing) {
    return <DebtForm {...props} draftStart={draftFromDebt(data, debt, month, today)}
      onDone={done => { setEditing(false); if (done) setMessage(done) }} />
  }

  const saveBalance = () => {
    if (!balanceForm) return
    const amount = parseMoneyInput(balanceForm.amount)
    if (amount === null) { setBalanceForm({ ...balanceForm, error: 'Enter an amount such as 1800 or 0.' }); return }
    if (!balanceForm.asOf || balanceForm.asOf > today) { setBalanceForm({ ...balanceForm, error: 'Choose a date that is not after today.' }); return }
    const id = props.newId()
    const outcome = onChange(current => recordBalance(current, id, debtId, amount, balanceForm.asOf) ?? current)
    setBalanceForm(null)
    setMessage(outcomeText('Remaining Balance updated.', outcome))
  }

  const estimate = item.balance !== null && payment.amount !== null && payment.amount > 0
    ? estimateDebtPayoff(item.balance, debt.yearlyInterestBasisPoints, payment.amount) : null

  return (
    <div className="tab-screen">
      <button type="button" className="back-link" onClick={onBack}><Icon name="arrowLeft" size={18} /> Back</button>
      <div>
        <h1 className="tab-title">{debt.name}</h1>
        <p className="muted-note">{DEBT_KIND_NAMES[debt.kind]}</p>
      </div>

      <section className="goal-hero" aria-label="Remaining Balance">
        <span>Remaining Balance</span>
        <b className="goal-hero-saved">{item.balance === null ? 'Not entered' : money(item.balance)}</b>
        <span>{item.asOf ? `As of ${formatDate(item.asOf)}` : 'Enter the balance from your bank or statement.'}</span>
      </section>
      {!balanceForm
        ? <button type="button" className="button-small align-start" onClick={() => setBalanceForm({ amount: amountText(item.balance), asOf: today })}>Update Balance</button>
        : <section className="block" aria-label="Update Balance">
          <div className="form-stack">
            <Field id="debt-balance" label={`Remaining Balance (${currency})`} inputMode="decimal" value={balanceForm.amount}
              onChange={amount => setBalanceForm({ ...balanceForm, amount, error: undefined })} error={balanceForm.error} />
            <Field id="debt-balance-date" label="Balance Date" type="date" max={today} value={balanceForm.asOf}
              help="The day this balance was true, e.g. the date on your statement." onChange={asOf => setBalanceForm({ ...balanceForm, asOf, error: undefined })} />
          </div>
          <div className="inline-actions">
            <button type="button" className="button-small button-small-primary" onClick={saveBalance}>Save Balance</button>
            <button type="button" className="button-small" onClick={() => setBalanceForm(null)}>Cancel</button>
          </div>
          <p className="field-help">The earlier balance stays in History. Paying a bill never changes this balance by itself.</p>
        </section>}
      <p className="muted-note" role="status">{message}</p>

      <section className="block" aria-labelledby="debt-facts">
        <h2 id="debt-facts" className="section-title">Details</h2>
        <dl className="fact-rows">
          <div><dt>Type</dt><dd>{DEBT_KIND_NAMES[debt.kind]}</dd></div>
          <div><dt>Yearly Interest</dt><dd>{formatRate(debt.yearlyInterestBasisPoints)}</dd></div>
          <div><dt>Monthly Payment · {formatYearMonth(month)}</dt><dd>{payment.amount === null ? 'Not entered' : money(payment.amount)}</dd></div>
          {debt.kind === 'card' && <div><dt>Minimum Payment</dt><dd>{debt.minimumPayment === undefined ? 'Not entered' : money(debt.minimumPayment)}</dd></div>}
          <div><dt>Payment Due</dt><dd>{formatDueDay(debt.dueDay)}</dd></div>
          {debt.kind === 'card' && <div><dt>Statement Closing Day</dt><dd>{debt.closingDay ? formatDueDay(debt.closingDay) : 'Not entered'}</dd></div>}
          {debt.kind === 'loan' && <div><dt>First Payment</dt><dd>{debt.startMonth ? formatYearMonth(debt.startMonth) : 'Not entered'}</dd></div>}
          {debt.kind === 'loan' && <div><dt>Last Payment</dt><dd>{debt.finalPaymentMonth ? formatYearMonth(debt.finalPaymentMonth) : 'Not entered'}</dd></div>}
          <div><dt>Balance Date</dt><dd>{item.asOf ? formatDate(item.asOf) : 'Not entered'}</dd></div>
        </dl>
        {payment.bill
          ? <p className="field-help">The payment is the bill <button type="button" className="text-button inline-link" onClick={() => onOpenBill(payment.bill!.id)}>{payment.bill.name}</button>, counted once in Monthly Bills.</p>
          : <p className="field-help">No bill pays this {debt.kind === 'card' ? 'card' : 'loan'} yet, so its payment is not in Monthly Bills.</p>}
        {debt.kind === 'card' && <p className="field-help">The minimum payment is the amount you entered from your statement. The app does not calculate it.</p>}
        <button type="button" className="button-small align-start" onClick={() => { setEditing(true); setMessage('') }}>Edit Details</button>
      </section>

      <section className="block" aria-labelledby="debt-estimate">
        <h2 id="debt-estimate" className="section-title">Estimate</h2>
        {estimate === null
          ? <p className="muted-note">Enter the Remaining Balance and a monthly payment to see an estimate.</p>
          : estimate.status === 'estimated'
            ? <p className="pace-line">About <b>{estimate.months} {estimate.months === 1 ? 'month' : 'months'}</b> to pay it off, with about <b>{money(estimate.interest)}</b> interest.</p>
            : <p className="muted-note">{estimate.status === 'payment-too-low' ? 'This payment does not cover the monthly interest, so the balance would not go down.' : 'This would take more than 50 years.'}</p>}
        <p className="field-help">Calculated today ({formatDate(today)}) from the balance of {item.asOf ? formatDate(item.asOf) : '—'}, with the same interest and payment every month. Your bank may calculate differently.</p>
        {estimate?.status === 'estimated' && item.balance !== null && payment.amount !== null && (
          <ExtraPayments balance={item.balance} basisPoints={debt.yearlyInterestBasisPoints} payment={payment.amount} money={money} currency={currency} />
        )}
      </section>

      <section className="block" aria-labelledby="debt-delete">
        <h2 id="debt-delete" className="section-title">Delete</h2>
        {!deleting
          ? <button type="button" className="button-small align-start" onClick={() => setDeleting(payment.bill ? 'keep-bill' : 'delete-bill')}>Delete {DEBT_KIND_NAMES[debt.kind]}</button>
          : <div className="callout callout-warning" role="alert">
            <p>Delete “{debt.name}” and its balance history? This cannot be undone.</p>
            {payment.bill && (
              <fieldset className="choice-inline">
                <legend>The bill “{payment.bill.name}” pays it. What should happen to the bill?</legend>
                <label><input type="radio" name="linked-bill" checked={deleting === 'keep-bill'} onChange={() => setDeleting('keep-bill')} /> Keep the bill, without the link</label>
                <label><input type="radio" name="linked-bill" checked={deleting === 'delete-bill'} onChange={() => setDeleting('delete-bill')} /> Delete the bill and its paid months too</label>
              </fieldset>
            )}
            <div className="inline-actions">
              <button type="button" className="button-small button-small-danger" onClick={() => { onChange(current => deleteDebt(current, debtId, deleting)); props.onDeleted() }}>Delete</button>
              <button type="button" className="button-small" onClick={() => setDeleting(null)}>Cancel</button>
            </div>
          </div>}
      </section>

      {history.length > 0 && (
        <section className="block" aria-labelledby="debt-history">
          <h2 id="debt-history" className="section-title">Balance History</h2>
          <ul className="line-list">
            {history.map(snapshot => (
              <li key={snapshot.id} className="line"><span>{formatDate(snapshot.asOf)} · {snapshot.source === 'entered' ? 'Entered' : 'From a goal movement'}</span><b>{money(snapshot.amount)}</b></li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}

/** "What If I Pay Extra?": the tested Phase 1 calculator, on this debt's saved numbers. Nothing is saved. */
function ExtraPayments({ balance, basisPoints, payment, money, currency }: { balance: number; basisPoints: number; payment: number; money: (minor: number) => string; currency: string }) {
  const [extra, setExtra] = useState('')
  const extraMinor = extra.trim() === '' ? 0 : parseMoneyInput(extra)
  const comparison = extraMinor === null ? null : compareExtraPayments({
    balance: balance / 100, yearlyRate: basisPoints / 100, regularPayment: payment / 100, extraMonthly: extraMinor / 100, oneOffPayment: 0,
  })
  return (
    <div className="form-stack">
      <h3 className="section-title">What If I Pay Extra?</h3>
      <Field id="debt-extra" label={`Extra Each Month (${currency})`} inputMode="decimal" value={extra} onChange={setExtra}
        error={extraMinor === null ? 'Enter an amount such as 50.' : undefined} />
      {comparison?.status === 'compared' && (
        <dl className="fact-rows" aria-live="polite">
          <div><dt>Months Saved</dt><dd>{comparison.monthsSaved}</dd></div>
          <div><dt>Interest Saved</dt><dd>{money(Math.round(comparison.interestSaved * 100))}</dd></div>
        </dl>
      )}
      <p className="field-help">Only a calculation. Nothing changes until you edit the payment yourself.</p>
    </div>
  )
}

function DebtForm(props: Props & { draftStart: DebtDraft; onDone?: (message: string | null) => void }) {
  const { data, debtId, today, owner, newId, onBack, onChange, onCreated, draftStart, onDone } = props
  const currency = data.space.currency
  const [draft, setDraft] = useState(draftStart)
  const [errors, setErrors] = useState<DebtDraftErrors>({})
  const isNew = debtId === null
  const debt = debtId ? data.debts.find(d => d.id === debtId) ?? null : null
  const linked = debt ? debtPayment(data, debt, draft.paymentFrom).bill : null
  const set = (patch: Partial<DebtDraft>) => setDraft({ ...draft, ...patch })
  const cancel = () => (onDone ? onDone(null) : onBack())

  const save = () => {
    const read = readDebtDraft(draft, debt?.owner ?? owner, { isNew, today })
    if (read.status === 'invalid') { setErrors(read.errors); return }
    const ids = { debt: newId(), bill: newId(), balance: newId() }
    let applied = false
    const outcome = onChange(current => {
      const next = applyDebtForm(current, debtId, read.value, draft, ids)
      applied = next !== null
      return next ?? current
    })
    if (!applied) { setErrors({ name: 'This could not be saved. Check the details.' }); return }
    if (isNew) onCreated(ids.debt)
    else onDone?.(outcomeText('Details updated.', outcome))
  }

  const card = draft.kind === 'card'
  return (
    <div className="tab-screen">
      <button type="button" className="back-link" onClick={cancel}><Icon name="arrowLeft" size={18} /> {isNew ? 'Back' : 'Cancel'}</button>
      <h1 className="tab-title">{isNew ? 'Add Card or Loan' : `Edit ${debt?.name}`}</h1>
      <section className="block">
        <div className="form-stack">
          <div className="form-field">
            <label htmlFor="debt-kind">Type</label>
            <select id="debt-kind" value={draft.kind} onChange={e => set({ kind: e.target.value as DebtDraft['kind'] })}>
              <option value="loan">Loan</option>
              <option value="card">Credit Card</option>
            </select>
          </div>
          <Field id="debt-name" label="Name" value={draft.name} onChange={name => set({ name })} error={errors.name} maxLength={60} />
          {isNew && <>
            <Field id="debt-new-balance" label={`Remaining Balance (${currency})`} inputMode="decimal" value={draft.balance} onChange={balance => set({ balance })} error={errors.balance}
              help="What you still owe. Leave it empty if you don’t know it yet: it will show as not entered, not as 0." />
            <Field id="debt-new-balance-date" label="Balance Date" type="date" max={today} value={draft.balanceAsOf} onChange={balanceAsOf => set({ balanceAsOf })} error={errors.balanceAsOf} />
          </>}
          <Field id="debt-interest" label="Yearly Interest (%)" inputMode="decimal" value={draft.interest} onChange={interest => set({ interest })} error={errors.interest} />
          <Field id="debt-payment" label={`${card ? 'Planned Monthly Payment' : 'Monthly Payment'} (${currency})`} inputMode="decimal" value={draft.payment}
            onChange={payment => set({ payment })} error={errors.payment} />
          {linked
            ? <Field id="debt-payment-from" label="Payment Applies From" type="month" value={draft.paymentFrom} onChange={paymentFrom => set({ paymentFrom })} error={errors.paymentFrom}
              help={`This changes the bill “${linked.name}” from this month on. Earlier months keep their amount.`} />
            : <label className="check-line">
              <input type="checkbox" checked={draft.addBill} onChange={e => set({ addBill: e.target.checked })} />
              Add this payment to my monthly bills{draft.addBill && draft.paymentFrom ? `, from ${formatYearMonth(draft.paymentFrom)}` : ''}
            </label>}
          <Field id="debt-due" label="Payment Due Day" inputMode="numeric" value={draft.dueDay} onChange={dueDay => set({ dueDay })} error={errors.dueDay} help="Day of the month, 1 to 31." />
          {card && <>
            <Field id="debt-closing" label="Statement Closing Day (optional)" inputMode="numeric" value={draft.closingDay} onChange={closingDay => set({ closingDay })} error={errors.closingDay} />
            <Field id="debt-minimum" label={`Minimum Payment (${currency}, optional)`} inputMode="decimal" value={draft.minimumPayment} onChange={minimumPayment => set({ minimumPayment })}
              error={errors.minimumPayment} help="Type it from your statement. The app does not calculate a minimum payment." />
          </>}
          {!card && <>
            <Field id="debt-start" label="First Payment (optional)" type="month" value={draft.startMonth} onChange={startMonth => set({ startMonth })} error={errors.startMonth} />
            <Field id="debt-final" label="Last Payment (optional)" type="month" value={draft.finalPaymentMonth} onChange={finalPaymentMonth => set({ finalPaymentMonth })} error={errors.finalPaymentMonth} />
          </>}
        </div>
      </section>
      <div className="inline-actions">
        <button type="button" className="button-small button-small-primary" onClick={save}>{isNew ? 'Add' : 'Save Changes'}</button>
        <button type="button" className="button-small" onClick={cancel}>Cancel</button>
      </div>
      <p className="muted-note">Nothing changes until you save. No bank is contacted.</p>
    </div>
  )
}
