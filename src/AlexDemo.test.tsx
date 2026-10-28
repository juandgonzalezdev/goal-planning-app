// @vitest-environment jsdom
import { act, cleanup, render, renderHook, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { browserSpaceStore, useSpace } from './app/useSpace'
import { createSpaceData } from './domain/finance/space'
import { STORAGE_KEY } from './data/localStore'
import { memoryStorage } from './test/memoryStorage'
import { fire, settle, storedData, storedSpace, freshDatabaseForEachTest } from './test/space'

freshDatabaseForEachTest()

// The public demo: Alex's invented year 2026, shown on the demo's own date (31 Dec 2026).
afterEach(() => { cleanup(); vi.restoreAllMocks(); document.documentElement.removeAttribute('data-theme') })

const button = (name: string | RegExp) => screen.getByRole('button', { name })
const heading = (name: string | RegExp) => screen.getByRole('heading', { name })
const field = (label: string | RegExp) => screen.getByLabelText(label) as HTMLInputElement
const type = async (label: string | RegExp, value: string) => await fire.change(field(label), { target: { value } })
const tab = (name: string) => within(screen.getByRole('navigation', { name: 'Main navigation' })).getByRole('button', { name })
const text = (element: Element | null) => (element?.textContent ?? '').replace(/\u00a0|\u202f/g, ' ')
const regionOf = (name: string) => screen.getByRole('region', { name })
const region = (name: string) => text(regionOf(name))
const stat = (label: string) => text(within(regionOf('This Month')).getByText(label).parentElement)
const monthSelect = () => screen.getByRole('combobox', { name: 'Month' }) as HTMLSelectElement
const pickMonth = async (month: string) => await fire.change(monthSelect(), { target: { value: month } })
const amount = /\d,\d\d zł/
/** Bills opens on Calendar; its List keeps the Paid / Pending buttons of each bill. */
const showBillsList = async () => await fire.click(within(screen.getByRole('group', { name: 'View' })).getByRole('button', { name: 'List' }))
const NOVEMBER_PLANNED = '4582,57 zł'

/** Goes back through the browser history until the tabs show again. */
async function backHome() {
  while (!screen.queryByRole('navigation', { name: 'Main navigation' })) {
    await act(async () => {
      window.history.back()
      await new Promise(resolve => setTimeout(resolve, 20))
    })
  }
  await fire.click(tab('Home'))
}

/** Opens the demo on Home. Most tests look inside the Home blocks, so they open all of them (Expand All). */
async function openAlex(storage: Storage = memoryStorage(), { expanded = true } = {}) {
  // The device date is in October; the demo keeps its own date.
  const result = render(<App getToday={() => '2026-10-25'} storage={storage} />)
  await settle()
  await fire.click(button('Explore the App'))
  if (expanded) await fire.click(button('Expand All'))
  return { storage, ...result }
}

describe('Alex demo: Home', () => {
  it('is clearly an invented demo that is not saved, with Reset Demo', async () => {
    const { storage } = await openAlex()
    const banner = text(screen.getByRole('note'))
    expect(banner).toContain('Alex is invented')
    expect(banner).toContain('Changes are not saved')
    expect(button('Reset Demo')).toBeTruthy()
    expect(storage.length).toBe(0)
  })

  it('opens on 31 December 2026, with the twelve months of the year to move through', async () => {
    await openAlex()
    expect(monthSelect().value).toBe('2026-12')
    expect(monthSelect().options).toHaveLength(13)
    expect(monthSelect().options[0].textContent).toBe('January 2026')
    const titles = [...document.querySelectorAll('[data-screen="home"] section .block-name')].map(h => h.textContent)
    expect(titles).toEqual(['This Month', 'Left to Pay', 'Spending by Category', 'Total Debt', 'My Money', 'My Goals', 'Year Summary'])
  })

  it('shows December: income, planned bills, what was spent and the result', async () => {
    await openAlex()
    expect(stat('Income')).toContain('7200,00 zł')
    expect(stat('Spent')).toContain('5097,35 zł')
    expect(stat('Result')).toContain('2102,65 zł')
    expect(region('Left to Pay')).toContain('69,99 zł')
    expect(region('Left to Pay')).toContain('Phone & InternetDue 31 Dec 2026')
  })

  it('shows how a deficit month was covered, from the records (2)', async () => {
    await openAlex()
    await pickMonth('2026-08')
    expect(stat('Result')).toContain('-3037,86 zł')
    expect(stat('Result')).toContain('Spent more than received')
    await fire.click(button('How is this worked out?'))
    const covered = [...screen.getByRole('list', { name: 'How the deficit was covered' }).querySelectorAll('li')].map(text)
    expect(covered).toEqual(['From your Savings1500,00 zł', 'From your Everyday money1160,57 zł', 'New debt (card or loan)377,29 zł'])
    expect(text(regionOf('This Month'))).not.toContain('Not explained by the records')
  })

  it('uses the balances of the month shown, never today’s balance worked back (6)', async () => {
    await openAlex()
    expect(region('Total Debt')).toContain('12 266,98 zł')
    await pickMonth('2026-08')
    expect(region('Total Debt')).toContain('16 029,46 zł')
    expect(region('Total Debt')).toContain('Balances as of 31 Aug 2026')
    // Investments was last entered at the end of 2025: the dates are shown as they are, not as one day.
    expect(region('My Money')).toContain('Latest balances, dated 31 Dec 2025 to 31 Aug 2026')
  })

  it('says what is still to pay in December, and changes when it is paid (5)', async () => {
    await openAlex()
    expect(region('Left to Pay')).toContain('You still have bills to pay in December.')
    await fire.click(tab('Bills'))
    await showBillsList()
    await fire.click(button('Phone & Internet paid in December 2026'))
    await fire.click(tab('Home'))
    expect(region('Left to Pay')).toContain('All your December bills are paid.')
    expect(stat('Spent')).toContain('5167,34 zł')
    // Paying a bill does not lower what is owed.
    expect(region('Total Debt')).toContain('12 266,98 zł')
  })

  it('opens a category to show each cost, and a purchase opens in History to edit (7)', async () => {
    await openAlex()
    await pickMonth('2026-07')
    const spending = within(regionOf('Spending by Category'))
    await fire.click(spending.getByRole('button', { name: /^Health/ }))
    const items = screen.getByRole('list', { name: 'Health in July' })
    expect(text(items)).toContain('Emergency dental treatment8 Jul 2026 · One-off · Credit Card780,00 zł')
    await fire.click(within(items).getByRole('button', { name: /Emergency dental treatment/ }))
    await waitFor(() => expect(heading('History')).toBeTruthy())
    expect(screen.getByRole('group', { name: 'Change spending' })).toBeTruthy()
    await type(/^Amount/, '700')
    await fire.click(button('Save Changes'))
    await fire.click(tab('Home'))
    expect(monthSelect().value).toBe('2026-07')
    expect(stat('Spent')).toContain('3384,92 zł')
    // Only July changed.
    await pickMonth('2026-08')
    expect(stat('Spent')).toContain('3687,86 zł')
  })

  it('lists ideas to review with their yearly effect, and the largest deficit for scale', async () => {
    await openAlex()
    await fire.click(button('Ideas to Review'))
    const ideas = [...screen.getByRole('list', { name: 'Ideas to review' }).querySelectorAll('li')].map(text)
    expect(ideas[0]).toContain('Gym Membership')
    expect(ideas[0]).toContain('1548,00 zł a year')
    expect(ideas.map(idea => idea.split('Subscription')[0].split('About')[0])).toEqual(expect.arrayContaining(['Shopping', 'Eating Out', 'Leisure']))
    expect(region('Spending by Category')).toContain('your largest monthly deficit this year was 3037,86 zł (August 2026)')
    expect(region('Spending by Category')).toContain('Money not spent is not saved automatically')
  })

  it('changes one month of a planned bill from Home with Save, and Cancel changes nothing (4)', async () => {
    await openAlex()
    await fire.click(button('Planned'))
    await fire.click(button(/^Utilities/))
    await fire.click(button('Change Utilities amount for December 2026'))
    await type('Utilities for December 2026 (PLN)', '999')
    await fire.click(button('Cancel'))
    expect(stat('Planned Bills')).toContain('6401,84 zł')
    await fire.click(button('Change Utilities amount for December 2026'))
    expect(field('Utilities for December 2026 (PLN)').value).toBe('440.00')
    await type('Utilities for December 2026 (PLN)', 'abc')
    await fire.click(button('Save'))
    expect(field('Utilities for December 2026 (PLN)').getAttribute('aria-invalid')).toBe('true')
    await type('Utilities for December 2026 (PLN)', '450')
    await fire.click(button('Save'))
    expect(screen.getAllByRole('status').map(text)).toContain('Utilities for December is now 450,00 zł. Demo only: not saved.')
    expect(stat('Planned Bills')).toContain('6411,84 zł')
    await pickMonth('2026-11')
    expect(stat('Planned Bills')).toContain(NOVEMBER_PLANNED)
  })

  it('remembers Donut or Bars', async () => {
    const storage = memoryStorage()
    await openAlex(storage)
    await fire.click(button('Bars'))
    expect(button('Bars').getAttribute('aria-pressed')).toBe('true')
    cleanup()
    await openAlex(storage)
    expect(button('Bars').getAttribute('aria-pressed')).toBe('true')
    // Only the chart preference is kept: no demo data.
    expect(storage.getItem(STORAGE_KEY)).toBeNull()
    expect(await storedData()).toBeNull()
  })

  it('divides Savings by purpose, with no double counting', async () => {
    await openAlex()
    const savings = text(screen.getByRole('group', { name: 'Savings by purpose' }))
    for (const part of ['Trip to Japan1800,00 zł', 'New Bike200,00 zł', 'Emergency Fund900,00 zł', 'Savings2900,00 zł']) expect(savings).toContain(part)
    expect(savings).not.toContain('Christmas Gifts')
  })

  it('shows goals with and without a target, and the emergency fund cover', async () => {
    await openAlex()
    const goals = region('My Goals')
    expect(goals).toContain('Emergency Fund')
    expect(goals).toContain('Cover not worked out yet')
    expect(goals).toContain('Trip to Japan')
    expect(goals).toContain('18%')
    expect(goals).toContain('New BikeNo target')
    expect(goals).toContain('Saved so far, with no target set')
    expect(screen.queryByRole('heading', { name: 'Start with an emergency fund' })).toBeNull()
  })

  it('sums the year in the Year Summary, with its deficit months', async () => {
    await openAlex()
    const year = region('Year Summary')
    expect(year).toContain('12 of 12 months so far')
    expect(year).toContain('Income in 202655 998,00 zł')
    expect(year).toContain('Spent in 202648 781,14 zł')
    expect(year).toContain('Result for 20267216,86 zł')
    expect(year).toContain('Includes 1138,00 zł of one-off income.')
    expect(year).toContain('Spending was higher than income in Feb, Jul, Aug.')
    await fire.click(screen.getByText('Reference Notes'))
    expect(region('Year Summary')).toContain('Housing and utilities were 49.3% of the net income you received')
    expect(region('Year Summary')).toContain('not a spending limit')
  })
})

describe('Alex demo: hiding amounts (11)', () => {
  it('hides every amount on Home, also in opened details, labels and charts', async () => {
    await openAlex()
    await fire.click(button('Hide All Amounts'))
    await fire.click(button('How is this worked out?'))
    await fire.click(button('Ideas to Review'))
    await fire.click(screen.getByText('Reference Notes'))
    const home = document.querySelector<HTMLElement>('[data-screen="home"]')!
    expect(text(home)).not.toMatch(amount)
    // Shares could reveal amounts too (the general 40% and 50/30/20 notes are not the user's numbers).
    expect(text(home)).not.toContain('49.3%')
    expect(text(home)).not.toContain('18%')
    const labels = [...home.querySelectorAll('[aria-label]')].map(element => element.getAttribute('aria-label')!.replace(/\u00a0|\u202f/g, ' '))
    expect(labels.filter(label => amount.test(label))).toEqual([])
    expect(labels).toContain('Show amounts in Year Summary')
    // Charts get a neutral look: no slices, no proportional bars.
    expect(home.querySelector<HTMLElement>('.donut')!.style.background).toContain('var(--color-track)')
    expect(within(home).queryAllByRole('progressbar')).toEqual([])
    // Titles and navigation stay.
    expect(regionOf('My Money')).toBeTruthy()
    expect(tab('Bills')).toBeTruthy()
  })

  it('can be used with the keyboard, block by block', async () => {
    await openAlex()
    const eye = button('Hide amounts in My Money')
    expect(eye.tagName).toBe('BUTTON')
    act(() => eye.focus())
    expect(document.activeElement).toBe(eye)
    await fire.click(eye)
    expect(region('My Money')).not.toMatch(amount)
    expect(region('My Goals')).toMatch(amount)
    expect(button('Show amounts in My Money')).toBeTruthy()
  })
})

describe('Alex demo: goals, emergency fund and subscriptions', () => {
  async function openJapan() {
    await openAlex()
    await fire.click(within(regionOf('My Goals')).getByRole('button', { name: /Trip to Japan/ }))
    await waitFor(() => expect(heading('Trip to Japan')).toBeTruthy())
  }

  it('adds 100 of new savings once: Japan 1,900 and Savings 3,000', async () => {
    await openJapan()
    await fire.click(within(screen.getByRole('group', { name: 'Type of change' })).getByRole('button', { name: 'Add' }))
    await fire.click(screen.getByRole('radio', { name: /New savings/ }))
    await type('Amount (PLN)', '100')
    await fire.click(button('Save Contribution'))
    expect(region('Progress')).toContain('1900,00 zł')
    await backHome()
    expect(text(screen.getByRole('group', { name: 'Savings by purpose' }))).toContain('Savings3000,00 zł')
  })

  it('explores a monthly amount or a date inside the goal, changing nothing until confirmed', async () => {
    await openJapan()
    await fire.click(button('Try an Amount or Date'))
    await type('If I save each month (PLN)', '500')
    expect(text(document.querySelector('[data-screen="goal"]'))).toContain('17 months of 500,00 zł (the last one 200,00 zł) would reach it around 31 May 2028.')
    await type('Or reach it by', '2027-12-31')
    expect(text(document.querySelector('[data-screen="goal"]'))).toContain('About 683,34 zł a month for 12 months')
    await fire.click(button('Use This Date'))
    await fire.click(button('Cancel'))
    expect(screen.getByText('No deadline · Flexible')).toBeTruthy()
    await fire.click(button('Use This Date'))
    await fire.click(button('Yes, Use This Date'))
    expect(screen.getByText(/Target date: 31 Dec 2027/)).toBeTruthy()
  })

  it('reviews the emergency fund from confirmed essential costs (9)', async () => {
    await openAlex()
    await fire.click(within(regionOf('My Goals')).getByRole('button', { name: 'Review My Emergency Fund' }))
    expect(heading('Review My Emergency Fund')).toBeTruthy()
    const draft = () => text(document.querySelector('[data-screen="emergency"]'))
    expect(draft()).toContain('Essential costs per month4415,42 zł')
    expect(draft()).toContain('One-off costs left out (6)')
    await fire.click(screen.getByRole('checkbox', { name: /^Rent \(studio\)/ }))
    expect(draft()).toContain('Essential costs per month1815,42 zł')
    await fire.click(screen.getByRole('checkbox', { name: /^Rent \(studio\)/ }))
    await fire.click(button('1 month'))
    expect(draft()).toContain('Target4415,42 zł')
    await fire.click(button('Save Review'))
    await fire.click(button('Back'))
    await backHome()
    expect(region('My Goals')).toContain('Covers about 0.2 months of essential costs')
    expect(region('My Goals')).toContain('3515,42 zł to the target of 4415,42 zł')
  })

  it('simulates pausing a subscription; Cancel changes nothing, Confirm changes future months only (10)', async () => {
    await openAlex()
    await fire.click(button('Ideas to Review'))
    await fire.click(within(screen.getByRole('list', { name: 'Ideas to review' })).getByRole('button', { name: /Gym Membership/ }))
    await waitFor(() => expect(heading('Gym Membership')).toBeTruthy())
    await fire.click(button('What If I Pause It?'))
    const screenText = () => text(document.querySelector('[data-screen="bill"]'))
    expect(screenText()).toContain('Simulation only. Nothing has changed.')
    expect(screenText()).toContain('Pausing Gym Membership for 3 monthly periods (January 2027, February 2027, March 2027) could reduce planned spending by 387,00 zł.')
    expect(screenText()).toContain('Money not spent is not added to Savings by itself')
    await fire.click(button('Cancel'))
    expect(screenText()).not.toContain('Simulation only')
    expect(screenText()).not.toContain('January 2027, February 2027')
    await fire.click(button('What If I Pause It?'))
    await fire.click(button('Confirm Pause'))
    expect(screenText()).toContain('PausedJuly 2026, August 2026, September 2026, January 2027, February 2027, March 2027')
    await backHome()
    expect(region('Year Summary')).toContain('Spent in 202648 781,14 zł')
  })
})

describe('Alex demo: History', () => {
  it('filters by period, type, category and account, and a chart month opens its categories', async () => {
    await openAlex()
    await fire.click(tab('History'))
    await fire.click(button(/^Year Overview/))
    await fire.click(screen.getByRole('button', { name: name => name.replace(/\u00a0|\u202f/g, ' ').startsWith('July 2026: income 900,00 zł, spent 3464,92 zł') }))
    await fire.change(field('Type'), { target: { value: 'spending' } })
    await fire.click(within(screen.getByRole('group', { name: 'Spending by category in July 2026' })).getByRole('button', { name: /^Health/ }))
    const list = text(document.querySelector('.history-months'))
    expect(list).toContain('Emergency dental treatment')
    expect(list).not.toContain('Pharmacy · ')
    await fire.change(field('Account'), { target: { value: 'everyday' } })
    expect(text(document.querySelector('.history-results'))).not.toContain('Emergency dental treatment')
    // Clear Filters keeps the period chosen (July).
    await fire.click(button('Clear Filters'))
    expect(text(document.getElementById('history-count'))).toContain('28 records in July 2026')
    await fire.change(field('Period'), { target: { value: 'all' } })
    expect(text(document.getElementById('history-count'))).toContain('401 records in all time')
  })

  it('keeps payments, transfers, savings and balances apart, and adds a purchase to its month only', async () => {
    await openAlex()
    await fire.click(tab('History'))
    await fire.change(field('Period'), { target: { value: 'month:2026-09' } })
    await fire.change(field('Type'), { target: { value: 'transfer' } })
    expect(text(document.querySelector('.history-months'))).toContain('TransferSavings Account → Everyday AccountNot income or spending')
    await fire.change(field('Type'), { target: { value: 'bill' } })
    expect(text(document.querySelector('.history-months'))).toContain('Paid late')
    await fire.click(button(/Add Spending/))
    await type('Date', '2026-12-30')
    await type(/^Amount/, '45')
    await type('What was it? (optional)', 'Cinema')
    await fire.change(document.getElementById('expense-new-category')!, { target: { value: 'Leisure' } })
    await fire.click(within(screen.getByRole('group', { name: 'Add spending' })).getByRole('button', { name: 'Add Spending' }))
    expect(screen.getAllByRole('status').map(text)).toContain('Spending added. Demo only: not saved.')
    await fire.click(tab('Home'))
    expect(stat('Spent')).toContain('5142,35 zł')
  })
})

describe('Alex demo: report and backup (12, 13)', () => {
  it('downloads a PDF report of the chosen period, saying whether amounts are included', async () => {
    const blobs: Blob[] = []
    const names: string[] = []
    vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: (blob: Blob) => { blobs.push(blob); return 'blob:report' }, revokeObjectURL: () => {} }))
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) { names.push(this.download) })
    await openAlex()
    await fire.click(tab('Data'))
    await fire.click(button(/^Reports & Backup/))
    expect(heading('Export Report')).toBeTruthy()
    expect(heading('Data Backup')).toBeTruthy()
    await fire.click(button('Download PDF'))
    await fire.click(button('Whole Year'))
    await fire.click(field(/Include amounts/))
    expect(screen.getByText(/Every amount is replaced by ••••/)).toBeTruthy()
    await fire.click(button('Download PDF'))
    expect(names).toEqual(['financial-report-2026-12.pdf', 'financial-report-2026-no-amounts.pdf'])
    expect(blobs.map(blob => blob.type)).toEqual(['application/pdf', 'application/pdf'])
    const first = await blobs[0].text()
    expect(first.startsWith('%PDF-1.4')).toBe(true)
    expect(first).toContain('(December 2026)')
    expect(first).toContain('INVENTED DATA')
    expect(first).toContain('(Amounts: included.)')
    const second = await blobs[1].text()
    expect(second).toContain('(Year 2026)')
    expect(second).not.toMatch(/PLN \d/)
  })
})

describe('Alex demo: keeping and resetting (15)', () => {
  it('keeps edits while switching tabs, and Reset Demo restores the whole year', async () => {
    await openAlex()
    await fire.click(tab('Cards'))
    await fire.click(button(/Small Loan/))
    await waitFor(() => expect(heading('Small Loan')).toBeTruthy())
    await fire.click(button('Update Balance'))
    await type('Remaining Balance (PLN)', '2500')
    await fire.click(button('Save Balance'))
    expect(text(screen.getAllByRole('status').find(s => s.textContent)!)).toContain('Demo only: not saved.')
    await backHome()
    for (const name of ['History', 'Data', 'Bills', 'Home']) await fire.click(tab(name))
    expect(region('Total Debt')).toContain('12 122,63 zł')
    await pickMonth('2026-03')

    await fire.click(button('Reset Demo'))
    await fire.click(within(screen.getByRole('group', { name: 'Reset demo?' })).getByRole('button', { name: 'Reset Demo' }))
    expect(monthSelect().value).toBe('2026-12')
    expect(region('Total Debt')).toContain('12 266,98 zł')
    expect(region('Year Summary')).toContain('Income in 202655 998,00 zł')
  })

  it('never touches saved information when the demo is used or reset', async () => {
    const storage = memoryStorage()
    storage.setItem(STORAGE_KEY, '{ saved, but unreadable')
    await openAlex(storage)
    await fire.click(tab('Bills'))
    await showBillsList()
    await fire.click(button('Phone & Internet paid in December 2026'))
    await fire.click(button('Reset Demo'))
    await fire.click(within(screen.getByRole('group', { name: 'Reset demo?' })).getByRole('button', { name: 'Reset Demo' }))
    await fire.click(button('Exit Demo'))
    expect(storage.getItem(STORAGE_KEY)).toBe('{ saved, but unreadable')
    expect(await storedData()).toBeNull()
  })

  it('resets only the demo, even with an own space saved on the device', async () => {
    const storage = memoryStorage()
    const own = createSpaceData({ mode: 'individual', names: ['Robin'], currency: 'PLN', theme: 'light' })
    if (own.status !== 'created') throw new Error('invalid setup')
    expect(await browserSpaceStore(storage).create(own.data)).toMatchObject({ status: 'saved' })
    const before = await storedSpace()
    const { result } = renderHook(() => useSpace(storage, () => '2026-10-25'))
    await waitFor(() => expect(result.current.open?.kind).toBe('own'))
    act(() => result.current.openDemo())
    expect(result.current.today).toBe('2026-12-31')
    expect(await act(() => result.current.update(data => ({ ...data, bills: [], expenses: [] })))).toBe('demo')
    act(() => result.current.resetDemo())
    expect(result.current.open).toMatchObject({ kind: 'demo', data: { bills: expect.arrayContaining([expect.objectContaining({ name: 'Rent (studio)' })]) } })
    expect(result.current.open?.data.expenses).toHaveLength(135)
    expect(await storedSpace()).toEqual(before)
  })

  it('starts the demo again from the example after Exit Demo and reload', async () => {
    const storage = memoryStorage()
    await openAlex(storage)
    await fire.click(button('Planned'))
    await fire.click(button(/^Utilities/))
    await fire.click(button('Change Utilities amount for December 2026'))
    await type('Utilities for December 2026 (PLN)', '750')
    await fire.click(button('Save'))
    cleanup()
    await openAlex(storage)
    expect(stat('Planned Bills')).toContain('6401,84 zł')
  })
})

describe('Alex demo: keyboard and labels', () => {
  it('names every button and field on every tab', async () => {
    await openAlex()
    for (const name of ['Home', 'Bills', 'Cards', 'History', 'Data']) {
      await fire.click(tab(name))
      for (const element of screen.getAllByRole('button')) expect(element.textContent?.trim() || element.getAttribute('aria-label')).toBeTruthy()
      for (const element of document.querySelectorAll('input, select, textarea')) {
        expect(screen.getByLabelText((_, node) => node === element)).toBeTruthy()
      }
    }
  })

  it('uses real buttons, so Enter and Space work and focus moves through them', async () => {
    await openAlex()
    const toggle = button(/^Total Debt/)
    expect(toggle.tagName).toBe('BUTTON')
    expect(toggle.getAttribute('type')).toBe('button')
    act(() => toggle.focus())
    expect(document.activeElement).toBe(toggle)
    expect(screen.getAllByRole('button').every(b => b.tabIndex >= 0)).toBe(true)
  })
})
