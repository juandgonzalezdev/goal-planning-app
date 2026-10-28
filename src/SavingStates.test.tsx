// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { browserSpaceStore } from './app/useSpace'
import type { SpaceStore } from './data/spaceStore'
import { createSpaceData } from './domain/finance/space'
import type { FinanceData } from './domain/finance/types'
import { memoryStorage } from './test/memoryStorage'
import { fire, freshDatabaseForEachTest, heldStore, refuseWrites, settle, storedData } from './test/space'

/*
 * What the screens show while the space opens and saves, and when the
 * store says no: nothing looks saved that was not, nothing typed is lost,
 * and no problem is ever shown as an empty device.
 */

freshDatabaseForEachTest()
afterEach(() => { cleanup(); vi.restoreAllMocks(); document.documentElement.removeAttribute('data-theme') })

const TODAY = '2026-10-21'
const button = (name: string | RegExp) => screen.getByRole('button', { name })
const field = (label: string | RegExp) => screen.getByLabelText(label) as HTMLInputElement
const alerts = () => screen.queryAllByRole('alert').map(alert => alert.textContent).join(' ')
const statuses = () => screen.queryAllByRole('status').map(status => status.textContent).join(' ')
const welcome = () => screen.queryByRole('heading', { name: 'Your goals, your way.' })
/** A few turns of the page, for while a held call keeps `settle` from ever being quiet. */
const step = () => act(async () => { for (let i = 0; i < 5; i++) await new Promise(resolve => setTimeout(resolve, 0)) })

function robin(name = 'Robin'): FinanceData {
  const made = createSpaceData({ mode: 'individual', names: [name], currency: 'PLN', theme: 'light' })
  if (made.status !== 'created') throw new Error('invalid setup')
  return made.data
}

async function start(store?: SpaceStore, storage: Storage = memoryStorage()) {
  render(<App getToday={() => TODAY} storage={storage} createStore={store ? () => store : undefined} />)
  await settle()
}

/** Welcome → Welcome Setup, up to the last step, as Robin. */
async function setUpTo(name = 'Robin') {
  await fire.click(button(/Create Account/))
  await fire.click(button(/Continue Without an Account/))
  await fire.change(field('Display Name'), { target: { value: name } })
  await fire.click(button(/Continue/))
  await fire.click(button(/Continue/))
  await fire.click(button(/Continue/))
}

async function openSettings() {
  await fire.click(button('Settings'))
}

describe('opening', () => {
  it('says the space is opening, and never shows Welcome before the answer', async () => {
    const held = heldStore()
    await held.store.create(robin())
    held.hold()
    render(<App getToday={() => TODAY} storage={memoryStorage()} createStore={() => held.store} />)
    await step()
    expect(screen.getByText('Opening your space…')).toBeTruthy()
    expect(welcome()).toBeNull()
    expect(screen.queryByRole('button', { name: /Create Account/ })).toBeNull()
    await held.release()
    await settle()
    expect(screen.getByText('Robin · Individual')).toBeTruthy()
  })

  it('offers Try Again when opening takes longer than usual', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    try {
      const held = heldStore()
      held.hold()
      render(<App getToday={() => TODAY} storage={memoryStorage()} createStore={() => held.store} />)
      await act(async () => { vi.advanceTimersByTime(5000) })
      expect(screen.getByText('This is taking longer than usual.')).toBeTruthy()
      expect(button('Try Again')).toBeTruthy()
      expect(welcome()).toBeNull()
    } finally {
      vi.useRealTimers()
    }
  })
})

describe('read-only', () => {
  const readOnlyStore = (space: FinanceData | null): SpaceStore => ({
    load: async () => ({ status: 'read-only', space: space && { data: space, revision: 0 }, mayBeOutdated: true }),
    create: vi.fn(async () => ({ status: 'failed' as const })),
    save: vi.fn(async () => ({ status: 'failed' as const })),
    erase: vi.fn(async () => ({ status: 'failed' as const })),
    useOlderCopy: vi.fn(async () => ({ status: 'failed' as const })),
    exportCopies: async () => ({ database: null, olderCopy: null, erasedMark: false }),
    watch: () => () => {},
  })

  it('shows the older copy to look at and download, but changes nothing', async () => {
    const store = readOnlyStore(robin())
    await start(store)
    expect(alerts()).toContain('Read-only. This browser cannot save safely here. This may be an older copy of your space.')
    expect(button('Try Again')).toBeTruthy()
    expect(screen.getByText('Robin · Individual')).toBeTruthy()
    // Settings: no theme change, no erase.
    await openSettings()
    expect(button('Erase All Data on This Device').hasAttribute('disabled') || button('Erase All Data on This Device').getAttribute('aria-disabled') === 'true').toBe(true)
    await fire.change(field('Appearance'), { target: { value: 'dark' } })
    expect(alerts()).toContain('Not saved: this browser can only show your space right now.')
    await fire.click(button('Back'))
    // Data: Download Backup is still there and usable.
    await fire.click(within(screen.getByRole('navigation', { name: 'Main navigation' })).getByRole('button', { name: 'Data' }))
    await fire.click(button(/^Reports & Backup/))
    expect(button('Download Backup').getAttribute('aria-disabled')).toBeNull()
    expect(store.save).not.toHaveBeenCalled()
    expect(store.erase).not.toHaveBeenCalled()
  })

  it('without a copy, says so on Welcome and does not let a space be started', async () => {
    const store = readOnlyStore(null)
    await start(store)
    expect(welcome()).toBeTruthy()
    expect(alerts()).toContain('This browser cannot save safely here, so a new space cannot be started.')
    expect((button(/Create Account/) as HTMLButtonElement).disabled).toBe(true)
    expect(store.create).not.toHaveBeenCalled()
  })

  it('stops saving, with the reason, when a newer version of the app takes the database over', async () => {
    let tellChange: (change: { kind: 'closed' }) => void = () => {}
    const inner = browserSpaceStore(memoryStorage())
    await inner.create(robin())
    await start({ ...inner, watch: onChange => { tellChange = onChange; return () => {} } })
    expect(screen.getByText('Robin · Individual')).toBeTruthy()
    act(() => tellChange({ kind: 'closed' }))
    expect(alerts()).toContain('A newer version of the app was opened in another tab, so nothing more is saved here.')
    expect(screen.getByText('Robin · Individual')).toBeTruthy()
    await openSettings()
    await fire.change(field('Appearance'), { target: { value: 'dark' } })
    expect(alerts()).toContain('Not saved: this browser can only show your space right now.')
    expect((await storedData())?.preferences.theme).toBe('light')
  })
})

describe('saving', () => {
  it('shows Saving…, holds the button, and creates the space once on a double click', async () => {
    const held = heldStore()
    await start(held.store)
    await setUpTo()
    held.hold()
    fireEvent.click(button('Create My Space'))
    await step()
    expect(statuses()).toContain('Saving…')
    expect(button('Saving…').getAttribute('aria-disabled')).toBe('true')
    fireEvent.click(button('Saving…'))
    await step()
    await held.release()
    await settle()
    expect(held.calls.filter(call => call === 'create')).toHaveLength(1)
    expect(screen.getByText('Robin · Individual')).toBeTruthy()
    expect(statuses()).not.toContain('Saving…')
  })

  it('keeps the setup as typed when the browser does not save, and creates it on Try Again', async () => {
    await start()
    await setUpTo()
    refuseWrites()
    await fire.click(button('Create My Space'))
    expect(alerts()).toContain('This browser did not save it. Nothing was changed. Try again.')
    expect(screen.queryByText('Robin · Individual')).toBeNull()
    vi.restoreAllMocks()
    await fire.click(button('Create My Space'))
    expect(screen.getByText('Robin · Individual')).toBeTruthy()
    expect((await storedData())?.space.members[0].name).toBe('Robin')
  })

  it('keeps a goal being created on screen when it is not saved', async () => {
    await start()
    await setUpTo()
    await fire.click(button('Create My Space'))
    await fire.click(within(screen.getByRole('region', { name: 'My Goals' })).getByRole('button', { name: /View All/ }))
    await fire.click(button(/Add Goal/))
    await fire.change(field('What are you saving for?'), { target: { value: 'Laptop' } })
    await fire.change(field(/^Target Amount/), { target: { value: '4000' } })
    await fire.click(button('Review Goal'))
    refuseWrites()
    await fire.click(button('Create Goal'))
    vi.restoreAllMocks()
    expect(alerts()).toContain('This browser did not save it.')
    // Still on the review, with what was typed: one more press saves it.
    expect(screen.getByText('Laptop')).toBeTruthy()
    await fire.click(button('Create Goal'))
    expect((await storedData())?.goals).toMatchObject([{ name: 'Laptop', target: 400_000 }])
  })

  it('does not erase while a change is being saved', async () => {
    const held = heldStore()
    await held.store.create(robin())
    await start(held.store)
    await openSettings()
    held.hold()
    fireEvent.change(field('Appearance'), { target: { value: 'dark' } })
    await step()
    fireEvent.click(button('Erase All Data on This Device'))
    await step()
    expect(button('Erase Everything').getAttribute('aria-disabled')).toBe('true')
    // Pressed anyway: useSpace refuses it too, without sending it.
    fireEvent.click(button('Erase Everything'))
    await step()
    expect(alerts() + statuses() + document.body.textContent).toContain('Still saving the last change. Try again in a moment.')
    await held.release()
    await settle()
    expect(held.calls).not.toContain('erase')
    expect((await storedData())?.preferences.theme).toBe('dark')
  })
})

describe('another tab', () => {
  it('stops saving after a change in another tab, keeps the screen, and opens the latest version on request, also when no notice came', async () => {
    // The notice from the other tab is lost (as in a tab the browser paused): the revision check alone keeps the change from being written over.
    const inner = browserSpaceStore(memoryStorage())
    await start({ ...inner, watch: () => () => {} })
    await setUpTo()
    await fire.click(button('Create My Space'))
    const other = browserSpaceStore(memoryStorage())
    const loaded = await other.load()
    if (loaded.status !== 'loaded') throw new Error('not saved')
    await other.save({ ...loaded.space.data, space: { ...loaded.space.data.space, name: 'Robin (other tab)' } }, loaded.space.revision)
    await openSettings()
    await fire.change(field('Appearance'), { target: { value: 'dark' } })
    expect(alerts()).toContain('Not saved: this space changed in another tab.')
    expect(alerts()).toContain('This space changed in another tab, so nothing more is saved here until it is opened again.')
    await fire.change(field('Appearance'), { target: { value: 'dark' } })
    expect((await storedData())?.preferences.theme).toBe('system')
    await fire.click(button('Open Latest Version'))
    expect(screen.queryByRole('button', { name: 'Open Latest Version' })).toBeNull()
    await fire.change(field('Appearance'), { target: { value: 'dark' } })
    expect((await storedData())).toMatchObject({ space: { name: 'Robin (other tab)' }, preferences: { theme: 'dark' } })
  })

  it('does not start a second space when another tab started one first', async () => {
    await start()
    await setUpTo('Robin')
    await browserSpaceStore(memoryStorage()).create(robin('Kim'))
    await fire.click(button('Create My Space'))
    expect(alerts()).toContain('Not created: this device already has a space')
    expect((await storedData())?.space.members[0].name).toBe('Kim')
  })
})

describe('erasing', () => {
  it('says when the erase is not finished because this browser kept the older copy, and never opens it', async () => {
    const storage = memoryStorage()
    storage.setItem('goal-planning-app.my-space', JSON.stringify(robin()))
    await start(undefined, storage)
    expect(screen.getByText('Robin · Individual')).toBeTruthy()
    vi.spyOn(storage, 'removeItem').mockImplementation(() => {})
    await openSettings()
    await fire.click(button('Erase All Data on This Device'))
    await fire.click(button('Erase Everything'))
    expect(welcome()).toBeTruthy()
    expect(alerts()).toContain('Erase is not finished.')
    expect(await storedData()).toBeNull()
    cleanup()
    await start(undefined, storage)
    expect(welcome()).toBeTruthy()
    expect(screen.queryByText('Robin · Individual')).toBeNull()
  })
})

describe('space ids', () => {
  const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/

  it('gives every new space its own random id, also after an erase', async () => {
    await start()
    await setUpTo()
    await fire.click(button('Create My Space'))
    const first = (await storedData())!.space.id
    expect(first).toMatch(UUID)
    await openSettings()
    await fire.click(button('Erase All Data on This Device'))
    await fire.click(button('Erase Everything'))
    await setUpTo()
    await fire.click(button('Create My Space'))
    const second = (await storedData())!.space.id
    expect(second).toMatch(UUID)
    expect(second).not.toBe(first)
  })

  it('keeps my-space for a space made before', async () => {
    const storage = memoryStorage()
    storage.setItem('goal-planning-app.my-space', JSON.stringify(robin()))
    await start(undefined, storage)
    expect((await storedData())!.space.id).toBe('my-space')
  })
})
