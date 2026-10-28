import { useContext } from 'react'
import { Icon } from '../../components/Icon'
import { yearMonthOf } from '../../domain/calendar'
import { usualAmountFor } from '../../domain/finance/bills'
import { countByValidity, matchesValidity, usableFilter, validityOn } from '../../domain/finance/validity'
import { formatAmount, formatYearMonth } from '../../ui/format'
import { DataBlockFrame } from './DataBlockFrame'
import { DataBlocksContext } from './dataBlocks'
import type { DataScreenProps } from './DataScreen'
import { ValidityFilterBar, ValidityTag } from './ValidityFilterBar'

/**
 * Every bill in a compact list: name, category, due day, months and
 * status, with its usual amount (never one month's own amount). Each
 * opens the bill's own screen, on the month shared by Home, Bills and Cards.
 */
export function BillsSection({ data, today, isDemo, onOpenBill }: DataScreenProps) {
  const { view, onViewChange } = useContext(DataBlocksContext)
  const money = (minor: number) => formatAmount(minor, data.space.currency)
  const reference = yearMonthOf(today)
  const counts = countByValidity(data.bills, reference)
  const filter = usableFilter(view.billFilter, counts)
  const shown = data.bills.filter(bill => matchesValidity(bill, reference, filter))
  const summary = data.bills.length === 0 ? 'No bills yet'
    : [`${data.bills.length} ${data.bills.length === 1 ? 'bill' : 'bills'}`, `${counts.active} active`, ...(counts.upcoming > 0 ? [`${counts.upcoming} upcoming`] : [])].join(' · ')

  return (
    <DataBlockFrame block="bills" summary={summary}
      actions={<button type="button" className="button-small" onClick={() => onOpenBill(null)}><Icon name="plus" size={16} /> Add Bill</button>}>
      {data.bills.length === 0 ? (
        <div className="empty-state">
          <p className="muted-note">No bills yet. Add rent, phone or any other payment that comes back regularly.</p>
          <button type="button" className="button-small align-start" onClick={() => onOpenBill(null)}><Icon name="plus" size={16} /> Add Your First Bill</button>
        </div>
      ) : <>
        <ValidityFilterBar label="Bills" value={filter} counts={counts} today={today} isDemo={isDemo} onChange={billFilter => onViewChange({ ...view, billFilter })} />
        <p className="field-help">The amount is the bill’s usual amount. Open a bill to see or change the amount of one month.</p>
        {shown.length === 0 && <p className="muted-note">No {filter} bills. Choose All to see every bill.</p>}
        <ul className="line-list compact-list">
          {shown.map(bill => {
            const validity = validityOn(bill, reference)
            // The usual amount on the reference month, or on the bill's first or last month when it is not active then.
            const at = validity === 'upcoming' ? bill.startMonth : validity === 'ended' ? bill.endMonth! : reference
            const usual = usualAmountFor(bill, at)
            return (
              <li key={bill.id}>
                <button type="button" className="line line-button" onClick={() => onOpenBill(bill.id)}>
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
    </DataBlockFrame>
  )
}
