import { useId, useState } from 'react'
import { Icon } from '../../components/Icon'
import { summarizeDebts } from '../../domain/finance/debts'
import type { FinanceData, Id } from '../../domain/finance/types'
import { formatAmount, formatDate } from '../../ui/format'

/**
 * How much do I owe? The total of the Remaining Balances (never the
 * monthly payments). It opens in place to show each card and loan; each
 * row opens that card or loan in Cards, where it can be edited.
 */
export function TotalDebt({ data, onOpenDebt, onOpenCards }: { data: FinanceData; onOpenDebt: (id: Id) => void; onOpenCards: () => void }) {
  const [open, setOpen] = useState(false)
  const detailsId = useId()
  const summary = summarizeDebts(data)
  const money = (minor: number) => formatAmount(minor, data.space.currency)
  return (
    <section className="block home-section" aria-labelledby="home-debt">
      <h2 id="home-debt" className="section-title">Total Debt</h2>
      <button type="button" className="debt-toggle" aria-expanded={open} aria-controls={detailsId} onClick={() => setOpen(!open)}>
        <span>
          <b className="year-total">{money(summary.total)}</b>
          <small>{summary.items.length === 0 ? 'No cards or loans yet' : `${summary.items.length} ${summary.items.length === 1 ? 'card or loan' : 'cards and loans'} · Remaining balances`}</small>
        </span>
        <span className="debt-toggle-label">{open ? 'Hide' : 'Show'} <Icon name={open ? 'chevronUp' : 'chevronDown'} size={18} /></span>
      </button>
      {summary.missingBalanceCount > 0 && (
        <p className="muted-note">{summary.missingBalanceCount === 1 ? 'One balance is' : `${summary.missingBalanceCount} balances are`} not entered, so the total may be higher.</p>
      )}
      {open && (
        <div id={detailsId} className="debt-details">
          {summary.items.length > 0 && (
            <ul className="line-list" aria-label="Debts">
              {summary.items.map(({ debt, balance, asOf }) => (
                <li key={debt.id}>
                  <button type="button" className="line line-button" onClick={() => onOpenDebt(debt.id)}>
                    <span>{debt.name}<small>{asOf ? `As of ${formatDate(asOf)}` : 'Balance not entered'}</small></span>
                    <b>{balance === null ? 'Balance needed' : money(balance)}</b>
                    <Icon name="arrowRight" size={16} />
                  </button>
                </li>
              ))}
            </ul>
          )}
          <p className="field-help">What you still owe, not your monthly payments. Paying a bill does not lower a balance by itself: update it in the card or loan.</p>
          <button type="button" className="button-small align-start" onClick={onOpenCards}>Open Cards <Icon name="arrowRight" size={16} /></button>
        </div>
      )}
    </section>
  )
}
