// @vitest-environment jsdom
import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import App from './App'
import { memoryStorage } from './test/memoryStorage'
import { fire, settle, storedData, storedSpace, freshDatabaseForEachTest } from './test/space'
import { chooseHomeOption, startDemoReset } from './test/homeControls'

freshDatabaseForEachTest()

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
const pickMonth = async (month: string) => await fire.change(monthSelect(), { target: { value: month } })
const screenText = (name: string) => text(document.querySelector(`[data-screen="${name}"]`))
const order = () => [...document.querySelectorAll<HTMLElement>('[data-home-block]')].map(element => element.dataset.homeBlock)
const amount = /\d,\d\d zł/
const BLOCKS = ['This Month', 'Left to Pay', 'Spending by Category', 'Total Debt', 'My Money', 'My Goals', 'Year Summary']

async function openAlex(storage: Storage = memoryStorage()) {
  const result = render(<App getToday={() => '2026-10-25'} storage={storage} />)
  await settle()
  await fire.click(button('Explore the App'))
  return { storage, ...result }
}

/** Welcome → Create Account → Welcome Setup → Home, as one person. */
async function createOwnSpace(storage: Storage = memoryStorage()) {
  const result = render(<App getToday={() => '2026-10-21'} storage={storage} />)
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

describe('One month for Home, Bills, Cards and their details', () => {
  it('changes the month in Bills and Home shows it, and the other way round', async () => {
    await openAlex()
    await fire.click(tab('Bills'))
    await pickMonth('2026-01')
    await fire.click(tab('Home'))
    expect(monthSelect().value).toBe('2026-01')
    expect(text(toggleOf('This Month'))).toContain('January 2026')
    await fire.click(button('Next month'))
    await fire.click(tab('Cards'))
    expect(monthSelect().value).toBe('2026-02')
    expect(screenText('cards')).toContain('Monthly Payments · February 2026')
  })

  it('changes the month inside a bill and inside a card, and Home follows', async () => {
    await openAlex()
    await fire.click(tab('Cards'))
    await fire.click(screen.getAllByRole('button', { name: /^Student Loan/ })[0])
    await fire.click(button('Previous month'))
    expect(screenText('debt')).toContain('Monthly Payment · November 2026')
    await fire.click(button('Student Loan, November 2026'))
    expect(monthSelect().value).toBe('2026-11')
    await fire.click(button('Previous month'))
    expect(screen.getByRole('heading', { name: 'October 2026' })).toBeTruthy()
    await fire.click(button('Go to Home'))
    expect(monthSelect().value).toBe('2026-10')
  })

  it('keeps to the months the space offers', async () => {
    await openAlex()
    await pickMonth('2027-01')
    expect((button('Next month') as HTMLButtonElement).disabled).toBe(true)
    await pickMonth('2026-01')
    expect((button('Previous month') as HTMLButtonElement).disabled).toBe(true)
  })

  it('never changes a record when the month changes', async () => {
    await createOwnSpace()
    const before = await storedSpace()
    await fire.click(button('Next month'))
    await fire.click(tab('Bills'))
    await fire.click(button('Previous month'))
    expect(await storedSpace()).toEqual(before)
  })

  it('leaves History’s own period alone, and keeps the one chosen', async () => {
    await openAlex()
    await fire.click(tab('History'))
    await fire.change(screen.getByLabelText('Period'), { target: { value: 'all' } })
    await fire.click(tab('Home'))
    await pickMonth('2026-03')
    await fire.click(tab('History'))
    expect((screen.getByLabelText('Period') as HTMLSelectElement).value).toBe('all')
  })
})

describe('A card payment opens the same bill and month', () => {
  it('shows December’s real card payment and opens December’s bill', async () => {
    await openAlex()
    await fire.click(tab('Cards'))
    expect(screenText('cards')).toContain('December 2026 payment 2489,27 zł (this month only)')
    await fire.click(screen.getAllByRole('button', { name: /^Credit Card/ })[0])
    expect(screenText('debt')).toContain('Monthly Payment · December 20262489,27 zł')
    expect(screenText('debt')).toContain('Usual Payment300,00 zł')
    await fire.click(button('Credit Card Payment, December 2026'))
    expect(screen.getByRole('heading', { name: 'December 2026' })).toBeTruthy()
    expect(screenText('bill')).toContain('2489,27 zł')
  })

  it('opens January’s bill from January’s payment', async () => {
    await openAlex()
    await fire.click(tab('Bills'))
    await pickMonth('2027-01')
    await fire.click(tab('Cards'))
    await fire.click(screen.getAllByRole('button', { name: /^Credit Card/ })[0])
    expect(screenText('debt')).toContain('Monthly Payment · January 2027300,00 zł')
    await fire.click(button('Credit Card Payment, January 2027'))
    expect(screen.getByRole('heading', { name: 'January 2027' })).toBeTruthy()
    expect(screenText('bill')).toContain('Amount300,00 zł')
  })

  it('opens a bill payment from History on its own month', async () => {
    await openAlex()
    await fire.click(tab('History'))
    await fire.change(screen.getByLabelText('Period'), { target: { value: 'month:2026-08' } })
    await fire.change(screen.getByLabelText('Type'), { target: { value: 'bill' } })
    await fire.click(within(document.querySelector<HTMLElement>('.history-months')!).getAllByRole('button', { name: /Credit Card Payment/ })[0])
    expect(screen.getByRole('heading', { name: 'August 2026' })).toBeTruthy()
    expect(monthSelect().value).toBe('2026-08')
  })
})

describe('Home blocks open and close', () => {
  it('starts with This Month and Left to Pay open and the other five closed, with their period and a summary', async () => {
    await openAlex()
    expect(BLOCKS.map(name => toggleOf(name).getAttribute('aria-expanded'))).toEqual(['true', 'true', 'false', 'false', 'false', 'false', 'false'])
    expect(text(toggleOf('Spending by Category'))).toBe('Spending by CategoryDecember 2026Spent 5097,35 zł')
    expect(text(toggleOf('Total Debt'))).toBe('Total DebtBalances as of 31 Dec 202612 266,98 zł still owed')
    expect(text(toggleOf('My Money'))).toContain('Daily Spending 2789,91 zł · Investments 500,00 zł · Savings 2900,00 zł')
    expect(text(toggleOf('My Goals'))).toContain('2000,00 zł for 2 goals · Emergency Fund 900,00 zł')
    expect(text(toggleOf('Year Summary'))).toContain('2026 · 12 of 12 months so farResult for 2026: 7216,86 zł')
  })

  it('hides closed content from the keyboard and screen readers, but keeps it', async () => {
    await openAlex()
    expect(bodyOf('Total Debt').hasAttribute('inert')).toBe(true)
    expect(bodyOf('Total Debt').getAttribute('aria-hidden')).toBe('true')
    expect(within(regionOf('Total Debt')).queryByRole('button', { name: /Open Cards/ })).toBeNull()
    await fire.click(toggleOf('Total Debt'))
    expect(toggleOf('Total Debt').getAttribute('aria-expanded')).toBe('true')
    expect(bodyOf('Total Debt').hasAttribute('inert')).toBe(false)
    expect(within(regionOf('Total Debt')).getByRole('button', { name: /Open Cards/ })).toBeTruthy()
    // Several blocks stay open at once.
    expect(toggleOf('This Month').getAttribute('aria-expanded')).toBe('true')
  })

  it('keeps a half-typed amount when its block is closed and opened again', async () => {
    await openAlex()
    await fire.click(toggleOf('Spending by Category'))
    await fire.click(within(regionOf('Spending by Category')).getByRole('button', { name: 'Planned' }))
    await fire.click(within(regionOf('Spending by Category')).getByRole('button', { name: /Housing/ }))
    await fire.click(button('Change Rent (studio) amount for December 2026'))
    await fire.change(screen.getByLabelText(/^Rent \(studio\) for December 2026/), { target: { value: '1234' } })
    await fire.click(toggleOf('Spending by Category'))
    expect(text(toggleOf('Spending by Category'))).toContain('Planned 6401,84 zł')
    await fire.click(toggleOf('Spending by Category'))
    expect((screen.getByLabelText(/^Rent \(studio\) for December 2026/) as HTMLInputElement).value).toBe('1234')
  })

  it('never opens or closes a block from its eye or its links', async () => {
    await openAlex()
    await fire.click(button('Hide amounts in Total Debt'))
    expect(toggleOf('Total Debt').getAttribute('aria-expanded')).toBe('false')
    await fire.click(button('Hide amounts in Left to Pay'))
    expect(toggleOf('Left to Pay').getAttribute('aria-expanded')).toBe('true')
    // No button inside another button.
    expect(document.querySelectorAll('button button')).toHaveLength(0)
  })

  it('hides amounts in closed headers and summaries too', async () => {
    await openAlex()
    await fire.click(button('Hide All Amounts'))
    for (const name of BLOCKS) expect(text(toggleOf(name))).not.toMatch(amount)
    expect(text(toggleOf('Total Debt'))).toContain('•••• still owed')
    await fire.click(button('Show amounts in My Money'))
    expect(text(toggleOf('My Money'))).toMatch(amount)
    expect(text(toggleOf('My Goals'))).not.toMatch(amount)
  })

  it('opens and closes all blocks at once', async () => {
    await openAlex()
    await chooseHomeOption('Expand All')
    expect(BLOCKS.every(name => toggleOf(name).getAttribute('aria-expanded') === 'true')).toBe(true)
    await chooseHomeOption('Collapse All')
    expect(BLOCKS.every(name => toggleOf(name).getAttribute('aria-expanded') === 'false')).toBe(true)
  })

  it('says unknown balances are unknown, never 0', async () => {
    await createOwnSpace()
    expect(text(toggleOf('Total Debt'))).toContain('No cards or loans yet')
    expect(text(toggleOf('My Money'))).toContain('No accounts yet')
    expect(text(toggleOf('My Goals'))).toContain('No goals yet')
    expect(text(toggleOf('Spending by Category'))).toContain('Spent · Nothing recorded')
  })
})

describe('Customize Home', () => {
  it('moves blocks only in Customize Home, with Move up and Move down, and Done ends it', async () => {
    await openAlex()
    expect(screen.queryByRole('button', { name: /^Move (up|down)/ })).toBeNull()
    await chooseHomeOption('Customize Home')
    expect((button('Move up: This Month') as HTMLButtonElement).disabled).toBe(true)
    await fire.click(button('Move up: Year Summary'))
    expect(order()).toEqual(['month', 'left-to-pay', 'categories', 'debt', 'money', 'year', 'goals'])
    expect(document.activeElement).toBe(button('Move up: Year Summary'))
    expect(text(document.querySelector('.visually-hidden[role="status"]'))).toContain('Year Summary moved to position 6 of 7.')
    await fire.click(button('Move down: This Month'))
    expect(order()[0]).toBe('left-to-pay')
    await fire.click(button('Done'))
    expect(screen.queryByRole('button', { name: /^Move (up|down)/ })).toBeNull()
    expect(order()).toEqual(['left-to-pay', 'month', 'categories', 'debt', 'money', 'year', 'goals'])
  })

  it('Reset Layout brings back the first order and open blocks', async () => {
    await openAlex()
    await chooseHomeOption('Expand All')
    await chooseHomeOption('Customize Home')
    await fire.click(button('Move up: My Money'))
    await fire.click(button('Reset Layout'))
    await fire.click(button('Done'))
    expect(order()).toEqual(['month', 'left-to-pay', 'categories', 'debt', 'money', 'goals', 'year'])
    expect(BLOCKS.map(name => toggleOf(name).getAttribute('aria-expanded'))).toEqual(['true', 'true', 'false', 'false', 'false', 'false', 'false'])
  })

  it('drags a block by its handle', async () => {
    await openAlex()
    await chooseHomeOption('Customize Home')
    const blocks = [...document.querySelectorAll<HTMLElement>('[data-home-block]')]
    blocks.forEach((element, index) => { element.getBoundingClientRect = () => ({ top: index * 100, height: 90, bottom: index * 100 + 90 } as DOMRect) })
    const handle = document.querySelector('[data-home-block="year"] .drag-handle')!
    await fire.pointerDown(handle, { pointerId: 1, button: 0, clientY: 650 })
    await fire.pointerMove(window, { pointerId: 1, clientY: 640 })
    await fire.pointerMove(window, { pointerId: 1, clientY: 20 })
    await fire.pointerUp(window, { pointerId: 1, clientY: 20 })
    expect(order()[0]).toBe('year')
  })

  it('keeps the demo layout only while the demo is open, and Reset Demo restores it', async () => {
    const { storage } = await openAlex()
    await chooseHomeOption('Customize Home')
    await fire.click(button('Move up: Year Summary'))
    await fire.click(button('Done'))
    await fire.click(toggleOf('My Money'))
    await fire.click(tab('Bills'))
    await fire.click(tab('Home'))
    expect(order()[5]).toBe('year')
    expect(toggleOf('My Money').getAttribute('aria-expanded')).toBe('true')
    // Nothing of the demo is written to this device.
    expect(storage.getItem('goal-planning-app.home-layout')).toBeNull()
    expect(storage.getItem('goal-planning-app.my-space')).toBeNull()
    expect(await storedData()).toBeNull()
    await startDemoReset()
    await fire.click(within(screen.getByRole('group', { name: 'Reset demo?' })).getByRole('button', { name: 'Reset Demo' }))
    expect(order()).toEqual(['month', 'left-to-pay', 'categories', 'debt', 'money', 'goals', 'year'])
    expect(toggleOf('My Money').getAttribute('aria-expanded')).toBe('false')
  })

  it('remembers the own space’s layout after reopening the app, apart from the demo', async () => {
    const { storage } = await createOwnSpace()
    await chooseHomeOption('Customize Home')
    await fire.click(button('Move down: This Month'))
    await fire.click(button('Done'))
    await fire.click(toggleOf('Year Summary'))
    cleanup()
    render(<App getToday={() => '2026-10-21'} storage={storage} />)
    await settle()
    expect(order().slice(0, 2)).toEqual(['left-to-pay', 'month'])
    expect(toggleOf('Year Summary').getAttribute('aria-expanded')).toBe('true')
  })

  it('reads a broken saved layout without losing or repeating a block', async () => {
    const { storage } = await createOwnSpace()
    const spaceId = (await storedData())!.space.id
    storage.setItem('goal-planning-app.home-layout', JSON.stringify({ spaceId, layout: { order: ['year', 'year', 'nope'], open: 'all' } }))
    cleanup()
    render(<App getToday={() => '2026-10-21'} storage={storage} />)
    await settle()
    expect(order()).toEqual(['year', 'month', 'left-to-pay', 'categories', 'debt', 'money', 'goals'])
    storage.setItem('goal-planning-app.home-layout', '{not json')
    cleanup()
    render(<App getToday={() => '2026-10-21'} storage={storage} />)
    await settle()
    expect(order()).toEqual(['month', 'left-to-pay', 'categories', 'debt', 'money', 'goals', 'year'])
  })
})

describe('Fixes from the manual review', () => {
  it('says “Nothing left to pay” for a card with no balance, with no estimate or savings', async () => {
    await openAlex()
    await fire.click(tab('Cards'))
    await fire.click(screen.getAllByRole('button', { name: /^Credit Card/ })[0])
    const debt = screenText('debt')
    expect(debt).toContain('Nothing left to pay on the balance of 31 Dec 2026.')
    expect(debt).not.toContain('About 0 months')
    expect(screen.queryByText('What If I Pay Extra?')).toBeNull()
  })

  it('names the demo’s date in estimates instead of “today”', async () => {
    await openAlex()
    await fire.click(tab('Cards'))
    await fire.click(screen.getAllByRole('button', { name: /^Student Loan/ })[0])
    expect(screenText('debt')).toContain('Calculated on 31 Dec 2026 (the demo’s date)')
    expect(screenText('debt')).not.toMatch(/Calculated today/)
    await fire.click(button('Go to Home'))
    await fire.click(toggleOf('My Goals'))
    await fire.click(within(regionOf('My Goals')).getByRole('button', { name: /Trip to Japan/ }))
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Trip to Japan' })).toBeTruthy())
    await fire.click(button('Try an Amount or Date'))
    expect(screenText('goal')).toContain('worked out from 31 Dec 2026 (the demo’s date)')
    expect(screenText('goal')).not.toMatch(/from today/)
  })

  it('says “today” in the own space, where it is really today', async () => {
    await createOwnSpace()
    await fire.click(tab('Cards'))
    await fire.click(button(/Add Card or Loan/))
    await fire.change(screen.getByLabelText('Name'), { target: { value: 'Bank Loan' } })
    await fire.change(screen.getByLabelText(/^Remaining Balance/), { target: { value: '1000' } })
    await fire.change(screen.getByLabelText('Yearly Interest (%)'), { target: { value: '10' } })
    await fire.change(screen.getByLabelText(/^Monthly Payment/), { target: { value: '100' } })
    await fire.change(screen.getByLabelText('Payment Due Day'), { target: { value: '5' } })
    await fire.click(button('Add'))
    expect(screenText('debt')).toContain('Calculated on today (21 Oct 2026)')
  })

  it('explains when every saving already has a purpose', async () => {
    await openAlex()
    await fire.click(toggleOf('My Goals'))
    await fire.click(within(regionOf('My Goals')).getByRole('button', { name: /Trip to Japan/ }))
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Trip to Japan' })).toBeTruthy())
    await fire.click(screen.getByRole('radio', { name: /Savings I already have/ }))
    await fire.change(screen.getByLabelText('Amount (PLN)'), { target: { value: '50' } })
    await fire.click(button('Save Contribution'))
    expect(screenText('goal')).toContain('All your savings already have a purpose. Reduce another allocation first, or choose New savings if you’re adding new money.')
    expect(screenText('goal')).not.toContain('Only 0,00 zł')
  })

  it('describes each savings movement in History, newest entry first on the same day', async () => {
    await openAlex()
    await fire.click(toggleOf('My Goals'))
    await fire.click(within(regionOf('My Goals')).getByRole('button', { name: /Trip to Japan/ }))
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Trip to Japan' })).toBeTruthy())
    await fire.click(screen.getByRole('radio', { name: /New savings/ }))
    await fire.change(screen.getByLabelText('Amount (PLN)'), { target: { value: '100' } })
    await fire.click(button('Save Contribution'))
    await fire.click(within(screen.getByRole('group', { name: 'Type of change' })).getByRole('button', { name: 'Withdraw' }))
    await fire.click(screen.getByRole('radio', { name: /Back to unassigned savings/ }))
    await fire.change(screen.getByLabelText('Amount (PLN)'), { target: { value: '30' } })
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 5)) })
    await fire.click(button('Save Withdrawal'))
    await fire.click(button('Go to Home'))
    await fire.click(tab('History'))
    const rows = [...document.querySelectorAll('.history-list > li')].map(text)
    expect(text(document.querySelector('.history-day-title'))).toBe('Thursday 31 December 2026')
    expect(rows[0]).toContain('Released from a goalTrip to JapanBack to unassigned savings · Savings total unchanged')
    expect(rows[1]).toContain('Savings addedTrip to JapanNew savings · Into Savings Account')
  })
})
