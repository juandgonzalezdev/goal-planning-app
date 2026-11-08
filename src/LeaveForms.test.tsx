// @vitest-environment jsdom
import { chooseMonth } from './test/monthPicker'
import { act, cleanup, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { browserSpaceStore } from './app/useSpace'
import type { SpaceStore, StoreChange } from './data/spaceStore'
import { createSpaceData } from './domain/finance/space'
import type { FinanceData } from './domain/finance/types'
import { memoryStorage } from './test/memoryStorage'
import { fire, freshDatabaseForEachTest, heldStore, settle, storedData } from './test/space'

/*
 * Step 1B: nothing typed is dropped without asking while the user moves
 * around the app. "Leave without saving?" comes before a tab, the logo, the
 * gear, a Back button, a link, another month or a change of the list would
 * close a form with changes; Back and Forward of the browser are undone and
 * asked the same way. New Goal and Welcome Setup keep their drafts, so they
 * never ask.
 */

freshDatabaseForEachTest()
beforeEach(() => { window.history.replaceState(null, '') })
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.useRealTimers() })

const TODAY = '2026-10-21'
const button = (name: string | RegExp) => screen.getByRole('button', { name })
const field = (label: string | RegExp) => screen.getByLabelText(label) as HTMLInputElement
const heading = (name: string | RegExp) => screen.queryByRole('heading', { name, level: 1 })
const tab = (name: string) => within(screen.getByRole('navigation', { name: 'Main navigation' })).getByRole('button', { name })
const question = () => screen.queryByRole('alertdialog', { name: 'Leave without saving?' })
const inQuestion = (name: string | RegExp) => within(question()!).getByRole('button', { name })
const shownScreen = () => document.querySelector('[data-screen]')?.getAttribute('data-screen')
const monthSelect = () => screen.getByRole('button', { name: /^Choose month:/ }) as HTMLButtonElement
const group = (name: string) => within(screen.getByRole('group', { name }))
/** Lets the browser's history moves (they arrive later, as in a browser) and their answers happen. */
const moves = () => act(async () => { for (let i = 0; i < 10; i++) await new Promise(resolve => setTimeout(resolve, 5)) })
const browserBack = async () => { act(() => window.history.back()); await moves() }

function robin(): FinanceData {
  const made = createSpaceData({ mode: 'individual', names: ['Robin'], currency: 'PLN', theme: 'light' })
  if (made.status !== 'created') throw new Error('invalid setup')
  return made.data
}

/** Robin's own space, saved on this device and open; `store` lets a test hold or watch the saves. */
async function ownSpace(store?: SpaceStore) {
  await browserSpaceStore(memoryStorage()).create(robin())
  render(<App getToday={() => TODAY} storage={memoryStorage()} createStore={store ? () => store : undefined} />)
  await settle()
}

/** Alex's demo, open (nothing in it is ever saved). */
async function demo() {
  render(<App getToday={() => TODAY} storage={memoryStorage()} />)
  await settle()
  await fire.click(button('Explore the App'))
}

async function typeNewAccount(name: string) {
  await fire.click(tab('Money'))
  await fire.click(button(/^Accounts & Savings/))
  await fire.click(button('Add Account'))
  field('Account Name').focus()
  await fire.change(field('Account Name'), { target: { value: name } })
}

describe('Leave without saving?', () => {
  it('asks before a tab closes a form with changes; Keep Editing stays exactly there, with the focus back in the field', async () => {
    await ownSpace()
    await typeNewAccount('Holiday pot')
    await fire.click(tab('Home'))
    expect(question()).toBeTruthy()
    expect(question()!.textContent).toContain('What you typed here is not saved:')
    expect(question()!.textContent).toContain('Add account')
    expect(document.activeElement).toBe(inQuestion('Keep Editing'))
    await fire.click(inQuestion('Keep Editing'))
    expect(question()).toBeNull()
    expect(shownScreen()).toBe('money')
    expect(field('Account Name').value).toBe('Holiday pot')
    expect(document.activeElement).toBe(field('Account Name'))
  })

  it('Escape is Keep Editing', async () => {
    await ownSpace()
    await typeNewAccount('Holiday pot')
    await fire.click(tab('Bills'))
    await fire.keyDown(question()!, { key: 'Escape' })
    expect(question()).toBeNull()
    expect(field('Account Name').value).toBe('Holiday pot')
  })

  it('Copy What I Typed copies only these forms and leaves the question and the screen open', async () => {
    await ownSpace()
    await typeNewAccount('Holiday pot')
    const copied: string[] = []
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: async (text: string) => { copied.push(text) } }, configurable: true })
    await fire.click(tab('Home'))
    await fire.click(inQuestion('Copy What I Typed'))
    expect(copied).toEqual(['Add account\nName: Holiday pot\nKind: savings\nAs of: 2026-10-21'])
    expect(question()).toBeTruthy()
    expect(question()!.textContent).toContain('Copied. Nothing was closed.')
    expect(shownScreen()).toBe('money')
  })

  it('shows the text to select when the browser does not allow copying', async () => {
    await ownSpace()
    await typeNewAccount('Holiday pot')
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: async () => { throw new Error('denied') } }, configurable: true })
    await fire.click(tab('Home'))
    await fire.click(inQuestion('Copy What I Typed'))
    expect((within(question()!).getByLabelText(/What you typed/) as HTMLTextAreaElement).value).toContain('Name: Holiday pot')
  })

  it('Discard and Leave makes the move asked for, once, and nothing is saved', async () => {
    await ownSpace()
    await typeNewAccount('Holiday pot')
    const length = window.history.length
    await fire.click(tab('Bills'))
    await fire.click(inQuestion('Discard and Leave'))
    expect(question()).toBeNull()
    expect(shownScreen()).toBe('bills')
    expect(window.history.length).toBe(length + 1)
    expect((await storedData())!.moneyAccounts).toEqual([])
    // Back on Data, the form is closed.
    await fire.click(tab('Money'))
    expect(screen.queryByLabelText('Account Name')).toBeNull()
  })

  it('asks the same way for the logo, the gear and a screen\'s Back button', async () => {
    await ownSpace()
    await typeNewAccount('Holiday pot')
    await fire.click(button('Go to Home'))
    expect(question()).toBeTruthy()
    await fire.click(inQuestion('Keep Editing'))
    await fire.click(button('Settings'))
    expect(question()).toBeTruthy()
    await fire.click(inQuestion('Keep Editing'))
    expect(shownScreen()).toBe('money')
  })

  it('never asks when nothing was typed, or when a form was only opened', async () => {
    await ownSpace()
    await fire.click(tab('Money'))
    await fire.click(button(/^Accounts & Savings/))
    await fire.click(button('Add Account'))
    await fire.click(tab('Bills'))
    expect(question()).toBeNull()
    expect(shownScreen()).toBe('bills')
    await fire.click(button('Go to Home'))
    expect(shownScreen()).toBe('home')
  })

  it('Cancel closes a form without asking: it is the user\'s own choice', async () => {
    await ownSpace()
    await fire.click(tab('Bills'))
    await fire.click(button('Add Bill'))
    await fire.change(field('Bill name'), { target: { value: 'Gym' } })
    await fire.click(within(document.querySelector('.bill-form') as HTMLElement).getByRole('button', { name: 'Cancel' }))
    await moves()
    expect(question()).toBeNull()
    expect(shownScreen()).toBe('bills')
  })

  it('works the same in the demo, and nothing is written anywhere', async () => {
    const local = vi.spyOn(Storage.prototype, 'setItem')
    await demo()
    await fire.click(tab('Money'))
    await fire.click(button(/^Accounts & Savings/))
    await fire.click(button('Add Account'))
    await fire.change(field('Account Name'), { target: { value: 'Invented pot' } })
    await fire.click(tab('Home'))
    expect(question()).toBeTruthy()
    await fire.click(inQuestion('Discard and Leave'))
    expect(shownScreen()).toBe('home')
    expect(local).not.toHaveBeenCalled()
    expect(await storedData()).toBeNull()
  })
})

describe('kept drafts', () => {
  it('Welcome Setup keeps what was typed while the user goes back to Welcome: no question', async () => {
    render(<App getToday={() => TODAY} storage={memoryStorage()} />)
    await settle()
    await fire.click(button(/Create Account/))
    await fire.click(button(/Continue Without an Account/))
    await fire.change(field('Display Name'), { target: { value: 'Sam' } })
    await fire.click(button('Go to Welcome'))
    expect(question()).toBeNull()
    expect(heading('Your goals, your way.')).toBeTruthy()
    await fire.click(button(/Create Account/))
    await fire.click(button(/Continue Without an Account/))
    expect(field('Display Name').value).toBe('Sam')
  })

  it('New Goal keeps what was typed while the user looks elsewhere: no question; Back to it shows it', async () => {
    await ownSpace()
    await fire.click(tab('Money'))
    await fire.click(button(/^Goals/))
    await fire.click(screen.getAllByRole('button', { name: /Add Goal/ })[0])
    await fire.change(field('What are you saving for?'), { target: { value: 'Trip' } })
    await fire.click(button('Go to Home'))
    expect(question()).toBeNull()
    expect(shownScreen()).toBe('home')
    await browserBack()
    expect(question()).toBeNull()
    expect(field('What are you saving for?').value).toBe('Trip')
  })

  it('a kept draft still counts when the demo would close it', async () => {
    await ownSpace()
    await fire.click(tab('Money'))
    await fire.click(button(/^Goals/))
    await fire.click(screen.getAllByRole('button', { name: /Add Goal/ })[0])
    await fire.change(field('What are you saving for?'), { target: { value: 'Trip' } })
    await fire.click(button('Settings'))
    await fire.click(button('Explore the Demo'))
    expect(screen.getByText('Opening the demo closes what you typed here. It cannot be brought back.')).toBeTruthy()
  })
})

describe('the browser\'s Back and Forward', () => {
  it('Back with a form changed: the screen stays, the question asks, and Discard and Leave goes back once', async () => {
    await ownSpace()
    await typeNewAccount('Holiday pot')
    const length = window.history.length
    await browserBack()
    expect(shownScreen()).toBe('money')
    expect(field('Account Name').value).toBe('Holiday pot')
    expect(question()).toBeTruthy()
    expect(window.history.length).toBe(length)
    await fire.click(inQuestion('Discard and Leave'))
    await moves()
    expect(question()).toBeNull()
    expect(shownScreen()).toBe('home')
    expect(window.history.length).toBe(length)
  })

  it('Keep Editing after Back: the next Back asks again; Forward with nothing typed works as usual', async () => {
    await ownSpace()
    await typeNewAccount('Holiday pot')
    await browserBack()
    await fire.click(inQuestion('Keep Editing'))
    expect(shownScreen()).toBe('money')
    await browserBack()
    expect(question()).toBeTruthy()
    await fire.click(inQuestion('Discard and Leave'))
    await moves()
    expect(shownScreen()).toBe('home')
    act(() => window.history.forward())
    await moves()
    expect(shownScreen()).toBe('money')
    expect(question()).toBeNull()
  })

  it('more Back while asking keeps the first destination', async () => {
    await ownSpace()
    await fire.click(tab('Bills'))
    await typeNewAccount('Holiday pot')
    await browserBack()
    await browserBack()
    expect(shownScreen()).toBe('money')
    expect(screen.getAllByRole('alertdialog')).toHaveLength(1)
    await fire.click(inQuestion('Discard and Leave'))
    await moves()
    expect(shownScreen()).toBe('bills')
  })

  it('two Back presses at once (the second before the app is back on the form): the form stays and Discard and Leave waits, never a second move', async () => {
    await ownSpace()
    await fire.click(tab('Bills'))
    await typeNewAccount('Holiday pot')
    const length = window.history.length
    // The browser is slow to carry out the app's own move back to the form: the user's second Back comes first.
    const go = window.history.go.bind(window.history)
    vi.spyOn(window.history, 'go').mockImplementation(delta => { setTimeout(() => go(delta), 40) })
    act(() => window.history.back())
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 10)) })
    act(() => window.history.back())
    await moves()
    await moves()
    expect(shownScreen()).toBe('money')
    expect(field('Account Name').value).toBe('Holiday pot')
    expect(inQuestion('Discard and Leave').getAttribute('aria-disabled')).toBe('true')
    await fire.click(inQuestion('Discard and Leave'))
    await moves()
    expect(shownScreen()).toBe('money')
    expect(window.history.length).toBe(length)
    expect(question()!.textContent).toContain('One moment…')
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 2100)) })
    expect(question()!.textContent).toContain('Navigation is taking longer than expected.')
    // Keep Editing; once the form is cancelled, Back works as usual again.
    await fire.click(inQuestion('Keep Editing'))
    await fire.click(within(document.querySelector('[data-money-block="accounts"]') as HTMLElement).getByRole('button', { name: 'Cancel' }))
    await browserBack()
    expect(question()).toBeNull()
  })
})

describe('changes inside a screen', () => {
  it('another month with an amount typed for this one: Keep Editing keeps the month and the amount, and it is saved for that month only', async () => {
    await demo()
    await fire.click(tab('Bills'))
    await fire.click(group('View').getByRole('button', { name: 'List' }))
    const change = screen.getAllByRole('button', { name: /^Change Amount for December 2026: / })[0]
    const name = change.getAttribute('aria-label')!.replace('Change Amount for December 2026: ', '')
    await fire.click(change)
    await fire.change(screen.getByLabelText(/^Amount for December 2026/), { target: { value: '999' } })
    await chooseMonth('2026-11')
    expect(question()!.textContent).toContain(`Amount for December 2026: ${name}`)
    await fire.click(inQuestion('Keep Editing'))
    expect(monthSelect().value).toBe('2026-12')
    expect((screen.getByLabelText(/^Amount for December 2026/) as HTMLInputElement).value).toBe('999')
    await fire.click(button('Save'))
    const line = (month: string) => document.querySelector('.bill-list')!.textContent!.includes('999,00') && month
    expect(line('dec')).toBe('dec')
    await chooseMonth('2026-11')
    expect(question()).toBeNull()
    expect(document.querySelector('.bill-list')!.textContent).not.toContain('999,00')
  })

  it('Discard and Leave on another month closes the amount first; it never reaches the new month', async () => {
    await demo()
    await fire.click(tab('Bills'))
    await fire.click(group('View').getByRole('button', { name: 'List' }))
    await fire.click(screen.getAllByRole('button', { name: /^Change Amount for December 2026: / })[0])
    await fire.change(screen.getByLabelText(/^Amount for December 2026/), { target: { value: '999' } })
    await chooseMonth('2026-11')
    await fire.click(inQuestion('Discard and Leave'))
    expect(monthSelect().value).toBe('2026-11')
    expect(screen.queryByLabelText(/^Amount for/)).toBeNull()
    expect(document.querySelector('.bill-list')!.textContent).not.toContain('999,00')
    await chooseMonth('2026-12')
    expect(document.querySelector('.bill-list')!.textContent).not.toContain('999,00')
  })

  it('Calendar or a filter that hides the bill asks; a filter that keeps it does not', async () => {
    await demo()
    await fire.click(tab('Bills'))
    await fire.click(group('View').getByRole('button', { name: 'List' }))
    await fire.click(screen.getAllByRole('button', { name: /^Change Amount for December 2026: / })[0])
    await fire.change(screen.getByLabelText(/^Amount for December 2026/), { target: { value: '999' } })
    await fire.click(group('View').getByRole('button', { name: 'Calendar' }))
    expect(question()).toBeTruthy()
    await fire.click(inQuestion('Keep Editing'))
    // December's bills are all paid in the demo: Paid keeps it, Pending hides it.
    await fire.click(group('Show bills by payment').getByRole('button', { name: /^Paid/ }))
    expect(question()).toBeNull()
    await fire.click(group('Show bills by payment').getByRole('button', { name: /^Pending/ }))
    expect(question()).toBeTruthy()
  })

  it('History: a filter that hides the record being changed asks; Add Spending stays through any filter', async () => {
    await demo()
    await fire.click(tab('History'))
    await fire.click(button('Add Spending'))
    await fire.change(field('Amount (PLN)'), { target: { value: '12' } })
    await fire.change(field('Search by name or note'), { target: { value: 'zzz-nothing' } })
    expect(question()).toBeNull()
    await fire.change(field('Search by name or note'), { target: { value: '' } })
    // Opening a record to change it would take the place of Add Spending: asked, and Keep Editing keeps it.
    const spending = () => [...document.querySelectorAll<HTMLButtonElement>('.history-months button.history-line[aria-expanded="false"]')].filter(row => row.querySelector('.type-spending'))
    await fire.click(spending()[0])
    expect(question()).toBeTruthy()
    await fire.click(inQuestion('Keep Editing'))
    expect(field('Amount (PLN)').value).toBe('12')
    await fire.click(within(screen.getByRole('group', { name: 'Add spending' })).getByRole('button', { name: 'Cancel' }))
    // Now a record is being changed: a search that hides it asks; Keep Editing leaves the search as it was.
    await fire.click(spending()[0])
    const form = screen.getByRole('group', { name: 'Change spending' })
    await fire.change(within(form).getByLabelText('Amount (PLN)'), { target: { value: '77' } })
    await fire.change(field('Search by name or note'), { target: { value: 'zzz-nothing' } })
    expect(question()!.textContent).toContain('Change expense')
    await fire.click(inQuestion('Keep Editing'))
    expect(field('Search by name or note').value).toBe('')
    expect((within(screen.getByRole('group', { name: 'Change spending' })).getByLabelText('Amount (PLN)') as HTMLInputElement).value).toBe('77')
    // Collapse All closes its month: asked too.
    await fire.click(button('Collapse All'))
    expect(question()).toBeTruthy()
  })
})

describe('while a change is being saved', () => {
  it('waits for the answer, then moves without asking once the form has closed', async () => {
    const held = heldStore()
    await ownSpace(held.store)
    await typeNewAccount('Holiday pot')
    held.hold()
    await act(async () => { button('Save Account').click() })
    await act(async () => { tab('Home').click() })
    expect(question()).toBeNull()
    expect(shownScreen()).toBe('money')
    await held.release()
    await settle()
    await moves()
    expect(question()).toBeNull()
    expect(shownScreen()).toBe('home')
    expect((await storedData())!.moneyAccounts.map(account => account.name)).toEqual(['Holiday pot'])
  })
})

describe('when nothing can be saved', () => {
  it('moving never asks: what was typed stays in the warning, to copy', async () => {
    await browserSpaceStore(memoryStorage()).create(robin())
    let listener: ((change: StoreChange) => void) | null = null
    const inner = browserSpaceStore(memoryStorage())
    const store: SpaceStore = { ...inner, watch: onChange => { listener = onChange; return () => { listener = null } } }
    render(<App getToday={() => TODAY} storage={memoryStorage()} createStore={() => store} />)
    await settle()
    await typeNewAccount('Holiday pot')
    await browserSpaceStore(memoryStorage()).erase()
    act(() => listener?.({ kind: 'erased' }))
    await settle()
    await fire.click(tab('Home'))
    expect(question()).toBeNull()
    expect(shownScreen()).toBe('home')
    expect(screen.getByRole('alert').textContent).toContain('Add account (closed)')
  })
})

describe('reload, closing the tab or leaving the site', () => {
  const unload = () => {
    const event = new Event('beforeunload', { cancelable: true })
    window.dispatchEvent(event)
    return event.defaultPrevented
  }

  it('asks the browser to warn only while something is typed (also a kept draft)', async () => {
    await ownSpace()
    expect(unload()).toBe(false)
    await typeNewAccount('Holiday pot')
    expect(unload()).toBe(true)
  })
})
