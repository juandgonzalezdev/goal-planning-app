// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import App from './App'
import { memoryStorage } from './test/memoryStorage'

// The shared month, the Home blocks (open, closed, order) and the fixes found in the manual review.
// Alex's demo is shown on its own date, 31 Dec 2026; the device date is in October.
afterEach(() => { cleanup(); document.documentElement.removeAttribute('data-theme') })

const button = (name: string | RegExp) => screen.getByRole('button', { name })
const text = (element: Element | null) => (element?.textContent ?? '').replace(/\u00a0|\u202f/g, ' ')
const tab = (name: string) => within(screen.getByRole('navigation', { name: 'Main navigation' })).getByRole('button', { name })
const regionOf = (name: string) => screen.getByRole('region', { name })
const toggleOf = (name: string) => within(regionOf(name)).getByRole('button', { name: new RegExp(`^${name}`) })
const bodyOf = (name: string) => regionOf(name).querySelector('.block-body')!
const monthSelect = () => screen.getByRole('combobox', { name: 'Month' }) as HTMLSelectElement
const pickMonth = (month: string) => fireEvent.change(monthSelect(), { target: { value: month } })
const screenText = (name: string) => text(document.querySelector(`[data-screen="${name}"]`))
const order = () => [...document.querySelectorAll<HTMLElement>('[data-home-block]')].map(element => element.dataset.homeBlock)
const amount = /\d,\d\d zł/
const BLOCKS = ['This Month', 'Left to Pay', 'Spending by Category', 'Total Debt', 'My Money', 'My Goals', 'Year Summary']

function openAlex(storage: Storage = memoryStorage()) {
  const result = render(<App getToday={() => '2026-10-25'} storage={storage} />)
  fireEvent.click(button('Explore the App'))
  return { storage, ...result }
}

/** Welcome → Create Account → Welcome Setup → Home, as one person. */
function createOwnSpace(storage: Storage = memoryStorage()) {
  const result = render(<App getToday={() => '2026-10-21'} storage={storage} />)
  fireEvent.click(button(/Create Account/))
  fireEvent.click(button(/Continue Without an Account/))
  fireEvent.change(screen.getByLabelText('Display Name'), { target: { value: 'Robin' } })
  fireEvent.click(button(/Continue/))
  fireEvent.click(button(/Continue/))
  fireEvent.click(button(/Continue/))
  fireEvent.click(button('Create My Space'))
  return { storage, ...result }
}

describe('One month for Home, Bills, Cards and their details', () => {
  it('changes the month in Bills and Home shows it, and the other way round', () => {
    openAlex()
    fireEvent.click(tab('Bills'))
    pickMonth('2026-01')
    fireEvent.click(tab('Home'))
    expect(monthSelect().value).toBe('2026-01')
    expect(text(toggleOf('This Month'))).toContain('January 2026')
    fireEvent.click(button('Next month'))
    fireEvent.click(tab('Cards'))
    expect(monthSelect().value).toBe('2026-02')
    expect(screenText('cards')).toContain('Monthly Payments · February 2026')
  })

  it('changes the month inside a bill and inside a card, and Home follows', () => {
    openAlex()
    fireEvent.click(tab('Cards'))
    fireEvent.click(screen.getAllByRole('button', { name: /^Student Loan/ })[0])
    fireEvent.click(button('Previous month'))
    expect(screenText('debt')).toContain('Monthly Payment · November 2026')
    fireEvent.click(button('Student Loan, November 2026'))
    expect(monthSelect().value).toBe('2026-11')
    fireEvent.click(button('Previous month'))
    expect(screen.getByRole('heading', { name: 'October 2026' })).toBeTruthy()
    fireEvent.click(button('Go to Home'))
    expect(monthSelect().value).toBe('2026-10')
  })

  it('keeps to the months the space offers', () => {
    openAlex()
    pickMonth('2027-01')
    expect((button('Next month') as HTMLButtonElement).disabled).toBe(true)
    pickMonth('2026-01')
    expect((button('Previous month') as HTMLButtonElement).disabled).toBe(true)
  })

  it('never changes a record when the month changes', () => {
    const { storage } = createOwnSpace()
    const before = storage.getItem('goal-planning-app.my-space')
    fireEvent.click(button('Next month'))
    fireEvent.click(tab('Bills'))
    fireEvent.click(button('Previous month'))
    expect(storage.getItem('goal-planning-app.my-space')).toBe(before)
  })

  it('leaves History’s own period alone', async () => {
    openAlex()
    fireEvent.click(tab('History'))
    fireEvent.change(screen.getByLabelText('Period'), { target: { value: 'all' } })
    fireEvent.click(tab('Home'))
    pickMonth('2026-03')
    fireEvent.click(tab('History'))
    expect((screen.getByLabelText('Period') as HTMLSelectElement).value).toBe('year:2026')
  })
})

describe('A card payment opens the same bill and month', () => {
  it('shows December’s real card payment and opens December’s bill', () => {
    openAlex()
    fireEvent.click(tab('Cards'))
    expect(screenText('cards')).toContain('December 2026 payment 2489,27 zł (this month only)')
    fireEvent.click(screen.getAllByRole('button', { name: /^Credit Card/ })[0])
    expect(screenText('debt')).toContain('Monthly Payment · December 20262489,27 zł')
    expect(screenText('debt')).toContain('Usual Payment300,00 zł')
    fireEvent.click(button('Credit Card Payment, December 2026'))
    expect(screen.getByRole('heading', { name: 'December 2026' })).toBeTruthy()
    expect(screenText('bill')).toContain('2489,27 zł')
  })

  it('opens January’s bill from January’s payment', () => {
    openAlex()
    fireEvent.click(tab('Bills'))
    pickMonth('2027-01')
    fireEvent.click(tab('Cards'))
    fireEvent.click(screen.getAllByRole('button', { name: /^Credit Card/ })[0])
    expect(screenText('debt')).toContain('Monthly Payment · January 2027300,00 zł')
    fireEvent.click(button('Credit Card Payment, January 2027'))
    expect(screen.getByRole('heading', { name: 'January 2027' })).toBeTruthy()
    expect(screenText('bill')).toContain('Amount300,00 zł')
  })

  it('opens a bill payment from History on its own month', () => {
    openAlex()
    fireEvent.click(tab('History'))
    fireEvent.change(screen.getByLabelText('Period'), { target: { value: 'month:2026-08' } })
    fireEvent.change(screen.getByLabelText('Type'), { target: { value: 'bill' } })
    fireEvent.click(within(document.querySelector<HTMLElement>('.history-list')!).getAllByRole('button', { name: /Credit Card Payment/ })[0])
    expect(screen.getByRole('heading', { name: 'August 2026' })).toBeTruthy()
    expect(monthSelect().value).toBe('2026-08')
  })
})

describe('Home blocks open and close', () => {
  it('starts with This Month and Left to Pay open and the other five closed, with their period and a summary', () => {
    openAlex()
    expect(BLOCKS.map(name => toggleOf(name).getAttribute('aria-expanded'))).toEqual(['true', 'true', 'false', 'false', 'false', 'false', 'false'])
    expect(text(toggleOf('Spending by Category'))).toBe('Spending by CategoryDecember 2026Spent 5097,35 zł')
    expect(text(toggleOf('Total Debt'))).toBe('Total DebtBalances as of 31 Dec 202612 266,98 zł still owed')
    expect(text(toggleOf('My Money'))).toContain('Daily Spending 2789,91 zł · Investments 500,00 zł · Savings 2900,00 zł')
    expect(text(toggleOf('My Goals'))).toContain('2000,00 zł for 2 goals · Emergency Fund 900,00 zł')
    expect(text(toggleOf('Year Summary'))).toContain('2026 · 12 of 12 months so farResult for 2026: 7216,86 zł')
  })

  it('hides closed content from the keyboard and screen readers, but keeps it', () => {
    openAlex()
    expect(bodyOf('Total Debt').hasAttribute('inert')).toBe(true)
    expect(bodyOf('Total Debt').getAttribute('aria-hidden')).toBe('true')
    expect(within(regionOf('Total Debt')).queryByRole('button', { name: /Open Cards/ })).toBeNull()
    fireEvent.click(toggleOf('Total Debt'))
    expect(toggleOf('Total Debt').getAttribute('aria-expanded')).toBe('true')
    expect(bodyOf('Total Debt').hasAttribute('inert')).toBe(false)
    expect(within(regionOf('Total Debt')).getByRole('button', { name: /Open Cards/ })).toBeTruthy()
    // Several blocks stay open at once.
    expect(toggleOf('This Month').getAttribute('aria-expanded')).toBe('true')
  })

  it('keeps a half-typed amount when its block is closed and opened again', () => {
    openAlex()
    fireEvent.click(toggleOf('Spending by Category'))
    fireEvent.click(within(regionOf('Spending by Category')).getByRole('button', { name: 'Planned' }))
    fireEvent.click(within(regionOf('Spending by Category')).getByRole('button', { name: /Housing/ }))
    fireEvent.click(button('Change Rent (studio) amount for December 2026'))
    fireEvent.change(screen.getByLabelText(/^Rent \(studio\) for December 2026/), { target: { value: '1234' } })
    fireEvent.click(toggleOf('Spending by Category'))
    expect(text(toggleOf('Spending by Category'))).toContain('Planned 6401,84 zł')
    fireEvent.click(toggleOf('Spending by Category'))
    expect((screen.getByLabelText(/^Rent \(studio\) for December 2026/) as HTMLInputElement).value).toBe('1234')
  })

  it('never opens or closes a block from its eye or its links', () => {
    openAlex()
    fireEvent.click(button('Hide amounts in Total Debt'))
    expect(toggleOf('Total Debt').getAttribute('aria-expanded')).toBe('false')
    fireEvent.click(button('Hide amounts in Left to Pay'))
    expect(toggleOf('Left to Pay').getAttribute('aria-expanded')).toBe('true')
    // No button inside another button.
    expect(document.querySelectorAll('button button')).toHaveLength(0)
  })

  it('hides amounts in closed headers and summaries too', () => {
    openAlex()
    fireEvent.click(button('Hide All Amounts'))
    for (const name of BLOCKS) expect(text(toggleOf(name))).not.toMatch(amount)
    expect(text(toggleOf('Total Debt'))).toContain('•••• still owed')
    fireEvent.click(button('Show amounts in My Money'))
    expect(text(toggleOf('My Money'))).toMatch(amount)
    expect(text(toggleOf('My Goals'))).not.toMatch(amount)
  })

  it('opens and closes all blocks at once', () => {
    openAlex()
    fireEvent.click(button('Expand All'))
    expect(BLOCKS.every(name => toggleOf(name).getAttribute('aria-expanded') === 'true')).toBe(true)
    fireEvent.click(button('Collapse All'))
    expect(BLOCKS.every(name => toggleOf(name).getAttribute('aria-expanded') === 'false')).toBe(true)
  })

  it('says unknown balances are unknown, never 0', () => {
    createOwnSpace()
    expect(text(toggleOf('Total Debt'))).toContain('No cards or loans yet')
    expect(text(toggleOf('My Money'))).toContain('No accounts yet')
    expect(text(toggleOf('My Goals'))).toContain('No goals yet')
    expect(text(toggleOf('Spending by Category'))).toContain('Spent · Nothing recorded')
  })
})

describe('Customize Home', () => {
  it('moves blocks only in Customize Home, with Move up and Move down, and Done ends it', () => {
    openAlex()
    expect(screen.queryByRole('button', { name: /^Move (up|down)/ })).toBeNull()
    fireEvent.click(button('Customize Home'))
    expect((button('Move up: This Month') as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(button('Move up: Year Summary'))
    expect(order()).toEqual(['month', 'left-to-pay', 'categories', 'debt', 'money', 'year', 'goals'])
    expect(document.activeElement).toBe(button('Move up: Year Summary'))
    expect(text(document.querySelector('.visually-hidden[role="status"]'))).toContain('Year Summary moved to position 6 of 7.')
    fireEvent.click(button('Move down: This Month'))
    expect(order()[0]).toBe('left-to-pay')
    fireEvent.click(button('Done'))
    expect(screen.queryByRole('button', { name: /^Move (up|down)/ })).toBeNull()
    expect(order()).toEqual(['left-to-pay', 'month', 'categories', 'debt', 'money', 'year', 'goals'])
  })

  it('Reset Layout brings back the first order and open blocks', () => {
    openAlex()
    fireEvent.click(button('Expand All'))
    fireEvent.click(button('Customize Home'))
    fireEvent.click(button('Move up: My Money'))
    fireEvent.click(button('Reset Layout'))
    fireEvent.click(button('Done'))
    expect(order()).toEqual(['month', 'left-to-pay', 'categories', 'debt', 'money', 'goals', 'year'])
    expect(BLOCKS.map(name => toggleOf(name).getAttribute('aria-expanded'))).toEqual(['true', 'true', 'false', 'false', 'false', 'false', 'false'])
  })

  it('drags a block by its handle', () => {
    openAlex()
    fireEvent.click(button('Customize Home'))
    const blocks = [...document.querySelectorAll<HTMLElement>('[data-home-block]')]
    blocks.forEach((element, index) => { element.getBoundingClientRect = () => ({ top: index * 100, height: 90, bottom: index * 100 + 90 } as DOMRect) })
    const handle = document.querySelector('[data-home-block="year"] .drag-handle')!
    fireEvent.pointerDown(handle, { pointerId: 1, button: 0, clientY: 650 })
    fireEvent.pointerMove(window, { pointerId: 1, clientY: 640 })
    fireEvent.pointerMove(window, { pointerId: 1, clientY: 20 })
    fireEvent.pointerUp(window, { pointerId: 1, clientY: 20 })
    expect(order()[0]).toBe('year')
  })

  it('keeps the demo layout only while the demo is open, and Reset Demo restores it', () => {
    const { storage } = openAlex()
    fireEvent.click(button('Customize Home'))
    fireEvent.click(button('Move up: Year Summary'))
    fireEvent.click(button('Done'))
    fireEvent.click(toggleOf('My Money'))
    fireEvent.click(tab('Bills'))
    fireEvent.click(tab('Home'))
    expect(order()[5]).toBe('year')
    expect(toggleOf('My Money').getAttribute('aria-expanded')).toBe('true')
    // Nothing of the demo is written to this device.
    expect(storage.getItem('goal-planning-app.home-layout')).toBeNull()
    expect(storage.getItem('goal-planning-app.my-space')).toBeNull()
    fireEvent.click(button('Reset Demo'))
    fireEvent.click(button('Restore Example'))
    expect(order()).toEqual(['month', 'left-to-pay', 'categories', 'debt', 'money', 'goals', 'year'])
    expect(toggleOf('My Money').getAttribute('aria-expanded')).toBe('false')
  })

  it('remembers the own space’s layout after reopening the app, apart from the demo', () => {
    const { storage } = createOwnSpace()
    fireEvent.click(button('Customize Home'))
    fireEvent.click(button('Move down: This Month'))
    fireEvent.click(button('Done'))
    fireEvent.click(toggleOf('Year Summary'))
    cleanup()
    render(<App getToday={() => '2026-10-21'} storage={storage} />)
    expect(order().slice(0, 2)).toEqual(['left-to-pay', 'month'])
    expect(toggleOf('Year Summary').getAttribute('aria-expanded')).toBe('true')
  })

  it('reads a broken saved layout without losing or repeating a block', () => {
    const { storage } = createOwnSpace()
    const spaceId = JSON.parse(storage.getItem('goal-planning-app.my-space')!).space.id
    storage.setItem('goal-planning-app.home-layout', JSON.stringify({ spaceId, layout: { order: ['year', 'year', 'nope'], open: 'all' } }))
    cleanup()
    render(<App getToday={() => '2026-10-21'} storage={storage} />)
    expect(order()).toEqual(['year', 'month', 'left-to-pay', 'categories', 'debt', 'money', 'goals'])
    storage.setItem('goal-planning-app.home-layout', '{not json')
    cleanup()
    render(<App getToday={() => '2026-10-21'} storage={storage} />)
    expect(order()).toEqual(['month', 'left-to-pay', 'categories', 'debt', 'money', 'goals', 'year'])
  })
})

describe('Fixes from the manual review', () => {
  it('says “Nothing left to pay” for a card with no balance, with no estimate or savings', () => {
    openAlex()
    fireEvent.click(tab('Cards'))
    fireEvent.click(screen.getAllByRole('button', { name: /^Credit Card/ })[0])
    const debt = screenText('debt')
    expect(debt).toContain('Nothing left to pay on the balance of 31 Dec 2026.')
    expect(debt).not.toContain('About 0 months')
    expect(screen.queryByText('What If I Pay Extra?')).toBeNull()
  })

  it('names the demo’s date in estimates instead of “today”', async () => {
    openAlex()
    fireEvent.click(tab('Cards'))
    fireEvent.click(screen.getAllByRole('button', { name: /^Student Loan/ })[0])
    expect(screenText('debt')).toContain('Calculated on 31 Dec 2026 (the demo’s date)')
    expect(screenText('debt')).not.toMatch(/Calculated today/)
    fireEvent.click(button('Go to Home'))
    fireEvent.click(toggleOf('My Goals'))
    fireEvent.click(within(regionOf('My Goals')).getByRole('button', { name: /Trip to Japan/ }))
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Trip to Japan' })).toBeTruthy())
    fireEvent.click(button('Try an Amount or Date'))
    expect(screenText('goal')).toContain('worked out from 31 Dec 2026 (the demo’s date)')
    expect(screenText('goal')).not.toMatch(/from today/)
  })

  it('says “today” in the own space, where it is really today', () => {
    createOwnSpace()
    fireEvent.click(tab('Cards'))
    fireEvent.click(button(/Add Card or Loan/))
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Bank Loan' } })
    fireEvent.change(screen.getByLabelText(/^Remaining Balance/), { target: { value: '1000' } })
    fireEvent.change(screen.getByLabelText('Yearly Interest (%)'), { target: { value: '10' } })
    fireEvent.change(screen.getByLabelText(/^Monthly Payment/), { target: { value: '100' } })
    fireEvent.change(screen.getByLabelText('Payment Due Day'), { target: { value: '5' } })
    fireEvent.click(button('Add'))
    expect(screenText('debt')).toContain('Calculated on today (21 Oct 2026)')
  })

  it('explains when every saving already has a purpose', async () => {
    openAlex()
    fireEvent.click(toggleOf('My Goals'))
    fireEvent.click(within(regionOf('My Goals')).getByRole('button', { name: /Trip to Japan/ }))
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Trip to Japan' })).toBeTruthy())
    fireEvent.click(screen.getByRole('radio', { name: /Savings I already have/ }))
    fireEvent.change(screen.getByLabelText('Amount (PLN)'), { target: { value: '50' } })
    fireEvent.click(button('Save Contribution'))
    expect(screenText('goal')).toContain('All your savings already have a purpose. Reduce another allocation first, or choose New savings if you’re adding new money.')
    expect(screenText('goal')).not.toContain('Only 0,00 zł')
  })

  it('describes each savings movement in History, newest entry first on the same day', async () => {
    openAlex()
    fireEvent.click(toggleOf('My Goals'))
    fireEvent.click(within(regionOf('My Goals')).getByRole('button', { name: /Trip to Japan/ }))
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Trip to Japan' })).toBeTruthy())
    fireEvent.click(screen.getByRole('radio', { name: /New savings/ }))
    fireEvent.change(screen.getByLabelText('Amount (PLN)'), { target: { value: '100' } })
    fireEvent.click(button('Save Contribution'))
    fireEvent.click(within(screen.getByRole('group', { name: 'Type of change' })).getByRole('button', { name: 'Withdraw' }))
    fireEvent.click(screen.getByRole('radio', { name: /Back to unassigned savings/ }))
    fireEvent.change(screen.getByLabelText('Amount (PLN)'), { target: { value: '30' } })
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 5)) })
    fireEvent.click(button('Save Withdrawal'))
    fireEvent.click(button('Go to Home'))
    fireEvent.click(tab('History'))
    const rows = [...document.querySelectorAll('.history-list > li')].map(text)
    expect(rows[0]).toContain('Trip to Japan31 Dec 2026 · Back to unassigned savings · Savings total unchanged')
    expect(rows[1]).toContain('Trip to Japan31 Dec 2026 · New savings · Into Savings Account')
  })
})
