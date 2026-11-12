import { IDBFactory, IDBObjectStore } from 'fake-indexeddb'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createSpaceData } from '../domain/finance/space'
import type { FinanceData } from '../domain/finance/types'
import { NEW_PROGRESS, type GuideProgress } from '../features/home/gettingStarted'
import { memoryStorage } from '../test/memoryStorage'
import { exportFinanceData, importBackup } from './exchange'
import { LEGACY_GUIDE_KEY } from './guideProgress'
import { createIndexedDbStore, DATABASE_NAME, type IndexedDbStore, type IndexedDbStoreOptions } from './indexedDbStore'
import { recoveryFile } from './recovery'
import { OLDER_COPY_KEY } from './savedCopies'
import type { StoreChange } from './spaceStore'

/*
 * GS-6A.1: Getting Started progress in the database (`meta`, one record per
 * space, with its own revision). Each "tab" is its own store on one shared
 * in-memory IndexedDB (fake-indexeddb), as in indexedDbStore.test.ts.
 */

const NOW = '2026-11-12T12:00:00.000Z'
const tabs: IndexedDbStore[] = []

afterEach(() => {
  for (const store of tabs.splice(0)) store.close()
  vi.restoreAllMocks()
})

function tab(factory: IDBFactory | null, storage: Storage | null, extra: Partial<IndexedDbStoreOptions> = {}) {
  const store = createIndexedDbStore({ indexedDB: factory, olderCopy: storage, window: null, now: () => NOW, ...extra })
  tabs.push(store)
  return store
}

function ownSpace(name = 'Robin'): FinanceData {
  const created = createSpaceData({ mode: 'individual', names: [name], currency: 'PLN', theme: 'system' })
  if (created.status !== 'created') throw new Error('setup failed')
  return created.data
}

const renamed = (data: FinanceData, name: string): FinanceData => ({ ...data, space: { ...data.space, name } })
const progress = (change: Partial<GuideProgress> = {}): GuideProgress => ({ ...NEW_PROGRESS, ...change })
const legacy = (spaceId: string, value: unknown) => JSON.stringify({ spaceId, progress: value })

function rawDb(factory: IDBFactory): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = factory.open(DATABASE_NAME, 1)
    request.onupgradeneeded = () => {
      const db = request.result
      db.createObjectStore('spaces')
      db.createObjectStore('meta')
      db.createObjectStore('quarantine', { autoIncrement: true })
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

async function rawAll(factory: IDBFactory, store: 'spaces' | 'meta' | 'quarantine'): Promise<{ keys: IDBValidKey[]; values: unknown[] }> {
  const db = await rawDb(factory)
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(store, 'readonly')
      const keys = tx.objectStore(store).getAllKeys()
      const values = tx.objectStore(store).getAll()
      tx.oncomplete = () => resolve({ keys: keys.result, values: values.result })
      tx.onerror = () => reject(tx.error)
    })
  } finally {
    db.close()
  }
}

async function rawGet(factory: IDBFactory, store: 'spaces' | 'meta', key: string): Promise<unknown> {
  const all = await rawAll(factory, store)
  const index = all.keys.indexOf(key)
  return index === -1 ? undefined : all.values[index]
}

async function rawPut(factory: IDBFactory, store: 'spaces' | 'meta', key: string, value: unknown): Promise<void> {
  const db = await rawDb(factory)
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(store, 'readwrite')
      tx.objectStore(store).put(value, key)
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
  } finally {
    db.close()
  }
}

const guideKeys = async (factory: IDBFactory) => (await rawAll(factory, 'meta')).keys.filter(key => String(key).startsWith('guide-progress:'))

function gate() {
  let open!: () => void
  const passed = new Promise<void>(resolve => { open = resolve })
  return { passed, open }
}
const settle = () => new Promise(resolve => setTimeout(resolve, 20))

/** A store with its own space created (revision 1). */
async function created(factory = new IDBFactory(), storage: Storage = memoryStorage()) {
  const store = tab(factory, storage)
  const data = ownSpace()
  await store.create(data)
  return { factory, storage, store, data, id: data.space.id }
}

describe('Getting Started progress: saving and loading (GS-6A.1)', () => {
  it('starts with nothing saved (revision 0), saves per space with its own revision, and keeps it for a new tab', async () => {
    const { factory, storage, store, id } = await created()
    expect(await store.loadProgress(id)).toEqual({ status: 'loaded', progress: NEW_PROGRESS, revision: 0 })
    expect(await guideKeys(factory)).toEqual([])
    expect(await store.saveProgress(id, progress({ skipped: ['accounts'], last: 'income' }), 0)).toEqual({ status: 'saved', revision: 1 })
    expect(await store.saveProgress(id, progress({ finished: true, skipped: ['accounts'] }), 1)).toEqual({ status: 'saved', revision: 2 })
    expect(await rawGet(factory, 'meta', `guide-progress:${id}`)).toEqual({
      format: 1, spaceId: id, revision: 2, savedAt: NOW, progress: progress({ finished: true, skipped: ['accounts'] }),
    })
    // A reload (another tab, the next visit): finished stays.
    expect(await tab(factory, storage).loadProgress(id)).toEqual({ status: 'loaded', progress: progress({ finished: true, skipped: ['accounts'] }), revision: 2 })
  })

  it('keeps a saved "finished: false" apart from nothing saved', async () => {
    const { factory, storage, store, id } = await created()
    expect(await store.saveProgress(id, progress({ hidden: true }), 0)).toEqual({ status: 'saved', revision: 1 })
    // Even with an older finished value in localStorage, the saved progress (finished: false) is what opens.
    storage.setItem(LEGACY_GUIDE_KEY, legacy(id, { version: 2, hidden: false, skipped: [], none: [], finished: true, last: null }))
    expect(await tab(factory, storage).loadProgress(id)).toEqual({ status: 'loaded', progress: progress({ hidden: true }), revision: 1 })
  })

  it('never changes the space: its records, envelope and revision stay as they were', async () => {
    const { factory, store, data, id } = await created()
    await store.save(renamed(data, 'Second'), 1)
    const before = await rawAll(factory, 'spaces')
    for (let revision = 0; revision < 4; revision++) await store.saveProgress(id, progress({ last: revision % 2 ? 'income' : 'accounts' }), revision)
    expect(await rawAll(factory, 'spaces')).toEqual(before)
    expect(await store.load()).toMatchObject({ status: 'loaded', space: { revision: 2 } })
    // A form opened on revision 2 still saves.
    expect(await store.save(renamed(data, 'Third'), 2)).toEqual({ status: 'saved', revision: 3 })
  })

  it('refuses an older revision (another tab saved first) and writes nothing over it', async () => {
    const { factory, storage, store, id } = await created()
    const other = tab(factory, storage)
    expect(await other.saveProgress(id, progress({ skipped: ['income'] }), 0)).toEqual({ status: 'saved', revision: 1 })
    expect(await store.saveProgress(id, progress({ finished: true }), 0)).toEqual({
      status: 'conflict', latest: { progress: progress({ skipped: ['income'] }), revision: 1 },
    })
    expect(await store.loadProgress(id)).toEqual({ status: 'loaded', progress: progress({ skipped: ['income'] }), revision: 1 })
  })

  it('says "failed" and writes nothing when the browser refuses or the transaction does not finish', async () => {
    const { factory, store, id } = await created()
    vi.spyOn(IDBObjectStore.prototype, 'put').mockImplementation(() => { throw new DOMException('The disk is full.', 'QuotaExceededError') })
    expect(await store.saveProgress(id, progress({ finished: true }), 0)).toEqual({ status: 'failed' })
    vi.restoreAllMocks()
    const put = IDBObjectStore.prototype.put
    vi.spyOn(IDBObjectStore.prototype, 'put').mockImplementation(function (this: IDBObjectStore, ...args: Parameters<IDBObjectStore['put']>) {
      const request = put.apply(this, args)
      // The write succeeds, then the transaction is stopped before it finishes.
      request.addEventListener('success', () => this.transaction.abort())
      return request
    })
    expect(await store.saveProgress(id, progress({ finished: true }), 0)).toEqual({ status: 'failed' })
    vi.restoreAllMocks()
    expect(await guideKeys(factory)).toEqual([])
    expect(await store.loadProgress(id)).toEqual({ status: 'loaded', progress: NEW_PROGRESS, revision: 0 })
  })

  it('refuses progress that does not pass the check, and progress for a space that is not open', async () => {
    const { factory, store, id } = await created()
    expect(await store.saveProgress(id, { ...NEW_PROGRESS, skipped: ['finish'] } as GuideProgress, 0)).toEqual({ status: 'failed' })
    expect(await store.saveProgress('another-space', progress(), 0)).toEqual({ status: 'conflict', latest: null })
    expect(await store.loadProgress('another-space')).toEqual({ status: 'failed' })
    expect(await guideKeys(factory)).toEqual([])
  })

  it('tells other tabs that the progress changed, with its own revision, and never the tab that saved it', async () => {
    const { factory, storage, store, id } = await created()
    const other = tab(factory, storage)
    const heardHere: StoreChange[] = []
    const heardThere: StoreChange[] = []
    const stops = [store.watch(change => heardHere.push(change)), other.watch(change => heardThere.push(change))]
    await store.saveProgress(id, progress({ last: 'income' }), 0)
    await settle()
    stops.forEach(stop => stop())
    expect(heardHere).toEqual([])
    expect(heardThere).toEqual([{ kind: 'progress-saved', spaceId: id, revision: 1 }])
  })

  it('a browser that cannot use its database shows what localStorage had and saves nothing', async () => {
    const storage = memoryStorage()
    storage.setItem(LEGACY_GUIDE_KEY, legacy('my-space', { version: 2, hidden: false, skipped: ['income'], none: [], finished: true, last: null }))
    const store = tab(null, storage)
    expect(await store.loadProgress('my-space')).toEqual({ status: 'unavailable', progress: progress({ skipped: ['income'], finished: true }) })
    expect(await store.saveProgress('my-space', progress(), 0)).toEqual({ status: 'failed' })
  })
})

describe('Getting Started progress: bringing in what localStorage had (GS-6A.1)', () => {
  it('brings in valid v2 progress of this space once, and leaves the old value where it was', async () => {
    const { factory, storage, store, id } = await created()
    const old = legacy(id, { version: 2, hidden: false, skipped: ['accounts'], none: ['debts'], finished: true, last: 'finish' })
    storage.setItem(LEGACY_GUIDE_KEY, old)
    const changes: StoreChange[] = []
    const stop = tab(factory, storage).watch(change => changes.push(change))
    const expected = progress({ skipped: ['accounts'], none: ['debts'], finished: true, last: 'finish' })
    expect(await store.loadProgress(id)).toEqual({ status: 'loaded', progress: expected, revision: 1 })
    await settle()
    stop()
    expect(changes).toEqual([{ kind: 'progress-saved', spaceId: id, revision: 1 }])
    expect(storage.getItem(LEGACY_GUIDE_KEY)).toBe(old)
    // Again (a reload, a retry): the same record, never a second one, never a later revision.
    expect(await store.loadProgress(id)).toEqual({ status: 'loaded', progress: expected, revision: 1 })
    expect(await guideKeys(factory)).toEqual([`guide-progress:${id}`])
  })

  it('reads progress from before v1.0 with the tolerant reading (day-to-day is Finish; an old "none" stays skipped)', async () => {
    const { storage, store, id } = await created()
    storage.setItem(LEGACY_GUIDE_KEY, legacy(id, { hidden: true, skipped: ['income', 'day-to-day', 'debts'], finished: false }))
    expect(await store.loadProgress(id)).toEqual({ status: 'loaded', progress: progress({ hidden: true, skipped: ['income', 'debts'] }), revision: 1 })
  })

  it('ignores another space’s progress, a damaged value and nothing at all: a new guide, and nothing is written', async () => {
    for (const value of [legacy('another-space', { version: 2, hidden: true, skipped: [], none: [], finished: true, last: null }), '{ not json', null]) {
      const { factory, storage, store, id } = await created()
      if (value !== null) storage.setItem(LEGACY_GUIDE_KEY, value)
      expect(await store.loadProgress(id)).toEqual({ status: 'loaded', progress: NEW_PROGRESS, revision: 0 })
      expect(await guideKeys(factory)).toEqual([])
    }
  })

  it('never finishes the guide because the space has records', async () => {
    const factory = new IDBFactory()
    const store = tab(factory, memoryStorage())
    const { createAlexDemo } = await import('./fixtures/demoAlex')
    const full = { ...createAlexDemo(), space: { ...createAlexDemo().space, id: 'full-space' } }
    expect(await store.create(full)).toMatchObject({ status: 'saved' })
    expect(await store.loadProgress('full-space')).toEqual({ status: 'loaded', progress: NEW_PROGRESS, revision: 0 })
  })

  it('an interrupted copy leaves nothing half-written: the old value is shown, kept, and brought in next time', async () => {
    const { factory, storage, store, id } = await created()
    const old = legacy(id, { version: 2, hidden: false, skipped: ['income'], none: [], finished: true, last: null })
    storage.setItem(LEGACY_GUIDE_KEY, old)
    vi.spyOn(IDBObjectStore.prototype, 'add').mockImplementation(() => { throw new DOMException('The disk is full.', 'QuotaExceededError') })
    expect(await store.loadProgress(id)).toEqual({ status: 'loaded', progress: progress({ skipped: ['income'], finished: true }), revision: 0 })
    vi.restoreAllMocks()
    expect(await guideKeys(factory)).toEqual([])
    expect(storage.getItem(LEGACY_GUIDE_KEY)).toBe(old)
    expect(await store.loadProgress(id)).toEqual({ status: 'loaded', progress: progress({ skipped: ['income'], finished: true }), revision: 1 })
  })

  it('two tabs bringing it in at the same time make one record', async () => {
    const { factory, storage, id } = await created()
    storage.setItem(LEGACY_GUIDE_KEY, legacy(id, { version: 2, hidden: false, skipped: ['bills'], none: [], finished: false, last: 'goals' }))
    const gates = [gate(), gate()]
    const tabs2 = gates.map(held => tab(factory, storage, { pause: async step => { if (step === 'before-guide-copy') await held.passed } }))
    const loads = tabs2.map(store => store.loadProgress(id))
    await settle()
    gates[0].open()
    gates[1].open()
    const expected = { status: 'loaded', progress: progress({ skipped: ['bills'], last: 'goals' }), revision: 1 }
    expect(await Promise.all(loads)).toEqual([expected, expected])
    expect(await guideKeys(factory)).toEqual([`guide-progress:${id}`])
  })

  it('never writes over progress saved while it was bringing the old value in (another tab, a restore)', async () => {
    const { factory, storage, store, data, id } = await created()
    storage.setItem(LEGACY_GUIDE_KEY, legacy(id, { version: 2, hidden: false, skipped: [], none: [], finished: true, last: null }))
    const held = gate()
    const slow = tab(factory, storage, { pause: async step => { if (step === 'before-guide-copy') await held.passed } })
    const pending = slow.loadProgress(id)
    await settle()
    // Meanwhile a backup with an unfinished guide is restored.
    expect(await store.restore(renamed(data, 'Restored'), 1, { kind: 'replace', progress: progress({ last: 'debts' }) })).toEqual({ status: 'saved', revision: 2 })
    held.open()
    expect(await pending).toEqual({ status: 'loaded', progress: progress({ last: 'debts' }), revision: 1 })
    expect(await store.loadProgress(id)).toEqual({ status: 'loaded', progress: progress({ last: 'debts' }), revision: 1 })
  })

  it('does not bring in a value written by a newer version', async () => {
    const { factory, storage, store, id } = await created()
    storage.setItem(LEGACY_GUIDE_KEY, legacy(id, { version: 3, hidden: true, skipped: [], none: [], finished: true, last: null }))
    expect(await store.loadProgress(id)).toEqual({ status: 'loaded', progress: NEW_PROGRESS, revision: 0 })
    expect(await guideKeys(factory)).toEqual([])
  })
})

describe('Getting Started progress: from a newer version, or damaged (GS-6A.1)', () => {
  it('is never read as finished and never written over by a normal change', async () => {
    const cases: [unknown, string][] = [
      [{ format: 2, spaceId: 'my-space', revision: 3, savedAt: NOW, progress: { finished: true }, extra: 'kept' }, 'newer-version'],
      [{ format: 1, spaceId: 'my-space', revision: 3, savedAt: NOW, progress: { version: 3, hidden: false, skipped: [], none: [], finished: true, last: null, mood: 'x' } }, 'newer-version'],
      [{ format: 1, spaceId: 'my-space', revision: 3, savedAt: NOW, progress: { version: 2, finished: 'yes' } }, 'broken'],
      ['damaged', 'broken'],
    ]
    for (const [raw, reason] of cases) {
      const { factory, store, id } = await created()
      await rawPut(factory, 'meta', `guide-progress:${id}`, raw)
      const loaded = await store.loadProgress(id)
      expect(loaded).toMatchObject({ status: 'locked', reason, progress: NEW_PROGRESS })
      expect(await store.saveProgress(id, progress({ finished: true }), 3)).toEqual({ status: 'failed' })
      expect(await store.saveProgress(id, progress({ finished: true }), 0)).toEqual({ status: 'failed' })
      // Unknown fields are kept as they were.
      expect(await rawGet(factory, 'meta', `guide-progress:${id}`)).toEqual(raw)
      // The space itself still opens.
      expect(await store.load()).toMatchObject({ status: 'loaded', space: { revision: 1 } })
    }
  })
})

describe('Restore Backup with Getting Started progress (GS-6A.1)', () => {
  it('replaces the records and the progress in one save, and the space id stays', async () => {
    const { factory, store, data, id } = await created()
    await store.saveProgress(id, progress({ last: 'income' }), 0)
    const backup = renamed(data, 'From the file')
    expect(await store.restore(backup, 1, { kind: 'replace', progress: progress({ finished: true, skipped: ['debts'] }) })).toEqual({ status: 'saved', revision: 2 })
    expect(await store.load()).toMatchObject({ status: 'loaded', space: { revision: 2, data: { space: { id, name: 'From the file' } } } })
    expect(await store.loadProgress(id)).toEqual({ status: 'loaded', progress: progress({ finished: true, skipped: ['debts'] }), revision: 2 })
    expect(await guideKeys(factory)).toEqual([`guide-progress:${id}`])
  })

  it('restores "finished: false" too', async () => {
    const { store, data, id } = await created()
    await store.saveProgress(id, progress({ finished: true }), 0)
    await store.restore(data, 1, { kind: 'replace', progress: progress({ skipped: ['income'] }) })
    expect(await store.loadProgress(id)).toEqual({ status: 'loaded', progress: progress({ skipped: ['income'] }), revision: 2 })
  })

  it('an older backup (records only) keeps the space’s own progress', async () => {
    const { store, data, id } = await created()
    await store.saveProgress(id, progress({ finished: true, none: ['income'] }), 0)
    expect(await store.restore(renamed(data, 'Old file'), 1, { kind: 'keep' })).toEqual({ status: 'saved', revision: 2 })
    expect(await store.loadProgress(id)).toEqual({ status: 'loaded', progress: progress({ finished: true, none: ['income'] }), revision: 1 })
  })

  it('an older backup on a space with nothing saved: a guide not finished (or what localStorage had), and no later copy changes it', async () => {
    const { storage, store, data, id } = await created()
    expect(await store.restore(data, 1, { kind: 'keep' })).toEqual({ status: 'saved', revision: 2 })
    expect(await store.loadProgress(id)).toEqual({ status: 'loaded', progress: NEW_PROGRESS, revision: 1 })
    // A finished value appearing in localStorage afterwards is never brought in: the restored progress was saved.
    storage.setItem(LEGACY_GUIDE_KEY, legacy(id, { version: 2, hidden: false, skipped: [], none: [], finished: true, last: null }))
    expect(await store.loadProgress(id)).toEqual({ status: 'loaded', progress: NEW_PROGRESS, revision: 1 })

    const second = await created()
    second.storage.setItem(LEGACY_GUIDE_KEY, legacy(second.id, { version: 2, hidden: false, skipped: ['bills'], none: [], finished: true, last: null }))
    await second.store.restore(second.data, 1, { kind: 'keep' })
    expect(await second.store.loadProgress(second.id)).toEqual({ status: 'loaded', progress: progress({ skipped: ['bills'], finished: true }), revision: 1 })
  })

  it('writes neither the records nor the progress when the space changed meanwhile', async () => {
    const { factory, storage, store, data, id } = await created()
    await tab(factory, storage).save(renamed(data, 'Other tab'), 1)
    const before = { spaces: await rawAll(factory, 'spaces'), meta: await rawAll(factory, 'meta') }
    expect(await store.restore(renamed(data, 'Stale'), 1, { kind: 'replace', progress: progress({ finished: true }) })).toMatchObject({ status: 'conflict' })
    expect({ spaces: await rawAll(factory, 'spaces'), meta: await rawAll(factory, 'meta') }).toEqual(before)
    expect(await store.loadProgress(id)).toEqual({ status: 'loaded', progress: NEW_PROGRESS, revision: 0 })
  })

  it('writes neither when the transaction fails part-way (the progress write fails after the records were written)', async () => {
    const { factory, store, data, id } = await created()
    await store.saveProgress(id, progress({ last: 'income' }), 0)
    const before = { spaces: await rawAll(factory, 'spaces'), meta: await rawAll(factory, 'meta') }
    const put = IDBObjectStore.prototype.put
    vi.spyOn(IDBObjectStore.prototype, 'put').mockImplementation(function (this: IDBObjectStore, ...args: Parameters<IDBObjectStore['put']>) {
      if (String(args[1]).startsWith('guide-progress:')) throw new DOMException('The disk is full.', 'QuotaExceededError')
      return put.apply(this, args)
    })
    expect(await store.restore(renamed(data, 'Half'), 1, { kind: 'replace', progress: progress({ finished: true }) })).toEqual({ status: 'failed' })
    vi.restoreAllMocks()
    expect({ spaces: await rawAll(factory, 'spaces'), meta: await rawAll(factory, 'meta') }).toEqual(before)
  })

  it('sets aside progress it cannot use before the backup’s replaces it; an older backup leaves a newer version’s progress alone', async () => {
    const newer = { format: 2, spaceId: 'my-space', revision: 4, savedAt: NOW, progress: { finished: true } }
    const first = await created()
    await rawPut(first.factory, 'meta', `guide-progress:${first.id}`, newer)
    await first.store.restore(first.data, 1, { kind: 'keep' })
    expect(await rawGet(first.factory, 'meta', `guide-progress:${first.id}`)).toEqual(newer)

    const second = await created()
    await rawPut(second.factory, 'meta', `guide-progress:${second.id}`, newer)
    expect(await second.store.restore(second.data, 1, { kind: 'replace', progress: progress({ last: 'bills' }) })).toEqual({ status: 'saved', revision: 2 })
    expect(await second.store.loadProgress(second.id)).toEqual({ status: 'loaded', progress: progress({ last: 'bills' }), revision: 5 })
    expect((await rawAll(second.factory, 'quarantine')).values).toEqual([{ movedAt: NOW, spaceId: second.id, guideProgress: newer }])
  })

  it('refuses progress that does not pass the check, writing nothing', async () => {
    const { factory, store, data } = await created()
    const before = await rawAll(factory, 'spaces')
    expect(await store.restore(data, 1, { kind: 'replace', progress: { ...NEW_PROGRESS, version: 3 } as unknown as GuideProgress })).toEqual({ status: 'failed' })
    expect(await rawAll(factory, 'spaces')).toEqual(before)
  })
})

describe('Erase, a new space, Use Older Copy and Download Both Copies with progress (GS-6A.1)', () => {
  it('Erase removes every space’s progress and the old localStorage value; a new space starts a new guide', async () => {
    const { factory, storage, store, id } = await created()
    await store.saveProgress(id, progress({ finished: true }), 0)
    await rawPut(factory, 'meta', 'guide-progress:left-by-an-older-erase', { format: 1, spaceId: 'left-by-an-older-erase', revision: 1, savedAt: NOW, progress: progress() })
    storage.setItem(LEGACY_GUIDE_KEY, legacy(id, { version: 2, hidden: false, skipped: [], none: [], finished: true, last: null }))
    expect(await store.erase()).toEqual({ status: 'erased' })
    expect(await guideKeys(factory)).toEqual([])
    expect(storage.getItem(LEGACY_GUIDE_KEY)).toBeNull()
    const next = { ...ownSpace('Kim'), space: { ...ownSpace('Kim').space, id: 'new-space' } }
    await store.create(next)
    expect(await store.loadProgress('new-space')).toEqual({ status: 'loaded', progress: NEW_PROGRESS, revision: 0 })
  })

  it('a new space never takes progress left under its id', async () => {
    const factory = new IDBFactory()
    await rawPut(factory, 'meta', 'guide-progress:my-space', { format: 1, spaceId: 'my-space', revision: 3, savedAt: NOW, progress: progress({ finished: true }) })
    const store = tab(factory, memoryStorage())
    await store.create(ownSpace())
    expect(await store.loadProgress('my-space')).toEqual({ status: 'loaded', progress: NEW_PROGRESS, revision: 0 })
  })

  it('Use Older Copy: progress follows the space id that opens; a space set aside takes its progress to quarantine', async () => {
    const factory = new IDBFactory()
    const older = ownSpace()
    const storage = memoryStorage()
    storage.setItem(OLDER_COPY_KEY, exportFinanceData(older))
    const damaged = { format: 1, revision: 4, savedAt: NOW, data: 'damaged' }
    const record = { format: 1, spaceId: 'broken-space', revision: 2, savedAt: NOW, progress: progress({ finished: true }) }
    await rawPut(factory, 'spaces', 'broken-space', damaged)
    await rawPut(factory, 'meta', 'current-space', 'broken-space')
    await rawPut(factory, 'meta', 'guide-progress:broken-space', record)
    const store = tab(factory, storage)
    expect(await store.load()).toMatchObject({ status: 'unreadable', olderCopy: true })
    expect(await store.useOlderCopy()).toMatchObject({ status: 'saved' })
    expect(await guideKeys(factory)).toEqual([])
    expect((await rawAll(factory, 'quarantine')).values).toEqual([
      { movedAt: NOW, spaceId: 'broken-space', value: damaged },
      { movedAt: NOW, spaceId: 'broken-space', guideProgress: record },
    ])
    expect(await store.loadProgress(older.space.id)).toEqual({ status: 'loaded', progress: NEW_PROGRESS, revision: 0 })

    // Same id: the progress stays with it.
    const sameFactory = new IDBFactory()
    const sameRecord = { format: 1, spaceId: 'my-space', revision: 2, savedAt: NOW, progress: progress({ finished: true }) }
    await rawPut(sameFactory, 'spaces', 'my-space', damaged)
    await rawPut(sameFactory, 'meta', 'current-space', 'my-space')
    await rawPut(sameFactory, 'meta', 'guide-progress:my-space', sameRecord)
    const same = tab(sameFactory, storage)
    await same.load()
    expect(await same.useOlderCopy()).toMatchObject({ status: 'saved' })
    expect(await same.loadProgress('my-space')).toEqual({ status: 'loaded', progress: progress({ finished: true }), revision: 2 })
  })

  it('Download Both Copies holds every progress record and the old value as stored, and Restore Backup still refuses it', async () => {
    const { factory, storage, store, id } = await created()
    await store.saveProgress(id, progress({ finished: true }), 0)
    const old = legacy(id, { hidden: true })
    storage.setItem(LEGACY_GUIDE_KEY, old)
    const before = await rawAll(factory, 'meta')
    const copies = await store.exportCopies()
    expect(copies.database?.guideProgress).toEqual([{ key: `guide-progress:${id}`, stored: await rawGet(factory, 'meta', `guide-progress:${id}`) }])
    expect(copies.olderGuideProgress).toBe(old)
    expect(await rawAll(factory, 'meta')).toEqual(before)
    expect(importBackup(recoveryFile(copies, NOW))).toEqual({ status: 'rejected', errors: ['This is a recovery file, not a backup. It cannot be restored here.'] })
  })
})
