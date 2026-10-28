// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { STORAGE_KEY } from './data/localStore'
import { createDemoHousehold, DEMO_TODAY } from './data/fixtures/demoHousehold'
import { memoryStorage } from './test/memoryStorage'

// Invented example values and a fixed date. The demos have their own date (23 Oct 2026).
// These tests use the invented Duo household (Alex & Jordan) to keep covering the
// Duo screens; the public Alex demo has its own tests in AlexDemo.test.tsx.
const TODAY = '2026-10-21'

afterEach(() => { cleanup(); document.documentElement.removeAttribute('data-theme') })

const button = (name: string | RegExp) => screen.getByRole('button', { name })
const heading = (name: string | RegExp) => screen.getByRole('heading', { name })
const field = (label: string | RegExp) => screen.getByLabelText(label) as HTMLInputElement
const type = (label: string | RegExp, value: string) => fireEvent.change(field(label), { target: { value } })
const section = (name: 'emergency' | 'cards') => document.querySelector<HTMLElement>(`[data-screen="${name}"]`)
const tab = (name: string) => within(screen.getByRole('navigation', { name: 'Main navigation' })).getByRole('button', { name })
// Intl writes amounts with no-break spaces; compare them as plain spaces.
const text = (element: Element | null) => (element?.textContent ?? '').replace(/\u00a0|\u202f/g, ' ')
const stat = (label: string) => text(screen.getByText(label).parentElement)
const monthSelect = () => screen.getByRole('combobox', { name: 'Month' }) as HTMLSelectElement
const pickMonth = (month: string) => fireEvent.change(monthSelect(), { target: { value: month } })

const householdDemo = () => ({ data: createDemoHousehold(), today: DEMO_TODAY })

function start(storage: Storage = memoryStorage()) {
  return { storage, ...render(<App getToday={() => TODAY} storage={storage} createDemo={householdDemo} />) }
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

/** Opens the demo on Home. Most tests look inside the Home blocks, so they open all of them (Expand All). */
function openDemo({ expanded = true } = {}) {
  const result = start()
  fireEvent.click(button('Explore the App'))
  if (expanded) fireEvent.click(button('Expand All'))
  return result
}

const expandAll = () => fireEvent.click(button('Expand All'))
/** Bills opens on Calendar; its List keeps the Paid / Pending and Change Amount buttons of each bill. */
const showBillsList = () => fireEvent.click(within(screen.getByRole('group', { name: 'View' })).getByRole('button', { name: 'List' }))

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

  it('shows no tabs, goals or calculator before a space is open', () => {
    start()
    expect(screen.queryByRole('navigation', { name: 'Main navigation' })).toBeNull()
    expect(section('emergency')).toBeNull()
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
    expect(stat('Income')).toContain('—')
  })

  it('creates an empty Individual space: no income, bills, loans, accounts or goals', () => {
    const { storage } = createIndividualSpace()
    expect(screen.getByText('Robin · Individual')).toBeTruthy()
    const data = saved(storage)
    for (const list of ['income', 'bills', 'billMonths', 'debts', 'moneyAccounts', 'balances', 'goals', 'goalMovements']) expect(data[list]).toEqual([])
    expect(stat('Income')).toContain('—')
    expect(text(screen.getByRole('region', { name: 'Total Debt' }))).toContain('0,00 zł')
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
    expect(stat('Income')).toContain('11 700,35 zł')
    expect(stat('Planned Bills')).toContain('5571,43 zł')
    expect(text(screen.getByRole('region', { name: 'Left to Pay' }))).toContain('0,00 zł')
    expect(text(screen.getByRole('region', { name: 'Left to Pay' }))).toContain('All your October bills are paid.')
    expect(text(screen.getByRole('region', { name: 'Total Debt' }))).toContain('46 600,40 zł')
  })

  it('never saves, and starts fresh after Exit Demo', async () => {
    const { storage } = openDemo()
    fireEvent.click(tab('Bills'))
    pickMonth('2026-11')
    showBillsList()
    fireEvent.click(button('Furniture Loan paid in November 2026'))
    expect(stat('Left to Pay')).toContain('5300,98 zł')
    expect(storage.length).toBe(0)

    fireEvent.click(button('Exit Demo'))
    expect(heading('Your goals, your way.')).toBeTruthy()
    fireEvent.click(button('Explore the App'))
    fireEvent.click(tab('Bills'))
    pickMonth('2026-11')
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
  const planned = () => fireEvent.click(within(region('Spending by Category')).getByRole('button', { name: 'Planned' }))

  it('answers its questions in order, with the Year Summary last', () => {
    openDemo()
    const main = document.querySelector('main')!
    const order = [...main.querySelectorAll('[data-screen="home"] section')].map(s => s.getAttribute('aria-label') ?? s.querySelector('.block-name')?.textContent)
    expect(order).toEqual(['This Month', 'Left to Pay', 'Spending by Category', 'Total Debt', 'Our Money', 'Our Goals', 'Year Summary'])
    expect(screen.queryByRole('region', { name: 'Plan Another Goal' })).toBeNull()
  })

  it('moves through the twelve months of the year with the month picker', () => {
    openDemo()
    expect(monthSelect().value).toBe('2026-10')
    expect([...monthSelect().options].map(o => o.value)).toEqual(['2026-01', '2026-02', '2026-03', '2026-04', '2026-05', '2026-06', '2026-07', '2026-08', '2026-09', '2026-10', '2026-11', '2026-12'])
    fireEvent.click(button('Previous month'))
    expect(monthSelect().value).toBe('2026-09')
    fireEvent.click(button('Next month'))
    fireEvent.click(button('Next month'))
    expect(monthSelect().value).toBe('2026-11')
    pickMonth('2026-12')
    expect((button('Next month') as HTMLButtonElement).disabled).toBe(true)
  })

  it('lists what is still owed on each card and loan inside Total Debt', () => {
    openDemo()
    const debt = text(region('Total Debt'))
    expect(debt).toContain('Credit CardAs of 23 Oct 20263250,40 zł')
    expect(debt).toContain('Car LoanAs of 23 Oct 202642 000,00 zł')
    expect(debt).toContain('Furniture LoanAs of 23 Oct 20261350,00 zł')
  })

  it('shows planned bills by category, and the bills of a chosen category', () => {
    openDemo()
    planned()
    expect(donutText('Spending by Category')).toBe('TOTAL PLANNED5571,43 zł')
    const housing = within(region('Spending by Category')).getByRole('button', { name: /Housing/ })
    expect(text(housing)).toContain('3000,00 zł')
    fireEvent.click(housing)
    expect(pressed(housing)).toBe('true')
    expect(donutText('Spending by Category')).toBe('Housing3000,00 zł')
    const housingBills = [...screen.getByRole('list', { name: 'Housing bills' }).querySelectorAll('li')].map(li => text(li.querySelector('.line')))
    expect(housingBills).toEqual(['Building FeesPaid600,00 zł', 'RentPaid2400,00 zł'])
    fireEvent.click(housing)
    expect(pressed(housing)).toBe('false')
    expect(donutText('Spending by Category')).toBe('TOTAL PLANNED5571,43 zł')
  })

  it('shows what was spent: paid bills count once, debt payments only as interest', () => {
    openDemo()
    const spending = region('Spending by Category')
    expect(pressed(within(spending).getByRole('button', { name: 'Spent' }))).toBe('true')
    expect(text(spending)).toContain('Spent in October 2026')
    // Loan and card payments pay debt back: they are not in Spent.
    expect(within(spending).queryByRole('button', { name: /^Loans/ })).toBeNull()
  })

  it('follows the month and says when an amount is not known', () => {
    openDemo()
    pickMonth('2026-11')
    planned()
    const categories = region('Spending by Category')
    expect(donutText('Spending by Category')).toBe('TOTAL PLANNED5450,98 zł')
    expect(within(categories).queryByRole('button', { name: /Utilities/ })).toBeNull()
    expect(within(categories).getByText('One bill has no amount for this month yet, so it is not in the chart.')).toBeTruthy()
  })

  it('shows Our Money by kind, with Investments chosen first as in v5.9', () => {
    openDemo()
    const money = region('Our Money')
    expect(pressed(within(money).getByRole('button', { name: /Investments/ }))).toBe('true')
    expect(donutText('Our Money')).toBe('Investments980,65 zł')
    fireEvent.click(within(money).getByRole('button', { name: /Daily Spending/ }))
    expect(donutText('Our Money')).toBe('Daily Spending1200,35 zł')
    // The old emergency cash account is now saved money, inside Savings.
    expect(text(within(money).getByRole('button', { name: /^Savings/ }))).toContain('300,00 zł')
  })

  it('shows the two example goals empty, and suggests an emergency fund without creating one', () => {
    const { storage } = openDemo()
    const goals = region('Our Goals')
    expect(text(goals)).toContain('Saved for 2 goals')
    expect(within(goals).getByRole('progressbar', { name: 'Trip to Japan progress' }).getAttribute('aria-valuenow')).toBe('0')
    expect(within(goals).getByRole('heading', { name: 'Start with an emergency fund' })).toBeTruthy()
    fireEvent.click(within(goals).getByRole('button', { name: 'Maybe Later' }))
    expect(within(region('Our Goals')).queryByRole('heading', { name: 'Start with an emergency fund' })).toBeNull()
    expect(storage.getItem('goal-planning-app.emergency-later')).toBe('yes')
  })

  it('starts the Year Summary closed, with the year so far', () => {
    openDemo({ expanded: false })
    const year = region('Year Summary')
    const toggle = within(year).getByRole('button', { name: /^Year Summary/ })
    expect(toggle.getAttribute('aria-expanded')).toBe('false')
    expect(text(toggle)).toContain('10 of 12 months so far')
    expect(text(toggle)).toContain('Result for 2026: 113 381,57 zł')
    fireEvent.click(toggle)
    expect(toggle.getAttribute('aria-expanded')).toBe('true')
    expect(text(year)).toContain('Income in 2026117 003,00 zł')
    const people = within(year).getByRole('list', { name: 'Income by person' })
    expect([...people.querySelectorAll('li')].map(li => text(li))).toEqual(['Alex53 002,00 zł', 'Jordan64 001,00 zł'])
    expect((within(year).getByRole('button', { name: /^November 2026/ }) as HTMLButtonElement).disabled).toBe(true)
  })

  it('opens a month of the Year Summary on Home', () => {
    openDemo()
    const year = region('Year Summary')
    fireEvent.click(within(year).getByRole('button', { name: /^July 2026/ }))
    expect(monthSelect().value).toBe('2026-07')
  })

  it('follows changes made in Bills', () => {
    openDemo()
    fireEvent.click(tab('Bills'))
    pickMonth('2026-11')
    showBillsList()
    fireEvent.click(button('Change Amount for November 2026: Phone & Internet'))
    type('Amount for November 2026 (PLN)', '90')
    fireEvent.click(button('Save'))
    fireEvent.click(tab('Home'))
    planned()
    const categories = region('Spending by Category')
    expect(text(within(categories).getByRole('button', { name: /Utilities/ }))).toContain('90,00 zł')
    expect(within(categories).queryByText(/no amount for this month/)).toBeNull()
    expect(donutText('Spending by Category')).toBe('TOTAL PLANNED5540,98 zł')
  })

  it('starts empty in your own space, with no invented numbers', () => {
    createIndividualSpace()
    expandAll()
    expect(text(region('Total Debt'))).toContain('No cards or loans yet')
    expect(text(region('Spending by Category'))).toContain('Nothing spent is recorded for October 2026.')
    expect(text(region('My Money'))).toContain('No accounts yet.')
    expect(text(region('My Goals'))).toContain('No goals yet.')
    expect(text(region('My Goals'))).toContain('Start with an emergency fund')
    const year = region('Year Summary')
    expect(text(year)).toContain('0,00 zł')
    expect(text(year)).toContain('10 of 12 months so far')
    expect(within(year).queryByRole('list', { name: 'Income by person' })).toBeNull()
  })
})

describe('Goals & Savings Pots', () => {
  const region = (name: string) => screen.getByRole('region', { name })
  const goalNames = () => [...document.querySelectorAll('[data-screen="goals"] .goal-card .line b')].map(b => b.textContent)
  const openGoals = () => { fireEvent.click(within(region('Our Goals')).getByRole('button', { name: /View All/ })) }
  const openDemoGoal = (name: string) => { openDemo(); openGoals(); fireEvent.click(button(new RegExp(`^${name}`))) }
  const saveMovement = (kind: 'Add' | 'Withdraw', amount: string, note = '', effect?: RegExp) => {
    fireEvent.click(within(screen.getByRole('group', { name: 'Type of change' })).getByRole('button', { name: kind }))
    if (effect) fireEvent.click(screen.getByRole('radio', { name: effect }))
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
    fireEvent.click(button(/Add Goal/))
    expect(heading('Create a Goal')).toBeTruthy()
    fireEvent.click(button('Review Goal'))
    expect(screen.getByText('Enter a name for your goal.')).toBeTruthy()
    // The target is optional: an empty one is not an error.
    expect(screen.queryByText(/Enter an amount above 0/)).toBeNull()

    type('What are you saving for?', 'New Bike')
    type(/^Target Amount/, '1200')
    expect(screen.queryByLabelText('Target Date')).toBeNull()
    fireEvent.click(button('Review Goal'))
    expect(heading('Check Your Goal')).toBeTruthy()
    expect(text(document.querySelector('[data-screen="new-goal"] .fact-rows'))).toContain('No deadline (Flexible)')
    expect(screen.queryByRole('heading', { name: 'To Reach Your Goal' })).toBeNull()

    // Edit keeps what was typed.
    fireEvent.click(within(document.querySelector<HTMLElement>('[data-screen="new-goal"] .inline-actions')!).getByRole('button', { name: 'Edit' }))
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
    fireEvent.click(button(/Add Goal/))
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
    fireEvent.click(button(/Add Goal/))
    type('What are you saving for?', 'Half done')
    fireEvent.click(button(/All Goals/))
    await waitFor(() => expect(goalNames()).toEqual(['Trip to Japan', 'Christmas Gift']))
    fireEvent.click(button(/Add Goal/))
    expect(field('What are you saving for?').value).toBe('Half done')
  })

  it('suggests a weekly or monthly amount for a goal with a date, and nothing for a flexible one', async () => {
    openDemoGoal('Christmas Gift')
    expect(screen.getByText('With Date · Target date: 25 Dec 2026 · 63 days left from 23 Oct 2026, the demo’s date')).toBeTruthy()
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

  it('gives a purpose to savings already there, without changing the money totals', async () => {
    openDemo()
    const moneyBefore = text(region('Our Money').querySelector('.tiles'))
    openGoals()
    fireEvent.click(button(/^Trip to Japan/))
    saveMovement('Add', '100', 'First savings', /Savings I already have/)
    expect(text(screen.getAllByRole('status').find(s => s.textContent)!)).toBe('Added 100,00 zł (from unassigned savings). Demo only: not saved.')
    expect(text(region('Progress'))).toContain('100,00 zł')
    expect(text(region('Progress'))).toContain('19 900,00 zł still needed')
    expect(text(region('Savings Activity'))).toBe('Savings Activity23 Oct 2026 · First savingsFrom unassigned savings+100,00 zł')

    fireEvent.click(button(/All Goals/))
    await waitFor(() => expect(stat('Saved in Goals')).toContain('100,00 zł'))
    fireEvent.click(button(/^(?!Go to)\s*Home/))
    await waitFor(() => expect(text(region('Our Money').querySelector('.tiles'))).toBe(moneyBefore))
    expect(text(region('Our Goals'))).toContain('100,00 zł')
  })

  it('never withdraws more than is saved, and lists the newest change first', () => {
    openDemoGoal('Trip to Japan')
    saveMovement('Add', '100')
    saveMovement('Withdraw', '150')
    expect(screen.getByText('You can take out up to 100,00 zł, what is saved in this goal.', { normalizer: s => s.replace(/\u00a0|\u202f/g, ' ') })).toBeTruthy()
    expect(text(region('Progress'))).toContain('100,00 zł')
    saveMovement('Withdraw', '40', 'Train tickets')
    expect(text(region('Progress'))).toContain('60,00 zł')
    const rows = [...region('Savings Activity').querySelectorAll('li')].map(li => text(li))
    expect(rows).toEqual(['23 Oct 2026 · Train ticketsBack to unassigned savings−40,00 zł', '23 Oct 2026New savings+100,00 zł'])
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
    // New savings can't be dated before the savings balance (23 Oct): that balance would be wrong.
    fireEvent.click(button('Save Contribution'))
    expect(screen.getByText(/has a balance from a later date/)).toBeTruthy()
    fireEvent.click(screen.getByRole('radio', { name: /Savings I already have/ }))
    fireEvent.click(button('Save Contribution'))
    expect(text(region('Savings Activity'))).toContain('1 Oct 2026From unassigned savings+10,00 zł')
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
    fireEvent.click(button(/^(?!Go to)\s*Home/))
    await waitFor(() => expect(text(region('Our Goals'))).toContain('Saved for 1 goal'))
  })

  it('starts empty in your own space, and keeps a new goal after reopening the app', () => {
    const storage = memoryStorage()
    createIndividualSpace(storage)
    expect(text(region('My Goals'))).toContain('No goals yet.')
    fireEvent.click(within(region('My Goals')).getByRole('button', { name: /View All/ }))
    expect(screen.getByText('No goals yet.')).toBeTruthy()
    fireEvent.click(button(/Add Goal/))
    type('What are you saving for?', 'Laptop')
    type(/^Target Amount/, '4000')
    fireEvent.click(button('Review Goal'))
    fireEvent.click(button('Create Goal'))
    saveMovement('Add', '250')
    expect(saved(storage).goals).toMatchObject([{ name: 'Laptop', target: 400_000, deadline: null, owner: 'member-1', status: 'active' }])
    // No savings account yet, so the movement only gives the goal a purpose; nothing is invented.
    expect(saved(storage).goalMovements).toMatchObject([{ amount: 25_000, date: TODAY, effect: 'assigned' }])

    cleanup()
    start(storage)
    expect(text(region('My Goals'))).toContain('250,00 zł')
    expect(text(region('My Goals'))).toContain('Saved for 1 goal')
  })

  // Regression (Safari on iPhone via http://<computer address>): that page is not
  // secure, so it has no crypto.randomUUID. Saving used to fail with no message.
  describe('on a page without crypto.randomUUID', () => {
    afterEach(() => vi.unstubAllGlobals())
    const insecureCrypto = () => vi.stubGlobal('crypto', { getRandomValues: globalThis.crypto.getRandomValues.bind(globalThis.crypto) })

    it('saves contributions and withdrawals, and Home follows', async () => {
      insecureCrypto()
      openDemoGoal('Christmas Gift')
      saveMovement('Add', '100', 'First saving')
      expect(text(screen.getAllByRole('status').find(s => s.textContent)!)).toBe('Added 100,00 zł (new savings). Demo only: not saved.')
      expect(text(region('Progress'))).toContain('100,00 zł')
      expect(text(region('Progress'))).toContain('20.0%')
      expect(text(region('Savings Activity'))).toContain('23 Oct 2026 · First savingNew savings+100,00 zł')
      saveMovement('Withdraw', '40')
      expect(text(region('Progress'))).toContain('60,00 zł')
      expect(region('Savings Activity').querySelectorAll('li')).toHaveLength(2)

      fireEvent.click(button(/All Goals/))
      await waitFor(() => expect(stat('Saved in Goals')).toContain('60,00 zł'))
      fireEvent.click(button(/^(?!Go to)\s*Home/))
      await waitFor(() => expect(text(region('Our Goals'))).toContain('60,00 zł'))
      expect(within(region('Our Goals')).getByRole('progressbar', { name: 'Christmas Gift progress' }).getAttribute('aria-valuenow')).toBe('12')
    })

    it('creates a goal', () => {
      insecureCrypto()
      openDemo()
      openGoals()
      fireEvent.click(button(/Add Goal/))
      type('What are you saving for?', 'Bike')
      type(/^Target Amount/, '900')
      fireEvent.click(button('Review Goal'))
      fireEvent.click(button('Create Goal'))
      expect(heading('Bike')).toBeTruthy()
      saveMovement('Add', '90')
      expect(text(region('Progress'))).toContain('10.0%')
    })
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
    expect(heading('History')).toBeTruthy()
    expect(tab('History').getAttribute('aria-current')).toBe('page')
    expect(tab('Home').getAttribute('aria-current')).toBeNull()
  })

  it('is hidden in Settings and in the emergency fund draft', async () => {
    openDemo()
    fireEvent.click(button('Settings'))
    expect(heading('Settings')).toBeTruthy()
    expect(screen.queryByRole('navigation', { name: 'Main navigation' })).toBeNull()
    fireEvent.click(button('Back'))
    await waitFor(() => expect(tab('Home')).toBeTruthy())
    fireEvent.click(button('Review My Emergency Fund'))
    expect(heading('Start an Emergency Fund')).toBeTruthy()
    expect(screen.queryByRole('navigation', { name: 'Main navigation' })).toBeNull()
  })
})

describe('Bills', () => {
  const planned = (label: string) => text(within(screen.getByRole('region', { name: 'Whole month' })).getByText(label).parentElement)

  it('opens on Calendar with the whole month: Planned, Paid and Left to Pay', () => {
    openDemo()
    fireEvent.click(tab('Bills'))
    expect(heading('Bills')).toBeTruthy()
    expect(within(screen.getByRole('group', { name: 'View' })).getByRole('button', { name: 'Calendar' }).getAttribute('aria-pressed')).toBe('true')
    expect(planned('Planned')).toContain('5571,43 zł')
    expect(planned('Paid')).toContain('5571,43 zł')
    expect(planned('Left to Pay')).toContain('0,00 zł')
    // Wednesday 7 October has two bills: 330,00 zł together.
    expect(button(/^Wednesday 7 October 2026, 2 bills: 2 paid, 0 pending$/)).toBeTruthy()
  })

  it('shows the bills of the chosen day under the calendar', () => {
    openDemo()
    fireEvent.click(tab('Bills'))
    fireEvent.click(button(/^Monday 5 October 2026/))
    const list = () => screen.getByRole('region', { name: 'Monday 5 October 2026' })
    expect(text(list())).toContain('Furniture Loan')
    fireEvent.click(button(/^Wednesday 7 October 2026/))
    expect(screen.queryByRole('region', { name: 'Monday 5 October 2026' })).toBeNull()
    const day = text(screen.getByRole('region', { name: 'Wednesday 7 October 2026' }))
    expect(day).toContain('Bank Plan')
    expect(day).toContain('Language Course')
    expect(button(/^Wednesday 7 October 2026/).getAttribute('aria-pressed')).toBe('true')
  })

  it('starts again from a useful day when the month changes', () => {
    openDemo()
    fireEvent.click(tab('Bills'))
    fireEvent.click(button(/^Monday 5 October 2026/))
    pickMonth('2026-11')
    expect(monthSelect().value).toBe('2026-11')
    // The demo's date (23 October) is not in November: the first day with bills is chosen.
    const chosen = screen.getAllByRole('button', { pressed: true }).filter(b => b.classList.contains('cal-day'))
    expect(chosen).toHaveLength(1)
    expect(chosen[0].getAttribute('aria-label')).toMatch(/^\w+ \d+ November 2026, \d+ bills?:/)
  })

  it('shows an unknown amount as Unknown, never as a number, and says the totals leave it out', () => {
    openDemo()
    fireEvent.click(tab('Bills'))
    pickMonth('2026-11')
    expect(screen.getByText('1 bill has an unknown amount. The totals include known amounts only.')).toBeTruthy()
    expect(planned('Planned')).toContain('5450,98 zł')
    expect(planned('Planned')).toContain('1 unknown')
    expect(planned('Left to Pay')).toContain('1 unknown')
    fireEvent.click(button(/^Sunday 22 November 2026/))
    const phone = within(screen.getByRole('region', { name: 'Sunday 22 November 2026' })).getByRole('button', { name: /^Phone & Internet/ })
    expect(text(phone)).toContain('Unknown')
    expect(phone.getAttribute('aria-label')).toContain('unknown amount')
  })

  it('marks one month paid in List without changing another month', () => {
    openDemo()
    fireEvent.click(tab('Bills'))
    pickMonth('2026-11')
    showBillsList()
    const rent = button('Rent paid in November 2026')
    expect(rent.getAttribute('aria-pressed')).toBe('false')
    fireEvent.click(rent)
    expect(button('Rent paid in November 2026').getAttribute('aria-pressed')).toBe('true')
    expect(planned('Left to Pay')).toContain('3050,98 zł')

    pickMonth('2026-10')
    expect(button('Rent paid in October 2026').getAttribute('aria-pressed')).toBe('true')
    expect(planned('Left to Pay')).toContain('0,00 zł')
  })

  it('records an amount for one month and updates the totals and Home', () => {
    openDemo()
    fireEvent.click(tab('Bills'))
    pickMonth('2026-11')
    showBillsList()
    fireEvent.click(button('Change Amount for November 2026: Phone & Internet'))
    type('Amount for November 2026 (PLN)', 'abc')
    fireEvent.click(button('Save'))
    expect(screen.getByText('Enter an amount such as 120.45.')).toBeTruthy()
    type('Amount for November 2026 (PLN)', '130,55')
    fireEvent.click(button('Save'))
    expect(planned('Planned')).toContain('5581,53 zł')
    expect(screen.queryByText(/has an unknown amount/)).toBeNull()

    fireEvent.click(tab('Home'))
    pickMonth('2026-11')
    expect(stat('Planned Bills')).toContain('5581,53 zł')
    expect(text(screen.getByRole('region', { name: 'Total Debt' }))).toContain('46 600,40 zł')
  })

  it('shows an empty state in a new space', () => {
    createIndividualSpace()
    fireEvent.click(tab('Bills'))
    expect(screen.getByText('No bills for October 2026.')).toBeTruthy()
  })
})

describe('Keeping information between screens', () => {
  it('keeps a loan added in Cards, with its calculator, after visiting other tabs', async () => {
    const { storage } = createIndividualSpace()
    fireEvent.click(tab('Cards'))
    expect(heading('My Loans & Cards')).toBeTruthy()
    expect(screen.queryByLabelText(/Monthly Income/)).toBeNull()
    fireEvent.click(button(/Add Card or Loan/))
    type('Name', 'Test loan')
    type('Remaining Balance (PLN)', '12000')
    type('Yearly Interest (%)', '12')
    type('Monthly Payment (PLN)', '1000')
    type('Payment Due Day', '10')
    fireEvent.click(button('Add'))
    type('Extra Each Month (PLN)', '200')
    expect(screen.getByText('Months Saved').nextElementSibling!.textContent).toBe('2')

    fireEvent.click(button(/Back/))
    await waitFor(() => expect(heading('My Loans & Cards')).toBeTruthy())
    fireEvent.click(tab('Bills'))
    expect(text(within(screen.getByRole('region', { name: 'Whole month' })).getByText('Planned').parentElement)).toContain('1000,00 zł')
    fireEvent.click(tab('Home'))
    expect(text(screen.getByRole('region', { name: 'Total Debt' }))).toContain('12 000,00 zł')
    expect(saved(storage).debts).toMatchObject([{ name: 'Test loan', yearlyInterestBasisPoints: 1200, dueDay: 10 }])
    expect(saved(storage).bills).toMatchObject([{ name: 'Test loan', amount: 100_000, debtId: saved(storage).debts[0].id }])
  })

  it('opens the emergency fund draft, which creates nothing until it is confirmed', async () => {
    const { storage } = createIndividualSpace()
    expandAll()
    fireEvent.click(button('Review My Emergency Fund'))
    expect(heading('Start an Emergency Fund')).toBeTruthy()
    // A new space has no spending yet: the estimate says what is missing.
    expect(screen.getByText(/Estimate incomplete/)).toBeTruthy()
    expect((button('Create Emergency Fund') as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(button('3 months'))
    fireEvent.click(button('Cancel'))
    await waitFor(() => expect(tab('Home')).toBeTruthy())
    expect(saved(storage).goals).toEqual([])

    fireEvent.click(button('Review My Emergency Fund'))
    type('Groceries per month (PLN)', '800')
    expect(screen.queryByText(/Estimate incomplete/)).toBeNull()
    expect(text(document.querySelector('[data-screen="emergency"]'))).toContain('Target2400,00 zł')
    fireEvent.click(button('Create Emergency Fund'))
    expect(saved(storage).goals).toMatchObject([{ kind: 'emergency', name: 'Emergency Fund', target: 240_000, emergencyBasis: { months: 3, monthlyEssentials: 80_000 } }])
    fireEvent.click(button('Open Emergency Fund'))
    expect(heading('Emergency Fund')).toBeTruthy()
    expect(text(screen.getByRole('region', { name: 'Cover' }))).toContain('covers about 0 months')
  })

  it('never creates a second emergency fund, and offers a review instead', async () => {
    const { storage } = createIndividualSpace()
    expandAll()
    fireEvent.click(button('Review My Emergency Fund'))
    fireEvent.click(button('Create Without a Target'))
    fireEvent.click(button('Back'))
    await waitFor(() => expect(tab('Home')).toBeTruthy())
    expect(screen.queryByRole('heading', { name: 'Start with an emergency fund' })).toBeNull()
    fireEvent.click(button('Review My Emergency Fund'))
    expect(heading('Review My Emergency Fund')).toBeTruthy()
    expect(screen.getByText(/You already have an Emergency Fund/)).toBeTruthy()
    fireEvent.click(button('Save Without a Target'))
    expect(saved(storage).goals.filter((g: { kind: string }) => g.kind === 'emergency')).toHaveLength(1)
  })
})

describe('Card or loan estimate', () => {
  // These cases were covered by the old My Money screen's tests; the estimate now lives on each card or loan.
  function addLoan(payment: string) {
    createIndividualSpace()
    fireEvent.click(tab('Cards'))
    fireEvent.click(button(/Add Card or Loan/))
    type('Name', 'Test loan')
    type('Remaining Balance (PLN)', '12000')
    type('Yearly Interest (%)', '12')
    type('Monthly Payment (PLN)', payment)
    type('Payment Due Day', '10')
    fireEvent.click(button('Add'))
  }
  const estimate = () => text(screen.getByRole('region', { name: 'Estimate' }))

  it('says when the payment does not cover the monthly interest', () => {
    addLoan('100')
    expect(estimate()).toContain('This payment does not cover the monthly interest')
    expect(screen.queryByLabelText(/Extra Each Month/)).toBeNull()
  })

  it('says when paying off would take more than 50 years', () => {
    addLoan('120.30')
    expect(estimate()).toContain('This would take more than 50 years.')
  })

  it('asks for a readable extra amount', () => {
    addLoan('1000')
    type('Extra Each Month (PLN)', 'abc')
    expect(estimate()).toContain('Enter an amount such as 50.')
    expect(screen.queryByText('Months Saved')).toBeNull()
  })
})

describe('Hiding amounts on Home', () => {
  const region = (name: string) => screen.getByRole('region', { name })
  const home = () => text(document.querySelector('[data-screen="home"]'))
  const amount = /\d,\d\d zł/

  it('hides one block at a time, keeping its title and the other blocks', () => {
    openDemo()
    expect(text(region('Total Debt'))).toContain('46 600,40 zł')
    fireEvent.click(button('Hide amounts in Total Debt'))
    expect(text(region('Total Debt'))).not.toMatch(amount)
    expect(text(region('Total Debt'))).toContain('••••')
    expect(text(region('Total Debt'))).toContain('Total Debt')
    expect(text(region('Our Money'))).toMatch(amount)
    fireEvent.click(button('Show amounts in Total Debt'))
    expect(text(region('Total Debt'))).toContain('46 600,40 zł')
  })

  it('hides every amount with one button, with a mask that never shows the number of digits', () => {
    const { storage } = createIndividualSpace()
    openAccountsWithBalance()
    fireEvent.click(button('Hide All Amounts'))
    expect(home()).not.toMatch(amount)
    // Each text piece on its own: two masks in neighbouring table cells are still two masks.
    const pieces = [...document.querySelectorAll('[data-screen="home"] *')].flatMap(element => [...element.childNodes].filter(node => node.nodeType === Node.TEXT_NODE).map(node => node.textContent ?? ''))
    const masks = pieces.flatMap(piece => piece.match(/•+/g) ?? [])
    expect(masks.length).toBeGreaterThan(0)
    expect(masks.every(mask => mask === '••••')).toBe(true)
    for (const name of ['This Month', 'Left to Pay', 'Spending by Category', 'Total Debt', 'My Money', 'My Goals', 'Year Summary']) {
      expect(button(`Show amounts in ${name}`)).toBeTruthy()
      expect(screen.getByRole('region', { name })).toBeTruthy()
    }
    // Only the screen changes: the saved data is the same, and the choice is kept on this device.
    expect(JSON.parse(storage.getItem('goal-planning-app.hidden-amounts')!)).toHaveLength(7)
    cleanup()
    start(storage)
    expect(home()).not.toMatch(amount)
    fireEvent.click(button('Show All Amounts'))
    expect(home()).toMatch(amount)

    function openAccountsWithBalance() {
      fireEvent.click(tab('Data'))
      fireEvent.click(button(/Add Account/))
      type('Account Name', 'Wallet')
      type(/^Balance \(/, '120')
      fireEvent.click(button('Save Account'))
      fireEvent.click(tab('Home'))
    }
  })

  it('does not change the saved data', () => {
    const { storage } = createIndividualSpace()
    const before = saved(storage)
    fireEvent.click(button('Hide All Amounts'))
    fireEvent.click(button('Show amounts in My Money'))
    expect(saved(storage)).toEqual(before)
  })
})

describe('Back navigation', () => {
  it('goes back one screen at a time with the browser back button', async () => {
    openDemo()
    fireEvent.click(tab('Bills'))
    fireEvent.click(tab('Cards'))
    await browserBack()
    expect(heading('Bills')).toBeTruthy()
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

describe('Logo (Go to Home)', () => {
  it('goes to Home from a detail screen, keeping the month, the data and hidden amounts', () => {
    openDemo()
    pickMonth('2026-09')
    fireEvent.click(button('Hide amounts in Total Debt'))
    fireEvent.click(tab('Cards'))
    fireEvent.click(document.querySelector<HTMLButtonElement>('[data-screen="cards"] .goal-card')!)
    expect(screen.queryByRole('navigation', { name: 'Main navigation' })).toBeNull()
    const steps = window.history.length
    fireEvent.click(button('Go to Home'))
    expect(tab('Home').getAttribute('aria-current')).toBe('page')
    expect(window.history.length).toBe(steps + 1)
    expect(monthSelect().value).toBe('2026-09')
    expect(button('Show amounts in Total Debt')).toBeTruthy()
    expect(button('Reset Demo')).toBeTruthy()
  })

  it('adds no history step when Home is already open', () => {
    createIndividualSpace()
    const steps = window.history.length
    fireEvent.click(button('Go to Home'))
    expect(window.history.length).toBe(steps)
    expect(tab('Home').getAttribute('aria-current')).toBe('page')
  })

  it('goes to Home from Settings in the own space', () => {
    createIndividualSpace()
    fireEvent.click(button('Settings'))
    fireEvent.click(button('Go to Home'))
    expect(tab('Home').getAttribute('aria-current')).toBe('page')
  })

  it('goes to Welcome before a space is open', () => {
    start()
    const steps = window.history.length
    fireEvent.click(button('Go to Welcome'))
    expect(window.history.length).toBe(steps)
    fireEvent.click(button(/Create Account/))
    fireEvent.click(button('Go to Welcome'))
    expect(heading('Your goals, your way.')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Go to Home' })).toBeNull()
  })

  it('is a keyboard button with a clear name', () => {
    openDemo()
    const logo = button('Go to Home')
    expect(logo.tagName).toBe('BUTTON')
    expect(logo.textContent).toContain('Goal Planning')
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
    expect(document.activeElement).toBe(heading('Bills'))
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
    const input = field('Choose a backup file (JSON)')
    await act(async () => {
      fireEvent.change(input, { target: { files: [new File([content], 'data.json', { type: 'application/json' })] } })
      await new Promise(resolve => setTimeout(resolve, 20))
    })
  }

  it('replaces the own space with a checked file only after confirming', async () => {
    const { storage } = createIndividualSpace()
    const other = { ...saved(storage), space: { ...saved(storage).space, name: 'Imported', members: [{ id: 'member-1', name: 'Imported', color: '#3B82F6' }] } }
    fireEvent.click(tab('Data'))
    fireEvent.click(button(/^Reports & Backup/))
    await upload(JSON.stringify(other))
    expect(screen.getByRole('alert').textContent).toContain('Replace everything in this space with “Imported”')
    expect(saved(storage).space.name).toBe('Robin')
    fireEvent.click(button('Replace'))
    expect(saved(storage).space.name).toBe('Imported')
    expect(screen.getByText('Imported · Individual')).toBeTruthy()
  })

  it('says when an imported file could not be saved on this device', async () => {
    const { storage } = createIndividualSpace()
    const other = { ...saved(storage), space: { ...saved(storage).space, name: 'Imported' } }
    fireEvent.click(tab('Data'))
    fireEvent.click(button(/^Reports & Backup/))
    await upload(JSON.stringify(other))
    vi.spyOn(storage, 'setItem').mockImplementation(() => { throw new Error('full') })
    fireEvent.click(button('Replace'))
    const status = screen.getAllByRole('status').map(s => s.textContent).join(' ')
    expect(status).toContain('This browser did not save it')
    expect(status).not.toContain('Saved on this device')
    expect(saved(storage).space.name).toBe('Robin')
  })

  it('refuses a broken file and changes nothing', async () => {
    const { storage } = createIndividualSpace()
    fireEvent.click(tab('Data'))
    fireEvent.click(button(/^Reports & Backup/))
    await upload('{ "schemaVersion": 1 }')
    expect(screen.getByRole('alert').textContent).toContain('This file cannot be used. Nothing was changed.')
    expect(saved(storage).space.name).toBe('Robin')
  })
})
