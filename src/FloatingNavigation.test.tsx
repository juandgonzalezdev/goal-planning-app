// @vitest-environment jsdom
import { act, cleanup, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import App from './App'
import { BottomNav } from './components/BottomNav'
import { memoryStorage } from './test/memoryStorage'
import { fire, freshDatabaseForEachTest, settle } from './test/space'

freshDatabaseForEachTest()
beforeEach(() => window.history.replaceState(null, ''))
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals() })
const nav = () => screen.getByRole('navigation', { name: 'Main navigation' })
const tab = (name: string) => within(nav()).getByRole('button', { name })
const button = (name: string | RegExp) => screen.getByRole('button', { name })
async function openDemo() {
  render(<App storage={memoryStorage()} getToday={() => '2026-11-05'} />)
  await settle()
  await fire.click(button('Explore the App'))
}
async function openBill() {
  await fire.click(tab('Bills'))
  await fire.click(button('List'))
  await fire.click(button('Gym Membership details'))
}
it('names all five destinations, gives each a decorative icon and marks only the controlled active destination', async () => {
  const selected = vi.fn()
  const view = render(<BottomNav current="home" onSelect={selected} />)
  const destinations = within(nav()).getAllByRole('button')
  expect(destinations.map(b => b.textContent)).toEqual(['Home', 'Bills', 'Goals', 'Money', 'History'])
  for (const destination of destinations) expect(destination.querySelector('svg[aria-hidden="true"][focusable="false"]')).toBeTruthy()
  await fire.click(tab('Bills'))
  expect(selected).toHaveBeenCalledWith('bills')
  expect(tab('Home').getAttribute('aria-current')).toBe('page')
  view.rerender(<BottomNav current="bills" onSelect={selected} />)
  expect(nav().querySelectorAll('[aria-current="page"]')).toHaveLength(1)
  expect(tab('Bills').getAttribute('aria-current')).toBe('page')
})
it('keeps all destinations in bill details and preserves End Subscription and the origin highlight', async () => {
  await openDemo()
  await openBill()
  expect(screen.getByRole('heading', { name: 'Manage Subscription' })).toBeTruthy()
  expect(button('End Subscription')).toBeTruthy()
  expect(tab('Bills').getAttribute('aria-current')).toBe('page')
  await fire.click(tab('History'))
  expect(screen.getByRole('heading', { level: 1, name: 'History' })).toBeTruthy()
  expect(tab('History').getAttribute('aria-current')).toBe('page')
})
it('keeps the Home origin highlighted when a bill is opened from Home, without changing Back behavior', async () => {
  await openDemo()
  await fire.click(button(/^Phone & Internet, .*due/))
  expect(tab('Home').getAttribute('aria-current')).toBe('page')
  await fire.click(button('Back'))
  expect(screen.getByRole('heading', { level: 1, name: 'Home' })).toBeTruthy()
})
it('guards edited bill details when leaving through the floating nav, keeps fields on Escape and discards only after confirmation', async () => {
  await openDemo()
  await openBill()
  await fire.click(button('Edit Details'))
  const name = screen.getByLabelText('Bill name') as HTMLInputElement
  await fire.change(name, { target: { value: 'Sample Membership' } })
  await fire.click(tab('History'))
  let dialog = screen.getByRole('alertdialog', { name: 'Leave without saving?' })
  await fire.keyDown(dialog, { key: 'Escape' })
  expect((screen.getByLabelText('Bill name') as HTMLInputElement).value).toBe('Sample Membership')
  await fire.click(tab('History'))
  dialog = screen.getByRole('alertdialog', { name: 'Leave without saving?' })
  await fire.click(within(dialog).getByRole('button', { name: 'Discard and Leave' }))
  expect(screen.getByRole('heading', { level: 1, name: 'History' })).toBeTruthy()
})
it('keeps navigation in Settings and Help, after the main content in reading order, with a working skip link', async () => {
  await openDemo()
  await fire.click(button('Settings'))
  expect(nav().compareDocumentPosition(screen.getByRole('main')) & Node.DOCUMENT_POSITION_PRECEDING).toBeTruthy()
  const skip = screen.getByRole('link', { name: 'Skip to content' })
  await fire.click(skip)
  expect(document.activeElement).toBe(screen.getByRole('main'))
  await fire.click(tab('Goals'))
  expect(tab('Goals').getAttribute('aria-current')).toBe('page')
})
it('lifts the nav above a reduced visual viewport only while an editable field is focused, then resets on blur', async () => {
  const viewport = Object.assign(new EventTarget(), { height: 480, offsetTop: 0, scale: 1 })
  vi.stubGlobal('visualViewport', viewport)
  vi.stubGlobal('innerHeight', 800)
  render(<div className="shell"><input aria-label="Sample field" /><BottomNav current="bills" onSelect={vi.fn()} /></div>)
  const input = screen.getByLabelText('Sample field')
  await act(async () => { input.focus(); viewport.dispatchEvent(new Event('resize')) })
  expect(document.documentElement.style.getPropertyValue('--nav-viewport-bottom')).toBe('320px')
  await act(async () => input.blur())
  expect(document.documentElement.style.getPropertyValue('--nav-viewport-bottom')).toBe('0px')
  await act(async () => { input.focus(); viewport.scale = 2; viewport.dispatchEvent(new Event('resize')) })
  expect(document.documentElement.style.getPropertyValue('--nav-viewport-bottom')).toBe('0px')
})

it('preserves the Goals origin in a goal detail and lets the user move directly to Money', async () => {
  await openDemo()
  await fire.click(tab('Goals'))
  await fire.click(button(/^Trip to Japan/))
  expect(tab('Goals').getAttribute('aria-current')).toBe('page')
  await fire.click(tab('Money'))
  expect(screen.getByRole('heading', { level: 1, name: 'Money' })).toBeTruthy()
  expect(tab('Money').getAttribute('aria-current')).toBe('page')
})
it('restores viewport CSS when navigation unmounts and does not lift for non-editable focus', async () => {
  const viewport = Object.assign(new EventTarget(), { height: 450, offsetTop: 20, scale: 1 })
  vi.stubGlobal('visualViewport', viewport)
  vi.stubGlobal('innerHeight', 800)
  const root = document.documentElement
  const previous = root.style.getPropertyValue('--nav-viewport-bottom')
  const view = render(<BottomNav current="goals" onSelect={vi.fn()} />)
  await act(async () => { tab('Goals').focus(); viewport.dispatchEvent(new Event('resize')) })
  expect(root.style.getPropertyValue('--nav-viewport-bottom')).toBe('0px')
  view.unmount()
  expect(root.style.getPropertyValue('--nav-viewport-bottom')).toBe(previous)
})

it('restores the original detail highlight on browser Back and Forward after visiting another destination', async () => {
  await openDemo()
  await fire.click(button(/^Phone & Internet, .*due/))
  await fire.click(tab('History'))
  await act(async () => { window.history.back(); await new Promise(resolve => setTimeout(resolve, 25)) })
  await settle()
  expect(screen.getByRole('heading', { level: 1, name: 'Phone & Internet' })).toBeTruthy()
  expect(tab('Home').getAttribute('aria-current')).toBe('page')
  await act(async () => { window.history.forward(); await new Promise(resolve => setTimeout(resolve, 25)) })
  await settle()
  expect(screen.getByRole('heading', { level: 1, name: 'History' })).toBeTruthy()
  expect(tab('History').getAttribute('aria-current')).toBe('page')
})
