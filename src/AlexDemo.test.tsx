// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, renderHook, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import App from './App'
import { useSpace } from './app/useSpace'
import { createSpaceData } from './domain/finance/space'
import { STORAGE_KEY } from './data/localStore'
import { memoryStorage } from './test/memoryStorage'

// The public demo: Alex, invented, on the demo's own date (23 Oct 2026).
afterEach(() => { cleanup(); document.documentElement.removeAttribute('data-theme') })

const button = (name: string | RegExp) => screen.getByRole('button', { name })
const heading = (name: string | RegExp) => screen.getByRole('heading', { name })
const field = (label: string | RegExp) => screen.getByLabelText(label) as HTMLInputElement
const type = (label: string | RegExp, value: string) => fireEvent.change(field(label), { target: { value } })
const tab = (name: string) => within(screen.getByRole('navigation', { name: 'Main navigation' })).getByRole('button', { name })
const text = (element: Element | null) => (element?.textContent ?? '').replace(/\u00a0|\u202f/g, ' ')
const region = (name: string) => text(screen.getByRole('region', { name }))
const stat = (label: string) => text(screen.getAllByText(label)[0].parentElement)

/** Goes back through the browser history until the tabs show again. */
async function backHome() {
  while (!screen.queryByRole('navigation', { name: 'Main navigation' })) {
    await act(async () => {
      window.history.back()
      await new Promise(resolve => setTimeout(resolve, 20))
    })
  }
  fireEvent.click(tab('Home'))
}

function openAlex(storage: Storage = memoryStorage()) {
  const result = render(<App getToday={() => '2026-10-25'} storage={storage} />)
  fireEvent.click(button('Explore the App'))
  return { storage, ...result }
}

describe('Alex demo: Home', () => {
  it('is clearly an invented demo that is not saved, with Reset Demo', () => {
    const { storage } = openAlex()
    const banner = text(screen.getByRole('note'))
    expect(banner).toContain('Alex is invented')
    expect(banner).toContain('Changes are not saved')
    expect(button('Reset Demo')).toBeTruthy()
    expect(storage.length).toBe(0)
  })

  it('shows the sections in the approved order', () => {
    openAlex()
    const titles = [...document.querySelectorAll('main h2')].map(h => h.textContent)
    const order = ['Left to Pay', 'Monthly Bills by Category', 'Total Debt', 'My Money', 'My Goals', 'Plan Another Goal']
    const positions = order.map(title => titles.indexOf(title))
    expect(positions.every(p => p >= 0)).toBe(true)
    expect([...positions].sort((a, b) => a - b)).toEqual(positions)
  })

  it('shows 6,500 income, 5,750 planned and a 750 difference that is not called savings (1)', () => {
    openAlex()
    expect(stat('Income')).toContain('6500,00 zł')
    expect(stat('Planned Bills')).toContain('5750,00 zł')
    expect(stat('Income minus Bills')).toContain('750,00 zł')
    expect(stat('Income minus Bills')).toContain('Not money saved')
    expect(text(document.querySelector('main'))).not.toMatch(/available to spend|money left|spent/i)
  })

  it('says what is still to pay in October, and changes when the last bill is paid (5)', () => {
    openAlex()
    expect(region('Left to Pay')).toContain('250,00 zł')
    expect(region('Left to Pay')).toContain('You still have bills to pay in October.')
    fireEvent.click(tab('Bills'))
    fireEvent.click(button(/Sunday 25 October/))
    fireEvent.click(button('Student Loan paid in October 2026'))
    fireEvent.click(tab('Home'))
    expect(region('Left to Pay')).toContain('All your October bills are paid.')
    // Paying a bill does not lower what is owed.
    expect(region('Total Debt')).toContain('17 400,00 zł')
  })

  it('opens Total Debt in place, and each debt leads to its card or loan (2)', async () => {
    openAlex()
    const toggle = button(/Remaining balances/)
    expect(toggle.getAttribute('aria-expanded')).toBe('false')
    fireEvent.click(toggle)
    expect(toggle.getAttribute('aria-expanded')).toBe('true')
    const debt = within(screen.getByRole('region', { name: 'Total Debt' }))
    expect(text(debt.getByRole('button', { name: /Credit Card/ }))).toContain('1800,00 zł')
    expect(text(debt.getByRole('button', { name: /Student Loan/ }))).toContain('12 000,00 zł')
    expect(text(debt.getByRole('button', { name: /Small Loan/ }))).toContain('3600,00 zł')
    fireEvent.click(debt.getByRole('button', { name: /Credit Card/ }))
    await waitFor(() => expect(heading('Credit Card')).toBeTruthy())
    expect(text(screen.getByText('Remaining Balance').parentElement)).toContain('1800,00 zł')
  })

  it('changes one month of Utilities from Home with Save, and Cancel changes nothing (4, 9)', () => {
    openAlex()
    fireEvent.click(button(/^Utilities/))
    fireEvent.click(button('Change Utilities amount for October 2026'))
    type('Utilities for October 2026 (PLN)', '999')
    fireEvent.click(button('Cancel'))
    expect(stat('Planned Bills')).toContain('5750,00 zł')

    fireEvent.click(button('Change Utilities amount for October 2026'))
    expect(field('Utilities for October 2026 (PLN)').value).toBe('700.00')
    type('Utilities for October 2026 (PLN)', '750')
    fireEvent.click(button('Save'))
    expect(screen.getAllByRole('status').map(text)).toContain('Utilities for October is now 750,00 zł. Demo only: not saved.')
    expect(stat('Planned Bills')).toContain('5800,00 zł')
    expect(stat('Income minus Bills')).toContain('700,00 zł')
    fireEvent.click(button('November 2026'))
    expect(stat('Planned Bills')).toContain('5750,00 zł')
  })

  it('rejects an amount that is not a number instead of saving zero (12)', () => {
    openAlex()
    fireEvent.click(button(/^Utilities/))
    fireEvent.click(button('Change Utilities amount for October 2026'))
    type('Utilities for October 2026 (PLN)', 'abc')
    fireEvent.click(button('Save'))
    expect(screen.getByText(/Enter an amount such as/)).toBeTruthy()
    expect(field('Utilities for October 2026 (PLN)').getAttribute('aria-invalid')).toBe('true')
    expect(stat('Planned Bills')).toContain('5750,00 zł')
  })

  it('remembers Donut or Bars', () => {
    const storage = memoryStorage()
    openAlex(storage)
    fireEvent.click(button('Bars'))
    expect(button('Bars').getAttribute('aria-pressed')).toBe('true')
    cleanup()
    openAlex(storage)
    expect(button('Bars').getAttribute('aria-pressed')).toBe('true')
    // Only the chart preference is kept: no demo data.
    expect(storage.getItem(STORAGE_KEY)).toBeNull()
  })

  it('divides Savings by purpose, with no double counting', () => {
    openAlex()
    const savings = text(screen.getByRole('group', { name: 'Savings by purpose' }))
    expect(savings).toContain('Your savings are divided by purpose.')
    for (const part of ['Trip to Japan', '600,00 zł', 'Christmas Gift', '100,00 zł', 'Emergency Fund', '300,00 zł', 'Unassigned', '350,00 zł', '1350,00 zł']) {
      expect(savings).toContain(part)
    }
  })

  it('shows Japan at 6% with 9,400 left, and Christmas Gift with its date', () => {
    openAlex()
    const goals = region('My Goals')
    expect(goals).toContain('Trip to Japan')
    expect(goals).toContain('6%')
    expect(goals).toContain('Flexible')
    expect(goals).toContain('With Date')
    expect(button('Add Goal')).toBeTruthy()
  })
})

describe('Alex demo: goals and savings', () => {
  async function openJapan() {
    openAlex()
    fireEvent.click(within(screen.getByRole('region', { name: 'My Goals' })).getByRole('button', { name: /Trip to Japan/ }))
    await waitFor(() => expect(heading('Trip to Japan')).toBeTruthy())
  }
  const addMoney = (effect: RegExp) => {
    fireEvent.click(within(screen.getByRole('group', { name: 'Type of change' })).getByRole('button', { name: 'Add' }))
    fireEvent.click(screen.getByRole('radio', { name: effect }))
    type(/^Amount/, '100')
    fireEvent.click(button('Save Contribution'))
  }

  it('adds 100 of new savings once: 700, 7%, Savings 1,450 (7)', async () => {
    await openJapan()
    addMoney(/New savings/)
    expect(text(screen.getAllByRole('status').find(s => s.textContent)!)).toBe('Added 100,00 zł (new savings). Demo only: not saved.')
    expect(region('Progress')).toContain('700,00 zł')
    expect(region('Progress')).toContain('7.0%')
    await backHome()
    expect(text(screen.getByRole('group', { name: 'Savings by purpose' }))).toContain('1450,00 zł')
  })

  it('moves 100 of existing savings: Savings stays 1,350, unassigned goes to 250 (8)', async () => {
    await openJapan()
    addMoney(/Savings I already have/)
    expect(region('Progress')).toContain('700,00 zł')
    await backHome()
    const savings = text(screen.getByRole('group', { name: 'Savings by purpose' }))
    expect(savings).toContain('1350,00 zł')
    expect(savings).toContain('250,00 zł')
    expect(savings).toContain('700,00 zł')
  })
})

describe('Alex demo: keeping and resetting', () => {
  it('keeps edits while switching tabs, and Reset Demo restores the example (10, 11)', async () => {
    openAlex()
    fireEvent.click(tab('Cards'))
    expect(heading('My Loans & Cards')).toBeTruthy()
    expect(text(document.querySelector('main'))).toContain('Summary based on your loans and cards.')
    fireEvent.click(button(/Small Loan/))
    await waitFor(() => expect(heading('Small Loan')).toBeTruthy())
    fireEvent.click(button('Update Balance'))
    type('Remaining Balance (PLN)', '3300')
    fireEvent.click(button('Save Balance'))
    expect(text(screen.getAllByRole('status').find(s => s.textContent)!)).toContain('Demo only: not saved.')
    await backHome()
    for (const name of ['History', 'Data', 'Bills', 'Home']) fireEvent.click(tab(name))
    expect(region('Total Debt')).toContain('17 100,00 zł')

    fireEvent.click(button('Reset Demo'))
    fireEvent.click(button('Restore Example'))
    expect(region('Total Debt')).toContain('17 400,00 zł')
  })

  it('never touches saved information when the demo is used or reset (11)', () => {
    const storage = memoryStorage()
    storage.setItem(STORAGE_KEY, '{ saved, but unreadable')
    openAlex(storage)
    fireEvent.click(tab('Bills'))
    fireEvent.click(button(/Sunday 25 October/))
    fireEvent.click(button('Student Loan paid in October 2026'))
    fireEvent.click(button('Reset Demo'))
    fireEvent.click(button('Restore Example'))
    fireEvent.click(button('Exit Demo'))
    expect(storage.getItem(STORAGE_KEY)).toBe('{ saved, but unreadable')
  })

  it('resets only the demo, even with an own space saved on the device (11)', () => {
    const storage = memoryStorage()
    const own = createSpaceData({ mode: 'individual', names: ['Robin'], currency: 'PLN', theme: 'light' })
    if (own.status !== 'created') throw new Error('invalid setup')
    storage.setItem(STORAGE_KEY, JSON.stringify(own.data))
    const before = storage.getItem(STORAGE_KEY)
    const { result } = renderHook(() => useSpace(storage, () => '2026-10-25'))
    expect(result.current.open?.kind).toBe('own')
    act(() => result.current.openDemo())
    act(() => { result.current.update(data => ({ ...data, bills: [] })) })
    act(() => result.current.resetDemo())
    expect(result.current.open).toMatchObject({ kind: 'demo', data: { bills: expect.arrayContaining([expect.objectContaining({ name: 'Rent' })]) } })
    expect(storage.getItem(STORAGE_KEY)).toBe(before)
  })

  it('starts the demo again from the example after Exit Demo and reload (10)', async () => {
    const storage = memoryStorage()
    openAlex(storage)
    fireEvent.click(button(/^Utilities/))
    fireEvent.click(button('Change Utilities amount for October 2026'))
    type('Utilities for October 2026 (PLN)', '750')
    fireEvent.click(button('Save'))
    cleanup()
    openAlex(storage)
    expect(stat('Planned Bills')).toContain('5750,00 zł')
  })
})

describe('Alex demo: keyboard and labels', () => {
  it('names every button and field', () => {
    openAlex()
    for (const name of ['Home', 'Bills', 'Cards', 'History', 'Data']) fireEvent.click(tab(name)) // every tab opens
    fireEvent.click(tab('Home'))
    for (const element of screen.getAllByRole('button')) expect(element.textContent?.trim() || element.getAttribute('aria-label')).toBeTruthy()
    for (const element of document.querySelectorAll('input, select, textarea')) {
      expect(screen.getByLabelText((_, node) => node === element)).toBeTruthy()
    }
  })

  it('uses real buttons, so Enter and Space work and focus moves through them', async () => {
    openAlex()
    const toggle = button(/Remaining balances/)
    expect(toggle.tagName).toBe('BUTTON')
    expect(toggle.getAttribute('type')).toBe('button')
    act(() => toggle.focus())
    expect(document.activeElement).toBe(toggle)
    expect(screen.getAllByRole('button').every(b => b.tabIndex >= 0)).toBe(true)
  })
})
