import { IDBFactory, IDBObjectStore } from 'fake-indexeddb'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createSpaceData } from '../domain/finance/space'
import type { FinanceData } from '../domain/finance/types'
import { memoryStorage } from '../test/memoryStorage'
import { exportFinanceData } from './exchange'
import { createAlexDemo } from './fixtures/demoAlex'
import { createIndexedDbStore, DATABASE_NAME, type IndexedDbStore, type IndexedDbStoreOptions } from './indexedDbStore'
import { ERASED_KEY, OLDER_COPY_KEY, readData } from './savedCopies'

/*
 * Each "tab" is its own store with its own database connection, on one
 * shared in-memory IndexedDB (fake-indexeddb), the way two browser tabs
 * share one database.
 */

const NOW = '2026-10-28T12:00:00.000Z'
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

/** localStorage with the older copy in it, as versions before the database left it. */
function withOlderCopy(data: FinanceData): Storage {
  const storage = memoryStorage()
  storage.setItem(OLDER_COPY_KEY, exportFinanceData(data))
  return storage
}

/** The records as the app reads them back (checked and brought up to date). */
function checked(data: FinanceData): FinanceData {
  const reading = readData(data)
  if (!reading.ok) throw new Error('fixture does not read back')
  return reading.value
}

/** Opens the database directly, as a third party, to look at (or plant) what is stored. */
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

/** A step that waits until the test lets it go on. */
function gate() {
  let open!: () => void
  const passed = new Promise<void>(resolve => { open = resolve })
  return { passed, open }
}

/** Lets a running step reach its next pause. */
const settle = () => new Promise(resolve => setTimeout(resolve, 20))

describe('IndexedDB store: saving', () => {
  it('starts empty, creates a space at revision 1 and refuses a second one', async () => {
    const factory = new IDBFactory()
    const store = tab(factory, memoryStorage())
    expect(await store.load()).toEqual({ status: 'empty' })
    const data = ownSpace()
    expect(await store.create(data)).toEqual({ status: 'saved', revision: 1 })
    expect(await store.load()).toEqual({ status: 'loaded', space: { data, revision: 1 } })
    expect(await store.create(ownSpace('Kim'))).toMatchObject({ status: 'conflict', latest: { revision: 1 } })
  })

  it('saves on the current revision and refuses an older one without writing anything', async () => {
    const factory = new IDBFactory()
    const store = tab(factory, memoryStorage())
    const data = ownSpace()
    await store.create(data)
    expect(await store.save(renamed(data, 'Second'), 1)).toEqual({ status: 'saved', revision: 2 })
    const stale = await store.save(renamed(data, 'Stale'), 1)
    expect(stale).toEqual({ status: 'conflict', latest: { data: renamed(data, 'Second'), revision: 2 } })
    expect(await store.load()).toMatchObject({ status: 'loaded', space: { revision: 2, data: { space: { name: 'Second' } } } })
  })

  it('says "saved" only when the whole transaction finished, not when the write request did', async () => {
    const factory = new IDBFactory()
    const store = tab(factory, memoryStorage())
    const data = ownSpace()
    await store.create(data)
    const put = IDBObjectStore.prototype.put
    vi.spyOn(IDBObjectStore.prototype, 'put').mockImplementation(function (this: IDBObjectStore, ...args: Parameters<IDBObjectStore['put']>) {
      const request = put.apply(this, args)
      // The write succeeds, then the transaction fails before it finishes (as when the disk refuses at commit).
      request.addEventListener('success', () => this.transaction.abort())
      return request
    })
    expect(await store.save(renamed(data, 'Lost'), 1)).toEqual({ status: 'failed' })
    vi.restoreAllMocks()
    expect(await store.load()).toEqual({ status: 'loaded', space: { data, revision: 1 } })
  })

  it('never lets a tab still open on an erased space save over a space started after it', async () => {
    const factory = new IDBFactory()
    const old = tab(factory, memoryStorage())
    const other = tab(factory, memoryStorage())
    await old.create(ownSpace('Old'))
    expect(await old.save(ownSpace('Old, edited'), 1)).toEqual({ status: 'saved', revision: 2 })
    // Another tab erases it and starts a new space under the same id.
    expect(await other.erase()).toEqual({ status: 'erased' })
    expect(await other.create(ownSpace('New'))).toEqual({ status: 'saved', revision: 3 })
    // The first tab still holds revision 2 of the erased space.
    expect(await old.save(ownSpace('Old, saved late'), 2)).toMatchObject({ status: 'conflict', latest: { revision: 3 } })
    expect(await other.load()).toEqual({ status: 'loaded', space: { data: ownSpace('New'), revision: 3 } })
    // Erasing again keeps counting from there.
    await other.erase()
    expect(await other.create(ownSpace('Newer'))).toEqual({ status: 'saved', revision: 4 })
  })

  it('lets exactly one of two tabs save on the same revision, every time', async () => {
    const factory = new IDBFactory()
    const first = tab(factory, memoryStorage())
    const second = tab(factory, memoryStorage())
    const data = ownSpace()
    await first.create(data)
    for (let round = 1; round <= 20; round++) {
      const [a, b] = await Promise.all([first.save(renamed(data, `A${round}`), round), second.save(renamed(data, `B${round}`), round)])
      const results = [a.status, b.status].sort()
      expect(results).toEqual(['conflict', 'saved'])
      const winner = a.status === 'saved' ? `A${round}` : `B${round}`
      expect(await first.load()).toMatchObject({ status: 'loaded', space: { revision: round + 1, data: { space: { name: winner } } } })
    }
  })

  it('never writes records that would not read back', async () => {
    const factory = new IDBFactory()
    const store = tab(factory, memoryStorage())
    const data = ownSpace()
    await store.create(data)
    const broken = { ...data, bills: [{ id: 'x' }] } as unknown as FinanceData
    expect(await store.save(broken, 1)).toEqual({ status: 'failed' })
    expect(await store.load()).toEqual({ status: 'loaded', space: { data, revision: 1 } })
  })
})

describe('IndexedDB store: bringing in the older copy', () => {
  it("copies Alex's whole year without changing a record, leaves the older copy as it was, and does it once", async () => {
    const factory = new IDBFactory()
    const alex = createAlexDemo()
    const storage = withOlderCopy(alex)
    const before = storage.getItem(OLDER_COPY_KEY)
    const loaded = await tab(factory, storage).load()
    expect(loaded).toEqual({ status: 'loaded', space: { data: checked(alex), revision: 1 } })
    if (loaded.status !== 'loaded') return
    expect(loaded.space.data.expenses.length + loaded.space.data.income.length + loaded.space.data.transfers.length).toBeGreaterThan(0)
    expect(storage.getItem(OLDER_COPY_KEY)).toBe(before)
    expect((await rawAll(factory, 'meta')).values.sort()).toEqual(['migrated', alex.space.id].sort())

    // A later visit uses the database; a changed older copy is not brought in again.
    storage.setItem(OLDER_COPY_KEY, exportFinanceData(renamed(alex, 'Changed later')))
    expect(await tab(factory, storage).load()).toEqual({ status: 'loaded', space: { data: checked(alex), revision: 1 } })
    expect((await rawAll(factory, 'spaces')).keys).toEqual([alex.space.id])
  })

  it('activates the copy only after checking it: stopped before activating, the next visit finishes without a second copy', async () => {
    const factory = new IDBFactory()
    const data = ownSpace()
    const storage = withOlderCopy(data)
    const interrupted = tab(factory, storage, { pause: async step => { if (step === 'before-activate') throw new Error('page closed') } })
    expect(await interrupted.load()).toMatchObject({ status: 'read-only', mayBeOutdated: true, space: { data: checked(data) } })
    expect((await rawAll(factory, 'spaces')).keys).toEqual(['my-space'])
    expect((await rawAll(factory, 'meta')).keys).toEqual([])

    expect(await tab(factory, storage).load()).toEqual({ status: 'loaded', space: { data: checked(data), revision: 1 } })
    expect((await rawAll(factory, 'spaces')).keys).toEqual(['my-space'])
    expect((await rawAll(factory, 'meta')).keys.sort()).toEqual(['current-space', 'legacy'])
  })

  it('leaves nothing half-written when the copy itself fails, and tries again next time', async () => {
    const factory = new IDBFactory()
    const data = ownSpace()
    const storage = withOlderCopy(data)
    const add = IDBObjectStore.prototype.add
    vi.spyOn(IDBObjectStore.prototype, 'add').mockImplementation(function (this: IDBObjectStore, ...args: Parameters<IDBObjectStore['add']>) {
      const request = add.apply(this, args)
      request.addEventListener('success', () => this.transaction.abort())
      return request
    })
    expect(await tab(factory, storage).load()).toMatchObject({ status: 'read-only', mayBeOutdated: true })
    vi.restoreAllMocks()
    expect((await rawAll(factory, 'spaces')).keys).toEqual([])
    expect(await tab(factory, storage).load()).toEqual({ status: 'loaded', space: { data: checked(data), revision: 1 } })
  })

  it('never writes over a destination it cannot read: keeps both copies and says what can be done', async () => {
    const factory = new IDBFactory()
    const data = ownSpace()
    const storage = withOlderCopy(data)
    const damaged = { format: 1, revision: 3, savedAt: NOW, data: { schemaVersion: 3, space: 'damaged' } }
    await rawPut(factory, 'spaces', 'my-space', damaged)
    expect(await tab(factory, storage).load()).toEqual({
      status: 'unreadable', source: 'space', reason: 'broken', errors: expect.any(Array), olderCopy: true,
    })
    expect((await rawAll(factory, 'spaces')).values).toEqual([damaged])
    expect((await rawAll(factory, 'meta')).keys).toEqual([])
    expect(storage.getItem(OLDER_COPY_KEY)).toBe(exportFinanceData(data))
  })

  it('keeps a destination saved by a newer version of the app', async () => {
    const factory = new IDBFactory()
    const storage = withOlderCopy(ownSpace())
    const newer = { format: 2, revision: 9, savedAt: NOW, data: {} }
    await rawPut(factory, 'spaces', 'my-space', newer)
    expect(await tab(factory, storage).load()).toMatchObject({ status: 'unreadable', reason: 'newer-version', olderCopy: true })
    expect((await rawAll(factory, 'spaces')).values).toEqual([newer])
  })

  it('stops when a first copy does not match the older copy, and keeps both', async () => {
    const factory = new IDBFactory()
    const data = ownSpace()
    const storage = withOlderCopy(data)
    await rawPut(factory, 'spaces', 'my-space', { format: 1, revision: 1, savedAt: NOW, data: renamed(data, 'Different') })
    expect(await tab(factory, storage).load()).toMatchObject({ status: 'unreadable', reason: 'copies-differ', olderCopy: true })
    expect((await rawAll(factory, 'spaces')).values).toEqual([{ format: 1, revision: 1, savedAt: NOW, data: renamed(data, 'Different') }])
    expect((await rawAll(factory, 'meta')).keys).toEqual([])
  })

  it('says when the older copy itself cannot be read, and writes nothing', async () => {
    const factory = new IDBFactory()
    const storage = memoryStorage()
    storage.setItem(OLDER_COPY_KEY, '{ not json')
    expect(await tab(factory, storage).load()).toMatchObject({ status: 'unreadable', source: 'older-copy', reason: 'broken', olderCopy: false })
    expect((await rawAll(factory, 'spaces')).keys).toEqual([])
    expect((await rawAll(factory, 'meta')).keys).toEqual([])
  })

  it('gives one copy and one current space when two tabs bring the older copy in at the same time', async () => {
    const factory = new IDBFactory()
    const data = ownSpace()
    const storage = withOlderCopy(data)
    const steps = [gate(), gate()]
    const first = tab(factory, storage, { pause: () => steps[0].passed })
    const second = tab(factory, storage, { pause: () => steps[1].passed })
    const loads = [first.load(), second.load()]
    await settle()
    steps[0].open()
    steps[1].open()
    const [a, b] = await Promise.all(loads)
    expect(a).toEqual({ status: 'loaded', space: { data: checked(data), revision: 1 } })
    expect(b).toEqual(a)
    expect((await rawAll(factory, 'spaces')).keys).toEqual(['my-space'])
  })

  it('does not replace newer changes: a slower tab finds the space another tab already brought in and changed', async () => {
    const factory = new IDBFactory()
    const data = ownSpace()
    const storage = withOlderCopy(data)
    const slow = gate()
    const slowTab = tab(factory, storage, { pause: async step => { if (step === 'before-activate') await slow.passed } })
    const slowLoad = slowTab.load()
    await settle()
    const fast = tab(factory, storage)
    expect(await fast.load()).toMatchObject({ status: 'loaded', space: { revision: 1 } })
    expect(await fast.save(renamed(checked(data), 'Changed by the fast tab'), 1)).toEqual({ status: 'saved', revision: 2 })
    slow.open()
    expect(await slowLoad).toMatchObject({ status: 'loaded', space: { revision: 2, data: { space: { name: 'Changed by the fast tab' } } } })
  })
  it('checks the copy again inside the activating transaction: a copy changed after the check is not activated', async () => {
    const factory = new IDBFactory()
    const data = ownSpace()
    const storage = withOlderCopy(data)
    const held = gate()
    const store = tab(factory, storage, { pause: async step => { if (step === 'before-activate') await held.passed } })
    const pending = store.load()
    await settle()
    const swapped = { format: 1, revision: 1, savedAt: NOW, data: renamed(data, 'Swapped after the check') }
    await rawPut(factory, 'spaces', 'my-space', swapped)
    held.open()
    expect(await pending).toMatchObject({ status: 'unreadable', reason: 'copies-differ', olderCopy: true })
    expect((await rawAll(factory, 'spaces')).values).toEqual([swapped])
    expect((await rawAll(factory, 'meta')).keys).toEqual([])
  })
})

describe('IndexedDB store: Use Older Copy', () => {
  it('sets the unreadable space aside in quarantine, never over an earlier one, and opens the older copy', async () => {
    const factory = new IDBFactory()
    const data = ownSpace()
    const storage = withOlderCopy(data)
    const firstDamage = { format: 1, revision: 4, savedAt: NOW, data: 'damaged' }
    await rawPut(factory, 'spaces', 'my-space', firstDamage)
    await rawPut(factory, 'meta', 'current-space', 'my-space')
    const store = tab(factory, storage)
    expect(await store.load()).toMatchObject({ status: 'unreadable', source: 'space', olderCopy: true })
    expect(await store.useOlderCopy()).toEqual({ status: 'saved', revision: 5 })
    expect(await store.load()).toEqual({ status: 'loaded', space: { data: checked(data), revision: 5 } })

    const secondDamage = { format: 1, revision: 7, savedAt: NOW, data: 'damaged again' }
    await rawPut(factory, 'spaces', 'my-space', secondDamage)
    expect(await store.load()).toMatchObject({ status: 'unreadable' })
    expect(await store.useOlderCopy()).toEqual({ status: 'saved', revision: 8 })
    const quarantine = await rawAll(factory, 'quarantine')
    expect(quarantine.keys).toHaveLength(2)
    expect(quarantine.values).toEqual([
      { movedAt: NOW, spaceId: 'my-space', value: firstDamage },
      { movedAt: NOW, spaceId: 'my-space', value: secondDamage },
    ])
  })

  it('changes nothing if the space changed after the user saw the problem', async () => {
    const factory = new IDBFactory()
    const data = ownSpace()
    const storage = withOlderCopy(data)
    await rawPut(factory, 'spaces', 'my-space', { format: 1, revision: 4, savedAt: NOW, data: 'damaged' })
    await rawPut(factory, 'meta', 'current-space', 'my-space')
    const store = tab(factory, storage)
    await store.load()
    // Another tab replaced it with a good revision meanwhile.
    const fixed = { format: 1, revision: 5, savedAt: NOW, data: renamed(data, 'Fixed elsewhere') }
    await rawPut(factory, 'spaces', 'my-space', fixed)
    expect(await store.useOlderCopy()).toMatchObject({ status: 'conflict', latest: { revision: 5 } })
    expect((await rawAll(factory, 'spaces')).values).toEqual([fixed])
    expect((await rawAll(factory, 'quarantine')).keys).toEqual([])
  })

  it('also resolves a copy that did not match, keeping that copy in quarantine', async () => {
    const factory = new IDBFactory()
    const data = ownSpace()
    const storage = withOlderCopy(data)
    const other = { format: 1, revision: 1, savedAt: NOW, data: renamed(data, 'Different') }
    await rawPut(factory, 'spaces', 'my-space', other)
    const store = tab(factory, storage)
    expect(await store.load()).toMatchObject({ status: 'unreadable', reason: 'copies-differ' })
    expect(await store.useOlderCopy()).toEqual({ status: 'saved', revision: 2 })
    expect(await store.load()).toEqual({ status: 'loaded', space: { data: checked(data), revision: 2 } })
    expect((await rawAll(factory, 'quarantine')).values).toEqual([{ movedAt: NOW, spaceId: 'my-space', value: other }])
  })

  it('sets aside both spaces when the older copy belongs under another id that already holds something', async () => {
    const factory = new IDBFactory()
    const data = ownSpace()
    const storage = withOlderCopy(data)
    const damaged = { format: 1, revision: 3, savedAt: NOW, data: 'damaged' }
    await rawPut(factory, 'spaces', 'other-space', damaged)
    await rawPut(factory, 'meta', 'current-space', 'other-space')
    const store = tab(factory, storage)
    expect(await store.load()).toMatchObject({ status: 'unreadable', source: 'space', olderCopy: true })
    // Written under the older copy's id after the user saw the problem: it must be read in the same transaction, not written over.
    const unseen = { format: 1, revision: 9, savedAt: NOW, data: renamed(data, 'Never reviewed') }
    await rawPut(factory, 'spaces', 'my-space', unseen)
    expect(await store.useOlderCopy()).toEqual({ status: 'saved', revision: 10 })
    expect(await store.load()).toEqual({ status: 'loaded', space: { data: checked(data), revision: 10 } })
    expect((await rawAll(factory, 'spaces')).keys).toEqual(['my-space'])
    expect((await rawAll(factory, 'quarantine')).values).toEqual([
      { movedAt: NOW, spaceId: 'other-space', value: damaged },
      { movedAt: NOW, spaceId: 'my-space', value: unseen },
    ])
  })

  it('also sets aside a damaged space under the older copy id, and skips one that holds the same records', async () => {
    const factory = new IDBFactory()
    const data = ownSpace()
    const storage = withOlderCopy(data)
    const damaged = { format: 1, revision: 2, savedAt: NOW, data: 'damaged' }
    const alsoDamaged = { format: 1, revision: 6, savedAt: NOW, data: 'also damaged' }
    await rawPut(factory, 'spaces', 'other-space', damaged)
    await rawPut(factory, 'spaces', 'my-space', alsoDamaged)
    await rawPut(factory, 'meta', 'current-space', 'other-space')
    const store = tab(factory, storage)
    await store.load()
    expect(await store.useOlderCopy()).toEqual({ status: 'saved', revision: 7 })
    expect((await rawAll(factory, 'quarantine')).values).toEqual([
      { movedAt: NOW, spaceId: 'other-space', value: damaged },
      { movedAt: NOW, spaceId: 'my-space', value: alsoDamaged },
    ])

    // Same records as the older copy: nothing would be lost, so nothing more goes to quarantine.
    await rawPut(factory, 'spaces', 'other-space', damaged)
    await rawPut(factory, 'meta', 'current-space', 'other-space')
    await store.load()
    expect(await store.useOlderCopy()).toEqual({ status: 'saved', revision: 8 })
    expect((await rawAll(factory, 'quarantine')).values).toHaveLength(3)
  })

  it('writes nothing when setting a copy aside fails', async () => {
    const factory = new IDBFactory()
    const data = ownSpace()
    const storage = withOlderCopy(data)
    const damaged = { format: 1, revision: 3, savedAt: NOW, data: 'damaged' }
    const unseen = { format: 1, revision: 9, savedAt: NOW, data: renamed(data, 'Never reviewed') }
    await rawPut(factory, 'spaces', 'other-space', damaged)
    await rawPut(factory, 'spaces', 'my-space', unseen)
    await rawPut(factory, 'meta', 'current-space', 'other-space')
    const store = tab(factory, storage)
    await store.load()
    const add = IDBObjectStore.prototype.add
    let calls = 0
    vi.spyOn(IDBObjectStore.prototype, 'add').mockImplementation(function (this: IDBObjectStore, ...args: Parameters<IDBObjectStore['add']>) {
      calls += 1
      if (calls === 2) throw new Error('quota')
      return add.apply(this, args)
    })
    expect(await store.useOlderCopy()).toEqual({ status: 'failed' })
    vi.restoreAllMocks()
    expect((await rawAll(factory, 'spaces')).values).toEqual([unseen, damaged])
    expect((await rawAll(factory, 'quarantine')).keys).toEqual([])
  })

  it('is refused without an unreadable space seen first', async () => {
    const factory = new IDBFactory()
    const store = tab(factory, withOlderCopy(ownSpace()))
    expect(await store.useOlderCopy()).toEqual({ status: 'failed' })
  })
})

describe('IndexedDB store: erasing', () => {
  it('erases the space, marks and removes the older copy, and opens nothing afterwards', async () => {
    const factory = new IDBFactory()
    const storage = withOlderCopy(ownSpace())
    const store = tab(factory, storage)
    await store.load()
    expect(await store.erase()).toEqual({ status: 'erased' })
    expect(storage.getItem(OLDER_COPY_KEY)).toBeNull()
    expect(storage.getItem(ERASED_KEY)).toBe('yes')
    expect(await tab(factory, storage).load()).toEqual({ status: 'empty' })
    expect((await rawAll(factory, 'spaces')).keys).toEqual([])
  })

  it('does not say "erased" while the older copy is still there, and never brings that copy back', async () => {
    const factory = new IDBFactory()
    const inner = withOlderCopy(ownSpace())
    const stubborn: Storage = { ...inner, getItem: key => inner.getItem(key), setItem: (key, value) => inner.setItem(key, value), removeItem: () => { throw new Error('refused') } }
    const store = tab(factory, stubborn)
    await store.load()
    expect(await store.erase()).toEqual({ status: 'partly-erased', remaining: 'older-copy' })
    expect(inner.getItem(OLDER_COPY_KEY)).not.toBeNull()
    expect(await tab(factory, stubborn).load()).toEqual({ status: 'empty' })
    // Even a browser without the database does not open it: the erased mark is there.
    expect(await tab(null, stubborn).load()).toEqual({ status: 'read-only', space: null, mayBeOutdated: true })
  })

  it('keeps a save from another tab from bringing an erased space back, in either order', async () => {
    const factory = new IDBFactory()
    const storage = memoryStorage()
    const eraser = tab(factory, storage)
    const saver = tab(factory, storage)
    const data = ownSpace()
    await eraser.create(data)

    expect(await eraser.erase()).toEqual({ status: 'erased' })
    expect(await saver.save(renamed(data, 'Late'), 1)).toEqual({ status: 'conflict', latest: null })
    expect(await saver.load()).toEqual({ status: 'empty' })

    await eraser.create(data)
    const [saved, erased] = await Promise.all([saver.save(renamed(data, 'Racing'), 1), eraser.erase()])
    expect(erased).toEqual({ status: 'erased' })
    expect(['saved', 'conflict']).toContain(saved.status)
    expect(await saver.load()).toEqual({ status: 'empty' })
    expect(await saver.save(renamed(data, 'After'), saved.status === 'saved' ? saved.revision : 1)).toEqual({ status: 'conflict', latest: null })
    expect((await rawAll(factory, 'spaces')).keys).toEqual([])
  })

  it('keeps a tab that was bringing in the older copy from activating it after an erase', async () => {
    for (const step of ['before-copy', 'before-activate'] as const) {
      const factory = new IDBFactory()
      const storage = withOlderCopy(ownSpace())
      const held = gate()
      const migrating = tab(factory, storage, { pause: async at => { if (at === step) await held.passed } })
      const pending = migrating.load()
      await settle()
      expect(await tab(factory, storage).erase()).toEqual({ status: 'erased' })
      held.open()
      expect(await pending).toEqual({ status: 'empty' })
      expect((await rawAll(factory, 'spaces')).keys).toEqual([])
      expect(await tab(factory, storage).load()).toEqual({ status: 'empty' })
    }
  })

  it('lets a new space start after an erase, and an old tab cannot save into it', async () => {
    const factory = new IDBFactory()
    const storage = memoryStorage()
    const oldTab = tab(factory, storage)
    const before = ownSpace()
    await oldTab.create(before)
    await oldTab.erase()
    const newTab = tab(factory, storage)
    const fresh = { ...ownSpace('Kim'), space: { ...ownSpace('Kim').space, id: 'new-space-id' } }
    expect(await newTab.create(fresh)).toEqual({ status: 'saved', revision: 2 })
    expect(await oldTab.save(renamed(before, 'Old tab'), 1)).toMatchObject({ status: 'conflict', latest: { revision: 2, data: { space: { id: 'new-space-id' } } } })
  })
})

describe('IndexedDB store: notices between tabs', () => {
  it('lets a newer version of the app take the database over, and then reads and saves nothing more', async () => {
    const factory = new IDBFactory()
    const store = tab(factory, memoryStorage())
    const data = ownSpace()
    await store.create(data)
    const changes: string[] = []
    store.watch(change => changes.push(change.kind))
    // A newer version opens the database in another tab: this tab lets it upgrade.
    const newer = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = factory.open(DATABASE_NAME, 2)
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
      request.onblocked = () => reject(new Error('blocked'))
    })
    expect(changes).toEqual(['closed'])
    expect(await store.save(renamed(data, 'Too late'), 1)).toEqual({ status: 'failed' })
    expect(await store.load()).toMatchObject({ status: 'read-only' })
    expect(await store.erase()).toEqual({ status: 'failed' })
    newer.close()
  })

  it("tells other tabs about a save or an erase, but not the tab that made it", async () => {
    const factory = new IDBFactory()
    const storage = memoryStorage()
    const first = tab(factory, storage)
    const second = tab(factory, storage)
    const heardByFirst: unknown[] = []
    const heardBySecond: unknown[] = []
    const stops = [first.watch(change => heardByFirst.push(change)), second.watch(change => heardBySecond.push(change))]
    const data = ownSpace()
    await first.create(data)
    await first.save(renamed(data, 'Second'), 1)
    await first.erase()
    await settle()
    stops.forEach(stop => stop())
    expect(heardByFirst).toEqual([])
    expect(heardBySecond).toEqual([
      { kind: 'saved', spaceId: 'my-space', revision: 1 },
      { kind: 'saved', spaceId: 'my-space', revision: 2 },
      { kind: 'erased' },
    ])
  })
})

describe('IndexedDB store: when the database cannot be used', () => {
  it('opens the older copy read-only, says it may be out of date, and saves nothing', async () => {
    const data = ownSpace()
    const store = tab(null, withOlderCopy(data))
    expect(await store.load()).toEqual({ status: 'read-only', space: { data: checked(data), revision: 0 }, mayBeOutdated: true })
    expect(await store.save(data, 0)).toEqual({ status: 'failed' })
    expect(await store.create(data)).toEqual({ status: 'failed' })
    expect(await store.erase()).toEqual({ status: 'failed' })
  })

  it('does not open an older copy that was erased', async () => {
    const storage = withOlderCopy(ownSpace())
    storage.setItem(ERASED_KEY, 'yes')
    expect(await tab(null, storage).load()).toEqual({ status: 'read-only', space: null, mayBeOutdated: true })
  })

  it('goes read-only when the browser refuses to open the database', async () => {
    const factory = new IDBFactory()
    vi.spyOn(factory, 'open').mockImplementation(() => { throw new Error('blocked by the browser') })
    expect(await tab(factory, withOlderCopy(ownSpace())).load()).toMatchObject({ status: 'read-only', mayBeOutdated: true })
  })
})
