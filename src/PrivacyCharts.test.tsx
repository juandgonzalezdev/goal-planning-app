// @vitest-environment jsdom
import { chooseMonth } from './test/monthPicker'
import { cleanup, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { ALEX_DEMO_TODAY, createAlexDemo } from './data/fixtures/demoAlex'
import { buildReport } from './report/report'
import { classicHome } from './test/memoryStorage'
import { fire, settle, freshDatabaseForEachTest } from './test/space'
import { chooseHomeOption, openHomePart } from './test/homeControls'

freshDatabaseForEachTest()

// Hidden amounts hide what a chart or a sentence would tell about them too (decision H1):
// the chart is replaced, and no shape, sign, warning colour, share, deficit sentence,
// detail worked out from amounts or accessible value is left. Lists keep an order that
// does not depend on the amounts. Alex's demo is shown on its own date, 31 Dec 2026.
afterEach(() => { cleanup(); vi.restoreAllMocks() })

const button = (name: string | RegExp) => screen.getByRole('button', { name })
const text = (element: Element | null) => (element?.textContent ?? '').replace(/\u00a0|\u202f/g, ' ')
const regionOf = (name: string) => screen.getByRole('region', { name })
const monthSelect = () => screen.getByRole('button', { name: /^Choose month:/ }) as HTMLButtonElement
const pickMonth = async (month: string) => await chooseMonth(month)
const amount = /\d,\d\d zł/
const labelsIn = (element: Element) => [...element.querySelectorAll('[aria-label]')].map(item => item.getAttribute('aria-label')!.replace(/\u00a0|\u202f/g, ' '))
const leaks = (element: Element) => element.querySelectorAll('.donut, .bar, .result-bar, .is-negative, .is-positive, .stat-warning, .amount-out, [role="progressbar"]')

async function openAlex() {
  render(<App getToday={() => '2026-10-25'} storage={classicHome()} />)
  await settle()
  await fire.click(button('Explore the App'))
}

describe('Charts on Home with the amounts hidden', () => {
  it('replaces the Spending by Category chart, keeps the categories in their usual order, and Show Amounts shows that area only', async () => {
    await openAlex()
    await openHomePart('Spending by Category')
    const part = regionOf('Spending by Category')
    const order = [...part.querySelectorAll('.tiles button')].map(tile => text(tile.querySelector('span')))
    await fire.click(button('Hide amounts in This Month'))
    expect(part.querySelector('.donut')).toBeNull()
    expect(within(part).getByText('Chart hidden with the amounts')).toBeTruthy()
    // The same order as with the amounts shown: it never follows the amounts.
    expect([...part.querySelectorAll('.tiles button')].map(tile => text(tile.querySelector('span')))).toEqual(order)
    await fire.click(within(part).getByRole('button', { name: 'Bars' }))
    expect(leaks(part)).toHaveLength(0)
    expect(text(part)).not.toMatch(amount)
    // Planned, as a donut and as bars.
    await fire.click(within(part).getByRole('button', { name: 'Planned' }))
    expect(leaks(part)).toHaveLength(0)
    await fire.click(within(part).getByRole('button', { name: 'Donut' }))
    expect(within(part).getByText('Chart hidden with the amounts')).toBeTruthy()
    // Show Amounts shows This Month again, and only it.
    await fire.click(button('Hide amounts in Left to Pay'))
    await fire.click(within(part).getByRole('button', { name: 'Show Amounts' }))
    expect(button('Hide amounts in This Month')).toBeTruthy()
    expect(button('Show amounts in Left to Pay')).toBeTruthy()
    expect(part.querySelector('.donut')).not.toBeNull()
  })

  it('opening a month amount to change it does not show the hidden amount', async () => {
    await openAlex()
    await openHomePart('Spending by Category')
    const part = regionOf('Spending by Category')
    await fire.click(within(part).getByRole('button', { name: 'Planned' }))
    await fire.click(within(part).getByRole('button', { name: /^Housing/ }))
    await fire.click(button('Hide amounts in This Month'))
    await fire.click(within(part).getByRole('button', { name: /^Change Rent \(studio\) amount/ }))
    expect((within(part).getByLabelText(/Rent \(studio\) for December 2026/) as HTMLInputElement).value).toBe('')
  })

  it('Year Summary: no bars, signs, warning colour or deficit sentence; the months still open on Home', async () => {
    await openAlex()
    await openHomePart('Year Summary')
    const part = regionOf('Year Summary')
    expect(text(part)).toContain('Spending was higher than income in Feb, Jul, Aug')
    await fire.click(button('Hide amounts in This Month'))
    expect(leaks(part)).toHaveLength(0)
    expect(text(part)).not.toMatch(/Spending was higher|Bars to the right/)
    expect(within(part).getByText('Chart hidden with the amounts')).toBeTruthy()
    // Every month is named the same way, whatever its result.
    const months = within(part).getByRole('list', { name: 'Months of 2026' })
    expect(labelsIn(months).slice(0, 3)).toEqual(['January 2026. Open on Home', 'February 2026. Open on Home', 'March 2026. Open on Home'])
    await fire.click(within(months).getByRole('button', { name: 'August 2026. Open on Home' }))
    expect(monthSelect().value).toBe('2026-08')
    // Reference Notes say nothing about the share or whether income was received.
    await fire.click(within(part).getByText('Reference Notes'))
    expect(text(part)).toContain('The share of housing costs is hidden with the amounts.')
    expect(text(part)).not.toMatch(/Housing and utilities were|No percentage/)
  })

  it('This Month: a negative month does not say so, and where the result went is hidden', async () => {
    await openAlex()
    await pickMonth('2026-08')
    const area = regionOf('This Month')
    expect(text(area)).toContain('Spent more than received')
    await fire.click(button('Hide amounts in This Month'))
    expect(text(area)).not.toContain('Spent more than received')
    expect(leaks(area)).toHaveLength(0)
    await fire.click(within(area).getByRole('button', { name: 'How is this worked out?' }))
    expect(text(area)).toContain('Where the result went is hidden with the amounts.')
    expect(text(area)).not.toMatch(/deficit|From your Savings|New debt/)
  })

  it('Ideas to Review are listed by name, without the largest deficit', async () => {
    await openAlex()
    await openHomePart('Spending by Category')
    const part = regionOf('Spending by Category')
    await fire.click(within(part).getByRole('button', { name: 'Ideas to Review' }))
    expect(text(part)).toContain('your largest monthly deficit')
    await fire.click(button('Hide amounts in This Month'))
    const names = [...within(part).getByRole('list', { name: 'Ideas to review' }).querySelectorAll('li')].map(row => text(row.querySelector('span')).split('Subscription')[0].split('About')[0])
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)))
    expect(text(part)).not.toContain('largest monthly deficit')
    expect(text(part)).toContain('by name while the amounts are hidden')
  })

  it('Money & Goals: no donut, progress, cover or “reached”; Unassigned is always listed', async () => {
    await openAlex()
    await chooseHomeOption('Expand All')
    await fire.click(button('Hide amounts in Money & Goals'))
    const area = regionOf('Money & Goals')
    expect(leaks(area)).toHaveLength(0)
    expect(within(area).getByText('Chart hidden with the amounts')).toBeTruthy()
    expect(text(area)).not.toMatch(/Covers about|reached|to go|to the target/)
    expect(text(area)).toContain('Cover hidden with the amounts')
    // Alex has no unassigned savings: hidden, the line is there anyway, so its absence tells nothing.
    expect(within(regionOf('Accounts & Savings')).getByText('Unassigned')).toBeTruthy()
    expect(labelsIn(area).filter(label => amount.test(label) || /%/.test(label))).toEqual([])
  })
})

describe('The PDF without amounts', () => {
  const drawn = (includeAmounts: boolean) => [...buildReport(createAlexDemo(), {
    period: { kind: 'year', year: 2026 }, today: ALEX_DEMO_TODAY, generatedOn: '2026-10-26', includeAmounts, isDemo: true,
  }).toString().matchAll(/\((.*?)\) Tj/g)].map(m => m[1]).join(' ')

  it('leaves out charts, deficits and the cover, and lists categories by name', () => {
    const shown = drawn(true)
    expect(shown).toContain('How Deficits Were Covered')
    expect(shown).toContain('Result by month')
    const hidden = drawn(false)
    expect(hidden).not.toMatch(/How Deficits Were Covered|deficit of|Result by month|covers about|PLN \d/)
    expect(hidden).toContain('categories are listed by name')
    // Categories in alphabetical order, not by amount.
    const order = ['Eating Out', 'Gifts', 'Groceries', 'Health', 'Housing'].map(name => hidden.indexOf(`(${name})`) >= 0 ? hidden.indexOf(name) : hidden.indexOf(name))
    expect(order.every(index => index >= 0)).toBe(true)
    expect([...order].sort((a, b) => a - b)).toEqual(order)
  })
})
