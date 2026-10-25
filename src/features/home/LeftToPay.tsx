import { Icon } from '../../components/Icon'
import type { YearMonth } from '../../domain/calendar'
import type { BillSummary } from '../../domain/finance/bills'
import { leftToPayStatus, type MonthlyOverview } from '../../domain/finance/overview'
import type { CurrencyCode } from '../../domain/money'
import { formatAmount, monthName } from '../../ui/format'

/** The sentence about the chosen month: all paid, bills left, or amounts still unknown. */
export function LeftToPayMessage({ bills, month }: { bills: BillSummary; month: YearMonth }) {
  const status = leftToPayStatus(bills)
  const name = monthName(month)
  const message = status.status === 'no-bills' ? `No bills planned for ${name}.`
    : status.status === 'all-paid' ? `All your ${name} bills are paid.`
      : status.status === 'amounts-missing'
        ? `You still have bills to pay in ${name}, and ${status.unknownCount === 1 ? 'one amount is' : `${status.unknownCount} amounts are`} still unknown.`
        : `You still have bills to pay in ${name}.`
  return (
    <p className={`left-message${status.status === 'all-paid' ? ' is-done' : ''}`} role="status">
      {status.status === 'all-paid' && <Icon name="check" size={16} />}{message}
    </p>
  )
}

/** What do I still have to pay? The amount and a message about the chosen month. */
export function LeftToPay({ overview, month, currency, onOpenBills }: { overview: MonthlyOverview; month: YearMonth; currency: CurrencyCode; onOpenBills: () => void }) {
  const status = leftToPayStatus(overview.bills)
  return (
    <section className="block home-section" aria-labelledby="home-left">
      <div className="section-head">
        <h2 id="home-left" className="section-title">Left to Pay</h2>
        <button type="button" className="button-small" onClick={onOpenBills}>Bills <Icon name="arrowRight" size={16} /></button>
      </div>
      <div className="left-to-pay">
        <b className="year-total">{formatAmount(overview.leftToPay, currency)}{status.status === 'amounts-missing' && <small> + unknown</small>}</b>
        <LeftToPayMessage bills={overview.bills} month={month} />
        {status.status === 'amounts-missing' && <p className="muted-note">Enter the missing amounts in Bills to know the full total.</p>}
      </div>
    </section>
  )
}
