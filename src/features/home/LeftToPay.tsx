import { Icon } from '../../components/Icon'
import type { YearMonth } from '../../domain/calendar'
import type { BillSummary } from '../../domain/finance/bills'
import { leftToPayStatus } from '../../domain/finance/overview'
import { monthResult } from '../../domain/finance/spending'
import type { FinanceData, Id } from '../../domain/finance/types'
import type { CalendarDate } from '../../domain/goalTime'
import { formatDate, formatYearMonth, monthName } from '../../ui/format'
import { useBlockAmounts } from '../../ui/amountVisibility'
import { HomeAreaFrame } from './HomeBlock'

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

type Props = {
  data: FinanceData
  month: YearMonth
  today: CalendarDate
  /** Every unpaid bill shown (Show all), kept while moving around the app. */
  showAll: boolean
  onShowAllChange: (showAll: boolean) => void
  onOpenBills: () => void
  onOpenBill: (id: Id) => void
}

/** How many unpaid bills show before Show all. */
export const FIRST_BILLS = 5

/**
 * What do I still have to pay? The amount, and each unpaid bill by its
 * due date: due later or overdue (its date has passed). The first five
 * show; Show all lists every one, here on Home. Each bill opens its own
 * screen, where it is marked as paid as before.
 */
export function LeftToPay({ data, month, today, showAll, onShowAllChange, onOpenBills, onOpenBill }: Props) {
  const { money, spoken } = useBlockAmounts('left-to-pay', data.space.currency)
  const r = monthResult(data, month, today)
  const status = leftToPayStatus(r.planned)
  const more = r.pending.length > FIRST_BILLS
  const shown = more && !showAll ? r.pending.slice(0, FIRST_BILLS) : r.pending
  const actions = <button type="button" className="button-small" data-return-key="bills-link" onClick={onOpenBills}>Bills <Icon name="arrowRight" size={16} /></button>
  return (
    <HomeAreaFrame area="left-to-pay" period={formatYearMonth(month)} actions={actions}>
      <div className="left-to-pay">
        <b className="year-total">{money(r.planned.leftToPay)}{status.status === 'amounts-missing' && <small> + unknown</small>}</b>
        <LeftToPayMessage bills={r.planned} month={month} />
        {shown.length > 0 && (
          <ul className="line-list pay-list" id="left-to-pay-list" aria-label="Bills not paid yet">
            {shown.map(({ occurrence, state }) => (
              <li key={occurrence.bill.id}>
                <button type="button" className="line line-button" data-return-key={`pay-${occurrence.bill.id}`} onClick={() => onOpenBill(occurrence.bill.id)}
                  aria-label={`${occurrence.bill.name}, ${occurrence.amount === null ? 'amount needed' : spoken(occurrence.amount)}, ${state === 'overdue' ? `overdue since ${formatDate(occurrence.dueDate)}` : `due ${formatDate(occurrence.dueDate)}`}`}>
                  <span>{occurrence.bill.name}<small className={state === 'overdue' ? 'overdue-tag' : 'pending-tag'}>{state === 'overdue' ? `Overdue since ${formatDate(occurrence.dueDate)}` : `Due ${formatDate(occurrence.dueDate)}`}</small></span>
                  <b>{occurrence.amount === null ? 'Amount needed' : money(occurrence.amount)}</b>
                  <Icon name="arrowRight" size={16} />
                </button>
              </li>
            ))}
          </ul>
        )}
        {more && (
          <button type="button" className="text-button align-start" aria-expanded={showAll} aria-controls="left-to-pay-list" onClick={() => onShowAllChange(!showAll)}>
            {showAll ? 'Show Fewer' : `Show All ${r.pending.length}`}
          </button>
        )}
        {status.status === 'amounts-missing' && <p className="muted-note">Enter the missing amounts in Bills to know the full total.</p>}
      </div>
    </HomeAreaFrame>
  )
}
