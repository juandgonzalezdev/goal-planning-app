// @vitest-environment jsdom
import { act, cleanup, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { browserSpaceStore } from './app/useSpace'
import { BACKUP_KIND, exportBackup, exportFinanceData } from './data/exchange'
import type { SpaceStore, StoreChange } from './data/spaceStore'
import { createSpaceData } from './domain/finance/space'
import type { FinanceData } from './domain/finance/types'
import { NEW_PROGRESS, type GuideProgress } from './features/home/gettingStarted'
import { memoryStorage, storedKeys } from './test/memoryStorage'
import { fire, freshDatabaseForEachTest, refuseWrites, settle, storedData, storedGuideRecord, storedProgress } from './test/space'
import { downloadFile } from './ui/download'

/*
 * GS-6A.1: Getting Started progress saved with the space in the browser's
 * database, apart from its records and their revision. A change shows only
 * once it is saved; a change not saved says so and can be made again.
 */

vi.mock('./ui/download', () => ({ downloadFile: vi.fn() }))

freshDatabaseForEachTest()
beforeEach(() => { window.history.replaceState(null, '') })
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.mocked(downloadFile).mockClear() })

const TODAY = '2026-10-21'
const button = (name: string | RegExp) => screen.getByRole('button', { name })
const field = (label: string | RegExp) => screen.getByLabelText(label) as HTMLInputElement
const text = (element: Element | null) => (element?.textContent ?? '').replace(/\u00a0|\u202f/g, ' ')
const tab = (name: string) => within(screen.getByRole('navigation', { name: 'Main navigation' })).getByRole('button', { name })
const card = () => screen.queryByRole('region', { name: 'Getting Started' })
const title = () => screen.getByRole('heading', { level: 1 }).textContent
const alerts = () => screen.queryAllByRole('alert').map(alert => alert.textContent).join(' ')
const stageStates = () => within(screen.getByRole('navigation', { name: 'Getting Started stages' })).getAllByRole('button')
  .map(item => (item.getAttribute('aria-label') ?? '').replace(/, step \d of 6: /, ': '))
const progress = (change: Partial<GuideProgress> = {}): GuideProgress => ({ ...NEW_PROGRESS, ...change })

function robin(name = 'Robin'): FinanceData {
  const made = createSpaceData({ mode: 'individual', names: [name], currency: 'PLN', theme: 'light' })
  if (made.status !== 'created') throw new Error('invalid setup')
  return made.data
}

/** This tab, on a space already saved; notices from other tabs come when the test says (`tell`). */
async function openTab(storage: Storage = memoryStorage()) {
  let listener: ((change: StoreChange) => void) | null = null
  const inner = browserSpaceStore(memoryStorage())
  const store: SpaceStore = { ...inner, watch: onChange => { listener = onChange; return () => { listener = null } } }
  render(<App getToday={() => TODAY} storage={storage} createStore={() => store} />)
  await settle()
  return { storage, tell: async (change: StoreChange) => { act(() => listener?.(change)); await settle() } }
}

/** Another tab saving Getting Started progress on the same browser database. */
async function otherTabSavesProgress(change: GuideProgress) {
  const other = browserSpaceStore(memoryStorage())
  const loaded = await other.load()
  if (loaded.status !== 'loaded') throw new Error('nothing saved')
  const id = loaded.space.data.space.id
  const before = await other.loadProgress(id)
  const saved = await other.saveProgress(id, change, before.status === 'loaded' ? before.revision : 0)
  if (saved.status !== 'saved') throw new Error('not saved')
  return { kind: 'progress-saved' as const, spaceId: id, revision: saved.revision }
}

async function savedSpace(data = robin()) {
  await browserSpaceStore(memoryStorage()).create(data)
  return data
}

async function toFinish() {
  await fire.click(within(card()!).getByRole('button', { name: /setup$/ }))
  for (let index = 0; index < 5; index++) await fire.click(button('Skip for now'))
  expect(title()).toBe('Finish')
}

async function openSettings() {
  await fire.click(tab('Money'))
  await fire.click(button('Settings'))
}

async function upload(content: string) {
  await act(async () => {
    await fire.change(field('Choose a backup file (JSON)'), { target: { files: [new File([content], 'data.json', { type: 'application/json' })] } })
    await new Promise(resolve => setTimeout(resolve, 20))
  })
}

describe('Getting Started progress is saved, and shown only once saved (GS-6A.1)', () => {
  it('Done closes the screen once "finished" is saved, and the guide stays finished after a reload', async () => {
    await savedSpace()
    const { storage } = await openTab()
    await toFinish()
    await fire.click(button('Done'))
    expect(document.querySelector('[data-screen="guide"]')).toBeNull()
    expect(await storedProgress()).toMatchObject({ finished: true, skipped: ['accounts', 'income', 'debts', 'bills', 'goals'] })
    // The space's revision did not move: guide changes are not changes to the records.
    expect(await browserSpaceStore(memoryStorage()).load()).toMatchObject({ status: 'loaded', space: { revision: 1 } })
    cleanup()
    await openTab(storage)
    expect(card()).toBeNull()
  })

  it('when the browser refuses to save, Skip for now and Done stay where they are and say so; nothing shows as saved', async () => {
    await savedSpace()
    await openTab()
    await fire.click(within(card()!).getByRole('button', { name: 'Start setup' }))
    refuseWrites()
    await fire.click(button('Skip for now'))
    expect(title()).toBe('Accounts & Savings')
    expect(alerts()).toContain('This browser did not save it. Nothing was changed. Try again.')
    expect(stageStates()[0]).toBe('Accounts: Not started, current')
    vi.restoreAllMocks()
    // Given again, it is saved, and the next stage opens.
    await fire.click(button('Skip for now'))
    expect(title()).toBe('Income')
    expect(alerts()).not.toContain('did not save')
    for (let index = 0; index < 4; index++) await fire.click(button('Skip for now'))
    refuseWrites()
    await fire.click(button('Done'))
    expect(title()).toBe('Finish')
    expect(alerts()).toContain('This browser did not save it.')
    expect(await storedProgress()).toMatchObject({ finished: false })
  })

  it('a change made in another tab is shown here, and never makes a form open here conflict', async () => {
    const data = await savedSpace()
    const { tell } = await openTab()
    await fire.click(within(card()!).getByRole('button', { name: 'Start setup' }))
    // A form is open here, with something typed.
    await fire.click(button(/^Add (Another )?Account$/))
    await fire.change(field('Account Name'), { target: { value: 'Main account' } })
    // Meanwhile another tab skips Income and finishes nothing.
    await tell(await otherTabSavesProgress(progress({ skipped: ['income'], last: 'debts' })))
    expect(stageStates()[1]).toBe('Income: Skipped')
    expect(alerts()).not.toMatch(/changed in another tab/)
    await fire.click(button('Save Account'))
    expect((await storedData())!.moneyAccounts.map(account => account.name)).toEqual(['Main account'])
    expect(await browserSpaceStore(memoryStorage()).load()).toMatchObject({ status: 'loaded', space: { revision: 2, data: { space: { id: data.space.id } } } })
  })

  it('a tab with older progress never writes over newer progress: it says so and shows the latest', async () => {
    await savedSpace()
    await openTab()
    await fire.click(within(card()!).getByRole('button', { name: 'Start setup' }))
    // Another tab saves, and its notice never arrives here.
    await otherTabSavesProgress(progress({ none: ['debts'], skipped: ['accounts'], last: 'income' }))
    await fire.click(button('Skip for now'))
    expect(alerts()).toContain('Not saved: Getting Started changed in another tab. Its latest progress is shown.')
    expect(await storedProgress()).toEqual(progress({ none: ['debts'], skipped: ['accounts'], last: 'income' }))
    expect(stageStates().slice(0, 3)).toEqual(['Accounts: Skipped, current', 'Income: Not started', 'Debts: No debts'])
  })
})

describe('Backup and Restore with Getting Started (GS-6A.1)', () => {
  it('Download Backup holds the records and the progress as saved, in the new file', async () => {
    const data = await savedSpace()
    await openTab()
    await fire.click(within(card()!).getByRole('button', { name: 'Start setup' }))
    await fire.click(button('Skip for now'))
    await fire.click(tab('Home'))
    await openSettings()
    await fire.click(button('Download Backup'))
    const file = JSON.parse(vi.mocked(downloadFile).mock.calls[0][0])
    expect(file).toEqual({ kind: BACKUP_KIND, format: 1, financeData: data, gettingStarted: { progress: progress({ skipped: ['accounts'], last: 'income' }) } })
  })

  it('a new backup restores "finished" with the records, keeping this space’s id; an older one keeps this space’s progress', async () => {
    const data = await savedSpace()
    await openTab()
    const other = { ...robin('Imported'), space: { ...robin('Imported').space, id: 'id-in-the-file', name: 'Imported' } }
    await openSettings()
    await upload(exportBackup(other, progress({ finished: true, none: ['income'] })))
    await fire.click(button('Replace'))
    const restored = (await storedData())!
    expect([restored.space.id, restored.space.name]).toEqual([data.space.id, 'Imported'])
    expect(await storedGuideRecord()).toMatchObject({ spaceId: data.space.id, revision: 1, progress: progress({ finished: true, none: ['income'] }) })
    await fire.click(tab('Home'))
    expect(card()).toBeNull()

    // An older file (the records only): the progress stays as this space has it.
    await openSettings()
    await upload(exportFinanceData({ ...other, space: { ...other.space, name: 'Older file' } }))
    await fire.click(button('Replace'))
    expect((await storedData())!.space.name).toBe('Older file')
    expect(await storedGuideRecord()).toMatchObject({ revision: 1, progress: progress({ finished: true, none: ['income'] }) })
  })

  it('an older backup on a space with no saved progress leaves Getting Started not finished', async () => {
    await savedSpace()
    await openTab()
    await openSettings()
    await upload(exportFinanceData(robin('Older file')))
    await fire.click(button('Replace'))
    expect(await storedGuideRecord()).toMatchObject({ revision: 1, progress: NEW_PROGRESS })
    await fire.click(tab('Home'))
    expect(text(card())).toContain('Step 1 of 6 · Accounts')
  })

  it('refuses a file with malformed Getting Started data, and changes nothing', async () => {
    const data = await savedSpace()
    await openTab()
    await openSettings()
    await upload(JSON.stringify({ kind: BACKUP_KIND, format: 1, financeData: robin('Imported'), gettingStarted: { progress: { ...NEW_PROGRESS, finished: 'yes' } } }))
    expect(alerts()).toContain('This file cannot be used. Nothing was changed.')
    expect(screen.queryByRole('button', { name: 'Replace' })).toBeNull()
    expect((await storedData())!.space.name).toBe(data.space.name)
    expect(await storedGuideRecord()).toBeNull()
  })
})

describe('Demo and Erase with Getting Started (GS-6A.1)', () => {
  it('the demo never saves progress, and its backup has none', async () => {
    const storage = memoryStorage()
    render(<App getToday={() => TODAY} storage={storage} />)
    await settle()
    await fire.click(button('Explore the App'))
    await fire.click(button('Settings'))
    await fire.click(button('Open Help & Guide'))
    await fire.click(button('Show Getting Started on Home'))
    await fire.click(button('Open Getting Started'))
    // Alex's space has the first five stages: the guide opens on Finish, and Done ends it, in memory only.
    await fire.click(button('Done'))
    await fire.click(button('Settings'))
    await fire.click(button('Download Backup'))
    expect(JSON.parse(vi.mocked(downloadFile).mock.calls[0][0]).gettingStarted).toBeNull()
    expect(await storedGuideRecord()).toBeNull()
    expect(storedKeys(storage).some(key => key.includes('getting-started'))).toBe(false)
  })

  it('Erase removes the progress, and a new space starts a new guide', async () => {
    await savedSpace()
    await openTab()
    await toFinish()
    await fire.click(button('Done'))
    await openSettings()
    await fire.click(button('Erase All Data on This Device'))
    await fire.click(button('Erase Everything'))
    expect(await storedGuideRecord()).toBeNull()
    await savedSpace(robin('Kim'))
    cleanup()
    await openTab()
    expect(text(card())).toContain('Step 1 of 6 · Accounts')
    expect(within(card()!).getByRole('button', { name: 'Start setup' })).toBeTruthy()
  })
})
