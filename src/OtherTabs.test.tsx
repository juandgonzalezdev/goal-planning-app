// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { browserSpaceStore } from './app/useSpace'
import { importFinanceData } from './data/exchange'
import { createIndexedDbStore } from './data/indexedDbStore'
import { recoveryFile } from './data/recovery'
import type { SpaceStore, StoreChange } from './data/spaceStore'
import { createSpaceData } from './domain/finance/space'
import type { FinanceData } from './domain/finance/types'
import { memoryStorage } from './test/memoryStorage'
import { fire, freshDatabaseForEachTest, heldStore, settle, storedSpace } from './test/space'

/*
 * The same space open in two tabs (patch 05). What another tab saves is
 * shown here only when nothing typed here is waiting; otherwise saving
 * stops and what was typed stays, to copy. An erase in another tab never
 * drops what was typed without a yes. Saved information that cannot be
 * opened gets the recovery screen, and Download Both Copies only reads.
 */

freshDatabaseForEachTest()
afterEach(() => { cleanup(); vi.restoreAllMocks(); document.documentElement.removeAttribute('data-theme') })

const TODAY = '2026-10-21'
const OLDER_COPY = 'goal-planning-app.my-space'
const button = (name: string | RegExp) => screen.getByRole('button', { name })
const field = (label: string | RegExp) => screen.getByLabelText(label) as HTMLInputElement
const alerts = () => screen.queryAllByRole('alert').map(alert => alert.textContent).join(' ')
const statuses = () => screen.queryAllByRole('status').map(status => status.textContent).join(' ')
/** A few turns of the page, for while a held call keeps `settle` from ever being quiet. */
const step = () => act(async () => { for (let i = 0; i < 5; i++) await new Promise(resolve => setTimeout(resolve, 0)) })
const tab = (name: string) => within(screen.getByRole('navigation', { name: 'Main navigation' })).getByRole('button', { name })

function robin(name = 'Robin'): FinanceData {
  const made = createSpaceData({ mode: 'individual', names: [name], currency: 'PLN', theme: 'light' })
  if (made.status !== 'created') throw new Error('invalid setup')
  return made.data
}

/**
 * This tab: the app on the real store (the fake browser database), with the notices from other tabs
 * handed over by the test (`tell`), so each one comes exactly when the test says.
 */
async function openTab(inner: SpaceStore = browserSpaceStore(memoryStorage()), storage: Storage = memoryStorage()) {
  let listener: ((change: StoreChange) => void) | null = null
  const store: SpaceStore = { ...inner, watch: onChange => { listener = onChange; return () => { listener = null } } }
  render(<App getToday={() => TODAY} storage={storage} createStore={() => store} />)
  await settle()
  return {
    store,
    tell: async (change: StoreChange) => { act(() => listener?.(change)); await settle() },
    /** The notice only, without waiting for what it starts (for a save that is held). */
    notify: (change: StoreChange) => act(() => listener?.(change)),
  }
}

/** Another tab: its own store on the same browser database. */
const otherTab = () => browserSpaceStore(memoryStorage())

async function otherTabSaves(change: (data: FinanceData) => FinanceData) {
  const other = otherTab()
  const loaded = await other.load()
  if (loaded.status !== 'loaded') throw new Error('nothing saved')
  const saved = await other.save(change(loaded.space.data), loaded.space.revision)
  if (saved.status !== 'saved') throw new Error('not saved')
  return { kind: 'saved' as const, spaceId: loaded.space.data.space.id, revision: saved.revision }
}

const renamed = (name: string) => (data: FinanceData): FinanceData => ({ ...data, space: { ...data.space, name } })

/** A space already saved on this device, as Robin. */
async function savedSpace(data = robin()) {
  await otherTab().create(data)
}

function clipboard(writeText: (text: string) => Promise<void>) {
  Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
}

/** The own space opened in the Data screen, with the Accounts block open and Add Account typed in. */
async function typeNewAccount(name: string) {
  await fire.click(tab('Data'))
  await fire.click(button(/^Accounts & Balances/))
  await fire.click(button('Add Account'))
  await fire.change(field('Account Name'), { target: { value: name } })
}

describe('a change saved in another tab', () => {
  it('shows by itself when nothing typed here is waiting, on the same screen, with a short notice', async () => {
    await savedSpace()
    const { tell } = await openTab()
    await fire.click(tab('Data'))
    await fire.click(button(/^Accounts & Balances/))
    const toggle = button(/^Accounts & Balances/)
    toggle.focus()
    await tell(await otherTabSaves(renamed('Robin (other tab)')))
    expect(screen.getByText('Robin (other tab) · Individual')).toBeTruthy()
    expect(statuses()).toContain('Updated with changes from another tab.')
    // Same screen, same open block, and the focus back on the same button.
    expect(screen.getByRole('heading', { name: 'Manage Your Data' })).toBeTruthy()
    expect(button(/^Accounts & Balances/).getAttribute('aria-expanded')).toBe('true')
    expect(document.activeElement).toBe(button(/^Accounts & Balances/))
    // It can be changed again straight away, on the new revision.
    await fire.click(button('Settings'))
    await fire.change(field('Appearance'), { target: { value: 'dark' } })
    expect(await storedSpace()).toMatchObject({ data: { space: { name: 'Robin (other tab)' }, preferences: { theme: 'dark' } } })
  })

  it('never replaces a form with changes: saving stops, what was typed stays, and it can be copied with every field', async () => {
    await savedSpace()
    const { tell } = await openTab()
    await typeNewAccount('Holiday pot')
    await fire.change(field(/^Balance \(/), { target: { value: '250' } })
    const before = await storedSpace()
    await tell(await otherTabSaves(renamed('Robin (other tab)')))
    // Nothing here changed: the old name, the form as typed.
    expect(screen.getByText('Robin · Individual')).toBeTruthy()
    expect(field('Account Name').value).toBe('Holiday pot')
    expect(alerts()).toContain('This space changed in another tab')
    expect(alerts()).toContain('Not saved here: Add account.')
    const copied: string[] = []
    clipboard(async text => { copied.push(text) })
    await fire.click(button('Copy What I Typed'))
    expect(copied[0]).toContain('Add account')
    expect(copied[0]).toContain('Name: Holiday pot')
    expect(copied[0]).toContain('Balance: 250')
    // Saving it is refused, and the form keeps it.
    await fire.click(button('Save Account'))
    expect(field('Account Name').value).toBe('Holiday pot')
    expect((await storedSpace())?.revision).toBe(before!.revision + 1)
    expect((await storedSpace())?.data.moneyAccounts.some(account => account.name === 'Holiday pot')).toBe(false)
  })

  it('asks before Open Latest Version drops the forms with changes, and opens it only after the yes', async () => {
    await savedSpace()
    const { tell } = await openTab()
    await typeNewAccount('Holiday pot')
    await tell(await otherTabSaves(renamed('Robin (other tab)')))
    await fire.click(button('Open Latest Version'))
    expect(alerts()).toContain('Opening the latest version closes the forms you changed here.')
    await fire.click(button('Keep Editing'))
    expect(field('Account Name').value).toBe('Holiday pot')
    expect(screen.getByText('Robin · Individual')).toBeTruthy()
    await fire.click(button('Open Latest Version'))
    await fire.click(button('Discard and Open Latest Version'))
    expect(screen.getByText('Robin (other tab) · Individual')).toBeTruthy()
    expect(screen.queryByLabelText('Account Name')).toBeNull()
    expect(alerts()).not.toContain('changed in another tab')
  })

  it('waits for a save still being answered before deciding, and that save is not cancelled', async () => {
    await savedSpace()
    const held = heldStore()
    const { notify } = await openTab(held.store)
    await fire.click(button('Settings'))
    held.hold()
    fireEvent.change(field('Appearance'), { target: { value: 'dark' } })
    await step()
    // While that save waits, the other tab saves first, and its notice comes.
    notify(await otherTabSaves(renamed('Robin (other tab)')))
    await step()
    expect(screen.getByText('Robin · Individual')).toBeTruthy()
    expect(held.calls.filter(call => call === 'load')).toHaveLength(1)
    await held.release()
    await settle()
    // The save was answered (refused: the other tab was first), and only then the notice was dealt with: saving stops, nothing is replaced.
    expect(held.calls).toContain('save')
    expect(alerts()).toContain('This space changed in another tab')
    expect(screen.getByText('Robin · Individual')).toBeTruthy()
    expect((await storedSpace())?.data.preferences.theme).toBe('light')
  })

  it('checks again when the tab is shown again, also when no notice came (as on an iPhone in the background)', async () => {
    await savedSpace()
    await openTab()
    await otherTabSaves(renamed('Robin (other tab)'))
    expect(screen.getByText('Robin · Individual')).toBeTruthy()
    await act(async () => { document.dispatchEvent(new Event('visibilitychange')) })
    await settle()
    expect(screen.getByText('Robin (other tab) · Individual')).toBeTruthy()
  })

  it('explains it when the bill on screen was deleted in another tab', async () => {
    await savedSpace()
    const { tell } = await openTab()
    await fire.click(tab('Bills'))
    await fire.click(button('Add Bill'))
    await fire.change(field('Bill name'), { target: { value: 'Rent' } })
    await fire.change(field(/Usual amount/), { target: { value: '1200' } })
    await fire.change(field('Due day'), { target: { value: '10' } })
    await fire.click(button('Add Bill'))
    expect(screen.getByRole('heading', { name: 'Rent' })).toBeTruthy()
    await tell(await otherTabSaves(data => ({ ...data, bills: [] })))
    expect(screen.getByText('This bill is no longer here. It may have been deleted in another tab.')).toBeTruthy()
  })

  it('says so when an older version of the app, open in another tab, saves to the older copy', async () => {
    await savedSpace()
    const { tell } = await openTab()
    await tell({ kind: 'older-copy-changed' })
    expect(alerts()).toContain('An older version of the app is open in another tab.')
    await fire.click(button('OK'))
    expect(alerts()).not.toContain('An older version of the app')
  })
})

describe('an erase in another tab', () => {
  it('closes the space and says why when nothing typed here is waiting', async () => {
    await savedSpace()
    const { tell } = await openTab()
    await otherTab().erase()
    await tell({ kind: 'erased' })
    expect(screen.getByRole('heading', { name: 'Your goals, your way.' })).toBeTruthy()
    expect(statuses()).toContain('Your space was erased in another tab.')
  })

  it('with a form changed, blocks every save and keeps what was typed until the user discards it', async () => {
    await savedSpace()
    const { tell } = await openTab()
    await typeNewAccount('Holiday pot')
    await otherTab().erase()
    await tell({ kind: 'erased' })
    expect(alerts()).toContain('This space was erased in another tab.')
    expect(field('Account Name').value).toBe('Holiday pot')
    await fire.click(button('Save Account'))
    expect(await storedSpace()).toBeNull()
    // Closing the form does not drop what was typed: it is still listed, to copy.
    await fire.click(button('Cancel'))
    expect(alerts()).toContain('Add account (closed)')
    const copied: string[] = []
    clipboard(async text => { copied.push(text) })
    await fire.click(button('Copy What I Typed'))
    expect(copied[0]).toContain('Name: Holiday pot')
    // Discard asks first.
    await fire.click(button('Discard and Close…'))
    await fire.click(button('Keep Editing'))
    expect(alerts()).toContain('This space was erased in another tab.')
    await fire.click(button('Discard and Close…'))
    await fire.click(button('Discard and Close'))
    expect(screen.getByRole('heading', { name: 'Your goals, your way.' })).toBeTruthy()
    expect(await storedSpace()).toBeNull()
  })

  it('shows the text to copy by hand when the browser does not allow copying', async () => {
    await savedSpace()
    const { tell } = await openTab()
    await typeNewAccount('Holiday pot')
    await otherTab().erase()
    await tell({ kind: 'erased' })
    clipboard(async () => { throw new Error('not allowed') })
    await fire.click(button('Copy What I Typed'))
    const box = screen.getByLabelText('What you typed. Select it and copy it.') as HTMLTextAreaElement
    expect(box.value).toContain('Name: Holiday pot')
    expect(box.readOnly).toBe(true)
  })
})

describe('the recovery screen', () => {
  async function brokenSpace(withOlderCopy: boolean) {
    const storage = memoryStorage()
    if (withOlderCopy) storage.setItem(OLDER_COPY, JSON.stringify(robin('Older Robin')))
    // A space in the database that cannot be read: the older copy was brought in before, then the space was damaged.
    const store = createIndexedDbStore({ indexedDB, olderCopy: storage, window: null })
    await store.load()
    await store.close()
    const db = await new Promise<IDBDatabase>(resolve => { const r = indexedDB.open('goal-planning-app'); r.onsuccess = () => resolve(r.result) })
    if (!withOlderCopy) {
      await new Promise(resolve => {
        const tx = db.transaction(['spaces', 'meta'], 'readwrite')
        tx.objectStore('meta').put('my-space', 'current-space')
        tx.objectStore('spaces').put({ format: 1, revision: 3, savedAt: 'x', data: { broken: true } }, 'my-space')
        tx.oncomplete = resolve
      })
    } else {
      await new Promise(resolve => {
        const tx = db.transaction(['spaces'], 'readwrite')
        tx.objectStore('spaces').put({ format: 1, revision: 3, savedAt: 'x', data: { broken: true } }, 'my-space')
        tx.oncomplete = resolve
      })
    }
    db.close()
    return storage
  }

  it('offers Download Both Copies, Use Older Copy and Erase (each after a yes), and Try Again, never a new space', async () => {
    const storage = await brokenSpace(true)
    await openTab(browserSpaceStore(storage), storage)
    expect(screen.getByRole('heading', { name: 'Your Saved Information' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: /Create Account/ })).toBeNull()
    for (const name of ['Download Both Copies', 'Use Older Copy…', 'Erase Saved Information…', 'Try Again']) expect(button(name)).toBeTruthy()
    await fire.click(button('Use Older Copy…'))
    expect(screen.getByText('Open the older copy? The copy that cannot be opened is kept aside, not deleted.')).toBeTruthy()
    await fire.click(button('Cancel'))
    expect(button('Use Older Copy…')).toBeTruthy()
    await fire.click(button('Use Older Copy…'))
    await fire.click(button('Use Older Copy'))
    expect(screen.getByText('Older Robin · Individual')).toBeTruthy()
    // The copy that could not be opened was set aside, not deleted.
    const copies = await browserSpaceStore(storage).exportCopies()
    expect(copies.database?.quarantine).toHaveLength(1)
    expect(copies.database?.quarantine[0].stored).toMatchObject({ value: { data: { broken: true } } })
  })

  it('for information saved by a newer version of the app, offers only Download Both Copies and Try Again', async () => {
    const data = { ...robin(), schemaVersion: 99 }
    const storage = memoryStorage()
    storage.setItem(OLDER_COPY, JSON.stringify(data))
    await openTab(browserSpaceStore(storage), storage)
    expect(alerts()).toContain('saved by a newer version of the app')
    expect(button('Download Both Copies')).toBeTruthy()
    expect(button('Try Again')).toBeTruthy()
    expect(screen.queryByRole('button', { name: /Erase/ })).toBeNull()
    expect(screen.queryByRole('button', { name: /Use Older Copy/ })).toBeNull()
  })
})

describe('Download Both Copies', () => {
  it('holds every copy as it is stored, also the set-aside ones, and changes nothing', async () => {
    const storage = memoryStorage()
    storage.setItem(OLDER_COPY, JSON.stringify(robin('Older Robin')))
    const store = browserSpaceStore(storage)
    await store.load()
    const before = { copies: JSON.stringify(await store.exportCopies()), storage: storage.getItem(OLDER_COPY), length: storage.length }
    const copies = await store.exportCopies()
    expect(copies.database?.currentSpace).toBe('my-space')
    expect(copies.database?.spaces[0]).toMatchObject({ id: 'my-space', stored: { revision: 1 } })
    expect(copies.olderCopy).toContain('Older Robin')
    expect(JSON.stringify(await store.exportCopies())).toBe(before.copies)
    expect(storage.getItem(OLDER_COPY)).toBe(before.storage)
    expect(storage.length).toBe(before.length)
    // The file says what it is, and Restore Backup does not take it.
    const file = recoveryFile(copies, '2026-10-28T20:00:00.000Z')
    expect(file).toContain('not encrypted')
    expect(file).toContain('It is not a backup')
    expect(importFinanceData(file)).toEqual({ status: 'rejected', errors: ['This is a recovery file, not a backup. It cannot be restored here.'] })
  })

  it('is offered next to Download Backup while the space can only be shown', async () => {
    const inner = browserSpaceStore(memoryStorage())
    const store: SpaceStore = { ...inner, load: async () => ({ status: 'read-only', space: { data: robin(), revision: 0 }, mayBeOutdated: true }) }
    await openTab(store)
    await fire.click(tab('Data'))
    await fire.click(button(/^Reports & Backup/))
    expect(button('Download Backup')).toBeTruthy()
    expect(button('Download Both Copies')).toBeTruthy()
    expect(screen.getByText(/It is a recovery file with your information not encrypted, not a backup/)).toBeTruthy()
  })
})

describe('read-only', () => {
  it('lets no control change anything on any screen', async () => {
    const save = vi.fn(async () => ({ status: 'failed' as const }))
    const create = vi.fn(async () => ({ status: 'failed' as const }))
    const erase = vi.fn(async () => ({ status: 'failed' as const }))
    const useOlderCopy = vi.fn(async () => ({ status: 'failed' as const }))
    const { createAlexDemo } = await import('./data/fixtures/demoAlex')
    const store: SpaceStore = {
      load: async () => ({ status: 'read-only', space: { data: createAlexDemo(), revision: 0 }, mayBeOutdated: true }),
      create, save, erase, useOlderCopy,
      exportCopies: async () => ({ database: null, olderCopy: null, erasedMark: false }),
      watch: () => () => {},
    }
    await openTab(store)
    const screens: Array<{ name: string; open: () => Promise<void> }> = [
      { name: 'home', open: () => fire.click(tab('Home')) }, { name: 'bills', open: () => fire.click(tab('Bills')) },
      { name: 'cards', open: () => fire.click(tab('Cards')) }, { name: 'history', open: () => fire.click(tab('History')) },
      { name: 'data', open: async () => { await fire.click(tab('Data')); await fire.click(button('Expand All')) } },
      { name: 'settings', open: () => fire.click(button('Settings')) },
    ]
    const shownScreen = () => document.querySelector('main [data-screen]')?.getAttribute('data-screen')
    // On each screen, every button is pressed once, also the ones it opens (editors, Save, Delete, Confirm, Paid…).
    // A button that leaves the screen is pressed too; then the screen is opened again.
    const pressed: string[] = []
    for (const { name, open } of screens) {
      await fire.click(button('Go to Home'))
      await open()
      const done = new Set<string>()
      for (let round = 0; round < 120; round++) {
        const main = document.querySelector('main')!
        const next = [...main.querySelectorAll<HTMLButtonElement>('button')].find(b => !done.has(`${b.getAttribute('aria-label') ?? ''}|${b.textContent}`))
        if (!next) break
        done.add(`${next.getAttribute('aria-label') ?? ''}|${next.textContent}`)
        pressed.push(next.textContent ?? '')
        await fire.click(next)
        if (shownScreen() !== name) { await fire.click(button('Go to Home')); await open() }
      }
      for (const select of document.querySelectorAll('main select')) await fire.change(select, { target: { value: (select as HTMLSelectElement).options[(select as HTMLSelectElement).options.length - 1]?.value } })
    }
    // It really pressed them (paid toggles, Save, Delete…), and none of them reached the store.
    expect(pressed.length).toBeGreaterThan(300)
    for (const label of ['Save', 'Delete', 'Paid', 'Erase']) expect(pressed.some(text => text.includes(label))).toBe(true)
    expect(save).not.toHaveBeenCalled()
    expect(create).not.toHaveBeenCalled()
    expect(erase).not.toHaveBeenCalled()
    expect(useOlderCopy).not.toHaveBeenCalled()
  }, 120_000)
})
