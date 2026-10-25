import { useState } from 'react'
import { amountText } from '../../ui/labels'
import type { YearMonth } from '../../domain/calendar'
import { setBillMonthAmount, type BillOccurrence } from '../../domain/finance/bills'
import { billsByCategory } from '../../domain/finance/home'
import type { BillCategory, FinanceData, Id } from '../../domain/finance/types'
import type { BillsChartView } from '../../data/uiPrefs'
import { barPercent } from '../../ui/chart'
import { CATEGORY_COLORS } from '../../ui/chartColors'
import { formatAmount, formatYearMonth, monthName } from '../../ui/format'
import { parseMoneyInput } from '../../ui/moneyInput'
import { outcomeText, type SaveOutcome } from '../../ui/saveOutcome'
import { Donut } from './Donut'

type Props = {
  data: FinanceData
  month: YearMonth
  view: BillsChartView
  onViewChange: (view: BillsChartView) => void
  onChange: (change: (data: FinanceData) => FinanceData) => SaveOutcome
  onOpenBill: (id: Id) => void
}

/**
 * Monthly Bills by Category: what the month's bills are planned for, as a
 * ring or as bars. Choosing a category lists its bills; an amount can be
 * changed right here for the chosen month only, and a bill's name opens
 * the whole bill in Bills. These are planned amounts: paid or not, they
 * are never called money spent.
 */
export function BillsByCategory({ data, month, view, onViewChange, onChange, onOpenBill }: Props) {
  const [chosen, setChosen] = useState<BillCategory | null>(null)
  const [message, setMessage] = useState('')
  const breakdown = billsByCategory(data, month)
  const money = (minor: number) => formatAmount(minor, data.space.currency)
  // A category missing from this month is simply not chosen.
  const focus = breakdown.categories.find(item => item.category === chosen) ?? null
  const longest = Math.max(0, ...breakdown.categories.map(item => item.total))
  const paid = breakdown.categories.flatMap(item => item.occurrences).filter(o => o.paid).length
  const count = breakdown.categories.reduce((sum, item) => sum + item.occurrences.length, 0)

  return (
    <section className="block home-section" aria-labelledby="home-categories">
      <div className="section-head">
        <h2 id="home-categories" className="section-title">Monthly Bills by Category</h2>
        <div className="segmented" role="group" aria-label="Chart type">
          {(['donut', 'bars'] as const).map(option => (
            <button key={option} type="button" aria-pressed={view === option} className={view === option ? 'is-active' : ''} onClick={() => onViewChange(option)}>
              {option === 'donut' ? 'Donut' : 'Bars'}
            </button>
          ))}
        </div>
      </div>
      {breakdown.categories.length === 0 && breakdown.unknownCount === 0
        ? <p className="muted-note">No bills for {formatYearMonth(month)}.</p>
        : <>
          <p className="muted-note">Planned for {formatYearMonth(month)} · {paid} of {count} paid</p>
          {view === 'donut' && (
            <Donut
              segments={breakdown.categories.map(item => ({ value: item.total, color: CATEGORY_COLORS[item.category] }))}
              caption={focus ? focus.category : 'TOTAL PLANNED'}
              value={money(focus ? focus.total : breakdown.total)}
            />
          )}
          <div className={view === 'bars' ? 'category-bars' : 'tiles'}>
            {breakdown.categories.map(item => (
              <button key={item.category} type="button" aria-pressed={focus === item} className={focus === item ? 'is-active' : ''}
                onClick={() => { setChosen(focus === item ? null : item.category); setMessage('') }}>
                <span><i className="owner-dot" style={{ background: CATEGORY_COLORS[item.category] }} aria-hidden="true" />{item.category}</span>
                <b>{money(item.total)}</b>
                {view === 'bars' && (
                  <span className="bar thin" aria-hidden="true"><span style={{ width: `${barPercent(item.total, longest)}%`, background: CATEGORY_COLORS[item.category] }} /></span>
                )}
              </button>
            ))}
          </div>
          {view === 'bars' && <p className="line total-line"><span>Total planned</span><b>{money(breakdown.total)}</b></p>}
          {focus && (
            <ul className="line-list category-bills" aria-label={`${focus.category} bills`}>
              {focus.occurrences.map(occurrence => (
                <QuickAmount key={occurrence.bill.id} data={data} occurrence={occurrence} onChange={onChange} onOpenBill={onOpenBill} onSaved={setMessage} />
              ))}
            </ul>
          )}
          <p className="muted-note" role="status">{message}</p>
          {breakdown.unknownCount > 0 && (
            <p className="muted-note">
              {breakdown.unknownCount === 1 ? 'One bill has' : `${breakdown.unknownCount} bills have`} no amount for this month yet, so it is not in the chart.
            </p>
          )}
        </>}
    </section>
  )
}

/** One bill of the chosen category, with a quick change of this month's amount. */
function QuickAmount({ data, occurrence, onChange, onOpenBill, onSaved }: {
  data: FinanceData; occurrence: BillOccurrence; onChange: Props['onChange']; onOpenBill: (id: Id) => void; onSaved: (message: string) => void
}) {
  const { bill, month, amount, paid } = occurrence
  const [text, setText] = useState<string | null>(null)
  const [error, setError] = useState(false)
  const money = (minor: number) => formatAmount(minor, data.space.currency)
  const inputId = `quick-${bill.id}`

  const save = () => {
    const value = parseMoneyInput(text ?? '')
    if (value === null) { setError(true); return }
    const outcome = onChange(current => setBillMonthAmount(current, bill.id, month, value))
    setText(null)
    onSaved(outcomeText(`${bill.name} for ${monthName(month)} is now ${money(value)}.`, outcome))
  }

  return (
    <li className="quick-bill">
      <div className="line">
        <span>
          <button type="button" className="text-button inline-link" onClick={() => onOpenBill(bill.id)}>{bill.name}</button>
          <small className={paid ? 'paid-tag' : 'pending-tag'}>{paid ? 'Paid' : 'Not paid yet'}</small>
        </span>
        <b>{amount === null ? 'Amount needed' : money(amount)}</b>
      </div>
      {text === null
        ? <button type="button" className="text-button" aria-label={`Change ${bill.name} amount for ${formatYearMonth(month)}`}
          onClick={() => { setText(amountText(amount)); setError(false); onSaved('') }}>Change amount</button>
        : <div className="amount-editor">
          <label className="form-field" htmlFor={inputId}>{bill.name} for {formatYearMonth(month)} ({data.space.currency})</label>
          <input id={inputId} className="quick-input" inputMode="decimal" value={text} aria-invalid={error} aria-describedby={`${inputId}-help`}
            onChange={event => { setText(event.target.value); setError(false) }} />
          {error && <p className="field-error">Enter an amount such as 750 or 120.45.</p>}
          <p id={`${inputId}-help`} className="field-help">Only {formatYearMonth(month)} changes. To change the usual amount for the months ahead, open {bill.name}.</p>
          <div className="inline-actions">
            <button type="button" className="button-small button-small-primary" onClick={save}>Save</button>
            <button type="button" className="button-small" onClick={() => { setText(null); setError(false) }}>Cancel</button>
          </div>
        </div>}
    </li>
  )
}
