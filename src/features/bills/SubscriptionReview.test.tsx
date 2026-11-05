// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { createDemoHousehold } from '../../data/fixtures/demoHousehold'
import { billsForMonth, markBillPaid } from '../../domain/finance/bills'
import { activityLog } from '../../domain/finance/history'
import { fire } from '../../test/space'
import { AllBills } from './AllBills'
import { BillScreen } from './BillScreen'
import { SubscriptionSection } from './SubscriptionSection'
import type { RecurringBill } from '../../domain/finance/types'

afterEach(cleanup)
function fixture(overrides: Partial<RecurringBill> = {}) {
  const seed = createDemoHousehold()
  return { ...seed, bills: [{ ...seed.bills[0], id: 'review-stream', name: 'Review Stream', category: 'Subscriptions' as const,
    amount: 2500, dueDay: 20, startMonth: '2026-03', endMonth: null, frequency: 'monthly' as const, ...overrides }], billMonths: [] }
}

it.each([
  ['legacy annual', { frequency: 'yearly', endMonth: '2027-02' }, 'Ended'],
  ['legacy annual with skipped last anniversary', { frequency: 'yearly', endMonth: '2027-02', pausedMonths: ['2026-03'] }, 'Ended'],
  ['monthly ended', { endMonth: '2026-10' }, 'Ended'],
  ['monthly current charge passed', { endMonth: '2026-11', dueDay: 1 }, 'Ended'],
  ['annual current charge passed', { frequency: 'yearly', startMonth: '2025-11', endMonth: '2026-12', dueDay: 1 }, 'Ended'],
  ['monthly last charge still ahead', { endMonth: '2026-11' }, 'Active'],
  ['future monthly', { startMonth: '2027-01' }, 'Upcoming'],
  ['future annual', { frequency: 'yearly', startMonth: '2027-03' }, 'Upcoming'],
  ['distant finite plan beyond simulation horizon', { startMonth: '2030-03', endMonth: '2031-02', frequency: 'yearly' }, 'Upcoming'],
  ['open plan skipped beyond simulation horizon', { pausedMonths: Array.from({ length: 4 }, (_, i) => `${2026 + i}-03`), frequency: 'yearly' }, 'Active'],
] as [string, Partial<RecurringBill>, string][])('uses the same status in details and All Bills for %s, regardless of viewed month', (_name, overrides, status) => {
  const data = fixture(overrides)
  const before = structuredClone(data)
  render(<>
    <BillScreen data={data} billId="review-stream" months={['2025-01']} month="2025-01" today="2026-11-05"
      owner="shared" newId={() => 'unused'} onBack={vi.fn()} onMonthChange={vi.fn()} onChange={vi.fn()}
      onCreated={vi.fn()} onDeleted={vi.fn()} onOpenDebt={vi.fn()} />
    <AllBills data={data} today="2026-11-05" isDemo={false} open onToggle={vi.fn()} filter="all"
      onFilterChange={vi.fn()} onOpenBill={vi.fn()} onAddBill={vi.fn()} money={String} />
  </>)
  expect(screen.getByText(`Status: ${status}`)).toBeTruthy()
  expect(screen.getByRole('button', { name: new RegExp(`Review Stream ${status}`) })).toBeTruthy()
  if (status === 'Ended') expect(screen.queryByRole('button', { name: 'End Subscription' })).toBeNull()
  expect(data).toEqual(before)
})

it('reads a legacy annual without rewriting either its plan or its historical/restored payments', () => {
  const original = fixture({ frequency: 'yearly', endMonth: '2027-02' })
  const data = markBillPaid(original, 'review-stream', '2026-03', { amount: 2500, paidOn: '2026-03-20', paidFrom: null, interest: null }, '2026-11-05')
  const before = structuredClone(data)
  const history = activityLog(data)
  const change = vi.fn()
  render(<SubscriptionSection data={data} bill={data.bills[0]} today="2026-11-05" onChange={change} onMessage={vi.fn()} />)
  expect(screen.getByText('Status: Ended')).toBeTruthy()
  expect(screen.queryByRole('button', { name: 'End Subscription' })).toBeNull()
  expect(change).not.toHaveBeenCalled()
  expect(data).toEqual(before)
  expect(activityLog(data)).toEqual(history)
  expect(billsForMonth(data, '2026-03').find(o => o.bill.id === 'review-stream')?.paid).toBe(true)
})

it('uses Keep Subscription, singular savings and returns focus to the ending action without writing', async () => {
  const data = fixture({ frequency: 'yearly' })
  const change = vi.fn()
  render(<SubscriptionSection data={data} bill={data.bills[0]} today="2026-11-05" onChange={change} onMessage={vi.fn()} />)
  const opener = screen.getByRole('button', { name: 'End Subscription' })
  await fire.click(opener)
  const confirmation = screen.getByRole('group', { name: 'End Subscription confirmation' })
  expect(confirmation.textContent).toContain('for 1 planned charge.')
  expect(confirmation.textContent).not.toContain('these 1')
  await fire.click(within(confirmation).getByRole('button', { name: 'Keep Subscription' }))
  await vi.waitFor(() => expect(document.activeElement).toBe(screen.getByRole('button', { name: opener.textContent! })))
  expect(change).not.toHaveBeenCalled()
})

it('keeps Cancel for pause and returns focus to the pause action', async () => {
  const data = fixture()
  const change = vi.fn()
  render(<SubscriptionSection data={data} bill={data.bills[0]} today="2026-11-05" onChange={change} onMessage={vi.fn()} />)
  await fire.click(screen.getByText('Review Subscription', { selector: 'summary' }))
  const opener = screen.getByRole('button', { name: 'What If I Pause It?' })
  await fire.click(opener)
  const confirmation = screen.getByRole('group', { name: 'Pause simulation' })
  expect(confirmation.textContent).toContain('for 3 planned charges.')
  await fire.click(within(confirmation).getByRole('button', { name: 'Cancel' }))
  await vi.waitFor(() => expect(document.activeElement).toBe(screen.getByRole('button', { name: opener.textContent! })))
  expect(change).not.toHaveBeenCalled()
})

it('explains where to change the cancellation preference without removing its block', async () => {
  const data = fixture({ subscription: { canCancel: false, canPause: null, rating: null } })
  render(<SubscriptionSection data={data} bill={data.bills[0]} today="2026-11-05" onChange={vi.fn()} onMessage={vi.fn()} />)
  await fire.click(screen.getByRole('button', { name: 'End Subscription' }))
  expect(screen.getByText(/cannot be cancelled. Change this in Review Subscription/)).toBeTruthy()
  expect(screen.queryByRole('button', { name: 'Confirm End Subscription' })).toBeNull()
})

it('labels an unconfirmed ending as End Subscription in the unsaved registry', async () => {
  const data = fixture()
  const registry = { set: vi.fn(), leave: vi.fn() }
  const { UnsavedChangesContext } = await import('../../app/unsavedChanges')
  render(<UnsavedChangesContext.Provider value={registry}>
    <SubscriptionSection data={data} bill={data.bills[0]} today="2026-11-05" onChange={vi.fn()} onMessage={vi.fn()} />
  </UnsavedChangesContext.Provider>)
  await fire.click(screen.getByRole('button', { name: 'End Subscription' }))
  const entry = registry.set.mock.calls.find(call => call[1]?.text.includes('Action: End Subscription'))?.[1]
  expect(entry).toBeTruthy()
  expect(entry.text).not.toContain('Simulation: Cancel')
  await fire.click(screen.getByRole('button', { name: 'Keep Subscription' }))
  expect(registry.set.mock.calls.at(-1)?.[1]).toBeNull()
})
