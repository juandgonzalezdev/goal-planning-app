// @vitest-environment jsdom
import { act, cleanup, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { memoryStorage } from './test/memoryStorage'
import { fire, settle, freshDatabaseForEachTest } from './test/space'

freshDatabaseForEachTest()

// Desktop destinations stay in the sidebar; identity and utilities stay in the header.
// Add keeps its own action row at every width, with one instance of each control.
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
  it('keeps identity and Settings in the header, with Add in its own row', async () => {
    screenWidth(true)
    await openAlex()
    expect(document.querySelector('.shell')!.classList.contains('has-sidebar')).toBe(true)
    expect(header().getByRole('button', { name: 'Go to Home' })).toBeTruthy()
    expect(header().getByRole('button', { name: 'Settings' })).toBeTruthy()
    expect(screen.getAllByRole('button', { name: 'Settings' })).toHaveLength(1)
    expect(screen.getAllByRole('button', { name: 'Go to Home' })).toHaveLength(1)
    expect(within(document.querySelector<HTMLElement>('.shell-action-row')!).getByRole('button', { name: 'Add' })).toBeTruthy()
    expect(screen.getByRole('navigation').compareDocumentPosition(screen.getByRole('main')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    // Reading order in the sidebar: five destinations, then Help.
    expect(nav().getAllByRole('button').map(item => (item.getAttribute('aria-label') ?? item.textContent ?? '').trim()))
      .toEqual(['Home', 'Bills', 'Goals', 'Money', 'History', 'Help'])
  })

  it('keeps the single floating rail and its controls in details and Settings', async () => {
    screenWidth(true)
    await openAlex()
    await fire.click(nav().getByRole('button', { name: 'Goals' }))
    await fire.click(button(/^Trip to Japan/))
    expect(document.querySelector('.shell')!.classList.contains('has-sidebar')).toBe(true)
    expect(header().getByRole('button', { name: 'Go to Home' })).toBeTruthy()
    expect(header().getByRole('button', { name: 'Settings' })).toBeTruthy()
    await fire.click(header().getByRole('button', { name: 'Settings' }))
    expect(screen.getByRole('heading', { name: 'Settings', level: 1 })).toBeTruthy()
    expect(screen.getByRole('navigation').querySelector('.nav-destinations [aria-current]')).toBeNull()
    expect(header().getByRole('button', { name: 'Settings' }).getAttribute('aria-current')).toBe('page')
    await fire.click(nav().getByRole('button', { name: 'Help' }))
    expect(screen.getByRole('navigation').querySelector('.nav-destinations [aria-current]')).toBeNull()
    expect(nav().getByRole('button', { name: 'Help' }).getAttribute('aria-current')).toBe('page')
    expect(header().getByRole('button', { name: 'Settings' }).hasAttribute('aria-current')).toBe(false)
    expect(screen.getAllByRole('navigation', { name: 'Main navigation' })).toHaveLength(1)
    expect(screen.getAllByRole('button', { name: 'Go to Home' })).toHaveLength(1)

  })

  it('keeps global controls in the header when the navigation changes width', async () => {
    const width = screenWidth(false)
    await openAlex()
    expect(header().getByRole('button', { name: 'Settings' })).toBeTruthy()
    expect(nav().queryByRole('button', { name: 'Settings' })).toBeNull()
    width.setWide(true)
    expect(header().getByRole('button', { name: 'Settings' })).toBeTruthy()
    expect(screen.getAllByRole('button', { name: 'Settings' })).toHaveLength(1)
    width.setWide(false)
    expect(screen.getAllByRole('button', { name: 'Settings' })).toHaveLength(1)
    expect(header().getByRole('button', { name: 'Go to Home' })).toBeTruthy()
  })
})
