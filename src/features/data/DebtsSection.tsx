import { Icon } from '../../components/Icon'
import { summarizeDebts } from '../../domain/finance/debts'
import { formatAmount, formatDate } from '../../ui/format'
import { DEBT_KIND_NAMES } from '../../ui/labels'
import { DataBlockFrame } from './DataBlockFrame'
import type { DataScreenProps } from './DataScreen'

/**
 * Every card and loan with its kind and its latest Remaining Balance, as
 * entered, with its date: never a projection, and monthly payments are
 * never added to it. Each opens its own screen.
 */
export function DebtsSection({ data, onOpenDebt }: DataScreenProps) {
  const money = (minor: number) => formatAmount(minor, data.space.currency)
  const { items } = summarizeDebts(data)
  const cards = items.filter(item => item.debt.kind === 'card').length
  const loans = items.length - cards
  const summary = items.length === 0 ? 'No cards or loans yet'
    : [cards > 0 ? `${cards} ${cards === 1 ? 'card' : 'cards'}` : '', loans > 0 ? `${loans} ${loans === 1 ? 'loan' : 'loans'}` : ''].filter(Boolean).join(' · ')

  return (
    <DataBlockFrame block="debts" summary={summary}
      actions={<button type="button" className="button-small" onClick={() => onOpenDebt(null)}><Icon name="plus" size={16} /> Add</button>}>
      {items.length === 0 ? (
        <div className="empty-state">
          <p className="muted-note">No cards or loans yet. Add one to keep its Remaining Balance and payments together.</p>
          <button type="button" className="button-small align-start" onClick={() => onOpenDebt(null)}><Icon name="plus" size={16} /> Add Your First Card or Loan</button>
        </div>
      ) : <>
        <p className="field-help">Remaining Balance is the last one you entered, with its date.</p>
        <ul className="line-list compact-list">
          {items.map(({ debt, balance, asOf }) => (
            <li key={debt.id}>
              <button type="button" className="line line-button" onClick={() => onOpenDebt(debt.id)}>
                <span>
                  <span className="item-name">{debt.name}</span>
                  <small>{DEBT_KIND_NAMES[debt.kind]} · {asOf ? `Remaining Balance as of ${formatDate(asOf)}` : 'Balance not entered'}</small>
                </span>
                <b>{balance === null ? 'Balance needed' : money(balance)}</b>
                <Icon name="arrowRight" size={16} />
              </button>
            </li>
          ))}
        </ul>
      </>}
    </DataBlockFrame>
  )
}
