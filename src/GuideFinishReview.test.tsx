// @vitest-environment jsdom
import { act, cleanup, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { browserSpaceStore } from './app/useSpace'
import { exportBackup, exportFinanceData } from './data/exchange'
import { validateFinanceData } from './data/validate'
import { createAlexDemo } from './data/fixtures/demoAlex'
import type { SpaceStore, StoreChange } from './data/spaceStore'
import { createSpaceData } from './domain/finance/space'
import type { FinanceData } from './domain/finance/types'
import { NEW_PROGRESS, type GuideProgress } from './features/home/gettingStarted'
import { memoryStorage, storedKeys } from './test/memoryStorage'
import { fire, freshDatabaseForEachTest, heldStore, refuseWrites, settle, storedData, storedGuideRecord, storedProgress } from './test/space'

/*
 * GS-6B: Finish and Review Setup. Done shows Home only once "finished" is
 * saved; the card leaves Home for good; Review Setup (Home options, Help &
 * Guide) opens the summary, lets every stage be changed and never starts
 * the guide again. The states come from saved records and answers only.
 */

vi.mock('./ui/download', () => ({ downloadFile: vi.fn() }))

freshDatabaseForEachTest()
beforeEach(() => { window.history.replaceState(null, '') })
afterEach(() => { cleanup(); vi.restoreAllMocks() })

const TODAY = '2026-10-21'
const button = (name: string | RegExp) => screen.getByRole('button', { name })
const field = (label: string | RegExp) => screen.getByLabelText(label) as HTMLInputElement
const text = (element: Element | null) => (element?.textContent ?? '').replace(/\u00a0|\u202f/g, ' ')
const tab = (name: string) => within(screen.getByRole('navigation', { name: 'Main navigation' })).getByRole('button', { name })
const card = () => screen.queryByRole('region', { name: 'Getting Started' })
const title = () => screen.getByRole('heading', { level: 1 }).textContent
const alerts = () => screen.queryAllByRole('alert').map(alert => alert.textContent).join(' ')
const shown = () => document.querySelector('[data-screen]')?.getAttribute('data-screen')
/** The Finish / Review Setup summary: each line's stage and state, as the screen shows them. */
const summary = () => within(screen.getByRole('list', { name: 'Your setup' })).getAllByRole('listitem')
  .map(item => `${item.querySelector('.item-name')?.textContent}: ${item.querySelector('b')?.textContent}`)
const progress = (change: Partial<GuideProgress> = {}): GuideProgress => ({ ...NEW_PROGRESS, ...change })

function robin(name = 'Robin'): FinanceData {
  const made = createSpaceData({ mode: 'individual', names: [name], currency: 'PLN', theme: 'light' })
  if (made.status !== 'created') throw new Error('invalid setup')
  return made.data
}

/** Alex's invented records as an own space (Individual), so every stage already has something. */
function withRecords(change: (data: FinanceData) => FinanceData = data => data): FinanceData {
  const alex = createAlexDemo()
  const own = robin()
  return valid(change({ ...alex, space: { ...alex.space, id: own.space.id } }))
}

/** Some kinds of records removed, with what pointed at them (so the space stays valid). */
function without(data: FinanceData, kinds: { accounts?: boolean; income?: boolean; debts?: boolean; goals?: boolean }): FinanceData {
  let next = { ...data }
  if (kinds.income) next = { ...next, incomeSources: [], income: [] }
  if (kinds.debts) {
    const debts = new Set(next.debts.map(debt => debt.id))
    next = { ...next, debts: [], bills: next.bills.filter(bill => !bill.debtId), balances: next.balances.filter(balance => !debts.has(balance.accountId)),
      expenses: next.expenses.filter(expense => !debts.has(expense.accountId)), transfers: next.transfers.filter(transfer => !debts.has(transfer.fromAccountId) && !debts.has(transfer.toAccountId)) }
  }
  if (kinds.goals || kinds.accounts) next = { ...next, goals: [], goalMovements: [] }
  if (kinds.accounts) next = { ...next, moneyAccounts: [], balances: [], transfers: [], expenses: [], billMonths: [] }
  const bills = new Set(next.bills.map(bill => bill.id))
  return valid({ ...next, billMonths: next.billMonths.filter(month => bills.has(month.billId)) })
}

function valid(data: FinanceData): FinanceData {
  const checked = validateFinanceData(data)
  if (checked.status !== 'valid') throw new Error(checked.errors.slice(0, 3).join(' '))
  return data
}

async function savedSpace(data = robin(), saved?: GuideProgress) {
  const store = browserSpaceStore(memoryStorage())
  await store.create(data)
  if (saved) {
    const result = await store.saveProgress(data.space.id, saved, 0)
    if (result.status !== 'saved') throw new Error('progress not saved')
  }
  return data
}

/** This tab; notices from other tabs come when the test says (`tell`). */
async function openTab(storage: Storage = memoryStorage(), inner: SpaceStore = browserSpaceStore(memoryStorage())) {
  let listener: ((change: StoreChange) => void) | null = null
  const store: SpaceStore = { ...inner, watch: onChange => { listener = onChange; return () => { listener = null } } }
  render(<App getToday={() => TODAY} storage={storage} createStore={() => store} />)
  await settle()
  return { storage, tell: async (change: StoreChange) => { act(() => listener?.(change)); await settle() } }
}

async function toFinish() {
  await fire.click(within(card()!).getByRole('button', { name: /setup$/ }))
  for (let index = 0; index < 5 && title() !== 'Finish'; index++) await fire.click(button('Skip for now'))
  expect(title()).toBe('Finish')
}

async function homeOptions(): Promise<string[]> {
  await fire.click(button('Home options'))
  const items = within(screen.getByRole('menu', { name: 'Home options' })).getAllByRole('menuitem').map(item => item.textContent ?? '')
  await fire.keyDown(screen.getByRole('menu', { name: 'Home options' }), { key: 'Escape' })
  return items
}

async function reviewFromHome() {
  await fire.click(button('Home options'))
  await fire.click(within(screen.getByRole('menu', { name: 'Home options' })).getByRole('menuitem', { name: 'Review Setup' }))
}

async function openHelp() {
  await fire.click(button('Settings'))
  await fire.click(button('Open Help & Guide'))
}

async function upload(content: string) {
  await act(async () => {
    await fire.change(field('Choose a backup file (JSON)'), { target: { files: [new File([content], 'data.json', { type: 'application/json' })] } })
    await new Promise(resolve => setTimeout(resolve, 20))
  })
}

describe('Finish (GS-6B)', () => {
  it('lists the five stages in the five states, never an amount, and can finish with stages still open', async () => {
    // Amounts shown (Hide amounts off): Finish still has no figure.
    await savedSpace(withRecords(data => without(data, { income: true, debts: true, goals: true })))
    await openTab()
    await fire.click(within(card()!).getByRole('button', { name: /setup$/ }))
    expect(title()).toBe('Income')
    await fire.click(button('I don’t have regular income'))
    await fire.click(button('I don’t have any debts'))
    // Bills is complete (records), Goals left for later.
    await fire.click(button(/^Continue/))
    await fire.click(button('Skip for now'))
    expect(title()).toBe('Finish')
    expect(summary()).toEqual(['Accounts & Savings: Completed', 'Income: No regular income', 'Debts: No debts', 'Bills & Subscriptions: Completed', 'Goals: Skipped'])
    const list = screen.getByRole('list', { name: 'Your setup' })
    expect(text(list)).not.toMatch(/\d/)
    expect(text(list)).not.toMatch(/zł|PLN/)
    expect(screen.queryByText(/Nothing is added yet/)).toBeNull()
    expect(text(screen.getByRole('main'))).toContain('You can finish now, even with stages still open.')
    expect(button('Done')).toBeTruthy()
  })

  it('without any record it explains, without blocking, and Done shows Home without the card for good', async () => {
    await savedSpace()
    const { storage } = await openTab()
    await toFinish()
    expect(summary().every(line => line.endsWith(': Skipped'))).toBe(true)
    expect(text(screen.getByRole('main'))).toContain('Nothing is added yet. That’s fine: you can add your accounts, income, bills and goals at any time.')
    await fire.click(button('Done'))
    expect(shown()).toBe('home')
    expect(card()).toBeNull()
    expect(await storedProgress()).toMatchObject({ finished: true })
    // Back does not return into the guide: it was opened from Home, so Done went back to that same step.
    expect(window.history.state?.idx ?? 0).toBe(0)
    // After a reload: the confirmed state only. No card, and Review Setup in Home options.
    cleanup()
    await openTab(storage)
    expect(card()).toBeNull()
    expect(await homeOptions()).toContain('Review Setup')
  })

  it('before Finish, Home options has no Review Setup and Help & Guide keeps Open Getting Started', async () => {
    await savedSpace()
    await openTab()
    expect(card()).not.toBeNull()
    expect(await homeOptions()).not.toContain('Review Setup')
    await openHelp()
    expect(button('Open Getting Started')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Review Setup' })).toBeNull()
  })

  it('opened from Help & Guide, Done shows Home too', async () => {
    await savedSpace()
    await openTab()
    await openHelp()
    await fire.click(button('Open Getting Started'))
    for (let index = 0; index < 5; index++) await fire.click(button('Skip for now'))
    await fire.click(button('Done'))
    expect(shown()).toBe('home')
    expect(card()).toBeNull()
  })

  it('says Finishing… while it saves, a second press does nothing, and Home shows only once it is saved', async () => {
    await savedSpace()
    const held = heldStore()
    await openTab(memoryStorage(), held.store)
    await toFinish()
    const revision = (await storedGuideRecord())!.revision as number
    held.hold()
    const before = held.calls.filter(call => call === 'saveProgress').length
    await fire.click(button('Done'))
    expect(button('Finishing…').getAttribute('aria-disabled')).toBe('true')
    expect(screen.getAllByRole('status').map(status => status.textContent)).toContain('Finishing…')
    await fire.click(button('Finishing…'))
    await fire.click(button('Finishing…'))
    expect(held.calls.filter(call => call === 'saveProgress').length).toBe(before + 1)
    expect(shown()).toBe('guide')
    expect(await storedProgress()).toMatchObject({ finished: false })
    await held.release()
    await settle()
    expect(shown()).toBe('home')
    expect(card()).toBeNull()
    expect(await storedProgress()).toMatchObject({ finished: true })
    // The presses made while it saved sent nothing more, then or later.
    expect(held.calls.filter(call => call === 'saveProgress').length).toBe(before + 1)
    expect(await storedGuideRecord()).toMatchObject({ revision: revision + 1 })
  })

  it('a reload before the save is confirmed shows the guide as not finished', async () => {
    await savedSpace()
    const held = heldStore()
    const { storage } = await openTab(memoryStorage(), held.store)
    await toFinish()
    held.hold()
    await fire.click(button('Done'))
    expect(button('Finishing…')).toBeTruthy()
    // The page goes away before the browser answered.
    cleanup()
    await openTab(storage)
    expect(card()).not.toBeNull()
    expect(text(card())).toContain('Step 6 of 6 · Finish')
  })

  it('when it is not saved it says Try Again, stays on Finish and never claims it finished', async () => {
    await savedSpace()
    await openTab()
    await toFinish()
    refuseWrites()
    await fire.click(button('Done'))
    expect(shown()).toBe('guide')
    expect(title()).toBe('Finish')
    expect(alerts()).toContain('This browser did not save it.')
    expect(button('Try Again')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Done' })).toBeNull()
    expect(await storedProgress()).toMatchObject({ finished: false })
    vi.restoreAllMocks()
    await fire.click(button('Try Again'))
    expect(shown()).toBe('home')
    expect(card()).toBeNull()
    expect(await storedProgress()).toMatchObject({ finished: true })
  })

  it('another tab finished first: this tab shows the latest, says so and does not claim it finished here', async () => {
    const data = await savedSpace()
    await openTab()
    await toFinish()
    // The other tab finishes; its notice never arrives here.
    const other = browserSpaceStore(memoryStorage())
    const latest = await other.loadProgress(data.space.id)
    if (latest.status !== 'loaded') throw new Error('not loaded')
    await other.saveProgress(data.space.id, { ...latest.progress, finished: true }, latest.revision)
    await fire.click(button('Done'))
    expect(alerts()).toContain('Not saved: Getting Started changed in another tab. Its latest progress is shown.')
    expect(shown()).toBe('guide')
    expect(title()).toBe('Review Setup')
    expect(await storedProgress()).toMatchObject({ finished: true })
  })
})

describe('Review Setup (GS-6B)', () => {
  it('from Home options opens the summary; a stage can be changed, the state follows the saved records, and Close goes back to Home', async () => {
    const data = await savedSpace(robin(), progress({ finished: true, skipped: ['accounts', 'income', 'debts', 'bills', 'goals'] }))
    await openTab()
    const record = await storedGuideRecord()
    await reviewFromHome()
    expect(shown()).toBe('guide')
    expect(title()).toBe('Review Setup')
    expect(document.activeElement?.id === 'gs-stage-title' || document.activeElement?.tagName === 'H1').toBe(true)
    expect(summary()[0]).toBe('Accounts & Savings: Skipped')
    // Each line opens its stage.
    await fire.click(button('Accounts & Savings: Skipped. Open this stage'))
    expect(title()).toBe('Accounts & Savings')
    // Something typed but not saved never completes the stage.
    await fire.click(button(/^Add (Another )?Account$/))
    await fire.change(field('Account Name'), { target: { value: 'Main account' } })
    await fire.click(within(screen.getByRole('navigation', { name: 'Getting Started stages' })).getByRole('button', { name: /^Finish/ }))
    expect(text(screen.getByRole('alertdialog'))).toContain('Leave without saving?')
    await fire.click(button('Keep Editing'))
    expect(title()).toBe('Accounts & Savings')
    await fire.click(button('Save Account'))
    expect((await storedData())!.moneyAccounts.map(account => account.name)).toEqual(['Main account'])
    await fire.click(within(screen.getByRole('navigation', { name: 'Getting Started stages' })).getByRole('button', { name: /^Finish/ }))
    expect(summary()[0]).toBe('Accounts & Savings: Completed')
    // Opening and moving around Review wrote no progress; "finished" stays.
    expect(await storedGuideRecord()).toEqual(record)
    expect(await storedProgress()).toMatchObject({ finished: true })
    await fire.click(button('Close'))
    expect(shown()).toBe('home')
    expect(card()).toBeNull()
    expect(data.space.id).toBe((await storedData())!.space.id)
  })

  it('from Help & Guide › Getting Started opens the summary, and Close goes back to Help & Guide; nothing starts again', async () => {
    await savedSpace(robin(), progress({ finished: true, skipped: ['accounts'] }))
    await openTab()
    await openHelp()
    expect(screen.queryByRole('button', { name: 'Open Getting Started' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Show Getting Started on Home' })).toBeNull()
    expect(text(screen.getByRole('region', { name: 'Getting Started' }))).toContain('You finished Getting Started.')
    await fire.click(button('Review Setup'))
    expect(title()).toBe('Review Setup')
    await fire.click(button('Close Getting Started'))
    expect(shown()).toBe('help')
    expect(await storedProgress()).toMatchObject({ finished: true })
  })

  it('a "none" answered in Review keeps the guide finished, and Close with a typed form asks first', async () => {
    await savedSpace(robin(), progress({ finished: true }))
    await openTab()
    await reviewFromHome()
    await fire.click(button('Income: Not started. Open this stage'))
    await fire.click(button('I don’t have regular income'))
    expect(await storedProgress()).toMatchObject({ finished: true, none: ['income'] })
    await fire.click(within(screen.getByRole('navigation', { name: 'Getting Started stages' })).getByRole('button', { name: /^Finish/ }))
    expect(summary()[1]).toBe('Income: No regular income')
    await fire.click(button('Accounts & Savings: Not started. Open this stage'))
    await fire.click(button(/^Add (Another )?Account$/))
    await fire.change(field('Account Name'), { target: { value: 'Typed only' } })
    await fire.click(button('Close Getting Started'))
    expect(text(screen.getByRole('alertdialog'))).toContain('Leave without saving?')
    await fire.click(button('Discard and Leave'))
    expect(shown()).toBe('home')
    expect((await storedData())!.moneyAccounts).toEqual([])
    expect(card()).toBeNull()
  })
})

describe('States from saved records (GS-6B)', () => {
  it('D-GS6-10: only archived goals leave Goals Not started; an active Emergency Fund completes it', async () => {
    await savedSpace(withRecords(data => ({ ...data, goals: data.goals.map(goal => ({ ...goal, status: 'archived' as const })) })))
    await openTab()
    // Every other stage has records: the card and the guide open on Goals, which is still to do.
    expect(text(card())).toContain('Step 5 of 6 · Goals')
    await fire.click(within(card()!).getByRole('button', { name: /setup$/ }))
    expect(title()).toBe('Goals')
    expect(within(screen.getByRole('navigation', { name: 'Getting Started stages' })).getByRole('button', { name: /^Goals,/ }).getAttribute('aria-label'))
      .toBe('Goals, step 5 of 6: Not started, current')
    expect(text(screen.getByRole('main'))).toContain('No goals yet.')
  })

  it('D-GS6-10: an active Emergency Fund alone completes Goals', async () => {
    await savedSpace(withRecords(data => ({ ...data, goals: data.goals.map(goal => (goal.kind === 'emergency' ? goal : { ...goal, status: 'archived' as const })) })))
    await openTab()
    await toFinishFromCard()
    expect(summary()[4]).toBe('Goals: Completed')
  })

  it('D-GS6-23: an existing space with records shows its stages complete, but is not finished until Done', async () => {
    await savedSpace(withRecords())
    await openTab()
    expect(text(card())).toContain('Step 6 of 6 · Finish')
    await toFinishFromCard()
    expect(summary().every(line => line.endsWith(': Completed'))).toBe(true)
    expect(await storedGuideRecord()).toMatchObject({ progress: { finished: false } })
  })

  it('D-GS6-21/22: records removed after Finish change the states, keep the answers, and never undo Finish', async () => {
    const data = await savedSpace(withRecords(), progress({ finished: true, none: ['debts'], skipped: ['accounts'] }))
    // Elsewhere (another tab), the accounts, the income and the debts are removed.
    const other = browserSpaceStore(memoryStorage())
    const loaded = await other.load()
    if (loaded.status !== 'loaded') throw new Error('not loaded')
    const saved = await other.save(without(loaded.space.data, { accounts: true, income: true, debts: true }), loaded.space.revision)
    expect(saved.status).toBe('saved')
    await openTab()
    expect(card()).toBeNull()
    await reviewFromHome()
    expect(summary()).toEqual(['Accounts & Savings: Skipped', 'Income: Not started', 'Debts: No debts', 'Bills & Subscriptions: Completed', 'Goals: Not started'])
    expect(await storedProgress()).toMatchObject({ finished: true })
    expect((await storedData())!.space.id).toBe(data.space.id)
  })
})

describe('Restore, Demo (GS-6B)', () => {
  async function openSettings() {
    await fire.click(tab('Money'))
    await fire.click(button('Settings'))
  }

  it('D-GS6-18: a backup with "finished: true" removes the card and offers Review Setup; one with "finished: false" brings the card back', async () => {
    await savedSpace()
    await openTab()
    await openSettings()
    await upload(exportBackup(robin('Imported'), progress({ finished: true })))
    await fire.click(button('Replace'))
    await fire.click(tab('Home'))
    expect(card()).toBeNull()
    expect(await homeOptions()).toContain('Review Setup')
    await openSettings()
    await upload(exportBackup(robin('Imported'), progress({ finished: false, skipped: ['accounts'] })))
    await fire.click(button('Replace'))
    await fire.click(tab('Home'))
    expect(card()).not.toBeNull()
    expect(await homeOptions()).not.toContain('Review Setup')
  })

  it('D-GS6-18: an older backup keeps this space’s "finished" and never makes one up', async () => {
    await savedSpace(robin(), progress({ finished: true }))
    await openTab()
    await openSettings()
    await upload(exportFinanceData(robin('Older file')))
    await fire.click(button('Replace'))
    await fire.click(tab('Home'))
    expect(card()).toBeNull()
    expect(await storedProgress()).toMatchObject({ finished: true })
    expect(await homeOptions()).toContain('Review Setup')
  })

  it('D-GS6-17: Finish and Review in the demo stay in memory; Exit Demo leaves the own guide as it was', async () => {
    await savedSpace()
    const storage = memoryStorage()
    await openTab(storage)
    const before = await storedGuideRecord()
    await fire.click(button('Settings'))
    await fire.click(button('Explore the Demo'))
    await openHelp()
    await fire.click(button('Show Getting Started on Home'))
    await fire.click(button('Open Getting Started'))
    expect(title()).toBe('Finish')
    await fire.click(button('Done'))
    expect(shown()).toBe('home')
    expect(await homeOptions()).toContain('Review Setup')
    await reviewFromHome()
    expect(title()).toBe('Review Setup')
    // Something typed in a demo stage: Exit Demo asks, and Copy What I Typed has the text only.
    await fire.click(button(/^Accounts & Savings: Completed/))
    await fire.click(button(/^Add (Another )?Account$/))
    await fire.change(field('Account Name'), { target: { value: 'Demo pot' } })
    await fire.click(within(screen.getByRole('note')).getByRole('button', { name: 'Exit Demo' }))
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: async () => { throw new Error('not allowed') } }, configurable: true })
    await fire.click(button('Copy What I Typed'))
    const copied = (screen.getByLabelText('What you typed. Select it and copy it.') as HTMLTextAreaElement).value
    expect(copied).toContain('Demo pot')
    expect(copied).not.toMatch(/finished|Getting Started/i)
    await fire.click(button('Discard and Exit Demo'))
    expect(card()).not.toBeNull()
    expect(await storedGuideRecord()).toEqual(before)
    expect(storedKeys(storage).some(key => key.includes('getting-started'))).toBe(false)
  })
})

async function toFinishFromCard() {
  await fire.click(within(card()!).getByRole('button', { name: /setup$/ }))
  while (title() !== 'Finish') {
    const forward = screen.queryByRole('button', { name: /^Continue/ }) ?? button('Skip for now')
    await fire.click(forward)
  }
}

describe('The empty-space notice checks records, not complete stages (GS-6B.1, D4)', () => {
  const EMPTY = 'Nothing is added yet.'
  const notice = () => screen.queryByText(content => content.startsWith(EMPTY))
  /** Robin's space with one of Alex's goals (by kind), as Robin's, with the status given. */
  function withGoal(kind: 'goal' | 'emergency', status: 'active' | 'archived'): FinanceData {
    const data = robin()
    const goal = createAlexDemo().goals.find(item => item.kind === kind)!
    return valid({ ...data, goals: [{ ...goal, owner: data.space.members[0].id, status }] })
  }
  const toSummary = () => fire.click(within(screen.getByRole('navigation', { name: 'Getting Started stages' })).getByRole('button', { name: /^Finish/ }))

  it('1 and 7: an empty space shows it; something typed but not saved does not change it', async () => {
    await savedSpace()
    await openTab()
    await toFinish()
    expect(notice()).not.toBeNull()
    await fire.click(button(/^Accounts & Savings: /))
    await fire.click(button(/^Add (Another )?Account$/))
    await fire.change(field('Account Name'), { target: { value: 'Typed only' } })
    await toSummary()
    await fire.click(button('Discard and Leave'))
    expect(title()).toBe('Finish')
    expect(notice()).not.toBeNull()
    expect((await storedData())!.moneyAccounts).toEqual([])
  })

  it('2: only an archived goal: Goals is Not started, and the space is not called empty', async () => {
    await savedSpace(withGoal('goal', 'archived'), progress({ finished: true }))
    await openTab()
    await reviewFromHome()
    expect(summary()[4]).toBe('Goals: Not started')
    expect(notice()).toBeNull()
  })

  it('3: an active goal: Goals is Completed, and no notice', async () => {
    await savedSpace(withGoal('goal', 'active'), progress({ finished: true }))
    await openTab()
    await reviewFromHome()
    expect(summary()[4]).toBe('Goals: Completed')
    expect(notice()).toBeNull()
  })

  it('4: an active Emergency Fund: Goals is Completed, and no notice', async () => {
    await savedSpace(withGoal('emergency', 'active'), progress({ finished: true }))
    await openTab()
    await reviewFromHome()
    expect(summary()[4]).toBe('Goals: Completed')
    expect(notice()).toBeNull()
  })

  it('5 and 6: a record saved in another stage removes it; once that record is removed, it comes back', async () => {
    await savedSpace(robin(), progress({ finished: true }))
    const { storage } = await openTab()
    await reviewFromHome()
    expect(notice()).not.toBeNull()
    await fire.click(button('Accounts & Savings: Not started. Open this stage'))
    await fire.click(button(/^Add (Another )?Account$/))
    await fire.change(field('Account Name'), { target: { value: 'Main account' } })
    await fire.click(button('Save Account'))
    await toSummary()
    expect(summary()[0]).toBe('Accounts & Savings: Completed')
    expect(notice()).toBeNull()
    // Removed elsewhere (another tab): the notice follows the saved records only.
    cleanup()
    const other = browserSpaceStore(memoryStorage())
    const loaded = await other.load()
    if (loaded.status !== 'loaded') throw new Error('not loaded')
    expect((await other.save(without(loaded.space.data, { accounts: true }), loaded.space.revision)).status).toBe('saved')
    window.history.replaceState(null, '')
    await openTab(storage)
    await reviewFromHome()
    expect(summary()[0]).toBe('Accounts & Savings: Not started')
    expect(notice()).not.toBeNull()
    expect(await storedProgress()).toMatchObject({ finished: true })
  })

  it('8: the demo uses its own records only, and the own empty space still shows it after Exit Demo', async () => {
    await savedSpace()
    await openTab()
    await toFinish()
    expect(notice()).not.toBeNull()
    await fire.click(button('Close Getting Started'))
    await fire.click(button('Settings'))
    await fire.click(button('Explore the Demo'))
    await openHelp()
    await fire.click(button('Show Getting Started on Home'))
    await fire.click(button('Open Getting Started'))
    expect(title()).toBe('Finish')
    expect(notice()).toBeNull()
    await fire.click(within(screen.getByRole('note')).getByRole('button', { name: 'Exit Demo' }))
    await toFinish()
    expect(notice()).not.toBeNull()
  })
})
