/** A small in-memory stand-in for the browser's localStorage. */
export function memoryStorage(options: { failWrites?: boolean; failReads?: boolean } = {}): Storage {
  const values = new Map<string, string>()
  return {
    get length() { return values.size },
    clear: () => values.clear(),
    key: index => [...values.keys()][index] ?? null,
    getItem: key => { if (options.failReads) throw new Error('blocked'); return values.get(key) ?? null },
    setItem: (key, value) => { if (options.failWrites) throw new Error('full'); values.set(key, value) },
    removeItem: key => { values.delete(key) },
  }
}

/**
 * A device that chose the classic Home (Settings › Show rings on Home turned off). Since UX-04.1
 * Ring-first is the default for a device that never chose; suites about the classic Home's areas
 * (This Month, Left to Pay, Money & Goals, Customize Home) start from this choice. A choice the
 * test already made is kept, and a storage that refuses writes stays as it is.
 */
export function classicHome(storage: Storage = memoryStorage()): Storage {
  try { if (storage.getItem('goal-planning-app.home-rings') === null) storage.setItem('goal-planning-app.home-rings', 'no') } catch { /* Refused: the default applies. */ }
  return storage
}

/** The keys a storage holds now (to check that nothing else was written). */
export const storedKeys = (storage: Storage): string[] => Array.from({ length: storage.length }, (_, index) => storage.key(index) ?? '')
