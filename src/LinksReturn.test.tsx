// @vitest-environment jsdom
import { chooseMonth } from './test/monthPicker'
import { cleanup, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { classicHome } from './test/memoryStorage'
import { fire, settle, freshDatabaseForEachTest } from './test/space'

freshDatabaseForEachTest()

// Exact links and the way back (Rumbo de diseño, item 2): a link opens the account,
// record or period it comes from when that is known; Income on Home names the
// month's sources instead of choosing one; Back finds Goals, History and Home as
// they were, with the focus on what was used. Income keeps its own view: opening
// it for a month never changes the month shared by Home, Bills and Cards & Loans.
// Alex's demo is shown on its own date, 31 Dec 2026.
afterEach(() => { cleanup(); vi.restoreAllMocks() })

const button = (name: string | RegExp) => screen.getByRole('button', { name })
const text = (element: Element | null) => (element?.textContent ?? '').replace(/\u00a0|\u202f/g, ' ')
const tab = (name: string) => within(screen.getByRole('navigation', { name: 'Main navigation' })).getByRole('button', { name })
const regionOf = (name: string) => screen.getByRole('region', { name })
const shownScreen = () => document.querySelector('main [data-screen]')?.getAttribute('data-screen')
const monthSelect = () => screen.getByRole('button', { name: /^Choose month:/ }) as HTMLButtonElement
const pickMonth = async (month: string) => await chooseMonth(month)
const homeStat = (name: 'Income' | 'Spent') => document.querySelector<HTMLElement>(`[data-return-key="stat-${name.toLowerCase()}"]`)!
const browserBack = async () => { window.history.back(); await settle() }
const context = () => document.getElementById('income-context')

async function openAlex() {
  render(<App getToday={() => '2026-10-25'} storage={classicHome()} />)
  await settle()
  await fire.click(button('Explore the App'))
}

/** Pretends the page was scrolled, and records where the app scrolls back to. */
function trackScroll() {
  const scrolled: number[] = []
  vi.spyOn(window, 'scrollTo').mockImplementation(((_x: number, y: number) => { scrolled.push(y) }) as typeof window.scrollTo)
  const at = (y: number) => Object.defineProperty(window, 'scrollY', { value: y, configurable: true })
  return { scrolled, at }
}

describe('Back to Goals', () => {
  it('keeps the filter, the place and the focus on the goal that was opened', async () => {
    const { scrolled, at } = trackScroll()
    await openAlex()
    await fire.click(tab('Goals'))
    await fire.click(button('Flexible'))
    at(420)
    const goal = () => document.querySelectorAll<HTMLElement>('[data-screen="goals"] .goal-cards .goal-card')[1]
    const name = goal().getAttribute('data-return-key')
    await fire.click(goal())
    expect(shownScreen()).toBe('goal')
    at(0)
    await fire.click(button('Back'))
    expect(shownScreen()).toBe('goals')
    expect(button('Flexible').getAttribute('aria-pressed')).toBe('true')
    expect(document.activeElement).toBe(goal())
    expect(goal().getAttribute('data-return-key')).toBe(name)
    expect(scrolled.at(-1)).toBe(420)
  })

  it('goes back to the Emergency Fund card and to Add Goal', async () => {
    await openAlex()
    await fire.click(tab('Goals'))
    const fund = () => within(regionOf('Emergency Fund')).getByRole('button')
    await fire.click(fund())
    await fire.click(button('Back'))
    expect(document.activeElement).toBe(fund())
    await fire.click(button('Add Goal'))
    expect(shownScreen()).toBe('new-goal')
    await fire.click(button('Cancel'))
    expect(shownScreen()).toBe('goals')
    expect(document.activeElement).toBe(button('Add Goal'))
  })
})

describe('Back to History', () => {
  it.each(['Student Loan', 'Small Loan', 'Credit Card'])('opens the balance of %s and returns to the same History record', async name => {
    const { scrolled, at } = trackScroll()
    await openAlex()
    await fire.click(tab('History'))
    const record = () => screen.getAllByRole('button', { name: new RegExp(`^Balance update${name}`) })[0]
    expect(screen.getAllByRole('button', { name: new RegExp(`^Balance update${name}.*Open card or loan$`) })).toContain(record())
    const key = record().getAttribute('data-return-key')
    at(640)
    await fire.click(record())
    expect(shownScreen()).toBe('debt')
    expect(screen.getByRole('heading', { level: 1, name })).toBeTruthy()
    expect(regionOf('Remaining Balance')).toBeTruthy()
    at(0)
    await fire.click(button('Back'))
    expect(shownScreen()).toBe('history')
    expect(document.activeElement?.getAttribute('data-return-key')).toBe(key)
    expect(scrolled.at(-1)).toBe(640)
  })

  it('opens a balance on its account in Money, and Back puts the focus on that record', async () => {
    const { scrolled, at } = trackScroll()
    await openAlex()
    await fire.click(tab('History'))
    const record = () => screen.getAllByRole('button', { name: /^Balance updateSavings Account/ })[0]
    expect(screen.getAllByRole('button', { name: /^Balance updateSavings Account.*Open account$/ })).toContain(record())
    const key = record().getAttribute('data-return-key')
    at(420)
    await fire.click(record())
    expect(shownScreen()).toBe('money')
    const accounts = regionOf('Accounts & Savings')
    expect(within(accounts).getByRole('button', { name: /^Savings Account/ }).getAttribute('aria-expanded')).toBe('true')
    at(0)
    await browserBack()
    expect(shownScreen()).toBe('history')
    expect(document.activeElement?.getAttribute('data-return-key')).toBe(key)
    expect(scrolled.at(-1)).toBe(420)
  })

  it('focuses the section heading when History is explicitly selected from Money or Home', async () => {
    const { at } = trackScroll()
    await openAlex()
    await fire.click(tab('History'))
    const record = () => screen.getAllByRole('button', { name: /^Balance updateSavings Account/ })[0]
    at(580)
    await fire.click(record())
    at(0)
    await fire.click(tab('History'))
    expect(shownScreen()).toBe('history')
    expect(document.activeElement).toBe(screen.getByRole('heading', { level: 1, name: 'History' }))
    await fire.click(tab('Home'))
    await fire.click(tab('History'))
    expect(document.activeElement).toBe(screen.getByRole('heading', { level: 1, name: 'History' }))
  })
})

describe('Income on Home', () => {
  it('with several sources in the month, names them all and opens none; one tap opens it on that month', async () => {
    await openAlex()
    await pickMonth('2026-03')
    await fire.click(homeStat('Income'))
    expect(shownScreen()).toBe('money')
    // No source is chosen for the person.
    const income = regionOf('Income')
    expect(within(income).queryAllByRole('button', { expanded: true }).filter(b => /^(Part-time Job|Scholarship|Salary)/.test(b.textContent ?? ''))).toHaveLength(0)
    expect(document.activeElement).toBe(context())
    expect(text(context())).toContain('Income on Home for March 2026')
    expect(text(context())).toContain('It comes from 2 sources.')
    // Both ended in June, so the list shows All to find them.
    expect(within(within(income).getByRole('group', { name: 'Show income sources' })).getByRole('button', { name: /^All/ }).getAttribute('aria-pressed')).toBe('true')
    await fire.click(within(context()!).getByRole('button', { name: 'Scholarship' }))
    expect(within(income).getByRole('button', { name: /^Scholarship/, expanded: true })).toBeTruthy()
    expect((screen.getByLabelText('Payments of Scholarship') as HTMLSelectElement).value).toBe('2026')
    expect(document.activeElement).toBe(button('Change: Scholarship, March 2026'))
    expect(document.querySelector('[data-income-row="scholarship:2026-03"]')?.classList.contains('is-target')).toBe(true)
    // Income keeps its own view: the shared month did not move.
    await fire.click(tab('Home'))
    expect(monthSelect().value).toBe('2026-03')
  })

  it('with one source, opens it on that month’s payment; Back goes to the Income figure on Home', async () => {
    await openAlex()
    await pickMonth('2026-10')
    await fire.click(homeStat('Income'))
    expect(document.activeElement).toBe(button('Change: Salary, October 2026'))
    expect(text(context())).toContain('It comes from Salary.')
    await fire.click(within(context()!).getByRole('button', { name: 'Close' }))
    expect(context()).toBeNull()
    await browserBack()
    expect(shownScreen()).toBe('home')
    expect(document.activeElement).toBe(homeStat('Income'))
    expect(monthSelect().value).toBe('2026-10')
  })

  it('with no source in the month, says so without opening one', async () => {
    await openAlex()
    await pickMonth('2026-07')
    await fire.click(homeStat('Income'))
    expect(text(context())).toMatch(/No income is expected or recorded for that month|recorded without a source/)
    expect(within(context()!).queryByRole('button', { name: /Part-time Job|Scholarship|Salary/ })).toBeNull()
  })
})

describe('Spent on Home', () => {
  it('opens History on that month, with no search or filter, and Back goes to the Spent figure', async () => {
    await openAlex()
    await pickMonth('2026-08')
    await fire.click(homeStat('Spent'))
    expect(shownScreen()).toBe('history')
    expect((screen.getByLabelText('Period') as HTMLSelectElement).value).toBe('month:2026-08')
    expect((screen.getByLabelText('Search by name or note') as HTMLInputElement).value).toBe('')
    await fire.click(tab('Home'))
    expect(monthSelect().value).toBe('2026-08')
  })

  it('Back from History returns to the Spent figure on Home', async () => {
    await openAlex()
    await fire.click(homeStat('Spent'))
    await browserBack()
    expect(shownScreen()).toBe('home')
    expect(document.activeElement).toBe(homeStat('Spent'))
  })
})
