import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react'
import type { YearMonth } from '../../domain/calendar'
import type { CalendarDate } from '../../domain/goalTime'
import { monthEnd } from '../../domain/finance/spending'
import type { FinanceData, Id } from '../../domain/finance/types'
import type { BillsChartView } from '../../data/uiPrefs'
import type { MoneyBlock } from '../money/moneyBlocks'
import { AREA_NAMES, type HomeArea } from '../../ui/amountVisibility'
import { HomeAmountsEye } from '../../ui/privacy'
import type { ChangeSpace } from '../../ui/saveOutcome'
import { formatDate, formatYearMonth } from '../../ui/format'
import { Icon } from '../../components/Icon'
import { LeftToPay } from './LeftToPay'
import { MonthSummary } from './MonthSummary'
import { SpendingByCategory } from './SpendingByCategory'
import { HomeGoals } from './HomeGoals'
import { HomeMoney } from './HomeMoney'
import { TotalDebt } from './TotalDebt'
import { YearSummary } from './YearSummary'
import { MonthSwitch } from '../../components/MonthSwitch'
import { MenuButton } from '../../components/MenuButton'
import { HomeAreaFrame } from './HomeBlock'
import { HomeBlocksContext, type HomeBlocksControl } from './homeBlocksContext'
import { DEFAULT_LAYOUT, isOpen, moveArea, setAllOpen, setOpen, type HomeLayout, type HomeSection } from './homeLayout'

/**
 * Where on Home a link was used: Back to Home finds this place again, with
 * the focus on the button (`key`, its data-return-key) or, when it is gone
 * or closed, on its part's heading, else its area's heading.
 */
export interface HomeSpot { area?: HomeArea; section?: HomeSection; key?: string }

/** What + Add opens: the forms that already exist in Money, History, Bills and Goals. */

type Props = {
  data: FinanceData
  months: YearMonth[]
  month: YearMonth
  onMonthChange: (month: YearMonth) => void
  today: CalendarDate
  chartView: BillsChartView
  onChartViewChange: (view: BillsChartView) => void
  /** Area order and open parts (own space: remembered on this device; demo: while it is open). */
  layout: HomeLayout
  onLayoutChange: (layout: HomeLayout) => void
  /** Show all in Left to Pay: kept while moving around the app. */
  showAllBills: boolean
  onShowAllBillsChange: (showAll: boolean) => void
  onChange: ChangeSpace
  onOpen: (screen: 'bills' | 'goals' | 'history' | 'emergency', spot: HomeSpot) => void
  /** Opens Money on one block (Income, Accounts & Savings, Cards & Loans), with the focus on its heading. */
  onOpenMoneyBlock: (block: MoneyBlock, spot: HomeSpot) => void
  /** Income of the month shown: Money › Income on that month's source (or the month's sources, when there are several). */
  onOpenIncome: (month: YearMonth, spot: HomeSpot) => void
  /** Spent of the month shown: History on that month. */
  onOpenSpent: (month: YearMonth, spot: HomeSpot) => void
  onOpenGoal: (id: Id, spot: HomeSpot) => void
  onOpenDebt: (id: Id, spot: HomeSpot) => void
  /** Opens a bill; `forMonth` when it belongs to another month than Home's (Coming up). */
  onOpenBill: (id: Id, spot: HomeSpot, forMonth?: YearMonth) => void
  isDemo: boolean
  onOpenExpense: (id: Id, spot: HomeSpot) => void
  emergencyLater: boolean
  onEmergencyLater: () => void
}

/** A drag only starts after the finger or mouse moves this far, so a tap on the handle moves nothing. */
const DRAG_THRESHOLD = 6

type Drag = { area: HomeArea; pointerId: number; startY: number; started: boolean; target: number; mids: { area: HomeArea; mid: number }[] }

/**
 * Home, in three areas (their order can be changed with Customize Home):
 * 1. This Month: how is my month? Its figures, then Spending by Category
 *    and Year Summary, which open and close.
 * 2. Left to Pay: what do I still have to pay, bill by bill.
 * 3. Money & Goals: the latest balances by a date (not the month's
 *    figures): Accounts & Savings, Cards & Loans and Goals, which open and close.
 * Every number is worked out from the space's records on each render, so
 * it follows any change made anywhere else. Balances are the ones entered
 * by the end of the month shown (or today, for a month still going or to
 * come): never worked back from today's balance.
 */
export function HomeScreen(props: Props) {
  const { data, months, month, onMonthChange, today, layout, onLayoutChange } = props
  const individual = data.space.mode === 'individual'
  // The date Money & Goals uses: the end of the month shown, or today when that end is still to come.
  const asOf = monthEnd(month) < today ? monthEnd(month) : today
  const [customizing, setCustomizing] = useState(false)
  const [announcement, setAnnouncement] = useState('')
  const [drag, setDrag] = useState<Drag | null>(null)
  const dragRef = useRef<Drag | null>(null)
  const blocksRef = useRef<HTMLDivElement>(null)
  const focusAfterMove = useRef<{ area: HomeArea; direction: 'up' | 'down' } | null>(null)
  const customizeRef = useRef<HTMLDivElement>(null)
  const optionsRef = useRef<HTMLDivElement>(null)
  // Customize Home puts the keyboard on its instructions; Done puts it back on Home options.
  const focusAfterCustomize = useRef<'panel' | 'options' | null>(null)
  const name = (area: HomeArea) => (area === 'money-goals' && !individual ? 'Our Money & Goals' : AREA_NAMES[area])

  const move = (area: HomeArea, to: number, direction?: 'up' | 'down') => {
    const next = moveArea(layout, area, to)
    onLayoutChange(next)
    if (direction) focusAfterMove.current = { area, direction }
    setAnnouncement(`${name(area)} moved to position ${next.order.indexOf(area) + 1} of ${next.order.length}.`)
  }

  // After Move up or Move down, keep the keyboard on the moved area (on the other button at the top or bottom).
  useEffect(() => {
    const wanted = focusAfterMove.current
    if (!wanted) return
    focusAfterMove.current = null
    const section = blocksRef.current?.querySelector(`[data-home-area="${wanted.area}"]`)
    const buttons = [`[data-move="${wanted.direction}"]:not(:disabled)`, '[data-move]:not(:disabled)']
    for (const selector of buttons) {
      const button = section?.querySelector<HTMLButtonElement>(selector)
      if (button) { button.focus(); break }
    }
  }, [layout])

  useEffect(() => {
    const wanted = focusAfterCustomize.current
    focusAfterCustomize.current = null
    if (wanted === 'panel') customizeRef.current?.focus()
    else if (wanted === 'options') optionsRef.current?.querySelector<HTMLButtonElement>('[aria-haspopup="menu"]')?.focus()
  }, [customizing])

  const customize = (on: boolean) => {
    focusAfterCustomize.current = on ? 'panel' : 'options'
    setCustomizing(on)
    setAnnouncement('')
  }

  const startDrag = (area: HomeArea, event: ReactPointerEvent<HTMLElement>) => {
    if (event.button !== 0) return
    event.preventDefault()
    event.currentTarget.setPointerCapture?.(event.pointerId)
    // The positions of the other areas when the drag starts; nothing moves until it is dropped.
    const mids = [...(blocksRef.current?.querySelectorAll<HTMLElement>('[data-home-area]') ?? [])]
      .filter(element => element.dataset.homeArea !== area)
      .map(element => { const rect = element.getBoundingClientRect(); return { area: element.dataset.homeArea as HomeArea, mid: rect.top + rect.height / 2 } })
    const next: Drag = { area, pointerId: event.pointerId, startY: event.clientY, started: false, target: layout.order.indexOf(area), mids }
    dragRef.current = next
    setDrag(next)
  }

  useEffect(() => {
    if (!drag) return
    const onMove = (event: PointerEvent) => {
      const current = dragRef.current
      if (!current || event.pointerId !== current.pointerId) return
      if (!current.started && Math.abs(event.clientY - current.startY) < DRAG_THRESHOLD) return
      const target = current.mids.filter(item => item.mid < event.clientY).length
      if (current.started && target === current.target) return
      const next = { ...current, started: true, target }
      dragRef.current = next
      setDrag(next)
    }
    const onEnd = (event: PointerEvent) => {
      const current = dragRef.current
      if (!current || event.pointerId !== current.pointerId) return
      dragRef.current = null
      setDrag(null)
      if (event.type === 'pointerup' && current.started && current.target !== layout.order.indexOf(current.area)) move(current.area, current.target)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onEnd)
    window.addEventListener('pointercancel', onEnd)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onEnd)
      window.removeEventListener('pointercancel', onEnd)
    }
    // Listens while one drag lasts; `move` reads the layout of that moment.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drag?.pointerId])

  // Where the dragged area would land, shown as a line before or after another area.
  const dropTarget = ((): HomeBlocksControl['dropTarget'] => {
    if (!drag?.started) return null
    const others = layout.order.filter(area => area !== drag.area)
    if (drag.target === layout.order.indexOf(drag.area)) return null
    return drag.target < others.length ? { area: others[drag.target], side: 'before' } : { area: others[others.length - 1], side: 'after' }
  })()

  const control: HomeBlocksControl = {
    layout, customizing, move: (area, to) => move(area, to, to < layout.order.indexOf(area) ? 'up' : 'down'),
    toggle: section => onLayoutChange(setOpen(layout, section, !isOpen(layout, section))),
    startDrag, dragging: drag?.started ? drag.area : null, dropTarget, name,
  }

  const inMonth = (section?: HomeSection, key?: string): HomeSpot => ({ area: 'month', section, key })
  const inMoney = (section: HomeSection, key?: string): HomeSpot => ({ area: 'money-goals', section, key })
  const areas: Record<HomeArea, ReactNode> = {
    month: (
      <HomeAreaFrame area="month" period={formatYearMonth(month)}>
        <MonthSummary data={data} month={month} today={today} onOpenIncome={() => props.onOpenIncome(month, inMonth(undefined, 'stat-income'))}
          onOpenBills={() => props.onOpen('bills', inMonth(undefined, 'stat-planned'))} onOpenHistory={() => props.onOpenSpent(month, inMonth(undefined, 'stat-spent'))} />
        <div className="home-parts">
          <SpendingByCategory data={data} month={month} today={today} view={props.chartView} onViewChange={props.onChartViewChange} onChange={props.onChange}
            onOpenBill={id => props.onOpenBill(id, inMonth('categories'))} onOpenExpense={id => props.onOpenExpense(id, inMonth('categories'))} />
          <YearSummary data={data} year={Number(month.slice(0, 4))} today={today} month={month} onSelectMonth={onMonthChange} />
        </div>
      </HomeAreaFrame>
    ),
    'left-to-pay': <LeftToPay data={data} month={month} today={today} showAll={props.showAllBills} onShowAllChange={props.onShowAllBillsChange} onChange={props.onChange}
      onOpenBills={() => props.onOpen('bills', { area: 'left-to-pay', key: 'bills-link' })} isDemo={props.isDemo}
      onOpenBill={(id, forMonth) => (forMonth === month ? props.onOpenBill(id, { area: 'left-to-pay', key: `pay-${id}` }) : props.onOpenBill(id, { area: 'left-to-pay', key: `next-${id}` }, forMonth))} />,
    'money-goals': (
      <HomeAreaFrame area="money-goals" period={`Latest balances by ${formatDate(asOf)}`}
        actions={<button type="button" className="button-small" data-return-key="goals-link" onClick={() => props.onOpen('goals', { area: 'money-goals', key: 'goals-link' })}>Open Goals <Icon name="arrowRight" size={16} /></button>}>
        <p className="field-help">Each line uses the latest balance entered by {formatDate(asOf)}, with its own date. These are not this month’s figures.</p>
        <div className="home-parts">
          <HomeMoney data={data} asOf={asOf} onOpenGoal={id => props.onOpenGoal(id, inMoney('money', `goal-${id}`))} onOpenMoney={() => props.onOpenMoneyBlock('accounts', inMoney('money', 'accounts-link'))} />
          <TotalDebt data={data} asOf={asOf} onOpenDebt={id => props.onOpenDebt(id, inMoney('debt', `debt-${id}`))} onOpenCards={() => props.onOpenMoneyBlock('debts', inMoney('debt', 'cards-link'))} />
          <HomeGoals data={data} asOf={asOf} emergencyLater={props.emergencyLater}
            onEmergencyLater={props.onEmergencyLater} onReviewEmergency={() => props.onOpen('emergency', inMoney('goals', 'emergency-review'))}
            onOpenGoal={id => props.onOpenGoal(id, inMoney('goals', `goal-${id}`))} />
        </div>
      </HomeAreaFrame>
    ),
  }

  return (
    <div className="tab-screen home-screen">
      <h1 className="visually-hidden">Home</h1>
      <div className="home-month-bar" data-sticky-bar>
        <div className="home-bar-row">
          <MonthSwitch months={months} value={month} onChange={onMonthChange} />
          {!customizing && <div className="home-tools" ref={optionsRef}>
            <HomeAmountsEye />
            <MenuButton label="Home options" options={[
              { label: 'Expand All', onSelect: () => { onLayoutChange(setAllOpen(layout, true)); setAnnouncement('All parts open.') } },
              { label: 'Collapse All', onSelect: () => { onLayoutChange(setAllOpen(layout, false)); setAnnouncement('All parts closed.') } },
              { label: 'Customize Home', onSelect: () => customize(true) },
            ]} />
          </div>}
        </div>
      </div>
      {customizing && <div className="home-customize" role="group" aria-label="Customize Home" aria-describedby="customize-home-help" tabIndex={-1} ref={customizeRef}>
        <p className="muted-note" id="customize-home-help">Drag an area by its handle, or use Move up and Move down. Nothing else changes.</p>
        <span className="inline-actions">
          <button type="button" className="button-small" onClick={() => { onLayoutChange({ order: [...DEFAULT_LAYOUT.order], open: [...DEFAULT_LAYOUT.open] }); setAnnouncement('Home layout reset: This Month, Left to Pay, then Money & Goals, with every part closed.') }}>Reset Layout</button>
          <button type="button" className="button-small button-small-primary" onClick={() => customize(false)}>Done</button>
        </span>
      </div>}
      <p className="visually-hidden" role="status">{announcement}</p>
      <HomeBlocksContext.Provider value={control}>
        <div className={`home-blocks${customizing ? ' is-customizing' : ''}${drag?.started ? ' is-dragging' : ''}`} ref={blocksRef}>
          {layout.order.map(area => <div key={area} className="home-block-slot">{areas[area]}</div>)}
        </div>
      </HomeBlocksContext.Provider>
    </div>
  )
}
