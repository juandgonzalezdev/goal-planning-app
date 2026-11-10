// @vitest-environment jsdom
import { chooseMonth } from './test/monthPicker'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { classicHome, memoryStorage } from './test/memoryStorage'
import { fire, settle, storedData, freshDatabaseForEachTest } from './test/space'
import { markPaid } from './test/bills'
import { addFromHome, chooseHomeOption } from './test/homeControls'

freshDatabaseForEachTest()

// Home in three areas: Left to Pay and Show All, + Add, Back to Home (place and focus), the
// preferences an earlier version saved, and hidden amounts in what the areas now show.
// Alex's demo is shown on its own date, 31 Dec 2026; the device date is in October.
afterEach(() => { cleanup(); vi.restoreAllMocks(); document.documentElement.removeAttribute('data-theme') })

const button = (name: string | RegExp) => screen.getByRole('button', { name })
const heading = (name: string | RegExp) => screen.getByRole('heading', { name })
const field = (label: string | RegExp) => screen.getByLabelText(label) as HTMLInputElement
const type = async (label: string | RegExp, value: string) => await fire.change(field(label), { target: { value } })
const text = (element: Element | null) => (element?.textContent ?? '').replace(/\u00a0|\u202f/g, ' ')
const tab = (name: string) => within(screen.getByRole('navigation', { name: 'Main navigation' })).getByRole('button', { name })
const regionOf = (name: string) => screen.getByRole('region', { name })
const toggleOf = (name: string) => regionOf(name).querySelector<HTMLButtonElement>('.block-toggle')!
const pickMonth = async (month: string) => await chooseMonth(month)
const onHome = () => tab('Home').getAttribute('aria-current') === 'page'
const shown = () => document.querySelector<HTMLElement>('[data-screen]')?.dataset.screen
const unpaid = () => [...regionOf('Left to Pay').querySelectorAll('.pay-groups .pay-list li')].map(row => text(row.querySelector('span')).replace(/(Due|Overdue since) .*/, ''))
const payRow = (name: string) => within(regionOf('Left to Pay')).getByRole('button', { name: new RegExp(`^${name.replace(/[()&]/g, '\\$&')},`) })
const addButton = () => button('Add')
const question = () => screen.queryByRole('alertdialog', { name: 'Leave without saving?' })
const amount = /\d,\d\d zł/
const JANUARY = ['Gym Membership', 'Transit Pass', 'Music Streaming', 'Utilities', 'News App', 'Small Loan', 'Home Contents Insurance',
  'Credit Card Payment', 'Student Loan', 'Rent (studio)', 'Phone & Internet']

async function openAlex(storage: Storage = memoryStorage()) {
  const result = render(<App getToday={() => '2026-10-25'} storage={classicHome(storage)} />)
  await settle()
  await fire.click(button('Explore the App'))
  return { storage, ...result }
}

/** Welcome → Create Account → Welcome Setup → Home, as one person. */
async function createOwnSpace(storage: Storage = memoryStorage()) {
  const result = render(<App getToday={() => '2026-10-21'} storage={classicHome(storage)} />)
  await settle()
  await fire.click(button(/Create Account/))
  await fire.click(button(/Continue Without an Account/))
  await fire.change(screen.getByLabelText('Display Name'), { target: { value: 'Robin' } })
  await fire.click(button(/Continue/))
  await fire.click(button(/Continue/))
  await fire.click(button(/Continue/))
  await fire.click(button('Create My Space'))
  return { storage, ...result }
}

async function reopen(storage: Storage) {
  cleanup()
  render(<App getToday={() => '2026-10-21'} storage={classicHome(storage)} />)
  await settle()
}

async function browser(move: 'back' | 'forward') {
  await act(async () => {
    if (move === 'back') window.history.back()
    else window.history.forward()
    await new Promise(resolve => setTimeout(resolve, 20))
  })
}

/** The page "scrolled" to `y`, and window.scrollTo recorded (the test browser does not scroll). */
function scrolledTo(y: number) {
  Object.defineProperty(window, 'scrollY', { value: y, configurable: true })
  return vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
}

/** Types an amount for Rent in Spending by Category › Planned (the one form inside Home). */
async function typeRent(value: string) {
  await fire.click(toggleOf('Spending by Category'))
  await fire.click(within(regionOf('Spending by Category')).getByRole('button', { name: 'Planned' }))
  await fire.click(within(regionOf('Spending by Category')).getByRole('button', { name: /Housing/ }))
  await fire.click(button('Change Rent (studio) amount for December 2026'))
  await fire.change(screen.getByLabelText(/^Rent \(studio\) for December 2026/), { target: { value } })
}

describe('Left to Pay', () => {
  it('lists the first five unpaid bills by due date, with Show All only when there are more', async () => {
    await openAlex()
    expect(unpaid()).toEqual(['Phone & Internet'])
    expect(within(regionOf('Left to Pay')).queryByRole('button', { name: /^Show / })).toBeNull()
    await pickMonth('2027-01')
    expect(unpaid()).toEqual(JANUARY.slice(0, 5))
    const more = button('Show All 11')
    expect(more.getAttribute('aria-expanded')).toBe('false')
    expect(more.getAttribute('aria-controls')).toBe('left-to-pay-list')
    act(() => more.focus())
    await fire.click(more)
    // Every bill, still by due date: the reading and keyboard order is the order of the list.
    expect(unpaid()).toEqual(JANUARY)
    expect(button('Show Fewer').getAttribute('aria-expanded')).toBe('true')
    // The same button: the keyboard stays on it.
    expect(document.activeElement).toBe(button('Show Fewer'))
    await fire.click(button('Show Fewer'))
    expect(unpaid()).toHaveLength(5)
  })

  it('keeps Show All, the place and the focus on the bill after Back from it', async () => {
    await openAlex()
    await pickMonth('2027-01')
    await fire.click(button('Show All 11'))
    const scroll = scrolledTo(640)
    await fire.click(payRow('Rent (studio)'))
    expect(heading('Rent (studio)')).toBeTruthy()
    await fire.click(button('Back'))
    await waitFor(() => expect(onHome()).toBe(true))
    expect(unpaid()).toEqual(JANUARY)
    expect(document.activeElement).toBe(payRow('Rent (studio)'))
    expect(scroll).toHaveBeenCalledWith(0, 640)
    // The browser's Back works the same.
    await fire.click(payRow('Utilities'))
    await browser('back')
    await waitFor(() => expect(document.activeElement).toBe(payRow('Utilities')))
  })

  it('puts the focus on Left to Pay when the bill was paid on its screen', async () => {
    await openAlex()
    await fire.click(payRow('Phone & Internet'))
    await markPaid('Phone & Internet', 'December 2026')
    await fire.click(button('Back'))
    await waitFor(() => expect(onHome()).toBe(true))
    expect(text(regionOf('Left to Pay'))).toContain('All your December bills are paid.')
    expect(document.activeElement).toBe(document.getElementById('home-area-left-to-pay'))
  })

  it('keeps Show All apart for the demo and the own space, and Reset Demo closes it', async () => {
    await openAlex()
    await pickMonth('2027-01')
    await fire.click(button('Show All 11'))
    await fire.click(tab('Bills'))
    await fire.click(tab('Home'))
    expect(unpaid()).toHaveLength(11)
    await fire.click(within(screen.getByRole('note')).getByRole('button', { name: 'Demo options' }))
    await fire.click(within(screen.getByRole('group', { name: 'About the demo' })).getByRole('button', { name: 'Reset Demo' }))
    await fire.click(within(screen.getByRole('group', { name: 'Reset demo?' })).getByRole('button', { name: 'Reset Demo' }))
    await pickMonth('2027-01')
    expect(unpaid()).toHaveLength(5)
  })
})

describe('Back to Home', () => {
  it('finds the link used inside a part, and Home reached any other way starts again', async () => {
    await openAlex()
    await fire.click(toggleOf('Goals'))
    const scroll = scrolledTo(900)
    await fire.click(within(regionOf('Goals')).getByRole('button', { name: /^Trip to Japan/ }))
    expect(heading('Trip to Japan')).toBeTruthy()
    await fire.click(button('Back'))
    await waitFor(() => expect(onHome()).toBe(true))
    expect(document.activeElement).toBe(within(regionOf('Goals')).getByRole('button', { name: /^Trip to Japan/ }))
    expect(scroll).toHaveBeenCalledWith(0, 900)
    // A link that opens another tab: Back finds it too.
    await fire.click(toggleOf('Cards & Loans'))
    await fire.click(within(regionOf('Cards & Loans')).getByRole('button', { name: /Open Cards & Loans/ }))
    expect(shown()).toBe('money')
    await browser('back')
    await waitFor(() => expect(document.activeElement).toBe(within(regionOf('Cards & Loans')).getByRole('button', { name: /Open Cards & Loans/ })))
    // Home from the tab bar is a new step: no place to go back to.
    scroll.mockClear()
    await fire.click(within(regionOf('Left to Pay')).getByRole('button', { name: /^Bills/ }))
    await fire.click(tab('Home'))
    expect(scroll).not.toHaveBeenCalled()
    expect(document.activeElement).not.toBe(within(regionOf('Left to Pay')).getByRole('button', { name: /^Bills/ }))
  })

  it('falls back to the part’s heading when the button used is inside a part closed since', async () => {
    await openAlex()
    await fire.click(toggleOf('Goals'))
    await fire.click(within(regionOf('Goals')).getByRole('button', { name: /^Trip to Japan/ }))
    await fire.click(button('Go to Home'))
    await chooseHomeOption('Collapse All')
    await browser('back')
    await browser('back')
    await waitFor(() => expect(onHome()).toBe(true))
    expect(document.activeElement).toBe(toggleOf('Goals'))
  })
})

describe('+ Add', () => {
  it('offers the forms that already exist, records first, as a menu that works with the keyboard', async () => {
    await openAlex()
    await fire.click(addButton())
    const menu = screen.getByRole('menu', { name: 'Add' })
    expect(within(menu).getAllByRole('menuitem').map(item => item.textContent)).toEqual([
      'Add Spending', 'Record Income Received', 'Add Transfer', 'Update a Balance', 'Add a Contribution', 'Mark a Bill as Paid',
      'Add Income', 'Add Bill', 'Add Goal'])
    // A line between what happened (records) and what is planned.
    expect(within(menu).getAllByRole('separator')).toHaveLength(1)
    expect(document.activeElement).toBe(within(menu).getByRole('menuitem', { name: 'Add Spending' }))
    await fire.keyDown(document.activeElement!, { key: 'ArrowDown' })
    expect(document.activeElement).toBe(within(menu).getByRole('menuitem', { name: 'Record Income Received' }))
    await fire.keyDown(document.activeElement!, { key: 'Escape' })
    expect(screen.queryByRole('menu', { name: 'Add' })).toBeNull()
    expect(document.activeElement).toBe(addButton())
    // It is in its own action row, not in the month bar, and there is one Add Goal on Home: in + Add.
    expect(document.querySelector('.home-month-bar')!.contains(addButton())).toBe(false)
    expect(document.querySelector('.shell-action-row')!.contains(addButton())).toBe(true)
    expect(screen.queryByRole('button', { name: /Add Goal/ })).toBeNull()
  })

  it('Add Income: the income form in Money, once; Cancel goes back to Home; saving stays in Money', async () => {
    await openAlex()
    const steps = window.history.length
    await addFromHome('Add Income')
    expect(shown()).toBe('money')
    expect(window.history.length).toBe(steps + 1)
    expect(document.activeElement).toBe(document.getElementById('income-name'))
    await fire.click(within(document.querySelector('.edit-box') as HTMLElement).getByRole('button', { name: 'Cancel' }))
    await waitFor(() => expect(onHome()).toBe(true))
    expect(document.activeElement).toBe(addButton())
    // Forward shows Money again, without the form: it opens once.
    await browser('forward')
    await waitFor(() => expect(shown()).toBe('money'))
    expect(document.getElementById('income-name')).toBeNull()
    await browser('back')
    await waitFor(() => expect(onHome()).toBe(true))
    await addFromHome('Add Income')
    expect(window.history.length).toBe(steps + 1)
    await type('Name', 'Bonus')
    await type(/^Usual Net Amount/, '100')
    await type('Pay Day', '10')
    await fire.click(button('Save Income'))
    await waitFor(() => expect(screen.getByText(/^Income saved\./)).toBeTruthy())
    expect(shown()).toBe('money')
    expect(document.getElementById('income-name')).toBeNull()
    expect(text(document.querySelector('[data-money-block="income"]'))).toContain('Bonus')
    await browser('back')
    await waitFor(() => expect(onHome()).toBe(true))
    // Money opened from its tab later: no form.
    await fire.click(tab('Money'))
    expect(document.getElementById('income-name')).toBeNull()
  })

  it('Add Income with something typed: Back asks first, and Keep Editing keeps it', async () => {
    await openAlex()
    await addFromHome('Add Income')
    await type('Name', 'Bonus')
    await browser('back')
    await waitFor(() => expect(question()).not.toBeNull())
    await fire.click(within(question()!).getByRole('button', { name: 'Keep Editing' }))
    expect(shown()).toBe('money')
    expect(field('Name').value).toBe('Bonus')
  })

  it('Add Spending: Add Spending in History, once; Cancel goes back to Home; saving stays in History', async () => {
    await openAlex()
    const steps = window.history.length
    await addFromHome('Add Spending')
    expect(shown()).toBe('history')
    expect(window.history.length).toBe(steps + 1)
    expect(screen.getByRole('group', { name: 'Add spending' })).toBeTruthy()
    expect(document.activeElement).toBe(document.getElementById('expense-new-date'))
    await fire.click(within(screen.getByRole('group', { name: 'Add spending' })).getByRole('button', { name: 'Cancel' }))
    await waitFor(() => expect(onHome()).toBe(true))
    expect(document.activeElement).toBe(addButton())
    await browser('forward')
    await waitFor(() => expect(shown()).toBe('history'))
    expect(screen.queryByRole('group', { name: 'Add spending' })).toBeNull()
    await browser('back')
    await waitFor(() => expect(onHome()).toBe(true))
    await addFromHome('Add Spending')
    await type(/^Amount/, '12,50')
    await fire.click(within(screen.getByRole('group', { name: 'Add spending' })).getByRole('button', { name: /^(Save|Add)/ }))
    await waitFor(() => expect(screen.getByText(/^Spending added\./)).toBeTruthy())
    expect(shown()).toBe('history')
    expect(screen.queryByRole('group', { name: 'Add spending' })).toBeNull()
    await browser('back')
    await waitFor(() => expect(onHome()).toBe(true))
  })

  it('Add Bill: Cancel goes back to Home; adding shows the new bill, and Back goes to Home', async () => {
    await openAlex()
    const steps = window.history.length
    await addFromHome('Add Bill')
    expect(heading('Add Bill')).toBeTruthy()
    expect(window.history.length).toBe(steps + 1)
    await fire.click(within(document.querySelector('.bill-form') as HTMLElement).getByRole('button', { name: 'Cancel' }))
    await waitFor(() => expect(onHome()).toBe(true))
    expect(document.activeElement).toBe(addButton())
    await addFromHome('Add Bill')
    await type('Bill name', 'Bike Repair')
    await type('Amount (PLN)', '80')
    await type('Due day', '15')
    act(() => { fireEvent.submit(document.querySelector('.bill-form')!) })
    await waitFor(() => expect(heading('Bike Repair')).toBeTruthy())
    expect(window.history.length).toBe(steps + 1)
    await fire.click(button('Back'))
    await waitFor(() => expect(onHome()).toBe(true))
    expect(document.activeElement).toBe(addButton())
  })

  it('Add Goal: Back goes to Home and keeps the draft; Create shows the goal, and Back goes to Home', async () => {
    await openAlex()
    await addFromHome('Add Goal')
    expect(heading('Create a Goal')).toBeTruthy()
    expect(screen.queryByRole('button', { name: /All Goals/ })).toBeNull()
    await type('What are you saving for?', 'New Bike')
    await fire.click(button('Back'))
    await waitFor(() => expect(onHome()).toBe(true))
    // The draft is kept (it was never asked about, and is listed if anything would drop it).
    expect(question()).toBeNull()
    expect(document.activeElement).toBe(addButton())
    await addFromHome('Add Goal')
    expect(field('What are you saving for?').value).toBe('New Bike')
    await fire.click(button('Review Goal'))
    await fire.click(button('Create Goal'))
    await waitFor(() => expect(heading('New Bike')).toBeTruthy())
    await fire.click(button('Back'))
    await waitFor(() => expect(onHome()).toBe(true))
    await addFromHome('Add Goal')
    expect(field('What are you saving for?').value).toBe('')
  })

  it('asks before leaving an amount half-typed on Home', async () => {
    await openAlex()
    await typeRent('1234')
    await addFromHome('Add Income')
    expect(question()).not.toBeNull()
    await fire.click(within(question()!).getByRole('button', { name: 'Keep Editing' }))
    expect(onHome()).toBe(true)
    expect((screen.getByLabelText(/^Rent \(studio\) for December 2026/) as HTMLInputElement).value).toBe('1234')
    await addFromHome('Add Income')
    await fire.click(within(question()!).getByRole('button', { name: 'Discard and Leave' }))
    await waitFor(() => expect(shown()).toBe('money'))
    expect(document.getElementById('income-name')).not.toBeNull()
  })
})

describe('Preferences saved by an earlier version', () => {
  it('hides each area that held a hidden block, and Bills and History once every area is hidden', async () => {
    const storage = memoryStorage()
    storage.setItem('goal-planning-app.hidden-amounts', JSON.stringify(['year']))
    await openOwnWithIncome(storage)
    expect(button('Show amounts in This Month')).toBeTruthy()
    expect(text(regionOf('This Month'))).not.toMatch(amount)
    expect(button('Hide amounts in Left to Pay')).toBeTruthy()
    // Saved again with every block of the area, for an earlier version.
    await fire.click(button('Hide amounts in Money & Goals'))
    expect(JSON.parse(storage.getItem('goal-planning-app.hidden-amounts')!).sort()).toEqual(['categories', 'debt', 'goals', 'money', 'money-goals', 'month', 'year'])
    await fire.click(button('Show amounts in This Month'))
    expect(JSON.parse(storage.getItem('goal-planning-app.hidden-amounts')!).sort()).toEqual(['debt', 'goals', 'money', 'money-goals'])
    // One block of each area hidden: every area, so Bills hides its amounts too.
    storage.setItem('goal-planning-app.hidden-amounts', JSON.stringify(['year', 'left-to-pay', 'debt']))
    await reopen(storage)
    expect(button('Amounts hidden. Show amounts')).toBeTruthy()
    await fire.click(tab('Bills'))
    expect(button('Amounts hidden. Show amounts')).toBeTruthy()
    await fire.click(tab('History'))
    expect(button('Amounts hidden. Show amounts')).toBeTruthy()
  })

  it('places each area where its first block was, and opens the parts that were open', async () => {
    const { storage } = await createOwnSpace()
    const spaceId = (await storedData())!.space.id
    storage.setItem('goal-planning-app.home-layout', JSON.stringify({ spaceId, layout: {
      order: ['goals', 'year', 'month', 'left-to-pay', 'categories', 'debt', 'money'], open: ['month', 'goals', 'year'],
    } }))
    await reopen(storage)
    expect([...document.querySelectorAll<HTMLElement>('[data-home-area]')].map(element => element.dataset.homeArea)).toEqual(['money-goals', 'month', 'left-to-pay'])
    expect(['Spending by Category', 'Year Summary', 'Accounts & Savings', 'Cards & Loans', 'Goals'].map(name => toggleOf(name).getAttribute('aria-expanded')))
      .toEqual(['false', 'true', 'false', 'false', 'true'])
    // Nothing is rewritten until the layout changes; then in this version's form.
    await fire.click(toggleOf('Cards & Loans'))
    expect(JSON.parse(storage.getItem('goal-planning-app.home-layout')!).layout).toEqual({ version: 2, order: ['money-goals', 'month', 'left-to-pay'], open: ['goals', 'year', 'debt'] })
  })

  it('the demo never reads or writes them', async () => {
    const storage = memoryStorage()
    storage.setItem('goal-planning-app.hidden-amounts', JSON.stringify(['money']))
    await openAlex(storage)
    expect(button('Hide amounts in Money & Goals')).toBeTruthy()
    await fire.click(button('Hide amounts'))
    expect(JSON.parse(storage.getItem('goal-planning-app.hidden-amounts')!)).toEqual(['money'])
  })

  async function openOwnWithIncome(storage: Storage) {
    await createOwnSpace(storage)
    await fire.click(tab('Money'))
    await fire.click(button(/Add Income/))
    await type('Name', 'Salary')
    await type(/^Usual Net Amount/, '5000')
    await type('Pay Day', '1')
    await fire.click(button('Save Income'))
    await fire.click(tab('Home'))
  }
})

describe('Hidden amounts in what the areas show', () => {
  it('each eye hides its area’s figures, summaries, accessible names and the bills’ amounts', async () => {
    await openAlex()
    await pickMonth('2027-01')
    await fire.click(button('Hide amounts in Left to Pay'))
    const pay = regionOf('Left to Pay')
    expect(text(pay)).not.toMatch(amount)
    expect(text(pay)).toContain('••••')
    expect([...pay.querySelectorAll('[aria-label]')].map(element => element.getAttribute('aria-label')!).join(' ')).not.toMatch(amount)
    expect(payRow('Gym Membership').getAttribute('aria-label')).toContain('amount hidden')
    // The number of bills is not an amount: it stays.
    expect(button('Show All 11')).toBeTruthy()
    expect(text(regionOf('This Month'))).toMatch(amount)

    await fire.click(button('Hide amounts in Money & Goals'))
    const balances = regionOf('Money & Goals')
    expect(text(balances)).not.toMatch(amount)
    expect(text(toggleOf('Goals'))).toContain('•••• for 2 goals, part of Savings')
    expect(text(balances)).toContain('Latest balances by 31 Dec 2026')

    await fire.click(button('Hide amounts in This Month'))
    expect(text(regionOf('This Month'))).not.toMatch(amount)
    expect(text(toggleOf('Year Summary'))).toContain('2027 · 0 of 12 months so far')
    await chooseHomeOption('Expand All')
    expect(text(document.querySelector('[data-screen="home"]'))).not.toMatch(amount)
    expect([...document.querySelectorAll('[data-screen="home"] [aria-label]')].map(element => element.getAttribute('aria-label')!).join(' ')).not.toMatch(amount)
  })
})
