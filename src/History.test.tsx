// @vitest-environment jsdom
import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import App from './App'
import { createAlexDemo } from './data/fixtures/demoAlex'
import { activityLog, filterActivity, NO_FILTER } from './domain/finance/history'
import { memoryStorage } from './test/memoryStorage'
import { fire, freshDatabase, settle, storedSpace, freshDatabaseForEachTest } from './test/space'

freshDatabaseForEachTest()

// History: its own period, the search and More Filters, records by month and
// day a page at a time, and what is kept when coming back from a bill or a
// goal. Alex's demo is shown on its own date, 31 Dec 2026; the device date is in October.
afterEach(() => { cleanup(); document.documentElement.removeAttribute('data-theme') })
beforeEach(() => { window.history.replaceState(null, '') })

const button = (name: string | RegExp) => screen.getByRole('button', { name })
const text = (element: Element | null) => (element?.textContent ?? '').replace(/\u00a0|\u202f/g, ' ')
const tab = (name: string) => within(screen.getByRole('navigation', { name: 'Main navigation' })).getByRole('button', { name })
const field = (label: string | RegExp) => screen.getByLabelText(label) as HTMLInputElement
const months = () => document.querySelector<HTMLElement>('.history-months')!
const monthToggle = (label: string) => within(months()).getByRole('button', { name: new RegExp(`^${label}`) })
const openMonthNames = () => [...document.querySelectorAll('.history-month-title [aria-expanded="true"] .block-name')].map(text)
const count = () => text(document.getElementById('history-count'))
const rowKeys = () => [...document.querySelectorAll('.history-months .history-list > li')].map(li => li.id)
const overviewToggle = () => button(/^Year Overview/)
const search = async (value: string) => await fire.change(field('Search by name or note'), { target: { value } })
const monthSelect = () => screen.getByRole('combobox', { name: 'Month' }) as HTMLSelectElement
const confirmReset = async () => await fire.click(within(screen.getByRole('group', { name: 'Reset demo?' })).getByRole('button', { name: 'Reset Demo' }))
const alex = () => activityLog(createAlexDemo())

async function openHistory(storage: Storage = memoryStorage()) {
  const result = render(<App getToday={() => '2026-10-25'} storage={storage} />)
  await settle()
  await fire.click(button('Explore the App'))
  await fire.click(tab('History'))
  return { storage, ...result }
}

/** Welcome → Create Account → Welcome Setup → Home, as one person. */
async function createOwnSpace() {
  await fire.click(button(/Create Account/))
  await fire.click(button(/Continue Without an Account/))
  await fire.change(screen.getByLabelText('Display Name'), { target: { value: 'Robin' } })
  await fire.click(button(/Continue/))
  await fire.click(button(/Continue/))
  await fire.click(button(/Continue/))
  await fire.click(button('Create My Space'))
}

/** Goes back through the browser history until the tabs show again. */
async function backToTabs() {
  window.history.back()
  await waitFor(() => expect(screen.queryByRole('navigation', { name: 'Main navigation' })).toBeTruthy())
}

describe('History layout', () => {
  it('shows the title, a closed Year Overview, the period and search, More Filters, the count and the months, in that order', async () => {
    await openHistory()
    expect(screen.getByRole('heading', { level: 1, name: 'History' })).toBeTruthy()
    const order = ['.history-overview', '.history-tools', '#history-count', '.history-months'].map(selector => document.querySelector(selector)!)
    for (let i = 1; i < order.length; i++) expect(order[i - 1].compareDocumentPosition(order[i]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(overviewToggle().getAttribute('aria-expanded')).toBe('false')
    expect(text(overviewToggle())).toContain('2026 · all records')
    expect(document.querySelector('.history-overview .block-body')!.hasAttribute('inert')).toBe(true)
    expect(field('Period').value).toBe('year:2026')
    expect(button(/^More Filters/).getAttribute('aria-expanded')).toBe('false')
    expect(count()).toContain('392 records in 2026')
    expect(count()).toContain('Showing 20 of 392')
    // Several months: only the newest one with records is open.
    expect(openMonthNames()).toEqual(['December 2026'])
    expect(text(monthToggle('November 2026'))).toContain('31 records')
    expect(rowKeys()).toHaveLength(20)
  })

  it('opens a one-month period, and the chart chooses it without being filtered itself', async () => {
    await openHistory()
    await fire.click(overviewToggle())
    expect(text(document.querySelector('.history-overview'))).toContain('The chart shows everything recorded in 2026. Search and More Filters change the list only.')
    const chartLabels = () => [...document.querySelectorAll('.history-bars button')].map(b => b.getAttribute('aria-label'))
    const before = chartLabels()
    await search('gift')
    expect(chartLabels()).toEqual(before)
    await search('')
    await fire.click(screen.getByRole('button', { name: name => name.replace(/\u00a0|\u202f/g, ' ').startsWith('July 2026: income 900,00 zł') }))
    expect(field('Period').value).toBe('month:2026-07')
    expect(openMonthNames()).toEqual(['July 2026'])
    expect(count()).toContain('28 records in July 2026')
    // Year Overview stays open while moving around the app.
    await fire.click(tab('Home'))
    await fire.click(tab('History'))
    expect(overviewToggle().getAttribute('aria-expanded')).toBe('true')
    expect(field('Period').value).toBe('month:2026-07')
  })
})

describe('History period', () => {
  it('keeps its own period, apart from the month shared by Home, Bills and Cards', async () => {
    await openHistory()
    await fire.change(field('Period'), { target: { value: 'month:2026-03' } })
    await fire.click(tab('Home'))
    expect(monthSelect().value).toBe('2026-12')
    await fire.change(monthSelect(), { target: { value: '2026-06' } })
    await fire.click(tab('Bills'))
    await fire.click(tab('History'))
    expect(field('Period').value).toBe('month:2026-03')
    await fire.click(tab('Cards'))
    expect(monthSelect().value).toBe('2026-06')
  })
})

describe('History search and filters', () => {
  it('searches names and notes in any case, without the spaces around, and opens every month with results', async () => {
    await openHistory()
    await search('  CHRISTMAS ')
    expect(field('Search by name or note').value).toBe('  CHRISTMAS ')
    expect(count()).toContain('7 records match in 2026')
    expect(openMonthNames()).toEqual(['December 2026', 'November 2026', 'October 2026'])
    // Found by its note only: the note is shown as the user's note, apart from what the app says.
    const row = screen.getAllByRole('button', { name: /Released from a goal/ })[0]
    expect(text(row)).toContain('Back to unassigned savings · Savings total unchanged')
    expect(text(row.querySelector('.history-note'))).toBe('Note: Spent on Christmas gifts')
  })

  it('counts the filters in More Filters, shows them as chips to remove one by one, and keeps them while the panel is closed', async () => {
    await openHistory()
    await fire.click(button(/^More Filters/))
    expect(button(/^More Filters/).getAttribute('aria-expanded')).toBe('true')
    await fire.change(field('Type'), { target: { value: 'spending' } })
    await fire.change(field('Account'), { target: { value: 'everyday' } })
    expect(text(button(/^More Filters/))).toContain('2 on')
    await fire.click(button(/^More Filters/))
    expect(document.getElementById('history-more-filters')!.hidden).toBe(true)
    const chips = screen.getByRole('list', { name: 'Filters on' })
    expect([...chips.querySelectorAll('button')].map(text)).toEqual(['Type: Spending×', 'Account: Everyday Account×'])
    const expected = filterActivity(alex(), { ...NO_FILTER, period: { kind: 'year', year: 2026 }, type: 'spending', accountId: 'everyday' }).length
    expect(count()).toContain(`${expected} records match in 2026`)
    await fire.click(button('Remove filter Type: Spending'))
    expect(field('Type').value).toBe('all')
    expect(field('Account').value).toBe('everyday')
    expect(text(button(/^More Filters/))).toContain('1 on')
  })

  it('clears the search and the filters with Clear Filters, keeping the period, and never changes a record', async () => {
    await openHistory()
    const before = await storedSpace()
    await fire.change(field('Period'), { target: { value: 'month:2026-09' } })
    await search('rent')
    await fire.change(field('Category'), { target: { value: 'Housing' } })
    await fire.click(button('Clear Filters'))
    expect(field('Search by name or note').value).toBe('')
    expect(field('Category').value).toBe('all')
    expect(field('Period').value).toBe('month:2026-09')
    expect(screen.queryByRole('button', { name: 'Clear Filters' })).toBeNull()
    expect(await storedSpace()).toEqual(before)
    await fire.click(tab('Home'))
    expect(text(document.querySelector('[data-screen="home"]'))).toContain('5097,35 zł')
  })

  it('says so when a type has no category, without changing either choice', async () => {
    await openHistory()
    await fire.change(field('Category'), { target: { value: 'Groceries' } })
    await fire.change(field('Type'), { target: { value: 'income' } })
    expect(text(document.querySelector('.filter-conflict'))).toContain('Income records have no category, so nothing can match Category: Groceries.')
    expect(field('Type').value).toBe('income')
    expect(field('Category').value).toBe('Groceries')
    await fire.click(button('Remove Category'))
    expect(field('Category').value).toBe('all')
    expect(document.querySelector('.filter-conflict')).toBeNull()
  })
})

describe('History months', () => {
  it('counts every matching record, shows 20 at a time, and Show More never repeats or skips one', async () => {
    await openHistory()
    const december = filterActivity(alex(), { ...NO_FILTER, period: { kind: 'month', month: '2026-12' } })
    expect(text(monthToggle('December 2026'))).toContain(`${december.length} records`)
    expect(text(document.querySelector('.history-more'))).toContain(`Showing 20 of ${december.length} in December 2026`)
    await fire.click(button('Show More in December 2026'))
    const keys = rowKeys()
    expect(new Set(keys).size).toBe(keys.length)
    expect(keys).toHaveLength(december.length)
    const expected = december.map(entry => `history-${entry.ref.kind === 'expense' ? entry.ref.id : entry.key}`)
    expect(keys).toEqual(expected)
    expect(document.querySelector('.history-more')).toBeNull()
    // Closing the month keeps its count.
    await fire.click(monthToggle('December 2026'))
    expect(text(monthToggle('December 2026'))).toContain(`${december.length} records`)
    expect(rowKeys()).toHaveLength(0)
    // A new search starts again from the first page.
    await search('a')
    expect(rowKeys().length).toBeLessThanOrEqual(20 * openMonthNames().length)
  })

  it('groups records by day, newest first, under a full date', async () => {
    await openHistory()
    const days = [...document.querySelectorAll('.history-months .history-day-title')].map(text)
    expect(days.slice(0, 3)).toEqual(['Thursday 31 December 2026', 'Tuesday 29 December 2026', 'Monday 28 December 2026'])
  })

  it('opens and closes every month with Expand All and Collapse All, and leaves Year Overview and More Filters alone', async () => {
    await openHistory()
    await fire.click(button('Expand All'))
    expect(openMonthNames()).toHaveLength(12)
    expect(overviewToggle().getAttribute('aria-expanded')).toBe('false')
    expect(button(/^More Filters/).getAttribute('aria-expanded')).toBe('false')
    expect(count()).toContain('Showing 240 of 392')
    await fire.click(button('Collapse All'))
    expect(openMonthNames()).toEqual([])
    expect(count()).toContain('Showing 0 of 392')
  })

  it('keeps months closed or opened by hand when the screen shows again', async () => {
    await openHistory()
    await fire.click(monthToggle('December 2026'))
    await fire.click(monthToggle('March 2026'))
    await fire.click(button('Hide All Amounts'))
    await fire.click(tab('Home'))
    await fire.click(tab('History'))
    expect(openMonthNames()).toEqual(['March 2026'])
  })
})

describe('History rows', () => {
  it('names each kind of record apart and shows amounts without mixing their effects', async () => {
    await openHistory()
    await fire.change(field('Period'), { target: { value: 'month:2026-12' } })
    await fire.click(button('Show More in December 2026'))
    const row = (name: RegExp) => text(screen.getAllByRole('button', { name })[0])
    expect(row(/^Income receivedSalary/)).toContain('+6500,00 zł')
    expect(row(/^Income receivedSalary/)).toContain('Note: Paid early for the holidays')
    expect(row(/^Bill paymentRent \(studio\)/)).toContain('−2600,00 zł')
    expect(row(/^Bill paymentStudent Loan/)).toContain('Only the interest is spending')
    expect(row(/^SpendingSupermarket/)).toContain('−')
    // Transfers, goal assignments and balances are not money in or out: no sign.
    expect(row(/^TransferEveryday Account → Savings Account/)).toMatch(/Not income or spending.*900,00 zł/)
    expect(row(/^TransferEveryday Account → Savings Account/)).not.toMatch(/[+−]900/)
    expect(row(/^Assigned to a goalTrip to Japan/)).toMatch(/Savings total unchanged300,00 zł/)
    expect(row(/^Balance updateSavings Account/)).toMatch(/Balance entered2750,00 zł/)
    // A loan payment's split is shown only on request.
    const details = button('Details: Student Loan')
    expect(details.getAttribute('aria-expanded')).toBe('false')
    await fire.click(details)
    expect(details.getAttribute('aria-expanded')).toBe('true')
    expect(text(document.getElementById(details.getAttribute('aria-controls')!))).toMatch(/^Principal .* \(pays the loan back, not spending\) · Interest .* \(spending\)$/)
  })

  it('opens spending to change it, with Delete only after a second step', async () => {
    await openHistory()
    const row = screen.getAllByRole('button', { name: /^SpendingSupermarket/ })[0]
    await fire.click(row)
    expect(row.getAttribute('aria-expanded')).toBe('true')
    expect(screen.getByRole('group', { name: 'Change spending' })).toBeTruthy()
    await fire.click(button('Delete Spending'))
    expect(screen.getByText('Delete this record? Only this one changes.')).toBeTruthy()
    await fire.click(button('Keep It'))
    expect(count()).toContain('392 records')
  })
})

describe('History navigation', () => {
  it('opens a bill payment on its own month, and Back keeps the period, search, filters, open months and records shown', async () => {
    await openHistory()
    await search('card')
    await fire.click(button(/^More Filters/))
    await fire.change(field('Type'), { target: { value: 'bill' } })
    await fire.click(monthToggle('December 2026'))
    const before = { open: openMonthNames(), rows: rowKeys(), count: count() }
    const august = within(document.querySelector<HTMLElement>('.history-months')!).getAllByRole('button', { name: /^Bill paymentCredit Card Payment/ })
      .find(b => b.closest('.history-month')!.querySelector('.block-name')!.textContent === 'August 2026')!
    await fire.click(august)
    expect(screen.getByRole('heading', { name: 'August 2026' })).toBeTruthy()
    await backToTabs()
    expect(field('Search by name or note').value).toBe('card')
    expect(field('Type').value).toBe('bill')
    expect(field('Period').value).toBe('year:2026')
    expect(button(/^More Filters/).getAttribute('aria-expanded')).toBe('true')
    expect(openMonthNames()).toEqual(before.open)
    expect(rowKeys()).toEqual(before.rows)
    expect(count()).toBe(before.count)
    expect(document.activeElement?.textContent).toBe('History')
  })

  it('opens a goal from its savings movement', async () => {
    await openHistory()
    await search('japan')
    await fire.click(screen.getAllByRole('button', { name: /^Assigned to a goalTrip to Japan/ })[0])
    expect(screen.getByRole('heading', { name: 'Trip to Japan' })).toBeTruthy()
    await backToTabs()
    expect(field('Search by name or note').value).toBe('japan')
  })

  it('opens a balance in Accounts & Balances in Data, on its account', async () => {
    await openHistory()
    await fire.click(screen.getAllByRole('button', { name: /^Balance updateSavings Account/ })[0])
    const block = screen.getByRole('region', { name: 'Accounts & Balances' })
    expect(within(block).getByRole('button', { name: /^Accounts & Balances/ }).getAttribute('aria-expanded')).toBe('true')
    expect(within(block).getByRole('button', { name: /^Savings Account/ }).getAttribute('aria-expanded')).toBe('true')
  })

  it('opens a purchase chosen on Home on its month, ready to change, even past the first page', async () => {
    render(<App getToday={() => '2026-10-25'} storage={memoryStorage()} />)
    await settle()
    await fire.click(button('Explore the App'))
    const december = filterActivity(alex(), { ...NO_FILTER, period: { kind: 'month', month: '2026-12' }, type: 'spending' })
    const oldest = december.at(-1)!
    await fire.click(tab('History'))
    await search('zzz')
    await fire.click(tab('Home'))
    await fire.click(button(/^Spending by Category/))
    await fire.click(within(screen.getByRole('region', { name: 'Spending by Category' })).getByRole('button', { name: new RegExp(`^${oldest.category}`) }))
    await fire.click(within(screen.getByRole('list', { name: `${oldest.category} in December` })).getAllByRole('button', { name: new RegExp(oldest.label) }).at(-1)!)
    await waitFor(() => expect(screen.getByRole('heading', { level: 1, name: 'History' })).toBeTruthy())
    expect(field('Period').value).toBe('month:2026-12')
    expect(field('Search by name or note').value).toBe('')
    expect(screen.getByRole('group', { name: 'Change spending' })).toBeTruthy()
  })
})

describe('History empty states', () => {
  it('tells apart nothing recorded yet, nothing in the period and nothing matching', async () => {
    render(<App getToday={() => '2026-10-21'} storage={memoryStorage()} />)
    await settle()
    await createOwnSpace()
    await fire.click(tab('History'))
    expect(text(document.querySelector('.history-results'))).toContain('Nothing has been recorded yet.')
    await fire.click(within(document.querySelector<HTMLElement>('.history-results')!).getByRole('button', { name: /Add Spending/ }))
    expect(screen.getByRole('group', { name: 'Add spending' })).toBeTruthy()
    cleanup()
    freshDatabase()

    await openHistory()
    await fire.change(field('Period'), { target: { value: 'all' } })
    await search('zzz')
    expect(text(document.querySelector('.history-results'))).toContain('Nothing in all time matches “zzz”.')
    expect(text(document.querySelector('.history-results'))).toContain('401 records are in all time. Nothing was changed or deleted.')
    await fire.click(within(document.querySelector<HTMLElement>('.history-results')!).getByRole('button', { name: 'Clear Filters' }))
    expect(count()).toContain('401 records in all time')
  })

  it('offers All Time when the period has nothing', async () => {
    render(<App getToday={() => '2027-02-10'} storage={memoryStorage()} />)
    await settle()
    await createOwnSpace()
    await fire.click(tab('Data'))
    await fire.click(within(screen.getByRole('region', { name: 'Accounts & Balances' })).getByRole('button', { name: /Add Account/ }))
    await fire.change(field('Account Name'), { target: { value: 'Main' } })
    await fire.click(button('Save Account'))
    await fire.click(tab('History'))
    await fire.click(screen.getAllByRole('button', { name: /Add Spending/ })[0])
    await fire.change(field('Date'), { target: { value: '2027-01-15' } })
    await fire.change(field(/^Amount/), { target: { value: '12' } })
    await fire.click(within(screen.getByRole('group', { name: 'Add spending' })).getByRole('button', { name: 'Add Spending' }))
    expect(count()).toContain('1 record in 2027')
    await fire.change(field('Period'), { target: { value: 'month:2027-02' } })
    expect(text(document.querySelector('.history-results'))).toContain('Nothing was recorded in February 2027.')
    await fire.click(button('Show All Time'))
    expect(field('Period').value).toBe('all')
    expect(count()).toContain('1 record in all time')
  })
})

describe('History privacy', () => {
  it('follows Hide All Amounts in rows, the chart, details, the print list and accessible names', async () => {
    await openHistory()
    await fire.click(button('Hide All Amounts'))
    await fire.click(overviewToggle())
    await fire.click(screen.getByRole('button', { name: /^July 2026:/ }))
    await fire.change(field('Period'), { target: { value: 'month:2026-12' } })
    await fire.click(button('Details: Student Loan'))
    const screenText = text(document.querySelector('[data-screen="history"]'))
    expect(screenText).not.toMatch(/\d,\d\d zł/)
    expect(screenText).toContain('amount hidden')
    const labels = [...document.querySelectorAll('[data-screen="history"] [aria-label]')].map(element => element.getAttribute('aria-label')!)
    expect(labels.some(label => /\d,\d\d/.test(label))).toBe(false)
    expect(labels.find(label => label.startsWith('December 2026:'))).toBe('December 2026: income amount hidden, spent amount hidden. Show this month')
    const widths = [...document.querySelectorAll<HTMLElement>('.history-bars .pair-bars span span')].map(bar => bar.style.width)
    expect(new Set(widths)).toEqual(new Set(['0%']))
    // Shared with Home and Bills.
    await fire.click(tab('Bills'))
    expect(button('Show All Amounts')).toBeTruthy()
  })
})

describe('History print', () => {
  it('prints the period, the filters on and every matching record, even in closed months or past Show More', async () => {
    await openHistory()
    await search('a')
    await fire.change(field('Type'), { target: { value: 'spending' } })
    await fire.click(button('Collapse All'))
    const expected = filterActivity(alex(), { ...NO_FILTER, period: { kind: 'year', year: 2026 }, search: 'a', type: 'spending' })
    expect(text(document.querySelector('.history-print-filters'))).toBe('Period: 2026 · Search: “a” · Type: Spending')
    const rows = document.querySelectorAll('.history-print tbody tr:not(.history-print-month)')
    expect(rows).toHaveLength(expected.length)
    expect(document.querySelectorAll('.history-print button, .history-print input')).toHaveLength(0)
    expect(document.querySelector('.history-months')!.classList.contains('no-print')).toBe(true)
  })
})

describe('History in the demo and the own space', () => {
  it('Reset Demo puts History back as it first was; Cancel changes nothing', async () => {
    await openHistory()
    await search('rent')
    await fire.click(overviewToggle())
    await fire.click(button('Expand All'))
    const banner = screen.getByRole('note')
    await fire.click(within(banner).getByRole('button', { name: 'Reset Demo' }))
    await fire.click(within(banner).getByRole('button', { name: 'Cancel' }))
    expect(field('Search by name or note').value).toBe('rent')
    expect(openMonthNames().length).toBeGreaterThan(1)
    await fire.click(within(banner).getByRole('button', { name: 'Reset Demo' }))
    await confirmReset()
    expect(field('Search by name or note').value).toBe('')
    expect(field('Period').value).toBe('year:2026')
    expect(overviewToggle().getAttribute('aria-expanded')).toBe('false')
    expect(openMonthNames()).toEqual(['December 2026'])
  })

  it('keeps the demo’s History apart from the own space’s', async () => {
    await openHistory()
    await search('rent')
    await fire.click(within(screen.getByRole('note')).getByRole('button', { name: 'Exit Demo' }))
    await createOwnSpace()
    await fire.click(tab('History'))
    expect(field('Search by name or note').value).toBe('')
    await search('mine')
    await fire.click(button('Settings'))
    expect(screen.queryByRole('button', { name: 'Reset Demo' })).toBeNull()
  })
})
