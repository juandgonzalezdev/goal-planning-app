/**
 * Small helpers around the browser's database (IndexedDB), so the store
 * reads as steps instead of callbacks.
 *
 * IndexedDB never runs two read-write transactions on the same stores at
 * the same time, not even from two tabs: the second waits until the first
 * has finished. That is what makes "compare the revision, then write"
 * safe between tabs, as long as both happen inside one transaction.
 */

/**
 * Opens (and on the first visit, creates) a database. Never blocks other tabs from upgrading it later:
 * when a newer version of the app asks for it, it is closed and `onClosed` is called.
 */
export function openDatabase(factory: IDBFactory, name: string, version: number, upgrade: (db: IDBDatabase) => void,
  onClosed: () => void = () => {}): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    let request: IDBOpenDBRequest
    try {
      request = factory.open(name, version)
    } catch (error) {
      reject(error)
      return
    }
    request.onupgradeneeded = () => upgrade(request.result)
    request.onsuccess = () => {
      const db = request.result
      // A newer version of the app opened in another tab: let it upgrade.
      db.onversionchange = () => { db.close(); onClosed() }
      resolve(db)
    }
    request.onerror = () => reject(request.error ?? new Error('The database could not be opened.'))
    request.onblocked = () => reject(new Error('The database is blocked by another tab.'))
  })
}

/** How the work inside a transaction ends: `done` keeps what it wrote, `undo` writes nothing. */
export interface Ending<T> {
  done(value: T): void
  undo(value: T): void
}

/**
 * Runs `work` in one transaction. It settles only when the transaction as
 * a whole has finished, never when a single request succeeds:
 * - finished after `done(value)`: resolves with `value`;
 * - undone with `undo(value)`: nothing is written; resolves with `value`;
 * - anything else (an error, an abort, the browser closing it): rejects,
 *   and nothing is written.
 *
 * `work` must start its requests straight away, chained in their
 * callbacks, without waiting for anything outside the database: the
 * browser closes a transaction as soon as it has nothing left to do.
 */
export function transact<T>(db: IDBDatabase, stores: string[], mode: IDBTransactionMode, work: (tx: IDBTransaction, end: Ending<T>) => void): Promise<T> {
  return new Promise((resolve, reject) => {
    let tx: IDBTransaction
    try {
      // 'strict': the browser confirms only after the data is on disk.
      tx = db.transaction(stores, mode, { durability: 'strict' })
    } catch (error) {
      reject(error)
      return
    }
    let result: { value: T } | null = null
    let undone: { value: T } | null = null
    tx.oncomplete = () => {
      if (result) resolve(result.value)
      else reject(new Error('The transaction finished without an answer.'))
    }
    tx.onabort = () => {
      if (undone) resolve(undone.value)
      else reject(tx.error ?? new Error('The transaction was stopped.'))
    }
    try {
      work(tx, {
        done: value => { result = { value } },
        undo: value => { undone = { value }; tx.abort() },
      })
    } catch (error) {
      try { tx.abort() } catch { /* already finished */ }
      reject(error)
    }
  })
}

/** Calls `then` with a request's result when it succeeds. */
export function when<R>(request: IDBRequest<R>, then: (value: R) => void): void {
  request.onsuccess = () => then(request.result)
}
