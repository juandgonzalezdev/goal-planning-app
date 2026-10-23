// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import App from './App'
import { STORAGE_KEY } from './data/localStore'
import { memoryStorage } from './test/memoryStorage'

// Invented example values and a fixed date. The demo has its own date (23 Oct 2026).
const TODAY = '2026-10-21'

afterEach(() => { cleanup(); document.documentElement.removeAttribute('data-theme') })

const button = (name: string | RegExp) => screen.getByRole('button', { name })
const heading = (name: string | RegExp) => screen.getByRole('heading', { name })
const field = (label: string | RegExp) => screen.getByLabelText(label) as HTMLInputElement
const type = (label: string | RegExp, value: string) => fireEvent.change(field(label), { target: { value } })
const section = (name: 'goals' | 'cards') => document.querySelector<HTMLElement>(`[data-screen="${name}"]`)
const tab = (name: string) => within(screen.getByRole('navigation', { name: 'Main navigation' })).getByRole('button', { name })
// Intl writes amounts with no-break spaces; compare them as plain spaces.
const text = (element: Element | null) => (element?.textContent ?? '').replace(/\u00a0|\u202f/g, ' ')
const stat = (label: string) => text(screen.getByText(label).parentElement)

function start(storage: Storage = memoryStorage()) {
  return { storage, ...render(<App getToday={() => TODAY} storage={storage} />) }
}

/** Welcome → Create Account → Welcome Setup → Home, as one person. */
function createIndividualSpace(storage: Storage = memoryStorage(), name = 'Robin') {
  const result = start(storage)
  fireEvent.click(button(/Create Account/))
  fireEvent.click(button(/Continue Without an Account/))
  type('Display Name', name)
  fireEvent.click(button(/Continue/))
  fireEvent.click(button(/Continue/))
  fireEvent.click(button(/Continue/))
  fireEvent.click(button('Create My Space'))
  return result
}

function openDemo() {
  const result = start()
  fireEvent.click(button('Explore the App'))
  return result
}

const saved = (storage: Storage) => JSON.parse(storage.getItem(STORAGE_KEY) ?? 'null')

/** Waits for the browser to finish a history move and the app to show it. */
async function browserBack() {
  await act(async () => {
    window.history.back()
    await new Promise(resolve => setTimeout(resolve, 20))
  })
}

describe('Welcome', () => {
  it('opens with the welcome message and the three choices', () => {
    start()
    expect(heading('Your goals, your way.')).toBeTruthy()
    expect(button(/Create Account/)).toBeTruthy()
    expect(button('Log In')).toBeTruthy()
    expect(button('Explore the App')).toBeTruthy()
    expect(screen.getByText(/Nothing is sent anywhere/)).toBeTruthy()
  })

  it('shows no tabs, planner or calculator before a space is open', () => {
    start()
    expect(screen.queryByRole('navigation', { name: 'Main navigation' })).toBeNull()
    expect(section('goals')).toBeNull()
    expect(section('cards')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Settings' })).toBeNull()
  })
})

describe('Create Account and Log In (Preview)', () => {
  it.each([[/Create Account/, 'Create Account'], ['Log In', 'Log In']])('shows %s as a preview where nothing can be typed', (open, title) => {
    start()
    fireEvent.click(button(open))
    expect(heading(new RegExp(`^${title}`)).textContent).toContain('Preview')
    expect(field('Email').disabled).toBe(true)
    expect(field('Password').disabled).toBe(true)
    expect(screen.getByText(/nothing you see here is sent or saved/)).toBeTruthy()
    fireEvent.click(button(/Continue Without an Account/))
    expect(heading('Your Profile')).toBeTruthy()
  })

  it('never stores a password or email', () => {
    const { storage } = createIndividualSpace()
    const stored = storage.getItem(STORAGE_KEY) ?? ''
    expect(stored).not.toMatch(/password|email/i)
  })
})

describe('Welcome Setup', () => {
  it('needs a name before continuing', () => {
    start()
    fireEvent.click(button(/Create Account/))
    fireEvent.click(button(/Continue Without an Account/))
    expect(screen.getByText('Welcome Setup · Step 1 of 4')).toBeTruthy()
    fireEvent.click(button(/Continue/))
    expect(screen.getByText('Enter your name.')).toBeTruthy()
    expect(heading('Your Profile')).toBeTruthy()
  })

  it('offers Individual and Duo, with Group coming soon', () => {
    start()
    fireEvent.click(button(/Create Account/))
    fireEvent.click(button(/Continue Without an Account/))
    type('Display Name', 'Robin')
    fireEvent.click(button(/Continue/))
    const individual = screen.getByRole('radio', { name: /Individual/ }) as HTMLInputElement
    const duo = screen.getByRole('radio', { name: /Duo/ }) as HTMLInputElement
    const group = screen.getByRole('radio', { name: /Group/ }) as HTMLInputElement
    expect(individual.checked).toBe(true)
    expect(duo.disabled).toBe(false)
    expect(group.disabled).toBe(true)
    expect(group.closest('label')!.textContent).toContain('Coming soon')
  })

  it('creates a Duo space after the second name, saying there is no privacy between members yet', () => {
    const { storage } = start()
    fireEvent.click(button(/Create Account/))
    fireEvent.click(button(/Continue Without an Account/))
    type('Display Name', 'Robin')
    fireEvent.click(button(/Continue/))
    fireEvent.click(screen.getByRole('radio', { name: /Duo/ }))
    expect(screen.getByText(/No private information between members yet/)).toBeTruthy()
    fireEvent.click(button(/Continue/))
    expect(screen.getByText('Enter the second person\'s name.')).toBeTruthy()
    type("Second Person's Name", 'Sasha')
    fireEvent.click(button(/Continue/))
    fireEvent.change(field('Currency'), { target: { value: 'EUR' } })
    fireEvent.click(button(/Continue/))
    expect(heading('Privacy & Terms')).toBeTruthy()
    fireEvent.click(button('Create My Space'))

    expect(screen.getByText('Robin & Sasha · Duo')).toBeTruthy()
    expect(saved(storage).space).toMatchObject({ mode: 'duo', currency: 'EUR', members: [{ name: 'Robin' }, { name: 'Sasha' }] })
    expect(stat('Household Income')).toContain('—')
  })

  it('creates an empty Individual space: no income, bills, loans, accounts or goals', () => {
    const { storage } = createIndividualSpace()
    expect(screen.getByText('Robin · Individual')).toBeTruthy()
    const data = saved(storage)
    for (const list of ['income', 'bills', 'billMonths', 'debts', 'moneyAccounts', 'balances', 'goals', 'goalMovements']) expect(data[list]).toEqual([])
    expect(stat('Income')).toContain('—')
    expect(stat('Total Debt')).toContain('0,00 zł')
  })

  it('keeps what was typed when going back to Welcome and returning', async () => {
    start()
    fireEvent.click(button(/Create Account/))
    fireEvent.click(button(/Continue Without an Account/))
    type('Display Name', 'Robin')
    fireEvent.click(button('Back'))
    await waitFor(() => expect(heading(/^Create Account/)).toBeTruthy())
    fireEvent.click(button(/Continue Without an Account/))
    expect(field('Display Name').value).toBe('Robin')
  })
})

describe('Returning to the app', () => {
  it('opens straight at Home with the saved space', () => {
    const { storage } = createIndividualSpace()
    cleanup()
    start(storage)
    expect(screen.queryByRole('heading', { name: 'Your goals, your way.' })).toBeNull()
    expect(screen.getByText('Robin · Individual')).toBeTruthy()
    expect(tab('Home').getAttribute('aria-current')).toBe('page')
  })

  it('never goes back into setup after the space was created', async () => {
    createIndividualSpace()
    await browserBack()
    expect(screen.queryByRole('heading', { name: /Privacy & Terms|Your Profile/ })).toBeNull()
    expect(screen.getByText('Robin · Individual')).toBeTruthy()
  })

  it('says so when saved information cannot be opened, and blocks creating a new space until it is erased', () => {
    const storage = memoryStorage()
    storage.setItem(STORAGE_KEY, '{ broken')
    start(storage)
    expect(screen.getByRole('alert').textContent).toContain('could not be opened')
    expect((button(/Create Account/) as HTMLButtonElement).disabled).toBe(true)
    expect(storage.getItem(STORAGE_KEY)).toBe('{ broken')
    fireEvent.click(button('Erase Saved Information'))
    expect((button(/Create Account/) as HTMLButtonElement).disabled).toBe(false)
    expect(storage.getItem(STORAGE_KEY)).toBeNull()
  })

  it('warns when the browser does not save', () => {
    createIndividualSpace(memoryStorage({ failWrites: true }))
    expect(screen.getByRole('alert').textContent).toContain('did not save')
  })
})

describe('Demo', () => {
  it('opens with invented data, clearly marked', () => {
    openDemo()
    expect(screen.getByRole('note').textContent).toContain('All information is invented')
    expect(screen.getByText('Demo · Invented data')).toBeTruthy()
    expect(stat('Household Income')).toContain('11 700,35 zł')
    expect(stat('Monthly Commitments')).toContain('5571,43 zł')
    expect(stat('Monthly Left to Pay')).toContain('0,00 zł')
    expect(stat('Total Debt')).toContain('46 600,40 zł')
  })

  it('never saves, and starts fresh after Exit Demo', async () => {
    const { storage } = openDemo()
    fireEvent.click(tab('Bills'))
    fireEvent.click(button('November 2026'))
    fireEvent.click(button(/Thursday 5 November/))
    fireEvent.click(button('Furniture Loan paid in November 2026'))
    expect(stat('Left to Pay')).toContain('5300,98 zł')
    expect(storage.length).toBe(0)

    fireEvent.click(button('Exit Demo'))
    expect(heading('Your goals, your way.')).toBeTruthy()
    fireEvent.click(button('Explore the App'))
    fireEvent.click(tab('Bills'))
    fireEvent.click(button('November 2026'))
    expect(stat('Left to Pay')).toContain('5450,98 zł')
  })

  it('does not allow importing into the demo', () => {
    openDemo()
    fireEvent.click(tab('Data'))
    expect(screen.getByText(/Exit the demo to import your own data/)).toBeTruthy()
    expect(screen.queryByLabelText('Choose a JSON file')).toBeNull()
  })
})

describe('Tab bar', () => {
  it('has the five approved tabs in order, and marks the current one', () => {
    openDemo()
    const nav = screen.getByRole('navigation', { name: 'Main navigation' })
    expect(within(nav).getAllByRole('button').map(b => b.textContent)).toEqual(['Home', 'Bills', 'Cards', 'History', 'Data'])
    expect(tab('Home').getAttribute('aria-current')).toBe('page')
    fireEvent.click(tab('History'))
    expect(heading('Financial History')).toBeTruthy()
    expect(tab('History').getAttribute('aria-current')).toBe('page')
    expect(tab('Home').getAttribute('aria-current')).toBeNull()
  })

  it('is hidden in Settings and in the Goal Planner', async () => {
    openDemo()
    fireEvent.click(button('Settings'))
    expect(heading('Settings')).toBeTruthy()
    expect(screen.queryByRole('navigation', { name: 'Main navigation' })).toBeNull()
    fireEvent.click(button('Back'))
    await waitFor(() => expect(tab('Home')).toBeTruthy())
    fireEvent.click(button(/Goal Planner/))
    expect(screen.queryByRole('navigation', { name: 'Main navigation' })).toBeNull()
  })
})

describe('Monthly Bills', () => {
  it('shows October totals with every date closed', () => {
    openDemo()
    fireEvent.click(tab('Bills'))
    expect(heading('Monthly Bills')).toBeTruthy()
    expect(stat('Monthly Total')).toContain('5571,43 zł')
    expect(stat('Left to Pay')).toContain('0,00 zł')
    const dates = screen.getAllByRole('button', { expanded: false })
    expect(dates).toHaveLength(8)
    expect(screen.queryByRole('button', { expanded: true })).toBeNull()
    expect(text(dates[1])).toContain('Wednesday')
    expect(text(dates[1])).toContain('2 payments due')
    expect(text(dates[1])).toContain('330,00 zł')
  })

  it('opens one date at a time', () => {
    openDemo()
    fireEvent.click(tab('Bills'))
    fireEvent.click(button(/Monday 5 October/))
    expect(screen.getByText('Furniture Loan')).toBeTruthy()
    fireEvent.click(button(/Wednesday 7 October/))
    expect(screen.queryByText('Furniture Loan')).toBeNull()
    expect(screen.getByText('Bank Plan')).toBeTruthy()
    expect(screen.getByText('Language Course')).toBeTruthy()
    expect(screen.getAllByRole('button', { expanded: true })).toHaveLength(1)
    fireEvent.click(button(/Wednesday 7 October/))
    expect(screen.queryByRole('button', { expanded: true })).toBeNull()
  })

  it('closes the open date when the month changes', () => {
    openDemo()
    fireEvent.click(tab('Bills'))
    fireEvent.click(button(/Monday 5 October/))
    fireEvent.click(button('November 2026'))
    expect(screen.queryByRole('button', { expanded: true })).toBeNull()
    expect(button('November 2026').getAttribute('aria-pressed')).toBe('true')
  })

  it('shows an unknown amount as needed, never as a number', () => {
    openDemo()
    fireEvent.click(tab('Bills'))
    fireEvent.click(button('November 2026'))
    expect(screen.getByText('1 bill amount needs to be entered.')).toBeTruthy()
    expect(stat('Monthly Total')).toContain('5450,98 zł')
    expect(stat('Left to Pay')).toContain('+ unknown amount')
    fireEvent.click(button(/Sunday 22 November/))
    const phone = screen.getByText('Phone & Internet').closest('.bill-item')!
    expect(phone.textContent).toContain('Amount needed')
  })

  it('marks one month paid without changing another month', () => {
    openDemo()
    fireEvent.click(tab('Bills'))
    fireEvent.click(button('November 2026'))
    fireEvent.click(button(/Saturday 10 October|Tuesday 10 November/))
    const rent = button('Rent paid in November 2026')
    expect(rent.getAttribute('aria-pressed')).toBe('false')
    fireEvent.click(rent)
    expect(button('Rent paid in November 2026').getAttribute('aria-pressed')).toBe('true')
    expect(stat('Left to Pay')).toContain('3050,98 zł')

    fireEvent.click(button('October 2026'))
    fireEvent.click(button(/Saturday 10 October/))
    expect(button('Rent paid in October 2026').getAttribute('aria-pressed')).toBe('true')
    expect(stat('Left to Pay')).toContain('0,00 zł')
  })

  it('records an amount for one month and updates the totals and Home', () => {
    openDemo()
    fireEvent.click(tab('Bills'))
    fireEvent.click(button('November 2026'))
    fireEvent.click(button(/Sunday 22 November/))
    fireEvent.click(button('Change Amount for November 2026'))
    type('Amount for November 2026 (PLN)', 'abc')
    fireEvent.click(button('Save'))
    expect(screen.getByText('Enter an amount such as 120.45.')).toBeTruthy()
    type('Amount for November 2026 (PLN)', '130,55')
    fireEvent.click(button('Save'))
    expect(stat('Monthly Total')).toContain('5581,53 zł')
    expect(screen.queryByText('1 bill amount needs to be entered.')).toBeNull()

    fireEvent.click(tab('Home'))
    fireEvent.click(button('November 2026'))
    expect(stat('Monthly Commitments')).toContain('5581,53 zł')
    expect(stat('Total Debt')).toContain('46 600,40 zł')
  })

  it('shows an empty state in a new space', () => {
    createIndividualSpace()
    fireEvent.click(tab('Bills'))
    expect(screen.getByText('No bills for October 2026.')).toBeTruthy()
  })
})

describe('Keeping information between screens', () => {
  it('keeps loans and calculator results in Cards after visiting other tabs', async () => {
    createIndividualSpace()
    fireEvent.click(tab('Cards'))
    expect(heading('Cards & Loans')).toBeTruthy()
    type('Monthly Income (PLN)', '5000')
    fireEvent.click(button('+ Add'))
    type('Name (optional)', 'Test loan')
    type('Remaining Balance (PLN)', '12000')
    type('Yearly Interest (%)', '12')
    type('Monthly Payment (PLN)', '1000')
    type('Extra Each Month (PLN)', '200')
    expect(screen.getByText('Months Saved').nextElementSibling!.textContent).toBe('2')

    fireEvent.click(tab('Bills'))
    fireEvent.click(tab('Home'))
    fireEvent.click(button(/Goal Planner/))
    await browserBack()
    fireEvent.click(tab('Cards'))

    expect(field('Monthly Income (PLN)').value).toBe('5000')
    expect(field('Name (optional)').value).toBe('Test loan')
    expect(field('Extra Each Month (PLN)').value).toBe('200')
    expect(screen.getByText('Months Saved').nextElementSibling!.textContent).toBe('2')
  })

  it('keeps typed goal values and the evaluated result after visiting other tabs', async () => {
    createIndividualSpace()
    fireEvent.click(button(/Goal Planner/))
    type('Goal name', 'Holiday fund')
    type('Target amount (PLN)', '12000')
    fireEvent.click(button('Evaluate goal'))
    const result = screen.getByRole('heading', { level: 2, name: /^(Plan|Goal|Monthly)/ }).textContent

    fireEvent.click(button('Home'))
    await waitFor(() => expect(tab('Home')).toBeTruthy())
    fireEvent.click(tab('Cards'))
    fireEvent.click(tab('Home'))
    fireEvent.click(button(/Goal Planner/))

    expect(field('Goal name').value).toBe('Holiday fund')
    expect(field('Target amount (PLN)').value).toBe('12000')
    expect(screen.getByRole('heading', { level: 2, name: /^(Plan|Goal|Monthly)/ }).textContent).toBe(result)
  })

  it('never creates a goal by itself, and shows a planned goal only after Confirm', async () => {
    createIndividualSpace()
    fireEvent.click(button(/Goal Planner/))
    type('Goal name', 'Holiday fund')
    fireEvent.click(button('Evaluate goal'))
    fireEvent.click(button('Review goal'))

    // Leaving at Review creates nothing.
    fireEvent.click(button('Home'))
    await waitFor(() => expect(tab('Home')).toBeTruthy())
    expect(screen.queryByRole('region', { name: 'Holiday fund' })).toBeNull()

    fireEvent.click(button(/Goal Planner/))
    fireEvent.click(button('Confirm goal'))
    fireEvent.click(button('Home'))
    await waitFor(() => expect(tab('Home')).toBeTruthy())
    const goal = screen.getByRole('region', { name: 'Holiday fund' })
    expect(within(goal).getByRole('progressbar')).toBeTruthy()
    expect(within(goal).getByRole('button', { name: /View goal/ })).toBeTruthy()
  })

  it('shows the Assistant as coming soon, with nothing to press', () => {
    createIndividualSpace()
    expect(screen.getByText('Assistant').parentElement!.textContent).toContain('Coming soon')
    expect(screen.queryByRole('button', { name: /Assistant/ })).toBeNull()
  })
})

describe('Hidden sections', () => {
  it('are hidden from the keyboard and screen readers', () => {
    createIndividualSpace()
    fireEvent.click(tab('Cards'))
    fireEvent.click(button('+ Add'))
    // The goal planner is on the page but hidden: none of its controls are exposed.
    expect(section('goals')!.hidden).toBe(true)
    expect(screen.queryByRole('button', { name: 'Evaluate goal' })).toBeNull()
    expect(screen.queryByRole('textbox', { name: 'Goal name' })).toBeNull()
  })
})

describe('Back navigation', () => {
  it('goes back one screen at a time with the browser back button', async () => {
    openDemo()
    fireEvent.click(tab('Bills'))
    fireEvent.click(tab('Cards'))
    await browserBack()
    expect(heading('Monthly Bills')).toBeTruthy()
    await browserBack()
    expect(tab('Home').getAttribute('aria-current')).toBe('page')
  })

  it('goes back from Create Account to Welcome with the Back link', async () => {
    start()
    fireEvent.click(button(/Create Account/))
    fireEvent.click(button('Back'))
    await waitFor(() => expect(heading('Your goals, your way.')).toBeTruthy())
  })

  it('slides the matching way for forward and back moves', async () => {
    const { container } = start()
    const shell = container.querySelector('.shell')!
    fireEvent.click(button('Log In'))
    expect(shell.getAttribute('data-direction')).toBe('forward')
    await browserBack()
    expect(shell.getAttribute('data-direction')).toBe('back')
  })
})

describe('Focus', () => {
  it('moves to the new screen title after each move', async () => {
    start()
    fireEvent.click(button(/Create Account/))
    expect(document.activeElement).toBe(heading(/^Create Account/))
    fireEvent.click(button(/Continue Without an Account/))
    expect(document.activeElement).toBe(heading('Your Profile'))
    fireEvent.click(button('Back'))
    await waitFor(() => expect(document.activeElement).toBe(heading(/^Create Account/)))
  })

  it('moves to each tab title', () => {
    openDemo()
    fireEvent.click(tab('Bills'))
    expect(document.activeElement).toBe(heading('Monthly Bills'))
    fireEvent.click(tab('Data'))
    expect(document.activeElement).toBe(heading('Manage Your Data'))
  })
})

describe('Settings', () => {
  it('changes the appearance and keeps it', () => {
    const { storage } = createIndividualSpace()
    expect(document.documentElement.dataset.theme).toBe('system')
    fireEvent.click(button('Settings'))
    fireEvent.change(field('Appearance'), { target: { value: 'dark' } })
    expect(document.documentElement.dataset.theme).toBe('dark')
    expect(saved(storage).preferences.theme).toBe('dark')
  })

  it('erases everything only after confirming', () => {
    const { storage } = createIndividualSpace()
    fireEvent.click(button('Settings'))
    fireEvent.click(button('Erase All Data on This Device'))
    fireEvent.click(button('Cancel'))
    expect(storage.getItem(STORAGE_KEY)).not.toBeNull()
    fireEvent.click(button('Erase All Data on This Device'))
    fireEvent.click(button('Erase Everything'))
    expect(storage.getItem(STORAGE_KEY)).toBeNull()
    expect(heading('Your goals, your way.')).toBeTruthy()
  })

  it('offers Exit Demo instead of erasing in the demo', () => {
    openDemo()
    fireEvent.click(button('Settings'))
    expect(screen.queryByRole('button', { name: 'Erase All Data on This Device' })).toBeNull()
    fireEvent.click(screen.getAllByRole('button', { name: 'Exit Demo' }).at(-1)!)
    expect(heading('Your goals, your way.')).toBeTruthy()
  })
})

describe('Data', () => {
  const upload = async (content: string) => {
    const input = field('Choose a JSON file')
    await act(async () => {
      fireEvent.change(input, { target: { files: [new File([content], 'data.json', { type: 'application/json' })] } })
      await new Promise(resolve => setTimeout(resolve, 20))
    })
  }

  it('replaces the own space with a checked file only after confirming', async () => {
    const { storage } = createIndividualSpace()
    const other = { ...saved(storage), space: { ...saved(storage).space, name: 'Imported', members: [{ id: 'member-1', name: 'Imported', color: '#3B82F6' }] } }
    fireEvent.click(tab('Data'))
    await upload(JSON.stringify(other))
    expect(screen.getByRole('alert').textContent).toContain('Replace everything in this space with “Imported”')
    expect(saved(storage).space.name).toBe('Robin')
    fireEvent.click(button('Replace'))
    expect(saved(storage).space.name).toBe('Imported')
    expect(screen.getByText('Imported · Individual')).toBeTruthy()
  })

  it('refuses a broken file and changes nothing', async () => {
    const { storage } = createIndividualSpace()
    fireEvent.click(tab('Data'))
    await upload('{ "schemaVersion": 1 }')
    expect(screen.getByRole('alert').textContent).toContain('This file cannot be used. Nothing was changed.')
    expect(saved(storage).space.name).toBe('Robin')
  })
})
