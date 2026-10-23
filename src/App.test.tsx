// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import App from './App'
import { STORAGE_KEY } from './data/localStore'
import { memoryStorage } from './test/memoryStorage'

// Invented example values and a fixed date. The demo has its own date (23 Oct 2026).
const TODAY = '2026-10-21'

afterEach(() => { cleanup(); document.documentElement.removeAttribute('data-theme') })

const button = (name: string | RegExp) => screen.getByRole('button', { name })
const heading = (name: string | RegExp) => screen.getByRole('heading', { name })
const field = (label: string | RegExp) => screen.getByLabelText(label) as HTMLInputElement
const type = (label: string | RegExp, value: string) => fireEvent.change(field(label), { target: { value } })
const section = (name: 'planner' | 'cards') => document.querySelector<HTMLElement>(`[data-screen="${name}"]`)
const tab = (name: string) => within(screen.getByRole('navigation', { name: 'Main navigation' })).getByRole('button', { name })
// Intl writes amounts with no-break spaces; compare them as plain spaces.
const text = (element: Element | null) => (element?.textContent ?? '').replace(/\u00a0|\u202f/g, ' ')
const stat = (label: string) => text(screen.getByText(label).parentElement)

function start(storage: Storage = memoryStorage()) {
  return { storage, ...render(<App getToday={() => TODAY} storage={storage} />) }
}

/** Welcome → Create Account → Welcome Setup → Home, as one person. */
function createIndividualSpace(storage: Storage = memoryStorage(), name = 'Robin') {
  const result = start(storage)
  fireEvent.click(button(/Create Account/))
  fireEvent.click(button(/Continue Without an Account/))
  type('Display Name', name)
  fireEvent.click(button(/Continue/))
  fireEvent.click(button(/Continue/))
  fireEvent.click(button(/Continue/))
  fireEvent.click(button('Create My Space'))
  return result
}

function openDemo() {
  const result = start()
  fireEvent.click(button('Explore the App'))
  return result
}

const saved = (storage: Storage) => JSON.parse(storage.getItem(STORAGE_KEY) ?? 'null')

/** Waits for the browser to finish a history move and the app to show it. */
async function browserBack() {
  await act(async () => {
    window.history.back()
    await new Promise(resolve => setTimeout(resolve, 20))
  })
}

describe('Welcome', () => {
  it('opens with the welcome message and the three choices', () => {
    start()
    expect(heading('Your goals, your way.')).toBeTruthy()
    expect(button(/Create Account/)).toBeTruthy()
    expect(button('Log In')).toBeTruthy()
    expect(button('Explore the App')).toBeTruthy()
    expect(screen.getByText(/Nothing is sent anywhere/)).toBeTruthy()
  })

  it('shows no tabs, planner or calculator before a space is open', () => {
    start()
    expect(screen.queryByRole('navigation', { name: 'Main navigation' })).toBeNull()
    expect(section('planner')).toBeNull()
    expect(section('cards')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Settings' })).toBeNull()
  })
})

describe('Create Account and Log In (Preview)', () => {
  it.each([[/Create Account/, 'Create Account'], ['Log In', 'Log In']])('shows %s as a preview where nothing can be typed', (open, title) => {
    start()
    fireEvent.click(button(open))
    expect(heading(new RegExp(`^${title}`)).textContent).toContain('Preview')
    expect(field('Email').disabled).toBe(true)
    expect(field('Password').disabled).toBe(true)
    expect(screen.getByText(/nothing you see here is sent or saved/)).toBeTruthy()
    fireEvent.click(button(/Continue Without an Account/))
    expect(heading('Your Profile')).toBeTruthy()
  })

  it('never stores a password or email', () => {
    const { storage } = createIndividualSpace()
    const stored = storage.getItem(STORAGE_KEY) ?? ''
    expect(stored).not.toMatch(/password|email/i)
  })
})

describe('Welcome Setup', () => {
  it('needs a name before continuing', () => {
    start()
    fireEvent.click(button(/Create Account/))
    fireEvent.click(button(/Continue Without an Account/))
    expect(screen.getByText('Welcome Setup · Step 1 of 4')).toBeTruthy()
    fireEvent.click(button(/Continue/))
    expect(screen.getByText('Enter your name.')).toBeTruthy()
    expect(heading('Your Profile')).toBeTruthy()
  })

  it('offers Individual and Duo, with Group coming soon', () => {
    start()
    fireEvent.click(button(/Create Account/))
    fireEvent.click(button(/Continue Without an Account/))
    type('Display Name', 'Robin')
    fireEvent.click(button(/Continue/))
    const individual = screen.getByRole('radio', { name: /Individual/ }) as HTMLInputElement
    const duo = screen.getByRole('radio', { name: /Duo/ }) as HTMLInputElement
    const group = screen.getByRole('radio', { name: /Group/ }) as HTMLInputElement
    expect(individual.checked).toBe(true)
    expect(duo.disabled).toBe(false)
    expect(group.disabled).toBe(true)
    expect(group.closest('label')!.textContent).toContain('Coming soon')
  })

  it('creates a Duo space after the second name, saying there is no privacy between members yet', () => {
    const { storage } = start()
    fireEvent.click(button(/Create Account/))
    fireEvent.click(button(/Continue Without an Account/))
    type('Display Name', 'Robin')
    fireEvent.click(button(/Continue/))
    fireEvent.click(screen.getByRole('radio', { name: /Duo/ }))
    expect(screen.getByText(/No private information between members yet/)).toBeTruthy()
    fireEvent.click(button(/Continue/))
    expect(screen.getByText('Enter the second person\'s name.')).toBeTruthy()
    type("Second Person's Name", 'Sasha')
    fireEvent.click(button(/Continue/))
    fireEvent.change(field('Currency'), { target: { value: 'EUR' } })
    fireEvent.click(button(/Continue/))
    expect(heading('Privacy & Terms')).toBeTruthy()
    fireEvent.click(button('Create My Space'))

    expect(screen.getByText('Robin & Sasha · Duo')).toBeTruthy()
    expect(saved(storage).space).toMatchObject({ mode: 'duo', currency: 'EUR', members: [{ name: 'Robin' }, { name: 'Sasha' }] })
    expect(stat('Household Income')).toContain('—')
  })

  it('creates an empty Individual space: no income, bills, loans, accounts or goals', () => {
    const { storage } = createIndividualSpace()
    expect(screen.getByText('Robin · Individual')).toBeTruthy()
    const data = saved(storage)
    for (const list of ['income', 'bills', 'billMonths', 'debts', 'moneyAccounts', 'balances', 'goals', 'goalMovements']) expect(data[list]).toEqual([])
    expect(stat('Income')).toContain('—')
    expect(stat('Total Debt')).toContain('0,00 zł')
  })

  it('keeps what was typed when going back to Welcome and returning', async () => {
    start()
    fireEvent.click(button(/Create Account/))
    fireEvent.click(button(/Continue Without an Account/))
    type('Display Name', 'Robin')
    fireEvent.click(button('Back'))
    await waitFor(() => expect(heading(/^Create Account/)).toBeTruthy())
    fireEvent.click(button(/Continue Without an Account/))
    expect(field('Display Name').value).toBe('Robin')
  })
})

describe('Returning to the app', () => {
  it('opens straight at Home with the saved space', () => {
    const { storage } = createIndividualSpace()
    cleanup()
    start(storage)
    expect(screen.queryByRole('heading', { name: 'Your goals, your way.' })).toBeNull()
    expect(screen.getByText('Robin · Individual')).toBeTruthy()
    expect(tab('Home').getAttribute('aria-current')).toBe('page')
  })

  it('never goes back into setup after the space was created', async () => {
    createIndividualSpace()
    await browserBack()
    expect(screen.queryByRole('heading', { name: /Privacy & Terms|Your Profile/ })).toBeNull()
    expect(screen.getByText('Robin · Individual')).toBeTruthy()
  })

  it('says so when saved information cannot be opened, and blocks creating a new space until it is erased', () => {
    const storage = memoryStorage()
    storage.setItem(STORAGE_KEY, '{ broken')
    start(storage)
    expect(screen.getByRole('alert').textContent).toContain('could not be opened')
    expect((button(/Create Account/) as HTMLButtonElement).disabled).toBe(true)
    expect(storage.getItem(STORAGE_KEY)).toBe('{ broken')
    fireEvent.click(button('Erase Saved Information'))
    expect((button(/Create Account/) as HTMLButtonElement).disabled).toBe(false)
    expect(storage.getItem(STORAGE_KEY)).toBeNull()
  })

  it('warns when the browser does not save', () => {
    createIndividualSpace(memoryStorage({ failWrites: true }))
    expect(screen.getByRole('alert').textContent).toContain('did not save')
  })
})

describe('Demo', () => {
  it('opens with invented data, clearly marked', () => {
    openDemo()
    expect(screen.getByRole('note').textContent).toContain('All information is invented')
    expect(screen.getByText('Demo · Invented data')).toBeTruthy()
    expect(stat('Household Income')).toContain('11 700,35 zł')
    expect(stat('Monthly Commitments')).toContain('5571,43 zł')
    expect(stat('Monthly Left to Pay')).toContain('0,00 zł')
    expect(stat('Total Debt')).toContain('46 600,40 zł')
  })

  it('never saves, and starts fresh after Exit Demo', async () => {
    const { storage } = openDemo()
    fireEvent.click(tab('Bills'))
    fireEvent.click(button('November 2026'))
    fireEvent.click(button(/Thursday 5 November/))
    fireEvent.click(button('Furniture Loan paid in November 2026'))
    expect(stat('Left to Pay')).toContain('5300,98 zł')
    expect(storage.length).toBe(0)

    fireEvent.click(button('Exit Demo'))
    expect(heading('Your goals, your way.')).toBeTruthy()
    fireEvent.click(button('Explore the App'))
    fireEvent.click(tab('Bills'))
    fireEvent.click(button('November 2026'))
    expect(stat('Left to Pay')).toContain('5450,98 zł')
  })

  it('does not allow importing into the demo', () => {
    openDemo()
    fireEvent.click(tab('Data'))
    expect(screen.getByText(/Exit the demo to import your own data/)).toBeTruthy()
    expect(screen.queryByLabelText('Choose a JSON file')).toBeNull()
  })
})

describe('Home', () => {
  const region = (name: string) => screen.getByRole('region', { name })
  const pressed = (element: HTMLElement) => element.getAttribute('aria-pressed')
  const donutText = (name: string) => text(region(name).querySelector('.donut-core'))
  // Accessible names keep Intl's no-break spaces; match them as plain spaces.
  const named = (expected: string) => (name: string) => name.replace(/\u00a0|\u202f/g, ' ') === expected

  it('shows the six approved sections in order, with Yearly Net Income last', () => {
    openDemo()
    const main = document.querySelector('main')!
    const order = [...main.querySelectorAll('[data-screen="home"] section')].map(s => s.getAttribute('aria-label') ?? s.querySelector('h2')?.textContent)
    expect(order).toEqual(['Monthly Overview', 'Outstanding Debt', 'Monthly Bills · By Category', 'Our Money', 'Our Goals', 'Yearly Net Income'])
  })

  it('lists what is still owed on each card and loan', () => {
    openDemo()
    const debt = text(region('Outstanding Debt'))
    expect(debt).toContain('Credit Card3250,40 zł')
    expect(debt).toContain('Car Loan42 000,00 zł')
    expect(debt).toContain('Furniture Loan1350,00 zł')
  })

  it('shows bills by category, and the bills of a chosen category', () => {
    openDemo()
    expect(donutText('Monthly Bills · By Category')).toBe('TOTAL MONTHLY5571,43 zł')
    const housing = within(region('Monthly Bills · By Category')).getByRole('button', { name: /Housing/ })
    expect(text(housing)).toContain('3000,00 zł')
    fireEvent.click(housing)
    expect(pressed(housing)).toBe('true')
    expect(donutText('Monthly Bills · By Category')).toBe('Housing3000,00 zł')
    expect(text(screen.getByRole('list', { name: 'Housing bills' }))).toBe('Building Fees600,00 zł' + 'Rent2400,00 zł')
    fireEvent.click(housing)
    expect(pressed(housing)).toBe('false')
    expect(donutText('Monthly Bills · By Category')).toBe('TOTAL MONTHLY5571,43 zł')
  })

  it('follows the month and says when an amount is not known', () => {
    openDemo()
    fireEvent.click(button('November 2026'))
    const categories = region('Monthly Bills · By Category')
    expect(donutText('Monthly Bills · By Category')).toBe('TOTAL MONTHLY5450,98 zł')
    expect(within(categories).queryByRole('button', { name: /Utilities/ })).toBeNull()
    expect(within(categories).getByText('One bill has no recorded amount for this month.')).toBeTruthy()
  })

  it('shows Our Money by kind, with Investment chosen first as in v5.9', () => {
    openDemo()
    const money = region('Our Money')
    expect(pressed(within(money).getByRole('button', { name: /Investment/ }))).toBe('true')
    expect(donutText('Our Money')).toBe('Investment980,65 zł')
    fireEvent.click(within(money).getByRole('button', { name: /Daily Spending/ }))
    expect(donutText('Our Money')).toBe('Daily Spending1200,35 zł')
    expect(text(within(money).getByRole('button', { name: /Emergency Fund/ }))).toContain('300,00 zł')
  })

  it('shows the two example goals empty, the Goal Planner and the Assistant', () => {
    openDemo()
    const goals = region('Our Goals')
    expect(text(goals)).toContain('0,00 zł')
    expect(text(goals)).toContain('Saved toward 2 goals')
    expect(within(goals).getByRole('progressbar', { name: 'Trip to Japan progress' }).getAttribute('aria-valuenow')).toBe('0')
    expect(within(goals).getByRole('progressbar', { name: 'Christmas Gift progress' }).getAttribute('aria-valuenow')).toBe('0')
    expect(within(goals).getByText('Coming soon')).toBeTruthy()
    fireEvent.click(within(goals).getByRole('button', { name: /Goal Planner/ }))
    expect(section('planner')!.hidden).toBe(false)
  })

  it('starts Yearly Net Income closed, with the household total', () => {
    openDemo()
    const income = region('Yearly Net Income')
    const details = within(income).getByRole('button', { name: /Details/ })
    expect(details.getAttribute('aria-expanded')).toBe('false')
    expect(text(income)).toContain('117 003,00 zł')
    expect(text(income)).toContain('Household · Net received')
    expect(text(income)).toContain('10 / 12 months')
    expect(within(income).queryByRole('button', { name: /July 2026/ })).toBeNull()
  })

  it('opens Details with each person and blue and green stacked bars for Household', () => {
    openDemo()
    const income = region('Yearly Net Income')
    fireEvent.click(within(income).getByRole('button', { name: /Details/ }))
    expect(within(income).getByRole('button', { name: /Less/ }).getAttribute('aria-expanded')).toBe('true')
    const owners = within(income).getByRole('group', { name: 'Show income for' })
    expect(within(owners).getAllByRole('button').map(b => text(b))).toEqual(['Alex53 002,00 zł', 'Jordan64 001,00 zł', 'Household117 003,00 zł'])
    expect(pressed(within(owners).getByRole('button', { name: /Household/ }))).toBe('true')

    const july = within(income).getByRole('button', { name: named('July 2026, 14 500,60 zł') })
    const parts = [...july.querySelectorAll<HTMLElement>('.stack > span')]
    expect(parts.map(p => [p.style.background, p.style.width])).toEqual([['rgb(59, 130, 246)', '37.24%'], ['rgb(16, 185, 129)', '62.76%']])
    expect(within(income).getByRole('button', { name: named('November 2026, nothing recorded') })).toBeTruthy()

    fireEvent.click(july)
    expect(text(income)).toContain('Alex: 5400,50 zł')
    expect(text(income)).toContain('Jordan: 9100,10 zł')
  })

  it('shows one person with a single bar, and closes back to Household', () => {
    openDemo()
    const income = region('Yearly Net Income')
    fireEvent.click(within(income).getByRole('button', { name: /Details/ }))
    fireEvent.click(within(income).getByRole('button', { name: /^Alex/ }))
    expect(text(income)).toContain('Alex · Net received')
    const july = within(income).getByRole('button', { name: named('July 2026, 5400,50 zł') })
    expect([...july.querySelectorAll<HTMLElement>('.stack > span')].map(p => p.style.background)).toEqual(['rgb(59, 130, 246)'])

    fireEvent.click(within(income).getByRole('button', { name: /Less/ }))
    expect(text(income)).toContain('Household · Net received')
    fireEvent.click(within(income).getByRole('button', { name: /Details/ }))
    expect(pressed(within(income).getByRole('button', { name: /Household/ }))).toBe('true')
  })

  it('follows changes made in Bills', () => {
    openDemo()
    fireEvent.click(tab('Bills'))
    fireEvent.click(button('November 2026'))
    fireEvent.click(button(/Sunday 22 November/))
    fireEvent.click(button('Change Amount for November 2026'))
    type('Amount for November 2026 (PLN)', '90')
    fireEvent.click(button('Save'))
    fireEvent.click(tab('Home'))
    const categories = region('Monthly Bills · By Category')
    expect(text(within(categories).getByRole('button', { name: /Utilities/ }))).toContain('90,00 zł')
    expect(within(categories).queryByText(/no recorded amount/)).toBeNull()
    expect(donutText('Monthly Bills · By Category')).toBe('TOTAL MONTHLY5540,98 zł')
  })

  it('starts empty in your own space, with no invented numbers', () => {
    createIndividualSpace()
    expect(text(region('Outstanding Debt'))).toContain('No cards or loans yet.')
    expect(text(region('Monthly Bills · By Category'))).toContain('No bills for October 2026.')
    expect(text(region('My Money'))).toContain('No accounts yet.')
    expect(text(region('My Goals'))).toContain('No goals yet.')
    const income = region('Yearly Net Income')
    expect(text(income)).toContain('0,00 zł')
    expect(text(income)).toContain('Robin · Net received')
    expect(text(income)).toContain('0 / 12 months')
    fireEvent.click(within(income).getByRole('button', { name: /Details/ }))
    expect(within(income).queryByRole('group', { name: 'Show income for' })).toBeNull()
  })
})

describe('Goals & Savings Pots', () => {
  const region = (name: string) => screen.getByRole('region', { name })
  const goalNames = () => [...document.querySelectorAll('[data-screen="goals"] .goal-card .line b')].map(b => b.textContent)
  const openGoals = () => { fireEvent.click(within(region('Our Goals')).getByRole('button', { name: /View All/ })) }
  const openDemoGoal = (name: string) => { openDemo(); openGoals(); fireEvent.click(button(new RegExp(`^${name}`))) }
  const saveMovement = (kind: 'Add' | 'Withdraw', amount: string, note = '') => {
    fireEvent.click(within(screen.getByRole('group', { name: 'Type of change' })).getByRole('button', { name: kind }))
    type(/^Amount/, amount)
    if (note) type('Note (optional)', note)
    fireEvent.click(button(kind === 'Add' ? 'Save Contribution' : 'Save Withdrawal'))
  }

  it('opens from View All on Home, without a sixth tab', () => {
    openDemo()
    openGoals()
    expect(heading('Our Goals')).toBeTruthy()
    expect(screen.queryByRole('navigation', { name: 'Main navigation' })).toBeNull()
    expect(stat('Saved in Goals')).toContain('0,00 zł')
    expect(stat('Total Targets')).toContain('20 500,00 zł')
    expect(goalNames()).toEqual(['Trip to Japan', 'Christmas Gift'])
    expect(text(button(/^Trip to Japan/))).toContain('No deadline')
    expect(text(button(/^Christmas Gift/))).toContain('25 Dec 2026')
    expect(text(button(/^Christmas Gift/))).toContain('500,00 zł to go')
  })

  it('filters All, Flexible and With Date', () => {
    openDemo()
    openGoals()
    const filters = screen.getByRole('group', { name: 'Show goals' })
    fireEvent.click(within(filters).getByRole('button', { name: 'Flexible' }))
    expect(goalNames()).toEqual(['Trip to Japan'])
    fireEvent.click(within(filters).getByRole('button', { name: 'With Date' }))
    expect(goalNames()).toEqual(['Christmas Gift'])
    expect(within(filters).getByRole('button', { name: 'With Date' }).getAttribute('aria-pressed')).toBe('true')
    fireEvent.click(within(filters).getByRole('button', { name: 'All' }))
    expect(goalNames()).toEqual(['Trip to Japan', 'Christmas Gift'])
  })

  it('opens a goal straight from its row on Home', () => {
    openDemo()
    fireEvent.click(within(region('Our Goals')).getByRole('button', { name: /^Christmas Gift/ }))
    expect(heading('Christmas Gift')).toBeTruthy()
  })

  it('creates a flexible goal only after the confirmation, starting at 0', async () => {
    openDemo()
    openGoals()
    fireEvent.click(button(/New Goal/))
    expect(heading('Create a Goal')).toBeTruthy()
    fireEvent.click(button('Review Goal'))
    expect(screen.getByText('Enter a name for your goal.')).toBeTruthy()
    expect(screen.getByText('Enter an amount above 0, such as 500 or 1250.50.')).toBeTruthy()

    type('What are you saving for?', 'New Bike')
    type(/^Target Amount/, '1200')
    expect(screen.queryByLabelText('Target Date')).toBeNull()
    fireEvent.click(button('Review Goal'))
    expect(heading('Check Your Goal')).toBeTruthy()
    expect(text(document.querySelector('[data-screen="new-goal"] .fact-rows'))).toContain('No deadline (Flexible)')
    expect(screen.queryByRole('heading', { name: 'To Reach Your Goal' })).toBeNull()

    // Edit keeps what was typed.
    fireEvent.click(within(document.querySelector<HTMLElement>('.inline-actions')!).getByRole('button', { name: 'Edit' }))
    expect(field('What are you saving for?').value).toBe('New Bike')
    fireEvent.click(button('Review Goal'))
    fireEvent.click(button('Create Goal'))

    expect(heading('New Bike')).toBeTruthy()
    expect(text(region('Progress'))).toContain('0,00 zł')
    expect(text(region('Progress'))).toContain('1200,00 zł still needed')
    expect(screen.getByText('No contributions yet.')).toBeTruthy()

    await browserBack()
    await waitFor(() => expect(heading('Our Goals')).toBeTruthy())
    expect(goalNames()).toEqual(['Trip to Japan', 'Christmas Gift', 'New Bike'])
  })

  it('creates a goal with a date after today, and shows the suggested pace before saving', () => {
    openDemo()
    openGoals()
    fireEvent.click(button(/New Goal/))
    type('What are you saving for?', 'Concert')
    type(/^Target Amount/, '300')
    fireEvent.change(field('Deadline'), { target: { value: 'dated' } })
    fireEvent.click(button('Review Goal'))
    expect(screen.getByText('Choose a target date.')).toBeTruthy()
    type('Target Date', '2026-10-23')
    fireEvent.click(button('Review Goal'))
    expect(screen.getByText('Choose a date after today.')).toBeTruthy()
    type('Target Date', '2026-12-23')
    fireEvent.click(button('Review Goal'))
    expect(heading('To Reach Your Goal')).toBeTruthy()
    expect(screen.getByText('Suggestions, not payments. Nothing is paid automatically.')).toBeTruthy()
    fireEvent.click(button('Create Goal'))
    expect(screen.getByText(/Target date: 23 Dec 2026 · 61 days left/)).toBeTruthy()
  })

  it('saves nothing when the form is left, and keeps the draft for later', async () => {
    openDemo()
    openGoals()
    fireEvent.click(button(/New Goal/))
    type('What are you saving for?', 'Half done')
    fireEvent.click(button(/All Goals/))
    await waitFor(() => expect(goalNames()).toEqual(['Trip to Japan', 'Christmas Gift']))
    fireEvent.click(button(/New Goal/))
    expect(field('What are you saving for?').value).toBe('Half done')
  })

  it('suggests a weekly or monthly amount for a goal with a date, and nothing for a flexible one', async () => {
    openDemoGoal('Christmas Gift')
    expect(screen.getByText('Target date: 25 Dec 2026 · 63 days left')).toBeTruthy()
    const pace = region('To Reach Your Goal')
    expect(text(pace)).toContain('55,56 zł per week for 9 weeks')
    expect(text(pace)).toContain('250,00 zł per month for 2 months')
    expect(text(pace)).toContain('Suggestions, not payments')

    fireEvent.click(button(/All Goals/))
    await waitFor(() => expect(heading('Our Goals')).toBeTruthy())
    fireEvent.click(button(/^Trip to Japan/))
    expect(screen.getByText('No deadline · Flexible')).toBeTruthy()
    expect(screen.queryByRole('heading', { name: 'To Reach Your Goal' })).toBeNull()
  })

  it('adds a contribution with a note, without changing Our Money', async () => {
    openDemo()
    const moneyBefore = text(region('Our Money'))
    openGoals()
    fireEvent.click(button(/^Trip to Japan/))
    saveMovement('Add', '100', 'First savings')
    expect(text(screen.getByRole('status'))).toBe('Contribution of 100,00 zł saved.')
    expect(text(region('Progress'))).toContain('100,00 zł')
    expect(text(region('Progress'))).toContain('19 900,00 zł still needed')
    expect(text(region('Savings Activity'))).toBe('Savings Activity23 Oct 2026 · First savings+100,00 zł')

    fireEvent.click(button(/All Goals/))
    await waitFor(() => expect(stat('Saved in Goals')).toContain('100,00 zł'))
    fireEvent.click(button(/Home/))
    await waitFor(() => expect(text(region('Our Money'))).toBe(moneyBefore))
    expect(text(region('Our Goals'))).toContain('100,00 zł')
  })

  it('never withdraws more than is saved, and lists the newest change first', () => {
    openDemoGoal('Trip to Japan')
    saveMovement('Add', '100')
    saveMovement('Withdraw', '150')
    expect(screen.getByText('You can withdraw up to 100,00 zł, what is saved in this goal.', { normalizer: s => s.replace(/\u00a0|\u202f/g, ' ') })).toBeTruthy()
    expect(text(region('Progress'))).toContain('100,00 zł')
    saveMovement('Withdraw', '40', 'Train tickets')
    expect(text(region('Progress'))).toContain('60,00 zł')
    const rows = [...region('Savings Activity').querySelectorAll('li')].map(li => text(li))
    expect(rows).toEqual(['23 Oct 2026 · Train tickets−40,00 zł', '23 Oct 2026+100,00 zł'])
  })

  it('checks the amount and the date of a change', () => {
    openDemoGoal('Trip to Japan')
    fireEvent.click(button('Save Contribution'))
    expect(screen.getByText('Enter an amount above 0, such as 100 or 25.50.')).toBeTruthy()
    type(/^Amount/, '10')
    type('Date', '2026-10-24')
    fireEvent.click(button('Save Contribution'))
    expect(screen.getByText('The date can’t be after today.')).toBeTruthy()
    type('Date', '2026-10-01')
    fireEvent.click(button('Save Contribution'))
    expect(text(region('Savings Activity'))).toContain('1 Oct 2026+10,00 zł')
  })

  it('edits the name, target and date, and Cancel changes nothing', () => {
    openDemoGoal('Trip to Japan')
    fireEvent.click(button('Change Name, Target or Date'))
    type('What are you saving for?', 'Changed')
    fireEvent.click(button('Cancel'))
    expect(heading('Trip to Japan')).toBeTruthy()

    fireEvent.click(button('Change Name, Target or Date'))
    type('What are you saving for?', 'Japan Trip')
    type(/^Target Amount/, '18000')
    fireEvent.change(field('Deadline'), { target: { value: 'dated' } })
    type('Target Date', '2027-10-01')
    fireEvent.click(button('Save Changes'))
    expect(heading('Japan Trip')).toBeTruthy()
    expect(screen.getByText(/Target date: 1 Oct 2027/)).toBeTruthy()
    expect(text(region('Progress'))).toContain('18 000,00 zł still needed')
    expect(heading('To Reach Your Goal')).toBeTruthy()

    // The date stays optional: it can be removed again.
    fireEvent.click(button('Change Name, Target or Date'))
    fireEvent.change(field('Deadline'), { target: { value: 'flexible' } })
    fireEvent.click(button('Save Changes'))
    expect(screen.getByText('No deadline · Flexible')).toBeTruthy()
  })

  it('deletes a goal and its history only after confirming', async () => {
    openDemoGoal('Christmas Gift')
    saveMovement('Add', '50')
    fireEvent.click(button('Delete Goal'))
    expect(screen.getByRole('alert').textContent).toContain('Delete “Christmas Gift” and its 1 entry?')
    fireEvent.click(button('Keep Goal'))
    expect(screen.queryByRole('alert')).toBeNull()

    fireEvent.click(button('Delete Goal'))
    fireEvent.click(within(screen.getByRole('alert')).getByRole('button', { name: 'Delete Goal' }))
    await waitFor(() => expect(heading('Our Goals')).toBeTruthy())
    expect(goalNames()).toEqual(['Trip to Japan'])
    expect(stat('Saved in Goals')).toContain('0,00 zł')
    fireEvent.click(button(/Home/))
    await waitFor(() => expect(text(region('Our Goals'))).toContain('Saved toward 1 goal'))
  })

  it('starts empty in your own space, and keeps a new goal after reopening the app', () => {
    const storage = memoryStorage()
    createIndividualSpace(storage)
    expect(text(region('My Goals'))).toContain('No goals yet.')
    fireEvent.click(within(region('My Goals')).getByRole('button', { name: /View All/ }))
    expect(screen.getByText('No goals yet.')).toBeTruthy()
    fireEvent.click(button(/New Goal/))
    type('What are you saving for?', 'Laptop')
    type(/^Target Amount/, '4000')
    fireEvent.click(button('Review Goal'))
    fireEvent.click(button('Create Goal'))
    saveMovement('Add', '250')
    expect(saved(storage).goals).toMatchObject([{ name: 'Laptop', target: 400_000, deadline: null, owner: 'member-1', status: 'active' }])
    expect(saved(storage).goalMovements).toMatchObject([{ amount: 25_000, date: TODAY }])

    cleanup()
    start(storage)
    expect(text(region('My Goals'))).toContain('250,00 zł')
    expect(text(region('My Goals'))).toContain('Saved toward 1 goal')
  })

  it('never saves demo goals', () => {
    const { storage } = openDemo()
    openGoals()
    fireEvent.click(button(/^Trip to Japan/))
    saveMovement('Add', '100')
    expect(storage.length).toBe(0)
  })
})

describe('Tab bar', () => {
  it('has the five approved tabs in order, and marks the current one', () => {
    openDemo()
    const nav = screen.getByRole('navigation', { name: 'Main navigation' })
    expect(within(nav).getAllByRole('button').map(b => b.textContent)).toEqual(['Home', 'Bills', 'Cards', 'History', 'Data'])
    expect(tab('Home').getAttribute('aria-current')).toBe('page')
    fireEvent.click(tab('History'))
    expect(heading('Financial History')).toBeTruthy()
    expect(tab('History').getAttribute('aria-current')).toBe('page')
    expect(tab('Home').getAttribute('aria-current')).toBeNull()
  })

  it('is hidden in Settings and in the Goal Planner', async () => {
    openDemo()
    fireEvent.click(button('Settings'))
    expect(heading('Settings')).toBeTruthy()
    expect(screen.queryByRole('navigation', { name: 'Main navigation' })).toBeNull()
    fireEvent.click(button('Back'))
    await waitFor(() => expect(tab('Home')).toBeTruthy())
    fireEvent.click(button(/Goal Planner/))
    expect(screen.queryByRole('navigation', { name: 'Main navigation' })).toBeNull()
  })
})

describe('Monthly Bills', () => {
  it('shows October totals with every date closed', () => {
    openDemo()
    fireEvent.click(tab('Bills'))
    expect(heading('Monthly Bills')).toBeTruthy()
    expect(stat('Monthly Total')).toContain('5571,43 zł')
    expect(stat('Left to Pay')).toContain('0,00 zł')
    const dates = screen.getAllByRole('button', { expanded: false })
    expect(dates).toHaveLength(8)
    expect(screen.queryByRole('button', { expanded: true })).toBeNull()
    expect(text(dates[1])).toContain('Wednesday')
    expect(text(dates[1])).toContain('2 payments due')
    expect(text(dates[1])).toContain('330,00 zł')
  })

  it('opens one date at a time', () => {
    openDemo()
    fireEvent.click(tab('Bills'))
    fireEvent.click(button(/Monday 5 October/))
    expect(screen.getByText('Furniture Loan')).toBeTruthy()
    fireEvent.click(button(/Wednesday 7 October/))
    expect(screen.queryByText('Furniture Loan')).toBeNull()
    expect(screen.getByText('Bank Plan')).toBeTruthy()
    expect(screen.getByText('Language Course')).toBeTruthy()
    expect(screen.getAllByRole('button', { expanded: true })).toHaveLength(1)
    fireEvent.click(button(/Wednesday 7 October/))
    expect(screen.queryByRole('button', { expanded: true })).toBeNull()
  })

  it('closes the open date when the month changes', () => {
    openDemo()
    fireEvent.click(tab('Bills'))
    fireEvent.click(button(/Monday 5 October/))
    fireEvent.click(button('November 2026'))
    expect(screen.queryByRole('button', { expanded: true })).toBeNull()
    expect(button('November 2026').getAttribute('aria-pressed')).toBe('true')
  })

  it('shows an unknown amount as needed, never as a number', () => {
    openDemo()
    fireEvent.click(tab('Bills'))
    fireEvent.click(button('November 2026'))
    expect(screen.getByText('1 bill amount needs to be entered.')).toBeTruthy()
    expect(stat('Monthly Total')).toContain('5450,98 zł')
    expect(stat('Left to Pay')).toContain('+ unknown amount')
    fireEvent.click(button(/Sunday 22 November/))
    const phone = screen.getByText('Phone & Internet').closest('.bill-item')!
    expect(phone.textContent).toContain('Amount needed')
  })

  it('marks one month paid without changing another month', () => {
    openDemo()
    fireEvent.click(tab('Bills'))
    fireEvent.click(button('November 2026'))
    fireEvent.click(button(/Saturday 10 October|Tuesday 10 November/))
    const rent = button('Rent paid in November 2026')
    expect(rent.getAttribute('aria-pressed')).toBe('false')
    fireEvent.click(rent)
    expect(button('Rent paid in November 2026').getAttribute('aria-pressed')).toBe('true')
    expect(stat('Left to Pay')).toContain('3050,98 zł')

    fireEvent.click(button('October 2026'))
    fireEvent.click(button(/Saturday 10 October/))
    expect(button('Rent paid in October 2026').getAttribute('aria-pressed')).toBe('true')
    expect(stat('Left to Pay')).toContain('0,00 zł')
  })

  it('records an amount for one month and updates the totals and Home', () => {
    openDemo()
    fireEvent.click(tab('Bills'))
    fireEvent.click(button('November 2026'))
    fireEvent.click(button(/Sunday 22 November/))
    fireEvent.click(button('Change Amount for November 2026'))
    type('Amount for November 2026 (PLN)', 'abc')
    fireEvent.click(button('Save'))
    expect(screen.getByText('Enter an amount such as 120.45.')).toBeTruthy()
    type('Amount for November 2026 (PLN)', '130,55')
    fireEvent.click(button('Save'))
    expect(stat('Monthly Total')).toContain('5581,53 zł')
    expect(screen.queryByText('1 bill amount needs to be entered.')).toBeNull()

    fireEvent.click(tab('Home'))
    fireEvent.click(button('November 2026'))
    expect(stat('Monthly Commitments')).toContain('5581,53 zł')
    expect(stat('Total Debt')).toContain('46 600,40 zł')
  })

  it('shows an empty state in a new space', () => {
    createIndividualSpace()
    fireEvent.click(tab('Bills'))
    expect(screen.getByText('No bills for October 2026.')).toBeTruthy()
  })
})

describe('Keeping information between screens', () => {
  it('keeps loans and calculator results in Cards after visiting other tabs', async () => {
    createIndividualSpace()
    fireEvent.click(tab('Cards'))
    expect(heading('Cards & Loans')).toBeTruthy()
    type('Monthly Income (PLN)', '5000')
    fireEvent.click(button('+ Add'))
    type('Name (optional)', 'Test loan')
    type('Remaining Balance (PLN)', '12000')
    type('Yearly Interest (%)', '12')
    type('Monthly Payment (PLN)', '1000')
    type('Extra Each Month (PLN)', '200')
    expect(screen.getByText('Months Saved').nextElementSibling!.textContent).toBe('2')

    fireEvent.click(tab('Bills'))
    fireEvent.click(tab('Home'))
    fireEvent.click(button(/Goal Planner/))
    await browserBack()
    fireEvent.click(tab('Cards'))

    expect(field('Monthly Income (PLN)').value).toBe('5000')
    expect(field('Name (optional)').value).toBe('Test loan')
    expect(field('Extra Each Month (PLN)').value).toBe('200')
    expect(screen.getByText('Months Saved').nextElementSibling!.textContent).toBe('2')
  })

  it('keeps typed goal values and the evaluated result after visiting other tabs', async () => {
    createIndividualSpace()
    fireEvent.click(button(/Goal Planner/))
    type('Goal name', 'Holiday fund')
    type('Target amount (PLN)', '12000')
    fireEvent.click(button('Evaluate goal'))
    const result = screen.getByRole('heading', { level: 2, name: /^(Plan|Goal|Monthly)/ }).textContent

    fireEvent.click(button('Home'))
    await waitFor(() => expect(tab('Home')).toBeTruthy())
    fireEvent.click(tab('Cards'))
    fireEvent.click(tab('Home'))
    fireEvent.click(button(/Goal Planner/))

    expect(field('Goal name').value).toBe('Holiday fund')
    expect(field('Target amount (PLN)').value).toBe('12000')
    expect(screen.getByRole('heading', { level: 2, name: /^(Plan|Goal|Monthly)/ }).textContent).toBe(result)
  })

  it('never creates a goal by itself, and shows a planned goal only after Confirm', async () => {
    createIndividualSpace()
    fireEvent.click(button(/Goal Planner/))
    type('Goal name', 'Holiday fund')
    fireEvent.click(button('Evaluate goal'))
    fireEvent.click(button('Review goal'))

    // Leaving at Review creates nothing.
    fireEvent.click(button('Home'))
    await waitFor(() => expect(tab('Home')).toBeTruthy())
    expect(screen.queryByRole('button', { name: /Holiday fund/ })).toBeNull()

    fireEvent.click(button(/Goal Planner/))
    fireEvent.click(button('Confirm goal'))
    fireEvent.click(button('Home'))
    await waitFor(() => expect(tab('Home')).toBeTruthy())
    // It appears in Our Goals, and opens the Goal Planner again.
    const goals = screen.getByRole('region', { name: 'My Goals' })
    const goal = within(goals).getByRole('button', { name: /Planned goal.*Holiday fund/ })
    expect(within(goal).getByRole('progressbar', { name: 'Holiday fund progress' })).toBeTruthy()
    fireEvent.click(goal)
    await waitFor(() => expect(section('planner')!.hidden).toBe(false))
  })

  it('shows the Assistant as coming soon, with nothing to press', () => {
    createIndividualSpace()
    expect(screen.getByText('Assistant').parentElement!.textContent).toContain('Coming soon')
    expect(screen.queryByRole('button', { name: /Assistant/ })).toBeNull()
  })
})

describe('Hidden sections', () => {
  it('are hidden from the keyboard and screen readers', () => {
    createIndividualSpace()
    fireEvent.click(tab('Cards'))
    fireEvent.click(button('+ Add'))
    // The goal planner is on the page but hidden: none of its controls are exposed.
    expect(section('planner')!.hidden).toBe(true)
    expect(screen.queryByRole('button', { name: 'Evaluate goal' })).toBeNull()
    expect(screen.queryByRole('textbox', { name: 'Goal name' })).toBeNull()
  })
})

describe('Back navigation', () => {
  it('goes back one screen at a time with the browser back button', async () => {
    openDemo()
    fireEvent.click(tab('Bills'))
    fireEvent.click(tab('Cards'))
    await browserBack()
    expect(heading('Monthly Bills')).toBeTruthy()
    await browserBack()
    expect(tab('Home').getAttribute('aria-current')).toBe('page')
  })

  it('goes back from Create Account to Welcome with the Back link', async () => {
    start()
    fireEvent.click(button(/Create Account/))
    fireEvent.click(button('Back'))
    await waitFor(() => expect(heading('Your goals, your way.')).toBeTruthy())
  })

  it('slides the matching way for forward and back moves', async () => {
    const { container } = start()
    const shell = container.querySelector('.shell')!
    fireEvent.click(button('Log In'))
    expect(shell.getAttribute('data-direction')).toBe('forward')
    await browserBack()
    expect(shell.getAttribute('data-direction')).toBe('back')
  })
})

describe('Focus', () => {
  it('moves to the new screen title after each move', async () => {
    start()
    fireEvent.click(button(/Create Account/))
    expect(document.activeElement).toBe(heading(/^Create Account/))
    fireEvent.click(button(/Continue Without an Account/))
    expect(document.activeElement).toBe(heading('Your Profile'))
    fireEvent.click(button('Back'))
    await waitFor(() => expect(document.activeElement).toBe(heading(/^Create Account/)))
  })

  it('moves to each tab title', () => {
    openDemo()
    fireEvent.click(tab('Bills'))
    expect(document.activeElement).toBe(heading('Monthly Bills'))
    fireEvent.click(tab('Data'))
    expect(document.activeElement).toBe(heading('Manage Your Data'))
  })
})

describe('Settings', () => {
  it('changes the appearance and keeps it', () => {
    const { storage } = createIndividualSpace()
    expect(document.documentElement.dataset.theme).toBe('system')
    fireEvent.click(button('Settings'))
    fireEvent.change(field('Appearance'), { target: { value: 'dark' } })
    expect(document.documentElement.dataset.theme).toBe('dark')
    expect(saved(storage).preferences.theme).toBe('dark')
  })

  it('erases everything only after confirming', () => {
    const { storage } = createIndividualSpace()
    fireEvent.click(button('Settings'))
    fireEvent.click(button('Erase All Data on This Device'))
    fireEvent.click(button('Cancel'))
    expect(storage.getItem(STORAGE_KEY)).not.toBeNull()
    fireEvent.click(button('Erase All Data on This Device'))
    fireEvent.click(button('Erase Everything'))
    expect(storage.getItem(STORAGE_KEY)).toBeNull()
    expect(heading('Your goals, your way.')).toBeTruthy()
  })

  it('offers Exit Demo instead of erasing in the demo', () => {
    openDemo()
    fireEvent.click(button('Settings'))
    expect(screen.queryByRole('button', { name: 'Erase All Data on This Device' })).toBeNull()
    fireEvent.click(screen.getAllByRole('button', { name: 'Exit Demo' }).at(-1)!)
    expect(heading('Your goals, your way.')).toBeTruthy()
  })
})

describe('Data', () => {
  const upload = async (content: string) => {
    const input = field('Choose a JSON file')
    await act(async () => {
      fireEvent.change(input, { target: { files: [new File([content], 'data.json', { type: 'application/json' })] } })
      await new Promise(resolve => setTimeout(resolve, 20))
    })
  }

  it('replaces the own space with a checked file only after confirming', async () => {
    const { storage } = createIndividualSpace()
    const other = { ...saved(storage), space: { ...saved(storage).space, name: 'Imported', members: [{ id: 'member-1', name: 'Imported', color: '#3B82F6' }] } }
    fireEvent.click(tab('Data'))
    await upload(JSON.stringify(other))
    expect(screen.getByRole('alert').textContent).toContain('Replace everything in this space with “Imported”')
    expect(saved(storage).space.name).toBe('Robin')
    fireEvent.click(button('Replace'))
    expect(saved(storage).space.name).toBe('Imported')
    expect(screen.getByText('Imported · Individual')).toBeTruthy()
  })

  it('refuses a broken file and changes nothing', async () => {
    const { storage } = createIndividualSpace()
    fireEvent.click(tab('Data'))
    await upload('{ "schemaVersion": 1 }')
    expect(screen.getByRole('alert').textContent).toContain('This file cannot be used. Nothing was changed.')
    expect(saved(storage).space.name).toBe('Robin')
  })
})
