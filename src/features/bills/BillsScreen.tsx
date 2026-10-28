import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useUnsavedChanges } from '../../app/unsavedChanges'
import { Icon } from '../../components/Icon'
import type { YearMonth } from '../../domain/calendar'
import { billsForMonth, groupBillsByDay, setBillMonthAmount, setBillPaid, summarizeBills, type BillOccurrence } from '../../domain/finance/bills'
import { ownerColor, ownerName } from '../../domain/finance/space'
import type { FinanceData, Id, RecurringBill } from '../../domain/finance/types'
import type { CalendarDate } from '../../domain/goalTime'
import { useAllAmounts, type BlockAmounts } from '../../ui/amountVisibility'
import { formatDate, formatLongDate, formatYearMonth } from '../../ui/format'
import { parseMoneyInput } from '../../ui/moneyInput'
import { AllAmountsToggle } from '../../ui/privacy'
import { isKept, type ChangeSpace } from '../../ui/saveOutcome'
import { useSaver, useWriteStatus } from '../../app/writeStatus'
import { LeftToPayMessage } from '../home/LeftToPay'
import { MonthSwitch } from '../../components/MonthSwitch'
import { BillsCalendar } from './BillsCalendar'
import { FILTER_NAMES, filterBills, selectedDay, shortDay, type BillsFilter, type BillsMode, type BillsView } from './billsView'

type Props = {
  data: FinanceData
  months: YearMonth[]
  month: YearMonth
  today: CalendarDate
  isDemo: boolean
  /** Calendar or List, the filter and the chosen day: kept by the app for the session. */
  view: BillsView
  onViewChange: (view: BillsView) => void
  onMonthChange: (month: YearMonth) => void
  onChange: ChangeSpace
  /** Opens a bill; `returnKey` names the button that opened it (data-return-key), which gets the focus back on return. */
  onOpenBill: (id: Id, returnKey: string) => void
  /** Add Bill at the top: an empty form. */
  onAddBill: () => void
  /** + Add Bill in the day panel: the form starts on that day and month. */
  onAddBillOn: (date: CalendarDate) => void
}

const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`
const MODES: { id: BillsMode; label: string }[] = [{ id: 'calendar', label: 'Calendar' }, { id: 'list', label: 'List' }]
const FILTERS: BillsFilter[] = ['all', 'pending', 'paid']
const DAY_LIST_ID = 'bills-day-list'
const CALENDAR_ID = 'bills-calendar'

/** Smooth scrolling, unless the device asks for reduced motion. */
const scrollBehavior = (): ScrollBehavior => (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth')

/**
 * Bills: the shared month as a calendar (first) or a list. The totals are
 * always for the whole month; the All / Pending / Paid filter only chooses
 * which bills are shown, in both views. Paid status and amount changes
 * apply to the chosen month only, and only through their own buttons.
 */
export function BillsScreen({ data, months, month, today, isDemo, view, onViewChange, onMonthChange, onChange, onOpenBill, onAddBill, onAddBillOn }: Props) {
  const all = billsForMonth(data, month)
  const summary = summarizeBills(all)
  const shown = filterBills(all, view.filter)
  const amounts = useAllAmounts(data.space.currency)
  // A bill just added from the day panel: the calendar shows its day in this month.
  const added = view.added ? { ...view.added, bill: data.bills.find(b => b.id === view.added?.id), here: all.find(o => o.bill.id === view.added?.id) } : null
  const selected = selectedDay(month, added?.here?.dueDate ?? view.selected, today, shown)
  const monthLabel = formatYearMonth(month)
  const unknownPaid = summary.unknownCount - summary.unpaidUnknownCount
  const counts: Record<BillsFilter, number> = { all: summary.count, pending: summary.count - summary.paidCount, paid: summary.paidCount }
  // Any other change of day, view, filter or month ends the "Bill added" notice.
  const set = (patch: Partial<BillsView>) => onViewChange({ ...view, added: null, ...patch })
  // A new month starts again from its own useful day.
  const changeMonth = (next: YearMonth) => { set({ selected: null }); onMonthChange(next) }
  const dayBills = shown.filter(o => o.dueDate === selected)

  // Where the view and the focus go after the render: the day panel, the calendar, or the new bill once Show All shows it.
  const move = useRef<'panel' | 'calendar' | 'added' | null>(null)
  useEffect(() => {
    const target = move.current
    move.current = null
    if (target === 'panel') {
      document.getElementById(`${DAY_LIST_ID}-title`)?.focus({ preventScroll: true })
      // The fixed header never covers the date: html's scroll-padding-top leaves its height free.
      document.getElementById(DAY_LIST_ID)?.scrollIntoView?.({ block: 'start', behavior: scrollBehavior() })
    } else if (target === 'calendar') {
      document.querySelector<HTMLElement>('.cal-cell.is-selected .cal-day')?.focus({ preventScroll: true })
      document.getElementById(CALENDAR_ID)?.scrollIntoView?.({ block: 'start', behavior: scrollBehavior() })
    } else if (target === 'added') {
      document.querySelector<HTMLElement>('[data-return-key="added-notice"]')?.focus()
    }
  })
  /** "View day details" and "+N more": the day (if a new one) is chosen, then the view and the focus go to its panel. */
  const showDay = (date?: CalendarDate) => { move.current = 'panel'; if (date && date !== selected) set({ selected: date }); else onViewChange({ ...view }) }
  const backToCalendar = () => { move.current = 'calendar'; onViewChange({ ...view }) }
  const showAll = () => { move.current = 'added'; onViewChange({ ...view, filter: 'all' }) }
  const countLine = (count: number, unknown: number) => `${plural(count, 'bill', 'bills')}${unknown > 0 ? ` · ${unknown} unknown` : ''}`

  return (
    <div className="tab-screen bills-screen">
      <div className="screen-top">
        <h1 className="tab-title">Bills</h1>
        <button type="button" className="button-small button-small-primary" onClick={onAddBill}><Icon name="plus" size={16} /> Add Bill</button>
      </div>
      <MonthSwitch months={months} value={month} onChange={changeMonth} />

      <section className="bills-summary" aria-labelledby="bills-summary-title">
        <div className="section-head">
          <h2 id="bills-summary-title" className="section-title">Whole month</h2>
          <span className="no-print"><AllAmountsToggle /></span>
        </div>
        <div className="stat-grid three">
          <div className="stat"><small>Planned</small><b>{amounts.money(summary.knownTotal)}</b><small>{countLine(summary.count, summary.unknownCount)}</small></div>
          <div className="stat"><small>Paid</small><b>{amounts.money(summary.knownTotal - summary.leftToPay)}</b><small>{countLine(summary.paidCount, unknownPaid)}</small></div>
          <div className="stat"><small>Left to Pay</small><b>{amounts.money(summary.leftToPay)}</b><small>{countLine(summary.count - summary.paidCount, summary.unpaidUnknownCount)}</small></div>
        </div>
        {summary.unknownCount > 0 && (
          <p className="muted-note">{summary.unknownCount === 1 ? '1 bill has an unknown amount.' : `${summary.unknownCount} bills have an unknown amount.`} The totals include known amounts only.</p>
        )}
        <LeftToPayMessage bills={summary} month={month} />
      </section>

      <div className="bills-toolbar no-print">
        <div className="segmented" role="group" aria-label="View">
          {MODES.map(mode => (
            <button key={mode.id} type="button" aria-pressed={view.mode === mode.id} className={view.mode === mode.id ? 'is-active' : ''} onClick={() => set({ mode: mode.id })}>{mode.label}</button>
          ))}
        </div>
        <div className="segmented" role="group" aria-label="Show bills">
          {FILTERS.map(filter => (
            <button key={filter} type="button" aria-pressed={view.filter === filter} className={view.filter === filter ? 'is-active' : ''} onClick={() => set({ filter })}>
              {FILTER_NAMES[filter]} <span className="filter-count">{counts[filter]}</span>
            </button>
          ))}
        </div>
      </div>
      {view.filter !== 'all' && <p className="muted-note no-print">Showing {view.filter} bills only. Planned, Paid and Left to Pay are still for the whole month.</p>}

      {summary.count === 0 && (
        <div className="empty-block">
          <p>No bills for {monthLabel}.</p>
          <p className="no-print">Tap Add Bill to add one.</p>
        </div>
      )}

      {summary.count > 0 && view.mode === 'calendar' && (
        <div className="no-print bills-calendar-view">
          {/* The day bar sticks under the header only while the calendar is in view, so it never covers the day panel. */}
          <div id={CALENDAR_ID} className="cal-scope">
            <DayBar date={selected} bills={dayBills} filter={view.filter} monthLabel={monthLabel} onShow={() => showDay()} />
            <BillsCalendar month={month} shown={shown} selected={selected} today={today} isDemo={isDemo} amounts={amounts} listId={DAY_LIST_ID}
              onSelect={date => set({ selected: date })} onShowDay={showDay} onOpenBill={id => onOpenBill(id, `chip-${id}`)} />
          </div>
          <DayList id={DAY_LIST_ID} date={selected} bills={dayBills} filter={view.filter} monthLabel={monthLabel} amounts={amounts}
            notice={added && <AddedNotice added={added} shown={dayBills.some(o => o.bill.id === added.id)} filter={view.filter} month={month} monthLabel={monthLabel} onShowAll={showAll} />}
            onOpenBill={id => onOpenBill(id, `row-${id}`)} onAdd={onAddBillOn} onBack={backToCalendar} />
        </div>
      )}

      {summary.count > 0 && view.mode === 'list' && (
        <div className="bill-list no-print">
          {shown.length === 0 && <div className="empty-block"><p>No {view.filter} bills in {monthLabel}.</p></div>}
          {groupBillsByDay(shown).map(day => (
            <section key={day.dueDate} className="bill-list-day" aria-labelledby={`bill-date-${day.dueDate}`}>
              <h2 id={`bill-date-${day.dueDate}`} className="bill-list-date">{formatLongDate(day.dueDate)}</h2>
              {day.occurrences.map(occurrence => (
                <BillItem key={occurrence.bill.id} data={data} occurrence={occurrence} today={today} amounts={amounts} onChange={onChange} onOpenBill={id => onOpenBill(id, `details-${id}`)} />
              ))}
            </section>
          ))}
        </div>
      )}

      <PrintList bills={all} monthLabel={monthLabel} amounts={amounts} data={data} />
    </div>
  )
}

/**
 * One slim line above the calendar: the chosen day, how many bills it has,
 * and a way down to its panel. It sticks under the header while the
 * calendar scrolls, so a day in the last rows still has it in sight. No
 * amounts here, so it never needs hiding.
 */
function DayBar({ date, bills, filter, monthLabel, onShow }: {
  date: CalendarDate | null; bills: BillOccurrence[]; filter: BillsFilter; monthLabel: string; onShow: () => void
}) {
  const pending = bills.filter(o => !o.paid).length
  const kind = filter === 'all' ? '' : `${filter} `
  return (
    <div className="cal-daybar">
      <p className="cal-daybar-text">
        {date
          ? <><b>{shortDay(date)}</b> · {bills.length === 0 ? `No ${kind}bills` : `${plural(bills.length, `${kind}bill`, `${kind}bills`)}${pending > 0 && filter === 'all' ? ` · ${pending} pending` : ''}`}</>
          : `No ${kind}bills in ${monthLabel}`}
      </p>
      <button type="button" className="cal-daybar-go" aria-controls={DAY_LIST_ID} onClick={onShow}>View day details <span aria-hidden="true">↓</span></button>
    </div>
  )
}

/**
 * After + Add Bill in the day panel: what happened to the save, and why the
 * new bill may not be in sight (the filter hides it, or it starts in a later
 * month). The filter is never changed without asking: Show All does it.
 */
function AddedNotice({ added, shown, filter, month, monthLabel, onShowAll }: {
  added: { message: string; bill?: RecurringBill; here?: BillOccurrence }; shown: boolean; filter: BillsFilter; month: YearMonth; monthLabel: string; onShowAll: () => void
}) {
  if (!added.bill) return null
  const hiddenByFilter = !!added.here && !shown && filter !== 'all'
  const why = added.here
    ? (hiddenByFilter ? ` The ${FILTER_NAMES[filter]} filter hides it.` : '')
    : (added.bill.startMonth > month ? ` It is not in ${monthLabel}: it starts in ${formatYearMonth(added.bill.startMonth)}.` : '')
  return (
    <div className="cal-added">
      <p role="status" tabIndex={-1} data-return-key="added-notice">{added.message}{why}</p>
      {hiddenByFilter && <button type="button" className="button-small" onClick={onShowAll}>Show All</button>}
    </div>
  )
}

/**
 * The chosen day's bills, under the calendar. Each line opens its bill;
 * nothing here marks a bill paid. + Add Bill starts a bill on this day, and
 * Back to calendar returns to the chosen day.
 */
function DayList({ id, date, bills, filter, monthLabel, amounts, notice, onOpenBill, onAdd, onBack }: {
  id: string; date: CalendarDate | null; bills: BillOccurrence[]; filter: BillsFilter; monthLabel: string; amounts: BlockAmounts
  notice: ReactNode; onOpenBill: (id: Id) => void; onAdd: (date: CalendarDate) => void; onBack: () => void
}) {
  const kind = filter === 'all' ? '' : `${filter} `
  return (
    <section id={id} className="block cal-day-list" aria-labelledby={`${id}-title`}>
      <div className="cal-day-head">
        <h2 id={`${id}-title`} className="section-title" tabIndex={-1}>{date ? formatLongDate(date) : monthLabel}</h2>
        <div className="cal-day-actions">
          {date && (
            <button type="button" className="button-small button-small-primary" aria-label={`Add Bill on ${formatLongDate(date)}`} data-return-key="day-add" onClick={() => onAdd(date)}>
              <Icon name="plus" size={16} /> Add Bill
            </button>
          )}
          <button type="button" className="text-button cal-back" onClick={onBack}>Back to calendar <span aria-hidden="true">↑</span></button>
        </div>
      </div>
      {notice}
      {!date && <p className="muted-note">No {kind}bills in {monthLabel}.</p>}
      {date && bills.length === 0 && <p className="muted-note">No {kind}bills due on this day.</p>}
      {bills.length > 0 && (
        <ul className="line-list">
          {bills.map(o => (
            <li key={o.bill.id}>
              <button type="button" className="line-button cal-bill-row" data-return-key={`row-${o.bill.id}`} onClick={() => onOpenBill(o.bill.id)}
                aria-label={`${o.bill.name}, ${o.amount === null ? 'unknown amount' : amounts.spoken(o.amount)}, ${o.paid ? 'paid' : 'pending'}. Open bill`}>
                <span>{o.bill.name}<small>{o.bill.category}{o.amountChangedThisMonth ? ' · Changed for this month' : ''}</small></span>
                <span className="cal-bill-end">
                  <b>{o.amount === null ? 'Unknown' : amounts.money(o.amount)}</b>
                  <span className={`status-tag${o.paid ? ' is-paid' : ''}`}>{o.paid ? '✓ Paid' : '○ Pending'}</span>
                </span>
                <Icon name="chevronRight" size={18} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

/** What Bills prints, whatever the view on screen: every bill of the month in date order. */
function PrintList({ bills, monthLabel, amounts, data }: { bills: BillOccurrence[]; monthLabel: string; amounts: BlockAmounts; data: FinanceData }) {
  if (bills.length === 0) return null
  return (
    <table className="print-only bills-print">
      <caption>Bills for {monthLabel} (whole month)</caption>
      <thead><tr><th scope="col">Date</th><th scope="col">Bill</th><th scope="col">Status</th><th scope="col">Amount</th></tr></thead>
      <tbody>
        {bills.map(o => {
          const paidOn = data.billMonths.find(record => record.billId === o.bill.id && record.month === o.month)?.paidOn
          return (
            <tr key={o.bill.id}>
              <td>{formatDate(o.dueDate)}</td>
              <td>{o.bill.name}</td>
              <td>{o.paid ? (paidOn ? `Paid on ${formatDate(paidOn)}` : 'Paid') : 'Pending'}</td>
              <td>{o.amount === null ? 'Unknown' : amounts.money(o.amount)}</td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

function BillItem({ data, occurrence, today, amounts, onChange, onOpenBill }: {
  data: FinanceData; occurrence: BillOccurrence; today: CalendarDate; amounts: BlockAmounts; onChange: Props['onChange']; onOpenBill: (id: Id) => void
}) {
  const { bill, month, amount, paid, amountChangedThisMonth } = occurrence
  const [editing, setEditing] = useState(false)
  const [text, setText] = useState('')
  const [error, setError] = useState(false)
  const monthName = formatYearMonth(month)
  const { revision } = useWriteStatus()
  const saver = useSaver()
  // The revision the amount editor was opened on.
  const [base, setBase] = useState(revision)
  useUnsavedChanges(`Amount for ${monthName}: ${bill.name}`, editing ? { 'Amount': text } : null)

  const startEditing = () => { setText(amount === null ? '' : (amount / 100).toFixed(2)); setError(false); setBase(revision); saver.clearRefusal(); setEditing(true) }
  // The editor closes only once the change is kept; otherwise it stays open with what was typed.
  const saveAmount = async (value: number | null | undefined) => {
    const outcome = await saver.save(() => onChange(current => setBillMonthAmount(current, bill.id, month, value), base))
    if (isKept(outcome)) setEditing(false)
  }
  const saveTyped = () => {
    const value = parseMoneyInput(text)
    if (value === null) { setError(true); return }
    void saveAmount(value)
  }

  return (
    <div className="bill-item">
      <div className="bill-line">
        <span className="bill-name"><i className="owner-dot" style={{ background: ownerColor(data.space, bill.owner) }} aria-hidden="true" />{bill.name}</span>
        <b>{amount === null ? 'Unknown' : amounts.money(amount)}</b>
      </div>
      <div className="bill-line">
        <small>{bill.category} · {ownerName(data.space, bill.owner)}{amountChangedThisMonth && ' · Changed for this month'}</small>
        <button type="button" className={`paid-toggle${paid ? ' is-paid' : ''}`} aria-pressed={paid} aria-label={`${bill.name} paid in ${monthName}`}
          aria-disabled={saver.blocked || undefined} onClick={() => void saver.save(() => onChange(current => setBillPaid(current, bill.id, month, !paid, today)))}>
          {paid ? '✓ Paid' : '○ Pending'}
        </button>
      </div>
      {!editing && (
        <div className="inline-actions">
          <button type="button" className="text-button" aria-label={`Change Amount for ${monthName}: ${bill.name}`} onClick={startEditing}>Change Amount for {monthName}</button>
          <button type="button" className="text-button" aria-label={`${bill.name} details`} data-return-key={`details-${bill.id}`} onClick={() => onOpenBill(bill.id)}>Details</button>
        </div>
      )}
      {editing && (
        <div className="amount-editor">
          <label className="form-field">Amount for {monthName} ({data.space.currency})
            <input inputMode="decimal" value={text} aria-invalid={error} aria-describedby={error ? `amount-error-${bill.id}` : undefined} onChange={event => { setText(event.target.value); setError(false) }} />
          </label>
          {error && <p id={`amount-error-${bill.id}`} className="field-error">Enter an amount such as 120.45.</p>}
          <div className="inline-actions">
            <button type="button" className="button-small button-small-primary" aria-disabled={saver.blocked || undefined} onClick={saveTyped}>{saver.sending ? 'Saving…' : 'Save'}</button>
            <button type="button" className="button-small" aria-disabled={saver.blocked || undefined} onClick={() => void saveAmount(null)}>Not Known Yet</button>
            {amountChangedThisMonth && <button type="button" className="button-small" aria-disabled={saver.blocked || undefined} onClick={() => void saveAmount(undefined)}>Use Usual Amount</button>}
            <button type="button" className="button-small" onClick={() => setEditing(false)}>Cancel</button>
          </div>
          <p className="field-help">Only {monthName} changes. To change the usual amount for the months ahead, open Details. Paying a loan bill never changes the loan balance.</p>
        </div>
      )}
      {saver.refusal && <p className="field-error" role="alert">{saver.refusal}</p>}
    </div>
  )
}
