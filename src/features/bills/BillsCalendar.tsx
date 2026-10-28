import { useEffect, useRef, type KeyboardEvent } from 'react'
import { daysInMonth, monthWeeks, weekdayIndexMondayFirst, type YearMonth } from '../../domain/calendar'
import type { BillOccurrence } from '../../domain/finance/bills'
import type { Id } from '../../domain/finance/types'
import type { CalendarDate } from '../../domain/goalTime'
import type { BlockAmounts } from '../../ui/amountVisibility'
import { formatLongDate, formatYearMonth, WEEK_HEADINGS } from '../../ui/format'
import { cellBills } from './billsView'

type Props = {
  month: YearMonth
  /** The bills the filter shows, in date order. */
  shown: BillOccurrence[]
  selected: CalendarDate | null
  /** Today in the own space, the demo's date in the demo. */
  today: CalendarDate
  isDemo: boolean
  amounts: BlockAmounts
  /** Id of the day list below, which the day buttons control. */
  listId: string
  onSelect: (date: CalendarDate) => void
  /** "+N more": chooses the day and goes to its panel. */
  onShowDay: (date: CalendarDate) => void
  onOpenBill: (id: Id) => void
}

/** Bills a wide calendar cell shows; with more, one bill and "+N more" (which opens the day's full list). */
const CELL_LIMIT = 2
/** Little marks a phone cell shows (paid ✓ or pending ○) before "+". */
const MARK_LIMIT = 3

const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`

/**
 * The month as a calendar, Monday first. Each bill sits on its due date for
 * this month (a day the month lacks moves to its last day). A day is a
 * button that chooses it without moving the page; its bills are listed
 * under the calendar ("+N more" also goes down to them). On wide
 * screens a cell also shows up to two bills, each opening its bill. No
 * cell ever marks a bill paid or moves it.
 *
 * Keyboard: one Tab stop for the days; the arrows move a day or a week,
 * Home and End go to the start and end of the week. The bill names in the
 * cells are for the mouse: the same bills are in the list below.
 */
export function BillsCalendar({ month, shown, selected, today, isDemo, amounts, listId, onSelect, onShowDay, onOpenBill }: Props) {
  const dayButtons = useRef(new Map<CalendarDate, HTMLButtonElement>())
  const focusNext = useRef<CalendarDate | null>(null)
  const byDay = new Map<CalendarDate, BillOccurrence[]>()
  for (const occurrence of shown) byDay.set(occurrence.dueDate, [...(byDay.get(occurrence.dueDate) ?? []), occurrence])
  const last = daysInMonth(Number(month.slice(0, 4)), Number(month.slice(5, 7)))
  const tabStop = selected ?? `${month}-01`
  const referenceName = isDemo ? 'the demo’s date' : 'today'

  useEffect(() => {
    if (!focusNext.current) return
    dayButtons.current.get(focusNext.current)?.focus()
    focusNext.current = null
  })

  const moveFrom = (date: CalendarDate, event: KeyboardEvent<HTMLButtonElement>) => {
    const day = Number(date.slice(8))
    const weekday = weekdayIndexMondayFirst(date)
    const target = {
      ArrowLeft: day - 1, ArrowRight: day + 1, ArrowUp: day - 7, ArrowDown: day + 7,
      Home: Math.max(1, day - weekday), End: Math.min(last, day + 6 - weekday),
    }[event.key]
    if (target === undefined) return
    event.preventDefault()
    // The calendar stays in its month: the month is changed with the month selector.
    if (target < 1 || target > last) return
    const next = `${month}-${String(target).padStart(2, '0')}`
    focusNext.current = next
    onSelect(next)
  }

  return (
    <div className="bills-calendar-wrap">
      <table className="bills-calendar">
        <caption className="visually-hidden">Bills calendar for {formatYearMonth(month)}. Choose a day to see its bills below.</caption>
        <thead>
          <tr>{WEEK_HEADINGS.map(day => <th key={day.short} scope="col" abbr={day.full}>{day.short}</th>)}</tr>
        </thead>
        <tbody>
          {monthWeeks(month).map(week => (
            <tr key={week.find(Boolean)}>
              {week.map((date, index) => {
                if (!date) return <td key={`empty-${index}`} className="cal-empty" />
                const dayBills = byDay.get(date) ?? []
                const paid = dayBills.filter(o => o.paid).length
                const isSelected = date === selected
                const isReference = date === today
                const { shown: inCell, more } = cellBills(dayBills, CELL_LIMIT)
                const label = [
                  formatLongDate(date),
                  ...(isReference ? [referenceName] : []),
                  dayBills.length === 0 ? 'no bills' : `${plural(dayBills.length, 'bill', 'bills')}: ${paid} paid, ${dayBills.length - paid} pending`,
                ].join(', ')
                return (
                  <td key={date} className={`cal-cell${isSelected ? ' is-selected' : ''}${isReference ? ' is-reference' : ''}${dayBills.length > 0 ? ' has-bills' : ''}`}>
                    <button type="button" className="cal-day" aria-label={label} aria-pressed={isSelected} aria-controls={listId}
                      tabIndex={date === tabStop ? 0 : -1} ref={element => { if (element) dayButtons.current.set(date, element); else dayButtons.current.delete(date) }}
                      onClick={() => onSelect(date)} onKeyDown={event => moveFrom(date, event)}>
                      <span className="cal-num">{Number(date.slice(8))}</span>
                      {dayBills.length > 0 && (
                        <span className="cal-marks" aria-hidden="true">
                          {dayBills.slice(0, MARK_LIMIT).map(o => <i key={o.bill.id} className={o.paid ? 'is-paid' : 'is-pending'} />)}
                          {dayBills.length > MARK_LIMIT && <small>+{dayBills.length - MARK_LIMIT}</small>}
                        </span>
                      )}
                    </button>
                    {inCell.length > 0 && (
                      <ul className="cal-chips">
                        {inCell.map(o => (
                          <li key={o.bill.id}>
                            <button type="button" tabIndex={-1} className={`cal-chip${o.paid ? ' is-paid' : ''}`} title={o.bill.name} data-return-key={`chip-${o.bill.id}`}
                              aria-label={`${o.bill.name}, ${o.amount === null ? 'unknown amount' : amounts.spoken(o.amount)}, ${o.paid ? 'paid' : 'pending'}. Open bill`}
                              onClick={() => onOpenBill(o.bill.id)}>
                              <span className="cal-chip-name"><span aria-hidden="true">{o.paid ? '✓' : '○'}</span> {o.bill.name}</span>
                              <span className="cal-chip-amount">{o.amount === null ? 'Unknown' : amounts.money(o.amount)} · {o.paid ? 'Paid' : 'Pending'}</span>
                            </button>
                          </li>
                        ))}
                        {more > 0 && (
                          <li><button type="button" tabIndex={-1} className="cal-more" aria-label={`${more} more bills on ${formatLongDate(date)}`}
                            onClick={() => onShowDay(date)}>+{more} more</button></li>
                        )}
                      </ul>
                    )}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="cal-legend" aria-hidden="true">
        <span><i className="cal-key is-selected" /> Chosen day</span>
        {today.startsWith(month) && <span><i className="cal-key is-reference" /> {isDemo ? 'Demo date' : 'Today'}</span>}
        <span><i className="cal-key-mark is-pending" /> Pending</span>
        <span><i className="cal-key-mark is-paid" /> Paid</span>
      </p>
    </div>
  )
}
