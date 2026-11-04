// @vitest-environment jsdom
import { useState } from 'react'
import { cleanup, fireEvent, render, screen, within, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { GoalRings } from './features/home/GoalRings'
import { createAlexDemo } from './data/fixtures/demoAlex'
import { memoryStorage } from './test/memoryStorage'
import { fire, freshDatabaseForEachTest, settle } from './test/space'
import { VisibilityContext, type HomeArea } from './ui/amountVisibility'
import { savingsSummary } from './domain/finance/savings'
import { goalSaved } from './domain/finance/goals'
import { formatAmount } from './ui/format'
import type { FinanceData } from './domain/finance/types'
import type { SaveOutcome } from './ui/saveOutcome'

freshDatabaseForEachTest()
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals() })
const button = (name: string | RegExp) => screen.getByRole('button', { name })
const region = () => screen.getByRole('region', { name: 'Your money and goals' })
const inRings = () => within(region())
const money = (value: number) => formatAmount(value, 'PLN')

function fixture(): FinanceData {
  const data = createAlexDemo()
  const account = data.moneyAccounts.find(a => a.kind === 'savings')!
  return { ...data, goals: [
    { ...data.goals[0], id: 'books', kind: 'goal', name: 'Books for my child', target: 25000, openingBalance: 10000, createdOn: '2026-09-01', deadline: null, status: 'active' },
    { ...data.goals[0], id: 'dated', kind: 'goal', name: 'A dated goal', target: 100000, openingBalance: 20000, createdOn: '2026-09-01', deadline: '2027-06-01', status: 'active' },
  ], goalMovements: [], balances: [...data.balances.filter(b => b.accountId !== account.id), { ...data.balances.find(b => b.accountId === account.id)!, id: 'savings-test', accountId: account.id, amount: 100000, asOf: '2026-12-31' }] }
}

function mount(hidden: HomeArea[] = [], outcome: SaveOutcome = 'saved', initial = fixture()) {
  let last = initial
  const saved = vi.fn()
  function Harness() {
    const [data, setData] = useState(last)
    const [privateAreas, setPrivateAreas] = useState(hidden)
    return <VisibilityContext.Provider value={{ hidden: new Set(privateAreas), toggle: () => {}, setAll: () => {} }}>
      <button onClick={() => setPrivateAreas(['money-goals'])}>Hide test amounts</button>
      <GoalRings data={data} month="2026-12" today="2026-12-31" asOf="2026-12-31" newId={() => `movement-${saved.mock.calls.length}`}
        onOpen={saved} onChange={async next => { saved(next); if (outcome === 'saved') { last = next; setData(next) }; return outcome }} />
    </VisibilityContext.Provider>
  }
  render(<Harness />)
  return { saved, data: () => last }
}
function openBooks() {
  fireEvent.click(inRings().getByRole('button', { name: /^Open Goals,/ }))
  fireEvent.click(inRings().getByRole('button', { name: /Books for my child/ }))
}
async function contribute(effect: 'Savings I already have' | 'New savings' = 'Savings I already have') {
  fireEvent.click(button('Add Contribution'))
  fireEvent.click(screen.getByRole('radio', { name: new RegExp(`^${effect}`) }))
  fireEvent.change(screen.getByLabelText('Amount (PLN)'), { target: { value: '25' } })
  fireEvent.click(button('Save Contribution'))
  await waitFor(() => expect(region().querySelector('.block [role="status"]')?.textContent).not.toBe(''))
}

describe('optional Goal Rings on Home', () => {
  it('is off by default, Settings enables it above the existing areas, and remembers the choice', async () => {
    const storage = memoryStorage()
    render(<App storage={storage} />)
    await settle(); await fire.click(button('Explore the App'))
    expect(screen.queryByRole('region', { name: 'Your money and goals' })).toBeNull()
    await fire.click(button('Settings'))
    const setting = screen.getByRole('checkbox', { name: /Show rings on Home/ }) as HTMLInputElement
    expect(setting.checked).toBe(false)
    await fire.click(setting); await fire.click(button('Back'))
    expect(region().compareDocumentPosition(screen.getByRole('region', { name: 'This Month' })) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(storage.getItem('goal-planning-app.home-rings')).toBe('yes')
    await fire.click(inRings().getByRole('button', { name: /^Open Goals,/ }))
    await fire.click(inRings().getByRole('button', { name: 'Open Goals' }))
    await fire.click(within(screen.getByRole('navigation', { name: 'Main navigation' })).getByRole('button', { name: 'Home' }))
    expect(inRings().getByRole('heading', { name: 'Goals' })).toBeTruthy()
    cleanup(); render(<App storage={storage} />); await settle(); await fire.click(button('Explore the App'))
    expect(inRings().getByRole('heading', { name: 'All areas' })).toBeTruthy()
    await fire.click(button('Settings')); await fire.click(screen.getByRole('checkbox', { name: /Show rings on Home/ })); await fire.click(button('Back'))
    expect(screen.queryByRole('region', { name: 'Your money and goals' })).toBeNull()
  })

  it('uses the existing leave guard before closing a typed Contribution with Escape', async () => {
    const storage = memoryStorage(); storage.setItem('goal-planning-app.home-rings', 'yes')
    render(<App storage={storage} createDemo={() => ({ data: fixture(), today: '2026-12-31' })} />); await settle(); await fire.click(button('Explore the App'))
    openBooks(); await fire.click(button('Add Contribution'))
    await fire.change(screen.getByLabelText('Amount (PLN)'), { target: { value: '25' } })
    await fire.keyDown(region(), { key: 'Escape' })
    expect(screen.getByRole('alertdialog', { name: 'Leave without saving?' })).toBeTruthy()
    await fire.click(button('Keep Editing'))
    expect((screen.getByLabelText('Amount (PLN)') as HTMLInputElement).value).toBe('25')
    await fire.keyDown(region(), { key: 'Escape' }); await fire.click(button('Discard and Leave'))
    expect(button('Add Contribution')).toBeTruthy()
  })

  it.each(['ring', 'label', 'list'])('selects Bills through its %s and keeps Goals in the center', method => {
    mount()
    if (method === 'list') fireEvent.click(inRings().getByRole('button', { name: /^Bills Left to pay/ }))
    else fireEvent.click(region().querySelector(`[data-ring-${method === 'ring' ? 'hit' : 'label'}="bills"]`)!)
    expect(inRings().getByRole('heading', { name: 'Bills' })).toBeTruthy()
    expect(inRings().getByRole('button', { name: /^Open Goals,/ })).toBeTruthy()
    expect(document.activeElement).toBe(inRings().getByRole('heading', { name: 'Bills' }))
    expect(inRings().getAllByText(/✓ Paid/).length).toBeGreaterThan(0)
  })

  it('saves assigned savings once, previews the effect, updates money progress and restores focus', async () => {
    const harness = mount(); const before = savingsSummary(harness.data()).total
    openBooks(); fireEvent.click(button('Add Contribution'))
    fireEvent.click(screen.getByRole('radio', { name: /^Savings I already have/ }))
    fireEvent.change(screen.getByLabelText('Amount (PLN)'), { target: { value: '25' } })
    expect(screen.getByLabelText('Effect before saving').textContent).toContain('no change')
    fireEvent.click(button('Save Contribution'))
    await waitFor(() => expect(harness.saved).toHaveBeenCalledTimes(1))
    expect(goalSaved(harness.data().goals[0], harness.data().goalMovements)).toBe(12500)
    expect(savingsSummary(harness.data()).total).toBe(before)
    expect(inRings().getByText('50%')).toBeTruthy()
    expect(region().querySelector('.rings-progress-value')?.getAttribute('stroke-dashoffset')).toBe('50')
    await waitFor(() => expect(region().querySelector('.rings-progress-new')).toBeTruthy())
    expect(region().querySelector('.rings-added')?.textContent).toBe(`+${money(2500)}`)
    fireEvent.keyDown(region(), { key: 'Escape' })
    expect(document.activeElement).toBe(button('Add Contribution'))
    fireEvent.click(button('← Goals'))
    expect((document.activeElement as HTMLElement).textContent).toContain('Books for my child')
    expect(inRings().getByRole('button', { name: /Books for my child/ }).textContent).toContain(`${money(12500)} of ${money(25000)}`)
    fireEvent.click(button('← All areas'))
    expect(document.activeElement?.getAttribute('data-rings-focus')).toBe('core')
  })

  it('new savings increases the account and the goal once, without counting the goal on top', async () => {
    const harness = mount(); const before = savingsSummary(harness.data()).total!
    openBooks(); await contribute('New savings')
    await waitFor(() => expect(harness.saved).toHaveBeenCalledTimes(1))
    expect(savingsSummary(harness.data()).total).toBe(before + 2500)
    expect(goalSaved(harness.data().goals[0], harness.data().goalMovements)).toBe(12500)
    expect(savingsSummary(harness.data()).assigned + savingsSummary(harness.data()).unassigned!).toBe(before + 2500)
  })

  it('preserves a refused Contribution and does not announce or animate a saved change', async () => {
    const harness = mount([], 'not-saved'); openBooks(); await contribute()
    await waitFor(() => expect(screen.getByText(/This browser did not save it/)).toBeTruthy())
    expect(harness.data().goalMovements).toHaveLength(0)
    expect((screen.getByLabelText('Amount (PLN)') as HTMLInputElement).value).toBe('25')
    expect(region().querySelector('.rings-progress-new')).toBeNull()
  })

  it('keeps calendar months apart from the money percentage and announces breadcrumb navigation', () => {
    mount(); fireEvent.click(inRings().getByRole('button', { name: /^Goals Of savings/ }))
    fireEvent.click(inRings().getByRole('button', { name: /A dated goal/ }))
    expect(inRings().getByText('20%')).toBeTruthy()
    expect(screen.getByLabelText('Time, separate from money progress').textContent).not.toContain('%')
    expect(inRings().getByText('Month 4 of 10')).toBeTruthy()
    expect(region().querySelector('[aria-live]')?.textContent).toContain('A dated goal')
    fireEvent.click(within(screen.getByRole('navigation', { name: 'Rings navigation' })).getByRole('button', { name: 'All areas' }))
    expect(inRings().getByRole('heading', { name: 'All areas' })).toBeTruthy()
  })

  it('hides money, all progress shapes and percentages, including Contribution previews and status', async () => {
    const harness = mount(['money-goals']); openBooks()
    expect(region().querySelector('.rings-progress')).toBeNull()
    expect(region().textContent).not.toMatch(/\d%|\d[,\d ]* zł/)
    await contribute()
    await waitFor(() => expect(harness.saved).toHaveBeenCalledTimes(1))
    expect(region().textContent).not.toMatch(/\d%|\d[,\d ]* zł/)
    fireEvent.keyDown(region(), { key: 'Escape' }); fireEvent.click(button('← Goals'))
    expect(region().querySelector('.rings-mini,.rings-split')).toBeNull()
  })

  it.each([['month', 'Income'], ['left-to-pay', 'Bills']] as const)('respects %s privacy independently', (hidden, area) => {
    mount([hidden]); fireEvent.click(inRings().getByRole('button', { name: new RegExp(`^${area} `) }))
    expect(region().querySelector('.rings-panel')?.textContent).not.toMatch(/\d[,\d ]* zł/)
    expect(region().querySelector('.rings-core')?.textContent).toContain(money(30000))
    if (area === 'Bills') expect(region().querySelector('.rings-split')).toBeNull()
  })

  it('reduced motion renders the final counter immediately and disables all CSS motion', async () => {
    vi.stubGlobal('matchMedia', () => ({ matches: true }))
    mount(); openBooks(); await contribute()
    await waitFor(() => expect(region().querySelector('.rings-goal-center strong')?.textContent).toBe(money(12500)))
    expect(region().classList.contains('is-reduced-motion')).toBe(true)
  })
  it('hiding Money & Goals after a visible save also hides the existing status and progress', async () => {
    mount(); openBooks(); await contribute()
    await waitFor(() => expect(region().querySelector('.rings-added')).toBeTruthy())
    fireEvent.click(button('Hide test amounts'))
    expect(region().textContent).not.toMatch(/\d[,\d ]* zł|\d%/)
    expect(region().querySelector('.rings-progress')).toBeNull()
  })

  it('lets the user choose the savings account and changes only that account once', async () => {
    const data = fixture(); const original = data.moneyAccounts.find(a => a.kind === 'savings')!
    data.moneyAccounts.push({ ...original, id: 'second', name: 'Second savings' })
    data.balances.push({ ...data.balances.find(b => b.accountId === original.id)!, id: 'second-balance', accountId: 'second', amount: 50000 })
    const harness = mount([], 'saved', data)
    openBooks(); fireEvent.click(button('Add Contribution'))
    fireEvent.change(screen.getByLabelText('Savings Account'), { target: { value: 'second' } })
    fireEvent.change(screen.getByLabelText('Amount (PLN)'), { target: { value: '25' } })
    expect(screen.getByLabelText('Effect before saving').textContent).toContain(money(52500))
    fireEvent.click(button('Save Contribution'))
    await waitFor(() => expect(region().querySelector('.rings-added')).toBeTruthy())
    const accounts = savingsSummary(harness.data()).accounts
    expect(accounts.find(a => a.account.id === original.id)?.balance).toBe(100000)
    expect(accounts.find(a => a.account.id === 'second')?.balance).toBe(52500)
    expect(harness.data().goalMovements).toHaveLength(1)
  })

  it('validates amount, calendar date and unassigned savings without writing anything', async () => {
    const harness = mount(); openBooks(); fireEvent.click(button('Add Contribution'))
    fireEvent.click(screen.getByRole('radio', { name: /^Savings I already have/ }))
    fireEvent.change(screen.getByLabelText('Amount (PLN)'), { target: { value: '10000' } })
    fireEvent.click(button('Save Contribution'))
    expect(screen.getByText(/Only .* of your savings has no purpose yet/)).toBeTruthy()
    fireEvent.change(screen.getByLabelText('Amount (PLN)'), { target: { value: '25' } })
    fireEvent.change(screen.getByLabelText('Date'), { target: { value: '2027-01-01' } })
    fireEvent.click(button('Save Contribution'))
    expect(screen.getByText('The date can’t be after today.')).toBeTruthy()
    expect(harness.saved).not.toHaveBeenCalled()
  })

})
