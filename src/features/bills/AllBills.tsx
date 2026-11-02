import { Icon } from '../../components/Icon'
import { FoldBlock } from '../../components/FoldBlock'
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
  open: boolean
  onToggle: () => void
  filter: ValidityFilter
  onFilterChange: (filter: ValidityFilter) => void
  onOpenBill: (id: Id) => void
  onAddBill: () => void
  /** How an amount is written: Bills' own, so hiding all amounts hides these too. */
  money: (minor: number) => string
}

/**
 * All Bills, at the end of Bills: every bill in a compact list (name,
 * category, due day, months and status), with its usual amount (never one
 * month's own amount), whatever the month shown above. Each opens the
 * bill's own screen, on the shared month. Closing it drops nothing.
 */
export function AllBills({ data, today, isDemo, open, onToggle, filter: chosen, onFilterChange, onOpenBill, onAddBill, money }: Props) {
  const reference = yearMonthOf(today)
  const counts = countByValidity(data.bills, reference)
  const filter = usableFilter(chosen, counts)
  const shown = data.bills.filter(bill => matchesValidity(bill, reference, filter))
  const summary = data.bills.length === 0 ? 'No bills yet'
    : [`${data.bills.length} ${data.bills.length === 1 ? 'bill' : 'bills'}`, `${counts.active} active`, ...(counts.upcoming > 0 ? [`${counts.upcoming} upcoming`] : [])].join(' · ')

  return (
    <FoldBlock title="All Bills" summary={summary} expanded={open} onToggle={onToggle} className="data-block no-print" dataset={{ 'data-bills-block': 'all' }}>
      {data.bills.length === 0 ? (
        <div className="empty-state">
          <p className="muted-note">No bills yet. Add rent, phone or any other payment that comes back regularly.</p>
          <button type="button" className="button-small align-start" onClick={onAddBill}><Icon name="plus" size={16} /> Add Your First Bill</button>
        </div>
      ) : <>
        <ValidityFilterBar label="Bills" value={filter} counts={counts} today={today} isDemo={isDemo} onChange={onFilterChange} />
        <p className="field-help">Every bill, whatever the month above. The amount is the bill’s usual amount. Open a bill to see or change the amount of one month.</p>
        {shown.length === 0 && <p className="muted-note">No {filter} bills. Choose All to see every bill.</p>}
        <ul className="line-list compact-list">
          {shown.map(bill => {
            const validity = validityOn(bill, reference)
            // The usual amount on the reference month, or on the bill's first or last month when it is not active then.
            const at = validity === 'upcoming' ? bill.startMonth : validity === 'ended' ? bill.endMonth! : reference
            const usual = usualAmountFor(bill, at)
            return (
              <li key={bill.id}>
                <button type="button" className="line line-button" data-return-key={`all-${bill.id}`} onClick={() => onOpenBill(bill.id)}>
                  <span>
                    <span className="item-name">{bill.name} <ValidityTag validity={validity} /></span>
                    <small>{bill.category} · Due day {bill.dueDay}{bill.frequency === 'yearly' ? ' · Once a year' : ''}</small>
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
    </FoldBlock>
  )
}
