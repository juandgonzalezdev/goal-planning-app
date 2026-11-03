import { useEffect, useId, useState, type ReactNode } from 'react'
import { FoldBlock } from '../../components/FoldBlock'
import { Icon } from '../../components/Icon'
import { monthsOfYear, type YearMonth } from '../../domain/calendar'
import type { CalendarDate } from '../../domain/goalTime'
import {
  activityLog, filterActivity, groupByDay, groupByMonth, inPeriod, typeHasCategory,
  type ActivityEntry, type ActivityType, type HistoryFilter, type HistoryMonth,
} from '../../domain/finance/history'
import { deleteExpense, deleteTransfer, type RecordError, type RecordResult } from '../../domain/finance/records'
import { incomeReceived, monthSpending } from '../../domain/finance/spending'
import { SPENDING_CATEGORIES, type FinanceData, type Id, type SpendingCategory } from '../../domain/finance/types'
import { useAllAmounts, type BlockAmounts } from '../../ui/amountVisibility'
import { barPercent } from '../../ui/chart'
import { SPENDING_COLORS } from '../../ui/chartColors'
import { formatDate, formatLongDate, formatYearMonth } from '../../ui/format'
import { AllAmountsToggle, HiddenChart } from '../../ui/privacy'
import { isKept, outcomeText, type ChangeSpace } from '../../ui/saveOutcome'
import { useWriteBlocked } from '../../app/writeStatus'
import { useLeaveGuard } from '../../app/unsavedChanges'
import {
  firstFilter, isNarrowed, tagOf, openMonthsOf, periodLabel, plural, secondaryFilters, setAllMonths, showMore, shownIn, toggleMonth, TYPE_NAMES, withFilter,
  type HistoryView,
} from './historyView'
import { ExpenseForm, HISTORY_FORM_TAG, IncomeForm, TransferForm } from './RecordForms'

type Props = {
  data: FinanceData
  months: YearMonth[]
  /** The month shown on Home, Bills and Cards: only used for History's first period. */
  month: YearMonth
  today: CalendarDate
  newId: () => string
  /** A purchase to open for editing (chosen on Home). */
  focusId: Id | null
  /** Period, search, filters, open months and records shown: kept by the app for the session. */
  view: HistoryView
  onViewChange: (view: HistoryView) => void
  onChange: ChangeSpace
  /** Opens a bill on the month of the payment chosen. */
  /** The last argument is the record's return key: Back puts the focus on it. */
  onOpenBill: (id: Id, month: YearMonth, key: string) => void
  onOpenGoal: (id: Id, key: string) => void
  /** Opens this account in Money, or the card or loan's own details. */
  onOpenAccount: (id: Id, key: string) => void
  /** + Add Spending on Home: Add Spending opens once. */
  startAdding?: boolean
  /** That form is open: the request is used up. */
  onStartedAdding?: () => void
  /** Cancel in that form: back to Home. */
  onCancelAdding?: () => void
}

const SHORT_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** `fromHome`: Add Spending opened by + Add on Home, so Cancel goes back there. */
type Editing = { kind: 'expense' | 'transfer' | 'income'; id: Id | null; fromHome?: boolean } | null

const periodValue = (period: HistoryFilter['period']) => (period.kind === 'all' ? 'all' : period.kind === 'year' ? `year:${period.year}` : `month:${period.month}`)
function periodFrom(value: string): HistoryFilter['period'] {
  if (value.startsWith('year:')) return { kind: 'year', year: Number(value.slice(5)) }
  if (value.startsWith('month:')) return { kind: 'month', month: value.slice(6) }
  return { kind: 'all' }
}

/**
 * History: every record, newest first, in groups by month and day. Its
 * period is its own (not the month shared by Home, Bills and Cards). The
 * search and More Filters only choose what the list shows; Year Overview
 * always shows the whole year. Each row keeps its type, so payments,
 * income, transfers, savings movements and balances are never mixed up.
 * Editing a record changes that record only, and every screen follows.
 */
export function HistoryScreen({ data, months, month, today, newId, focusId, view, onViewChange, onChange, onOpenBill, onOpenGoal, onOpenAccount, startAdding, onStartedAdding, onCancelAdding }: Props) {
  const amounts = useAllAmounts(data.space.currency)
  const focusExpense = focusId ? data.expenses.find(e => e.id === focusId) ?? null : null
  const filter = view.filter ?? firstFilter(month)
  // + Add Spending on Home opens Add Spending once; a purchase chosen on Home opens its own form.
  const [editing, setEditing] = useState<Editing>(() => (startAdding ? { kind: 'expense', id: null, fromHome: true }
    : focusExpense ? { kind: 'expense', id: focusExpense.id } : null))
  useEffect(() => { if (startAdding) onStartedAdding?.() }, [startAdding, onStartedAdding])
  /** Cancel closes the form; Add Spending opened from + Add on Home also goes back there. */
  const cancelEditing = () => {
    const fromHome = editing?.fromHome
    setEditing(null)
    if (fromHome) onCancelAdding?.()
  }
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [message, setMessage] = useState('')

  const log = activityLog(data)
  const inThePeriod = log.filter(entry => inPeriod(entry, filter.period))
  const entries = filterActivity(log, filter)
  const groups = groupByMonth(entries)
  const open = openMonthsOf(view, filter, groups)
  const narrowed = isNarrowed(filter)
  const accounts = [...data.moneyAccounts.map(a => ({ id: a.id, name: a.name })), ...data.debts.map(d => ({ id: d.id, name: d.name }))]
  const years = [...new Set(months.map(m => Number(m.slice(0, 4))))]
  // A purchase opened from Home is always in sight, even past the first records of its month.
  const focusPlace = focusExpense ? groups.find(g => g.entries.some(e => e.key === `expense:${focusExpense.id}`)) : undefined
  const shownFor = (group: HistoryMonth) => Math.max(shownIn(view, group.month),
    focusPlace === group ? group.entries.findIndex(e => e.key === `expense:${focusExpense!.id}`) + 1 : 0)
  const showing = groups.reduce((sum, group) => sum + (open.includes(group.month) ? Math.min(group.entries.length, shownFor(group)) : 0), 0)

  // Scrolls the purchase opened from Home into view (after the app moves the focus to the title).
  useEffect(() => {
    if (!focusId) return
    const timer = setTimeout(() => document.getElementById(`history-${focusId}`)?.scrollIntoView?.({ block: 'center' }), 0)
    return () => clearTimeout(timer)
  }, [focusId])

  // The open record form closes when another one opens, or when the list stops showing its record (another period,
  // search or filter, its month closed): the app asks first. Add Spending and Add Transfer stay above the list.
  const guard = useLeaveGuard()
  const shownAfter = (next: HistoryView, ref: { kind: string; id: Id }) => {
    const nextFilter = next.filter ?? firstFilter(month)
    const nextGroups = groupByMonth(filterActivity(log, nextFilter))
    const key = `${ref.kind}:${ref.id}`
    const group = nextGroups.find(g => g.entries.some(e => e.key === key))
    if (!group || !openMonthsOf(next, nextFilter, nextGroups).includes(group.month)) return false
    const index = group.entries.findIndex(e => e.key === key)
    return index < Math.max(shownIn(next, group.month), focusExpense && key === `expense:${focusExpense.id}` ? index + 1 : 0)
  }
  const keepsForm = (nextEditing: Editing, next: HistoryView) => {
    if (!editing) return true
    if (nextEditing?.kind !== editing.kind || nextEditing.id !== editing.id) return false
    return editing.id === null || shownAfter(next, { kind: editing.kind, id: editing.id })
  }
  const changeView = (next: HistoryView) => guard(form => form.tag === HISTORY_FORM_TAG && !keepsForm(editing, next), () => onViewChange(next))
  const openEditor = (next: Editing, then?: () => void) =>
    guard(form => form.tag === HISTORY_FORM_TAG && !keepsForm(next, view), () => { setEditing(next); then?.() })
  const change = (next: Partial<HistoryFilter>) => {
    const updated = { ...filter, ...next }
    changeView(withFilter(view, updated, groupByMonth(filterActivity(log, updated))))
  }
  const clearFilters = () => change({ search: '', type: 'all', category: 'all', accountId: 'all' })
  const blocked = useWriteBlocked()
  /** Saves a record form. Not kept: the form stays open as typed, and says why. */
  const save = (done: string) => async (make: (current: FinanceData) => RecordResult, base: number): Promise<{ errors: RecordError[]; refusal: string }> => {
    const result = make(data)
    if (result.status === 'invalid') return { errors: result.errors, refusal: '' }
    const outcome = await onChange(current => { const again = make(current); return again.status === 'invalid' ? current : again.data }, base)
    if (!isKept(outcome)) return { errors: [], refusal: outcomeText('', outcome) }
    setEditing(null)
    setMessage(outcomeText(done, outcome))
    return { errors: [], refusal: '' }
  }
  const remove = async (entry: ActivityEntry) => {
    const ref = entry.ref
    const outcome = await onChange(current => (ref.kind === 'expense' ? deleteExpense(current, ref.id) : ref.kind === 'transfer' ? deleteTransfer(current, ref.id) : current))
    setMessage(outcomeText(`${entry.label} deleted.`, outcome))
    if (isKept(outcome)) setConfirmDelete(null)
  }
  const openEntry = (entry: ActivityEntry) => {
    const ref = entry.ref
    if (ref.kind === 'bill') onOpenBill(ref.billId, ref.month, entry.key)
    else if (ref.kind === 'movement' || ref.kind === 'opening') onOpenGoal(ref.goalId, entry.key)
    else if (ref.kind === 'balance') { const snapshot = data.balances.find(b => b.id === ref.id); if (snapshot) onOpenAccount(snapshot.accountId, entry.key) }
    else openEditor(editing?.kind === ref.kind && editing.id === ref.id ? null : { kind: ref.kind, id: ref.id }, () => setConfirmDelete(null))
  }

  const where = periodLabel(filter.period)
  const typeLabel = filter.type === 'all' ? '' : TYPE_NAMES[filter.type]
  const accountLabel = accounts.find(a => a.id === filter.accountId)?.name ?? 'Deleted account'
  const chips: { label: string; clear: Partial<HistoryFilter> }[] = [
    ...(filter.type !== 'all' ? [{ label: `Type: ${typeLabel}`, clear: { type: 'all' as const } }] : []),
    ...(filter.category !== 'all' ? [{ label: `Category: ${filter.category}`, clear: { category: 'all' as const } }] : []),
    ...(filter.accountId !== 'all' ? [{ label: `Account: ${accountLabel}`, clear: { accountId: 'all' } }] : []),
  ]
  const active = secondaryFilters(filter).length
  const printFilters = [
    `Period: ${where === 'all time' ? 'All time' : where}`,
    ...(filter.search.trim() ? [`Search: “${filter.search.trim()}”`] : []),
    ...chips.map(chip => chip.label),
  ].join(' · ')

  return (
    <div className="tab-screen history-screen">
      <div className="screen-top">
        <h1 className="tab-title">History</h1>
        <span className="no-print"><AllAmountsToggle /></span>
      </div>
      <p className="muted-note">Only what was recorded, newest first. Nothing here is estimated.</p>
      <div className="inline-actions no-print">
        <button type="button" className="button-small button-small-primary" onClick={() => openEditor({ kind: 'expense', id: null })}><Icon name="plus" size={16} /> Add Spending</button>
        {data.moneyAccounts.length > 1 && <button type="button" className="button-small" onClick={() => openEditor({ kind: 'transfer', id: null })}><Icon name="plus" size={16} /> Add Transfer</button>}
      </div>
      {editing?.id === null && (editing.kind === 'expense'
        ? <ExpenseForm data={data} today={today} record={null} newId={newId} onSave={save('Spending added.')} onCancel={cancelEditing} />
        : <TransferForm data={data} today={today} record={null} newId={newId} onSave={save('Transfer added.')} onCancel={() => setEditing(null)} />)}
      <p className="muted-note no-print" role="status">{message}</p>

      <YearOverview data={data} filter={filter} today={today} amounts={amounts} expanded={view.overviewOpen}
        onToggle={() => onViewChange({ ...view, overviewOpen: !view.overviewOpen })} onChange={change} />

      <section className="history-tools no-print" aria-label="Period and search">
        <div className="filter-grid">
          <div className="form-field">
            <label htmlFor="filter-period">Period</label>
            <select id="filter-period" value={periodValue(filter.period)} onChange={e => change({ period: periodFrom(e.target.value) })}>
              <option value="all">All time</option>
              {years.map(y => <option key={y} value={`year:${y}`}>{y}</option>)}
              {months.filter(m => m <= today.slice(0, 7)).map(m => <option key={m} value={`month:${m}`}>{formatYearMonth(m)}</option>)}
            </select>
          </div>
          <div className="form-field">
            <label htmlFor="history-search">Search by name or note</label>
            <input id="history-search" type="search" value={filter.search} autoComplete="off" onChange={e => change({ search: e.target.value })} />
          </div>
        </div>
        <div className="history-filter-row">
          <button type="button" className="button-small more-filters-toggle" aria-expanded={view.moreFilters} aria-controls="history-more-filters"
            onClick={() => onViewChange({ ...view, moreFilters: !view.moreFilters })}>
            <span className="item-chevron"><Icon name="chevronDown" size={16} /></span>
            More Filters{active > 0 && <span className="filter-count">{active} on</span>}
          </button>
          {narrowed && <button type="button" className="button-small" onClick={clearFilters}>Clear Filters</button>}
        </div>
        <div id="history-more-filters" className="filter-grid more-filters" hidden={!view.moreFilters}>
          <div className="form-field">
            <label htmlFor="filter-type">Type</label>
            <select id="filter-type" value={filter.type} onChange={e => change({ type: e.target.value as HistoryFilter['type'] })}>
              <option value="all">Everything</option>
              {(Object.keys(TYPE_NAMES) as ActivityType[]).map(type => <option key={type} value={type}>{TYPE_NAMES[type]}</option>)}
            </select>
          </div>
          <div className="form-field">
            <label htmlFor="filter-category">Category</label>
            <select id="filter-category" value={filter.category} onChange={e => change({ category: e.target.value as SpendingCategory | 'all' })} aria-describedby="filter-category-help">
              <option value="all">All categories</option>
              {SPENDING_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <p id="filter-category-help" className="field-help">Spending and bill payments have a category.</p>
          </div>
          <div className="form-field">
            <label htmlFor="filter-account">Account</label>
            <select id="filter-account" value={filter.accountId} onChange={e => change({ accountId: e.target.value })}>
              <option value="all">All accounts</option>
              {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              {filter.accountId !== 'all' && !accounts.some(a => a.id === filter.accountId) && <option value={filter.accountId}>Deleted account</option>}
            </select>
          </div>
        </div>
        {chips.length > 0 && (
          <ul className="filter-chips" aria-label="Filters on">
            {chips.map(chip => (
              <li key={chip.label}>
                <button type="button" className="filter-chip" aria-label={`Remove filter ${chip.label}`} onClick={() => change(chip.clear)}>
                  {chip.label}<span aria-hidden="true" className="filter-chip-x">×</span>
                </button>
              </li>
            ))}
          </ul>
        )}
        {filter.category !== 'all' && !typeHasCategory(filter.type) && (
          <div className="filter-conflict" role="status">
            <p>{typeLabel} records have no category, so nothing can match Category: {filter.category}.</p>
            <button type="button" className="button-small" onClick={() => change({ category: 'all' })}>Remove Category</button>
          </div>
        )}
      </section>

      <p className="print-only history-print-filters">{printFilters}</p>

      <section className="history-results" aria-labelledby="history-count">
        <div className="history-count-row no-print">
          <h2 id="history-count" className="history-count">
            {plural(entries.length, 'record', 'records')}{narrowed ? ' match' : ''} <small>in {where}</small>
            {entries.length > 0 && showing < entries.length && <small className="history-showing">Showing {showing} of {entries.length}</small>}
          </h2>
          {groups.length > 0 && (
            <span className="inline-actions">
              <button type="button" className="button-small" onClick={() => changeView(setAllMonths(view, groups, true))}>Expand All</button>
              <button type="button" className="button-small" onClick={() => changeView(setAllMonths(view, groups, false))}>Collapse All</button>
            </span>
          )}
        </div>

        {log.length === 0 ? (
          <div className="empty-block">
            <p>Nothing has been recorded yet.</p>
            <p>Records appear here when you add spending, mark a bill paid, or save for a goal.</p>
            <button type="button" className="button-small no-print" onClick={() => openEditor({ kind: 'expense', id: null })}><Icon name="plus" size={16} /> Add Spending</button>
          </div>
        ) : inThePeriod.length === 0 ? (
          <div className="empty-block">
            <p>Nothing was recorded in {where}.</p>
            <button type="button" className="button-small no-print" onClick={() => change({ period: { kind: 'all' } })}>Show All Time</button>
          </div>
        ) : entries.length === 0 ? (
          <div className="empty-block">
            <p>Nothing in {where} matches {filter.search.trim() ? `“${filter.search.trim()}”` : 'these filters'}{filter.search.trim() && active > 0 ? ' with these filters' : ''}.</p>
            <p className="no-print">{plural(inThePeriod.length, 'record is', 'records are')} in {where}. Nothing was changed or deleted.</p>
            <button type="button" className="button-small no-print" onClick={clearFilters}>Clear Filters</button>
          </div>
        ) : (
          <div className="history-months no-print">
            {groups.map(group => (
              <MonthGroup key={group.month} group={group} open={open.includes(group.month)} shown={shownFor(group)}
                onToggle={() => changeView(toggleMonth(view, open, group.month))} onShowMore={() => changeView(showMore(view, group.month))}>
                {entry => <>
                  <EntryRow entry={entry} amounts={amounts} debtBalance={entry.ref.kind === 'balance' && data.debts.some(debt => entry.accountIds.includes(debt.id))} editing={!!editing && editing.id !== null && 'id' in entry.ref && entry.ref.kind === editing.kind && entry.ref.id === editing.id}
                    onOpen={() => openEntry(entry)} />
                  {editing && editing.id !== null && entry.ref.kind === editing.kind && 'id' in entry.ref && entry.ref.id === editing.id && <div className="history-edit">
                    {editing.kind === 'expense' && <ExpenseForm data={data} today={today} record={data.expenses.find(e => e.id === editing.id)!} newId={newId} onSave={save('Spending saved.')} onCancel={() => setEditing(null)} />}
                    {editing.kind === 'transfer' && <TransferForm data={data} today={today} record={data.transfers.find(t => t.id === editing.id)!} newId={newId} onSave={save('Transfer saved.')} onCancel={() => setEditing(null)} />}
                    {editing.kind === 'income' && <IncomeForm data={data} today={today} record={data.income.find(i => i.id === editing.id)!} onSave={save('Income saved.')} onCancel={() => setEditing(null)} />}
                    {editing.kind !== 'income' && (confirmDelete === entry.key
                      ? <div className="inline-actions">
                        <span>Delete this record? Only this one changes.</span>
                        <button type="button" className="button-small button-small-danger" aria-disabled={blocked || undefined} onClick={() => void remove(entry)}>Delete</button>
                        <button type="button" className="button-small" onClick={() => setConfirmDelete(null)}>Keep It</button>
                      </div>
                      : <button type="button" className="text-button" onClick={() => setConfirmDelete(entry.key)}>Delete {entry.type === 'transfer' ? 'Transfer' : 'Spending'}</button>)}
                  </div>}
                </>}
              </MonthGroup>
            ))}
          </div>
        )}
        <p className="field-help no-print">Bill payments open their bill, savings movements their goal, and balances open their account in Money or their card or loan details. Spending, transfers and income open here to change.</p>
      </section>

      <PrintList groups={groups} amounts={amounts} />
    </div>
  )
}

/** Income and spending by month for the whole year, whatever the search or filters. A month opens its categories. */
function YearOverview({ data, filter, today, amounts, expanded, onToggle, onChange }: {
  data: FinanceData; filter: HistoryFilter; today: CalendarDate; amounts: BlockAmounts; expanded: boolean
  onToggle: () => void; onChange: (next: Partial<HistoryFilter>) => void
}) {
  const todayYear = Number(today.slice(0, 4))
  const year = filter.period.kind === 'year' ? filter.period.year : filter.period.kind === 'month' ? Number(filter.period.month.slice(0, 4)) : todayYear
  const chart = monthsOfYear(year).filter(m => m <= today.slice(0, 7)).map(m => ({ month: m, income: incomeReceived(data, m).total, spending: monthSpending(data, m).total }))
  const largest = Math.max(0, ...chart.flatMap(row => [row.income, row.spending]))
  const chosenMonth = filter.period.kind === 'month' ? filter.period.month : null
  const categories = chosenMonth ? monthSpending(data, chosenMonth).byCategory : []
  const width = (value: number) => barPercent(value, largest)
  return (
    <FoldBlock title="Year Overview" period={`${year} · all records`} summary="Income and spending by month" expanded={expanded} onToggle={onToggle}
      className="history-overview">
      <p className="field-help">The chart shows everything recorded in {year}. Search and More Filters change the list only.</p>
      {chart.length === 0 ? <p className="muted-note">Nothing has happened in {year} yet.</p> : <>
        {amounts.hidden
          ? <HiddenChart amounts={amounts} />
          : <p className="chart-legend" aria-hidden="true"><span><i className="owner-dot legend-income" />Income received</span><span><i className="owner-dot legend-spending" />Spent</span></p>}
        <ul className="month-bars history-bars" aria-label={`Income and spending by month in ${year}`}>
          {chart.map(row => (
            <li key={row.month}>
              <button type="button" className={`monthly-row${chosenMonth === row.month ? ' is-active' : ''}`} aria-pressed={chosenMonth === row.month}
                aria-label={`${formatYearMonth(row.month)}: income ${amounts.spoken(row.income)}, spent ${amounts.spoken(row.spending)}. Show this month`}
                onClick={() => onChange({ period: chosenMonth === row.month ? { kind: 'year', year } : { kind: 'month', month: row.month }, category: 'all' })}>
                <span>{SHORT_MONTHS[Number(row.month.slice(5, 7)) - 1]}</span>
                {!amounts.hidden && (
                  <span className="pair-bars" aria-hidden="true">
                    <span className="bar thin"><span className="legend-income" style={{ width: `${width(row.income)}%` }} /></span>
                    <span className="bar thin"><span className="legend-spending" style={{ width: `${width(row.spending)}%` }} /></span>
                  </span>
                )}
                <small className={!amounts.hidden && row.income - row.spending < 0 ? 'amount-out' : ''}>{amounts.money(row.income - row.spending)}</small>
              </button>
            </li>
          ))}
        </ul>
        <p className="field-help">The amount on the right is the result: income received − spent. Choose a month to show it in the list and see its spending by category.</p>
      </>}
      {chosenMonth && categories.length > 0 && (
        <div role="group" aria-label={`Spending by category in ${formatYearMonth(chosenMonth)}`} className="category-bars">
          {categories.map(group => (
            <button key={group.category} type="button" aria-pressed={filter.category === group.category} className={filter.category === group.category ? 'is-active' : ''}
              aria-label={`${group.category}: ${amounts.spoken(group.total)}. ${filter.category === group.category ? 'Remove this filter' : 'Show only this category'}`}
              onClick={() => onChange({ category: filter.category === group.category ? 'all' : group.category })}>
              <span><i className="owner-dot" style={{ background: SPENDING_COLORS[group.category] }} aria-hidden="true" />{group.category}</span>
              <b>{amounts.money(group.total)}</b>
              {!amounts.hidden && <span className="bar thin" aria-hidden="true"><span style={{ width: `${barPercent(group.total, Math.max(...categories.map(item => item.total)))}%`, background: SPENDING_COLORS[group.category] }} /></span>}
            </button>
          ))}
        </div>
      )}
    </FoldBlock>
  )
}

/** One month: its heading (with every matching record counted) and, open, its records by day, a page at a time. */
function MonthGroup({ group, open, shown, onToggle, onShowMore, children }: {
  group: HistoryMonth; open: boolean; shown: number; onToggle: () => void; onShowMore: () => void; children: (entry: ActivityEntry) => ReactNode
}) {
  const id = useId()
  const count = group.entries.length
  const visible = group.entries.slice(0, shown)
  const label = formatYearMonth(group.month)
  return (
    <section className={`history-month${open ? ' is-open' : ''}`} aria-labelledby={`${id}-title`}>
      <h2 className="history-month-title">
        <button type="button" className="block-toggle" aria-expanded={open} aria-controls={`${id}-body`} onClick={onToggle}>
          <span className="block-chevron"><Icon name="chevronDown" size={18} /></span>
          <span id={`${id}-title`} className="block-name">{label}</span>
          <small className="history-month-count">{plural(count, 'record', 'records')}</small>
        </button>
      </h2>
      <div id={`${id}-body`} hidden={!open}>
        {open && <>
          {groupByDay(visible).map(day => (
            <div key={day.date} className="history-day">
              <h3 className="history-day-title">{formatLongDate(day.date)}</h3>
              <ul className="line-list history-list">
                {day.entries.map(entry => <li key={entry.key} id={`history-${entry.ref.kind === 'expense' ? entry.ref.id : entry.key}`}>{children(entry)}</li>)}
              </ul>
            </div>
          ))}
          {count > visible.length && (
            <div className="history-more">
              <small>Showing {visible.length} of {count} in {label}</small>
              <button type="button" className="button-small" aria-label={`Show More in ${label}`} onClick={onShowMore}>Show More</button>
            </div>
          )}
        </>}
      </div>
    </section>
  )
}

/** An amount, or the mask; screen readers hear "amount hidden" instead of the dots. */
function Money({ text, amounts }: { text: string; amounts: BlockAmounts }) {
  if (!amounts.hidden) return <>{text}</>
  return <><span aria-hidden="true">{text}</span><span className="visually-hidden">amount hidden</span></>
}

function amountOf(entry: ActivityEntry, amounts: BlockAmounts): { text: string; className: string } {
  if (entry.amount === null) return { text: 'Amount not known', className: '' }
  const plain = amounts.money(Math.abs(entry.amount))
  // Transfers, balances, money moved to or from a goal and savings already there are not money in or out.
  const unsigned = entry.type === 'transfer' || entry.type === 'balance' || entry.ref.kind === 'opening' || entry.effect === 'assigned' || entry.effect === 'unassigned'
    || (entry.type === 'savings' && !entry.effect)
  // Hidden, every amount is the same mask, with no sign.
  if (unsigned || amounts.hidden) return { text: plain, className: '' }
  const incoming = entry.amount >= 0
  return { text: `${incoming ? '+' : '−'}${plain}`, className: incoming && !amounts.hidden ? 'amount-in' : '' }
}

/** Details shown only on request: when the payment counts for another month, and a loan payment's split. */
function extrasOf(entry: ActivityEntry, amounts: BlockAmounts): string[] {
  return [
    entry.type === 'bill' && entry.month !== entry.date.slice(0, 7) ? `Paid on ${formatDate(entry.date)}, for ${formatYearMonth(entry.month)}` : null,
    entry.split ? `Principal ${amounts.money(entry.split.principal)} (pays the loan back, not spending) · Interest ${amounts.money(entry.split.interest)} (spending)` : null,
  ].filter((line): line is string => line !== null)
}

function EntryRow({ entry, amounts, debtBalance, editing, onOpen }: { entry: ActivityEntry; amounts: BlockAmounts; debtBalance: boolean; editing: boolean; onOpen: () => void }) {
  const [showExtras, setShowExtras] = useState(false)
  const id = useId()
  const amount = amountOf(entry, amounts)
  const extras = extrasOf(entry, amounts)
  const action = entry.ref.kind === 'bill' ? 'Open bill' : entry.ref.kind === 'movement' || entry.ref.kind === 'opening' ? 'Open goal'
    : entry.ref.kind === 'balance' ? debtBalance ? 'Open card or loan' : 'Open account' : editing ? 'Close' : 'Change'
  return (
    <>
      <div className="history-row">
        <button type="button" className="line line-button history-line" data-return-key={entry.key} onClick={onOpen} aria-expanded={entry.ref.kind === 'expense' || entry.ref.kind === 'transfer' || entry.ref.kind === 'income' ? editing : undefined}>
          <span>
            <small className={`type-tag type-${entry.type}`}>{tagOf(entry)}</small>{entry.label}
            {entry.detail && <small>{entry.detail}</small>}
            {entry.note && <small className="history-note"><span className="history-note-label">Note:</span> {entry.note}</small>}
          </span>
          <b className={amount.className}><Money text={amount.text} amounts={amounts} /></b>
          <span className="visually-hidden">. {action}</span>
          <Icon name="arrowRight" size={16} />
        </button>
        {extras.length > 0 && (
          <button type="button" className="icon-button history-extras-toggle" aria-expanded={showExtras} aria-controls={`${id}-extras`}
            aria-label={`Details: ${entry.label}`} title="Details" onClick={() => setShowExtras(!showExtras)}>
            <span className="item-chevron"><Icon name="chevronDown" size={16} /></span>
          </button>
        )}
      </div>
      {extras.length > 0 && <div id={`${id}-extras`} className="history-extras" hidden={!showExtras}>{extras.map(line => <p key={line}>{line}</p>)}</div>}
    </>
  )
}

/** What History prints: every record that matches, by month and day, even in closed months or past Show More. */
function PrintList({ groups, amounts }: { groups: HistoryMonth[]; amounts: BlockAmounts }) {
  if (groups.length === 0) return null
  return (
    <table className="print-only bills-print history-print">
      <thead><tr><th scope="col">Date</th><th scope="col">Record</th><th scope="col">Type</th><th scope="col">Amount</th></tr></thead>
      {groups.map(group => (
        <tbody key={group.month}>
          <tr className="history-print-month"><th scope="rowgroup" colSpan={4}>{formatYearMonth(group.month)} · {plural(group.entries.length, 'record', 'records')}</th></tr>
          {group.entries.map(entry => (
            <tr key={entry.key}>
              <td>{formatDate(entry.date)}</td>
              <td>{entry.label}{entry.detail && <small> · {entry.detail}</small>}{entry.note && <small> · Note: {entry.note}</small>}{extrasOf(entry, amounts).map(line => <small key={line}> · {line}</small>)}</td>
              <td>{tagOf(entry)}</td>
              <td>{amountOf(entry, amounts).text}</td>
            </tr>
          ))}
        </tbody>
      ))}
    </table>
  )
}
