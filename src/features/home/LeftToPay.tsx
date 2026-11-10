import { useRef, useState } from 'react'
import { Icon } from '../../components/Icon'
import { MarkPaidForm } from '../bills/MarkPaid'
import { useLeaveGuard } from '../../app/unsavedChanges'
import type { ChangeSpace } from '../../ui/saveOutcome'
import type { YearMonth } from '../../domain/calendar'
import type { BillSummary } from '../../domain/finance/bills'
import { leftToPayStatus, toPay } from '../../domain/finance/overview'
import type { BillOccurrence } from '../../domain/finance/bills'
import { monthResult } from '../../domain/finance/spending'
import type { FinanceData, Id } from '../../domain/finance/types'
import type { CalendarDate } from '../../domain/goalTime'
import { formatDate, formatDayRange, formatYearMonth, monthName } from '../../ui/format'
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
  /** Opens a bill on the month it belongs to (Coming up: the next month). */
  onOpenBill: (id: Id, month: YearMonth) => void
  onChange: ChangeSpace
  isDemo: boolean
}

/** How many unpaid bills show before Show all. */
export const FIRST_BILLS = 5

/**
 * What do I still have to pay? The amount, and each unpaid bill by its due
 * date, with an explicit reference (see `toPay`): in the month of today,
 * Overdue and Due later from today, then Coming up (the next month's bills
 * of the next seven days, never added to the total); in a past month, what
 * was not marked as paid; in a future month, what is planned. The first five
 * show; Show All lists every one, here on Home. Each bill opens its own
 * screen, in its own month; Mark as Paid opens the short form here.
 */
export function LeftToPay({ data, month, today, isDemo, showAll, onShowAllChange, onOpenBills, onOpenBill, onChange }: Props) {
  const { money, spoken, hidden } = useBlockAmounts('left-to-pay', data.space.currency)
  // Mark as Paid opens its short form under the bill (one at a time). Once saved, the bill leaves the list,
  // and the keyboard goes to the message.
  const [paying, setPaying] = useState<{ month: YearMonth; billId: Id } | null>(null)
  const [paidNote, setPaidNote] = useState<{ month: YearMonth; text: string; completion?: string } | null>(null)
  const focusNote = useRef(false)
  const guard = useLeaveGuard()
  const r = monthResult(data, month, today)
  const status = leftToPayStatus(r.planned)
  const plan = toPay(data, month, today)
  const all = [...plan.overdue, ...plan.open]
  const more = all.length > FIRST_BILLS
  const shown = new Set((more && !showAll ? all.slice(0, FIRST_BILLS) : all).map(occurrence => occurrence.bill.id))
  const name = monthName(month)
  const actions = <button type="button" className="button-small" data-return-key="bills-link" onClick={onOpenBills}>Bills <Icon name="arrowRight" size={16} /></button>
  const reference = plan.period === 'current' ? (isDemo ? `From the demo’s date, ${formatDate(today)}` : `From today, ${formatDate(today)}`)
    : plan.period === 'past' ? `These are ${name}’s bills. Nothing here is counted from today.` : `These are ${name}’s bills. Nothing here is due yet.`

  const row = (occurrence: BillOccurrence, overdue: boolean) => (
    <li key={occurrence.bill.id}>
      <button type="button" className="line line-button" data-return-key={`pay-${occurrence.bill.id}`} onClick={() => onOpenBill(occurrence.bill.id, month)}
        aria-label={`${occurrence.bill.name}, ${occurrence.amount === null ? 'amount needed' : spoken(occurrence.amount)}, ${overdue ? `overdue since ${formatDate(occurrence.dueDate)}` : `due ${formatDate(occurrence.dueDate)}`}`}>
        <span>{occurrence.bill.name}<small className={overdue ? 'overdue-tag' : 'pending-tag'}>{overdue ? `Overdue since ${formatDate(occurrence.dueDate)}` : `Due ${formatDate(occurrence.dueDate)}`}</small></span>
        <b>{occurrence.amount === null ? 'Amount needed' : money(occurrence.amount)}</b>
        <Icon name="arrowRight" size={16} />
      </button>
      {paying?.month === month && paying.billId === occurrence.bill.id
        ? <MarkPaidForm data={data} occurrence={occurrence} today={today} hidden={hidden} onChange={onChange} tag={`home-payment:${occurrence.bill.id}`}
          onSaved={(done, completion) => { setPaying(null); setPaidNote({ month, text: done, completion }); focusNote.current = true }} onCancel={() => setPaying(null)} />
        : <div className="pay-row-actions">
          <button type="button" className="text-button" aria-label={`Mark as Paid: ${occurrence.bill.name}, ${formatYearMonth(month)}`}
            onClick={() => guard(form => paying?.month === month && form.tag === `home-payment:${paying.billId}`, () => {
              focusNote.current = false
              setPaying({ month, billId: occurrence.bill.id })
            })}>Mark as Paid</button>
        </div>}
    </li>
  )
  const group = (title: string, list: BillOccurrence[], overdue: boolean) => {
    const rows = list.filter(occurrence => shown.has(occurrence.bill.id))
    return rows.length > 0 && (
      <section className="pay-group" aria-label={title}>
        <h3 className="pay-group-title">{title}</h3>
        <ul className="line-list pay-list">{rows.map(occurrence => row(occurrence, overdue))}</ul>
      </section>
    )
  }

  return (
    <HomeAreaFrame area="left-to-pay" period={formatYearMonth(month)} actions={actions}>
      <div className="left-to-pay">
        <b className="year-total">{money(r.planned.leftToPay)}{status.status === 'amounts-missing' && <small> + unknown</small>}</b>
        <LeftToPayMessage bills={r.planned} month={month} />
        {paidNote?.month === month && <p className="muted-note paid-note" tabIndex={-1} ref={element => { if (element && focusNote.current) { focusNote.current = false; element.focus() } }}><span className="paid-check" aria-hidden="true"><Icon name="check" size={14} /></span>{paidNote.text}</p>}
        {paidNote?.month === month && paidNote.completion && <p className="muted-note paid-completion" role="status">{paidNote.completion}</p>}
        {all.length > 0 && <p className="muted-note pay-reference">{reference}</p>}
        {all.length > 0 && (
          <div id="left-to-pay-list" className="pay-groups">
            {plan.period === 'current' && group('Overdue', plan.overdue, true)}
            {plan.period === 'current' && group(`Due later in ${name}`, plan.open, false)}
            {plan.period === 'past' && group(`Not marked as paid in ${name}`, plan.open, false)}
            {plan.period === 'future' && group(`Planned for ${name}`, plan.open, false)}
          </div>
        )}
        {more && (
          <button type="button" className="text-button align-start" aria-expanded={showAll} aria-controls="left-to-pay-list" onClick={() => {
            const hiddenIds = new Set(showAll ? all.slice(FIRST_BILLS).map(item => 'home-payment:' + item.bill.id) : [])
            guard(form => !!form.tag && hiddenIds.has(form.tag), () => {
              if (paying && hiddenIds.has('home-payment:' + paying.billId)) setPaying(null)
              onShowAllChange(!showAll)
            })
          }}>
            {showAll ? 'Show Fewer' : `Show All ${all.length}`}
          </button>
        )}
        {status.status === 'amounts-missing' && <p className="muted-note">Enter the missing amounts in Bills to know the full total.</p>}
        {plan.comingUp && (
          <section className="pay-group coming-up" aria-label={`Coming up, ${formatDate(plan.comingUp.from)} to ${formatDate(plan.comingUp.to)}`}>
            <h3 className="pay-group-title">Coming up · {formatDayRange(plan.comingUp.from, plan.comingUp.to)}</h3>
            <ul className="line-list pay-list">
              {plan.comingUp.bills.map(occurrence => (
                <li key={occurrence.bill.id}>
                  <button type="button" className="line line-button" data-return-key={`next-${occurrence.bill.id}`} onClick={() => onOpenBill(occurrence.bill.id, occurrence.month)}
                    aria-label={`${occurrence.bill.name}, ${occurrence.amount === null ? 'amount needed' : spoken(occurrence.amount)}, due ${formatDate(occurrence.dueDate)}. Opens ${formatYearMonth(occurrence.month)}`}>
                    <span>{occurrence.bill.name}<small className="pending-tag">Due {formatDate(occurrence.dueDate)}</small></span>
                    <b>{occurrence.amount === null ? 'Amount needed' : money(occurrence.amount)}</b>
                    <Icon name="arrowRight" size={16} />
                  </button>
                </li>
              ))}
            </ul>
            <p className="muted-note">{monthName(plan.comingUp.month)}’s bills. Not included in {name}’s total.</p>
          </section>
        )}
      </div>
    </HomeAreaFrame>
  )
}
