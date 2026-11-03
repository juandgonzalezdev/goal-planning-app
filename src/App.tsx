import { Fragment, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { isSpaceScreen, isTab, shownScreen, useNavigation, type Screen, type Tab } from './app/navigation'
import { newId } from './app/newId'
import { alexDemo, browserSpaceStore, useSpace, type DemoFixture, type EraseOutcome } from './app/useSpace'
import { WriteStatusContext } from './app/writeStatus'
import { describeTyped, LeaveGuardContext, UnsavedChangesContext, useUnsavedRegistry, type LeaveGuard, type UnsavedForm } from './app/unsavedChanges'
import { ConfirmDiscard, LeaveDialog, UnsavedForms } from './components/UnsavedForms'
import { Recovery } from './features/recovery/Recovery'
import { recoveryFile, recoveryFileName } from './data/recovery'
import { downloadFile } from './ui/download'
import { BottomNav } from './components/BottomNav'
import { Icon } from './components/Icon'
import { DemoBanner } from './components/DemoBanner'
import { browserStorage } from './data/localStore'
import type { SpaceStore } from './data/spaceStore'
import { clearHomeLayout, readChartView, readEmergencyLater, readHiddenBlocks, readHomeLayout, writeChartView, writeEmergencyLater, writeHiddenBlocks, writeHomeLayout, type BillsChartView } from './data/uiPrefs'
import { addMonthsToYearMonth, monthsOfYear, yearMonthOf, type YearMonth } from './domain/calendar'
import { createGoal } from './domain/finance/goals'
import { createSpaceData } from './domain/finance/space'
import type { Id } from './domain/finance/types'
import type { CalendarDate } from './domain/goalTime'
import { BillScreen } from './features/bills/BillScreen'
import { BillsScreen } from './features/bills/BillsScreen'
import { INITIAL_BILLS_VIEW, type BillsView } from './features/bills/billsView'
import { DebtScreen } from './features/cards/DebtScreen'
import { MoneyScreen } from './features/money/MoneyScreen'
import { INITIAL_MONEY_VIEW, setBlockOpen, type MoneyBlock, type MoneyView } from './features/money/moneyBlocks'
import type { GoalFilter } from './domain/finance/goals'
import { GoalDetailScreen } from './features/goals/GoalDetailScreen'
import { EMPTY_NEW_GOAL, typedGoalDraft, type NewGoalState } from './features/goals/goalDraft'
import { GoalsScreen } from './features/goals/GoalsScreen'
import { NewGoalScreen } from './features/goals/NewGoalScreen'
import { HistoryScreen } from './features/history/HistoryScreen'
import { firstFilter, INITIAL_HISTORY_VIEW, type HistoryView } from './features/history/historyView'
import { NO_FILTER } from './domain/finance/history'
import { monthIncome } from './domain/finance/income'
import { matchesValidity } from './domain/finance/validity'
import { HomeScreen, type HomeAdd, type HomeSpot } from './features/home/HomeScreen'
import { DEFAULT_LAYOUT, layoutToSave, normalizeLayout, type HomeLayout } from './features/home/homeLayout'
import { SettingsScreen } from './features/settings/SettingsScreen'
import { EmergencyScreen } from './features/goals/EmergencyScreen'
import { AmountVisibilityProvider } from './ui/privacy'
import { HOME_AREAS, hiddenAreasFrom, savedHiddenNames, type HomeArea } from './ui/amountVisibility'
import { AuthPreview } from './features/welcome/AuthPreview'
import { Welcome } from './features/welcome/Welcome'
import { EMPTY_SETUP, setupFromDraft, typedSetup, type SetupDraft } from './features/welcome/setupDraft'
import { WelcomeSetup } from './features/welcome/WelcomeSetup'
import { Opening } from './features/welcome/Opening'
import { isKept, type SaveOutcome } from './ui/saveOutcome'
import { todayString } from './app/today'
import './styles/tokens.css'
import './styles/app.css'
import './styles/finance.css'

const MODE_NAMES = { individual: 'Individual', duo: 'Duo', group: 'Group' } as const

/** Moving to another screen closes every form on screen (a kept draft and a form kept after a problem stay). */
const ANY_FORM = () => true

/**
 * A change inside the app that would close forms with changes, waiting for an answer to "Leave without saving?"
 * (or, `waiting`, for the last change to be saved first). `run(discarded)` makes the change; `history`: it moves
 * the browser history (the app's Back buttons), so it waits like Back and Forward do.
 */
type AppLeave = { lost: (form: UnsavedForm) => boolean; run: (discarded: boolean) => void; history: boolean; waiting: boolean }

/** Alex's screen preferences, where every demo starts. */
const DEMO_PREFS: { hidden: ReadonlySet<HomeArea>; chartView: BillsChartView; emergencyLater: boolean } = { hidden: new Set(), chartView: 'donut', emergencyLater: false }

type Props = {
  getToday?: () => CalendarDate
  /** Where the own space is saved. Tests pass their own; the app uses the browser's localStorage. */
  storage?: Storage | null
  /** The invented data Explore the App opens: Alex's Individual demo. Tests may pass another. */
  createDemo?: () => DemoFixture
  /** Where the own space is saved: the browser's database, with the older copy in `storage`. Tests may pass another. */
  createStore?: (storage: Storage | null) => SpaceStore
}

/**
 * The app shell: header, the current screen, the tab bar and the moves
 * between screens.
 *
 * Every screen reads the same records (the open space's data) and changes
 * them through `space.update`, so Home, Bills, Goals, Money and History
 * always agree.
 */
function App({ getToday = todayString, storage = browserStorage(), createDemo = alexDemo, createStore = browserSpaceStore }: Props) {
  // Forms with changes that are not saved: another tab's changes never replace them, and they are never dropped without asking.
  const unsaved = useUnsavedRegistry()
  const space = useSpace(storage, getToday, createDemo, undefined, createStore, unsaved.hasUnsaved)
  // Asking before what was typed is dropped: to open the latest version (or try again), or to close a space erased in another tab.
  // Also before the demo opens from Settings, and before it is left, when something typed would be dropped.
  const [confirming, setConfirming] = useState<'reload' | 'discard-erased' | 'open-demo' | 'exit-demo' | 'exit-demo-settings' | null>(null)
  // Where the demo was opened from: Exit Demo goes back there (the own space's Home, or Welcome).
  const [demoFrom, setDemoFrom] = useState<'settings' | 'welcome'>('welcome')
  // The field the user was in when a question about leaving started: Keep Editing puts the focus back there.
  const lastField = useRef<HTMLElement | null>(null)
  const questionField = useRef<HTMLElement | null>(null)
  // Where the page was when Back or Forward was undone: it stays there.
  const guardScroll = useRef(0)
  const nav = useNavigation(space.open ? 'home' : 'welcome', () => unsaved.losing(ANY_FORM).length > 0, {
    onGuard: () => { guardScroll.current = window.scrollY; questionField.current = lastField.current },
    onRestored: () => { const y = guardScroll.current; requestAnimationFrame(() => { if (window.scrollY !== y) window.scrollTo?.(0, y) }) },
  })
  const { screen: requested, direction, navigation } = nav
  // Leave without saving?: asked before a change inside the app (a tab, a link, Back, another month) closes forms with changes.
  const [appLeave, setAppLeave] = useState<AppLeave | null>(null)
  /**
   * Makes a change that would close the forms `lost` says: at once when none has changes; otherwise after the last
   * change is saved when one is being saved, and only after Discard and Leave when forms would still close. While a
   * question is open, no other move that would close forms starts: the first destination stays.
   */
  const confirmLeave = (lost: (form: UnsavedForm) => boolean, run: (discarded: boolean) => void, history = false) => {
    if (unsaved.losing(lost).length === 0) { run(false); return }
    if (appLeave || nav.request) return
    if (space.saving) { setAppLeave({ lost, run, history, waiting: true }); return }
    questionField.current = lastField.current
    setAppLeave({ lost, run, history, waiting: false })
  }
  const leaveGuard: LeaveGuard = (lost, run) => confirmLeave(lost, () => run())
  /** A new screen, from a tab, a link or a button: asks first when forms would close. */
  const go = (next: Screen) => confirmLeave(ANY_FORM, () => navigation.go(next))
  /** The app's Back buttons: the same as the browser's, asking first when forms would close. */
  const back = () => confirmLeave(ANY_FORM, discarded => (discarded ? navigation.backAllowed() : navigation.back()), true)
  /** Moves after a save or a step the user already confirmed: nothing more to ask. */
  const replace = (next: Screen) => navigation.replace(next)
  const [setupDraft, setSetupDraft] = useState<SetupDraft>(EMPTY_SETUP)
  // The Welcome Setup draft stays while the user looks elsewhere (until the space is created), so moving around never drops it.
  const setupText = describeTyped('Welcome Setup', typedSetup(setupDraft))
  const setupTyped = setupText !== describeTyped('Welcome Setup', typedSetup(EMPTY_SETUP))
  useEffect(() => { unsaved.registry.set('app:welcome-setup', setupTyped ? { title: 'Welcome Setup', text: setupText, kept: true } : null) }, [unsaved.registry, setupTyped, setupText])
  // The goal shown in the goal screen, and the New Goal form (kept while the user looks elsewhere).
  const [goalId, setGoalId] = useState<Id | null>(null)
  const [newGoal, setNewGoal] = useState<NewGoalState>(EMPTY_NEW_GOAL)
  // The New Goal draft stays while the user looks elsewhere, so it counts as unsaved even with its screen closed.
  const newGoalText = describeTyped('New Goal', typedGoalDraft(newGoal.draft))
  const newGoalTyped = newGoalText !== describeTyped('New Goal', typedGoalDraft(EMPTY_NEW_GOAL.draft))
  useEffect(() => { unsaved.registry.set('app:new-goal', newGoalTyped ? { title: 'New Goal', text: newGoalText, kept: true } : null) }, [unsaved.registry, newGoalTyped, newGoalText])
  // The card or loan, and the bill, shown on their own screens (null: adding a new one).
  const [debtId, setDebtId] = useState<Id | null>(null)
  const [billId, setBillId] = useState<Id | null>(null)
  // The record History opens on (a purchase chosen on Home).
  const [historyFocus, setHistoryFocus] = useState<Id | null>(null)
  const [chartView, setChartView] = useState<BillsChartView>(() => readChartView(storage))
  const [confirmReset, setConfirmReset] = useState(false)
  // Hidden amounts on Home and "Maybe Later" on the emergency fund: screen preferences of this device, never data.
  // What an earlier version saved (seven blocks) hides each area that held a hidden block: never fewer amounts.
  const [hiddenAreas, setHiddenAreas] = useState<ReadonlySet<HomeArea>>(() => hiddenAreasFrom(readHiddenBlocks(storage)))
  const [emergencyLater, setEmergencyLater] = useState(() => readEmergencyLater(storage))
  // The demo's own screen preferences: Alex's (nothing hidden, the donut, the emergency suggestion shown), in memory only.
  // They never read or change this device's, and Reset Demo and Exit Demo put them back.
  const [demoPrefs, setDemoPrefs] = useState(DEMO_PREFS)
  // The months follow "today", which differs between the demo and the own
  // space: the twelve months of today's year (and next January in
  // December, to plan ahead). A month chosen for another "today" is not reused.
  const thisMonth = yearMonthOf(space.today)
  const months = [...monthsOfYear(Number(thisMonth.slice(0, 4))), ...(thisMonth.endsWith('-12') ? [addMonthsToYearMonth(thisMonth, 1)] : [])]
  const [chosenMonth, setChosenMonth] = useState<{ from: YearMonth; month: YearMonth } | null>(null)
  const month = chosenMonth?.from === thisMonth ? chosenMonth.month : thisMonth
  const setMonth = (next: YearMonth) => setChosenMonth({ from: thisMonth, month: next })
  /** The month bar: an amount typed for one month is never carried to another; it asks first. */
  const changeMonth = (next: YearMonth) => confirmLeave(form => form.month !== undefined && form.month !== next, () => setMonth(next))
  // How Home is arranged. The own space's layout is remembered on this device for that space;
  // the demo's lasts while the demo is open and goes back to the first layout with Reset Demo.
  const [demoLayout, setDemoLayout] = useState<HomeLayout>(DEFAULT_LAYOUT)
  const [ownLayout, setOwnLayout] = useState<{ spaceId: string; layout: HomeLayout } | null>(null)
  // Show all in Left to Pay: for this session only, separately for the demo and the own space, so Back from a bill finds its row.
  const [demoShowAllBills, setDemoShowAllBills] = useState(false)
  const [ownShowAllBills, setOwnShowAllBills] = useState<{ spaceId: string; value: boolean } | null>(null)
  // How Money looks (open blocks, filters, the source or account shown) and the Goals filter:
  // for this session only, separately for the demo and the own space.
  const [demoMoneyView, setDemoMoneyView] = useState<MoneyView>(INITIAL_MONEY_VIEW)
  const [ownMoneyView, setOwnMoneyView] = useState<{ spaceId: string; view: MoneyView } | null>(null)
  const [demoGoalsFilter, setDemoGoalsFilter] = useState<GoalFilter>('all')
  const [ownGoalsFilter, setOwnGoalsFilter] = useState<{ spaceId: string; filter: GoalFilter } | null>(null)
  // How Bills looks (Calendar or List, filter, chosen day): for this session only, so Back from a bill finds it as it was.
  const [billsView, setBillsView] = useState<BillsView>(INITIAL_BILLS_VIEW)
  // How History looks (its own period, search, filters, open months, records shown): for this session only,
  // separately for the demo and the own space, so Back from a bill or a goal finds it as it was.
  const [demoHistoryView, setDemoHistoryView] = useState<HistoryView>(INITIAL_HISTORY_VIEW)
  const [ownHistoryView, setOwnHistoryView] = useState<{ spaceId: string; view: HistoryView } | null>(null)
  // Where History was scrolled when a bill, a goal or an account was opened from it, and which record
  // (its data-return-key) gets the focus back, to go back to the same place.
  const historyScroll = useRef<{ y: number; key: string | null } | null>(null)
  // Where Goals was scrolled when a goal, New Goal or the Emergency Fund draft was opened from it, and which
  // button gets the focus back. Its filter is kept anyway (goalsFilter).
  const goalsReturn = useRef<{ y: number; key: string } | null>(null)
  // Where Bills was scrolled when a bill (or Add Bill on a day) was opened from it, and which button
  // (its data-return-key) gets the focus back: Back, Cancel and saving from a day return there.
  const billsReturn = useRef<{ y: number; key: string } | null>(null)
  // + Add Bill in the day panel: the day the new bill starts on (null: the top Add Bill, an empty form).
  const [billDay, setBillDay] = useState<CalendarDate | null>(null)
  // The Money block a link asked for (Edit Balances, Open Cards & Loans): it gets the focus instead of the screen title.
  const moneyTarget = useRef<MoneyBlock | null>(null)
  // Where Money was scrolled when a card, a loan or a goal was opened from it, the block, and which
  // button (its data-return-key) gets the focus back: Back returns there.
  const moneyReturn = useRef<{ y: number; block: MoneyBlock; key: string } | null>(null)
  // Where Home was when a link on it was used: its history step, the scroll and the place (see HomeSpot).
  // Back (or Forward) to that same step finds Home there again, as a browser keeps a page's place, until another
  // link on Home is used. Home reached as a new step (a tab, the logo) starts at the top.
  const homeReturn = useRef<{ chain: string; idx: number; y: number; spot: HomeSpot } | null>(null)
  // + Add Income or Add Spending: the form to open when Money or History opens, once.
  const [addRequest, setAddRequest] = useState<'income' | 'spending' | null>(null)
  // What gets the focus when the next screen opens: a field's id (+ Add) or a selector (an account, an income month).
  const addFocus = useRef<string | null>(null)
  // Reports & Backup asked for from Money: Settings opens with the focus on that section.
  const settingsTarget = useRef(false)
  const mainRef = useRef<HTMLElement>(null)
  const firstScreen = useRef(true)

  // Space screens need an open space, and an open space never shows the
  // screens before it (Back after setup must not create a second space).
  // A step saved by an earlier version may name an old tab (Cards, Data): Money shows it.
  const screen: Screen = space.open
    ? (isSpaceScreen(requested) ? shownScreen(requested) : 'home')
    : (isSpaceScreen(requested) ? 'welcome' : requested)
  const shows = (name: Screen) => screen === name
  // The "Bill added" notice belongs to this visit to Bills: any other screen (apart from a bill opened there) ends it.
  const [lastScreen, setLastScreen] = useState(screen)
  if (lastScreen !== screen) {
    setLastScreen(screen)
    if (billsView.added && screen !== 'bills' && screen !== 'bill') setBillsView({ ...billsView, added: null })
  }
  const open = space.open
  // Another tab erased the space: nothing chosen in it stays (the screen falls back to Welcome by itself).
  const [seenNotice, setSeenNotice] = useState(space.notice)
  if (seenNotice !== space.notice) {
    setSeenNotice(space.notice)
    if (space.notice === 'erased') { setGoalId(null); setDebtId(null); setBillId(null); setHistoryFocus(null); setBillsView(INITIAL_BILLS_VIEW); setBillDay(null); setChosenMonth(null); setConfirming(null) }
  }
  // While nothing can be saved, a form closed with changes keeps them in the list, to copy before discarding.
  const savingBlocked = open?.kind === 'own' && space.problem !== null
  useEffect(() => { unsaved.setKeepClosed(savingBlocked) }, [unsaved, savingBlocked])

  // A question asked while a change was being saved: once the answer is in (and the form has closed, if it was kept),
  // the move happens without asking when nothing would close any more; otherwise the question shows.
  useEffect(() => {
    if (!appLeave?.waiting || space.saving) return
    const timer = setTimeout(() => setAppLeave(current => current && { ...current, waiting: false }), 0)
    return () => clearTimeout(timer)
  }, [appLeave, space.saving])
  useEffect(() => {
    if (!appLeave || appLeave.waiting || unsaved.losing(appLeave.lost).length > 0) return
    if (appLeave.history && !nav.ready) return
    const timer = setTimeout(() => {
      setAppLeave(null)
      appLeave.run(false)
    }, 0)
    return () => clearTimeout(timer)
  }, [appLeave, unsaved, unsaved.forms, nav.ready])
  // The same for Back and Forward: with nothing left to close, the first destination is reached (or, when the app
  // cannot move safely, the question simply ends and the next Back works as usual).
  useEffect(() => {
    if (!nav.request || space.saving || unsaved.losing(ANY_FORM).length > 0) return
    const timer = setTimeout(() => {
      if (unsaved.losing(ANY_FORM).length > 0) return
      const now = navigation.snapshot()
      if (now.ready) navigation.leave()
      else if (now.unsure) navigation.keepEditing()
    }, 0)
    return () => clearTimeout(timer)
  }, [nav.request, nav.ready, space.saving, unsaved, unsaved.forms, navigation])
  // Reload, closing the tab or leaving the site: only the browser can ask, in its own words, and not every browser does.
  useEffect(() => {
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!unsaved.hasUnsaved()) return
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [unsaved])
  // A short notice that this tab now shows what another tab saved.
  const { notice, dismissNotice } = space
  useEffect(() => {
    if (notice !== 'updated') return
    const timer = setTimeout(dismissNotice, 6000)
    return () => clearTimeout(timer)
  }, [notice, dismissNotice])

  // Appearance: the open space's choice, or the device's setting before a space is open.
  const theme = open?.data.preferences.theme ?? 'system'
  useEffect(() => { document.documentElement.dataset.theme = theme === 'day-night' ? 'system' : theme }, [theme])

  // After each move, focus goes to the new screen's title so keyboard and
  // screen reader users know where they are.
  // A link to one Money block (Edit Balances, Open Cards & Loans) moves the view and the focus to that block's heading instead.
  useEffect(() => {
    // The first screen (and the one shown when the space has opened) is not a move: the focus stays where the browser put it.
    if (firstScreen.current) { if (!space.opening) firstScreen.current = false; return }
    // + Add Income or Add Spending: the focus goes to the form's first field.
    const field = addFocus.current
    addFocus.current = null
    if (field) {
      const input = /^[#[.]/.test(field) ? mainRef.current?.querySelector<HTMLElement>(field) : document.getElementById(field)
      if (input) { input.focus({ preventScroll: true }); input.scrollIntoView?.({ block: 'center' }); return }
    }
    // Back to Home, on the step a link was used from: the same place, with the focus on that link (or, when it is gone
    // or inside a closed part, on the part's heading, else the area's heading, else + Add).
    const homeBack = screen === 'home' ? homeReturn.current : null
    const step = navigation.current()
    if (homeBack && homeBack.chain === step.chain && homeBack.idx === step.idx) {
      const home = mainRef.current?.querySelector<HTMLElement>('[data-screen="home"]')
      const { area, section, key } = homeBack.spot
      const root = section ? home?.querySelector<HTMLElement>(`[data-home-block="${section}"]`) : area ? home?.querySelector<HTMLElement>(`[data-home-area="${area}"]`) : home
      const usable = (element: HTMLElement | null | undefined) => (element && !element.closest('[inert]') ? element : null)
      const keyed = key ? root?.querySelector<HTMLElement>(`[data-return-key="${key}"]`) : null
      const target = usable(keyed?.matches('button') ? keyed : keyed?.querySelector<HTMLElement>('button'))
        ?? usable(section ? root?.querySelector<HTMLElement>('.block-toggle') : null)
        ?? usable(area ? home?.querySelector<HTMLElement>(`#home-area-${area}`) : null)
        ?? home?.querySelector<HTMLElement>('.home-add button')
      target?.focus({ preventScroll: true })
      window.scrollTo?.(0, homeBack.y)
      target?.scrollIntoView?.({ block: 'nearest' })
      return
    }
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
    // Back to History from a bill, a goal or an account opened there: the same place, with the focus on the
    // record used (else the title, when it is gone or no longer listed).
    const returnTo = screen === 'history' ? historyScroll.current : null
    if (screen !== 'bill' && screen !== 'goal' && screen !== 'money' && screen !== 'debt') historyScroll.current = null
    if (returnTo !== null) {
      const history = mainRef.current?.querySelector<HTMLElement>('[data-screen="history"]')
      const row = returnTo.key ? history?.querySelector<HTMLElement>(`[data-return-key="${CSS.escape(returnTo.key)}"]`) : null
      const title = history?.querySelector<HTMLElement>('h1')
      if (!row && title && !title.hasAttribute('tabindex')) title.setAttribute('tabindex', '-1')
      const target = row ?? title
      target?.focus({ preventScroll: true })
      window.scrollTo?.(0, returnTo.y)
      if (row) row.scrollIntoView?.({ block: 'nearest' })
      return
    }
    // Back to Goals from a goal, New Goal or the Emergency Fund: the same filter and place, with the focus on the
    // button used (else the title, after a goal was deleted).
    const goalsBack = screen === 'goals' ? goalsReturn.current : null
    if (screen !== 'goal' && screen !== 'new-goal' && screen !== 'emergency') goalsReturn.current = null
    if (goalsBack) {
      const goals = mainRef.current?.querySelector<HTMLElement>('[data-screen="goals"]')
      const title = goals?.querySelector<HTMLElement>('h1')
      const target = goals?.querySelector<HTMLElement>(`[data-return-key="${goalsBack.key}"]`) ?? title
      if (target === title && title && !title.hasAttribute('tabindex')) title.setAttribute('tabindex', '-1')
      target?.focus({ preventScroll: true })
      window.scrollTo?.(0, goalsBack.y)
      target?.scrollIntoView?.({ block: 'nearest' })
      return
    }
    // Back to Money from a card, a loan or a goal opened there: the same place, with the focus on the button that
    // opened it, else on its block's heading (after Delete, the button is gone).
    const moneyBack = screen === 'money' ? moneyReturn.current : null
    if (screen !== 'debt' && screen !== 'bill' && screen !== 'goal') moneyReturn.current = null
    if (moneyBack) {
      const money = mainRef.current?.querySelector<HTMLElement>('[data-screen="money"]')
      const target = money?.querySelector<HTMLElement>(`[data-return-key="${moneyBack.key}"]`)
        ?? money?.querySelector<HTMLElement>(`[data-money-block="${moneyBack.block}"] .block-toggle`)
      target?.focus({ preventScroll: true })
      window.scrollTo?.(0, moneyBack.y)
      target?.scrollIntoView?.({ block: 'nearest' })
      return
    }
    // Reports & Backup from Money: Settings with the focus on that section.
    const reports = screen === 'settings' && settingsTarget.current
    settingsTarget.current = false
    if (reports) {
      const section = mainRef.current?.querySelector<HTMLElement>('#settings-reports')
      section?.focus({ preventScroll: true })
      section?.scrollIntoView?.({ block: 'start' })
      return
    }
    // A step of an earlier version's Cards tab shows Money on Cards & Loans.
    const target = screen === 'money' ? moneyTarget.current ?? (requested === 'cards' ? 'debts' : null) : null
    moneyTarget.current = null
    const toggle = target ? mainRef.current?.querySelector<HTMLElement>(`[data-money-block="${target}"] .block-toggle`) : null
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
  }, [screen, requested, space.opening, navigation])

  // After the space is read again (changes from another tab), the screens start again from the new records.
  // The screen, the month and the views stay; the focus and the scroll position are put back where they were, when that place is still there.
  const lastFocus = useRef<number[] | null>(null)
  const lastScroll = useRef(0)
  useEffect(() => {
    const main = mainRef.current
    if (!main) return
    const onFocus = (event: FocusEvent) => {
      const path: number[] = []
      for (let node = event.target as Element | null; node && node !== main; node = node.parentElement) {
        if (!node.parentElement) return
        path.unshift([...node.parentElement.children].indexOf(node))
      }
      lastFocus.current = path
      if (event.target instanceof HTMLElement && event.target.matches('input, select, textarea')) lastField.current = event.target
    }
    const onScroll = () => { lastScroll.current = window.scrollY }
    main.addEventListener('focusin', onFocus)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => { main.removeEventListener('focusin', onFocus); window.removeEventListener('scroll', onScroll) }
  }, [])
  const shownGeneration = useRef(space.generation)
  useLayoutEffect(() => {
    if (shownGeneration.current === space.generation) return
    const first = shownGeneration.current === 0
    shownGeneration.current = space.generation
    if (first || notice !== 'updated') return
    const path = lastFocus.current
    if (path && document.activeElement === document.body) {
      let node: Element | undefined = mainRef.current ?? undefined
      for (const index of path) node = node?.children[index]
      if (node instanceof HTMLElement) node.focus({ preventScroll: true })
    }
    window.scrollTo?.(0, lastScroll.current)
  }, [space.generation, notice])

  const homeLayout = !open ? DEFAULT_LAYOUT
    : open.kind === 'demo' ? demoLayout
      : ownLayout?.spaceId === open.data.space.id ? ownLayout.layout : normalizeLayout(readHomeLayout(storage, open.data.space.id))
  const changeHomeLayout = (layout: HomeLayout) => {
    if (!open) return
    if (open.kind === 'demo') { setDemoLayout(layout); return }
    setOwnLayout({ spaceId: open.data.space.id, layout })
    writeHomeLayout(storage, open.data.space.id, layoutToSave(layout))
  }
  const showAllBills = !open ? false
    : open.kind === 'demo' ? demoShowAllBills
      : ownShowAllBills?.spaceId === open.data.space.id ? ownShowAllBills.value : false
  const changeShowAllBills = (value: boolean) => {
    if (!open) return
    if (open.kind === 'demo') setDemoShowAllBills(value)
    else setOwnShowAllBills({ spaceId: open.data.space.id, value })
  }

  const moneyView = !open ? INITIAL_MONEY_VIEW
    : open.kind === 'demo' ? demoMoneyView
      : ownMoneyView?.spaceId === open.data.space.id ? ownMoneyView.view : INITIAL_MONEY_VIEW
  const changeMoneyView = (view: MoneyView) => {
    if (!open) return
    if (open.kind === 'demo') setDemoMoneyView(view)
    else setOwnMoneyView({ spaceId: open.data.space.id, view })
  }
  const goalsFilter = !open ? 'all'
    : open.kind === 'demo' ? demoGoalsFilter
      : ownGoalsFilter?.spaceId === open.data.space.id ? ownGoalsFilter.filter : 'all'
  const changeGoalsFilter = (filter: GoalFilter) => {
    if (!open) return
    if (open.kind === 'demo') setDemoGoalsFilter(filter)
    else setOwnGoalsFilter({ spaceId: open.data.space.id, filter })
  }
  // A step of an earlier version's Cards tab (Back or Forward to it) opens Cards & Loans in Money.
  const [seenRequested, setSeenRequested] = useState(requested)
  if (seenRequested !== requested) {
    setSeenRequested(requested)
    if (requested === 'cards' && open) changeMoneyView(setBlockOpen(moneyView, 'debts', true))
  }
  const historyView = !open ? INITIAL_HISTORY_VIEW
    : open.kind === 'demo' ? demoHistoryView
      : ownHistoryView?.spaceId === open.data.space.id ? ownHistoryView.view : INITIAL_HISTORY_VIEW
  const changeHistoryView = (view: HistoryView) => {
    if (!open) return
    if (open.kind === 'demo') setDemoHistoryView(view)
    else setOwnHistoryView({ spaceId: open.data.space.id, view })
  }
  /** Money on one block: the block opens, and the view and the focus go to its heading. */
  const showMoneyBlock = (block: MoneyBlock) => {
    changeMoneyView({ ...setBlockOpen(moneyView, block, true), incomeMonth: null })
    moneyTarget.current = block
    navigation.go('money')
  }
  /** Money's link to Reports & Backup: Settings, on that section. */
  const openReports = () => confirmLeave(ANY_FORM, () => { settingsTarget.current = true; navigation.go('settings') })

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

  // What happened when the space could not be started: the setup stays as typed.
  const [setupOutcome, setSetupOutcome] = useState<SaveOutcome | null>(null)
  const finishSetup = async () => {
    const created = createSpaceData(setupFromDraft(setupDraft), newId())
    if (created.status !== 'created') return
    setSetupOutcome(null)
    const outcome = await space.startOwnSpace(created.data)
    if (outcome === 'stale') return
    if (outcome !== 'saved') { setSetupOutcome(outcome); return }
    setSetupDraft(EMPTY_SETUP)
    replace('home')
  }
  const resetGoals = () => { setGoalId(null); setNewGoal(EMPTY_NEW_GOAL); setDebtId(null); setBillId(null); setHistoryFocus(null); setBillsView(INITIAL_BILLS_VIEW); historyScroll.current = null; billsReturn.current = null; homeReturn.current = null; goalsReturn.current = null; setBillDay(null) }
  /** Open Latest Version and Try Again read the space again: what was typed here and not saved is dropped only after a yes. */
  const requestReload = () => {
    if (unsaved.hasUnsaved()) { setConfirming('reload'); return }
    void space.reload()
  }
  const discardTyped = () => { unsaved.discardAll(); setNewGoal(EMPTY_NEW_GOAL); setConfirming(null) }
  const reloadDiscarding = () => { discardTyped(); void space.reload() }
  /** After another tab erased the space: the user discarded what was typed here, and the space closes. */
  const closeErased = () => {
    discardTyped()
    resetGoals(); setOwnLayout(null); setOwnShowAllBills(null); setOwnMoneyView(null); setOwnGoalsFilter(null); setOwnHistoryView(null); setChosenMonth(null)
    space.discardErased()
    replace('welcome')
  }
  const downloadCopies = async (): Promise<boolean> => {
    try {
      const createdAt = new Date().toISOString()
      downloadFile(recoveryFile(await space.exportCopies(), createdAt), recoveryFileName(createdAt))
      return true
    } catch {
      return false
    }
  }
  /** Everything the demo shows on top of its records goes back to the start: layout, views, screen preferences, choices. */
  const clearDemoViews = () => { setDemoLayout(DEFAULT_LAYOUT); setDemoShowAllBills(false); setDemoMoneyView(INITIAL_MONEY_VIEW); setDemoGoalsFilter('all'); setDemoHistoryView(INITIAL_HISTORY_VIEW); setDemoPrefs(DEMO_PREFS); setConfirmReset(false) }
  // What the own space shows and is not kept per space (the Bills view and the month): set aside while the demo is open.
  const ownReturn = useRef<{ billsView: BillsView; chosenMonth: typeof chosenMonth } | null>(null)
  /**
   * Opens the demo. From the own space (Settings) nothing of it goes into the demo: no choice, view or draft;
   * the Bills view and the month are set aside, to be given back on exit. Never while a change is being saved.
   */
  const openDemo = (from: 'settings' | 'welcome') => {
    const bills = billsView
    const month = chosenMonth
    if (space.openDemo() === 'busy') return
    ownReturn.current = from === 'settings' ? { billsView: bills, chosenMonth: month } : null
    setDemoFrom(from)
    resetGoals(); setChosenMonth(null); clearDemoViews(); setConfirming(null)
    if (from === 'settings') navigation.replace('home')
    else navigation.go('home')
  }
  /** Explore the Demo in Settings: it asks first when something typed (here or kept after a problem) would be dropped. */
  const requestDemo = () => {
    if (space.saving || space.opening) return
    if (unsaved.hasUnsaved()) { setConfirming('open-demo'); return }
    openDemo('settings')
  }
  const openDemoDiscarding = () => { discardTyped(); openDemo('settings') }
  /** Leaves the demo, dropping all of it. From Settings, back to the own space's Home, opened again from the store. */
  const leaveDemo = () => {
    space.closeDemo(); resetGoals(); clearDemoViews(); setConfirming(null)
    const back = demoFrom === 'settings' ? ownReturn.current : null
    setBillsView(back?.billsView ?? INITIAL_BILLS_VIEW)
    setChosenMonth(back?.chosenMonth ?? null)
    ownReturn.current = null
    replace(demoFrom === 'settings' ? 'home' : 'welcome')
  }
  /** Exit Demo asks first when something typed in the demo would be dropped. */
  const exitDemo = (where: 'exit-demo' | 'exit-demo-settings' = 'exit-demo') => {
    if (unsaved.hasUnsaved()) { setConfirming(where); return }
    leaveDemo()
  }
  const exitDemoDiscarding = () => { discardTyped(); leaveDemo() }
  // Reset Demo puts the whole example back: the records, the Home layout, Money's closed blocks, the Goals filter, History's first view,
  // Alex's screen preferences, and everything planned or chosen on top of them.
  const resetDemo = () => { space.resetDemo(); resetGoals(); setChosenMonth(null); clearDemoViews() }
  /**
   * Erase in Settings. The space is closed when it no longer opens, also when a copy was left behind
   * (Welcome then says that the erase is not finished); an answer for a space no longer open changes nothing.
   */
  const erase = async (): Promise<EraseOutcome> => {
    const outcome = await space.eraseOwnSpace()
    if (outcome === 'erased' || outcome === 'partly-erased') { setSetupDraft(EMPTY_SETUP); resetGoals(); clearHomeLayout(storage); setOwnLayout(null); setOwnShowAllBills(null); setOwnMoneyView(null); setOwnGoalsFilter(null); setOwnHistoryView(null); setChosenMonth(null); replace('welcome') }
    return outcome
  }
  // Each opens another screen; the open… versions ask first when forms would close, the show… ones are the move itself.
  const showGoal = (id: Id) => { setGoalId(id); navigation.go('goal') }
  const showDebt = (id: Id | null) => { setDebtId(id); navigation.go('debt') }
  const openDebt = (id: Id | null) => confirmLeave(ANY_FORM, () => showDebt(id))
  /** Opens a bill; with `forMonth` (a payment chosen in a card or loan, or in History), on that month, which becomes the shared month. */
  const showBill = (id: Id | null, forMonth?: YearMonth) => { setBillId(id); setBillDay(null); if (forMonth) setMonth(forMonth); navigation.go('bill') }
  const openBill = (id: Id | null, forMonth?: YearMonth) => confirmLeave(ANY_FORM, () => showBill(id, forMonth))
  /** Bills opens a bill, or Add Bill on a day: Back finds Bills where it was, with the focus on the button used. */
  const fromBills = (key: string, show: () => void) => confirmLeave(ANY_FORM, () => { billsReturn.current = { y: window.scrollY, key }; show() })
  const addBillOn = (date: CalendarDate) => fromBills('day-add', () => { setBillId(null); setBillDay(date); navigation.go('bill') })
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
    // The saved form is still on screen for a moment: this Back may close it.
    navigation.backAllowed()
  }
  const selectedGoal = open?.data.goals.find(goal => goal.id === goalId && goal.status === 'active') ?? null
  // New records belong to the one person in an Individual space, and are shared in a Duo.
  const newGoalOwner = open?.data.space.mode === 'individual' ? open.data.space.members[0].id : 'shared'
  const inDemo = open?.kind === 'demo'
  const shownChartView = inDemo ? demoPrefs.chartView : chartView
  const changeChartView = (view: BillsChartView) => {
    if (inDemo) { setDemoPrefs(prefs => ({ ...prefs, chartView: view })); return }
    setChartView(view)
    writeChartView(storage, view)
  }
  /** A purchase chosen on Home opens in History, on its month with no search or filter, ready to change. */
  const showExpense = (id: Id) => {
    const expense = open?.data.expenses.find(e => e.id === id)
    if (expense) changeHistoryView({ ...historyView, filter: { ...NO_FILTER, period: { kind: 'month', month: expense.date.slice(0, 7) } }, openMonths: null, shown: {} })
    setHistoryFocus(id)
    navigation.go('history')
  }
  /** Home opens another screen: Back to this step of Home finds it where it was (see homeReturn). */
  const fromHome = (spot: HomeSpot, show: () => void) => confirmLeave(ANY_FORM, () => {
    homeReturn.current = { ...navigation.current(), y: window.scrollY, spot }
    show()
  })
  /**
   * + Add on Home: the form that already exists, on its own screen, one step after Home. Income and Spending open
   * their form once (Back and Forward do not open it again); Cancel there closes it and goes back to Home; saving
   * keeps that screen, with the new record, and Back goes to Home. A bill or a goal works as from Bills and Goals.
   */
  const addFromHome = (what: HomeAdd, spot: HomeSpot) => fromHome(spot, () => {
    if (what === 'income') {
      changeMoneyView({ ...setBlockOpen(moneyView, 'income', true), incomeSource: null, incomeMonth: null })
      setAddRequest('income'); addFocus.current = 'income-name'
      navigation.go('money')
    } else if (what === 'spending') {
      setHistoryFocus(null)
      if (historyView.filter === null) changeHistoryView({ ...historyView, filter: firstFilter(month) })
      setAddRequest('spending'); addFocus.current = 'expense-new-date'
      navigation.go('history')
    } else if (what === 'bill') showBill(null)
    else navigation.go('new-goal')
  })
  /** The form + Add opened was cancelled: back to Home, where it was. Nothing was typed that Cancel did not already drop. */
  const cancelAdd = () => navigation.backAllowed()
  /** History opens a bill, a goal or an account: Back finds History scrolled where it was, with the focus on that record. */
  const fromHistory = (key: string | null, show: () => void) => confirmLeave(ANY_FORM, () => { historyScroll.current = { y: window.scrollY, key }; show() })
  /** Accounts & Savings in Money, on one account: it opens, with the focus on it (else on the block's heading). */
  const showAccount = (id: Id) => {
    const known = open?.data.moneyAccounts.some(a => a.id === id) ?? false
    changeMoneyView({ ...setBlockOpen(moneyView, 'accounts', true), account: known ? id : null, incomeMonth: null })
    if (known) addFocus.current = `[data-return-key="account-${id}"]`
    else moneyTarget.current = 'accounts'
    navigation.go('money')
  }
  /** Goals opens a goal, New Goal or the Emergency Fund draft: Back finds Goals where it was, with the focus on the button used. */
  const fromGoals = (key: string, show: () => void) => confirmLeave(ANY_FORM, () => { goalsReturn.current = { y: window.scrollY, key }; show() })
  /**
   * Income on Home, for the month shown. Income does not follow Home's month (it keeps its own view), so nothing
   * there changes month: with one source in that month, Money opens it on that month's payment; with more
   * (or none), Money › Income says which sources the month has, without choosing one.
   */
  const showIncomeFor = (forMonth: YearMonth) => {
    const sources = open ? monthIncome(open.data, forMonth).lines.flatMap(line => (line.source ? [line.source] : [])) : []
    const single = sources.length === 1 ? sources[0].id : null
    // A source of that month may be ended (or upcoming) today: the list then shows All, so it can be found.
    const listed = sources.every(source => matchesValidity(source, thisMonth, moneyView.incomeFilter))
    changeMoneyView({ ...setBlockOpen(moneyView, 'income', true), incomeSource: single, incomeMonth: forMonth, incomeFilter: listed ? moneyView.incomeFilter : 'all' })
    if (single) addFocus.current = `[data-income-row="${single}:${forMonth}"] button`
    else addFocus.current = '#income-context'
    navigation.go('money')
  }
  /** Spent on Home: History on that month, with no search or filter. */
  const showSpentFor = (forMonth: YearMonth) => {
    setHistoryFocus(null)
    changeHistoryView({ ...historyView, filter: { ...NO_FILTER, period: { kind: 'month', month: forMonth } }, openMonths: null, shown: {} })
    navigation.go('history')
  }
  /** Money opens a card, a loan or a goal: Back finds Money where it was, with the focus on the button used. */
  const fromMoney = (block: MoneyBlock, key: string, show: () => void) => confirmLeave(ANY_FORM, () => { moneyReturn.current = { y: window.scrollY, block, key }; show() })
  const shownHidden = inDemo ? demoPrefs.hidden : hiddenAreas
  // Saved with the names of every block of each hidden area, so an earlier version of the app hides the same amounts.
  const saveHidden = (next: ReadonlySet<HomeArea>) => {
    if (inDemo) { setDemoPrefs(prefs => ({ ...prefs, hidden: next })); return }
    setHiddenAreas(next)
    writeHiddenBlocks(storage, savedHiddenNames(next))
  }
  const visibility = {
    hidden: shownHidden,
    toggle: (area: HomeArea) => {
      const next = new Set(shownHidden)
      if (next.has(area)) next.delete(area)
      else next.add(area)
      saveHidden(next)
    },
    setAll: (hide: boolean) => saveHidden(new Set(hide ? HOME_AREAS : [])),
  }
  const shownEmergencyLater = inDemo ? demoPrefs.emergencyLater : emergencyLater
  const emergencyLaterChange = (later: boolean) => {
    if (inDemo) { setDemoPrefs(prefs => ({ ...prefs, emergencyLater: later })); return }
    setEmergencyLater(later)
    writeEmergencyLater(storage, later)
  }
  const selectTab = (tab: Tab) => {
    if (tab === screen) return
    confirmLeave(ANY_FORM, () => {
      if (tab === 'history') {
        // From the tab bar, History opens as it was left (no purchase from Home); the first time, on the year of the month shown.
        setHistoryFocus(null)
        if (historyView.filter === null) changeHistoryView({ ...historyView, filter: firstFilter(month) })
      }
      navigation.go(tab)
    })
  }
  /** The logo: Home of the open space (or Welcome before one is open). Already there, it does nothing, so no history step is added. */
  const goToStart = () => {
    const start = open ? 'home' : 'welcome'
    if (screen !== start) go(start)
  }

  const writeStatus = useMemo(() => ({ saving: space.saving, canWrite: space.canWrite, revision: space.revision }), [space.saving, space.canWrite, space.revision])

  // Leave without saving?: the app's own question first; Back and Forward's when it is the only one.
  const asking = appLeave && !appLeave.waiting ? 'app' : nav.request && !space.saving ? 'history' : null
  const askingForms = asking === 'app' ? unsaved.losing(appLeave!.lost) : asking === 'history' ? unsaved.losing(ANY_FORM) : []
  const endQuestion = () => {
    setAppLeave(null)
    if (nav.request) navigation.keepEditing()
  }
  const keepEditing = () => {
    endQuestion()
    const field = questionField.current
    questionField.current = null
    if (field?.isConnected) field.focus({ preventScroll: true })
  }
  const discardAndLeave = () => {
    questionField.current = null
    if (asking === 'history') { navigation.leave(); return }
    const leave = appLeave
    endQuestion()
    leave?.run(true)
  }
  const leaveQuestion = askingForms.length > 0 && (
    <LeaveDialog forms={askingForms} typedText={() => unsaved.typedText(askingForms.map(form => form.id))}
      canDiscard={asking === 'app' ? !appLeave!.history || nav.ready : nav.ready} onKeep={keepEditing} onDiscard={discardAndLeave} />
  )

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
        <DemoBanner asking={confirmReset} onAskingChange={setConfirmReset} onReset={resetDemo} onExit={() => exitDemo()}
          exitQuestion={confirming === 'exit-demo' && <>
            <UnsavedForms forms={unsaved.forms} typedText={unsaved.typedText} />
            <ConfirmDiscard question="Leaving the demo closes what you typed in it. It cannot be brought back." confirm="Discard and Exit Demo" onConfirm={exitDemoDiscarding} onCancel={() => setConfirming(null)} />
          </>} />
      )}
      {open?.kind === 'own' && space.problem?.kind === 'read-only' && (space.problem.takenOver ? (
        <div className="save-warning" role="alert">
          <p><b>Read-only.</b> A newer version of the app was opened in another tab, so nothing more is saved here. Anything you typed stays on screen: copy what you need, then reload this page. You can still use Download Backup in Settings, under Reports &amp; Backup.</p>
        </div>
      ) : (
        <div className="save-warning" role="alert">
          <p><b>Read-only.</b> This browser cannot save safely here. This may be an older copy of your space. Changes will not be saved. You can still look at everything and use Download Backup or Download Both Copies in Settings, under Reports &amp; Backup.</p>
          <UnsavedForms forms={unsaved.forms} typedText={unsaved.typedText} />
          {confirming === 'reload'
            ? <ConfirmDiscard question="Trying again closes the forms you changed here. What you typed cannot be brought back." confirm="Discard and Try Again" onConfirm={reloadDiscarding} onCancel={() => setConfirming(null)} />
            : <button type="button" className="button-small" onClick={requestReload}>Try Again</button>}
        </div>
      ))}
      {open?.kind === 'own' && space.problem?.kind === 'conflict' && (
        <div className="save-warning" role="alert">
          <p>This space changed in another tab, so nothing more is saved here until it is opened again. {unsaved.forms.length > 0 ? 'Your changes here are not saved yet. Copy what you need, then Open Latest Version.' : 'Anything you typed stays on screen: copy what you need first.'}</p>
          <UnsavedForms forms={unsaved.forms} typedText={unsaved.typedText} />
          {confirming === 'reload'
            ? <ConfirmDiscard question="Opening the latest version closes the forms you changed here. What you typed cannot be brought back." confirm="Discard and Open Latest Version" onConfirm={reloadDiscarding} onCancel={() => setConfirming(null)} />
            : <button type="button" className="button-small" onClick={requestReload}>Open Latest Version</button>}
        </div>
      )}
      {open?.kind === 'own' && space.problem?.kind === 'erased-elsewhere' && (
        <div className="save-warning" role="alert">
          <p><b>This space was erased in another tab.</b> Nothing here can be saved. Copy what you typed, then discard it to close the space.</p>
          <UnsavedForms forms={unsaved.forms} typedText={unsaved.typedText} />
          {confirming === 'discard-erased'
            ? <ConfirmDiscard question="Discard what you typed and close this space? It cannot be brought back." confirm="Discard and Close" onConfirm={closeErased} onCancel={() => setConfirming(null)} />
            : <button type="button" className="button-small" onClick={() => setConfirming('discard-erased')}>Discard and Close…</button>}
        </div>
      )}
      {notice === 'older-copy-changed' && (
        <div className="save-warning" role="alert">
          <p>An older version of the app is open in another tab. Close it so nothing is lost: what it saves is not part of this space.</p>
          <button type="button" className="button-small" onClick={dismissNotice}>OK</button>
        </div>
      )}
      {notice === 'updated' && open?.kind === 'own' && !space.problem && <p className="update-notice" role="status">Updated with changes from another tab.</p>}
      {showNav && <BottomNav current={isTab(screen) ? screen : null} onSelect={selectTab} />}
      {leaveQuestion}
      <WriteStatusContext.Provider value={writeStatus}>
      <UnsavedChangesContext.Provider value={unsaved.registry}>
      <LeaveGuardContext.Provider value={leaveGuard}>
      <main className="shell-main" ref={mainRef} data-saving={space.saving || undefined}>
        {space.saving && <p className="visually-hidden" role="status">Saving…</p>}
        {!open && space.opening && <div className="screen" data-screen="opening">
          <Opening onRetry={() => void space.reload()} />
        </div>}
        {!space.opening && shows('welcome') && (space.problem?.kind === 'unreadable' ? <div className="screen" data-screen="recovery">
          <Recovery problem={space.problem} busy={space.saving} onDownload={downloadCopies} onUseOlderCopy={space.restoreOlderCopy}
            onErase={() => space.eraseOwnSpace()} onRetry={() => void space.reload()} onExplore={() => openDemo('welcome')} />
        </div> : <div className="screen" data-screen="welcome">
          <Welcome problem={space.problem} busy={space.saving} onCreateAccount={() => go('sign-up')} onLogIn={() => go('log-in')} erasedElsewhere={notice === 'erased'}
            onExplore={() => openDemo('welcome')} onErase={() => space.eraseOwnSpace()} onRetry={() => void space.reload()} />
        </div>)}
        {(shows('sign-up') || shows('log-in')) && <div className="screen" data-screen={screen}>
          <AuthPreview key={screen} mode={screen === 'sign-up' ? 'sign-up' : 'log-in'} onBack={back} onContinue={() => go('setup')} />
        </div>}
        {shows('setup') && <div className="screen" data-screen="setup">
          <WelcomeSetup draft={setupDraft} onChange={setSetupDraft} onBack={back} onFinish={() => void finishSetup()} saving={space.saving} outcome={setupOutcome} />
        </div>}

        {open && <Fragment key={space.generation}>
          {shows('home') && <div className="screen" data-screen="home">
            <AmountVisibilityProvider value={visibility}>
              <HomeScreen data={open.data} months={months} month={month} onMonthChange={changeMonth} today={space.today}
                chartView={shownChartView} onChartViewChange={changeChartView} layout={homeLayout} onLayoutChange={changeHomeLayout}
                showAllBills={showAllBills} onShowAllBillsChange={changeShowAllBills}
                onChange={space.update} onOpen={(next, spot) => fromHome(spot, () => navigation.go(next))}
                onOpenMoneyBlock={(block, spot) => fromHome(spot, () => showMoneyBlock(block))} onOpenGoal={(id, spot) => fromHome(spot, () => showGoal(id))}
                onOpenIncome={(forMonth, spot) => fromHome(spot, () => showIncomeFor(forMonth))} onOpenSpent={(forMonth, spot) => fromHome(spot, () => showSpentFor(forMonth))}
                onOpenDebt={(id, spot) => fromHome(spot, () => showDebt(id))} onOpenBill={(id, spot) => fromHome(spot, () => showBill(id))}
                onOpenExpense={(id, spot) => fromHome(spot, () => showExpense(id))} onAdd={addFromHome}
                emergencyLater={shownEmergencyLater} onEmergencyLater={() => emergencyLaterChange(true)} />
            </AmountVisibilityProvider>
          </div>}
          {shows('bills') && <div className="screen" data-screen="bills">
            <AmountVisibilityProvider value={visibility}>
              <BillsScreen data={open.data} months={months} month={month} today={space.today} isDemo={open.kind === 'demo'} view={billsView} onViewChange={setBillsView}
                onMonthChange={next => confirmLeave(form => form.month !== undefined && form.month !== next, () => { setBillsView(view => ({ ...view, added: null, selected: null })); setMonth(next) })}
                onChange={space.update} onOpenBill={(id, key) => fromBills(key, () => showBill(id))} onAddBill={() => openBill(null)} onAddBillOn={addBillOn} />
            </AmountVisibilityProvider>
          </div>}
          {shows('debt') && <div className="screen" data-screen="debt">
            <DebtScreen key={debtId ?? 'new'} data={open.data} debtId={debtId} months={months} month={month} onMonthChange={changeMonth}
              today={space.today} isDemo={open.kind === 'demo'} owner={newGoalOwner} newId={newId} onBack={back} onCancel={() => navigation.backAllowed()} onChange={space.update} onOpenBill={openBill}
              onCreated={id => { setDebtId(id); replace('debt') }} onDeleted={() => { setDebtId(null); navigation.backAllowed() }} />
          </div>}
          {shows('bill') && <div className="screen" data-screen="bill">
            <BillScreen key={billId ?? `new-${billDay ?? ''}`} data={open.data} billId={billId} dueDate={billDay} months={months} month={month} onMonthChange={changeMonth} today={space.today} owner={newGoalOwner} newId={newId}
              onBack={back} onCancel={() => navigation.backAllowed()} onChange={space.update} onOpenDebt={openDebt}
              onCreated={billCreated} onDeleted={() => { setBillId(null); navigation.backAllowed() }} />
          </div>}
          {(shows('goals') || (shows('goal') && !selectedGoal)) && <div className="screen" data-screen="goals">
            {shows('goal') && goalId && <p className="callout" role="status">The goal you had open is no longer here. It may have been changed or deleted in another tab.</p>}
            <GoalsScreen data={open.data} today={space.today} filter={goalsFilter} onFilterChange={changeGoalsFilter}
              onNew={() => fromGoals('add-goal', () => navigation.go('new-goal'))} onOpenGoal={id => fromGoals(`goal-${id}`, () => showGoal(id))}
              onStartEmergency={() => fromGoals('start-emergency', () => navigation.go('emergency'))} />
          </div>}
          {shows('goal') && selectedGoal && <div className="screen" data-screen="goal">
            <GoalDetailScreen key={selectedGoal.id} data={open.data} goal={selectedGoal} today={space.today} isDemo={open.kind === 'demo'} newId={newId} onBack={back}
              onChange={(data, base) => space.update(() => data, base)}
              onDeleted={async (data, base) => {
                const outcome = await space.update(() => data, base)
                if (isKept(outcome)) { setGoalId(null); navigation.backAllowed() }
                return outcome
              }} onReviewEmergency={() => go('emergency')} />
          </div>}
          {shows('new-goal') && <div className="screen" data-screen="new-goal">
            <NewGoalScreen data={open.data} today={space.today} owner={newGoalOwner} state={newGoal} onStateChange={setNewGoal} onCancel={back}
              onCreate={async (fields, base) => {
                const id = newId()
                const created = createGoal(open.data, id, fields, space.today)
                if (created.status !== 'valid') return 'not-saved'
                const outcome = await space.update(() => created.data, base)
                if (!isKept(outcome)) return outcome
                setNewGoal(EMPTY_NEW_GOAL)
                setGoalId(id)
                replace('goal')
                return outcome
              }} />
          </div>}
          {shows('emergency') && <div className="screen" data-screen="emergency">
            <EmergencyScreen data={open.data} today={space.today} owner={newGoalOwner} newId={newId} onBack={back} onCancel={() => navigation.backAllowed()}
              onSave={async (data, base) => {
                const outcome = await space.update(() => data, base)
                if (isKept(outcome)) emergencyLaterChange(false)
                return outcome
              }} onOpenGoal={id => { setGoalId(id); replace('goal') }} />
          </div>}
          {shows('history') && <div className="screen" data-screen="history">
            <AmountVisibilityProvider value={visibility}>
              <HistoryScreen key={historyFocus ?? 'all'} data={open.data} months={months} month={month} today={space.today} newId={newId} focusId={historyFocus}
                view={historyView} onViewChange={changeHistoryView}
                startAdding={addRequest === 'spending'} onStartedAdding={() => setAddRequest(null)} onCancelAdding={cancelAdd}
                onChange={space.update} onOpenBill={(id, forMonth, key) => fromHistory(key, () => showBill(id, forMonth))} onOpenGoal={(id, key) => fromHistory(key, () => showGoal(id))}
                onOpenAccount={(id, key) => fromHistory(key, () => open.data.debts.some(debt => debt.id === id) ? showDebt(id) : showAccount(id))} />
            </AmountVisibilityProvider>
          </div>}
          {/* A step of an earlier version (cards, data) also shows Money: moving to or from it starts Money again, so its forms close as on any other move. */}
          {shows('money') && <div className="screen" data-screen="money">
            <MoneyScreen key={`${open.kind}:${requested}`} data={open.data} isDemo={open.kind === 'demo'} months={months} month={month} onMonthChange={changeMonth} today={space.today} owner={newGoalOwner} newId={newId}
              view={moneyView} onViewChange={changeMoneyView} onChange={space.update}
              startAdding={addRequest === 'income'} onStartedAdding={() => setAddRequest(null)} onCancelAdding={cancelAdd}
              onOpenDebt={id => fromMoney('debts', id ? `debt-${id}` : 'add-debt', () => { setDebtId(id); navigation.go('debt') })}
              onOpenGoal={id => fromMoney('accounts', `goal-${id}`, () => showGoal(id))} onOpenReports={openReports} />
          </div>}
          {shows('settings') && <div className="screen" data-screen="settings">
            <SettingsScreen data={open.data} isDemo={open.kind === 'demo'} months={months} month={month} today={space.today}
              onReplace={space.replaceData} onDownloadCopies={space.problem?.kind === 'read-only' ? downloadCopies : undefined} onBack={back} onExitDemo={() => exitDemo('exit-demo-settings')} onResetDemo={resetDemo} onErase={erase}
              onExploreDemo={requestDemo} demoQuestion={confirming === 'open-demo' ? <>
                <UnsavedForms forms={unsaved.forms} typedText={unsaved.typedText} />
                <ConfirmDiscard question="Opening the demo closes what you typed here. It cannot be brought back." confirm="Discard and Open Demo" onConfirm={openDemoDiscarding} onCancel={() => setConfirming(null)} />
              </> : confirming === 'exit-demo-settings' ? <>
                <UnsavedForms forms={unsaved.forms} typedText={unsaved.typedText} />
                <ConfirmDiscard question="Leaving the demo closes what you typed in it. It cannot be brought back." confirm="Discard and Exit Demo" onConfirm={exitDemoDiscarding} onCancel={() => setConfirming(null)} />
              </> : null}
              onThemeChange={theme => space.update(data => ({ ...data, preferences: { ...data.preferences, theme } }))} canErase={space.problem === null} />
          </div>}
        </Fragment>}
      </main>
      </LeaveGuardContext.Provider>
      </UnsavedChangesContext.Provider>
      </WriteStatusContext.Provider>
      <footer className="shell-footer">
        {!open ? 'Prototype · No account needed · Nothing is sent anywhere'
          : open.kind === 'demo' ? 'Demo · Invented information · Changes are not saved · No account, no bank connection'
          : 'Prototype · Saved on this device only · Not secure storage · No bank connection'}
      </footer>
    </div>
  )
}

export default App
