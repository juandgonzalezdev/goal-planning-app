import { describe, expect, it } from 'vitest'
import { createSpaceData } from '../domain/finance/space'
import { createDemoHousehold } from './fixtures/demoHousehold'
import { memoryStorage } from '../test/memoryStorage'
import { createLocalStore } from './localStore'

const mySpace = () => {
  const result = createSpaceData({ mode: 'individual', names: ['Robin'], currency: 'PLN', theme: 'system' })
  if (result.status !== 'created') throw new Error('expected a space')
  return result.data
}

describe('local store', () => {
  it('is empty on a new device', () => {
    expect(createLocalStore(memoryStorage()).load()).toEqual({ status: 'empty' })
  })

  it('saves and loads the same space', () => {
    const storage = memoryStorage()
    const store = createLocalStore(storage)
    const data = mySpace()
    expect(store.save(data)).toBe(true)
    expect(createLocalStore(storage).load()).toEqual({ status: 'loaded', data })
  })

  it('erases the saved space', () => {
    const storage = memoryStorage()
    const store = createLocalStore(storage)
    store.save(mySpace())
    expect(store.clear()).toBe(true)
    expect(store.load()).toEqual({ status: 'empty' })
  })

  it('reports unreadable data without changing it', () => {
    const storage = memoryStorage()
    storage.setItem('goal-planning-app.my-space', '{ broken')
    expect(createLocalStore(storage).load()).toEqual({ status: 'unreadable', errors: ['The file is not valid JSON.'] })
    expect(storage.getItem('goal-planning-app.my-space')).toBe('{ broken')
  })

  it('refuses data from a newer version of the app', () => {
    const storage = memoryStorage()
    storage.setItem('goal-planning-app.my-space', JSON.stringify({ ...createDemoHousehold(), schemaVersion: 9 }))
    expect(createLocalStore(storage).load()).toMatchObject({ status: 'unreadable' })
  })

  it('says so when the browser will not save or read', () => {
    expect(createLocalStore(memoryStorage({ failWrites: true })).save(mySpace())).toBe(false)
    expect(createLocalStore(memoryStorage({ failReads: true })).load()).toMatchObject({ status: 'unreadable' })
    expect(createLocalStore(null).save(mySpace())).toBe(false)
    expect(createLocalStore(null).load()).toEqual({ status: 'empty' })
  })
})
