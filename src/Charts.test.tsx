// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { LineChart } from './components/LineChart'
import { memoryStorage } from './test/memoryStorage'
import { openCardsAndLoans, openMoneyBlock } from './test/money'
import { fire, settle, freshDatabaseForEachTest } from './test/space'

freshDatabaseForEachTest()

// The four charts (Rumbo de diseño §7): solid records, a dashed estimate with its label, an empty
// stretch marked "Not entered", no line from fewer than two records, the arrow keys between records,
// and the same figures as a table. Alex's demo is shown on its own date, 31 Dec 2026.
afterEach(() => { cleanup(); vi.restoreAllMocks() })

const button = (name: string | RegExp) => screen.getByRole('button', { name })
const text = (element: Element | null) => (element?.textContent ?? '').replace(/\u00a0|\u202f/g, ' ')
const tab = (name: string) => within(screen.getByRole('navigation', { name: 'Main navigation' })).getByRole('button', { name })
const chart = (name: RegExp) => screen.getByRole('group', { name })
const points = (name: RegExp) => within(chart(name)).getAllByRole('button')

async function openAlex() {
  render(<App getToday={() => '2026-10-25'} storage={memoryStorage()} />)
  await settle()
  await fire.click(button('Explore the App'))
}

describe('Savings over time (Money)', () => {
  it('has one record per month, one Tab stop, the arrow keys between records, and a table', async () => {
    await openAlex()
    await fire.click(tab('Money'))
    await openMoneyBlock('Accounts & Savings')
    const all = points(/^Savings over time/)
    expect(all).toHaveLength(12)
    // The latest record is chosen at first, and it is the only one in the Tab order.
    expect(all.filter(point => point.tabIndex === 0)).toEqual([all[11]])
    expect(all[11].getAttribute('aria-pressed')).toBe('true')
    const section = screen.getByRole('region', { name: 'Savings over time' })
    expect(text(section)).toContain('December 2026: 2900,00 zł in savings')
    await fire.keyDown(all[11], { key: 'ArrowLeft' })
    expect(document.activeElement).toBe(all[10])
    expect(text(section)).toContain('November 2026: 2450,00 zł in savings')
    await fire.keyDown(all[10], { key: 'Home' })
    expect(text(section)).toContain('January 2026: 3500,00 zł in savings')
    await fire.click(within(section).getByRole('button', { name: 'Show as Table' }))
    const table = within(section).getByRole('table', { name: /^Savings over time/ })
    expect(within(table).getAllByRole('row')).toHaveLength(13)
  })
})

describe('Saved over time (a goal)', () => {
  it('shows the target, and a step opens its record in Savings Activity', async () => {
    await openAlex()
    await fire.click(tab('Goals'))
    await fire.click(button(/^Trip to Japan/))
    const section = screen.getByRole('region', { name: 'Saved over time' })
    expect(text(section)).toContain('Target 10 000,00 zł')
    const steps = points(/^Trip to Japan: saved over time/)
    expect(text({ textContent: steps[0].getAttribute('aria-label') } as Element)).toBe('31 Dec 2025: Already saved when it was added, saved 750,00 zł')
    await fire.click(steps[1])
    expect(text(section)).toContain('12 Jan 2026: From unassigned savings +100,00 zł. Saved after it: 850,00 zł.')
    await fire.click(within(section).getByRole('button', { name: 'Show in Savings Activity' }))
    await settle()
    expect(document.activeElement?.classList.contains('is-target')).toBe(true)
    expect(text(document.activeElement)).toContain('12 Jan 2026')
  })
})

describe('Remaining Balance over time (a loan)', () => {
  it('keeps the balances entered solid and labels the estimate, which the table marks apart', async () => {
    await openAlex()
    await openCardsAndLoans()
    await fire.click(button(/^Student Loan/))
    const section = screen.getByRole('region', { name: 'Remaining Balance over time' })
    expect(text(section)).toContain('Estimate if you pay 250,00 zł a month')
    expect(text(section)).toContain('It is not a record.')
    // Only the balances entered can be chosen: the 12 months of 2026.
    expect(points(/^Remaining Balance over time/)).toHaveLength(12)
    expect(document.querySelectorAll('.time-chart-line.is-estimate')).toHaveLength(1)
    await fire.click(within(section).getByRole('button', { name: 'Show as Table' }))
    const rows = within(within(section).getByRole('table')).getAllByRole('row').map(text)
    expect(rows.filter(row => row.endsWith('Estimate'))).toHaveLength(12)
    expect(rows[1]).toContain('January 2026')
    await fire.click(within(section).getByRole('button', { name: 'Show in Balance History' }))
    await settle()
    expect(text(document.activeElement)).toContain('31 Dec 2026 · Entered')
  })
})

describe('Income & Spending by month (History › Year Overview)', () => {
  it('moves between months with the arrow keys, shows the chosen month in figures and as a table', async () => {
    await openAlex()
    await fire.click(tab('History'))
    await fire.click(button(/^Year Overview/))
    const months = within(screen.getByRole('list', { name: /^Income and spending by month in 2026/ })).getAllByRole('button')
    expect(months).toHaveLength(12)
    months[0].focus()
    await fire.keyDown(months[0], { key: 'ArrowDown' })
    expect(document.activeElement).toBe(months[1])
    await fire.keyDown(months[1], { key: 'End' })
    expect(document.activeElement).toBe(months[11])
    await fire.click(months[11])
    expect(text(document.querySelector('.chosen-month-figures'))).toMatch(/^December 2026: Received [\d ]+,\d\d zł · Spent [\d ]+,\d\d zł$/)
    await fire.click(button('Show as Table'))
    const rows = within(screen.getByRole('table', { name: 'Income and spending by month in 2026' })).getAllByRole('row')
    expect(rows).toHaveLength(13)
    expect(rows[0].textContent).toBe('MonthReceivedSpentResult')
    expect(rows[12].textContent).toMatch(/^Dec 2026/)
  })

  it('hides the chart and its table with the amounts', async () => {
    await openAlex()
    await fire.click(tab('History'))
    await fire.click(button(/^Year Overview/))
    await fire.click(button('Hide amounts'))
    expect(screen.getByText('Chart hidden with the amounts')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Show as Table' })).toBeNull()
    expect(document.querySelector('.history-overview .pair-bars, .history-overview .legend-expected')).toBeNull()
  })
})

describe('The chart itself', () => {
  const money = (minor: number) => `${minor / 100}`
  const table = { head: ['Month', 'Amount'], rows: [] }
  it('never joins records across an empty stretch, and marks it Not entered', () => {
    render(<LineChart name="Test" money={money} legend={[]} xLabels={[]} table={table} selected={null} onSelect={() => {}} detail={null}
      lines={[{ style: 'record', points: [{ x: 0, value: 1 }, { x: 0.2, value: 2 }] }, { style: 'record', points: [{ x: 0.6, value: 3 }] }]}
      points={[{ key: 'a', x: 0, value: 1, label: 'a' }, { key: 'b', x: 0.2, value: 2, label: 'b' }, { key: 'c', x: 0.6, value: 3, label: 'c' }]}
      gaps={[{ from: 0.2, to: 0.6 }]} />)
    // One path for the run of two; the lone record is a point with no line.
    expect(document.querySelectorAll('path.time-chart-line')).toHaveLength(1)
    expect(document.querySelector('path.time-chart-line')!.getAttribute('d')!.match(/[ML]/g)).toEqual(['M', 'L'])
    expect(text(document.querySelector('.time-chart-gap'))).toBe('Not entered')
  })
})
