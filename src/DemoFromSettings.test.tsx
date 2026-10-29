// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { browserSpaceStore } from './app/useSpace'
import type { SpaceStore, StoreChange } from './data/spaceStore'
import { createSpaceData } from './domain/finance/space'
import type { FinanceData } from './domain/finance/types'
import { memoryStorage } from './test/memoryStorage'
import { fire, freshDatabaseForEachTest, heldStore, settle, storedSpace } from './test/space'

/*
 * Explore the Demo from Settings (patch 05b). The own space stays exactly
 * as it was saved; nothing goes from it into the demo or back; nothing
 * typed is dropped without a yes; and the demo never opens while a change
 * is being saved.
 */

freshDatabaseForEachTest()
afterEach(() => { cleanup(); vi.restoreAllMocks(); document.documentElement.removeAttribute('data-theme') })

const TODAY = '2026-10-21'
const button = (name: string | RegExp) => screen.getByRole('button', { name })
const field = (label: string | RegExp) => screen.getByLabelText(label) as HTMLInputElement
const alerts = () => screen.queryAllByRole('alert').map(alert => alert.textContent).join(' ')
const statuses = () => screen.queryAllByRole('status').map(status => status.textContent).join(' ')
const tab = (name: string) => within(screen.getByRole('navigation', { name: 'Main navigation' })).getByRole('button', { name })
const step = () => act(async () => { for (let i = 0; i < 5; i++) await new Promise(resolve => setTimeout(resolve, 0)) })
const OWN_HOME = 'Robin · Individual'
const DEMO = 'Demo · Invented data'

function robin(): FinanceData {
  const made = createSpaceData({ mode: 'individual', names: ['Robin'], currency: 'PLN', theme: 'light' })
  if (made.status !== 'created') throw new Error('invalid setup')
  return made.data
}

/** The app on the real store, counting every write this tab sends to it. */
async function openApp(inner: SpaceStore = browserSpaceStore(memoryStorage()), storage: Storage = memoryStorage()) {
  const writes: string[] = []
  const store: SpaceStore = {
    ...inner,
    create: data => { writes.push('create'); return inner.create(data) },
    save: (data, base) => { writes.push('save'); return inner.save(data, base) },
    erase: () => { writes.push('erase'); return inner.erase() },
    useOlderCopy: () => { writes.push('useOlderCopy'); return inner.useOlderCopy() },
  }
  render(<App getToday={() => TODAY} storage={storage} createStore={() => store} />)
  await settle()
  return { writes, storage }
}

/** Everything this device keeps: the database (every store, as stored) and localStorage. */
async function snapshot(storage: Storage) {
  const copies = await browserSpaceStore(storage).exportCopies()
  const local = Object.fromEntries(Array.from({ length: storage.length }, (_, i) => storage.key(i)!).map(key => [key, storage.getItem(key)]))
  return JSON.stringify({ copies, local })
}

async function exploreFromSettings() {
  await fire.click(button('Settings'))
  await fire.click(button('Explore the Demo'))
}

const exitDemo = () => fire.click(within(screen.getByRole('note')).getByRole('button', { name: 'Exit Demo' }))

describe('Explore the Demo from Settings', () => {
  it('leaves the own space byte for byte as it was, after changing the demo, resetting it and leaving; the demo writes nothing', async () => {
    await browserSpaceStore(memoryStorage()).create(robin())
    const storage = memoryStorage()
    const { writes } = await openApp(undefined, storage)
    // The own space's screen preferences on this device.
    await fire.click(button('Hide All Amounts'))
    await fire.click(tab('Bills'))
    await fire.click(button('List'))
    const before = await snapshot(storage)
    writes.length = 0

    await exploreFromSettings()
    expect(screen.getByText(DEMO)).toBeTruthy()
    // Nothing of the own space in the demo: Alex's preferences (amounts shown), the demo's first Bills view.
    expect(button('Hide All Amounts')).toBeTruthy()
    await fire.click(tab('Bills'))
    expect(button('Calendar').getAttribute('aria-pressed')).toBe('true')
    // Change the demo: records, screen preferences and choices.
    await fire.click(button('List'))
    await fire.click(tab('Home'))
    await fire.click(button('Hide All Amounts'))
    await fire.click(button('Settings'))
    await fire.change(field('Appearance'), { target: { value: 'dark' } })
    await fire.click(within(screen.getByRole('note')).getByRole('button', { name: 'Reset Demo' }))
    await fire.click(within(screen.getByRole('note')).getByRole('button', { name: /Reset/ }))
    expect(screen.getByText(DEMO)).toBeTruthy()
    // Reset Demo also puts Alex's screen preferences back.
    await fire.click(button('Go to Home'))
    expect(button('Hide All Amounts')).toBeTruthy()
    await fire.click(button('Hide All Amounts'))
    await exitDemo()

    // Back on the own Home, opened again from the store, with its own preferences and Bills view.
    expect(screen.getByText(OWN_HOME)).toBeTruthy()
    expect(screen.getByRole('heading', { level: 1 }).textContent).not.toBe('Your goals, your way.')
    expect(button('Show All Amounts')).toBeTruthy()
    await fire.click(tab('Bills'))
    expect(button('List').getAttribute('aria-pressed')).toBe('true')
    expect(writes).toEqual([])
    expect(await snapshot(storage)).toBe(before)
  })

  it('when another tab saves while the demo is open, leaving it shows that version, and the demo wrote nothing', async () => {
    await browserSpaceStore(memoryStorage()).create(robin())
    const { writes } = await openApp()
    writes.length = 0
    await exploreFromSettings()
    const other = browserSpaceStore(memoryStorage())
    const loaded = await other.load()
    if (loaded.status !== 'loaded') throw new Error('nothing saved')
    await other.save({ ...loaded.space.data, space: { ...loaded.space.data.space, name: 'Robin (other tab)' } }, loaded.space.revision)
    const saved = await storedSpace()
    expect(screen.getByText(DEMO)).toBeTruthy()
    await exitDemo()
    expect(screen.getByText('Robin (other tab) · Individual')).toBeTruthy()
    expect(writes).toEqual([])
    expect(await storedSpace()).toEqual(saved)
  })

  it('when another tab erases the space while the demo is open, leaving it shows Welcome with the reason', async () => {
    await browserSpaceStore(memoryStorage()).create(robin())
    await openApp()
    await exploreFromSettings()
    await browserSpaceStore(memoryStorage()).erase()
    await exitDemo()
    expect(screen.getByRole('heading', { name: 'Your goals, your way.' })).toBeTruthy()
    expect(statuses()).toContain('Your space was erased in another tab.')
  })

  it('does not open while a change is being saved, and that save is not cancelled', async () => {
    const held = heldStore()
    await held.store.create(robin())
    render(<App getToday={() => TODAY} storage={memoryStorage()} createStore={() => held.store} />)
    await settle()
    await fire.click(button('Settings'))
    held.hold()
    fireEvent.change(field('Appearance'), { target: { value: 'dark' } })
    await step()
    expect(button('Explore the Demo').getAttribute('aria-disabled')).toBe('true')
    expect(screen.getByText('Wait until your last change is saved.')).toBeTruthy()
    fireEvent.click(button('Explore the Demo'))
    await step()
    expect(screen.queryByText(DEMO)).toBeNull()
    await held.release()
    await settle()
    expect((await storedSpace())?.data.preferences.theme).toBe('dark')
    expect(button('Explore the Demo').getAttribute('aria-disabled')).toBeNull()
    await fire.click(button('Explore the Demo'))
    expect(screen.getByText(DEMO)).toBeTruthy()
  })

  it('asks before dropping the New Goal draft, even with its screen closed; Keep Editing keeps it', async () => {
    await browserSpaceStore(memoryStorage()).create(robin())
    await openApp()
    await fire.click(button(/Add Goal/))
    await fire.change(field('What are you saving for?'), { target: { value: 'Sailing trip' } })
    await fire.click(button('Go to Home'))
    await exploreFromSettings()
    expect(alerts()).toContain('Opening the demo closes what you typed here.')
    expect(alerts()).toContain('Not saved here: New Goal.')
    expect(screen.queryByText(DEMO)).toBeNull()
    // Copy What I Typed, with the text to select when the browser does not allow copying.
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: async () => { throw new Error('not allowed') } }, configurable: true })
    await fire.click(button('Copy What I Typed'))
    expect((screen.getByLabelText('What you typed. Select it and copy it.') as HTMLTextAreaElement).value).toContain('Name: Sailing trip')
    await fire.click(button('Keep Editing'))
    expect(screen.queryByText(DEMO)).toBeNull()
    await fire.click(button('Go to Home'))
    await fire.click(button(/Add Goal/))
    expect(field('What are you saving for?').value).toBe('Sailing trip')
  })

  it('opens the demo only after Discard and Open Demo, and the draft never reaches the demo or comes back', async () => {
    await browserSpaceStore(memoryStorage()).create(robin())
    await openApp()
    await fire.click(button(/Add Goal/))
    await fire.change(field('What are you saving for?'), { target: { value: 'Sailing trip' } })
    await fire.click(button('Go to Home'))
    await exploreFromSettings()
    await fire.click(button('Discard and Open Demo'))
    expect(screen.getByText(DEMO)).toBeTruthy()
    await fire.click(button(/Add Goal/))
    expect(field('What are you saving for?').value).toBe('')
    await fire.click(button('Go to Home'))
    await exitDemo()
    expect(screen.getByText(OWN_HOME)).toBeTruthy()
    await fire.click(button(/Add Goal/))
    expect(field('What are you saving for?').value).toBe('')
  })

  it('also asks when what was typed is kept as "(closed)" after a change in another tab', async () => {
    await browserSpaceStore(memoryStorage()).create(robin())
    let listener: ((change: StoreChange) => void) | null = null
    const inner = browserSpaceStore(memoryStorage())
    render(<App getToday={() => TODAY} storage={memoryStorage()} createStore={() => ({ ...inner, watch: onChange => { listener = onChange; return () => { listener = null } } })} />)
    await settle()
    await fire.click(tab('Data'))
    await fire.click(button(/^Accounts & Balances/))
    await fire.click(button('Add Account'))
    await fire.change(field('Account Name'), { target: { value: 'Holiday pot' } })
    const other = browserSpaceStore(memoryStorage())
    const loaded = await other.load()
    if (loaded.status !== 'loaded') throw new Error('nothing saved')
    const saved = await other.save({ ...loaded.space.data, space: { ...loaded.space.data.space, name: 'Robin (other tab)' } }, loaded.space.revision)
    if (saved.status !== 'saved') throw new Error('not saved')
    act(() => listener?.({ kind: 'saved', spaceId: loaded.space.data.space.id, revision: saved.revision }))
    await settle()
    await fire.click(button('Cancel'))
    expect(alerts()).toContain('Add account (closed)')
    await exploreFromSettings()
    expect(alerts()).toContain('Opening the demo closes what you typed here.')
    expect(screen.queryByText(DEMO)).toBeNull()
    await fire.click(button('Discard and Open Demo'))
    expect(screen.getByText(DEMO)).toBeTruthy()
  })

  it('asks before Exit Demo drops what was typed in the demo; Keep Editing keeps it', async () => {
    await browserSpaceStore(memoryStorage()).create(robin())
    await openApp()
    await exploreFromSettings()
    await fire.click(tab('Data'))
    await fire.click(button(/^Accounts & Balances/))
    await fire.click(button('Add Account'))
    await fire.change(field('Account Name'), { target: { value: 'Demo pot' } })
    await exitDemo()
    expect(alerts()).toContain('Leaving the demo closes what you typed in it.')
    await fire.click(button('Keep Editing'))
    expect(field('Account Name').value).toBe('Demo pot')
    expect(screen.getByText(DEMO)).toBeTruthy()
    await exitDemo()
    await fire.click(button('Discard and Exit Demo'))
    expect(screen.getByText(OWN_HOME)).toBeTruthy()
  })

  it('also asks before Exit Demo in Settings', async () => {
    await browserSpaceStore(memoryStorage()).create(robin())
    await openApp()
    await exploreFromSettings()
    await fire.click(button(/Add Goal/))
    await fire.change(field('What are you saving for?'), { target: { value: 'Demo goal' } })
    await fire.click(button('Settings'))
    await fire.click(within(screen.getByRole('main')).getByRole('button', { name: 'Exit Demo' }))
    expect(alerts()).toContain('Leaving the demo closes what you typed in it.')
    await fire.click(button('Discard and Exit Demo'))
    expect(screen.getByText(OWN_HOME)).toBeTruthy()
  })

  it('keeps the own month: the demo shows its own, and leaving gives the own one back', async () => {
    await browserSpaceStore(memoryStorage()).create(robin())
    await openApp()
    await fire.click(button('Previous month'))
    const ownMonth = (screen.getAllByLabelText('Month').find(element => element.tagName === 'SELECT') as HTMLSelectElement).value
    expect(ownMonth).toBe('2026-09')
    await exploreFromSettings()
    const demoMonth = (screen.getAllByLabelText('Month').find(element => element.tagName === 'SELECT') as HTMLSelectElement).value
    expect(demoMonth).not.toBe(ownMonth)
    await exitDemo()
    expect((screen.getAllByLabelText('Month').find(element => element.tagName === 'SELECT') as HTMLSelectElement).value).toBe(ownMonth)
  })

  it('opens while the space can only be shown, and leaving it shows that warning again', async () => {
    const inner = browserSpaceStore(memoryStorage())
    const store: SpaceStore = { ...inner, load: async () => ({ status: 'read-only', space: { data: robin(), revision: 0 }, mayBeOutdated: true }) }
    await openApp(store)
    expect(alerts()).toContain('Read-only.')
    await exploreFromSettings()
    expect(screen.getByText(DEMO)).toBeTruthy()
    expect(alerts()).not.toContain('Read-only.')
    await exitDemo()
    expect(alerts()).toContain('Read-only.')
    expect(screen.getByText(OWN_HOME)).toBeTruthy()
  })

  it('is not offered inside the demo, and the demo from Welcome still goes back to Welcome', async () => {
    await openApp()
    await fire.click(button('Explore the App'))
    await fire.click(button('Settings'))
    expect(screen.queryByRole('button', { name: 'Explore the Demo' })).toBeNull()
    await exitDemo()
    expect(screen.getByRole('heading', { name: 'Your goals, your way.' })).toBeTruthy()
  })
})
