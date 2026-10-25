import { Icon } from '../../components/Icon'
import type { YearMonth } from '../../domain/calendar'
import { summarizeCards } from '../../domain/finance/debts'
import type { FinanceData, Id } from '../../domain/finance/types'
import { formatAmount, formatDate, formatDueDay, formatYearMonth } from '../../ui/format'
import { DEBT_KIND_NAMES } from '../../ui/labels'

type Props = {
  data: FinanceData
  month: YearMonth
  onOpenDebt: (id: Id) => void
  onAddDebt: () => void
}

/**
 * My Loans & Cards: the same debt records Home's Total Debt adds up. The
 * summary uses only these records and their bills; income is never asked
 * for here.
 */
export function CardsScreen({ data, month, onOpenDebt, onAddDebt }: Props) {
  const summary = summarizeCards(data, month)
  const money = (minor: number) => formatAmount(minor, data.space.currency)
  const title = data.space.mode === 'individual' ? 'My Loans & Cards' : 'Loans & Cards'

  return (
    <div className="tab-screen">
      <div className="screen-top">
        <h1 className="tab-title">{title}</h1>
        <button type="button" className="button-small button-small-primary" onClick={onAddDebt}><Icon name="plus" size={16} /> Add Card or Loan</button>
      </div>

      <section className="block" aria-labelledby="cards-summary">
        <h2 id="cards-summary" className="section-title">Summary</h2>
        <p className="muted-note">Summary based on your loans and cards.</p>
        <div className="stat-grid">
          <div className="stat">
            <small>Remaining Balance</small><b>{money(summary.totalBalance)}</b>
            {summary.missingBalanceCount > 0 && <small>{summary.missingBalanceCount === 1 ? '1 balance missing' : `${summary.missingBalanceCount} balances missing`}</small>}
          </div>
          <div className="stat">
            <small>Monthly Payments · {formatYearMonth(month)}</small><b>{money(summary.totalPayments)}</b>
            {summary.missingPaymentCount > 0 && <small>{summary.missingPaymentCount === 1 ? '1 payment not entered' : `${summary.missingPaymentCount} payments not entered`}</small>}
          </div>
        </div>
        <p className="field-help">Remaining Balance is what you still owe. Monthly payments are planned, and each one is counted once in Monthly Bills.</p>
      </section>

      {summary.items.length === 0
        ? <div className="empty-block"><p>No cards or loans yet.</p><p>Tap Add Card or Loan to add one.</p></div>
        : <ul className="goal-cards" aria-label="Cards and loans">
          {summary.items.map(({ debt, balance, asOf, payment }) => (
            <li key={debt.id}>
              <button type="button" className="goal-card" onClick={() => onOpenDebt(debt.id)}>
                <span className="line"><b>{debt.name}</b><small>{DEBT_KIND_NAMES[debt.kind]}</small></span>
                <span className="goal-card-amount">{balance === null ? 'Balance needed' : money(balance)} <small>Remaining Balance</small></span>
                <small>{asOf ? `Balance as of ${formatDate(asOf)}` : 'No balance entered yet'}</small>
                <small>
                  {payment.amount === null ? 'Monthly payment not entered' : `Monthly payment ${money(payment.amount)}`} · Due {formatDueDay(debt.dueDay).toLowerCase()}
                </small>
              </button>
            </li>
          ))}
        </ul>}
    </div>
  )
}
