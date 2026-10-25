import { useState } from 'react'
import { Icon } from '../components/Icon'
import type { YearMonth } from '../domain/calendar'
import { billsForMonth, groupBillsByDay, setBillMonthAmount, setBillPaid, summarizeBills, type BillOccurrence } from '../domain/finance/bills'
import { ownerColor, ownerName } from '../domain/finance/space'
import type { FinanceData, Id } from '../domain/finance/types'
import type { CalendarDate } from '../domain/goalTime'
import { formatAmount, formatYearMonth, weekdayOf } from '../ui/format'
import { parseMoneyInput } from '../ui/moneyInput'
import type { SaveOutcome } from '../ui/saveOutcome'
import { LeftToPayMessage } from './home/LeftToPay'
import { MonthSwitch } from './MonthSwitch'

type Props = {
  data: FinanceData
  months: YearMonth[]
  month: YearMonth
  today: CalendarDate
  onMonthChange: (month: YearMonth) => void
  onChange: (change: (data: FinanceData) => FinanceData) => SaveOutcome
  onOpenBill: (id: Id) => void
  onAddBill: () => void
}

const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`

/**
 * Monthly Bills (v5.9): the month's totals and its payment dates. Every
 * date starts closed and only one can be open at a time. Paid status and
 * amount changes apply to the chosen month only.
 */
export function BillsScreen({ data, months, month, today, onMonthChange, onChange, onOpenBill, onAddBill }: Props) {
  const [openDate, setOpenDate] = useState<string | null>(null)
  const occurrences = billsForMonth(data, month)
  const summary = summarizeBills(occurrences)
  const days = groupBillsByDay(occurrences)
  const money = (minor: number) => formatAmount(minor, data.space.currency)

  const changeMonth = (next: YearMonth) => { setOpenDate(null); onMonthChange(next) }

  return (
    <div className="tab-screen">
      <div className="screen-top">
        <h1 className="tab-title">Monthly Bills</h1>
        <button type="button" className="button-small button-small-primary" onClick={onAddBill}><Icon name="plus" size={16} /> Add Bill</button>
      </div>
      <MonthSwitch months={months} value={month} onChange={changeMonth} />
      <div className="stat-grid">
        <div className="stat"><small>Monthly Total</small><b>{money(summary.knownTotal)}</b><small>Planned, paid or not</small></div>
        <div className="stat"><small>Left to Pay</small><b>{money(summary.leftToPay)}</b>{summary.unpaidUnknownCount > 0 && <small>+ unknown amount</small>}</div>
      </div>
      <LeftToPayMessage bills={summary} month={month} />
      {summary.unknownCount > 0 && (
        <p className="muted-note" role="status">{summary.unknownCount === 1 ? '1 bill amount needs to be entered.' : `${summary.unknownCount} bill amounts need to be entered.`}</p>
      )}

      <h2 className="section-title">Payment Dates</h2>
      {days.length === 0 && (
        <div className="empty-block">
          <p>No bills for {formatYearMonth(month)}.</p>
          <p>Tap Add Bill to add one.</p>
        </div>
      )}
      <div className="bill-days">
        {days.map(day => {
          const isOpen = openDate === day.dueDate
          const panelId = `bills-${day.dueDate}`
          const dayNumber = Number(day.dueDate.slice(8))
          const amountText = day.summary.unknownCount === day.summary.count
            ? 'amount needed'
            : `${money(day.summary.knownTotal)}${day.summary.unknownCount > 0 ? ' plus an unknown amount' : ''}`
          const label = `${weekdayOf(day.dueDate)} ${dayNumber} ${formatYearMonth(month)}, ${plural(day.summary.count, 'payment due', 'payments due')}, ${amountText}`
          return (
            <div className="bill-day" key={day.dueDate}>
              <button type="button" className="day-head" aria-label={label} aria-expanded={isOpen} aria-controls={panelId} onClick={() => setOpenDate(isOpen ? null : day.dueDate)}>
                <span className="day-tile" aria-hidden="true"><b>{dayNumber}</b><small>{day.dueDate.slice(5, 7)}</small></span>
                <span className="day-text">
                  <b>{weekdayOf(day.dueDate)}</b>
                  <small>{plural(day.summary.count, 'payment due', 'payments due')}</small>
                </span>
                <span className="day-amount">
                  {day.summary.unknownCount === day.summary.count
                    ? <b>Amount needed</b>
                    : <><b>{money(day.summary.knownTotal)}</b>{day.summary.unknownCount > 0 && <small>+ unknown</small>}</>}
                </span>
                <Icon name={isOpen ? 'chevronUp' : 'chevronDown'} size={18} />
              </button>
              {isOpen && (
                <div id={panelId} className="day-bills">
                  {day.occurrences.map(occurrence => (
                    <BillItem key={occurrence.bill.id} data={data} occurrence={occurrence} today={today} onChange={onChange} onOpenBill={onOpenBill} />
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function BillItem({ data, occurrence, today, onChange, onOpenBill }: { data: FinanceData; occurrence: BillOccurrence; today: CalendarDate; onChange: Props['onChange']; onOpenBill: (id: Id) => void }) {
  const { bill, month, amount, paid, amountChangedThisMonth } = occurrence
  const [editing, setEditing] = useState(false)
  const [text, setText] = useState('')
  const [error, setError] = useState(false)
  const money = (minor: number) => formatAmount(minor, data.space.currency)
  const monthName = formatYearMonth(month)

  const startEditing = () => { setText(amount === null ? '' : (amount / 100).toFixed(2)); setError(false); setEditing(true) }
  const saveAmount = (value: number | null | undefined) => {
    onChange(current => setBillMonthAmount(current, bill.id, month, value))
    setEditing(false)
  }
  const saveTyped = () => {
    const value = parseMoneyInput(text)
    if (value === null) { setError(true); return }
    saveAmount(value)
  }

  return (
    <div className="bill-item">
      <div className="bill-line">
        <span className="bill-name"><i className="owner-dot" style={{ background: ownerColor(data.space, bill.owner) }} aria-hidden="true" />{bill.name}</span>
        <b>{amount === null ? 'Amount needed' : money(amount)}</b>
      </div>
      <div className="bill-line">
        <small>{bill.category} · {ownerName(data.space, bill.owner)}{amountChangedThisMonth && ' · Changed for this month'}</small>
        <button type="button" className={`paid-toggle${paid ? ' is-paid' : ''}`} aria-pressed={paid} aria-label={`${bill.name} paid in ${monthName}`}
          onClick={() => onChange(current => setBillPaid(current, bill.id, month, !paid, today))}>
          {paid ? '✓ Paid' : '○ Pending'}
        </button>
      </div>
      {!editing && (
        <div className="inline-actions">
          <button type="button" className="text-button" onClick={startEditing}>Change Amount for {monthName}</button>
          <button type="button" className="text-button" aria-label={`${bill.name} details`} onClick={() => onOpenBill(bill.id)}>Details</button>
        </div>
      )}
      {editing && (
        <div className="amount-editor">
          <label className="form-field">Amount for {monthName} ({data.space.currency})
            <input inputMode="decimal" value={text} aria-invalid={error} aria-describedby={error ? `amount-error-${bill.id}` : undefined} onChange={event => { setText(event.target.value); setError(false) }} />
          </label>
          {error && <p id={`amount-error-${bill.id}`} className="field-error">Enter an amount such as 120.45.</p>}
          <div className="inline-actions">
            <button type="button" className="button-small button-small-primary" onClick={saveTyped}>Save</button>
            <button type="button" className="button-small" onClick={() => saveAmount(null)}>Not Known Yet</button>
            {amountChangedThisMonth && <button type="button" className="button-small" onClick={() => saveAmount(undefined)}>Use Usual Amount</button>}
            <button type="button" className="button-small" onClick={() => setEditing(false)}>Cancel</button>
          </div>
          <p className="field-help">Only {monthName} changes. To change the usual amount for the months ahead, open Details. Paying a loan bill never changes the loan balance.</p>
        </div>
      )}
    </div>
  )
}
