// @vitest-environment jsdom
import { chooseMonth } from './test/monthPicker'
import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { memoryStorage } from './test/memoryStorage'
import { fire, settle, freshDatabaseForEachTest } from './test/space'
import { markNotPaid } from './test/bills'

freshDatabaseForEachTest()

// Left to Pay with an explicit reference (Rumbo de diseño §6): the month of today shows Overdue,
// Due later and Coming up (the next seven days of the next month, apart and never in the total);
// a past month shows what was not marked as paid; a future month what is planned. A Coming up
// bill opens in its own month, and Back finds Home on its month. Alex's demo date: 31 Dec 2026.
afterEach(() => { cleanup(); vi.restoreAllMocks() })

const button = (name: string | RegExp) => screen.getByRole('button', { name })
const text = (element: Element | null) => (element?.textContent ?? '').replace(/\u00a0|\u202f/g, ' ')
const tab = (name: string) => within(screen.getByRole('navigation', { name: 'Main navigation' })).getByRole('button', { name })
const area = () => screen.getByRole('region', { name: 'Left to Pay' })
const monthSelect = () => screen.getByRole('button', { name: /^Choose month:/ }) as HTMLButtonElement
const pickMonth = async (month: string) => await chooseMonth(month)
const groups = () => [...area().querySelectorAll('.pay-group-title')].map(text)
const shownScreen = () => document.querySelector('main [data-screen]')?.getAttribute('data-screen')

async function openAlex() {
  render(<App getToday={() => '2026-10-25'} storage={memoryStorage()} />)
  await settle()
  await fire.click(button('Explore the App'))
}

describe('Left to Pay in the month of the demo’s date', () => {
  it('says where it counts from, and keeps Coming up apart from December’s total', async () => {
    await openAlex()
    expect(text(area())).toContain('From the demo’s date, 31 Dec 2026')
    expect(groups()).toEqual(['Due later in December', 'Coming up · 1–7 Jan'])
    const next = within(area()).getByRole('region', { name: 'Coming up, 1 Jan 2027 to 7 Jan 2027' })
    expect([...next.querySelectorAll('li span')].map(row => text(row).replace(/Due .*/, ''))).toEqual(['Gym Membership', 'Transit Pass', 'Music Streaming'])
    expect(text(next)).toContain('January’s bills. Not included in December’s total.')
    // The total is December's only: Phone & Internet.
    expect(text(area().querySelector('.year-total'))).toBe('69,99 zł')
  })

  it('opens a Coming up bill in January; Back finds Home on December, on that bill', async () => {
    await openAlex()
    await fire.click(button(/^Gym Membership, .* Opens January 2027$/))
    expect(shownScreen()).toBe('bill')
    expect(monthSelect().value).toBe('2027-01')
    expect(screen.getByRole('heading', { name: 'January 2027' })).toBeTruthy()
    await fire.click(button('Back'))
    await waitFor(() => expect(shownScreen()).toBe('home'))
    expect(monthSelect().value).toBe('2026-12')
    expect(document.activeElement).toBe(button(/^Gym Membership, .* Opens January 2027$/))
  })

  it('shows a bill whose date has passed as Overdue, never one of an earlier month', async () => {
    await openAlex()
    await fire.click(tab('Bills'))
    await fire.click(button('List'))
    await markNotPaid('Utilities', 'December 2026')
    await pickMonth('2026-11')
    await markNotPaid('Music Streaming', 'November 2026')
    await fire.click(tab('Home'))
    await pickMonth('2026-12')
    expect(groups()).toEqual(['Overdue', 'Due later in December', 'Coming up · 1–7 Jan'])
    expect(text(area())).toContain('Overdue since 12 Dec 2026')
    expect(text(area().querySelector('.pay-groups'))).not.toContain('Music Streaming')
  })
})

describe('Left to Pay in another month', () => {
  it('a past month lists what was not marked as paid, with nothing counted from today', async () => {
    await openAlex()
    await pickMonth('2026-08')
    await fire.click(tab('Bills'))
    await fire.click(button('List'))
    await markNotPaid('Music Streaming', 'August 2026')
    await fire.click(tab('Home'))
    expect(text(area())).toContain('These are August’s bills. Nothing here is counted from today.')
    expect(groups()).toEqual(['Not marked as paid in August'])
    expect(text(area())).not.toMatch(/Overdue|Coming up|From the demo/)
  })

  it('a future month lists what is planned, without Overdue or Coming up', async () => {
    await openAlex()
    await pickMonth('2027-01')
    expect(text(area())).toContain('These are January’s bills. Nothing here is due yet.')
    expect(groups()).toEqual(['Planned for January'])
    expect(text(area())).not.toMatch(/Overdue|Coming up/)
  })
})
