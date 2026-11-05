// @vitest-environment jsdom
import { act, cleanup, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { memoryStorage } from './test/memoryStorage'
import { fire, settle, freshDatabaseForEachTest } from './test/space'

freshDatabaseForEachTest()

// Desktop and phone layouts (Rumbo de diseño, item 1): from 1024 px the five tabs are a sidebar with
// the logo on top and Settings at the end, and the header keeps only + Add; below, the header has the
// logo and the gear. Each control is in the page once (not hidden twice). The widths themselves, the
// two columns of Home and the order of its areas are checked in Chromium (see the delivery's walk).
const realMatchMedia = window.matchMedia
afterEach(() => { cleanup(); vi.restoreAllMocks(); window.matchMedia = realMatchMedia })

const button = (name: string | RegExp) => screen.getByRole('button', { name })
const header = () => within(document.querySelector<HTMLElement>('.shell-header')!)
const nav = () => within(screen.getByRole('navigation', { name: 'Main navigation' }))

/** A screen that is `wide` (1024 px or more) until `setWide` changes it, as a window being resized. */
function screenWidth(wide: boolean) {
  const listeners = new Set<() => void>()
  let matches = wide
  window.matchMedia = ((query: string) => ({
    get matches() { return query === '(min-width: 1024px)' ? matches : false },
    media: query,
    addEventListener: (_: string, listener: () => void) => listeners.add(listener),
    removeEventListener: (_: string, listener: () => void) => listeners.delete(listener),
  })) as unknown as typeof window.matchMedia
  return { setWide: (next: boolean) => act(() => { matches = next; listeners.forEach(listener => listener()) }) }
}

async function openAlex() {
  render(<App getToday={() => '2026-10-25'} storage={memoryStorage()} />)
  await settle()
  await fire.click(button('Explore the App'))
}

describe('Sidebar on wide screens', () => {
  it('puts the logo and Settings in the sidebar, once, and keeps + Add in the header', async () => {
    screenWidth(true)
    await openAlex()
    expect(document.querySelector('.shell')!.classList.contains('has-sidebar')).toBe(true)
    expect(nav().getByRole('button', { name: 'Go to Home' })).toBeTruthy()
    expect(nav().getByRole('button', { name: 'Settings' })).toBeTruthy()
    expect(screen.getAllByRole('button', { name: 'Settings' })).toHaveLength(1)
    expect(screen.getAllByRole('button', { name: 'Go to Home' })).toHaveLength(1)
    expect(header().getByRole('button', { name: 'Add' })).toBeTruthy()
    expect(screen.getByRole('navigation').compareDocumentPosition(screen.getByRole('main')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    // Reading order in the sidebar: the logo, the five tabs, then Help and Settings.
    expect(nav().getAllByRole('button').map(item => (item.getAttribute('aria-label') ?? item.textContent ?? '').trim()))
      .toEqual(['Go to Home', 'Home', 'Bills', 'Goals', 'Money', 'History', 'Help', 'Settings'])
  })

  it('keeps the single floating rail and its controls in details and Settings', async () => {
    screenWidth(true)
    await openAlex()
    await fire.click(nav().getByRole('button', { name: 'Goals' }))
    await fire.click(button(/^Trip to Japan/))
    expect(document.querySelector('.shell')!.classList.contains('has-sidebar')).toBe(true)
    expect(nav().getByRole('button', { name: 'Go to Home' })).toBeTruthy()
    expect(nav().getByRole('button', { name: 'Settings' })).toBeTruthy()
    await fire.click(nav().getByRole('button', { name: 'Settings' }))
    expect(screen.getByRole('heading', { name: 'Settings', level: 1 })).toBeTruthy()
    expect(screen.getByRole('navigation').querySelector('.nav-destinations [aria-current]')).toBeNull()
    expect(nav().getByRole('button', { name: 'Settings' }).getAttribute('aria-current')).toBe('page')
    await fire.click(nav().getByRole('button', { name: 'Help' }))
    expect(screen.getByRole('navigation').querySelector('.nav-destinations [aria-current]')).toBeNull()
    expect(nav().getByRole('button', { name: 'Help' }).getAttribute('aria-current')).toBe('page')
    expect(nav().getByRole('button', { name: 'Settings' }).hasAttribute('aria-current')).toBe(false)
    expect(screen.getAllByRole('navigation', { name: 'Main navigation' })).toHaveLength(1)
    expect(screen.getAllByRole('button', { name: 'Go to Home' })).toHaveLength(1)

  })

  it('moves the controls when the window changes width, without doubling them', async () => {
    const width = screenWidth(false)
    await openAlex()
    expect(header().getByRole('button', { name: 'Settings' })).toBeTruthy()
    expect(nav().queryByRole('button', { name: 'Settings' })).toBeNull()
    width.setWide(true)
    expect(header().queryByRole('button', { name: 'Settings' })).toBeNull()
    expect(screen.getAllByRole('button', { name: 'Settings' })).toHaveLength(1)
    width.setWide(false)
    expect(screen.getAllByRole('button', { name: 'Settings' })).toHaveLength(1)
    expect(header().getByRole('button', { name: 'Go to Home' })).toBeTruthy()
  })
})
