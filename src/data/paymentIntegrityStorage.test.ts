import { IDBFactory } from 'fake-indexeddb'
import { expect, it } from 'vitest'
import { createSpaceData } from '../domain/finance/space'
import { billsForMonth, deleteBill, markBillPaid } from '../domain/finance/bills'
import { activityLog } from '../domain/finance/history'
import { applyPause, simulateSubscription } from '../domain/finance/subscriptions'
import { memoryStorage } from '../test/memoryStorage'
import { exportFinanceData, importFinanceData } from './exchange'
import { createIndexedDbStore } from './indexedDbStore'
import { OLDER_COPY_KEY, readEnvelope } from './savedCopies'
import { recoveryFile } from './recovery'

function fixture() {
  const made = createSpaceData({ mode: 'individual', names: ['Invented Robin'], currency: 'PLN', theme: 'light' })
  if (made.status !== 'created') throw Error('setup')
  return { ...made.data, bills: [{ id: 'stream', name: 'Test Stream', category: 'Subscriptions' as const, owner: 'shared',
    currency: made.data.space.currency, amount: 12345, dueDay: 5, startMonth: '2026-01', endMonth: null }] }
}
it('migrates an older saved copy with an excluded payment, preserves recovery, and round-trips it', async () => {
  const original = fixture()
  const paid = markBillPaid(original, 'stream', '2026-04', { amount: 12345, paidOn: '2026-02-01', paidFrom: null, interest: null }, '2026-02-01')
  const legacy = { ...paid, bills: paid.bills.map(b => ({ ...b, endMonth: '2026-02', pausedMonths: ['2026-04'] })) }
  const storage = memoryStorage()
  const text = exportFinanceData(legacy)
  storage.setItem(OLDER_COPY_KEY, text)
  const store = createIndexedDbStore({ indexedDB: new IDBFactory(), olderCopy: storage, window: null })
  try {
    const load = await store.load()
    if (load.status !== 'loaded') throw Error('load')
    expect(load.space.data.billMonths).toEqual(paid.billMonths)
    expect(activityLog(load.space.data).filter(e => e.type === 'bill')).toHaveLength(1)
    expect(billsForMonth(load.space.data, '2026-04')).toMatchObject([{ paid: true, amount: 12345 }])
    expect(importFinanceData(exportFinanceData(load.space.data))).toMatchObject({ status: 'imported', data: { billMonths: paid.billMonths } })
    const copies = await store.exportCopies()
    expect(copies.olderCopy).toBe(text)
    const envelope = readEnvelope(copies.database?.spaces[0].stored)
    expect(envelope.ok && envelope.value.data.billMonths).toEqual(paid.billMonths)
    const recovery = recoveryFile(copies, '2026-11-05T12:00:00.000Z')
    expect(JSON.parse(recovery).olderCopy).toBe(text)
    expect(importFinanceData(recovery).status).toBe('rejected')
    expect(storage.getItem(OLDER_COPY_KEY)).toBe(text)
  } finally { store.close() }
})

it('two tabs cannot overwrite a new payment with a stale pause or Delete confirmation', async () => {
  const factory = new IDBFactory()
  const a = createIndexedDbStore({ indexedDB: factory, olderCopy: memoryStorage(), window: null })
  const b = createIndexedDbStore({ indexedDB: factory, olderCopy: memoryStorage(), window: null })
  try {
    await a.create(fixture())
    const stale = await a.load()
    const current = await b.load()
    if (stale.status !== 'loaded' || current.status !== 'loaded') throw Error('load')
    const sim = simulateSubscription(stale.space.data, 'stream', 'pause', '2026-02-01')!
    const paid = markBillPaid(current.space.data, 'stream', '2026-04', { amount: 12345, paidOn: '2026-02-01', paidFrom: null, interest: null }, '2026-02-01')
    expect((await b.save(paid, current.space.revision)).status).toBe('saved')
    expect((await a.save(applyPause(stale.space.data, sim), stale.space.revision)).status).toBe('conflict')
    expect((await a.save(deleteBill(stale.space.data, 'stream'), stale.space.revision)).status).toBe('conflict')
    const latest = await a.load()
    if (latest.status !== 'loaded') throw Error('reload')
    expect(latest.space.data.billMonths).toEqual(paid.billMonths)
    expect(applyPause(latest.space.data, sim)).toBe(latest.space.data)
    expect(activityLog(latest.space.data).filter(e => e.type === 'bill')).toHaveLength(1)
    // A fresh, explicit deletion is atomic and can be reopened/exported without orphans.
    expect((await a.save(deleteBill(latest.space.data, 'stream'), latest.space.revision)).status).toBe('saved')
    const deleted = await b.load()
    expect(deleted).toMatchObject({ status: 'loaded', space: { data: { bills: [], billMonths: [] } } })
  } finally { a.close(); b.close() }
})
