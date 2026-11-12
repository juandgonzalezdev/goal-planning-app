// @vitest-environment jsdom
import { act, cleanup, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { createDemoHousehold, DEMO_TODAY } from './data/fixtures/demoHousehold'
import { Opening, SKELETON_AFTER_MS } from './features/welcome/Opening'
import { classicHome, memoryStorage } from './test/memoryStorage'
import { fire, settle, freshDatabaseForEachTest } from './test/space'

freshDatabaseForEachTest()

// Help & Guide, the "?" notes and Getting Started (Rumbo de diseño §8), the messages after a confirmed
// save, and the only skeleton (while the space opens). Alex's demo is shown on its own date.
afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks() })
beforeEach(() => { window.history.replaceState(null, '') })

const button = (name: string | RegExp) => screen.getByRole('button', { name })
const text = (element: Element | null) => (element?.textContent ?? '').replace(/\u00a0|\u202f/g, ' ')
const tab = (name: string) => within(screen.getByRole('navigation', { name: 'Main navigation' })).getByRole('button', { name })
const guide = () => screen.queryByRole('region', { name: 'Getting Started' })
const steps = () => [...guide()!.querySelectorAll('.guide-steps li')].map(item => item.className.replace(/^is-/, '').replace(' is-current', '*'))

async function openAlex(storage: Storage = memoryStorage()) {
  render(<App getToday={() => '2026-10-25'} storage={classicHome(storage)} />)
  await settle()
  await fire.click(button('Explore the App'))
  return storage
}

/** Welcome → Create Account → Welcome Setup → Home, as one person. */
async function createOwnSpace(storage: Storage = memoryStorage()) {
  render(<App getToday={() => '2026-10-25'} storage={classicHome(storage)} />)
  await settle()
  await fire.click(button(/Create Account/))
  await fire.click(button(/Continue Without an Account/))
  await fire.change(screen.getByLabelText('Display Name'), { target: { value: 'Robin' } })
  await fire.click(button(/Continue/))
  await fire.click(button(/Continue/))
  await fire.click(button(/Continue/))
  await fire.click(button('Create My Space'))
  return storage
}

describe('Help & Guide', () => {
  it('hides numeric examples in Home help when This Month amounts are hidden', async () => {
    await openAlex()
    await fire.click(button('About Result'))
    const result = button('About Result')
    const note = () => document.getElementById(result.getAttribute('aria-controls')!)!
    expect(text(note())).toContain('7200,00')
    await fire.click(button('Hide amounts in This Month'))
    expect(text(note())).not.toMatch(/7200|5097|2102/)
    expect(text(note())).toContain('Income received minus what you spent')
    await fire.click(button('About Expected and Received'))
    const expected = button('About Expected and Received')
    expect(text(document.getElementById(expected.getAttribute('aria-controls')!))).not.toContain('4500')
    await fire.click(button('About Planned Bills and Spent'))
    const planned = button('About Planned Bills and Spent')
    expect(text(document.getElementById(planned.getAttribute('aria-controls')!))).not.toContain('6401')
  })
  it('opens from Settings with the guide in chapters, and says the demo is invented', async () => {
    await openAlex()
    await fire.click(button('Settings'))
    await fire.click(button('Open Help & Guide'))
    expect(screen.getByRole('heading', { level: 1, name: 'Help & Guide' })).toBeTruthy()
    expect(text(screen.getByRole('main'))).toContain('In the demo, Alex’s information is invented.')
    const chapter = button('Your Monthly Check-in')
    expect(chapter.getAttribute('aria-expanded')).toBe('false')
    await fire.click(chapter)
    expect(text(document.getElementById('help-check-in'))).toContain('It is a guide, not a reminder: the app doesn’t send notifications.')
    await fire.click(button('Back'))
    expect(screen.getByRole('heading', { level: 1, name: 'Settings' })).toBeTruthy()
  })

  it('a "?" note explains a figure and opens its chapter of the guide', async () => {
    await openAlex()
    const about = button('About Result')
    expect(about.getAttribute('aria-expanded')).toBe('false')
    await fire.click(about)
    const note = document.getElementById(about.getAttribute('aria-controls')!)!
    expect(text(note)).toContain('Income received minus what you spent. It is not money saved')
    expect(text(note)).toContain('In the demo, December: 7200,00 zł received − 5097,35 zł spent = 2102,65 zł.')
    await fire.click(within(note).getByRole('button', { name: 'Read more in the guide' }))
    const chapter = button('Reading Home')
    expect(chapter.getAttribute('aria-expanded')).toBe('true')
    expect(document.activeElement).toBe(chapter)
  })
})

describe('Money contextual help', () => {
  it.each([
    ['About Income', 'Income'],
    ['About Balances', 'Accounts, Cash and Savings'],
    ['About Balances and payments', 'Cards and Loans'],
    ['About Your data', 'Your Space and the Demo'],
  ])('opens the matching guide chapter from %s', async (label, title) => {
    await openAlex()
    await fire.click(tab('Money'))
    await fire.click(button('Expand All'))
    const help = button(label)
    expect(help.getAttribute('aria-expanded')).toBe('false')
    await fire.click(help)
    const note = document.getElementById(help.getAttribute('aria-controls')!)!
    expect(note.hidden).toBe(false)
    await fire.click(within(note).getByRole('button', { name: 'Read more in the guide' }))
    const chapter = button(title)
    expect(chapter.getAttribute('aria-expanded')).toBe('true')
    expect(document.activeElement).toBe(chapter)
    await fire.click(button('Back'))
    expect(screen.getByRole('heading', { level: 1, name: 'Money' })).toBeTruthy()
  })

  it('shows local storage information and its guide chapter in the own space', async () => {
    await createOwnSpace()
    await fire.click(tab('Money'))
    const help = button('About Your data')
    await fire.click(help)
    const note = document.getElementById(help.getAttribute('aria-controls')!)!
    expect(text(note)).toContain('Your data is saved on this device only. No bank is connected.')
    expect(text(note)).not.toContain('Alex')
    await fire.click(within(note).getByRole('button', { name: 'Read more in the guide' }))
    expect(button('Where Your Information Is Kept').getAttribute('aria-expanded')).toBe('true')
  })
})

describe('Getting Started', () => {
  it('follows the order, skips, comes back on this device for this space, and is hidden or shown again', async () => {
    const storage = await createOwnSpace()
    expect(steps()).toEqual(['to-do*', 'to-do', 'to-do', 'to-do', 'to-do', 'to-do'])
    expect(text(guide())).toContain('Where is your money now?')
    await fire.click(within(guide()!).getByRole('button', { name: 'Skip for now' }))
    expect(text(guide())).toContain('What money comes in?')
    expect(document.activeElement?.textContent).toBe('What money comes in?')
    await fire.click(within(guide()!).getByRole('button', { name: 'Skip for now' }))
    // Debts come before bills, and "I Have None" says there are none: complete, not skipped (GS-1).
    expect(text(guide())).toContain('Do you owe anything?')
    await fire.click(within(guide()!).getByRole('button', { name: 'I Have None' }))
    expect(text(guide())).toContain('What do you pay regularly?')
    expect(document.activeElement?.textContent).toBe('What do you pay regularly?')
    expect(steps()).toEqual(['skipped', 'skipped', 'none', 'to-do*', 'to-do', 'to-do'])
    expect(text(guide()?.querySelector('.guide-steps') ?? null)).toContain('Cards and loans: none')
    // The progress is kept on this device for this space (v2), never in the space's data.
    const saved = JSON.parse(storage.getItem('goal-planning-app.getting-started') ?? 'null')
    expect(saved.progress).toEqual({ version: 2, hidden: false, skipped: ['accounts', 'income'], none: ['debts'], finished: false, last: null })
    cleanup()
    render(<App getToday={() => '2026-10-25'} storage={classicHome(storage)} />)
    await settle()
    expect(text(guide())).toContain('What do you pay regularly?')
    await fire.click(within(guide()!).getByRole('button', { name: 'Hide this guide' }))
    expect(guide()).toBeNull()
    await fire.click(button('Settings'))
    await fire.click(button('Open Help & Guide'))
    await fire.click(button('Show Getting Started on Home'))
    expect(text(screen.getByRole('main'))).toContain('Getting Started is on Home again.')
    await fire.click(button('Back'))
    await fire.click(button('Back'))
    // Skipped steps come back; the "none" answer stays.
    expect(text(guide())).toContain('Where is your money now?')
    expect(steps()).toEqual(['to-do*', 'to-do', 'none', 'to-do', 'to-do', 'to-do'])
  })

  it('reads progress saved before v1.0 for this space, in the new order, and writes it only after a change', async () => {
    const storage = await createOwnSpace()
    // Nothing is saved until the first change: a Skip saves this space's id with the progress.
    expect(storage.getItem('goal-planning-app.getting-started')).toBeNull()
    await fire.click(within(guide()!).getByRole('button', { name: 'Skip for now' }))
    const spaceId = JSON.parse(storage.getItem('goal-planning-app.getting-started')!).spaceId
    // As the old guide saved it: Income and Accounts skipped, Debts answered with the old "I Have None" (saved as skipped).
    const old = JSON.stringify({ spaceId, progress: { hidden: false, skipped: ['income', 'accounts', 'debts'], finished: false } })
    storage.setItem('goal-planning-app.getting-started', old)
    cleanup()
    render(<App getToday={() => '2026-10-25'} storage={classicHome(storage)} />)
    await settle()
    expect(steps()).toEqual(['skipped', 'skipped', 'skipped', 'to-do*', 'to-do', 'to-do'])
    // Reading it wrote nothing.
    expect(storage.getItem('goal-planning-app.getting-started')).toBe(old)
    // Another space's progress is not this space's.
    storage.setItem('goal-planning-app.getting-started', JSON.stringify({ spaceId: 'another-space', progress: { hidden: true, skipped: [], finished: true } }))
    cleanup()
    render(<App getToday={() => '2026-10-25'} storage={classicHome(storage)} />)
    await settle()
    expect(steps()).toEqual(['to-do*', 'to-do', 'to-do', 'to-do', 'to-do', 'to-do'])
  })

  it('each step opens what already exists, and a step is done once the space has it', async () => {
    await createOwnSpace()
    await fire.click(within(guide()!).getByRole('button', { name: 'Add Account' }))
    expect(document.activeElement?.textContent).toContain('Add Account')
    await fire.click(tab('Home'))
    await fire.click(within(guide()!).getByRole('button', { name: 'Skip for now' }))
    await fire.click(within(guide()!).getByRole('button', { name: 'Add Income' }))
    expect(document.activeElement?.id).toBe('income-name')
    await fire.change(screen.getByLabelText('Name'), { target: { value: 'Salary' } })
    await fire.change(screen.getByLabelText(/^Usual Net Amount/), { target: { value: '4000' } })
    await fire.change(screen.getByLabelText(/^Pay Day/), { target: { value: '10' } })
    await fire.click(button('Save Income'))
    await fire.click(tab('Home'))
    expect(steps().slice(0, 2)).toEqual(['skipped', 'done'])
    expect(text(guide())).toContain('Do you owe anything?')
  })

  it('in the demo it starts hidden, lives in memory only, and Done ends it', async () => {
    const storage = await openAlex()
    expect(guide()).toBeNull()
    await fire.click(button('Settings'))
    await fire.click(button('Open Help & Guide'))
    await fire.click(button('Show Getting Started on Home'))
    await fire.click(button('Back'))
    await fire.click(button('Back'))
    // Alex's space has everything the first five steps ask for.
    expect(steps()).toEqual(['done', 'done', 'done', 'done', 'done', 'to-do*'])
    expect(text(guide())).toContain('In the demo, Alex’s information is invented.')
    await fire.click(within(guide()!).getByRole('button', { name: 'Done' }))
    expect(guide()).toBeNull()
    expect(Object.keys({ ...storage }).concat([...Array(storage.length)].map((_, index) => storage.key(index) ?? '')).some(key => key.includes('getting-started'))).toBe(false)
  })
})

describe('After a confirmed save', () => {
  it('says what a Contribution and a Withdrawal did, and shows Goal reached once', async () => {
    render(<App getToday={() => '2026-10-21'} storage={classicHome()} createDemo={() => ({ data: createDemoHousehold(), today: DEMO_TODAY })} />)
    await settle()
    await fire.click(button('Explore the App'))
    await fire.click(tab('Goals'))
    await fire.click(button(/^Christmas Gift/))
    const move = async (kind: 'Add' | 'Withdraw', amount: string) => {
      await fire.click(within(screen.getByRole('group', { name: 'Type of change' })).getByRole('button', { name: kind }))
      await fire.change(screen.getByLabelText(/^Amount/), { target: { value: amount } })
      await fire.click(button(kind === 'Add' ? 'Save Contribution' : 'Save Withdrawal'))
    }
    const message = () => text(screen.getAllByRole('status').find(status => status.textContent?.includes('zł'))!)
    await move('Add', '500')
    expect(message()).toMatch(/^Added 500,00 zł to Christmas Gift \(.+\)\. Demo only: not saved\.$/)
    expect(text(screen.getByRole('region', { name: 'Progress' }))).toContain('Goal reached')
    expect(document.querySelector('.goal-reached-badge')).not.toBeNull()
    await move('Withdraw', '100')
    expect(message()).toMatch(/^Took out 100,00 zł \(.+\)\. Christmas Gift now has 400,00 zł\. Demo only: not saved\.$/)
    expect(document.querySelector('.goal-reached-badge')).toBeNull()
  })
})

describe('Opening your space', () => {
  it('shows a skeleton only when the wait is real, and Try Again when it is long', () => {
    vi.useFakeTimers()
    render(<Opening onRetry={() => {}} />)
    expect(document.querySelector('.skeleton')).toBeNull()
    act(() => { vi.advanceTimersByTime(SKELETON_AFTER_MS) })
    expect(document.querySelector('.skeleton')!.getAttribute('aria-hidden')).toBe('true')
    act(() => { vi.advanceTimersByTime(5000) })
    expect(document.querySelector('.skeleton')).toBeNull()
    expect(screen.getByRole('button', { name: 'Try Again' })).toBeTruthy()
  })
})
