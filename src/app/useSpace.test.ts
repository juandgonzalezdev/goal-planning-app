// @vitest-environment jsdom
import { act, renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { LoadResult, SpaceStore, StoredSpace } from '../data/spaceStore'
import { createSpaceData } from '../domain/finance/space'
import type { FinanceData } from '../domain/finance/types'
import { memoryStorage } from '../test/memoryStorage'
import { freshDatabaseForEachTest, heldStore, storedData, storedSpace } from '../test/space'
import { browserSpaceStore, useSpace } from './useSpace'

freshDatabaseForEachTest()

function robin(): FinanceData {
  const made = createSpaceData({ mode: 'individual', names: ['Robin'], currency: 'PLN', theme: 'light' })
  if (made.status !== 'created') throw new Error('invalid setup')
  return made.data
}

const renamed = (name: string) => (data: FinanceData): FinanceData => ({ ...data, space: { ...data.space, name } })

/** A store that answers `load` with this, and refuses to be written. */
function storeThatLoads(result: LoadResult | (() => Promise<LoadResult>)) {
  const store: SpaceStore = {
    load: typeof result === 'function' ? result : async () => result,
    create: vi.fn(async () => ({ status: 'failed' as const })),
    save: vi.fn(async () => ({ status: 'failed' as const })),
    erase: vi.fn(async () => ({ status: 'failed' as const })),
    useOlderCopy: vi.fn(async () => ({ status: 'failed' as const })),
    watch: () => () => {},
  }
  return store
}

async function openWith(store: SpaceStore) {
  const hook = renderHook(() => useSpace(memoryStorage(), () => '2026-10-25', undefined, () => '2026-10-25T10:00:00.000Z', () => store))
  await waitFor(() => expect(hook.result.current.opening).toBe(false))
  return hook
}

describe('opening the own space', () => {
  it('is opening until the store answers, and shows nothing as empty meanwhile', async () => {
    const held = heldStore()
    held.hold()
    const { result } = renderHook(() => useSpace(memoryStorage(), () => '2026-10-25', undefined, undefined, () => held.store))
    expect(result.current.opening).toBe(true)
    expect(result.current.open).toBeNull()
    expect(result.current.problem).toBeNull()
    await held.release()
    expect(result.current.opening).toBe(false)
  })

  it('opens a saved space at its revision', async () => {
    const held = heldStore()
    await held.store.create(robin())
    const { result } = await openWith(held.store)
    expect(result.current.open).toMatchObject({ kind: 'own', revision: 1 })
    expect(result.current.canWrite).toBe(true)
  })

  it('never treats unreadable data as an empty device: nothing can be started over it', async () => {
    const store = storeThatLoads({ status: 'unreadable', source: 'space', reason: 'broken', errors: ['x'], olderCopy: false })
    const { result } = await openWith(store)
    expect(result.current.open).toBeNull()
    expect(result.current.problem).toMatchObject({ kind: 'unreadable', source: 'space', reason: 'broken' })
    expect(await act(() => result.current.startOwnSpace(robin()))).toBe('conflict')
    expect(store.create).not.toHaveBeenCalled()
  })

  it('shows a read-only older copy without letting anything be saved, erased or started', async () => {
    const copy: StoredSpace = { data: robin(), revision: 4 }
    const store = storeThatLoads({ status: 'read-only', space: copy, mayBeOutdated: true })
    const { result } = await openWith(store)
    expect(result.current.open).toMatchObject({ kind: 'own', revision: 0, data: { space: { name: 'Robin' } } })
    expect(result.current.problem).toEqual({ kind: 'read-only', withCopy: true })
    expect(result.current.canWrite).toBe(false)
    expect(await act(() => result.current.update(renamed('Changed')))).toBe('read-only')
    expect(await act(() => result.current.replaceData(robin()))).toBe('read-only')
    expect(await act(() => result.current.eraseOwnSpace())).toBe('read-only')
    expect(await act(() => result.current.startOwnSpace(robin()))).toBe('read-only')
    expect(store.save).not.toHaveBeenCalled()
    expect(store.erase).not.toHaveBeenCalled()
    expect(store.create).not.toHaveBeenCalled()
    expect(result.current.open?.data.space.name).toBe('Robin')
  })

  it('is read-only, not empty, when there is no copy to show', async () => {
    const store = storeThatLoads({ status: 'read-only', space: null, mayBeOutdated: true })
    const { result } = await openWith(store)
    expect(result.current.open).toBeNull()
    expect(result.current.problem).toEqual({ kind: 'read-only', withCopy: false })
    expect(await act(() => result.current.startOwnSpace(robin()))).toBe('read-only')
    expect(store.create).not.toHaveBeenCalled()
  })

  it('is read-only, not empty, when the store fails to answer', async () => {
    const store = storeThatLoads(() => Promise.reject(new Error('blocked')))
    const { result } = await openWith(store)
    expect(result.current.open).toBeNull()
    expect(result.current.problem).toEqual({ kind: 'read-only', withCopy: false })
  })

  it('never opens again an older copy that an erase could not remove', async () => {
    const storage = memoryStorage()
    storage.setItem('goal-planning-app.my-space', JSON.stringify(robin()))
    const erasing = browserSpaceStore(storage)
    expect(await erasing.load()).toMatchObject({ status: 'loaded' })
    // This browser keeps the older copy: removing it does nothing.
    vi.spyOn(storage, 'removeItem').mockImplementation(() => {})
    expect(await erasing.erase()).toEqual({ status: 'partly-erased', remaining: 'older-copy' })
    const { result } = renderHook(() => useSpace(storage, () => '2026-10-25'))
    await waitFor(() => expect(result.current.opening).toBe(false))
    expect(storage.getItem('goal-planning-app.my-space')).not.toBeNull()
    expect(result.current.open).toBeNull()
    expect(result.current.problem).toBeNull()
    // Without the browser's database either, it is still not opened: read-only, with nothing to show.
    vi.stubGlobal('indexedDB', undefined)
    const without = renderHook(() => useSpace(storage, () => '2026-10-25'))
    await waitFor(() => expect(without.result.current.opening).toBe(false))
    expect(without.result.current.open).toBeNull()
    expect(without.result.current.problem).toEqual({ kind: 'read-only', withCopy: false })
  })

  it('shows the older copy read-only when the browser has no database', async () => {
    const storage = memoryStorage()
    storage.setItem('goal-planning-app.my-space', JSON.stringify(robin()))
    vi.stubGlobal('indexedDB', undefined)
    const { result } = renderHook(() => useSpace(storage, () => '2026-10-25'))
    await waitFor(() => expect(result.current.opening).toBe(false))
    expect(result.current.open).toMatchObject({ kind: 'own', revision: 0, data: { space: { name: 'Robin' } } })
    expect(result.current.problem).toEqual({ kind: 'read-only', withCopy: true })
    expect(await act(() => result.current.update(renamed('Changed')))).toBe('read-only')
    expect(storage.getItem('goal-planning-app.my-space')).toBe(JSON.stringify(robin()))
  })
})

describe('saving', () => {
  it('shows a change only once it is saved, at the new revision', async () => {
    const held = heldStore()
    await held.store.create(robin())
    const { result } = await openWith(held.store)
    held.hold()
    let outcome: Promise<unknown> = Promise.resolve()
    act(() => { outcome = result.current.update(renamed('Robin Home')) })
    expect(result.current.saving).toBe(true)
    expect(result.current.open?.data.space.name).toBe('Robin')
    await held.release()
    expect(await outcome).toBe('saved')
    expect(result.current.saving).toBe(false)
    expect(result.current.open).toMatchObject({ revision: 2, data: { space: { name: 'Robin Home' } } })
    expect((await storedSpace())?.revision).toBe(2)
  })

  it('saves one change at a time: another one is refused, not sent, while one is being saved', async () => {
    const held = heldStore()
    await held.store.create(robin())
    const { result } = await openWith(held.store)
    held.hold()
    let first: Promise<unknown> = Promise.resolve()
    let second: Promise<unknown> = Promise.resolve()
    act(() => {
      first = result.current.update(renamed('First'))
      second = result.current.update(renamed('Second'))
    })
    expect(await second).toBe('busy')
    expect(await act(() => result.current.eraseOwnSpace())).toBe('busy')
    await held.release()
    expect(await first).toBe('saved')
    expect(held.calls.filter(call => call === 'save')).toHaveLength(1)
    expect(held.calls).not.toContain('erase')
    expect((await storedData())?.space.name).toBe('First')
  })

  it('keeps the screen as it was when the browser does not save', async () => {
    const held = heldStore()
    await held.store.create(robin())
    const store = { ...held.store, save: vi.fn(async () => ({ status: 'failed' as const })) }
    const { result } = await openWith(store)
    expect(await act(() => result.current.update(renamed('Lost')))).toBe('not-saved')
    expect(result.current.open).toMatchObject({ revision: 1, data: { space: { name: 'Robin' } } })
    expect(result.current.canWrite).toBe(true)
  })

  it('stops saving after a change in another tab, and refuses edits started before opening the latest version', async () => {
    const other = browserSpaceStore(memoryStorage())
    await other.create(robin())
    const { result } = await openWith(browserSpaceStore(memoryStorage()))
    const startedOn = result.current.revision
    expect(startedOn).toBe(1)
    // Another tab saves first.
    expect(await other.save(renamed('Other Tab')(robin()), 1)).toMatchObject({ status: 'saved', revision: 2 })
    expect(await act(() => result.current.update(renamed('This Tab'), startedOn))).toBe('conflict')
    expect(result.current.problem).toEqual({ kind: 'conflict' })
    expect(result.current.canWrite).toBe(false)
    expect(await act(() => result.current.update(renamed('Again')))).toBe('conflict')
    expect((await storedData())?.space.name).toBe('Other Tab')

    await act(() => result.current.reload())
    expect(result.current.problem).toBeNull()
    expect(result.current.open).toMatchObject({ revision: 2, data: { space: { name: 'Other Tab' } } })
    // A form opened before still holds revision 1: it never lands on the other tab's change.
    expect(await act(() => result.current.update(renamed('Old Form'), startedOn))).toBe('outdated')
    expect((await storedData())?.space.name).toBe('Other Tab')
    // An edit started on what is shown now is saved.
    expect(await act(() => result.current.update(renamed('New Form'), 2))).toBe('saved')
  })

  it('keeps the open space’s id when a backup from another space replaces it', async () => {
    const held = heldStore()
    await held.store.create({ ...robin(), space: { ...robin().space, id: 'random-id-1' } })
    const { result } = await openWith(held.store)
    const backup = { ...robin(), space: { ...robin().space, id: 'my-space', name: 'Imported' } }
    expect(await act(() => result.current.replaceData(backup, 1))).toBe('saved')
    expect(await storedData()).toMatchObject({ space: { id: 'random-id-1', name: 'Imported' } })
  })

  it('does not start a space when another tab already started one', async () => {
    const other = browserSpaceStore(memoryStorage())
    const { result } = await openWith(browserSpaceStore(memoryStorage()))
    expect(result.current.open).toBeNull()
    await other.create(renamed('Other Tab')(robin()))
    expect(await act(() => result.current.startOwnSpace(robin()))).toBe('conflict')
    expect(result.current.problem).toEqual({ kind: 'conflict' })
    expect((await storedData())?.space.name).toBe('Other Tab')
  })
})

describe('answers that come after leaving', () => {
  it('ignores a slow create after switching to the demo, but the space is still created', async () => {
    const held = heldStore()
    const { result } = await openWith(held.store)
    held.hold()
    let created: Promise<unknown> = Promise.resolve()
    act(() => { created = result.current.startOwnSpace(robin()) })
    act(() => result.current.openDemo())
    expect(result.current.saving).toBe(false)
    expect(result.current.open?.kind).toBe('demo')
    // The demo can change while the create is still on its way.
    expect(await act(() => result.current.update(renamed('Demo Change')))).toBe('demo')
    await held.release()
    // The answer is ignored: the demo stays open, unchanged by it.
    expect(await created).toBe('stale')
    expect(result.current.open).toMatchObject({ kind: 'demo', data: { space: { name: 'Demo Change' } } })
    // Ignored is not cancelled: the browser did save the space.
    expect((await storedData())?.space.name).toBe('Robin')
    // Leaving the demo opens what the device has now.
    act(() => result.current.closeDemo())
    await waitFor(() => expect(result.current.opening).toBe(false))
    expect(result.current.open).toMatchObject({ kind: 'own', revision: 1, data: { space: { name: 'Robin' } } })
  })

  it('ignores a slow save after switching to the demo; leaving the demo shows it saved', async () => {
    const held = heldStore()
    await held.store.create(robin())
    const { result } = await openWith(held.store)
    held.hold()
    let saving: Promise<unknown> = Promise.resolve()
    act(() => { saving = result.current.update(renamed('Saved Late')) })
    act(() => result.current.openDemo())
    act(() => result.current.closeDemo())
    // Opening waits for the write being saved, so it never shows the space without it.
    expect(result.current.opening).toBe(true)
    await held.release()
    expect(await saving).toBe('stale')
    await waitFor(() => expect(result.current.opening).toBe(false))
    expect(result.current.open).toMatchObject({ kind: 'own', revision: 2, data: { space: { name: 'Saved Late' } } })
  })

  it('ignores a slow erase after switching to the demo, and the space is still erased', async () => {
    const held = heldStore()
    await held.store.create(robin())
    const { result } = await openWith(held.store)
    held.hold()
    let erasing: Promise<unknown> = Promise.resolve()
    act(() => { erasing = result.current.eraseOwnSpace() })
    act(() => result.current.openDemo())
    await held.release()
    expect(await erasing).toBe('stale')
    expect(result.current.open?.kind).toBe('demo')
    expect(await storedData()).toBeNull()
    act(() => result.current.closeDemo())
    await waitFor(() => expect(result.current.opening).toBe(false))
    expect(result.current.open).toBeNull()
    expect(result.current.problem).toBeNull()
  })

  it('ignores an answer that arrives after erasing, so it never brings the space back on screen', async () => {
    const held = heldStore()
    await held.store.create(robin())
    const { result } = await openWith(held.store)
    expect(await act(() => result.current.eraseOwnSpace())).toBe('erased')
    expect(result.current.open).toBeNull()
    // An edit still open on the erased space cannot save anything.
    expect(await act(() => result.current.update(renamed('After Erase'), 1))).toBe('not-saved')
    expect(held.calls).not.toContain('save')
    expect(await storedData()).toBeNull()
  })

  it('creates another space after an erase, and refuses edits started on the erased one', async () => {
    const held = heldStore()
    await held.store.create(renamed('Old Space')(robin()))
    const { result } = await openWith(held.store)
    expect(await act(() => result.current.eraseOwnSpace())).toBe('erased')
    expect(await act(() => result.current.startOwnSpace(renamed('New Space')(robin())))).toBe('saved')
    expect(result.current.open).toMatchObject({ kind: 'own', revision: 2, data: { space: { name: 'New Space' } } })
    // An edit started on the erased space (revision 1) never lands on the new one.
    expect(await act(() => result.current.update(renamed('From Old Form'), 1))).toBe('outdated')
    expect((await storedData())?.space.name).toBe('New Space')
  })
})
