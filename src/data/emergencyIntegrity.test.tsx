// @vitest-environment jsdom
import { act, renderHook, waitFor } from '@testing-library/react'
import { IDBFactory, IDBObjectStore } from 'fake-indexeddb'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createIndexedDbStore, type IndexedDbStore } from './indexedDbStore'
import { createDemoHousehold, DEMO_TODAY } from './fixtures/demoHousehold'
import { createEmergencyFundFromDraft, restoreEmergencyFund } from '../domain/finance/emergency'
import { memoryStorage } from '../test/memoryStorage'
import { freshDatabaseForEachTest, storedData } from '../test/space'
import { browserSpaceStore, useSpace } from '../app/useSpace'
import type { FinanceData } from '../domain/finance/types'

freshDatabaseForEachTest()
const opened: IndexedDbStore[] = []
afterEach(() => { opened.splice(0).forEach(s => s.close()); vi.restoreAllMocks() })
function store(factory: IDBFactory) {
  const s = createIndexedDbStore({ indexedDB: factory, olderCopy: memoryStorage(), window: null })
  opened.push(s); return s
}
function create(data: FinanceData, id = 'new-fund') {
  const r = createEmergencyFundFromDraft(data, { goalId: id, movementId: `${id}-move` }, 'shared', DEMO_TODAY, { target: null, alreadySetAside: 0 })
  if (r.status !== 'ok') throw Error(r.error)
  return r.data
}
function archived() {
  const d = create(createDemoHousehold())
  return { ...d, goals: d.goals.map(g => g.kind === 'emergency' ? { ...g, status: 'archived' as const } : g) }
}
function restore(d: FinanceData) {
  const r = restoreEmergencyFund(d)
  if (r.status !== 'ok') throw Error(r.error)
  return r.data
}
describe('R2 existing persistence routes', () => {
  it('two tabs creating from the same revision cannot retain two funds', async () => {
    const factory = new IDBFactory(); const a = store(factory); const b = store(factory); const d = createDemoHousehold()
    expect((await a.create(d)).status).toBe('saved')
    const outcomes = await Promise.all([a.save(create(d, 'fund-a'), 1), b.save(create(d, 'fund-b'), 1)])
    expect(outcomes.map(o => o.status).sort()).toEqual(['conflict', 'saved'])
    const loaded = await a.load()
    if (loaded.status !== 'loaded') throw Error('not loaded')
    expect(loaded.space.data.goals.filter(g => g.kind === 'emergency')).toHaveLength(1)
  })
  it('two stale restore attempts preserve one identity and history', async () => {
    const factory = new IDBFactory(); const a = store(factory); const b = store(factory); const d = archived()
    await a.create(d)
    const outcomes = await Promise.all([a.save(restore(d), 1), b.save(restore(d), 1)])
    expect(outcomes.map(o => o.status).sort()).toEqual(['conflict', 'saved'])
    const loaded = await b.load()
    if (loaded.status !== 'loaded') throw Error('not loaded')
    expect(loaded.space.data).toEqual(restore(d))
    expect(restore(loaded.space.data)).toBe(loaded.space.data)
  })
  it('failed persistence retains the archived records', async () => {
    const a = store(new IDBFactory()); const d = archived(); await a.create(d)
    const spy = vi.spyOn(IDBObjectStore.prototype, 'put').mockImplementation(() => { throw new Error('simulated failure') })
    expect((await a.save(restore(d), 1)).status).toBe('failed'); spy.mockRestore()
    const loaded = await a.load()
    if (loaded.status !== 'loaded') throw Error('not loaded')
    expect(loaded.space.data).toEqual(d)
  })
  it('Demo restore and duplicate refusal cannot change the own space', async () => {
    const own = archived(); const s = browserSpaceStore(null); await s.create(own)
    const demo = archived()
    const { result, unmount } = renderHook(() => useSpace(null, () => DEMO_TODAY, () => ({ data: structuredClone(demo), today: DEMO_TODAY }), undefined, () => s))
    await waitFor(() => expect(result.current.open?.kind).toBe('own'))
    act(() => { expect(result.current.openDemo()).toBe('opened') })
    expect(await act(() => result.current.update(restore))).toBe('demo')
    const visible = result.current.open!.data
    expect(createEmergencyFundFromDraft(visible, { goalId: 'duplicate', movementId: 'duplicate-move' }, 'shared', DEMO_TODAY, { target: null, alreadySetAside: 0 })).toEqual({ status: 'rejected', error: 'fund-exists' })
    expect(await storedData()).toEqual(own)
    act(() => { result.current.closeDemo() })
    await waitFor(() => expect(result.current.open?.kind).toBe('own'))
    expect(result.current.open?.data).toEqual(own)
    unmount()
  })
})
