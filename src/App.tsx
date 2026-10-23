import { useEffect, useRef, useState } from 'react'
import { isSpaceScreen, isTab, useNavigation, type Screen, type Tab } from './app/navigation'
import { newId } from './app/newId'
import { useSpace } from './app/useSpace'
import { BottomNav } from './components/BottomNav'
import { Icon } from './components/Icon'
import { browserStorage } from './data/localStore'
import { addMonthsToYearMonth, yearMonthOf, type YearMonth } from './domain/calendar'
import { createGoal } from './domain/finance/goals'
import { createSpaceData } from './domain/finance/space'
import type { Id } from './domain/finance/types'
import type { ConfirmedGoal } from './domain/goal'
import type { CalendarDate } from './domain/goalTime'
import { BillsScreen } from './features/BillsScreen'
import { DataScreen } from './features/DataScreen'
import { GoalDetailScreen } from './features/goals/GoalDetailScreen'
import { EMPTY_NEW_GOAL, type NewGoalState } from './features/goals/goalDraft'
import { GoalsScreen } from './features/goals/GoalsScreen'
import { NewGoalScreen } from './features/goals/NewGoalScreen'
import { HomeScreen } from './features/HomeScreen'
import { CardsScreen, ComingLater } from './features/PlaceholderScreens'
import { SettingsScreen } from './features/SettingsScreen'
import { GoalPlanner } from './GoalPlanner'
import { AuthPreview } from './screens/AuthPreview'
import { Welcome } from './screens/Welcome'
import { EMPTY_SETUP, setupFromDraft, type SetupDraft } from './screens/setupDraft'
import { WelcomeSetup } from './screens/WelcomeSetup'
import { todayString } from './ui/planFields'
import './styles/tokens.css'
import './styles/app.css'
import './styles/finance.css'

const MODE_NAMES = { individual: 'Individual', duo: 'Duo', group: 'Group' } as const

type Props = {
  getToday?: () => CalendarDate
  /** Where the own space is saved. Tests pass their own; the app uses the browser's localStorage. */
  storage?: Storage | null
}

/**
 * The app shell: header, the current screen, the tab bar and the moves
 * between screens.
 *
 * The Goal Planner and Cards stay on the page once a space is open and are
 * only hidden while another screen shows. Hidden content is not displayed,
 * cannot be reached with the keyboard and is skipped by screen readers,
 * and everything typed in it is still there when the user comes back.
 */
function App({ getToday = todayString, storage = browserStorage() }: Props) {
  const space = useSpace(storage, getToday)
  const { screen: requested, direction, go, replace, back } = useNavigation(space.open ? 'home' : 'welcome')
  const [setupDraft, setSetupDraft] = useState<SetupDraft>(EMPTY_SETUP)
  // A copy for Home to show. The goal itself is owned by GoalPlanner.
  const [confirmedGoal, setConfirmedGoal] = useState<ConfirmedGoal | null>(null)
  // The goal shown in the goal screen, and the New Goal form (kept while the user looks elsewhere).
  const [goalId, setGoalId] = useState<Id | null>(null)
  const [newGoal, setNewGoal] = useState<NewGoalState>(EMPTY_NEW_GOAL)
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
  const resetGoals = () => { setConfirmedGoal(null); setGoalId(null); setNewGoal(EMPTY_NEW_GOAL) }
  const exitDemo = () => { space.closeDemo(); resetGoals(); replace('welcome') }
  const erase = () => {
    const erased = space.eraseOwnSpace()
    if (erased) { setSetupDraft(EMPTY_SETUP); resetGoals(); replace('welcome') }
    return erased
  }
  const openGoal = (id: Id) => { setGoalId(id); go('goal') }
  const selectedGoal = open?.data.goals.find(goal => goal.id === goalId && goal.status === 'active') ?? null
  // New goals belong to the one person in an Individual space, and are shared in a Duo.
  const newGoalOwner = open?.data.space.mode === 'individual' ? open.data.space.members[0].id : 'shared'
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
          <span><b>Demo</b> · All information is invented · Changes are not saved</span>
          <button type="button" className="button-small" onClick={exitDemo}>Exit Demo</button>
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
              onOpen={go} onOpenGoal={openGoal} />
          </div>}
          {shows('bills') && <div className="screen" data-screen="bills">
            <BillsScreen data={open.data} months={months} month={month} onMonthChange={setMonth} onChange={space.update} />
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
            <ComingLater title="Financial History"><p>Your income, bills, balances and goal activity over time will appear here in a later version.</p></ComingLater>
          </div>}
          {shows('data') && <div className="screen" data-screen="data">
            <DataScreen key={open.kind} data={open.data} isDemo={open.kind === 'demo'} onReplace={data => space.update(() => data)} />
          </div>}
          {shows('settings') && <div className="screen" data-screen="settings">
            <SettingsScreen data={open.data} isDemo={open.kind === 'demo'} onBack={back} onExitDemo={exitDemo} onErase={erase}
              onThemeChange={theme => space.update(data => ({ ...data, preferences: { ...data.preferences, theme } }))} />
          </div>}
        </>}
        {/* Kept on the page while a space is open, so nothing typed in them is lost. */}
        {open && <>
          <div className="screen screen-section" data-screen="cards" hidden={!shows('cards')}>
            <CardsScreen />
          </div>
          <div className="screen screen-section" data-screen="planner" hidden={!shows('planner')}>
            <button type="button" className="back-link" onClick={back}><Icon name="arrowLeft" size={18} /> Home</button>
            <GoalPlanner getToday={getToday} onConfirmedGoalChange={setConfirmedGoal} />
          </div>
        </>}
      </main>
      <footer className="shell-footer">
        {!open ? 'Prototype · No account needed · Nothing is sent anywhere'
          : open.kind === 'demo' ? 'Demo · Invented information · Changes are not saved'
          : 'Prototype · Saved on this device only · Not secure storage · No bank connection'}
      </footer>
    </div>
  )
}

export default App
