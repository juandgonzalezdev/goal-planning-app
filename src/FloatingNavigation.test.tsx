// @vitest-environment jsdom
import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import App from './App'
import { createLocalStore } from './data/localStore'
import { createDemoHousehold } from './data/fixtures/demoHousehold'
import { BottomNav } from './components/BottomNav'
import { classicHome, memoryStorage } from './test/memoryStorage'
import { fire, freshDatabaseForEachTest, settle } from './test/space'

freshDatabaseForEachTest()
beforeEach(() => window.history.replaceState(null, ''))
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals() })
const nav = () => screen.getByRole('navigation', { name: 'Main navigation' })
const tab = (name: string) => within(nav()).getByRole('button', { name })
const button = (name: string | RegExp) => screen.getByRole('button', { name })
async function openDemo() {
  render(<App storage={classicHome()} getToday={() => '2026-11-05'} />)
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
  expect(nav().querySelector('.nav-destinations [aria-current]')).toBeNull()
  await fire.click(button('Open Help & Guide'))
  expect(nav().querySelector('.nav-destinations [aria-current]')).toBeNull()
  const skip = screen.getByRole('link', { name: 'Skip to content' })
  await fire.click(skip)
  expect(document.activeElement).toBe(screen.getByRole('main'))
  await fire.click(tab('Goals'))
  expect(tab('Goals').getAttribute('aria-current')).toBe('page')
})
it('hides navigation for the keyboard, retains stable reservation through blur/scroll and restores on close; ignores pinch zoom', async () => {
  const viewport = Object.assign(new EventTarget(), { height: 800, offsetTop: 0, scale: 1 })
  vi.stubGlobal('visualViewport', viewport)
  vi.stubGlobal('innerHeight', 800)
  vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(72)
  render(<div className="shell"><input aria-label="Sample field" /><BottomNav current="bills" onSelect={vi.fn()} /></div>)
  const bar = nav()
  const input = screen.getByLabelText('Sample field')
  const reservation = document.documentElement.style.getPropertyValue('--floating-nav-height')
  expect(reservation).toBe('72px')
  await act(async () => input.focus())
  expect(bar.dataset.keyboard).toBe('false')
  await act(async () => { viewport.height = 480; viewport.dispatchEvent(new Event('resize')) })
  expect(bar.dataset.keyboard).toBe('true')
  expect(bar.inert).toBe(true)
  expect(bar.getAttribute('aria-hidden')).toBe('true')
  await act(async () => { input.blur(); viewport.offsetTop = 80; viewport.dispatchEvent(new Event('scroll')) })
  expect(bar.dataset.keyboard).toBe('true')
  expect(document.documentElement.style.getPropertyValue('--floating-nav-height')).toBe(reservation)
  expect(document.documentElement.style.getPropertyValue('--nav-viewport-bottom')).toBe('')
  await act(async () => { viewport.height = 800; viewport.offsetTop = 0; viewport.dispatchEvent(new Event('resize')) })
  expect(bar.dataset.keyboard).toBe('false')
  expect(bar.inert).toBe(false)
  expect(bar.hasAttribute('aria-hidden')).toBe(false)
  await act(async () => { input.focus(); viewport.height = 400; viewport.scale = 2; viewport.dispatchEvent(new Event('resize')) })
  expect(bar.dataset.keyboard).toBe('false')
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
it('cleans up viewport listeners and measured reservation on unmount; ignores non-editable focus', async () => {
  const viewport = Object.assign(new EventTarget(), { height: 450, offsetTop: 20, scale: 1 })
  vi.stubGlobal('visualViewport', viewport)
  vi.stubGlobal('innerHeight', 800)
  const root = document.documentElement
  const previous = root.style.getPropertyValue('--floating-nav-height')
  const remove = vi.spyOn(viewport, 'removeEventListener')
  const view = render(<BottomNav current="goals" onSelect={vi.fn()} />)
  await act(async () => { tab('Goals').focus(); viewport.dispatchEvent(new Event('resize')) })
  expect(root.style.getPropertyValue('--nav-viewport-bottom')).toBe('')
  view.unmount()
  expect(root.style.getPropertyValue('--floating-nav-height')).toBe(previous)
  expect(remove).toHaveBeenCalledWith('resize', expect.any(Function))
})

it('restores the original detail highlight on browser Back and Forward after visiting another destination', async () => {
  await openDemo()
  await fire.click(button(/^Phone & Internet, .*due/))
  await fire.click(tab('History'))
  act(() => window.history.back())
  await waitFor(() => expect(screen.getByRole('heading', { level: 1, name: 'Phone & Internet' })).toBeTruthy())
  expect(screen.getByRole('heading', { level: 1, name: 'Phone & Internet' })).toBeTruthy()
  expect(tab('Home').getAttribute('aria-current')).toBe('page')
  act(() => window.history.forward())
  await waitFor(() => expect(screen.getByRole('heading', { level: 1, name: 'History' })).toBeTruthy())
  expect(screen.getByRole('heading', { level: 1, name: 'History' })).toBeTruthy()
  expect(tab('History').getAttribute('aria-current')).toBe('page')
})


it.each(['bill', 'debt', 'goal', 'emergency', 'new-goal'])('starts at Home consistently after reloading a saved %s step, without restoring an unavailable detail', async destination => {
  const storage = memoryStorage()
  createLocalStore(storage).save(createDemoHousehold())
  window.history.replaceState({ screen: destination, chain: 'cold-visit', idx: 1 }, '')
  render(<App storage={classicHome(storage)} getToday={() => '2026-11-05'} />)
  await settle()
  expect(screen.getByRole('heading', { level: 1, name: 'Home' })).toBeTruthy()
  expect(tab('Home').getAttribute('aria-current')).toBe('page')
  expect(nav().querySelectorAll('[aria-current]')).toHaveLength(1)
})

it('starts the indicator without transitions on mount and when switching to a rail', () => {
  const frames = new Map<number, FrameRequestCallback>()
  let next = 0
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => { frames.set(++next, callback); return next })
  vi.stubGlobal('cancelAnimationFrame', (id: number) => frames.delete(id))
  const view = render(<BottomNav current="bills" onSelect={vi.fn()} />)
  const group = () => nav().querySelector<HTMLElement>('.nav-destinations')!
  expect(group().dataset.ready).toBeUndefined()
  act(() => { for (const [id, callback] of frames) { frames.delete(id); callback(0) } })
  expect(group().dataset.ready).toBe('true')
  view.rerender(<BottomNav current="history" onSelect={vi.fn()} rail />)
  expect(group().dataset.ready).toBeUndefined()
  act(() => { for (const [id, callback] of frames) { frames.delete(id); callback(0) } })
  expect(group().dataset.ready).toBe('true')
})


it.each([
  [800, 0.5, false], [800, 80, false], [800, 120, false], [800, 121, true],
  [800, 300, true], [1600, 200, false], [1600, 240, false], [1600, 300, true],
])('detects keyboard at height %i and gap %s only above the minimum and proportional threshold', async (height, gap, hidden) => {
  const viewport = Object.assign(new EventTarget(), { height: height - gap, offsetTop: 0, scale: 1 })
  vi.stubGlobal('visualViewport', viewport)
  vi.stubGlobal('innerHeight', height)
  render(<><input aria-label="Sample field" /><BottomNav current="bills" onSelect={vi.fn()} /></>)
  const bar = nav()
  const input = screen.getByLabelText('Sample field')
  await act(async () => input.focus())
  expect(bar.dataset.keyboard).toBe(String(hidden))
  await act(async () => input.blur())
  expect(bar.dataset.keyboard).toBe(String(hidden))
  await act(async () => { viewport.height = height - 0.5; viewport.dispatchEvent(new Event('resize')) })
  expect(bar.dataset.keyboard).toBe('false')
  expect(bar.inert).toBe(false)
  expect(bar.hasAttribute('aria-hidden')).toBe(false)
})
