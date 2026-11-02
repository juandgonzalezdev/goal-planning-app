// @vitest-environment jsdom
import { act, cleanup, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { memoryStorage } from './test/memoryStorage'
import { fire, freshDatabaseForEachTest, settle, storedData } from './test/space'
import { chooseHomeOption } from './test/homeControls'
import { openMoneyBlock } from './test/money'
import { createAlexDemo } from './data/fixtures/demoAlex'
import { emergencyFund, goalSaved, summarizeGoals } from './domain/finance/goals'
import { formatAmount } from './ui/format'

freshDatabaseForEachTest()

// Stage 2A, the Money hub: the tabs Home · Bills · Goals · Money · History,
// every former Data and Cards function in its new place, the return from a
// detail to where it was opened, the steps of earlier versions (cards, data)
// with forms and repeated Back/Forward, and what the hiding of amounts covers.
// Alex's demo is shown on its own date, 31 Dec 2026.
afterEach(() => { cleanup(); vi.restoreAllMocks() })

const button = (name: string | RegExp) => screen.getByRole('button', { name })
const text = (element: Element | null) => (element?.textContent ?? '').replace(/\u00a0|\u202f/g, ' ')
const nav = () => within(screen.getByRole('navigation', { name: 'Main navigation' }))
const tab = (name: string) => nav().getByRole('button', { name })
const regionOf = (name: string) => screen.getByRole('region', { name })
const escape = (name: string) => name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const toggleOf = (name: string) => within(regionOf(name)).getByRole('button', { name: new RegExp(`^${escape(name)}`) })
const isOpen = (name: string) => toggleOf(name).getAttribute('aria-expanded') === 'true'
const heading = (name: string | RegExp) => screen.queryByRole('heading', { name, level: 1 })
const shownScreen = () => document.querySelector('main [data-screen]')?.getAttribute('data-screen')
const monthSelect = () => screen.getByRole('combobox', { name: 'Month' }) as HTMLSelectElement
const question = () => screen.queryByRole('alertdialog', { name: 'Leave without saving?' })
const inQuestion = (name: string | RegExp) => within(question()!).getByRole('button', { name })
/** Lets the browser's history moves (they arrive later, as in a browser) and their answers happen. */
const moves = () => act(async () => { for (let i = 0; i < 10; i++) await new Promise(resolve => setTimeout(resolve, 5)) })
const browserBack = async () => { act(() => window.history.back()); await moves() }
const browserForward = async () => { act(() => window.history.forward()); await moves() }

async function openAlex(storage: Storage = memoryStorage()) {
  render(<App getToday={() => '2026-10-25'} storage={storage} />)
  await settle()
  await fire.click(button('Explore the App'))
  return storage
}

/** Welcome → Create Account → Welcome Setup → Home, as one person. */
async function createOwnSpace() {
  render(<App getToday={() => '2026-10-25'} storage={memoryStorage()} />)
  await settle()
  await fire.click(button(/Create Account/))
  await fire.click(button(/Continue Without an Account/))
  await fire.change(screen.getByLabelText('Display Name'), { target: { value: 'Robin' } })
  await fire.click(button(/Continue/))
  await fire.click(button(/Continue/))
  await fire.click(button(/Continue/))
  await fire.click(button('Create My Space'))
}

/** Gives the browser step the app is on the screen name an earlier version saved there (same chain and place). */
function makeOldStep(screenName: 'cards' | 'data') {
  const state = window.history.state as Record<string, unknown>
  window.history.replaceState({ ...state, screen: screenName }, '')
}

describe('Tabs and where every former Data and Cards function is now', () => {
  it('shows the five tabs with their names, and none of the old ones', async () => {
    await openAlex()
    expect(nav().getAllByRole('button').map(b => b.textContent)).toEqual(['Home', 'Bills', 'Goals', 'Money', 'History'])
    expect(nav().queryByRole('button', { name: 'Data' })).toBeNull()
    expect(nav().queryByRole('button', { name: 'Cards' })).toBeNull()
    for (const name of ['Bills', 'Goals', 'Money', 'History', 'Home']) {
      await fire.click(tab(name))
      expect(tab(name).getAttribute('aria-current')).toBe('page')
      expect(nav().getAllByRole('button').filter(b => b.getAttribute('aria-current') === 'page')).toHaveLength(1)
    }
  })

  it('keeps every function reachable: Money blocks, All Bills, Goals with the Emergency Fund, and Reports & Backup in Settings', async () => {
    await openAlex()
    await fire.click(tab('Money'))
    for (const name of ['Income', 'Accounts & Savings', 'Cards & Loans']) expect(toggleOf(name)).toBeTruthy()
    for (const name of [/Add Income/, /Add Account/, /Add Card or Loan/, 'Expand All', 'Collapse All']) expect(button(name)).toBeTruthy()
    await fire.click(tab('Bills'))
    expect(toggleOf('All Bills')).toBeTruthy()
    await fire.click(tab('Goals'))
    expect(within(regionOf('Emergency Fund')).getByRole('button', { name: /^Emergency Fund/ })).toBeTruthy()
    expect(button(/Add Goal/)).toBeTruthy()
    // Reports & Backup: from Money's link, Settings with the focus on that section; Back returns to Money.
    await fire.click(tab('Money'))
    await fire.click(button('Open Reports & Backup'))
    expect(heading('Settings')).toBeTruthy()
    const reports = document.getElementById('settings-reports')!
    expect(document.activeElement).toBe(reports)
    for (const name of ['Download PDF', 'Download Backup']) expect(within(reports).getByRole('button', { name })).toBeTruthy()
    await fire.click(button('Back'))
    expect(heading('Money')).toBeTruthy()
    // The gear opens the same Settings, with Reports & Backup in it.
    await fire.click(button('Settings'))
    expect(screen.getByRole('heading', { name: 'Reports & Backup' })).toBeTruthy()
  })

  it('offers Restore Backup in the own space’s Settings', async () => {
    await createOwnSpace()
    await fire.click(tab('Money'))
    await fire.click(button('Open Reports & Backup'))
    expect(screen.getByLabelText(/Choose a backup file/)).toBeTruthy()
  })
})

describe('Money: the month and the blocks', () => {
  it('has the shared month inside Cards & Loans only; Income and Accounts do not use it', async () => {
    await openAlex()
    await fire.click(tab('Money'))
    await openMoneyBlock('Income')
    await openMoneyBlock('Accounts & Savings')
    expect(within(regionOf('Income')).queryByRole('combobox', { name: 'Month' })).toBeNull()
    expect(within(regionOf('Accounts & Savings')).queryByRole('combobox', { name: 'Month' })).toBeNull()
    expect(text(regionOf('Income'))).toContain('Income does not use the month chosen in Cards & Loans.')
    const income = text(regionOf('Income'))
    const accounts = text(regionOf('Accounts & Savings'))
    await openMoneyBlock('Cards & Loans')
    const month = within(regionOf('Cards & Loans')).getByRole('combobox', { name: 'Month' }) as HTMLSelectElement
    expect(month.value).toBe('2026-12')
    await fire.change(month, { target: { value: '2026-03' } })
    expect(text(regionOf('Cards & Loans'))).toContain('Monthly Payments · March 2026')
    // Income and Accounts show the same as before; Home and Bills follow the month.
    expect(text(regionOf('Income'))).toBe(income)
    expect(text(regionOf('Accounts & Savings'))).toBe(accounts)
    await fire.click(tab('Bills'))
    expect(monthSelect().value).toBe('2026-03')
    await fire.click(tab('Home'))
    expect(monthSelect().value).toBe('2026-03')
  })

  it('keeps what was typed when a block is closed, with Expand All or Collapse All, and when another account is opened', async () => {
    await openAlex()
    await fire.click(tab('Money'))
    await openMoneyBlock('Accounts & Savings')
    await fire.click(within(regionOf('Accounts & Savings')).getByRole('button', { name: /^Savings Account/ }))
    await fire.click(button('Update Balance: Savings Account'))
    await fire.change(screen.getByLabelText(/^New Balance of Savings Account/), { target: { value: '1234' } })
    await openMoneyBlock('Income')
    await fire.click(within(regionOf('Income')).getByRole('button', { name: /Add Income/ }))
    await fire.change(screen.getByLabelText('Name'), { target: { value: 'Bonus' } })

    await fire.click(button('Collapse All'))
    expect(question()).toBeNull()
    await fire.click(button('Expand All'))
    expect(question()).toBeNull()
    await fire.click(toggleOf('Accounts & Savings'))
    await fire.click(toggleOf('Accounts & Savings'))
    expect((screen.getByLabelText('Name') as HTMLInputElement).value).toBe('Bonus')
    expect((screen.getByLabelText(/^New Balance of Savings Account/) as HTMLInputElement).value).toBe('1234')
    // Opening another account hides the first one's form but keeps it: back on it, the balance is still there.
    await fire.click(within(regionOf('Accounts & Savings')).getByRole('button', { name: /^Piggy Bank/ }))
    expect(question()).toBeNull()
    await fire.click(within(regionOf('Accounts & Savings')).getByRole('button', { name: /^Savings Account/ }))
    expect((screen.getByLabelText(/^New Balance of Savings Account/) as HTMLInputElement).value).toBe('1234')
    // Leaving Money would close them: the question of 1B, listing both.
    await fire.click(tab('Home'))
    expect(question()).toBeTruthy()
    expect(text(question())).toContain('Update balance: Savings Account')
    expect(text(question())).toContain('Add income')
    await fire.click(inQuestion('Keep Editing'))
    expect(shownScreen()).toBe('money')
  })

  it('shows Savings by purpose as Home does, with the Emergency Fund and the goals counted once', async () => {
    await openAlex()
    await chooseHomeOption('Expand All')
    const onHome = text(screen.getByRole('group', { name: 'Savings by purpose' }))
    await fire.click(tab('Money'))
    await openMoneyBlock('Accounts & Savings')
    const inMoney = text(within(regionOf('Accounts & Savings')).getByRole('group', { name: 'Savings by purpose' }))
    expect(inMoney).toBe(onHome)
    expect(inMoney).toContain('part of Savings, not extra money')
  })
})

describe('Goals tab', () => {
  it('keeps the Emergency Fund apart from Saved in Goals, and the filter while moving around', async () => {
    await openAlex()
    await fire.click(tab('Goals'))
    // Saved in Goals is the goals only; the Emergency Fund has its own card, with its own amount.
    const data = createAlexDemo()
    const fund = emergencyFund(data.goals)!
    const money = (minor: number) => formatAmount(minor, 'PLN').replace(/\u00a0|\u202f/g, ' ')
    expect(text(screen.getByText('Saved in Goals').parentElement)).toContain(money(summarizeGoals(data).saved))
    expect(text(regionOf('Emergency Fund'))).toContain(money(goalSaved(fund, data.goalMovements)))
    const list = [...document.querySelectorAll('[data-screen="goals"] .goal-cards .goal-card b')].map(item => item.textContent)
    expect(list).not.toContain('Emergency Fund')
    await fire.click(button('With Date'))
    await fire.click(tab('Money'))
    await fire.click(tab('Goals'))
    expect(button('With Date').getAttribute('aria-pressed')).toBe('true')
    // A goal opened here goes back here.
    await fire.click(button('All'))
    await fire.click(button(/^Trip to Japan/))
    await fire.click(button('Back'))
    expect(heading('My Goals')).toBeTruthy()
  })

  it('offers Start an Emergency Fund in a new space', async () => {
    await createOwnSpace()
    await fire.click(tab('Goals'))
    await fire.click(button('Start an Emergency Fund'))
    expect(shownScreen()).toBe('emergency')
  })
})

describe('Back from a detail goes to where it was opened', () => {
  it('from Money: Cards & Loans open, the same place, the focus on the card or loan', async () => {
    const scrolled: number[] = []
    vi.spyOn(window, 'scrollTo').mockImplementation(((_x: number, y: number) => { scrolled.push(y) }) as typeof window.scrollTo)
    await openAlex()
    await fire.click(tab('Money'))
    await openMoneyBlock('Cards & Loans')
    Object.defineProperty(window, 'scrollY', { value: 640, configurable: true })
    await fire.click(within(regionOf('Cards & Loans')).getByRole('button', { name: /^Small Loan/ }))
    expect(heading('Small Loan')).toBeTruthy()
    Object.defineProperty(window, 'scrollY', { value: 0, configurable: true })
    await fire.click(button('Back'))
    expect(heading('Money')).toBeTruthy()
    expect(isOpen('Cards & Loans')).toBe(true)
    expect(document.activeElement).toBe(within(regionOf('Cards & Loans')).getByRole('button', { name: /^Small Loan/ }))
    expect(scrolled.at(-1)).toBe(640)
  })

  it('from Money through a linked bill: Back, Back returns to the card or loan, then to Money', async () => {
    await openAlex()
    await fire.click(tab('Money'))
    await openMoneyBlock('Cards & Loans')
    await fire.click(within(regionOf('Cards & Loans')).getByRole('button', { name: /^Small Loan/ }))
    await fire.click(screen.getByRole('button', { name: 'Small Loan, December 2026' }))
    expect(shownScreen()).toBe('bill')
    await fire.click(button('Back'))
    expect(heading('Small Loan')).toBeTruthy()
    await fire.click(button('Back'))
    expect(document.activeElement).toBe(within(regionOf('Cards & Loans')).getByRole('button', { name: /^Small Loan/ }))
  })

  it('from Home: Back is Home, not Money', async () => {
    await openAlex()
    await chooseHomeOption('Expand All')
    await fire.click(within(regionOf('Total Debt')).getByRole('button', { name: /^Small Loan/ }))
    await fire.click(button('Back'))
    expect(tab('Home').getAttribute('aria-current')).toBe('page')
    expect(shownScreen()).toBe('home')
  })

  it('from a bill opened in Bills: Back is the bill, then Bills', async () => {
    await openAlex()
    await fire.click(tab('Bills'))
    await openMoneyBlockless('All Bills')
    await fire.click(within(regionOf('All Bills')).getByRole('button', { name: /^Small Loan/ }))
    await fire.click(within(screen.getByRole('main')).getByRole('button', { name: 'Small Loan' }))
    expect(heading('Small Loan')).toBeTruthy()
    await fire.click(button('Back'))
    expect(shownScreen()).toBe('bill')
    await fire.click(button('Back'))
    expect(shownScreen()).toBe('bills')
    expect(document.activeElement).toBe(within(regionOf('All Bills')).getByRole('button', { name: /^Small Loan/ }))
  })

  it('a goal says Back, not All Goals, and goes back to where it was opened (Home, Goals)', async () => {
    await openAlex()
    await chooseHomeOption('Expand All')
    await fire.click(within(regionOf('My Goals')).getByRole('button', { name: /^Trip to Japan/ }))
    expect(screen.queryByRole('button', { name: 'All Goals' })).toBeNull()
    await fire.click(button('Back'))
    expect(shownScreen()).toBe('home')
    await fire.click(tab('Goals'))
    await fire.click(button(/^Trip to Japan/))
    await fire.click(button('Back'))
    expect(shownScreen()).toBe('goals')
  })

  it('from Savings by purpose in Money: Back to the goal’s line', async () => {
    await openAlex()
    await fire.click(tab('Money'))
    await openMoneyBlock('Accounts & Savings')
    const group = () => within(regionOf('Accounts & Savings')).getByRole('group', { name: 'Savings by purpose' })
    await fire.click(within(group()).getByRole('button', { name: /^Trip to Japan/ }))
    await fire.click(button('Back'))
    expect(document.activeElement).toBe(within(group()).getByRole('button', { name: /^Trip to Japan/ }))
  })
})

describe('Links into Money and Goals', () => {
  it('Open Cards & Loans on Home opens Money on that block, with the focus on its heading', async () => {
    await openAlex()
    await chooseHomeOption('Expand All')
    await fire.click(within(regionOf('Total Debt')).getByRole('button', { name: /Open Cards & Loans/ }))
    expect(heading('Money')).toBeTruthy()
    expect(isOpen('Cards & Loans')).toBe(true)
    expect(isOpen('Income')).toBe(false)
    expect(document.activeElement).toBe(toggleOf('Cards & Loans'))
  })

  it('View All on Home opens the Goals tab', async () => {
    await openAlex()
    await chooseHomeOption('Expand All')
    await fire.click(within(regionOf('My Goals')).getByRole('button', { name: /View All/ }))
    expect(tab('Goals').getAttribute('aria-current')).toBe('page')
  })
})

describe('Steps saved by an earlier version (cards, data)', () => {
  it('Back to an old Cards step shows Money on Cards & Loans; Forward works as usual', async () => {
    await openAlex()
    makeOldStep('cards')
    const length = window.history.length
    await fire.click(tab('Bills'))
    await browserBack()
    expect(shownScreen()).toBe('money')
    expect(tab('Money').getAttribute('aria-current')).toBe('page')
    expect(isOpen('Cards & Loans')).toBe(true)
    expect(document.activeElement).toBe(toggleOf('Cards & Loans'))
    await browserForward()
    expect(shownScreen()).toBe('bills')
    expect(window.history.length).toBe(length + 1)
  })

  it('with a form changed: Back to an old Data step asks; more Back keeps the first destination; Discard and Leave goes there once', async () => {
    await openAlex()
    makeOldStep('data')
    await fire.click(tab('Money'))
    const length = window.history.length
    await openMoneyBlock('Accounts & Savings')
    await fire.click(within(regionOf('Accounts & Savings')).getByRole('button', { name: /Add Account/ }))
    await fire.change(screen.getByLabelText('Account Name'), { target: { value: 'Holiday pot' } })

    await browserBack()
    expect(question()).toBeTruthy()
    expect(shownScreen()).toBe('money')
    expect((screen.getByLabelText('Account Name') as HTMLInputElement).value).toBe('Holiday pot')
    // More Back while asking: still one question, the form stays, no new step.
    await browserBack()
    await browserBack()
    expect(screen.getAllByRole('alertdialog')).toHaveLength(1)
    expect((screen.getByLabelText('Account Name') as HTMLInputElement).value).toBe('Holiday pot')
    expect(window.history.length).toBe(length)
    await fire.click(inQuestion('Keep Editing'))
    await moves()
    expect(question()).toBeNull()
    expect((screen.getByLabelText('Account Name') as HTMLInputElement).value).toBe('Holiday pot')

    await browserBack()
    expect(question()).toBeTruthy()
    await fire.click(inQuestion('Discard and Leave'))
    await moves()
    expect(question()).toBeNull()
    expect(shownScreen()).toBe('money')
    expect(screen.queryByLabelText('Account Name')).toBeNull()
    expect(window.history.length).toBe(length)
    expect(await storedData()).toBeNull()
  })

  it('with a form changed: Forward to an old Cards step asks too; Keep Editing keeps the form; Discard and Leave shows Cards & Loans', async () => {
    await openAlex()
    await fire.click(tab('Money'))
    await fire.click(tab('Bills'))
    makeOldStep('cards')
    await browserBack()
    expect(shownScreen()).toBe('money')
    const length = window.history.length
    await openMoneyBlock('Income')
    await fire.click(within(regionOf('Income')).getByRole('button', { name: /Add Income/ }))
    await fire.change(screen.getByLabelText('Name'), { target: { value: 'Bonus' } })
    await browserForward()
    expect(question()).toBeTruthy()
    await browserForward()
    expect(screen.getAllByRole('alertdialog')).toHaveLength(1)
    await fire.click(inQuestion('Keep Editing'))
    await moves()
    expect((screen.getByLabelText('Name') as HTMLInputElement).value).toBe('Bonus')
    await browserForward()
    expect(question()).toBeTruthy()
    await fire.click(inQuestion('Discard and Leave'))
    await moves()
    expect(shownScreen()).toBe('money')
    expect(isOpen('Cards & Loans')).toBe(true)
    expect(screen.queryByLabelText('Name')).toBeNull()
    expect(window.history.length).toBe(length)
  })
})

describe('Hiding amounts (unchanged in this stage)', () => {
  it('Money shows amounts as Data and Cards did, also when every Home block hides them', async () => {
    await openAlex()
    await fire.click(tab('Bills'))
    await fire.click(button('Hide All Amounts'))
    await openMoneyBlockless('All Bills')
    // All Bills belongs to Bills: Bills' Hide All Amounts hides its usual amounts too.
    expect(text(regionOf('All Bills'))).not.toMatch(/\d,\d\d zł/)
    await fire.click(tab('Money'))
    await fire.click(button('Expand All'))
    expect(text(regionOf('Cards & Loans'))).toMatch(/\d,\d\d zł/)
    await fire.click(tab('Bills'))
    await fire.click(button('Show All Amounts'))
    expect(text(regionOf('All Bills'))).toMatch(/\d,\d\d zł/)
  })
})

describe('Demo and own space', () => {
  it('keeps Money’s blocks and the Goals filter apart, and writes nothing in the demo', async () => {
    const storage = await openAlex()
    await fire.click(tab('Money'))
    await openMoneyBlock('Cards & Loans')
    await fire.click(tab('Goals'))
    await fire.click(button('With Date'))
    expect(storage.length).toBe(0)
    expect(await storedData()).toBeNull()
    await fire.click(button('Exit Demo'))
    await fire.click(button(/Create Account/))
    await fire.click(button(/Continue Without an Account/))
    await fire.change(screen.getByLabelText('Display Name'), { target: { value: 'Robin' } })
    await fire.click(button(/Continue/))
    await fire.click(button(/Continue/))
    await fire.click(button(/Continue/))
    await fire.click(button('Create My Space'))
    await fire.click(tab('Money'))
    expect(isOpen('Cards & Loans')).toBe(false)
    await fire.click(tab('Goals'))
    expect(button('All').getAttribute('aria-pressed')).toBe('true')
  })
})

/** Opens a block outside Money (All Bills) from its heading, unless it is already open. */
async function openMoneyBlockless(name: string) {
  if (!isOpen(name)) await fire.click(toggleOf(name))
}
