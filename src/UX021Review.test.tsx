// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import App from './App'
import { memoryStorage } from './test/memoryStorage'
import { fire, settle, storedData, freshDatabaseForEachTest } from './test/space'
import { MEMBER_NAME_MAX_LENGTH } from './domain/finance/space'

freshDatabaseForEachTest()
afterEach(cleanup)
const button = (name: string | RegExp) => screen.getByRole('button', { name })
const tab = (name: string) => within(screen.getByRole('navigation', { name: 'Main navigation' })).getByRole('button', { name })
const card = () => screen.getByRole('region', { name: 'December 2026 at a glance' })
const toggle = () => button(/^More for December/)
const amount = /\d[,.]\d{2}\s*zł/
const main = () => screen.getByRole('main')
const text = () => main().textContent ?? ''
const labels = () => [...main().querySelectorAll('[aria-label]')].map(el => el.getAttribute('aria-label')).join(' ')

async function demo() {
  const storage = memoryStorage()
  storage.setItem('goal-planning-app.home-rings', 'yes')
  render(<App storage={storage} />)
  await settle(); await fire.click(button('Explore the App'))
}
async function own(name: string, partner?: string) {
  render(<App storage={memoryStorage()} />)
  await settle(); await fire.click(button('Create Account'))
  await fire.click(button('Continue Without an Account'))
  const field = screen.getByLabelText('Display Name')
  expect(field.getAttribute('maxlength')).toBe('80')
  await fire.change(field, { target: { value: name } })
  await fire.click(button('Continue'))
  if (partner) {
    await fire.click(screen.getByRole('radio', { name: /^Duo/ }))
    await fire.change(screen.getByLabelText("Second Person's Name"), { target: { value: partner } })
  }
  for (let i = 0; i < 2; i++) await fire.click(button('Continue'))
  await fire.click(button('Create My Space'))
}

describe('UX-02.1 independent review regressions', () => {
  it.each(['Sample', 'Long sample workspace with several words', 'Árbol del Río — Café de Prueba', 'Á'.repeat(MEMBER_NAME_MAX_LENGTH)])('keeps the full workspace description accessible: %s', async name => {
    await own(name)
    const brand = button('Go to Home')
    const description = document.getElementById(brand.getAttribute('aria-describedby')!)!
    expect(description.textContent).toContain(name)
    expect(brand.getAttribute('title')).toContain(name)
    expect(within(screen.getByRole('group', { name: 'Global controls' })).getAllByRole('button')).toHaveLength(4)
  })


  it('keeps the longest supported Duo space name available without changing name validation', async () => {
    const first = 'Á'.repeat(MEMBER_NAME_MAX_LENGTH), second = 'É'.repeat(MEMBER_NAME_MAX_LENGTH)
    await own(first, second)
    const subtitle = document.getElementById(button('Go to Home').getAttribute('aria-describedby')!)!
    expect(subtitle.textContent).toContain(first + ' & ' + second)
    expect((await storedData())?.space.name).toHaveLength(83)
  })

  // UX-04.1 Ring-first: one landmark for the ring and its card, genuine detail headings, and More (not the ring) folds.
  it('has one at-a-glance heading/landmark for the ring, with genuine detail headings, and only More folds', async () => {
    await demo()
    expect(within(card()).getAllByRole('heading', { name: 'December 2026 at a glance', level: 2 })).toHaveLength(1)
    expect(within(card()).queryByRole('navigation', { name: 'Rings navigation' })).toBeNull()
    expect(within(card()).queryByRole('region', { name: 'Your money and goals' })).toBeNull()
    await fire.click(within(card()).getByRole('radio', { name: /^Select Bills,/ })); await fire.click(within(card()).getByRole('button', { name: 'View Bills details' }))
    const heading = within(card()).getByRole('heading', { name: 'Bills', level: 3 })
    expect(document.activeElement).toBe(heading)
    expect(toggle().textContent).toContain('This Month, Spending by Category, Year Summary, Money & Goals')
    await fire.click(toggle())
    expect(toggle().getAttribute('aria-expanded')).toBe('true')
    expect(card().querySelector('[inert]')).toBeNull()
    expect(within(card()).getByRole('heading', { name: 'Bills', level: 3 })).toBeTruthy()
    await fire.click(within(card()).getByRole('button', { name: '← All areas' }))
    await fire.click(within(card()).getByRole('radio', { name: /^Select Goals,/ })); await fire.click(within(card()).getByRole('button', { name: 'View Goals details' }))
    await fire.click(within(card()).getByRole('button', { name: /^Trip to Japan/ }))
    expect(within(card()).getByRole('heading', { name: 'Trip to Japan', level: 3 })).toBeTruthy()
  })

  it('masks and restores Bills and History through the single global privacy control across tabs', async () => {
    await demo()
    await fire.click(tab('Bills'))
    expect(text()).toMatch(amount)
    await fire.click(button('Hide amounts'))
    expect(text()).not.toMatch(amount); expect(labels()).not.toMatch(amount)
    expect(text()).toContain('••••')
    expect(screen.getAllByRole('button', { name: 'Amounts hidden. Show amounts' })).toHaveLength(1)
    expect(document.querySelector('.control-feedback')?.textContent).toContain('Amounts hidden')
    await fire.click(tab('History'))
    expect(text()).not.toMatch(amount); expect(labels()).not.toMatch(amount)
    await fire.click(button('Amounts hidden. Show amounts'))
    expect(text()).toMatch(amount)
    await fire.click(button('Hide amounts'))
    expect(text()).not.toMatch(amount); expect(labels()).not.toMatch(amount)
    await fire.click(tab('Bills'))
    expect(text()).not.toMatch(amount)
    await fire.click(button('Amounts hidden. Show amounts'))
    expect(text()).toMatch(amount)
    expect(await storedData()).toBeNull()
  })

  it('keeps own privacy when the demo hides and restores actual Bills and History amounts', async () => {
    await own('Fictional workspace')
    await fire.click(button('Hide amounts'))
    const before = await storedData()
    await fire.click(button('Settings')); await fire.click(button('Explore the Demo'))
    for (const name of ['Bills', 'History']) {
      await fire.click(tab(name)); expect(text()).toMatch(amount)
      await fire.click(button('Hide amounts')); expect(text()).not.toMatch(amount)
      await fire.click(button('Amounts hidden. Show amounts')); expect(text()).toMatch(amount)
    }
    await fire.click(within(screen.getByRole('note')).getByRole('button', { name: 'Exit Demo' }))
    expect(button('Amounts hidden. Show amounts')).toBeTruthy()
    expect(await storedData()).toEqual(before)
  })

  it('keeps global Add primary and Add Bill secondary with the same form action', async () => {
    await demo(); await fire.click(tab('Bills'))
    expect(button('Add').classList.contains('button-small-primary')).toBe(true)
    expect(button('Add Bill').classList.contains('button-small-primary')).toBe(false)
    await fire.click(button('Add Bill'))
    expect(screen.getByRole('heading', { name: 'Add Bill', level: 1 })).toBeTruthy()
  })
})
