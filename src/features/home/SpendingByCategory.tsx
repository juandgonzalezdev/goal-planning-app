import { useId, useState } from 'react'
import { Icon } from '../../components/Icon'
import type { YearMonth } from '../../domain/calendar'
import type { CalendarDate } from '../../domain/goalTime'
import { monthSpending, type SpendingItem } from '../../domain/finance/spending'
import { largestDeficit, opportunities } from '../../domain/finance/subscriptions'
import type { FinanceData, Id, SpendingCategory } from '../../domain/finance/types'
import type { BillsChartView } from '../../data/uiPrefs'
import { barPercent } from '../../ui/chart'
import { SPENDING_COLORS } from '../../ui/chartColors'
import { formatDate, formatYearMonth, monthName } from '../../ui/format'
import { EyeToggle } from '../../ui/privacy'
import { useBlockAmounts } from '../../ui/amountVisibility'
import type { ChangeSpace } from '../../ui/saveOutcome'
import { billsByCategory } from '../../domain/finance/home'
import { Donut } from './Donut'
import { HomeBlockFrame } from './HomeBlock'
import { PlannedBills } from './PlannedBills'

type Props = {
  data: FinanceData
  month: YearMonth
  today: CalendarDate
  view: BillsChartView
  onViewChange: (view: BillsChartView) => void
  onChange: ChangeSpace
  onOpenBill: (id: Id) => void
  onOpenExpense: (id: Id) => void
}

const NATURE_TAGS = { regular: null, annual: 'Once a year', exceptional: 'One-off' } as const

/**
 * Where did my money go? Real spending of the month by category (or the
 * planned bills, with Planned). A category opens its items; each item
 * opens the bill or the record behind it. Ideas to Review lists what could
 * be looked at, with its yearly effect, never as advice.
 */
export function SpendingByCategory(props: Props) {
  const { data, month, today, view, onViewChange } = props
  const [mode, setMode] = useState<'spent' | 'planned'>('spent')
  const [chosen, setChosen] = useState<SpendingCategory | null>(null)
  const [ideasOpen, setIdeasOpen] = useState(false)
  const ideasId = useId()
  const { money, hidden } = useBlockAmounts('categories', data.space.currency)
  const spending = monthSpending(data, month)
  const focus = spending.byCategory.find(group => group.category === chosen) ?? null
  const longest = Math.max(0, ...spending.byCategory.map(group => group.total))
  const ideas = ideasOpen ? opportunities(data, today) : []
  const worst = ideasOpen ? largestDeficit(data, Number(today.slice(0, 4)), today) : null

  return (
    <HomeBlockFrame block="categories" title="Spending by Category" period={formatYearMonth(month)}
      summary={<CategoriesSummary data={data} month={month} mode={mode} spent={spending} money={money} />} actions={<EyeToggle block="categories" />}>
      <div className="segment-row">
        <div className="segmented" role="group" aria-label="Show">
          {(['spent', 'planned'] as const).map(option => (
            <button key={option} type="button" aria-pressed={mode === option} className={mode === option ? 'is-active' : ''} onClick={() => setMode(option)}>
              {option === 'spent' ? 'Spent' : 'Planned'}
            </button>
          ))}
        </div>
        <div className="segmented" role="group" aria-label="Chart type">
          {(['donut', 'bars'] as const).map(option => (
            <button key={option} type="button" aria-pressed={view === option} className={view === option ? 'is-active' : ''} onClick={() => onViewChange(option)}>
              {option === 'donut' ? 'Donut' : 'Bars'}
            </button>
          ))}
        </div>
      </div>

      {mode === 'planned'
        ? <PlannedBills data={data} month={month} view={view} onChange={props.onChange} onOpenBill={props.onOpenBill} />
        : spending.items.length === 0
          ? <p className="muted-note">Nothing spent is recorded for {formatYearMonth(month)}.</p>
          : <>
            <p className="muted-note">Spent in {formatYearMonth(month)}: paid bills, purchases and loan interest</p>
            {view === 'donut' && (
              <Donut segments={hidden ? [] : spending.byCategory.map(group => ({ value: group.total, color: SPENDING_COLORS[group.category] }))}
                caption={focus ? focus.category : 'TOTAL SPENT'} value={money(focus ? focus.total : spending.total)} />
            )}
            <div className={view === 'bars' ? 'category-bars' : 'tiles'}>
              {spending.byCategory.map(group => (
                <button key={group.category} type="button" aria-pressed={focus === group} className={focus === group ? 'is-active' : ''}
                  onClick={() => setChosen(focus === group ? null : group.category)}>
                  <span><i className="owner-dot" style={{ background: SPENDING_COLORS[group.category] }} aria-hidden="true" />{group.category}</span>
                  <b>{money(group.total)}</b>
                  {view === 'bars' && (
                    <span className="bar thin" aria-hidden="true"><span style={{ width: `${hidden ? 100 : barPercent(group.total, longest)}%`, background: hidden ? 'var(--color-track-strong)' : SPENDING_COLORS[group.category] }} /></span>
                  )}
                </button>
              ))}
            </div>
            {view === 'bars' && <p className="line total-line"><span>Total spent</span><b>{money(spending.total)}</b></p>}
            {focus && (
              <ul className="line-list" aria-label={`${focus.category} in ${monthName(month)}`}>
                {focus.items.map(item => <ItemRow key={item.key} item={item} data={data} money={money} onOpenBill={props.onOpenBill} onOpenExpense={props.onOpenExpense} />)}
              </ul>
            )}
          </>}

      <button type="button" className="text-button" aria-expanded={ideasOpen} aria-controls={ideasId} onClick={() => setIdeasOpen(!ideasOpen)}>
        {ideasOpen ? 'Hide Ideas to Review' : 'Ideas to Review'}
      </button>
      {ideasOpen && (
        <div id={ideasId} className="explain">
          <p>Spending you could look at, biggest yearly effect and easiest change first. It is a list to review, not advice: only you know what is worth it.</p>
          {ideas.length === 0 ? <p className="muted-note">Nothing to list yet.</p> : (
            <ul className="line-list" aria-label="Ideas to review">
              {ideas.slice(0, 5).map(idea => (
                <li key={idea.key}>
                  {idea.billId
                    ? <button type="button" className="line line-button" onClick={() => props.onOpenBill(idea.billId!)}>
                      <span>{idea.label}<small>Subscription · {idea.rating ? `You marked it ${idea.rating}` : 'Not classified yet'} · {idea.ease === 'easy' ? 'Can be cancelled' : idea.ease === 'hard' ? 'Hard to change' : 'Cancelling not checked'}</small></span>
                      <b>{money(idea.yearly)} a year</b><Icon name="arrowRight" size={16} />
                    </button>
                    : <div className="line">
                      <span>{idea.label}<small>About {money(idea.monthly)} a month over the last 6 months · Only you can say what it is worth</small></span>
                      <b>{money(idea.yearly)} a year</b>
                    </div>}
                </li>
              ))}
            </ul>
          )}
          {worst && <p className="field-help">For scale: your largest monthly deficit this year was {money(worst.amount)} ({formatYearMonth(worst.month)}). Small changes rarely cover a large deficit on their own.</p>}
          <p className="field-help">Money not spent is not saved automatically: Savings change only when you record savings.</p>
        </div>
      )}
    </HomeBlockFrame>
  )
}

/** The closed block's line: the total of the view chosen inside (Spent or Planned), saying which. */
function CategoriesSummary({ data, month, mode, spent, money }: {
  data: FinanceData; month: YearMonth; mode: 'spent' | 'planned'; spent: ReturnType<typeof monthSpending>; money: (minor: number) => string
}) {
  if (mode === 'spent') return <>{spent.items.length === 0 ? 'Spent · Nothing recorded' : `Spent ${money(spent.total)}`}</>
  const planned = billsByCategory(data, month)
  if (planned.categories.length === 0 && planned.unknownCount === 0) return <>Planned · No bills</>
  return <>Planned {money(planned.total)}{planned.unknownCount > 0 ? ` + ${planned.unknownCount} unknown ${planned.unknownCount === 1 ? 'amount' : 'amounts'}` : ''}</>
}

function ItemRow({ item, data, money, onOpenBill, onOpenExpense }: { item: SpendingItem; data: FinanceData; money: (minor: number) => string; onOpenBill: (id: Id) => void; onOpenExpense: (id: Id) => void }) {
  const account = item.accountId ? data.moneyAccounts.find(a => a.id === item.accountId)?.name ?? data.debts.find(d => d.id === item.accountId)?.name : null
  const tag = NATURE_TAGS[item.nature]
  const detail = [formatDate(item.date), tag, account, item.source === 'loan-interest' ? 'Interest only' : null].filter(Boolean).join(' · ')
  const open = () => (item.expenseId ? onOpenExpense(item.expenseId) : item.billId && onOpenBill(item.billId))
  return (
    <li>
      <button type="button" className="line line-button" onClick={open}>
        <span>{item.label}<small>{detail}</small></span><b>{money(item.amount)}</b><Icon name="arrowRight" size={16} />
      </button>
    </li>
  )
}
