import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react'
import type { YearMonth } from '../../domain/calendar'
import type { CalendarDate } from '../../domain/goalTime'
import { monthEnd } from '../../domain/finance/spending'
import type { FinanceData, Id } from '../../domain/finance/types'
import type { BillsChartView } from '../../data/uiPrefs'
import type { DataBlock } from '../data/dataBlocks'
import { BLOCK_NAMES, type HomeBlock } from '../../ui/amountVisibility'
import { HomeAmountsEye } from '../../ui/privacy'
import type { ChangeSpace } from '../../ui/saveOutcome'
import { LeftToPay } from './LeftToPay'
import { MonthSummary } from './MonthSummary'
import { SpendingByCategory } from './SpendingByCategory'
import { HomeGoals } from './HomeGoals'
import { HomeMoney } from './HomeMoney'
import { TotalDebt } from './TotalDebt'
import { YearSummary } from './YearSummary'
import { MonthSwitch } from '../../components/MonthSwitch'
import { MenuButton } from '../../components/MenuButton'
import { HomeBlocksContext, type HomeBlocksControl } from './homeBlocksContext'
import { DEFAULT_LAYOUT, isOpen, moveBlock, setAllOpen, setOpen, type HomeLayout } from './homeLayout'

type Props = {
  data: FinanceData
  months: YearMonth[]
  month: YearMonth
  onMonthChange: (month: YearMonth) => void
  today: CalendarDate
  chartView: BillsChartView
  onChartViewChange: (view: BillsChartView) => void
  /** Block order and open blocks (own space: remembered on this device; demo: while it is open). */
  layout: HomeLayout
  onLayoutChange: (layout: HomeLayout) => void
  onChange: ChangeSpace
  onOpen: (screen: 'bills' | 'cards' | 'data' | 'goals' | 'history') => void
  /** Opens Data on one block (Income, Accounts & Balances), with the focus on its heading. */
  onOpenDataBlock: (block: DataBlock) => void
  onOpenGoal: (id: Id) => void
  onAddGoal: () => void
  onOpenDebt: (id: Id) => void
  onOpenBill: (id: Id) => void
  onOpenExpense: (id: Id) => void
  emergencyLater: boolean
  onEmergencyLater: () => void
  onReviewEmergency: () => void
}

/** A drag only starts after the finger or mouse moves this far, so a tap on the handle moves nothing. */
const DRAG_THRESHOLD = 6

type Drag = { block: HomeBlock; pointerId: number; startY: number; started: boolean; target: number; mids: { block: HomeBlock; mid: number }[] }

/**
 * Home, in the order of the questions it answers (the order can be
 * changed with Customize Home):
 * 1. How is my month? 2. What do I still have to pay? 3. Where did my
 * money go? 4. How much do I owe? 5. What money do I have? 6. What am I
 * saving for? 7. How is my year? Every number is worked out from the
 * space's records on each render, so it follows any change made anywhere
 * else. Balances are the ones entered by the end of the month shown (or
 * today, for the month still going): never worked back from today's
 * balance. Each block opens and closes; closed, it keeps a short summary.
 */
export function HomeScreen(props: Props) {
  const { data, months, month, onMonthChange, today, onOpen, layout, onLayoutChange } = props
  const individual = data.space.mode === 'individual'
  const asOf = monthEnd(month) < today ? monthEnd(month) : today
  const [customizing, setCustomizing] = useState(false)
  const [announcement, setAnnouncement] = useState('')
  const [drag, setDrag] = useState<Drag | null>(null)
  const dragRef = useRef<Drag | null>(null)
  const blocksRef = useRef<HTMLDivElement>(null)
  const focusAfterMove = useRef<{ block: HomeBlock; direction: 'up' | 'down' } | null>(null)
  const customizeRef = useRef<HTMLDivElement>(null)
  const optionsRef = useRef<HTMLDivElement>(null)
  // Customize Home puts the keyboard on its instructions; Done puts it back on Home options.
  const focusAfterCustomize = useRef<'panel' | 'options' | null>(null)
  const name = (block: HomeBlock) => (block === 'money' && !individual ? 'Our Money' : block === 'goals' && !individual ? 'Our Goals' : BLOCK_NAMES[block])

  const move = (block: HomeBlock, to: number, direction?: 'up' | 'down') => {
    const next = moveBlock(layout, block, to)
    onLayoutChange(next)
    if (direction) focusAfterMove.current = { block, direction }
    setAnnouncement(`${name(block)} moved to position ${next.order.indexOf(block) + 1} of ${next.order.length}.`)
  }

  // After Move up or Move down, keep the keyboard on the moved block (on the other button at the top or bottom).
  useEffect(() => {
    const wanted = focusAfterMove.current
    if (!wanted) return
    focusAfterMove.current = null
    const section = blocksRef.current?.querySelector(`[data-home-block="${wanted.block}"]`)
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

  const startDrag = (block: HomeBlock, event: ReactPointerEvent<HTMLElement>) => {
    if (event.button !== 0) return
    event.preventDefault()
    event.currentTarget.setPointerCapture?.(event.pointerId)
    // The positions of the other blocks when the drag starts; nothing moves until it is dropped.
    const mids = [...(blocksRef.current?.querySelectorAll<HTMLElement>('[data-home-block]') ?? [])]
      .filter(element => element.dataset.homeBlock !== block)
      .map(element => { const rect = element.getBoundingClientRect(); return { block: element.dataset.homeBlock as HomeBlock, mid: rect.top + rect.height / 2 } })
    const next: Drag = { block, pointerId: event.pointerId, startY: event.clientY, started: false, target: layout.order.indexOf(block), mids }
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
      if (event.type === 'pointerup' && current.started && current.target !== layout.order.indexOf(current.block)) move(current.block, current.target)
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

  // Where the dragged block would land, shown as a line before or after another block.
  const dropTarget = ((): HomeBlocksControl['dropTarget'] => {
    if (!drag?.started) return null
    const others = layout.order.filter(block => block !== drag.block)
    if (drag.target === layout.order.indexOf(drag.block)) return null
    return drag.target < others.length ? { block: others[drag.target], side: 'before' } : { block: others[others.length - 1], side: 'after' }
  })()

  const control: HomeBlocksControl = {
    layout, customizing, move: (block, to) => move(block, to, to < layout.order.indexOf(block) ? 'up' : 'down'),
    toggle: block => onLayoutChange(setOpen(layout, block, !isOpen(layout, block))),
    startDrag, dragging: drag?.started ? drag.block : null, dropTarget,
  }

  const blocks: Record<HomeBlock, ReactNode> = {
    month: <MonthSummary data={data} month={month} today={today} onOpenIncome={() => props.onOpenDataBlock('income')} onOpenBills={() => onOpen('bills')} onOpenHistory={() => onOpen('history')} />,
    'left-to-pay': <LeftToPay data={data} month={month} today={today} onOpenBills={() => onOpen('bills')} onOpenBill={props.onOpenBill} />,
    categories: <SpendingByCategory data={data} month={month} today={today} view={props.chartView} onViewChange={props.onChartViewChange} onChange={props.onChange}
      onOpenBill={props.onOpenBill} onOpenExpense={props.onOpenExpense} />,
    debt: <TotalDebt data={data} asOf={asOf} onOpenDebt={props.onOpenDebt} onOpenCards={() => onOpen('cards')} />,
    money: <HomeMoney data={data} title={name('money')} asOf={asOf} onOpenGoal={props.onOpenGoal} onOpenData={() => props.onOpenDataBlock('accounts')} />,
    goals: <HomeGoals data={data} title={name('goals')} asOf={asOf} emergencyLater={props.emergencyLater}
      onEmergencyLater={props.onEmergencyLater} onReviewEmergency={props.onReviewEmergency}
      onViewAll={() => onOpen('goals')} onAddGoal={props.onAddGoal} onOpenGoal={props.onOpenGoal} />,
    year: <YearSummary data={data} year={Number(month.slice(0, 4))} today={today} month={month} onSelectMonth={onMonthChange} />,
  }

  return (
    <div className="tab-screen">
      <h1 className="visually-hidden">Home</h1>
      <div className="home-month-bar" data-sticky-bar>
        <div className="home-bar-row">
          <MonthSwitch months={months} value={month} onChange={onMonthChange} />
          {!customizing && <div className="home-tools" ref={optionsRef}>
            <HomeAmountsEye />
            <MenuButton label="Home options" options={[
              { label: 'Expand All', onSelect: () => { onLayoutChange(setAllOpen(layout, true)); setAnnouncement('All blocks open.') } },
              { label: 'Collapse All', onSelect: () => { onLayoutChange(setAllOpen(layout, false)); setAnnouncement('All blocks closed.') } },
              { label: 'Customize Home', onSelect: () => customize(true) },
            ]} />
          </div>}
        </div>
      </div>
      {customizing && <div className="home-customize" role="group" aria-label="Customize Home" aria-describedby="customize-home-help" tabIndex={-1} ref={customizeRef}>
        <p className="muted-note" id="customize-home-help">Drag a block by its handle, or use Move up and Move down. Nothing else changes.</p>
        <span className="inline-actions">
          <button type="button" className="button-small" onClick={() => { onLayoutChange({ order: [...DEFAULT_LAYOUT.order], open: [...DEFAULT_LAYOUT.open] }); setAnnouncement('Home layout reset: the first order, with This Month and Left to Pay open.') }}>Reset Layout</button>
          <button type="button" className="button-small button-small-primary" onClick={() => customize(false)}>Done</button>
        </span>
      </div>}
      <p className="visually-hidden" role="status">{announcement}</p>
      <HomeBlocksContext.Provider value={control}>
        <div className={`home-blocks${customizing ? ' is-customizing' : ''}${drag?.started ? ' is-dragging' : ''}`} ref={blocksRef}>
          {layout.order.map(block => <div key={block} className="home-block-slot">{blocks[block]}</div>)}
        </div>
      </HomeBlocksContext.Provider>
    </div>
  )
}
