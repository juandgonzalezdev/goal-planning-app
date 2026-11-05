import { HelpTip } from '../../components/HelpTip'
import { Icon } from '../../components/Icon'
import { MonthSwitch } from '../../components/MonthSwitch'
import { summarizeCards } from '../../domain/finance/debts'
import { formatAmount, formatDate, formatDueDay, formatYearMonth } from '../../ui/format'
import { DEBT_KIND_NAMES } from '../../ui/labels'
import { MoneyBlockFrame } from './MoneyBlockFrame'
import type { SectionProps } from './MoneyScreen'

/**
 * Cards & Loans: the same debt records Home's Total Debt adds up, with
 * the month shared by Home and Bills. The month chooses the payments; the
 * Remaining Balance is the latest one entered, with its date, never a
 * forecast, and payments are never subtracted from it. Each card or loan
 * opens its own screen. Income is never asked for here.
 */
export function CardsLoansSection({ data, months, month, onMonthChange, onOpenDebt }: SectionProps) {
  const summary = summarizeCards(data, month)
  const money = (minor: number) => formatAmount(minor, data.space.currency)
  const cards = summary.items.filter(item => item.debt.kind === 'card').length
  const loans = summary.items.length - cards
  const closedSummary = summary.items.length === 0 ? 'No cards or loans yet'
    : [cards > 0 ? `${cards} ${cards === 1 ? 'card' : 'cards'}` : '', loans > 0 ? `${loans} ${loans === 1 ? 'loan' : 'loans'}` : ''].filter(Boolean).join(' · ')

  return (
    <MoneyBlockFrame block="debts" summary={closedSummary}
      actions={<button type="button" className="button-small" onClick={() => onOpenDebt(null)}><Icon name="plus" size={16} /> Add Card or Loan</button>}>
      <MonthSwitch months={months} value={month} onChange={onMonthChange} />
      <div className="stat-grid" role="group" aria-label="Cards and loans summary">
        <div className="stat">
          <small>Remaining Balance</small><b>{money(summary.totalBalance)}</b>
          {summary.missingBalanceCount > 0 && <small>{summary.missingBalanceCount === 1 ? '1 balance missing' : `${summary.missingBalanceCount} balances missing`}</small>}
        </div>
        <div className="stat">
          <small>Monthly Payments · {formatYearMonth(month)}</small><b>{money(summary.totalPayments)}</b>
          {summary.missingPaymentCount > 0 && <small>{summary.missingPaymentCount === 1 ? '1 payment not entered' : `${summary.missingPaymentCount} payments not entered`}</small>}
        </div>
      </div>
      <div className="help-tips"><HelpTip topic="money-payments" label /></div>

      {summary.items.length === 0
        ? <div className="empty-state">
          <p className="muted-note">No cards or loans yet.</p>
        </div>
        : <ul className="goal-cards" aria-label="Cards and loans">
          {summary.items.map(({ debt, balance, asOf, payment }) => (
            <li key={debt.id}>
              <button type="button" className="goal-card" data-return-key={`debt-${debt.id}`} onClick={() => onOpenDebt(debt.id)}>
                <span className="line"><b>{debt.name}</b><small>{DEBT_KIND_NAMES[debt.kind]}</small></span>
                <span className="goal-card-amount">{balance === null ? 'Balance needed' : money(balance)} <small>Remaining Balance</small></span>
                <small>{asOf ? `Balance as of ${formatDate(asOf)}` : 'No balance entered yet'}</small>
                <small>
                  {payment.amount === null
                    ? `${formatYearMonth(month)} payment: ${!payment.due ? 'none this month' : payment.bill ? 'amount not known' : 'not entered'}`
                    : `${formatYearMonth(month)} payment ${money(payment.amount)}${payment.changedThisMonth ? ' (this month only)' : ''}`} · Due {formatDueDay(debt.dueDay).toLowerCase()}
                </small>
              </button>
            </li>
          ))}
        </ul>}
    </MoneyBlockFrame>
  )
}
