import { useLayoutEffect, useRef, useState, type CSSProperties } from 'react'
import { useLeaveGuard } from '../../app/unsavedChanges'
import type { YearMonth } from '../../domain/calendar'
import type { CalendarDate } from '../../domain/goalTime'
import { goalMonthPosition, nextDebtPayment } from '../../domain/finance/goalRings'
import { AnimatedSaved } from './AnimatedSaved'
import { billsForMonth, summarizeBills } from '../../domain/finance/bills'
import { summarizeCards } from '../../domain/finance/debts'
import { goalProgress } from '../../domain/finance/goals'
import { monthIncome } from '../../domain/finance/income'
import { savingsSummary } from '../../domain/finance/savings'
import type { FinanceData } from '../../domain/finance/types'
import { useBlockAmounts } from '../../ui/amountVisibility'
import { formatDate, formatYearMonth } from '../../ui/format'
import type { SaveOutcome } from '../../ui/saveOutcome'
import { GoalMovementForm } from '../goals/GoalMovementForm'
import './goalRings.css'

type Area = 'income' | 'bills' | 'debts' | 'goals'
export type RingsView = 'all' | Area | `goal:${string}`
const AREAS: Area[] = ['income', 'bills', 'debts', 'goals']
const NAMES = { income: 'Income', bills: 'Bills', debts: 'Cards & Loans', goals: 'Goals' }
/** Change to false to show the current value immediately when opening a goal. */
export const DRAW_GOAL_ON_OPEN = true

type Props = {
  data: FinanceData; month: YearMonth; today: CalendarDate; asOf: CalendarDate
  newId: () => string; onChange: (data: FinanceData, base?: number) => Promise<SaveOutcome>
  onOpen: (area: Area) => void
  view?: RingsView; onViewChange?: (view: RingsView) => void
}

/** The channel is 116 wide, including round caps; labels never sit over a band. */
function bandPath(radius: number) {
  const half = Math.asin(58 / radius) + 17 / radius
  const x = Math.sin(half) * radius, y = 200 - Math.cos(half) * radius
  return `M ${200 + x} ${y} A ${radius} ${radius} 0 1 1 ${200 - x} ${y}`
}

export function GoalRings({ data, month, today, asOf, newId, onChange, onOpen, view: controlledView, onViewChange }: Props) {
  const [localView, setLocalView] = useState<RingsView>('all')
  const requestedView = controlledView ?? localView
  const view = requestedView.startsWith('goal:') && !data.goals.some(g => g.id === requestedView.slice(5) && g.status === 'active') ? 'goals' : requestedView
  const [hover, setHover] = useState<Area | null>(null)
  const [form, setForm] = useState(false)
  const [change, setChange] = useState<{ goalId: string; amount: number; before: number; after: number } | null>(null)
  const [notice, setNotice] = useState('')
  const root = useRef<HTMLElement>(null)
  const areaOrigin = useRef('area-goals')
  const focusTo = useRef<string | null>(null)
  const guard = useLeaveGuard()
  const reducedMotion = typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const incomeAmounts = useBlockAmounts('month', data.space.currency)
  const billAmounts = useBlockAmounts('left-to-pay', data.space.currency)
  const amounts = useBlockAmounts('goals', data.space.currency)
  const money = (minor: number | null) => minor === null ? (amounts.hidden ? '••••' : 'Not known') : amounts.money(minor)
  const billMoney = (minor: number | null) => minor === null ? (billAmounts.hidden ? '••••' : 'Not known') : billAmounts.money(minor)
  const savings = savingsSummary(data, asOf)
  const income = monthIncome(data, month)
  const occurrences = billsForMonth(data, month)
  const bills = summarizeBills(occurrences)
  const cards = summarizeCards(data, month, asOf)
  const goal = view.startsWith('goal:') ? data.goals.find(g => g.id === view.slice(5)) : null
  // Goal detail is current, like Goals; the area overview follows Home's balance date.
  const progress = goal ? goalProgress(goal, data.goalMovements, today) : null
  const selected: Area | null = goal ? 'goals' : AREAS.includes(view as Area) ? view as Area : null
  const time = goal ? goalMonthPosition(goal, today) : null
  const title = goal?.name ?? (selected ? NAMES[selected] : 'All areas')
  const values: Record<Area, string> = {
    income: incomeAmounts.money(income.received), bills: billAmounts.money(bills.leftToPay),
    debts: money(cards.totalBalance), goals: money(savings.assigned),
  }
  const notes = {
    income: `Received · ${formatYearMonth(month)}`, bills: `Left to pay · ${formatYearMonth(month)}${bills.unpaidUnknownCount ? ' · Some amounts unknown' : ''}`,
    debts: `Remaining Balance${cards.missingBalanceCount ? ' · Some balances unknown' : ''}`,
    goals: `Of savings assigned · by ${formatDate(asOf)}`,
  }
  const go = (next: RingsView, focus = 'rings-title') => guard(f => f.tag === 'rings-contribution', () => {
    if (view === next && !form) { root.current?.querySelector<HTMLElement>(`[data-rings-focus="${CSS.escape(focus)}"]`)?.focus(); return }
    focusTo.current = focus
    setForm(false); setHover(null); setNotice(''); setLocalView(next); onViewChange?.(next)
  })
  useLayoutEffect(() => {
    if (!focusTo.current) return
    const target = root.current?.querySelector<HTMLElement>(`[data-rings-focus="${CSS.escape(focusTo.current)}"]`)
    target?.focus(); focusTo.current = null
  }, [view, form])
  const openArea = (area: Area, origin = `area-${area}`) => { areaOrigin.current = origin; go(area) }
  const back = () => {
    if (form) guard(f => f.tag === 'rings-contribution', () => { focusTo.current = 'contribution'; setForm(false) })
    else if (goal) go('goals', `goal-${goal.id}`)
    else if (selected) go('all', areaOrigin.current)
  }
  const areaButton = (area: Area) => <button key={area} type="button" data-rings-focus={`area-${area}`}
    className={`rings-area${selected === area || hover === area ? ' is-selected' : ''}`} aria-label={`${NAMES[area]} ${notes[area]} ${values[area]}`} aria-pressed={selected === area}
    onMouseEnter={() => setHover(area)} onMouseLeave={() => setHover(null)} onFocus={() => setHover(area)} onBlur={() => setHover(null)} onClick={() => openArea(area)}>
    <span>{NAMES[area]}<small>{notes[area]}</small></span><b>{values[area]}</b>
  </button>
  const actualChange = goal && change?.goalId === goal.id ? change : null
  return <section className={`block goal-rings${reducedMotion ? ' is-reduced-motion' : ''}`} aria-label="Your money and goals" ref={root} onKeyDown={event => {
    if (event.key === 'Escape' && view !== 'all') { event.preventDefault(); event.stopPropagation(); back() }
  }}>
    <nav className="rings-crumbs" aria-label="Rings navigation">
      <button type="button" onClick={() => go('all', selected ? areaOrigin.current : 'rings-title')} aria-current={view === 'all' ? 'page' : undefined}>All areas</button>
      {selected && <><span aria-hidden="true">›</span><button type="button" onClick={() => go(selected, goal ? `goal-${goal.id}` : 'rings-title')} aria-current={!goal ? 'page' : undefined}>{NAMES[selected]}</button></>}
      {goal && <><span aria-hidden="true">›</span><span aria-current="page">{goal.name}</span></>}
    </nav>
    {view !== 'all' && <button type="button" className="back-link" onClick={back}>← {form ? 'Close Contribution' : goal ? 'Goals' : 'All areas'}</button>}
    <div className="rings-layout">
      <div className={`rings-stage${goal ? ' is-goal' : ''}${selected ? ' has-selection' : ''}`}>
        <svg viewBox="0 0 400 400" aria-hidden="true">
          <g className="rings-bands">
            {(['income', 'bills', 'debts'] as const).map((area, index) => {
              const radius = [170, 128, 86][index]
              return <g key={area} className={`rings-band${selected === area ? ' is-selected' : ''}${hover === area ? ' is-hover' : ''}`}>
                <path d={bandPath(radius)} className="rings-band-track" />
                <path d={bandPath(radius)} pathLength="100" className="rings-band-sweep" />
                <path d={bandPath(radius)} className="rings-hit" data-ring-hit={area} onClick={() => go(area)} onMouseEnter={() => setHover(area)} onMouseLeave={() => setHover(null)} />
                <rect x="142" y={200 - radius - 18} width="116" height="36" className="rings-label-hit" data-ring-label={area} onClick={() => go(area)} onMouseEnter={() => setHover(area)} onMouseLeave={() => setHover(null)} />
                <text x="200" y={200 - radius}>{NAMES[area]}</text>
              </g>
            })}
          </g>
          {goal && progress && !amounts.hidden && progress.hasTarget && <g className="rings-progress" key={goal.id}>
            <circle cx="200" cy="200" r="150" className="rings-progress-track" />
            <circle cx="200" cy="200" r="150" pathLength="100" transform="rotate(-90 200 200)" className={`rings-progress-value${DRAW_GOAL_ON_OPEN && !actualChange ? ' draw-on-open' : ''}`}
              strokeDasharray="100 100" strokeDashoffset={100 - progress.percent} style={{ '--progress-offset': 100 - progress.percent } as CSSProperties} />
            {actualChange && goal.target !== null && <circle cx="200" cy="200" r="150" pathLength="100" transform={`rotate(${actualChange.before / goal.target * 360 - 90} 200 200)`}
              className="rings-progress-new" strokeDasharray={`${Math.max(0, Math.min(100, actualChange.after / goal.target * 100) - Math.min(100, actualChange.before / goal.target * 100))} 100`} />}
          </g>}
        </svg>
        {!goal ? <button type="button" className={`rings-core${selected === 'goals' || hover === 'goals' ? ' is-selected' : ''}`} aria-label={`Open Goals, ${amounts.spoken(savings.assigned)} of savings assigned`}
          onMouseEnter={() => setHover('goals')} onMouseLeave={() => setHover(null)} onFocus={() => setHover('goals')} onBlur={() => setHover(null)} data-rings-focus="core" onClick={() => openArea('goals', 'core')}>
          <b>Goals</b><span>{values.goals}</span><small>of savings assigned</small>
        </button> : <div className="rings-goal-center"><b>{goal.name}</b><AnimatedSaved key={goal.id} value={progress!.saved} format={money} />
          <span>{goal.target === null ? 'No target set' : `of ${money(goal.target)}`}</span>
          {!amounts.hidden && progress!.hasTarget && <span>{Math.round(progress!.percent)}%</span>}
          {actualChange && !amounts.hidden && <span className="rings-added">+{money(actualChange.amount)}</span>}
        </div>}
      </div>
      <div className="rings-panel" key={view}>
        <h2 className="section-title" tabIndex={-1} data-rings-focus="rings-title">{title}</h2>
        {view === 'all' ? <><div className="rings-area-list">{AREAS.map(areaButton)}</div><p className="field-help">Ring sizes don't show amounts. They are places to go.</p></> : goal && progress ? <>
          <dl className="fact-rows"><div><dt>Saved</dt><dd>{money(progress.saved)}</dd></div><div><dt>Target</dt><dd>{money(goal.target)}</dd></div><div><dt>To go</dt><dd>{goal.target === null ? 'No target set' : money(progress.remaining)}</dd></div></dl>
          <p>{goal.deadline ? `By ${formatDate(goal.deadline)}` : 'No deadline'}</p>
          {goal.deadline && <div className="rings-timeline" aria-label="Time, separate from money progress">
            <p>Month {time?.current} of {time?.total}</p>
            {progress.pace.status === 'suggested' && progress.pace.monthly && <p>{money(progress.pace.monthly.amount)} per month · Suggested, not a payment</p>}
            {progress.pace.status === 'deadline-passed' && <p>The target date has passed.</p>}
          </div>}
          {!form && <button type="button" className="button-small button-small-primary" data-rings-focus="contribution" onClick={() => { focusTo.current = 'form'; setForm(true) }}>Add Contribution</button>}
          {form && <div tabIndex={-1} data-rings-focus="form"><GoalMovementForm key={goal.id} data={data} goal={goal} today={today} newId={newId} onChange={onChange} contributionOnly
            onSaved={(amount, before, after) => { setChange({ goalId: goal.id, amount, before, after }); setNotice('Contribution added.'); }} /></div>}
        </> : <>
          <p className="rings-main-value">{selected && values[selected]}</p><p className="field-help">{selected && notes[selected]}</p>
          {selected === 'income' && <ul className="line-list">{income.lines.filter(line => line.received).map(line => <li key={line.received!.id} className="line"><span>{line.source?.name ?? line.received!.note ?? 'Income'}<small>{formatDate(line.received!.receivedOn)}{line.received!.extraordinary ? ' · Irregular' : line.source ? ' · Regular' : ''}</small></span><b>{incomeAmounts.money(line.received!.amount)}</b></li>)}</ul>}
          {selected === 'income' && !income.lines.some(line => line.received) && <p>No income received this month.</p>}
          {selected === 'bills' && <>
            {!billAmounts.hidden && <><div className="rings-split" aria-label="Paid and left to pay"><i style={{ width: `${bills.knownTotal ? (bills.knownTotal - bills.leftToPay) / bills.knownTotal * 100 : 0}%` }} /></div><p>✓ Paid {billAmounts.money(bills.knownTotal - bills.leftToPay)} · Left to pay {billAmounts.money(bills.leftToPay)}</p></>}
            {bills.unknownCount > 0 && <p>Some bill amounts are unknown.</p>}
            <ul className="line-list">{occurrences.map(item => <li className="line" key={item.bill.id}><span>{item.bill.name}<small>{item.paid ? '✓ Paid' : `◷ Due ${formatDate(item.dueDate)}`}</small></span><b>{billMoney(item.amount)}</b></li>)}</ul>
            {!occurrences.length && <p>No bills this month.</p>}
          </>}
          {selected === 'debts' && <ul className="line-list">{cards.items.map(item => {
              const next = nextDebtPayment(data, item.debt, asOf)
              return <li className="line" key={item.debt.id}><span>{item.debt.name}<small>Remaining Balance {money(item.balance)} · {next ? `Next payment ${money(next.amount)} · ${formatDate(next.dueDate)}` : 'No next payment planned'}</small></span></li>
            })}</ul>}
          {selected === 'debts' && !cards.items.length && <p>No cards or loans yet.</p>}
          {selected === 'goals' && <>
            <p>Savings {money(savings.total)} · Assigned {money(savings.assigned)} · Unassigned {money(savings.unassigned)}</p>
            {!amounts.hidden && savings.total !== null && savings.total > 0 && savings.unassigned !== null && savings.unassigned >= 0 && <div className="rings-split" aria-label="Assigned and unassigned savings"><i style={{ width: `${savings.assigned / savings.total * 100}%` }} /></div>}
            {savings.unassigned !== null && savings.unassigned < 0 && <p>Assigned savings exceed account balances.</p>}
            <div className="rings-area-list">{savings.purposes.map(({ goal: item, saved }) => {
              const p = goalProgress(item, data.goalMovements.filter(m => m.date <= asOf), asOf)
              return <button type="button" className="rings-area" key={item.id} data-rings-focus={`goal-${item.id}`} onClick={() => go(`goal:${item.id}`)}>
                {!amounts.hidden && p.hasTarget && <svg className="rings-mini" viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="20" r="15" /><circle className="rings-mini-value" cx="20" cy="20" r="15" pathLength="100" transform="rotate(-90 20 20)" strokeDasharray={`${p.percent} 100`} /></svg>}
                <span>{item.name}<small>{money(saved)}{item.target === null ? ' · No target set' : ` of ${money(item.target)}`} · {item.deadline ? `By ${formatDate(item.deadline)}` : 'No deadline'}</small></span>
              </button>
            })}</div>
            {!savings.purposes.length && <p>No active goals yet.</p>}
          </>}
          {selected && <button type="button" className="button-small" data-return-key="rings-open" onClick={() => guard(f => f.tag === 'rings-contribution', () => onOpen(selected))}>Open {NAMES[selected]}</button>}
        </>}
      </div>
    </div>
    <p className="visually-hidden" role="status" aria-live="polite">{title}. {notice}</p>
  </section>
}
