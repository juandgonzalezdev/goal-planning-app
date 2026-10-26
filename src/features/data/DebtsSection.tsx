import { Icon } from '../../components/Icon'
import { summarizeDebts } from '../../domain/finance/debts'
import { formatAmount, formatDate } from '../../ui/format'
import type { DataScreenProps } from './DataScreen'

/** Every card and loan with its latest Remaining Balance; each opens its own screen. */
export function DebtsSection({ data, onOpenDebt }: DataScreenProps) {
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
