import { useEffect, useRef, useState } from 'react'
import { Icon } from '../../components/Icon'
import { yearMonthOf } from '../../domain/calendar'
import { usualAmountFor } from '../../domain/finance/bills'
import { debtPayment, linkedBill } from '../../domain/finance/debts'
import type { RecurringBill } from '../../domain/finance/types'
import { useAllAmounts } from '../../ui/amountVisibility'
import { BillForm } from '../bills/BillForm'
import { Amount } from './Amount'
import type { StageProps } from './stageProps'

/**
 * Bills & Subscriptions inside Getting Started (GS-4), with Bills' own form
 * (`BillForm`): the same fields, frequencies, unknown amount, checks and
 * save. After a save the user stays here and can add another; Cancel
 * closes the form without saving. Nothing here changes the shared month or
 * the calendar: a new bill starts in this month, as Add Bill does on it.
 *
 * The payment of a card or loan that already is a bill (the bill keeps the
 * link, `debtId`) is listed apart as "Already in your bills", so it is not
 * added twice. Only that link counts, never a similar name.
 */
export function BillsStage({ data, today, owner, newId, onChange }: StageProps) {
  const [adding, setAdding] = useState(false)
  const [message, setMessage] = useState('')
  const focus = useRef<string | null>(null)
  useEffect(() => {
    if (!focus.current) return
    document.getElementById(focus.current)?.focus()
    focus.current = null
  })
  const month = yearMonthOf(today)
  // Hide amounts (the header eye) covers these amounts, as in Bills.
  const amounts = useAllAmounts(data.space.currency)
  const own = data.bills.filter(bill => !bill.debtId)
  const paid = data.debts.flatMap(debt => {
    const bill = linkedBill(data, debt.id)
    return bill ? [{ debt, bill }] : []
  })
  /**
   * Debts whose regular payment is set on the debt itself and is not a bill yet: only these get the hint.
   * A debt with no payment (none entered, or a loan whose last payment has passed) gets nothing to add.
   */
  const unpaid = data.debts.filter(debt => {
    const payment = debtPayment(data, debt, month)
    const ended = debt.finalPaymentMonth != null && debt.finalPaymentMonth < month
    return payment.source === 'debt' && payment.amount !== null && payment.amount > 0 && !ended
  })

  /** The usual amount this month (or in the bill's first month, if it starts later). Unknown stays unknown, never 0. */
  const usual = (bill: RecurringBill) => {
    const amount = usualAmountFor(bill, month < bill.startMonth ? bill.startMonth : month)
    if (amount === null) return 'Unknown'
    return <><Amount text={amounts.money(amount)} spoken={amounts.spoken(amount)} hidden={amounts.hidden} />{bill.frequency === 'yearly' ? ' / year' : ''}</>
  }

  const start = () => { setAdding(true); setMessage(''); focus.current = 'bill-name' }
  const close = (done: string) => { setAdding(false); setMessage(done); focus.current = 'gs-add-bill' }

  return (
    <div className="gs-records">
      {own.length === 0
        ? <p className="muted-note">No bills yet.</p>
        : <ul className="gs-list" aria-label="Your bills">
          {own.map(bill => (
            <li key={bill.id}>
              <span><span className="item-name">{bill.name}</span><small>{bill.category}</small></span>
              <b>{usual(bill)}</b>
            </li>
          ))}
        </ul>}
      {paid.length > 0 && <>
        <ul className="gs-list" aria-label="Debt payments already in your bills">
          {paid.map(({ debt, bill }) => (
            <li key={bill.id}>
              <span><span className="item-name">{bill.name}</span><small>Pays {debt.name} · Already in your bills</small></span>
              <b>{usual(bill)}</b>
            </li>
          ))}
        </ul>
        <p className="field-help">{paid.length === 1 ? 'This debt payment is' : 'These debt payments are'} already included in your bills. You don’t need to add {paid.length === 1 ? 'it' : 'them'} again.</p>
      </>}
      {unpaid.length > 0 && (
        <p className="field-help">Not in your bills yet: the monthly payment you entered for {unpaid.map(debt => debt.name).join(', ')}. To add it, use Add a Bill and choose it under More details › Pays a card or loan, so it is counted once.</p>
      )}
      <p className="muted-note" role="status">{message}</p>
      {adding
        ? <div className="form-stack edit-box gs-form" role="group" aria-labelledby="gs-form-title">
          <h2 id="gs-form-title" className="section-title">Add a Bill</h2>
          <BillForm data={data} bill={null} month={month} today={today} owner={owner} newId={newId} onChange={onChange}
            onCancel={() => close('')} onCreated={(_, done) => close(done)} onSaved={close} />
        </div>
        : <button id="gs-add-bill" type="button" className="button-small align-start" onClick={start}>
          <Icon name="plus" size={16} /> {own.length === 0 ? 'Add a Bill' : 'Add Another Bill'}
        </button>}
    </div>
  )
}
