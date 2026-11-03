import { Icon } from '../../components/Icon'
import { summarizeDebts } from '../../domain/finance/debts'
import type { FinanceData, Id } from '../../domain/finance/types'
import type { CalendarDate } from '../../domain/goalTime'
import { formatDate } from '../../ui/format'
import { useBlockAmounts } from '../../ui/amountVisibility'
import { balanceDatesText } from './balanceDates'
import { HomeBlockFrame } from './HomeBlock'

/**
 * Cards & Loans, in Money & Goals on Home: how much do I owe? The total of the Remaining Balances (never the
 * monthly payments), and each card and loan with the date of its balance;
 * each row opens that card or loan, where it can be edited. For
 * a past month it uses the balances entered by the end of that month.
 */
export function TotalDebt({ data, asOf, onOpenDebt, onOpenCards }: { data: FinanceData; asOf: CalendarDate; onOpenDebt: (id: Id) => void; onOpenCards: () => void }) {
  const summary = summarizeDebts(data, asOf)
  const { money } = useBlockAmounts('debt', data.space.currency)
  const none = summary.items.length === 0
  const total = `${money(summary.total)}${summary.missingBalanceCount > 0 ? ' + unknown' : ''}`
  const period = none ? `By ${formatDate(asOf)}` : balanceDatesText(summary.items.map(item => item.asOf), asOf)
  return (
    <HomeBlockFrame block="debt" title="Cards & Loans" period={period} summary={none ? 'No cards or loans yet' : `${total} Remaining Balance`}>
      <div className="debt-total">
        <b className="year-total">{money(summary.total)}</b>
        <small>{none ? 'No cards or loans yet' : `${summary.items.length} ${summary.items.length === 1 ? 'card or loan' : 'cards and loans'}`}</small>
      </div>
      {summary.missingBalanceCount > 0 && (
        <p className="muted-note">{summary.missingBalanceCount === 1 ? 'One balance is' : `${summary.missingBalanceCount} balances are`} not entered, so the total may be higher.</p>
      )}
      {summary.items.length > 0 && (
        <ul className="line-list" aria-label="Debts">
          {summary.items.map(({ debt, balance, asOf }) => (
            <li key={debt.id}>
              <button type="button" className="line line-button" data-return-key={`debt-${debt.id}`} onClick={() => onOpenDebt(debt.id)}>
                <span>{debt.name}<small>{asOf ? `As of ${formatDate(asOf)}` : 'Balance not entered'}</small></span>
                <b>{balance === null ? 'Balance needed' : money(balance)}</b>
                <Icon name="arrowRight" size={16} />
              </button>
            </li>
          ))}
        </ul>
      )}
      <p className="field-help">What you still owe, not your monthly payments. Paying a bill does not lower a balance by itself: update it in the card or loan.</p>
      <button type="button" className="button-small align-start" data-return-key="cards-link" onClick={onOpenCards}>Open Cards &amp; Loans <Icon name="arrowRight" size={16} /></button>
    </HomeBlockFrame>
  )
}
