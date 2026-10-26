import { useEffect, useRef, useState } from 'react'
import { isSpaceScreen, isTab, useNavigation, type Screen, type Tab } from './app/navigation'
import { newId } from './app/newId'
import { alexDemo, useSpace, type DemoFixture } from './app/useSpace'
import { BottomNav } from './components/BottomNav'
import { Icon } from './components/Icon'
import { browserStorage } from './data/localStore'
import { readChartView, writeChartView, type BillsChartView } from './data/uiPrefs'
import { addMonthsToYearMonth, yearMonthOf, type YearMonth } from './domain/calendar'
import { createGoal } from './domain/finance/goals'
import { createSpaceData } from './domain/finance/space'
import type { Id } from './domain/finance/types'
import type { ConfirmedGoal } from './domain/goal'
import type { CalendarDate } from './domain/goalTime'
import { BillScreen } from './features/bills/BillScreen'
import { BillsScreen } from './features/bills/BillsScreen'
import { CardsScreen } from './features/cards/CardsScreen'
import { DebtScreen } from './features/cards/DebtScreen'
import { DataScreen } from './features/data/DataScreen'
import { GoalDetailScreen } from './features/goals/GoalDetailScreen'
import { EMPTY_NEW_GOAL, type NewGoalState } from './features/goals/goalDraft'
import { GoalsScreen } from './features/goals/GoalsScreen'
import { NewGoalScreen } from './features/goals/NewGoalScreen'
import { HistoryScreen } from './features/history/HistoryScreen'
import { HomeScreen } from './features/home/HomeScreen'
import { SettingsScreen } from './features/settings/SettingsScreen'
import { GoalPlanner } from './features/planner/GoalPlanner'
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
 * The Goal Planner stays on the page once a space is open and is only
 * hidden while another screen shows. Hidden content is not displayed,
 * cannot be reached with the keyboard and is skipped by screen readers,
 * and everything typed in it is still there when the user comes back.
 *
 * Every screen reads the same records (the open space's data) and changes
 * them through `space.update`, so Home, Bills, Cards, Data, History and
 * the goals always agree.
 */
function App({ getToday = todayString, storage = browserStorage(), createDemo = alexDemo }: Props) {
  const space = useSpace(storage, getToday, createDemo)
  const { screen: requested, direction, go, replace, back } = useNavigation(space.open ? 'home' : 'welcome')
  const [setupDraft, setSetupDraft] = useState<SetupDraft>(EMPTY_SETUP)
  // A copy for Home to show. The goal itself is owned by GoalPlanner.
  const [confirmedGoal, setConfirmedGoal] = useState<ConfirmedGoal | null>(null)
  // The goal shown in the goal screen, and the New Goal form (kept while the user looks elsewhere).
  const [goalId, setGoalId] = useState<Id | null>(null)
  const [newGoal, setNewGoal] = useState<NewGoalState>(EMPTY_NEW_GOAL)
  // The card or loan, and the bill, shown on their own screens (null: adding a new one).
  const [debtId, setDebtId] = useState<Id | null>(null)
  const [billId, setBillId] = useState<Id | null>(null)
  // The planned goal last saved as a goal, so it is not saved twice.
  const [savedPlan, setSavedPlan] = useState<ConfirmedGoal | null>(null)
  const [chartView, setChartView] = useState<BillsChartView>(() => readChartView(storage))
  const [confirmReset, setConfirmReset] = useState(false)
  // Changes when the demo is reset, so the Goal Planner starts again from an empty draft.
  const [plannerRun, setPlannerRun] = useState(0)
  // The months follow "today", which differs between the demo and the own
  // space. A month chosen for another "today" is not reused.
  const thisMonth = yearMonthOf(space.today)
  const months = [thisMonth, addMonthsToYearMonth(thisMonth, 1)]
  const [chosenMonth, setChosenMonth] = useState<{ from: YearMonth; month: YearMonth } | null>(null)
  const month = chosenMonth?.from === thisMonth ? chosenMonth.month : thisMonth
  const setMonth = (next: YearMonth) => setChosenMonth({ from: thisMonth, month: next })
  const mainRef = useRef<HTMLElement>(null)
  const firstScreen = useRef(true)

  // Space screens need an open space, and an open space never shows the
  // screens before it (Back after setup must not create a second space).
  const screen: Screen = space.open
    ? (isSpaceScreen(requested) ? requested : 'home')
    : (isSpaceScreen(requested) ? 'welcome' : requested)
  const shows = (name: Screen) => screen === name
  const open = space.open

  // Appearance: the open space's choice, or the device's setting before a space is open.
  const theme = open?.data.preferences.theme ?? 'system'
  useEffect(() => { document.documentElement.dataset.theme = theme === 'day-night' ? 'system' : theme }, [theme])

  // After each move, focus goes to the new screen's title so keyboard and
  // screen reader users know where they are.
  useEffect(() => {
    if (firstScreen.current) { firstScreen.current = false; return }
    const heading = mainRef.current?.querySelector<HTMLElement>('[data-screen]:not([hidden]) :is(h1, h2)')
    if (!heading) return
    if (!heading.hasAttribute('tabindex')) heading.setAttribute('tabindex', '-1')
    heading.focus()
  }, [screen])

  const finishSetup = () => {
    const created = createSpaceData(setupFromDraft(setupDraft))
    if (created.status !== 'created') return
    space.startOwnSpace(created.data)
    setSetupDraft(EMPTY_SETUP)
    replace('home')
  }
  const resetGoals = () => { setConfirmedGoal(null); setGoalId(null); setNewGoal(EMPTY_NEW_GOAL); setDebtId(null); setBillId(null); setSavedPlan(null) }
  const exitDemo = () => { space.closeDemo(); resetGoals(); setConfirmReset(false); replace('welcome') }
  // Reset Demo puts the whole example back: the records, and everything planned or chosen on top of them.
  const resetDemo = () => { space.resetDemo(); resetGoals(); setPlannerRun(run => run + 1); setChosenMonth(null); setConfirmReset(false) }
  const erase = () => {
    const erased = space.eraseOwnSpace()
    if (erased) { setSetupDraft(EMPTY_SETUP); resetGoals(); replace('welcome') }
    return erased
  }
  const openGoal = (id: Id) => { setGoalId(id); go('goal') }
  const openDebt = (id: Id | null) => { setDebtId(id); go('debt') }
  const openBill = (id: Id | null) => { setBillId(id); go('bill') }
  const selectedGoal = open?.data.goals.find(goal => goal.id === goalId && goal.status === 'active') ?? null
  // New records belong to the one person in an Individual space, and are shared in a Duo.
  const newGoalOwner = open?.data.space.mode === 'individual' ? open.data.space.members[0].id : 'shared'
  const changeChartView = (view: BillsChartView) => { setChartView(view); writeChartView(storage, view) }
  const savePlannedGoal = () => {
    if (!open || !confirmedGoal) return
    const id = newId()
    const created = createGoal(open.data, id, {
      name: confirmedGoal.details.name, owner: newGoalOwner, target: confirmedGoal.input.targetAmount, deadline: confirmedGoal.input.targetDate,
    }, space.today)
    if (created.status !== 'valid') return
    space.update(() => created.data)
    setSavedPlan(confirmedGoal)
    openGoal(id)
  }
  const selectTab = (tab: Tab) => { if (tab !== screen) go(tab) }

  const subtitle = !open ? 'Prototype' : open.kind === 'demo' ? 'Demo · Invented data' : `${open.data.space.name} · ${MODE_NAMES[open.data.space.mode]}`
  const showNav = !!open && isTab(screen)

  return (
    <div className={`shell${showNav ? ' has-nav' : ''}`} data-direction={direction}>
      <header className="shell-header">
        <div className="shell-brand">
          <span className="shell-brand-mark"><Icon name="target" size={20} /></span>
          <span className="shell-brand-name">Goal Planning<small>{subtitle}</small></span>
        </div>
        {open && screen !== 'settings' && (
          <button type="button" className="icon-button" aria-label="Settings" onClick={() => go('settings')}><Icon name="settings" size={20} /></button>
        )}
      </header>
      {open?.kind === 'demo' && (
        <div className="demo-banner" role="note">
          {confirmReset
            ? <>
              <span>Put the original example back? Your changes in the demo are lost. Your own space is not touched.</span>
              <span className="inline-actions">
                <button type="button" className="button-small button-small-primary" onClick={resetDemo}>Restore Example</button>
                <button type="button" className="button-small" onClick={() => setConfirmReset(false)}>Cancel</button>
              </span>
            </>
            : <>
              <span><b>Demo</b> · Alex is invented · All information is invented · Changes are not saved</span>
              <span className="inline-actions">
                <button type="button" className="button-small" onClick={() => setConfirmReset(true)}>Reset Demo</button>
                <button type="button" className="button-small" onClick={exitDemo}>Exit Demo</button>
              </span>
            </>}
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
            <HomeScreen data={open.data} months={months} month={month} onMonthChange={setMonth} confirmedGoal={confirmedGoal} today={space.today}
              plannedGoalSaved={!!confirmedGoal && savedPlan === confirmedGoal} chartView={chartView} onChartViewChange={changeChartView}
              onChange={space.update} onOpen={go} onOpenGoal={openGoal} onAddGoal={() => go('new-goal')} onOpenDebt={openDebt} onOpenBill={openBill}
              onSavePlannedGoal={savePlannedGoal} />
          </div>}
          {shows('bills') && <div className="screen" data-screen="bills">
            <BillsScreen data={open.data} months={months} month={month} today={space.today} onMonthChange={setMonth} onChange={space.update}
              onOpenBill={openBill} onAddBill={() => openBill(null)} />
          </div>}
          {shows('cards') && <div className="screen" data-screen="cards">
            <CardsScreen data={open.data} month={month} onOpenDebt={openDebt} onAddDebt={() => openDebt(null)} />
          </div>}
          {shows('debt') && <div className="screen" data-screen="debt">
            <DebtScreen key={debtId ?? 'new'} data={open.data} debtId={debtId} month={month} today={space.today} owner={newGoalOwner} newId={newId}
              onBack={back} onChange={space.update} onOpenBill={openBill}
              onCreated={id => { setDebtId(id); replace('debt') }} onDeleted={() => { setDebtId(null); back() }} />
          </div>}
          {shows('bill') && <div className="screen" data-screen="bill">
            <BillScreen key={`${billId ?? 'new'}:${month}`} data={open.data} billId={billId} month={month} today={space.today} owner={newGoalOwner} newId={newId}
              onBack={back} onChange={space.update} onOpenDebt={openDebt}
              onCreated={id => { setBillId(id); replace('bill') }} onDeleted={() => { setBillId(null); back() }} />
          </div>}
          {(shows('goals') || (shows('goal') && !selectedGoal)) && <div className="screen" data-screen="goals">
            <GoalsScreen data={open.data} today={space.today} onBack={back} onNew={() => go('new-goal')} onOpenGoal={openGoal} />
          </div>}
          {shows('goal') && selectedGoal && <div className="screen" data-screen="goal">
            <GoalDetailScreen key={selectedGoal.id} data={open.data} goal={selectedGoal} today={space.today} newId={newId} onBack={back}
              onChange={data => space.update(() => data)}
              onDeleted={data => { space.update(() => data); setGoalId(null); back() }} />
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
          {shows('history') && <div className="screen" data-screen="history">
            <HistoryScreen data={open.data} />
          </div>}
          {shows('data') && <div className="screen" data-screen="data">
            <DataScreen key={open.kind} data={open.data} isDemo={open.kind === 'demo'} months={months} month={month} today={space.today} owner={newGoalOwner} newId={newId}
              onChange={space.update} onReplace={data => space.update(() => data)} onOpenBill={openBill} onOpenDebt={openDebt} onOpenGoal={openGoal}
              onAddGoal={() => go('new-goal')} onResetDemo={resetDemo} />
          </div>}
          {shows('settings') && <div className="screen" data-screen="settings">
            <SettingsScreen data={open.data} isDemo={open.kind === 'demo'} onBack={back} onExitDemo={exitDemo} onResetDemo={resetDemo} onErase={erase}
              onThemeChange={theme => space.update(data => ({ ...data, preferences: { ...data.preferences, theme } }))} />
          </div>}
        </>}
        {/* Kept on the page while a space is open, so nothing typed in them is lost. */}
        {open && <>
          <div className="screen screen-section" data-screen="planner" hidden={!shows('planner')}>
            <button type="button" className="back-link" onClick={back}><Icon name="arrowLeft" size={18} /> Home</button>
            {/* Plans on the open space's date: the demo's fixed date in the demo. */}
            <GoalPlanner key={plannerRun} getToday={() => space.today} onConfirmedGoalChange={setConfirmedGoal} />
          </div>
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
