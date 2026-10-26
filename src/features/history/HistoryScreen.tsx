import { useState } from 'react'
import { Icon } from '../../components/Icon'
import { monthsOfYear, type YearMonth } from '../../domain/calendar'
import type { CalendarDate } from '../../domain/goalTime'
import { activityLog, filterActivity, NO_FILTER, type ActivityEntry, type ActivityType, type HistoryFilter, type HistoryPeriod } from '../../domain/finance/history'
import { deleteExpense, deleteTransfer, type RecordError, type RecordResult } from '../../domain/finance/records'
import { incomeReceived, monthSpending } from '../../domain/finance/spending'
import { SPENDING_CATEGORIES, type FinanceData, type Id, type SpendingCategory } from '../../domain/finance/types'
import { barPercent } from '../../ui/chart'
import { SPENDING_COLORS } from '../../ui/chartColors'
import { formatAmount, formatDate, formatYearMonth } from '../../ui/format'
import { outcomeText, type SaveOutcome } from '../../ui/saveOutcome'
import { ExpenseForm, IncomeForm, TransferForm } from './RecordForms'

type Props = {
  data: FinanceData
  months: YearMonth[]
  month: YearMonth
  today: CalendarDate
  newId: () => string
  /** A purchase to open for editing (chosen on Home). */
  focusId: Id | null
  onChange: (change: (data: FinanceData) => FinanceData) => SaveOutcome
  onOpenBill: (id: Id) => void
  onOpenGoal: (id: Id) => void
}

const TYPE_NAMES: Record<ActivityType, string> = {
  income: 'Income', bill: 'Bill payments', spending: 'Spending', transfer: 'Transfers', savings: 'Savings & goals', balance: 'Balances',
}
const TYPE_TAGS: Record<ActivityType, string> = {
  income: 'Income', bill: 'Bill paid', spending: 'Spending', transfer: 'Transfer', savings: 'Savings', balance: 'Balance',
}
const SHORT_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const PAGE = 40

type Editing = { kind: 'expense' | 'transfer' | 'income'; id: Id | null } | null

const periodValue = (period: HistoryPeriod) => (period.kind === 'all' ? 'all' : period.kind === 'year' ? `year:${period.year}` : `month:${period.month}`)
function periodFrom(value: string): HistoryPeriod {
  if (value.startsWith('year:')) return { kind: 'year', year: Number(value.slice(5)) }
  if (value.startsWith('month:')) return { kind: 'month', month: value.slice(6) }
  return { kind: 'all' }
}

/**
 * Financial History: every record in one list, newest first, with
 * filters. Each entry keeps its type, so payments, income, transfers,
 * savings movements and balances are never mixed up. The chart is drawn
 * only from recorded income and spending; a month opens its categories,
 * and a category filters the list. Editing a record changes that record
 * only, and every screen follows.
 */
export function HistoryScreen({ data, months, month, today, newId, focusId, onChange, onOpenBill, onOpenGoal }: Props) {
  const money = (minor: number) => formatAmount(minor, data.space.currency)
  const focusExpense = focusId ? data.expenses.find(e => e.id === focusId) ?? null : null
  const year = Number(month.slice(0, 4))
  const [filter, setFilter] = useState<HistoryFilter>(() => (focusExpense
    ? { ...NO_FILTER, period: { kind: 'month', month: focusExpense.date.slice(0, 7) } }
    : { ...NO_FILTER, period: { kind: 'year', year } }))
  const [editing, setEditing] = useState<Editing>(() => (focusExpense ? { kind: 'expense', id: focusExpense.id } : null))
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [shown, setShown] = useState(PAGE)
  const [message, setMessage] = useState('')

  const entries = filterActivity(activityLog(data), filter)
  const chartYear = filter.period.kind === 'year' ? filter.period.year : filter.period.kind === 'month' ? Number(filter.period.month.slice(0, 4)) : year
  const chartMonths = monthsOfYear(chartYear).filter(m => m <= today.slice(0, 7))
  const chart = chartMonths.map(m => ({ month: m, income: incomeReceived(data, m).total, spending: monthSpending(data, m).total }))
  const largest = Math.max(0, ...chart.flatMap(row => [row.income, row.spending]))
  const chosenMonth = filter.period.kind === 'month' ? filter.period.month : null
  const categories = chosenMonth ? monthSpending(data, chosenMonth).byCategory : []
  const years = [...new Set(months.map(m => Number(m.slice(0, 4))))]
  const accounts = [...data.moneyAccounts.map(a => ({ id: a.id, name: a.name })), ...data.debts.map(d => ({ id: d.id, name: d.name }))]

  const set = (change: Partial<HistoryFilter>) => { setFilter({ ...filter, ...change }); setShown(PAGE) }
  const save = (done: string) => (make: (current: FinanceData) => RecordResult): RecordError[] => {
    const result = make(data)
    if (result.status === 'invalid') return result.errors
    const outcome = onChange(() => result.data)
    setEditing(null)
    setMessage(outcomeText(done, outcome))
    return []
  }
  const remove = (entry: ActivityEntry) => {
    const ref = entry.ref
    const outcome = onChange(current => (ref.kind === 'expense' ? deleteExpense(current, ref.id) : ref.kind === 'transfer' ? deleteTransfer(current, ref.id) : current))
    setConfirmDelete(null)
    setMessage(outcomeText(`${entry.label} deleted.`, outcome))
  }

  return (
    <div className="tab-screen">
      <h1 className="tab-title">Financial History</h1>
      <p className="muted-note">Only what was recorded, newest first. Nothing here is estimated.</p>

      <section className="block" aria-labelledby="history-chart">
        <h2 id="history-chart" className="section-title">Income and Spending in {chartYear}</h2>
        {chart.length === 0 ? <p className="muted-note">Nothing has happened in {chartYear} yet.</p> : <>
          <p className="chart-legend" aria-hidden="true"><span><i className="owner-dot legend-income" />Income received</span><span><i className="owner-dot legend-spending" />Spent</span></p>
          <ul className="month-bars history-bars" aria-label={`Income and spending by month in ${chartYear}`}>
            {chart.map(row => (
              <li key={row.month}>
                <button type="button" className={`monthly-row${chosenMonth === row.month ? ' is-active' : ''}`} aria-pressed={chosenMonth === row.month}
                  aria-label={`${formatYearMonth(row.month)}: income ${money(row.income)}, spent ${money(row.spending)}. Show this month`}
                  onClick={() => set({ period: chosenMonth === row.month ? { kind: 'year', year: chartYear } : { kind: 'month', month: row.month }, category: 'all' })}>
                  <span>{SHORT_MONTHS[Number(row.month.slice(5, 7)) - 1]}</span>
                  <span className="pair-bars" aria-hidden="true">
                    <span className="bar thin"><span className="legend-income" style={{ width: `${barPercent(row.income, largest)}%` }} /></span>
                    <span className="bar thin"><span className="legend-spending" style={{ width: `${barPercent(row.spending, largest)}%` }} /></span>
                  </span>
                  <small className={row.income - row.spending < 0 ? 'amount-out' : ''}>{money(row.income - row.spending)}</small>
                </button>
              </li>
            ))}
          </ul>
          <p className="field-help">The amount on the right is the result: income received − spent. Choose a month to see its spending by category.</p>
        </>}
        {chosenMonth && categories.length > 0 && (
          <div role="group" aria-label={`Spending by category in ${formatYearMonth(chosenMonth)}`} className="category-bars">
            {categories.map(group => (
              <button key={group.category} type="button" aria-pressed={filter.category === group.category} className={filter.category === group.category ? 'is-active' : ''}
                onClick={() => set({ category: filter.category === group.category ? 'all' : group.category })}>
                <span><i className="owner-dot" style={{ background: SPENDING_COLORS[group.category] }} aria-hidden="true" />{group.category}</span>
                <b>{money(group.total)}</b>
                <span className="bar thin" aria-hidden="true"><span style={{ width: `${barPercent(group.total, categories[0].total)}%`, background: SPENDING_COLORS[group.category] }} /></span>
              </button>
            ))}
          </div>
        )}
      </section>

      <section className="block" aria-labelledby="history-filters">
        <h2 id="history-filters" className="section-title">Filters</h2>
        <div className="filter-grid">
          <div className="form-field">
            <label htmlFor="filter-period">Period</label>
            <select id="filter-period" value={periodValue(filter.period)} onChange={e => set({ period: periodFrom(e.target.value) })}>
              <option value="all">All time</option>
              {years.map(y => <option key={y} value={`year:${y}`}>{y}</option>)}
              {months.filter(m => m <= today.slice(0, 7)).map(m => <option key={m} value={`month:${m}`}>{formatYearMonth(m)}</option>)}
            </select>
          </div>
          <div className="form-field">
            <label htmlFor="filter-type">Type</label>
            <select id="filter-type" value={filter.type} onChange={e => set({ type: e.target.value as HistoryFilter['type'] })}>
              <option value="all">Everything</option>
              {(Object.keys(TYPE_NAMES) as ActivityType[]).map(type => <option key={type} value={type}>{TYPE_NAMES[type]}</option>)}
            </select>
          </div>
          <div className="form-field">
            <label htmlFor="filter-category">Category</label>
            <select id="filter-category" value={filter.category} onChange={e => set({ category: e.target.value as SpendingCategory | 'all' })}>
              <option value="all">All categories</option>
              {SPENDING_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="form-field">
            <label htmlFor="filter-account">Account</label>
            <select id="filter-account" value={filter.accountId} onChange={e => set({ accountId: e.target.value })}>
              <option value="all">All accounts</option>
              {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </div>
        </div>
        <div className="inline-actions">
          <button type="button" className="button-small button-small-primary" onClick={() => setEditing({ kind: 'expense', id: null })}><Icon name="plus" size={16} /> Add Spending</button>
          {data.moneyAccounts.length > 1 && <button type="button" className="button-small" onClick={() => setEditing({ kind: 'transfer', id: null })}><Icon name="plus" size={16} /> Add Transfer</button>}
          {JSON.stringify(filter) !== JSON.stringify(NO_FILTER) && <button type="button" className="button-small" onClick={() => set(NO_FILTER)}>Clear Filters</button>}
        </div>
        {editing?.id === null && (editing.kind === 'expense'
          ? <ExpenseForm data={data} today={today} record={null} newId={newId} onSave={save('Spending added.')} onCancel={() => setEditing(null)} />
          : <TransferForm data={data} today={today} record={null} newId={newId} onSave={save('Transfer added.')} onCancel={() => setEditing(null)} />)}
        <p className="muted-note" role="status">{message}</p>
      </section>

      <section className="block" aria-labelledby="history-list">
        <h2 id="history-list" className="section-title">Records <small className="section-sub">{entries.length}</small></h2>
        {entries.length === 0 ? <p className="muted-note">Nothing matches these filters.</p> : (
          <ul className="line-list history-list">
            {entries.slice(0, shown).map(entry => (
              <li key={entry.key}>
                <EntryRow entry={entry} money={money} onOpen={() => {
                  const ref = entry.ref
                  if (ref.kind === 'bill') onOpenBill(ref.billId)
                  else if (ref.kind === 'movement' || ref.kind === 'opening') onOpenGoal(ref.goalId)
                  else if (ref.kind === 'expense' || ref.kind === 'transfer' || ref.kind === 'income') { setEditing({ kind: ref.kind, id: ref.id }); setConfirmDelete(null) }
                }} />
                {editing && editing.id !== null && (entry.ref.kind === editing.kind) && 'id' in entry.ref && entry.ref.id === editing.id && <>
                  {editing.kind === 'expense' && <ExpenseForm data={data} today={today} record={data.expenses.find(e => e.id === editing.id)!} newId={newId} onSave={save('Spending saved.')} onCancel={() => setEditing(null)} />}
                  {editing.kind === 'transfer' && <TransferForm data={data} today={today} record={data.transfers.find(t => t.id === editing.id)!} newId={newId} onSave={save('Transfer saved.')} onCancel={() => setEditing(null)} />}
                  {editing.kind === 'income' && <IncomeForm data={data} today={today} record={data.income.find(i => i.id === editing.id)!} onSave={save('Income saved.')} onCancel={() => setEditing(null)} />}
                  {editing.kind !== 'income' && (confirmDelete === entry.key
                    ? <div className="inline-actions">
                      <span>Delete this record? Only this one changes.</span>
                      <button type="button" className="button-small button-small-danger" onClick={() => remove(entry)}>Delete</button>
                      <button type="button" className="button-small" onClick={() => setConfirmDelete(null)}>Keep It</button>
                    </div>
                    : <button type="button" className="text-button" onClick={() => setConfirmDelete(entry.key)}>Delete {entry.type === 'transfer' ? 'Transfer' : 'Spending'}</button>)}
                </>}
              </li>
            ))}
          </ul>
        )}
        {entries.length > shown && <button type="button" className="button-small align-start" onClick={() => setShown(shown + PAGE)}>Show More ({entries.length - shown} left)</button>}
        <p className="field-help">Bill payments open their bill, and savings movements open their goal. Balances are changed in Data.</p>
      </section>
    </div>
  )
}

function EntryRow({ entry, money, onOpen }: { entry: ActivityEntry; money: (minor: number) => string; onOpen: () => void }) {
  const amount = entry.amount === null ? 'Amount not known'
    : entry.type === 'transfer' || entry.type === 'balance' ? money(entry.amount)
    : `${entry.amount >= 0 ? '+' : '−'}${money(Math.abs(entry.amount))}`
  const detail = [formatDate(entry.date), entry.type === 'bill' && entry.month !== entry.date.slice(0, 7) ? `For ${formatYearMonth(entry.month)}` : null, entry.detail,
    entry.split ? `Principal ${money(entry.split.principal)} · Interest ${money(entry.split.interest)}` : null].filter(Boolean).join(' · ')
  const content = <>
    <span><small className={`type-tag type-${entry.type}`}>{TYPE_TAGS[entry.type]}</small>{entry.label}<small>{detail}</small></span>
    <b className={entry.type === 'income' || (entry.type === 'savings' && (entry.amount ?? 0) > 0) ? 'amount-in' : ''}>{amount}</b>
  </>
  if (entry.type === 'balance') return <div className="line">{content}</div>
  return <button type="button" className="line line-button" onClick={onOpen}>{content}<Icon name="arrowRight" size={16} /></button>
}
