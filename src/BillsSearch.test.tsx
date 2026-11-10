// @vitest-environment jsdom
import { chooseMonth } from './test/monthPicker'
import { cleanup, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, expect, it } from 'vitest'
import App from './App'
import { markBillPaid, billsForMonth, summarizeBills } from './domain/finance/bills'
import { activityLog } from './domain/finance/history'
import { createDemoHousehold } from './data/fixtures/demoHousehold'
import { fire, freshDatabaseForEachTest, settle } from './test/space'
import { classicHome } from './test/memoryStorage'

freshDatabaseForEachTest()
beforeEach(() => window.history.replaceState(null, ''))
afterEach(cleanup)
const button = (name: string | RegExp) => screen.getByRole('button', { name })
const nav = () => screen.getByRole('navigation', { name: 'Main navigation' })
const group = (name: string) => within(screen.getByRole('group', { name }))
const all = () => screen.getByRole('region', { name: 'All Bills' })
const search = () => screen.getByRole('searchbox', { name: 'Search bills' }) as HTMLInputElement
const text = (element: Element) => element.textContent
function fixture(empty = false) {
  const seed = createDemoHousehold()
  const data = { ...seed, bills: empty ? [] : [
    { ...seed.bills[0], id: 'sample-cafe', debtId: undefined, name: 'Café Service', category: 'Subscriptions' as const, amount: 2500, dueDay: 20, startMonth: '2026-01', endMonth: null, frequency: 'monthly' as const },
    { ...seed.bills[0], id: 'sample-ended', name: 'Old Annual Plan', category: 'Other' as const, amount: 9000, dueDay: 10, startMonth: '2025-01', endMonth: '2026-02', frequency: 'yearly' as const },
    { ...seed.bills[0], id: 'sample-future', name: 'Future Internet', category: 'Utilities' as const, amount: null, dueDay: 5, startMonth: '2027-01', endMonth: null, frequency: 'monthly' as const },
  ], billMonths: [] }
  return empty ? data : markBillPaid(data, 'sample-cafe', '2026-10', { amount: 2500, paidOn: '2026-10-20', paidFrom: null, interest: null }, '2026-11-05')
}
async function start(empty = false, data = fixture(empty)) {
  const before = structuredClone(data)
  render(<App storage={classicHome()} createDemo={() => ({ data, today: '2026-11-05' })} getToday={() => '2026-11-05'} />)
  await settle()
  await fire.click(button('Explore the App'))
  await fire.click(within(nav()).getByRole('button', { name: 'Bills' }))
  return { data, before }
}
const openAll = () => fire.click(group('Bills section').getByRole('button', { name: 'All Bills' }))

it('places the selector before the month, preserves monthly view/filter/totals and keeps search across scopes', async () => {
  const { data, before } = await start()
  const section = screen.getByRole('group', { name: 'Bills section' })
  expect(section.compareDocumentPosition(screen.getByRole('button', { name: /^Choose month:/ })) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  await chooseMonth('2026-12')
  await fire.click(button('List'))
  await fire.click(group('Show bills by payment').getByRole('button', { name: /^Pending/ }))
  const summary = text(screen.getByRole('region', { name: 'Whole month' }))
  await openAll()
  expect(screen.queryByRole('button', { name: /^Choose month:/ })).toBeNull()
  await fire.change(search(), { target: { value: '  CAFE  ' } })
  expect(within(all()).getAllByRole('listitem')).toHaveLength(1)
  expect(document.getElementById('bill-search-results')!.textContent).toBe('1 bill found')
  await fire.click(button('This Month'))
  expect((screen.getByRole('button', { name: /^Choose month:/ }) as HTMLButtonElement).value).toBe('2026-12')
  expect(button('List').getAttribute('aria-pressed')).toBe('true')
  expect(group('Show bills by payment').getByRole('button', { name: /^Pending/ }).getAttribute('aria-pressed')).toBe('true')
  expect(text(screen.getByRole('region', { name: 'Whole month' }))).toBe(summary)
  await openAll()
  expect(search().value).toBe('  CAFE  ')
  await fire.click(button('Clear'))
  expect(document.activeElement).toBe(search())
  expect(within(all()).getAllByRole('listitem')).toHaveLength(3)
  expect(data).toEqual(before)
})

it('finds active, ended annual and upcoming bills by name and combines search with validity filters', async () => {
  await start()
  await openAll()
  expect(within(all()).getAllByRole('listitem')).toHaveLength(3)
  await fire.change(search(), { target: { value: 'old annual' } })
  const ended = within(all()).getByRole('button', { name: /Old Annual Plan Ended/ })
  expect(ended.textContent).toContain('Yearly')
  expect(ended.textContent).not.toMatch(/Paid|Pending/)
  await fire.click(group('Show bills by status').getByRole('button', { name: /^Active/ }))
  expect(screen.getByText(/No bills match your search/)).toBeTruthy()
  await fire.click(group('Show bills by status').getByRole('button', { name: /^Ended/ }))
  expect(within(all()).getByRole('button', { name: /Old Annual Plan Ended/ })).toBeTruthy()
  await fire.click(button('Clear'))
  await fire.click(group('Show bills by status').getByRole('button', { name: /^Upcoming/ }))
  expect(within(all()).getByRole('button', { name: /Future Internet Upcoming/ }).textContent).toContain('Amount needed')
})

it('handles empty matches and literal text and keeps keyboard focus', async () => {
  await start()
  await openAll()
  search().focus()
  for (const query of ['[.*', 'not a bill']) {
    await fire.change(search(), { target: { value: query } })
    expect(document.getElementById('bill-search-results')!.textContent).toBe('0 bills found')
    expect(document.activeElement).toBe(search())
    expect(screen.getByText(/No bills match your search/)).toBeTruthy()
  }
  expect(search().type).toBe('search')
  expect(search().getAttribute('aria-describedby')).toBe('bill-search-results')
  expect(button('Clear').getAttribute('type')).toBe('button')
})

it('returns from Details to the same scope, search, filter and row focus; keeps End Subscription available', async () => {
  await start()
  await openAll()
  await fire.change(search(), { target: { value: 'cafe' } })
  await fire.click(group('Show bills by status').getByRole('button', { name: /^Active/ }))
  const row = within(all()).getByRole('button', { name: /Café Service Active/ })
  expect(row.getAttribute('type')).toBe('button')
  row.focus()
  expect(document.activeElement).toBe(row)
  await fire.click(row)
  expect(button('End Subscription')).toBeTruthy()
  await fire.click(button('Back'))
  expect(search().value).toBe('cafe')
  expect(group('Show bills by status').getByRole('button', { name: /^Active/ }).getAttribute('aria-pressed')).toBe('true')
  expect(document.activeElement).toBe(within(all()).getByRole('button', { name: /Café Service Active/ }))
  expect(within(nav()).getByRole('button', { name: 'Bills' }).getAttribute('aria-current')).toBe('page')
})

it('guards an edited monthly amount when switching scope', async () => {
  await start()
  await fire.click(button('List'))
  await fire.click(button(/Change Amount for November 2026: Café Service/))
  await fire.change(screen.getByLabelText('Amount for November 2026 (PLN)'), { target: { value: '75.00' } })
  await openAll()
  let dialog = screen.getByRole('alertdialog', { name: 'Leave without saving?' })
  await fire.click(within(dialog).getByRole('button', { name: 'Keep Editing' }))
  expect((screen.getByLabelText('Amount for November 2026 (PLN)') as HTMLInputElement).value).toBe('75.00')
  await openAll()
  dialog = screen.getByRole('alertdialog', { name: 'Leave without saving?' })
  await fire.click(within(dialog).getByRole('button', { name: 'Discard and Leave' }))
  expect(search()).toBeTruthy()
})

it('keeps an accessible empty collection and existing Add Bill action', async () => {
  await start(true)
  await openAll()
  expect(screen.getByText(/No bills yet/)).toBeTruthy()
  expect(document.getElementById(search().getAttribute('aria-describedby')!)).toBeTruthy()
  await fire.click(button('Add Your First Bill'))
  expect(screen.getByLabelText('Bill name')).toBeTruthy()
})
it('opens monthly shortcuts in This Month after All Bills was used', async () => {
  await start()
  await openAll()
  await fire.change(search(), { target: { value: 'cafe' } })
  await fire.click(within(nav()).getByRole('button', { name: 'Home' }))
  await fire.click(button(/^Planned Bills/))
  expect(button('This Month').getAttribute('aria-pressed')).toBe('true')
  await openAll()
  expect(search().value).toBe('')
  await fire.click(button('Add'))
  await fire.click(screen.getByRole('menuitem', { name: 'Mark a Bill as Paid' }))
  expect(button('This Month').getAttribute('aria-pressed')).toBe('true')
  expect(button('List').getAttribute('aria-pressed')).toBe('true')
  expect(group('Show bills by payment').getByRole('button', { name: /^Pending/ }).getAttribute('aria-pressed')).toBe('true')
  expect(button('Mark as Paid: Café Service, November 2026')).toBeTruthy()
})


it('searches names and categories in monthly Calendar and List, combines payment filters and preserves totals/history', async () => {
  const { data, before } = await start()
  const totals = summarizeBills(billsForMonth(data, '2026-11'))
  const history = activityLog(data)
  const summary = text(screen.getByRole('region', { name: 'Whole month' }))
  await fire.change(search(), { target: { value: 'SUBSCRIPTIONS' } })
  expect(document.getElementById('bill-search-results')!.textContent).toContain('1 bill found')
  expect(document.querySelectorAll('.cal-chip')).toHaveLength(1)
  await fire.click(button('List'))
  expect(screen.getByText('Café Service', { selector: '.bill-name' })).toBeTruthy()
  await fire.click(group('Show bills by payment').getByRole('button', { name: /^Paid/ }))
  expect(screen.getByText(/No bills match your search and payment filter/)).toBeTruthy()
  expect(text(screen.getByRole('region', { name: 'Whole month' }))).toBe(summary)
  await fire.click(group('Show bills by payment').getByRole('button', { name: /^All/ }))
  await fire.change(search(), { target: { value: 'cafe' } })
  expect(screen.getByText('Café Service', { selector: '.bill-name' })).toBeTruthy()
  await openAll()
  expect(search().value).toBe('cafe')
  await fire.change(search(), { target: { value: 'Utilities' } })
  expect(within(all()).getByRole('button', { name: /Future Internet Upcoming/ })).toBeTruthy()
  await fire.click(button('This Month'))
  expect(search().value).toBe('Utilities')
  expect(screen.getByText(/No bills match your search and payment filter/)).toBeTruthy()
  expect(summarizeBills(billsForMonth(data, '2026-11'))).toEqual(totals)
  expect(activityLog(data)).toEqual(history)
  expect(data).toEqual(before)
})

it('clears only search when leaving for another main section, retaining both scopes and filters', async () => {
  await start()
  await fire.click(button('List'))
  await fire.click(group('Show bills by payment').getByRole('button', { name: /^Pending/ }))
  await openAll()
  await fire.click(group('Show bills by status').getByRole('button', { name: /^Active/ }))
  await fire.change(search(), { target: { value: 'cafe' } })
  await fire.click(within(nav()).getByRole('button', { name: 'History' }))
  await fire.click(within(nav()).getByRole('button', { name: 'Bills' }))
  expect(search().value).toBe('')
  expect(button('All Bills').getAttribute('aria-pressed')).toBe('true')
  expect(group('Show bills by status').getByRole('button', { name: /^Active/ }).getAttribute('aria-pressed')).toBe('true')
  await fire.click(button('This Month'))
  expect(button('List').getAttribute('aria-pressed')).toBe('true')
  expect(group('Show bills by payment').getByRole('button', { name: /^Pending/ }).getAttribute('aria-pressed')).toBe('true')
})

it('keeps counters available without a live announcement for every character and includes category and frequency', async () => {
  await start()
  const input = search()
  input.focus()
  await fire.change(input, { target: { value: 'c' } })
  const count = document.getElementById('bill-search-results')!
  expect(count.getAttribute('aria-live')).toBe('off')
  expect(count.hasAttribute('role')).toBe(false)
  expect(input.getAttribute('aria-describedby')).toBe(count.id)
  await openAll()
  const row = within(all()).getByRole('button', { name: /Café Service Active/ })
  expect(row.textContent).toContain('Subscriptions · Monthly')
  expect(document.getElementById('bill-search-results')!.getAttribute('aria-live')).toBe('off')
})

it('guards a monthly draft that a new search would hide', async () => {
  await start()
  await fire.click(button('List'))
  await fire.click(button(/Change Amount for November 2026: Café Service/))
  await fire.change(screen.getByLabelText('Amount for November 2026 (PLN)'), { target: { value: '75.00' } })
  await fire.change(search(), { target: { value: 'missing' } })
  const dialog = screen.getByRole('alertdialog', { name: 'Leave without saving?' })
  await fire.click(within(dialog).getByRole('button', { name: 'Keep Editing' }))
  expect((screen.getByLabelText('Amount for November 2026 (PLN)') as HTMLInputElement).value).toBe('75.00')
  expect(search().value).toBe('')
})


it.each(['month', 'all'].flatMap(scope => ['zzz', 'cafe', 'Utilities'].map(query => [scope, query])))('clears active search for payment shortcut from %s with query %s and shows every pending bill', async (scope, query) => {
  let data = fixture()
  data = { ...data, bills: [...data.bills,
    { ...data.bills[0], id: 'sample-water', name: 'Water Service', category: 'Utilities', amount: 4500 },
    { ...data.bills[0], id: 'sample-paid', name: 'Paid Plan', amount: 1000 },
  ] }
  data = markBillPaid(data, 'sample-paid', '2026-11', { amount: 1000, paidOn: '2026-11-01', paidFrom: null, interest: null }, '2026-11-05')
  const history = activityLog(data)
  const before = structuredClone(data)
  await start(false, data)
  if (scope === 'all') await openAll()
  await fire.change(search(), { target: { value: query } })
  await fire.click(button('Add'))
  await fire.click(screen.getByRole('menuitem', { name: 'Mark a Bill as Paid' }))
  expect(search().value).toBe('')
  expect(button('This Month').getAttribute('aria-pressed')).toBe('true')
  expect(button('List').getAttribute('aria-pressed')).toBe('true')
  expect(group('Show bills by payment').getByRole('button', { name: /^Pending/ }).getAttribute('aria-pressed')).toBe('true')
  expect(screen.getAllByRole('button', { name: /^Mark as Paid:/ }).map(item => item.getAttribute('aria-label'))).toEqual([
    'Mark as Paid: Café Service, November 2026', 'Mark as Paid: Water Service, November 2026',
  ])
  expect(document.activeElement).toBe(screen.getAllByRole('button', { name: /^Mark as Paid:/ })[0])
  expect(data).toEqual(before)
  expect(activityLog(data)).toEqual(history)
})

it('opens direct editing from All Bills and returns to the same search and Edit target', async () => {
  const { data, before } = await start()
  await openAll()
  await fire.change(search(), { target: { value: 'cafe' } })
  await fire.click(button('Edit Café Service'))
  expect(screen.getByRole('heading', { name: 'Edit Café Service' })).toBeTruthy()
  expect(document.activeElement).toBe(screen.getByRole('textbox', { name: 'Bill name' }))
  await fire.click(screen.getAllByRole('button', { name: 'Cancel' })[0])
  const edit = button('Edit Details')
  expect(document.activeElement).toBe(edit)
  expect(edit.compareDocumentPosition(screen.getByRole('region', { name: 'November 2026' })) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  await fire.click(button('Back'))
  expect(search().value).toBe('cafe')
  expect(document.activeElement).toBe(button('Edit Café Service'))
  expect(data).toEqual(before)
})

it('protects a monthly amount draft when opening Edit Details', async () => {
  await start()
  await openAll()
  await fire.click(button(/Café Service Active/))
  await fire.click(button('Change Amount for November 2026'))
  await fire.change(screen.getByRole('textbox', { name: /Amount for November/ }), { target: { value: '37' } })
  await fire.click(button('Edit Details'))
  expect(screen.queryByRole('heading', { name: 'Edit Café Service' })).toBeNull()
  await fire.click(button('Keep Editing'))
  expect((screen.getByRole('textbox', { name: /Amount for November/ }) as HTMLInputElement).value).toBe('37')
})

it('keeps direct Edit drafts when floating navigation is cancelled and saves through the existing form', async () => {
  await start()
  await openAll()
  await fire.click(button('Edit Café Service'))
  await fire.change(screen.getByRole('textbox', { name: 'Bill name' }), { target: { value: 'Sample Service' } })
  await fire.click(within(nav()).getByRole('button', { name: 'Home' }))
  await fire.click(button('Keep Editing'))
  expect((screen.getByRole('textbox', { name: 'Bill name' }) as HTMLInputElement).value).toBe('Sample Service')
  await fire.click(button('Save Changes'))
  expect(screen.getByRole('heading', { name: 'Sample Service' })).toBeTruthy()
  expect(document.activeElement).toBe(button('Edit Details'))
  await fire.click(button('Back'))
  expect(button('Edit Sample Service')).toBeTruthy()
})

it.each(['cancel', 'save', 'normal', 'browser-back'] as const)('consumes direct editing before linked loan return: %s', async exit => {
  const data = createDemoHousehold()
  data.bills.find(item => item.id === 'furniture-loan')!.name = 'Small Loan'
  data.debts.find(item => item.id === 'furniture')!.name = 'Small Loan'
  const before = structuredClone(data)
  const bill = data.bills.find(item => item.name === 'Small Loan')!
  const debt = data.debts.find(item => item.id === bill.debtId)!
  await start(false, data)
  await openAll()
  if (exit === 'normal') await fire.click(button(/Small Loan Active/))
  else {
    await fire.click(button('Edit Small Loan'))
    expect(screen.getByRole('heading', { name: 'Edit Small Loan' })).toBeTruthy()
    if (exit === 'save') await fire.click(button('Save Changes'))
    else if (exit === 'browser-back') {
      window.history.back()
      await settle()
      window.history.forward()
      await settle()
    } else await fire.click(screen.getAllByRole('button', { name: 'Cancel' })[0])
  }
  expect(screen.queryByRole('textbox', { name: 'Bill name' })).toBeNull()
  await fire.click(within(screen.getByRole('region', { name: 'Details' })).getByRole('button', { name: debt.name }))
  await fire.click(button('Back'))
  expect(screen.getByRole('heading', { name: 'Small Loan' })).toBeTruthy()
  expect(screen.queryByRole('textbox', { name: 'Bill name' })).toBeNull()
  expect(data).toEqual(before)
})
