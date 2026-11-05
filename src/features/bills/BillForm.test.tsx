// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { BillForm } from './BillForm'
import { createDemoHousehold } from '../../data/fixtures/demoHousehold'
import type { RecurringBill } from '../../domain/finance/types'
import { activityLog } from '../../domain/finance/history'
import { monthlyOverview } from '../../domain/finance/overview'
import { fire } from '../../test/space'

afterEach(cleanup)

const variants: { label: string; frequency?: RecurringBill['frequency']; once?: boolean }[] = [
  { label: 'legacy monthly without a frequency property' },
  { label: 'explicit monthly', frequency: 'monthly' },
  { label: 'yearly', frequency: 'yearly' },
  { label: 'single-month', once: true },
  { label: 'yearly limited to one month', frequency: 'yearly', once: true },
]

describe('existing bills with the new Add Bill frequency selector', () => {
  it.each(variants)('preserves dates, history and loan link for $label when editing from another month', async variant => {
    let data = createDemoHousehold()
    const source = data.bills.find(b => b.id === 'furniture-loan')!
    const bill: RecurringBill = {
      ...source, endMonth: variant.once ? source.startMonth : '2028-10',
      ...(variant.frequency ? { frequency: variant.frequency } : {}),
      ...(variant.once ? {} : { amountChanges: [{ from: '2027-01', amount: 16000 }], pausedMonths: ['2027-10'] }),
    }
    data = { ...data, bills: data.bills.map(b => b.id === bill.id ? bill : b) }
    const before = structuredClone(data)
    const history = activityLog(data)
    const saved = vi.fn()
    const created = vi.fn()
    const newId = vi.fn(() => 'unused')
    render(<BillForm data={data} bill={bill} month="2028-12" today="2028-12-20"
      owner="shared" newId={newId} onCancel={vi.fn()} onCreated={created} onSaved={saved}
      onChange={async change => { data = change(data); return 'demo' }} />)
    expect(screen.queryByRole('combobox', { name: 'Frequency' })).toBeNull()
    await fire.click(screen.getByRole('button', { name: 'More details' }))
    expect((screen.getByRole('combobox', { name: 'Start month: year' }) as HTMLSelectElement).value).toBe('2026')
    await fire.change(screen.getByLabelText('Note'), { target: { value: 'Receipt checked' } })
    await fire.click(screen.getByRole('button', { name: 'Save Changes' }))
    expect(saved).toHaveBeenCalledOnce()
    expect(created).not.toHaveBeenCalled()
    expect(newId).not.toHaveBeenCalled()
    expect(data).toEqual({ ...before, bills: before.bills.map(b => b.id === bill.id ? { ...b, note: 'Receipt checked' } : b) })
    expect(activityLog(data)).toEqual(history)
    for (const month of ['2026-10', '2027-01', '2027-10']) {
      expect(monthlyOverview(data, month)).toEqual(monthlyOverview(before, month))
    }
  })
})
