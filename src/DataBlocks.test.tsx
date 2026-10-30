// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import App from './App'
import { STORAGE_KEY } from './data/localStore'
import { memoryStorage } from './test/memoryStorage'
import { fire, settle, storedData, freshDatabaseForEachTest } from './test/space'
import { chooseHomeOption, startDemoReset } from './test/homeControls'

freshDatabaseForEachTest()

// Data in six blocks that open and close, its compact lists and filters, the
// links into one block, and Reset Demo in two steps. Alex's demo is shown on
// its own date, 31 Dec 2026; the device date is in October.
afterEach(() => { cleanup(); document.documentElement.removeAttribute('data-theme') })

const button = (name: string | RegExp) => screen.getByRole('button', { name })
const text = (element: Element | null) => (element?.textContent ?? '').replace(/\u00a0|\u202f/g, ' ')
const tab = (name: string) => within(screen.getByRole('navigation', { name: 'Main navigation' })).getByRole('button', { name })
const BLOCKS = ['Income', 'Bills', 'Cards & Loans', 'Accounts & Balances', 'Goals & Emergency Fund', 'Reports & Backup']
const escape = (name: string) => name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const regionOf = (name: string) => screen.getByRole('region', { name })
const toggleOf = (name: string) => within(regionOf(name)).getByRole('button', { name: new RegExp(`^${escape(name)}`) })
const bodyOf = (name: string) => regionOf(name).querySelector('.block-body')!
const isOpen = (name: string) => toggleOf(name).getAttribute('aria-expanded') === 'true'
const openBlock = async (name: string) => { if (!isOpen(name)) await fire.click(toggleOf(name)) }
const summaryOf = (name: string) => text(regionOf(name).querySelector('.block-summary'))
const lineNames = (name: string) => [...regionOf(name).querySelectorAll('.compact-list > li .item-name')].map(item => text(item).trim())
const filter = async (block: string, option: RegExp) => await fire.click(within(regionOf(block)).getByRole('button', { name: option }))
const monthSelect = () => screen.getByRole('combobox', { name: 'Month' }) as HTMLSelectElement
const pickMonth = async (month: string) => await fire.change(monthSelect(), { target: { value: month } })
const confirmReset = async () => await fire.click(within(screen.getByRole('group', { name: 'Reset demo?' })).getByRole('button', { name: 'Reset Demo' }))

async function openAlex(storage: Storage = memoryStorage()) {
  const result = render(<App getToday={() => '2026-10-25'} storage={storage} />)
  await settle()
  await fire.click(button('Explore the App'))
  return { storage, ...result }
}

async function openData() {
  await openAlex()
  await fire.click(tab('Data'))
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

describe('Data blocks', () => {
  it('shows six closed blocks in a fixed order, each with a short summary', async () => {
    await openData()
    const names = [...document.querySelectorAll('[data-screen="data"] [data-data-block] .block-name')].map(element => element.textContent)
    expect(names).toEqual(BLOCKS)
    for (const name of BLOCKS) {
      expect(isOpen(name)).toBe(false)
      expect(bodyOf(name).hasAttribute('inert')).toBe(true)
      expect(bodyOf(name).getAttribute('aria-hidden')).toBe('true')
      expect(summaryOf(name)).not.toBe('')
    }
    expect(summaryOf('Income')).toBe('3 sources · 1 active')
    expect(summaryOf('Cards & Loans')).toBe('1 card · 2 loans')
    expect(summaryOf('Goals & Emergency Fund')).toBe('2 goals · Emergency Fund')
    // Closed content is not reachable: the Record Received buttons are not in the accessibility tree.
    expect(screen.queryByRole('button', { name: /^Record Received/ })).toBeNull()
  })

  it('opens several blocks at once from their headings; Add buttons sit beside the heading', async () => {
    await openData()
    await fire.click(toggleOf('Income'))
    await fire.click(toggleOf('Accounts & Balances'))
    expect(isOpen('Income')).toBe(true)
    expect(isOpen('Accounts & Balances')).toBe(true)
    expect(bodyOf('Income').hasAttribute('inert')).toBe(false)
    // The action is a separate button, not inside the heading button, and does not close the block.
    const add = within(regionOf('Income')).getByRole('button', { name: /Add Income/ })
    expect(toggleOf('Income').contains(add)).toBe(false)
    await fire.click(add)
    expect(isOpen('Income')).toBe(true)
    expect(document.activeElement).toBe(screen.getByLabelText('Name'))
  })

  it('opens the six blocks with Expand All, but not the payments of every income source', async () => {
    await openData()
    await fire.click(button('Expand All'))
    for (const name of BLOCKS) expect(isOpen(name)).toBe(true)
    expect(screen.queryByRole('combobox', { name: /^Payments of/ })).toBeNull()
    expect(within(regionOf('Income')).getAllByRole('button', { expanded: false }).length).toBeGreaterThan(0)
  })

  it('closes everything with Collapse All, keeping the focus out of hidden content and what was typed', async () => {
    await openData()
    await fire.click(button('Expand All'))
    await fire.click(within(regionOf('Accounts & Balances')).getByRole('button', { name: /Add Account/ }))
    await fire.change(screen.getByLabelText('Account Name'), { target: { value: 'Piggy Bank' } })
    const collapse = button('Collapse All')
    collapse.focus()
    await fire.click(collapse)
    for (const name of BLOCKS) expect(isOpen(name)).toBe(false)
    expect(document.activeElement).toBe(collapse)
    expect(document.activeElement?.closest('[inert]')).toBeNull()
    await fire.click(toggleOf('Accounts & Balances'))
    expect((screen.getByLabelText('Account Name') as HTMLInputElement).value).toBe('Piggy Bank')
  })

  it('keeps a form being typed when its block is closed from the heading', async () => {
    await openData()
    await fire.click(within(regionOf('Income')).getByRole('button', { name: /Add Income/ }))
    await fire.change(screen.getByLabelText('Name'), { target: { value: 'Bonus' } })
    await fire.click(toggleOf('Income'))
    expect(isOpen('Income')).toBe(false)
    await fire.click(toggleOf('Income'))
    expect((screen.getByLabelText('Name') as HTMLInputElement).value).toBe('Bonus')
  })

  it('remembers open blocks while moving around, separately for the demo and the own space', async () => {
    const storage = memoryStorage()
    const result = render(<App getToday={() => '2026-10-25'} storage={storage} />)
    await settle()
    await fire.click(button('Explore the App'))
    await fire.click(tab('Data'))
    await openBlock('Income')
    await openBlock('Bills')
    await fire.click(tab('Home'))
    await fire.click(tab('Data'))
    expect(isOpen('Income')).toBe(true)
    expect(isOpen('Bills')).toBe(true)

    await fire.click(button('Exit Demo'))
    await createOwnSpace()
    await fire.click(tab('Data'))
    for (const name of BLOCKS) expect(isOpen(name)).toBe(false)
    await openBlock('Accounts & Balances')
    await fire.click(tab('Bills'))
    await fire.click(tab('Data'))
    expect(isOpen('Accounts & Balances')).toBe(true)
    expect(isOpen('Income')).toBe(false)

    // A new session starts with every block closed (nothing is kept between sessions).
    result.unmount()
    render(<App getToday={() => '2026-10-25'} storage={storage} />)
    await settle()
    await fire.click(tab('Data'))
    for (const name of BLOCKS) expect(isOpen(name)).toBe(false)
  })
})

describe('Data: Income', () => {
  it('lists the sources compactly and filters them by status on the demo’s date', async () => {
    await openData()
    await openBlock('Income')
    expect(text(regionOf('Income'))).toContain('worked out for 31 Dec 2026 (the demo’s date)')
    expect(lineNames('Income')).toEqual(['Salary Active'])
    const salary = text(regionOf('Income').querySelector('.compact-list > li'))
    expect(salary).toContain('6500,00 zł expected each month · Pay day 28')
    expect(salary).toContain('From September 2026 · no end month')
    await filter('Income', /^Ended/)
    expect(lineNames('Income')).toEqual(['Part-time Job Ended', 'Scholarship Ended'])
    expect(text(regionOf('Income'))).toContain('January 2026 to June 2026')
    await filter('Income', /^All/)
    expect(lineNames('Income')).toHaveLength(3)
    // No source starts later, so there is no Upcoming filter.
    expect(within(regionOf('Income')).queryByRole('button', { name: /^Upcoming/ })).toBeNull()
  })

  it('opens one source with its months, expected and received apart, and its actions', async () => {
    await openData()
    await openBlock('Income')
    await fire.click(within(regionOf('Income')).getByRole('button', { name: /^Salary/ }))
    const period = screen.getByRole('combobox', { name: 'Payments of Salary' }) as HTMLSelectElement
    expect(period.value).toBe('2026')
    expect([...period.options].map(option => option.value)).toEqual(['2026', '2027', 'all'])
    const months = [...regionOf('Income').querySelectorAll('.payment-list > li')].map(item => text(item))
    expect(months.map(item => item.split('Expected')[0])).toEqual(['September 2026', 'October 2026', 'November 2026', 'December 2026'])
    expect(months[3]).toContain('Expected: 6500,00 zł on 28 Dec 2026')
    expect(months[3]).toMatch(/Received: 6500,00 zł on \d+ Dec 2026/)

    await fire.click(button('Not Received: Salary, December 2026'))
    const december = () => text([...regionOf('Income').querySelectorAll('.payment-list > li')].at(-1)!)
    expect(december()).toContain('Received: not recorded yet')
    await fire.click(button('Record Received: Salary, December 2026'))
    await fire.change(screen.getByLabelText(/Amount Received/), { target: { value: '6400' } })
    await fire.change(screen.getByLabelText('Date Received'), { target: { value: '2026-12-27' } })
    await fire.click(button('Save'))
    expect(december()).toContain('Received: 6400,00 zł on 27 Dec 2026')
    expect(december()).toContain('Expected: 6500,00 zł on 28 Dec 2026')

    await fire.change(period, { target: { value: '2027' } })
    expect([...regionOf('Income').querySelectorAll('.payment-list > li')].map(item => text(item).split('Expected')[0])).toEqual(['January 2027'])
    expect(button('Edit Salary')).toBeTruthy()
    expect(button('Remove Salary')).toBeTruthy()
  })

  it('shows a source that starts later as Upcoming, never as Ended, whatever month is chosen elsewhere', async () => {
    await openAlex()
    await pickMonth('2026-03')
    await fire.click(tab('Data'))
    await openBlock('Income')
    await fire.click(within(regionOf('Income')).getByRole('button', { name: /Add Income/ }))
    await fire.change(screen.getByLabelText('Name'), { target: { value: 'New Job' } })
    await fire.change(screen.getByLabelText(/Usual Net Amount/), { target: { value: '7000' } })
    await fire.change(screen.getByLabelText('Pay Day'), { target: { value: '10' } })
    await fire.change(screen.getByLabelText('First Month'), { target: { value: '2027-03' } })
    await fire.click(button('Save Income'))
    await fire.click(toggleOf('Income'))
    expect(summaryOf('Income')).toBe('4 sources · 1 active · 1 upcoming')
    await fire.click(toggleOf('Income'))

    // March 2026 is chosen on Home, but the status uses the demo's date: Salary is still the one active source.
    expect(lineNames('Income')).toEqual(['Salary Active'])
    await filter('Income', /^Upcoming/)
    expect(lineNames('Income')).toEqual(['New Job Upcoming'])
    await filter('Income', /^Ended/)
    expect(lineNames('Income')).not.toContain('New Job Upcoming')
    // Opening it shows its first expected month, even after the months the app plans.
    await filter('Income', /^Upcoming/)
    await fire.click(within(regionOf('Income')).getByRole('button', { name: /^New Job/ }))
    expect(text(regionOf('Income').querySelector('.payment-list'))).toContain('March 2027')
  })

  it('never changes a record by filtering', async () => {
    const { storage } = await openAlex()
    await fire.click(tab('Data'))
    await openBlock('Income')
    await filter('Income', /^Ended/)
    await filter('Income', /^All/)
    await filter('Income', /^Active/)
    await fire.click(tab('Home'))
    expect(text(regionOf('Year Summary'))).toContain('55 998,00 zł')
    expect(storage.getItem(STORAGE_KEY)).toBeNull()
    expect(await storedData()).toBeNull()
  })
})

describe('Data: Bills, Cards & Loans, Accounts, Goals', () => {
  it('lists bills compactly with their usual amount, filtered by status', async () => {
    await openData()
    await openBlock('Bills')
    expect(text(regionOf('Bills'))).toContain('The amount is the bill’s usual amount.')
    await filter('Bills', /^Ended/)
    expect(lineNames('Bills')).toEqual(['Rent (shared flat) Ended', 'Video Streaming Ended', 'Design Software Ended'])
    await filter('Bills', /^Active/)
    const utilities = text(within(regionOf('Bills')).getByRole('button', { name: /^Utilities/ }))
    expect(utilities).toContain('Utilities · Due day 12')
    expect(utilities).toContain('330,00 zł')
    expect(utilities).toContain('usual')
  })

  it('opens a bill on the month already chosen, without changing it', async () => {
    await openAlex()
    await fire.click(tab('Bills'))
    await pickMonth('2026-08')
    await fire.click(tab('Data'))
    await openBlock('Bills')
    await fire.click(within(regionOf('Bills')).getByRole('button', { name: /^Utilities/ }))
    expect(screen.getByRole('heading', { name: 'Utilities' })).toBeTruthy()
    expect(monthSelect().value).toBe('2026-08')
  })

  it('shows each card and loan with its kind and dated Remaining Balance', async () => {
    await openData()
    await openBlock('Cards & Loans')
    const lines = text(regionOf('Cards & Loans').querySelector('.compact-list'))
    expect(lines).toContain('Credit Card · Remaining Balance as of')
    expect(lines).toContain('Loan · Remaining Balance as of')
    expect(within(regionOf('Cards & Loans')).getByRole('button', { name: /^Add$/ })).toBeTruthy()
  })

  it('opens an account to update its balance, edit or delete it, and keeps an unknown balance unknown', async () => {
    await openData()
    await openBlock('Accounts & Balances')
    await fire.click(within(regionOf('Accounts & Balances')).getByRole('button', { name: /Add Account/ }))
    await fire.change(screen.getByLabelText('Account Name'), { target: { value: 'Shoebox' } })
    await fire.click(button('Save Account'))
    const piggy = within(regionOf('Accounts & Balances')).getByRole('button', { name: /^Shoebox/ })
    expect(text(piggy)).toContain('Not entered')
    expect(text(piggy)).not.toContain('0,00')
    await fire.click(piggy)
    expect(piggy.getAttribute('aria-expanded')).toBe('true')
    await fire.click(button('Update Balance: Shoebox'))
    expect((screen.getByLabelText(/^New Balance of Shoebox/) as HTMLInputElement).value).toBe('')
    await fire.change(screen.getByLabelText(/^New Balance of Shoebox/), { target: { value: '45' } })
    await fire.click(button('Save Balance'))
    expect(text(piggy)).toContain('45,00 zł')
    expect(button('Edit: Shoebox')).toBeTruthy()
    await fire.click(button('Delete: Shoebox'))
    expect(within(regionOf('Accounts & Balances')).queryByRole('button', { name: /^Shoebox/ })).toBeNull()
  })

  it('keeps goals compact and says they are part of Savings', async () => {
    await openData()
    await openBlock('Goals & Emergency Fund')
    expect(text(regionOf('Goals & Emergency Fund'))).toContain('They are part of Savings, not extra money.')
    expect(lineNames('Goals & Emergency Fund')).toHaveLength(3)
  })

  it('shows an empty state with a first action in a new space', async () => {
    render(<App getToday={() => '2026-10-21'} storage={memoryStorage()} />)
    await settle()
    await createOwnSpace()
    await fire.click(tab('Data'))
    await fire.click(button('Expand All'))
    expect(button(/Add Your First Income/)).toBeTruthy()
    expect(button(/Add Your First Bill/)).toBeTruthy()
    expect(text(regionOf('Income'))).toContain('No income entered yet.')
  })
})

describe('Links into Data', () => {
  it('Edit Balances opens Data on Accounts & Balances, with the focus on its heading', async () => {
    await openAlex()
    await chooseHomeOption('Expand All')
    await fire.click(within(regionOf('My Money')).getByRole('button', { name: /Edit Balances/ }))
    expect(screen.getByRole('heading', { name: 'Manage Your Data' })).toBeTruthy()
    expect(isOpen('Accounts & Balances')).toBe(true)
    expect(isOpen('Income')).toBe(false)
    expect(document.activeElement).toBe(toggleOf('Accounts & Balances'))
  })

  it('Income on This Month opens the Income block', async () => {
    await openAlex()
    await chooseHomeOption('Expand All')
    await fire.click(within(regionOf('This Month')).getByText('Income').closest('button')!)
    expect(isOpen('Income')).toBe(true)
    expect(document.activeElement).toBe(toggleOf('Income'))
  })

  it('the Data tab keeps the blocks as they were, with the focus on the title', async () => {
    await openAlex()
    await chooseHomeOption('Expand All')
    await fire.click(within(regionOf('My Money')).getByRole('button', { name: /Edit Balances/ }))
    await fire.click(tab('Home'))
    await fire.click(tab('Data'))
    expect(isOpen('Accounts & Balances')).toBe(true)
    expect(document.activeElement).toBe(screen.getByRole('heading', { name: 'Manage Your Data' }))
  })
})

describe('Reset Demo', () => {
  const editSalary = async () => {
    await openBlock('Income')
    await fire.click(within(regionOf('Income')).getByRole('button', { name: /^Salary/ }))
    await fire.click(button('Not Received: Salary, December 2026'))
  }
  const decemberSalary = () => text([...regionOf('Income').querySelectorAll('.payment-list > li')].at(-1)!)

  it('asks first in Data; Cancel changes nothing', async () => {
    await openData()
    await editSalary()
    const zone = regionOf('Demo')
    await fire.click(within(zone).getByRole('button', { name: 'Reset Demo' }))
    const question = screen.getByRole('group', { name: 'Reset demo?' })
    expect(text(question)).toContain('This will remove your changes and restore Alex’s original example.')
    expect(document.activeElement).toBe(within(question).getByRole('button', { name: 'Cancel' }))
    await fire.click(within(question).getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByRole('group', { name: 'Reset demo?' })).toBeNull()
    expect(document.activeElement).toBe(within(zone).getByRole('button', { name: 'Reset Demo' }))
    expect(decemberSalary()).toContain('Received: not recorded yet')
  })

  it('restores the example and closes the Data blocks after confirming', async () => {
    await openData()
    await editSalary()
    await openBlock('Bills')
    await fire.click(within(regionOf('Demo')).getByRole('button', { name: 'Reset Demo' }))
    await confirmReset()
    for (const name of BLOCKS) expect(isOpen(name)).toBe(false)
    expect(text(regionOf('Demo'))).toContain('The demo is back to Alex’s original example.')
    await openBlock('Income')
    await fire.click(within(regionOf('Income')).getByRole('button', { name: /^Salary/ }))
    expect(decemberSalary()).toMatch(/Received: 6500,00 zł/)
  })

  it('never resets on the first tap of the banner or Settings', async () => {
    await openAlex()
    await fire.click(tab('Data'))
    await editSalary()
    const banner = screen.getByRole('note')
    await startDemoReset()
    expect(within(banner).queryByRole('button', { name: 'Exit Demo' })).toBeNull()
    await fire.click(within(banner).getByRole('button', { name: 'Cancel' }))
    expect(within(banner).getByRole('button', { name: 'Exit Demo' })).toBeTruthy()
    // The keyboard is back on the demo menu, which is closed again.
    expect(document.activeElement).toBe(within(banner).getByRole('button', { name: 'Demo options' }))
    expect(within(banner).getByRole('button', { name: 'Demo options' }).getAttribute('aria-expanded')).toBe('false')
    expect(decemberSalary()).toContain('Received: not recorded yet')

    await fire.click(button('Settings'))
    const settingsReset = screen.getAllByRole('button', { name: 'Reset Demo' }).at(-1)!
    await fire.click(settingsReset)
    expect(screen.getByRole('group', { name: 'Reset demo?' })).toBeTruthy()
    await confirmReset()
    expect(screen.getByText('The demo is back to Alex’s original example.')).toBeTruthy()
  })

  it('never touches the own space saved on the device', async () => {
    const storage = memoryStorage()
    storage.setItem(STORAGE_KEY, '{ saved, but unreadable')
    await openAlex(storage)
    await fire.click(tab('Data'))
    await fire.click(within(regionOf('Demo')).getByRole('button', { name: 'Reset Demo' }))
    await confirmReset()
    expect(storage.getItem(STORAGE_KEY)).toBe('{ saved, but unreadable')
    expect(await storedData()).toBeNull()
  })
})
