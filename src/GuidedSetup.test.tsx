// @vitest-environment jsdom
import { act, cleanup, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { browserSpaceStore } from './app/useSpace'
import type { SpaceStore } from './data/spaceStore'
import { createSpaceData } from './domain/finance/space'
import type { FinanceData } from './domain/finance/types'
import { memoryStorage, storedKeys } from './test/memoryStorage'
import { fire, freshDatabaseForEachTest, heldStore, refuseWrites, settle, storedData } from './test/space'

freshDatabaseForEachTest()

// GS-3: Getting Started as its own screen, opened from a compact card on Home or from Help & Guide, with
// Back, Continue, Skip for now and the stage list (D-GS9). Accounts and Income use Money's forms (GS-2).
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
/** Each stage as the screen reader names it, without "step n of 6". */
const stageStates = () => stages().getAllByRole('button').map(item => (item.getAttribute('aria-label') ?? '').replace(/, step \d of 6: /, ': '))
const title = () => screen.getByRole('heading', { level: 1 }).textContent
const question = () => screen.queryByRole('alertdialog')
const shownScreen = () => document.querySelector('[data-screen]')?.getAttribute('data-screen')
const savedProgress = (storage: Storage) => JSON.parse(storage.getItem(PROGRESS_KEY) ?? 'null')?.progress
const moves = () => act(async () => { for (let i = 0; i < 10; i++) await new Promise(resolve => setTimeout(resolve, 5)) })

function space(duo = false): FinanceData {
  const made = createSpaceData({ mode: duo ? 'duo' : 'individual', names: duo ? ['Robin', 'Sam'] : ['Robin'], currency: 'PLN', theme: 'light' })
  if (made.status !== 'created') throw new Error('invalid setup')
  return made.data
}

/** An own space already created (Individual, or a Duo), on Home. */
async function ownSpace(options: { duo?: boolean; storage?: Storage; store?: SpaceStore } = {}) {
  const storage = options.storage ?? memoryStorage()
  await browserSpaceStore(memoryStorage()).create(space(options.duo))
  render(<App getToday={() => TODAY} storage={storage} createStore={options.store ? () => options.store! : undefined} />)
  await settle()
  return storage
}

async function openGuide() {
  await fire.click(within(card()!).getByRole('button', { name: /setup$/ }))
}

async function typeAccount(name: string, balance = '') {
  await fire.click(button(/^Add (Another )?Account$/))
  await fire.change(field('Account Name'), { target: { value: name } })
  if (balance) await fire.change(field(/^Balance \(PLN/), { target: { value: balance } })
}

async function typeIncome(name: string, amount: string) {
  await fire.click(button(/^Add (Another )?Income$/))
  await fire.change(field('Name'), { target: { value: name } })
  await fire.change(field(/^Usual Net Amount/), { target: { value: amount } })
  await fire.change(field(/^Pay Day/), { target: { value: '10' } })
}

describe('Getting Started card on Home', () => {
  it('is compact, starts the guide on its own screen, and the five tabs stay as they are', async () => {
    await ownSpace()
    expect(text(card())).toContain('Step 1 of 6 · Accounts')
    // Two controls only: start, and hide. No form and no stage content on Home.
    expect(within(card()!).getAllByRole('button').map(item => item.textContent)).toEqual(['Start setup', 'Hide for now'])
    expect(card()!.querySelector('input, select')).toBeNull()
    await openGuide()
    expect(shownScreen()).toBe('guide')
    expect(title()).toBe('Accounts & Savings')
    expect(document.activeElement?.textContent).toBe('Accounts & Savings')
    expect(within(screen.getByRole('navigation', { name: 'Main navigation' })).getAllByRole('button').map(item => item.textContent))
      .toEqual(['Home', 'Bills', 'Goals', 'Money', 'History'])
  })

  it('hidden for now, the guide is still in Settings › Help & Guide, and can come back to Home', async () => {
    await ownSpace()
    await fire.click(button('Hide for now'))
    expect(card()).toBeNull()
    await fire.click(button('Settings'))
    await fire.click(button('Open Help & Guide'))
    await fire.click(button('Open Getting Started'))
    expect(shownScreen()).toBe('guide')
    expect(title()).toBe('Accounts & Savings')
    await fire.click(button('Close Getting Started'))
    await moves()
    expect(shownScreen()).toBe('help')
    await fire.click(button('Show Getting Started on Home'))
    await fire.click(tab('Home'))
    expect(card()).not.toBeNull()
  })
})

describe('Moving between stages (D-GS9)', () => {
  it('Skip for now leaves a stage for later; an earlier stage opens from the list; visiting completes nothing', async () => {
    const storage = await ownSpace()
    await openGuide()
    await fire.click(button('Skip for now'))
    expect(title()).toBe('Income')
    expect(document.activeElement?.textContent).toBe('Income')
    await fire.click(button('Skip for now'))
    expect(title()).toBe('Debts')
    expect(stageStates()).toEqual(['Accounts: Skipped', 'Income: Skipped', 'Debts: Not started, current', 'Bills: Not started, not reached yet',
      'Goals: Not started, not reached yet', 'Finish: Not finished, not reached yet'])
    expect(stage('Debts').getAttribute('aria-current')).toBe('step')
    // Later stages never reached open in order (Continue or Skip for now), not from the list.
    expect(stage('Bills').disabled).toBe(true)
    await fire.click(stage('Accounts'))
    expect(title()).toBe('Accounts & Savings')
    // Visiting a skipped stage does not complete it.
    expect(stageStates()[0]).toBe('Accounts: Skipped, current')
    expect(text(screen.getByRole('region', { name: 'Accounts & Savings' }))).toContain('Skipped')
    // Stages reached stay open from the list, even after going back.
    expect(stage('Debts').disabled).toBe(false)
    expect(savedProgress(storage)).toEqual({ version: 2, hidden: false, skipped: ['accounts', 'income'], none: [], finished: false, last: 'accounts' })
    await typeAccount('Wallet', '120')
    await fire.click(button('Save Account'))
    expect(stageStates()[0]).toBe('Accounts: Completed, current')
    // Complete: Continue moves on; Back moves one stage back.
    await fire.click(button(/^Continue/))
    expect(title()).toBe('Income')
    expect(stageStates()[1]).toBe('Income: Skipped, current')
    await fire.click(button('Back'))
    expect(title()).toBe('Accounts & Savings')
    expect(screen.queryByRole('button', { name: 'Back' })).toBeNull()
    expect((await storedData())!.moneyAccounts.map(account => account.name)).toEqual(['Wallet'])
  })

  it('a completed stage can be opened again to add another record', async () => {
    await ownSpace()
    await openGuide()
    await typeAccount('Wallet')
    await fire.click(button('Save Account'))
    await fire.click(button(/^Continue/))
    await fire.click(stage('Accounts'))
    expect(stageStates()[0]).toBe('Accounts: Completed, current')
    await typeAccount('Savings', '500')
    await fire.click(button('Save Account'))
    expect(within(screen.getByRole('list', { name: 'Your accounts' })).getAllByRole('listitem').map(item => text(item))).toEqual(['WalletSavingsNot entered', 'SavingsSavings500,00 zł'])
  })

  it('Close keeps the progress; the card continues where the user left off, also after a reload', async () => {
    const storage = await ownSpace()
    await openGuide()
    await fire.click(button('Skip for now'))
    await fire.click(button('Skip for now'))
    await fire.click(button('Close Getting Started'))
    await moves()
    expect(shownScreen()).toBe('home')
    expect(text(card())).toContain('Step 3 of 6 · Debts')
    expect(within(card()!).getByRole('button', { name: 'Continue setup' })).toBeTruthy()
    cleanup()
    render(<App getToday={() => TODAY} storage={storage} />)
    await settle()
    expect(text(card())).toContain('Step 3 of 6 · Debts')
    await openGuide()
    expect(title()).toBe('Debts')
    expect(stageStates().slice(0, 2)).toEqual(['Accounts: Skipped', 'Income: Skipped'])
  })

  it('Debts and Bills open their forms on the stage (GS-4); Goals opens New Goal, and Back there comes back to the stage', async () => {
    await ownSpace()
    await openGuide()
    await fire.click(button('Skip for now'))
    await fire.click(button('Skip for now'))
    await fire.click(button('Add a Debt'))
    expect(shownScreen()).toBe('guide')
    expect(screen.getByRole('group', { name: 'Add a Debt' })).toBeTruthy()
    expect(document.activeElement?.id).toBe('debt-kind')
    await fire.click(button('Cancel'))
    expect(title()).toBe('Debts')
    expect(document.activeElement?.id).toBe('gs-add-debt')
    await fire.click(button('I don’t have any debts'))
    expect(title()).toBe('Bills & Subscriptions')
    expect(stageStates()[2]).toBe('Debts: Completed (none)')
    await fire.click(button('Add a Bill'))
    expect(shownScreen()).toBe('guide')
    expect(document.activeElement?.id).toBe('bill-name')
    await fire.click(button('Cancel'))
    expect(title()).toBe('Bills & Subscriptions')
    expect(document.activeElement?.id).toBe('gs-add-bill')
    await fire.click(button('Skip for now'))
    await fire.click(button('Add a Goal'))
    expect(shownScreen()).toBe('new-goal')
    await fire.click(button('Cancel'))
    await moves()
    expect(title()).toBe('Goals')
    // Nothing was added by opening and cancelling those forms.
    const data = (await storedData())!
    expect([data.debts.length, data.bills.length, data.goals.filter(goal => goal.kind === 'goal').length]).toEqual([0, 0, 0])
  })

  it('Finish lists where each stage stands and Done ends the guide without completing skipped stages', async () => {
    const storage = await ownSpace()
    await openGuide()
    for (let i = 0; i < 5; i++) await fire.click(button('Skip for now'))
    expect(title()).toBe('Finish')
    expect(within(screen.getByRole('list', { name: 'Your setup' })).getAllByRole('listitem').map(item => text(item)))
      .toEqual(['Accounts & SavingsSkipped', 'IncomeSkipped', 'DebtsSkipped', 'Bills & SubscriptionsSkipped', 'GoalsSkipped'])
    await fire.click(button('Done'))
    await moves()
    expect(shownScreen()).toBe('home')
    expect(card()).toBeNull()
    expect(savedProgress(storage)).toMatchObject({ finished: true, skipped: ['accounts', 'income', 'debts', 'bills', 'goals'] })
    // Help & Guide still opens it, with every stage reviewable.
    await fire.click(button('Settings'))
    await fire.click(button('Open Help & Guide'))
    await fire.click(button('Open Getting Started'))
    expect(title()).toBe('Accounts & Savings')
    expect(stage('Goals').disabled).toBe(false)
  })

  it('Income can be answered "I don’t have regular income": complete, nothing added', async () => {
    const storage = await ownSpace()
    await openGuide()
    await fire.click(button('Skip for now'))
    await fire.click(button('I don’t have regular income'))
    expect(title()).toBe('Debts')
    expect(stageStates()[1]).toBe('Income: Completed (none)')
    expect(savedProgress(storage)).toMatchObject({ none: ['income'], skipped: ['accounts'] })
    expect((await storedData())!.incomeSources).toEqual([])
  })
})

describe('Accounts and Income stages (GS-2 forms)', () => {
  it('saves accounts and stays on the stage; empty and 0 stay different; Cancel and errors work as in Money', async () => {
    await ownSpace()
    await openGuide()
    await typeAccount('Wallet')
    expect(document.querySelector('.gs-stage #account-name')).not.toBeNull()
    await fire.click(button('Save Account'))
    expect(title()).toBe('Accounts & Savings')
    expect(text(screen.getByRole('main'))).toContain('Account saved.')
    expect(document.activeElement?.textContent).toContain('Add Another Account')
    await typeAccount('Cash', '0')
    await fire.click(button('Save Account'))
    await typeAccount('Bad', 'abc')
    await fire.click(button('Save Account'))
    expect(text(screen.getByRole('alert'))).toBe('Enter a balance such as 820, or leave it empty.')
    expect(field('Account Name').value).toBe('Bad')
    await fire.click(button('Cancel'))
    const items = within(screen.getByRole('list', { name: 'Your accounts' })).getAllByRole('listitem').map(item => text(item))
    expect(items).toEqual(['WalletSavingsNot entered', 'CashSavings0,00 zł'])
    const data = (await storedData())!
    expect(data.moneyAccounts.map(account => [account.name, account.owner])).toEqual([['Wallet', data.space.members[0].id], ['Cash', data.space.members[0].id]])
    expect(data.balances.length).toBe(1)
    // The same records in Money.
    await fire.click(tab('Money'))
    expect(text(screen.getByRole('main'))).toContain('2 accounts · 1 without a balance')
  })

  it('saves income and stays on the stage; more than one source, no duplicates', async () => {
    await ownSpace()
    await openGuide()
    await fire.click(button('Skip for now'))
    await typeIncome('Salary', '4000')
    await fire.click(button('Save Income'))
    expect(title()).toBe('Income')
    await typeIncome('Side job', '500')
    await fire.click(button('Save Income'))
    expect(stageStates()[1]).toBe('Income: Completed, current')
    expect(within(screen.getByRole('list', { name: 'Your income' })).getAllByRole('listitem')).toHaveLength(2)
    const data = (await storedData())!
    expect(data.incomeSources.map(source => [source.name, source.amount, source.memberId])).toEqual([['Salary', 400000, data.space.members[0].id], ['Side job', 50000, data.space.members[0].id]])
    expect(data.income).toEqual([])
  })

  it('a save the browser refuses keeps the form as typed and says so', async () => {
    await ownSpace()
    await openGuide()
    await typeAccount('Holiday pot', '50')
    refuseWrites()
    await fire.click(button('Save Account'))
    expect(field('Account Name').value).toBe('Holiday pot')
    expect(text(screen.getByRole('main'))).toContain('This browser did not save it.')
    expect(stageStates()[0]).toBe('Accounts: Not started, current')
    vi.restoreAllMocks()
    expect((await storedData())!.moneyAccounts).toEqual([])
  })

  it('in a Duo: new accounts are shared and new income belongs to the first person, as in Money', async () => {
    await ownSpace({ duo: true })
    await openGuide()
    await typeAccount('Joint')
    await fire.click(button('Save Account'))
    await fire.click(button(/^Continue/))
    await typeIncome('Salary', '4000')
    await fire.click(button('Save Income'))
    const data = (await storedData())!
    expect(data.moneyAccounts.map(account => account.owner)).toEqual(['shared'])
    expect(data.incomeSources.map(source => source.memberId)).toEqual([data.space.members[0].id])
    expect(screen.queryByText('Whose income is this?')).toBeNull()
  })
})

describe('Unsaved changes on a stage', () => {
  it('Back, Skip for now, the stage list, a tab and Close ask first; Keep Editing keeps the form; Discard and Leave moves once', async () => {
    await ownSpace()
    await openGuide()
    await fire.click(button('Skip for now'))
    // An untouched form asks nothing.
    await fire.click(button('Add Income'))
    await fire.click(button('Back'))
    expect(question()).toBeNull()
    expect(title()).toBe('Accounts & Savings')
    await typeAccount('Holiday pot')
    for (const move of [() => button('Skip for now'), () => stage('Income'), () => tab('Home'), () => button('Close Getting Started')]) {
      await fire.click(move())
      expect(text(question())).toContain('Add account')
      await fire.click(within(question()!).getByRole('button', { name: 'Keep Editing' }))
      expect(question()).toBeNull()
      expect(title()).toBe('Accounts & Savings')
      expect(field('Account Name').value).toBe('Holiday pot')
    }
    await fire.click(stage('Income'))
    await fire.click(within(question()!).getByRole('button', { name: 'Discard and Leave' }))
    await moves()
    expect(title()).toBe('Income')
    // One move: Back from Income goes to Accounts, where the form is gone and nothing was saved.
    await fire.click(button('Back'))
    expect(title()).toBe('Accounts & Savings')
    expect(screen.queryByLabelText('Account Name')).toBeNull()
    expect((await storedData())!.moneyAccounts).toEqual([])
  })

  it('Back on a stage asks first with a form being typed', async () => {
    await ownSpace()
    await openGuide()
    await fire.click(button('Skip for now'))
    await typeIncome('Salary', '4000')
    await fire.click(button('Back'))
    expect(text(question())).toContain('Add income')
    await fire.click(within(question()!).getByRole('button', { name: 'Keep Editing' }))
    expect(title()).toBe('Income')
    expect(field('Name').value).toBe('Salary')
  })

  it('the browser Back button asks first too', async () => {
    await ownSpace()
    await openGuide()
    await typeAccount('Holiday pot')
    act(() => window.history.back())
    await moves()
    expect(text(question())).toContain('Add account')
    await fire.click(within(question()!).getByRole('button', { name: 'Keep Editing' }))
    await moves()
    expect(shownScreen()).toBe('guide')
    expect(field('Account Name').value).toBe('Holiday pot')
  })

  it('while a save is under way, a move waits for it and never drops what is being saved', async () => {
    const held = heldStore()
    await ownSpace({ store: held.store })
    await openGuide()
    await typeAccount('Holiday pot')
    held.hold()
    await act(async () => { button('Save Account').click() })
    await act(async () => { button('Skip for now').click() })
    expect(question()).toBeNull()
    expect(title()).toBe('Accounts & Savings')
    await held.release()
    await settle()
    await moves()
    expect(question()).toBeNull()
    expect(title()).toBe('Income')
    expect((await storedData())!.moneyAccounts.map(account => account.name)).toEqual(['Holiday pot'])
  })
})

describe('Hide amounts', () => {
  it('the header eye hides the balances and income of the stages, on screen and for screen readers, and shows them again', async () => {
    await ownSpace()
    await openGuide()
    await typeAccount('Wallet', '1234.56')
    await fire.click(button('Save Account'))
    await fire.click(button(/^Continue/))
    await typeIncome('Salary', '4321')
    await fire.click(button('Save Income'))
    const main = () => text(screen.getByRole('main'))
    expect(main()).toContain('4321,00')
    await fire.click(button('Hide amounts'))
    // Income, then Accounts: no figure anywhere on the screen, not even in what screen readers hear.
    const income = within(screen.getByRole('list', { name: 'Your income' })).getByRole('listitem')
    expect(text(income)).toBe('SalaryPay day 10••••amount hidden / month')
    expect(income.querySelector('[aria-hidden="true"]')?.textContent).toBe('••••')
    expect(main()).not.toMatch(/4321|1234/)
    await fire.click(button('Back'))
    expect(title()).toBe('Accounts & Savings')
    const account = within(screen.getByRole('list', { name: 'Your accounts' })).getByRole('listitem')
    expect(text(account)).toBe('WalletSavings••••amount hidden')
    expect(main()).not.toMatch(/4321|1234/)
    // Saving while hidden: the message never says an amount; a balance not entered still says so.
    await typeAccount('Shoebox')
    await fire.click(button('Save Account'))
    expect(main()).toContain('Account saved.')
    expect(main()).toContain('Not entered')
    expect(main()).not.toMatch(/4321|1234/)
    // The same, single state: shown again with the header eye, here and on Home.
    await fire.click(button('Amounts hidden. Show amounts'))
    expect(text(within(screen.getByRole('list', { name: 'Your accounts' })).getAllByRole('listitem')[0])).toBe('WalletSavings1234,56 zł')
    await fire.click(stage('Income'))
    expect(main()).toContain('4321,00 zł / month')
  })
})

describe('Demo', () => {
  it('works in the demo and keeps nothing: no progress on this device, no records in the own space', async () => {
    const storage = memoryStorage()
    render(<App getToday={() => TODAY} storage={storage} />)
    await settle()
    await fire.click(button('Explore the App'))
    expect(card()).toBeNull()
    await fire.click(button('Settings'))
    await fire.click(button('Open Help & Guide'))
    await fire.click(button('Open Getting Started'))
    // Alex has everything the first five stages ask for.
    expect(title()).toBe('Finish')
    expect(stageStates().slice(0, 5).every(item => item.includes('Completed'))).toBe(true)
    expect(text(screen.getByRole('main'))).toContain('In the demo, Alex’s information is invented.')
    await fire.click(stage('Accounts'))
    await typeAccount('Demo pot')
    await fire.click(button('Save Account'))
    expect(text(screen.getByRole('list', { name: 'Your accounts' }))).toContain('Demo pot')
    expect(storedKeys(storage).some(key => key.includes('getting-started'))).toBe(false)
    expect(await storedData()).toBeNull()
  })
})
