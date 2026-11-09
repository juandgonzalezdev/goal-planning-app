// @vitest-environment jsdom
import { chooseMonth } from './test/monthPicker'
import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import App from './App'
import { memoryStorage } from './test/memoryStorage'
import { fire, settle, storedData, storedSpace, freshDatabaseForEachTest } from './test/space'
import { openCardsAndLoans } from './test/money'
import { chooseHomeOption, startDemoReset } from './test/homeControls'

freshDatabaseForEachTest()

// The shared month, Home's three areas and their parts (open, closed, order) and the fixes found in the manual review.
// Alex's demo is shown on its own date, 31 Dec 2026; the device date is in October.
afterEach(() => { cleanup(); document.documentElement.removeAttribute('data-theme') })

const button = (name: string | RegExp) => screen.getByRole('button', { name })
const text = (element: Element | null) => (element?.textContent ?? '').replace(/\u00a0|\u202f/g, ' ')
const tab = (name: string) => within(screen.getByRole('navigation', { name: 'Main navigation' })).getByRole('button', { name })
const regionOf = (name: string) => screen.getByRole('region', { name, hidden: true })
const toggleOf = (name: string) => regionOf(name).querySelector<HTMLButtonElement>('.block-toggle')!
const bodyOf = (name: string) => regionOf(name).querySelector('.block-body')!
const monthSelect = () => screen.getByRole('button', { name: /^Choose month:/ }) as HTMLButtonElement
const pickMonth = async (month: string) => await chooseMonth(month)
const screenText = (name: string) => text(document.querySelector(`[data-screen="${name}"]`))
const areas = () => [...document.querySelectorAll<HTMLElement>('[data-home-area]')].map(element => element.dataset.homeArea)
const amount = /\d,\d\d zł/
/** The five parts of Home that open and close. */
const PARTS = ['Spending by Category', 'Year Summary', 'Accounts & Savings', 'Cards & Loans', 'Goals']

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

describe('One month for Home, Bills, Cards & Loans and their details', () => {
  it('changes the month in Bills and Home shows it, and the other way round', async () => {
    await openAlex()
    await fire.click(tab('Bills'))
    await pickMonth('2026-01')
    await fire.click(tab('Home'))
    expect(monthSelect().value).toBe('2026-01')
    expect(text(toggleOf('This Month'))).toContain('January 2026')
    await fire.click(button('Next month'))
    await openCardsAndLoans()
    expect(monthSelect().value).toBe('2026-02')
    expect(screenText('money')).toContain('Monthly Payments · February 2026')
  })

  it('changes the month inside a bill and inside a card, and Home follows', async () => {
    await openAlex()
    await openCardsAndLoans()
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

  it('continues beyond the original month choices', async () => {
    await openAlex()
    await pickMonth('2027-01')
    await fire.click(button('Next month'))
    expect(monthSelect().value).toBe('2027-02')
    await pickMonth('2026-01')
    await fire.click(button('Previous month'))
    expect(monthSelect().value).toBe('2025-12')
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
    await openCardsAndLoans()
    expect(screenText('money')).toContain('December 2026 payment 2489,27 zł (this month only)')
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
    await openCardsAndLoans()
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

describe('Home in three areas', () => {
  it('shows the three areas with their figures, and five closed parts, each with its period and a summary', async () => {
    await openAlex()
    expect(areas()).toEqual(['month', 'left-to-pay', 'money-goals'])
    expect(PARTS.map(name => toggleOf(name).getAttribute('aria-expanded'))).toEqual(['false', 'false', 'false', 'false', 'false'])
    // This Month starts expanded, with its period and privacy action available.
    expect(toggleOf('This Month').getAttribute('aria-expanded')).toBe('true')
    expect(text(toggleOf('This Month'))).toBe('This MonthDecember 2026')
    expect(text(regionOf('This Month'))).toContain('Result')
    expect(text(regionOf('Left to Pay').querySelector('.area-title'))).toBe('Left to PayDecember 2026')
    expect(text(regionOf('Money & Goals').querySelector('.area-title'))).toBe('Money & GoalsLatest balances by 31 Dec 2026')
    expect(text(toggleOf('Spending by Category'))).toBe('Spending by CategoryDecember 2026Spent 5097,35 zł')
    expect(text(toggleOf('Year Summary'))).toBe('Year Summary2026 · 12 of 12 months so farResult for 2026: 7216,86 zł')
    expect(text(toggleOf('Cards & Loans'))).toBe('Cards & LoansBalances as of 31 Dec 202612 266,98 zł Remaining Balance')
    expect(text(toggleOf('Accounts & Savings'))).toContain('Daily Spending 2789,91 zł · Investments 500,00 zł · Savings 2900,00 zł')
    expect(text(toggleOf('Goals'))).toContain('2000,00 zł for 2 goals, part of Savings · Emergency Fund 900,00 zł')
  })

  it('names the date Money & Goals really uses, and keeps each balance’s own date and unknown balances', async () => {
    await openAlex()
    await pickMonth('2026-08')
    // A past month: the end of that month.
    expect(text(regionOf('Money & Goals').querySelector('.area-title'))).toBe('Money & GoalsLatest balances by 31 Aug 2026')
    expect(text(regionOf('Money & Goals'))).toContain('Each line uses the latest balance entered by 31 Aug 2026, with its own date. These are not this month’s figures.')
    expect(text(toggleOf('Cards & Loans'))).toContain('Balances as of 31 Aug 2026')
    cleanup()
    await createOwnSpace()
    // The month still going, and a month to come: today (21 Oct 2026), the last day anything can be entered.
    expect(text(regionOf('Money & Goals').querySelector('.area-title'))).toBe('Money & GoalsLatest balances by 21 Oct 2026')
    await pickMonth('2026-11')
    expect(text(regionOf('Money & Goals').querySelector('.area-title'))).toBe('Money & GoalsLatest balances by 21 Oct 2026')
    expect(text(toggleOf('Cards & Loans'))).toContain('No cards or loans yet')
    expect(text(toggleOf('Accounts & Savings'))).toContain('No accounts yet')
  })

  it('names the year of the month shown in Year Summary, open and closed', async () => {
    await openAlex()
    await pickMonth('2027-01')
    expect(text(toggleOf('Year Summary'))).toBe('Year Summary2027 · 0 of 12 months so farNothing has happened in 2027 yet')
    await fire.click(toggleOf('Year Summary'))
    expect(text(toggleOf('Year Summary'))).toBe('Year Summary2027 · 0 of 12 months so far')
    expect(text(regionOf('Year Summary'))).toContain('Income in 2027')
    await pickMonth('2026-12')
    expect(text(toggleOf('Year Summary'))).toContain('2026 · 12 of 12 months so far')
    expect(text(regionOf('Year Summary'))).toContain('Income in 2026')
  })

  it('hides closed content from the keyboard and screen readers, but keeps it', async () => {
    await openAlex()
    expect(bodyOf('Cards & Loans').hasAttribute('inert')).toBe(true)
    expect(bodyOf('Cards & Loans').getAttribute('aria-hidden')).toBe('true')
    expect(within(regionOf('Cards & Loans')).queryByRole('button', { name: /Open Cards/ })).toBeNull()
    await fire.click(toggleOf('Cards & Loans'))
    expect(toggleOf('Cards & Loans').getAttribute('aria-expanded')).toBe('true')
    expect(bodyOf('Cards & Loans').hasAttribute('inert')).toBe(false)
    expect(within(regionOf('Cards & Loans')).getByRole('button', { name: /Open Cards/ })).toBeTruthy()
    // Several parts stay open at once.
    await fire.click(toggleOf('Year Summary'))
    expect(toggleOf('Cards & Loans').getAttribute('aria-expanded')).toBe('true')
  })

  it('keeps a half-typed amount when its part is closed and opened again', async () => {
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

  it('never opens or closes a part from an eye or a link', async () => {
    await openAlex()
    await fire.click(button('Hide amounts in Money & Goals'))
    expect(PARTS.map(name => toggleOf(name).getAttribute('aria-expanded'))).toEqual(['false', 'false', 'false', 'false', 'false'])
    await fire.click(button('Hide amounts in This Month'))
    expect(toggleOf('Year Summary').getAttribute('aria-expanded')).toBe('false')
    // No button inside another button.
    expect(document.querySelectorAll('button button')).toHaveLength(0)
  })

  it('hides amounts in closed headers and summaries too, area by area', async () => {
    await openAlex()
    await fire.click(button('Hide amounts'))
    for (const name of PARTS) expect(text(toggleOf(name))).not.toMatch(amount)
    expect(text(toggleOf('Cards & Loans'))).toContain('•••• Remaining Balance')
    await fire.click(button('Show amounts in Money & Goals'))
    expect(text(toggleOf('Accounts & Savings'))).toMatch(amount)
    expect(text(toggleOf('Goals'))).toMatch(amount)
    expect(text(toggleOf('Year Summary'))).not.toMatch(amount)
    expect(text(regionOf('Left to Pay'))).not.toMatch(amount)
  })

  it('opens and closes This Month and the five parts at once; compact headers stay', async () => {
    const storage = memoryStorage()
    storage.setItem('goal-planning-app.home-rings', 'yes')
    await openAlex(storage)
    await chooseHomeOption('Expand All')
    expect(PARTS.every(name => toggleOf(name).getAttribute('aria-expanded') === 'true')).toBe(true)
    await chooseHomeOption('Collapse All')
    expect(PARTS.every(name => toggleOf(name).getAttribute('aria-expanded') === 'false')).toBe(true)
    expect(areas()).toEqual(['month', 'left-to-pay', 'money-goals'])
    expect(toggleOf('This Month').getAttribute('aria-expanded')).toBe('false')
    expect(bodyOf('This Month').hasAttribute('inert')).toBe(true)
    expect(bodyOf('This Month').getAttribute('aria-hidden')).toBe('true')
    expect(within(regionOf('This Month')).queryByRole('button', { name: /^Income/ })).toBeNull()
    expect(screen.getByRole('button', { name: /^This Month/ })).toBe(toggleOf('This Month'))
    expect(text(toggleOf('This Month'))).toContain('December 2026')
    expect(toggleOf('All areas').getAttribute('aria-expanded')).toBe('false')
    await fire.click(toggleOf('This Month'))
    expect(toggleOf('This Month').getAttribute('aria-expanded')).toBe('true')
    expect(bodyOf('This Month').hasAttribute('inert')).toBe(false)
    expect(within(regionOf('This Month')).getByRole('button', { name: /^Income/ })).toBeTruthy()
    await chooseHomeOption('Collapse All')
    await pickMonth('2026-08')
    expect(text(toggleOf('This Month'))).toContain('August 2026')
    expect(toggleOf('This Month').getAttribute('aria-expanded')).toBe('false')
    await fire.click(button('Hide amounts in This Month'))
    await chooseHomeOption('Expand All')
    expect(toggleOf('This Month').getAttribute('aria-expanded')).toBe('true')
    expect(toggleOf('All areas').getAttribute('aria-expanded')).toBe('true')
    expect(text(regionOf('This Month'))).not.toMatch(amount)
    expect(button('Show amounts in This Month')).toBeTruthy()
    await fire.click(toggleOf('This Month'))
    await chooseHomeOption('Customize Home')
    await fire.click(button('Move down: This Month'))
    await fire.click(button('Done'))
    expect(toggleOf('This Month').getAttribute('aria-expanded')).toBe('false')
    expect(button('Show amounts in This Month')).toBeTruthy()
    const order = areas()
    await chooseHomeOption('Expand All')
    expect(areas()).toEqual(order)
    await fire.click(button('Show amounts in This Month'))
    expect(text(regionOf('This Month'))).toMatch(amount)
  })

  it('says unknown balances are unknown, never 0', async () => {
    await createOwnSpace()
    expect(text(toggleOf('Cards & Loans'))).toContain('No cards or loans yet')
    expect(text(toggleOf('Accounts & Savings'))).toContain('No accounts yet')
    expect(text(toggleOf('Goals'))).toContain('No goals yet')
    expect(text(toggleOf('Spending by Category'))).toContain('Spent · Nothing recorded')
  })
})

describe('Customize Home', () => {
  it('moves areas only in Customize Home, with Move up and Move down, and Done ends it', async () => {
    await openAlex()
    expect(screen.queryByRole('button', { name: /^Move (up|down)/ })).toBeNull()
    await chooseHomeOption('Customize Home')
    expect((button('Move up: This Month') as HTMLButtonElement).disabled).toBe(true)
    expect((button('Move down: Money & Goals') as HTMLButtonElement).disabled).toBe(true)
    await fire.click(button('Move up: Money & Goals'))
    expect(areas()).toEqual(['month', 'money-goals', 'left-to-pay'])
    expect(document.activeElement).toBe(button('Move up: Money & Goals'))
    expect(text(document.querySelector('.home-screen .visually-hidden[role="status"]'))).toContain('Money & Goals moved to position 2 of 3.')
    await fire.click(button('Move down: This Month'))
    expect(areas()[0]).toBe('money-goals')
    await fire.click(button('Done'))
    expect(screen.queryByRole('button', { name: /^Move (up|down)/ })).toBeNull()
    expect(areas()).toEqual(['money-goals', 'month', 'left-to-pay'])
  })

  it('Reset Layout brings back the first order with every part closed, and never shows hidden amounts', async () => {
    await openAlex()
    await chooseHomeOption('Expand All')
    await fire.click(button('Hide amounts in Left to Pay'))
    await chooseHomeOption('Customize Home')
    await fire.click(button('Move up: Money & Goals'))
    await fire.click(button('Reset Layout'))
    await fire.click(button('Done'))
    expect(areas()).toEqual(['month', 'left-to-pay', 'money-goals'])
    expect(PARTS.map(name => toggleOf(name).getAttribute('aria-expanded'))).toEqual(['false', 'false', 'false', 'false', 'false'])
    expect(text(regionOf('Left to Pay'))).not.toMatch(amount)
    expect(button('Show amounts in Left to Pay')).toBeTruthy()
  })

  it('drags an area by its handle', async () => {
    await openAlex()
    await chooseHomeOption('Customize Home')
    const blocks = [...document.querySelectorAll<HTMLElement>('[data-home-area]')]
    blocks.forEach((element, index) => { element.getBoundingClientRect = () => ({ top: index * 100, height: 90, bottom: index * 100 + 90 } as DOMRect) })
    const handle = document.querySelector('[data-home-area="money-goals"] .drag-handle')!
    await fire.pointerDown(handle, { pointerId: 1, button: 0, clientY: 250 })
    await fire.pointerMove(window, { pointerId: 1, clientY: 240 })
    await fire.pointerMove(window, { pointerId: 1, clientY: 20 })
    await fire.pointerUp(window, { pointerId: 1, clientY: 20 })
    expect(areas()[0]).toBe('money-goals')
  })

  it('keeps the demo layout only while the demo is open, and Reset Demo restores it', async () => {
    const { storage } = await openAlex()
    await chooseHomeOption('Customize Home')
    await fire.click(button('Move up: Money & Goals'))
    await fire.click(button('Done'))
    await fire.click(toggleOf('Accounts & Savings'))
    await fire.click(tab('Bills'))
    await fire.click(tab('Home'))
    expect(areas()[1]).toBe('money-goals')
    expect(toggleOf('Accounts & Savings').getAttribute('aria-expanded')).toBe('true')
    // Nothing of the demo is written to this device.
    expect(storage.getItem('goal-planning-app.home-layout')).toBeNull()
    expect(storage.getItem('goal-planning-app.my-space')).toBeNull()
    expect(await storedData()).toBeNull()
    await startDemoReset()
    await fire.click(within(screen.getByRole('group', { name: 'Reset demo?' })).getByRole('button', { name: 'Reset Demo' }))
    expect(areas()).toEqual(['month', 'left-to-pay', 'money-goals'])
    expect(toggleOf('Accounts & Savings').getAttribute('aria-expanded')).toBe('false')
  })

  it('remembers the own space’s layout after reopening the app, apart from the demo', async () => {
    const { storage } = await createOwnSpace()
    await chooseHomeOption('Customize Home')
    await fire.click(button('Move down: This Month'))
    await fire.click(button('Done'))
    await fire.click(toggleOf('Year Summary'))
    await fire.click(toggleOf('This Month'))
    const spaceId = (await storedData())!.space.id
    expect(JSON.parse(storage.getItem('goal-planning-app.home-layout')!)).toEqual({ spaceId, layout: { version: 2, order: ['left-to-pay', 'month', 'money-goals'], open: ['year'], monthOpen: false } })
    cleanup()
    render(<App getToday={() => '2026-10-21'} storage={storage} />)
    await settle()
    expect(areas()).toEqual(['left-to-pay', 'month', 'money-goals'])
    expect(toggleOf('This Month').getAttribute('aria-expanded')).toBe('false')
    await fire.click(toggleOf('This Month'))
    expect(toggleOf('Year Summary').getAttribute('aria-expanded')).toBe('true')
  })

  it('reads a broken saved layout without losing or repeating an area', async () => {
    const { storage } = await createOwnSpace()
    const spaceId = (await storedData())!.space.id
    storage.setItem('goal-planning-app.home-layout', JSON.stringify({ spaceId, layout: { version: 2, order: ['money-goals', 'money-goals', 'nope'], open: 'all' } }))
    cleanup()
    render(<App getToday={() => '2026-10-21'} storage={storage} />)
    await settle()
    expect(areas()).toEqual(['money-goals', 'month', 'left-to-pay'])
    expect(PARTS.every(name => toggleOf(name).getAttribute('aria-expanded') === 'false')).toBe(true)
    storage.setItem('goal-planning-app.home-layout', '{not json')
    cleanup()
    render(<App getToday={() => '2026-10-21'} storage={storage} />)
    await settle()
    expect(areas()).toEqual(['month', 'left-to-pay', 'money-goals'])
  })
})

describe('Fixes from the manual review', () => {
  it('says “Nothing left to pay” for a card with no balance, with no estimate or savings', async () => {
    await openAlex()
    await openCardsAndLoans()
    await fire.click(screen.getAllByRole('button', { name: /^Credit Card/ })[0])
    const debt = screenText('debt')
    expect(debt).toContain('Nothing left to pay on the balance of 31 Dec 2026.')
    expect(debt).not.toContain('About 0 months')
    expect(screen.queryByText('What If I Pay Extra?')).toBeNull()
  })

  it('names the demo’s date in estimates instead of “today”', async () => {
    await openAlex()
    await openCardsAndLoans()
    await fire.click(screen.getAllByRole('button', { name: /^Student Loan/ })[0])
    expect(screenText('debt')).toContain('Calculated on 31 Dec 2026 (the demo’s date)')
    expect(screenText('debt')).not.toMatch(/Calculated today/)
    await fire.click(button('Go to Home'))
    await fire.click(toggleOf('Goals'))
    await fire.click(within(regionOf('Goals')).getByRole('button', { name: /Trip to Japan/ }))
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Trip to Japan' })).toBeTruthy())
    await fire.click(button('Try an Amount or Date'))
    expect(screenText('goal')).toContain('worked out from 31 Dec 2026 (the demo’s date)')
    expect(screenText('goal')).not.toMatch(/from today/)
  })

  it('says “today” in the own space, where it is really today', async () => {
    await createOwnSpace()
    await openCardsAndLoans()
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
    await fire.click(toggleOf('Goals'))
    await fire.click(within(regionOf('Goals')).getByRole('button', { name: /Trip to Japan/ }))
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Trip to Japan' })).toBeTruthy())
    await fire.click(screen.getByRole('radio', { name: /Savings I already have/ }))
    await fire.change(screen.getByLabelText('Amount (PLN)'), { target: { value: '50' } })
    await fire.click(button('Save Contribution'))
    expect(screenText('goal')).toContain('All your savings already have a purpose. Reduce another allocation first, or choose New savings if you’re adding new money.')
    expect(screenText('goal')).not.toContain('Only 0,00 zł')
  })

  it('describes each savings movement in History, newest entry first on the same day', async () => {
    await openAlex()
    await fire.click(toggleOf('Goals'))
    await fire.click(within(regionOf('Goals')).getByRole('button', { name: /Trip to Japan/ }))
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
