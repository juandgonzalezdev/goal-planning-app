// @vitest-environment jsdom
import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import App from './App'
import { memoryStorage } from './test/memoryStorage'
import { fire, settle, storedData, freshDatabaseForEachTest } from './test/space'
import { chooseHomeOption } from './test/homeControls'

freshDatabaseForEachTest()

// The compact Home controls (the eye and Home options) and the demo strip with its own menu.
afterEach(() => { cleanup() })

const button = (name: string | RegExp) => screen.getByRole('button', { name })
const text = (element: Element | null) => (element?.textContent ?? '').replace(/\u00a0|\u202f/g, ' ')
const tab = (name: string) => within(screen.getByRole('navigation', { name: 'Main navigation' })).getByRole('button', { name })
const regionOf = (name: string) => screen.getByRole('region', { name })
const toggleOf = (name: string) => within(regionOf(name)).getByRole('button', { name: new RegExp(`^${name}`) })
const homeText = () => text(document.querySelector('[data-screen="home"]'))
const homeLabels = () => [...document.querySelectorAll('[data-screen="home"] [aria-label]')].map(element => element.getAttribute('aria-label')).join(' | ')
const options = () => button('Home options')
const menu = () => screen.queryByRole('menu', { name: 'Home options' })
const items = () => within(menu()!).getAllByRole('menuitem')
const demoOptions = () => within(screen.getByRole('note')).getByRole('button', { name: 'Demo options' })
const about = () => screen.queryByRole('group', { name: 'About the demo' })
const amount = /\d,\d\d zł/
const BLOCKS = ['This Month', 'Left to Pay', 'Spending by Category', 'Total Debt', 'My Money', 'My Goals', 'Year Summary']

async function openAlex(storage: Storage = memoryStorage()) {
  const result = render(<App getToday={() => '2026-10-25'} storage={storage} />)
  await settle()
  await fire.click(button('Explore the App'))
  return { storage, ...result }
}

/** Types an amount for Rent in Spending by Category (a form inside a Home block). */
async function typeRent(value: string) {
  await fire.click(toggleOf('Spending by Category'))
  await fire.click(within(regionOf('Spending by Category')).getByRole('button', { name: 'Planned' }))
  await fire.click(within(regionOf('Spending by Category')).getByRole('button', { name: /Housing/ }))
  await fire.click(button('Change Rent (studio) amount for December 2026'))
  await fire.change(screen.getByLabelText(/^Rent \(studio\) for December 2026/), { target: { value } })
}
const rentField = () => screen.getByLabelText(/^Rent \(studio\) for December 2026/) as HTMLInputElement

describe('Home options menu', () => {
  it('holds Expand All, Collapse All and Customize Home, by their full names', async () => {
    await openAlex()
    expect(screen.queryByRole('button', { name: 'Expand All' })).toBeNull()
    expect(options().getAttribute('aria-haspopup')).toBe('menu')
    expect(options().getAttribute('aria-expanded')).toBe('false')
    await fire.click(options())
    expect(options().getAttribute('aria-expanded')).toBe('true')
    expect(items().map(item => item.textContent)).toEqual(['Expand All', 'Collapse All', 'Customize Home'])
    // The keyboard starts on the first option.
    expect(document.activeElement).toBe(items()[0])
  })

  it('moves between options with the arrow keys, Home and End', async () => {
    await openAlex()
    await fire.keyDown(options(), { key: 'ArrowDown' })
    expect(document.activeElement).toBe(items()[0])
    await fire.keyDown(document.activeElement!, { key: 'ArrowDown' })
    expect(document.activeElement).toBe(items()[1])
    await fire.keyDown(document.activeElement!, { key: 'End' })
    expect(document.activeElement).toBe(items()[2])
    await fire.keyDown(document.activeElement!, { key: 'ArrowDown' })
    expect(document.activeElement).toBe(items()[0])
    await fire.keyDown(document.activeElement!, { key: 'ArrowUp' })
    expect(document.activeElement).toBe(items()[2])
    await fire.keyDown(document.activeElement!, { key: 'Home' })
    expect(document.activeElement).toBe(items()[0])
  })

  it('closes on Escape, with the keyboard back on the button', async () => {
    await openAlex()
    await fire.click(options())
    await fire.keyDown(document.activeElement!, { key: 'Escape' })
    expect(menu()).toBeNull()
    expect(document.activeElement).toBe(options())
    expect(options().getAttribute('aria-expanded')).toBe('false')
  })

  it('closes on a tap outside, and when the keyboard leaves it', async () => {
    await openAlex()
    await fire.click(options())
    await fire.pointerDown(regionOf('This Month'))
    expect(menu()).toBeNull()
    await fire.click(options())
    // A tap inside the menu keeps it open.
    await fire.pointerDown(items()[1])
    expect(menu()).not.toBeNull()
    await fire.keyDown(document.activeElement!, { key: 'Tab' })
    expect(menu()).toBeNull()
    await fire.click(options())
    toggleOf('This Month').focus()
    await waitFor(() => expect(menu()).toBeNull())
  })

  it('closes after an option, with the keyboard back on the button, and announces it', async () => {
    await openAlex()
    await chooseHomeOption('Expand All')
    expect(menu()).toBeNull()
    expect(document.activeElement).toBe(options())
    expect(BLOCKS.every(name => toggleOf(name).getAttribute('aria-expanded') === 'true')).toBe(true)
    expect(text(document.querySelector('.visually-hidden[role="status"]'))).toBe('All blocks open.')
    await chooseHomeOption('Collapse All')
    expect(BLOCKS.every(name => toggleOf(name).getAttribute('aria-expanded') === 'false')).toBe(true)
    expect(text(document.querySelector('.visually-hidden[role="status"]'))).toBe('All blocks closed.')
  })

  it('Customize Home puts the keyboard on its instructions, and Done puts it back on Home options', async () => {
    await openAlex()
    await chooseHomeOption('Customize Home')
    const panel = screen.getByRole('group', { name: 'Customize Home' })
    expect(document.activeElement).toBe(panel)
    expect(panel.getAttribute('aria-describedby')).toBeTruthy()
    // While customizing, the eye and the menu step aside, as the old buttons did.
    expect(screen.queryByRole('button', { name: 'Home options' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Hide All Amounts' })).toBeNull()
    await fire.click(button('Done'))
    expect(document.activeElement).toBe(options())
    expect(button('Hide All Amounts')).toBeTruthy()
  })
})

describe('The Home eye', () => {
  it('hides and shows every amount with one tap, in text, charts, details and accessible names', async () => {
    await openAlex()
    await chooseHomeOption('Expand All')
    expect(homeText()).toMatch(amount)
    await fire.click(button('Hide All Amounts'))
    expect(homeText()).not.toMatch(amount)
    expect(homeLabels()).not.toMatch(amount)
    for (const name of BLOCKS) expect(button(`Show amounts in ${name}`)).toBeTruthy()
    expect(button('Show All Amounts').classList.contains('is-hidden')).toBe(true)
    await fire.click(button('Show All Amounts'))
    expect(homeText()).toMatch(amount)
    for (const name of BLOCKS) expect(button(`Hide amounts in ${name}`)).toBeTruthy()
  })

  it('says Amounts hidden or Amounts visible for a moment, over the page', async () => {
    await openAlex()
    const status = () => document.querySelector('.amounts-notice')!
    expect(text(status())).toBe('')
    await fire.click(button('Hide All Amounts'))
    expect(status().getAttribute('role')).toBe('status')
    expect(text(status())).toBe('Amounts hidden')
    expect(status().classList.contains('is-shown')).toBe(true)
    await fire.click(button('Show All Amounts'))
    expect(text(status())).toBe('Amounts visible')
    await waitFor(() => expect(text(status())).toBe(''), { timeout: 3000 })
    expect(status().classList.contains('is-shown')).toBe(false)
  })

  it('keeps each block’s own eye; all hidden only when every block is', async () => {
    await openAlex()
    await fire.click(button('Hide amounts in Total Debt'))
    expect(text(toggleOf('Total Debt'))).toContain('•••• still owed')
    expect(text(toggleOf('My Money'))).toMatch(amount)
    expect(button('Show amounts in Total Debt').classList.contains('is-hidden')).toBe(true)
    // One block hidden is not all of them: the Home eye still hides all.
    await fire.click(button('Hide All Amounts'))
    await fire.click(button('Show amounts in My Money'))
    expect(text(toggleOf('My Money'))).toMatch(amount)
    expect(button('Hide All Amounts')).toBeTruthy()
  })

  it('shows the names of icon buttons on hover and focus, without a second name for screen readers', async () => {
    await openAlex()
    for (const name of ['Hide All Amounts', 'Home options', 'Hide amounts in This Month', 'Demo options']) {
      const tip = button(name).querySelector('.icon-tip')!
      expect(tip.textContent).toBe(name)
      expect(tip.getAttribute('aria-hidden')).toBe('true')
    }
  })

  it('Bills and History keep their own Hide All Amounts button', async () => {
    await openAlex()
    await fire.click(tab('Bills'))
    expect(button('Hide All Amounts').textContent).toContain('Hide All Amounts')
  })
})

describe('What was typed survives the controls', () => {
  it('keeps a half-typed amount through the eye, Expand All, Collapse All and Customize Home', async () => {
    await openAlex()
    await typeRent('1234')
    await fire.click(button('Hide All Amounts'))
    await fire.click(button('Show All Amounts'))
    await chooseHomeOption('Collapse All')
    await chooseHomeOption('Expand All')
    await chooseHomeOption('Customize Home')
    await fire.click(button('Done'))
    expect(rentField().value).toBe('1234')
  })
})

describe('Demo strip', () => {
  it('is one short line, Demo · Invented data, with Exit Demo always visible', async () => {
    await openAlex()
    const banner = screen.getByRole('note')
    expect(text(banner.querySelector('.demo-label'))).toBe('Demo · Invented data')
    expect(within(banner).getAllByRole('button').map(element => element.getAttribute('aria-label') ?? element.textContent)).toEqual(['Exit Demo', 'Demo options'])
    expect(within(banner).getByRole('button', { name: 'Exit Demo' })).toBeTruthy()
    expect(within(banner).queryByRole('button', { name: 'Reset Demo' })).toBeNull()
  })

  it('has its own menu, apart from Home options, explaining the demo and holding Reset Demo', async () => {
    await openAlex()
    await fire.click(demoOptions())
    expect(demoOptions().getAttribute('aria-expanded')).toBe('true')
    expect(menu()).toBeNull()
    expect(text(about())).toContain('Alex and all the information in this demo are invented.')
    expect(text(about())).toContain('Changes are not saved')
    expect(within(about()!).getByRole('button', { name: 'Reset Demo' })).toBeTruthy()
    // Opening Home options closes it.
    await fire.pointerDown(options())
    expect(about()).toBeNull()
  })

  it('closes on Escape and on a tap outside', async () => {
    await openAlex()
    await fire.click(demoOptions())
    await fire.keyDown(demoOptions(), { key: 'Escape' })
    expect(about()).toBeNull()
    expect(document.activeElement).toBe(demoOptions())
    await fire.click(demoOptions())
    await fire.pointerDown(document.body)
    expect(about()).toBeNull()
  })

  it('Reset Demo still asks first; Cancel changes nothing, Reset Demo restores Alex, and the keyboard comes back to the menu', async () => {
    const { storage } = await openAlex()
    await fire.click(button('Hide amounts in Total Debt'))
    await fire.click(demoOptions())
    await fire.click(within(about()!).getByRole('button', { name: 'Reset Demo' }))
    const question = screen.getByRole('group', { name: 'Reset demo?' })
    expect(document.activeElement).toBe(within(question).getByRole('button', { name: 'Cancel' }))
    expect(within(screen.getByRole('note')).queryByRole('button', { name: 'Exit Demo' })).toBeNull()
    await fire.click(within(question).getByRole('button', { name: 'Cancel' }))
    expect(button('Show amounts in Total Debt')).toBeTruthy()
    expect(document.activeElement).toBe(demoOptions())
    await fire.click(demoOptions())
    await fire.click(within(about()!).getByRole('button', { name: 'Reset Demo' }))
    await fire.click(within(screen.getByRole('group', { name: 'Reset demo?' })).getByRole('button', { name: 'Reset Demo' }))
    expect(button('Hide amounts in Total Debt')).toBeTruthy()
    expect(document.activeElement).toBe(demoOptions())
    // The demo never writes to this device.
    expect(storage.length).toBe(0)
    expect(await storedData()).toBeNull()
  })

  it('Exit Demo still asks when something typed in the demo would be dropped', async () => {
    await openAlex()
    await typeRent('77')
    await fire.click(within(screen.getByRole('note')).getByRole('button', { name: 'Exit Demo' }))
    expect(screen.getByRole('button', { name: 'Discard and Exit Demo' })).toBeTruthy()
    await fire.click(button('Keep Editing'))
    expect(rentField().value).toBe('77')
    expect(screen.getByRole('note')).toBeTruthy()
  })
})
