import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { isSpaceScreen, isTab, useNavigation, type Screen, type Tab } from './app/navigation'
import { newId } from './app/newId'
import { alexDemo, useSpace, type DemoFixture } from './app/useSpace'
import { BottomNav } from './components/BottomNav'
import { Icon } from './components/Icon'
import { ResetDemoConfirm } from './components/ResetDemoConfirm'
import { browserStorage } from './data/localStore'
import { clearHomeLayout, readChartView, readEmergencyLater, readHiddenBlocks, readHomeLayout, writeChartView, writeEmergencyLater, writeHiddenBlocks, writeHomeLayout, type BillsChartView } from './data/uiPrefs'
import { addMonthsToYearMonth, monthsOfYear, yearMonthOf, type YearMonth } from './domain/calendar'
import { createGoal } from './domain/finance/goals'
import { createSpaceData } from './domain/finance/space'
import type { Id } from './domain/finance/types'
import type { CalendarDate } from './domain/goalTime'
import { BillScreen } from './features/bills/BillScreen'
import { BillsScreen } from './features/bills/BillsScreen'
import { INITIAL_BILLS_VIEW, type BillsView } from './features/bills/billsView'
import { CardsScreen } from './features/cards/CardsScreen'
import { DebtScreen } from './features/cards/DebtScreen'
import { DataScreen } from './features/data/DataScreen'
import { INITIAL_DATA_VIEW, setBlockOpen, type DataBlock, type DataView } from './features/data/dataBlocks'
import { GoalDetailScreen } from './features/goals/GoalDetailScreen'
import { EMPTY_NEW_GOAL, type NewGoalState } from './features/goals/goalDraft'
import { GoalsScreen } from './features/goals/GoalsScreen'
import { NewGoalScreen } from './features/goals/NewGoalScreen'
import { HistoryScreen } from './features/history/HistoryScreen'
import { firstFilter, INITIAL_HISTORY_VIEW, type HistoryView } from './features/history/historyView'
import { NO_FILTER } from './domain/finance/history'
import { HomeScreen } from './features/home/HomeScreen'
import { DEFAULT_LAYOUT, normalizeLayout, type HomeLayout } from './features/home/homeLayout'
import { SettingsScreen } from './features/settings/SettingsScreen'
import { EmergencyScreen } from './features/goals/EmergencyScreen'
import { AmountVisibilityProvider } from './ui/privacy'
import { HOME_BLOCKS, type HomeBlock } from './ui/amountVisibility'
import { AuthPreview } from './features/welcome/AuthPreview'
import { Welcome } from './features/welcome/Welcome'
import { EMPTY_SETUP, setupFromDraft, type SetupDraft } from './features/welcome/setupDraft'
import { WelcomeSetup } from './features/welcome/WelcomeSetup'
import { todayString } from './app/today'
import './styles/tokens.css'
import './styles/app.css'
import './styles/finance.css'

const MODE_NAMES = { individual: 'Individual', duo: 'Duo', group: 'Group' } as const

type Props = {
  getToday?: () => CalendarDate
  /** Where the own space is saved. Tests pass their own; the app uses the browser's localStorage. */
  storage?: Storage | null
  /** The invented data Explore the App opens: Alex's Individual demo. Tests may pass another. */
  createDemo?: () => DemoFixture
}

/**
 * The app shell: header, the current screen, the tab bar and the moves
 * between screens.
 *
 * Every screen reads the same records (the open space's data) and changes
 * them through `space.update`, so Home, Bills, Cards, Data, History and
 * the goals always agree.
 */
function App({ getToday = todayString, storage = browserStorage(), createDemo = alexDemo }: Props) {
  const space = useSpace(storage, getToday, createDemo)
  const { screen: requested, direction, go, replace, back } = useNavigation(space.open ? 'home' : 'welcome')
  const [setupDraft, setSetupDraft] = useState<SetupDraft>(EMPTY_SETUP)
  // The goal shown in the goal screen, and the New Goal form (kept while the user looks elsewhere).
  const [goalId, setGoalId] = useState<Id | null>(null)
  const [newGoal, setNewGoal] = useState<NewGoalState>(EMPTY_NEW_GOAL)
  // The card or loan, and the bill, shown on their own screens (null: adding a new one).
  const [debtId, setDebtId] = useState<Id | null>(null)
  const [billId, setBillId] = useState<Id | null>(null)
  // The record History opens on (a purchase chosen on Home).
  const [historyFocus, setHistoryFocus] = useState<Id | null>(null)
  const [chartView, setChartView] = useState<BillsChartView>(() => readChartView(storage))
  const [confirmReset, setConfirmReset] = useState(false)
  // Hidden amounts on Home and "Maybe Later" on the emergency fund: screen preferences of this device, never data.
  const [hiddenBlocks, setHiddenBlocks] = useState<ReadonlySet<HomeBlock>>(
    () => new Set(readHiddenBlocks(storage).filter((block): block is HomeBlock => (HOME_BLOCKS as readonly string[]).includes(block))))
  const [emergencyLater, setEmergencyLater] = useState(() => readEmergencyLater(storage))
  // The months follow "today", which differs between the demo and the own
  // space: the twelve months of today's year (and next January in
  // December, to plan ahead). A month chosen for another "today" is not reused.
  const thisMonth = yearMonthOf(space.today)
  const months = [...monthsOfYear(Number(thisMonth.slice(0, 4))), ...(thisMonth.endsWith('-12') ? [addMonthsToYearMonth(thisMonth, 1)] : [])]
  const [chosenMonth, setChosenMonth] = useState<{ from: YearMonth; month: YearMonth } | null>(null)
  const month = chosenMonth?.from === thisMonth ? chosenMonth.month : thisMonth
  const setMonth = (next: YearMonth) => setChosenMonth({ from: thisMonth, month: next })
  // How Home is arranged. The own space's layout is remembered on this device for that space;
  // the demo's lasts while the demo is open and goes back to the first layout with Reset Demo.
  const [demoLayout, setDemoLayout] = useState<HomeLayout>(DEFAULT_LAYOUT)
  const [ownLayout, setOwnLayout] = useState<{ spaceId: string; layout: HomeLayout } | null>(null)
  // How Data looks (open blocks, filters): for this session only, separately for the demo and the own space.
  const [demoDataView, setDemoDataView] = useState<DataView>(INITIAL_DATA_VIEW)
  const [ownDataView, setOwnDataView] = useState<{ spaceId: string; view: DataView } | null>(null)
  // How Bills looks (Calendar or List, filter, chosen day): for this session only, so Back from a bill finds it as it was.
  const [billsView, setBillsView] = useState<BillsView>(INITIAL_BILLS_VIEW)
  // How History looks (its own period, search, filters, open months, records shown): for this session only,
  // separately for the demo and the own space, so Back from a bill or a goal finds it as it was.
  const [demoHistoryView, setDemoHistoryView] = useState<HistoryView>(INITIAL_HISTORY_VIEW)
  const [ownHistoryView, setOwnHistoryView] = useState<{ spaceId: string; view: HistoryView } | null>(null)
  // Where History was scrolled when a bill or a goal was opened from it, to go back to the same place.
  const historyScroll = useRef<number | null>(null)
  // Where Bills was scrolled when a bill (or Add Bill on a day) was opened from it, and which button
  // (its data-return-key) gets the focus back: Back, Cancel and saving from a day return there.
  const billsReturn = useRef<{ y: number; key: string } | null>(null)
  // + Add Bill in the day panel: the day the new bill starts on (null: the top Add Bill, an empty form).
  const [billDay, setBillDay] = useState<CalendarDate | null>(null)
  // The Data block a link asked for (Edit Balances): it gets the focus instead of the screen title.
  const dataTarget = useRef<DataBlock | null>(null)
  const mainRef = useRef<HTMLElement>(null)
  const firstScreen = useRef(true)

  // Space screens need an open space, and an open space never shows the
  // screens before it (Back after setup must not create a second space).
  const screen: Screen = space.open
    ? (isSpaceScreen(requested) ? requested : 'home')
    : (isSpaceScreen(requested) ? 'welcome' : requested)
  const shows = (name: Screen) => screen === name
  // The "Bill added" notice belongs to this visit to Bills: any other screen (apart from a bill opened there) ends it.
  const [lastScreen, setLastScreen] = useState(screen)
  if (lastScreen !== screen) {
    setLastScreen(screen)
    if (billsView.added && screen !== 'bills' && screen !== 'bill') setBillsView({ ...billsView, added: null })
  }
  const open = space.open

  // Appearance: the open space's choice, or the device's setting before a space is open.
  const theme = open?.data.preferences.theme ?? 'system'
  useEffect(() => { document.documentElement.dataset.theme = theme === 'day-night' ? 'system' : theme }, [theme])

  // After each move, focus goes to the new screen's title so keyboard and
  // screen reader users know where they are.
  // A link to one Data block (Edit Balances) moves the view and the focus to that block's heading instead.
  useEffect(() => {
    if (firstScreen.current) { firstScreen.current = false; return }
    // Back to Bills from a bill opened there: the same place, with the focus on the button that opened it
    // (or the "Bill added" notice), else the chosen day, else the title.
    const billsBack = screen === 'bills' ? billsReturn.current : null
    if (screen !== 'bill' && screen !== 'debt') billsReturn.current = null
    if (billsBack) {
      const bills = mainRef.current?.querySelector('[data-screen="bills"]')
      const target = bills?.querySelector<HTMLElement>(`[data-return-key="${billsBack.key}"]`)
        ?? bills?.querySelector<HTMLElement>('.cal-cell.is-selected .cal-day') ?? bills?.querySelector<HTMLElement>('h1')
      if (target?.tagName === 'H1' && !target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1')
      target?.focus({ preventScroll: true })
      window.scrollTo?.(0, billsBack.y)
      target?.scrollIntoView?.({ block: 'nearest' })
      return
    }
    // Back to History from a bill or a goal opened there: the same place, with the focus on the title.
    const returnTo = screen === 'history' ? historyScroll.current : null
    if (screen !== 'bill' && screen !== 'goal') historyScroll.current = null
    if (returnTo !== null) {
      const title = mainRef.current?.querySelector<HTMLElement>('[data-screen="history"] h1')
      if (title && !title.hasAttribute('tabindex')) title.setAttribute('tabindex', '-1')
      title?.focus({ preventScroll: true })
      window.scrollTo?.(0, returnTo)
      return
    }
    const target = screen === 'data' ? dataTarget.current : null
    dataTarget.current = null
    const toggle = target ? mainRef.current?.querySelector<HTMLElement>(`[data-data-block="${target}"] .block-toggle`) : null
    if (toggle) {
      toggle.focus({ preventScroll: true })
      // Scrolls under the header (and the tab row on wide screens): html's scroll-padding-top leaves their height free.
      toggle.closest('section')?.scrollIntoView?.({ block: 'start' })
      return
    }
    const heading = mainRef.current?.querySelector<HTMLElement>('[data-screen]:not([hidden]) :is(h1, h2)')
    if (!heading) return
    if (!heading.hasAttribute('tabindex')) heading.setAttribute('tabindex', '-1')
    heading.focus()
  }, [screen])

  const homeLayout = !open ? DEFAULT_LAYOUT
    : open.kind === 'demo' ? demoLayout
      : ownLayout?.spaceId === open.data.space.id ? ownLayout.layout : normalizeLayout(readHomeLayout(storage, open.data.space.id))
  const changeHomeLayout = (layout: HomeLayout) => {
    if (!open) return
    if (open.kind === 'demo') { setDemoLayout(layout); return }
    setOwnLayout({ spaceId: open.data.space.id, layout })
    writeHomeLayout(storage, open.data.space.id, layout)
  }

  const dataView = !open ? INITIAL_DATA_VIEW
    : open.kind === 'demo' ? demoDataView
      : ownDataView?.spaceId === open.data.space.id ? ownDataView.view : INITIAL_DATA_VIEW
  const changeDataView = (view: DataView) => {
    if (!open) return
    if (open.kind === 'demo') setDemoDataView(view)
    else setOwnDataView({ spaceId: open.data.space.id, view })
  }
  const historyView = !open ? INITIAL_HISTORY_VIEW
    : open.kind === 'demo' ? demoHistoryView
      : ownHistoryView?.spaceId === open.data.space.id ? ownHistoryView.view : INITIAL_HISTORY_VIEW
  const changeHistoryView = (view: HistoryView) => {
    if (!open) return
    if (open.kind === 'demo') setDemoHistoryView(view)
    else setOwnHistoryView({ spaceId: open.data.space.id, view })
  }
  /** Opens Data on one block: the block opens, and the view and the focus go to its heading. */
  const openDataBlock = (block: DataBlock) => {
    changeDataView(setBlockOpen(dataView, block, true))
    dataTarget.current = block
    go('data')
  }

  // Home's month bar sticks under the header (and the tab row on wide screens). Their real
  // height changes with the iPhone notch and the font size, so it is measured, not guessed.
  const shellRef = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    const shell = shellRef.current
    if (!shell || typeof ResizeObserver === 'undefined') return
    const measure = () => {
      const header = shell.querySelector<HTMLElement>('.shell-header')
      const nav = shell.querySelector<HTMLElement>('.bottom-nav')
      const bar = shell.querySelector<HTMLElement>('[data-sticky-bar]')
      // On wide screens the tab row sticks right under the header (at its own `top`).
      const navStyle = nav ? getComputedStyle(nav) : null
      const top = nav && navStyle?.position === 'sticky' ? (parseFloat(navStyle.top) || 0) + nav.offsetHeight : header?.offsetHeight ?? 64
      const root = document.documentElement.style
      root.setProperty('--sticky-top', `${top}px`)
      root.setProperty('--sticky-bar', `${bar?.offsetHeight ?? 0}px`)
    }
    measure()
    const observer = new ResizeObserver(measure)
    for (const element of shell.querySelectorAll('.shell-header, .bottom-nav, [data-sticky-bar]')) observer.observe(element)
    window.addEventListener('resize', measure)
    return () => { observer.disconnect(); window.removeEventListener('resize', measure) }
  }, [screen, open?.kind])

  const finishSetup = () => {
    const created = createSpaceData(setupFromDraft(setupDraft))
    if (created.status !== 'created') return
    space.startOwnSpace(created.data)
    setSetupDraft(EMPTY_SETUP)
    replace('home')
  }
  const resetGoals = () => { setGoalId(null); setNewGoal(EMPTY_NEW_GOAL); setDebtId(null); setBillId(null); setHistoryFocus(null); setBillsView(INITIAL_BILLS_VIEW); historyScroll.current = null; billsReturn.current = null; setBillDay(null) }
  const exitDemo = () => { space.closeDemo(); resetGoals(); setChosenMonth(null); setDemoLayout(DEFAULT_LAYOUT); setDemoDataView(INITIAL_DATA_VIEW); setDemoHistoryView(INITIAL_HISTORY_VIEW); setConfirmReset(false); replace('welcome') }
  // Reset Demo puts the whole example back: the records, the Home layout, Data's closed blocks, History's first view, and everything planned or chosen on top of them.
  const resetDemo = () => { space.resetDemo(); resetGoals(); setChosenMonth(null); setDemoLayout(DEFAULT_LAYOUT); setDemoDataView(INITIAL_DATA_VIEW); setDemoHistoryView(INITIAL_HISTORY_VIEW); setConfirmReset(false) }
  const erase = () => {
    const erased = space.eraseOwnSpace()
    if (erased) { setSetupDraft(EMPTY_SETUP); resetGoals(); clearHomeLayout(storage); setOwnLayout(null); setOwnDataView(null); setOwnHistoryView(null); setChosenMonth(null); replace('welcome') }
    return erased
  }
  const openGoal = (id: Id) => { setGoalId(id); go('goal') }
  const openDebt = (id: Id | null) => { setDebtId(id); go('debt') }
  /** Opens a bill; with `forMonth` (a payment chosen in Cards or History), on that month, which becomes the shared month. */
  const openBill = (id: Id | null, forMonth?: YearMonth) => { setBillId(id); setBillDay(null); if (forMonth) setMonth(forMonth); go('bill') }
  /** Bills opens a bill, or Add Bill on a day: Back finds Bills where it was, with the focus on the button used. */
  const fromBills = (key: string, show: () => void) => { billsReturn.current = { y: window.scrollY, key }; show() }
  const addBillOn = (date: CalendarDate) => fromBills('day-add', () => { setBillId(null); setBillDay(date); go('bill') })
  /**
   * A new bill is saved. Added from a day of the calendar, it goes straight
   * back to that day with a short notice (the calendar keeps its place);
   * from the top Add Bill, the new bill's own screen opens, as before.
   */
  const billCreated = (id: Id, message: string) => {
    if (!billDay) { setBillId(id); replace('bill'); return }
    setBillsView(view => ({ ...view, mode: 'calendar', selected: billDay, added: { id, message } }))
    if (billsReturn.current) billsReturn.current.key = 'added-notice'
    setBillDay(null)
    back()
  }
  const selectedGoal = open?.data.goals.find(goal => goal.id === goalId && goal.status === 'active') ?? null
  // New records belong to the one person in an Individual space, and are shared in a Duo.
  const newGoalOwner = open?.data.space.mode === 'individual' ? open.data.space.members[0].id : 'shared'
  const changeChartView = (view: BillsChartView) => { setChartView(view); writeChartView(storage, view) }
  /** A purchase chosen on Home opens in History, on its month with no search or filter, ready to change. */
  const openExpense = (id: Id) => {
    const expense = open?.data.expenses.find(e => e.id === id)
    if (expense) changeHistoryView({ ...historyView, filter: { ...NO_FILTER, period: { kind: 'month', month: expense.date.slice(0, 7) } }, openMonths: null, shown: {} })
    setHistoryFocus(id)
    go('history')
  }
  /** History opens a bill or a goal: Back finds History scrolled where it was. */
  const fromHistory = (show: () => void) => { historyScroll.current = window.scrollY; show() }
  /** A balance in History opens Accounts & Balances in Data, on its account. */
  const openAccount = (id: Id) => {
    changeDataView({ ...setBlockOpen(dataView, 'accounts', true), account: open?.data.moneyAccounts.some(a => a.id === id) ? id : null })
    dataTarget.current = 'accounts'
    go('data')
  }
  const saveHidden = (next: ReadonlySet<HomeBlock>) => { setHiddenBlocks(next); writeHiddenBlocks(storage, [...next]) }
  const visibility = {
    hidden: hiddenBlocks,
    toggle: (block: HomeBlock) => {
      const next = new Set(hiddenBlocks)
      if (next.has(block)) next.delete(block)
      else next.add(block)
      saveHidden(next)
    },
    setAll: (hide: boolean) => saveHidden(new Set(hide ? HOME_BLOCKS : [])),
  }
  const emergencyLaterChange = (later: boolean) => { setEmergencyLater(later); writeEmergencyLater(storage, later) }
  const selectTab = (tab: Tab) => {
    if (tab === screen) return
    if (tab === 'history') {
      // From the tab bar, History opens as it was left (no purchase from Home); the first time, on the year of the month shown.
      setHistoryFocus(null)
      if (historyView.filter === null) changeHistoryView({ ...historyView, filter: firstFilter(month) })
    }
    go(tab)
  }
  /** The logo: Home of the open space (or Welcome before one is open). Already there, it does nothing, so no history step is added. */
  const goToStart = () => {
    const start = open ? 'home' : 'welcome'
    if (screen !== start) go(start)
  }

  const subtitle = !open ? 'Prototype' : open.kind === 'demo' ? 'Demo · Invented data' : `${open.data.space.name} · ${MODE_NAMES[open.data.space.mode]}`
  const showNav = !!open && isTab(screen)

  return (
    <div className={`shell${showNav ? ' has-nav' : ''}`} data-direction={direction} ref={shellRef}>
      <header className="shell-header">
        <button type="button" className="shell-brand" aria-label={open ? 'Go to Home' : 'Go to Welcome'} onClick={goToStart}>
          <span className="shell-brand-mark"><Icon name="target" size={20} /></span>
          <span className="shell-brand-name">Goal Planning<small>{subtitle}</small></span>
        </button>
        {open && screen !== 'settings' && (
          <button type="button" className="icon-button" aria-label="Settings" onClick={() => go('settings')}><Icon name="settings" size={20} /></button>
        )}
      </header>
      {open?.kind === 'demo' && (
        <div className={`demo-banner${confirmReset ? ' is-asking' : ''}`} role="note">
          {!confirmReset && <span><b>Demo</b> · Alex is invented · All information is invented · Changes are not saved</span>}
          <span className="inline-actions">
            <ResetDemoConfirm onReset={resetDemo} triggerClassName="button-small" onAskingChange={setConfirmReset} />
            {!confirmReset && <button type="button" className="button-small" onClick={exitDemo}>Exit Demo</button>}
          </span>
        </div>
      )}
      {space.saveFailed && <div className="save-warning" role="alert">This browser did not save your latest changes. They will be lost when you close the page.</div>}
      {showNav && <BottomNav current={isTab(screen) ? screen : null} onSelect={selectTab} />}
      <main className="shell-main" ref={mainRef}>
        {shows('welcome') && <div className="screen" data-screen="welcome">
          <Welcome unreadable={space.unreadable} onCreateAccount={() => go('sign-up')} onLogIn={() => go('log-in')}
            onExplore={() => { space.openDemo(); go('home') }} onEraseUnreadable={() => space.eraseOwnSpace()} />
        </div>}
        {(shows('sign-up') || shows('log-in')) && <div className="screen" data-screen={screen}>
          <AuthPreview key={screen} mode={screen === 'sign-up' ? 'sign-up' : 'log-in'} onBack={back} onContinue={() => go('setup')} />
        </div>}
        {shows('setup') && <div className="screen" data-screen="setup">
          <WelcomeSetup draft={setupDraft} onChange={setSetupDraft} onBack={back} onFinish={finishSetup} />
        </div>}

        {open && <>
          {shows('home') && <div className="screen" data-screen="home">
            <AmountVisibilityProvider value={visibility}>
              <HomeScreen data={open.data} months={months} month={month} onMonthChange={setMonth} today={space.today}
                chartView={chartView} onChartViewChange={changeChartView} layout={homeLayout} onLayoutChange={changeHomeLayout}
                onChange={space.update} onOpen={go} onOpenDataBlock={openDataBlock} onOpenGoal={openGoal} onAddGoal={() => go('new-goal')} onOpenDebt={openDebt} onOpenBill={openBill}
                onOpenExpense={openExpense} emergencyLater={emergencyLater} onEmergencyLater={() => emergencyLaterChange(true)}
                onReviewEmergency={() => go('emergency')} />
            </AmountVisibilityProvider>
          </div>}
          {shows('bills') && <div className="screen" data-screen="bills">
            <AmountVisibilityProvider value={visibility}>
              <BillsScreen data={open.data} months={months} month={month} today={space.today} isDemo={open.kind === 'demo'} view={billsView} onViewChange={setBillsView}
                onMonthChange={setMonth} onChange={space.update} onOpenBill={(id, key) => fromBills(key, () => openBill(id))} onAddBill={() => openBill(null)} onAddBillOn={addBillOn} />
            </AmountVisibilityProvider>
          </div>}
          {shows('cards') && <div className="screen" data-screen="cards">
            <CardsScreen data={open.data} months={months} month={month} onMonthChange={setMonth} onOpenDebt={openDebt} onAddDebt={() => openDebt(null)} />
          </div>}
          {shows('debt') && <div className="screen" data-screen="debt">
            <DebtScreen key={debtId ?? 'new'} data={open.data} debtId={debtId} months={months} month={month} onMonthChange={setMonth}
              today={space.today} isDemo={open.kind === 'demo'} owner={newGoalOwner} newId={newId} onBack={back} onChange={space.update} onOpenBill={openBill}
              onCreated={id => { setDebtId(id); replace('debt') }} onDeleted={() => { setDebtId(null); back() }} />
          </div>}
          {shows('bill') && <div className="screen" data-screen="bill">
            <BillScreen key={billId ?? `new-${billDay ?? ''}`} data={open.data} billId={billId} dueDate={billDay} months={months} month={month} onMonthChange={setMonth} today={space.today} owner={newGoalOwner} newId={newId}
              onBack={back} onChange={space.update} onOpenDebt={openDebt}
              onCreated={billCreated} onDeleted={() => { setBillId(null); back() }} />
          </div>}
          {(shows('goals') || (shows('goal') && !selectedGoal)) && <div className="screen" data-screen="goals">
            <GoalsScreen data={open.data} today={space.today} onBack={back} onNew={() => go('new-goal')} onOpenGoal={openGoal} />
          </div>}
          {shows('goal') && selectedGoal && <div className="screen" data-screen="goal">
            <GoalDetailScreen key={selectedGoal.id} data={open.data} goal={selectedGoal} today={space.today} isDemo={open.kind === 'demo'} newId={newId} onBack={back}
              onChange={data => space.update(() => data)}
              onDeleted={data => { space.update(() => data); setGoalId(null); back() }} onReviewEmergency={() => go('emergency')} />
          </div>}
          {shows('new-goal') && <div className="screen" data-screen="new-goal">
            <NewGoalScreen data={open.data} today={space.today} owner={newGoalOwner} state={newGoal} onStateChange={setNewGoal} onCancel={back}
              onCreate={fields => {
                const id = newId()
                const created = createGoal(open.data, id, fields, space.today)
                if (created.status !== 'valid') return
                space.update(() => created.data)
                setNewGoal(EMPTY_NEW_GOAL)
                setGoalId(id)
                replace('goal')
              }} />
          </div>}
          {shows('emergency') && <div className="screen" data-screen="emergency">
            <EmergencyScreen data={open.data} today={space.today} owner={newGoalOwner} newId={newId} onBack={back}
              onSave={data => { space.update(() => data); emergencyLaterChange(false) }} onOpenGoal={id => { setGoalId(id); replace('goal') }} />
          </div>}
          {shows('history') && <div className="screen" data-screen="history">
            <AmountVisibilityProvider value={visibility}>
              <HistoryScreen key={historyFocus ?? 'all'} data={open.data} months={months} month={month} today={space.today} newId={newId} focusId={historyFocus}
                view={historyView} onViewChange={changeHistoryView}
                onChange={space.update} onOpenBill={(id, forMonth) => fromHistory(() => openBill(id, forMonth))} onOpenGoal={id => fromHistory(() => openGoal(id))}
                onOpenAccount={openAccount} />
            </AmountVisibilityProvider>
          </div>}
          {shows('data') && <div className="screen" data-screen="data">
            <DataScreen key={open.kind} data={open.data} isDemo={open.kind === 'demo'} months={months} month={month} today={space.today} owner={newGoalOwner} newId={newId}
              view={dataView} onViewChange={changeDataView}
              onChange={space.update} onReplace={space.replaceData} onOpenBill={openBill} onOpenDebt={openDebt} onOpenGoal={openGoal}
              onAddGoal={() => go('new-goal')} onReviewEmergency={() => go('emergency')} onResetDemo={resetDemo} />
          </div>}
          {shows('settings') && <div className="screen" data-screen="settings">
            <SettingsScreen data={open.data} isDemo={open.kind === 'demo'} onBack={back} onExitDemo={exitDemo} onResetDemo={resetDemo} onErase={erase}
              onThemeChange={theme => space.update(data => ({ ...data, preferences: { ...data.preferences, theme } }))} />
          </div>}
        </>}
      </main>
      <footer className="shell-footer">
        {!open ? 'Prototype · No account needed · Nothing is sent anywhere'
          : open.kind === 'demo' ? 'Demo · Invented information · Changes are not saved · No account, no bank connection'
          : 'Prototype · Saved on this device only · Not secure storage · No bank connection'}
      </footer>
    </div>
  )
}

export default App
