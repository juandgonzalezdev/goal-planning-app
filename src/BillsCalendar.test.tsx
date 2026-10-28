// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { createDemoHousehold, DEMO_TODAY } from './data/fixtures/demoHousehold'
import type { BillMonth, FinanceData, RecurringBill } from './domain/finance/types'
import { memoryStorage } from './test/memoryStorage'
import { fire, settle, storedData, freshDatabaseForEachTest } from './test/space'

freshDatabaseForEachTest()

/*
 * Bills as a calendar and a list, and the simpler Add Bill. The calendar
 * fixture is a demo whose date is 10 February 2028 (a leap year), while the
 * device's "today" is another day: the calendar must use the demo's date.
 */

const button = (name: string | RegExp) => screen.getByRole('button', { name })
const heading = (name: string | RegExp) => screen.getByRole('heading', { name })
const field = (label: string | RegExp) => screen.getByLabelText(label) as HTMLInputElement
const type = async (label: string | RegExp, value: string) => await fire.change(field(label), { target: { value } })
const tab = (name: string) => within(screen.getByRole('navigation', { name: 'Main navigation' })).getByRole('button', { name })
const text = (element: Element | null) => (element?.textContent ?? '').replace(/\u00a0|\u202f/g, ' ')
const monthSelect = () => screen.getByRole('combobox', { name: 'Month' }) as HTMLSelectElement
const pickMonth = async (month: string) => await fire.change(monthSelect(), { target: { value: month } })
const group = (name: string) => within(screen.getByRole('group', { name }))
const showView = async (name: 'Calendar' | 'List') => await fire.click(group('View').getByRole('button', { name }))
const showFilter = async (name: RegExp) => await fire.click(group('Show bills').getByRole('button', { name }))
const summary = (label: string) => text(within(screen.getByRole('region', { name: 'Whole month' })).getByText(label).parentElement)
/** The day button of a date, e.g. day('Tuesday 15 February 2028'). */
const day = (date: string) => button(new RegExp(`^${date}`))
const dayList = (date: string) => screen.getByRole('region', { name: date })
const pressedDays = () => screen.getAllByRole('button', { pressed: true }).filter(b => b.classList.contains('cal-day'))
const chipNames = (date: string) => [...day(date).closest('td')!.querySelectorAll('.cal-chip')].map(chip => chip.getAttribute('title'))
const listNames = () => [...document.querySelectorAll('.bill-list .bill-name')].map(name => name.textContent)

const bill = (id: string, name: string, dueDay: number, amount: number | null, extra: Partial<RecurringBill> = {}): RecurringBill =>
  ({ id, name, category: 'Other', owner: 'shared', amount, currency: 'PLN', dueDay, startMonth: '2027-06', endMonth: null, ...extra })

function calendarFixture(): { data: FinanceData; today: string } {
  const data = createDemoHousehold()
  const bills: RecurringBill[] = [
    bill('gym', 'Gym', 31, 10_000),
    bill('water', 'Water', 15, 8_000, { category: 'Utilities' }),
    bill('power', 'Power', 15, 20_000, { category: 'Utilities' }),
    bill('internet', 'Internet', 15, 6_000, { category: 'Utilities' }),
    bill('insurance', 'Insurance', 15, 12_000, { category: 'Housing' }),
    bill('old-plan', 'Old Plan', 5, 3_000, { endMonth: '2028-02' }),
    bill('new-course', 'New Course', 5, 25_000, { startMonth: '2028-03' }),
    bill('phone', 'Phone', 20, null),
  ]
  const billMonths: BillMonth[] = [
    { billId: 'water', month: '2028-02', paid: true, paidOn: '2028-02-12' },
    // February's power bill is higher than usual, for that month only.
    { billId: 'power', month: '2028-02', paid: false, amount: 25_000 },
  ]
  return { data: { ...data, bills, billMonths, debts: [], balances: data.balances.filter(b => !['car', 'furniture', 'card'].includes(b.accountId)) }, today: '2028-02-10' }
}

async function openCalendarDemo() {
  const result = render(<App getToday={() => '2028-02-03'} storage={memoryStorage()} createDemo={calendarFixture} />)
  await settle()
  await fire.click(button('Explore the App'))
  await fire.click(tab('Bills'))
  return result
}

async function browserBack() {
  await act(async () => {
    window.history.back()
    await new Promise(resolve => setTimeout(resolve, 20))
  })
}

beforeEach(() => { window.history.replaceState(null, '') })
afterEach(cleanup)

describe('Bills calendar', () => {
  it('starts on the demo’s date, not the device’s, and marks it apart from the chosen day', async () => {
    await openCalendarDemo()
    expect(monthSelect().value).toBe('2028-02')
    const reference = day('Thursday 10 February 2028')
    expect(reference.getAttribute('aria-label')).toBe('Thursday 10 February 2028, the demo’s date, no bills')
    expect(reference.getAttribute('aria-pressed')).toBe('true')
    expect(day('Thursday 3 February 2028').getAttribute('aria-label')).not.toContain('demo')
    await fire.click(day('Tuesday 15 February 2028'))
    expect(pressedDays().map(b => b.getAttribute('aria-label'))).toEqual(['Tuesday 15 February 2028, 4 bills: 1 paid, 3 pending'])
    // The demo's date keeps its own mark when another day is chosen.
    expect(reference.closest('td')!.classList.contains('is-reference')).toBe(true)
    expect(reference.closest('td')!.classList.contains('is-selected')).toBe(false)
  })

  it('starts the week on Monday, with English day names', async () => {
    await openCalendarDemo()
    const headings = [...document.querySelectorAll('.bills-calendar th')].map(th => [th.textContent, th.getAttribute('abbr')])
    expect(headings).toEqual([['Mon', 'Monday'], ['Tue', 'Tuesday'], ['Wed', 'Wednesday'], ['Thu', 'Thursday'], ['Fri', 'Friday'], ['Sat', 'Saturday'], ['Sun', 'Sunday']])
    // 1 February 2028 is a Tuesday: the first row starts with one empty place.
    const firstRow = document.querySelector('.bills-calendar tbody tr')!
    expect(firstRow.children[0].classList.contains('cal-empty')).toBe(true)
    expect(firstRow.children[1].querySelector('.cal-num')!.textContent).toBe('1')
  })

  it('puts a day-31 bill on the last day of shorter months, leap February included', async () => {
    await openCalendarDemo()
    expect(day('Tuesday 29 February 2028').getAttribute('aria-label')).toContain('1 bill: 0 paid, 1 pending')
    expect(chipNames('Tuesday 29 February 2028')).toEqual(['Gym'])
    await pickMonth('2028-04')
    expect(chipNames('Sunday 30 April 2028')).toEqual(['Gym'])
    await pickMonth('2028-01')
    expect(chipNames('Monday 31 January 2028')).toEqual(['Gym'])
  })

  it('shows a bill only between its first and last month', async () => {
    await openCalendarDemo()
    expect(chipNames('Saturday 5 February 2028')).toEqual(['Old Plan'])
    await pickMonth('2028-03')
    expect(chipNames('Sunday 5 March 2028')).toEqual(['New Course'])
  })

  it('shows up to two bills in a cell; with more, one bill and “+N more”, which opens the day’s full list', async () => {
    await openCalendarDemo()
    const cell = day('Tuesday 15 February 2028').closest('td')!
    expect(cell.querySelectorAll('.cal-chip')).toHaveLength(1)
    const more = within(cell as HTMLElement).getByRole('button', { name: '3 more bills on Tuesday 15 February 2028' })
    expect(more.textContent).toBe('+3 more')
    await fire.click(more)
    expect(day('Tuesday 15 February 2028').getAttribute('aria-pressed')).toBe('true')
    expect(within(dayList('Tuesday 15 February 2028')).getAllByRole('listitem')).toHaveLength(4)
  })

  it('keeps a paid bill on its due day, and its detail shows the real payment date', async () => {
    await openCalendarDemo()
    await fire.click(day('Tuesday 15 February 2028'))
    const water = within(dayList('Tuesday 15 February 2028')).getByRole('button', { name: /^Water/ })
    expect(text(water)).toContain('✓ Paid')
    expect(water.getAttribute('aria-label')).toBe('Water, 80,00 zł, paid. Open bill'.replace(' zł', '\u00a0zł'))
    await fire.click(water)
    expect(heading('Water')).toBeTruthy()
    expect(screen.getByText('Paid on 12 Feb 2028')).toBeTruthy()
    expect(monthSelect().value).toBe('2028-02')
  })

  it('uses a month’s own amount instead of the usual one, only in that month', async () => {
    await openCalendarDemo()
    await fire.click(day('Tuesday 15 February 2028'))
    const power = text(within(dayList('Tuesday 15 February 2028')).getByRole('button', { name: /^Power/ }))
    expect(power).toContain('250,00 zł')
    expect(power).toContain('Changed for this month')
    await pickMonth('2028-03')
    await fire.click(day('Wednesday 15 March 2028'))
    expect(text(within(dayList('Wednesday 15 March 2028')).getByRole('button', { name: /^Power/ }))).toContain('200,00 zł')
  })

  it('shows the same bills in Calendar and List', async () => {
    await openCalendarDemo()
    const days = [...document.querySelectorAll('.cal-day')].map(b => b.getAttribute('aria-label')!)
    const fromCalendar = days.reduce((sum, label) => sum + Number(/(\d+) bills?:/.exec(label)?.[1] ?? 0), 0)
    const chips = [...document.querySelectorAll('.cal-chip')].map(chip => chip.getAttribute('title'))
    await showView('List')
    expect(monthSelect().value).toBe('2028-02')
    expect(listNames()).toHaveLength(fromCalendar)
    expect(fromCalendar).toBe(7)
    for (const name of chips) expect(listNames()).toContain(name)
    expect(listNames()).not.toContain('New Course')
  })

  it('says an unknown amount is left out of the totals, and never shows it as 0', async () => {
    await openCalendarDemo()
    expect(screen.getByText('1 bill has an unknown amount. The totals include known amounts only.')).toBeTruthy()
    // Known: 100 + 80 + 250 + 60 + 120 + 30 = 640; Phone is unknown.
    expect(summary('Planned')).toContain('640,00 zł')
    expect(summary('Planned')).toContain('7 bills · 1 unknown')
    expect(summary('Paid')).toContain('80,00 zł')
    expect(summary('Left to Pay')).toContain('560,00 zł')
    expect(summary('Left to Pay')).toContain('6 bills · 1 unknown')
    expect(text(day('Sunday 20 February 2028').closest('td'))).toContain('Unknown')
    expect(text(day('Sunday 20 February 2028').closest('td'))).not.toContain('0,00')
  })

  it('filters Pending and Paid in both views, without changing the whole-month totals', async () => {
    await openCalendarDemo()
    await showFilter(/^Paid/)
    expect(screen.getByText('Showing paid bills only. Planned, Paid and Left to Pay are still for the whole month.')).toBeTruthy()
    expect(summary('Planned')).toContain('640,00 zł')
    expect(summary('Left to Pay')).toContain('560,00 zł')
    expect(day('Tuesday 15 February 2028').getAttribute('aria-label')).toContain('1 bill: 1 paid, 0 pending')
    expect(chipNames('Tuesday 29 February 2028')).toEqual([])
    await showView('List')
    expect(listNames()).toEqual(['Water'])
    await showFilter(/^Pending/)
    expect(listNames()).not.toContain('Water')
    expect(listNames()).toHaveLength(6)
  })

  it('moves between days with the keyboard, with one Tab stop for the days', async () => {
    await openCalendarDemo()
    const tabStops = [...document.querySelectorAll('.cal-day')].filter(b => b.getAttribute('tabindex') === '0')
    expect(tabStops).toHaveLength(1)
    const start = day('Thursday 10 February 2028')
    start.focus()
    await fire.keyDown(start, { key: 'ArrowRight' })
    expect(document.activeElement).toBe(day('Friday 11 February 2028'))
    expect(day('Friday 11 February 2028').getAttribute('aria-pressed')).toBe('true')
    await fire.keyDown(document.activeElement!, { key: 'ArrowDown' })
    expect(document.activeElement).toBe(day('Friday 18 February 2028'))
    await fire.keyDown(document.activeElement!, { key: 'End' })
    expect(document.activeElement).toBe(day('Sunday 20 February 2028'))
    await fire.keyDown(document.activeElement!, { key: 'Home' })
    expect(document.activeElement).toBe(day('Monday 14 February 2028'))
    await fire.keyDown(document.activeElement!, { key: 'ArrowUp' })
    // A week before 7 February is in January: the calendar does not leave its month.
    await fire.keyDown(document.activeElement!, { key: 'ArrowUp' })
    expect(document.activeElement).toBe(day('Monday 7 February 2028'))
    expect(monthSelect().value).toBe('2028-02')
  })

  it('keeps the month, view, filter and day when coming back from a bill', async () => {
    await openCalendarDemo()
    await showFilter(/^Pending/)
    await fire.click(day('Tuesday 15 February 2028'))
    await fire.click(within(dayList('Tuesday 15 February 2028')).getByRole('button', { name: /^Power/ }))
    expect(heading('Power')).toBeTruthy()
    await browserBack()
    expect(heading('Bills')).toBeTruthy()
    expect(monthSelect().value).toBe('2028-02')
    expect(group('View').getByRole('button', { name: 'Calendar' }).getAttribute('aria-pressed')).toBe('true')
    expect(group('Show bills').getByRole('button', { name: /^Pending/ }).getAttribute('aria-pressed')).toBe('true')
    expect(day('Tuesday 15 February 2028').getAttribute('aria-pressed')).toBe('true')

    await showView('List')
    await fire.click(button('Gym details'))
    await browserBack()
    expect(group('View').getByRole('button', { name: 'List' }).getAttribute('aria-pressed')).toBe('true')
  })

  it('hides every amount with Hide All Amounts, on screen and in print, and Home follows', async () => {
    await openCalendarDemo()
    await fire.click(button('Hide All Amounts'))
    const bills = document.querySelector('[data-screen="bills"]')!
    expect(text(bills)).not.toMatch(/\d,\d\d zł/)
    expect(summary('Planned')).toContain('••••')
    expect(text(document.querySelector('.bills-print'))).toContain('••••')
    expect(day('Tuesday 15 February 2028').closest('td')!.querySelector('.cal-chip')!.getAttribute('aria-label')).toContain('amount hidden')
    await showView('List')
    expect(text(bills)).not.toMatch(/\d,\d\d zł/)
    await fire.click(tab('Home'))
    expect(button('Show All Amounts')).toBeTruthy()
  })

  it('prints the whole month as a list, whatever the view and filter', async () => {
    await openCalendarDemo()
    await showFilter(/^Pending/)
    const rows = [...document.querySelectorAll('.bills-print tbody tr')].map(row => [...row.children].map(cell => text(cell)))
    expect(rows).toHaveLength(7)
    expect(rows).toContainEqual(['15 Feb 2028', 'Water', 'Paid on 12 Feb 2028', '80,00 zł'])
    expect(rows).toContainEqual(['20 Feb 2028', 'Phone', 'Pending', 'Unknown'])
    expect(rows[rows.length - 1]).toEqual(['29 Feb 2028', 'Gym', 'Pending', '100,00 zł'])
    expect(document.querySelector('.bills-print caption')!.textContent).toBe('Bills for February 2028 (whole month)')
  })
})

describe('Bills links', () => {
  const household = () => ({ data: createDemoHousehold(), today: DEMO_TODAY })

  it('opens a loan’s bill from Cards in the same month, and Bills follows the month', async () => {
    render(<App getToday={() => '2026-10-21'} storage={memoryStorage()} createDemo={household} />)
    await settle()
    await fire.click(button('Explore the App'))
    await fire.click(tab('Cards'))
    await pickMonth('2026-12')
    await fire.click(button(/^Furniture Loan/))
    await fire.click(within(document.querySelector('[data-screen="debt"]') as HTMLElement).getByRole('button', { name: 'Furniture Loan, December 2026' }))
    expect(heading('Furniture Loan')).toBeTruthy()
    expect(document.querySelector('[data-screen="bill"]')).toBeTruthy()
    expect(monthSelect().value).toBe('2026-12')
    await browserBack()
    await browserBack()
    await fire.click(tab('Bills'))
    expect(monthSelect().value).toBe('2026-12')
  })
})

describe('Add Bill', () => {
  async function openAddBill() {
    const storage = memoryStorage()
    render(<App getToday={() => '2026-10-21'} storage={storage} />)
    await settle()
    await fire.click(button(/Create Account/))
    await fire.click(button(/Continue Without an Account/))
    await type('Display Name', 'Robin')
    await fire.click(button(/Continue/))
    await fire.click(button(/Continue/))
    await fire.click(button(/Continue/))
    await fire.click(button('Create My Space'))
    await fire.click(tab('Bills'))
    await fire.click(button('Add Bill'))
    return storage
  }
  /** The own space's records as the browser's database keeps them now. */
const saved = async () => (await storedData())!
  const addButton = () => within(document.querySelector('.bill-form') as HTMLElement).getByRole('button', { name: 'Add Bill' })

  it('shows the main fields first, in English, and a check sentence', async () => {
    await openAddBill()
    expect(heading('Add Bill')).toBeTruthy()
    for (const label of ['Bill name', 'Category', 'Usual amount (PLN)', 'Amount not known yet', 'Due day']) expect(field(label)).toBeTruthy()
    expect(screen.getByText('Shorter months use their last day.')).toBeTruthy()
    expect(screen.queryByLabelText(/End month/)).toBeNull()
    expect(button(/More options/).getAttribute('aria-expanded')).toBe('false')
    const startMonth = screen.getByRole('combobox', { name: 'Start month: month' }) as HTMLSelectElement
    expect([...startMonth.options].map(option => option.text).slice(0, 3)).toEqual(['January', 'February', 'March'])
    expect(startMonth.value).toBe('10')
    expect((screen.getByRole('combobox', { name: 'Start month: year' }) as HTMLSelectElement).value).toBe('2026')
    expect(document.querySelector('input[type="month"]')).toBeNull()
    await type('Due day', '22')
    expect(screen.getByText('Monthly on day 22, starting October 2026. No end date.')).toBeTruthy()
    await fire.click(button(/More options/))
    await fire.change(screen.getByRole('combobox', { name: 'End month: month' }), { target: { value: '3' } })
    await fire.change(screen.getByRole('combobox', { name: 'End month: year' }), { target: { value: '2027' } })
    expect(screen.getByText('Monthly on day 22, starting October 2026, ending March 2027.')).toBeTruthy()
  })

  it('adds a bill with a known amount, once, even if saved twice at once', async () => {
    await openAddBill()
    await type('Bill name', 'Rent')
    await type('Usual amount (PLN)', '2400,50')
    await type('Due day', '31')
    const form = document.querySelector('.bill-form')!
    act(() => { fireEvent.submit(form); fireEvent.submit(form) })
    await settle()
    expect(heading('Rent')).toBeTruthy()
    expect((await saved()).bills).toMatchObject([{ name: 'Rent', amount: 240_050, dueDay: 31, startMonth: '2026-10', endMonth: null }])
    expect((await saved()).bills).toHaveLength(1)
  })

  it('accepts 0 as an amount, and never turns an empty amount into 0', async () => {
    await openAddBill()
    await type('Bill name', 'Library')
    await type('Due day', '3')
    await fire.click(addButton())
    expect(screen.getByText('Enter the usual amount, or choose Amount not known yet.')).toBeTruthy()
    expect(document.activeElement).toBe(field('Usual amount (PLN)'))
    // What was typed stays.
    expect(field('Bill name').value).toBe('Library')
    expect(field('Due day').value).toBe('3')
    await type('Usual amount (PLN)', '12.345')
    await fire.click(addButton())
    expect(screen.getByText('Enter an amount such as 700 or 120.45.')).toBeTruthy()
    expect((await saved()).bills).toEqual([])
    await type('Usual amount (PLN)', '0')
    await fire.click(addButton())
    expect((await saved()).bills).toMatchObject([{ name: 'Library', amount: 0 }])
  })

  it('adds a bill whose amount is not known yet, kept as unknown', async () => {
    await openAddBill()
    await type('Bill name', 'Electricity')
    await type('Usual amount (PLN)', '99')
    await fire.click(field('Amount not known yet'))
    expect(field('Usual amount (PLN)').disabled).toBe(true)
    await type('Due day', '12')
    await fire.click(addButton())
    expect((await saved()).bills).toMatchObject([{ name: 'Electricity', amount: null }])
    expect(screen.getAllByText('Unknown').length).toBeGreaterThan(0)
  })

  it('opens More options and focuses the field with an error there', async () => {
    await openAddBill()
    await type('Bill name', 'Course')
    await type('Usual amount (PLN)', '100')
    await type('Due day', '5')
    await fire.click(button(/More options/))
    await fire.change(screen.getByRole('combobox', { name: 'End month: month' }), { target: { value: '1' } })
    await fire.change(screen.getByRole('combobox', { name: 'End month: year' }), { target: { value: '2026' } })
    await fire.click(button(/More options/))
    expect(screen.queryByRole('combobox', { name: 'End month: month' })).toBeNull()
    await fire.click(addButton())
    expect(button(/More options/).getAttribute('aria-expanded')).toBe('true')
    expect(screen.getByText('The end month can’t be before the start month.')).toBeTruthy()
    expect(document.activeElement).toBe(screen.getByRole('combobox', { name: 'End month: month' }))
    expect((await saved()).bills).toEqual([])
  })

  it('offers only cards and loans no other bill pays, with one short explanation', async () => {
    render(<App getToday={() => '2026-10-21'} storage={memoryStorage()} createDemo={() => ({ data: createDemoHousehold(), today: DEMO_TODAY })} />)
    await settle()
    await fire.click(button('Explore the App'))
    await fire.click(tab('Bills'))
    await fire.click(button('Add Bill'))
    await fire.click(button(/More options/))
    const debts = screen.getByRole('combobox', { name: 'Pays a card or loan' }) as HTMLSelectElement
    // Car Loan and Furniture Loan already have their bill: a second one would count the payment twice.
    expect([...debts.options].map(option => option.text)).toEqual(['None', 'Credit Card'])
    expect(screen.queryByText(/counted once/)).toBeNull()
    await fire.change(debts, { target: { value: 'card' } })
    expect(screen.getAllByText('This bill is its monthly payment, counted once. Marking it paid does not update the remaining balance.')).toHaveLength(1)
  })

  it('Cancel saves nothing', async () => {
    await openAddBill()
    await type('Bill name', 'Something')
    await type('Usual amount (PLN)', '50')
    await type('Due day', '5')
    await fire.click(within(document.querySelector('.bill-form') as HTMLElement).getByRole('button', { name: 'Cancel' }))
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 20)) })
    expect(heading('Bills')).toBeTruthy()
    expect((await saved()).bills).toEqual([])
  })

  it('Edit Details uses the same form, opens More options when they are used, and keeps the amounts', async () => {
    render(<App getToday={() => '2026-10-21'} storage={memoryStorage()} createDemo={() => ({ data: createDemoHousehold(), today: DEMO_TODAY })} />)
    await settle()
    await fire.click(button('Explore the App'))
    await fire.click(tab('Bills'))
    await showView('List')
    await fire.click(button('Furniture Loan details'))
    await fire.click(button('Edit Details'))
    expect(heading('Edit Furniture Loan')).toBeTruthy()
    expect(button(/More options/).getAttribute('aria-expanded')).toBe('true')
    expect((screen.getByRole('combobox', { name: 'Pays a card or loan' }) as HTMLSelectElement).value).toBe('furniture')
    expect(screen.queryByLabelText(/Usual amount/)).toBeNull()
    expect(screen.getByText('Monthly on day 5, starting October 2026, ending June 2027.')).toBeTruthy()
    await type('Bill name', 'Sofa Loan')
    await fire.click(button('Save Changes'))
    expect(heading('Sofa Loan')).toBeTruthy()
    expect(screen.getByText(/^Details updated/)).toBeTruthy()
    expect(text(document.querySelector('[data-screen="bill"]'))).toContain('150,00 zł')
    // The usual amount is changed from a month the app chooses in English, never the browser's month field.
    await fire.click(button('Change Usual Amount'))
    expect((screen.getByRole('combobox', { name: 'From month: month' }) as HTMLSelectElement).selectedOptions[0].text).toBe('October')
  })
})

describe('Bills day panel', () => {
  // jsdom does not scroll: these record where the screen asked to go.
  let scrolledInto: { id: string; options: ScrollIntoViewOptions | undefined }[] = []
  let scrolledTo: number[] = []
  let reducedMotion = false
  beforeEach(() => {
    scrolledInto = []
    scrolledTo = []
    reducedMotion = false
    Element.prototype.scrollIntoView = function (this: Element, options?: boolean | ScrollIntoViewOptions) {
      scrolledInto.push({ id: this.id || this.className, options: typeof options === 'object' ? options : undefined })
    }
    vi.spyOn(window, 'scrollTo').mockImplementation(((_x: number, y: number) => { scrolledTo.push(y) }) as typeof window.scrollTo)
    window.matchMedia = ((query: string) => ({ matches: reducedMotion && query.includes('reduce'), media: query })) as unknown as typeof window.matchMedia
  })
  afterEach(() => {
    vi.restoreAllMocks()
    Object.defineProperty(window, 'scrollY', { value: 0, configurable: true })
  })

  const dayBar = () => text(document.querySelector('.cal-daybar-text'))
  const panelHeading = () => document.getElementById('bills-day-list-title')
  const addOnDay = async (date: string) => await fire.click(button(`Add Bill on ${date}`))
  const notice = () => document.querySelector<HTMLElement>('.cal-added [role="status"]')
  const fillBill = async (name: string) => {
    await type('Bill name', name)
    await type('Usual amount (PLN)', '45')
  }
  const saveBill = async () => {
    await fire.submit(document.querySelector('.bill-form')!)
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 20)) })
  }

  it('chooses a day without moving the page, and the day bar says the day and its bills', async () => {
    await openCalendarDemo()
    expect(dayBar()).toBe('Thu 10 Feb · No bills')
    await fire.click(day('Tuesday 15 February 2028'))
    expect(dayBar()).toBe('Tue 15 Feb · 4 bills · 3 pending')
    expect(scrolledInto).toEqual([])
    expect(scrolledTo).toEqual([])
    await showFilter(/^Paid/)
    expect(dayBar()).toBe('Tue 15 Feb · 1 paid bill')
    // The bar never shows amounts, so Hide All Amounts has nothing to hide there.
    await fire.click(button('Hide All Amounts'))
    expect(dayBar()).toBe('Tue 15 Feb · 1 paid bill')
    expect(button('View day details')).toBeTruthy()
  })

  it('View day details goes to the panel of a day in the last row and focuses its date; Back to calendar focuses the day', async () => {
    await openCalendarDemo()
    await fire.click(day('Tuesday 29 February 2028'))
    await fire.click(button('View day details'))
    expect(document.activeElement).toBe(panelHeading())
    expect(panelHeading()!.textContent).toBe('Tuesday 29 February 2028')
    expect(scrolledInto).toEqual([{ id: 'bills-day-list', options: { block: 'start', behavior: 'smooth' } }])
    await fire.click(button('Back to calendar'))
    expect(document.activeElement).toBe(day('Tuesday 29 February 2028'))
    expect(scrolledInto[1]).toEqual({ id: 'bills-calendar', options: { block: 'start', behavior: 'smooth' } })
  })

  it('jumps without animation when the device asks for reduced motion', async () => {
    await openCalendarDemo()
    reducedMotion = true
    await fire.click(day('Tuesday 1 February 2028'))
    await fire.click(button('View day details'))
    expect(scrolledInto).toEqual([{ id: 'bills-day-list', options: { block: 'start', behavior: 'auto' } }])
    expect(document.activeElement).toBe(panelHeading())
  })

  it('“+N more” chooses the day, goes to its panel and focuses its date', async () => {
    await openCalendarDemo()
    await fire.click(button('3 more bills on Tuesday 15 February 2028'))
    expect(day('Tuesday 15 February 2028').getAttribute('aria-pressed')).toBe('true')
    expect(document.activeElement).toBe(panelHeading())
    expect(panelHeading()!.textContent).toBe('Tuesday 15 February 2028')
    expect(scrolledInto.map(entry => entry.id)).toEqual(['bills-day-list'])
  })

  it('+ Add Bill on an empty day starts the form on that day and month; Cancel comes back to the same place and button', async () => {
    await openCalendarDemo()
    await fire.click(day('Tuesday 1 February 2028'))
    expect(within(dayList('Tuesday 1 February 2028')).getByText('No bills due on this day.')).toBeTruthy()
    Object.defineProperty(window, 'scrollY', { value: 640, configurable: true })
    await addOnDay('Tuesday 1 February 2028')
    expect(heading('Add Bill')).toBeTruthy()
    expect(field('Due day').value).toBe('1')
    expect((screen.getByRole('combobox', { name: 'Start month: month' }) as HTMLSelectElement).selectedOptions[0].text).toBe('February')
    expect((screen.getByRole('combobox', { name: 'Start month: year' }) as HTMLSelectElement).value).toBe('2028')
    await fire.click(within(document.querySelector('.bill-form') as HTMLElement).getByRole('button', { name: 'Cancel' }))
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 20)) })
    expect(heading('Bills')).toBeTruthy()
    expect(day('Tuesday 1 February 2028').getAttribute('aria-pressed')).toBe('true')
    expect(document.activeElement).toBe(button('Add Bill on Tuesday 1 February 2028'))
    expect(scrolledTo).toContain(640)
    expect(notice()).toBeNull()
  })

  it('+ Add Bill on day 31 keeps day 31, and the top Add Bill still starts empty', async () => {
    await openCalendarDemo()
    await pickMonth('2028-03')
    await fire.click(day('Friday 31 March 2028'))
    await addOnDay('Friday 31 March 2028')
    expect(field('Due day').value).toBe('31')
    expect((screen.getByRole('combobox', { name: 'Start month: month' }) as HTMLSelectElement).selectedOptions[0].text).toBe('March')
    await browserBack()
    await fire.click(button('Add Bill'))
    expect(field('Due day').value).toBe('')
  })

  it('saving from a day in the last row goes straight back to that day, with “Bill added.” and the new bill listed', async () => {
    await openCalendarDemo()
    await fire.click(day('Tuesday 29 February 2028'))
    Object.defineProperty(window, 'scrollY', { value: 900, configurable: true })
    await addOnDay('Tuesday 29 February 2028')
    await fillBill('Parking')
    await saveBill()
    expect(heading('Bills')).toBeTruthy()
    expect(monthSelect().value).toBe('2028-02')
    expect(day('Tuesday 29 February 2028').getAttribute('aria-pressed')).toBe('true')
    expect(notice()!.textContent).toBe('Bill added. Demo only: not saved.')
    expect(document.activeElement).toBe(notice())
    expect(scrolledTo).toContain(900)
    expect(within(dayList('Tuesday 29 February 2028')).getByRole('button', { name: /^Parking/ })).toBeTruthy()
    // Choosing another day ends the notice.
    await fire.click(day('Monday 28 February 2028'))
    expect(notice()).toBeNull()
  })

  it('a new bill hidden by the Paid filter says so and offers Show All, without changing the filter by itself', async () => {
    await openCalendarDemo()
    await showFilter(/^Paid/)
    await fire.click(day('Tuesday 15 February 2028'))
    await addOnDay('Tuesday 15 February 2028')
    await fillBill('Parking')
    await saveBill()
    expect(notice()!.textContent).toBe('Bill added. Demo only: not saved. The Paid filter hides it.')
    expect(group('Show bills').getByRole('button', { name: /^Paid/ }).getAttribute('aria-pressed')).toBe('true')
    expect(within(dayList('Tuesday 15 February 2028')).queryByRole('button', { name: /^Parking/ })).toBeNull()
    await fire.click(button('Show All'))
    expect(group('Show bills').getByRole('button', { name: /^All/ }).getAttribute('aria-pressed')).toBe('true')
    expect(within(dayList('Tuesday 15 February 2028')).getByRole('button', { name: /^Parking/ })).toBeTruthy()
    expect(notice()!.textContent).toBe('Bill added. Demo only: not saved.')
    expect(document.activeElement).toBe(notice())
  })

  it('a new bill that starts in a later month says why it is not in this month', async () => {
    await openCalendarDemo()
    await fire.click(day('Monday 21 February 2028'))
    await addOnDay('Monday 21 February 2028')
    await fillBill('Parking')
    await fire.change(screen.getByRole('combobox', { name: 'Start month: month' }), { target: { value: '4' } })
    await saveBill()
    expect(day('Monday 21 February 2028').getAttribute('aria-pressed')).toBe('true')
    expect(notice()!.textContent).toBe('Bill added. Demo only: not saved. It is not in February 2028: it starts in April 2028.')
    await fire.click(tab('Home'))
    await fire.click(tab('Bills'))
    expect(notice()).toBeNull()
  })

  it('coming back from a bill keeps the month, view, filter, day, place and the focus on the bill', async () => {
    await openCalendarDemo()
    await pickMonth('2028-03')
    await pickMonth('2028-02')
    await showFilter(/^Pending/)
    await fire.click(day('Tuesday 15 February 2028'))
    Object.defineProperty(window, 'scrollY', { value: 700, configurable: true })
    await fire.click(within(dayList('Tuesday 15 February 2028')).getByRole('button', { name: /^Power/ }))
    await browserBack()
    expect(monthSelect().value).toBe('2028-02')
    expect(group('Show bills').getByRole('button', { name: /^Pending/ }).getAttribute('aria-pressed')).toBe('true')
    expect(day('Tuesday 15 February 2028').getAttribute('aria-pressed')).toBe('true')
    expect(scrolledTo).toContain(700)
    expect(document.activeElement).toBe(within(dayList('Tuesday 15 February 2028')).getByRole('button', { name: /^Power/ }))

    // From a bill in a calendar cell, the focus goes back to it.
    const chip = () => day('Sunday 20 February 2028').closest('td')!.querySelector<HTMLElement>('.cal-chip')!
    await fire.click(chip())
    expect(heading('Phone')).toBeTruthy()
    await browserBack()
    expect(document.activeElement).toBe(chip())

    // From the list, the focus goes back to the bill's Details.
    await showView('List')
    await fire.click(button('Gym details'))
    await browserBack()
    expect(document.activeElement).toBe(button('Gym details'))
  })
})
