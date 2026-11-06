// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import App from './App'
import { createDemoHousehold } from './data/fixtures/demoHousehold'
import { memoryStorage } from './test/memoryStorage'
import { fire, freshDatabaseForEachTest, settle } from './test/space'

freshDatabaseForEachTest()
beforeEach(() => window.history.replaceState(null, ''))
afterEach(() => {
  cleanup()
  Reflect.deleteProperty(document, 'scrollingElement')
  Reflect.deleteProperty(document.documentElement, 'scrollTo')
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})
const button = (name: string | RegExp) => screen.getByRole('button', { name })
const tab = (name: string) => within(screen.getByRole('navigation', { name: 'Main navigation' })).getByRole('button', { name })
async function start(rail: boolean, reduced: boolean) {
  vi.stubGlobal('matchMedia', (query: string) => ({ matches: query.includes('1024px') ? rail : query.includes('reduced-motion') && reduced, addEventListener: vi.fn(), removeEventListener: vi.fn() }))
  // jsdom has no layout/scrollingElement. Model the document scroller separately
  // from window.scrollY and the rail: only this element may receive top requests.
  const root = document.documentElement
  const scroll = vi.fn((options: ScrollToOptions) => { root.scrollTop = options.top ?? root.scrollTop })
  Object.defineProperty(document, 'scrollingElement', { configurable: true, value: root })
  Object.defineProperty(root, 'scrollTo', { configurable: true, value: scroll })
  const data = createDemoHousehold()
  const before = structuredClone(data)
  render(<App storage={memoryStorage()} createDemo={() => ({ data, today: '2026-11-05' })} getToday={() => '2026-11-05'} />)
  await settle()
  await fire.click(button('Explore the App'))
  return { root, scroll, data, before }
}

it.each([false, true])('opens each selected section at the document top, rail=%s', async rail => {
  const { root, scroll, data, before } = await start(rail, false)
  for (const name of ['Bills', 'Goals', 'Money', 'History', 'Home']) {
    root.scrollTop = 600
    scroll.mockClear()
    await fire.click(tab(name))
    expect(scroll).toHaveBeenLastCalledWith({ top: 0, left: 0, behavior: 'instant' })
    expect(root.scrollTop).toBe(0)
    expect(document.activeElement).toBe(screen.getByRole('heading', { name: name === 'Goals' ? 'Our Goals' : name, level: 1 }))
  }
  expect(data).toEqual(before)
})

it.each([false, true].flatMap(rail => [false, true].map(reduced => [rail, reduced])))('reselects without navigation or losing view state, rail=%s reduced=%s', async (rail, reduced) => {
  const { root, scroll, data, before } = await start(rail, reduced)
  await fire.click(tab('Bills'))
  await fire.click(button('List'))
  await fire.change(screen.getByRole('combobox', { name: 'Month' }), { target: { value: '2026-12' } })
  const input = screen.getByRole('searchbox', { name: 'Search bills' }) as HTMLInputElement
  await fire.change(input, { target: { value: 'loan' } })
  const historyLength = window.history.length
  const heading = screen.getByRole('heading', { level: 1, name: 'Bills' })
  root.scrollTop = 700
  scroll.mockClear()
  tab('Bills').focus()
  await fire.click(tab('Bills'))
  expect(scroll).toHaveBeenCalledExactlyOnceWith({ top: 0, left: 0, behavior: reduced ? 'instant' : 'smooth' })
  expect(document.activeElement).toBe(tab('Bills'))
  expect(window.history.length).toBe(historyLength)
  expect(screen.getByRole('heading', { level: 1, name: 'Bills' })).toBe(heading)
  expect(input.value).toBe('loan')
  expect((screen.getByRole('combobox', { name: 'Month' }) as HTMLSelectElement).value).toBe('2026-12')
  expect(button('List').getAttribute('aria-pressed')).toBe('true')
  expect(data).toEqual(before)
})

it('does not scroll on cancelled navigation and scrolls only after discard is accepted', async () => {
  const { root, scroll } = await start(false, false)
  await fire.click(tab('Bills'))
  await fire.click(button('Add Bill'))
  await fire.change(screen.getByRole('textbox', { name: 'Bill name' }), { target: { value: 'Sample Service' } })
  root.scrollTop = 640
  scroll.mockClear()
  await fire.click(tab('Goals'))
  expect(scroll).not.toHaveBeenCalled()
  await fire.click(button('Keep Editing'))
  expect(scroll).not.toHaveBeenCalled()
  expect(root.scrollTop).toBe(640)
  expect((screen.getByRole('textbox', { name: 'Bill name' }) as HTMLInputElement).value).toBe('Sample Service')
  await fire.click(tab('Goals'))
  await fire.click(button('Discard and Leave'))
  expect(scroll).toHaveBeenCalledExactlyOnceWith({ top: 0, left: 0, behavior: 'instant' })
  expect(root.scrollTop).toBe(0)
})
