// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { browserSpaceStore } from './app/useSpace'
import type { SpaceStore } from './data/spaceStore'
import { createSpaceData } from './domain/finance/space'
import type { FinanceData } from './domain/finance/types'
import { memoryStorage, storedKeys } from './test/memoryStorage'
import { fire, freshDatabaseForEachTest, heldStore, refuseWrites, settle, storedData } from './test/space'

freshDatabaseForEachTest()

// GS-5: the Goals stage of Getting Started hosts the forms that already exist (New Goal and the Emergency
// Fund draft): the same checks, confirmation and save, the user stays on the stage after a save, a goal
// with no date keeps no date, and the Emergency Fund (one record, kind 'emergency') completes the stage alone.
afterEach(() => { cleanup(); vi.restoreAllMocks() })
beforeEach(() => { window.history.replaceState(null, '') })

const TODAY = '2026-10-25'
const PROGRESS_KEY = 'goal-planning-app.getting-started'
const button = (name: string | RegExp) => screen.getByRole('button', { name })
const text = (element: Element | null) => (element?.textContent ?? '').replace(/\u00a0|\u202f/g, ' ')
const field = (label: string | RegExp) => screen.getByLabelText(label) as HTMLInputElement
const tab = (name: string) => within(screen.getByRole('navigation', { name: 'Main navigation' })).getByRole('button', { name })
const card = () => screen.queryByRole('region', { name: 'Getting Started' })
const stages = () => within(screen.getByRole('navigation', { name: 'Getting Started stages' }))
const stage = (name: string) => stages().getByRole('button', { name: new RegExp(`^${name}, step`) }) as HTMLButtonElement
const stageStates = () => stages().getAllByRole('button').map(item => (item.getAttribute('aria-label') ?? '').replace(/, step \d of 6: /, ': '))
const title = () => screen.getByRole('heading', { level: 1 }).textContent
const question = () => screen.queryByRole('alertdialog')
const shownScreen = () => document.querySelector('[data-screen]')?.getAttribute('data-screen')
const savedProgress = (storage: Storage) => JSON.parse(storage.getItem(PROGRESS_KEY) ?? 'null')?.progress
const main = () => text(screen.getByRole('main'))
const listItems = (name: string) => within(screen.getByRole('list', { name })).getAllByRole('listitem').map(item => text(item))
const moves = () => act(async () => { for (let i = 0; i < 10; i++) await new Promise(resolve => setTimeout(resolve, 5)) })
const goalForm = () => screen.queryByRole('group', { name: /^(Add a Goal|Check Your Goal)$/ })

function space(duo = false): FinanceData {
  const made = createSpaceData({ mode: duo ? 'duo' : 'individual', names: duo ? ['Robin', 'Sam'] : ['Robin'], currency: 'PLN', theme: 'light' })
  if (made.status !== 'created') throw new Error('invalid setup')
  return made.data
}

async function ownSpace(options: { duo?: boolean; storage?: Storage; store?: SpaceStore } = {}) {
  const storage = options.storage ?? memoryStorage()
  await browserSpaceStore(memoryStorage()).create(space(options.duo))
  render(<App getToday={() => TODAY} storage={storage} createStore={options.store ? () => options.store! : undefined} />)
  await settle()
  return storage
}

/** Opens Getting Started from Home and goes to a stage with Skip for now. */
async function openStage(name: string) {
  await fire.click(within(card()!).getByRole('button', { name: /setup$/ }))
  while (title() !== name) await fire.click(button('Skip for now'))
}

/** Opens Getting Started in the demo (Help & Guide), on the Goals stage. */
async function demoGoals(storage = memoryStorage()) {
  render(<App getToday={() => TODAY} storage={storage} />)
  await settle()
  await fire.click(button('Explore the App'))
  await fire.click(button('Settings'))
  await fire.click(button('Open Help & Guide'))
  await fire.click(button('Open Getting Started'))
  await fire.click(stage('Goals'))
  return storage
}

/** Fills the New Goal form of the stage (it opens it first). No date: Flexible. */
async function typeGoal(goal: { name: string; target?: string; date?: string }) {
  if (!goalForm()) await fire.click(button(/^Add (a|Another) Goal$/))
  await fire.change(field('What are you saving for?'), { target: { value: goal.name } })
  if (goal.target !== undefined) await fire.change(field(/^Target Amount/), { target: { value: goal.target } })
  if (goal.date !== undefined) {
    await fire.change(field('Deadline'), { target: { value: 'dated' } })
    await fire.change(field('Target Date'), { target: { value: goal.date } })
  }
}

/** Fills the form, checks it (Review Goal) and creates it (Create Goal). */
async function addGoal(goal: { name: string; target?: string; date?: string }) {
  await typeGoal(goal)
  await fire.click(button('Review Goal'))
  await fire.click(button('Create Goal'))
}

describe('Goals stage', () => {
  it('creates a goal with a date and one with no date from the stage, stays there, and Goals shows the same records', async () => {
    await ownSpace()
    await openStage('Goals')
    expect(main()).toContain('What are you saving for?')
    expect(main()).toContain('No goals yet.')
    expect(main()).toContain('No Emergency Fund yet.')
    expect(stageStates()[4]).toBe('Goals: Not started, current')
    await fire.click(button('Add a Goal'))
    expect(shownScreen()).toBe('guide')
    expect(screen.getByRole('group', { name: 'Add a Goal' })).toBeTruthy()
    expect(document.activeElement?.id).toBe('new-goal-name')
    // Opening the form completes nothing.
    expect(stageStates()[4]).toBe('Goals: Not started, current')
    await typeGoal({ name: 'Holiday', target: '3000', date: '2027-06-30' })
    await fire.click(button('Review Goal'))
    // The same confirmation as New Goal, as a step of the stage.
    expect(screen.getByRole('group', { name: 'Check Your Goal' })).toBeTruthy()
    expect(document.activeElement?.textContent).toBe('Check Your Goal')
    expect(text(goalForm())).toContain('TypeWith Date')
    expect(stageStates()[4]).toBe('Goals: Not started, current')
    await fire.click(button('Create Goal'))
    expect(shownScreen()).toBe('guide')
    expect(title()).toBe('Goals')
    expect(goalForm()).toBeNull()
    expect(main()).toContain('Goal added. Saved on this device.')
    expect(document.activeElement?.id).toBe('gs-add-goal')
    expect(document.activeElement?.textContent).toContain('Add Another Goal')
    expect(stageStates()[4]).toBe('Goals: Completed, current')
    expect(button(/^Continue/)).toBeTruthy()
    // Another one, Flexible: no date is asked for, and none is made up.
    await typeGoal({ name: 'Rainy day box' })
    await fire.click(button('Review Goal'))
    expect(text(goalForm())).toContain('DeadlineNo deadline (Flexible)')
    await fire.click(button('Create Goal'))
    expect(listItems('Your goals')).toEqual([
      'HolidayWith Date · 30 Jun 2027Target 3000,00 zł · 3000,00 zł to go0,00 zł saved',
      'Rainy day boxFlexible · No deadlineNo target0,00 zł saved',
    ])
    const data = (await storedData())!
    expect(data.goals.map(goal => [goal.name, goal.kind, goal.target, goal.deadline, goal.owner, goal.openingBalance, goal.status]))
      .toEqual([['Holiday', 'goal', 300000, '2027-06-30', data.space.members[0].id, 0, 'active'], ['Rainy day box', 'goal', null, null, data.space.members[0].id, 0, 'active']])
    // A new goal starts at 0: no movement, no account, no balance.
    expect([data.goalMovements, data.moneyAccounts, data.balances]).toEqual([[], [], []])
    await fire.click(tab('Goals'))
    expect(main()).toContain('Holiday')
    expect(main()).toContain('With Date · 30 Jun 2027')
    expect(main()).toContain('Rainy day boxFlexible · No deadline')
  })

  it('keeps New Goal’s checks; Cancel, on the form or on the confirmation, saves nothing', async () => {
    await ownSpace()
    await openStage('Goals')
    await fire.click(button('Add a Goal'))
    await fire.click(button('Review Goal'))
    expect(main()).toContain('Enter a name for your goal.')
    expect(field('What are you saving for?').getAttribute('aria-invalid')).toBe('true')
    // A date needs a target, and a date after today: the same rules as New Goal.
    await typeGoal({ name: 'Car', date: '2026-10-01' })
    await fire.click(button('Review Goal'))
    expect(main()).toContain('A goal with a date needs a target amount. Enter one, or choose Flexible.')
    expect(main()).toContain('Choose a date after today.')
    expect(screen.getByRole('group', { name: 'Add a Goal' })).toBeTruthy()
    expect(field('What are you saving for?').value).toBe('Car')
    await fire.click(button('Cancel'))
    expect(goalForm()).toBeNull()
    expect(document.activeElement?.id).toBe('gs-add-goal')
    // Opened again: an empty form, nothing kept from before.
    await fire.click(button('Add a Goal'))
    expect(field('What are you saving for?').value).toBe('')
    await typeGoal({ name: 'Car', target: '9000' })
    await fire.click(button('Review Goal'))
    await fire.click(button('Edit'))
    expect(document.activeElement?.id).toBe('new-goal-name')
    expect(field('What are you saving for?').value).toBe('Car')
    await fire.click(button('Review Goal'))
    await fire.click(button('Cancel'))
    expect(goalForm()).toBeNull()
    expect(main()).toContain('No goals yet.')
    expect(stageStates()[4]).toBe('Goals: Not started, current')
    expect((await storedData())!.goals).toEqual([])
  })

  it('two quick taps on Create Goal create one goal, on the stage and in Goals', async () => {
    await ownSpace()
    await openStage('Goals')
    await typeGoal({ name: 'Holiday' })
    await fire.click(button('Review Goal'))
    const create = button('Create Goal')
    fireEvent.click(create)
    fireEvent.click(create)
    await settle()
    expect((await storedData())!.goals.map(goal => goal.name)).toEqual(['Holiday'])
    expect(listItems('Your goals')).toHaveLength(1)
    // The New Goal screen of Goals has the same guard.
    await fire.click(button('Close Getting Started'))
    await moves()
    await fire.click(tab('Goals'))
    await fire.click(button('Add Goal'))
    await fire.change(field('What are you saving for?'), { target: { value: 'Bike' } })
    await fire.click(button('Review Goal'))
    const again = button('Create Goal')
    fireEvent.click(again)
    fireEvent.click(again)
    await settle()
    expect((await storedData())!.goals.map(goal => goal.name)).toEqual(['Holiday', 'Bike'])
  })

  it('a save the browser refuses keeps the confirmation as typed and says so', async () => {
    await ownSpace()
    await openStage('Goals')
    await typeGoal({ name: 'Holiday', target: '3000' })
    await fire.click(button('Review Goal'))
    refuseWrites()
    await fire.click(button('Create Goal'))
    expect(screen.getByRole('group', { name: 'Check Your Goal' })).toBeTruthy()
    expect(main()).toContain('This browser did not save it.')
    expect(stageStates()[4]).toBe('Goals: Not started, current')
    vi.restoreAllMocks()
    // What was typed is still there.
    await fire.click(button('Edit'))
    expect(field('What are you saving for?').value).toBe('Holiday')
    expect(field(/^Target Amount/).value).toBe('3000')
    expect((await storedData())!.goals).toEqual([])
  })

  it('in a Duo, a new goal is shared, as New Goal does in Goals', async () => {
    await ownSpace({ duo: true })
    await openStage('Goals')
    await addGoal({ name: 'New sofa', target: '2500' })
    expect((await storedData())!.goals.map(goal => goal.owner)).toEqual(['shared'])
  })
})

describe('Emergency Fund in the Goals stage', () => {
  it('starts it with the Emergency Fund draft; Cancel creates nothing; once saved it completes Goals on its own', async () => {
    await ownSpace()
    await openStage('Goals')
    await fire.click(button('Start an Emergency Fund'))
    const draft = () => screen.queryByRole('group', { name: 'Start an Emergency Fund' })
    expect(draft()).toBeTruthy()
    expect(document.activeElement?.textContent).toBe('Start an Emergency Fund')
    // The draft's own checks: with no amount for the essential costs, no target can be worked out.
    expect(text(draft())).toContain('Estimate incomplete.')
    expect((button('Create Emergency Fund') as HTMLButtonElement).disabled).toBe(true)
    await fire.click(button('Cancel'))
    expect(draft()).toBeNull()
    expect(document.activeElement?.id).toBe('gs-start-emergency')
    // Not set up: not complete, nothing made up.
    expect(stageStates()[4]).toBe('Goals: Not started, current')
    expect((await storedData())!.goals).toEqual([])
    await fire.click(button('Start an Emergency Fund'))
    await fire.change(field('Groceries per month (PLN)'), { target: { value: '800' } })
    expect(text(draft())).toContain('Target2400,00 zł')
    await fire.click(button('Create Emergency Fund'))
    expect(draft()).toBeNull()
    expect(shownScreen()).toBe('guide')
    expect(main()).toContain('Emergency Fund added. Saved on this device.')
    expect(document.activeElement?.id).toBe('gs-add-goal')
    expect(stageStates()[4]).toBe('Goals: Completed, current')
    expect(listItems('Your goals')).toEqual(['Emergency FundFor unexpected costs · No deadlineTarget 2400,00 zł · 2400,00 zł to go0,00 zł saved'])
    expect(screen.queryByRole('button', { name: 'Start an Emergency Fund' })).toBeNull()
    expect(main()).not.toContain('No Emergency Fund yet.')
    // One record, the Emergency Fund: no ordinary goal next to it, no movement, no balance.
    const data = (await storedData())!
    expect(data.goals.map(goal => [goal.kind, goal.name, goal.target, goal.deadline, goal.emergencyBasis?.months])).toEqual([['emergency', 'Emergency Fund', 240000, null, 3]])
    expect([data.goalMovements, data.moneyAccounts, data.balances]).toEqual([[], [], []])
    // Goals shows it once, on its own card.
    await fire.click(tab('Goals'))
    expect(screen.getAllByText('Emergency Fund', { selector: 'b' })).toHaveLength(1)
    expect(main()).toContain('No goals yet.')
  })

  it('an Emergency Fund made in Goals counts for the stage, listed once, and a goal can still be added', async () => {
    await ownSpace()
    await fire.click(tab('Goals'))
    await fire.click(button('Start an Emergency Fund'))
    await fire.click(button('Create Without a Target'))
    await fire.click(tab('Home'))
    await fire.click(within(card()!).getByRole('button', { name: /setup$/ }))
    await fire.click(button('Skip for now'))
    await fire.click(button('Skip for now'))
    await fire.click(button('Skip for now'))
    await fire.click(button('Skip for now'))
    expect(title()).toBe('Goals')
    expect(stageStates()[4]).toBe('Goals: Completed, current')
    expect(listItems('Your goals')).toEqual(['Emergency FundFor unexpected costs · No deadlineNo target0,00 zł saved'])
    expect(screen.queryByRole('button', { name: 'Start an Emergency Fund' })).toBeNull()
    await addGoal({ name: 'Holiday' })
    expect(listItems('Your goals').map(item => item.split('For')[0].split('Flexible')[0])).toEqual(['Emergency Fund', 'Holiday'])
    expect((await storedData())!.goals.map(goal => goal.kind)).toEqual(['emergency', 'goal'])
  })

  it('a set-aside amount is the draft’s own rule: part of Savings with no purpose, never a new balance', async () => {
    await ownSpace()
    await openStage('Accounts & Savings')
    await fire.click(button(/^Add (Another )?Account$/))
    await fire.change(field('Account Name'), { target: { value: 'Savings box' } })
    await fire.change(field('Kind'), { target: { value: 'savings' } })
    await fire.change(field(/^Balance \(PLN/), { target: { value: '1000' } })
    await fire.click(button('Save Account'))
    const before = (await storedData())!
    await fire.click(stage('Accounts'))
    while (title() !== 'Goals') await fire.click(button(/^(Skip for now|Continue)/))
    await fire.click(button('Start an Emergency Fund'))
    await fire.change(field(/^Part of your Savings to count in the fund/), { target: { value: '1500' } })
    await fire.click(button('Create Without a Target'))
    // More than the savings with no purpose: refused, as in the Emergency Fund screen, and the draft stays.
    expect(main()).toContain('You can count at most 1000,00 zł')
    expect(screen.getByRole('group', { name: 'Start an Emergency Fund' })).toBeTruthy()
    await fire.change(field(/^Part of your Savings to count in the fund/), { target: { value: '400' } })
    await fire.click(button('Create Without a Target'))
    const after = (await storedData())!
    // The accounts and their balances are as they were: the fund only gives 400 of them a purpose.
    expect([after.moneyAccounts, after.balances]).toEqual([before.moneyAccounts, before.balances])
    expect(after.goalMovements.map(movement => [movement.goalId, movement.amount, movement.effect])).toEqual([[after.goals[0].id, 40000, 'assigned']])
    expect(listItems('Your goals')).toEqual(['Emergency FundFor unexpected costs · No deadlineNo target400,00 zł saved'])
  })
})

describe('Moving between stages with Goals', () => {
  it('Back opens Bills, Skip for now adds nothing, a goal added later completes it, Continue opens Finish', async () => {
    const storage = await ownSpace()
    await openStage('Goals')
    await fire.click(button('Back'))
    expect(title()).toBe('Bills & Subscriptions')
    await fire.click(button('Skip for now'))
    expect(title()).toBe('Goals')
    await fire.click(button('Skip for now'))
    expect(title()).toBe('Finish')
    expect(savedProgress(storage)).toMatchObject({ skipped: ['accounts', 'income', 'debts', 'bills', 'goals'], none: [] })
    expect(listItems('Your setup')[4]).toBe('GoalsSkipped')
    expect((await storedData())!.goals).toEqual([])
    // Skipped, then done: the records decide, with nothing else saved.
    await fire.click(stage('Goals'))
    expect(stageStates()[4]).toBe('Goals: Skipped, current')
    await addGoal({ name: 'Holiday' })
    expect(stageStates()[4]).toBe('Goals: Completed, current')
    await fire.click(button(/^Continue/))
    expect(title()).toBe('Finish')
    expect(listItems('Your setup')[4]).toBe('GoalsCompleted')
    // Kept after Close and a new start.
    await fire.click(button('Close Getting Started'))
    await moves()
    cleanup()
    render(<App getToday={() => TODAY} storage={storage} />)
    await settle()
    await fire.click(within(card()!).getByRole('button', { name: /setup$/ }))
    expect(stageStates()[4]).toBe('Goals: Completed')
    await fire.click(stage('Goals'))
    expect(listItems('Your goals')[0]).toContain('Holiday')
  })

  it('with something typed, Back, Continue, Skip for now, the stage list, a tab and Close ask first; Keep Editing keeps it; Discard and Leave moves once', async () => {
    await ownSpace()
    await openStage('Goals')
    // An untouched form asks nothing.
    await fire.click(button('Add a Goal'))
    await fire.click(button('Back'))
    expect(question()).toBeNull()
    expect(title()).toBe('Bills & Subscriptions')
    await fire.click(button('Skip for now'))
    await addGoal({ name: 'Holiday' })
    await typeGoal({ name: 'Bike', target: '1200' })
    for (const move of [() => button('Back'), () => button(/^Continue/), () => stage('Accounts'), () => tab('Home'), () => button('Close Getting Started')]) {
      await fire.click(move())
      expect(text(question())).toContain('New Goal')
      await fire.click(within(question()!).getByRole('button', { name: 'Keep Editing' }))
      expect(question()).toBeNull()
      expect(title()).toBe('Goals')
      expect(field('What are you saving for?').value).toBe('Bike')
      expect(field(/^Target Amount/).value).toBe('1200')
    }
    // On the confirmation too.
    await fire.click(button('Review Goal'))
    await fire.click(button(/^Continue/))
    expect(text(question())).toContain('New Goal')
    await fire.click(within(question()!).getByRole('button', { name: 'Discard and Leave' }))
    await moves()
    expect(title()).toBe('Finish')
    await fire.click(button('Back'))
    expect(title()).toBe('Goals')
    expect(goalForm()).toBeNull()
    expect((await storedData())!.goals.map(goal => goal.name)).toEqual(['Holiday'])
  })

  it('Skip for now asks first with something typed, and the browser Back button does too (one step for the whole guide)', async () => {
    await ownSpace()
    await openStage('Goals')
    await typeGoal({ name: 'Holiday' })
    await fire.click(button('Skip for now'))
    expect(text(question())).toContain('New Goal')
    await fire.click(within(question()!).getByRole('button', { name: 'Keep Editing' }))
    act(() => window.history.back())
    await moves()
    expect(text(question())).toContain('New Goal')
    await fire.click(within(question()!).getByRole('button', { name: 'Keep Editing' }))
    await moves()
    expect(shownScreen()).toBe('guide')
    expect(field('What are you saving for?').value).toBe('Holiday')
    // The Emergency Fund draft is protected the same way.
    await fire.click(button('Cancel'))
    await fire.click(button('Start an Emergency Fund'))
    await fire.change(field('Groceries per month (PLN)'), { target: { value: '800' } })
    await fire.click(button('Back'))
    expect(text(question())).toContain('Emergency Fund')
    await fire.click(within(question()!).getByRole('button', { name: 'Keep Editing' }))
    expect(field('Groceries per month (PLN)').value).toBe('800')
    act(() => window.history.back())
    await moves()
    await fire.click(within(question()!).getByRole('button', { name: 'Discard and Leave' }))
    await moves()
    expect(shownScreen()).not.toBe('guide')
    expect((await storedData())!.goals).toEqual([])
  })

  it('while Create Goal is being saved, Skip for now waits for it and never drops what is being saved', async () => {
    const held = heldStore()
    await ownSpace({ store: held.store })
    await openStage('Goals')
    await typeGoal({ name: 'Holiday' })
    await fire.click(button('Review Goal'))
    held.hold()
    await act(async () => { button('Create Goal').click() })
    await act(async () => { button('Skip for now').click() })
    expect(question()).toBeNull()
    expect(title()).toBe('Goals')
    await held.release()
    await settle()
    await moves()
    expect(question()).toBeNull()
    expect(title()).toBe('Finish')
    expect((await storedData())!.goals.map(goal => goal.name)).toEqual(['Holiday'])
  })
})

describe('Hide amounts on Goals', () => {
  it('hides what is saved, the targets and what is left, on screen and for screen readers; names, dates and No deadline stay', async () => {
    await ownSpace()
    await openStage('Goals')
    await addGoal({ name: 'Holiday', target: '1234', date: '2027-06-30' })
    await fire.click(button('Start an Emergency Fund'))
    await fire.change(field('Groceries per month (PLN)'), { target: { value: '800' } })
    await fire.click(button('Create Emergency Fund'))
    await addGoal({ name: 'Rainy day box' })
    await fire.click(button('Hide amounts'))
    expect(listItems('Your goals')).toEqual([
      'Emergency FundFor unexpected costs · No deadlineTarget ••••amount hidden · ••••amount hidden to go••••amount hidden saved',
      'HolidayWith Date · 30 Jun 2027Target ••••amount hidden · ••••amount hidden to go••••amount hidden saved',
      'Rainy day boxFlexible · No deadlineNo target••••amount hidden saved',
    ])
    expect(main()).not.toMatch(/1234|1 234|2400|2 400|zł/)
    const labels = [...screen.getByRole('main').querySelectorAll('[aria-label], [title], [alt]')]
      .map(element => `${element.getAttribute('aria-label') ?? ''} ${element.getAttribute('title') ?? ''} ${element.getAttribute('alt') ?? ''}`)
    expect(labels.join(' ')).not.toMatch(/\d{3}|zł/)
    // A save while hidden says nothing about amounts; what is typed stays visible, so it can be checked.
    await typeGoal({ name: 'Bike', target: '777' })
    expect(field(/^Target Amount/).value).toBe('777')
    await fire.click(button('Review Goal'))
    await fire.click(button('Create Goal'))
    expect(main()).toContain('Goal added.')
    expect(main()).not.toMatch(/777|zł/)
    await fire.click(button('Amounts hidden. Show amounts'))
    expect(listItems('Your goals')[1]).toBe('HolidayWith Date · 30 Jun 2027Target 1234,00 zł · 1234,00 zł to go0,00 zł saved')
  })
})

describe('Outside Getting Started and in the demo', () => {
  it('Add Goal and Start an Emergency Fund in Goals still open their own screens, as before', async () => {
    await ownSpace()
    await fire.click(tab('Goals'))
    await fire.click(button('Add Goal'))
    expect(shownScreen()).toBe('new-goal')
    expect(title()).toBe('Create a Goal')
    await fire.change(field('What are you saving for?'), { target: { value: 'Holiday' } })
    await fire.click(button('Review Goal'))
    expect(title()).toBe('Check Your Goal')
    await fire.click(button('Create Goal'))
    // As before: the new goal's own screen.
    expect(shownScreen()).toBe('goal')
    expect(title()).toBe('Holiday')
    await fire.click(tab('Goals'))
    await fire.click(button('Start an Emergency Fund'))
    expect(shownScreen()).toBe('emergency')
    await fire.click(button('Create Without a Target'))
    expect(main()).toContain('Your Emergency Fund is saved.')
    expect(button('Open Emergency Fund')).toBeTruthy()
  })

  it('in the demo, the stage lists Alex’s fund and active goals once, adds one goal for two quick taps, in memory only, and keeps nothing', async () => {
    const storage = await demoGoals()
    expect(stageStates()[4]).toBe('Goals: Completed, current')
    const names = () => listItems('Your goals').map(item => item.split(/For unexpected|Flexible|With Date/)[0])
    // The archived goal is not listed, as in Goals.
    expect(names()).toEqual(['Emergency Fund', 'Trip to Japan', 'New Bike'])
    expect(screen.queryByRole('button', { name: 'Start an Emergency Fund' })).toBeNull()
    await fire.click(button('Hide amounts'))
    expect(main()).not.toMatch(/zł/)
    await fire.click(button('Amounts hidden. Show amounts'))
    // The demo keeps a change in memory at once: without the form's guard, two quick taps made two goals (seen on e653e66).
    await typeGoal({ name: 'Demo goal' })
    await fire.click(button('Review Goal'))
    const create = button('Create Goal')
    fireEvent.click(create)
    fireEvent.click(create)
    await settle()
    expect(main()).toContain('Goal added.')
    expect(names()).toEqual(['Emergency Fund', 'Trip to Japan', 'New Bike', 'Demo goal'])
    expect(storedKeys(storage).some(key => key.includes('getting-started'))).toBe(false)
    expect(await storedData()).toBeNull()
    // Exit Demo with something typed asks first, as everywhere in the demo; Keep Editing keeps it.
    await typeGoal({ name: 'Not saved yet' })
    await fire.click(within(screen.getByRole('note')).getByRole('button', { name: 'Exit Demo' }))
    const asked = screen.queryAllByRole('alert').map(alert => text(alert)).join(' ')
    expect(asked).toContain('Leaving the demo closes what you typed in it.')
    expect(text(screen.getByRole('note'))).toContain('New Goal')
    await fire.click(within(screen.getByRole('note')).getByRole('button', { name: 'Keep Editing' }))
    expect(shownScreen()).toBe('guide')
    expect(screen.getByRole('note')).toBeTruthy()
    expect(field('What are you saving for?').value).toBe('Not saved yet')
  })
})
