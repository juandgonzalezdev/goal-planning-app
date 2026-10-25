import type { MonthlyOverview } from '../../domain/finance/overview'
import type { CurrencyCode } from '../../domain/money'
import { formatAmount, formatDate } from '../../ui/format'

type Props = { overview: MonthlyOverview; currency: CurrencyCode; onOpenIncome: () => void; onOpenBills: () => void }

/**
 * How is my month? Income (received, or expected until it arrives), the
 * bills planned for the month and the difference between the two, clearly
 * named: it is not money that is free to spend.
 */
export function MonthOverview({ overview, currency, onOpenIncome, onOpenBills }: Props) {
  const money = (minor: number) => formatAmount(minor, currency)
  const { income } = overview
  const incomeNote = income.basis === 'received'
    ? `Received${income.lines.length === 1 && income.lines[0].received ? ` on ${formatDate(income.lines[0].received.receivedOn)}` : ''}`
    : income.basis === 'expected'
      ? `Expected${income.lines.length === 1 && income.lines[0].payDate ? ` on ${formatDate(income.lines[0].payDate)}` : ''}`
      : income.basis === 'mixed' ? `${money(income.received)} received, ${money(income.expected)} expected` : 'Not entered'
  return (
    <section className="stat-grid three" aria-label="This Month">
      <button type="button" className="stat" onClick={onOpenIncome}>
        <small>Income</small><b>{income.basis === 'none' ? '—' : money(income.total)}</b><small>{incomeNote}</small>
      </button>
      <button type="button" className="stat" onClick={onOpenBills}>
        <small>Planned Bills</small><b>{money(overview.monthlyCommitments)}</b>
        <small>{overview.unknownBillCount > 0 ? `+ ${overview.unknownBillCount === 1 ? '1 unknown amount' : `${overview.unknownBillCount} unknown amounts`}` : `${overview.bills.count} ${overview.bills.count === 1 ? 'bill' : 'bills'}`}</small>
      </button>
      <div className="stat">
        <small>Income minus Bills</small>
        <b>{overview.incomeMinusBills === null ? '—' : money(overview.incomeMinusBills)}</b>
        <small>Before daily spending. Not money saved.</small>
      </div>
    </section>
  )
}
