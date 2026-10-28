import { act, fireEvent } from '@testing-library/react'
import { IDBFactory, IDBObjectStore } from 'fake-indexeddb'
import { afterEach, beforeEach, vi } from 'vitest'
import { DATABASE_NAME } from '../data/indexedDbStore'
import { readEnvelope } from '../data/savedCopies'
import type { SpaceStore, StoredSpace } from '../data/spaceStore'
import { browserSpaceStore } from '../app/useSpace'
import { memoryStorage } from './memoryStorage'
import type { FinanceData } from '../domain/finance/types'

/*
 * The app saves the own space in the browser's database, and every answer
 * comes later. These helpers give each test its own empty database, and
 * wait until the app has opened the space and every save has been answered.
 */

/** A new, empty browser database now: as on another device. */
export function freshDatabase() {
  vi.stubGlobal('indexedDB', new IDBFactory())
}

/** A new, empty browser database for each test of the file (fake-indexeddb). */
export function freshDatabaseForEachTest() {
  beforeEach(freshDatabase)
  afterEach(() => { vi.unstubAllGlobals() })
}

/** Makes the browser's database refuse every write until `vi.restoreAllMocks()`. */
export function refuseWrites() {
  const refuse = () => { throw new DOMException('The disk is full.', 'QuotaExceededError') }
  vi.spyOn(IDBObjectStore.prototype, 'add').mockImplementation(refuse)
  vi.spyOn(IDBObjectStore.prototype, 'put').mockImplementation(refuse)
}

const tick = () => new Promise(resolve => setTimeout(resolve, 0))

/** Waits until nothing is opening or being saved, and the screens have shown the answers. */
export async function settle() {
  // One step per act(): React shows what changed at the end of each, so the page can be checked in between.
  let quiet = 0
  for (let step = 0; step < 1000 && quiet < 3; step++) {
    await act(tick)
    quiet = document.querySelector('[data-saving], [data-screen="opening"]') ? 0 : quiet + 1
  }
}

type Fire = { [K in keyof typeof fireEvent]: (...args: Parameters<(typeof fireEvent)[K]>) => Promise<void> }

/** `fireEvent`, then `settle`: each event waits for what it starts (a save, an opening) to be answered. */
export const fire = new Proxy(fireEvent, {
  get: (target, key) => async (...args: unknown[]) => {
    (target[key as keyof typeof fireEvent] as (...a: unknown[]) => unknown)(...args)
    await settle()
  },
}) as unknown as Fire

/** The own space as the browser's database keeps it now, or null when there is none. */
export async function storedSpace(): Promise<StoredSpace | null> {
  const factory = (globalThis as { indexedDB: IDBFactory }).indexedDB
  const db = await new Promise<IDBDatabase>((resolve, reject) => {
    const request = factory.open(DATABASE_NAME)
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
  try {
    if (!db.objectStoreNames.contains('meta')) return null
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(['meta', 'spaces'], 'readonly')
      const current = tx.objectStore('meta').get('current-space')
      current.onsuccess = () => {
        if (typeof current.result !== 'string') { resolve(null); return }
        const envelope = tx.objectStore('spaces').get(current.result)
        envelope.onsuccess = () => {
          const reading = readEnvelope(envelope.result)
          resolve(reading.ok ? reading.value : null)
        }
      }
      tx.onerror = () => reject(tx.error)
    })
  } finally {
    db.close()
  }
}

/** The records of the own space as saved now (null: none). */
export async function storedData(): Promise<FinanceData | null> {
  return (await storedSpace())?.data ?? null
}

/**
 * The real store (the browser's database), but every call can be held:
 * while `hold()` is on, a call starts only on `release()`. That is a slow
 * device: the write still happens, only later.
 */
export function heldStore(inner: SpaceStore = browserSpaceStore(memoryStorage())) {
  let holding = false
  const waiting: Array<() => void> = []
  const calls: string[] = []
  const later = <T>(name: string, run: () => Promise<T>): Promise<T> => {
    calls.push(name)
    if (!holding) return run()
    return new Promise<T>((resolve, reject) => { waiting.push(() => { run().then(resolve, reject) }) })
  }
  const store: SpaceStore = {
    load: () => later('load', () => inner.load()),
    create: data => later('create', () => inner.create(data)),
    save: (data, base) => later('save', () => inner.save(data, base)),
    erase: () => later('erase', () => inner.erase()),
    useOlderCopy: () => later('useOlderCopy', () => inner.useOlderCopy()),
    watch: onChange => inner.watch(onChange),
  }
  return {
    store,
    calls,
    hold: () => { holding = true },
    /** Lets every held call go on, and waits for the answers. */
    release: async () => {
      holding = false
      await act(async () => {
        while (waiting.length) waiting.shift()!()
        for (let i = 0; i < 20; i++) await new Promise(resolve => setTimeout(resolve, 0))
      })
    },
  }
}
