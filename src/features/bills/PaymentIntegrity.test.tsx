// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { createDemoHousehold } from '../../data/fixtures/demoHousehold'
import { activityLog } from '../../domain/finance/history'
import { markBillPaid } from '../../domain/finance/bills'
import { WriteStatusContext } from '../../app/writeStatus'
import { fire } from '../../test/space'
import { BillForm } from './BillForm'
import { BillScreen } from './BillScreen'
import { BillsScreen } from './BillsScreen'
import { INITIAL_BILLS_VIEW } from './billsView'
import { SubscriptionSection } from './SubscriptionSection'
import type { ChangeSpace } from '../../ui/saveOutcome'

afterEach(cleanup)
function dataWithPayment() {
  const seed = createDemoHousehold()
  const data = { ...seed, bills: [{ ...seed.bills[0], id: 'stream', name: 'Test Stream', category: 'Subscriptions' as const,
    amount: 12345, dueDay: 5, startMonth: '2026-01', endMonth: null }], billMonths: [] }
  return markBillPaid(data, 'stream', '2026-04', { amount: 12345, paidOn: '2026-02-01', paidFrom: null, interest: null }, '2026-02-01')
}

it.each(['Start month', 'End month'])('explains an incompatible %s edit, focuses the error and never saves', async label => {
  const data = dataWithPayment()
  const change = vi.fn()
  render(<BillForm data={data} bill={data.bills[0]} month="2026-04" today="2026-02-01"
    owner="shared" newId={() => 'unused'} onChange={change} onCancel={vi.fn()} onCreated={vi.fn()} onSaved={vi.fn()} />)
  await fire.click(screen.getByRole('button', { name: 'More details' }))
  const select = screen.getByRole('combobox', { name: `${label}: month` })
  await fire.change(select, { target: { value: label === 'Start month' ? '5' : '2' } })
  await fire.click(screen.getByRole('button', { name: 'Save Changes' }))
  expect(change).not.toHaveBeenCalled()
  expect(screen.getAllByText(/April 2026 is already paid/).length).toBeGreaterThan(0)
  expect(select.getAttribute('aria-invalid')).toBe('true')
  expect(document.activeElement).toBe(select)
})

it('explains cancellation blocked by an advance payment without a success message or save', async () => {
  const data = dataWithPayment()
  const change = vi.fn()
  const message = vi.fn()
  render(<SubscriptionSection data={data} bill={data.bills[0]} today="2026-02-01" onChange={change} onMessage={message} />)
  await fire.click(screen.getByRole('button', { name: 'What If I Cancel It?' }))
  expect(screen.getByRole('alert').textContent).toContain('April 2026')
  const confirm = screen.getByRole('button', { name: 'Confirm Cancellation' })
  expect(confirm.getAttribute('aria-disabled')).toBe('true')
  await fire.click(confirm)
  expect(change).not.toHaveBeenCalled()
  expect(message).not.toHaveBeenCalled()
})

function detail(data = dataWithPayment(), onChange = vi.fn(), onDeleted = vi.fn()) {
  return <BillScreen data={data} billId="stream" months={['2026-04']} month="2026-04" today="2026-02-01"
    owner="shared" newId={() => 'unused'} onBack={vi.fn()} onMonthChange={vi.fn()} onChange={onChange}
    onCreated={vi.fn()} onDeleted={onDeleted} onOpenDebt={vi.fn()} />
}

it('opens the restored payment from History and explains why it remains in reports', () => {
  const data = dataWithPayment()
  data.bills[0].endMonth = '2026-02'
  expect(activityLog(data).find(e => e.type === 'bill')?.ref).toEqual({ kind: 'bill', billId: 'stream', month: '2026-04' })
  render(detail(data))
  expect(screen.getByText(/This bill isn't planned for April 2026, but this payment was recorded/)).toBeTruthy()
  expect(screen.getByText('✓ Paid')).toBeTruthy()
  expect(screen.queryByText(/This bill is not due in/)).toBeNull()
})

it('Delete counts paid records outside the plan and Cancel keeps them', async () => {
  const data = dataWithPayment()
  data.bills[0].endMonth = '2026-02'
  const change = vi.fn()
  render(detail(data, change))
  await fire.click(screen.getByRole('button', { name: 'Delete Bill' }))
  expect(screen.getByRole('alert').textContent).toContain('1 recorded payment will also be removed from History and reports.')
  await fire.click(within(screen.getByRole('alert')).getByRole('button', { name: 'Cancel' }))
  expect(change).not.toHaveBeenCalled()
  expect(data.billMonths).toHaveLength(1)
})

it('does not mention payments when Delete has none', async () => {
  const data = dataWithPayment()
  data.billMonths = []
  render(detail(data))
  await fire.click(screen.getByRole('button', { name: 'Delete Bill' }))
  const text = screen.getByRole('alert').textContent
  expect(text).toContain('Delete “Test Stream”? This cannot be undone.')
  expect(text).not.toContain('payments')
})

it('focuses End month when both dates change but only the end blocks April', async () => {
  const data = dataWithPayment()
  render(<BillForm data={data} bill={data.bills[0]} month="2026-04" today="2026-02-01"
    owner="shared" newId={() => 'unused'} onChange={vi.fn()} onCancel={vi.fn()} onCreated={vi.fn()} onSaved={vi.fn()} />)
  await fire.click(screen.getByRole('button', { name: 'More details' }))
  await fire.change(screen.getByRole('combobox', { name: 'Start month: year' }), { target: { value: '2025' } })
  await fire.change(screen.getByRole('combobox', { name: 'End month: month' }), { target: { value: '2' } })
  // End's initial year follows the edited start: set it back to 2026.
  await fire.change(screen.getByRole('combobox', { name: 'End month: year' }), { target: { value: '2026' } })
  await fire.click(screen.getByRole('button', { name: 'Save Changes' }))
  expect(document.activeElement).toBe(screen.getByRole('combobox', { name: 'End month: month' }))
  expect(screen.getByRole('combobox', { name: 'Start month: month' }).getAttribute('aria-invalid')).toBe('false')
})

it.each([['details', false], ['list', false], ['details', true], ['list', true]] as const)('blocks unpaying a restored payment in %s (skipped: %s) with an explanation and no write', async (where, skipped) => {
  const data = dataWithPayment()
  if (skipped) data.bills[0].pausedMonths = ['2026-04']
  else data.bills[0].endMonth = '2026-02'
  const change = vi.fn()
  if (where === 'details') render(detail(data, change))
  else render(<BillsScreen data={data} months={['2026-04']} month="2026-04" today="2026-02-01" isDemo
    view={{ ...INITIAL_BILLS_VIEW, mode: 'list' }} onViewChange={vi.fn()} onMonthChange={vi.fn()} onChange={change}
    onOpenBill={vi.fn()} onAddBill={vi.fn()} onAddBillOn={vi.fn()} />)
  await fire.click(screen.getByRole('button', { name: /Mark as Not Paid: Test Stream, April 2026/ }))
  const explanation = screen.getByRole('group', { name: 'Payment kept' })
  expect(explanation.textContent).toContain("can't be marked as not paid. The payment stays in History and reports.")
  if (skipped) {
    expect(explanation.textContent).toContain('April 2026 is a skipped month')
    expect(explanation.textContent).not.toContain('Edit Details')
    expect(explanation.textContent).not.toContain('make sure')
  } else expect(explanation.textContent).toContain("first include April 2026 in the bill's dates in Edit Details")
  expect(within(explanation).queryByRole('button', { name: 'Mark as Not Paid' })).toBeNull()
  await fire.click(within(explanation).getByRole('button', { name: 'Keep as Paid' }))
  expect(change).not.toHaveBeenCalled()
  expect(activityLog(data).filter(e => e.type === 'bill')).toHaveLength(1)
})

it('Delete passes its opening revision and does not leave on an outdated confirmation', async () => {
  const change = vi.fn<ChangeSpace>(async () => 'outdated')
  const deleted = vi.fn()
  const data = dataWithPayment()
  const view = render(<WriteStatusContext.Provider value={{ saving: false, canWrite: true, revision: 7 }}>{detail(data, change, deleted)}</WriteStatusContext.Provider>)
  await fire.click(screen.getByRole('button', { name: 'Delete Bill' }))
  view.rerender(<WriteStatusContext.Provider value={{ saving: false, canWrite: true, revision: 8 }}>{detail(data, change, deleted)}</WriteStatusContext.Provider>)
  await fire.click(within(screen.getByRole('alert')).getByRole('button', { name: 'Delete Bill' }))
  expect(change.mock.calls[0][1]).toBe(7)
  expect(deleted).not.toHaveBeenCalled()
  expect(screen.getByText(/Not saved: this was started before the latest changes/)).toBeTruthy()
})
