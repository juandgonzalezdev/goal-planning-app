// @vitest-environment jsdom
import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { memoryStorage } from './test/memoryStorage'
import { fire, settle, freshDatabaseForEachTest } from './test/space'
import { addFromHome } from './test/homeControls'

freshDatabaseForEachTest()

// + Add in the shared header (Rumbo de diseño, item 6): on every tab, outside the month bar, and only
// once (Home has no second one). Each choice opens the form or place that already exists; the
// choices that need something (accounts, goals, income, a bill to pay) show only when they apply.
// Back, or Cancel on a form it opened, goes back to where it was used, with the keyboard on + Add.
afterEach(() => { cleanup(); vi.restoreAllMocks() })

const button = (name: string | RegExp) => screen.getByRole('button', { name })
const tab = (name: string) => within(screen.getByRole('navigation', { name: 'Main navigation' })).getByRole('button', { name })
const addButton = () => within(document.querySelector<HTMLElement>('.shell-header')!).getByRole('button', { name: 'Add' })
const shownScreen = () => document.querySelector('main [data-screen]')?.getAttribute('data-screen')
const monthSelect = () => screen.getByRole('combobox', { name: 'Month' }) as HTMLSelectElement
const browserBack = async () => { window.history.back(); await settle() }

async function openAlex() {
  render(<App getToday={() => '2026-10-25'} storage={memoryStorage()} />)
  await settle()
  await fire.click(button('Explore the App'))
}

/** Welcome → Create Account → Welcome Setup → Home, as one person, with nothing entered yet. */
async function createOwnSpace() {
  render(<App getToday={() => '2026-10-25'} storage={memoryStorage()} />)
  await settle()
  await fire.click(button(/Create Account/))
  await fire.click(button(/Continue Without an Account/))
  await fire.change(screen.getByLabelText('Display Name'), { target: { value: 'Robin' } })
  await fire.click(button(/Continue/))
  await fire.click(button(/Continue/))
  await fire.click(button(/Continue/))
  await fire.click(button('Create My Space'))
}

describe('+ Add in the header', () => {
  it('is on every tab, once, and not on a detail screen', async () => {
    await openAlex()
    for (const name of ['Home', 'Bills', 'Goals', 'Money', 'History']) {
      await fire.click(tab(name))
      expect(screen.getAllByRole('button', { name: 'Add' })).toEqual([addButton()])
    }
    await fire.click(tab('Goals'))
    await fire.click(button(/^Trip to Japan/))
    expect(document.querySelector('.shell-add')).toBeNull()
  })

  it('offers only what applies: a new space has spending and the three plans', async () => {
    await createOwnSpace()
    await fire.click(addButton())
    expect(within(screen.getByRole('menu', { name: 'Add' })).getAllByRole('menuitem').map(item => item.textContent))
      .toEqual(['Add Spending', 'Add Income', 'Add Bill', 'Add Goal'])
  })
})

describe('Each choice opens what already exists', () => {
  it('Record Income Received: this month’s income in Money; Back goes to where + Add was used', async () => {
    await openAlex()
    await fire.click(tab('Bills'))
    await addFromHome('Record Income Received')
    expect(shownScreen()).toBe('money')
    expect(document.activeElement).toBe(button('Change: Salary, December 2026'))
    await browserBack()
    expect(shownScreen()).toBe('bills')
    expect(document.activeElement).toBe(addButton())
  })

  it('Add Transfer: the transfer form in History; Cancel goes back, with the keyboard on + Add', async () => {
    await openAlex()
    await fire.click(tab('Goals'))
    await addFromHome('Add Transfer')
    expect(shownScreen()).toBe('history')
    expect(document.activeElement).toBe(document.getElementById('transfer-new-date'))
    await fire.click(within(screen.getByRole('group', { name: 'Add transfer' })).getByRole('button', { name: 'Cancel' }))
    await waitFor(() => expect(shownScreen()).toBe('goals'))
    expect(document.activeElement).toBe(addButton())
  })

  it('Update a Balance: Accounts & Savings in Money, to choose the account', async () => {
    await openAlex()
    await addFromHome('Update a Balance')
    expect(shownScreen()).toBe('money')
    const block = screen.getByRole('region', { name: 'Accounts & Savings' })
    expect(within(block).getByRole('button', { name: /^Accounts & Savings/ }).getAttribute('aria-expanded')).toBe('true')
    expect(document.activeElement).toBe(within(block).getByRole('button', { name: /^Accounts & Savings/ }))
  })

  it('Add a Contribution: Goals says to choose one, and the goal opens on the amount', async () => {
    await openAlex()
    await addFromHome('Add a Contribution')
    expect(shownScreen()).toBe('goals')
    expect(document.activeElement).toBe(document.getElementById('goals-add-hint'))
    await fire.click(button(/^Trip to Japan/))
    expect(document.activeElement).toBe(document.getElementById('move-amount'))
    await fire.click(button('Back'))
    expect(document.getElementById('goals-add-hint')).toBeTruthy()
    await fire.click(tab('Home'))
    await fire.click(tab('Goals'))
    expect(document.getElementById('goals-add-hint')).toBeNull()
  })

  it('Mark a Bill as Paid: this month’s bills to pay; Back finds Home on its month', async () => {
    await openAlex()
    await fire.change(monthSelect(), { target: { value: '2026-08' } })
    await addFromHome('Mark a Bill as Paid')
    expect(shownScreen()).toBe('bills')
    expect(monthSelect().value).toBe('2026-12')
    expect(button(/^Pending/).getAttribute('aria-pressed')).toBe('true')
    expect(document.activeElement).toBe(button('Mark as Paid: Phone & Internet, December 2026'))
    await browserBack()
    expect(shownScreen()).toBe('home')
    expect(monthSelect().value).toBe('2026-08')
    expect(document.activeElement).toBe(addButton())
  })
})
