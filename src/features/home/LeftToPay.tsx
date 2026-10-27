import { Icon } from '../../components/Icon'
import type { YearMonth } from '../../domain/calendar'
import type { BillSummary } from '../../domain/finance/bills'
import { leftToPayStatus } from '../../domain/finance/overview'
import { monthResult } from '../../domain/finance/spending'
import type { FinanceData, Id } from '../../domain/finance/types'
import type { CalendarDate } from '../../domain/goalTime'
import { formatDate, formatYearMonth, monthName } from '../../ui/format'
import { EyeToggle } from '../../ui/privacy'
import { useBlockAmounts } from '../../ui/amountVisibility'
import { HomeBlockFrame } from './HomeBlock'

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

type Props = { data: FinanceData; month: YearMonth; today: CalendarDate; onOpenBills: () => void; onOpenBill: (id: Id) => void }

/** What do I still have to pay? The amount, and each unpaid bill: due later or overdue (its date has passed). */
export function LeftToPay({ data, month, today, onOpenBills, onOpenBill }: Props) {
  const { money, spoken } = useBlockAmounts('left-to-pay', data.space.currency)
  const r = monthResult(data, month, today)
  const status = leftToPayStatus(r.planned)
  const count = r.planned.count - r.planned.paidCount
  const summary = status.status === 'no-bills' ? 'No bills planned'
    : status.status === 'all-paid' ? 'All bills paid'
      : `${money(r.planned.leftToPay)}${status.status === 'amounts-missing' ? ' + unknown' : ''} left · ${count} ${count === 1 ? 'bill' : 'bills'} not paid`
  const actions = <>
    <EyeToggle block="left-to-pay" />
    <button type="button" className="button-small" onClick={onOpenBills}>Bills <Icon name="arrowRight" size={16} /></button>
  </>
  return (
    <HomeBlockFrame block="left-to-pay" title="Left to Pay" period={formatYearMonth(month)} summary={summary} actions={actions}>
      <div className="left-to-pay">
        <b className="year-total">{money(r.planned.leftToPay)}{status.status === 'amounts-missing' && <small> + unknown</small>}</b>
        <LeftToPayMessage bills={r.planned} month={month} />
        {r.pending.length > 0 && (
          <ul className="line-list" aria-label="Bills not paid yet">
            {r.pending.map(({ occurrence, state }) => (
              <li key={occurrence.bill.id}>
                <button type="button" className="line line-button" onClick={() => onOpenBill(occurrence.bill.id)}
                  aria-label={`${occurrence.bill.name}, ${occurrence.amount === null ? 'amount needed' : spoken(occurrence.amount)}, ${state === 'overdue' ? `overdue since ${formatDate(occurrence.dueDate)}` : `due ${formatDate(occurrence.dueDate)}`}`}>
                  <span>{occurrence.bill.name}<small className={state === 'overdue' ? 'overdue-tag' : 'pending-tag'}>{state === 'overdue' ? `Overdue since ${formatDate(occurrence.dueDate)}` : `Due ${formatDate(occurrence.dueDate)}`}</small></span>
                  <b>{occurrence.amount === null ? 'Amount needed' : money(occurrence.amount)}</b>
                  <Icon name="arrowRight" size={16} />
                </button>
              </li>
            ))}
          </ul>
        )}
        {status.status === 'amounts-missing' && <p className="muted-note">Enter the missing amounts in Bills to know the full total.</p>}
      </div>
    </HomeBlockFrame>
  )
}
