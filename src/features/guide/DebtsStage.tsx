import { useEffect, useRef, useState } from 'react'
import { Icon } from '../../components/Icon'
import { yearMonthOf } from '../../domain/calendar'
import { linkedBill, summarizeDebts } from '../../domain/finance/debts'
import { useAllAmounts } from '../../ui/amountVisibility'
import { DEBT_KIND_NAMES } from '../../ui/labels'
import { DebtForm } from '../cards/DebtScreen'
import { emptyDebtDraft } from '../cards/debtDraft'
import { Amount } from './Amount'
import type { StageProps } from './stageProps'

/**
 * Debts inside Getting Started (GS-4). The form is the card or loan
 * screen's own (`DebtForm`, `debtDraft.ts`): the same fields, checks,
 * interest and save, the same linked bill when "Add this payment to my
 * monthly bills" stays checked. This stage only hosts it: after a save the
 * user stays here, sees the card or loan in the list and can add another;
 * Cancel closes the form without saving. A card or loan whose payment is a
 * bill (`linkedBill`, the link the bill keeps) says "Already in your bills".
 */
export function DebtsStage({ data, today, owner, newId, onChange }: StageProps) {
  const [adding, setAdding] = useState(false)
  const [message, setMessage] = useState('')
  const focus = useRef<string | null>(null)
  useEffect(() => {
    if (!focus.current) return
    document.getElementById(focus.current)?.focus()
    focus.current = null
  })
  const { items } = summarizeDebts(data)
  // Hide amounts (the header eye) covers the Remaining Balances, as in the other stages.
  const amounts = useAllAmounts(data.space.currency)

  const start = () => { setAdding(true); setMessage(''); focus.current = 'debt-kind' }
  const close = (done: string) => { setAdding(false); setMessage(done); focus.current = 'gs-add-debt' }

  return (
    <div className="gs-records">
      {items.length === 0
        ? <p className="muted-note">No debts yet.</p>
        : <ul className="gs-list" aria-label="Your debts">
          {items.map(({ debt, balance }) => (
            <li key={debt.id}>
              <span>
                <span className="item-name">{debt.name}</span>
                <small>{DEBT_KIND_NAMES[debt.kind]}{linkedBill(data, debt.id) ? ' · Already in your bills' : ''}</small>
              </span>
              <b>{balance === null ? 'Not entered' : <Amount text={amounts.money(balance)} spoken={amounts.spoken(balance)} hidden={amounts.hidden} />}</b>
            </li>
          ))}
        </ul>}
      <p className="muted-note" role="status">{message}</p>
      {adding
        ? <DebtForm inline data={data} debtId={null} today={today} owner={owner} newId={newId} onChange={onChange}
          draftStart={emptyDebtDraft(yearMonthOf(today), today)}
          onCancel={() => close('')} onCreated={(_, done) => close(done)} />
        : <button id="gs-add-debt" type="button" className="button-small align-start" onClick={start}>
          <Icon name="plus" size={16} /> {items.length === 0 ? 'Add a Debt' : 'Add Another Debt'}
        </button>}
    </div>
  )
}
