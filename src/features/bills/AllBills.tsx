import { Icon } from '../../components/Icon'
import { matchesBillSearch } from './billsView'
import { ValidityFilterBar, ValidityTag } from '../../components/ValidityFilterBar'
import { yearMonthOf } from '../../domain/calendar'
import { usualAmountFor } from '../../domain/finance/bills'
import type { FinanceData, Id } from '../../domain/finance/types'
import type { CalendarDate } from '../../domain/goalTime'
import { countByValidity, matchesValidity, usableFilter, validityOn, type ValidityFilter } from '../../domain/finance/validity'
import { formatYearMonth } from '../../ui/format'


type Props = {
  data: FinanceData
  today: CalendarDate
  isDemo: boolean
  query: string
  filter: ValidityFilter
  onFilterChange: (filter: ValidityFilter) => void
  onOpenBill: (id: Id) => void
  onAddBill: () => void
  /** How an amount is written: Bills' own, so hiding all amounts hides these too. */
  money: (minor: number) => string
}

/**
 * All Bills: a searchable view with general validity, separate from monthly paid status.
 * Every bill in a compact list (name,
 * category, due day, months and status), with its usual amount (never one
 * month's own amount), independent of the selected month. Each opens the
 * bill's own screen, on the shared month. Closing it drops nothing.
 */
export function AllBills({ data, today, isDemo, query, filter: chosen, onFilterChange, onOpenBill, onAddBill, money }: Props) {
  const reference = yearMonthOf(today)
  const counts = countByValidity(data.bills, today)
  const filter = usableFilter(chosen, counts)
  const shown = data.bills.filter(bill => matchesValidity(bill, today, filter) && matchesBillSearch(bill, query))
  return (
    <section className="block data-block no-print" aria-labelledby="all-bills-title" data-bills-block="all">
      <h2 id="all-bills-title" className="section-title">All Bills</h2>
      <p id="bill-search-results" className="muted-note" aria-live="off">{shown.length} {shown.length === 1 ? 'bill' : 'bills'}{query.trim() ? ' found' : ' shown'}</p>
      {data.bills.length === 0 ? (
        <div className="empty-state">
          <p className="muted-note">No bills yet. Add rent, phone or any other payment that comes back regularly.</p>
          <button type="button" className="button-small align-start" onClick={onAddBill}><Icon name="plus" size={16} /> Add Your First Bill</button>
        </div>
      ) : <>
        <ValidityFilterBar label="Bills" groupLabel="Show bills by status" value={filter} counts={counts} today={today} isDemo={isDemo} onChange={onFilterChange} />
        <p className="field-help">Usual amounts. Status is independent of monthly Paid or Pending.</p>
        {shown.length === 0 && <p className="muted-note">{query.trim() ? 'No bills match your search. Try another name or category, or change the status filter.' : 'No bills with this status. Choose All to see every bill.'}</p>}
        <ul className="line-list compact-list">
          {shown.map(bill => {
            const validity = validityOn(bill, today)
            // The usual amount on the reference month, or on the bill's first or last month when it is not active then.
            const at = validity === 'upcoming' ? bill.startMonth : validity === 'ended' ? bill.endMonth! : reference
            const usual = usualAmountFor(bill, at)
            return (
              <li key={bill.id}>
                <button type="button" className="line line-button" data-return-key={`all-${bill.id}`} onClick={() => onOpenBill(bill.id)}>
                  <span>
                    <span className="item-name">{bill.name} <ValidityTag validity={validity} /></span>
                    <small>{bill.category} · {bill.frequency === 'yearly' ? 'Yearly' : 'Monthly'} · Due day {bill.dueDay}</small>
                    <small>{bill.endMonth ? `${formatYearMonth(bill.startMonth)} to ${formatYearMonth(bill.endMonth)}` : `From ${formatYearMonth(bill.startMonth)} · no end month`}</small>
                  </span>
                  <b className="usual-amount">{usual === null ? 'Amount needed' : money(usual)}<small>usual</small></b>
                  <Icon name="arrowRight" size={16} />
                </button>
              </li>
            )
          })}
        </ul>
      </>}
    </section>
  )
}
