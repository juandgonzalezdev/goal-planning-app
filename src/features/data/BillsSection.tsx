import { Icon } from '../../components/Icon'
import { usualAmountFor } from '../../domain/finance/bills'
import { formatAmount, formatDueDay } from '../../ui/format'
import type { DataScreenProps } from './DataScreen'

/** Every bill with its usual amount; each opens the bill's own screen. */
export function BillsSection({ data, month, onOpenBill }: DataScreenProps) {
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
